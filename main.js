require('dotenv').config();
const { app, BrowserWindow, desktopCapturer, ipcMain, screen, globalShortcut, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// In-memory state
let currentTask = "";
let screenshots = {
  previous: [],  // array of base64 strings (one per monitor)
  current: []    // array of base64 strings (one per monitor)
};
let history = [];
let trackingInterval = null;
let mainWindow = null;
let completedTasks = [];
let completedTasksPath = null;

function loadCompletedTasks() {
  try {
    if (fs.existsSync(completedTasksPath)) {
      completedTasks = JSON.parse(fs.readFileSync(completedTasksPath, 'utf8'));
    }
  } catch (e) {
    completedTasks = [];
  }
}

function saveCompletedTasks() {
  fs.writeFileSync(completedTasksPath, JSON.stringify(completedTasks, null, 2));
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: width,
    height: 50,
    x: 0,
    y: 0,
    frame: false,
    alwaysOnTop: false,
    resizable: false,
    skipTaskbar: true,
    transparent: false,
    webPreferences: {
      preload: __dirname + '/preload.js',
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setVisibleOnAllWorkspaces(true);
}

async function captureAllScreens() {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 }
  });

  const screenshots = [];
  for (const source of sources) {
    const thumbnail = source.thumbnail.toDataURL();
    // Remove the data:image/png;base64, prefix
    const base64 = thumbnail.replace(/^data:image\/\w+;base64,/, '');
    screenshots.push(base64);
  }
  return screenshots;
}

async function analyzeWithGemini() {
  if (!currentTask || currentTask.trim() === '') {
    return { onTask: false, reason: "No task specified" };
  }

  if (!process.env.GEMINI_API_KEY) {
    return { onTask: false, reason: "API key not configured" };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Build the image parts array
    const imageParts = [];

    // Add previous screenshots
    for (const base64 of screenshots.previous) {
      imageParts.push({
        inlineData: {
          data: base64,
          mimeType: "image/png"
        }
      });
    }

    // Add current screenshots
    for (const base64 of screenshots.current) {
      imageParts.push({
        inlineData: {
          data: base64,
          mimeType: "image/png"
        }
      });
    }

    const numMonitors = screenshots.current.length;
    const prompt = `Task the user is working on: "${currentTask}"

I'm showing you screenshots from all monitors. The first ${numMonitors} images are from the previous check (2 minutes ago), the next ${numMonitors} images are from the current check.

Analyze if the user appears to be working on the stated task.

Respond with JSON only, no markdown: {"onTask": true/false, "reason": "brief explanation"}`;

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { onTask: false, reason: "Could not parse response" };
  } catch (error) {
    console.error('Gemini API error:', error);
    return { onTask: false, reason: `API error: ${error.message}` };
  }
}

async function performCheck() {
  console.log('Performing check...');

  // Move current to previous
  screenshots.previous = screenshots.current;

  // Capture new screenshots
  screenshots.current = await captureAllScreens();
  console.log(`Captured ${screenshots.current.length} screen(s)`);

  // Only analyze if we have both sets (skip first check)
  if (screenshots.previous.length > 0) {
    console.log('Analyzing with Gemini...');
    const result = await analyzeWithGemini();
    console.log('Analysis result:', result);

    const entry = {
      timestamp: new Date().toISOString(),
      onTask: result.onTask,
      reason: result.reason
    };
    history.push(entry);

    // Send result to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('analysis-result', entry);
    }
  } else {
    console.log('Skipping analysis (need previous screenshots first)');
  }
}

function startTracking() {
  if (trackingInterval) return;

  console.log('Tracking started');

  // Perform initial capture immediately
  captureAllScreens().then(screens => {
    screenshots.current = screens;
    console.log(`Initial capture: ${screens.length} screen(s)`);
  });

  // Set up interval for 2 minutes
  trackingInterval = setInterval(performCheck, 2 * 60 * 1000);
}

function stopTracking() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
}

// IPC handlers
ipcMain.on('set-task', (event, taskText) => {
  currentTask = taskText;
});

ipcMain.handle('get-history', () => {
  return history;
});

ipcMain.on('start-tracking', () => {
  startTracking();
});

ipcMain.on('stop-tracking', () => {
  stopTracking();
});

ipcMain.on('resize-window', (event, height) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;
    mainWindow.setBounds({ x: 0, y: 0, width: width, height: height });
  }
});

ipcMain.handle('get-completed-tasks', () => {
  return completedTasks;
});

app.whenReady().then(() => {
  // Initialize completed tasks path and load saved tasks
  completedTasksPath = path.join(app.getPath('userData'), 'completed-tasks.json');
  loadCompletedTasks();

  // Set up application menu for copy/paste and reload support
  const menu = Menu.buildFromTemplate([
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);

  createWindow();

  // Register Ctrl+Shift+D global shortcut for marking task as done
  const registered = globalShortcut.register('CommandOrControl+Shift+D', () => {
    console.log('Ctrl+Shift+D pressed, currentTask:', currentTask);
    if (currentTask && currentTask.trim()) {
      const completedTask = {
        timestamp: new Date().toISOString(),
        task: currentTask,
        type: 'completed'
      };
      completedTasks.push(completedTask);
      saveCompletedTasks();
      console.log('Sending task-completed to renderer:', completedTask);
      mainWindow.webContents.send('task-completed', completedTask);
      currentTask = '';
    } else {
      console.log('No task to complete');
    }
  });
  console.log('Shortcut registered:', registered);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopTracking();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
