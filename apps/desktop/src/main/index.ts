import { DatabaseSync } from "node:sqlite";

import { app, BrowserWindow, ipcMain, shell } from "electron";
import { Effect, Layer } from "effect";
import { ulid } from "ulidx";

import {
  Database,
  DbFilePath,
  initializeAppData,
  ProviderRepo,
  ProviderRepoLive,
} from "@hotwire/db";
import {
  pollForToken,
  requestDeviceCode,
  type DeviceFlowConfig,
  type TokenResponse,
} from "@hotwire/oauth";

import { DeviceFlowHttpLive } from "./device-flow.js";

const rendererUrl = process.env.HOTWIRE_RENDERER_URL;
const preloadPath = new URL("./preload.mjs", import.meta.url).pathname;

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: true,
    backgroundColor: "#0b1020",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  });

  if (rendererUrl) {
    void window.loadURL(rendererUrl);
    return window;
  }

  void window.loadFile(
    new URL("../../dist/renderer/index.html", import.meta.url).pathname,
  );
  return window;
}

function registerProviderHandlers(
  runSync: <A>(effect: Effect.Effect<A, unknown, ProviderRepo>) => A,
) {
  ipcMain.handle("providers:list", () =>
    runSync(
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        return yield* repo.list;
      }),
    ),
  );

  ipcMain.handle("providers:save", (_event, type: string, apiKey: string) =>
    runSync(
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        const id = ulid();
        yield* repo.insert({ id, type, apiKey });
        if (type === "anthropic") {
          yield* repo.setModelEnabled({
            providerId: id,
            modelId: "claude-sonnet-4-20250514",
            enabled: true,
          });
        }
      }),
    ),
  );

  ipcMain.handle(
    "providers:saveOAuth",
    (_event, type: string, tokens: TokenResponse) =>
      runSync(
        Effect.gen(function* () {
          const repo = yield* ProviderRepo;
          const id = ulid();
          yield* repo.insert({ id, type, apiKey: "" });
          const expiresAt =
            typeof tokens.expiresIn === "number"
              ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
              : undefined;
          yield* repo.upsertTokens({
            providerId: id,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt,
          });
        }),
      ),
  );

  ipcMain.handle("providers:remove", (_event, id: string) =>
    runSync(
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        yield* repo.remove(id);
      }),
    ),
  );

  ipcMain.handle("providers:hasEnabledModel", () =>
    runSync(
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        return yield* repo.hasEnabledModel;
      }),
    ),
  );

  ipcMain.handle("providers:listModels", (_event, providerId: string) =>
    runSync(
      Effect.gen(function* () {
        const repo = yield* ProviderRepo;
        return yield* repo.listModels(providerId);
      }),
    ),
  );

  ipcMain.handle(
    "providers:setModelEnabled",
    (_event, providerId: string, modelId: string, enabled: boolean) =>
      runSync(
        Effect.gen(function* () {
          const repo = yield* ProviderRepo;
          yield* repo.setModelEnabled({ providerId, modelId, enabled });
        }),
      ),
  );
}

function registerDeviceFlowHandlers() {
  ipcMain.handle("deviceFlow:start", (_event, config: DeviceFlowConfig) =>
    Effect.runPromise(
      requestDeviceCode(config).pipe(Effect.provide(DeviceFlowHttpLive)),
    ),
  );

  ipcMain.handle(
    "deviceFlow:poll",
    (_event, config: DeviceFlowConfig, deviceCode: string, interval: number) =>
      Effect.runPromise(
        pollForToken(config, deviceCode, interval).pipe(
          Effect.provide(DeviceFlowHttpLive),
        ),
      ),
  );

  ipcMain.handle("deviceFlow:openUrl", (_event, url: string) =>
    shell.openExternal(url),
  );
}

app.whenReady().then(() => {
  const { dbPath } = Effect.runSync(
    initializeAppData({
      homeDir: app.getPath("home"),
    }),
  );

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");

  const DatabaseLive = Layer.succeed(Database, db);
  const DbFilePathLive = Layer.succeed(DbFilePath, dbPath);
  const AppLayer = ProviderRepoLive.pipe(
    Layer.provide(Layer.merge(DatabaseLive, DbFilePathLive)),
  );

  const runSync = <A>(effect: Effect.Effect<A, unknown, ProviderRepo>) =>
    Effect.runSync(Effect.provide(effect, AppLayer));

  registerProviderHandlers(runSync);
  registerDeviceFlowHandlers();

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
