const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mediatorDesktop", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  openExternal: (url) => ipcRenderer.invoke("external:open", url),
  loadCredentials: () => ipcRenderer.invoke("credentials:load"),
  saveCredentials: (credentials) => ipcRenderer.invoke("credentials:save", credentials),
  clearCredentials: () => ipcRenderer.invoke("credentials:clear"),
});
