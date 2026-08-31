import { Pool, QueryResult, QueryResultRow } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const host = process.env.AZURE_POSTGRES_HOST;
  const database = process.env.AZURE_POSTGRES_DATABASE;
  const user = process.env.AZURE_POSTGRES_USER;
  const password = process.env.AZURE_POSTGRES_PASSWORD;
  const port = Number(process.env.AZURE_POSTGRES_PORT || "5432");

  if (!host || !database || !user || !password) {
    throw new Error(
      "Azure PostgreSQL environment variables are incomplete."
    );
  }

  pool = new Pool({
    host,
    database,
    user,
    password,
    port,
    ssl: {
      rejectUnauthorized: true,
    },
    max: 10,
  });

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}
