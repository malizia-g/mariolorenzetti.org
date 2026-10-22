// Conferma dell'iscrizione alla newsletter (doppio opt-in). Il link nell'email di conferma porta alla
// pagina Contatti con email, nome e firma; il pulsante "Conferma" li manda qui. Se la firma è valida,
// l'Apps Script (doPost, action "subscribe") iscrive l'indirizzo su Sender.net.
//
// Variabili: EVENTS_URL, CONTACT_TOKEN (le stesse del modulo contatti).
import { json, verifyNewsletter } from "../../lib/cf.js";

const MESSAGES = {
  it: {
    ok: "Iscrizione confermata, grazie! Riceverai le nuove date dei seminari.",
    invalid: "Link di conferma non valido. Riprova dal modulo contatti.",
    error: "Errore durante l'iscrizione. Riprova più tardi.",
  },
  fr: {
    ok: "Inscription confirmée, merci ! Vous recevrez les nouvelles dates des stages.",
    invalid: "Lien de confirmation non valide. Réessayez depuis le formulaire de contact.",
    error: "Erreur lors de l'inscription. Réessayez plus tard.",
  },
};

export async function onRequestPost({ request, env }) {
  const form = await request.formData().catch(() => null);
  if (!form) return json({ ok: false, message: "Richiesta non valida" }, 400);
  const lang = form.get("lang") === "fr" ? "fr" : "it";
  const t = MESSAGES[lang];
  const email = String(form.get("e") || "");
  const nome = String(form.get("n") || "");
  if (!env.EVENTS_URL || !env.CONTACT_TOKEN) return json({ ok: false, message: t.error }, 500);
  if (!(await verifyNewsletter({ email, nome, lang }, String(form.get("s") || ""), env.CONTACT_TOKEN))) {
    return json({ ok: false, message: t.invalid }, 422);
  }

  let result;
  try {
    const res = await fetch(env.EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: env.CONTACT_TOKEN, action: "subscribe", email, nome, lingua: lang.toUpperCase() }),
    });
    result = await res.json();
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  if (!result?.ok) {
    console.error("[newsletter] Apps Script", result?.error);
    return json({ ok: false, message: t.error }, 502);
  }
  return json({ ok: true, message: t.ok });
}

export const onRequest = () => json({ ok: false, message: "Method not allowed" }, 405);
