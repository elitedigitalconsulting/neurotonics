'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart';
import productContent from '@/content/product.json';
import { withBasePath } from '@/lib/basePath';

interface ShippingResult {
  zone: string;
  fee: number;
  estimatedDays: string;
}

export default function ProductClient() {
  const { addItem } = useCart();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'ingredients' | 'faq'>('description');
  const [postcode, setPostcode] = useState('');
  const [shipping, setShipping] = useState<ShippingResult | null>(null);
  const [shippingError, setShippingError] = useState('');
  const [shippingLoading, setShippingLoading] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleBuyNow = () => {
    addItem({
      id: productContent.slug,
      name: productContent.name,
      price: productContent.price,
      image: productContent.images[0].src,
    }, quantity);
    router.push('/checkout');
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
    <main id="main-content" className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2 text-gray-500">
            <li><Link href="/" className="hover:text-brand-primary transition-colors">Home</Link></li>
            <li><span className="mx-2">/</span></li>
            <li className="text-brand-primary">{productContent.name}</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="aspect-square rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden p-6">
              <Image
                src={withBasePath(productContent.images[activeImageIndex]?.src || productContent.images[0].src)}
                alt={productContent.images[activeImageIndex]?.alt || productContent.name}
                width={500}
                height={500}
                className="w-full h-full object-contain"
                priority
              />
            </div>

            {/* Thumbnail images */}
            {productContent.images.length > 1 && (
              <div className="flex gap-3">
                {productContent.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveImageIndex(index)}
                    className={`flex-1 aspect-square rounded-xl bg-gray-50 border ${
                      activeImageIndex === index
                        ? 'border-brand-primary'
                        : 'border-gray-200 hover:border-brand-primary/40'
                    } transition-colors flex items-center justify-center p-2 overflow-hidden`}
                    aria-label={`View ${image.alt}`}
                  >
                    <Image
                      src={withBasePath(image.src)}
                      alt={image.alt}
                      width={80}
                      height={80}
                      className="w-full h-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {productContent.badges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand-primary-light text-brand-primary border border-brand-primary/20"
                >
                  {badge}
                </span>
              ))}
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">{productContent.name}</h1>
            
            <p className="text-gray-600 text-lg leading-relaxed">{productContent.shortDescription}</p>

            {/* Price */}
            <div className="flex items-baseline space-x-3">
              <span className="text-4xl font-bold text-brand-primary">
                ${productContent.price.toFixed(2)}
              </span>
              <span className="text-gray-500 text-lg">AUD</span>
            </div>

            {/* Supply info */}
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span className="flex items-center space-x-1">
                <svg className="w-4 h-4 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                onClick={handleBuyNow}
                className="w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300 bg-brand-primary hover:bg-brand-primary-dark text-white shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30"
              >
                Buy Now — ${(productContent.price * quantity).toFixed(2)} AUD
              </button>
            </div>

            {/* Shipping Calculator */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-600 mb-3" id="shipping-calc-label">Calculate Delivery Fee</h3>
              <div className="flex space-x-2">
                <label htmlFor="shipping-postcode" className="sr-only">Enter your postcode</label>
                <input
                  id="shipping-postcode"
                  type="text"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Enter postcode (e.g. 2000)"
                  maxLength={4}
                  inputMode="numeric"
                  aria-labelledby="shipping-calc-label"
                  aria-describedby={shippingError ? 'shipping-error' : undefined}
                  className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-brand-primary transition-colors"
                />
                <button
                  onClick={handleShippingCalculation}
                  disabled={shippingLoading || postcode.length !== 4}
                  className="px-6 py-2.5 bg-brand-primary-light text-brand-primary border border-brand-primary/30 rounded-lg hover:bg-brand-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                >
                  {shippingLoading ? 'Calculating...' : 'Calculate'}
                </button>
              </div>
              {shippingError && (
                <p id="shipping-error" className="mt-2 text-red-600 text-sm" role="alert">{shippingError}</p>
              )}
              {shipping && (
                <div className="mt-3 p-3 bg-brand-primary-light border border-brand-primary/20 rounded-lg" role="status" aria-live="polite">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-900 text-sm font-medium">{shipping.zone}</p>
                      <p className="text-gray-500 text-xs">{shipping.estimatedDays}</p>
                    </div>
                    <p className="text-brand-primary font-semibold">${shipping.fee.toFixed(2)} AUD</p>
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
          <div className="flex space-x-1 border-b border-gray-200" role="tablist" aria-label="Product details">
            {(['description', 'ingredients', 'faq'] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                id={`tab-${tab}`}
                aria-selected={activeTab === tab}
                aria-controls={`tabpanel-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'text-brand-primary border-brand-primary'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                {tab === 'faq' ? 'FAQ' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="py-8">
            <div
              role="tabpanel"
              id="tabpanel-description"
              aria-labelledby="tab-description"
              hidden={activeTab !== 'description'}
            >
              {activeTab === 'description' && (
                <div className="max-w-3xl">
                  {productContent.longDescription.split('\n\n').map((paragraph, index) => (
                    <p key={index} className="text-gray-600 leading-relaxed mb-4">{paragraph}</p>
                  ))}
                </div>
              )}
            </div>

            <div
              role="tabpanel"
              id="tabpanel-ingredients"
              aria-labelledby="tab-ingredients"
              hidden={activeTab !== 'ingredients'}
            >
              {activeTab === 'ingredients' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {productContent.ingredients.map((ingredient, index) => (
                    <div key={index} className="p-4 rounded-xl bg-white border border-gray-200">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-gray-900 font-medium">{ingredient.name}</h4>
                        <span className="text-brand-primary text-sm font-semibold">{ingredient.amount}</span>
                      </div>
                      <p className="text-gray-500 text-sm">{ingredient.benefit}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              role="tabpanel"
              id="tabpanel-faq"
              aria-labelledby="tab-faq"
              hidden={activeTab !== 'faq'}
            >
              {activeTab === 'faq' && (
                <div className="max-w-3xl space-y-3">
                  {productContent.faq.map((item, index) => (
                    <div key={index} className="rounded-xl bg-white border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                        className="w-full flex justify-between items-center p-4 text-left"
                        aria-expanded={expandedFaq === index}
                        aria-controls={`faq-answer-${index}`}
                        id={`faq-question-${index}`}
                      >
                        <span className="text-gray-900 font-medium pr-4">{item.question}</span>
                        <svg
                          className={`w-5 h-5 text-brand-primary transition-transform flex-shrink-0 ${expandedFaq === index ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedFaq === index && (
                        <div
                          id={`faq-answer-${index}`}
                          role="region"
                          aria-labelledby={`faq-question-${index}`}
                          className="px-4 pb-4"
                        >
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
      </div>
    </main>
  );
}
