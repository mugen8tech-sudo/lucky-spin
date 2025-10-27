'use client';
import React, { useEffect, useRef } from 'react';

/**
 * Layer efek kilat di belakang wheel (fullscreen).
 * Spawns: 1 bolt + flash radial, posisi acak, interval acak 2–5 detik.
 */
export default function LightningFX() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const root = ref.current!;
    if (!root) return;

    const spawnOnce = () => {
      if (!alive) return;

      // Posisi acak (di sekitar tepi roda)
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const x = Math.round(Math.random() * vw);
      const y = Math.round((vh * 0.2) + Math.random() * (vh * 0.6)); // hindari terlalu dekat navbar browser

      // ===== Bolt
      const bolt = document.createElement('div');
      bolt.className = 'fx-bolt';
      const rot = -20 + Math.random() * 40;         // -20° .. +20°
      const scl = 0.8 + Math.random() * 0.7;        // 0.8 .. 1.5
      bolt.style.left = `${x - 8}px`;
      bolt.style.top = `${y - 120}px`;
      bolt.style.transform = `rotate(${rot}deg) scale(${scl})`;

      // ===== Flash overlay (sekedip)
      const flash = document.createElement('div');
      flash.className = 'fx-flash';
      // pakai CSS var untuk pusat radial
      const px = Math.round((x / vw) * 100);
      const py = Math.round((y / vh) * 100);
      flash.style.setProperty('--x', `${px}%`);
      flash.style.setProperty('--y', `${py}%`);

      root.appendChild(flash);
      root.appendChild(bolt);

      // Cleanup setelah animasi
      window.setTimeout(() => flash.remove(), 650);
      window.setTimeout(() => bolt.remove(), 950);

      // Jadwalkan spawn berikutnya (acak 2–5 detik)
      const next = 2000 + Math.random() * 3000;
      window.setTimeout(spawnOnce, next);
    };

    // Start
    const firstDelay = 800 + Math.random() * 1200;
    const t = window.setTimeout(spawnOnce, firstDelay);

    return () => {
      alive = false;
      window.clearTimeout(t);
      // bersihkan anak yang tersisa
      if (root) root.querySelectorAll('.fx-bolt, .fx-flash').forEach(el => el.remove());
    };
  }, []);

  return <div ref={ref} className="fx-layer" aria-hidden="true" />;
}
