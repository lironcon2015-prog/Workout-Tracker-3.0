/**
 * GYMPRO ELITE - ARCHIVE & ANALYTICS
 * Version: 13.1.2 (Phase 3: Visual Summary Screen & Separation of Concerns)
 * Includes: Finish Workout, Archive View, Calendar, Data Import/Export, Log Editing.
 */

function finish() {
    haptic('success');
    StorageManager.clearSessionState(); 
    state.workoutDurationMins = Math.floor((Date.now() - state.workoutStartTime) / 60000);
    navigate('ui-summary');
    document.getElementById('summary-note').value = "";
    
    // --- 1. DATA PROCESSING ---
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

    // --- 2. DUAL GENERATION (Raw Text & Visual HTML) ---
    const workoutDisplayName = state.type; 
    const dateStr = new Date().toLocaleDateString('he-IL');
    
    // Raw String for Clipboard
    let summaryText = `GYMPRO ELITE SUMMARY\n${workoutDisplayName} | Week ${state.week} | ${dateStr} | ${state.workoutDurationMins}m\n\n`;

    // Visual HTML for Screen (No Icons, Typography Focused)
    let html = `
    <div class="summary-overview-card">
        <div class="summary-overview-col">
            <span class="summary-overview-val">${workoutDisplayName}</span>
            <span class="summary-overview-label">תוכנית</span>
        </div>
        <div class="summary-overview-col">
            <span class="summary-overview-val">${state.week}</span>
            <span class="summary-overview-label">שבוע</span>
        </div>
        <div class="summary-overview-col">
            <span class="summary-overview-val">${state.workoutDurationMins}m</span>
            <span class="summary-overview-label">זמן</span>
        </div>
        <div class="summary-overview-col">
            <span class="summary-overview-val">${dateStr}</span>
            <span class="summary-overview-label">תאריך</span>
        </div>
    </div>`;

    let processedIndices = new Set();
    let lastClusterRound = 0;

    // Single chronological loop building both outputs
    state.log.forEach((entry, index) => {
        if (processedIndices.has(index)) return; 
        if (entry.isWarmup) return; 

        if (entry.isCluster) {
            // Cluster Card Handling
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
                
                html += `
                <div class="summary-set-row">
                    <span class="summary-set-num">-</span>
                    <span class="summary-set-details">${weightStr} x ${entry.r} (RIR ${entry.rir})</span>
                </div>`;
                if (entry.note) html += `<div class="summary-set-note">הערה: ${entry.note}</div>`;
            }
            
            summaryText += `• ${entry.exName}: ${details}\n`;
            html += `</div>`;
            processedIndices.add(index);

        } else {
            // Standard Exercise Handling
            lastClusterRound = 0;
            if(grouped[entry.exName]) {
                summaryText += `${entry.exName} (Vol: ${grouped[entry.exName].vol}kg):\n`;
                if (grouped[entry.exName].hasWarmup) summaryText += `🔥 Warmup Completed\n`;
                
                html += `<div class="summary-ex-card">
                    <div class="summary-ex-header">
                        <span class="summary-ex-title">${entry.exName}</span>
                        <span class="summary-ex-vol">[נפח: ${grouped[entry.exName].vol}kg]</span>
                    </div>`;
                    
                if (grouped[entry.exName].hasWarmup) {
                    html += `<div class="summary-tag-warmup">[ סט חימום ]</div>`;
                }

                let setCounter = 1;
                state.log.forEach((subEntry, subIndex) => {
                    if (!processedIndices.has(subIndex) && !subEntry.isCluster && subEntry.exName === entry.exName && !subEntry.isWarmup) {
                        if (subEntry.skip) {
                            summaryText += `(Skipped)\n`;
                            html += `<div class="summary-tag-skip">(דילוג)</div>`;
                        } else {
                            let weightStr = `${subEntry.w}kg`;
                            if (isUnilateral(subEntry.exName)) weightStr += ` (יד אחת)`;
                            let setStr = `${weightStr} x ${subEntry.r} (RIR ${subEntry.rir})`;
                            if (subEntry.note) setStr += ` | Note: ${subEntry.note}`;
                            summaryText += `${setStr}\n`;
                            
                            html += `
                            <div class="summary-set-row">
                                <span class="summary-set-num">${setCounter}.</span>
                                <span class="summary-set-details">${weightStr} x ${subEntry.r} (RIR ${subEntry.rir})</span>
                            </div>`;
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
    summaryArea.className = ""; // Remove monospace specific class for the new visual layout
    summaryArea.innerHTML = html;
    summaryArea.dataset.rawSummary = summaryText.trim(); // Store original format for Clipboard
}

function copyResult() {
    // Read the pristine raw text stored in the dataset
    const summaryArea = document.getElementById('summary-area');
    const rawText = summaryArea.dataset.rawSummary;
    
    let textToCopy = rawText;
    const userNote = document.getElementById('summary-note').value.trim();
    if (userNote) textToCopy += `\n\n📝 הערות כלליות: ${userNote}`;
    
    const workoutDisplayName = state.type;
    const dateStr = new Date().toLocaleDateString('he-IL');
    
    // Save to LocalStorage exactly as before
    const archiveObj = { 
        id: Date.now(), 
        date: dateStr, 
        timestamp: Date.now(), 
        type: workoutDisplayName, 
        week: state.week, 
        duration: state.workoutDurationMins, 
        summary: textToCopy, 
        details: state.lastWorkoutDetails, 
        generalNote: userNote 
    };
    StorageManager.saveToArchive(archiveObj);
    
    if (navigator.clipboard) { 
        navigator.clipboard.writeText(textToCopy).then(() => { 
            haptic('light'); 
            alert("הסיכום נשמר בארכיון והועתק!"); 
            location.reload(); 
        }); 
    } else { 
        const el = document.createElement("textarea"); 
        el.value = textToCopy; 
        document.body.appendChild(el); 
        el.select(); 
        document.execCommand('copy'); 
        document.body.removeChild(el); 
        alert("הסיכום נשמר בארכיון והועתק!"); 
        location.reload(); 
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

function renderArchiveList() {
    const list = document.getElementById('archive-list'); list.innerHTML = "";
    selectedArchiveIds.clear(); updateCopySelectedBtn();
    const history = StorageManager.getArchive();
    
    if (history.length === 0) { 
        list.innerHTML = `<div class="text-center color-dim mt-md">אין אימונים שמורים</div>`; 
    } else {
        history.forEach(item => {
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
            list.appendChild(card);
        });
    }
}

function toggleArchiveSelection(id) { if (selectedArchiveIds.has(id)) selectedArchiveIds.delete(id); else selectedArchiveIds.add(id); updateCopySelectedBtn(); }

function updateCopySelectedBtn() {
    const btn = document.getElementById('btn-copy-selected');
    if (selectedArchiveIds.size > 0) { 
        btn.disabled = false; 
        btn.style.opacity = "1"; 
        btn.style.borderColor = "var(--accent)"; 
        btn.style.color = "var(--accent)"; 
    } else { 
        btn.disabled = true; 
        btn.style.opacity = "0.5"; 
        btn.style.borderColor = "var(--border)"; 
        btn.style.color = "var(--text-dim)"; 
    }
}

function copyBulkLog(mode) {
    const history = StorageManager.getArchive();
    let itemsToCopy = mode === 'all' ? history : history.filter(item => selectedArchiveIds.has(item.timestamp));
    if (itemsToCopy.length === 0) { alert("לא נבחרו אימונים להעתקה"); return; }
    const bulkText = itemsToCopy.map(item => item.summary).join("\n\n========================================\n\n");
    if (navigator.clipboard) { navigator.clipboard.writeText(bulkText).then(() => { haptic('success'); alert(`הועתקו ${itemsToCopy.length} אימונים בהצלחה!`); }); } 
    else { const el = document.createElement("textarea"); el.value = bulkText; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); alert(`הועתקו ${itemsToCopy.length} אימונים בהצלחה!`); }
}

function changeMonth(delta) { state.calendarOffset += delta; renderCalendar(); }
function renderCalendar() {
    const grid = document.getElementById('calendar-days');
    grid.innerHTML = "";
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + state.calendarOffset, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const monthNames =["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
    document.getElementById('current-month-display').innerText = `${monthNames[month]} ${year}`;
    const firstDayIndex = targetDate.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const history = StorageManager.getArchive();
    
    const monthWorkouts = history.filter(item => {
        const d = new Date(item.timestamp);
        return d.getMonth() === month && d.getFullYear() === year;
    });
    
    for(let i = 0; i < firstDayIndex; i++) { 
        const cell = document.createElement('div'); 
        cell.className = "calendar-cell empty"; 
        grid.appendChild(cell); 
    }
    
    const today = new Date();
    for(let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div'); cell.className = "calendar-cell";
        cell.innerHTML = `<span>${day}</span>`;
        if(state.calendarOffset === 0 && day === today.getDate()) cell.classList.add('today');
        
        const dailyWorkouts = monthWorkouts.filter(item => new Date(item.timestamp).getDate() === day);
        if(dailyWorkouts.length > 0) {
            const dotsContainer = document.createElement('div'); 
            dotsContainer.className = "dots-container";
            
            dailyWorkouts.forEach(wo => {
                const dot = document.createElement('div');
                let dotClass = 'type-free';
                if(wo.type.includes('כתפיים - גב - חזה') || wo.type.includes('A')) dotClass = 'type-a';
                else if(wo.type.includes('רגליים - גב') || wo.type.includes('B')) dotClass = 'type-b';
                else if(wo.type.includes('חזה - כתפיים') || wo.type.includes('C')) dotClass = 'type-c';
                dot.className = `dot ${dotClass}`;
                dotsContainer.appendChild(dot);
            });
            cell.appendChild(dotsContainer);
            cell.onclick = () => openDayDrawer(dailyWorkouts, day, monthNames[month]);
        }
        grid.appendChild(cell);
    }
}

function openDayDrawer(workouts, day, monthName) {
    const drawer = document.getElementById('sheet-modal');
    const overlay = document.getElementById('sheet-overlay');
    const content = document.getElementById('sheet-content');
    
    let html = `<h3>${day} ב${monthName}</h3>`;
    
    if(workouts.length === 0) { 
        html += `<p class="color-dim text-sm">אין אימונים ביום זה</p>`; 
    } else {
        html += `<p class="color-dim text-sm">נמצאו ${workouts.length} אימונים:</p>`;
        workouts.forEach(wo => {
            let dotColor = '#BF5AF2';
            if(wo.type.includes('כתפיים - גב - חזה') || wo.type.includes('A')) dotColor = '#0A84FF';
            else if(wo.type.includes('רגליים - גב') || wo.type.includes('B')) dotColor = '#32D74B';
            else if(wo.type.includes('חזה - כתפיים') || wo.type.includes('C')) dotColor = '#FF9F0A';
            
            html += `
            <div class="mini-workout-item" onclick='openArchiveFromDrawer(${JSON.stringify(wo).replace(/'/g, "&#39;")})'>
                <div class="mini-dot" style="background:${dotColor}"></div>
                <div style="flex-grow:1;">
                    <div class="font-semi text-base">${wo.type}</div>
                    <div class="text-xs color-dim">${wo.duration} דק' • ${new Date(wo.timestamp).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}</div>
                </div>
                <div class="chevron"></div>
            </div>`;
        });
    }
    content.innerHTML = html;
    overlay.style.display = 'block';
    drawer.classList.add('open');
    haptic('light');
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
    if(realItem) showArchiveDetail(realItem);
}

function showArchiveDetail(item) {
    currentArchiveItem = item; 
    document.getElementById('archive-detail-content').innerText = item.summary;
    document.getElementById('btn-archive-copy').onclick = () => navigator.clipboard.writeText(item.summary).then(() => alert("הועתק!"));
    
    document.getElementById('btn-archive-delete').onclick = () => { 
        if(confirm("למחוק אימון זה מהארכיון?")) { 
            StorageManager.deleteFromArchive(item.timestamp); 
            state.historyStack.pop(); 
            openArchive(); 
        } 
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
    const file = input.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if(confirm("האם לדרוס את הנתונים הקיימים ולשחזר מהגיבוי?")) { 
                StorageManager.restoreData(data); 
                alert("הנתונים שוחזרו בהצלחה!"); 
                location.reload(); 
            }
        } catch(err) { alert("שגיאה בטעינת הקובץ."); }
    };
    reader.readAsText(file);
}

function triggerConfigImport() { document.getElementById('import-config-file').click(); }

function processConfigImport(input) {
    const file = input.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { 
        try { 
            StorageManager.importConfiguration(JSON.parse(e.target.result)); 
        } catch(err) { 
            alert("שגיאה בטעינת הקובץ."); 
        } 
    };
    reader.readAsText(file);
}

function openSessionLog() {
    const drawer = document.getElementById('sheet-modal');
    const overlay = document.getElementById('sheet-overlay');
    const content = document.getElementById('sheet-content');

    let html = `<h3>יומן אימון נוכחי</h3>`;
    
    if (state.log.length === 0) {
        html += `<p class="text-center mt-lg color-dim">טרם בוצעו סטים באימון זה</p>`;
    } else {
        html += `<div class="vertical-stack mt-sm">`;
        state.log.forEach((entry, index) => {
            const isSkip = entry.skip;
            const isWarmup = entry.isWarmup;
            let displayTitle = entry.exName;
            let details = "";
            let dotColor = "var(--text-dim)";

            if (isSkip) { details = "דילוג על תרגיל"; } 
            else if (isWarmup) { details = "סט חימום"; dotColor = "#ff3b30"; } 
            else { details = `${entry.w}kg x ${entry.r} (RIR ${entry.rir})`; if (entry.note) details += ` | 📝`; dotColor = "var(--accent)"; }

            html += `
            <div class="mini-workout-item" onclick="openEditSet(${index})">
                <div class="mini-dot" style="background:${dotColor}"></div>
                <div style="flex-grow:1;">
                    <div class="font-semi text-sm">${index + 1}. ${displayTitle}</div>
                    <div class="text-sm color-dim mt-xs">${details}</div>
                </div>
                <div class="chevron"></div>
            </div>`;
        });
        html += `</div>`;
    }

    content.innerHTML = html;
    overlay.style.display = 'block';
    drawer.classList.add('open');
    haptic('light');
}

function openHistoryDrawer() {
    const drawer = document.getElementById('sheet-modal');
    const overlay = document.getElementById('sheet-overlay');
    const content = document.getElementById('sheet-content');
    
    const history = getLastPerformance(state.currentExName);
    
    let html = `<h3>היסטוריה: ${state.currentExName}</h3>`;
    
    if (!history) {
        html += `<p class="text-center mt-lg color-dim">אין נתונים מהאימון הקודם</p>`;
    } else {
        html += `<div class="text-sm color-dim mb-md text-right mt-xs">📅 ביצוע אחרון: ${history.date}</div>`;
        
        html += `
        <div class="history-header">
            <div>סט</div>
            <div>משקל</div>
            <div>חזרות</div>
            <div>RIR</div>
        </div>
        <div class="history-list">`;
        
        history.sets.forEach((setStr, idx) => {
            let weight = "-", reps = "-", rir = "-";
            try {
                let coreStr = setStr;
                if (setStr.includes('| Note:')) {
                    coreStr = setStr.split('| Note:')[0].trim();
                }

                const parts = coreStr.split('x');
                if(parts.length > 1) {
                    weight = parts[0].replace('kg', '').trim();
                    const rest = parts[1];
                    const rirMatch = rest.match(/\(RIR (.*?)\)/);
                    reps = rest.split('(')[0].trim();
                    if(rirMatch) rir = rirMatch[1];
                }
            } catch(e) {}

            html += `
            <div class="history-row">
                <div class="history-col set-idx">#${idx + 1}</div>
                <div class="history-col">${weight}</div>
                <div class="history-col">${reps}</div>
                <div class="history-col rir-note">${rir}</div>
            </div>`;
        });
        html += `</div>`;
    }

    content.innerHTML = html;
    overlay.style.display = 'block';
    drawer.classList.add('open');
    haptic('light');
}

function getLastPerformance(exName) {
    const archive = StorageManager.getArchive();
    for (const item of archive) {
        if (item.week === 'deload') continue;
        if (item.details && item.details[exName]) {
            if (item.details[exName].sets && item.details[exName].sets.length > 0) {
                return { date: item.date, sets: item.details[exName].sets };
            }
        }
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
    
    state.log[state.editingIndex].w = w;
    state.log[state.editingIndex].r = r;
    state.log[state.editingIndex].rir = rir;
    state.log[state.editingIndex].note = note;

    if (state.editingIndex === state.log.length - 1) {
        state.lastLoggedSet = state.log[state.editingIndex];
        const hist = document.getElementById('last-set-info');
        hist.innerText = `סט אחרון: ${state.lastLoggedSet.w}kg x ${state.lastLoggedSet.r} (RIR ${state.lastLoggedSet.rir})`;
    }
    StorageManager.saveSessionState();
    closeEditModal(); haptic('success'); openSessionLog(); 
}

function deleteSetFromLog() {
    if (state.editingIndex === -1) return;
    if (!confirm("האם למחוק את הסט הזה?")) return;
    
    const removedEntry = state.log[state.editingIndex];
    state.log.splice(state.editingIndex, 1);
    
    if (removedEntry.exName === state.currentExName) {
        if (state.setIdx > 0) state.setIdx--;
        const relevantLogs = state.log.filter(l => l.exName === state.currentExName && !l.skip && !l.isWarmup);
        if (relevantLogs.length > 0) {
            state.lastLoggedSet = relevantLogs[relevantLogs.length - 1];
        } else {
            state.lastLoggedSet = null;
        }
    }
    
    StorageManager.saveSessionState();
    closeEditModal();
    haptic('warning');
    
    if (document.getElementById('ui-main').classList.contains('active')) {
        if(typeof initPickers === 'function') initPickers();
    }
    openSessionLog();
}
