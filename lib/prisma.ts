import pkg from 'pg';
const { Pool } = pkg;

const globalForPg = globalThis as unknown as {
  pool: pkg.Pool | undefined;
};

export const pool =
  globalForPg.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

if (process.env.NODE_ENV !== "production") globalForPg.pool = pool;

export const query = (text: string, params?: any[]) => pool.query(text, params);
