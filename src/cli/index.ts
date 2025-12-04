#!/usr/bin/env node

import { SMPResolver } from '../index.js';
import type { ParticipantInfo } from '../types/index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

interface CLIOptions {
  verbose: boolean;
  quiet: boolean;
  businessCard: boolean;
  all: boolean;
}

function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageJsonPath = join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Validates that a participant ID is in full format (scheme:value)
 */
function isValidParticipantId(id: string): boolean {
  const colonIndex = id.indexOf(':');
  if (colonIndex === -1) {
    return false;
  }
  const scheme = id.substring(0, colonIndex);
  const value = id.substring(colonIndex + 1);
  return scheme.length > 0 && value.length > 0;
}

async function main() {
  const args = process.argv.slice(2);

  // Handle --version flag
  if (args.includes('--version') || args.includes('-V')) {
    console.log(getVersion());
    process.exit(0);
  }

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const options: CLIOptions = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    quiet: args.includes('--quiet') || args.includes('-q'),
    businessCard: args.includes('--business-card') || args.includes('-b'),
    all: args.includes('--all') || args.includes('-a')
  };

  // --all implies both verbose and businessCard
  if (options.all) {
    options.verbose = true;
    options.businessCard = true;
  }

  // Get participant ID (first non-option argument)
  const participantId = args.find(arg => !arg.startsWith('-'));

  if (!participantId) {
    console.error('Error: No participant ID provided');
    showHelp();
    process.exit(1);
  }

  // Validate participant ID format
  if (!isValidParticipantId(participantId)) {
    console.error(`Error: Invalid participant ID format: "${participantId}"`);
    console.error('Expected format: {scheme}:{value}');
    console.error('Examples:');
    console.error('  0208:0843766574      (Belgian KBO)');
    console.error('  9925:be0843766574    (Belgian VAT - lowercase "be")');
    console.error('  0106:12345678        (Dutch KvK)');
    process.exit(1);
  }

  const resolver = new SMPResolver({
    smlDomain: 'edelivery.tech.ec.europa.eu'
  });

  try {
    await processSingle(resolver, participantId, options);
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await resolver.close();
    process.exit(0);
  }
}

async function processSingle(resolver: SMPResolver, participantId: string, options: CLIOptions) {
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

      // Add diagnostic information if available
      if (result.diagnostics?.smpErrors && result.diagnostics.smpErrors.length > 0) {
        enhancedResult._smpErrors = result.diagnostics.smpErrors.map(err => ({
          url: err.url,
          statusCode: err.statusCode,
          message: err.message
        }));
        enhancedResult._note += '. See _smpErrors for details on why endpoints could not be retrieved.';
      }
    }

    console.log(JSON.stringify(enhancedResult, null, 2));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

function showHelp() {
  console.log(`
SMP Resolver CLI v${getVersion()}

Usage:
  smp-resolve {scheme}:{value} [options]

Options:
  -h, --help          Show this help message
  -V, --version       Show version number
  -v, --verbose       Show detailed output with document types
  -q, --quiet         Show minimal output (just registered/not registered)
  -b, --business-card Fetch full business card information
  -a, --all           Fetch all available information (verbose + business card)

Participant ID Format:
  The participant ID must include the ICD scheme prefix.
  Format: {scheme}:{value}

  Common ICD schemes:
    0208  - Belgian KBO (business number)
    9925  - Belgian VAT (use lowercase 'be' prefix)
    0106  - Dutch KvK
    0204  - German Handelsregister
    0009  - French SIRET

Examples:
  # Belgian KBO number
  smp-resolve 0208:0843766574

  # Belgian VAT number (lowercase 'be')
  smp-resolve 9925:be0843766574

  # Dutch company
  smp-resolve 0106:12345678

  # Verbose output with document types
  smp-resolve 0208:0843766574 -v

  # Fetch business card
  smp-resolve 0208:0843766574 -b

  # Fetch all information
  smp-resolve 0208:0843766574 --all

  # Quiet mode (just status)
  smp-resolve 0208:0843766574 -q
`);
}

// Run the CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
