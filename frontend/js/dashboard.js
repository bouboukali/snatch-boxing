// ===== COACH DASHBOARD =====

async function loadCoachDashboard() {
  const [bRes, pRes] = await Promise.all([
    apiFetch('/api/coach/boxers'),
    apiFetch('/api/coach/payments/month')
  ]);
  if (!bRes || !pRes) return;
  const boxers = await bRes.json();
  const payments = await pRes.json();

  const paid = payments.boxers.filter(b => b.paid).length;
  const unpaid = payments.boxers.length - paid;
  const total = boxers.length;

  document.getElementById('coachStats').innerHTML = `
    <div class="stat-card stat-total">
      <div class="stat-val">${total}</div>
      <div class="stat-label">Boxeurs</div>
    </div>
    <div class="stat-card stat-wins">
      <div class="stat-val">${paid}</div>
      <div class="stat-label">Ont payé</div>
    </div>
    <div class="stat-card stat-losses">
      <div class="stat-val">${unpaid}</div>
      <div class="stat-label">En attente</div>
    </div>
    <div class="stat-card stat-draws">
      <div class="stat-val">${total ? Math.round(paid/total*100) : 0}%</div>
      <div class="stat-label">Taux de paiement</div>
    </div>
  `;

  const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const monthLabel = `${MONTHS[payments.month-1]} ${payments.year}`;

  document.getElementById('dashPaymentPreview').innerHTML = `
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">${monthLabel}</p>
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>Boxeur</th>
          <th>Statut</th>
        </tr></thead>
        <tbody>
          ${payments.boxers.slice(0,8).map(b => `
            <tr>
              <td>
                <div class="boxer-name">${fullName(b)}</div>
                <div class="boxer-email">${b.email}</div>
              </td>
              <td>
                ${b.paid
                  ? '<span class="badge badge-paid">✓ Payé</span>'
                  : '<span class="badge badge-unpaid">✗ Non payé</span>'
                }
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
