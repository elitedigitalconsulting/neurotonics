import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react';
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
      toast(isNew ? 'Product created' : 'Product saved');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (slug: string) => api.delete(`/cms/products/${slug}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast('Product deleted');
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
      <div className="flex-1 p-6">
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
              {p.images?.[0] && (
                <img
                  src={p.images[0].src}
                  alt={p.images[0].alt}
                  className="w-full h-36 object-contain mb-3 rounded-lg bg-gray-50"
                />
              )}
              <h3 className="font-semibold text-gray-900 text-sm">{p.name}</h3>
              <p className="text-lg font-bold text-blue-600 mt-0.5">{fmtAud(p.price)}</p>
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.shortDescription}</p>
              <div className="flex items-center justify-between mt-4">
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.inStock !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {p.inStock !== false ? 'In stock' : 'Out of stock'}
                </span>
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
        <div className="w-96 border-l border-gray-200 bg-white p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-gray-900">{isNew ? 'New Product' : 'Edit Product'}</h2>
            <button onClick={() => setDrawer(null)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(drawer); }}
          >
            <Field label="Name">
              <input
                className="input"
                value={drawer.name ?? ''}
                onChange={(e) => setDrawer((d) => ({ ...d, name: e.target.value }))}
                required
              />
            </Field>
            <Field label="Slug">
              <input
                className="input"
                value={drawer.slug ?? ''}
                onChange={(e) => setDrawer((d) => ({ ...d, slug: e.target.value }))}
                placeholder="auto-generated from name"
              />
            </Field>
            <Field label="Price (AUD)">
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={drawer.price ?? 0}
                onChange={(e) => setDrawer((d) => ({ ...d, price: parseFloat(e.target.value) || 0 }))}
              />
            </Field>
            <Field label="Short description">
              <textarea
                rows={2}
                className="input"
                value={drawer.shortDescription ?? ''}
                onChange={(e) => setDrawer((d) => ({ ...d, shortDescription: e.target.value }))}
              />
            </Field>
            <Field label="Long description">
              <textarea
                rows={5}
                className="input"
                value={drawer.longDescription ?? ''}
                onChange={(e) => setDrawer((d) => ({ ...d, longDescription: e.target.value }))}
              />
            </Field>
            <Field label="Units left">
              <input
                type="number"
                min="0"
                className="input"
                value={drawer.unitsLeft ?? 0}
                onChange={(e) => setDrawer((d) => ({ ...d, unitsLeft: parseInt(e.target.value) || 0 }))}
              />
            </Field>
            <Field label="Stock percent">
              <input
                type="number"
                min="0"
                max="100"
                className="input"
                value={drawer.stockPercent ?? 100}
                onChange={(e) => setDrawer((d) => ({ ...d, stockPercent: parseInt(e.target.value) || 0 }))}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={drawer.inStock !== false}
                onChange={(e) => setDrawer((d) => ({ ...d, inStock: e.target.checked }))}
                className="rounded"
              />
              In stock
            </label>

            <div className="pt-4 flex gap-3">
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check size={16} />
                {saveMutation.isPending ? 'Saving…' : 'Save Product'}
              </button>
              <button type="button" onClick={() => setDrawer(null)} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
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
