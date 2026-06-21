const {
  buildAuthoritativeCheckoutPricing,
} = require('../../server/checkout-pricing') as {
  buildAuthoritativeCheckoutPricing: (input: {
    items: Array<{ name: string; price?: number; quantity: number }>;
    shipping: { id: string; name?: string; fee?: number };
    shippingAddress: { postcode?: string; country: string };
  }) => {
    subtotalCents: number;
    shippingFeeCents: number;
    totalCents: number;
    shippingOption: { id: string; name: string; feeCents: number };
    items: Array<{ name: string; quantity: number; priceCents: number }>;
  };
};

const sydneyAddress = {
  postcode: '2000',
  country: 'AU',
};

describe('Checkout Session authoritative pricing', () => {
  it('ignores forged client product and shipping prices', () => {
    const pricing = buildAuthoritativeCheckoutPricing({
      items: [{ name: 'Brain Boost 1000', price: 0.01, quantity: 1 }],
      shipping: { id: 'standard', name: 'Standard Shipping', fee: 0 },
      shippingAddress: sydneyAddress,
    });

    expect(pricing.items[0].priceCents).toBe(7990);
    expect(pricing.subtotalCents).toBe(7990);
    expect(pricing.shippingFeeCents).toBe(895);
    expect(pricing.totalCents).toBe(8885);
  });

  it('rejects forged free shipping below the free-shipping threshold', () => {
    expect(() => buildAuthoritativeCheckoutPricing({
      items: [{ name: 'Brain Boost 1000', price: 79.9, quantity: 1 }],
      shipping: { id: 'free', name: 'Free Shipping', fee: 0 },
      shippingAddress: sydneyAddress,
    })).toThrow('Selected shipping option is not available for this order.');
  });

  it('allows free shipping when the server-calculated subtotal qualifies', () => {
    const pricing = buildAuthoritativeCheckoutPricing({
      items: [{ name: 'Brain Boost 1000', price: 0.01, quantity: 2 }],
      shipping: { id: 'free', name: 'Free Shipping', fee: 0 },
      shippingAddress: sydneyAddress,
    });

    expect(pricing.subtotalCents).toBe(15980);
    expect(pricing.shippingOption.id).toBe('free');
    expect(pricing.shippingFeeCents).toBe(0);
    expect(pricing.totalCents).toBe(15980);
  });

  it('rejects products outside the server catalog', () => {
    expect(() => buildAuthoritativeCheckoutPricing({
      items: [{ name: 'Forged Product', price: 0.01, quantity: 1 }],
      shipping: { id: 'standard', name: 'Standard Shipping', fee: 8.95 },
      shippingAddress: sydneyAddress,
    })).toThrow('Unknown product: Forged Product');
  });
});
