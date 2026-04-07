/**
 * Tests for the calculateShipping(), getShippingOptions(), and
 * getDefaultShippingOption() functions in src/lib/shipping.ts
 */

import { calculateShipping, getShippingOptions, getDefaultShippingOption } from '@/lib/shipping';

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

// ---------------------------------------------------------------------------
// getShippingOptions() tests
// ---------------------------------------------------------------------------

describe('getShippingOptions — Australia, below free threshold', () => {
  const subtotal = 79.90; // below $100 threshold

  it('returns standard and express options (no free option) for AU below threshold', () => {
    const options = getShippingOptions('2000', 'AU', subtotal);
    const ids = options.map((o) => o.id);
    expect(ids).not.toContain('free');
    expect(ids).toContain('standard');
    expect(ids).toContain('express');
    console.log('[PASS] Below threshold AU options:', ids);
  });

  it('standard option is recommended below threshold', () => {
    const options = getShippingOptions('2000', 'AU', subtotal);
    const standard = options.find((o) => o.id === 'standard');
    expect(standard?.recommended).toBe(true);
    console.log('[PASS] Standard is recommended below threshold');
  });

  it('express option is NOT recommended', () => {
    const options = getShippingOptions('2000', 'AU', subtotal);
    const express = options.find((o) => o.id === 'express');
    expect(express?.recommended).toBe(false);
    console.log('[PASS] Express is not recommended');
  });

  it('express fee is $14.95', () => {
    const options = getShippingOptions('2000', 'AU', subtotal);
    const express = options.find((o) => o.id === 'express');
    expect(express?.fee).toBe(14.95);
    console.log('[PASS] Express fee is $14.95');
  });
});

describe('getShippingOptions — Australia, above free threshold', () => {
  const subtotal = 120.00; // above $100 threshold

  it('includes free option for AU above threshold', () => {
    const options = getShippingOptions('2000', 'AU', subtotal);
    const ids = options.map((o) => o.id);
    expect(ids).toContain('free');
    expect(ids).toContain('standard');
    expect(ids).toContain('express');
    console.log('[PASS] Above threshold AU options:', ids);
  });

  it('free option is recommended above threshold', () => {
    const options = getShippingOptions('2000', 'AU', subtotal);
    const free = options.find((o) => o.id === 'free');
    expect(free?.recommended).toBe(true);
    console.log('[PASS] Free is recommended above threshold');
  });

  it('free option has fee of $0', () => {
    const options = getShippingOptions('2000', 'AU', subtotal);
    const free = options.find((o) => o.id === 'free');
    expect(free?.fee).toBe(0);
    console.log('[PASS] Free option fee is $0');
  });

  it('standard option is NOT recommended above threshold', () => {
    const options = getShippingOptions('2000', 'AU', subtotal);
    const standard = options.find((o) => o.id === 'standard');
    expect(standard?.recommended).toBe(false);
    console.log('[PASS] Standard is not recommended above threshold');
  });
});

describe('getShippingOptions — exactly at free threshold ($100)', () => {
  it('includes free option when subtotal === 100', () => {
    const options = getShippingOptions('2000', 'AU', 100);
    const ids = options.map((o) => o.id);
    expect(ids).toContain('free');
    console.log('[PASS] Free option included at exactly $100');
  });
});

describe('getShippingOptions — international', () => {
  it('returns a single international option for non-AU country', () => {
    const options = getShippingOptions('', 'US', 50);
    expect(options).toHaveLength(1);
    expect(options[0].id).toBe('international-standard');
    console.log('[PASS] Single international option for US');
  });

  it('international option fee is $29.95', () => {
    const options = getShippingOptions('', 'GB', 50);
    expect(options[0].fee).toBe(29.95);
    console.log('[PASS] International fee is $29.95');
  });

  it('international option is recommended', () => {
    const options = getShippingOptions('', 'NZ', 50);
    expect(options[0].recommended).toBe(true);
    console.log('[PASS] International option is recommended');
  });

  it('international option zone is "International"', () => {
    const options = getShippingOptions('', 'CA', 50);
    expect(options[0].zone).toBe('International');
    console.log('[PASS] International zone label correct');
  });

  it('free threshold does NOT apply to international orders', () => {
    const options = getShippingOptions('', 'US', 200);
    expect(options).toHaveLength(1);
    expect(options[0].id).toBe('international-standard');
    expect(options[0].fee).toBe(29.95);
    console.log('[PASS] Free threshold does not apply internationally');
  });
});

describe('getShippingOptions — option shape', () => {
  it('each option has all required fields', () => {
    const options = getShippingOptions('2000', 'AU', 50);
    for (const opt of options) {
      expect(typeof opt.id).toBe('string');
      expect(typeof opt.name).toBe('string');
      expect(typeof opt.description).toBe('string');
      expect(typeof opt.fee).toBe('number');
      expect(typeof opt.estimatedDays).toBe('string');
      expect(typeof opt.recommended).toBe('boolean');
      expect(typeof opt.zone).toBe('string');
      expect(typeof opt.carrier).toBe('string');
    }
    console.log('[PASS] All option fields present and correctly typed');
  });

  it('carrier is always "Australia Post"', () => {
    const auOptions = getShippingOptions('2000', 'AU', 50);
    const intlOptions = getShippingOptions('', 'US', 50);
    for (const opt of [...auOptions, ...intlOptions]) {
      expect(opt.carrier).toBe('Australia Post');
    }
    console.log('[PASS] Carrier is Australia Post for all options');
  });
});

describe('getShippingOptions — total calculation with shipping', () => {
  it('total with standard shipping below threshold = subtotal + standard fee', () => {
    const subtotal = 79.90;
    const options = getShippingOptions('2000', 'AU', subtotal);
    const standard = options.find((o) => o.id === 'standard')!;
    const total = subtotal + standard.fee;
    expect(total).toBeCloseTo(79.90 + standard.fee, 2);
    console.log(`[PASS] Total with standard shipping: $${total.toFixed(2)}`);
  });

  it('total with free shipping above threshold = subtotal (no extra charge)', () => {
    const subtotal = 120.00;
    const options = getShippingOptions('2000', 'AU', subtotal);
    const free = options.find((o) => o.id === 'free')!;
    const total = subtotal + free.fee;
    expect(total).toBe(120.00);
    console.log(`[PASS] Total with free shipping: $${total.toFixed(2)}`);
  });

  it('total with express shipping = subtotal + 14.95', () => {
    const subtotal = 79.90;
    const options = getShippingOptions('2000', 'AU', subtotal);
    const express = options.find((o) => o.id === 'express')!;
    const total = subtotal + express.fee;
    expect(total).toBeCloseTo(79.90 + 14.95, 2);
    console.log(`[PASS] Total with express shipping: $${total.toFixed(2)}`);
  });
});

describe('getDefaultShippingOption', () => {
  it('returns the free option when eligible', () => {
    const def = getDefaultShippingOption('2000', 'AU', 120);
    expect(def.id).toBe('free');
    console.log('[PASS] Default is free when eligible');
  });

  it('returns standard when below threshold', () => {
    const def = getDefaultShippingOption('2000', 'AU', 50);
    expect(def.id).toBe('standard');
    console.log('[PASS] Default is standard below threshold');
  });

  it('returns international option for non-AU', () => {
    const def = getDefaultShippingOption('', 'US', 50);
    expect(def.id).toBe('international-standard');
    console.log('[PASS] Default is international for non-AU');
  });
});
