import 'server-only';
import path from 'node:path';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
export interface DB {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
}
type Runtime = {
  local?: Promise<PGlite>;
  pool?: ReturnType<typeof postgres>;
  queue: Promise<unknown>;
};
const shared = globalThis as typeof globalThis & { __letterlaneDB?: Runtime };
const runtime = (shared.__letterlaneDB ??= { queue: Promise.resolve() });
export function isLocal() {
  const mode =
    process.env.GAME_BACKEND ??
    (process.env.NODE_ENV === 'development' ? 'local' : 'supabase');
  if (mode === 'local' && process.env.VERCEL)
    throw new Error('Local backend is not supported on Vercel.');
  return mode === 'local';
}
async function localDB() {
  return (runtime.local ??= (async () => {
    const dataDirectory = path.resolve(
      /* turbopackIgnore: true */ process.env.LOCAL_DATA_DIR ||
        '.letterlane/local',
    );
    await fs.mkdir(dataDirectory, { recursive: true });
    const db = new PGlite(dataDirectory);
    await db.waitReady;
    const schema = await fs.readFile(
      path.join(process.cwd(), 'supabase/migrations/202609090001_core.sql'),
      'utf8',
    );
    await db.exec(schema);
    await db.exec(
      await fs.readFile(
        path.join(process.cwd(), 'supabase/migrations/202609110001_bots.sql'),
        'utf8',
      ),
    );
    return db;
  })().catch((error) => {
    runtime.local = undefined;
    throw error;
  }));
}
export async function transaction<T>(fn: (db: DB) => Promise<T>): Promise<T> {
  if (isLocal()) {
    const execute = async () =>
      (await localDB()).transaction((tx) =>
        fn({
          query: async <R extends Record<string, unknown>>(
            sql: string,
            params: unknown[] = [],
          ) => (await tx.query<R>(sql, params)).rows,
        }),
      );
    const pending = runtime.queue.then(execute, execute);
    runtime.queue = pending.catch(() => {});
    return pending;
  }
  if (!process.env.DATABASE_URL) throw new Error('Database is not configured.');
  const pool = (runtime.pool ??= postgres(process.env.DATABASE_URL, {
    max: 3,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: 'require',
  }));
  // Transaction pooler compatible: the row lock lasts through the complete state transition.
  return pool.begin(async (tx) =>
    fn({
      query: async <R extends Record<string, unknown>>(
        sql: string,
        params: unknown[] = [],
      ) => (await tx.unsafe(sql, params as never[])) as unknown as R[],
    }),
  ) as Promise<T>;
}
export async function databaseTime(db: DB) {
  const [row] = await db.query<{ ms: number }>(
    'select floor(extract(epoch from clock_timestamp()) * 1000)::float8 as ms',
  );
  return Number(row.ms);
}
