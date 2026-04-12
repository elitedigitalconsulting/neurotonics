import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { toast } from '../components/Toast';

const TABS = ['Site Copy', 'Promo Banner', 'Navigation'] as const;
type Tab = typeof TABS[number];

export default function ContentPage() {
  const [tab, setTab] = useState<Tab>('Site Copy');

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Content Editor</h1>

      {/* Tabs */}
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

      {tab === 'Site Copy'     && <SiteCopyEditor />}
      {tab === 'Promo Banner'  && <PromoBannerEditor />}
      {tab === 'Navigation'    && <NavigationEditor />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Site Copy — hero + announcement bar
// ---------------------------------------------------------------------------
function SiteCopyEditor() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ content: Record<string, unknown> }>({
    queryKey: ['content', 'site.json'],
    queryFn: () => api.get('/cms/content/site.json'),
  });

  const mutation = useMutation({
    mutationFn: (content: Record<string, unknown>) =>
      api.put('/cms/content/site.json', { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content', 'site.json'] });
      toast('Site content saved — rebuild triggered');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  if (isLoading) return <p className="text-gray-400 text-sm">Loading…</p>;
  const site = (data?.content ?? {}) as Record<string, Record<string, string>>;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const updated = structuredClone(data?.content ?? {}) as Record<string, Record<string, string>>;
    // hero
    updated.hero = {
      ...updated.hero,
      headline:        String(fd.get('hero_headline')    ?? ''),
      subheadline:     String(fd.get('hero_subheadline') ?? ''),
      ctaText:         String(fd.get('hero_ctaText')     ?? ''),
    };
    // announcement
    updated.announcement = {
      ...updated.announcement,
      text: String(fd.get('announcement_text') ?? ''),
    };
    mutation.mutate(updated);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6 max-w-2xl">
      <Section title="Hero Section">
        <LabeledInput label="Headline" name="hero_headline" defaultValue={site.hero?.headline ?? ''} />
        <LabeledInput label="Subheadline" name="hero_subheadline" defaultValue={site.hero?.subheadline ?? ''} />
        <LabeledInput label="CTA button text" name="hero_ctaText" defaultValue={site.hero?.ctaText ?? ''} />
      </Section>
      <Section title="Announcement Bar">
        <LabeledInput label="Text" name="announcement_text" defaultValue={(site.announcement as { text?: string })?.text ?? ''} />
      </Section>
      <SaveButton pending={mutation.isPending} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Promo Banner (settings-based)
// ---------------------------------------------------------------------------
function PromoBannerEditor() {
  const qc = useQueryClient();
  const { data } = useQuery<{ settings: Record<string, string> }>({
    queryKey: ['settings'],
    queryFn: () => api.get('/cms/settings'),
  });

  const mutation = useMutation({
    mutationFn: (updates: Record<string, string>) => api.patch('/cms/settings', updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast('Banner settings saved');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutation.mutate({
      promo_banner_text:    String(fd.get('promo_banner_text')    ?? ''),
      promo_banner_visible: String(fd.get('promo_banner_visible') === 'on'),
      buy_globally_enabled: String(fd.get('buy_globally_enabled') === 'on'),
    });
  }

  const s = data?.settings ?? {};

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5 max-w-2xl">
      <Section title="Promotional Banner">
        <LabeledInput
          label="Banner text"
          name="promo_banner_text"
          defaultValue={s.promo_banner_text ?? ''}
        />
        <Toggle label="Banner visible" name="promo_banner_visible" defaultChecked={s.promo_banner_visible !== 'false'} />
        <Toggle label="Buy functionality enabled (global)" name="buy_globally_enabled" defaultChecked={s.buy_globally_enabled !== 'false'} />
      </Section>
      <SaveButton pending={mutation.isPending} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Navigation editor
// ---------------------------------------------------------------------------
function NavigationEditor() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ content: { navigation?: Array<{ label: string; href: string }> } }>({
    queryKey: ['content', 'site.json'],
    queryFn: () => api.get('/cms/content/site.json'),
  });

  const [items, setItems] = useState<Array<{ label: string; href: string }> | null>(null);

  useEffect(() => {
    if (data?.content?.navigation && items === null) {
      setItems(data.content.navigation);
    }
  }, [data, items]);

  const mutation = useMutation({
    mutationFn: (content: Record<string, unknown>) =>
      api.put('/cms/content/site.json', { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content', 'site.json'] });
      toast('Navigation saved — rebuild triggered');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  if (isLoading) return <p className="text-gray-400 text-sm">Loading…</p>;
  const nav = items ?? data?.content?.navigation ?? [];

  function save() {
    const updated = { ...(data?.content ?? {}), navigation: nav };
    mutation.mutate(updated as Record<string, unknown>);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-2xl">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Navigation Links</h3>
      <div className="space-y-2 mb-4">
        {nav.map((item, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              className="input flex-1"
              value={item.label}
              placeholder="Label"
              onChange={(e) => {
                const updated = [...nav];
                updated[i] = { ...updated[i], label: e.target.value };
                setItems(updated);
              }}
            />
            <input
              className="input flex-1"
              value={item.href}
              placeholder="/path"
              onChange={(e) => {
                const updated = [...nav];
                updated[i] = { ...updated[i], href: e.target.value };
                setItems(updated);
              }}
            />
            <button
              onClick={() => setItems(nav.filter((_, j) => j !== i))}
              className="p-2 text-red-400 hover:text-red-600"
            >✕</button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setItems([...nav, { label: '', href: '' }])}
        className="text-sm text-blue-600 hover:text-blue-700 mb-4"
      >
        + Add link
      </button>
      <div>
        <button
          onClick={save}
          disabled={mutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          <Save size={16} />
          {mutation.isPending ? 'Saving…' : 'Save Navigation'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function LabeledInput({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input name={name} defaultValue={defaultValue} className="input w-full" />
    </div>
  );
}

function Toggle({ label, name, defaultChecked }: { label: string; name: string; defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-10 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-1 transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
        </div>
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
    >
      {pending ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
      {pending ? 'Saving…' : 'Save Changes'}
    </button>
  );
}
