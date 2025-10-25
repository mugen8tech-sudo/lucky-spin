'use client';
import { useAdminKey } from '../../components/useAdminKey';
import { useState } from 'react';

export default function HealthPage(){
  const { ready, headers, key } = useAdminKey();
  const [out,setOut] = useState<any>(null);
  const [loading,setLoading]=useState(false);

  if(!ready) return <main>Loading…</main>;
  if(!key) return <main>Masukkan Admin Key di bar atas.</main>;

  async function run(){
    setLoading(true);
    const r = await fetch('/api/admin/health', { headers });
    const d = await r.json();
    setOut(d);
    setLoading(false);
  }

  return (
    <main>
      <h1>Health Check</h1>
      <button className="btn btn-primary" onClick={run} disabled={loading}>{loading?'Checking…':'Check now'}</button>
      <pre className="codebox" style={{marginTop:12}}>{out ? JSON.stringify(out,null,2) : '—'}</pre>
    </main>
  );
}
