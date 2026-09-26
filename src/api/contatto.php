<?php
// Modulo contatti: invia una email a Mario. Nessun database.
declare(strict_types=1);

$config = ['to' => 'info@mariolorenzetti.org', 'from' => 'noreply@mariolorenzetti.org'];
if (is_file(__DIR__ . '/config.php')) {
    $config = array_merge($config, require __DIR__ . '/config.php');
}

header('Content-Type: application/json; charset=utf-8');
$fr = ($_POST['lang'] ?? '') === 'fr';
$msg = [
    'ok' => $fr ? 'Merci ! Votre message a été envoyé, je vous répondrai bientôt.' : 'Grazie! Il messaggio è stato inviato, ti risponderò al più presto.',
    'invalid' => $fr ? 'Veuillez remplir le nom, un email valide, le message et accepter la politique de confidentialité.' : 'Compila nome, email valida, messaggio e accetta l\'informativa privacy.',
    'error' => $fr ? 'Erreur d\'envoi. Écrivez directement à ' : 'Errore di invio. Scrivi direttamente a ',
    'slow' => $fr ? 'Trop de messages, réessayez dans quelques minutes.' : 'Troppi messaggi, riprova tra qualche minuto.',
];

function reply(bool $ok, string $message, int $status = 200): never {
    http_response_code($status);
    echo json_encode(['ok' => $ok, 'message' => $message]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(false, 'Method not allowed', 405);

// Honeypot compilato o invio in meno di 3 secondi: bot. Risponde "ok" senza inviare.
$elapsed = (int) (microtime(true) * 1000) - (int) ($_POST['t'] ?? 0);
if (!empty($_POST['website']) || $elapsed < 3000) reply(true, $msg['ok']);

// Limite semplice: massimo 5 invii ogni 10 minuti per IP.
$ipFile = sys_get_temp_dir() . '/ml-contatto-' . md5($_SERVER['REMOTE_ADDR'] ?? '');
$hits = array_filter(json_decode(@file_get_contents($ipFile) ?: '[]', true) ?: [], fn($t) => $t > time() - 600);
if (count($hits) >= 5) reply(false, $msg['slow'], 429);
$hits[] = time();
@file_put_contents($ipFile, json_encode(array_values($hits)));

$clean = fn(string $k, int $max) => trim(mb_substr(str_replace(["\r", "\0"], '', (string) ($_POST[$k] ?? '')), 0, $max));
$nome = $clean('nome', 120);
$email = $clean('email', 200);
$oggetto = $clean('oggetto', 200);
$messaggio = $clean('messaggio', 5000);

if ($nome === '' || $messaggio === '' || empty($_POST['privacy']) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    reply(false, $msg['invalid'], 422);
}

$nome = str_replace("\n", ' ', $nome);
$oggetto = str_replace("\n", ' ', $oggetto);
$subject = '=?UTF-8?B?' . base64_encode('[Sito] ' . ($oggetto !== '' ? $oggetto : 'Messaggio da ' . $nome)) . '?=';
$body = "Nome: $nome\nEmail: $email\nOggetto: $oggetto\nLingua: " . ($fr ? 'FR' : 'IT') . "\n\n$messaggio\n";
$headers = implode("\r\n", [
    'From: Sito mariolorenzetti.org <' . $config['from'] . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
]);

if (!mail($config['to'], $subject, $body, $headers, '-f' . $config['from'])) {
    reply(false, $msg['error'] . $config['to'], 500);
}
reply(true, $msg['ok']);
