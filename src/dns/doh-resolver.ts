import type { DNSRecord } from '../types/index.js';
import type { IDNSResolver } from './dns-resolver.interface.js';

export interface DoHResolverOptions {
  timeout?: number;
  cache?: boolean;
  cacheTTL?: number;
}

/**
 * DNS-over-HTTPS resolver using direct Cloudflare DoH API
 * Uses Cloudflare's DoH service for NAPTR queries
 */
export class DoHResolver implements IDNSResolver {
  private timeout: number;
  private dohUrl: string;
  private cache: Map<string, { records: DNSRecord[]; expires: number }>;
  private cacheTTL: number;

  constructor(options: DoHResolverOptions = {}) {
    this.timeout = options.timeout ?? 10000; // Increased to 10 seconds
    this.dohUrl = 'https://cloudflare-dns.com/dns-query';
    this.cache = new Map();
    this.cacheTTL = options.cacheTTL ?? 300000; // 5 minutes default
  }

  /**
   * Performs NAPTR lookup for a domain using DoH
   * @param domain The domain to lookup (e.g., hash.iso6523-actorid-upis.sml-domain)
   * @returns NAPTR records
   */
  async resolveNAPTR(domain: string): Promise<DNSRecord[]> {
    // Check cache first
    const cached = this.cache.get(domain);
    if (cached && cached.expires > Date.now()) {
      return cached.records;
    }

    try {
      // Use GET method with query parameters for Cloudflare DoH
      const url = new URL(this.dohUrl);
      url.searchParams.append('name', domain);
      url.searchParams.append('type', '35'); // NAPTR type code

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/dns-json'
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();

      // Parse NAPTR records from DoH response
      const records = this.parseNAPTRRecords(data, domain);

      // Cache the result
      if (records.length > 0 || data.Status === 3) {
        this.cache.set(domain, {
          records,
          expires: Date.now() + this.cacheTTL
        });
      }

      return records;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      // Return empty array for NXDOMAIN (not found)
      if (message.includes('NXDOMAIN') || message.includes('ENOTFOUND')) {
        return [];
      }
      throw new Error(`DoH NAPTR lookup failed for ${domain}: ${message}`);
    }
  }

  /**
   * Parse NAPTR records from DoH JSON response
   */
  private parseNAPTRRecords(response: any, domain: string): DNSRecord[] {
    if (!response.Answer || !Array.isArray(response.Answer)) {
      return [];
    }

    return response.Answer
      .filter((record: any) => record.type === 35) // NAPTR type
      .map((record: any) => {
        const data = record.data;

        // Check if data is in hex format (starts with \#)
        if (data.startsWith('\\#')) {
          return this.parseHexNAPTR(data, domain, record.TTL);
        }

        // Otherwise parse as text format
        // Format: "order preference \"flags\" \"service\" \"regexp\" replacement"
        const match = data.match(/^(\d+)\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"\s+"([^"]*)"\s+(.*)$/);

        if (!match) {
          // Fallback to simple split if regex doesn't match
          const parts = data.split(' ');
          return {
            name: domain,
            type: 'NAPTR',
            class: 'IN',
            ttl: record.TTL || 300,
            order: parseInt(parts[0], 10) || 0,
            preference: parseInt(parts[1], 10) || 0,
            flags: parts[2]?.replace(/"/g, '') || '',
            service: parts[3]?.replace(/"/g, '') || '',
            regexp: parts[4]?.replace(/"/g, '') || '',
            replacement: parts[5]?.replace(/"/g, '') || ''
          };
        }

        return {
          name: domain,
          type: 'NAPTR',
          class: 'IN',
          ttl: record.TTL || 300,
          order: parseInt(match[1], 10),
          preference: parseInt(match[2], 10),
          flags: match[3],
          service: match[4],
          regexp: match[5],
          replacement: match[6] || ''
        };
      });
  }

  /**
   * Parse NAPTR record from hex format
   */
  private parseHexNAPTR(hexData: string, domain: string, ttl: number): DNSRecord {
    // Format: \# length hex_data
    // Example: \# 44 00 64 00 0a 01 55 08 4d 65 74 61 3a 53 4d 50...
    const hexMatch = hexData.match(/\\#\s+\d+\s+(.+)/);
    if (!hexMatch) {
      throw new Error('Invalid hex NAPTR format');
    }

    // Convert hex string to bytes
    const hexBytes = hexMatch[1].split(' ').map(h => parseInt(h, 16));

    // NAPTR structure:
    // 2 bytes: order
    // 2 bytes: preference
    // 1 byte: flags length
    // N bytes: flags
    // 1 byte: service length
    // N bytes: service
    // 1 byte: regexp length
    // N bytes: regexp
    // remaining: replacement (domain name)

    let offset = 0;

    // Read order (2 bytes, big-endian)
    const order = (hexBytes[offset] << 8) | hexBytes[offset + 1];
    offset += 2;

    // Read preference (2 bytes, big-endian)
    const preference = (hexBytes[offset] << 8) | hexBytes[offset + 1];
    offset += 2;

    // Read flags
    const flagsLen = hexBytes[offset++];
    const flags = String.fromCharCode(...hexBytes.slice(offset, offset + flagsLen));
    offset += flagsLen;

    // Read service
    const serviceLen = hexBytes[offset++];
    const service = String.fromCharCode(...hexBytes.slice(offset, offset + serviceLen));
    offset += serviceLen;

    // Read regexp
    const regexpLen = hexBytes[offset++];
    const regexp = String.fromCharCode(...hexBytes.slice(offset, offset + regexpLen));
    offset += regexpLen;

    // Remaining bytes are the replacement (usually empty for PEPPOL)
    const replacement = hexBytes.slice(offset).length > 0 ?
      String.fromCharCode(...hexBytes.slice(offset)) : '';

    return {
      name: domain,
      type: 'NAPTR',
      class: 'IN',
      ttl: ttl || 300,
      order,
      preference,
      flags,
      service,
      regexp,
      replacement
    };
  }

  /**
   * Extracts SMP URL from NAPTR records according to PEPPOL spec
   * @param records NAPTR records
   * @returns SMP base URL or null if not found
   */
  extractSMPUrl(records: DNSRecord[]): string | null {
    // Filter for Meta:SMP service (case-insensitive)
    const smpRecords = records.filter(record =>
      record.service?.toLowerCase() === 'meta:smp'
    );

    if (smpRecords.length === 0) {
      return null;
    }

    // Sort by order and preference (lower is better)
    smpRecords.sort((a, b) => {
      if (a.order !== b.order) {
        return (a.order ?? 0) - (b.order ?? 0);
      }
      return (a.preference ?? 0) - (b.preference ?? 0);
    });

    // Extract URL from regexp field
    const regexp = smpRecords[0].regexp;
    if (!regexp) {
      return null;
    }

    // NAPTR regexp format: !^.*$!https://smp.example.com!
    const match = regexp.match(/!(.*)!(.*)!/);
    if (!match || match.length < 3) {
      return null;
    }

    const url = match[2];

    // Validate URL according to spec
    if (!this.isValidSMPUrl(url)) {
      return null;
    }

    return url;
  }

  /**
   * Validates SMP URL according to PEPPOL spec requirements
   */
  private isValidSMPUrl(url: string): boolean {
    try {
      const parsed = new URL(url);

      // Must be HTTP or HTTPS
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return false;
      }

      // No username/password allowed
      if (parsed.username || parsed.password) {
        return false;
      }

      // No query or fragment
      if (parsed.search || parsed.hash) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Performs complete SML lookup for a participant
   * @param participantHash Base32 encoded hash of participant ID
   * @param scheme Participant scheme (e.g., "0208", "9925")
   * @param smlDomain SML domain (default: edelivery.tech.ec.europa.eu)
   * @returns SMP base URL or null if not found
   */
  async lookupSMP(
    participantHash: string,
    scheme: string,
    smlDomain: string = 'edelivery.tech.ec.europa.eu'
  ): Promise<string | null> {
    // NAPTR format: {hash}.iso6523-actorid-upis.{sml-domain}
    const domain = `${participantHash}.iso6523-actorid-upis.${smlDomain}`;
    const records = await this.resolveNAPTR(domain);
    return this.extractSMPUrl(records);
  }
}