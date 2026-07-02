const path = require('node:path');
const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const { createWorkflow } = require('./workflow');
const { saveBatch } = require('../transmission/save');
const { printBatch } = require('../transmission/print');
const { createOAuthClientConfig } = require('../config/oauth-client');
const { createEmailSettingsStore } = require('../config/email-settings');
const { createSecureTokenStore } = require('../config/secure-token-store');
const { createGmailAuth } = require('../transmission/gmail-auth');
const { createGmailClient } = require('../transmission/gmail-client');
const { createEmailService } = require('../transmission/email');

let mainWindow;
let services;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#f4f7f5',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });
}

function serializeError(error) {
  return {
    ok: false,
    error: {
      code: error.code || 'UNEXPECTED_ERROR',
      message: error.message || 'Não foi possível concluir a operação.'
    }
  };
}

function createServices() {
  const userData = app.getPath('userData');
  const oauthClientConfig = createOAuthClientConfig({ projectRoot: app.getAppPath() });
  const settingsStore = createEmailSettingsStore({
    filePath: path.join(userData, 'email-settings.json')
  });
  const tokenStore = createSecureTokenStore({
    safeStorage,
    filePath: path.join(userData, 'gmail-oauth-tokens.bin')
  });
  const gmailAuth = createGmailAuth({
    oauthClientConfig,
    tokenStore,
    openExternal: (url) => shell.openExternal(url)
  });
  const gmailClient = createGmailClient({ oauthClientConfig, tokenStore });
  const emailService = createEmailService({ settingsStore, gmailClient });
  const transmit = createWorkflow({
    save: saveBatch,
    print: printBatch,
    email: emailService.sendBatch
  });
  return { transmit, settingsStore, gmailAuth, emailService };
}

ipcMain.handle('batch:transmit', async (event, request) => {
  try {
    const result = await services.transmit(request, BrowserWindow.fromWebContents(event.sender));
    return { ok: true, result };
  } catch (error) {
    return serializeError(error);
  }
});

ipcMain.handle('email:get-settings', async () => {
  try {
    return { ok: true, result: await services.settingsStore.getSettings() };
  } catch (error) {
    return serializeError(error);
  }
});

ipcMain.handle('email:save-settings', async (_event, settings) => {
  try {
    return { ok: true, result: await services.settingsStore.saveSettings(settings) };
  } catch (error) {
    return serializeError(error);
  }
});

ipcMain.handle('email:get-auth-status', async () => {
  try {
    return { ok: true, result: await services.gmailAuth.getAuthStatus() };
  } catch (error) {
    return serializeError(error);
  }
});

ipcMain.handle('email:connect', async () => {
  try {
    return { ok: true, result: await services.gmailAuth.connect() };
  } catch (error) {
    return serializeError(error);
  }
});

ipcMain.handle('email:cancel-connect', async () => {
  try {
    return { ok: true, result: services.gmailAuth.cancelConnect() };
  } catch (error) {
    return serializeError(error);
  }
});

ipcMain.handle('email:disconnect', async () => {
  try {
    return { ok: true, result: await services.gmailAuth.disconnect() };
  } catch (error) {
    return serializeError(error);
  }
});

ipcMain.handle('email:send-test', async () => {
  try {
    return { ok: true, result: await services.emailService.sendTest() };
  } catch (error) {
    return serializeError(error);
  }
});

app.whenReady().then(() => {
  services = createServices();
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
