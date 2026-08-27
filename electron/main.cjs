const path = require('node:path');
const { app, BrowserWindow, ipcMain, Menu, Notification, Tray, nativeImage } = require('electron');
const { startChatServer } = require('../server/index.cjs');

const isDev = !app.isPackaged;
let mainWindow;
let tray;
let embeddedServer;
let isQuitting = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function revealWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Halo Chat');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Halo Chatを開く', click: revealWindow },
    { type: 'separator' },
    {
      label: '終了',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));
  tray.on('double-click', revealWindow);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1040,
    minHeight: 700,
    backgroundColor: '#0b0d14',
    title: 'Halo Chat',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

async function bootServer() {
  try {
    embeddedServer = await startChatServer({
      host: '0.0.0.0',
      port: Number(process.env.HALO_CHAT_PORT || 3020),
      dataDir: path.join(app.getPath('userData'), 'server-data'),
      quiet: true,
    });
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
  }
}

app.on('second-instance', revealWindow);

app.whenReady().then(async () => {
  await bootServer();
  createWindow();
  createTray();

  ipcMain.handle('desktop:show-window', revealWindow);
  ipcMain.handle('desktop:notify', (_event, payload = {}) => {
    if (!Notification.isSupported()) return false;
    const notification = new Notification({
      title: String(payload.title || 'Halo Chat').slice(0, 80),
      body: String(payload.body || '').slice(0, 240),
      silent: Boolean(payload.silent),
    });
    notification.on('click', revealWindow);
    notification.show();
    return true;
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep the process alive in the tray so messages can still arrive.
  }
});

app.on('quit', () => {
  embeddedServer?.close?.();
});

