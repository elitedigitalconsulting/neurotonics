import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, X, Save } from 'lucide-react';
import { api, type User } from '../api';
import { toast } from '../components/Toast';
import { Badge } from '../components/Badge';

export default function UsersPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);

  const { data, isLoading } = useQuery<{ users: User[] }>({
    queryKey: ['users'],
    queryFn: () => api.get('/cms/users'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cms/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast('User deleted');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Users</h1>
        <button
          onClick={() => { setEditUser(null); setModal('create'); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
        >
          <Plus size={16} /> Add user
        </button>
      </div>

      {isLoading && <p className="text-gray-400 text-sm">Loading…</p>}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left font-medium">Name / Email</th>
              <th className="px-5 py-3 text-left font-medium">Role</th>
              <th className="px-5 py-3 text-left font-medium">Created</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data?.users?.map((u) => (
              <tr key={u.id}>
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900">{u.name || '—'}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </td>
                <td className="px-5 py-3">
                  <Badge variant={u.role === 'admin' ? 'blue' : 'gray'}>{u.role}</Badge>
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('en-AU') : '—'}
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setEditUser(u); setModal('edit'); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete ${u.email}?`)) deleteMutation.mutate(u.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <UserModal
          user={editUser}
          onClose={() => setModal(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['users'] });
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function UserModal({ user, onClose, onSaved }: {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;

  const createMutation = useMutation({
    mutationFn: (data: { email: string; password: string; role: string; name: string }) =>
      api.post('/cms/users', data),
    onSuccess: () => { toast(isEdit ? 'User updated' : 'User created'); onSaved(); },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { email: string; role: string; name: string }) =>
      api.patch(`/cms/users/${user?.id}`, data),
    onSuccess: () => { toast('User updated'); onSaved(); },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      email:    String(fd.get('email')    ?? ''),
      name:     String(fd.get('name')     ?? ''),
      role:     String(fd.get('role')     ?? 'editor'),
      password: String(fd.get('password') ?? ''),
    };
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Edit User' : 'New User'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Name">
            <input name="name" className="input w-full" defaultValue={user?.name ?? ''} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" required className="input w-full" defaultValue={user?.email ?? ''} />
          </Field>
          {!isEdit && (
            <Field label="Password">
              <input name="password" type="password" required minLength={8} className="input w-full" placeholder="Min. 8 characters" />
            </Field>
          )}
          <Field label="Role">
            <select name="role" defaultValue={user?.role ?? 'editor'} className="input w-full">
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              <Save size={15} />
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
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
