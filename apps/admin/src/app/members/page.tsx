'use client';

import { useAdminKey } from '../../components/useAdminKey';
import { useEffect, useMemo, useState } from 'react';

type Member = { id: string; full_name: string; email?: string; phone?: string; };
type Denom = number;
const fmt = (n:number)=> new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);

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
  const [msg,setMsg]= useState<string>('');

  useEffect(()=> {
    if(!ready || !key) return;
    const controller = new AbortController();
    setLoadingMembers(true);
    fetch(`/api/admin/members?limit=200&q=${encodeURIComponent(mQuery)}`, { headers, signal: controller.signal })
      .then(r=>r.json()).then(d=>{ if(d?.ok) setMembers(d.members); })
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
    setMsg('');
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
      setMsg('Member berhasil dibuat.');
      setMemForm({fullName:'', phone:'', email:''});
      const mres = await fetch(`/api/admin/members?limit=200`, { headers });
      const md = await mres.json();
      if(md?.ok) setMembers(md.members);
      setSelMember(data.member.id);
    } else {
      setMsg(`Gagal: ${data?.error || res.status}`);
    }
  }

  async function generate(){
    if(!canGenerate) return;
    setGenLoading(true);
    setGenerated([]);
    setMsg('');
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
      setMsg(`Sukses membuat ${out.length} kode.`);
    } catch (e:any) {
      setMsg(`Gagal: ${e.message || e}`);
    } finally { setGenLoading(false); }
  }

  function addRow(){ setRows(rs => [...rs, {amount: denoms[0] || 50000, count:1}]); }
  function updateRow(i:number, patch: Partial<{amount:number; count:number}>){
    setRows(rs => rs.map((r,idx) => idx===i ? {...r, ...patch} : r));
  }
  function removeRow(i:number){ setRows(rs => rs.filter((_,idx) => idx!==i)); }
  function copyAll(){ navigator.clipboard.writeText(generated.map(g=>g.code).join('\n')); setMsg('Semua kode tersalin ke clipboard.'); }

  if(!ready) return <div>Loading…</div>;
  if(!key) return <div>Masukkan Admin Key dulu di bar atas.</div>;

  return (
    <main>
      <h1 style={{marginBottom:12}}>Member & Batch Voucher</h1>
      {msg && <div style={{background:'#14532d', color:'#dcfce7', padding:8, borderRadius:6, marginBottom:12}}>{msg}</div>}

      <section style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
        <div style={{border:'1px solid #334155', borderRadius:8, padding:16}}>
          <h2>Daftarkan Member</h2>
          <form onSubmit={addMember} style={{display:'grid', gap:8, marginTop:8}}>
            <label>Nama Lengkap
              <input required value={memForm.fullName} onChange={e=>setMemForm({...memForm, fullName:e.target.value})} style={{width:'100%', padding:8, marginTop:4}} />
            </label>
            <label>No. HP
              <input value={memForm.phone} onChange={e=>setMemForm({...memForm, phone:e.target.value})} style={{width:'100%', padding:8, marginTop:4}} />
            </label>
            <label>Email
              <input type="email" value={memForm.email} onChange={e=>setMemForm({...memForm, email:e.target.value})} style={{width:'100%', padding:8, marginTop:4}} />
            </label>
            <button disabled={memLoading} style={{padding:'10px 12px', marginTop:8, cursor:'pointer'}}>
              {memLoading ? 'Menyimpan…' : 'Simpan Member'}
            </button>
          </form>
        </div>

        <div style={{border:'1px solid #334155', borderRadius:8, padding:16}}>
          <h2>Generate Voucher</h2>

          <div style={{display:'flex', gap:8, alignItems:'center', margin:'8px 0'}}>
            <input placeholder="Cari member…" value={mQuery} onChange={e=>setMQuery(e.target.value)} style={{padding:8, flex:'0 0 40%'}} />
            <span style={{opacity:0.7}}>{loadingMembers ? 'Memuat…' : `${members.length} member`}</span>
          </div>

          <label>Pilih Member
            <select value={selMember} onChange={e=>setSelMember(e.target.value)} style={{width:'100%', padding:8, marginTop:4}}>
              <option value="">— pilih —</option>
              {members.map(m=> <option key={m.id} value={m.id}>{m.full_name} {m.email ? `(${m.email})` : ''}</option>)}
            </select>
          </label>

          <div style={{marginTop:12}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h3>Nominal & Jumlah</h3>
              <button onClick={addRow} style={{padding:'6px 10px', cursor:'pointer'}}>+ Tambah Baris</button>
            </div>

            {rows.map((r, i)=> (
              <div key={i} style={{display:'flex', gap:8, alignItems:'center', marginTop:8}}>
                <select value={r.amount} onChange={e=>updateRow(i,{amount:Number(e.target.value)})} style={{padding:8}}>
                  {denoms.map(a => <option key={a} value={a}>{fmt(a)}</option>)}
                </select>
                <input type="number" min={1} value={r.count} onChange={e=>updateRow(i,{count:Number(e.target.value)})} style={{width:100, padding:8}} />
                <button onClick={()=>removeRow(i)} disabled={rows.length===1} style={{padding:'6px 10px', cursor:'pointer'}}>Hapus</button>
              </div>
            ))}

            <label style={{display:'block', marginTop:12}}>Masa Berlaku (opsional)
              <input type="datetime-local" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} style={{padding:8, marginTop:4}} />
            </label>

            <button disabled={!canGenerate || genLoading} onClick={generate} style={{padding:'10px 12px', marginTop:12, cursor:'pointer'}}>
              {genLoading ? 'Memproses…' : `Generate (${rows.reduce((s,r)=>s+r.count,0)} kode)`}
            </button>
          </div>

          {generated.length>0 && (
            <div style={{marginTop:16}}>
              <h3>Hasil ({generated.length} kode)</h3>
              <button onClick={copyAll} style={{padding:'6px 10px', margin:'8px 0', cursor:'pointer'}}>Copy Semua</button>
              <div style={{border:'1px dashed #475569', borderRadius:6, padding:8, whiteSpace:'pre-wrap', maxHeight:240, overflow:'auto', fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace'}}>
                {generated.map((g,idx)=> <div key={idx}>{g.code}</div>)}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
