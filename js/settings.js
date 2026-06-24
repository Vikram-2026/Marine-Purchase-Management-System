// js/settings.js
// Optional SQL for Supabase:
// create table if not exists vessels (
//   id uuid primary key default gen_random_uuid(),
//   name text not null,
//   imo text,
//   registration_no text,
//   flag text,
//   status text default 'Active',
//   notes text,
//   active boolean default true,
//   created_at timestamptz default now()
// );

const Settings = {
  state: {
    vessels: [],
    company: {},
    editingVesselId: null,
    vesselForm: {},
    dropdowns: {},
    activeDropdownKey: 'pr_request_type',
    editingDropdownValue: null,
    budgets: {}
  },

  _defaultDropdowns() {
    return {
      pr_request_type: ['Spare Parts','Stores','Safety Equipment','Provision','Repair & Maintenance','Dry Dock','Survey','Other'],
      pr_department: ['Deck','Engine','Electrical','Safety','Galley','Operations','Office'],
      pr_category: [...CATEGORIES],
      pr_unit: ['pcs','set','ltr','kg','m','box','each','pair','lot'],
      vendor_services: ['Deck Stores','Engine Stores','Spare Parts','Safety Equipment','Provisions','Electrical','Hydraulic','Navigation','Accommodation','Medical'],
      priority: ['Normal','Urgent','Critical']
    };
  },

  loadDropdowns() {
    try {
      const saved = JSON.parse(localStorage.getItem('mp_dropdowns') || '{}');
      Settings.state.dropdowns = { ...Settings._defaultDropdowns(), ...saved };
    } catch {
      Settings.state.dropdowns = Settings._defaultDropdowns();
    }
    return Settings.state.dropdowns;
  },

  dropdownOptions(key, fallback = []) {
    Settings.loadDropdowns();
    const values = Settings.state.dropdowns?.[key];
    return Array.isArray(values) && values.length ? values : fallback;
  },

  loadBudgets() {
    try {
      Settings.state.budgets = JSON.parse(localStorage.getItem('mp_vessel_budgets') || '{}');
    } catch {
      Settings.state.budgets = {};
    }
    return Settings.state.budgets;
  },

  saveVesselBudget() {
    const vesselId = document.getElementById('budget-vessel').value;
    const month = document.getElementById('budget-month').value || new Date().toISOString().slice(0, 7);
    const amount = parseFloat(document.getElementById('budget-amount').value);
    if (!vesselId || !amount) { U.toast('Select a vessel and enter a budget', 'err'); return; }
    const key = `${vesselId}::${month}`;
    const next = { ...Settings.loadBudgets(), [key]: amount };
    Settings.state.budgets = next;
    localStorage.setItem('mp_vessel_budgets', JSON.stringify(next));
    U.toast('Monthly budget saved', 'ok');
    App.renderPage();
  },

  removeVesselBudget(key) {
    const next = { ...Settings.loadBudgets() };
    delete next[key];
    Settings.state.budgets = next;
    localStorage.setItem('mp_vessel_budgets', JSON.stringify(next));
    U.toast('Budget removed', 'ok');
    App.renderPage();
  },

  async loadVessels() {
    const local = JSON.parse(localStorage.getItem('mp_vessels_local') || '[]');
    Settings.state.vessels = local;
    App.vessels = Settings.state.vessels;
    if (!sb) return;
    try {
      const { data } = await sb.from('vessels').select('*').eq('active', true).order('name');
      if (Array.isArray(data) && data.length) {
        Settings.state.vessels = data;
        localStorage.setItem('mp_vessels_local', JSON.stringify(data));
        App.vessels = Settings.state.vessels;
      }
    } catch (err) {
      console.error('Error loading vessels', err);
    }
  },

  _loadCompany() {
    try {
      Settings.state.company = JSON.parse(localStorage.getItem('mp_company') || '{}');
    } catch {
      Settings.state.company = {};
    }
    return Settings.state.company;
  },

  async render(el) {
    await Settings.loadVessels();
    Settings.loadDropdowns();
    Settings.loadBudgets();
    const company = Settings._loadCompany();
    const form = Settings.state.vesselForm || {};
    const editingId = Settings.state.editingVesselId;
    const activeKey = Settings.state.activeDropdownKey;
    const values = Settings.state.dropdowns?.[activeKey] || [];
    const budgetEntries = Object.entries(Settings.state.budgets || {}).map(([key, amount]) => {
      const [vesselId, month] = key.split('::');
      const vessel = (Settings.state.vessels || []).find(v => v.id === vesselId);
      return { key, month, vesselName: vessel?.name || '—', amount };
    }).sort((a, b) => (a.month > b.month ? -1 : 1));
    el.innerHTML = `
    <div class="page-hdr">
      <div>
        <h2>Settings</h2>
        <div class="page-sub">Manage company defaults and vessel registry.</div>
      </div>
    </div>
    <div class="settings-grid">
      <div class="settings-card">
        <div class="section-lbl">Company profile</div>
        <div class="form-row">
          <div class="form-group"><label>Company Name</label><input id="set-company-name" value="${company.company_name || ''}" placeholder="Marine Procurement Ltd"></div>
          <div class="form-group"><label>Default Currency</label><select id="set-company-currency">${CURRENCIES.map(c => `<option ${c === (company.default_currency || 'USD') ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Email</label><input id="set-company-email" value="${company.email || ''}" placeholder="ops@company.com"></div>
          <div class="form-group"><label>Phone</label><input id="set-company-phone" value="${company.phone || ''}" placeholder="+65 0000 0000"></div>
        </div>
        <div class="form-group"><label>Address</label><textarea id="set-company-address">${company.address || ''}</textarea></div>
        <div class="settings-actions">
          <button class="btn btn-primary" onclick="Settings.saveCompany()">Save Company</button>
        </div>
      </div>
      <div class="settings-card">
        <div class="section-lbl">Vessel management</div>
        <div class="form-row">
          <div class="form-group"><label>Vessel Name</label><input id="set-vessel-name" value="${form.name || ''}" placeholder="e.g. MV Ocean Star"></div>
          <div class="form-group"><label>IMO</label><input id="set-vessel-imo" value="${form.imo || ''}" placeholder="1234567"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Registration No.</label><input id="set-vessel-reg" value="${form.registration_no || ''}" placeholder="SG-001"></div>
          <div class="form-group"><label>Flag</label><input id="set-vessel-flag" value="${form.flag || ''}" placeholder="Singapore"></div>
        </div>
        <div class="form-group"><label>Notes</label><textarea id="set-vessel-notes" placeholder="Operational notes">${form.notes || ''}</textarea></div>
        <div class="settings-actions">
          ${editingId ? `<button class="btn" onclick="Settings.resetVesselForm()">Cancel</button>` : ''}
          <button class="btn btn-primary" onclick="Settings.saveVessel()">${editingId ? 'Update Vessel' : 'Add Vessel'}</button>
        </div>
        <div class="vessel-list">
          ${(Settings.state.vessels || []).map(v => `
            <div class="vessel-row">
              <div>
                <div class="vessel-name">${v.name}</div>
                <div class="vessel-meta">${v.imo ? 'IMO ' + v.imo : '—'} · ${v.registration_no || '—'}</div>
              </div>
              <div><span class="vessel-chip">${v.flag || '—'}</span></div>
              <div><span class="vessel-chip">${v.status || 'Active'}</span></div>
              <div class="td-actions">
                <button class="icon-btn" onclick="Settings.editVessel('${v.id}')">${U.iEdit}</button>
                <button class="icon-btn del" onclick="Settings.deleteVessel('${v.id}')">${U.iTrash}</button>
              </div>
            </div>
          `).join('') || '<div class="empty">No vessels saved yet.</div>'}
        </div>
      </div>
    </div>
    <div class="settings-card" style="margin-top:16px">
      <div class="section-lbl">Dropdown lists</div>
      <div class="form-row">
        <div class="form-group"><label>Field</label><select id="dd-field" onchange="Settings.selectDropdownGroup(this.value)">${Object.keys(Settings.state.dropdowns).map(k => `<option value="${k}" ${k === activeKey ? 'selected' : ''}>${k.replace(/_/g,' ')}</option>`).join('')}</select></div>
        <div class="form-group"><label>Value</label><input id="dd-value" value="${Settings.state.editingDropdownValue || ''}" placeholder="Add an option"></div>
      </div>
      <div class="settings-actions">
        ${Settings.state.editingDropdownValue ? `<button class="btn" onclick="Settings.cancelDropdownEdit()">Cancel</button>` : ''}
        <button class="btn btn-primary" onclick="Settings.saveDropdownValue()">${Settings.state.editingDropdownValue ? 'Update' : 'Add'} Value</button>
      </div>
      <div class="vessel-list">
        ${(values || []).map(v => `
          <div class="vessel-row">
            <div class="vessel-name">${v}</div>
            <div></div><div></div>
            <div class="td-actions">
              <button class="icon-btn" onclick="Settings.editDropdownValue('${v}')">${U.iEdit}</button>
              <button class="icon-btn del" onclick="Settings.deleteDropdownValue('${v}')">${U.iTrash}</button>
            </div>
          </div>
        `).join('') || '<div class="empty">No values yet.</div>'}
      </div>
    </div>
    <div class="settings-card" style="margin-top:16px">
      <div class="section-lbl">Monthly vessel budgets</div>
      <div class="form-row">
        <div class="form-group"><label>Vessel</label><select id="budget-vessel">${(Settings.state.vessels || []).map(v => `<option value="${v.id}">${v.name}</option>`).join('')}</select></div>
        <div class="form-group"><label>Month</label><input type="month" id="budget-month" value="${new Date().toISOString().slice(0, 7)}"></div>
        <div class="form-group"><label>Budget Amount</label><input type="number" id="budget-amount" placeholder="0.00"></div>
      </div>
      <div class="settings-actions"><button class="btn btn-primary" onclick="Settings.saveVesselBudget()">Save Budget</button></div>
      <div class="vessel-list">
        ${(budgetEntries || []).map(item => `
          <div class="vessel-row">
            <div>
              <div class="vessel-name">${item.vesselName}</div>
              <div class="vessel-meta">${item.month}</div>
            </div>
            <div><span class="vessel-chip">USD ${Number(item.amount).toLocaleString()}</span></div>
            <div></div>
            <div class="td-actions"><button class="icon-btn del" onclick="Settings.removeVesselBudget('${item.key}')">${U.iTrash}</button></div>
          </div>
        `).join('') || '<div class="empty">No monthly budgets yet.</div>'}
      </div>
    </div>`;
  },

  saveCompany() {
    const payload = {
      company_name: document.getElementById('set-company-name').value.trim(),
      default_currency: document.getElementById('set-company-currency').value,
      email: document.getElementById('set-company-email').value.trim(),
      phone: document.getElementById('set-company-phone').value.trim(),
      address: document.getElementById('set-company-address').value.trim()
    };
    localStorage.setItem('mp_company', JSON.stringify(payload));
    Settings.state.company = payload;
    U.toast('Company settings saved', 'ok');
  },

  selectDropdownGroup(key) {
    Settings.state.activeDropdownKey = key;
    Settings.state.editingDropdownValue = null;
    App.renderPage();
  },

  cancelDropdownEdit() {
    Settings.state.editingDropdownValue = null;
    App.renderPage();
  },

  editDropdownValue(value) {
    Settings.state.editingDropdownValue = value;
    App.renderPage();
  },

  saveDropdownValue() {
    const key = Settings.state.activeDropdownKey;
    const newValue = document.getElementById('dd-value').value.trim();
    if (!newValue) { U.toast('Enter a dropdown value', 'err'); return; }
    const current = Settings.state.dropdowns?.[key] || [];
    const list = [...current];
    if (Settings.state.editingDropdownValue) {
      const idx = list.indexOf(Settings.state.editingDropdownValue);
      if (idx >= 0) list[idx] = newValue;
    } else if (!list.includes(newValue)) {
      list.push(newValue);
    }
    Settings.state.dropdowns[key] = list;
    localStorage.setItem('mp_dropdowns', JSON.stringify(Settings.state.dropdowns));
    Settings.state.editingDropdownValue = null;
    U.toast('Dropdown list updated', 'ok');
    App.renderPage();
  },

  deleteDropdownValue(value) {
    const key = Settings.state.activeDropdownKey;
    const list = (Settings.state.dropdowns?.[key] || []).filter(v => v !== value);
    Settings.state.dropdowns[key] = list;
    localStorage.setItem('mp_dropdowns', JSON.stringify(Settings.state.dropdowns));
    U.toast('Dropdown value removed', 'ok');
    App.renderPage();
  },

  async saveVessel() {
    const id = Settings.state.editingVesselId;
    const payload = {
      name: document.getElementById('set-vessel-name').value.trim(),
      imo: document.getElementById('set-vessel-imo').value.trim(),
      registration_no: document.getElementById('set-vessel-reg').value.trim(),
      flag: document.getElementById('set-vessel-flag').value.trim(),
      notes: document.getElementById('set-vessel-notes').value.trim(),
      status: 'Active',
      active: true
    };
    if (!payload.name) { U.toast('Vessel name required', 'err'); return; }
    try {
      if (sb && id) {
        await sb.from('vessels').update(payload).eq('id', id);
      } else if (sb) {
        await sb.from('vessels').insert(payload);
      } else {
        const list = [...Settings.state.vessels];
        const next = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), ...payload };
        list.push(next);
        localStorage.setItem('mp_vessels_local', JSON.stringify(list));
        Settings.state.vessels = list;
      }
      if (id && sb) {
        await Settings.loadVessels();
      } else if (!id) {
        await Settings.loadVessels();
      }
      Settings.resetVesselForm();
      U.toast(id ? 'Vessel updated' : 'Vessel added', 'ok');
      App.setPage('settings');
    } catch (err) {
      console.error(err);
      const list = [...Settings.state.vessels];
      const next = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), ...payload };
      list.push(next);
      localStorage.setItem('mp_vessels_local', JSON.stringify(list));
      Settings.state.vessels = list;
      Settings.resetVesselForm();
      U.toast('Vessel saved locally', 'ok');
      App.renderPage();
    }
  },

  async editVessel(id) {
    const vessel = (Settings.state.vessels || []).find(v => v.id === id);
    if (!vessel) return;
    Settings.state.editingVesselId = id;
    Settings.state.vesselForm = {
      name: vessel.name || '',
      imo: vessel.imo || '',
      registration_no: vessel.registration_no || '',
      flag: vessel.flag || '',
      notes: vessel.notes || ''
    };
    App.setPage('settings');
    U.toast('Vessel details loaded for editing', 'ok');
  },

  resetVesselForm() {
    Settings.state.editingVesselId = null;
    Settings.state.vesselForm = {};
  },

  async deleteVessel(id) {
    if (!confirm('Remove this vessel from the active registry?')) return;
    try {
      if (sb) {
        await sb.from('vessels').update({ active: false }).eq('id', id);
      }
      const list = (Settings.state.vessels || []).filter(v => v.id !== id);
      Settings.state.vessels = list;
      localStorage.setItem('mp_vessels_local', JSON.stringify(list));
      App.vessels = Settings.state.vessels;
      U.toast('Vessel removed', 'ok');
      App.setPage('settings');
    } catch (err) {
      console.error(err);
      U.toast('Unable to remove vessel', 'err');
    }
  }
};

window.Settings = Settings;
