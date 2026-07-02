// js/utils.js — shared helpers used by all modules

const U = {
  localKey(table) { return `mp_${table}`; },
  readLocal(table, fallback = []) {
    try {
      const raw = localStorage.getItem(U.localKey(table));
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  writeLocal(table, data) {
    localStorage.setItem(U.localKey(table), JSON.stringify(data));
    return data;
  },
  addLocal(table, payload) {
    const rows = U.readLocal(table, []);
    const item = {
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
      created_at: new Date().toISOString(),
      ...payload
    };
    rows.push(item);
    U.writeLocal(table, rows);
    return item;
  },
  updateLocal(table, id, payload) {
    const rows = U.readLocal(table, []);
    const idx = rows.findIndex(r => r.id === id);
    if (idx < 0) return null;
    rows[idx] = { ...rows[idx], ...payload };
    U.writeLocal(table, rows);
    return rows[idx];
  },
  deleteLocal(table, id) {
    const rows = U.readLocal(table, []).filter(r => r.id !== id);
    U.writeLocal(table, rows);
    return rows;
  },
  ensureSeedData() {
    const users = U.readLocal('users', []);
    if (!users.length) {
      U.writeLocal('users', [{
        id: 'local-admin',
        full_name: 'Admin User',
        username: 'admin',
        password_hash: 'admin123',
        role: 'Admin',
        status: 'Active',
        created_at: new Date().toISOString()
      }]);
    }
    const vessels = U.readLocal('vessels', []);
    if (!vessels.length) {
      U.writeLocal('vessels', [{
        id: 'local-vessel-1',
        name: 'MV Ocean Star',
        imo: '1234567',
        registration_no: 'SG-001',
        flag: 'Singapore',
        status: 'Active',
        notes: 'Demo vessel',
        active: true,
        created_at: new Date().toISOString()
      }]);
    }
    const vendors = U.readLocal('vendors', []);
    if (!vendors.length) {
      U.writeLocal('vendors', [{
        id: 'local-vendor-1',
        name: 'Marine Parts Ltd',
        country: 'Singapore',
        contact_person: 'Ravi',
        email: 'sales@marineparts.com',
        phone: '+65 9000 0000',
        port: 'Singapore',
        currency: 'USD',
        payment_terms: 'Net 30',
        categories: ['Spare Parts', 'Engine Stores'],
        rating: 4,
        notes: 'Demo vendor',
        document_url: '',
        document_notes: '',
        active: true,
        created_at: new Date().toISOString()
      }]);
    }
  },

  // ── FORMAT ──
  fmt(d) {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  },
  today() { return new Date().toISOString().slice(0, 10); },
  badge(t) { return `<span class="badge ${BADGE_MAP[t] || 'b-gray'}">${t || '—'}</span>`; },
  vname(id) { const v = (window.App?.vessels || []).find(x => x.id === id); return v ? v.name : '—'; },
  stars(n) { n = n || 3; return '★'.repeat(n) + '☆'.repeat(5 - n); },

  // ── CURRENCY ──
  fxRates: { USD:1 },
  toUSD(amount, from) {
    if (!amount) return 0;
    return amount / (U.fxRates[from] || 1);
  },
  fmtUSD(amount, from) {
    const usd = U.toUSD(amount, from);
    return '$' + usd.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  async loadFX() {
    try {
      const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const d = await r.json();
      U.fxRates = d.rates || { USD:1 };
    } catch {
      U.fxRates = { USD:1, EUR:0.92, SGD:1.35, GBP:0.79, INR:83.5, AED:3.67, NOK:10.8, DKK:6.9 };
    }
    const show = ['EUR','SGD','GBP','INR','AED'];
    const bar = document.getElementById('fx-bar');
    if (bar) bar.innerHTML = '<span>USD =</span> ' +
      show.map(c => `<span class="fx-rate"><span>${c} </span><strong>${U.fxRates[c]?.toFixed(2)}</strong></span>`).join(' · ');
  },

  // ── TOAST ──
  toast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(U._toastTimer);
    U._toastTimer = setTimeout(() => t.className = 'toast', 3000);
  },

  // ── MODAL ──
  modal(html, large = false) {
    U.closeModal();
    const ov = document.createElement('div');
    ov.className = 'modal-ov'; ov.id = 'modal-ov';
    ov.innerHTML = `<div class="modal${large ? ' modal-lg' : ''}">${html}</div>`;
    ov.addEventListener('click', e => { if (e.target === ov) U.closeModal(); });
    document.body.appendChild(ov);
  },
  closeModal() { document.getElementById('modal-ov')?.remove(); },

  // ── DB HELPERS ──
  async nextRef(table, prefix) {
    const rows = U.readLocal(table, []);
    return `${prefix}-${new Date().getFullYear()}-${String((rows.length || 0) + 1).padStart(3, '0')}`;
  },

  // ── FILE UPLOAD ──
  async uploadFile(file, folder, id) {
    if (!sb?.storage) return null;
    const path = `${folder}/${id}/${Date.now()}_${file.name}`;
    const { error } = await sb.storage.from('purchase-docs').upload(path, file);
    if (!error) return path;
    console.error('Upload error:', error);
    return null;
  },

  async fileUrl(path) {
    if (!sb?.storage) return null;
    const { data } = await sb.storage.from('purchase-docs').createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  },

  _fallbackParseText(content, mode) {
    if (mode !== 'pr') return [];
    const text = (content || '').replace(/\s+/g, ' ').trim();
    if (!text) return [];
    const lines = text
      .split(/\r?\n|(?<=[.;:])\s+/)
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .filter(line => line.length > 3 && !/purchase request|purchase requisition|date|department|requested by|raised by|approval route|remarks/i.test(line));
    if (!lines.length) {
      return [{
        item_no: 1,
        description: text.slice(0, 160),
        part_no: null,
        qty: 1,
        unit: 'pcs',
        category: 'Spare Parts',
        remarks: null
      }];
    }
    return lines.slice(0, 8).map((line, i) => ({
      item_no: i + 1,
      description: line.replace(/^\d+[.)]\s*/, '').replace(/^[-*]\s*/, ''),
      part_no: null,
      qty: /\bqty\b|\bquantity\b|\bqty:\b/i.test(line) ? 1 : 1,
      unit: 'pcs',
      category: 'Spare Parts',
      remarks: null
    }));
  },

  async _extractWordText(file) {
    const name = (file?.name || '').toLowerCase();
    if (!name.endsWith('.docx')) return '';
    try {
      const buffer = await file.arrayBuffer();
      if (window.mammoth && typeof window.mammoth.extractRawText === 'function') {
        const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
        const text = (result && result.value ? result.value : '').trim();
        if (text) return text;
      }
      if (window.JSZip) {
        const zip = await window.JSZip.loadAsync(buffer);
        const xmlEntry = zip.file('word/document.xml');
        if (xmlEntry) {
          const xml = await xmlEntry.async('text');
          const parser = new DOMParser();
          const doc = parser.parseFromString(xml, 'application/xml');
          const texts = Array.from(doc.getElementsByTagName('w:t')).map(t => t.textContent || '');
          const content = texts.join(' ').replace(/\s+/g, ' ').trim();
          if (content) return content;
          const bodyText = (doc.documentElement?.textContent || '').replace(/\s+/g, ' ').trim();
          if (bodyText) return bodyText;
        }
      }
    } catch (err) {
      console.warn('Word parse failed', err);
    }
    return '';
  },

  // ── AI FILE READER ──
  async readFileAI(file, mode) {
    return new Promise(resolve => {
      const name = file.name.toLowerCase();
      const readAndSend = async (content) => {
        const prompt = mode === 'pr'
          ? `Extract all line items from this purchase requisition. Return ONLY a JSON array, no markdown. Each object: {item_no, description, part_no, qty, unit, category, remarks}. Categories: ${CATEGORIES.join(', ')}.\n\n${content.slice(0, 4000)}`
          : `Extract quotation line items from this supplier quote. Return ONLY a JSON array, no markdown. Each object: {item_no, description, qty, unit, unit_price, currency, delivery_time, validity, notes}.\n\n${content.slice(0, 4000)}`;
        const fallback = U._fallbackParseText(content, mode);
        try {
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
          });
          const data = await resp.json();
          const text = (data.content?.[0]?.text || '[]').replace(/```json|```/g, '').trim();
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed) && parsed.length) {
            resolve(parsed);
          } else {
            resolve(fallback.length ? fallback : null);
          }
        } catch {
          resolve(fallback.length ? fallback : null);
        }
      };

      const handleFile = async () => {
        let content = '';
        try {
          if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            content = XLSX.utils.sheet_to_csv(ws);
          } else if (name.endsWith('.docx')) {
            content = await U._extractWordText(file);
            if (!content) content = 'Could not parse Word file';
          } else {
            content = await file.text();
          }
        } catch {
          content = 'Could not read file';
        }
        await readAndSend(content);
      };

      handleFile();
    });
  },

  // ── SVG ICONS ──
  iEye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  iEdit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  iTrash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  iX: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  iPlus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  iUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>`,
  iDl: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  iCheck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
};
