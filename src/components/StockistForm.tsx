'use client';

import { useState, FormEvent } from 'react';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

interface FormFields {
  fullName: string;
  businessName: string;
  abn: string;
  email: string;
  phone: string;
  businessStreet: string;
  businessSuburb: string;
  businessState: string;
  businessPostcode: string;
  message: string;
}

interface FieldErrors {
  fullName?: string;
  businessName?: string;
  abn?: string;
  email?: string;
  phone?: string;
  businessStreet?: string;
  businessSuburb?: string;
  businessState?: string;
  businessPostcode?: string;
}

const AU_STATES = [
  { code: 'ACT', name: 'Australian Capital Territory' },
  { code: 'NSW', name: 'New South Wales' },
  { code: 'NT', name: 'Northern Territory' },
  { code: 'QLD', name: 'Queensland' },
  { code: 'SA', name: 'South Australia' },
  { code: 'TAS', name: 'Tasmania' },
  { code: 'VIC', name: 'Victoria' },
  { code: 'WA', name: 'Western Australia' },
];

const EMPTY: FormFields = {
  fullName: '',
  businessName: '',
  abn: '',
  email: '',
  phone: '',
  businessStreet: '',
  businessSuburb: '',
  businessState: '',
  businessPostcode: '',
  message: '',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function validateAbn(abn: string): boolean {
  return /^\d{11}$/.test(abn.replace(/\s/g, ''));
}

function validateFields(fields: FormFields): FieldErrors {
  const errors: FieldErrors = {};

  if (!fields.fullName.trim())
    errors.fullName = 'Full name is required.';

  if (!fields.businessName.trim())
    errors.businessName = 'Business name is required.';

  if (!fields.abn.trim()) {
    errors.abn = 'ABN is required.';
  } else if (!validateAbn(fields.abn)) {
    errors.abn = 'ABN must be 11 digits (e.g. 51 824 753 556).';
  }

  if (!fields.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!fields.phone.trim())
    errors.phone = 'Phone number is required.';

  if (!fields.businessStreet.trim())
    errors.businessStreet = 'Street address is required.';

  if (!fields.businessSuburb.trim())
    errors.businessSuburb = 'Suburb is required.';

  if (!fields.businessState.trim())
    errors.businessState = 'State is required.';

  if (!fields.businessPostcode.trim()) {
    errors.businessPostcode = 'Postcode is required.';
  } else if (!/^\d{4}$/.test(fields.businessPostcode.trim())) {
    errors.businessPostcode = 'Please enter a valid 4-digit postcode.';
  }

  return errors;
}

/* ── Input wrapper ──────────────────────────────────────────────────────── */
function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/80 mb-1.5">
        {label}
        {required && <span className="text-brand-warm ml-1" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  'w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/35 focus:outline-none focus:border-brand-warm focus:ring-1 focus:ring-brand-warm text-sm transition-colors';

const inputErrorClass =
  'w-full px-4 py-3 rounded-xl bg-white/8 border border-red-400/60 text-white placeholder-white/35 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 text-sm transition-colors';

/* ── Main component ─────────────────────────────────────────────────────── */
export default function StockistForm() {
  const [fields, setFields] = useState<FormFields>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formState, setFormState] = useState<FormState>('idle');
  const [serverError, setServerError] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    // Clear individual field error on change
    if (errors[name as keyof FieldErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const validation = validateFields(fields);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setFormState('submitting');
    setServerError('');

    if (!API_URL) {
      setServerError('Application endpoint is not configured. Please contact us directly.');
      setFormState('error');
      return;
    }

    try {
      const businessAddress = [
        fields.businessStreet,
        fields.businessSuburb,
        fields.businessState,
        fields.businessPostcode,
      ].filter(Boolean).join(', ');

      const res = await fetch(`${API_URL}/stockist-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fields.fullName,
          businessName: fields.businessName,
          abn: fields.abn,
          email: fields.email,
          phone: fields.phone,
          businessAddress,
          message: fields.message,
        }),
      });

      if (res.ok) {
        setFormState('success');
        setFields(EMPTY);
        setErrors({});
      } else {
        const data = await res.json().catch(() => ({}));
        setServerError(data.error || 'Something went wrong. Please try again.');
        setFormState('error');
      }
    } catch {
      setServerError('Unable to connect. Please check your connection and try again.');
      setFormState('error');
    }
  }

  if (formState === 'success') {
    return (
      <div className="text-center py-10 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-6">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-white mb-3">Application Received!</h3>
        <p className="text-white/60 leading-relaxed max-w-md mx-auto">
          Thank you for your interest in becoming a Neurotonics stockist. Our team will review your
          application and be in touch within 2–3 business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Row 1: Full Name + Business Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Full Name" required error={errors.fullName}>
          <input
            type="text"
            name="fullName"
            value={fields.fullName}
            onChange={handleChange}
            placeholder="Jane Smith"
            autoComplete="name"
            className={errors.fullName ? inputErrorClass : inputClass}
          />
        </Field>
        <Field label="Business Name" required error={errors.businessName}>
          <input
            type="text"
            name="businessName"
            value={fields.businessName}
            onChange={handleChange}
            placeholder="Wellness Co Pty Ltd"
            autoComplete="organization"
            className={errors.businessName ? inputErrorClass : inputClass}
          />
        </Field>
      </div>

      {/* Row 2: ABN + Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="ABN" required error={errors.abn}>
          <input
            type="text"
            name="abn"
            value={fields.abn}
            onChange={handleChange}
            placeholder="51 824 753 556"
            inputMode="numeric"
            className={errors.abn ? inputErrorClass : inputClass}
          />
        </Field>
        <Field label="Phone Number" required error={errors.phone}>
          <input
            type="tel"
            name="phone"
            value={fields.phone}
            onChange={handleChange}
            placeholder="0400 000 000"
            autoComplete="tel"
            className={errors.phone ? inputErrorClass : inputClass}
          />
        </Field>
      </div>

      {/* Row 3: Email */}
      <Field label="Email Address" required error={errors.email}>
        <input
          type="email"
          name="email"
          value={fields.email}
          onChange={handleChange}
          placeholder="jane@wellnessco.com.au"
          autoComplete="email"
          className={errors.email ? inputErrorClass : inputClass}
        />
      </Field>

      {/* Row 4: Business Address */}
      <div>
        <label className="block text-sm font-medium text-white/80 mb-1.5">
          Business Address <span className="text-brand-warm ml-1" aria-hidden="true">*</span>
        </label>
        <div className="space-y-3">
          {/* Street address */}
          <div>
            <input
              type="text"
              name="businessStreet"
              value={fields.businessStreet}
              onChange={handleChange}
              placeholder="Street address"
              autoComplete="address-line1"
              className={errors.businessStreet ? inputErrorClass : inputClass}
            />
            {errors.businessStreet && (
              <p className="mt-1.5 text-xs text-red-400" role="alert">{errors.businessStreet}</p>
            )}
          </div>

          {/* Suburb / State / Postcode row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <input
                type="text"
                name="businessSuburb"
                value={fields.businessSuburb}
                onChange={handleChange}
                placeholder="Suburb"
                autoComplete="address-level2"
                className={errors.businessSuburb ? inputErrorClass : inputClass}
              />
              {errors.businessSuburb && (
                <p className="mt-1.5 text-xs text-red-400" role="alert">{errors.businessSuburb}</p>
              )}
            </div>
            <div className="relative">
              <select
                name="businessState"
                value={fields.businessState}
                onChange={handleChange}
                autoComplete="address-level1"
                className={`${errors.businessState ? inputErrorClass : inputClass} appearance-none pr-8 cursor-pointer`}
                aria-label="State"
              >
                <option value="">State</option>
                {AU_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.code}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
              {errors.businessState && (
                <p className="mt-1.5 text-xs text-red-400" role="alert">{errors.businessState}</p>
              )}
            </div>
            <div>
              <input
                type="text"
                name="businessPostcode"
                value={fields.businessPostcode}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setFields((prev) => ({ ...prev, businessPostcode: digits }));
                  if (errors.businessPostcode) {
                    setErrors((prev) => ({ ...prev, businessPostcode: undefined }));
                  }
                }}
                placeholder="Postcode"
                autoComplete="postal-code"
                inputMode="numeric"
                maxLength={4}
                className={errors.businessPostcode ? inputErrorClass : inputClass}
              />
              {errors.businessPostcode && (
                <p className="mt-1.5 text-xs text-red-400" role="alert">{errors.businessPostcode}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 5: Message (optional) */}
      <Field label="Message" error={undefined}>
        <textarea
          name="message"
          value={fields.message}
          onChange={handleChange}
          placeholder="Tell us a bit about your store and why you'd like to stock Neurotonics (optional)"
          rows={4}
          className={`${inputClass} resize-none`}
        />
      </Field>

      {/* Server error */}
      {formState === 'error' && serverError && (
        <p className="text-sm text-red-400 text-center" role="alert">
          {serverError}
        </p>
      )}

      <p className="text-xs text-white/35">
        Fields marked <span className="text-brand-warm">*</span> are required.
      </p>

      <button
        type="submit"
        disabled={formState === 'submitting'}
        className="w-full sm:w-auto px-8 py-3.5 bg-brand-primary hover:bg-brand-primary-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-300 text-sm hover:scale-[1.02] active:scale-[0.98]"
      >
        {formState === 'submitting' ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Submitting…
          </span>
        ) : (
          'Submit Application'
        )}
      </button>
    </form>
  );
}
