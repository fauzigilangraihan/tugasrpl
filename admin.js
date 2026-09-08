/**
 * TaskFlow — admin.js
 * Admin Dashboard: stats, charts, student management, full CRUD, CSV export, print
 */
'use strict';

const STORAGE_KEY  = 'taskflow_tasks';
const STUDENT_KEY  = 'taskflow_students';
const CIRC         = 2 * Math.PI * 45;

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

/* ===================== STATE ===================== */
let tasks           = [];
let students        = [];   // registered students list
let filteredAdmin   = [];
let adminSortKey    = 'createdAt';
let adminSortDir    = 'desc';
let selectedIds     = new Set();
let pendingAction   = null; // { type: 'single'|'selected'|'all', ids:[] }

/* ===================== DOM ===================== */
const adminBody         = document.getElementById('adminBody');
const adminTable        = document.getElementById('adminTable');
const adminEmpty        = document.getElementById('adminEmpty');
const adminSearch       = document.getElementById('adminSearch');
const adminClearSearch  = document.getElementById('adminClearSearch');
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
const activityList      = document.getElementById('activityList');
const barChart          = document.getElementById('barChart');
const subjectRecap      = document.getElementById('subjectRecap');
const studentList       = document.getElementById('studentList');
const regName           = document.getElementById('regName');
const regSubject        = document.getElementById('regSubject');
const btnAddStudent     = document.getElementById('btnAddStudent');
const modalOverlay      = document.getElementById('modalOverlay');
const modalMessage      = document.getElementById('modalMessage');
const modalTitle        = document.getElementById('modalTitle');
const btnConfirmDel     = document.getElementById('btnConfirmDelete');
const btnCancelDel      = document.getElementById('btnCancelDelete');
const toastContainer    = document.getElementById('toastContainer');
const headerDate        = document.getElementById('headerDate');
const headerTime        = document.getElementById('headerTime');

/* ===================== STORAGE ===================== */
function loadTasks()    { try { tasks    = JSON.parse(localStorage.getItem(STORAGE_KEY))  || []; } catch { tasks=[]; } }
function saveTasks()    { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
function loadStudents() { try { students = JSON.parse(localStorage.getItem(STUDENT_KEY)) || []; } catch { students=[]; } }
function saveStudents() { localStorage.setItem(STUDENT_KEY, JSON.stringify(students)); }

/* ===================== UTILITIES ===================== */
function genId()      { return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function fmtDate(d)   {
    if(!d) return '—';
    const dt = new Date(d);
    if(isNaN(dt)) {
        const [y,m,dy]=d.split('-');
        return `${dy}/${m}/${y}`;
    }
    const pad = n => String(n).padStart(2,'0');
    return `${pad(dt.getDate())}/${pad(dt.getMonth()+1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
function fmtDateTime(iso) {
    if(!iso) return '—';
    const d=new Date(iso);
    return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) + ' ' +
           d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}
function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function initials(name) { return name.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase() || '?'; }
function calcStatus(date,deadline){ return (!date||!deadline)?'unknown': date<=deadline?'tepat':'terlambat'; }

/* ===================== CLOCK ===================== */
function updateClock() {
    const now = new Date();
    headerDate.textContent = now.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    headerTime.textContent = now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

/* ===================== STATS ===================== */
function updateStats() {
    const total     = tasks.length;
    const tepat     = tasks.filter(t=>t.status==='tepat').length;
    const terlambat = tasks.filter(t=>t.status==='terlambat').length;
    const unique    = new Set(tasks.map(t=>t.name.toLowerCase())).size;

    animCount(document.getElementById('statTotal'),     total);
    animCount(document.getElementById('statTepat'),     tepat);
    animCount(document.getElementById('statTerlambat'), terlambat);
    animCount(document.getElementById('statSiswa'),     unique);

    // Trend labels
    document.getElementById('trendTotal').textContent     = total > 0 ? `📈 ${total} tugas terkumpul` : '';
    document.getElementById('trendTepat').textContent     = total > 0 ? `${Math.round(tepat/total*100)}% dari total` : '';
    document.getElementById('trendTerlambat').textContent = terlambat > 0 ? `${Math.round(terlambat/total*100)}% dari total` : '';

    updateDonut(tepat, terlambat, total);
    updateSubjectFilter();
    updateBarChart();
    updateRecap();
    updateStudentList();
    updateActivity();
}

function animCount(el, target) {
    if(!el) return;
    const start=parseInt(el.textContent)||0;
    if(start===target) return;
    const dur=600, t0=performance.now();
    const tick=now=>{ const p=Math.min((now-t0)/dur,1); el.textContent=Math.round(start+(target-start)*(1-Math.pow(1-p,3))); if(p<1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
}

/* ===================== DONUT CHART ===================== */
function updateDonut(tepat, terlambat, total) {
    const pct = total > 0 ? Math.round(tepat/total*100) : 0;
    const tepatArc = total > 0 ? (tepat/total)*CIRC : 0;
    const terlambatArc = total > 0 ? (terlambat/total)*CIRC : 0;

    const dTepat = document.querySelector('.donut-tepat');
    const dTerlambat = document.querySelector('.donut-terlambat');
    const dCenter = document.getElementById('donutCenter');
    const tepatBar = document.getElementById('tepatBar');
    const progressPct = document.querySelector('.progress-label span:first-child');

    dTepat.setAttribute('stroke-dasharray', `${tepatArc} ${CIRC-tepatArc}`);
    // Terlambat starts after tepat on the circle
    dTerlambat.setAttribute('stroke-dasharray', `${terlambatArc} ${CIRC-terlambatArc}`);
    dTerlambat.style.transform = `rotate(${(tepat/total)*360-90||(-90)}deg)`;
    dTerlambat.style.transformOrigin = '60px 60px';

    dCenter.textContent = `${pct}%`;

    document.getElementById('legTepat').textContent = `${tepat} (${pct}%)`;
    document.getElementById('legTerlambat').textContent = `${terlambat} (${total>0?Math.round(terlambat/total*100):0}%)`;
    document.getElementById('legTotal').textContent = total;

    if(tepatBar) tepatBar.style.width = `${pct}%`;
    if(progressPct) progressPct.textContent = `${pct}% tepat waktu`;
    document.getElementById('progressPct').textContent = `${pct}%`;
}

/* ===================== BAR CHART ===================== */
function updateBarChart() {
    const map = {};
    tasks.forEach(t => { map[t.subject] = (map[t.subject]||0)+1; });
    const entries = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const max = entries.length > 0 ? entries[0][1] : 1;

    if(entries.length===0) {
        barChart.innerHTML='<div class="empty-state" style="padding:1.5rem 0;"><p>Tidak ada data.</p></div>';
        return;
    }
    barChart.innerHTML = entries.map(([subj,count])=>`
        <div class="bar-item">
            <span class="bar-label" title="${escHtml(subj)}">${escHtml(subj.length>22?subj.slice(0,22)+'…':subj)}</span>
            <div class="bar-track">
                <div class="bar-fill" style="width:${Math.round(count/max*100)}%"></div>
            </div>
            <span class="bar-value">${count}</span>
        </div>`).join('');
}

/* ===================== SUBJECT FILTER DROPDOWN ===================== */
function updateSubjectFilter() {
    const subjects = [...new Set(tasks.map(t=>t.subject))].sort();
    const current  = adminFilterSub.value;
    adminFilterSub.innerHTML = '<option value="">Semua Mata Pelajaran</option>' +
        subjects.map(s=>`<option value="${escHtml(s)}" ${s===current?'selected':''}>${escHtml(s)}</option>`).join('');
}

/* ===================== RECAP PER SUBJECT ===================== */
function updateRecap() {
    const map = {};
    tasks.forEach(t => {
        if(!map[t.subject]) map[t.subject]={total:0,tepat:0,terlambat:0};
        map[t.subject].total++;
        if(t.status==='tepat') map[t.subject].tepat++;
        else map[t.subject].terlambat++;
    });
    const entries = Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
    if(entries.length===0) {
        subjectRecap.innerHTML='<div class="empty-state" style="padding:1.5rem 0;"><p>Tidak ada data.</p></div>';
        return;
    }
    subjectRecap.innerHTML = entries.map(([subj,d])=>{
        const pct = Math.round(d.tepat/d.total*100);
        return `<div style="margin-bottom:.9rem;">
            <div style="display:flex;justify-content:space-between;margin-bottom:.35rem;">
                <span style="font-size:.82rem;font-weight:600;color:var(--text-primary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(subj)}">${escHtml(subj)}</span>
                <span style="font-size:.78rem;color:var(--text-muted);">${d.tepat}/${d.total} tepat (${pct}%)</span>
            </div>
            <div class="progress-bar-wrap">
                <div class="progress-bar-fill" style="width:${pct}%"></div>
            </div>
        </div>`;
    }).join('');
}

/* ===================== ACTIVITY FEED ===================== */
function updateActivity() {
    const recent = [...tasks].sort((a,b)=>(b.createdAt||'')>(a.createdAt||'')?1:-1).slice(0,10);
    if(recent.length===0) {
        activityList.innerHTML='<div class="empty-state" style="padding:2rem 0;"><div class="empty-icon">📭</div><p>Belum ada aktivitas.</p></div>';
        return;
    }
    activityList.innerHTML = recent.map(t => {
        const badge = t.status==='tepat'
            ? `<span class="badge badge-tepat" style="font-size:.65rem;">✓ Tepat</span>`
            : `<span class="badge badge-terlambat" style="font-size:.65rem;">⏰ Terlambat</span>`;
        return `
        <div class="activity-item">
            <div class="act-avatar">${escHtml(initials(t.name))}</div>
            <div class="act-body">
                <div class="act-title">${escHtml(t.name)}</div>
                <div class="act-sub">${escHtml(t.subject)} — ${escHtml(t.title.length>40?t.title.slice(0,40)+'…':t.title)} ${badge}</div>
                <div class="act-time">${fmtDateTime(t.createdAt)}</div>
            </div>
        </div>`;
    }).join('');
}

/* ===================== STUDENT MANAGEMENT ===================== */
btnAddStudent.addEventListener('click', addStudent);
regName.addEventListener('keydown', e => { if(e.key==='Enter') addStudent(); });
regSubject.addEventListener('keydown', e => { if(e.key==='Enter') addStudent(); });

function addStudent() {
    const name    = regName.value.trim();
    const subject = regSubject.value.trim();
    if(!name) { showToast('error','⚠️','Nama siswa tidak boleh kosong.'); regName.focus(); return; }
    if(!subject) { showToast('error','⚠️','Mata pelajaran tidak boleh kosong.'); regSubject.focus(); return; }
    const dup = students.find(s=>s.name.toLowerCase()===name.toLowerCase()&&s.subject.toLowerCase()===subject.toLowerCase());
    if(dup) { showToast('info','ℹ️','Siswa ini sudah terdaftar.'); return; }
    students.push({ id:genId(), name, subject });
    saveStudents();
    regName.value=''; regSubject.value='';
    updateStudentList();
    showToast('success','✅',`Siswa "${name}" berhasil ditambahkan.`);
}

function removeStudent(id) {
    students = students.filter(s=>s.id!==id);
    saveStudents();
    updateStudentList();
    showToast('error','🗑','Siswa dihapus dari daftar.');
}

function updateStudentList() {
    if(students.length===0) {
        studentList.innerHTML=`<div class="empty-state" style="padding:1.5rem 0;">
            <div class="empty-icon" style="font-size:2rem;">👤</div>
            <p>Belum ada siswa terdaftar.</p>
            <p class="empty-sub">Tambah nama siswa di atas untuk memantau status pengumpulan.</p>
        </div>`;
        return;
    }
    studentList.innerHTML = students.map(s => {
        // check if this student has submitted for this subject
        const submitted = tasks.find(t=>t.name.toLowerCase()===s.name.toLowerCase()&&t.subject.toLowerCase()===s.subject.toLowerCase());
        let pill, statusIcon;
        if(submitted) {
            if(submitted.status==='tepat') {
                pill='<span class="pill-submitted">✓ Tepat Waktu</span>';
                statusIcon='✅';
            } else {
                pill='<span class="pill-late">⏰ Terlambat</span>';
                statusIcon='⏰';
            }
        } else {
            pill='<span class="pill-notsubmit">✗ Belum Kumpul</span>';
            statusIcon='❌';
        }
        return `
        <div class="student-item">
            <div class="student-avatar">${escHtml(initials(s.name))}</div>
            <div style="flex:1;min-width:0;">
                <div class="student-name">${escHtml(s.name)}</div>
                <div class="student-subject">${escHtml(s.subject)}</div>
            </div>
            ${pill}
            <button onclick="removeStudent('${s.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1rem;padding:.2rem .4rem;border-radius:4px;transition:color .2s;" title="Hapus dari daftar" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-muted)'">✕</button>
        </div>`;
    }).join('');
}

/* ===================== ADMIN TABLE ===================== */
function renderAdminFileCell(t) {
    if(t.submitMode==='file' && t.fileData) {
        const ft = getFileType(t.fileExt||'');
        const shortName = (t.fileName||'file').length>20 ? (t.fileName).slice(0,20)+'…' : (t.fileName||'file');
        return `<button onclick="adminDownloadFile('${escHtml(t.id)}')"
            style="background:none;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:.3rem;padding:0;"
            title="Download ${escHtml(t.fileName)}">
            <span class="file-type-badge ${ft.cls}">${ft.icon} ${ft.label}</span>
            <span style="font-size:.72rem;color:var(--text-secondary);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(shortName)}</span>
        </button>`;
    }
    const link = t.link || '';
    return `<a href="${escHtml(link)}" target="_blank" rel="noopener" class="task-link">
        <span class="file-type-badge ftype-link">🔗 URL</span>
    </a>`;
}

window.adminDownloadFile = function(id) {
    const t = tasks.find(x=>x.id===id);
    if(!t||!t.fileData) return;
    const a=document.createElement('a'); a.href=t.fileData; a.download=t.fileName||'file'; a.click();
};

function applyAdminFilters() {
    const q   = adminSearch.value.toLowerCase().trim();
    const sub = adminFilterSub.value;
    const st  = adminFilterStatus.value;
    filteredAdmin = tasks.filter(t=>{
        const mQ = !q || t.name.toLowerCase().includes(q)||t.subject.toLowerCase().includes(q)||t.title.toLowerCase().includes(q);
        const mS = !sub || t.subject===sub;
        const mT = !st  || t.status===st;
        return mQ&&mS&&mT;
    });
    sortAdminData();
    renderAdminTable();
}

function sortAdminData() {
    filteredAdmin.sort((a,b)=>{
        let va=a[adminSortKey]||'', vb=b[adminSortKey]||'';
        return adminSortDir==='asc' ? (va>vb?1:-1) : (va<vb?1:-1);
    });
}

document.querySelectorAll('#adminTable th[data-sort]').forEach(th=>{
    th.addEventListener('click',()=>{
        const key=th.dataset.sort;
        if(adminSortKey===key){ adminSortDir=adminSortDir==='asc'?'desc':'asc'; }
        else { adminSortKey=key; adminSortDir='asc'; }
        document.querySelectorAll('#adminTable th[data-sort]').forEach(t=>t.classList.remove('sort-asc','sort-desc'));
        th.classList.add(adminSortDir==='asc'?'sort-asc':'sort-desc');
        sortAdminData(); renderAdminTable();
    });
});

function renderAdminTable() {
    adminBody.innerHTML='';
    adminResultCount.textContent=`${filteredAdmin.length} tugas`;

    if(filteredAdmin.length===0) {
        adminEmpty.style.display='block';
        adminTable.style.display='none';
        return;
    }
    adminEmpty.style.display='none';
    adminTable.style.display='table';

    filteredAdmin.forEach((t,i)=>{
        const badge = t.status==='tepat'
            ? `<span class="badge badge-tepat">✓ Tepat Waktu</span>`
            : `<span class="badge badge-terlambat">⏰ Terlambat</span>`;
        const isSelected = selectedIds.has(t.id);
        const tr=document.createElement('tr');
        if(isSelected) tr.classList.add('selected');
        tr.innerHTML=`
            <td class="no-print"><input type="checkbox" class="row-check" data-id="${t.id}" ${isSelected?'checked':''}></td>
            <td class="row-num">${i+1}</td>
            <td>
                <div style="display:flex;align-items:center;gap:.5rem;">
                    <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#7c3aed);display:flex;align-items:center;justify-content:center;color:white;font-size:.62rem;font-weight:700;flex-shrink:0;">${escHtml(initials(t.name))}</div>
                    <strong>${escHtml(t.name)}</strong>
                </div>
            </td>
            <td><span class="badge badge-info" style="font-size:.72rem;">${escHtml(t.subject)}</span></td>
            <td title="${escHtml(t.title)}">${escHtml(t.title.length>40?t.title.slice(0,40)+'\u2026':t.title)}</td>
            <td>${renderAdminFileCell(t)}</td>
            <td>${fmtDate(t.date)}</td>
            <td>${fmtDate(t.deadline)}</td>
            <td>${badge}</td>
            <td class="no-print">
                <div class="action-group">
                    <button class="btn-delete" data-id="${t.id}">🗑 Hapus</button>
                </div>
            </td>`;
        tr.style.opacity='0'; tr.style.transform='translateY(4px)';
        adminBody.appendChild(tr);
        requestAnimationFrame(()=>{
            tr.style.transition=`opacity .2s ease ${i*.025}s,transform .2s ease ${i*.025}s`;
            tr.style.opacity='1'; tr.style.transform='translateY(0)';
        });
    });
    updateBulkBar();
}

adminBody.addEventListener('click', e=>{
    const dl=e.target.closest('.btn-delete');
    if(dl) openModal('single',[dl.dataset.id]);
    const cb=e.target.closest('.row-check');
    if(cb) {
        const id=cb.dataset.id;
        if(cb.checked) selectedIds.add(id); else selectedIds.delete(id);
        cb.closest('tr').classList.toggle('selected',cb.checked);
        updateBulkBar();
        updateSelectAll();
    }
});

/* ===================== SELECT ALL ===================== */
selectAll.addEventListener('change',()=>{
    const cbs=adminBody.querySelectorAll('.row-check');
    cbs.forEach(cb=>{ cb.checked=selectAll.checked; const id=cb.dataset.id; if(selectAll.checked) selectedIds.add(id); else selectedIds.delete(id); cb.closest('tr').classList.toggle('selected',selectAll.checked); });
    updateBulkBar();
});
function updateSelectAll() {
    const cbs=adminBody.querySelectorAll('.row-check');
    selectAll.checked=cbs.length>0&&[...cbs].every(c=>c.checked);
    selectAll.indeterminate=!selectAll.checked&&[...cbs].some(c=>c.checked);
}
function updateBulkBar() {
    const n=selectedIds.size;
    bulkBar.classList.toggle('show',n>0);
    bulkCount.textContent=`${n} dipilih`;
}

btnDeselectAll.addEventListener('click',()=>{ selectedIds.clear(); [...adminBody.querySelectorAll('.row-check')].forEach(c=>{c.checked=false; c.closest('tr').classList.remove('selected');}); updateBulkBar(); selectAll.checked=false; });
btnDeleteSelected.addEventListener('click',()=>{ if(selectedIds.size>0) openModal('selected',[...selectedIds]); });
btnDeleteAll.addEventListener('click',()=>{ if(tasks.length===0){showToast('info','ℹ️','Tidak ada tugas.');return;} openModal('all',[]); });

/* ===================== MODAL ===================== */
function openModal(type, ids) {
    pendingAction={type,ids};
    modalTitle.textContent = type==='all' ? 'Hapus Semua Tugas?' : type==='selected' ? `Hapus ${ids.length} Tugas Terpilih?` : 'Hapus Tugas Ini?';
    modalMessage.textContent = type==='all'
        ? 'Semua tugas akan dihapus permanen. Tindakan ini tidak bisa dibatalkan!'
        : type==='selected'
        ? `${ids.length} tugas yang dipilih akan dihapus permanen.`
        : 'Data tugas ini akan dihapus permanen dan tidak dapat dikembalikan.';
    modalOverlay.classList.add('active');
}
function closeModal() { modalOverlay.classList.remove('active'); pendingAction=null; }
btnCancelDel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e=>{ if(e.target===modalOverlay) closeModal(); });
btnConfirmDel.addEventListener('click',()=>{
    if(!pendingAction) return;
    if(pendingAction.type==='all') {
        tasks=[]; showToast('error','🗑','Semua tugas telah dihapus.'); selectedIds.clear();
    } else if(pendingAction.type==='selected') {
        const ids=new Set(pendingAction.ids);
        tasks=tasks.filter(t=>!ids.has(t.id));
        selectedIds.clear();
        showToast('error','🗑',`${pendingAction.ids.length} tugas berhasil dihapus.`);
    } else {
        tasks=tasks.filter(t=>t.id!==pendingAction.ids[0]);
        showToast('error','🗑','Tugas berhasil dihapus.');
    }
    saveTasks(); closeModal(); refreshAll();
});

/* ===================== SEARCH & FILTER EVENTS ===================== */
adminSearch.addEventListener('input',()=>{
    adminClearSearch.style.display=adminSearch.value?'block':'none';
    applyAdminFilters();
});
adminClearSearch.addEventListener('click',()=>{ adminSearch.value=''; adminClearSearch.style.display='none'; applyAdminFilters(); });
adminFilterSub.addEventListener('change', applyAdminFilters);
adminFilterStatus.addEventListener('change', applyAdminFilters);

/* ===================== EXPORT CSV ===================== */
btnExportCSV.addEventListener('click',()=>{
    if(tasks.length===0) { showToast('info','ℹ️','Tidak ada data untuk diekspor.'); return; }
    const header=['No','Nama','Mata Pelajaran','Judul Tugas','Link','Tanggal Kumpul','Deadline','Status','Waktu Input'];
    const rows = tasks.map((t,i)=>[
        i+1,
        `"${(t.name||'').replace(/"/g,'""')}"`,
        `"${(t.subject||'').replace(/"/g,'""')}"`,
        `"${(t.title||'').replace(/"/g,'""')}"`,
        `"${(t.link||'').replace(/"/g,'""')}"`,
        fmtDate(t.date),
        fmtDate(t.deadline),
        t.status==='tepat'?'Tepat Waktu':'Terlambat',
        fmtDateTime(t.createdAt),
    ]);
    const csv = [header, ...rows].map(r=>r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url; a.download=`taskflow_export_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast('success','⬇️',`${tasks.length} data berhasil diekspor ke CSV.`);
});

/* ===================== PRINT ===================== */
btnPrint.addEventListener('click',()=>{ window.print(); });

/* ===================== LAST REFRESHED ===================== */
function updateLastRefreshed() {
    const el = document.getElementById('lastRefreshed');
    if(el) el.textContent = new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

/* ===================== TOAST ===================== */
function showToast(type, icon, msg) {
    const t=document.createElement('div');
    t.className=`toast toast-${type}`;
    const iconHtml = icon ? `<span class="toast-icon">${icon}</span>` : '';
    t.innerHTML=`${iconHtml}<span>${msg}</span>`;
    toastContainer.appendChild(t);
    setTimeout(()=>{ t.classList.add('hide'); t.addEventListener('animationend',()=>t.remove(),{once:true}); },3500);
}

/* ===================== AUTH & SESSION MANAGEMENT ===================== */
const AUTH_KEY = 'taskflow_admin_auth';

function isAuth() {
    return localStorage.getItem(AUTH_KEY) === 'true';
}

function checkAuth() {
    const gate    = document.getElementById('authGate');
    const header  = document.getElementById('adminMainContent');
    const content = document.getElementById('adminDashboardContent');
    if (!isAuth()) {
        if (gate)    gate.style.display = 'flex';
        if (header)  header.style.display = 'none';
        if (content) content.style.display = 'none';
        return false;
    } else {
        if (gate)    gate.style.display = 'none';
        if (header)  header.style.display = 'block';
        if (content) content.style.display = 'block';
        return true;
    }
}

function loginAdmin(username, password) {
    const user = (username || '').trim().toLowerCase();
    const pass = (password || '').trim();
    const alertBox = document.getElementById('loginAlert');
    const alertText = document.getElementById('loginAlertText');

    if ((user === 'admin' || user === 'fauzi') && (pass === 'admin123' || pass === 'fauzi123' || pass === '123')) {
        localStorage.setItem(AUTH_KEY, 'true');
        if (alertBox) alertBox.classList.remove('show');
        checkAuth();
        showToast('success', '', 'Login berhasil! Selamat datang, Fauzi.');
        refreshAll();
        initSignatureCanvas();
        return true;
    } else {
        if (alertBox) alertBox.classList.add('show');
        if (alertText) alertText.textContent = 'Username atau password salah. Coba lagi.';
        return false;
    }
}

function logoutAdmin() {
    localStorage.removeItem(AUTH_KEY);
    showToast('info', '', 'Anda telah keluar dari Panel Admin.');
    checkAuth();
}

function initAuthListeners() {
    const form = document.getElementById('adminLoginForm');
    const userInp = document.getElementById('adminUsername');
    const passInp = document.getElementById('adminPassword');
    const btnToggle = document.getElementById('btnTogglePw');
    const btnLogout = document.getElementById('btnLogoutAdmin');

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            loginAdmin(userInp.value, passInp.value);
        });
    }

    if (btnToggle && passInp) {
        btnToggle.addEventListener('click', () => {
            const isPw = passInp.type === 'password';
            passInp.type = isPw ? 'text' : 'password';
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            logoutAdmin();
        });
    }
}

/* ===================== GLOBAL DEADLINE MANAGEMENT ===================== */
const DEADLINE_KEY = 'taskflow_global_deadline';

function getGlobalDeadline() {
    let dl = localStorage.getItem(DEADLINE_KEY);
    if (!dl) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        d.setHours(23, 59, 0, 0);
        dl = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        localStorage.setItem(DEADLINE_KEY, dl);
    }
    return dl;
}

function initDeadlineAdmin() {
    const deadlineInput = document.getElementById('adminDeadlineInput');
    const btnSave       = document.getElementById('btnSaveDeadline');
    const statusText    = document.getElementById('adminDeadlineStatus');
    if (!deadlineInput) return;

    deadlineInput.value = getGlobalDeadline();

    function renderStatus() {
        const val = deadlineInput.value || getGlobalDeadline();
        if (statusText) {
            const dt = new Date(val);
            const formatted = isNaN(dt.getTime())
                ? val
                : dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' jam ' + dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
            statusText.textContent = `✓ Deadline Aktif Siswa: ${formatted}`;
        }
    }
    renderStatus();

    if (btnSave) {
        btnSave.addEventListener('click', () => {
            const val = deadlineInput.value;
            if (!val) {
                showToast('error', '⚠️', 'Pilih tanggal & waktu deadline yang valid.');
                return;
            }
            localStorage.setItem(DEADLINE_KEY, val);
            renderStatus();
            showToast('success', '✅', 'Deadline tugas berhasil disimpan dan berlaku untuk seluruh siswa!');
            window.dispatchEvent(new StorageEvent('storage', { key: DEADLINE_KEY }));
        });
    }
}

/* ===================== REFRESH ALL ===================== */
function refreshAll() {
    loadTasks();
    updateStats();
    updateSubjectFilter();
    applyAdminFilters();
    updateStudentList();
    updateLastRefreshed();
    initDeadlineAdmin();
}

/* ===================== INIT ===================== */
let lastTaskCount = -1; // track changes for polling

(function init(){
    initAuthListeners();
    const authenticated = checkAuth();

    loadTasks();
    loadStudents();
    lastTaskCount = tasks.length;
    updateClock();
    setInterval(updateClock, 1000);

    if (authenticated) {
        updateStats();
        updateSubjectFilter();
        applyAdminFilters();
        updateStudentList();
        initSignatureCanvas();
        initDeadlineAdmin();
        updateLastRefreshed();
    }

    // 1) Cross-tab: storage event (other tabs)
    window.addEventListener('storage', e => {
        if (e.key === AUTH_KEY) { checkAuth(); }
        if (e.key === STORAGE_KEY || e.key === STUDENT_KEY) { refreshAll(); }
    });

    // 2) Same-tab / same-page: poll localStorage every 3 seconds
    setInterval(() => {
        try {
            const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
            if(raw.length !== lastTaskCount) {
                lastTaskCount = raw.length;
                if (isAuth()) refreshAll();
            }
        } catch(e) {}
    }, 3000);

    // 3) Refresh when user switches back to this tab
    document.addEventListener('visibilitychange', () => {
        if(!document.hidden && isAuth()) refreshAll();
    });

    // 4) Refresh button
    const btnRefresh = document.getElementById('btnRefresh');
    if(btnRefresh) btnRefresh.addEventListener('click', () => { if(isAuth()) { refreshAll(); showToast('info','','Data diperbarui.'); } });
})();

/* ===================== SIGNATURE CANVAS ===================== */
const SIG_KEY = 'taskflow_signature';

function initSignatureCanvas() {
    const canvas   = document.getElementById('sigCanvas');
    if(!canvas) return;
    const ctx      = canvas.getContext('2d');
    const hint     = document.getElementById('sigCanvasHint');
    const btnSave  = document.getElementById('btnSaveSig');
    const btnClear = document.getElementById('btnClearSig');
    const btnErase = document.getElementById('btnEraseSig');
    const btnUndo  = document.getElementById('btnUndoSig');
    const pill     = document.getElementById('sigStatusPill');
    const preview  = document.getElementById('sigSavedPreview');
    const previewImg= document.getElementById('sigPreviewImg');
    const statusText= document.getElementById('sigStatusText');

    let drawing = false;
    let penColor = '#1e293b';
    let penSize  = 2;
    let history  = [];  // stack of ImageData for undo

    // Set canvas actual resolution to match display
    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        const dpr  = window.devicePixelRatio || 1;
        // preserve drawing
        const snap = canvas.width > 0 && canvas.height > 0 ? ctx.getImageData(0,0,canvas.width,canvas.height) : null;
        canvas.width  = rect.width  * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        ctx.lineCap   = 'round';
        ctx.lineJoin  = 'round';
        if(snap) ctx.putImageData(snap, 0, 0);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const src  = e.touches ? e.touches[0] : e;
        return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    }

    function saveHistory() {
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if(history.length > 30) history.shift();
    }

    function startDraw(e) {
        e.preventDefault();
        saveHistory();
        drawing = true;
        const p = getPos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.strokeStyle = penColor;
        ctx.lineWidth   = penSize;
        if(hint) hint.style.display = 'none';
    }
    function draw(e) {
        if(!drawing) return;
        e.preventDefault();
        const p = getPos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    }
    function endDraw(e) {
        if(!drawing) return;
        drawing = false;
        ctx.closePath();
    }

    canvas.addEventListener('mousedown',  startDraw);
    canvas.addEventListener('mousemove',  draw);
    canvas.addEventListener('mouseup',    endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    canvas.addEventListener('touchstart', startDraw, {passive:false});
    canvas.addEventListener('touchmove',  draw,      {passive:false});
    canvas.addEventListener('touchend',   endDraw);

    // Color buttons
    document.querySelectorAll('.sig-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sig-color-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            penColor = btn.dataset.color;
        });
    });

    // Size buttons
    document.querySelectorAll('.sig-size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sig-size-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            penSize = parseInt(btn.dataset.size);
        });
    });

    // Undo
    if(btnUndo) btnUndo.addEventListener('click', () => {
        if(history.length===0) return;
        ctx.putImageData(history.pop(), 0, 0);
    });

    // Erase all (canvas)
    if(btnErase) btnErase.addEventListener('click', () => {
        history=[];
        ctx.clearRect(0,0,canvas.width,canvas.height);
        if(hint) hint.style.display='block';
    });

    // Save signature
    if(btnSave) btnSave.addEventListener('click', () => {
        // Check if canvas is empty
        const px = ctx.getImageData(0,0,canvas.width,canvas.height).data;
        const hasContent = px.some(v=>v!==0);
        if(!hasContent) {
            showToast('error','⚠️','Kanvas kosong. Silakan buat tanda tangan terlebih dahulu.');
            return;
        }
        // Export with white background
        const offCanvas = document.createElement('canvas');
        offCanvas.width  = canvas.width;
        offCanvas.height = canvas.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.fillStyle='#ffffff';
        offCtx.fillRect(0,0,offCanvas.width,offCanvas.height);
        offCtx.drawImage(canvas, 0, 0);
        const dataUrl = offCanvas.toDataURL('image/png');

        localStorage.setItem(SIG_KEY, dataUrl);
        pill.textContent='✓ Tersimpan'; pill.classList.add('saved');
        if(statusText) statusText.textContent='Sudah disimpan ✓';
        previewImg.src=dataUrl;
        if(preview) preview.style.display='block';
        showToast('success','✅','Tanda tangan berhasil disimpan dan tampil ke siswa!');
    });

    // Delete signature
    if(btnClear) btnClear.addEventListener('click', () => {
        localStorage.removeItem(SIG_KEY);
        ctx.clearRect(0,0,canvas.width,canvas.height);
        history=[];
        pill.textContent='Belum Ada'; pill.classList.remove('saved');
        if(statusText) statusText.textContent='Belum ada';
        if(preview) preview.style.display='none';
        if(hint) hint.style.display='block';
        showToast('info','🗑','Tanda tangan telah dihapus.');
    });

    // Load existing signature if saved
    const saved = localStorage.getItem(SIG_KEY);
    if(saved) {
        pill.textContent='✓ Tersimpan'; pill.classList.add('saved');
        if(statusText) statusText.textContent='Sudah disimpan ✓';
        previewImg.src=saved;
        if(preview) preview.style.display='block';
        // Draw on canvas
        const img = new Image();
        img.onload=()=>{ ctx.drawImage(img,0,0,canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height); };
        img.src=saved;
        if(hint) hint.style.display='none';
    }
}

