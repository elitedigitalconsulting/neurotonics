'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useCart } from '@/lib/cart';
import siteContent from '@/content/site.json';
import AnnouncementBar from '@/components/AnnouncementBar';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { totalItems } = useCart();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* Skip navigation for keyboard/screen-reader users */}
      <a href="#main-content" className="skip-nav">
        Skip to main content
      </a>

      <header className="fixed top-0 left-0 right-0 z-50">
        {/* Announcement Bar */}
        <AnnouncementBar />

        {/* Main Header */}
        <div
          className={[
            'bg-white transition-all duration-300',
            scrolled
              ? 'backdrop-blur-xl border-b border-gray-200 shadow-sm'
              : 'border-b border-gray-200',
          ].join(' ')}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 sm:h-18">
              {/* Logo */}
              <Link href="/" className="flex items-center space-x-2" aria-label="Neurotonics — go to homepage">
                <span className="font-bold tracking-tight transition-all duration-300 text-gray-900 text-xl sm:text-2xl">
                  {siteContent.brand.name}
                </span>
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center space-x-8" aria-label="Main navigation">
                {siteContent.navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="transition-colors text-sm font-medium uppercase tracking-wider text-gray-700 hover:text-brand-primary"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              {/* Icons */}
              <div className="flex items-center space-x-4">
                <Link
                  href="/cart"
                  className="relative transition-colors text-gray-600 hover:text-brand-primary"
                  aria-label={totalItems > 0 ? `Shopping cart — ${totalItems} item${totalItems !== 1 ? 's' : ''}` : 'Shopping cart'}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  {totalItems > 0 && (
                    <span className="absolute -top-2 -right-2 bg-brand-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold" aria-hidden="true">
                      {totalItems}
                    </span>
                  )}
                </Link>

                {/* Mobile menu button */}
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="md:hidden transition-colors text-gray-600 hover:text-brand-primary"
                  aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                  aria-expanded={isMenuOpen}
                  aria-controls="mobile-nav"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    {isMenuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* Mobile Navigation */}
            {isMenuOpen && (
              <nav id="mobile-nav" className="md:hidden py-4 border-t border-gray-200 bg-white" aria-label="Mobile navigation">
                {siteContent.navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="block py-3 transition-colors text-sm font-medium uppercase tracking-wider text-gray-700 hover:text-brand-primary"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
