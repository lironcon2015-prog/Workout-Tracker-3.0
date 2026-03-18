/**
 * GYMPRO ELITE - ARCHIVE & ANALYTICS
 * Version: 14.1.1
 * Fixes: consistency RTL direction, horizontal type chart, volume by muscle,
 *        micro selector manual sort, adaptive cons legend, best-E1RM PR,
 *        archive month grouping.
 */

function finish() {
    haptic('success');
    StorageManager.clearSessionState();
    state.workoutDurationMins = Math.floor((Date.now() - state.workoutStartTime) / 60000);
    navigate('ui-summary');
    document.getElementById('summary-note').value = "";

    let grouped = {};
    state.log.forEach(e => {
        if (!grouped[e.exName]) grouped[e.exName] = { sets:[], vol: 0, hasWarmup: false };
        if (e.isWarmup) grouped[e.exName].hasWarmup = true;
        else if (!e.skip) {
            let weightStr = `${e.w}kg`;
            if (isUnilateral(e.exName)) weightStr += ` (יד אחת)`;
            let setStr = `${weightStr} x ${e.r} (RIR ${e.rir})`;
            if (e.note) setStr += ` | Note: ${e.note}`;
            grouped[e.exName].sets.push(setStr);
            grouped[e.exName].vol += (e.w * e.r);
        }
    });
    state.lastWorkoutDetails = grouped;

    const workoutDisplayName = state.type;
    const dateStr = new Date().toLocaleDateString('he-IL');
    let summaryText = `GYMPRO ELITE SUMMARY\n${workoutDisplayName} | Week ${state.week} | ${dateStr} | ${state.workoutDurationMins}m\n\n`;

    let html = `
    <div class="summary-overview-card">
        <div class="summary-overview-col"><span class="summary-overview-val">${workoutDisplayName}</span><span class="summary-overview-label">תוכנית</span></div>
        <div class="summary-overview-col"><span class="summary-overview-val">${state.week}</span><span class="summary-overview-label">שבוע</span></div>
        <div class="summary-overview-col"><span class="summary-overview-val">${state.workoutDurationMins}m</span><span class="summary-overview-label">זמן</span></div>
        <div class="summary-overview-col"><span class="summary-overview-val">${dateStr}</span><span class="summary-overview-label">תאריך</span></div>
    </div>`;

    let processedIndices = new Set();
    let lastClusterRound = 0;

    state.log.forEach((entry, index) => {
        if (processedIndices.has(index)) return;
        if (entry.isWarmup) return;

        if (entry.isCluster) {
            if (entry.round && entry.round !== lastClusterRound) {
                summaryText += `\n--- Cluster Round ${entry.round} ---\n`;
                html += `<div class="summary-cluster-round">סבב ${entry.round}</div>`;
                lastClusterRound = entry.round;
            }
            html += `<div class="summary-ex-card"><div class="summary-ex-header"><span class="summary-ex-title">${entry.exName}</span></div>`;
            let details = "";
            if (entry.skip) {
                details = "(Skipped)";
                html += `<div class="summary-tag-skip">דילוג</div>`;
            } else {
                let weightStr = `${entry.w}kg`;
                if (isUnilateral(entry.exName)) weightStr += ` (Uni)`;
                details = `${weightStr} x ${entry.r} (RIR ${entry.rir})`;
                if (entry.note) details += ` | ${entry.note}`;
                html += `<div class="summary-set-row"><span class="summary-set-num">-</span><span class="summary-set-details">${weightStr} x ${entry.r} (RIR ${entry.rir})</span></div>`;
                if (entry.note) html += `<div class="summary-set-note">הערה: ${entry.note}</div>`;
            }
            summaryText += `• ${entry.exName}: ${details}\n`;
            html += `</div>`;
            processedIndices.add(index);
        } else {
            lastClusterRound = 0;
            if (grouped[entry.exName]) {
                summaryText += `${entry.exName} (Vol: ${grouped[entry.exName].vol}kg):\n`;
                if (grouped[entry.exName].hasWarmup) summaryText += `🔥 Warmup Completed\n`;
                html += `<div class="summary-ex-card"><div class="summary-ex-header"><span class="summary-ex-title">${entry.exName}</span><span class="summary-ex-vol">[נפח: ${grouped[entry.exName].vol}kg]</span></div>`;
                if (grouped[entry.exName].hasWarmup) html += `<div class="summary-tag-warmup">[ סט חימום ]</div>`;
                let setCounter = 1;
                state.log.forEach((subEntry, subIndex) => {
                    if (!processedIndices.has(subIndex) && !subEntry.isCluster && subEntry.exName === entry.exName && !subEntry.isWarmup) {
                        if (subEntry.skip) {
                            summaryText += `(Skipped)\n`;
                            html += `<div class="summary-tag-skip">(דילוג)</div>`;
                        } else {
                            let weightStr = `${subEntry.w}kg`;
                            if (isUnilateral(subEntry.exName)) weightStr += ` (יד אחת)`;
                            summaryText += `${weightStr} x ${subEntry.r} (RIR ${subEntry.rir})${subEntry.note ? ' | Note: ' + subEntry.note : ''}\n`;
                            html += `<div class="summary-set-row"><span class="summary-set-num">${setCounter}.</span><span class="summary-set-details">${weightStr} x ${subEntry.r} (RIR ${subEntry.rir})</span></div>`;
                            if (subEntry.note) html += `<div class="summary-set-note">הערה: ${subEntry.note}</div>`;
                            setCounter++;
                        }
                        processedIndices.add(subIndex);
                    }
                });
                summaryText += `\n`;
                html += `</div>`;
            }
        }
    });

    const summaryArea = document.getElementById('summary-area');
    summaryArea.className = "";
    summaryArea.innerHTML = html;
    summaryArea.dataset.rawSummary = summaryText.trim();
}

function copyResult() {
    const summaryArea = document.getElementById('summary-area');
    const rawText = summaryArea.dataset.rawSummary;
    let textToCopy = rawText;
    const userNote = document.getElementById('summary-note').value.trim();
    if (userNote) textToCopy += `\n\n📝 הערות כלליות: ${userNote}`;
    const archiveObj = {
        id: Date.now(), date: new Date().toLocaleDateString('he-IL'),
        timestamp: Date.now(), type: state.type, week: state.week,
        duration: state.workoutDurationMins, summary: textToCopy,
        details: state.lastWorkoutDetails, generalNote: userNote
    };
    StorageManager.saveToArchive(archiveObj);
    if (navigator.clipboard) {
        navigator.clipboard.writeText(textToCopy).then(() => { haptic('light'); alert("הסיכום נשמר בארכיון והועתק!"); location.reload(); });
    } else {
        const el = document.createElement("textarea"); el.value = textToCopy;
        document.body.appendChild(el); el.select(); document.execCommand('copy');
        document.body.removeChild(el); alert("הסיכום נשמר בארכיון והועתק!"); location.reload();
    }
}

function switchArchiveView(view) {
    state.archiveView = view;
    document.getElementById('btn-view-list').className = `segment-btn ${view === 'list' ? 'active' : ''}`;
    document.getElementById('btn-view-calendar').className = `segment-btn ${view === 'calendar' ? 'active' : ''}`;
    openArchive();
}

function openArchive() {
    if (state.archiveView === 'list') {
        document.getElementById('list-view-container').style.display = 'block';
        document.getElementById('calendar-view').style.display = 'none';
        renderArchiveList();
    } else {
        document.getElementById('list-view-container').style.display = 'none';
        document.getElementById('calendar-view').style.display = 'block';
        state.calendarOffset = 0;
        renderCalendar();
    }
    navigate('ui-archive');
}

let selectedArchiveIds = new Set();
const MONTH_NAMES_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

function createArchiveCard(item) {
    const card = document.createElement('div');
    card.className = "menu-card";
    card.style.cursor = "default";
    const weekStr = item.week ? ` • שבוע ${item.week}` : '';
    card.innerHTML = `
        <div class="archive-card-row">
            <input type="checkbox" class="archive-checkbox" data-id="${item.timestamp}">
            <div class="archive-info">
                <div class="flex-between w-100">
                    <h3 class="m-0">${item.date}</h3>
                    <span class="text-sm color-dim">${item.duration} דק'</span>
                </div>
                <p class="m-0 color-dim text-sm">${item.type}${weekStr}</p>
            </div>
            <div class="chevron"></div>
        </div>`;
    const checkbox = card.querySelector('.archive-checkbox');
    checkbox.addEventListener('change', (e) => toggleArchiveSelection(parseInt(e.target.dataset.id)));
    checkbox.addEventListener('click', (e) => e.stopPropagation());
    card.addEventListener('click', (e) => { if (e.target !== checkbox) showArchiveDetail(item); });
    return card;
}

function renderArchiveList() {
    const list = document.getElementById('archive-list');
    list.innerHTML = "";
    selectedArchiveIds.clear();
    updateCopySelectedBtn();
    const history = StorageManager.getArchive();

    if (history.length === 0) {
        list.innerHTML = `<div class="text-center color-dim mt-md">אין אימונים שמורים</div>`;
        return;
    }

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const monthGroups = {};

    history.forEach(item => {
        const d = new Date(item.timestamp);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (!monthGroups[key]) {
            monthGroups[key] = {
                label: `${MONTH_NAMES_HE[d.getMonth()]} ${d.getFullYear()}`,
                isCurrentMonth: key === currentMonthKey,
                items: []
            };
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

        if (group.isCurrentMonth) {
            const header = document.createElement('div');
            header.className = 'archive-month-header current';
            header.innerHTML = `<span class="archive-month-title">${group.label}</span><span class="archive-month-meta">${group.items.length} אימונים • ${volStr}</span>`;
            list.appendChild(header);
            group.items.forEach(item => list.appendChild(createArchiveCard(item)));
        } else {
            const monthContainer = document.createElement('div');
            monthContainer.className = 'archive-month-group';

            const header = document.createElement('div');
            header.className = 'archive-month-header collapsible';
            header.innerHTML = `
                <div class="archive-month-header-inner">
                    <span class="archive-month-title">${group.label}</span>
                    <span class="archive-month-meta">${group.items.length} אימונים • ${volStr}</span>
                </div>
                <div class="archive-month-arrow">›</div>`;

            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'archive-month-items collapsed';
            group.items.forEach(item => itemsContainer.appendChild(createArchiveCard(item)));

            header.addEventListener('click', () => {
                const isOpen = !itemsContainer.classList.contains('collapsed');
                itemsContainer.classList.toggle('collapsed', isOpen);
                header.classList.toggle('open', !isOpen);
            });

            monthContainer.appendChild(header);
            monthContainer.appendChild(itemsContainer);
            list.appendChild(monthContainer);
        }
    });
}

function toggleArchiveSelection(id) {
    if (selectedArchiveIds.has(id)) selectedArchiveIds.delete(id); else selectedArchiveIds.add(id);
    updateCopySelectedBtn();
}

function updateCopySelectedBtn() {
    const btn = document.getElementById('btn-copy-selected');
    if (selectedArchiveIds.size > 0) {
        btn.disabled = false; btn.style.opacity = "1";
        btn.style.borderColor = "var(--accent)"; btn.style.color = "var(--accent)";
    } else {
        btn.disabled = true; btn.style.opacity = "0.5";
        btn.style.borderColor = "var(--border)"; btn.style.color = "var(--text-dim)";
    }
}

function copyBulkLog(mode) {
    const history = StorageManager.getArchive();
    let itemsToCopy = mode === 'all' ? history : history.filter(item => selectedArchiveIds.has(item.timestamp));
    if (itemsToCopy.length === 0) { alert("לא נבחרו אימונים להעתקה"); return; }
    const bulkText = itemsToCopy.map(item => item.summary).join("\n\n========================================\n\n");
    if (navigator.clipboard) navigator.clipboard.writeText(bulkText).then(() => { haptic('success'); alert(`הועתקו ${itemsToCopy.length} אימונים בהצלחה!`); });
    else { const el = document.createElement("textarea"); el.value = bulkText; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); alert(`הועתקו ${itemsToCopy.length} אימונים בהצלחה!`); }
}

function changeMonth(delta) { state.calendarOffset += delta; renderCalendar(); }

function renderCalendar() {
    const grid = document.getElementById('calendar-days');
    grid.innerHTML = "";
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + state.calendarOffset, 1);
    const year = targetDate.getFullYear(), month = targetDate.getMonth();
    document.getElementById('current-month-display').innerText = `${MONTH_NAMES_HE[month]} ${year}`;
    const firstDayIndex = targetDate.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const history = StorageManager.getArchive();
    const monthWorkouts = history.filter(item => { const d = new Date(item.timestamp); return d.getMonth() === month && d.getFullYear() === year; });
    for (let i = 0; i < firstDayIndex; i++) { const cell = document.createElement('div'); cell.className = "calendar-cell empty"; grid.appendChild(cell); }
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div'); cell.className = "calendar-cell";
        cell.innerHTML = `<span>${day}</span>`;
        if (state.calendarOffset === 0 && day === today.getDate()) cell.classList.add('today');
        const dailyWorkouts = monthWorkouts.filter(item => new Date(item.timestamp).getDate() === day);
        if (dailyWorkouts.length > 0) {
            const dotsContainer = document.createElement('div'); dotsContainer.className = "dots-container";
            dailyWorkouts.forEach(wo => {
                const dot = document.createElement('div');
                let dotClass = 'type-free';
                if (wo.type.includes('A')) dotClass = 'type-a';
                else if (wo.type.includes('B')) dotClass = 'type-b';
                else if (wo.type.includes('C')) dotClass = 'type-c';
                dot.className = `dot ${dotClass}`; dotsContainer.appendChild(dot);
            });
            cell.appendChild(dotsContainer);
            cell.onclick = () => openDayDrawer(dailyWorkouts, day, MONTH_NAMES_HE[month]);
        }
        grid.appendChild(cell);
    }
}

function openDayDrawer(workouts, day, monthName) {
    const drawer = document.getElementById('sheet-modal');
    const overlay = document.getElementById('sheet-overlay');
    const content = document.getElementById('sheet-content');
    let html = `<h3>${day} ב${monthName}</h3>`;
    if (!workouts.length) { html += `<p class="color-dim text-sm">אין אימונים ביום זה</p>`; }
    else {
        html += `<p class="color-dim text-sm">נמצאו ${workouts.length} אימונים:</p>`;
        workouts.forEach(wo => {
            let dotColor = '#BF5AF2';
            if (wo.type.includes('A')) dotColor = '#0A84FF';
            else if (wo.type.includes('B')) dotColor = '#32D74B';
            else if (wo.type.includes('C')) dotColor = '#FF9F0A';
            html += `<div class="mini-workout-item" onclick='openArchiveFromDrawer(${JSON.stringify(wo).replace(/'/g, "&#39;")})'>
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

function openArchiveFromDrawer(itemData) {
    closeDayDrawer();
    const realItem = StorageManager.getArchive().find(i => i.timestamp === itemData.timestamp);
    if (realItem) showArchiveDetail(realItem);
}

function showArchiveDetail(item) {
    currentArchiveItem = item;
    document.getElementById('archive-detail-content').innerText = item.summary;
    document.getElementById('btn-archive-copy').onclick = () => navigator.clipboard.writeText(item.summary).then(() => alert("הועתק!"));
    document.getElementById('btn-archive-delete').onclick = () => {
        if (confirm("למחוק אימון זה מהארכיון?")) { StorageManager.deleteFromArchive(item.timestamp); state.historyStack.pop(); openArchive(); }
    };
    navigate('ui-archive-detail');
}

function exportData() {
    const data = StorageManager.getAllData();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: "application/json"}));
    a.download = `gympro_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function triggerImport() { document.getElementById('import-file').click(); }
function importData(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try { const data = JSON.parse(e.target.result); if (confirm("האם לדרוס את הנתונים הקיימים ולשחזר מהגיבוי?")) { StorageManager.restoreData(data); alert("הנתונים שוחזרו בהצלחה!"); location.reload(); } }
        catch(err) { alert("שגיאה בטעינת הקובץ."); }
    };
    reader.readAsText(file);
}

function triggerConfigImport() { document.getElementById('import-config-file').click(); }
function processConfigImport(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { try { StorageManager.importConfiguration(JSON.parse(e.target.result)); } catch(err) { alert("שגיאה בטעינת הקובץ."); } };
    reader.readAsText(file);
}

function openSessionLog() {
    const drawer = document.getElementById('sheet-modal'), overlay = document.getElementById('sheet-overlay'), content = document.getElementById('sheet-content');
    let html = `<h3>יומן אימון נוכחי</h3>`;
    if (!state.log.length) { html += `<p class="text-center mt-lg color-dim">טרם בוצעו סטים באימון זה</p>`; }
    else {
        html += `<div class="vertical-stack mt-sm">`;
        state.log.forEach((entry, index) => {
            let details = "", dotColor = "var(--text-dim)";
            if (entry.skip) details = "דילוג על תרגיל";
            else if (entry.isWarmup) { details = "סט חימום"; dotColor = "#ff3b30"; }
            else { details = `${entry.w}kg x ${entry.r} (RIR ${entry.rir})`; if (entry.note) details += ` | 📝`; dotColor = "var(--accent)"; }
            html += `<div class="mini-workout-item" onclick="openEditSet(${index})"><div class="mini-dot" style="background:${dotColor}"></div><div style="flex-grow:1;"><div class="font-semi text-sm">${index+1}. ${entry.exName}</div><div class="text-sm color-dim mt-xs">${details}</div></div><div class="chevron"></div></div>`;
        });
        html += `</div>`;
    }
    content.innerHTML = html; overlay.style.display = 'block'; drawer.classList.add('open'); haptic('light');
}

function openHistoryDrawer() {
    const drawer = document.getElementById('sheet-modal'), overlay = document.getElementById('sheet-overlay'), content = document.getElementById('sheet-content');
    const history = getLastPerformance(state.currentExName);
    let html = `<h3>היסטוריה: ${state.currentExName}</h3>`;
    if (!history) { html += `<p class="text-center mt-lg color-dim">אין נתונים מהאימון הקודם</p>`; }
    else {
        html += `<div class="text-sm color-dim mb-md text-right mt-xs">📅 ביצוע אחרון: ${history.date}</div>`;
        html += `<div class="history-header"><div>סט</div><div>משקל</div><div>חזרות</div><div>RIR</div></div><div class="history-list">`;
        history.sets.forEach((setStr, idx) => {
            let weight = "-", reps = "-", rir = "-";
            try {
                let core = setStr.includes('| Note:') ? setStr.split('| Note:')[0].trim() : setStr;
                const parts = core.split('x');
                if (parts.length > 1) { weight = parts[0].replace('kg','').trim(); const rirMatch = parts[1].match(/\(RIR (.*?)\)/); reps = parts[1].split('(')[0].trim(); if (rirMatch) rir = rirMatch[1]; }
            } catch(e) {}
            html += `<div class="history-row"><div class="history-col set-idx">#${idx+1}</div><div class="history-col">${weight}</div><div class="history-col">${reps}</div><div class="history-col rir-note">${rir}</div></div>`;
        });
        html += `</div>`;
    }
    content.innerHTML = html; overlay.style.display = 'block'; drawer.classList.add('open'); haptic('light');
}

function getLastPerformance(exName) {
    const archive = StorageManager.getArchive();
    for (const item of archive) {
        if (item.week === 'deload') continue;
        if (item.details && item.details[exName] && item.details[exName].sets && item.details[exName].sets.length > 0) return { date: item.date, sets: item.details[exName].sets };
    }
    return null;
}

function openEditSet(index) {
    const entry = state.log[index];
    if (entry.skip || entry.isWarmup) { alert("לא ניתן לערוך דילוגים או סטים של חימום כרגע."); return; }
    state.editingIndex = index;
    document.getElementById('edit-weight').value = entry.w;
    document.getElementById('edit-reps').value = entry.r;
    document.getElementById('edit-rir').value = entry.rir;
    document.getElementById('edit-note').value = entry.note || "";
    document.getElementById('btn-delete-set').style.display = 'block';
    closeDayDrawer();
    document.getElementById('edit-set-modal').style.display = 'flex';
}

function closeEditModal() { document.getElementById('edit-set-modal').style.display = 'none'; state.editingIndex = -1; }

function saveSetEdit() {
    if (state.editingIndex === -1) return;
    const w = parseFloat(document.getElementById('edit-weight').value);
    const r = parseInt(document.getElementById('edit-reps').value);
    const rir = document.getElementById('edit-rir').value;
    const note = document.getElementById('edit-note').value;
    if (isNaN(w) || isNaN(r)) { alert("נא להזין ערכים תקינים"); return; }
    state.log[state.editingIndex] = { ...state.log[state.editingIndex], w, r, rir, note };
    if (state.editingIndex === state.log.length - 1) {
        state.lastLoggedSet = state.log[state.editingIndex];
        const hist = document.getElementById('last-set-info');
        hist.innerText = `סט אחרון: ${w}kg x ${r} (RIR ${rir})`;
    }
    StorageManager.saveSessionState(); closeEditModal(); haptic('success'); openSessionLog();
}

function deleteSetFromLog() {
    if (state.editingIndex === -1) return;
    if (!confirm("האם למחוק את הסט הזה?")) return;
    const removedEntry = state.log[state.editingIndex];
    state.log.splice(state.editingIndex, 1);
    if (removedEntry.exName === state.currentExName) {
        if (state.setIdx > 0) state.setIdx--;
        const rel = state.log.filter(l => l.exName === state.currentExName && !l.skip && !l.isWarmup);
        state.lastLoggedSet = rel.length > 0 ? rel[rel.length - 1] : null;
    }
    StorageManager.saveSessionState(); closeEditModal(); haptic('warning');
    if (document.getElementById('ui-main').classList.contains('active') && typeof initPickers === 'function') initPickers();
    openSessionLog();
}

// =========================================
// ANALYTICS ENGINE v14.1.1
// =========================================

const ANALYTICS_PREFS_KEY = 'gympro_analytics_prefs';
const ANALYTICS_DEFAULTS = {
    name: '', units: 'kg', formula: 'epley',
    heroMetrics: ['days', 'vol', 'duration'],
    volumeRange: 8, volumeMuscle: 'all',
    muscleRange: '3m', consistencyRange: 8,
    microPoints: 6, microAxis: 'e1rm',
    microOrder: null,
    workoutAliases: {}  // { displayName: [rawName1, rawName2, ...] }
};

function getAnalyticsPrefs() { return Object.assign({}, ANALYTICS_DEFAULTS, StorageManager.getData(ANALYTICS_PREFS_KEY) || {}); }
function saveAnalyticsPrefs(prefs) { StorageManager.saveData(ANALYTICS_PREFS_KEY, prefs); }

function calc1RM(weight, reps, formula) {
    if (reps <= 1) return weight;
    switch (formula) {
        case 'brzycki':  return weight * (36 / (37 - reps));
        case 'lombardi': return weight * Math.pow(reps, 0.10);
        default:         return weight * (1 + reps / 30);
    }
}

function getArchiveClean() { return StorageManager.getArchive().filter(a => a.week !== 'deload'); }

function getWorkoutVolume(workout) {
    if (!workout.details) return 0;
    return Object.values(workout.details).reduce((s, ex) => s + (ex.vol || 0), 0);
}

function getWorkoutVolumeFiltered(workout, muscleFilter) {
    if (!workout.details || !muscleFilter || muscleFilter === 'all') return getWorkoutVolume(workout);
    let total = 0;
    Object.entries(workout.details).forEach(([exName, exData]) => {
        const ex = state.exercises.find(e => e.name === exName);
        const muscle = (ex && ex.muscles && ex.muscles[0]) ? ex.muscles[0] : 'אחר';
        if (muscle === muscleFilter) total += (exData.vol || 0);
    });
    return total;
}

function getMuscleSetCounts(archive, range) {
    const now = Date.now();
    const cutoff = range === '1m' ? now - 30 * 86400000 : range === '3m' ? now - 90 * 86400000 : 0;
    const map = {};
    archive.filter(a => a.timestamp >= cutoff).forEach(w => {
        if (!w.details) return;
        Object.entries(w.details).forEach(([exName, data]) => {
            const ex = state.exercises.find(e => e.name === exName);
            const muscle = (ex && ex.muscles && ex.muscles[0]) ? ex.muscles[0] : 'אחר';
            map[muscle] = (map[muscle] || 0) + ((data.sets && data.sets.length) ? data.sets.length : 0);
        });
    });
    return map;
}

function parseSetsFromStrings(sets) {
    return sets.map(s => {
        try {
            const core = s.includes('| Note:') ? s.split('| Note:')[0].trim() : s;
            const parts = core.split('x'); if (parts.length < 2) return null;
            const w = parseFloat(parts[0].replace('kg','').replace('(יד אחת)','').trim());
            const repsMatch = parts[1].match(/\d+/); const r = repsMatch ? parseInt(repsMatch[0]) : 1;
            const rirMatch = core.match(/RIR\s*(\S+)/); const rir = rirMatch ? rirMatch[1] : '—';
            if (isNaN(w)) return null; return { w, r, rir };
        } catch(e) { return null; }
    }).filter(Boolean);
}

// ─── HERO CARD ───────────────────────────
const HERO_METRIC_DEFS = {
    days: (a) => { const d = a.length ? Math.floor((Date.now() - a[0].timestamp) / 86400000) : '—'; return { val: d, lbl: 'ימים מאז\nאחרון' }; },
    vol: (a) => { const v = a.length ? getWorkoutVolume(a[0]) : 0; return { val: v ? v + 'kg' : '—', lbl: 'נפח\nאחרון' }; },
    duration: (a) => ({ val: (a.length && a[0].duration) ? a[0].duration + 'm' : '—', lbl: 'משך\nאחרון' }),
    avg_vol: (a) => { const s = a.slice(0,4); const avg = s.length ? Math.round(s.reduce((t,x) => t + getWorkoutVolume(x), 0) / s.length) : 0; return { val: avg ? avg + 'kg' : '—', lbl: 'ממוצע נפח\n4 אימונים' }; },
    total: (a) => ({ val: a.length, lbl: 'סך\nאימונים' })
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
    if (name === 'workout') navigate('ui-week', true);
    else if (name === 'analytics') { navigate('ui-analytics', true); renderAnalyticsDashboard(); }
    else if (name === 'archive') { navigate('ui-archive', true); openArchive(); }
    haptic('light');
}

function renderAnalyticsDashboard() {
    const prefs = getAnalyticsPrefs(), archive = getArchiveClean();
    renderHeroMetricsGrid(archive);
    renderVolumeBarChart(archive, prefs.volumeRange, prefs.volumeMuscle || 'all');
    renderWorkoutTypeChart(archive);
    renderDonutChart(archive, prefs.muscleRange);
    renderConsistencyTrack(archive, prefs.consistencyRange);
    populateMicroSelector(archive);
    syncVolMuscleChips(prefs.volumeMuscle || 'all');
}

function syncVolMuscleChips(muscle) {
    document.querySelectorAll('#vol-muscle-chips .range-chip').forEach(b => {
        b.classList.toggle('active', b.dataset.muscle === muscle);
    });
}

function renderHeroMetricsGrid(archive) {
    const total = archive.length;
    const totalVol = archive.reduce((s, a) => s + getWorkoutVolume(a), 0);
    const totalDurMins = archive.reduce((s, a) => s + (a.duration || 0), 0);
    const bestVol = archive.reduce((mx, a) => Math.max(mx, getWorkoutVolume(a)), 0);
    const avgDur = total ? Math.round(totalDurMins / total) : 0;
    const el = document.getElementById('hero-metrics-grid'); if (!el) return;
    el.innerHTML = `
        <div class="metric-tile"><div class="metric-tile-lbl">נפח כולל</div><div class="metric-tile-val" style="color:var(--accent)">${(totalVol/1000).toFixed(1)}t</div><div class="metric-tile-sub">${total} אימונים</div></div>
        <div class="metric-tile"><div class="metric-tile-lbl">זמן כולל</div><div class="metric-tile-val">${Math.round(totalDurMins/60)}h</div><div class="metric-tile-sub">ממוצע ${avgDur}m</div></div>
        <div class="metric-tile"><div class="metric-tile-lbl">אימונים</div><div class="metric-tile-val">${total}</div><div class="metric-tile-sub">&nbsp;</div></div>
        <div class="metric-tile highlight"><div class="metric-tile-lbl" style="color:var(--type-b)">🏆 שיא נפח</div><div class="metric-tile-val" style="color:var(--type-b)">${(bestVol/1000).toFixed(1)}t</div><div class="metric-tile-sub">&nbsp;</div></div>`;
}

// ─── VOLUME BAR CHART (with muscle filter) ──
function renderVolumeBarChart(archive, n, muscleFilter) {
    const el = document.getElementById('vol-bar-chart'); if (!el) return;
    // Newest first = index 0 = rightmost in RTL flex — no .reverse() needed
    const data = archive.slice(0, n);

    // Trend badge
    const trendEl = document.getElementById('vol-trend-badge');
    if (trendEl) {
        if (data.length >= 4) {
            const half = Math.floor(data.length / 2);
            const recentAvg = data.slice(0, half).reduce((s,a) => s + getWorkoutVolumeFiltered(a, muscleFilter), 0) / half;
            const olderAvg  = data.slice(half).reduce((s,a) => s + getWorkoutVolumeFiltered(a, muscleFilter), 0) / (data.length - half);
            if (olderAvg > 0) {
                const pct = Math.round((recentAvg - olderAvg) / olderAvg * 100);
                trendEl.innerHTML = `<span style="color:${pct>=0?'var(--type-b)':'var(--danger)'};font-size:0.85em;font-weight:700;">${pct>=0?'↑':'↓'} ${Math.abs(pct)}%</span>`;
            } else trendEl.innerHTML = '';
        } else trendEl.innerHTML = '';
    }

    if (!data.length) { el.innerHTML = '<p class="color-dim text-sm text-center mt-md">אין נתונים</p>'; return; }

    // RTL: index 0 = rightmost = newest. No reverse needed.
    const vols = data.map(a => getWorkoutVolumeFiltered(a, muscleFilter));
    const maxV = Math.max(...vols) || 1;

    el.innerHTML = data.map((a, i) => {
        const pct = (vols[i] / maxV * 88).toFixed(1);
        const isPeak = vols[i] === maxV;
        const dt = (a.date || '').slice(0, 5);
        const label = vols[i] >= 1000 ? (vols[i]/1000).toFixed(1)+'t' : vols[i]+'kg';
        return `<div class="bar-col-wrap"><div class="bar-col-track"><div class="bar-col-val">${label}</div><div class="bar-col-fill${isPeak?' peak':''}" style="height:${pct}%"></div></div><div class="bar-col-date">${dt}</div></div>`;
    }).join('');
}

// ─── WORKOUT TYPE CHART (horizontal bars) ──
// ─── ALIAS HELPERS ───────────────────────
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
    const entries = buildNormalizedTypeData(archive, aliases);

    if (!entries.length) { el.innerHTML = '<p class="color-dim text-sm text-center">אין נתונים</p>'; return; }
    const maxAvg = Math.max(...entries.map(e => e.avg)) || 1;
    const COLORS = ['var(--type-a)', 'var(--type-b)', 'var(--type-c)', 'var(--type-free)', 'var(--accent)'];

    el.innerHTML = entries.map((e, i) => {
        const pct = (e.avg / maxAvg * 100).toFixed(1);
        const color = COLORS[i % COLORS.length];
        const label = e.avg >= 1000 ? (e.avg/1000).toFixed(1)+'t' : e.avg+'kg';
        const groupedCls = e.aliased ? ' grouped' : '';
        const gdot = e.aliased ? '<span class="hbar-gdot"></span>' : '';
        const tooltipData = e.aliased ? `data-members="${e.rawNames.join('|')}"` : '';
        return `<div class="hbar-row">
            <div class="hbar-label${groupedCls}" ${tooltipData} onclick="showWTToast('${e.display.replace(/'/g,"\'")}','${e.rawNames.join(", ").replace(/'/g,"\'")}',${e.count})">${gdot}${e.display}</div>
            <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;background:${color};"></div><span class="hbar-val">${label}</span></div>
            <div class="hbar-count">${e.count}×</div>
        </div>`;
    }).join('');
}

// ─── WORKOUT TYPE TOAST ───────────────────
let _wtToastTimer;
function showWTToast(display, members, count) {
    const t = document.getElementById('wt-toast'); if (!t) return;
    const membersStr = members !== display ? members : `${count} אימונים`;
    t.textContent = `${display} — ${membersStr}`;
    t.classList.add('show');
    clearTimeout(_wtToastTimer);
    _wtToastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ─── ALIAS SHEET ─────────────────────────
let _aliasSelected = new Set();
let _aliasGroupName = '';
let _aliasStep = 1;
let _aliasEditingGroup = null; // name of group being edited

function openAliasSheet() {
    _aliasSelected = new Set();
    _aliasGroupName = '';
    _aliasEditingGroup = null;
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

    // Collect all raw types with stats
    const rawMap = {};
    archive.forEach(w => {
        const t = w.type || 'אחר';
        if (!rawMap[t]) rawMap[t] = { count: 0, totalVol: 0 };
        rawMap[t].count++;
        rawMap[t].totalVol += getWorkoutVolume(w);
    });

    // Map raw → group
    const rawToGroup = {};
    Object.entries(aliases).forEach(([g, ms]) => ms.forEach(m => rawToGroup[m] = g));

    let html = `<div class="sh-title">קיבוץ סוגי אימונים</div>
        <div class="sheet-content" style="font-size:0.78em;color:var(--text-dim);margin-bottom:18px;line-height:1.5;">
            סמן אימונים שהם למעשה אותו אימון — שמות שהשתנו על פני זמן
        </div>`;

    // Existing groups
    if (Object.keys(aliases).length > 0) {
        html += `<div style="font-size:0.62em;color:var(--text-dim);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">קבוצות קיימות</div>`;
        Object.entries(aliases).forEach(([g, ms]) => {
            html += `<div class="alias-existing-row" onclick="_editAliasGroup('${g.replace(/'/g,"\'")}')" >
                <div class="alias-eg-dot"></div>
                <div style="flex:1;">
                    <div class="alias-eg-name">${g}</div>
                    <div class="alias-eg-members">${ms.join(' · ')}</div>
                </div>
                <button class="alias-del-btn" onclick="event.stopPropagation();_deleteAliasGroup('${g.replace(/'/g,"\'")}')">מחק</button>
            </div>`;
        });
        html += `<div style="height:1px;background:rgba(255,255,255,0.07);margin:14px 0;"></div>`;
    }

    html += `<div style="font-size:0.62em;color:var(--text-dim);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">קבוצה חדשה — בחר אימונים</div>`;

    const rawNames = Object.keys(rawMap).sort();
    rawNames.forEach(t => {
        const d = rawMap[t];
        const inGroup = rawToGroup[t];
        const isSel = _aliasSelected.has(t);
        const avgVol = d.count > 0 ? Math.round(d.totalVol / d.count) : 0;
        const avgStr = avgVol >= 1000 ? (avgVol/1000).toFixed(1)+'t' : avgVol+'kg';
        html += `<div class="alias-raw-row" onclick="_toggleAliasSelect('${t.replace(/'/g,"\'")}')">
            <div class="alias-check${isSel?' on':''}"></div>
            <div style="flex:1;">
                <div class="alias-type-name">${t}</div>
                <div class="alias-meta">${d.count} אימונים · ממוצע ${avgStr}</div>
            </div>
            ${inGroup ? `<span class="alias-group-badge">${inGroup}</span>` : ''}
        </div>`;
    });

    const canNext = _aliasSelected.size >= 2;
    html += `<button class="btn-main primary-gradient" style="margin-top:16px;" ${canNext?'':'disabled'} onclick="_renderAliasStep2()">
        המשך${_aliasSelected.size >= 2 ? ` (${_aliasSelected.size} נבחרו)` : ''}
    </button>
    <button class="btn-text" onclick="closeAliasSheet()">ביטול</button>`;

    document.getElementById('alias-sheet-body').innerHTML = html;
}

function _toggleAliasSelect(name) {
    if (_aliasSelected.has(name)) _aliasSelected.delete(name);
    else _aliasSelected.add(name);
    _renderAliasStep1();
    haptic('light');
}

function _deleteAliasGroup(g) {
    const prefs = getAnalyticsPrefs();
    delete prefs.workoutAliases[g];
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
    // Remove from aliases temporarily so it doesn't interfere
    delete prefs.workoutAliases[g];
    saveAnalyticsPrefs(prefs);
    _renderAliasStep2();
}

function _renderAliasStep2() {
    _aliasStep = 2;
    const selArr = [..._aliasSelected];
    const suggested = _aliasGroupName || selArr.reduce((a,b) => a.length <= b.length ? a : b, selArr[0] || '');

    const html = `<div class="sh-title">שם לקבוצה</div>
        <div class="sheet-content" style="font-size:0.78em;color:var(--text-dim);margin-bottom:18px;line-height:1.5;">
            בחר שם קצר שיופיע בגרף
        </div>
        <div class="alias-name-field">
            <div class="alias-name-lbl">שם תצוגה בגרף</div>
            <input class="alias-name-input" id="alias-name-inp" type="text"
                value="${suggested}"
                placeholder="לדוגמה: חזה"
                oninput="_onAliasNameInput(this.value)"
                onkeydown="if(event.key==='Enter')_renderAliasStep3()">
        </div>
        <div class="alias-preview-box">
            <div class="alias-preview-lbl">אימונים שיאוחדו</div>
            ${selArr.map(n=>`<span class="alias-preview-tag">${n}</span>`).join('')}
        </div>
        <button class="btn-main primary-gradient" id="alias-btn-step3" ${suggested?'':'disabled'} onclick="_renderAliasStep3()">המשך</button>
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

function _renderAliasStep3() {
    if (!_aliasGroupName) return;
    _aliasStep = 3;
    const selArr = [..._aliasSelected];
    const archive = getArchiveClean();
    const rawMap = {};
    archive.forEach(w => { const t = w.type||'אחר'; if (!rawMap[t]) rawMap[t]={count:0,totalVol:0}; rawMap[t].count++; rawMap[t].totalVol+=getWorkoutVolume(w); });
    const totalCount = selArr.reduce((s,n) => s+(rawMap[n]?rawMap[n].count:0), 0);
    const totalVol   = selArr.reduce((s,n) => s+(rawMap[n]?rawMap[n].totalVol:0), 0);
    const avgVol = totalCount > 0 ? Math.round(totalVol/totalCount) : 0;
    const avgStr = avgVol>=1000?(avgVol/1000).toFixed(1)+'t':avgVol+'kg';

    const html = `<div class="sh-title">אישור קיבוץ</div>
        <div class="sheet-content" style="font-size:0.78em;color:var(--text-dim);margin-bottom:18px;">כך ייראה הגרף לאחר האיחוד</div>
        <div class="alias-confirm-box">
            <div class="alias-confirm-name">${_aliasGroupName}</div>
            <div style="font-size:0.72em;color:var(--text-dim);margin-bottom:6px;">${totalCount} אימונים · ממוצע ${avgStr}</div>
            <div class="alias-confirm-arrow">יאחד את ↓</div>
            <div class="alias-confirm-tags">
                ${selArr.map(n=>`<span class="alias-confirm-tag">${n}</span>`).join('')}
            </div>
        </div>
        <button class="btn-main success-gradient" onclick="_saveAliasGroup()">✓ שמור קיבוץ</button>
        <button class="btn-text" onclick="_renderAliasStep2()">⟵ ערוך שם</button>`;

    document.getElementById('alias-sheet-body').innerHTML = html;
}

function _saveAliasGroup() {
    const prefs = getAnalyticsPrefs();
    if (!prefs.workoutAliases) prefs.workoutAliases = {};
    prefs.workoutAliases[_aliasGroupName] = [..._aliasSelected];
    saveAnalyticsPrefs(prefs);
    renderWorkoutTypeChart(getArchiveClean());
    closeAliasSheet();
    haptic('success');
    // Toast
    showWTToast(_aliasGroupName, [..._aliasSelected].join(', '), 0);
}

// ─── DONUT CHART (set counts) ─────────────
const DONUT_COLORS = ['#0A84FF','#32D74B','#FF9F0A','#BF5AF2','#ff453a','#AEAEB2'];

function renderDonutChart(archive, range) {
    const svgEl = document.getElementById('donut-svg-el');
    const centerEl = document.getElementById('donut-center-lbl');
    const legendEl = document.getElementById('donut-legend-el');
    if (!svgEl || !centerEl || !legendEl) return;
    const map = getMuscleSetCounts(archive, range);
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = entries.reduce((s, e) => s + e[1], 0);
    if (!total) { svgEl.innerHTML = ''; centerEl.innerHTML = '<div class="donut-center-val">—</div>'; legendEl.innerHTML = '<div class="color-dim text-sm">אין נתונים</div>'; return; }
    const r = 46, ci = 2 * Math.PI * r;
    let offset = 0, circles = '', legendHtml = '';
    entries.forEach(([name, sets], i) => {
        const da = (sets/total*ci).toFixed(2), gap = (ci - parseFloat(da)).toFixed(2);
        circles += `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${DONUT_COLORS[i]}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${da} ${gap}" stroke-dashoffset="${(-offset).toFixed(2)}"/>`;
        legendHtml += `<div class="donut-legend-row"><div class="donut-legend-dot" style="background:${DONUT_COLORS[i]}"></div><div class="donut-legend-name">${name}</div><div class="donut-legend-pct">${sets} סטים</div></div>`;
        offset += parseFloat(da);
    });
    svgEl.innerHTML = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="14"/>${circles}`;
    centerEl.innerHTML = `<div class="donut-center-val">${total}</div><div class="donut-center-sub">סטים</div>`;
    legendEl.innerHTML = legendHtml;
}

// ─── CONSISTENCY TRACK (adaptive, RTL-correct) ──
function renderConsistencyTrack(archive, n) {
    const el = document.getElementById('cons-track'); if (!el) return;
    // archive[0] = newest. In RTL flex, index 0 = rightmost = first thing user sees. NO .reverse()
    const data = archive.slice(0, n);
    if (data.length < 2) { el.innerHTML = '<p class="color-dim text-sm">נדרשים לפחות 2 אימונים</p>'; return; }

    // Personal adaptive thresholds
    let medianGap = 7;
    if (archive.length >= 3) {
        const gaps = [];
        for (let i = 1; i < archive.length; i++) gaps.push((archive[i-1].timestamp - archive[i].timestamp) / 86400000);
        gaps.sort((a,b) => a-b);
        medianGap = gaps[Math.floor(gaps.length / 2)];
    }
    const greenT  = Math.max(2, Math.round(medianGap * 1.25));
    const orangeT = Math.max(greenT + 1, Math.round(medianGap * 1.75));

    const legendEl = document.getElementById('cons-legend');
    if (legendEl) legendEl.innerHTML = `
        <span style="color:var(--type-b)">● ≤${greenT} ימים</span>
        <span style="color:var(--type-c)">● ${greenT+1}–${orangeT} ימים</span>
        <span style="color:var(--danger)">● ${orangeT+1}+ ימים</span>`;

    let html = '';
    data.forEach((w, i) => {
        let cls = 'today', label = '●';
        if (i < data.length - 1) {
            const days = Math.round((data[i].timestamp - data[i+1].timestamp) / 86400000);
            cls = days <= greenT ? 'green' : days <= orangeT ? 'orange' : 'red';
            label = days + 'd';
        }
        html += `<div class="cons-node-wrap"><div class="cons-node ${cls}">${label}</div><div class="cons-node-date">${(w.date||'').slice(0,5)}</div></div>`;
        if (i < data.length - 1) html += `<div class="cons-connector"></div>`;
    });
    el.innerHTML = html;
    // No scroll needed — newest (index 0) already on right in RTL
}

// ─── MICRO: SELECTOR ─────────────────────
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
        sorted = Object.keys(exMap).sort((a, b) => {
            const da = exMap[a], db = exMap[b];
            if (da.isCalc !== db.isCalc) return da.isCalc ? -1 : 1;
            return da.lastSeenIdx - db.lastSeenIdx;
        });
    }

    const current = sel.value;
    sel.innerHTML = sorted.map(e => `<option value="${e}">${e}</option>`).join('');
    if (current && exMap[current]) sel.value = current;
    if (sel.value) loadMicroData(sel.value);
}

// ─── MICRO: SORT SHEET ───────────────────
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
                <button class="micro-sort-btn" onclick="moveMicroOrder(${i}, -1)" ${i===0?'disabled':''}>↑</button>
                <button class="micro-sort-btn" onclick="moveMicroOrder(${i}, 1)" ${i===order.length-1?'disabled':''}>↓</button>
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

// ─── MICRO: LOAD DATA ────────────────────
function loadMicroData(exName) {
    if (!exName) return;
    const prefs = getAnalyticsPrefs(), archive = getArchiveClean();
    const relevant = archive
        .filter(w => w.details && w.details[exName] && w.details[exName].sets && w.details[exName].sets.length)
        .slice(0, prefs.microPoints)
        .reverse();
    if (!relevant.length) return;
    const vals = relevant.map(w => {
        const parsed = parseSetsFromStrings(w.details[exName].sets); if (!parsed.length) return 0;
        if (prefs.microAxis === 'vol') return w.details[exName].vol || 0;
        if (prefs.microAxis === 'maxw') return Math.max(...parsed.map(s => s.w));
        return Math.max(...parsed.map(s => calc1RM(s.w, s.r, prefs.formula)));
    });
    drawMicroLineChart(vals, relevant.map(w => w.date || ''));
    renderIntensityScore(vals);
    renderPRCard(exName, relevant, prefs);
}

function drawMicroLineChart(vals, dates) {
    const svg = document.getElementById('micro-line-svg'); if (!svg) return;
    const n = vals.length;
    if (n < 2) { svg.innerHTML = '<text x="160" y="82" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="-apple-system,sans-serif" font-size="12">אין מספיק נתונים</text>'; return; }
    const W=320,H=165,pad={t:22,r:20,b:28,l:40};
    const cW=W-pad.l-pad.r,cH=H-pad.t-pad.b;
    const mn=Math.min(...vals)*0.965,mx=Math.max(...vals)*1.035;
    const px=i=>pad.l+(i/(n-1))*cW, py=v=>pad.t+cH-((v-mn)/((mx-mn)||1))*cH;
    const pts=vals.map((v,i)=>[px(i),py(v)]);
    const linePath=pts.map((p,i)=>`${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const areaPath=linePath+` L${pts[n-1][0].toFixed(1)},${(pad.t+cH).toFixed(1)} L${pts[0][0].toFixed(1)},${(pad.t+cH).toFixed(1)} Z`;
    const yL=[mn,(mn+mx)/2,mx].map(v=>`<text x="${pad.l-5}" y="${py(v)+4}" fill="rgba(255,255,255,0.28)" font-size="8.5" text-anchor="end" font-family="-apple-system,sans-serif">${Math.round(v)}</text>`).join('');
    const xL=dates.map((d,i)=>i%2===0?`<text x="${px(i).toFixed(1)}" y="${H-5}" fill="rgba(255,255,255,0.28)" font-size="8" text-anchor="middle" font-family="-apple-system,sans-serif">${d.slice(0,5)}</text>`:'').join('');
    const dots=pts.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5" fill="#000" stroke="#32D74B" stroke-width="2.5"/>`).join('');
    const lp=pts[n-1],tx=lp[0]>W-72?lp[0]-52:lp[0]+6;
    const tip=`<rect x="${tx}" y="${lp[1]-22}" width="50" height="18" rx="5" fill="rgba(50,215,75,0.18)" stroke="rgba(50,215,75,0.45)" stroke-width="0.5"/><text x="${(tx+25).toFixed(1)}" y="${lp[1]-9}" fill="#32D74B" font-size="9.5" text-anchor="middle" font-weight="700" font-family="-apple-system,sans-serif">${Math.round(vals[n-1])}</text>`;
    svg.innerHTML=`<defs><linearGradient id="lcGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#32D74B" stop-opacity="0.3"/><stop offset="100%" stop-color="#32D74B" stop-opacity="0"/></linearGradient></defs>
        <path d="${areaPath}" fill="url(#lcGrad)"/>
        <path d="${linePath}" fill="none" stroke="#32D74B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px rgba(50,215,75,0.5))"/>
        ${yL}${xL}${dots}${tip}`;
}

function renderIntensityScore(vals) {
    const valEl=document.getElementById('intensity-score-val'),deltaEl=document.getElementById('intensity-score-delta'),sparkEl=document.getElementById('micro-sparkline');
    if(!valEl||!vals.length) return;
    const last=vals[vals.length-1],prev=vals.length>1?vals[vals.length-2]:last,delta=(last-prev).toFixed(1);
    valEl.textContent=(last*0.85).toFixed(1);
    if(deltaEl){deltaEl.textContent=(parseFloat(delta)>=0?'↑ ':'↓ ')+Math.abs(delta)+' מהפעם הקודמת';deltaEl.style.color=parseFloat(delta)>=0?'#32D74B':'#ff453a';}
    if(sparkEl&&vals.length>=2){
        const n=vals.length,W=140,H=52,mn=Math.min(...vals),mx=Math.max(...vals);
        const spx=i=>(i/(n-1))*W,spy=v=>H-4-((v-mn)/((mx-mn)||1))*(H-8);
        const pts=vals.map((v,i)=>[spx(i),spy(v)]);
        const path=pts.map((p,i)=>`${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        const lp=pts[n-1];
        sparkEl.innerHTML=`<path d="${path}" fill="none" stroke="rgba(255,159,10,0.85)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${lp[0].toFixed(1)}" cy="${lp[1].toFixed(1)}" r="3.5" fill="#FF9F0A"/>`;
    }
}

// PR Card — best E1RM set (not just heaviest weight)
function renderPRCard(exName, relevant, prefs) {
    let bestE1RM=0,prW=0,prR=1,prRIR='—',prDate='';
    relevant.forEach(w => {
        if(!w.details||!w.details[exName]) return;
        parseSetsFromStrings(w.details[exName].sets).forEach(s => {
            const e1rm=calc1RM(s.w,s.r,prefs.formula);
            if(e1rm>bestE1RM){bestE1RM=e1rm;prW=s.w;prR=s.r;prRIR=s.rir;prDate=w.date||'';}
        });
    });
    const wEl=document.getElementById('pr-card-weight'),dEl=document.getElementById('pr-card-date'),gEl=document.getElementById('pr-stats-row'),nEl=document.getElementById('pr-context-note');
    if(wEl) wEl.textContent=prW?prW+' kg':'—';
    if(dEl) dEl.textContent=prDate;
    if(gEl) gEl.innerHTML=`<div><div class="pr-stat-val">${prR}</div><div class="pr-stat-lbl">חזרות</div></div><div><div class="pr-stat-val">RIR ${prRIR}</div><div class="pr-stat-lbl">RIR</div></div><div><div class="pr-stat-val">${prW?Math.round(bestE1RM):'—'}</div><div class="pr-stat-lbl">1RM משוער</div></div>`;
    if(nEl) nEl.textContent=prW?`שיא E1RM בתרגיל: ${exName}`:'';
}

function togglePRCard() {
    const body=document.getElementById('pr-expand-body'),arrow=document.getElementById('pr-expand-arrow');
    if(!body) return;
    const isOpen=body.classList.contains('open');
    body.classList.toggle('open',!isOpen);
    if(arrow) arrow.classList.toggle('open',!isOpen);
}

function switchAnalyticsTab(name, btn) {
    document.querySelectorAll('#analytics-seg .segment-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    document.getElementById('analytics-macro').style.display = name==='macro'?'block':'none';
    document.getElementById('analytics-micro').style.display = name==='micro'?'block':'none';
}

function _updateChipGroup(id, btn) { const c=document.getElementById(id); if(c) c.querySelectorAll('.range-chip').forEach(b=>b.classList.remove('active')); if(btn) btn.classList.add('active'); }

function setVolRange(n, btn) { _updateChipGroup('vol-chips',btn); const p=getAnalyticsPrefs();p.volumeRange=n;saveAnalyticsPrefs(p);renderVolumeBarChart(getArchiveClean(),n,p.volumeMuscle||'all'); }
function setVolMuscle(muscle, btn) { document.querySelectorAll('#vol-muscle-chips .range-chip').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');const p=getAnalyticsPrefs();p.volumeMuscle=muscle;saveAnalyticsPrefs(p);renderVolumeBarChart(getArchiveClean(),p.volumeRange,muscle); }
function setMuscleRange(r, btn) { _updateChipGroup('muscle-chips',btn); const p=getAnalyticsPrefs();p.muscleRange=r;saveAnalyticsPrefs(p);renderDonutChart(getArchiveClean(),r); }
function setConsRange(n, btn) { _updateChipGroup('cons-chips',btn); const p=getAnalyticsPrefs();p.consistencyRange=n;saveAnalyticsPrefs(p);renderConsistencyTrack(getArchiveClean(),n); }
function setMicroPoints(n, btn) { _updateChipGroup('micro-pts-chips',btn); const p=getAnalyticsPrefs();p.microPoints=n;saveAnalyticsPrefs(p);const s=document.getElementById('micro-ex-selector');if(s&&s.value)loadMicroData(s.value); }
function setMicroAxis(ax, btn) { const c=document.getElementById('micro-axis-chips');if(c)c.querySelectorAll('.range-chip').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');const p=getAnalyticsPrefs();p.microAxis=ax;saveAnalyticsPrefs(p);const s=document.getElementById('micro-ex-selector');if(s&&s.value)loadMicroData(s.value); }

function openAnalyticsSettings() {
    const p=getAnalyticsPrefs();
    document.getElementById('pref-name').value=p.name||'';
    document.getElementById('pref-units').value=p.units||'kg';
    document.getElementById('pref-formula').value=p.formula||'epley';
    document.getElementById('analytics-settings-overlay').style.display='block';
    document.getElementById('analytics-settings-sheet').classList.add('open');
    haptic('light');
}
function closeAnalyticsSettings() { document.getElementById('analytics-settings-overlay').style.display='none';document.getElementById('analytics-settings-sheet').classList.remove('open'); }
function saveAnalyticsSettingsPrefs() {
    const p=getAnalyticsPrefs();
    p.name=document.getElementById('pref-name').value.trim();
    p.units=document.getElementById('pref-units').value;
    p.formula=document.getElementById('pref-formula').value;
    saveAnalyticsPrefs(p);closeAnalyticsSettings();renderAnalyticsDashboard();renderHeroCard();haptic('success');
}

const HERO_METRIC_OPTIONS=[{key:'days',label:'ימים מאימון אחרון'},{key:'vol',label:'נפח אימון אחרון'},{key:'duration',label:'משך אימון אחרון'},{key:'avg_vol',label:'ממוצע נפח (4 אימונים)'},{key:'total',label:'סך אימונים כולל'}];

function openHeroSettings() {
    const p=getAnalyticsPrefs(),picker=document.getElementById('hero-metric-picker');if(!picker)return;
    picker.innerHTML=HERO_METRIC_OPTIONS.map(m=>`<div class="flex-between border-bottom pb-sm"><label class="input-label m-0">${m.label}</label><input type="checkbox" class="archive-checkbox" value="${m.key}" ${p.heroMetrics.includes(m.key)?'checked':''} onchange="onHeroMetricChange()"></div>`).join('');
    document.getElementById('hero-settings-overlay').style.display='block';
    document.getElementById('hero-settings-sheet').classList.add('open');
    haptic('light');
}
function onHeroMetricChange() { const c=[...document.querySelectorAll('#hero-metric-picker input:checked')];if(c.length>3)c[c.length-1].checked=false; }
function closeHeroSettings() { document.getElementById('hero-settings-overlay').style.display='none';document.getElementById('hero-settings-sheet').classList.remove('open'); }
function saveHeroSettings() {
    const checked=[...document.querySelectorAll('#hero-metric-picker input:checked')].map(i=>i.value);
    if(checked.length!==3){alert('יש לבחור בדיוק 3 מדדים');return;}
    const p=getAnalyticsPrefs();p.heroMetrics=checked;saveAnalyticsPrefs(p);closeHeroSettings();renderHeroCard();haptic('success');
}
