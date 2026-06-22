/* ═══════════════════════════════════════════
   UNIVERSAL INVOICE GENERATOR – script.js
   All Logic – Multi-step, Uploads, PDF, Storage
═══════════════════════════════════════════ */

'use strict';

/* ── State ── */
const state = {
    invoices: [],
    sessionCount: 0,
    totalBilled: 0,
    currency: '৳',
    itemCounter: 0,
    currentStep: 1,
    companyLogo: null,      // data URL
    signatureImage: null,   // data URL
};

/* ── DOM refs ── */
const $ = id => document.getElementById(id);
const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
    setDate();
    loadFromStorage();
    updateStats();
    renderInvoiceList();
    setDefaultInvoiceDate();
    generateInvoiceNumber();
    addItemRow(); // start with one row
    setupFileUploads();
    setupCurrencyListener();
});

/* ── Date Helpers ── */
function setDate() {
    const el = $('dash-date');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleDateString('en-BD', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
}

function setDefaultInvoiceDate() {
    const dateInput = $('inv-date');
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
    const el = $('inv-number');
    if (!el || el.value) return;
    const count = state.invoices.length + 1;
    const year = new Date().getFullYear();
    el.value = `INV-${year}-${String(count).padStart(3, '0')}`;
}

/* ── View Navigation ── */
function openInvoiceForm() {
    // Reset to step 1 when opening
    goStep(1);
    document.getElementById('view-dashboard').classList.remove('active');
    document.getElementById('view-form').classList.add('active');
    window.scrollTo(0, 0);
}

function goToDashboard() {
    document.getElementById('view-form').classList.remove('active');
    document.getElementById('view-dashboard').classList.add('active');
    window.scrollTo(0, 0);
}

/* ── Step Navigation ── */
function goStep(step) {
    const panels = qsa('.step-panel');
    const dots = qsa('.step-dot');
    const label = $('step-label');

    // Validate current step before moving forward? We'll allow free movement back/forth.
    // But if moving forward, we could check required fields (optional).
    // For simplicity, we allow all.

    panels.forEach(p => p.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));

    const targetPanel = qs(`.step-panel[data-step="${step}"]`);
    if (targetPanel) targetPanel.classList.add('active');

    const targetDot = qs(`.step-dot[data-step="${step}"]`);
    if (targetDot) targetDot.classList.add('active');

    // Update label
    const labels = ['', 'Company', 'Client', 'Services', 'Signature'];
    label.textContent = labels[step] || '';

    state.currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── File Uploads ── */
function setupFileUploads() {
    // Logo
    const logoInput = $('company-logo-input');
    if (logoInput) {
        logoInput.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    state.companyLogo = ev.target.result;
                    const preview = $('logo-preview');
                    const img = $('logo-preview-img');
                    const placeholder = $('logo-placeholder');
                    if (preview && img && placeholder) {
                        img.src = ev.target.result;
                        preview.style.display = 'block';
                        placeholder.style.display = 'none';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Signature
    const sigInput = $('signature-input');
    if (sigInput) {
        sigInput.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    state.signatureImage = ev.target.result;
                    const preview = $('signature-preview');
                    const img = $('signature-preview-img');
                    const placeholder = $('signature-placeholder');
                    if (preview && img && placeholder) {
                        img.src = ev.target.result;
                        preview.style.display = 'block';
                        placeholder.style.display = 'none';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

function removeLogo() {
    state.companyLogo = null;
    const preview = $('logo-preview');
    const placeholder = $('logo-placeholder');
    const input = $('company-logo-input');
    if (preview) preview.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    if (input) input.value = '';
}

function removeSignature() {
    state.signatureImage = null;
    const preview = $('signature-preview');
    const placeholder = $('signature-placeholder');
    const input = $('signature-input');
    if (preview) preview.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    if (input) input.value = '';
}

/* ── Item Rows ── */
function addItemRow() {
    state.itemCounter++;
    const id = state.itemCounter;
    const tbody = $('items-tbody');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.dataset.id = id;
    tr.innerHTML = `
        <td><input type="text" class="item-desc" placeholder="Service description" /></td>
        <td><input type="number" class="item-qty" placeholder="1" min="0" step="any" style="text-align:right;width:64px" oninput="calcRow(${id})" /></td>
        <td><input type="number" class="item-price" placeholder="0.00" min="0" step="any" style="text-align:right;width:100px" oninput="calcRow(${id})" /></td>
        <td class="item-total-cell" id="row-total-${id}">—</td>
        <td><button class="del-row-btn" onclick="removeRow(${id})" title="Remove row">×</button></td>
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
    const qty = parseFloat(tr.querySelector('.item-qty')?.value) || 0;
    const price = parseFloat(tr.querySelector('.item-price')?.value) || 0;
    const total = qty * price;
    const cell = document.getElementById(`row-total-${id}`);
    if (cell) cell.textContent = total > 0 ? fmt(total) : '—';
    recalculate();
}

/* ── Currency ── */
function getCurrency() {
    const sel = $('inv-currency');
    return sel ? sel.value : '৳';
}

function fmt(n) {
    const cur = getCurrency();
    return cur + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function setupCurrencyListener() {
    const sel = $('inv-currency');
    if (sel) {
        sel.addEventListener('change', () => recalculate());
    }
}

/* ── Recalculate ── */
function recalculate() {
    const rows = qsa('#items-tbody tr');
    let subtotal = 0;

    rows.forEach(tr => {
        const qty = parseFloat(tr.querySelector('.item-qty')?.value) || 0;
        const price = parseFloat(tr.querySelector('.item-price')?.value) || 0;
        subtotal += qty * price;
    });

    const received = parseFloat($('fin-received')?.value) || 0;
    const due = Math.max(0, subtotal - received);

    const subEl = $('fin-subtotal');
    const dueEl = $('fin-due');
    if (subEl) subEl.textContent = fmt(subtotal);
    if (dueEl) dueEl.textContent = fmt(due);
}

/* ── Collect Form Data ── */
function collectData() {
    const rows = qsa('#items-tbody tr');
    const items = [];

    rows.forEach(tr => {
        const desc = tr.querySelector('.item-desc')?.value.trim() || '';
        const qty = parseFloat(tr.querySelector('.item-qty')?.value) || 0;
        const price = parseFloat(tr.querySelector('.item-price')?.value) || 0;
        const total = qty * price;
        if (desc || qty || price) {
            items.push({ desc, qty, price, total });
        }
    });

    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const received = parseFloat($('fin-received')?.value) || 0;
    const due = Math.max(0, subtotal - received);

    // Get company info
    const companyName = $('company-name')?.value.trim() || '';
    const companyEmail = $('company-email')?.value.trim() || '';
    const companyWebsite = $('company-website')?.value.trim() || '';
    const companyAddress = $('company-address')?.value.trim() || '';
    const companyContact = $('company-contact')?.value.trim() || '';

    // Client info
    const clientName = $('client-name')?.value.trim() || '';
    const clientCompany = $('client-company')?.value.trim() || '';
    const clientEmail = $('client-email')?.value.trim() || '';
    const clientPhone = $('client-phone')?.value.trim() || '';
    const clientAddress = $('client-address')?.value.trim() || '';

    // Notes
    let notes = $('inv-notes')?.value.trim() || '';
    // Replace [Company Name] with actual company name
    if (companyName) {
        notes = notes.replace(/\[Company Name\]/g, companyName);
    }

    return {
        number: $('inv-number')?.value.trim() || '',
        date: $('inv-date')?.value || '',
        dueDate: $('inv-due')?.value || '',
        currency: getCurrency(),
        company: {
            name: companyName,
            email: companyEmail,
            website: companyWebsite,
            address: companyAddress,
            contact: companyContact,
            logo: state.companyLogo || null,
        },
        client: {
            name: clientName,
            company: clientCompany,
            email: clientEmail,
            phone: clientPhone,
            address: clientAddress,
        },
        items,
        subtotal,
        received,
        due,
        notes,
        signature: state.signatureImage || null,
    };
}

/* ── Generate & Preview ── */
function generateAndPreview() {
    const data = collectData();
    renderPreview(data);
    document.getElementById('modal-preview').classList.add('open');
    document.body.style.overflow = 'hidden';

    // Save to history
    saveInvoice(data);
    renderInvoiceList();
    updateStats();
}

/* ── Render Preview ── */
function renderPreview(data) {
    const cur = data.currency || '৳';
    const fmtN = n => cur + Number(n).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });

    // Company info
    setText('prev-company-name', data.company.name || 'Your Company');
    setText('prev-company-email', data.company.email || '—');
    setText('prev-company-web', data.company.website || '—');
    setText('prev-company-contact', data.company.contact || '—');
    setText('prev-company-address', data.company.address || '—');

    // Logo
    const logoImg = $('prev-company-logo');
    const fallback = $('prev-logo-fallback');
    if (data.company.logo) {
        logoImg.src = data.company.logo;
        logoImg.style.display = 'block';
        fallback.style.display = 'none';
    } else {
        logoImg.style.display = 'none';
        fallback.style.display = 'flex';
        fallback.textContent = (data.company.name || 'LOGO').substring(0, 4).toUpperCase();
    }

    // Invoice meta
    setText('prev-number', data.number || '—');
    setText('prev-date', formatDate(data.date));
    setText('prev-duedate', data.dueDate ? formatDate(data.dueDate) : '—');

    // Client
    setText('prev-client-name', data.client.name || '—');
    setText('prev-client-company', data.client.company || '');
    setText('prev-client-email', data.client.email || '');
    setText('prev-client-phone', data.client.phone || '');
    setText('prev-client-address', data.client.address || '');

    // Items
    const tbody = $('prev-items-tbody');
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
    setText('prev-due', fmtN(data.due));

    // Notes
    const notesSection = $('inv-notes-section');
    const notesText = $('prev-notes');
    if (notesSection && notesText) {
        if (data.notes) {
            notesSection.style.display = 'block';
            notesText.textContent = data.notes;
        } else {
            notesSection.style.display = 'none';
        }
    }

    // Signature
    const sigImg = $('prev-signature-img');
    if (data.signature) {
        sigImg.src = data.signature;
        sigImg.style.display = 'block';
    } else {
        sigImg.style.display = 'none';
    }

    // Footer thanks & website
    const thanks = $('prev-footer-thanks');
    const web = $('prev-footer-website');
    if (thanks) {
        if (data.company.name) {
            thanks.textContent = `Thank you for choosing ${data.company.name}.`;
        } else {
            thanks.textContent = 'Thank you for your business.';
        }
    }
    if (web) {
        web.textContent = data.company.website || '—';
    }
}

function setText(id, val) {
    const el = $(id);
    if (el) el.textContent = val;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ── Modal Controls ── */
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

    const btns = document.querySelectorAll('.modal-action-btn, .action-btn.secondary');
    const origLabels = [];
    btns.forEach((b, i) => { origLabels[i] = b.textContent; b.textContent = '⏳ Generating…'; b.disabled = true; });

    const A4_PX = 794;

    // Build off-screen wrapper
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
        position: 'fixed',
        top: '0',
        left: '-9999px',
        width: A4_PX + 'px',
        minWidth: A4_PX + 'px',
        maxWidth: A4_PX + 'px',
        background: '#ffffff',
        zIndex: '-1',
        overflow: 'visible',
        fontFamily: "'Inter', sans-serif"
    });

    const invoiceEl = document.getElementById('invoice-preview');
    const clone = invoiceEl.cloneNode(true);
    Object.assign(clone.style, {
        width: A4_PX + 'px',
        minWidth: A4_PX + 'px',
        maxWidth: A4_PX + 'px',
        transform: 'none',
        margin: '0',
        padding: '0',
        boxShadow: 'none',
        borderRadius: '0'
    });

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
        await new Promise(r => setTimeout(r, 250));

        const canvas = await html2canvas(clone, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            imageTimeout: 8000,
            width: A4_PX,
            windowWidth: A4_PX,
            scrollX: 0,
            scrollY: 0
        });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true
        });

        const pageW = pdf.internal.pageSize.getWidth(); // 210 mm
        const pageH = pdf.internal.pageSize.getHeight(); // 297 mm

        const canvasW = canvas.width;
        const canvasH = canvas.height;

        const mmPerPx = pageW / canvasW;
        const totalMM = canvasH * mmPerPx;

        if (totalMM <= pageH) {
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, totalMM);
        } else {
            const pagePixelH = Math.round(pageH / mmPerPx);
            let yPx = 0;

            while (yPx < canvasH) {
                const sliceH = Math.min(pagePixelH, canvasH - yPx);

                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvasW;
                pageCanvas.height = sliceH;
                pageCanvas.getContext('2d').drawImage(
                    canvas,
                    0, yPx, canvasW, sliceH,
                    0, 0, canvasW, sliceH
                );

                const sliceMM = sliceH * mmPerPx;
                if (yPx > 0) pdf.addPage();
                pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, sliceMM);

                yPx += sliceH;
            }
        }

        const filename = `Invoice-${data.number || 'draft'}-${data.client.name || 'client'}.pdf`
            .replace(/[^a-zA-Z0-9\-_.]/g, '_');
        pdf.save(filename);

    } catch (err) {
        console.error('PDF generation error:', err);
        alert('PDF generation failed. Try the Print option instead.');
    } finally {
        if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
        btns.forEach((b, i) => { b.textContent = origLabels[i]; b.disabled = false; });
    }
}

/* ── Save Invoice to LocalStorage ── */
function saveInvoice(data) {
    const invoice = {
        id: Date.now(),
        number: data.number,
        date: data.date,
        client: data.client.name,
        company: data.client.company,
        total: data.subtotal,
        due: data.due,
        currency: data.currency
    };

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

/* ── Render Invoice List ── */
function renderInvoiceList() {
    const list = $('invoice-list');
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
    setText('stat-total', state.invoices.length);
    setText('stat-session', state.sessionCount);
    const cur = state.invoices.length > 0 ? (state.invoices[0].currency || '৳') : '৳';
    setText('stat-billed', cur + Number(state.totalBilled).toLocaleString('en-US', { minimumFractionDigits: 0 }));
}

/* ── Reopen / Delete ── */
function reopenInvoice(id) {
    alert('Open the invoice form and re-enter details. (Full re-edit coming in a future update.)');
}

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
        localStorage.setItem('vit_invoices', JSON.stringify(state.invoices));
        localStorage.setItem('vit_session', String(state.sessionCount));
        localStorage.setItem('vit_total_billed', String(state.totalBilled));
        // Also save company info? We'll save logo and signature as well
        localStorage.setItem('vit_company_logo', state.companyLogo || '');
        localStorage.setItem('vit_signature', state.signatureImage || '');
        // Save form fields? Could be done but not necessary for basic persistence.
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

        // Load images
        const logo = localStorage.getItem('vit_company_logo');
        if (logo) {
            state.companyLogo = logo;
            const preview = $('logo-preview');
            const img = $('logo-preview-img');
            const placeholder = $('logo-placeholder');
            if (preview && img && placeholder && logo) {
                img.src = logo;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
            }
        }

        const sig = localStorage.getItem('vit_signature');
        if (sig) {
            state.signatureImage = sig;
            const preview = $('signature-preview');
            const img = $('signature-preview-img');
            const placeholder = $('signature-placeholder');
            if (preview && img && placeholder && sig) {
                img.src = sig;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
            }
        }
    } catch (e) { /* ignore */ }
}

/* ── Keyboard: Escape closes modal ── */
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePreviewDirect();
});

/* ── Auto‑save form fields on change (optional) ── */
// We could add listeners to save company info, client, etc. to localStorage for persistence.
// For simplicity, we only save images and invoice history.
// But we can also save form fields on step change.

// When going to dashboard, we could save current form state, but not required.

console.log('Universal Invoice Generator loaded successfully.');
