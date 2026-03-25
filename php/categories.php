<?php
// ============================================================
// categories.php — Gestion des catégories
// ============================================================
require_once 'plan_limits.php';
verifierLimiteCategories($userId); // avant le INSERT
require_once 'config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

$userId  = verifierSession();
$methode = $_SERVER['REQUEST_METHOD'];
$corps   = json_decode(file_get_contents('php://input'), true) ?? [];
$db      = getDB();

if ($methode === 'GET') {
    $stmt = $db->prepare('SELECT * FROM categories WHERE utilisateur_id = ? ORDER BY nom ASC');
    $stmt->execute([$userId]);
    reponseJSON(true, $stmt->fetchAll());
}

if ($methode === 'POST') {
    $nom     = nettoyerEntree($corps['nom'] ?? '');
    $couleur = preg_match('/^#[0-9a-fA-F]{6}$/', $corps['couleur'] ?? '') ? $corps['couleur'] : '#4f46e5';
    if (!$nom) reponseJSON(false, null, 'Nom requis', 422);

    $stmt = $db->prepare('INSERT INTO categories (utilisateur_id, nom, couleur) VALUES (?,?,?)');
    $stmt->execute([$userId, $nom, $couleur]);
    $id = (int) $db->lastInsertId();
    reponseJSON(true, ['id' => $id, 'utilisateur_id' => $userId, 'nom' => $nom, 'couleur' => $couleur], 'Catégorie créée', 201);
}

if ($methode === 'PUT') {
    $id      = (int) ($corps['id'] ?? 0);
    $nom     = nettoyerEntree($corps['nom'] ?? '');
    $couleur = preg_match('/^#[0-9a-fA-F]{6}$/', $corps['couleur'] ?? '') ? $corps['couleur'] : '#4f46e5';
    if (!$id || !$nom) reponseJSON(false, null, 'Données invalides', 422);

    $stmt = $db->prepare('UPDATE categories SET nom = ?, couleur = ? WHERE id = ? AND utilisateur_id = ?');
    $stmt->execute([$nom, $couleur, $id, $userId]);
    if ($stmt->rowCount() === 0) reponseJSON(false, null, 'Catégorie introuvable', 404);
    reponseJSON(true, ['id' => $id, 'nom' => $nom, 'couleur' => $couleur], 'Catégorie modifiée');
}

if ($methode === 'DELETE') {
    $id = (int) ($corps['id'] ?? $_GET['id'] ?? 0);
    if (!$id) reponseJSON(false, null, 'ID manquant', 422);

    $stmt = $db->prepare('DELETE FROM categories WHERE id = ? AND utilisateur_id = ?');
    $stmt->execute([$id, $userId]);
    if ($stmt->rowCount() === 0) reponseJSON(false, null, 'Catégorie introuvable', 404);
    reponseJSON(true, null, 'Catégorie supprimée');
}
