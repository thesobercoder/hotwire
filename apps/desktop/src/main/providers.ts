import type { DatabaseSync } from "node:sqlite";

export function insertProvider(
  db: DatabaseSync,
  { id, type, apiKey }: { id: string; type: string; apiKey: string },
) {
  db.prepare("INSERT INTO providers (id, type, api_key) VALUES (?, ?, ?)").run(
    id,
    type,
    apiKey,
  );
}

export function removeProvider(db: DatabaseSync, id: string) {
  db.prepare("DELETE FROM providers WHERE id = ?").run(id);
}

export function setModelEnabled(
  db: DatabaseSync,
  {
    providerId,
    modelId,
    enabled,
  }: { providerId: string; modelId: string; enabled: boolean },
) {
  db.prepare(
    `INSERT INTO provider_models (provider_id, model_id, enabled)
     VALUES (?, ?, ?)
     ON CONFLICT (provider_id, model_id)
     DO UPDATE SET enabled = excluded.enabled`,
  ).run(providerId, modelId, enabled ? 1 : 0);
}

export function listModels(db: DatabaseSync, providerId: string) {
  return db
    .prepare(
      "SELECT provider_id, model_id, enabled FROM provider_models WHERE provider_id = ?",
    )
    .all(providerId) as Array<{
    provider_id: string;
    model_id: string;
    enabled: number;
  }>;
}

export function listProviders(db: DatabaseSync) {
  return db
    .prepare("SELECT id, type, api_key, created_at FROM providers")
    .all() as Array<{
    id: string;
    type: string;
    api_key: string;
    created_at: string;
  }>;
}
