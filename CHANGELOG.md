# Changelog

All notable changes to this project will be documented in this file.

## [2.2.5] - 2026-01-06

### Fixed
- **Business card logic cleanup:** Restored all 5 URL patterns and fixed HTTP fallback
- HTTPS patterns tried first with early exit on timeout (skip remaining HTTPS)
- HTTP always tried as fallback (some SMPs only serve BC on HTTP)
- First HTTP timeout bails out entirely (fail fast)
- Worst case: ~2s for SMPs without business cards (was 18s before v2.2.4)

## [2.2.4] - 2026-01-06

### Fixed
- **Critical timeout fix:** Business card fetch for SMPs that don't support business cards now fails fast (~1.5s max) instead of trying all URL patterns (~18s)
- Reduced business card URL patterns from 5 to 2 (most common patterns only)
- Reduced per-pattern timeout from 3000ms to 1500ms
- Added early exit on first timeout - if one pattern times out, subsequent patterns are skipped
- This fixes timeout issues when using `includeBusinessCard: true` with SMPs like smp.profluo.com

## [2.2.2] - 2025-12-24

### Fixed
- **Major performance fix:** Business card fetch now completes in ~4s instead of ~150s for SMPs without HTTPS support
- Business card fetching now prefers HTTPS with 3-second timeout, falls back to HTTP
- Added `getWithTimeout()` method to HTTP client for custom timeout requests

## [2.2.1] - 2025-12-18

### Fixed
- Cleaned stale build artifacts from dist folder (removed unused csv/exporter, doh-resolver modules)

## [2.2.0] - 2025-12-18

### Changed
- **Documentation overhaul:** README now accurately reflects current API
- Replaced RELEASE.md with proper CHANGELOG.md

### Fixed
- User-Agent header now correctly reports library version
- Removed references to non-existent `CSVExporter`, `resolveBatch()`, and `resolveParticipant()` methods from documentation

### Removed
- Dead code: unused `parseProcesses()` and `parseEndpoints()` methods from XML parser
- Unused `verifySignatures` option from `ResolveOptions` interface
- Broken example file `examples/csv-export.js`
- Development script `lookup-script.ts` from repository root

### Improved
- `examples/basic-usage.js` rewritten with working examples for all API methods
- `tests/README.md` updated with current test structure
- Added ICD schemes reference table to README

## [2.1.0] - 2025-12-10

### Added
- Certificate parsing with SeatID extraction from X.509 certificates
- `CertificateParser` class with fingerprint-based caching
- `parseCertificate` option in `ResolveOptions`
- `getCertificateCacheStats()` method on `SMPResolver`
- `-c, --certificate` flag in CLI tool

## [2.0.1] - 2025-12-07

### Fixed
- Removed hardcoded 'BE' country code default in business card parsing

## [2.0.0] - 2025-12-04

### Changed
- **Breaking:** Removed Belgian-specific code and scheme auto-detection
- **Breaking:** Removed `CSVExporter` class and batch processing methods
- **Breaking:** Removed `resolveParticipant()` method - use `resolve()` with full scheme:value format
- **Breaking:** Removed `resolveBatch()` method
- Library is now a general-purpose PEPPOL SMP resolver

### Why
- Simplifies the library for broader use cases
- Removes country-specific logic that doesn't belong in a general resolver
- Users can implement batch processing in their own applications

## [1.2.0] - 2025-11-02

### Added
- Detailed SMP error diagnostics in `ParticipantInfo.diagnostics`
- DNS-only SMP lookup method (`lookupSMP`)
- Exposed `NAPTRResolver` for direct DNS queries

### Fixed
- Strip trailing slashes from SMP URLs to prevent double-slash paths (2025-11-04)

## [1.1.0] - 2025-09-06

### Added
- `--version` flag to CLI tool
- Support for parked participants (registered but no AS4 endpoints)

### Changed
- Updated dependencies

## [1.0.0] - 2025-07-12

### Added
- Initial release
- PEPPOL SML/SMP resolver following official specifications
- DNS NAPTR lookups with participant hashing (SHA-256 + Base32)
- HTTP client with connection pooling (undici)
- XML parsing for ServiceGroup and ServiceMetadata
- Business card retrieval
- CLI tool (`smp-resolve`)
- Full TypeScript support
- Official PEPPOL code list v9.2 for document type names
