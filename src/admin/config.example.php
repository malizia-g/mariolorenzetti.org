<?php
// Copia questo file come "ml-admin-config.php" nella cartella SOPRA public_html
// (oppure come admin/config.php) e compila i valori. Non committare mai il file compilato.
return [
    // Google Cloud Console > API e servizi > Credenziali > ID client OAuth (Applicazione web).
    // Origini JavaScript autorizzate: https://mariolorenzetti.org
    'google_client_id' => 'XXXXXXXX.apps.googleusercontent.com',

    // Account Google che possono entrare nell'editor.
    'allowed_emails' => [
        'mario@example.com',
    ],

    // Token GitHub fine-grained, solo su questo repo, permessi: Contents (read/write) e Actions (read/write).
    'github_token' => 'github_pat_...',
    'github_repo' => 'malizia-g/mariolorenzetti.org',
    'github_branch' => 'main',

    // Link mostrati nell'editor.
    'sheet_url' => 'https://docs.google.com/spreadsheets/d/.../edit',
    'site_url' => 'https://mariolorenzetti.org/',
];
