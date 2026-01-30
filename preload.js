const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('acuity', {
  setTask: (taskText) => {
    ipcRenderer.send('set-task', taskText);
  },

  onAnalysisResult: (callback) => {
    ipcRenderer.on('analysis-result', (event, result) => {
      callback(result);
    });
  },

  getHistory: () => {
    return ipcRenderer.invoke('get-history');
  },

  startTracking: () => {
    ipcRenderer.send('start-tracking');
  },

  stopTracking: () => {
    ipcRenderer.send('stop-tracking');
  },

  resizeWindow: (height) => {
    ipcRenderer.send('resize-window', height);
  },

  onTaskCompleted: (callback) => {
    ipcRenderer.on('task-completed', (event, result) => {
      console.log('preload: task-completed received', result);
      callback(result);
    });
  },

  getCompletedTasks: () => ipcRenderer.invoke('get-completed-tasks')
});
