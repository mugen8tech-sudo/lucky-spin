'use client';

import { useAdminKey } from '../../components/useAdminKey';
import { useEffect, useMemo, useRef, useState } from 'react';

type Member = { id: string; full_name: string; email?: string; phone?: string; };
type Denom = number;

const fmt = (n:number)=> new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);

// helpers
const pad = (n:number)=> String(n).padStart(2,'0');
function toLocalDatetimeInputValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function normalizeName(s:string){ return s.trim().toLowerCase(); }
function parseAmountInput(s:string): number | null {
  const digits = s.replace(/[^\d]/g,'');
  if (!digits) return null;
  let n = parseInt(digits, 10);
  // Ketik "15" → 15.000 (exact thousands)
  if (n < 1000) n = n * 1000;
  return n;
}

type Flash = { kind:'success'|'error', text:string } | null;

export default function MembersPage(){
  const { ready, headers, key } = useAdminKey();

  // DATA
  const [members,setMembers] = useState<Member[]>([]);
  const [denoms,setDenoms] = useState<Denom[]>([]);

  // MEMBER SEARCH (exact)
  const [memberSearch, setMemberSearch] = useState('');
  const [selMember, setSelMember] = useState<string>('');
  const [memberMsg, setMemberMsg] = useState<string>('');

  // NOMINAL QUICK-ADD
  const [nominalSearch, setNominalSearch] = useState('');
  const [rows,setRows] = useState<{amount:number; count:number}[]>([]);
  const [expiresAt,setExpiresAt] = useState<string>('');
  const [genLoading,setGenLoading] = useState(false);
  const [generated,setGenerated] = useState<{code:string}[]>([]);
  const [memForm,setMemForm]= useState({ fullName:'', phone:'', email:''});
  const [memLoading,setMemLoading]= useState(false);
  const [flash,setFlash]= useState<Flash>(null);
  const [loadingMembers,setLoadingMembers] = useState(false);

  // Refs untuk navigasi keyboard
  const memberInputRef = useRef<HTMLInputElement>(null);
  const nominalInputRef = useRef<HTMLInputElement>(null);
  const expiresRef = useRef<HTMLInputElement>(null);
  const generateBtnRef = useRef<HTMLButtonElement>(null);

  // Load members & denoms sekali saat siap
  useEffect(()=> {
    if(!ready || !key) return;
    const controller = new AbortController();
    setLoadingMembers(true);
    // Ambil semua (maks) supaya pencarian exact dilakukan di client
    fetch(`/api/admin/members?limit=1000`, { headers, signal: controller.signal })
      .then(r=>r.json()).then(d=>{ if(d?.ok) setMembers(d.members); })
      .catch(()=>{})
      .finally(()=> setLoadingMembers(false));
    fetch('/api/admin/denominations', { headers })
      .then(r=>r.json()).then(d=> { if(d?.ok) setDenoms(d.amounts as number[]); });
    return ()=> controller.abort();
  }, [ready, key]);

  // Set default masa berlaku = +14 hari dari saat halaman dibuka
  useEffect(()=>{
    if (!ready) return;
    const d = new Date(); d.setDate(d.getDate()+14);
    setExpiresAt(toLocalDatetimeInputValue(d));
  }, [ready]);

  // computed
  const canGenerate = useMemo(()=> selMember && rows.every(r => r.amount>0 && r.count>0) && rows.length>0, [selMember, rows]);

  // Add member via form (opsional, tetap ada)
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
      // refresh list member & set selected
      const mres = await fetch(`/api/admin/members?limit=1000`, { headers });
      const md = await mres.json();
      if(md?.ok) setMembers(md.members);
      setSelMember(data.member.id);
      setMemberSearch(data.member.full_name);
      // Fokus ke nominal
      setTimeout(()=> nominalInputRef.current?.focus(), 0);
    } else {
      setFlash({kind:'error', text:`Gagal: ${data?.error || res.status}`});
    }
  }

  // === MEMBER: exact search ===
  function handleMemberEnter(){
    const name = memberSearch.trim();
    if (!name) return;
    const found = members.find(m => normalizeName(m.full_name) === normalizeName(name));
    if (found){
      setSelMember(found.id);
      setMemberSearch(found.full_name); // pastikan case sesuai DB
      setMemberMsg('');
      // Fokus ke nominal
      setTimeout(()=> nominalInputRef.current?.focus(), 0);
    } else {
      setSelMember('');
      setMemberMsg(`Tidak ada member bernama persis "${name}".`);
    }
  }
  function clearMember(){
    setSelMember('');
    setMemberSearch('');
    setMemberMsg('');
    setTimeout(()=> memberInputRef.current?.focus(), 0);
  }

  // === NOMINAL QUICK ADD ===
  function addNominalFromSearch(){
    const n = parseAmountInput(nominalSearch);
    if (n && denoms.includes(n)) {
      setRows(prev => {
        const i = prev.findIndex(r=>r.amount===n);
        if (i !== -1) {
          const clone = prev.slice();
          clone[i] = { ...clone[i], count: clone[i].count + 1 };
          return clone;
        }
        return [...prev, { amount: n, count: 1 }];
      });
      setNominalSearch('');
      // tetap fokus di input nominal (biar bisa ketik lagi langsung)
      setTimeout(()=> nominalInputRef.current?.focus(), 0);
      setFlash(null);
    } else {
      setFlash({kind:'error', text:`Nominal "${nominalSearch}" tidak ditemukan di daftar.`});
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
      // selesai generate → kosongkan rows & fokus kembali ke nominal untuk batch berikutnya
      setRows([]);
      setNominalSearch('');
      setTimeout(()=> nominalInputRef.current?.focus(), 0);
    } catch (e:any) {
      setFlash({kind:'error', text:`Gagal: ${e.message || e}`});
    } finally { setGenLoading(false); }
  }

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
        {/* Panel A: Daftarkan Member (tetap seperti sebelumnya) */}
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

        {/* Panel B: Generate Voucher (keyboard-first) */}
        <div className="card">
          <h2>Generate Voucher</h2>

          {/* Cari Member (exact) */}
          <div style={{margin:'8px 0'}}>
            <label> Cari Member (exact, satu kata)
              <div style={{display:'flex', gap:8, alignItems:'center', marginTop:4}}>
                <input
                  ref={memberInputRef}
                  className="input"
                  placeholder={loadingMembers ? 'Memuat member…' : 'Ketik nama persis lalu Enter'}
                  value={memberSearch}
                  onChange={e=>{setMemberSearch(e.target.value); setMemberMsg('');}}
                  onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); handleMemberEnter(); } }}
                  aria-label="Cari member (exact)"
                />
                {selMember && <button className="btn" onClick={clearMember} title="Ganti member (Esc)">Ganti</button>}
              </div>
            </label>
            {memberMsg && <div className="alert alert-error" style={{marginTop:6}}>{memberMsg}</div>}
            {selMember && <div style={{marginTop:6, opacity:.85}}>Dipilih: <strong>{memberSearch}</strong></div>}
          </div>

          {/* Quick add nominal by keyboard */}
          <div style={{marginTop:12}}>
            <h3 style={{margin:'6px 0'}}>Nominal cepat (Enter untuk tambah 1 kode)</h3>
            <input
              ref={nominalInputRef}
              className="input"
              placeholder="Ketik nominal persis lalu Enter (mis. 15 → Rp 15.000)"
              value={nominalSearch}
              onChange={e=>setNominalSearch(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); addNominalFromSearch(); } }}
              disabled={!selMember}
            />
            <div style={{fontSize:12, opacity:.7, marginTop:6}}>
              Daftar nominal: {denoms.map(a=>fmt(a)).join(' · ')}
            </div>

            {/* Daftar rows yang akan dibuat */}
            {rows.length>0 && (
              <div style={{marginTop:10}}>
                <h4 style={{margin:'8px 0'}}>Akan dibuat</h4>
                {rows.map((r,i)=>(
                  <div key={i} style={{display:'flex', gap:8, alignItems:'center', marginTop:6}}>
                    <div style={{minWidth:160}}>{fmt(r.amount)}</div>
                    <input
                      className="input"
                      type="number" min={1}
                      value={r.count}
                      onChange={e=>updateRow(i,{count: Number(e.target.value)})}
                      style={{width:120}}
                    />
                    <button className="btn" onClick={()=>removeRow(i)}>Hapus</button>
                  </div>
                ))}
              </div>
            )}

            {/* Masa berlaku */}
            <label style={{display:'block', marginTop:12}}>Masa Berlaku (default +14 hari)
              <input ref={expiresRef} className="input" type="datetime-local" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} style={{marginTop:4}} />
            </label>

            {/* Generate */}
            <button
              ref={generateBtnRef}
              className="btn btn-primary"
              disabled={!canGenerate || genLoading}
              onClick={generate}
              style={{marginTop:12}}
            >
              {genLoading ? 'Memproses…' : `Generate (${rows.reduce((s,r)=>s+r.count,0)} kode)`}
            </button>
          </div>

          {/* Hasil */}
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
