'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import siteContent from '@/content/site.json';

export default function BrainHero() {
  const heroRef    = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrollPct, setScrollPct] = useState(0);

  const { hero } = siteContent;

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId: number | undefined;

    let currentScrollPct = 0;

    const onScroll = () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const heroHeight = heroRef.current?.offsetHeight ?? window.innerHeight;
        currentScrollPct = Math.min(window.scrollY / heroHeight, 1);
        setScrollPct(currentScrollPct);

        if (!reducedMotion && contentRef.current) {
          const opacity    = Math.max(0, 1 - currentScrollPct * 2.5);
          const translateY = currentScrollPct * heroHeight * 0.12;
          contentRef.current.style.opacity   = String(opacity);
          contentRef.current.style.transform = `translateY(${translateY}px)`;
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
      className="relative min-h-screen overflow-hidden bg-[#01030f] -mt-24 sm:-mt-28"
      aria-label="Hero — 3D Brain Visualisation"
    >

      {/* ── Scroll-progress indicator ─────────────────────────────── */}
      <div
        className="fixed top-0 left-0 h-[2px] z-50 pointer-events-none transition-opacity"
        style={{
          width:      `${scrollPct * 100}%`,
          background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
          opacity:    scrollPct > 0.05 ? 1 : 0,
        }}
        aria-hidden="true"
      />

      {/* ── Deep-space background — near-black for maximum glow contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#01030f] via-[#020614] to-[#010408]" aria-hidden="true" />

      {/* ── Radial blue accent — centred right to highlight the brain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 65% 75% at 72% 52%, rgba(17,85,238,0.22) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* ── Fine star-field grid overlay ─────────────────────────── */}
      <div
        className="absolute inset-0 opacity-[0.018] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
        aria-hidden="true"
      />

      {/* ── Text content (left column on desktop, stacked on mobile) ─── */}
      <div
        ref={contentRef}
        className="relative z-10 flex items-center min-h-screen"
        style={{ willChange: 'transform, opacity' }}
        data-testid="hero-text-content"
      >
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-44 sm:pt-56 pb-20 sm:pb-28">

          <div className="lg:w-2/3">

            {/* ── Badge ── */}
            <div className="animate-hero-badge-in" style={{ animationDelay: '0ms' }}>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-6 backdrop-blur-sm text-white/90 text-sm font-medium">
                {/* Neural pulse dot */}
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
                </span>
                🧠 {siteContent.brand.tagline}
              </span>
            </div>

            {/* ── Headline ── */}
            <h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.04] tracking-tight animate-hero-fade-up"
              style={{ animationDelay: '80ms' }}
            >
              {hero.headline}
            </h1>

            {/* ── Sub-headline ── */}
            <p
              className="text-lg sm:text-xl text-white/65 mb-8 leading-relaxed animate-hero-fade-up"
              style={{ animationDelay: '200ms' }}
            >
              {hero.subheadline}
            </p>

            {/* ── Scroll hint — activates the 3D effect ── */}
            <p
              className="text-xs text-cyan-400/60 tracking-[0.18em] uppercase mb-8 animate-hero-fade-up"
              style={{ animationDelay: '240ms' }}
            >
              ↓ Scroll to activate neural pathways
            </p>

            {/* ── CTAs ── */}
            <div
              className="flex flex-col sm:flex-row gap-4 animate-hero-fade-up"
              style={{ animationDelay: '320ms' }}
            >
              <Link
                href={hero.ctaLink}
                className="btn-glow group px-8 py-4 bg-white text-brand-navy font-bold rounded-lg transition-all duration-300 text-center shadow-xl hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98]"
              >
                {hero.ctaText}
                <span className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
              <Link
                href={hero.secondaryCtaLink}
                className="btn-glow px-8 py-4 border border-white/30 text-white hover:bg-white/10 font-semibold rounded-lg transition-all duration-300 text-center backdrop-blur-sm"
              >
                {hero.secondaryCtaText}
              </Link>
            </div>

            {/* ── Stats ── */}
            <div
              className="mt-12 pt-8 border-t border-white/10 grid grid-cols-2 gap-8 animate-hero-fade-up"
              style={{ animationDelay: '440ms' }}
            >
              {[
                { value: '10,000+', label: 'Happy Customers' },
                { value: '100%',    label: 'Natural Formula'  },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-white/45 mt-1 tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Scroll indicator (bottom center) ─────────────────────────── */}
      <div
        className="absolute bottom-8 left-1/2 animate-scroll-bounce flex flex-col items-center text-white/40 pointer-events-none"
        aria-hidden="true"
      >
        <span className="text-[10px] tracking-[0.2em] uppercase mb-2">Scroll</span>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* ── Bottom gradient fade to page background ───────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#01030f] to-transparent pointer-events-none"
        aria-hidden="true"
      />
    </section>
  );
}
