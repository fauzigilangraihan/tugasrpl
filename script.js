/**
 * TaskFlow — script.js
 * Student form logic: dynamic assignments, saved profile, file upload (base64) / URL, receipt modal.
 */
'use strict';

const STORAGE_KEY    = 'taskflow_tasks';
const ASSIGNMENT_KEY = 'taskflow_assignments';
const PROFILE_KEY    = 'taskflow_student_profile';
const DEADLINE_KEY   = 'taskflow_global_deadline';
const MAX_FILE_SIZE  = 4 * 1024 * 1024; // 4 MB

/* ===================== DEFAULT ASSIGNMENTS ===================== */
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
let tasks            = [];
let assignments      = [];
let filteredTasks    = [];
let pendingDeleteId  = null;
let sortKey          = 'date';
let sortDir          = 'desc';
let submitMode       = 'url';   // 'url' | 'file'
let selectedFileData = null;    // { name, type, ext, size, base64 }

/* ===================== DOM ELEMENTS ===================== */
const form               = document.getElementById('taskForm');
const editIdField        = document.getElementById('editId');
const btnLabel           = document.getElementById('btnLabel');
const btnCancel          = document.getElementById('btnCancel');
const btnReset           = document.getElementById('btnReset');
const searchInput        = document.getElementById('searchInput');
const btnClearSearch     = document.getElementById('btnClearSearch');
const filterStatus       = document.getElementById('filterStatus');
const btnClearAll        = document.getElementById('btnClearAll');
const taskBody           = document.getElementById('taskBody');
const emptyState         = document.getElementById('emptyState');
const resultCount        = document.getElementById('resultCount');
const toastContainer     = document.getElementById('toastContainer');
const modalOverlay       = document.getElementById('modalOverlay');
const modalMessage       = document.getElementById('modalMessage');
const btnConfirmDel      = document.getElementById('btnConfirmDelete');
const btnCancelDel       = document.getElementById('btnCancelDelete');

// Form fields
const fName              = document.getElementById('inputName');
const fClassGroup        = document.getElementById('inputClassGroup');
const fSubject           = document.getElementById('inputSubject');
const fTitle             = document.getElementById('inputTitle');
const fLink              = document.getElementById('inputLink');
const fDate              = document.getElementById('inputDate');
const fDeadline          = document.getElementById('inputDeadline');
const chkRemember        = document.getElementById('chkRemember');
const selectAssignment   = document.getElementById('selectAssignment');
const assignmentDetailCard = document.getElementById('assignmentDetailCard');
const assignDetailSubject= document.getElementById('assignDetailSubject');
const assignDetailDeadline= document.getElementById('assignDetailDeadline');
const assignDetailTitle  = document.getElementById('assignDetailTitle');
const assignDetailDesc   = document.getElementById('assignDetailDesc');

// Profile banner
const savedProfileBanner = document.getElementById('savedProfileBanner');
const savedProfileAvatar = document.getElementById('savedProfileAvatar');
const savedProfileText   = document.getElementById('savedProfileText');
const btnChangeProfile   = document.getElementById('btnChangeProfile');

// Error indicators
const errName            = document.getElementById('errName');
const errSubject         = document.getElementById('errSubject');
const errTitle           = document.getElementById('errTitle');
const errLink            = document.getElementById('errLink');

// Stats counters
const statTotal          = document.getElementById('statTotal');
const statTepat          = document.getElementById('statTepat');
const statTerlambat      = document.getElementById('statTerlambat');
const statSiswa          = document.getElementById('statSiswa');

// File upload UI
const typeBtnUrl         = document.getElementById('typeBtnUrl');
const typeBtnFile        = document.getElementById('typeBtnFile');
const urlInputWrap       = document.getElementById('urlInputWrap');
const fileInputWrap      = document.getElementById('fileInputWrap');
const dropzone           = document.getElementById('dropzone');
const fileInput          = document.getElementById('fileInput');
const filePreview        = document.getElementById('filePreview');
const filePrevIcon       = document.getElementById('filePrevIcon');
const filePrevName       = document.getElementById('filePrevName');
const filePrevMeta       = document.getElementById('filePrevMeta');
const btnRemoveFile      = document.getElementById('btnRemoveFile');

// Receipt Modal
const receiptModalOverlay= document.getElementById('receiptModalOverlay');
const rcptId             = document.getElementById('rcptId');
const rcptName           = document.getElementById('rcptName');
const rcptClass          = document.getElementById('rcptClass');
const rcptSubject        = document.getElementById('rcptSubject');
const rcptTitle          = document.getElementById('rcptTitle');
const rcptDate           = document.getElementById('rcptDate');
const rcptStatus         = document.getElementById('rcptStatus');
const btnCopyReceipt     = document.getElementById('btnCopyReceipt');
const btnCloseReceipt    = document.getElementById('btnCloseReceipt');

/* ===================== STORAGE & INIT ===================== */
function loadData() {
    try { tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { tasks = []; }
    try { assignments = JSON.parse(localStorage.getItem(ASSIGNMENT_KEY)) || []; } catch { assignments = []; }

    if (!assignments || assignments.length === 0) {
        assignments = DEFAULT_ASSIGNMENTS;
        localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(assignments));
    }

    loadProfile();
    renderAssignmentOptions();
    renderTasks();
    checkSignatureNotice();
}

function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }

/* ===================== STUDENT PROFILE STORAGE ===================== */
function loadProfile() {
    try {
        const prof = JSON.parse(localStorage.getItem(PROFILE_KEY));
        if (prof && prof.name) {
            if (fName) fName.value = prof.name;
            if (fClassGroup && prof.classGroup) fClassGroup.value = prof.classGroup;
            if (savedProfileBanner) {
                savedProfileBanner.style.display = 'flex';
                savedProfileAvatar.textContent = prof.name[0].toUpperCase();
                savedProfileText.textContent = `Selamat datang kembali, ${prof.name} (${prof.classGroup || 'Siswa'})!`;
            }
        }
    } catch {}
}

if (btnChangeProfile) {
    btnChangeProfile.addEventListener('click', () => {
        localStorage.removeItem(PROFILE_KEY);
        if (fName) fName.value = '';
        if (savedProfileBanner) savedProfileBanner.style.display = 'none';
        showToast('info', '👤', 'Silakan masukkan data diri siswa baru.');
    });
}

/* ===================== ASSIGNMENT DROPDOWN ===================== */
function renderAssignmentOptions() {
    if (!selectAssignment) return;
    const selectedClass = fClassGroup ? fClassGroup.value : 'RPL 1';
    
    // Filter active assignments by class target
    const activeList = assignments.filter(a => a.classGroup === 'Semua' || a.classGroup === selectedClass);
    
    let html = '<option value="">-- Pilih Tugas yang Diberikan Mentor --</option>';
    activeList.forEach(a => {
        html += `<option value="${a.id}">${escHtml(a.title)} (${escHtml(a.subject)})</option>`;
    });
    html += '<option value="custom">✍️ Input Judul &amp; Mapel Manual (Custom)</option>';
    
    selectAssignment.innerHTML = html;
}

if (fClassGroup) {
    fClassGroup.addEventListener('change', () => {
        renderAssignmentOptions();
        if (chkRemember && chkRemember.checked && fName.value.trim()) {
            localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: fName.value.trim(), classGroup: fClassGroup.value }));
        }
    });
}

if (selectAssignment) {
    selectAssignment.addEventListener('change', e => {
        const val = e.target.value;
        if (!val) {
            if (assignmentDetailCard) assignmentDetailCard.style.display = 'none';
            return;
        }
        if (val === 'custom') {
            if (assignmentDetailCard) assignmentDetailCard.style.display = 'none';
            if (fSubject) fSubject.value = '';
            if (fTitle) fTitle.value = '';
            if (fDeadline) fDeadline.value = getGlobalDeadline();
            return;
        }
        
        const asgn = assignments.find(a => a.id === val);
        if (asgn) {
            if (fSubject) fSubject.value = asgn.subject;
            if (fTitle) fTitle.value = asgn.title;
            if (fDeadline) fDeadline.value = asgn.deadline;
            
            if (assignmentDetailCard) {
                assignmentDetailCard.style.display = 'block';
                assignDetailSubject.textContent = asgn.subject + (asgn.classGroup !== 'Semua' ? ` • ${asgn.classGroup}` : '');
                assignDetailDeadline.textContent = `Deadline: ${fmtDateTime(asgn.deadline)}`;
                assignDetailTitle.textContent = asgn.title;
                assignDetailDesc.textContent = asgn.description || 'Instruksi: Selesaikan tugas dan kumpulkan sebelum deadline.';
            }
        }
    });
}

/* ===================== UTILITIES ===================== */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
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
           d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
}
function calcStatus(date, deadline) {
    if (!date || !deadline) return 'unknown';
    return date <= deadline ? 'tepat' : 'terlambat';
}
function isValidUrl(s) { try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } }
function escHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function fmtBytes(b) { if(b < 1024) return b+'B'; if(b < 1024*1024) return (b/1024).toFixed(1)+' KB'; return (b/(1024*1024)).toFixed(2)+' MB'; }

function getGlobalDeadline() {
    let dl = localStorage.getItem(DEADLINE_KEY);
    if (!dl) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        dl = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        localStorage.setItem(DEADLINE_KEY, dl);
    }
    return dl;
}

/* ===================== FILE UPLOAD TOGGLE ===================== */
if (typeBtnUrl) typeBtnUrl.addEventListener('click', () => switchMode('url'));
if (typeBtnFile) typeBtnFile.addEventListener('click', () => switchMode('file'));

function switchMode(mode) {
    submitMode = mode;
    if (typeBtnUrl) typeBtnUrl.classList.toggle('active', mode === 'url');
    if (typeBtnFile) typeBtnFile.classList.toggle('active', mode === 'file');
    if (urlInputWrap) urlInputWrap.style.display  = mode === 'url'  ? 'block' : 'none';
    if (fileInputWrap) fileInputWrap.style.display = mode === 'file' ? 'block' : 'none';
    clearFieldError(fLink, errLink);
}

if (dropzone) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    });
}
if (fileInput) fileInput.addEventListener('change', e => { if (e.target.files[0]) processFile(e.target.files[0]); });

function processFile(file) {
    if (file.size > MAX_FILE_SIZE) {
        showToast('error', '⚠️', `File terlalu besar (${fmtBytes(file.size)}). Maks. 4 MB.`);
        return;
    }
    const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
    const reader = new FileReader();
    reader.onload = e => {
        selectedFileData = { name: file.name, type: file.type, ext, size: file.size, base64: e.target.result };
        showFilePreview(selectedFileData);
        clearFieldError(fLink, errLink);
    };
    reader.onerror = () => showToast('error', '❌', 'Gagal membaca file.');
    reader.readAsDataURL(file);
}

function showFilePreview(fd) {
    if (filePrevIcon) filePrevIcon.textContent = fd.ext.toUpperCase() || 'FILE';
    if (filePrevName) filePrevName.textContent = fd.name;
    if (filePrevMeta) filePrevMeta.textContent = `${fd.ext.toUpperCase()} • ${fmtBytes(fd.size)}`;
    if (dropzone) dropzone.style.display = 'none';
    if (filePreview) filePreview.style.display = 'flex';
}

function resetFileUpload() {
    selectedFileData = null;
    if (fileInput) fileInput.value = '';
    if (dropzone) dropzone.style.display = 'block';
    if (filePreview) filePreview.style.display = 'none';
}
if (btnRemoveFile) btnRemoveFile.addEventListener('click', resetFileUpload);

/* ===================== VALIDATION & SUBMIT ===================== */
function clearErrors() {
    [fName, fSubject, fTitle, fLink].forEach(el => { if (el) el.classList.remove('input-error'); });
    [errName, errSubject, errTitle, errLink].forEach(el => { if (el) el.textContent = ''; });
}
function clearFieldError(field, errEl) { if (field) field.classList.remove('input-error'); if (errEl) errEl.textContent = ''; }
function setErr(field, errEl, msg) { if (field) field.classList.add('input-error'); if (errEl) errEl.textContent = msg; }

function validateForm() {
    clearErrors();
    let ok = true;
    if (!fName.value.trim()) { setErr(fName, errName, 'Nama tidak boleh kosong.'); ok = false; }
    if (!fSubject.value.trim()) { setErr(fSubject, errSubject, 'Mata pelajaran tidak boleh kosong.'); ok = false; }
    if (!fTitle.value.trim()) { setErr(fTitle, errTitle, 'Judul tugas tidak boleh kosong.'); ok = false; }

    if (submitMode === 'url') {
        if (!fLink.value.trim()) { setErr(fLink, errLink, 'Link tidak boleh kosong.'); ok = false; }
        else if (!isValidUrl(fLink.value.trim())) { setErr(fLink, errLink, 'Masukkan URL valid (http:// atau https://).'); ok = false; }
    } else {
        if (!selectedFileData) { if (errLink) errLink.textContent = 'Pilih file terlebih dahulu.'; ok = false; }
    }
    return ok;
}

if (form) {
    form.addEventListener('submit', e => {
        e.preventDefault();
        if (!validateForm()) { showToast('error', '⚠️', 'Harap lengkapi semua field bertanda *'); return; }

        const isEdit = !!editIdField.value;
        const now = new Date();
        const nowLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,16);
        const submitDate = (isEdit && fDate.value) ? fDate.value : nowLocal;
        const activeDeadline = fDeadline.value || getGlobalDeadline();

        // Save profile if remember checked
        if (chkRemember && chkRemember.checked) {
            localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: fName.value.trim(), classGroup: fClassGroup.value }));
            loadProfile();
        }

        const data = {
            name: fName.value.trim(),
            classGroup: fClassGroup.value,
            subject: fSubject.value.trim(),
            title: fTitle.value.trim(),
            assignmentId: selectAssignment ? selectAssignment.value : '',
            date: submitDate,
            deadline: activeDeadline,
            status: calcStatus(submitDate, activeDeadline),
            submitMode,
        };

        if (submitMode === 'url') {
            data.link = fLink.value.trim();
            data.fileName = null;
            data.fileData = null;
        } else {
            data.link = null;
            data.fileName = selectedFileData.name;
            data.fileExt  = selectedFileData.ext;
            data.fileSize = selectedFileData.size;
            data.fileData = selectedFileData.base64;
        }

        if (isEdit) {
            const idx = tasks.findIndex(t => t.id === editIdField.value);
            if (idx !== -1) tasks[idx] = { ...tasks[idx], ...data };
            cancelEdit();
            showToast('info', '✏️', 'Tugas berhasil diperbarui!');
        } else {
            data.id = genId();
            data.createdAt = new Date().toISOString();
            tasks.unshift(data);
            showToast('success', '✅', 'Tugas berhasil dikumpulkan!');
            openReceiptModal(data);
        }

        try {
            saveTasks();
            renderTasks();
            if (!isEdit) resetFormKeepProfile();
        } catch (err) {
            showToast('error', '⚠️', 'Penyimpanan penuh. Gunakan opsi link URL.');
        }
    });
}

function resetFormKeepProfile() {
    const savedProf = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    form.reset();
    if (savedProf.name) fName.value = savedProf.name;
    if (savedProf.classGroup) fClassGroup.value = savedProf.classGroup;
    resetFileUpload();
    if (selectAssignment) selectAssignment.value = '';
    if (assignmentDetailCard) assignmentDetailCard.style.display = 'none';
}

/* ===================== RECEIPT MODAL ===================== */
let currentReceiptText = '';

function openReceiptModal(data) {
    if (!receiptModalOverlay) return;
    rcptId.textContent = `#TF-${data.id.slice(-6).toUpperCase()}`;
    rcptName.textContent = data.name;
    rcptClass.textContent = data.classGroup || 'RPL 1';
    rcptSubject.textContent = data.subject;
    rcptTitle.textContent = data.title;
    rcptDate.textContent = fmtDateTime(data.date);
    
    if (data.status === 'tepat') {
        rcptStatus.innerHTML = '<span style="color:#059669;font-weight:800;">✓ Tepat Waktu</span>';
    } else {
        rcptStatus.innerHTML = '<span style="color:#dc2626;font-weight:800;">⏰ Terlambat</span>';
    }

    currentReceiptText = `BUKTI PENGUMPULAN TUGAS (TASKFLOW)\nNo. Resi: #TF-${data.id.slice(-6).toUpperCase()}\nNama: ${data.name} (${data.classGroup})\nMapel: ${data.subject}\nJudul: ${data.title}\nWaktu Kumpul: ${fmtDateTime(data.date)}\nStatus: ${data.status === 'tepat' ? 'Tepat Waktu' : 'Terlambat'}`;

    receiptModalOverlay.classList.add('show');
    receiptModalOverlay.setAttribute('aria-hidden', 'false');
}

if (btnCloseReceipt) {
    btnCloseReceipt.addEventListener('click', () => {
        receiptModalOverlay.classList.remove('show');
        receiptModalOverlay.setAttribute('aria-hidden', 'true');
    });
}

if (btnCopyReceipt) {
    btnCopyReceipt.addEventListener('click', () => {
        navigator.clipboard.writeText(currentReceiptText).then(() => {
            showToast('success', '📋', 'Ringkasan bukti berhasil disalin!');
        });
    });
}

/* ===================== RENDER TASK TABLE ===================== */
function renderTasks() {
    filterAndSortTasks();
    updateStats();

    if (!taskBody) return;
    if (filteredTasks.length === 0) {
        taskBody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        if (resultCount) resultCount.textContent = '0 tugas';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (resultCount) resultCount.textContent = `${filteredTasks.length} tugas`;

    taskBody.innerHTML = filteredTasks.map((t, index) => {
        const linkHtml = t.submitMode === 'file'
            ? `<a href="${t.fileData}" download="${escHtml(t.fileName)}" class="badge badge-file" title="Download ${escHtml(t.fileName)}">📎 ${escHtml(t.fileName)}</a>`
            : `<a href="${escHtml(t.link)}" target="_blank" rel="noopener" class="badge badge-link">🔗 Lihat Link</a>`;

        const statusBadge = t.status === 'tepat'
            ? `<span class="badge badge-tepat">✓ Tepat</span>`
            : `<span class="badge badge-terlambat">⏰ Terlambat</span>`;

        return `
            <tr>
                <td data-label="#">${index + 1}</td>
                <td data-label="Nama"><strong>${escHtml(t.name)}</strong> <span style="font-size:0.75rem;color:var(--text-muted);">(${escHtml(t.classGroup || 'RPL 1')})</span></td>
                <td data-label="Mata Pelajaran">${escHtml(t.subject)}</td>
                <td data-label="Judul Tugas">${escHtml(t.title)}</td>
                <td data-label="Link / File">${linkHtml}</td>
                <td data-label="Tgl Kumpul">${fmtDate(t.date)}</td>
                <td data-label="Deadline">${fmtDate(t.deadline)}</td>
                <td data-label="Status">${statusBadge}</td>
                <td data-label="Aksi">
                    <div class="action-group">
                        <button class="btn-action edit" onclick="editTask('${t.id}')" title="Edit Data">✏️</button>
                        <button class="btn-action delete" onclick="confirmDelete('${t.id}')" title="Hapus Data">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterAndSortTasks() {
    const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const st = filterStatus ? filterStatus.value : '';

    filteredTasks = tasks.filter(t => {
        const matchQ = !q || t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q) || t.title.toLowerCase().includes(q);
        const matchSt = !st || t.status === st;
        return matchQ && matchSt;
    });

    filteredTasks.sort((a,b) => (b.date || '').localeCompare(a.date || ''));
}

function updateStats() {
    const total     = tasks.length;
    const tepat     = tasks.filter(t => t.status === 'tepat').length;
    const terlambat = tasks.filter(t => t.status === 'terlambat').length;
    const unique    = new Set(tasks.map(t => t.name.toLowerCase())).size;

    if (statTotal) statTotal.textContent = total;
    if (statTepat) statTepat.textContent = tepat;
    if (statTerlambat) statTerlambat.textContent = terlambat;
    if (statSiswa) statSiswa.textContent = unique;
}

/* ===================== EDIT & DELETE ===================== */
window.editTask = function(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    editIdField.value = t.id;
    fName.value = t.name;
    if (fClassGroup) fClassGroup.value = t.classGroup || 'RPL 1';
    fSubject.value = t.subject;
    fTitle.value = t.title;
    fDate.value = t.date;
    fDeadline.value = t.deadline;

    if (t.submitMode === 'file' && t.fileData) {
        switchMode('file');
        selectedFileData = { name: t.fileName, ext: t.fileExt || 'file', size: t.fileSize || 0, base64: t.fileData };
        showFilePreview(selectedFileData);
    } else {
        switchMode('url');
        fLink.value = t.link || '';
    }

    btnLabel.textContent = 'Simpan Perubahan';
    btnCancel.style.display = 'inline-flex';
    form.scrollIntoView({ behavior: 'smooth' });
};

function cancelEdit() {
    editIdField.value = '';
    btnLabel.textContent = 'Kumpulkan Tugas';
    btnCancel.style.display = 'none';
    resetFormKeepProfile();
}
if (btnCancel) btnCancel.addEventListener('click', cancelEdit);

window.confirmDelete = function(id) {
    pendingDeleteId = id;
    if (modalMessage) modalMessage.textContent = 'Data pengumpulan tugas ini akan dihapus permanen.';
    if (modalOverlay) { modalOverlay.classList.add('show'); modalOverlay.setAttribute('aria-hidden', 'false'); }
};

if (btnConfirmDel) {
    btnConfirmDel.addEventListener('click', () => {
        if (pendingDeleteId) {
            tasks = tasks.filter(t => t.id !== pendingDeleteId);
            saveTasks();
            renderTasks();
            showToast('info', '🗑️', 'Tugas berhasil dihapus.');
            pendingDeleteId = null;
        }
        closeModal();
    });
}
if (btnCancelDel) btnCancelDel.addEventListener('click', closeModal);

function closeModal() {
    if (modalOverlay) { modalOverlay.classList.remove('show'); modalOverlay.setAttribute('aria-hidden', 'true'); }
}

if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
        if (tasks.length === 0) return;
        if (confirm('Apakah Anda yakin ingin menghapus seluruh riwayat pengumpulan tugas?')) {
            tasks = [];
            saveTasks();
            renderTasks();
            showToast('warning', '🗑️', 'Seluruh data tugas telah dibersihkan.');
        }
    });
}

/* ===================== SEARCH & FILTER EVENTS ===================== */
if (searchInput) searchInput.addEventListener('input', renderTasks);
if (btnClearSearch) btnClearSearch.addEventListener('click', () => { searchInput.value = ''; renderTasks(); });
if (filterStatus) filterStatus.addEventListener('change', renderTasks);

/* ===================== SIGNATURE DISPLAY ===================== */
function checkSignatureNotice() {
    const sig = localStorage.getItem('taskflow_mentor_signature');
    const noticeCard = document.getElementById('sigNoticeCard');
    const btnViewSig = document.getElementById('btnViewSig');
    const sigDisplayImg = document.getElementById('sigDisplayImg');
    const sigModalOverlay = document.getElementById('sigModalOverlay');
    const btnCloseSigModal = document.getElementById('btnCloseSigModal');

    if (sig && noticeCard) {
        noticeCard.style.display = 'flex';
        if (btnViewSig && sigDisplayImg) {
            btnViewSig.onclick = () => {
                sigDisplayImg.src = sig;
                if (sigModalOverlay) sigModalOverlay.classList.add('show');
            };
        }
        if (btnCloseSigModal && sigModalOverlay) {
            btnCloseSigModal.onclick = () => sigModalOverlay.classList.remove('show');
        }
    }
}

/* ===================== TOAST NOTIFICATION ===================== */
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

// Initial load
document.addEventListener('DOMContentLoaded', loadData);
