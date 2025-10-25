export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { pool } from 'lib/db';
import { assertAdmin } from 'lib/admin';

export async function POST(req: Request) {
  try {
    assertAdmin(req);
    const body = await req.json();
    const fullName = (body?.fullName ?? '').toString().trim();
    const phone = body?.phone ?? null;
    const email = body?.email ?? null;
    const notes = body?.notes ?? null;

    if (!fullName || fullName.length < 2) {
      return NextResponse.json({ ok: false, error: 'INVALID_FULLNAME' }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO members(full_name, phone, email, notes)
       VALUES ($1,$2,$3,$4)
       RETURNING id, full_name, phone, email`,
      [fullName, phone, email, notes]
    );

    return NextResponse.json({ ok: true, member: rows[0] }, { status: 201 });
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') return NextResponse.json({ ok: false }, { status: 401 });
    console.error('admin/members POST error', e);
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
