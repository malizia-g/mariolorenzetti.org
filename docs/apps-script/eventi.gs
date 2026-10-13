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
 */

const SHEET_NAME = 'Eventi';

function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
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
