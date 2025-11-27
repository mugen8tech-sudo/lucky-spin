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
  amount?: number;      // << NEW: nilai numerik utk baris kedua
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
  const R = 238;
  const LABEL_INSET = 75;        // label & ikon agak ke dalam
  const textR = R - LABEL_INSET; // radius label/icon (pakai konsisten)
  const outerR = R + 3;

  // --- Colors: 2-biru alternating ---
  const BLUE_LIGHT = '#38bdf8'; // sky-400
  const BLUE_DARK  = '#0284c7'; // sky-600

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
      const fill = (i % 2 === 0) ? BLUE_LIGHT : BLUE_DARK;

      if ((s as any).mode === 'amount') {
        arr.push({
          idx: i, d, edgeD, fill, mode: 'amount',
          label: formatCredit((s as any).amount ?? 0),
          amount: (s as any).amount ?? 0,                 // << NEW
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

  // Perception compensation: scale up slightly when label is vertical
  const scaleForAngle = (deg: number) => {
    const r = (deg * Math.PI) / 180;
    const s = Math.abs(Math.sin(r)); // 0 at 0/180 (horizontal), 1 at 90/270 (vertical)
    return 1 + 0.08 * (s * s);       // max +8%, halus di tengah
  };

  // Ukuran label global (konsisten untuk semua wedge)
  const labelSizes = useMemo(() => {
    // ambil angka saja (tanpa "Credit ")
    const amountTexts = wedges
      .filter(w => w.mode === 'amount')
      .map(w => w.label.replace(/^Credit\s+/i, ''));

    // fit maksimal yang aman untuk semua nominal
    let amountFit = 24; // batas atas
    for (const t of amountTexts) {
      amountFit = Math.min(amountFit, fitFontByChord(t, step, textR, 13, 24));
    }

    // kapasitas aman untuk kata "CREDIT"
    const creditFit = fitFontByChord('CREDIT', step, textR, 10, 28);

    const amountSize = Math.round(amountFit);
    const creditSize = Math.round(Math.min(creditFit, amountSize * 0.82)); // baris 1 sedikit lebih kecil

    return { amountSize, creditSize };
  }, [wedges, step, textR]);

  const pointerCls = winningIndex != null ? 'pointer shake' : 'pointer';
  const hubStroke = isDark(hubFill) ? '#1f2937' : '#e5e7eb';

  return (
    <div className="wheel-stack">
      <div className="wheel-banner" role="heading" aria-level={2}>
        <h2 className="wheel-title">
          <span className="line1">SPIN SEKARANG</span>
          <span className="line2">DAPATKAN HADIAHNYA</span>
        </h2>
      </div>
      
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
              {/* ===== Luxury defs (gradients & filters) ===== */}
              <defs>
                {/* === Rim dots (blue glow) === */}
                <radialGradient id="dot-blue-core" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"  stopColor="#e0f2fe"/>
                  <stop offset="55%" stopColor="#38bdf8"/>
                  <stop offset="100%" stopColor="#0ea5e9"/>
                </radialGradient>

                <filter id="dot-blue-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b"/>
                  <feMerge>
                    <feMergeNode in="b"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              
                {/* Gradient emas untuk ring */}
                <linearGradient id="lux-gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%"  stopColor="#FFF6B7"/>
                  <stop offset="35%" stopColor="#F4DA7A"/>
                  <stop offset="65%" stopColor="#DEBA5A"/>
                  <stop offset="100%" stopColor="#A27C2E"/>
                </linearGradient>

                {/* Gradient label (mutiara) */}
                <linearGradient id="lux-label-grad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%"  stopColor="#e6ecf5"/>
                  <stop offset="50%" stopColor="#ffffff"/>
                  <stop offset="100%" stopColor="#dfe7f2"/>
                </linearGradient>

                {/* Inner shadow halus untuk wedge */}
                <filter id="lux-inner" x="-20%" y="-20%" width="140%" height="140%">
                  <feOffset dx="0" dy="1" />
                  <feGaussianBlur stdDeviation="2.5" result="b"/>
                  <feComposite in="b" in2="SourceAlpha" operator="out" result="innershadow"/>
                  <feColorMatrix in="innershadow" type="matrix"
                    values="0 0 0 0 0
                            0 0 0 0 0
                            0 0 0 0 0
                            0 0 0 .45 0"/>
                  <feComposite in="SourceGraphic" />
                </filter>

                {/* Glow tipis untuk teks */}
                <filter id="lux-text-glow">
                  <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity=".55"/>
                </filter>

                {/* === Stone texture (fractal noise) === */}
                <filter id="stone-noise" x="-10%" y="-10%" width="120%" height="120%">
                  <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="5" seed="11" result="turb" />
                  <feColorMatrix in="turb" type="saturate" values="0" result="mono"/>
                  <feComponentTransfer in="mono">
                    <feFuncR type="gamma" amplitude="1" exponent="1.25" offset="0"/>
                    <feFuncG type="gamma" amplitude="1" exponent="1.25" offset="0"/>
                    <feFuncB type="gamma" amplitude="1" exponent="1.25" offset="0"/>
                    <feFuncA type="table" tableValues="0 0 .10 .18 .26 .34 .42 .50 .58 .66"/>
                  </feComponentTransfer>
                </filter>

                {/* clipPath untuk masing-masing wedge */}
                {wedges.map(w => (
                  <clipPath key={`clip-${w.idx}`} id={`clip-${w.idx}`} clipPathUnits="userSpaceOnUse">
                    <path d={w.d}/>
                  </clipPath>
                ))}
              </defs>

              {/* Wedges */}
              <g className="wedge-layer" filter="url(#lux-inner)" aria-hidden>
                {wedges.map(w => (
                  <g key={`w-${w.idx}`}>
                    <path d={w.d} fill={w.fill} />
                    <path d={w.d} fill="none" stroke="rgba(15,23,42,.22)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                  </g>
                ))}
              </g>

              {/* Stone texture per wedge (2-layer supaya terlihat di biru) */}
              <g className="texture-layer" aria-hidden style={{ isolation: 'isolate' as any }}>
                {wedges.map(w => (
                  <g key={`tex-${w.idx}`} clipPath={`url(#clip-${w.idx})`}>
                    {/* Layer 1: highlights lembut */}
                    <rect
                      x="0" y="0" width="500" height="500"
                      fill="#ffffff"
                      filter="url(#stone-noise)"
                      opacity=".48"                                       // naikkan kalau mau lebih kelihatan
                      style={{ mixBlendMode: 'soft-light', pointerEvents: 'none' }}
                    />
                    {/* Layer 2: urat gelap tipis (diputar sedikit) */}
                    <rect
                      x="0" y="0" width="500" height="500"
                      fill="#000000"
                      filter="url(#stone-noise)"
                      transform="rotate(35 250 250)"
                      opacity=".16"
                      style={{ mixBlendMode: 'multiply', pointerEvents: 'none' }}
                    />
                  </g>
                ))}
              </g>

              {/* Ring emas tipis */}
              <g aria-hidden>
                <circle cx={cx} cy={cy} r={R - 0.5} fill="none"
                        stroke="url(#lux-gold)" strokeWidth="2" opacity=".85" />
                <circle cx={cx} cy={cy} r={R - 3.5} fill="none"
                        stroke="rgba(255,255,255,.10)" strokeWidth="1" />
                <circle cx={cx} cy={cy} r={outerR} fill="none"
                        stroke="rgba(15,23,42,.55)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
              </g>

              {/* Rim dots at each wedge midpoint (on outer ring) */}
              <g className="rim-dots" aria-hidden>
                {wedges.map((w, i) => {
                  const isWin = typeof winningIndex === 'number' && winningIndex === i;

                  // POSISI: taruh di ring terluar, sedikit (+1.2px) ke luar agar “menyentuh” pointer
                  const dotR = outerR + 2.5;  // sebelumnya: R - 4 (terlalu ke dalam)
                  const base =
                    `translate(${cx} ${cy}) rotate(${w.midDegSVG + 90}) translate(0 ${-dotR})`;

                  return (
                    <g key={`dot-${i}`} transform={base} filter="url(#dot-blue-glow)">
                      {/* halos / glow */}
                      <circle r={isWin ? 13 : 9}  fill="#38bdf8" opacity={isWin ? 0.22 : 0.14}/>
                      <circle r={isWin ? 9.5 : 7} fill="#0ea5e9" opacity={isWin ? 0.24 : 0.16}/>
                      {/* bright core tepat di ring */}
                      <circle r={isWin ? 3.8 : 2.8} fill="url(#dot-blue-core)"/>
                    </g>
                  );
                })}
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
                    `translate(0 ${-textR})` +
                    `rotate(${rotateForTangent + flip})`;

                  if (w.mode === 'amount') {
                    const amountOnly = w.label.replace(/^Credit\s+/i, '');
                    const { amountSize, creditSize } = labelSizes;

                    // NEW: kompensasi sudut
                    const scale = scaleForAngle(w.midDegSVG);

                    return (
                      <g key={`lab-${w.idx}`} transform={base}>
                        {/* scale di titik tulis (origin sudah di sini), jadi tidak geser posisi */}
                        <g transform={`scale(${scale})`}>
                          <text
                            className={winningIndex === w.idx ? 'label win-label' : 'label'}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            filter="url(#lux-text-glow)"
                            fill="#ffffff"
                            stroke="#000000"
                            strokeWidth={0.7}
                            strokeOpacity={0.5}
                            vectorEffect="non-scaling-stroke"   // <<< penting agar outline tetap konstan
                            style={{
                              fontFamily:
                                "var(--wheel-label-font, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif)",
                              fontWeight: 800,
                              paintOrder: 'stroke fill',
                              letterSpacing: '.2px',
                            }}
                          >
                            <tspan className="tcredit" x="0" dy="-0.35em" fontSize={creditSize}>
                              CREDIT
                            </tspan>
                            <tspan className="tamount" x="0" dy="1.2em" fontSize={amountSize} fontWeight={900}>
                              {amountOnly}
                            </tspan>
                          </text>
                        </g>
                      </g>
                    );
                  }

                  if (w.mode === 'image' && w.image?.src) {
                    const chord = chordLen(textR, step);
                    const auto  = Math.min(36, Math.max(22, chord * 0.52));
                    const size  = w.image.size ?? auto;
                    const half  = size / 2;
                    const extra = w.image.rotate ?? 0;

                    // 1) Rotasi ke bisektor wedge (posisi)
                    const rotateForPosition = w.midDegSVG + 90;
                    // 2) Rotasi agar IKON "berdiri" (bukan tidur) → 0°
                    const rotateForAlong    = 0;

                    // auto-flip agar tetap tegak di sisi kiri roda (opsional)
                    const abs  = normDeg(rotationDeg + rotateForPosition + rotateForAlong);
                    const flip = (abs > 90 && abs < 270) ? 180 : 0;

                    const base =
                      `translate(${cx} ${cy}) ` +
                      `rotate(${rotateForPosition}) ` +
                      `translate(0 ${-textR})` +
                      `rotate(${rotateForAlong + flip})`; // <-- tidak lagi 90°

                    return (
                      <g key={`img-${w.idx}`} transform={base} className="icon-label">
                        <image
                          href={w.image.src}
                          x={-half}
                          y={-half}
                          width={size}
                          height={size}
                          preserveAspectRatio="xMidYMid meet"
                          transform={`rotate(${extra})`}
                          style={{ pointerEvents: 'none', transformBox: 'fill-box', transformOrigin: '50% 50%' }}
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
