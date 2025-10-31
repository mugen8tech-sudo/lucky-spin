export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { pool } from 'lib/db';
import { assertAdmin } from 'lib/admin';

export async function GET(req: Request) {
  try {
    assertAdmin(req);
    const { rows } = await pool.query(`SELECT amount FROM allowed_denominations ORDER BY amount DESC`);
    return NextResponse.json({ ok: true, amounts: rows.map(r => Number(r.amount)) }, { status: 200 });
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') return NextResponse.json({ ok: false }, { status: 401 });
    console.error('denoms GET err', e);
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
