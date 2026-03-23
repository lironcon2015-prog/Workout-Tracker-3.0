/**
 * GYMPRO ELITE - ARCHIVE & ANALYTICS LOGIC
 * Version: 14.12.0
 * שינויים: תצוגת פרטי אימון עשירה (כמו סיכום), חודש שוטף collapsible, סדר ברירת מחדל יציב בהתקדמות תרגיל
 */

// ─── ANALYTICS PREFS HELPERS ──────────────────────────────────────────────

function getAnalyticsPrefs() { return StorageManager.getAnalyticsPrefs(); }
function saveAnalyticsPrefs(prefs) { StorageManager.saveAnalyticsPrefs(prefs); }

// ─── ARCHIVE VIEW ─────────────────────────────────────────────────────────

const MONTH_NAMES_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

// סדר ברירת מחדל לכרטיסיית התקדמות תרגיל
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
                if (!['biceps','triceps'].includes(m)) {
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

        // חודש שוטף וחודשים עבר — אותו תבנית collapsible.
        // חודש שוטף: פתוח כברירת מחדל (open class, ללא collapsed על items).
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
        // חודש שוטף — מתחיל פתוח; חודשים עבר — מתחיל סגור
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

/**
 * מחלץ את סדר התרגילים הנכון מתוך מחרוזת ה-summary השמורה.
 * מחפש שורות בפורמט: "ExName (Vol: Xkg):" או "ExName (Main) (Vol: Xkg):"
 * שומר את (Main) כחלק מהשם כדי להתאים למפתחות ב-details.
 * מחזיר מערך שמות מסודר, או מערך ריק אם הפרסור נכשל.
 */
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

/**
 * בונה HTML עשיר לפרטי אימון מהארכיון — בסגנון מסך סיכום האימון.
 */
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

    if (item.details) {
        // סדר תרגילים — עדיפויות:
        // 1. item.exOrder — נשמר ישירות מהאימון (רשומות חדשות, מהימן 100%)
        // 2. _parseExOrderFromSummary — fallback לרשומות ישנות
        //    תרגילים שלא הופיעו בפורמט (Vol:...) בsummary (למשל: תרגילי Cluster)
        //    מוכנסים לפי סדרם ב-detailKeys, לפני/אחרי לפי מיקומם ב-details.
        // 3. Object.keys(details) — last resort
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
                // תרגילים שנמצאו ב-summary — לפי סדר summary
                // תרגילים שלא נמצאו (קלאסטר וכו') — לפי סדר detailKeys, שמור על מיקומם היחסי
                const parsedSet = new Set(parsedOrder);
                const missing = detailKeys.filter(n => !parsedSet.has(n));
                // מיזוג: missing לפני parsed אם הם מופיעים ראשונים ב-detailKeys
                const firstParsedIdx = detailKeys.findIndex(n => parsedSet.has(n));
                const missingBefore = missing.filter(n => detailKeys.indexOf(n) < firstParsedIdx);
                const missingAfter  = missing.filter(n => detailKeys.indexOf(n) >= firstParsedIdx);
                exOrder = [
                    ...missingBefore,
                    ...parsedOrder.filter(n => item.details[n]),
                    ...missingAfter
                ];
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
    // הסרת class summary-card (monospace/pre-wrap) והצגת HTML עשיר
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
                FirebaseManager.saveArchiveToCloud().then(() => window.location.reload());
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

// ─── HERO CARD ────────────────────────────────────────────────────────────

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

// ─── ANALYTICS DASHBOARD ─────────────────────────────────────────────────

function renderAnalyticsDashboard() {
    const prefs = getAnalyticsPrefs(), archive = getArchiveClean();
    renderHeroMetricsGrid(archive);
    renderVolumeBarChart(archive, prefs.volumeRange, prefs.volumeMuscle || 'all');
    renderWorkoutTypeChart(archive);
    renderDonutChart(archive, prefs.muscleRange);
    renderConsistencyTrack(archive, prefs.consistencyRange);
    populateMicroSelector(archive);
    syncVolMuscleChips(prefs.volumeMuscle || 'all');
    // סנכרון muscle-chips עם הפרפס השמור (כולל '1w')
    const mr = prefs.muscleRange || '1m';
    document.querySelectorAll('#muscle-chips .range-chip').forEach(b => {
        const onclick = b.getAttribute('onclick') || '';
        const match = onclick.match(/setMuscleRange\('([^']+)'/);
        b.classList.toggle('active', match ? match[1] === mr : false);
    });
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
        <div class="metric-tile"><div class="metric-tile-lbl">נפח כולל</div><div class="metric-tile-val" style="color:var(--accent)">${(totalVol / 1000).toFixed(1)}t</div><div class="metric-tile-sub">${total} אימונים</div></div>
        <div class="metric-tile"><div class="metric-tile-lbl">זמן כולל</div><div class="metric-tile-val">${Math.round(totalDurMins / 60)}h</div><div class="metric-tile-sub">ממוצע ${avgDur}m</div></div>
        <div class="metric-tile"><div class="metric-tile-lbl">אימונים</div><div class="metric-tile-val">${total}</div><div class="metric-tile-sub">&nbsp;</div></div>
        <div class="metric-tile highlight"><div class="metric-tile-lbl" style="color:var(--type-b)">שיא נפח</div><div class="metric-tile-val" style="color:var(--type-b)">${(bestVol / 1000).toFixed(1)}t</div><div class="metric-tile-sub">&nbsp;</div></div>`;
}

// ─── VOLUME BAR CHART ─────────────────────────────────────────────────────

function renderVolumeBarChart(archive, n, muscleFilter) {
    const el = document.getElementById('vol-bar-chart'); if (!el) return;
    const data = archive.slice(0, n);

    const trendEl = document.getElementById('vol-trend-badge');
    if (trendEl) {
        if (data.length >= 4) {
            const half = Math.floor(data.length / 2);
            const recentAvg = data.slice(0, half).reduce((s, a) => s + getWorkoutVolumeFiltered(a, muscleFilter), 0) / half;
            const olderAvg = data.slice(half).reduce((s, a) => s + getWorkoutVolumeFiltered(a, muscleFilter), 0) / (data.length - half);
            if (olderAvg > 0) {
                const pct = Math.round((recentAvg - olderAvg) / olderAvg * 100);
                trendEl.innerHTML = `<span style="color:${pct >= 0 ? 'var(--type-b)' : 'var(--danger)'};font-size:0.85em;font-weight:700;">${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}%</span>`;
            } else trendEl.innerHTML = '';
        } else trendEl.innerHTML = '';
    }

    if (!data.length) { el.innerHTML = '<p class="color-dim text-sm text-center mt-md">אין נתונים</p>'; return; }

    const vols = data.map(a => getWorkoutVolumeFiltered(a, muscleFilter));
    const maxV = Math.max(...vols) || 1;

    el.innerHTML = data.map((a, i) => {
        const pct = (vols[i] / maxV * 88).toFixed(1);
        const isPeak = vols[i] === maxV;
        const dt = (a.date || '').slice(0, 5);
        const label = vols[i] >= 1000 ? (vols[i] / 1000).toFixed(1) + 't' : vols[i] + 'kg';
        return `<div class="bar-col-wrap"><div class="bar-col-track"><div class="bar-col-val">${label}</div><div class="bar-col-fill${isPeak ? ' peak' : ''}" style="height:${pct}%"></div></div><div class="bar-col-date">${dt}</div></div>`;
    }).join('');
}

// ─── WORKOUT TYPE CHART ───────────────────────────────────────────────────

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
    const COLORS = ['var(--type-a)', 'var(--type-b)', 'var(--type-c)', 'var(--type-free)', 'var(--accent)'];

    el.innerHTML = entries.map((e, i) => {
        const pct = (e.avg / maxAvg * 100).toFixed(1);
        // אימונים מקובצים — צבע מוגדר; אחרים — COLORS רציקלי
        const color = (e.aliased && aliasColors[e.display]) ? aliasColors[e.display] : COLORS[i % COLORS.length];
        const label = e.avg >= 1000 ? (e.avg / 1000).toFixed(1) + 't' : e.avg + 'kg';
        const groupedCls = e.aliased ? ' grouped' : '';
        const gdot = e.aliased ? '<span class="hbar-gdot"></span>' : '';
        const tooltipData = e.aliased ? `data-members="${e.rawNames.join('|')}"` : '';
        return `<div class="hbar-row">
            <div class="hbar-label${groupedCls}" ${tooltipData} onclick="showWTToast('${e.display.replace(/'/g, "\\'")}','${e.rawNames.join(", ").replace(/'/g, "\\'")}',${e.count})">${gdot}${e.display}</div>
            <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;background:${color};"></div><span class="hbar-val">${label}</span></div>
            <div class="hbar-count">${e.count}×</div>
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

    let html = `<div class="sh-title">קיבוץ סוגי אימונים</div>
        <div class="sheet-content" style="font-size:0.78em;color:var(--text-dim);margin-bottom:18px;line-height:1.5;">
            סמן אימונים שהם למעשה אותו אימון — שמות שהשתנו על פני זמן
        </div>`;

    if (Object.keys(aliases).length > 0) {
        html += `<div style="font-size:0.62em;color:var(--text-dim);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">קבוצות קיימות</div>`;
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

    html += `<div style="font-size:0.62em;color:var(--text-dim);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">קבוצה חדשה — בחר אימונים</div>`;

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

    // צבע נוכחי לקבוצה (אם קיים מעריכה)
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

    const html = `<div class="sh-title">שם וצבע לקבוצה</div>
        <div class="sheet-content" style="font-size:0.78em;color:var(--text-dim);margin-bottom:18px;line-height:1.5;">
            בחר שם קצר וצבע שיופיעו בגרף
        </div>
        <div class="alias-name-field">
            <div class="alias-name-lbl">שם תצוגה בגרף</div>
            <input class="alias-name-input" id="alias-name-inp" type="text"
                value="${suggested}"
                placeholder="לדוגמה: חזה"
                oninput="_onAliasNameInput(this.value)"
                onkeydown="if(event.key==='Enter')_renderAliasStep3()">
        </div>
        <div class="alias-name-field" style="margin-top:14px;">
            <div class="alias-name-lbl">צבע בגרף (אופציונלי)</div>
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
    // toggle — לחיצה שנייה על אותו צבע מבטלת בחירה
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

    const html = `<div class="sh-title">אישור קיבוץ</div>
        <div class="sheet-content" style="font-size:0.78em;color:var(--text-dim);margin-bottom:18px;">כך ייראה הגרף לאחר האיחוד</div>
        <div class="alias-confirm-box">
            <div class="alias-confirm-name">${_aliasGroupName}</div>
            <div style="font-size:0.72em;color:var(--text-dim);margin-bottom:6px;">${totalCount} אימונים · ממוצע ${avgStr}</div>
            <div class="alias-confirm-arrow">יאחד את ↓</div>
            <div class="alias-confirm-tags">
                ${selArr.map(n => `<span class="alias-confirm-tag">${n}</span>`).join('')}
            </div>
        </div>
        <button class="btn-main success-gradient" onclick="_saveAliasGroup()">✓ שמור קיבוץ</button>
        <button class="btn-text" onclick="_renderAliasStep2()">⟵ ערוך שם</button>`;

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

const DONUT_COLORS = ['#0A84FF', '#32D74B', '#FF9F0A', '#BF5AF2', '#ff453a', '#AEAEB2'];

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
        const da = (sets / total * ci).toFixed(2), gap = (ci - parseFloat(da)).toFixed(2);
        circles += `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${DONUT_COLORS[i]}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${da} ${gap}" stroke-dashoffset="${(-offset).toFixed(2)}"/>`;
        legendHtml += `<div class="donut-legend-row"><div class="donut-legend-dot" style="background:${DONUT_COLORS[i]}"></div><div class="donut-legend-name">${name}</div><div class="donut-legend-pct">${sets} סטים</div></div>`;
        offset += parseFloat(da);
    });
    svgEl.innerHTML = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="14"/>${circles}`;
    centerEl.innerHTML = `<div class="donut-center-val">${total}</div><div class="donut-center-sub">סטים</div>`;
    legendEl.innerHTML = legendHtml;
}

// ─── CONSISTENCY TRACK ────────────────────────────────────────────────────

function renderConsistencyTrack(archive, n) {
    const el = document.getElementById('cons-track'); if (!el) return;
    const data = archive.slice(0, n);
    if (data.length < 2) { el.innerHTML = '<p class="color-dim text-sm">נדרשים לפחות 2 אימונים</p>'; return; }

    const prefs = getAnalyticsPrefs();

    // סף ימים — מותאם אישית אם קיים, אחרת חישוב אוטומטי מ-median
    let greenT, orangeT;
    if (prefs.consistencyGreen && prefs.consistencyOrange) {
        greenT = prefs.consistencyGreen;
        orangeT = prefs.consistencyOrange;
    } else {
        let medianGap = 7;
        if (archive.length >= 3) {
            const gaps = [];
            for (let i = 1; i < archive.length; i++) gaps.push((archive[i - 1].timestamp - archive[i].timestamp) / 86400000);
            gaps.sort((a, b) => a - b);
            medianGap = gaps[Math.floor(gaps.length / 2)];
        }
        greenT = Math.max(2, Math.round(medianGap * 1.25));
        orangeT = Math.max(greenT + 1, Math.round(medianGap * 1.75));
    }

    const legendEl = document.getElementById('cons-legend');
    if (legendEl) legendEl.innerHTML = `
        <span style="color:var(--type-b)">● ≤${greenT} ימים</span>
        <span style="color:var(--type-c)">● ${greenT + 1}–${orangeT} ימים</span>
        <span style="color:var(--danger)">● ${orangeT + 1}+ ימים</span>`;

    let html = '';
    data.forEach((w, i) => {
        let cls = 'today', label = '●';
        if (i < data.length - 1) {
            const days = Math.round((data[i].timestamp - data[i + 1].timestamp) / 86400000);
            cls = days <= greenT ? 'green' : days <= orangeT ? 'orange' : 'red';
            label = days + 'd';
        }
        html += `<div class="cons-node-wrap"><div class="cons-node ${cls}">${label}</div><div class="cons-node-date">${(w.date || '').slice(0, 5)}</div></div>`;
        if (i < data.length - 1) html += `<div class="cons-connector"></div>`;
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
        // סדר מותאם אישית — מכבד בחירת המשתמש
        sorted = prefs.microOrder.filter(e => exMap[e]);
        Object.keys(exMap).forEach(e => { if (!sorted.includes(e)) sorted.push(e); });
    } else {
        // ברירת מחדל: 3 תרגילים מנוסים ראשונים, אחר כך isCalc, אחר כך אלפבית (סדר יציב)
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
    if (sel.value) loadMicroData(sel.value);
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

function calc1RM(w, r, formula) {
    if (!formula || formula === 'epley') return w * (1 + r / 30);
    if (formula === 'brzycki') return r < 37 ? w / (1.0278 - 0.0278 * r) : w;
    if (formula === 'lombardi') return w * Math.pow(r, 0.10);
    return w * (1 + r / 30);
}

function parseSetsFromStrings(sets) {
    return sets.map(s => {
        try {
            const core = s.includes('| Note:') ? s.split('| Note:')[0].trim() : s;
            const parts = core.split('x'); if (parts.length < 2) return null;
            const w = parseFloat(parts[0].replace('kg', '').replace('(יד אחת)', '').trim());
            const repsMatch = parts[1].match(/\d+/); const r = repsMatch ? parseInt(repsMatch[0]) : 1;
            const rirMatch = core.match(/RIR\s*(\S+)/); const rir = rirMatch ? rirMatch[1] : '—';
            if (isNaN(w)) return null; return { w, r, rir };
        } catch (e) { return null; }
    }).filter(Boolean);
}

function drawMicroLineChart(vals, dates) {
    const svg = document.getElementById('micro-line-svg'); if (!svg) return;
    const n = vals.length;
    if (n < 2) { svg.innerHTML = '<text x="160" y="82" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="-apple-system,sans-serif" font-size="12">אין מספיק נתונים</text>'; return; }
    const W = 320, H = 165, pad = { t: 22, r: 20, b: 28, l: 40 };
    const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
    const mn = Math.min(...vals) * 0.965, mx = Math.max(...vals) * 1.035;
    const px = i => pad.l + (i / (n - 1)) * cW, py = v => pad.t + cH - ((v - mn) / ((mx - mn) || 1)) * cH;
    const pts = vals.map((v, i) => [px(i), py(v)]);
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const areaPath = linePath + ` L${pts[n - 1][0].toFixed(1)},${(pad.t + cH).toFixed(1)} L${pts[0][0].toFixed(1)},${(pad.t + cH).toFixed(1)} Z`;
    const yL = [mn, (mn + mx) / 2, mx].map(v => `<text x="${pad.l - 5}" y="${py(v) + 4}" fill="rgba(255,255,255,0.28)" font-size="8.5" text-anchor="end" font-family="-apple-system,sans-serif">${Math.round(v)}</text>`).join('');
    const xL = dates.map((d, i) => i % 2 === 0 ? `<text x="${px(i).toFixed(1)}" y="${H - 5}" fill="rgba(255,255,255,0.28)" font-size="8" text-anchor="middle" font-family="-apple-system,sans-serif">${d.slice(0, 5)}</text>` : '').join('');
    const dots = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5" fill="#000" stroke="#32D74B" stroke-width="2.5"/>`).join('');
    const lp = pts[n - 1], tx = lp[0] > W - 72 ? lp[0] - 52 : lp[0] + 6;
    const tip = `<rect x="${tx}" y="${lp[1] - 22}" width="50" height="18" rx="5" fill="rgba(50,215,75,0.18)" stroke="rgba(50,215,75,0.45)" stroke-width="0.5"/><text x="${(tx + 25).toFixed(1)}" y="${lp[1] - 9}" fill="#32D74B" font-size="9.5" text-anchor="middle" font-weight="700" font-family="-apple-system,sans-serif">${Math.round(vals[n - 1])}</text>`;
    svg.innerHTML = `<defs><linearGradient id="lcGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#32D74B" stop-opacity="0.3"/><stop offset="100%" stop-color="#32D74B" stop-opacity="0"/></linearGradient></defs>
        <path d="${areaPath}" fill="url(#lcGrad)"/>
        <path d="${linePath}" fill="none" stroke="#32D74B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px rgba(50,215,75,0.5))"/>
        ${yL}${xL}${dots}${tip}`;
}

function renderIntensityScore(vals) {
    const valEl = document.getElementById('intensity-score-val'), deltaEl = document.getElementById('intensity-score-delta'), sparkEl = document.getElementById('micro-sparkline');
    if (!valEl || !vals.length) return;
    const last = vals[vals.length - 1], prev = vals.length > 1 ? vals[vals.length - 2] : last, delta = (last - prev).toFixed(1);
    valEl.textContent = (last * 0.85).toFixed(1);
    if (deltaEl) { deltaEl.textContent = (parseFloat(delta) >= 0 ? '↑ ' : '↓ ') + Math.abs(delta) + ' מהפעם הקודמת'; deltaEl.style.color = parseFloat(delta) >= 0 ? '#32D74B' : '#ff453a'; }
    if (sparkEl && vals.length >= 2) {
        const n = vals.length, W = 140, H = 52, mn = Math.min(...vals), mx = Math.max(...vals);
        const spx = i => (i / (n - 1)) * W, spy = v => H - 4 - ((v - mn) / ((mx - mn) || 1)) * (H - 8);
        const spts = vals.map((v, i) => [spx(i), spy(v)]);
        const path = spts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        const lp = spts[n - 1];
        sparkEl.innerHTML = `<path d="${path}" fill="none" stroke="rgba(255,159,10,0.85)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${lp[0].toFixed(1)}" cy="${lp[1].toFixed(1)}" r="3.5" fill="#FF9F0A"/>`;
    }
}

function renderPRCard(exName, relevant, prefs) {
    let bestE1RM = 0, prW = 0, prR = 1, prRIR = '—', prDate = '';
    relevant.forEach(w => {
        if (!w.details || !w.details[exName]) return;
        parseSetsFromStrings(w.details[exName].sets).forEach(s => {
            const e1rm = calc1RM(s.w, s.r, prefs.formula);
            if (e1rm > bestE1RM) { bestE1RM = e1rm; prW = s.w; prR = s.r; prRIR = s.rir; prDate = w.date || ''; }
        });
    });
    const wEl = document.getElementById('pr-card-weight'), dEl = document.getElementById('pr-card-date'), gEl = document.getElementById('pr-stats-row'), nEl = document.getElementById('pr-context-note');
    if (wEl) wEl.textContent = prW ? prW + ' kg' : '—';
    if (dEl) dEl.textContent = prDate;
    if (gEl) gEl.innerHTML = `<div><div class="pr-stat-val">${prR}</div><div class="pr-stat-lbl">חזרות</div></div><div><div class="pr-stat-val">RIR ${prRIR}</div><div class="pr-stat-lbl">RIR</div></div><div><div class="pr-stat-val">${prW ? Math.round(bestE1RM) : '—'}</div><div class="pr-stat-lbl">1RM משוער</div></div>`;
    if (nEl) nEl.textContent = prW ? `שיא E1RM בתרגיל: ${exName}` : '';
}

function togglePRCard() {
    const body = document.getElementById('pr-expand-body'), arrow = document.getElementById('pr-expand-arrow');
    if (!body) return;
    const isOpen = body.classList.contains('open');
    body.classList.toggle('open', !isOpen);
    if (arrow) arrow.classList.toggle('open', !isOpen);
}

function switchAnalyticsTab(name, btn) {
    document.querySelectorAll('#analytics-seg .segment-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('analytics-macro').style.display = name === 'macro' ? 'block' : 'none';
    document.getElementById('analytics-micro').style.display = name === 'micro' ? 'block' : 'none';
}

function _updateChipGroup(id, btn) { const c = document.getElementById(id); if (c) c.querySelectorAll('.range-chip').forEach(b => b.classList.remove('active')); if (btn) btn.classList.add('active'); }

function setVolRange(n, btn) { _updateChipGroup('vol-chips', btn); const p = getAnalyticsPrefs(); p.volumeRange = n; saveAnalyticsPrefs(p); renderVolumeBarChart(getArchiveClean(), n, p.volumeMuscle || 'all'); }
function setVolMuscle(muscle, btn) { document.querySelectorAll('#vol-muscle-chips .range-chip').forEach(b => b.classList.remove('active')); if (btn) btn.classList.add('active'); const p = getAnalyticsPrefs(); p.volumeMuscle = muscle; saveAnalyticsPrefs(p); renderVolumeBarChart(getArchiveClean(), p.volumeRange, muscle); }
function setMuscleRange(r, btn) { _updateChipGroup('muscle-chips', btn); const p = getAnalyticsPrefs(); p.muscleRange = r; saveAnalyticsPrefs(p); renderDonutChart(getArchiveClean(), r); }
function setConsRange(n, btn) { _updateChipGroup('cons-chips', btn); const p = getAnalyticsPrefs(); p.consistencyRange = n; saveAnalyticsPrefs(p); renderConsistencyTrack(getArchiveClean(), n); }
function setMicroPoints(n, btn) { _updateChipGroup('micro-pts-chips', btn); const p = getAnalyticsPrefs(); p.microPoints = n; saveAnalyticsPrefs(p); const s = document.getElementById('micro-ex-selector'); if (s && s.value) loadMicroData(s.value); }
function setMicroAxis(ax, btn) { const c = document.getElementById('micro-axis-chips'); if (c) c.querySelectorAll('.range-chip').forEach(b => b.classList.remove('active')); if (btn) btn.classList.add('active'); const p = getAnalyticsPrefs(); p.microAxis = ax; saveAnalyticsPrefs(p); const s = document.getElementById('micro-ex-selector'); if (s && s.value) loadMicroData(s.value); }

function openAnalyticsSettings() {
    const p = getAnalyticsPrefs();
    document.getElementById('pref-name').value = p.name || '';
    document.getElementById('pref-units').value = p.units || 'kg';
    document.getElementById('pref-formula').value = p.formula || 'epley';
    // שדות עקביות — ריק = אוטומטי
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
    // סף ימים עקביות — ריק = אוטומטי (delete מהפרפס)
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
const HOME_PR_COLORS = { bench: '#0A84FF', ohp: '#FF9F0A' };

let _homePRCurrent = 'bench';
let _homePRSelectedIdx = null;
let _homePRSessions = { bench: [], ohp: [] };

function renderHomePRCard() {
    const card = document.getElementById('home-pr-card');
    if (!card) return;

    const prefs = getAnalyticsPrefs();
    const archive = getArchiveClean();

    // Build sessions for both exercises (full data — never sliced here)
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

    // Render range chips (once, if not already present)
    _homePRRenderRangeChips();

    // Default: select PR point (highest e1rm) in current window
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
    // clamp selected index to windowed length
    if (_homePRSelectedIdx >= windowed.length) _homePRSelectedIdx = _homePRBestIdxFromArr(windowed);
    _homePRRenderInfo(windowed, all);
    _homePRDrawChart(windowed, all);
    _homePRRenderAllTime(all);
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

    // PR index (highest value)
    const prIdx = vals.indexOf(Math.max(...vals));
    const prPt  = pts[prIdx];
    // label positioned ABOVE dot with enough clearance
    const labelY  = Math.max(prPt[1] - 14, pT - 2);
    const labelX  = Math.min(Math.max(prPt[0], 18), W - 18);
    const colAlpha = col === '#0A84FF' ? 'rgba(10,132,255,0.22)' : 'rgba(255,159,10,0.22)';
    const gradId   = 'hprg_' + _homePRCurrent;

    // Dots — onclick calls global helper
    const dotsHtml = pts.map((p, i) => {
        const isSel = i === _homePRSelectedIdx;
        const r     = isSel ? 5 : 3.5;
        const fill  = isSel ? col : 'rgba(28,28,30,0.9)';
        const sw    = isSel ? 0 : 1.5;
        return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}"
            r="${r}" fill="${fill}" stroke="${col}" stroke-width="${sw}"
            style="cursor:pointer" onclick="_homePRSelectDot(${i})"/>`;
    }).join('');

    // PR label — only on highest point, behind a solid rect so line never crosses it
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

function _homePRRenderAllTime(allSessions) {
    // מאתר אלמנט all-time קיים או יוצר אחד חדש
    const card = document.getElementById('home-pr-card');
    if (!card) return;

    const col = HOME_PR_COLORS[_homePRCurrent];

    // הסרת שורה קיימת
    const existing = card.querySelector('.home-pr-alltime');
    if (existing) existing.remove();

    if (!allSessions || !allSessions.length) return;

    // מציאת השיא מכל הזמנים
    const atIdx = allSessions.reduce((b, _, i) => allSessions[i].e1rm > allSessions[b].e1rm ? i : b, 0);
    const at = allSessions[atIdx];

    const div = document.createElement('div');
    div.className = 'home-pr-alltime';
    div.innerHTML = `
        <div class="home-pr-alltime-icon">🏆</div>
        <div class="home-pr-alltime-info">
            <div class="home-pr-alltime-label">שיא כל הזמנים</div>
            <div class="home-pr-alltime-val" style="color:${col === '#0A84FF' ? '#FFD60A' : '#FFD60A'}">${at.e1rm.toFixed(1)} kg</div>
            <div class="home-pr-alltime-set">${at.set}</div>
        </div>
        <div class="home-pr-alltime-right">
            <div class="home-pr-alltime-badge">ALL TIME PR</div>
            <div class="home-pr-alltime-date">${at.date}</div>
        </div>`;

    // מוסיף בסוף הכרטיס
    card.appendChild(div);
}

// ─── ARCHIVE RANGE COPY (שדרוג 3) ────────────────────────────────────────

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
