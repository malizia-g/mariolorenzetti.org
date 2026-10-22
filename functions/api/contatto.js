// Modulo contatti (/api/contatto): controlla i dati e li passa all'Apps Script del Google Sheet
// (doPost in docs/apps-script/eventi.gs), che invia l'email a Mario e salva il messaggio nel foglio "Contatti".
// Se il visitatore chiede la newsletter, lo script gli invia anche il link di conferma (vedi newsletter.js).
//
// Variabili: EVENTS_URL (URL /exec dell'Apps Script, lo stesso delle date),
//            CONTACT_TOKEN (uguale alla proprietà CONTACT_TOKEN dello script),
//            CONTACT_TO (facoltativa, indirizzo mostrato nei messaggi di errore; default info@mariolorenzetti.org).
import { json, signNewsletter } from "../../lib/cf.js";

const MESSAGES = {
  it: {
    ok: "Grazie! Il messaggio è stato inviato, ti risponderò al più presto.",
    invalid: "Compila nome, email valida, messaggio e accetta l'informativa privacy.",
    error: "Errore di invio. Scrivi direttamente a ",
  },
  fr: {
    ok: "Merci ! Votre message a été envoyé, je vous répondrai bientôt.",
    invalid: "Veuillez remplir le nom, un email valide, le message et accepter la politique de confidentialité.",
    error: "Erreur d'envoi. Écrivez directement à ",
  },
};

const clean = (v, max) => String(v ?? "").replace(/[\r\0]/g, "").slice(0, max).trim();

export async function onRequestPost({ request, env }) {
  const to = env.CONTACT_TO || "info@mariolorenzetti.org";
  const form = await request.formData().catch(() => null);
  if (!form) return json({ ok: false, message: "Richiesta non valida" }, 400);

  const t = MESSAGES[form.get("lang") === "fr" ? "fr" : "it"];

  // Honeypot compilato o invio in meno di 3 secondi: bot. Risponde "ok" senza inviare.
  const elapsed = Date.now() - Number(form.get("t") || 0);
  if (form.get("website") || elapsed < 3000) return json({ ok: true, message: t.ok });

  const nome = clean(form.get("nome"), 120).replace(/\n/g, " ");
  const email = clean(form.get("email"), 200);
  const oggetto = clean(form.get("oggetto"), 200).replace(/\n/g, " ");
  const messaggio = clean(form.get("messaggio"), 5000);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!nome || !messaggio || !form.get("privacy") || !validEmail) return json({ ok: false, message: t.invalid }, 422);

  if (!env.EVENTS_URL || !env.CONTACT_TOKEN) return json({ ok: false, message: t.error + to }, 500);
  const lang = form.get("lang") === "fr" ? "fr" : "it";
  const newsletter = Boolean(form.get("newsletter"));
  let confirmUrl;
  if (newsletter) {
    const url = new URL(lang === "fr" ? "/fr/contacts/" : "/contatti/", request.url);
    url.search = new URLSearchParams({ e: email, n: nome, s: await signNewsletter({ email, nome, lang }, env.CONTACT_TOKEN) });
    confirmUrl = url.href;
  }
  let result;
  try {
    const res = await fetch(env.EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: env.CONTACT_TOKEN, nome, email, oggetto, messaggio, lingua: lang.toUpperCase(), newsletter, confirmUrl }),
    });
    result = await res.json();
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  if (!result?.ok) {
    console.error("[contatto] Apps Script", result?.error);
    return json({ ok: false, message: t.error + to }, 502);
  }
  return json({ ok: true, message: t.ok });
}

export const onRequest = () => json({ ok: false, message: "Method not allowed" }, 405);
