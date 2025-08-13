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
  all: boolean;
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
    all: args.includes('--all') || args.includes('-a'),
    scheme: extractOption(args, '--scheme') || '0208'
  };
  
  // --all implies both verbose and businessCard
  if (options.all) {
    options.verbose = true;
    options.businessCard = true;
  }

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

  // Resolve with appropriate options based on flags
  const result = await resolver.resolve(participantId, {
    fetchDocumentTypes: options.verbose || options.all,
    includeBusinessCard: options.businessCard || options.all
  });

  if (options.quiet) {
    // In quiet mode, show registration status
    if (!result.isRegistered) {
      console.log('not registered');
    } else if (result.registrationStatus === 'parked') {
      console.log('parked (no active endpoints)');
    } else {
      console.log('registered');
    }
    return;
  }

  if (options.csv) {
    const batchResult = {
      participantId,
      success: result.isRegistered,
      registrationStatus: result.registrationStatus,
      hasActiveEndpoints: result.hasActiveEndpoints,
      smpHostname: result.smpHostname,
      as4EndpointUrl: result.endpoint?.url,
      technicalContactUrl: result.endpoint?.technicalContactUrl,
      technicalInfoUrl: result.endpoint?.technicalInformationUrl,
      serviceDescription: result.endpoint?.serviceDescription,
      errorMessage: result.error,
      processedAt: new Date()
    };
    console.log(CSVExporter.formatBulkResults([batchResult]));
  } else {
    // Add visual indicators for different registration statuses
    if (options.verbose && result.registrationStatus) {
      const statusEmoji = {
        'active': '✅',
        'parked': '⚠️',
        'unregistered': '❌'
      }[result.registrationStatus];
      
      const enhancedResult: any = {
        ...result,
        _status: `${statusEmoji} ${result.registrationStatus.toUpperCase()}`
      };
      
      if (result.registrationStatus === 'parked') {
        enhancedResult._note = 'This participant is registered but has no active AS4 endpoints configured';
      }
      
      console.log(JSON.stringify(enhancedResult, null, 2));
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
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
  -a, --all           Fetch all available information (verbose + business card)
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
  
  # Fetch all information (verbose + business card)
  smp-resolve 0123456789 --all
`);
}

// Run the CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
