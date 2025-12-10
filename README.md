# SMP Resolver NG

A high-performance PEPPOL SMP resolver library built from scratch, following the official SML and SMP specifications.

## Features

- ✅ Spec-compliant SML/SMP discovery via DNS NAPTR records
- ✅ High-performance HTTP client with connection pooling (undici)
- ✅ Minimal dependencies for maximum reliability
- ✅ Multiple API interfaces for different use cases
- ✅ Belgian participant support (0208 KBO and 9925 VAT schemes)
- ✅ CSV export for bulk processing workflows
- ✅ TypeScript with full type safety
- ✅ Service description extraction from SMP endpoints
- ✅ Official PEPPOL code list v9.2 for document type names
- ✅ Combined --all mode for comprehensive participant info
- ✅ Certificate parsing with SeatID extraction (v2.1.0)
- ✅ Fingerprint-based certificate caching for bulk processing efficiency

## Installation

This package is published to GitHub Packages. To install:

1. Configure npm to use GitHub Packages for the `@stevenn` scope:
   ```bash
   echo "@stevenn:registry=https://npm.pkg.github.com" >> ~/.npmrc
   ```

2. Install the package:
   ```bash
   npm install @stevenn/smp-resolver-ng
   ```

Alternatively, you can create a `.npmrc` file in your project root:
```
@stevenn:registry=https://npm.pkg.github.com
```

## Usage

### Basic Resolution

```typescript
import { SMPResolver } from '@stevenn/smp-resolver-ng';

const resolver = new SMPResolver();

// Resolve by participant ID (scheme:value format)
const result = await resolver.resolve('0208:0123456789');
console.log(result.isRegistered); // true/false
console.log(result.registrationStatus); // 'active', 'parked', or 'unregistered'
```

### Get Business Entity Information

```typescript
// For peppolcheck-style business card retrieval
const businessCard = await resolver.getBusinessCard('0208:0123456789');
console.log(businessCard.entity.name);         // Company name
console.log(businessCard.entity.countryCode);  // BE
console.log(businessCard.entity.identifiers);  // [{scheme: '0208', value: '0123456789'}]
console.log(businessCard.smpHostname);         // SMP server hostname
```

### Get Technical Endpoint URLs

```typescript
// For bulk processor-style endpoint extraction
const endpoints = await resolver.getEndpointUrls('0208:0123456789');
console.log(endpoints.smpHostname);                      // smp.example.com
console.log(endpoints.endpoint?.url);                    // https://as4.example.com/as4
console.log(endpoints.endpoint?.transportProfile);       // peppol-transport-as4-v2_0
console.log(endpoints.endpoint?.serviceDescription);     // Service description from SMP
console.log(endpoints.endpoint?.technicalContactUrl);    // Technical contact URL
console.log(endpoints.endpoint?.technicalInformationUrl); // Technical info URL
console.log(endpoints.endpoint?.certificate);            // Raw X.509 certificate (base64)
```

### Certificate Parsing & SeatID Extraction (v2.1.0)

```typescript
// Parse X.509 certificates and extract SeatID
const result = await resolver.resolve('0208:0123456789', {
  fetchDocumentTypes: true,
  parseCertificate: true  // Enable certificate parsing
});

if (result.certificateInfo) {
  console.log(result.certificateInfo.seatId);       // "POP000123" (Peppol SeatID)
  console.log(result.certificateInfo.subjectDN);    // Full subject DN
  console.log(result.certificateInfo.issuerDN);     // Certificate issuer
  console.log(result.certificateInfo.notBefore);    // Validity start
  console.log(result.certificateInfo.notAfter);     // Validity end
  console.log(result.certificateInfo.isExpired);    // Convenience flag
  console.log(result.certificateInfo.fingerprint);  // SHA-256 fingerprint
}

// Certificate parsing is cached by fingerprint for bulk processing efficiency
// Same AP certificate → same fingerprint → cache hit
const stats = resolver.getCertificateCacheStats();
console.log(`Cached ${stats.size} unique certificates`);

// Clear cache when done (also called by close())
await resolver.close();
```

#### Standalone Certificate Parser

```typescript
import { CertificateParser } from '@stevenn/smp-resolver-ng';

const parser = new CertificateParser();

// Parse a raw certificate
const certInfo = parser.parse(rawBase64Certificate);
console.log(certInfo.seatId);        // Peppol SeatID from CN
console.log(certInfo.fingerprint);   // SHA-256 fingerprint

// Get cache stats
const stats = parser.getCacheStats();

// Clear cache
parser.clearCache();
```

## CLI Tool

The package includes a CLI tool for quick lookups.

### Global Installation

First, ensure npm is configured for GitHub Packages (if not already done):
```bash
npm config set @stevenn:registry https://npm.pkg.github.com
```

Then install globally:
```bash
npm install -g @stevenn/smp-resolver-ng
```

### Usage

```bash
# Check single participant (scheme:value format required)
smp-resolve 0208:0843766574

# Verbose output with endpoint details and document types
smp-resolve 0208:0843766574 -v

# Get business card information
smp-resolve 0208:0843766574 -b

# Show certificate info (SeatID, validity, fingerprint)
smp-resolve 0208:0843766574 -c

# Get all information (verbose + business card + certificate)
smp-resolve 0208:0843766574 --all

# Quiet mode (just registration status)
smp-resolve 0208:0843766574 -q

# Belgian VAT number (use lowercase 'be' prefix)
smp-resolve 9925:be0843766574
```

## API Reference

### SMPResolver

Main resolver class with methods:

- `resolve(participantId, options)` - Core resolution method with full options
- `lookupSMP(participantId)` - DNS-only lookup (no HTTP calls)
- `getBusinessCard(participantId)` - Business entity information
- `getEndpointUrls(participantId)` - Technical endpoint URLs
- `getCertificateCacheStats()` - Get certificate cache statistics
- `close()` - Close connections and clear caches

#### ResolveOptions

```typescript
interface ResolveOptions {
  fetchDocumentTypes?: boolean;  // Include document type list
  includeBusinessCard?: boolean; // Fetch business card info
  parseCertificate?: boolean;    // Parse X.509 certificate (extracts SeatID)
  timeout?: number;              // Request timeout in ms
}
```

### CertificateParser

Standalone certificate parser (also used internally by SMPResolver):

- `parse(rawCertificate)` - Parse certificate and extract info
- `computeFingerprint(rawCertificate)` - Get SHA-256 fingerprint
- `getCacheStats()` - Get cache statistics
- `clearCache()` - Clear the certificate cache

### Utilities

- `hashParticipantId(id, scheme)` - SHA-256 + Base32 encoding for SML lookup
- `validateParticipantId(scheme, value)` - Validate participant ID format

```typescript
import { validateParticipantId } from '@stevenn/smp-resolver-ng';

if (validateParticipantId('0208', '0123456789')) {
  console.log('Valid participant ID');
}
```

## Performance

- Connection pooling for efficient HTTP requests
- Minimal XML parsing overhead
- Support for concurrent batch processing
- Zero unnecessary dependencies

## License

MIT