'use client';

/**
 * ParallaxHero – full-viewport hero with three parallax layers:
 *   1. Background (gradient + orbs) – moves at 40 % of scroll speed (appears deepest)
 *   2. Content (text / CTAs)        – moves at 15 % of scroll speed, fades on exit
 *   3. Product image                – moves at 28 % of scroll speed (mid depth)
 *
 * All effects are disabled when the user prefers reduced motion.
 */

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import siteContent from '@/content/site.json';
import productContent from '@/content/product.json';

export default function ParallaxHero() {
  const heroRef    = useRef<HTMLElement>(null);
  const bgRef      = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const imageRef   = useRef<HTMLDivElement>(null);

  const { hero } = siteContent;

  useEffect(() => {
    // Bail out if the user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let rafId: number | undefined;

    const onScroll = () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const scrollY     = window.scrollY;
        const heroHeight  = heroRef.current?.offsetHeight ?? 0;

        // Only apply while the hero is visible
        if (scrollY > heroHeight * 1.5) return;

        /* Background layer – slowest parallax (feels deepest) */
        if (bgRef.current) {
          bgRef.current.style.transform = `translateY(${scrollY * 0.4}px)`;
        }

        /* Content layer – very subtle drift + fade out */
        if (contentRef.current) {
          const progress = Math.min(scrollY / (heroHeight * 0.75), 1);
          contentRef.current.style.transform = `translateY(${scrollY * 0.15}px)`;
          contentRef.current.style.opacity   = String(1 - progress);
        }

        /* Image layer – mid-depth parallax */
        if (imageRef.current) {
          imageRef.current.style.transform = `translateY(${scrollY * 0.28}px)`;
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId !== undefined) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center overflow-hidden bg-brand-navy"
      aria-label="Hero"
    >
      {/* ── Layer 1: Parallax background ───────────────────────────── */}
      <div
        ref={bgRef}
        className="absolute inset-0 parallax-layer"
        /* Oversized so the parallax offset never shows bare edge */
        style={{ top: '-20%', height: '140%', willChange: 'transform' }}
        aria-hidden="true"
      >
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-navy via-[#0d1f6e] to-[#0a195a]" />

        {/* Floating ambient orbs */}
        <div className="absolute top-[8%]  right-[12%] w-80  h-80  rounded-full bg-brand-primary/25 blur-3xl animate-float-slow" />
        <div className="absolute top-[55%] left-[6%]  w-56  h-56  rounded-full bg-brand-warm/20   blur-3xl animate-float-medium" />
        <div className="absolute top-[30%] right-[3%] w-36  h-36  rounded-full bg-[#3b5fc0]/15  blur-2xl animate-float-fast" />
        <div className="absolute bottom-[10%] right-[30%] w-24 h-24 rounded-full bg-brand-green/10 blur-2xl animate-float-medium" />

        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px),' +
              'linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      {/* ── Layer 2: Content (text / CTAs) ─────────────────────────── */}
      <div
        ref={contentRef}
        className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 parallax-layer"
        style={{ willChange: 'transform' }}
      >
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">

          {/* Text column */}
          <div>
            {/* Badge */}
            <div className="animate-hero-badge-in" style={{ animationDelay: '0ms' }}>
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-6 backdrop-blur-sm text-white/90 text-sm font-medium">
                🧠 {siteContent.brand.tagline}
              </span>
            </div>

            {/* Headline */}
            <h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.04] tracking-tight animate-hero-fade-up"
              style={{ animationDelay: '80ms' }}
            >
              {hero.headline}
            </h1>

            {/* Subheadline */}
            <p
              className="text-lg sm:text-xl text-white/65 mb-8 leading-relaxed max-w-xl animate-hero-fade-up"
              style={{ animationDelay: '200ms' }}
            >
              {hero.subheadline}
            </p>

            {/* CTAs */}
            <div
              className="flex flex-col sm:flex-row gap-4 animate-hero-fade-up"
              style={{ animationDelay: '320ms' }}
            >
              <Link
                href={hero.ctaLink}
                className="group px-8 py-4 bg-white text-brand-navy font-bold rounded-lg transition-all duration-300 text-center shadow-xl hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98]"
              >
                {hero.ctaText}
                <span className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
              <Link
                href={hero.secondaryCtaLink}
                className="px-8 py-4 border border-white/30 text-white hover:bg-white/10 font-semibold rounded-lg transition-all duration-300 text-center backdrop-blur-sm"
              >
                {hero.secondaryCtaText}
              </Link>
            </div>

            {/* Social proof stats */}
            <div
              className="mt-12 pt-8 border-t border-white/10 grid grid-cols-3 gap-8 animate-hero-fade-up"
              style={{ animationDelay: '440ms' }}
            >
              {[
                { value: '10,000+', label: 'Happy Customers' },
                { value: '4.9 ★',   label: 'Average Rating'  },
                { value: '100%',    label: 'Natural Formula'  },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-white/45 mt-1 tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Layer 3: Product image (separate parallax depth) ────── */}
          <div
            ref={imageRef}
            className="hidden lg:flex justify-center parallax-layer"
            style={{ willChange: 'transform' }}
            aria-hidden="true"
          >
            <div className="relative w-[380px] h-[500px] animate-hero-fade-up" style={{ animationDelay: '160ms' }}>
              {/* Glow behind the bottle */}
              <div className="absolute inset-8 bg-gradient-to-br from-brand-primary/50 to-brand-warm/40 rounded-full blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/30 to-transparent rounded-3xl" />
              <Image
                src={productContent.images[0].src}
                alt={productContent.images[0].alt}
                width={380}
                height={500}
                className="relative z-10 w-full h-full object-contain drop-shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-8 left-1/2 animate-scroll-bounce flex flex-col items-center text-white/40 pointer-events-none"
        aria-hidden="true"
      >
        <span className="text-[10px] tracking-[0.2em] uppercase mb-2">Scroll</span>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </section>
  );
}
