<?php
// ============================================================
// auth.php — Inscription / Connexion / Déconnexion
// ============================================================
require_once 'config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

$corps  = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $corps['action'] ?? '';

switch ($action) {

    // ──────────────────────────────────────────
    // Inscription
    // ──────────────────────────────────────────
    case 'inscription':
        $nom    = nettoyerEntree($corps['nom']    ?? '');
        $prenom = nettoyerEntree($corps['prenom'] ?? '');
        $email  = filter_var(trim($corps['email'] ?? ''), FILTER_SANITIZE_EMAIL);
        $mdp    = $corps['mot_de_passe'] ?? '';

        if (!$nom || !$prenom || !$email || strlen($mdp) < 6) {
            reponseJSON(false, null, 'Données invalides ou mot de passe trop court (min 6 caractères)', 422);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            reponseJSON(false, null, 'Email invalide', 422);
        }

        $db   = getDB();
        $stmt = $db->prepare('SELECT id FROM utilisateurs WHERE email = ?');
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            reponseJSON(false, null, 'Cet email est déjà utilisé', 409);
        }

        $hash = password_hash($mdp, PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $db->prepare('INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe) VALUES (?,?,?,?)');
        $stmt->execute([$nom, $prenom, $email, $hash]);
        $id = (int) $db->lastInsertId();

        // Catégories par défaut
        $cats = [
            ['Travail',   '#2563eb'],
            ['Personnel', '#16a34a'],
            ['Santé',     '#dc2626'],
            ['Formation', '#d97706'],
            ['Loisirs',   '#7c3aed'],
        ];
        $ins = $db->prepare('INSERT INTO categories (utilisateur_id, nom, couleur) VALUES (?,?,?)');
        foreach ($cats as [$n, $c]) {
            $ins->execute([$id, $n, $c]);
        }

        $_SESSION['utilisateur_id'] = $id;
        reponseJSON(true, [
            'id'     => $id,
            'nom'    => $nom,
            'prenom' => $prenom,
            'email'  => $email,
        ], 'Compte créé avec succès', 201);
        break;

    // ──────────────────────────────────────────
    // Connexion
    // ──────────────────────────────────────────
    case 'connexion':
        $email = filter_var(trim($corps['email'] ?? ''), FILTER_SANITIZE_EMAIL);
        $mdp   = $corps['mot_de_passe'] ?? '';

        if (!$email || !$mdp) {
            reponseJSON(false, null, 'Email et mot de passe requis', 422);
        }

        $db   = getDB();
        $stmt = $db->prepare('SELECT id, nom, prenom, email, mot_de_passe FROM utilisateurs WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($mdp, $user['mot_de_passe'])) {
            reponseJSON(false, null, 'Identifiants incorrects', 401);
        }

        $_SESSION['utilisateur_id'] = $user['id'];
        unset($user['mot_de_passe']);
        reponseJSON(true, $user, 'Connexion réussie');
        break;

    // ──────────────────────────────────────────
    // Vérifier session active
    // ──────────────────────────────────────────
    case 'verifier':
        if (!empty($_SESSION['utilisateur_id'])) {
            $db   = getDB();
            $stmt = $db->prepare('SELECT id, nom, prenom, email FROM utilisateurs WHERE id = ?');
            $stmt->execute([$_SESSION['utilisateur_id']]);
            $user = $stmt->fetch();
            if ($user) reponseJSON(true, $user, 'Session active');
        }
        reponseJSON(false, null, 'Non connecté', 401);
        break;

    // ──────────────────────────────────────────
    // Déconnexion
    // ──────────────────────────────────────────
    case 'deconnexion':
        session_destroy();
        reponseJSON(true, null, 'Déconnecté');
        break;

    default:
        reponseJSON(false, null, 'Action inconnue', 400);
}