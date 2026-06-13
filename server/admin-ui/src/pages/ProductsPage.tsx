import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, X, Check, Image as ImageIcon } from 'lucide-react';
import { api, type Product } from '../api';
import { toast } from '../components/Toast';

function fmtAud(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n ?? 0);
}

const EMPTY: Partial<Product> = {
  name: '', slug: '', price: 0, currency: 'AUD',
  shortDescription: '', longDescription: '',
  images: [], badges: [], ingredients: [], faq: [],
  stockPercent: 100, unitsLeft: 0, inStock: true,
  servingSize: '', capsuleCount: 60, supply: '',
};

export default function ProductsPage() {
  const qc = useQueryClient();
  const [drawer, setDrawer] = useState<Partial<Product> | null>(null);
  const [isNew, setIsNew]   = useState(false);

  const { data, isLoading } = useQuery<{ products: Product[] }>({
    queryKey: ['products'],
    queryFn: () => api.get('/cms/products'),
  });

  const saveMutation = useMutation({
    mutationFn: (p: Partial<Product>) =>
      isNew
        ? api.post('/cms/products', p)
        : api.put(`/cms/products/${p.slug}`, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setDrawer(null);
      toast(isNew ? 'Product created — rebuild triggered' : 'Product saved — rebuild triggered');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (slug: string) => api.delete(`/cms/products/${slug}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast('Product deleted — rebuild triggered');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  function openNew() {
    setIsNew(true);
    setDrawer({ ...EMPTY });
  }

  function openEdit(p: Product) {
    setIsNew(false);
    setDrawer({ ...p });
  }

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Products</h1>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
          >
            <Plus size={16} /> Add product
          </button>
        </div>

        {isLoading && <p className="text-gray-400 text-sm">Loading…</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.products?.map((p) => (
            <div key={p.slug} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              {p.images?.[0] ? (
                <img
                  src={p.images[0].src}
                  alt={p.images[0].alt}
                  className="w-full h-36 object-contain mb-3 rounded-lg bg-gray-50"
                />
              ) : (
                <div className="w-full h-36 mb-3 rounded-lg bg-gray-100 flex items-center justify-center">
                  <ImageIcon size={32} className="text-gray-300" />
                </div>
              )}
              <h3 className="font-semibold text-gray-900 text-sm">{p.name}</h3>
              <p className="text-lg font-bold text-blue-600 mt-0.5">{fmtAud(p.price)}</p>
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.shortDescription}</p>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.inStock !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {p.inStock !== false ? 'In stock' : 'Out of stock'}
                  </span>
                  {typeof p.unitsLeft === 'number' && p.unitsLeft > 0 && (
                    <span className="text-xs text-gray-400">{p.unitsLeft} left</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteMutation.mutate(p.slug); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit drawer */}
      {drawer && (
        <ProductDrawer
          product={drawer}
          isNew={isNew}
          saving={saveMutation.isPending}
          onClose={() => setDrawer(null)}
          onChange={setDrawer}
          onSave={() => saveMutation.mutate(drawer)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product edit drawer — full field set
// ---------------------------------------------------------------------------
function ProductDrawer({ product, isNew, saving, onClose, onChange, onSave }: {
  product: Partial<Product>;
  isNew: boolean;
  saving: boolean;
  onClose: () => void;
  onChange: (p: Partial<Product>) => void;
  onSave: () => void;
}) {
  const set = <K extends keyof Product>(key: K, value: Product[K]) =>
    onChange({ ...product, [key]: value });

  // Media library images
  const { data: mediaData } = useQuery<{ images: Array<{ filename: string; url: string }> }>({
    queryKey: ['images'],
    queryFn: () => api.get('/cms/images'),
  });

  const apiBase = import.meta.env.VITE_API_URL ?? '';

  function resolveImageUrl(url: string) {
    // Absolute URL → use as-is. Relative → prefix with CMS server origin.
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${apiBase}${url}`;
  }

  return (
    <div className="w-[440px] border-l border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
        <h2 className="font-semibold text-gray-900">{isNew ? 'New Product' : 'Edit Product'}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* Basic info */}
        <Section title="Basic Information">
          <Field label="Product name *">
            <input className="input w-full" value={product.name ?? ''} onChange={e => set('name', e.target.value)} required />
          </Field>
          <Field label="URL slug">
            <input className="input w-full" value={product.slug ?? ''} onChange={e => set('slug', e.target.value)} placeholder="auto-generated" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (AUD) *">
              <input type="number" step="0.01" min="0" className="input w-full" value={product.price ?? 0}
                onChange={e => set('price', parseFloat(e.target.value) || 0)} />
            </Field>
            <Field label="Currency">
              <input className="input w-full" value={product.currency ?? 'AUD'} onChange={e => set('currency', e.target.value)} />
            </Field>
          </div>
          <Field label="Short description">
            <textarea rows={2} className="input w-full" value={product.shortDescription ?? ''}
              onChange={e => set('shortDescription', e.target.value)} />
          </Field>
          <Field label="Long description">
            <textarea rows={5} className="input w-full" value={product.longDescription ?? ''}
              onChange={e => set('longDescription', e.target.value)} />
          </Field>
        </Section>

        {/* Inventory */}
        <Section title="Inventory & Stock">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Units left">
              <input type="number" min="0" className="input w-full" value={product.unitsLeft ?? 0}
                onChange={e => set('unitsLeft', parseInt(e.target.value) || 0)} />
            </Field>
            <Field label="Stock % (bar fill)">
              <input type="number" min="0" max="100" className="input w-full" value={product.stockPercent ?? 100}
                onChange={e => set('stockPercent', parseInt(e.target.value) || 0)} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={product.inStock !== false}
              onChange={e => set('inStock', e.target.checked)} className="rounded" />
            In stock
          </label>
        </Section>

        {/* Product details */}
        <Section title="Product Details">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Serving size">
              <input className="input w-full" value={product.servingSize ?? ''}
                onChange={e => set('servingSize', e.target.value)} placeholder="2 capsules daily" />
            </Field>
            <Field label="Capsule count">
              <input type="number" min="0" className="input w-full" value={product.capsuleCount ?? 0}
                onChange={e => set('capsuleCount', parseInt(e.target.value) || 0)} />
            </Field>
          </div>
          <Field label="Supply duration">
            <input className="input w-full" value={product.supply ?? ''}
              onChange={e => set('supply', e.target.value)} placeholder="30-day supply" />
          </Field>
        </Section>

        {/* Images */}
        <Section title="Images">
          <p className="text-xs text-gray-400 mb-2">Enter a URL manually, or pick from the media library below.</p>
          {(product.images ?? []).map((img, i) => (
            <div key={i} className="flex gap-2 items-start mb-2">
              <div className="flex flex-col gap-1 flex-1">
                <input className="input w-full text-xs" placeholder="Image URL" value={img.src}
                  onChange={e => {
                    const imgs = [...(product.images ?? [])];
                    imgs[i] = { ...imgs[i], src: e.target.value };
                    set('images', imgs);
                  }} />
                <input className="input w-full text-xs" placeholder="Alt text" value={img.alt}
                  onChange={e => {
                    const imgs = [...(product.images ?? [])];
                    imgs[i] = { ...imgs[i], alt: e.target.value };
                    set('images', imgs);
                  }} />
              </div>
              {img.src && (
                <img src={resolveImageUrl(img.src)} alt={img.alt}
                  className="w-12 h-12 object-contain rounded border border-gray-200 bg-gray-50 shrink-0" />
              )}
              <button onClick={() => set('images', (product.images ?? []).filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-600 mt-1 shrink-0"><X size={14} /></button>
            </div>
          ))}
          <button type="button"
            onClick={() => set('images', [...(product.images ?? []), { src: '', alt: '' }])}
            className="text-xs text-blue-600 hover:text-blue-700">+ Add image URL</button>

          {/* Media library picker */}
          {mediaData && mediaData.images.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Pick from media library</p>
              <div className="grid grid-cols-4 gap-1 max-h-40 overflow-y-auto">
                {mediaData.images.map((m) => (
                  <button key={m.filename} type="button"
                    title={m.filename}
                    onClick={() => set('images', [...(product.images ?? []), { src: `${apiBase}${m.url}`, alt: m.filename.replace(/\.[^.]+$/, '') }])}
                    className="aspect-square rounded border border-gray-200 overflow-hidden hover:ring-2 hover:ring-blue-500 bg-gray-50">
                    <img src={`${apiBase}${m.url}`} alt={m.filename} className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Badges */}
        <Section title="Badges / Trust Labels">
          <p className="text-xs text-gray-400 mb-2">e.g. "ARTG Listed", "100% Vegan", "Made in Australia"</p>
          {(product.badges ?? []).map((badge, i) => (
            <div key={i} className="flex gap-2 items-center mb-1">
              <input className="input flex-1 text-sm" value={badge}
                onChange={e => {
                  const b = [...(product.badges ?? [])];
                  b[i] = e.target.value;
                  set('badges', b);
                }} />
              <button onClick={() => set('badges', (product.badges ?? []).filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-600"><X size={14} /></button>
            </div>
          ))}
          <button type="button"
            onClick={() => set('badges', [...(product.badges ?? []), ''])}
            className="text-xs text-blue-600 hover:text-blue-700">+ Add badge</button>
        </Section>

        {/* Ingredients */}
        <Section title="Ingredients">
          {(product.ingredients ?? []).map((ing, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 mb-2 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">Ingredient {i + 1}</span>
                <button onClick={() => set('ingredients', (product.ingredients ?? []).filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600"><X size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="input text-sm" placeholder="Name" value={ing.name}
                  onChange={e => {
                    const items = [...(product.ingredients ?? [])];
                    items[i] = { ...items[i], name: e.target.value };
                    set('ingredients', items);
                  }} />
                <input className="input text-sm" placeholder="Amount (e.g. 50mg)" value={ing.amount}
                  onChange={e => {
                    const items = [...(product.ingredients ?? [])];
                    items[i] = { ...items[i], amount: e.target.value };
                    set('ingredients', items);
                  }} />
              </div>
              <input className="input text-sm w-full mt-2" placeholder="Benefit description" value={ing.benefit}
                onChange={e => {
                  const items = [...(product.ingredients ?? [])];
                  items[i] = { ...items[i], benefit: e.target.value };
                  set('ingredients', items);
                }} />
            </div>
          ))}
          <button type="button"
            onClick={() => set('ingredients', [...(product.ingredients ?? []), { name: '', amount: '', benefit: '' }])}
            className="text-xs text-blue-600 hover:text-blue-700">+ Add ingredient</button>
        </Section>

        {/* FAQ */}
        <Section title="FAQ">
          {(product.faq ?? []).map((item, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 mb-2 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">FAQ {i + 1}</span>
                <button onClick={() => set('faq', (product.faq ?? []).filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600"><X size={14} /></button>
              </div>
              <input className="input text-sm w-full mb-2" placeholder="Question" value={item.question}
                onChange={e => {
                  const items = [...(product.faq ?? [])];
                  items[i] = { ...items[i], question: e.target.value };
                  set('faq', items);
                }} />
              <textarea rows={3} className="input text-sm w-full" placeholder="Answer" value={item.answer}
                onChange={e => {
                  const items = [...(product.faq ?? [])];
                  items[i] = { ...items[i], answer: e.target.value };
                  set('faq', items);
                }} />
            </div>
          ))}
          <button type="button"
            onClick={() => set('faq', [...(product.faq ?? []), { question: '', answer: '' }])}
            className="text-xs text-blue-600 hover:text-blue-700">+ Add FAQ item</button>
        </Section>

      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
        <button
          onClick={onSave}
          disabled={saving || !product.name}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Check size={16} />
          {saving ? 'Saving…' : 'Save Product'}
        </button>
        <button type="button" onClick={onClose}
          className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

