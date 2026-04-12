'use client';

import ScrollReveal from '@/components/ScrollReveal';
import AnimatedCounter from '@/components/AnimatedCounter';

const stats = [
  { target: 7,   suffix: '',  label: 'Active Ingredients'  },
  { target: 60,  suffix: '',  label: 'Capsules Per Bottle' },
  { target: 100, suffix: '%', label: 'Natural Formula'     },
  { target: 30,  suffix: '-Day', label: 'Supply'           },
] as const;

export default function StatsSection() {
  return (
    <section className="relative bg-brand-navy gradient-border-top gradient-border-bottom overflow-hidden">
      {/* Subtle background accent */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/4  w-64 h-64 rounded-full bg-brand-primary/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-48 h-48 rounded-full bg-brand-warm/10   blur-3xl" />
      </div>

      <ScrollReveal animation="fade-up" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 divide-y-2 lg:divide-y-0 lg:divide-x divide-white/10">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="flex flex-col items-center justify-center py-8 px-4 sm:px-8 text-center"
            >
              <div
                className="text-4xl sm:text-5xl font-bold text-white mb-2 leading-none"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <AnimatedCounter
                  target={stat.target}
                  duration={2200}
                  suffix={stat.suffix}
                  decimals={0}
                />
              </div>
              <p className="text-white/50 text-xs sm:text-sm font-medium tracking-wide uppercase mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}
