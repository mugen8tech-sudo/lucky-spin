import { Pool } from 'pg';

const globalForPool = global as unknown as { __pgPool?: Pool };

// Boleh tampilkan warning agar mudah dideteksi dari log
if (!process.env.DATABASE_URL) {
  console.warn('[DB] Missing DATABASE_URL for Admin app');
}

export const pool =
  globalForPool.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Supabase / managed PG biasanya butuh SSL
    ssl: { rejectUnauthorized: false },
    // Lebih aman untuk serverless
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000
  });

if (process.env.NODE_ENV !== 'production') globalForPool.__pgPool = pool;
