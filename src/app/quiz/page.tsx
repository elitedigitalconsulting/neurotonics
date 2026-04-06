import type { Metadata } from 'next';
import QuizClient from './QuizClient';

export const metadata: Metadata = {
  title: 'Find Your Perfect Solution',
  description: 'Take our quick quiz to discover the best Neurotonics cognitive supplement for your unique needs.',
};

export default function QuizPage() {
  return <QuizClient />;
}
