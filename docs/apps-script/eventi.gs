/**
 * Apps Script collegato al Google Sheet "Date Mario Lorenzetti".
 *
 * 1. doGet: pubblica il foglio "Eventi" come JSON (letto da src/_data/events.js al build).
 *    Distribuisci > Nuova distribuzione > App web — Esegui come: Me — Accesso: Chiunque.
 *    L'URL /exec va nella variabile EVENTS_URL del progetto Cloudflare Pages (Settings > Variables).
 * 2. Menu "Sito web > Pubblica le date sul sito": rigenera il sito su Cloudflare Pages.
 *    In Impostazioni progetto > Proprietà script aggiungi:
 *      DEPLOY_HOOK_URL = deploy hook del progetto Cloudflare Pages
 *      (Cloudflare > Workers & Pages > progetto > Settings > Builds > Deploy hooks)
 * 3. doPost: riceve i messaggi del modulo contatti (functions/api/contatto.js), li invia per email
 *    e li salva nel foglio "Contatti" (creato al primo messaggio). Proprietà script:
 *      CONTACT_TOKEN = stringa casuale, uguale alla variabile CONTACT_TOKEN su Cloudflare
 *      CONTACT_TO    = destinatario (facoltativa, default info@mariolorenzetti.org)
 *    Le email partono dall'account Google proprietario dello script (limite: 100 al giorno con Gmail).
 *    Se il visitatore spunta "newsletter" riceve un'email con il link di conferma (doppio opt-in):
 *    la pagina Contatti chiama /api/newsletter (functions/api/newsletter.js), che verifica la firma
 *    e chiede a doPost (action "subscribe") di iscriverlo su Sender.net. Proprietà script:
 *      SENDER_TOKEN = API token di Sender (Settings > API access tokens)
 *      SENDER_GROUP = facoltativa, gruppo unico per le prove (es. "Test group"); altrimenti SENDER_GROUPS
 *    Dopo aver aggiunto doPost: Distribuisci > Gestisci distribuzioni > Nuova versione, e autorizza l'invio email.
 */

const SHEET_NAME = 'Eventi';
const CONTACTS_SHEET = 'Contatti';
// Gruppi Sender.net per lingua del modulo.
const SENDER_GROUPS = { IT: 'aAW4Bz', FR: 'dw2WXw' };

const NEWSLETTER_MAIL = {
  IT: {
    subject: "Conferma l'iscrizione alla newsletter di Mario Lorenzetti",
    body: function (nome, link) {
      return 'Ciao ' + nome + ',\n\nper ricevere le nuove date dei seminari conferma l\'iscrizione alla newsletter aprendo questo link:\n\n' +
        link + '\n\nSe non hai chiesto tu l\'iscrizione, ignora questa email.\n\nMario Lorenzetti\n';
    },
  },
  FR: {
    subject: "Confirmez votre inscription à la newsletter de Mario Lorenzetti",
    body: function (nome, link) {
      return 'Bonjour ' + nome + ',\n\npour recevoir les nouvelles dates des stages, confirmez votre inscription à la newsletter en ouvrant ce lien :\n\n' +
        link + '\n\nSi vous n\'avez pas demandé cette inscription, ignorez cet email.\n\nMario Lorenzetti\n';
    },
  },
};

function getEventsSheet() {
  const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  const wanted = SHEET_NAME.toLowerCase();
  const match = sheets.filter(function (s) { return s.getName().trim().toLowerCase() === wanted; })[0];
  if (match) return match;
  if (sheets.length === 1) return sheets[0];
  throw new Error('Foglio "' + SHEET_NAME + '" non trovato. Fogli presenti: ' +
    sheets.map(function (s) { return s.getName(); }).join(', '));
}

function doGet() {
  const sheet = getEventsSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(function (h) { return String(h).trim().toLowerCase(); });
  const tz = Session.getScriptTimeZone();

  const rows = values
    .filter(function (row) { return row.some(function (v) { return v !== ''; }); })
    .map(function (row) {
      const obj = {};
      headers.forEach(function (key, i) {
        if (!key) return;
        const v = row[i];
        // Le celle data diventano "2026-10-16", indipendentemente dal formato mostrato nel foglio.
        obj[key] = v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v).trim();
      });
      return obj;
    });

  return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const reply = function (obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  };
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('CONTACT_TOKEN');
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: 'JSON non valido' });
  }
  if (!token || data.token !== token) return reply({ ok: false, error: 'Token non valido' });
  if (data.action === 'subscribe') return reply(subscribe(props, data));

  const to = props.getProperty('CONTACT_TO') || 'info@mariolorenzetti.org';
  const nome = String(data.nome || '');
  const email = String(data.email || '');
  const oggetto = String(data.oggetto || '');
  const messaggio = String(data.messaggio || '');
  const lingua = data.lingua === 'FR' ? 'FR' : 'IT';
  const newsletter = data.newsletter === true;

  // Prima l'archivio, poi l'email: se l'invio fallisce il messaggio resta comunque nel foglio.
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONTACTS_SHEET) || ss.insertSheet(CONTACTS_SHEET);
  if (sheet.getLastRow() === 0) sheet.appendRow(['Data', 'Nome', 'Email', 'Oggetto', 'Messaggio', 'Lingua', 'Newsletter']);
  if (sheet.getRange(1, 7).getValue() === '') sheet.getRange(1, 7).setValue('Newsletter');
  // L'apostrofo evita che un testo che inizia con "=" venga interpretato come formula.
  const safe = function (v) { return /^[=+\-@]/.test(v) ? "'" + v : v; };
  sheet.appendRow([new Date(), safe(nome), safe(email), safe(oggetto), safe(messaggio), lingua, newsletter ? 'richiesta' : '']);

  try {
    MailApp.sendEmail({
      to: to,
      replyTo: email,
      name: 'Sito mariolorenzetti.org',
      subject: '[Sito] ' + (oggetto || 'Messaggio da ' + nome),
      body: 'Nome: ' + nome + '\nEmail: ' + email + '\nOggetto: ' + oggetto + '\nLingua: ' + lingua +
        '\nNewsletter: ' + (newsletter ? 'sì (in attesa di conferma)' : 'no') + '\n\n' + messaggio + '\n',
    });
    if (newsletter && data.confirmUrl) {
      const t = NEWSLETTER_MAIL[lingua];
      MailApp.sendEmail({ to: email, name: 'Mario Lorenzetti', subject: t.subject, body: t.body(nome, data.confirmUrl) });
    }
  } catch (err) {
    return reply({ ok: false, error: 'Invio email: ' + err.message });
  }
  return reply({ ok: true });
}

// Iscrizione confermata dal visitatore: lo aggiunge (o aggiorna) su Sender.net.
function subscribe(props, data) {
  const senderToken = props.getProperty('SENDER_TOKEN');
  if (!senderToken) return { ok: false, error: 'SENDER_TOKEN mancante' };
  const group = props.getProperty('SENDER_GROUP') || SENDER_GROUPS[data.lingua === 'FR' ? 'FR' : 'IT'];
  const payload = { email: String(data.email || ''), groups: [group] };
  if (data.nome) payload.firstname = String(data.nome);
  const res = UrlFetchApp.fetch('https://api.sender.net/v2/subscribers', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + senderToken, Accept: 'application/json' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) return { ok: false, error: 'Sender ' + res.getResponseCode() + ': ' + res.getContentText() };
  return { ok: true };
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sito web')
    .addItem('Pubblica le date sul sito', 'publishSite')
    .addToUi();
}

function publishSite() {
  const hook = PropertiesService.getScriptProperties().getProperty('DEPLOY_HOOK_URL');
  const ui = SpreadsheetApp.getUi();
  if (!hook) {
    ui.alert('Configurazione mancante: DEPLOY_HOOK_URL nelle proprietà dello script.');
    return;
  }
  const res = UrlFetchApp.fetch(hook, { method: 'post', muteHttpExceptions: true });
  if (res.getResponseCode() < 300) {
    ui.alert('Aggiornamento avviato. Le date saranno online tra circa 2-3 minuti.');
  } else {
    ui.alert('Errore ' + res.getResponseCode() + ': ' + res.getContentText());
  }
}
