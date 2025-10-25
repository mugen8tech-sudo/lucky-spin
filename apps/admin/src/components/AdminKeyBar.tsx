'use client';

import { useAdminKey } from './useAdminKey';
import { useState } from 'react';

export default function AdminKeyBar() {
  const { key, setKey, ready } = useAdminKey();
  const [showForm, setShowForm] = useState(false);
  const [temp, setTemp] = useState('');

  if (!ready) return null;
  const masked = key ? key.replace(/.(?=.{4})/g, '•') : '—';

  return (
    <div style={{background:'#1e293b', padding:'8px 12px', borderRadius:8, marginBottom:16, display:'flex', alignItems:'center', gap:12}}>
      <strong>Admin Key:</strong>
      <span style={{fontFamily:'monospace'}}>{masked}</span>

      <button onClick={() => setShowForm(s=>!s)} style={{marginLeft:'auto', padding:'6px 10px', cursor:'pointer'}}>
        {showForm ? 'Tutup' : (key ? 'Ubah' : 'Set')}
      </button>
      {key && (
        <button onClick={() => setKey(null)} style={{padding:'6px 10px', cursor:'pointer'}}>Hapus</button>
      )}

      {showForm && (
        <form onSubmit={(e)=>{e.preventDefault(); if (temp.trim().length<6) return; setKey(temp.trim()); setTemp(''); setShowForm(false);}} style={{display:'flex', gap:8, marginLeft:12}}>
          <input value={temp} onChange={e=>setTemp(e.target.value)} placeholder="Masukkan Admin Key" style={{padding:6, minWidth:260}} />
          <button type="submit" style={{padding:'6px 10px', cursor:'pointer'}}>Simpan</button>
        </form>
      )}
    </div>
  );
}
