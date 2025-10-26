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

async function buildWheelConfig(amount: number) {
  const { rows } = await pool.query(`SELECT amount FROM allowed_denominations ORDER BY amount DESC`);
  let segs = rows.map(r => Number(r.amount));
  if (!segs.includes(amount)) segs = [...segs, amount];

  // shuffle
  for (let i = segs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [segs[i], segs[j]] = [segs[j], segs[i]];
  }
  const targetIndex = segs.findIndex(a => a === amount);
  const spinMs = 5500 + Math.floor(Math.random() * 1500);
  return { segments: segs, targetIndex, spinMs };
}

export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    if (!code || typeof code !== 'string' || code.trim().length < 4) {
      return NextResponse.json({ ok: false, reason: 'INVALID_CODE' }, { status: 400 });
    }
    const { ip, ua } = getClientInfo(req);

    const { rows } = await pool.query(
      `SELECT * FROM claim_voucher_by_code($1::text, $2::text, $3::text)`,
      [code.trim(), ip || null, ua || null]
    );

    if (!rows.length) {
      // coba diagnosis
      const v = await pool.query(
        `SELECT status, expires_at FROM vouchers WHERE code=$1`,
        [code.trim()]
      );
      if (v.rowCount === 0) return NextResponse.json({ ok: false, reason: 'INVALID_CODE' }, { status: 404 });
      const vv = v.rows[0];
      if (vv.expires_at && new Date(vv.expires_at) < new Date()) {
        return NextResponse.json({ ok: false, reason: 'EXPIRED' }, { status: 410 });
      }
      if (vv.status === 'CLAIMED' || vv.status === 'PROCESSED') {
        return NextResponse.json({ ok: false, reason: 'ALREADY_USED' }, { status: 409 });
      }
      return NextResponse.json({ ok: false, reason: 'UNABLE_TO_CLAIM' }, { status: 400 });
    }

    const amount = Number(rows[0].amount);
    const wheel = await buildWheelConfig(amount);

    return NextResponse.json({ ok: true, amount, wheel }, { status: 200 });
  } catch (e: any) {
    // tampilkan error asli agar mudah diagnosa
    console.error('claim error', e);
    return NextResponse.json(
      { ok: false, reason: 'SERVER_ERROR', detail: e?.message || String(e) },
      { status: 500 }
    );
  }
}
