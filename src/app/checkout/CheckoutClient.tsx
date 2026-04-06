'use client';

import { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/lib/cart';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

interface ShippingResult {
  zone: string;
  fee: number;
  estimatedDays: string;
}

function CheckoutForm({ shipping }: { shipping: ShippingResult | null }) {
  const stripe = useStripe();
  const elements = useElements();
  const { clearCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);
    setMessage('');

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout?success=true`,
      },
    });

    if (error) {
      setMessage(error.message || 'An unexpected error occurred.');
    } else {
      clearCart();
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-[#12122a] rounded-2xl border border-purple-900/20 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Payment Details</h2>
        <p className="text-gray-400 text-sm mb-4">Accepts cards, Apple Pay, and Google Pay</p>
        <PaymentElement
          options={{
            layout: 'accordion',
          }}
        />
      </div>

      {shipping && (
        <div className="bg-[#12122a] rounded-2xl border border-purple-900/20 p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Delivery</h2>
          <div className="flex justify-between text-sm">
            <span className="text-gray-300">{shipping.zone}</span>
            <span className="text-purple-300">${shipping.fee.toFixed(2)} AUD</span>
          </div>
          <p className="text-gray-500 text-xs mt-1">{shipping.estimatedDays}</p>
        </div>
      )}

      {message && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
}

function SuccessView() {
  return (
    <main className="bg-[#0a0a1a] min-h-screen flex items-center justify-center">
      <div className="text-center px-4 max-w-lg">
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">Order Confirmed!</h1>
        <p className="text-gray-300 mb-8">
          Thank you for your purchase! Your Brain Boost 1000 is on its way. You&apos;ll receive a confirmation email shortly.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl"
        >
          Return Home
        </Link>
      </div>
    </main>
  );
}

function EmptyCartView() {
  return (
    <main className="bg-[#0a0a1a] min-h-screen flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-2xl font-bold text-white mb-4">Your cart is empty</h1>
        <Link
          href="/product"
          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl"
        >
          Shop Brain Boost 1000
        </Link>
      </div>
    </main>
  );
}

function CheckoutContent({ postcode }: { postcode: string | null }) {
  const { items, subtotal } = useCart();
  const [clientSecret, setClientSecret] = useState('');
  const [shipping, setShipping] = useState<ShippingResult | null>(null);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  const total = subtotal + (shipping?.fee || 0);

  const initialize = useCallback(async () => {
    if (initialized) return;
    setInitialized(true);

    let shippingData: ShippingResult | null = null;

    if (postcode) {
      try {
        const res = await fetch('/api/calculate-shipping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postcode }),
        });
        const data = await res.json();
        if (data.fee !== undefined) {
          shippingData = data;
          setShipping(data);
        }
      } catch {
        // Shipping calculation failed silently
      }
    }

    const amount = subtotal + (shippingData?.fee || 0);
    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, shipping: shippingData }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to initialize payment');
        return;
      }
      setClientSecret(data.clientSecret);
    } catch {
      setError('Failed to initialize payment. Please try again.');
    }
  }, [initialized, postcode, subtotal]);

  return (
    <main className="bg-[#0a0a1a] min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        <Link href="/cart" className="inline-flex items-center text-gray-400 hover:text-purple-400 text-sm mb-8 transition-colors">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Cart
        </Link>

        <h1 className="text-3xl font-bold text-white mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Payment */}
          <div>
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm">
                {error}
              </div>
            )}

            {clientSecret ? (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'night',
                    variables: {
                      colorPrimary: '#8b5cf6',
                      colorBackground: '#12122a',
                      colorText: '#ffffff',
                      colorDanger: '#ef4444',
                      borderRadius: '12px',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    },
                  },
                }}
              >
                <CheckoutForm shipping={shipping} />
              </Elements>
            ) : !error ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-400 text-sm">Initializing secure payment...</p>
                  <button
                    onClick={initialize}
                    className="mt-4 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl text-sm transition-all duration-300"
                  >
                    Load Payment
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Order Summary */}
          <div>
            <div className="bg-[#12122a] rounded-2xl border border-purple-900/20 p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-white mb-4">Order Summary</h2>

              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white">{item.name}</p>
                        <p className="text-gray-500 text-xs">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <span className="text-gray-300">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-purple-900/20 space-y-2 text-sm">
                <div className="flex justify-between text-gray-300">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {shipping && (
                  <div className="flex justify-between text-gray-300">
                    <span>Shipping</span>
                    <span>${shipping.fee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-semibold text-base pt-2 border-t border-purple-900/20">
                  <span>Total</span>
                  <span>${total.toFixed(2)} AUD</span>
                </div>
              </div>

              <div className="mt-4 flex items-center space-x-2 text-xs text-gray-500">
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

export default function CheckoutClient() {
  const searchParams = useSearchParams();
  const { items } = useCart();

  const isSuccess = searchParams.get('success') === 'true';
  const postcode = searchParams.get('postcode');

  if (isSuccess) {
    return <SuccessView />;
  }

  if (items.length === 0) {
    return <EmptyCartView />;
  }

  return <CheckoutContent postcode={postcode} />;
}
