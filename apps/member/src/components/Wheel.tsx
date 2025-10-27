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
  rotate: number;   // sudut pusat wedge (deg)
  edgeD: string;    // arc tepi luar (untuk rim glow pemenang)
  idx: number;      // index segmen
  tx: number;       // posisi teks X (legacy, tidak dipakai lagi)
  ty: number;       // posisi teks Y (legacy)
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

  // Bangun data wedge lengkap + koordinat/metadata
  const items = useMemo<Wedge[]>(() => {
    const arr: Wedge[] = [];
    for (let i = 0; i < N; i++) {
      const start = ((i * step - 90) * Math.PI) / 180;
      const end   = (((i + 1) * step - 90) * Math.PI) / 180;

      const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
      const x2 = cx + R * Math.cos(end),   y2 = cy + R * Math.sin(end);
      const largeArc = step > 180 ? 1 : 0;

      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const rotate = i * step + step / 2; // sudut tengah wedge (deg)
      const edgeD = `M ${x1} ${y1} A ${R + 3} ${R + 3} 0 ${largeArc} 1 ${x2} ${y2}`;

      // Posisi label (legacy), kini kita pakai transform group agar teks tetap horizontal
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

            {/* LAYER 3: Label (paling atas) */}
            <g className="labels-layer">
              {items.map((p) => {
                const fs = fitFont(p.label, step, textR); // auto-fit font berdasarkan chord
                // Trik transform:
                // - translate ke pusat (cx,cy)
                // - rotate ke tengah wedge
                // - translate ke radius label
                // - rotate balik agar teks horizontal
                return (
                  <g
                    key={`t-${p.idx}`}
                    transform={`translate(${cx} ${cy}) rotate(${p.rotate}) translate(0 ${-textR}) rotate(${-p.rotate})`}
                  >
                    <text
                      className={winningIndex === p.idx ? 'label win-label' : 'label'}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      alignmentBaseline="middle"
                      fontSize={fs}
                      // sedikit outline supaya kontras di semua warna slice
                      style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,.55)', strokeWidth: 3 }}
                    >
                      {p.label}
                    </text>
                  </g>
                );
              })}
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

/* ===== Helpers ===== */
function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

// Auto-fit ukuran font berdasarkan lebar chord pada radius label
function fitFont(label: string, arcDeg: number, r: number, min = 12, max = 20) {
  const arcRad = (Math.PI * arcDeg) / 180;
  const chord = 2 * r * Math.sin(arcRad / 2);       // panjang chord
  const perChar = 0.6;                               // ~0.6 * fontSize per karakter
  const est = (chord * 0.9) / (Math.max(4, label.length) * perChar);
  return Math.max(min, Math.min(max, est));
}

function isDark(hex: string) {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) || 0;
  const g = parseInt(m.slice(2, 4), 16) || 0;
  const b = parseInt(m.slice(4, 6), 16) || 0;
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L < 128;
}
