'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/lib/cart';
import type { ShippingOption } from '@/lib/shipping';

const COUNTRIES = [
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'SG', name: 'Singapore' },
  { code: 'JP', name: 'Japan' },
  { code: 'OTHER', name: 'Other country' },
];

export default function CartClient() {
  const { items, updateQuantity, removeItem, subtotal } = useCart();
  const [postcode, setPostcode] = useState('');
  const [country, setCountry] = useState('AU');
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ShippingOption | null>(null);
  const [shippingError, setShippingError] = useState('');
  const [shippingLoading, setShippingLoading] = useState(false);
  const [locationEntered, setLocationEntered] = useState(false);

  // Restore shipping state from localStorage on mount
  useEffect(() => {
    import('@/lib/shippingState').then(({ loadShipping }) => {
      const stored = loadShipping();
      if (stored) {
        setPostcode(stored.postcode);
        setCountry(stored.country);
        setSelectedOption(stored.option);
        setLocationEntered(true);
      }
    });
  }, []);

  // Persist selected shipping option whenever it changes
  useEffect(() => {
    if (!selectedOption || !locationEntered) return;
    import('@/lib/shippingState').then(({ saveShipping }) => {
      saveShipping({ option: selectedOption, postcode, country });
    });
  }, [selectedOption, postcode, country, locationEntered]);

  const calculateOptions = useCallback(async () => {
    const isAustralia = country === 'AU';
    if (isAustralia && postcode.length !== 4) {
      setShippingError('Please enter a valid 4-digit Australian postcode.');
      return;
    }

    setShippingLoading(true);
    setShippingError('');
    setShippingOptions([]);
    setSelectedOption(null);

    try {
      const { getShippingOptions, getDefaultShippingOption } = await import('@/lib/shipping');
      const effectivePostcode = isAustralia ? postcode : '';
      const options = getShippingOptions(effectivePostcode, country, subtotal);
      const defaultOption = getDefaultShippingOption(effectivePostcode, country, subtotal);
      setShippingOptions(options);
      setSelectedOption(defaultOption);
      setLocationEntered(true);
    } catch {
      setShippingError('Unable to calculate shipping. Please try again.');
    } finally {
      setShippingLoading(false);
    }
  }, [country, postcode, subtotal]);

  // Recalculate when country changes (non-AU countries don't need a postcode)
  useEffect(() => {
    if (country !== 'AU' && locationEntered) {
      calculateOptions();
    }
  }, [country]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recalculate options when subtotal changes (free shipping threshold may be crossed)
  useEffect(() => {
    if (!locationEntered || shippingOptions.length === 0) return;
    import('@/lib/shipping').then(({ getShippingOptions, getDefaultShippingOption }) => {
      const effectivePostcode = country === 'AU' ? postcode : '';
      const options = getShippingOptions(effectivePostcode, country, subtotal);
      setShippingOptions(options);
      // If currently selected option is still available keep it; otherwise use default
      const stillAvailable = options.find((o) => o.id === selectedOption?.id);
      if (!stillAvailable) {
        setSelectedOption(getDefaultShippingOption(effectivePostcode, country, subtotal));
      }
    });
  }, [subtotal]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = subtotal + (selectedOption?.fee ?? 0);
  const isFreeEligible = subtotal >= 100;

  const handleSelectOption = (option: ShippingOption) => {
    setSelectedOption(option);
  };

  if (items.length === 0) {
    return (
      <main className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your Cart is Empty</h1>
          <p className="text-gray-500 mb-8">Add some products to get started.</p>
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

  return (
    <main className="bg-white min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>

        {/* Free-shipping progress banner */}
        {!isFreeEligible && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-brand-primary-light border border-brand-primary/20 rounded-xl text-sm">
            <svg className="w-5 h-5 text-brand-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-brand-primary font-medium">
              Add <strong>${(100 - subtotal).toFixed(2)}</strong> more to unlock <strong>Free Shipping</strong>!
            </span>
          </div>
        )}
        {isFreeEligible && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-sm">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-700 font-medium">🎉 You qualify for <strong>Free Shipping</strong>!</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4 sm:p-6 bg-white rounded-2xl border border-gray-200">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden p-1">
                  {item.image ? (
                    <Image src={item.image} alt={item.name} width={80} height={80} className="w-full h-full object-contain" />
                  ) : (
                    <svg className="w-8 h-8 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-gray-900 font-medium truncate">{item.name}</h3>
                  <p className="text-brand-primary font-semibold">${item.price.toFixed(2)} AUD</p>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="flex items-center border border-gray-200 rounded-lg">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="px-2.5 py-1.5 text-gray-500 hover:text-gray-900 transition-colors text-sm"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-gray-900 text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="px-2.5 py-1.5 text-gray-500 hover:text-gray-900 transition-colors text-sm"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                    aria-label="Remove item"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {/* ── Shipping / Delivery section ── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <h2 className="text-base font-semibold text-gray-900">Shipping / Delivery</h2>
              </div>

              {/* Location inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label htmlFor="country-select" className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                  <select
                    id="country-select"
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      setLocationEntered(false);
                      setShippingOptions([]);
                      setSelectedOption(null);
                      setShippingError('');
                    }}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-brand-primary"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {country === 'AU' && (
                  <div>
                    <label htmlFor="postcode-input" className="block text-xs font-medium text-gray-600 mb-1">Postcode</label>
                    <div className="flex gap-2">
                      <input
                        id="postcode-input"
                        type="text"
                        inputMode="numeric"
                        value={postcode}
                        onChange={(e) => {
                          setPostcode(e.target.value.replace(/\D/g, '').slice(0, 4));
                          setShippingError('');
                          if (locationEntered) {
                            setLocationEntered(false);
                            setShippingOptions([]);
                            setSelectedOption(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && postcode.length === 4) calculateOptions();
                        }}
                        placeholder="e.g. 2000"
                        maxLength={4}
                        className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-brand-primary"
                      />
                      <button
                        onClick={calculateOptions}
                        disabled={shippingLoading || postcode.length !== 4}
                        className="px-4 py-2.5 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors disabled:opacity-40 text-sm font-medium whitespace-nowrap"
                      >
                        {shippingLoading ? '…' : 'Calculate'}
                      </button>
                    </div>
                  </div>
                )}

                {country !== 'AU' && (
                  <div className="flex items-end">
                    <button
                      onClick={calculateOptions}
                      disabled={shippingLoading}
                      className="w-full px-4 py-2.5 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors disabled:opacity-40 text-sm font-medium"
                    >
                      {shippingLoading ? 'Calculating…' : 'Show Shipping Options'}
                    </button>
                  </div>
                )}
              </div>

              {shippingError && (
                <p className="text-red-500 text-xs mb-3 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                  </svg>
                  {shippingError}
                </p>
              )}

              {/* Shipping option cards */}
              {shippingOptions.length > 0 && (
                <div className="space-y-2 mt-2">
                  {shippingOptions.map((option) => {
                    const isSelected = selectedOption?.id === option.id;
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
                          onChange={() => handleSelectOption(option)}
                          className="mt-0.5 accent-brand-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{option.name}</span>
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
                        </div>
                        <div className="text-right flex-shrink-0">
                          {option.fee === 0 ? (
                            <span className="text-sm font-bold text-green-600">FREE</span>
                          ) : (
                            <span className="text-sm font-semibold text-gray-900">${option.fee.toFixed(2)}</span>
                          )}
                          <p className="text-xs text-gray-400">{option.carrier}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {!locationEntered && shippingOptions.length === 0 && !shippingLoading && (
                <p className="text-xs text-gray-400 text-center py-2">
                  Enter your location above to see delivery options.
                </p>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  {selectedOption ? (
                    selectedOption.fee === 0 ? (
                      <span className="text-green-600 font-medium">FREE</span>
                    ) : (
                      <span>${selectedOption.fee.toFixed(2)}</span>
                    )
                  ) : (
                    <span className="text-gray-400 text-xs">Enter location</span>
                  )}
                </div>

                {selectedOption && (
                  <div className="text-xs text-gray-400">
                    <span>{selectedOption.name} · {selectedOption.estimatedDays}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-200 flex justify-between text-gray-900 font-semibold text-base">
                  <span>Total</span>
                  <span>${total.toFixed(2)} AUD</span>
                </div>
              </div>

              {!locationEntered ? (
                <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 text-center">
                  Please enter your delivery location before proceeding to checkout.
                </div>
              ) : (
                <Link
                  href={`/checkout?postcode=${encodeURIComponent(postcode)}&country=${encodeURIComponent(country)}&shipping=${encodeURIComponent(selectedOption?.id ?? '')}`}
                  className="block w-full mt-6 py-3.5 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold rounded-xl transition-all duration-300 text-center"
                >
                  Proceed to Checkout
                </Link>
              )}

              <Link
                href="/product"
                className="block w-full mt-3 py-2.5 text-center text-brand-primary hover:text-brand-primary text-sm transition-colors"
              >
                ← Continue Shopping
              </Link>

              <div className="mt-4 flex items-center justify-center space-x-2 text-xs text-gray-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Secured with SSL encryption</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
