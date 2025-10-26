'use client';

import { useAdminKey } from '../../components/useAdminKey';
import { useEffect, useMemo, useState } from 'react';

type Row = {
  id: string; code: string; amount: number; status: 'ISSUED'|'CLAIMED'|'PROCESSED';
  issued_at?: string; claimed_at?: string; processed_at?: string;
  member_id: string; full_name: string;
};

const rupiah = (n:number)=> new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR', maximumFractionDigits:0}).format(n);
const time = (s?:string)=> s ? new Date(s).toLocaleString('id-ID') : '';

type Flash = { kind:'success'|'error', text:string } | null;

export default function VouchersPage(){
  const { ready, headers, key } = useAdminKey();

  // filters
  const [member,setMember] = useState('');
  const [status,setStatus] = useState<'ALL'|'ISSUED'|'CLAIMED'|'PROCESSED'>('ALL');
  const [unprocessed,setUnprocessed]=useState(false);
  const [code,setCode] = useState('');
  const [from,setFrom] = useState(''); // yyyy-mm-dd
  const [to,setTo]     = useState(''); // yyyy-mm-dd

  // data
  const [rows,setRows] = useState<Row[]>([]);
  const [nextCursor,setNextCursor] = useState<string | null>(null);
  const [loading,setLoading]= useState(false);
  const [exporting,setExporting]= useState(false);
  const [flash,setFlash]= useState<Flash>(null);

  const qs = useMemo(()=>{
    const p = new URLSearchParams();
    if(member.trim()) p.set('member', member.trim());
    if(status!=='ALL') p.set('status', status);
    if(unprocessed) p.set('unprocessed','true');
    if(code.trim()) p.set('code', code.trim());
    if(from) p.set('from', new Date(from).toISOString());
    if(to)   p.set('to',   new Date(to).toISOString());
    p.set('limit','50');
    return p.toString();
  }, [member,status,unprocessed,code,from,to]);

  async function load(initial=false){
    if(!key) return;
    setLoading(true);
    setFlash(null);

    const url = `/api/admin/vouchers?${qs}${initial || !nextCursor ? '' : `&cursor=${encodeURIComponent(nextCursor)}`}`;
    const res = await fetch(url, { headers });
    const data = await res.json();

    setLoading(false);
    if(data?.ok){
      setRows(prev => initial ? data.vouchers : prev.concat(data.vouchers));
      setNextCursor(data.nextCursor || null);
    } else {
      setFlash({kind:'error', text:`Gagal memuat: ${data?.error || res.status}`});
    }
  }

  useEffect(()=> { if(ready && key) { setRows([]); setNextCursor(null); load(true); } }, [ready,key, qs]);

  async function processOne(id: string){
    const note = window.prompt('Catatan (opsional):','');
    const res = await fetch(`/api/admin/vouchers/${id}/process`, {
      method:'POST', headers, body: JSON.stringify({ note: note || null })
    });
    const data = await res.json();
    if(data?.ok){
      setRows(prev => prev.map(r => r.id===id ? {...r, status: 'PROCESSED', processed_at: new Date().toISOString()} : r));
    } else {
      setFlash({kind:'error', text:`Gagal memproses: ${data?.error || res.status}`});
    }
  }

  async function doExport(){
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/vouchers/export?${qs}`, { headers });
      if(!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vouchers-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(e:any){
      setFlash({kind:'error', text:`Export gagal: ${e.message || e}`});
    } finally { setExporting(false); }
  }

  function resetFilters(){
    setMember(''); setStatus('ALL'); setUnprocessed(false); setCode(''); setFrom(''); setTo('');
  }

  function copyCode(c:string){
    navigator.clipboard.writeText(c);
    setFlash({kind:'success', text:'Kode disalin.'});
    setTimeout(()=> setFlash(null), 1400);
  }

  if(!ready) return <div>Loading…</div>;
  if(!key) return <div className="alert alert-error">Masukkan Admin Key dulu di bar atas.</div>;

  return (
    <main>
      <h1>Riwayat Voucher</h1>
      {flash && <div className={`alert ${flash.kind==='success'?'alert-success':'alert-error'}`}>{flash.text}</div>}

      {/* FILTER BAR */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'grid', gap:8, gridTemplateColumns:'repeat(6, minmax(0,1fr))'}}>
          <input className="input" placeholder="Nama member…" value={member} onChange={e=>setMember(e.target.value)} />
          <input className="input" placeholder="Kode…" value={code} onChange={e=>setCode(e.target.value)} />
          <select className="input" value={status} onChange={e=>setStatus(e.target.value as any)}>
            <option value="ALL">Semua status</option>
            <option value="ISSUED">ISSUED</option>
            <option value="CLAIMED">CLAIMED</option>
            <option value="PROCESSED">PROCESSED</option>
          </select>
          <label><span style={{fontSize:12,opacity:.75}}>Dari</span>
            <input className="input" type="date" value={from} onChange={e=>setFrom(e.target.value)} />
          </label>
          <label><span style={{fontSize:12,opacity:.75}}>Sampai</span>
            <input className="input" type="date" value={to} onChange={e=>setTo(e.target.value)} />
          </label>
          <label style={{display:'flex', alignItems:'center', gap:6}}>
            <input type="checkbox" checked={unprocessed} onChange={e=>setUnprocessed(e.target.checked)} />
            Hanya belum diproses (CLAIMED)
          </label>
        </div>

        <div style={{display:'flex', gap:8, marginTop:10}}>
          <button className="btn" onClick={()=>{ setRows([]); setNextCursor(null); load(true); }} disabled={loading}>
            {loading? 'Memuat…':'Refresh'}
          </button>
          <button className="btn" onClick={resetFilters}>Reset Filter</button>
          <button className="btn btn-primary" onClick={doExport} disabled={exporting}>
            {exporting? 'Menyiapkan CSV…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="card" style={{padding:0}}>
        <table className="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Member</th>
              <th style={{textAlign:'right'}}>Nominal</th>
              <th>Status</th>
              <th>Issued</th>
              <th>Claimed</th>
              <th>Processed</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id}>
                <td style={{fontFamily:'ui-monospace'}}>{r.code}</td>
                <td>{r.full_name}</td>
                <td style={{textAlign:'right'}}>{rupiah(r.amount)}</td>
                <td>{r.status}</td>
                <td>{time(r.issued_at)}</td>
                <td>{time(r.claimed_at)}</td>
                <td>{time(r.processed_at)}</td>
                <td style={{display:'flex', gap:8}}>
                  <button className="btn" onClick={()=>copyCode(r.code)}>Copy</button>
                  {r.status==='CLAIMED'
                    ? <button className="btn btn-primary" onClick={()=>processOne(r.id)}>Process</button>
                    : <span style={{opacity:.6, alignSelf:'center'}}>-</span>}
                </td>
              </tr>
            ))}
            {rows.length===0 && (
              <tr><td colSpan={8} style={{padding:12, textAlign:'center', opacity:0.7}}>Tidak ada data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div style={{display:'flex', justifyContent:'center', marginTop:12}}>
        {nextCursor
          ? <button className="btn" onClick={()=>load(false)} disabled={loading}>Muat lebih banyak</button>
          : <span style={{opacity:.6}}>— sudah di akhir —</span>}
      </div>
    </main>
  );
}
