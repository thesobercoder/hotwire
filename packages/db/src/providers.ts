import { chmodSync } from "node:fs";

import { Context, Data, Effect, Layer, Schema } from "effect";

import { Database, DbFilePath } from "./database.js";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown;
}> {}

export const Provider = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  apiKey: Schema.String,
  createdAt: Schema.String,
});

export type Provider = typeof Provider.Type;

export const ProviderModel = Schema.Struct({
  providerId: Schema.String,
  modelId: Schema.String,
  enabled: Schema.Boolean,
});

export type ProviderModel = typeof ProviderModel.Type;

export const ProviderTokens = Schema.Struct({
  providerId: Schema.String,
  accessToken: Schema.String,
  refreshToken: Schema.NullOr(Schema.String),
  expiresAt: Schema.NullOr(Schema.String),
});

export type ProviderTokens = typeof ProviderTokens.Type;

export class ProviderRepo extends Context.Tag("@hotwire/db/ProviderRepo")<
  ProviderRepo,
  {
    readonly list: Effect.Effect<Provider[], DatabaseError>;
    readonly insert: (params: {
      id: string;
      type: string;
      apiKey: string;
    }) => Effect.Effect<void, DatabaseError>;
    readonly remove: (id: string) => Effect.Effect<void, DatabaseError>;
    readonly hasEnabledModel: Effect.Effect<boolean, DatabaseError>;
    readonly setModelEnabled: (params: {
      providerId: string;
      modelId: string;
      enabled: boolean;
    }) => Effect.Effect<void, DatabaseError>;
    readonly listModels: (
      providerId: string,
    ) => Effect.Effect<ProviderModel[], DatabaseError>;
    readonly upsertTokens: (params: {
      providerId: string;
      accessToken: string;
      refreshToken?: string;
      expiresAt?: string;
    }) => Effect.Effect<void, DatabaseError>;
    readonly getTokens: (
      providerId: string,
    ) => Effect.Effect<ProviderTokens | null, DatabaseError>;
  }
>() {}

const enforceDbFileMode = (path: string) => chmodSync(path, 0o600);

export const ProviderRepoLive = Layer.effect(
  ProviderRepo,
  Effect.gen(function* () {
    const db = yield* Database;
    const dbFilePath = yield* DbFilePath;

    return {
      list: Effect.try({
        try: () => {
          const rows = db
            .prepare("SELECT id, type, api_key, created_at FROM providers")
            .all() as Array<{
            id: string;
            type: string;
            api_key: string;
            created_at: string;
          }>;
          return rows.map((row) => ({
            id: row.id,
            type: row.type,
            apiKey: row.api_key,
            createdAt: row.created_at,
          }));
        },
        catch: (cause) => new DatabaseError({ cause }),
      }),

      insert: ({ id, type, apiKey }) =>
        Effect.try({
          try: () => {
            db.prepare(
              "INSERT INTO providers (id, type, api_key) VALUES (?, ?, ?)",
            ).run(id, type, apiKey);
            enforceDbFileMode(dbFilePath);
          },
          catch: (cause) => new DatabaseError({ cause }),
        }),

      remove: (id) =>
        Effect.try({
          try: () => {
            db.prepare("DELETE FROM providers WHERE id = ?").run(id);
            enforceDbFileMode(dbFilePath);
          },
          catch: (cause) => new DatabaseError({ cause }),
        }),

      hasEnabledModel: Effect.try({
        try: () => {
          const row = db
            .prepare(
              "SELECT COUNT(*) as count FROM provider_models WHERE enabled = 1",
            )
            .get() as { count: number };
          return row.count > 0;
        },
        catch: (cause) => new DatabaseError({ cause }),
      }),

      setModelEnabled: ({ providerId, modelId, enabled }) =>
        Effect.try({
          try: () => {
            db.prepare(
              `INSERT INTO provider_models (provider_id, model_id, enabled)
               VALUES (?, ?, ?)
               ON CONFLICT (provider_id, model_id)
               DO UPDATE SET enabled = excluded.enabled`,
            ).run(providerId, modelId, enabled ? 1 : 0);
            enforceDbFileMode(dbFilePath);
          },
          catch: (cause) => new DatabaseError({ cause }),
        }),

      listModels: (providerId) =>
        Effect.try({
          try: () => {
            const rows = db
              .prepare(
                "SELECT provider_id, model_id, enabled FROM provider_models WHERE provider_id = ?",
              )
              .all(providerId) as Array<{
              provider_id: string;
              model_id: string;
              enabled: number;
            }>;
            return rows.map((row) => ({
              providerId: row.provider_id,
              modelId: row.model_id,
              enabled: row.enabled === 1,
            }));
          },
          catch: (cause) => new DatabaseError({ cause }),
        }),

      upsertTokens: ({ providerId, accessToken, refreshToken, expiresAt }) =>
        Effect.try({
          try: () => {
            db.prepare(
              `INSERT INTO provider_tokens (provider_id, access_token, refresh_token, expires_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT (provider_id)
               DO UPDATE SET
                 access_token = excluded.access_token,
                 refresh_token = excluded.refresh_token,
                 expires_at = excluded.expires_at`,
            ).run(
              providerId,
              accessToken,
              refreshToken ?? null,
              expiresAt ?? null,
            );
            enforceDbFileMode(dbFilePath);
          },
          catch: (cause) => new DatabaseError({ cause }),
        }),

      getTokens: (providerId) =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(
                "SELECT provider_id, access_token, refresh_token, expires_at FROM provider_tokens WHERE provider_id = ?",
              )
              .get(providerId) as
              | {
                  provider_id: string;
                  access_token: string;
                  refresh_token: string | null;
                  expires_at: string | null;
                }
              | undefined;
            if (!row) return null;
            return {
              providerId: row.provider_id,
              accessToken: row.access_token,
              refreshToken: row.refresh_token,
              expiresAt: row.expires_at,
            };
          },
          catch: (cause) => new DatabaseError({ cause }),
        }),
    };
  }),
);
