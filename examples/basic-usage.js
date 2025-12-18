import { SMPResolver } from '@stevenn/smp-resolver-ng';

// Create resolver instance
const resolver = new SMPResolver();

// Example 1: Simple participant lookup
async function basicLookup() {
  console.log('=== Basic Lookup ===');
  const result = await resolver.resolve('0208:0843766574');
  console.log('Participant ID:', result.participantId);
  console.log('Registered:', result.isRegistered);
  console.log('Status:', result.registrationStatus);
  console.log();
}

// Example 2: DNS-only lookup (lightweight, no HTTP calls)
async function dnsOnlyLookup() {
  console.log('=== DNS-Only Lookup ===');
  const lookup = await resolver.lookupSMP('0208:0843766574');
  console.log('Participant ID:', lookup.participantId);
  console.log('Hash:', lookup.hash);
  console.log('SMP URL:', lookup.smpUrl);
  console.log('SMP Hostname:', lookup.smpHostname);
  console.log();
}

// Example 3: Verbose lookup with document types
async function verboseLookup() {
  console.log('=== Verbose Lookup ===');
  const result = await resolver.resolve('0208:0843766574', {
    fetchDocumentTypes: true
  });
  console.log('SMP Hostname:', result.smpHostname);
  console.log('Document Types:', result.documentTypes);
  console.log('Endpoint URL:', result.endpoint?.url);
  console.log();
}

// Example 4: Get business card information
async function getBusinessCard() {
  console.log('=== Business Card ===');
  const businessCard = await resolver.getBusinessCard('0208:0843766574');
  console.log('Company Name:', businessCard.entity.name);
  console.log('Country:', businessCard.entity.countryCode);
  console.log('SMP Hostname:', businessCard.smpHostname);
  console.log();
}

// Example 5: Get endpoint URLs
async function getEndpoints() {
  console.log('=== Endpoint URLs ===');
  const endpoints = await resolver.getEndpointUrls('0208:0843766574');
  console.log('SMP Hostname:', endpoints.smpHostname);
  console.log('AS4 URL:', endpoints.endpoint?.url);
  console.log('Transport Profile:', endpoints.endpoint?.transportProfile);
  console.log();
}

// Example 6: Certificate parsing
async function getCertificateInfo() {
  console.log('=== Certificate Info ===');
  const result = await resolver.resolve('0208:0843766574', {
    fetchDocumentTypes: true,
    parseCertificate: true
  });
  if (result.certificateInfo) {
    console.log('SeatID:', result.certificateInfo.seatId);
    console.log('Subject:', result.certificateInfo.subjectDN);
    console.log('Valid Until:', result.certificateInfo.notAfter);
    console.log('Expired:', result.certificateInfo.isExpired);
  }
  console.log();
}

// Run all examples
async function main() {
  try {
    await basicLookup();
    await dnsOnlyLookup();
    await verboseLookup();
    await getBusinessCard();
    await getEndpoints();
    await getCertificateInfo();
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await resolver.close();
  }
}

main();
