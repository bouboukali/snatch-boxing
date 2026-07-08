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
