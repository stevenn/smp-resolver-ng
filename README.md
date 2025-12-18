# SMP Resolver NG

A high-performance, general-purpose PEPPOL SMP resolver library built from scratch, following the official SML and SMP specifications.

## Features

- ✅ Spec-compliant SML/SMP discovery via DNS NAPTR records
- ✅ High-performance HTTP client with connection pooling (undici)
- ✅ Minimal dependencies for maximum reliability
- ✅ TypeScript with full type safety
- ✅ Service metadata and endpoint extraction from SMP
- ✅ Business card retrieval
- ✅ Official PEPPOL code list v9.2 for document type names
- ✅ Certificate parsing with SeatID extraction
- ✅ Fingerprint-based certificate caching for bulk processing efficiency
- ✅ DNS-only lookup mode for lightweight checks
- ✅ CLI tool for quick lookups

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
console.log(result.isRegistered);        // true/false
console.log(result.registrationStatus);  // 'active', 'parked', or 'unregistered'

// Don't forget to close when done
await resolver.close();
```

### DNS-Only Lookup (Lightweight)

```typescript
// Check if participant is registered without fetching full metadata
const lookup = await resolver.lookupSMP('0208:0123456789');
console.log(lookup.smpUrl);       // SMP URL or null if not registered
console.log(lookup.smpHostname);  // SMP hostname
console.log(lookup.hash);         // Participant hash used for DNS lookup
```

### Verbose Resolution with Document Types

```typescript
const result = await resolver.resolve('0208:0123456789', {
  fetchDocumentTypes: true
});
console.log(result.smpHostname);     // SMP server hostname
console.log(result.documentTypes);   // ['Peppol BIS Billing 3.0', ...]
console.log(result.endpoint?.url);   // AS4 endpoint URL
```

### Get Business Card Information

```typescript
const businessCard = await resolver.getBusinessCard('0208:0123456789');
console.log(businessCard.entity.name);         // Company name
console.log(businessCard.entity.countryCode);  // Country code
console.log(businessCard.entity.identifiers);  // [{scheme: '0208', value: '0123456789'}]
console.log(businessCard.smpHostname);         // SMP server hostname
```

### Get Endpoint URLs

```typescript
const endpoints = await resolver.getEndpointUrls('0208:0123456789');
console.log(endpoints.smpHostname);                       // smp.example.com
console.log(endpoints.endpoint?.url);                     // https://as4.example.com/as4
console.log(endpoints.endpoint?.transportProfile);        // peppol-transport-as4-v2_0
console.log(endpoints.endpoint?.serviceDescription);      // Service description
console.log(endpoints.endpoint?.technicalContactUrl);     // Technical contact URL
console.log(endpoints.endpoint?.technicalInformationUrl); // Technical info URL
console.log(endpoints.endpoint?.certificate);             // Raw X.509 certificate (base64)
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
```

### Common ICD Schemes

| Scheme | Description | Example |
|--------|-------------|---------|
| 0208 | Belgian KBO | `0208:0843766574` |
| 9925 | VAT number | `9925:be0843766574` |
| 0106 | Dutch KvK | `0106:12345678` |
| 0204 | German Handelsregister | `0204:HRB12345` |
| 0009 | French SIRET | `0009:12345678901234` |

## API Reference

### SMPResolver

Main resolver class with methods:

| Method | Description |
|--------|-------------|
| `resolve(participantId, options?)` | Core resolution with full options |
| `lookupSMP(participantId)` | DNS-only lookup (no HTTP calls) |
| `getBusinessCard(participantId)` | Business entity information |
| `getEndpointUrls(participantId)` | Technical endpoint URLs |
| `getCertificateCacheStats()` | Get certificate cache statistics |
| `close()` | Close connections and clear caches |

#### SMPResolverConfig

```typescript
interface SMPResolverConfig {
  smlDomain?: string;      // Default: 'edelivery.tech.ec.europa.eu'
  dnsServers?: string[];   // Custom DNS servers (optional)
  httpTimeout?: number;    // HTTP timeout in ms (default: 30000)
  cacheTTL?: number;       // Cache TTL in seconds (default: 3600)
  userAgent?: string;      // Custom User-Agent header
}
```

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

| Method | Description |
|--------|-------------|
| `parse(rawCertificate)` | Parse certificate and extract info |
| `computeFingerprint(rawCertificate)` | Get SHA-256 fingerprint |
| `getCacheStats()` | Get cache statistics |
| `clearCache()` | Clear the certificate cache |

### NAPTRResolver

Low-level DNS resolver for direct SML queries:

```typescript
import { NAPTRResolver } from '@stevenn/smp-resolver-ng';

const resolver = new NAPTRResolver({ timeout: 5000 });
const records = await resolver.resolveNAPTR('hash.iso6523-actorid-upis.edelivery.tech.ec.europa.eu');
const smpUrl = resolver.extractSMPUrl(records);
```

### Utility Functions

```typescript
import {
  hashParticipantId,
  parseParticipantId,
  validateParticipantId
} from '@stevenn/smp-resolver-ng';

// Hash participant ID for SML lookup
const hash = hashParticipantId('0123456789', '0208');

// Parse "scheme:value" format
const parsed = parseParticipantId('0208:0123456789');
// { scheme: '0208', value: '0123456789' }

// Validate participant ID format
if (validateParticipantId('0208', '0123456789')) {
  console.log('Valid');
}
```

## Performance

- Connection pooling for efficient HTTP requests
- Minimal XML parsing overhead
- Support for concurrent batch processing
- Zero unnecessary dependencies

## License

MIT