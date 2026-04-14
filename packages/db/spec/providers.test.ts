import { chmodSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Effect, Layer } from "effect";

import { initializeAppData } from "../src/app-data.js";
import { Database, DbFilePath } from "../src/database.js";
import { ProviderRepo, ProviderRepoLive } from "../src/providers.js";

function createTestLayer() {
  const homeDir = mkdtempSync(join(tmpdir(), "hotwire-providers-"));
  const { dbPath } = Effect.runSync(initializeAppData({ homeDir }));
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  const DatabaseTest = Layer.succeed(Database, db);
  const DbFilePathTest = Layer.succeed(DbFilePath, dbPath);
  return {
    layer: ProviderRepoLive.pipe(
      Layer.provide(Layer.merge(DatabaseTest, DbFilePathTest)),
    ),
    db,
    dbPath,
  };
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

  it("reports no enabled model when none exist", () => {
    const { layer, db } = createTestLayer();

    run(
      layer,
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        const result = yield* repo.hasEnabledModel;
        expect(result).toBe(false);
      }),
    );

    db.close();
  });

  it("reports an enabled model after one is set", () => {
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

        const result = yield* repo.hasEnabledModel;
        expect(result).toBe(true);
      }),
    );

    db.close();
  });

  it("reports no enabled model after provider cascade delete", () => {
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

        const result = yield* repo.hasEnabledModel;
        expect(result).toBe(false);
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

  it("re-enforces 0600 file mode after credential insert", () => {
    const { layer, db, dbPath } = createTestLayer();

    chmodSync(dbPath, 0o644);

    run(
      layer,
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        yield* repo.insert({
          id: "01JTEST000000000000000001",
          type: "anthropic",
          apiKey: "sk-ant-test-key",
        });
      }),
    );

    const stats = statSync(dbPath);
    expect(stats.mode & 0o777).toBe(0o600);

    db.close();
  });

  it("upserts and retrieves OAuth tokens for a provider", () => {
    const { layer, db } = createTestLayer();

    run(
      layer,
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        yield* repo.insert({
          id: "01JTEST000000000000000001",
          type: "copilot",
          apiKey: "",
        });
        yield* repo.upsertTokens({
          providerId: "01JTEST000000000000000001",
          accessToken: "access-xyz",
          refreshToken: "refresh-abc",
          expiresAt: "2026-05-01T00:00:00Z",
        });

        const tokens = yield* repo.getTokens("01JTEST000000000000000001");
        expect(tokens).toEqual({
          providerId: "01JTEST000000000000000001",
          accessToken: "access-xyz",
          refreshToken: "refresh-abc",
          expiresAt: "2026-05-01T00:00:00Z",
        });
      }),
    );

    db.close();
  });

  it("returns null getTokens when no tokens exist for the provider", () => {
    const { layer, db } = createTestLayer();

    run(
      layer,
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        yield* repo.insert({
          id: "01JTEST000000000000000001",
          type: "copilot",
          apiKey: "",
        });

        const tokens = yield* repo.getTokens("01JTEST000000000000000001");
        expect(tokens).toBeNull();
      }),
    );

    db.close();
  });

  it("updates tokens in place when upsertTokens is called twice", () => {
    const { layer, db } = createTestLayer();

    run(
      layer,
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        yield* repo.insert({
          id: "01JTEST000000000000000001",
          type: "copilot",
          apiKey: "",
        });

        yield* repo.upsertTokens({
          providerId: "01JTEST000000000000000001",
          accessToken: "access-first",
        });
        yield* repo.upsertTokens({
          providerId: "01JTEST000000000000000001",
          accessToken: "access-second",
          refreshToken: "refresh-second",
        });

        const tokens = yield* repo.getTokens("01JTEST000000000000000001");
        expect(tokens?.accessToken).toBe("access-second");
        expect(tokens?.refreshToken).toBe("refresh-second");
      }),
    );

    db.close();
  });

  it("cascades token deletion when provider is removed", () => {
    const { layer, db } = createTestLayer();

    run(
      layer,
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        yield* repo.insert({
          id: "01JTEST000000000000000001",
          type: "copilot",
          apiKey: "",
        });
        yield* repo.upsertTokens({
          providerId: "01JTEST000000000000000001",
          accessToken: "access-xyz",
        });

        yield* repo.remove("01JTEST000000000000000001");

        const tokens = yield* repo.getTokens("01JTEST000000000000000001");
        expect(tokens).toBeNull();
      }),
    );

    db.close();
  });

  it("re-enforces 0600 file mode after token upsert", () => {
    const { layer, db, dbPath } = createTestLayer();

    run(
      layer,
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        yield* repo.insert({
          id: "01JTEST000000000000000001",
          type: "copilot",
          apiKey: "",
        });
      }),
    );

    chmodSync(dbPath, 0o644);

    run(
      layer,
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        yield* repo.upsertTokens({
          providerId: "01JTEST000000000000000001",
          accessToken: "access-xyz",
        });
      }),
    );

    const stats = statSync(dbPath);
    expect(stats.mode & 0o777).toBe(0o600);

    db.close();
  });

  it("re-enforces 0600 file mode after credential remove", () => {
    const { layer, db, dbPath } = createTestLayer();

    run(
      layer,
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        yield* repo.insert({
          id: "01JTEST000000000000000001",
          type: "anthropic",
          apiKey: "sk-ant-test-key",
        });
      }),
    );

    chmodSync(dbPath, 0o644);

    run(
      layer,
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        yield* repo.remove("01JTEST000000000000000001");
      }),
    );

    const stats = statSync(dbPath);
    expect(stats.mode & 0o777).toBe(0o600);

    db.close();
  });
});
