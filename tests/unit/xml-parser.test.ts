import { describe, it, expect } from 'vitest';
import { XMLParser } from '../../src/xml/parser.js';

describe('XMLParser', () => {
  const parser = new XMLParser();

  describe('parseServiceGroup', () => {
    it('should parse ServiceGroup XML correctly', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ServiceGroup xmlns="http://busdox.org/serviceMetadata/publishing/1.0/">
  <ParticipantIdentifier scheme="iso6523-actorid-upis">0208:0843766574</ParticipantIdentifier>
  <ServiceMetadataReferenceCollection>
    <ServiceMetadataReference href="http://smp.example.com/iso6523-actorid-upis::0208:0843766574/services/busdox-docid-qns::urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1"/>
    <ServiceMetadataReference href="http://smp.example.com/iso6523-actorid-upis::0208:0843766574/services/busdox-docid-qns::urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1"/>
  </ServiceMetadataReferenceCollection>
</ServiceGroup>`;

      const result = parser.parseServiceGroup(xml);
      
      expect(result.participantIdentifier.scheme).toBe('iso6523-actorid-upis');
      expect(result.participantIdentifier.value).toBe('0208:0843766574');
      expect(result.serviceReferences).toHaveLength(2);
      expect(result.serviceReferences[0]).toContain('Invoice');
      expect(result.serviceReferences[1]).toContain('CreditNote');
    });

    it('should handle empty ServiceMetadataReferenceCollection', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ServiceGroup xmlns="http://busdox.org/serviceMetadata/publishing/1.0/">
  <ParticipantIdentifier scheme="iso6523-actorid-upis">0208:0843766574</ParticipantIdentifier>
  <ServiceMetadataReferenceCollection/>
</ServiceGroup>`;

      const result = parser.parseServiceGroup(xml);
      expect(result.serviceReferences).toHaveLength(0);
    });
  });

  describe('parseServiceMetadata', () => {
    it('should parse ServiceMetadata with endpoints', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ServiceMetadata xmlns="http://busdox.org/serviceMetadata/publishing/1.0/">
  <ServiceInformation>
    <ParticipantIdentifier scheme="iso6523-actorid-upis">0208:0843766574</ParticipantIdentifier>
    <DocumentIdentifier scheme="busdox-docid-qns">urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1</DocumentIdentifier>
    <ProcessList>
      <Process>
        <ProcessIdentifier scheme="cenbii-procid-ubl">urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</ProcessIdentifier>
        <ServiceEndpointList>
          <Endpoint transportProfile="peppol-transport-as4-v2_0">
            <EndpointURI>https://as4.example.com/as4</EndpointURI>
            <Certificate>base64certificate</Certificate>
            <ServiceActivationDate>2020-01-01</ServiceActivationDate>
            <ServiceExpirationDate>2025-01-01</ServiceExpirationDate>
            <TechnicalContactUrl>https://example.com/contact</TechnicalContactUrl>
            <TechnicalInformationUrl>https://example.com/info</TechnicalInformationUrl>
          </Endpoint>
        </ServiceEndpointList>
      </Process>
    </ProcessList>
  </ServiceInformation>
</ServiceMetadata>`;

      const result = parser.parseServiceMetadata(xml);
      
      expect(result.documentTypes).toHaveLength(1);
      
      const docType = result.documentTypes[0];
      expect(docType.documentIdentifier.value).toContain('Invoice');
      expect(docType.processes).toHaveLength(1);
      
      const process = docType.processes[0];
      expect(process.processIdentifier.value).toContain('billing');
      expect(process.endpoints).toHaveLength(1);
      
      const endpoint = process.endpoints[0];
      expect(endpoint.transportProfile).toBe('peppol-transport-as4-v2_0');
      expect(endpoint.endpointUrl).toBe('https://as4.example.com/as4');
      expect(endpoint.certificate).toBe('base64certificate');
      expect(endpoint.technicalContactUrl).toBe('https://example.com/contact');
      expect(endpoint.technicalInformationUrl).toBe('https://example.com/info');
    });

    it('should handle namespaced XML elements', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:ServiceMetadata xmlns:ns2="http://busdox.org/serviceMetadata/publishing/1.0/">
  <ns2:ServiceInformation>
    <ns2:ParticipantIdentifier scheme="iso6523-actorid-upis">0208:0843766574</ns2:ParticipantIdentifier>
    <ns2:DocumentIdentifier scheme="busdox-docid-qns">test-doc-id</ns2:DocumentIdentifier>
    <ns2:ProcessList>
      <ns2:Process>
        <ns2:ProcessIdentifier scheme="test">test-process</ns2:ProcessIdentifier>
        <ns2:ServiceEndpointList>
          <ns2:Endpoint transportProfile="peppol-transport-as4-v2_0">
            <ns2:EndpointURI>https://test.com/as4</ns2:EndpointURI>
          </ns2:Endpoint>
        </ns2:ServiceEndpointList>
      </ns2:Process>
    </ns2:ProcessList>
  </ns2:ServiceInformation>
</ns2:ServiceMetadata>`;

      const result = parser.parseServiceMetadata(xml);
      expect(result.documentTypes[0].processes[0].endpoints[0].endpointUrl).toBe('https://test.com/as4');
    });
  });

  describe('error handling', () => {
    it('should handle malformed XML gracefully', () => {
      const malformedXml = '<invalid>not closed';
      
      expect(() => parser.parseServiceGroup(malformedXml)).toThrow();
      expect(() => parser.parseServiceMetadata(malformedXml)).toThrow();
    });

    it('should handle missing required elements', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ServiceGroup xmlns="http://busdox.org/serviceMetadata/publishing/1.0/">
</ServiceGroup>`;

      expect(() => parser.parseServiceGroup(xml)).toThrow('Invalid ServiceGroup XML: missing ParticipantIdentifier');
    });
  });
});