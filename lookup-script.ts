import { hashParticipantId } from './src/sml/participant-hash.js';
import { NAPTRResolver } from './src/dns/naptr-resolver.js';

const companyNumber = '0471497796';
const smlDomain = 'edelivery.tech.ec.europa.eu';

const resolver = new NAPTRResolver();

console.log(`Looking up SML registration for company: ${companyNumber}\n`);

// Define schemes with their correct participant ID formats
const lookups = [
  { scheme: '0208', participantId: companyNumber, description: 'Belgian KBO' },
  { scheme: '9925', participantId: `be${companyNumber}`, description: 'VAT' }
];

for (const { scheme, participantId, description } of lookups) {
  console.log(`\n=== Scheme ${scheme} (${description}) ===`);
  console.log(`Full participant ID: ${scheme}:${participantId}`);

  // Hash the participant ID
  const hash = hashParticipantId(participantId, scheme);
  console.log(`Participant hash: ${hash}`);

  // Construct DNS lookup domain
  const lookupDomain = `${hash}.iso6523-actorid-upis.${smlDomain}`;
  console.log(`DNS lookup domain: ${lookupDomain}`);

  try {
    // Perform SML lookup
    const smpUrl = await resolver.lookupSMP(hash, scheme, smlDomain);

    if (smpUrl) {
      console.log(`✓ Registered - SMP URL: ${smpUrl}`);
    } else {
      console.log(`✗ Not registered (no NAPTR records found)`);
    }
  } catch (error) {
    console.log(`✗ Lookup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log('\n');
