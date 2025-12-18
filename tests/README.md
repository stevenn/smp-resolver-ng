# Test Suite

## Overview

The test suite uses Vitest for both unit and integration tests.

## Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## Test Structure

### Unit Tests

- `unit/participant-hash.test.ts` - SHA-256 + Base32 hashing and participant ID parsing
- `unit/xml-parser.test.ts` - ServiceGroup and ServiceMetadata XML parsing
- `unit/certificate-parser.test.ts` - X.509 certificate parsing and SeatID extraction

### Integration Tests

- `integration/resolver.test.ts` - Tests for the main SMPResolver class including:
  - Basic participant resolution
  - DNS-only SMP lookup
  - Business card retrieval
  - Endpoint URL extraction

## Current Status

- All unit tests passing
- Integration tests use mocked HTTP/DNS responses
- 2 integration tests skipped (require live network access)
