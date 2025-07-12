import { SMPResolver } from '@stevenn/smp-resolver-ng';

// Create resolver instance
const resolver = new SMPResolver();

// Example 1: Simple participant lookup
async function basicLookup() {
  const result = await resolver.resolve('0208:0843766574');
  console.log(result);
  // Output: { participantId: '0208:0843766574', isRegistered: true, ... }
}

// Example 2: Auto-detect Belgian schemes
async function autoDetect() {
  // Will try both KBO (0208) and VAT (9925) schemes
  const result = await resolver.resolveParticipant('0843766574');
  console.log(result);
}

// Example 3: Get business card information
async function getBusinessCard() {
  const businessCard = await resolver.getBusinessCard('0208:0843766574');
  console.log(businessCard.entity.name); // Company name
  console.log(businessCard.smpHostname); // SMP server
}

// Example 4: Get endpoint URLs for bulk processing
async function getEndpoints() {
  const endpoints = await resolver.getEndpointUrls('0208:0843766574');
  console.log(endpoints.endpoint?.url); // AS4 endpoint URL
}

// Example 5: Batch processing
async function batchProcess() {
  const participantIds = [
    '0208:0843766574',
    '0208:0755752833',
    '0208:0848934496'
  ];
  
  const results = await resolver.resolveBatch(participantIds, {
    concurrency: 20,
    onProgress: (done, total) => {
      console.log(`Progress: ${done}/${total}`);
    }
  });
  
  console.log(results);
}

// Don't forget to close the resolver when done
async function main() {
  await basicLookup();
  await resolver.close();
}

main().catch(console.error);