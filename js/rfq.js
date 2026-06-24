// js/rfq.js — RFQ & Quotes

const RFQ = {
  async render(el) {
    const { data: rfqs } = await sb.from('rfqs').select('*, purchase_requests(ref,item,vessel_id)').order('created_at', { ascending: false });
    const { data: quotes } = await sb.from('quotes').select('rfq_id');
    const qcMap = {};
    (quotes || []).forEach(q => { qcMap[q.rfq_id] = (qcMap[q.rfq_id] || 0) + 1; });

    el.innerHTML = `
    <div class="page-hdr"><h2>RFQ & Quotes</h2><button class="btn btn-primary" onclick="RFQ.openNew()">+ Issue RFQ</button></div>
    <div class="tcard">
      <table>
        <thead><tr><th>RFQ Ref</th><th>PR</th><th>Vessel</th><th>Issued</th><th>Deadline</th><th>Vendors</th><th>Quotes</th><th>Status</th><th></th></tr></thead>
        <tbody>${(rfqs || []).map(r => {
          const pr = r.purchase_requests;
          const qc = qcMap[r.id] || 0;
          const status = r.selected_quote_id ? 'Awarded' : qc > 0 ? 'Quotes Received' : 'RFQ Issued';
          return `<tr>
            <td class="cell-p">${r.ref}</td>
            <td class="cell-m">${pr?.ref || '—'}</td>
            <td class="cell-m">${pr ? U.vname(pr.vessel_id) : '—'}</td>
            <td class="cell-m">${U.fmt(r.issued_date)}</td>
            <td class="cell-m">${U.fmt(r.deadline)}</td>
            <td>${(r.suppliers || []).length}</td>
            <td><span class="badge ${qc > 0 ? 'b-green' : 'b-gray'}">${qc} received</span></td>
            <td>${U.badge(status)}</td>
            <td><div class="td-actions">
              <button class="icon-btn" title="View & Compare" onclick="RFQ.view('${r.id}')">${U.iEye}</button>
              <button class="icon-btn" title="Add Quote" onclick="RFQ.openAddQuote('${r.id}')">${U.iPlus}</button>
            </div></td>
          </tr>`;
        }).join('') || '<tr><td colspan="9" class="empty-row">No RFQs yet.</td></tr>'}
        </tbody>
      </table>
    </div>`;
  },

  async openNew() {
    const { data: eligible } = await sb.from('purchase_requests').select('*,pr_line_items(*)').in('status', ['Pending RFQ', 'RFQ Issued']);
    if (!eligible?.length) { U.toast('No PRs available for RFQ', 'err'); return; }
    RFQ._buildModal(eligible, null);
  },

  async openForPR(prId) {
    const { data: eligible } = await sb.from('purchase_requests').select('*,pr_line_items(*)').in('status', ['Pending RFQ', 'RFQ Issued']);
    RFQ._buildModal(eligible || [], prId);
  },

  _buildModal(eligible, selPrId) {
    const { data: vlist } = { data: window._vendors || [] };
    U.modal(`
    <div class="modal-hdr"><h3>Issue RFQ</h3><button class="icon-btn" onclick="U.closeModal()">${U.iX}</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Select PR *</label>
        <select id="rfq-pr" onchange="RFQ._loadItems(this.value,${JSON.stringify(eligible)})">
          ${eligible.map(p => `<option value="${p.id}" ${p.id === selPrId ? 'selected' : ''}>${p.ref} — ${p.item} (${U.vname(p.vessel_id)})</option>`).join('')}
        </select>
      </div>
      <div id="rfq-items"></div>
      <div class="section-lbl">Vendors to Contact</div>
      <div id="rfq-vendors" style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${(window._vendors || []).map(v => `<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
          <input type="checkbox" class="vnd-chk" value="${v.name}"> ${v.name}
        </label>`).join('') || '<span class="cell-m">No vendors in database yet. Add vendors first.</span>'}
      </div>
      <div class="form-row">
        <div class="form-group"><label>Issue Date</label><input type="date" id="rfq-date" value="${U.today()}"></div>
        <div class="form-group"><label>Quote Deadline</label><input type="date" id="rfq-dl"></div>
      </div>
      <div class="form-group"><label>Notes / Scope</label><textarea id="rfq-notes" placeholder="Specific requirements, port of delivery, maker..."></textarea></div>
    </div>
    <div class="modal-ftr"><button class="btn" onclick="U.closeModal()">Cancel</button><button class="btn btn-primary" onclick="RFQ.save()">Issue RFQ</button></div>`, true);
    if (eligible.length) RFQ._loadItems(selPrId || eligible[0].id, eligible);
  },

  _loadItems(prId, eligible) {
    const pr = eligible.find(p => p.id === prId);
    const items = pr?.pr_line_items || [];
    const sec = document.getElementById('rfq-items');
    if (!items.length) { sec.innerHTML = ''; return; }
    sec.innerHTML = `
    <div class="section-lbl">PR Line Items — assign vendor per item</div>
    <div class="info-box">Select items for this RFQ. Assign a specific vendor to route individual items to different suppliers.</div>
    <div style="overflow-x:auto">
    <table class="li-table"><thead><tr><th>✓</th><th>#</th><th>Description</th><th>Qty</th><th>Specific Vendor</th></tr></thead>
    <tbody>${items.map(it => `<tr>
      <td><input type="checkbox" class="li-chk" value="${it.id}" checked></td>
      <td>${it.item_no}</td><td>${it.description}</td><td>${it.qty} ${it.unit || ''}</td>
      <td><select id="livendor-${it.id}"><option value="">All selected vendors</option>
        ${(window._vendors || []).map(v => `<option value="${v.name}">${v.name}</option>`).join('')}
      </select></td>
    </tr>`).join('')}
    </tbody></table></div>`;
  },

  async save() {
    const pr_id = document.getElementById('rfq-pr').value;
    const suppliers = Array.from(document.querySelectorAll('.vnd-chk:checked')).map(c => c.value);
    if (!suppliers.length) { U.toast('Select at least one vendor', 'err'); return; }
    const ref = await U.nextRef('rfqs', 'RFQ');
    const { data: rfq, error } = await sb.from('rfqs').insert({
      ref, pr_id,
      issued_date: document.getElementById('rfq-date').value,
      deadline: document.getElementById('rfq-dl').value || null,
      suppliers,
      notes: document.getElementById('rfq-notes').value
    }).select().single();
    if (error) { U.toast('Failed: ' + error.message, 'err'); return; }
    // Update checked line items
    const liChks = document.querySelectorAll('.li-chk:checked');
    for (const chk of liChks) {
      await sb.from('pr_line_items').update({ rfq_id: rfq.id, status: 'RFQ Issued' }).eq('id', chk.value);
    }
    await sb.from('purchase_requests').update({ status: 'RFQ Issued' }).eq('id', pr_id);
    U.toast('RFQ issued', 'ok'); U.closeModal(); App.renderPage();
  },

  async view(id) {
    const { data: r } = await sb.from('rfqs').select('*, purchase_requests(ref,item,vessel_id)').eq('id', id).single();
    const { data: quotes } = await sb.from('quotes').select('*').eq('rfq_id', id).order('amount');
    const pr = r.purchase_requests;
    const amountsUSD = (quotes || []).map(q => U.toUSD(q.amount, q.currency));
    const minUSD = amountsUSD.length ? Math.min(...amountsUSD) : null;

    U.modal(`
    <div class="modal-hdr"><h3>${r.ref} — Quote Comparison</h3><button class="icon-btn" onclick="U.closeModal()">${U.iX}</button></div>
    <div class="modal-body">
      <div class="form-row" style="font-size:13px">
        <div><div class="cell-m">PR</div><div class="cell-p">${pr?.ref || '—'}</div></div>
        <div><div class="cell-m">Vessel</div><div class="cell-p">${pr ? U.vname(pr.vessel_id) : '—'}</div></div>
        <div><div class="cell-m">Issued</div><div>${U.fmt(r.issued_date)}</div></div>
        <div><div class="cell-m">Deadline</div><div>${U.fmt(r.deadline)}</div></div>
      </div>
      <div class="section-lbl">Quotes — compared in USD</div>
      ${!quotes?.length ? `<div class="empty">No quotes received yet.<br>
        <button class="btn btn-sm btn-primary" style="margin-top:10px" onclick="U.closeModal();RFQ.openAddQuote('${id}')">+ Add Quote</button></div>` : `
      <div style="overflow-x:auto">
      <table class="qc-table">
        <thead><tr><th>Supplier</th><th>Original</th><th>USD equiv.</th><th>Delivery</th><th>Validity</th><th>Notes</th><th>Action</th></tr></thead>
        <tbody>${quotes.map((q, i) => {
          const usd = amountsUSD[i];
          const best = usd === minUSD;
          return `<tr class="${q.id === r.selected_quote_id ? 'winner' : ''}">
            <td class="cell-p">${q.supplier}</td>
            <td>${q.currency} ${q.amount?.toLocaleString()}</td>
            <td class="${best ? 'best-price' : ''}">$${usd.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ${best ? '★' : ''}</td>
            <td>${q.delivery_time || '—'}</td>
            <td>${q.validity || '—'}</td>
            <td>${q.notes || '—'}</td>
            <td>${q.id === r.selected_quote_id
              ? '<span class="badge b-green">✓ Awarded</span>'
              : `<button class="btn btn-xs btn-primary" onclick="RFQ.award('${id}','${q.id}','${q.supplier}','${r.pr_id}')">Award</button>`}
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`}
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="U.closeModal();RFQ.openAddQuote('${id}')">+ Add Quote Manually</button>
        <button class="btn btn-sm" onclick="U.closeModal();RFQ.openAIQuote('${id}')"><span class="ai-badge">✦ AI</span> Import Quote File</button>
      </div>
    </div>`, true);
  },

  openAddQuote(rfqId) {
    U.modal(`
    <div class="modal-hdr"><h3>Add Quote</h3><button class="icon-btn" onclick="U.closeModal()">${U.iX}</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group"><label>Supplier *</label>
          <select id="q-sup"><option value="">Select vendor</option>
            ${(window._vendors || []).map(v => `<option>${v.name}</option>`).join('')}
            <option value="__other">Other (type below)</option>
          </select>
        </div>
        <div class="form-group"><label>Other Supplier Name</label><input type="text" id="q-sup2" placeholder="If not in list"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Amount *</label><input type="number" id="q-amt" placeholder="0.00" oninput="RFQ._showUSD()"></div>
        <div class="form-group"><label>Currency</label><select id="q-cur" onchange="RFQ._showUSD()">${CURRENCIES.map(c => `<option>${c}</option>`).join('')}</select></div>
      </div>
      <div id="q-usd" class="cell-m" style="font-size:12px;margin-top:-8px"></div>
      <div class="form-row">
        <div class="form-group"><label>Delivery Time</label><input type="text" id="q-del" placeholder="e.g. 2 weeks"></div>
        <div class="form-group"><label>Quote Validity</label><input type="text" id="q-val" placeholder="e.g. 30 days"></div>
      </div>
      <div class="form-group"><label>Notes / Terms</label><input type="text" id="q-notes" placeholder="FOB Singapore, CIF port, ex-stock..."></div>
      <div class="form-group"><label>Attach Quote File</label><input type="file" id="q-file" accept=".pdf,.xlsx,.xls,.docx,.doc"></div>
    </div>
    <div class="modal-ftr"><button class="btn" onclick="U.closeModal()">Cancel</button><button class="btn btn-primary" onclick="RFQ.saveQuote('${rfqId}')">Save Quote</button></div>`);
  },

  _showUSD() {
    const amt = parseFloat(document.getElementById('q-amt')?.value) || 0;
    const cur = document.getElementById('q-cur')?.value || 'USD';
    const el = document.getElementById('q-usd');
    if (el && amt) el.textContent = `≈ USD ${U.toUSD(amt, cur).toFixed(2)}`;
    else if (el) el.textContent = '';
  },

  async saveQuote(rfqId) {
    let supplier = document.getElementById('q-sup').value;
    if (supplier === '__other') supplier = document.getElementById('q-sup2').value.trim();
    const amount = parseFloat(document.getElementById('q-amt').value);
    if (!supplier || !amount) { U.toast('Supplier and amount required', 'err'); return; }
    let attachment_path = null;
    const f = document.getElementById('q-file').files[0];
    if (f) attachment_path = await U.uploadFile(f, 'quotes', rfqId);
    const { error } = await sb.from('quotes').insert({
      rfq_id: rfqId, supplier, amount, currency: document.getElementById('q-cur').value,
      delivery_time: document.getElementById('q-del').value,
      validity: document.getElementById('q-val').value,
      notes: document.getElementById('q-notes').value,
      attachment_path
    });
    if (error) { U.toast('Failed: ' + error.message, 'err'); return; }
    const { data: rfq } = await sb.from('rfqs').select('pr_id').eq('id', rfqId).single();
    if (rfq?.pr_id) await sb.from('purchase_requests').update({ status: 'Quotes Received' }).eq('id', rfq.pr_id);
    U.toast('Quote saved', 'ok'); U.closeModal(); App.renderPage();
  },

  async award(rfqId, quoteId, supplier, prId) {
    await sb.from('rfqs').update({ selected_quote_id: quoteId, selected_supplier: supplier }).eq('id', rfqId);
    U.toast('Quote awarded to ' + supplier, 'ok'); U.closeModal(); App.renderPage();
  },

  openAIQuote(rfqId) {
    window._aiQuoteData = null;
    U.modal(`
    <div class="modal-hdr"><h3><span class="ai-badge">✦ AI</span> Import Quote from File</h3><button class="icon-btn" onclick="U.closeModal()">${U.iX}</button></div>
    <div class="modal-body">
      <div class="info-box">Upload the supplier's quotation. AI will extract prices and terms automatically.</div>
      <div class="form-group"><label>Supplier *</label>
        <select id="aiq-sup"><option value="">Select</option>${(window._vendors || []).map(v => `<option>${v.name}</option>`).join('')}<option value="__other">Other</option></select>
      </div>
      <div class="form-group" id="aiq-other-wrap" style="display:none"><label>Supplier Name</label><input type="text" id="aiq-sup2"></div>
      <div class="form-group"><label>Quote File *</label>
        <label class="upload-zone" for="aiq-file">${U.iUp}<p>Upload Excel or Word quote</p></label>
        <input type="file" id="aiq-file" accept=".xlsx,.xls,.docx,.doc,.pdf,.txt" style="display:none" onchange="RFQ._previewAIQuote(this,'${rfqId}')">
      </div>
      <div id="aiq-preview"></div>
    </div>
    <div class="modal-ftr"><button class="btn" onclick="U.closeModal()">Cancel</button><button class="btn btn-primary" id="aiq-btn" style="display:none" onclick="RFQ._saveAIQuote('${rfqId}')">Save</button></div>`);
    document.getElementById('aiq-sup').addEventListener('change', function() {
      document.getElementById('aiq-other-wrap').style.display = this.value === '__other' ? 'block' : 'none';
    });
  },

  async _previewAIQuote(input, rfqId) {
    const file = input.files[0]; if (!file) return;
    const prev = document.getElementById('aiq-preview');
    prev.innerHTML = '<div class="loading" style="padding:16px"><div class="spinner"></div> AI reading quote...</div>';
    const items = await U.readFileAI(file, 'quote');
    if (!items?.length) { prev.innerHTML = '<div class="warn-box">Could not extract. Try manual entry.</div>'; return; }
    window._aiQuoteData = items;
    const total = items.reduce((s, i) => s + ((i.unit_price || 0) * (i.qty || 1)), 0);
    prev.innerHTML = `
    <div class="ok-box">✦ ${items.length} lines extracted — Total ≈ ${items[0]?.currency || 'USD'} ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
    <div style="overflow-x:auto;margin-top:8px">
    <table class="li-table"><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Currency</th><th>Delivery</th></tr></thead>
    <tbody>${items.map((it, i) => `<tr>
      <td>${it.item_no || i + 1}</td><td>${it.description}</td><td>${it.qty || '—'}</td>
      <td><input type="number" value="${it.unit_price || 0}" style="width:90px" onchange="window._aiQuoteData[${i}].unit_price=+this.value"></td>
      <td><select onchange="window._aiQuoteData[${i}].currency=this.value">${CURRENCIES.map(c => `<option ${c === (it.currency || 'USD') ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
      <td>${it.delivery_time || '—'}</td>
    </tr>`).join('')}</tbody></table></div>`;
    document.getElementById('aiq-btn').style.display = 'inline-flex';
  },

  async _saveAIQuote(rfqId) {
    const items = window._aiQuoteData;
    if (!items?.length) return;
    let supplier = document.getElementById('aiq-sup').value;
    if (supplier === '__other') supplier = document.getElementById('aiq-sup2').value.trim();
    if (!supplier) { U.toast('Select supplier', 'err'); return; }
    const total = items.reduce((s, i) => s + ((i.unit_price || 0) * (i.qty || 1)), 0);
    const { error } = await sb.from('quotes').insert({
      rfq_id: rfqId, supplier, amount: total, currency: items[0]?.currency || 'USD',
      delivery_time: items[0]?.delivery_time || null,
      validity: items[0]?.validity || null,
      notes: 'AI-extracted from quote file'
    });
    if (error) { U.toast('Failed: ' + error.message, 'err'); return; }
    const { data: rfq } = await sb.from('rfqs').select('pr_id').eq('id', rfqId).single();
    if (rfq?.pr_id) await sb.from('purchase_requests').update({ status: 'Quotes Received' }).eq('id', rfq.pr_id);
    U.toast('AI quote imported', 'ok'); U.closeModal(); App.renderPage();
  }
};
