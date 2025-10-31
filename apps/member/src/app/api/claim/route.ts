export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { pool } from 'lib/db';

function getClientInfo(req: Request) {
  const ua = req.headers.get('user-agent') || '';
  const fwd = req.headers.get('x-forwarded-for') || '';
  const ip = (fwd.split(',')[0] || '').trim();
  return { ip, ua };
}

/** Build wheel segments using allowed_denominations (cash + dummy).
 * - include items with is_enabled_wheel=true.
 * - dummy -> { image, alt }, use icon_url if available, else fallback generic icon.
 * - replicate by weight (min 1).
 * - Sorted by: is_dummy ASC, priority DESC, amount ASC, label ASC.
 * - Ensure actual voucher amount is present (append if missing).
 */
async function buildWheelConfig(amount: number) {
  const { rows } = await pool.query(`
    SELECT amount, is_dummy, label, icon_url, is_enabled_wheel, weight, priority
    FROM allowed_denominations
    WHERE is_enabled_wheel = true
    ORDER BY is_dummy ASC, priority DESC, amount ASC NULLS LAST, label ASC NULLS LAST
  `);

  type Seg = number | { image: string; size?: number; alt?: string };
  const segs: Seg[] = [];
  const cashSet = new Set<number>();

  for (const r of rows) {
    const w = Math.max(1, Number(r.weight ?? 1));
    if (r.is_dummy) {
      const src = r.icon_url || '/icons/android.png';
      const alt = r.label || 'Bonus';
      for (let i = 0; i < w; i++) segs.push({ image: src, size: 56, alt });
    } else {
      const a = Number(r.amount);
      cashSet.add(a);
      for (let i = 0; i < w; i++) segs.push(a);
    }
  }

  // safety: always include real prize even if wheel toggle was off
  if (!cashSet.has(amount)) segs.push(amount);

  // shuffle (target ditentukan setelah shuffle)
  for (let i = segs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [segs[i], segs[j]] = [segs[j], segs[i]];
  }

  const targetIndex = segs.findIndex(s => typeof s === 'number' && s === amount);
  const spinMs = 5500 + Math.floor(Math.random() * 1500);
  return { segments: segs, targetIndex, spinMs };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const raw = (body?.code ?? '').toString();
    if (!raw || raw.trim().length < 4) {
      return NextResponse.json({ ok: false, reason: 'INVALID_CODE' }, { status: 400 });
    }
    const code = raw.trim().toUpperCase();
    const { ip, ua } = getClientInfo(req);

    const claimRes = await pool.query(
      `SELECT * FROM public.claim_voucher_by_code($1::text, $2::text, $3::text);`,
      [code, ip || null, ua || null]
    );

    if (claimRes.rowCount === 0) {
      const check = await pool.query(`SELECT status, expires_at FROM vouchers WHERE code=$1`, [code]);
      if (check.rowCount === 0) return NextResponse.json({ ok: false, reason: 'INVALID_CODE' }, { status: 404 });
      const { status, expires_at } = check.rows[0];
      if (expires_at && new Date(expires_at) < new Date()) return NextResponse.json({ ok: false, reason: 'EXPIRED' }, { status: 410 });
      if (status === 'CLAIMED' || status === 'PROCESSED') return NextResponse.json({ ok: false, reason: 'ALREADY_USED' }, { status: 409 });
      return NextResponse.json({ ok: false, reason: 'UNABLE_TO_CLAIM' }, { status: 400 });
    }

    const amount = Number(claimRes.rows[0].amount);
    const wheel = await buildWheelConfig(amount);
    return NextResponse.json({ ok: true, amount, wheel }, { status: 200 });
  } catch (e: any) {
    console.error('claim fatal', e);
    return NextResponse.json({ ok: false, reason: 'SERVER_ERROR', detail: e?.message || String(e) }, { status: 500 });
  }
}
