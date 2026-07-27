const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const BRIDGE_PATH = '.mediator2/data.json';
let mainWindow;
let activeCredentials = null;

function credentialsPath() {
  return path.join(app.getPath('userData'), 'credentials.json');
}

async function loadCredentials() {
  try {
    const saved = JSON.parse(await fs.readFile(credentialsPath(), 'utf8'));
    if (!saved.token || !safeStorage.isEncryptionAvailable()) return null;
    return { ...saved, token: safeStorage.decryptString(Buffer.from(saved.token, 'base64')) };
  } catch {
    return null;
  }
}

async function rememberCredentials(credentials) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure credential storage is unavailable on this computer.');
  }
  await fs.mkdir(path.dirname(credentialsPath()), { recursive: true });
  const payload = {
    owner: credentials.owner,
    repo: credentials.repo,
    token: safeStorage.encryptString(credentials.token).toString('base64')
  };
  await fs.writeFile(credentialsPath(), JSON.stringify(payload), { mode: 0o600 });
}

async function githubRequest(credentials, apiPath, options = {}) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${credentials.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'MEDIATOR-2',
      ...options.headers
    }
  });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || `GitHub returned ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function connect(credentials) {
  const owner = credentials.owner.trim();
  const repo = credentials.repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
  const parts = repo.includes('/') ? repo.split('/') : [owner, repo];
  const normalized = { owner: parts[0], repo: parts[1], token: credentials.token.trim() };
  if (!normalized.owner || !normalized.repo || !normalized.token) throw new Error('Complete all three fields.');

  const base = `/repos/${encodeURIComponent(normalized.owner)}/${encodeURIComponent(normalized.repo)}`;
  const repository = await githubRequest(normalized, base);
  let restored = false;
  let bridgeData = {};
  try {
    const remote = await githubRequest(normalized, `${base}/contents/${BRIDGE_PATH}`);
    const document = JSON.parse(Buffer.from(remote.content, 'base64').toString('utf8'));
    bridgeData = document.data || {};
    restored = true;
  } catch (error) {
    if (error.status !== 404) throw error;
    const initialData = { version: 1, updatedAt: new Date().toISOString(), data: {} };
    await githubRequest(normalized, `${base}/contents/${BRIDGE_PATH}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: 'Initialize MEDIATOR 2 bridge',
        content: Buffer.from(JSON.stringify(initialData, null, 2)).toString('base64')
      })
    });
  }
  if (credentials.remember) await rememberCredentials(normalized);
  else await fs.rm(credentialsPath(), { force: true });
  activeCredentials = normalized;
  return { repository: repository.full_name, restored, data: bridgeData };
}

async function saveBridgeData(data) {
  if (!activeCredentials) throw new Error('Connect a workspace before saving data.');
  const base = `/repos/${encodeURIComponent(activeCredentials.owner)}/${encodeURIComponent(activeCredentials.repo)}`;
  const remote = await githubRequest(activeCredentials, `${base}/contents/${BRIDGE_PATH}`);
  const document = { version: 1, updatedAt: new Date().toISOString(), data };
  await githubRequest(activeCredentials, `${base}/contents/${BRIDGE_PATH}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: 'Update MEDIATOR 2 workspace',
      sha: remote.sha,
      content: Buffer.from(JSON.stringify(document, null, 2)).toString('base64')
    })
  });
  return { savedAt: document.updatedAt };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#07100f',
    titleBarStyle: 'hiddenInset',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.loadFile('index.html');
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => {
    ipcMain.handle('credentials:load', loadCredentials);
    ipcMain.handle('github:connect', (_event, credentials) => connect(credentials));
    ipcMain.handle('bridge:save', (_event, data) => saveBridgeData(data));
    createWindow();
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}
