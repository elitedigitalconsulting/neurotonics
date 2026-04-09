'use client';

/**
 * ProductImage3D – scroll-adaptive 3D product image for the featured
 * section.  As the element passes through the viewport the image tilts
 * subtly in 3D space; on desktop a mouse-tracking tilt is added on top.
 *
 * Effect algorithm:
 *   centred = how far the image centre is from the viewport centre (-1…+1)
 *   scrollRotX = centred × MAX_SCROLL_ROTATE   (forward tilt at centre)
 *   scrollRotY = centred × MAX_SCROLL_ROTATE/2 (horizontal lean)
 *   mouseRotX/Y = cursor-relative offset × MAX_MOUSE_TILT (desktop only)
 *
 * Reduced motion: all dynamic transforms are disabled.
 * Mobile:         mouse-tracking disabled.
 */

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { withBasePath } from '@/lib/basePath';
import productContent from '@/content/product.json';

// Scroll-based rotation constants (degrees)
const MAX_SCROLL_ROTATE = 6;

// Mouse-tracking tilt constants (degrees)
const MAX_MOUSE_TILT = 8;

export default function ProductImage3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef     = useRef({ dx: 0, dy: 0 }); // normalised -1…1 cursor offset

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile      = window.matchMedia('(max-width: 768px)').matches;
    const el            = containerRef.current;
    if (!el) return;

    let rafId: number | undefined;

    /* ── Compute and apply the 3D transform ────────────────────── */
    const applyTransform = () => {
      if (reducedMotion) return;

      const rect  = el.getBoundingClientRect();
      const viewH = window.innerHeight;

      // centred: 0 when image is exactly in the middle of the viewport,
      //          negative below, positive above (range roughly -1…+1)
      const centred = ((rect.top + rect.height / 2) - viewH / 2) / viewH;

      const { dx, dy } = mouseRef.current;
      const scrollRotX  =  centred * MAX_SCROLL_ROTATE;
      const scrollRotY  = -centred * (MAX_SCROLL_ROTATE * 0.5);
      const mouseRotX   = isMobile ? 0 : -dy * MAX_MOUSE_TILT;
      const mouseRotY   = isMobile ? 0 :  dx * MAX_MOUSE_TILT;

      el.style.transform =
        `perspective(1000px) rotateX(${(scrollRotX + mouseRotX).toFixed(2)}deg) rotateY(${(scrollRotY + mouseRotY).toFixed(2)}deg)`;
    };

    /* ── Scroll handler ─────────────────────────────────────────── */
    const onScroll = () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(applyTransform);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    applyTransform(); // set initial position

    /* ── Mouse-tracking tilt (desktop only) ─────────────────────── */
    let cleanupMouse: (() => void) | undefined;

    if (!reducedMotion && !isMobile) {
      const onMouseMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        mouseRef.current = {
          dx: (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2),
          dy: (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2),
        };
        applyTransform();
      };

      const onMouseLeave = () => {
        mouseRef.current = { dx: 0, dy: 0 };
        // Smooth ease-back on mouse exit
        el.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
        applyTransform();
        setTimeout(() => { el.style.transition = ''; }, 520);
      };

      el.addEventListener('mousemove', onMouseMove);
      el.addEventListener('mouseleave', onMouseLeave);

      cleanupMouse = () => {
        el.removeEventListener('mousemove', onMouseMove);
        el.removeEventListener('mouseleave', onMouseLeave);
      };
    }

    // Single cleanup path — always removes scroll listener + any mouse listeners
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      cleanupMouse?.();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-[320px] sm:w-[380px]"
      style={{ willChange: 'transform', transformStyle: 'preserve-3d' }}
    >
      {/* Ambient glow behind the product */}
      <div className="absolute inset-8 bg-gradient-to-br from-brand-primary/60 to-brand-warm/50 rounded-full blur-3xl" />
      {/* Bottom depth shadow */}
      <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/40 to-transparent rounded-3xl" />
      <Image
        src={withBasePath(productContent.images[0].src)}
        alt={productContent.images[0].alt}
        width={380}
        height={500}
        loading="lazy"
        className="relative z-10 w-full h-auto object-contain drop-shadow-2xl"
      />
    </div>
  );
}
