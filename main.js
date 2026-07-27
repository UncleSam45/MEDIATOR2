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
  let universe = null;
  let currentPage = "home";
  let currentDetail = null;
  const fallbackImage = "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1400&q=85";

  // A lightweight, dependency-free motion engine shared by the portal and archive.
  const motionEnabled = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const title = $(".split-title");
  title.innerHTML = `<span class="word" style="--i:0">Every</span> <span class="word" style="--i:1">world</span><br><span class="word" style="--i:2">begins</span> <span class="word" style="--i:3">with</span> <span class="word" style="--i:4">a</span> <em class="word" style="--i:5">door.</em>`;
  if (motionEnabled) {
    const canvas = $("#starfield"), context = canvas.getContext("2d");
    const pointer = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 };
    let stars = [];
    const resizeField = () => {
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = innerWidth * ratio; canvas.height = innerHeight * ratio;
      canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      stars = Array.from({ length: Math.min(140, Math.floor(innerWidth / 10)) }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, z: Math.random() * 1.5 + .2, size: Math.random() * 1.5 + .25 }));
    };
    const drawField = () => {
      pointer.x += (pointer.tx - pointer.x) * .07; pointer.y += (pointer.ty - pointer.y) * .07;
      context.clearRect(0, 0, innerWidth, innerHeight);
      stars.forEach((star) => {
        star.y -= star.z * .08; if (star.y < -3) star.y = innerHeight + 3;
        const x = star.x + (pointer.x - innerWidth / 2) * star.z * -.018;
        const y = star.y + (pointer.y - innerHeight / 2) * star.z * -.018;
        context.beginPath(); context.arc(x, y, star.size * star.z, 0, Math.PI * 2);
        context.fillStyle = `rgba(217,255,99,${.08 + star.z * .16})`; context.fill();
      });
      requestAnimationFrame(drawField);
    };
    const aura = $(".cursor-aura"), scene = $(".orbital-scene");
    window.addEventListener("resize", resizeField);
    document.addEventListener("pointermove", (event) => {
      pointer.tx = event.clientX; pointer.ty = event.clientY;
      aura.style.transform = `translate3d(${event.clientX - aura.offsetWidth / 2}px,${event.clientY - aura.offsetHeight / 2}px,0)`;
      document.documentElement.style.setProperty("--mx", `${event.clientX / innerWidth * 100}%`);
      document.documentElement.style.setProperty("--my", `${event.clientY / innerHeight * 100}%`);
      if (scene && !$("#workspace").hidden) return;
      if (scene) scene.style.transform = `translate(-50%,-50%) rotateX(${(event.clientY / innerHeight - .5) * -7}deg) rotateY(${(event.clientX / innerWidth - .5) * 9}deg)`;
      const card = event.target.closest(".feature-card,.entity-card,.command-tile");
      if (card) { const box = card.getBoundingClientRect(); card.style.transform = `perspective(900px) rotateX(${(event.clientY - box.top) / box.height * -7 + 3.5}deg) rotateY(${(event.clientX - box.left) / box.width * 8 - 4}deg) translateY(-3px)`; }
    });
    document.addEventListener("pointerover", (event) => { if (event.target.closest("button,a,input,.feature-card,.entity-card")) aura.classList.add("active"); });
    document.addEventListener("pointerout", (event) => { aura.classList.remove("active"); const card = event.target.closest(".feature-card,.entity-card,.command-tile"); if (card) card.style.transform = ""; });
    resizeField(); drawField();
  }

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
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const image = (item) => `<img src="${escapeHTML(item.image || fallbackImage)}" alt="${escapeHTML(item.name)}" onerror="this.src='${fallbackImage}'">`;
  const toast = (message) => { const element = $("#workspaceToast"); element.textContent = message; element.classList.add("show"); setTimeout(() => element.classList.remove("show"), 2400); };
  const persist = async (message = "Universe saved to GitHub") => {
    toast("SAVING TO BRIDGE…");
    try { await window.mediatorBridge.save(universe); toast(message); }
    catch (error) { toast(`SAVE FAILED · ${error.message}`); }
  };
  const workspaceShell = () => {
    $("#workspace").innerHTML = `<aside class="workspace-sidebar"><div class="brand"><span class="brand-mark"><i></i><i></i><i></i></span><span>MEDIATOR <b>2</b></span></div><nav class="workspace-nav"><button data-page="home"><span class="nav-symbol">⌂</span><span>Home</span></button><button data-page="characters"><span class="nav-symbol">♙</span><span>Characters</span><b id="characterCount"></b></button><button data-page="locations"><span class="nav-symbol">◇</span><span>Locations</span><b id="locationCount"></b></button></nav><div class="bridge-badge"><span>● BRIDGE ONLINE</span><strong>${escapeHTML(sessionBridge.repository.full_name)}</strong><small>${escapeHTML(sessionBridge.repository.default_branch)} · GitHub REST</small></div></aside><main class="workspace-main"><header class="workspace-topbar"><div class="crumb">THE UNIVERSE <b id="workspaceCrumb">COMMAND CENTER</b></div><button class="primary-button" data-create="character">＋ CREATE NEW</button></header><section id="workspaceView" class="workspace-view"></section></main>`;
    const scroller = $(".workspace-main");
    scroller.addEventListener("scroll", () => { const range = scroller.scrollHeight - scroller.clientHeight; $(".scroll-progress").style.width = `${range ? scroller.scrollTop / range * 100 : 0}%`; }, { passive: true });
  };
  const homeView = () => {
    const character = universe.characters[0], location = universe.locations[0];
    const content = character || location ? `<div class="world-hero">${character ? `<article class="feature-card" data-detail="character:${character.id}">${image(character)}<div class="card-copy"><span class="archive-tag">FEATURED CHARACTER</span><h2>${escapeHTML(character.name)}</h2><p>${escapeHTML(character.subtitle || "Unwritten legend")}</p></div></article>` : `<button class="empty-universe" data-create="character"><div><div class="empty-orb">＋</div><h2>Forge your first character</h2><p>Every universe needs someone to change it.</p></div></button>`}${location ? `<article class="feature-card secondary" data-detail="location:${location.id}">${image(location)}<div class="card-copy"><span class="archive-tag">EXPLORE LOCATION</span><h2>${escapeHTML(location.name)}</h2><p>${escapeHTML(location.meta || location.subtitle || "Unknown realm")}</p></div></article>` : `<button class="empty-universe" data-create="location"><div><div class="empty-orb">＋</div><h2>Discover a location</h2><p>Give your stories somewhere to unfold.</p></div></button>`}</div>` : `<div class="empty-universe"><div><div class="empty-orb">◇</div><h2>Your universe is waiting.</h2><p>The bridge is connected. Create the first soul or place in your new world.</p><button class="primary-button" data-create="character">CREATE FIRST CHARACTER →</button></div></div>`;
    $("#workspaceView").innerHTML = `<div class="workspace-heading"><div><span class="edition">WELCOME BACK, ARCHITECT</span><h1>Your universe is alive.</h1><p>Shape people and places, connect their stories, and let GitHub preserve every change.</p></div></div>${content}<div class="command-strip"><button class="command-tile" data-create="character"><small>QUICK ACTION</small><strong>＋ Character</strong></button><button class="command-tile" data-create="location"><small>QUICK ACTION</small><strong>＋ Location</strong></button><div class="command-tile"><small>UNIVERSE ARCHIVE</small><strong>${universe.characters.length + universe.locations.length} <i>ENTRIES</i></strong></div></div>`;
  };
  const collectionView = (type, query = "") => {
    const plural = `${type}s`, items = universe[plural].filter((item) => `${item.name} ${item.subtitle || ""}`.toLowerCase().includes(query.toLowerCase()));
    const heading = type === "character" ? "Meet the legends." : "Explore the realm.";
    $("#workspaceView").innerHTML = `<div class="workspace-heading"><div><span class="edition">${plural.toUpperCase()} ARCHIVE</span><h1>${heading}</h1><p>${type === "character" ? "Every hero, villain, and wanderer shaping the fate of your universe." : "Places with histories, atmosphere, and people whose stories cross their borders."}</p></div><div class="collection-tools"><input id="archiveSearch" value="${escapeHTML(query)}" placeholder="Search ${plural}…"><button class="primary-button" data-create="${type}">＋ ADD</button></div></div><div class="collection-grid">${items.map((item) => `<article class="entity-card" data-detail="${type}:${item.id}">${image(item)}<div class="card-copy"><span class="archive-tag">${escapeHTML(item.meta || "ARCHIVE ENTRY")}</span><h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.subtitle || "Story in progress")}</p></div></article>`).join("")}<button class="add-card" data-create="${type}"><div><span>＋</span><p>Create ${type}</p></div></button></div>`;
    $("#archiveSearch").addEventListener("input", (event) => { collectionView(type, event.target.value); $("#archiveSearch").focus(); });
  };
  const profileView = (type, id) => {
    const plural = `${type}s`, item = universe[plural].find((entry) => entry.id === id);
    if (!item) return navigate(plural);
    const related = type === "character" ? universe.locations.filter((location) => (item.relations || []).includes(location.id)) : universe.characters.filter((character) => (character.relations || []).includes(item.id));
    $("#workspaceView").innerHTML = `<article class="profile">${image(item)}<div class="profile-copy"><span class="edition">${escapeHTML(item.meta || "UNIVERSE ARCHIVE")}</span><h1>${escapeHTML(item.name)}</h1><p class="subtitle">${escapeHTML(item.subtitle || "STORY IN PROGRESS")}</p><p class="lore">${escapeHTML(item.description || "This entry is waiting for its story to be written.")}</p><div class="profile-actions"><button class="primary-button" data-edit="${type}:${id}">EDIT PROFILE</button><button class="ghost-button" data-delete="${type}:${id}">ARCHIVE ENTRY</button></div></div><aside class="connections"><h4>${type === "character" ? "CONNECTED LOCATIONS" : "CHARACTERS PRESENT"}</h4>${related.length ? related.map((entry) => `<div class="connection" data-detail="${type === "character" ? "location" : "character"}:${entry.id}">${image(entry)}<strong>${escapeHTML(entry.name)}</strong></div>`).join("") : "<small>No connections yet. Edit this profile to build one.</small>"}</aside></article>`;
  };
  const navigate = (page, detailId = null) => {
    currentPage = page; currentDetail = detailId;
    const type = page === "characters" ? "character" : "location";
    document.querySelectorAll(".workspace-nav button").forEach((button) => button.classList.toggle("active", button.dataset.page === page));
    $("#workspaceCrumb").textContent = detailId ? "ARCHIVE PROFILE" : page === "home" ? "COMMAND CENTER" : page.toUpperCase();
    $("#characterCount").textContent = universe.characters.length; $("#locationCount").textContent = universe.locations.length;
    detailId ? profileView(type, detailId) : page === "home" ? homeView() : collectionView(type);
    $(".workspace-main").scrollTo({ top: 0, behavior: "smooth" });
  };
  const openEntityModal = (type, id = "") => {
    const form = $("#entityForm"), item = id ? universe[`${type}s`].find((entry) => entry.id === id) : null;
    form.reset(); form.elements.type.value = type; form.elements.id.value = id;
    $("#entityModalTitle").textContent = `${id ? "Edit" : "Create"} ${type}`; $("#entityModalLabel").textContent = `${type.toUpperCase()} ARCHIVE`;
    $("#subtitleField").childNodes[0].textContent = type === "character" ? "TITLE" : "LOCATION TYPE"; $("#metaField").childNodes[0].textContent = type === "character" ? "LEVEL" : "REGION";
    $("#relationsField").hidden = type === "location"; form.elements.relations.innerHTML = universe.locations.map((location) => `<option value="${location.id}">${escapeHTML(location.name)}</option>`).join("");
    if (item) { ["name", "subtitle", "meta", "image", "description"].forEach((key) => { form.elements[key].value = item[key] || ""; }); [...form.elements.relations.options].forEach((option) => { option.selected = (item.relations || []).includes(option.value); }); }
    $("#entityModal").hidden = false; setTimeout(() => form.elements.name.focus(), 50);
  };
  const enterWorkspace = () => {
    universe = { version: 2, characters: [], locations: [], ...sessionBridge.archive };
    universe.characters ||= []; universe.locations ||= [];
    workspaceShell(); $("#workspace").hidden = false; $("#success").hidden = true; navigate("home");
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
      setTimeout(enterWorkspace, 950);
    } catch (error) { showError(error.message === "Bad credentials" ? "That token was not accepted. Check the token and its repository access." : error.message); }
    finally { setLoading(false); }
  });
  $("#reveal").addEventListener("click", () => { const token = $("#token"); token.type = token.type === "password" ? "text" : "password"; });
  $("#tokenHelp").addEventListener("click", (event) => { if (desktop) { event.preventDefault(); desktop.openExternal(event.currentTarget.href); } });
  $("#minimize").addEventListener("click", () => desktop?.minimize());
  $("#closeWindow").addEventListener("click", () => desktop?.close());
  $("#forgetButton").addEventListener("click", async () => { await desktop?.clearCredentials(); form.reset(); $("#forgetButton").hidden = true; });
  document.addEventListener("click", (event) => {
    if (motionEnabled) {
      const burst = document.createElement("span"); burst.className = "click-burst"; burst.style.left = `${event.clientX}px`; burst.style.top = `${event.clientY}px`;
      document.body.appendChild(burst); burst.addEventListener("animationend", () => burst.remove());
    }
    const page = event.target.closest("[data-page]"), create = event.target.closest("[data-create]"), detail = event.target.closest("[data-detail]"), edit = event.target.closest("[data-edit]"), remove = event.target.closest("[data-delete]"), action = event.target.closest("[data-action]");
    if (page && universe) navigate(page.dataset.page);
    if (create && universe) openEntityModal(create.dataset.create);
    if (detail && universe) { const [type, id] = detail.dataset.detail.split(":"); navigate(`${type}s`, id); }
    if (edit && universe) { const [type, id] = edit.dataset.edit.split(":"); openEntityModal(type, id); }
    if (action?.dataset.action === "close-modal") $("#entityModal").hidden = true;
    if (remove && universe) { const [type, id] = remove.dataset.delete.split(":"); if (confirm("Archive this entry? This will save the removal to your bridge.")) { universe[`${type}s`] = universe[`${type}s`].filter((entry) => entry.id !== id); if (type === "location") universe.characters.forEach((character) => { character.relations = (character.relations || []).filter((relation) => relation !== id); }); navigate(`${type}s`); persist("ENTRY ARCHIVED · BRIDGE UPDATED"); } }
  });
  $("#entityModal").addEventListener("click", (event) => { if (event.target === $("#entityModal")) $("#entityModal").hidden = true; });
  $("#entityForm").addEventListener("submit", (event) => {
    event.preventDefault(); const data = new FormData(event.target), type = data.get("type"), id = data.get("id") || `${type[0]}${Date.now()}`, list = universe[`${type}s`], existing = list.find((entry) => entry.id === id);
    const item = { ...existing, id, name: data.get("name").trim(), subtitle: data.get("subtitle").trim(), meta: data.get("meta").trim(), image: data.get("image").trim(), description: data.get("description").trim() };
    if (type === "character") item.relations = data.getAll("relations"); existing ? Object.assign(existing, item) : list.unshift(item);
    $("#entityModal").hidden = true; navigate(`${type}s`, id); persist(existing ? "PROFILE UPDATED · BRIDGE SAVED" : "NEW ENTRY CREATED · BRIDGE SAVED");
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") $("#entityModal").hidden = true; });
  restoreCredentials();
}
