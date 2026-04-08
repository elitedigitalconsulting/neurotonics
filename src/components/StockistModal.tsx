'use client';

import { useEffect, useRef, useCallback } from 'react';
import StockistForm from '@/components/StockistForm';
import siteContent from '@/content/site.json';

interface StockistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function StockistModal({ isOpen, onClose }: StockistModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap: cycle Tab/Shift+Tab within the modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Move focus into the modal on open
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTORS);
    firstFocusable?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const { stockist } = siteContent;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={stockist.headline}
    >
      {/* Dimmed overlay – click to close */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-brand-navy shadow-2xl animate-scale-up"
      >
        {/* Decorative gradient orbs */}
        <div className="pointer-events-none absolute top-0 right-0 w-64 h-64 rounded-full bg-brand-primary/20 blur-3xl -translate-y-1/2 translate-x-1/4" aria-hidden="true" />
        <div className="pointer-events-none absolute bottom-0 left-0 w-48 h-48 rounded-full bg-brand-warm/15 blur-3xl translate-y-1/3 -translate-x-1/4" aria-hidden="true" />

        {/* Content */}
        <div className="relative p-6 sm:p-10">
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close stockist form"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/40 hover:text-white transition-colors rounded-lg p-1 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-primary-light mb-3">
              {stockist.eyebrow}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">
              {stockist.headline}
            </h2>
            <p className="text-white/50 leading-relaxed text-sm max-w-lg mx-auto">
              {stockist.subheadline}
            </p>
          </div>

          <StockistForm />
        </div>
      </div>
    </div>
  );
}
