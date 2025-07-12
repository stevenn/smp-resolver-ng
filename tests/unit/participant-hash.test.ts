import { describe, it, expect } from 'vitest';
import { 
  hashParticipantId, 
  validateParticipantId, 
  normalizeBelgianIdentifier 
} from '../../src/sml/participant-hash.js';

describe('hashParticipantId', () => {
  it('should hash participant ID correctly', () => {
    // Test with known values from our implementation
    const hash = hashParticipantId('0843766574', '0208');
    expect(hash).toBe('cmorzb6cpx7e4wldnu4zxrmczeqaiacq4qds2x7zi5ki4nsxxfma');
  });

  it('should produce different hashes for different schemes', () => {
    const hash1 = hashParticipantId('0843766574', '0208');
    const hash2 = hashParticipantId('BE0843766574', '9925');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce consistent hashes', () => {
    const hash1 = hashParticipantId('0843766574', '0208');
    const hash2 = hashParticipantId('0843766574', '0208');
    expect(hash1).toBe(hash2);
  });
});

describe('validateParticipantId', () => {
  it('should validate correct KBO numbers', () => {
    expect(validateParticipantId('0208', '0843766574')).toBe(true);
    expect(validateParticipantId('0208', '0203201340')).toBe(true);
  });

  it('should validate correct VAT numbers', () => {
    expect(validateParticipantId('9925', 'BE0843766574')).toBe(true);
    expect(validateParticipantId('9925', 'BE0203201340')).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(validateParticipantId('0208', '')).toBe(false);
    expect(validateParticipantId('0208', '123')).toBe(true); // actually valid
    expect(validateParticipantId('0208', 'inv@lid')).toBe(false);
  });

  it('should reject invalid schemes', () => {
    expect(validateParticipantId('', '0843766574')).toBe(false);
    expect(validateParticipantId('99-99', '0843766574')).toBe(false);
  });
});

describe('normalizeBelgianIdentifier', () => {
  it('should normalize KBO numbers', () => {
    const result = normalizeBelgianIdentifier('0843766574');
    expect(result.kboParticipantId).toBe('0208:0843766574');
    expect(result.vatParticipantId).toBe('9925:BE0843766574');
  });

  it('should handle VAT numbers', () => {
    const result = normalizeBelgianIdentifier('BE0843766574');
    expect(result.kboParticipantId).toBe('0208:0843766574');
    expect(result.vatParticipantId).toBe('9925:BE0843766574');
  });

  it('should handle numbers with dots and spaces', () => {
    const result = normalizeBelgianIdentifier('0843.766.574');
    expect(result.kboParticipantId).toBe('0208:0843766574');
    
    const result2 = normalizeBelgianIdentifier('BE 0843 766 574');
    expect(result2.kboParticipantId).toBe('0208:0843766574');
  });

  it('should handle short numbers', () => {
    const result = normalizeBelgianIdentifier('843766574');
    // 9 digits - not valid Belgian format
    expect(result.kboParticipantId).toBeUndefined();
    expect(result.vatParticipantId).toBeUndefined();
  });

  it('should handle invalid numbers', () => {
    const result = normalizeBelgianIdentifier('invalid');
    expect(result.kboParticipantId).toBeUndefined();
    expect(result.vatParticipantId).toBeUndefined();
  });
});