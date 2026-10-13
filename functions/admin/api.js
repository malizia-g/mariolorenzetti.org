// Backend dell'editor (/admin/api): login Google + lettura/scrittura dei contenuti su GitHub.
// Il token GitHub resta nelle variabili d'ambiente di Cloudflare, il browser non lo vede mai.
//
// Variabili (Cloudflare Pages > Settings > Variables and Secrets):
//   GOOGLE_CLIENT_ID, ALLOWED_EMAILS (separate da virgola), SESSION_SECRET (almeno 32 caratteri),
//   GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH (facoltativa, default main),
//   DEPLOY_HOOK_URL (pulsante "Aggiorna il sito"), SHEET_URL, SITE_URL,
//   CF_API_TOKEN + CF_ACCOUNT_ID + CF_PROJECT (facoltative: stato della pubblicazione).
import { json, HttpError, createSession, readSession, clearSessionCookie, verifyGoogleToken, GitHub, bytesToB64, b64ToBytes, textToB64 } from "../../lib/cf.js";

// Cartelle modificabili dall'editor (etichetta mostrata a Mario).
const CONTENT_DIRS = {
  "src/pagine": "Pagine",
  "src/articoli": "Scritti",
  "src/fr": "Pagine in francese",
};

// Solo file .md dentro le cartelle ammesse: niente "../" né altri percorsi del repo.
function contentPath(path) {
  for (const dir of Object.keys(CONTENT_DIRS)) {
    if (new RegExp(`^${dir}/[a-z0-9][a-z0-9-]*\\.md$`).test(path || "")) return path;
  }
  throw new HttpError("Percorso non consentito", 400);
}

// Riconosce il formato dai primi byte, non dal nome del file.
function imageType(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "webp";
  return null;
}

async function deployStatus(env) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID || !env.CF_PROJECT) return { status: "none" };
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/pages/projects/${env.CF_PROJECT}/deployments?per_page=1&env=production`, {
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
  });
  const d = (await res.json().catch(() => ({}))).result?.[0];
  if (!d) return { status: "none" };
  const stage = d.latest_stage || {};
  const done = stage.name === "deploy" && stage.status === "success";
  const failed = stage.status === "failure";
  return {
    status: done || failed ? "completed" : "in_progress",
    conclusion: done ? "success" : failed ? "failure" : null,
    updated: stage.ended_on || d.created_on,
  };
}

async function handle(request, env) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "";
  const input = request.method === "POST" ? await request.json().catch(() => ({})) : {};

  if (action === "config") return json({ clientId: env.GOOGLE_CLIENT_ID || "" });

  if (action === "login") {
    const email = await verifyGoogleToken(input.credential, env.GOOGLE_CLIENT_ID);
    const allowed = (env.ALLOWED_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!allowed.includes(email.toLowerCase())) throw new HttpError(`L'account ${email} non è autorizzato.`, 403);
    const { payload, cookie } = await createSession(email, env.SESSION_SECRET);
    return json({ email, csrf: payload.csrf }, 200, { "Set-Cookie": cookie });
  }

  const session = await readSession(request, env.SESSION_SECRET);

  if (action === "me") {
    return json(session
      ? { email: session.email, csrf: session.csrf, sheetUrl: env.SHEET_URL || "", siteUrl: env.SITE_URL || "/" }
      : { email: null });
  }

  // Da qui in poi: utente autenticato + token CSRF sulle richieste POST.
  if (!session) throw new HttpError("Sessione scaduta, accedi di nuovo.", 401);
  if (request.method === "POST" && request.headers.get("X-CSRF") !== session.csrf) {
    throw new HttpError("Token non valido, ricarica la pagina.", 403);
  }
  const author = session.email;

  switch (action) {
    case "logout":
      return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie });

    case "list": {
      const gh = new GitHub(env.GITHUB_TOKEN, env.GITHUB_REPO, env.GITHUB_BRANCH);
      const files = [];
      for (const [dir, section] of Object.entries(CONTENT_DIRS)) {
        for (const item of await gh.listDir(dir)) {
          if (item.type === "file" && item.name.endsWith(".md")) files.push({ path: item.path, name: item.name, section });
        }
      }
      return json({ files });
    }

    case "get": {
      const gh = new GitHub(env.GITHUB_TOKEN, env.GITHUB_REPO, env.GITHUB_BRANCH);
      return json(await gh.getFile(contentPath(url.searchParams.get("path"))));
    }

    case "save": {
      const path = contentPath(input.path);
      const content = String(input.content || "");
      if (content.length > 500_000) throw new HttpError("Contenuto troppo grande.", 413);
      const gh = new GitHub(env.GITHUB_TOKEN, env.GITHUB_REPO, env.GITHUB_BRANCH);
      const msg = `${input.sha ? "Modifica" : "Nuovo"} ${path.split("/").pop()} (editor, ${author})`;
      return json(await gh.putFile(path, textToB64(content), msg, input.sha || null));
    }

    case "upload": {
      let bytes;
      try { bytes = b64ToBytes(String(input.data || "")); } catch { throw new HttpError("Immagine non valida.", 400); }
      if (!bytes.length || bytes.length > 8_000_000) throw new HttpError("Immagine non valida o oltre 8 MB.", 413);
      const ext = imageType(bytes);
      if (!ext) throw new HttpError("Formati ammessi: JPG, PNG, WebP.", 415);
      const slug = String(input.name || "").toLowerCase().replace(/\.[^.]*$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "immagine";
      const now = new Date();
      const rand = bytesToB64(crypto.getRandomValues(new Uint8Array(4))).replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase();
      const path = `src/assets/uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${slug}-${rand}.${ext}`;
      const gh = new GitHub(env.GITHUB_TOKEN, env.GITHUB_REPO, env.GITHUB_BRANCH);
      await gh.putFile(path, bytesToB64(bytes), `Immagine ${path.split("/").pop()} (editor, ${author})`, null);
      return json({ url: "/" + path.slice("src/".length) });
    }

    case "publish": {
      if (!env.DEPLOY_HOOK_URL) throw new HttpError("DEPLOY_HOOK_URL non configurato.", 500);
      const res = await fetch(env.DEPLOY_HOOK_URL, { method: "POST" });
      if (!res.ok) throw new HttpError(`Cloudflare ha risposto ${res.status}`, 502);
      return json({ ok: true });
    }

    case "status":
      return json(await deployStatus(env));

    default:
      throw new HttpError("Azione sconosciuta", 400);
  }
}

export async function onRequest({ request, env }) {
  try {
    return await handle(request, env);
  } catch (err) {
    if (!(err instanceof HttpError)) console.error("[admin]", err);
    return json({ error: err.message || "Errore interno" }, err.status || 500);
  }
}
