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
  const [member,setMember] = useState('');
  const [status,setStatus] = useState<'ALL'|'ISSUED'|'CLAIMED'|'PROCESSED'>('ALL');
  const [unprocessed,setUnprocessed]=useState(false);
  const [rows,setRows] = useState<Row[]>([]);
  const [loading,setLoading]= useState(false);
  const [flash,setFlash]= useState<Flash>(null);

  const qs = useMemo(()=>{
    const p = new URLSearchParams();
    if(member.trim()) p.set('member', member.trim());
    if(status!=='ALL') p.set('status', status);
    if(unprocessed) p.set('unprocessed','true');
    return p.toString();
  }, [member,status,unprocessed]);

  async function load(){
    if(!key) return;
    setLoading(true);
    setFlash(null);
    const res = await fetch(`/api/admin/vouchers${qs?`?${qs}`:''}`, { headers });
    const data = await res.json();
    setLoading(false);
    if(data?.ok){ setRows(data.vouchers); }
    else setFlash({kind:'error', text:`Gagal memuat: ${data?.error || res.status}`});
  }

  useEffect(()=> { if(ready && key) load(); }, [ready,key, qs]);

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

  if(!ready) return <div>Loading…</div>;
  if(!key) return <div className="alert alert-error">Masukkan Admin Key dulu di bar atas.</div>;

  return (
    <main>
      <h1>Riwayat Voucher</h1>
      {flash && <div className={`alert ${flash.kind==='success'?'alert-success':'alert-error'}`}>{flash.text}</div>}
      <div style={{display:'flex', gap:8, alignItems:'center', margin:'8px 0'}}>
        <input className="input" placeholder="Nama member…" value={member} onChange={e=>setMember(e.target.value)} style={{minWidth:240}} />
        <select className="select" value={status} onChange={e=>setStatus(e.target.value as any)}>
          <option value="ALL">Semua status</option>
          <option value="ISSUED">ISSUED</option>
          <option value="CLAIMED">CLAIMED</option>
          <option value="PROCESSED">PROCESSED</option>
        </select>
        <label style={{display:'flex', alignItems:'center', gap:6}}>
          <input type="checkbox" checked={unprocessed} onChange={e=>setUnprocessed(e.target.checked)} />
          Hanya yang belum diproses (CLAIMED)
        </label>
        <button className="btn" onClick={load} disabled={loading}>{loading? 'Memuat…':'Refresh'}</button>
      </div>

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
                <td>
                  {r.status==='CLAIMED'
                   ? <button className="btn btn-primary" onClick={()=>processOne(r.id)}>Process</button>
                   : <span style={{opacity:0.6}}>-</span>}
                </td>
              </tr>
            ))}
            {rows.length===0 && (
              <tr><td colSpan={8} style={{padding:12, textAlign:'center', opacity:0.7}}>Tidak ada data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
