// Modulo contatti (/api/contatto): invia l'email a Mario tramite Resend. Nessun database.
//
// Variabili: RESEND_API_KEY, CONTACT_TO (default info@mariolorenzetti.org),
//            CONTACT_FROM (default noreply@mariolorenzetti.org, dominio verificato su Resend).
import { json } from "../../lib/cf.js";

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
  const from = env.CONTACT_FROM || "noreply@mariolorenzetti.org";
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

  if (!env.RESEND_API_KEY) return json({ ok: false, message: t.error + to }, 500);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `Sito mariolorenzetti.org <${from}>`,
      to: [to],
      reply_to: email,
      subject: "[Sito] " + (oggetto || `Messaggio da ${nome}`),
      text: `Nome: ${nome}\nEmail: ${email}\nOggetto: ${oggetto}\nLingua: ${form.get("lang") === "fr" ? "FR" : "IT"}\n\n${messaggio}\n`,
    }),
  });
  if (!res.ok) {
    console.error("[contatto] Resend", res.status, await res.text());
    return json({ ok: false, message: t.error + to }, 502);
  }
  return json({ ok: true, message: t.ok });
}

export const onRequest = () => json({ ok: false, message: "Method not allowed" }, 405);
