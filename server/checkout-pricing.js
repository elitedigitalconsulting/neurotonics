'use strict';

const product = require('../src/content/product.json');
const shippingData = require('../src/content/shipping.json');

const PRODUCT_CATALOG = new Map([
  [product.name, { slug: product.slug, priceCents: Math.round(product.price * 100) }],
]);

const SHIPPING_OPTION_IDS = new Set(['free', 'standard', 'express', 'international-standard']);

function centsToAud(cents) {
  return cents / 100;
}

function normaliseCountry(country) {
  return typeof country === 'string' ? country.trim().toUpperCase() : '';
}

function calculateZoneShipping(postcode) {
  const code = String(postcode || '').trim();
  const postcodeNum = parseInt(code, 10);

  const sortedZones = [...shippingData.zones].sort((a, b) => {
    const aRange = a.postcodeRanges.reduce((acc, r) => acc + (parseInt(r.to, 10) - parseInt(r.from, 10)), 0);
    const bRange = b.postcodeRanges.reduce((acc, r) => acc + (parseInt(r.to, 10) - parseInt(r.from, 10)), 0);
    return aRange - bRange;
  });

  for (const zone of sortedZones) {
    for (const range of zone.postcodeRanges) {
      const fromNum = parseInt(range.from, 10);
      const toNum = parseInt(range.to, 10);
      if (postcodeNum >= fromNum && postcodeNum <= toNum) {
        return {
          zone: zone.name,
          feeCents: Math.round(zone.fee * 100),
          estimatedDays: zone.estimatedDays,
        };
      }
    }
  }

  return {
    zone: 'Standard',
    feeCents: Math.round(shippingData.defaultFee * 100),
    estimatedDays: shippingData.defaultEstimatedDays,
  };
}

function getAuthoritativeShippingOptions(shippingAddress, subtotalCents) {
  const country = normaliseCountry(shippingAddress?.country);
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new Error('Shipping country is required.');
  }

  if (country !== 'AU') {
    return [{
      id: 'international-standard',
      name: 'International Standard',
      description: shippingData.international.description,
      feeCents: Math.round(shippingData.international.fee * 100),
      estimatedDays: shippingData.international.estimatedDays,
      recommended: true,
      zone: 'International',
      carrier: 'Australia Post',
    }];
  }

  const postcode = String(shippingAddress?.postcode || '').trim();
  if (!/^\d{4}$/.test(postcode)) {
    throw new Error('Valid Australian postcode is required.');
  }

  const zoneResult = calculateZoneShipping(postcode);
  const freeThresholdCents = Math.round((shippingData.freeShippingThreshold || 0) * 100);
  const isFreeEligible = subtotalCents >= freeThresholdCents;
  const options = [];

  if (isFreeEligible) {
    options.push({
      id: 'free',
      name: 'Free Shipping',
      description: `Standard delivery via Australia Post - free for orders over $${shippingData.freeShippingThreshold}`,
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
    feeCents: Math.round(shippingData.expressShipping.fee * 100),
    estimatedDays: shippingData.expressShipping.estimatedDays,
    recommended: false,
    zone: zoneResult.zone,
    carrier: 'Australia Post',
  });

  return options;
}

function validateCheckoutItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Cart is empty or invalid.');
  }
  if (items.length > 50) {
    throw new Error('Cart exceeds maximum item count.');
  }

  const validatedItems = [];
  let subtotalCents = 0;

  for (const item of items) {
    if (
      item === null ||
      typeof item !== 'object' ||
      typeof item.name !== 'string' ||
      item.name.length === 0 ||
      item.name.length > 200 ||
      typeof item.quantity !== 'number' ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      throw new Error('One or more cart items are invalid.');
    }

    const catalogEntry = PRODUCT_CATALOG.get(item.name);
    if (!catalogEntry) {
      throw new Error(`Unknown product: ${item.name}`);
    }

    subtotalCents += catalogEntry.priceCents * item.quantity;
    validatedItems.push({
      name: item.name,
      quantity: item.quantity,
      priceCents: catalogEntry.priceCents,
      image: item.image,
    });
  }

  return { validatedItems, subtotalCents };
}

function resolveCheckoutShipping(shipping, shippingAddress, subtotalCents) {
  const selectedId = typeof shipping?.id === 'string' ? shipping.id : '';
  if (!SHIPPING_OPTION_IDS.has(selectedId)) {
    throw new Error('Invalid shipping option.');
  }

  const options = getAuthoritativeShippingOptions(shippingAddress, subtotalCents);
  const selected = options.find((option) => option.id === selectedId);
  if (!selected) {
    throw new Error('Selected shipping option is not available for this order.');
  }

  return {
    id: selected.id,
    name: selected.name,
    description: selected.description,
    fee: centsToAud(selected.feeCents),
    feeCents: selected.feeCents,
    estimatedDays: selected.estimatedDays,
    recommended: selected.recommended,
    zone: selected.zone,
    carrier: selected.carrier,
  };
}

function buildAuthoritativeCheckoutPricing({ items, shipping, shippingAddress }) {
  const { validatedItems, subtotalCents } = validateCheckoutItems(items);
  const shippingOption = resolveCheckoutShipping(shipping, shippingAddress, subtotalCents);

  return {
    items: validatedItems,
    subtotalCents,
    shippingOption,
    shippingFeeCents: shippingOption.feeCents,
    totalCents: subtotalCents + shippingOption.feeCents,
  };
}

module.exports = {
  PRODUCT_CATALOG,
  buildAuthoritativeCheckoutPricing,
  getAuthoritativeShippingOptions,
  validateCheckoutItems,
  resolveCheckoutShipping,
};
