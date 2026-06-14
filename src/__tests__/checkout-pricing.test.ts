import {
  buildCheckoutPricing,
  getServerShippingOptions,
} from '../../server/checkout-pricing';

describe('server checkout pricing', () => {
  it('uses catalog prices instead of browser-supplied item prices', () => {
    const pricing = buildCheckoutPricing({
      items: [{ name: 'Brain Boost 1000', quantity: 2, price: 0.01 }],
      shipping: { id: 'standard', fee: 0 },
      shippingAddress: { postcode: '2000', country: 'AU' },
    });

    expect(pricing.error).toBeUndefined();
    expect(pricing.subtotalCents).toBe(15980);
    expect(pricing.items?.[0]).toMatchObject({
      name: 'Brain Boost 1000',
      quantity: 2,
      priceCents: 7990,
    });
  });

  it('uses server-calculated shipping fees instead of browser-supplied fees', () => {
    const pricing = buildCheckoutPricing({
      items: [{ name: 'Brain Boost 1000', quantity: 1, price: 79.9 }],
      shipping: { id: 'standard', fee: 0 },
      shippingAddress: { postcode: '2000', country: 'AU' },
    });

    expect(pricing.error).toBeUndefined();
    expect(pricing.shippingFeeCents).toBe(895);
  });

  it('rejects free shipping when the server subtotal is below the threshold', () => {
    const pricing = buildCheckoutPricing({
      items: [{ name: 'Brain Boost 1000', quantity: 1, price: 179.9 }],
      shipping: { id: 'free', fee: 0 },
      shippingAddress: { postcode: '2000', country: 'AU' },
    });

    expect(pricing.error).toBe('Invalid shipping option.');
  });

  it('allows free shipping when the authoritative subtotal reaches the threshold', () => {
    const pricing = buildCheckoutPricing({
      items: [{ name: 'Brain Boost 1000', quantity: 2, price: 0.01 }],
      shipping: { id: 'free', fee: 0 },
      shippingAddress: { postcode: '2000', country: 'AU' },
    });

    expect(pricing.error).toBeUndefined();
    expect(pricing.shippingFeeCents).toBe(0);
  });

  it('builds international shipping options server-side', () => {
    expect(getServerShippingOptions('', 'US', 7990)).toEqual([
      expect.objectContaining({
        id: 'international-standard',
        fee: 29.95,
        zone: 'International',
      }),
    ]);
  });
});
