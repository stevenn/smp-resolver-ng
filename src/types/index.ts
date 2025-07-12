export interface ParticipantIdentifier {
  scheme: string;
  value: string;
}

export interface DNSRecord {
  name: string;
  type: string;
  class: string;
  ttl: number;
  order?: number;
  preference?: number;
  flags?: string;
  service?: string;
  regexp?: string;
  replacement?: string;
}

export interface ServiceEndpoint {
  transportProfile: string;
  endpointUrl: string;
  requireBusinessLevelSignature: boolean;
  minimumAuthenticationLevel?: string;
  serviceActivationDate?: Date;
  serviceExpirationDate?: Date;
  certificate?: string;
  serviceDescription?: string;
  technicalContactUrl?: string;
  technicalInformationUrl?: string;
}

export interface Process {
  processIdentifier: {
    scheme: string;
    value: string;
  };
  endpoints: ServiceEndpoint[];
}

export interface DocumentType {
  documentIdentifier: {
    scheme: string;
    value: string;
  };
  friendlyName?: string;
  processes: Process[];
}

export interface ServiceMetadata {
  participantIdentifier: ParticipantIdentifier;
  documentTypes: DocumentType[];
  smpUrl?: string;
}

export interface BusinessEntity {
  name: string;
  countryCode: string;
  identifiers: Array<{
    scheme: string;
    value: string;
  }>;
  websites?: string[];
  contacts?: Array<{
    type: string;
    name?: string;
    phoneNumber?: string;
    email?: string;
  }>;
  geographicalInfo?: string;
  additionalInfo?: string;
  registrationDate?: string;
}

export interface BusinessCard {
  entity: BusinessEntity;
  documentTypes: Array<{
    documentId: string;
    friendlyName: string;
  }>;
  endpoints: Array<{
    transportProfile: string;
    endpointUrl: string;
    technicalContactUrl?: string;
    technicalInformationUrl?: string;
  }>;
  smpHostname?: string;
}

export interface EndpointInfo {
  smpHostname: string;
  endpoint?: {
    url: string;
    transportProfile: string;
    technicalContactUrl?: string;
    technicalInformationUrl?: string;
  };
}

export interface ParticipantInfo {
  participantId: string;
  isRegistered: boolean;
  businessCard?: BusinessCard;
  endpointInfo?: EndpointInfo;
  documentTypes?: string[];
  error?: string;
}

export interface BatchResult {
  participantId: string;
  success: boolean;
  smpHostname?: string;
  as4EndpointUrl?: string;
  technicalContactUrl?: string;
  technicalInfoUrl?: string;
  errorMessage?: string;
  processedAt: Date;
}

export interface ResolveOptions {
  fetchDocumentTypes?: boolean;
  verifySignatures?: boolean;
  includeBusinessCard?: boolean;
  timeout?: number;
}

export interface BatchOptions {
  concurrency?: number;
  onProgress?: (completed: number, total: number) => void;
  timeout?: number;
}

export interface SMPResolverConfig {
  smlDomain?: string;
  dnsServers?: string[];
  httpTimeout?: number;
  cacheTTL?: number;
  userAgent?: string;
}
