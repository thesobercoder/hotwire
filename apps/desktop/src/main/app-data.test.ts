// @vitest-environment node

import { chmodSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

// @ts-expect-error app-data.mjs is a runtime-only ESM helper.
import { initializeAppData } from "./app-data.mjs";

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
    expect(pragmaRows[0]?.user_version).toBe(1);
    expect(stats.mode & 0o777).toBe(0o600);

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
    expect(migrationRows[0]?.migration_count).toBe(1);
    expect(stats.mode & 0o777).toBe(0o600);

    database.close();
  });
});
