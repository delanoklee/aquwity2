const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('acuity', {
  setTask: (task) => ipcRenderer.send('set-task', task),
  getHistory: () => ipcRenderer.invoke('get-history'),
  startTracking: () => ipcRenderer.send('start-tracking'),
  stopTracking: () => ipcRenderer.send('stop-tracking'),
  setFocusEnabled: (enabled) => ipcRenderer.send('set-focus-enabled', enabled),
  resizeWindow: (height) => ipcRenderer.send('resize-window', height),
  getCompletedTasks: () => ipcRenderer.invoke('get-completed-tasks'),
  completeTodo: (text, duration) => ipcRenderer.invoke('complete-todo', text, duration),
  bringToFront: () => ipcRenderer.send('bring-to-front'),
  categorizeActivities: (activities) => ipcRenderer.invoke('categorize-activities', activities),

  // Auth
  getUser: () => ipcRenderer.invoke('get-user'),
  logout: () => ipcRenderer.invoke('logout'),

  // Event listeners
  onAnalysisResult: (callback) => ipcRenderer.on('analysis-result', (_, data) => callback(data)),
  onTaskUpdated: (callback) => ipcRenderer.on('task-updated', (_, task) => callback(task)),
  onTaskCompleted: (callback) => ipcRenderer.on('task-completed', (_, result) => callback(result)),
  onOffTaskLevel: (callback) => ipcRenderer.on('off-task-level', (_, level) => callback(level)),
  onOffTaskFullyRed: (callback) => ipcRenderer.on('off-task-fully-red', (_, data) => callback(data)),
});
