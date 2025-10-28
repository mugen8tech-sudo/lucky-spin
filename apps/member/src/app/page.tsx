'use client';

import React, { useEffect, useMemo, useState } from 'react';
import RainFX from '../components/RainFX';
import LightningFX from '../components/LightningFX';
import Wheel, { type SegmentSpec as WheelSegmentSpec } from '../components/Wheel';

type ClaimOk = { ok:true; amount:number; wheel:{ segments:number[]; targetIndex:number; spinMs:number } };
type ClaimErr = { ok:false; reason:'INVALID_CODE'|'ALREADY_USED'|'EXPIRED'|'UNABLE_TO_CLAIM'|'SERVER_ERROR'; detail?:string };
type ClaimResp = ClaimOk | ClaimErr;

const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL || '#';
const HUB_ICON_URL = process.env.NEXT_PUBLIC_HUB_ICON_URL || '/hub-icon.png';
const HUB_FILL = (process.env.NEXT_PUBLIC_HUB_FILL || '#ffffff') as string;

export default function Page() {
  // UI
  const [code, setCode] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [msg, setMsg] = useState<{kind:'error'|'success'; text:string} | null>(null);

  // Wheel
  const [segments, setSegments] = useState<WheelSegmentSpec[]>([
    5000, 10000, 15000, 20000, 25000, 30000, 35000, 50000, 100000, 250000, 500000,
    { icon: 'android' } // <- dummy wedge ikon
  ]);
  const [spinMs, setSpinMs] = useState(6000);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  // Result
  const [prize, setPrize] = useState<number | null>(null);
  const [winningIndex, setWinningIndex] = useState<number | null>(null);
  
  const showResult = prize != null;
  const disabled = useMemo(()=> spinning || !code.trim(), [spinning, code]);

  // Lock scroll saat panel/modal tampil (nyaman di mobile)
  useEffect(()=>{
    const lock = showPanel || showResult;
    const prev = document.body.style.overflow;
    if (lock) document.body.style.overflow = 'hidden';
    return ()=> { document.body.style.overflow = prev; };
  }, [showPanel, showResult]);

  async function handleSpin() {
    if (disabled) return;
    setMsg(null);
    setPrize(null);
    setWinningIndex(null);

    let res: Response | null = null;
    try {
      res = await fetch('/api/claim', {
        method:'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ code: code.trim() })
      });
    } catch {
      setMsg({kind:'error', text:'Koneksi bermasalah. Coba lagi.'});
      return;
    }

    let data: ClaimResp;
    try {
      data = (await res!.json()) as ClaimResp;
    } catch {
      setMsg({ kind: 'error', text: 'Respon tidak valid dari server.' });
      return;
    }

    if (!data.ok) {
      const reasonMap: Record<ClaimErr['reason'], string> = {
        INVALID_CODE: 'Kode tidak ditemukan.',
        ALREADY_USED: 'Kode sudah pernah dipakai.',
        EXPIRED: 'Kode sudah kedaluwarsa.',
        UNABLE_TO_CLAIM: 'Kode tidak bisa diklaim.',
        SERVER_ERROR: 'Terjadi kesalahan server.'
      };
      setMsg({ kind: 'error', text: reasonMap[data.reason] || 'Gagal.' });
      return;
    }

    const { amount, wheel } = data;
    setSegments([...wheel.segments, { icon: 'android' } as WheelSegmentSpec]);
    setSpinMs(wheel.spinMs);

    // --- hitung target sudut relatif terhadap sudut sekarang
    const N = wheel.segments.length;
    const step = 360 / Math.max(N, 1);
    const centerDeg = wheel.targetIndex * step + step / 2; // sudut segmen target
    const targetAngle = norm(360 - centerDeg);             // posisi target di bawah pointer (0°)

    const baseTurns = 6 + Math.floor(Math.random() * 2);   // 6–7 putaran setiap kali
    const startAngle = norm(rotation);                     // sudut saat ini (0..359)
    const delta = baseTurns * 360 + norm(targetAngle - startAngle);

    setShowPanel(false);
    // 1) matikan transition → set ke startAngle (instant, no anim)
    setSpinning(false);
    requestAnimationFrame(() => {
      setRotation(startAngle);
      // 2) di frame berikutnya: nyalakan transition + set ke tujuan (anim jalan panjang)
      requestAnimationFrame(() => {
        setSpinning(true);
        setRotation(startAngle + delta);
      });
    });

    window.setTimeout(()=>{
      setSpinning(false);
      setPrize(amount);
      setWinningIndex(wheel.targetIndex);
    }, wheel.spinMs + 120);
  }

  // helper
  function norm(a: number) {
    return ((a % 360) + 360) % 360;
  }

  const centerContent = (
    <div className="center-ui">
      {!showPanel && !showResult && (
        <button
          className="cta-icon"
          onClick={() => setShowPanel(true)}
          disabled={spinning}
          aria-disabled={spinning}
          aria-label="Masukkan kode dan putar"
        >
          {/* Pakai file ikon milikmu */}
          <img
            src={HUB_ICON_URL}
            alt="Buka input kode & putar"
            className="hub-img"
            draggable={false}
          />
        </button>
      )}

      {showPanel && !showResult && (
        <div className="panel">
          {msg && msg.kind === 'error' && <div className="alert alert-error">{msg.text}</div>}
          <input
            className="input"
            placeholder="Contoh: ABCD1234EF"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g,''))}
            autoFocus
            inputMode="text"
          />
          <button className="btn btn-primary" onClick={handleSpin} disabled={disabled}>
            {spinning ? 'Memutar…' : 'Putar'}
          </button>
          <button className="btn" onClick={() => setShowPanel(false)} disabled={spinning}>Tutup</button>
        </div>
      )}
    </div>
  );

  return (
    <main className="screen">
      {/* Background effects */}
      <LightningFX />
      <RainFX />

      {/* Wheel… (tetap sama) */}
      <Wheel
        segments={segments}
        rotationDeg={rotation}
        spinning={spinning}
        spinMs={spinMs}
        hubFill={HUB_FILL}
        winningIndex={winningIndex}
      >
        {centerContent}
      </Wheel>

      {/* Modal Hasil */}
      {showResult && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setPrize(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Selamat!</div>
            <div className="modal-amount">
              {new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(prize!)}
            </div>
            <div className="modal-actions">
              <a className="btn btn-primary" href={CONTACT_URL} target="_blank" rel="noopener noreferrer">Hubungi Kami</a>
              <button className="btn" onClick={() => setPrize(null)}>Oke</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
