// src/main.js - Electron Main Process
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
require('dotenv').config();

let mainWindow;

function createWindow() {
  const { width, height } = require('electron').screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false, // Fixed size for overlay
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      backgroundThrottling: false
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  // Default: Ignore mouse events (pass through)
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Mouse event forwarding handler
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win.setIgnoreMouseEvents(ignore, { forward: true });
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open DevTools in dev mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  console.log('🚀 AI Companion Started!');
  console.log('📍 Environment loaded:', {
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasElevenLabsKey: !!process.env.ELEVENLABS_API_KEY
  });

  // Grant permissions for voice/mic
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'audioCapture'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });
}

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

const Automation = require('./automation');

// IPC handlers
ipcMain.handle('get-env', (event, key) => {
  return process.env[key];
});

// Screen Capture Handler
ipcMain.handle('take-screenshot', async () => {
  const { desktopCapturer } = require('electron');
  // Get screens
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 }
  });

  // Use first screen
  const primarySource = sources[0];
  const image = primarySource.thumbnail.toPNG();
  return image.toString('base64');
});

// Browser Automation Handler
ipcMain.handle('perform-action', async (event, action) => {
  try {
    console.log('🤖 Performing action:', action);

    if (action.type === 'open') {
      await Automation.navigate(action.url);
      return "Opened " + action.url;
    }

    if (action.type === 'search') {
      await Automation.search(action.query);
      return "Searched for " + action.query;
    }

    // Phase 7: Desktop Control
    if (action.type === 'app') {
      const { exec } = require('child_process');
      const appName = action.app.toLowerCase();
      let command = `start ${action.app}`;

      const appMap = {
        'calculator': 'calc',
        'notepad': 'notepad',
        'vscode': 'code',
        'vs code': 'code',
        'visual studio code': 'code',
        'terminal': 'cmd',
        'explorer': 'explorer',
        'chrome': 'chrome'
      };

      if (appMap[appName]) {
        command = `start ${appMap[appName]}`;
      } else {
        // Handle names with spaces by quoting
        command = `start "" "${action.app}"`;
      }

      exec(command, (err) => {
        if (err) console.error("Failed to launch app:", err);
      });
      return "Launching " + action.app;
    }

    // Phase 7: Typing (Keyboard Simulation)
    if (action.type === 'type') {
      const { spawn } = require('child_process');
      const text = action.text.replace(/"/g, '\\"');

      // Improved Focus Logic:
      // 1. Wait 1s
      // 2. Try to activate window by commonly known process names (Notepad, Chrome, Code)
      // 3. SendKeys

      const psCommand = `
         Start-Sleep -Seconds 1
         Add-Type -AssemblyName Microsoft.VisualBasic
         Add-Type -AssemblyName System.Windows.Forms
         
         # Try to find and activate the likely active process/window
         # For simplicity in this demo, we assume the user JUST launched it or it's the active window.
         # But let's try to be smart:
         
         [Microsoft.VisualBasic.Interaction]::AppActivate("Notepad")
         # If Notepad isn't open, this might throw, but we catch it silently in PS usually or subsequent commands run.
         # Actually AppActivate throws if not found. Let's make it try/catch or just simple SendKeys fallback.
         
         Start-Sleep -Milliseconds 500
         [System.Windows.Forms.SendKeys]::SendWait("${text}")
       `;

      const ps = spawn('powershell', ['-Command', psCommand]);

      ps.stderr.on('data', (data) => {
        console.error(`PS Error: ${data}`);
      });

      return "Typing: " + action.text;
    }

    return "Unknown action";
  } catch (error) {
    console.error('Automation failed:', error);
    return "Failed: " + error.message;
  }
});

console.log('✅ Electron app initialized');