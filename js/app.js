// js/app.js — main controller, dashboard, routing

const App = {
  vessels: [],
  currentPage: 'dashboard',

  saveConfig() {
    const url = document.getElementById('cfg-url').value.trim();
    const key = document.getElementById('cfg-key').value.trim();
    const msg = document.getElementById('cfg-msg');
    if (!url || !key) { msg.textContent = 'Both fields required'; return; }
    localStorage.setItem('mp_url', url);
    localStorage.setItem('mp_key', key);
    msg.textContent = 'Saved! Reloading...';
    setTimeout(() => location.reload(), 800);
  },

  async launch(user) {
    Auth.currentUser = user;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('cfg-screen').style.display  = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('user-chip').textContent = '👤 ' + user.full_name + ' (' + user.role + ')';

    // Show admin tab only for Admin role
    if (user.role === 'Admin') document.getElementById('admin-tab').style.display = 'flex';

    // Load global data
    await Settings.loadVessels();
    App.vessels = Settings.state.vessels || [];
    await U.loadFX();
    App.setPage('dashboard');
  },

  setPage(p) {
    App.currentPage = p;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.p === p));
    const titles = {
      dashboard: ['Dashboard', 'Operations overview'],
      pr: ['Purchase Requests', 'Create and track requisitions'],
      rfq: ['RFQ & Quotes', 'Vendor quotes and comparisons'],
      po: ['Purchase Orders', 'Approved orders and follow-up'],
      invoice: ['Invoices', 'Invoice verification and payment'],
      dn: ['Delivery Notes', 'Goods received and delivery tracking'],
      vendors: ['Vendor Database', 'Supplier profile and service coverage'],
      pipeline: ['Pipeline', 'Live workflow across statuses'],
      settings: ['Settings', 'Company and vessel defaults'],
      admin: ['Admin', 'User approvals and access']
    };
    const [title, sub] = titles[p] || ['Dashboard', 'Operations overview'];
    const topTitle = document.getElementById('topbar-title');
    const topSub = document.getElementById('topbar-sub');
    if (topTitle) topTitle.textContent = title;
    if (topSub) topSub.textContent = sub;
    App.renderPage();
  },

  async renderPage() {
    const el = document.getElementById('page');
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Loading...</div>';
    const map = {
      dashboard: App.renderDashboard,
      pr:        PR.render,
      rfq:       RFQ.render,
      po:        PO.render,
      invoice:   Invoice.render,
      dn:        DN.render,
      vendors:   Vendors.render,
      pipeline:  App.renderPipeline,
      settings:  Settings.render,
      admin:     Auth.renderAdmin,
    };
    const fn = map[App.currentPage];
    if (fn) await fn(el);
  },

  async renderDashboard(el) {
    const prs = U.readLocal('purchase_requests', []);
    const pos = U.readLocal('purchase_orders', []);
    const invoices = U.readLocal('invoices', []);
    const totalPR = prs.length;
    const pendingRFQ = prs.filter(p => p.status === 'Pending RFQ').length;
    const totalPO = pos.length;
    const pendingInv = invoices.filter(i => ['Received', 'Verified'].includes(i.status)).length;
    const pendingDN = pos.filter(p => p.status !== 'Delivered' && p.status !== 'Cancelled').length;
    const recentPRs = prs.slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 8);

    const month = new Date().toISOString().slice(0, 7);
    let budgetRows = [];
    const budgets = JSON.parse(localStorage.getItem('mp_vessel_budgets') || '{}');
    const actualByKey = {};
    const prById = Object.fromEntries(prs.map(p => [p.id, p]));
    (pos || []).forEach(po => {
      const vesselId = prById[po.pr_id]?.vessel_id;
      const poMonth = po.po_date?.slice(0, 7);
      if (!vesselId || !poMonth) return;
      const usd = U.toUSD(po.amount, po.currency || 'USD');
      const key = `${vesselId}::${poMonth}`;
      actualByKey[key] = (actualByKey[key] || 0) + usd;
    });
    budgetRows = (App.vessels || []).map(v => {
      const key = `${v.id}::${month}`;
      const budget = Number(budgets[key] || 0);
      const actual = Number(actualByKey[key] || 0);
      return {
        vessel: v.name,
        budget,
        actual,
        variance: budget - actual,
        pct: budget ? Math.round((actual / budget) * 100) : 0
      };
    }).filter(r => r.budget || r.actual);

    el.innerHTML = `
    <div class="page-hdr">
      <div>
        <h2>Dashboard</h2>
        <div class="page-sub">${new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</div>
      </div>
      <div class="fx-summary">FX: 1 USD = ${U.fxRates.EUR?.toFixed(2) || '—'} EUR · ${U.fxRates.SGD?.toFixed(2) || '—'} SGD</div>
    </div>
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Total PRs</div><div class="stat-num c-blue">${totalPR || 0}</div></div>
      <div class="stat-card"><div class="stat-label">Awaiting RFQ</div><div class="stat-num c-amber">${pendingRFQ || 0}</div></div>
      <div class="stat-card"><div class="stat-label">Purchase Orders</div><div class="stat-num c-teal">${totalPO || 0}</div></div>
      <div class="stat-card"><div class="stat-label">Invoices Pending</div><div class="stat-num c-red">${pendingInv || 0}</div></div>
      <div class="stat-card"><div class="stat-label">DN Awaited</div><div class="stat-num c-muted">${pendingDN || 0}</div></div>
    </div>
    <div class="tcard" style="margin-top:16px">
      <div class="tcard-hdr">
        <span style="font-weight:600;font-size:13px">Monthly Budget vs Actual (${month})</span>
      </div>
      <table>
        <thead><tr><th>Vessel</th><th>Budget</th><th>Actual</th><th>Variance</th><th>Utilization</th></tr></thead>
        <tbody>${budgetRows.length ? budgetRows.map(r => `
          <tr>
            <td>${r.vessel}</td>
            <td>USD ${r.budget.toLocaleString()}</td>
            <td>USD ${r.actual.toLocaleString()}</td>
            <td style="color:${r.variance >= 0 ? 'var(--teal)' : 'var(--red)'}">${r.variance >= 0 ? '+' : ''}USD ${r.variance.toLocaleString()}</td>
            <td>${r.pct}%</td>
          </tr>`).join('') : '<tr><td colspan="5" class="empty-row">No budget or spend data for this month yet.</td></tr>'}</tbody>
      </table>
    </div>
    <div class="tcard">
      <div class="tcard-hdr">
        <span style="font-weight:600;font-size:13px">Recent Purchase Requests</span>
        <button class="btn btn-sm" onclick="App.setPage('pr')">View all →</button>
      </div>
      <table>
        <thead><tr><th>Ref</th><th>Vessel</th><th>Item</th><th>Priority</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>${(recentPRs || []).map(p => `<tr>
          <td class="cell-p">${p.ref}</td>
          <td class="cell-m">${U.vname(p.vessel_id)}</td>
          <td>${p.item}</td>
          <td>${U.badge(p.priority)}</td>
          <td>${U.badge(p.status)}</td>
          <td class="cell-m">${U.fmt(p.created_at?.slice(0, 10))}</td>
        </tr>`).join('') || '<tr><td colspan="6" class="empty-row">No PRs yet — create your first one.</td></tr>'}
        </tbody>
      </table>
    </div>`;
  },

  async renderPipeline(el) {
    const prs = U.readLocal('purchase_requests', []).slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const grouped = {};
    PR_STATUSES.forEach(s => grouped[s] = []);
    (prs || []).forEach(p => { if (grouped[p.status]) grouped[p.status].push(p); });

    el.innerHTML = `
    <div class="page-hdr"><h2>Pipeline View</h2></div>
    <div class="pipeline">
      ${PR_STATUSES.map(s => `
      <div class="pl-col">
        <div class="pl-col-hdr"><span>${s}</span><span>${grouped[s].length}</span></div>
        ${grouped[s].map(p => `
        <div class="pl-card" onclick="App.setPage('pr')">
          <div class="pl-ref">${p.ref}</div>
          <div class="pl-vessel">${U.vname(p.vessel_id)}</div>
          <div class="pl-item">${p.item}</div>
          <div style="margin-top:5px">${U.badge(p.priority)}</div>
        </div>`).join('') || '<div style="text-align:center;font-size:11px;color:var(--hint);padding:8px">—</div>'}
      </div>`).join('')}
    </div>`;
  }
};

// ── BOOT ──
window.addEventListener('load', () => {
  U.ensureSeedData();
  const user = Auth.checkSession();
  if (user) {
    App.launch(user);
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
  }
});
