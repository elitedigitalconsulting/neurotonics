import type { Metadata } from 'next';
import QuizClient from './QuizClient';

const BASE_URL = 'https://elitedigitalconsulting.github.io/neurotonics';

export const metadata: Metadata = {
  title: 'Wellness Quiz — Find Your Perfect Cognitive Supplement',
  description: 'Take our free 2-minute wellness quiz to discover the best Neurotonics cognitive supplement for your unique goals. Personalised recommendations, no sign-up required.',
  alternates: {
    canonical: `${BASE_URL}/quiz`,
  },
  openGraph: {
    title: 'Wellness Quiz | Neurotonics',
    description: 'Take our free 2-minute wellness quiz to discover the best Neurotonics cognitive supplement for your unique goals.',
    type: 'website',
    url: `${BASE_URL}/quiz`,
    images: [
      {
        url: `${BASE_URL}/images/product-main.png`,
        width: 1200,
        height: 630,
        alt: 'Neurotonics Wellness Quiz',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wellness Quiz | Neurotonics',
    description: 'Discover the best Neurotonics supplement for your goals in just 2 minutes.',
    images: [`${BASE_URL}/images/product-main.png`],
  },
};

export default function QuizPage() {
  return <QuizClient />;
}
