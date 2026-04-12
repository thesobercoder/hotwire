import { app, BrowserWindow } from "electron";

import { initializeAppData } from "./app-data.js";

const rendererUrl = process.env.HOTWIRE_RENDERER_URL;

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

app.whenReady().then(() => {
  initializeAppData({
    homeDir: app.getPath("home"),
  });

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
