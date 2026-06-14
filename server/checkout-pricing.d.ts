export interface CheckoutPricingItemInput {
  name: string;
  quantity: number;
  price?: number;
  image?: string;
}

export interface CheckoutShippingInput {
  id: string;
  fee?: number;
}

export interface CheckoutAddressInput {
  postcode?: string;
  country: string;
}

export interface PricedCheckoutItem {
  name: string;
  quantity: number;
  priceCents: number;
  image?: string;
}

export interface ServerShippingOption {
  id: string;
  name: string;
  description: string;
  fee: number;
  estimatedDays: string;
  recommended: boolean;
  zone: string;
  carrier: string;
}

export interface CheckoutPricingResult {
  error?: string;
  items?: PricedCheckoutItem[];
  subtotalCents?: number;
  shipping?: ServerShippingOption;
  shippingFeeCents?: number;
}

export const PRODUCT_CATALOG: Map<string, { slug: string; priceCents: number }>;
export const MAX_SHIPPING_CENTS: number;
export function buildCheckoutPricing(input: {
  items: CheckoutPricingItemInput[];
  shipping: CheckoutShippingInput;
  shippingAddress: CheckoutAddressInput;
}): CheckoutPricingResult;
export function getServerShippingOptions(
  postcode: string,
  country: string,
  subtotalCents: number,
): ServerShippingOption[];
