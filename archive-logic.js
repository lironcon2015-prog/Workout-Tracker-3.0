/**
 * GYMPRO ELITE - ARCHIVE & ANALYTICS LOGIC
 * Version: 14.12.0-72
 * שינויים: אנליטיקה - תצוגת Stitch Perfect (Bento, Bezier, Liquid Obsidian).
 */

// ─── ANALYTICS PREFS HELPERS ──────────────────────────────────────────────

function getAnalyticsPrefs() { return StorageManager.getAnalyticsPrefs(); }
function saveAnalyticsPrefs(prefs) { StorageManager.saveAnalyticsPrefs(prefs); }

// ─── ARCHIVE VIEW ─────────────────────────────────────────────────────────

const MONTH_NAMES_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const DEFAULT_MICRO_ORDER = ['Bench Press (Main)', 'Overhead Press (Main)', 'Leg Press'];

let selectedArchiveIds = new Set();

function openArchive() {
    selectedArchiveIds = new Set();
    updateCopySelectedBtn();
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
    const history = StorageManager.getArchive();
    const isInterruptionLog = (state.log || []).filter(l => l.isInterruption && l.exName === exName);

    for (const entry of history) {
        if (!entry.details || !entry.details[exName]) continue;
        if (!entry.details[exName].sets || entry.details[exName].sets.length === 0) continue;

        const sets = entry.details[exName].sets.filter(s => {
            if (!isInterruptionLog.length) return true;
            return true;
        });

        if (sets.length > 0) {
            return { sets, date: entry.date || '' };
        }
    }
    return null;
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
    card.className = "menu-card mb-sm";
    card.style.flexDirection = 'column';

    const meta = state.workoutMeta[item.type];
    const typeColor = (meta && meta.color) ? meta.color : 'var(--type-free)';

    const vol = getWorkoutVolume(item);
    const volStr = vol >= 1000 ? (vol / 1000).toFixed(1) + 't' : vol + 'kg';

    card.innerHTML = `
        <div class="archive-card-row">
            <input type="checkbox" class="archive-checkbox" onchange="toggleArchiveSelection(${item.timestamp})"
                ${selectedArchiveIds.has(item.timestamp) ? 'checked' : ''}>
            <div class="archive-info" onclick="openArchiveDetail(${StorageManager.getArchive().findIndex(a => a.timestamp === item.timestamp)})">
                <div class="flex-between">
                    <span class="font-semi" style="color:${typeColor}">${item.type}</span>
                    <span class="text-xs color-dim">${item.date || ''} ${item.time || ''}</span>
                </div>
                <div class="text-sm color-dim">${item.duration || 0} דק' • ${volStr}</div>
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
            ? 'archive-month-header collapsible open'
            : 'archive-month-header collapsible';
        header.innerHTML = `
            <div class="archive-month-header-inner">
                <span class="archive-month-title">${group.label}</span>
                <span class="archive-month-meta">${group.items.length} אימונים • ${volStr}</span>
            </div>
            <div class="archive-month-arrow">›</div>`;

        const itemsContainer = document.createElement('div');
        itemsContainer.className = group.isCurrentMonth
            ? 'archive-month-items'
            : 'archive-month-items collapsed';
        group.items.forEach(item => itemsContainer.appendChild(createArchiveCard(item)));

        header.addEventListener('click', () => {
            const isOpen = !itemsContainer.classList.contains('collapsed');
            itemsContainer.classList.toggle('collapsed', isOpen);
            header.classList.toggle('open', !isOpen);
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
        btn.classList.remove('opacity-50', 'color-dim', 'border-dim');
        btn.classList.add('color-accent', 'border-accent');
    } else {
        btn.disabled = true;
        btn.classList.remove('color-accent', 'border-accent');
        btn.classList.add('opacity-50', 'color-dim', 'border-dim');
    }
}

function copyBulkLog(mode) {
    const history = StorageManager.getArchive();
    const itemsToCopy = mode === 'all' ? history : history.filter(item => selectedArchiveIds.has(item.timestamp));
    if (itemsToCopy.length === 0) { showAlert("לא נבחרו אימונים להעתקה"); return; }
    const bulkText = itemsToCopy.map(item => item.summary).join("\n\n========================================\n\n");
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
                        <div class="summary-set-details">${entry.w}kg x ${entry.r} (RIR ${rir}${noteStr})</div>
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
                                ${entry.w}kg x ${entry.r} (RIR ${rir}${noteStr})
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

    const contentEl = document.getElementById('archive-detail-content');
    contentEl.className = '';
    contentEl.innerHTML = buildArchiveDetailHTML(item);

    const copyBtn = document.getElementById('btn-archive-copy');
    const deleteBtn = document.getElementById('btn-archive-delete');

    copyBtn.onclick = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(item.summary || '').then(() => {
                haptic('success');
                showAlert("הסיכום הועתק!");
            });
        } else {
            const el = document.createElement("textarea");
            el.value = item.summary || '';
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

    navigate('ui-archive-detail');
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────

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
    const monthWorkouts = history.filter(item => {
        const d = new Date(item.timestamp);
        return d.getMonth() === month && d.getFullYear() === year;
    });
    for (let i = 0; i < firstDayIndex; i++) {
        const cell = document.createElement('div'); cell.className = "calendar-cell empty"; grid.appendChild(cell);
    }
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
                const woMeta = state.workoutMeta[wo.type];
                const dotColor = (woMeta && woMeta.color) ? woMeta.color : 'var(--type-free)';
                dot.className = 'dot';
                dot.style.backgroundColor = dotColor; dotsContainer.appendChild(dot);
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
    if (name === 'workout') navigate('ui-week', true);
    else if (name === 'analytics') { navigate('ui-analytics', true); renderAnalyticsDashboard(); }
    else if (name === 'archive') { navigate('ui-archive', true); openArchive(); }
    haptic('light');
}

// ─── ANALYTICS DASHBOARD (STITCH PERFECT) ─────────────────────────────

function renderAnalyticsDashboard() {
    const prefs = getAnalyticsPrefs(), archive = getArchiveClean();
    renderHeroMetricsGrid(archive);
    renderVolumeBarChart(archive, prefs.volumeRange, prefs.volumeMuscle || 'all');
    renderWorkoutTypeChart(archive);
    renderDonutChart(archive, prefs.muscleRange);
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
    
    const el = document.getElementById('hero-metrics-grid'); if (!el) return;
    
    el.innerHTML = `
        <div class="bento-card glass-card m-0" style="margin:0;">
            <span class="material-symbols-outlined bento-icon-bg">fitness_center</span>
            <div class="bento-lbl">נפח כולל</div>
            <div class="bento-val font-headline italic-black">${(totalVol / 1000).toFixed(1)}<span class="inline-unit">t</span></div>
        </div>
        <div class="bento-card glass-card m-0" style="margin:0;">
            <span class="material-symbols-outlined bento-icon-bg">schedule</span>
            <div class="bento-lbl">זמן כולל</div>
            <div class="bento-val font-headline italic-black" style="color:var(--text);">${Math.round(totalDurMins / 60)}<span class="inline-unit">h</span></div>
        </div>
        <div class="bento-card glass-card m-0" style="margin:0;">
            <span class="material-symbols-outlined bento-icon-bg">calendar_today</span>
            <div class="bento-lbl">אימונים</div>
            <div class="bento-val font-headline italic-black" style="color:var(--text);">${total}</div>
        </div>
        <div class="bento-card glass-card m-0" style="margin:0;">
            <span class="material-symbols-outlined bento-icon-bg" style="color:var(--warning);">emoji_events</span>
            <div class="bento-lbl" style="color:var(--warning);">שיא נפח</div>
            <div class="bento-val font-headline italic-black" style="color:var(--warning);">${(bestVol / 1000).toFixed(1)}<span class="inline-unit">t</span></div>
        </div>`;
}

// ─── VOLUME BAR CHART ─────────────────────────────────────────────────────

function renderVolumeBarChart(archive, n, muscleFilter) {
    const el = document.getElementById('vol-bar-chart'); if (!el) return;
    const data = archive.slice(0, n).reverse();

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
            const unit = vols[i] >= 1000 ? 't' : 'kg';
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
        const tooltipData = e.aliased ? `data-members="${e.rawNames.join('|')}"` : '';
        return `<div class="hbar-row" ${tooltipData} onclick="showWTToast('${e.display.replace(/'/g, "\\'")}','${e.rawNames.join(", ").replace(/'/g, "\\'")}',${e.count})">
            <div class="hbar-top">
                <span class="hbar-label">${e.display}</span>
                <span class="hbar-val-text" style="color:${color}">${val}<span class="inline-unit" style="margin:0;opacity:0.7;">${unit}</span></span>
            </div>
            <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;background:${color};box-shadow:0 0 10px ${color}80;"></div></div>
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
            html += `<div class="alias-existing-row" onclick="_editAliasGroup('${g.replace(/'/g, "\\'")}')">
                <div class="alias-eg-dot"></div>
                <div style="flex:1;">
                    <div class="alias-eg-name">${g}</div>
                    <div class="alias-eg-members">${ms.join(' · ')}</div>
                </div>
                <button class="alias-del-btn" onclick="event.stopPropagation();_deleteAliasGroup('${g.replace(/'/g, "\\'")}')">מחק</button>
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
        html += `<div class="alias-raw-row" onclick="_toggleAliasSelect('${t.replace(/'/g, "\\'")}')">
            <div class="alias-check${isSel ? ' on' : ''}"></div>
            <div style="flex:1;">
                <div class="alias-type-name">${t}</div>
                <div class="alias-meta">${d.count} אימונים · ממוצע ${avgStr}</div>
            </div>
            ${inGroup ? `<span class="alias-group-badge">${inGroup}</span>` : ''}
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

function loadMicroData(exName) {
    if (!exName) return;
    const display = document.getElementById('micro-ex-display');
    if (display) display.textContent = exName;
    
    const prefs = getAnalyticsPrefs(), archive = getArchiveClean();
    const relevant = archive
        .filter(w => w.details && w.details[exName] && w.details[exName].sets && w.details[exName].sets.length)
        .slice(0, prefs.microPoints)
        .reverse(); // לגרף צריכים משמאל לימין (מהישן לחדש)
        
    const heroEl = document.getElementById('micro-hero-e1rm');
    const lineSvg = document.getElementById('micro-line-svg');
    const datesEl = document.getElementById('micro-line-dates');

    if (!relevant.length) {
        if (lineSvg) lineSvg.innerHTML = '<text x="200" y="80" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="14" font-family="Inter">אין מספיק נתונים</text>';
        if (datesEl) datesEl.innerHTML = '';
        if (heroEl) heroEl.innerHTML = `—`;
        renderPRCard(exName,[], prefs);
        return;
    }
    
    const vals = relevant.map(w => {
        const parsed = parseSetsFromStrings(w.details[exName].sets); 
        if (!parsed.length) return 0;
        if (prefs.microAxis === 'vol') return w.details[exName].vol || 0;
        if (prefs.microAxis === 'maxw') return Math.max(...parsed.map(s => s.w));
        return Math.max(...parsed.map(s => calc1RM(s.w, s.r, prefs.formula)));
    });
    
    if (heroEl) {
        const val = Math.round(vals[vals.length - 1]);
        const unit = prefs.microAxis === 'vol' && val >= 1000 ? 't' : 'kg';
        const displayVal = prefs.microAxis === 'vol' && val >= 1000 ? (val / 1000).toFixed(1) : val;
        heroEl.innerHTML = `${displayVal}<span class="inline-unit">${unit}</span>`;
    }
    
    drawMicroLineChart(vals, relevant.map(w => {
        const d = new Date(w.timestamp);
        return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}`;
    }));
    renderPRCard(exName, relevant, prefs);
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
            const wMatch = s.match(/([\d\.]+)\s*kg/);
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

function drawMicroLineChart(vals, dates) {
    const svg = document.getElementById('micro-line-svg'); 
    const datesEl = document.getElementById('micro-line-dates');
    if (!svg || !datesEl) return;
    
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
    const pts = vals.map((v, i) =>[px(i), py(v)]);
    
    const linePath = getSmoothPath(pts);
    const areaPath = linePath + ` L${pts[n - 1][0]},${H} L${pts[0][0]},${H} Z`;
    
    const lastPt = pts[n - 1];
    
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
    `;
    
    datesEl.innerHTML = dates.map(d => `<span>${d}</span>`).join('');
}

function renderPRCard(exName, relevant, prefs) {
    let bestE1RM = 0, prW = 0, prR = 1, prRIR = '—', prDate = '';
    relevant.forEach(w => {
        if (!w.details || !w.details[exName]) return;
        parseSetsFromStrings(w.details[exName].sets).forEach(s => {
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
function setMicroAxis(ax, btn) { _updateChipGroup('micro-axis-chips', btn); const p = getAnalyticsPrefs(); p.microAxis = ax; saveAnalyticsPrefs(p); const s = document.getElementById('micro-ex-selector'); if (s && s.value) loadMicroData(s.value); }

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
            if (!w.details || !w.details[exName]) return;
            const sets = parseSetsFromStrings(w.details[exName].sets || []);
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
            btn.className = 'range-chip';
            btn.textContent = MONTH_NAMES_HE[d.getMonth()] + ' ' + d.getFullYear();
            const yr = d.getFullYear(), mo = d.getMonth();
            btn.onclick = function() { _selectRangeMonth(yr, mo, btn); };
            container.appendChild(btn);
        }
    });
    if (!seen.size) container.innerHTML = '<p class="color-dim text-sm">אין אימונים בארכיון</p>';
}

function _selectRangeMonth(year, month, btn) {
    _rangeSelectedMonth = { year: year, month: month };
    document.querySelectorAll('#range-month-chips .range-chip').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    _updateRangeCopyBtn();
}

function selectRangeWeeks(n, btn) {
    _rangeSelectedWeeks = n;
    document.querySelectorAll('#range-panel-weeks .range-chip').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
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
    if (!btn) return;
    var hasSelection = (_rangeTab === 'month' && _rangeSelectedMonth !== null) ||
                       (_rangeTab === 'weeks' && _rangeSelectedWeeks !== null);
    if (!hasSelection) {
        btn.disabled = true; btn.style.opacity = '0.5'; btn.textContent = 'בחר טווח'; return;
    }
    var count = _getRangeItems().length;
    btn.disabled = count === 0;
    btn.style.opacity = count > 0 ? '1' : '0.5';
    btn.textContent = count > 0 ? 'העתק ' + count + ' אימונים' : 'אין אימונים בטווח זה';
}

function executeCopyByRange() {
    var items = _getRangeItems();
    if (!items.length) { showAlert("אין אימונים בטווח שנבחר"); return; }
    var text = items.map(function(item) { return item.summary; }).join("\n\n========================================\n\n");
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
