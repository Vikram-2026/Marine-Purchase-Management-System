// js/dn.js
const DN = {
  async render(el) {
    const { data: dns } = await sb.from('delivery_notes').select('*,purchase_orders(ref)').order('created_at', { ascending: false });
    el.innerHTML = `
    <div class="page-hdr"><h2>Delivery Notes (DN Onboard)</h2><button class="btn btn-primary" onclick="DN.openNew()">+ Record DN</button></div>
    <div class="tcard"><table>
      <thead><tr><th>DN Ref</th><th>PO Ref</th><th>Vessel</th><th>Items</th><th>Received By</th><th>Date</th><th>Condition</th><th>Status</th></tr></thead>
      <tbody>${(dns || []).map(dn => `<tr>
        <td class="cell-p">${dn.ref}</td>
        <td class="cell-m">${dn.purchase_orders?.ref || '—'}</td>
        <td class="cell-m">${U.vname(dn.vessel_id)}</td>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${dn.items_description || '—'}</td>
        <td>${dn.received_by || '—'}</td>
        <td class="cell-m">${U.fmt(dn.dn_date)}</td>
        <td>${U.badge(dn.condition)}</td>
        <td>${U.badge(dn.status)}</td>
      </tr>`).join('') || '<tr><td colspan="8" class="empty-row">No DNs recorded yet.</td></tr>'}
      </tbody>
    </table></div>`;
  },

  async openNew() {
    const { data: pos } = await sb.from('purchase_orders').select('*,purchase_requests(item,vessel_id)').neq('status', 'Cancelled');
    const { data: ed } = await sb.from('delivery_notes').select('po_id');
    const used = new Set((ed || []).map(d => d.po_id));
    const eligible = (pos || []).filter(p => !used.has(p.id));
    if (!eligible.length) { U.toast('No POs pending delivery.', 'err'); return; }
    U.modal(`
    <div class="modal-hdr"><h3>Record Delivery Note (DN Onboard)</h3><button class="icon-btn" onclick="U.closeModal()">${U.iX}</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Select PO *</label>
        <select id="dn-po">${eligible.map(po => `<option value="${po.id}">${po.ref} — ${po.purchase_requests?.item || ''} (${po.supplier})</option>`).join('')}</select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Supplier DN Ref / No.</label><input type="text" id="dn-ref" placeholder="Supplier's delivery note no."></div>
        <div class="form-group"><label>Date Received Onboard</label><input type="date" id="dn-date" value="${U.today()}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Received By (onboard)</label><input type="text" id="dn-rcv" value="Chief Officer"></div>
        <div class="form-group"><label>Condition on Receipt</label><select id="dn-cond"><option>Good</option><option>Partial</option><option>Damaged</option></select></div>
      </div>
      <div class="form-group"><label>Items Description</label><textarea id="dn-items" placeholder="Confirm what was received..."></textarea></div>
      <div class="form-group"><label>Remarks / Discrepancies</label><textarea id="dn-rem" placeholder="Short delivery, damage notes, wrong items..."></textarea></div>
      <div class="form-group"><label>Attach DN / Photo</label><input type="file" id="dn-file" accept=".pdf,.xlsx,.xls,.docx,.jpg,.jpeg,.png"></div>
    </div>
    <div class="modal-ftr"><button class="btn" onclick="U.closeModal()">Cancel</button><button class="btn btn-primary" onclick="DN.save()">Confirm DN</button></div>`);
  },

  async save() {
    const poId = document.getElementById('dn-po').value;
    const { data: po } = await sb.from('purchase_orders').select('*,purchase_requests(id,vessel_id,item)').eq('id', poId).single();
    let attachment_path = null;
    const f = document.getElementById('dn-file').files[0];
    if (f) attachment_path = await U.uploadFile(f, 'dns', poId);
    const dnRef = document.getElementById('dn-ref').value || await U.nextRef('delivery_notes', 'DN');
    const { error } = await sb.from('delivery_notes').insert({
      ref: dnRef, po_id: poId, pr_id: po.purchase_requests?.id || null,
      vessel_id: po.purchase_requests?.vessel_id || null,
      received_by: document.getElementById('dn-rcv').value,
      dn_date: document.getElementById('dn-date').value,
      condition: document.getElementById('dn-cond').value,
      items_description: document.getElementById('dn-items').value || po.purchase_requests?.item || '',
      remarks: document.getElementById('dn-rem').value,
      attachment_path
    });
    if (error) { U.toast('Failed: ' + error.message, 'err'); return; }
    await sb.from('purchase_orders').update({ status: 'Delivered' }).eq('id', poId);
    if (po.purchase_requests?.id) await sb.from('purchase_requests').update({ status: 'Delivered' }).eq('id', po.purchase_requests.id);
    U.toast('DN confirmed', 'ok'); U.closeModal(); App.renderPage();
  }
};
