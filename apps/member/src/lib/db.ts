import { Pool } from 'pg';

const globalForPool = global as unknown as { __pgPool?: Pool };

if (!process.env.DATABASE_URL) {
  console.warn('[DB][Member] Missing DATABASE_URL');
}

export const pool =
  globalForPool.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000
  });

if (process.env.NODE_ENV !== 'production') globalForPool.__pgPool = pool;
