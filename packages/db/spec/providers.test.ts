import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Effect, Layer } from "effect";

import { initializeAppData } from "../src/app-data.js";
import { Database } from "../src/database.js";
import { ProviderRepo, ProviderRepoLive } from "../src/providers.js";

function createTestLayer() {
  const homeDir = mkdtempSync(join(tmpdir(), "hotwire-providers-"));
  const { dbPath } = Effect.runSync(initializeAppData({ homeDir }));
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  const DatabaseTest = Layer.succeed(Database, db);
  return { layer: ProviderRepoLive.pipe(Layer.provide(DatabaseTest)), db };
}

const run = <A>(
  layer: Layer.Layer<ProviderRepo>,
  effect: Effect.Effect<A, unknown, ProviderRepo>,
) => Effect.runSync(Effect.provide(effect, layer));

describe("ProviderRepo", () => {
  it("inserts a provider and retrieves it", () => {
    const { layer, db } = createTestLayer();

    run(
      layer,
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        yield* repo.insert({
          id: "01JTEST000000000000000001",
          type: "anthropic",
          apiKey: "sk-ant-test-key",
        });

        const providers = yield* repo.list;

        expect(providers).toHaveLength(1);
        expect(providers[0]).toMatchObject({
          id: "01JTEST000000000000000001",
          type: "anthropic",
          apiKey: "sk-ant-test-key",
        });
        expect(providers[0]?.createdAt).toBeDefined();
      }),
    );

    db.close();
  });

  it("removes a provider cleanly", () => {
    const { layer, db } = createTestLayer();

    run(
      layer,
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        yield* repo.insert({
          id: "01JTEST000000000000000001",
          type: "anthropic",
          apiKey: "sk-ant-test-key",
        });

        yield* repo.remove("01JTEST000000000000000001");

        const providers = yield* repo.list;
        expect(providers).toHaveLength(0);
      }),
    );

    db.close();
  });

  it("sets and retrieves per-model enabled state", () => {
    const { layer, db } = createTestLayer();

    run(
      layer,
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        yield* repo.insert({
          id: "01JTEST000000000000000001",
          type: "anthropic",
          apiKey: "sk-ant-test-key",
        });

        yield* repo.setModelEnabled({
          providerId: "01JTEST000000000000000001",
          modelId: "claude-sonnet-4-20250514",
          enabled: true,
        });
        yield* repo.setModelEnabled({
          providerId: "01JTEST000000000000000001",
          modelId: "claude-haiku-3-5-20241022",
          enabled: false,
        });

        const models = yield* repo.listModels("01JTEST000000000000000001");

        expect(models).toHaveLength(2);
        expect(models).toContainEqual({
          providerId: "01JTEST000000000000000001",
          modelId: "claude-sonnet-4-20250514",
          enabled: true,
        });
        expect(models).toContainEqual({
          providerId: "01JTEST000000000000000001",
          modelId: "claude-haiku-3-5-20241022",
          enabled: false,
        });
      }),
    );

    db.close();
  });

  it("cascades model deletion when provider is removed", () => {
    const { layer, db } = createTestLayer();

    run(
      layer,
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        yield* repo.insert({
          id: "01JTEST000000000000000001",
          type: "anthropic",
          apiKey: "sk-ant-test-key",
        });
        yield* repo.setModelEnabled({
          providerId: "01JTEST000000000000000001",
          modelId: "claude-sonnet-4-20250514",
          enabled: true,
        });

        yield* repo.remove("01JTEST000000000000000001");

        const models = yield* repo.listModels("01JTEST000000000000000001");
        expect(models).toHaveLength(0);
      }),
    );

    db.close();
  });

  it("toggles model enabled state in place", () => {
    const { layer, db } = createTestLayer();

    run(
      layer,
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        yield* repo.insert({
          id: "01JTEST000000000000000001",
          type: "anthropic",
          apiKey: "sk-ant-test-key",
        });

        yield* repo.setModelEnabled({
          providerId: "01JTEST000000000000000001",
          modelId: "claude-sonnet-4-20250514",
          enabled: false,
        });

        yield* repo.setModelEnabled({
          providerId: "01JTEST000000000000000001",
          modelId: "claude-sonnet-4-20250514",
          enabled: true,
        });

        const models = yield* repo.listModels("01JTEST000000000000000001");
        expect(models).toHaveLength(1);
        expect(models[0]?.enabled).toBe(true);
      }),
    );

    db.close();
  });
});
