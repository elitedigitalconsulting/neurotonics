import Image from 'next/image';
import Link from 'next/link';
import ScrollReveal from '@/components/ScrollReveal';
import productContent from '@/content/product.json';

const keyIngredients = [
  { name: 'Turmeric',  emoji: '🌿' },
  { name: 'Rosemary',  emoji: '🌱' },
  { name: 'Guarana',   emoji: '🍃' },
];

const benefits = [
  'Enhances Focus & Clarity',
  'Improves Memory Recall',
  'Reduces Stress & Brain Fog',
  'Natural & Vegan',
];

const STOCK_PERCENT = productContent.stockPercent;
const UNITS_LEFT    = productContent.unitsLeft;

export default function ProductShowcase() {
  return (
    <section className="relative py-20 sm:py-28 overflow-hidden bg-gradient-to-br from-brand-navy via-[#0d1f6e] to-[#0a195a]">
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[5%]  right-[8%]  w-80 h-80 rounded-full bg-brand-primary/20 blur-3xl" />
        <div className="absolute bottom-[5%] left-[4%] w-64 h-64 rounded-full bg-brand-warm/15   blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* ── Left: Product image ──────────────────────────────── */}
          <ScrollReveal animation="fade-right">
            <div className="flex justify-center lg:justify-end">
              <div className="relative w-[320px] sm:w-[380px] tilt-card">
                {/* Glow layers */}
                <div className="absolute inset-8 bg-gradient-to-br from-brand-primary/60 to-brand-warm/50 rounded-full blur-3xl" />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/40 to-transparent rounded-3xl" />
                <Image
                  src={productContent.images[0].src}
                  alt={productContent.images[0].alt}
                  width={380}
                  height={500}
                  className="relative z-10 w-full h-auto object-contain drop-shadow-2xl"
                />
              </div>
            </div>
          </ScrollReveal>

          {/* ── Right: Details ───────────────────────────────────── */}
          <ScrollReveal animation="fade-left">
            <div className="space-y-6">

              {/* BESTSELLER badge */}
              <div className="relative inline-flex items-center">
                <span className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-warm/30 border border-brand-warm/50 text-white text-xs font-bold tracking-widest uppercase animate-pulse-ring">
                  🏆 Bestseller
                </span>
              </div>

              {/* Badge pills */}
              <div className="flex flex-wrap gap-2">
                {productContent.badges.slice(0, 3).map((badge) => (
                  <span
                    key={badge}
                    className="glass-card px-3 py-1 rounded-full text-white/80 text-xs font-semibold tracking-wide"
                  >
                    {badge}
                  </span>
                ))}
              </div>

              {/* Name & description */}
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
                  {productContent.name}
                </h2>
                <p className="text-white/60 leading-relaxed">
                  {productContent.shortDescription}
                </p>
              </div>

              {/* Star rating */}
              <div className="flex items-center gap-3">
                <div className="flex gap-0.5" aria-label="4.9 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      className="w-5 h-5 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-white/70 text-sm">4.9 · 2,400+ reviews</span>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold text-white">
                  ${productContent.price.toFixed(2)}
                </span>
                <span className="text-white/40 text-sm">{productContent.currency} · {productContent.supply}</span>
              </div>

              {/* Ingredients */}
              <div>
                <p className="text-white/50 text-xs uppercase tracking-wider font-semibold mb-3">Key Ingredients</p>
                <div className="grid grid-cols-3 gap-2">
                  {keyIngredients.map((ing) => (
                    <div key={ing.name} className="glass-card rounded-xl px-3 py-2.5 text-center">
                      <span className="text-xl block mb-1">{ing.emoji}</span>
                      <span className="text-white/70 text-xs leading-tight block">{ing.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Benefits checklist */}
              <ul className="space-y-2">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3 text-white/80 text-sm">
                    <span className="w-5 h-5 rounded-full bg-brand-green/30 border border-brand-green/50 flex items-center justify-center shrink-0 text-brand-green text-xs font-bold">
                      ✓
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>



              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Link
                  href="/product"
                  className="btn-glow relative flex-1 px-8 py-4 bg-white text-brand-navy font-bold rounded-xl text-center shadow-xl hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 text-sm sm:text-base"
                >
                  Buy Now — ${productContent.price.toFixed(2)} {productContent.currency}
                </Link>
                <Link
                  href="/product"
                  className="px-6 py-4 border border-white/20 text-white/80 hover:bg-white/10 font-semibold rounded-xl transition-all duration-300 text-center text-sm backdrop-blur-sm"
                >
                  Learn More →
                </Link>
              </div>

            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
