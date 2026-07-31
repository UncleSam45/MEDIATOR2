const { contextBridge, ipcRenderer, webUtils } = require("electron");
const { pathToFileURL } = require("node:url");

contextBridge.exposeInMainWorld("mediatorDesktop", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  openExternal: (url) => ipcRenderer.invoke("external:open", url),
  loadCredentials: () => ipcRenderer.invoke("credentials:load"),
  saveCredentials: (credentials) => ipcRenderer.invoke("credentials:save", credentials),
  clearCredentials: () => ipcRenderer.invoke("credentials:clear"),
  addonState: () => ipcRenderer.invoke("addons:state"),
  loadCharacterSeasonMemory: () => ipcRenderer.invoke("character-season-memory:load"),
  saveCharacterSeasonMemory: (memory) => ipcRenderer.invoke("character-season-memory:save", memory),
  installAddon: (id) => ipcRenderer.invoke("addons:install", id),
  chooseAudiobookLibrary: () => ipcRenderer.invoke("audiobooks:choose"),
  scanAudiobooks: (path) => ipcRenderer.invoke("audiobooks:scan", path),
  chooseSeasonTrailer: () => ipcRenderer.invoke("seasons:choose-trailer"),
  localFileUrl: (file) => {
    const path = webUtils.getPathForFile(file);
    return path ? pathToFileURL(path).href : "";
  },
});
