import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RefreshCw, Plus, X } from 'lucide-react';
import { api } from '../api';
import { toast } from '../components/Toast';

const TABS = ['Site Copy', 'Features', 'Testimonials', 'Footer', 'Promo Banner', 'Navigation'] as const;
type Tab = typeof TABS[number];

export default function ContentPage() {
  const [tab, setTab] = useState<Tab>('Site Copy');

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Content Editor</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
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

      {tab === 'Site Copy'    && <SiteCopyEditor />}
      {tab === 'Features'     && <FeaturesEditor />}
      {tab === 'Testimonials' && <TestimonialsEditor />}
      {tab === 'Footer'       && <FooterEditor />}
      {tab === 'Promo Banner' && <PromoBannerEditor />}
      {tab === 'Navigation'   && <NavigationEditor />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared hook — load + save site.json
// ---------------------------------------------------------------------------
function useSiteContent() {
  const qc = useQueryClient();
  const query = useQuery<{ content: Record<string, unknown> }>({
    queryKey: ['content', 'site.json'],
    queryFn: () => api.get('/cms/content/site.json'),
  });
  const mutation = useMutation({
    mutationFn: (content: Record<string, unknown>) =>
      api.put('/cms/content/site.json', { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content', 'site.json'] });
      toast('Content saved — rebuild triggered');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });
  return { query, mutation, site: (query.data?.content ?? {}) as Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Site Copy — hero + announcement bar + CTA banner
// ---------------------------------------------------------------------------
function SiteCopyEditor() {
  const { query, mutation, site } = useSiteContent();
  if (query.isLoading) return <p className="text-gray-400 text-sm">Loading…</p>;
  const hero = (site.hero ?? {}) as Record<string, string>;
  const ann  = (site.announcement ?? {}) as Record<string, string>;
  const cta  = (site.ctaBanner ?? {}) as Record<string, string>;
  const stockist = (site.stockist ?? {}) as Record<string, string>;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const updated = structuredClone(site);
    (updated as Record<string, unknown>).hero = {
      ...hero,
      headline:    String(fd.get('hero_headline')    ?? ''),
      subheadline: String(fd.get('hero_subheadline') ?? ''),
      ctaText:     String(fd.get('hero_ctaText')     ?? ''),
    };
    (updated as Record<string, unknown>).announcement = {
      ...ann,
      text:     String(fd.get('ann_text')     ?? ''),
      linkText: String(fd.get('ann_linkText') ?? ''),
      link:     String(fd.get('ann_link')     ?? ''),
    };
    (updated as Record<string, unknown>).ctaBanner = {
      ...cta,
      headline: String(fd.get('cta_headline') ?? ''),
      subtext:  String(fd.get('cta_subtext')  ?? ''),
      ctaText:  String(fd.get('cta_ctaText')  ?? ''),
    };
    (updated as Record<string, unknown>).stockist = {
      ...stockist,
      eyebrow:    String(fd.get('stockist_eyebrow')    ?? ''),
      headline:   String(fd.get('stockist_headline')   ?? ''),
      subheadline: String(fd.get('stockist_subheadline') ?? ''),
    };
    mutation.mutate(updated as Record<string, unknown>);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <Card title="Hero Section">
        <LI label="Headline"         name="hero_headline"    defaultValue={hero.headline    ?? ''} />
        <LI label="Subheadline"      name="hero_subheadline" defaultValue={hero.subheadline ?? ''} />
        <LI label="CTA button text"  name="hero_ctaText"     defaultValue={hero.ctaText     ?? ''} />
      </Card>
      <Card title="Announcement Bar">
        <LI label="Marquee text"     name="ann_text"     defaultValue={ann.text     ?? ''} />
        <LI label="Link label"       name="ann_linkText" defaultValue={ann.linkText ?? ''} />
        <LI label="Link URL"         name="ann_link"     defaultValue={ann.link     ?? ''} />
      </Card>
      <Card title="CTA Banner (bottom of homepage)">
        <LI label="Headline"    name="cta_headline" defaultValue={cta.headline ?? ''} />
        <LI label="Subtext"     name="cta_subtext"  defaultValue={cta.subtext  ?? ''} />
        <LI label="Button text" name="cta_ctaText"  defaultValue={cta.ctaText  ?? ''} />
      </Card>
      <Card title="Stockist Section Copy">
        <LI label="Eyebrow label" name="stockist_eyebrow"    defaultValue={stockist.eyebrow    ?? ''} />
        <LI label="Headline"      name="stockist_headline"   defaultValue={stockist.headline   ?? ''} />
        <LI label="Subheadline"   name="stockist_subheadline" defaultValue={stockist.subheadline ?? ''} />
      </Card>
      <SaveButton pending={mutation.isPending} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Features editor
// ---------------------------------------------------------------------------
type FeatureItem = { icon?: string; title: string; description: string };

function FeaturesEditor() {
  const { query, mutation, site } = useSiteContent();
  const [items, setItems] = useState<FeatureItem[] | null>(null);

  useEffect(() => {
    if (site.features && items === null) {
      setItems(site.features as FeatureItem[]);
    }
  }, [site, items]);

  if (query.isLoading) return <p className="text-gray-400 text-sm">Loading…</p>;
  const list = items ?? (site.features as FeatureItem[]) ?? [];

  function save() {
    mutation.mutate({ ...site, features: list } as Record<string, unknown>);
  }

  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-gray-500 mb-4">Edit the "Why Neurotonics" feature items shown on the homepage.</p>
      {list!.map((f, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-gray-400">Feature {i + 1}</span>
            <button onClick={() => setItems(list!.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={14} /></button>
          </div>
          <input className="input w-full text-sm" placeholder="Title" value={f.title}
            onChange={e => { const n = [...list!]; n[i] = { ...n[i], title: e.target.value }; setItems(n); }} />
          <textarea rows={2} className="input w-full text-sm" placeholder="Description" value={f.description}
            onChange={e => { const n = [...list!]; n[i] = { ...n[i], description: e.target.value }; setItems(n); }} />
        </div>
      ))}
      <button type="button"
        onClick={() => setItems([...list!, { title: '', description: '' }])}
        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
        <Plus size={14} /> Add feature
      </button>
      <div className="pt-2">
        <button onClick={save} disabled={mutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
          {mutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          {mutation.isPending ? 'Saving…' : 'Save Features'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Testimonials editor
// ---------------------------------------------------------------------------
type TestimonialItem = { name: string; title?: string; quote: string; rating?: number };

function TestimonialsEditor() {
  const { query, mutation, site } = useSiteContent();
  const [items, setItems] = useState<TestimonialItem[] | null>(null);

  useEffect(() => {
    if (site.testimonials && items === null) {
      setItems(site.testimonials as TestimonialItem[]);
    }
  }, [site, items]);

  if (query.isLoading) return <p className="text-gray-400 text-sm">Loading…</p>;
  const list = items ?? (site.testimonials as TestimonialItem[]) ?? [];

  function save() {
    mutation.mutate({ ...site, testimonials: list } as Record<string, unknown>);
  }

  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-gray-500 mb-4">Edit customer testimonials shown on the homepage.</p>
      {list!.map((t, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-gray-400">Testimonial {i + 1}</span>
            <button onClick={() => setItems(list!.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="input text-sm" placeholder="Name" value={t.name}
              onChange={e => { const n = [...list!]; n[i] = { ...n[i], name: e.target.value }; setItems(n); }} />
            <input className="input text-sm" placeholder="Title / Location" value={t.title ?? ''}
              onChange={e => { const n = [...list!]; n[i] = { ...n[i], title: e.target.value }; setItems(n); }} />
          </div>
          <textarea rows={3} className="input w-full text-sm" placeholder="Quote" value={t.quote}
            onChange={e => { const n = [...list!]; n[i] = { ...n[i], quote: e.target.value }; setItems(n); }} />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Rating (1–5):</label>
            <input type="number" min={1} max={5} className="input w-16 text-sm" value={t.rating ?? 5}
              onChange={e => { const n = [...list!]; n[i] = { ...n[i], rating: parseInt(e.target.value) || 5 }; setItems(n); }} />
          </div>
        </div>
      ))}
      <button type="button"
        onClick={() => setItems([...list!, { name: '', quote: '', rating: 5 }])}
        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
        <Plus size={14} /> Add testimonial
      </button>
      <div className="pt-2">
        <button onClick={save} disabled={mutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
          {mutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          {mutation.isPending ? 'Saving…' : 'Save Testimonials'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer editor
// ---------------------------------------------------------------------------
function FooterEditor() {
  const { query, mutation, site } = useSiteContent();
  if (query.isLoading) return <p className="text-gray-400 text-sm">Loading…</p>;
  const footer = (site.footer ?? {}) as Record<string, unknown>;
  const social  = (footer.socialLinks ?? {}) as Record<string, string>;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const updated = structuredClone(site);
    (updated as Record<string, unknown>).footer = {
      ...footer,
      about:        String(fd.get('footer_about')        ?? ''),
      contactEmail: String(fd.get('footer_contactEmail') ?? ''),
      contactPhone: String(fd.get('footer_contactPhone') ?? ''),
      socialLinks: {
        ...social,
        instagram: String(fd.get('social_instagram') ?? ''),
        facebook:  String(fd.get('social_facebook')  ?? ''),
        twitter:   String(fd.get('social_twitter')   ?? ''),
      },
    };
    mutation.mutate(updated as Record<string, unknown>);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <Card title="Footer Content">
        <LI label="About text"      name="footer_about"        defaultValue={String(footer.about        ?? '')} textarea />
        <LI label="Contact email"   name="footer_contactEmail" defaultValue={String(footer.contactEmail ?? '')} />
        <LI label="Contact phone"   name="footer_contactPhone" defaultValue={String(footer.contactPhone ?? '')} />
      </Card>
      <Card title="Social Links">
        <LI label="Instagram URL" name="social_instagram" defaultValue={social.instagram ?? ''} />
        <LI label="Facebook URL"  name="social_facebook"  defaultValue={social.facebook  ?? ''} />
        <LI label="Twitter / X URL" name="social_twitter" defaultValue={social.twitter   ?? ''} />
      </Card>
      <SaveButton pending={mutation.isPending} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Promo Banner — updates site.json announcement + settings for visibility
// ---------------------------------------------------------------------------
function PromoBannerEditor() {
  const qc = useQueryClient();

  const siteQuery = useQuery<{ content: Record<string, unknown> }>({
    queryKey: ['content', 'site.json'],
    queryFn: () => api.get('/cms/content/site.json'),
  });
  const settingsQuery = useQuery<{ settings: Record<string, string> }>({
    queryKey: ['settings'],
    queryFn: () => api.get('/cms/settings'),
  });

  const siteMutation = useMutation({
    mutationFn: (content: Record<string, unknown>) =>
      api.put('/cms/content/site.json', { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content', 'site.json'] });
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const settingsMutation = useMutation({
    mutationFn: (updates: Record<string, string>) => api.patch('/cms/settings', updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast('Banner saved — rebuild triggered for text change');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const site = (siteQuery.data?.content ?? {}) as Record<string, unknown>;
  const ann  = (site.announcement ?? {}) as Record<string, string>;
  const s    = settingsQuery.data?.settings ?? {};

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text     = String(fd.get('ann_text')    ?? '');
    const linkText = String(fd.get('ann_linkText') ?? '');
    const link     = String(fd.get('ann_link')     ?? '');
    const visible  = (fd.get('promo_visible') as string) === 'on';
    const buyEnabled = (fd.get('buy_enabled') as string) === 'on';

    // Update site.json announcement text (requires rebuild to go live)
    const updatedSite = structuredClone(site) as Record<string, unknown>;
    updatedSite.announcement = { ...ann, text, linkText, link };
    siteMutation.mutate(updatedSite);

    // Update settings (visibility + buy toggle — instant server effect)
    settingsMutation.mutate({
      promo_banner_visible: String(visible),
      promo_banner_text:    text,
      buy_globally_enabled: String(buyEnabled),
    });
  }

  const pending = siteMutation.isPending || settingsMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <Card title="Announcement Bar Text">
        <p className="text-xs text-gray-400 mb-2">
          This scrolling bar appears at the top of every page. Changes require a site rebuild (~2 min) to go live.
        </p>
        <LI label="Marquee text" name="ann_text"     defaultValue={ann.text     ?? ''} />
        <LI label="Link label"   name="ann_linkText" defaultValue={ann.linkText ?? ''} />
        <LI label="Link URL"     name="ann_link"     defaultValue={ann.link     ?? ''} />
      </Card>
      <Card title="Store Controls">
        <Toggle label="Announcement bar visible" name="promo_visible"  defaultChecked={s.promo_banner_visible !== 'false'} />
        <Toggle label="Buy functionality enabled (site-wide)" name="buy_enabled" defaultChecked={s.buy_globally_enabled !== 'false'} />
        <p className="text-xs text-gray-400">Disabling buy functionality prevents new payments. Existing orders are unaffected.</p>
      </Card>
      <SaveButton pending={pending} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Navigation editor
// ---------------------------------------------------------------------------
function NavigationEditor() {
  const { query, mutation, site } = useSiteContent();
  const [items, setItems] = useState<Array<{ label: string; href: string }> | null>(null);

  useEffect(() => {
    if (site.navigation && items === null) {
      setItems(site.navigation as Array<{ label: string; href: string }>);
    }
  }, [site, items]);

  if (query.isLoading) return <p className="text-gray-400 text-sm">Loading…</p>;
  const nav = items ?? (site.navigation as Array<{ label: string; href: string }>) ?? [];

  function save() {
    mutation.mutate({ ...site, navigation: nav } as Record<string, unknown>);
  }

  return (
    <div className="max-w-2xl">
      <Card title="Navigation Links">
        <div className="space-y-2 mb-3">
          {nav.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input className="input flex-1 text-sm" value={item.label} placeholder="Label"
                onChange={e => { const u = [...nav]; u[i] = { ...u[i], label: e.target.value }; setItems(u); }} />
              <input className="input flex-1 text-sm" value={item.href} placeholder="/path"
                onChange={e => { const u = [...nav]; u[i] = { ...u[i], href: e.target.value }; setItems(u); }} />
              <button onClick={() => setItems(nav.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={14} /></button>
            </div>
          ))}
        </div>
        <button type="button"
          onClick={() => setItems([...nav, { label: '', href: '' }])}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
          <Plus size={14} /> Add link
        </button>
      </Card>
      <div className="mt-4">
        <button onClick={save} disabled={mutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
          {mutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          {mutation.isPending ? 'Saving…' : 'Save Navigation'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------------
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function LI({ label, name, defaultValue, textarea }: { label: string; name: string; defaultValue: string; textarea?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {textarea
        ? <textarea name={name} rows={3} defaultValue={defaultValue} className="input w-full" />
        : <input name={name} defaultValue={defaultValue} className="input w-full" />}
    </div>
  );
}

function Toggle({ label, name, defaultChecked }: { label: string; name: string; defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input type="checkbox" name={name} checked={checked}
          onChange={e => setChecked(e.target.checked)} className="sr-only" />
        <div className={`w-10 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}>
          <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-1 transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
        </div>
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending}
      className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
      {pending ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
      {pending ? 'Saving…' : 'Save Changes'}
    </button>
  );
}
