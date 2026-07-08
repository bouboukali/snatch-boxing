// ===== GLOBALS =====
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

// ===== KEYBOARD & MODAL EVENTS =====

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const lf = document.getElementById('loginForm');
    const rf = document.getElementById('registerForm');
    if (lf && lf.style.display !== 'none') doLogin();
    else if (rf && rf.style.display !== 'none') doRegister();
  }
  if (e.key === 'Escape') { closeModal(); closeEventModal(); closeEventDetail(); closeTrainingModal(); closeTrainingDetail(); }
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
(function checkSession() {
  const token = getToken();
  const role = localStorage.getItem('bm_role');
  const email = localStorage.getItem('bm_email');
  if (token && role && email) initApp(role, email);
})();
