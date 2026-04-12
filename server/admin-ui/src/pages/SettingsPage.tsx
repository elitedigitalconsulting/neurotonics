import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RefreshCw, TestTube } from 'lucide-react';
import { api } from '../api';
import { toast } from '../components/Toast';

export default function SettingsPage() {
  const qc = useQueryClient();
  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ settings: Record<string, string> }>({
    queryKey: ['settings'],
    queryFn: () => api.get('/cms/settings'),
  });

  const mutation = useMutation({
    mutationFn: (updates: Record<string, string>) => api.patch('/cms/settings', updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast('Settings saved');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const updates: Record<string, string> = {};
    for (const [key, value] of fd.entries()) {
      updates[key] = String(value);
    }
    mutation.mutate(updates);
  }

  async function handleTestEmail() {
    setTestStatus('Sending…');
    try {
      await api.post('/cms/settings/test-email', { to: testEmail });
      setTestStatus('✓ Test email sent!');
    } catch (err: unknown) {
      setTestStatus('✗ ' + (err instanceof Error ? err.message : 'Failed'));
    }
  }

  const s = data?.settings ?? {};

  if (isLoading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Notifications */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Email Notifications</h2>
          <div className="space-y-4">
            <Field label="Customer confirmation email (From address)">
              <input
                name="notification_email"
                type="email"
                defaultValue={s.notification_email ?? ''}
                className="input w-full"
              />
            </Field>
            <Field label="Admin notification email (internal alerts)">
              <input
                name="admin_notification_email"
                type="email"
                defaultValue={s.admin_notification_email ?? ''}
                className="input w-full"
              />
            </Field>
          </div>
        </section>

        {/* Store toggles */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Store Controls</h2>
          <div className="space-y-4">
            <ToggleField
              label="Buy functionality enabled"
              name="buy_globally_enabled"
              checked={s.buy_globally_enabled !== 'false'}
              sub="Disable to take the store offline globally (e.g. for maintenance)"
            />
            <ToggleField
              label="Promotional banner visible"
              name="promo_banner_visible"
              checked={s.promo_banner_visible !== 'false'}
            />
          </div>
        </section>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          {mutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          {mutation.isPending ? 'Saving…' : 'Save Settings'}
        </button>
      </form>

      {/* SMTP test */}
      <section className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Test Email Configuration</h2>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="Send test to…"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="input flex-1"
          />
          <button
            type="button"
            onClick={handleTestEmail}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg"
          >
            <TestTube size={16} /> Send test
          </button>
        </div>
        {testStatus && <p className="mt-2 text-sm text-gray-600">{testStatus}</p>}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ToggleField({ label, name, checked: initialChecked, sub }: {
  label: string; name: string; checked: boolean; sub?: string;
}) {
  const [checked, setChecked] = useState(initialChecked);
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          name={name}
          value="true"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-1 transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
        </div>
      </div>
      <div>
        <span className="text-sm text-gray-800">{label}</span>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </label>
  );
}
