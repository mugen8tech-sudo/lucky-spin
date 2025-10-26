'use client';

import { useAdminKey } from '../../components/useAdminKey';
import { useEffect, useMemo, useRef, useState } from 'react';

type Member = { id: string; full_name: string; email?: string; phone?: string; };
type Denom = number;

const fmt = (n:number)=> new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
const pad = (n:number)=> String(n).padStart(2,'0');
const norm = (s:string)=> s.trim().toLowerCase();

function toLocalDatetimeInputValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function parseAmountInput(s:string): number | null {
  const digits = s.replace(/[^\d]/g,'');
  if (!digits) return null;
  let n = parseInt(digits, 10);
  if (n < 1000) n = n * 1000; // "15" -> 15000
  return n;
}

type Flash = { kind:'success'|'error', text:string } | null;

export default function MembersPage(){
  const { ready, headers, key } = useAdminKey();

  // data
  const [members,setMembers] = useState<Member[]>([]);
  const [denoms,setDenoms] = useState<Denom[]>([]);

  // member search + dropdown
  const [memberSearch, setMemberSearch] = useState('');
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberHL, setMemberHL] = useState(0);
  const [selMember, setSelMember] = useState<string>('');

  // nominal quick add + dropdown
  const [nominalSearch, setNominalSearch] = useState('');
  const [nomOpen, setNomOpen] = useState(false);
  const [nomHL, setNomHL] = useState(0);

  // rows as chips: {amount, count}
  const [rows,setRows] = useState<{amount:number; count:number}[]>([]);
  const [expiresAt,setExpiresAt] = useState<string>('');

  const [genLoading,setGenLoading] = useState(false);
  const [generated,setGenerated] = useState<{code:string}[]>([]);
  const [memForm,setMemForm]= useState({ fullName:'', phone:'', email:''});
  const [memLoading,setMemLoading]= useState(false);
  const [flash,setFlash]= useState<Flash>(null);
  const [loadingMembers,setLoadingMembers] = useState(false);

  // refs
  const memberInputRef = useRef<HTMLInputElement>(null);
  const nominalInputRef = useRef<HTMLInputElement>(null);
  const generateBtnRef = useRef<HTMLButtonElement>(null);

  // load data
  useEffect(()=> {
    if(!ready || !key) return;
    const controller = new AbortController();
    setLoadingMembers(true);
    fetch(`/api/admin/members?limit=1000`, { headers, signal: controller.signal })
      .then(r=>r.json()).then(d=>{ if(d?.ok) setMembers(d.members); })
      .catch(()=>{})
      .finally(()=> setLoadingMembers(false));
    fetch('/api/admin/denominations', { headers })
      .then(r=>r.json()).then(d=> { if(d?.ok) setDenoms(d.amounts as number[]); });
    // default expires +14 hari
    const d = new Date(); d.setDate(d.getDate()+14);
    setExpiresAt(toLocalDatetimeInputValue(d));
    return ()=> controller.abort();
  }, [ready, key]);

  const canGenerate = useMemo(()=> selMember && rows.every(r => r.amount>0 && r.count>0) && rows.length>0, [selMember, rows]);

  // ====== MEMBER DROPDOWN (exact) ======
  const memberOptions = useMemo(()=>{
    const q = norm(memberSearch);
    if (!q) return members.slice(0, 8);
    // kalau exact ada → tampilkan hanya exact di paling atas
    const exact = members.filter(m => norm(m.full_name) === q);
    if (exact.length) return exact;
    // kalau belum exact → tampilkan prefix agar terasa ada saran
    return members.filter(m => norm(m.full_name).startsWith(q)).slice(0, 8);
  }, [members, memberSearch]);

  function selectMemberByIdx(idx:number){
    const item = memberOptions[idx];
    if (!item) return;
    setSelMember(item.id);
    setMemberSearch(item.full_name);
    setMemberOpen(false);
    setTimeout(()=> nominalInputRef.current?.focus(), 0);
  }

  // ====== NOMINAL DROPDOWN (exact) ======
  const nomParsed = parseAmountInput(nominalSearch);
  const nominalOptions = useMemo(()=>{
    // urut besar -> kecil
    const sorted = [...denoms].sort((a,b)=> b-a);
    if (!nomParsed) return sorted;
    // “exact” tampilkan hanya yang tepat
    if (denoms.includes(nomParsed)) return [nomParsed];
    // kalau belum exact, tampilkan yang prefix match (mis. 1 -> 10000, 15000, 100000)
    const q = (nominalSearch || '').replace(/[^\d]/g,'');
    return sorted.filter(a => String(a).startsWith(q));
  }, [denoms, nominalSearch, nomParsed]);

  function addNominal(amount:number){
    setRows(prev=>{
      const i = prev.findIndex(r=>r.amount===amount);
      if (i !== -1) {
        const c = prev.slice();
        c[i] = {...c[i], count: c[i].count + 1};
        return c;
      }
      return [...prev, { amount, count: 1 }];
    });
    setNominalSearch('');
    setNomOpen(true);
    setNomHL(0);
    setTimeout(()=> nominalInputRef.current?.focus(), 0);
    setFlash(null);
  }

  function removeChip(amount:number){
    setRows(prev => prev.filter(r=> r.amount !== amount));
  }

  // === Add member manual (tetap ada) ===
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
      const mres = await fetch(`/api/admin/members?limit=1000`, { headers });
      const md = await mres.json();
      if(md?.ok) setMembers(md.members);
      setSelMember(data.member.id);
      setMemberSearch(data.member.full_name);
      setTimeout(()=> nominalInputRef.current?.focus(), 0);
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
      setRows([]);
      setNominalSearch('');
      setTimeout(()=> nominalInputRef.current?.focus(), 0);
    } catch (e:any) {
      setFlash({kind:'error', text:`Gagal: ${e.message || e}`});
    } finally { setGenLoading(false); }
  }

  if(!ready) return <div>Loading…</div>;
  if(!key) return <div className="alert alert-error">Masukkan Admin Key dulu di bar atas.</div>;

  return (
    <main>
      <h1 style={{marginBottom:12}}>Member & Batch Voucher</h1>
      {flash && <div className={`alert ${flash.kind==='success'?'alert-success':'alert-error'}`}>{flash.text}</div>}

      <section className="grid-2">
        {/* Panel A: Daftarkan Member */}
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

        {/* Panel B: Generate Voucher */}
        <div className="card">
          <h2>Generate Voucher</h2>

          {/* Cari Member - dropdown */}
          <div style={{marginTop:8}}>
            <label>Cari Member (exact, satu kata)</label>
            <div className="dropdown" onKeyDown={(e)=>{
              if (e.key==='ArrowDown'){ e.preventDefault(); setMemberOpen(true); setMemberHL(i=> Math.min((memberOptions.length-1), i+1)); }
              if (e.key==='ArrowUp'){ e.preventDefault(); setMemberOpen(true); setMemberHL(i=> Math.max(0, i-1)); }
              if (e.key==='Enter'){ e.preventDefault(); selectMemberByIdx(memberHL); }
              if (e.key==='Escape'){ setMemberOpen(false); }
            }}>
              <input
                ref={memberInputRef}
                className="input"
                placeholder={loadingMembers ? 'Memuat member…' : 'Ketik nama persis — Enter'}
                value={memberSearch}
                onFocus={()=> setMemberOpen(true)}
                onChange={e=>{ setMemberSearch(e.target.value); setMemberOpen(true); setMemberHL(0); }}
              />
              {memberOpen && (
                <div className="dropdown-menu" onMouseLeave={()=>setMemberHL(-1)}>
                  {memberOptions.length===0
                    ? <div className="dropdown-empty">Tidak ada hasil</div>
                    : memberOptions.map((m,idx)=>(
                        <div
                          key={m.id}
                          className="dropdown-item"
                          aria-selected={idx===memberHL}
                          onMouseEnter={()=>setMemberHL(idx)}
                          onMouseDown={(e)=>{ e.preventDefault(); selectMemberByIdx(idx); }}
                        >
                          {m.full_name} {m.email ? <span style={{opacity:.6}}>— {m.email}</span> : null}
                        </div>
                      ))
                  }
                </div>
              )}
            </div>
            {selMember && <div style={{marginTop:6, opacity:.85}}>Dipilih: <strong>{memberSearch}</strong></div>}
          </div>

          {/* Nominal quick add - dropdown */}
          <div style={{marginTop:14}}>
            <h3 style={{margin:'6px 0'}}>Nominal cepat (Enter menambah 1 kode)</h3>
            <div className="dropdown" onKeyDown={(e)=>{
              if (e.key==='ArrowDown'){ e.preventDefault(); setNomOpen(true); setNomHL(i=> Math.min((nominalOptions.length-1), i+1)); }
              if (e.key==='ArrowUp'){ e.preventDefault(); setNomOpen(true); setNomHL(i=> Math.max(0, i-1)); }
              if (e.key==='Enter'){ e.preventDefault(); const pick = nominalOptions[nomHL]; if (pick!=null) addNominal(pick); }
              if (e.key==='Escape'){ setNomOpen(false); }
              if (e.key==='Backspace' && nominalSearch==='' && rows.length>0){
                // backspace saat kosong -> kurangi 1 dari chip terakhir (feel keyboardy)
                const last = rows[rows.length-1]; 
                if (last.count>1) setRows(prev => prev.map(r => r.amount===last.amount ? {...r, count:r.count-1} : r));
                else removeChip(last.amount);
              }
            }}>
              <input
                ref={nominalInputRef}
                className="input"
                placeholder="Ketik angka (mis. 15 -> Rp 15.000), lalu Enter"
                value={nominalSearch}
                onFocus={()=> setNomOpen(true)}
                onChange={e=>{ setNominalSearch(e.target.value); setNomOpen(true); setNomHL(0); }}
                disabled={!selMember}
              />
              {nomOpen && selMember && (
                <div className="dropdown-menu" onMouseLeave={()=>setNomHL(-1)}>
                  {nominalOptions.length===0
                    ? <div className="dropdown-empty">Nominal tidak ditemukan</div>
                    : nominalOptions.map((a,idx)=>(
                        <div
                          key={a}
                          className="dropdown-item"
                          aria-selected={idx===nomHL}
                          onMouseEnter={()=>setNomHL(idx)}
                          onMouseDown={(e)=>{ e.preventDefault(); addNominal(a); }}
                        >
                          {fmt(a)}
                        </div>
                      ))
                  }
                </div>
              )}
            </div>

            {/* Chips ringkasan */}
            {rows.length>0 && (
              <div style={{marginTop:12}}>
                <h4 style={{margin:'6px 0'}}>Akan dibuat</h4>
                <div className="chips">
                  {rows.map(r=>(
                    <span key={r.amount} className="chip">
                      <span style={{fontWeight:600}}>{fmt(r.amount)}</span>
                      <span style={{opacity:.8}}>×{r.count}</span>
                      <button
                        type="button"
                        className="chip-remove"
                        aria-label={`Hapus ${fmt(r.amount)}`}
                        onClick={()=>removeChip(r.amount)}
                        title="Hapus"
                      >×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Masa berlaku */}
            <label style={{display:'block', marginTop:12}}>Masa Berlaku (default +14 hari)
              <input className="input" type="datetime-local" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} style={{marginTop:4}} />
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
              <button className="btn" onClick={()=>navigator.clipboard.writeText(generated.map(g=>g.code).join('\n'))} style={{margin:'8px 0'}}>Copy Semua</button>
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
