import { XMLParser as FastXMLParser } from 'fast-xml-parser';
import type {
  ServiceEndpoint,
  Process,
  DocumentType,
  ParticipantIdentifier
} from '../types/index.js';

/**
 * Robust XML parser for PEPPOL SMP responses
 * Uses fast-xml-parser for standards-compliant XML parsing
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
export class XMLParser {
  private parser: FastXMLParser;

  constructor() {
    // Configure fast-xml-parser for PEPPOL XML structures
    this.parser = new FastXMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      removeNSPrefix: false,
      allowBooleanAttributes: true,
      parseAttributeValue: true,
      trimValues: true
    });
  }
  /**
   * Parses ServiceGroup XML response
   */
  parseServiceGroup(xml: string): {
    participantIdentifier: ParticipantIdentifier;
    serviceReferences: string[];
  } {
    try {
      const parsed = this.parser.parse(xml);

      // Find ServiceGroup root element (handle namespaces)
      const serviceGroup = this.findElement(parsed, 'ServiceGroup');
      if (!serviceGroup) {
        throw new Error('Invalid ServiceGroup XML: missing ServiceGroup element');
      }

      // Extract ParticipantIdentifier
      const participantElement = this.findElement(serviceGroup, 'ParticipantIdentifier');
      if (!participantElement) {
        throw new Error('Invalid ServiceGroup XML: missing ParticipantIdentifier');
      }

      const participantIdentifier: ParticipantIdentifier = {
        scheme: this.getAttribute(participantElement, 'scheme') || '',
        value: this.getTextContent(participantElement) || ''
      };

      if (!participantIdentifier.scheme || !participantIdentifier.value) {
        throw new Error('Invalid ParticipantIdentifier: missing scheme or value');
      }

      // Extract service references
      const serviceReferences: string[] = [];
      const metadataCollection = this.findElement(
        serviceGroup,
        'ServiceMetadataReferenceCollection'
      );

      if (metadataCollection) {
        const references = this.findElements(metadataCollection, 'ServiceMetadataReference');
        for (const ref of references) {
          const href = this.getAttribute(ref, 'href');
          if (href) {
            serviceReferences.push(href);
          }
        }
      }

      return {
        participantIdentifier,
        serviceReferences
      };
    } catch (error) {
      throw new Error(
        `Failed to parse ServiceGroup XML: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parses SignedServiceMetadata XML response
   */
  parseServiceMetadata(xml: string): {
    documentTypes: DocumentType[];
    redirect?: string;
  } {
    try {
      const parsed = this.parser.parse(xml);

      // Find ServiceMetadata root element
      const serviceMetadata =
        this.findElement(parsed, 'ServiceMetadata') ||
        this.findElement(parsed, 'SignedServiceMetadata');
      if (!serviceMetadata) {
        throw new Error('Invalid ServiceMetadata XML: missing ServiceMetadata element');
      }

      // Check for redirect
      const redirectElement = this.findElement(serviceMetadata, 'Redirect');
      if (redirectElement) {
        const redirectHref = this.getAttribute(redirectElement, 'href');
        if (redirectHref) {
          return {
            documentTypes: [],
            redirect: redirectHref
          };
        }
      }

      // Find ServiceInformation element
      const serviceInfo = this.findElement(serviceMetadata, 'ServiceInformation');
      if (!serviceInfo) {
        throw new Error('Invalid ServiceMetadata XML: missing ServiceInformation');
      }

      // Extract document identifier
      const docElement = this.findElement(serviceInfo, 'DocumentIdentifier');
      if (!docElement) {
        throw new Error('Invalid ServiceMetadata XML: missing DocumentIdentifier');
      }

      const documentIdentifier = {
        scheme: this.getAttribute(docElement, 'scheme') || '',
        value: this.getTextContent(docElement) || ''
      };

      if (!documentIdentifier.scheme || !documentIdentifier.value) {
        throw new Error('Invalid DocumentIdentifier: missing scheme or value');
      }

      // Parse processes
      const processes = this.parseProcessesFromParsedXML(serviceInfo);

      const documentType: DocumentType = {
        documentIdentifier,
        friendlyName: this.extractFriendlyName(documentIdentifier.value),
        processes
      };

      return {
        documentTypes: [documentType]
      };
    } catch (error) {
      throw new Error(
        `Failed to parse ServiceMetadata XML: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parses all Process elements from ServiceMetadata (now uses proper XML parsing)
   */
  private parseProcesses(xml: string): Process[] {
    try {
      const parsed = this.parser.parse(xml);
      const serviceInfo = this.findElement(parsed, 'ServiceInformation');
      if (serviceInfo) {
        return this.parseProcessesFromParsedXML(serviceInfo);
      }
    } catch {
      // Return empty array if parsing fails
    }
    return [];
  }

  /**
   * Parses all Process elements from parsed ServiceInformation XML
   */
  private parseProcessesFromParsedXML(serviceInfo: any): Process[] {
    const processes: Process[] = [];

    // Find ProcessList
    const processList = this.findElement(serviceInfo, 'ProcessList');
    if (!processList) {
      return processes;
    }

    // Find all Process elements
    const processElements = this.findElements(processList, 'Process');

    for (const processElement of processElements) {
      // Extract process identifier
      const pidElement = this.findElement(processElement, 'ProcessIdentifier');
      if (!pidElement) continue;

      const processIdentifier = {
        scheme: this.getAttribute(pidElement, 'scheme') || '',
        value: this.getTextContent(pidElement) || ''
      };

      if (!processIdentifier.scheme || !processIdentifier.value) continue;

      // Parse endpoints
      const endpoints = this.parseEndpointsFromParsedXML(processElement);

      processes.push({
        processIdentifier,
        endpoints
      });
    }

    return processes;
  }

  /**
   * Parses all Endpoint elements from a Process (now uses proper XML parsing)
   */
  private parseEndpoints(xml: string): ServiceEndpoint[] {
    try {
      const parsed = this.parser.parse(xml);
      const processElement = this.findElement(parsed, 'Process');
      if (processElement) {
        return this.parseEndpointsFromParsedXML(processElement);
      }
    } catch {
      // Return empty array if parsing fails
    }
    return [];
  }

  /**
   * Parses all Endpoint elements from a parsed Process element
   */
  private parseEndpointsFromParsedXML(processElement: any): ServiceEndpoint[] {
    const endpoints: ServiceEndpoint[] = [];

    // Find ServiceEndpointList
    const endpointList = this.findElement(processElement, 'ServiceEndpointList');
    if (!endpointList) {
      return endpoints;
    }

    // Find all Endpoint elements
    const endpointElements = this.findElements(endpointList, 'Endpoint');

    for (const endpointElement of endpointElements) {
      const transportProfile = this.getAttribute(endpointElement, 'transportProfile');
      if (!transportProfile) continue;

      // Extract endpoint URL (try both EndpointURI and Address)
      let endpointUrl = this.getElementText(endpointElement, 'EndpointURI');
      if (!endpointUrl) {
        endpointUrl = this.getElementText(endpointElement, 'Address');
      }

      if (!endpointUrl) continue;

      const endpoint: ServiceEndpoint = {
        transportProfile,
        endpointUrl,
        requireBusinessLevelSignature: this.getElementBoolean(
          endpointElement,
          'RequireBusinessLevelSignature'
        ),
        certificate: this.getElementText(endpointElement, 'Certificate'),
        serviceDescription: this.getElementText(endpointElement, 'ServiceDescription'),
        technicalContactUrl: this.getElementText(endpointElement, 'TechnicalContactUrl'),
        technicalInformationUrl: this.getElementText(endpointElement, 'TechnicalInformationUrl')
      };

      // Parse dates if present
      const activationDate = this.getElementText(endpointElement, 'ServiceActivationDate');
      if (activationDate) {
        try {
          endpoint.serviceActivationDate = new Date(activationDate);
        } catch {
          // Invalid date format, skip
        }
      }

      const expirationDate = this.getElementText(endpointElement, 'ServiceExpirationDate');
      if (expirationDate) {
        try {
          endpoint.serviceExpirationDate = new Date(expirationDate);
        } catch {
          // Invalid date format, skip
        }
      }

      endpoints.push(endpoint);
    }

    return endpoints;
  }

  /**
   * Gets text content from a child element using proper XML parsing
   */
  private getElementText(parentElement: any, elementName: string): string | undefined {
    const element = this.findElement(parentElement, elementName);
    if (!element) {
      return undefined;
    }

    const text = this.getTextContent(element);
    return text || undefined;
  }

  /**
   * Gets boolean value from a child element using proper XML parsing
   */
  private getElementBoolean(parentElement: any, elementName: string): boolean {
    const text = this.getElementText(parentElement, elementName);
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
    try {
      const parsed = this.parser.parse(xml);

      // Find BusinessCard root element
      const businessCard = this.findElement(parsed, 'BusinessCard');
      if (!businessCard) {
        return null;
      }

      // Find BusinessEntity element
      const businessEntity = this.findElement(businessCard, 'BusinessEntity');
      if (!businessEntity) {
        return null;
      }

      return {
        name: this.getElementText(businessEntity, 'Name'),
        countryCode: this.getElementText(businessEntity, 'CountryCode'),
        identifiers: this.extractIdentifiersFromParsedXML(businessEntity)
      };
    } catch {
      // If parsing fails, return null (business card is optional)
      return null;
    }
  }

  /**
   * Extracts identifiers from parsed business entity XML
   */
  private extractIdentifiersFromParsedXML(
    businessEntity: any
  ): Array<{ scheme: string; value: string }> {
    const identifiers: Array<{ scheme: string; value: string }> = [];

    // Find all Identifier elements
    const identifierElements = this.findElements(businessEntity, 'Identifier');

    for (const identifierElement of identifierElements) {
      const scheme = this.getAttribute(identifierElement, 'scheme');
      const value = this.getTextContent(identifierElement);

      if (scheme && value) {
        identifiers.push({
          scheme,
          value
        });
      }
    }

    return identifiers;
  }

  /**
   * Helper method to find an element by name, handling namespaces
   */
  private findElement(obj: any, elementName: string): any {
    if (!obj || typeof obj !== 'object') {
      return null;
    }

    // Check direct match
    if (obj[elementName]) {
      return obj[elementName];
    }

    // Check with namespaces (e.g., 'ns:ElementName')
    for (const key in obj) {
      if (key.includes(':') && key.split(':').pop() === elementName) {
        return obj[key];
      }
    }

    // Recursively search in nested objects
    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        const found = this.findElement(obj[key], elementName);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  /**
   * Helper method to find multiple elements by name, handling namespaces
   */
  private findElements(obj: any, elementName: string): any[] {
    if (!obj || typeof obj !== 'object') {
      return [];
    }

    const elements: any[] = [];

    // Check direct match
    if (obj[elementName]) {
      // Handle both single elements and arrays
      if (Array.isArray(obj[elementName])) {
        elements.push(...obj[elementName]);
      } else {
        elements.push(obj[elementName]);
      }
    }

    // Check with namespaces
    for (const key in obj) {
      if (key.includes(':') && key.split(':').pop() === elementName) {
        if (Array.isArray(obj[key])) {
          elements.push(...obj[key]);
        } else {
          elements.push(obj[key]);
        }
      }
    }

    return elements;
  }

  /**
   * Helper method to get attribute value, handling the @_ prefix
   */
  private getAttribute(element: any, attributeName: string): string | null {
    if (!element || typeof element !== 'object') {
      return null;
    }

    // Try with @_ prefix (fast-xml-parser format)
    const prefixedName = `@_${attributeName}`;
    if (element[prefixedName] !== undefined) {
      return String(element[prefixedName]);
    }

    // Try without prefix (fallback)
    if (element[attributeName] !== undefined) {
      return String(element[attributeName]);
    }

    return null;
  }

  /**
   * Helper method to get text content from an element
   */
  private getTextContent(element: any): string | null {
    if (element === null || element === undefined) {
      return null;
    }

    // If it's a string or number, return it directly
    if (typeof element === 'string' || typeof element === 'number') {
      return String(element);
    }

    // If it's an object with #text property (mixed content)
    if (typeof element === 'object' && element['#text'] !== undefined) {
      return String(element['#text']);
    }

    // If it's an object with only text content (no attributes)
    if (typeof element === 'object') {
      const keys = Object.keys(element);
      if (keys.length === 1 && !keys[0].startsWith('@_')) {
        return String(element[keys[0]]);
      }
    }

    return null;
  }
}
