const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("mediatorDesktop", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  openExternal: (url) => ipcRenderer.invoke("external:open", url),
  loadCredentials: () => ipcRenderer.invoke("credentials:load"),
  saveCredentials: (credentials) => ipcRenderer.invoke("credentials:save", credentials),
  clearCredentials: () => ipcRenderer.invoke("credentials:clear"),
  addonState: () => ipcRenderer.invoke("addons:state"),
  installAddon: (id) => ipcRenderer.invoke("addons:install", id),
  chooseAudiobookLibrary: () => ipcRenderer.invoke("audiobooks:choose"),
  scanAudiobooks: (path) => ipcRenderer.invoke("audiobooks:scan", path),
  chooseSeasonTrailer: () => ipcRenderer.invoke("seasons:choose-trailer"),
  localFileUrl: (file) => {
    const path = webUtils.getPathForFile(file);
    return path ? `file://${path.split("\\").join("/")}` : "";
  },
});
