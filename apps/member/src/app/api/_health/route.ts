export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { pool } from 'lib/db';

export async function GET() {
  try {
    const r = await pool.query('select now() as now, current_user as db_user');
    return NextResponse.json({ ok: true, hasDbUrl: !!process.env.DATABASE_URL, now: r.rows[0].now, db_user: r.rows[0].db_user });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e), hasDbUrl: !!process.env.DATABASE_URL }, { status: 500 });
  }
}
