import type { BatchResult } from '../types/index.js';

/**
 * CSV exporter for bulk processing results
 * Compatible with peppol-bulk-processor format
 */
export class CSVExporter {
  /**
   * Formats batch results as CSV
   */
  static formatBulkResults(results: BatchResult[]): string {
    const headers = [
      'company_id',
      'company_name',
      'success',
      'smp_hostname',
      'as4_endpoint_url',
      'technical_contact_url',
      'technical_info_url',
      'error_message',
      'processed_at'
    ];

    const rows = [headers.join(',')];

    for (const result of results) {
      rows.push(this.createCSVRow(result).join(','));
    }

    return rows.join('\n');
  }

  /**
   * Creates a CSV row from a batch result
   */
  static createCSVRow(result: BatchResult): string[] {
    // Remove scheme prefix from participant ID for company_id field
    const companyId = result.participantId.split(':')[1] || result.participantId;

    return [
      this.escapeCSV(companyId),
      this.escapeCSV(''), // company_name - not available in basic resolver
      this.escapeCSV(result.success ? 'true' : 'false'),
      this.escapeCSV(result.smpHostname || ''),
      this.escapeCSV(result.as4EndpointUrl || ''),
      this.escapeCSV(result.technicalContactUrl || ''),
      this.escapeCSV(result.technicalInfoUrl || ''),
      this.escapeCSV(result.errorMessage || ''),
      this.escapeCSV(result.processedAt.toISOString())
    ];
  }

  /**
   * Escapes a CSV field according to RFC 4180
   * Always quotes fields for consistency
   */
  private static escapeCSV(field: string): string {
    // Convert to string if not already
    const str = String(field);

    // Escape quotes by doubling them
    const escaped = str.replace(/"/g, '""');

    // Always quote fields (as per peppol-processor-core behavior)
    return `"${escaped}"`;
  }

  /**
   * Creates a summary report from batch results
   */
  static createSummaryReport(results: BatchResult[]): string {
    const total = results.length;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    const errorCounts = new Map<string, number>();
    results
      .filter(r => !r.success && r.errorMessage)
      .forEach(r => {
        const count = errorCounts.get(r.errorMessage!) || 0;
        errorCounts.set(r.errorMessage!, count + 1);
      });

    let report = `Processing Summary\n`;
    report += `==================\n`;
    report += `Total participants: ${total}\n`;
    report += `Successful: ${successful} (${((successful / total) * 100).toFixed(1)}%)\n`;
    report += `Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)\n`;

    // Add SMP host distribution
    const smpCounts = new Map<string, number>();
    results
      .filter(r => r.success && r.smpHostname)
      .forEach(r => {
        const count = smpCounts.get(r.smpHostname!) || 0;
        smpCounts.set(r.smpHostname!, count + 1);
      });

    if (smpCounts.size > 0) {
      report += `\nSMP Hosts:\n`;
      const sortedSMPs = Array.from(smpCounts.entries()).sort((a, b) => b[1] - a[1]);

      for (const [smp, count] of sortedSMPs) {
        report += `  ${smp}: ${count}\n`;
      }
    }

    if (errorCounts.size > 0) {
      report += `\nError Distribution:\n`;
      const sortedErrors = Array.from(errorCounts.entries()).sort((a, b) => b[1] - a[1]);

      for (const [error, count] of sortedErrors) {
        report += `  ${error}: ${count}\n`;
      }
    }

    return report;
  }
}
