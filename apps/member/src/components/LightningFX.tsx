'use client';
import React, { useEffect, useRef } from 'react';

const MIN_MS = Math.max(300, Number(process.env.NEXT_PUBLIC_LIGHTNING_MIN_MS ?? 1200)); // default 1.2s
const MAX_MS = Math.max(MIN_MS + 200, Number(process.env.NEXT_PUBLIC_LIGHTNING_MAX_MS ?? 2600)); // default 2.6s

export default function LightningFX() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const root = ref.current!;
    if (!root) return;

    const spawnOnce = () => {
      if (!alive) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const x = Math.round(Math.random() * vw);
      const y = Math.round(vh * 0.2 + Math.random() * vh * 0.6);

      const bolt = document.createElement('div');
      bolt.className = 'fx-bolt';
      const rot = -20 + Math.random() * 40;
      const scl = 0.8 + Math.random() * 0.7;
      bolt.style.left = `${x - 8}px`;
      bolt.style.top = `${y - 120}px`;
      bolt.style.transform = `rotate(${rot}deg) scale(${scl})`;

      const flash = document.createElement('div');
      flash.className = 'fx-flash';
      flash.style.setProperty('--x', `${Math.round((x / vw) * 100)}%`);
      flash.style.setProperty('--y', `${Math.round((y / vh) * 100)}%`);

      root.appendChild(flash);
      root.appendChild(bolt);

      setTimeout(() => flash.remove(), 650);
      setTimeout(() => bolt.remove(), 950);

      // interval dipercepat (acak antara MIN..MAX)
      const next = MIN_MS + Math.random() * (MAX_MS - MIN_MS);
      setTimeout(spawnOnce, next);
    };

    const t = window.setTimeout(spawnOnce, 600 + Math.random() * 600);
    return () => {
      alive = false;
      window.clearTimeout(t);
      if (root) root.querySelectorAll('.fx-bolt, .fx-flash').forEach(el => el.remove());
    };
  }, []);

  return <div ref={ref} className="fx-layer" aria-hidden="true" />;
}
