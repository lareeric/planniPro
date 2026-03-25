<?php
// ============================================================
// plan_limits.php — Vérification des limites selon le plan
// ============================================================
require_once 'config.php';
require_once 'stripe_config.php';

/**
 * Retourne le plan actuel de l'utilisateur ('free' ou 'pro').
 * Vérifie aussi que l'abonnement n'est pas expiré.
 */
function getPlanUtilisateur(int $userId): string
{
    $db   = getDB();
    $stmt = $db->prepare('SELECT plan, plan_expire_at FROM utilisateurs WHERE id = ?');
    $stmt->execute([$userId]);
    $row  = $stmt->fetch();

    if (!$row) return PLAN_FREE;

    // Si Pro mais expiré → repasser en free automatiquement
    if ($row['plan'] === PLAN_PRO && !empty($row['plan_expire_at'])) {
        if (new DateTime($row['plan_expire_at']) < new DateTime()) {
            $db->prepare('UPDATE utilisateurs SET plan = ? WHERE id = ?')
               ->execute([PLAN_FREE, $userId]);
            return PLAN_FREE;
        }
    }

    return $row['plan'] ?? PLAN_FREE;
}

/**
 * Vérifie si l'utilisateur peut créer une nouvelle catégorie.
 * Répond en JSON avec erreur 403 si la limite est atteinte.
 */
function verifierLimiteCategories(int $userId): void
{
    if (getPlanUtilisateur($userId) === PLAN_PRO) return; // illimité

    $db   = getDB();
    $stmt = $db->prepare('SELECT COUNT(*) FROM categories WHERE utilisateur_id = ?');
    $stmt->execute([$userId]);
    $nb   = (int) $stmt->fetchColumn();

    if ($nb >= FREE_MAX_CATEGORIES) {
        reponseJSON(false, [
            'limite'  => true,
            'max'     => FREE_MAX_CATEGORIES,
            'upgrade' => true,
        ], 'Limite de ' . FREE_MAX_CATEGORIES . ' catégories atteinte. Passez à Pro pour en créer plus.', 403);
    }
}

/**
 * Vérifie si l'utilisateur peut utiliser la récurrence.
 * Répond en JSON avec erreur 403 si plan free.
 */
function verifierDroitRecurrence(int $userId): void
{
    if (getPlanUtilisateur($userId) === PLAN_FREE) {
        reponseJSON(false, [
            'limite'  => true,
            'upgrade' => true,
        ], 'La récurrence des événements est réservée au plan Pro.', 403);
    }
}

/**
 * Vérifie si l'utilisateur a le droit d'exporter en PDF.
 */
function verifierDroitExport(int $userId): void
{
    if (getPlanUtilisateur($userId) === PLAN_FREE) {
        reponseJSON(false, [
            'limite'  => true,
            'upgrade' => true,
        ], 'L\'export PDF est réservé au plan Pro.', 403);
    }
}

/**
 * Retourne un tableau d'infos sur le plan de l'utilisateur.
 * Utile pour le frontend (afficher badge, limites, etc.)
 */
function getInfosPlan(int $userId): array
{
    $plan = getPlanUtilisateur($userId);
    $db   = getDB();

    $stmt = $db->prepare('SELECT plan_expire_at, stripe_sub_id FROM utilisateurs WHERE id = ?');
    $stmt->execute([$userId]);
    $row  = $stmt->fetch();

    // Nombre de catégories actuelles
    $stmt2 = $db->prepare('SELECT COUNT(*) FROM categories WHERE utilisateur_id = ?');
    $stmt2->execute([$userId]);
    $nbCats = (int) $stmt2->fetchColumn();

    return [
        'plan'            => $plan,
        'est_pro'         => $plan === PLAN_PRO,
        'expire_at'       => $row['plan_expire_at'] ?? null,
        'abonnement_actif'=> !empty($row['stripe_sub_id']),
        'categories'      => [
            'utilisees' => $nbCats,
            'max'       => $plan === PLAN_PRO ? null : FREE_MAX_CATEGORIES, // null = illimité
        ],
        'droits' => [
            'recurrence' => $plan === PLAN_PRO,
            'export_pdf' => $plan === PLAN_PRO,
            'partage'    => $plan === PLAN_PRO,
        ],
    ];
}