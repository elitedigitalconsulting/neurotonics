'use strict';

const shippingData = require('../src/content/shipping.json');

// Server-side price truth. Keep in sync with src/content/product.json.
const PRODUCT_CATALOG = new Map([
  ['Brain Boost 1000', { slug: 'brain-boost-1000', priceCents: 7990 }],
]);

// Maximum valid shipping fee in cents ($29.95 international).
// All zone fees in src/content/shipping.json fall within this cap.
const MAX_SHIPPING_CENTS = 2995;

function dollarsToCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

function getPostcodeZone(postcode) {
  const code = String(postcode || '').trim();
  const postcodeNum = parseInt(code, 10);

  const sortedZones = [...shippingData.zones].sort((a, b) => {
    const aRange = a.postcodeRanges.reduce((acc, range) => acc + (parseInt(range.to, 10) - parseInt(range.from, 10)), 0);
    const bRange = b.postcodeRanges.reduce((acc, range) => acc + (parseInt(range.to, 10) - parseInt(range.from, 10)), 0);
    return aRange - bRange;
  });

  for (const zone of sortedZones) {
    for (const range of zone.postcodeRanges) {
      const fromNum = parseInt(range.from, 10);
      const toNum = parseInt(range.to, 10);
      if (postcodeNum >= fromNum && postcodeNum <= toNum) {
        return {
          zone: zone.name,
          fee: zone.fee,
          estimatedDays: zone.estimatedDays,
        };
      }
    }
  }

  return {
    zone: 'Standard',
    fee: shippingData.defaultFee,
    estimatedDays: shippingData.defaultEstimatedDays,
  };
}

function getServerShippingOptions(postcode, country, subtotalCents) {
  const normalisedCountry = String(country || '').trim().toUpperCase();

  if (normalisedCountry !== 'AU') {
    return [
      {
        id: 'international-standard',
        name: 'International Standard',
        description: shippingData.international.description,
        fee: shippingData.international.fee,
        estimatedDays: shippingData.international.estimatedDays,
        recommended: true,
        zone: 'International',
        carrier: 'Australia Post',
      },
    ];
  }

  const zoneResult = getPostcodeZone(postcode);
  const freeThresholdCents = dollarsToCents(shippingData.freeShippingThreshold || 100);
  const isFreeEligible = subtotalCents >= freeThresholdCents;
  const options = [];

  if (isFreeEligible) {
    options.push({
      id: 'free',
      name: 'Free Shipping',
      description: `Standard delivery via Australia Post - free for orders over $${shippingData.freeShippingThreshold || 100}`,
      fee: 0,
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
    fee: zoneResult.fee,
    estimatedDays: zoneResult.estimatedDays,
    recommended: !isFreeEligible,
    zone: zoneResult.zone,
    carrier: 'Australia Post',
  });

  options.push({
    id: 'express',
    name: 'Express Shipping',
    description: shippingData.expressShipping.description,
    fee: shippingData.expressShipping.fee,
    estimatedDays: shippingData.expressShipping.estimatedDays,
    recommended: false,
    zone: zoneResult.zone,
    carrier: 'Australia Post',
  });

  return options;
}

function buildCheckoutPricing({ items, shipping, shippingAddress }) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'Cart is empty or invalid.' };
  }
  if (items.length > 50) {
    return { error: 'Cart exceeds maximum item count.' };
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
      return { error: 'One or more cart items are invalid.' };
    }

    const catalogEntry = PRODUCT_CATALOG.get(item.name);
    if (!catalogEntry) {
      return { error: `Unknown product: ${item.name}` };
    }

    subtotalCents += catalogEntry.priceCents * item.quantity;
    validatedItems.push({
      name: item.name,
      quantity: item.quantity,
      priceCents: catalogEntry.priceCents,
      image: item.image,
    });
  }

  const country = shippingAddress && typeof shippingAddress === 'object'
    ? String(shippingAddress.country || '').trim().toUpperCase()
    : '';
  const postcode = shippingAddress && typeof shippingAddress === 'object'
    ? String(shippingAddress.postcode || '').trim()
    : '';

  if (!country) {
    return { error: 'Shipping country is required.' };
  }
  if (country === 'AU' && !/^\d{4}$/.test(postcode)) {
    return { error: 'A valid Australian postcode is required.' };
  }

  const selectedShippingId = shipping && typeof shipping === 'object' && typeof shipping.id === 'string'
    ? shipping.id
    : '';
  const shippingOptions = getServerShippingOptions(postcode, country, subtotalCents);
  const selectedShipping = shippingOptions.find((option) => option.id === selectedShippingId);
  if (!selectedShipping) {
    return { error: 'Invalid shipping option.' };
  }

  const shippingFeeCents = dollarsToCents(selectedShipping.fee);
  if (shippingFeeCents < 0 || shippingFeeCents > MAX_SHIPPING_CENTS) {
    return { error: 'Invalid shipping fee.' };
  }

  return {
    items: validatedItems,
    subtotalCents,
    shipping: selectedShipping,
    shippingFeeCents,
  };
}

module.exports = {
  PRODUCT_CATALOG,
  MAX_SHIPPING_CENTS,
  buildCheckoutPricing,
  getServerShippingOptions,
};
