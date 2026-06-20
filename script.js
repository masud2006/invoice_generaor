/* ═══════════════════════════════════════════
   VENTURE IT – INVOICE SYSTEM
   script.js – All Logic
═══════════════════════════════════════════ */

'use strict';

/* ── State ── */
const state = {
  invoices: [],
  sessionCount: 0,
  totalBilled: 0,
  currency: '৳',
  itemCounter: 0
};

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  setDate();
  loadFromStorage();
  updateStats();
  renderInvoiceList();
  setDefaultInvoiceDate();
  generateInvoiceNumber();
  addItemRow();   // start with one row
});

/* ── Date Helpers ── */
function setDate() {
  const el = document.getElementById('dash-date');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('en-BD', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });
}

function setDefaultInvoiceDate() {
  const dateInput = document.getElementById('inv-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
}

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ── Invoice Number ── */
function generateInvoiceNumber() {
  const el = document.getElementById('inv-number');
  if (!el || el.value) return;
  const count = state.invoices.length + 1;
  const year = new Date().getFullYear();
  el.value = `VIT-${year}-${String(count).padStart(3, '0')}`;
}

/* ── View Navigation ── */
function openInvoiceForm() {
  document.getElementById('view-dashboard').classList.remove('active');
  document.getElementById('view-form').classList.add('active');
  window.scrollTo(0, 0);
}

function goToDashboard() {
  document.getElementById('view-form').classList.remove('active');
  document.getElementById('view-dashboard').classList.add('active');
  window.scrollTo(0, 0);
}

/* ── Item Rows ── */
function addItemRow() {
  state.itemCounter++;
  const id = state.itemCounter;
  const tbody = document.getElementById('items-tbody');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.dataset.id = id;
  tr.innerHTML = `
    <td>
      <input type="text" class="item-desc" placeholder="Service description" />
    </td>
    <td>
      <input type="number" class="item-qty" placeholder="1" min="0" step="any" style="text-align:right;width:64px" oninput="calcRow(${id})" />
    </td>
    <td>
      <input type="number" class="item-price" placeholder="0.00" min="0" step="any" style="text-align:right;width:100px" oninput="calcRow(${id})" />
    </td>
    <td class="item-total-cell" id="row-total-${id}">—</td>
    <td>
      <button class="del-row-btn" onclick="removeRow(${id})" title="Remove row">×</button>
    </td>
  `;
  tbody.appendChild(tr);
}

function removeRow(id) {
  const tr = document.querySelector(`#items-tbody tr[data-id="${id}"]`);
  if (tr) {
    tr.remove();
    recalculate();
  }
}

function calcRow(id) {
  const tr = document.querySelector(`#items-tbody tr[data-id="${id}"]`);
  if (!tr) return;
  const qty   = parseFloat(tr.querySelector('.item-qty')?.value) || 0;
  const price = parseFloat(tr.querySelector('.item-price')?.value) || 0;
  const total = qty * price;
  const cell  = document.getElementById(`row-total-${id}`);
  if (cell) cell.textContent = total > 0 ? fmt(total) : '—';
  recalculate();
}

/* ── Currency ── */
function getCurrency() {
  const sel = document.getElementById('inv-currency');
  return sel ? sel.value : '৳';
}

function fmt(n) {
  const cur = getCurrency();
  return cur + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Recalculate ── */
function recalculate() {
  const rows = document.querySelectorAll('#items-tbody tr');
  let subtotal = 0;

  rows.forEach(tr => {
    const qty   = parseFloat(tr.querySelector('.item-qty')?.value) || 0;
    const price = parseFloat(tr.querySelector('.item-price')?.value) || 0;
    subtotal += qty * price;
  });

  const received = parseFloat(document.getElementById('fin-received')?.value) || 0;
  const due      = Math.max(0, subtotal - received);

  const subEl = document.getElementById('fin-subtotal');
  const dueEl = document.getElementById('fin-due');
  if (subEl) subEl.textContent = fmt(subtotal);
  if (dueEl) dueEl.textContent = fmt(due);
}

/* ── Collect Form Data ── */
function collectData() {
  const rows = document.querySelectorAll('#items-tbody tr');
  const items = [];

  rows.forEach(tr => {
    const desc  = tr.querySelector('.item-desc')?.value.trim() || '';
    const qty   = parseFloat(tr.querySelector('.item-qty')?.value) || 0;
    const price = parseFloat(tr.querySelector('.item-price')?.value) || 0;
    const total = qty * price;
    if (desc || qty || price) {
      items.push({ desc, qty, price, total });
    }
  });

  const subtotal  = items.reduce((s, i) => s + i.total, 0);
  const received  = parseFloat(document.getElementById('fin-received')?.value) || 0;
  const due       = Math.max(0, subtotal - received);

  return {
    number:    document.getElementById('inv-number')?.value.trim() || '',
    date:      document.getElementById('inv-date')?.value || '',
    dueDate:   document.getElementById('inv-due')?.value || '',
    currency:  getCurrency(),
    client: {
      name:    document.getElementById('client-name')?.value.trim() || '',
      company: document.getElementById('client-company')?.value.trim() || '',
      email:   document.getElementById('client-email')?.value.trim() || '',
      phone:   document.getElementById('client-phone')?.value.trim() || '',
      address: document.getElementById('client-address')?.value.trim() || ''
    },
    items,
    subtotal,
    received,
    due,
    notes: document.getElementById('inv-notes')?.value.trim() || ''
  };
}

/* ── Render Preview ── */
function renderPreview(data) {
  const cur = data.currency || '৳';

  const fmtN = n => cur + Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  setText('prev-number',  data.number || '—');
  setText('prev-date',    formatDate(data.date));
  setText('prev-duedate', data.dueDate ? formatDate(data.dueDate) : '—');

  setText('prev-client-name',    data.client.name    || '—');
  setText('prev-client-company', data.client.company || '');
  setText('prev-client-email',   data.client.email   || '');
  setText('prev-client-phone',   data.client.phone   || '');
  setText('prev-client-address', data.client.address || '');

  // Items
  const tbody = document.getElementById('prev-items-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    if (data.items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px 40px;color:#888;font-size:0.85rem;">No items added</td></tr>';
    } else {
      data.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escHtml(item.desc)}</td>
          <td>${item.qty}</td>
          <td>${fmtN(item.price)}</td>
          <td>${fmtN(item.total)}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  // Financials
  setText('prev-subtotal', fmtN(data.subtotal));
  setText('prev-received', fmtN(data.received));
  setText('prev-due',      fmtN(data.due));

  // Notes
  const notesSection = document.getElementById('inv-notes-section');
  const notesText    = document.getElementById('prev-notes');
  if (notesSection && notesText) {
    if (data.notes) {
      notesSection.style.display = 'block';
      notesText.textContent = data.notes;
    } else {
      notesSection.style.display = 'none';
    }
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Preview Invoice ── */
function previewInvoice() {
  const data = collectData();
  renderPreview(data);
  document.getElementById('modal-preview').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePreview(e) {
  if (e.target === e.currentTarget) closePreviewDirect();
}

function closePreviewDirect() {
  document.getElementById('modal-preview').classList.remove('open');
  document.body.style.overflow = '';
}

/* ── Print Invoice ── */
function printInvoice() {
  const data = collectData();
  renderPreview(data);

  // Ensure modal is visually ready but use print CSS
  const modal = document.getElementById('modal-preview');
  modal.classList.add('open');

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }, 500);
  }, 150);
}

/* ── Download PDF ── */
async function downloadPDF() {
  const data = collectData();
  renderPreview(data);

  // Show loading feedback — works whether called from modal or form buttons
  const btns = document.querySelectorAll('.modal-action-btn, .action-btn.secondary');
  const origLabels = [];
  btns.forEach((b, i) => { origLabels[i] = b.textContent; b.textContent = '⏳ Generating…'; b.disabled = true; });

  // A4 pixel width at 96 dpi — the single source of truth for capture width
  const A4_PX = 794;

  // ------------------------------------------------------------------
  // Build an off-screen wrapper that is ALWAYS A4_PX wide, completely
  // outside the viewport so mobile layout never clips or re-flows it.
  // ------------------------------------------------------------------
  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, {
    position:   'fixed',
    top:        '0',
    left:       '-9999px',       // off-screen, not off-DOM
    width:      A4_PX + 'px',
    minWidth:   A4_PX + 'px',
    maxWidth:   A4_PX + 'px',
    background: '#ffffff',
    zIndex:     '-1',
    overflow:   'visible',
    fontFamily: "'Inter', sans-serif"
  });

  // Clone the fully-rendered invoice node into the wrapper
  const invoiceEl = document.getElementById('invoice-preview');
  const clone = invoiceEl.cloneNode(true);
  Object.assign(clone.style, {
    width:    A4_PX + 'px',
    minWidth: A4_PX + 'px',
    maxWidth: A4_PX + 'px',
    transform: 'none',
    margin:    '0',
    padding:   '0',
    boxShadow: 'none',
    borderRadius: '0'
  });

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    // Let the browser fully lay out the cloned node at A4 width
    await new Promise(r => setTimeout(r, 250));

    const canvas = await html2canvas(clone, {
      scale:           2,           // 2× → ~192 dpi, crisp on all screens
      useCORS:         true,
      allowTaint:      true,
      backgroundColor: '#ffffff',
      logging:         false,
      imageTimeout:    8000,
      width:           A4_PX,
      windowWidth:     A4_PX,       // critical: tells h2c the "viewport" is A4
      scrollX:         0,
      scrollY:         0
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit:        'mm',
      format:      'a4',
      compress:    true
    });

    const pageW  = pdf.internal.pageSize.getWidth();   // 210 mm
    const pageH  = pdf.internal.pageSize.getHeight();  // 297 mm

    const canvasW = canvas.width;
    const canvasH = canvas.height;

    // mm per canvas-pixel
    const mmPerPx = pageW / canvasW;
    const totalMM = canvasH * mmPerPx;

    if (totalMM <= pageH) {
      // Fits on a single page
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, totalMM);
    } else {
      // Split into multiple A4 pages cleanly
      const pagePixelH = Math.round(pageH / mmPerPx); // canvas px that fit one page
      let yPx = 0;

      while (yPx < canvasH) {
        const sliceH = Math.min(pagePixelH, canvasH - yPx);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width  = canvasW;
        pageCanvas.height = sliceH;
        pageCanvas.getContext('2d').drawImage(
          canvas,
          0, yPx, canvasW, sliceH,
          0, 0,   canvasW, sliceH
        );

        const sliceMM = sliceH * mmPerPx;
        if (yPx > 0) pdf.addPage();
        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, sliceMM);

        yPx += sliceH;
      }
    }

    const filename = `VIT-Invoice-${data.number || 'draft'}-${data.client.name || 'client'}.pdf`
      .replace(/[^a-zA-Z0-9\-_.]/g, '_');
    pdf.save(filename);

    // Save to history
    saveInvoice(data);
    renderInvoiceList();
    updateStats();

  } catch (err) {
    console.error('PDF generation error:', err);
    alert('PDF generation failed. Try the Print option instead.');
  } finally {
    // Remove the off-screen clone
    if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    // Restore all button labels
    btns.forEach((b, i) => { b.textContent = origLabels[i]; b.disabled = false; });
  }
}

/* ── Save Invoice to LocalStorage ── */
function saveInvoice(data) {
  const invoice = {
    id:      Date.now(),
    number:  data.number,
    date:    data.date,
    client:  data.client.name,
    company: data.client.company,
    total:   data.subtotal,
    due:     data.due,
    currency: data.currency
  };

  // Avoid duplicate by number
  const exists = state.invoices.findIndex(i => i.number === invoice.number);
  if (exists > -1) {
    state.invoices[exists] = invoice;
  } else {
    state.invoices.unshift(invoice);
    state.sessionCount++;
    state.totalBilled += data.subtotal;
  }

  persistState();
}

/* ── Render Invoice List (Dashboard) ── */
function renderInvoiceList() {
  const list = document.getElementById('invoice-list');
  if (!list) return;

  if (state.invoices.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📄</div>
        <p>No invoices yet.<br/>Tap the button below to create your first one.</p>
      </div>`;
    return;
  }

  list.innerHTML = state.invoices.map(inv => `
    <div class="inv-list-card">
      <div class="inv-list-icon">📋</div>
      <div class="inv-list-info">
        <div class="inv-list-client">${escHtml(inv.client || 'Unnamed Client')}</div>
        <div class="inv-list-meta">${inv.number || '—'} &nbsp;·&nbsp; ${formatDate(inv.date)}</div>
      </div>
      <div class="inv-list-amount">${inv.currency || '৳'}${Number(inv.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      <div class="inv-list-actions">
        <button class="inv-list-btn" onclick="reopenInvoice(${inv.id})">Edit</button>
        <button class="inv-list-btn" onclick="deleteInvoice(${inv.id})">Del</button>
      </div>
    </div>
  `).join('');
}

/* ── Update Stats ── */
function updateStats() {
  setText('stat-total',   state.invoices.length);
  setText('stat-session', state.sessionCount);
  const cur = state.invoices.length > 0 ? (state.invoices[0].currency || '৳') : '৳';
  setText('stat-billed',  cur + Number(state.totalBilled).toLocaleString('en-US', { minimumFractionDigits: 0 }));
}

/* ── Reopen Invoice for Re-download ── */
function reopenInvoice(id) {
  alert('Open the invoice form and re-enter details. (Full re-edit coming in a future update.)');
}

/* ── Delete Invoice ── */
function deleteInvoice(id) {
  if (!confirm('Delete this invoice from history?')) return;
  const idx = state.invoices.findIndex(i => i.id === id);
  if (idx > -1) {
    state.totalBilled -= state.invoices[idx].total || 0;
    if (state.totalBilled < 0) state.totalBilled = 0;
    state.invoices.splice(idx, 1);
  }
  persistState();
  renderInvoiceList();
  updateStats();
}

/* ── LocalStorage Persistence ── */
function persistState() {
  try {
    localStorage.setItem('vit_invoices',     JSON.stringify(state.invoices));
    localStorage.setItem('vit_session',      String(state.sessionCount));
    localStorage.setItem('vit_total_billed', String(state.totalBilled));
  } catch (e) { /* storage may be unavailable */ }
}

function loadFromStorage() {
  try {
    const inv = localStorage.getItem('vit_invoices');
    if (inv) state.invoices = JSON.parse(inv);

    const session = localStorage.getItem('vit_session');
    if (session) state.sessionCount = parseInt(session, 10) || 0;

    const billed = localStorage.getItem('vit_total_billed');
    if (billed) state.totalBilled = parseFloat(billed) || 0;
  } catch (e) { /* ignore */ }
}

/* ── Currency change listener ── */
document.getElementById('inv-currency')?.addEventListener('change', () => {
  recalculate();
});

/* ── Keyboard: Escape closes modal ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePreviewDirect();
});
