/**
 * GYMPRO ELITE - EDITOR & MANAGER LOGIC
 * Includes: Workout Editor, Exercise Database Manager, Settings, Workout Menu.
 */

// --- DYNAMIC MAIN MENU ---
function renderWorkoutMenu() {
    const container = document.getElementById('workout-menu-container');
    if(!container) return;
    
    container.innerHTML = "";
    const title = document.getElementById('workout-week-title');
    
    if (state.week === 'deload') {
        title.innerText = "שבוע דילואוד";
        const keys = Object.keys(state.workouts);
        const deloadWorkouts = keys.filter(k => {
             const meta = state.workoutMeta[k];
             return meta && meta.availableInDeload === true;
        });

        if(deloadWorkouts.length === 0) {
            container.innerHTML = `<p style="text-align:center; color:var(--text-dim);">בחר Freestyle או סמן תוכנית כדילואוד בעורך</p>`;
        } else {
             deloadWorkouts.forEach(key => {
                const btn = document.createElement('button');
                btn.className = "menu-card tall";
                const meta = state.workoutMeta[key];
                const badge = (meta && meta.isDeloadOnly) ? `<span style="font-size:0.7em; color:var(--type-free); border:1px solid var(--type-free); padding:2px 6px; border-radius:4px;">Deload Only</span>` : '';
                
                let count = 0;
                const w = state.workouts[key];
                if(Array.isArray(w)) {
                    w.forEach(item => { if(item.type === 'cluster') count += item.exercises.length; else count++; });
                }

                btn.innerHTML = `<div style="display:flex; justify-content:space-between; width:100%; align-items:center;"><h3>${key}</h3>${badge}</div><p>${count} תרגילים</p>`;
                btn.onclick = () => selectWorkout(key); // selectWorkout is in workout-core.js
                container.appendChild(btn);
             });
        }
    } else {
        title.innerText = `שבוע ${state.week} - בחר אימון`;
        Object.keys(state.workouts).forEach(key => {
            const meta = state.workoutMeta[key];
            if (meta && meta.isDeloadOnly) return; 

            const btn = document.createElement('button');
            btn.className = "menu-card tall";
            let count = 0;
            const w = state.workouts[key];
            if(Array.isArray(w)) {
                w.forEach(item => { if(item.type === 'cluster') count += item.exercises.length; else count++; });
            }
            btn.innerHTML = `<h3>${key}</h3><p>${count} תרגילים</p>`;
            btn.onclick = () => selectWorkout(key);
            container.appendChild(btn);
        });
    }
}

// --- WORKOUT MANAGER ---
function openWorkoutManager() { renderManagerList(); navigate('ui-workout-manager'); }

function renderManagerList() {
    const list = document.getElementById('manager-list'); list.innerHTML = "";
    const keys = Object.keys(state.workouts);
    if(keys.length === 0) { list.innerHTML = "<p style='text-align:center; color:var(--text-dim)'>אין תוכניות שמורות</p>"; return; }

    keys.forEach(key => {
        const wo = state.workouts[key];
        const el = document.createElement('div');
        el.className = "manager-item";
        el.onclick = () => editWorkout(key); 
        let count = 0;
        if(Array.isArray(wo)) {
             wo.forEach(item => { if(item.type === 'cluster') count += item.exercises.length; else count++; });
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

function deleteWorkout(key) {
    if(confirm(`האם למחוק את תוכנית ${key}?`)) {
        delete state.workouts[key];
        if (state.workoutMeta[key]) delete state.workoutMeta[key];
        
        StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);
        StorageManager.saveData(StorageManager.KEY_META, state.workoutMeta);
        
        renderManagerList(); renderWorkoutMenu(); 
    }
}

function duplicateWorkout(key) {
    const newName = key + " Copy";
    if (state.workouts[newName]) { alert("שם התוכנית כבר קיים"); return; }
    const source = state.workouts[key];
    const copy = JSON.parse(JSON.stringify(source));
    
    if (state.workoutMeta[key]) {
        state.workoutMeta[newName] = JSON.parse(JSON.stringify(state.workoutMeta[key]));
        StorageManager.saveData(StorageManager.KEY_META, state.workoutMeta);
    }
    
    state.workouts[newName] = copy;
    StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);
    renderManagerList(); renderWorkoutMenu();
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
    renderEditorList();
    navigate('ui-workout-editor');
}

// --- EXERCISE MANAGER (CREATE / EDIT) ---
function openExerciseCreator() {
    document.getElementById('ex-config-title').innerText = "יצירת תרגיל חדש";
    document.getElementById('conf-ex-name').value = "";
    document.getElementById('conf-ex-muscle').value = "חזה";
    document.getElementById('conf-ex-base').value = "";
    document.getElementById('conf-ex-step').value = "2.5";
    document.getElementById('conf-ex-min').value = "";
    document.getElementById('conf-ex-max').value = "";
    document.getElementById('conf-ex-uni').checked = false; 
    
    document.getElementById('btn-delete-ex').style.display = 'none';
    
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

    document.getElementById('btn-delete-ex').style.display = 'block';
    document.getElementById('ex-config-modal').dataset.mode = "edit";
    document.getElementById('ex-config-modal').dataset.target = exName;
    document.getElementById('ex-config-modal').style.display = 'flex';
}

// --- EXERCISE DATABASE MANAGER ---
function openExerciseDatabase() {
    managerState.dbFilter = 'all';
    document.querySelectorAll('#ui-exercise-db .chip').forEach(c => c.classList.remove('active'));
    document.querySelector('#ui-exercise-db .chip').classList.add('active');
    
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
    
    const sorted = [...state.exercises].sort((a,b) => a.name.localeCompare(b.name));
    
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
        list.innerHTML = `<p style="text-align:center; color:var(--text-dim); margin-top:20px;">לא נמצאו תרגילים</p>`;
        return;
    }

    filtered.forEach(ex => {
        const row = document.createElement('div');
        row.className = "selector-item-row";
        row.onclick = () => openExerciseEditor(ex.name);
        
        row.innerHTML = `
            <div class="selector-item-info">
                <div style="font-weight:600; font-size:1em;">${ex.name}</div>
                <div style="font-size:0.8em; color:var(--text-dim); margin-top:2px;">${ex.muscles.join(', ')}</div>
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

    if (!name) { alert("נא להזין שם תרגיל"); return; }

    let musclesArr = [muscleSelect];
    if (muscleSelect === 'יד קדמית') musclesArr = ['ידיים', 'biceps'];
    if (muscleSelect === 'יד אחורית') musclesArr = ['ידיים', 'triceps'];

    if (mode === 'create') {
        if (state.exercises.find(e => e.name === name)) { alert("שם תרגיל כבר קיים"); return; }
        
        const newEx = {
            name: name,
            muscles: musclesArr,
            step: step,
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
        alert("התרגיל נוצר בהצלחה!");
        
    } else {
        const targetName = document.getElementById('ex-config-modal').dataset.target;
        const exIndex = state.exercises.findIndex(e => e.name === targetName);
        if (exIndex === -1) return;

        if (targetName !== name) {
            if (state.exercises.find(e => e.name === name)) { alert("שם זה כבר קיים במערכת"); return; }
            
            if (confirm(`שינית את שם התרגיל מ-"${targetName}" ל-"${name}".\nהשינוי יעדכן את כל התוכניות הקיימות.\nהאם להמשיך?`)) {
                for (let key in state.workouts) {
                    const wo = state.workouts[key];
                    if (Array.isArray(wo)) {
                        wo.forEach(item => {
                            if (item.type === 'cluster') {
                                item.exercises.forEach(sub => { if(sub.name === targetName) sub.name = name; });
                            } else {
                                if(item.name === targetName) item.name = name;
                            }
                        });
                    }
                }
                StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);

                const lastW = StorageManager.getLastWeight(targetName);
                if(lastW) StorageManager.saveWeight(name, lastW);

                state.exercises[exIndex].name = name;
            } else {
                return; 
            }
        }

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
        closeExConfigModal();
    }

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
        alert(`לא ניתן למחוק את התרגיל!\nהוא נמצא בשימוש בתוכניות הבאות:\n- ${usedIn.join('\n- ')}\n\nיש להסיר אותו מהתוכניות קודם.`);
        return;
    }

    if (confirm(`האם למחוק את התרגיל "${targetName}" לצמיתות?`)) {
        const exIndex = state.exercises.findIndex(e => e.name === targetName);
        if (exIndex > -1) {
            state.exercises.splice(exIndex, 1);
            StorageManager.saveData(StorageManager.KEY_DB_EXERCISES, state.exercises);
            alert("התרגיל נמחק.");
            closeExConfigModal();
            renderExerciseDatabase();
        }
    }
}

function closeExConfigModal() {
    document.getElementById('ex-config-modal').style.display = 'none';
    document.getElementById('conf-ex-name').disabled = false; 
}

// --- WORKOUT EDITOR & CLUSTER SUPPORT ---
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
        setControls = `<span style="font-size:0.8em; color:var(--text-dim); margin:0 5px;">1RM</span>`;
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
    <div class="input-grid" style="grid-template-columns: 1fr 1fr; margin-bottom:10px;">
        <div class="glass-card compact" style="margin:0; padding:8px;">
            <label>מס' סבבים</label>
            <div class="set-selector" style="justify-content:center;">
                <button class="set-btn" onclick="changeClusterRounds(${idx}, -1)">-</button>
                <span class="set-val">${cluster.rounds}</span>
                <button class="set-btn" onclick="changeClusterRounds(${idx}, 1)">+</button>
            </div>
        </div>
        <div class="glass-card compact" style="margin:0; padding:8px;">
            <label>מנוחה בסוף סבב</label>
            <div class="set-selector" style="justify-content:center;">
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
        <div class="editor-row" style="padding: 8px; background:rgba(255,255,255,0.05);">
            <div class="row-info" onclick="openRestTimerModal(${idx}, ${internalIdx})">${internalIdx+1}. ${ex.name}</div>
            <div class="editor-controls">
                 <button class="control-icon-btn" style="width:24px; height:24px;" onclick="removeExFromCluster(${idx}, ${internalIdx})">✕</button>
            </div>
        </div>`;
    });

    html += `
        <button class="btn-text" style="font-size:0.8em; padding:8px; color:var(--type-free);" onclick="openExerciseSelectorForCluster(${idx})">+ הוסף תרגיל לסבב</button>
    </div>`;

    box.innerHTML = html;
    list.appendChild(box);
}

function toggleMainStatus(idx) { managerState.exercises[idx].isMain = !managerState.exercises[idx].isMain; renderEditorList(); }
function changeSetCount(idx, delta) { let current = managerState.exercises[idx].sets; current += delta; if(current < 1) current = 1; managerState.exercises[idx].sets = current; renderEditorList(); }
function moveExInEditor(idx, dir) { if(idx + dir < 0 || idx + dir >= managerState.exercises.length) return; const temp = managerState.exercises[idx]; managerState.exercises[idx] = managerState.exercises[idx + dir]; managerState.exercises[idx + dir] = temp; renderEditorList(); }
function removeExFromEditor(idx) { managerState.exercises.splice(idx, 1); renderEditorList(); }
function changeClusterRounds(idx, delta) { let val = managerState.exercises[idx].rounds + delta; if(val < 1) val = 1; managerState.exercises[idx].rounds = val; renderEditorList(); }
function changeClusterRest(idx, delta) { let val = managerState.exercises[idx].clusterRest + delta; if(val < 0) val = 0; managerState.exercises[idx].clusterRest = val; renderEditorList(); }
function addClusterToEditor() { managerState.exercises.push({ type: 'cluster', rounds: 3, clusterRest: 120, exercises: [] }); renderEditorList(); }
function removeExFromCluster(clusterIdx, exIdx) { managerState.exercises[clusterIdx].exercises.splice(exIdx, 1); renderEditorList(); }

function saveWorkoutChanges() {
    const newName = document.getElementById('editor-workout-name').value.trim();
    if (!newName) { alert("נא להזין שם לתוכנית"); return; }
    if (managerState.exercises.length === 0) { alert("התוכנית ריקה!"); return; }

    if (newName !== managerState.originalName) {
        if (state.workouts[newName]) { alert("שם תוכנית זה כבר קיים"); return; }
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

    StorageManager.saveData(StorageManager.KEY_META, state.workoutMeta);

    state.workouts[newName] = managerState.exercises;
    StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);
    
    haptic('success');
    
    state.historyStack.pop();
    navigate('ui-workout-manager');
    renderManagerList();
    renderWorkoutMenu(); 
}

// --- REST TIMER & DEFAULTS EDITING ---
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
    
    // Load Defaults
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
    if(current < 0) current = 0; 
    display.innerText = current + "s"; 
}

function saveExerciseSettings() {
    const val = parseInt(document.getElementById('rest-time-display').innerText.replace('s', ''));
    
    // Capture Defaults
    const tWeight = parseFloat(document.getElementById('target-weight-input').value);
    const tReps = parseInt(document.getElementById('target-reps-input').value);
    const tRIR = parseFloat(document.getElementById('target-rir-input').value);

    const { idx, internalIdx } = managerState.editingTimerEx;
    let targetEx;

    if (internalIdx !== null) {
        targetEx = managerState.exercises[idx].exercises[internalIdx];
    } else {
        targetEx = managerState.exercises[idx];
    }
    
    targetEx.restTime = val;
    targetEx.targetWeight = isNaN(tWeight) ? undefined : tWeight;
    targetEx.targetReps = isNaN(tReps) ? undefined : tReps;
    targetEx.targetRIR = isNaN(tRIR) ? undefined : tRIR;

    closeExerciseSettings(); 
    renderEditorList();
}

function closeExerciseSettings() { document.getElementById('exercise-settings-modal').style.display = 'none'; managerState.editingTimerEx = null; }
function openSettings() { navigate('ui-settings'); }
function resetToFactorySettings() { StorageManager.resetFactory(); }

// --- SMART EXERCISE SELECTOR ---
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
    btns.forEach(b => { if(b.getAttribute('onclick').includes(`'${managerState.selectorFilter}'`)) b.classList.add('active'); });
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
