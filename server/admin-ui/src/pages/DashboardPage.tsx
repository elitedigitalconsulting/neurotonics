import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { api, type OrderStats, type Order } from '../api';
import { StatCard } from '../components/Card';
import { statusBadge } from '../components/Badge';

function fmtAud(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n ?? 0);
}

export default function DashboardPage() {
  const statsQuery = useQuery<{ today: OrderStats['today']; week: OrderStats['week']; month: OrderStats['month']; byStatus: OrderStats['byStatus'] }>({
    queryKey: ['order-stats'],
    queryFn: () => api.get('/cms/orders/stats'),
    refetchInterval: 30_000,
  });

  const recentQuery = useQuery<{ orders: Order[] }>({
    queryKey: ['recent-orders'],
    queryFn: () => api.get('/cms/orders?limit=5'),
  });

  const stats = statsQuery.data;
  const pending = stats?.byStatus?.find((s) => s.status === 'pending')?.count ?? 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>

      {/* Stat cards */}
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

      {/* Recent orders */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Recent Orders</h2>
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
    </div>
  );
}
