export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { pool } from 'lib/db';
import { assertAdmin } from 'lib/admin'; // <- di file admin.ts kita sudah buat assertAdmin menerima Admin ATAU Super

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req); // Admin atau Super boleh
    const { rows } = await pool.query(`
      SELECT amount
      FROM allowed_denominations
      WHERE is_dummy = false
        AND is_enabled_generate = true
      ORDER BY amount DESC
    `);
    return NextResponse.json({ ok: true, amounts: rows.map(r => Number(r.amount)) }, { status: 200 });
  } catch (e: any) {
    const status = e?.status === 401 ? 401 : 500;
    return NextResponse.json({ ok: false, error: e?.message ?? 'SERVER_ERROR' }, { status });
  }
}
