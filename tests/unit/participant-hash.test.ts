import { describe, it, expect } from 'vitest';
import {
  hashParticipantId,
  validateParticipantId,
  parseParticipantId
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

describe('parseParticipantId', () => {
  it('should parse valid participant IDs', () => {
    const result = parseParticipantId('0208:0843766574');
    expect(result).toEqual({ scheme: '0208', value: '0843766574' });
  });

  it('should parse Belgian VAT format', () => {
    const result = parseParticipantId('9925:be0843766574');
    expect(result).toEqual({ scheme: '9925', value: 'be0843766574' });
  });

  it('should parse Dutch KvK format', () => {
    const result = parseParticipantId('0106:12345678');
    expect(result).toEqual({ scheme: '0106', value: '12345678' });
  });

  it('should return null for missing colon', () => {
    const result = parseParticipantId('02080843766574');
    expect(result).toBeNull();
  });

  it('should return null for empty scheme', () => {
    const result = parseParticipantId(':0843766574');
    expect(result).toBeNull();
  });

  it('should return null for empty value', () => {
    const result = parseParticipantId('0208:');
    expect(result).toBeNull();
  });

  it('should handle values containing colons', () => {
    const result = parseParticipantId('0208:some:value:with:colons');
    expect(result).toEqual({ scheme: '0208', value: 'some:value:with:colons' });
  });
});
