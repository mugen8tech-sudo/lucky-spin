'use client';
import React, { useEffect, useRef } from 'react';

/** Tuning interval via ENV (opsional) */
const MIN_MS = Math.max(250, Number(process.env.NEXT_PUBLIC_LIGHTNING_MIN_MS ?? 700));  // default 0.7s
const MAX_MS = Math.max(MIN_MS + 150, Number(process.env.NEXT_PUBLIC_LIGHTNING_MAX_MS ?? 1500)); // default 1.5s

export default function LightningFX() {
  const topRef = useRef<HTMLDivElement>(null); // layer depan (di atas wheel)

  useEffect(() => {
    let alive = true;
    const fg = topRef.current!;
    if (!fg) return;

    const spawn = () => {
      if (!alive) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // X acak (hindari pinggir biar glow tidak “potong”)
      const x = Math.round(vw * (0.15 + Math.random() * 0.7));

      // ===== generate polyline utama (fractal zig-zag dari top ke bottom)
      const main = fractalBolt(x, -40, x, vh + 40, vw * 0.06, 6); // amplitudo & detail
      // 2–3 cabang lebih pendek
      const branchCount = 2 + Math.floor(Math.random() * 2);
      const branches: number[][][] = [];
      for (let i = 0; i < branchCount; i++) {
        const startIdx = 6 + Math.floor(Math.random() * Math.max(6, main.length - 12));
        const [sx, sy] = main[startIdx];
        const dir = Math.random() < 0.5 ? -1 : 1;
        const len = vh * (0.18 + Math.random() * 0.22); // 18–40% tinggi
        const endX = sx + dir * (vw * (0.06 + Math.random() * 0.08));
        const endY = sy + len;
        branches.push(fractalBolt(sx, sy, endX, endY, vw * 0.04, 4));
      }

      // ===== SVG overlay (di atas wheel)
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'fx-mega-svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
      svg.setAttribute('preserveAspectRatio', 'none');

      // defs: glow
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

      // helper buat polyline (dua layer: glow dan core)
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

      // flash radial (efek sambaran)
      const flash = document.createElement('div');
      flash.className = 'fx-flash';
      flash.style.setProperty('--x', `${Math.round((x / vw) * 100)}%`);
      flash.style.setProperty('--y', `50%`);

      fg.appendChild(flash);
      fg.appendChild(svg);

      // cleanup
      setTimeout(() => flash.remove(), 560);
      setTimeout(() => svg.remove(), 620);

      // interval berikutnya
      const next = MIN_MS + Math.random() * (MAX_MS - MIN_MS);
      setTimeout(spawn, next);
    };

    const t = setTimeout(spawn, 360 + Math.random() * 360);
    return () => {
      alive = false;
      clearTimeout(t);
      fg.querySelectorAll('.fx-mega-svg, .fx-flash').forEach(el => el.remove());
    };
  }, []);

  return <div ref={topRef} className="fx-layer-top" aria-hidden="true" />;
}

/** Fractal bolt: midpoint-displacement 2D antara (x1,y1) → (x2,y2) */
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

      // offset lateral dominan, sedikit longitudinal untuk natural zig-zag
      const nx = mx + rand(amp);
      const ny = my + rand(amp * 0.15);

      next.push([ax, ay], [nx, ny]);
    }
    next.push(pts[pts.length - 1]);
    pts.splice(0, pts.length, ...next);
    amp *= 0.55; // kurangi amplitudo tiap iterasi
  }
  return pts;
}
