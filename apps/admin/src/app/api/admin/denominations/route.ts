export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { pool } from 'lib/db';
import { assertAdmin } from 'lib/admin';

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);
    const { rows } = await pool.query(`
      SELECT id, amount, is_dummy, label, icon_url,
             is_enabled_wheel, is_enabled_generate,
             weight, priority, created_at, updated_at
      FROM allowed_denominations
      ORDER BY is_dummy ASC, priority DESC,
               amount ASC NULLS LAST, label ASC NULLS LAST
    `);
    return NextResponse.json({ ok: true, items: rows }, { status: 200 });
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') return NextResponse.json({ ok: false }, { status: 401 });
    console.error('denoms GET err', e);
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    assertAdmin(req);
    const body = await req.json().catch(() => ({}));
    const type = (body.type ?? 'cash') as 'cash' | 'dummy';
    const is_dummy = type === 'dummy';

    const client = await pool.connect();
    try {
      let amount: number;

      if (is_dummy) {
        // jika body.amount negatif & unik pakai itu; jika tidak, auto: -1, -2, ...
        const candidate = Number(body.amount);
        if (Number.isFinite(candidate) && candidate < 0) {
          amount = candidate;
        } else {
          const q = await client.query(
            `SELECT COALESCE(MIN(amount), 0) AS minneg
               FROM allowed_denominations
              WHERE amount < 0`
          );
          const minneg = Number(q.rows[0]?.minneg ?? 0);
          amount = minneg >= 0 ? -1 : (minneg - 1);
        }
      } else {
        amount = Number(body.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) {
          return NextResponse.json({ ok: false, error: 'amount invalid' }, { status: 400 });
        }
      }

      const label = body.label ?? null;
      const icon_url = body.iconUrl ?? null;
      const is_enabled_wheel = body.isEnabledWheel ?? true;
      const is_enabled_generate = is_dummy ? false : (body.isEnabledGenerate ?? true);
      const weight = Number.isFinite(body.weight) ? Number(body.weight) : 1;
      const priority = Number.isFinite(body.priority) ? Number(body.priority) : 0;

      const { rows } = await client.query(
        `INSERT INTO allowed_denominations
           (id, amount, is_dummy, label, icon_url,
            is_enabled_wheel, is_enabled_generate,
            weight, priority)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, amount, is_dummy, label, icon_url,
                   is_enabled_wheel, is_enabled_generate,
                   weight, priority, created_at, updated_at`,
        [amount, is_dummy, label, icon_url,
         is_enabled_wheel, is_enabled_generate, weight, priority]
      );

      return NextResponse.json({ ok: true, item: rows[0] }, { status: 201 });
    } catch (e: any) {
      // duplicate cash amount (kena unique index)
      return NextResponse.json({ ok: false, error: e?.message ?? 'DB_ERROR' }, { status: 400 });
    } finally {
      client.release();
    }
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') return NextResponse.json({ ok: false }, { status: 401 });
    console.error('denoms POST err', e);
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
