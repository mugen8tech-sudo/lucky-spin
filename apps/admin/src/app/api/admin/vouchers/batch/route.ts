export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { pool } from 'lib/db';
import { assertAdmin } from 'lib/admin';

function genCode(len = 12) {
  return crypto.randomBytes(24)
    .toString('base64')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .slice(0, len);
}

export async function POST(req: Request) {
  const client = await pool.connect();
  try {
    assertAdmin(req);
    const body = await req.json();
    const memberId = (body?.memberId ?? '').toString();
    const amount = Number(body?.amount);
    const count = Math.max(1, Math.min(1000, Number(body?.count ?? 1)));
    const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;

    if (!memberId) return NextResponse.json({ ok: false, error: 'MEMBER_ID_REQUIRED' }, { status: 400 });

    // validasi member & nominal
    const m = await pool.query(`SELECT id FROM members WHERE id=$1`, [memberId]);
    if (m.rowCount === 0) return NextResponse.json({ ok: false, error: 'MEMBER_NOT_FOUND' }, { status: 404 });

    const d = await pool.query(`SELECT amount FROM allowed_denominations WHERE amount=$1`, [amount]);
    if (d.rowCount === 0) return NextResponse.json({ ok: false, error: 'INVALID_DENOMINATION' }, { status: 400 });

    await client.query('BEGIN');
    const created: { id: string; code: string }[] = [];

    while (created.length < count) {
      const code = genCode(12);
      try {
        const { rows } = await client.query(
          `INSERT INTO vouchers(code, member_id, amount, status, expires_at)
           VALUES ($1,$2,$3,'ISSUED',$4)
           RETURNING id, code`,
          [code, memberId, amount, expiresAt]
        );
        created.push(rows[0]);
      } catch (e: any) {
        // 23505 = unique_violation (kode bentrok) → coba lagi
        if (e?.code === '23505') continue;
        throw e;
      }
    }

    // audit (opsional)
    if (created.length) {
      const values = created.map((c, i) => `($${i + 1}, 'CREATED', '{}'::jsonb)`).join(',');
      await client.query(
        `INSERT INTO voucher_events(voucher_id, event_type, meta) VALUES ${values}`,
        created.map(c => c.id)
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ ok: true, count: created.length, vouchers: created }, { status: 201 });
  } catch (e: any) {
    await client.query('ROLLBACK');
    if (e?.message === 'UNAUTHORIZED') return NextResponse.json({ ok: false }, { status: 401 });
    console.error('admin/vouchers/batch POST error', e);
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  } finally {
    client.release();
  }
}
