/**
 * Comprehensive benchmark for smp-resolver-ng
 *
 * Uses real-world participant IDs extracted from peppolcheck production data.
 * Measures timing at multiple levels to help calibrate timeouts.
 *
 * Usage:
 *   npx tsx tests/benchmark/run-benchmark.ts [options]
 *
 * Options:
 *   --sample N     Run on N random participants (default: 100)
 *   --full         Run on all participants (~10K)
 *   --no-bc        Skip business card fetch (faster)
 *   --concurrency N  Run N lookups in parallel (default: 1)
 *   --timeout N    Set HTTP timeout in ms (default: 7000)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SMPResolver } from '../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Types
interface TestParticipant {
  id: string;
  scheme: string;
  totalLookups: number;
  successRate: number;
  lastBusinessName: string | null;
  lastError: string | null;
}

interface TestDataset {
  metadata: {
    created: string;
    source: string;
    sampleRate: number;
    totalUniqueParticipants: number;
    sampledParticipants: number;
  };
  participants: TestParticipant[];
}

interface TimingResult {
  participantId: string;
  scheme: string;
  success: boolean;
  registrationStatus: string | null;
  smpHostname: string | null;
  businessCardFound: boolean;
  totalMs: number;
  error: string | null;
  expectedSuccessRate: number;
}

interface BenchmarkResults {
  config: {
    sampleSize: number;
    includeBusinessCard: boolean;
    concurrency: number;
    httpTimeout: number;
  };
  summary: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    avgTimeMs: number;
    medianTimeMs: number;
    p95TimeMs: number;
    p99TimeMs: number;
    maxTimeMs: number;
  };
  byStatus: Record<string, number>;
  bySmp: Record<string, { count: number; avgMs: number; successRate: number }>;
  byScheme: Record<string, { count: number; avgMs: number; successRate: number }>;
  slowest: Array<{ id: string; timeMs: number; smp: string | null; error: string | null }>;
  unexpectedFailures: Array<{ id: string; expectedRate: number; error: string | null }>;
}

// Parse command line arguments
function parseArgs(): {
  sampleSize: number;
  full: boolean;
  includeBusinessCard: boolean;
  concurrency: number;
  httpTimeout: number;
} {
  const args = process.argv.slice(2);
  const result = {
    sampleSize: 100,
    full: false,
    includeBusinessCard: true,
    concurrency: 1,
    httpTimeout: 7000,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--sample':
        result.sampleSize = parseInt(args[++i], 10);
        break;
      case '--full':
        result.full = true;
        break;
      case '--no-bc':
        result.includeBusinessCard = false;
        break;
      case '--concurrency':
        result.concurrency = parseInt(args[++i], 10);
        break;
      case '--timeout':
        result.httpTimeout = parseInt(args[++i], 10);
        break;
    }
  }

  return result;
}

// Load test participants
function loadParticipants(sampleSize: number, full: boolean): TestParticipant[] {
  const dataPath = resolve(__dirname, '../data/test-participants.json');
  const data: TestDataset = JSON.parse(readFileSync(dataPath, 'utf-8'));

  console.log(`Loaded ${data.participants.length} participants from test dataset`);
  console.log(`  Source: ${data.metadata.source}`);
  console.log(`  Created: ${data.metadata.created}`);
  console.log('');

  if (full) {
    return data.participants;
  }

  // Random sample, but ensure diversity
  const shuffled = [...data.participants].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, sampleSize);
}

// Calculate percentile
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// Run benchmark
async function runBenchmark(
  participants: TestParticipant[],
  config: ReturnType<typeof parseArgs>
): Promise<BenchmarkResults> {
  const resolver = new SMPResolver({
    smlDomain: 'edelivery.tech.ec.europa.eu',
    dnsServers: ['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4'],
    httpTimeout: config.httpTimeout,
  });

  const results: TimingResult[] = [];
  let completed = 0;

  // Progress tracking
  const startTime = Date.now();
  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = completed / elapsed;
    const eta = (participants.length - completed) / rate;
    process.stdout.write(
      `\r  Progress: ${completed}/${participants.length} (${rate.toFixed(1)}/s, ETA: ${eta.toFixed(0)}s)   `
    );
  }, 1000);

  // Process in batches for concurrency
  const batchSize = config.concurrency;
  for (let i = 0; i < participants.length; i += batchSize) {
    const batch = participants.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (participant): Promise<TimingResult> => {
        const lookupStart = Date.now();

        try {
          const info = await resolver.resolve(participant.id, {
            fetchDocumentTypes: true,
            includeBusinessCard: config.includeBusinessCard,
            parseCertificate: false, // Skip for benchmark speed
          });

          const totalMs = Date.now() - lookupStart;

          return {
            participantId: participant.id,
            scheme: participant.scheme,
            success: info.isRegistered,
            registrationStatus: info.registrationStatus || null,
            smpHostname: info.smpHostname || null,
            businessCardFound:
              !!info.businessEntity?.name && info.businessEntity.name !== 'Unknown',
            totalMs,
            error: info.error || null,
            expectedSuccessRate: participant.successRate,
          };
        } catch (err: any) {
          const totalMs = Date.now() - lookupStart;
          return {
            participantId: participant.id,
            scheme: participant.scheme,
            success: false,
            registrationStatus: null,
            smpHostname: null,
            businessCardFound: false,
            totalMs,
            error: err.message || String(err),
            expectedSuccessRate: participant.successRate,
          };
        }
      })
    );

    results.push(...batchResults);
    completed += batch.length;
  }

  clearInterval(progressInterval);
  console.log(`\r  Progress: ${completed}/${participants.length} - Done!                    `);

  await resolver.close();

  // Analyze results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const times = results.map(r => r.totalMs);

  // Group by SMP
  const bySmp: Record<string, { times: number[]; successes: number }> = {};
  for (const r of results) {
    const smp = r.smpHostname || 'unknown';
    if (!bySmp[smp]) bySmp[smp] = { times: [], successes: 0 };
    bySmp[smp].times.push(r.totalMs);
    if (r.success) bySmp[smp].successes++;
  }

  // Group by scheme
  const byScheme: Record<string, { times: number[]; successes: number }> = {};
  for (const r of results) {
    if (!byScheme[r.scheme]) byScheme[r.scheme] = { times: [], successes: 0 };
    byScheme[r.scheme].times.push(r.totalMs);
    if (r.success) byScheme[r.scheme].successes++;
  }

  // Group by status
  const byStatus: Record<string, number> = {};
  for (const r of results) {
    const status = r.registrationStatus || 'error';
    byStatus[status] = (byStatus[status] || 0) + 1;
  }

  // Find slowest lookups
  const sortedByTime = [...results].sort((a, b) => b.totalMs - a.totalMs);
  const slowest = sortedByTime.slice(0, 10).map(r => ({
    id: r.participantId,
    timeMs: r.totalMs,
    smp: r.smpHostname,
    error: r.error,
  }));

  // Find unexpected failures (high expected success rate but failed)
  const unexpectedFailures = results
    .filter(r => !r.success && r.expectedSuccessRate > 0.8)
    .sort((a, b) => b.expectedSuccessRate - a.expectedSuccessRate)
    .slice(0, 20)
    .map(r => ({
      id: r.participantId,
      expectedRate: r.expectedSuccessRate,
      error: r.error,
    }));

  return {
    config: {
      sampleSize: participants.length,
      includeBusinessCard: config.includeBusinessCard,
      concurrency: config.concurrency,
      httpTimeout: config.httpTimeout,
    },
    summary: {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: successful.length / results.length,
      avgTimeMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      medianTimeMs: percentile(times, 50),
      p95TimeMs: percentile(times, 95),
      p99TimeMs: percentile(times, 99),
      maxTimeMs: Math.max(...times),
    },
    byStatus,
    bySmp: Object.fromEntries(
      Object.entries(bySmp)
        .map(([smp, data]) => [
          smp,
          {
            count: data.times.length,
            avgMs: Math.round(data.times.reduce((a, b) => a + b, 0) / data.times.length),
            successRate: data.successes / data.times.length,
          },
        ])
        .sort((a, b) => b[1].count - a[1].count)
    ),
    byScheme: Object.fromEntries(
      Object.entries(byScheme).map(([scheme, data]) => [
        scheme,
        {
          count: data.times.length,
          avgMs: Math.round(data.times.reduce((a, b) => a + b, 0) / data.times.length),
          successRate: data.successes / data.times.length,
        },
      ])
    ),
    slowest,
    unexpectedFailures,
  };
}

// Print results
function printResults(results: BenchmarkResults) {
  console.log('\n' + '='.repeat(70));
  console.log('BENCHMARK RESULTS');
  console.log('='.repeat(70));

  console.log('\n## Configuration');
  console.log(`  Sample size:        ${results.config.sampleSize}`);
  console.log(`  Business card:      ${results.config.includeBusinessCard ? 'yes' : 'no'}`);
  console.log(`  Concurrency:        ${results.config.concurrency}`);
  console.log(`  HTTP timeout:       ${results.config.httpTimeout}ms`);

  console.log('\n## Summary');
  console.log(`  Total:              ${results.summary.total}`);
  console.log(`  Successful:         ${results.summary.successful} (${(results.summary.successRate * 100).toFixed(1)}%)`);
  console.log(`  Failed:             ${results.summary.failed}`);

  console.log('\n## Timing (for timeout calibration)');
  console.log(`  Average:            ${results.summary.avgTimeMs}ms`);
  console.log(`  Median (p50):       ${results.summary.medianTimeMs}ms`);
  console.log(`  p95:                ${results.summary.p95TimeMs}ms`);
  console.log(`  p99:                ${results.summary.p99TimeMs}ms`);
  console.log(`  Max:                ${results.summary.maxTimeMs}ms`);

  console.log('\n## By Registration Status');
  for (const [status, count] of Object.entries(results.byStatus)) {
    console.log(`  ${status.padEnd(15)} ${count}`);
  }

  console.log('\n## By SMP Hostname (top 15)');
  const smpEntries = Object.entries(results.bySmp).slice(0, 15);
  for (const [smp, data] of smpEntries) {
    console.log(
      `  ${smp.padEnd(35)} ${String(data.count).padStart(5)}  avg: ${String(data.avgMs).padStart(5)}ms  success: ${(data.successRate * 100).toFixed(0)}%`
    );
  }

  console.log('\n## By Scheme');
  for (const [scheme, data] of Object.entries(results.byScheme)) {
    console.log(
      `  ${scheme.padEnd(10)} ${String(data.count).padStart(6)}  avg: ${String(data.avgMs).padStart(5)}ms  success: ${(data.successRate * 100).toFixed(0)}%`
    );
  }

  console.log('\n## Slowest Lookups');
  for (const s of results.slowest) {
    console.log(`  ${s.id.padEnd(25)} ${String(s.timeMs).padStart(6)}ms  ${s.smp || s.error || ''}`);
  }

  if (results.unexpectedFailures.length > 0) {
    console.log('\n## Unexpected Failures (high expected success rate)');
    for (const f of results.unexpectedFailures.slice(0, 10)) {
      console.log(`  ${f.id.padEnd(25)} expected: ${(f.expectedRate * 100).toFixed(0)}%  ${f.error || ''}`);
    }
  }

  console.log('\n' + '='.repeat(70));

  // Timeout recommendations
  console.log('\n## TIMEOUT RECOMMENDATIONS');
  console.log(`  Based on p99 (${results.summary.p99TimeMs}ms), recommended timeouts:`);
  console.log(`    HTTP timeout:     ${Math.ceil(results.summary.p99TimeMs / 1000) * 1000 + 2000}ms (p99 + 2s buffer)`);
  console.log(`    Wrapper timeout:  ${Math.ceil(results.summary.p99TimeMs / 1000) * 1000 + 5000}ms (p99 + 5s buffer)`);
  console.log('');
}

// Main
async function main() {
  const config = parseArgs();

  console.log('SMP Resolver Benchmark');
  console.log('='.repeat(70));
  console.log('');

  const participants = loadParticipants(config.sampleSize, config.full);
  console.log(`Running benchmark on ${participants.length} participants...`);
  console.log(`  Config: BC=${config.includeBusinessCard}, concurrency=${config.concurrency}, timeout=${config.httpTimeout}ms`);
  console.log('');

  const results = await runBenchmark(participants, config);
  printResults(results);
}

main().catch(console.error);
