/* Electron entrypoint and access-portal renderer for Mediator 2. */
if (typeof require === "function" && typeof module !== "undefined" && module.exports) {
  const { app, BrowserWindow, ipcMain, safeStorage, shell } = require("electron");
  const fs = require("node:fs/promises");
  const path = require("node:path");

  const hasLock = app.requestSingleInstanceLock();
  if (!hasLock) {
    app.quit();
  } else {
    let window;
    const credentialFile = () => path.join(app.getPath("userData"), "bridge-access.json");
    const createWindow = () => {
      window = new BrowserWindow({
        width: 1320, height: 820, minWidth: 760, minHeight: 620,
        frame: false, backgroundColor: "#08090b", show: false,
        webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false }
      });
      window.loadFile("index.html");
      window.once("ready-to-show", () => window.show());
    };
    app.on("second-instance", () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
    app.whenReady().then(() => {
      ipcMain.handle("window:minimize", () => window?.minimize());
      ipcMain.handle("window:close", () => window?.close());
      ipcMain.handle("external:open", (_, url) => shell.openExternal(url));
      ipcMain.handle("credentials:load", async () => {
        try {
          const saved = JSON.parse(await fs.readFile(credentialFile(), "utf8"));
          if (!safeStorage.isEncryptionAvailable()) return null;
          return { ...saved, token: safeStorage.decryptString(Buffer.from(saved.token, "base64")) };
        } catch { return null; }
      });
      ipcMain.handle("credentials:save", async (_, credentials) => {
        if (!safeStorage.isEncryptionAvailable()) throw new Error("Operating-system credential encryption is unavailable.");
        const saved = { ...credentials, token: safeStorage.encryptString(credentials.token).toString("base64") };
        await fs.writeFile(credentialFile(), JSON.stringify(saved), { mode: 0o600 });
      });
      ipcMain.handle("credentials:clear", async () => { await fs.rm(credentialFile(), { force: true }); });
      createWindow();
    });
    app.on("window-all-closed", () => app.quit());
  }
} else {
  const $ = (selector) => document.querySelector(selector);
  const form = $("#loginForm");
  const desktop = window.mediatorDesktop;
  let sessionBridge = null;

  const setLoading = (loading) => {
    $("#submitButton").classList.toggle("loading", loading);
    $("#submitButton").disabled = loading;
    [...form.elements].forEach((element) => { if (element.id !== "remember") element.disabled = loading; });
  };
  const showError = (message) => { $("#errorBox").textContent = message; $("#errorBox").hidden = false; };
  const request = async (path, credentials, options = {}) => {
    const response = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${credentials.token}`, "X-GitHub-Api-Version": "2022-11-28", ...options.headers }
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || `GitHub rejected the request (${response.status}).`);
    }
    return response.status === 204 ? null : response.json();
  };
  const connectBridge = async (credentials) => {
    const base = `/repos/${encodeURIComponent(credentials.owner)}/${encodeURIComponent(credentials.repo)}`;
    const repository = await request(base, credentials);
    let archive = { version: 2, characters: [], locations: [], updatedAt: null };
    try {
      const file = await request(`${base}/contents/mediator/data.json`, credentials);
      archive = JSON.parse(decodeURIComponent(escape(atob(file.content.replace(/\n/g, "")))));
    } catch (error) {
      if (!/Not Found/i.test(error.message)) throw error;
    }
    return { repository, archive, credentials };
  };
  window.mediatorBridge = {
    get session() { return sessionBridge; },
    async save(data) {
      if (!sessionBridge) throw new Error("Connect a bridge before saving.");
      const { credentials, repository } = sessionBridge;
      const base = `/repos/${encodeURIComponent(credentials.owner)}/${encodeURIComponent(credentials.repo)}/contents/mediator/data.json`;
      let sha;
      try { sha = (await request(base, credentials)).sha; } catch (error) { if (!/Not Found/i.test(error.message)) throw error; }
      const content = btoa(unescape(encodeURIComponent(JSON.stringify({ ...data, version: 2, updatedAt: new Date().toISOString() }, null, 2))));
      await request(base, credentials, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Update Mediator universe archive", content, branch: repository.default_branch, ...(sha && { sha }) }) });
    }
  };
  const restoreCredentials = async () => {
    const saved = await desktop?.loadCredentials();
    if (!saved) return;
    $("#owner").value = saved.owner; $("#repo").value = saved.repo; $("#token").value = saved.token;
    $("#remember").checked = true; $("#forgetButton").hidden = false;
  };
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); $("#errorBox").hidden = true;
    if (!form.reportValidity()) return;
    const credentials = { owner: $("#owner").value.trim(), repo: $("#repo").value.trim(), token: $("#token").value.trim() };
    setLoading(true);
    try {
      sessionBridge = await connectBridge(credentials);
      if ($("#remember").checked) await desktop?.saveCredentials(credentials); else await desktop?.clearCredentials();
      $("#successTitle").textContent = `Welcome, ${credentials.owner}.`;
      $("#successMessage").textContent = `${sessionBridge.repository.full_name} is ready · ${sessionBridge.archive.characters?.length || 0} characters restored`;
      $("#success").hidden = false;
    } catch (error) { showError(error.message === "Bad credentials" ? "That token was not accepted. Check the token and its repository access." : error.message); }
    finally { setLoading(false); }
  });
  $("#reveal").addEventListener("click", () => { const token = $("#token"); token.type = token.type === "password" ? "text" : "password"; });
  $("#tokenHelp").addEventListener("click", (event) => { if (desktop) { event.preventDefault(); desktop.openExternal(event.currentTarget.href); } });
  $("#minimize").addEventListener("click", () => desktop?.minimize());
  $("#closeWindow").addEventListener("click", () => desktop?.close());
  $("#forgetButton").addEventListener("click", async () => { await desktop?.clearCredentials(); form.reset(); $("#forgetButton").hidden = true; });
  restoreCredentials();
}
