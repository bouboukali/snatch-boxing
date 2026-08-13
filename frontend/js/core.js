// ===== GLOBALS =====
const API = '';
let currentRole = null;
let currentUser = null;
let allBoxers = [];

// ===== AUTH =====

function getToken() { return localStorage.getItem('bm_token'); }
function setToken(t) { localStorage.setItem('bm_token', t); }
function clearToken() { localStorage.removeItem('bm_token'); localStorage.removeItem('bm_role'); localStorage.removeItem('bm_email'); localStorage.removeItem('bm_admin_token'); }

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

  let data, res;

  res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  data = await res.json();

  if (!res.ok) {
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
  localStorage.setItem('bm_must_change_pwd', data.must_change_password ? '1' : '0');
  if (data.role !== 'admin') localStorage.removeItem('bm_admin_token');

  if (data.must_change_password) {
    showChangePasswordScreen();
    return;
  }

  initApp(data.role, data.email);
}

function showChangePasswordScreen() {
  document.getElementById('authPage').innerHTML = `
    <div class="auth-box">
      <div class="auth-logo">
        <img src="/logo.png" class="site-logo-img" alt="Snatch Boxing Academy">
      </div>
      <h3 style="text-align:center;margin-bottom:6px;font-size:18px">Première connexion</h3>
      <p style="text-align:center;color:var(--text-muted);font-size:13px;margin-bottom:20px">Choisissez un nouveau mot de passe pour sécuriser votre compte.</p>
      <div id="changePwdError" class="error-msg"></div>
      <div class="form-group">
        <label>Nouveau mot de passe</label>
        <input type="password" id="newPwd1" placeholder="Min. 6 caractères">
      </div>
      <div class="form-group">
        <label>Confirmer le mot de passe</label>
        <input type="password" id="newPwd2" placeholder="Répétez le mot de passe">
      </div>
      <button class="btn btn-primary" onclick="submitNewPassword()">Confirmer</button>
    </div>
  `;
}

async function submitNewPassword() {
  const p1 = document.getElementById('newPwd1').value;
  const p2 = document.getElementById('newPwd2').value;
  const errEl = document.getElementById('changePwdError');

  if (p1.length < 6) { errEl.textContent = 'Minimum 6 caractères.'; errEl.style.display = 'block'; return; }
  if (p1 !== p2) { errEl.textContent = 'Les mots de passe ne correspondent pas.'; errEl.style.display = 'block'; return; }

  const res = await apiFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ new_password: p1 })
  });
  if (!res || !res.ok) { errEl.textContent = 'Erreur lors du changement.'; errEl.style.display = 'block'; return; }

  localStorage.setItem('bm_must_change_pwd', '0');
  showToast('Mot de passe mis à jour !', 'success');
  const role = localStorage.getItem('bm_role');
  const email = localStorage.getItem('bm_email');
  initApp(role, email);
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
  document.getElementById('sidebarRole').textContent = role === 'coach' ? 'Coach' : role === 'admin' ? 'Admin' : 'Boxeur';
  document.getElementById('sidebarEmail').textContent = email;

  buildNav(role);

  const adminToken = localStorage.getItem('bm_admin_token');
  const footer = document.querySelector('.sidebar-footer');
  const existingBack = document.getElementById('backToAdminBtn');
  if (existingBack) existingBack.remove();
  if (adminToken && role !== 'admin') {
    const btn = document.createElement('button');
    btn.id = 'backToAdminBtn';
    btn.className = 'logout-btn';
    btn.style.cssText = 'background:rgba(201,160,32,0.15);color:var(--primary);border:1px solid rgba(201,160,32,0.3);margin-bottom:8px';
    btn.innerHTML = 'Retour admin';
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
    showPage('boxer-dashboard');
    loadBoxerDashboard();
  }
}

function buildNav(role) {
  const nav = document.getElementById('sidebarNav');
  const items = role === 'coach'
    ? [
        { id: 'coach-dashboard', icon: '', label: 'Tableau de bord' },
        { id: 'coach-boxers',    icon: '', label: 'Mes boxeurs' },
        { id: 'coach-calendar',  icon: '', label: 'Calendrier' },
        { id: 'coach-training',  icon: '', label: 'Fiches entraînement' },
        { id: 'coach-payments',  icon: '', label: 'Paiements' },
      ]
    : role === 'admin'
    ? [
        { id: 'admin-users', icon: '', label: 'Utilisateurs' },
      ]
    : [
        { id: 'boxer-dashboard', icon: '', label: 'Tableau de bord' },
        { id: 'boxer-profile',   icon: '', label: 'Mon profil' },
        { id: 'boxer-events',    icon: '', label: 'Mes événements' },
        { id: 'boxer-training',  icon: '', label: 'Fiches entraînement' },
        { id: 'boxer-documents', icon: '', label: 'Mes documents' },
        { id: 'boxer-payments',  icon: '', label: 'Mes paiements' },
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
  if (nav) {
    nav.classList.add('active');
    const titleEl = document.getElementById('mobilePageTitle');
    if (titleEl) titleEl.textContent = nav.querySelector('.nav-icon').nextSibling.textContent.trim();
  }
  closeSidebar();

  if (pageId === 'coach-dashboard') loadCoachDashboard();
  if (pageId === 'coach-boxers') loadBoxerGrid();
  if (pageId === 'coach-calendar') loadCalendar();
  if (pageId === 'coach-training') loadTrainingSheets();
  if (pageId === 'coach-payments') loadCoachPayments();
  if (pageId === 'boxer-dashboard') loadBoxerDashboard();
  if (pageId === 'boxer-profile') loadBoxerProfile();
  if (pageId === 'boxer-training') loadTrainingSheets();
  if (pageId === 'boxer-events') loadBoxerEvents();
  if (pageId === 'boxer-documents') loadDocuments();
  if (pageId === 'boxer-payments') loadBoxerPayments();
  if (pageId === 'admin-users') loadAdminUsers();
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
  return '';
}

function showFormError(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.style.display = 'block';
  const modal = el.closest('.modal');
  if (modal) modal.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ===== MOBILE SIDEBAR =====

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const btn = document.getElementById('hamburgerBtn');
  const isOpen = sidebar.classList.contains('open');
  if (isOpen) {
    closeSidebar();
  } else {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    btn.classList.add('open');
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('visible');
  document.getElementById('hamburgerBtn').classList.remove('open');
}

// ===== iOS MODAL SCROLL FIX =====
// Prevent overlay from swallowing touch events, but allow scroll inside .modal-body
document.addEventListener('touchmove', function(e) {
  const overlay = e.target.closest('.modal-overlay');
  if (!overlay) return;
  const body = e.target.closest('.modal-body');
  if (!body) { e.preventDefault(); return; }
  // Allow scroll only if the body is actually scrollable
  const canScroll = body.scrollHeight > body.clientHeight;
  if (!canScroll) e.preventDefault();
}, { passive: false });

// ===== KEYBOARD & MODAL EVENTS =====

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const lf = document.getElementById('loginForm');
    const rf = document.getElementById('registerForm');
    if (lf && lf.style.display !== 'none') doLogin();
    else if (rf && rf.style.display !== 'none') doRegister();
  }
  if (e.key === 'Escape') { closeModal(); closeEventModal(); closeEventDetail(); closeTrainingModal(); closeTrainingDetail(); closeExportModal(); }
});

document.getElementById('exportModal').addEventListener('click', function(e) {
  if (e.target === this) closeExportModal();
});
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

// ===== AUTO LOGIN =====
