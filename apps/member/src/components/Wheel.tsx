'use client';
import React, { useMemo } from 'react';

type Props = {
  segments: number[];
  rotationDeg: number;   // total rotasi (deg) — diterapkan ke DISK saja
  spinning: boolean;
  spinMs: number;
  children?: React.ReactNode; // konten interaktif di pusat (ikon / panel / hasil)
  hubFill?: string;           // warna hub (default putih)
  winningIndex?: number | null;     // NEW
};

export default function Wheel({
  segments,
  rotationDeg,
  spinning,
  spinMs,
  children,
  hubFill = '#ffffff',
  winningIndex = null,              // NEW
}: Props) {
  const N = Math.max(segments.length, 1);
  const step = 360 / N;

  // palet segmen
  const colors = useMemo(() => {
    const base = ['#22c55e', '#0ea5e9', '#f59e0b', '#ef4444', '#a78bfa', '#14b8a6', '#eab308', '#f43f5e'];
    return Array.from({ length: N }, (_, i) => base[i % base.length]);
  }, [N]);

  // hitung path tiap segmen (DIK: disk berputar, bukan bezel/hub)
  const paths = useMemo(() => {
    // gunakan radius lebih kecil agar ada ruang rim/bezel
    const R = 220; // radius untuk segmen
    const cx = 250, cy = 250;
    const items: { d: string; fill: string; label: string; rotate: number }[] = [];
    for (let i = 0; i < N; i++) {
      const start = ((i * step - 90) * Math.PI) / 180; // -90 => 0° di atas
      const end = (((i + 1) * step - 90) * Math.PI) / 180;
      const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
      const x2 = cx + R * Math.cos(end),   y2 = cy + R * Math.sin(end);
      const largeArc = step > 180 ? 1 : 0;
      const d = [
        `M ${cx} ${cy}`,
        `L ${x1} ${y1}`,
        `A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`,
        'Z',
      ].join(' ');
      const rotate = i * step + step / 2;
      const edgeD = `M ${x1} ${y1} A ${R+3} ${R+3} 0 ${largeArc} 1 ${x2} ${y2}`; // ring di tepi
      items.push({ d, fill: colors[i], label: formatIDR(segments[i]), rotate, edgeD, idx: i });
    }
    return items;
  }, [segments, N, step, colors]);

  // stroke kontras untuk hub
  const hubStroke = isDark(hubFill) ? '#1f2937' : '#e5e7eb';
  const pointerCls = winningIndex != null ? 'pointer shake' : 'pointer'; // NEW

  return (
    <div className="wheel-frame">
      <div className={pointerCls} />   {/* NEW: shake saat menang */}

      <div className="wheel">
        <div className="bezel-outer" />
        <div className="bezel-inner" />

        <div
          className="wheel-disk"
          style={{
            transform: `rotate(${rotationDeg}deg)`,
            transition: spinning ? `transform ${spinMs}ms cubic-bezier(0.12, 0.01, 0, 1)` : 'none',
          }}
        >
          <svg width="100%" height="100%" viewBox="0 0 500 500" style={{ display: 'block' }}>
            {items.map((p) => {
              const isWin = winningIndex === p.idx;
              return (
                <g key={p.idx}>
                  {/* segmen dasar */}
                  <path d={p.d} fill={p.fill} />
                  <path d={p.d} fill="none" stroke="rgba(15,23,42,.22)" strokeWidth="1.5" />

                  {/* highlight pemenang */}
                  {isWin && (
                    <>
                      {/* inner glow (menerangi wedge) */}
                      <path d={p.d} className="wedge-win-fill" />
                      {/* rim glow di tepi wedge */}
                      <path d={p.edgeD} className="wedge-win-arc" />
                    </>
                  )}

                  {/* label */}
                  <text
                    x="250"
                    y="250"
                    className={isWin ? 'label win-label' : 'label'}
                    textAnchor="middle"
                    transform={`rotate(${p.rotate} 250 250) translate(0 -165) rotate(90 250 250)`}
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
            <circle cx="250" cy="250" r={R+3} fill="none" stroke="rgba(15,23,42,.55)" strokeWidth="3" />
          </svg>
        </div>

        <div
          className="hub"
          style={{ backgroundColor: hubFill, boxShadow: `inset 0 0 0 5px ${hubStroke}, 0 6px 18px rgba(0,0,0,.45)` }}
        >
          <div className="center-ui">{children}</div>
        </div>
      </div>
    </div>
  );
}

function formatIDR(n:number) {
  return new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 }).format(n);
}
function isDark(hex:string){
  const m = hex.replace('#','');
  const r = parseInt(m.slice(0,2),16)||0, g = parseInt(m.slice(2,4),16)||0, b = parseInt(m.slice(4,6),16)||0;
  const L = 0.2126*r + 0.7152*g + 0.0722*b;
  return L < 128;
}
