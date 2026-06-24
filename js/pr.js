// js/pr.js — Purchase Requests

const PR = {
  _liCount: 0,
  _importedItems: [],

  async render(el) {
    const { data: prs } = await sb.from('purchase_requests').select('*').order('created_at', { ascending: false });
    const { data: lic } = await sb.from('pr_line_items').select('pr_id');
    const licMap = {};
    (lic || []).forEach(l => { licMap[l.pr_id] = (licMap[l.pr_id] || 0) + 1; });

    el.innerHTML = `
    <div class="page-hdr">
      <h2>Purchase Requests</h2>
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="PR.openImport()"><span class="ai-badge">✦ AI</span> Import PR File</button>
        <button class="btn btn-primary" onclick="PR.openNew()">+ New PR</button>
      </div>
    </div>
    <div class="tcard">
      <div class="tcard-hdr">
        <div class="filters">
          <select id="fv" onchange="App.renderPage()"><option value="">All Vessels</option>${App.vessels.map(v => `<option value="${v.id}">${v.name}</option>`).join('')}</select>
          <select id="fs" onchange="App.renderPage()"><option value="">All Status</option>${PR_STATUSES.map(s => `<option>${s}</option>`).join('')}</select>
          <select id="fp" onchange="App.renderPage()"><option value="">All Priority</option><option>Normal</option><option>Urgent</option><option>Critical</option></select>
        </div>
      </div>
      <table>
        <thead><tr><th>Ref</th><th>Vessel</th><th>Item Summary</th><th>Line Items</th><th>Priority</th><th>Required By</th><th>Status</th><th></th></tr></thead>
        <tbody>${PR._filterRows(prs || [], licMap)}</tbody>
      </table>
    </div>`;
  },

  _filterRows(prs, licMap) {
    const fv = document.getElementById('fv')?.value || '';
    const fs = document.getElementById('fs')?.value || '';
    const fp = document.getElementById('fp')?.value || '';
    const filtered = prs.filter(p =>
      (!fv || p.vessel_id === fv) && (!fs || p.status === fs) && (!fp || p.priority === fp)
    );
    if (!filtered.length) return '<tr><td colspan="8" class="empty-row">No PRs found.</td></tr>';
    return filtered.map(p => `<tr>
      <td class="cell-p">${p.ref}</td>
      <td class="cell-m">${U.vname(p.vessel_id)}</td>
      <td>${p.item}</td>
      <td><span class="badge b-blue">${licMap[p.id] || 0} items</span></td>
      <td>${U.badge(p.priority)}</td>
      <td class="cell-m">${U.fmt(p.required_by)}</td>
      <td>${U.badge(p.status)}</td>
      <td><div class="td-actions">
        <button class="icon-btn" title="View" onclick="PR.view('${p.id}')">${U.iEye}</button>
        <button class="icon-btn" title="Edit" onclick="PR.edit('${p.id}')">${U.iEdit}</button>
        <button class="icon-btn del" title="Delete" onclick="PR.delete('${p.id}')">${U.iTrash}</button>
      </div></td>
    </tr>`).join('');
  },

  _vesselOpts() { return App.vessels.map(v => `<option value="${v.id}">${v.name}</option>`).join(''); },
  _catOpts(sel) { return CATEGORIES.map(c => `<option ${c === sel ? 'selected' : ''}>${c}</option>`).join(''); },

  openNew() {
    PR._liCount = 1;
    U.modal(`
    <div class="modal-hdr"><h3>New Purchase Request</h3><button class="icon-btn" onclick="U.closeModal()">${U.iX}</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group"><label>Vessel *</label><select id="pr-v"><option value="">Select</option>${PR._vesselOpts()}</select></div>
        <div class="form-group"><label>Priority</label><select id="pr-pri"><option>Normal</option><option>Urgent</option><option>Critical</option></select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Required By (onboard)</label><input type="date" id="pr-rb"></div>
        <div class="form-group"><label>Requested By</label><input type="text" id="pr-req" value="Chief Officer"></div>
      </div>
      <div class="section-lbl">Line Items</div>
      <div style="overflow-x:auto">
        <table class="li-table" id="li-tbl">
          <thead><tr><th>#</th><th>Description *</th><th>Part No</th><th>Qty</th><th>Unit</th><th>Category</th><th>Remarks</th><th></th></tr></thead>
          <tbody id="li-body">${PR._liRow(0)}</tbody>
        </table>
      </div>
      <button class="btn btn-sm" style="margin-top:6px" onclick="PR.addRow()">+ Add item</button>
      <div class="form-group"><label>General Remarks</label><textarea id="pr-rem" placeholder="Any overall notes..."></textarea></div>
    </div>
    <div class="modal-ftr"><button class="btn" onclick="U.closeModal()">Cancel</button><button class="btn btn-primary" onclick="PR.save()">Save PR</button></div>`, true);
  },

  _liRow(i) {
    return `<tr id="li-row-${i}">
      <td>${i + 1}</td>
      <td><input id="li-d-${i}" placeholder="Item description"></td>
      <td><input id="li-p-${i}" placeholder="Optional"></td>
      <td><input type="number" id="li-q-${i}" value="1" style="width:58px"></td>
      <td><input id="li-u-${i}" value="pcs" style="width:55px"></td>
      <td><select id="li-c-${i}">${PR._catOpts()}</select></td>
      <td><input id="li-r-${i}" placeholder="Optional"></td>
      <td>${i > 0 ? `<button class="icon-btn del" onclick="document.getElementById('li-row-${i}').remove()">${U.iTrash}</button>` : ''}</td>
    </tr>`;
  },

  addRow() {
    const i = PR._liCount++;
    document.getElementById('li-body').insertAdjacentHTML('beforeend', PR._liRow(i));
  },

  _collectItems() {
    const items = [];
    for (let i = 0; i < PR._liCount; i++) {
      const desc = document.getElementById(`li-d-${i}`)?.value?.trim();
      if (desc) items.push({
        item_no: items.length + 1,
        description: desc,
        part_no: document.getElementById(`li-p-${i}`)?.value || null,
        qty: parseFloat(document.getElementById(`li-q-${i}`)?.value) || 1,
        unit: document.getElementById(`li-u-${i}`)?.value || 'pcs',
        category: document.getElementById(`li-c-${i}`)?.value || 'Spare Parts',
        remarks: document.getElementById(`li-r-${i}`)?.value || null
      });
    }
    return items;
  },

  async save() {
    const vessel_id = document.getElementById('pr-v').value;
    if (!vessel_id) { U.toast('Select a vessel', 'err'); return; }
    const items = PR._collectItems();
    if (!items.length) { U.toast('Add at least one line item', 'err'); return; }
    const ref = await U.nextRef('purchase_requests', 'PR');
    const summary = items.slice(0, 3).map(i => i.description).join(', ') + (items.length > 3 ? ` + ${items.length - 3} more` : '');
    const { data: pr, error } = await sb.from('purchase_requests').insert({
      ref, vessel_id, item: summary, category: items[0].category,
      priority: document.getElementById('pr-pri').value,
      required_by: document.getElementById('pr-rb').value || null,
      requester: document.getElementById('pr-req').value,
      remarks: document.getElementById('pr-rem').value,
      status: 'Pending RFQ'
    }).select().single();
    if (error) { U.toast('Failed: ' + error.message, 'err'); return; }
    await sb.from('pr_line_items').insert(items.map(it => ({ ...it, pr_id: pr.id })));
    U.toast('PR saved with ' + items.length + ' items', 'ok');
    U.closeModal(); App.renderPage();
  },

  async view(id) {
    const { data: p } = await sb.from('purchase_requests').select('*').eq('id', id).single();
    const { data: items } = await sb.from('pr_line_items').select('*').eq('pr_id', id).order('item_no');
    U.modal(`
    <div class="modal-hdr"><h3>${p.ref} — Detail</h3><button class="icon-btn" onclick="U.closeModal()">${U.iX}</button></div>
    <div class="modal-body">
      <div class="form-row-3" style="font-size:13px">
        <div><div class="cell-m">Vessel</div><div style="font-weight:500">${U.vname(p.vessel_id)}</div></div>
        <div><div class="cell-m">Priority</div><div>${U.badge(p.priority)}</div></div>
        <div><div class="cell-m">Status</div><div>${U.badge(p.status)}</div></div>
        <div><div class="cell-m">Requested By</div><div>${p.requester || '—'}</div></div>
        <div><div class="cell-m">Required By</div><div>${U.fmt(p.required_by)}</div></div>
        <div><div class="cell-m">Created</div><div>${U.fmt(p.created_at?.slice(0, 10))}</div></div>
      </div>
      ${p.remarks ? `<div class="info-box">${p.remarks}</div>` : ''}
      <div class="section-lbl">Line Items (${items?.length || 0})</div>
      <div style="overflow-x:auto">
        <table class="li-table">
          <thead><tr><th>#</th><th>Description</th><th>Part No</th><th>Qty</th><th>Unit</th><th>Category</th><th>Status</th></tr></thead>
          <tbody>${(items || []).map(it => `<tr>
            <td>${it.item_no}</td><td>${it.description}</td><td>${it.part_no || '—'}</td>
            <td>${it.qty}</td><td>${it.unit || '—'}</td><td>${it.category || '—'}</td><td>${U.badge(it.status)}</td>
          </tr>`).join('') || '<tr><td colspan="7" class="empty-row">No line items</td></tr>'}
          </tbody>
        </table>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" onclick="U.closeModal();RFQ.openForPR('${id}')">Issue RFQ from this PR</button>
        <button class="btn btn-sm" onclick="PR.edit('${id}')">Edit PR</button>
      </div>
    </div>`, true);
  },

  async edit(id) {
    const { data: p } = await sb.from('purchase_requests').select('*').eq('id', id).single();
    U.modal(`
    <div class="modal-hdr"><h3>Edit ${p.ref}</h3><button class="icon-btn" onclick="U.closeModal()">${U.iX}</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group"><label>Vessel</label><select id="ep-v">${App.vessels.map(v => `<option value="${v.id}" ${v.id === p.vessel_id ? 'selected' : ''}>${v.name}</option>`).join('')}</select></div>
        <div class="form-group"><label>Status</label><select id="ep-s">${PR_STATUSES.map(s => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Priority</label><select id="ep-pri"><option ${p.priority==='Normal'?'selected':''}>Normal</option><option ${p.priority==='Urgent'?'selected':''}>Urgent</option><option ${p.priority==='Critical'?'selected':''}>Critical</option></select></div>
        <div class="form-group"><label>Required By</label><input type="date" id="ep-rb" value="${p.required_by || ''}"></div>
      </div>
      <div class="form-group"><label>Requested By</label><input type="text" id="ep-req" value="${p.requester || ''}"></div>
      <div class="form-group"><label>Remarks</label><textarea id="ep-rem">${p.remarks || ''}</textarea></div>
    </div>
    <div class="modal-ftr"><button class="btn" onclick="U.closeModal()">Cancel</button><button class="btn btn-primary" onclick="PR._doEdit('${id}')">Update</button></div>`);
  },

  async _doEdit(id) {
    const { error } = await sb.from('purchase_requests').update({
      vessel_id: document.getElementById('ep-v').value,
      status: document.getElementById('ep-s').value,
      priority: document.getElementById('ep-pri').value,
      required_by: document.getElementById('ep-rb').value || null,
      requester: document.getElementById('ep-req').value,
      remarks: document.getElementById('ep-rem').value
    }).eq('id', id);
    if (error) { U.toast('Update failed', 'err'); return; }
    U.toast('PR updated', 'ok'); U.closeModal(); App.renderPage();
  },

  async delete(id) {
    if (!confirm('Delete this PR and all its line items?')) return;
    await sb.from('pr_line_items').delete().eq('pr_id', id);
    await sb.from('purchase_requests').delete().eq('id', id);
    U.toast('PR deleted'); App.renderPage();
  },

  // ── AI IMPORT ──
  openImport() {
    PR._importedItems = [];
    U.modal(`
    <div class="modal-hdr"><h3><span class="ai-badge">✦ AI</span> Import PR from File</h3><button class="icon-btn" onclick="U.closeModal()">${U.iX}</button></div>
    <div class="modal-body">
      <div class="info-box">Upload the vessel's PR file. AI reads it and extracts all line items automatically. Supports Excel (.xlsx) and Word (.docx).</div>
      <div class="form-row">
        <div class="form-group"><label>Vessel *</label><select id="imp-v"><option value="">Select vessel</option>${PR._vesselOpts()}</select></div>
        <div class="form-group"><label>Priority</label><select id="imp-pri"><option>Normal</option><option>Urgent</option><option>Critical</option></select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Required By</label><input type="date" id="imp-rb"></div>
        <div class="form-group"><label>Requested By</label><input type="text" id="imp-req" value="Chief Officer"></div>
      </div>
      <div class="form-group"><label>PR File *</label>
        <label class="upload-zone" for="imp-file">${U.iUp}<p>Click to upload — Excel or Word</p></label>
        <input type="file" id="imp-file" accept=".xlsx,.xls,.docx,.doc,.csv,.txt" style="display:none" onchange="PR._previewImport(this)">
      </div>
      <div id="imp-preview"></div>
    </div>
    <div class="modal-ftr">
      <button class="btn" onclick="U.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="imp-btn" style="display:none" onclick="PR._saveImport()">Save PR</button>
    </div>`, true);
  },

  async _previewImport(input) {
    const file = input.files[0]; if (!file) return;
    const prev = document.getElementById('imp-preview');
    prev.innerHTML = '<div class="loading" style="padding:16px"><div class="spinner"></div> AI reading...</div>';
    const items = await U.readFileAI(file, 'pr');
    if (!items?.length) { prev.innerHTML = '<div class="warn-box">Could not extract items. Check the file format.</div>'; return; }
    PR._importedItems = items;
    prev.innerHTML = `
    <div class="ok-box">✦ AI extracted ${items.length} line items — review below before saving</div>
    <div style="overflow-x:auto;margin-top:8px">
    <table class="li-table"><thead><tr><th>#</th><th>Description</th><th>Part No</th><th>Qty</th><th>Unit</th><th>Category</th></tr></thead>
    <tbody>${items.map((it, i) => `<tr>
      <td>${it.item_no || i + 1}</td>
      <td><input value="${it.description || ''}" onchange="PR._importedItems[${i}].description=this.value"></td>
      <td><input value="${it.part_no || ''}" placeholder="—" onchange="PR._importedItems[${i}].part_no=this.value"></td>
      <td><input type="number" value="${it.qty || 1}" style="width:58px" onchange="PR._importedItems[${i}].qty=+this.value"></td>
      <td><input value="${it.unit || 'pcs'}" style="width:55px" onchange="PR._importedItems[${i}].unit=this.value"></td>
      <td><select onchange="PR._importedItems[${i}].category=this.value">${CATEGORIES.map(c => `<option ${c === it.category ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
    </tr>`).join('')}
    </tbody></table></div>`;
    document.getElementById('imp-btn').style.display = 'inline-flex';
  },

  async _saveImport() {
    const vessel_id = document.getElementById('imp-v').value;
    if (!vessel_id) { U.toast('Select a vessel', 'err'); return; }
    if (!PR._importedItems.length) { U.toast('No items', 'err'); return; }
    const ref = await U.nextRef('purchase_requests', 'PR');
    const summary = PR._importedItems.slice(0, 3).map(i => i.description).join(', ') + (PR._importedItems.length > 3 ? ` + ${PR._importedItems.length - 3} more` : '');
    const { data: pr, error } = await sb.from('purchase_requests').insert({
      ref, vessel_id, item: summary, category: PR._importedItems[0]?.category || 'Spare Parts',
      priority: document.getElementById('imp-pri').value,
      required_by: document.getElementById('imp-rb').value || null,
      requester: document.getElementById('imp-req').value,
      status: 'Pending RFQ'
    }).select().single();
    if (error) { U.toast('Failed: ' + error.message, 'err'); return; }
    await sb.from('pr_line_items').insert(PR._importedItems.map((it, i) => ({ ...it, item_no: it.item_no || i + 1, pr_id: pr.id })));
    U.toast('PR imported — ' + PR._importedItems.length + ' items', 'ok');
    U.closeModal(); App.renderPage();
  }
};
