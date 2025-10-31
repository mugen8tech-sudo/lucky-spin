'use client';

import { useEffect, useMemo, useState } from 'react';

type Denom = {
  id: string;
  amount: number;              // negatif untuk dummy (Plan B)
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

const ADMIN_KEY_LS = 'admin-key'; // sesuaikan jika projekmu pakai key yang berbeda

export default function AllowedDenominationsPage() {
  const [items, setItems] = useState<Denom[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // form tambah
  const [showAddCash, setShowAddCash] = useState(false);
  const [showAddDummy, setShowAddDummy] = useState(false);
  const [formCash, setFormCash] = useState({ amount: '' });
  const [formDummy, setFormDummy] = useState({ label: '', iconUrl: '', isEnabledWheel: true, weight: 1, priority: 0 });

  const adminKey = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem(ADMIN_KEY_LS) ?? '' : ''), []);

  async function fetchItems() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/denominations', {
        headers: { 'x-admin-key': adminKey },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Gagal memuat');
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
    setItems(curr => curr.map(it => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function patchItem(id: string, body: any) {
    setSaving(s => ({ ...s, [id]: true }));
    setError(null);
    try {
      const res = await fetch(`/api/admin/denominations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Gagal menyimpan');
      // sinkronkan state
      setItems(curr => curr.map(it => (it.id === id ? data.item : it)));
    } catch (e: any) {
      setError(e?.message ?? 'Gagal menyimpan');
      // reload baris bila gagal
      fetchItems();
    } finally {
      setSaving(s => ({ ...s, [id]: false }));
    }
  }

  async function addCash() {
    const payload = { type: 'cash', amount: Number(formCash.amount) };
    try {
      const res = await fetch('/api/admin/denominations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Gagal tambah cash');
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
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Gagal tambah dummy');
      setShowAddDummy(false);
      setFormDummy({ label: '', iconUrl: '', isEnabledWheel: true, weight: 1, priority: 0 });
      fetchItems();
    } catch (e: any) {
      alert(e?.message ?? 'Gagal tambah dummy');
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Allowed Denominations</h1>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded bg-slate-800 text-white" onClick={() => setShowAddCash(true)}>
            + Tambah Cash
          </button>
          <button className="px-3 py-2 rounded bg-slate-800 text-white" onClick={() => setShowAddDummy(true)}>
            + Tambah Dummy
          </button>
          <button className="px-3 py-2 rounded border" onClick={fetchItems}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}
      {!adminKey && (
        <div className="p-3 rounded bg-yellow-50 text-yellow-900 text-sm">
          Admin key tidak ditemukan di browser (localStorage). Set dulu dari halaman utama / header ya.
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Memuat…</div>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Label</th>
                <th className="px-3 py-2 text-left">Icon</th>
                <th className="px-3 py-2 text-center">Wheel</th>
                <th className="px-3 py-2 text-center">Generate</th>
                <th className="px-3 py-2 text-center">Weight</th>
                <th className="px-3 py-2 text-center">Priority</th>
                <th className="px-3 py-2 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const savingRow = !!saving[it.id];
                const isDummy = it.is_dummy || it.amount < 0;
                return (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2">{isDummy ? 'Dummy' : 'Cash'}</td>

                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        className="w-32 border rounded px-2 py-1 text-right"
                        value={it.amount}
                        disabled={isDummy || savingRow}
                        onChange={(e) => updateLocal(it.id, { amount: Number(e.target.value) || 0 })}
                      />
                    </td>

                    <td className="px-3 py-2">
                      <input
                        type="text"
                        className="w-52 border rounded px-2 py-1"
                        placeholder={isDummy ? 'cth: Android Bonus' : 'opsional'}
                        value={it.label ?? ''}
                        disabled={savingRow}
                        onChange={(e) => updateLocal(it.id, { label: e.target.value })}
                      />
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className="w-64 border rounded px-2 py-1"
                          placeholder="https://… (opsional)"
                          value={it.icon_url ?? ''}
                          disabled={savingRow}
                          onChange={(e) => updateLocal(it.id, { icon_url: e.target.value })}
                        />
                        {it.icon_url ? <img src={it.icon_url} alt="" className="w-6 h-6 rounded" /> : null}
                      </div>
                    </td>

                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={it.is_enabled_wheel}
                        disabled={savingRow}
                        onChange={(e) => updateLocal(it.id, { is_enabled_wheel: e.target.checked })}
                      />
                    </td>

                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={it.is_enabled_generate}
                        disabled={savingRow || isDummy}
                        onChange={(e) => updateLocal(it.id, { is_enabled_generate: e.target.checked })}
                      />
                    </td>

                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        className="w-20 border rounded px-2 py-1 text-center"
                        value={it.weight}
                        disabled={savingRow}
                        onChange={(e) => updateLocal(it.id, { weight: Number(e.target.value) || 0 })}
                      />
                    </td>

                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        className="w-20 border rounded px-2 py-1 text-center"
                        value={it.priority}
                        disabled={savingRow}
                        onChange={(e) => updateLocal(it.id, { priority: Number(e.target.value) || 0 })}
                      />
                    </td>

                    <td className="px-3 py-2 text-center">
                      <button
                        className="px-3 py-1 rounded bg-slate-800 text-white disabled:opacity-50"
                        disabled={savingRow}
                        onClick={() =>
                          patchItem(it.id, {
                            amount: it.amount, // server akan tolak duplikat cash
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-4 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">Tambah Cash</h2>
            <div className="space-y-2">
              <label className="block text-sm">Amount (Rp)</label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2"
                placeholder="contoh: 10000"
                value={formCash.amount}
                onChange={(e) => setFormCash({ amount: e.target.value })}
              />
              <p className="text-xs text-slate-500">Harus unik dan &gt; 0.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded border" onClick={() => setShowAddCash(false)}>Batal</button>
              <button className="px-3 py-2 rounded bg-slate-800 text-white" onClick={addCash}>Tambah</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Dummy */}
      {showAddDummy && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-4 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">Tambah Dummy</h2>
            <div className="space-y-2">
              <label className="block text-sm">Label</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                placeholder="cth: Android Bonus"
                value={formDummy.label}
                onChange={(e) => setFormDummy(s => ({ ...s, label: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm">Icon URL (opsional)</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                placeholder="https://…"
                value={formDummy.iconUrl}
                onChange={(e) => setFormDummy(s => ({ ...s, iconUrl: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="d-wheel"
                type="checkbox"
                checked={formDummy.isEnabledWheel}
                onChange={(e) => setFormDummy(s => ({ ...s, isEnabledWheel: e.target.checked }))}
              />
              <label htmlFor="d-wheel">Tampilkan di wheel</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm">Weight</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2"
                  value={formDummy.weight}
                  onChange={(e) => setFormDummy(s => ({ ...s, weight: Number(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <label className="block text-sm">Priority</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2"
                  value={formDummy.priority}
                  onChange={(e) => setFormDummy(s => ({ ...s, priority: Number(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded border" onClick={() => setShowAddDummy(false)}>Batal</button>
              <button className="px-3 py-2 rounded bg-slate-800 text-white" onClick={addDummy}>Tambah</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
