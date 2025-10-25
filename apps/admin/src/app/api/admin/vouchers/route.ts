export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { pool } from 'lib/db';
import { assertAdmin } from 'lib/admin';

export async function GET(req: Request) {
  try {
    assertAdmin(req);
    const url = new URL(req.url);
    const member = url.searchParams.get('member') || '';
    const status = url.searchParams.get('status'); // ISSUED|CLAIMED|PROCESSED
    const unprocessed = url.searchParams.get('unprocessed') === 'true';

    const where: string[] = [];
    const params: any[] = [];

    if (member) {
      params.push(`%${member}%`);
      where.push(`m.full_name ILIKE $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`v.status = $${params.length}`);
    }
    if (unprocessed) {
      where.push(`v.status = 'CLAIMED'`);
    }

    const sql = `
      SELECT v.id, v.code, v.amount, v.status, v.issued_at, v.claimed_at, v.processed_at,
             m.id as member_id, m.full_name
      FROM vouchers v
      JOIN members m ON m.id = v.member_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY v.issued_at DESC
      LIMIT 200;
    `;

    const { rows } = await pool.query(sql, params);
    return NextResponse.json({ ok: true, vouchers: rows }, { status: 200 });
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') return NextResponse.json({ ok: false }, { status: 401 });
    console.error('admin/vouchers GET error', e);
    return NextResponse.json({ ok: false, error: e?.message || 'SERVER_ERROR' }, { status: 500 });
  }
}
