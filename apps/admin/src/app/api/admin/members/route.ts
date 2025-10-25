export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { pool } from 'lib/db';
import { assertAdmin } from 'lib/admin';

export async function GET(req: Request) {
  try {
    assertAdmin(req);
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(200, Number(url.searchParams.get('limit') || 50));
    const params: any[] = [];
    let where = '';
    if (q) {
      params.push(`%${q}%`);
      where = `WHERE full_name ILIKE $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT id, full_name, phone, email, created_at
       FROM members
       ${where}
       ORDER BY created_at DESC
       LIMIT ${limit}`, params
    );
    return NextResponse.json({ ok: true, members: rows }, { status: 200 });
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') return NextResponse.json({ ok: false }, { status: 401 });
    console.error('admin/members GET error', e);
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}

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
