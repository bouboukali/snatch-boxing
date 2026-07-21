// ===== BOXER EVENTS =====

async function loadBoxerEvents() {
  const res = await apiFetch('/api/events/boxer');
  if (!res) return;
  const events = await res.json();
  const el = document.getElementById('boxerEventsList');

  if (!events.length) {
    el.innerHTML = `<div class="empty-state"><p>Aucun événement à venir.</p></div>`;
    return;
  }

  const now = new Date().toISOString().split('T')[0];
  const upcoming = events.filter(ev => ev.end_date >= now);
  const past = events.filter(ev => ev.end_date < now);

  let html = '';

  if (upcoming.length) {
    html += `<h3 style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--primary);margin-bottom:14px">À venir</h3>`;
    html += upcoming.map(ev => boxerEventCardHTML(ev)).join('');
  }

  if (past.length) {
    html += `<h3 style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin:24px 0 14px">Passés</h3>`;
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
