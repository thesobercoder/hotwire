import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Effect } from "effect";

import { DatabaseError } from "./providers.js";

const APP_DIRECTORY_NAME = ".hotwire";
const DATABASE_FILE_NAME = "hotwire.db";
const CURRENT_SCHEMA_VERSION = 4;

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

      if (currentVersion < 4) {
        database.exec(`
          PRAGMA foreign_keys = ON;

          CREATE TABLE IF NOT EXISTS message (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            data TEXT NOT NULL,
            time_created INTEGER NOT NULL,
            time_updated INTEGER NOT NULL
          );

          CREATE INDEX IF NOT EXISTS message_session_time_created_id_idx
            ON message (session_id, time_created, id);

          CREATE TABLE IF NOT EXISTS part (
            id TEXT PRIMARY KEY,
            message_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            data TEXT NOT NULL,
            time_created INTEGER NOT NULL,
            time_updated INTEGER NOT NULL,
            FOREIGN KEY (message_id) REFERENCES message(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS part_message_id_id_idx
            ON part (message_id, id);

          CREATE INDEX IF NOT EXISTS part_session_idx
            ON part (session_id);

          INSERT OR IGNORE INTO schema_migrations(version) VALUES (4);
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
