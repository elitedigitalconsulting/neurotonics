import type { Metadata } from 'next';
import productContent from '@/content/product.json';
import siteContent from '@/content/site.json';
import ProductClient from './ProductClient';

export const metadata: Metadata = {
  title: productContent.name,
  description: productContent.shortDescription,
  openGraph: {
    title: `${productContent.name} | ${siteContent.brand.name}`,
    description: productContent.shortDescription,
    type: 'website',
  },
};

// JSON-LD structured data for SEO
function ProductJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productContent.name,
    description: productContent.shortDescription,
    brand: {
      '@type': 'Brand',
      name: siteContent.brand.name,
    },
    offers: {
      '@type': 'Offer',
      price: productContent.price,
      priceCurrency: productContent.currency,
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: siteContent.brand.name,
      },
    },
    countryOfOrigin: {
      '@type': 'Country',
      name: 'Australia',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function ProductPage() {
  return (
    <>
      <ProductJsonLd />
      <ProductClient />
    </>
  );
}
