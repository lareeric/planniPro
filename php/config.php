<?php
// ============================================================
// Configuration de la base de données — Railway
// ============================================================

// ── Parsing de MYSQL_URL si disponible ─────────────────────
$db_url = getenv('MYSQL_URL') ?: getenv('DATABASE_URL') ?: null;

if ($db_url) {
    $parsed = parse_url($db_url);
    define('DB_HOST',    $parsed['host']);
    define('DB_NAME',    ltrim($parsed['path'], '/'));
    define('DB_USER',    $parsed['user']);
    define('DB_PASS',    $parsed['pass']);
    define('DB_PORT',    (string)($parsed['port'] ?? '3306'));
} else {
    define('DB_HOST',    getenv('MYSQLHOST')     ?: getenv('RAILWAY_PRIVATE_DOMAIN') ?: 'localhost');
    define('DB_NAME',    getenv('MYSQLDATABASE') ?: getenv('MYSQL_DATABASE')         ?: 'railway');
    define('DB_USER',    getenv('MYSQLUSER')     ?: 'root');
    define('DB_PASS',    getenv('MYSQLPASSWORD') ?: getenv('MYSQL_ROOT_PASSWORD')    ?: '');
    define('DB_PORT',    getenv('MYSQLPORT')     ?: '3306');
}

define('DB_CHARSET', 'utf8mb4');
define('SESSION_LIFETIME', 86400);

// ── Session ────────────────────────────────────────────────
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_strict_mode', 1);
    ini_set('session.gc_maxlifetime', 86400);
    session_set_cookie_params([
        'lifetime' => 86400,
        'path'     => '/',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// ── Connexion PDO ──────────────────────────────────────────
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST
             . ";port="      . DB_PORT
             . ";dbname="    . DB_NAME
             . ";charset="   . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode([
                'succes'  => false,
                'message' => 'Connexion base de données impossible : ' . $e->getMessage(),
                'donnees' => null,
            ], JSON_UNESCAPED_UNICODE));
        }
    }
    return $pdo;
}

// ── Helpers ────────────────────────────────────────────────
function reponseJSON(bool $succes, mixed $donnees = null, string $message = '', int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'succes'  => $succes,
        'message' => $message,
        'donnees' => $donnees,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function verifierSession(): int {
    if (empty($_SESSION['utilisateur_id'])) {
        reponseJSON(false, null, 'Non authentifié', 401);
    }
    return (int) $_SESSION['utilisateur_id'];
}

function nettoyerEntree(string $valeur): string {
    return htmlspecialchars(strip_tags(trim($valeur)), ENT_QUOTES, 'UTF-8');
}