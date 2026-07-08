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

let _trDraftExercises = [];

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
    const fresh = await apiFetch(`/api/training/${data.id}`);
    if (fresh) { _currentSheet = await fresh.json(); renderTrainingDetail(); document.getElementById('trainingDetailModal').classList.add('open'); }
  }
}

async function deleteTrainingSheet(id) {
  if (!confirm('Supprimer cette fiche ? Les exercices seront perdus.')) return;
  const res = await apiFetch(`/api/training/${id}`, { method: 'DELETE' });
  if (res && res.ok) { showToast('Fiche supprimée', 'success'); loadTrainingSheets(); }
}

// ===== TRAINING DETAIL =====

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
  const isCardio = ['cardio', 'condition'].includes(_currentSheet.type);
  const isBoxe   = ['boxe', 'sparring'].includes(_currentSheet.type);

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
