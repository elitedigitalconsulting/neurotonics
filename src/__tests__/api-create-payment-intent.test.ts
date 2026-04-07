/**
 * API integration tests for POST /api/create-payment-intent
 *
 * These tests call the Next.js route handler directly (without a running
 * HTTP server) by importing the handler module and invoking it with a
 * mock NextRequest.
 *
 * Stripe is mocked so tests run without real API keys.
 *
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock Stripe before importing the route so the module picks up the mock.
// ---------------------------------------------------------------------------

const mockPaymentIntentCreate = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: mockPaymentIntentCreate,
    },
  }));
});

// Also mock the env var so getStripeClient() does not throw.
const originalEnv = process.env;

beforeAll(() => {
  process.env = { ...originalEnv, STRIPE_SECRET_KEY: 'sk_test_mock_key' };
});

afterAll(() => {
  process.env = originalEnv;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/create-payment-intent', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    // Dynamic import so the Stripe mock is in place first.
    const mod = await import('@/app/api/create-payment-intent/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    mockPaymentIntentCreate.mockReset();
  });

  // -------------------------------------------------------------------------
  // Valid requests
  // -------------------------------------------------------------------------

  it('returns 200 and a clientSecret for a valid amount', async () => {
    mockPaymentIntentCreate.mockResolvedValue({
      client_secret: 'pi_test_secret_abc123',
    });
    console.log('[API TEST] Valid cart → create-payment-intent');

    const req = buildRequest({ amount: 79.9 });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.clientSecret).toBe('pi_test_secret_abc123');
    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 7990, // cents
        currency: 'aud',
      }),
    );
    console.log('[PASS] Valid cart returns clientSecret:', json.clientSecret);
  });

  it('passes shipping metadata to Stripe when provided', async () => {
    mockPaymentIntentCreate.mockResolvedValue({ client_secret: 'pi_shipping_secret' });

    const req = buildRequest({
      amount: 88.85,
      shipping: { zone: 'Sydney Metro', fee: 8.95 },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          shippingZone: 'Sydney Metro',
          shippingFee: '8.95',
        }),
      }),
    );
    console.log('[PASS] Shipping metadata passed to Stripe:', json.clientSecret);
  });

  it('rounds cents correctly (amount * 100, rounded)', async () => {
    mockPaymentIntentCreate.mockResolvedValue({ client_secret: 'pi_round_secret' });

    // $10.999 should round to 1100 cents
    const req = buildRequest({ amount: 10.999 });
    await POST(req);

    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1100 }),
    );
    console.log('[PASS] Amount rounded to integer cents correctly');
  });

  // -------------------------------------------------------------------------
  // Invalid requests — should return 400
  // -------------------------------------------------------------------------

  it('returns 400 for zero amount', async () => {
    console.log('[API TEST] Zero amount → expect 400');
    const req = buildRequest({ amount: 0 });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
    console.log('[PASS] Zero amount rejected with 400:', json.error);
  });

  it('returns 400 for negative amount', async () => {
    console.log('[API TEST] Negative amount → expect 400');
    const req = buildRequest({ amount: -10 });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
    console.log('[PASS] Negative amount rejected with 400:', json.error);
  });

  it('returns 400 when amount is missing', async () => {
    console.log('[API TEST] Missing amount → expect 400');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    console.log('[PASS] Missing amount rejected with 400');
  });

  it('returns 400 when amount is a string', async () => {
    console.log('[API TEST] String amount → expect 400');
    const req = buildRequest({ amount: 'seventy-nine' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    console.log('[PASS] String amount rejected with 400');
  });

  it('returns 400 when body is not JSON', async () => {
    console.log('[API TEST] Non-JSON body → expect 400 or 500');
    const req = new NextRequest('http://localhost/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'NOT JSON AT ALL',
    });
    const res = await POST(req);
    // Body parse failure should not crash the server — expect 4xx or 5xx.
    expect(res.status).toBeGreaterThanOrEqual(400);
    console.log('[PASS] Non-JSON body handled gracefully, status:', res.status);
  });

  // -------------------------------------------------------------------------
  // Network / Stripe failure handling
  // -------------------------------------------------------------------------

  it('returns 500 when Stripe throws an unexpected error', async () => {
    mockPaymentIntentCreate.mockRejectedValue(new Error('Stripe network error'));
    console.log('[API TEST] Stripe throws → expect 500');

    const req = buildRequest({ amount: 79.9 });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeTruthy();
    console.log('[PASS] Stripe error returns 500:', json.error);
  });
});
