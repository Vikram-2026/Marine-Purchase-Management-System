// js/invoice.js
const Invoice = {
  async render(el) {
    const invs = U.readLocal('invoices', []);
    el.innerHTML = `
    <div class="page-hdr"><h2>Invoices</h2><button class="btn btn-primary" onclick="Invoice.openNew()">+ Log Invoice</button></div>
    <div class="tcard"><table>
      <thead><tr><th>Invoice Ref</th><th>PO Ref</th><th>Supplier</th><th>Amount</th><th>USD Equiv</th><th>Date</th><th>Due</th><th>Status</th><th></th></tr></thead>
      <tbody>${(invs || []).map(inv => `<tr>
        <td class="cell-p">${inv.ref}</td>
        <td class="cell-m">${inv.purchase_orders?.ref || '—'}</td>
        <td>${inv.supplier || '—'}</td>
        <td style="font-weight:500">${inv.currency} ${inv.amount?.toLocaleString()}</td>
        <td class="cell-m">${U.fmtUSD(inv.amount, inv.currency)}</td>
        <td class="cell-m">${U.fmt(inv.invoice_date)}</td>
        <td class="cell-m">${U.fmt(inv.due_date)}</td>
        <td>${U.badge(inv.status)}</td>
        <td><button class="icon-btn" onclick="Invoice.updateStatus('${inv.id}','${inv.status}')">${U.iEdit}</button></td>
      </tr>`).join('') || '<tr><td colspan="9" class="empty-row">No invoices yet.</td></tr>'}
      </tbody>
    </table></div>`;
  },

  async openNew() {
    const pos = U.readLocal('purchase_orders', []);
    const ei = U.readLocal('invoices', []);
    const used = new Set((ei || []).map(i => i.po_id));
    const eligible = (pos || []).filter(p => !used.has(p.id));
    if (!eligible.length) { U.toast('No POs without invoice yet.', 'err'); return; }
    U.modal(`
    <div class="modal-hdr"><h3>Log Invoice</h3><button class="icon-btn" onclick="U.closeModal()">${U.iX}</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Select PO *</label>
        <select id="inv-po">${eligible.map(po => `<option value="${po.id}" data-sup="${po.supplier}" data-amt="${po.amount}" data-cur="${po.currency}">${po.ref} — ${po.supplier} ${po.currency} ${po.amount?.toLocaleString()}</option>`).join('')}</select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Supplier Invoice No. *</label><input type="text" id="inv-ref" placeholder="As on supplier invoice"></div>
        <div class="form-group"><label>Invoice Date</label><input type="date" id="inv-date" value="${U.today()}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Amount</label><input type="number" id="inv-amt" placeholder="Verify against PO"></div>
        <div class="form-group"><label>Due Date</label><input type="date" id="inv-due"></div>
      </div>
      <div class="form-group"><label>Status</label><select id="inv-st"><option>Received</option><option>Verified</option><option>Approved</option><option>Paid</option></select></div>
      <div class="form-group"><label>Attach Invoice</label><input type="file" id="inv-file" accept=".pdf,.xlsx,.xls,.docx,.doc,.jpg,.png"></div>
    </div>
    <div class="modal-ftr"><button class="btn" onclick="U.closeModal()">Cancel</button><button class="btn btn-primary" onclick="Invoice.save()">Save</button></div>`);
  },

  async save() {
    const poId = document.getElementById('inv-po').value;
    const ref = document.getElementById('inv-ref').value.trim();
    if (!ref) { U.toast('Enter invoice reference number', 'err'); return; }
    const po = U.readLocal('purchase_orders', []).find(x => x.id === poId);
    U.addLocal('invoices', {
      ref, po_id: poId, pr_id: po?.pr_id || null,
      supplier: po?.supplier || '', currency: po?.currency || 'USD',
      amount: parseFloat(document.getElementById('inv-amt').value) || po?.amount || 0,
      invoice_date: document.getElementById('inv-date').value,
      due_date: document.getElementById('inv-due').value || null,
      status: document.getElementById('inv-st').value,
      attachment_path: null
    });
    U.toast('Invoice logged', 'ok'); U.closeModal(); App.renderPage();
  },

  updateStatus(id, current) {
    U.modal(`
    <div class="modal-hdr"><h3>Update Invoice Status</h3><button class="icon-btn" onclick="U.closeModal()">${U.iX}</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Status</label>
        <select id="ni-s">${['Received','Verified','Approved','Paid','Overdue'].map(s => `<option ${s === current ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </div>
    </div>
    <div class="modal-ftr">
      <button class="btn" onclick="U.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="Invoice._doStatus('${id}')">Update</button>
    </div>`);
  },

  async _doStatus(id) {
    U.updateLocal('invoices', id, { status: document.getElementById('ni-s').value });
    U.toast('Status updated', 'ok'); U.closeModal(); App.renderPage();
  }
};
