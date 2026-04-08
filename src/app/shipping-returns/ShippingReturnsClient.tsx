'use client';

import { useState } from 'react';
import ScrollReveal from '@/components/ScrollReveal';
import shippingData from '@/content/shipping.json';

interface AccordionItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-brand-primary transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l1 1h1m8-1V7.586a1 1 0 011-1h.414l3 3L21 12v4h-1m-6 0H9" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AuIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function RefundIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 10V5a2 2 0 012-2z" />
    </svg>
  );
}

function AccordionSection({
  item,
  isOpen,
  onToggle,
}: {
  item: AccordionItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-brand-border rounded-2xl overflow-hidden bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 rounded-2xl"
        aria-expanded={isOpen}
        aria-controls={`accordion-${item.id}`}
        id={`accordion-btn-${item.id}`}
      >
        <div className="flex items-center gap-4">
          <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-primary-light text-brand-primary flex items-center justify-center">
            {item.icon}
          </span>
          <span className="text-base sm:text-lg font-semibold text-brand-navy">{item.title}</span>
        </div>
        <ChevronIcon open={isOpen} />
      </button>

      <div
        id={`accordion-${item.id}`}
        role="region"
        aria-labelledby={`accordion-btn-${item.id}`}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="px-6 pb-6 pt-1 text-gray-600 leading-relaxed">
          {item.content}
        </div>
      </div>
    </div>
  );
}

export default function ShippingReturnsClient() {
  const [openId, setOpenId] = useState<string | null>('shipping-rates');

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  const auZones = shippingData.zones;
  const freeThreshold = shippingData.freeShippingThreshold;

  const sections: AccordionItem[] = [
    {
      id: 'shipping-rates',
      icon: <TagIcon />,
      title: 'Shipping Rates',
      content: (
        <div className="space-y-4">
          <p>
            We offer a range of shipping options to suit your needs. Orders over{' '}
            <strong className="text-brand-primary">${freeThreshold} AUD</strong> qualify for free
            standard shipping within Australia.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="rounded-xl bg-brand-primary-light border border-brand-border p-4">
              <p className="text-xs font-semibold text-brand-primary uppercase tracking-wider mb-1">Free Shipping</p>
              <p className="text-2xl font-bold text-brand-primary">$0.00</p>
              <p className="text-sm text-gray-600 mt-1">On orders over ${freeThreshold} AUD</p>
            </div>
            <div className="rounded-xl bg-white border border-brand-border p-4">
              <p className="text-xs font-semibold text-brand-primary uppercase tracking-wider mb-1">Standard AU</p>
              <p className="text-2xl font-bold text-brand-navy">From $8.95</p>
              <p className="text-sm text-gray-600 mt-1">2–8 business days by zone</p>
            </div>
            <div className="rounded-xl bg-white border border-brand-border p-4">
              <p className="text-xs font-semibold text-brand-primary uppercase tracking-wider mb-1">Express AU</p>
              <p className="text-2xl font-bold text-brand-navy">${shippingData.expressShipping.fee.toFixed(2)}</p>
              <p className="text-sm text-gray-600 mt-1">{shippingData.expressShipping.estimatedDays}</p>
            </div>
          </div>
          <div className="rounded-xl bg-white border border-brand-border p-4 mt-2">
            <p className="text-xs font-semibold text-brand-primary uppercase tracking-wider mb-1">International</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-brand-navy">${shippingData.international.fee.toFixed(2)}</p>
                <p className="text-sm text-gray-600 mt-1">{shippingData.international.estimatedDays}</p>
              </div>
              <p className="text-sm text-gray-500">{shippingData.international.description}</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'dispatch-delivery',
      icon: <ClockIcon />,
      title: 'Dispatch & Delivery',
      content: (
        <div className="space-y-4">
          <p>
            We work hard to get your order out the door as quickly as possible. All orders are
            processed and dispatched from our{' '}
            <strong className="text-brand-primary">Sydney warehouse</strong> within{' '}
            <strong>1–2 business days</strong> of payment confirmation.
          </p>
          <ul className="space-y-3 mt-2">
            {[
              'Orders placed before 12:00 PM AEST on business days are typically dispatched the same day.',
              'Orders placed after 12:00 PM AEST, or on weekends and public holidays, are processed the next business day.',
              'You will receive a shipping confirmation email with a tracking number once your order has been dispatched.',
              'Delivery times are estimates and may vary during peak periods or due to carrier delays.',
            ].map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-brand-green-light flex items-center justify-center">
                  <svg className="w-3 h-3 text-brand-green" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 p-4 rounded-xl bg-brand-gray border border-brand-border">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-brand-navy">Please note:</span> {shippingData.note}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'australian-shipping',
      icon: <AuIcon />,
      title: 'Australian Shipping',
      content: (
        <div className="space-y-4">
          <p>
            We ship to all states and territories across Australia via{' '}
            <strong>Australia Post</strong>. Rates are calculated based on your delivery location:
          </p>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-brand-primary-light">
                  <th className="text-left px-4 py-3 font-semibold text-brand-primary rounded-tl-lg">Region</th>
                  <th className="text-left px-4 py-3 font-semibold text-brand-primary">Estimated Delivery</th>
                  <th className="text-left px-4 py-3 font-semibold text-brand-primary rounded-tr-lg">Rate</th>
                </tr>
              </thead>
              <tbody>
                {auZones.map((zone, i) => (
                  <tr
                    key={zone.name}
                    className={`border-b border-brand-border ${i % 2 === 0 ? 'bg-white' : 'bg-brand-gray'}`}
                  >
                    <td className="px-4 py-3 font-medium text-brand-navy">{zone.name}</td>
                    <td className="px-4 py-3 text-gray-600">{zone.estimatedDays}</td>
                    <td className="px-4 py-3 font-semibold text-brand-primary">${zone.fee.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            * Free standard shipping applies automatically at checkout for orders over ${freeThreshold} AUD.
          </p>
        </div>
      ),
    },
    {
      id: 'international-shipping',
      icon: <GlobeIcon />,
      title: 'International Shipping',
      content: (
        <div className="space-y-4">
          <p>
            Neurotonics ships internationally to selected countries via{' '}
            <strong>{shippingData.international.description}</strong>. A flat rate of{' '}
            <strong className="text-brand-primary">${shippingData.international.fee.toFixed(2)} AUD</strong> applies
            to all international orders.
          </p>
          <ul className="space-y-3">
            {[
              `Estimated delivery: ${shippingData.international.estimatedDays}.`,
              'International orders are shipped from our Sydney warehouse and are subject to customs and import duties in the destination country.',
              'Any applicable customs fees, taxes, or import duties are the responsibility of the recipient.',
              'Neurotonics is not responsible for delays caused by customs processing.',
              'Tracking is available for all international orders via the Australia Post tracking portal.',
            ].map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-brand-green-light flex items-center justify-center">
                  <svg className="w-3 h-3 text-brand-green" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Important:</span> Neurotonics products are ARTG listed
              therapeutic goods. Please check import regulations for therapeutic goods in your
              country before placing an international order.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'returns-refunds',
      icon: <RefundIcon />,
      title: 'Returns & Refunds',
      content: (
        <div className="space-y-4">
          <p>
            We stand behind every product we make. If you are not completely satisfied with your
            purchase, we offer a straightforward returns and refunds process.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="rounded-xl bg-brand-primary-light border border-brand-border p-4">
              <h3 className="font-semibold text-brand-primary mb-2">Change of Mind Returns</h3>
              <p className="text-sm text-gray-600">
                Return unopened items within <strong>30 days</strong> of delivery for a full
                refund, minus the original shipping cost. Items must be in original, sealed
                packaging.
              </p>
            </div>
            <div className="rounded-xl bg-brand-green-light border border-green-200 p-4">
              <h3 className="font-semibold text-brand-green mb-2">Damaged or Faulty Items</h3>
              <p className="text-sm text-gray-600">
                If your order arrives damaged or is faulty, contact us within{' '}
                <strong>7 days</strong> of delivery. We will arrange a replacement or full refund
                at no cost to you.
              </p>
            </div>
          </div>

          <h3 className="font-semibold text-brand-navy mt-4">How to Request a Return</h3>
          <ol className="space-y-3 list-none">
            {[
              'Email us at hello@neurotonics.com.au with your order number and reason for return.',
              'Our customer care team will respond within 1–2 business days with return instructions.',
              'Pack the item securely and send it to the address provided.',
              'Once we receive and inspect the item, your refund will be processed within 5–7 business days to your original payment method.',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-primary text-white text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-gray-600">{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-4 p-4 rounded-xl bg-brand-gray border border-brand-border">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-brand-navy">Please note:</span> Return shipping
              costs for change-of-mind returns are at the customer&apos;s expense. We recommend
              using a tracked service, as we cannot be held responsible for items lost in transit.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'restrictions',
      icon: <ShieldIcon />,
      title: 'Restrictions',
      content: (
        <div className="space-y-4">
          <p>
            Please be aware of the following restrictions that may affect your order:
          </p>
          <ul className="space-y-4">
            {[
              {
                heading: 'Therapeutic Goods',
                body: 'Neurotonics Brain Boost 1000 is an ARTG listed therapeutic product. Importing therapeutic goods may be restricted or regulated in some countries. It is your responsibility to confirm that importation is permitted in your destination country before placing an order.',
              },
              {
                heading: 'P.O. Boxes & Parcel Lockers',
                body: 'We can ship to P.O. Boxes and parcel lockers for standard orders within Australia. Please ensure your address is correctly formatted at checkout.',
              },
              {
                heading: 'Remote & Rural Areas',
                body: 'Deliveries to remote or rural areas of Australia may take additional time beyond the estimated delivery windows. Surcharges may apply for certain remote postcodes.',
              },
              {
                heading: 'Dangerous Goods',
                body: 'Our products do not contain dangerous goods. All ingredients comply with Australian and international transport regulations.',
              },
            ].map(({ heading, body }) => (
              <li key={heading} className="flex items-start gap-3">
                <span className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-brand-primary-light flex items-center justify-center">
                  <svg className="w-3 h-3 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </span>
                <div>
                  <p className="font-semibold text-brand-navy">{heading}</p>
                  <p className="text-gray-600 mt-0.5">{body}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-sm text-gray-500 mt-4">
            For any questions about shipping restrictions specific to your location, please contact
            us at{' '}
            <a href="mailto:hello@neurotonics.com.au" className="text-brand-primary hover:underline font-medium">
              hello@neurotonics.com.au
            </a>{' '}
            before placing your order.
          </p>
        </div>
      ),
    },
  ];

  return (
    <main id="main-content">
      {/* Hero Banner */}
      <section className="relative bg-brand-primary overflow-hidden">
        {/* Decorative orbs */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-brand-warm opacity-20 translate-x-1/3 -translate-y-1/3 pointer-events-none" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-brand-warm opacity-10 -translate-x-1/4 translate-y-1/4 pointer-events-none" aria-hidden="true" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 mb-6">
              <TruckIcon />
              <span className="text-white/90 text-sm font-medium">Shipping &amp; Returns</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
              Fast, Reliable Shipping &amp; Hassle-Free Returns
            </h1>
            <p className="text-white/75 text-base sm:text-lg leading-relaxed">
              We want your Neurotonics experience to be seamless from order to delivery. Learn
              everything you need to know about our shipping options, delivery times, and our simple
              returns process.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Stats Bar */}
      <section className="bg-white border-b border-brand-border" aria-label="Shipping highlights">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { value: `Free over $${shippingData.freeShippingThreshold}`, label: 'Australian Shipping' },
              { value: '1–2 Days', label: 'Dispatch Time' },
              { value: '30 Days', label: 'Return Window' },
              { value: '100%', label: 'Satisfaction Guarantee' },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-xl sm:text-2xl font-bold text-brand-primary">{value}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Accordion Sections */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16" aria-label="Shipping and returns information">
        <ScrollReveal animation="fade-up">
          <h2 className="text-2xl sm:text-3xl font-bold text-brand-navy mb-2">
            Everything You Need to Know
          </h2>
          <p className="text-gray-500 mb-8">
            Select a topic below for detailed information.
          </p>
        </ScrollReveal>

        <div className="space-y-3" role="list">
          {sections.map((item, i) => (
            <ScrollReveal key={item.id} animation="fade-up" delay={i * 60}>
              <div role="listitem">
                <AccordionSection
                  item={item}
                  isOpen={openId === item.id}
                  onToggle={() => toggle(item.id)}
                />
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="bg-brand-gray border-t border-brand-border">
        <ScrollReveal animation="fade-up">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-primary-light mb-4">
              <svg className="w-7 h-7 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-brand-navy mb-2">
              Still Have Questions?
            </h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Our customer care team is here to help. Reach out and we&apos;ll get back to you
              within 1–2 business days.
            </p>
            <a
              href="mailto:hello@neurotonics.com.au"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-primary text-white font-semibold hover:bg-brand-primary-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact Us
            </a>
          </div>
        </ScrollReveal>
      </section>
    </main>
  );
}
