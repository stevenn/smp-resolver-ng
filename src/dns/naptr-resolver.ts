import { Resolver } from 'node:dns/promises';
import type { DNSRecord } from '../types/index.js';

export interface NAPTRResolverOptions {
  dnsServers?: string[];
  timeout?: number;
}

export class NAPTRResolver {
  private resolver: Resolver;
  private timeout: number;

  constructor(options: NAPTRResolverOptions = {}) {
    this.resolver = new Resolver();
    this.timeout = options.timeout ?? 5000;

    if (options.dnsServers && options.dnsServers.length > 0) {
      this.resolver.setServers(options.dnsServers);
    }
  }

  /**
   * Performs NAPTR lookup for a domain
   * @param domain The domain to lookup (e.g., hash.scheme.sml-domain)
   * @returns NAPTR records
   */
  async resolveNAPTR(domain: string): Promise<DNSRecord[]> {
    try {
      const records = await this.withTimeout(this.resolver.resolveNaptr(domain), this.timeout);

      return records.map(record => ({
        name: domain,
        type: 'NAPTR',
        class: 'IN',
        ttl: 300, // Default TTL, actual value depends on DNS response
        order: record.order,
        preference: record.preference,
        flags: record.flags,
        service: record.service,
        regexp: record.regexp,
        replacement: record.replacement
      }));
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const errorCode = (error as { code: string }).code;
        if (errorCode === 'ENOTFOUND' || errorCode === 'ENODATA') {
          return [];
        }
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`DNS NAPTR lookup failed for ${domain}: ${message}`);
    }
  }

  /**
   * Extracts SMP URL from NAPTR records according to PEPPOL spec
   * @param records NAPTR records
   * @returns SMP base URL or null if not found
   */
  extractSMPUrl(records: DNSRecord[]): string | null {
    // Filter for Meta:SMP service (case-insensitive)
    const smpRecords = records.filter(record => record.service?.toLowerCase() === 'meta:smp');

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

    let url = match[2];

    // Validate URL according to spec
    if (!this.isValidSMPUrl(url)) {
      return null;
    }

    // Remove trailing slash to avoid double slashes when constructing full URLs
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
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

  /**
   * Wraps a promise with a timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('DNS lookup timeout')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }
}
