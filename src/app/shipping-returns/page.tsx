import type { Metadata } from 'next';
import siteContent from '@/content/site.json';
import ShippingReturnsClient from './ShippingReturnsClient';

const BASE_URL = 'https://elitedigitalconsulting.github.io/neurotonics';
const PAGE_URL = `${BASE_URL}/shipping-returns`;

export const metadata: Metadata = {
  title: 'Shipping & Returns',
  description:
    'Learn about Neurotonics shipping options, delivery times, and our hassle-free returns and refund policy. Free Australian shipping on orders over $100.',
  alternates: {
    canonical: PAGE_URL,
  },
  openGraph: {
    title: `Shipping & Returns | ${siteContent.brand.name}`,
    description:
      'Fast, reliable Australian and international shipping. Free shipping over $100. 30-day hassle-free returns.',
    type: 'website',
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary',
    title: `Shipping & Returns | ${siteContent.brand.name}`,
    description:
      'Fast, reliable Australian and international shipping. Free shipping over $100. 30-day hassle-free returns.',
  },
};

function BreadcrumbJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Shipping & Returns', item: PAGE_URL },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function ShippingReturnsPage() {
  return (
    <>
      <BreadcrumbJsonLd />
      <ShippingReturnsClient />
    </>
  );
}
