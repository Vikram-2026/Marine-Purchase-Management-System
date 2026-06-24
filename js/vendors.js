// js/vendors.js
const Vendors = {
  filterText: '',

  setFilter(value) {
    Vendors.filterText = value;
    App.renderPage();
  },

  async render(el) {
    const { data: vlist } = await sb.from('vendors').select('*').eq('active', true).order('name');
    const filtered = (vlist || []).filter(v => {
      const text = Vendors.filterText.toLowerCase();
      if (!text) return true;
      return [v.name, v.country, v.contact_person, v.currency, v.payment_terms, (v.categories || []).join(' ')].join(' ').toLowerCase().includes(text);
    });
    window._vendors = filtered; // cache for other modules
    el.innerHTML = `
    <div class="page-hdr">
      <h2>Vendor Database</h2>
      <div class="filters">
        <input type="search" placeholder="Search vendors..." value="${Vendors.filterText}" oninput="Vendors.setFilter(this.value)">
        <button class="btn btn-primary" onclick="Vendors.openNew()">+ Add Vendor</button>
      </div>
    </div>
    <div class="vendor-grid">
      ${(filtered || []).map(v => `
      <div class="vendor-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div><div class="vendor-name">${v.name}</div><div class="vendor-sub">${v.country || '—'} · ${v.currency || 'USD'}</div></div>
          <div style="display:flex;gap:4px">
            <button class="icon-btn" onclick="Vendors.edit('${v.id}')">${U.iEdit}</button>
            <button class="icon-btn del" onclick="Vendors.deactivate('${v.id}')">${U.iTrash}</button>
          </div>
        </div>
        <div class="vendor-cats">${(v.categories || []).map(c => `<span class="badge b-blue">${c}</span>`).join('') || '<span class="cell-m" style="font-size:12px">No categories</span>'}</div>
        <div style="display:flex;gap:16px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:12px">
          <div><div class="cell-m" style="font-size:10px;text-transform:uppercase">Contact</div><div>${v.contact_person || '—'}</div></div>
          <div><div class="cell-m" style="font-size:10px;text-transform:uppercase">Rating</div><div class="rating">${U.stars(v.rating)}</div></div>
          <div><div class="cell-m" style="font-size:10px;text-transform:uppercase">Terms</div><div>${v.payment_terms || '—'}</div></div>
        </div>
        ${v.email ? `<div style="margin-top:8px;font-size:12px;color:var(--blue)">✉ ${v.email}</div>` : ''}
        ${v.phone ? `<div style="font-size:12px;color:var(--muted)">📞 ${v.phone}</div>` : ''}
        ${v.notes ? `<div style="margin-top:6px;font-size:11px;color:var(--muted)">${v.notes}</div>` : ''}
      </div>`).join('') || '<div class="empty">No vendors matched the current filter.</div>'}
    </div>`;
  },

  _form(v = {}) {
    return `
    <div class="form-row">
      <div class="form-group"><label>Vendor Name *</label><input type="text" id="vn-name" value="${v.name || ''}" placeholder="Company name"></div>
      <div class="form-group"><label>Country</label><input type="text" id="vn-country" value="${v.country || ''}" placeholder="e.g. Singapore"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Contact Person</label><input type="text" id="vn-contact" value="${v.contact_person || ''}"></div>
      <div class="form-group"><label>Email</label><input type="email" id="vn-email" value="${v.email || ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Phone</label><input type="text" id="vn-phone" value="${v.phone || ''}"></div>
      <div class="form-group"><label>Port / Location</label><input type="text" id="vn-port" value="${v.port || ''}" placeholder="e.g. Singapore Port"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Currency</label><select id="vn-cur">${CURRENCIES.map(c => `<option ${c === (v.currency || 'USD') ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label>Payment Terms</label><select id="vn-pay"><option value="">—</option>${PAYMENT_TERMS.map(t => `<option ${t === v.payment_terms ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label>Supply Categories (hold Ctrl for multiple)</label>
      <select id="vn-cats" multiple style="height:95px">${CATEGORIES.map(c => `<option ${(v.categories || []).includes(c) ? 'selected' : ''}>${c}</option>`).join('')}</select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Rating (1–5 stars)</label><select id="vn-rating">${[1,2,3,4,5].map(n => `<option ${(v.rating || 3) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="form-group"></div>
    </div>
    <div class="form-group"><label>Notes</label><textarea id="vn-notes">${v.notes || ''}</textarea></div>`;
  },

  openNew() {
    U.modal(`
    <div class="modal-hdr"><h3>Add Vendor</h3><button class="icon-btn" onclick="U.closeModal()">${U.iX}</button></div>
    <div class="modal-body">${Vendors._form()}</div>
    <div class="modal-ftr"><button class="btn" onclick="U.closeModal()">Cancel</button><button class="btn btn-primary" onclick="Vendors.save()">Save Vendor</button></div>`);
  },

  async edit(id) {
    const { data: v } = await sb.from('vendors').select('*').eq('id', id).single();
    U.modal(`
    <div class="modal-hdr"><h3>Edit Vendor</h3><button class="icon-btn" onclick="U.closeModal()">${U.iX}</button></div>
    <div class="modal-body">${Vendors._form(v)}</div>
    <div class="modal-ftr"><button class="btn" onclick="U.closeModal()">Cancel</button><button class="btn btn-primary" onclick="Vendors.save('${id}')">Update</button></div>`);
  },

  async save(id) {
    const name = document.getElementById('vn-name').value.trim();
    if (!name) { U.toast('Vendor name required', 'err'); return; }
    const payload = {
      name,
      country: document.getElementById('vn-country').value,
      contact_person: document.getElementById('vn-contact').value,
      email: document.getElementById('vn-email').value,
      phone: document.getElementById('vn-phone').value,
      port: document.getElementById('vn-port').value,
      currency: document.getElementById('vn-cur').value,
      payment_terms: document.getElementById('vn-pay').value,
      categories: Array.from(document.getElementById('vn-cats').selectedOptions).map(o => o.value),
      rating: parseInt(document.getElementById('vn-rating').value) || 3,
      notes: document.getElementById('vn-notes').value
    };
    if (id) {
      await sb.from('vendors').update(payload).eq('id', id);
    } else {
      await sb.from('vendors').insert(payload);
    }
    const { data: fresh } = await sb.from('vendors').select('*').eq('active', true);
    window._vendors = fresh || [];
    U.toast('Vendor saved', 'ok'); U.closeModal(); App.renderPage();
  },

  async deactivate(id) {
    if (!confirm('Remove this vendor?')) return;
    await sb.from('vendors').update({ active: false }).eq('id', id);
    const { data: fresh } = await sb.from('vendors').select('*').eq('active', true);
    window._vendors = fresh || [];
    U.toast('Vendor removed'); App.renderPage();
  }
};
