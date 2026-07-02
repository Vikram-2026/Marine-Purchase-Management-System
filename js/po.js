// js/po.js — Purchase Orders
const PO = {
  async render(el) {
    const pos = U.readLocal('purchase_orders', []);
    el.innerHTML = `
    <div class="page-hdr"><h2>Purchase Orders</h2><button class="btn btn-primary" onclick="PO.openNew()">+ Raise PO</button></div>
    <div class="tcard"><table>
      <thead><tr><th>PO Ref</th><th>PR Ref</th><th>Supplier</th><th>Amount</th><th>USD Equiv</th><th>PO Date</th><th>Delivery</th><th>Status</th></tr></thead>
      <tbody>${(pos || []).map(po => `<tr>
        <td class="cell-p">${po.ref}</td>
        <td class="cell-m">${po.purchase_requests?.ref || '—'}</td>
        <td>${po.supplier}</td>
        <td style="font-weight:500">${po.currency} ${po.amount?.toLocaleString()}</td>
        <td class="cell-m">${U.fmtUSD(po.amount, po.currency)}</td>
        <td class="cell-m">${U.fmt(po.po_date)}</td>
        <td class="cell-m">${U.fmt(po.delivery_date)}</td>
        <td>${U.badge(po.status)}</td>
      </tr>`).join('') || '<tr><td colspan="8" class="empty-row">No POs yet.</td></tr>'}
      </tbody>
    </table></div>`;
  },

  async openNew() {
    const rfqs = U.readLocal('rfqs', []).filter(r => r.selected_quote_id);
    const ep = U.readLocal('purchase_orders', []);
    const used = new Set((ep || []).map(p => p.rfq_id));
    const eligible = (rfqs || []).filter(r => !used.has(r.id));
    if (!eligible.length) { U.toast('No awarded quotes available. Award a quote in RFQ first.', 'err'); return; }
    U.modal(`
    <div class="modal-hdr"><h3>Raise Purchase Order</h3><button class="icon-btn" onclick="U.closeModal()">${U.iX}</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Select Awarded RFQ *</label>
        <select id="po-rfq" onchange="PO._fill(this.value)">${eligible.map(r => `<option value="${r.id}">${r.ref} — ${r.purchase_requests?.item} | ${r.selected_supplier}</option>`).join('')}</select>
      </div>
      <div id="po-fill" class="info-box" style="font-size:12px">Select RFQ to auto-fill</div>
      <div class="form-row">
        <div class="form-group"><label>PO Date</label><input type="date" id="po-date" value="${U.today()}"></div>
        <div class="form-group"><label>Expected Delivery</label><input type="date" id="po-del"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Payment Terms</label><select id="po-pay">${PAYMENT_TERMS.map(t => `<option>${t}</option>`).join('')}</select></div>
        <div class="form-group"><label>Incoterms</label><select id="po-inc">${INCOTERMS.map(t => `<option>${t}</option>`).join('')}</select></div>
      </div>
      <div class="form-group"><label>Remarks</label><textarea id="po-rem"></textarea></div>
      <div class="form-group"><label>Attach PO Document</label><input type="file" id="po-file" accept=".pdf,.xlsx,.xls,.docx,.doc"></div>
    </div>
    <div class="modal-ftr"><button class="btn" onclick="U.closeModal()">Cancel</button><button class="btn btn-primary" onclick="PO.save()">Raise PO</button></div>`);
    if (eligible[0]) PO._fill(eligible[0].id);
  },

  async _fill(rfqId) {
    const rfq = U.readLocal('rfqs', []).find(x => x.id === rfqId);
    const quotes = U.readLocal('quotes', []).filter(x => x.rfq_id === rfqId);
    const q = quotes.find(x => x.id === rfq.selected_quote_id);
    if (q) document.getElementById('po-fill').innerHTML =
      `<strong>${q.supplier}</strong> — ${q.currency} ${q.amount?.toLocaleString()} | ≈ ${U.fmtUSD(q.amount, q.currency)} | Delivery: ${q.delivery_time || '—'} | ${q.notes || ''}`;
  },

  async save() {
    const rfqId = document.getElementById('po-rfq').value;
    const rfq = U.readLocal('rfqs', []).find(x => x.id === rfqId);
    const quotes = U.readLocal('quotes', []).filter(x => x.rfq_id === rfqId);
    const q = quotes.find(x => x.id === rfq.selected_quote_id);
    if (!q) { U.toast('No awarded quote found', 'err'); return; }
    const ref = `PO-${new Date().getFullYear()}-${String((U.readLocal('purchase_orders', []).length || 0) + 1).padStart(3, '0')}`;
    U.addLocal('purchase_orders', {
      ref, pr_id: rfq.pr_id, rfq_id: rfqId,
      supplier: q.supplier, amount: q.amount, currency: q.currency,
      po_date: document.getElementById('po-date').value,
      delivery_date: document.getElementById('po-del').value || null,
      payment_terms: document.getElementById('po-pay').value,
      incoterms: document.getElementById('po-inc').value,
      attachment_path: null,
      status: 'Open'
    });
    U.updateLocal('purchase_requests', rfq.pr_id, { status: 'PO Raised' });
    U.toast('PO raised', 'ok'); U.closeModal(); App.renderPage();
  }
};
