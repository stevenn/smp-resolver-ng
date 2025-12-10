import * as x509 from '@peculiar/x509';
import { createHash } from 'crypto';
import type { CertificateInfo } from '../types/index.js';

/**
 * Parses X.509 certificates and extracts relevant information including Peppol SeatID.
 * Implements fingerprint-based caching for efficient bulk processing.
 */
export class CertificateParser {
  // Cache parsed certificates by SHA-256 fingerprint
  private cache: Map<string, CertificateInfo> = new Map();

  /**
   * Parse an X.509 certificate and extract relevant information.
   * Results are cached by certificate fingerprint for efficiency.
   *
   * @param rawCertificate - Base64-encoded certificate (DER format from SMP)
   * @returns Parsed certificate information including SeatID if present
   */
  parse(rawCertificate: string): CertificateInfo {
    // Compute fingerprint for cache lookup
    const fingerprint = this.computeFingerprint(rawCertificate);

    // Return cached result if available
    const cached = this.cache.get(fingerprint);
    if (cached) {
      return cached;
    }

    // Parse the certificate
    const info = this.parseX509(rawCertificate, fingerprint);

    // Cache and return
    this.cache.set(fingerprint, info);
    return info;
  }

  /**
   * Compute SHA-256 fingerprint of the raw certificate.
   * This is the standard way to identify certificates.
   */
  computeFingerprint(rawCertificate: string): string {
    // Normalize: remove PEM headers/footers and whitespace if present
    const normalized = rawCertificate
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');

    // Decode base64 to binary and compute SHA-256
    const der = Buffer.from(normalized, 'base64');
    return createHash('sha256').update(der).digest('hex').toUpperCase();
  }

  /**
   * Parse X.509 certificate using @peculiar/x509 library.
   */
  private parseX509(rawCertificate: string, fingerprint: string): CertificateInfo {
    // Normalize the certificate (remove PEM headers if present)
    const normalized = rawCertificate
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');

    // Decode and parse
    const der = Buffer.from(normalized, 'base64');
    const cert = new x509.X509Certificate(der);

    // Extract subject and issuer DNs
    const subjectDN = cert.subject;
    const issuerDN = cert.issuer;

    // Extract SeatID from Common Name (CN) in subject
    // Peppol SeatIDs typically appear as CN=POP000XXX or similar
    const seatId = this.extractSeatId(subjectDN);

    // Check expiration
    const now = new Date();
    const isExpired = now > cert.notAfter;

    return {
      fingerprint,
      subjectDN,
      issuerDN,
      serialNumber: cert.serialNumber,
      notBefore: cert.notBefore,
      notAfter: cert.notAfter,
      seatId,
      isExpired,
      raw: rawCertificate,
    };
  }

  /**
   * Extract Peppol SeatID from certificate subject DN.
   * SeatID is typically in the CN field, e.g., "CN=POP000123, O=..."
   *
   * @param subjectDN - The certificate subject distinguished name
   * @returns SeatID if found, undefined otherwise
   */
  private extractSeatId(subjectDN: string): string | undefined {
    // Parse CN from subject DN
    // Format: "CN=value, O=org, C=country" or similar
    const cnMatch = subjectDN.match(/CN=([^,]+)/i);
    if (!cnMatch) {
      return undefined;
    }

    const cn = cnMatch[1].trim();

    // Peppol SeatIDs follow patterns like:
    // - POP000XXX (OpenPeppol)
    // - POPXXX (older format)
    // - Authority-specific formats
    if (/^POP\d{3,}/i.test(cn)) {
      return cn.toUpperCase();
    }

    // Return CN as potential SeatID if it looks like an identifier
    // (alphanumeric, reasonable length)
    if (/^[A-Z0-9]{4,20}$/i.test(cn)) {
      return cn.toUpperCase();
    }

    return undefined;
  }

  /**
   * Get cache statistics for monitoring.
   */
  getCacheStats(): { size: number; fingerprints: string[] } {
    return {
      size: this.cache.size,
      fingerprints: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clear the certificate cache.
   * Call this when done with bulk processing to free memory.
   */
  clearCache(): void {
    this.cache.clear();
  }
}
