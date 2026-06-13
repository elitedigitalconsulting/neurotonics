import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RefreshCw, TestTube, Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { api, getAccessToken } from '../api';
import { toast } from '../components/Toast';
import { useAuth } from '../AuthContext';

const TABS = ['General', 'Backup & Restore', 'Email Templates'] as const;
type Tab = typeof TABS[number];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('General');

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Settings</h1>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'General'          && <GeneralSettings />}
      {tab === 'Backup & Restore' && <BackupRestoreSettings />}
      {tab === 'Email Templates'  && <EmailTemplateSettings />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// General settings
// ---------------------------------------------------------------------------
function GeneralSettings() {
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
  if (isLoading) return <div className="text-gray-400 text-sm">Loading…</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Notifications */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Email Notifications</h2>
        <div className="space-y-4">
          <Field label="Customer confirmation email (From address)">
            <input name="notification_email" type="email" defaultValue={s.notification_email ?? ''} className="input w-full" />
          </Field>
          <Field label="Admin notification email (internal alerts)">
            <input name="admin_notification_email" type="email" defaultValue={s.admin_notification_email ?? ''} className="input w-full" />
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

      <button type="submit" disabled={mutation.isPending}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
        {mutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
        {mutation.isPending ? 'Saving…' : 'Save Settings'}
      </button>

      {/* SMTP test */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Test Email Configuration</h2>
        <div className="flex gap-2">
          <input type="email" placeholder="Send test to…" value={testEmail}
            onChange={e => setTestEmail(e.target.value)} className="input flex-1" />
          <button type="button" onClick={handleTestEmail}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg">
            <TestTube size={16} /> Send test
          </button>
        </div>
        {testStatus && <p className="mt-2 text-sm text-gray-600">{testStatus}</p>}
      </section>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Backup & Restore (admin only)
// ---------------------------------------------------------------------------
interface BackupStatus {
  exists: boolean;
  backupPath?: string;
  createdAt?: string;
  fileSizeBytes?: number;
  counts?: { stockist_applications: number; users: number; settings: number };
}

function BackupRestoreSettings() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  const statusQuery = useQuery<BackupStatus>({
    queryKey: ['backup-status'],
    queryFn: () => api.get('/cms/backup/status'),
    enabled: user?.role === 'admin',
    refetchInterval: 30_000,
  });

  const restoreMutation = useMutation<{ success: boolean; restored: number; skipped: number }, Error, object>({
    mutationFn: (payload) => api.post('/cms/backup/restore', payload),
    onSuccess: (data) => {
      setRestoreStatus(`✓ Restored ${data.restored} records (${data.skipped} already existed)`);
      statusQuery.refetch();
      toast('Backup restored successfully');
    },
    onError: (err) => {
      setRestoreStatus('✗ ' + err.message);
      toast(err.message, 'error');
    },
  });

  if (user?.role !== 'admin') {
    return <p className="text-sm text-gray-400 italic">Backup management requires Admin role.</p>;
  }

  async function handleDownload() {
    try {
      const token = getAccessToken();
      const res = await fetch('/cms/backup/download', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) { toast('Backup download failed', 'error'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `neurotonics-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Backup downloaded');
    } catch {
      toast('Download failed', 'error');
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text    = await file.text();
      const payload = JSON.parse(text);
      setRestoreStatus('Restoring…');
      restoreMutation.mutate(payload);
    } catch {
      setRestoreStatus('✗ Invalid JSON file');
      toast('Invalid backup file', 'error');
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const s = statusQuery.data;

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Warning banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex gap-3">
          <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Data persistence notice</p>
            <p className="text-sm text-amber-700 mt-1">
              The CMS database lives on Render's server. Auto-deploy is disabled, so the
              database is preserved between CMS content saves. However, if you manually
              redeploy the server from the Render dashboard, the database will be wiped.
            </p>
            <p className="text-sm text-amber-700 mt-2 font-medium">
              Always download a backup before triggering a manual Render redeploy.
              Re-upload the backup immediately after the new version starts up.
            </p>
            <p className="text-sm text-amber-600 mt-2">
              For permanent persistence: add a Render Starter plan ($7/month) with a
              persistent disk mounted at <code className="bg-amber-100 px-1 rounded">/data</code>
              and set <code className="bg-amber-100 px-1 rounded">DB_BACKUP_DIR=/data</code>
              in the Render environment.
            </p>
          </div>
        </div>
      </div>

      {/* Current backup status */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Current Backup</h2>
        {statusQuery.isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : s?.exists ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle size={16} />
              <span className="text-sm font-medium">Backup file found</span>
            </div>
            <table className="text-sm w-full">
              <tbody className="divide-y divide-gray-50">
                <tr><td className="py-1.5 text-gray-500 w-40">Last backup</td><td className="py-1.5">{s.createdAt ? new Date(s.createdAt).toLocaleString('en-AU') : '—'}</td></tr>
                <tr><td className="py-1.5 text-gray-500">File size</td><td className="py-1.5">{s.fileSizeBytes ? Math.round(s.fileSizeBytes / 1024) + ' KB' : '—'}</td></tr>
                <tr><td className="py-1.5 text-gray-500">Applications</td><td className="py-1.5">{s.counts?.stockist_applications ?? 0}</td></tr>
                <tr><td className="py-1.5 text-gray-500">Users</td><td className="py-1.5">{s.counts?.users ?? 0}</td></tr>
                <tr><td className="py-1.5 text-gray-500">Location</td><td className="py-1.5 font-mono text-xs text-gray-400 break-all">{s.backupPath}</td></tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <AlertTriangle size={16} className="text-amber-500" />
            <span className="text-sm">No backup file exists yet. One will be created automatically after the next CMS save.</span>
          </div>
        )}
      </section>

      {/* Download */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Download Backup</h2>
        <p className="text-xs text-gray-400 mb-4">
          Downloads a JSON file containing all stockist applications, CMS users, and settings.
          Orders are excluded to protect customer data. Save this file before any Render redeploy.
        </p>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
        >
          <Download size={16} /> Download Backup JSON
        </button>
      </section>

      {/* Restore */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Restore from Backup</h2>
        <p className="text-xs text-gray-400 mb-4">
          Upload a previously downloaded backup JSON file. Existing records are never overwritten —
          only missing records are inserted. Safe to run on a partial restore.
        </p>
        <div className="flex gap-3 items-center flex-wrap">
          <label className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg cursor-pointer">
            <Upload size={16} />
            Choose Backup File
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
          {restoreMutation.isPending && (
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <RefreshCw size={14} className="animate-spin" /> Restoring…
            </span>
          )}
        </div>
        {restoreStatus && (
          <p className={`mt-3 text-sm ${restoreStatus.startsWith('✓') ? 'text-green-700' : 'text-red-600'}`}>
            {restoreStatus}
          </p>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email template editor (admin only)
// ---------------------------------------------------------------------------
function EmailTemplateSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<'order_confirmation_template' | 'admin_alert_template' | 'fulfillment_email_template'>('order_confirmation_template');

  const { data, isLoading } = useQuery<{
    order_confirmation_template: string;
    admin_alert_template: string;
    fulfillment_email_template: string;
  }>({
    queryKey: ['settings-templates'],
    queryFn: () => api.get('/cms/settings/templates'),
    enabled: user?.role === 'admin',
  });

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data) {
      setDrafts({
        order_confirmation_template: data.order_confirmation_template ?? '',
        admin_alert_template:        data.admin_alert_template        ?? '',
        fulfillment_email_template:  data.fulfillment_email_template  ?? '',
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (updates: Record<string, string>) => api.patch('/cms/settings', updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-templates'] });
      toast('Email template saved');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  if (user?.role !== 'admin') {
    return <p className="text-sm text-gray-400 italic">Email template editing requires Admin role.</p>;
  }

  if (isLoading) return <div className="text-gray-400 text-sm">Loading…</div>;

  const TEMPLATE_TABS: { key: typeof active; label: string; vars: string[] }[] = [
    {
      key: 'order_confirmation_template',
      label: 'Order Confirmation',
      vars: ['{{customerName}}', '{{customerEmail}}', '{{itemsTable}}', '{{shippingLabel}}', '{{shippingFee}}', '{{total}}', '{{stripeSessionId}}'],
    },
    {
      key: 'admin_alert_template',
      label: 'Admin New Order Alert',
      vars: ['{{customerName}}', '{{customerEmail}}', '{{customerPhone}}', '{{shippingAddress}}', '{{itemsList}}', '{{total}}', '{{stripeSessionId}}', '{{orderId}}'],
    },
    {
      key: 'fulfillment_email_template',
      label: 'Fulfilment / Shipped',
      vars: ['{{customerName}}', '{{customerEmail}}', '{{itemsTable}}', '{{shippingLabel}}', '{{shippingFee}}', '{{total}}', '{{orderId}}'],
    },
  ];

  const current = TEMPLATE_TABS.find(t => t.key === active)!;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {TEMPLATE_TABS.map(t => (
          <button key={t.key} onClick={() => setActive(t.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">{current.label} Template</h3>
          <div className="flex flex-wrap gap-1">
            {current.vars.map(v => (
              <code key={v} className="text-xs bg-gray-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">{v}</code>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-3">HTML template. Use the variables above where needed.</p>
        <textarea
          rows={18}
          className="w-full font-mono text-xs border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          value={drafts[active] ?? ''}
          onChange={e => setDrafts(d => ({ ...d, [active]: e.target.value }))}
        />
        <div className="mt-3">
          <button
            onClick={() => mutation.mutate({ [active]: drafts[active] ?? '' })}
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
            {mutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            {mutation.isPending ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------
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
        <input type="checkbox" name={name} value="true" checked={checked}
          onChange={e => setChecked(e.target.checked)} className="sr-only" />
        <div className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}>
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
