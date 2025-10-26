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
    const body = await req.json().catch(() => ({} as any));
    const raw = (body?.code ?? '').toString();
    if (!raw || raw.trim().length < 4) {
      return NextResponse.json({ ok: false, reason: 'INVALID_CODE' }, { status: 400 });
    }
    const code = raw.trim().toUpperCase(); // kode kita uppercase dari admin
    const { ip, ua } = getClientInfo(req);

    // panggil fungsi dengan schema eksplisit
    const claimRes = await pool.query(
      `SELECT * FROM public.claim_voucher_by_code($1::text, $2::text, $3::text);`,
      [code, ip || null, ua || null]
    );

    if (claimRes.rowCount === 0) {
      // diagnosis: kenapa nol baris
      const check = await pool.query(
        `SELECT status, expires_at FROM vouchers WHERE code=$1`,
        [code]
      );
      if (check.rowCount === 0) {
        return NextResponse.json({ ok: false, reason: 'INVALID_CODE' }, { status: 404 });
      }
      const { status, expires_at } = check.rows[0];
      if (expires_at && new Date(expires_at) < new Date()) {
        return NextResponse.json({ ok: false, reason: 'EXPIRED' }, { status: 410 });
      }
      if (status === 'CLAIMED' || status === 'PROCESSED') {
        return NextResponse.json({ ok: false, reason: 'ALREADY_USED' }, { status: 409 });
      }
      return NextResponse.json({ ok: false, reason: 'UNABLE_TO_CLAIM' }, { status: 400 });
    }

    const amount = Number(claimRes.rows[0].amount);
    const wheel = await buildWheelConfig(amount);
    return NextResponse.json({ ok: true, amount, wheel }, { status: 200 });
  } catch (e: any) {
    // pastikan SELALU JSON (agar UI tidak "Respon tidak valid.")
    console.error('claim fatal', e);
    return NextResponse.json(
      { ok: false, reason: 'SERVER_ERROR', detail: e?.message || String(e) },
      { status: 500 }
    );
  }
}
