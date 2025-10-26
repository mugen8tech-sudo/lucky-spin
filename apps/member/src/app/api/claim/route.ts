export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { pool } from 'lib/db';

/** Ambil IP & UA untuk audit */
function getClientInfo(req: Request) {
  const ua = req.headers.get('user-agent') || '';
  const fwd = req.headers.get('x-forwarded-for') || '';
  const ip = (fwd.split(',')[0] || '').trim();
  return { ip, ua };
}

/** Susun wheel dari tabel allowed_denominations */
async function buildWheelConfig(amount: number) {
  const { rows } = await pool.query(`SELECT amount FROM allowed_denominations ORDER BY amount DESC`);
  let segs = rows.map(r => Number(r.amount));
  if (!segs.includes(amount)) segs = [...segs, amount];

  // shuffle sederhana
  for (let i = segs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [segs[i], segs[j]] = [segs[j], segs[i]];
  }
  const targetIndex = segs.findIndex(a => a === amount);
  const spinMs = 5500 + Math.floor(Math.random() * 1500);
  return { segments: segs, targetIndex, spinMs };
}

export async function POST(req: Request) {
  const client = await pool.connect();
  try {
    const { code } = await req.json().catch(() => ({} as any));
    if (!code || typeof code !== 'string' || code.trim().length < 4) {
      return NextResponse.json({ ok: false, reason: 'INVALID_CODE' }, { status: 400 });
    }
    const clean = code.trim().toUpperCase();
    const { ip, ua } = getClientInfo(req);

    // panggil fungsi dengan schema eksplisit + cast text
    let rows;
    try {
      const res = await client.query(
        `SELECT * FROM public.claim_voucher_by_code($1::text, $2::text, $3::text);`,
        [clean, ip || null, ua || null]
      );
      rows = res.rows;
    } catch (e: any) {
      // kirim detail agar bisa didiagnosa dari UI/log
      console.error('claim db error', e);
      return NextResponse.json(
        { ok: false, reason: 'SERVER_ERROR', detail: e?.message || String(e) },
        { status: 500 }
      );
    }

    // jika fungsi mengembalikan 0 baris → diagnosis reason yg tepat
    if (!rows || rows.length === 0) {
      const check = await client.query(
        `SELECT status, expires_at FROM vouchers WHERE code = $1`,
        [clean]
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

    // sukses: bangun wheel + balikan nominal
    const amount = Number(rows[0].amount);
    const wheel = await buildWheelConfig(amount);
    return NextResponse.json({ ok: true, amount, wheel }, { status: 200 });
  } catch (e: any) {
    console.error('claim error', e);
    return NextResponse.json(
      { ok: false, reason: 'SERVER_ERROR', detail: e?.message || String(e) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
