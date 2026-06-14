import type { Metadata } from 'next';
import CheckoutClient from '../checkout/CheckoutClient';

export const metadata: Metadata = {
  title: 'Thank You for Your Purchase',
  description: 'Your Neurotonics payment was successful and your order is confirmed.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function SuccessPage() {
  return <CheckoutClient />;
}
