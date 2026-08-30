import { Pool, QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __masqueradePool: Pool | undefined;
}

function makePool() {
  const host = process.env.AZURE_POSTGRES_HOST;
  const database = process.env.AZURE_POSTGRES_DATABASE;
  const user = process.env.AZURE_POSTGRES_USER;
  const password = process.env.AZURE_POSTGRES_PASSWORD;
  const port = Number(process.env.AZURE_POSTGRES_PORT || 5432);
  if (!host || !database || !user || !password) {
    throw new Error("Azure PostgreSQL environment variables are incomplete.");
  }
  return new Pool({
    host,
    database,
    user,
    password,
    port,
    ssl: { rejectUnauthorized: true },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export const pool = global.__masqueradePool ?? makePool();
if (process.env.NODE_ENV !== "production") global.__masqueradePool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params);
}
