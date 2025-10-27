'use client';
import React, { useEffect, useRef } from 'react';

/**
 * Efek hujan fullscreen (ringan). Tidak mengganggu klik (pointer-events:none).
 * Men-generate N tetes (tergantung lebar layar) dengan durasi & delay acak.
 */
export default function RainFX() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current!;
    if (!root) return;

    // Tentukan jumlah tetes berdasarkan lebar layar
    const vw = window.innerWidth;
    const isSmall = vw < 520;
    const COUNT = isSmall ? 90 : 140; // bisa disesuaikan

    for (let i = 0; i < COUNT; i++) {
      const drop = document.createElement('div');
      drop.className = 'rain-drop';

      // Posisi horizontal acak
      const x = Math.random() * 100; // vw%
      drop.style.left = `${x}vw`;

      // Lebar/tinggi garis tetes acak (tipis = lebih cepat)
      const w = 1 + Math.random() * 1.2;     // 1 - 2.2 px
      const h = 14 + Math.random() * 10;     // 14 - 24 px
      drop.style.width = `${w}px`;
      drop.style.height = `${h}px`;

      // Durasi & delay acak
      const dur = 900 + Math.random() * 1200;        // 0.9s - 2.1s
      const delay = -Math.random() * dur;            // negative delay untuk menyebar instan
      drop.style.animationDuration = `${dur}ms`;
      drop.style.animationDelay = `${delay}ms`;

      // Drift (sedikit serong)
      const drift = -30 + Math.random() * 60;        // -30 .. +30 px
      drop.style.setProperty('--drift', `${drift}px`);

      // Opacity acak
      const op = 0.65 + Math.random() * 0.3;
      drop.style.opacity = String(op);

      root.appendChild(drop);
    }

    return () => {
      root.querySelectorAll('.rain-drop').forEach(el => el.remove());
    };
  }, []);

  return <div ref={ref} className="rain-layer" aria-hidden="true" />;
}
