import type { Metadata } from 'next';
import productContent from '@/content/product.json';
import siteContent from '@/content/site.json';
import ProductClient from './ProductClient';

const BASE_URL = 'https://elitedigitalconsulting.github.io/neurotonics';
const PAGE_URL = `${BASE_URL}/product`;
const OG_IMAGE = `${BASE_URL}/images/product-main.png`;

export const metadata: Metadata = {
  title: productContent.name,
  description: productContent.shortDescription,
  alternates: {
    canonical: PAGE_URL,
  },
  openGraph: {
    title: `${productContent.name} | ${siteContent.brand.name}`,
    description: productContent.shortDescription,
    type: 'website',
    url: PAGE_URL,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${productContent.name} — ${siteContent.brand.name} cognitive supplement bottle`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${productContent.name} | ${siteContent.brand.name}`,
    description: productContent.shortDescription,
    images: [OG_IMAGE],
  },
};

// JSON-LD structured data for SEO
function ProductJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productContent.name,
    description: productContent.longDescription,
    image: OG_IMAGE,
    sku: productContent.slug,
    brand: {
      '@type': 'Brand',
      name: siteContent.brand.name,
    },
    offers: {
      '@type': 'Offer',
      price: productContent.price,
      priceCurrency: productContent.currency,
      availability: 'https://schema.org/InStock',
      url: PAGE_URL,
      seller: {
        '@type': 'Organization',
        name: siteContent.brand.name,
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'AU',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          businessDays: {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: [
              'https://schema.org/Monday',
              'https://schema.org/Tuesday',
              'https://schema.org/Wednesday',
              'https://schema.org/Thursday',
              'https://schema.org/Friday',
            ],
          },
        },
      },
    },
    countryOfOrigin: {
      '@type': 'Country',
      name: 'Australia',
    },
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: productContent.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: BASE_URL + '/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: productContent.name,
        item: PAGE_URL,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </>
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
