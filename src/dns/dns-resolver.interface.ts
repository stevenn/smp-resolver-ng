import type { DNSRecord } from '../types/index.js';

/**
 * Common interface for DNS resolvers (standard DNS and DoH)
 */
export interface IDNSResolver {
  /**
   * Performs NAPTR lookup for a domain
   * @param domain The domain to lookup (e.g., hash.iso6523-actorid-upis.sml-domain)
   * @returns NAPTR records
   */
  resolveNAPTR(domain: string): Promise<DNSRecord[]>;

  /**
   * Extracts SMP URL from NAPTR records according to PEPPOL spec
   * @param records NAPTR records
   * @returns SMP base URL or null if not found
   */
  extractSMPUrl(records: DNSRecord[]): string | null;

  /**
   * Performs complete SML lookup for a participant
   * @param participantHash Base32 encoded hash of participant ID
   * @param scheme Participant scheme (e.g., "0208", "9925")
   * @param smlDomain SML domain (default: edelivery.tech.ec.europa.eu)
   * @returns SMP base URL or null if not found
   */
  lookupSMP(
    participantHash: string,
    scheme: string,
    smlDomain?: string
  ): Promise<string | null>;
}