export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { pool } from 'lib/db';
import { assertAdmin } from 'lib/admin';

function csvEscape(v: any) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  try {
    assertAdmin(req);
    const url = new URL(req.url);
    const member = (url.searchParams.get('member') || '').trim();
    const status = (url.searchParams.get('status') || '').trim();
    const unprocessed = url.searchParams.get('unprocessed') === 'true';
    const code = (url.searchParams.get('code') || '').trim();
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    // batasi maksimal 5000 baris
    const limit = Math.min(5000, Math.max(1, Number(url.searchParams.get('limit') || 1000)));

    const where: string[] = [];
    const params: any[] = [];

    if (member) { params.push(`%${member}%`); where.push(`m.full_name ILIKE $${params.length}`); }
    if (code)   { params.push(`%${code}%`);   where.push(`v.code ILIKE $${params.length}`); }
    if (from)   { params.push(new Date(from)); where.push(`v.issued_at >= $${params.length}`); }
    if (to)     { params.push(new Date(to));   where.push(`v.issued_at <  $${params.length}`); }
    if (unprocessed) where.push(`v.status = 'CLAIMED'`);
    else if (status) { params.push(status); where.push(`v.status = $${params.length}`); }

    const sql = `
      SELECT v.id, v.code, m.full_name, v.amount, v.status, v.issued_at, v.claimed_at, v.processed_at
      FROM vouchers v
      JOIN members m ON m.id = v.member_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY v.issued_at DESC, v.id DESC
      LIMIT ${limit};
    `;
    const { rows } = await pool.query(sql, params);

    const header = ['id','code','member','amount','status','issued_at','claimed_at','processed_at'];
    const lines = [header.join(',')].concat(
      rows.map(r => [
        csvEscape(r.id),
        csvEscape(r.code),
        csvEscape(r.full_name),
        csvEscape(r.amount),
        csvEscape(r.status),
        csvEscape(r.issued_at?.toISOString?.() || r.issued_at),
        csvEscape(r.claimed_at?.toISOString?.() || r.claimed_at),
        csvEscape(r.processed_at?.toISOString?.() || r.processed_at),
      ].join(','))
    );

    const body = lines.join('\n');
    const ts = new Date().toISOString().replace(/[:T\-]/g,'').slice(0, 14);
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="vouchers-${ts}.csv"`
      }
    });
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') {
      return new Response('UNAUTHORIZED', { status: 401 });
    }
    console.error('export csv error', e);
    return new Response('SERVER_ERROR', { status: 500 });
  }
}
