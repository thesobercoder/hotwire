import { chmodSync, mkdirSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Effect } from "effect";

import { initializeAppData } from "../src/app-data.js";

describe("initializeAppData", () => {
  it("creates the app directory, initializes hotwire.db, and applies migration 1", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "hotwire-app-data-"));

    const result = Effect.runSync(initializeAppData({ homeDir }));
    const stats = statSync(result.dbPath);
    const database = new DatabaseSync(result.dbPath);
    const pragmaRows = database.prepare("PRAGMA user_version").all() as Array<{
      user_version: number;
    }>;

    expect(result.appDataPath).toBe(join(homeDir, ".hotwire"));
    expect(result.dbPath).toBe(join(homeDir, ".hotwire", "hotwire.db"));
    expect(pragmaRows[0]?.user_version).toBe(4);
    expect(stats.mode & 0o777).toBe(0o600);

    database.close();
  });

  it("creates providers and provider_models tables in migration 2", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "hotwire-app-data-"));

    const result = Effect.runSync(initializeAppData({ homeDir }));
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
    expect(pragmaRows[0]?.user_version).toBe(4);

    const migrationRows = database
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number }>;
    expect(migrationRows.map((r) => r.version)).toEqual([1, 2, 3, 4]);

    database.close();
  });

  it("creates provider_tokens table in migration 3", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "hotwire-app-data-"));

    const result = Effect.runSync(initializeAppData({ homeDir }));
    const database = new DatabaseSync(result.dbPath);

    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('provider_tokens') ORDER BY name",
      )
      .all() as Array<{ name: string }>;

    expect(tables.map((t) => t.name)).toEqual(["provider_tokens"]);

    const columns = database
      .prepare("PRAGMA table_info(provider_tokens)")
      .all() as Array<{ name: string; notnull: number }>;
    const columnMap = new Map(columns.map((c) => [c.name, c.notnull]));
    expect(columnMap.get("provider_id")).toBe(1);
    expect(columnMap.get("access_token")).toBe(1);
    expect(columnMap.has("refresh_token")).toBe(true);
    expect(columnMap.has("expires_at")).toBe(true);

    const pragmaRows = database.prepare("PRAGMA user_version").all() as Array<{
      user_version: number;
    }>;
    expect(pragmaRows[0]?.user_version).toBe(4);

    const migrationRows = database
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number }>;
    expect(migrationRows.map((r) => r.version)).toEqual([1, 2, 3, 4]);

    database.close();
  });

  it("upgrades an existing v1 database to v2", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "hotwire-app-data-"));
    const appDataPath = join(homeDir, ".hotwire");
    const dbPath = join(appDataPath, "hotwire.db");
    mkdirSync(appDataPath, { recursive: true });

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

    Effect.runSync(initializeAppData({ homeDir }));

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
    expect(pragmaRows[0]?.user_version).toBe(4);

    database.close();
  });

  it("creates message and part tables in migration 4 with opencode-shaped columns", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "hotwire-app-data-"));

    const result = Effect.runSync(initializeAppData({ homeDir }));
    const database = new DatabaseSync(result.dbPath);

    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('message', 'part') ORDER BY name",
      )
      .all() as Array<{ name: string }>;

    expect(tables.map((t) => t.name)).toEqual(["message", "part"]);

    const messageColumns = database
      .prepare("PRAGMA table_info(message)")
      .all() as Array<{ name: string; notnull: number; pk: number }>;
    const messageMap = new Map(messageColumns.map((c) => [c.name, c]));
    expect(messageMap.get("id")?.pk).toBe(1);
    expect(messageMap.get("session_id")?.notnull).toBe(1);
    expect(messageMap.get("data")?.notnull).toBe(1);
    expect(messageMap.get("time_created")?.notnull).toBe(1);
    expect(messageMap.get("time_updated")?.notnull).toBe(1);

    const partColumns = database
      .prepare("PRAGMA table_info(part)")
      .all() as Array<{ name: string; notnull: number; pk: number }>;
    const partMap = new Map(partColumns.map((c) => [c.name, c]));
    expect(partMap.get("id")?.pk).toBe(1);
    expect(partMap.get("message_id")?.notnull).toBe(1);
    expect(partMap.get("session_id")?.notnull).toBe(1);
    expect(partMap.get("data")?.notnull).toBe(1);
    expect(partMap.get("time_created")?.notnull).toBe(1);
    expect(partMap.get("time_updated")?.notnull).toBe(1);

    const migrationRows = database
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number }>;
    expect(migrationRows.map((r) => r.version)).toEqual([1, 2, 3, 4]);

    database.close();
  });

  it("accepts ULID primary keys for message and part rows", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "hotwire-app-data-"));

    const result = Effect.runSync(initializeAppData({ homeDir }));
    const database = new DatabaseSync(result.dbPath);
    database.exec("PRAGMA foreign_keys = ON");

    const sessionId = "01JTEST000000000000000SS1";
    const messageId = "01JTEST000000000000000MS1";
    const partId = "01JTEST000000000000000PT1";
    const now = Date.now();

    database
      .prepare(
        "INSERT INTO message (id, session_id, data, time_created, time_updated) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        messageId,
        sessionId,
        JSON.stringify({ role: "user", time: { created: now } }),
        now,
        now,
      );

    database
      .prepare(
        "INSERT INTO part (id, message_id, session_id, data, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        partId,
        messageId,
        sessionId,
        JSON.stringify({ type: "text", text: "hi" }),
        now,
        now,
      );

    const messageRow = database
      .prepare("SELECT id, session_id, data FROM message WHERE id = ?")
      .get(messageId) as { id: string; session_id: string; data: string };
    const partRow = database
      .prepare("SELECT id, message_id, session_id, data FROM part WHERE id = ?")
      .get(partId) as {
      id: string;
      message_id: string;
      session_id: string;
      data: string;
    };

    expect(messageRow.id).toBe(messageId);
    expect(messageRow.session_id).toBe(sessionId);
    expect(JSON.parse(messageRow.data).role).toBe("user");
    expect(partRow.id).toBe(partId);
    expect(partRow.message_id).toBe(messageId);
    expect(partRow.session_id).toBe(sessionId);
    expect(JSON.parse(partRow.data).type).toBe("text");

    database.close();
  });

  it("cascades part deletion when its parent message is removed", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "hotwire-app-data-"));

    const result = Effect.runSync(initializeAppData({ homeDir }));
    const database = new DatabaseSync(result.dbPath);
    database.exec("PRAGMA foreign_keys = ON");

    const sessionId = "01JTEST000000000000000SS1";
    const messageId = "01JTEST000000000000000MS1";
    const partId = "01JTEST000000000000000PT1";
    const now = Date.now();

    database
      .prepare(
        "INSERT INTO message (id, session_id, data, time_created, time_updated) VALUES (?, ?, ?, ?, ?)",
      )
      .run(messageId, sessionId, JSON.stringify({}), now, now);

    database
      .prepare(
        "INSERT INTO part (id, message_id, session_id, data, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(partId, messageId, sessionId, JSON.stringify({}), now, now);

    database.prepare("DELETE FROM message WHERE id = ?").run(messageId);

    const remaining = database
      .prepare("SELECT COUNT(*) AS count FROM part WHERE id = ?")
      .get(partId) as { count: number };
    expect(remaining.count).toBe(0);

    database.close();
  });

  it("is safe to rerun and re-applies the locked database mode", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "hotwire-app-data-"));
    const firstRun = Effect.runSync(initializeAppData({ homeDir }));

    chmodSync(firstRun.dbPath, 0o644);

    const secondRun = Effect.runSync(initializeAppData({ homeDir }));
    const stats = statSync(secondRun.dbPath);
    const database = new DatabaseSync(secondRun.dbPath);
    const migrationRows = database
      .prepare("SELECT COUNT(*) AS migration_count FROM schema_migrations")
      .all() as Array<{ migration_count: number }>;

    expect(secondRun).toEqual(firstRun);
    expect(migrationRows[0]?.migration_count).toBe(4);
    expect(stats.mode & 0o777).toBe(0o600);

    database.close();
  });
});
