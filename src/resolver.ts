import { NAPTRResolver } from './dns/naptr-resolver.js';
import { HTTPClient } from './http/http-client.js';
import { RedirectHandler } from './http/redirect-handler.js';
import { XMLParser } from './xml/parser.js';
import { hashParticipantId } from './sml/participant-hash.js';
import { DocumentTypeLookup } from './data/document-types.js';
import { CertificateParser } from './certificate/parser.js';
import type {
  SMPResolverConfig,
  ParticipantInfo,
  RegistrationStatus,
  BusinessCard,
  BusinessEntity,
  EndpointInfo,
  ResolveOptions,
  ServiceMetadata,
  DocumentType,
  CertificateInfo
} from './types/index.js';

export class SMPResolver {
  private config: Required<SMPResolverConfig>;
  private naptrResolver: NAPTRResolver;
  private httpClient: HTTPClient;
  private redirectHandler: RedirectHandler;
  private xmlParser: XMLParser;
  private certificateParser: CertificateParser;

  constructor(config: SMPResolverConfig = {}) {
    this.config = {
      smlDomain: config.smlDomain ?? 'edelivery.tech.ec.europa.eu',
      dnsServers: config.dnsServers ?? [],
      httpTimeout: config.httpTimeout ?? 30000,
      cacheTTL: config.cacheTTL ?? 3600,
      userAgent: config.userAgent ?? 'smp-resolver-ng/2.2.5'
    };

    this.naptrResolver = new NAPTRResolver({
      dnsServers: this.config.dnsServers,
      timeout: 5000
    });

    this.httpClient = new HTTPClient({
      timeout: this.config.httpTimeout,
      userAgent: this.config.userAgent
    });

    this.redirectHandler = new RedirectHandler(this.httpClient);
    this.xmlParser = new XMLParser();
    this.certificateParser = new CertificateParser();
  }

  /**
   * Performs DNS-only SML lookup to get the SMP hostname
   * This is a lightweight operation that doesn't make any HTTP calls
   *
   * @param participantId - Full participant ID (e.g., "0208:0837977428")
   * @returns SMP URL and hostname, or null if not registered
   */
  async lookupSMP(participantId: string): Promise<{
    participantId: string;
    hash: string;
    smpUrl: string | null;
    smpHostname: string | null;
  }> {
    // Parse participant ID
    const [scheme, value] = participantId.split(':');
    if (!scheme || !value) {
      throw new Error('Invalid participant ID format. Expected: scheme:value');
    }

    // Hash participant ID with scheme for canonical form
    const hash = hashParticipantId(value, scheme);

    // DNS lookup only - no HTTP calls
    const smpUrl = await this.naptrResolver.lookupSMP(hash, scheme, this.config.smlDomain);

    return {
      participantId,
      hash,
      smpUrl,
      smpHostname: smpUrl ? new URL(smpUrl).hostname : null
    };
  }

  /**
   * Core resolution method
   */
  async resolve(participantId: string, options?: ResolveOptions): Promise<ParticipantInfo> {
    try {
      // Parse participant ID
      const [scheme, value] = participantId.split(':');
      if (!scheme || !value) {
        throw new Error('Invalid participant ID format. Expected: scheme:value');
      }

      // Hash participant ID with scheme for canonical form
      const hash = hashParticipantId(value, scheme);

      // DNS lookup
      const smpUrl = await this.naptrResolver.lookupSMP(hash, scheme, this.config.smlDomain);
      if (!smpUrl) {
        return {
          participantId,
          isRegistered: false,
          registrationStatus: 'unregistered',
          hasActiveEndpoints: false,
          error: 'No SMP found via DNS lookup'
        };
      }

      // Fetch service metadata
      let serviceMetadata: ServiceMetadata;
      let isParkedDueToNoServiceGroup = false;
      
      try {
        serviceMetadata = await this.fetchServiceMetadata(smpUrl, participantId);
      } catch (error) {
        // If service group returns 404, the participant is registered but has no service metadata (parked)
        if (error instanceof Error && error.message.includes('SMP returned status 404')) {
          isParkedDueToNoServiceGroup = true;
          serviceMetadata = { 
            participantIdentifier: { scheme: scheme, value: value },
            documentTypes: [],
            smpUrl: smpUrl
          };
        } else {
          throw error;
        }
      }

      // Extract endpoint info first
      const endpointInfo = isParkedDueToNoServiceGroup
        ? { smpHostname: new URL(smpUrl).hostname, endpoint: undefined }
        : await this.extractEndpointInfo(serviceMetadata, smpUrl, participantId);

      // Determine registration status based on endpoints and document types
      const hasEndpoints = !!endpointInfo.endpoint;
      const hasDocumentTypes = serviceMetadata.documentTypes.length > 0;
      const hasActiveEndpoints = hasEndpoints && hasDocumentTypes;
      const registrationStatus: RegistrationStatus = hasActiveEndpoints ? 'active' : 'parked';

      // Build response based on options
      const result: ParticipantInfo = {
        participantId,
        isRegistered: true,
        registrationStatus,
        hasActiveEndpoints
      };

      // Include SMP hostname if verbose mode
      if (options?.fetchDocumentTypes || options?.includeBusinessCard) {
        result.smpHostname = endpointInfo.smpHostname;
      }

      // Include document types if requested
      if (options?.fetchDocumentTypes) {
        result.documentTypes = serviceMetadata.documentTypes.map(
          dt => dt.friendlyName || dt.documentIdentifier.value
        );
      }

      // Include endpoint details if verbose mode
      if (options?.fetchDocumentTypes && endpointInfo.endpoint) {
        result.endpoint = endpointInfo.endpoint;
      }

      // Parse certificate if requested and available
      if (options?.parseCertificate && endpointInfo.endpoint?.certificate) {
        try {
          result.certificateInfo = this.certificateParser.parse(endpointInfo.endpoint.certificate);
        } catch {
          // Certificate parsing failed, continue without it
        }
      }

      // Include business entity if requested
      if (options?.includeBusinessCard) {
        try {
          const businessCard = await this.getBusinessCard(participantId, options);
          result.businessEntity = businessCard.entity;
        } catch {
          // Business card is optional, continue without it
        }
      }

      // Include diagnostics if available
      if (endpointInfo.diagnostics) {
        result.diagnostics = endpointInfo.diagnostics;
      }

      return result;
    } catch (error: unknown) {
      return {
        participantId,
        isRegistered: false,
        registrationStatus: 'unregistered',
        hasActiveEndpoints: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Gets business card information (peppolcheck compatibility)
   */
  async getBusinessCard(participantId: string, _options?: ResolveOptions): Promise<BusinessCard> {
    // Get SMP URL via DNS
    const [scheme, value] = participantId.split(':');
    if (!scheme || !value) {
      throw new Error('Invalid participant ID format');
    }

    const hash = hashParticipantId(value, scheme);
    const smpUrl = await this.naptrResolver.lookupSMP(hash, scheme, this.config.smlDomain);

    if (!smpUrl) {
      throw new Error('Participant not registered');
    }

    const smpHostname = new URL(smpUrl).hostname;

    // Try to fetch business card XML using full SMP URL (includes path)
    const businessEntity = await this.fetchBusinessCardXML(participantId, smpUrl);

    // Build business card response
    const businessCard: BusinessCard = {
      entity: businessEntity || {
        name: 'Unknown',
        countryCode: '',
        identifiers: [
          {
            scheme: participantId.split(':')[0],
            value: participantId.split(':')[1]
          }
        ]
      },
      smpHostname
    };

    return businessCard;
  }

  /**
   * Gets endpoint URLs only (bulk processor compatibility)
   */
  async getEndpointUrls(participantId: string): Promise<EndpointInfo> {
    try {
      // Parse participant ID
      const [scheme, value] = participantId.split(':');
      if (!scheme || !value) {
        throw new Error('Invalid participant ID format');
      }

      // Get SMP URL via DNS
      const hash = hashParticipantId(value, scheme);
      const smpUrl = await this.naptrResolver.lookupSMP(hash, scheme, this.config.smlDomain);

      if (!smpUrl) {
        throw new Error('No SMP found via DNS lookup');
      }

      // Fetch ServiceGroup to get document references
      const serviceGroupUrl = `${smpUrl}/iso6523-actorid-upis::${participantId}`;
      const response = await this.redirectHandler.followRedirects(serviceGroupUrl);

      if (response.statusCode !== 200) {
        throw new Error(`SMP returned status ${response.statusCode}`);
      }

      // Parse ServiceGroup
      const serviceGroup = this.xmlParser.parseServiceGroup(response.body);

      // Extract hostname
      const smpHostname = new URL(smpUrl).hostname;
      let endpointData: EndpointInfo['endpoint'] = undefined;

      // Fetch first document type's metadata to get endpoints
      if (serviceGroup.serviceReferences.length > 0) {
        try {
          const metadataUrl = serviceGroup.serviceReferences[0];
          const metadataResponse = await this.redirectHandler.followRedirects(metadataUrl);

          if (metadataResponse.statusCode === 200) {
            const metadata = this.xmlParser.parseServiceMetadata(metadataResponse.body);

            // Get first endpoint from first process of first document type
            if (metadata.documentTypes.length > 0) {
              const docType = metadata.documentTypes[0];
              if (docType.processes.length > 0) {
                const process = docType.processes[0];
                if (process.endpoints.length > 0) {
                  const endpoint = process.endpoints[0];
                  endpointData = {
                    url: endpoint.endpointUrl,
                    transportProfile: endpoint.transportProfile,
                    technicalContactUrl: endpoint.technicalContactUrl,
                    technicalInformationUrl: endpoint.technicalInformationUrl,
                    serviceDescription: endpoint.serviceDescription,
                    certificate: endpoint.certificate
                  };
                }
              }
            }
          }
        } catch {
          // Continue even if metadata fetch fails
        }
      }

      return { smpHostname, endpoint: endpointData };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get endpoint URLs: ${message}`);
    }
  }

  /**
   * Fetches service metadata from SMP
   */
  private async fetchServiceMetadata(
    smpUrl: string,
    participantId: string
  ): Promise<ServiceMetadata> {
    // Construct ServiceGroup URL with full PEPPOL identifier format
    const serviceGroupUrl = `${smpUrl}/iso6523-actorid-upis::${participantId}`;

    // Fetch and follow redirects
    const response = await this.redirectHandler.followRedirects(serviceGroupUrl);

    if (response.statusCode !== 200) {
      throw new Error(`SMP returned status ${response.statusCode}`);
    }

    // Parse ServiceGroup
    const serviceGroup = this.xmlParser.parseServiceGroup(response.body);

    // Extract document types from service references
    const documentTypes: DocumentType[] = [];
    for (const refUrl of serviceGroup.serviceReferences) {
      // Service references already contain the full URL, just need to extract the doc ID
      // Format could be: http://smp.host/iso6523-actorid-upis::0208:123/services/{encoded-doc-id}
      // or just relative: /services/{encoded-doc-id}
      let docId: string | null = null;
      
      // Try to extract from full URL
      const fullUrlMatch = refUrl.match(/\/services\/(.+)$/);
      if (fullUrlMatch) {
        const encodedDocId = fullUrlMatch[1];
        docId = decodeURIComponent(encodedDocId);
      }
      
      // If we found a document ID, add it
      if (docId) {
        // Extract scheme from document ID if present
        let scheme = 'busdox-docid-qns';
        let value = docId;
        
        // Check if document ID contains scheme prefix
        if (docId.includes('::')) {
          const parts = docId.split('::');
          if (parts.length >= 2) {
            scheme = parts[0];
            value = parts.slice(1).join('::');
          }
        }

        documentTypes.push({
          documentIdentifier: {
            scheme,
            value
          },
          friendlyName: this.extractFriendlyDocumentName(value),
          processes: []
        });
      }
    }

    return {
      participantIdentifier: serviceGroup.participantIdentifier,
      documentTypes,
      smpUrl
    };
  }


  /**
   * Extracts endpoint info from service metadata
   */
  private async extractEndpointInfo(
    metadata: ServiceMetadata,
    smpUrl: string,
    participantId: string
  ): Promise<EndpointInfo & { diagnostics?: ParticipantInfo['diagnostics'] }> {
    // Extract hostname from SMP URL
    const smpHostname = new URL(smpUrl).hostname;
    const smpErrors: Array<{ url: string; statusCode: number; message: string }> = [];

    // Try to fetch first document type's metadata to get endpoints
    if (metadata.documentTypes.length > 0) {
      try {
        // Construct URL for first document type
        const docType = metadata.documentTypes[0];
        // Include the scheme in the document identifier
        const fullDocId = `${docType.documentIdentifier.scheme}::${docType.documentIdentifier.value}`;
        const encodedDocId = encodeURIComponent(fullDocId);
        const metadataUrl = `${smpUrl}/iso6523-actorid-upis::${participantId}/services/${encodedDocId}`;

        const response = await this.redirectHandler.followRedirects(metadataUrl);

        if (response.statusCode === 200) {
          const serviceMetadata = this.xmlParser.parseServiceMetadata(response.body);

          // Get first endpoint from first process of first document type
          if (serviceMetadata.documentTypes.length > 0) {
            const firstDoc = serviceMetadata.documentTypes[0];
            if (firstDoc.processes.length > 0) {
              const firstProcess = firstDoc.processes[0];
              if (firstProcess.endpoints.length > 0) {
                const endpoint = firstProcess.endpoints[0];
                return {
                  smpHostname,
                  endpoint: {
                    url: endpoint.endpointUrl,
                    transportProfile: endpoint.transportProfile,
                    technicalContactUrl: endpoint.technicalContactUrl,
                    technicalInformationUrl: endpoint.technicalInformationUrl,
                    serviceDescription: endpoint.serviceDescription,
                    certificate: endpoint.certificate,
                    serviceActivationDate: endpoint.serviceActivationDate,
                    serviceExpirationDate: endpoint.serviceExpirationDate
                  }
                };
              }
            }
          }
        } else {
          // Capture non-200 status codes
          smpErrors.push({
            url: metadataUrl,
            statusCode: response.statusCode,
            message: `SMP returned HTTP ${response.statusCode} when fetching service metadata`
          });
        }
      } catch (error) {
        // Capture any errors during metadata fetch
        const docType = metadata.documentTypes[0];
        const fullDocId = `${docType.documentIdentifier.scheme}::${docType.documentIdentifier.value}`;
        const encodedDocId = encodeURIComponent(fullDocId);
        const metadataUrl = `${smpUrl}/iso6523-actorid-upis::${participantId}/services/${encodedDocId}`;

        smpErrors.push({
          url: metadataUrl,
          statusCode: 0,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      smpHostname,
      endpoint: undefined,
      diagnostics: smpErrors.length > 0 ? { smpErrors } : undefined
    };
  }

  /**
   * Extracts a friendly name from document identifier
   */
  private extractFriendlyDocumentName(documentId: string): string {
    // First try to look up in the official code list
    const lookup = DocumentTypeLookup.getInstance();
    const friendlyName = lookup.getFriendlyName(documentId);
    
    if (friendlyName) {
      return friendlyName;
    }
    
    // Fallback: extract a basic name from the document ID
    // Remove scheme prefix if present
    const withoutScheme = documentId.replace(/^[^:]+::/, '');
    
    // Try to extract document type from UBL format
    const ublMatch = withoutScheme.match(/xsd:([^:]+)-\d+::([^#]+)##/);
    if (ublMatch) {
      return ublMatch[2];
    }
    
    // Try to extract from CII format
    const ciiMatch = withoutScheme.match(/standard:([^:]+):\d+::/);
    if (ciiMatch) {
      return ciiMatch[1];
    }
    
    // Last resort: return the last meaningful part
    const parts = withoutScheme.split('::');
    return parts[parts.length - 1] || documentId;
  }

  /**
   * Fetches business card XML from SMP
   *
   * Strategy:
   * 1. Try HTTPS first (preferred for security) with aggressive timeout
   * 2. On first timeout/connection error, skip remaining HTTPS patterns
   * 3. Always try HTTP as fallback (some SMPs only serve BC on HTTP)
   * 4. On first HTTP timeout, give up entirely
   */
  private async fetchBusinessCardXML(
    participantId: string,
    baseUrl: string
  ): Promise<BusinessEntity | null> {
    const fullIdentifier = `iso6523-actorid-upis::${participantId}`;
    const encodedParticipantId = encodeURIComponent(fullIdentifier);

    // Business card URL patterns to try (most common first)
    const patterns = [
      `/businesscard/${fullIdentifier}`,
      `/${encodedParticipantId}/businesscard`,
      `/smp/businesscard/${encodedParticipantId}`,
      `/api/businesscard/${encodedParticipantId}`,
      `/rest/businesscard/${encodedParticipantId}`
    ];

    // Timeout for business card fetches - give slower SMPs enough time
    const BC_TIMEOUT_MS = 5000;

    // Determine HTTP and HTTPS base URLs
    const httpBase = baseUrl.startsWith('https')
      ? baseUrl.replace('https://', 'http://')
      : baseUrl;
    const httpsBase = baseUrl.startsWith('http://')
      ? baseUrl.replace('http://', 'https://')
      : baseUrl;

    // Try HTTPS first with short timeout (preferred for security)
    let httpsTimedOut = false;
    for (const pattern of patterns) {
      if (httpsTimedOut) break;
      const url = httpsBase + pattern;
      try {
        const response = await this.httpClient.getWithTimeout(url, BC_TIMEOUT_MS);

        if (response.statusCode === 200 && response.body.trim().startsWith('<')) {
          return this.parseBusinessCardXML(response.body);
        }
        // Got 404 or other response - server responds, continue trying patterns
      } catch {
        // HTTPS timeout/connection error - skip remaining HTTPS patterns
        httpsTimedOut = true;
      }
    }

    // Always try HTTP as fallback (some SMPs only serve BC on HTTP)
    for (const pattern of patterns) {
      const url = httpBase + pattern;
      try {
        const response = await this.httpClient.getWithTimeout(url, BC_TIMEOUT_MS);

        if (response.statusCode === 200 && response.body.trim().startsWith('<')) {
          return this.parseBusinessCardXML(response.body);
        }
        // Got 404 or other response - continue trying patterns
      } catch {
        // HTTP timeout - server doesn't support business cards, bail out
        break;
      }
    }

    return null;
  }

  /**
   * Parses business card XML to extract entity information
   */
  private parseBusinessCardXML(xml: string): BusinessEntity | null {
    try {
      // Extract business entity name
      const nameMatch = xml.match(/<(?:[\w]+:)?Name[^>]*>([^<]+)</);
      const name = nameMatch ? nameMatch[1].trim() : 'Unknown';

      // Extract country code
      const countryMatch = xml.match(/<(?:[\w]+:)?CountryCode[^>]*>([^<]+)</);
      const countryCode = countryMatch ? countryMatch[1].trim() : '';

      // Extract identifiers
      const identifiers: Array<{ scheme: string; value: string }> = [];
      const idRegex = /<(?:[\w]+:)?Identifier[^>]*scheme="([^"]+)"[^>]*>([^<]+)</g;
      let match;

      while ((match = idRegex.exec(xml)) !== null) {
        identifiers.push({
          scheme: match[1],
          value: match[2].trim()
        });
      }

      // If no identifiers found, try to extract from ParticipantIdentifier
      if (identifiers.length === 0) {
        const participantMatch = xml.match(
          /<(?:[\w]+:)?ParticipantIdentifier[^>]*scheme="([^"]+)"[^>]*>([^<]+)</
        );
        if (participantMatch) {
          const fullId = participantMatch[2].trim();
          const parts = fullId.split(':');
          if (parts.length === 2) {
            identifiers.push({
              scheme: parts[0],
              value: parts[1]
            });
          }
        }
      }

      // Extract geographical info
      const geoMatch = xml.match(/<(?:[\w]+:)?GeographicalInformation[^>]*>([^<]+)</);
      const geographicalInfo = geoMatch ? geoMatch[1].trim() : undefined;

      // Extract websites
      const websites: string[] = [];
      const websiteRegex = /<(?:[\w]+:)?WebsiteURI[^>]*>([^<]+)</g;
      while ((match = websiteRegex.exec(xml)) !== null) {
        websites.push(match[1].trim());
      }

      // Extract contacts
      const contacts: Array<{ type: string; name?: string; phoneNumber?: string; email?: string }> =
        [];
      const contactRegex = /<(?:[\w]+:)?Contact[^>]*>([\s\S]*?)<\/(?:[\w]+:)?Contact>/g;
      while ((match = contactRegex.exec(xml)) !== null) {
        const contactXml = match[1];
        const typeMatch = contactXml.match(/<(?:[\w]+:)?TypeCode[^>]*>([^<]+)</);
        const nameMatch = contactXml.match(/<(?:[\w]+:)?Name[^>]*>([^<]+)</);
        const phoneMatch = contactXml.match(/<(?:[\w]+:)?PhoneNumber[^>]*>([^<]+)</);
        const emailMatch = contactXml.match(/<(?:[\w]+:)?Email[^>]*>([^<]+)</);

        contacts.push({
          type: typeMatch ? typeMatch[1].trim() : 'unknown',
          name: nameMatch ? nameMatch[1].trim() : undefined,
          phoneNumber: phoneMatch ? phoneMatch[1].trim() : undefined,
          email: emailMatch ? emailMatch[1].trim() : undefined
        });
      }

      return {
        name,
        countryCode,
        identifiers:
          identifiers.length > 0
            ? identifiers
            : [
                {
                  scheme: 'unknown',
                  value: 'unknown'
                }
              ],
        websites: websites.length > 0 ? websites : undefined,
        contacts: contacts.length > 0 ? contacts : undefined,
        geographicalInfo
      };
    } catch {
      return null;
    }
  }

  /**
   * Closes all connections and clears caches
   */
  async close(): Promise<void> {
    await this.httpClient.close();
    this.certificateParser.clearCache();
  }

  /**
   * Get certificate cache statistics (useful for monitoring bulk processing)
   */
  getCertificateCacheStats(): { size: number; fingerprints: string[] } {
    return this.certificateParser.getCacheStats();
  }
}
