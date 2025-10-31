export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { pool } from 'lib/db';
import { assertSuper } from 'lib/admin';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSuper(req);
    const id = params.id;
    const body = await req.json().catch(() => ({}));

    const map: Record<string, string> = {
      amount: 'amount',
      label: 'label',
      iconUrl: 'icon_url',
      isEnabledWheel: 'is_enabled_wheel',
      isEnabledGenerate: 'is_enabled_generate',
      weight: 'weight',
      priority: 'priority',
    };

    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;

    for (const [k, col] of Object.entries(map)) {
      if (body[k] !== undefined) {
        sets.push(`${col} = $${i++}`);
        vals.push(body[k]);
      }
    }

    if (sets.length === 0) {
      return NextResponse.json({ ok: false, error: 'NO_FIELDS' }, { status: 400 });
    }
    vals.push(id); // last param

    const { rows } = await pool.query(
      `UPDATE allowed_denominations
          SET ${sets.join(', ')}, updated_at = now()
        WHERE id = $${i}
        RETURNING id, amount, is_dummy, label, icon_url,
                  is_enabled_wheel, is_enabled_generate,
                  weight, priority, created_at, updated_at`,
      vals
    );

    if (!rows[0]) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ ok: true, item: rows[0] }, { status: 200 });
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') return NextResponse.json({ ok: false }, { status: 401 });
    console.error('denoms PATCH err', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'SERVER_ERROR' }, { status: 500 });
  }
}
