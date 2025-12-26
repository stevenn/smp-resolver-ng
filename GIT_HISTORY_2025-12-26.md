# Git History - SMP Resolver NG

**Repository:** smp-resolver-ng
**Description:** Next-generation Peppol SMP resolver library with NAPTR-based discovery
**Package:** @stevenn/smp-resolver-ng
**Generated:** 2025-12-26

---

## Summary

- **Total Commits:** 37
- **First Commit:** 2025-07-12
- **Latest Commit:** 2025-12-24
- **Primary Author:** Steven Noels
- **Current Version:** 2.2.2

---

## Version History

| Version | Date | Commit | Changes |
|---------|------|--------|---------|
| 2.2.2 | 2025-12-24 | 27091af | fix: resolve business card fetch timeout causing 150s+ latency |
| 2.2.1 | 2025-12-18 | f5f1a73 | fix: Clean stale build artifacts from dist |
| 2.2.0 | 2025-12-18 | 65c743e | chore: Documentation overhaul and code cleanup |
| 2.1.0 | 2025-12-10 | 7292634 | feat: Add certificate parsing with SeatID extraction |
| 2.0.1 | 2025-12-07 | 706390c | fix: remove hardcoded 'BE' country code default |
| 2.0.0 | 2025-12-04 | 4160c75 | WIP: Remove Belgian-specific code and CSV handling |
| 1.2.0 | 2025-11-02 | c26db7a | feat: Add detailed SMP error diagnostics |
| 1.1.0 | 2025-09-06 | 1992730 | chore: Bump version and update dependencies |
| 1.0.11 | 2025-08-13 | 3bb8911 | feat: Add --version flag to CLI tool |
| 1.0.10 | 2025-08-13 | d9f2fdc | fix: Handle parked participants correctly |
| 1.0.9 | 2025-08-13 | 7efbbab | feat: add support for parked participants |
| 1.0.8 | 2025-07-12 | f23bf18 | Bug fixes and improvements |
| 1.0.7 | 2025-07-12 | 509eabf | feat: implement cleaner response structure |
| 1.0.6 | 2025-07-12 | 60a83e1 | docs: update README with --all option |
| 1.0.5 | 2025-07-12 | 4d01100 | Use official PEPPOL code list for document type names |
| 1.0.4 | 2025-07-12 | 9fccd3c | Add serviceDescription field |
| 1.0.3 | 2025-07-12 | 8c39e1d | Fix technical URLs extraction |
| 1.0.2 | 2025-07-12 | 7787d1b | Remove ESLint, simplify tooling |
| 1.0.1 | 2025-07-12 | 694cf88 | Replace regex XML parsing with fast-xml-parser |
| 1.0.0 | 2025-07-12 | 725d83f | Initial commit: PEPPOL SMP resolver library |

---

## Full Commit Timeline

| Date | Commit | Description |
|------|--------|-------------|
| 2025-12-24 | 27091af | fix: resolve business card fetch timeout causing 150s+ latency |
| 2025-12-18 | f5f1a73 | fix: Clean stale build artifacts from dist (v2.2.1) |
| 2025-12-18 | 65c743e | chore: Documentation overhaul and code cleanup (v2.2.0) |
| 2025-12-10 | 7292634 | feat: Add certificate parsing with SeatID extraction (v2.1.0) |
| 2025-12-07 | 706390c | fix: remove hardcoded 'BE' country code default (v2.0.1) |
| 2025-12-04 | 4160c75 | WIP: v2.0.0 - Remove Belgian-specific code and CSV handling |
| 2025-11-23 | 2cbea9c | feat: Add DNS-only SMP lookup method and expose NAPTRResolver |
| 2025-11-04 | 4dd9a6b | fix: Strip trailing slashes from SMP URLs to prevent double-slash URLs |
| 2025-11-02 | c26db7a | feat: Add detailed SMP error diagnostics (v1.2.0) |
| 2025-09-25 | 8805634 | revert: Remove DNS-over-HTTPS (DoH) implementation |
| 2025-09-24 | 933f8dc | fix: Increase DoH timeout to 10 seconds for VPS compatibility |
| 2025-09-24 | a0c4b86 | feat: Add DNS-over-HTTPS (DoH) support |
| 2025-09-06 | 1992730 | chore: Bump version to 1.1.0 and update dependencies |
| 2025-08-13 | 3bb8911 | feat: Add --version flag to CLI tool (v1.0.11) |
| 2025-08-13 | d9f2fdc | fix: Handle parked participants correctly (v1.0.10) |
| 2025-08-13 | 7efbbab | chore: bump version to 1.0.9 |
| 2025-08-13 | 920dab8 | feat: add support for parked participants (registered but no AS4 endpoints) |
| 2025-07-12 | f23bf18 | 1.0.8 |
| 2025-07-12 | 53d491c | chore: remove dead code and improve documentation |
| 2025-07-12 | 509eabf | 1.0.7 |
| 2025-07-12 | bd2f6df | feat: implement cleaner response structure without redundancy |
| 2025-07-12 | 60a83e1 | 1.0.6 |
| 2025-07-12 | 860888a | docs: update README with --all option and service description features |
| 2025-07-12 | 4d01100 | 1.0.5 |
| 2025-07-12 | f61766b | Use official PEPPOL code list for document type names |
| 2025-07-12 | 7a95766 | Fix CSV exporter test to include service_description column |
| 2025-07-12 | 9fccd3c | 1.0.4 |
| 2025-07-12 | 84cbc0e | Add serviceDescription field to all relevant interfaces and outputs |
| 2025-07-12 | 8c39e1d | 1.0.3 |
| 2025-07-12 | ef097e1 | Fix technical URLs extraction and company name fetching in batch processing |
| 2025-07-12 | 7787d1b | 1.0.2 |
| 2025-07-12 | 7bf56f8 | Remove ESLint - simplify tooling to TypeScript and Prettier only |
| 2025-07-12 | 694cf88 | 1.0.1 |
| 2025-07-12 | 35fc103 | Replace fragile regex-based XML parsing with robust fast-xml-parser |
| 2025-07-12 | 68c5e0b | Configure package for GitHub Packages publishing |
| 2025-07-12 | 3fc53d2 | Remove dead code: detectServiceProvider method and serviceProvider field |
| 2025-07-12 | 725d83f | Initial commit: PEPPOL SMP resolver library v1.0.0 |

---

## Key Milestones

- **v2.2.2 (2025-12-24):** Fixed business card fetch timeout issue
- **v2.1.0 (2025-12-10):** Added certificate parsing with SeatID extraction
- **v2.0.0 (2025-12-04):** Major refactor - removed Belgian-specific code, made library generic
- **v1.2.0 (2025-11-02):** Added detailed SMP error diagnostics
- **v1.0.9 (2025-08-13):** Added support for parked participants
- **v1.0.0 (2025-07-12):** Initial release with NAPTR-based SMP discovery

---

## Breaking Changes

### v2.0.0
- Removed Belgian-specific normalization code
- Removed CSV export handling (moved to bulk processor)
- Country code no longer defaults to 'BE'

---

*This file is auto-generated. Run `git log` for complete history.*
