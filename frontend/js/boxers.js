// ===== COACH BOXERS =====

const WEIGHT_CATS = [
  'Mini-mouche (−46,5 kg)','Mi-mouche (−48 kg)','Mouche (−50,8 kg)','Super-mouche (−52 kg)',
  'Coq (−53,5 kg)','Super-coq (−55,3 kg)','Plume (−57 kg)','Super-plume (−58,9 kg)',
  'Léger (−61 kg)','Super-léger (−63,5 kg)','Mi-moyen (−66 kg)','Super-mi-moyen (−69 kg)',
  'Moyen (−72 kg)','Super-moyen (−76 kg)','Mi-lourd (−80 kg)','Cruiser (−90 kg)',
  'Lourd (−90,7 kg)','Super-lourd (+90,7 kg)'
];

let _currentModalBoxer = null;

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

  _currentModalBoxer = { ..._currentModalBoxer, ...body };
  showToast('Profil mis à jour !', 'success');
  renderBoxerModalView();
  loadBoxerGrid();
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
