// ===== BOXER PROFILE =====

let _profileData = null;

async function loadBoxerProfile() {
  const res = await apiFetch('/api/boxer/profile');
  if (!res) return;
  _profileData = await res.json();
  renderProfileView(_profileData);
}

function renderProfileView(p) {
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || null;
  const initials = p.first_name && p.last_name
    ? (p.first_name[0] + p.last_name[0]).toUpperCase()
    : (currentUser || '?')[0].toUpperCase();

  const dob = p.date_of_birth
    ? new Date(p.date_of_birth + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const infoRow = (icon, label, val) => val
    ? `<div class="profile-info-row">${icon ? `<span class="profile-info-icon">${icon}</span>` : ''}<div><div class="profile-info-label">${label}</div><div class="profile-info-val">${val}</div></div></div>`
    : '';

  document.getElementById('boxerProfileContent').innerHTML = `

    <!-- Carte identité -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-body">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
          <div class="boxer-avatar" style="width:64px;height:64px;font-size:22px;flex-shrink:0">${initials}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:20px;font-weight:700;color:var(--text)">${name || '<span style="color:var(--text-muted);font-size:15px">Nom non renseigné</span>'}</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:2px">${currentUser || ''}</div>
          </div>
          <button class="btn btn-sm btn-secondary" style="flex-shrink:0;width:auto" onclick="showProfileEdit()">Modifier</button>
        </div>

        ${infoRow('', 'Téléphone', p.phone)}
        ${infoRow('🎂', 'Date de naissance', dob)}
        ${infoRow('', 'Numéro de licence', p.license_number)}
        ${infoRow('', 'Adresse', p.physical_address)}

        ${!name ? `<div style="margin-top:16px;padding:12px 14px;background:rgba(201,160,32,0.08);border:1px solid rgba(201,160,32,0.25);border-radius:8px;font-size:13px;color:var(--primary)">
          Complétez votre profil pour que le coach puisse vous identifier.
        </div>` : ''}
      </div>
    </div>

    <!-- Palmarès -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><h3>Palmarès</h3></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center;margin-bottom:20px">
          <div>
            <div style="font-size:32px;font-weight:800;color:#2ecc71">${p.wins ?? 0}</div>
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-top:2px">Victoires</div>
          </div>
          <div>
            <div style="font-size:32px;font-weight:800;color:#e74c3c">${p.losses ?? 0}</div>
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-top:2px">Défaites</div>
          </div>
          <div>
            <div style="font-size:32px;font-weight:800;color:var(--text-muted)">${p.draws ?? 0}</div>
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-top:2px">Nuls</div>
          </div>
        </div>
        <div class="profile-info-row" id="weightRow">
          <div style="flex:1">
            <div class="profile-info-label">Poids actuel</div>
            <div class="profile-info-val" id="weightDisplay">${p.weight ? `${p.weight} kg` : '<span style="color:var(--text-muted)">Non renseigné</span>'}</div>
          </div>
          <button class="btn btn-sm btn-secondary" style="width:auto;flex-shrink:0" onclick="showWeightEdit()">Modifier</button>
        </div>
        <div id="weightEditRow" style="display:none;padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;gap:8px;align-items:center">
            <div class="form-group" style="flex:1;margin:0">
              <input type="number" id="quickWeightInput" step="0.1" min="40" max="200" placeholder="ex: 64.5" value="${p.weight || ''}">
            </div>
            <span style="color:var(--text-muted);font-size:14px;flex-shrink:0">kg</span>
            <button class="btn btn-sm btn-primary" style="width:auto;flex-shrink:0" onclick="saveWeight()">OK</button>
            <button class="btn btn-sm btn-secondary" style="width:auto;flex-shrink:0" onclick="hideWeightEdit()">✕</button>
          </div>
        </div>
        ${infoRow('', 'Catégorie de compétition', p.competition_category)}
        ${infoRow('', 'Catégorie de poids', p.weight_category)}
        ${infoRow('', 'Sexe', p.gender)}
      </div>
    </div>

    <!-- Email -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><h3>Adresse email</h3></div>
      <div class="card-body">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="flex:1;font-size:14px;color:var(--text)">${currentUser || ''}</span>
          <button class="btn btn-sm btn-secondary" style="width:auto;flex-shrink:0" onclick="showEmailChangeSection()">Changer</button>
        </div>
        <div id="emailChangeForm" style="display:none;margin-top:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px">
          <div class="form-group" style="margin-bottom:10px">
            <label>Nouvelle adresse email</label>
            <input type="email" id="newEmailInput" placeholder="nouveau@email.fr">
          </div>
          <div id="emailChangeMsg" style="font-size:13px;margin-bottom:10px;display:none"></div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary btn-sm" style="width:auto" onclick="submitEmailChange()">Envoyer le lien</button>
            <button class="btn btn-secondary btn-sm" style="width:auto" onclick="hideEmailChangeForm()">Annuler</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Formulaire d'édition (masqué par défaut) -->
    <div id="profileEditSection" style="display:none">
      <div id="profileEditError" class="error-msg" style="display:none;margin-bottom:12px"></div>
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><h3>Informations personnelles</h3></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Prénom <span class="required-star">*</span></label>
              <input type="text" id="pFirstName" placeholder="Jean" value="${p.first_name || ''}" oninput="this.classList.remove('input-error');document.getElementById('profileEditError').style.display='none'">
            </div>
            <div class="form-group">
              <label>Nom <span class="required-star">*</span></label>
              <input type="text" id="pLastName" placeholder="Dupont" value="${p.last_name || ''}" oninput="this.classList.remove('input-error');document.getElementById('profileEditError').style.display='none'">
            </div>
            <div class="form-group">
              <label>Téléphone <span class="optional-tag">Facultatif</span></label>
              <input type="tel" id="pPhone" placeholder="+32 4 00 00 00 00" value="${p.phone || ''}">
            </div>
            <div class="form-group">
              <label>Date de naissance <span class="optional-tag">Facultatif</span></label>
              <input type="date" id="pDob" value="${p.date_of_birth || ''}" onchange="onDobChange('pDob','pCompCat')">
            </div>
            <div class="form-group">
              <label>Numéro de licence <span class="optional-tag">Facultatif</span></label>
              <input type="text" id="pLicense" placeholder="KBBB-2024-XXXXX" value="${p.license_number || ''}">
            </div>
            <div class="form-group full-width">
              <label>Adresse physique <span class="optional-tag">Facultatif</span></label>
              <input type="text" id="pAddress" placeholder="Rue des Champions 12, 1000 Bruxelles" value="${p.physical_address || ''}">
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><h3>Palmarès & Condition physique</h3></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Victoires <span class="optional-tag">Facultatif</span></label>
              <input type="number" id="pWins" min="0" placeholder="0" value="${p.wins ?? ''}">
            </div>
            <div class="form-group">
              <label>Défaites <span class="optional-tag">Facultatif</span></label>
              <input type="number" id="pLosses" min="0" placeholder="0" value="${p.losses ?? ''}">
            </div>
            <div class="form-group">
              <label>Nuls <span class="optional-tag">Facultatif</span></label>
              <input type="number" id="pDraws" min="0" placeholder="0" value="${p.draws ?? ''}">
            </div>
            <div class="form-group">
              <label>Poids actuel (kg) <span class="optional-tag">Facultatif</span></label>
              <input type="number" id="pWeight" step="0.1" min="40" max="200" placeholder="70.5" value="${p.weight || ''}">
            </div>
            <div class="form-group">
              <label>Sexe <span class="optional-tag">Facultatif</span></label>
              <select id="pGender" onchange="updateProfileWeightCat()">
                <option value="">— Sélectionner —</option>
                <option value="Homme" ${p.gender === 'Homme' ? 'selected' : ''}>Homme</option>
                <option value="Femme" ${p.gender === 'Femme' ? 'selected' : ''}>Femme</option>
              </select>
            </div>
            <div class="form-group">
              <label>Catégorie de compétition <span class="optional-tag">Facultatif</span></label>
              <select id="pCompCat" onchange="updateProfileWeightCat()">
                <option value="">— Sélectionner —</option>
                ${['U15','U17','U19','Elite','Masters','Récréant'].map(c => `<option value="${c}" ${p.competition_category === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Catégorie de poids <span class="optional-tag">Facultatif</span></label>
              <select id="pWeightCat">
                <option value="">— Sélectionner —</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-bottom:24px">
        <button class="btn btn-secondary" style="width:auto" onclick="hideProfileEdit()">Annuler</button>
        <button class="btn btn-primary" style="width:auto" onclick="saveProfile()">Enregistrer</button>
      </div>
    </div>
  `;

  updateWeightCatSelect('pWeightCat', p.gender || '', p.competition_category || '', p.weight_category || '');
}

function showWeightEdit() {
  document.getElementById('weightRow').style.display = 'none';
  document.getElementById('weightEditRow').style.display = 'block';
  document.getElementById('quickWeightInput').focus();
  document.getElementById('quickWeightInput').select();
}

function hideWeightEdit() {
  document.getElementById('weightRow').style.display = 'flex';
  document.getElementById('weightEditRow').style.display = 'none';
}

async function saveWeight() {
  const val = parseFloat(document.getElementById('quickWeightInput').value);
  if (!val || val < 40 || val > 200) {
    document.getElementById('quickWeightInput').classList.add('input-error');
    return;
  }
  const res = await apiFetch('/api/boxer/profile', {
    method: 'PUT',
    body: JSON.stringify({ ..._profileData, weight: val })
  });
  if (res && res.ok) {
    _profileData.weight = val;
    document.getElementById('weightDisplay').textContent = `${val} kg`;
    hideWeightEdit();
    showToast('Poids mis à jour !', 'success');
  } else {
    showToast('Erreur lors de la sauvegarde', 'error');
  }
}

function showProfileEdit() {
  document.getElementById('profileEditSection').style.display = 'block';
  document.getElementById('profileEditSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideProfileEdit() {
  document.getElementById('profileEditSection').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showEmailChangeSection() {
  document.getElementById('emailChangeForm').style.display = 'block';
  document.getElementById('newEmailInput').focus();
  hideEmailChangeMsg();
}

async function saveProfile() {
  const fn = document.getElementById('pFirstName').value.trim();
  const ln = document.getElementById('pLastName').value.trim();

  if (!fn || !ln) {
    if (!fn) document.getElementById('pFirstName').classList.add('input-error');
    if (!ln) document.getElementById('pLastName').classList.add('input-error');
    showFormError('profileEditError', 'Veuillez remplir les champs obligatoires.');
    document.getElementById('profileEditSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const body = {
    first_name: fn,
    last_name: ln,
    physical_address: document.getElementById('pAddress').value.trim(),
    license_number: document.getElementById('pLicense').value.trim(),
    wins: parseInt(document.getElementById('pWins').value) || 0,
    losses: parseInt(document.getElementById('pLosses').value) || 0,
    draws: parseInt(document.getElementById('pDraws').value) || 0,
    weight: parseFloat(document.getElementById('pWeight').value) || null,
    weight_category:      document.getElementById('pWeightCat').value,
    phone:                document.getElementById('pPhone').value.trim(),
    date_of_birth:        document.getElementById('pDob').value,
    gender:               document.getElementById('pGender')?.value || null,
    competition_category: document.getElementById('pCompCat')?.value || null,
  };

  const res = await apiFetch('/api/boxer/profile', {
    method: 'PUT',
    body: JSON.stringify(body)
  });
  if (!res) return;
  if (res.ok) {
    showToast('Profil enregistré !', 'success');
    _profileData = { ..._profileData, ...body };
    renderProfileView(_profileData);
  } else {
    showToast('Erreur lors de la sauvegarde', 'error');
  }
}

// ===== CHANGEMENT D'EMAIL =====

function showEmailChangeForm() { showEmailChangeSection(); }

function hideEmailChangeForm() {
  document.getElementById('emailChangeForm').style.display = 'none';
  document.getElementById('newEmailInput').value = '';
  hideEmailChangeMsg();
}

function hideEmailChangeMsg() {
  const msg = document.getElementById('emailChangeMsg');
  msg.style.display = 'none';
  msg.textContent = '';
}

function showEmailChangeMsg(text, isError) {
  const msg = document.getElementById('emailChangeMsg');
  msg.textContent = text;
  msg.style.color = isError ? '#e57373' : '#81c784';
  msg.style.display = 'block';
}

async function submitEmailChange() {
  const newEmail = document.getElementById('newEmailInput').value.trim();
  if (!newEmail) return showEmailChangeMsg('Veuillez saisir un email.', true);

  const res = await apiFetch('/api/boxer/request-email-change', {
    method: 'POST',
    body: JSON.stringify({ new_email: newEmail })
  });
  if (!res) return;

  if (res.ok) {
    const data = await res.json();
    showEmailChangeMsg(data.message, false);
    document.getElementById('newEmailInput').disabled = true;
  } else {
    const err = await res.json();
    showEmailChangeMsg(err.error || 'Erreur', true);
  }
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
    list.innerHTML = `<div class="empty-state"><p>Aucun document déposé pour l'instant.</p></div>`;
    return;
  }

  list.innerHTML = docs.map(d => `
    <div class="doc-item">
      <span class="doc-icon">${docIcon(d.document_type)}</span>
      <div class="doc-info">
        <div class="doc-name">${d.original_name}</div>
        <div class="doc-meta">${d.document_type} — ${new Date(d.uploaded_at).toLocaleDateString('fr-FR')}</div>
      </div>
      <button class="btn btn-danger btn-sm btn-icon" onclick="deleteDoc(${d.id})" title="Supprimer">✕</button>
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

  zone.innerHTML = `<p><strong>Cliquez</strong> ou glissez un fichier ici</p><p style="margin-top:6px;font-size:12px">PDF, JPG, PNG, DOC — max 10 Mo</p>`;
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
