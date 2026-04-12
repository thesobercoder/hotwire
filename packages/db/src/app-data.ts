import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const APP_DIRECTORY_NAME = ".hotwire";
const DATABASE_FILE_NAME = "hotwire.db";
const CURRENT_SCHEMA_VERSION = 2;

export function initializeAppData({ homeDir }: { homeDir: string }) {
  const appDataPath = join(homeDir, APP_DIRECTORY_NAME);
  const dbPath = join(appDataPath, DATABASE_FILE_NAME);

  mkdirSync(appDataPath, {
    recursive: true,
  });

  const database = new DatabaseSync(dbPath);

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO schema_migrations(version) VALUES (1);
  `);

  const currentVersion =
    (
      database.prepare("PRAGMA user_version").all() as Array<{
        user_version: number;
      }>
    )[0]?.user_version ?? 0;

  if (currentVersion < 2) {
    database.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        api_key TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS provider_models (
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (provider_id, model_id),
        FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
      );

      INSERT OR IGNORE INTO schema_migrations(version) VALUES (2);
    `);
  }

  database.exec(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
  database.close();

  if (existsSync(dbPath)) {
    chmodSync(dbPath, 0o600);
  }

  return {
    appDataPath,
    dbPath,
  };
}
