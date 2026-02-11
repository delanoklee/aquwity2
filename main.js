const path = require('path');
const { app, BrowserWindow, desktopCapturer, ipcMain, screen, globalShortcut, Menu, shell } = require('electron');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// ============================================
// CONFIGURATION
// ============================================
const API_URL = 'https://api.aquwity.com';
const supabase = createClient(
  'https://clamoycyzwyizqctlhcs.supabase.co',
  'sb_publishable_MwdE7DkNUKv6406TmcMt0g_3NnXDh0J'
);

// ============================================
// STATE
// ============================================
let currentTask = "";
let screenshotBuffer = [];
let history = [];
let trackingInterval = null;
let mainWindow = null;
let splashWindow = null;
let interventionWindow = null;
let completedTasks = [];
let offTaskCount = 0;
let taskStartTime = null;
let isLockedIn = false;
const focusEnabled = true;

// Auth state
let authSession = null; // { access_token, refresh_token, user }
let authPath = null;    // Path to stored session file

// ============================================
// CUSTOM PROTOCOL - Register 'acuity://' deep link
// ============================================
if (process.defaultApp) {
  // In development, register the protocol with the path to electron
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('acuity', process.execPath, [path.resolve(process.argv[1])]);

    // On Linux, also create a .desktop file so xdg-open can find the handler
    if (process.platform === 'linux') {
      try {
        const { execSync } = require('child_process');
        const desktopDir = path.join(app.getPath('home'), '.local', 'share', 'applications');
        fs.mkdirSync(desktopDir, { recursive: true });
        const desktopEntry = [
          '[Desktop Entry]',
          'Name=Acuity (Dev)',
          'Type=Application',
          `Exec="${process.execPath}" "${path.resolve(process.argv[1])}" %U`,
          'StartupNotify=false',
          'MimeType=x-scheme-handler/acuity;',
        ].join('\n');
        const desktopFilePath = path.join(desktopDir, 'acuity-dev.desktop');
        fs.writeFileSync(desktopFilePath, desktopEntry + '\n');
        execSync(`xdg-mime default acuity-dev.desktop x-scheme-handler/acuity`);
      } catch (e) {
        console.warn('Failed to register acuity:// protocol via .desktop file:', e.message);
      }
    }
  }
} else {
  // In production
  app.setAsDefaultProtocolClient('acuity');
}

// Handle the protocol URL when app is already running (macOS)
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleAuthCallback(url);
});

// Handle the protocol URL on Windows/Linux (second instance)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    // On Windows/Linux, the URL is in argv
    const url = argv.find(arg => arg.startsWith('acuity://'));
    if (url) {
      handleAuthCallback(url);
    }
    // Focus the existing window
    if (splashWindow) {
      if (splashWindow.isMinimized()) splashWindow.restore();
      splashWindow.focus();
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Parse the auth callback URL and save session
function handleAuthCallback(url) {
  console.log('Auth callback received:', url);
  try {
    // Parse acuity://auth-callback?access_token=...&refresh_token=...
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    const user_id = params.get('user_id');
    const email = params.get('email');

    if (access_token && refresh_token) {
      saveSession({
        access_token,
        refresh_token,
        user: { id: user_id, email },
      });

      // Close splash and open main app
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      createWindow();
    }
  } catch (err) {
    console.error('Error parsing auth callback:', err);
  }
}

// ============================================
// AUTH - Token Storage
// ============================================
function loadSession() {
  try {
    if (fs.existsSync(authPath)) {
      authSession = JSON.parse(fs.readFileSync(authPath, 'utf8'));
      console.log('[AUTH] Session loaded from disk for user:', authSession?.user?.id);
      return true;
    }
  } catch (e) {
    authSession = null;
  }
  return false;
}

async function refreshSession() {
  if (!authSession?.refresh_token) return false;
  console.log('[AUTH] Attempting token refresh...');
  try {
    const response = await fetch('https://clamoycyzwyizqctlhcs.supabase.co/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: {
        'apikey': 'sb_publishable_MwdE7DkNUKv6406TmcMt0g_3NnXDh0J',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: authSession.refresh_token }),
    });
    if (!response.ok) {
      console.log('[AUTH] Refresh failed, status:', response.status);
      return false;
    }
    const data = await response.json();
    authSession.access_token = data.access_token;
    authSession.refresh_token = data.refresh_token;
    saveSession(authSession);
    console.log('[AUTH] Refresh succeeded, new tokens saved');
    return true;
  } catch (err) {
    console.log('[AUTH] Refresh failed:', err.message);
    return false;
  }
}

function saveSession(session) {
  authSession = session;
  fs.writeFileSync(authPath, JSON.stringify(session, null, 2));
}

function clearSession() {
  authSession = null;
  if (authPath && fs.existsSync(authPath)) {
    fs.unlinkSync(authPath);
  }
}

// Update lock_status in Supabase to lock/unlock iPhone apps
async function updateLockStatus(isLocked) {
  if (!authSession?.user?.id) return;
  try {
    await fetch('https://clamoycyzwyizqctlhcs.supabase.co/rest/v1/lock_status', {
      method: 'POST',
      headers: {
        'apikey': 'sb_publishable_MwdE7DkNUKv6406TmcMt0g_3NnXDh0J',
        'Authorization': 'Bearer ' + authSession.access_token,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify({ user_id: authSession.user.id, is_locked: isLocked, updated_at: new Date().toISOString() })
    });
  } catch (err) {
    console.error('lock_status update failed:', err.message);
  }
}

// Helper to make authenticated API calls
async function apiFetch(endpoint, options = {}) {
  if (!authSession?.access_token) {
    throw new Error('Not authenticated');
  }

  const url = `${API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authSession.access_token}`,
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  // If token expired, try refreshing before forcing re-login
  if (response.status === 401) {
    console.log('[AUTH] Got 401, attempting refresh...');
    const refreshed = await refreshSession();
    if (refreshed) {
      // Retry the request with the new token
      const retryHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authSession.access_token}`,
        ...options.headers,
      };
      return await fetch(url, { ...options, headers: retryHeaders });
    }
    console.log('[AUTH] Refresh failed, clearing session');
    clearSession();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
    showSplashWindow();
    throw new Error('Session expired');
  }

  return response;
}

// ============================================
// SPLASH WINDOW - Shows "Sign In" button, opens browser
// ============================================
function showSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.focus();
    return;
  }

  splashWindow = new BrowserWindow({
    width: 400,
    height: 340,
    frame: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'splash-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  splashWindow.loadFile('splash.html');
}

// IPC: Open browser for login
ipcMain.on('open-login', () => {
  shell.openExternal(`${API_URL}/login`);
});

// ============================================
// MAIN WINDOW (same as before)
// ============================================
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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setVisibleOnAllWorkspaces(true);
}

// ============================================
// SCREENSHOT CAPTURE (unchanged)
// ============================================
async function captureAllScreens(windowToHide) {
  if (windowToHide) {
    windowToHide.setOpacity(0);
  }

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 }
  });

  if (windowToHide) {
    windowToHide.setOpacity(1);
  }

  const screenshots = [];
  for (const source of sources) {
    const thumbnail = source.thumbnail.toDataURL();
    const base64 = thumbnail.replace(/^data:image\/\w+;base64,/, '');
    screenshots.push(base64);
  }
  return screenshots;
}

// ============================================
// AI ANALYSIS - Calls your backend
// ============================================
async function analyzeBatch(buffer) {
  if (!currentTask || currentTask.trim() === '') {
    return { onTask: false, activity: "No task specified" };
  }

  try {
    const screenshots = [];
    for (const screenshotSet of buffer) {
      for (const base64 of screenshotSet) {
        screenshots.push(base64);
      }
    }

    const response = await apiFetch('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        task: currentTask,
        screenshots: screenshots,
      }),
    });

    const result = await response.json();

    if (result.error) {
      console.error('Analyze API error:', result.error);
      return { onTask: false, activity: `API error: ${result.error}` };
    }

    return {
      onTask: result.onTask === true,
      activity: result.activity || 'Unknown activity',
    };
  } catch (error) {
    console.error('Analyze error:', error);
    return { onTask: false, activity: `Error: ${error.message}` };
  }
}

// ============================================
// WINDOW LAYER HELPER
// ============================================
function updateWindowLayer() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (isLockedIn && offTaskCount >= 3) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.moveTop();
    mainWindow.focus();
    mainWindow.webContents.send('off-task-level', true);
  } else {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.webContents.send('off-task-level', false);
  }
}

// ============================================
// PERFORM CHECK
// ============================================
async function performCheck() {
  console.log('Capturing screenshot...');

  const currentScreenshot = await captureAllScreens();
  screenshotBuffer.push(currentScreenshot);
  console.log(`Captured ${currentScreenshot.length} screen(s)`);

  if (screenshotBuffer.length >= 1) {
    const checkingFocus = focusEnabled && currentTask && currentTask.trim();
    console.log('Analyzing screenshot...', checkingFocus ? '(focus mode)' : '(no task)');

    if (!checkingFocus) {
      screenshotBuffer = [];
      return;
    }

    const result = await analyzeBatch(screenshotBuffer);
    console.log('Analysis result:', result);

    screenshotBuffer = [];

    const entry = {
      timestamp: new Date().toISOString(),
      type: 'observation',
      activity: result.activity,
      onTask: result.onTask,
      task: currentTask
    };
    history.push(entry);

    // Handle off-task intervention
    const isError = result.activity && (
      result.activity.startsWith('API error:') ||
      result.activity.startsWith('Error:') ||
      result.activity === 'Could not parse response'
    );

    if (result.onTask || isError) {
      offTaskCount = 0;
      updateWindowLayer();
    } else {
      offTaskCount++;
      console.log('Off-task count:', offTaskCount);
      updateWindowLayer();
      if (offTaskCount === 90) {
        mainWindow.webContents.send('off-task-fully-red', true);
      }
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('analysis-result', entry);
    }
  }
}

// ============================================
// TRACKING (unchanged)
// ============================================
function getCheckInterval() {
  return focusEnabled ? 1 * 1000 : 3 * 60 * 1000;
}

function startTracking() {
  if (trackingInterval) return;
  console.log('Tracking started');
  screenshotBuffer = [];
  performCheck();
  trackingInterval = setInterval(performCheck, getCheckInterval());
}

function stopTracking() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  offTaskCount = 0;
}

// ============================================
// IPC HANDLERS
// ============================================
ipcMain.on('set-task', (event, taskText) => {
  console.log('set-task received:', taskText);
  currentTask = taskText;
});

ipcMain.handle('get-history', () => {
  return history;
});

ipcMain.on('start-tracking', () => {
  taskStartTime = Date.now();
  isLockedIn = true;
  startTracking();
  updateLockStatus(true);
});

ipcMain.on('stop-tracking', () => {
  taskStartTime = null;
  isLockedIn = false;
  stopTracking();
  updateLockStatus(false);
  updateWindowLayer();
});

ipcMain.on('set-focus-enabled', (event, enabled) => {
  console.log('Focus mode is always on (received:', enabled, ')');
});

ipcMain.on('toggle-locked-in', (event, enabled) => {
  isLockedIn = enabled;
  console.log('Locked-in mode:', isLockedIn);
  updateWindowLayer();
  updateLockStatus(isLockedIn);
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

ipcMain.on('bring-to-front', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.moveTop();
    mainWindow.focus();
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(false);
      }
    }, 200);
  }
});

// Completed tasks - saves to backend
ipcMain.handle('get-completed-tasks', async () => {
  try {
    const response = await apiFetch('/api/tasks');
    const data = await response.json();
    return data.map(t => ({
      timestamp: t.completed_at,
      task: t.task,
      type: 'completed',
      duration: (t.focused_ms || 0) + (t.distracted_ms || 0),
      focused_ms: t.focused_ms,
      distracted_ms: t.distracted_ms,
    }));
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return completedTasks;
  }
});

ipcMain.handle('complete-todo', async (event, todoText, duration) => {
  const completedTask = {
    timestamp: new Date().toISOString(),
    task: todoText,
    type: 'completed',
    source: 'todo',
    duration: duration,
  };

  try {
    const taskObservations = history.filter(h =>
      h.task === todoText && h.type === 'observation' && h.onTask !== null
    );
    const totalObs = taskObservations.length;
    const onTaskObs = taskObservations.filter(o => o.onTask).length;
    const offTaskObs = totalObs - onTaskObs;

    const focused_ms = totalObs > 0 ? Math.round((onTaskObs / totalObs) * (duration || 0)) : (duration || 0);
    const distracted_ms = totalObs > 0 ? Math.round((offTaskObs / totalObs) * (duration || 0)) : 0;

    await apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ task: todoText, focused_ms, distracted_ms }),
    });
  } catch (error) {
    console.error('Error saving completed task to backend:', error);
  }

  completedTasks.push(completedTask);
  return completedTask;
});

ipcMain.handle('categorize-activities', async (event, activities) => {
  return {};
});

// Auth IPC
ipcMain.handle('get-user', () => {
  if (authSession?.user) {
    return { email: authSession.user.email, id: authSession.user.id };
  }
  return null;
});

ipcMain.handle('logout', () => {
  clearSession();
  stopTracking();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
  showSplashWindow();
});

// ============================================
// INTERVENTION WINDOW (unchanged)
// ============================================
function showInterventionWindow() {
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
      preload: path.join(__dirname, 'intervention-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  interventionWindow.loadFile('intervention.html');

  interventionWindow.webContents.on('did-finish-load', () => {
    interventionWindow.webContents.send('set-current-task', currentTask);
  });
}

ipcMain.on('confirm-task', (event, confirmedTask) => {
  currentTask = confirmedTask;
  offTaskCount = 0;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('task-updated', confirmedTask);
  }

  if (interventionWindow && !interventionWindow.isDestroyed()) {
    interventionWindow.close();
    interventionWindow = null;
  }
});

// ============================================
// APP LIFECYCLE
// ============================================
app.whenReady().then(() => {
  authPath = path.join(app.getPath('userData'), 'auth-session.json');

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

  // Check for existing session and refresh token on launch
  if (loadSession()) {
    console.log('Found saved session, refreshing token...');
    refreshSession().then(refreshed => {
      if (refreshed) {
        console.log('[AUTH] Token refreshed on launch, opening main window');
      } else {
        console.log('[AUTH] Token refresh failed on launch, using existing token');
      }
      createWindow();
    });
  } else {
    console.log('No session found, showing splash...');
    showSplashWindow();
  }

  // Register Ctrl+Shift+D global shortcut
  const registered = globalShortcut.register('CommandOrControl+Shift+D', () => {
    console.log('Ctrl+Shift+D pressed, currentTask:', currentTask);
    if (currentTask && currentTask.trim()) {
      const duration = taskStartTime ? Date.now() - taskStartTime : null;

      const taskObservations = history.filter(h =>
        h.task === currentTask && h.type === 'observation' && h.onTask !== null
      );
      const totalObs = taskObservations.length;
      const onTaskObs = taskObservations.filter(o => o.onTask).length;
      const offTaskObs = totalObs - onTaskObs;
      const focused_ms = totalObs > 0 ? Math.round((onTaskObs / totalObs) * (duration || 0)) : (duration || 0);
      const distracted_ms = totalObs > 0 ? Math.round((offTaskObs / totalObs) * (duration || 0)) : 0;

      const completedTask = {
        timestamp: new Date().toISOString(),
        task: currentTask,
        type: 'completed',
        duration: duration,
      };
      completedTasks.push(completedTask);

      apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ task: currentTask, focused_ms, distracted_ms }),
      }).catch(err => console.error('Error saving task:', err));

      mainWindow.webContents.send('task-completed', completedTask);

      isLockedIn = false;
      offTaskCount = 0;
      updateWindowLayer();
      currentTask = '';
      taskStartTime = null;
      updateLockStatus(false);
    }
  });
  console.log('Shortcut registered:', registered);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (authSession) {
        createWindow();
      } else {
        showSplashWindow();
      }
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
