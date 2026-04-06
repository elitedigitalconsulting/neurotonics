import Link from 'next/link';
import siteContent from '@/content/site.json';
import productContent from '@/content/product.json';

function FeatureIcon({ icon }: { icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    leaf: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.5 0 3-.3 4.3-.9C11 19 8 14.5 8 10c0-2.5 1-4.8 2.6-6.4C11 3.2 11.5 3 12 2z" />,
    shield: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
    heart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
    flag: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />,
    brain: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
    sparkles: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />,
  };

  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {icons[icon] || icons.sparkles}
    </svg>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex space-x-1">
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < rating ? 'text-yellow-500' : 'text-gray-300'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function Home() {
  const { hero, features, benefits, testimonials } = siteContent;

  return (
    <main>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-green-50 via-white to-white" />
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-100/60 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 sm:py-40 text-center">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-50 border border-green-200 mb-8">
            <span className="text-green-700 text-sm font-medium">🧠 ARTG Listed &bull; 100% Natural &bull; Made in Australia</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            {hero.headline.split(',').map((part, i) => (
              <span key={i}>
                {i > 0 && <br className="hidden sm:block" />}
                {i > 0 && ', '}
                {i === 0 ? part : <span className="text-green-700">{part.trim()}</span>}
              </span>
            ))}
          </h1>
          
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto mb-10 leading-relaxed">
            {hero.subheadline}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={hero.ctaLink}
              className="w-full sm:w-auto px-8 py-4 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-green-700/20 hover:shadow-green-700/30 text-center"
            >
              {hero.ctaText} &mdash; ${productContent.price} AUD
            </Link>
            <Link
              href={hero.secondaryCtaLink}
              className="w-full sm:w-auto px-8 py-4 border border-green-300 text-green-700 hover:bg-green-50 font-semibold rounded-xl transition-all duration-300 text-center"
            >
              {hero.secondaryCtaText} →
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <span>No Artificial Preservatives</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <span>Vegan</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <span>60 Capsules</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Pure Ingredients, Powerful Results</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">Every capsule is crafted with nature&apos;s finest cognitive-enhancing ingredients, backed by science and free from anything artificial.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 sm:p-8 rounded-2xl bg-white border border-gray-200 hover:border-green-300 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center mb-4 text-green-600 group-hover:bg-green-100 transition-colors">
                  <FeatureIcon icon={feature.icon} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{benefits.headline}</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">{benefits.subheadline}</p>
          </div>

          <div className="space-y-16 sm:space-y-24">
            {benefits.items.map((benefit, index) => (
              <div
                key={index}
                className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-8 lg:gap-16`}
              >
                <div className="flex-1">
                  <div className="w-full aspect-video rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 flex items-center justify-center">
                    <div className="text-center p-8">
                      <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <p className="text-green-700 text-sm font-medium">{benefit.title}</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">{benefit.title}</h3>
                  <p className="text-gray-600 leading-relaxed text-lg">{benefit.description}</p>
                  <Link
                    href="/product"
                    className="inline-flex items-center mt-6 text-green-700 hover:text-green-800 font-medium transition-colors"
                  >
                    Learn more
                    <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product CTA Section */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-green-700 to-emerald-800" />
            <div className="relative z-10 p-8 sm:p-12 lg:p-16 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Ready to Boost Your Brain Power?
              </h2>
              <p className="text-green-100 max-w-2xl mx-auto mb-8 text-lg">
                Join thousands of Australians who have transformed their cognitive health with Brain Boost 1000. 
                100% natural, ARTG listed, and backed by science.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/product"
                  className="w-full sm:w-auto px-8 py-4 bg-white text-green-800 font-bold rounded-xl hover:bg-gray-100 transition-all duration-300 shadow-lg text-center"
                >
                  Shop Now &mdash; ${productContent.price} AUD
                </Link>
                <Link
                  href="/quiz"
                  className="w-full sm:w-auto px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-all duration-300 text-center"
                >
                  Take the Quiz
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">What Our Customers Say</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">Real reviews from real Australians who transformed their cognitive health with Neurotonics.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="p-6 sm:p-8 rounded-2xl bg-white border border-gray-200 hover:shadow-lg transition-all duration-300"
              >
                <StarRating rating={testimonial.rating} />
                <p className="text-gray-600 mt-4 mb-6 text-sm leading-relaxed">&ldquo;{testimonial.text}&rdquo;</p>
                <div>
                  <p className="text-gray-900 font-semibold">{testimonial.name}</p>
                  <p className="text-gray-400 text-sm">{testimonial.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quiz CTA */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Not Sure Where to Start?</h2>
          <p className="text-gray-500 max-w-2xl mx-auto mb-8 text-lg">
            Take our quick 2-minute quiz and we&apos;ll recommend the perfect solution based on your unique needs.
          </p>
          <Link
            href="/quiz"
            className="inline-flex items-center px-8 py-4 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-green-700/20"
          >
            Find Your Solution
            <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>
    </main>
  );
}
