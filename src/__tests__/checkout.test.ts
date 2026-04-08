/**
 * Tests for checkout utility functions:
 *   - validateCheckoutForm()
 *   - calculateShipping()
 *   - updateTotal()
 *
 * These functions are pure (no browser APIs) and can run in any Jest env.
 */

import {
  validateCheckoutForm,
  calculateShipping,
  updateTotal,
} from '@/app/checkout/CheckoutClient';
import type { ShippingOption } from '@/lib/shipping';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const validContact = {
  email: 'test@example.com',
  phone: '+61 400 000 000',
};

const validAddress = {
  fullName: 'Jane Smith',
  address1: '123 Main Street',
  address2: '',
  city: 'Sydney',
  state: 'NSW',
  postcode: '2000',
  country: 'AU',
};

const validShipping: ShippingOption = {
  id: 'standard',
  name: 'Standard Shipping',
  description: 'Standard Post via Australia Post',
  fee: 8.95,
  estimatedDays: '2-3 business days',
  recommended: true,
  zone: 'Sydney Metro',
  carrier: 'Australia Post',
};

// ---------------------------------------------------------------------------
// validateCheckoutForm — valid form
// ---------------------------------------------------------------------------

describe('validateCheckoutForm — valid form', () => {
  it('returns no errors for a fully valid AU form', () => {
    const errors = validateCheckoutForm(validContact, validAddress, validShipping);
    expect(Object.keys(errors)).toHaveLength(0);
    console.log('[PASS] No errors for valid AU form');
  });

  it('returns no errors for a valid international form', () => {
    const intlAddress = {
      ...validAddress,
      state: 'California',
      postcode: '90210',
      country: 'US',
    };
    const errors = validateCheckoutForm(validContact, intlAddress, validShipping);
    expect(Object.keys(errors)).toHaveLength(0);
    console.log('[PASS] No errors for valid international form');
  });

  it('accepts email without a + in the address part', () => {
    const errors = validateCheckoutForm(
      { ...validContact, email: 'user@domain.co.uk' },
      validAddress,
      validShipping,
    );
    expect(errors.email).toBeUndefined();
    console.log('[PASS] Plain email accepted');
  });
});

// ---------------------------------------------------------------------------
// validateCheckoutForm — email validation
// ---------------------------------------------------------------------------

describe('validateCheckoutForm — email', () => {
  it('requires email', () => {
    const errors = validateCheckoutForm(
      { ...validContact, email: '' },
      validAddress,
      validShipping,
    );
    expect(errors.email).toBeTruthy();
    console.log('[PASS] Empty email rejected:', errors.email);
  });

  it('rejects email without @', () => {
    const errors = validateCheckoutForm(
      { ...validContact, email: 'notanemail' },
      validAddress,
      validShipping,
    );
    expect(errors.email).toBeTruthy();
    console.log('[PASS] Email without @ rejected:', errors.email);
  });

  it('rejects email without domain', () => {
    const errors = validateCheckoutForm(
      { ...validContact, email: 'user@' },
      validAddress,
      validShipping,
    );
    expect(errors.email).toBeTruthy();
    console.log('[PASS] Email without domain rejected');
  });

  it('rejects email with spaces', () => {
    const errors = validateCheckoutForm(
      { ...validContact, email: 'user @domain.com' },
      validAddress,
      validShipping,
    );
    expect(errors.email).toBeTruthy();
    console.log('[PASS] Email with space rejected');
  });

  it('accepts email with leading/trailing whitespace (trimmed)', () => {
    const errors = validateCheckoutForm(
      { ...validContact, email: '  user@domain.com  ' },
      validAddress,
      validShipping,
    );
    expect(errors.email).toBeUndefined();
    console.log('[PASS] Email with whitespace trimmed and accepted');
  });
});

// ---------------------------------------------------------------------------
// validateCheckoutForm — phone validation
// ---------------------------------------------------------------------------

describe('validateCheckoutForm — phone', () => {
  it('requires phone', () => {
    const errors = validateCheckoutForm(
      { ...validContact, phone: '' },
      validAddress,
      validShipping,
    );
    expect(errors.phone).toBeTruthy();
    console.log('[PASS] Empty phone rejected:', errors.phone);
  });

  it('rejects phone that is too short (fewer than 7 chars)', () => {
    const errors = validateCheckoutForm(
      { ...validContact, phone: '123' },
      validAddress,
      validShipping,
    );
    expect(errors.phone).toBeTruthy();
    console.log('[PASS] Short phone rejected:', errors.phone);
  });

  it('accepts a standard Australian mobile number', () => {
    const errors = validateCheckoutForm(
      { ...validContact, phone: '0412345678' },
      validAddress,
      validShipping,
    );
    expect(errors.phone).toBeUndefined();
    console.log('[PASS] AU mobile accepted');
  });

  it('accepts phone with country code, spaces, dashes', () => {
    const errors = validateCheckoutForm(
      { ...validContact, phone: '+61 412 345 678' },
      validAddress,
      validShipping,
    );
    expect(errors.phone).toBeUndefined();
    console.log('[PASS] Formatted phone with +61 accepted');
  });

  it('rejects phone with letters', () => {
    const errors = validateCheckoutForm(
      { ...validContact, phone: 'call-me-now' },
      validAddress,
      validShipping,
    );
    expect(errors.phone).toBeTruthy();
    console.log('[PASS] Phone with letters rejected');
  });
});

// ---------------------------------------------------------------------------
// validateCheckoutForm — address validation
// ---------------------------------------------------------------------------

describe('validateCheckoutForm — address fields', () => {
  it('requires fullName', () => {
    const errors = validateCheckoutForm(
      validContact,
      { ...validAddress, fullName: '' },
      validShipping,
    );
    expect(errors.fullName).toBeTruthy();
    console.log('[PASS] Empty fullName rejected');
  });

  it('requires address1', () => {
    const errors = validateCheckoutForm(
      validContact,
      { ...validAddress, address1: '' },
      validShipping,
    );
    expect(errors.address1).toBeTruthy();
    console.log('[PASS] Empty address1 rejected');
  });

  it('requires city', () => {
    const errors = validateCheckoutForm(
      validContact,
      { ...validAddress, city: '' },
      validShipping,
    );
    expect(errors.city).toBeTruthy();
    console.log('[PASS] Empty city rejected');
  });

  it('requires state', () => {
    const errors = validateCheckoutForm(
      validContact,
      { ...validAddress, state: '' },
      validShipping,
    );
    expect(errors.state).toBeTruthy();
    console.log('[PASS] Empty state rejected');
  });

  it('address2 is optional (no error when empty)', () => {
    const errors = validateCheckoutForm(
      validContact,
      { ...validAddress, address2: '' },
      validShipping,
    );
    expect(errors.address2).toBeUndefined();
    console.log('[PASS] Empty address2 is fine (optional)');
  });
});

// ---------------------------------------------------------------------------
// validateCheckoutForm — postcode validation (AU)
// ---------------------------------------------------------------------------

describe('validateCheckoutForm — AU postcode', () => {
  it('requires postcode for AU', () => {
    const errors = validateCheckoutForm(
      validContact,
      { ...validAddress, postcode: '' },
      validShipping,
    );
    expect(errors.postcode).toBeTruthy();
    console.log('[PASS] Empty AU postcode rejected');
  });

  it('rejects 3-digit Australian postcode', () => {
    const errors = validateCheckoutForm(
      validContact,
      { ...validAddress, postcode: '200' },
      validShipping,
    );
    expect(errors.postcode).toBeTruthy();
    console.log('[PASS] 3-digit AU postcode rejected');
  });

  it('rejects 5-digit postcode for AU', () => {
    const errors = validateCheckoutForm(
      validContact,
      { ...validAddress, postcode: '20001' },
      validShipping,
    );
    expect(errors.postcode).toBeTruthy();
    console.log('[PASS] 5-digit AU postcode rejected');
  });

  it('accepts a valid 4-digit AU postcode', () => {
    const errors = validateCheckoutForm(
      validContact,
      { ...validAddress, postcode: '3000' },
      validShipping,
    );
    expect(errors.postcode).toBeUndefined();
    console.log('[PASS] Valid 4-digit AU postcode accepted');
  });

  it('rejects non-numeric AU postcode', () => {
    const errors = validateCheckoutForm(
      validContact,
      { ...validAddress, postcode: 'ABCD' },
      validShipping,
    );
    expect(errors.postcode).toBeTruthy();
    console.log('[PASS] Non-numeric AU postcode rejected');
  });
});

// ---------------------------------------------------------------------------
// validateCheckoutForm — postcode for international
// ---------------------------------------------------------------------------

describe('validateCheckoutForm — international postcode', () => {
  it('does not require postcode for non-AU (empty is fine)', () => {
    const errors = validateCheckoutForm(
      validContact,
      { ...validAddress, country: 'US', state: 'CA', postcode: '' },
      validShipping,
    );
    expect(errors.postcode).toBeUndefined();
    console.log('[PASS] Empty postcode allowed for non-AU');
  });

  it('accepts alphanumeric postcode for non-AU', () => {
    const errors = validateCheckoutForm(
      validContact,
      { ...validAddress, country: 'GB', state: 'England', postcode: 'SW1A 1AA' },
      validShipping,
    );
    expect(errors.postcode).toBeUndefined();
    console.log('[PASS] UK-style postcode accepted');
  });
});

// ---------------------------------------------------------------------------
// validateCheckoutForm — shipping selection
// ---------------------------------------------------------------------------

describe('validateCheckoutForm — shipping', () => {
  it('requires a shipping option to be selected', () => {
    const errors = validateCheckoutForm(validContact, validAddress, null);
    expect(errors.shipping).toBeTruthy();
    console.log('[PASS] No shipping option rejected:', errors.shipping);
  });

  it('no shipping error when option is selected', () => {
    const errors = validateCheckoutForm(validContact, validAddress, validShipping);
    expect(errors.shipping).toBeUndefined();
    console.log('[PASS] Valid shipping option accepted');
  });
});

// ---------------------------------------------------------------------------
// calculateShipping (wrapper around getShippingOptions)
// ---------------------------------------------------------------------------

describe('calculateShipping', () => {
  it('returns AU shipping options for AU + valid postcode', () => {
    const options = calculateShipping('2000', 'AU', 79.9);
    expect(options.length).toBeGreaterThan(0);
    expect(options.some((o) => o.id === 'standard')).toBe(true);
    console.log('[PASS] AU shipping options returned for 2000');
  });

  it('returns free option when subtotal >= 100 for AU', () => {
    const options = calculateShipping('2000', 'AU', 120);
    expect(options.some((o) => o.id === 'free')).toBe(true);
    console.log('[PASS] Free option returned for AU above threshold');
  });

  it('returns single international option for non-AU', () => {
    const options = calculateShipping('', 'US', 50);
    expect(options).toHaveLength(1);
    expect(options[0].id).toBe('international-standard');
    console.log('[PASS] International option returned for US');
  });

  it('returns options with fallback zone for unrecognised AU postcode', () => {
    // calculateShipping() delegates to getShippingOptions() which falls back to
    // the default zone. Postcode validation (blocking the call) happens inside
    // the component's computeShippingOptions(). A 3-digit postcode therefore
    // still returns standard + express options from the default zone.
    const options = calculateShipping('200', 'AU', 79.9);
    expect(options.length).toBeGreaterThan(0);
    expect(options.some((o) => o.id === 'standard')).toBe(true);
    console.log('[PASS] Unrecognised AU postcode falls back to default zone options');
  });
});

// ---------------------------------------------------------------------------
// updateTotal
// ---------------------------------------------------------------------------

describe('updateTotal', () => {
  it('adds subtotal and shipping fee', () => {
    expect(updateTotal(79.9, 8.95)).toBeCloseTo(88.85, 2);
    console.log('[PASS] 79.90 + 8.95 = 88.85');
  });

  it('returns subtotal unchanged when shipping is free (fee = 0)', () => {
    expect(updateTotal(120, 0)).toBe(120);
    console.log('[PASS] 120 + 0 = 120 (free shipping)');
  });

  it('handles large totals correctly', () => {
    expect(updateTotal(999.9, 14.95)).toBeCloseTo(1014.85, 2);
    console.log('[PASS] Large total computed correctly');
  });

  it('handles zero subtotal', () => {
    expect(updateTotal(0, 14.95)).toBeCloseTo(14.95, 2);
    console.log('[PASS] Zero subtotal + shipping = shipping fee only');
  });
});
