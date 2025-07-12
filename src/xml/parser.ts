import type {
  ServiceEndpoint,
  Process,
  DocumentType,
  ParticipantIdentifier
} from '../types/index.js';

/**
 * Lightweight XML parser for PEPPOL SMP responses
 * Uses regex-based parsing for performance (no external dependencies)
 */
export class XMLParser {
  /**
   * Parses ServiceGroup XML response
   */
  parseServiceGroup(xml: string): {
    participantIdentifier: ParticipantIdentifier;
    serviceReferences: string[];
  } {
    // Extract participant identifier (with namespace support)
    const participantMatch = xml.match(
      /<(?:[\w]+:)?ParticipantIdentifier[^>]*scheme="([^"]+)"[^>]*>([^<]+)</
    );

    if (!participantMatch) {
      throw new Error('Invalid ServiceGroup XML: missing ParticipantIdentifier');
    }

    const participantIdentifier: ParticipantIdentifier = {
      scheme: participantMatch[1],
      value: participantMatch[2].trim()
    };

    // Extract service references
    const serviceReferences: string[] = [];
    const refRegex = /<(?:[\w]+:)?ServiceMetadataReference[^>]*href="([^"]+)"/g;
    let match;

    while ((match = refRegex.exec(xml)) !== null) {
      serviceReferences.push(match[1]);
    }

    return {
      participantIdentifier,
      serviceReferences
    };
  }

  /**
   * Parses SignedServiceMetadata XML response
   */
  parseServiceMetadata(xml: string): {
    documentTypes: DocumentType[];
    redirect?: string;
  } {
    // Check for redirect
    const redirectMatch = xml.match(/<(?:[\w]+:)?Redirect[^>]*href="([^"]+)"/);
    if (redirectMatch) {
      return {
        documentTypes: [],
        redirect: redirectMatch[1]
      };
    }

    // Extract document identifier
    const docMatch = xml.match(/<(?:[\w]+:)?DocumentIdentifier[^>]*scheme="([^"]+)"[^>]*>([^<]+)</);

    if (!docMatch) {
      throw new Error('Invalid ServiceMetadata XML: missing DocumentIdentifier');
    }

    const documentIdentifier = {
      scheme: docMatch[1],
      value: docMatch[2].trim()
    };

    // Parse processes
    const processes = this.parseProcesses(xml);

    const documentType: DocumentType = {
      documentIdentifier,
      friendlyName: this.extractFriendlyName(documentIdentifier.value),
      processes
    };

    return {
      documentTypes: [documentType]
    };
  }

  /**
   * Parses all Process elements from ServiceMetadata
   */
  private parseProcesses(xml: string): Process[] {
    const processes: Process[] = [];
    const processRegex = /<(?:[\w]+:)?Process>([\s\S]*?)<\/(?:[\w]+:)?Process>/g;
    let processMatch;

    while ((processMatch = processRegex.exec(xml)) !== null) {
      const processXml = processMatch[1];

      // Extract process identifier
      const pidMatch = processXml.match(
        /<(?:[\w]+:)?ProcessIdentifier[^>]*scheme="([^"]+)"[^>]*>([^<]+)</
      );

      if (!pidMatch) continue;

      const processIdentifier = {
        scheme: pidMatch[1],
        value: pidMatch[2].trim()
      };

      // Parse endpoints
      const endpoints = this.parseEndpoints(processXml);

      processes.push({
        processIdentifier,
        endpoints
      });
    }

    return processes;
  }

  /**
   * Parses all Endpoint elements from a Process
   */
  private parseEndpoints(xml: string): ServiceEndpoint[] {
    const endpoints: ServiceEndpoint[] = [];
    const endpointRegex =
      /<(?:[\w]+:)?Endpoint[^>]*transportProfile="([^"]+)"[^>]*>([\s\S]*?)<\/(?:[\w]+:)?Endpoint>/g;
    let endpointMatch;

    while ((endpointMatch = endpointRegex.exec(xml)) !== null) {
      const transportProfile = endpointMatch[1];
      const endpointXml = endpointMatch[2];

      // Extract endpoint URL (try both Address and EndpointURI)
      let urlMatch = endpointXml.match(/<(?:[\w]+:)?EndpointURI>([^<]+)</);
      if (!urlMatch) {
        urlMatch = endpointXml.match(/<(?:[\w]+:)?Address>([^<]+)</);
      }

      if (!urlMatch) continue;

      const endpoint: ServiceEndpoint = {
        transportProfile,
        endpointUrl: urlMatch[1].trim(),
        requireBusinessLevelSignature: this.extractBoolean(
          endpointXml,
          'RequireBusinessLevelSignature'
        ),
        certificate: this.extractText(endpointXml, 'Certificate'),
        serviceDescription: this.extractText(endpointXml, 'ServiceDescription'),
        technicalContactUrl: this.extractText(endpointXml, 'TechnicalContactUrl'),
        technicalInformationUrl: this.extractText(endpointXml, 'TechnicalInformationUrl')
      };

      // Parse dates if present
      const activationDate = this.extractText(endpointXml, 'ServiceActivationDate');
      if (activationDate) {
        endpoint.serviceActivationDate = new Date(activationDate);
      }

      const expirationDate = this.extractText(endpointXml, 'ServiceExpirationDate');
      if (expirationDate) {
        endpoint.serviceExpirationDate = new Date(expirationDate);
      }

      endpoints.push(endpoint);
    }

    return endpoints;
  }

  /**
   * Extracts text content from an XML element
   */
  private extractText(xml: string, tagName: string): string | undefined {
    const match = xml.match(new RegExp(`<(?:[\w]+:)?${tagName}[^>]*>([^<]+)<`));
    return match ? match[1].trim() : undefined;
  }

  /**
   * Extracts boolean value from an XML element
   */
  private extractBoolean(xml: string, tagName: string): boolean {
    const text = this.extractText(xml, tagName);
    return text?.toLowerCase() === 'true';
  }

  /**
   * Extracts a friendly name from document identifier
   */
  private extractFriendlyName(documentId: string): string {
    // Handle UBL format: urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##UBL-2.0
    const ublMatch = documentId.match(/xsd:([^:]+)-\d+::([^#]+)##(.+)$/);
    if (ublMatch) {
      return `${ublMatch[2]} (${ublMatch[3]})`;
    }

    // Handle PEPPOL BIS format
    const bisMatch = documentId.match(/urn:peppol:bis:billing:([^:]+):(.+)$/);
    if (bisMatch) {
      return `PEPPOL BIS ${bisMatch[1]} ${bisMatch[2]}`;
    }

    // Return last part after last colon or the whole ID
    const parts = documentId.split('::');
    return parts[parts.length - 1] || documentId;
  }

  /**
   * Parses business card XML (if available from SMP extension)
   */
  parseBusinessCard(xml: string): {
    name?: string;
    countryCode?: string;
    identifiers?: Array<{ scheme: string; value: string }>;
  } | null {
    // Look for BusinessCard element
    const cardMatch = xml.match(/<BusinessCard[^>]*>([\s\S]*?)<\/BusinessCard>/);
    if (!cardMatch) {
      return null;
    }

    const cardXml = cardMatch[1];

    return {
      name: this.extractText(cardXml, 'Name'),
      countryCode: this.extractText(cardXml, 'CountryCode'),
      identifiers: this.extractIdentifiers(cardXml)
    };
  }

  /**
   * Extracts identifiers from business card
   */
  private extractIdentifiers(xml: string): Array<{ scheme: string; value: string }> {
    const identifiers: Array<{ scheme: string; value: string }> = [];
    const idRegex = /<Identifier[^>]*scheme="([^"]+)"[^>]*>([^<]+)</g;
    let match;

    while ((match = idRegex.exec(xml)) !== null) {
      identifiers.push({
        scheme: match[1],
        value: match[2].trim()
      });
    }

    return identifiers;
  }
}
