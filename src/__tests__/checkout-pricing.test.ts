import { resolveCheckoutPricing } from '../../server/checkout-pricing';

const validAddress = {
  fullName: 'Jane Smith',
  address1: '123 Main Street',
  address2: '',
  city: 'Sydney',
  state: 'NSW',
  postcode: '2000',
  country: 'AU',
};

const validShipping = {
  id: 'standard',
  name: 'Standard Shipping',
  fee: 8.95,
  zone: 'Sydney Metro',
};

describe('resolveCheckoutPricing', () => {
  it('uses catalog pricing even when the client submits a forged item price', () => {
    const pricing = resolveCheckoutPricing({
      items: [{ id: 'brain-boost-1000', name: 'Brain Boost 1000', price: 0.01, quantity: 1 }],
      shipping: { ...validShipping, fee: 0 },
      shippingAddress: validAddress,
    });

    expect(pricing.items[0].priceCents).toBe(7990);
    expect(pricing.subtotalCents).toBe(7990);
    expect(pricing.shippingFeeCents).toBe(895);
    expect(pricing.totalCents).toBe(8885);
  });

  it('rejects unknown products instead of charging arbitrary client prices', () => {
    expect(() =>
      resolveCheckoutPricing({
        items: [{ id: 'fake-product', name: 'Fake Product', price: 1, quantity: 1 }],
        shipping: validShipping,
        shippingAddress: validAddress,
      }),
    ).toThrow('Unknown product');
  });

  it('rejects a forged free-shipping selection below the free threshold', () => {
    expect(() =>
      resolveCheckoutPricing({
        items: [{ id: 'brain-boost-1000', name: 'Brain Boost 1000', price: 79.9, quantity: 1 }],
        shipping: { id: 'free', name: 'Free Shipping', fee: 0 },
        shippingAddress: validAddress,
      }),
    ).toThrow('Selected shipping method is not available');
  });

  it('allows free shipping only when the authoritative subtotal reaches the threshold', () => {
    const pricing = resolveCheckoutPricing({
      items: [{ id: 'brain-boost-1000', name: 'Brain Boost 1000', price: 0.01, quantity: 2 }],
      shipping: { id: 'free', name: 'Free Shipping', fee: 0 },
      shippingAddress: validAddress,
    });

    expect(pricing.subtotalCents).toBe(15980);
    expect(pricing.shippingFeeCents).toBe(0);
    expect(pricing.totalCents).toBe(15980);
  });

  it('rejects non-Australian shipping addresses server-side', () => {
    expect(() =>
      resolveCheckoutPricing({
        items: [{ id: 'brain-boost-1000', name: 'Brain Boost 1000', price: 79.9, quantity: 1 }],
        shipping: { id: 'international-standard', name: 'International Standard', fee: 29.95 },
        shippingAddress: { ...validAddress, state: 'CA', postcode: '90210', country: 'US' },
      }),
    ).toThrow('Australian addresses');
  });
});
