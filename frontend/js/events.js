// ===== BOXER EVENTS =====

let boxerEvents = [];
let boxerCalYear, boxerCalMonth;

async function loadBoxerEvents() {
  const now = new Date();
  if (!boxerCalYear) { boxerCalYear = now.getFullYear(); boxerCalMonth = now.getMonth(); }
  const res = await apiFetch('/api/events/boxer');
  if (!res) return;
  boxerEvents = await res.json();
  renderBoxerCalendar();
  renderBoxerEventsList();
}

function renderBoxerCalendar() {
  const title = document.getElementById('boxerCalTitle');
  if (title) title.textContent = `${MONTHS_FR[boxerCalMonth]} ${boxerCalYear}`;

  const grid = document.getElementById('boxerCalGrid');
  if (!grid) return;

  let html = DAYS_FR.map((d, i) =>
    `<div class="cal-day-name ${DAYS_WEEKEND.has(i) ? 'weekend' : ''}">${d}</div>`
  ).join('');

  const firstDay = new Date(boxerCalYear, boxerCalMonth, 1);
  const lastDay  = new Date(boxerCalYear, boxerCalMonth + 1, 0);
  const today    = new Date();
  let startOffset = (firstDay.getDay() + 6) % 7;

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(boxerCalYear, boxerCalMonth, -i);
    const col = (startOffset - 1 - i);
    html += `<div class="cal-day other-month ${DAYS_WEEKEND.has(col) ? 'weekend' : ''}"><div class="cal-day-num">${d.getDate()}</div></div>`;
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${boxerCalYear}-${String(boxerCalMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = today.getFullYear()===boxerCalYear && today.getMonth()===boxerCalMonth && today.getDate()===d;
    const col = (startOffset + d - 1) % 7;
    const isWeekend = DAYS_WEEKEND.has(col);
    const dayEvs = boxerEvents.filter(ev => ev.start_date <= dateStr && ev.end_date >= dateStr);

    const labelsHtml = dayEvs.slice(0, 2).map(ev => {
      const color = getEvColor(ev.type);
      const isMultiDay = ev.start_date !== ev.end_date;
      const startsHere = ev.start_date === dateStr;
      const endsHere   = ev.end_date   === dateStr;
      const extraClass = isMultiDay ? (startsHere ? 'cal-label-start' : endsHere ? 'cal-label-end' : 'cal-label-mid') : '';
      return `<div class="cal-label ${extraClass}" style="background:${color}33;color:${color}" onclick="event.stopPropagation();openEventDetail(${ev.id})">${ev.title}</div>`;
    }).join('');
    const overflow = dayEvs.length > 2 ? `<div class="cal-overflow">+${dayEvs.length - 2}</div>` : '';
    const eventsHtml = dayEvs.length ? `<div class="cal-labels">${labelsHtml}${overflow}</div>` : '';
    const dayClick = dayEvs.length === 1 ? `onclick="openEventDetail(${dayEvs[0].id})"` : '';

    html += `<div class="cal-day ${isToday?'today':''} ${dayEvs.length?'has-events':''} ${isWeekend?'weekend':''}" ${dayClick} style="${!dayClick?'cursor:default':''}">
      <div class="cal-day-num">${d}</div>${eventsHtml}
    </div>`;
  }

  const total = startOffset + lastDay.getDate();
  const trailing = (7 - (total % 7)) % 7;
  for (let d = 1; d <= trailing; d++) {
    const col = (total + d - 1) % 7;
    html += `<div class="cal-day other-month ${DAYS_WEEKEND.has(col)?'weekend':''}"><div class="cal-day-num">${d}</div></div>`;
  }

  grid.innerHTML = html;
}

function boxerCalPrevMonth() {
  boxerCalMonth--;
  if (boxerCalMonth < 0) { boxerCalMonth = 11; boxerCalYear--; }
  renderBoxerCalendar();
}

function boxerCalNextMonth() {
  boxerCalMonth++;
  if (boxerCalMonth > 11) { boxerCalMonth = 0; boxerCalYear++; }
  renderBoxerCalendar();
}

function renderBoxerEventsList() {
  const el = document.getElementById('boxerEventsList');
  if (!el) return;

  if (!boxerEvents.length) {
    el.innerHTML = `<div class="empty-state"><p>Aucun événement à venir.</p></div>`;
    return;
  }

  const now = new Date().toISOString().split('T')[0];
  const upcoming = boxerEvents.filter(ev => ev.end_date >= now).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past     = boxerEvents.filter(ev => ev.end_date <  now).sort((a, b) => b.start_date.localeCompare(a.start_date));

  let html = '';
  if (upcoming.length) {
    html += `<div class="event-month-header" style="color:var(--primary)">À venir</div>`;
    html += upcoming.map(ev => boxerEventCardHTML(ev)).join('');
  }
  if (past.length) {
    html += `<div class="event-month-header" style="color:var(--text-muted);margin-top:16px">Passés</div>`;
    html += past.map(ev => boxerEventCardHTML(ev, true)).join('');
  }

  el.innerHTML = html;
}

function boxerEventCardHTML(ev, past = false) {
  const t = getEvType(ev.type);
  const color = getEvColor(ev.type);
  const sameDay = ev.start_date === ev.end_date;
  const startFmt = new Date(ev.start_date).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
  const endFmt   = new Date(ev.end_date).toLocaleDateString('fr-FR',   { day:'numeric', month:'long', year:'numeric' });
  const dateStr  = sameDay ? `${startFmt}` : `Du ${startFmt} au ${endFmt}`;
  const timeStr  = ev.start_time ? ` · ${ev.start_time}${ev.end_time ? ' – '+ev.end_time : ''}` : '';

  const status = ev.rsvp_status || 'pending';
  const statusLabel = { accepted: 'Accepté', declined: 'Refusé', pending: 'En attente' };
  const statusColor = { accepted: '#2ecc71', declined: '#e74c3c', pending: 'var(--text-muted)' };

  const rsvpHtml = past
    ? `<div style="font-size:12px;color:${statusColor[status]};margin-top:8px">${statusLabel[status]}</div>`
    : `<div style="display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap">
        <span style="font-size:13px;color:${statusColor[status]};font-weight:600">${statusLabel[status]}</span>
        ${status !== 'accepted' ? `<button class="btn btn-sm" style="background:rgba(46,204,113,0.15);color:#2ecc71;border:1px solid rgba(46,204,113,0.4)" onclick="event.stopPropagation();rsvpEvent(${ev.id},'accepted')">Accepter</button>` : ''}
        ${status !== 'declined' ? `<button class="btn btn-sm" style="background:rgba(231,76,60,0.15);color:#e74c3c;border:1px solid rgba(231,76,60,0.4)" onclick="event.stopPropagation();rsvpEvent(${ev.id},'declined')">Décliner</button>` : ''}
      </div>`;

  return `
    <div class="boxer-event-card" style="border-left-color:${color};opacity:${past?0.6:1};cursor:pointer" onclick="openEventDetail(${ev.id})">
      <div class="event-title">${t.icon} ${ev.title}</div>
      <div class="event-meta">
        <span>${dateStr}${timeStr}</span>
        ${ev.location ? `<span>${ev.location}${ev.country && ev.country !== 'France' ? `, ${ev.country}` : ''}</span>` : ''}
        <span class="badge" style="background:rgba(0,0,0,0.3);color:${color};font-size:11px;padding:2px 8px">${t.label}</span>
        ${ev.is_private ? '<span style="font-size:12px;color:var(--text-muted)">Privé</span>' : ''}
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
