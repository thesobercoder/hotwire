import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Effect } from "effect";

import { DatabaseError } from "./providers.js";

const APP_DIRECTORY_NAME = ".hotwire";
const DATABASE_FILE_NAME = "hotwire.db";
const CURRENT_SCHEMA_VERSION = 3;

export const initializeAppData = ({
  homeDir,
}: {
  homeDir: string;
}): Effect.Effect<{ appDataPath: string; dbPath: string }, DatabaseError> =>
  Effect.try({
    try: () => {
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

      if (currentVersion < 3) {
        database.exec(`
          PRAGMA foreign_keys = ON;

          CREATE TABLE IF NOT EXISTS provider_tokens (
            provider_id TEXT NOT NULL PRIMARY KEY,
            access_token TEXT NOT NULL,
            refresh_token TEXT,
            expires_at TEXT,
            FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
          );

          INSERT OR IGNORE INTO schema_migrations(version) VALUES (3);
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
    },
    catch: (cause) => new DatabaseError({ cause }),
  });
