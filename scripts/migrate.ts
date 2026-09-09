import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!url) throw new Error('Set MIGRATION_DATABASE_URL or DATABASE_URL.');
const sql = postgres(url, { max: 1, prepare: false, ssl: 'require' });
try {
  await sql`create schema if not exists private`;
  await sql`create table if not exists private.schema_migrations(name text primary key, applied_at timestamptz default now())`;
  const files = (await fs.readdir('supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    if (
      (await sql`select name from private.schema_migrations where name=${file}`)
        .length
    )
      continue;
    const content = await fs.readFile(
      path.join('supabase/migrations', file),
      'utf8',
    );
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`insert into private.schema_migrations(name) values(${file})`;
    });
    console.log(`Applied ${file}`);
  }
} finally {
  await sql.end();
}
