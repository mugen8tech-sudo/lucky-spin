export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { pool } from 'lib/db';
import { assertAdmin } from 'lib/admin';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin(req);
    const { note } = await req.json().catch(() => ({} as any));
    const adminId = process.env.ADMIN_ID;
    if (!adminId) return NextResponse.json({ ok: false, error: 'ADMIN_ID_NOT_SET' }, { status: 500 });

    const { rows } = await pool.query(
      `SELECT * FROM process_voucher($1::uuid, $2::uuid, $3::text);`,
      [params.id, adminId, note ?? null]
    );

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: 'NOT_CLAIMED_OR_ALREADY_PROCESSED' }, { status: 409 });
    }
    return NextResponse.json({ ok: true, result: rows[0] }, { status: 200 });
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') return NextResponse.json({ ok: false }, { status: 401 });
    console.error('process voucher error', e);
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
