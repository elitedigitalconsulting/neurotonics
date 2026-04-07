import shippingData from '@/content/shipping.json';

export interface ShippingResult {
  zone: string;
  fee: number;
  estimatedDays: string;
}

export interface ShippingOption {
  id: string;
  name: string;
  description: string;
  fee: number;
  estimatedDays: string;
  recommended: boolean;
  zone: string;
  carrier: string;
}

/**
 * Resolve the Australia Post zone for a given 4-digit postcode.
 * Returns the most specific (narrowest range) matching zone.
 */
export function calculateShipping(postcode: string): ShippingResult {
  const code = postcode.trim();
  
  // Sort zones by specificity — more specific (smaller ranges) first
  const sortedZones = [...shippingData.zones].sort((a, b) => {
    const aRange = a.postcodeRanges.reduce((acc, r) => acc + (parseInt(r.to) - parseInt(r.from)), 0);
    const bRange = b.postcodeRanges.reduce((acc, r) => acc + (parseInt(r.to) - parseInt(r.from)), 0);
    return aRange - bRange;
  });

  for (const zone of sortedZones) {
    for (const range of zone.postcodeRanges) {
      const postcodeNum = parseInt(code);
      const fromNum = parseInt(range.from);
      const toNum = parseInt(range.to);
      
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

/**
 * Return all applicable shipping options for the given location and cart total.
 *
 * Rules:
 *   Australia
 *     - Free Shipping (recommended) if subtotal >= freeShippingThreshold
 *     - Standard Shipping — zone-based rate via Australia Post
 *     - Express Shipping  — flat express rate via Australia Post
 *   International
 *     - Standard International — flat rate via Australia Post
 *
 * @param postcode  4-digit Australian postcode, or empty string for international
 * @param country   ISO 3166-1 alpha-2 country code (e.g. "AU", "US", "GB")
 * @param subtotal  Cart subtotal in AUD (before shipping)
 */
export function getShippingOptions(
  postcode: string,
  country: string,
  subtotal: number,
): ShippingOption[] {
  const isAustralia = country === 'AU';

  if (!isAustralia) {
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

  const zoneResult = calculateShipping(postcode);
  const freeThreshold = shippingData.freeShippingThreshold ?? 100;
  const isFreeEligible = subtotal >= freeThreshold;

  const options: ShippingOption[] = [];

  // Free shipping (when eligible — recommended if available)
  if (isFreeEligible) {
    options.push({
      id: 'free',
      name: 'Free Shipping',
      description: `Standard delivery via Australia Post — free for orders over $${freeThreshold}`,
      fee: 0,
      estimatedDays: zoneResult.estimatedDays,
      recommended: true,
      zone: zoneResult.zone,
      carrier: 'Australia Post',
    });
  }

  // Standard shipping
  options.push({
    id: 'standard',
    name: 'Standard Shipping',
    description: `Standard Post via Australia Post`,
    fee: zoneResult.fee,
    estimatedDays: zoneResult.estimatedDays,
    recommended: !isFreeEligible,
    zone: zoneResult.zone,
    carrier: 'Australia Post',
  });

  // Express shipping
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

/**
 * Return the best default shipping option for the given location and cart total.
 * Defaults to the recommended option (free if eligible, else standard).
 */
export function getDefaultShippingOption(
  postcode: string,
  country: string,
  subtotal: number,
): ShippingOption {
  const options = getShippingOptions(postcode, country, subtotal);
  return options.find((o) => o.recommended) ?? options[0];
}
