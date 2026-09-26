// Editor dei contenuti Markdown di mariolorenzetti.org.
// Tutte le chiamate passano da api.php, che parla con GitHub.
(() => {
  const $ = (id) => document.getElementById(id);
  const SITE = "https://mariolorenzetti.org";
  // Campi del frontmatter modificabili dal modulo; gli altri restano intatti.
  const FIELDS = ["title", "seoTitle", "description", "image", "date"];
  let csrf = "";
  let current = null; // { path, sha, fm: { lines, values }, isNew }
  let dirty = false;
  let mde;

  async function api(action, { method = "GET", body, query = "" } = {}) {
    const res = await fetch(`api.php?action=${action}${query}`, {
      method,
      headers: { "Content-Type": "application/json", "X-CSRF": csrf },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({ error: `Errore ${res.status}` }));
    if (res.status === 401 && action !== "login") showLogin();
    if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
    return data;
  }

  function toast(text, isError = false) {
    const el = document.createElement("div");
    el.className = "toast" + (isError ? " err" : "");
    el.textContent = text;
    document.body.append(el);
    setTimeout(() => el.remove(), isError ? 7000 : 3500);
  }

  // --- Frontmatter: parsing minimo di righe "chiave: valore" di primo livello ---
  function parseDoc(text) {
    const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) return { lines: [], values: {}, body: text };
    const lines = m[1].split("\n");
    const values = {};
    for (const line of lines) {
      const kv = line.match(/^([A-Za-z]+):\s*(.*)$/);
      if (!kv) continue;
      let v = kv[2].trim();
      if (v.startsWith('"')) { try { v = JSON.parse(v); } catch {} }
      values[kv[1]] = v;
    }
    return { lines, values, body: m[2].replace(/^\n/, "") };
  }

  function buildDoc(fm, values, body) {
    const lines = [...fm.lines];
    const added = [];
    for (const key of FIELDS) {
      if (!(key in values)) continue;
      const v = values[key];
      const idx = lines.findIndex((l) => l.startsWith(key + ":"));
      if (v === "" || v == null) {
        if (idx >= 0 && key !== "title") lines.splice(idx, 1);
        continue;
      }
      const line = `${key}: ${key === "date" ? v : JSON.stringify(v)}`;
      idx >= 0 ? (lines[idx] = line) : added.push(line);
    }
    return `---\n${[...added, ...lines].join("\n")}\n---\n\n${body.trim()}\n`;
  }

  // --- Login ---
  function showLogin() {
    $("app").hidden = true;
    $("login").hidden = false;
    api("config").then(({ clientId }) => {
      const init = () => {
        google.accounts.id.initialize({ client_id: clientId, callback: onGoogle, ux_mode: "popup" });
        google.accounts.id.renderButton($("gbtn"), { theme: "outline", size: "large", text: "signin_with", locale: "it" });
      };
      window.google?.accounts ? init() : window.addEventListener("load", init);
    });
  }

  async function onGoogle({ credential }) {
    try {
      const me = await api("login", { method: "POST", body: { credential } });
      csrf = me.csrf;
      start();
    } catch (e) {
      $("loginErr").textContent = e.message;
      $("loginErr").hidden = false;
    }
  }

  async function start() {
    const me = await api("me");
    if (!me.email) return showLogin();
    csrf = me.csrf;
    $("login").hidden = true;
    $("app").hidden = false;
    $("sheetLink").href = me.sheetUrl || "#";
    $("viewSite").href = me.siteUrl || "/";
    await loadList();
    pollStatus();
  }

  // --- Elenco file ---
  async function loadList() {
    const { files } = await api("list");
    const groups = {};
    for (const f of files) (groups[f.section] ||= []).push(f);
    const nav = $("files");
    nav.innerHTML = "";
    for (const [section, list] of Object.entries(groups)) {
      const h = document.createElement("h2");
      h.textContent = section;
      const ul = document.createElement("ul");
      for (const f of list.sort((a, b) => a.name.localeCompare(b.name))) {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = f.name.replace(/\.md$/, "").replace(/-/g, " ");
        b.dataset.path = f.path;
        b.onclick = () => openFile(f.path);
        li.append(b);
        ul.append(li);
      }
      nav.append(h, ul);
    }
  }

  function confirmLeave() {
    return !dirty || confirm("Ci sono modifiche non salvate. Vuoi abbandonarle?");
  }

  async function openFile(path) {
    if (!confirmLeave()) return;
    try {
      const file = await api("get", { query: "&path=" + encodeURIComponent(path) });
      const doc = parseDoc(file.content);
      current = { path, sha: file.sha, fm: doc, isNew: false };
      fillForm(doc.values, doc.body);
    } catch (e) {
      toast(e.message, true);
    }
  }

  function newPost() {
    if (!confirmLeave()) return;
    const title = prompt("Titolo del nuovo scritto:");
    if (!title) return;
    const slug = title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    const today = new Date().toISOString().slice(0, 10);
    const fm = { lines: [`permalink: /${slug}/`], values: { permalink: `/${slug}/` } };
    current = { path: `src/articoli/${slug}.md`, sha: null, fm, isNew: true };
    fillForm({ title, date: today, description: "" }, "Scrivi qui il testo…");
    dirty = true;
  }

  function fillForm(v, body) {
    $("empty").hidden = true;
    $("editor").hidden = false;
    for (const k of ["title", "seoTitle", "description", "image"]) $("f-" + k).value = v[k] || "";
    const isPost = current.path.startsWith("src/articoli/");
    $("dateField").hidden = !isPost;
    $("f-date").value = isPost ? String(v.date || "").slice(0, 10) : "";
    $("path").textContent = current.path;
    const permalink = (current.fm.values.permalink || current.fm.lines.find((l) => l.startsWith("permalink:"))?.split(":")[1] || "").trim();
    $("viewPage").href = SITE + (permalink || "/");
    $("viewPage").hidden = current.isNew;
    mde.value(body);
    document.querySelectorAll("#files button").forEach((b) => b.classList.toggle("active", b.dataset.path === current.path));
    updateCounters();
    dirty = false;
  }

  function updateCounters() {
    const seo = $("f-seoTitle").value || $("f-title").value + " | Mario Lorenzetti";
    const desc = $("f-description").value;
    $("c-seoTitle").textContent = `${seo.length}/60`;
    $("c-seoTitle").classList.toggle("too-long", seo.length > 60);
    $("c-description").textContent = `${desc.length}/160`;
    $("c-description").classList.toggle("too-long", desc.length > 160 || (desc.length > 0 && desc.length < 70));
    $("p-t").textContent = seo;
    $("p-u").textContent = $("viewPage").href || SITE;
    $("p-d").textContent = desc.length > 160 ? desc.slice(0, 157) + "…" : desc;
  }

  async function save(e) {
    e.preventDefault();
    if (!current) return;
    const values = {};
    for (const k of ["title", "seoTitle", "description", "image"]) values[k] = $("f-" + k).value.trim();
    if (!$("dateField").hidden) values.date = $("f-date").value;
    const content = buildDoc(current.fm, values, mde.value());
    $("save").disabled = true;
    try {
      const res = await api("save", { method: "POST", body: { path: current.path, sha: current.sha, content } });
      current.sha = res.sha;
      current.fm = parseDoc(content);
      if (current.isNew) {
        current.isNew = false;
        await loadList();
      }
      dirty = false;
      toast("Salvato. Il sito si aggiorna in 2-3 minuti.");
      pollStatus(true);
    } catch (err) {
      toast(err.message, true);
    } finally {
      $("save").disabled = false;
    }
  }

  // --- Immagini: ridimensionate nel browser (max 2000 px) prima del caricamento ---
  async function prepareImage(file) {
    const bitmap = await createImageBitmap(file);
    const max = 2000;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return { blob: file, name: file.name };
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return { blob, name: file.name.replace(/\.\w+$/, ".jpg") };
  }

  async function uploadImage(file) {
    const { blob, name } = await prepareImage(file);
    const data = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.readAsDataURL(blob);
    });
    toast("Caricamento immagine…");
    const res = await api("upload", { method: "POST", body: { name, data } });
    return res.url;
  }

  function pickImage() {
    return new Promise((resolve) => {
      const input = $("fileInput");
      input.value = "";
      input.onchange = () => resolve(input.files[0]);
      input.click();
    });
  }

  // --- Stato della pubblicazione (ultima esecuzione GitHub Actions) ---
  let pollTimer;
  async function pollStatus(soon = false) {
    clearTimeout(pollTimer);
    if (soon) {
      $("status").className = "run";
      $("status").textContent = "● Pubblicazione in corso…";
      pollTimer = setTimeout(pollStatus, 15000);
      return;
    }
    try {
      const s = await api("status");
      const el = $("status");
      if (s.status === "none") { el.textContent = ""; return; }
      if (s.status !== "completed") {
        el.className = "run";
        el.textContent = "● Pubblicazione in corso…";
        pollTimer = setTimeout(pollStatus, 15000);
      } else if (s.conclusion === "success") {
        el.className = "ok";
        el.textContent = "● Sito aggiornato " + new Date(s.updated).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
      } else {
        el.className = "ko";
        el.textContent = "● Ultima pubblicazione non riuscita";
      }
    } catch {}
  }

  // --- Avvio ---
  mde = new EasyMDE({
    element: $("body"),
    autoDownloadFontAwesome: false,
    spellChecker: false,
    status: ["words"],
    uploadImage: true,
    imageUploadFunction: (file, onSuccess, onError) => uploadImage(file).then(onSuccess).catch((e) => onError(e.message)),
    imageAccept: "image/jpeg, image/png, image/webp",
    toolbar: ["bold", "italic", "heading-2", "heading-3", "|", "quote", "unordered-list", "ordered-list", "|", "link", "upload-image", "|", "preview", "side-by-side", "fullscreen", "|", "guide"],
    previewImagesInEditor: false,
    placeholder: "Testo della pagina…",
  });
  mde.codemirror.on("change", () => (dirty = true));
  ["f-title", "f-seoTitle", "f-description", "f-image", "f-date"].forEach((id) => $(id).addEventListener("input", () => { dirty = true; updateCounters(); }));
  $("editor").addEventListener("submit", save);
  $("newPost").onclick = newPost;
  $("imgPick").onclick = async () => {
    const file = await pickImage();
    if (!file) return;
    try { $("f-image").value = await uploadImage(file); dirty = true; toast("Immagine caricata."); }
    catch (e) { toast(e.message, true); }
  };
  $("publish").onclick = async () => {
    try { await api("publish", { method: "POST" }); toast("Aggiornamento avviato: 2-3 minuti."); pollStatus(true); }
    catch (e) { toast(e.message, true); }
  };
  $("logout").onclick = async () => { await api("logout", { method: "POST" }).catch(() => {}); location.reload(); };
  window.addEventListener("beforeunload", (e) => { if (dirty) e.preventDefault(); });

  start().catch(() => showLogin());
})();
