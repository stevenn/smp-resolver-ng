export { SMPResolver } from './resolver.js';
export * from './types/index.js';
export { CSVExporter } from './csv/exporter.js';

// Re-export utility functions
export {
  hashParticipantId,
  validateParticipantId,
  normalizeBelgianIdentifier
} from './sml/participant-hash.js';

// Re-export DNS interfaces for extensibility
export type { IDNSResolver } from './dns/dns-resolver.interface.js';
export { DoHResolver } from './dns/doh-resolver.js';
export { NAPTRResolver } from './dns/naptr-resolver.js';
export { createDNSResolver } from './dns/resolver-factory.js';
