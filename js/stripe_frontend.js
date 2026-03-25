// ============================================================
// stripe_frontend.js — Gestion Pro / Freemium côté client
// À inclure dans app.html : <script src="js/stripe_frontend.js"></script>
// ============================================================

const Stripe_UI = (() => {

  // ── Charger les infos du plan au démarrage ────────────────
  async function chargerPlan() {
    try {
      const res = await fetch('php/abonnement.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'infos_plan' }),
      });
      const data = await res.json();
      if (data.succes) {
        afficherBadgePlan(data.donnees);
        afficherBoutonSidebar(data.donnees);
        // Stocker globalement pour vérifications
        window.__plan = data.donnees;
      }
    } catch (e) {
      console.warn('Impossible de charger le plan :', e);
    }
  }

  // ── Badge dans le header ──────────────────────────────────
  function afficherBadgePlan(plan) {
    // Supprimer un badge existant
    const ancien = document.getElementById('plan-badge');
    if (ancien) ancien.remove();

    const estPro  = plan.est_pro;
    const badge   = document.createElement('div');
    badge.id      = 'plan-badge';
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: .72rem;
      font-weight: 700;
      letter-spacing: .04em;
      cursor: ${estPro ? 'default' : 'pointer'};
      background: ${estPro ? 'linear-gradient(135deg,#f59e0b,#d97706)' : '#e5e7eb'};
      color: ${estPro ? '#fff' : '#6b7280'};
      margin-left: 10px;
      transition: opacity .2s;
    `;
    badge.innerHTML = estPro ? '⭐ PRO' : '🔓 FREE';
    badge.title     = estPro
      ? `Plan Pro actif${plan.expire_at ? ' jusqu\'au ' + new Date(plan.expire_at).toLocaleDateString('fr-FR') : ''}`
      : 'Passer à Pro pour débloquer toutes les fonctionnalités';

    if (!estPro) {
      badge.addEventListener('click', ouvrirModalPro);
      badge.addEventListener('mouseenter', () => badge.style.opacity = '.8');
      badge.addEventListener('mouseleave', () => badge.style.opacity = '1');
    }

    // Insérer dans le header à côté du nom utilisateur
    const userSection = document.getElementById('user-name');
    if (userSection) userSection.after(badge);
  }

  // ── Bouton dans la sidebar ────────────────────────────────
  function afficherBoutonSidebar(plan) {
    const ancien = document.getElementById('sidebar-upgrade-btn');
    if (ancien) ancien.remove();

    if (plan.est_pro) {
      // Afficher juste une info "Plan Pro actif"
      const info = document.createElement('div');
      info.id = 'sidebar-upgrade-btn';
      info.style.cssText = `
        margin: 12px;
        padding: 10px 14px;
        border-radius: 10px;
        background: linear-gradient(135deg,#fef3c7,#fde68a);
        color: #92400e;
        font-size: .78rem;
        font-weight: 600;
        text-align: center;
      `;
      info.innerHTML = `⭐ Plan Pro actif<br><span style="font-weight:400;font-size:.72rem">Merci pour votre soutien !</span>`;
      insertSidebarBottom(info);
      return;
    }

    // Bouton upgrade
    const btn = document.createElement('button');
    btn.id    = 'sidebar-upgrade-btn';
    btn.style.cssText = `
      margin: 12px;
      width: calc(100% - 24px);
      padding: 11px 14px;
      border-radius: 10px;
      border: none;
      background: linear-gradient(135deg,#f59e0b,#d97706);
      color: #fff;
      font-size: .82rem;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
      box-shadow: 0 2px 8px rgba(245,158,11,.35);
      transition: transform .15s, box-shadow .15s;
    `;
    btn.innerHTML = `⚡ Passer à Pro — 9$/mois`;

    // Limites affichées sous le bouton
    const limites = document.createElement('div');
    limites.style.cssText = `
      margin: 0 12px 12px;
      font-size: .7rem;
      color: var(--ink-faint, #9ca3af);
      text-align: center;
      line-height: 1.5;
    `;
    const nbCats = plan.categories?.utilisees ?? 0;
    const maxCats = plan.categories?.max ?? 3;
    limites.innerHTML = `
      ${nbCats}/${maxCats} catégories utilisées<br>
      🔒 Récurrence &nbsp;|&nbsp; 🔒 Export PDF &nbsp;|&nbsp; 🔒 Partage
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform  = 'translateY(-1px)';
      btn.style.boxShadow  = '0 4px 14px rgba(245,158,11,.5)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform  = '';
      btn.style.boxShadow  = '0 2px 8px rgba(245,158,11,.35)';
    });
    btn.addEventListener('click', ouvrirModalPro);

    insertSidebarBottom(btn);
    insertSidebarBottom(limites);
  }

  function insertSidebarBottom(el) {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.appendChild(el);
  }

  // ── Modal "Passer à Pro" ──────────────────────────────────
  function ouvrirModalPro() {
    fermerModalPro();

    const overlay = document.createElement('div');
    overlay.id    = 'modal-pro-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999;
      animation: fadeIn .2s ease;
    `;

    overlay.innerHTML = `
      <div style="
        background: #fff;
        border-radius: 18px;
        width: 100%;
        max-width: 420px;
        margin: 16px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0,0,0,.2);
        animation: slideUp .25s ease;
      ">
        <!-- Header dégradé -->
        <div style="
          background: linear-gradient(135deg,#f59e0b,#d97706);
          padding: 28px 28px 22px;
          text-align: center;
          color: #fff;
        ">
          <div style="font-size: 2.2rem; margin-bottom: 6px;">⭐</div>
          <div style="font-size: 1.4rem; font-weight: 800; margin-bottom: 4px;">Passez à PlanniPro Pro</div>
          <div style="font-size: .88rem; opacity: .9;">Débloquez toutes les fonctionnalités</div>
        </div>

        <!-- Prix -->
        <div style="text-align:center; padding: 20px 28px 0;">
          <span style="font-size:2.4rem; font-weight:800; color:#111;">9$</span>
          <span style="color:#6b7280; font-size:.9rem;">/mois · Annulable à tout moment</span>
        </div>

        <!-- Fonctionnalités -->
        <div style="padding: 18px 28px;">
          ${[
            ['✅', 'Catégories illimitées', 'Plus de limite à 3 catégories'],
            ['✅', 'Récurrence des événements', 'Quotidien, hebdo, mensuel, annuel'],
            ['✅', 'Export PDF du calendrier', 'Imprimez et partagez votre planning'],
            ['✅', 'Partage de calendrier', 'Collaborez avec votre équipe'],
            ['✅', 'Support prioritaire', 'Réponse en moins de 24h'],
          ].map(([icon, titre, desc]) => `
            <div style="display:flex; gap:12px; align-items:flex-start; margin-bottom:12px;">
              <span style="font-size:1rem; margin-top:1px;">${icon}</span>
              <div>
                <div style="font-weight:600; font-size:.88rem; color:#111;">${titre}</div>
                <div style="font-size:.78rem; color:#6b7280;">${desc}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Boutons -->
        <div style="padding: 0 28px 24px; display:flex; flex-direction:column; gap:10px;">
          <button id="btn-checkout-stripe" style="
            padding: 13px;
            border-radius: 10px;
            border: none;
            background: linear-gradient(135deg,#f59e0b,#d97706);
            color: #fff;
            font-size: .95rem;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(245,158,11,.4);
            transition: opacity .2s;
          ">
            ⚡ S'abonner maintenant — 9$/mois
          </button>
          <button id="btn-fermer-pro" style="
            padding: 11px;
            border-radius: 10px;
            border: 1.5px solid #e5e7eb;
            background: #fff;
            color: #6b7280;
            font-size: .88rem;
            cursor: pointer;
          ">
            Continuer avec le plan gratuit
          </button>
        </div>

        <!-- Garantie -->
        <div style="
          text-align:center;
          padding: 0 28px 20px;
          font-size: .72rem;
          color: #9ca3af;
        ">
          🔒 Paiement sécurisé par Stripe · Pas d'engagement · Annulable à tout moment
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Bouton payer
    overlay.querySelector('#btn-checkout-stripe').addEventListener('click', lancerCheckout);
    // Bouton fermer
    overlay.querySelector('#btn-fermer-pro').addEventListener('click', fermerModalPro);
    // Clic en dehors
    overlay.addEventListener('click', e => { if (e.target === overlay) fermerModalPro(); });
    // Escape
    document.addEventListener('keydown', _escModalPro);
  }

  function _escModalPro(e) {
    if (e.key === 'Escape') fermerModalPro();
  }

  function fermerModalPro() {
    const m = document.getElementById('modal-pro-overlay');
    if (m) m.remove();
    document.removeEventListener('keydown', _escModalPro);
  }

  // ── Lancer le Checkout Stripe ─────────────────────────────
  async function lancerCheckout() {
    const btn = document.getElementById('btn-checkout-stripe');
    if (btn) { btn.disabled = true; btn.textContent = 'Redirection vers Stripe…'; }

    try {
      const res = await fetch('php/abonnement.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'creer_checkout' }),
      });
      const data = await res.json();
      if (data.succes && data.donnees?.checkout_url) {
        window.location.href = data.donnees.checkout_url;
      } else {
        alert(data.message || 'Erreur lors de la création du paiement.');
        if (btn) { btn.disabled = false; btn.textContent = '⚡ S\'abonner maintenant — 9$/mois'; }
      }
    } catch (e) {
      alert('Erreur réseau. Réessayez.');
      if (btn) { btn.disabled = false; btn.textContent = '⚡ S\'abonner maintenant — 9$/mois'; }
    }
  }

  // ── Vérifier si une fonctionnalité est autorisée ──────────
  function verifierAccesPro(fonctionnalite) {
    const plan = window.__plan;
    if (!plan || plan.est_pro) return true; // Pro ou plan non chargé = accès OK

    const droits = {
      'recurrence': plan.droits?.recurrence,
      'export_pdf': plan.droits?.export_pdf,
      'partage':    plan.droits?.partage,
    };

    if (droits[fonctionnalite] === false) {
      ouvrirModalPro();
      return false;
    }
    return true;
  }

  // ── Gérer le retour après paiement ────────────────────────
  function gererRetourPaiement() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('paiement') === 'succes') {
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname);
      // Toast de succès
      setTimeout(() => {
        if (window.App?.toast) {
          App.toast('🎉 Bienvenue dans PlanniPro Pro ! Toutes les fonctionnalités sont débloquées.', 'success');
        }
        chargerPlan(); // Recharger le badge
      }, 500);
    }
    if (params.get('paiement') === 'annule') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    gererRetourPaiement();
    chargerPlan();
  }

  return { init, ouvrirModalPro, verifierAccesPro, chargerPlan };
})();

// Lancer après le chargement de l'app
document.addEventListener('DOMContentLoaded', () => {
  // Attendre que l'auth soit vérifiée (1 seconde max)
  setTimeout(Stripe_UI.init, 800);
});