import Link from 'next/link';
import ScrollReveal from '@/components/ScrollReveal';
import ProductImage3D from '@/components/ProductImage3D';
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
    <section className="relative py-20 sm:py-28 overflow-hidden bg-gradient-to-br from-[#0d1f6e] via-[#0a195a] to-[#071440]">
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[5%]  right-[8%]  w-80 h-80 rounded-full bg-brand-primary/20 blur-3xl" />
        <div className="absolute bottom-[5%] left-[4%] w-64 h-64 rounded-full bg-brand-warm/15   blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* ── Left: Product image (3D scroll-adaptive) ─────────── */}
          <ScrollReveal animation="fade-right">
            <div className="flex justify-center lg:justify-end">
              <ProductImage3D />
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

              </div>

            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
