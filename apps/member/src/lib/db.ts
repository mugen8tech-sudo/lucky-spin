import { Pool } from 'pg';
const globalForPool = global as unknown as { __pgPool?: Pool };
export const pool =
  globalForPool.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
if (process.env.NODE_ENV !== 'production') globalForPool.__pgPool = pool;
