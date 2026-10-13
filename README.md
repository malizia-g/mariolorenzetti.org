# mariolorenzetti.org

Sito di Mario Lorenzetti (Respirazione Olotropica), generato con [Eleventy](https://www.11ty.dev/) e Tailwind CSS e pubblicato su **Cloudflare Pages**. Editor e modulo contatti sono Cloudflare Pages Functions (`functions/`).

## Come funziona

| Cosa | Dove si modifica | Come arriva online |
|---|---|---|
| Pagine e scritti (Markdown) | Editor `/admin/` (login Google) oppure `src/pagine`, `src/articoli`, `src/fr` | Ogni salvataggio è un commit su `main` → Cloudflare rigenera il sito (2-3 min) |
| Date dei seminari | Google Sheet "Eventi" | Menu del foglio **Sito web → Pubblica le date sul sito**, pulsante "Aggiorna il sito" nell'editor, o ricostruzione notturna |
| Immagini | Editor (ridimensionate a max 2000 px) → `src/assets/uploads/` | Ottimizzate al build in AVIF/WebP (`/img/`) |
| Modulo contatti | `functions/api/contatto.js` | Email a info@mariolorenzetti.org via Resend |
| Colori | `src/_data/themes.js` (10 temi) | Il selettore resta visibile finché `themePicker` in `src/_data/site.js` è attivo |

## Sviluppo

```bash
npm install
npm run dev                          # sito su http://localhost:8080 (senza Functions)
npm run build && npx wrangler pages dev _site   # sito + Functions su http://localhost:8788
```

Le variabili per le Functions in locale vanno in `.dev.vars` (non versionato), con gli stessi nomi elencati sotto.
Anche la build di Eleventy legge `.dev.vars`: con `EVENTS_URL` le date arrivano dal Google Sheet, senza da `data/eventi.csv` (stesse colonne dello Sheet).

### Struttura

- `src/pagine/`, `src/articoli/`, `src/fr/` – contenuti Markdown (frontmatter: `title`, `seoTitle`, `description`, `image`, `permalink`, `translationKey`)
- `src/_data/events.js` – legge lo Sheet (Apps Script) con retry; genera `upcoming`, `past`, `pastByYear`
- `src/calendario/evento.njk` – una pagina per evento (`/calendario/AAAA/citta-mese/`) con JSON-LD `Event`
- `src/_data/themes.js` + `src/css/themes.njk` – temi di colore; `src/_includes/partials/theme-picker.njk` – selettore
- `src/cloudflare/` – `_redirects` (vecchi URL WordPress), `_headers`, `_routes.json`; copiati nella radice del sito
- `functions/` – `admin/api.js` (editor), `api/contatto.js` (modulo), `index.js` (vecchi link `?p=` / `?page_id=`)
- `lib/cf.js` – sessione firmata, verifica Google, client GitHub
- `src/admin/` – interfaccia dell'editor (non elaborata da 11ty)
- `src/wp-content/uploads/` – PDF e immagini del vecchio sito, stessi URL
- `.github/workflows/pages.yml` – demo su GitHub Pages (noindex, editor in modalità dimostrativa)
- `.github/workflows/nightly.yml` – ricostruzione notturna tramite deploy hook

## Messa online (una volta sola)

Il setup minimo (passi 1–5) mette online il sito con le date dal Google Sheet e il modulo contatti.
L'editor `/admin/` con login Google è facoltativo e si aggiunge dopo (passo 7): finché non è configurato, il sito funziona normalmente e l'editor semplicemente non permette l'accesso.

### 1. Progetto Cloudflare Pages

1. Cloudflare → Workers & Pages → Create → Pages → **Connect to Git** → repo `malizia-g/mariolorenzetti.org`.
2. Build command `npm run build`, output directory `_site`, branch di produzione `main` (la versione di Node viene letta da `.node-version`).
3. Settings → Builds → **Deploy hooks** → crea un hook (branch `main`) e copia l'URL: serve ai passi 3 e 5.

### 2. Google Sheet delle date

1. Crea un Google Sheet con un foglio chiamato **Eventi** e importa `data/eventi.csv` (File → Importa → Sostituisci il foglio corrente).
   Colonne: `Data inizio, Data fine, Orario, Titolo, Tipo, Città, Sede, Con, Descrizione, Iscrizioni entro, Iscrizione anticipata entro, Link, Lingua, Pubblica, Slug`.
2. Estensioni → Apps Script: incolla `docs/apps-script/eventi.gs` e salva.
3. Distribuisci → Nuova distribuzione → **App web** (*Esegui come: Me*, *Accesso: Chiunque*) → autorizza → copia l'URL che finisce con `/exec`.
   Aprendolo nel browser deve comparire il JSON delle date.
   Quando modifichi lo script: Distribuisci → Gestisci distribuzioni → ✏️ → Versione: **Nuova versione** (l'URL resta lo stesso).

### 3. Variabili (Pages → Settings → Variables and Secrets, ambiente Production)

| Nome | Valore |
|---|---|
| `EVENTS_URL` | URL `/exec` del passo 2 (usato dalla build per leggere le date) |
| `RESEND_API_KEY` | chiave API di [Resend](https://resend.com) per il modulo contatti (dominio `mariolorenzetti.org` verificato, vedi passo 4); senza, il modulo mostra un errore con l'indirizzo email da usare |

Facoltative: `CONTACT_TO` (default `info@mariolorenzetti.org`), `CONTACT_FROM` (default `noreply@mariolorenzetti.org`).

Dopo aver salvato le variabili: Deployments → **Retry deployment** (o un nuovo commit) perché la build le usi.

Infine, nell'Apps Script: Impostazioni progetto → Proprietà script → `DEPLOY_HOOK_URL` = deploy hook del passo 1.
Ricarica il foglio: compare il menu **Sito web → Pubblica le date sul sito**.

### 4. Dominio e posta

1. Cloudflare → Add a domain → `mariolorenzetti.org`; controlla i record DNS importati.
2. Email Routing: `info@mariolorenzetti.org` → casella di Mario. Aggiungi i record DNS di Resend (SPF/DKIM) e un record DMARC.
3. Cambia i nameserver presso il registrar con quelli indicati da Cloudflare.
4. Pages → Custom domains: aggiungi `mariolorenzetti.org` e `www.mariolorenzetti.org`; regola di redirect `www` → dominio principale. SSL/TLS → Always Use HTTPS.

### 5. GitHub

Secret `CF_DEPLOY_HOOK` (repo → Settings → Secrets and variables → Actions) = deploy hook del passo 1: abilita la ricostruzione notturna (aggiorna "prossime date" / "date passate" anche senza modifiche).

### 6. File audio/video grandi

Non stanno nel repo (limite 25 MB per file su Pages): `Conferenza-Convegno-SISSC-2025.mp4` (127 MB), `Conferenza-Huxley-SISSC2018-1.wav` (428 MB), `Conference-Payzac-matrices-perinatales.m4a` (37 MB). Da spostare su YouTube o Cloudflare R2 prima della disattivazione del vecchio hosting, aggiornando i link in `src/pagine/pubblicazioni.md` e `src/fr/accueil.md`.

### 7. Editor `/admin/` con login Google (facoltativo)

1. **Client OAuth Google** – [Google Cloud Console](https://console.cloud.google.com/) → crea un progetto →
   Google Auth Platform (schermata di consenso OAuth): tipo *Esterno*, nome app e email di supporto; in *Pubblico* pubblica l'app o aggiungi come utenti di test le email autorizzate →
   Client → **Crea client** → *Applicazione web* → **Origini JavaScript autorizzate**: `https://mariolorenzetti.org` (più `https://<progetto>.pages.dev` per provare prima del dominio e `http://localhost:8788` per lo sviluppo). Non servono URI di reindirizzamento. Copia l'**ID client**.
2. **Token GitHub** – GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → solo il repo `malizia-g/mariolorenzetti.org`, permesso **Contents: Read and write**. Annota la scadenza: alla scadenza l'editor smette di salvare.
3. **Variabili** in Pages → Settings → Variables and Secrets (Production), poi nuovo deploy:

| Nome | Valore |
|---|---|
| `GOOGLE_CLIENT_ID` | ID client del punto 1 |
| `ALLOWED_EMAILS` | email autorizzate all'editor, separate da virgola |
| `SESSION_SECRET` | stringa casuale di almeno 32 caratteri (`openssl rand -hex 32`) |
| `GITHUB_TOKEN` | token del punto 2 (come *Secret*) |
| `GITHUB_REPO` | `malizia-g/mariolorenzetti.org` |
| `DEPLOY_HOOK_URL` | deploy hook del passo 1 (pulsante "Aggiorna il sito" nell'editor) |
| `SHEET_URL`, `SITE_URL` | link al Google Sheet e al sito, mostrati nell'editor |

Facoltative: `GITHUB_BRANCH` (default `main`); `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_PROJECT` per vedere lo stato della pubblicazione nell'editor (token con permesso *Cloudflare Pages: Read*).

4. Apri `https://mariolorenzetti.org/admin/` e accedi con un'email presente in `ALLOWED_EMAILS`.

## Migrazione da WordPress

- Tutti gli URL di pagine e articoli sono invariati; i PDF restano sotto `/wp-content/uploads/`.
- Categorie, autore, archivi per data, feed e vecchie sitemap: 301 in `src/cloudflare/_redirects`; `?p=` / `?page_id=` / `?s=`: `functions/index.js`.
- `/seminari-di-respirazione-olotropica-intensivi/` (vecchio archivio date) → `/calendario/`.
