import Link from 'next/link';
import Image from 'next/image';
import siteContent from '@/content/site.json';
import productContent from '@/content/product.json';

function CategoryIcon({ icon }: { icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    brain: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
    sparkles: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />,
    shield: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
    heart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
    leaf: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.5 0 3-.3 4.3-.9C11 19 8 14.5 8 10c0-2.5 1-4.8 2.6-6.4C11 3.2 11.5 3 12 2z" />,
    flag: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />,
  };

  return (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          className={`w-4 h-4 ${i < rating ? 'text-amber-500' : 'text-gray-300'}`}
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
  const { hero, categories, features, benefits, testimonials, wellness, newsletter } = siteContent;

  return (
    <main>
      {/* Hero Section - Full Width Bold Banner */}
      <section className="relative min-h-[70vh] sm:min-h-[80vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-navy via-brand-navy/95 to-brand-navy/70" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-brand-warm/30 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-6">
                <span className="text-white/90 text-sm font-medium">🧠 {siteContent.brand.tagline}</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
                {hero.headline}
              </h1>

              <p className="text-lg sm:text-xl text-gray-300 mb-8 leading-relaxed max-w-xl">
                {hero.subheadline}
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href={hero.ctaLink}
                  className="px-8 py-4 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold rounded-lg transition-all duration-300 text-center shadow-lg"
                >
                  {hero.ctaText}
                </Link>
                <Link
                  href={hero.secondaryCtaLink}
                  className="px-8 py-4 border-2 border-white/30 text-white hover:bg-white/10 font-semibold rounded-lg transition-all duration-300 text-center"
                >
                  {hero.secondaryCtaText}
                </Link>
              </div>
            </div>

            <div className="hidden lg:flex justify-center">
              <div className="relative w-80 h-80">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/20 to-brand-warm/20 rounded-full blur-3xl" />
                <Image
                  src={productContent.images[0].src}
                  alt={productContent.images[0].alt}
                  width={320}
                  height={320}
                  className="relative z-10 w-full h-full object-contain drop-shadow-2xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="bg-brand-gray border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-sm text-gray-600">
            {productContent.badges.slice(0, 4).map((badge) => (
              <div key={badge} className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-brand-green" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">{badge}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shop by Category - Swisse Style Grid */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-brand-navy mb-3">Shop by Benefit</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">Find the right supplement for your cognitive wellness goals.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {categories.map((category, index) => (
              <Link
                key={index}
                href={category.link}
                className="group flex flex-col items-center p-6 rounded-2xl bg-brand-gray hover:bg-brand-primary-light border border-transparent hover:border-brand-primary/20 transition-all duration-300 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center mb-3 text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-all duration-300 shadow-sm">
                  <CategoryIcon icon={category.icon} />
                </div>
                <h3 className="text-sm font-semibold text-brand-navy mb-1">{category.title}</h3>
                <p className="text-xs text-gray-500 leading-snug">{category.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Best Seller / Featured Product - Swisse Style */}
      <section className="py-16 sm:py-20 bg-brand-gray">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-brand-navy mb-2">Best Seller</h2>
              <p className="text-gray-500">Our most popular cognitive supplement.</p>
            </div>
            <Link
              href="/product"
              className="hidden sm:inline-flex items-center text-brand-primary hover:text-brand-primary-dark font-semibold transition-colors"
            >
              View Details
              <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-brand-border">
            <div className="grid lg:grid-cols-2 gap-0">
              <div className="bg-gradient-to-br from-brand-primary-light to-white p-8 sm:p-12 flex items-center justify-center">
                <Image
                  src={productContent.images[0].src}
                  alt={productContent.images[0].alt}
                  width={400}
                  height={400}
                  className="w-auto max-h-80 object-contain"
                />
              </div>
              <div className="p-8 sm:p-12 flex flex-col justify-center">
                <div className="flex flex-wrap gap-2 mb-4">
                  {productContent.badges.slice(0, 3).map((badge) => (
                    <span key={badge} className="inline-flex items-center px-3 py-1 rounded-full bg-brand-green-light text-brand-green text-xs font-medium">
                      {badge}
                    </span>
                  ))}
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-brand-navy mb-3">{productContent.name}</h3>
                <p className="text-gray-600 mb-4 leading-relaxed">{productContent.shortDescription}</p>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl font-bold text-brand-primary">${productContent.price}</span>
                  <span className="text-gray-500 text-sm">{productContent.currency} · {productContent.supply}</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/product"
                    className="px-8 py-3 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold rounded-lg transition-all duration-300 text-center shadow-sm"
                  >
                    Shop Now
                  </Link>
                  <Link
                    href="/product"
                    className="px-8 py-3 border border-brand-border text-brand-navy hover:bg-brand-gray font-semibold rounded-lg transition-all duration-300 text-center"
                  >
                    Learn More
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Clean Cards */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-brand-navy mb-3">Why Neurotonics?</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">Premium quality you can trust, backed by science and nature.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 rounded-xl bg-white border border-brand-border hover:border-brand-primary/30 hover:shadow-md transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-full bg-brand-primary-light flex items-center justify-center mb-4 text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-all duration-300">
                  <CategoryIcon icon={feature.icon} />
                </div>
                <h3 className="text-lg font-semibold text-brand-navy mb-2">{feature.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 sm:py-20 bg-brand-gray">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-brand-navy mb-3">{benefits.headline}</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">{benefits.subheadline}</p>
          </div>

          <div className="space-y-12 sm:space-y-16">
            {benefits.items.map((benefit, index) => (
              <div
                key={index}
                className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-8 lg:gap-16`}
              >
                <div className="flex-1">
                  <div className="w-full aspect-video rounded-2xl bg-gradient-to-br from-brand-primary-light to-white border border-brand-border flex items-center justify-center p-8">
                    <Image
                      src={productContent.images[0].src}
                      alt={productContent.images[0].alt}
                      width={300}
                      height={300}
                      className="w-auto h-full max-h-56 object-contain"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl sm:text-3xl font-bold text-brand-navy mb-4">{benefit.title}</h3>
                  <p className="text-gray-600 leading-relaxed text-lg">{benefit.description}</p>
                  <Link
                    href="/product"
                    className="inline-flex items-center mt-6 text-brand-primary hover:text-brand-primary-dark font-medium transition-colors"
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

      {/* Testimonials Section */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-brand-navy mb-3">What Our Customers Say</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">Real reviews from real Australians who transformed their cognitive health.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="p-6 rounded-xl bg-brand-gray border border-brand-border hover:shadow-md transition-all duration-300"
              >
                <StarRating rating={testimonial.rating} />
                <p className="text-gray-600 mt-4 mb-6 text-sm leading-relaxed">&ldquo;{testimonial.text}&rdquo;</p>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-semibold text-sm">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-brand-navy font-semibold text-sm">{testimonial.name}</p>
                    <p className="text-gray-400 text-xs">{testimonial.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wellness Hub - Blog/Articles Preview */}
      <section className="py-16 sm:py-20 bg-brand-gray">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-brand-navy mb-2">{wellness.headline}</h2>
              <p className="text-gray-500">{wellness.subheadline}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {wellness.articles.map((article, index) => (
              <Link
                key={index}
                href={article.link}
                className="group bg-white rounded-xl overflow-hidden border border-brand-border hover:shadow-md transition-all duration-300"
              >
                <div className="h-40 bg-gradient-to-br from-brand-primary-light to-brand-warm-light flex items-center justify-center">
                  <svg className="w-12 h-12 text-brand-primary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="p-6">
                  <span className="inline-block px-2 py-1 rounded bg-brand-green-light text-brand-green text-xs font-medium mb-3">{article.category}</span>
                  <h3 className="text-lg font-semibold text-brand-navy mb-2 group-hover:text-brand-primary transition-colors">{article.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{article.excerpt}</p>
                  <span className="inline-flex items-center mt-4 text-brand-primary text-sm font-medium">
                    Read more
                    <svg className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Quiz CTA */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-primary to-brand-warm" />
            <div className="relative z-10 p-8 sm:p-12 lg:p-16 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Not Sure Where to Start?
              </h2>
              <p className="text-white/90 max-w-2xl mx-auto mb-8 text-lg">
                Take our quick 2-minute wellness quiz and get personalised recommendations based on your unique needs.
              </p>
              <Link
                href="/quiz"
                className="inline-flex items-center px-8 py-4 bg-white text-brand-primary font-bold rounded-lg hover:bg-gray-100 transition-all duration-300 shadow-lg"
              >
                Take the Wellness Quiz
                <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="py-16 sm:py-20 bg-brand-navy">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">{newsletter.headline}</h2>
          <p className="text-gray-400 mb-8">{newsletter.subheadline}</p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <input
              type="email"
              placeholder={newsletter.placeholder}
              className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-brand-warm focus:ring-1 focus:ring-brand-warm"
              aria-label="Email address"
            />
            <button
              type="button"
              className="px-6 py-3 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold rounded-lg transition-all duration-300"
            >
              {newsletter.buttonText}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
