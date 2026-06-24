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
  state: { vessels: [], company: {}, editingVesselId: null, vesselForm: {} },

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
    const company = Settings._loadCompany();
    const form = Settings.state.vesselForm || {};
    const editingId = Settings.state.editingVesselId;
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
      App.renderPage();
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
    App.renderPage();
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
      App.renderPage();
    } catch (err) {
      console.error(err);
      U.toast('Unable to remove vessel', 'err');
    }
  }
};

window.Settings = Settings;
