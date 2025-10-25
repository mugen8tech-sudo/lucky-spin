'use client';

import { useAdminKey } from '../../components/useAdminKey';
import { useEffect, useMemo, useState } from 'react';

type Member = { id: string; full_name: string; email?: string; phone?: string; };
type Denom = number;
const fmt = (n:number)=> new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);

type Flash = { kind:'success'|'error', text:string } | null;

export default function MembersPage(){
  const { ready, headers, key } = useAdminKey();
  const [members,setMembers] = useState<Member[]>([]);
  const [mQuery,setMQuery] = useState('');
  const [loadingMembers,setLoadingMembers] = useState(false);

  const [denoms,setDenoms] = useState<Denom[]>([]);
  const [selMember,setSelMember] = useState<string>('');
  const [rows,setRows] = useState<{amount:number; count:number}[]>([{amount:50000, count:1}]);
  const [expiresAt,setExpiresAt] = useState<string>('');
  const [genLoading,setGenLoading] = useState(false);
  const [generated,setGenerated] = useState<{code:string}[]>([]);
  const [memForm,setMemForm]= useState({ fullName:'', phone:'', email:''});
  const [memLoading,setMemLoading]= useState(false);
  const [flash,setFlash]= useState<Flash>(null);

  useEffect(()=> {
    if(!ready || !key) return;
    const controller = new AbortController();
    setLoadingMembers(true);
    fetch(`/api/admin/members?limit=200&q=${encodeURIComponent(mQuery)}`, { headers, signal: controller.signal })
      .then(r=>r.json())
      .then(d=>{ if(d?.ok) setMembers(d.members); else setFlash({kind:'error', text:d?.error || 'Gagal memuat member'}); })
      .catch(()=>{})
      .finally(()=> setLoadingMembers(false));
    return ()=> controller.abort();
  }, [ready, key, mQuery]);

  useEffect(()=> {
    if(!ready || !key) return;
    fetch('/api/admin/denominations', { headers })
      .then(r=>r.json()).then(d=> { if(d?.ok) setDenoms(d.amounts as number[]); });
  }, [ready, key]);

  const canGenerate = useMemo(()=> selMember && rows.every(r => r.amount>0 && r.count>0), [selMember, rows]);

  async function addMember(e: React.FormEvent){
    e.preventDefault();
    if(!memForm.fullName.trim()) return;
    setMemLoading(true);
    setFlash(null);
    const res = await fetch('/api/admin/members', {
      method:'POST', headers, body: JSON.stringify({
        fullName:memForm.fullName.trim(),
        phone:memForm.phone || null,
        email:memForm.email || null
      })
    });
    const data = await res.json();
    setMemLoading(false);
    if(data?.ok){
      setFlash({kind:'success', text:'Member berhasil dibuat.'});
      setMemForm({fullName:'', phone:'', email:''});
      const mres = await fetch(`/api/admin/members?limit=200`, { headers });
      const md = await mres.json();
      if(md?.ok) setMembers(md.members);
      setSelMember(data.member.id);
    } else {
      setFlash({kind:'error', text:`Gagal: ${data?.error || res.status}`});
    }
  }

  async function generate(){
    if(!canGenerate) return;
    setGenLoading(true);
    setGenerated([]);
    setFlash(null);
    try {
      const out: {code:string}[] = [];
      for (const r of rows){
        const body:any = { memberId: selMember, amount: r.amount, count: r.count };
        if (expiresAt) body.expiresAt = expiresAt;
        const res = await fetch('/api/admin/vouchers/batch', { method:'POST', headers, body: JSON.stringify(body) });
        const data = await res.json();
        if(!data?.ok){ throw new Error(data?.error || 'Batch gagal'); }
        out.push(...(data.vouchers as any[]).map(v=>({code: v.code})));
      }
      setGenerated(out);
      setFlash({kind:'success', text:`Sukses membuat ${out.length} kode.`});
    } catch (e:any) {
      setFlash({kind:'error', text:`Gagal: ${e.message || e}`});
    } finally { setGenLoading(false); }
  }

  function addRow(){ setRows(rs => [...rs, {amount: denoms[0] || 50000, count:1}]); }
  function updateRow(i:number, patch: Partial<{amount:number; count:number}>){
    setRows(rs => rs.map((r,idx) => idx===i ? {...r, ...patch} : r));
  }
  function removeRow(i:number){ setRows(rs => rs.filter((_,idx) => idx!==i)); }
  function copyAll(){ navigator.clipboard.writeText(generated.map(g=>g.code).join('\n')); setFlash({kind:'success', text:'Semua kode tersalin ke clipboard.'}); }

  if(!ready) return <div>Loading…</div>;
  if(!key) return <div className="alert alert-error">Masukkan Admin Key dulu di bar atas.</div>;

  return (
    <main>
      <h1 style={{marginBottom:12}}>Member & Batch Voucher</h1>
      {flash && <div className={`alert ${flash.kind==='success'?'alert-success':'alert-error'}`}>{flash.text}</div>}

      <section className="grid-2">
        <div className="card">
          <h2>Daftarkan Member</h2>
          <form onSubmit={addMember} style={{display:'grid', gap:8, marginTop:8}}>
            <label>Nama Lengkap
              <input className="input" required value={memForm.fullName} onChange={e=>setMemForm({...memForm, fullName:e.target.value})} />
            </label>
            <label>No. HP
              <input className="input" value={memForm.phone} onChange={e=>setMemForm({...memForm, phone:e.target.value})} />
            </label>
            <label>Email
              <input className="input" type="email" value={memForm.email} onChange={e=>setMemForm({...memForm, email:e.target.value})} />
            </label>
            <button className="btn btn-primary" disabled={memLoading} style={{marginTop:8}}>
              {memLoading ? 'Menyimpan…' : 'Simpan Member'}
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Generate Voucher</h2>

          <div style={{display:'flex', gap:8, alignItems:'center', margin:'8px 0'}}>
            <input className="input" placeholder="Cari member…" value={mQuery} onChange={e=>setMQuery(e.target.value)} style={{flex:'0 0 40%'}} />
            <span style={{opacity:0.8}}>{loadingMembers ? 'Memuat…' : `${members.length} member`}</span>
          </div>

          <label>Pilih Member
            <select className="select" value={selMember} onChange={e=>setSelMember(e.target.value)} style={{marginTop:4}}>
              <option value="">— pilih —</option>
              {members.map(m=> <option key={m.id} value={m.id}>{m.full_name} {m.email ? `(${m.email})` : ''}</option>)}
            </select>
          </label>

          <div style={{marginTop:12}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h3>Nominal & Jumlah</h3>
              <button className="btn" onClick={addRow}>+ Tambah Baris</button>
            </div>

            {rows.map((r, i)=> (
              <div key={i} style={{display:'flex', gap:8, alignItems:'center', marginTop:8}}>
                <select className="select" value={r.amount} onChange={e=>updateRow(i,{amount:Number(e.target.value)})}>
                  {denoms.map(a => <option key={a} value={a}>{fmt(a)}</option>)}
                </select>
                <input className="input" type="number" min={1} value={r.count} onChange={e=>updateRow(i,{count:Number(e.target.value)})} style={{width:120}} />
                <button className="btn" onClick={()=>removeRow(i)} disabled={rows.length===1}>Hapus</button>
              </div>
            ))}

            <label style={{display:'block', marginTop:12}}>Masa Berlaku (opsional)
              <input className="input" type="datetime-local" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} style={{marginTop:4}} />
            </label>

            <button className="btn btn-primary" disabled={!canGenerate || genLoading} onClick={generate} style={{marginTop:12}}>
              {genLoading ? 'Memproses…' : `Generate (${rows.reduce((s,r)=>s+r.count,0)} kode)`}
            </button>
          </div>

          {generated.length>0 && (
            <div style={{marginTop:16}}>
              <h3>Hasil ({generated.length} kode)</h3>
              <button className="btn" onClick={copyAll} style={{margin:'8px 0'}}>Copy Semua</button>
              <div className="codebox">
                {generated.map((g,idx)=> <div key={idx}>{g.code}</div>)}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
