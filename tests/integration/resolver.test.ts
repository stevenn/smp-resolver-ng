import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SMPResolver } from '../../src/resolver.js';

// Mock DNS and HTTP for predictable tests
vi.mock('../../src/dns/naptr-resolver', () => ({
  NAPTRResolver: vi.fn().mockImplementation(() => ({
    lookupSMP: vi.fn().mockImplementation((hash, _domain) => {
      // Mock known test cases - using the actual hash from our implementation
      if (hash === 'cmorzb6cpx7e4wldnu4zxrmczeqaiacq4qds2x7zi5ki4nsxxfma') {
        return Promise.resolve('http://smp-test.example.com');
      }
      return Promise.resolve(null);
    })
  }))
}));

vi.mock('../../src/http/http-client', () => ({
  HTTPClient: vi.fn().mockImplementation(() => ({
    close: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../../src/http/redirect-handler', () => ({
  RedirectHandler: vi.fn().mockImplementation(() => ({
    followRedirects: vi.fn().mockImplementation((url: string) => {
      // Mock ServiceGroup response
      if (url.includes('/iso6523-actorid-upis::')) {
        return Promise.resolve({
          statusCode: 200,
          body: `<?xml version="1.0" encoding="UTF-8"?>
<ServiceGroup xmlns="http://busdox.org/serviceMetadata/publishing/1.0/">
  <ParticipantIdentifier scheme="iso6523-actorid-upis">0208:0843766574</ParticipantIdentifier>
  <ServiceMetadataReferenceCollection>
    <ServiceMetadataReference href="http://smp-test.example.com/iso6523-actorid-upis::0208:0843766574/services/busdox-docid-qns::invoice"/>
  </ServiceMetadataReferenceCollection>
</ServiceGroup>`,
          finalUrl: url,
          redirectCount: 0
        });
      }

      // Mock ServiceMetadata response
      if (url.includes('/services/')) {
        return Promise.resolve({
          statusCode: 200,
          body: `<?xml version="1.0" encoding="UTF-8"?>
<ServiceMetadata xmlns="http://busdox.org/serviceMetadata/publishing/1.0/">
  <ServiceInformation>
    <ParticipantIdentifier scheme="iso6523-actorid-upis">0208:0843766574</ParticipantIdentifier>
    <DocumentIdentifier scheme="busdox-docid-qns">invoice</DocumentIdentifier>
    <ProcessList>
      <Process>
        <ProcessIdentifier scheme="test">billing</ProcessIdentifier>
        <ServiceEndpointList>
          <Endpoint transportProfile="peppol-transport-as4-v2_0">
            <EndpointURI>https://as4-test.example.com/as4</EndpointURI>
          </Endpoint>
        </ServiceEndpointList>
      </Process>
    </ProcessList>
  </ServiceInformation>
</ServiceMetadata>`,
          finalUrl: url,
          redirectCount: 0
        });
      }

      // Mock business card response - check multiple patterns
      if (url.includes('/businesscard/') || url.includes('/businesscard')) {
        return Promise.resolve({
          statusCode: 200,
          body: `<?xml version="1.0" encoding="UTF-8"?>
<BusinessCard xmlns="http://docs.oasis-open.org/bdxr/ns/SMP/2016/05">
  <ParticipantIdentifier scheme="iso6523-actorid-upis">0208:0843766574</ParticipantIdentifier>
  <BusinessEntity>
    <Name>Test Company</Name>
    <CountryCode>BE</CountryCode>
    <Identifier scheme="0208">0843766574</Identifier>
  </BusinessEntity>
</BusinessCard>`,
          finalUrl: url,
          redirectCount: 0
        });
      }

      return Promise.resolve({
        statusCode: 404,
        body: '',
        finalUrl: url,
        redirectCount: 0
      });
    })
  }))
}));

describe('SMPResolver Integration Tests', () => {
  let resolver: SMPResolver;

  beforeAll(() => {
    resolver = new SMPResolver({
      smlDomain: 'test.example.com'
    });
  });

  afterAll(async () => {
    await resolver.close();
  });

  describe('resolve', () => {
    it('should resolve a registered participant', async () => {
      const result = await resolver.resolve('0208:0843766574');

      expect(result.isRegistered).toBe(true);
      expect(result.participantId).toBe('0208:0843766574');
      // Note: smpHostname is only included when fetchDocumentTypes or includeBusinessCard is true
    });

    it('should handle unregistered participant', async () => {
      const result = await resolver.resolve('0208:9999999999');

      expect(result.isRegistered).toBe(false);
      expect(result.error).toContain('No SMP found');
    });

    it('should validate participant ID format', async () => {
      const result = await resolver.resolve('invalid-format');

      expect(result.isRegistered).toBe(false);
      expect(result.error).toContain('Invalid participant ID format');
    });

    it('should fetch document types when requested', async () => {
      const result = await resolver.resolve('0208:0843766574', {
        fetchDocumentTypes: true
      });

      expect(result.isRegistered).toBe(true);
      expect(result.documentTypes).toBeDefined();
      expect(result.documentTypes).toHaveLength(1);
    });
  });

  describe('resolveParticipant', () => {
    it('should auto-detect Belgian KBO scheme', async () => {
      const result = await resolver.resolveParticipant('0843766574');

      expect(result.isRegistered).toBe(true);
      expect(result.participantId).toBe('0208:0843766574');
    });

    it('should handle both KBO and VAT schemes', async () => {
      const result = await resolver.resolveParticipant('BE0843766574');

      // Should try KBO first, succeed, and return with KBO participant ID
      expect(result.isRegistered).toBe(true);
      // The participantId in the response is the one that succeeded
      expect(result.participantId).toBe('0208:0843766574');
    });
  });

  describe('getBusinessCard', () => {
    it.skip('should fetch business card information', async () => {
      const businessCard = await resolver.getBusinessCard('0208:0843766574');

      expect(businessCard.entity.name).toBe('Test Company');
      expect(businessCard.entity.countryCode).toBe('BE');
      expect(businessCard.entity.identifiers).toHaveLength(1);
      expect(businessCard.entity.identifiers[0]).toEqual({
        scheme: '0208',
        value: '0843766574'
      });
      expect(businessCard.smpHostname).toBe('smp-test.example.com');
    });

    it('should handle participant not registered', async () => {
      await expect(resolver.getBusinessCard('0208:9999999999')).rejects.toThrow(
        'Participant not registered'
      );
    });
  });

  describe('getEndpointUrls', () => {
    it.skip('should fetch endpoint URLs', async () => {
      const endpoints = await resolver.getEndpointUrls('0208:0843766574');

      expect(endpoints.smpHostname).toBe('smp-test.example.com');
      expect(endpoints.endpoint).toBeDefined();
      expect(endpoints.endpoint?.url).toBe('https://as4-test.example.com/as4');
      expect(endpoints.endpoint?.transportProfile).toBe('peppol-transport-as4-v2_0');
    });
  });

  describe('resolveBatch', () => {
    it('should process multiple participants', async () => {
      const participantIds = ['0208:0843766574', '0208:9999999999'];

      const results = await resolver.resolveBatch(participantIds);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].smpHostname).toBe('smp-test.example.com');
      expect(results[1].success).toBe(false);
      expect(results[1].errorMessage).toContain('No SMP found');
    });

    it('should call progress callback', async () => {
      const participantIds = ['0208:0843766574', '0208:9999999999'];
      const progressCallback = vi.fn();

      await resolver.resolveBatch(participantIds, {
        onProgress: progressCallback
      });

      expect(progressCallback).toHaveBeenCalledWith(2, 2);
    });
  });
});
