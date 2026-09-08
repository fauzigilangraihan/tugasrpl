/**
 * TaskFlow — script.js
 * Student form: CRUD localStorage, file upload (base64), URL, validasi, filter, sort, toast, modal
 */
'use strict';

const STORAGE_KEY = 'taskflow_tasks';
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

/* ===================== STATE ===================== */
let tasks           = [];
let filteredTasks   = [];
let pendingDeleteId = null;
let sortKey         = 'date';
let sortDir         = 'desc';
let submitMode      = 'url';   // 'url' | 'file'
let selectedFileData= null;    // { name, type, ext, size, base64, dataUrl }

/* ===================== DOM ===================== */
const form           = document.getElementById('taskForm');
const editIdField    = document.getElementById('editId');
const btnLabel       = document.getElementById('btnLabel');
const btnCancel      = document.getElementById('btnCancel');
const btnReset       = document.getElementById('btnReset');
const searchInput    = document.getElementById('searchInput');
const btnClearSearch = document.getElementById('btnClearSearch');
const filterStatus   = document.getElementById('filterStatus');
const btnClearAll    = document.getElementById('btnClearAll');
const taskBody       = document.getElementById('taskBody');
const taskTable      = document.getElementById('taskTable');
const emptyState     = document.getElementById('emptyState');
const resultCount    = document.getElementById('resultCount');
const toastContainer = document.getElementById('toastContainer');
const modalOverlay   = document.getElementById('modalOverlay');
const modalMessage   = document.getElementById('modalMessage');
const btnConfirmDel  = document.getElementById('btnConfirmDelete');
const btnCancelDel   = document.getElementById('btnCancelDelete');

// form fields
const fName     = document.getElementById('inputName');
const fSubject  = document.getElementById('inputSubject');
const fTitle    = document.getElementById('inputTitle');
const fLink     = document.getElementById('inputLink');
const fDate     = document.getElementById('inputDate');
const fDeadline = document.getElementById('inputDeadline');

// errors
const errName     = document.getElementById('errName');
const errSubject  = document.getElementById('errSubject');
const errTitle    = document.getElementById('errTitle');
const errLink     = document.getElementById('errLink');
const errDate     = document.getElementById('errDate');
const errDeadline = document.getElementById('errDeadline');

// stats
const statTotal     = document.getElementById('statTotal');
const statTepat     = document.getElementById('statTepat');
const statTerlambat = document.getElementById('statTerlambat');
const statSiswa     = document.getElementById('statSiswa');
const navBadge      = document.getElementById('navBadgeCount');

// file upload UI
const typeBtnUrl    = document.getElementById('typeBtnUrl');
const typeBtnFile   = document.getElementById('typeBtnFile');
const urlInputWrap  = document.getElementById('urlInputWrap');
const fileInputWrap = document.getElementById('fileInputWrap');
const dropzone      = document.getElementById('dropzone');
const fileInput     = document.getElementById('fileInput');
const filePreview   = document.getElementById('filePreview');
const filePrevIcon  = document.getElementById('filePrevIcon');
const filePrevName  = document.getElementById('filePrevName');
const filePrevMeta  = document.getElementById('filePrevMeta');
const btnRemoveFile = document.getElementById('btnRemoveFile');

/* ===================== STORAGE ===================== */
function loadTasks() { try { tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { tasks = []; } }
function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }

/* ===================== UTILITIES ===================== */
function genId()    { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function fmtDate(d) { if(!d) return '—'; const [y,m,dy]=d.split('-'); return `${dy}/${m}/${y}`; }
function calcStatus(date, deadline) { return (!date||!deadline) ? 'unknown' : date<=deadline ? 'tepat' : 'terlambat'; }
function isValidUrl(s) { try { const u=new URL(s); return u.protocol==='http:'||u.protocol==='https:'; } catch{ return false; } }
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function fmtBytes(b) { if(b<1024) return b+'B'; if(b<1024*1024) return (b/1024).toFixed(1)+' KB'; return (b/(1024*1024)).toFixed(2)+' MB'; }

/* ---- File type helpers ---- */
const FILE_TYPES = {
    pdf:  { icon:'', label:'PDF',   cls:'ftype-pdf'  },
    doc:  { icon:'', label:'DOC',   cls:'ftype-doc'  },
    docx: { icon:'', label:'DOCX',  cls:'ftype-doc'  },
    xls:  { icon:'', label:'XLS',   cls:'ftype-xls'  },
    xlsx: { icon:'', label:'XLSX',  cls:'ftype-xls'  },
    ppt:  { icon:'', label:'PPT',   cls:'ftype-ppt'  },
    pptx: { icon:'', label:'PPTX',  cls:'ftype-ppt'  },
    txt:  { icon:'', label:'TXT',   cls:'ftype-txt'  },
    csv:  { icon:'', label:'CSV',   cls:'ftype-xls'  },
    zip:  { icon:'', label:'ZIP',   cls:'ftype-zip'  },
    rar:  { icon:'', label:'RAR',   cls:'ftype-zip'  },
    '7z': { icon:'', label:'7Z',    cls:'ftype-zip'  },
    jpg:  { icon:'', label:'JPG',   cls:'ftype-img'  },
    jpeg: { icon:'', label:'JPEG',  cls:'ftype-img'  },
    png:  { icon:'', label:'PNG',   cls:'ftype-img'  },
    gif:  { icon:'', label:'GIF',   cls:'ftype-img'  },
    webp: { icon:'', label:'WEBP',  cls:'ftype-img'  },
    svg:  { icon:'', label:'SVG',   cls:'ftype-img'  },
};
function getFileType(ext='') { return FILE_TYPES[ext.toLowerCase()] || { icon:'', label:ext.toUpperCase()||'FILE', cls:'ftype-other' }; }
function extOf(name='') { return name.includes('.') ? name.split('.').pop().toLowerCase() : ''; }

/* ===================== SUBMIT MODE TOGGLE ===================== */
typeBtnUrl.addEventListener('click', () => switchMode('url'));
typeBtnFile.addEventListener('click', () => switchMode('file'));

function switchMode(mode) {
    submitMode = mode;
    typeBtnUrl.classList.toggle('active', mode==='url');
    typeBtnFile.classList.toggle('active', mode==='file');
    urlInputWrap.style.display  = mode==='url'  ? 'block' : 'none';
    fileInputWrap.style.display = mode==='file' ? 'block' : 'none';
    clearFieldError(fLink, errLink);
}

/* ===================== DROPZONE ===================== */
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => { if(e.target.files[0]) processFile(e.target.files[0]); });

// Drag & drop
dropzone.addEventListener('dragover',  e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', e => { dropzone.classList.remove('drag-over'); });
dropzone.addEventListener('drop',      e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if(file) processFile(file);
});

function processFile(file) {
    if(file.size > MAX_FILE_SIZE) {
        showToast('error','⚠️',`File terlalu besar (${fmtBytes(file.size)}). Maksimum 4 MB.`);
        return;
    }
    const ext = extOf(file.name);
    const reader = new FileReader();
    reader.onload = e => {
        const base64 = e.target.result;
        selectedFileData = { name: file.name, type: file.type, ext, size: file.size, base64 };
        showFilePreview(selectedFileData);
        clearFieldError(fLink, errLink);
    };
    reader.onerror = () => showToast('error','❌','Gagal membaca file.');
    reader.readAsDataURL(file); // stores as base64 data URL
}

function showFilePreview(fd) {
    const ft = getFileType(fd.ext);
    filePrevIcon.textContent = ft.icon;
    filePrevName.textContent = fd.name;
    filePrevMeta.textContent = `${ft.label} • ${fmtBytes(fd.size)}`;
    dropzone.style.display  = 'none';
    filePreview.style.display = 'flex';
}

function resetFileUpload() {
    selectedFileData = null;
    fileInput.value  = '';
    dropzone.style.display  = 'block';
    filePreview.style.display = 'none';
}

btnRemoveFile.addEventListener('click', resetFileUpload);

/* ===================== VALIDATION ===================== */
function clearErrors() {
    [fName,fSubject,fTitle,fLink,fDate,fDeadline].forEach(el => el.classList.remove('input-error'));
    [errName,errSubject,errTitle,errLink,errDate,errDeadline].forEach(el => el.textContent='');
}
function clearFieldError(field, errEl) { field.classList.remove('input-error'); errEl.textContent=''; }
function setErr(field, errEl, msg) { field.classList.add('input-error'); errEl.textContent = msg; }

function validateForm() {
    clearErrors();
    let ok = true;
    if(!fName.value.trim())    { setErr(fName,errName,'Nama tidak boleh kosong.'); ok=false; }
    if(!fSubject.value.trim()) { setErr(fSubject,errSubject,'Mata pelajaran tidak boleh kosong.'); ok=false; }
    if(!fTitle.value.trim())   { setErr(fTitle,errTitle,'Judul tugas tidak boleh kosong.'); ok=false; }

    if(submitMode==='url') {
        if(!fLink.value.trim())          { setErr(fLink,errLink,'Link tidak boleh kosong.'); ok=false; }
        else if(!isValidUrl(fLink.value.trim())) { setErr(fLink,errLink,'Masukkan URL valid (awali dengan https://).'); ok=false; }
    } else {
        if(!selectedFileData)            { errLink.textContent='Pilih file terlebih dahulu.'; ok=false; }
    }

    if(!fDate.value)     { setErr(fDate,errDate,'Tanggal pengumpulan tidak boleh kosong.'); ok=false; }
    if(!fDeadline.value) { setErr(fDeadline,errDeadline,'Deadline tidak boleh kosong.'); ok=false; }
    return ok;
}

/* ===================== FORM SUBMIT ===================== */
form.addEventListener('submit', e => {
    e.preventDefault();
    if(!validateForm()) { showToast('error','⚠️','Harap lengkapi semua field yang wajib diisi.'); return; }

    const isEdit = !!editIdField.value;
    const data = {
        name:     fName.value.trim(),
        subject:  fSubject.value.trim(),
        title:    fTitle.value.trim(),
        date:     fDate.value,
        deadline: fDeadline.value,
        status:   calcStatus(fDate.value, fDeadline.value),
        submitMode,
    };

    if(submitMode === 'url') {
        data.link     = fLink.value.trim();
        data.fileName = null;
        data.fileExt  = null;
        data.fileSize = null;
        data.fileData = null;  // no binary storage for URL mode
    } else {
        data.link     = null;
        data.fileName = selectedFileData.name;
        data.fileExt  = selectedFileData.ext;
        data.fileSize = selectedFileData.size;
        data.fileData = selectedFileData.base64; // data URL (base64)
    }

    if(isEdit) {
        const idx = tasks.findIndex(t=>t.id===editIdField.value);
        if(idx!==-1) tasks[idx] = {...tasks[idx], ...data};
        cancelEdit();
        showToast('info','✏️','Tugas berhasil diperbarui!');
    } else {
        data.id = genId();
        data.createdAt = new Date().toISOString();
        tasks.unshift(data);
        showToast('success','✅','Tugas berhasil dikumpulkan!');
    }

    try {
        saveTasks();
    } catch(err) {
        // localStorage quota exceeded (file too large)
        if(err.name==='QuotaExceededError' || err.code===22) {
            showToast('error','⚠️','Penyimpanan browser penuh. File terlalu besar, gunakan link URL saja.');
            tasks.shift(); // rollback
            return;
        }
    }

    form.reset();
    resetFileUpload();
    switchMode('url');
    applyFilters();
    updateStats();

    // Notify same-tab admin by dispatching a storage event manually
    // (native storage event doesn't fire in the same tab)
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));

    // Scroll to task list safely
    const listEl = document.querySelector('.card[style], #taskTable')?.closest?.('.card') || document.querySelector('.list-section');
    if(listEl) listEl.scrollIntoView({behavior:'smooth', block:'start'});
});

btnReset.addEventListener('click', () => { clearErrors(); cancelEdit(); resetFileUpload(); switchMode('url'); });

/* ===================== EDIT ===================== */
function startEdit(id) {
    const t = tasks.find(x=>x.id===id); if(!t) return;
    editIdField.value = id;
    fName.value    = t.name;
    fSubject.value = t.subject;
    fTitle.value   = t.title;
    fDate.value    = t.date;
    fDeadline.value= t.deadline;

    if(t.submitMode==='file' && t.fileData) {
        switchMode('file');
        selectedFileData = { name:t.fileName, type:'', ext:t.fileExt, size:t.fileSize, base64:t.fileData };
        showFilePreview(selectedFileData);
    } else {
        switchMode('url');
        fLink.value = t.link || '';
    }

    btnLabel.textContent = 'Simpan Perubahan';
    btnCancel.style.display = 'inline-flex';
    document.querySelector('.form-section').scrollIntoView({behavior:'smooth',block:'start'});
    fName.focus();
}

function cancelEdit() {
    editIdField.value = '';
    btnLabel.textContent = 'Kumpulkan Tugas';
    btnCancel.style.display = 'none';
    clearErrors();
}
btnCancel.addEventListener('click', () => { cancelEdit(); form.reset(); resetFileUpload(); switchMode('url'); });

/* ===================== DELETE ===================== */
function openDeleteModal(id, all=false) {
    pendingDeleteId = all ? '__ALL__' : id;
    modalMessage.textContent = all
        ? 'Semua tugas akan dihapus permanen. Tindakan ini tidak bisa dibatalkan!'
        : 'Data tugas ini akan dihapus permanen dan tidak dapat dikembalikan.';
    modalOverlay.classList.add('active');
}
function closeModal() { modalOverlay.classList.remove('active'); pendingDeleteId=null; }
btnCancelDel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if(e.target===modalOverlay) closeModal(); });
btnConfirmDel.addEventListener('click', () => {
    if(pendingDeleteId==='__ALL__') { tasks=[]; showToast('error','🗑','Semua tugas telah dihapus.'); }
    else if(pendingDeleteId) { tasks=tasks.filter(t=>t.id!==pendingDeleteId); showToast('error','🗑','Tugas telah dihapus.'); }
    saveTasks(); closeModal(); applyFilters(); updateStats();
});
btnClearAll.addEventListener('click', () => { if(tasks.length===0){showToast('info','ℹ️','Tidak ada tugas.');return;} openDeleteModal(null,true); });

/* ===================== SEARCH & FILTER ===================== */
searchInput.addEventListener('input', () => { btnClearSearch.style.display=searchInput.value?'block':'none'; applyFilters(); });
btnClearSearch.addEventListener('click', () => { searchInput.value=''; btnClearSearch.style.display='none'; applyFilters(); });
filterStatus.addEventListener('change', applyFilters);

function applyFilters() {
    const q  = searchInput.value.toLowerCase().trim();
    const st = filterStatus.value;
    filteredTasks = tasks.filter(t => {
        const mQ = !q || t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q) || (t.title||'').toLowerCase().includes(q);
        const mS = !st || t.status===st;
        return mQ && mS;
    });
    sortData(); renderTable();
}

/* ===================== SORT ===================== */
function sortData() {
    filteredTasks.sort((a,b)=>{
        let va=a[sortKey]||'', vb=b[sortKey]||'';
        return sortDir==='asc' ? (va>vb?1:-1) : (va<vb?1:-1);
    });
}
document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if(sortKey===key) sortDir=sortDir==='asc'?'desc':'asc';
        else { sortKey=key; sortDir='asc'; }
        document.querySelectorAll('th[data-sort]').forEach(t=>t.classList.remove('sort-asc','sort-desc'));
        th.classList.add(sortDir==='asc'?'sort-asc':'sort-desc');
        sortData(); renderTable();
    });
});

/* ===================== RENDER TABLE ===================== */
function renderFileCell(t) {
    if(t.submitMode==='file' && t.fileData) {
        const ft = getFileType(t.fileExt);
        return `<button class="task-link" style="background:none;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:.3rem;" onclick="downloadFile('${escHtml(t.id)}')" title="Download ${escHtml(t.fileName)}">
            <span class="file-type-badge ${ft.cls}">${ft.label}</span>
            <span style="font-size:.72rem;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(t.fileName)}</span>
        </button>`;
    }
    return `<a href="${escHtml(t.link)}" target="_blank" rel="noopener" class="task-link">
        <span class="file-type-badge ftype-link">URL</span>
    </a>`;
}

function renderTable() {
    taskBody.innerHTML='';
    resultCount.textContent=`${filteredTasks.length} tugas`;
    if(filteredTasks.length===0) { emptyState.style.display='block'; taskTable.style.display='none'; return; }
    emptyState.style.display='none'; taskTable.style.display='table';

    filteredTasks.forEach((t,i) => {
        const badge = t.status==='tepat'
            ? `<span class="badge badge-tepat">Tepat Waktu</span>`
            : `<span class="badge badge-terlambat">Terlambat</span>`;
        const tr = document.createElement('tr');
        tr.innerHTML=`
            <td class="row-num">${i+1}</td>
            <td><strong>${escHtml(t.name)}</strong></td>
            <td>${escHtml(t.subject)}</td>
            <td title="${escHtml(t.title)}">${escHtml(t.title.length>38?t.title.slice(0,38)+'…':t.title)}</td>
            <td>${renderFileCell(t)}</td>
            <td>${fmtDate(t.date)}</td>
            <td>${fmtDate(t.deadline)}</td>
            <td>${badge}</td>
            <td><div class="action-group">
                <button class="btn-edit" data-id="${t.id}">Edit</button>
                <button class="btn-delete" data-id="${t.id}">Hapus</button>
            </div></td>`;
        tr.style.opacity='0'; tr.style.transform='translateY(6px)';
        taskBody.appendChild(tr);
        requestAnimationFrame(()=>{ tr.style.transition=`opacity .25s ease ${i*.03}s,transform .25s ease ${i*.03}s`; tr.style.opacity='1'; tr.style.transform='translateY(0)'; });
    });
}

taskBody.addEventListener('click', e => {
    const ed=e.target.closest('.btn-edit');   if(ed) startEdit(ed.dataset.id);
    const dl=e.target.closest('.btn-delete'); if(dl) openDeleteModal(dl.dataset.id);
});

/* ===================== FILE DOWNLOAD ===================== */
window.downloadFile = function(id) {
    const t = tasks.find(x=>x.id===id);
    if(!t||!t.fileData) return;
    const a = document.createElement('a');
    a.href = t.fileData;
    a.download = t.fileName || 'file';
    a.click();
};

/* ===================== STATS ===================== */
function updateStats() {
    const total    = tasks.length;
    const tepat    = tasks.filter(t=>t.status==='tepat').length;
    const terlambat= tasks.filter(t=>t.status==='terlambat').length;
    const unique   = new Set(tasks.map(t=>t.name.toLowerCase())).size;
    animCount(statTotal,     total);
    animCount(statTepat,     tepat);
    animCount(statTerlambat, terlambat);
    animCount(statSiswa,     unique);
    if(navBadge) navBadge.textContent = total;
}
function animCount(el, target) {
    if(!el) return;
    const start=parseInt(el.textContent)||0; if(start===target) return;
    const dur=500, t0=performance.now();
    const tick=now=>{const p=Math.min((now-t0)/dur,1); el.textContent=Math.round(start+(target-start)*(1-Math.pow(1-p,3))); if(p<1) requestAnimationFrame(tick);};
    requestAnimationFrame(tick);
}

/* ===================== TOAST ===================== */
function showToast(type, icon, msg) {
    const t=document.createElement('div');
    t.className=`toast toast-${type}`;
    const iconHtml = icon ? `<span class="toast-icon">${icon}</span>` : '';
    t.innerHTML=`${iconHtml}<span>${msg}</span>`;
    toastContainer.appendChild(t);
    setTimeout(()=>{ t.classList.add('hide'); t.addEventListener('animationend',()=>t.remove(),{once:true}); }, 3500);
}

/* ===================== INIT ===================== */
(function init(){
    loadTasks();
    const today=new Date().toISOString().split('T')[0];
    if(!fDate.value) fDate.value=today;
    applyFilters();
    updateStats();
    initSigDisplay();
    initSecretAdmin();
})();

/* ===================== SIGNATURE DISPLAY (STUDENT) ===================== */
const SIG_KEY = 'taskflow_signature';

function initSigDisplay() {
    const noticeCard    = document.getElementById('sigNoticeCard');
    const btnViewSig    = document.getElementById('btnViewSig');
    const sigModalOv    = document.getElementById('sigModalOverlay');
    const sigDisplayImg = document.getElementById('sigDisplayImg');
    const btnCloseSig   = document.getElementById('btnCloseSigModal');
    if(!noticeCard) return;

    function loadSig() {
        const sig = localStorage.getItem(SIG_KEY);
        if(sig) {
            noticeCard.style.display = 'flex';
            if(sigDisplayImg) sigDisplayImg.src = sig;
        } else {
            noticeCard.style.display = 'none';
        }
    }
    loadSig();

    // Poll for signature changes (cross-tab via storage event)
    window.addEventListener('storage', e => { if(e.key===SIG_KEY) loadSig(); });

    if(btnViewSig) btnViewSig.addEventListener('click', () => {
        sigModalOv.classList.add('active');
        sigModalOv.setAttribute('aria-hidden','false');
    });
    if(btnCloseSig) btnCloseSig.addEventListener('click', () => {
        sigModalOv.classList.remove('active');
        sigModalOv.setAttribute('aria-hidden','true');
    });
    if(sigModalOv) sigModalOv.addEventListener('click', e => {
        if(e.target===sigModalOv) { sigModalOv.classList.remove('active'); }
    });
}

/* ===================== SECRET ADMIN ACCESS ===================== */
function initSecretAdmin() {
    // 1. Direct Secret Button in Top Nav (discreet icon)
    const secretBtn = document.getElementById('secretAdminBtn');
    if (secretBtn) {
        secretBtn.addEventListener('click', () => {
            showToast('info', '', 'Mengalihkan ke Halaman Admin...');
        });
    }

    // 2. Secret Multi-Click Trigger: Click Mentor avatar or chip 5 times rapidly
    const mentorTarget = document.querySelector('.mentor-chip') || document.querySelector('.mentor-avatar');
    if (mentorTarget) {
        let clickCount = 0;
        let clickTimer = null;
        mentorTarget.style.cursor = 'pointer';

        mentorTarget.addEventListener('click', () => {
            clickCount++;
            clearTimeout(clickTimer);

            if (clickCount >= 5) {
                clickCount = 0;
                showToast('info', '', 'Akses Rahasia Admin Terbuka!');
                setTimeout(() => { window.location.href = 'admin.html'; }, 500);
            } else if (clickCount >= 3) {
                // Subtle hint for mentor
                showToast('info', '', `Klik ${5 - clickCount}x lagi untuk Admin`);
                clickTimer = setTimeout(() => { clickCount = 0; }, 2500);
            } else {
                clickTimer = setTimeout(() => { clickCount = 0; }, 2000);
            }
        });
    }

    // 3. Secret Keyboard Shortcut: Ctrl + Shift + A or Alt + A
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') || (e.altKey && e.key.toLowerCase() === 'a')) {
            e.preventDefault();
            showToast('info', '', 'Akses Rahasia: Mengalihkan ke Admin...');
            setTimeout(() => { window.location.href = 'admin.html'; }, 400);
        }
    });
}


