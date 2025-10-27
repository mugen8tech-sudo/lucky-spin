'use client';
import React, { useMemo } from 'react';

type Props = {
  segments: number[];
  rotationDeg: number;   // dipakai untuk sync flip label saat roda diputar (CSS transform)
  spinning: boolean;
  spinMs: number;
  children?: React.ReactNode;
  hubFill?: string;
  winningIndex?: number | null;
};

type Wedge = {
  idx: number;
  startDegSVG: number;   // derajat awal (SVG space) = derajat dunia - 90°
  endDegSVG: number;     // derajat akhir (SVG space)
  midDegSVG: number;     // bisektor (SVG space)
  fill: string;
  label: string;
  d: string;             // path sektor
  edgeD: string;         // arc luar untuk glow
  labelPath: string;     // arc label (arah normal, sweep=1)
  labelPathReversed: string; // arc label kebalik (untuk setengah bawah), sweep=0
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

  // Geometri dasar SVG
  const cx = 250, cy = 250;
  const R = 220;               // radius wedge
  const textR = R - 44;        // radius label (dekat tepi, tetap aman dari bezel)
  const outerR = R + 3;        // rim luar

  // Palet warna
  const colors = useMemo(() => {
    const base = ['#22c55e','#0ea5e9','#f59e0b','#ef4444','#a78bfa','#14b8a6','#eab308','#f43f5e'];
    return Array.from({ length: N }, (_, i) => base[i % base.length]);
  }, [N]);

  const wedges = useMemo<Wedge[]>(() => {
    const arr: Wedge[] = [];
    for (let i = 0; i < N; i++) {
      // Derajat dunia (0° di atas), lalu konversi ke "SVG space" (0° di kanan) => -90°
      const startDegSVG = (i * step) - 90;
      const endDegSVG   = ((i + 1) * step) - 90;
      const midDegSVG   = ((i + 0.5) * step) - 90;

      // titik busur
      const [x1, y1] = polar(cx, cy, R, startDegSVG);
      const [x2, y2] = polar(cx, cy, R, endDegSVG);
      const largeArc = step > 180 ? 1 : 0;

      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const edgeD = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`;

      // Arc untuk label (arah normal: sweep=1)
      const labelPath = describeArc(cx, cy, textR, startDegSVG, endDegSVG, /*sweep=*/1);
      // Arc kebalik untuk sisi bawah (supaya teks tetap tegak): sweep=0
      const labelPathReversed = describeArc(cx, cy, textR, endDegSVG, startDegSVG, /*sweep=*/0);

      arr.push({
        idx: i,
        startDegSVG,
        endDegSVG,
        midDegSVG,
        fill: colors[i],
        label: formatIDR(segments[i]),
        d,
        edgeD,
        labelPath,
        labelPathReversed,
      });
    }
    return arr;
  }, [N, step, colors, segments]);

  const pointerCls = winningIndex != null ? 'pointer shake' : 'pointer';
  const hubStroke = isDark(hubFill) ? '#1f2937' : '#e5e7eb';

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
            shapeRendering="geometricPrecision"
          >
            {/* defs untuk semua label arc */}
            <defs>
              {wedges.map((w) => (
                <React.Fragment key={`def-${w.idx}`}>
                  <path id={`arc-${w.idx}`} d={w.labelPath} fill="none" />
                  <path id={`arc-r-${w.idx}`} d={w.labelPathReversed} fill="none" />
                </React.Fragment>
              ))}
            </defs>

            {/* Wedges + separator crisp */}
            <g className="wedge-layer" aria-hidden>
              {wedges.map((w) => (
                <g key={`w-${w.idx}`}>
                  <path d={w.d} fill={w.fill} />
                  <path
                    d={w.d}
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
            {typeof winningIndex === 'number' && wedges[winningIndex] && (
              <g className="winner-layer" aria-hidden>
                <path d={wedges[winningIndex].d} className="wedge-win-fill" />
                <path d={wedges[winningIndex].edgeD} className="wedge-win-arc" vectorEffect="non-scaling-stroke" />
              </g>
            )}

            {/* Label mengikuti lengkung wedge + auto-flip di setengah bawah */}
            <g className="labels-layer">
              {wedges.map((w) => {
                // Sudut tangent dunia = mid + 90 (ingat nilai sudah SVG-space)
                const tangentWorld = w.midDegSVG + 90;
                const abs = normDeg(rotationDeg + tangentWorld);
                const useReversed = abs > 90 && abs < 270; // jika di bawah, pakai path kebalik agar tegak
                const pathId = useReversed ? `arc-r-${w.idx}` : `arc-${w.idx}`;

                const fs = fitFontArc(w.label, step, textR, 12, 20); // ukuran font berdasar arc length

                return (
                  <text
                    key={`t-${w.idx}`}
                    className={winningIndex === w.idx ? 'label win-label' : 'label'}
                    fontSize={fs}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <textPath
                      href={`#${pathId}`}
                      startOffset="50%"
                      method="align"
                      spacing="auto"
                    >
                      {w.label}
                    </textPath>
                  </text>
                );
              })}
            </g>

            {/* rim luar */}
            <circle
              cx={cx}
              cy={cy}
              r={outerR}
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
          style={{
            backgroundColor: hubFill,
            boxShadow: `inset 0 0 0 5px ${hubStroke}, 0 6px 18px rgba(0,0,0,.45)`,
          }}
        >
          <div className="center-ui">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ===== Utilities ===== */

function polar(cx: number, cy: number, r: number, degSVG: number): [number, number] {
  const rad = (degSVG * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDegSVG: number,
  endDegSVG: number,
  sweep: 0 | 1
) {
  const [x1, y1] = polar(cx, cy, r, startDegSVG);
  const [x2, y2] = polar(cx, cy, r, endDegSVG);
  const delta = normDeg(endDegSVG - startDegSVG);
  const largeArc = delta > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
}

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

// Ukur font berdasarkan PANJANG BUSUR (bukan chord) agar konsisten di semua sudut
function fitFontArc(
  label: string,
  arcDeg: number,
  r: number,
  min = 12,
  max = 20
) {
  const arcRad = (Math.PI * arcDeg) / 180;
  const arcLen = r * arcRad;           // panjang busur
  const perChar = 0.62;                // ~0.62 * fontSize per karakter (estimasi)
  const est = (arcLen * 0.86) / (Math.max(4, label.length) * perChar);
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
