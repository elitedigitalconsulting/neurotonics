/**
 * API client — thin wrapper around fetch that handles:
 *   - Base URL from VITE_API_URL env (falls back to same-origin /cms)
 *   - Bearer token injection from memory
 *   - 401 handling (trigger logout)
 */

const BASE = import.meta.env.VITE_API_URL ?? '';

let _accessToken: string | null = null;
let _onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken() {
  return _accessToken;
}

export function setOnUnauthorized(fn: () => void) {
  _onUnauthorized = fn;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    _onUnauthorized?.();
    throw new Error('Unauthorised');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  get:    <T>(path: string)                     => request<T>('GET',    path),
  post:   <T>(path: string, body?: unknown)     => request<T>('POST',   path, body),
  put:    <T>(path: string, body?: unknown)      => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body?: unknown)     => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                     => request<T>('DELETE', path),
};

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
export async function login(email: string, password: string) {
  const data = await api.post<{ accessToken: string; user: User }>('/cms/auth/login', {
    email,
    password,
  });
  setAccessToken(data.accessToken);
  return data;
}

export async function refreshToken() {
  const data = await api.post<{ accessToken: string }>('/cms/auth/refresh');
  setAccessToken(data.accessToken);
  return data.accessToken;
}

export async function logout() {
  await api.post('/cms/auth/logout').catch(() => {});
  setAccessToken(null);
}

export async function forgotPassword(email: string) {
  return api.post<{ message: string }>('/cms/auth/forgot-password', { email });
}

export async function resetPassword(token: string, password: string) {
  return api.post<{ message: string }>('/cms/auth/reset-password', { token, password });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface User {
  id: number;
  email: string;
  role: 'admin' | 'editor';
  name: string;
  created_at?: string;
}

export interface Order {
  id: number;
  stripe_session_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: {
    fullName?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  items: Array<{ name: string; quantity: number; price: number }>;
  shipping: { zone?: string; name?: string; fee?: number };
  subtotal: number;
  total: number;
  status: 'pending' | 'processing' | 'fulfilled' | 'refunded' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface Product {
  name: string;
  slug: string;
  price: number;
  currency: string;
  shortDescription: string;
  longDescription: string;
  images: Array<{ src: string; alt: string }>;
  badges: string[];
  servingSize: string;
  capsuleCount: number;
  supply: string;
  ingredients: Array<{ name: string; amount: string; benefit: string }>;
  stockPercent: number;
  unitsLeft: number;
  inStock?: boolean;
  faq: Array<{ question: string; answer: string }>;
}

export interface Settings {
  notification_email: string;
  admin_notification_email: string;
  buy_globally_enabled: string;
  promo_banner_visible: string;
  promo_banner_text: string;
}

export interface OrderStats {
  byStatus: Array<{ status: string; count: number; revenue: number }>;
  today: { count: number; revenue: number };
  week:  { count: number; revenue: number };
  month: { count: number; revenue: number };
}
