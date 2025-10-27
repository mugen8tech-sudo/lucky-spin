'use client';
import React, { useMemo } from 'react';

type Props = {
  segments: number[];
  rotationDeg: number;      // total rotasi (deg) — diterapkan ke DISK saja
  spinning: boolean;
  spinMs: number;
  children?: React.ReactNode; // konten interaktif di pusat (ikon / panel / hasil)
  hubFill?: string;           // warna hub (default putih)
  winningIndex?: number | null; // index pemenang untuk highlight & pointer shake
};

type Wedge = {
  d: string;        // path segmen
  fill: string;     // warna segmen
  label: string;    // teks nominal
  rotate: number;   // sudut pusat wedge (untuk arc highlight)
  edgeD: string;    // arc tepi luar (untuk rim glow pemenang)
  idx: number;      // index segmen
  tx: number;       // posisi teks X (tanpa transform tambahan)
  ty: number;       // posisi teks Y
};

export default function Wheel({
  segments,
  rotationDeg,
  spinning,
  spinMs,
  children,
  hubFill = '#ffffff',
  winningIndex = null,
}: Props) {
  const N = Math.max(segments.length, 1);
  const step = 360 / N;

  // Ukuran geometri disk (bukan bezel)
  const R = 220;                 // radius piringan segmen
  const cx = 250, cy = 250;      // pusat viewBox
  const textR = R - 55;          // jarak label dari pusat (50–70 bagus)

  // Palet warna segmen
  const colors = useMemo(() => {
    const base = ['#22c55e','#0ea5e9','#f59e0b','#ef4444','#a78bfa','#14b8a6','#eab308','#f43f5e'];
    return Array.from({ length: N }, (_, i) => base[i % base.length]);
  }, [N]);

  // Bangun data wedge lengkap + koordinat label
  const items = useMemo<Wedge[]>(() => {
    const arr: Wedge[] = [];
    for (let i = 0; i < N; i++) {
      const start = ((i * step - 90) * Math.PI) / 180;
      const end   = (((i + 1) * step - 90) * Math.PI) / 180;

      const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
      const x2 = cx + R * Math.cos(end),   y2 = cy + R * Math.sin(end);
      const largeArc = step > 180 ? 1 : 0;

      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const rotate = i * step + step / 2;
      const edgeD = `M ${x1} ${y1} A ${R + 3} ${R + 3} 0 ${largeArc} 1 ${x2} ${y2}`;

      // Posisi label (tanpa rotate global), nanti diputar pada titiknya
      const theta = ((i * step + step / 2) - 90) * Math.PI / 180;
      const tx = cx + textR * Math.cos(theta);
      const ty = cy + textR * Math.sin(theta);

      arr.push({
        d, fill: colors[i], label: formatIDR(segments[i]),
        rotate, edgeD, idx: i, tx, ty
      });
    }
    return arr;
  }, [N, step, colors, segments]);

  // Kontras garis hub
  const hubStroke = isDark(hubFill) ? '#1f2937' : '#e5e7eb';
  const pointerCls = winningIndex != null ? 'pointer shake' : 'pointer';

  return (
    <div className="wheel-frame">
      {/* Pointer statis */}
      <div className={pointerCls} />

      <div className="wheel">
        {/* Bezel statis */}
        <div className="bezel-outer" />
        <div className="bezel-inner" />

        {/* Disk berputar: hanya layer ini yang diberi transform */}
        <div
          className="wheel-disk"
          style={{
            transform: `rotate(${rotationDeg}deg)`,
            transition: spinning ? `transform ${spinMs}ms cubic-bezier(0.12, 0.01, 0, 1)` : 'none',
          }}
        >
          <svg width="100%" height="100%" viewBox="0 0 500 500" style={{ display: 'block' }}>
            {/* LAYER 1: Semua wedges (tanpa teks) */}
            <g className="wedge-layer">
              {items.map((p) => (
                <g key={`w-${p.idx}`}>
                  <path d={p.d} fill={p.fill} />
                  <path d={p.d} fill="none" stroke="rgba(15,23,42,.22)" strokeWidth="1.5" />
                </g>
              ))}
            </g>

            {/* LAYER 2: Highlight pemenang (di atas wedges, di bawah teks) */}
            {typeof winningIndex === 'number' && items[winningIndex] && (
              <g className="winner-layer">
                <path d={items[winningIndex].d} className="wedge-win-fill" />
                <path d={items[winningIndex].edgeD} className="wedge-win-arc" />
              </g>
            )}

            {/* LAYER 3: Label (paling atas agar tidak ketiban wedge) */}
            <g className="labels-layer">
              {items.map((p) => (
                <text
                  key={`t-${p.idx}`}
                  x={p.tx}
                  y={p.ty}
                  className={winningIndex === p.idx ? 'label win-label' : 'label'}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  alignmentBaseline="middle"
                  // Miring tangensial terhadap lingkaran pada titik teksnya
                  transform={`rotate(${p.rotate + 90} ${p.tx} ${p.ty})`}
                >
                  {p.label}
                </text>
              ))}
            </g>

            {/* Ring tipis di tepi disk */}
            <circle cx="250" cy="250" r={R + 3} fill="none" stroke="rgba(15,23,42,.55)" strokeWidth="3" />
          </svg>
        </div>

        {/* Hub statis */}
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

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function isDark(hex: string) {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) || 0;
  const g = parseInt(m.slice(2, 4), 16) || 0;
  const b = parseInt(m.slice(4, 6), 16) || 0;
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L < 128;
}
