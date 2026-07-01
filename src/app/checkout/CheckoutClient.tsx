'use client';

import { useState, useEffect, useCallback, useSyncExternalStore, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/lib/cart';
import { withBasePath } from '@/lib/basePath';
import {
  getShippingOptions,
  getDefaultShippingOption,
  type ShippingOption,
} from '@/lib/shipping';
import type { CheckoutContact, CheckoutAddress } from '@/lib/checkoutState';
import { clearCheckoutData, loadCheckoutData } from '@/lib/checkoutState';
import { clearShipping, loadShipping } from '@/lib/shippingState';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const WEB3FORMS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? '';
const AWS_LOCATION_KEY = process.env.NEXT_PUBLIC_AWS_LOCATION_API_KEY ?? '';
const AWS_LOCATION_REGION = process.env.NEXT_PUBLIC_AWS_LOCATION_REGION ?? 'ap-southeast-2';
const PURCHASE_NOTIFICATION_TIMEOUT_MS = 5_000;
const CHECKOUT_SESSION_TIMEOUT_MS = 20_000;

function subscribeSearchParams(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
}

function getSearchSnapshot() {
  return typeof window === 'undefined' ? '' : window.location.search;
}

function getServerSearchSnapshot() {
  return '';
}

// ---------------------------------------------------------------------------
// Constants (exported for tests)
// ---------------------------------------------------------------------------

export const COUNTRIES = [
  { code: 'AU', name: 'Australia' },
];

export const AU_STATES = [
  { code: 'NSW', name: 'New South Wales' },
  { code: 'VIC', name: 'Victoria' },
  { code: 'QLD', name: 'Queensland' },
  { code: 'WA', name: 'Western Australia' },
  { code: 'SA', name: 'South Australia' },
  { code: 'TAS', name: 'Tasmania' },
  { code: 'ACT', name: 'Australian Capital Territory' },
  { code: 'NT', name: 'Northern Territory' },
];

export const FREE_SHIPPING_THRESHOLD = 100;

// ---------------------------------------------------------------------------
// Types (exported for tests)
// ---------------------------------------------------------------------------

export type FormErrors = Partial<
  Record<keyof CheckoutContact | keyof CheckoutAddress | 'shipping', string>
>;

// ---------------------------------------------------------------------------
// Pure utility functions (exported for tests — keep signatures identical)
// ---------------------------------------------------------------------------

export function validateCheckoutForm(
  contact: CheckoutContact,
  address: CheckoutAddress,
  selectedShipping: ShippingOption | null,
): FormErrors {
  const errors: FormErrors = {};
  const streetAddress = address.address1.trim();

  if (!contact.email.trim()) {
    errors.email = 'Email address is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) {
    errors.email = 'Please enter a valid email address';
  }

  if (!contact.phone.trim()) {
    errors.phone = 'Phone number is required';
  } else if (!/^[\d\s+\-()]{7,20}$/.test(contact.phone.trim())) {
    errors.phone = 'Please enter a valid phone number (7-20 digits)';
  }

  if (!address.fullName.trim()) {
    errors.fullName = 'Full name is required';
  }

  if (!streetAddress) {
    errors.address1 = 'Address is required';
  } else if (
    streetAddress.length < 5 ||
    !/[A-Za-z]/.test(streetAddress) ||
    !/[A-Za-z0-9]/.test(streetAddress) ||
    !/^[A-Za-z0-9\s,'.#\/-]+$/.test(streetAddress) ||
    /^(test|none|unknown|n\/a)$/i.test(streetAddress)
  ) {
    errors.address1 = 'Please enter a valid street address';
  }

  if (!address.city.trim()) {
    errors.city = 'City / suburb is required';
  }

  if (!address.state.trim()) {
    errors.state = 'State / region is required';
  }

  if (address.country === 'AU') {
    if (!address.postcode.trim()) {
      errors.postcode = 'Postcode is required';
    } else if (!/^\d{4}$/.test(address.postcode.trim())) {
      errors.postcode = 'Please enter a valid 4-digit Australian postcode';
    }
  } else if (address.postcode.trim() && address.postcode.trim().length < 2) {
    errors.postcode = 'Please enter a valid postcode';
  }

  if (!address.country) {
    errors.country = 'Country is required';
  } else if (address.country !== 'AU') {
    errors.country = 'We cannot deliver to this address, contact us if you have any questions';
  }

  if (!selectedShipping) {
    errors.shipping = 'Please select a delivery option';
  }

  return errors;
}

export function calculateShipping(
  postcode: string,
  country: string,
  subtotal: number,
): ShippingOption[] {
  const effectivePostcode = country === 'AU' ? postcode : '';
  return getShippingOptions(effectivePostcode, country, subtotal);
}

export function updateTotal(subtotal: number, shippingFee: number): number {
  return subtotal + shippingFee;
}



// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-xs text-red-600 flex items-center gap-1" role="alert">
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {message}
    </p>
  );
}

function inputCls(hasError: boolean, extra = '') {
  return [
    'w-full px-3.5 py-3 border rounded-lg text-sm text-gray-900 placeholder-gray-400',
    'transition-colors focus:outline-none focus:ring-0',
    hasError
      ? 'border-red-400 focus:border-red-500'
      : 'border-gray-300 focus:border-brand-primary',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

function selectCls(hasError: boolean) {
  return inputCls(hasError, 'appearance-none bg-white pr-8 cursor-pointer');
}

function fmtAud(amount: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount || 0);
}

function formatAddress(address: CheckoutAddress | undefined): string {
  if (!address) return '(not provided)';
  return [
    address.fullName,
    address.address1,
    address.address2,
    address.city,
    address.state,
    address.postcode,
    address.country,
  ].filter(Boolean).join(', ') || '(not provided)';
}

// ---------------------------------------------------------------------------
// Amazon Location Service address autocomplete
// ---------------------------------------------------------------------------

type AutocompleteAddressFields = {
  address1: string;
  city: string;
  state: string;
  postcode: string;
};

interface AwsAddress {
  Label?: string;
  AddressNumber?: string;
  Street?: string;
  Locality?: string;
  Region?: { Name?: string; Code?: string };
  PostalCode?: string;
}

interface AwsSuggestion {
  PlaceId: string;
  PlaceType: string;
  Title: string;
  Address: AwsAddress;
}

interface AwsAutocompleteResponse {
  ResultItems?: AwsSuggestion[];
}

function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  onBlur,
  hasError,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onAddressSelect: (fields: AutocompleteAddressFields) => void;
  onBlur: () => void;
  hasError: boolean;
  disabled?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<AwsSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIdx(-1);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Cancel in-flight requests on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchSuggestions = useCallback(async (input: string, signal: AbortSignal) => {
    if (!AWS_LOCATION_KEY || input.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(
        `https://places.geo.${AWS_LOCATION_REGION}.amazonaws.com/v2/autocomplete?key=${AWS_LOCATION_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            QueryText: input,
            MaxResults: 5,
            Filter: { IncludeCountries: ['AUS'] },
            AdditionalFeatures: ['Core'],
            Language: 'en',
          }),
          signal,
        },
      );
      if (!res.ok) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      const data: AwsAutocompleteResponse = await res.json() as AwsAutocompleteResponse;
      const items = data.ResultItems ?? [];
      setSuggestions(items);
      setOpen(items.length > 0);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setSuggestions([]);
      setOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      onChange(v);
      setActiveIdx(-1);
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        abortRef.current = new AbortController();
        fetchSuggestions(v, abortRef.current.signal);
      }, 300);
    },
    [onChange, fetchSuggestions],
  );

  const handleSelect = useCallback(
    (suggestion: AwsSuggestion) => {
      const addr = suggestion.Address;
      const address1 = [addr.AddressNumber, addr.Street].filter(Boolean).join(' ') || suggestion.Title;
      const fields: AutocompleteAddressFields = {
        address1,
        city: addr.Locality ?? '',
        state: addr.Region?.Code ?? '',
        postcode: addr.PostalCode ?? '',
      };
      onAddressSelect(fields);
      onChange(fields.address1);
      setSuggestions([]);
      setOpen(false);
      setActiveIdx(-1);
    },
    [onAddressSelect, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open || !suggestions.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, -1));
      } else if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault();
        handleSelect(suggestions[activeIdx]);
      } else if (e.key === 'Escape') {
        setOpen(false);
        setActiveIdx(-1);
      }
    },
    [open, suggestions, activeIdx, handleSelect],
  );

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder="Street address"
        aria-label="Street address"
        aria-autocomplete="list"
        aria-expanded={open}
        autoComplete="off"
        className={inputCls(hasError)}
        disabled={disabled}
      />
      {isLoading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <span className="w-4 h-4 border-2 border-gray-300 border-t-brand-primary rounded-full animate-spin block" />
        </span>
      )}
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto"
        >
          {suggestions.map((s, i) => {
            const addr = s.Address;
            const mainText = [addr.AddressNumber, addr.Street].filter(Boolean).join(' ') || s.Title;
            const secondaryParts = [addr.Locality, addr.Region?.Code, addr.PostalCode].filter(Boolean);
            const secondaryText = secondaryParts.join(', ');
            return (
              <li
                key={s.PlaceId}
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={() => handleSelect(s)}
                className={`px-4 py-3 text-sm cursor-pointer select-none flex items-start gap-2 ${
                  i === activeIdx ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>
                  <span className="font-medium text-gray-900">{mainText}</span>
                  {secondaryText && (
                    <span className="text-gray-500 ml-1">{secondaryText}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = PURCHASE_NOTIFICATION_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function serverEmailIsConfigured(): Promise<boolean> {
  if (!API_URL) return false;
  try {
    const res = await fetchWithTimeout(`${API_URL}/email-status`);
    if (!res.ok) return false;
    const data = await res.json() as { configured?: boolean };
    return data.configured === true;
  } catch {
    return false;
  }
}

function getPurchaseNotificationKey(sessionId: string | null, items: Array<{ name: string; quantity: number }>, email: string): string {
  const stablePart = sessionId || `${email}:${items.map((item) => `${item.name}x${item.quantity}`).join('|')}`;
  return `neurotonics-purchase-notification:${stablePart}`;
}

async function sendWeb3FormsPurchaseNotification({
  sessionId,
  items,
  subtotal,
}: {
  sessionId: string | null;
  items: Array<{ name: string; price: number; quantity: number }>;
  subtotal: number;
}) {
  if (!WEB3FORMS_KEY || items.length === 0) return;

  const checkout = loadCheckoutData();
  const shipping = loadShipping();
  const customerName = checkout?.address.fullName || '';
  const customerEmail = checkout?.contact.email || '';
  const customerPhone = checkout?.contact.phone || '';
  const shippingFee = shipping?.option.fee ?? 0;
  const total = subtotal + shippingFee;
  const notificationKey = getPurchaseNotificationKey(sessionId, items, customerEmail);

  try {
    if (localStorage.getItem(notificationKey)) return;
    localStorage.setItem(notificationKey, 'pending');
  } catch {
    // If localStorage is unavailable, continue and rely on cart clearing below.
  }

  if (await serverEmailIsConfigured()) return;

  const payload = {
    access_key: WEB3FORMS_KEY,
    subject: `Product Purchased — ${customerName || customerEmail || 'Neurotonics customer'} — ${fmtAud(total)}`,
    from_name: customerName || 'Neurotonics checkout',
    botcheck: '',
    'Notification Source': 'Stripe Checkout success redirect',
    'Stripe Checkout Session': sessionId || '(not provided)',
    'Customer Name': customerName || '(not provided)',
    'Customer Email': customerEmail || '(not provided)',
    'Customer Phone': customerPhone || '(not provided)',
    'Shipping Address': formatAddress(checkout?.address),
    'Shipping Method': shipping?.option.name || shipping?.option.zone || '(not provided)',
    'Shipping Fee': fmtAud(shippingFee),
    'Items': items.map((item) => `${item.name} x${item.quantity} @ ${fmtAud(item.price)}`).join('\n'),
    'Subtotal': fmtAud(subtotal),
    'Total': fmtAud(total),
  };

  const res = await fetchWithTimeout('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({})) as { success?: boolean; message?: string };
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Web3Forms purchase notification failed');
  }

  try {
    localStorage.setItem(notificationKey, 'sent');
  } catch {
    // Ignore localStorage write failures; the checkout data is cleared next.
  }
}

function ChevronDown() {
  return (
    <svg className="w-4 h-4 text-gray-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Success / cancel / empty views
// ---------------------------------------------------------------------------

function SuccessView({ sessionId }: { sessionId: string | null }) {
  const { items, subtotal, clearCart } = useCart();
  const [orderSnapshot] = useState(() => {
    const checkout = loadCheckoutData();
    const shipping = loadShipping();
    const itemSnapshot = items.map((item) => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));
    const shippingFee = shipping?.option.fee ?? 0;
    return {
      checkout,
      shipping,
      items: itemSnapshot,
      subtotal,
      shippingFee,
      total: subtotal + shippingFee,
    };
  });
  const confirmationRef = sessionId ? sessionId.slice(-8).toUpperCase() : null;
  const hasOrderDetails = Boolean(
    confirmationRef ||
    orderSnapshot.checkout?.contact.email ||
    orderSnapshot.checkout?.address.fullName ||
    orderSnapshot.items.length,
  );

  useEffect(() => {
    let cancelled = false;

    async function notifyThenClear() {
      try {
        await sendWeb3FormsPurchaseNotification({
          sessionId,
          items: orderSnapshot.items,
          subtotal: orderSnapshot.subtotal,
        });
      } catch (err) {
        console.error('[checkout] Purchase notification fallback failed:', err);
      } finally {
        if (cancelled) return;
        clearCart();
        clearShipping();
        clearCheckoutData();
      }
    }

    notifyThenClear();

    return () => {
      cancelled = true;
    };
  }, [clearCart, orderSnapshot, sessionId]);

  return (
    <main className="bg-gray-50 min-h-screen px-4 py-10 sm:py-16">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-10">
        <section className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-blue-500 text-blue-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                {confirmationRef && (
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Confirmation #{confirmationRef}</p>
                )}
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Thank You for Your Purchase</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Payment successful. Your order is confirmed and we&apos;ll email your receipt and updates shortly.
                </p>
              </div>
            </div>
          </div>

          {hasOrderDetails && (
            <div id="order-details" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
              <h2 className="text-lg font-bold text-gray-900 mb-5">Order details</h2>
              <div className="grid sm:grid-cols-2 gap-6 text-sm">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Contact information</h3>
                  <p className="text-gray-600">{orderSnapshot.checkout?.contact.email || '(not provided)'}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Payment status</h3>
                  <p className="text-green-700 font-medium">Paid successfully</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Shipping address</h3>
                  <p className="text-gray-600 whitespace-pre-line">{formatAddress(orderSnapshot.checkout?.address).replace(/, /g, '\n')}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Shipping method</h3>
                  <p className="text-gray-600">{orderSnapshot.shipping?.option.name || 'Standard'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <a href={withBasePath('/')} className="inline-flex justify-center px-5 py-3 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold rounded-xl transition-colors text-sm">
              Continue shopping
            </a>
          </div>
        </section>

        <aside className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 h-fit">
          <h2 className="text-lg font-bold text-gray-900 mb-5">Order summary</h2>
          <div className="space-y-4">
            {orderSnapshot.items.length > 0 ? orderSnapshot.items.map((item) => (
              <div key={item.name} className="flex justify-between gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-gray-500">Qty {item.quantity}</p>
                </div>
                <p className="font-medium text-gray-900">{fmtAud(item.price * item.quantity)}</p>
              </div>
            )) : (
              <p className="text-sm text-gray-500">Order summary will be included in your confirmation email.</p>
            )}
            <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{fmtAud(orderSnapshot.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span>{fmtAud(orderSnapshot.shippingFee)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 pt-2">
                <span>Total</span>
                <span>{fmtAud(orderSnapshot.total)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function CancelView() {
  return (
    <main className="bg-white min-h-screen flex items-center justify-center">
      <div className="text-center px-4 max-w-lg">
        <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Payment Cancelled</h1>
        <p className="text-gray-500 mb-8">
          No charges were made. Your cart is still saved — you can retry whenever you&apos;re ready.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/cart" className="inline-flex items-center justify-center px-6 py-3 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold rounded-xl transition-all duration-300">
            Return to Cart
          </Link>
          <Link href="/product" className="inline-flex items-center justify-center px-6 py-3 border border-brand-primary text-brand-primary hover:bg-brand-primary-light rounded-xl font-medium transition-all duration-300">
            Continue Shopping
          </Link>
        </div>
      </div>
    </main>
  );
}

function EmptyCartView() {
  return (
    <main className="bg-white min-h-screen flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h1>
        <Link href="/product" className="inline-flex items-center px-6 py-3 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold rounded-xl transition-all duration-300">
          Shop Brain Boost 1000
        </Link>
      </div>
    </main>
  );
}


// ---------------------------------------------------------------------------
// Order summary panel (right column)
// ---------------------------------------------------------------------------

function OrderSummaryPanel({
  items,
  subtotal,
  selectedShipping,
  discountCode,
  onDiscountCodeChange,
}: {
  items: Array<{ name: string; price: number; quantity: number; image?: string }>;
  subtotal: number;
  selectedShipping: ShippingOption | null;
  discountCode: string;
  onDiscountCodeChange: (v: string) => void;
}) {
  const total = updateTotal(subtotal, selectedShipping?.fee ?? 0);

  return (
    <div className="space-y-5">
      {/* Product list */}
      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 bg-white">
                {item.image ? (
                  <Image
                    src={withBasePath(item.image)}
                    alt={item.name}
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                    </svg>
                  </div>
                )}
              </div>
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-500 text-white text-xs font-bold flex items-center justify-center">
                {item.quantity}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
            </div>
            <p className="text-sm font-medium text-gray-900 flex-shrink-0">
              ${(item.price * item.quantity).toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      {/* Discount code */}
      <div className="flex gap-2">
        <input
          type="text"
          value={discountCode}
          onChange={(e) => onDiscountCodeChange(e.target.value)}
          placeholder="Discount code"
          className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-primary"
        />
        <button
          type="button"
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          Apply
        </button>
      </div>

      <div className="border-t border-gray-200" />

      {/* Price breakdown */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Shipping</span>
          {selectedShipping ? (
            <span className="font-medium text-gray-900">
              {selectedShipping.fee === 0 ? (
                <span className="text-green-600 font-semibold">FREE</span>
              ) : (
                `$${selectedShipping.fee.toFixed(2)}`
              )}
            </span>
          ) : (
            <span className="text-gray-400 text-xs italic">Enter shipping address</span>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200" />

      {/* Total */}
      <div className="flex justify-between items-baseline">
        <span className="text-base font-bold text-gray-900">Total</span>
        <div className="text-right">
          <span className="text-xs text-gray-400 mr-1">AUD</span>
          <span className="text-2xl font-bold text-gray-900">${total.toFixed(2)}</span>
        </div>
      </div>

      {/* Trust badge */}
      <div className="flex items-center gap-2 justify-center pt-2">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span className="text-xs text-gray-400">Secure checkout powered by Stripe</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Main checkout content
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Main checkout content
// ---------------------------------------------------------------------------

function CheckoutContent({
  urlPostcode,
  urlCountry,
  urlShippingId,
}: {
  urlPostcode: string | null;
  urlCountry: string | null;
  urlShippingId: string | null;
}) {
  const { items, subtotal } = useCart();

  // Form state
  const [contact, setContact] = useState<CheckoutContact>({ email: '', phone: '' });
  const [address, setAddress] = useState<CheckoutAddress>({
    fullName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postcode: urlPostcode ?? '',
    country: urlCountry ?? 'AU',
  });

  // Split first/last name for Metagenics-style UX
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Sync fullName whenever first/last changes
  useEffect(() => {
    const full = [firstName, lastName].filter(Boolean).join(' ');
    setAddress((prev) => ({ ...prev, fullName: full }));
  }, [firstName, lastName]);

  // Shipping
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);

  // Extra UX
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [authorityToLeave, setAuthorityToLeave] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [mobileOrderSummaryOpen, setMobileOrderSummaryOpen] = useState(false);

  // Validation
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Payment — Stripe Checkout redirect
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Derived
  const isAustralia = address.country === 'AU';
  const total = updateTotal(subtotal, selectedShipping?.fee ?? 0);

  // Pre-warm the Render server so it is already running by the time the
  // user clicks Pay. Render free tier spins down after inactivity; without
  // this the first request can take 50+ seconds.
  useEffect(() => {
    if (API_URL) fetch(`${API_URL}/health`).catch(() => {});
  }, []);

  // Restore saved data on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import('@/lib/checkoutState'),
      import('@/lib/shippingState'),
    ]).then(([{ loadCheckoutData }, { loadShipping }]) => {
      if (cancelled) return;
      const savedCheckout = loadCheckoutData();
      if (savedCheckout) {
        setContact(savedCheckout.contact);
        setAddress(() => ({
          ...savedCheckout.address,
          postcode: urlPostcode ?? savedCheckout.address.postcode,
          country: urlCountry ?? savedCheckout.address.country,
        }));
        const parts = (savedCheckout.address.fullName ?? '').split(' ');
        setFirstName(parts[0] ?? '');
        setLastName(parts.slice(1).join(' ') ?? '');
      } else if (urlPostcode || urlCountry) {
        setAddress((prev) => ({
          ...prev,
          postcode: urlPostcode ?? prev.postcode,
          country: urlCountry ?? prev.country,
        }));
      }
      const savedShipping = loadShipping();
      if (savedShipping?.option) setSelectedShipping(savedShipping.option);
    });
    return () => { cancelled = true; };
  }, [urlPostcode, urlCountry]);

  // Compute shipping options when address changes
  const computeShippingOptions = useCallback(
    (postcode: string, country: string, sub: number) => {
      const isAU = country === 'AU';
      if (isAU && !/^\d{4}$/.test(postcode)) {
        setShippingOptions([]);
        return;
      }
      const options = calculateShipping(postcode, country, sub);
      setShippingOptions(options);
      setSelectedShipping((prev) => {
        const stillAvail = options.find((o) => o.id === prev?.id);
        if (stillAvail) return stillAvail;
        const effectivePostcode = isAU ? postcode : '';
        const byId = urlShippingId
          ? options.find((o) => o.id === urlShippingId)
          : null;
        return byId ?? getDefaultShippingOption(effectivePostcode, country, sub);
      });
    },
    [urlShippingId],
  );

  useEffect(() => {
    computeShippingOptions(address.postcode, address.country, subtotal);
  }, [address.postcode, address.country, subtotal, computeShippingOptions]);

  // Auto-save form data
  useEffect(() => {
    if (!contact.email && !contact.phone && !address.fullName && !address.address1) return;
    import('@/lib/checkoutState').then(({ saveCheckoutData }) => {
      saveCheckoutData({ contact, address });
    });
  }, [contact, address]);

  useEffect(() => {
    if (!selectedShipping) return;
    import('@/lib/shippingState').then(({ saveShipping }) => {
      saveShipping({ option: selectedShipping, postcode: address.postcode, country: address.country });
    });
  }, [selectedShipping, address.postcode, address.country]);

  // Clear saved data when the user navigates away from the checkout page
  useEffect(() => {
    return () => {
      clearCheckoutData();
      clearShipping();
    };
  }, []);

  // Re-validate on change after a submit attempt
  useEffect(() => {
    if (!submitAttempted) return;
    setErrors(validateCheckoutForm(contact, address, selectedShipping));
  }, [contact, address, selectedShipping, submitAttempted]);

  // Redirect to Stripe Checkout when user clicks Pay
  const handleCheckout = useCallback(async () => {
    const { valid, contact, address } = validateAndGetData();
    if (!valid) return;

    setIsCheckingOut(true);
    setCheckoutError('');

    const checkoutUrl = new URL(window.location.href);
    const successPath = checkoutUrl.pathname.replace(/\/checkout\/?$/, '/success');
    const successUrl = `${checkoutUrl.origin}${successPath}?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = `${checkoutUrl.origin}${checkoutUrl.pathname}?canceled=true`;

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetchWithTimeout(`${API_URL}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          items: items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
          shipping: selectedShipping,
          customerEmail: contact.email || undefined,
          customerPhone: contact.phone || undefined,
          shippingAddress: address,
          successUrl,
          cancelUrl,
        }),
      }, CHECKOUT_SESSION_TIMEOUT_MS);
      clearTimeout(timeoutId);
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        // Safety fallback: if redirect hasn't fired within 5s, re-enable button
        setTimeout(() => setIsCheckingOut(false), 5000);
      } else {
        setCheckoutError(data.error ?? 'Unable to start checkout. Please try again.');
        setIsCheckingOut(false);
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      setCheckoutError(
        isTimeout
          ? 'The server took too long to respond. It may be starting up — please wait 10 seconds and try again.'
          : 'A network error occurred. Please check your connection and try again.'
      );
      setIsCheckingOut(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, selectedShipping, contact, address, total]);

  // Field helpers
  const touchField = useCallback(
    (name: string) => {
      setTouched((prev) => new Set(prev).add(name));
      if (!submitAttempted) {
        const errs = validateCheckoutForm(contact, address, selectedShipping);
        setErrors((prev) => {
          const next = { ...prev };
          if (errs[name as keyof FormErrors]) {
            next[name as keyof FormErrors] = errs[name as keyof FormErrors];
          } else {
            delete next[name as keyof FormErrors];
          }
          return next;
        });
      }
    },
    [contact, address, selectedShipping, submitAttempted],
  );

  const showError = useCallback(
    (field: string): string =>
      submitAttempted || touched.has(field)
        ? (errors[field as keyof FormErrors] ?? '')
        : '',
    [submitAttempted, touched, errors],
  );

  // Validate and return data for PaymentSectionInner
  const validateAndGetData = useCallback(() => {
    setSubmitAttempted(true);
    const errs = validateCheckoutForm(contact, address, selectedShipping);
    setErrors(errs);
    const valid = Object.keys(errs).length === 0;
    if (!valid) {
      setTimeout(() => {
        const firstErr = document.querySelector('[data-field-error="true"]') as HTMLElement;
        firstErr?.closest('[data-form-field]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
    return { valid, contact, address };
  }, [contact, address, selectedShipping]);

  // successRedirect is no longer used (Stripe Checkout redirects via URL params)

  const hasBlockingErrors = submitAttempted && Object.keys(errors).length > 0;

  return (
    <div className="max-w-[1280px] mx-auto w-full">
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-6rem)]">

      {/* Mobile: collapsible order summary */}
      <div className="lg:hidden bg-gray-50 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setMobileOrderSummaryOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-4 text-sm font-medium text-brand-primary"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            {mobileOrderSummaryOpen ? 'Hide' : 'Show'} order summary
          </span>
          <span className="flex items-center gap-2">
            <span className="font-bold text-gray-900">${total.toFixed(2)}</span>
            <svg className={`w-4 h-4 transition-transform ${mobileOrderSummaryOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>
        {mobileOrderSummaryOpen && (
          <div className="px-4 pb-5">
            <OrderSummaryPanel
              items={items}
              subtotal={subtotal}
              selectedShipping={selectedShipping}
              discountCode={discountCode}
              onDiscountCodeChange={setDiscountCode}
            />
          </div>
        )}
      </div>

      {/* Left column: form */}
      <div className="flex-1 bg-white">
        <div className="max-w-xl mx-auto px-4 sm:px-8 lg:px-12 py-8 lg:py-12">

          <Link href="/cart" className="inline-flex items-center text-sm text-gray-500 hover:text-brand-primary transition-colors mb-8">
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to cart
          </Link>


          {/* Contact section */}
          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Contact</h2>
            <div className="space-y-3">
              <div data-form-field>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={contact.email}
                  onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))}
                  onBlur={() => touchField('email')}
                  placeholder="Email"
                  aria-label="Email address"
                  className={inputCls(!!showError('email'))}
                  aria-describedby={showError('email') ? 'email-error' : undefined}
                />
                <span id="email-error" data-field-error={!!showError('email') || undefined}>
                  <FieldError message={showError('email')} />
                </span>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={emailOptIn}
                  onChange={(e) => setEmailOptIn(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-brand-primary"
                />
                <span className="text-sm text-gray-600">Email me with news and offers</span>
              </label>
            </div>
          </section>

          {/* Delivery section */}
          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Delivery</h2>
            <div className="space-y-3">

              {/* Country — Australia only */}
              <div data-form-field>
                <div className="flex items-center gap-2 px-3.5 py-3 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700">
                  <span className="text-base leading-none">🇦🇺</span>
                  <span>Australia</span>
                </div>
              </div>

              {/* First + Last name */}
              <div className="grid grid-cols-2 gap-3">
                <div data-form-field>
                  <input
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onBlur={() => touchField('fullName')}
                    placeholder="First name"
                    aria-label="First name"
                    className={inputCls(!!showError('fullName') && !firstName)}
                  />
                </div>
                <div data-form-field>
                  <input
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onBlur={() => touchField('fullName')}
                    placeholder="Last name"
                    aria-label="Last name"
                    className={inputCls(!!showError('fullName') && !lastName)}
                  />
                  <span data-field-error={!!showError('fullName') || undefined}>
                    <FieldError message={showError('fullName')} />
                  </span>
                </div>
              </div>

              {/* Street address */}
              <div data-form-field>
                <AddressAutocomplete
                  value={address.address1}
                  onChange={(v) => setAddress((p) => ({ ...p, address1: v }))}
                  onAddressSelect={(fields) =>
                    setAddress((p) => ({
                      ...p,
                      address1: fields.address1,
                      city: fields.city || p.city,
                      state: fields.state || p.state,
                      postcode: fields.postcode || p.postcode,
                    }))
                  }
                  onBlur={() => touchField('address1')}
                  hasError={!!showError('address1')}
                  disabled={isCheckingOut}
                />
                <span data-field-error={!!showError('address1') || undefined}>
                  <FieldError message={showError('address1')} />
                </span>
              </div>

              {/* Address line 2 */}
              <div>
                <input
                  type="text"
                  autoComplete="address-line2"
                  value={address.address2}
                  onChange={(e) => setAddress((p) => ({ ...p, address2: e.target.value }))}
                  placeholder="Apartment, suite, unit, etc. (optional)"
                  aria-label="Address line 2"
                  className={inputCls(false)}
                />
              </div>

              {/* Suburb / State / Postcode row */}
              <div className="grid gap-3 grid-cols-3">
                {/* Suburb */}
                <div data-form-field>
                  <input
                    type="text"
                    autoComplete="address-level2"
                    value={address.city}
                    onChange={(e) => setAddress((p) => ({ ...p, city: e.target.value }))}
                    onBlur={() => touchField('city')}
                    placeholder="Suburb"
                    aria-label="Suburb / City"
                    className={inputCls(!!showError('city'))}
                  />
                  <span data-field-error={!!showError('city') || undefined}>
                    <FieldError message={showError('city')} />
                  </span>
                </div>

                {/* State */}
                <div data-form-field>
                  <div className="relative">
                    <select
                      autoComplete="address-level1"
                      value={address.state}
                      onChange={(e) => setAddress((p) => ({ ...p, state: e.target.value }))}
                      onBlur={() => touchField('state')}
                      className={selectCls(!!showError('state'))}
                      aria-label="State / Territory"
                    >
                      <option value="">State</option>
                      {AU_STATES.map((s) => (
                        <option key={s.code} value={s.code}>{s.code}</option>
                      ))}
                    </select>
                    <ChevronDown />
                  </div>
                  <span data-field-error={!!showError('state') || undefined}>
                    <FieldError message={showError('state')} />
                  </span>
                </div>

                {/* Postcode */}
                <div data-form-field>
                  <input
                    type="text"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    value={address.postcode}
                    onChange={(e) =>
                      setAddress((p) => ({
                        ...p,
                        postcode: e.target.value.replace(/\D/g, '').slice(0, 4),
                      }))
                    }
                    onBlur={() => touchField('postcode')}
                    placeholder="Postcode"
                    maxLength={4}
                    aria-label="Postcode"
                    className={inputCls(!!showError('postcode'))}
                  />
                  <span data-field-error={!!showError('postcode') || undefined}>
                    <FieldError message={showError('postcode')} />
                  </span>
                </div>
              </div>

              {/* Phone */}
              <div data-form-field>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={contact.phone}
                  onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))}
                  onBlur={() => touchField('phone')}
                  placeholder="Phone"
                  aria-label="Phone number"
                  className={inputCls(!!showError('phone'))}
                  aria-describedby={showError('phone') ? 'phone-error' : undefined}
                />
                <span id="phone-error" data-field-error={!!showError('phone') || undefined}>
                  <FieldError message={showError('phone')} />
                </span>
              </div>

            </div>
          </section>

          {/* Shipping method section */}
          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Shipping method</h2>
            {shippingOptions.length > 0 ? (
              <div className="space-y-3">
                {shippingOptions.map((option) => {
                  const isSelected = selectedShipping?.id === option.id;
                  return (
                    <label
                      key={option.id}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-brand-primary bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="shipping-option"
                        value={option.id}
                        checked={isSelected}
                        onChange={() => setSelectedShipping(option)}
                        className="accent-brand-primary flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{option.name}</span>
                          {option.recommended && (
                            <span className="px-1.5 py-0.5 bg-brand-primary text-white text-xs rounded font-medium">Best value</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{option.estimatedDays}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {option.fee === 0 ? (
                          <span className="text-sm font-bold text-green-600">FREE</span>
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">${option.fee.toFixed(2)}</span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-500 text-center">
                  {isAustralia
                    ? 'Enter your shipping address above to view available shipping methods.'
                    : 'Select your country to view available shipping methods.'}
                </p>
              </div>
            )}
            {showError('shipping') && (
              <div className="mt-2" data-field-error="true">
                <FieldError message={showError('shipping')} />
              </div>
            )}
          </section>

          {/* Authority to leave */}
          <section className="mb-8">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={authorityToLeave}
                onChange={(e) => setAuthorityToLeave(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-brand-primary flex-shrink-0"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Authority to leave (optional)</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  By choosing this, you permit our delivery partner to leave your parcel at your
                  specified address without requiring a signature. Once delivered, responsibility
                  for any loss or damage passes to you.
                </p>
              </div>
            </label>
          </section>

          {/* Payment section */}
          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Payment</h2>
            <p className="text-xs text-brand-primary mb-4 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              All transactions are secure and encrypted.
            </p>

            {checkoutError && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
                {checkoutError}
              </div>
            )}

            <p className="mb-4 text-xs text-gray-400 leading-relaxed">
              By clicking &ldquo;Pay now&rdquo;, you agree to our{' '}
              <Link href="/terms" className="underline hover:text-gray-600">Terms of Service</Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>.
              All transactions are secure and encrypted.
            </p>

            <button
              type="button"
              disabled={!selectedShipping || isCheckingOut || hasBlockingErrors}
              onClick={handleCheckout}
              className="w-full py-4 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold rounded-xl text-base transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCheckingOut ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Redirecting to payment…
                </>
              ) : (
                `Pay now · $${total.toFixed(2)} AUD`
              )}
            </button>

            {!selectedShipping && (
              <p className="mt-2 text-xs text-gray-400 text-center">Select a shipping method above to continue.</p>
            )}
          </section>

          {/* Footer policy links */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-400 border-t border-gray-100 pt-5">
            {['Refund policy', 'Privacy policy', 'Terms of service', 'Cancellations'].map((label) => (
              <a key={label} href="#" className="hover:text-gray-600 transition-colors underline">{label}</a>
            ))}
          </div>

          {/* Health disclaimer */}
          <div className="mt-4 p-3.5 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong>Always read the label and follow the directions for use.</strong> Read the
              warnings before purchase. For best health outcomes, we recommend seeking personalised
              health advice from a qualified healthcare practitioner.
            </p>
          </div>

        </div>
      </div>

      {/* Right column: order summary (desktop sticky) */}
      <aside className="hidden lg:block w-[420px] xl:w-[480px] bg-gray-50 border-l border-gray-200 flex-shrink-0">
        <div className="px-8 xl:px-12 py-12 sticky top-24">
          <OrderSummaryPanel
            items={items}
            subtotal={subtotal}
            selectedShipping={selectedShipping}
            discountCode={discountCode}
            onDiscountCodeChange={setDiscountCode}
          />
        </div>
      </aside>

    </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------

export default function CheckoutClient() {
  const { items } = useCart();
  const search = useSyncExternalStore(subscribeSearchParams, getSearchSnapshot, getServerSearchSnapshot);
  const query = new URLSearchParams(search);

  // Detect payment success from both inline (redirect_status) and legacy (?success=true) flows
  const isSuccess =
    query.get('success') === 'true' ||
    query.get('redirect_status') === 'succeeded';
  const isCanceled = query.get('canceled') === 'true';

  const urlPostcode = query.get('postcode');
  const urlCountry = query.get('country');
  const urlShippingId = query.get('shipping');

  if (isSuccess) return <SuccessView sessionId={query.get('session_id')} />;
  if (isCanceled) return <CancelView />;
  if (items.length === 0) return <EmptyCartView />;

  return (
    <CheckoutContent
      urlPostcode={urlPostcode}
      urlCountry={urlCountry}
      urlShippingId={urlShippingId}
    />
  );
}
