<?php
// ============================================================
// abonnement.php — Gestion Stripe (checkout, webhook, annulation)
// ============================================================
require_once 'config.php';
require_once 'stripe_config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Stripe-Signature');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

// ── Chargement de la bibliothèque Stripe ──────────────────
// Installation via Composer : composer require stripe/stripe-php
$autoload = __DIR__ . '/../vendor/autoload.php';
if (!file_exists($autoload)) {
    http_response_code(500);
    die(json_encode(['succes' => false, 'message' => 'Stripe SDK manquant. Lancez : composer require stripe/stripe-php']));
}
require_once $autoload;
\Stripe\Stripe::setApiKey(STRIPE_SECRET_KEY);

$methode = $_SERVER['REQUEST_METHOD'];
$corps   = json_decode(file_get_contents('php://input'), true) ?? [];
$action  = $corps['action'] ?? $_GET['action'] ?? '';

// ===========================================================
// Webhook Stripe (pas de session requise — Stripe appelle ce endpoint)
// ===========================================================
if ($action === 'webhook') {
    gererWebhook();
    exit;
}

// ===========================================================
// Routes protégées (session requise)
// ===========================================================
$userId = verifierSession();
$db     = getDB();

switch ($action) {

    // ── Créer une session de paiement Checkout ────────────
    case 'creer_checkout':
        creerCheckout($db, $userId);
        break;

    // ── Portail client (gérer/annuler l'abonnement) ───────
    case 'portail_client':
        ouvrirPortailClient($db, $userId);
        break;

    // ── Infos plan de l'utilisateur connecté ─────────────
    case 'infos_plan':
        require_once 'plan_limits.php';
        reponseJSON(true, getInfosPlan($userId));
        break;

    // ── Annuler l'abonnement ──────────────────────────────
    case 'annuler':
        annulerAbonnement($db, $userId);
        break;

    default:
        reponseJSON(false, null, 'Action inconnue', 400);
}

// ===========================================================
// Fonctions
// ===========================================================

/**
 * Crée une session Stripe Checkout et retourne l'URL de paiement.
 */
function creerCheckout(PDO $db, int $userId): void
{
    $stmt = $db->prepare('SELECT nom, prenom, email, stripe_customer_id FROM utilisateurs WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) reponseJSON(false, null, 'Utilisateur introuvable', 404);

    // Créer ou réutiliser le customer Stripe
    $customerId = $user['stripe_customer_id'];
    if (!$customerId) {
        $customer = \Stripe\Customer::create([
            'name'  => $user['prenom'] . ' ' . $user['nom'],
            'email' => $user['email'],
            'metadata' => ['utilisateur_id' => $userId],
        ]);
        $customerId = $customer->id;
        $db->prepare('UPDATE utilisateurs SET stripe_customer_id = ? WHERE id = ?')
           ->execute([$customerId, $userId]);
    }

    // Créer la session Checkout
    $session = \Stripe\Checkout\Session::create([
        'customer'            => $customerId,
        'mode'                => 'subscription',
        'payment_method_types' => ['card'],
        'line_items'          => [[
            'price'    => STRIPE_PRICE_ID,
            'quantity' => 1,
        ]],
        'success_url' => APP_URL . '/app.html?paiement=succes',
        'cancel_url'  => APP_URL . '/app.html?paiement=annule',
        'metadata'    => ['utilisateur_id' => $userId],
        'subscription_data' => [
            'metadata' => ['utilisateur_id' => $userId],
        ],
    ]);

    reponseJSON(true, ['checkout_url' => $session->url], 'Session créée');
}

/**
 * Ouvre le portail client Stripe (gestion de l'abonnement).
 */
function ouvrirPortailClient(PDO $db, int $userId): void
{
    $stmt = $db->prepare('SELECT stripe_customer_id FROM utilisateurs WHERE id = ?');
    $stmt->execute([$userId]);
    $row  = $stmt->fetch();

    if (empty($row['stripe_customer_id'])) {
        reponseJSON(false, null, 'Aucun abonnement actif trouvé', 404);
    }

    $session = \Stripe\BillingPortal\Session::create([
        'customer'   => $row['stripe_customer_id'],
        'return_url' => APP_URL . '/app.html',
    ]);

    reponseJSON(true, ['portal_url' => $session->url], 'Portail ouvert');
}

/**
 * Annule l'abonnement en fin de période (pas immédiatement).
 */
function annulerAbonnement(PDO $db, int $userId): void
{
    $stmt = $db->prepare('SELECT stripe_sub_id FROM utilisateurs WHERE id = ?');
    $stmt->execute([$userId]);
    $row  = $stmt->fetch();

    if (empty($row['stripe_sub_id'])) {
        reponseJSON(false, null, 'Aucun abonnement actif', 404);
    }

    // cancel_at_period_end = l'accès reste jusqu'à la fin de la période payée
    \Stripe\Subscription::update($row['stripe_sub_id'], [
        'cancel_at_period_end' => true,
    ]);

    reponseJSON(true, null, 'Abonnement annulé. Votre accès Pro reste actif jusqu\'à la fin de la période.');
}

/**
 * Gère les événements Webhook envoyés par Stripe.
 * Endpoint : POST /php/abonnement.php?action=webhook
 */
function gererWebhook(): void
{
    $payload   = file_get_contents('php://input');
    $sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

    try {
        $event = \Stripe\Webhook::constructEvent($payload, $sigHeader, STRIPE_WEBHOOK_SECRET);
    } catch (\Stripe\Exception\SignatureVerificationException $e) {
        http_response_code(400);
        exit('Signature invalide');
    }

    $db = getDB();

    switch ($event->type) {

        // ── Paiement réussi → activer Pro ─────────────────
        case 'invoice.payment_succeeded':
            $invoice    = $event->data->object;
            $customerId = $invoice->customer;
            $subId      = $invoice->subscription;
            $montant    = $invoice->amount_paid / 100;
            $devise     = strtoupper($invoice->currency);

            // Trouver l'utilisateur via stripe_customer_id
            $stmt = $db->prepare('SELECT id FROM utilisateurs WHERE stripe_customer_id = ?');
            $stmt->execute([$customerId]);
            $user = $stmt->fetch();
            if (!$user) break;

            $userId   = $user['id'];
            $expireAt = date('Y-m-d H:i:s', $invoice->lines->data[0]->period->end ?? time() + 2592000);

            // Activer le plan Pro
            $db->prepare("UPDATE utilisateurs SET plan = 'pro', stripe_sub_id = ?, plan_expire_at = ? WHERE id = ?")
               ->execute([$subId, $expireAt, $userId]);

            // Enregistrer le paiement
            $db->prepare("INSERT INTO paiements (utilisateur_id, stripe_payment_id, montant, devise, statut) VALUES (?,?,?,?,'paid')")
               ->execute([$userId, $invoice->payment_intent ?? $invoice->id, $montant, $devise]);
            break;

        // ── Paiement échoué → laisser en free ────────────
        case 'invoice.payment_failed':
            $customerId = $event->data->object->customer;
            $stmt = $db->prepare('SELECT id FROM utilisateurs WHERE stripe_customer_id = ?');
            $stmt->execute([$customerId]);
            $user = $stmt->fetch();
            if ($user) {
                $db->prepare("UPDATE utilisateurs SET plan = 'free', stripe_sub_id = NULL, plan_expire_at = NULL WHERE id = ?")
                   ->execute([$user['id']]);
            }
            break;

        // ── Abonnement annulé / expiré ────────────────────
        case 'customer.subscription.deleted':
            $sub        = $event->data->object;
            $customerId = $sub->customer;
            $stmt = $db->prepare('SELECT id FROM utilisateurs WHERE stripe_customer_id = ?');
            $stmt->execute([$customerId]);
            $user = $stmt->fetch();
            if ($user) {
                $db->prepare("UPDATE utilisateurs SET plan = 'free', stripe_sub_id = NULL, plan_expire_at = NULL WHERE id = ?")
                   ->execute([$user['id']]);
            }
            break;
    }

    http_response_code(200);
    echo json_encode(['received' => true]);
}