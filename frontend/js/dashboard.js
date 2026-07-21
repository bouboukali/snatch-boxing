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
                  <div class="dash-event-meta">${fmtDateFull(ev.start_date)}${ev.start_time ? ' · ' + ev.start_time.slice(0,5) : ''}</div>
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
                <span class="badge badge-unpaid">✗</span>
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
