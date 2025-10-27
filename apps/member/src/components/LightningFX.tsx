'use client';
import React, { useEffect, useRef } from 'react';

/** Interval bisa di-tune via ENV (opsional) */
const MIN_MS = Math.max(250, Number(process.env.NEXT_PUBLIC_LIGHTNING_MIN_MS ?? 900));  // default 0.9s
const MAX_MS = Math.max(MIN_MS + 150, Number(process.env.NEXT_PUBLIC_LIGHTNING_MAX_MS ?? 1800)); // default 1.8s

export default function LightningFX() {
  const bgRef = useRef<HTMLDivElement>(null);   // layer belakang (kalau nanti mau aktifkan bolt kecil)
  const topRef = useRef<HTMLDivElement>(null);  // layer depan untuk mega zap vertikal

  useEffect(() => {
    let alive = true;
    const fg = topRef.current!;
    if (!fg) return;

    const spawnMega = () => {
      if (!alive) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // posisi X acak (hindari terlalu pinggir)
      const x = Math.round(vw * (0.18 + Math.random() * 0.64));

      // ===== mega bolt: garis vertikal penuh layar
      const mega = document.createElement('div');
      mega.className = 'fx-mega';
      mega.style.left = `${x}px`;
      // tebal acak biar natural
      mega.style.width = `${3 + Math.floor(Math.random() * 4)}px`; // 3–6px

      // flash global (sekedip terang di sekitar zap)
      const flash = document.createElement('div');
      flash.className = 'fx-flash';
      flash.style.setProperty('--x', `${Math.round((x / vw) * 100)}%`);
      flash.style.setProperty('--y', `50%`);

      fg.appendChild(flash);
      fg.appendChild(mega);

      // cleanup
      setTimeout(() => flash.remove(), 520);
      setTimeout(() => mega.remove(), 460);

      // jadwal berikutnya (acak & lebih cepat)
      const next = MIN_MS + Math.random() * (MAX_MS - MIN_MS);
      setTimeout(spawnMega, next);
    };

    const t = setTimeout(spawnMega, 420 + Math.random() * 420);
    return () => {
      alive = false;
      clearTimeout(t);
      fg.querySelectorAll('.fx-mega, .fx-flash').forEach(el => el.remove());
    };
  }, []);

  return (
    <>
      {/* layer belakang (dibiarkan ada, z-index rendah; jika nanti mau aktifkan bolt kecil tinggal dipakai) */}
      <div ref={bgRef} className="fx-layer" aria-hidden="true" />
      {/* layer depan: selalu di atas roda supaya mega zap terlihat */}
      <div ref={topRef} className="fx-layer-top" aria-hidden="true" />
    </>
  );
}
