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

export default function VouchersPage(){
  const { ready, headers, key } = useAdminKey();
  const [member,setMember] = useState('');
  const [status,setStatus] = useState<'ALL'|'ISSUED'|'CLAIMED'|'PROCESSED'>('ALL');
  const [unprocessed,setUnprocessed]=useState(false);
  const [rows,setRows] = useState<Row[]>([]);
  const [loading,setLoading]= useState(false);
  const [msg,setMsg]= useState('');

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
    setMsg('');
    const res = await fetch(`/api/admin/vouchers${qs?`?${qs}`:''}`, { headers });
    const data = await res.json();
    setLoading(false);
    if(data?.ok){ setRows(data.vouchers); }
    else setMsg(`Gagal memuat: ${data?.error || res.status}`);
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
      alert(`Gagal memproses: ${data?.error || res.status}`);
    }
  }

  if(!ready) return <div>Loading…</div>;
  if(!key) return <div>Masukkan Admin Key dulu di bar atas.</div>;

  return (
    <main>
      <h1>Riwayat Voucher</h1>
      {msg && <div style={{background:'#7f1d1d', color:'#fee2e2', padding:8, borderRadius:6, margin:'8px 0'}}>{msg}</div>}
      <div style={{display:'flex', gap:8, alignItems:'center', margin:'8px 0'}}>
        <input placeholder="Nama member…" value={member} onChange={e=>setMember(e.target.value)} style={{padding:8, minWidth:240}} />
        <select value={status} onChange={e=>setStatus(e.target.value as any)} style={{padding:8}}>
          <option value="ALL">Semua status</option>
          <option value="ISSUED">ISSUED</option>
          <option value="CLAIMED">CLAIMED</option>
          <option value="PROCESSED">PROCESSED</option>
        </select>
        <label style={{display:'flex', alignItems:'center', gap:6}}>
          <input type="checkbox" checked={unprocessed} onChange={e=>setUnprocessed(e.target.checked)} />
          Hanya yang belum diproses (CLAIMED)
        </label>
        <button onClick={load} disabled={loading} style={{padding:'8px 12px', cursor:'pointer'}}>{loading? 'Memuat…':'Refresh'}</button>
      </div>

      <div style={{overflowX:'auto', border:'1px solid #334155', borderRadius:8}}>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:14}}>
          <thead>
            <tr style={{background:'#0b1220'}}>
              <th style={{textAlign:'left', padding:8}}>Kode</th>
              <th style={{textAlign:'left', padding:8}}>Member</th>
              <th style={{textAlign:'right', padding:8}}>Nominal</th>
              <th style={{textAlign:'left', padding:8}}>Status</th>
              <th style={{textAlign:'left', padding:8}}>Issued</th>
              <th style={{textAlign:'left', padding:8}}>Claimed</th>
              <th style={{textAlign:'left', padding:8}}>Processed</th>
              <th style={{textAlign:'left', padding:8}}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id} style={{borderTop:'1px solid #334155'}}>
                <td style={{padding:8, fontFamily:'ui-monospace'}}>{r.code}</td>
                <td style={{padding:8}}>{r.full_name}</td>
                <td style={{padding:8, textAlign:'right'}}>{rupiah(r.amount)}</td>
                <td style={{padding:8}}>{r.status}</td>
                <td style={{padding:8}}>{time(r.issued_at)}</td>
                <td style={{padding:8}}>{time(r.claimed_at)}</td>
                <td style={{padding:8}}>{time(r.processed_at)}</td>
                <td style={{padding:8}}>
                  {r.status==='CLAIMED'
                   ? <button onClick={()=>processOne(r.id)} style={{padding:'6px 10px', cursor:'pointer'}}>Process</button>
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
