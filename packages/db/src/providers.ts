import { Context, Data, Effect, Layer, Schema } from "effect";

import { Database } from "./database.js";

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
    readonly setModelEnabled: (params: {
      providerId: string;
      modelId: string;
      enabled: boolean;
    }) => Effect.Effect<void, DatabaseError>;
    readonly listModels: (
      providerId: string,
    ) => Effect.Effect<ProviderModel[], DatabaseError>;
  }
>() {}

export const ProviderRepoLive = Layer.effect(
  ProviderRepo,
  Effect.gen(function* () {
    const db = yield* Database;

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
          },
          catch: (cause) => new DatabaseError({ cause }),
        }),

      remove: (id) =>
        Effect.try({
          try: () => {
            db.prepare("DELETE FROM providers WHERE id = ?").run(id);
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
    };
  }),
);
