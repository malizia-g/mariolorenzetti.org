<?php
declare(strict_types=1);

// Cartelle modificabili dall'editor (etichetta mostrata a Mario).
const CONTENT_DIRS = [
    'src/pagine' => 'Pagine',
    'src/articoli' => 'Scritti',
    'src/fr' => 'Pagine in francese',
];

function load_config(): array
{
    // config.php NON è nel repo: va caricato a mano sul server (vedi config.example.php).
    // Preferito fuori dalla cartella pubblica, accanto a public_html.
    foreach ([dirname(__DIR__, 2) . '/ml-admin-config.php', __DIR__ . '/config.php'] as $file) {
        if (is_file($file)) return require $file;
    }
    http_response_code(500);
    exit(json_encode(['error' => 'Editor non configurato: manca config.php']));
}

function start_session(): void
{
    session_name('ml_admin');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/admin/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function json_out(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Solo file .md dentro le cartelle ammesse: niente "../" né altri percorsi del repo.
function content_path(string $path): string
{
    foreach (array_keys(CONTENT_DIRS) as $dir) {
        if (preg_match('#^' . preg_quote($dir, '#') . '/[a-z0-9][a-z0-9-]*\.md$#', $path)) return $path;
    }
    throw new RuntimeException('Percorso non consentito', 400);
}

// Verifica l'ID token di "Accedi con Google" tramite l'endpoint tokeninfo di Google.
function verify_google_token(string $credential, string $clientId): string
{
    if ($credential === '') throw new RuntimeException('Credenziale mancante', 400);
    [$status, $body] = http_request('GET', 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($credential));
    $claims = json_decode($body, true);
    if ($status !== 200 || !is_array($claims)) throw new RuntimeException('Accesso Google non valido', 401);
    if (($claims['aud'] ?? '') !== $clientId) throw new RuntimeException('Token Google per un\'altra applicazione', 401);
    if (!in_array($claims['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)) throw new RuntimeException('Emittente non valido', 401);
    if ((int) ($claims['exp'] ?? 0) < time()) throw new RuntimeException('Accesso scaduto, riprova', 401);
    if (($claims['email_verified'] ?? '') !== 'true' && ($claims['email_verified'] ?? null) !== true) throw new RuntimeException('Email Google non verificata', 401);
    return (string) $claims['email'];
}

function http_request(string $method, string $url, array $headers = [], ?string $body = null): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_USERAGENT => 'mariolorenzetti-editor',
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    $res = curl_exec($ch);
    if ($res === false) throw new RuntimeException('Errore di rete: ' . curl_error($ch), 502);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$status, (string) $res];
}

final class GitHub
{
    public function __construct(private string $token, private string $repo, private string $branch) {}

    private function call(string $method, string $path, ?array $payload = null): array
    {
        [$status, $body] = http_request($method, "https://api.github.com/repos/{$this->repo}$path", [
            'Authorization: Bearer ' . $this->token,
            'Accept: application/vnd.github+json',
            'X-GitHub-Api-Version: 2022-11-28',
            'Content-Type: application/json',
        ], $payload === null ? null : json_encode($payload));
        $data = $body === '' ? [] : (json_decode($body, true) ?? []);
        if ($status === 409 || ($status === 422 && str_contains($body, 'sha'))) {
            throw new RuntimeException('Il file è stato modificato nel frattempo: ricarica la pagina e riapplica le modifiche.', 409);
        }
        if ($status >= 400) throw new RuntimeException('GitHub: ' . ($data['message'] ?? "errore $status"), 502);
        return $data;
    }

    public function listDir(string $dir): array
    {
        return $this->call('GET', "/contents/$dir?ref={$this->branch}");
    }

    public function getFile(string $path): array
    {
        $f = $this->call('GET', "/contents/$path?ref={$this->branch}");
        return ['path' => $path, 'sha' => $f['sha'], 'content' => base64_decode(str_replace("\n", '', $f['content']))];
    }

    public function putFile(string $path, string $content, string $message, ?string $sha): array
    {
        $payload = ['message' => $message, 'content' => base64_encode($content), 'branch' => $this->branch];
        if ($sha) $payload['sha'] = $sha;
        $res = $this->call('PUT', "/contents/$path", $payload);
        return ['path' => $path, 'sha' => $res['content']['sha'] ?? null];
    }

    public function dispatchWorkflow(string $file): void
    {
        $this->call('POST', "/actions/workflows/$file/dispatches", ['ref' => $this->branch]);
    }

    public function lastRun(string $file): array
    {
        $runs = $this->call('GET', "/actions/workflows/$file/runs?per_page=1&branch={$this->branch}")['workflow_runs'] ?? [];
        if (!$runs) return ['status' => 'none'];
        $r = $runs[0];
        return ['status' => $r['status'], 'conclusion' => $r['conclusion'], 'updated' => $r['updated_at'], 'title' => $r['display_title']];
    }
}
