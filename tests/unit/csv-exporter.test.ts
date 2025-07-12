import { describe, it, expect } from 'vitest';
import { CSVExporter } from '../../src/csv/exporter.js';
import type { BatchResult } from '../../src/types/index.js';

describe('CSVExporter', () => {
  describe('formatBulkResults', () => {
    it('should format successful results correctly', () => {
      const results: BatchResult[] = [
        {
          participantId: '0208:0843766574',
          success: true,
          smpHostname: 'smp.example.com',
          as4EndpointUrl: 'https://as4.example.com/as4',
          technicalContactUrl: 'https://example.com/contact',
          technicalInfoUrl: 'https://example.com/info',
          processedAt: new Date('2025-01-01T10:00:00Z')
        }
      ];

      const csv = CSVExporter.formatBulkResults(results);
      const lines = csv.trim().split('\n');

      expect(lines).toHaveLength(2); // Header + 1 data row
      expect(lines[0]).toBe(
        'company_id,company_name,success,smp_hostname,as4_endpoint_url,technical_contact_url,technical_info_url,error_message,processed_at'
      );
      expect(lines[1]).toContain('0843766574'); // company_id without scheme
      expect(lines[1]).toContain('true');
      expect(lines[1]).toContain('smp.example.com');
      expect(lines[1]).toContain('https://as4.example.com/as4');
    });

    it('should format failed results correctly', () => {
      const results: BatchResult[] = [
        {
          participantId: '0208:9999999999',
          success: false,
          errorMessage: 'No SMP found via DNS lookup',
          processedAt: new Date('2025-01-01T10:00:00Z')
        }
      ];

      const csv = CSVExporter.formatBulkResults(results);
      const lines = csv.trim().split('\n');

      expect(lines[1]).toContain('9999999999'); // company_id without scheme
      expect(lines[1]).toContain('false');
      expect(lines[1]).toContain('No SMP found via DNS lookup');
      expect(lines[1].match(/,"",/g)?.length).toBeGreaterThan(2); // Multiple empty quoted fields
    });

    it('should handle empty results', () => {
      const csv = CSVExporter.formatBulkResults([]);
      const lines = csv.trim().split('\n');

      expect(lines).toHaveLength(1); // Only header
      expect(lines[0]).toContain('company_id');
    });

    it('should escape special characters', () => {
      const results: BatchResult[] = [
        {
          participantId: '0208:0843766574',
          success: false,
          errorMessage: 'Error with "quotes" and, commas',
          processedAt: new Date('2025-01-01T10:00:00Z')
        }
      ];

      const csv = CSVExporter.formatBulkResults(results);
      const lines = csv.trim().split('\n');

      expect(lines[1]).toContain('"Error with ""quotes"" and, commas"');
    });
  });

  describe('createSummaryReport', () => {
    it('should create accurate summary report', () => {
      const results: BatchResult[] = [
        {
          participantId: '0208:0843766574',
          success: true,
          smpHostname: 'smp1.example.com',
          processedAt: new Date()
        },
        {
          participantId: '0208:0755752833',
          success: true,
          smpHostname: 'smp2.example.com',
          processedAt: new Date()
        },
        {
          participantId: '0208:9999999999',
          success: false,
          errorMessage: 'Not found',
          processedAt: new Date()
        }
      ];

      const report = CSVExporter.createSummaryReport(results);

      expect(report).toContain('Total participants: 3');
      expect(report).toContain('Successful: 2 (66.7%)');
      expect(report).toContain('Failed: 1 (33.3%)');
      expect(report).toContain('smp1.example.com: 1');
      expect(report).toContain('smp2.example.com: 1');
    });

    it('should handle all failures gracefully', () => {
      const results: BatchResult[] = [
        {
          participantId: '0208:9999999999',
          success: false,
          errorMessage: 'Not found',
          processedAt: new Date()
        }
      ];

      const report = CSVExporter.createSummaryReport(results);

      expect(report).toContain('Successful: 0 (0.0%)');
      expect(report).not.toContain('SMP Hosts:');
    });

    it('should group by SMP hostname correctly', () => {
      const results: BatchResult[] = [
        {
          participantId: '1',
          success: true,
          smpHostname: 'smp.example.com',
          processedAt: new Date()
        },
        {
          participantId: '2',
          success: true,
          smpHostname: 'smp.example.com',
          processedAt: new Date()
        },
        {
          participantId: '3',
          success: true,
          smpHostname: 'smp.example.com',
          processedAt: new Date()
        }
      ];

      const report = CSVExporter.createSummaryReport(results);

      expect(report).toContain('smp.example.com: 3');
    });
  });
});
