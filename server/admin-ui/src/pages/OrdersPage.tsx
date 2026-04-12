import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Search } from 'lucide-react';
import { api, type Order } from '../api';
import { statusBadge } from '../components/Badge';
import { toast } from '../components/Toast';

function fmtAud(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n ?? 0);
}

const STATUSES = ['', 'pending', 'processing', 'fulfilled', 'refunded', 'failed'];

export default function OrdersPage() {
  const qc = useQueryClient();
  const [page, setPage]         = useState(1);
  const [status, setStatus]     = useState('');
  const [search, setSearch]     = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);

  const { data, isLoading } = useQuery<{ orders: Order[]; pagination: { pages: number; total: number } }>({
    queryKey: ['orders', page, status, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      return api.get(`/cms/orders?${params}`);
    },
  });

  const statusMutation = useMutation<{ order: Order }, Error, { id: number; newStatus: string }>({
    mutationFn: ({ id, newStatus }) =>
      api.patch<{ order: Order }>(`/cms/orders/${id}/status`, { status: newStatus }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order-stats'] });
      setSelected(data.order);
      toast('Order status updated');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  return (
    <div className="flex h-full">
      {/* List panel */}
      <div className="flex-1 p-6 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Orders</h1>
          <span className="text-sm text-gray-400">{data?.pagination?.total ?? 0} total</span>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search by name or email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
            />
          </div>
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All statuses'}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left font-medium">#</th>
                <th className="px-5 py-3 text-left font-medium">Customer</th>
                <th className="px-5 py-3 text-left font-medium">Total</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-left font-medium">Date</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
              )}
              {data?.orders?.map((o) => (
                <tr
                  key={o.id}
                  className={`hover:bg-gray-50 cursor-pointer ${selected?.id === o.id ? 'bg-blue-50' : ''}`}
                  onClick={() => setSelected(o)}
                >
                  <td className="px-5 py-3 text-gray-400">#{o.id}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{o.customer_name || '—'}</p>
                    <p className="text-xs text-gray-400">{o.customer_email}</p>
                  </td>
                  <td className="px-5 py-3 font-medium">{fmtAud(o.total)}</td>
                  <td className="px-5 py-3">{statusBadge(o.status)}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(o.created_at).toLocaleDateString('en-AU')}
                  </td>
                  <td className="px-5 py-3 text-gray-300">
                    <ChevronRight size={16} />
                  </td>
                </tr>
              ))}
              {!isLoading && !data?.orders?.length && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No orders found</td></tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {(data?.pagination?.pages ?? 0) > 1 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="disabled:opacity-30">← Prev</button>
              <span>Page {page} of {data?.pagination?.pages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= (data?.pagination?.pages ?? 1)} className="disabled:opacity-30">Next →</button>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-80 border-l border-gray-200 bg-white p-6 overflow-y-auto">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Order #{selected.id}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(selected.created_at).toLocaleString('en-AU')}
              </p>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          {/* Status selector */}
          <div className="mb-5">
            <p className="text-xs font-medium text-gray-500 mb-1">Status</p>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selected.status}
              onChange={(e) => statusMutation.mutate({ id: selected.id, newStatus: e.target.value })}
            >
              {['pending', 'processing', 'fulfilled', 'refunded', 'failed'].map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Customer */}
          <section className="mb-5">
            <p className="text-xs font-semibold text-gray-500 mb-2">Customer</p>
            <p className="text-sm font-medium">{selected.customer_name || '—'}</p>
            <p className="text-sm text-gray-500">{selected.customer_email}</p>
            {selected.customer_phone && <p className="text-sm text-gray-500">{selected.customer_phone}</p>}
          </section>

          {/* Shipping address */}
          {selected.shipping_address && (
            <section className="mb-5">
              <p className="text-xs font-semibold text-gray-500 mb-2">Shipping Address</p>
              {(() => {
                const a = selected.shipping_address;
                return (
                  <p className="text-sm text-gray-700">
                    {[a.address1, a.address2, a.city, a.state, a.postcode, a.country].filter(Boolean).join(', ')}
                  </p>
                );
              })()}
            </section>
          )}

          {/* Items */}
          <section className="mb-5">
            <p className="text-xs font-semibold text-gray-500 mb-2">Items</p>
            {Array.isArray(selected.items) && selected.items.length > 0 ? (
              <ul className="space-y-1">
                {selected.items.map((item, i) => (
                  <li key={i} className="text-sm flex justify-between">
                    <span>{item.name} × {item.quantity}</span>
                    <span className="text-gray-500">{fmtAud(item.price)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No item details</p>
            )}
            <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span>{fmtAud(selected.total)}</span>
            </div>
          </section>

          {/* Stripe */}
          {selected.stripe_session_id && (
            <section>
              <p className="text-xs font-semibold text-gray-500 mb-1">Stripe Session</p>
              <p className="text-xs font-mono text-gray-400 break-all">{selected.stripe_session_id}</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
