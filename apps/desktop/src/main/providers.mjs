/**
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {{ id: string, type: string, apiKey: string }} provider
 */
export function insertProvider(db, { id, type, apiKey }) {
  db.prepare(
    "INSERT INTO providers (id, type, api_key) VALUES (?, ?, ?)",
  ).run(id, type, apiKey);
}

/**
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {string} id
 */
export function removeProvider(db, id) {
  db.prepare("DELETE FROM providers WHERE id = ?").run(id);
}

/**
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {{ providerId: string, modelId: string, enabled: boolean }} model
 */
export function setModelEnabled(db, { providerId, modelId, enabled }) {
  db.prepare(
    `INSERT INTO provider_models (provider_id, model_id, enabled)
     VALUES (?, ?, ?)
     ON CONFLICT (provider_id, model_id)
     DO UPDATE SET enabled = excluded.enabled`,
  ).run(providerId, modelId, enabled ? 1 : 0);
}

/**
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {string} providerId
 * @returns {Array<{ provider_id: string, model_id: string, enabled: number }>}
 */
export function listModels(db, providerId) {
  return /** @type {any} */ (
    db
      .prepare(
        "SELECT provider_id, model_id, enabled FROM provider_models WHERE provider_id = ?",
      )
      .all(providerId)
  );
}

/**
 * @param {import("node:sqlite").DatabaseSync} db
 * @returns {Array<{ id: string, type: string, api_key: string, created_at: string }>}
 */
export function listProviders(db) {
  return /** @type {any} */ (
    db.prepare("SELECT id, type, api_key, created_at FROM providers").all()
  );
}
