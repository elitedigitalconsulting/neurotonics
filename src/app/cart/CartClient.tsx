'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart';

interface ShippingResult {
  zone: string;
  fee: number;
  estimatedDays: string;
}

export default function CartClient() {
  const { items, updateQuantity, removeItem, subtotal } = useCart();
  const [postcode, setPostcode] = useState('');
  const [shipping, setShipping] = useState<ShippingResult | null>(null);
  const [shippingError, setShippingError] = useState('');
  const [shippingLoading, setShippingLoading] = useState(false);

  const handleShippingCalculation = async () => {
    if (!postcode.trim()) return;
    setShippingLoading(true);
    setShippingError('');
    setShipping(null);

    try {
      const { calculateShipping } = await import('@/lib/shipping');
      const data = calculateShipping(postcode.trim());
      setShipping(data);
    } catch {
      setShippingError('Failed to calculate shipping.');
    } finally {
      setShippingLoading(false);
    }
  };

  const total = subtotal + (shipping?.fee || 0);

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
            className="inline-flex items-center px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl transition-all duration-300"
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4 sm:p-6 bg-white rounded-2xl border border-gray-200">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-gray-900 font-medium truncate">{item.name}</h3>
                  <p className="text-blue-600 font-semibold">${item.price.toFixed(2)} AUD</p>
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
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>

                {/* Shipping Calculator */}
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-gray-500 text-xs mb-2">Calculate delivery fee:</p>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={postcode}
                      onChange={(e) => setPostcode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="Postcode"
                      maxLength={4}
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleShippingCalculation}
                      disabled={shippingLoading || postcode.length !== 4}
                      className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 text-xs font-medium"
                    >
                      {shippingLoading ? '...' : 'Go'}
                    </button>
                  </div>
                  {shippingError && <p className="mt-1 text-red-500 text-xs">{shippingError}</p>}
                  {shipping && (
                    <div className="mt-2 flex justify-between text-gray-600">
                      <span>Shipping ({shipping.zone})</span>
                      <span>${shipping.fee.toFixed(2)}</span>
                    </div>
                  )}
                  {shipping && (
                    <p className="text-gray-500 text-xs mt-1">{shipping.estimatedDays}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-200 flex justify-between text-gray-900 font-semibold text-base">
                  <span>Total</span>
                  <span>${total.toFixed(2)} AUD</span>
                </div>
              </div>

              <Link
                href={`/checkout${shipping ? `?postcode=${postcode}` : ''}`}
                className="block w-full mt-6 py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl transition-all duration-300 text-center"
              >
                Proceed to Checkout
              </Link>

              <Link
                href="/product"
                className="block w-full mt-3 py-2.5 text-center text-blue-700 hover:text-blue-600 text-sm transition-colors"
              >
                ← Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
