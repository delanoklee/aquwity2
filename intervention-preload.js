const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('intervention', {
  onSetCurrentTask: (callback) => {
    ipcRenderer.on('set-current-task', (event, task) => {
      callback(task);
    });
  },

  confirmTask: (task) => {
    ipcRenderer.send('confirm-task', task);
  }
});
