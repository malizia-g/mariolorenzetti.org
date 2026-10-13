// Utility condivise dalle Cloudflare Pages Functions (cartella functions/).
// Solo API web standard (fetch, crypto.subtle, btoa): niente Node.

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

export class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// --- Base64 per byte e testo UTF-8 ---
export function bytesToB64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function b64ToBytes(b64) {
  const s = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}
export const textToB64 = (text) => bytesToB64(new TextEncoder().encode(text));
export const b64ToText = (b64) => new TextDecoder().decode(b64ToBytes(b64));
const b64url = (bytes) => bytesToB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => b64ToBytes(s.replace(/-/g, "+").replace(/_/g, "/"));

// --- Sessione: cookie firmato con HMAC-SHA256 (nessun database) ---
const COOKIE = "ml_admin";
const SESSION_HOURS = 8;

async function hmacKey(secret) {
  if (!secret || secret.length < 32) throw new HttpError("Editor non configurato: SESSION_SECRET mancante o troppo corto", 500);
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSession(email, secret) {
  const payload = { email, csrf: b64url(crypto.getRandomValues(new Uint8Array(16))), exp: Date.now() + SESSION_HOURS * 3600e3 };
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(body)));
  const cookie = `${COOKIE}=${body}.${b64url(sig)}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
  return { payload, cookie };
}

export async function readSession(request, secret) {
  const raw = (request.headers.get("Cookie") || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!raw) return null;
  const [body, sig] = raw.slice(COOKIE.length + 1).split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64url(sig), new TextEncoder().encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    return payload.exp > Date.now() ? payload : null;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    return null;
  }
}

export const clearSessionCookie = `${COOKIE}=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

// --- "Accedi con Google": verifica dell'ID token tramite l'endpoint tokeninfo ---
export async function verifyGoogleToken(credential, clientId) {
  if (!credential) throw new HttpError("Credenziale mancante", 400);
  const res = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential));
  const claims = await res.json().catch(() => null);
  if (!res.ok || !claims) throw new HttpError("Accesso Google non valido", 401);
  if (claims.aud !== clientId) throw new HttpError("Token Google per un'altra applicazione", 401);
  if (!["accounts.google.com", "https://accounts.google.com"].includes(claims.iss)) throw new HttpError("Emittente non valido", 401);
  if (Number(claims.exp) * 1000 < Date.now()) throw new HttpError("Accesso scaduto, riprova", 401);
  if (claims.email_verified !== "true" && claims.email_verified !== true) throw new HttpError("Email Google non verificata", 401);
  return String(claims.email);
}

// --- GitHub: lettura e scrittura dei contenuti del repo ---
export class GitHub {
  constructor(token, repo, branch = "main") {
    if (!token || !repo) throw new HttpError("Editor non configurato: GITHUB_TOKEN o GITHUB_REPO mancanti", 500);
    this.token = token;
    this.repo = repo;
    this.branch = branch;
  }

  async call(method, path, payload) {
    const res = await fetch(`https://api.github.com/repos/${this.repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "mariolorenzetti-editor",
        ...(payload ? { "Content-Type": "application/json" } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (res.status === 409 || (res.status === 422 && text.includes("sha"))) {
      throw new HttpError("Il file è stato modificato nel frattempo: ricarica la pagina e riapplica le modifiche.", 409);
    }
    if (!res.ok) throw new HttpError("GitHub: " + (data.message || `errore ${res.status}`), 502);
    return data;
  }

  listDir(dir) {
    return this.call("GET", `/contents/${dir}?ref=${this.branch}`);
  }

  async getFile(path) {
    const f = await this.call("GET", `/contents/${path}?ref=${this.branch}`);
    return { path, sha: f.sha, content: b64ToText(f.content) };
  }

  async putFile(path, contentB64, message, sha) {
    const payload = { message, content: contentB64, branch: this.branch };
    if (sha) payload.sha = sha;
    const res = await this.call("PUT", `/contents/${path}`, payload);
    return { path, sha: res.content?.sha ?? null };
  }
}
