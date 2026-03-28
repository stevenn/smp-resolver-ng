export { SMPResolver } from './resolver.js';
export * from './types/index.js';
export { NAPTRResolver } from './dns/naptr-resolver.js';

// Library version — derived from package.json (single source of truth)
import pkg from '../package.json' with { type: 'json' };
export const VERSION = pkg.version;

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
