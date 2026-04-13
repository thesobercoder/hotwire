import { contextBridge, ipcRenderer } from "electron";

import type { HotwireApi } from "../shared/types";

const hotwireApi: HotwireApi = {
  providers: {
    list: () => ipcRenderer.invoke("providers:list"),
    save: (type, apiKey) => ipcRenderer.invoke("providers:save", type, apiKey),
    remove: (id) => ipcRenderer.invoke("providers:remove", id),
  },
};

contextBridge.exposeInMainWorld("hotwire", hotwireApi);
