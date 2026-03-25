<?php
// ============================================================
// stripe_config.php — Clés et constantes Stripe
// ============================================================

// 🔑 Remplace par tes vraies clés depuis https://dashboard.stripe.com/apikeys
define('STRIPE_SECRET_KEY',      'mk_1TEQ2pKpErnElflDdbRWEYd2');
define('STRIPE_PUBLISHABLE_KEY', 'mk_1TEI8TKpErnElflDXJvUXnQH');
define('STRIPE_WEBHOOK_SECRET',  'whsec_XxN1B0Ligz9g0CRYtQQiXxBShycQ5aUJ');  // depuis le dashboard Stripe > Webhooks

// 💳 ID du prix créé dans ton dashboard Stripe
// Dashboard > Produits > Créer un produit "PlanniPro Pro" > Prix récurrent 9$/mois
define('STRIPE_PRICE_ID', 'price_1TEQAqKpErnElflDjLDO6W7s');

// 🌐 URL de base de ton site (sans slash final)
define('APP_URL', 'http://localhost/emploi-du-temps');

// Plans disponibles
define('PLAN_FREE', 'free');
define('PLAN_PRO',  'pro');

// Limites du plan gratuit
define('FREE_MAX_CATEGORIES', 3);
define('FREE_MAX_EVENEMENTS', 50);  // par mois