const API = '';
let currentRole = null;
let currentUser = null;
let allBoxers = [];

// ===== AUTH =====

function getToken() { return localStorage.getItem('bm_token'); }
function setToken(t) { localStorage.setItem('bm_token', t); }
function clearToken() { localStorage.removeItem('bm_token'); localStorage.removeItem('bm_role'); localStorage.removeItem('bm_email'); }

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() };
}

async function apiFetch(path, opts = {}) {
  opts.headers = { ...authHeaders(), ...(opts.headers || {}) };
  const res = await fetch(API + path, opts);
  if (res.status === 401) { doLogout(); return null; }
  return res;
}

function switchAuthTab(tab) {
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', (i === 0) === (tab === 'login')));
  document.getElementById('authError').style.display = 'none';
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('authError');
  errEl.style.display = 'none';

  if (!email || !password) { showAuthError('Veuillez remplir tous les champs.'); return; }

  // Try admin login first, then regular user
  let data, res;

  res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  data = await res.json();

  if (!res.ok) {
    // Fallback to regular login
    res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    data = await res.json();
    if (!res.ok) { showAuthError(data.error); return; }
  }

  setToken(data.token);
  localStorage.setItem('bm_role', data.role);
  localStorage.setItem('bm_email', data.email);
  initApp(data.role, data.email);
}

async function doRegister() {
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;

  if (!email || !password) { showAuthError('Veuillez remplir tous les champs.'); return; }
  if (password !== confirm) { showAuthError('Les mots de passe ne correspondent pas.'); return; }

  const res = await fetch('/api/auth/register-boxer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) { showAuthError(data.error); return; }

  setToken(data.token);
  localStorage.setItem('bm_role', data.role);
  localStorage.setItem('bm_email', data.email);
  initApp(data.role, data.email);
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.style.display = 'block';
}

function doLogout() {
  clearToken();
  document.getElementById('authPage').style.display = 'flex';
  document.getElementById('appLayout').style.display = 'none';
  currentRole = null;
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
}

// ===== APP INIT =====

function initApp(role, email) {
  currentRole = role;
  currentUser = email;
  document.getElementById('authPage').style.display = 'none';
  document.getElementById('appLayout').style.display = 'flex';
  document.getElementById('sidebarRole').textContent = role === 'coach' ? '🏆 Coach' : role === 'admin' ? '🛡 Admin' : '🥊 Boxeur';
  document.getElementById('sidebarEmail').textContent = email;

  buildNav(role);

  // Show "back to admin" button if impersonating
  const adminToken = localStorage.getItem('bm_admin_token');
  const footer = document.querySelector('.sidebar-footer');
  const existingBack = document.getElementById('backToAdminBtn');
  if (existingBack) existingBack.remove();
  if (adminToken && role !== 'admin') {
    const btn = document.createElement('button');
    btn.id = 'backToAdminBtn';
    btn.className = 'logout-btn';
    btn.style.cssText = 'background:rgba(201,160,32,0.15);color:var(--primary);border:1px solid rgba(201,160,32,0.3);margin-bottom:8px';
    btn.innerHTML = '🛡 Retour admin';
    btn.onclick = returnToAdmin;
    footer.insertBefore(btn, footer.firstChild);
  }

  if (role === 'coach') {
    showPage('coach-dashboard');
    loadCoachDashboard();
  } else if (role === 'admin') {
    showPage('admin-users');
    loadAdminUsers();
  } else {
    showPage('boxer-profile');
    loadBoxerProfile();
  }
}

function buildNav(role) {
  const nav = document.getElementById('sidebarNav');
  const items = role === 'coach'
    ? [
        { id: 'coach-dashboard', icon: '📊', label: 'Tableau de bord' },
        { id: 'coach-boxers',    icon: '👥', label: 'Mes boxeurs' },
        { id: 'coach-calendar',  icon: '📅', label: 'Calendrier' },
        { id: 'coach-training',  icon: '📋', label: 'Fiches entraînement' },
        { id: 'coach-payments',  icon: '💳', label: 'Paiements' },
      ]
    : role === 'admin'
    ? [
        { id: 'admin-users', icon: '🛡', label: 'Utilisateurs' },
      ]
    : [
        { id: 'boxer-profile',   icon: '👤', label: 'Mon profil' },
        { id: 'boxer-events',    icon: '📅', label: 'Mes événements' },
        { id: 'boxer-training',  icon: '📋', label: 'Fiches entraînement' },
        { id: 'boxer-documents', icon: '📂', label: 'Mes documents' },
        { id: 'boxer-payments',  icon: '💳', label: 'Mes paiements' },
      ];

  nav.innerHTML = items.map(i => `
    <div class="nav-item" id="nav-${i.id}" onclick="showPage('${i.id}')">
      <span class="nav-icon">${i.icon}</span>
      ${i.label}
    </div>
  `).join('');
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + pageId);
  const nav = document.getElementById('nav-' + pageId);
  if (page) page.classList.add('active');
  if (nav) nav.classList.add('active');

  if (pageId === 'coach-dashboard') loadCoachDashboard();
  if (pageId === 'coach-boxers') loadBoxerGrid();
  if (pageId === 'coach-calendar') loadCalendar();
  if (pageId === 'coach-training') loadTrainingSheets();
  if (pageId === 'coach-payments') loadCoachPayments();
  if (pageId === 'boxer-profile') loadBoxerProfile();
  if (pageId === 'boxer-training') loadTrainingSheets();
  if (pageId === 'boxer-events') loadBoxerEvents();
  if (pageId === 'boxer-documents') loadDocuments();
  if (pageId === 'boxer-payments') loadBoxerPayments();
  if (pageId === 'admin-users') loadAdminUsers();
}

// ===== COACH DASHBOARD =====

async function loadCoachDashboard() {
  const [bRes, pRes] = await Promise.all([
    apiFetch('/api/coach/boxers'),
    apiFetch('/api/coach/payments/month')
  ]);
  if (!bRes || !pRes) return;
  const boxers = await bRes.json();
  const payments = await pRes.json();

  const paid = payments.boxers.filter(b => b.paid).length;
  const unpaid = payments.boxers.length - paid;
  const total = boxers.length;

  document.getElementById('coachStats').innerHTML = `
    <div class="stat-card stat-total">
      <div class="stat-val">${total}</div>
      <div class="stat-label">Boxeurs</div>
    </div>
    <div class="stat-card stat-wins">
      <div class="stat-val">${paid}</div>
      <div class="stat-label">Ont payé</div>
    </div>
    <div class="stat-card stat-losses">
      <div class="stat-val">${unpaid}</div>
      <div class="stat-label">En attente</div>
    </div>
    <div class="stat-card stat-draws">
      <div class="stat-val">${total ? Math.round(paid/total*100) : 0}%</div>
      <div class="stat-label">Taux de paiement</div>
    </div>
  `;

  const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const monthLabel = `${MONTHS[payments.month-1]} ${payments.year}`;

  document.getElementById('dashPaymentPreview').innerHTML = `
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">${monthLabel}</p>
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>Boxeur</th>
          <th>Statut</th>
        </tr></thead>
        <tbody>
          ${payments.boxers.slice(0,8).map(b => `
            <tr>
              <td>
                <div class="boxer-name">${fullName(b)}</div>
                <div class="boxer-email">${b.email}</div>
              </td>
              <td>
                ${b.paid
                  ? '<span class="badge badge-paid">✓ Payé</span>'
                  : '<span class="badge badge-unpaid">✗ Non payé</span>'
                }
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ===== COACH BOXERS =====

async function loadBoxerGrid() {
  const res = await apiFetch('/api/coach/boxers');
  if (!res) return;
  allBoxers = await res.json();
  renderBoxerGrid(allBoxers);
}

function renderBoxerGrid(boxers) {
  const grid = document.getElementById('boxerGrid');
  if (!boxers.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">👥</div>
      <p>Aucun boxeur inscrit pour l'instant.</p>
    </div>`;
    return;
  }
  grid.innerHTML = boxers.map(b => {
    const initials = getInitials(b);
    const total = (b.wins||0) + (b.losses||0) + (b.draws||0);
    return `
      <div class="boxer-card" onclick="openBoxerModal(${b.user_id})">
        <div class="boxer-card-header">
          <div style="display:flex;gap:12px;align-items:center">
            <div class="boxer-avatar">${initials}</div>
            <div>
              <div class="boxer-card-name">${fullName(b)}</div>
              <div class="boxer-card-email">${b.email}</div>
            </div>
          </div>
          ${b.weight_category ? `<span class="weight-pill">${b.weight_category.split('(')[0].trim()}</span>` : ''}
        </div>
        ${b.license_number ? `<div style="font-size:12px;color:var(--text-muted)">🪪 ${b.license_number}</div>` : ''}
        <div class="boxer-card-stats">
          <span><strong class="record-w">${b.wins||0}</strong> V</span>
          <span><strong class="record-l">${b.losses||0}</strong> D</span>
          <span><strong class="record-d">${b.draws||0}</strong> N</span>
          <span style="margin-left:auto"><strong>${total}</strong> combats</span>
        </div>
      </div>
    `;
  }).join('');
}

function filterBoxers() {
  const q = document.getElementById('boxerSearch').value.toLowerCase();
  const filtered = allBoxers.filter(b =>
    fullName(b).toLowerCase().includes(q) ||
    (b.email||'').toLowerCase().includes(q) ||
    (b.license_number||'').toLowerCase().includes(q)
  );
  renderBoxerGrid(filtered);
}

let _currentModalBoxer = null;

async function openBoxerModal(userId) {
  const res = await apiFetch(`/api/coach/boxers/${userId}`);
  if (!res) return;
  _currentModalBoxer = await res.json();
  renderBoxerModalView();
  document.getElementById('boxerModal').classList.add('open');
}

function renderBoxerModalView() {
  const b = _currentModalBoxer;
  document.getElementById('modalTitle').innerHTML = `
    ${fullName(b) || b.email}
    <button class="btn btn-sm" style="background:var(--gold-dim);color:var(--primary);border:1px solid rgba(201,160,32,0.3);margin-left:10px;font-size:12px" onclick="renderBoxerModalEdit()">✏️ Modifier</button>
  `;
  const total = (b.wins||0)+(b.losses||0)+(b.draws||0);
  const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

  document.getElementById('modalBody').innerHTML = `
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card stat-wins"><div class="stat-val">${b.wins||0}</div><div class="stat-label">Victoires</div></div>
      <div class="stat-card stat-losses"><div class="stat-val">${b.losses||0}</div><div class="stat-label">Défaites</div></div>
      <div class="stat-card stat-draws"><div class="stat-val">${b.draws||0}</div><div class="stat-label">Nuls</div></div>
      <div class="stat-card stat-total"><div class="stat-val">${total}</div><div class="stat-label">Combats</div></div>
    </div>

    <div class="section-title">Informations personnelles</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;margin-bottom:20px;font-size:14px">
      ${infoRow('📧', 'Email', b.email)}
      ${infoRow('📞', 'Téléphone', b.phone)}
      ${infoRow('📅', 'Date de naissance', b.date_of_birth ? new Date(b.date_of_birth).toLocaleDateString('fr-FR') : null)}
      ${infoRow('🪪', 'Licence', b.license_number)}
      ${infoRow('⚖️', 'Poids', b.weight ? b.weight + ' kg' : null)}
      ${infoRow('🏅', 'Catégorie', b.weight_category)}
      ${infoRow('📍', 'Adresse', b.physical_address, true)}
    </div>

    <div class="section-title">Documents (${b.documents.length})</div>
    <div style="margin-bottom:20px">
      ${b.documents.length ? b.documents.map(d => `
        <div class="doc-item">
          <span class="doc-icon">${docIcon(d.document_type)}</span>
          <div class="doc-info">
            <div class="doc-name">${d.original_name}</div>
            <div class="doc-meta">${d.document_type} — ${new Date(d.uploaded_at).toLocaleDateString('fr-FR')}</div>
          </div>
        </div>
      `).join('') : '<p style="color:var(--text-muted);font-size:14px">Aucun document déposé.</p>'}
    </div>

    <div class="section-title">Paiements récents</div>
    ${b.payments.length ? `
      <table>
        <thead><tr><th>Mois</th><th>Statut</th><th>Payé le</th></tr></thead>
        <tbody>
          ${b.payments.slice(0,6).map(p => `
            <tr>
              <td>${MONTHS[p.month-1]} ${p.year}</td>
              <td>${p.paid ? '<span class="badge badge-paid">✓ Payé</span>' : '<span class="badge badge-unpaid">✗ Non payé</span>'}</td>
              <td style="color:var(--text-muted);font-size:13px">${p.paid_at ? new Date(p.paid_at).toLocaleDateString('fr-FR') : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p style="color:var(--text-muted);font-size:14px">Aucun paiement enregistré.</p>'}

    <div style="margin-top:20px;display:flex;justify-content:flex-end">
      <button class="btn btn-danger btn-sm" onclick="deleteBoxer(${b.user_id})">🗑 Supprimer ce boxeur</button>
    </div>
  `;
}

const WEIGHT_CATS = [
  'Mini-mouche (−46,5 kg)','Mi-mouche (−48 kg)','Mouche (−50,8 kg)','Super-mouche (−52 kg)',
  'Coq (−53,5 kg)','Super-coq (−55,3 kg)','Plume (−57 kg)','Super-plume (−58,9 kg)',
  'Léger (−61 kg)','Super-léger (−63,5 kg)','Mi-moyen (−66 kg)','Super-mi-moyen (−69 kg)',
  'Moyen (−72 kg)','Super-moyen (−76 kg)','Mi-lourd (−80 kg)','Cruiser (−90 kg)',
  'Lourd (−90,7 kg)','Super-lourd (+90,7 kg)'
];

function renderBoxerModalEdit() {
  const b = _currentModalBoxer;
  document.getElementById('modalTitle').innerHTML = `
    ✏️ Modifier — ${fullName(b) || b.email}
    <button class="btn btn-sm btn-secondary" style="margin-left:10px;font-size:12px" onclick="renderBoxerModalView()">✕ Annuler</button>
  `;

  document.getElementById('modalBody').innerHTML = `
    <div id="editSuccess" class="success-msg"></div>
    <div id="editError" class="error-msg"></div>

    <div class="section-title">Informations personnelles</div>
    <div class="form-grid" style="margin-bottom:20px">
      <div class="form-group">
        <label>Prénom</label>
        <input type="text" id="eb_first" value="${b.first_name||''}">
      </div>
      <div class="form-group">
        <label>Nom</label>
        <input type="text" id="eb_last" value="${b.last_name||''}">
      </div>
      <div class="form-group">
        <label>Téléphone</label>
        <input type="tel" id="eb_phone" value="${b.phone||''}">
      </div>
      <div class="form-group">
        <label>Date de naissance</label>
        <input type="date" id="eb_dob" value="${b.date_of_birth||''}">
      </div>
      <div class="form-group">
        <label>Numéro de licence</label>
        <input type="text" id="eb_license" value="${b.license_number||''}">
      </div>
      <div class="form-group full-width">
        <label>Adresse physique</label>
        <input type="text" id="eb_address" value="${b.physical_address||''}">
      </div>
    </div>

    <div class="section-title">Palmarès & Condition physique</div>
    <div class="form-grid" style="margin-bottom:24px">
      <div class="form-group">
        <label>Victoires</label>
        <input type="number" id="eb_wins" min="0" value="${b.wins||0}">
      </div>
      <div class="form-group">
        <label>Défaites</label>
        <input type="number" id="eb_losses" min="0" value="${b.losses||0}">
      </div>
      <div class="form-group">
        <label>Nuls</label>
        <input type="number" id="eb_draws" min="0" value="${b.draws||0}">
      </div>
      <div class="form-group">
        <label>Poids (kg)</label>
        <input type="number" id="eb_weight" step="0.1" min="40" value="${b.weight||''}">
      </div>
      <div class="form-group">
        <label>Catégorie de poids</label>
        <select id="eb_cat">
          <option value="">— Sélectionner —</option>
          ${WEIGHT_CATS.map(c => `<option value="${c}" ${b.weight_category===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>

    <div style="display:flex;gap:12px;justify-content:flex-end">
      <button class="btn btn-secondary btn-sm" onclick="renderBoxerModalView()">Annuler</button>
      <button class="btn btn-primary" style="width:auto" onclick="saveBoxerEdit(${b.user_id})">💾 Enregistrer les modifications</button>
    </div>
  `;
}

async function saveBoxerEdit(userId) {
  const body = {
    first_name:       document.getElementById('eb_first').value.trim(),
    last_name:        document.getElementById('eb_last').value.trim(),
    phone:            document.getElementById('eb_phone').value.trim(),
    date_of_birth:    document.getElementById('eb_dob').value,
    license_number:   document.getElementById('eb_license').value.trim(),
    physical_address: document.getElementById('eb_address').value.trim(),
    wins:    parseInt(document.getElementById('eb_wins').value) || 0,
    losses:  parseInt(document.getElementById('eb_losses').value) || 0,
    draws:   parseInt(document.getElementById('eb_draws').value) || 0,
    weight:  parseFloat(document.getElementById('eb_weight').value) || null,
    weight_category: document.getElementById('eb_cat').value,
  };

  const res = await apiFetch(`/api/coach/boxers/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });

  if (!res || !res.ok) {
    const errEl = document.getElementById('editError');
    errEl.textContent = 'Erreur lors de la sauvegarde.';
    errEl.style.display = 'block';
    return;
  }

  // Update local data and go back to view
  _currentModalBoxer = { ..._currentModalBoxer, ...body };
  showToast('Profil mis à jour !', 'success');
  renderBoxerModalView();
  loadBoxerGrid(); // refresh cards
}

function infoRow(icon, label, value, fullWidth = false) {
  if (!value) return '';
  return `<div ${fullWidth ? 'style="grid-column:1/-1"' : ''}>
    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">${icon} ${label}</div>
    <div style="font-weight:500">${value}</div>
  </div>`;
}

function closeModal() {
  document.getElementById('boxerModal').classList.remove('open');
}

async function deleteBoxer(userId) {
  if (!confirm('Supprimer ce boxeur ? Cette action est irréversible.')) return;
  const res = await apiFetch(`/api/coach/boxers/${userId}`, { method: 'DELETE' });
  if (!res) return;
  closeModal();
  showToast('Boxeur supprimé', 'success');
  loadBoxerGrid();
}

// ===== COACH PAYMENTS =====

function initPaymentSelectors() {
  const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const mSel = document.getElementById('payMonth');
  const ySel = document.getElementById('payYear');
  const now = new Date();

  if (!mSel.options.length) {
    MONTHS.forEach((m, i) => {
      const opt = document.createElement('option');
      opt.value = i + 1; opt.textContent = m;
      if (i + 1 === now.getMonth() + 1) opt.selected = true;
      mSel.appendChild(opt);
    });
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 2; y--) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      if (y === now.getFullYear()) opt.selected = true;
      ySel.appendChild(opt);
    }
  }
}

async function loadCoachPayments() {
  initPaymentSelectors();
  const month = document.getElementById('payMonth').value;
  const year = document.getElementById('payYear').value;

  const res = await apiFetch(`/api/coach/payments/month?month=${month}&year=${year}`);
  if (!res) return;
  const data = await res.json();

  const paid = data.boxers.filter(b => b.paid).length;
  const unpaidCount = data.boxers.length - paid;
  document.getElementById('paymentSummaryBadge').innerHTML =
    `<span class="badge badge-paid">${paid} payé${paid>1?'s':''}</span>
     <span class="badge badge-unpaid" style="margin-left:6px">${unpaidCount} en attente</span>
     ${unpaidCount > 0 ? `<button class="btn btn-sm" style="margin-left:12px;width:auto;background:rgba(201,160,32,0.15);color:var(--primary);border:1px solid rgba(201,160,32,0.4);padding:4px 12px;font-size:12px" onclick="notifyAllUnpaid(${month},${year})">📧 Notifier les impayés (${unpaidCount})</button>` : ''}`;

  if (!data.boxers.length) {
    document.getElementById('paymentsTable').innerHTML =
      `<div class="empty-state"><div class="empty-icon">👥</div><p>Aucun boxeur inscrit.</p></div>`;
    return;
  }

  document.getElementById('paymentsTable').innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>Boxeur</th>
          <th>Licence</th>
          <th>Statut paiement</th>
        </tr></thead>
        <tbody>
          ${data.boxers.map(b => `
            <tr>
              <td>
                <div class="boxer-name">${fullName(b)}</div>
                <div class="boxer-email">${b.email}</div>
              </td>
              <td style="color:var(--text-muted);font-size:13px">${b.license_number || '—'}</td>
              <td>
                <div class="payment-toggle" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                  <label class="toggle-switch">
                    <input type="checkbox" ${b.paid ? 'checked' : ''}
                      onchange="togglePayment(${b.profile_id}, ${month}, ${year}, this.checked)">
                    <div class="toggle-track"></div>
                    <div class="toggle-thumb"></div>
                  </label>
                  <span id="pay-label-${b.profile_id}" style="font-size:13px;color:${b.paid ? 'var(--success)' : 'var(--text-muted)'}">
                    ${b.paid ? '✓ Payé' : 'Non payé'}
                  </span>
                  ${!b.paid ? `<button class="btn btn-sm" style="width:auto;padding:3px 10px;font-size:12px;background:rgba(201,160,32,0.1);color:var(--primary);border:1px solid rgba(201,160,32,0.3)" onclick="notifyOneBoxer(${b.user_id}, ${month}, ${year})">📧 Relancer</button>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function notifyAllUnpaid(month, year) {
  const res = await apiFetch('/api/coach/payments/notify', {
    method: 'POST',
    body: JSON.stringify({ month, year })
  });
  if (!res) return;
  const d = await res.json();
  showToast(`📧 ${d.sent} rappel${d.sent > 1 ? 's' : ''} envoyé${d.sent > 1 ? 's' : ''}`, 'success');
}

async function notifyOneBoxer(userId, month, year) {
  const res = await apiFetch('/api/coach/payments/notify', {
    method: 'POST',
    body: JSON.stringify({ boxer_ids: [userId], month, year })
  });
  if (!res) return;
  const d = await res.json();
  showToast(d.sent ? '📧 Rappel envoyé' : 'Erreur envoi', d.sent ? 'success' : 'error');
}

async function togglePayment(profileId, month, year, paid) {
  const res = await apiFetch(`/api/coach/payments/${profileId}/${month}/${year}`, {
    method: 'PUT',
    body: JSON.stringify({ paid })
  });
  const label = document.getElementById(`pay-label-${profileId}`);
  if (label) {
    label.textContent = paid ? '✓ Payé' : 'Non payé';
    label.style.color = paid ? 'var(--success)' : 'var(--text-muted)';
  }
  showToast(paid ? 'Paiement enregistré' : 'Paiement annulé', paid ? 'success' : 'error');
}

// ===== BOXER PROFILE =====

async function loadBoxerProfile() {
  const res = await apiFetch('/api/boxer/profile');
  if (!res) return;
  const p = await res.json();

  document.getElementById('pEmail').value = currentUser || '';
  document.getElementById('pFirstName').value = p.first_name || '';
  document.getElementById('pLastName').value = p.last_name || '';
  document.getElementById('pAddress').value = p.physical_address || '';
  document.getElementById('pLicense').value = p.license_number || '';
  document.getElementById('pWins').value = p.wins ?? '';
  document.getElementById('pLosses').value = p.losses ?? '';
  document.getElementById('pDraws').value = p.draws ?? '';
  document.getElementById('pWeight').value = p.weight || '';
  document.getElementById('pPhone').value = p.phone || '';
  document.getElementById('pDob').value = p.date_of_birth || '';

  const catSel = document.getElementById('pWeightCat');
  if (p.weight_category) {
    for (const opt of catSel.options) {
      if (opt.value === p.weight_category) { opt.selected = true; break; }
    }
  }
}

async function saveProfile() {
  const body = {
    first_name: document.getElementById('pFirstName').value.trim(),
    last_name: document.getElementById('pLastName').value.trim(),
    physical_address: document.getElementById('pAddress').value.trim(),
    license_number: document.getElementById('pLicense').value.trim(),
    wins: parseInt(document.getElementById('pWins').value) || 0,
    losses: parseInt(document.getElementById('pLosses').value) || 0,
    draws: parseInt(document.getElementById('pDraws').value) || 0,
    weight: parseFloat(document.getElementById('pWeight').value) || null,
    weight_category: document.getElementById('pWeightCat').value,
    phone: document.getElementById('pPhone').value.trim(),
    date_of_birth: document.getElementById('pDob').value,
  };

  const res = await apiFetch('/api/boxer/profile', {
    method: 'PUT',
    body: JSON.stringify(body)
  });
  if (!res) return;
  if (res.ok) showToast('Profil enregistré avec succès !', 'success');
  else showToast('Erreur lors de la sauvegarde', 'error');
}

// ===== DOCUMENTS =====

async function loadDocuments() {
  const res = await apiFetch('/api/boxer/documents');
  if (!res) return;
  const docs = await res.json();
  const list = document.getElementById('docList');
  const count = document.getElementById('docCount');
  count.textContent = `${docs.length} document${docs.length > 1 ? 's' : ''}`;

  if (!docs.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><p>Aucun document déposé pour l'instant.</p></div>`;
    return;
  }

  list.innerHTML = docs.map(d => `
    <div class="doc-item">
      <span class="doc-icon">${docIcon(d.document_type)}</span>
      <div class="doc-info">
        <div class="doc-name">${d.original_name}</div>
        <div class="doc-meta">${d.document_type} — ${new Date(d.uploaded_at).toLocaleDateString('fr-FR')}</div>
      </div>
      <button class="btn btn-danger btn-sm btn-icon" onclick="deleteDoc(${d.id})" title="Supprimer">🗑</button>
    </div>
  `).join('');
}

async function uploadDocument(file) {
  if (!file) return;
  const docType = document.getElementById('docType').value;
  const formData = new FormData();
  formData.append('document', file);
  formData.append('document_type', docType);

  const zone = document.getElementById('uploadZone');
  zone.innerHTML = '<div class="spinner"></div><p style="margin-top:10px;color:var(--text-muted)">Envoi en cours...</p>';

  const res = await fetch('/api/boxer/documents', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + getToken() },
    body: formData
  });

  zone.innerHTML = `<div class="upload-icon">📎</div><p><strong>Cliquez</strong> ou glissez un fichier ici</p><p style="margin-top:6px;font-size:12px">PDF, JPG, PNG, DOC — max 10 Mo</p>`;
  document.getElementById('fileInput').value = '';

  if (res.ok) {
    showToast('Document ajouté !', 'success');
    loadDocuments();
  } else {
    const err = await res.json();
    showToast(err.error || 'Erreur upload', 'error');
  }
}

async function deleteDoc(id) {
  if (!confirm('Supprimer ce document ?')) return;
  const res = await apiFetch(`/api/boxer/documents/${id}`, { method: 'DELETE' });
  if (res && res.ok) { showToast('Document supprimé', 'success'); loadDocuments(); }
}

function handleDragOver(e) { e.preventDefault(); document.getElementById('uploadZone').classList.add('drag-over'); }
function handleDragLeave() { document.getElementById('uploadZone').classList.remove('drag-over'); }
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) uploadDocument(file);
}

// ===== BOXER PAYMENTS =====

async function loadBoxerPayments() {
  const res = await apiFetch('/api/boxer/payments');
  if (!res) return;
  const payments = await res.json();
  const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const el = document.getElementById('boxerPaymentsTable');

  if (!payments.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">💳</div><p>Aucun paiement enregistré pour l'instant.</p></div>`;
    return;
  }

  el.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Mois</th><th>Statut</th><th>Payé le</th></tr></thead>
        <tbody>
          ${payments.map(p => `
            <tr>
              <td style="font-weight:600">${MONTHS[p.month-1]} ${p.year}</td>
              <td>${p.paid ? '<span class="badge badge-paid">✓ Payé</span>' : '<span class="badge badge-unpaid">✗ Non payé</span>'}</td>
              <td style="color:var(--text-muted);font-size:13px">${p.paid_at ? new Date(p.paid_at).toLocaleDateString('fr-FR') : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ===== UTILITIES =====

function fullName(b) {
  if (b.first_name && b.last_name) return b.first_name + ' ' + b.last_name;
  if (b.first_name) return b.first_name;
  if (b.last_name) return b.last_name;
  return b.email ? b.email.split('@')[0] : 'Boxeur';
}

function getInitials(b) {
  if (b.first_name && b.last_name) return (b.first_name[0] + b.last_name[0]).toUpperCase();
  const name = fullName(b);
  return name.substring(0, 2).toUpperCase();
}

function docIcon(type) {
  if (!type) return '📄';
  if (type.includes('médical') || type.includes('aptitude')) return '🏥';
  if (type.includes('Licence')) return '🪪';
  if (type.includes('Passeport') || type.includes('identité')) return '🛂';
  return '📄';
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// Enter key support
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const lf = document.getElementById('loginForm');
    const rf = document.getElementById('registerForm');
    if (lf && lf.style.display !== 'none') doLogin();
    else if (rf && rf.style.display !== 'none') doRegister();
  }
  if (e.key === 'Escape') { closeModal(); closeEventModal(); closeEventDetail(); closeTrainingModal(); closeTrainingDetail(); }
});

// Close modal on overlay click
document.getElementById('boxerModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
document.getElementById('eventModal').addEventListener('click', function(e) {
  if (e.target === this) closeEventModal();
});
document.getElementById('eventDetailModal').addEventListener('click', function(e) {
  if (e.target === this) closeEventDetail();
});
document.getElementById('trainingModal').addEventListener('click', function(e) {
  if (e.target === this) closeTrainingModal();
});
document.getElementById('trainingDetailModal').addEventListener('click', function(e) {
  if (e.target === this) closeTrainingDetail();
});

// ===== CALENDAR =====

const EV_TYPES = {
  boxe:      { label: 'Boxe',       icon: '🥊', css: 'ev-boxe'      },
  condition: { label: 'Condition',  icon: '💪', css: 'ev-condition'  },
  muscu:     { label: 'Muscu',      icon: '🏋️', css: 'ev-muscu'     },
  sparring:  { label: 'Sparring',   icon: '🤜', css: 'ev-sparring'   },
  cardio:    { label: 'Cardio',     icon: '🏃', css: 'ev-cardio'     },
  combat:    { label: 'Combat',     icon: '🏆', css: 'ev-combat'     },
  recreant:  { label: 'Récréant',   icon: '🎯', css: 'ev-recreant'   },
};

const EV_COLORS = {
  boxe: '#e74c3c', condition: '#2ecc71', muscu: '#e67e22',
  sparring: '#9b59b6', cardio: '#3498db', combat: '#c0392b', recreant: '#C9A020'
};

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS_FR   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

let calYear, calMonth, allEvents = [];
let editingEventId = null;

async function loadCalendar() {
  const now = new Date();
  if (!calYear) { calYear = now.getFullYear(); calMonth = now.getMonth(); }
  const res = await apiFetch('/api/events/coach');
  if (!res) return;
  allEvents = await res.json();
  renderCalendar();
  renderEventsList();
}

function renderCalendar() {
  const title = document.getElementById('calTitle');
  if (title) title.textContent = `${MONTHS_FR[calMonth]} ${calYear}`;

  const grid = document.getElementById('calGrid');
  if (!grid) return;

  // Day name headers
  let html = DAYS_FR.map(d => `<div class="cal-day-name">${d}</div>`).join('');

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay  = new Date(calYear, calMonth + 1, 0);
  const today    = new Date();

  // Offset: Monday=0
  let startOffset = (firstDay.getDay() + 6) % 7;

  // Previous month padding
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(calYear, calMonth, -i);
    html += `<div class="cal-day other-month"><div class="cal-day-num">${d.getDate()}</div></div>`;
  }

  // Days of month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===d;

    // Events on this day
    const dayEvents = allEvents.filter(ev => ev.start_date <= dateStr && ev.end_date >= dateStr);

    const dots = dayEvents.slice(0,3).map(ev => {
      const t = EV_TYPES[ev.type] || EV_TYPES.boxe;
      return `<div class="cal-event-dot ${t.css}" onclick="event.stopPropagation();openEventModal(${ev.id})" title="${ev.title}">${t.icon} ${ev.title}</div>`;
    }).join('');

    const more = dayEvents.length > 3 ? `<div style="font-size:10px;color:var(--text-muted);padding:1px 4px">+${dayEvents.length-3}</div>` : '';

    html += `<div class="cal-day ${isToday?'today':''} ${dayEvents.length?'has-events':''}" onclick="openEventModal()">
      <div class="cal-day-num">${d}</div>
      ${dots}${more}
    </div>`;
  }

  // Trailing days
  const total = startOffset + lastDay.getDate();
  const trailing = (7 - (total % 7)) % 7;
  for (let d = 1; d <= trailing; d++) {
    html += `<div class="cal-day other-month"><div class="cal-day-num">${d}</div></div>`;
  }

  grid.innerHTML = html;
}

function renderEventsList() {
  const el = document.getElementById('eventsList');
  if (!el) return;

  if (!allEvents.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>Aucun événement planifié.</p></div>`;
    return;
  }

  // Group by month
  const groups = {};
  allEvents.forEach(ev => {
    const d = new Date(ev.start_date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
    if (!groups[key]) groups[key] = { label, events: [] };
    groups[key].events.push(ev);
  });

  el.innerHTML = Object.values(groups).map(g => `
    <div class="event-month-header">${g.label}</div>
    ${g.events.map(ev => eventCardHTML(ev, true)).join('')}
  `).join('');
}

function eventCardHTML(ev, showEdit = false) {
  const t = EV_TYPES[ev.type] || EV_TYPES.boxe;
  const color = EV_COLORS[ev.type] || '#C9A020';
  const sameDay = ev.start_date === ev.end_date;

  const startFmt = new Date(ev.start_date).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
  const endFmt   = new Date(ev.end_date).toLocaleDateString('fr-FR',   { day:'numeric', month:'short' });
  const dateStr  = sameDay ? startFmt : `${startFmt} → ${endFmt}`;
  const timeStr  = ev.start_time ? (sameDay ? `${ev.start_time}${ev.end_time ? ' – '+ev.end_time : ''}` : '') : '';

  const rsvpIcon = { accepted: '✅', declined: '❌', pending: '⏳' };
  const inviteesHtml = ev.invite_all
    ? `<span class="invitee-chip" style="background:var(--gold-dim);color:var(--primary)">Tous les boxeurs</span>
       ${ev.rsvp_counts && (ev.rsvp_counts.accepted + ev.rsvp_counts.declined + ev.rsvp_counts.pending) > 0 ? `
         <span class="invitee-chip" style="background:rgba(46,204,113,0.15);color:#2ecc71">✅ ${ev.rsvp_counts.accepted}</span>
         <span class="invitee-chip" style="background:rgba(231,76,60,0.15);color:#e74c3c">❌ ${ev.rsvp_counts.declined}</span>
         <span class="invitee-chip" style="background:rgba(255,255,255,0.05);color:var(--text-muted)">⏳ ${ev.rsvp_counts.pending}</span>
       ` : ''}`
    : (ev.invitees || []).map(b => {
        const status = b.rsvp_status || 'pending';
        const icon = rsvpIcon[status] || '⏳';
        const bg = status === 'accepted' ? 'rgba(46,204,113,0.15)' : status === 'declined' ? 'rgba(231,76,60,0.15)' : 'rgba(255,255,255,0.05)';
        const col = status === 'accepted' ? '#2ecc71' : status === 'declined' ? '#e74c3c' : 'var(--text-secondary)';
        return `<span class="invitee-chip" style="background:${bg};color:${col}">${icon} ${b.first_name||b.email}</span>`;
      }).join('');

  return `
    <div class="event-card">
      <div class="event-type-bar" style="background:${color}"></div>
      <div class="event-card-main">
        <div class="event-card-title">${t.icon} ${ev.title} ${ev.is_private ? '<span style="font-size:11px;color:var(--text-muted)">🔒</span>' : ''}</div>
        <div class="event-card-meta">
          <span>📅 ${dateStr}${timeStr ? ` · ⏰ ${timeStr}` : ''}</span>
          ${ev.location ? `<span>📍 ${ev.location}${ev.country && ev.country !== 'France' ? `, ${ev.country}` : ''}</span>` : ''}
          <span class="badge" style="background:rgba(0,0,0,0.3);color:${color};font-size:11px">${t.label}</span>
        </div>
        ${ev.description ? `<div class="event-card-desc">${ev.description}</div>` : ''}
        ${inviteesHtml ? `<div class="event-card-invitees">${inviteesHtml}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;align-self:flex-start">
        <button class="btn btn-sm" style="background:var(--gold-dim);color:var(--primary);border:1px solid rgba(201,160,32,0.3)" onclick="openEventDetail(${ev.id})">👁 Détails</button>
        ${showEdit ? `<button class="btn btn-sm btn-secondary" onclick="openEventModal(${ev.id})">✏️ Modifier</button>` : ''}
      </div>
    </div>
  `;
}

function calPrevMonth() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}

function calNextMonth() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

// ===== EVENT MODAL =====

async function openEventModal(eventId = null) {
  editingEventId = eventId || null;
  const modal = document.getElementById('eventModal');
  const errEl = document.getElementById('eventModalError');
  errEl.style.display = 'none';

  // Reset form
  document.getElementById('ev_title').value = '';
  document.getElementById('ev_type').value = 'boxe';
  document.getElementById('ev_private').value = '0';
  document.getElementById('ev_start_date').value = '';
  document.getElementById('ev_start_time').value = '';
  document.getElementById('ev_end_date').value = '';
  document.getElementById('ev_end_time').value = '';
  document.getElementById('ev_location').value = '';
  document.getElementById('ev_country').value = 'France';
  document.getElementById('ev_description').value = '';
  document.getElementById('ev_invite_all').checked = false;
  document.getElementById('boxerSelectList').style.display = 'none';
  document.getElementById('evDeleteBtn').style.display = 'none';
  togglePrivate('0');

  // Load boxers for checkbox list
  await loadBoxerCheckboxes([]);

  if (eventId) {
    document.getElementById('eventModalTitle').textContent = 'Modifier l\'événement';
    document.getElementById('evDeleteBtn').style.display = 'inline-flex';
    const ev = allEvents.find(e => e.id === eventId);
    if (ev) {
      document.getElementById('ev_title').value = ev.title;
      document.getElementById('ev_type').value = ev.type;
      document.getElementById('ev_private').value = ev.is_private ? '1' : '0';
      document.getElementById('ev_start_date').value = ev.start_date;
      document.getElementById('ev_start_time').value = ev.start_time || '';
      document.getElementById('ev_end_date').value = ev.end_date;
      document.getElementById('ev_end_time').value = ev.end_time || '';
      document.getElementById('ev_location').value = ev.location || '';
      document.getElementById('ev_country').value = ev.country || 'France';
      document.getElementById('ev_description').value = ev.description || '';

      togglePrivate(ev.is_private ? '1' : '0');
      if (ev.invite_all) {
        document.getElementById('ev_invite_all').checked = true;
        document.getElementById('boxerSelectList').style.display = 'none';
      } else {
        const selected = (ev.invitees || []).map(b => b.id);
        await loadBoxerCheckboxes(selected);
        if (selected.length && ev.is_private) document.getElementById('boxerSelectList').style.display = 'block';
      }
    }
  } else {
    document.getElementById('eventModalTitle').textContent = 'Nouvel événement';
    // Default: today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('ev_start_date').value = today;
    document.getElementById('ev_end_date').value = today;
  }

  modal.classList.add('open');
}

async function loadBoxerCheckboxes(selectedIds = []) {
  const container = document.getElementById('boxerCheckboxes');
  // Use cached allBoxers if available, otherwise fetch
  let boxers = allBoxers;
  if (!boxers.length) {
    const res = await apiFetch('/api/coach/boxers');
    if (res) boxers = await res.json();
  }
  container.innerHTML = boxers.map(b => {
    const name = fullName(b) || b.email;
    const checked = selectedIds.includes(b.user_id) ? 'checked' : '';
    return `
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--input-bg)">
        <input type="checkbox" value="${b.user_id}" ${checked} style="width:16px;height:16px;accent-color:var(--primary)">
        <div>
          <div style="font-size:14px;font-weight:600">${name}</div>
          <div style="font-size:12px;color:var(--text-muted)">${b.email}</div>
        </div>
      </label>
    `;
  }).join('');
}

function togglePrivate(val) {
  const isPrivate = val === '1';
  const label = document.getElementById('ev_invite_all_label');
  if (label) label.innerHTML = isPrivate
    ? 'Inviter <strong style="color:var(--primary)">tous les boxeurs</strong>'
    : 'Notifier <strong style="color:var(--primary)">tous les boxeurs</strong> par email';
  // Boxer selection only visible when private and invite_all unchecked
  const inviteAll = document.getElementById('ev_invite_all').checked;
  document.getElementById('boxerSelectList').style.display = (isPrivate && !inviteAll) ? 'block' : 'none';
}

function toggleInviteAll(checked) {
  const isPrivate = document.getElementById('ev_private').value === '1';
  document.getElementById('boxerSelectList').style.display = (isPrivate && !checked) ? 'block' : 'none';
}

function closeEventModal() {
  document.getElementById('eventModal').classList.remove('open');
  editingEventId = null;
}

async function saveEvent() {
  const errEl = document.getElementById('eventModalError');
  errEl.style.display = 'none';

  const title      = document.getElementById('ev_title').value.trim();
  const start_date = document.getElementById('ev_start_date').value;
  const end_date   = document.getElementById('ev_end_date').value;

  if (!title)      { errEl.textContent = 'Le titre est requis.'; errEl.style.display = 'block'; return; }
  if (!start_date) { errEl.textContent = 'La date de début est requise.'; errEl.style.display = 'block'; return; }
  if (!end_date)   { errEl.textContent = 'La date de fin est requise.'; errEl.style.display = 'block'; return; }
  if (end_date < start_date) { errEl.textContent = 'La date de fin doit être après la date de début.'; errEl.style.display = 'block'; return; }

  const invite_all = document.getElementById('ev_invite_all').checked;
  let boxer_ids = [];
  if (!invite_all) {
    const checkboxes = document.querySelectorAll('#boxerCheckboxes input[type=checkbox]:checked');
    boxer_ids = Array.from(checkboxes).map(c => parseInt(c.value));
  }

  const body = {
    title,
    type:        document.getElementById('ev_type').value,
    is_private:  document.getElementById('ev_private').value === '1',
    start_date,
    end_date,
    start_time:  document.getElementById('ev_start_time').value || null,
    end_time:    document.getElementById('ev_end_time').value || null,
    location:    document.getElementById('ev_location').value.trim() || null,
    country:     document.getElementById('ev_country').value.trim() || null,
    description: document.getElementById('ev_description').value.trim() || null,
    invite_all,
    boxer_ids
  };

  const url    = editingEventId ? `/api/events/coach/${editingEventId}` : '/api/events/coach';
  const method = editingEventId ? 'PUT' : 'POST';

  const res = await apiFetch(url, { method, body: JSON.stringify(body) });
  if (!res || !res.ok) {
    const err = res ? await res.json() : {};
    errEl.textContent = err.error || 'Erreur lors de la sauvegarde.';
    errEl.style.display = 'block';
    return;
  }

  closeEventModal();
  showToast(editingEventId ? 'Événement mis à jour !' : 'Événement créé !', 'success');
  await loadCalendar();
}

async function deleteEventFromModal() {
  if (!editingEventId) return;
  if (!confirm('Supprimer cet événement ? Cette action est irréversible.')) return;
  const res = await apiFetch(`/api/events/coach/${editingEventId}`, { method: 'DELETE' });
  if (res && res.ok) {
    closeEventModal();
    showToast('Événement supprimé', 'success');
    await loadCalendar();
  }
}

// ===== BOXER EVENTS =====

async function loadBoxerEvents() {
  const res = await apiFetch('/api/events/boxer');
  if (!res) return;
  const events = await res.json();
  const el = document.getElementById('boxerEventsList');

  if (!events.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>Aucun événement à venir.</p></div>`;
    return;
  }

  const now = new Date().toISOString().split('T')[0];
  const upcoming = events.filter(ev => ev.end_date >= now);
  const past = events.filter(ev => ev.end_date < now);

  let html = '';

  if (upcoming.length) {
    html += `<h3 style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--primary);margin-bottom:14px">À venir</h3>`;
    html += upcoming.map(ev => boxerEventCardHTML(ev)).join('');
  }

  if (past.length) {
    html += `<h3 style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin:24px 0 14px">Passés</h3>`;
    html += past.map(ev => boxerEventCardHTML(ev, true)).join('');
  }

  el.innerHTML = html;
}

function boxerEventCardHTML(ev, past = false) {
  const t = EV_TYPES[ev.type] || EV_TYPES.boxe;
  const color = EV_COLORS[ev.type] || '#C9A020';
  const sameDay = ev.start_date === ev.end_date;
  const startFmt = new Date(ev.start_date).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
  const endFmt   = new Date(ev.end_date).toLocaleDateString('fr-FR',   { day:'numeric', month:'long', year:'numeric' });
  const dateStr  = sameDay ? `${startFmt}` : `Du ${startFmt} au ${endFmt}`;
  const timeStr  = ev.start_time ? ` · ${ev.start_time}${ev.end_time ? ' – '+ev.end_time : ''}` : '';

  const status = ev.rsvp_status || 'pending';
  const statusLabel = { accepted: '✅ Accepté', declined: '❌ Refusé', pending: '⏳ En attente' };
  const statusColor = { accepted: '#2ecc71', declined: '#e74c3c', pending: 'var(--text-muted)' };

  const rsvpHtml = past
    ? `<div style="font-size:12px;color:${statusColor[status]};margin-top:8px">${statusLabel[status]}</div>`
    : `<div style="display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap">
        <span style="font-size:13px;color:${statusColor[status]};font-weight:600">${statusLabel[status]}</span>
        ${status !== 'accepted' ? `<button class="btn btn-sm" style="background:rgba(46,204,113,0.15);color:#2ecc71;border:1px solid rgba(46,204,113,0.4)" onclick="event.stopPropagation();rsvpEvent(${ev.id},'accepted')">✅ Accepter</button>` : ''}
        ${status !== 'declined' ? `<button class="btn btn-sm" style="background:rgba(231,76,60,0.15);color:#e74c3c;border:1px solid rgba(231,76,60,0.4)" onclick="event.stopPropagation();rsvpEvent(${ev.id},'declined')">❌ Décliner</button>` : ''}
      </div>`;

  return `
    <div class="boxer-event-card" style="border-left-color:${color};opacity:${past?0.6:1};cursor:pointer" onclick="openEventDetail(${ev.id})">
      <div class="event-title">${t.icon} ${ev.title}</div>
      <div class="event-meta">
        <span>📅 ${dateStr}${timeStr}</span>
        ${ev.location ? `<span>📍 ${ev.location}${ev.country && ev.country !== 'France' ? `, ${ev.country}` : ''}</span>` : ''}
        <span class="badge" style="background:rgba(0,0,0,0.3);color:${color};font-size:11px;padding:2px 8px">${t.label}</span>
        ${ev.is_private ? '<span style="font-size:12px;color:var(--text-muted)">🔒 Privé</span>' : ''}
      </div>
      ${ev.description ? `<p style="font-size:13px;color:var(--text-muted);margin-top:8px">${ev.description}</p>` : ''}
      ${rsvpHtml}
    </div>
  `;
}

async function rsvpEvent(eventId, status) {
  const res = await apiFetch(`/api/events/boxer/${eventId}/rsvp`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
  if (res && res.ok) {
    showToast(status === 'accepted' ? 'Invitation acceptée !' : 'Invitation déclinée', status === 'accepted' ? 'success' : 'error');
    loadBoxerEvents();
  }
}

// ===== TRAINING SHEETS =====

const TR_TYPES = {
  muscu:     { label: 'Musculation',       icon: '🏋️', color: '#e67e22' },
  cardio:    { label: 'Cardio',            icon: '🏃', color: '#3498db' },
  boxe:      { label: 'Boxe',             icon: '🥊', color: '#e74c3c' },
  condition: { label: 'Condition physique', icon: '💪', color: '#2ecc71' },
  sparring:  { label: 'Sparring',          icon: '🤜', color: '#9b59b6' },
  recreant:  { label: 'Récréant',          icon: '🎯', color: '#C9A020' },
};

let allTrainingSheets = [];
let editingSheetId = null;
let currentSheetExercises = [];

async function loadTrainingSheets() {
  const endpoint = currentRole === 'boxer' ? '/api/training/boxer' : '/api/training/coach';
  const res = await apiFetch(endpoint);
  if (!res) return;
  allTrainingSheets = await res.json();
  renderTrainingSheets(allTrainingSheets);
}

function filterTrainingSheets() {
  const type = document.getElementById('trainingTypeFilter').value;
  const filtered = type ? allTrainingSheets.filter(s => s.type === type) : allTrainingSheets;
  renderTrainingSheets(filtered);
}

function renderTrainingSheets(sheets) {
  const gridId = currentRole === 'boxer' ? 'boxerTrainingSheetsGrid' : 'trainingSheetsGrid';
  const el = document.getElementById(gridId);
  if (!el) return;

  if (!sheets.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>${currentRole === 'boxer' ? 'Aucune fiche ne vous a été assignée.' : 'Aucune fiche d\'entraînement créée.'}</p></div>`;
    return;
  }

  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
    ${sheets.map(s => {
      const t = TR_TYPES[s.type] || TR_TYPES.muscu;
      const isCoach = currentRole === 'coach';
      const visibilityBadge = isCoach
        ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${s.is_public ? 'rgba(46,204,113,0.12)' : 'rgba(255,255,255,0.06)'};color:${s.is_public ? '#2ecc71' : 'var(--text-muted)'}">${s.is_public ? '🌐 Public' : '🔒 Privé'}</span>`
        : '';
      return `
        <div class="card" style="cursor:pointer;border-top:3px solid ${t.color};transition:transform 0.15s" onclick="openTrainingDetail(${s.id})"
          onmouseenter="this.style.transform='translateY(-2px)'" onmouseleave="this.style.transform=''">
          <div class="card-body" style="padding:16px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px">
              <div>
                <div style="font-size:16px;font-weight:700;margin-bottom:6px">${s.title}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  <span style="font-size:12px;font-weight:700;padding:2px 10px;border-radius:12px;background:${t.color}22;color:${t.color}">${t.icon} ${t.label}</span>
                  ${visibilityBadge}
                </div>
              </div>
              ${isCoach ? `
              <div style="display:flex;gap:6px;flex-shrink:0">
                <button class="btn btn-sm" style="background:var(--gold-dim);color:var(--primary);border:1px solid rgba(201,160,32,0.3);padding:4px 8px" onclick="event.stopPropagation();openTrainingModal(${s.id})">✏️</button>
                <button class="btn btn-sm btn-danger" style="padding:4px 8px" onclick="event.stopPropagation();deleteTrainingSheet(${s.id})">🗑</button>
              </div>` : ''}
            </div>
            ${s.description ? `<p style="font-size:13px;color:var(--text-muted);margin-bottom:10px;line-height:1.5">${s.description}</p>` : ''}
            <div style="font-size:12px;color:var(--text-muted)">
              📝 ${s.exercise_count} exercice${s.exercise_count !== 1 ? 's' : ''}
              ${isCoach && !s.is_public ? ` · 👤 ${s.assigned_count || 0} boxeur${s.assigned_count !== 1 ? 's' : ''}` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('')}
  </div>`;
}

let _trDraftExercises = []; // temporary exercises during creation

async function openTrainingModal(sheetId = null) {
  editingSheetId = sheetId;
  _trDraftExercises = [];
  const modal = document.getElementById('trainingModal');
  document.getElementById('trainingModalTitle').textContent = sheetId ? 'Modifier la fiche' : 'Nouvelle fiche d\'entraînement';

  let sheet = null;
  if (sheetId) {
    const res = await apiFetch(`/api/training/${sheetId}`);
    if (!res) return;
    sheet = await res.json();
    if (sheet.exercises) _trDraftExercises = sheet.exercises.map(e => ({ ...e }));
  }

  // Fetch boxers for assignment selector
  let boxers = allBoxers;
  if (!boxers.length) {
    const br = await apiFetch('/api/coach/boxers');
    if (br) boxers = await br.json();
  }

  const isPublic = sheet ? sheet.is_public : false;
  const assignedIds = sheet ? (sheet.assignments || []).map(a => a.id) : [];

  document.getElementById('trainingModalBody').innerHTML = `
    <div id="trainingFormError" class="error-msg"></div>

    <div class="section-title" style="margin-bottom:10px">Informations générales</div>
    <div class="form-grid" style="margin-bottom:16px">
      <div class="form-group full-width">
        <label>Titre de la fiche</label>
        <input type="text" id="tr_title" placeholder="Ex: Programme force — semaine 1" value="${sheet ? sheet.title : ''}">
      </div>
      <div class="form-group">
        <label>Type d'entraînement</label>
        <select id="tr_type" onchange="renderTrExercisePlaceholders()">
          <option value="muscu" ${!sheet || sheet.type==='muscu'?'selected':''}>🏋️ Musculation</option>
          <option value="cardio" ${sheet?.type==='cardio'?'selected':''}>🏃 Cardio</option>
          <option value="boxe" ${sheet?.type==='boxe'?'selected':''}>🥊 Boxe</option>
          <option value="condition" ${sheet?.type==='condition'?'selected':''}>💪 Condition physique</option>
          <option value="sparring" ${sheet?.type==='sparring'?'selected':''}>🤜 Sparring</option>
          <option value="recreant" ${sheet?.type==='recreant'?'selected':''}>🎯 Récréant</option>
        </select>
      </div>
      <div class="form-group">
        <label>Visibilité</label>
        <select id="tr_public" onchange="toggleTrVisibility(this.value)">
          <option value="0" ${!isPublic?'selected':''}>🔒 Privé (boxeurs assignés)</option>
          <option value="1" ${isPublic?'selected':''}>🌐 Public (tous les boxeurs)</option>
        </select>
      </div>
      <div class="form-group full-width">
        <label>Description (objectifs, contexte…)</label>
        <textarea id="tr_description" rows="2" placeholder="Développement de la force maximale, séance A…">${sheet ? (sheet.description||'') : ''}</textarea>
      </div>
      <div class="form-group full-width">
        <label>Notes coach</label>
        <textarea id="tr_notes" rows="2" placeholder="Repos complet entre les séries, hydratation…">${sheet ? (sheet.notes||'') : ''}</textarea>
      </div>
    </div>

    <!-- Boxer assignment (private only) -->
    <div id="tr_boxer_section" style="display:${isPublic?'none':'block'};margin-bottom:16px">
      <div class="section-title" style="margin-bottom:8px">Boxeurs assignés</div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:150px;overflow-y:auto">
        ${boxers.map(b => `
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--input-bg)">
            <input type="checkbox" value="${b.user_id}" ${assignedIds.includes(b.user_id)?'checked':''} style="width:15px;height:15px;accent-color:var(--primary)">
            <div>
              <div style="font-size:13px;font-weight:600">${b.first_name||''} ${b.last_name||b.email}</div>
              <div style="font-size:11px;color:var(--text-muted)">${b.email}</div>
            </div>
          </label>
        `).join('')}
      </div>
    </div>

    <!-- Inline exercises -->
    <div class="section-title" style="margin-bottom:10px">Exercices</div>
    <div id="tr_exercises_list" style="margin-bottom:10px"></div>
    <button class="btn btn-sm btn-secondary" style="margin-bottom:16px" onclick="addTrDraftExercise()">➕ Ajouter un exercice</button>

    <div style="display:flex;justify-content:flex-end;gap:10px">
      <button class="btn btn-secondary btn-sm" onclick="closeTrainingModal()">Annuler</button>
      <button class="btn btn-primary" style="width:auto" onclick="saveTrainingSheet()">💾 ${sheetId ? 'Enregistrer' : 'Créer la fiche'}</button>
    </div>
  `;

  renderTrDraftExercises();
  modal.classList.add('open');
}

function toggleTrVisibility(val) {
  document.getElementById('tr_boxer_section').style.display = val === '1' ? 'none' : 'block';
}

function renderTrExercisePlaceholders() {
  renderTrDraftExercises();
}

function renderTrDraftExercises() {
  const type = document.getElementById('tr_type')?.value || 'muscu';
  const isCardio = ['cardio', 'condition'].includes(type);
  const isBoxe   = ['boxe', 'sparring'].includes(type);
  const colSets = isBoxe ? 'Rounds' : 'Séries';
  const colReps = isCardio ? 'Durée' : isBoxe ? 'Durée/round' : 'Rép.';

  const el = document.getElementById('tr_exercises_list');
  if (!el) return;

  if (!_trDraftExercises.length) {
    el.innerHTML = `<p style="font-size:13px;color:var(--text-muted);padding:8px 0">Aucun exercice. Cliquez sur "Ajouter" ci-dessous.</p>`;
    return;
  }

  el.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr>
      <th style="width:32px">#</th>
      <th>Exercice</th>
      <th style="width:70px">${colSets}</th>
      <th style="width:80px">${colReps}</th>
      <th style="width:90px">Récup.</th>
      <th style="width:32px"></th>
    </tr></thead>
    <tbody>
      ${_trDraftExercises.map((ex, i) => `
        <tr>
          <td style="color:var(--text-muted);font-size:12px">${i+1}</td>
          <td>
            <input type="text" value="${ex.name||''}" oninput="_trDraftExercises[${i}].name=this.value"
              placeholder="Nom de l'exercice"
              style="width:100%;padding:5px 8px;background:var(--input-bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:13px">
            <input type="text" value="${ex.notes||''}" oninput="_trDraftExercises[${i}].notes=this.value"
              placeholder="Note (optionnel)"
              style="width:100%;padding:3px 8px;margin-top:3px;background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text-muted);font-size:11px">
          </td>
          <td><input type="text" value="${ex.sets||''}" oninput="_trDraftExercises[${i}].sets=this.value"
            style="width:100%;padding:5px 6px;background:var(--input-bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:13px;text-align:center"></td>
          <td><input type="text" value="${ex.reps||ex.duration||''}" oninput="_trDraftExercises[${i}].reps=this.value"
            style="width:100%;padding:5px 6px;background:var(--input-bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:13px;text-align:center"></td>
          <td><input type="text" value="${ex.rest||''}" oninput="_trDraftExercises[${i}].rest=this.value"
            style="width:100%;padding:5px 6px;background:var(--input-bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:13px;text-align:center"></td>
          <td><button class="btn btn-sm btn-danger" style="padding:3px 6px" onclick="_trDraftExercises.splice(${i},1);renderTrDraftExercises()">✕</button></td>
        </tr>
      `).join('')}
    </tbody>
  </table></div>`;
}

function addTrDraftExercise() {
  _trDraftExercises.push({ name: '', sets: '', reps: '', duration: '', rest: '', notes: '' });
  renderTrDraftExercises();
  // Focus last name input
  setTimeout(() => {
    const inputs = document.querySelectorAll('#tr_exercises_list input[type=text]');
    if (inputs.length) inputs[inputs.length - 5]?.focus();
  }, 50);
}

function closeTrainingModal() {
  document.getElementById('trainingModal').classList.remove('open');
  editingSheetId = null;
  _trDraftExercises = [];
}

async function saveTrainingSheet() {
  const title = document.getElementById('tr_title').value.trim();
  const errEl = document.getElementById('trainingFormError');
  if (!title) { errEl.textContent = 'Le titre est requis.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  const is_public = document.getElementById('tr_public').value === '1';
  const boxer_ids = is_public ? [] : Array.from(document.querySelectorAll('#tr_boxer_section input[type=checkbox]:checked')).map(c => parseInt(c.value));
  const exercises = _trDraftExercises.filter(e => e.name?.trim());

  const body = {
    title,
    type: document.getElementById('tr_type').value,
    description: document.getElementById('tr_description').value.trim() || null,
    notes: document.getElementById('tr_notes').value.trim() || null,
    is_public,
    boxer_ids,
    exercises,
  };

  const url = editingSheetId ? `/api/training/${editingSheetId}` : '/api/training';
  const method = editingSheetId ? 'PUT' : 'POST';
  const res = await apiFetch(url, { method, body: JSON.stringify(body) });
  if (!res || !res.ok) { errEl.textContent = 'Erreur lors de la sauvegarde.'; errEl.style.display = 'block'; return; }

  const data = await res.json();
  closeTrainingModal();
  showToast(editingSheetId ? 'Fiche mise à jour !' : 'Fiche créée !', 'success');
  await loadTrainingSheets();

  if (!editingSheetId && data.id) {
    // Reload current sheet state from server then open detail
    const fresh = await apiFetch(`/api/training/${data.id}`);
    if (fresh) { _currentSheet = await fresh.json(); renderTrainingDetail(); document.getElementById('trainingDetailModal').classList.add('open'); }
  }
}

async function deleteTrainingSheet(id) {
  if (!confirm('Supprimer cette fiche ? Les exercices seront perdus.')) return;
  const res = await apiFetch(`/api/training/${id}`, { method: 'DELETE' });
  if (res && res.ok) { showToast('Fiche supprimée', 'success'); loadTrainingSheets(); }
}

// ===== TRAINING DETAIL (exercises) =====

let _currentSheet = null;

async function openTrainingDetail(sheetId) {
  const res = await apiFetch(`/api/training/${sheetId}`);
  if (!res) return;
  _currentSheet = await res.json();
  renderTrainingDetail();
  document.getElementById('trainingDetailModal').classList.add('open');
}

function closeTrainingDetail() {
  document.getElementById('trainingDetailModal').classList.remove('open');
  _currentSheet = null;
  loadTrainingSheets();
}

function renderTrainingDetail() {
  const s = _currentSheet;
  const t = TR_TYPES[s.type] || TR_TYPES.muscu;
  const isCoach = currentRole === 'coach';

  document.getElementById('trainingDetailTitle').innerHTML =
    `${t.icon} ${s.title} <span style="font-size:13px;padding:2px 10px;border-radius:12px;background:${t.color}22;color:${t.color};font-weight:700;margin-left:8px">${t.label}</span>`;

  const isCardio = ['cardio', 'condition'].includes(s.type);
  const isBoxe   = ['boxe', 'sparring'].includes(s.type);

  const colSets     = isBoxe ? 'Rounds' : 'Séries';
  const colReps     = isCardio ? 'Durée' : isBoxe ? 'Durée/round' : 'Répétitions';
  const colDuration = isCardio ? 'Distance/intensité' : 'Temps sous tension';

  const exercisesHtml = !s.exercises.length
    ? `<div class="empty-state" style="padding:30px"><div class="empty-icon">🏋️</div><p>Aucun exercice${isCoach ? '. Ajoutez-en ci-dessous.' : '.'}</p></div>`
    : `<div class="table-wrapper">
        <table>
          <thead><tr>
            <th>#</th>
            <th>Exercice</th>
            <th>${colSets}</th>
            <th>${colReps}</th>
            <th>${colDuration}</th>
            <th>Récupération</th>
            ${isCoach ? '<th></th>' : ''}
          </tr></thead>
          <tbody>
            ${s.exercises.map((ex, i) => `
              <tr id="ex-row-${ex.id}">
                <td style="color:var(--text-muted);font-size:13px">${i+1}</td>
                <td style="font-weight:600">${ex.name}${ex.notes ? `<div style="font-size:12px;color:var(--text-muted);font-weight:400">${ex.notes}</div>` : ''}</td>
                <td>${ex.sets ?? '—'}</td>
                <td>${ex.reps ?? '—'}</td>
                <td>${ex.duration ?? '—'}</td>
                <td>${ex.rest ?? '—'}</td>
                ${isCoach ? `<td style="display:flex;gap:6px">
                  <button class="btn btn-sm" style="padding:3px 8px;background:var(--gold-dim);color:var(--primary);border:1px solid rgba(201,160,32,0.3)" onclick="editExerciseRow(${ex.id})">✏️</button>
                  <button class="btn btn-sm btn-danger" style="padding:3px 8px" onclick="deleteExercise(${ex.id})">🗑</button>
                </td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;

  const addExerciseFormHtml = isCoach ? `
    <div style="margin-top:20px;padding:16px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px">
      <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:12px">➕ Ajouter un exercice</div>
      <div class="form-grid" style="margin-bottom:12px">
        <div class="form-group full-width">
          <label>Nom de l'exercice</label>
          <input type="text" id="ex_name" placeholder="${isCardio ? 'Ex: Course à pied, Vélo, Rameur…' : isBoxe ? 'Ex: Shadow boxing, Paos, Sac…' : 'Ex: Développé couché, Squat, Tirage…'}">
        </div>
        <div class="form-group">
          <label>${colSets}</label>
          <input type="text" id="ex_sets" placeholder="${isBoxe ? '3' : '4'}">
        </div>
        <div class="form-group">
          <label>${colReps}</label>
          <input type="text" id="ex_reps" placeholder="${isCardio ? '20 min' : isBoxe ? '3 min' : '8-10'}">
        </div>
        <div class="form-group">
          <label>${colDuration}</label>
          <input type="text" id="ex_duration" placeholder="${isCardio ? 'Zone 2' : isBoxe ? '' : '3s excentrique'}">
        </div>
        <div class="form-group">
          <label>Récupération</label>
          <input type="text" id="ex_rest" placeholder="${isBoxe ? '1 min' : '90 sec'}">
        </div>
        <div class="form-group full-width">
          <label>Notes</label>
          <input type="text" id="ex_notes" placeholder="Consignes, technique, charge…">
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end">
        <button class="btn btn-primary" style="width:auto" onclick="addExercise()">➕ Ajouter</button>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:16px;gap:10px">
      <button class="btn btn-sm btn-secondary" onclick="closeTrainingDetail();openTrainingModal(${s.id})">✏️ Modifier la fiche</button>
    </div>` : `
    <div style="display:flex;justify-content:flex-end;margin-top:20px">
      <button class="btn btn-primary" style="width:auto" onclick="openPerformanceForm()">📊 Enregistrer ma séance</button>
    </div>
    <div id="performanceFormContainer"></div>
    <div id="performanceHistoryContainer"></div>`;

  document.getElementById('trainingDetailBody').innerHTML = `
    ${s.description ? `<p style="color:var(--text-muted);font-size:14px;margin-bottom:16px;line-height:1.6">${s.description}</p>` : ''}
    ${s.notes ? `<div style="padding:12px 16px;background:rgba(201,160,32,0.08);border:1px solid rgba(201,160,32,0.2);border-radius:8px;margin-bottom:16px;font-size:13px">
      <span style="color:var(--primary);font-weight:700">💡 Note coach : </span>${s.notes}
    </div>` : ''}

    <div class="section-title" style="margin-bottom:12px">Exercices (${s.exercises.length})</div>
    ${exercisesHtml}
    ${addExerciseFormHtml}
  `;

  if (!isCoach) loadPerformanceHistory();
}

async function openPerformanceForm() {
  const s = _currentSheet;
  const today = new Date().toISOString().split('T')[0];
  const container = document.getElementById('performanceFormContainer');

  const exerciseRows = s.exercises.length ? s.exercises.map(ex => `
    <div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="font-weight:600;margin-bottom:6px">${ex.name}</div>
      <div class="form-grid" style="gap:8px">
        <div class="form-group">
          <label style="font-size:12px">Réalisé (séries/reps/durée…)</label>
          <input type="text" id="perf_achieved_${ex.id}" placeholder="Ex: 4x10, 20 min, 3 rounds…">
        </div>
        <div class="form-group">
          <label style="font-size:12px">Notes</label>
          <input type="text" id="perf_notes_${ex.id}" placeholder="Ressenti, charge, difficulté…">
        </div>
      </div>
    </div>
  `).join('') : `<div class="form-group"><label>Notes globales</label><textarea id="perf_global_notes" rows="3" placeholder="Décrivez votre séance…"></textarea></div>`;

  container.innerHTML = `
    <div style="margin-top:20px;padding:20px;background:var(--input-bg);border:2px solid rgba(201,160,32,0.3);border-radius:12px">
      <div style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--primary);margin-bottom:16px">📊 Ma séance</div>
      <div class="form-group" style="margin-bottom:16px">
        <label>Date de la séance</label>
        <input type="date" id="perf_date" value="${today}">
      </div>
      ${exerciseRows}
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
        <button class="btn btn-secondary" style="width:auto" onclick="document.getElementById('performanceFormContainer').innerHTML=''">Annuler</button>
        <button class="btn btn-primary" style="width:auto" onclick="savePerformance()">💾 Enregistrer</button>
      </div>
    </div>
  `;
}

async function savePerformance() {
  const s = _currentSheet;
  const session_date = document.getElementById('perf_date').value;
  if (!session_date) { showToast('Date requise', 'error'); return; }

  let exercises = [];
  if (s.exercises.length) {
    exercises = s.exercises.map(ex => ({
      exercise_id: ex.id,
      achieved: (document.getElementById(`perf_achieved_${ex.id}`) || {}).value || null,
      notes: (document.getElementById(`perf_notes_${ex.id}`) || {}).value || null,
    }));
  }

  const body = { session_date, exercises };
  if (!s.exercises.length) {
    body.notes = (document.getElementById('perf_global_notes') || {}).value || null;
  }

  const res = await apiFetch(`/api/training/${s.id}/performance`, { method: 'POST', body: JSON.stringify(body) });
  if (res.ok) {
    showToast('Séance enregistrée !', 'success');
    document.getElementById('performanceFormContainer').innerHTML = '';
    loadPerformanceHistory();
  } else {
    const d = await res.json();
    showToast(d.error || 'Erreur', 'error');
  }
}

async function loadPerformanceHistory() {
  const s = _currentSheet;
  const res = await apiFetch(`/api/training/${s.id}/performance`);
  if (!res.ok) return;
  const rows = await res.json();
  const container = document.getElementById('performanceHistoryContainer');
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `<div style="margin-top:24px;color:var(--text-muted);font-size:14px;text-align:center;padding:20px">Aucune séance enregistrée.</div>`;
    return;
  }

  // Group by date
  const byDate = {};
  rows.forEach(r => {
    if (!byDate[r.session_date]) byDate[r.session_date] = [];
    byDate[r.session_date].push(r);
  });

  const sessionsHtml = Object.entries(byDate).map(([date, entries]) => {
    const entriesHtml = entries.map(e => `
      <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
        ${e.exercise_name ? `<span style="font-weight:600;color:var(--text)">${e.exercise_name}</span> — ` : ''}
        ${e.achieved ? `<span style="color:var(--primary)">${e.achieved}</span>` : ''}
        ${e.notes ? `<span style="color:var(--text-muted)"> · ${e.notes}</span>` : ''}
      </div>
    `).join('');
    return `
      <div style="margin-bottom:12px;padding:14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px">
        <div style="font-weight:700;font-size:13px;color:var(--primary);margin-bottom:8px">📅 ${new Date(date).toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
        ${entriesHtml}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div style="margin-top:28px">
      <div class="section-title" style="margin-bottom:12px">Historique de mes séances</div>
      ${sessionsHtml}
    </div>
  `;
}

async function addExercise() {
  const name = document.getElementById('ex_name').value.trim();
  if (!name) { showToast('Nom requis', 'error'); return; }

  const body = {
    name,
    sets:     document.getElementById('ex_sets').value.trim() || null,
    reps:     document.getElementById('ex_reps').value.trim() || null,
    duration: document.getElementById('ex_duration').value.trim() || null,
    rest:     document.getElementById('ex_rest').value.trim() || null,
    notes:    document.getElementById('ex_notes').value.trim() || null,
  };

  const res = await apiFetch(`/api/training/${_currentSheet.id}/exercises`, { method: 'POST', body: JSON.stringify(body) });
  if (!res || !res.ok) { showToast('Erreur', 'error'); return; }

  showToast('Exercice ajouté !', 'success');
  // Refresh the sheet
  const sheetRes = await apiFetch(`/api/training/${_currentSheet.id}`);
  _currentSheet = await sheetRes.json();
  renderTrainingDetail();
}

async function deleteExercise(exId) {
  if (!confirm('Supprimer cet exercice ?')) return;
  const res = await apiFetch(`/api/training/${_currentSheet.id}/exercises/${exId}`, { method: 'DELETE' });
  if (res && res.ok) {
    showToast('Exercice supprimé', 'success');
    const sheetRes = await apiFetch(`/api/training/${_currentSheet.id}`);
    _currentSheet = await sheetRes.json();
    renderTrainingDetail();
  }
}

function editExerciseRow(exId) {
  const ex = _currentSheet.exercises.find(e => e.id === exId);
  if (!ex) return;
  const t = TR_TYPES[_currentSheet.type] || TR_TYPES.muscu;
  const isCardio = ['cardio', 'condition'].includes(_currentSheet.type);
  const isBoxe   = ['boxe', 'sparring'].includes(_currentSheet.type);
  const colSets = isBoxe ? 'Rounds' : 'Séries';
  const colReps = isCardio ? 'Durée' : isBoxe ? 'Durée/round' : 'Rép.';
  const colDur  = isCardio ? 'Distance/intensité' : 'Temps sous tension';

  const row = document.getElementById(`ex-row-${exId}`);
  row.innerHTML = `
    <td style="color:var(--text-muted);font-size:13px">${_currentSheet.exercises.indexOf(ex)+1}</td>
    <td><input type="text" value="${ex.name}" id="eed_name_${exId}" style="width:100%;padding:6px;background:var(--input-bg);border:1px solid var(--border);border-radius:6px;color:var(--text)"></td>
    <td><input type="text" value="${ex.sets||''}" id="eed_sets_${exId}" style="width:60px;padding:6px;background:var(--input-bg);border:1px solid var(--border);border-radius:6px;color:var(--text)"></td>
    <td><input type="text" value="${ex.reps||''}" id="eed_reps_${exId}" style="width:70px;padding:6px;background:var(--input-bg);border:1px solid var(--border);border-radius:6px;color:var(--text)"></td>
    <td><input type="text" value="${ex.duration||''}" id="eed_dur_${exId}" style="width:80px;padding:6px;background:var(--input-bg);border:1px solid var(--border);border-radius:6px;color:var(--text)"></td>
    <td><input type="text" value="${ex.rest||''}" id="eed_rest_${exId}" style="width:70px;padding:6px;background:var(--input-bg);border:1px solid var(--border);border-radius:6px;color:var(--text)"></td>
    <td style="display:flex;gap:6px">
      <button class="btn btn-sm" style="padding:3px 8px;background:rgba(46,204,113,0.15);color:#2ecc71;border:1px solid rgba(46,204,113,0.4)" onclick="saveExerciseRow(${exId})">✓</button>
      <button class="btn btn-sm btn-secondary" style="padding:3px 8px" onclick="renderTrainingDetail()">✕</button>
    </td>
  `;
}

async function saveExerciseRow(exId) {
  const body = {
    name:     document.getElementById(`eed_name_${exId}`).value.trim(),
    sets:     document.getElementById(`eed_sets_${exId}`).value.trim() || null,
    reps:     document.getElementById(`eed_reps_${exId}`).value.trim() || null,
    duration: document.getElementById(`eed_dur_${exId}`).value.trim() || null,
    rest:     document.getElementById(`eed_rest_${exId}`).value.trim() || null,
    notes:    null,
  };
  if (!body.name) { showToast('Nom requis', 'error'); return; }

  const res = await apiFetch(`/api/training/${_currentSheet.id}/exercises/${exId}`, { method: 'PUT', body: JSON.stringify(body) });
  if (res && res.ok) {
    showToast('Exercice mis à jour', 'success');
    const sheetRes = await apiFetch(`/api/training/${_currentSheet.id}`);
    _currentSheet = await sheetRes.json();
    renderTrainingDetail();
    loadTrainingSheets();
  }
}

// ===== EVENT DETAIL MODAL =====

async function openEventDetail(eventId) {
  const res = await apiFetch(`/api/events/${eventId}`);
  if (!res || !res.ok) return;
  const ev = await res.json();

  const t = EV_TYPES[ev.type] || EV_TYPES.boxe;
  const color = EV_COLORS[ev.type] || '#C9A020';
  const sameDay = ev.start_date === ev.end_date;
  const startFmt = new Date(ev.start_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const endFmt   = new Date(ev.end_date).toLocaleDateString('fr-FR',   { day: 'numeric', month: 'long', year: 'numeric' });

  document.getElementById('evDetailTitle').innerHTML =
    `${t.icon} ${ev.title} ${ev.is_private ? '<span style="font-size:13px;color:var(--text-muted)">🔒 Privé</span>' : ''}`;

  const rsvpIcon  = { accepted: '✅', declined: '❌', pending: '⏳' };
  const rsvpLabel = { accepted: 'Accepté', declined: 'Refusé', pending: 'En attente' };
  const rsvpBg    = { accepted: 'rgba(46,204,113,0.12)', declined: 'rgba(231,76,60,0.12)', pending: 'rgba(255,255,255,0.05)' };
  const rsvpCol   = { accepted: '#2ecc71', declined: '#e74c3c', pending: 'var(--text-muted)' };

  const counts = ev.rsvp_counts || { accepted: 0, declined: 0, pending: 0 };
  const total  = ev.invitees ? ev.invitees.length : 0;

  const inviteesHtml = !ev.invitees || !ev.invitees.length
    ? '<p style="color:var(--text-muted);font-size:14px">Aucun boxeur invité.</p>'
    : `
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
        <span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:rgba(46,204,113,0.15);color:#2ecc71">✅ ${counts.accepted} accepté${counts.accepted > 1 ? 's' : ''}</span>
        <span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:rgba(231,76,60,0.15);color:#e74c3c">❌ ${counts.declined} refusé${counts.declined > 1 ? 's' : ''}</span>
        <span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:rgba(255,255,255,0.07);color:var(--text-muted)">⏳ ${counts.pending} en attente</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto;padding-right:4px">
        ${ev.invitees.map(b => {
          const status = b.rsvp_status || 'pending';
          const name = (b.first_name || b.last_name) ? `${b.first_name||''} ${b.last_name||''}`.trim() : b.email;
          return `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;background:${rsvpBg[status]};border:1px solid ${rsvpCol[status]}22">
              <div style="width:34px;height:34px;border-radius:50%;background:var(--gold-dim);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">🥊</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:14px">${name}</div>
                <div style="font-size:12px;color:var(--text-muted)">${b.email}</div>
              </div>
              <span style="font-size:13px;font-weight:700;color:${rsvpCol[status]};white-space:nowrap">${rsvpIcon[status]} ${rsvpLabel[status]}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

  document.getElementById('evDetailBody').innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
      <span style="padding:4px 14px;border-radius:20px;font-size:13px;font-weight:700;background:${color}22;color:${color}">${t.icon} ${t.label}</span>
      ${ev.is_private ? '<span style="padding:4px 14px;border-radius:20px;font-size:12px;background:rgba(255,255,255,0.06);color:var(--text-muted)">🔒 Privé</span>' : '<span style="padding:4px 14px;border-radius:20px;font-size:12px;background:rgba(255,255,255,0.06);color:var(--text-muted)">🌐 Public</span>'}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="padding:12px 16px;background:var(--input-bg);border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">📅 Date</div>
        <div style="font-size:14px;font-weight:600">${sameDay ? startFmt : `${startFmt} → ${endFmt}`}</div>
      </div>
      ${ev.start_time ? `
      <div style="padding:12px 16px;background:var(--input-bg);border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">⏰ Horaire</div>
        <div style="font-size:14px;font-weight:600">${ev.start_time}${ev.end_time ? ' – ' + ev.end_time : ''}</div>
      </div>` : ''}
      ${ev.location ? `
      <div style="padding:12px 16px;background:var(--input-bg);border-radius:8px;border:1px solid var(--border);grid-column:1/-1">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">📍 Lieu</div>
        <div style="font-size:14px;font-weight:600">${ev.location}${ev.country && ev.country !== 'France' ? `, ${ev.country}` : ''}</div>
      </div>` : ''}
    </div>

    ${ev.description ? `
    <div style="padding:14px 16px;background:var(--input-bg);border-radius:8px;border:1px solid var(--border);margin-bottom:16px">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">📝 Description</div>
      <p style="font-size:14px;line-height:1.6;color:var(--text)">${ev.description}</p>
    </div>` : ''}

    <div class="section-title" style="margin-bottom:12px">
      Boxeurs invités ${total > 0 ? `<span style="font-size:12px;font-weight:400;color:var(--text-muted)">(${total})</span>` : ''}
      ${ev.invite_all ? '<span style="font-size:12px;color:var(--primary);font-weight:600;margin-left:6px">— Tous les boxeurs</span>' : ''}
    </div>
    ${inviteesHtml}

    ${currentRole === 'coach' ? `
    <div style="margin-top:20px;display:flex;justify-content:flex-end">
      <button class="btn btn-sm btn-secondary" onclick="closeEventDetail();openEventModal(${ev.id})">✏️ Modifier</button>
    </div>` : ''}
  `;

  document.getElementById('eventDetailModal').classList.add('open');
}

function closeEventDetail() {
  document.getElementById('eventDetailModal').classList.remove('open');
}

// ===== ADMIN =====

function returnToAdmin() {
  const adminToken = localStorage.getItem('bm_admin_token');
  if (!adminToken) return;
  localStorage.removeItem('bm_admin_token');
  setToken(adminToken);
  localStorage.setItem('bm_role', 'admin');
  localStorage.setItem('bm_email', 'admin@snatch.fr');
  initApp('admin', 'admin@snatch.fr');
}

async function loadAdminUsers() {
  const res = await apiFetch('/api/admin/users');
  if (!res) return;
  const users = await res.json();
  const el = document.getElementById('adminUsersList');

  const roleLabel = { coach: '🏆 Coach', boxer: '🥊 Boxeur' };
  const roleColor = { coach: 'var(--primary)', boxer: 'var(--text-secondary)' };

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${users.map(u => {
        const name = (u.first_name || u.last_name) ? `${u.first_name||''} ${u.last_name||''}`.trim() : null;
        return `
          <div style="display:flex;align-items:center;gap:14px;padding:14px 18px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px">
            <div style="width:42px;height:42px;border-radius:50%;background:var(--gold-dim);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">
              ${u.role === 'coach' ? '🏆' : '🥊'}
            </div>
            <div style="flex:1;min-width:0">
              ${name ? `<div style="font-weight:700;font-size:15px">${name}</div>` : ''}
              <div style="font-size:13px;color:var(--text-muted)">${u.email}</div>
              <span style="font-size:11px;color:${roleColor[u.role]};font-weight:600;text-transform:uppercase;letter-spacing:0.5px">${roleLabel[u.role]}</span>
            </div>
            <button class="btn btn-sm" style="background:var(--gold-dim);color:var(--primary);border:1px solid rgba(201,160,32,0.4);flex-shrink:0"
              onclick="impersonateUser(${u.id}, '${u.email}')">
              🔑 Se connecter
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function impersonateUser(userId, email) {
  const res = await apiFetch(`/api/admin/impersonate/${userId}`, { method: 'POST' });
  if (!res || !res.ok) { showToast('Erreur d\'impersonation', 'error'); return; }
  const data = await res.json();

  // Store admin token to be able to go back
  localStorage.setItem('bm_admin_token', getToken());

  setToken(data.token);
  localStorage.setItem('bm_role', data.role);
  localStorage.setItem('bm_email', data.email);
  showToast(`Connecté en tant que ${email}`, 'success');
  initApp(data.role, data.email);
}

// ===== AUTO LOGIN =====
(function checkSession() {
  const token = getToken();
  const role = localStorage.getItem('bm_role');
  const email = localStorage.getItem('bm_email');
  if (token && role && email) initApp(role, email);
})();
