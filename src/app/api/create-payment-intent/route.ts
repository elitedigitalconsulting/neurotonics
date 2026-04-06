import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod/v4';

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key);
}

const paymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  shipping: z.object({
    zone: z.string().max(100).optional(),
    fee: z.number().min(0).optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = paymentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'Invalid request data' },
        { status: 400 }
      );
    }

    const { amount, shipping } = result.data;

    const stripe = getStripeClient();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'aud',
      automatic_payment_methods: {
        enabled: true, // Enables Apple Pay, Google Pay, cards, etc.
      },
      metadata: {
        shippingZone: shipping?.zone || 'Unknown',
        shippingFee: String(shipping?.fee || 0),
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Payment intent creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
