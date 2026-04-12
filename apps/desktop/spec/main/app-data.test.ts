// @vitest-environment node

import { chmodSync, mkdirSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { initializeAppData } from "../../src/main/app-data.js";

describe("initializeAppData", () => {
  it("creates the app directory, initializes hotwire.db, and applies migration 1", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "hotwire-app-data-"));

    const result = initializeAppData({ homeDir });
    const stats = statSync(result.dbPath);
    const database = new DatabaseSync(result.dbPath);
    const pragmaRows = database.prepare("PRAGMA user_version").all() as Array<{
      user_version: number;
    }>;

    expect(result.appDataPath).toBe(join(homeDir, ".hotwire"));
    expect(result.dbPath).toBe(join(homeDir, ".hotwire", "hotwire.db"));
    expect(pragmaRows[0]?.user_version).toBe(2);
    expect(stats.mode & 0o777).toBe(0o600);

    database.close();
  });

  it("creates providers and provider_models tables in migration 2", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "hotwire-app-data-"));

    const result = initializeAppData({ homeDir });
    const database = new DatabaseSync(result.dbPath);

    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('providers', 'provider_models') ORDER BY name",
      )
      .all() as Array<{ name: string }>;

    expect(tables.map((t) => t.name)).toEqual(["provider_models", "providers"]);

    const pragmaRows = database.prepare("PRAGMA user_version").all() as Array<{
      user_version: number;
    }>;
    expect(pragmaRows[0]?.user_version).toBe(2);

    const migrationRows = database
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number }>;
    expect(migrationRows.map((r) => r.version)).toEqual([1, 2]);

    database.close();
  });

  it("upgrades an existing v1 database to v2", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "hotwire-app-data-"));
    const appDataPath = join(homeDir, ".hotwire");
    const dbPath = join(appDataPath, "hotwire.db");
    mkdirSync(appDataPath, { recursive: true });

    // Simulate a v1 database
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT OR IGNORE INTO schema_migrations(version) VALUES (1);
      PRAGMA user_version = 1;
    `);
    db.close();

    // Run init which should upgrade to v2
    initializeAppData({ homeDir });

    const database = new DatabaseSync(dbPath);
    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('providers', 'provider_models') ORDER BY name",
      )
      .all() as Array<{ name: string }>;

    expect(tables.map((t) => t.name)).toEqual(["provider_models", "providers"]);

    const pragmaRows = database.prepare("PRAGMA user_version").all() as Array<{
      user_version: number;
    }>;
    expect(pragmaRows[0]?.user_version).toBe(2);

    database.close();
  });

  it("is safe to rerun and re-applies the locked database mode", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "hotwire-app-data-"));
    const firstRun = initializeAppData({ homeDir });

    chmodSync(firstRun.dbPath, 0o644);

    const secondRun = initializeAppData({ homeDir });
    const stats = statSync(secondRun.dbPath);
    const database = new DatabaseSync(secondRun.dbPath);
    const migrationRows = database
      .prepare("SELECT COUNT(*) AS migration_count FROM schema_migrations")
      .all() as Array<{ migration_count: number }>;

    expect(secondRun).toEqual(firstRun);
    expect(migrationRows[0]?.migration_count).toBe(2);
    expect(stats.mode & 0o777).toBe(0o600);

    database.close();
  });
});
