// ============================================================
// panel.js — Panneau de contrôle complet des événements
// Contrôle total : voir, modifier, dupliquer, changer couleur,
//                  exporter, supprimer
// ============================================================

const Panel = (() => {
  const COULEURS = [
    '#ff6b35','#ff5f8a','#f5c842','#7c5cfc','#4299e1',
    '#00d4aa','#16a34a','#dc2626','#d97706','#0891b2',
    '#be185d','#6366f1','#84cc16','#f97316','#8b5cf6'
  ];

  let currentEv = null;

  // ── Ouvrir le panneau ──────────────────────────────────────
  function ouvrir(ev) {
    currentEv = ev;
    const panel = document.getElementById('event-detail-panel');

    // Couleur
    const couleur = ev.couleur || ev.categorie_couleur || '#4f46e5';
    document.getElementById('ev-panel-colorbar').style.background =
      `linear-gradient(90deg, ${couleur}, ${couleur}aa)`;

    // Titre + badge FAIT si coché
    const titreEl = document.getElementById('ev-panel-title');
    titreEl.textContent = ev.titre;
    titreEl.style.textDecoration = ev.fait ? 'line-through' : '';
    titreEl.style.opacity = ev.fait ? '0.6' : '1';

    // Catégorie badge
    const catEl = document.getElementById('ev-panel-cat');
    if (ev.categorie_nom) {
      catEl.style.cssText = `background:${couleur}18;color:${couleur};border:1px solid ${couleur}30;`;
      catEl.textContent = ev.categorie_nom;
      catEl.style.display = 'inline-flex';
    } else {
      catEl.style.display = 'none';
    }

    // Infos grid
    construireInfos(ev, couleur);

    // Description
    const descBlock = document.getElementById('ev-desc-block');
    const descText  = document.getElementById('ev-panel-desc');
    if (ev.description && ev.description.trim()) {
      descText.textContent = ev.description;
      descBlock.style.display = '';
    } else {
      descBlock.style.display = 'none';
    }

    // Reset couleurs rapides
    document.getElementById('ev-quick-colors').style.display = 'none';

    // Bouton "fait" - mettre a jour son etat
    const doneIcon  = document.getElementById('ev-done-icon');
    const doneLabel = document.getElementById('ev-done-label');
    const doneSub   = document.getElementById('ev-done-sub');
    if (doneIcon && doneLabel) {
      if (ev.fait) {
        doneIcon.textContent  = '✅';
        doneLabel.textContent = 'Marque comme fait';
        doneSub.textContent   = 'Cliquer pour annuler';
      } else {
        doneIcon.textContent  = '⬜';
        doneLabel.textContent = 'Marquer fait';
        doneSub.textContent   = 'Cocher comme termine';
      }
    }

    // Afficher
    panel.style.display = '';
    document.body.style.overflow = 'hidden';
  }

  function construireInfos(ev, couleur) {
    const grid = document.getElementById('ev-info-grid');
    grid.innerHTML = '';

    const dateDebut = formaterDate(ev.date_debut);
    const dateFin   = formaterDate(ev.date_fin);
    const memeJour  = ev.date_debut === ev.date_fin;

    // Dates
    const dateStr = memeJour
      ? dateDebut
      : `${dateDebut} → ${dateFin}`;
    ajouterInfo(grid, '📅', 'Date', dateStr);

    // Heures
    if (ev.heure_debut) {
      const heureStr = ev.heure_fin
        ? `${ev.heure_debut} – ${ev.heure_fin}`
        : `À partir de ${ev.heure_debut}`;
      ajouterInfo(grid, '🕐', 'Horaire', heureStr);

      if (ev.heure_debut && ev.heure_fin) {
        const duree = calculerDuree(ev.heure_debut, ev.heure_fin);
        if (duree) ajouterInfo(grid, '⏱', 'Durée', duree);
      }
    } else {
      ajouterInfo(grid, '🕐', 'Horaire', 'Toute la journée');
    }

    // Lieu
    if (ev.lieu) ajouterInfo(grid, '📍', 'Lieu', ev.lieu);

    // Récurrence
    if (ev.recurrence && ev.recurrence !== 'aucune') {
      const labels = { quotidien:'Quotidien', hebdomadaire:'Hebdomadaire', mensuel:'Mensuel', annuel:'Annuel' };
      let recStr = labels[ev.recurrence] || ev.recurrence;
      if (ev.recurrence_fin) recStr += ` jusqu'au ${formaterDate(ev.recurrence_fin)}`;
      ajouterInfo(grid, '🔄', 'Récurrence', recStr);
    }

    // Créé le
    if (ev.created_at) {
      const cree = new Date(ev.created_at).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
      ajouterInfo(grid, '🗓', 'Créé le', cree);
    }
  }

  function ajouterInfo(grid, icon, label, value) {
    const row = document.createElement('div');
    row.className = 'ev-info-row';
    row.innerHTML = `
      <span class="ev-info-icon">${icon}</span>
      <div class="ev-info-content">
        <div class="ev-info-label">${label}</div>
        <div class="ev-info-value">${value}</div>
      </div>`;
    grid.appendChild(row);
  }

  function formaterDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }

  function calculerDuree(debut, fin) {
    const [dh, dm] = debut.split(':').map(Number);
    const [fh, fm] = fin.split(':').map(Number);
    const diff = (fh*60+fm) - (dh*60+dm);
    if (diff <= 0) return null;
    const h = Math.floor(diff/60);
    const m = diff % 60;
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
  }

  // ── Fermer ─────────────────────────────────────────────────
  function fermer() {
    document.getElementById('event-detail-panel').style.display = 'none';
    document.body.style.overflow = '';
    currentEv = null;
  }

  // ── Dupliquer ──────────────────────────────────────────────
  async function dupliquer(ev) {
    const copie = {
      titre:          'Copie — ' + ev.titre,
      description:    ev.description,
      date_debut:     ev.date_debut,
      date_fin:       ev.date_fin,
      heure_debut:    ev.heure_debut,
      heure_fin:      ev.heure_fin,
      categorie_id:   ev.categorie_id,
      recurrence:     ev.recurrence,
      recurrence_fin: ev.recurrence_fin,
      lieu:           ev.lieu,
      couleur:        ev.couleur,
    };
    const res = await apiCall('php/evenements.php', 'POST', copie);
    if (res.succes) {
      toast('Événement dupliqué ✓', 'success');
      fermer();
      if (typeof App !== 'undefined' && App.recharger) App.recharger();
      else window.location.reload();
    } else {
      toast(res.message || 'Erreur', 'error');
    }
  }

  // ── Changer couleur rapide ─────────────────────────────────
  function toggleCouleurs() {
    const zone = document.getElementById('ev-quick-colors');
    const affiche = zone.style.display === 'none' || zone.style.display === '';

    if (affiche) {
      zone.style.display = '';
      const row = document.getElementById('ev-colors-row');
      row.innerHTML = '';
      const current = currentEv.couleur || currentEv.categorie_couleur || '#4f46e5';
      COULEURS.forEach(c => {
        const sw = document.createElement('div');
        sw.className = 'ev-color-swatch' + (c === current ? ' selected' : '');
        sw.style.background = c;
        sw.title = c;
        sw.addEventListener('click', () => changerCouleur(c));
        row.appendChild(sw);
      });
      // Couleur perso
      const custom = document.createElement('input');
      custom.type = 'color'; custom.className = 'ev-color-custom';
      custom.value = current;
      custom.addEventListener('input', e => changerCouleur(e.target.value));
      row.appendChild(custom);
    } else {
      zone.style.display = 'none';
    }
  }

  async function changerCouleur(couleur) {
    if (!currentEv) return;
    const res = await apiCall('php/evenements.php', 'PUT', {
      id: currentEv.id,
      titre: currentEv.titre,
      date_debut: currentEv.date_debut,
      date_fin: currentEv.date_fin,
      heure_debut: currentEv.heure_debut,
      heure_fin: currentEv.heure_fin,
      categorie_id: currentEv.categorie_id,
      recurrence: currentEv.recurrence,
      recurrence_fin: currentEv.recurrence_fin,
      lieu: currentEv.lieu,
      description: currentEv.description,
      couleur: couleur,
    });
    if (res.succes) {
      currentEv.couleur = couleur;
      toast('Couleur mise à jour ✓', 'success');
      document.getElementById('ev-panel-colorbar').style.background = `linear-gradient(90deg, ${couleur}, ${couleur}aa)`;
      document.getElementById('ev-quick-colors').style.display = 'none';
      if (typeof App !== 'undefined' && App.recharger) App.recharger();
    } else {
      toast(res.message || 'Erreur', 'error');
    }
  }

  // ── Exporter / copier infos ────────────────────────────────
  function exporter(ev) {
    const lignes = [
      `📌 ${ev.titre}`,
      `📅 Du ${formaterDate(ev.date_debut)} au ${formaterDate(ev.date_fin)}`,
    ];
    if (ev.heure_debut) lignes.push(`🕐 ${ev.heure_debut}${ev.heure_fin ? ' – ' + ev.heure_fin : ''}`);
    if (ev.lieu) lignes.push(`📍 ${ev.lieu}`);
    if (ev.categorie_nom) lignes.push(`🏷 ${ev.categorie_nom}`);
    if (ev.description) lignes.push(`📝 ${ev.description}`);

    navigator.clipboard.writeText(lignes.join('\n')).then(() => {
      toast('Infos copiées dans le presse-papiers ✓', 'success');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = lignes.join('\n');
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      toast('Infos copiées ✓', 'success');
    });
  }

  // ── Supprimer ──────────────────────────────────────────────
  async function supprimer(ev) {
    const id = typeof ev.id === 'string' && ev.id.includes('_') ? ev.id.split('_')[0] : ev.id;
    if (!confirm(`Supprimer définitivement « ${ev.titre} » ?\n\nCette action est irréversible.`)) return;
    const res = await apiCall('php/evenements.php', 'DELETE', { id: parseInt(id) });
    if (res.succes) {
      toast('Événement supprimé', 'success');
      fermer();
      if (typeof App !== 'undefined' && App.recharger) App.recharger();
      else window.location.reload();
    } else {
      toast(res.message || 'Erreur de suppression', 'error');
    }
  }

  // ── API helper ─────────────────────────────────────────────
  async function apiCall(url, methode, corps) {
    const opts = { method: methode, credentials: 'same-origin' };
    if (methode !== 'GET') {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(corps);
    }
    try {
      const res  = await fetch(url, opts);
      const text = await res.text();
      return JSON.parse(text);
    } catch(e) {
      return { succes: false, message: 'Erreur réseau' };
    }
  }

  // ── Toast ──────────────────────────────────────────────────
  function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`; el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => { el.classList.add('fade-out'); setTimeout(() => el.remove(), 320); }, 3000);
  }

  // ── Panel liste tous les événements ───────────────────────
  function ouvrirListe() {
    const panel = document.getElementById('ev-list-panel');
    panel.style.display = 'block';
    construireListe('');
  }
  function fermerListe() {
    document.getElementById('ev-list-panel').style.display = 'none';
  }

  function construireListe(filtre) {
    const zone = document.getElementById('ev-list-content');
    zone.innerHTML = '';

    // Récupérer tous les événements via API
    const now = new Date();
    const debut = `${now.getFullYear()-1}-01-01`;
    const fin   = `${now.getFullYear()+2}-12-31`;

    fetch(`php/evenements.php?debut=${debut}&fin=${fin}`, { credentials: 'same-origin' })
      .then(r => r.text())
      .then(text => {
        const data = JSON.parse(text);
        if (!data.succes) { zone.innerHTML = '<p style="color:var(--ink-faint);padding:16px;text-align:center">Erreur de chargement</p>'; return; }

        let evs = data.donnees || [];
        if (filtre) evs = evs.filter(e => e.titre.toLowerCase().includes(filtre.toLowerCase()) || (e.description||'').toLowerCase().includes(filtre.toLowerCase()));

        // Grouper par mois
        const groupes = {};
        evs.forEach(ev => {
          const mois = ev.date_debut.slice(0, 7);
          if (!groupes[mois]) groupes[mois] = [];
          groupes[mois].push(ev);
        });

        if (evs.length === 0) {
          zone.innerHTML = '<div style="text-align:center;padding:32px;color:var(--ink-faint)"><div style="font-size:2rem;margin-bottom:8px">📭</div><div style="font-size:.875rem">Aucun événement trouvé</div></div>';
          return;
        }

        Object.keys(groupes).sort().reverse().forEach(mois => {
          const label = document.createElement('div');
          label.style.cssText = 'font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint);padding:8px 4px 6px;margin-top:8px;';
          label.textContent = new Date(mois + '-01T00:00:00').toLocaleDateString('fr-FR', { month:'long', year:'numeric' });
          zone.appendChild(label);

          groupes[mois].forEach(ev => {
            const couleur = ev.couleur || ev.categorie_couleur || '#4f46e5';
            const item = document.createElement('div');
            item.className = 'ev-list-item';
            item.innerHTML = `
              <div class="ev-list-dot" style="background:${couleur}"></div>
              <div class="ev-list-info">
                <div class="ev-list-title">${ev.titre}</div>
                <div class="ev-list-date">${formaterDate(ev.date_debut)}${ev.heure_debut ? ' · ' + ev.heure_debut : ''}</div>
              </div>
              <div class="ev-list-actions">
                <button class="ev-list-btn" title="Voir" data-action="voir">👁</button>
                <button class="ev-list-btn" title="Modifier" data-action="edit">✏️</button>
                <button class="ev-list-btn del" title="Supprimer" data-action="del">🗑</button>
              </div>`;
            item.querySelector('[data-action=voir]').addEventListener('click', e => {
              e.stopPropagation(); fermerListe(); ouvrir(ev);
            });
            item.querySelector('[data-action=edit]').addEventListener('click', e => {
              e.stopPropagation();
              const evCopie = ev; // copie locale avant fermeture
              fermerListe();
              if (typeof App !== 'undefined' && App.editerEvenement) App.editerEvenement(evCopie);
            });
            item.querySelector('[data-action=del]').addEventListener('click', e => {
              e.stopPropagation(); supprimer(ev);
            });
            item.addEventListener('click', () => { fermerListe(); ouvrir(ev); });
            zone.appendChild(item);
          });
        });
      });
  }

  // ── Initialisation ─────────────────────────────────────────
  function init() {
    // Fermer overlay
    document.getElementById('ev-panel-overlay').addEventListener('click', fermer);
    document.getElementById('ev-panel-close').addEventListener('click', fermer);

    // Actions boutons
    document.getElementById('ev-btn-edit').addEventListener('click', () => {
      if (!currentEv) return;
      const evAEditer = currentEv; // sauvegarder AVANT fermer() qui remet currentEv à null
      fermer();
      if (typeof App !== 'undefined' && App.editerEvenement) App.editerEvenement(evAEditer);
    });

    document.getElementById('ev-btn-duplicate').addEventListener('click', () => {
      if (currentEv) dupliquer(currentEv);
    });

    document.getElementById('ev-btn-color').addEventListener('click', toggleCouleurs);

    document.getElementById('ev-btn-done').addEventListener('click', async () => {
      if (!currentEv) return;
      const id = parseInt(currentEv.id);
      if (!id) return;
      const res = await apiCall('php/toggle_fait.php', 'POST', { id });
      if (!res.succes) { toast(res.message || 'Erreur', 'error'); return; }
      const nouveauFait = res.donnees.fait;
      currentEv.fait = nouveauFait ? 1 : 0;
      // Mettre a jour l'icone du bouton
      document.getElementById('ev-done-icon').textContent  = nouveauFait ? '✅' : '⬜';
      document.getElementById('ev-done-label').textContent = nouveauFait ? 'Marque comme fait' : 'Marquer fait';
      document.getElementById('ev-done-sub').textContent   = nouveauFait ? 'Cliquer pour annuler' : 'Cocher comme termine';
      // Mettre a jour la barre de couleur (grise si fait)
      const couleur = nouveauFait ? '#9ca3af' : (currentEv.couleur || currentEv.categorie_couleur || '#4f46e5');
      document.getElementById('ev-panel-colorbar').style.background = `linear-gradient(90deg, ${couleur}, ${couleur}aa)`;
      toast(nouveauFait ? '✅ Evenement marque comme fait !' : '⬜ Marque comme non fait', nouveauFait ? 'success' : 'info');
      // Recharger le calendrier
      if (typeof App !== 'undefined' && App.recharger) App.recharger();
    });

    document.getElementById('ev-btn-share').addEventListener('click', () => {
      if (currentEv) exporter(currentEv);
    });

    document.getElementById('ev-btn-delete').addEventListener('click', () => {
      if (currentEv) supprimer(currentEv);
    });

    // Liste
    document.getElementById('btn-mes-ev-sidebar').addEventListener('click', ouvrirListe);
    document.getElementById('ev-list-close').addEventListener('click', fermerListe);
    document.getElementById('ev-list-overlay').addEventListener('click', fermerListe);

    document.getElementById('ev-list-search').addEventListener('input', e => {
      construireListe(e.target.value);
    });

    // Touche Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { fermer(); fermerListe(); }
    });
  }

  return { init, ouvrir, fermer };
})();

// Remplacer afficherPopup de app.js par notre panneau
document.addEventListener('DOMContentLoaded', () => {
  Panel.init();

  // Hook : intercepter les clics sur événements pour ouvrir le panel
  // (on surcharge la fonction afficherPopup globale)
  if (typeof window !== 'undefined') {
    window.__panelOuvrir = Panel.ouvrir.bind(Panel);
  }
});
