import Link from 'next/link';
import siteContent from '@/content/site.json';
import productContent from '@/content/product.json';

// Client components for interactive/parallax effects
import ParallaxHero    from '@/components/ParallaxHero';
import ScrollReveal    from '@/components/ScrollReveal';
import ParallaxSection from '@/components/ParallaxSection';
import ProductShowcase from '@/components/ProductShowcase';
import StockistForm    from '@/components/StockistForm';

const BASE_URL = 'https://elitedigitalconsulting.github.io/neurotonics';

/* ── Home page JSON-LD (Organization + WebSite) ─────────────────────── */
function HomeJsonLd() {
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteContent.brand.name,
    url: BASE_URL + '/',
    logo: BASE_URL + '/images/product-main.png',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: siteContent.footer.contactPhone,
      contactType: 'customer service',
      areaServed: 'AU',
      availableLanguage: 'English',
    },
    sameAs: [
      siteContent.footer.socialLinks.instagram,
      siteContent.footer.socialLinks.facebook,
      siteContent.footer.socialLinks.twitter,
    ],
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'AU',
    },
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteContent.brand.name,
    url: BASE_URL + '/',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/product`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Neurotonics Products',
    url: BASE_URL + '/product',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: productContent.name,
        url: BASE_URL + '/product',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
    </>
  );
}

/* ── Shared icon set ────────────────────────────────────────────── */
function CategoryIcon({ icon }: { icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    brain:    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
    sparkles: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />,
    shield:   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
    heart:    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
    leaf:     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.5 0 3-.3 4.3-.9C11 19 8 14.5 8 10c0-2.5 1-4.8 2.6-6.4C11 3.2 11.5 3 12 2z" />,
    flag:     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />,
  };
  // Default to sparkles which is always present in the icons map above
  const iconNode = icons[icon] ?? icons['sparkles'];
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {iconNode}
    </svg>
  );
}

/* ── Star rating helper ─────────────────────────────────────────── */
function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < rating ? 'text-yellow-400' : 'text-white/20'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────── */
export default function Home() {
  const { categories, features, stockist, testimonials } = siteContent;

  return (
    <>
      <HomeJsonLd />
      <main id="main-content">

      {/* ━━━━ 1. HERO – layered parallax ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <ParallaxHero />

      {/* ━━━━ 2. TRUST BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-white border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <ScrollReveal animation="fade-in">
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12">
              {productContent.badges.slice(0, 4).map((badge) => (
                <div key={badge} className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                  <svg className="w-4 h-4 text-brand-green shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {badge}
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ━━━━ 3. SHOP BY BENEFIT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <ScrollReveal animation="fade-up" className="text-center mb-14">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-primary mb-3">
              Find Your Formula
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-brand-navy tracking-tight mb-4">
              Shop by Benefit
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
              Targeted support for every aspect of your cognitive wellness.
            </p>
          </ScrollReveal>

          {/* Category grid – staggered reveal */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {categories.map((category, index) => (
              <ScrollReveal key={index} animation="fade-up" delay={index * 80}>
                <Link
                  href={category.link}
                  className="group flex flex-col items-center p-6 rounded-2xl bg-brand-gray hover:bg-brand-primary-light border border-transparent hover:border-brand-primary/20 transition-all duration-300 text-center card-hover h-full"
                >
                  <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center mb-4 text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-all duration-300 shadow-sm">
                    <CategoryIcon icon={category.icon} />
                  </div>
                  <h3 className="text-sm font-semibold text-brand-navy mb-1">{category.title}</h3>
                  <p className="text-xs text-gray-500 leading-snug">{category.description}</p>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━ 4. FEATURED PRODUCT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <ProductShowcase />

      {/* ━━━━ 5. WHY NEUROTONICS – feature cards ━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <ScrollReveal animation="fade-up" className="text-center mb-14">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-primary mb-3">
              Our Promise
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-brand-navy tracking-tight mb-4">
              Why Neurotonics?
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
              Premium quality you can trust — backed by science and rooted in nature.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <ScrollReveal key={index} animation="fade-up" delay={index * 80}>
                <div className="group p-7 rounded-2xl bg-white border border-brand-border card-hover tilt-card h-full">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-primary-light to-brand-warm-light flex items-center justify-center mb-5 text-brand-primary group-hover:from-brand-primary group-hover:to-brand-warm group-hover:text-white transition-all duration-300">
                    <CategoryIcon icon={feature.icon} />
                  </div>
                  <h3 className="text-lg font-bold text-brand-navy mb-2 tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━ 6. TESTIMONIALS – dark parallax section ━━━━━━━━━━━━━━ */}
      {/*
       * ParallaxSection applies a gentle parallax to its background layer.
       * The gradient orbs move at a slightly different rate to the content,
       * adding subtle depth without being distracting.
       */}
      <ParallaxSection
        className="py-20 sm:py-28 bg-brand-navy"
        speed={0.12}
        bgContent={
          <>
            <div className="absolute inset-0 bg-brand-navy" />
            <div className="absolute top-[10%] left-[5%]  w-72 h-72 rounded-full bg-brand-primary/20 blur-3xl" />
            <div className="absolute bottom-[10%] right-[5%] w-56 h-56 rounded-full bg-brand-warm/15  blur-3xl" />
          </>
        }
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <ScrollReveal animation="fade-up" className="text-center mb-14">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-primary-light mb-3">
              Real Results
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4">
              What Our Customers Say
            </h2>
            <p className="text-white/50 max-w-xl mx-auto leading-relaxed">
              Thousands of Australians trust Neurotonics to support their cognitive health every day.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <ScrollReveal key={index} animation="fade-up" delay={index * 100}>
                <div className="glass-card p-7 rounded-2xl h-full flex flex-col">
                  <Stars rating={testimonial.rating} />
                  <p className="text-white/75 text-sm leading-relaxed mt-4 flex-1">
                    &ldquo;{testimonial.text}&rdquo;
                  </p>
                  <div className="mt-5 pt-5 border-t border-white/10">
                    <p className="text-white font-semibold text-sm">{testimonial.name}</p>
                    <p className="text-white/40 text-xs mt-0.5">{testimonial.location}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </ParallaxSection>

      {/* ━━━━ 8. QUIZ CTA – parallax gradient banner ━━━━━━━━━━━━━━━ */}
      {/*
       * ParallaxSection with a gradient background.  The gradient orbs drift
       * at a different speed to the text, giving a premium depth effect.
       */}
      <ParallaxSection
        className="py-24 sm:py-32"
        speed={0.1}
        bgContent={
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-brand-primary via-[#1a3a9e] to-brand-warm" />
            <div className="absolute top-0 right-0 w-[60%] h-full bg-gradient-to-bl from-white/5 to-transparent" />
            <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute -bottom-16 -left-8  w-80 h-80 rounded-full bg-white/5 blur-3xl" />
          </>
        }
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal animation="scale-up">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-white/50 mb-4">
              Personalised Wellness
            </p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-6 leading-[1.05]">
              Not Sure Where <br className="hidden sm:block" />to Start?
            </h2>
            <p className="text-white/70 max-w-xl mx-auto mb-10 text-lg leading-relaxed">
              Take our 2-minute wellness quiz and receive personalised supplement recommendations based on your unique goals.
            </p>
            <Link
              href="/quiz"
              className="group inline-flex items-center gap-3 px-9 py-4 bg-white text-brand-primary font-bold rounded-xl hover:bg-gray-50 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98] text-base"
            >
              Take the Wellness Quiz
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </ScrollReveal>
        </div>
      </ParallaxSection>

      {/* ━━━━ 9. BECOME A STOCKIST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="stockist" className="py-20 sm:py-28 bg-brand-navy">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="fade-up">
            <div className="text-center mb-10">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-primary-light mb-4">
                {stockist.eyebrow}
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
                {stockist.headline}
              </h2>
              <p className="text-white/45 leading-relaxed max-w-xl mx-auto">
                {stockist.subheadline}
              </p>
            </div>
            <StockistForm />
          </ScrollReveal>
        </div>
      </section>

    </main>
    </>
  );
}
