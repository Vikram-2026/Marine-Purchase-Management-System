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
    const [
      { count: totalPR }, { count: pendingRFQ }, { count: totalPO },
      { count: pendingInv }, { count: pendingDN }, { data: recentPRs }
    ] = await Promise.all([
      sb.from('purchase_requests').select('*', { count: 'exact', head: true }),
      sb.from('purchase_requests').select('*', { count: 'exact', head: true }).eq('status', 'Pending RFQ'),
      sb.from('purchase_orders').select('*', { count: 'exact', head: true }),
      sb.from('invoices').select('*', { count: 'exact', head: true }).in('status', ['Received', 'Verified']),
      sb.from('purchase_requests').select('*', { count: 'exact', head: true }).eq('status', 'PO Raised'),
      sb.from('purchase_requests').select('*').order('created_at', { ascending: false }).limit(8)
    ]);

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
    const { data: prs } = await sb.from('purchase_requests').select('*').order('created_at', { ascending: false });
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
  // No Supabase keys yet → show config
  if (!SB_URL || !SB_KEY || !sb) {
    document.getElementById('cfg-screen').style.display = 'flex';
    return;
  }
  // Check saved session
  const user = Auth.checkSession();
  if (user) {
    App.launch(user);
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
  }
});
