'use client';
import React, { useMemo } from 'react';

/** Segment bisa angka (credit) atau gambar ikon (PNG/SVG di /public). */
export type SegmentSpec =
  | number
  | {
      image: string;        // contoh: '/icons/android-badge.png'
      fill?: string;        // override warna wedge (opsional)
      size?: number;        // px (opsional; kalau tidak, auto)
      alt?: string;         // alt text (opsional)
      rotate?: number;      // rotasi tambahan ikon (deg)
    };

type Props = {
  segments: SegmentSpec[];
  rotationDeg: number;
  spinning: boolean;
  spinMs: number;
  children?: React.ReactNode;
  hubFill?: string;
  winningIndex?: number | null;
};

type BuiltSeg = {
  idx: number;
  d: string;
  edgeD: string;
  fill: string;
  mode: 'amount' | 'image';
  label: string;   // untuk mode 'amount'
  image?: { src: string; size?: number; alt?: string; rotate?: number };
  midDegSVG: number; // 0°=kanan (ruang SVG)
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

  // Geometri
  const cx = 250, cy = 250;
  const R = 220;
  const LABEL_INSET = 64;        // label & ikon agak ke dalam
  const textR = R - LABEL_INSET; // radius label/icon
  const outerR = R + 3;

  // Palet
  const palette = ['#22c55e','#0ea5e9','#f59e0b','#ef4444','#a78bfa','#14b8a6','#eab308','#f43f5e'];

  // Normalisasi segmen input
  const norm = useMemo(() => {
    return segments.map((s) => {
      if (typeof s === 'number') return { mode: 'amount' as const, amount: s };
      if (s && typeof s === 'object' && 'image' in s)
        return { mode: 'image' as const, image: s.image, size: s.size, alt: s.alt, rotate: s.rotate, fill: s.fill };
      return { mode: 'amount' as const, amount: 0 };
    });
  }, [segments]);

  // Build wedges
  const wedges = useMemo<BuiltSeg[]>(() => {
    const arr: BuiltSeg[] = [];
    for (let i = 0; i < N; i++) {
      const s = norm[i];
      const start = i * step - 90;
      const end   = (i + 1) * step - 90;
      const mid   = (i + 0.5) * step - 90;

      const [x1, y1] = polar(cx, cy, R, start);
      const [x2, y2] = polar(cx, cy, R, end);
      const largeArc = step > 180 ? 1 : 0;

      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const edgeD = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`;
      const fill = (s as any).fill ?? palette[i % palette.length];

      if (s.mode === 'amount') {
        arr.push({
          idx: i, d, edgeD, fill, mode: 'amount',
          label: formatCredit((s as any).amount ?? 0),
          midDegSVG: mid
        });
      } else {
        arr.push({
          idx: i, d, edgeD, fill, mode: 'image',
          label: '',
          image: { src: (s as any).image, size: (s as any).size, alt: (s as any).alt, rotate: (s as any).rotate },
          midDegSVG: mid
        });
      }
    }
    return arr;
  }, [N, step, norm]);

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
            {/* Wedges */}
            <g className="wedge-layer" aria-hidden>
              {wedges.map(w => (
                <g key={`w-${w.idx}`}>
                  <path d={w.d} fill={w.fill} />
                  <path d={w.d} fill="none" stroke="rgba(15,23,42,.22)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
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

            {/* Label & Ikon (tangent + auto-flip) */}
            <g className="labels-layer">
              {wedges.map(w => {
                const rotateForPosition = w.midDegSVG + 90; // radial ke bisektor
                const rotateForTangent  = 90;                // radial → tangent
                const abs = normDeg(rotationDeg + rotateForPosition + rotateForTangent);
                const flip = (abs > 90 && abs < 270) ? 180 : 0;

                const base =
                  `translate(${cx} ${cy}) ` +
                  `rotate(${rotateForPosition}) ` +
                  `translate(0 ${-(R - 64)}) ` + // = textR
                  `rotate(${rotateForTangent + flip})`;

                if (w.mode === 'amount') {
                  const fontSize = fitFontByChord(w.label, step, R - 64, 12, 20);
                  return (
                    <g key={`lab-${w.idx}`} transform={base}>
                      <text
                        className={winningIndex === w.idx ? 'label win-label' : 'label'}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        dy="0.35em"
                        fontSize={fontSize}
                        style={{ fill: '#0f172a', paintOrder: 'stroke', stroke: 'rgba(255,255,255,0.80)', strokeWidth: 0.8, fontWeight: 600 }}
                      >
                        {w.label}
                      </text>
                    </g>
                  );
                }

                // Ikon gambar — dibesarkan & ikut miring
                if (w.mode === 'image' && w.image?.src) {
                  const chord = chordLen(R - 64, step);
                  const auto  = Math.min(36, Math.max(22, chord * 0.52)); // ~lebih besar 35% dari versi awal
                  const size  = w.image.size ?? auto;
                  const half  = size / 2;
                  const extra = w.image.rotate ?? 0;

                  return (
                    <g key={`img-${w.idx}`} transform={`${base} rotate(${extra})`} className="icon-label">
                      <image
                        href={w.image.src}
                        x={-half}
                        y={-half}
                        width={size}
                        height={size}
                        preserveAspectRatio="xMidYMid meet"
                        style={{ pointerEvents: 'none' }}
                      >
                        {w.image.alt ? <title>{w.image.alt}</title> : null}
                      </image>
                    </g>
                  );
                }

                return null;
              })}
            </g>

            {/* Rim luar */}
            <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(15,23,42,.55)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>

        {/* Hub */}
        <div className="hub" style={{ backgroundColor: hubFill, boxShadow: `inset 0 0 0 5px ${hubStroke}, 0 6px 18px rgba(0,0,0,.45)` }}>
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
function chordLen(r: number, arcDeg: number) {
  const arcRad = (Math.PI * arcDeg) / 180;
  return 2 * r * Math.sin(arcRad / 2);
}
function formatCredit(n: number) {
  return `Credit ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`;
}
function fitFontByChord(label: string, arcDeg: number, r: number, min = 12, max = 20) {
  const chord = chordLen(r, arcDeg);
  const perChar = 0.62;
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
