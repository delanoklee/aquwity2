const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { app, BrowserWindow, desktopCapturer, ipcMain, screen, globalShortcut, Menu } = require('electron');
const fs = require('fs');
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
let interventionWindow = null;
let completedTasks = [];
let completedTasksPath = null;
let offTaskCount = 0;
let focusEnabled = false;

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

async function analyzeActivity() {
  if (!process.env.GEMINI_API_KEY) {
    return { activity: "API key not configured" };
  }

  const checkFocus = focusEnabled && currentTask && currentTask.trim();

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

    let prompt;
    if (checkFocus) {
      prompt = `Analyze the screenshots and:
1. Describe SPECIFICALLY what the user is doing (be granular, not just "using VS Code")
2. Determine if they are working on their stated task: "${currentTask}"

Examples of good granularity:
- LinkedIn: 'Scrolling through feed reading posts' vs 'Viewing a specific person's profile'
- VS Code: 'Writing a new function in main.js' vs 'Debugging with breakpoints'
- Browser: 'Reading a technical article about React hooks' vs 'Shopping on Amazon'

Look at window titles, visible text, cursor position, and UI elements.

I'm showing you screenshots from all monitors. The first ${numMonitors} images are from the previous check (2 minutes ago), the next ${numMonitors} images are from the current check.

Respond with JSON only, no markdown: {"activity": "specific granular description", "onTask": true/false}`;
    } else {
      prompt = `Analyze the screenshots and describe SPECIFICALLY what the user is doing.
Be extremely granular - don't just say 'using LinkedIn' or 'in VS Code'.

Examples of good granularity:
- LinkedIn: 'Scrolling through feed reading posts' vs 'Viewing a specific person's profile'
  vs 'Composing a connection request message' vs 'Reading/replying to DMs'
- VS Code: 'Writing a new function in main.js' vs 'Debugging with breakpoints'
  vs 'Reading documentation in a markdown file' vs 'Running terminal commands'
- Browser: 'Reading a technical article about React hooks' vs 'Watching a YouTube tutorial'
  vs 'Shopping on Amazon' vs 'Checking email inbox'

Look at window titles, visible text, cursor position, and UI elements to determine
the specific action, not just the application.

I'm showing you screenshots from all monitors. The first ${numMonitors} images are from the previous check (2 minutes ago), the next ${numMonitors} images are from the current check.

Respond with JSON only, no markdown: {"activity": "specific granular description of current activity"}`;
    }

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { activity: "Could not parse response" };
  } catch (error) {
    console.error('Gemini API error:', error);
    return { activity: `API error: ${error.message}` };
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
    console.log('Analyzing activity...', focusEnabled ? '(focus enabled)' : '(observe only)');
    const result = await analyzeActivity();
    console.log('Analysis result:', result);

    const checkingFocus = focusEnabled && currentTask && currentTask.trim();

    const entry = {
      timestamp: new Date().toISOString(),
      type: 'observation',
      activity: result.activity,
      onTask: checkingFocus ? result.onTask : null
    };
    history.push(entry);

    // Handle focus mode off-task intervention
    if (checkingFocus) {
      const isError = result.activity && (
        result.activity.startsWith('API error:') ||
        result.activity === 'API key not configured' ||
        result.activity === 'Could not parse response'
      );

      if (result.onTask || isError) {
        offTaskCount = 0;
      } else {
        offTaskCount++;
        console.log('Off-task count:', offTaskCount);

        // Trigger intervention popup after 2 consecutive off-task checks
        if (offTaskCount >= 2) {
          showInterventionWindow();
        }
      }
    }

    // Send result to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('analysis-result', entry);
    }
  } else {
    console.log('Skipping analysis (need previous screenshots first)');
  }
}

function getCheckInterval() {
  // 30 seconds when locked in, 3 minutes when not
  return focusEnabled ? 30 * 1000 : 3 * 60 * 1000;
}

function updateTrackingInterval() {
  if (!trackingInterval) return;

  clearInterval(trackingInterval);
  trackingInterval = setInterval(performCheck, getCheckInterval());
  console.log(`Interval updated: ${focusEnabled ? '30 seconds' : '3 minutes'}`);
}

function startTracking() {
  if (trackingInterval) return;

  console.log('Tracking started');

  // Perform initial capture immediately
  captureAllScreens().then(screens => {
    screenshots.current = screens;
    console.log(`Initial capture: ${screens.length} screen(s)`);
  });

  // Set up interval based on focus mode
  trackingInterval = setInterval(performCheck, getCheckInterval());
  console.log(`Interval set: ${focusEnabled ? '30 seconds' : '3 minutes'}`);
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

ipcMain.on('set-focus-enabled', (event, enabled) => {
  focusEnabled = enabled;
  if (!enabled) {
    offTaskCount = 0; // Reset when disabling focus
  }
  updateTrackingInterval();
  console.log('Focus enabled:', enabled);
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

ipcMain.handle('complete-todo', (event, todoText) => {
  const completedTask = {
    timestamp: new Date().toISOString(),
    task: todoText,
    type: 'completed',
    source: 'todo'
  };
  completedTasks.push(completedTask);
  saveCompletedTasks();
  return completedTask;
});

function showInterventionWindow() {
  // Don't create multiple intervention windows
  if (interventionWindow && !interventionWindow.isDestroyed()) {
    interventionWindow.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const winWidth = 400;
  const winHeight = 200;

  interventionWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: Math.round((width - winWidth) / 2),
    y: Math.round((height - winHeight) / 2),
    frame: false,
    modal: true,
    parent: mainWindow,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: __dirname + '/intervention-preload.js',
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  interventionWindow.loadFile('intervention.html');

  // Send current task to intervention window once it's ready
  interventionWindow.webContents.on('did-finish-load', () => {
    interventionWindow.webContents.send('set-current-task', currentTask);
  });
}

ipcMain.on('confirm-task', (event, confirmedTask) => {
  currentTask = confirmedTask;
  offTaskCount = 0;

  // Sync the task back to the main window
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('task-updated', confirmedTask);
  }

  // Close intervention window
  if (interventionWindow && !interventionWindow.isDestroyed()) {
    interventionWindow.close();
    interventionWindow = null;
  }
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
