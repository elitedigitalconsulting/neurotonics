/**
 * Persist the selected shipping option and the customer's location inputs
 * (postcode + country) across the cart → checkout flow using localStorage.
 *
 * Storage key: 'neurotonics-shipping'
 */

import type { ShippingOption } from '@/lib/shipping';

const STORAGE_KEY = 'neurotonics-shipping';

export interface PersistedShipping {
  option: ShippingOption;
  postcode: string;
  country: string;
}

export function saveShipping(data: PersistedShipping): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Silently ignore write failures (e.g. private browsing quota exceeded)
  }
}

export function loadShipping(): PersistedShipping | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as PersistedShipping) : null;
  } catch {
    return null;
  }
}

export function clearShipping(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
