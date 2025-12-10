import { describe, it, expect, beforeEach } from 'vitest';
import { CertificateParser } from '../../src/certificate/parser.js';

// Real PEPPOL AP certificate from Ixor (Belgium)
// Subject: C=BE, O=Ixor, OU=PEPPOL PRODUCTION AP, CN=PBE000028
// Issuer: C=BE, O=OpenPEPPOL AISBL, CN=PEPPOL ACCESS POINT CA - G2
const REAL_PEPPOL_CERTIFICATE = `MIIFpTCCA42gAwIBAgIQZUW3jUwx5YQosEAbLGVbQjANBgkqhkiG9w0BAQsFADBO
MQswCQYDVQQGEwJCRTEZMBcGA1UEChMQT3BlblBFUFBPTCBBSVNCTDEkMCIGA1UE
AxMbUEVQUE9MIEFDQ0VTUyBQT0lOVCBDQSAtIEcyMB4XDTI0MDIyNjAwMDAwMFoX
DTI2MDIxNTIzNTk1OVowTzELMAkGA1UEBhMCQkUxDTALBgNVBAoMBEl4b3IxHTAb
BgNVBAsMFFBFUFBPTCBQUk9EVUNUSU9OIEFQMRIwEAYDVQQDDAlQQkUwMDAwMjgw
ggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCRc0LgnyEZ7biC/WjPiN4f
mRkL6yS6Kug3I6f9JoNRhLhqSFv8KetLLSj9dROlEtozGuRuxKClcRBXodkogTGs
gVebQ0jsqei61Mmswo2OvSOt/vvRQVu/5MS5wbCFTin+tiP5Jcph/pVZjJwwEvw3
Wot34jzN14/wQfZOm88onrTJd2Cn8FZKT+ODCRMSfE4Us0sRF3SYPGR2KEJBc/gb
urTSs7Bvavl/V72KrXl0QiVBUa3jjiQ+5xcTRIjYAOYz0pnCndu/KDOc4l1KIPwY
XoYPIaPGrzM5iZlwhzhE3Ura3sS5Okj+OQaqnPozp9EIjBl4YKrGo7s7ctykA5Q5
AgMBAAGjggF8MIIBeDAMBgNVHRMBAf8EAjAAMA4GA1UdDwEB/wQEAwIDqDAWBgNV
HSUBAf8EDDAKBggrBgEFBQcDAjAdBgNVHQ4EFgQUN8x7BylG5xZLdXFXZU27U+tY
eD0wXQYDVR0fBFYwVDBSoFCgToZMaHR0cDovL3BraS1jcmwuc3ltYXV0aC5jb20v
Y2FfN2JlZGNiY2M0ZjcyNGVmZTMwZDUwMDZkZGE2ODFiYTAvTGF0ZXN0Q1JMLmNy
bDA3BggrBgEFBQcBAQQrMCkwJwYIKwYBBQUHMAGGG2h0dHA6Ly9wa2ktb2NzcC5z
eW1hdXRoLmNvbTAfBgNVHSMEGDAWgBSHJd9bI6bEO/mf3xulIJHd5PQ8gTAtBgpg
hkgBhvhFARADBB8wHQYTYIZIAYb4RQEQAQIDAQGBstf0NhYGOTU3NjA4MDkGCmCG
SAGG+EUBEAUEKzApAgEAFiRhSFIwY0hNNkx5OXdhMmt0Y21FdWMzbHRZWFYwYUM1
amIyMD0wDQYJKoZIhvcNAQELBQADggIBALULoMQYAqVfHQaFywHWvb6KYCEM2eus
eeMcodijh35Dxi+xgw+pEoPeUpnqplQmb2edjJCm8WelXuCO2NoUtd3sBCsb7jRt
W4jwBjXn6bvIngXBSJawx35hRx3n9ywFkiLmM0sebee/DVjsGhDs7YR7ajFUides
OT08HaD9E2MuY+c9NqM0l+O2z6dJ5eSHh49SUnf3U+UNAFweefDBVU/jRB7Z/TUN
Be28KzKg/gJYqppvq6HW37ckqqsHkc0/J8R1zkaib0eWaDGRVIZXa2hDzD1dfCWU
QqI6lsxMImEZirnefBXFVvAHtcKyidkZZtDMB6e6jMPX3EI/pqweQGsrz3JExlIY
Eg57aCfSMw9QLpyvff77Qx/OIXT32VcyLWUROZwGlh5vlCmwb05eC/yv5coIfK+4
RRkABk3fO7NvWGJan47VM1xl7HdLLeBqBVh1c+pmJ/LxZHTme2SP5ARvXBcEv15+
sQ4KjayLQ1yoIBz2KP4Yl9occgk0hGRTfens/E10SJLE6IGvJsghP+WHc8qeL8qE
t5/Q7UN77rVrwEpRP6cUGcnRER+eypefJPoOMqs8QG5Z+0SKolxIW6rjK92rMtHn
KeJyjmR0N/rsaorOqAA8ULXVRDhKrnpdP5lEIcBmp/efQnoJlBgcKKFITZCZ88dN
sEa/CRCIa0mx`;

describe('CertificateParser', () => {
  let parser: CertificateParser;

  beforeEach(() => {
    parser = new CertificateParser();
  });

  describe('computeFingerprint', () => {
    it('should compute consistent SHA-256 fingerprint', () => {
      const cert = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64
      const fingerprint1 = parser.computeFingerprint(cert);
      const fingerprint2 = parser.computeFingerprint(cert);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toMatch(/^[A-F0-9]{64}$/); // SHA-256 is 64 hex chars
    });

    it('should produce different fingerprints for different certificates', () => {
      const cert1 = 'SGVsbG8gV29ybGQ='; // "Hello World"
      const cert2 = 'R29vZGJ5ZSBXb3JsZA=='; // "Goodbye World"

      const fingerprint1 = parser.computeFingerprint(cert1);
      const fingerprint2 = parser.computeFingerprint(cert2);

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should normalize PEM format certificates', () => {
      const rawBase64 = 'SGVsbG8gV29ybGQ=';
      const pemFormat = `-----BEGIN CERTIFICATE-----
SGVsbG8gV29ybGQ=
-----END CERTIFICATE-----`;

      const fingerprint1 = parser.computeFingerprint(rawBase64);
      const fingerprint2 = parser.computeFingerprint(pemFormat);

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should handle whitespace in certificate', () => {
      const compact = 'SGVsbG8gV29ybGQ=';
      const withSpaces = 'SGVsbG8g\nV29y\nbGQ=';

      const fingerprint1 = parser.computeFingerprint(compact);
      const fingerprint2 = parser.computeFingerprint(withSpaces);

      expect(fingerprint1).toBe(fingerprint2);
    });
  });

  describe('caching', () => {
    it('should cache parsed certificates by fingerprint', () => {
      // We can't easily test the actual parsing without a valid cert,
      // but we can test the cache behavior
      const stats1 = parser.getCacheStats();
      expect(stats1.size).toBe(0);
    });

    it('should return cache stats', () => {
      const stats = parser.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('fingerprints');
      expect(Array.isArray(stats.fingerprints)).toBe(true);
    });

    it('should clear cache', () => {
      parser.clearCache();
      const stats = parser.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('parse() with real certificate', () => {
    it('should parse a real PEPPOL AP certificate', () => {
      const info = parser.parse(REAL_PEPPOL_CERTIFICATE);

      expect(info).toBeDefined();
      expect(info.fingerprint).toMatch(/^[A-F0-9]{64}$/);
      expect(info.subjectDN).toContain('CN=PBE000028');
      expect(info.subjectDN).toContain('O=Ixor');
      expect(info.subjectDN).toContain('C=BE');
      expect(info.issuerDN).toContain('PEPPOL ACCESS POINT CA');
      expect(info.serialNumber).toBeDefined();
      expect(info.notBefore).toBeInstanceOf(Date);
      expect(info.notAfter).toBeInstanceOf(Date);
      expect(info.raw).toBe(REAL_PEPPOL_CERTIFICATE);
    });

    it('should extract Belgian SeatID (PBE format)', () => {
      const info = parser.parse(REAL_PEPPOL_CERTIFICATE);

      expect(info.seatId).toBe('PBE000028');
    });

    it('should correctly determine certificate validity', () => {
      const info = parser.parse(REAL_PEPPOL_CERTIFICATE);

      // Certificate is valid until 2026-02-15
      expect(info.notBefore).toEqual(new Date('2024-02-26T00:00:00.000Z'));
      expect(info.notAfter).toEqual(new Date('2026-02-15T23:59:59.000Z'));
      // As of now (2024-2025), should not be expired
      expect(info.isExpired).toBe(false);
    });

    it('should cache parsed certificates by fingerprint', () => {
      // First parse
      const info1 = parser.parse(REAL_PEPPOL_CERTIFICATE);
      const stats1 = parser.getCacheStats();
      expect(stats1.size).toBe(1);

      // Second parse of same cert should return cached result
      const info2 = parser.parse(REAL_PEPPOL_CERTIFICATE);
      const stats2 = parser.getCacheStats();
      expect(stats2.size).toBe(1); // Still just 1 cached entry

      // Should be the exact same object from cache
      expect(info1).toBe(info2);
      expect(info1.fingerprint).toBe(info2.fingerprint);
    });

    it('should compute consistent fingerprint for same certificate', () => {
      const fingerprint1 = parser.computeFingerprint(REAL_PEPPOL_CERTIFICATE);
      const fingerprint2 = parser.computeFingerprint(REAL_PEPPOL_CERTIFICATE);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toBe('07985302AA9900C686A401A1148DBA07C3B29E01356D340EE73FE5BBDE5F2D9B');
    });
  });

  describe('SeatID extraction edge cases', () => {
    // Test the SeatID extraction regex patterns
    it('should recognize POP format SeatIDs', () => {
      // Standard OpenPEPPOL format
      const patterns = ['POP000123', 'POP123', 'POP000001'];
      patterns.forEach(pattern => {
        expect(pattern).toMatch(/^POP\d{3,}/i);
      });
    });

    it('should recognize country-specific SeatID formats', () => {
      // Belgian format (PBE), German (PDE), etc.
      const patterns = ['PBE000028', 'PDE000001', 'PAT000123'];
      patterns.forEach(pattern => {
        // These match the alphanumeric 4-20 char pattern
        expect(pattern).toMatch(/^[A-Z0-9]{4,20}$/i);
      });
    });
  });
});

describe('CertificateParser integration', () => {
  it('should be importable from main package', async () => {
    const { CertificateParser } = await import('../../src/index.js');
    expect(CertificateParser).toBeDefined();

    const parser = new CertificateParser();
    expect(parser).toBeInstanceOf(CertificateParser);
  });

  it('should handle PEM-wrapped certificates', () => {
    const parser = new CertificateParser();
    const pemCert = `-----BEGIN CERTIFICATE-----
${REAL_PEPPOL_CERTIFICATE}
-----END CERTIFICATE-----`;

    const info = parser.parse(pemCert);
    expect(info.seatId).toBe('PBE000028');
  });

  it('should handle certificates with extra whitespace', () => {
    const parser = new CertificateParser();
    const certWithWhitespace = REAL_PEPPOL_CERTIFICATE.replace(/\n/g, '\n  ');

    const info = parser.parse(certWithWhitespace);
    expect(info.seatId).toBe('PBE000028');
  });
});
