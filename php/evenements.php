<?php
// ============================================================
// evenements.php — CRUD complet des événements + toggle fait
// ============================================================
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

// ===========================================================
// GET — Récupérer les événements sur une période
// ===========================================================
if ($methode === 'GET') {

    $debut = $_GET['debut'] ?? date('Y-m-01');
    $fin   = $_GET['fin']   ?? date('Y-m-t');

    // Validation stricte du format des dates
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $debut)) $debut = date('Y-m-01');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fin))   $fin   = date('Y-m-t');

    // Sécurité : éviter que fin < debut
    if ($fin < $debut) $fin = $debut;

    $sql = "SELECT
                e.id,
                e.utilisateur_id,
                e.categorie_id,
                e.titre,
                e.description,
                e.lieu,
                e.couleur,
                e.fait,
                e.recurrence,
                e.recurrence_fin,
                DATE_FORMAT(e.date_debut, '%Y-%m-%d') AS date_debut,
                DATE_FORMAT(e.date_fin,   '%Y-%m-%d') AS date_fin,
                IF(e.heure_debut IS NOT NULL, TIME_FORMAT(e.heure_debut, '%H:%i'), NULL) AS heure_debut,
                IF(e.heure_fin   IS NOT NULL, TIME_FORMAT(e.heure_fin,   '%H:%i'), NULL) AS heure_fin,
                e.created_at,
                e.updated_at,
                c.nom     AS categorie_nom,
                c.couleur AS categorie_couleur
            FROM evenements e
            LEFT JOIN categories c ON c.id = e.categorie_id
            WHERE e.utilisateur_id = :userId
              AND (
                -- Événements non récurrents qui chevauchent la période
                (e.recurrence = 'aucune' AND e.date_debut <= :fin AND e.date_fin >= :debut)
                OR
                -- Événements récurrents dont la série commence avant la fin de la période
                (e.recurrence != 'aucune'
                    AND e.date_debut <= :fin2
                    AND (e.recurrence_fin IS NULL OR e.recurrence_fin >= :debut2)
                )
              )
            ORDER BY e.date_debut ASC, e.heure_debut ASC";

    $stmt = $db->prepare($sql);
    $stmt->execute([
        ':userId' => $userId,
        ':fin'    => $fin,
        ':debut'  => $debut,
        ':fin2'   => $fin,
        ':debut2' => $debut,
    ]);
    $evenements = $stmt->fetchAll();

    // Expansion des récurrences
    $resultat = [];
    foreach ($evenements as $ev) {
        if ($ev['recurrence'] === 'aucune') {
            $resultat[] = $ev;
        } else {
            $occurrences = expanderRecurrence($ev, $debut, $fin);
            $resultat    = array_merge($resultat, $occurrences);
        }
    }

    // Tri final par date + heure après expansion
    usort($resultat, function ($a, $b) {
        $cmp = strcmp($a['date_debut'], $b['date_debut']);
        if ($cmp !== 0) return $cmp;
        // Les événements sans heure passent en premier
        $ha = $a['heure_debut'] ?? '00:00';
        $hb = $b['heure_debut'] ?? '00:00';
        return strcmp($ha, $hb);
    });

    reponseJSON(true, $resultat);
}

// ===========================================================
// POST — Créer un événement
// ===========================================================
if ($methode === 'POST') {

    // Cas spécial : toggle fait/non-fait (appelé depuis toggle_fait.php aussi)
    if (isset($corps['action']) && $corps['action'] === 'toggle_fait') {
        toggleFaitEvenement($db, $userId, (int)($corps['id'] ?? 0));
    }

    $donnees = validerEvenement($corps);
    if (isset($donnees['erreur'])) {
        reponseJSON(false, null, $donnees['erreur'], 422);
    }

    $stmt = $db->prepare("
        INSERT INTO evenements
            (utilisateur_id, categorie_id, titre, description,
             date_debut, heure_debut, date_fin, heure_fin,
             recurrence, recurrence_fin, lieu, couleur)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $userId,
        $donnees['categorie_id'],
        $donnees['titre'],
        $donnees['description'],
        $donnees['date_debut'],
        $donnees['heure_debut'],
        $donnees['date_fin'],
        $donnees['heure_fin'],
        $donnees['recurrence'],
        $donnees['recurrence_fin'],
        $donnees['lieu'],
        $donnees['couleur'],
    ]);

    $id  = (int) $db->lastInsertId();
    $row = selectEvenement($db, $id);
    reponseJSON(true, $row, 'Événement créé', 201);
}

// ===========================================================
// PUT — Modifier un événement
// ===========================================================
if ($methode === 'PUT') {

    $id = (int) ($corps['id'] ?? 0);
    if (!$id) reponseJSON(false, null, 'ID manquant', 422);

    // Vérifier que l'événement appartient à l'utilisateur connecté
    if (!appartientAUtilisateur($db, $id, $userId)) {
        reponseJSON(false, null, 'Événement introuvable ou accès refusé', 404);
    }

    $donnees = validerEvenement($corps);
    if (isset($donnees['erreur'])) {
        reponseJSON(false, null, $donnees['erreur'], 422);
    }

    $stmt = $db->prepare("
        UPDATE evenements SET
            categorie_id   = ?,
            titre          = ?,
            description    = ?,
            date_debut     = ?,
            heure_debut    = ?,
            date_fin       = ?,
            heure_fin      = ?,
            recurrence     = ?,
            recurrence_fin = ?,
            lieu           = ?,
            couleur        = ?,
            updated_at     = NOW()
        WHERE id = ? AND utilisateur_id = ?
    ");
    $stmt->execute([
        $donnees['categorie_id'],
        $donnees['titre'],
        $donnees['description'],
        $donnees['date_debut'],
        $donnees['heure_debut'],
        $donnees['date_fin'],
        $donnees['heure_fin'],
        $donnees['recurrence'],
        $donnees['recurrence_fin'],
        $donnees['lieu'],
        $donnees['couleur'],
        $id,
        $userId,
    ]);

    $row = selectEvenement($db, $id);
    reponseJSON(true, $row, 'Événement modifié');
}

// ===========================================================
// DELETE — Supprimer un événement
// ===========================================================
if ($methode === 'DELETE') {

    // Supporte le corps JSON ET les paramètres GET
    $id = (int) ($corps['id'] ?? $_GET['id'] ?? 0);
    if (!$id) reponseJSON(false, null, 'ID manquant', 422);

    // Vérifier la propriété avant suppression
    if (!appartientAUtilisateur($db, $id, $userId)) {
        reponseJSON(false, null, 'Événement introuvable ou accès refusé', 404);
    }

    $stmt = $db->prepare('DELETE FROM evenements WHERE id = ? AND utilisateur_id = ?');
    $stmt->execute([$id, $userId]);

    reponseJSON(true, null, 'Événement supprimé');
}

// ===========================================================
// Fonctions utilitaires
// ===========================================================

/**
 * Vérifie qu'un événement appartient bien à un utilisateur donné.
 */
function appartientAUtilisateur(PDO $db, int $id, int $userId): bool
{
    $stmt = $db->prepare('SELECT id FROM evenements WHERE id = ? AND utilisateur_id = ?');
    $stmt->execute([$id, $userId]);
    return (bool) $stmt->fetch();
}

/**
 * Retourne un événement complet avec sa catégorie.
 */
function selectEvenement(PDO $db, int $id): array|false
{
    $stmt = $db->prepare("
        SELECT
            e.id, e.utilisateur_id, e.categorie_id,
            e.titre, e.description, e.lieu, e.couleur, e.fait,
            e.recurrence, e.recurrence_fin,
            DATE_FORMAT(e.date_debut, '%Y-%m-%d') AS date_debut,
            DATE_FORMAT(e.date_fin,   '%Y-%m-%d') AS date_fin,
            IF(e.heure_debut IS NOT NULL, TIME_FORMAT(e.heure_debut, '%H:%i'), NULL) AS heure_debut,
            IF(e.heure_fin   IS NOT NULL, TIME_FORMAT(e.heure_fin,   '%H:%i'), NULL) AS heure_fin,
            e.created_at,
            c.nom     AS categorie_nom,
            c.couleur AS categorie_couleur
        FROM evenements e
        LEFT JOIN categories c ON c.id = e.categorie_id
        WHERE e.id = ?
    ");
    $stmt->execute([$id]);
    return $stmt->fetch();
}

/**
 * Bascule l'état fait/non-fait d'un événement.
 * Répond directement en JSON.
 */
function toggleFaitEvenement(PDO $db, int $userId, int $id): void
{
    if (!$id) reponseJSON(false, null, 'ID manquant', 422);

    if (!appartientAUtilisateur($db, $id, $userId)) {
        reponseJSON(false, null, 'Événement introuvable ou accès refusé', 404);
    }

    // Récupère l'état actuel puis inverse
    $stmt = $db->prepare('SELECT fait FROM evenements WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();

    if (!$row) reponseJSON(false, null, 'Événement introuvable', 404);

    $nouveauFait = $row['fait'] ? 0 : 1;

    $upd = $db->prepare('UPDATE evenements SET fait = ?, updated_at = NOW() WHERE id = ? AND utilisateur_id = ?');
    $upd->execute([$nouveauFait, $id, $userId]);

    reponseJSON(true, ['id' => $id, 'fait' => $nouveauFait], $nouveauFait ? 'Marqué comme fait' : 'Marqué comme non fait');
}

/**
 * Valide et nettoie les données d'un événement.
 * Retourne un tableau propre ou ['erreur' => '...'].
 */
function validerEvenement(array $d): array
{
    // Titre obligatoire
    $titre = trim($d['titre'] ?? '');
    if ($titre === '')        return ['erreur' => 'Le titre est requis'];
    if (strlen($titre) > 200) return ['erreur' => 'Titre trop long (200 caractères max)'];

    // Dates
    $dateDebut = $d['date_debut'] ?? '';
    $dateFin   = $d['date_fin']   ?? $dateDebut;

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateDebut)) return ['erreur' => 'Date de début invalide'];
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFin))   return ['erreur' => 'Date de fin invalide'];
    if ($dateFin < $dateDebut)                              return ['erreur' => 'La date de fin doit être ≥ à la date de début'];

    // Heures (format HH:MM strict)
    $heureDebut = null;
    $heureFin   = null;
    if (!empty($d['heure_debut']) && preg_match('/^\d{2}:\d{2}$/', $d['heure_debut'])) {
        $heureDebut = $d['heure_debut'];
    }
    if (!empty($d['heure_fin']) && preg_match('/^\d{2}:\d{2}$/', $d['heure_fin'])) {
        $heureFin = $d['heure_fin'];
    }
    // Si même jour, heure de fin doit être après heure de début
    if ($dateDebut === $dateFin && $heureDebut && $heureFin && $heureFin <= $heureDebut) {
        return ['erreur' => 'L\'heure de fin doit être après l\'heure de début'];
    }

    // Récurrence
    $recurrencesValides = ['aucune', 'quotidien', 'hebdomadaire', 'mensuel', 'annuel'];
    $recurrence = in_array($d['recurrence'] ?? 'aucune', $recurrencesValides)
        ? ($d['recurrence'] ?? 'aucune')
        : 'aucune';

    $recurrenceFin = null;
    if ($recurrence !== 'aucune' && !empty($d['recurrence_fin'])) {
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $d['recurrence_fin'])
            && $d['recurrence_fin'] >= $dateDebut) {
            $recurrenceFin = $d['recurrence_fin'];
        }
    }

    // Couleur hexadécimale
    $couleur = preg_match('/^#[0-9a-fA-F]{6}$/', $d['couleur'] ?? '') ? $d['couleur'] : null;

    return [
        'categorie_id'   => !empty($d['categorie_id']) ? (int) $d['categorie_id'] : null,
        'titre'          => htmlspecialchars($titre, ENT_QUOTES, 'UTF-8'),
        'description'    => htmlspecialchars(trim($d['description'] ?? ''), ENT_QUOTES, 'UTF-8'),
        'date_debut'     => $dateDebut,
        'heure_debut'    => $heureDebut,
        'date_fin'       => $dateFin,
        'heure_fin'      => $heureFin,
        'recurrence'     => $recurrence,
        'recurrence_fin' => $recurrenceFin,
        'lieu'           => htmlspecialchars(trim($d['lieu'] ?? ''), ENT_QUOTES, 'UTF-8'),
        'couleur'        => $couleur,
    ];
}

/**
 * Génère toutes les occurrences d'un événement récurrent
 * dans la fenêtre [debut, fin].
 */
function expanderRecurrence(array $ev, string $debut, string $fin): array
{
    $occurrences  = [];
    $debutPeriode = new DateTime($debut);
    $finPeriode   = new DateTime($fin);

    $current = new DateTime($ev['date_debut']);
    $dtFin   = new DateTime($ev['date_fin']);

    // Sécurité : date_fin ne peut pas précéder date_debut
    if ($dtFin < $current) $dtFin = clone $current;
    $duree = $current->diff($dtFin); // durée de l'événement

    // La récurrence s'arrête à la fin définie ou à la fin de la période
    $finRecurrence = !empty($ev['recurrence_fin'])
        ? new DateTime($ev['recurrence_fin'])
        : $finPeriode;
    $limite = min($finPeriode, $finRecurrence);

    $max = 500; // garde-fou anti-boucle infinie
    $i   = 0;

    while ($current <= $limite && $i++ < $max) {
        $currentFin = clone $current;
        $currentFin->add($duree);

        // N'ajouter que si l'occurrence chevauche la période demandée
        if ($currentFin >= $debutPeriode && $current <= $finPeriode) {
            $occ                  = $ev;
            $occ['date_debut']    = $current->format('Y-m-d');
            $occ['date_fin']      = $currentFin->format('Y-m-d');
            $occ['id_occurrence'] = $ev['id'] . '_' . $current->format('Ymd');
            $occurrences[]        = $occ;
        }

        // Avancer selon le type de récurrence
        switch ($ev['recurrence']) {
            case 'quotidien':    $current->modify('+1 day');   break;
            case 'hebdomadaire': $current->modify('+1 week');  break;
            case 'mensuel':      $current->modify('+1 month'); break;
            case 'annuel':       $current->modify('+1 year');  break;
            default:             break 2;
        }
    }

    return $occurrences;
}