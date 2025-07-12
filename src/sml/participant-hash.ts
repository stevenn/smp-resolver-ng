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
 * Normalizes Belgian participant identifiers
 * @param identifier Raw identifier (could be VAT or KBO)
 * @returns Object with both KBO and VAT participant IDs
 */
export function normalizeBelgianIdentifier(identifier: string): {
  kboParticipantId?: string;
  vatParticipantId?: string;
  normalizedValue: string;
} {
  // Remove all non-digits
  const digits = identifier.replace(/\D/g, '');

  // Handle VAT format (BE prefix)
  if (identifier.toUpperCase().startsWith('BE') && digits.length === 10) {
    return {
      kboParticipantId: `0208:${digits}`,
      vatParticipantId: `9925:BE${digits}`,
      normalizedValue: digits
    };
  }

  // Handle 10-digit format (could be either)
  if (digits.length === 10) {
    return {
      kboParticipantId: `0208:${digits}`,
      vatParticipantId: `9925:BE${digits}`,
      normalizedValue: digits
    };
  }

  // Invalid format
  return {
    normalizedValue: digits
  };
}
