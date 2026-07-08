// ===== COACH PAYMENTS =====

function initPaymentSelectors() {
  const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const mSel = document.getElementById('payMonth');
  const ySel = document.getElementById('payYear');
  const now = new Date();

  if (!mSel.options.length) {
    MONTHS.forEach((m, i) => {
      const opt = document.createElement('option');
      opt.value = i + 1; opt.textContent = m;
      if (i + 1 === now.getMonth() + 1) opt.selected = true;
      mSel.appendChild(opt);
    });
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 2; y--) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      if (y === now.getFullYear()) opt.selected = true;
      ySel.appendChild(opt);
    }
  }
}

async function loadCoachPayments() {
  initPaymentSelectors();
  const month = document.getElementById('payMonth').value;
  const year = document.getElementById('payYear').value;

  const res = await apiFetch(`/api/coach/payments/month?month=${month}&year=${year}`);
  if (!res) return;
  const data = await res.json();

  const paid = data.boxers.filter(b => b.paid).length;
  const unpaidCount = data.boxers.length - paid;
  document.getElementById('paymentSummaryBadge').innerHTML =
    `<span class="badge badge-paid">${paid} payé${paid>1?'s':''}</span>
     <span class="badge badge-unpaid" style="margin-left:6px">${unpaidCount} en attente</span>
     ${unpaidCount > 0 ? `<button class="btn btn-sm" style="margin-left:12px;width:auto;background:rgba(201,160,32,0.15);color:var(--primary);border:1px solid rgba(201,160,32,0.4);padding:4px 12px;font-size:12px" onclick="notifyAllUnpaid(${month},${year})">📧 Notifier les impayés (${unpaidCount})</button>` : ''}`;

  if (!data.boxers.length) {
    document.getElementById('paymentsTable').innerHTML =
      `<div class="empty-state"><div class="empty-icon">👥</div><p>Aucun boxeur inscrit.</p></div>`;
    return;
  }

  document.getElementById('paymentsTable').innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>Boxeur</th>
          <th>Licence</th>
          <th>Statut paiement</th>
        </tr></thead>
        <tbody>
          ${data.boxers.map(b => `
            <tr>
              <td>
                <div class="boxer-name">${fullName(b)}</div>
                <div class="boxer-email">${b.email}</div>
              </td>
              <td style="color:var(--text-muted);font-size:13px">${b.license_number || '—'}</td>
              <td>
                <div class="payment-toggle" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                  <label class="toggle-switch">
                    <input type="checkbox" ${b.paid ? 'checked' : ''}
                      onchange="togglePayment(${b.profile_id}, ${month}, ${year}, this.checked)">
                    <div class="toggle-track"></div>
                    <div class="toggle-thumb"></div>
                  </label>
                  <span id="pay-label-${b.profile_id}" style="font-size:13px;color:${b.paid ? 'var(--success)' : 'var(--text-muted)'}">
                    ${b.paid ? '✓ Payé' : 'Non payé'}
                  </span>
                  ${!b.paid ? `<button class="btn btn-sm" style="width:auto;padding:3px 10px;font-size:12px;background:rgba(201,160,32,0.1);color:var(--primary);border:1px solid rgba(201,160,32,0.3)" onclick="notifyOneBoxer(${b.user_id}, ${month}, ${year})">📧 Relancer</button>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function notifyAllUnpaid(month, year) {
  const res = await apiFetch('/api/coach/payments/notify', {
    method: 'POST',
    body: JSON.stringify({ month, year })
  });
  if (!res) return;
  const d = await res.json();
  showToast(`📧 ${d.sent} rappel${d.sent > 1 ? 's' : ''} envoyé${d.sent > 1 ? 's' : ''}`, 'success');
}

async function notifyOneBoxer(userId, month, year) {
  const res = await apiFetch('/api/coach/payments/notify', {
    method: 'POST',
    body: JSON.stringify({ boxer_ids: [userId], month, year })
  });
  if (!res) return;
  const d = await res.json();
  showToast(d.sent ? '📧 Rappel envoyé' : 'Erreur envoi', d.sent ? 'success' : 'error');
}

async function togglePayment(profileId, month, year, paid) {
  const res = await apiFetch(`/api/coach/payments/${profileId}/${month}/${year}`, {
    method: 'PUT',
    body: JSON.stringify({ paid })
  });
  const label = document.getElementById(`pay-label-${profileId}`);
  if (label) {
    label.textContent = paid ? '✓ Payé' : 'Non payé';
    label.style.color = paid ? 'var(--success)' : 'var(--text-muted)';
  }
  showToast(paid ? 'Paiement enregistré' : 'Paiement annulé', paid ? 'success' : 'error');
}

// ===== BOXER PAYMENTS =====

async function loadBoxerPayments() {
  const res = await apiFetch('/api/boxer/payments');
  if (!res) return;
  const payments = await res.json();
  const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const el = document.getElementById('boxerPaymentsTable');

  if (!payments.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">💳</div><p>Aucun paiement enregistré pour l'instant.</p></div>`;
    return;
  }

  el.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Mois</th><th>Statut</th><th>Payé le</th></tr></thead>
        <tbody>
          ${payments.map(p => `
            <tr>
              <td style="font-weight:600">${MONTHS[p.month-1]} ${p.year}</td>
              <td>${p.paid ? '<span class="badge badge-paid">✓ Payé</span>' : '<span class="badge badge-unpaid">✗ Non payé</span>'}</td>
              <td style="color:var(--text-muted);font-size:13px">${p.paid_at ? new Date(p.paid_at).toLocaleDateString('fr-FR') : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
