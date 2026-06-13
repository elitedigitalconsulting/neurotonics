import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, TrendingUp, Clock, CheckCircle, Package, AlertTriangle } from 'lucide-react';
import { api, type OrderStats, type Order, type Product } from '../api';
import { StatCard } from '../components/Card';
import { statusBadge } from '../components/Badge';
import { NavLink } from 'react-router-dom';

function fmtAud(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n ?? 0);
}

export default function DashboardPage() {
  const statsQuery = useQuery<OrderStats>({
    queryKey: ['order-stats'],
    queryFn: () => api.get('/cms/orders/stats'),
    refetchInterval: 30_000,
  });

  const recentQuery = useQuery<{ orders: Order[] }>({
    queryKey: ['recent-orders'],
    queryFn: () => api.get('/cms/orders?limit=5'),
    refetchInterval: 30_000,
  });

  const productsQuery = useQuery<{ products: Product[] }>({
    queryKey: ['products'],
    queryFn: () => api.get('/cms/products'),
  });

  const stats   = statsQuery.data;
  const pending = stats?.byStatus?.find((s) => s.status === 'pending')?.count ?? 0;
  const totalRevenue = stats?.byStatus
    ?.filter(s => !['failed', 'refunded'].includes(s.status))
    ?.reduce((sum, s) => sum + (s.revenue ?? 0), 0) ?? 0;

  const products   = productsQuery.data?.products ?? [];
  const outOfStock = products.filter(p => p.inStock === false).length;
  const lowStock   = products.filter(p => p.inStock !== false && (p.stockPercent ?? 100) < 20).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <span className="text-xs text-gray-400">Auto-refreshes every 30 s</span>
      </div>

      {/* Stat cards — row 1: orders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Orders today"
          value={stats?.today?.count ?? '—'}
          sub={fmtAud(stats?.today?.revenue ?? 0) + ' revenue'}
          icon={<ShoppingCart size={20} />}
        />
        <StatCard
          label="Orders this week"
          value={stats?.week?.count ?? '—'}
          sub={fmtAud(stats?.week?.revenue ?? 0) + ' revenue'}
          icon={<TrendingUp size={20} />}
        />
        <StatCard
          label="Orders this month"
          value={stats?.month?.count ?? '—'}
          sub={fmtAud(stats?.month?.revenue ?? 0) + ' revenue'}
          icon={<TrendingUp size={20} />}
        />
        <StatCard
          label="Pending orders"
          value={pending}
          sub="Awaiting fulfilment"
          icon={<Clock size={20} />}
        />
      </div>

      {/* Stat cards — row 2: products + revenue */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total revenue"
          value={fmtAud(totalRevenue)}
          sub="All time (excl. refunds)"
          icon={<TrendingUp size={20} />}
        />
        <StatCard
          label="Products"
          value={products.length}
          sub={products.length === 1 ? '1 product listed' : `${products.length} products listed`}
          icon={<Package size={20} />}
        />
        <StatCard
          label="Out of stock"
          value={outOfStock}
          sub={outOfStock > 0 ? 'Need attention' : 'All in stock'}
          icon={<AlertTriangle size={20} />}
        />
        <StatCard
          label="Low stock"
          value={lowStock}
          sub="Below 20% remaining"
          icon={<AlertTriangle size={20} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Recent Orders</h2>
            <NavLink to="/orders" className="text-xs text-blue-600 hover:text-blue-700">View all →</NavLink>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-5 py-3 text-left font-medium">#</th>
                  <th className="px-5 py-3 text-left font-medium">Customer</th>
                  <th className="px-5 py-3 text-left font-medium">Total</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentQuery.data?.orders?.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-400">#{o.id}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{o.customer_name || '—'}</p>
                      <p className="text-xs text-gray-400">{o.customer_email}</p>
                    </td>
                    <td className="px-5 py-3 font-medium">{fmtAud(o.total)}</td>
                    <td className="px-5 py-3">{statusBadge(o.status)}</td>
                    <td className="px-5 py-3 text-gray-400">
                      {new Date(o.created_at).toLocaleDateString('en-AU')}
                    </td>
                  </tr>
                ))}
                {!recentQuery.data?.orders?.length && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                      <CheckCircle size={24} className="mx-auto mb-2 opacity-30" />
                      No orders yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory snapshot */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Inventory</h2>
            <NavLink to="/products" className="text-xs text-blue-600 hover:text-blue-700">Manage →</NavLink>
          </div>
          <div className="divide-y divide-gray-50">
            {products.length === 0 && (
              <p className="px-5 py-6 text-center text-gray-400 text-sm">No products</p>
            )}
            {products.map((p) => (
              <div key={p.slug} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800 truncate mr-2">{p.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    p.inStock === false
                      ? 'bg-red-100 text-red-700'
                      : (p.stockPercent ?? 100) < 20
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                  }`}>
                    {p.inStock === false ? 'Out of stock' : (p.stockPercent ?? 100) < 20 ? 'Low stock' : 'In stock'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        p.inStock === false ? 'bg-red-400' :
                        (p.stockPercent ?? 100) < 20 ? 'bg-amber-400' : 'bg-green-400'
                      }`}
                      style={{ width: `${Math.min(100, p.stockPercent ?? 100)}%` }}
                    />
                  </div>
                  {typeof p.unitsLeft === 'number' && (
                    <span className="text-xs text-gray-400 shrink-0">{p.unitsLeft} left</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Order status breakdown */}
      {stats?.byStatus && stats.byStatus.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Orders by Status</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {stats.byStatus.map((row) => (
              <div key={row.status} className="text-center">
                <p className="text-2xl font-bold text-gray-900">{row.count}</p>
                <div className="mt-1">{statusBadge(row.status)}</div>
                <p className="text-xs text-gray-400 mt-1">{fmtAud(row.revenue ?? 0)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
