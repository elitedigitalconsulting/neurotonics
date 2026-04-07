'use client';

/**
 * ParallaxSection – wraps a section and applies a gentle parallax effect to an
 * absolutely-positioned background layer.  The background div is oversized by
 * 40 % top/bottom so the offset never reveals bare edges.
 *
 * Props:
 *   children    – section body content (rendered above the parallax bg)
 *   bgContent   – JSX rendered inside the parallax background layer
 *   speed       – fraction of scroll offset applied to the bg (default 0.15)
 *   className   – classes added to the <section> wrapper
 *   bgClassName – classes added to the parallax background div
 */

import { useEffect, useRef, ReactNode } from 'react';

interface ParallaxSectionProps {
  children: ReactNode;
  bgContent?: ReactNode;
  speed?: number;
  className?: string;
  bgClassName?: string;
}

export default function ParallaxSection({
  children,
  bgContent,
  speed = 0.15,
  className = '',
  bgClassName = '',
}: ParallaxSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const bgRef      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let rafId: number | undefined;

    const update = () => {
      const section = sectionRef.current;
      const bg      = bgRef.current;
      if (!section || !bg) return;

      const rect       = section.getBoundingClientRect();
      const viewH      = window.innerHeight;

      // How far the section centre is from the viewport centre (−1 … +1)
      const progress   = (rect.top + rect.height / 2 - viewH / 2) / viewH;
      bg.style.transform = `translateY(${progress * speed * viewH}px)`;
    };

    const onScroll = () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    update(); // set initial position

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId !== undefined) cancelAnimationFrame(rafId);
    };
  }, [speed]);

  return (
    <section ref={sectionRef} className={`relative overflow-hidden ${className}`}>
      {/* Parallax background */}
      <div
        ref={bgRef}
        className={`absolute inset-0 parallax-layer ${bgClassName}`}
        style={{ top: '-20%', height: '140%', willChange: 'transform' }}
        aria-hidden="true"
      >
        {bgContent}
      </div>

      {/* Foreground content sits above the parallax bg */}
      <div className="relative z-10">
        {children}
      </div>
    </section>
  );
}
