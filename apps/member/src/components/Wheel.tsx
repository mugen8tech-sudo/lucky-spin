'use client';
import React, { useMemo } from 'react';

type Props = {
  segments: number[];
  rotationDeg: number;          // rotasi total roda, diterapkan ke container .wheel-disk (CSS)
  spinning: boolean;
  spinMs: number;
  children?: React.ReactNode;   // konten di pusat (ikon/hasil)
  hubFill?: string;             // warna hub
  winningIndex?: number | null; // highlight pemenang
};

type Wedge = {
  d: string;       // path segmen
  fill: string;    // warna segmen
  label: string;   // teks nominal
  midDeg: number;  // sudut tengah wedge (deg), 0° = atas
  edgeD: string;   // arc tepi luar
  idx: number;     // index segmen
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

  // Geometri dasar
  const R = 220;               // radius piringan segmen
  const cx = 250, cy = 250;    // pusat viewBox
  const textR = R - 55;        // radius teks (posisi label)

  // Palet warna
  const colors = useMemo(() => {
    const base = ['#22c55e','#0ea5e9','#f59e0b','#ef4444','#a78bfa','#14b8a6','#eab308','#f43f5e'];
    return Array.from({ length: N }, (_, i) => base[i % base.length]);
  }, [N]);

  // Build wedges
  const items = useMemo<Wedge[]>(() => {
    const arr: Wedge[] = [];
    for (let i = 0; i < N; i++) {
      // SVG: 0° = ke kanan; kita geser -90° supaya 0° = atas
      const start = ((i * step - 90) * Math.PI) / 180;
      const end   = (((i + 1) * step - 90) * Math.PI) / 180;

      const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
      const x2 = cx + R * Math.cos(end),   y2 = cy + R * Math.sin(end);
      const largeArc = step > 180 ? 1 : 0;

      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const edgeD = `M ${x1} ${y1} A ${R + 3} ${R + 3} 0 ${largeArc} 1 ${x2} ${y2}`;
      const midDeg = (i + 0.5) * step - 90; // sudut bisektor wedge (0° = atas)

      arr.push({
        d,
        fill: colors[i],
        label: formatIDR(segments[i]),
        midDeg,
        edgeD,
        idx: i,
      });
    }
    return arr;
  }, [N, step, colors, segments]);

  // Kontras hub
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

        {/* Disk berputar via CSS */}
        <div
          className="wheel-disk"
          style={{
            transform: `rotate(${rotationDeg}deg)`,
            transition: spinning ? `transform ${spinMs}ms cubic-bezier(0.12, 0.01, 0, 1)` : 'none',
          }}
        >
          <svg width="100%" height="100%" viewBox="0 0 500 500" style={{ display: 'block' }}>
            {/* LAYER 1: wedges */}
            <g className="wedge-layer">
              {items.map((p) => (
                <g key={`w-${p.idx}`}>
                  <path d={p.d} fill={p.fill} />
                  <path d={p.d} fill="none" stroke="rgba(15,23,42,.22)" strokeWidth="1.5" />
                </g>
              ))}
            </g>

            {/* LAYER 2: highlight pemenang */}
            {typeof winningIndex === 'number' && items[winningIndex] && (
              <g className="winner-layer">
                <path d={items[winningIndex].d} className="wedge-win-fill" />
                <path d={items[winningIndex].edgeD} className="wedge-win-arc" />
              </g>
            )}

            {/* LAYER 3: label — RADIAL mengikuti wedge + auto FLIP di sisi bawah */}
            <g className="labels-layer">
              {items.map((p) => {
                const fs = fitFont(p.label, step, textR, 11, 17);

                // Catatan penting:
                // - Seluruh <svg> ikut berputar karena parent .wheel-disk di-rotate via CSS.
                // - Jadi penentuan flip TIDAK boleh ikut rotationDeg. Cukup pakai midDeg.
                // - Jika label berada di bawah (90°..270°), putar 180° agar tetap tegak dibaca.
                const absMid = normDeg(p.midDeg);
                const flip = absMid > 90 && absMid < 270 ? 180 : 0;

                return (
                  <g
                    key={`t-${p.idx}`}
                    transform={
                      // rotate(midDeg)   -> posisikan basis teks di arah radial (miring seperti wedge)
                      // translate        -> geser ke radius label
                      // rotate(flip)     -> balik 180° hanya bila wedge ada di bawah
                      `translate(${cx} ${cy}) rotate(${p.midDeg}) translate(0 ${-textR}) rotate(${flip})`
                    }
                  >
                    <text
                      className={winningIndex === p.idx ? 'label win-label' : 'label'}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      alignmentBaseline="middle"
                      fontSize={fs}
                    >
                      {p.label}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Ring tipis */}
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

// auto-fit ukuran font berdasar chord pada radius label
function fitFont(label: string, arcDeg: number, r: number, min = 12, max = 20) {
  const arcRad = (Math.PI * arcDeg) / 180;
  const chord = 2 * r * Math.sin(arcRad / 2);
  const perChar = 0.62; // ~0.62*fontSize per karakter
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

function normDeg(d: number) {
  return ((d % 360) + 360) % 360;
}
