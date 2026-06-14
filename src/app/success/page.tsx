import type { Metadata } from 'next';
import CheckoutClient from '../checkout/CheckoutClient';

export const metadata: Metadata = {
  title: 'Order Confirmed',
  description: 'Your Neurotonics order has been confirmed.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function SuccessPage() {
  return <CheckoutClient />;
}
