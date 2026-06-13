/**
 * GYMPRO ELITE - ARCHIVE & ANALYTICS LOGIC
 * Version: 15.8
 * שינויים: אנליטיקה - תצוגת Stitch Perfect (Bento, Bezier, Liquid Obsidian).
 */

// ─── ANALYTICS PREFS HELPERS ──────────────────────────────────────────────

function getAnalyticsPrefs() { return StorageManager.getAnalyticsPrefs(); }
function saveAnalyticsPrefs(prefs) { StorageManager.saveAnalyticsPrefs(prefs); }

// תווית מצב תזונתי לסיכום האימון (נשמר ברשומה בעת האימון). רשומות ישנות → "—".
const _ARCHIVE_STATE_LBL = { cut: 'Cut', maintenance: 'Maintenance', surplus: 'Surplus' };
function _nutriStateLabel(item) {
    return (item && item.nutritionalState) ? (_ARCHIVE_STATE_LBL[item.nutritionalState] || item.nutritionalState) : '—';
}

// ─── ARCHIVE VIEW ─────────────────────────────────────────────────────────

const MONTH_NAMES_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const DEFAULT_MICRO_ORDER = ['Bench Press (Main)', 'Overhead Press (Main)', 'Leg Press'];

let selectedArchiveIds = new Set();

// ─── ARCHIVE THUMB + SETS HELPERS ─────────────────────────────────────────

// משתמש ב-_thumbIdx שנשמר ב-workoutMeta ע"י renderWorkoutMenu — אותה תמונה בדיוק
function getWorkoutThumbUrl(workoutKey) {
    const meta = state.workoutMeta && state.workoutMeta[workoutKey];
    if (meta && typeof meta._thumbIdx === 'number') {
        return WORKOUT_THUMB_IMAGES[meta._thumbIdx % WORKOUT_THUMB_IMAGES.length];
    }
    // fallback: חישוב פוזיציוני אם renderWorkoutMenu טרם רץ
    let idx = 0;
    const keys = Object.keys(state.workouts || {});
    for (const key of keys) {
        const m = state.workoutMeta && state.workoutMeta[key];
        if (m && (m.isHidden || m.isDeloadOnly)) continue;
        if (key === workoutKey) return WORKOUT_THUMB_IMAGES[idx % WORKOUT_THUMB_IMAGES.length];
        idx++;
    }
    return WORKOUT_THUMB_IMAGES[0];
}

function getWorkoutTotalSets(item) {
    if (!item || !item.details) return 0;
    return Object.values(item.details).reduce((total, ex) => total + (ex.sets ? ex.sets.length : 0), 0);
}

function openArchive() {
    selectedArchiveIds = new Set();
    updateCopySelectedBtn();
    const coachToggle = document.getElementById('archive-coach-toggle');
    if (coachToggle) coachToggle.checked = StorageManager.getArchiveCopyCoach();
    if (state.archiveView === 'calendar') {
        switchArchiveView('calendar');
    } else {
        switchArchiveView('list');
    }
}

function switchArchiveView(view) {
    state.archiveView = view;
    document.getElementById('calendar-view').style.display = (view === 'calendar') ? 'block' : 'none';
    document.getElementById('list-view-container').style.display = (view === 'list') ? 'block' : 'none';
    document.getElementById('btn-view-list').classList.toggle('active', view === 'list');
    document.getElementById('btn-view-calendar').classList.toggle('active', view === 'calendar');

    if (view === 'list') renderArchiveList();
    else renderCalendar();
}

function getLastPerformance(exName) {
    const all = getLastPerformances(exName, 1);
    return all.length ? all[0] : null;
}

// מחזיר עד `limit` ביצועים אחרונים של תרגיל בארכיון — מהחדש לישן
function getLastPerformances(exName, limit = 5) {
    const history = StorageManager.getArchive();
    const results = [];
    for (const entry of history) {
        if (!entry.details || !entry.details[exName]) continue;
        const sets = entry.details[exName].sets;
        if (!sets || !sets.length) continue;
        results.push({ sets, date: entry.date || '' });
        if (results.length >= limit) break;
    }
    return results;
}

function getArchiveClean() {
    return StorageManager.getArchive().filter(a => a && a.timestamp);
}

function getWorkoutVolume(workoutEntry) {
    if (!workoutEntry || !workoutEntry.details) return 0;
    return Object.values(workoutEntry.details).reduce((total, ex) => total + (ex.vol || 0), 0);
}

function getWorkoutVolumeFiltered(workoutEntry, muscleFilter) {
    if (!workoutEntry || !workoutEntry.details) return 0;
    if (!muscleFilter || muscleFilter === 'all') return getWorkoutVolume(workoutEntry);
    return Object.entries(workoutEntry.details).reduce((total, [exName, ex]) => {
        const exData = state.exercises.find(e => e.name === exName);
        if (!exData) return total;
        const muscles = exData.muscles || [];
        if (muscles.includes(muscleFilter)) return total + (ex.vol || 0);
        return total;
    }, 0);
}

function getMuscleSetCounts(archive, range) {
    let filtered = archive;
    if (range && range !== 'all') {
        const now = Date.now();
        const ms = range === '1w' ? 7 * 86400000
                 : range === '1m' ? 30 * 86400000
                 : range === '3m' ? 90 * 86400000 : 0;
        if (ms > 0) filtered = archive.filter(a => now - a.timestamp < ms);
    }
    const map = {};
    filtered.forEach(w => {
        if (!w.details) return;
        Object.keys(w.details).forEach(exName => {
            const exData = state.exercises.find(e => e.name === exName);
            if (!exData || !exData.muscles) return;
            const setCount = w.details[exName].sets ? w.details[exName].sets.length : 0;
            exData.muscles.forEach(m => {
                if (!['biceps','triceps','quads','hamstrings','glutes','calves'].includes(m)) {
                    if (!map[m]) map[m] = 0;
                    map[m] += setCount;
                }
            });
        });
    });
    return map;
}

function createArchiveCard(item) {
    const card = document.createElement('div');
    card.className = 'archive-list-card';

    const vol = getWorkoutVolume(item);
    const volStr = vol >= 1000 ? (vol / 1000).toFixed(1) + 't' : vol + 'kg';
    const totalSets = getWorkoutTotalSets(item);
    const thumbUrl = getWorkoutThumbUrl(item.type);
    const idx = StorageManager.getArchive().findIndex(a => a.timestamp === item.timestamp);

    card.innerHTML = `
        <div class="archive-card-select-row">
            <input type="checkbox" class="archive-checkbox" onchange="toggleArchiveSelection(${item.timestamp})"
                ${selectedArchiveIds.has(item.timestamp) ? 'checked' : ''}>
        </div>
        <div class="archive-card-main" onclick="openArchiveDetail(${idx})">
            <div class="archive-card-body">
                <div class="archive-card-info">
                    <span class="archive-card-title">${item.type}</span>
                    <span class="archive-card-date">${item.week && item.week !== 'deload' ? 'שבוע ' + item.week + ' • ' : item.week === 'deload' ? 'דילואוד • ' : ''}${item.date || ''} • ${item.time || ''}</span>
                </div>
                <div class="archive-card-thumbnail" style="background-image:url('${thumbUrl}');"></div>
            </div>
            <div class="archive-card-stats">
                <div class="archive-stat-cell">
                    <span class="archive-stat-label">סטים</span>
                    <span class="archive-stat-value">${totalSets || '—'}</span>
                </div>
                <div class="archive-stat-cell">
                    <span class="archive-stat-label">נפח</span>
                    <span class="archive-stat-value">${volStr}</span>
                </div>
                <div class="archive-stat-cell">
                    <span class="archive-stat-label">משך</span>
                    <span class="archive-stat-value">${item.duration || 0} דק'</span>
                </div>
            </div>
        </div>`;
    return card;
}

function renderArchiveList() {
    const list = document.getElementById('archive-list');
    list.innerHTML = "";
    const history = StorageManager.getArchive();

    if (!history.length) {
        list.innerHTML = `<p class="text-center color-dim mt-lg">טרם נשמרו אימונים</p>`;
        return;
    }

    const currentMonthKey = (() => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()}`; })();
    const monthGroups = {};

    history.forEach(item => {
        const d = new Date(item.timestamp);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const label = `${MONTH_NAMES_HE[d.getMonth()]} ${d.getFullYear()}`;
        if (!monthGroups[key]) {
            monthGroups[key] = { label, isCurrentMonth: key === currentMonthKey, items: [] };
        }
        monthGroups[key].items.push(item);
    });

    const sortedKeys = Object.keys(monthGroups).sort((a, b) => {
        const [ay, am] = a.split('-').map(Number);
        const [by, bm] = b.split('-').map(Number);
        return by !== ay ? by - ay : bm - am;
    });

    sortedKeys.forEach(key => {
        const group = monthGroups[key];
        const totalVol = group.items.reduce((s, item) => {
            if (!item.details) return s;
            return s + Object.values(item.details).reduce((sv, ex) => sv + (ex.vol || 0), 0);
        }, 0);
        const volStr = totalVol >= 1000 ? (totalVol / 1000).toFixed(1) + 't' : totalVol + 'kg';

        const monthContainer = document.createElement('div');
        monthContainer.className = 'archive-month-group';

        const header = document.createElement('div');
        header.className = group.isCurrentMonth
            ? 'archive-month-hd is-current'
            : 'archive-month-hd';
        header.innerHTML = `
            <div class="archive-month-hd-left">
                <div class="archive-month-hd-name">${group.label}</div>
                <div class="archive-month-hd-count">${group.items.length} אימונים הושלמו</div>
            </div>
            <div class="archive-month-hd-vol">
                <span class="archive-month-hd-volnum">${volStr}</span>
                <span class="archive-month-hd-vollabel">נפח כולל</span>
            </div>`;

        const itemsContainer = document.createElement('div');
        itemsContainer.className = group.isCurrentMonth
            ? 'archive-month-items'
            : 'archive-month-items collapsed';
        group.items.forEach(item => itemsContainer.appendChild(createArchiveCard(item)));

        header.addEventListener('click', () => {
            const isOpen = !itemsContainer.classList.contains('collapsed');
            itemsContainer.classList.toggle('collapsed', isOpen);
        });

        monthContainer.appendChild(header);
        monthContainer.appendChild(itemsContainer);
        list.appendChild(monthContainer);
    });
}

function toggleArchiveSelection(id) {
    if (selectedArchiveIds.has(id)) selectedArchiveIds.delete(id); else selectedArchiveIds.add(id);
    updateCopySelectedBtn();
}

function updateCopySelectedBtn() {
    const btn = document.getElementById('btn-copy-selected');
    if (!btn) return;
    if (selectedArchiveIds.size > 0) {
        btn.disabled = false;
        btn.classList.remove('archive-pill-dim');
    } else {
        btn.disabled = true;
        btn.classList.add('archive-pill-dim');
    }
}

// _coachToggleState — מצב מתג "כלול סיכומי מאמן" כפי שהמשתמש רואה אותו.
// קורא את ה-checkbox עצמו (מקור האמת הוויזואלי) עם fallback לדגל השמור —
// מגן מפני חוסר סנכרון בין ה-UI ל-localStorage.
function _coachToggleState() {
    const el = document.getElementById('archive-coach-toggle');
    return el ? el.checked : StorageManager.getArchiveCopyCoach();
}

// _stripCoachFromSummary — מסיר בלוק "=== סיכום המאמן ===" שהוטמע בשדה summary
// ברשומות מגרסאות ישנות (אז הסיכום צורף לטקסט עצמו ולא נשמר ב-aiSummary בלבד).
function _stripCoachFromSummary(text) {
    if (!text) return text;
    const idx = text.indexOf('=== סיכום המאמן ===');
    if (idx === -1) return text;
    return text.slice(0, idx).trimEnd();
}

// _archiveCopyText — טקסט להעתקה של רשומת ארכיון. מצרף סיכום מאמן אם המתג דלוק.
function _archiveCopyText(item) {
    const withCoach = _coachToggleState();
    let txt = item.summary || '';
    if (!withCoach) txt = _stripCoachFromSummary(txt);
    if (withCoach && item.aiSummary) {
        txt += `\n\n=== סיכום המאמן ===\n${item.aiSummary}`;
    }
    return txt;
}

function toggleArchiveCopyCoach(on) {
    StorageManager.setArchiveCopyCoach(on);
    haptic('light');
}

function copyBulkLog(mode) {
    const history = StorageManager.getArchive();
    const itemsToCopy = mode === 'all' ? history : history.filter(item => selectedArchiveIds.has(item.timestamp));
    if (itemsToCopy.length === 0) { showAlert("לא נבחרו אימונים להעתקה"); return; }
    const bulkText = itemsToCopy.map(item => _archiveCopyText(item)).join("\n\n========================================\n\n");
    if (navigator.clipboard) {
        navigator.clipboard.writeText(bulkText).then(() => {
            haptic('success');
            showAlert(`הועתקו ${itemsToCopy.length} אימונים בהצלחה!`);
        });
    } else {
        const el = document.createElement("textarea");
        el.value = bulkText;
        document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
        showAlert(`הועתקו ${itemsToCopy.length} אימונים בהצלחה!`);
    }
}

// ─── ARCHIVE DETAIL ───────────────────────────────────────────────────────

function _parseExOrderFromSummary(summary) {
    if (!summary) return [];
    const order = [];
    const lineRe = /^(.+?)\s*\(Vol:[^)]+\):$/;
    summary.split('\n').forEach(line => {
        const m = line.trim().match(lineRe);
        if (m) order.push(m[1].trim());
    });
    return order;
}

function buildArchiveDetailHTML(item) {
    const meta = state.workoutMeta[item.type];
    const typeColor = (meta && meta.color) ? meta.color : 'var(--type-free)';
    const totalVol = getWorkoutVolume(item);
    const totalVolStr = totalVol >= 1000 ? (totalVol / 1000).toFixed(1) + 't' : totalVol + 'kg';

    let html = `<div class="summary-overview-card">
        <div class="summary-overview-col">
            <div class="summary-overview-val" style="color:${typeColor}">${item.type}</div>
            <div class="summary-overview-label">סוג אימון</div>
        </div>
        <div class="summary-overview-col">
            <div class="summary-overview-val">${item.duration || 0}m</div>
            <div class="summary-overview-label">משך</div>
        </div>
        <div class="summary-overview-col">
            <div class="summary-overview-val">${item.date || ''}</div>
            <div class="summary-overview-label">${item.time || ''}</div>
        </div>
        <div class="summary-overview-col">
            <div class="summary-overview-val">${_nutriStateLabel(item)}</div>
            <div class="summary-overview-label">מצב תזונתי</div>
        </div>
    </div>`;

    if (item.note) {
        html += `<div class="summary-ex-card" style="font-size:0.9em;color:var(--text-dim);margin-bottom:10px;">הערה: ${item.note}</div>`;
    }

    if (item.log && item.log.length > 0) {
        const segs = [];
        item.log.filter(l => !l.skip).forEach(entry => {
            const last = segs[segs.length - 1];
            if (!entry.isCluster) {
                if (last && last.type === 'normal' && last.exName === entry.exName) last.sets.push(entry);
                else segs.push({ type: 'normal', exName: entry.exName, sets: [entry] });
            } else {
                if (last && last.type === 'cluster') last.sets.push(entry);
                else segs.push({ type: 'cluster', sets: [entry] });
            }
        });

        segs.forEach(seg => {
            if (seg.type === 'normal') {
                const exName = seg.exName;
                const exVol = (item.details && item.details[exName]) ? item.details[exName].vol : 0;
                const volStr = exVol >= 1000 ? (exVol / 1000).toFixed(1) + 't' : exVol + 'kg';
                let setRows = '';
                seg.sets.forEach((entry, i) => {
                    const rir = entry.rir !== undefined ? entry.rir : '—';
                    const noteStr = entry.note ? ` | ${entry.note}` : '';
                    setRows += `<div class="summary-set-row">
                        <div class="summary-set-num">${i + 1}</div>
                        <div class="summary-set-details">${_fmtW(entry)} x ${entry.r} (RIR ${rir}${noteStr})</div>
                    </div>`;
                });
                html += `<div class="summary-ex-card">
                    <div class="summary-ex-header">
                        <div class="summary-ex-title">${exName}</div>
                        <div class="summary-ex-vol">${volStr}</div>
                    </div>
                    ${setRows}
                </div>`;
            } else {
                const byRound = {};
                seg.sets.forEach(entry => {
                    const rn = entry.round || 1;
                    if (!byRound[rn]) byRound[rn] = [];
                    byRound[rn].push(entry);
                });
                const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
                let clusterHtml = '';
                rounds.forEach(rn => {
                    clusterHtml += `<div class="summary-cluster-round">סבב ${rn}</div>`;
                    byRound[rn].forEach((entry, i) => {
                        const rir = entry.rir !== undefined ? entry.rir : '—';
                        const noteStr = entry.note ? ` | ${entry.note}` : '';
                        clusterHtml += `<div class="summary-set-row">
                            <div class="summary-set-num">${i + 1}</div>
                            <div class="summary-set-details">
                                <span class="summary-cluster-ex-name">${entry.exName}</span>
                                ${_fmtW(entry)} x ${entry.r} (RIR ${rir}${noteStr})
                            </div>
                        </div>`;
                    });
                });
                html += `<div class="summary-ex-card">
                    <div class="summary-ex-header">
                        <div class="summary-ex-title">Cluster (${rounds.length} סבבים)</div>
                    </div>
                    ${clusterHtml}
                </div>`;
            }
        });
    } else if (item.details) {
        const detailKeys = Object.keys(item.details);
        let exOrder;
        if (item.exOrder && item.exOrder.length > 0) {
            exOrder = [
                ...item.exOrder.filter(n => item.details[n]),
                ...detailKeys.filter(n => !item.exOrder.includes(n))
            ];
        } else {
            const parsedOrder = _parseExOrderFromSummary(item.summary);
            if (parsedOrder.length > 0) {
                const parsedSet = new Set(parsedOrder);
                const missing = detailKeys.filter(n => !parsedSet.has(n));
                const firstParsedIdx = detailKeys.findIndex(n => parsedSet.has(n));
                const missingBefore = missing.filter(n => detailKeys.indexOf(n) < firstParsedIdx);
                const missingAfter  = missing.filter(n => detailKeys.indexOf(n) >= firstParsedIdx);
                exOrder = [...missingBefore, ...parsedOrder.filter(n => item.details[n]), ...missingAfter];
            } else {
                exOrder = detailKeys;
            }
        }

        exOrder.forEach(exName => {
            const exData = item.details[exName];
            if (!exData) return;
            const sets = exData.sets || [];
            if (sets.length === 0) return;
            const exVol = exData.vol || 0;
            const volStr = exVol >= 1000 ? (exVol / 1000).toFixed(1) + 't' : exVol + 'kg';
            let setRows = '';
            sets.forEach((setStr, i) => {
                setRows += `<div class="summary-set-row">
                    <div class="summary-set-num">${i + 1}</div>
                    <div class="summary-set-details">${setStr}</div>
                </div>`;
            });
            html += `<div class="summary-ex-card">
                <div class="summary-ex-header">
                    <div class="summary-ex-title">${exName}</div>
                    <div class="summary-ex-vol">${volStr}</div>
                </div>
                ${setRows}
            </div>`;
        });
    }

    html += `<div style="text-align:center;padding:12px 0 4px;font-size:0.8em;color:var(--text-dim);">נפח כולל: ${totalVolStr}</div>`;
    return html;
}

function openArchiveDetail(idx) {
    const archive = StorageManager.getArchive();
    if (idx < 0 || idx >= archive.length) return;
    const item = archive[idx];

    // שמירת reference לעריכה עתידית
    _archiveEditItem = JSON.parse(JSON.stringify(item));
    _archiveEditTimestamp = item.timestamp;
    _archiveEditMode = false;

    const contentEl = document.getElementById('archive-detail-content');
    contentEl.className = '';
    contentEl.innerHTML = buildArchiveDetailHTML(item);

    // וידוא שמצב עריכה מאופס
    document.getElementById('archive-detail-actions').style.display = 'flex';
    document.getElementById('archive-edit-actions').style.display = 'none';
    document.getElementById('archive-detail-note-editor').style.display = 'none';

    const editBtn = document.getElementById('btn-archive-edit');
    const copyBtn = document.getElementById('btn-archive-copy');
    const deleteBtn = document.getElementById('btn-archive-delete');

    editBtn.onclick = () => enterArchiveEditMode();

    copyBtn.onclick = () => {
        const copyText = _archiveCopyText(item);
        if (navigator.clipboard) {
            navigator.clipboard.writeText(copyText).then(() => {
                haptic('success');
                showAlert("הסיכום הועתק!");
            });
        } else {
            const el = document.createElement("textarea");
            el.value = copyText;
            document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
            showAlert("הסיכום הועתק!");
        }
    };

    deleteBtn.onclick = () => {
        showConfirm("האם למחוק אימון זה מהארכיון?", () => {
            StorageManager.deleteFromArchive(item.timestamp);
            haptic('warning');
            if (typeof FirebaseManager !== 'undefined' && FirebaseManager.isConfigured()) {
                FirebaseManager.saveArchiveToCloud().then(ok => {
                    if (typeof showCloudToast === 'function') {
                        showCloudToast(ok ? '☁️ ארכיון עודכן בענן' : '⚠️ שגיאה בעדכון ארכיון בענן', ok);
                    }
                    window.location.reload();
                });
            } else {
                window.location.reload();
            }
        });
    };

    // חיבור כפתורי עריכה
    document.getElementById('btn-archive-save-edit').onclick = () => saveArchiveEdit();
    document.getElementById('btn-archive-cancel-edit').onclick = () => exitArchiveEditMode();

    navigate('ui-archive-detail');
}

// ─── ARCHIVE EDIT MODE ───────────────────────────────────────────────────

let _archiveEditItem = null;       // עותק עמוק של האימון בעריכה
let _archiveEditTimestamp = null;   // timestamp מקורי לזיהוי
let _archiveEditMode = false;      // האם במצב עריכה?

function enterArchiveEditMode() {
    if (!_archiveEditItem) return;
    _archiveEditMode = true;

    // הצג/הסתר כפתורים
    document.getElementById('archive-detail-actions').style.display = 'none';
    document.getElementById('archive-edit-actions').style.display = 'flex';

    // הצג עורך הערות
    const noteEditor = document.getElementById('archive-detail-note-editor');
    noteEditor.style.display = 'block';
    document.getElementById('archive-note-input').value = _archiveEditItem.note || '';

    // רנדר מחדש עם אלמנטים לחיצים
    _renderArchiveEditView();
}

function exitArchiveEditMode() {
    _archiveEditMode = false;
    _archiveEditItem = null;
    _archiveEditTimestamp = null;

    document.getElementById('archive-detail-actions').style.display = 'flex';
    document.getElementById('archive-edit-actions').style.display = 'none';
    document.getElementById('archive-detail-note-editor').style.display = 'none';

    // חזור לתצוגה רגילה — פתח מחדש
    navigate('ui-archive');
}

function _renderArchiveEditView() {
    const item = _archiveEditItem;
    const contentEl = document.getElementById('archive-detail-content');

    if (item.log && item.log.length > 0) {
        contentEl.innerHTML = _buildArchiveEditHTML_withLog(item);
    } else if (item.details) {
        contentEl.innerHTML = _buildArchiveEditHTML_detailsOnly(item);
    }
}

// בניית HTML לעריכה כשיש log מובנה
function _buildArchiveEditHTML_withLog(item) {
    const meta = state.workoutMeta[item.type];
    const typeColor = (meta && meta.color) ? meta.color : 'var(--type-free)';
    const totalVol = getWorkoutVolume(item);
    const totalVolStr = totalVol >= 1000 ? (totalVol / 1000).toFixed(1) + 't' : totalVol + 'kg';

    let html = `<div class="summary-overview-card">
        <div class="summary-overview-col">
            <div class="summary-overview-val" style="color:${typeColor}">${item.type}</div>
            <div class="summary-overview-label">סוג אימון</div>
        </div>
        <div class="summary-overview-col">
            <div class="summary-overview-val">${item.duration || 0}m</div>
            <div class="summary-overview-label">משך</div>
        </div>
        <div class="summary-overview-col">
            <div class="summary-overview-val">${item.date || ''}</div>
            <div class="summary-overview-label">${item.time || ''}</div>
        </div>
        <div class="summary-overview-col">
            <div class="summary-overview-val">${_nutriStateLabel(item)}</div>
            <div class="summary-overview-label">מצב תזונתי</div>
        </div>
    </div>`;

    // חלוקה לסגמנטים (רגיל / cluster)
    const segs = [];
    item.log.filter(l => !l.skip).forEach(entry => {
        const last = segs[segs.length - 1];
        if (!entry.isCluster) {
            if (last && last.type === 'normal' && last.exName === entry.exName) last.sets.push(entry);
            else segs.push({ type: 'normal', exName: entry.exName, sets: [entry] });
        } else {
            if (last && last.type === 'cluster') last.sets.push(entry);
            else segs.push({ type: 'cluster', sets: [entry] });
        }
    });

    // מיפוי log index לכל entry (רק non-skip)
    const nonSkipLog = item.log.filter(l => !l.skip);

    segs.forEach(seg => {
        if (seg.type === 'normal') {
            const exName = seg.exName;
            const exVol = (item.details && item.details[exName]) ? item.details[exName].vol : 0;
            const volStr = exVol >= 1000 ? (exVol / 1000).toFixed(1) + 't' : exVol + 'kg';
            let setRows = '';
            seg.sets.forEach((entry, i) => {
                const logIdx = nonSkipLog.indexOf(entry);
                const rir = entry.rir !== undefined ? entry.rir : '—';
                const noteStr = entry.note ? ` | ${entry.note}` : '';
                setRows += `<div class="summary-set-row archive-edit-set" onclick="openArchiveSetEditor(${logIdx})">
                    <div class="summary-set-num">${i + 1}</div>
                    <div class="summary-set-details">${_fmtW(entry)} x ${entry.r} (RIR ${rir}${noteStr})</div>
                    <span class="material-symbols-outlined archive-edit-icon">edit</span>
                </div>`;
            });
            html += `<div class="summary-ex-card">
                <div class="summary-ex-header">
                    <div class="summary-ex-title">${exName}</div>
                    <div class="summary-ex-vol">${volStr}</div>
                </div>
                ${setRows}
            </div>`;
        } else {
            const byRound = {};
            seg.sets.forEach(entry => {
                const rn = entry.round || 1;
                if (!byRound[rn]) byRound[rn] = [];
                byRound[rn].push(entry);
            });
            const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
            let clusterHtml = '';
            rounds.forEach(rn => {
                clusterHtml += `<div class="summary-cluster-round">סבב ${rn}</div>`;
                byRound[rn].forEach((entry, i) => {
                    const logIdx = nonSkipLog.indexOf(entry);
                    const rir = entry.rir !== undefined ? entry.rir : '—';
                    const noteStr = entry.note ? ` | ${entry.note}` : '';
                    clusterHtml += `<div class="summary-set-row archive-edit-set" onclick="openArchiveSetEditor(${logIdx})">
                        <div class="summary-set-num">${i + 1}</div>
                        <div class="summary-set-details">
                            <span class="summary-cluster-ex-name">${entry.exName}</span>
                            ${_fmtW(entry)} x ${entry.r} (RIR ${rir}${noteStr})
                        </div>
                        <span class="material-symbols-outlined archive-edit-icon">edit</span>
                    </div>`;
                });
            });
            html += `<div class="summary-ex-card">
                <div class="summary-ex-header">
                    <div class="summary-ex-title">Cluster (${rounds.length} סבבים)</div>
                </div>
                ${clusterHtml}
            </div>`;
        }
    });

    html += `<div style="text-align:center;padding:12px 0 4px;font-size:0.8em;color:var(--text-dim);">נפח כולל: ${totalVolStr}</div>`;
    return html;
}

// בניית HTML לעריכה כשאין log — רק details (אימונים ישנים)
function _buildArchiveEditHTML_detailsOnly(item) {
    const meta = state.workoutMeta[item.type];
    const typeColor = (meta && meta.color) ? meta.color : 'var(--type-free)';
    const totalVol = getWorkoutVolume(item);
    const totalVolStr = totalVol >= 1000 ? (totalVol / 1000).toFixed(1) + 't' : totalVol + 'kg';

    let html = `<div class="summary-overview-card">
        <div class="summary-overview-col">
            <div class="summary-overview-val" style="color:${typeColor}">${item.type}</div>
            <div class="summary-overview-label">סוג אימון</div>
        </div>
        <div class="summary-overview-col">
            <div class="summary-overview-val">${item.duration || 0}m</div>
            <div class="summary-overview-label">משך</div>
        </div>
        <div class="summary-overview-col">
            <div class="summary-overview-val">${item.date || ''}</div>
            <div class="summary-overview-label">${item.time || ''}</div>
        </div>
        <div class="summary-overview-col">
            <div class="summary-overview-val">${_nutriStateLabel(item)}</div>
            <div class="summary-overview-label">מצב תזונתי</div>
        </div>
    </div>`;

    const detailKeys = Object.keys(item.details);
    const exOrder = (item.exOrder && item.exOrder.length > 0)
        ? [...item.exOrder.filter(n => item.details[n]), ...detailKeys.filter(n => !(item.exOrder || []).includes(n))]
        : detailKeys;

    exOrder.forEach(exName => {
        const exData = item.details[exName];
        if (!exData) return;
        const sets = exData.sets || [];
        if (sets.length === 0) return;
        const exVol = exData.vol || 0;
        const volStr = exVol >= 1000 ? (exVol / 1000).toFixed(1) + 't' : exVol + 'kg';
        let setRows = '';
        sets.forEach((setStr, i) => {
            setRows += `<div class="summary-set-row archive-edit-set" onclick="openArchiveDetailSetEditor('${escapeJsAttr(exName)}', ${i})">
                <div class="summary-set-num">${i + 1}</div>
                <div class="summary-set-details">${escapeHtml(setStr)}</div>
                <span class="material-symbols-outlined archive-edit-icon">edit</span>
            </div>`;
        });
        html += `<div class="summary-ex-card">
            <div class="summary-ex-header">
                <div class="summary-ex-title">${escapeHtml(exName)}</div>
                <div class="summary-ex-vol">${volStr}</div>
            </div>
            ${setRows}
        </div>`;
    });

    html += `<div style="text-align:center;padding:12px 0 4px;font-size:0.8em;color:var(--text-dim);">נפח כולל: ${totalVolStr}</div>`;
    return html;
}

// ─── ARCHIVE SET EDITOR (משתמש ב-edit-set-modal הקיים) ──────────────────

let _archiveEditSetLogIdx = -1;    // אינדקס ב-nonSkipLog
let _archiveEditSetExName = null;  // שם תרגיל (למצב details-only)
let _archiveEditSetExIdx = -1;     // אינדקס סט בתוך תרגיל (למצב details-only)
let _editFromArchive = false;      // דגל לזיהוי מצב ארכיון ב-saveSetEdit

function openArchiveSetEditor(nonSkipIdx) {
    if (!_archiveEditItem || !_archiveEditItem.log) return;
    const nonSkipLog = _archiveEditItem.log.filter(l => !l.skip);
    const entry = nonSkipLog[nonSkipIdx];
    if (!entry) return;

    _archiveEditSetLogIdx = nonSkipIdx;
    _archiveEditSetExName = null;
    _editFromArchive = true;

    document.getElementById('edit-weight').value = entry.w;
    document.getElementById('edit-reps').value = entry.r;
    document.getElementById('edit-rir').value = entry.rir !== undefined ? entry.rir : '';
    document.getElementById('edit-note').value = entry.note || '';
    document.getElementById('edit-set-modal').style.display = 'flex';
}

// לאימונים ישנים ללא log — פרסור מתוך הסטרינג
function openArchiveDetailSetEditor(exName, setIdx) {
    if (!_archiveEditItem || !_archiveEditItem.details) return;
    const exData = _archiveEditItem.details[exName];
    if (!exData || !exData.sets || !exData.sets[setIdx]) return;

    const setStr = exData.sets[setIdx];
    const parsed = _parseSetString(setStr);

    _archiveEditSetExName = exName;
    _archiveEditSetExIdx = setIdx;
    _archiveEditSetLogIdx = -1;
    _editFromArchive = true;

    document.getElementById('edit-weight').value = parsed.w;
    document.getElementById('edit-reps').value = parsed.r;
    document.getElementById('edit-rir').value = parsed.rir;
    document.getElementById('edit-note').value = parsed.note;
    document.getElementById('edit-set-modal').style.display = 'flex';
}

// פרסור סטרינג סט: "80kg x 5 (RIR 2) | Note: xxx"
function _parseSetString(setStr) {
    let w = 0, r = 0, rir = '', note = '';

    // הפרדת הערה
    if (setStr.includes('| Note:')) {
        const parts = setStr.split('| Note:');
        setStr = parts[0].trim();
        note = parts.slice(1).join('| Note:').trim();
    } else if (setStr.includes('|')) {
        const parts = setStr.split('|');
        setStr = parts[0].trim();
        note = parts.slice(1).join('|').trim();
    }

    // פרסור משקל וחזרות — תומך גם ב"5 פלטות x 10" ו-"BW x 12" (w=0)
    const xParts = setStr.split('x');
    if (xParts.length >= 2) {
        w = parseFloat(xParts[0].replace('kg', '').replace('פלטות', '').replace('(צד אחד)', '').replace('(יד אחת)', '').trim()) || 0;
        const afterX = xParts.slice(1).join('x').trim();
        const rMatch = afterX.match(/(\d+)/);
        r = rMatch ? parseInt(rMatch[1]) : 0;

        // RIR
        const rirMatch = afterX.match(/RIR\s+([^\s)]+)/i);
        rir = rirMatch ? rirMatch[1] : '';
    }

    return { w, r, rir, note };
}

function saveArchiveSetEdit() {
    const w = parseFloat(document.getElementById('edit-weight').value);
    const r = parseInt(document.getElementById('edit-reps').value);
    const rir = document.getElementById('edit-rir').value;
    const note = document.getElementById('edit-note').value.trim();
    if (isNaN(w) || w < 0 || isNaN(r) || r < 1) {
        showAlert('ערכים לא תקינים — משקל חייב להיות 0 ומעלה וחזרות לפחות 1.');
        return;
    }

    if (_archiveEditSetLogIdx >= 0 && _archiveEditItem.log) {
        // עדכון log entry
        const nonSkipLog = _archiveEditItem.log.filter(l => !l.skip);
        const entry = nonSkipLog[_archiveEditSetLogIdx];
        if (entry) {
            entry.w = w;
            entry.r = r;
            entry.rir = rir;
            entry.note = note;
        }
        // חישוב מחדש של details מתוך log
        _recalcArchiveDetails();
    } else if (_archiveEditSetExName) {
        // עדכון details ישירות (אימונים ישנים)
        const exData = _archiveEditItem.details[_archiveEditSetExName];
        if (exData && exData.sets && exData.sets[_archiveEditSetExIdx] !== undefined) {
            const noteStr = note ? ` | Note: ${note}` : '';
            exData.sets[_archiveEditSetExIdx] = `${w}kg x ${r} (RIR ${rir})${noteStr}`;
            // חישוב מחדש של volume לתרגיל
            _recalcExVolume(_archiveEditSetExName);
        }
    }

    _editFromArchive = false;
    document.getElementById('edit-set-modal').style.display = 'none';

    // רנדר מחדש
    _renderArchiveEditView();
}

function deleteArchiveSet() {
    if (_archiveEditSetLogIdx >= 0 && _archiveEditItem.log) {
        const nonSkipLog = _archiveEditItem.log.filter(l => !l.skip);
        const entry = nonSkipLog[_archiveEditSetLogIdx];
        if (entry) {
            const realIdx = _archiveEditItem.log.indexOf(entry);
            if (realIdx !== -1) _archiveEditItem.log.splice(realIdx, 1);
        }
        _recalcArchiveDetails();
    } else if (_archiveEditSetExName) {
        const exData = _archiveEditItem.details[_archiveEditSetExName];
        if (exData && exData.sets) {
            exData.sets.splice(_archiveEditSetExIdx, 1);
            if (exData.sets.length === 0) {
                delete _archiveEditItem.details[_archiveEditSetExName];
                if (_archiveEditItem.exOrder) {
                    _archiveEditItem.exOrder = _archiveEditItem.exOrder.filter(n => n !== _archiveEditSetExName);
                }
            } else {
                _recalcExVolume(_archiveEditSetExName);
            }
        }
    }

    _editFromArchive = false;
    document.getElementById('edit-set-modal').style.display = 'none';
    _renderArchiveEditView();
}

// חישוב מחדש של details ו-exOrder מתוך log
function _recalcArchiveDetails() {
    const item = _archiveEditItem;
    if (!item.log) return;

    const exOrder = [];
    const details = {};

    item.log.forEach(entry => {
        if (entry.skip) return;
        const key = entry.exName;
        if (!details[key]) { details[key] = { sets: [], vol: 0 }; exOrder.push(key); }
        const rir = entry.rir !== undefined ? entry.rir : '—';
        const noteStr = entry.note ? ` | Note: ${entry.note}` : '';
        details[key].sets.push(`${_fmtW(entry)} x ${entry.r} (RIR ${rir})${noteStr}`);
    });

    // חישוב volume
    exOrder.forEach(exName => {
        let exVol = 0;
        details[exName].sets.forEach(setStr => {
            exVol += _setStrVol(setStr) * (isUnilateral(exName) ? 2 : 1);
        });
        details[exName].vol = exVol;
    });

    item.details = details;
    item.exOrder = exOrder;
}

// חישוב מחדש של volume לתרגיל ספציפי (מצב details-only)
function _recalcExVolume(exName) {
    const exData = _archiveEditItem.details[exName];
    if (!exData || !exData.sets) return;

    let exVol = 0;
    exData.sets.forEach(setStr => {
        exVol += _setStrVol(setStr) * (isUnilateral(exName) ? 2 : 1);
    });
    exData.vol = exVol;
}

// בניית summary מחדש
function _rebuildArchiveSummary(item) {
    const weekLabel = item.week === 'deload' ? 'Deload' :
                      item.week === 'Freestyle' ? 'Freestyle' :
                      item.week ? `Week ${item.week}` : '';

    // שחזור תאריך מ-timestamp
    const now = new Date(item.timestamp);
    const dateStr = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;

    const lines = [
        'GYMPRO ELITE SUMMARY',
        `${item.type}${weekLabel ? ' | ' + weekLabel : ''} | ${dateStr} | ${item.duration || 0}m`,
        ''
    ];
    if (item.note) { lines.push(`הערה: ${item.note}`); lines.push(''); }

    if (item.log && item.log.length > 0) {
        // בניה מבוססת-סגמנטים
        const segs = [];
        item.log.filter(l => !l.skip).forEach(entry => {
            const last = segs[segs.length - 1];
            if (!entry.isCluster) {
                if (last && last.type === 'normal' && last.exName === entry.exName) last.sets.push(entry);
                else segs.push({ type: 'normal', exName: entry.exName, sets: [entry] });
            } else {
                if (last && last.type === 'cluster') last.sets.push(entry);
                else segs.push({ type: 'cluster', sets: [entry] });
            }
        });

        segs.forEach(seg => {
            if (seg.type === 'normal') {
                const exName = seg.exName;
                const exVol = (item.details && item.details[exName]) ? item.details[exName].vol : 0;
                const volStr = exVol >= 1000 ? (exVol / 1000).toFixed(1) + 't' : exVol + 'kg';
                const uniTag = isUnilateral(exName) ? ' (צד אחד)' : '';
                lines.push(`${exName}${uniTag} (Vol: ${volStr}):`);
                seg.sets.forEach(entry => {
                    const rir = entry.rir !== undefined ? entry.rir : '—';
                    const noteStr = entry.note ? ` | Note: ${entry.note}` : '';
                    lines.push(`${_fmtW(entry)} x ${entry.r} (RIR ${rir})${noteStr}`);
                });
                lines.push('');
            } else {
                const byRound = {};
                seg.sets.forEach(entry => {
                    const rn = entry.round || 1;
                    if (!byRound[rn]) byRound[rn] = [];
                    byRound[rn].push(entry);
                });
                Object.keys(byRound).map(Number).sort((a, b) => a - b).forEach(rn => {
                    lines.push(`Cluster סבב ${rn}:`);
                    byRound[rn].forEach(entry => {
                        const rir = entry.rir !== undefined ? entry.rir : '—';
                        const noteStr = entry.note ? ` | Note: ${entry.note}` : '';
                        lines.push(`  ${entry.exName}: ${_fmtW(entry)} x ${entry.r} (RIR ${rir})${noteStr}`);
                    });
                    lines.push('');
                });
            }
        });
    } else if (item.details) {
        const exOrder = item.exOrder || Object.keys(item.details);
        exOrder.forEach(exName => {
            const exData = item.details[exName];
            if (!exData || !exData.sets || exData.sets.length === 0) return;
            const volStr = exData.vol >= 1000 ? (exData.vol / 1000).toFixed(1) + 't' : exData.vol + 'kg';
            lines.push(`${exName} (Vol: ${volStr}):`);
            exData.sets.forEach(s => lines.push(s));
            lines.push('');
        });
    }

    return lines.join('\n').trimEnd();
}

// שמירת כל השינויים בארכיון
function saveArchiveEdit() {
    if (!_archiveEditItem || !_archiveEditTimestamp) return;

    // עדכון הערה
    _archiveEditItem.note = document.getElementById('archive-note-input').value.trim() || '';

    // בניית summary מחדש
    _archiveEditItem.summary = _rebuildArchiveSummary(_archiveEditItem);

    // שמירה ל-localStorage
    const saved = StorageManager.updateArchiveEntry(_archiveEditTimestamp, _archiveEditItem);
    if (!saved) {
        showAlert('שגיאה בשמירת השינויים');
        return;
    }

    haptic('success');
    showAlert('האימון עודכן בהצלחה!');

    // סנכרון Firebase אם מוגדר
    if (typeof FirebaseManager !== 'undefined' && FirebaseManager.isConfigured()) {
        FirebaseManager.saveArchiveToCloud().then(ok => {
            if (typeof showCloudToast === 'function') {
                showCloudToast(ok ? '☁️ ארכיון עודכן בענן' : '⚠️ שגיאה בעדכון ארכיון בענן', ok);
            }
        }).catch(e => {
            console.error('GymPro: archive cloud sync failed', e);
            if (typeof showCloudToast === 'function') showCloudToast('⚠️ שגיאה בעדכון ארכיון בענן', false);
        });
    }

    _archiveEditMode = false;
    _archiveEditItem = null;
    _archiveEditTimestamp = null;

    document.getElementById('archive-detail-actions').style.display = 'flex';
    document.getElementById('archive-edit-actions').style.display = 'none';
    document.getElementById('archive-detail-note-editor').style.display = 'none';

    navigate('ui-archive');
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────

function changeMonth(delta) { state.calendarOffset += delta; renderCalendar(); }

function renderCalendar() {
    const grid = document.getElementById('calendar-days');
    grid.innerHTML = "";
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + state.calendarOffset, 1);
    const year = targetDate.getFullYear(), month = targetDate.getMonth();
    document.getElementById('current-month-display').innerText = `\u200F${MONTH_NAMES_HE[month]} ${year}`;
    const firstDayIndex = targetDate.getDay(); // 0=ראשון
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const history = StorageManager.getArchive();
    const monthWorkouts = history.filter(item => {
        const d = new Date(item.timestamp);
        return d.getMonth() === month && d.getFullYear() === year;
    });

    // תאים ריקים לפני תחילת החודש
    for (let i = 0; i < firstDayIndex; i++) {
        const ph = document.createElement('div');
        ph.className = 'cal-day-placeholder';
        grid.appendChild(ph);
    }

    const today = new Date();
    const isCurrentMonth = state.calendarOffset === 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const dailyWorkouts = monthWorkouts.filter(item => new Date(item.timestamp).getDate() === day);
        const hasWorkout = dailyWorkouts.length > 0;
        const isToday = isCurrentMonth && day === today.getDate();

        const cell = document.createElement('div');
        cell.className = hasWorkout ? 'cal-day-active' : 'cal-day-empty';
        if (isToday) cell.classList.add('cal-today');

        // מספר היום
        const numEl = document.createElement('span');
        numEl.className = hasWorkout ? 'cal-day-num' : 'cal-day-num cal-day-num-dim';
        numEl.textContent = day;
        cell.appendChild(numEl);

        if (hasWorkout) {
            const dotsRow = document.createElement('div');
            dotsRow.className = 'cal-dots-row';
            dailyWorkouts.forEach(wo => {
                const woMeta = state.workoutMeta[wo.type];
                const color = (woMeta && woMeta.color) ? woMeta.color : 'var(--type-free)';
                const dot = document.createElement('div');
                dot.className = 'cal-dot';
                dot.style.backgroundColor = color;
                dot.style.boxShadow = `0 0 6px ${color}`;
                dotsRow.appendChild(dot);
            });
            cell.appendChild(dotsRow);
            cell.onclick = () => openDayDrawer(dailyWorkouts, day, MONTH_NAMES_HE[month]);
        } else {
            // placeholder לגובה אחיד
            const ph = document.createElement('div');
            ph.className = 'cal-dot-ph';
            cell.appendChild(ph);
        }

        grid.appendChild(cell);
    }

    _renderCalendarSummary(monthWorkouts, month, year);
    _renderCalendarLegend(monthWorkouts);
}

function _renderCalendarSummary(monthWorkouts, month, year) {
    const card = document.getElementById('cal-summary-card');
    if (!card) return;
    const count = monthWorkouts.length;

    if (count === 0) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';
    const totalVolKg = monthWorkouts.reduce((s, wo) => s + getWorkoutVolume(wo), 0);
    const totalVolTon = (totalVolKg / 1000).toFixed(1);
    const totalVolFmt = parseFloat(totalVolTon).toLocaleString('he-IL');

    card.innerHTML = `
        <div class="cal-summary-title">נתוני ${MONTH_NAMES_HE[month]}</div>
        <div class="cal-summary-sub">סיכום ביצועים חודשי</div>
        <div class="cal-summary-stats">
            <div class="cal-summary-stat">
                <span class="cal-summary-num">${count}</span>
                <span class="cal-summary-label">אימונים</span>
            </div>
            <div class="cal-summary-stat">
                <div class="cal-summary-vol-row">
                    <span class="cal-summary-num">${totalVolFmt}</span>
                    <span class="cal-summary-unit">טון</span>
                </div>
                <span class="cal-summary-label">נפח כולל</span>
            </div>
        </div>`;
}

function _renderCalendarLegend(monthWorkouts) {
    const legend = document.getElementById('cal-legend');
    if (!legend) return;
    legend.innerHTML = '';
    const seen = new Map();
    monthWorkouts.forEach(wo => {
        if (!seen.has(wo.type)) {
            const woMeta = state.workoutMeta[wo.type];
            const color = (woMeta && woMeta.color) ? woMeta.color : 'var(--type-free)';
            seen.set(wo.type, color);
        }
    });
    seen.forEach((color, label) => {
        const item = document.createElement('div');
        item.className = 'cal-legend-item';
        item.innerHTML = `
            <div class="cal-legend-dot" style="background:${color};box-shadow:0 0 8px ${color}"></div>
            <span class="cal-legend-label">${label}</span>`;
        legend.appendChild(item);
    });
}

function openDayDrawer(workouts, day, monthName) {
    const drawer = document.getElementById('sheet-modal');
    const overlay = document.getElementById('sheet-overlay');
    const content = document.getElementById('sheet-content');
    let html = `<h3>${day} ב${monthName}</h3>`;
    if (!workouts.length) {
        html += `<p class="color-dim text-sm">אין אימונים ביום זה</p>`;
    } else {
        html += `<p class="color-dim text-sm">נמצאו ${workouts.length} אימונים:</p>`;
        workouts.forEach(wo => {
            const woMeta = state.workoutMeta[wo.type];
            const dotColor = (woMeta && woMeta.color) ? woMeta.color : 'var(--type-free)';
            html += `<div class="mini-workout-item" onclick='openArchiveFromDrawer(${wo.timestamp})'>
                <div class="mini-dot" style="background:${dotColor}"></div>
                <div style="flex-grow:1;"><div class="font-semi text-base">${wo.type}</div><div class="text-xs color-dim">${wo.duration} דק'</div></div>
                <div class="chevron"></div>
            </div>`;
        });
    }
    content.innerHTML = html;
    overlay.style.display = 'block'; drawer.classList.add('open'); haptic('light');
}

function closeDayDrawer() {
    const drawer = document.getElementById('sheet-modal');
    const overlay = document.getElementById('sheet-overlay');
    drawer.classList.remove('open');
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
}

// ─── HERO CARD (HOME) ──────────────────────────────────────────────────────

const HERO_METRIC_DEFS = {
    days:     (a) => { const d = a.length ? Math.floor((Date.now() - a[0].timestamp) / 86400000) : '—'; return { val: d, lbl: 'ימים מאז\nאחרון' }; },
    vol:      (a) => { const v = a.length ? getWorkoutVolume(a[0]) : 0; return { val: v ? v + 'kg' : '—', lbl: 'נפח\nאחרון' }; },
    duration: (a) => ({ val: (a.length && a[0].duration) ? a[0].duration + 'm' : '—', lbl: 'משך\nאחרון' }),
    avg_vol:  (a) => { const s = a.slice(0, 4); const avg = s.length ? Math.round(s.reduce((t, x) => t + getWorkoutVolume(x), 0) / s.length) : 0; return { val: avg ? avg + 'kg' : '—', lbl: 'ממוצע נפח\n4 אימונים' }; },
    total:    (a) => ({ val: a.length, lbl: 'סך\nאימונים' })
};

function renderHeroCard() {
    const prefs = getAnalyticsPrefs(), archive = getArchiveClean();
    const lastWoEl = document.getElementById('hero-last-workout');
    if (lastWoEl) {
        if (archive.length > 0) {
            const last = archive[0], days = Math.floor((Date.now() - last.timestamp) / 86400000);
            const daysStr = days === 0 ? 'היום' : days === 1 ? 'אתמול' : `לפני ${days} ימים`;
            lastWoEl.textContent = `${last.type} • ${daysStr}`;
        } else { lastWoEl.textContent = 'טרם בוצעו אימונים'; }
    }
    prefs.heroMetrics.forEach((key, i) => {
        const def = HERO_METRIC_DEFS[key], m = def ? def(archive) : { val: '—', lbl: '—' };
        const el = document.getElementById('hero-stat-' + i); if (!el) return;
        el.querySelector('.hero-stat-val').textContent = m.val;
        el.querySelector('.hero-stat-lbl').textContent = m.lbl;
    });
}

function switchMainTab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('tabbtn-' + name); if (btn) btn.classList.add('active');
    if (name === 'workout') {
        navigate('ui-week', true);
        // רענון כרטיסי "היום" בכל חזרה הביתה (גלגול חצות / עריכות במסך Composition)
        if (typeof renderHomeTodayCards === 'function') renderHomeTodayCards();
    }
    else if (name === 'analytics') {
        navigate('ui-analytics', true);
        // Sprint 2: flash skeleton בזמן המעבר; הרינדור עצמו מהיר אך המעבר הויזואלי משופר
        if (typeof showSkeleton === 'function') showSkeleton('analytics-skeleton');
        requestAnimationFrame(() => requestAnimationFrame(() => {
            renderAnalyticsDashboard();
            if (typeof hideSkeleton === 'function') hideSkeleton('analytics-skeleton');
        }));
    }
    else if (name === 'archive') {
        navigate('ui-archive', true);
        if (typeof showSkeleton === 'function') showSkeleton('archive-skeleton');
        requestAnimationFrame(() => requestAnimationFrame(() => {
            openArchive();
            if (typeof hideSkeleton === 'function') hideSkeleton('archive-skeleton');
        }));
    }
    else if (name === 'bodylog') {
        navigate('ui-bodylog', true);
        if (typeof renderBodyLog === 'function') renderBodyLog();
        // משיכת תזונה שקטה מגשר ה-Health (throttle פנימי של 15 דק')
        if (typeof syncHealthNutrition === 'function') syncHealthNutrition(false);
    }
    haptic('light');
}

// ─── ANALYTICS DASHBOARD (STITCH PERFECT) ─────────────────────────────

function renderAnalyticsDashboard() {
    const prefs = getAnalyticsPrefs(), archive = getArchiveClean();
    renderHeroMetricsGrid(archive);
    renderVolumeBarChart(archive, prefs.volumeRange, prefs.volumeMuscle || 'all');
    renderWorkoutTypeChart(archive);
    renderDonutChart(archive, prefs.muscleRange);
    renderVolumeHeatmap(archive, prefs.heatmapWeeks || 12, prefs.heatmapMuscle || 'all');
    syncHeatmapMuscleChips(prefs.heatmapMuscle || 'all');
    syncHeatmapRangeChips(prefs.heatmapWeeks || 12);
    renderConsistencyTrack(archive, prefs.consistencyRange);
    populateMicroSelector(archive);
    syncVolMuscleChips(prefs.volumeMuscle || 'all');
    
    const mr = prefs.muscleRange || '1m';
    document.querySelectorAll('#muscle-chips button').forEach(b => {
        const onclick = b.getAttribute('onclick') || '';
        const match = onclick.match(/setMuscleRange\('([^']+)'/);
        b.classList.toggle('active', match ? match[1] === mr : false);
    });
}

function syncVolMuscleChips(muscle) {
    document.querySelectorAll('#vol-muscle-chips .chip').forEach(b => {
        b.classList.toggle('active', b.dataset.muscle === muscle);
        b.classList.toggle('inactive', b.dataset.muscle !== muscle);
    });
}

function renderHeroMetricsGrid(archive) {
    const total = archive.length;
    const totalVol = archive.reduce((s, a) => s + getWorkoutVolume(a), 0);
    const totalDurMins = archive.reduce((s, a) => s + (a.duration || 0), 0);
    const bestVol = archive.reduce((mx, a) => Math.max(mx, getWorkoutVolume(a)), 0);
    const avgDur = total ? Math.round(totalDurMins / total) : 0;

    // פורמט טון — מציג בטון אם ≥1000kg, אחרת ק"ג
    const fmtVol = (kg) => kg >= 1000
        ? `${(kg / 1000).toFixed(1)}<span class="inline-unit">טון</span>`
        : `${kg.toLocaleString('he-IL')}<span class="inline-unit">ק"ג</span>`;

    const el = document.getElementById('hero-metrics-grid'); if (!el) return;

    el.innerHTML = `
        <div class="bento-card glass-card m-0 bento-glow-blue" style="margin:0;">
            <span class="material-symbols-outlined bento-icon-bg">fitness_center</span>
            <div class="bento-lbl">נפח כולל</div>
            <div class="bento-val font-headline italic-black">${fmtVol(totalVol)}</div>
        </div>
        <div class="bento-card glass-card m-0" style="margin:0;">
            <span class="material-symbols-outlined bento-icon-bg">schedule</span>
            <div class="bento-lbl">זמן כולל</div>
            <div class="bento-val font-headline italic-black" style="color:var(--text);">${Math.round(totalDurMins / 60)}<span class="inline-unit">שעות</span></div>
            ${avgDur ? `<div class="bento-sub" style="color:#47e266;">ממוצע ${avgDur} דקות</div>` : ''}
        </div>
        <div class="bento-card glass-card m-0" style="margin:0;">
            <span class="material-symbols-outlined bento-icon-bg">calendar_today</span>
            <div class="bento-lbl">אימונים</div>
            <div class="bento-val font-headline italic-black" style="color:var(--text);">${total}</div>
        </div>
        <div class="bento-card glass-card m-0 bento-glow-orange" style="margin:0;">
            <span class="material-symbols-outlined bento-icon-bg" style="color:var(--warning);">emoji_events</span>
            <div class="bento-lbl" style="color:var(--warning);">שיא נפח</div>
            <div class="bento-val font-headline italic-black" style="color:var(--warning);">${fmtVol(bestVol)}</div>
        </div>`;
}

// ─── VOLUME BAR CHART ─────────────────────────────────────────────────────

function renderVolumeBarChart(archive, n, muscleFilter) {
    const el = document.getElementById('vol-bar-chart'); if (!el) return;
    // ב-RTL, האלמנט הראשון מוצג מימין — לכן לא הופכים (newest ראשון = ימין)
    const data = archive.slice(0, n);

    if (!data.length) { el.innerHTML = '<p class="color-dim text-sm text-center w-100">אין נתונים</p>'; return; }

    const vols = data.map(a => getWorkoutVolumeFiltered(a, muscleFilter));
    const maxV = Math.max(...vols) || 1;

    el.innerHTML = `
        <div class="bar-grid-lines"><div></div><div></div><div></div><div></div></div>
        ${data.map((a, i) => {
            const pct = Math.max(10, (vols[i] / maxV * 95)).toFixed(1);
            const isPeak = vols[i] === maxV;
            const dt = (a.date || '').slice(0, 5);
            const val = vols[i] >= 1000 ? (vols[i] / 1000).toFixed(1) : vols[i];
            const unit = vols[i] >= 1000 ? 'טון' : 'ק"ג';
            return `<div class="bar-col-wrap">
                <div class="bar-lbl-top">${val}<span class="inline-unit" style="margin:0;">${unit}</span></div>
                <div class="bar${isPeak ? ' peak' : ''}" style="height:${pct}%;"></div>
                <div class="bar-lbl-btm">${dt}</div>
            </div>`;
        }).join('')}
    `;
}

function normalizeWorkoutType(rawName, aliases) {
    for (const [display, members] of Object.entries(aliases)) {
        if (members.includes(rawName)) return { display, aliased: true };
    }
    return { display: rawName, aliased: false };
}

function buildNormalizedTypeData(archive, aliases) {
    const map = {};
    archive.forEach(w => {
        const raw = w.type || 'אחר';
        const { display, aliased } = normalizeWorkoutType(raw, aliases);
        if (!map[display]) map[display] = { total: 0, count: 0, aliased, rawNames: [] };
        map[display].total += getWorkoutVolume(w);
        map[display].count++;
        if (!map[display].rawNames.includes(raw)) map[display].rawNames.push(raw);
        if (aliased) map[display].aliased = true;
    });
    return Object.entries(map)
        .map(([display, d]) => ({ display, avg: Math.round(d.total / d.count), count: d.count, aliased: d.aliased, rawNames: d.rawNames }))
        .sort((a, b) => b.avg - a.avg);
}

function renderWorkoutTypeChart(archive) {
    const el = document.getElementById('workout-type-chart'); if (!el) return;
    const prefs = getAnalyticsPrefs();
    const aliases = prefs.workoutAliases || {};
    const aliasColors = prefs.workoutAliasColors || {};
    const entries = buildNormalizedTypeData(archive, aliases);

    if (!entries.length) { el.innerHTML = '<p class="color-dim text-sm text-center">אין נתונים</p>'; return; }
    const maxAvg = Math.max(...entries.map(e => e.avg)) || 1;
    const COLORS =['#0A84FF', '#47e266', '#ffb868', '#5E5CE6', '#ff453a'];

    el.innerHTML = entries.map((e, i) => {
        const pct = (e.avg / maxAvg * 100).toFixed(1);
        const color = (e.aliased && aliasColors[e.display]) ? aliasColors[e.display] : COLORS[i % COLORS.length];
        const val = e.avg >= 1000 ? (e.avg / 1000).toFixed(1) : e.avg;
        const unit = e.avg >= 1000 ? 't' : 'kg';
        return `<div class="hbar-row" onclick="showWTToast('${escapeJsAttr(e.display)}','${escapeJsAttr(e.rawNames.join(", "))}',${e.count})">
            <div class="hbar-name-row">
                <span class="hbar-label">${escapeHtml(e.display)}</span>
                <span class="hbar-count">${e.count} אימונים</span>
            </div>
            <div class="hbar-track">
                <div class="hbar-fill" style="width:${pct}%;background:${color};box-shadow:0 0 10px ${color}40;position:relative;overflow:hidden;">
                    <span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);color:#fff;font-weight:700;font-size:0.75em;white-space:nowrap;line-height:1;">${val}${unit}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ─── WORKOUT TYPE TOAST ───────────────────────────────────────────────────

let _wtToastTimer;
function showWTToast(display, members, count) {
    const t = document.getElementById('wt-toast'); if (!t) return;
    const membersStr = members !== display ? members : `${count} אימונים`;
    t.textContent = `${display} — ${membersStr}`;
    t.classList.add('show');
    clearTimeout(_wtToastTimer);
    _wtToastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ─── ALIAS SHEET ──────────────────────────────────────────────────────────

let _aliasSelected = new Set();
let _aliasGroupName = '';
let _aliasStep = 1;
let _aliasEditingGroup = null;
let _aliasSelectedColor = '';

function openAliasSheet() {
    _aliasSelected = new Set();
    _aliasGroupName = '';
    _aliasEditingGroup = null;
    _aliasSelectedColor = '';
    _renderAliasStep1();
    document.getElementById('alias-overlay').style.display = 'block';
    document.getElementById('alias-sheet').classList.add('open');
    haptic('light');
}

function closeAliasSheet() {
    document.getElementById('alias-overlay').style.display = 'none';
    document.getElementById('alias-sheet').classList.remove('open');
}

function _renderAliasStep1() {
    _aliasStep = 1;
    const prefs = getAnalyticsPrefs();
    const aliases = prefs.workoutAliases || {};
    const archive = getArchiveClean();

    const rawMap = {};
    archive.forEach(w => {
        const t = w.type || 'אחר';
        if (!rawMap[t]) rawMap[t] = { count: 0, totalVol: 0 };
        rawMap[t].count++;
        rawMap[t].totalVol += getWorkoutVolume(w);
    });

    const rawToGroup = {};
    Object.entries(aliases).forEach(([g, ms]) => ms.forEach(m => rawToGroup[m] = g));

    let html = `<div class="sh-title">קיבוץ תוכניות</div>
        <div class="sheet-content" style="font-size:0.78em;color:var(--text-dim);margin-bottom:18px;line-height:1.5;">
            סמן אימונים שהם למעשה אותה תוכנית — לאיחוד נתונים בגרף.
        </div>`;

    if (Object.keys(aliases).length > 0) {
        html += `<div style="font-size:0.62em;color:var(--text-dim);font-weight:800;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">קבוצות קיימות</div>`;
        Object.entries(aliases).forEach(([g, ms]) => {
            html += `<div class="alias-existing-row" onclick="_editAliasGroup('${escapeJsAttr(g)}')">
                <div class="alias-eg-dot"></div>
                <div style="flex:1;">
                    <div class="alias-eg-name">${escapeHtml(g)}</div>
                    <div class="alias-eg-members">${escapeHtml(ms.join(' · '))}</div>
                </div>
                <button class="alias-del-btn" onclick="event.stopPropagation();_deleteAliasGroup('${escapeJsAttr(g)}')">מחק</button>
            </div>`;
        });
        html += `<div style="height:1px;background:rgba(255,255,255,0.07);margin:14px 0;"></div>`;
    }

    html += `<div style="font-size:0.62em;color:var(--text-dim);font-weight:800;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">קבוצה חדשה — בחר אימונים לאיחוד</div>`;

    const rawNames = Object.keys(rawMap).sort();
    rawNames.forEach(t => {
        const d = rawMap[t];
        const inGroup = rawToGroup[t];
        const isSel = _aliasSelected.has(t);
        const avgVol = d.count > 0 ? Math.round(d.totalVol / d.count) : 0;
        const avgStr = avgVol >= 1000 ? (avgVol / 1000).toFixed(1) + 't' : avgVol + 'kg';
        html += `<div class="alias-raw-row" onclick="_toggleAliasSelect('${escapeJsAttr(t)}')">
            <div class="alias-check${isSel ? ' on' : ''}"></div>
            <div style="flex:1;">
                <div class="alias-type-name">${escapeHtml(t)}</div>
                <div class="alias-meta">${d.count} אימונים · ממוצע ${avgStr}</div>
            </div>
            ${inGroup ? `<span class="alias-group-badge">${escapeHtml(inGroup)}</span>` : ''}
        </div>`;
    });

    const canNext = _aliasSelected.size >= 2;
    html += `<button class="btn-main primary-gradient" style="margin-top:16px;" ${canNext ? '' : 'disabled'} onclick="_renderAliasStep2()">
        המשך${_aliasSelected.size >= 2 ? ` (${_aliasSelected.size} נבחרו)` : ''}
    </button>
    <button class="btn-text" onclick="closeAliasSheet()">ביטול</button>`;

    document.getElementById('alias-sheet-body').innerHTML = html;
}

function _toggleAliasSelect(name) {
    if (_aliasSelected.has(name)) _aliasSelected.delete(name); else _aliasSelected.add(name);
    _renderAliasStep1();
    haptic('light');
}

function _deleteAliasGroup(g) {
    const prefs = getAnalyticsPrefs();
    delete prefs.workoutAliases[g];
    if (prefs.workoutAliasColors) delete prefs.workoutAliasColors[g];
    saveAnalyticsPrefs(prefs);
    renderWorkoutTypeChart(getArchiveClean());
    _renderAliasStep1();
    haptic('warning');
}

function _editAliasGroup(g) {
    const prefs = getAnalyticsPrefs();
    const members = prefs.workoutAliases[g] || [];
    _aliasSelected = new Set(members);
    _aliasGroupName = g;
    _aliasEditingGroup = g;
    _aliasSelectedColor = (prefs.workoutAliasColors || {})[g] || '';
    delete prefs.workoutAliases[g];
    saveAnalyticsPrefs(prefs);
    _renderAliasStep2();
}

function _renderAliasStep2() {
    _aliasStep = 2;
    const selArr = [..._aliasSelected];
    const suggested = _aliasGroupName || selArr.reduce((a, b) => a.length <= b.length ? a : b, selArr[0] || '');

    const prefs = getAnalyticsPrefs();
    const aliasColors = prefs.workoutAliasColors || {};
    const currentColor = _aliasEditingGroup ? (aliasColors[_aliasEditingGroup] || '') : (_aliasGroupName ? (aliasColors[_aliasGroupName] || '') : '');
    if (!_aliasSelectedColor) _aliasSelectedColor = currentColor;

    const swatchesHtml = WORKOUT_COLORS.map(c =>
        `<div class="color-swatch alias-color-swatch${_aliasSelectedColor === c.hex ? ' active' : ''}"
            style="background:${c.hex};"
            title="${c.name}"
            onclick="_selectAliasColor('${c.hex}',this)"></div>`
    ).join('');

    const html = `<div class="sh-title">שם וצבע</div>
        <div class="sheet-content" style="font-size:0.78em;color:var(--text-dim);margin-bottom:18px;line-height:1.5;">
            בחר שם וצבע שייצגו את הקבוצה בגרף.
        </div>
        <div class="alias-name-field">
            <div class="alias-name-lbl">שם תצוגה מקוצר</div>
            <input class="alias-name-input" id="alias-name-inp" type="text"
                value="${suggested}"
                placeholder="לדוגמה: חזה"
                oninput="_onAliasNameInput(this.value)"
                onkeydown="if(event.key==='Enter')_renderAliasStep3()">
        </div>
        <div class="alias-name-field" style="margin-top:14px;">
            <div class="alias-name-lbl">צבע מזהה (אופציונלי)</div>
            <div class="color-swatches-row" style="margin-top:8px;">${swatchesHtml}</div>
        </div>
        <div class="alias-preview-box">
            <div class="alias-preview-lbl">אימונים שיאוחדו</div>
            ${selArr.map(n => `<span class="alias-preview-tag">${n}</span>`).join('')}
        </div>
        <button class="btn-main primary-gradient" id="alias-btn-step3" ${suggested ? '' : 'disabled'} onclick="_renderAliasStep3()">המשך</button>
        <button class="btn-text" onclick="_renderAliasStep1()">⟵ חזור</button>`;

    document.getElementById('alias-sheet-body').innerHTML = html;
    _aliasGroupName = suggested;
    setTimeout(() => {
        const inp = document.getElementById('alias-name-inp');
        if (inp) { inp.focus(); inp.select(); }
    }, 80);
}

function _onAliasNameInput(v) {
    _aliasGroupName = v.trim();
    const btn = document.getElementById('alias-btn-step3');
    if (btn) btn.disabled = _aliasGroupName.length < 1;
}

function _selectAliasColor(hex, el) {
    _aliasSelectedColor = (_aliasSelectedColor === hex) ? '' : hex;
    document.querySelectorAll('.alias-color-swatch').forEach(s => s.classList.remove('active'));
    if (_aliasSelectedColor && el) el.classList.add('active');
    haptic('light');
}

function _renderAliasStep3() {
    if (!_aliasGroupName) return;
    _aliasStep = 3;
    const selArr = [..._aliasSelected];
    const archive = getArchiveClean();
    const rawMap = {};
    archive.forEach(w => { const t = w.type || 'אחר'; if (!rawMap[t]) rawMap[t] = { count: 0, totalVol: 0 }; rawMap[t].count++; rawMap[t].totalVol += getWorkoutVolume(w); });
    const totalCount = selArr.reduce((s, n) => s + (rawMap[n] ? rawMap[n].count : 0), 0);
    const totalVol = selArr.reduce((s, n) => s + (rawMap[n] ? rawMap[n].totalVol : 0), 0);
    const avgVol = totalCount > 0 ? Math.round(totalVol / totalCount) : 0;
    const avgStr = avgVol >= 1000 ? (avgVol / 1000).toFixed(1) + 't' : avgVol + 'kg';

    const html = `<div class="sh-title">אישור איחוד</div>
        <div class="sheet-content" style="font-size:0.78em;color:var(--text-dim);margin-bottom:18px;">כך זה ייראה לאחר השמירה:</div>
        <div class="alias-confirm-box">
            <div class="alias-confirm-name">${_aliasGroupName}</div>
            <div style="font-size:0.72em;color:var(--text-dim);margin-bottom:6px;">${totalCount} אימונים · ממוצע ${avgStr}</div>
            <div class="alias-confirm-arrow">מכיל ↓</div>
            <div class="alias-confirm-tags">
                ${selArr.map(n => `<span class="alias-confirm-tag">${n}</span>`).join('')}
            </div>
        </div>
        <button class="btn-main success-gradient" onclick="_saveAliasGroup()">✓ שמור קבוצה</button>
        <button class="btn-text" onclick="_renderAliasStep2()">⟵ חזור</button>`;

    document.getElementById('alias-sheet-body').innerHTML = html;
}

function _saveAliasGroup() {
    const prefs = getAnalyticsPrefs();
    if (!prefs.workoutAliases) prefs.workoutAliases = {};
    if (!prefs.workoutAliasColors) prefs.workoutAliasColors = {};
    prefs.workoutAliases[_aliasGroupName] = [..._aliasSelected];
    if (_aliasSelectedColor) {
        prefs.workoutAliasColors[_aliasGroupName] = _aliasSelectedColor;
    } else {
        delete prefs.workoutAliasColors[_aliasGroupName];
    }
    saveAnalyticsPrefs(prefs);
    renderWorkoutTypeChart(getArchiveClean());
    closeAliasSheet();
    haptic('success');
    showWTToast(_aliasGroupName, [..._aliasSelected].join(', '), 0);
}

// ─── DONUT CHART ──────────────────────────────────────────────────────────

const DONUT_COLORS =['#0A84FF', '#47e266', '#ffb868', '#BF5AF2', '#ff453a', '#AEAEB2'];

function renderDonutChart(archive, range) {
    const svgEl = document.getElementById('donut-svg-el');
    const centerEl = document.getElementById('donut-center-lbl');
    const legendEl = document.getElementById('donut-legend-el');
    if (!svgEl || !centerEl || !legendEl) return;
    const map = getMuscleSetCounts(archive, range);
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = entries.reduce((s, e) => s + e[1], 0);
    
    if (!total) { 
        svgEl.innerHTML = '<circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="12"/>'; 
        centerEl.innerHTML = '<div class="val">—</div><div class="lbl">סטים</div>'; 
        legendEl.innerHTML = '<div class="color-dim text-sm text-center">אין נתונים</div>'; 
        return; 
    }
    
    const r = 40, ci = 2 * Math.PI * r;
    let offset = 0, circles = '', legendHtml = '';
    entries.forEach(([name, sets], i) => {
        const da = (sets / total * ci).toFixed(2), gap = (ci - parseFloat(da)).toFixed(2);
        circles += `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${DONUT_COLORS[i]}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${da} ${gap}" stroke-dashoffset="${(-offset).toFixed(2)}"/>`;
        legendHtml += `
            <div class="legend-row">
                <div class="legend-left">
                    <div class="legend-dot" style="background:${DONUT_COLORS[i]}"></div>
                    <span class="font-bold text-xs" style="opacity:0.8; text-transform:uppercase;">${name}</span>
                </div>
                <span class="font-headline italic-black" style="font-size:0.85rem;">${sets} <span style="font-size:0.55rem; opacity:0.5; font-family:'Inter'; font-weight:700; font-style:normal;">סטים</span></span>
            </div>`;
        offset += parseFloat(da);
    });
    svgEl.innerHTML = `<circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="12"/>${circles}`;
    centerEl.innerHTML = `<div class="val">${total}</div><div class="lbl">סטים</div>`;
    legendEl.innerHTML = legendHtml;
}

// ─── CONSISTENCY TRACK ────────────────────────────────────────────────────

function renderConsistencyTrack(archive, n) {
    const el = document.getElementById('cons-track'); if (!el) return;
    // ללא reverse: האימון החדש ביותר מקבל אינדקס 0, ולכן ירונדר ראשון (הכי ימינה ב-RTL)
    const data = archive.slice(0, n);
    if (data.length < 2) { el.innerHTML = '<p class="color-dim text-sm text-center w-100">נדרשים לפחות 2 אימונים למעקב</p>'; return; }

    const prefs = getAnalyticsPrefs();
    let greenT, orangeT;
    if (prefs.consistencyGreen && prefs.consistencyOrange) {
        greenT = prefs.consistencyGreen;
        orangeT = prefs.consistencyOrange;
    } else {
        let medianGap = 7;
        if (archive.length >= 3) {
            const gaps =[];
            for (let i = 1; i < archive.length; i++) gaps.push((archive[i - 1].timestamp - archive[i].timestamp) / 86400000);
            gaps.sort((a, b) => a - b);
            medianGap = gaps[Math.floor(gaps.length / 2)];
        }
        greenT = Math.max(2, Math.round(medianGap * 1.25));
        orangeT = Math.max(greenT + 1, Math.round(medianGap * 1.75));
    }

    const legendEl = document.getElementById('cons-legend');
    if (legendEl) legendEl.innerHTML = `
        <span style="color:var(--type-b); font-size:0.65rem; font-weight:700;">● ≤${greenT} ימים</span>
        <span style="color:var(--type-c); font-size:0.65rem; font-weight:700; margin:0 8px;">● ${greenT + 1}–${orangeT} ימים</span>
        <span style="color:var(--danger); font-size:0.65rem; font-weight:700;">● ${orangeT + 1}+ ימים</span>`;

    let html = `<div class="cons-line"></div>`;
    
    data.forEach((w, i) => {
        const dt = new Date(w.timestamp);
        let dtStr = `${dt.getDate().toString().padStart(2,'0')}.${(dt.getMonth()+1).toString().padStart(2,'0')}`;
        if (i === 0 && Math.floor((Date.now() - w.timestamp) / 86400000) === 0) dtStr = 'היום';

        let iconHtml = '', wrapCls = '';
        
        if (i < data.length - 1) {
            const days = Math.round((data[i].timestamp - data[i + 1].timestamp) / 86400000);
            if (days <= greenT) { wrapCls = 'ok'; iconHtml = '<span class="material-symbols-outlined icon-fill" style="font-size:18px;">check_circle</span>'; }
            else if (days <= orangeT) { wrapCls = 'warn'; iconHtml = '<span class="material-symbols-outlined icon-fill" style="font-size:18px;">error</span>'; }
            else { wrapCls = 'empty'; iconHtml = '<span class="material-symbols-outlined icon-fill" style="font-size:18px; opacity:0.3;">circle</span>'; }
        } else {
            wrapCls = 'ok'; iconHtml = '<span class="material-symbols-outlined icon-fill" style="font-size:18px;">check_circle</span>';
        }
        
        html += `<div class="cons-node">
            <div class="cons-icon-wrap ${wrapCls}">${iconHtml}</div>
            <span class="cons-day">${dtStr}</span>
        </div>`;
    });
    el.innerHTML = html;
}

// ─── MICRO SELECTOR ───────────────────────────────────────────────────────

function populateMicroSelector(archive) {
    const sel = document.getElementById('micro-ex-selector'); if (!sel) return;
    const prefs = getAnalyticsPrefs();
    const exMap = {};
    archive.forEach((w, idx) => {
        if (!w.details) return;
        Object.keys(w.details).forEach(exName => {
            if (!exMap[exName]) { const ex = state.exercises.find(e => e.name === exName); exMap[exName] = { isCalc: ex ? !!ex.isCalc : false, lastSeenIdx: idx }; }
        });
    });

    let sorted;
    if (prefs.microOrder && prefs.microOrder.length > 0) {
        sorted = prefs.microOrder.filter(e => exMap[e]);
        Object.keys(exMap).forEach(e => { if (!sorted.includes(e)) sorted.push(e); });
    } else {
        const pinned = DEFAULT_MICRO_ORDER.filter(e => exMap[e]);
        const rest = Object.keys(exMap)
            .filter(e => !pinned.includes(e))
            .sort((a, b) => {
                const da = exMap[a], db = exMap[b];
                if (da.isCalc !== db.isCalc) return da.isCalc ? -1 : 1;
                return a.localeCompare(b);
            });
        sorted = [...pinned, ...rest];
    }

    const current = sel.value;
    sel.innerHTML = sorted.map(e => `<option value="${e}">${e}</option>`).join('');
    if (current && exMap[current]) sel.value = current;
    
    const display = document.getElementById('micro-ex-display');
    if (sel.options.length > 0) {
        if (!sel.value) sel.value = sel.options[0].value;
        if (display) display.textContent = sel.value;
        loadMicroData(sel.value);
    } else {
        if (display) display.textContent = "אין נתונים בארכיון";
    }
}

// ─── MICRO SORT SHEET ─────────────────────────────────────────────────────

function openMicroSortSheet() {
    const prefs = getAnalyticsPrefs(), archive = getArchiveClean();
    const exMap = {};
    archive.forEach(w => { if (w.details) Object.keys(w.details).forEach(e => { exMap[e] = true; }); });
    let order = (prefs.microOrder || []).filter(e => exMap[e]);
    Object.keys(exMap).forEach(e => { if (!order.includes(e)) order.push(e); });

    const content = document.getElementById('micro-sort-content'); if (!content) return;
    content.innerHTML = order.map((ex, i) => `
        <div class="micro-sort-row">
            <span class="micro-sort-name">${ex}</span>
            <div class="micro-sort-btns">
                <button class="micro-sort-btn" onclick="moveMicroOrder(${i}, -1)" ${i === 0 ? 'disabled' : ''}>↑</button>
                <button class="micro-sort-btn" onclick="moveMicroOrder(${i}, 1)" ${i === order.length - 1 ? 'disabled' : ''}>↓</button>
            </div>
        </div>`).join('');

    document.getElementById('micro-sort-overlay').style.display = 'block';
    document.getElementById('micro-sort-sheet').classList.add('open');
    haptic('light');
}

function moveMicroOrder(idx, dir) {
    const prefs = getAnalyticsPrefs(), archive = getArchiveClean();
    const exMap = {};
    archive.forEach(w => { if (w.details) Object.keys(w.details).forEach(e => { exMap[e] = true; }); });
    let order = (prefs.microOrder || []).filter(e => exMap[e]);
    Object.keys(exMap).forEach(e => { if (!order.includes(e)) order.push(e); });
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= order.length) return;
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    prefs.microOrder = order;
    saveAnalyticsPrefs(prefs);
    haptic('light');
    openMicroSortSheet();
    populateMicroSelector(archive);
}

function closeMicroSortSheet() {
    document.getElementById('micro-sort-overlay').style.display = 'none';
    document.getElementById('micro-sort-sheet').classList.remove('open');
}

// ─── MICRO: LOAD DATA ─────────────────────────────────────────────────────

// ─── MICRO: מצב בחירת נקודה אינטראקטיבית ──────────────────────────────────
let _microVals = [];
let _microDates = [];
let _microRelevant = [];
let _microSelectedPt = -1;

function loadMicroData(exName) {
    if (!exName) return;
    const display = document.getElementById('micro-ex-display');
    if (display) display.textContent = exName;

    _microSelectedPt = -1; // איפוס בחירה בעת מעבר תרגיל

    const prefs = getAnalyticsPrefs(), archive = getArchiveClean();
    const relevant = archive
        .filter(w => w.details && w.details[exName] && w.details[exName].sets && w.details[exName].sets.length)
        .slice(0, prefs.microPoints)
        .reverse(); // לגרף צריכים משמאל לימין (מהישן לחדש)

    const heroEl = document.getElementById('micro-hero-e1rm');
    const lineSvg = document.getElementById('micro-line-svg');
    const datesEl = document.getElementById('micro-line-dates');

    // עדכון כותרת לפי הבורר הנוכחי
    const lbl = document.querySelector('.micro-hero-lbl');
    if (lbl) {
        if (prefs.microAxis === 'e1rm' || !prefs.microAxis) lbl.textContent = 'הערכת 1RM';
        else if (prefs.microAxis === 'maxw') lbl.textContent = 'משקל מקסימלי';
        else if (prefs.microAxis === 'vol')  lbl.textContent = 'נפח';
    }

    if (!relevant.length) {
        if (lineSvg) lineSvg.innerHTML = '<text x="200" y="80" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="14" font-family="Inter">אין מספיק נתונים</text>';
        if (datesEl) datesEl.innerHTML = '';
        if (heroEl) heroEl.innerHTML = `—`;
        _microVals = []; _microDates = []; _microRelevant = [];
        renderPRCard(exName, [], prefs);
        renderPlateauCard(exName);
        renderPRPredictionCard(exName);
        return;
    }

    const vals = relevant.map(w => {
        const parsed = getEntryExerciseSets(w, exName);
        if (!parsed.length) return 0;
        if (prefs.microAxis === 'vol') return w.details[exName].vol || 0;
        if (prefs.microAxis === 'maxw') return Math.max(...parsed.map(s => s.w));
        return Math.max(...parsed.map(s => calc1RM(s.w, s.r, prefs.formula)));
    });

    // שמירת נתונים לשימוש אינטראקטיבי
    _microVals = vals;
    _microDates = relevant.map(w => {
        const d = new Date(w.timestamp);
        return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}`;
    });
    _microRelevant = relevant;

    if (heroEl) {
        const val = Math.round(vals[vals.length - 1]);
        const unit = prefs.microAxis === 'vol' && val >= 1000 ? 't' : 'kg';
        const displayVal = prefs.microAxis === 'vol' && val >= 1000 ? (val / 1000).toFixed(1) : val;
        heroEl.innerHTML = `${displayVal}<span class="inline-unit">${unit}</span>`;
    }

    drawMicroLineChart(vals, _microDates);
    renderPRCard(exName, relevant, prefs);
    renderPlateauCard(exName);
    renderPRPredictionCard(exName);
}

function calc1RM(w, r, formula) {
    if (!formula || formula === 'epley') return w * (1 + r / 30);
    if (formula === 'brzycki') return r < 37 ? w / (1.0278 - 0.0278 * r) : w;
    if (formula === 'lombardi') return w * Math.pow(r, 0.10);
    return w * (1 + r / 30);
}

function parseSetsFromStrings(sets) {
    return sets.map(s => {
        try {
            // Regex חסין במיוחד ששולף נתונים גם אם יש טקסט מיותר מסביב (כמו Notes או כיתובים שונים)
            // פלטות נספרות ביחידות פלטה — עקבי בתוך אותו תרגיל; סטים של BW מסוננים (אין משקל)
            const wMatch = s.match(/([\d\.]+)\s*kg/) || s.match(/([\d\.]+)\s*פלטות/);
            const w = wMatch ? parseFloat(wMatch[1]) : 0;

            const rMatch = s.match(/x\s*(\d+)/);
            const r = rMatch ? parseInt(rMatch[1]) : 0;

            const rirMatch = s.match(/RIR\s*([\d\.]+)/);
            const rir = rirMatch ? parseFloat(rirMatch[1]) : '—'; // שולף נקי ללא סוגריים

            if (!w || !r) return null;
            return { w, r, rir };
        } catch (e) { return null; }
    }).filter(Boolean);
}

// getEntryExerciseSets — Helper מרכזי לשליפת סטים מפורסרים מתוך archive entry.
// מחזיר [] אם entry/exercise חסרים — מבטל את הצורך ב-null-checks חוזרים בכל קורא.
function getEntryExerciseSets(entry, exName) {
    if (!entry || !entry.details || !entry.details[exName]) return [];
    return parseSetsFromStrings(entry.details[exName].sets || []);
}

function getSmoothPath(points) {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0][0]},${points[0][1]}`;
    let path = `M ${points[0][0]},${points[0][1]} `;
    for (let i = 0; i < points.length - 1; i++) {
        const x0 = points[i][0], y0 = points[i][1];
        const x1 = points[i + 1][0], y1 = points[i + 1][1];
        const cp1x = x0 + (x1 - x0) / 2;
        const cp1y = y0;
        const cp2x = x0 + (x1 - x0) / 2;
        const cp2y = y1;
        path += `C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x1},${y1} `;
    }
    return path;
}

function selectMicroPoint(idx) {
    _microSelectedPt = (_microSelectedPt === idx) ? -1 : idx;
    drawMicroLineChart(_microVals, _microDates);
}

// Sprint 4: מאפשר touchmove/mousemove על ה-SVG → בחירת הנקודה הקרובה ביותר
function _attachMicroChartTouch() {
    const svg = document.getElementById('micro-line-svg');
    if (!svg || svg._touchAttached) return;
    svg._touchAttached = true;

    const handleAt = (clientX) => {
        if (!_microVals || _microVals.length < 2) return;
        const rect = svg.getBoundingClientRect();
        if (!rect.width) return;
        // SVG viewBox: 0 0 400 160, padding L=20 R=20
        const padL = 20, padR = 20, W = 400;
        const cW = W - padL - padR;
        const n = _microVals.length;
        const relX = (clientX - rect.left) / rect.width;
        const vbX = relX * W;
        const idx = Math.round(((vbX - padL) / cW) * (n - 1));
        const clamped = Math.max(0, Math.min(n - 1, idx));
        if (clamped !== _microSelectedPt) {
            _microSelectedPt = clamped;
            drawMicroLineChart(_microVals, _microDates);
            if (typeof haptic === 'function') haptic('light');
        }
    };

    svg.addEventListener('touchstart', (e) => { if (e.touches[0]) handleAt(e.touches[0].clientX); }, { passive: true });
    svg.addEventListener('touchmove',  (e) => { if (e.touches[0]) { e.preventDefault(); handleAt(e.touches[0].clientX); } }, { passive: false });
    // Mouse fallback ל-desktop
    svg.addEventListener('mousedown',  (e) => handleAt(e.clientX));
    svg.addEventListener('mousemove',  (e) => { if (e.buttons & 1) handleAt(e.clientX); });
}

function drawMicroLineChart(vals, dates) {
    const svg = document.getElementById('micro-line-svg');
    const datesEl = document.getElementById('micro-line-dates');
    if (!svg || !datesEl) return;
    // Sprint 4: רישום מאזיני touch פעם אחת בלבד (idempotent דרך flag על האלמנט)
    _attachMicroChartTouch();

    const n = vals.length;
    if (n < 2) {
        svg.innerHTML = '<text x="200" y="80" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="14" font-family="Inter">אין מספיק נתונים למגמה</text>';
        datesEl.innerHTML = '';
        return;
    }

    const W = 400, H = 160, pad = { t: 20, b: 15, l: 20, r: 20 };
    const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
    const spread = Math.max(...vals) - Math.min(...vals);
    const mn = Math.min(...vals) - (spread > 0 ? spread * 0.2 : 10);
    const mx = Math.max(...vals) + (spread > 0 ? spread * 0.2 : 10);

    const px = i => pad.l + (i / (n - 1)) * cW;
    const py = v => pad.t + cH - ((v - mn) / ((mx - mn) || 1)) * cH;
    const pts = vals.map((v, i) => [px(i), py(v)]);

    const linePath = getSmoothPath(pts);
    const areaPath = linePath + ` L${pts[n - 1][0]},${H} L${pts[0][0]},${H} Z`;
    const lastPt = pts[n - 1];

    // נקודה נבחרת — dot + tooltip בתוך ה-SVG
    let selectedOverlay = '';
    const selIdx = _microSelectedPt;
    if (selIdx >= 0 && selIdx < n) {
        const sx = pts[selIdx][0], sy = pts[selIdx][1];
        const prefs = getAnalyticsPrefs();
        const rawVal = vals[selIdx];
        const isVol = prefs.microAxis === 'vol';
        const displayVal = isVol && rawVal >= 1000
            ? (rawVal / 1000).toFixed(1) + 't'
            : Math.round(rawVal) + 'kg';
        const label = dates[selIdx] + '  ' + displayVal;
        const labelW = Math.max(label.length * 6.5, 80);
        // מיקום tooltip: מעל הנקודה, תמיד בתוך הגרף
        const tipX = Math.min(Math.max(sx, pad.l + labelW / 2), W - pad.r - labelW / 2);
        const tipY = Math.max(sy - 28, pad.t + 2);

        selectedOverlay = `
            <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="9" fill="#0A84FF" opacity="0.25"/>
            <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="5" fill="#0A84FF"/>
            <rect x="${(tipX - labelW / 2).toFixed(1)}" y="${(tipY - 10).toFixed(1)}"
                width="${labelW.toFixed(1)}" height="17" rx="5"
                fill="rgba(18,18,20,0.92)" stroke="#0A84FF" stroke-width="0.8"/>
            <text x="${tipX.toFixed(1)}" y="${(tipY + 3).toFixed(1)}"
                fill="#fff" font-size="9.5" text-anchor="middle"
                font-weight="700" font-family="-apple-system,Inter,sans-serif">${label}</text>`;
    }

    svg.innerHTML = `
        <defs>
            <linearGradient id="chart-grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="#0A84FF"></stop>
                <stop offset="100%" stop-color="transparent"></stop>
            </linearGradient>
        </defs>
        <path d="${areaPath}" fill="url(#chart-grad)" opacity="0.25"></path>
        <path d="${linePath}" fill="none" stroke="#0A84FF" stroke-width="4" stroke-linecap="round"></path>
        <circle cx="${lastPt[0]}" cy="${lastPt[1]}" r="6" fill="#0A84FF"></circle>
        <circle cx="${lastPt[0]}" cy="${lastPt[1]}" r="12" fill="none" stroke="#0A84FF" stroke-width="2" opacity="0.4"></circle>
        ${selectedOverlay}
    `;

    // תאריכים — עם onclick לכל span
    datesEl.innerHTML = dates.map((d, i) =>
        `<span class="${i === selIdx ? 'micro-date-active' : ''}" onclick="selectMicroPoint(${i})" style="cursor:pointer;">${d}</span>`
    ).join('');
}

function renderPRCard(exName, relevant, prefs) {
    let bestE1RM = 0, prW = 0, prR = 1, prRIR = '—', prDate = '';
    relevant.forEach(w => {
        getEntryExerciseSets(w, exName).forEach(s => {
            const e1rm = calc1RM(s.w, s.r, prefs.formula);
            if (e1rm > bestE1RM) {
                bestE1RM = e1rm; prW = s.w; prR = s.r; prRIR = s.rir;
                const d = new Date(w.timestamp);
                prDate = `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}`;
            }
        });
    });
    
    const e1rmEl = document.getElementById('pr-card-e1rm');
    if(e1rmEl) e1rmEl.innerHTML = prW ? `${Math.round(bestE1RM)}<span class="inline-unit">kg</span>` : '—';
    
    document.getElementById('pr-card-weight').innerHTML = prW ? `${prW}<span class="inline-unit">kg</span>` : '—';
    document.getElementById('pr-card-date').textContent = prDate ? 'נקבע ב-' + prDate : 'טרם נקבע';
    document.getElementById('pr-card-reps').textContent = prW ? prR : '—';
    document.getElementById('pr-card-rir').textContent = prW ? prRIR : '—';
}

function togglePRCard() {}

// ════════════════════════════════════════════════════════════════════
// ─── SPRINT 3 — ANALYTICS ENGINE ────────────────────────────────────
// ════════════════════════════════════════════════════════════════════

// מחזיר Date של תחילת השבוע (יום ראשון 00:00) שמכיל timestamp נתון
function _startOfWeek(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay()); // יום ראשון = 0
    return d;
}

// רגרסיה לינארית פשוטה: מקבל מערך {x,y} ומחזיר {slope,intercept,r2,stderr,n}
function _linearRegression(pts) {
    const n = pts.length;
    if (n < 2) return { slope: 0, intercept: 0, r2: 0, stderr: 0, n };
    const sx = pts.reduce((s, p) => s + p.x, 0);
    const sy = pts.reduce((s, p) => s + p.y, 0);
    const mx = sx / n, my = sy / n;
    let num = 0, den = 0, ssTot = 0;
    pts.forEach(p => {
        num += (p.x - mx) * (p.y - my);
        den += (p.x - mx) * (p.x - mx);
        ssTot += (p.y - my) * (p.y - my);
    });
    const slope = den === 0 ? 0 : num / den;
    const intercept = my - slope * mx;
    let ssRes = 0;
    pts.forEach(p => { const yh = slope * p.x + intercept; ssRes += (p.y - yh) ** 2; });
    const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
    const stderr = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
    return { slope, intercept, r2, stderr, n };
}

// ─── HEATMAP ──────────────────────────────────────────────────────────

// צבעים לפי שריר עיקרי — מציג בצורה ויזואלית מי "אכל" את היום
const HEATMAP_MUSCLE_COLORS = {
    'חזה':       '#ff453a',
    'גב':        '#47e266',
    'רגליים':    '#5E5CE6',
    'כתפיים':    '#ffb868',
    'ידיים':     '#0A84FF',
    'בטן':       '#8E8E93',
    'קליסטניקס': '#bf5af2',
    '_mixed':    '#a8a8b3'
};
const HEATMAP_MAIN_MUSCLES = ['חזה', 'גב', 'רגליים', 'כתפיים', 'ידיים'];

// פורמט נפח קצר — "5.2t" / "850" / "—"
function _fmtVolShort(v) {
    if (!v) return '—';
    return v >= 1000 ? (v / 1000).toFixed(1) + 't' : Math.round(v).toString();
}

// Hex (#rrggbb) → rgba string עם alpha — שומר על טקסט בעוצמה מלאה
function _hexToRGBA(hex, alpha) {
    if (!hex || hex[0] !== '#' || hex.length !== 7) return `rgba(10,132,255,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

// השריר הדומיננטי בתא — שריר עם > 50% מהנפח, אחרת 'mixed'
function _dominantMuscle(breakdown) {
    const entries = Object.entries(breakdown || {});
    if (!entries.length) return '_mixed';
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (total === 0) return '_mixed';
    entries.sort((a, b) => b[1] - a[1]);
    const [topName, topVol] = entries[0];
    if (topVol / total > 0.5) return topName;
    return '_mixed';
}

// אגרגציה: שבועות × ימים → {vol, sets, breakdown} פר תא.
// breakdown — מילון של שריר→נפח (שמיש בעיקר במצב 'all' לקבוע צבע דומיננטי).
function _aggregateDailyByMuscle(archive, weeks, muscleFilter) {
    const today = _startOfWeek(Date.now());
    const startMs = today.getTime() - (weeks - 1) * 7 * 86400000;
    const grid = []; // grid[weekIdx][dayIdx] = {vol, sets, date, breakdown}
    for (let w = 0; w < weeks; w++) {
        const weekStart = startMs + w * 7 * 86400000;
        const row = [];
        for (let d = 0; d < 7; d++) {
            row.push({ vol: 0, sets: 0, date: new Date(weekStart + d * 86400000), breakdown: {} });
        }
        grid.push(row);
    }

    archive.forEach(entry => {
        if (entry.timestamp < startMs) return;
        const wd = new Date(entry.timestamp);
        const wkIdx = Math.floor((_startOfWeek(entry.timestamp).getTime() - startMs) / (7 * 86400000));
        if (wkIdx < 0 || wkIdx >= weeks) return;
        const dayIdx = wd.getDay();
        if (!entry.details) return;

        Object.entries(entry.details).forEach(([exName, ex]) => {
            const exData = state.exercises.find(e => e.name === exName);
            const muscles = exData ? (exData.muscles || []) : [];
            const include = (muscleFilter === 'all') || muscles.includes(muscleFilter);
            if (!include) return;
            const exVol = ex.vol || 0;
            const exSets = ex.sets ? ex.sets.length : 0;
            grid[wkIdx][dayIdx].vol += exVol;
            grid[wkIdx][dayIdx].sets += exSets;
            // פיזור נפח שווה בין השרירים הראשיים בלבד — כדי לבחור צבע דומיננטי
            const mainMuscles = muscles.filter(m => HEATMAP_MAIN_MUSCLES.includes(m));
            if (mainMuscles.length && exVol > 0) {
                const per = exVol / mainMuscles.length;
                mainMuscles.forEach(m => {
                    grid[wkIdx][dayIdx].breakdown[m] = (grid[wkIdx][dayIdx].breakdown[m] || 0) + per;
                });
            }
        });
    });

    return grid;
}

function renderVolumeHeatmap(archive, weeks, muscleFilter) {
    const tableEl = document.getElementById('heatmap-grid'); if (!tableEl) return;
    const tooltipEl = document.getElementById('heatmap-tooltip');
    const footerEl = document.getElementById('heatmap-footer');
    const legendEl = document.getElementById('heatmap-legend');

    const data = _aggregateDailyByMuscle(archive, weeks, muscleFilter);
    const allVols = data.flat().map(c => c.vol).filter(v => v > 0);
    // נקודת ייחוס: ממוצע יום פעיל. עוצמת הצבע נקבעת לפי קרבה לממוצע
    // — סקלה לוגריתמית סביב 1.0 (=יום ממוצע) מבטיחה שגם יום נמוך וגם יום גבוה
    // יראו בבירור שונה מיום טיפוסי, במקום שיתאחדו על קצוות המגוון.
    const avgDayVol = allVols.length ? allVols.reduce((s, v) => s + v, 0) / allVols.length : 1;

    // סיכומים שבועיים
    const weekTotals = data.map(row => row.reduce((s, c) => s + c.vol, 0));
    const activeWeeks = weekTotals.filter(t => t > 0);
    const avgWeek = activeWeeks.length ? activeWeeks.reduce((s, t) => s + t, 0) / activeWeeks.length : 0;

    // Header — spacer + 7 day labels בגריד פנימי + "סה"כ"
    const dayLabelsHTML = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
        .map(d => `<div class="hm-day-lbl">${d}</div>`).join('');
    let html = `<div class="hm-header">
        <div></div>
        <div class="hm-cells-grid">${dayLabelsHTML}</div>
        <div class="hm-total-head">סה״כ</div>
    </div>`;

    // שורות לפי שבוע (ישן בראש, חדש בתחתית)
    data.forEach((row, wkIdx) => {
        const sunday = row[0].date;
        const wkLabel = `${sunday.getDate().toString().padStart(2, '0')}.${(sunday.getMonth() + 1).toString().padStart(2, '0')}`;

        // התאים בגריד פנימי משלהם — מנותקים מגובה ה-week-total כך שאספקט-1:1 נשמר
        let cellsHTML = '';
        row.forEach(cell => {
            const isEmpty = cell.vol === 0;
            const dStr = `${cell.date.getDate().toString().padStart(2, '0')}.${(cell.date.getMonth() + 1).toString().padStart(2, '0')}`;
            if (isEmpty) {
                cellsHTML += `<div class="heatmap-cell empty" data-vol="0" data-sets="0" data-date="${dStr}" onclick="_onHeatmapCellClick(this)"></div>`;
                return;
            }
            // סקלה לוגריתמית סביב הממוצע: יום=ממוצע→0.7, חצי-ממוצע≈0.45, פי-2≈0.98
            const ratio = cell.vol / avgDayVol;
            const intensity = Math.max(0.22, Math.min(1, 0.7 + Math.log2(ratio) * 0.28));
            let baseColor;
            if (muscleFilter === 'all') {
                const dom = _dominantMuscle(cell.breakdown);
                baseColor = HEATMAP_MUSCLE_COLORS[dom] || HEATMAP_MUSCLE_COLORS._mixed;
            } else {
                baseColor = HEATMAP_MUSCLE_COLORS[muscleFilter] || '#0A84FF';
            }
            const bgRGBA = _hexToRGBA(baseColor, intensity);
            cellsHTML += `<div class="heatmap-cell has-vol" style="background:${bgRGBA};" data-vol="${Math.round(cell.vol)}" data-sets="${cell.sets}" data-date="${dStr}" data-bk='${JSON.stringify(cell.breakdown).replace(/'/g, "&#39;")}' onclick="_onHeatmapCellClick(this)"></div>`;
        });

        // סיכום שבוע + חץ מגמה מול שבוע קודם
        const total = weekTotals[wkIdx];
        const totalStr = _fmtVolShort(total);
        let trendHTML = '';
        if (wkIdx > 0 && weekTotals[wkIdx - 1] > 0 && total > 0) {
            const change = (total - weekTotals[wkIdx - 1]) / weekTotals[wkIdx - 1] * 100;
            if (change >= 5)        trendHTML = `<span class="hm-trend up">↑ ${Math.round(change)}%</span>`;
            else if (change <= -5)  trendHTML = `<span class="hm-trend down">↓ ${Math.round(Math.abs(change))}%</span>`;
            else                    trendHTML = `<span class="hm-trend flat">– 0%</span>`;
        }
        const dimCls = total === 0 ? ' dim' : '';

        html += `<div class="hm-row">
            <div class="hm-week-lbl">${wkLabel}</div>
            <div class="hm-cells-grid">${cellsHTML}</div>
            <div class="hm-week-total">
                <span class="hm-total-val${dimCls}">${totalStr}</span>
                ${trendHTML}
            </div>
        </div>`;
    });

    tableEl.innerHTML = html;
    if (tooltipEl) tooltipEl.classList.remove('show');

    // Footer: ממוצע שבועי
    if (footerEl) {
        if (activeWeeks.length) {
            footerEl.innerHTML = `
                <div class="hm-foot-lbl">ממוצע שבועי</div>
                <div class="hm-foot-right">
                    <div class="hm-foot-val">${_fmtVolShort(avgWeek)}</div>
                    <div class="hm-foot-sub">${activeWeeks.length} שבועות פעילים</div>
                </div>`;
            footerEl.style.display = 'flex';
        } else {
            footerEl.style.display = 'none';
        }
    }

    // Legend: צבעי שרירים במצב 'all', אחרת מקרא אינטנסיביות
    if (legendEl) {
        if (muscleFilter === 'all') {
            legendEl.innerHTML = HEATMAP_MAIN_MUSCLES.map(m =>
                `<span class="hm-leg-item"><span class="hm-leg-dot" style="background:${HEATMAP_MUSCLE_COLORS[m]}"></span>${m}</span>`
            ).join('') + `<span class="hm-leg-item"><span class="hm-leg-dot" style="background:${HEATMAP_MUSCLE_COLORS._mixed}"></span>מעורב</span>`;
        } else {
            const c = HEATMAP_MUSCLE_COLORS[muscleFilter] || '#0A84FF';
            legendEl.innerHTML = `
                <span class="hm-leg-lbl">פחות</span>
                <span class="hm-leg-grad">
                    <span class="hm-leg-dot" style="background:${_hexToRGBA(c, 0.25)}"></span>
                    <span class="hm-leg-dot" style="background:${_hexToRGBA(c, 0.5)}"></span>
                    <span class="hm-leg-dot" style="background:${_hexToRGBA(c, 0.75)}"></span>
                    <span class="hm-leg-dot" style="background:${_hexToRGBA(c, 1)}"></span>
                </span>
                <span class="hm-leg-lbl">יותר</span>`;
        }
    }
}

function _onHeatmapCellClick(el) {
    document.querySelectorAll('.heatmap-cell').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    const tooltipEl = document.getElementById('heatmap-tooltip');
    if (!tooltipEl) return;
    const vol = parseInt(el.dataset.vol, 10), sets = parseInt(el.dataset.sets, 10), date = el.dataset.date;
    if (!vol) {
        tooltipEl.innerHTML = `<div class="hm-tip-main"><strong>${date}</strong><span class="hm-tip-dot"></span><span>ללא אימון</span></div>`;
    } else {
        const volStr = vol >= 1000 ? (vol / 1000).toFixed(1) + ' טון' : vol + ' ק"ג';
        let breakdownStr = '';
        try {
            const bk = JSON.parse((el.dataset.bk || '{}').replace(/&#39;/g, "'"));
            const items = Object.entries(bk).sort((a, b) => b[1] - a[1]).slice(0, 3);
            if (items.length) {
                const tot = Object.values(bk).reduce((s, v) => s + v, 0);
                breakdownStr = `<span class="hm-tip-breakdown">${items.map(([m, v]) => `${escapeHtml(m)} ${Math.round(v / tot * 100)}%`).join(' · ')}</span>`;
            }
        } catch (e) { /* ignore */ }
        tooltipEl.innerHTML = `
            <div class="hm-tip-main">
                <strong>${date}</strong>
                <span class="hm-tip-dot"></span>
                <span>${sets} סטים</span>
                <span class="hm-tip-dot"></span>
                <strong>${volStr}</strong>
            </div>
            ${breakdownStr}`;
    }
    tooltipEl.classList.add('show');
    haptic('light');
}

function setHeatmapRange(weeks, btn) {
    _updateChipGroup('heatmap-range-chips', btn);
    const p = getAnalyticsPrefs(); p.heatmapWeeks = weeks; saveAnalyticsPrefs(p);
    renderVolumeHeatmap(getArchiveClean(), weeks, p.heatmapMuscle || 'all');
}

function setHeatmapMuscle(muscle, btn) {
    document.querySelectorAll('#heatmap-muscle-chips .chip').forEach(b => { b.classList.remove('active'); b.classList.add('inactive'); });
    if (btn) { btn.classList.add('active'); btn.classList.remove('inactive'); }
    const p = getAnalyticsPrefs(); p.heatmapMuscle = muscle; saveAnalyticsPrefs(p);
    renderVolumeHeatmap(getArchiveClean(), p.heatmapWeeks || 12, muscle);
}

function syncHeatmapMuscleChips(muscle) {
    document.querySelectorAll('#heatmap-muscle-chips .chip').forEach(b => {
        b.classList.toggle('active', b.dataset.muscle === muscle);
        b.classList.toggle('inactive', b.dataset.muscle !== muscle);
    });
}

function syncHeatmapRangeChips(weeks) {
    document.querySelectorAll('#heatmap-range-chips button').forEach(b => {
        const onclick = b.getAttribute('onclick') || '';
        const m = onclick.match(/setHeatmapRange\((\d+)/);
        b.classList.toggle('active', m ? parseInt(m[1], 10) === weeks : false);
    });
}

// ─── PLATEAU DETECTION ────────────────────────────────────────────────

// אוסף max e1RM פר אימון של תרגיל, מהישן לחדש, מוגבל ל-`weeks` שבועות אחרונים
function _getExerciseE1RMPoints(exName, weeks) {
    const prefs = getAnalyticsPrefs();
    const archive = getArchiveClean();
    const cutoffMs = Date.now() - weeks * 7 * 86400000;
    const pts = [];
    [...archive].reverse().forEach(w => { // מהישן לחדש
        if (w.timestamp < cutoffMs) return;
        const sets = getEntryExerciseSets(w, exName);
        if (!sets.length) return;
        const best = Math.max(...sets.map(s => calc1RM(s.w, s.r, prefs.formula)));
        pts.push({ ts: w.timestamp, e1rm: best, date: w.date || '' });
    });
    return pts;
}

function detectPlateau(exName) {
    const prefs = getAnalyticsPrefs();
    const threshold = prefs.plateauThreshold || 3;
    const pts = _getExerciseE1RMPoints(exName, 8); // 8 שבועות אחורה לבדיקה
    if (pts.length < threshold) return { status: 'insufficient', n: pts.length, threshold };

    // נירמל ל-x = ימים מאז האימון הראשון בחלון
    const t0 = pts[0].ts;
    const regPts = pts.map(p => ({ x: (p.ts - t0) / 86400000, y: p.e1rm }));
    const reg = _linearRegression(regPts);

    // weeks span בפועל בנתונים
    const spanDays = regPts[regPts.length - 1].x;
    const spanWeeks = Math.max(1, Math.round(spanDays / 7));

    const avgE1RM = pts.reduce((s, p) => s + p.e1rm, 0) / pts.length;
    const slopePerWeek = reg.slope * 7;
    // "Flat" = שיפוע בין -0.5kg ל-+0.5kg לשבוע; "ירידה" < -0.5; "צמיחה" > +0.5
    // הסף לקיבעון מתבסס על מספר תצפיות (n) — מספיק `threshold` אימונים בלי צמיחה ברורה
    let status;
    if (slopePerWeek > 0.5) status = 'growing';
    else if (slopePerWeek < -0.5) status = 'declining';
    else status = 'plateau';

    return {
        status, n: pts.length, threshold, spanWeeks,
        slopePerWeek, avgE1RM, currentE1RM: pts[pts.length - 1].e1rm,
        firstE1RM: pts[0].e1rm
    };
}

function renderPlateauCard(exName) {
    const card = document.getElementById('plateau-card'); if (!card) return;
    if (!exName) { card.style.display = 'none'; return; }
    const res = detectPlateau(exName);
    if (res.status === 'insufficient') { card.style.display = 'none'; return; }

    card.style.display = 'block';
    card.classList.remove('danger', 'ok');
    const sub = document.getElementById('plateau-sub');
    const badge = document.getElementById('plateau-badge');
    const body = document.getElementById('plateau-body');
    const aiBtn = document.getElementById('btn-plateau-ai');
    const aiRes = document.getElementById('plateau-ai-result');

    if (aiRes) { aiRes.style.display = 'none'; aiRes.innerHTML = ''; }

    let badgeTxt = '', subTxt = '';
    if (res.status === 'growing') {
        card.classList.add('ok');
        badgeTxt = 'צמיחה';
        subTxt = `${exName} · ${res.spanWeeks} שבועות`;
    } else if (res.status === 'declining') {
        card.classList.add('danger');
        badgeTxt = 'ירידה';
        subTxt = `${exName} · נדרשת בדיקה`;
    } else { // plateau
        badgeTxt = 'קיבעון';
        subTxt = `${exName} · ${res.spanWeeks} שבועות ללא צמיחה`;
    }

    if (sub) sub.textContent = subTxt;
    if (badge) badge.textContent = badgeTxt;

    const slopeStr = (res.slopePerWeek >= 0 ? '+' : '') + res.slopePerWeek.toFixed(2);
    const diffStr = (res.currentE1RM - res.firstE1RM >= 0 ? '+' : '') + Math.round(res.currentE1RM - res.firstE1RM) + ' kg';
    if (body) {
        body.innerHTML = `
            <div class="plateau-stat-row">
                <span class="plateau-stat-lbl">E1RM נוכחי</span>
                <span class="plateau-stat-val">${Math.round(res.currentE1RM)} kg</span>
            </div>
            <div class="plateau-stat-row">
                <span class="plateau-stat-lbl">שינוי בתקופה</span>
                <span class="plateau-stat-val">${diffStr}</span>
            </div>
            <div class="plateau-stat-row">
                <span class="plateau-stat-lbl">שיפוע / שבוע</span>
                <span class="plateau-stat-val">${slopeStr} kg</span>
            </div>
            <div class="plateau-stat-row">
                <span class="plateau-stat-lbl">תצפיות</span>
                <span class="plateau-stat-val">${res.n}</span>
            </div>`;
    }

    // כפתור AI מוצג רק במצבי plateau/declining + יש מפתח API
    if (aiBtn) {
        const hasKey = (typeof StorageManager !== 'undefined' && StorageManager.getAIConfig)
            ? !!StorageManager.getAIConfig().apiKey : false;
        const showAI = hasKey && (res.status === 'plateau' || res.status === 'declining');
        aiBtn.style.display = showAI ? 'flex' : 'none';
        aiBtn.removeAttribute('disabled');
        aiBtn.dataset.exName = exName;
    }
}

async function requestAIPlateauAdvice() {
    const btn = document.getElementById('btn-plateau-ai');
    const result = document.getElementById('plateau-ai-result');
    if (!btn || !result) return;
    const exName = btn.dataset.exName;
    if (!exName) return;

    haptic('light');
    btn.setAttribute('disabled', 'true');
    result.style.display = 'block';
    result.className = 'plateau-ai-result loading';
    result.innerHTML = '⏳ המאמן בוחן את ההיסטוריה שלך...';

    try {
        const data = detectPlateau(exName);
        const nutri = (typeof getNutritionalContext === 'function') ? getNutritionalContext() : 'MAINTENANCE';
        const persona = StorageManager.getAIPersona ? (StorageManager.getAIPersona() || '') : '';
        const pts = _getExerciseE1RMPoints(exName, 8);
        const histLines = pts.map(p => `  - ${p.date || new Date(p.ts).toISOString().slice(0,10)}: ${Math.round(p.e1rm)}kg E1RM`).join('\n');

        const prompt = `You are a strength training coach. The user is on a plateau (or decline) in a specific exercise. Provide a brief, actionable Hebrew recommendation.

Context:
- Exercise: ${exName}
- Status: ${data.status === 'plateau' ? 'PLATEAU' : 'DECLINING'}
- Weeks analyzed: ${data.spanWeeks}
- Current E1RM: ${Math.round(data.currentE1RM)} kg
- Change in period: ${(data.currentE1RM - data.firstE1RM).toFixed(1)} kg
- Slope per week: ${data.slopePerWeek.toFixed(2)} kg/week
- Nutritional state: ${nutri}
- Persona: ${persona || 'unspecified'}

E1RM history (oldest first):
${histLines || '  (no data)'}

Guidelines:
- If CUT: a plateau in strength is expected. Suggest "wait it out" / maintain volume / focus on form.
- If MAINTENANCE: try a deload week, then re-test. Or vary reps (e.g., 3×5 instead of 3×8).
- If SURPLUS: a plateau is concerning. Recommend a technique change, exercise swap, or deload+reset.

Respond in HEBREW, 2-3 short sentences (max 250 chars). No JSON, no markdown, plain text only.`;

        // freeText — הפרומפט מבקש טקסט חופשי; מצב ה-JSON הכפוי של ברירת המחדל
        // התנגש עם ההנחיה וגרם לג'נרוט ארוך ואיטי עד תקרת הטוקנים
        const raw = (typeof _callGeminiOneShot === 'function')
            ? await _callGeminiOneShot(prompt, { freeText: true, maxTokens: 1024 })
            : '';
        const text = (raw || '').trim().replace(/^["']|["']$/g, '');
        if (!text) throw new Error('EMPTY_RESPONSE');

        result.className = 'plateau-ai-result';
        result.innerHTML = text.replace(/</g, '&lt;');
        haptic('success');
    } catch (e) {
        console.warn('Plateau AI advice failed', e);
        result.className = 'plateau-ai-result error';
        result.innerHTML = e.message === 'API_KEY_MISSING'
            ? 'נדרש להגדיר Gemini API Key בהגדרות.'
            : 'לא הצלחתי לקבל המלצה — נסה שוב מאוחר יותר.';
    } finally {
        btn.removeAttribute('disabled');
    }
}

// ─── PR PREDICTION ────────────────────────────────────────────────────

function predictPR(exName) {
    const pts = _getExerciseE1RMPoints(exName, 16); // עד 16 שבועות אחורה
    if (pts.length < 4) return { ok: false, reason: 'insufficient_data', n: pts.length, min: 4 };

    const t0 = pts[0].ts;
    const regPts = pts.map(p => ({ x: (p.ts - t0) / 86400000, y: p.e1rm }));
    const reg = _linearRegression(regPts);

    if (reg.r2 < 0.5) return { ok: false, reason: 'low_confidence', n: pts.length, r2: reg.r2 };
    if (reg.slope <= 0) return { ok: false, reason: 'no_trend', n: pts.length, slope: reg.slope };

    // תחזית 4 שבועות (28 ימים) קדימה מהאימון האחרון
    const lastX = regPts[regPts.length - 1].x;
    const futureX = lastX + 28;
    const projected = reg.slope * futureX + reg.intercept;
    const currentE1RM = pts[pts.length - 1].e1rm;
    const gain = projected - currentE1RM;

    return {
        ok: true, n: pts.length, r2: reg.r2,
        currentE1RM, projected, gain,
        ci: reg.stderr * 2, // ~95%
        weeksAhead: 4
    };
}

function renderPRPredictionCard(exName) {
    const card = document.getElementById('pr-prediction-card'); if (!card) return;
    if (!exName) { card.style.display = 'none'; return; }
    const res = predictPR(exName);
    card.style.display = 'block';

    const sub = document.getElementById('pr-pred-sub');
    const body = document.getElementById('pr-pred-body');
    if (sub) sub.textContent = exName;

    if (!res.ok) {
        if (body) {
            let msg;
            if (res.reason === 'insufficient_data') msg = `אסוף עוד נתונים — נדרשים ${res.min} אימונים לפחות (יש ${res.n}).`;
            else if (res.reason === 'low_confidence') msg = `המגמה לא יציבה מספיק (R² = ${(res.r2*100).toFixed(0)}%). נסה שוב כשתהיה מגמה ברורה יותר.`;
            else msg = 'אין מגמת צמיחה נוכחית. התמקד בעקביות לפני תחזית.';
            body.innerHTML = `<div class="pr-pred-empty">${msg}</div>`;
        }
        return;
    }

    const ciLo = Math.round(res.projected - res.ci);
    const ciHi = Math.round(res.projected + res.ci);
    const gainStr = (res.gain >= 0 ? '+' : '') + res.gain.toFixed(1);

    if (body) {
        body.innerHTML = `
            <div class="pr-pred-hero">
                <div>
                    <div class="pr-pred-hero-lbl">תחזית בעוד ${res.weeksAhead} שבועות</div>
                    <div class="pr-pred-hero-val">${Math.round(res.projected)}<span class="inline-unit">kg</span></div>
                </div>
                <div style="text-align:left;">
                    <div class="pr-pred-hero-lbl">רווח</div>
                    <div class="pr-pred-hero-val" style="font-size:1.4rem; color:var(--type-b);">${gainStr}<span class="inline-unit">kg</span></div>
                </div>
            </div>
            <div class="pr-pred-meta">
                <span>טווח סבירות (CI)</span>
                <strong>${ciLo}–${ciHi} kg</strong>
            </div>
            <div class="pr-pred-meta">
                <span>איכות מגמה (R²)</span>
                <strong>${(res.r2 * 100).toFixed(0)}%</strong>
            </div>
            <div class="pr-pred-meta">
                <span>תצפיות</span>
                <strong>${res.n}</strong>
            </div>`;
    }
}

function switchAnalyticsTab(name, btn) {
    document.querySelectorAll('#analytics-seg .seg-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    document.querySelectorAll('#ui-analytics .tab-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });
    
    const target = document.getElementById('analytics-' + name);
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    }
}

function _updateChipGroup(id, btn) { const c = document.getElementById(id); if (c) c.querySelectorAll('button').forEach(b => b.classList.remove('active')); if (btn) btn.classList.add('active'); }

function setVolRange(n, btn) { _updateChipGroup('vol-chips', btn); const p = getAnalyticsPrefs(); p.volumeRange = n; saveAnalyticsPrefs(p); renderVolumeBarChart(getArchiveClean(), n, p.volumeMuscle || 'all'); }
function setVolMuscle(muscle, btn) { document.querySelectorAll('#vol-muscle-chips .chip').forEach(b => { b.classList.remove('active'); b.classList.add('inactive'); }); if (btn) { btn.classList.add('active'); btn.classList.remove('inactive'); } const p = getAnalyticsPrefs(); p.volumeMuscle = muscle; saveAnalyticsPrefs(p); renderVolumeBarChart(getArchiveClean(), p.volumeRange, muscle); }
function setMuscleRange(r, btn) { _updateChipGroup('muscle-chips', btn); const p = getAnalyticsPrefs(); p.muscleRange = r; saveAnalyticsPrefs(p); renderDonutChart(getArchiveClean(), r); }
function setConsRange(n, btn) { _updateChipGroup('cons-chips', btn); const p = getAnalyticsPrefs(); p.consistencyRange = n; saveAnalyticsPrefs(p); renderConsistencyTrack(getArchiveClean(), n); }
function setMicroPoints(n, btn) { _updateChipGroup('micro-pts-chips', btn); const p = getAnalyticsPrefs(); p.microPoints = n; saveAnalyticsPrefs(p); const s = document.getElementById('micro-ex-selector'); if (s && s.value) loadMicroData(s.value); }
function setMicroAxis(ax, btn) {
    _updateChipGroup('micro-axis-chips', btn);
    const p = getAnalyticsPrefs(); p.microAxis = ax; saveAnalyticsPrefs(p);
    // עדכון כותרת לפי הבורר הנבחר
    const lbl = document.querySelector('.micro-hero-lbl');
    if (lbl) {
        if (ax === 'e1rm')  lbl.textContent = 'הערכת 1RM';
        else if (ax === 'maxw') lbl.textContent = 'משקל מקסימלי';
        else if (ax === 'vol')  lbl.textContent = 'נפח';
    }
    const s = document.getElementById('micro-ex-selector'); if (s && s.value) loadMicroData(s.value);
}

function openAnalyticsSettings() {
    const p = getAnalyticsPrefs();
    document.getElementById('pref-name').value = p.name || '';
    document.getElementById('pref-units').value = p.units || 'kg';
    document.getElementById('pref-formula').value = p.formula || 'epley';
    document.getElementById('pref-cons-green').value = p.consistencyGreen || '';
    document.getElementById('pref-cons-orange').value = p.consistencyOrange || '';
    document.getElementById('analytics-settings-overlay').style.display = 'block';
    document.getElementById('analytics-settings-sheet').classList.add('open');
    haptic('light');
}
function closeAnalyticsSettings() { document.getElementById('analytics-settings-overlay').style.display = 'none'; document.getElementById('analytics-settings-sheet').classList.remove('open'); }
function saveAnalyticsSettingsPrefs() {
    const p = getAnalyticsPrefs();
    p.name = document.getElementById('pref-name').value.trim();
    p.units = document.getElementById('pref-units').value;
    p.formula = document.getElementById('pref-formula').value;
    const gVal = parseInt(document.getElementById('pref-cons-green').value);
    const oVal = parseInt(document.getElementById('pref-cons-orange').value);
    if (gVal > 0 && oVal > gVal) {
        p.consistencyGreen = gVal;
        p.consistencyOrange = oVal;
    } else {
        delete p.consistencyGreen;
        delete p.consistencyOrange;
    }
    saveAnalyticsPrefs(p); closeAnalyticsSettings(); renderAnalyticsDashboard(); renderHeroCard(); haptic('success');
}

const HERO_METRIC_OPTIONS = [
    { key: 'days', label: 'ימים מאימון אחרון' },
    { key: 'vol', label: 'נפח אימון אחרון' },
    { key: 'duration', label: 'משך אימון אחרון' },
    { key: 'avg_vol', label: 'ממוצע נפח (4 אימונים)' },
    { key: 'total', label: 'סך אימונים כולל' }
];

function openHeroSettings() {
    const p = getAnalyticsPrefs(), picker = document.getElementById('hero-metric-picker'); if (!picker) return;
    picker.innerHTML = HERO_METRIC_OPTIONS.map(m =>
        `<div class="flex-between border-bottom pb-sm"><label class="input-label m-0">${m.label}</label><input type="checkbox" class="archive-checkbox" value="${m.key}" ${p.heroMetrics.includes(m.key) ? 'checked' : ''} onchange="onHeroMetricChange()"></div>`
    ).join('');
    document.getElementById('hero-settings-overlay').style.display = 'block';
    document.getElementById('hero-settings-sheet').classList.add('open');
    haptic('light');
}
function onHeroMetricChange() { const c = [...document.querySelectorAll('#hero-metric-picker input:checked')]; if (c.length > 3) c[c.length - 1].checked = false; }
function closeHeroSettings() { document.getElementById('hero-settings-overlay').style.display = 'none'; document.getElementById('hero-settings-sheet').classList.remove('open'); }
function saveHeroSettings() {
    const checked = [...document.querySelectorAll('#hero-metric-picker input:checked')].map(i => i.value);
    if (checked.length !== 3) { showAlert('יש לבחור בדיוק 3 מדדים'); return; }
    const p = getAnalyticsPrefs(); p.heroMetrics = checked; saveAnalyticsPrefs(p); closeHeroSettings(); renderHeroCard(); haptic('success');
}

// ─── HOME PR CARD ──────────────────────────────────────────────────────────

const HOME_PR_EXERCISES = {
    bench: 'Bench Press (Main)',
    ohp:   'Overhead Press (Main)'
};
const HOME_PR_COLORS = { bench: '#47e266', ohp: '#ffb868' };

let _homePRCurrent = 'bench';
let _homePRSelectedIdx = null;
let _homePRSessions = { bench: [], ohp: [] };

function renderHomePRCard() {
    const card = document.getElementById('home-pr-card');
    if (!card) return;

    const prefs = getAnalyticsPrefs();
    const archive = getArchiveClean();

    ['bench', 'ohp'].forEach(key => {
        const exName = HOME_PR_EXERCISES[key];
        const sessions = [];
        [...archive].reverse().forEach(w => {
            const sets = getEntryExerciseSets(w, exName);
            if (!sets.length) return;
            const bestE1RM = Math.max(...sets.map(s => calc1RM(s.w, s.r, prefs.formula)));
            const bestSet  = sets.reduce((b, s) => calc1RM(s.w, s.r, prefs.formula) > calc1RM(b.w, b.r, prefs.formula) ? s : b, sets[0]);
            sessions.push({
                e1rm: Math.round(bestE1RM * 10) / 10,
                set:  `${bestSet.w}kg × ${bestSet.r}`,
                date: w.date || '',
                timestamp: w.timestamp
            });
        });
        _homePRSessions[key] = sessions;
    });

    _homePRRenderRangeChips();
    _homePRSelectedIdx = _homePRBestIdx(_homePRCurrent);
    _homePRRender();
}

function _homePRRenderRangeChips() {
    const container = document.getElementById('home-pr-range-chips-inline');
    if (!container) return;
    container.innerHTML = '';

    const prefs = getAnalyticsPrefs();
    const activeRange = prefs.homePRRange || 8;

    [8, 16, 0].forEach(n => {
        const btn = document.createElement('button');
        const val = n === 0 ? 9999 : n;
        btn.className = 'home-pr-range-chip' + (activeRange === val ? ' active' : '');
        btn.textContent = n === 0 ? 'הכל' : String(n);
        btn.onclick = () => setHomePRRange(val, btn);
        container.appendChild(btn);
    });
}

function setHomePRRange(n, btn) {
    const prefs = getAnalyticsPrefs();
    prefs.homePRRange = n;
    saveAnalyticsPrefs(prefs);
    document.querySelectorAll('.home-pr-range-chip').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _homePRSelectedIdx = _homePRBestIdx(_homePRCurrent);
    _homePRRender();
}

function _homePRBestIdx(key) {
    const prefs = getAnalyticsPrefs();
    const range = prefs.homePRRange || 8;
    const all = _homePRSessions[key];
    const windowed = (range >= all.length) ? all : all.slice(-range);
    return _homePRBestIdxFromArr(windowed);
}

function _homePRBestIdxFromArr(arr) {
    if (!arr.length) return 0;
    let best = 0;
    arr.forEach((x, i) => { if (x.e1rm > arr[best].e1rm) best = i; });
    return best;
}

function switchHomePR(key, btn) {
    _homePRCurrent = key;
    document.querySelectorAll('.home-pr-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _homePRSelectedIdx = _homePRBestIdx(key);
    _homePRRender();
}

function _homePRSelectDot(idx) {
    _homePRSelectedIdx = idx;
    _homePRRender();
}

function _homePRRender() {
    const prefs = getAnalyticsPrefs();
    const range = prefs.homePRRange || 8;
    const all = _homePRSessions[_homePRCurrent];
    const windowed = (range >= all.length) ? all : all.slice(-range);
    if (_homePRSelectedIdx >= windowed.length) _homePRSelectedIdx = _homePRBestIdxFromArr(windowed);
    _homePRRenderInfo(windowed, all);
    _homePRDrawChart(windowed, all);
}

function _homePRRenderInfo(sessions, _all) {
    if (!sessions) {
        const prefs = getAnalyticsPrefs();
        const range = prefs.homePRRange || 8;
        const all = _homePRSessions[_homePRCurrent];
        sessions = (range >= all.length) ? all : all.slice(-range);
    }
    const col = HOME_PR_COLORS[_homePRCurrent];
    const numEl   = document.getElementById('home-pr-num');
    const setEl   = document.getElementById('home-pr-set');
    const dateEl  = document.getElementById('home-pr-date');
    const deltaEl = document.getElementById('home-pr-delta');
    if (!numEl) return;

    if (!sessions.length) {
        numEl.textContent = '—'; numEl.style.color = col;
        setEl.textContent = 'אין נתונים בארכיון';
        dateEl.textContent = '';
        deltaEl.textContent = ''; deltaEl.className = 'home-pr-delta';
        return;
    }

    const idx = Math.max(0, Math.min(_homePRSelectedIdx, sessions.length - 1));
    const s = sessions[idx];

    numEl.textContent = s.e1rm.toFixed(1);
    numEl.style.color = col;
    setEl.textContent = s.set;
    dateEl.textContent = s.date;

    if (idx > 0) {
        const prev = sessions[idx - 1];
        const diff = Math.round((s.e1rm - prev.e1rm) * 10) / 10;
        const sign = diff > 0 ? '↑' : diff < 0 ? '↓' : '=';
        const cls  = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
        deltaEl.textContent = `${sign} ${Math.abs(diff).toFixed(1)} kg`;
        deltaEl.className = `home-pr-delta ${cls}`;
    } else {
        deltaEl.textContent = 'ראשון';
        deltaEl.className = 'home-pr-delta same';
    }
}

function _homePRDrawChart(sessions, _all) {
    const svg = document.getElementById('home-pr-svg');
    if (!svg) return;
    if (!sessions) {
        const prefs = getAnalyticsPrefs();
        const range = prefs.homePRRange || 8;
        const all = _homePRSessions[_homePRCurrent];
        sessions = (range >= all.length) ? all : all.slice(-range);
    }
    const col = HOME_PR_COLORS[_homePRCurrent];

    if (sessions.length < 2) {
        svg.innerHTML = `<text x="90" y="36" text-anchor="middle" fill="rgba(255,255,255,0.2)"
            font-size="11" font-family="-apple-system,sans-serif">אין מספיק נתונים</text>`;
        return;
    }

    const vals = sessions.map(s => s.e1rm);
    const n = vals.length;
    const W = 180, H = 68, pT = 20, pB = 8, pL = 6, pR = 8;
    const spread = Math.max(...vals) - Math.min(...vals);
    const mn = Math.min(...vals) - spread * 0.18;
    const mx = Math.max(...vals) + spread * 0.18;

    const px = i => pL + (i / (n - 1)) * (W - pL - pR);
    const py = v => pT + (H - pT - pB) * (1 - (v - mn) / ((mx - mn) || 1));
    const pts = vals.map((v, i) => [px(i), py(v)]);

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = line + ` L${pts[n-1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;

    const prIdx = vals.indexOf(Math.max(...vals));
    const prPt  = pts[prIdx];
    const labelY  = Math.max(prPt[1] - 14, pT - 2);
    const labelX  = Math.min(Math.max(prPt[0], 18), W - 18);
    const colAlpha = col === '#0A84FF' ? 'rgba(10,132,255,0.22)' : 'rgba(255,159,10,0.22)';
    const gradId   = 'hprg_' + _homePRCurrent;

    const dotsHtml = pts.map((p, i) => {
        const isSel = i === _homePRSelectedIdx;
        const r     = isSel ? 5 : 3.5;
        const fill  = isSel ? col : 'rgba(28,28,30,0.9)';
        const sw    = isSel ? 0 : 1.5;
        return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}"
            r="${r}" fill="${fill}" stroke="${col}" stroke-width="${sw}"
            style="cursor:pointer" onclick="_homePRSelectDot(${i})"/>`;
    }).join('');

    const prLabel = `
        <rect x="${(labelX - 17).toFixed(1)}" y="${(labelY - 10).toFixed(1)}"
            width="34" height="13" rx="4"
            fill="rgba(22,22,24,0.95)" stroke="${col}" stroke-width="0.7" stroke-opacity="0.55"/>
        <text x="${labelX.toFixed(1)}" y="${(labelY + 0.5).toFixed(1)}"
            fill="${col}" font-size="8" text-anchor="middle"
            font-weight="700" font-family="-apple-system,sans-serif">${vals[prIdx].toFixed(1)}</text>`;

    svg.innerHTML = `
        <defs>
            <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${colAlpha}"/>
                <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
            </linearGradient>
        </defs>
        <path d="${area}" fill="url(#${gradId})"/>
        <path d="${line}" fill="none" stroke="${col}" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
        ${prLabel}
        ${dotsHtml}`;
}

// ─── HOME TODAY CARDS — תזונה + הרכב גוף במסך הבית ──────────────────────

function renderHomeTodayCards() {
    _homeTodayRenderNutrition();
    _homeTodayRenderBody();
}

function _homeTodayRenderNutrition() {
    const numEl = document.getElementById('home-today-kcal');
    if (!numEl) return;
    const lblEl = document.getElementById('home-today-nutri-lbl');
    const liveEl = document.getElementById('home-today-live');
    const rowsEl = document.getElementById('home-today-macros');
    const remEl = document.getElementById('home-today-remain');
    const all = StorageManager.getNutritionDaily();
    if (!all.length) {
        numEl.textContent = '—';
        lblEl.textContent = 'תזונה היום';
        liveEl.style.display = 'none';
        if (remEl) remEl.style.display = 'none';
        rowsEl.innerHTML = '<div class="home-today-empty">אין עדיין נתוני תזונה — חבר Health או ייבא MFP</div>';
        return;
    }
    const latest = all[all.length - 1];               // ממוין מהישן לחדש
    const isToday = latest.date === _blTodayStr();
    lblEl.textContent = isToday ? 'תזונה היום' : 'יום אחרון · ' + _blShortDate(latest.date);
    liveEl.style.display = isToday ? '' : 'none';
    numEl.textContent = Math.round(latest.calories || 0);
    // קלוריות שנותרו מול היעד היומי (הגדרות → מאמן) — מספר בלבד, ירוק/אדום
    if (remEl) {
        const target = Number(getAnalyticsPrefs().kcalTarget);
        if (target > 0) {
            const rem = Math.round(target - (latest.calories || 0));
            remEl.textContent = rem;
            remEl.classList.toggle('left', rem >= 0);
            remEl.classList.toggle('over', rem < 0);
            remEl.style.display = '';
        } else {
            remEl.style.display = 'none';
        }
    }
    const kv = (lbl, v, cls) =>
        `<div class="home-today-kv"><span class="home-today-kv-lbl">${lbl}</span>` +
        `<span class="home-today-kv-val ${cls}">${Math.round(v || 0)}g</span></div>`;
    rowsEl.innerHTML = kv('חלבון', latest.protein, 'macro-p')
                     + kv('פחמימה', latest.carbs, 'macro-c')
                     + kv('שומן', latest.fat, 'macro-f');
}

function _homeTodayRenderBody() {
    const numEl = document.getElementById('home-body-weight');
    if (!numEl) return;
    const rowsEl = document.getElementById('home-body-rows');
    const log = StorageManager.getBodyLog();
    if (!log.length) {
        numEl.textContent = '—';
        rowsEl.innerHTML = '<div class="home-today-empty">אין עדיין שקילות — צלם או הזן במסך Composition</div>';
        return;
    }
    // שיקוף הלוגיקה של _renderBodyKpis (bodylog-logic.js)
    const sorted = log.slice().sort((a, b) => a.date < b.date ? -1 : 1);
    const cur = sorted[sorted.length - 1];
    const ref30 = sorted.find(e => e.date >= _blCutoff(30)) || sorted[0];
    const d30 = cur.weight - ref30.weight;
    const fat = cur.bodyFat;
    const lbm = fat != null ? cur.weight * (1 - fat / 100) : null;
    numEl.textContent = cur.weight.toFixed(1);
    const deltaCls = d30 > 0 ? 'delta-up' : d30 < 0 ? 'delta-down' : '';
    const arrow = d30 > 0 ? '▲ ' : d30 < 0 ? '▼ ' : '';
    const kv = (lbl, v, cls = '') =>
        `<div class="home-today-kv"><span class="home-today-kv-lbl">${lbl}</span>` +
        `<span class="home-today-kv-val ${cls}">${v}</span></div>`;
    rowsEl.innerHTML =
        kv('אחוז שומן', fat != null ? fat.toFixed(1) + '%' : '—') +
        kv('מסת גוף רזה', lbm != null ? lbm.toFixed(1) + ' ק"ג' : '—') +
        kv('שינוי 30 יום', arrow + Math.abs(d30).toFixed(1) + ' ק"ג', deltaCls);
}

// ניווט מכרטיס בית → Composition עם תת-טאב נבחר מראש.
// קביעת _blTab לפני switchMainTab מספיקה — renderBodyLog קורא ל-_applyTabVisibility
// שמסנכרן את כפתורי ה-seg (setBodyTab היה גורם לרינדור כפול).
function goToComposition(tab) {
    _blTab = tab;
    switchMainTab('bodylog');
}

// רענון Health ידני מתג ה-LIVE בכרטיס הבית (stopPropagation מונע ניווט).
// משיכה manual — עוקפת throttle ומציגה toast; בהצלחה הכרטיס מתרענן דרך ה-hook הקיים.
function refreshHomeNutrition() {
    if (typeof syncHealthNutrition === 'function') syncHealthNutrition(true);
    haptic('light');
}

// toggle בהגדרות: checked = כרטיסי "היום" (ברירת מחדל), off = גרף שיאים
function toggleHomeCard(showToday) {
    const p = getAnalyticsPrefs();
    p.homeCard = showToday ? 'today' : 'pr';
    saveAnalyticsPrefs(p);
    applyHomeSectionPref();
    haptic('light');
}

function applyHomeSectionPref() {
    // משתמשים קיימים: ה-prefs השמורים לא מכילים homeCard — לכן ברירת מחדל ידנית
    const mode = getAnalyticsPrefs().homeCard || 'today';
    const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
    show('home-today-hdr', mode === 'today');
    show('home-today-row', mode === 'today');
    show('home-pr-hdr', mode === 'pr');
    show('home-pr-card', mode === 'pr');
    if (mode === 'today') renderHomeTodayCards();
    else if (typeof renderHomePRCard === 'function') renderHomePRCard();
}

function syncHomeCardToggle() {
    const tog = document.getElementById('home-card-toggle');
    if (tog) tog.checked = (getAnalyticsPrefs().homeCard || 'today') === 'today';
}

// ─── ARCHIVE RANGE COPY ──────────────────────────────────────────────────

let _rangeTab = 'month';
let _rangeSelectedMonth = null;
let _rangeSelectedWeeks = null;

function openRangeSheet() {
    _rangeTab = 'month';
    _rangeSelectedMonth = null;
    _rangeSelectedWeeks = null;
    _renderRangeMonthChips();
    document.getElementById('range-panel-month').style.display = 'block';
    document.getElementById('range-panel-weeks').style.display = 'none';
    document.getElementById('range-seg-month').classList.add('active');
    document.getElementById('range-seg-weeks').classList.remove('active');
    _updateRangeCopyBtn();
    document.getElementById('range-copy-overlay').style.display = 'block';
    document.getElementById('range-copy-sheet').classList.add('open');
    haptic('light');
}

function closeRangeSheet() {
    document.getElementById('range-copy-overlay').style.display = 'none';
    document.getElementById('range-copy-sheet').classList.remove('open');
}

function switchRangeTab(tab) {
    _rangeTab = tab;
    _rangeSelectedMonth = null;
    _rangeSelectedWeeks = null;
    document.getElementById('range-panel-month').style.display = tab === 'month' ? 'block' : 'none';
    document.getElementById('range-panel-weeks').style.display = tab === 'weeks' ? 'block' : 'none';
    document.getElementById('range-seg-month').classList.toggle('active', tab === 'month');
    document.getElementById('range-seg-weeks').classList.toggle('active', tab === 'weeks');
    if (tab === 'month') _renderRangeMonthChips();
    _updateRangeCopyBtn();
}

function _renderRangeMonthChips() {
    const container = document.getElementById('range-month-chips');
    if (!container) return;
    container.innerHTML = '';
    const archive = StorageManager.getArchive();
    const seen = new Set();
    archive.forEach(item => {
        const d = new Date(item.timestamp);
        const key = d.getFullYear() + '-' + d.getMonth();
        if (!seen.has(key)) {
            seen.add(key);
            const btn = document.createElement('button');
            btn.className = 'range-card';
            btn.innerHTML = `<span class="range-card-label">זמין</span><span class="range-card-name">${MONTH_NAMES_HE[d.getMonth()]} ${d.getFullYear()}</span>`;
            const yr = d.getFullYear(), mo = d.getMonth();
            btn.onclick = function() { _selectRangeMonth(yr, mo, btn); };
            container.appendChild(btn);
        }
    });
    if (!seen.size) container.innerHTML = '<p class="color-dim text-sm">אין אימונים בארכיון</p>';
}

function _selectRangeMonth(year, month, btn) {
    _rangeSelectedMonth = { year: year, month: month };
    document.querySelectorAll('#range-month-chips .range-card').forEach(function(b) {
        b.classList.remove('active');
        const lbl = b.querySelector('.range-card-label');
        if (lbl) lbl.textContent = 'זמין';
    });
    btn.classList.add('active');
    const lbl = btn.querySelector('.range-card-label');
    if (lbl) lbl.textContent = 'נבחר';
    _updateRangeCopyBtn();
}

function selectRangeWeeks(n, btn) {
    _rangeSelectedWeeks = n;
    document.querySelectorAll('#range-panel-weeks .range-card').forEach(function(b) {
        b.classList.remove('active');
        const lbl = b.querySelector('.range-card-label');
        if (lbl) lbl.textContent = 'זמין';
    });
    btn.classList.add('active');
    const lbl = btn.querySelector('.range-card-label');
    if (lbl) lbl.textContent = 'נבחר';
    _updateRangeCopyBtn();
}

function _getWeeksStartDate(n) {
    var today = new Date();
    var dayOfWeek = today.getDay();
    var startOfCurrentWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek);
    return new Date(startOfCurrentWeek.getTime() - (n - 1) * 7 * 86400000);
}

function _getRangeItems() {
    var archive = StorageManager.getArchive();
    if (_rangeTab === 'month' && _rangeSelectedMonth) {
        return archive.filter(function(item) {
            var d = new Date(item.timestamp);
            return d.getFullYear() === _rangeSelectedMonth.year && d.getMonth() === _rangeSelectedMonth.month;
        });
    }
    if (_rangeTab === 'weeks' && _rangeSelectedWeeks) {
        var startDate = _getWeeksStartDate(_rangeSelectedWeeks);
        return archive.filter(function(item) { return new Date(item.timestamp) >= startDate; });
    }
    return [];
}

function _updateRangeCopyBtn() {
    var btn = document.getElementById('btn-range-copy');
    var dlBtn = document.getElementById('btn-range-download');
    var preview = document.getElementById('range-stats-preview');
    var previewText = document.getElementById('range-stats-text');
    if (!btn) return;
    var hasSelection = (_rangeTab === 'month' && _rangeSelectedMonth !== null) ||
                       (_rangeTab === 'weeks' && _rangeSelectedWeeks !== null);
    if (!hasSelection) {
        btn.disabled = true;
        btn.style.opacity = '0.45';
        btn.innerHTML = '<span>בחר טווח</span><span class="material-symbols-outlined" style="font-size:1.1rem;">content_copy</span>';
        if (dlBtn) { dlBtn.disabled = true; dlBtn.style.opacity = '0.45'; }
        if (preview) preview.style.display = 'none';
        return;
    }
    var count = _getRangeItems().length;
    btn.disabled = count === 0;
    btn.style.opacity = count > 0 ? '1' : '0.5';
    btn.innerHTML = count > 0
        ? '<span>העתק ' + count + ' אימונים</span><span class="material-symbols-outlined" style="font-size:1.1rem;">content_copy</span>'
        : '<span>אין אימונים בטווח זה</span><span class="material-symbols-outlined" style="font-size:1.1rem;">content_copy</span>';
    if (dlBtn) { dlBtn.disabled = count === 0; dlBtn.style.opacity = count > 0 ? '1' : '0.45'; }
    if (preview) preview.style.display = count > 0 ? 'flex' : 'none';
    if (previewText) previewText.textContent = count + ' אימונים נמצאו בטווח הנבחר';
}

function executeCopyByRange() {
    var items = _getRangeItems();
    if (!items.length) { showAlert("אין אימונים בטווח שנבחר"); return; }
    var text = items.map(function(item) { return _archiveCopyText(item); }).join("\n\n========================================\n\n");
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() {
            haptic('success'); closeRangeSheet(); showAlert('הועתקו ' + items.length + ' אימונים בהצלחה!');
        });
    } else {
        var el = document.createElement("textarea");
        el.value = text;
        document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
        closeRangeSheet(); showAlert('הועתקו ' + items.length + ' אימונים בהצלחה!');
    }
}

// ─── קובץ לקלוד ─────────────────────────────────────────────────────────────
// לוג אימונים קריא להעלאה לזיכרון פרויקט ב-Claude. מכבד את מתג "כלול סיכומי מאמן"
// (אותו checkbox של ההעתקה) דרך _archiveCopyText. ברירת מחדל: כל הלוג.

// _rangeLabelText — תיאור קריא של הטווח שנבחר במסך הטווח (לכותרת הקובץ).
function _rangeLabelText() {
    if (_rangeTab === 'month' && _rangeSelectedMonth) {
        return MONTH_NAMES_HE[_rangeSelectedMonth.month] + ' ' + _rangeSelectedMonth.year;
    }
    if (_rangeTab === 'weeks' && _rangeSelectedWeeks) {
        return _rangeSelectedWeeks + ' שבועות אחרונים';
    }
    return 'טווח נבחר';
}

// _downloadClaudeFile — בונה קובץ JSON של לוג האימונים ומוריד אותו.
// מכבד את מתג "כלול סיכומי מאמן": כשהוא כבוי — שדה aiSummary מוסר מכל רשומה,
// וגם בלוק סיכום שהוטמע ב-summary ברשומות ישנות מנוקה.
function _downloadClaudeFile(items, scopeLabel, scopeSlug) {
    if (!items.length) { showAlert('אין אימונים לייצוא'); return; }
    var withCoach = _coachToggleState();
    var workouts = items.slice()
        .sort(function(a, b) { return a.timestamp - b.timestamp; }) // כרונולוגי — עולה
        .map(function(item) {
            var clone = JSON.parse(JSON.stringify(item));
            if (!withCoach) {
                delete clone.aiSummary;
                clone.summary = _stripCoachFromSummary(clone.summary);
            }
            return clone;
        });
    var payload = {
        app: 'GYMPRO ELITE',
        scope: scopeLabel,
        workouts_count: workouts.length,
        includes_coach_summary: withCoach,
        generated: new Date().toISOString(),
        workouts: workouts
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gympro_claude_' + scopeSlug + '_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    haptic('success');
    showAlert('נוצר קובץ JSON לקלוד · ' + workouts.length + ' אימונים' + (withCoach ? ' (כולל סיכומי מאמן)' : ' (ללא סיכומי מאמן)'));
}

// exportClaudeFile — ברירת המחדל: כל הלוג.
function exportClaudeFile() {
    var history = StorageManager.getArchive();
    if (!history.length) { showAlert('אין אימונים בארכיון'); return; }
    _downloadClaudeFile(history, 'כל הלוג', 'all');
}

// executeDownloadByRange — קובץ לקלוד לפי הטווח שנבחר במסך הטווח.
function executeDownloadByRange() {
    var items = _getRangeItems();
    if (!items.length) { showAlert('אין אימונים בטווח שנבחר'); return; }
    _downloadClaudeFile(items, _rangeLabelText(), 'range');
    closeRangeSheet();
}
