'use client';

/**
 * BrainHero – full-viewport hero with immersive 3D-background brain image.
 *
 * Layers (back → front):
 *   1. Deep-space background gradient + radial accent (static)
 *   2. Brain image group – large background element with multi-layer depth FX:
 *        a. Blurred shadow-clone  – simulates depth/cast shadow behind brain
 *        b. Multi-ring ambient glow (depth-pulse, float-slow, float-medium)
 *        c. Levitating brain <Image> – drop-shadow + sharp render
 *        d. Specular highlight div  – bright spot that shifts with mouse tilt
 *        e. Light-sweep overlay     – one-pass diagonal shimmer
 *   3. Text-readability gradient   – dark-left → transparent-right (z-[2])
 *   4. Text content                – fades/rises on scroll (z-10)
 *
 * 3D effect algorithm:
 *   - scrollRotX: brain tilts backward as hero scrolls (depth illusion)
 *   - scrollRotY: subtle side rotation for premium floating feel
 *   - parallaxY:  image moves upward faster than scroll (parallax depth)
 *   - mouseRotX/Y: image follows cursor for interactive tilt
 *   - specularX/Y: specular highlight shifts opposite to tilt (light source illusion)
 *
 * Reduced motion: all dynamic transforms and animations disabled.
 * Mobile: mouse-tracking disabled; scroll uses lighter constants.
 */

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import siteContent from '@/content/site.json';

/** Source URL for the hero brain illustration */
const BRAIN_IMAGE_SRC =
  'https://github.com/user-attachments/assets/2e89f42d-2885-4121-a9bd-0d444bfa2384';

// ── 3D scroll effect constants (degrees) ──────────────────────────────────
export const SCROLL_ROTATE_X  = 14;   // brain tilts backward as hero scrolls out
export const SCROLL_ROTATE_Y  = 6;    // subtle horizontal rotation
export const SCROLL_PARALLAX  = 0.30; // fraction of scrollY applied as translateY
export const SCROLL_SCALE_MIN = 0.92; // scale at full hero scroll

// ── Mouse-tracking tilt constants ─────────────────────────────────────────
export const MOUSE_TILT_DESKTOP = 10; // max degrees on desktop
export const MOUSE_TILT_MOBILE  = 4;  // max degrees on tablet

/**
 * How far the specular highlight shifts from centre (50%) when the mouse moves
 * to the edge (dx/dy = ±1).  A value of 18 keeps the bright spot within the
 * brain silhouette while still reading clearly as a moving light source.
 */
export const SPECULAR_SHIFT = 18; // pixels of specular displacement per unit tilt

// ── Hero image responsive width/height sizes (px) ─────────────────────────
// These are exported so tests can assert the image is "large".
export const IMAGE_SIZE = {
  mobile:  440,   // base
  sm:      620,   // ≥640 px viewport
  lg:      820,   // ≥1024 px viewport
  xl:      960,   // ≥1280 px viewport
} as const;

export default function BrainHero() {
  const heroRef      = useRef<HTMLElement>(null);
  const contentRef   = useRef<HTMLDivElement>(null);
  const imageRef     = useRef<HTMLDivElement>(null);   // 3D transform target
  const specRef      = useRef<HTMLDivElement>(null);   // specular highlight target
  const mouseRef     = useRef({ dx: 0, dy: 0 });      // normalised -1…1 cursor pos
  const [scrollPct, setScrollPct] = useState(0);

  const { hero } = siteContent;

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile      = window.matchMedia('(max-width: 768px)').matches;
    let rafId: number | undefined;

    // Track scroll values in closure refs to avoid stale state in RAF
    let currentScrollY   = 0;
    let currentScrollPct = 0;

    /* ── Build the CSS transform string from scroll + mouse state ── */
    const buildTransform = (): string => {
      const { dx, dy } = mouseRef.current;
      const maxTilt     = isMobile ? MOUSE_TILT_MOBILE : MOUSE_TILT_DESKTOP;

      // Scroll contribution
      const rotX    = -(currentScrollPct * SCROLL_ROTATE_X);
      const rotY    =   currentScrollPct * SCROLL_ROTATE_Y;
      const transY  =   currentScrollY   * SCROLL_PARALLAX;
      const scale   = 1 - currentScrollPct * (1 - SCROLL_SCALE_MIN);

      // Mouse-tracking contribution (added on top of scroll)
      const mRotX = -dy * maxTilt;
      const mRotY =  dx * maxTilt;

      return `perspective(1200px) translateY(-${transY.toFixed(1)}px) rotateX(${(rotX + mRotX).toFixed(2)}deg) rotateY(${(rotY + mRotY).toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    };

    /* ── Update specular highlight position opposite to tilt (light-source illusion) ── */
    const applySpecular = () => {
      if (!specRef.current || reducedMotion) return;
      const { dx, dy } = mouseRef.current;
      // Specular moves opposite to tilt direction (light appears fixed in space).
      // SPECULAR_SHIFT controls how far the bright spot travels per unit of tilt.
      const sx = 50 - dx * SPECULAR_SHIFT;
      const sy = 38 - dy * SPECULAR_SHIFT;
      specRef.current.style.background =
        `radial-gradient(ellipse 38% 32% at ${sx}% ${sy}%, rgba(160,210,255,0.12) 0%, transparent 70%)`;
    };

    /* ── Apply 3D transform to the image wrapper element ───────── */
    const applyImageTransform = () => {
      if (!imageRef.current || reducedMotion) return;
      imageRef.current.style.transform = buildTransform();
      applySpecular();
    };

    /* ── Scroll handler ─────────────────────────────────────────── */
    const onScroll = () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const heroHeight = heroRef.current?.offsetHeight ?? window.innerHeight;
        currentScrollY   = window.scrollY;
        currentScrollPct = Math.min(currentScrollY / heroHeight, 1);
        setScrollPct(currentScrollPct);

        // Fade + rise the text content
        if (!reducedMotion && contentRef.current) {
          const opacity    = Math.max(0, 1 - currentScrollPct * 2.5);
          const translateY = currentScrollPct * heroHeight * 0.12;
          contentRef.current.style.opacity   = String(opacity);
          contentRef.current.style.transform = `translateY(${translateY}px)`;
        }

        applyImageTransform();
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    /* ── Mouse-tracking tilt (skipped on mobile) ────────────────── */
    if (!reducedMotion && !isMobile) {
      const heroEl = heroRef.current;

      const onMouseMove = (e: MouseEvent) => {
        if (!heroEl) return;
        const rect = heroEl.getBoundingClientRect();
        mouseRef.current = {
          dx: (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2),
          dy: (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2),
        };
        applyImageTransform();
      };

      const onMouseLeave = () => {
        mouseRef.current = { dx: 0, dy: 0 };
        // Smooth ease-back to scroll-only position
        if (imageRef.current) {
          imageRef.current.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
          applyImageTransform();
          setTimeout(() => {
            if (imageRef.current) imageRef.current.style.transition = '';
          }, 620);
        }
      };

      heroEl?.addEventListener('mousemove', onMouseMove);
      heroEl?.addEventListener('mouseleave', onMouseLeave);

      return () => {
        window.removeEventListener('scroll', onScroll);
        if (rafId !== undefined) cancelAnimationFrame(rafId);
        heroEl?.removeEventListener('mousemove', onMouseMove);
        heroEl?.removeEventListener('mouseleave', onMouseLeave);
      };
    }

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

      {/*
       * ── BRAIN IMAGE — immersive 3D background element ─────────────────
       *
       * Two-layer approach:
       *   • Outer div (no JS transform): handles absolute positioning + flex centering
       *   • Inner div (imageRef): receives scroll + mouse 3D transforms from JS
       *
       * The brain is enlarged significantly to become a major background feature.
       * z-index is deliberately NOT set (defaults to auto/0) so hero text (z-10)
       * always renders above it.
       *
       * Depth layers inside imageRef (back → front):
       *   1. Blurred shadow-clone    – slightly upscaled blurry copy creates cast shadow
       *   2. Outer halo glow         – pulsing deep-blue ellipse (animate-brain-depth-pulse)
       *   3. Mid glow                – slower cyan float layer
       *   4. Inner accent glow       – hot centre (animate-float-medium)
       *   5. Light-sweep shimmer     – one-pass diagonal shimmer (animate-light-sweep)
       *   6. Levitation wrapper      – continuous gentle float (animate-brain-levitate)
       *        └─ <Image>            – sharp render with strong blue drop-shadow
       *   7. Specular highlight div  – mouse-driven bright spot (light-source illusion)
       */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center
                   w-[440px] sm:w-[620px] lg:w-[820px] xl:w-[960px]
                   pointer-events-none"
        aria-hidden="true"
        data-testid="brain-image-outer"
      >
        <div
          ref={imageRef}
          className="relative w-full
                     h-[440px] sm:h-[620px] lg:h-[820px] xl:h-[960px]"
          style={{ willChange: 'transform', transformStyle: 'preserve-3d' }}
          data-testid="brain-image-3d"
        >
          {/* Layer 1: Blurred shadow-clone — simulates cast shadow / depth haze */}
          <div
            className="absolute inset-0 scale-[1.12] blur-3xl opacity-35 pointer-events-none"
            aria-hidden="true"
          >
            <Image
              src={BRAIN_IMAGE_SRC}
              alt=""
              fill
              className="object-contain"
              unoptimized
            />
          </div>

          {/* Layer 2: Outer pulsing halo glow */}
          <div
            className="absolute inset-0 rounded-full bg-blue-700/20 blur-[90px] animate-brain-depth-pulse"
            aria-hidden="true"
          />

          {/* Layer 3: Mid ambient glow — floats slowly */}
          <div
            className="absolute inset-[8%] rounded-full bg-blue-600/20 blur-[65px] animate-float-slow"
            aria-hidden="true"
          />

          {/* Layer 4: Inner accent glow — cyan highlight */}
          <div
            className="absolute inset-[22%] rounded-full bg-cyan-500/15 blur-[45px] animate-float-medium"
            aria-hidden="true"
          />

          {/* Layer 5: Hot core highlight */}
          <div
            className="absolute inset-[38%] rounded-full bg-blue-300/10 blur-[30px]"
            aria-hidden="true"
          />

          {/* Layer 6: Diagonal light-sweep shimmer (one-pass, very subtle) */}
          <div
            className="absolute inset-0 animate-light-sweep pointer-events-none overflow-hidden rounded-full"
            style={{
              background:
                'linear-gradient(135deg, transparent 30%, rgba(140,190,255,0.07) 50%, transparent 70%)',
            }}
            aria-hidden="true"
          />

          {/* Layer 7: Brain image inside levitation wrapper */}
          <div className="absolute inset-0 animate-brain-levitate">
            <Image
              src={BRAIN_IMAGE_SRC}
              alt="3D brain illustration"
              fill
              className="object-contain drop-shadow-[0_0_80px_rgba(59,130,246,0.65)]"
              priority
              unoptimized
            />
          </div>

          {/* Layer 8: Specular highlight — position updated by JS on mouse move */}
          <div
            ref={specRef}
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 38% 32% at 50% 38%, rgba(160,210,255,0.08) 0%, transparent 70%)',
            }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/*
       * ── Text-readability gradient overlay ─────────────────────────────
       * Sits at z-[2] — above the brain image (z-auto) but below hero text (z-10).
       * Fades the hero background from opaque-dark on the left to transparent on
       * the right so the brain glow does not reduce text contrast.
       */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background:
            'linear-gradient(to right, #01030f 0%, #01030f 18%, rgba(1,3,15,0.82) 38%, rgba(1,3,15,0.28) 62%, transparent 80%)',
        }}
        aria-hidden="true"
        data-testid="readability-gradient"
      />

      {/* ── Text content (left column on desktop, stacked on mobile) ─── */}
      <div
        ref={contentRef}
        className="relative z-10 flex items-center min-h-screen"
        style={{ willChange: 'transform, opacity' }}
        data-testid="hero-text-content"
      >
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-44 sm:pt-56 pb-20 sm:pb-28">

          {/* On desktop: left half only — right half shows the 3D brain */}
          <div className="lg:w-1/2">

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
