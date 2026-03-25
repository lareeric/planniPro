<?php
// ============================================================
// toggle_fait.php -- Cocher / decocher un evenement comme fait
// POST { id: int } -> bascule le statut fait/non fait
// ============================================================
require_once 'config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

$userId = verifierSession();
$corps  = json_decode(file_get_contents('php://input'), true) ?? [];
$db     = getDB();

$id = (int) ($corps['id'] ?? 0);
if (!$id) {
    reponseJSON(false, null, 'ID manquant', 422);
}

// Verifier que l'evenement appartient bien a l'utilisateur
$stmt = $db->prepare('SELECT id, fait FROM evenements WHERE id = ? AND utilisateur_id = ?');
$stmt->execute([$id, $userId]);
$ev = $stmt->fetch();

if (!$ev) {
    reponseJSON(false, null, 'Evenement introuvable', 404);
}

// Basculer le statut (0 -> 1 ou 1 -> 0)
$nouveauStatut = $ev['fait'] ? 0 : 1;

$upd = $db->prepare('UPDATE evenements SET fait = ?, updated_at = NOW() WHERE id = ?');
$upd->execute([$nouveauStatut, $id]);

reponseJSON(true, [
    'id'   => $id,
    'fait' => (bool) $nouveauStatut,
], $nouveauStatut ? 'Evenement marque comme fait' : 'Evenement marque comme non fait');
