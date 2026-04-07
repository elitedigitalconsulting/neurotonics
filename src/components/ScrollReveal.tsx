'use client';

/**
 * ScrollReveal – wraps children and fades/slides them in as they enter the viewport.
 *
 * Props:
 *   animation  – 'fade-up' | 'fade-in' | 'fade-left' | 'fade-right' | 'scale-up'
 *   delay      – ms to wait after intersection before revealing (useful for stagger)
 *   threshold  – IntersectionObserver threshold (0–1, default 0.12)
 *   className  – extra classes forwarded to the wrapper div
 */

import { useEffect, useRef, ReactNode } from 'react';

type Animation = 'fade-up' | 'fade-in' | 'fade-left' | 'fade-right' | 'scale-up';

interface ScrollRevealProps {
  children: ReactNode;
  animation?: Animation;
  delay?: number;
  threshold?: number;
  className?: string;
}

export default function ScrollReveal({
  children,
  animation = 'fade-up',
  delay = 0,
  threshold = 0.12,
  className = '',
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect user's motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('sr-visible');
      return;
    }

  let timer: ReturnType<typeof setTimeout> | undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setTimeout(() => el.classList.add('sr-visible'), delay);
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin: '0px 0px -32px 0px' },
    );

    observer.observe(el);

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      observer.disconnect();
    };
  }, [delay, threshold]);

  return (
    <div ref={ref} className={`sr-hidden sr-${animation} ${className}`}>
      {children}
    </div>
  );
}
