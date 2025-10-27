'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Wheel from '../components/Wheel';

type ClaimOk = {
  ok: true;
  amount: number;
  wheel: { segments: number[]; targetIndex: number; spinMs: number };
};
type ClaimErr = {
  ok: false;
  reason: 'INVALID_CODE' | 'ALREADY_USED' | 'EXPIRED' | 'UNABLE_TO_CLAIM' | 'SERVER_ERROR';
  detail?: string;
};
type ClaimResp = ClaimOk | ClaimErr;

const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL || '#';

export default function Page() {
  // UI state
  const [code, setCode] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  // Wheel state
  const [segments, setSegments] = useState<number[]>([5000, 10000, 15000, 20000, 30000, 50000, 100000]);
  const [spinMs, setSpinMs] = useState(6000);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  // Result modal
  const [prize, setPrize] = useState<number | null>(null);
  const showResult = prize != null;

  const disabled = useMemo(() => spinning || !code.trim(), [spinning, code]);

  // Lock scroll saat panel atau modal hasil tampil (nyaman di mobile)
  useEffect(() => {
    const lock = showPanel || showResult;
    const prev = document.body.style.overflow;
    if (lock) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showPanel, showResult]);

  async function handleSpin() {
    if (disabled) return;
    setMsg(null);
    setPrize(null);

    // panggil API claim
    let res: Response | null = null;
    try {
      res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() })
      });
    } catch {
      setMsg({ kind: 'error', text: 'Koneksi bermasalah. Coba lagi.' });
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

    // sukses → siapkan spin dengan target segmen yang tepat
    const { amount, wheel } = data;
    setSegments(wheel.segments);
    setSpinMs(wheel.spinMs);

    const N = wheel.segments.length;
    const step = 360 / Math.max(N, 1);
    const centerDeg = wheel.targetIndex * step + step / 2; // segmen target tepat di atas (pointer)
    const turns = 6 + Math.floor(Math.random() * 2); // 6–7 putaran
    const final = turns * 360 + (360 - centerDeg);

    setShowPanel(false);
    setSpinning(true);

    // reset → animasi
    requestAnimationFrame(() => {
      setRotation(prev => prev % 360);
      requestAnimationFrame(() => {
        setRotation(final);
      });
    });

    // selesai spin → munculkan modal hasil
    window.setTimeout(() => {
      setSpinning(false);
      setPrize(amount);
    }, wheel.spinMs + 120);
  }

  function LightningIcon(props: { size?: number | string }) {
    const size = props.size ?? 'min(120px, 22vw)';
    return (
      <svg role="img" aria-label="Buka input kode & putar" width={size} height={size} viewBox="0 0 256 256" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7dd3fc" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d="M156 16l-58 92h42l-32 116 90-132h-44l2-76z" fill="url(#g)" filter="url(#glow)" />
        <g stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" opacity=".9">
          <path d="M192 36c12 4 18 10 26 18" />
          <path d="M58 70c-10 4-16 9-22 16" />
          <path d="M188 206c10-2 18 0 28 4" />
        </g>
      </svg>
    );
  }

  // Konten pusat (di hub)
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
          <LightningIcon />
        </button>
      )}

      {showPanel && !showResult && (
        <div className="panel">
          {msg && msg.kind === 'error' && <div className="alert alert-error">{msg.text}</div>}
          <input
            className="input"
            placeholder="Contoh: ABCD1234EF"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
            autoFocus
            inputMode="text"
          />
          <button className="btn btn-primary" onClick={handleSpin} disabled={disabled}>
            {spinning ? 'Memutar…' : 'Putar'}
          </button>
          <button className="btn" onClick={() => setShowPanel(false)} disabled={spinning}>
            Tutup
          </button>
        </div>
      )}
    </div>
  );

  return (
    <main className="screen">
      <Wheel segments={segments} rotationDeg={rotation} spinning={spinning} spinMs={spinMs}>
        {centerContent}
      </Wheel>

      {/* MODAL HASIL FULL-SCREEN */}
      {showResult && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setPrize(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Selamat!</div>
            <div className="modal-amount">
              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(prize!)}
            </div>
            <div className="modal-actions">
              <a className="btn btn-primary" href={CONTACT_URL} target="_blank" rel="noopener noreferrer">
                Hubungi Kami
              </a>
              <button className="btn" onClick={() => setPrize(null)}>Oke</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
