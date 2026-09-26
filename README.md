# mariolorenzetti.org

Sito di Mario Lorenzetti (Respirazione Olotropica), generato con [Eleventy](https://www.11ty.dev/) e Tailwind CSS e pubblicato via FTP su hosting PHP (Serverplan).

## Come funziona

| Cosa | Dove si modifica | Come arriva online |
|---|---|---|
| Pagine e scritti (Markdown) | Editor `/admin/` (login Google) oppure `src/pagine`, `src/articoli`, `src/fr` | Ogni salvataggio è un commit su `main` → GitHub Actions → FTP (2-3 min) |
| Date dei seminari | Google Sheet "Eventi" | Menu del foglio **Sito web → Pubblica le date sul sito**, pulsante "Aggiorna il sito" nell'editor, o build notturna |
| Immagini | Editor (ridimensionate a max 2000 px) → `src/assets/uploads/` | Ottimizzate al build in AVIF/WebP (`/img/`) |
| Modulo contatti | `src/api/contatto.php` | Email a info@mariolorenzetti.org con `mail()` |

## Sviluppo

```bash
npm install
npm run dev      # http://localhost:8080
npm run build    # genera _site/
```

Senza `EVENTS_URL` le date vengono lette da `data/eventi.csv` (stesse colonne dello Sheet).

### Struttura

- `src/pagine/`, `src/articoli/`, `src/fr/` – contenuti Markdown (frontmatter: `title`, `seoTitle`, `description`, `image`, `permalink`, `translationKey`)
- `src/_data/events.js` – legge lo Sheet (Apps Script) con retry e cache; genera `upcoming`, `past`, `pastByYear`
- `src/calendario/evento.njk` – una pagina per evento (`/calendario/AAAA/citta-mese/`) con JSON-LD `Event`
- `src/_includes/` – layout e partial (SEO, JSON-LD, header, footer)
- `src/.htaccess` – HTTPS, redirect 301 dai vecchi URL WordPress, cache
- `src/admin/` – editor PHP/JS (non elaborato da 11ty)
- `src/wp-content/uploads/` – PDF e immagini del vecchio sito, stessi URL
- `scripts/import-wp.mjs` – import una tantum da WordPress (già eseguito)

## Configurazione (una volta sola)

### 1. Google Sheet delle date

1. Crea un Google Sheet con un foglio chiamato **Eventi** e importa `data/eventi.csv` (File → Importa → Sostituisci foglio corrente).
   Colonne: `Data inizio, Data fine, Orario, Titolo, Tipo, Città, Sede, Con, Descrizione, Iscrizioni entro, Iscrizione anticipata entro, Link, Lingua, Pubblica, Slug`.
   - `Pubblica` = `no` nasconde una riga; `Slug` (facoltativo) fissa l'URL dell'evento.
2. Estensioni → Apps Script: incolla `docs/apps-script/eventi.gs`.
3. Distribuisci → Nuova distribuzione → App web, *Esegui come: Me*, *Accesso: Chiunque*. Copia l'URL `/exec`.
4. Nelle Proprietà dello script aggiungi `GITHUB_TOKEN` (fine-grained, solo questo repo, *Actions: read and write*) e `GITHUB_REPO` = `malizia-g/mariolorenzetti.org`.

### 2. GitHub

Settings → Secrets and variables → Actions:

- Secrets: `EVENTS_URL` (URL `/exec` di Apps Script), `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`
- Variables (facoltative): `FTP_SERVER_DIR` (default `public_html/`), `FTP_PROTOCOL` (default `ftps`)

Il branch `staging` pubblica con `noindex` (usa un environment `staging` con credenziali FTP di un sottodominio).

### 3. Editor `/admin/`

1. Google Cloud Console → API e servizi → Credenziali → **ID client OAuth** (Applicazione web), origine autorizzata `https://mariolorenzetti.org`.
2. Token GitHub fine-grained solo su questo repo con permessi **Contents: read/write** e **Actions: read/write**.
3. Copia `src/admin/config.example.php` sul server come `ml-admin-config.php` **nella cartella sopra `public_html`** e compilalo (client ID, email autorizzate, token, link allo Sheet). Non va mai nel repo.

### 4. File audio/video grandi

Questi file (37-428 MB) non stanno nel repo: vanno copiati a mano nella radice del sito sul nuovo server.

- `/Conferenza-Convegno-SISSC-2025.mp4` (127 MB)
- `/Conferenza-Huxley-SISSC2018-1.wav` (428 MB – consigliato convertirlo in MP3)
- `/Conference-Payzac-matrices-perinatales.m4a` (37 MB)

Il deploy FTP non cancella file che non ha caricato lui, quindi restano al loro posto.

## Migrazione da WordPress

- Tutti gli URL di pagine e articoli sono invariati; i PDF restano sotto `/wp-content/uploads/`.
- Categorie, autore, archivi per data, feed, vecchie sitemap e `?p=` / `?page_id=` hanno redirect 301 in `src/.htaccess`.
- `/seminari-di-respirazione-olotropica-intensivi/` (vecchio archivio date) → `/calendario/`.
