import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const APP_DIRECTORY_NAME = ".hotwire";
const DATABASE_FILE_NAME = "hotwire.db";
const INITIAL_SCHEMA_VERSION = 1;

export function initializeAppData({ homeDir }) {
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

    INSERT OR IGNORE INTO schema_migrations(version) VALUES (${INITIAL_SCHEMA_VERSION});
    PRAGMA user_version = ${INITIAL_SCHEMA_VERSION};
  `);
  database.close();

  if (existsSync(dbPath)) {
    chmodSync(dbPath, 0o600);
  }

  return {
    appDataPath,
    dbPath,
  };
}
