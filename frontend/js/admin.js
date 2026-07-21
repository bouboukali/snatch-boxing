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

  const roleLabel = { coach: 'Coach', boxer: 'Boxeur' };
  const roleColor = { coach: 'var(--primary)', boxer: 'var(--text-secondary)' };

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${users.map(u => {
        const name = (u.first_name || u.last_name) ? `${u.first_name||''} ${u.last_name||''}`.trim() : null;
        return `
          <div style="display:flex;align-items:center;gap:14px;padding:14px 18px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px">
            <div style="width:42px;height:42px;border-radius:50%;background:var(--gold-dim);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">
              ${u.role === 'coach' ? 'C' : 'B'}
            </div>
            <div style="flex:1;min-width:0">
              ${name ? `<div style="font-weight:700;font-size:15px">${name}</div>` : ''}
              <div style="font-size:13px;color:var(--text-muted)">${u.email}</div>
              <span style="font-size:11px;color:${roleColor[u.role]};font-weight:600;text-transform:uppercase;letter-spacing:0.5px">${roleLabel[u.role]}</span>
            </div>
            <button class="btn btn-sm" style="background:var(--gold-dim);color:var(--primary);border:1px solid rgba(201,160,32,0.4);flex-shrink:0"
              onclick="impersonateUser(${u.id}, '${u.email}')">
              Se connecter
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

  localStorage.setItem('bm_admin_token', getToken());

  setToken(data.token);
  localStorage.setItem('bm_role', data.role);
  localStorage.setItem('bm_email', data.email);
  showToast(`Connecté en tant que ${email}`, 'success');
  initApp(data.role, data.email);
}
