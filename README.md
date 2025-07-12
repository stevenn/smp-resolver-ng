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

// Resolve by participant ID
const result = await resolver.resolve('0208:0123456789');
console.log(result.isRegistered); // true/false

// Automatic Belgian scheme detection
const info = await resolver.resolveParticipant('0123456789');
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
```

### Batch Processing

```typescript
import { CSVExporter } from '@stevenn/smp-resolver-ng';

const participantIds = ['0208:0123456789', '0208:9876543210'];
const results = await resolver.resolveBatch(participantIds, {
  concurrency: 20,
  onProgress: (done, total) => console.log(`${done}/${total}`)
});

// Export to CSV
const csv = CSVExporter.formatBulkResults(results);
fs.writeFileSync('results.csv', csv);
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
# Check single participant
smp-resolve 0843766574

# Verbose output with endpoint details
smp-resolve 0843766574 -v

# Get business card information
smp-resolve 0843766574 -b

# Get all information (verbose + business card combined)
smp-resolve 0843766574 --all

# Batch process with CSV output
smp-resolve 0843766574 0755752833 --batch --csv > results.csv

# Use explicit scheme
smp-resolve 0208:0843766574
smp-resolve 9925:BE0843766574
```

## API Reference

### SMPResolver

Main resolver class with methods:

- `resolve(participantId, options)` - Core resolution method
- `resolveParticipant(identifier)` - Auto-detect Belgian schemes
- `getBusinessCard(participantId)` - Business entity information
- `getEndpointUrls(participantId)` - Technical endpoint URLs
- `resolveBatch(participantIds, options)` - Bulk processing

### Utilities

- `hashParticipantId(id, scheme)` - SHA-256 + Base32 encoding for SML lookup
- `validateParticipantId(scheme, value)` - Validate participant ID format
- `normalizeBelgianIdentifier(id)` - KBO/VAT normalization
- `CSVExporter.formatBulkResults(results)` - CSV generation

Example validation:
```typescript
import { validateParticipantId } from '@stevenn/smp-resolver-ng';

// Validate participant ID components
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