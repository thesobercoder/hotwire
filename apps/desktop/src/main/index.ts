import { DatabaseSync } from "node:sqlite";

import { app, BrowserWindow, ipcMain } from "electron";
import { Effect, Layer } from "effect";
import { ulid } from "ulidx";

import {
  Database,
  initializeAppData,
  ProviderRepo,
  ProviderRepoLive,
} from "@hotwire/db";

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
        yield* repo.insert({ id: ulid(), type, apiKey });
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
  const AppLayer = ProviderRepoLive.pipe(Layer.provide(DatabaseLive));

  const runSync = <A>(effect: Effect.Effect<A, unknown, ProviderRepo>) =>
    Effect.runSync(Effect.provide(effect, AppLayer));

  registerProviderHandlers(runSync);

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
