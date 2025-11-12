'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminHeaders, getSuperKey, SUPER_KEY_LS } from 'lib/client-auth';

type Denom = {
  id: string;
  amount: number; // negatif untuk dummy (Plan B)
  is_dummy: boolean;
  label: string | null;
  icon_url: string | null;
  is_enabled_wheel: boolean;
  is_enabled_generate: boolean;
  weight: number;
  priority: number;
  created_at: string;
  updated_at: string;
};

export default function AllowedDenominationsPage() {
  const [items, setItems] = useState<Denom[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // modal tambah
  const [showAddCash, setShowAddCash] = useState(false);
  const [showAddDummy, setShowAddDummy] = useState(false);
  const [formCash, setFormCash] = useState({ amount: '' });
  const [formDummy, setFormDummy] = useState({
    label: '',
    iconUrl: '',
    isEnabledWheel: true,
    weight: 1,
    priority: 0,
  });

  // Super Key local UI
  const [superKey, setSuperKey] = useState('');
  useEffect(() => {
    setSuperKey(getSuperKey());
  }, []);

  const hasAdminKey = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      !!localStorage.getItem('admin-key') ||
      !!localStorage.getItem('ADMIN_KEY') ||
      !!localStorage.getItem('x-admin-key')
    );
  }, []);

  async function fetchItems() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/denominations', {
        headers: adminHeaders(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(
          res.status === 401
            ? '401: Forbidden (Super Key salah / belum di-set)'
            : data?.error || 'Gagal memuat'
        );
      }
      setItems(data.items as Denom[]);
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateLocal(id: string, patch: Partial<Denom>) {
    setItems((curr) =>
      curr.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  }

  async function patchItem(id: string, body: any) {
    setSaving((s) => ({ ...s, [id]: true }));
    setError(null);
    try {
      const res = await fetch(`/api/admin/denominations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...adminHeaders(),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok)
        throw new Error(data?.error || 'Gagal menyimpan');
      setItems((curr) =>
        curr.map((it) => (it.id === id ? data.item : it))
      );
    } catch (e: any) {
      setError(e?.message ?? 'Gagal menyimpan');
      fetchItems(); // rollback
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  }

  async function addCash() {
    const payload = { type: 'cash', amount: Number(formCash.amount) };
    try {
      const res = await fetch('/api/admin/denominations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...adminHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok)
        throw new Error(data?.error || 'Gagal tambah cash');
      setShowAddCash(false);
      setFormCash({ amount: '' });
      fetchItems();
    } catch (e: any) {
      alert(e?.message ?? 'Gagal tambah cash');
    }
  }

  async function addDummy() {
    const payload = {
      type: 'dummy',
      label: formDummy.label || null,
      iconUrl: formDummy.iconUrl || null,
      isEnabledWheel: !!formDummy.isEnabledWheel,
      weight: Number(formDummy.weight) || 1,
      priority: Number(formDummy.priority) || 0,
    };
    try {
      const res = await fetch('/api/admin/denominations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...adminHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok)
        throw new Error(data?.error || 'Gagal tambah dummy');
      setShowAddDummy(false);
      setFormDummy({
        label: '',
        iconUrl: '',
        isEnabledWheel: true,
        weight: 1,
        priority: 0,
      });
      fetchItems();
    } catch (e: any) {
      alert(e?.message ?? 'Gagal tambah dummy');
    }
  }

  function saveSuperKeyLocal(v: string) {
    localStorage.setItem(SUPER_KEY_LS, v);
    setSuperKey(v);
  }

  const inputBase =
    'border border-slate-700 bg-slate-900/60 text-slate-100 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-500';

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Allowed Denominations
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white text-sm"
            onClick={() => setShowAddCash(true)}
          >
            + Tambah Cash
          </button>
          <button
            className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white text-sm"
            onClick={() => setShowAddDummy(true)}
          >
            + Tambah Dummy
          </button>
          <button
            className="px-3 py-2 rounded border border-slate-700 text-sm hover:bg-slate-800/60"
            onClick={fetchItems}
          >
            Refresh
          </button>
        </div>
      </div>

      {!hasAdminKey && (
        <div className="p-3 rounded border border-yellow-400/40 bg-yellow-500/10 text-yellow-100 text-xs">
          Admin Key belum ditemukan di browser. Set dulu dari header.
        </div>
      )}

      <div className="rounded border border-slate-700 bg-slate-900/60 px-3 py-2 inline-flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-200 text-xs">Super Key:</span>
        <input
          type="password"
          className={`${inputBase} w-64`}
          value={superKey}
          onChange={(e) => setSuperKey(e.target.value)}
        />
        <button
          className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs"
          onClick={() => saveSuperKeyLocal(superKey)}
        >
          Simpan
        </button>
        <button
          className="px-3 py-1 rounded border border-slate-700 text-xs hover:bg-slate-800/70"
          onClick={() => saveSuperKeyLocal('')}
        >
          Hapus
        </button>
      </div>

      {error && (
        <div className="p-3 rounded border border-red-500/40 bg-red-500/10 text-red-100 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400">Memuat…</div>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-800 bg-slate-950/60 shadow-sm">
          <table className="min-w-full text-xs border-collapse">
            <thead className="bg-slate-900/90 text-slate-100 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 text-left font-medium">Label</th>
                <th className="px-3 py-2 text-left font-medium">Icon</th>
                <th className="px-3 py-2 text-center font-medium">Wheel</th>
                <th className="px-3 py-2 text-center font-medium">
                  Wheel Generate
                </th>
                <th className="px-3 py-2 text-center font-medium">Weight</th>
                <th className="px-3 py-2 text-center font-medium">Priority</th>
                <th className="px-3 py-2 text-center font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const savingRow = !!saving[it.id];
                const isDummy = it.is_dummy || it.amount < 0;
                const rowBg =
                  idx % 2 === 0
                    ? 'bg-slate-900/50'
                    : 'bg-slate-900/30';

                return (
                  <tr
                    key={it.id}
                    className={`${rowBg} border-t border-slate-800 hover:bg-slate-800/80 transition-colors`}
                  >
                    <td className="px-3 py-2 text-slate-100 align-middle whitespace-nowrap">
                      {isDummy ? 'Dummy' : 'Cash'}
                    </td>

                    <td className="px-3 py-2 text-right align-middle">
                      <input
                        type="number"
                        className={`${inputBase} w-32 text-right`}
                        value={it.amount}
                        disabled={isDummy || savingRow}
                        onChange={(e) =>
                          updateLocal(it.id, {
                            amount: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </td>

                    <td className="px-3 py-2 align-middle">
                      <input
                        type="text"
                        className={`${inputBase} w-52`}
                        placeholder={
                          isDummy ? 'cth: Android Bonus' : 'opsional'
                        }
                        value={it.label ?? ''}
                        disabled={savingRow}
                        onChange={(e) =>
                          updateLocal(it.id, { label: e.target.value })
                        }
                      />
                    </td>

                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className={`${inputBase} w-64`}
                          placeholder="https://… (opsional)"
                          value={it.icon_url ?? ''}
                          disabled={savingRow}
                          onChange={(e) =>
                            updateLocal(it.id, {
                              icon_url: e.target.value,
                            })
                          }
                        />
                        {it.icon_url ? (
                          <img
                            src={it.icon_url}
                            alt=""
                            className="w-6 h-6 rounded border border-slate-700 object-cover"
                          />
                        ) : null}
                      </div>
                    </td>

                    <td className="px-3 py-2 text-center align-middle">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-sky-500"
                        checked={it.is_enabled_wheel}
                        disabled={savingRow}
                        onChange={(e) =>
                          updateLocal(it.id, {
                            is_enabled_wheel: e.target.checked,
                          })
                        }
                      />
                    </td>

                    <td className="px-3 py-2 text-center align-middle">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-sky-500"
                        checked={it.is_enabled_generate}
                        disabled={savingRow || isDummy}
                        onChange={(e) =>
                          updateLocal(it.id, {
                            is_enabled_generate: e.target.checked,
                          })
                        }
                      />
                    </td>

                    <td className="px-3 py-2 text-center align-middle">
                      <input
                        type="number"
                        className={`${inputBase} w-20 text-center`}
                        value={it.weight}
                        disabled={savingRow}
                        onChange={(e) =>
                          updateLocal(it.id, {
                            weight: Number(e.target.value) || 1,
                          })
                        }
                      />
                    </td>

                    <td className="px-3 py-2 text-center align-middle">
                      <input
                        type="number"
                        className={`${inputBase} w-20 text-center`}
                        value={it.priority}
                        disabled={savingRow}
                        onChange={(e) =>
                          updateLocal(it.id, {
                            priority: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </td>

                    <td className="px-3 py-2 text-center align-middle">
                      <button
                        className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={savingRow}
                        onClick={() =>
                          patchItem(it.id, {
                            amount: it.amount,
                            label: it.label ?? null,
                            iconUrl: it.icon_url ?? null,
                            isEnabledWheel: it.is_enabled_wheel,
                            isEnabledGenerate: it.is_enabled_generate,
                            weight: it.weight,
                            priority: it.priority,
                          })
                        }
                      >
                        {savingRow ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Tambah Cash */}
      {showAddCash && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-20">
          <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 w-full max-w-md space-y-4 shadow-xl">
            <h2 className="text-lg font-semibold">Tambah Cash</h2>
            <div className="space-y-2 text-sm">
              <label className="block text-xs text-slate-300">
                Amount (Rp)
              </label>
              <input
                type="number"
                className={`${inputBase} w-full px-3 py-2`}
                placeholder="contoh: 10000"
                value={formCash.amount}
                onChange={(e) =>
                  setFormCash({ amount: e.target.value })
                }
              />
              <p className="text-[11px] text-slate-400">
                Harus unik dan &gt; 0.
              </p>
            </div>
            <div className="flex justify-end gap-2 text-sm">
              <button
                className="px-3 py-2 rounded border border-slate-700 hover:bg-slate-800/70"
                onClick={() => setShowAddCash(false)}
              >
                Batal
              </button>
              <button
                className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white"
                onClick={addCash}
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Dummy */}
      {showAddDummy && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-20">
          <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 w-full max-w-md space-y-4 shadow-xl">
            <h2 className="text-lg font-semibold">Tambah Dummy</h2>
            <div className="space-y-2 text-sm">
              <label className="block text-xs text-slate-300">
                Label
              </label>
              <input
                type="text"
                className={`${inputBase} w-full px-3 py-2`}
                placeholder="cth: Android Bonus"
                value={formDummy.label}
                onChange={(e) =>
                  setFormDummy((s) => ({
                    ...s,
                    label: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 text-sm">
              <label className="block text-xs text-slate-300">
                Icon URL (opsional)
              </label>
              <input
                type="text"
                className={`${inputBase} w-full px-3 py-2`}
                placeholder="https://…"
                value={formDummy.iconUrl}
                onChange={(e) =>
                  setFormDummy((s) => ({
                    ...s,
                    iconUrl: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <input
                id="d-wheel"
                type="checkbox"
                className="h-4 w-4 accent-sky-500"
                checked={formDummy.isEnabledWheel}
                onChange={(e) =>
                  setFormDummy((s) => ({
                    ...s,
                    isEnabledWheel: e.target.checked,
                  }))
                }
              />
              <label
                htmlFor="d-wheel"
                className="text-slate-200 text-xs"
              >
                Tampilkan di wheel
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs text-slate-300">
                  Weight
                </label>
                <input
                  type="number"
                  className={`${inputBase} w-full px-3 py-2`}
                  value={formDummy.weight}
                  onChange={(e) =>
                    setFormDummy((s) => ({
                      ...s,
                      weight: Number(e.target.value) || 1,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300">
                  Priority
                </label>
                <input
                  type="number"
                  className={`${inputBase} w-full px-3 py-2`}
                  value={formDummy.priority}
                  onChange={(e) =>
                    setFormDummy((s) => ({
                      ...s,
                      priority: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 text-sm">
              <button
                className="px-3 py-2 rounded border border-slate-700 hover:bg-slate-800/70"
                onClick={() => setShowAddDummy(false)}
              >
                Batal
              </button>
              <button
                className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white"
                onClick={addDummy}
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
