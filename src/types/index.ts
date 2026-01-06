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
  smpHostname: string;
}

export interface CertificateInfo {
  fingerprint: string;      // SHA-256 of raw certificate (cache key)
  subjectDN: string;        // Full subject distinguished name
  issuerDN: string;         // Full issuer distinguished name
  serialNumber: string;     // Certificate serial number
  notBefore: Date;          // Validity start
  notAfter: Date;           // Validity end
  seatId?: string;          // Peppol SeatID extracted from CN (e.g., "POP000123")
  isExpired: boolean;       // Convenience flag for validity check
  raw: string;              // Original base64/PEM certificate
}

export interface EndpointInfo {
  smpHostname: string;
  endpoint?: {
    url: string;
    transportProfile: string;
    technicalContactUrl?: string;
    technicalInformationUrl?: string;
    serviceDescription?: string;
    certificate?: string;           // Raw base64 certificate from SMP
    serviceActivationDate?: Date;   // When endpoint was activated
    serviceExpirationDate?: Date;   // When endpoint expires
  };
}

export type RegistrationStatus = 
  | 'unregistered'    // Not found in SML/SMP
  | 'parked'          // Registered but no active endpoints
  | 'active';         // Registered with active endpoints

export interface ParticipantInfo {
  participantId: string;
  isRegistered: boolean;
  registrationStatus: RegistrationStatus;
  hasActiveEndpoints: boolean;
  smpHostname?: string;
  documentTypes?: string[];
  endpoint?: {
    url: string;
    transportProfile: string;
    serviceDescription?: string;
    technicalContactUrl?: string;
    technicalInformationUrl?: string;
    certificate?: string;           // Raw base64 certificate from SMP
    serviceActivationDate?: Date;   // When endpoint was activated
    serviceExpirationDate?: Date;   // When endpoint expires
  };
  certificateInfo?: CertificateInfo;  // Parsed certificate (when parseCertificate: true)
  businessEntity?: BusinessEntity;
  error?: string;
  diagnostics?: {
    smpErrors?: Array<{
      url: string;
      statusCode: number;
      message: string;
    }>;
    warnings?: string[];
  };
}

export interface ResolveOptions {
  fetchDocumentTypes?: boolean;
  includeBusinessCard?: boolean;
  parseCertificate?: boolean;     // Parse X.509 certificate and extract SeatID (default: false)
  timeout?: number;
}

export interface SMPResolverConfig {
  smlDomain?: string;
  dnsServers?: string[];
  httpTimeout?: number;
  cacheTTL?: number;
  userAgent?: string;
}
