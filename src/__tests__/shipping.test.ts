/**
 * Tests for the calculateShipping() function in src/lib/shipping.ts
 */

import { calculateShipping } from '@/lib/shipping';

beforeEach(() => {
  console.log('[SHIPPING TESTS] Starting new test');
});

describe('calculateShipping — known zones', () => {
  it('returns Sydney Metro fee for postcode 2000', () => {
    const result = calculateShipping('2000');
    expect(result.zone).toBe('Sydney Metro');
    expect(result.fee).toBe(8.95);
    console.log('[PASS] Sydney Metro (2000):', result);
  });

  it('returns Melbourne Metro fee for postcode 3000', () => {
    const result = calculateShipping('3000');
    expect(result.zone).toBe('Melbourne Metro');
    expect(result.fee).toBe(8.95);
    console.log('[PASS] Melbourne Metro (3000):', result);
  });

  it('returns Brisbane Metro fee for postcode 4000', () => {
    const result = calculateShipping('4000');
    expect(result.zone).toBe('Brisbane Metro');
    expect(result.fee).toBe(8.95);
    console.log('[PASS] Brisbane Metro (4000):', result);
  });

  it('returns ACT fee for postcode 2600', () => {
    const result = calculateShipping('2600');
    expect(result.zone).toBe('ACT');
    expect(result.fee).toBe(9.95);
    console.log('[PASS] ACT (2600):', result);
  });

  it('returns NSW state fee for a regional NSW postcode (2500)', () => {
    const result = calculateShipping('2500');
    expect(result.zone).toBe('New South Wales');
    expect(result.fee).toBe(11.95);
    console.log('[PASS] NSW regional (2500):', result);
  });

  it('returns VIC state fee for a regional VIC postcode (3500)', () => {
    const result = calculateShipping('3500');
    expect(result.zone).toBe('Victoria');
    expect(result.fee).toBe(11.95);
    console.log('[PASS] VIC regional (3500):', result);
  });

  it('returns SA fee for postcode 5000', () => {
    const result = calculateShipping('5000');
    expect(result.zone).toBe('South Australia');
    expect(result.fee).toBe(12.95);
    console.log('[PASS] SA (5000):', result);
  });

  it('returns WA fee for postcode 6000', () => {
    const result = calculateShipping('6000');
    expect(result.zone).toBe('Western Australia');
    expect(result.fee).toBe(14.95);
    console.log('[PASS] WA (6000):', result);
  });

  it('returns TAS fee for postcode 7000', () => {
    const result = calculateShipping('7000');
    expect(result.zone).toBe('Tasmania');
    expect(result.fee).toBe(13.95);
    console.log('[PASS] TAS (7000):', result);
  });

  it('returns NT fee for postcode 0800', () => {
    const result = calculateShipping('0800');
    expect(result.zone).toBe('Northern Territory');
    expect(result.fee).toBe(15.95);
    console.log('[PASS] NT (0800):', result);
  });
});

describe('calculateShipping — specificity (metro over state)', () => {
  it('returns Sydney Metro (more specific) for 2100, not generic NSW', () => {
    const result = calculateShipping('2100');
    expect(result.zone).toBe('Sydney Metro');
    console.log('[PASS] 2100 resolves to Sydney Metro, not NSW:', result.zone);
  });

  it('returns Melbourne Metro for 3100, not generic Victoria', () => {
    const result = calculateShipping('3100');
    expect(result.zone).toBe('Melbourne Metro');
    console.log('[PASS] 3100 resolves to Melbourne Metro:', result.zone);
  });
});

describe('calculateShipping — result shape', () => {
  it('always returns zone, fee, and estimatedDays fields', () => {
    const result = calculateShipping('2000');
    expect(typeof result.zone).toBe('string');
    expect(typeof result.fee).toBe('number');
    expect(typeof result.estimatedDays).toBe('string');
    console.log('[PASS] Result shape correct:', Object.keys(result));
  });

  it('fee is always a non-negative number', () => {
    const postcodes = ['2000', '3000', '4000', '5000', '6000', '7000', '0800', '9999'];
    postcodes.forEach(pc => {
      const result = calculateShipping(pc);
      expect(result.fee).toBeGreaterThanOrEqual(0);
    });
    console.log('[PASS] All test postcodes return non-negative fees');
  });
});

describe('calculateShipping — edge cases', () => {
  it('trims whitespace from postcode', () => {
    const result = calculateShipping('  2000  ');
    expect(result.zone).toBe('Sydney Metro');
    console.log('[PASS] Whitespace trimmed from postcode:', result.zone);
  });

  it('falls back to default for an unknown/invalid postcode (9999)', () => {
    const result = calculateShipping('9999');
    expect(result.zone).toBe('Standard');
    expect(result.fee).toBe(14.95);
    console.log('[PASS] Unknown postcode 9999 falls back to Standard:', result);
  });

  it('falls back to default for completely non-numeric-range postcode (0001)', () => {
    const result = calculateShipping('0001');
    // 0001 is outside all defined ranges
    expect(result.fee).toBeGreaterThan(0);
    console.log('[PASS] Out-of-range postcode returns a valid fee:', result);
  });
});
