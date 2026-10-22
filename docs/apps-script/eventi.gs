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
 *    Dopo aver aggiunto doPost: Distribuisci > Gestisci distribuzioni > Nuova versione, e autorizza l'invio email.
 */

const SHEET_NAME = 'Eventi';
const CONTACTS_SHEET = 'Contatti';

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

  const to = props.getProperty('CONTACT_TO') || 'info@mariolorenzetti.org';
  const nome = String(data.nome || '');
  const email = String(data.email || '');
  const oggetto = String(data.oggetto || '');
  const messaggio = String(data.messaggio || '');
  const lingua = String(data.lingua || '');

  // Prima l'archivio, poi l'email: se l'invio fallisce il messaggio resta comunque nel foglio.
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONTACTS_SHEET) || ss.insertSheet(CONTACTS_SHEET);
  if (sheet.getLastRow() === 0) sheet.appendRow(['Data', 'Nome', 'Email', 'Oggetto', 'Messaggio', 'Lingua']);
  // L'apostrofo evita che un testo che inizia con "=" venga interpretato come formula.
  const safe = function (v) { return /^[=+\-@]/.test(v) ? "'" + v : v; };
  sheet.appendRow([new Date(), safe(nome), safe(email), safe(oggetto), safe(messaggio), lingua]);

  try {
    MailApp.sendEmail({
      to: to,
      replyTo: email,
      name: 'Sito mariolorenzetti.org',
      subject: '[Sito] ' + (oggetto || 'Messaggio da ' + nome),
      body: 'Nome: ' + nome + '\nEmail: ' + email + '\nOggetto: ' + oggetto + '\nLingua: ' + lingua + '\n\n' + messaggio + '\n',
    });
  } catch (err) {
    return reply({ ok: false, error: 'Invio email: ' + err.message });
  }
  return reply({ ok: true });
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
