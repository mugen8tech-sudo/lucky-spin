export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { pool } from 'lib/db';
import { assertAdmin } from 'lib/admin';

function csvEscape(v: any) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Format Excel-friendly di zona waktu tertentu
function formatTz(value: any, tz: string) {
  if (!value) return '';
  const d = new Date(value);
  // "sv-SE" menghasilkan "YYYY-MM-DD HH:mm:ss"
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(d);
}

export async function GET(req: Request) {
  try {
    assertAdmin(req);
    const url = new URL(req.url);

    const member = (url.searchParams.get('member') || '').trim();
    const status = (url.searchParams.get('status') || '').trim(); // ISSUED|CLAIMED|PROCESSED
    const unprocessed = url.searchParams.get('unprocessed') === 'true';
    const code = (url.searchParams.get('code') || '').trim();
    const from = url.searchParams.get('from'); // ISO date
    const to = url.searchParams.get('to');     // ISO date
    const limit = Math.min(5000, Math.max(1, Number(url.searchParams.get('limit') || 1000)));

    // opsi
    const includeId = url.searchParams.get('includeId') === 'true'; // default: false
    const tz = url.searchParams.get('tz') || 'Asia/Jakarta';

    const where: string[] = [];
    const params: any[] = [];

    if (member)   { params.push(`%${member}%`); where.push(`m.full_name ILIKE $${params.length}`); }
    if (code)     { params.push(`%${code}%`);   where.push(`v.code ILIKE $${params.length}`); }
    if (from)     { params.push(new Date(from)); where.push(`v.issued_at >= $${params.length}`); }
    if (to)       { params.push(new Date(to));   where.push(`v.issued_at <  $${params.length}`); }
    if (unprocessed) where.push(`v.status = 'CLAIMED'`);
    else if (status) { params.push(status); where.push(`v.status = $${params.length}`); }

    const sql = `
      SELECT v.id, v.code, m.full_name, v.amount, v.status,
             v.issued_at, v.claimed_at, v.processed_at
      FROM vouchers v
      JOIN members m ON m.id = v.member_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY v.issued_at DESC, v.id DESC
      LIMIT ${limit};
    `;
    const { rows } = await pool.query(sql, params);

    // header: tanpa "id" (default). Jika includeId=true, letakkan "id" di kolom paling belakang.
    const header = includeId
      ? ['code','member','amount','status','issued_at','claimed_at','processed_at','id']
      : ['code','member','amount','status','issued_at','claimed_at','processed_at'];

    const lines = [header.join(',')];

    for (const r of rows) {
      const rec = [
        r.code,
        r.full_name,
        String(r.amount),      // biarkan numerik polos, bukan "Rp ..."
        r.status,
        formatTz(r.issued_at, tz),
        formatTz(r.claimed_at, tz),
        formatTz(r.processed_at, tz),
      ];
      if (includeId) rec.push(r.id);
      lines.push(rec.map(csvEscape).join(','));
    }

    // BOM + CRLF agar nyaman di Excel Windows
    const body = '\uFEFF' + lines.join('\r\n');
    const ts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date()).replace(/\s/g, '').replace(':','');

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="vouchers-${ts}.csv"`
      }
    });
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') return new Response('UNAUTHORIZED', { status: 401 });
    console.error('export csv error', e);
    return new Response('SERVER_ERROR', { status: 500 });
  }
}
