'use client';

import { useState } from 'react';
import ScrollReveal from '@/components/ScrollReveal';

const LAST_UPDATED = 'April 2026';

interface Section {
  id: string;
  number: string;
  title: string;
  content: React.ReactNode;
}

const sections: Section[] = [
  {
    id: 'information-we-collect',
    number: '1',
    title: 'Information We Collect',
    content: (
      <>
        <p className="mb-3">We may collect the following types of personal information:</p>
        <ul className="list-disc list-inside space-y-1.5 text-gray-600">
          <li>Full name</li>
          <li>Email address</li>
          <li>Phone number</li>
          <li>Billing and shipping address</li>
          <li>Payment and transaction details</li>
          <li>Order history</li>
          <li>IP address and browser/device information</li>
          <li>Website usage and analytics data</li>
          <li>Any other information you provide when contacting us or submitting forms</li>
        </ul>
      </>
    ),
  },
  {
    id: 'how-we-collect',
    number: '2',
    title: 'How We Collect Information',
    content: (
      <>
        <p className="mb-3">We collect information when you:</p>
        <ul className="list-disc list-inside space-y-1.5 text-gray-600">
          <li>Purchase products from our website</li>
          <li>Create an account</li>
          <li>Subscribe to our newsletter or marketing communications</li>
          <li>Submit enquiries via forms</li>
          <li>Contact our customer support team</li>
          <li>Browse our website using cookies and analytics tools</li>
        </ul>
      </>
    ),
  },
  {
    id: 'how-we-use',
    number: '3',
    title: 'How We Use Your Information',
    content: (
      <>
        <p className="mb-3">We may use your personal information to:</p>
        <ul className="list-disc list-inside space-y-1.5 text-gray-600">
          <li>Process and fulfil your orders</li>
          <li>Deliver purchased products</li>
          <li>Provide customer support</li>
          <li>Respond to enquiries and requests</li>
          <li>Improve our website, services, and customer experience</li>
          <li>Send marketing communications and promotions (where consented)</li>
          <li>Prevent fraud and maintain website security</li>
          <li>Comply with legal obligations</li>
        </ul>
      </>
    ),
  },
  {
    id: 'payment-information',
    number: '4',
    title: 'Payment Information',
    content: (
      <>
        <p className="mb-4">
          All payments are processed securely through trusted third-party payment providers.
          Neurotonics does not store your full credit/debit card information on our servers.
        </p>
        <p className="mb-3">Payment providers may include:</p>
        <ul className="list-disc list-inside space-y-1.5 text-gray-600">
          <li>Stripe</li>
          <li>Apple Pay</li>
          <li>Google Pay</li>
          <li>Other secure payment gateways integrated into our website</li>
        </ul>
      </>
    ),
  },
  {
    id: 'cookies',
    number: '5',
    title: 'Cookies & Tracking Technologies',
    content: (
      <>
        <p className="mb-3">We use cookies and similar technologies to:</p>
        <ul className="list-disc list-inside space-y-1.5 text-gray-600 mb-4">
          <li>Improve website functionality</li>
          <li>Remember your preferences</li>
          <li>Analyse traffic and website performance</li>
          <li>Personalise your shopping experience</li>
          <li>Support marketing and advertising efforts</li>
        </ul>
        <p>
          You can disable cookies through your browser settings, however some parts of the website
          may not function properly.
        </p>
      </>
    ),
  },
  {
    id: 'sharing',
    number: '6',
    title: 'Sharing Your Information',
    content: (
      <>
        <p className="mb-3">
          We may share your information with trusted third parties where necessary, including:
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-gray-600 mb-4">
          <li>Payment processors</li>
          <li>Shipping and fulfilment providers</li>
          <li>Website hosting providers</li>
          <li>Marketing/advertising platforms</li>
          <li>Analytics providers</li>
        </ul>
        <p>We only share information necessary for these providers to perform their services.</p>
      </>
    ),
  },
  {
    id: 'marketing',
    number: '7',
    title: 'Marketing Communications',
    content: (
      <>
        <p className="mb-4">
          By subscribing to our mailing list, you consent to receiving promotional emails, offers,
          and updates from us.
        </p>
        <p>
          You may unsubscribe at any time by clicking the unsubscribe link in our emails.
        </p>
      </>
    ),
  },
  {
    id: 'data-security',
    number: '8',
    title: 'Data Storage & Security',
    content: (
      <>
        <p className="mb-4">
          We take reasonable steps to protect your personal information from misuse, loss,
          unauthorised access, modification, or disclosure.
        </p>
        <p>
          However, no internet transmission is ever completely secure, and we cannot guarantee
          absolute security.
        </p>
      </>
    ),
  },
  {
    id: 'accessing-information',
    number: '9',
    title: 'Accessing or Updating Your Information',
    content: (
      <p>
        You may request access to the personal information we hold about you or request corrections
        if it is inaccurate or outdated. To do so, contact us using the details below.
      </p>
    ),
  },
  {
    id: 'third-party-links',
    number: '10',
    title: 'Third-Party Links',
    content: (
      <p>
        Our website may contain links to third-party websites. We are not responsible for the
        privacy practices of external websites and encourage you to review their privacy policies
        before providing any personal information.
      </p>
    ),
  },
  {
    id: 'changes',
    number: '11',
    title: 'Changes to This Policy',
    content: (
      <p>
        We may update this Privacy Policy from time to time. Any changes will be posted on this
        page with an updated revision date. We encourage you to review this page periodically to
        stay informed of any updates.
      </p>
    ),
  },
  {
    id: 'contact',
    number: '12',
    title: 'Contact Us',
    content: (
      <>
        <p className="mb-4">
          If you have any questions, concerns, or privacy-related requests, please contact us:
        </p>
        <p>
          <span className="font-semibold text-brand-navy">Email:</span>{' '}
          <a
            href="mailto:support@neurotonics.com.au"
            className="text-brand-primary hover:text-brand-warm underline underline-offset-2 transition-colors"
          >
            support@neurotonics.com.au
          </a>
        </p>
      </>
    ),
  },
];

function AccordionItem({ section, index }: { section: Section; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <ScrollReveal animation="fade-up" delay={index * 40}>
      <div className="border border-brand-border rounded-xl overflow-hidden bg-white">
        <button
          id={`heading-${section.id}`}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={`section-${section.id}`}
          className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-brand-gray transition-colors duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-inset"
        >
          <div className="flex items-center gap-4">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-primary-light text-brand-primary text-sm font-bold flex items-center justify-center group-hover:bg-brand-primary group-hover:text-white transition-colors duration-200">
              {section.number}
            </span>
            <h2 className="text-base sm:text-lg font-semibold text-brand-navy">
              {section.title}
            </h2>
          </div>
          <svg
            className={`w-5 h-5 flex-shrink-0 text-brand-primary transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div
          id={`section-${section.id}`}
          role="region"
          aria-labelledby={`heading-${section.id}`}
          className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <div className="px-6 pb-6 pt-1 text-gray-600 leading-relaxed text-sm sm:text-base border-t border-brand-border">
            {section.content}
          </div>
        </div>
      </div>
    </ScrollReveal>
  );
}

export default function PrivacyPolicyClient() {
  return (
    <main id="main-content">
      {/* ── Hero banner ────────────────────────────────────────── */}
      <section className="relative bg-brand-navy overflow-hidden py-20 sm:py-28">
        {/* Decorative orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-brand-primary/20 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-brand-warm/15 blur-3xl pointer-events-none" aria-hidden="true" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-primary-light mb-4">
            Legal
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-6">
            Privacy Policy
          </h1>
          <p className="text-white/60 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            At Neurotonics, we are committed to protecting your privacy and handling your personal
            information responsibly.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15 text-white/70 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Last updated: {LAST_UPDATED}</span>
          </div>
        </div>
      </section>

      {/* ── Intro section ──────────────────────────────────────── */}
      <section className="bg-brand-gray border-b border-brand-border">
        <ScrollReveal animation="fade-up">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
            <div className="flex gap-4 p-6 rounded-xl bg-white border border-brand-border">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-primary-light flex items-center justify-center text-brand-primary mt-0.5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-brand-navy mb-1">Introduction</h2>
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                  This Privacy Policy outlines how Neurotonics collects, uses, discloses, and
                  protects your information when you visit our website, purchase our products, or
                  otherwise interact with us. By using our website, you consent to the terms of this
                  Privacy Policy.
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ── Accordion sections ─────────────────────────────────── */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-3">
            {sections.map((section, index) => (
              <AccordionItem key={section.id} section={section} index={index} />
            ))}
          </div>

          {/* Consent notice */}
          <ScrollReveal animation="fade-up" delay={100}>
            <div className="mt-12 p-6 rounded-xl bg-brand-primary text-white text-center">
              <p className="text-sm sm:text-base leading-relaxed text-white/90">
                By using our website, you consent to the terms of this Privacy Policy. If you have
                any questions, please{' '}
                <a
                  href="mailto:support@neurotonics.com.au"
                  className="underline underline-offset-2 hover:text-white transition-colors"
                >
                  contact us
                </a>
                .
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
