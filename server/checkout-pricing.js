'use strict';

const product = require('../src/content/product.json');
const shippingData = require('../src/content/shipping.json');

class CheckoutPricingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CheckoutPricingError';
    this.statusCode = 400;
  }
}

function toCents(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    throw new CheckoutPricingError('Product pricing is not configured correctly.');
  }
  return Math.round(amount * 100);
}

function audFromCents(cents) {
  return cents / 100;
}

function getCatalog() {
  return [
    {
      id: product.slug,
      name: product.name,
      priceCents: toCents(product.price),
      image: product.images?.[0]?.src || '',
    },
  ];
}

function resolveCartItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new CheckoutPricingError('Cart is empty or invalid.');
  }
  if (rawItems.length > 50) {
    throw new CheckoutPricingError('Cart exceeds maximum item count.');
  }

  const catalog = getCatalog();
  return rawItems.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new CheckoutPricingError('One or more cart items are invalid.');
    }

    const quantity = item.quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new CheckoutPricingError('One or more cart items are invalid.');
    }

    const rawId = typeof item.id === 'string' ? item.id : '';
    const rawName = typeof item.name === 'string' ? item.name : '';
    const catalogItem = catalog.find((candidate) =>
      candidate.id === rawId || candidate.name === rawName
    );
    if (!catalogItem) {
      throw new CheckoutPricingError(`Unknown product: ${rawName || rawId || '(missing)'}`);
    }

    return {
      id: catalogItem.id,
      name: catalogItem.name,
      quantity,
      priceCents: catalogItem.priceCents,
      image: catalogItem.image,
    };
  });
}

function calculateAustralianShipping(postcode) {
  const code = String(postcode || '').trim();
  const sortedZones = [...shippingData.zones].sort((a, b) => {
    const aRange = a.postcodeRanges.reduce((acc, range) => acc + (parseInt(range.to, 10) - parseInt(range.from, 10)), 0);
    const bRange = b.postcodeRanges.reduce((acc, range) => acc + (parseInt(range.to, 10) - parseInt(range.from, 10)), 0);
    return aRange - bRange;
  });

  for (const zone of sortedZones) {
    for (const range of zone.postcodeRanges) {
      const postcodeNum = parseInt(code, 10);
      const fromNum = parseInt(range.from, 10);
      const toNum = parseInt(range.to, 10);

      if (postcodeNum >= fromNum && postcodeNum <= toNum) {
        return {
          zone: zone.name,
          feeCents: toCents(zone.fee),
          estimatedDays: zone.estimatedDays,
        };
      }
    }
  }

  return {
    zone: 'Standard',
    feeCents: toCents(shippingData.defaultFee),
    estimatedDays: shippingData.defaultEstimatedDays,
  };
}

function getAuthoritativeShippingOptions(postcode, country, subtotalCents) {
  if (country !== 'AU') {
    return [];
  }

  const zoneResult = calculateAustralianShipping(postcode);
  const freeThresholdCents = toCents(shippingData.freeShippingThreshold ?? 100);
  const isFreeEligible = subtotalCents >= freeThresholdCents;
  const options = [];

  if (isFreeEligible) {
    options.push({
      id: 'free',
      name: 'Free Shipping',
      description: `Standard delivery via Australia Post - free for orders over $${shippingData.freeShippingThreshold ?? 100}`,
      feeCents: 0,
      estimatedDays: zoneResult.estimatedDays,
      recommended: true,
      zone: zoneResult.zone,
      carrier: 'Australia Post',
    });
  }

  options.push({
    id: 'standard',
    name: 'Standard Shipping',
    description: 'Standard Post via Australia Post',
    feeCents: zoneResult.feeCents,
    estimatedDays: zoneResult.estimatedDays,
    recommended: !isFreeEligible,
    zone: zoneResult.zone,
    carrier: 'Australia Post',
  });

  options.push({
    id: 'express',
    name: 'Express Shipping',
    description: shippingData.expressShipping.description,
    feeCents: toCents(shippingData.expressShipping.fee),
    estimatedDays: shippingData.expressShipping.estimatedDays,
    recommended: false,
    zone: zoneResult.zone,
    carrier: 'Australia Post',
  });

  return options;
}

function requireText(value, message) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CheckoutPricingError(message);
  }
  return value.trim();
}

function resolveShippingOption(rawShipping, rawAddress, subtotalCents) {
  if (!rawAddress || typeof rawAddress !== 'object') {
    throw new CheckoutPricingError('Shipping address is required.');
  }

  requireText(rawAddress.fullName, 'Shipping name is required.');
  requireText(rawAddress.address1, 'Shipping address is required.');
  requireText(rawAddress.city, 'Shipping city is required.');
  requireText(rawAddress.state, 'Shipping state is required.');

  const country = requireText(rawAddress.country, 'Shipping country is required.').toUpperCase();
  if (country !== 'AU') {
    throw new CheckoutPricingError('We can only ship to Australian addresses.');
  }

  const postcode = requireText(rawAddress.postcode, 'Shipping postcode is required.');
  if (!/^\d{4}$/.test(postcode)) {
    throw new CheckoutPricingError('A valid Australian postcode is required.');
  }

  if (!rawShipping || typeof rawShipping !== 'object' || typeof rawShipping.id !== 'string') {
    throw new CheckoutPricingError('A valid shipping method is required.');
  }

  const options = getAuthoritativeShippingOptions(postcode, country, subtotalCents);
  const selected = options.find((option) => option.id === rawShipping.id);
  if (!selected) {
    throw new CheckoutPricingError('Selected shipping method is not available for this order.');
  }

  return {
    ...selected,
    fee: audFromCents(selected.feeCents),
  };
}

function resolveCheckoutPricing({ items, shipping, shippingAddress }) {
  const resolvedItems = resolveCartItems(items);
  const subtotalCents = resolvedItems.reduce(
    (sum, item) => sum + item.priceCents * item.quantity,
    0,
  );
  const shippingOption = resolveShippingOption(shipping, shippingAddress, subtotalCents);

  return {
    items: resolvedItems,
    shippingOption,
    subtotalCents,
    shippingFeeCents: shippingOption.feeCents,
    totalCents: subtotalCents + shippingOption.feeCents,
  };
}

module.exports = {
  CheckoutPricingError,
  resolveCheckoutPricing,
  getAuthoritativeShippingOptions,
};
