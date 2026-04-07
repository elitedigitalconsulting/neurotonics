'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/lib/cart';

interface ShippingResult {
  zone: string;
  fee: number;
  estimatedDays: string;
}

// ---------------------------------------------------------------------------
// Success view — shown when Stripe redirects back with ?success=true
// ---------------------------------------------------------------------------
function SuccessView() {
  const { clearCart } = useCart();

  // Clear the cart once on mount so repeat visits to the success URL don't
  // show stale items. useEffect is safe here because clearCart mutates the
  // module-level store (not component state), so it causes no re-render loop.
  useEffect(() => {
    clearCart();
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
// Cancel view — shown when Stripe redirects back with ?canceled=true
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
          No charges were made. Your cart is still saved — you can retry whenever you&apos;re ready.
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
// Main checkout content
// ---------------------------------------------------------------------------
function CheckoutContent({ postcode }: { postcode: string | null }) {
  const { items, subtotal } = useCart();
  const [shipping, setShipping] = useState<ShippingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Validate postcode format (4-digit Australian postcode)
  const validPostcode = postcode && /^\d{4}$/.test(postcode) ? postcode : null;

  // Calculate shipping client-side using the same logic as the cart page
  useEffect(() => {
    if (!validPostcode) return;
    let cancelled = false;
    import('@/lib/shipping').then(({ calculateShipping }) => {
      if (!cancelled) setShipping(calculateShipping(validPostcode));
    });
    return () => { cancelled = true; };
  }, [validPostcode]);

  const total = subtotal + (shipping?.fee || 0);

  /**
   * Redirect the user to Stripe's hosted checkout page.
   *
   * Stripe Checkout automatically displays:
   *  - Apple Pay on Safari / iOS (when the device has a card on file)
   *  - Google Pay on Chrome / Android
   *  - Card payments as a universal fallback
   *
   * No Apple Pay domain verification is needed because the payment page is
   * served from stripe.com, which is already verified.
   */
  const handleCheckout = async () => {
    setIsLoading(true);
    setError('');

    // Build success/cancel URLs relative to the current page so they work
    // both locally (localhost:3000) and on GitHub Pages (/neurotonics/).
    const successUrl = new URL(window.location.href);
    successUrl.search = '?success=true';
    const cancelUrl = new URL(window.location.href);
    cancelUrl.search = '?canceled=true';

    // NEXT_PUBLIC_API_URL must point to your deployed Express server, e.g.:
    //   https://your-server.onrender.com
    // For local development set it to http://localhost:4000 in .env.local
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setError(
        'Checkout is not configured. Set NEXT_PUBLIC_API_URL in your environment.'
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
          shipping,
          successUrl: successUrl.toString(),
          cancelUrl: cancelUrl.toString(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start checkout.');
      }

      // Redirect to Stripe's hosted checkout page
      window.location.href = data.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start checkout. Please try again.';
      setError(message);
      setIsLoading(false);
    }
  };

  return (
    <main className="bg-white min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        <Link
          href="/cart"
          className="inline-flex items-center text-gray-500 hover:text-brand-primary text-sm mb-8 transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Cart
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Payment section */}
          <div className="space-y-6">
            {/* Payment method info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Secure Payment</h2>
              <p className="text-gray-500 text-sm mb-4">
                You&apos;ll be redirected to Stripe&apos;s secure checkout page. Accepted payment methods:
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 font-medium">
                  💳 Credit / Debit Card
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 font-medium">
                   Apple Pay
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 font-medium">
                  Google Pay
                </span>
              </div>
              <p className="text-gray-400 text-xs">
                Apple Pay appears automatically on Safari / iOS. Google Pay appears automatically on Chrome / Android.
              </p>
            </div>

            {/* Delivery info */}
            {shipping && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Delivery</h2>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{shipping.zone}</span>
                  <span className="text-brand-primary font-medium">${shipping.fee.toFixed(2)} AUD</span>
                </div>
                <p className="text-gray-500 text-xs mt-1">{shipping.estimatedDays}</p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Checkout button */}
            <button
              onClick={handleCheckout}
              disabled={isLoading}
              className="w-full py-4 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Redirecting to Stripe…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Pay ${total.toFixed(2)} AUD
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-400">
              Powered by{' '}
              <span className="font-medium text-gray-500">Stripe</span>
              {' '}— your card details are never stored on our servers.
            </p>
          </div>

          {/* Order summary */}
          <div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>

              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden p-0.5">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.name}
                            width={40}
                            height={40}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <svg className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-900">{item.name}</p>
                        <p className="text-gray-500 text-xs">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <span className="text-gray-600">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {shipping ? (
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span>${shipping.fee.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>Shipping</span>
                    <span>Calculated in cart</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-900 font-semibold text-base pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>${total.toFixed(2)} AUD</span>
                </div>
              </div>

              <div className="mt-4 flex items-center space-x-2 text-xs text-gray-500">
                <svg className="w-4 h-4 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

// ---------------------------------------------------------------------------
// Root export — decides which view to render based on URL params
// ---------------------------------------------------------------------------
export default function CheckoutClient() {
  const searchParams = useSearchParams();
  const { items } = useCart();

  const isSuccess = searchParams.get('success') === 'true';
  const isCanceled = searchParams.get('canceled') === 'true';
  const postcode = searchParams.get('postcode');

  if (isSuccess) return <SuccessView />;
  if (isCanceled) return <CancelView />;
  if (items.length === 0) return <EmptyCartView />;

  return <CheckoutContent postcode={postcode} />;
}
