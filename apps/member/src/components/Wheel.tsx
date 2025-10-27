'use client';
import React, { useMemo } from 'react';

type Props = {
  segments: number[];           // list nominal (angka)
  rotationDeg: number;          // rotasi disk (deg) — diterapkan di .wheel-disk
  spinning: boolean;
  spinMs: number;
  children?: React.ReactNode;   // konten di pusat
  hubFill?: string;
  winningIndex?: number | null; // index pemenang (optional highlight)
};

type Wedge = {
  d: string;        // path segmen
  fill: string;     // warna segmen
  label: string;    // label nominal (Rp x.xxx)
  midDeg: number;   // sudut bisektor wedge (deg), 0° = atas
  edgeD: string;    // arc tepi luar (untuk glow)
  idx: number;
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

  // Geometri SVG
  const R = 220;                  // radius piringan segmen
  const cx = 250, cy = 250;       // pusat viewBox
  const textR = R - 54;           // radius label (ring label)

  // Warna segmen
  const colors = useMemo(() => {
    const base = ['#22c55e','#0ea5e9','#f59e0b','#ef4444','#a78bfa','#14b8a6','#eab308','#f43f5e'];
    return Array.from({ length: N }, (_, i) => base[i % base.length]);
  }, [N]);

  // Build wedges
  const items = useMemo<Wedge[]>(() => {
    const arr: Wedge[] = [];
    for (let i = 0; i < N; i++) {
      // Shift -90° agar 0° = atas (bukan kanan)
      const start = ((i * step - 90) * Math.PI) / 180;
      const end   = (((i + 1) * step - 90) * Math.PI) / 180;

      // titik busur
      const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
      const x2 = cx + R * Math.cos(end),   y2 = cy + R * Math.sin(end);
      const largeArc = step > 180 ? 1 : 0;

      // sektor (slice)
      const d = [
        `M ${cx} ${cy}`,
        `L ${x1} ${y1}`,
        `A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ');

      // outer rim (sedikit keluar untuk glow pemenang)
      const edgeD = `M ${x1} ${y1} A ${R + 3} ${R + 3} 0 ${largeArc} 1 ${x2} ${y2}`;

      // sudut bisektor (radial)
      const midDeg = (i + 0.5) * step - 90;

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

  const hubStroke = isDark(hubFill) ? '#1f2937' : '#e5e7eb';
  const pointerCls = winningIndex != null ? 'pointer shake' : 'pointer';

  return (
    <div className="wheel-frame">
      <div className={pointerCls} />

      <div className="wheel">
        <div className="bezel-outer" />
        <div className="bezel-inner" />

        {/* Disk berputar */}
        <div
          className="wheel-disk"
          style={{
            transform: `rotate(${rotationDeg}deg)`,
            transition: spinning ? `transform ${spinMs}ms cubic-bezier(0.12, 0.01, 0, 1)` : 'none',
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 500 500"
            style={{ display: 'block' }}
            shapeRendering="geometricPrecision"
          >
            {/* Wedges */}
            <g className="wedge-layer" aria-hidden>
              {items.map((p) => (
                <g key={`w-${p.idx}`}>
                  <path
                    d={p.d}
                    fill={p.fill}
                  />
                  {/* separator tipis non-scaling agar selalu crisp */}
                  <path
                    d={p.d}
                    fill="none"
                    stroke="rgba(15,23,42,.22)"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                  />
                </g>
              ))}
            </g>

            {/* Highlight pemenang */}
            {typeof winningIndex === 'number' && items[winningIndex] && (
              <g className="winner-layer" aria-hidden>
                <path d={items[winningIndex].d} className="wedge-win-fill" />
                <path d={items[winningIndex].edgeD} className="wedge-win-arc" vectorEffect="non-scaling-stroke" />
              </g>
            )}

            {/* Label — tangent ke arc + auto-flip berdasar (rotationDeg + sudut tangent) */}
            <g className="labels-layer">
              {items.map((p) => {
                const fontSize = fitFont(p.label, step, textR, 11, 18);

                // Sudut tangent (kemiringan label mengikuti wedge/arc)
                const tangent = p.midDeg + 90; // +90° dari radial -> tangent searah putaran
                // Sudut absolut di layar saat ini
                const abs = normDeg(rotationDeg + tangent);
                // Jika berada di sisi bawah (90..270), balik 180° agar teks tidak terbalik
                const flip = abs > 90 && abs < 270 ? 180 : 0;
                const rot = tangent + flip;

                return (
                  <g
                    key={`t-${p.idx}`}
                    transform={`translate(${cx} ${cy}) rotate(${rot}) translate(0 ${-textR})`}
                  >
                    <text
                      className={winningIndex === p.idx ? 'label win-label' : 'label'}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      alignmentBaseline="middle"
                      fontSize={fontSize}
                      style={{
                        // fallback inline agar tetap terbaca kalau CSS belum termuat
                        fill: '#0f172a',
                        paintOrder: 'stroke',
                        stroke: 'rgba(255,255,255,0.78)',
                        strokeWidth: 0.8,
                        fontWeight: 500,
                        letterSpacing: 0.2,
                        textRendering: 'geometricPrecision',
                      }}
                    >
                      {p.label}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* rim luar */}
            <circle
              cx="250"
              cy="250"
              r={R + 3}
              fill="none"
              stroke="rgba(15,23,42,.55)"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        {/* Hub */}
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

// Auto-fit ukuran font berdasarkan chord pada radius label
function fitFont(label: string, arcDeg: number, r: number, min = 12, max = 20) {
  const arcRad = (Math.PI * arcDeg) / 180;
  const chord = 2 * r * Math.sin(arcRad / 2);     // panjang chord
  const perChar = 0.62;                            // ~0.62 * fontSize per karakter
  const est = (chord * 0.88) / (Math.max(4, label.length) * perChar); // sedikit lebih longgar
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
