/**
 * Persist customer contact and shipping address data across page navigation
 * using localStorage.
 *
 * Storage key: 'neurotonics-checkout'
 */

const STORAGE_KEY = 'neurotonics-checkout';

export interface CheckoutContact {
  email: string;
  phone: string;
}

export interface CheckoutAddress {
  fullName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

export interface PersistedCheckout {
  contact: CheckoutContact;
  address: CheckoutAddress;
}

export function saveCheckoutData(data: PersistedCheckout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Silently ignore write failures (e.g. private browsing quota exceeded)
  }
}

export function loadCheckoutData(): PersistedCheckout | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as PersistedCheckout) : null;
  } catch {
    return null;
  }
}

export function clearCheckoutData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
