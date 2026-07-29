// ===== TRAINING SHEETS =====

const TR_TYPES = {
  muscu:     { label: 'Musculation',       icon: '', color: '#e67e22' },
  cardio:    { label: 'Cardio',            icon: '', color: '#3498db' },
  boxe:      { label: 'Boxe',             icon: '', color: '#e74c3c' },
  condition: { label: 'Condition physique', icon: '', color: '#2ecc71' },
  sparring:  { label: 'Sparring',          icon: '', color: '#9b59b6' },
  recreant:  { label: 'Récréant',          icon: '', color: '#C9A020' },
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
    el.innerHTML = `<div class="empty-state"><p>${currentRole === 'boxer' ? 'Aucune fiche ne vous a été assignée.' : 'Aucune fiche d\'entraînement créée.'}</p></div>`;
    return;
  }

  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
    ${sheets.map(s => {
      const t = TR_TYPES[s.type] || TR_TYPES.muscu;
      const isCoach = currentRole === 'coach';
      const visibilityBadge = isCoach
        ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${s.is_public ? 'rgba(46,204,113,0.12)' : 'rgba(255,255,255,0.06)'};color:${s.is_public ? '#2ecc71' : 'var(--text-muted)'}">${s.is_public ? 'Public' : 'Privé'}</span>`
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
                <button class="btn btn-sm" style="background:var(--gold-dim);color:var(--primary);border:1px solid rgba(201,160,32,0.3);padding:4px 8px" onclick="event.stopPropagation();openTrainingModal(${s.id})">Modifier</button>
                <button class="btn btn-sm btn-danger" style="padding:4px 8px" onclick="event.stopPropagation();deleteTrainingSheet(${s.id})">Supprimer</button>
              </div>` : ''}
            </div>
            ${s.description ? `<p style="font-size:13px;color:var(--text-muted);margin-bottom:10px;line-height:1.5">${s.description}</p>` : ''}
            <div style="font-size:12px;color:var(--text-muted)">
              ${s.exercise_count} exercice${s.exercise_count !== 1 ? 's' : ''}
              ${isCoach && !s.is_public ? ` · ${s.assigned_count || 0} boxeur${s.assigned_count !== 1 ? 's' : ''}` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('')}
  </div>`;
}

let _trDraftExercises = [];
let _trDraftBlocks = []; // [{name, color}]

async function openTrainingModal(sheetId = null) {
  editingSheetId = sheetId;
  _trDraftExercises = [];
  _trDraftBlocks = [];
  const modal = document.getElementById('trainingModal');
  document.getElementById('trainingModalTitle').textContent = sheetId ? 'Modifier la fiche' : 'Nouvelle fiche d\'entraînement';

  let sheet = null;
  if (sheetId) {
    const res = await apiFetch(`/api/training/${sheetId}`);
    if (!res) return;
    sheet = await res.json();
    if (sheet.exercises) {
      _trDraftExercises = sheet.exercises.map(e => ({ ...e }));
      const seen = new Set();
      _trDraftExercises.forEach(e => {
        if (e.block_name && !seen.has(e.block_name)) {
          seen.add(e.block_name);
          _trDraftBlocks.push({ name: e.block_name });
        }
      });
    }
  }
  if (!_trDraftBlocks.length) _trDraftBlocks = [{ name: 'BLOC A' }];

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
          <option value="muscu" ${!sheet || sheet.type==='muscu'?'selected':''}>Musculation</option>
          <option value="cardio" ${sheet?.type==='cardio'?'selected':''}>Cardio</option>
          <option value="boxe" ${sheet?.type==='boxe'?'selected':''}>Boxe</option>
          <option value="condition" ${sheet?.type==='condition'?'selected':''}>Condition physique</option>
          <option value="sparring" ${sheet?.type==='sparring'?'selected':''}>Sparring</option>
          <option value="recreant" ${sheet?.type==='recreant'?'selected':''}>Récréant</option>
        </select>
      </div>
      <div class="form-group">
        <label>Visibilité</label>
        <select id="tr_public" onchange="toggleTrVisibility(this.value)">
          <option value="0" ${!isPublic?'selected':''}>Privé (boxeurs assignés)</option>
          <option value="1" ${isPublic?'selected':''}>Public (tous les boxeurs)</option>
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

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div class="section-title" style="margin:0">Exercices par blocs</div>
      <button class="btn btn-sm" style="background:rgba(201,160,32,0.12);color:var(--primary);border:1px solid rgba(201,160,32,0.3)" onclick="addTrBlock()">+ Nouveau bloc</button>
    </div>
    <div id="tr_exercises_list" style="margin-bottom:16px"></div>

    <div style="display:flex;justify-content:flex-end;gap:10px">
      <button class="btn btn-secondary btn-sm" onclick="closeTrainingModal()">Annuler</button>
      <button class="btn btn-primary" style="width:auto" onclick="saveTrainingSheet()">${sheetId ? 'Enregistrer' : 'Créer la fiche'}</button>
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

const BLOCK_COLORS = ['#C9A020','#3498db','#e74c3c','#2ecc71','#9b59b6','#e67e22','#1abc9c'];

function renderTrDraftExercises() {
  const el = document.getElementById('tr_exercises_list');
  if (!el) return;

  let html = '';
  _trDraftBlocks.forEach((block, bi) => {
    const color = BLOCK_COLORS[bi % BLOCK_COLORS.length];
    const blockExs = _trDraftExercises.filter(e => e.block_name === block.name);

    html += `<div style="border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:${color}18;border-bottom:1px solid ${color}44">
        <input type="text" value="${block.name}" oninput="_trDraftBlocks[${bi}].name=this.value;_trDraftExercises.forEach(e=>{ if(e.block_name===_trDraftBlocks[${bi}].name) e.block_name=this.value; });renderTrDraftExercises()"
          style="flex:1;font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:${color};background:transparent;border:none;border-bottom:1px dashed ${color}44;padding:2px 4px;outline:none"
          placeholder="Nom du bloc (ex: BLOC A - FORCE)">
        <button class="btn btn-sm" style="padding:2px 8px;background:transparent;color:${color};border:1px solid ${color}55;font-size:11px" onclick="addTrRestRow('${block.name}')">+ Récupération</button>
        <button class="btn btn-sm" style="padding:2px 8px;background:${color}22;color:${color};border:1px solid ${color}55;font-size:11px" onclick="addTrDraftExercise('${block.name}')">+ Exercice</button>
        ${_trDraftBlocks.length > 1 ? `<button class="btn btn-sm btn-danger" style="padding:2px 6px;font-size:11px" onclick="removeTrBlock(${bi})">✕</button>` : ''}
      </div>`;

    if (!blockExs.length) {
      html += `<p style="font-size:13px;color:var(--text-muted);padding:10px 14px;margin:0">Aucun exercice. Cliquez sur "+ Exercice".</p>`;
    } else {
      html += `<div class="table-wrapper"><table style="font-size:13px">
        <thead><tr>
          <th style="width:28px">#</th>
          <th>Exercice / Note</th>
          <th style="width:60px">Séries</th>
          <th style="width:70px">Rép.</th>
          <th style="width:90px">Série 1</th>
          <th style="width:90px">Série 2</th>
          <th style="width:90px">Série 3</th>
          <th style="width:80px">Récup.</th>
          <th style="width:28px"></th>
        </tr></thead><tbody>`;

      blockExs.forEach((ex) => {
        const gi = _trDraftExercises.indexOf(ex);
        if (ex.is_rest) {
          html += `<tr style="background:rgba(201,160,32,0.06)">
            <td colspan="8" style="padding:6px 10px">
              <input type="text" value="${ex.rest_label||''}" oninput="_trDraftExercises[${gi}].rest_label=this.value"
                placeholder="Ex: Récupération 3 min"
                style="width:100%;font-style:italic;color:var(--primary);background:transparent;border:none;border-bottom:1px dashed rgba(201,160,32,0.3);font-size:12px;padding:2px 4px;outline:none">
            </td>
            <td><button class="btn btn-sm btn-danger" style="padding:2px 5px" onclick="_trDraftExercises.splice(${gi},1);renderTrDraftExercises()">✕</button></td>
          </tr>`;
        } else {
          const rowNum = blockExs.filter((e,j) => !e.is_rest && blockExs.indexOf(e) <= blockExs.indexOf(ex)).length;
          html += `<tr>
            <td style="color:var(--text-muted)">${rowNum}</td>
            <td>
              <input type="text" value="${ex.name||''}" oninput="_trDraftExercises[${gi}].name=this.value"
                placeholder="Nom de l'exercice"
                style="width:100%;padding:4px 6px;background:var(--input-bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:13px">
              <input type="text" value="${ex.notes||''}" oninput="_trDraftExercises[${gi}].notes=this.value"
                placeholder="Note (optionnel)"
                style="width:100%;padding:2px 6px;margin-top:2px;background:transparent;border:none;border-bottom:1px dashed var(--border);color:var(--text-muted);font-size:11px">
            </td>
            <td><input type="text" value="${ex.sets||''}" oninput="_trDraftExercises[${gi}].sets=this.value"
              style="width:100%;padding:4px 4px;background:var(--input-bg);border:1px solid var(--border);border-radius:4px;color:var(--text);text-align:center"></td>
            <td><input type="text" value="${ex.reps||''}" oninput="_trDraftExercises[${gi}].reps=this.value"
              style="width:100%;padding:4px 4px;background:var(--input-bg);border:1px solid var(--border);border-radius:4px;color:var(--text);text-align:center"></td>
            <td><input type="text" value="${ex.target_set1||''}" oninput="_trDraftExercises[${gi}].target_set1=this.value"
              placeholder="ex: 6x70kg"
              style="width:100%;padding:4px 4px;background:var(--input-bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:12px;text-align:center"></td>
            <td><input type="text" value="${ex.target_set2||''}" oninput="_trDraftExercises[${gi}].target_set2=this.value"
              placeholder="ex: 6x75kg"
              style="width:100%;padding:4px 4px;background:var(--input-bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:12px;text-align:center"></td>
            <td><input type="text" value="${ex.target_set3||''}" oninput="_trDraftExercises[${gi}].target_set3=this.value"
              placeholder="ex: 6x80kg"
              style="width:100%;padding:4px 4px;background:var(--input-bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:12px;text-align:center"></td>
            <td><input type="text" value="${ex.rest||''}" oninput="_trDraftExercises[${gi}].rest=this.value"
              style="width:100%;padding:4px 4px;background:var(--input-bg);border:1px solid var(--border);border-radius:4px;color:var(--text);text-align:center"></td>
            <td><button class="btn btn-sm btn-danger" style="padding:2px 5px" onclick="_trDraftExercises.splice(${gi},1);renderTrDraftExercises()">✕</button></td>
          </tr>`;
        }
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';
  });

  el.innerHTML = html;
}

function addTrBlock() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const name = 'BLOC ' + (letters[_trDraftBlocks.length] || (_trDraftBlocks.length + 1));
  _trDraftBlocks.push({ name });
  renderTrDraftExercises();
}

function removeTrBlock(bi) {
  const blockName = _trDraftBlocks[bi].name;
  _trDraftExercises = _trDraftExercises.filter(e => e.block_name !== blockName);
  _trDraftBlocks.splice(bi, 1);
  renderTrDraftExercises();
}

function addTrDraftExercise(blockName) {
  if (!blockName) blockName = _trDraftBlocks[0]?.name || 'BLOC A';
  _trDraftExercises.push({ name: '', sets: '', reps: '', rest: '', notes: '',
    block_name: blockName, session_number: 1,
    target_set1: '', target_set2: '', target_set3: '', is_rest: false });
  renderTrDraftExercises();
}

function addTrRestRow(blockName) {
  _trDraftExercises.push({ is_rest: true, rest_label: '', block_name: blockName });
  renderTrDraftExercises();
}

function closeTrainingModal() {
  document.getElementById('trainingModal').classList.remove('open');
  editingSheetId = null;
  _trDraftExercises = [];
  _trDraftBlocks = [];
}

async function saveTrainingSheet() {
  const title = document.getElementById('tr_title').value.trim();
  const errEl = document.getElementById('trainingFormError');
  if (!title) { showFormError('trainingFormError', 'Le titre est requis.'); return; }
  errEl.style.display = 'none';

  const is_public = document.getElementById('tr_public').value === '1';
  const boxer_ids = is_public ? [] : Array.from(document.querySelectorAll('#tr_boxer_section input[type=checkbox]:checked')).map(c => parseInt(c.value));
  const exercises = _trDraftExercises.filter(e => e.is_rest ? e.rest_label?.trim() : e.name?.trim());

  const body = {
    title,
    type: document.getElementById('tr_type').value,
    description: document.getElementById('tr_description').value.trim() || null,
    notes: document.getElementById('tr_notes').value.trim() || null,
    is_public,
    boxer_ids,
    exercises,
  };

  let sheetId = editingSheetId;
  if (editingSheetId) {
    const metaRes = await apiFetch(`/api/training/${editingSheetId}`, { method: 'PUT', body: JSON.stringify(body) });
    if (!metaRes || !metaRes.ok) { showFormError('trainingFormError', 'Erreur lors de la sauvegarde.'); return; }
    const batchRes = await apiFetch(`/api/training/${editingSheetId}/exercises/batch`, { method: 'POST', body: JSON.stringify({ exercises }) });
    if (!batchRes || !batchRes.ok) { showFormError('trainingFormError', 'Erreur lors de la sauvegarde des exercices.'); return; }
  } else {
    const res = await apiFetch('/api/training', { method: 'POST', body: JSON.stringify(body) });
    if (!res || !res.ok) { showFormError('trainingFormError', 'Erreur lors de la sauvegarde.'); return; }
    const data = await res.json();
    sheetId = data.id;
  }

  closeTrainingModal();
  showToast(editingSheetId ? 'Fiche mise à jour !' : 'Fiche créée !', 'success');
  await loadTrainingSheets();

  if (sheetId) {
    const fresh = await apiFetch(`/api/training/${sheetId}`);
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

  const exercisesHtml = renderExercisesTable(s.exercises, isCoach);

  const addExerciseFormHtml = isCoach ? `
    <div style="display:flex;justify-content:flex-end;margin-top:16px;gap:10px">
      <button class="btn btn-sm btn-secondary" onclick="closeTrainingDetail();openTrainingModal(${s.id})">Modifier la fiche / exercices</button>
    </div>` : `
    <div style="display:flex;justify-content:flex-end;margin-top:20px">
      <button class="btn btn-primary" style="width:auto" onclick="openPerformanceForm()">Enregistrer ma séance</button>
    </div>
    <div id="performanceFormContainer"></div>
    <div id="performanceHistoryContainer"></div>`;

  document.getElementById('trainingDetailBody').innerHTML = `
    ${s.description ? `<p style="color:var(--text-muted);font-size:14px;margin-bottom:16px;line-height:1.6">${s.description}</p>` : ''}
    ${s.notes ? `<div style="padding:12px 16px;background:rgba(201,160,32,0.08);border:1px solid rgba(201,160,32,0.2);border-radius:8px;margin-bottom:16px;font-size:13px">
      <span style="color:var(--primary);font-weight:700">Note coach : </span>${s.notes}
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
      <div style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--primary);margin-bottom:16px">Ma séance</div>
      <div class="form-group" style="margin-bottom:16px">
        <label>Date de la séance</label>
        <input type="date" id="perf_date" value="${today}">
      </div>
      ${exerciseRows}
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
        <button class="btn btn-secondary" style="width:auto" onclick="document.getElementById('performanceFormContainer').innerHTML=''">Annuler</button>
        <button class="btn btn-primary" style="width:auto" onclick="savePerformance()">Enregistrer</button>
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
        <div style="font-weight:700;font-size:13px;color:var(--primary);margin-bottom:8px">${new Date(date).toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
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

function renderExercisesTable(exercises, isCoach) {
  if (!exercises.length) return `<div class="empty-state" style="padding:30px"><p>Aucun exercice.</p></div>`;

  const hasTargets = exercises.some(e => e.target_set1 || e.target_set2 || e.target_set3);
  const colSpan = isCoach ? (hasTargets ? 8 : 6) : (hasTargets ? 7 : 5);

  // Group by block_name
  const blocks = [];
  const seenBlocks = new Set();
  exercises.forEach(e => {
    const bn = e.block_name || '';
    if (!seenBlocks.has(bn)) { seenBlocks.add(bn); blocks.push(bn); }
  });

  let html = '';
  blocks.forEach((blockName, bi) => {
    const blockExs = exercises.filter(e => (e.block_name || '') === blockName);
    const color = BLOCK_COLORS[bi % BLOCK_COLORS.length];

    if (blockName) {
      html += `<div style="margin-bottom:16px;border:1px solid ${color}44;border-radius:10px;overflow:hidden">
        <div style="padding:8px 14px;background:${color}18;font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${color}">${blockName}</div>`;
    } else {
      html += `<div style="margin-bottom:16px;border:1px solid var(--border);border-radius:10px;overflow:hidden">`;
    }

    html += `<div class="table-wrapper"><table style="font-size:13px"><thead><tr>
      <th style="width:28px">#</th>
      <th>Exercice</th>
      <th style="width:60px">Séries</th>
      <th style="width:70px">Rép.</th>
      ${hasTargets ? `<th style="width:90px">Série 1</th><th style="width:90px">Série 2</th><th style="width:90px">Série 3</th>` : ''}
      <th style="width:80px">Récup.</th>
      ${isCoach ? '<th style="width:100px"></th>' : ''}
    </tr></thead><tbody>`;

    let rowIdx = 0;
    blockExs.forEach(ex => {
      if (ex.is_rest) {
        html += `<tr id="ex-row-${ex.id}" style="background:rgba(201,160,32,0.05)">
          <td colspan="${colSpan}" style="padding:7px 14px;font-style:italic;color:var(--primary);font-size:12px;border-bottom:1px dashed rgba(201,160,32,0.2)">
            ${ex.rest_label || 'Récupération'}
            ${isCoach ? `<span style="float:right"><button class="btn btn-sm btn-danger" style="padding:1px 6px;font-size:11px" onclick="deleteExercise(${ex.id})">✕</button></span>` : ''}
          </td>
        </tr>`;
      } else {
        rowIdx++;
        html += `<tr id="ex-row-${ex.id}">
          <td style="color:var(--text-muted)">${rowIdx}</td>
          <td style="font-weight:600">${ex.name || '—'}${ex.notes ? `<div style="font-size:11px;color:var(--text-muted);font-weight:400">${ex.notes}</div>` : ''}</td>
          <td style="text-align:center">${ex.sets ?? '—'}</td>
          <td style="text-align:center">${ex.reps ?? '—'}</td>
          ${hasTargets ? `
            <td style="text-align:center;font-size:12px;color:var(--primary)">${ex.target_set1 || '—'}</td>
            <td style="text-align:center;font-size:12px;color:var(--primary)">${ex.target_set2 || '—'}</td>
            <td style="text-align:center;font-size:12px;color:var(--primary)">${ex.target_set3 || '—'}</td>
          ` : ''}
          <td style="text-align:center">${ex.rest ?? '—'}</td>
          ${isCoach ? `<td style="white-space:nowrap">
            <button class="btn btn-sm" style="padding:2px 7px;background:var(--gold-dim);color:var(--primary);border:1px solid rgba(201,160,32,0.3)" onclick="editExerciseRow(${ex.id})">Modifier</button>
            <button class="btn btn-sm btn-danger" style="padding:2px 7px;margin-left:4px" onclick="deleteExercise(${ex.id})">Supprimer</button>
          </td>` : ''}
        </tr>`;
      }
    });

    html += '</tbody></table></div></div>';
  });

  return html;
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
  const hasTargets = _currentSheet.exercises.some(e => e.target_set1 || e.target_set2 || e.target_set3);

  const inp = (id, val, w) =>
    `<input type="text" value="${val||''}" id="${id}" style="width:${w||'100%'};padding:5px 6px;background:var(--input-bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:13px">`;

  const row = document.getElementById(`ex-row-${exId}`);
  row.innerHTML = `
    <td style="color:var(--text-muted);font-size:13px">${_currentSheet.exercises.indexOf(ex)+1}</td>
    <td>${inp(`eed_name_${exId}`, ex.name)}</td>
    <td>${inp(`eed_sets_${exId}`, ex.sets, '56px')}</td>
    <td>${inp(`eed_reps_${exId}`, ex.reps, '64px')}</td>
    ${hasTargets ? `
      <td>${inp(`eed_ts1_${exId}`, ex.target_set1, '80px')}</td>
      <td>${inp(`eed_ts2_${exId}`, ex.target_set2, '80px')}</td>
      <td>${inp(`eed_ts3_${exId}`, ex.target_set3, '80px')}</td>
    ` : ''}
    <td>${inp(`eed_rest_${exId}`, ex.rest, '64px')}</td>
    <td style="white-space:nowrap">
      <button class="btn btn-sm" style="padding:3px 8px;background:rgba(46,204,113,0.15);color:#2ecc71;border:1px solid rgba(46,204,113,0.4)" onclick="saveExerciseRow(${exId})">✓</button>
      <button class="btn btn-sm btn-secondary" style="padding:3px 8px;margin-left:4px" onclick="renderTrainingDetail()">✕</button>
    </td>
  `;
}

function _v(id) { const el = document.getElementById(id); return el ? el.value.trim() || null : null; }

async function saveExerciseRow(exId) {
  const body = {
    name:        _v(`eed_name_${exId}`),
    sets:        _v(`eed_sets_${exId}`),
    reps:        _v(`eed_reps_${exId}`),
    rest:        _v(`eed_rest_${exId}`),
    target_set1: _v(`eed_ts1_${exId}`),
    target_set2: _v(`eed_ts2_${exId}`),
    target_set3: _v(`eed_ts3_${exId}`),
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
