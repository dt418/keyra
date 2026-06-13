import type { D1Database } from "@cloudflare/workers-types";

export interface Migration {
  name: string;
  up: string;
}

export interface AppliedMigration {
  name: string;
  applied_at: string;
}

const CREATE_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS _migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export async function runMigrations(db: D1Database, migrations: Migration[]): Promise<void> {
  await db.exec(CREATE_MIGRATIONS_TABLE);

  const result = await db
    .prepare("SELECT name FROM _migrations ORDER BY name")
    .all<{ name: string }>();

  const applied = new Set(result.results.map((r) => r.name));

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;

    await db.exec(migration.up);

    await db
      .prepare("INSERT INTO _migrations (name) VALUES (?)")
      .bind(migration.name)
      .run();
  }
}

export function createMigration(name: string, sql: string): Migration {
  return { name, up: sql };
}