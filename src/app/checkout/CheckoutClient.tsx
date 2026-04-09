'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { loadStripe, type PaymentRequest } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  PaymentRequestButtonElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { useCart } from '@/lib/cart';
import { withBasePath } from '@/lib/basePath';
import {
  getShippingOptions,
  getDefaultShippingOption,
  type ShippingOption,
} from '@/lib/shipping';
import type { CheckoutContact, CheckoutAddress } from '@/lib/checkoutState';

// ---------------------------------------------------------------------------
// Stripe singleton (initialised once at module level)
// ---------------------------------------------------------------------------

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
);

const stripeAppearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#0a195a',
    colorBackground: '#ffffff',
    colorText: '#111928',
    colorDanger: '#ef4444',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif',
    borderRadius: '8px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': { border: '1px solid #d1d5db', padding: '12px 14px' },
    '.Input:focus': { border: '1px solid #0a195a', boxShadow: 'none' },
    '.Label': { fontWeight: '500', fontSize: '13px', color: '#374151' },
  },
};

// ---------------------------------------------------------------------------
// Constants (exported for tests)
// ---------------------------------------------------------------------------

export const COUNTRIES = [
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'SG', name: 'Singapore' },
  { code: 'JP', name: 'Japan' },
  { code: 'OTHER', name: 'Other country' },
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

  if (!address.address1.trim()) {
    errors.address1 = 'Address is required';
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
// Google Places address autocomplete helpers
// ---------------------------------------------------------------------------

const GOOGLE_PLACES_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

/** Minimum characters before address suggestions are fetched */
const ADDRESS_AUTOCOMPLETE_MIN_CHARS = 2;

/** Nominatim User-Agent – required by OpenStreetMap usage policy */
const NOMINATIM_USER_AGENT = 'Neurotonics/1.0 (neurotonics.com.au)';

interface PlaceSuggestion {
  placeId: string;
  description: string;
  /** Pre-parsed address (populated by Nominatim, skips a second fetch) */
  parsedAddress?: ParsedAddress;
}

// ---------------------------------------------------------------------------
// Nominatim (OpenStreetMap) address helpers – used when no Google key is set
// ---------------------------------------------------------------------------

interface NominatimResult {
  place_id: number;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country_code?: string;
  };
}

/** Australian state full-name → abbreviation map (used with Nominatim results) */
const AU_STATE_ABBR: Record<string, string> = {
  'New South Wales': 'NSW',
  Victoria: 'VIC',
  Queensland: 'QLD',
  'South Australia': 'SA',
  'Western Australia': 'WA',
  Tasmania: 'TAS',
  'Australian Capital Territory': 'ACT',
  'Northern Territory': 'NT',
};

function parseNominatimResult(result: NominatimResult): ParsedAddress {
  const a = result.address;
  const address1 = [a.house_number, a.road].filter(Boolean).join(' ');
  const city =
    a.suburb || a.city || a.town || a.village || a.county || '';
  const stateAbbr = AU_STATE_ABBR[a.state ?? ''] ?? (a.state ?? '');
  return {
    address1,
    city,
    state: stateAbbr,
    postcode: a.postcode ?? '',
    country: (a.country_code ?? '').toUpperCase(),
  };
}

interface ParsedAddress {
  address1: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

function parseAddressComponents(
  components: Array<{ longText: string; shortText: string; types: string[] }>,
): ParsedAddress {
  const find = (type: string, short = false) => {
    const c = components.find((comp) => comp.types.includes(type));
    return c ? (short ? c.shortText : c.longText) : '';
  };

  const subpremise = find('subpremise');
  const streetNumber = find('street_number');
  const route = find('route');
  const address1 = [subpremise, streetNumber, route].filter(Boolean).join(' ');

  const city =
    find('locality') ||
    find('sublocality_level_1') ||
    find('postal_town') ||
    find('administrative_area_level_2');

  return {
    address1,
    city,
    state: find('administrative_area_level_1', true), // e.g. "NSW"
    postcode: find('postal_code'),
    country: find('country', true), // e.g. "AU"
  };
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

function SuccessView() {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
    import('@/lib/shippingState').then(({ clearShipping }) => clearShipping());
    import('@/lib/checkoutState').then(({ clearCheckoutData }) =>
      clearCheckoutData(),
    );
  }, [clearCart]);

  return (
    <main className="bg-white min-h-screen flex items-center justify-center">
      <div className="text-center px-4 max-w-lg">
        <div className="w-20 h-20 mx-auto rounded-full bg-brand-primary flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Order Confirmed!</h1>
        <p className="text-gray-600 mb-8">
          Thank you for your purchase! Your Brain Boost 1000 is on its way.
          You&apos;ll receive a confirmation email shortly.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold rounded-xl transition-all duration-300"
        >
          Return Home
        </Link>
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
// Address autocomplete input
// ---------------------------------------------------------------------------

interface AddressAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  onPlaceSelect: (addr: ParsedAddress) => void;
  onManualEntry: () => void;
  country: string;
  hasError: boolean;
  manualMode: boolean;
  disabled?: boolean;
}

function AddressAutocompleteInput({
  value,
  onChange,
  onPlaceSelect,
  onManualEntry,
  country,
  hasError,
  manualMode,
  disabled = false,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchSuggestions = useCallback(
    async (input: string) => {
      if (input.length < ADDRESS_AUTOCOMPLETE_MIN_CHARS) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }
      setIsFetching(true);
      try {
        if (GOOGLE_PLACES_KEY) {
          // Google Places New API
          const res = await fetch(
            'https://places.googleapis.com/v1/places:autocomplete',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
              },
              body: JSON.stringify({
                input,
                includedRegionCodes: [country.toLowerCase()],
                languageCode: 'en-AU',
              }),
            },
          );
          if (!res.ok) { setSuggestions([]); return; }
          const data = await res.json() as { suggestions?: unknown[] };
          const results: PlaceSuggestion[] = ((data.suggestions ?? []) as Record<string, unknown>[])
            .map((s) => {
              const pred = s.placePrediction as Record<string, unknown>;
              const txt = pred?.text as Record<string, unknown>;
              return {
                placeId: (pred?.placeId as string) ?? '',
                description: (txt?.text as string) ?? '',
              };
            })
            .filter((s) => s.placeId);
          setSuggestions(results);
          setIsOpen(true);
        } else {
          // Nominatim (OpenStreetMap) – free, no API key required
          const params = new URLSearchParams({
            format: 'json',
            addressdetails: '1',
            limit: '5',
            q: input,
            countrycodes: country.toLowerCase(),
          });
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?${params.toString()}`,
            { headers: { 'Accept-Language': 'en-AU', 'User-Agent': NOMINATIM_USER_AGENT } },
          );
          if (!res.ok) { setSuggestions([]); return; }
          const data = await res.json() as NominatimResult[];
          const results: PlaceSuggestion[] = data.map((r) => ({
            placeId: String(r.place_id),
            description: r.display_name,
            parsedAddress: parseNominatimResult(r),
          }));
          setSuggestions(results);
          setIsOpen(true);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsFetching(false);
      }
    },
    [country],
  );

  const handleChange = (val: string) => {
    onChange(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (val.length >= ADDRESS_AUTOCOMPLETE_MIN_CHARS) {
      setIsFetching(true);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
    debounceTimer.current = setTimeout(() => fetchSuggestions(val), 350);
  };

  const handleSelect = async (placeId: string, description: string, parsedAddress?: ParsedAddress) => {
    setIsOpen(false);
    setIsSelecting(true);
    onChange(description);
    try {
      if (parsedAddress) {
        // Nominatim result – address already parsed, no second fetch needed
        onChange(parsedAddress.address1 || description);
        onPlaceSelect(parsedAddress);
        return;
      }
      // Google Places – fetch detailed address components
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          headers: {
            'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
            'X-Goog-FieldMask': 'addressComponents,formattedAddress',
          },
        },
      );
      if (!res.ok) { onManualEntry(); return; }
      const data = await res.json() as {
        addressComponents?: Array<{ longText: string; shortText: string; types: string[] }>;
      };
      const parsed = parseAddressComponents(data.addressComponents ?? []);
      onChange(parsed.address1 || description);
      onPlaceSelect(parsed);
    } catch {
      onManualEntry();
    } finally {
      setIsSelecting(false);
    }
  };

  const handleManualEntryFromDropdown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onManualEntry();
      setIsOpen(false);
    },
    [onManualEntry],
  );

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
    }
  };

  // Manual mode → plain text input only
  if (manualMode) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Street address"
        className={inputCls(hasError)}
        autoComplete="address-line1"
        disabled={disabled}
        aria-label="Street address"
      />
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Autocomplete input */}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder="Start typing your address\u2026"
          className={inputCls(hasError, 'pr-10')}
          autoComplete="off"
          disabled={disabled || isSelecting}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="address-suggestions-listbox"
          aria-haspopup="listbox"
          aria-label="Address search"
        />
        {/* Search / loading icon */}
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          {isFetching || isSelecting ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16.65 16.65A7 7 0 1 0 4.93 4.93a7 7 0 0 0 11.72 11.72z" />
            </svg>
          )}
        </span>
      </div>

      {/* Suggestions dropdown – visible as soon as the user types ≥ 2 chars */}
      {isOpen && (
        <ul
          id="address-suggestions-listbox"
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
        >
          {isFetching && suggestions.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Searching for addresses…
            </li>
          )}
          {!isFetching && suggestions.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-400">No results found</li>
          )}
          {suggestions.map((s) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s.placeId, s.description, s.parsedAddress);
              }}
              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-800 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
            >
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {s.description}
            </li>
          ))}
          {/* Enter manually option always at the bottom of the dropdown */}
          <li
            role="option"
            aria-selected={false}
            onMouseDown={handleManualEntryFromDropdown}
            className="flex items-center gap-3 px-4 py-3 text-sm text-brand-primary hover:bg-blue-50 cursor-pointer font-medium border-t border-gray-100"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Enter address manually
          </li>
        </ul>
      )}

      {/* Manual entry link when dropdown is closed */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => { onManualEntry(); setIsOpen(false); }}
          className="mt-1.5 text-xs text-brand-primary hover:underline"
        >
          Enter address manually
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Express checkout (Apple Pay / Google Pay via PaymentRequestButtonElement)
// ---------------------------------------------------------------------------

function ExpressCheckoutInner({
  subtotal,
  apiUrl,
  onSuccess,
}: {
  subtotal: number;
  apiUrl: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const subtotalRef = useRef(subtotal);

  useEffect(() => { subtotalRef.current = subtotal; }, [subtotal]);

  useEffect(() => {
    if (!stripe || !apiUrl) return;

    const pr = stripe.paymentRequest({
      country: 'AU',
      currency: 'aud',
      total: { label: 'Neurotonics Order', amount: Math.round(subtotal * 100) },
      requestPayerName: true,
      requestPayerEmail: true,
      requestShipping: true,
      shippingOptions: [
        { id: 'standard', label: 'Standard Shipping', detail: '3\u20137 business days', amount: 1195 },
        { id: 'express', label: 'Express Shipping', detail: '1\u20133 business days', amount: 1495 },
      ],
    });

    pr.on('shippingoptionchange', (ev) => {
      ev.updateWith({
        status: 'success',
        total: {
          label: 'Neurotonics Order',
          amount: Math.round(subtotalRef.current * 100) + ev.shippingOption.amount,
        },
      });
    });

    pr.on('paymentmethod', async (ev) => {
      const shippingFee = (ev.shippingOption?.amount ?? 1195) / 100;
      const amount = subtotalRef.current + shippingFee;
      try {
        const res = await fetch(`${apiUrl}/create-payment-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount }),
        });
        if (!res.ok) { ev.complete('fail'); return; }
        const data = await res.json() as { clientSecret?: string };
        if (!data.clientSecret) { ev.complete('fail'); return; }
        const { error, paymentIntent } = await stripe.confirmPayment({
          clientSecret: data.clientSecret,
          confirmParams: {
            payment_method: ev.paymentMethod.id,
            return_url: window.location.href.split('?')[0] + '?success=true',
          },
          redirect: 'if_required',
        });
        if (error || !paymentIntent) {
          ev.complete('fail');
        } else {
          ev.complete('success');
          onSuccess();
        }
      } catch {
        ev.complete('fail');
      }
    });

    pr.canMakePayment().then((result) => {
      if (result) setPaymentRequest(pr);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripe, apiUrl]); // subtotal intentionally not in deps — updated via ref

  if (!paymentRequest) return null;

  return (
    <div className="mb-6">
      <p className="text-center text-xs text-gray-400 mb-3 tracking-wide uppercase">Express checkout</p>
      <PaymentRequestButtonElement
        options={{
          paymentRequest,
          style: {
            paymentRequestButton: { type: 'default', theme: 'dark', height: '48px' },
          },
        }}
      />
      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 uppercase tracking-widest">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
    </div>
  );
}

function ExpressCheckoutSection({
  subtotal,
  apiUrl,
  onSuccess,
}: {
  subtotal: number;
  apiUrl: string;
  onSuccess: () => void;
}) {
  return (
    <Elements stripe={stripePromise}>
      <ExpressCheckoutInner subtotal={subtotal} apiUrl={apiUrl} onSuccess={onSuccess} />
    </Elements>
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
// Payment section — must live inside <Elements> to access useStripe/useElements
// ---------------------------------------------------------------------------

interface PaymentSectionProps {
  total: number;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  serverError: string;
  setServerError: (v: string) => void;
  onValidateAndGetData: () => {
    valid: boolean;
    contact: CheckoutContact;
    address: CheckoutAddress;
  };
  onSuccess: () => void;
}

function PaymentSectionInner({
  total,
  isLoading,
  setIsLoading,
  serverError,
  setServerError,
  onValidateAndGetData,
  onSuccess,
}: PaymentSectionProps) {
  const stripe = useStripe();
  const elements = useElements();

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    const { valid, contact, address } = onValidateAndGetData();
    if (!valid) return;

    setIsLoading(true);
    setServerError('');

    try {
      const returnUrl =
        window.location.href.split('?')[0] + '?redirect_status=succeeded';

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
          payment_method_data: {
            billing_details: {
              name: address.fullName,
              email: contact.email,
              phone: contact.phone,
              address: {
                line1: address.address1,
                line2: address.address2 || undefined,
                city: address.city,
                state: address.state,
                postal_code: address.postcode,
                country: address.country,
              },
            },
          },
        },
        redirect: 'if_required',
      });

      if (error) {
        setServerError(error.message ?? 'Payment failed. Please try again.');
        setIsLoading(false);
      } else if (paymentIntent?.status === 'succeeded') {
        onSuccess();
      }
      // For 3DS flows, Stripe redirects automatically — no extra handling needed
    } catch {
      setServerError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handlePay} id="payment-form" noValidate>
      <PaymentElement
        options={{
          layout: 'tabs',
          fields: { billingDetails: 'never' },
        }}
      />

      {serverError && (
        <div className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
          {serverError}
        </div>
      )}

      <p className="mt-5 text-xs text-gray-400 leading-relaxed">
        By clicking &ldquo;Pay now&rdquo;, you agree to our{' '}
        <Link href="/terms" className="underline hover:text-gray-600">Terms of Service</Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>.
        All transactions are secure and encrypted.
      </p>

      <button
        type="submit"
        disabled={!stripe || !elements || isLoading}
        className="mt-4 w-full py-4 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold rounded-xl text-base transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Processing\u2026
          </>
        ) : (
          `Pay now  \u00b7  $${total.toFixed(2)} AUD`
        )}
      </button>
    </form>
  );
}

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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

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

  // Address autocomplete mode
  const [manualAddressMode, setManualAddressMode] = useState(false);

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

  // Payment
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentFailed, setPaymentIntentFailed] = useState(false);
  const [successRedirect, setSuccessRedirect] = useState(false);

  // Derived
  const isAustralia = address.country === 'AU';
  const total = updateTotal(subtotal, selectedShipping?.fee ?? 0);

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

  // Re-validate on change after a submit attempt
  useEffect(() => {
    if (!submitAttempted) return;
    setErrors(validateCheckoutForm(contact, address, selectedShipping));
  }, [contact, address, selectedShipping, submitAttempted]);

  // Create / refresh PaymentIntent when selected shipping or total changes
  useEffect(() => {
    if (!selectedShipping || !apiUrl) return;
    let cancelled = false;
    setClientSecret(null);
    setPaymentIntentFailed(false);
    fetch(`${apiUrl}/create-payment-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: total,
        shipping: selectedShipping,
        customerEmail: contact.email || undefined,
        shippingAddress: address,
      }),
    })
      .then((r) => r.json())
      .then((data: { clientSecret?: string }) => {
        if (!cancelled) {
          if (data.clientSecret) {
            setClientSecret(data.clientSecret);
          } else {
            setPaymentIntentFailed(true);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClientSecret(null);
          setPaymentIntentFailed(true);
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShipping?.id, total, apiUrl]);

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

  // Handle place select from autocomplete
  const handlePlaceSelect = useCallback((parsed: ParsedAddress) => {
    setAddress((prev) => ({
      ...prev,
      address1: parsed.address1 || prev.address1,
      city: parsed.city || prev.city,
      state: parsed.state || prev.state,
      postcode: parsed.postcode || prev.postcode,
      country: parsed.country || prev.country,
    }));
  }, []);

  if (successRedirect) return <SuccessView />;

  const isAU = address.country === 'AU';

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

          {/* Express checkout (Apple Pay / Google Pay) */}
          {apiUrl && (
            <ExpressCheckoutSection
              subtotal={subtotal}
              apiUrl={apiUrl}
              onSuccess={() => setSuccessRedirect(true)}
            />
          )}

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

              {/* Country */}
              <div data-form-field>
                <div className="relative">
                  <select
                    id="country"
                    autoComplete="country"
                    value={address.country}
                    onChange={(e) => {
                      const newCountry = e.target.value;
                      setAddress((p) => ({
                        ...p,
                        country: newCountry,
                        state: newCountry !== 'AU' ? '' : p.state,
                        postcode: newCountry !== 'AU' ? '' : p.postcode,
                      }));
                      setShippingOptions([]);
                      setSelectedShipping(null);
                    }}
                    onBlur={() => touchField('country')}
                    className={selectCls(!!showError('country'))}
                    aria-label="Country / Region"
                  >
                    <option value="" disabled>Country / Region</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown />
                </div>
                <FieldError message={showError('country')} />
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

              {/* Address with Google Places autocomplete */}
              <div data-form-field>
                <AddressAutocompleteInput
                  value={address.address1}
                  onChange={(val) => setAddress((p) => ({ ...p, address1: val }))}
                  onPlaceSelect={handlePlaceSelect}
                  onManualEntry={() => setManualAddressMode(true)}
                  country={address.country}
                  hasError={!!showError('address1')}
                  manualMode={manualAddressMode}
                  disabled={isLoading}
                />
                {manualAddressMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setManualAddressMode(false);
                      setAddress((p) => ({ ...p, address1: '' }));
                    }}
                    className="mt-1.5 text-xs text-brand-primary hover:underline"
                  >
                    Search address instead
                  </button>
                )}
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
              <div className={`grid gap-3 ${isAU ? 'grid-cols-3' : 'grid-cols-2'}`}>
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
                  {isAU ? (
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
                  ) : (
                    <input
                      type="text"
                      autoComplete="address-level1"
                      value={address.state}
                      onChange={(e) => setAddress((p) => ({ ...p, state: e.target.value }))}
                      onBlur={() => touchField('state')}
                      placeholder="State / Region"
                      aria-label="State / Region"
                      className={inputCls(!!showError('state'))}
                    />
                  )}
                  <span data-field-error={!!showError('state') || undefined}>
                    <FieldError message={showError('state')} />
                  </span>
                </div>

                {/* Postcode (AU only in this grid) */}
                {isAU && (
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
                )}
              </div>

              {/* Non-AU postcode */}
              {!isAU && (
                <div data-form-field>
                  <input
                    type="text"
                    autoComplete="postal-code"
                    value={address.postcode}
                    onChange={(e) => setAddress((p) => ({ ...p, postcode: e.target.value.slice(0, 10) }))}
                    onBlur={() => touchField('postcode')}
                    placeholder="Postcode"
                    aria-label="Postcode"
                    className={inputCls(!!showError('postcode'))}
                  />
                  <span data-field-error={!!showError('postcode') || undefined}>
                    <FieldError message={showError('postcode')} />
                  </span>
                </div>
              )}

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

            {clientSecret ? (
              <Elements
                stripe={stripePromise}
                options={{ clientSecret, appearance: stripeAppearance }}
              >
                <PaymentSectionInner
                  total={total}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                  serverError={serverError}
                  setServerError={setServerError}
                  onValidateAndGetData={validateAndGetData}
                  onSuccess={() => setSuccessRedirect(true)}
                />
              </Elements>
            ) : (
              <div className="p-5 bg-gray-50 rounded-xl border border-gray-200 text-center">
                {selectedShipping && apiUrl && !paymentIntentFailed ? (
                  <>
                    <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Loading payment options…</p>
                  </>
                ) : paymentIntentFailed ? (
                  <p className="text-sm text-red-500">Unable to load payment options. Please try selecting a different shipping method or refresh the page.</p>
                ) : (
                  <p className="text-sm text-gray-500">Select a shipping method above to continue.</p>
                )}
              </div>
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
  const searchParams = useSearchParams();
  const { items } = useCart();

  // Detect payment success from both inline (redirect_status) and legacy (?success=true) flows
  const isSuccess =
    searchParams.get('success') === 'true' ||
    searchParams.get('redirect_status') === 'succeeded';
  const isCanceled = searchParams.get('canceled') === 'true';

  const urlPostcode = searchParams.get('postcode');
  const urlCountry = searchParams.get('country');
  const urlShippingId = searchParams.get('shipping');

  if (isSuccess) return <SuccessView />;
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
