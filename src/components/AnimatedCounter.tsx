'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  target: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function AnimatedCounter({
  target,
  duration = 2000,
  suffix = '',
  prefix = '',
  decimals = 0,
}: AnimatedCounterProps) {
  const [value, setValue] = useState(0);
  const hasAnimated = useRef(false);
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Reduced-motion: schedule to avoid sync setState in effect, then bail
    if (reducedMotion) {
      const id = setTimeout(() => setValue(target), 0);
      return () => clearTimeout(id);
    }

    let rafId: number | undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          observer.disconnect();

          const start = performance.now();

          const tick = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutCubic(progress);
            setValue(parseFloat((eased * target).toFixed(decimals)));
            if (progress < 1) {
              rafId = requestAnimationFrame(tick);
            }
          };

          rafId = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (rafId !== undefined) cancelAnimationFrame(rafId);
    };
  }, [target, duration, decimals]);

  const formatted = value.toFixed(decimals);

  return (
    <span ref={spanRef} className="counter-num">
      {prefix}{formatted}{suffix}
    </span>
  );
}
