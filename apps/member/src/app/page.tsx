'use client';

import React, { useMemo, useRef, useState } from 'react';
import Wheel from '../components/Wheel';

type ClaimOk = { ok:true; amount:number; wheel:{ segments:number[]; targetIndex:number; spinMs:number } };
type ClaimErr = { ok:false; reason:'INVALID_CODE'|'ALREADY_USED'|'EXPIRED'|'UNABLE_TO_CLAIM'|'SERVER_ERROR' };
type ClaimResp = ClaimOk | ClaimErr;

export default function Page() {
  const [code, setCode] = useState('');
  const [msg, setMsg]   = useState<{kind:'success'|'error'; text:string} | null>(null);

  // wheel states
  const [segments, setSegments] = useState<number[]>([5000,10000,15000,20000,30000,50000,100000]);
  const [spinMs, setSpinMs] = useState(6000);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [prize, setPrize] = useState<number | null>(null);

  const busy = spinning;

  const disabled = useMemo(()=> busy || !code.trim(), [busy, code]);

  async function handleSpin() {
    if (disabled) return;
    setMsg(null); setPrize(null);

    let res: Response | null = null;
    try {
      res = await fetch('/api/claim', {
        method:'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ code: code.trim() })
      });
    } catch (e) {
      setMsg({kind:'error', text:'Koneksi bermasalah. Coba lagi.'});
      return;
    }

    let data: ClaimResp;
    try { data = await res.json(); } catch { setMsg({kind:'error', text:'Respon tidak valid.'}); return; }

    if (!data.ok) {
      const reasonMap: Record<string,string> = {
        INVALID_CODE: 'Kode tidak ditemukan.',
        ALREADY_USED: 'Kode sudah pernah dipakai.',
        EXPIRED: 'Kode sudah kedaluwarsa.',
        UNABLE_TO_CLAIM: 'Kode tidak bisa diklaim.',
        SERVER_ERROR: 'Terjadi kesalahan server.'
      };
      setMsg({kind:'error', text: reasonMap[data.reason] || 'Gagal.'});
      return;
    }

    // sukses → siapkan wheel
    const { amount, wheel } = data;
    setSegments(wheel.segments);
    setSpinMs(wheel.spinMs);

    // hitung rotasi supaya segmen targetIndex berada di atas (di bawah pointer)
    const N = wheel.segments.length;
    const step = 360 / N;
    const centerDeg = wheel.targetIndex * step + step/2; // 0° di atas (karena Wheel path start di atas)
    const turns = 6 + Math.floor(Math.random() * 2);     // 6–7 putaran
    // putar *searah jarum jam*, sehingga target center jatuh tepat di atas → kita rotasi ke (360 - centerDeg)
    const final = turns*360 + (360 - centerDeg);

    setSpinning(true);
    // reset transition lalu apply rotasi baru agar animasi selalu berjalan
    requestAnimationFrame(()=>{
      setRotation(prev => prev % 360);
      requestAnimationFrame(()=>{
        setRotation(final);
      });
    });

    // selesai spin → tampilkan hadiah + confetti
    window.setTimeout(()=>{
      setSpinning(false);
      setPrize(amount);
      makeConfetti();
    }, wheel.spinMs + 120); // + sedikit buffer
  }

  function makeConfetti(){
    const colors = ['#fde047','#60a5fa','#34d399','#fb7185','#c084fc','#fbbf24','#2dd4bf'];
    for (let i=0;i<120;i++){
      const el = document.createElement('div');
      el.className = 'confetti';
      el.style.left = Math.random()*100 + 'vw';
      el.style.background = colors[i % colors.length];
      el.style.transform = `translateY(-10px) rotate(${Math.random()*360}deg)`;
      el.style.animationDuration = 1800 + Math.random()*1500 + 'ms';
      el.style.opacity = String(0.8 + Math.random()*0.2);
      document.body.appendChild(el);
      setTimeout(()=> el.remove(), 3000);
    }
  }

  return (
    <main className="wrapper">
      <div className="card">
        <h1 style={{marginTop:0}}>Masukkan Kode Voucher</h1>
        {msg && <div className={`alert ${msg.kind==='error'?'alert-error':'alert-success'}`}>{msg.text}</div>}
        <div style={{display:'grid', gap:10}}>
          <input
            className="input"
            placeholder="Contoh: ABCD1234EF"
            value={code}
            onChange={e=> setCode(e.target.value.toUpperCase().replace(/\s/g,''))}
          />
          <button
            className="btn btn-primary"
            onClick={handleSpin}
            disabled={disabled}
          >
            {busy ? 'Memutar…' : 'Putar!'}
          </button>
          {prize!=null && (
            <div className="alert alert-success" style={{marginTop:6}}>
              <strong>Selamat!</strong> Anda mendapatkan <span style={{fontWeight:700}}>
                {new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(prize)}
              </span>
            </div>
          )}
          <p style={{opacity:.75, fontSize:14, marginTop:4}}>
            Kode yang sudah dipakai akan ditolak. Pastikan koneksi Anda stabil saat memutar.
          </p>
        </div>
      </div>

      <div className="card" style={{display:'grid', placeItems:'center'}}>
        <Wheel segments={segments} rotationDeg={rotation} spinning={spinning} spinMs={spinMs}/>
      </div>
    </main>
  );
}
