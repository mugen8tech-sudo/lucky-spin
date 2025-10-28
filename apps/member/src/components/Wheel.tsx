'use client';
import React, { useMemo } from 'react';

type Props = {
  segments: number[];
  rotationDeg: number;
  spinning: boolean;
  spinMs: number;
  children?: React.ReactNode;
  hubFill?: string;
  winningIndex?: number | null;
};

type Wedge = {
  idx: number;
  d: string;
  edgeD: string;
  fill: string;
  label: string;
  midDegSVG: number; // 0° = kanan (SVG space), -90° = atas
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

  // ==== Geometri dasar
  const cx = 250, cy = 250;
  const R = 220;                 // radius wedge
  const LABEL_INSET = 64;        // <- label lebih ke dalam (semula ~44)
  const textR = R - LABEL_INSET; // radius posisi label
  const outerR = R + 3;          // rim luar

  // ==== Warna
  const colors = useMemo(() => {
    const base = ['#22c55e','#0ea5e9','#f59e0b','#ef4444','#a78bfa','#14b8a6','#eab308','#f43f5e'];
    return Array.from({ length: N }, (_, i) => base[i % base.length]);
  }, [N]);

  // ==== Build wedges
  const wedges = useMemo<Wedge[]>(() => {
    const arr: Wedge[] = [];
    for (let i = 0; i < N; i++) {
      const start = i * step - 90;
      const end   = (i + 1) * step - 90;
      const mid   = (i + 0.5) * step - 90;

      const [x1, y1] = polar(cx, cy, R, start);
      const [x2, y2] = polar(cx, cy, R, end);
      const largeArc = step > 180 ? 1 : 0;

      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const edgeD = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`;

      arr.push({
        idx: i,
        d,
        edgeD,
        fill: colors[i],
        label: formatCredit(segments[i]), // <- ganti ke "Credit 10.000"
        midDegSVG: mid,
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
          <svg width="100%" height="100%" viewBox="0 0 500 500" shapeRendering="geometricPrecision">
            {/* Wedges + separator */}
            <g className="wedge-layer" aria-hidden>
              {wedges.map(w => (
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

            {/* LABEL: lurus, miring = tangent wedge, auto-flip agar selalu tegak */}
            <g className="labels-layer">
              {wedges.map(w => {
                const rotateForPosition = w.midDegSVG + 90;             // arah radial ke bisektor
                const rotateForTangent = 90;                             // radial -> tangent
                const abs = normDeg(rotationDeg + rotateForPosition + rotateForTangent);
                const flip = (abs > 90 && abs < 270) ? 180 : 0;

                const fontSize = fitFontByChord(w.label, step, textR, 16, 24);

                return (
                  <g
                    key={`t-${w.idx}`}
                    transform={
                      `translate(${cx} ${cy}) ` +
                      `rotate(${rotateForPosition}) ` +
                      `translate(0 ${-textR}) ` +
                      `rotate(${rotateForTangent + flip})`
                    }
                  >
                    <text
                      className={winningIndex === w.idx ? 'label win-label' : 'label'}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      dy="0.35em"
                      fontSize={fontSize}
                      style={{
                        fill: '#0f172a',
                        paintOrder: 'stroke',
                        stroke: 'rgba(255,255,255,0.80)',
                        strokeWidth: 0.8,
                        fontWeight: 600,
                        letterSpacing: 0,
                        textRendering: 'geometricPrecision',
                      }}
                    >
                      {w.label}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Rim luar */}
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

        {/* Hub (tetap) */}
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

/* ===== Utils ===== */

function polar(cx: number, cy: number, r: number, degSVG: number): [number, number] {
  const rad = (degSVG * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function formatCredit(n: number) {
  // "Credit 10.000" (lokal id-ID, tanpa simbol mata uang)
  return `Credit ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`;
}

function fitFontByChord(label: string, arcDeg: number, r: number, min = 12, max = 20) {
  const arcRad = (Math.PI * arcDeg) / 180;
  const chord = 2 * r * Math.sin(arcRad / 2);
  const perChar = 0.62; // estimasi lebar karakter = 0.62 * fontSize
  const est = (chord * 0.88) / (Math.max(4, label.length) * perChar);
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
