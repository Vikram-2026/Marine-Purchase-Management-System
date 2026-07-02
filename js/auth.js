// js/auth.js — username/password auth with admin approval flow

const Auth = {
  currentUser: null,

  showTab(tab) {
    document.getElementById('tab-login').style.display  = tab === 'login'    ? 'block' : 'none';
    document.getElementById('tab-register').style.display = tab === 'register' ? 'block' : 'none';
    document.querySelectorAll('.auth-tab').forEach((t, i) =>
      t.classList.toggle('active', (tab === 'login' && i === 0) || (tab === 'register' && i === 1))
    );
  },

  async login() {
    const username = document.getElementById('login-user').value.trim().toLowerCase();
    const password = document.getElementById('login-pass').value;
    const msg = document.getElementById('login-msg');
    msg.className = 'auth-msg'; msg.textContent = '';
    if (!username || !password) { msg.textContent = 'Enter username and password'; msg.className = 'auth-msg err'; return; }
    msg.textContent = 'Signing in...';

    U.ensureSeedData();
    const users = U.readLocal('users', []);
    const data = users.find(u => u.username === username && u.password_hash === password);

    if (!data) { msg.textContent = 'Invalid username or password'; msg.className = 'auth-msg err'; return; }
    if (data.status === 'Pending') { msg.textContent = 'Your account is pending admin approval'; msg.className = 'auth-msg err'; return; }
    if (data.status === 'Suspended') { msg.textContent = 'Account suspended. Contact admin.'; msg.className = 'auth-msg err'; return; }

    localStorage.setItem('mp_session', JSON.stringify({ id: data.id, username: data.username, full_name: data.full_name, role: data.role }));
    Auth.currentUser = data;
    App.launch(data);
  },

  async register() {
    const full_name = document.getElementById('reg-name').value.trim();
    const username  = document.getElementById('reg-user').value.trim().toLowerCase();
    const password  = document.getElementById('reg-pass').value;
    const role      = document.getElementById('reg-role').value;
    const msg = document.getElementById('reg-msg');
    msg.className = 'auth-msg'; msg.textContent = '';

    if (!full_name || !username || !password) { msg.textContent = 'All fields required'; msg.className = 'auth-msg err'; return; }
    if (password.length < 6) { msg.textContent = 'Password must be at least 6 characters'; msg.className = 'auth-msg err'; return; }
    if (!/^[a-z0-9._-]+$/.test(username)) { msg.textContent = 'Username: only letters, numbers, dot, underscore, hyphen'; msg.className = 'auth-msg err'; return; }
    msg.textContent = 'Submitting request...';

    U.ensureSeedData();
    const users = U.readLocal('users', []);
    if (users.some(u => u.username === username)) { msg.textContent = 'Username already taken'; msg.className = 'auth-msg err'; return; }

    U.addLocal('users', { full_name, username, password_hash: password, role, status: 'Pending' });
    msg.textContent = '✓ Request submitted! Admin will approve your account.'; msg.className = 'auth-msg ok';
    document.getElementById('reg-name').value = '';
    document.getElementById('reg-user').value = '';
    document.getElementById('reg-pass').value = '';
  },

  logout() {
    localStorage.removeItem('mp_session');
    Auth.currentUser = null;
    document.getElementById('app').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-msg').textContent = '';
  },

  checkSession() {
    const s = localStorage.getItem('mp_session');
    if (s) {
      try {
        Auth.currentUser = JSON.parse(s);
        return Auth.currentUser;
      } catch { return null; }
    }
    return null;
  },

  // ── ADMIN: User Management Page ──
  async renderAdmin(el) {
    const users = U.readLocal('users', []).slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const pending = (users || []).filter(u => u.status === 'Pending');
    const others  = (users || []).filter(u => u.status !== 'Pending');

    el.innerHTML = `
    <div class="page-hdr"><h2>🔐 Admin — User Management</h2></div>
    ${pending.length ? `
    <div style="margin-bottom:20px">
      <div class="section-lbl" style="margin-bottom:12px">Pending Approval (${pending.length})</div>
      <div class="tcard">
        <table><thead><tr><th>Full Name</th><th>Username</th><th>Role Requested</th><th>Requested On</th><th>Action</th></tr></thead>
        <tbody>${pending.map(u => `<tr>
          <td class="cell-p">${u.full_name}</td>
          <td class="cell-m">${u.username}</td>
          <td>${U.badge(u.role)}</td>
          <td class="cell-m">${U.fmt(u.created_at?.slice(0,10))}</td>
          <td>
            <div class="td-actions">
              <select id="role-${u.id}" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px">
                <option>Purchase Officer</option><option>Technical Superintendent</option>
                <option>Fleet Manager</option><option>Accounts</option>
              </select>
              <button class="btn btn-sm btn-success" onclick="Auth.approveUser('${u.id}')">✓ Approve</button>
              <button class="btn btn-sm btn-danger" onclick="Auth.rejectUser('${u.id}')">✗ Reject</button>
            </div>
          </td>
        </tr>`).join('')}
        </tbody></table>
      </div>
    </div>` : '<div class="ok-box" style="margin-bottom:20px">✓ No pending approval requests</div>'}
    <div class="section-lbl" style="margin-bottom:12px">All Users (${others.length})</div>
    <div class="tcard">
      <table><thead><tr><th>Full Name</th><th>Username</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead>
      <tbody>${others.map(u => `<tr>
        <td class="cell-p">${u.full_name}</td>
        <td class="cell-m">${u.username}</td>
        <td>${u.role}</td>
        <td>${U.badge(u.status)}</td>
        <td class="cell-m">${U.fmt(u.created_at?.slice(0,10))}</td>
        <td><div class="td-actions">
          ${u.role !== 'Admin' && u.status === 'Active'
            ? `<button class="btn btn-xs btn-danger" onclick="Auth.suspendUser('${u.id}')">Suspend</button>`
            : u.status === 'Suspended'
            ? `<button class="btn btn-xs btn-success" onclick="Auth.activateUser('${u.id}')">Activate</button>`
            : ''}
          ${u.role !== 'Admin' ? `<button class="icon-btn del" onclick="Auth.deleteUser('${u.id}')">${U.iTrash}</button>` : ''}
        </div></td>
      </tr>`).join('') || '<tr><td colspan="6" class="empty-row">No users yet.</td></tr>'}
      </tbody></table>
    </div>`;
  },

  async approveUser(id) {
    const roleEl = document.getElementById('role-' + id);
    const role = roleEl ? roleEl.value : 'Purchase Officer';
    U.updateLocal('users', id, { status: 'Active', role });
    U.toast('User approved', 'ok');
    App.renderPage();
  },

  async rejectUser(id) {
    if (!confirm('Reject and delete this request?')) return;
    U.deleteLocal('users', id);
    U.toast('Request rejected');
    App.renderPage();
  },

  async suspendUser(id) {
    U.updateLocal('users', id, { status: 'Suspended' });
    U.toast('User suspended');
    App.renderPage();
  },

  async activateUser(id) {
    U.updateLocal('users', id, { status: 'Active' });
    U.toast('User activated', 'ok');
    App.renderPage();
  },

  async deleteUser(id) {
    if (!confirm('Permanently delete this user?')) return;
    U.deleteLocal('users', id);
    U.toast('User deleted');
    App.renderPage();
  }
};
