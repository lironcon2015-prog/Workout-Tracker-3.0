/**
 * GYMPRO ELITE - EDITOR & MANAGER LOGIC
 * Version: 14.8.0
 * שדרוג 1: Toggle פעילים/מוסתרים בניהול תוכניות.
 */

// ─── AUTO CLOUD CONFIG SAVE ────────────────────────────────────────────────

function autoSaveConfigToCloud() {
    if (typeof FirebaseManager === 'undefined' || !FirebaseManager.isConfigured()) return;
    FirebaseManager.saveConfigToCloud().then(ok => {
        if (typeof showCloudToast === 'function') {
            showCloudToast(ok ? '☁️ קונפיג נשמר בענן' : '⚠️ שגיאה בשמירת קונפיג לענן', ok);
        }
    });
}

// ─── DYNAMIC MAIN MENU ─────────────────────────────────────────────────────

function renderWorkoutMenu() {
    const container = document.getElementById('workout-menu-container');
    if (!container) return;

    container.innerHTML = "";
    const title = document.getElementById('workout-week-title');

    if (state.week === 'deload') {
        title.innerText = "שבוע דילואוד";
        const keys = Object.keys(state.workouts);
        const deloadWorkouts = keys.filter(k => {
            const meta = state.workoutMeta[k];
            return meta && meta.availableInDeload === true;
        });

        if (deloadWorkouts.length === 0) {
            container.innerHTML = `<p class="text-center color-dim">בחר Freestyle או סמן תוכנית כדילואוד בעורך</p>`;
        } else {
            deloadWorkouts.forEach(key => {
                const btn = document.createElement('button');
                btn.className = "menu-card tall";
                const meta = state.workoutMeta[key];

                const badge = (meta && meta.isDeloadOnly)
                    ? `<span class="text-xs color-type-free rounded-md" style="border:1px solid var(--type-free); padding:2px 6px;">Deload Only</span>`
                    : '';

                let count = 0;
                const w = state.workouts[key];
                if (Array.isArray(w)) {
                    w.forEach(item => { if (item.type === 'cluster') count += item.exercises.length; else count++; });
                }

                btn.innerHTML = `
                    <div class="flex-between w-100 mb-xs"><h3>${key}</h3>${badge}</div>
                    <div class="flex-between w-100">
                        <p style="margin:0;">${count} תרגילים</p>
                        <button class="btn-exercises-pill" onclick="event.stopPropagation(); openWorkoutPlanSheet('${key.replace(/'/g, "\\'")}')">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                            תרגילים
                        </button>
                    </div>`;
                btn.onclick = () => selectWorkout(key);
                container.appendChild(btn);
            });
        }
    } else {
        title.innerText = `שבוע ${state.week} - בחר אימון`;
        Object.keys(state.workouts).forEach(key => {
            const meta = state.workoutMeta[key];
            if (meta && meta.isDeloadOnly) return;
            if (meta && meta.isHidden) return;

            const btn = document.createElement('button');
            btn.className = "menu-card tall";
            let count = 0;
            const w = state.workouts[key];
            if (Array.isArray(w)) {
                w.forEach(item => { if (item.type === 'cluster') count += item.exercises.length; else count++; });
            }
            btn.innerHTML = `
                <div class="flex-between w-100 mb-xs"><h3>${key}</h3></div>
                <div class="flex-between w-100">
                    <p style="margin:0;">${count} תרגילים</p>
                    <button class="btn-exercises-pill" onclick="event.stopPropagation(); openWorkoutPlanSheet('${key.replace(/'/g, "\\'")}')">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                        תרגילים
                    </button>
                </div>`;
            btn.onclick = () => selectWorkout(key);
            container.appendChild(btn);
        });
    }

}

// ─── WORKOUT MANAGER ───────────────────────────────────────────────────────

let _managerTab = 'active';

function openWorkoutManager() { _managerTab = 'active'; renderManagerList(); navigate('ui-workout-manager'); }

function _setManagerTab(tab) {
    _managerTab = tab;
    renderManagerList();
}

function renderManagerList() {
    const list = document.getElementById('manager-list');
    if (!list) return;
    list.innerHTML = "";

    const keys = Object.keys(state.workouts);

    // Segmented control
    const seg = document.createElement('div');
    seg.className = 'segmented-control mb-md';
    seg.innerHTML = `
        <button class="segment-btn ${_managerTab === 'active' ? 'active' : ''}" onclick="_setManagerTab('active')">פעילים</button>
        <button class="segment-btn ${_managerTab === 'hidden' ? 'active' : ''}" onclick="_setManagerTab('hidden')">מוסתרים</button>
    `;
    list.appendChild(seg);

    const activeKeys = keys.filter(k => { const m = state.workoutMeta[k]; return !m || !m.isHidden; });
    const hiddenKeys = keys.filter(k => { const m = state.workoutMeta[k]; return m && m.isHidden; });
    const displayKeys = _managerTab === 'active' ? activeKeys : hiddenKeys;

    if (displayKeys.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'text-center color-dim';
        empty.textContent = _managerTab === 'active' ? 'אין תוכניות פעילות' : 'אין תוכניות מוסתרות';
        list.appendChild(empty);
    } else {
        displayKeys.forEach(key => {
            const wo = state.workouts[key];
            const el = document.createElement('div');
            el.className = 'manager-item';
            if (_managerTab === 'hidden') el.style.opacity = '0.55';
            el.onclick = () => editWorkout(key);
            let count = 0;
            if (Array.isArray(wo)) {
                wo.forEach(item => { if (item.type === 'cluster') count += item.exercises.length; else count++; });
            }
            el.innerHTML = `
                <div class="manager-info"><h3>${key}</h3><p>${count} תרגילים</p></div>
                <div class="manager-actions">
                    <button class="btn-text-action" onclick="event.stopPropagation(); duplicateWorkout('${key}')">שכפל</button>
                    <button class="btn-text-action delete" onclick="event.stopPropagation(); deleteWorkout('${key}')">מחק</button>
                </div>
            `;
            list.appendChild(el);
        });
    }

    // Show/hide create button — only in active tab
    const createBtn = document.getElementById('btn-create-workout');
    if (createBtn) createBtn.style.display = _managerTab === 'active' ? '' : 'none';
}

function deleteWorkout(key) {
    showConfirm(`האם למחוק את תוכנית ${key}?`, () => {
        delete state.workouts[key];
        if (state.workoutMeta[key]) delete state.workoutMeta[key];
        StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);
        StorageManager.saveData(StorageManager.KEY_META, state.workoutMeta);
        renderManagerList(); renderWorkoutMenu();
        autoSaveConfigToCloud();
    });
}

function duplicateWorkout(key) {
    const newName = key + " Copy";
    if (state.workouts[newName]) { showAlert("שם התוכנית כבר קיים"); return; }
    const copy = JSON.parse(JSON.stringify(state.workouts[key]));
    if (state.workoutMeta[key]) {
        state.workoutMeta[newName] = JSON.parse(JSON.stringify(state.workoutMeta[key]));
        StorageManager.saveData(StorageManager.KEY_META, state.workoutMeta);
    }
    state.workouts[newName] = copy;
    StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);
    renderManagerList(); renderWorkoutMenu();
    autoSaveConfigToCloud();
}

function createNewWorkout() {
    managerState.originalName = ''; managerState.currentName = 'New Plan';
    managerState.exercises = [];
    openEditorUI();
}

function editWorkout(key) {
    managerState.originalName = key; managerState.currentName = key;
    managerState.exercises = JSON.parse(JSON.stringify(state.workouts[key]));
    openEditorUI();
}

function openEditorUI() {
    document.getElementById('editor-workout-name').value = managerState.currentName;
    const meta = state.workoutMeta[managerState.currentName] || {};
    document.getElementById('editor-deload-check').checked = !!meta.availableInDeload;
    document.getElementById('editor-deload-only-check').checked = !!meta.isDeloadOnly;
    document.getElementById('editor-hidden-check').checked = !!meta.isHidden;
    _renderColorSwatches(meta.color || '');
    renderEditorList();
    navigate('ui-workout-editor');
}

// ─── EXERCISE MANAGER (CREATE / EDIT) ──────────────────────────────────────

function openExerciseCreator() {
    document.getElementById('ex-config-title').innerText = "יצירת תרגיל חדש";
    document.getElementById('conf-ex-name').value = "";
    document.getElementById('conf-ex-muscle').value = "חזה";
    document.getElementById('conf-ex-base').value = "";
    document.getElementById('conf-ex-step').value = "2.5";
    document.getElementById('conf-ex-min').value = "";
    document.getElementById('conf-ex-max').value = "";
    document.getElementById('conf-ex-uni').checked = false;

    document.getElementById('btn-delete-ex').classList.add('d-none');

    document.getElementById('ex-config-modal').dataset.mode = "create";
    document.getElementById('ex-config-modal').style.display = 'flex';
}

function openExerciseEditor(exName) {
    const ex = state.exercises.find(e => e.name === exName);
    if (!ex) return;

    document.getElementById('ex-config-title').innerText = "עריכת תרגיל";
    document.getElementById('conf-ex-name').value = ex.name;
    document.getElementById('conf-ex-name').disabled = false;

    let muscleVal = ex.muscles[0] || "חזה";
    if (ex.muscles.includes('biceps')) muscleVal = "יד קדמית";
    else if (ex.muscles.includes('triceps')) muscleVal = "יד אחורית";
    else if (ex.muscles.includes('בטן')) muscleVal = "בטן";

    document.getElementById('conf-ex-muscle').value = muscleVal;
    document.getElementById('conf-ex-step').value = ex.step || "2.5";
    document.getElementById('conf-ex-uni').checked = !!ex.isUnilateral;

    if (ex.manualRange) {
        document.getElementById('conf-ex-base').value = ex.manualRange.base || "";
        document.getElementById('conf-ex-min').value = ex.manualRange.min || "";
        document.getElementById('conf-ex-max').value = ex.manualRange.max || "";
    } else {
        document.getElementById('conf-ex-base').value = "";
        document.getElementById('conf-ex-min').value = ex.minW || "";
        document.getElementById('conf-ex-max').value = ex.maxW || "";
    }

    document.getElementById('btn-delete-ex').classList.remove('d-none');
    document.getElementById('ex-config-modal').dataset.mode = "edit";
    document.getElementById('ex-config-modal').dataset.target = exName;
    document.getElementById('ex-config-modal').style.display = 'flex';
}

// ─── EXERCISE DATABASE MANAGER ─────────────────────────────────────────────

function openExerciseDatabase() {
    managerState.dbFilter = 'all';
    document.querySelectorAll('#ui-exercise-db .chip').forEach(c => c.classList.remove('active'));
    const firstChip = document.querySelector('#ui-exercise-db .chip');
    if (firstChip) firstChip.classList.add('active');

    navigate('ui-exercise-db');
    document.getElementById('db-search').value = '';
    renderExerciseDatabase();
}

function setDbFilter(filter, btn) {
    managerState.dbFilter = filter;
    document.querySelectorAll('#ui-exercise-db .chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderExerciseDatabase();
}

function renderExerciseDatabase() {
    const list = document.getElementById('db-list');
    list.innerHTML = "";
    const searchVal = document.getElementById('db-search').value.toLowerCase();

    const sorted = [...state.exercises].sort((a, b) => a.name.localeCompare(b.name));

    const filtered = sorted.filter(ex => {
        if (managerState.dbFilter !== 'all') {
            const muscleMap = { 'יד קדמית': 'biceps', 'יד אחורית': 'triceps', 'ידיים': 'ידיים' };
            if (managerState.dbFilter === 'ידיים') {
                if (!ex.muscles.includes('ידיים') && !ex.muscles.includes('biceps') && !ex.muscles.includes('triceps')) return false;
            } else {
                if (!ex.muscles.includes(managerState.dbFilter) && !ex.muscles.includes(muscleMap[managerState.dbFilter])) return false;
            }
        }
        return ex.name.toLowerCase().includes(searchVal);
    });

    if (filtered.length === 0) {
        list.innerHTML = `<p class="text-center color-dim mt-md">לא נמצאו תרגילים</p>`;
        return;
    }

    filtered.forEach(ex => {
        const row = document.createElement('div');
        row.className = "selector-item-row";
        row.onclick = () => openExerciseEditor(ex.name);

        row.innerHTML = `
            <div class="selector-item-info">
                <div class="font-semi text-base">${ex.name}</div>
                <div class="text-sm color-dim mt-xs">${ex.muscles.join(', ')}</div>
            </div>
            <div class="selector-item-actions">
                <div class="chevron"></div>
            </div>
        `;
        list.appendChild(row);
    });
}

function saveExerciseConfig() {
    const mode = document.getElementById('ex-config-modal').dataset.mode;
    const name = document.getElementById('conf-ex-name').value.trim();
    const muscleSelect = document.getElementById('conf-ex-muscle').value;
    const step = parseFloat(document.getElementById('conf-ex-step').value);
    const base = parseFloat(document.getElementById('conf-ex-base').value);
    const min = parseFloat(document.getElementById('conf-ex-min').value);
    const max = parseFloat(document.getElementById('conf-ex-max').value);
    const isUni = document.getElementById('conf-ex-uni').checked;

    if (!name) { showAlert("נא להזין שם תרגיל"); return; }

    let musclesArr = [muscleSelect];
    if (muscleSelect === 'יד קדמית') musclesArr = ['ידיים', 'biceps'];
    if (muscleSelect === 'יד אחורית') musclesArr = ['ידיים', 'triceps'];

    if (mode === 'create') {
        if (state.exercises.find(e => e.name === name)) { showAlert("שם תרגיל כבר קיים"); return; }

        const newEx = {
            name,
            muscles: musclesArr,
            step,
            isUnilateral: isUni,
            manualRange: {
                base: isNaN(base) ? undefined : base,
                min: isNaN(min) ? undefined : min,
                max: isNaN(max) ? undefined : max
            }
        };
        state.exercises.push(newEx);
        StorageManager.saveData(StorageManager.KEY_DB_EXERCISES, state.exercises);
        closeExConfigModal();
        showAlert("התרגיל נוצר בהצלחה!");

    } else {
        const targetName = document.getElementById('ex-config-modal').dataset.target;
        const exIndex = state.exercises.findIndex(e => e.name === targetName);
        if (exIndex === -1) return;

        if (targetName !== name) {
            if (state.exercises.find(e => e.name === name)) { showAlert("שם זה כבר קיים במערכת"); return; }

            showConfirm(
                `שינית את שם התרגיל מ-"${targetName}" ל-"${name}".\nהשינוי יעדכן את כל התוכניות הקיימות.\nהאם להמשיך?`,
                () => {
                    for (let key in state.workouts) {
                        const wo = state.workouts[key];
                        if (Array.isArray(wo)) {
                            wo.forEach(item => {
                                if (item.type === 'cluster') {
                                    item.exercises.forEach(sub => { if (sub.name === targetName) sub.name = name; });
                                } else {
                                    if (item.name === targetName) item.name = name;
                                }
                            });
                        }
                    }
                    StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);

                    const lastW = StorageManager.getLastWeight(targetName);
                    if (lastW) StorageManager.saveWeight(name, lastW);

                    state.exercises[exIndex].name = name;
                    _finishSaveExConfig(exIndex, musclesArr, step, isUni, base, min, max);
                }
            );
            return;
        }

        _finishSaveExConfig(exIndex, musclesArr, step, isUni, base, min, max);
    }
}

function _finishSaveExConfig(exIndex, musclesArr, step, isUni, base, min, max) {
    state.exercises[exIndex].muscles = musclesArr;
    state.exercises[exIndex].step = step;
    state.exercises[exIndex].isUnilateral = isUni;

    if (!state.exercises[exIndex].manualRange) state.exercises[exIndex].manualRange = {};
    state.exercises[exIndex].manualRange.base = isNaN(base) ? undefined : base;
    state.exercises[exIndex].manualRange.min = isNaN(min) ? undefined : min;
    state.exercises[exIndex].manualRange.max = isNaN(max) ? undefined : max;

    if (!isNaN(min)) delete state.exercises[exIndex].minW;
    if (!isNaN(max)) delete state.exercises[exIndex].maxW;

    StorageManager.saveData(StorageManager.KEY_DB_EXERCISES, state.exercises);
    autoSaveConfigToCloud();
    closeExConfigModal();

    if (document.getElementById('ui-exercise-db').classList.contains('active')) {
        renderExerciseDatabase();
    } else if (document.getElementById('ui-exercise-selector').classList.contains('active')) {
        prepareSelector();
    }
}

function deleteExercise() {
    const targetName = document.getElementById('ex-config-modal').dataset.target;
    if (!targetName) return;

    let usedIn = [];
    for (let key in state.workouts) {
        const wo = state.workouts[key];
        if (Array.isArray(wo)) {
            let found = false;
            wo.forEach(item => {
                if (item.type === 'cluster') {
                    if (item.exercises.some(sub => sub.name === targetName)) found = true;
                } else {
                    if (item.name === targetName) found = true;
                }
            });
            if (found) usedIn.push(key);
        }
    }

    if (usedIn.length > 0) {
        showAlert(`לא ניתן למחוק את התרגיל!\nהוא נמצא בשימוש בתוכניות הבאות:\n- ${usedIn.join('\n- ')}\n\nיש להסיר אותו מהתוכניות קודם.`);
        return;
    }

    showConfirm(`האם למחוק את התרגיל "${targetName}" לצמיתות?`, () => {
        const exIndex = state.exercises.findIndex(e => e.name === targetName);
        if (exIndex > -1) {
            state.exercises.splice(exIndex, 1);
            StorageManager.saveData(StorageManager.KEY_DB_EXERCISES, state.exercises);
            autoSaveConfigToCloud();
            showAlert("התרגיל נמחק.", () => {
                closeExConfigModal();
                renderExerciseDatabase();
            });
        }
    });
}

function closeExConfigModal() {
    document.getElementById('ex-config-modal').style.display = 'none';
    document.getElementById('conf-ex-name').disabled = false;
}

// ─── WORKOUT EDITOR & CLUSTER SUPPORT ─────────────────────────────────────

function renderEditorList() {
    const list = document.getElementById('editor-list');
    list.innerHTML = "";

    managerState.exercises.forEach((item, idx) => {
        if (item.type === 'cluster') {
            renderClusterItem(item, idx, list);
        } else {
            renderRegularItem(item, idx, list);
        }
    });

    StorageManager.saveSessionState();
}

function renderRegularItem(item, idx, list) {
    const row = document.createElement('div');
    row.className = "editor-row";

    let setControls = '';
    if (!item.isMain) {
        setControls = `
            <div class="set-selector">
                <button class="set-btn" onclick="changeSetCount(${idx}, -1)">-</button>
                <span class="set-val">${item.sets}</span>
                <button class="set-btn" onclick="changeSetCount(${idx}, 1)">+</button>
            </div>
        `;
    } else {
        setControls = `<span class="text-sm color-dim" style="margin:0 5px;">1RM</span>`;
    }

    row.innerHTML = `
        <div class="row-info" onclick="openRestTimerModal(${idx})">${item.name}</div>
        <div class="editor-controls">
            <button class="badge-main ${item.isMain ? 'active' : ''}" onclick="toggleMainStatus(${idx})">MAIN</button>
            ${setControls}
            <button class="control-icon-btn" onclick="moveExInEditor(${idx}, -1)">▲</button>
            <button class="control-icon-btn" onclick="moveExInEditor(${idx}, 1)">▼</button>
            <button class="control-icon-btn" onclick="removeExFromEditor(${idx})" style="color:#ff453a; border-color: rgba(255,69,58,0.3);">✕</button>
        </div>
    `;
    list.appendChild(row);
}

function renderClusterItem(cluster, idx, list) {
    const box = document.createElement('div');
    box.className = "cluster-box";

    let html = `
    <div class="cluster-header">
        <div class="cluster-title">סבב / מעגל (Cluster)</div>
        <div class="editor-controls">
            <button class="control-icon-btn" onclick="moveExInEditor(${idx}, -1)">▲</button>
            <button class="control-icon-btn" onclick="moveExInEditor(${idx}, 1)">▼</button>
            <button class="control-icon-btn" onclick="removeExFromEditor(${idx})" style="color:#ff453a;">✕</button>
        </div>
    </div>
    <div class="input-grid grid-2-cols mb-sm">
        <div class="glass-card compact m-0 p-sm">
            <label>מס' סבבים</label>
            <div class="set-selector flex-center">
                <button class="set-btn" onclick="changeClusterRounds(${idx}, -1)">-</button>
                <span class="set-val">${cluster.rounds}</span>
                <button class="set-btn" onclick="changeClusterRounds(${idx}, 1)">+</button>
            </div>
        </div>
        <div class="glass-card compact m-0 p-sm">
            <label>מנוחה בסוף סבב</label>
            <div class="set-selector flex-center">
                <button class="set-btn" onclick="changeClusterRest(${idx}, -30)">-</button>
                <span class="set-val" style="width:40px;">${cluster.clusterRest}s</span>
                <button class="set-btn" onclick="changeClusterRest(${idx}, 30)">+</button>
            </div>
        </div>
    </div>
    <div class="cluster-content vertical-stack">
    `;

    cluster.exercises.forEach((ex, internalIdx) => {
        html += `
        <div class="editor-row p-sm" style="background:rgba(255,255,255,0.05);">
            <div class="row-info" onclick="openRestTimerModal(${idx}, ${internalIdx})">${internalIdx + 1}. ${ex.name}</div>
            <div class="editor-controls">
                <button class="control-icon-btn" style="width:24px; height:24px;" onclick="removeExFromCluster(${idx}, ${internalIdx})">✕</button>
            </div>
        </div>`;
    });

    html += `
        <button class="btn-text text-sm color-type-free p-sm" onclick="openExerciseSelectorForCluster(${idx})">+ הוסף תרגיל לסבב</button>
    </div>`;

    box.innerHTML = html;
    list.appendChild(box);
}

function toggleMainStatus(idx) { managerState.exercises[idx].isMain = !managerState.exercises[idx].isMain; renderEditorList(); }
function changeSetCount(idx, delta) { let c = managerState.exercises[idx].sets + delta; if (c < 1) c = 1; managerState.exercises[idx].sets = c; renderEditorList(); }
function moveExInEditor(idx, dir) { if (idx + dir < 0 || idx + dir >= managerState.exercises.length) return; const t = managerState.exercises[idx]; managerState.exercises[idx] = managerState.exercises[idx + dir]; managerState.exercises[idx + dir] = t; renderEditorList(); }
function removeExFromEditor(idx) { managerState.exercises.splice(idx, 1); renderEditorList(); }
function changeClusterRounds(idx, delta) { let v = managerState.exercises[idx].rounds + delta; if (v < 1) v = 1; managerState.exercises[idx].rounds = v; renderEditorList(); }
function changeClusterRest(idx, delta) { let v = managerState.exercises[idx].clusterRest + delta; if (v < 0) v = 0; managerState.exercises[idx].clusterRest = v; renderEditorList(); }
function addClusterToEditor() { managerState.exercises.push({ type: 'cluster', rounds: 3, clusterRest: 120, exercises: [] }); renderEditorList(); }
function removeExFromCluster(clusterIdx, exIdx) { managerState.exercises[clusterIdx].exercises.splice(exIdx, 1); renderEditorList(); }

function saveWorkoutChanges() {
    const newName = document.getElementById('editor-workout-name').value.trim();
    if (!newName) { showAlert("נא להזין שם לתוכנית"); return; }
    if (managerState.exercises.length === 0) { showAlert("התוכנית ריקה!"); return; }

    if (newName !== managerState.originalName) {
        if (state.workouts[newName]) { showAlert("שם תוכנית זה כבר קיים"); return; }
        if (managerState.originalName) {
            delete state.workouts[managerState.originalName];
            delete state.workoutMeta[managerState.originalName];
        }
    }

    if (!state.workoutMeta[newName]) state.workoutMeta[newName] = {};

    const isDeloadOnly = document.getElementById('editor-deload-only-check').checked;
    state.workoutMeta[newName].isDeloadOnly = isDeloadOnly;

    if (isDeloadOnly) {
        state.workoutMeta[newName].availableInDeload = true;
    } else {
        state.workoutMeta[newName].availableInDeload = document.getElementById('editor-deload-check').checked;
    }

    state.workoutMeta[newName].isHidden = document.getElementById('editor-hidden-check').checked;
    state.workoutMeta[newName].color = _selectedEditorColor || '';

    StorageManager.saveData(StorageManager.KEY_META, state.workoutMeta);

    state.workouts[newName] = managerState.exercises;
    StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);
    autoSaveConfigToCloud();

    haptic('success');

    state.historyStack.pop();
    navigate('ui-workout-manager');
    renderManagerList();
    renderWorkoutMenu();
}

// ─── REST TIMER & DEFAULTS EDITING ─────────────────────────────────────────

function openRestTimerModal(idx, internalIdx = null) {
    let ex;
    if (internalIdx !== null) {
        ex = managerState.exercises[idx].exercises[internalIdx];
        managerState.editingTimerEx = { idx, internalIdx };
    } else {
        ex = managerState.exercises[idx];
        managerState.editingTimerEx = { idx, internalIdx: null };
    }

    document.getElementById('ex-settings-title').innerText = ex.name;
    document.getElementById('target-weight-input').value = ex.targetWeight || "";
    document.getElementById('target-reps-input').value = ex.targetReps || "";
    document.getElementById('target-rir-input').value = ex.targetRIR || "";

    const time = ex.restTime || (ex.isMain ? 120 : 90);
    document.getElementById('rest-time-display').innerText = time + "s";

    document.getElementById('exercise-settings-modal').style.display = 'flex';
}

function changeRestTime(delta) {
    const display = document.getElementById('rest-time-display');
    let current = parseInt(display.innerText.replace('s', ''));
    current += delta;
    if (current < 0) current = 0;
    display.innerText = current + "s";
}

function saveExerciseSettings() {
    const val = parseInt(document.getElementById('rest-time-display').innerText.replace('s', ''));
    const tWeight = parseFloat(document.getElementById('target-weight-input').value);
    const tReps = parseInt(document.getElementById('target-reps-input').value);
    const tRIR = parseFloat(document.getElementById('target-rir-input').value);

    const { idx, internalIdx } = managerState.editingTimerEx;
    const targetEx = internalIdx !== null
        ? managerState.exercises[idx].exercises[internalIdx]
        : managerState.exercises[idx];

    targetEx.restTime = val;
    targetEx.targetWeight = isNaN(tWeight) ? undefined : tWeight;
    targetEx.targetReps = isNaN(tReps) ? undefined : tReps;
    targetEx.targetRIR = isNaN(tRIR) ? undefined : tRIR;

    closeExerciseSettings();
    renderEditorList();
}

function closeExerciseSettings() { document.getElementById('exercise-settings-modal').style.display = 'none'; managerState.editingTimerEx = null; }

// ─── SMART EXERCISE SELECTOR ───────────────────────────────────────────────

function openExerciseSelector() { managerState.activeClusterRef = null; prepareSelector(); }
function openExerciseSelectorForCluster(clusterIdx) { managerState.activeClusterRef = clusterIdx; prepareSelector(); }

function prepareSelector() {
    document.getElementById('selector-search').value = "";
    managerState.selectorFilter = 'all';
    updateSelectorChips();
    renderSelectorList();
    navigate('ui-exercise-selector');
}

function setSelectorFilter(filter, btn) { managerState.selectorFilter = filter; updateSelectorChips(); renderSelectorList(); }

function updateSelectorChips() {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    const btns = document.querySelectorAll('#ui-exercise-selector .chip');
    btns.forEach(b => { if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${managerState.selectorFilter}'`)) b.classList.add('active'); });
}

function filterSelector() { renderSelectorList(); }

function renderSelectorList() {
    const list = document.getElementById('selector-list'); list.innerHTML = "";
    const searchVal = document.getElementById('selector-search').value.toLowerCase();

    const filtered = state.exercises.filter(ex => {
        const matchesFilter = managerState.selectorFilter === 'all' || ex.muscles.includes(managerState.selectorFilter);
        const matchesSearch = ex.name.toLowerCase().includes(searchVal);
        return matchesFilter && matchesSearch;
    });

    filtered.forEach(ex => {
        const row = document.createElement('div');
        row.className = "selector-item-row";

        row.innerHTML = `
            <div class="selector-item-info" onclick="selectExerciseFromList('${ex.name.replace(/'/g, "\\'")}')">${ex.name}</div>
            <div class="selector-item-actions">
                <button class="btn-text-edit" onclick="openExerciseEditor('${ex.name.replace(/'/g, "\\'")}')">ערוך</button>
            </div>
        `;
        list.appendChild(row);
    });
}

function selectExerciseFromList(exName) {
    const newExObj = { name: exName, isMain: false, sets: 3, restTime: 90 };
    if (managerState.activeClusterRef !== null) {
        newExObj.restTime = 30;
        managerState.exercises[managerState.activeClusterRef].exercises.push(newExObj);
    } else {
        managerState.exercises.push(newExObj);
    }

    state.historyStack.pop();
    navigate('ui-workout-editor');
    renderEditorList();
}

// ─── IMPORT / EXPORT ───────────────────────────────────────────────────────

function exportData() {
    const data = StorageManager.getAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gympro_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function triggerImport() { document.getElementById('import-file').click(); }

function importData(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            StorageManager.restoreData(data);
            showAlert("הנתונים יובאו בהצלחה!", () => { window.location.reload(); });
        } catch (err) {
            showAlert("שגיאה בקריאת הקובץ");
        }
    };
    reader.readAsText(file);
    input.value = "";
}

function triggerConfigImport() { document.getElementById('import-config-file').click(); }

function processConfigImport(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            StorageManager.importConfiguration(data);
        } catch (err) {
            showAlert("שגיאה בקריאת קובץ התבנית");
        }
    };
    reader.readAsText(file);
    input.value = "";
}

// ─── ARCHIVE HELPERS ───────────────────────────────────────────────────────

function openArchiveFromDrawer(timestamp) {
    closeDayDrawer();
    setTimeout(() => {
        const archive = StorageManager.getArchive();
        const idx = archive.findIndex(a => a.timestamp === timestamp);
        if (idx !== -1) openArchiveDetail(idx);
    }, 350);
}

// ─── WORKOUT COLOR SELECTION ───────────────────────────────────────────────

const WORKOUT_COLORS = [
    { hex: '#0A84FF', name: 'Cobalt'   },
    { hex: '#30D158', name: 'Emerald'  },
    { hex: '#FF9F0A', name: 'Amber'    },
    { hex: '#FF6B6B', name: 'Coral'    },
    { hex: '#5AC8FA', name: 'Teal'     },
    { hex: '#5E5CE6', name: 'Indigo'   },
    { hex: '#98989D', name: 'Graphite' }
];

let _selectedEditorColor = '';

function selectEditorColor(hex, el) {
    _selectedEditorColor = hex;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    if (el) el.classList.add('active');
}

function _renderColorSwatches(currentColor) {
    _selectedEditorColor = currentColor || '';
    const container = document.getElementById('editor-color-swatches');
    if (!container) return;
    container.innerHTML = '';
    WORKOUT_COLORS.forEach(c => {
        const sw = document.createElement('div');
        sw.className = 'color-swatch' + (c.hex === _selectedEditorColor ? ' active' : '');
        sw.style.background = c.hex;
        sw.title = c.name;
        sw.onclick = () => selectEditorColor(c.hex, sw);
        container.appendChild(sw);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE CONFIG UI  (v14.11.0)
// ─────────────────────────────────────────────────────────────────────────────

function openFirebaseConfigModal() {
    const cfg = FirebaseManager.getFirebaseConfig() || {};
    const ta = document.getElementById('fb-config-paste');
    if (ta) {
        if (cfg.apiKey) {
            // הצג את הקונפיג הקיים בפורמט קריא
            ta.value = `const firebaseConfig = {\n  apiKey: "${cfg.apiKey}",\n  authDomain: "${cfg.authDomain || ''}",\n  projectId: "${cfg.projectId || ''}",\n  storageBucket: "${cfg.storageBucket || ''}",\n  messagingSenderId: "${cfg.messagingSenderId || ''}",\n  appId: "${cfg.appId || ''}"\n};`;
        } else {
            ta.value = '';
        }
    }
    const btnClear = document.getElementById('btn-clear-firebase');
    if (btnClear) btnClear.style.display = FirebaseManager.isConfigured() ? '' : 'none';
    document.getElementById('firebase-config-modal').style.display = 'flex';
}

function closeFirebaseConfigModal() {
    document.getElementById('firebase-config-modal').style.display = 'none';
}

function saveFirebaseConfig() {
    const raw = (document.getElementById('fb-config-paste').value || '').trim();
    if (!raw) { showAlert('יש להדביק את בלוק ה-firebaseConfig.'); return; }

    // חילוץ תוכן ה-object מתוך הטקסט — תומך בפורמט const firebaseConfig = {...} וגם ב-{...} ישיר
    let jsonStr = raw;
    // הסר const firebaseConfig = ו-; בסוף אם קיימים
    jsonStr = jsonStr.replace(/^[\s\S]*?=\s*/, '').replace(/;?\s*$/, '').trim();
    // המר מ-JS object literal ל-JSON: הוסף מרכאות למפתחות
    jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    // המר single quotes ל-double quotes בערכים
    jsonStr = jsonStr.replace(/:\s*'([^']*)'/g, ': "$1"');
    // הסר פסיק אחרון לפני סגירת סוגריים
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

    let cfg;
    try {
        cfg = JSON.parse(jsonStr);
    } catch(e) {
        showAlert('פורמט לא תקין. ודא שהדבקת את הבלוק המלא מ-Firebase Console.');
        return;
    }

    if (!cfg.apiKey || !cfg.projectId) {
        showAlert('חסרים apiKey או projectId. ודא שהדבקת את הבלוק המלא.');
        return;
    }

    FirebaseManager.saveFirebaseConfig(cfg);
    FirebaseManager._initialized = false;
    FirebaseManager._db = null;
    closeFirebaseConfigModal();
    updateFirebaseStatus();
    showAlert('חיבור Firebase נשמר! בצע רענון לאפליקציה כדי להפעיל.');
}

function confirmClearFirebase() {
    showConfirm('לנתק את Firebase ולמחוק את פרטי החיבור?', () => {
        FirebaseManager.clearFirebaseConfig();
        closeFirebaseConfigModal();
        updateFirebaseStatus();
    });
}

function updateFirebaseStatus() {
    const el = document.getElementById('firebase-status');
    if (!el) return;
    if (FirebaseManager.isConfigured()) {
        const cfg = FirebaseManager.getFirebaseConfig();
        el.innerHTML = `<span style="color:var(--type-b);font-weight:700;">&#9679; מחובר</span> <span style="color:var(--text-dim);font-size:0.85em;">${cfg.projectId}</span>`;
    } else {
        el.innerHTML = '<span style="color:var(--text-dim);">&#9679; לא מוגדר</span>';
    }
}

// ─── גיבוי ידני (מקומי + ענן) ────────────────────────────────────────────────

function manualBackupArchive() {
    // גיבוי מקומי
    const data = StorageManager.getAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gympro_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    // גיבוי ענן
    if (FirebaseManager.isConfigured()) {
        FirebaseManager.saveArchiveToCloud().then(ok => {
            showAlert(ok ? 'גיבוי הורד + הועלה לענן!' : 'גיבוי הורד. שגיאה בשמירה לענן.');
        });
    } else {
        showAlert('גיבוי הורד מקומית! (Firebase לא מוגדר)');
    }
}

function manualBackupConfig() {
    // גיבוי מקומי (קונפיג)
    StorageManager.exportConfiguration();
    // גיבוי ענן
    if (FirebaseManager.isConfigured()) {
        FirebaseManager.saveConfigToCloud().then(ok => {
            showAlert(ok ? 'קונפיג הורד + הועלה לענן!' : 'קונפיג הורד. שגיאה בשמירה לענן.');
        });
    } else {
        showAlert('קונפיג הורד מקומית! (Firebase לא מוגדר)');
    }
}

function saveWorkoutManagerToCloud() {
    if (!FirebaseManager.isConfigured()) {
        showAlert('Firebase לא מוגדר. הגדר חיבור בהגדרות.');
        return;
    }
    FirebaseManager.saveConfigToCloud().then(ok => {
        showAlert(ok ? 'הקונפיגורציה נשמרה בענן!' : 'שגיאה בשמירה לענן. בדוק חיבור.');
    });
}

// ─── בדיקת עדכון גרסה ──────────────────────────────────────────────────────

async function checkForUpdate() {
    try {
        // cache-bust → עוקף את ה-SW cache ומביא את הגרסה האחרונה מהשרת
        const res = await fetch('./version.json?t=' + Date.now());
        if (!res.ok) throw new Error('network error');
        const data = await res.json();
        // הגרסה המותקנת כרגע — נטענה ב-window.onload ישירות מה-SW cache
        const currentVersion = window._gymproVersion || '';
        if (data.version && currentVersion && data.version !== currentVersion) {
            showConfirm(
                `עדכון זמין! (${currentVersion} → ${data.version}). לנקות cache ולרענן?`,
                async () => {
                    if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(k => caches.delete(k)));
                    }
                    window.location.reload(true);
                }
            );
        } else {
            showAlert('האפליקציה מעודכנת (v' + (currentVersion || data.version) + ')');
        }
    } catch(e) {
        showAlert('לא ניתן לבדוק עדכונים. בדוק חיבור לאינטרנט.');
    }
}

// קריאה ראשונית לסטטוס Firebase כשה-DOM מוכן
document.addEventListener('DOMContentLoaded', () => {
    updateFirebaseStatus();
});
