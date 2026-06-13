import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Search, Download } from 'lucide-react';
import { api, getAccessToken, type StockistApplication } from '../api';
import { stockistStatusBadge } from '../components/Badge';
import { toast } from '../components/Toast';

const STATUSES = ['', 'new', 'reviewing', 'approved', 'rejected'];

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-AU');
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-AU');
}

export default function StockistPage() {
  const qc = useQueryClient();
  const [page, setPage]               = useState(1);
  const [status, setStatus]           = useState('');
  const [search, setSearch]           = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected]       = useState<StockistApplication | null>(null);
  const [notesInput, setNotesInput]   = useState('');

  const { data, isLoading } = useQuery<{
    applications: StockistApplication[];
    pagination: { pages: number; total: number };
  }>({
    queryKey: ['stockist-applications', page, status, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      return api.get(`/cms/stockist-applications?${params}`);
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const updateMutation = useMutation<
    { application: StockistApplication },
    Error,
    { id: number; status?: string; notes?: string }
  >({
    mutationFn: ({ id, ...body }) =>
      api.patch<{ application: StockistApplication }>(`/cms/stockist-applications/${id}`, body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['stockist-applications'] });
      setSelected(data.application);
      setNotesInput(data.application.notes);
      toast('Application updated');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  function openDetail(app: StockistApplication) {
    setSelected(app);
    setNotesInput(app.notes);
  }

  async function downloadCsv() {
    try {
      const token = getAccessToken();
      const res = await fetch('/cms/stockist-applications/export.csv', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) { toast('CSV export failed', 'error'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stockist-applications-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('CSV export failed', 'error');
    }
  }

  return (
    <div className="flex h-full">
      {/* List panel */}
      <div className="flex-1 p-6 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Stockist Applications</h1>
            <p className="text-sm text-gray-400 mt-0.5">{data?.pagination?.total ?? 0} total</p>
          </div>
          <button
            onClick={downloadCsv}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search by name, business or email…"
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
              <option key={s} value={s}>
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All statuses'}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left font-medium">#</th>
                <th className="px-5 py-3 text-left font-medium">Business</th>
                <th className="px-5 py-3 text-left font-medium">Contact</th>
                <th className="px-5 py-3 text-left font-medium">Industry</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-left font-medium">Date</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-400">Loading…</td>
                </tr>
              )}
              {data?.applications?.map((app) => (
                <tr
                  key={app.id}
                  className={`hover:bg-gray-50 cursor-pointer ${selected?.id === app.id ? 'bg-blue-50' : ''}`}
                  onClick={() => openDetail(app)}
                >
                  <td className="px-5 py-3 text-gray-400">#{app.id}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{app.business_name || '—'}</p>
                    <p className="text-xs text-gray-400">{app.abn}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-gray-900">{app.full_name}</p>
                    <p className="text-xs text-gray-400">{app.email}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{app.industry || '—'}</td>
                  <td className="px-5 py-3">{stockistStatusBadge(app.status)}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{fmtDate(app.created_at)}</td>
                  <td className="px-5 py-3 text-gray-300">
                    <ChevronRight size={16} />
                  </td>
                </tr>
              ))}
              {!isLoading && !data?.applications?.length && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                    No applications found
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {(data?.pagination?.pages ?? 0) > 1 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="disabled:opacity-30"
              >
                ← Prev
              </button>
              <span>Page {page} of {data?.pagination?.pages}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (data?.pagination?.pages ?? 1)}
                className="disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-96 border-l border-gray-200 bg-white p-6 overflow-y-auto">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-semibold text-gray-900">{selected.business_name}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{fmtDateTime(selected.created_at)}</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Status */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Status</p>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selected.status}
              onChange={(e) =>
                updateMutation.mutate({ id: selected.id, status: e.target.value, notes: notesInput })
              }
            >
              {['new', 'reviewing', 'approved', 'rejected'].map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Contact */}
          <section className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Contact</p>
            <p className="text-sm font-medium text-gray-900">{selected.full_name}</p>
            <a href={`mailto:${selected.email}`} className="text-sm text-blue-600 hover:underline">
              {selected.email}
            </a>
            {selected.phone && (
              <p className="text-sm text-gray-500">{selected.phone}</p>
            )}
          </section>

          {/* Business */}
          <section className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Business</p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">ABN:</span> {selected.abn}
            </p>
            {selected.business_address && (
              <p className="text-sm text-gray-700 mt-0.5">
                <span className="font-medium">Address:</span> {selected.business_address}
              </p>
            )}
            {selected.industry && (
              <p className="text-sm text-gray-700 mt-0.5">
                <span className="font-medium">Industry:</span> {selected.industry}
              </p>
            )}
            {selected.business_website && (
              <p className="text-sm mt-0.5">
                <span className="font-medium text-gray-700">Website:</span>{' '}
                <a
                  href={selected.business_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {selected.business_website}
                </a>
              </p>
            )}
          </section>

          {/* Message */}
          {selected.message && (
            <section className="mb-4">
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Message</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.message}</p>
            </section>
          )}

          {/* Internal notes */}
          <section className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Internal Notes</p>
            <textarea
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Add notes…"
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
            />
            <button
              onClick={() =>
                updateMutation.mutate({ id: selected.id, status: selected.status, notes: notesInput })
              }
              disabled={updateMutation.isPending}
              className="mt-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Save Notes
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
