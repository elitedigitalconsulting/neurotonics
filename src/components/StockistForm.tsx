'use client';

import { useState, FormEvent } from 'react';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

interface FormFields {
  fullName: string;
  businessName: string;
  abn: string;
  email: string;
  phone: string;
  businessAddress: string;
  message: string;
}

interface FieldErrors {
  fullName?: string;
  businessName?: string;
  abn?: string;
  email?: string;
  phone?: string;
  businessAddress?: string;
}

const EMPTY: FormFields = {
  fullName: '',
  businessName: '',
  abn: '',
  email: '',
  phone: '',
  businessAddress: '',
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

  if (!fields.businessAddress.trim())
    errors.businessAddress = 'Business address is required.';

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

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
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
      const res = await fetch(`${API_URL}/stockist-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
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
      <Field label="Business Address" required error={errors.businessAddress}>
        <input
          type="text"
          name="businessAddress"
          value={fields.businessAddress}
          onChange={handleChange}
          placeholder="123 Main Street, Melbourne VIC 3000"
          autoComplete="street-address"
          className={errors.businessAddress ? inputErrorClass : inputClass}
        />
      </Field>

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
