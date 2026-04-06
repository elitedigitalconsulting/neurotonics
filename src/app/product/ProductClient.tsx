'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart';
import productContent from '@/content/product.json';

interface ShippingResult {
  zone: string;
  fee: number;
  estimatedDays: string;
}

export default function ProductClient() {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'ingredients' | 'faq'>('description');
  const [postcode, setPostcode] = useState('');
  const [shipping, setShipping] = useState<ShippingResult | null>(null);
  const [shippingError, setShippingError] = useState('');
  const [shippingLoading, setShippingLoading] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleAddToCart = () => {
    addItem({
      id: productContent.slug,
      name: productContent.name,
      price: productContent.price,
      image: productContent.images[0].src,
    }, quantity);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

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
      setShippingError('Failed to calculate shipping. Please try again.');
    } finally {
      setShippingLoading(false);
    }
  };

  return (
    <main className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2 text-gray-500">
            <li><Link href="/" className="hover:text-blue-600 transition-colors">Home</Link></li>
            <li><span className="mx-2">/</span></li>
            <li className="text-blue-600">{productContent.name}</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="aspect-square rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden">
              <div className="text-center p-8">
                <div className="w-32 h-32 mx-auto rounded-full bg-blue-50 flex items-center justify-center mb-4">
                  <svg className="w-16 h-16 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <p className="text-blue-700 font-medium text-lg">{productContent.name}</p>
                <p className="text-gray-500 text-sm mt-1">{productContent.images[activeImageIndex]?.alt}</p>
              </div>
            </div>

            {/* Thumbnail images */}
            <div className="flex gap-3">
              {productContent.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setActiveImageIndex(index)}
                  className={`flex-1 aspect-square rounded-xl bg-gray-50 border ${
                    activeImageIndex === index
                      ? 'border-blue-600'
                      : 'border-gray-200 hover:border-blue-400'
                  } transition-colors flex items-center justify-center p-2`}
                  aria-label={`View ${image.alt}`}
                >
                  <svg className={`w-6 h-6 ${activeImageIndex === index ? 'text-blue-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {productContent.badges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                >
                  {badge}
                </span>
              ))}
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">{productContent.name}</h1>
            
            <p className="text-gray-600 text-lg leading-relaxed">{productContent.shortDescription}</p>

            {/* Price */}
            <div className="flex items-baseline space-x-3">
              <span className="text-4xl font-bold text-blue-700">
                ${productContent.price.toFixed(2)}
              </span>
              <span className="text-gray-500 text-lg">AUD</span>
            </div>

            {/* Supply info */}
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span className="flex items-center space-x-1">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>{productContent.capsuleCount} capsules</span>
              </span>
              <span>•</span>
              <span>{productContent.supply}</span>
              <span>•</span>
              <span>{productContent.servingSize}</span>
            </div>

            {/* Quantity & Add to Cart */}
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-4">
                <label htmlFor="quantity" className="text-sm font-medium text-gray-600">Quantity:</label>
                <div className="flex items-center border border-gray-300 rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 text-gray-500 hover:text-gray-900 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    max="10"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    className="w-12 text-center bg-transparent text-gray-900 border-x border-gray-300 py-2 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setQuantity(Math.min(10, quantity + 1))}
                    className="px-3 py-2 text-gray-500 hover:text-gray-900 transition-colors"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                className={`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300 ${
                  addedToCart
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-700 hover:bg-blue-800 text-white shadow-lg shadow-blue-700/20 hover:shadow-blue-700/30'
                }`}
              >
                {addedToCart ? '✓ Added to Cart!' : `Add to Cart — $${(productContent.price * quantity).toFixed(2)} AUD`}
              </button>

              <Link
                href="/cart"
                className="block w-full py-3 text-center border border-blue-700 text-blue-700 hover:bg-blue-50 rounded-xl font-medium transition-all duration-300"
              >
                View Cart
              </Link>
            </div>

            {/* Shipping Calculator */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Calculate Delivery Fee</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Enter postcode (e.g. 2000)"
                  maxLength={4}
                  className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  onClick={handleShippingCalculation}
                  disabled={shippingLoading || postcode.length !== 4}
                  className="px-6 py-2.5 bg-blue-50 text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                >
                  {shippingLoading ? 'Calculating...' : 'Calculate'}
                </button>
              </div>
              {shippingError && (
                <p className="mt-2 text-red-600 text-sm">{shippingError}</p>
              )}
              {shipping && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-900 text-sm font-medium">{shipping.zone}</p>
                      <p className="text-gray-500 text-xs">{shipping.estimatedDays}</p>
                    </div>
                    <p className="text-blue-700 font-semibold">${shipping.fee.toFixed(2)} AUD</p>
                  </div>
                </div>
              )}
            </div>

            {/* Payment methods */}
            <div className="flex items-center space-x-3 text-xs text-gray-500">
              <span>Accepts:</span>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-1 bg-gray-50 rounded border border-gray-200 text-gray-600">💳 Card</span>
                <span className="px-2 py-1 bg-gray-50 rounded border border-gray-200 text-gray-600"> Apple Pay</span>
                <span className="px-2 py-1 bg-gray-50 rounded border border-gray-200 text-gray-600">G Pay</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details Tabs */}
        <div className="mt-16 sm:mt-24">
          <div className="flex space-x-1 border-b border-gray-200">
            {(['description', 'ingredients', 'faq'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                {tab === 'faq' ? 'FAQ' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="py-8">
            {activeTab === 'description' && (
              <div className="max-w-3xl">
                {productContent.longDescription.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="text-gray-600 leading-relaxed mb-4">{paragraph}</p>
                ))}
              </div>
            )}

            {activeTab === 'ingredients' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {productContent.ingredients.map((ingredient, index) => (
                  <div key={index} className="p-4 rounded-xl bg-white border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-gray-900 font-medium">{ingredient.name}</h4>
                      <span className="text-blue-600 text-sm font-semibold">{ingredient.amount}</span>
                    </div>
                    <p className="text-gray-500 text-sm">{ingredient.benefit}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'faq' && (
              <div className="max-w-3xl space-y-3">
                {productContent.faq.map((item, index) => (
                  <div key={index} className="rounded-xl bg-white border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                      className="w-full flex justify-between items-center p-4 text-left"
                      aria-expanded={expandedFaq === index}
                    >
                      <span className="text-gray-900 font-medium pr-4">{item.question}</span>
                      <svg
                        className={`w-5 h-5 text-blue-600 transition-transform flex-shrink-0 ${expandedFaq === index ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedFaq === index && (
                      <div className="px-4 pb-4">
                        <p className="text-gray-500 text-sm leading-relaxed">{item.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
