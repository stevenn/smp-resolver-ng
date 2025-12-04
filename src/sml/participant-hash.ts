import { createHash } from 'node:crypto';

/**
 * Hashes a participant ID according to PEPPOL SML specification.
 *
 * Process:
 * 1. Create canonical form (scheme:value)
 * 2. Apply SHA-256 hash
 * 3. Base32 encode the result
 * 4. Convert to lowercase
 * 5. Remove trailing '=' padding
 *
 * @param participantId The participant ID (without scheme prefix)
 * @param scheme The participant scheme (e.g., "0208")
 * @returns Base32 encoded hash in lowercase without padding
 */
export function hashParticipantId(participantId: string, scheme: string): string {
  // Step 1: Create canonical form
  const canonical = `${scheme}:${participantId}`;

  // Step 2: SHA-256 hash (no lowercase on input)
  const hash = createHash('sha256').update(canonical, 'utf8').digest();

  // Step 3: Base32 encode (RFC 4648)
  const base32 = base32Encode(hash);

  // Step 4: Convert to lowercase and remove trailing '=' padding
  return base32.toLowerCase().replace(/=+$/, '');
}

/**
 * Base32 encoding according to RFC 4648
 * Using the standard alphabet: ABCDEFGHIJKLMNOPQRSTUVWXYZ234567
 */
function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0;
  let value = 0;

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }

  // Handle remaining bits
  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 0x1f];
  }

  // Add padding
  while (result.length % 8 !== 0) {
    result += '=';
  }

  return result;
}

/**
 * Validates a participant identifier format
 * @param scheme The scheme ID (e.g., "0208", "9925")
 * @param value The participant value
 * @returns true if valid
 */
export function validateParticipantId(scheme: string, value: string): boolean {
  // Scheme must be alphanumeric and start with alphanumeric
  if (!/^[a-zA-Z0-9][a-zA-Z0-9]*$/.test(scheme)) {
    return false;
  }

  // Value must be non-empty
  if (!value || value.length === 0) {
    return false;
  }

  // Both must be valid DNS labels (no special chars except hyphen)
  const dnsLabelRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
  return dnsLabelRegex.test(value);
}

/**
 * Parses a fully-formed participant ID into scheme and value components
 * @param participantId Full participant ID in format "scheme:value" (e.g., "0208:0843766574")
 * @returns Object with scheme and value, or null if invalid format
 */
export function parseParticipantId(participantId: string): { scheme: string; value: string } | null {
  const colonIndex = participantId.indexOf(':');
  if (colonIndex === -1) {
    return null;
  }

  const scheme = participantId.substring(0, colonIndex);
  const value = participantId.substring(colonIndex + 1);

  if (!scheme || !value) {
    return null;
  }

  return { scheme, value };
}
