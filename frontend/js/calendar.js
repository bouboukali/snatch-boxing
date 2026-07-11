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

function getEvType(type) {
  return EV_TYPES[type] || { label: type || 'Autre', icon: '🎯', css: 'ev-recreant' };
}
function getEvColor(type) {
  return EV_COLORS[type] || '#888888';
}

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

  let html = DAYS_FR.map(d => `<div class="cal-day-name">${d}</div>`).join('');

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay  = new Date(calYear, calMonth + 1, 0);
  const today    = new Date();

  let startOffset = (firstDay.getDay() + 6) % 7;

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(calYear, calMonth, -i);
    html += `<div class="cal-day other-month"><div class="cal-day-num">${d.getDate()}</div></div>`;
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===d;

    const dayEvents = allEvents.filter(ev => ev.start_date <= dateStr && ev.end_date >= dateStr);

    const dots = dayEvents.slice(0,3).map(ev => {
      const t = getEvType(ev.type);
      return `<div class="cal-event-dot ${t.css}" onclick="event.stopPropagation();openEventModal(${ev.id})" title="${ev.title}">${t.icon} ${ev.title}</div>`;
    }).join('');

    const more = dayEvents.length > 3 ? `<div style="font-size:10px;color:var(--text-muted);padding:1px 4px">+${dayEvents.length-3}</div>` : '';

    html += `<div class="cal-day ${isToday?'today':''} ${dayEvents.length?'has-events':''}" onclick="openEventModal()">
      <div class="cal-day-num">${d}</div>
      ${dots}${more}
    </div>`;
  }

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
  const t = getEvType(ev.type);
  const color = getEvColor(ev.type);
  const sameDay = ev.start_date === ev.end_date;

  const startFmt = new Date(ev.start_date).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
  const endFmt   = new Date(ev.end_date).toLocaleDateString('fr-FR',   { day:'numeric', month:'short' });
  const dateStr  = sameDay ? startFmt : `${startFmt} → ${endFmt}`;
  const timeStr  = ev.start_time ? (sameDay ? `${ev.start_time}${ev.end_time ? ' – '+ev.end_time : ''}` : '') : '';

  const duration = calcDurationLabel(ev.start_time, ev.end_time);

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
          ${duration ? `<span class="duration-badge" style="font-size:11px;padding:2px 8px">⏱ ${duration}</span>` : ''}
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

// ===== DATE FIELD HELPERS =====

function onDateChange(inputId) {
  const val = document.getElementById(inputId).value;
  const txtEl = document.getElementById(inputId + '_txt');
  if (!txtEl) return;
  if (val) {
    const [y, m, d] = val.split('-');
    txtEl.textContent = `· ${d}/${m}/${y}`;
  } else {
    txtEl.textContent = '';
  }
}

function setDateField(inputId, isoDate) {
  document.getElementById(inputId).value = isoDate;
  onDateChange(inputId);
}

// ===== CUSTOM TYPE =====

function onEvTypeChange(val) {
  const customInput = document.getElementById('ev_custom_type');
  customInput.style.display = val === '__custom__' ? 'block' : 'none';
  if (val === '__custom__') customInput.focus();
}

function getEvTypeValue() {
  const select = document.getElementById('ev_type');
  if (select.value === '__custom__') {
    return document.getElementById('ev_custom_type').value.trim() || 'Autre';
  }
  return select.value;
}

function setEvTypeField(type) {
  const select = document.getElementById('ev_type');
  const customInput = document.getElementById('ev_custom_type');
  if (EV_TYPES[type] || type === '') {
    select.value = type || 'boxe';
    customInput.style.display = 'none';
    customInput.value = '';
  } else {
    select.value = '__custom__';
    customInput.value = type;
    customInput.style.display = 'block';
  }
}

// ===== TIME DRUM =====

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

function initDrum(colId, items, defaultValue) {
  const col = document.getElementById(colId);
  if (!col) return;

  col.innerHTML =
    '<div class="drum-item drum-pad"></div>' +
    items.map(v => `<div class="drum-item">${v}</div>`).join('') +
    '<div class="drum-item drum-pad"></div>';

  const idx = items.indexOf(defaultValue);
  col.scrollTop = (idx >= 0 ? idx : 0) * 40;
  updateDrumActive(col);

  col.addEventListener('scroll', () => {
    clearTimeout(col._t);
    col._t = setTimeout(() => {
      snapDrum(col);
      updateDrumActive(col);
      updateDuration();
    }, 80);
  });
}

function snapDrum(col) {
  const idx = Math.round(col.scrollTop / 40);
  col.scrollTo({ top: idx * 40, behavior: 'smooth' });
}

function updateDrumActive(col) {
  const activeIdx = Math.round(col.scrollTop / 40);
  col.querySelectorAll('.drum-item').forEach((item, i) => {
    item.classList.toggle('drum-active', i === activeIdx + 1);
  });
}

function getDrumValue(colId) {
  const col = document.getElementById(colId);
  if (!col) return '00';
  const idx = Math.round(col.scrollTop / 40);
  const realItems = col.querySelectorAll('.drum-item:not(.drum-pad)');
  return realItems[idx]?.textContent.trim() || '00';
}

function setDrumValue(colId, value) {
  const col = document.getElementById(colId);
  if (!col) return;
  const realItems = col.querySelectorAll('.drum-item:not(.drum-pad)');
  for (let i = 0; i < realItems.length; i++) {
    if (realItems[i].textContent.trim() === value) {
      col.scrollTop = i * 40;
      updateDrumActive(col);
      return;
    }
  }
}

function toggleTimeSection(checked) {
  const wrapper = document.getElementById('ev_drums_wrapper');
  wrapper.style.display = checked ? 'block' : 'none';
  if (checked) {
    initDrum('drum_sh', HOURS, '09');
    initDrum('drum_sm', MINUTES, '00');
    initDrum('drum_eh', HOURS, '11');
    initDrum('drum_em', MINUTES, '00');
    updateDuration();
  } else {
    document.getElementById('ev_duration_display').style.display = 'none';
  }
}

function updateDuration() {
  const hasTime = document.getElementById('ev_has_time')?.checked;
  const el = document.getElementById('ev_duration_display');
  if (!hasTime || !el) return;

  const sh = parseInt(getDrumValue('drum_sh'));
  const sm = parseInt(getDrumValue('drum_sm'));
  const eh = parseInt(getDrumValue('drum_eh'));
  const em = parseInt(getDrumValue('drum_em'));

  const startMins = sh * 60 + sm;
  const endMins   = eh * 60 + em;
  const diff = endMins - startMins;

  if (diff <= 0 || diff > 720) { el.style.display = 'none'; return; }

  const h = Math.floor(diff / 60);
  const m = diff % 60;
  const label = h > 0
    ? (m > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${h}h`)
    : `${m}min`;

  el.textContent = `⏱ ${label} d'entraînement`;
  el.style.display = 'inline-block';
}

// ===== DURATION LABEL (for display in cards) =====

function calcDurationLabel(startTime, endTime) {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0 || diff > 720) return null;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? (m > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${h}h`) : `${m}min`;
}

// ===== EVENT MODAL =====

async function openEventModal(eventId = null) {
  editingEventId = eventId || null;
  const modal = document.getElementById('eventModal');
  const errEl = document.getElementById('eventModalError');
  errEl.style.display = 'none';

  // Reset fields
  document.getElementById('ev_title').value = '';
  setEvTypeField('boxe');
  document.getElementById('ev_private').value = '0';
  setDateField('ev_start_date', '');
  setDateField('ev_end_date', '');
  document.getElementById('ev_location').value = '';
  document.getElementById('ev_country').value = 'France';
  document.getElementById('ev_description').value = '';
  document.getElementById('ev_invite_all').checked = false;
  document.getElementById('boxerSelectList').style.display = 'none';
  document.getElementById('evDeleteBtn').style.display = 'none';
  document.getElementById('ev_has_time').checked = false;
  document.getElementById('ev_drums_wrapper').style.display = 'none';
  document.getElementById('ev_duration_display').style.display = 'none';
  togglePrivate('0');

  await loadBoxerCheckboxes([]);

  if (eventId) {
    document.getElementById('eventModalTitle').textContent = 'Modifier l\'événement';
    document.getElementById('evDeleteBtn').style.display = 'inline-flex';
    const ev = allEvents.find(e => e.id === eventId);
    if (ev) {
      document.getElementById('ev_title').value = ev.title;
      setEvTypeField(ev.type);
      document.getElementById('ev_private').value = ev.is_private ? '1' : '0';
      setDateField('ev_start_date', ev.start_date);
      setDateField('ev_end_date', ev.end_date);
      document.getElementById('ev_location').value = ev.location || '';
      document.getElementById('ev_country').value = ev.country || 'France';
      document.getElementById('ev_description').value = ev.description || '';

      if (ev.start_time) {
        document.getElementById('ev_has_time').checked = true;
        document.getElementById('ev_drums_wrapper').style.display = 'block';
        const [sh, sm] = ev.start_time.split(':');
        const [eh, em] = (ev.end_time || '00:00').split(':');
        // Use setTimeout so DOM is ready
        setTimeout(() => {
          initDrum('drum_sh', HOURS, sh);
          initDrum('drum_sm', MINUTES, sm);
          initDrum('drum_eh', HOURS, eh);
          initDrum('drum_em', MINUTES, em);
          updateDuration();
        }, 50);
      }

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
    const today = new Date().toISOString().split('T')[0];
    setDateField('ev_start_date', today);
    setDateField('ev_end_date', today);
  }

  modal.classList.add('open');
}

async function loadBoxerCheckboxes(selectedIds = []) {
  const container = document.getElementById('boxerCheckboxes');
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

  if (!title)      { showFormError('eventModalError', 'Le titre est requis.'); return; }
  if (!start_date) { showFormError('eventModalError', 'La date de début est requise.'); return; }
  if (!end_date)   { showFormError('eventModalError', 'La date de fin est requise.'); return; }
  if (end_date < start_date) { showFormError('eventModalError', 'La date de fin doit être après la date de début.'); return; }

  const hasTime = document.getElementById('ev_has_time').checked;
  let start_time = null, end_time = null;
  if (hasTime) {
    start_time = `${getDrumValue('drum_sh')}:${getDrumValue('drum_sm')}`;
    end_time   = `${getDrumValue('drum_eh')}:${getDrumValue('drum_em')}`;
    if (start_date === end_date && end_time <= start_time) {
      showFormError('eventModalError', 'L\'heure de fin doit être après l\'heure de début.');
      return;
    }
  }

  const invite_all = document.getElementById('ev_invite_all').checked;
  let boxer_ids = [];
  if (!invite_all) {
    const checkboxes = document.querySelectorAll('#boxerCheckboxes input[type=checkbox]:checked');
    boxer_ids = Array.from(checkboxes).map(c => parseInt(c.value));
  }

  const body = {
    title,
    type:        getEvTypeValue(),
    is_private:  document.getElementById('ev_private').value === '1',
    start_date,
    end_date,
    start_time,
    end_time,
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
    showFormError('eventModalError', err.error || 'Erreur lors de la sauvegarde.');
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

// ===== EVENT DETAIL MODAL =====

async function openEventDetail(eventId) {
  const res = await apiFetch(`/api/events/${eventId}`);
  if (!res || !res.ok) return;
  const ev = await res.json();

  const t = getEvType(ev.type);
  const color = getEvColor(ev.type);
  const sameDay = ev.start_date === ev.end_date;
  const startFmt = new Date(ev.start_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const endFmt   = new Date(ev.end_date).toLocaleDateString('fr-FR',   { day: 'numeric', month: 'long', year: 'numeric' });
  const duration = calcDurationLabel(ev.start_time, ev.end_time);

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
        <div style="font-size:14px;font-weight:600">${ev.start_time}${ev.end_time ? ' – ' + ev.end_time : ''}${duration ? `<span class="duration-badge" style="margin-left:10px;font-size:11px;padding:2px 8px">⏱ ${duration}</span>` : ''}</div>
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
