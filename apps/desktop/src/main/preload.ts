import { contextBridge, ipcRenderer } from "electron";

import type { HotwireApi } from "../shared/types";

const hotwireApi: HotwireApi = {
  providers: {
    list: () => ipcRenderer.invoke("providers:list"),
    save: (type, apiKey) => ipcRenderer.invoke("providers:save", type, apiKey),
    remove: (id) => ipcRenderer.invoke("providers:remove", id),
    hasEnabledModel: () => ipcRenderer.invoke("providers:hasEnabledModel"),
    listModels: (providerId) =>
      ipcRenderer.invoke("providers:listModels", providerId),
    setModelEnabled: (providerId, modelId, enabled) =>
      ipcRenderer.invoke(
        "providers:setModelEnabled",
        providerId,
        modelId,
        enabled,
      ),
  },
  deviceFlow: {
    start: (config) => ipcRenderer.invoke("deviceFlow:start", config),
    poll: (config, deviceCode, interval) =>
      ipcRenderer.invoke("deviceFlow:poll", config, deviceCode, interval),
    openUrl: (url) => ipcRenderer.invoke("deviceFlow:openUrl", url),
  },
};

contextBridge.exposeInMainWorld("hotwire", hotwireApi);
