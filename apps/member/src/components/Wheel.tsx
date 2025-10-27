'use client';
import React, { useMemo } from 'react';

type Props = {
  segments: number[];
  rotationDeg: number; // total rotasi (deg)
  spinning: boolean;
  spinMs: number;
  children?: React.ReactNode; // konten di tengah hub (ikon/panel/hasil)
};

export default function Wheel({ segments, rotationDeg, spinning, spinMs, children }: Props) {
  const N = Math.max(segments.length, 1);
  const step = 360 / N;

  // warna segmen (cerah & kontras oke untuk teks gelap)
  const colors = useMemo(() => {
    const base = ['#22c55e', '#0ea5e9', '#f59e0b', '#ef4444', '#a78bfa', '#14b8a6', '#eab308', '#f43f5e'];
    return Array.from({ length: N }, (_, i) => base[i % base.length]);
  }, [N]);

  const paths = useMemo(() => {
    const R = 240; // radius
    const cx = 250, cy = 250;
    const items: { d: string; fill: string; label: string; rotate: number }[] = [];
    for (let i = 0; i < N; i++) {
      const start = ((i * step - 90) * Math.PI) / 180; // -90 → 0° di atas
      const end = (((i + 1) * step - 90) * Math.PI) / 180;
      const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
      const x2 = cx + R * Math.cos(end), y2 = cy + R * Math.sin(end);
      const largeArc = step > 180 ? 1 : 0;

      const d = [
        `M ${cx} ${cy}`,
        `L ${x1} ${y1}`,
        `A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ');

      const rotate = i * step + step / 2; // untuk tulisan
      items.push({ d, fill: colors[i], label: formatIDR(segments[i]), rotate });
    }
    return items;
  }, [segments, N, step, colors]);

  return (
    <div className="wheel-frame">
      {/* pointer */}
      <div className="pointer" />

      {/* roda */}
      <div
        className="wheel"
        style={{
          transform: `rotate(${rotationDeg}deg)`,
          transition: spinning ? `transform ${spinMs}ms cubic-bezier(0.12, 0.01, 0, 1)` : 'none',
          background: '#0b1323',
          border: '10px solid #0b1323',
          boxShadow:
            '0 20px 70px rgba(0,0,0,.45), inset 0 0 0 4px rgba(255,255,255,.05), inset 0 0 0 10px #0f172a',
          borderRadius: '50%',
          position: 'relative'
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 500 500" style={{ borderRadius: '50%', display: 'block' }}>
          {paths.map((p, idx) => (
            <g key={idx}>
              <path d={p.d} fill={p.fill} stroke="#0f172a" strokeWidth="2" />
              <text
                x="250"
                y="250"
                fill="#0b1220"
                fontWeight="700"
                fontSize="18"
                textAnchor="middle"
                transform={`rotate(${p.rotate} 250 250) translate(0 -170) rotate(90 250 250)`}
              >
                {p.label}
              </text>
            </g>
          ))}
          {/* hub putih (supaya ikon biru kontras dan 'nyatu') */}
          <circle cx="250" cy="250" r="66" fill="#ffffff" stroke="#e5e7eb" strokeWidth="5" />
        </svg>

        {/* slot konten pusat (ikon/panel/hasil) */}
        <div className="center-ui">{children}</div>
      </div>
    </div>
  );
}

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}
