export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { pool } from 'lib/db';

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT amount, is_dummy, label, icon_url, is_enabled_wheel, weight, priority
      FROM allowed_denominations
      WHERE is_enabled_wheel = true
      ORDER BY is_dummy ASC, priority DESC, amount ASC NULLS LAST, label ASC NULLS LAST
    `);

    type Seg = number | { image: string; size?: number; alt?: string };
    const segments: Seg[] = [];

    for (const r of rows) {
      const w = Math.max(1, Number(r.weight ?? 1));
      if (r.is_dummy) {
        const src = r.icon_url || '/icons/android.png';
        const alt = r.label || 'Bonus';
        for (let i = 0; i < w; i++) segments.push({ image: src, size: 56, alt });
      } else {
        const a = Number(r.amount);
        for (let i = 0; i < w; i++) segments.push(a);
      }
    }
    return NextResponse.json({ ok: true, segments }, { status: 200 });
  } catch (e) {
    console.error('wheel preview error', e);
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
