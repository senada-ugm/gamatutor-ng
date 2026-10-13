import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** drizzle/ beside package.json, whether we run from apps/web or the repo root. */
function migrationsDir(): string {
  if (process.env.GT_MIGRATIONS_DIR) return process.env.GT_MIGRATIONS_DIR;
  for (const dir of [resolve(process.cwd(), 'drizzle'), resolve(process.cwd(), 'apps/web/drizzle')]) {
    if (existsSync(resolve(dir, 'meta/_journal.json'))) return dir;
  }
  throw new Error('db: cannot find the drizzle/ migrations folder; set GT_MIGRATIONS_DIR');
}

/**
 * Opens and migrates a database.
 *
 * - `postgres://…` — a real Postgres (production).
 * - `memory://` — an in-process PGlite that vanishes on exit (tests).
 * - anything else — a PGlite data directory (development; default `.data/pglite`).
 */
export async function openDb(url: string): Promise<Db> {
  if (/^postgres(ql)?:\/\//.test(url)) {
    const { default: postgres } = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    const db = drizzle(postgres(url, { max: 10 }), { schema });
    await migrate(db, { migrationsFolder: migrationsDir() });
    return db as unknown as Db;
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  if (url !== 'memory://') mkdirSync(url, { recursive: true });
  const client = url === 'memory://' ? new PGlite() : new PGlite(url);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: migrationsDir() });
  return db as unknown as Db;
}

const g = globalThis as unknown as { __gtDb?: Promise<Db> };

/** The process-wide database, opened once (and once across dev hot reloads). */
export function getDb(): Promise<Db> {
  if (!g.__gtDb) {
    const opening = openDb(process.env.DATABASE_URL ?? resolve(process.cwd(), '.data/pglite'));
    g.__gtDb = opening;
    // A database that was not up yet (a reboot) must not poison every later
    // request: forget the failure so the next request tries again.
    opening.catch(() => {
      if (g.__gtDb === opening) g.__gtDb = undefined;
    });
  }
  return g.__gtDb;
}

/** Tests swap in their own database. */
export function setDbForTests(db: Db): void {
  g.__gtDb = Promise.resolve(db);
}
