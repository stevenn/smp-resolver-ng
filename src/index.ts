export { SMPResolver } from './resolver.js';
export * from './types/index.js';
export { NAPTRResolver } from './dns/naptr-resolver.js';

// Library version (keep in sync with package.json)
export const VERSION = '2.2.9';

// Re-export utility functions
export {
  hashParticipantId,
  validateParticipantId,
  parseParticipantId
} from './sml/participant-hash.js';

// Endpoint classification
export {
  EndpointClassifier,
  type ParsedEndpointInfo,
  type ExtendedEndpointResult
} from './endpoints/classifier.js';

// Certificate parsing
export { CertificateParser } from './certificate/parser.js';
