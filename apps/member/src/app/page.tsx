'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import RainFX from '../components/RainFX';
import LightningFX from '../components/LightningFX';
import Wheel, { type SegmentSpec as WheelSegmentSpec } from '../components/Wheel';

type ClaimOk = {
  ok: true;
  amount: number;
  wheel: { segments: number[]; targetIndex: number; spinMs: number };
};
type ClaimErr = {
  ok: false;
  reason:
    | 'INVALID_CODE'
    | 'ALREADY_USED'
    | 'EXPIRED'
    | 'UNABLE_TO_CLAIM'
    | 'SERVER_ERROR';
  detail?: string;
};
type ClaimResp = ClaimOk | ClaimErr;

const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL || '#';
const HUB_ICON_URL =
  process.env.NEXT_PUBLIC_HUB_ICON_URL || '/hub-icon.png';
const HUB_FILL = (process.env.NEXT_PUBLIC_HUB_FILL || '#ffffff') as string;

export default function Page() {
  // ====== Wheel
  const [segments, setSegments] = useState<WheelSegmentSpec[]>([
    5000, 10000, 15000, 20000, 25000, 30000, 35000, 50000, 100000, 250000, 500000, 25000,
  ]);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [spinMs, setSpinMs] = useState(2600);

  // ====== Hub / Panel
  const [showPanel, setShowPanel] = useState(false);
  const [code, setCode] = useState('');

  // ====== Result Modal
  const [prize, setPrize] = useState<number | null>(null);
  const showResult = prize != null;

  // Disabled state
  const disabled = useMemo(
    () => spinning || !code.trim(),
    [spinning, code]
  );

  // Lock scroll saat panel/modal tampil (nyaman di mobile)
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
    setSpinning(true);

    let res: Response;
    try {
      // backend kamu bisa GET ataupun POST; sesuaikan jika beda
      res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
    } catch (e) {
      console.error(e);
      setSpinning(false);
      alert('Gagal menghubungi server.');
      return;
    }

    let data: ClaimResp;
    try {
      data = (await res.json()) as ClaimResp;
    } catch (e) {
      console.error(e);
      setSpinning(false);
      alert('Respon server tidak valid.');
      return;
    }

    if (!data.ok) {
      setSpinning(false);
      const msg =
        data.reason === 'INVALID_CODE'
          ? 'Kode tidak valid.'
          : data.reason === 'ALREADY_USED'
          ? 'Kode sudah dipakai.'
          : data.reason === 'EXPIRED'
          ? 'Kode sudah kadaluarsa.'
          : 'Tidak dapat memproses klaim.';
      alert(msg);
      return;
    }

    // Build wheel dari server
    const { wheel, amount } = { wheel: data.wheel, amount: data.amount };

    // inject 1 ikon sebagai contoh (opsional, aman dihapus)
    setSegments([
      ...wheel.segments,
      { image: '/icons/android.png', size: 54 } as WheelSegmentSpec,
    ]);

    // hitung rotasi agar pointer berhenti tepat di pusat wedge target
    const N = wheel.segments.length + 1; // +1 jika ikon disisipkan
    const step = 360 / N;
    const targetIdx = wheel.targetIndex % N;
    const targetAngle = 360 - (targetIdx * step + step / 2); // pointer di atas (0deg)
    const now = rotationDeg % 360;
    const baseTurns = 6 * 360; // putaran dasar
    const delta = normDeg(targetAngle - now);
    const finalDeg = rotationDeg + baseTurns + delta;

    setSpinMs(wheel.spinMs || 2600);
    setRotationDeg(finalDeg);

    // selesai -> tampilkan hadiah
    window.setTimeout(() => {
      setSpinning(false);
      setShowPanel(false);
      setPrize(amount);
    }, wheel.spinMs || 2600);
  }

  // Modal ref untuk efek flash 1×
  const resultRef = useRef<HTMLDivElement>(null);

  return (
    <main className="screen">
      {/* BG still / GIF (jika ada) */}
      <div className="bg-gif" aria-hidden="true" />
      {/* Hujan + petir looping halus */}
      <div className="rain-layer" aria-hidden="true">
        <RainFX />
        <LightningFX />
      </div>

      {/* Wheel */}
      <div className="wheel-frame">
        <Wheel
          segments={segments}
          rotationDeg={rotationDeg}
          spinning={spinning}
          spinMs={spinMs}
          hubFill={HUB_FILL}
        >
          {/* Konten di tengah hub */}
          <div className="hub-ui">
            <img
              src={HUB_ICON_URL}
              alt="hub"
              width={64}
              height={64}
              className="hub-icon"
              draggable={false}
            />
            <button
              className="btn btn-primary hub-button"
              onClick={() => setShowPanel(true)}
              disabled={spinning}
              aria-haspopup="dialog"
            >
              {spinning ? 'Loading…' : 'Putar'}
            </button>
          </div>
        </Wheel>
      </div>

      {/* Panel input kode */}
      {showPanel && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !spinning && setShowPanel(false)}
        >
          <div
            className="panel"
            onClick={(e) => e.stopPropagation()}
            role="group"
            aria-label="Masukkan kode"
          >
            <input
              className="input"
              placeholder="Contoh: ABCD1234EF"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={spinning}
              inputMode="text"
              autoFocus
            />
            <button
              className="btn btn-primary"
              onClick={handleSpin}
              disabled={disabled}
            >
              {spinning ? 'Loading…' : 'Putar'}
            </button>
            <button
              className="btn"
              onClick={() => setShowPanel(false)}
              disabled={spinning}
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Modal hasil */}
      {showResult && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setPrize(null)}
        >
          {/* Flash 1× pakai kelas LightningFX/Flash radial yang sudah ada */}
          <ModalStrikeOnce key={prize ?? 0} anchor={resultRef} />

          <div
            className="modal-card"
            ref={resultRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-title">Selamat!</div>
            <div className="modal-amount">
              {new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0,
              }).format(prize!)}
            </div>
            <div className="modal-actions">
              <a
                className="btn btn-primary"
                href={CONTACT_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Hubungi Kami
              </a>
              <button className="btn" onClick={() => setPrize(null)}>
                Oke
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ========= Helper & FX ========= */

function normDeg(d: number) {
  return ((d % 360) + 360) % 360;
}

/** Flash petir sekali, memanfaatkan style/animasi dari LightningFX.tsx + globals.css */
function ModalStrikeOnce({
  anchor,
}: {
  anchor: React.RefObject<HTMLElement>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = anchor.current?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : vw / 2;
    const cy = rect ? rect.top + rect.height / 2 : vh / 2;

    // Flash radial (pakai kelas fx-flash dari CSS kamu)
    const flash = document.createElement('div');
    flash.className = 'fx-flash';
    flash.style.setProperty('--x', `${Math.round((cx / vw) * 100)}%`);
    flash.style.setProperty('--y', `${Math.round((cy / vh) * 100)}%`);

    // SVG fractal petir mini (pakai kelas bolt-glow / bolt-core)
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'fx-mega-svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    const addPolyline = (pts: number[][]) => {
      const p = pts.map((p) => `${p[0]},${p[1]}`).join(' ');
      const glow = document.createElementNS(ns, 'polyline');
      glow.setAttribute('points', p);
      glow.setAttribute('pathLength', '1');
      glow.setAttribute('class', 'bolt-glow');
      const core = document.createElementNS(ns, 'polyline');
      core.setAttribute('points', p);
      core.setAttribute('pathLength', '1');
      core.setAttribute('class', 'bolt-core');
      svg.appendChild(glow);
      svg.appendChild(core);
    };

    // Garis pendek di sekitar modal (supaya tidak menutupi layar)
    const main = fractalBolt(
      cx,
      cy - vh * 0.18,
      cx,
      cy + vh * 0.08,
      vw * 0.02,
      3
    );
    addPolyline(main);

    host.appendChild(flash);
    host.appendChild(svg);

    // Bersihkan (benar-benar sekali)
    const t1 = setTimeout(() => flash.remove(), 520);
    const t2 = setTimeout(() => svg.remove(), 620);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      flash.remove();
      svg.remove();
    };
  }, [anchor]);

  return <div className="modal-flash" ref={hostRef} aria-hidden />;
}

/** Fractal bolt sederhana (midpoint displacement) */
function fractalBolt(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  amp: number,
  depth: number
): number[][] {
  const pts: number[][] = [
    [x1, y1],
    [x2, y2],
  ];
  const rand = (n: number) => (Math.random() - 0.5) * n * 2;
  for (let i = 0; i < depth; i++) {
    const next: number[][] = [];
    for (let j = 0; j < pts.length - 1; j++) {
      const [ax, ay] = pts[j],
        [bx, by] = pts[j + 1];
      const mx = (ax + bx) / 2,
        my = (ay + by) / 2;
      next.push([ax, ay], [mx + rand(amp), my + rand(amp * 0.15)]);
    }
    next.push(pts[pts.length - 1]);
    pts.splice(0, pts.length, ...next);
    amp *= 0.55;
  }
  return pts;
}
