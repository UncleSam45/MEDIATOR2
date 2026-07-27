const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mediator', {
  loadCredentials: () => ipcRenderer.invoke('credentials:load'),
  connect: (credentials) => ipcRenderer.invoke('github:connect', credentials),
  saveData: (data) => ipcRenderer.invoke('bridge:save', data)
});
