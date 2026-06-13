import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Search, Truck, CheckCircle, Send } from 'lucide-react';
import { api, type Order } from '../api';
import { toast } from '../components/Toast';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmtAud = (n: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n || 0);

const fmtDate = (s: string) =>
  s ? new Date(s + (s.includes('Z') ? '' : 'Z')).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function StatusBadge({ status }: { status: Order['status'] }) {
  const map: Record<string, string> = {
    pending:    'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    fulfilled:  'bg-green-100 text-green-800',
    refunded:   'bg-purple-100 text-purple-800',
    failed:     'bg-red-100 text-red-800',
    cancelled:  'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}


// ---------------------------------------------------------------------------
// Order Detail View
// ---------------------------------------------------------------------------
function OrderDetail({ order: initial, onBack }: { order: Order; onBack: () => void }) {
  const qc = useQueryClient();
  const [order, setOrder] = useState(initial);
  const [showFulfill, setShowFulfill] = useState(false);
  const [tracking, setTracking] = useState(order.tracking_number || '');
  const [carrier, setCarrier] = useState(order.carrier || '');
  const [fulfillNotes, setFulfillNotes] = useState(order.fulfillment_notes || '');
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [notes, setNotes] = useState(order.notes || '');
  const [adminNotes, setAdminNotes] = useState(order.admin_notes || '');
  const [savingNotes, setSavingNotes] = useState(false);

  const { data: fresh } = useQuery({
    queryKey: ['order', order.id],
    queryFn: () => api.get<{ order: Order }>(`/cms/orders/${order.id}`).then(r => r.order),
    refetchInterval: 30000,
  });
  const liveOrder = fresh ?? order;

  const statusMut = useMutation({
    mutationFn: (status: string) => api.patch<{ order: Order }>(`/cms/orders/${order.id}/status`, { status }),
    onSuccess: (data) => { setOrder(data.order); qc.invalidateQueries({ queryKey: ['orders'] }); toast('Status updated'); },
    onError: () => toast('Failed to update status', 'error'),
  });

  const fulfillMut = useMutation({
    mutationFn: () => api.post<{ order: Order }>(`/cms/orders/${order.id}/fulfill`, {
      tracking_number: tracking, carrier, fulfillment_notes: fulfillNotes, notify_customer: notifyCustomer,
    }),
    onSuccess: (data) => {
      setOrder(data.order);
      setShowFulfill(false);
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast(notifyCustomer ? 'Order fulfilled — customer notified' : 'Order fulfilled');
    },
    onError: () => toast('Failed to fulfill order', 'error'),
  });

  async function saveNotes() {
    setSavingNotes(true);
    try {
      const data = await api.patch<{ order: Order }>(`/cms/orders/${order.id}/notes`, { notes, admin_notes: adminNotes });
      setOrder(data.order);
      toast('Notes saved');
    } catch { toast('Failed to save notes', 'error'); }
    finally { setSavingNotes(false); }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{liveOrder.order_number || `Order #${liveOrder.id}`}</h1>
          <p className="text-sm text-gray-500">{fmtDate(liveOrder.created_at)}</p>
        </div>
        <StatusBadge status={liveOrder.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Order items */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Order Items</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-2 text-gray-600 font-medium">Product</th>
                  <th className="text-center pb-2 text-gray-600 font-medium">Qty</th>
                  <th className="text-right pb-2 text-gray-600 font-medium">Price</th>
                  <th className="text-right pb-2 text-gray-600 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(liveOrder.items) ? liveOrder.items : []).map((item, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 text-gray-900">{item.name || '—'}</td>
                    <td className="py-2.5 text-center text-gray-600">{item.quantity || 1}</td>
                    <td className="py-2.5 text-right text-gray-600">{fmtAud(item.price || 0)}</td>
                    <td className="py-2.5 text-right font-medium">{fmtAud((item.price || 0) * (item.quantity || 1))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {liveOrder.subtotal > 0 && (
                  <tr>
                    <td colSpan={3} className="pt-3 text-right text-gray-600">Subtotal</td>
                    <td className="pt-3 text-right">{fmtAud(liveOrder.subtotal)}</td>
                  </tr>
                )}
                {liveOrder.shipping && typeof liveOrder.shipping === 'object' && (liveOrder.shipping as any).fee > 0 && (
                  <tr>
                    <td colSpan={3} className="text-right text-gray-600">Shipping ({(liveOrder.shipping as any).name || 'Standard'})</td>
                    <td className="text-right">{fmtAud((liveOrder.shipping as any).fee)}</td>
                  </tr>
                )}
                <tr className="border-t border-gray-200">
                  <td colSpan={3} className="pt-3 text-right font-semibold">Total</td>
                  <td className="pt-3 text-right font-bold text-lg">{fmtAud(liveOrder.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Fulfillment */}
          {liveOrder.status === 'fulfilled' ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h2 className="font-semibold text-green-900">Fulfilled {liveOrder.fulfillment_date ? `— ${fmtDate(liveOrder.fulfillment_date)}` : ''}</h2>
              </div>
              {liveOrder.tracking_number && (
                <div className="text-sm space-y-1">
                  {liveOrder.carrier && <p><span className="font-medium">Carrier:</span> {liveOrder.carrier}</p>}
                  <p><span className="font-medium">Tracking:</span> {liveOrder.tracking_number}</p>
                </div>
              )}
              {liveOrder.fulfillment_notes && <p className="text-sm mt-2 text-green-800">{liveOrder.fulfillment_notes}</p>}
            </div>
          ) : liveOrder.status !== 'failed' && liveOrder.status !== 'cancelled' && liveOrder.status !== 'refunded' ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Truck className="w-4 h-4" /> Fulfillment</h2>
                {!showFulfill && (
                  <button
                    onClick={() => setShowFulfill(true)}
                    className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors"
                  >
                    Mark as Fulfilled
                  </button>
                )}
              </div>
              {showFulfill && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Tracking Number</label>
                      <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="e.g. EW123456789AU"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Carrier</label>
                      <input value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="e.g. Australia Post"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Notes to Customer (optional)</label>
                    <input value={fulfillNotes} onChange={e => setFulfillNotes(e.target.value)} placeholder="e.g. Dispatched from Sydney warehouse"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={notifyCustomer} onChange={e => setNotifyCustomer(e.target.checked)}
                      className="rounded accent-blue-600" />
                    Send shipping notification email to customer
                  </label>
                  <div className="flex gap-2">
                    <button onClick={() => fulfillMut.mutate()} disabled={fulfillMut.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                      <Send className="w-4 h-4" />
                      {fulfillMut.isPending ? 'Fulfilling…' : 'Confirm Fulfillment'}
                    </button>
                    <button onClick={() => setShowFulfill(false)} className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Notes</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Customer Notes (visible to customer)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes about this order…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Internal Notes (admin only)</label>
                <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={2} placeholder="Internal notes…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <button onClick={saveNotes} disabled={savingNotes}
                className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors">
                {savingNotes ? 'Saving…' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Status management */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Order Status</h3>
            <div className="space-y-2">
              {(['pending','processing','fulfilled','cancelled','refunded'] as const).map(s => (
                <button key={s} onClick={() => statusMut.mutate(s)} disabled={liveOrder.status === s || statusMut.isPending}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${liveOrder.status === s ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200' : 'hover:bg-gray-50 text-gray-700'}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                  {liveOrder.status === s && ' ✓'}
                </button>
              ))}
            </div>
          </div>

          {/* Customer info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Customer</h3>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-gray-900">{liveOrder.customer_name || '—'}</p>
              {liveOrder.customer_email && (
                <a href={`mailto:${liveOrder.customer_email}`} className="text-blue-600 hover:underline block">{liveOrder.customer_email}</a>
              )}
              {liveOrder.customer_phone && <p className="text-gray-600">{liveOrder.customer_phone}</p>}
            </div>
          </div>

          {/* Shipping address */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Shipping Address</h3>
            <div className="text-sm text-gray-600 space-y-0.5">
              {liveOrder.shipping_address && typeof liveOrder.shipping_address === 'object' ? (
                <>
                  {liveOrder.shipping_address.fullName && <p className="font-medium text-gray-900">{liveOrder.shipping_address.fullName}</p>}
                  {liveOrder.shipping_address.address1 && <p>{liveOrder.shipping_address.address1}</p>}
                  {liveOrder.shipping_address.address2 && <p>{liveOrder.shipping_address.address2}</p>}
                  <p>{[liveOrder.shipping_address.city, liveOrder.shipping_address.state, liveOrder.shipping_address.postcode].filter(Boolean).join(' ')}</p>
                  {liveOrder.shipping_address.country && <p>{liveOrder.shipping_address.country}</p>}
                </>
              ) : <p>No address on file</p>}
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Payment</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <span className={`font-medium ${liveOrder.payment_status === 'paid' ? 'text-green-600' : 'text-red-600'}`}>
                  {(liveOrder.payment_status || 'unknown').charAt(0).toUpperCase() + (liveOrder.payment_status || 'unknown').slice(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total</span>
                <span className="font-semibold">{fmtAud(liveOrder.total)}</span>
              </div>
              {liveOrder.stripe_session_id && (
                <p className="text-xs text-gray-400 break-all mt-2">{liveOrder.stripe_session_id}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders List View
// ---------------------------------------------------------------------------
export default function OrdersPage() {
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const [page, setPage]           = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      return api.get<{ orders: Order[]; pagination: { total: number; pages: number } }>(`/cms/orders?${params}`);
    },
    staleTime: 15000,
  });

  const { data: stats } = useQuery({
    queryKey: ['order-stats'],
    queryFn: () => api.get<{ byStatus: Array<{ status: string; count: number; revenue: number }>; allTime: { count: number; revenue: number } }>('/cms/orders/stats'),
    staleTime: 30000,
  });

  if (selectedOrder) {
    return <OrderDetail order={selectedOrder} onBack={() => { setSelectedOrder(null); qc.invalidateQueries({ queryKey: ['orders'] }); }} />;
  }

  const allTime = stats?.allTime;
  const statusCounts = Object.fromEntries((stats?.byStatus || []).map(r => [r.status, r.count]));

  const TABS = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Processing', value: 'processing' },
    { label: 'Fulfilled', value: 'fulfilled' },
    { label: 'Cancelled', value: 'cancelled' },
    { label: 'Failed', value: 'failed' },
  ];

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Orders', value: allTime?.count ?? 0, isCount: true },
          { label: 'Total Revenue', value: allTime?.revenue ?? 0, isCount: false },
          { label: 'Processing', value: statusCounts['processing'] ?? 0, isCount: true },
          { label: 'Fulfilled', value: statusCounts['fulfilled'] ?? 0, isCount: true },
        ].map(({ label, value, isCount }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-900">
              {isCount ? value : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value as number)}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4">
        <div className="flex gap-1 p-2 border-b border-gray-100 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.value} onClick={() => { setStatus(t.value); setPage(1); }}
              className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${statusFilter === t.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
              {t.label}
              {t.value && statusCounts[t.value] ? ` (${statusCounts[t.value]})` : ''}
            </button>
          ))}
        </div>
        <div className="p-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, email or order number…"
            className="flex-1 text-sm outline-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading orders…</div>
        ) : !data?.orders.length ? (
          <div className="p-12 text-center text-gray-400">No orders found.</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Order</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Items</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.orders.map(order => (
                  <tr key={order.id} onClick={() => setSelectedOrder(order)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-blue-600">{order.order_number || `#${order.id}`}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-[150px]">{order.customer_name || '—'}</p>
                      <p className="text-gray-500 text-xs truncate max-w-[150px]">{order.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {Array.isArray(order.items) ? order.items.map((i: any) => `${i.name} x${i.quantity || 1}`).join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{fmtAud(order.total)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{fmtDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination */}
            {data.pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">Page {page} of {data.pagination.pages} ({data.pagination.total} orders)</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">← Prev</button>
                  <button onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))} disabled={page === data.pagination.pages}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">Next →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
