// js/vendors.js
const Vendors = {
  filters: { text: '', location: '', service: '' },
  allVendors: [],

  applyFilters() {
    const filtered = (Vendors.allVendors || []).filter(v => {
      const text = Vendors.filters.text.toLowerCase();
      const location = Vendors.filters.location.toLowerCase();
      const service = Vendors.filters.service.toLowerCase();
      const haystack = [
        v.name,
        v.country,
        v.port,
        v.contact_person,
        v.currency,
        v.payment_terms,
        v.notes,
        (v.categories || []).join(' ')
      ].join(' ').toLowerCase();
      const matchesText = !text || haystack.includes(text);
      const matchesLocation = !location || [v.country, v.port].join(' ').toLowerCase().includes(location);
      const matchesService = !service || (v.categories || []).some(c => c.toLowerCase().includes(service)) || (v.notes || '').toLowerCase().includes(service);
      return matchesText && matchesLocation && matchesService;
    });
    const grid = document.getElementById('vendor-grid');
    if (grid) {
      grid.innerHTML = filtered.map(v => `
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
          ${v.port ? `<div style="font-size:12px;color:var(--muted)">📍 ${v.port}</div>` : ''}
          ${v.document_url ? `<div style="margin-top:6px;font-size:12px"><a href="${v.document_url}" target="_blank" rel="noopener">📄 View brochure / document</a></div>` : ''}
          ${v.document_notes ? `<div style="font-size:11px;color:var(--muted)">${v.document_notes}</div>` : ''}
          ${v.notes ? `<div style="margin-top:6px;font-size:11px;color:var(--muted)">${v.notes}</div>` : ''}
        </div>`).join('') || '<div class="empty">No vendors matched the current filters.</div>';
    }
  },

  async render(el) {
    const vlist = U.readLocal('vendors', []).filter(v => v.active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    Vendors.allVendors = vlist || [];
    window._vendors = Vendors.allVendors;
    el.innerHTML = `
    <div class="page-hdr">
      <div>
        <h2>Vendor Database</h2>
        <div class="page-sub">Filter by supplier name, location, or offered services.</div>
      </div>
      <div class="filters">
        <button class="btn btn-primary" onclick="Vendors.openNew()">+ Add Vendor</button>
      </div>
    </div>
    <div class="card filters-card">
      <div class="filter-row">
        <div class="form-group compact">
          <label>Supplier Name</label>
          <input type="search" placeholder="Search by name" value="${Vendors.filters.text}" oninput="Vendors.filters.text=this.value; Vendors.applyFilters()">
        </div>
        <div class="form-group compact">
          <label>Location</label>
          <input type="text" placeholder="Country or port" value="${Vendors.filters.location}" oninput="Vendors.filters.location=this.value; Vendors.applyFilters()">
        </div>
        <div class="form-group compact">
          <label>Services / Spares</label>
          <input type="text" placeholder="e.g. Engines" value="${Vendors.filters.service}" oninput="Vendors.filters.service=this.value; Vendors.applyFilters()">
        </div>
      </div>
    </div>
    <div class="vendor-grid" id="vendor-grid"></div>`;
    Vendors.applyFilters();
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
    <div class="form-group"><label>Supply Categories</label>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:6px 0">${CATEGORIES.map(c => `
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)">
          <input type="checkbox" class="vendor-cat-checkbox" value="${c}" ${(v.categories || []).includes(c) ? 'checked' : ''}>
          ${c}
        </label>`).join('')}</div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Brochure / Document URL</label><input type="url" id="vn-doc-url" value="${v.document_url || ''}" placeholder="https://..."></div>
      <div class="form-group"><label>Document Notes</label><input type="text" id="vn-doc-notes" value="${v.document_notes || ''}" placeholder="Brochure / spec sheet"></div>
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
    const v = (Vendors.allVendors || []).find(x => x.id === id) || U.readLocal('vendors', []).find(x => x.id === id);
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
      categories: Array.from(document.querySelectorAll('.vendor-cat-checkbox:checked')).map(o => o.value),
      rating: parseInt(document.getElementById('vn-rating').value) || 3,
      notes: document.getElementById('vn-notes').value,
      document_url: document.getElementById('vn-doc-url').value.trim(),
      document_notes: document.getElementById('vn-doc-notes').value.trim(),
      active: true
    };
    if (id) {
      U.updateLocal('vendors', id, payload);
    } else {
      U.addLocal('vendors', payload);
    }
    Vendors.allVendors = U.readLocal('vendors', []).filter(v => v.active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    window._vendors = Vendors.allVendors;
    U.toast('Vendor saved', 'ok'); U.closeModal(); App.renderPage();
  },

  async deactivate(id) {
    if (!confirm('Remove this vendor?')) return;
    U.updateLocal('vendors', id, { active: false });
    Vendors.allVendors = U.readLocal('vendors', []).filter(v => v.active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    window._vendors = Vendors.allVendors;
    U.toast('Vendor removed'); App.renderPage();
  }
};
