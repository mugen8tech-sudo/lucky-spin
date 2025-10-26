export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { pool } from 'lib/db';
import { assertAdmin } from 'lib/admin';

function parseCursor(s?: string | null) {
  if (!s) return null;
  try {
    const obj = JSON.parse(Buffer.from(s, 'base64').toString('utf-8'));
    if (obj && typeof obj.t === 'string' && typeof obj.id === 'string') return obj;
  } catch {}
  return null;
}
function encodeCursor(t: string, id: string) {
  return Buffer.from(JSON.stringify({ t, id }), 'utf-8').toString('base64');
}

export async function GET(req: Request) {
  try {
    assertAdmin(req);
    const url = new URL(req.url);

    const member = (url.searchParams.get('member') || '').trim();
    const status = (url.searchParams.get('status') || '').trim(); // ISSUED|CLAIMED|PROCESSED
    const unprocessed = url.searchParams.get('unprocessed') === 'true';
    const code = (url.searchParams.get('code') || '').trim();
    const from = url.searchParams.get('from'); // ISO date (inclusive)
    const to = url.searchParams.get('to');     // ISO date (exclusive)
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 50)));
    const cursor = parseCursor(url.searchParams.get('cursor'));

    const where: string[] = [];
    const params: any[] = [];

    if (member) { params.push(`%${member}%`); where.push(`m.full_name ILIKE $${params.length}`); }
    if (code)   { params.push(`%${code}%`);   where.push(`v.code ILIKE $${params.length}`); }
    if (from)   { params.push(new Date(from)); where.push(`v.issued_at >= $${params.length}`); }
    if (to)     { params.push(new Date(to));   where.push(`v.issued_at <  $${params.length}`); }
    if (unprocessed) where.push(`v.status = 'CLAIMED'`);
    else if (status) { params.push(status); where.push(`v.status = $${params.length}`); }

    if (cursor) {
      params.push(new Date(cursor.t)); const a = params.length;
      params.push(cursor.id);          const b = params.length;
      where.push(`(v.issued_at < $${a} OR (v.issued_at = $${a} AND v.id < $${b}::uuid))`);
    }

    const sql = `
      SELECT v.id, v.code, v.amount, v.status, v.issued_at, v.claimed_at, v.processed_at,
             m.id AS member_id, m.full_name
      FROM vouchers v
      JOIN members m ON m.id = v.member_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY v.issued_at DESC, v.id DESC
      LIMIT ${limit + 1};
    `;

    const { rows } = await pool.query(sql, params);
    let nextCursor: string | null = null;
    let items = rows;

    if (rows.length > limit) {
      const last = rows[limit - 1];
      items = rows.slice(0, limit);
      nextCursor = encodeCursor(last.issued_at, last.id);
    }

    return NextResponse.json({ ok: true, vouchers: items, nextCursor }, { status: 200 });
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    console.error('admin/vouchers GET error', e);
    return NextResponse.json({ ok: false, error: e?.message || 'SERVER_ERROR' }, { status: 500 });
  }
}
