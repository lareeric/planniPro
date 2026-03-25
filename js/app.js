// ============================================================
// PlanniPro — Application JavaScript principale
// ============================================================

const App = (() => {
  // ── État global ────────────────────────────────────────────
  let state = {
    user: null,
    vue: 'semaine',       // 'semaine' | 'mois' | 'annee'
    date: new Date(),     // date de navigation
    evenements: [],
    categories: [],
    miniCalMois: new Date(),
  };

  const API = {
    auth:        'php/auth.php',
    evenements:  'php/evenements.php',
    categories:  'php/categories.php',
    abonnement:  'php/abonnement.php',
  };

  const COULEURS_DEFAUT = ['#2563eb','#16a34a','#dc2626','#d97706','#7c3aed','#0891b2','#be185d','#059669'];

  // ── Utilitaires dates ──────────────────────────────────────
  const fmt = {
    ymd: d => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const j = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${j}`;
    },
    hm:  d => d.toTimeString().slice(0, 5),
    label: d => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    moisAnnee: d => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    jourCourt: d => d.toLocaleDateString('fr-FR', { weekday: 'short' }),
    semaine: d => {
      const lundi = debutSemaine(d);
      const dim   = new Date(lundi); dim.setDate(lundi.getDate() + 6);
      const opts  = { day: 'numeric', month: 'long' };
      if (lundi.getMonth() === dim.getMonth()) {
        return `${lundi.getDate()} – ${dim.toLocaleDateString('fr-FR', opts)} ${dim.getFullYear()}`;
      }
      return `${lundi.toLocaleDateString('fr-FR', opts)} – ${dim.toLocaleDateString('fr-FR', opts)}, ${dim.getFullYear()}`;
    },
  };

  function debutSemaine(d) {
    const r = new Date(d); const day = r.getDay();
    r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
    r.setHours(0, 0, 0, 0); return r;
  }
  function isToday(d) {
    const t = new Date();
    return d.getDate()===t.getDate() && d.getMonth()===t.getMonth() && d.getFullYear()===t.getFullYear();
  }
  function minutesDeJournee(timeStr) {
    if (!timeStr) return 0;
    const [h,m] = timeStr.split(':').map(Number); return h*60+m;
  }

  // ── Appel API ──────────────────────────────────────────────
  async function api(url, methode = 'GET', corps = null) {
    const opts = { method: methode, credentials: 'same-origin' };

    if (methode === 'GET') {
      if (corps && Object.keys(corps).length > 0) {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(corps)) {
          if (v !== null && v !== undefined) params.append(k, v);
        }
        url = url + '?' + params.toString();
      }
    } else {
      opts.headers = { 'Content-Type': 'application/json' };
      if (corps) opts.body = JSON.stringify(corps);
    }

    try {
      const res  = await fetch(url, opts);
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch(e) {
        console.error('Reponse non-JSON :', text.slice(0, 300));
        return { succes: false, message: 'Reponse serveur invalide.' };
      }
    } catch(e) {
      console.error('Erreur fetch :', e);
      return { succes: false, message: 'Erreur reseau : ' + e.message };
    }
  }

  // ── Toast ──────────────────────────────────────────────────
  function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`; el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 320);
    }, 3000);
  }

  // ── Auth ───────────────────────────────────────────────────
  async function initAuth() {
    const res = await api(API.auth, 'POST', { action: 'verifier' });
    if (res.succes) { state.user = res.donnees; afficherApp(); }
    else afficherAuth();
  }

  function afficherAuth() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    bindAuth();
  }

  function afficherApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    mettreAJourUser();
    chargerCategories().then(() => chargerEvenements());
    renderTopbar();
    renderMiniCalendar();
    // Charger le plan Stripe après l'affichage de l'app
    setTimeout(chargerPlan, 600);
    // Gérer le retour après paiement Stripe
    gererRetourPaiement();
  }

  function bindAuth() {
    const tabs = document.querySelectorAll('.auth-tab');
    const formConnexion   = document.getElementById('form-connexion');
    const formInscription = document.getElementById('form-inscription');

    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const isConnexion = t.dataset.tab === 'connexion';
      formConnexion.style.display   = isConnexion ? '' : 'none';
      formInscription.style.display = isConnexion ? 'none' : '';
    }));

    formConnexion.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = formConnexion.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Connexion…';
      const res = await api(API.auth, 'POST', {
        action: 'connexion',
        email: formConnexion.querySelector('[name=email]').value,
        mot_de_passe: formConnexion.querySelector('[name=mdp]').value,
      });
      btn.disabled = false; btn.textContent = 'Se connecter';
      if (res.succes) { state.user = res.donnees; afficherApp(); }
      else document.getElementById('auth-error-connexion').textContent = res.message;
    });

    formInscription.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = formInscription.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Création…';
      const res = await api(API.auth, 'POST', {
        action: 'inscription',
        nom:    formInscription.querySelector('[name=nom]').value,
        prenom: formInscription.querySelector('[name=prenom]').value,
        email:  formInscription.querySelector('[name=email]').value,
        mot_de_passe: formInscription.querySelector('[name=mdp]').value,
      });
      btn.disabled = false; btn.textContent = 'Créer mon compte';
      if (res.succes) { state.user = res.donnees; afficherApp(); }
      else document.getElementById('auth-error-inscription').textContent = res.message;
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
      await api(API.auth, 'POST', { action: 'deconnexion' });
      state.user = null; state.evenements = []; state.categories = [];
      // Nettoyer le badge et le bouton Pro
      const badge = document.getElementById('plan-badge');
      const btnPro = document.getElementById('sidebar-upgrade-btn');
      const limites = document.getElementById('sidebar-upgrade-limits');
      if (badge) badge.remove();
      if (btnPro) btnPro.remove();
      if (limites) limites.remove();
      afficherAuth();
    });
  }

  function mettreAJourUser() {
    if (!state.user) return;
    const initiales = (state.user.prenom[0] + state.user.nom[0]).toUpperCase();
    document.getElementById('user-avatar').textContent = initiales;
    document.getElementById('user-name').textContent = `${state.user.prenom} ${state.user.nom}`;
  }

  // ── Chargement données ─────────────────────────────────────
  async function chargerCategories() {
    const res = await api(API.categories);
    if (res.succes) state.categories = res.donnees;
  }

  async function chargerEvenements() {
    let debut, fin;
    if (state.vue === 'semaine') {
      const lundi = debutSemaine(state.date);
      const dim   = new Date(lundi); dim.setDate(lundi.getDate() + 6);
      debut = fmt.ymd(lundi); fin = fmt.ymd(dim);
    } else if (state.vue === 'mois') {
      const y = state.date.getFullYear(), m = state.date.getMonth();
      debut = fmt.ymd(new Date(y, m, 1)); fin = fmt.ymd(new Date(y, m+1, 0));
    } else {
      const y = state.date.getFullYear();
      debut = `${y}-01-01`; fin = `${y}-12-31`;
    }
    const res = await api(API.evenements, 'GET', { debut, fin });
    if (res.succes) state.evenements = res.donnees;
    rendreCalendrier();
  }

  // ── Navigation ─────────────────────────────────────────────
  function naviguer(delta) {
    const d = new Date(state.date);
    if (state.vue === 'semaine')      d.setDate(d.getDate() + delta * 7);
    else if (state.vue === 'mois')  { d.setDate(1); d.setMonth(d.getMonth() + delta); }
    else                              d.setFullYear(d.getFullYear() + delta);
    state.date = d;
    renderTopbar();
    chargerEvenements();
    renderMiniCalendar();
  }

  function changerVue(vue) {
    state.vue = vue;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.vue === vue));
    document.querySelectorAll('.sidebar-btn[data-vue]').forEach(b => b.classList.toggle('active', b.dataset.vue === vue));
    renderTopbar();
    chargerEvenements();
  }

  function allerAujourdhui() {
    state.date = new Date();
    renderTopbar();
    chargerEvenements();
    renderMiniCalendar();
  }

  function renderTopbar() {
    let titre = '';
    if (state.vue === 'semaine')      titre = fmt.semaine(state.date);
    else if (state.vue === 'mois')    titre = fmt.moisAnnee(state.date).replace(/^\w/, c => c.toUpperCase());
    else                              titre = state.date.getFullYear().toString();
    document.getElementById('topbar-title').textContent = titre;
  }

  // ── Mini calendrier sidebar ────────────────────────────────
  function renderMiniCalendar() {
    const y = state.miniCalMois.getFullYear(), m = state.miniCalMois.getMonth();
    document.getElementById('mini-cal-label').textContent =
      new Date(y, m).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });

    const premier   = new Date(y, m, 1);
    const jourDebut = (premier.getDay() + 6) % 7;
    const nbJours   = new Date(y, m+1, 0).getDate();

    const grid = document.getElementById('mini-cal-days');
    grid.innerHTML = '';

    for (let i = 0; i < jourDebut; i++) {
      const prev = new Date(y, m, -jourDebut+i+1);
      grid.innerHTML += `<div class="mini-cal-day other-month">${prev.getDate()}</div>`;
    }
    for (let d = 1; d <= nbJours; d++) {
      const date       = new Date(y, m, d);
      const todayClass = isToday(date) ? 'today' : '';
      const selClass   = fmt.ymd(date) === fmt.ymd(state.date) ? 'selected' : '';
      const dateYmd    = fmt.ymd(date);
      const hasEvent   = state.evenements.some(ev =>
        (ev.date_debut||'').slice(0,10) <= dateYmd && (ev.date_fin||'').slice(0,10) >= dateYmd
      );
      const evClass = hasEvent ? 'has-event' : '';
      grid.innerHTML += `<div class="mini-cal-day ${todayClass} ${selClass} ${evClass}" data-date="${dateYmd}">${d}</div>`;
    }

    grid.querySelectorAll('.mini-cal-day[data-date]').forEach(el => {
      el.addEventListener('click', () => {
        state.date = new Date(el.dataset.date + 'T00:00:00');
        if (state.vue === 'annee') changerVue('mois');
        renderTopbar(); renderMiniCalendar(); chargerEvenements();
      });
    });
  }

  // ── Rendu calendrier ───────────────────────────────────────
  function rendreCalendrier() {
    const zone = document.getElementById('calendar-zone');
    zone.innerHTML = '';
    if (state.vue === 'semaine')      rendreVueSemaine(zone);
    else if (state.vue === 'mois')    rendreVueMois(zone);
    else                              rendreVueAnnee(zone);
    renderMiniCalendar();
  }

  // ── Vue Semaine ────────────────────────────────────────────
  function rendreVueSemaine(zone) {
    const lundi = debutSemaine(state.date);
    const jours = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lundi); d.setDate(lundi.getDate()+i); return d;
    });
    const HEURES = Array.from({ length: 24 }, (_, i) => i);

    const header = document.createElement('div');
    header.className = 'week-header';
    header.style.gridTemplateColumns = '60px repeat(7, 1fr)';
    header.innerHTML = `<div class="week-header-time"></div>` +
      jours.map(j => `<div class="week-day-label${isToday(j)?' today':''}">
        <span style="font-size:.7rem;text-transform:uppercase;color:var(--ink-faint);font-weight:600;">${fmt.jourCourt(j)}</span>
        <span class="day-num">${j.getDate()}</span>
      </div>`).join('');

    const body = document.createElement('div');
    body.className = 'week-body';

    const timesCol = document.createElement('div');
    timesCol.className = 'week-times';
    HEURES.forEach(h => {
      const slot = document.createElement('div');
      slot.className = 'week-time-slot';
      slot.textContent = h === 0 ? '' : `${String(h).padStart(2,'0')}:00`;
      timesCol.appendChild(slot);
    });

    const daysGrid = document.createElement('div');
    daysGrid.className = 'week-days';
    daysGrid.style.gridTemplateColumns = `repeat(7, 1fr)`;

    jours.forEach(jour => {
      const col = document.createElement('div');
      col.className = 'week-col';

      HEURES.forEach(h => {
        const slot = document.createElement('div');
        slot.className = 'week-slot';
        slot.dataset.date  = fmt.ymd(jour);
        slot.dataset.heure = `${String(h).padStart(2,'0')}:00`;
        slot.addEventListener('click', () =>
          ouvrirModalNouvel({ date: fmt.ymd(jour), heure: `${String(h).padStart(2,'0')}:00` })
        );
        col.appendChild(slot);
      });

      const jourYmd = fmt.ymd(jour);
      const evJour  = state.evenements.filter(ev => {
        const deb    = (ev.date_debut || '').slice(0,10);
        const finRaw = (ev.date_fin   || '').slice(0,10);
        const fin    = finRaw >= deb ? finRaw : deb;
        return deb <= jourYmd && fin >= jourYmd;
      });

      evJour.forEach(ev => {
        const el      = document.createElement('div');
        el.className  = 'week-event';
        const couleur = ev.couleur || ev.categorie_couleur || '#4f46e5';
        el.style.background = couleur + 'cc';
        el.style.color      = '#fff';

        const heureDebut = ev.heure_debut ? ev.heure_debut.slice(0,5) : null;
        const heureFin   = ev.heure_fin   ? ev.heure_fin.slice(0,5)   : null;

        let top = 0, hauteur = 60;
        if (heureDebut) {
          top     = minutesDeJournee(heureDebut);
          const duree = heureFin ? minutesDeJournee(heureFin) - top : 60;
          hauteur = Math.max(duree, 30);
        }
        el.style.top    = `${top}px`;
        el.style.height = `${hauteur}px`;

        if (ev.fait) {
          el.style.opacity        = '0.55';
          el.style.textDecoration = 'line-through';
        }
        el.innerHTML = `
          <div style="display:flex;align-items:flex-start;gap:5px;">
            <span class="ev-check-btn" data-id="${ev.id||ev.id_occurrence}"
              title="${ev.fait ? 'Marquer non fait' : 'Marquer fait'}"
              style="font-size:.85rem;line-height:1;margin-top:1px;cursor:pointer;flex-shrink:0;opacity:.85">
              ${ev.fait ? '✅' : '⬜'}
            </span>
            <div style="min-width:0">
              <div class="week-event-title">${ev.titre}</div>
              ${heureDebut ? `<div class="week-event-time">${heureDebut}${heureFin ? ' – '+heureFin : ''}</div>` : ''}
            </div>
          </div>`;

        el.querySelector('.ev-check-btn').addEventListener('click', e => {
          e.stopPropagation(); toggleFait(ev, el);
        });
        el.addEventListener('click', e => {
          e.stopPropagation();
          if (window.__panelOuvrir) window.__panelOuvrir(ev); else afficherPopup(ev, e);
        });
        col.appendChild(el);
      });

      if (isToday(jour)) {
        const now     = new Date();
        const minutes = now.getHours()*60 + now.getMinutes();
        const ligne   = document.createElement('div');
        ligne.className  = 'week-current-time';
        ligne.style.top  = `${minutes}px`;
        col.appendChild(ligne);
      }

      daysGrid.appendChild(col);
    });

    body.appendChild(timesCol);
    body.appendChild(daysGrid);

    const wrap = document.createElement('div');
    wrap.className = 'week-view';
    wrap.appendChild(header);
    wrap.appendChild(body);
    zone.appendChild(wrap);

    setTimeout(() => { body.scrollTop = 7 * 60; }, 100);
  }

  // ── Vue Mois ───────────────────────────────────────────────
  function rendreVueMois(zone) {
    const y = state.date.getFullYear(), m = state.date.getMonth();
    const premier   = new Date(y, m, 1);
    const jourDebut = (premier.getDay() + 6) % 7;
    const nbJours   = new Date(y, m+1, 0).getDate();
    const jours_fr  = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

    const wrap = document.createElement('div');
    wrap.className = 'month-view';

    const headerGrid = document.createElement('div');
    headerGrid.className = 'month-grid-header';
    jours_fr.forEach(j => {
      const el = document.createElement('div');
      el.className = 'month-day-name'; el.textContent = j;
      headerGrid.appendChild(el);
    });

    const grid = document.createElement('div');
    grid.className = 'month-grid';

    for (let i = 0; i < jourDebut; i++) {
      grid.appendChild(creerCellule(new Date(y, m, -jourDebut+i+1), true, y, m));
    }
    for (let d = 1; d <= nbJours; d++) {
      grid.appendChild(creerCellule(new Date(y, m, d), false, y, m));
    }
    const total = jourDebut + nbJours;
    const reste = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (let i = 1; i <= reste; i++) {
      grid.appendChild(creerCellule(new Date(y, m+1, i), true, y, m));
    }

    wrap.appendChild(headerGrid);
    wrap.appendChild(grid);
    zone.appendChild(wrap);
  }

  function creerCellule(jour, autreMois, y, m) {
    const cell = document.createElement('div');
    cell.className = 'month-cell' + (autreMois ? ' other-month' : '') + (isToday(jour) ? ' today' : '');

    const num = document.createElement('div');
    num.className = 'month-cell-num'; num.textContent = jour.getDate();
    cell.appendChild(num);

    cell.addEventListener('click', () => {
      if (autreMois) { state.date = new Date(jour); chargerEvenements(); renderTopbar(); renderMiniCalendar(); }
      else ouvrirModalNouvel({ date: fmt.ymd(jour) });
    });

    const jourYmd = fmt.ymd(jour);
    const evJour  = state.evenements.filter(ev => {
      const deb    = (ev.date_debut || '').slice(0,10);
      const finRaw = (ev.date_fin   || '').slice(0,10);
      const fin    = finRaw >= deb ? finRaw : deb;
      return deb <= jourYmd && fin >= jourYmd;
    });

    const MAX_VIS = 3;
    evJour.slice(0, MAX_VIS).forEach(ev => {
      const el      = document.createElement('div');
      el.className  = 'month-event';
      const couleur = ev.couleur || ev.categorie_couleur || '#4f46e5';
      el.style.background = couleur + '22';
      el.style.color      = couleur;
      if (ev.fait) { el.style.opacity = '.5'; el.style.textDecoration = 'line-through'; }
      el.innerHTML = `<span class="ev-check-month" style="cursor:pointer;margin-right:3px"
        title="${ev.fait ? 'Non fait' : 'Fait'}">${ev.fait ? '✅' : '⬜'}</span>${ev.titre}`;
      el.querySelector('.ev-check-month').addEventListener('click', e => {
        e.stopPropagation(); toggleFait(ev, null);
      });
      el.addEventListener('click', e => {
        if (e.target.classList.contains('ev-check-month')) return;
        e.stopPropagation();
        if (window.__panelOuvrir) window.__panelOuvrir(ev); else afficherPopup(ev, e);
      });
      cell.appendChild(el);
    });

    if (evJour.length > MAX_VIS) {
      const plus = document.createElement('div');
      plus.className = 'month-more';
      plus.textContent = `+${evJour.length - MAX_VIS} autre(s)`;
      cell.appendChild(plus);
    }

    return cell;
  }

  // ── Vue Année ──────────────────────────────────────────────
  function rendreVueAnnee(zone) {
    const y       = state.date.getFullYear();
    const wrap    = document.createElement('div');
    wrap.className = 'year-view';

    const grid = document.createElement('div');
    grid.className = 'year-grid';

    const MOIS_FR  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const JOURS_FR = ['L','M','M','J','V','S','D'];

    for (let mi = 0; mi < 12; mi++) {
      const card = document.createElement('div');
      card.className = 'year-month-card';

      const hd = document.createElement('div');
      hd.className = 'year-month-header';
      hd.textContent = MOIS_FR[mi];
      hd.addEventListener('click', () => { state.date = new Date(y, mi, 1); changerVue('mois'); });

      const miniGrid = document.createElement('div');
      miniGrid.className = 'year-mini-grid';
      JOURS_FR.forEach(j => {
        const d = document.createElement('div');
        d.className = 'year-day-name'; d.textContent = j;
        miniGrid.appendChild(d);
      });

      const premier   = new Date(y, mi, 1);
      const jourDebut = (premier.getDay() + 6) % 7;
      const nbJours   = new Date(y, mi+1, 0).getDate();

      for (let i = 0; i < jourDebut; i++) {
        const el = document.createElement('div');
        el.className = 'year-day other-month';
        el.textContent = new Date(y, mi, -jourDebut+i+1).getDate();
        miniGrid.appendChild(el);
      }
      for (let d = 1; d <= nbJours; d++) {
        const date    = new Date(y, mi, d);
        const el      = document.createElement('div');
        el.className  = 'year-day' + (isToday(date) ? ' today' : '');
        const dateYmd = fmt.ymd(date);
        const hasEv   = state.evenements.some(ev =>
          (ev.date_debut||'').slice(0,10) <= dateYmd && (ev.date_fin||'').slice(0,10) >= dateYmd
        );
        if (hasEv) el.classList.add('has-event');
        el.textContent = d;
        el.title = fmt.label(date);
        el.addEventListener('click', e => {
          e.stopPropagation();
          state.date = date;
          changerVue('semaine');
        });
        miniGrid.appendChild(el);
      }

      card.appendChild(hd);
      card.appendChild(miniGrid);
      grid.appendChild(card);
    }

    wrap.appendChild(grid);
    zone.appendChild(wrap);
  }

  // ── Popup événement ────────────────────────────────────────
  function afficherPopup(ev, e) {
    fermerPopup();
    const couleur = ev.couleur || ev.categorie_couleur || '#4f46e5';
    const popup   = document.createElement('div');
    popup.className = 'event-popup';
    popup.id        = 'event-popup';

    let meta = '';
    if (ev.date_debut === ev.date_fin) {
      meta += `<div class="event-popup-meta">📅 ${new Date(ev.date_debut+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</div>`;
    } else {
      meta += `<div class="event-popup-meta">📅 ${new Date(ev.date_debut+'T00:00:00').toLocaleDateString('fr-FR')} → ${new Date(ev.date_fin+'T00:00:00').toLocaleDateString('fr-FR')}</div>`;
    }
    if (ev.heure_debut) meta += `<div class="event-popup-meta">🕐 ${ev.heure_debut}${ev.heure_fin ? ' – '+ev.heure_fin : ''}</div>`;
    if (ev.lieu)        meta += `<div class="event-popup-meta">📍 ${ev.lieu}</div>`;
    if (ev.categorie_nom) meta += `<div class="event-popup-meta">🏷 ${ev.categorie_nom}</div>`;
    if (ev.description) meta += `<div class="event-popup-meta" style="margin-top:6px;color:var(--ink)">${ev.description}</div>`;

    popup.innerHTML = `
      <div style="display:flex;align-items:center;margin-bottom:8px;">
        <span class="event-popup-color" style="background:${couleur}"></span>
        <span class="event-popup-title">${ev.titre}</span>
      </div>
      ${meta}
      <div class="event-popup-actions">
        <button class="popup-btn popup-btn-edit" id="popup-edit">✏️ Modifier</button>
        <button class="popup-btn popup-btn-delete" id="popup-delete">🗑 Supprimer</button>
      </div>`;

    let left = e.clientX + 10;
    let top  = e.clientY + 10;
    if (left + 290 > window.innerWidth)  left = e.clientX - 300;
    if (top  + 300 > window.innerHeight) top  = e.clientY - 300;
    popup.style.left = left + 'px';
    popup.style.top  = top  + 'px';

    document.body.appendChild(popup);
    popup.querySelector('#popup-edit').addEventListener('click',   () => { fermerPopup(); ouvrirModalEditer(ev); });
    popup.querySelector('#popup-delete').addEventListener('click', () => { fermerPopup(); confirmerSuppression(ev); });
    setTimeout(() => document.addEventListener('click', fermerPopupClick), 50);
  }

  function fermerPopupClick(e) {
    const p = document.getElementById('event-popup');
    if (p && !p.contains(e.target)) fermerPopup();
  }
  function fermerPopup() {
    const p = document.getElementById('event-popup');
    if (p) p.remove();
    document.removeEventListener('click', fermerPopupClick);
  }

  // ── Modal événement ────────────────────────────────────────
  function ouvrirModalNouvel({ date = fmt.ymd(new Date()), heure = '' } = {}) {
    afficherModal({ date_debut: date, heure_debut: heure, date_fin: date });
  }
  function ouvrirModalEditer(ev) {
    afficherModal(ev, true);
  }

  function afficherModal(ev = {}, edition = false) {
    fermerModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id        = 'modal-overlay';

    const RECURRENCES = [
      { val: 'aucune',        label: 'Aucune récurrence' },
      { val: 'quotidien',     label: 'Quotidien' },
      { val: 'hebdomadaire',  label: 'Hebdomadaire' },
      { val: 'mensuel',       label: 'Mensuel' },
      { val: 'annuel',        label: 'Annuel' },
    ];

    const estPro      = window.__plan?.est_pro ?? false;
    const catsOptions = state.categories.map(c =>
      `<option value="${c.id}" ${ev.categorie_id == c.id ? 'selected' : ''}>${c.nom}</option>`
    ).join('');
    const couleurActuelle = ev.couleur || ev.categorie_couleur || COULEURS_DEFAUT[0];

    // Badge "Pro uniquement" pour la récurrence si plan Free
    const recurrenceLock = !estPro
      ? `<span style="margin-left:6px;font-size:.7rem;background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:10px;font-weight:600;">⭐ Pro</span>`
      : '';

    overlay.innerHTML = `
    <div class="modal" id="modal-ev">
      <div class="modal-header">
        <span class="modal-title">${edition ? 'Modifier l\'événement' : 'Nouvel événement'}</span>
        <button class="modal-close" id="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Titre *</label>
          <input class="form-control" id="ev-titre" type="text" value="${ev.titre||''}" placeholder="Ex. : Réunion d'équipe" autocomplete="off">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Date de début *</label>
            <input class="form-control" id="ev-date-debut" type="date" value="${ev.date_debut||fmt.ymd(new Date())}">
          </div>
          <div class="form-group">
            <label>Date de fin *</label>
            <input class="form-control" id="ev-date-fin" type="date" value="${ev.date_fin||ev.date_debut||fmt.ymd(new Date())}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Heure de début</label>
            <input class="form-control" id="ev-heure-debut" type="time" value="${ev.heure_debut||''}">
          </div>
          <div class="form-group">
            <label>Heure de fin</label>
            <input class="form-control" id="ev-heure-fin" type="time" value="${ev.heure_fin||''}">
          </div>
        </div>
        <div class="form-group">
          <label>Catégorie</label>
          <select class="form-control" id="ev-categorie">
            <option value="">— Sans catégorie —</option>
            ${catsOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Récurrence ${recurrenceLock}</label>
          <select class="form-control" id="ev-recurrence" ${!estPro ? 'title="Fonctionnalité Pro"' : ''}>
            ${RECURRENCES.map(r =>
              `<option value="${r.val}" ${(ev.recurrence||'aucune')===r.val ? 'selected' : ''}>${r.label}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group" id="ev-recurrence-fin-group" style="display:${ev.recurrence && ev.recurrence!=='aucune' ? '' : 'none'}">
          <label>Fin de la récurrence</label>
          <input class="form-control" id="ev-recurrence-fin" type="date" value="${ev.recurrence_fin||''}">
        </div>
        <div class="form-group">
          <label>Lieu</label>
          <input class="form-control" id="ev-lieu" type="text" value="${ev.lieu||''}" placeholder="Ex. : Salle de conférence B">
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea class="form-control" id="ev-description" placeholder="Notes, détails…">${ev.description||''}</textarea>
        </div>
        <div class="form-group">
          <label>Couleur</label>
          <div class="color-picker-row" id="color-picker">
            ${COULEURS_DEFAUT.map(c =>
              `<div class="color-swatch${c===couleurActuelle?' selected':''}" data-color="${c}" style="background:${c}" title="${c}"></div>`
            ).join('')}
            <input type="color" class="color-custom" id="ev-couleur-custom" value="${couleurActuelle}" title="Couleur personnalisée">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        ${edition ? `<button class="btn-secondary btn-danger" id="btn-supprimer-ev">Supprimer</button>` : ''}
        <button class="btn-secondary" id="btn-annuler-modal">Annuler</button>
        <button class="btn-save" id="btn-sauvegarder-ev">${edition ? 'Enregistrer' : 'Créer'}</button>
      </div>
    </div>`;

    document.body.appendChild(overlay);

    // Couleur swatches
    let couleurSelectionnee = couleurActuelle;
    overlay.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        overlay.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        couleurSelectionnee = sw.dataset.color;
        overlay.querySelector('#ev-couleur-custom').value = sw.dataset.color;
      });
    });
    overlay.querySelector('#ev-couleur-custom').addEventListener('input', e => {
      couleurSelectionnee = e.target.value;
      overlay.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    });

    // Récurrence toggle — si Free, ouvrir modal Pro au lieu d'afficher l'option
    overlay.querySelector('#ev-recurrence').addEventListener('change', e => {
      if (e.target.value !== 'aucune' && !estPro) {
        e.target.value = 'aucune'; // remettre à aucune
        fermerModal();
        ouvrirModalPro();
        return;
      }
      overlay.querySelector('#ev-recurrence-fin-group').style.display = e.target.value !== 'aucune' ? '' : 'none';
    });

    // Sync dates
    overlay.querySelector('#ev-date-debut').addEventListener('change', e => {
      const fin = overlay.querySelector('#ev-date-fin');
      if (!fin.value || fin.value < e.target.value) fin.value = e.target.value;
    });

    overlay.querySelector('#modal-close').addEventListener('click', fermerModal);
    overlay.querySelector('#btn-annuler-modal').addEventListener('click', fermerModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) fermerModal(); });

    if (edition && overlay.querySelector('#btn-supprimer-ev')) {
      overlay.querySelector('#btn-supprimer-ev').addEventListener('click', () => {
        fermerModal(); confirmerSuppression(ev);
      });
    }

    overlay.querySelector('#btn-sauvegarder-ev').addEventListener('click', async () => {
      const titre = overlay.querySelector('#ev-titre').value.trim();
      if (!titre) { overlay.querySelector('#ev-titre').focus(); toast('Le titre est requis', 'error'); return; }

      const donnees = {
        titre,
        date_debut:     overlay.querySelector('#ev-date-debut').value,
        date_fin:       overlay.querySelector('#ev-date-fin').value,
        heure_debut:    overlay.querySelector('#ev-heure-debut').value || null,
        heure_fin:      overlay.querySelector('#ev-heure-fin').value || null,
        categorie_id:   overlay.querySelector('#ev-categorie').value || null,
        recurrence:     overlay.querySelector('#ev-recurrence').value,
        recurrence_fin: overlay.querySelector('#ev-recurrence-fin').value || null,
        lieu:           overlay.querySelector('#ev-lieu').value.trim(),
        description:    overlay.querySelector('#ev-description').value.trim(),
        couleur:        couleurSelectionnee,
      };

      // ── Vérification plan Pro avant sauvegarde ──
      if (donnees.recurrence !== 'aucune' && !estPro) {
        fermerModal();
        ouvrirModalPro();
        return;
      }

      const btn = overlay.querySelector('#btn-sauvegarder-ev');
      btn.disabled = true; btn.textContent = 'Enregistrement…';

      const res = edition
        ? await api(API.evenements, 'PUT',  { id: ev.id, ...donnees })
        : await api(API.evenements, 'POST', donnees);

      btn.disabled = false; btn.textContent = edition ? 'Enregistrer' : 'Créer';

      if (res.succes) {
        fermerModal();
        toast(edition ? 'Événement modifié ✓' : 'Événement créé ✓', 'success');
        chargerEvenements();
      } else {
        toast(res.message || 'Erreur', 'error');
      }
    });

    setTimeout(() => overlay.querySelector('#ev-titre').focus(), 80);
  }

  function fermerModal() {
    const m = document.getElementById('modal-overlay');
    if (m) m.remove();
  }

  // ── Suppression ────────────────────────────────────────────
  async function confirmerSuppression(ev) {
    if (!confirm(`Supprimer « ${ev.titre} » ?`)) return;
    const res = await api(API.evenements, 'DELETE', { id: ev.id });
    if (res.succes) { toast('Événement supprimé', 'success'); chargerEvenements(); }
    else toast(res.message || 'Erreur de suppression', 'error');
  }

  // ── Toggle fait / non fait ─────────────────────────────────
  async function toggleFait(ev) {
    const id = parseInt(ev.id);
    if (!id) return;

    const res = await api('php/toggle_fait.php', 'POST', { id });
    if (!res.succes) { toast(res.message || 'Erreur', 'error'); return; }

    const nouveauFait = res.donnees.fait;
    ev.fait = nouveauFait ? 1 : 0;

    state.evenements.forEach(e => {
      if (e.id == id || (e.id_occurrence && parseInt(e.id) == id)) {
        e.fait = ev.fait;
      }
    });

    toast(nouveauFait ? '✅ Marqué comme fait !' : '⬜ Marqué comme non fait',
          nouveauFait ? 'success' : 'info');
    rendreCalendrier();
  }

  // ===========================================================
  // ── Plan & Stripe ──────────────────────────────────────────
  // ===========================================================

  async function chargerPlan() {
    try {
      const res = await api(API.abonnement, 'POST', { action: 'infos_plan' });
      if (res.succes) {
        window.__plan = res.donnees;
        afficherBadgePlan(res.donnees);
        afficherBoutonSidebar(res.donnees);
      }
    } catch(e) {
      console.warn('Plan non chargé :', e);
    }
  }

  function afficherBadgePlan(plan) {
    const ancien = document.getElementById('plan-badge');
    if (ancien) ancien.remove();

    const estPro = plan.est_pro;
    const badge  = document.createElement('div');
    badge.id     = 'plan-badge';
    badge.style.cssText = `
      display:inline-flex; align-items:center; gap:5px;
      padding:3px 10px; border-radius:20px;
      font-size:.72rem; font-weight:700; letter-spacing:.04em;
      cursor:${estPro ? 'default' : 'pointer'};
      background:${estPro ? 'linear-gradient(135deg,#f59e0b,#d97706)' : '#e5e7eb'};
      color:${estPro ? '#fff' : '#6b7280'};
      margin-left:10px; transition:opacity .2s;
    `;
    badge.innerHTML = estPro ? '⭐ PRO' : '🔓 FREE';
    badge.title = estPro
      ? `Plan Pro actif${plan.expire_at ? ' jusqu\'au ' + new Date(plan.expire_at).toLocaleDateString('fr-FR') : ''}`
      : 'Passer à Pro pour débloquer toutes les fonctionnalités';

    if (!estPro) {
      badge.addEventListener('click', ouvrirModalPro);
      badge.addEventListener('mouseenter', () => badge.style.opacity = '.8');
      badge.addEventListener('mouseleave', () => badge.style.opacity = '1');
    }

    const userSection = document.getElementById('user-name');
    if (userSection) userSection.after(badge);
  }

  function afficherBoutonSidebar(plan) {
    // Supprimer les anciens éléments
    ['sidebar-upgrade-btn','sidebar-upgrade-limits'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    if (plan.est_pro) {
      const info = document.createElement('div');
      info.id = 'sidebar-upgrade-btn';
      info.style.cssText = `
        margin:12px; padding:10px 14px; border-radius:10px;
        background:linear-gradient(135deg,#fef3c7,#fde68a);
        color:#92400e; font-size:.78rem; font-weight:600; text-align:center;
      `;
      info.innerHTML = `⭐ Plan Pro actif<br><span style="font-weight:400;font-size:.72rem">Merci pour votre soutien !</span>`;
      sidebar.appendChild(info);
      return;
    }

    // Bouton upgrade
    const btn = document.createElement('button');
    btn.id = 'sidebar-upgrade-btn';
    btn.style.cssText = `
      margin:12px; width:calc(100% - 24px); padding:11px 14px;
      border-radius:10px; border:none;
      background:linear-gradient(135deg,#f59e0b,#d97706);
      color:#fff; font-size:.82rem; font-weight:700; cursor:pointer;
      box-shadow:0 2px 8px rgba(245,158,11,.35); transition:transform .15s, box-shadow .15s;
    `;
    btn.innerHTML = `⚡ Passer à Pro — 9$/mois`;
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-1px)';
      btn.style.boxShadow = '0 4px 14px rgba(245,158,11,.5)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
      btn.style.boxShadow = '0 2px 8px rgba(245,158,11,.35)';
    });
    btn.addEventListener('click', ouvrirModalPro);
    sidebar.appendChild(btn);

    // Infos limites sous le bouton
    const limites = document.createElement('div');
    limites.id = 'sidebar-upgrade-limits';
    limites.style.cssText = `
      margin:0 12px 12px; font-size:.7rem;
      color:var(--ink-faint,#9ca3af); text-align:center; line-height:1.6;
    `;
    const nbCats  = plan.categories?.utilisees ?? 0;
    const maxCats = plan.categories?.max ?? 3;
    limites.innerHTML = `
      ${nbCats}/${maxCats} catégories utilisées<br>
      🔒 Récurrence &nbsp;|&nbsp; 🔒 Export PDF &nbsp;|&nbsp; 🔒 Partage
    `;
    sidebar.appendChild(limites);
  }

  function ouvrirModalPro() {
    fermerModalPro();
    const overlay = document.createElement('div');
    overlay.id    = 'modal-pro-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,.45);
      display:flex; align-items:center; justify-content:center;
      z-index:9999;
    `;

    overlay.innerHTML = `
      <div style="
        background:#fff; border-radius:18px; width:100%; max-width:420px;
        margin:16px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,.2);
      ">
        <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 28px 22px;text-align:center;color:#fff;">
          <div style="font-size:2.2rem;margin-bottom:6px;">⭐</div>
          <div style="font-size:1.4rem;font-weight:800;margin-bottom:4px;">Passez à PlanniPro Pro</div>
          <div style="font-size:.88rem;opacity:.9;">Débloquez toutes les fonctionnalités</div>
        </div>
        <div style="text-align:center;padding:20px 28px 0;">
          <span style="font-size:2.4rem;font-weight:800;color:#111;">9$</span>
          <span style="color:#6b7280;font-size:.9rem;">/mois · Annulable à tout moment</span>
        </div>
        <div style="padding:18px 28px;">
          ${[
            ['✅','Catégories illimitées','Plus de limite à 3 catégories'],
            ['✅','Récurrence des événements','Quotidien, hebdo, mensuel, annuel'],
            ['✅','Export PDF du calendrier','Imprimez et partagez votre planning'],
            ['✅','Partage de calendrier','Collaborez avec votre équipe'],
            ['✅','Support prioritaire','Réponse en moins de 24h'],
          ].map(([icon, titre, desc]) => `
            <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px;">
              <span style="font-size:1rem;margin-top:1px;">${icon}</span>
              <div>
                <div style="font-weight:600;font-size:.88rem;color:#111;">${titre}</div>
                <div style="font-size:.78rem;color:#6b7280;">${desc}</div>
              </div>
            </div>`).join('')}
        </div>
        <div style="padding:0 28px 24px;display:flex;flex-direction:column;gap:10px;">
          <button id="btn-checkout-stripe" style="
            padding:13px; border-radius:10px; border:none;
            background:linear-gradient(135deg,#f59e0b,#d97706);
            color:#fff; font-size:.95rem; font-weight:700; cursor:pointer;
            box-shadow:0 4px 14px rgba(245,158,11,.4);
          ">⚡ S'abonner maintenant — 9$/mois</button>
          <button id="btn-fermer-pro" style="
            padding:11px; border-radius:10px; border:1.5px solid #e5e7eb;
            background:#fff; color:#6b7280; font-size:.88rem; cursor:pointer;
          ">Continuer avec le plan gratuit</button>
        </div>
        <div style="text-align:center;padding:0 28px 20px;font-size:.72rem;color:#9ca3af;">
          🔒 Paiement sécurisé par Stripe · Pas d'engagement · Annulable à tout moment
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#btn-checkout-stripe').addEventListener('click', lancerCheckout);
    overlay.querySelector('#btn-fermer-pro').addEventListener('click', fermerModalPro);
    overlay.addEventListener('click', e => { if (e.target === overlay) fermerModalPro(); });
    document.addEventListener('keydown', _escModalPro);
  }

  function _escModalPro(e) { if (e.key === 'Escape') fermerModalPro(); }
  function fermerModalPro() {
    const m = document.getElementById('modal-pro-overlay');
    if (m) m.remove();
    document.removeEventListener('keydown', _escModalPro);
  }

  async function lancerCheckout() {
    const btn = document.getElementById('btn-checkout-stripe');
    if (btn) { btn.disabled = true; btn.textContent = 'Redirection vers Stripe…'; }
    const res = await api(API.abonnement, 'POST', { action: 'creer_checkout' });
    if (res.succes && res.donnees?.checkout_url) {
      window.location.href = res.donnees.checkout_url;
    } else {
      toast(res.message || 'Erreur lors de la création du paiement.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '⚡ S\'abonner maintenant — 9$/mois'; }
    }
  }

  function gererRetourPaiement() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('paiement') === 'succes') {
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => {
        toast('🎉 Bienvenue dans PlanniPro Pro ! Toutes les fonctionnalités sont débloquées.', 'success');
        chargerPlan();
      }, 600);
    }
    if (params.get('paiement') === 'annule') {
      window.history.replaceState({}, '', window.location.pathname);
      toast('Paiement annulé. Vous restez sur le plan gratuit.', 'info');
    }
  }

  // ── Initialisation ─────────────────────────────────────────
  function init() {
    document.getElementById('btn-prev').addEventListener('click', () => naviguer(-1));
    document.getElementById('btn-next').addEventListener('click', () => naviguer(1));
    document.getElementById('btn-today').addEventListener('click', allerAujourdhui);

    document.querySelectorAll('.view-btn').forEach(b =>
      b.addEventListener('click', () => changerVue(b.dataset.vue))
    );
    document.querySelectorAll('.sidebar-btn[data-vue]').forEach(b =>
      b.addEventListener('click', () => changerVue(b.dataset.vue))
    );

    document.getElementById('btn-new').addEventListener('click', () => ouvrirModalNouvel());

    document.getElementById('mini-prev').addEventListener('click', () => {
      state.miniCalMois = new Date(state.miniCalMois.getFullYear(), state.miniCalMois.getMonth()-1, 1);
      renderMiniCalendar();
    });
    document.getElementById('mini-next').addEventListener('click', () => {
      state.miniCalMois = new Date(state.miniCalMois.getFullYear(), state.miniCalMois.getMonth()+1, 1);
      renderMiniCalendar();
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
      await api(API.auth, 'POST', { action: 'deconnexion' });
      state.user = null; state.evenements = []; state.categories = [];
      ['plan-badge','sidebar-upgrade-btn','sidebar-upgrade-limits'].forEach(id => {
        const el = document.getElementById(id); if (el) el.remove();
      });
      window.__plan = null;
      afficherAuth();
    });

    const menuBtn = document.getElementById('btn-menu');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { fermerModal(); fermerPopup(); fermerModalPro(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); ouvrirModalNouvel(); }
    });

    initAuth();
  }

  return { init, recharger: chargerEvenements, editerEvenement: ouvrirModalEditer, ouvrirModalPro };
})();

document.addEventListener('DOMContentLoaded', App.init);