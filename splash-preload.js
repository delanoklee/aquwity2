const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('acuitySplash', {
  openLogin: () => ipcRenderer.send('open-login'),
});
