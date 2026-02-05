const path = require('path');
const { app, BrowserWindow, desktopCapturer, ipcMain, screen, globalShortcut, Menu } = require('electron');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// API key is injected at build time by CI, or loaded from .env for local dev
let GEMINI_API_KEY = '__GEMINI_API_KEY_PLACEHOLDER__';
if (GEMINI_API_KEY === '__GEMINI_API_KEY_PLACEHOLDER__') {
  // Local development - try to load from .env
  try {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
    GEMINI_API_KEY = GEMINI_API_KEY || '';
  } catch (e) {
    GEMINI_API_KEY = '';
  }
}

// In-memory state
let currentTask = "";
let screenshotBuffer = []; // Holds screenshot for analysis
let history = [];
let trackingInterval = null;
let mainWindow = null;
let interventionWindow = null;
let completedTasks = [];
let completedTasksPath = null;
let offTaskCount = 0;
let taskStartTime = null;  // Track when the current task was started
const focusEnabled = true;

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
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;
  const windowWidth = Math.round(width / 3);
  const x = Math.round((width - windowWidth) / 2);

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: 50,
    x: x,
    y: 0,
    frame: false,
    alwaysOnTop: false,
    resizable: false,
    skipTaskbar: true,
    transparent: true,
    webPreferences: {
      preload: __dirname + '/preload.js',
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setVisibleOnAllWorkspaces(true);
}

async function captureAllScreens(windowToHide) {
  // Temporarily make window invisible for capture
  if (windowToHide) {
    windowToHide.setOpacity(0);
  }

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 }
  });

  // Restore window visibility
  if (windowToHide) {
    windowToHide.setOpacity(1);
  }

  const screenshots = [];
  for (const source of sources) {
    const thumbnail = source.thumbnail.toDataURL();
    // Remove the data:image/png;base64, prefix
    const base64 = thumbnail.replace(/^data:image\/\w+;base64,/, '');
    screenshots.push(base64);
  }
  return screenshots;
}

async function analyzeBatch(buffer) {
  if (!currentTask || currentTask.trim() === '') {
    return { on: 0, activity: "No task specified" };
  }

  if (!GEMINI_API_KEY) {
    return { on: 0, activity: "API key not configured" };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Build the image parts array from all screenshots in the buffer
    const imageParts = [];
    for (const screenshotSet of buffer) {
      for (const base64 of screenshotSet) {
        imageParts.push({
          inlineData: {
            data: base64,
            mimeType: "image/png"
          }
        });
      }
    }

    const prompt = `You are checking if a user is actively working on their stated task.

Task: "${currentTask}"

Determine if the user's current activity matches their task:
- Match SEMANTICALLY, not literally (task "watching youtube" matches activity "viewing a YouTube video")
- Look at: window titles, URLs, visible content, applications in use
- No motion between frames = READING/THINKING (on-task if content is relevant)
- When ambiguous, lean toward on-task
- IGNORE any UI overlay with "ACUITY" text or 🔒 lock icons - this is a focus app, not the user's work

Return ONLY raw JSON:
{
  "on": 1 if activity matches task, 0 if clearly unrelated,
  "activity": "specific description with quoted text from screen"
}

Examples:
- Task "watch youtube" + YouTube open = on:1
- Task "write code" + VS Code with code visible = on:1
- Task "write code" + browsing Reddit = on:0`;

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Normalize the response
      return {
        onTask: parsed.on === 1 || parsed.on === true,
        activity: parsed.activity || "Unknown activity"
      };
    }
    return { onTask: false, activity: "Could not parse response" };
  } catch (error) {
    console.error('Gemini API error:', error);
    return { onTask: false, activity: `API error: ${error.message}` };
  }
}

async function analyzeActivityObserveMode(buffer) {
  if (!GEMINI_API_KEY) {
    return { activity: "API key not configured" };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Build the image parts array from all screenshots in the buffer
    const imageParts = [];
    for (const screenshotSet of buffer) {
      for (const base64 of screenshotSet) {
        imageParts.push({
          inlineData: {
            data: base64,
            mimeType: "image/png"
          }
        });
      }
    }

    const prompt = `Analyze the screenshots and describe SPECIFICALLY what the user is doing.
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

I'm showing you 3 consecutive screenshots (1 second apart).

Respond with JSON only, no markdown: {"activity": "specific granular description of current activity"}`;

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
  console.log('Capturing screenshot...');

  // Capture new screenshots (hide mainWindow during capture)
  const currentScreenshot = await captureAllScreens(mainWindow);
  screenshotBuffer.push(currentScreenshot);
  console.log(`Captured ${currentScreenshot.length} screen(s)`);

  // Analyze immediately (every second)
  if (screenshotBuffer.length >= 1) {
    const checkingFocus = focusEnabled && currentTask && currentTask.trim();
    console.log('Analyzing screenshot...', checkingFocus ? '(focus enabled)' : '(observe only)');

    let result;
    if (checkingFocus) {
      result = await analyzeBatch(screenshotBuffer);
      // Convert to common format
      result = {
        activity: result.activity,
        onTask: result.on === 1
      };
    } else {
      result = await analyzeActivityObserveMode(screenshotBuffer);
      result.onTask = null;
    }

    console.log('Analysis result:', result);

    // Reset buffer after analysis
    screenshotBuffer = [];

    const entry = {
      timestamp: new Date().toISOString(),
      type: 'observation',
      activity: result.activity,
      onTask: result.onTask,
      task: currentTask  // Track which task this observation belongs to
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
        // Reset when back on-task
        if (offTaskCount > 0) {
          mainWindow.setAlwaysOnTop(false);
          mainWindow.webContents.send('off-task-level', false);  // on-task
        }
        offTaskCount = 0;
      } else {
        offTaskCount++;
        console.log('Off-task count:', offTaskCount);

        if (offTaskCount === 3) {
          // First off-task: bring window to top and start animation
          mainWindow.setAlwaysOnTop(true, 'screen-saver');
          mainWindow.moveTop();
          mainWindow.focus();
          mainWindow.webContents.send('off-task-level', true);  // start animation
        }

        // Notify renderer when animation reaches fully red (90 seconds)
        if (offTaskCount === 90) {
          mainWindow.webContents.send('off-task-fully-red', true);
        }
      }
    }

    // Send result to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('analysis-result', entry);
    }
  }
}

function getCheckInterval() {
  // 1 second when locked in, 3 minutes when not
  return focusEnabled ? 1 * 1000 : 3 * 60 * 1000;
}

function updateTrackingInterval() {
  if (!trackingInterval) return;

  clearInterval(trackingInterval);
  screenshotBuffer = []; // Reset buffer when interval changes
  trackingInterval = setInterval(performCheck, getCheckInterval());
  console.log(`Interval updated: ${focusEnabled ? '1 second' : '3 minutes'}`);
}

function startTracking() {
  if (trackingInterval) return;

  console.log('Tracking started');

  // Reset buffer
  screenshotBuffer = [];

  // Perform initial capture immediately
  performCheck();

  // Set up interval based on focus mode
  trackingInterval = setInterval(performCheck, getCheckInterval());
  console.log(`Interval set: ${focusEnabled ? '1 second' : '3 minutes'}`);
}

function stopTracking() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  // Clean up off-task state
  offTaskCount = 0;
}

// IPC handlers
ipcMain.on('set-task', (event, taskText) => {
  console.log('set-task received:', taskText);
  currentTask = taskText;
});

ipcMain.handle('get-history', () => {
  return history;
});

ipcMain.on('start-tracking', () => {
  taskStartTime = Date.now();  // Track when task started
  startTracking();
});

ipcMain.on('stop-tracking', () => {
  taskStartTime = null;  // Clear start time when tracking stops
  stopTracking();
});

// Focus is always enabled - no-op handler for backwards compatibility
ipcMain.on('set-focus-enabled', (event, enabled) => {
  // Focus mode is always on now - this handler is kept for API compatibility
  console.log('Focus mode is always on (received:', enabled, ')');
});

ipcMain.on('resize-window', (event, height) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;
    const windowWidth = Math.round(width / 3);
    const x = Math.round((width - windowWidth) / 2);
    mainWindow.setBounds({ x: x, y: 0, width: windowWidth, height: height });
  }
});

ipcMain.handle('get-completed-tasks', () => {
  return completedTasks;
});

ipcMain.handle('complete-todo', (event, todoText, duration) => {
  const completedTask = {
    timestamp: new Date().toISOString(),
    task: todoText,
    type: 'completed',
    source: 'todo',
    duration: duration  // milliseconds, or null if not tracked
  };
  completedTasks.push(completedTask);
  saveCompletedTasks();
  return completedTask;
});

ipcMain.handle('categorize-activities', async (event, activities) => {
  if (!GEMINI_API_KEY || activities.length === 0) {
    return {};
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `I have a list of off-task activities that a user did while they should have been working. Please categorize these activities into logical groups.

Activities:
${activities.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Analyze these activities and group them into categories that make sense (e.g., "Social Media", "Entertainment", "Shopping", "News", "Communication", etc.). You decide the categories based on what you see - don't use predefined categories.

Respond with JSON only, no markdown. Format:
{"categories": {"Category Name": ["activity 1", "activity 2"], "Another Category": ["activity 3"]}}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.categories || {};
    }
    return {};
  } catch (error) {
    console.error('Error categorizing activities:', error);
    return {};
  }
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
      const duration = taskStartTime ? Date.now() - taskStartTime : null;
      const completedTask = {
        timestamp: new Date().toISOString(),
        task: currentTask,
        type: 'completed',
        duration: duration  // milliseconds, or null if not tracked
      };
      completedTasks.push(completedTask);
      saveCompletedTasks();
      console.log('Sending task-completed to renderer:', completedTask);
      mainWindow.webContents.send('task-completed', completedTask);
      // Reset off-task warning state
      if (offTaskCount > 0) {
        mainWindow.setAlwaysOnTop(false);
        mainWindow.webContents.send('off-task-level', false);
      }
      offTaskCount = 0;
      currentTask = '';
      taskStartTime = null;  // Reset after completing
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
