<?php
// ============================================================
// Configuration de la base de données
// ============================================================

define('DB_HOST', 'localhost');
define('DB_NAME', 'emploi_du_temps');
define('DB_USER', 'root');        // À modifier selon votre config
define('DB_PASS', '');            // À modifier selon votre config
define('DB_CHARSET', 'utf8mb4');

define('SESSION_LIFETIME', 86400); // 24 heures

// Démarrer la session UNE SEULE FOIS, en forçant les bons paramètres
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_strict_mode', 1);
    ini_set('session.gc_maxlifetime', 86400);
    session_set_cookie_params([
        'lifetime' => 86400,
        'path'     => '/',
        'secure'   => false,   // mettre true si HTTPS
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['erreur' => 'Connexion base de données impossible : ' . $e->getMessage()]));
        }
    }
    return $pdo;
}

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
