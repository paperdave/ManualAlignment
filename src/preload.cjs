const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('IPC', {
  getState: () => ipcRenderer.invoke("getState"),
  sync: (state) => ipcRenderer.send("sync", { state: state.toJSON() }),
});

