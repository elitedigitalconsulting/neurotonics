'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/lib/cart';
import {
  getShippingOptions,
  getDefaultShippingOption,
  type ShippingOption,
} from '@/lib/shipping';
import type { CheckoutContact, CheckoutAddress } from '@/lib/checkoutState';

// ---------------------------------------------------------------------------
// Constants
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
// Types
// ---------------------------------------------------------------------------

export type FormErrors = Partial<
  Record<keyof CheckoutContact | keyof CheckoutAddress | 'shipping', string>
>;

// ---------------------------------------------------------------------------
// Pure utility functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Validate the checkout form fields. Returns a map of field -> error message.
 * An empty map means the form is valid.
 */
export function validateCheckoutForm(
  contact: CheckoutContact,
  address: CheckoutAddress,
  selectedShipping: ShippingOption | null,
): FormErrors {
  const errors: FormErrors = {};

  // Email
  if (!contact.email.trim()) {
    errors.email = 'Email address is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) {
    errors.email = 'Please enter a valid email address';
  }

  // Phone
  if (!contact.phone.trim()) {
    errors.phone = 'Phone number is required';
  } else if (!/^[\d\s+\-()]{7,20}$/.test(contact.phone.trim())) {
    errors.phone = 'Please enter a valid phone number (7-20 digits)';
  }

  // Full name
  if (!address.fullName.trim()) {
    errors.fullName = 'Full name is required';
  }

  // Address line 1
  if (!address.address1.trim()) {
    errors.address1 = 'Address is required';
  }

  // City
  if (!address.city.trim()) {
    errors.city = 'City / suburb is required';
  }

  // State
  if (!address.state.trim()) {
    errors.state = 'State / region is required';
  }

  // Postcode (required for AU)
  if (address.country === 'AU') {
    if (!address.postcode.trim()) {
      errors.postcode = 'Postcode is required';
    } else if (!/^\d{4}$/.test(address.postcode.trim())) {
      errors.postcode = 'Please enter a valid 4-digit Australian postcode';
    }
  } else if (address.postcode.trim() && address.postcode.trim().length < 2) {
    errors.postcode = 'Please enter a valid postcode';
  }

  // Country
  if (!address.country) {
    errors.country = 'Country is required';
  }

  // Shipping option
  if (!selectedShipping) {
    errors.shipping = 'Please select a delivery option';
  }

  return errors;
}

/**
 * Compute available shipping options for the given address and cart subtotal.
 */
export function calculateShipping(
  postcode: string,
  country: string,
  subtotal: number,
): ShippingOption[] {
  const effectivePostcode = country === 'AU' ? postcode : '';
  return getShippingOptions(effectivePostcode, country, subtotal);
}

/**
 * Calculate the order total from subtotal and selected shipping fee.
 */
export function updateTotal(subtotal: number, shippingFee: number): number {
  return subtotal + shippingFee;
}

// ---------------------------------------------------------------------------
// Success view
// ---------------------------------------------------------------------------

function SuccessView() {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
    import('@/lib/shippingState').then(({ clearShipping }) => clearShipping());
    import('@/lib/checkoutState').then(({ clearCheckoutData }) => clearCheckoutData());
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
          You&apos;ll receive a confirmation email from Stripe shortly.
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

// ---------------------------------------------------------------------------
// Cancel view
// ---------------------------------------------------------------------------

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
          No charges were made. Your cart is still saved &mdash; you can retry whenever you&apos;re ready.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/cart"
            className="inline-flex items-center justify-center px-6 py-3 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold rounded-xl transition-all duration-300"
          >
            Return to Cart
          </Link>
          <Link
            href="/product"
            className="inline-flex items-center justify-center px-6 py-3 border border-brand-primary text-brand-primary hover:bg-brand-primary-light rounded-xl font-medium transition-all duration-300"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Empty cart view
// ---------------------------------------------------------------------------

function EmptyCartView() {
  return (
    <main className="bg-white min-h-screen flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h1>
        <Link
          href="/product"
          className="inline-flex items-center px-6 py-3 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold rounded-xl transition-all duration-300"
        >
          Shop Brain Boost 1000
        </Link>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Inline field error component
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

// ---------------------------------------------------------------------------
// Input class helper
// ---------------------------------------------------------------------------

function inputClass(hasError: boolean) {
  return `w-full px-4 py-3 bg-gray-50 border rounded-xl text-gray-900 placeholder-gray-400 text-sm transition-colors focus:outline-none focus:bg-white ${
    hasError
      ? 'border-red-400 focus:border-red-500'
      : 'border-gray-200 focus:border-brand-primary'
  }`;
}

// ---------------------------------------------------------------------------
// Section heading component
// ---------------------------------------------------------------------------

function SectionHeading({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="w-7 h-7 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
        {number}
      </span>
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
    </div>
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

  // Shipping state
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);

  // Validation state
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  // Derived values
  const total = updateTotal(subtotal, selectedShipping?.fee ?? 0);
  const isAustralia = address.country === 'AU';
  const amountToFree = FREE_SHIPPING_THRESHOLD - subtotal;
  const isFreeEligible = subtotal >= FREE_SHIPPING_THRESHOLD;

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
      } else if (urlPostcode || urlCountry) {
        setAddress((prev) => ({
          ...prev,
          postcode: urlPostcode ?? prev.postcode,
          country: urlCountry ?? prev.country,
        }));
      }

      const savedShipping = loadShipping();
      if (savedShipping?.option) {
        setSelectedShipping(savedShipping.option);
      }
    });

    return () => {
      cancelled = true;
    };
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
        const stillAvailable = options.find((o) => o.id === prev?.id);
        if (stillAvailable) return stillAvailable;
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

  // Auto-save form data to localStorage
  useEffect(() => {
    if (!contact.email && !contact.phone && !address.fullName && !address.address1) return;
    import('@/lib/checkoutState').then(({ saveCheckoutData }) => {
      saveCheckoutData({ contact, address });
    });
  }, [contact, address]);

  // Persist shipping selection
  useEffect(() => {
    if (!selectedShipping) return;
    import('@/lib/shippingState').then(({ saveShipping }) => {
      saveShipping({
        option: selectedShipping,
        postcode: address.postcode,
        country: address.country,
      });
    });
  }, [selectedShipping, address.postcode, address.country]);

  // Re-validate when fields change after a submit attempt
  useEffect(() => {
    if (!submitAttempted) return;
    const errs = validateCheckoutForm(contact, address, selectedShipping);
    setErrors(errs);
  }, [contact, address, selectedShipping, submitAttempted]);

  // Blur handler: mark field as touched and validate it
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

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    const errs = validateCheckoutForm(contact, address, selectedShipping);
    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      setTimeout(() => {
        const firstError = document.querySelector('[data-field-error="true"]') as HTMLElement;
        if (firstError) {
          firstError.closest('[data-form-field]')?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 50);
      return;
    }

    setIsLoading(true);
    setServerError('');

    const successUrl = new URL(window.location.href);
    successUrl.search = '?success=true';
    const cancelUrl = new URL(window.location.href);
    cancelUrl.search = '?canceled=true';

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setServerError(
        'Checkout is not configured. Set NEXT_PUBLIC_API_URL in your environment.',
      );
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          shipping: selectedShipping,
          customerEmail: contact.email.trim(),
          customerPhone: contact.phone.trim(),
          shippingAddress: {
            fullName: address.fullName.trim(),
            address1: address.address1.trim(),
            address2: address.address2.trim(),
            city: address.city.trim(),
            state: address.state.trim(),
            postcode: address.postcode.trim(),
            country: address.country,
          },
          successUrl: successUrl.toString(),
          cancelUrl: cancelUrl.toString(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start checkout.');
      }

      window.location.href = data.url;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to start checkout. Please try again.';
      setServerError(message);
      setIsLoading(false);
    }
  };

  return (
    <main className="bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Back link */}
        <Link
          href="/cart"
          className="inline-flex items-center text-gray-500 hover:text-brand-primary text-sm mb-6 transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Cart
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        {/* Free shipping banner */}
        {isAustralia && !isFreeEligible && amountToFree > 0 && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
            <span className="text-amber-700">
              You&apos;re <strong>${amountToFree.toFixed(2)}</strong> away from{' '}
              <strong>Free Shipping</strong>!{' '}
              <Link href="/product" className="underline hover:text-amber-900 transition-colors">
                Add more &rarr;
              </Link>
            </span>
          </div>
        )}
        {isAustralia && isFreeEligible && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-sm">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-700 font-medium">
              You qualify for <strong>Free Shipping</strong>!
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left column: form sections */}
            <div className="lg:col-span-3 space-y-6">

              {/* Section 1: Contact Information */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <SectionHeading number={1} title="Contact Information" />

                <div className="space-y-4">
                  {/* Email */}
                  <div data-form-field>
                    <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1.5">
                      Email address <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={contact.email}
                      onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))}
                      onBlur={() => touchField('email')}
                      placeholder="you@example.com"
                      className={inputClass(!!showError('email'))}
                      aria-describedby={showError('email') ? 'email-error' : undefined}
                    />
                    <span id="email-error" data-field-error={!!showError('email') || undefined}>
                      <FieldError message={showError('email')} />
                    </span>
                  </div>

                  {/* Phone */}
                  <div data-form-field>
                    <label htmlFor="phone" className="block text-xs font-medium text-gray-700 mb-1.5">
                      Phone number <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      value={contact.phone}
                      onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))}
                      onBlur={() => touchField('phone')}
                      placeholder="+61 400 000 000"
                      className={inputClass(!!showError('phone'))}
                      aria-describedby={showError('phone') ? 'phone-error' : undefined}
                    />
                    <span id="phone-error" data-field-error={!!showError('phone') || undefined}>
                      <FieldError message={showError('phone')} />
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Shipping Address */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <SectionHeading number={2} title="Shipping Address" />

                <div className="space-y-4">
                  {/* Full name */}
                  <div data-form-field>
                    <label htmlFor="fullName" className="block text-xs font-medium text-gray-700 mb-1.5">
                      Full name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      autoComplete="name"
                      value={address.fullName}
                      onChange={(e) => setAddress((p) => ({ ...p, fullName: e.target.value }))}
                      onBlur={() => touchField('fullName')}
                      placeholder="Jane Smith"
                      className={inputClass(!!showError('fullName'))}
                    />
                    <FieldError message={showError('fullName')} />
                  </div>

                  {/* Address line 1 */}
                  <div data-form-field>
                    <label htmlFor="address1" className="block text-xs font-medium text-gray-700 mb-1.5">
                      Address line 1 <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="address1"
                      type="text"
                      autoComplete="address-line1"
                      value={address.address1}
                      onChange={(e) => setAddress((p) => ({ ...p, address1: e.target.value }))}
                      onBlur={() => touchField('address1')}
                      placeholder="123 Main Street"
                      className={inputClass(!!showError('address1'))}
                    />
                    <FieldError message={showError('address1')} />
                  </div>

                  {/* Address line 2 */}
                  <div>
                    <label htmlFor="address2" className="block text-xs font-medium text-gray-700 mb-1.5">
                      Address line 2{' '}
                      <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      id="address2"
                      type="text"
                      autoComplete="address-line2"
                      value={address.address2}
                      onChange={(e) => setAddress((p) => ({ ...p, address2: e.target.value }))}
                      placeholder="Apartment, suite, unit, etc."
                      className={inputClass(false)}
                    />
                  </div>

                  {/* City */}
                  <div data-form-field>
                    <label htmlFor="city" className="block text-xs font-medium text-gray-700 mb-1.5">
                      City / Suburb <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="city"
                      type="text"
                      autoComplete="address-level2"
                      value={address.city}
                      onChange={(e) => setAddress((p) => ({ ...p, city: e.target.value }))}
                      onBlur={() => touchField('city')}
                      placeholder="Sydney"
                      className={inputClass(!!showError('city'))}
                    />
                    <FieldError message={showError('city')} />
                  </div>

                  {/* State + Postcode row */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* State */}
                    <div data-form-field>
                      <label htmlFor="state" className="block text-xs font-medium text-gray-700 mb-1.5">
                        State <span className="text-red-500">*</span>
                      </label>
                      {isAustralia ? (
                        <select
                          id="state"
                          autoComplete="address-level1"
                          value={address.state}
                          onChange={(e) =>
                            setAddress((p) => ({ ...p, state: e.target.value }))
                          }
                          onBlur={() => touchField('state')}
                          className={inputClass(!!showError('state'))}
                        >
                          <option value="">Select state</option>
                          {AU_STATES.map((s) => (
                            <option key={s.code} value={s.code}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id="state"
                          type="text"
                          autoComplete="address-level1"
                          value={address.state}
                          onChange={(e) =>
                            setAddress((p) => ({ ...p, state: e.target.value }))
                          }
                          onBlur={() => touchField('state')}
                          placeholder="State / Region"
                          className={inputClass(!!showError('state'))}
                        />
                      )}
                      <FieldError message={showError('state')} />
                    </div>

                    {/* Postcode */}
                    <div data-form-field>
                      <label htmlFor="postcode" className="block text-xs font-medium text-gray-700 mb-1.5">
                        Postcode{' '}
                        {isAustralia && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        id="postcode"
                        type="text"
                        autoComplete="postal-code"
                        inputMode={isAustralia ? 'numeric' : 'text'}
                        value={address.postcode}
                        onChange={(e) => {
                          const val = isAustralia
                            ? e.target.value.replace(/\D/g, '').slice(0, 4)
                            : e.target.value.slice(0, 10);
                          setAddress((p) => ({ ...p, postcode: val }));
                        }}
                        onBlur={() => touchField('postcode')}
                        placeholder={isAustralia ? '2000' : 'Postcode'}
                        maxLength={isAustralia ? 4 : 10}
                        className={inputClass(!!showError('postcode'))}
                      />
                      <FieldError message={showError('postcode')} />
                    </div>
                  </div>

                  {/* Country */}
                  <div data-form-field>
                    <label htmlFor="country" className="block text-xs font-medium text-gray-700 mb-1.5">
                      Country <span className="text-red-500">*</span>
                    </label>
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
                      className={inputClass(!!showError('country'))}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <FieldError message={showError('country')} />
                  </div>
                </div>
              </div>

              {/* Section 3: Delivery Options */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <SectionHeading number={3} title="Delivery Options" />

                {shippingOptions.length > 0 ? (
                  <div className="space-y-3">
                    {shippingOptions.map((option) => {
                      const isSelected = selectedShipping?.id === option.id;
                      return (
                        <label
                          key={option.id}
                          className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-brand-primary bg-brand-primary-light'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="shipping-option"
                            value={option.id}
                            checked={isSelected}
                            onChange={() => setSelectedShipping(option)}
                            className="mt-1 accent-brand-primary flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900">
                                {option.name}
                              </span>
                              {option.recommended && (
                                <span className="px-1.5 py-0.5 bg-brand-primary text-white text-xs rounded font-medium">
                                  Recommended
                                </span>
                              )}
                              {option.id === 'free' && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">
                                  FREE
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {option.estimatedDays}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {option.carrier} &middot; {option.zone}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {option.fee === 0 ? (
                              <span className="text-sm font-bold text-green-600">FREE</span>
                            ) : (
                              <span className="text-sm font-semibold text-brand-primary">
                                ${option.fee.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-3">
                    {isAustralia
                      ? 'Enter your postcode above to see delivery options.'
                      : 'Select your country above to see delivery options.'}
                  </p>
                )}

                {showError('shipping') && (
                  <div className="mt-3" data-field-error>
                    <FieldError message={showError('shipping')} />
                  </div>
                )}
              </div>

              {/* Server error */}
              {serverError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm" role="alert">
                  {serverError}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
              >
                {isLoading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Redirecting to Stripe&hellip;
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Pay ${total.toFixed(2)} AUD
                  </>
                )}
              </button>

              {/* Payment method icons */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    { icon: '💳', label: 'Credit / Debit Card' },
                    { icon: '🍎', label: 'Apple Pay' },
                    { icon: '🔵', label: 'Google Pay' },
                  ].map(({ icon, label }) => (
                    <span
                      key={label}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600"
                    >
                      {icon} {label}
                    </span>
                  ))}
                </div>
                <p className="text-center text-xs text-gray-400">
                  Powered by{' '}
                  <span className="font-medium text-gray-500">Stripe</span>
                  {' '}&mdash; your card details are never stored on our servers.
                </p>
              </div>
            </div>

            {/* Right column: Order summary */}
            <div className="lg:col-span-2 order-first lg:order-last">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:sticky lg:top-24">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Order Summary</h2>

                {/* Items */}
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center space-x-3">
                        <div className="relative w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden p-0.5 flex-shrink-0">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.name}
                              width={48}
                              height={48}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <svg className="w-6 h-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          )}
                          {/* Quantity badge */}
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-gray-700 text-white text-xs rounded-full flex items-center justify-center font-medium leading-none">
                            {item.quantity}
                          </span>
                        </div>
                        <div>
                          <p className="text-gray-900 font-medium leading-snug">{item.name}</p>
                        </div>
                      </div>
                      <span className="text-gray-700 font-medium ml-3 flex-shrink-0">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>

                  {selectedShipping ? (
                    <div className="flex justify-between text-gray-600">
                      <span>Shipping</span>
                      {selectedShipping.fee === 0 ? (
                        <span className="text-green-600 font-medium">FREE</span>
                      ) : (
                        <span>${selectedShipping.fee.toFixed(2)}</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-between text-gray-400 text-xs">
                      <span>Shipping</span>
                      <span>Calculated above</span>
                    </div>
                  )}

                  {selectedShipping && (
                    <p className="text-xs text-gray-400">
                      {selectedShipping.name} &middot; {selectedShipping.estimatedDays}
                    </p>
                  )}

                  <div className="flex justify-between text-gray-900 font-semibold text-base pt-2 border-t border-gray-100">
                    <span>Total</span>
                    <span>${total.toFixed(2)} AUD</span>
                  </div>
                </div>

                {/* Security badge */}
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                  <svg className="w-4 h-4 text-brand-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Secured with SSL encryption</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------

export default function CheckoutClient() {
  const searchParams = useSearchParams();
  const { items } = useCart();

  const isSuccess = searchParams.get('success') === 'true';
  const isCanceled = searchParams.get('canceled') === 'true';
  const postcode = searchParams.get('postcode');
  const country = searchParams.get('country');
  const shippingId = searchParams.get('shipping');

  if (isSuccess) return <SuccessView />;
  if (isCanceled) return <CancelView />;
  if (items.length === 0) return <EmptyCartView />;

  return (
    <CheckoutContent
      urlPostcode={postcode}
      urlCountry={country}
      urlShippingId={shippingId}
    />
  );
}
