import { DatabaseSync } from "node:sqlite";

import { app, BrowserWindow, ipcMain } from "electron";
import { ulid } from "ulidx";

import {
  initializeAppData,
  insertProvider,
  listProviders,
  removeProvider,
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

function registerProviderHandlers(db: DatabaseSync) {
  ipcMain.handle("providers:list", () => {
    return listProviders(db).map((row) => ({
      id: row.id,
      type: row.type,
      apiKey: row.api_key,
      createdAt: row.created_at,
    }));
  });

  ipcMain.handle("providers:save", (_event, type: string, apiKey: string) => {
    insertProvider(db, { id: ulid(), type, apiKey });
  });

  ipcMain.handle("providers:remove", (_event, id: string) => {
    removeProvider(db, id);
  });
}

app.whenReady().then(() => {
  const { dbPath } = initializeAppData({
    homeDir: app.getPath("home"),
  });

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");

  registerProviderHandlers(db);

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
