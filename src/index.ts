export { SMPResolver } from './resolver.js';
export * from './types/index.js';
export { NAPTRResolver } from './dns/naptr-resolver.js';

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
