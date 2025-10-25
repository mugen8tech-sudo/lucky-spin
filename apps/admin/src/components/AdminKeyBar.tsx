'use client';

import { useAdminKey } from './useAdminKey';
import { useState } from 'react';

export default function AdminKeyBar() {
  const { key, setKey, ready } = useAdminKey();
  const [show, setShow] = useState(false);
  const [temp, setTemp] = useState('');

  if (!ready) return null;
  const masked = key ? key.replace(/.(?=.{4})/g, '•') : '—';

  return (
    <div className="card" style={{display:'flex', alignItems:'center', gap:12, marginBottom:16}}>
      <strong>Admin Key:</strong>
      <span style={{fontFamily:'monospace'}}>{masked}</span>

      <div style={{marginLeft:'auto', display:'flex', gap:8}}>
        <button className="btn" onClick={()=>setShow(s=>!s)}>{show ? 'Tutup' : (key ? 'Ubah' : 'Set')}</button>
        {key && <button className="btn btn-danger" onClick={()=>setKey(null)}>Hapus</button>}
      </div>

      {show && (
        <form onSubmit={(e)=>{e.preventDefault(); if (temp.trim().length<6) return; setKey(temp.trim()); setTemp(''); setShow(false);}} style={{display:'flex', gap:8, marginLeft:12}}>
          <input className="input" value={temp} onChange={e=>setTemp(e.target.value)} placeholder="Masukkan Admin Key" />
          <button className="btn btn-primary" type="submit">Simpan</button>
        </form>
      )}
    </div>
  );
}
