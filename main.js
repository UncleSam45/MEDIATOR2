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
  let currentPage = "characters";
  let currentDetail = null;
  let activeCharacterId = null;
  let lightboxIndex = 0;
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
      const card = event.target.closest(".feature-card,.entity-card,.roster-card");
      if (card) { const box = card.getBoundingClientRect(); card.style.transform = `perspective(900px) rotateX(${(event.clientY - box.top) / box.height * -7 + 3.5}deg) rotateY(${(event.clientX - box.left) / box.width * 8 - 4}deg) translateY(-3px)`; }
    });
    document.addEventListener("pointerover", (event) => { if (event.target.closest("button,a,input,.feature-card,.entity-card")) aura.classList.add("active"); });
    document.addEventListener("pointerout", (event) => { aura.classList.remove("active"); const card = event.target.closest(".feature-card,.entity-card,.roster-card"); if (card) card.style.transform = ""; });
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
    let archive = { version: 3, characters: [], locations: [], updatedAt: null };
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
      const characters = (data.characters || []).map((character) => ({ ...character, origin: String(character.origin || "Unknown origin").trim() }));
      const content = btoa(unescape(encodeURIComponent(JSON.stringify({ ...data, characters, version: 3, updatedAt: new Date().toISOString() }, null, 2))));
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
    $("#workspace").innerHTML = `<main class="workspace-main"><header class="workspace-topbar"><div class="brand"><span class="brand-mark"><i></i><i></i><i></i></span><span>MEDIATOR <b>2</b></span></div><div class="character-status"><span></span><div><small>CHARACTER ARCHIVE</small><strong id="characterCount">0 CHARACTERS</strong></div></div><div class="topbar-actions"><div class="bridge-inline"><span>● BRIDGE ONLINE</span><small>${escapeHTML(sessionBridge.repository.full_name)}</small></div><button class="primary-button" data-create="character">＋ NEW CHARACTER</button></div></header><section id="workspaceView" class="workspace-view"></section></main>`;
    const scroller = $(".workspace-main");
    scroller.addEventListener("scroll", () => { const range = scroller.scrollHeight - scroller.clientHeight; $(".scroll-progress").style.width = `${range ? scroller.scrollTop / range * 100 : 0}%`; }, { passive: true });
  };
  const collectionView = (type, query = "") => {
    const items = universe.characters.filter((item) => `${item.name} ${item.subtitle || ""}`.toLowerCase().includes(query.toLowerCase()));
    const featured = items.find((item) => item.id === activeCharacterId) || items[0] || universe.characters[0];
    if (!featured) {
      $("#workspaceView").innerHTML = `<div class="empty-universe"><div><span class="edition">CHARACTER ARCHIVE // EMPTY</span><div class="empty-orb">＋</div><h2>Summon your first legend.</h2><p>Build a character sheet and begin assembling your roster.</p><button class="primary-button" data-create="character">CREATE FIRST CHARACTER →</button></div></div>`;
      return;
    }
    const panels = (featured.gallery || []).slice(0, 8);
    const panelSlots = Array.from({ length: 8 }, (_, index) => panels[index]
      ? `<button class="character-panel filled" data-art="${index}" aria-label="Open artwork ${index + 1}"><img src="${escapeHTML(panels[index])}" alt="${escapeHTML(featured.name)} character panel ${index + 1}" onerror="this.closest('.character-panel').classList.add('image-error')"><span class="panel-caption"><b>0${index + 1}</b> CHARACTER ART</span></button>`
      : `<button class="character-panel empty" data-edit="character:${featured.id}" aria-label="Add artwork to portrait slot ${index + 1}"><span>0${index + 1}</span><i>＋</i><strong>PORTRAIT SLOT</strong><small>ADD ARTWORK IN EDIT</small></button>`).join("");
    activeCharacterId = featured.id;
    $("#workspaceView").innerHTML = `<section class="character-sheet" data-character-id="${escapeHTML(featured.id)}"><aside class="sheet-portrait" data-art="primary" tabindex="0" role="button" aria-label="Open primary portrait for ${escapeHTML(featured.name)}">${image(featured)}<div class="portrait-frame"></div><div class="portrait-index">PRIMARY <span>// PORTRAIT</span></div><div class="portrait-caption"><span>ACTIVE CHARACTER</span><strong>${escapeHTML(featured.meta || "LEVEL —")}</strong></div></aside><div class="sheet-content"><nav class="character-switcher" aria-label="Character roster"><span>ROSTER</span>${universe.characters.map((item) => `<button class="${item.id === featured.id ? "active" : ""}" data-detail="character:${item.id}" aria-pressed="${item.id === featured.id}">${image(item)}<span>${escapeHTML(item.name)}</span></button>`).join("")}<button class="add-character" data-create="character" aria-label="Create character">＋</button></nav><header class="sheet-heading"><div><span class="edition">CHARACTER SHEET // ${escapeHTML(featured.meta || "UNRANKED")}</span><h1>${escapeHTML(featured.name)}</h1><p>${escapeHTML(featured.subtitle || "UNWRITTEN LEGEND")}</p></div><button class="ghost-button" data-edit="character:${featured.id}">EDIT CHARACTER</button></header><div class="character-facts"><div><span>ORIGIN</span><strong>${escapeHTML(featured.origin || "Unknown origin")}</strong></div><div><span>CLASSIFICATION</span><strong>${escapeHTML(featured.subtitle || "Unclassified")}</strong></div><div><span>ARCHIVE ID</span><strong>${escapeHTML(featured.id)}</strong></div></div><section class="character-lore"><span>ARCHIVE LORE</span><p>${escapeHTML(featured.description || "No lore has been recorded for this character yet. Edit the sheet to begin their story.")}</p></section><div class="panel-label"><div><span>VISUAL ARCHIVE</span><strong>CHARACTER PANELS</strong></div><p>SELECT ART TO EXPAND · ${panels.length} / 08 ASSIGNED</p></div><div class="character-panel-grid">${panelSlots}</div></div></section>`;
  };
  const profileView = (type, id) => {
    const plural = `${type}s`, item = universe[plural].find((entry) => entry.id === id);
    if (!item) return navigate(plural);
    activeCharacterId = item.id;
    currentDetail = null;
    collectionView("character");
  };
  const navigate = (page, detailId = null) => {
    currentPage = page; currentDetail = detailId;
    const type = "character";
    $("#characterCount").textContent = `${universe.characters.length} CHARACTER${universe.characters.length === 1 ? "" : "S"}`;
    detailId ? profileView(type, detailId) : collectionView(type);
    $(".workspace-main").scrollTo({ top: 0, behavior: "smooth" });
  };
  const openEntityModal = (type, id = "") => {
    const form = $("#entityForm"), item = id ? universe[`${type}s`].find((entry) => entry.id === id) : null;
    form.reset(); form.elements.type.value = type; form.elements.id.value = id;
    $("#entityModalTitle").textContent = `${id ? "Edit" : "Create"} ${type}`; $("#entityModalLabel").textContent = `${type.toUpperCase()} ARCHIVE`;
    if (item) {
      ["name", "subtitle", "meta", "origin", "image", "description"].forEach((key) => { form.elements[key].value = item[key] || ""; });
      form.elements.gallery.value = (item.gallery || []).join("\n");
    }
    $("#entityModal").hidden = false; setTimeout(() => form.elements.name.focus(), 50);
  };
  const enterWorkspace = () => {
    universe = { characters: [], locations: [], ...sessionBridge.archive, version: 3 };
    universe.characters ||= []; universe.locations ||= [];
    universe.characters = universe.characters.map((character) => ({ ...character, origin: String(character.origin || "Unknown origin").trim() }));
    activeCharacterId = universe.characters[0]?.id || null;
    workspaceShell(); $("#workspace").hidden = false; $("#success").hidden = true; navigate("characters");
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
    const page = event.target.closest("[data-page]"), create = event.target.closest("[data-create]"), detail = event.target.closest("[data-detail]"), edit = event.target.closest("[data-edit]"), art = event.target.closest("[data-art]"), remove = event.target.closest("[data-delete]"), action = event.target.closest("[data-action]");
    if (page && universe) navigate(page.dataset.page);
    if (create && universe) openEntityModal(create.dataset.create);
    if (detail && universe) { const [type, id] = detail.dataset.detail.split(":"); navigate(`${type}s`, id); }
    if (edit && universe) { const [type, id] = edit.dataset.edit.split(":"); openEntityModal(type, id); }
    if (art && universe) openArtwork(art.dataset.art);
    if (action?.dataset.action === "close-modal") $("#entityModal").hidden = true;
    if (action?.dataset.action === "close-lightbox") $("#artLightbox").hidden = true;
    if (action?.dataset.action === "previous-art") stepArtwork(-1);
    if (action?.dataset.action === "next-art") stepArtwork(1);
    if (remove && universe) { const [type, id] = remove.dataset.delete.split(":"); if (confirm("Archive this entry? This will save the removal to your bridge.")) { universe[`${type}s`] = universe[`${type}s`].filter((entry) => entry.id !== id); if (type === "location") universe.characters.forEach((character) => { character.relations = (character.relations || []).filter((relation) => relation !== id); }); navigate(`${type}s`); persist("ENTRY ARCHIVED · BRIDGE UPDATED"); } }
  });
  $("#entityModal").addEventListener("click", (event) => { if (event.target === $("#entityModal")) $("#entityModal").hidden = true; });
  $("#entityForm").addEventListener("submit", (event) => {
    event.preventDefault(); const data = new FormData(event.target), type = data.get("type"), id = data.get("id") || `${type[0]}${Date.now()}`, list = universe[`${type}s`], existing = list.find((entry) => entry.id === id);
    const item = { ...existing, id, name: data.get("name").trim(), subtitle: data.get("subtitle").trim(), meta: data.get("meta").trim(), origin: data.get("origin").trim(), image: data.get("image").trim(), gallery: data.get("gallery").split(/\r?\n/).map((url) => url.trim()).filter(Boolean).slice(0, 8), description: data.get("description").trim() };
    existing ? Object.assign(existing, item) : list.unshift(item);
    $("#entityModal").hidden = true; navigate(`${type}s`, id); persist(existing ? "PROFILE UPDATED · BRIDGE SAVED" : "NEW ENTRY CREATED · BRIDGE SAVED");
  });
  const artworkUrls = () => { const character = universe?.characters.find((item) => item.id === activeCharacterId); return character ? [character.image || fallbackImage, ...(character.gallery || [])] : []; };
  const showArtwork = () => { const urls = artworkUrls(), character = universe.characters.find((item) => item.id === activeCharacterId); if (!urls.length) return; lightboxIndex = (lightboxIndex + urls.length) % urls.length; $("#lightboxImage").src = urls[lightboxIndex]; $("#lightboxImage").alt = `${character.name} artwork ${lightboxIndex + 1}`; $("#lightboxIndex").textContent = `${String(lightboxIndex + 1).padStart(2, "0")} / ${String(urls.length).padStart(2, "0")}`; $("#lightboxCaption").textContent = `${character.name} · ${lightboxIndex ? "CHARACTER PANEL" : "PRIMARY PORTRAIT"}`; };
  const openArtwork = (index) => { lightboxIndex = index === "primary" ? 0 : Number(index) + 1; showArtwork(); $("#artLightbox").hidden = false; };
  const stepArtwork = (direction) => { if ($("#artLightbox").hidden) return; lightboxIndex += direction; showArtwork(); };
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { $("#entityModal").hidden = true; $("#artLightbox").hidden = true; } if (!$("#artLightbox").hidden && event.key === "ArrowLeft") stepArtwork(-1); if (!$("#artLightbox").hidden && event.key === "ArrowRight") stepArtwork(1); if ((event.key === "Enter" || event.key === " ") && event.target.matches(".sheet-portrait")) openArtwork("primary"); });
  restoreCredentials();
}
