import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { initializeAppData } from "../src/app-data.js";
import {
  insertProvider,
  listModels,
  listProviders,
  removeProvider,
  setModelEnabled,
} from "../src/providers.js";

function createTestDb() {
  const homeDir = mkdtempSync(join(tmpdir(), "hotwire-providers-"));
  const { dbPath } = initializeAppData({ homeDir });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  return { db, dbPath };
}

describe("providers", () => {
  it("inserts a provider and retrieves it", () => {
    const { db } = createTestDb();

    insertProvider(db, {
      id: "01JTEST000000000000000001",
      type: "anthropic",
      apiKey: "sk-ant-test-key",
    });

    const providers = listProviders(db);

    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({
      id: "01JTEST000000000000000001",
      type: "anthropic",
      api_key: "sk-ant-test-key",
    });
    expect(providers[0]?.created_at).toBeDefined();

    db.close();
  });

  it("removes a provider cleanly", () => {
    const { db } = createTestDb();

    insertProvider(db, {
      id: "01JTEST000000000000000001",
      type: "anthropic",
      apiKey: "sk-ant-test-key",
    });

    removeProvider(db, "01JTEST000000000000000001");

    const providers = listProviders(db);
    expect(providers).toHaveLength(0);

    db.close();
  });

  it("sets and retrieves per-model enabled state", () => {
    const { db } = createTestDb();

    insertProvider(db, {
      id: "01JTEST000000000000000001",
      type: "anthropic",
      apiKey: "sk-ant-test-key",
    });

    setModelEnabled(db, {
      providerId: "01JTEST000000000000000001",
      modelId: "claude-sonnet-4-20250514",
      enabled: true,
    });
    setModelEnabled(db, {
      providerId: "01JTEST000000000000000001",
      modelId: "claude-haiku-3-5-20241022",
      enabled: false,
    });

    const models = listModels(db, "01JTEST000000000000000001");

    expect(models).toHaveLength(2);
    expect(models).toContainEqual({
      provider_id: "01JTEST000000000000000001",
      model_id: "claude-sonnet-4-20250514",
      enabled: 1,
    });
    expect(models).toContainEqual({
      provider_id: "01JTEST000000000000000001",
      model_id: "claude-haiku-3-5-20241022",
      enabled: 0,
    });

    db.close();
  });

  it("cascades model deletion when provider is removed", () => {
    const { db } = createTestDb();

    insertProvider(db, {
      id: "01JTEST000000000000000001",
      type: "anthropic",
      apiKey: "sk-ant-test-key",
    });
    setModelEnabled(db, {
      providerId: "01JTEST000000000000000001",
      modelId: "claude-sonnet-4-20250514",
      enabled: true,
    });

    removeProvider(db, "01JTEST000000000000000001");

    const models = listModels(db, "01JTEST000000000000000001");
    expect(models).toHaveLength(0);

    db.close();
  });

  it("toggles model enabled state in place", () => {
    const { db } = createTestDb();

    insertProvider(db, {
      id: "01JTEST000000000000000001",
      type: "anthropic",
      apiKey: "sk-ant-test-key",
    });

    setModelEnabled(db, {
      providerId: "01JTEST000000000000000001",
      modelId: "claude-sonnet-4-20250514",
      enabled: false,
    });

    setModelEnabled(db, {
      providerId: "01JTEST000000000000000001",
      modelId: "claude-sonnet-4-20250514",
      enabled: true,
    });

    const models = listModels(db, "01JTEST000000000000000001");
    expect(models).toHaveLength(1);
    expect(models[0]?.enabled).toBe(1);

    db.close();
  });
});
