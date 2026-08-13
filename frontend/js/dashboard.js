// ===== COACH DASHBOARD =====

async function loadCoachDashboard() {
  const [bRes, pRes, eRes] = await Promise.all([
    apiFetch('/api/coach/boxers'),
    apiFetch('/api/coach/payments/month'),
    apiFetch('/api/events/coach')
  ]);
  if (!bRes || !pRes || !eRes) return;

  const boxers   = await bRes.json();
  const payments = await pRes.json();
  const events   = await eRes.json();

  const paid   = payments.boxers.filter(b => b.paid).length;
  const unpaid = payments.boxers.filter(b => !b.paid).length;
  const total  = boxers.length;

  // Upcoming events: next 7 days + future, sorted
  const today = new Date(); today.setHours(0,0,0,0);
  const in7   = new Date(today); in7.setDate(today.getDate() + 7);

  const upcoming = events
    .filter(e => {
      const d = new Date(e.start_date);
      return d >= today;
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 5);

  // Newest boxer
  const newest = [...boxers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const monthLabel = MONTHS[payments.month - 1];

  document.getElementById('dashContent').innerHTML = `

    <!-- KPI row -->
    <div class="dash-kpi-row">
      <div class="dash-kpi" onclick="showPage('coach-boxers')" style="cursor:pointer">
        <div class="dash-kpi-val">${total}</div>
        <div class="dash-kpi-label">Boxeurs inscrits</div>
        ${newest ? `<div class="dash-kpi-sub">Dernier : ${fullName(newest) || newest.email}</div>` : ''}
      </div>
      <div class="dash-kpi dash-kpi-warn" onclick="showPage('coach-payments')" style="cursor:pointer">
        <div class="dash-kpi-val">${unpaid}</div>
        <div class="dash-kpi-label">En attente — ${monthLabel}</div>
        <div class="dash-kpi-sub">${paid} payé${paid > 1 ? 's' : ''} sur ${total}</div>
      </div>
      <div class="dash-kpi dash-kpi-ok" onclick="showPage('coach-calendar')" style="cursor:pointer">
        <div class="dash-kpi-val">${upcoming.length}</div>
        <div class="dash-kpi-label">Événements à venir</div>
        <div class="dash-kpi-sub">${upcoming.length ? 'Prochain : ' + fmtDateShort(upcoming[0].start_date) : 'Aucun planifié'}</div>
      </div>
    </div>

    <!-- Two columns -->
    <div class="dash-cols">

      <!-- Upcoming events -->
      <div class="card">
        <div class="card-header">
          <h3>Prochains événements</h3>
          <button class="btn btn-sm btn-secondary" onclick="showPage('coach-calendar')">Voir tout</button>
        </div>
        <div class="card-body" style="padding:0">
          ${upcoming.length === 0
            ? `<p style="padding:20px;color:var(--text-muted);text-align:center">Aucun événement planifié.<br><button class="btn btn-sm btn-primary" style="margin-top:12px;width:auto" onclick="showPage('coach-calendar');openEventModal()">+ Créer un événement</button></p>`
            : upcoming.map(ev => `
              <div class="dash-event-row" onclick="showPage('coach-calendar')">
                <div class="dash-event-dot" style="background:${getEvColor(ev.type)}"></div>
                <div class="dash-event-info">
                  <div class="dash-event-title">${ev.title}</div>
                  <div class="dash-event-meta">${fmtDateFull(ev.start_date)}${ev.start_time ? ' · ' + ev.start_time.slice(0,5) : ''}${ev.location ? ' · ' + ev.location : ''}</div>
                  <div class="dash-event-meta" style="margin-top:2px"><span style="color:${ev.is_private ? 'var(--text-muted)' : 'var(--primary)'}">${ev.is_private ? 'Privé' : 'Public'}</span> · ${getEvType(ev.type).label}</div>
                </div>
                <div class="dash-event-type">${getEvType(ev.type).icon}</div>
              </div>
            `).join('')
          }
        </div>
      </div>

      <!-- Payment alert -->
      <div class="card">
        <div class="card-header">
          <h3>Paiements — ${monthLabel}</h3>
          <button class="btn btn-sm btn-secondary" onclick="showPage('coach-payments')">Gérer</button>
        </div>
        <div class="card-body" style="padding:0">
          ${unpaid === 0 && total > 0
            ? `<p style="padding:20px;color:#4caf50;text-align:center;font-weight:600">✓ Tout le monde a payé ce mois-ci !</p>`
            : payments.boxers.filter(b => !b.paid).slice(0, 5).map(b => `
              <div class="dash-event-row">
                <div class="dash-event-dot" style="background:#e53935"></div>
                <div class="dash-event-info">
                  <div class="dash-event-title">${fullName(b) || b.email}</div>
                  <div class="dash-event-meta">En attente de paiement</div>
                </div>
              </div>
            `).join('')
          }
          ${unpaid > 5 ? `<p style="padding:12px 16px;color:var(--text-muted);font-size:12px">+ ${unpaid - 5} autre${unpaid - 5 > 1 ? 's' : ''}</p>` : ''}
          ${unpaid > 0
            ? `<div style="padding:12px 16px;border-top:1px solid #1a1a1a">
                <button class="btn btn-sm" style="width:100%;background:rgba(229,57,53,0.12);color:#e57373;border:1px solid rgba(229,57,53,0.3)" onclick="showPage('coach-payments')">
                  Envoyer les rappels (${unpaid})
                </button>
               </div>`
            : ''
          }
        </div>
      </div>

    </div>
  `;
}

// ===== BOXER DASHBOARD =====

async function loadBoxerDashboard() {
  const [eRes, tRes, pRes, prRes] = await Promise.all([
    apiFetch('/api/events/boxer'),
    apiFetch('/api/training/boxer'),
    apiFetch('/api/boxer/payments'),
    apiFetch('/api/boxer/profile'),
  ]);
  if (!eRes || !tRes || !pRes || !prRes) return;

  const events   = await eRes.json();
  const sheets   = await tRes.json();
  const payments = await pRes.json();
  const profile  = await prRes.json();

  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = events
    .filter(e => new Date(e.start_date + 'T00:00:00') >= today)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 5);

  const recentSheets = [...sheets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);

  const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const now = new Date();
  const monthLabel = MONTHS[now.getMonth()];
  const currentMonthPayment = payments.find(p => p.month === now.getMonth() + 1 && p.year === now.getFullYear());
  const isPaid = currentMonthPayment?.paid;

  const firstName = profile.first_name || currentUser?.split('@')[0] || 'Boxeur';

  // Prochain événement KPI
  const nextEv = upcoming[0];
  const daysUntil = nextEv
    ? Math.ceil((new Date(nextEv.start_date + 'T00:00:00') - today) / 86400000)
    : null;

  document.getElementById('boxerDashContent').innerHTML = `

    <!-- KPI row -->
    <div class="dash-kpi-row">
      <div class="dash-kpi dash-kpi-ok" onclick="showPage('boxer-events')" style="cursor:pointer">
        <div class="dash-kpi-val">${upcoming.length}</div>
        <div class="dash-kpi-label">Évén. à venir</div>
        <div class="dash-kpi-sub">${nextEv ? (daysUntil === 0 ? "Aujourd'hui !" : daysUntil === 1 ? 'Demain' : `Dans ${daysUntil}j`) : 'Aucun planifié'}</div>
      </div>
      <div class="dash-kpi ${isPaid ? 'dash-kpi-ok' : 'dash-kpi-warn'}" onclick="showPage('boxer-payments')" style="cursor:pointer">
        <div class="dash-kpi-val" style="font-size:20px">${isPaid ? '✓' : '!'}</div>
        <div class="dash-kpi-label">Paiement ${monthLabel}</div>
        <div class="dash-kpi-sub">${isPaid ? 'Réglé' : 'En attente'}</div>
      </div>
      <div class="dash-kpi" onclick="showPage('boxer-training')" style="cursor:pointer">
        <div class="dash-kpi-val">${sheets.length}</div>
        <div class="dash-kpi-label">Fiches dispo</div>
        <div class="dash-kpi-sub">${recentSheets[0] ? recentSheets[0].title : 'Aucune fiche'}</div>
      </div>
    </div>

    <div class="dash-cols">

      <!-- Prochains événements -->
      <div class="card">
        <div class="card-header">
          <h3>Prochains événements</h3>
          <button class="btn btn-sm btn-secondary" onclick="showPage('boxer-events')">Voir tout</button>
        </div>
        <div class="card-body" style="padding:0">
          ${upcoming.length === 0
            ? `<p style="padding:20px;color:var(--text-muted);text-align:center">Aucun événement à venir.</p>`
            : upcoming.map(ev => {
                const rsvp = ev.rsvp_status;
                const isPending = rsvp === 'pending';
                return `
                <div class="dash-event-row">
                  <div class="dash-event-dot" style="background:${getEvColor(ev.type)}"></div>
                  <div class="dash-event-info" style="flex:1;min-width:0">
                    <div class="dash-event-title">${ev.title}</div>
                    <div class="dash-event-meta">${fmtDateFull(ev.start_date)}${ev.start_time ? ' · ' + ev.start_time.slice(0,5) : ''}</div>
                    ${isPending ? `
                    <div style="display:flex;gap:6px;margin-top:6px">
                      <button class="btn btn-sm" style="padding:4px 10px;font-size:12px;background:rgba(46,204,113,0.15);color:#2ecc71;border:1px solid rgba(46,204,113,0.3)" onclick="event.stopPropagation();rsvpFromDash(${ev.id},'accepted',this)">✓ Accepter</button>
                      <button class="btn btn-sm" style="padding:4px 10px;font-size:12px;background:rgba(231,76,60,0.12);color:#e74c3c;border:1px solid rgba(231,76,60,0.3)" onclick="event.stopPropagation();rsvpFromDash(${ev.id},'declined',this)">✗ Refuser</button>
                    </div>` : rsvp === 'accepted' ? `<div style="margin-top:4px;font-size:12px;color:#2ecc71;font-weight:600">✓ Accepté</div>`
                      : rsvp === 'declined' ? `<div style="margin-top:4px;font-size:12px;color:#e74c3c;font-weight:600">✗ Refusé</div>` : ''}
                  </div>
                  <div class="dash-event-type">${getEvType(ev.type).icon}</div>
                </div>`;
              }).join('')
          }
        </div>
      </div>

      <!-- Fiches d'entraînement récentes -->
      <div class="card">
        <div class="card-header">
          <h3>Fiches d'entraînement</h3>
          <button class="btn btn-sm btn-secondary" onclick="showPage('boxer-training')">Voir tout</button>
        </div>
        <div class="card-body" style="padding:0">
          ${recentSheets.length === 0
            ? `<p style="padding:20px;color:var(--text-muted);text-align:center">Aucune fiche disponible.</p>`
            : recentSheets.map(s => `
              <div class="dash-event-row" onclick="showPage('boxer-training')" style="cursor:pointer">
                <div class="dash-event-dot" style="background:var(--primary)"></div>
                <div class="dash-event-info">
                  <div class="dash-event-title">${s.title}</div>
                  <div class="dash-event-meta">${s.exercise_count ?? 0} exercice${(s.exercise_count ?? 0) > 1 ? 's' : ''} · ${fmtDateShort(s.created_at?.slice(0,10))}</div>
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>

    </div>

    ${!isPaid && currentMonthPayment ? `
    <div style="margin-top:0;padding:14px 18px;background:rgba(229,57,53,0.08);border:1px solid rgba(229,57,53,0.25);border-radius:10px;display:flex;align-items:center;gap:12px">
      <span style="font-size:22px">⚠️</span>
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px">Paiement en attente — ${monthLabel}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:2px">Votre cotisation de ce mois n'a pas encore été réglée.</div>
      </div>
      <button class="btn btn-sm" style="background:rgba(229,57,53,0.15);color:#e57373;border:1px solid rgba(229,57,53,0.3);flex-shrink:0" onclick="showPage('boxer-payments')">Voir</button>
    </div>` : ''}
  `;
}

async function rsvpFromDash(eventId, status, btn) {
  btn.closest('.dash-event-row').querySelectorAll('button').forEach(b => b.disabled = true);
  const res = await apiFetch(`/api/events/boxer/${eventId}/rsvp`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
  if (res && res.ok) {
    showToast(status === 'accepted' ? '✓ Invitation acceptée' : '✗ Invitation refusée', status === 'accepted' ? 'success' : 'error');
    loadBoxerDashboard();
  }
}

function fmtDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtDateFull(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
