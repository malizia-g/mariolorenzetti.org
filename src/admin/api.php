<?php
// Backend dell'editor: login Google + lettura/scrittura dei contenuti nel repo GitHub.
// Il token GitHub resta sul server (config.php), il browser non lo vede mai.
declare(strict_types=1);

require __DIR__ . '/lib.php';

$config = load_config();
start_session();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];

try {
    if ($action === 'config') {
        json_out(['clientId' => $config['google_client_id']]);
    }

    if ($action === 'login') {
        $email = verify_google_token((string) ($input['credential'] ?? ''), $config['google_client_id']);
        if (!in_array(strtolower($email), array_map('strtolower', $config['allowed_emails']), true)) {
            json_out(['error' => "L'account $email non è autorizzato."], 403);
        }
        session_regenerate_id(true);
        $_SESSION['email'] = $email;
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
        json_out(['email' => $email, 'csrf' => $_SESSION['csrf']]);
    }

    if ($action === 'me') {
        json_out(isset($_SESSION['email'])
            ? ['email' => $_SESSION['email'], 'csrf' => $_SESSION['csrf'], 'sheetUrl' => $config['sheet_url'] ?? '', 'siteUrl' => $config['site_url'] ?? '/']
            : ['email' => null]);
    }

    // Da qui in poi: utente autenticato + token CSRF.
    if (!isset($_SESSION['email'])) json_out(['error' => 'Sessione scaduta, accedi di nuovo.'], 401);
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && !hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF'] ?? '')) {
        json_out(['error' => 'Token non valido, ricarica la pagina.'], 403);
    }
    $gh = new GitHub($config['github_token'], $config['github_repo'], $config['github_branch'] ?? 'main');
    $author = $_SESSION['email'];

    switch ($action) {
        case 'logout':
            $_SESSION = [];
            session_destroy();
            json_out(['ok' => true]);

        case 'list':
            $files = [];
            foreach (CONTENT_DIRS as $dir => $label) {
                foreach ($gh->listDir($dir) as $item) {
                    if ($item['type'] === 'file' && str_ends_with($item['name'], '.md')) {
                        $files[] = ['path' => $item['path'], 'name' => $item['name'], 'section' => $label];
                    }
                }
            }
            json_out(['files' => $files]);

        case 'get':
            $path = content_path((string) ($_GET['path'] ?? ''));
            json_out($gh->getFile($path));

        case 'save':
            $path = content_path((string) ($input['path'] ?? ''));
            $sha = $input['sha'] ?? null;
            $content = (string) ($input['content'] ?? '');
            if (strlen($content) > 500_000) json_out(['error' => 'Contenuto troppo grande.'], 413);
            $msg = ($sha ? 'Modifica ' : 'Nuovo ') . basename($path) . " (editor, $author)";
            json_out($gh->putFile($path, $content, $msg, $sha));

        case 'upload':
            $name = (string) ($input['name'] ?? '');
            $data = base64_decode((string) ($input['data'] ?? ''), true);
            if ($data === false || strlen($data) > 8_000_000) json_out(['error' => 'Immagine non valida o oltre 8 MB.'], 413);
            $info = @getimagesizefromstring($data);
            $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$info['mime'] ?? ''] ?? null;
            if (!$ext) json_out(['error' => 'Formati ammessi: JPG, PNG, WebP.'], 415);
            $slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower(pathinfo($name, PATHINFO_FILENAME))), '-') ?: 'immagine';
            $path = sprintf('src/assets/uploads/%s/%s-%s.%s', date('Y/m'), substr($slug, 0, 60), substr(bin2hex(random_bytes(3)), 0, 6), $ext);
            $gh->putFile($path, $data, 'Immagine ' . basename($path) . " (editor, $author)", null);
            json_out(['url' => '/' . substr($path, strlen('src/'))]);

        case 'publish':
            $gh->dispatchWorkflow('deploy.yml');
            json_out(['ok' => true]);

        case 'status':
            json_out($gh->lastRun('deploy.yml'));

        default:
            json_out(['error' => 'Azione sconosciuta'], 400);
    }
} catch (Throwable $e) {
    error_log('[admin] ' . $e->getMessage());
    json_out(['error' => $e->getMessage()], $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500);
}
