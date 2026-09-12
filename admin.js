/**
 * TaskFlow — admin.js
 * Admin Dashboard: Tabbed Navigation, Assignments CRUD, Submissions Table, Student Matrix, Signature & Password Settings
 */
'use strict';

const STORAGE_KEY    = 'taskflow_tasks';
const STUDENT_KEY    = 'taskflow_students';
const ASSIGNMENT_KEY = 'taskflow_assignments';
const PASS_KEY       = 'taskflow_admin_pass';
const SIG_KEY        = 'taskflow_mentor_signature';
const DEADLINE_KEY   = 'taskflow_global_deadline';
const CIRC           = 2 * Math.PI * 45;

/* ===================== DEFAULT DATA ===================== */
const DEFAULT_ASSIGNMENTS = [
    {
        id: 'asgn_demo_1',
        title: 'Tugas 1 — Making HTML Login Page',
        subject: 'Pemrograman Web',
        classGroup: 'Semua',
        deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
        description: 'Buat halaman login responsif menggunakan HTML5 dan CSS. Lampirkan link GitHub atau file ZIP.',
        createdAt: new Date().toISOString()
    },
    {
        id: 'asgn_demo_2',
        title: 'Tugas 2 — Desain Database Relasional',
        subject: 'Basis Data',
        classGroup: 'Semua',
        deadline: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 16),
        description: 'Rancang ERD dan tabel database untuk sistem toko online. Lampirkan PDF atau file skema SQL.',
        createdAt: new Date().toISOString()
    }
];

/* ===================== STATE ===================== */
let tasks           = [];
let students        = [];
let assignments      = [];
let filteredAdmin   = [];
let selectedIds     = new Set();
let pendingAction   = null;

/* ===================== DOM ELEMENTS ===================== */
// Auth & Header
const authGate          = document.getElementById('authGate');
const adminLoginForm    = document.getElementById('adminLoginForm');
const adminUsername     = document.getElementById('adminUsername');
const adminPassword     = document.getElementById('adminPassword');
const loginAlert        = document.getElementById('loginAlert');
const loginAlertText    = document.getElementById('loginAlertText');
const btnTogglePw       = document.getElementById('btnTogglePw');
const btnLogoutAdmin    = document.getElementById('btnLogoutAdmin');
const headerDate        = document.getElementById('headerDate');
const headerTime        = document.getElementById('headerTime');
const lastRefreshed     = document.getElementById('lastRefreshed');
const btnRefresh        = document.getElementById('btnRefresh');
const adminMainContent  = document.getElementById('adminMainContent');
const adminDashContent  = document.getElementById('adminDashboardContent');

// Tabs
const tabBtns           = document.querySelectorAll('.admin-tab-btn');
const tabContents       = document.querySelectorAll('.tab-content');
const badgeSubmissions  = document.getElementById('badgeSubmissions');
const badgeAssignments  = document.getElementById('badgeAssignments');

// Tab 1 Submissions
const adminBody         = document.getElementById('adminBody');
const adminEmpty        = document.getElementById('adminEmpty');
const adminSearch       = document.getElementById('adminSearch');
const adminClearSearch  = document.getElementById('adminClearSearch');
const adminFilterClass  = document.getElementById('adminFilterClass');
const adminFilterSub    = document.getElementById('adminFilterSubject');
const adminFilterStatus = document.getElementById('adminFilterStatus');
const adminResultCount  = document.getElementById('adminResultCount');
const selectAll         = document.getElementById('selectAll');
const bulkBar           = document.getElementById('bulkBar');
const bulkCount         = document.getElementById('bulkCount');
const btnDeleteSelected = document.getElementById('btnDeleteSelected');
const btnDeselectAll    = document.getElementById('btnDeselectAll');
const btnExportCSV      = document.getElementById('btnExportCSV');
const btnPrint          = document.getElementById('btnPrint');
const btnDeleteAll      = document.getElementById('btnDeleteAll');

// Tab 2 Assignments
const formAssignment    = document.getElementById('formAssignment');
const asgnEditId        = document.getElementById('asgnEditId');
const asgnTitle         = document.getElementById('asgnTitle');
const asgnSubject       = document.getElementById('asgnSubject');
const asgnClassGroup    = document.getElementById('asgnClassGroup');
const asgnDeadline      = document.getElementById('asgnDeadline');
const asgnDesc          = document.getElementById('asgnDesc');
const btnSaveAssignment = document.getElementById('btnSaveAssignment');
const btnCancelAsgn     = document.getElementById('btnCancelAssignment');
const btnAsgnLabel      = document.getElementById('btnAsgnLabel');
const assignmentsContainer = document.getElementById('assignmentsContainer');

// Tab 3 Student Recap & Roster
const regName           = document.getElementById('regName');
const regClassGroup     = document.getElementById('regClassGroup');
const btnAddStudent     = document.getElementById('btnAddStudent');
const studentList       = document.getElementById('studentList');
const barChart          = document.getElementById('barChart');

// Tab 4 Settings & Sig
const adminDeadlineInput = document.getElementById('adminDeadlineInput');
const btnSaveDeadline   = document.getElementById('btnSaveDeadline');
const adminDeadlineStatus = document.getElementById('adminDeadlineStatus');
const pwCurrent         = document.getElementById('pwCurrent');
const pwNew             = document.getElementById('pwNew');
const btnChangePw       = document.getElementById('btnChangePw');

// Modal & Toast
const modalOverlay      = document.getElementById('modalOverlay');
const modalMessage      = document.getElementById('modalMessage');
const modalTitle        = document.getElementById('modalTitle');
const btnConfirmDel     = document.getElementById('btnConfirmDelete');
const btnCancelDel      = document.getElementById('btnCancelDelete');
const toastContainer    = document.getElementById('toastContainer');

/* ===================== INIT & AUTH ===================== */
function initAdmin() {
    updateClock();
    setInterval(updateClock, 1000);

    const authed = sessionStorage.getItem('taskflow_admin_authed');
    if (authed === 'true') {
        showDashboard();
    } else {
        showLoginGate();
    }
}

function showLoginGate() {
    if (authGate) { authGate.style.display = 'flex'; authGate.classList.remove('hidden'); }
    if (adminMainContent) adminMainContent.style.display = 'none';
    if (adminDashContent) adminDashContent.style.display = 'none';
}

function showDashboard() {
    if (authGate) { authGate.style.display = 'none'; authGate.classList.add('hidden'); }
    if (adminMainContent) adminMainContent.style.display = 'block';
    if (adminDashContent) adminDashContent.style.display = 'block';

    loadAllData();
    renderAllViews();
}

function loadAllData() {
    try { tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { tasks = []; }
    try { students = JSON.parse(localStorage.getItem(STUDENT_KEY)) || []; } catch { students = []; }
    try { assignments = JSON.parse(localStorage.getItem(ASSIGNMENT_KEY)) || []; } catch { assignments = []; }

    if (!assignments || assignments.length === 0) {
        assignments = DEFAULT_ASSIGNMENTS;
        localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(assignments));
    }
}

/* ===================== AUTH HANDLERS ===================== */
if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', e => {
        e.preventDefault();
        const user = adminUsername.value.trim();
        const pass = adminPassword.value;
        const storedPass = localStorage.getItem(PASS_KEY) || 'admin123';

        if ((user === 'admin' || user === 'fauzi') && pass === storedPass) {
            sessionStorage.setItem('taskflow_admin_authed', 'true');
            if (loginAlert) loginAlert.classList.remove('show');
            showToast('success', '🔑', 'Login berhasil! Selamat datang, Mentor Fauzi.');
            showDashboard();
        } else {
            if (loginAlert) {
                if (loginAlertText) loginAlertText.textContent = 'Username atau password salah. (Default: admin / admin123)';
                loginAlert.classList.add('show');
            }
        }
    });
}

if (btnTogglePw) {
    btnTogglePw.addEventListener('click', () => {
        const type = adminPassword.getAttribute('type') === 'password' ? 'text' : 'password';
        adminPassword.setAttribute('type', type);
    });
}

if (btnLogoutAdmin) {
    btnLogoutAdmin.addEventListener('click', () => {
        sessionStorage.removeItem('taskflow_admin_authed');
        showToast('info', '🔒', 'Anda telah keluar dari dashboard admin.');
        showLoginGate();
    });
}

/* ===================== TAB SYSTEM ===================== */
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const contentEl = document.getElementById(targetTab);
        if (contentEl) contentEl.classList.add('active');
    });
});

/* ===================== RENDER MASTER VIEWS ===================== */
function renderAllViews() {
    renderSubmissions();
    renderAssignments();
    renderRecap();
    renderStudentRoster();
    initSignatureCanvas();
    updateSubjectDropdown();

    if (lastRefreshed) lastRefreshed.textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    if (badgeSubmissions) badgeSubmissions.textContent = tasks.length;
    if (badgeAssignments) badgeAssignments.textContent = assignments.length;
}

if (btnRefresh) btnRefresh.addEventListener('click', () => { loadAllData(); renderAllViews(); showToast('info', '🔄', 'Data telah diperbarui.'); });

/* ===================== TAB 1: SUBMISSIONS ===================== */
function renderSubmissions() {
    const q = adminSearch ? adminSearch.value.toLowerCase().trim() : '';
    const cls = adminFilterClass ? adminFilterClass.value : '';
    const sub = adminFilterSub ? adminFilterSub.value : '';
    const st = adminFilterStatus ? adminFilterStatus.value : '';

    filteredAdmin = tasks.filter(t => {
        const matchQ = !q || t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q) || t.title.toLowerCase().includes(q);
        const matchCls = !cls || (t.classGroup || 'RPL 1') === cls;
        const matchSub = !sub || t.subject === sub;
        const matchSt = !st || t.status === st;
        return matchQ && matchCls && matchSub && matchSt;
    });

    if (adminResultCount) adminResultCount.textContent = `${filteredAdmin.length} tugas`;

    if (!adminBody) return;
    if (filteredAdmin.length === 0) {
        adminBody.innerHTML = '';
        if (adminEmpty) adminEmpty.style.display = 'block';
        return;
    }

    if (adminEmpty) adminEmpty.style.display = 'none';

    adminBody.innerHTML = filteredAdmin.map((t, idx) => {
        const checked = selectedIds.has(t.id) ? 'checked' : '';
        const linkHtml = t.submitMode === 'file'
            ? `<a href="${t.fileData}" download="${escHtml(t.fileName)}" class="badge badge-file">📎 ${escHtml(t.fileName)}</a>`
            : `<a href="${escHtml(t.link)}" target="_blank" rel="noopener" class="badge badge-link">🔗 Link</a>`;

        const statusBadge = t.status === 'tepat'
            ? `<span class="badge badge-tepat">✓ Tepat</span>`
            : `<span class="badge badge-terlambat">⏰ Terlambat</span>`;

        return `
            <tr class="${checked ? 'selected' : ''}">
                <td class="no-print"><input type="checkbox" class="row-select" data-id="${t.id}" ${checked} /></td>
                <td>${idx + 1}</td>
                <td><strong>${escHtml(t.name)}</strong></td>
                <td><span class="badge" style="background:#f1f5f9;color:#475569;">${escHtml(t.classGroup || 'RPL 1')}</span></td>
                <td>${escHtml(t.subject)}</td>
                <td>${escHtml(t.title)}</td>
                <td>${linkHtml}</td>
                <td>${fmtDate(t.date)}</td>
                <td>${fmtDate(t.deadline)}</td>
                <td>${statusBadge}</td>
                <td class="no-print">
                    <button class="btn-action delete" onclick="confirmSingleDelete('${t.id}')" title="Hapus">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');

    // Row selection listener
    document.querySelectorAll('.row-select').forEach(chk => {
        chk.addEventListener('change', e => {
            const id = e.target.getAttribute('data-id');
            if (e.target.checked) selectedIds.add(id); else selectedIds.delete(id);
            updateBulkBar();
        });
    });

    updateStats();
}

function updateStats() {
    const total     = tasks.length;
    const tepat     = tasks.filter(t => t.status === 'tepat').length;
    const terlambat = tasks.filter(t => t.status === 'terlambat').length;
    const unique    = new Set(tasks.map(t => t.name.toLowerCase())).size;

    const elTotal = document.getElementById('statTotal');
    const elTepat = document.getElementById('statTepat');
    const elTerlambat = document.getElementById('statTerlambat');
    const elSiswa = document.getElementById('statSiswa');

    if (elTotal) elTotal.textContent = total;
    if (elTepat) elTepat.textContent = tepat;
    if (elTerlambat) elTerlambat.textContent = terlambat;
    if (elSiswa) elSiswa.textContent = unique;

    updateDonut(tepat, terlambat, total);
}

function updateDonut(tepat, terlambat, total) {
    const pct = total > 0 ? Math.round(tepat / total * 100) : 0;
    const tepatArc = total > 0 ? (tepat / total) * CIRC : 0;
    const terlambatArc = total > 0 ? (terlambat / total) * CIRC : 0;

    const dTepat = document.querySelector('.donut-tepat');
    const dTerlambat = document.querySelector('.donut-terlambat');
    const dCenter = document.getElementById('donutCenter');

    if (dTepat) dTepat.setAttribute('stroke-dasharray', `${tepatArc} ${CIRC - tepatArc}`);
    if (dTerlambat) {
        dTerlambat.setAttribute('stroke-dasharray', `${terlambatArc} ${CIRC - terlambatArc}`);
        dTerlambat.style.transform = `rotate(${(tepat / (total||1)) * 360 - 90}deg)`;
        dTerlambat.style.transformOrigin = '60px 60px';
    }
    if (dCenter) dCenter.textContent = `${pct}%`;

    const elLegTepat = document.getElementById('legTepat');
    const elLegTerlambat = document.getElementById('legTerlambat');
    const elLegTotal = document.getElementById('legTotal');

    if (elLegTepat) elLegTepat.textContent = `${tepat} (${pct}%)`;
    if (elLegTerlambat) elLegTerlambat.textContent = `${terlambat} (${total > 0 ? Math.round(terlambat/total*100) : 0}%)`;
    if (elLegTotal) elLegTotal.textContent = total;
}

/* Bulk Selection */
if (selectAll) {
    selectAll.addEventListener('change', e => {
        if (e.target.checked) filteredAdmin.forEach(t => selectedIds.add(t.id)); else selectedIds.clear();
        renderSubmissions();
        updateBulkBar();
    });
}

function updateBulkBar() {
    if (!bulkBar) return;
    if (selectedIds.size > 0) {
        bulkBar.classList.add('show');
        if (bulkCount) bulkCount.textContent = `${selectedIds.size} dipilih`;
    } else {
        bulkBar.classList.remove('show');
    }
}
if (btnDeselectAll) btnDeselectAll.addEventListener('click', () => { selectedIds.clear(); updateBulkBar(); renderSubmissions(); });

/* ===================== TAB 2: ASSIGNMENTS CRUD ===================== */
if (btnSaveAssignment) {
    btnSaveAssignment.addEventListener('click', () => {
        const title = asgnTitle.value.trim();
        const subject = asgnSubject.value.trim();
        const classGroup = asgnClassGroup.value;
        const deadline = asgnDeadline.value;
        const desc = asgnDesc.value.trim();

        if (!title || !subject || !deadline) {
            showToast('error', '⚠️', 'Harap isi Judul, Mapel, dan Deadline penugasan.');
            return;
        }

        const editId = asgnEditId.value;
        if (editId) {
            const idx = assignments.findIndex(a => a.id === editId);
            if (idx !== -1) {
                assignments[idx] = { ...assignments[idx], title, subject, classGroup, deadline, description: desc };
                showToast('info', '✏️', 'Penugasan berhasil diperbarui!');
            }
        } else {
            const newAsgn = {
                id: 'asgn_' + Date.now().toString(36),
                title, subject, classGroup, deadline, description: desc,
                createdAt: new Date().toISOString()
            };
            assignments.unshift(newAsgn);
            showToast('success', '🎯', 'Penugasan baru berhasil dipublikasikan!');
        }

        localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(assignments));
        resetAssignmentForm();
        renderAssignments();
        if (badgeAssignments) badgeAssignments.textContent = assignments.length;
    });
}

function resetAssignmentForm() {
    asgnEditId.value = '';
    formAssignment.reset();
    if (btnAsgnLabel) btnAsgnLabel.textContent = 'Publikasikan Penugasan';
    if (btnCancelAsgn) btnCancelAsgn.style.display = 'none';
}
if (btnCancelAsgn) btnCancelAsgn.addEventListener('click', resetAssignmentForm);

function renderAssignments() {
    if (!assignmentsContainer) return;
    if (assignments.length === 0) {
        assignmentsContainer.innerHTML = '<div class="empty-state" style="padding:2rem 0;grid-column:1/-1;"><p>Belum ada penugasan aktif.</p></div>';
        return;
    }

    assignmentsContainer.innerHTML = assignments.map(a => {
        const count = tasks.filter(t => t.assignmentId === a.id || t.title === a.title).length;
        return `
            <div class="assignment-card">
                <div class="assignment-card-header">
                    <div>
                        <div class="assignment-title">${escHtml(a.title)}</div>
                        <div class="assignment-subject">${escHtml(a.subject)} • <span style="color:#059669;font-weight:700;">${escHtml(a.classGroup)}</span></div>
                    </div>
                </div>
                <div class="assignment-desc">${escHtml(a.description || 'Tidak ada instruksi tambahan.')}</div>
                <div class="assignment-meta-list">
                    <div>📅 Deadline: <strong>${fmtDateTime(a.deadline)}</strong></div>
                    <div>📥 Dikumpulkan: <strong>${count} siswa</strong></div>
                </div>
                <div style="display:flex;gap:0.5rem;margin-top:auto;">
                    <button class="btn btn-outline btn-xs" onclick="editAssignment('${a.id}')" style="flex:1;">✏️ Edit</button>
                    <button class="btn btn-danger-outline btn-xs" onclick="deleteAssignment('${a.id}')">🗑️ Hapus</button>
                </div>
            </div>
        `;
    }).join('');
}

window.editAssignment = function(id) {
    const a = assignments.find(x => x.id === id);
    if (!a) return;
    asgnEditId.value = a.id;
    asgnTitle.value = a.title;
    asgnSubject.value = a.subject;
    asgnClassGroup.value = a.classGroup;
    asgnDeadline.value = a.deadline;
    asgnDesc.value = a.description || '';

    if (btnAsgnLabel) btnAsgnLabel.textContent = 'Simpan Perubahan';
    if (btnCancelAsgn) btnCancelAsgn.style.display = 'inline-flex';
    formAssignment.scrollIntoView({ behavior: 'smooth' });
};

window.deleteAssignment = function(id) {
    if (confirm('Apakah Anda yakin ingin menghapus penugasan ini?')) {
        assignments = assignments.filter(a => a.id !== id);
        localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(assignments));
        renderAssignments();
        showToast('info', '🗑️', 'Penugasan dihapus.');
    }
};

/* ===================== TAB 3: STUDENT RECAP ===================== */
if (btnAddStudent) {
    btnAddStudent.addEventListener('click', () => {
        const name = regName.value.trim();
        const classGroup = regClassGroup ? regClassGroup.value : 'RPL 1';
        if (!name) return;

        students.push({ id: 'st_' + Date.now(), name, classGroup });
        localStorage.setItem(STUDENT_KEY, JSON.stringify(students));
        regName.value = '';
        renderStudentRoster();
        showToast('success', '👤', `Siswa ${name} ditambahkan.`);
    });
}

function renderStudentRoster() {
    if (!studentList) return;
    if (students.length === 0) {
        studentList.innerHTML = '<div class="empty-state" style="padding:1.5rem 0;"><p>Belum ada siswa terdaftar.</p></div>';
        return;
    }

    studentList.innerHTML = students.map(s => {
        const submittedCount = tasks.filter(t => t.name.toLowerCase() === s.name.toLowerCase()).length;
        return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0;border-bottom:1px solid #f1f5f9;">
                <div>
                    <strong>${escHtml(s.name)}</strong> <span style="font-size:0.75rem;color:var(--text-muted);">(${escHtml(s.classGroup)})</span>
                </div>
                <div style="display:flex;align-items:center;gap:0.75rem;">
                    <span class="badge" style="background:#ecfdf5;color:#047857;font-size:0.72rem;">${submittedCount} Tugas Kumpul</span>
                    <button class="btn-action delete" onclick="deleteStudent('${s.id}')">✕</button>
                </div>
            </div>
        `;
    }).join('');

    renderBarChart();
}

window.deleteStudent = function(id) {
    students = students.filter(s => s.id !== id);
    localStorage.setItem(STUDENT_KEY, JSON.stringify(students));
    renderStudentRoster();
};

function renderBarChart() {
    if (!barChart) return;
    const map = {};
    tasks.forEach(t => { map[t.subject] = (map[t.subject] || 0) + 1; });
    const entries = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 6);
    const max = entries.length > 0 ? entries[0][1] : 1;

    if (entries.length === 0) {
        barChart.innerHTML = '<div class="empty-state" style="padding:1rem 0;"><p>Belum ada data pengumpulan.</p></div>';
        return;
    }

    barChart.innerHTML = entries.map(([subj, count]) => `
        <div class="bar-item">
            <span class="bar-label" title="${escHtml(subj)}">${escHtml(subj)}</span>
            <div class="bar-track">
                <div class="bar-fill" style="width:${Math.round(count/max*100)}%"></div>
            </div>
            <span class="bar-value">${count}</span>
        </div>
    `).join('');
}

/* ===================== TAB 4: SETTINGS & SIG ===================== */
if (btnSaveDeadline) {
    btnSaveDeadline.addEventListener('click', () => {
        const val = adminDeadlineInput.value;
        if (!val) return;
        localStorage.setItem(DEADLINE_KEY, val);
        if (adminDeadlineStatus) adminDeadlineStatus.textContent = `Default deadline disimpan: ${fmtDateTime(val)}`;
        showToast('success', '⏳', 'Default deadline diperbarui.');
    });
}

if (btnChangePw) {
    btnChangePw.addEventListener('click', () => {
        const curr = pwCurrent.value;
        const nxt = pwNew.value;
        const storedPass = localStorage.getItem(PASS_KEY) || 'admin123';

        if (curr !== storedPass) {
            showToast('error', '❌', 'Password saat ini salah.');
            return;
        }
        if (!nxt || nxt.length < 6) {
            showToast('error', '⚠️', 'Password baru minimal 6 karakter.');
            return;
        }

        localStorage.setItem(PASS_KEY, nxt);
        pwCurrent.value = '';
        pwNew.value = '';
        showToast('success', '🔒', 'Password admin berhasil diubah!');
    });
}

/* Signature Canvas Logic */
let sigCanvas, sigCtx, drawing = false;

function initSignatureCanvas() {
    sigCanvas = document.getElementById('sigCanvas');
    if (!sigCanvas) return;
    sigCtx = sigCanvas.getContext('2d');
    sigCtx.lineWidth = 3;
    sigCtx.strokeStyle = '#1e293b';

    sigCanvas.onmousedown = startDraw;
    sigCanvas.onmousemove = draw;
    sigCanvas.onmouseup = stopDraw;

    sigCanvas.ontouchstart = e => { startDraw(e.touches[0]); };
    sigCanvas.ontouchmove = e => { draw(e.touches[0]); };
    sigCanvas.ontouchend = stopDraw;

    const existingSig = localStorage.getItem(SIG_KEY);
    const prevImg = document.getElementById('sigPreviewImg');
    const prevWrap = document.getElementById('sigSavedPreview');
    const pill = document.getElementById('sigStatusPill');

    if (existingSig && prevImg) {
        prevImg.src = existingSig;
        if (prevWrap) prevWrap.style.display = 'block';
        if (pill) { pill.textContent = '✓ Tersimpan'; pill.style.background = '#ecfdf5'; pill.style.color = '#059669'; }
    }
}

function startDraw(e) { drawing = true; sigCtx.beginPath(); sigCtx.moveTo(getPos(e).x, getPos(e).y); }
function draw(e) { if (!drawing) return; sigCtx.lineTo(getPos(e).x, getPos(e).y); sigCtx.stroke(); }
function stopDraw() { drawing = false; }
function getPos(e) {
    const rect = sigCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

const btnClearSig = document.getElementById('btnClearSig');
const btnEraseSig = document.getElementById('btnEraseSig');
const btnSaveSig  = document.getElementById('btnSaveSig');

if (btnClearSig) {
    btnClearSig.addEventListener('click', () => {
        localStorage.removeItem(SIG_KEY);
        if (sigCtx) sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
        const prevWrap = document.getElementById('sigSavedPreview');
        if (prevWrap) prevWrap.style.display = 'none';
        showToast('info', '🗑️', 'Tanda tangan dihapus.');
    });
}
if (btnEraseSig) btnEraseSig.addEventListener('click', () => { if (sigCtx) sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height); });
if (btnSaveSig) {
    btnSaveSig.addEventListener('click', () => {
        const dataUrl = sigCanvas.toDataURL();
        localStorage.setItem(SIG_KEY, dataUrl);
        const prevImg = document.getElementById('sigPreviewImg');
        const prevWrap = document.getElementById('sigSavedPreview');
        if (prevImg) prevImg.src = dataUrl;
        if (prevWrap) prevWrap.style.display = 'block';
        showToast('success', '✍️', 'Tanda tangan digital berhasil disimpan!');
    });
}

/* ===================== EXPORT CSV & PRINT ===================== */
if (btnExportCSV) {
    btnExportCSV.addEventListener('click', () => {
        if (tasks.length === 0) { showToast('warning', '⚠️', 'Tidak ada data untuk diekspor.'); return; }
        
        let csv = 'No,Nama Siswa,Kelas,Mata Pelajaran,Judul Tugas,Link/File,Waktu Kumpul,Deadline,Status\n';
        tasks.forEach((t, i) => {
            const link = t.submitMode === 'file' ? t.fileName : t.link;
            csv += `"${i+1}","${t.name}","${t.classGroup||'RPL 1'}","${t.subject}","${t.title}","${link}","${fmtDate(t.date)}","${fmtDate(t.deadline)}","${t.status}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `TaskFlow_Laporan_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        showToast('success', '📥', 'Laporan CSV berhasil diunduh.');
    });
}

if (btnPrint) btnPrint.addEventListener('click', () => window.print());

if (btnDeleteAll) {
    btnDeleteAll.addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin menghapus seluruh data pengumpulan tugas?')) {
            tasks = [];
            localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
            renderSubmissions();
            showToast('warning', '🗑️', 'Seluruh data tugas dibersihkan.');
        }
    });
}

function updateSubjectDropdown() {
    if (!adminFilterSub) return;
    const subjects = [...new Set(tasks.map(t => t.subject))].sort();
    let html = '<option value="">Semua Mapel</option>';
    subjects.forEach(s => { html += `<option value="${escHtml(s)}">${escHtml(s)}</option>`; });
    adminFilterSub.innerHTML = html;
}

/* ===================== UTILS & TOAST ===================== */
function updateClock() {
    const now = new Date();
    if (headerDate) headerDate.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (headerTime) headerTime.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    const pad = n => String(n).padStart(2,'0');
    return `${pad(dt.getDate())}/${pad(dt.getMonth()+1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' Jam ' +
           d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
function escHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

function showToast(type, icon, message) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

document.addEventListener('DOMContentLoaded', initAdmin);
