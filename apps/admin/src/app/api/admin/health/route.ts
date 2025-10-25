export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { pool } from 'lib/db';
import { assertAdmin } from 'lib/admin';

export async function GET(req: Request) {
  try {
    assertAdmin(req);
    const res = await pool.query('select now() as now, current_user as user');
    return NextResponse.json({ ok: true, db: 'ok', now: res.rows[0].now, user: res.rows[0].user, hasDbUrl: !!process.env.DATABASE_URL }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'SERVER_ERROR', hasDbUrl: !!process.env.DATABASE_URL }, { status: 500 });
  }
}
