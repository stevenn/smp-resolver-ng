#!/usr/bin/env node

import { SMPResolver } from '../index.js';
import { CSVExporter } from '../csv/exporter.js';
import type { BusinessCard, EndpointInfo, ParticipantInfo } from '../types/index.js';

interface CLIOptions {
  verbose: boolean;
  quiet: boolean;
  csv: boolean;
  batch: boolean;
  businessCard: boolean;
  scheme?: string;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const options: CLIOptions = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    quiet: args.includes('--quiet') || args.includes('-q'),
    csv: args.includes('--csv'),
    batch: args.includes('--batch'),
    businessCard: args.includes('--business-card') || args.includes('-b'),
    scheme: extractOption(args, '--scheme') || '0208'
  };

  // Get participant IDs (all non-option arguments)
  const participantIds = args.filter(arg => !arg.startsWith('-'));

  if (participantIds.length === 0) {
    console.error('Error: No participant ID provided');
    showHelp();
    process.exit(1);
  }

  const resolver = new SMPResolver({
    smlDomain: 'edelivery.tech.ec.europa.eu'
  });

  try {
    if (options.batch || participantIds.length > 1) {
      await processBatch(resolver, participantIds, options);
    } else {
      await processSingle(resolver, participantIds[0], options);
    }
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await resolver.close();
    // Force exit to ensure all connections are closed
    process.exit(0);
  }
}

async function processSingle(resolver: SMPResolver, participantId: string, options: CLIOptions) {
  // Ensure proper format
  if (!participantId.includes(':')) {
    participantId = `${options.scheme}:${participantId}`;
  }

  let result:
    | {
        participantId: string;
        isRegistered: boolean;
        businessCard?: BusinessCard;
        error?: string;
        endpointDetails?: EndpointInfo;
      }
    | ParticipantInfo;

  if (options.businessCard) {
    // Fetch business card with entity details
    try {
      const businessCard = await resolver.getBusinessCard(participantId);

      result = {
        participantId,
        isRegistered: true,
        businessCard
      };
    } catch (error: unknown) {
      result = {
        participantId,
        isRegistered: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  } else {
    // Standard resolution
    result = await resolver.resolve(participantId, {
      fetchDocumentTypes: options.verbose
    });

    // If verbose mode, also fetch endpoint URLs
    if (options.verbose && result.isRegistered) {
      try {
        const endpointInfo = await resolver.getEndpointUrls(participantId);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (result as any).endpointDetails = endpointInfo;
      } catch {
        // Continue even if endpoint fetch fails
      }
    }
  }

  if (options.quiet) {
    console.log(result.isRegistered ? 'registered' : 'not registered');
    return;
  }

  if (options.csv) {
    const batchResult = {
      participantId,
      success: result.isRegistered,
      smpHostname: 'endpointInfo' in result ? result.endpointInfo?.smpHostname : undefined,
      as4EndpointUrl: undefined,
      technicalContactUrl: undefined,
      technicalInfoUrl: undefined,
      errorMessage: result.error,
      processedAt: new Date()
    };
    console.log(CSVExporter.formatBulkResults([batchResult]));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

async function processBatch(resolver: SMPResolver, participantIds: string[], options: CLIOptions) {
  // Ensure proper format for all IDs
  const formattedIds = participantIds.map(id =>
    id.includes(':') ? id : `${options.scheme}:${id}`
  );

  if (options.verbose) {
    console.log(`Processing ${formattedIds.length} participants in batch mode`);
  }

  const results = await resolver.resolveBatch(formattedIds, {
    concurrency: 20,
    onProgress: options.verbose
      ? (done, total) => {
          process.stdout.write(
            `\\rProgress: ${done}/${total} (${((done / total) * 100).toFixed(1)}%)`
          );
        }
      : undefined
  });

  if (options.verbose) {
    console.log('\\n---');
  }

  if (options.csv) {
    console.log(CSVExporter.formatBulkResults(results));
  } else {
    console.log(JSON.stringify(results, null, 2));
  }

  if (options.verbose) {
    console.log('\\n' + CSVExporter.createSummaryReport(results));
  }
}

function extractOption(args: string[], optionName: string): string | undefined {
  const index = args.indexOf(optionName);
  if (index >= 0 && index < args.length - 1) {
    return args[index + 1];
  }
  return undefined;
}

function showHelp() {
  console.log(`
SMP Resolver CLI

Usage:
  smp-resolve <participantId> [options]
  smp-resolve <participantId1> <participantId2> ... [options]

Options:
  -h, --help          Show this help message
  -v, --verbose       Show detailed output and progress
  -q, --quiet         Show minimal output (just registered/not registered)
  -b, --business-card Fetch full business card information
  --csv               Output in CSV format
  --batch             Process multiple participants in batch mode
  --scheme <id>       Default scheme to use (default: 0208)

Examples:
  # Check single participant with KBO number
  smp-resolve 0123456789

  # Check with explicit scheme
  smp-resolve 0208:0123456789

  # Check VAT number
  smp-resolve 9925:BE0123456789

  # Batch process with CSV output
  smp-resolve 0123456789 0987654321 --batch --csv > results.csv

  # Verbose single lookup
  smp-resolve 0123456789 -v
  
  # Fetch business card
  smp-resolve 0123456789 -b
`);
}

// Run the CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
