// Date di Mario, lette dal Google Sheet (Apps Script web app, vedi docs/apps-script/eventi.gs).
// Se EVENTS_URL non è impostato si usa data/eventi.csv (stesse colonne dello Sheet).
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CSV_FILE = path.join(ROOT, "data/eventi.csv");
const CACHE_FILE = path.join(import.meta.dirname, "events.cache.json");
const URL = process.env.EVENTS_URL;

const LANG_CODES = { italiano: "it", inglese: "en", francese: "fr", tedesco: "de" };
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows.filter((r) => r.some((f) => f.trim()));
  const keys = header.map((h) => h.trim().toLowerCase());
  return data.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] || "").trim()])));
}

// Accetta "2026-10-16", "16/10/2026", "16.10.2026".
function toIso(value) {
  const s = String(value || "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

function slugify(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function formatRange(start, end) {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  if (start === end) return `${ds} ${MONTHS[ms - 1]} ${ys}`;
  if (ys === ye && ms === me) return `${ds}–${de} ${MONTHS[ms - 1]} ${ys}`;
  if (ys === ye) return `${ds} ${MONTHS[ms - 1]} – ${de} ${MONTHS[me - 1]} ${ys}`;
  return `${ds} ${MONTHS[ms - 1]} ${ys} – ${de} ${MONTHS[me - 1]} ${ye}`;
}

// Per la grafica "agenda": giorni in grande, mese/anno in piccolo.
function ledger(start, end) {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const short = (m) => MONTHS[m - 1].slice(0, 3);
  const days = start === end ? `${ds}` : `${ds}–${de}`;
  const month = ms === me ? `${MONTHS[ms - 1]} ${ys}` : `${short(ms)} – ${short(me)} ${ye}`;
  return { days, month };
}

function normalize(rows) {
  const used = new Set();
  const events = [];
  for (const r of rows) {
    const start = toIso(r["data inizio"]);
    const published = !/^(no|n|false|0)$/i.test(r["pubblica"] || "sì");
    if (!start || !r["titolo"] || !published) continue;
    const end = toIso(r["data fine"]) || start;
    const [year, month] = start.split("-");
    const city = r["città"] || r["citta"] || "";
    let slug = slugify(r["slug"] || `${city || r["titolo"]}-${MONTHS[+month - 1]}`);
    while (used.has(`${year}/${slug}`)) slug += "-2";
    used.add(`${year}/${slug}`);
    events.push({
      start,
      end,
      year,
      slug,
      url: `/calendario/${year}/${slug}/`,
      dateLabel: formatRange(start, end),
      ledger: ledger(start, end),
      time: r["orario"] || "",
      title: r["titolo"],
      type: r["tipo"] || "Seminario",
      city,
      venue: r["sede"] || "",
      with: r["con"] || "",
      description: r["descrizione"] || "",
      deadline: toIso(r["iscrizioni entro"]),
      earlyDeadline: toIso(r["iscrizione anticipata entro"]),
      link: r["link"] || "",
      language: r["lingua"] || "Italiano",
      languageCode: LANG_CODES[(r["lingua"] || "italiano").toLowerCase()] || "it",
      seoTitle: `${r["titolo"]}${city && !r["titolo"].includes(city.split(" (")[0]) ? `, ${city}` : ""} – ${formatRange(start, end)}`,
    });
  }
  return events;
}

async function fetchSheet() {
  let lastError;
  for (const timeout of [30000, 60000, 90000]) {
    try {
      // Apps Script risponde con un redirect verso googleusercontent: fetch lo segue.
      const res = await fetch(URL, { signal: AbortSignal.timeout(timeout) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error("risposta non valida");
      fs.writeFileSync(CACHE_FILE, JSON.stringify(rows));
      return rows;
    } catch (err) {
      lastError = err;
      console.warn(`[events] tentativo fallito (${timeout / 1000}s): ${err.message}`);
    }
  }
  if (fs.existsSync(CACHE_FILE) && process.env.ALLOW_STALE_DATA === "1") {
    console.warn("[events] uso la cache precedente");
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  }
  throw new Error(`[events] impossibile leggere il Google Sheet: ${lastError.message}`);
}

export default async function () {
  const rows = URL ? await fetchSheet() : parseCsv(fs.readFileSync(CSV_FILE, "utf8"));
  const all = normalize(rows).sort((a, b) => a.start.localeCompare(b.start));
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  const upcoming = all.filter((e) => e.end >= today);
  const past = all.filter((e) => e.end < today).reverse();
  const pastByYear = [];
  for (const e of past) {
    const group = pastByYear.find((g) => g.year === e.year);
    group ? group.events.push(e) : pastByYear.push({ year: e.year, events: [e] });
  }
  console.log(`[events] ${all.length} eventi (${upcoming.length} futuri) da ${URL ? "Google Sheet" : "data/eventi.csv"}`);
  return { all, upcoming, past, pastByYear };
}
