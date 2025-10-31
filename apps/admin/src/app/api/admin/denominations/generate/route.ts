export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { pool } from 'lib/db';
import { assertAdminOrSuper } from 'lib/admin';

export async function GET(req: NextRequest) {
  try {
    assertAdminOrSuper(req);
    const { rows } = await pool.query(`
      SELECT amount
      FROM allowed_denominations
      WHERE is_dummy = false
        AND is_enabled_generate = true
      ORDER BY amount DESC
    `);
    return NextResponse.json(
      { ok: true, amounts: rows.map(r => Number(r.amount)) },
      { status: 200 }
    );
  } catch (e: any) {
    if (e?.status === 401 || e?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    console.error('denoms/generate GET err', e);
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
