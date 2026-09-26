/**
 * Apps Script collegato al Google Sheet "Date Mario Lorenzetti".
 *
 * 1. doGet: pubblica il foglio "Eventi" come JSON (letto da src/_data/events.js al build).
 *    Distribuisci > Nuova distribuzione > App web — Esegui come: Me — Accesso: Chiunque.
 *    L'URL /exec va nel secret GitHub EVENTS_URL.
 * 2. Menu "Sito web > Pubblica le date sul sito": avvia il workflow GitHub di build e deploy.
 *    In Impostazioni progetto > Proprietà script aggiungi:
 *      GITHUB_TOKEN = token fine-grained con permesso "Actions: read and write" solo su questo repo
 *      GITHUB_REPO  = malizia-g/mariolorenzetti.org
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
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('GITHUB_TOKEN');
  const repo = props.getProperty('GITHUB_REPO');
  const ui = SpreadsheetApp.getUi();
  if (!token || !repo) {
    ui.alert('Configurazione mancante: GITHUB_TOKEN e GITHUB_REPO nelle proprietà dello script.');
    return;
  }
  const res = UrlFetchApp.fetch('https://api.github.com/repos/' + repo + '/actions/workflows/deploy.yml/dispatches', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
    payload: JSON.stringify({ ref: 'main' }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() === 204) {
    ui.alert('Aggiornamento avviato. Le date saranno online tra circa 2-3 minuti.');
  } else {
    ui.alert('Errore ' + res.getResponseCode() + ': ' + res.getContentText());
  }
}
