'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import RainFX from '../components/RainFX';
import LightningFX from '../components/LightningFX';
import Wheel, { type SegmentSpec as WheelSegmentSpec } from '../components/Wheel';

type ClaimOk = {
  ok: true;
  amount: number;
  wheel: { segments: WheelSegmentSpec[]; targetIndex: number; spinMs: number };
};
type ClaimErr = {
  ok: false;
  reason: 'INVALID_CODE' | 'ALREADY_USED' | 'EXPIRED' | 'UNABLE_TO_CLAIM' | 'SERVER_ERROR';
  detail?: string;
};
type ClaimResp = ClaimOk | ClaimErr;

const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL || '#';
const HUB_ICON_URL = process.env.NEXT_PUBLIC_HUB_ICON_URL || '/hub-icon.png';
const HUB_FILL = (process.env.NEXT_PUBLIC_HUB_FILL || '#ffffff') as string;

/** Flash petir SEKALI saat overlay hasil muncul */
function OverlayBoltFlashOnce() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    const rect = host.getBoundingClientRect();
    const vw = Math.max(1, rect.width);
    const vh = Math.max(1, rect.height);

    // posisi X agak ke tengah supaya terlihat dramatis
    const x = Math.round(vw * (0.42 + Math.random() * 0.16));

    // === fractal polyline utama (dari atas ke bawah)
    const main = fractalBolt(x, -40, x, vh + 40, vw * 0.06, 6);

    // 2–3 cabang
    const branches: number[][][] = [];
    const branchCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < branchCount; i++) {
      const startIdx = 6 + Math.floor(Math.random() * Math.max(6, main.length - 12));
      const [sx, sy] = main[startIdx];
      const dir = Math.random() < 0.5 ? -1 : 1;
      const len = vh * (0.18 + Math.random() * 0.22);
      const endX = sx + dir * (vw * (0.06 + Math.random() * 0.08));
      const endY = sy + len;
      branches.push(fractalBolt(sx, sy, endX, endY, vw * 0.04, 4));
    }

    // === NEW: kilatan layar seluruh overlay (di bawah stroke petir)
    const screenFlash = document.createElement('div');     // <--
    screenFlash.className = 'fx-screen-flash';             // <--
    host.appendChild(screenFlash);                         // <--

    // === SVG overlay dengan glow
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    svg.style.pointerEvents = 'none';

    const defs = document.createElementNS(svg.namespaceURI, 'defs');
    defs.innerHTML = `
      <filter id="glowBlue" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="b1"/>
        <feGaussianBlur in="b1" stdDeviation="8" result="b2"/>
        <feMerge>
          <feMergeNode in="b2"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    `;
    svg.appendChild(defs);

    const addPolyline = (pts: number[][], isBranch = false) => {
      const pstr = pts.map(p => `${p[0]},${p[1]}`).join(' ');
      const glow = document.createElementNS(svg.namespaceURI, 'polyline');
      glow.setAttribute('points', pstr);
      glow.setAttribute('pathLength', '1');
      glow.setAttribute('class', isBranch ? 'bolt-glow bolt-branch' : 'bolt-glow');

      const core = document.createElementNS(svg.namespaceURI, 'polyline');
      core.setAttribute('points', pstr);
      core.setAttribute('pathLength', '1');
      core.setAttribute('class', isBranch ? 'bolt-core bolt-branch' : 'bolt-core');

      svg.appendChild(glow);
      svg.appendChild(core);
    };

    addPolyline(main, false);
    branches.forEach(b => addPolyline(b, true));

    // radial flash putih kebiruan
    const flash = document.createElement('div');
    flash.className = 'fx-flash';
    flash.style.setProperty('--x', `${Math.round((x / vw) * 100)}%`);
    flash.style.setProperty('--y', `50%`);

    host.appendChild(flash);
    host.appendChild(svg);

    // cleanup after one shot
    const t1 = setTimeout(() => flash.remove(), 560);
    const t2 = setTimeout(() => svg.remove(), 620);
    const t3 = setTimeout(() => screenFlash.remove(), 620); // <--
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); // <--
      flash.remove(); svg.remove(); screenFlash.remove();   // <--
    };
  }, []);

  return <div ref={ref} className="fx-once" aria-hidden="true" />;
}

/** Fractal bolt helper (diambil dari LightningFX.tsx sebagai referensi) */
function fractalBolt(x1: number, y1: number, x2: number, y2: number, amp: number, depth: number): number[][] {
  const pts: number[][] = [[x1, y1], [x2, y2]];
  const rand = (n: number) => (Math.random() - 0.5) * n * 2;

  for (let i = 0; i < depth; i++) {
    const next: number[][] = [];
    for (let j = 0; j < pts.length - 1; j++) {
      const [ax, ay] = pts[j];
      const [bx, by] = pts[j + 1];
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const nx = mx + rand(amp);
      const ny = my + rand(amp * 0.15);
      next.push([ax, ay], [nx, ny]);
    }
    next.push(pts[pts.length - 1]);
    pts.splice(0, pts.length, ...next);
    amp *= 0.55;
  }
  return pts;
}

export default function Page() {
  // UI
  const [code, setCode] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [msg, setMsg] = useState<{kind:'error'|'success'; text:string} | null>(null);

  // Wheel
  const [segments, setSegments] = useState<WheelSegmentSpec[]>([
    5000, 10000, 15000, 20000, 25000, 30000, 35000, 50000, 100000, 250000, 500000,
    { image: '/icons/android.png', size: 60, alt: 'Android Bonus' }  // << ikon PNG
  ]);
  const [spinMs, setSpinMs] = useState(6000);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [claiming, setClaiming] = useState(false);

  // Result
  const [prize, setPrize] = useState<number | null>(null);
  const [winningIndex, setWinningIndex] = useState<number | null>(null);
  
  const showResult = prize != null;
  const disabled = useMemo(
    () => claiming || spinning || !code.trim(),
    [claiming, spinning, code]
  );

  // Lock scroll saat panel/modal tampil (nyaman di mobile)
  useEffect(()=>{
    const lock = showPanel || showResult;
    const prev = document.body.style.overflow;
    if (lock) document.body.style.overflow = 'hidden';
    return ()=> { document.body.style.overflow = prev; };
  }, [showPanel, showResult]);

  // Selalu kosongkan input & bersihkan pesan saat panel dibuka
  useEffect(() => {
    if (showPanel) {
      setCode('');
      setMsg(null);
    }
  }, [showPanel]);

  async function handleSpin() {
    if (disabled) return;
    setMsg(null);
    setPrize(null);
    setWinningIndex(null);
    setClaiming(true); // <-- mulai loading

    let res: Response | null = null;
    try {
      res = await fetch('/api/claim', {
        method:'POST',
        headers: { 'Content-Type':'application/json' },
        cache: 'no-store', // penting: selalu ambil konfigurasi wheel terbaru
        body: JSON.stringify({ code: code.trim() })
      });
    } catch {
      setClaiming(false); // <-- stop loading
      setMsg({kind:'error', text:'Koneksi bermasalah. Coba lagi.'});
      return;
    }

    let data: ClaimResp;
    try {
      data = await res!.json();
    } catch {
      setClaiming(false); // <-- stop loading
      setMsg({ kind:'error', text:'Respon tidak valid dari server.' });
      return;
    }

    if (!data.ok) {
      setClaiming(false); // <-- stop loading
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

    // rakit segmen yang akan dipakai render (tambahkan ikon jika belum ada)
    const hasIcon = wheel.segments.some(
      (s: any) => s && typeof s === 'object' && 'image' in s
    );
    const nextSegments = hasIcon
      ? wheel.segments
      : [...wheel.segments, { image: '/icons/android.png', size: 60, alt: 'Android Bonus' }];

    // set ke state untuk render
    setSegments(nextSegments);
    setSpinMs(wheel.spinMs);
    setClaiming(false);       // <-- stop loading (panel akan ditutup sesaat lagi)
    setShowPanel(false);      // lanjut animasi spin

    // === gunakan panjang 'nextSegments' (bukan wheel.segments) untuk kalibrasi sudut
    const N = nextSegments.length;
    const step = 360 / Math.max(N, 1);
    const centerDeg = wheel.targetIndex * step + step / 2; // pusat wedge pemenang
    const targetAngle = norm(360 - centerDeg);             // posisikan tepat di bawah pointer (12 o'clock)

    // animasi putar
    const baseTurns = 9 + Math.floor(Math.random() * 2);   // 6–7 putaran
    const startAngle = norm(rotation);
    const delta = baseTurns * 360 + norm(targetAngle - startAngle);

    // mulai spin
    setShowPanel(false);
    setSpinning(false);
    requestAnimationFrame(() => {
      setRotation(startAngle);
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
            placeholder="Masukkan Kode Voucher Anda"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
          />
          <button className="btn btn-primary" onClick={handleSpin} disabled={disabled}>
            {spinning ? 'Memutar…' : 'Putar'}
          </button>
          <button
            className="btn"
            onClick={() => { setShowPanel(false); setCode(''); setMsg(null); }}
            disabled={spinning || claiming}
          >
            Tutup
          </button>
        </div>
      )}
    </div>
  );

  return (
    <main className="screen">
      {/* Background effects */}
      <div className="bg-gif" aria-hidden />
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
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => { setPrize(null); setCode(''); }}
        >
          {/* ⚡ efek petir sekali saat overlay muncul */}
          <OverlayBoltFlashOnce />
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Selamat!</div>
            <div className="modal-amount">
              {new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(prize!)}
            </div>
            <div className="modal-actions">
              <a className="btn btn-primary" href={CONTACT_URL} target="_blank" rel="noopener noreferrer">Hubungi Kami</a>
              <button className="btn" onClick={() => { setPrize(null); setCode(''); }}>Oke</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
