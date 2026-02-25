/**
 * GYMPRO ELITE V12.12.4 (Refactored - Script Part 1)
 * - Logic Update: Intra-Workout Persistence (Last set in session wins).
 * - Architecture: Split into data.js, storage.js, script.js.
 */

// --- GLOBAL VARIABLES & STATE ---
// Note: defaultExercises, defaultWorkouts, substituteGroups, unilateralKeywords are loaded from data.js
// Note: StorageManager is loaded from storage.js

function getSubstitutes(exName) {
    const group = substituteGroups.find(g => g.includes(exName));
    return group ? group.filter(n => n !== exName) : [];
}

function isExOrVariationDone(originalName) {
    if (state.completedExInSession.includes(originalName)) return true;
    const group = substituteGroups.find(g => g.includes(originalName));
    if (group) {
        return group.some(varName => state.completedExInSession.includes(varName));
    }
    return false;
}

let state = {
    week: 1, type: '', rm: 100, exIdx: 0, setIdx: 0, 
    log: [], currentEx: null, currentExName: '',
    historyStack: ['ui-week'],
    timerInterval: null, seconds: 0, startTime: null,
    isFreestyle: false, isExtraPhase: false, isInterruption: false, 
    currentMuscle: '',
    completedExInSession: [],
    workoutStartTime: null, workoutDurationMins: 0,
    lastLoggedSet: null,
    lastWorkoutDetails: {},
    archiveView: 'list',
    calendarOffset: 0,
    editingIndex: -1,
    freestyleFilter: 'all',
    exercises: [],
    workouts: {},
    workoutMeta: {}, 
    
    // Cluster State
    clusterMode: false,
    activeCluster: null,
    clusterIdx: 0, 
    clusterRound: 1,
    lastClusterRest: 0
};

let managerState = {
    originalName: '',
    currentName: '',
    exercises: [],
    selectorFilter: 'all',
    dbFilter: 'all',
    activeClusterRef: null,
    editingTimerEx: null 
};

let audioContext;
let wakeLock = null;
let currentArchiveItem = null;
let selectedArchiveIds = new Set(); 

// --- INITIALIZATION ---
window.onload = () => {
    // StorageManager is defined in storage.js
    StorageManager.initDB();
    renderWorkoutMenu();
    checkRecovery();
};

function checkRecovery() {
    if (StorageManager.hasActiveSession()) {
        document.getElementById('recovery-modal').style.display = 'flex';
    }
}

function restoreSession() {
    const session = StorageManager.getSessionState();
    if (session && session.state) {
        state = session.state;
        if (session.managerState) managerState = session.managerState;
        
        document.getElementById('recovery-modal').style.display = 'none';
        
        let lastScreen = state.historyStack[state.historyStack.length - 1];
        if (['ui-muscle-select', 'ui-ask-arms', 'ui-arm-selection'].includes(lastScreen)) {
             if (lastScreen === 'ui-muscle-select') {
                 state.historyStack.pop();
                 state.historyStack.push('ui-variation');
                 lastScreen = 'ui-variation';
             } else {
                 state.historyStack.pop();
                 state.historyStack.push('ui-ask-extra');
                 lastScreen = 'ui-ask-extra';
             }
        }
        
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(lastScreen).classList.add('active');
        document.getElementById('global-back').style.visibility = (lastScreen === 'ui-week') ? 'hidden' : 'visible';
        
        switch (lastScreen) {
            case 'ui-main':
                initPickers();
                if (state.startTime && state.seconds > 0) {
                    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
                    let target = state.currentEx && state.currentEx.restTime ? state.currentEx.restTime : 90;
                    if (elapsed < target) {
                        document.getElementById('timer-area').style.visibility = 'visible';
                        resetAndStartTimer(target); 
                    } else {
                         document.getElementById('timer-area').style.visibility = 'visible';
                         document.getElementById('rest-timer').innerText = "00:00";
                         document.getElementById('timer-progress').style.strokeDashoffset = 0;
                         state.seconds = target;
                    }
                }
                break;
            case 'ui-cluster-rest': renderClusterRestUI(); break;
            case 'ui-confirm': showConfirmScreen(state.currentExName); break;
            case 'ui-swap-list': openSwapMenu(); break;
            case 'ui-workout-manager': renderManagerList(); break;
            case 'ui-workout-editor': openEditorUI(); break; 
            case 'ui-exercise-selector': document.getElementById('selector-search').value = ""; updateSelectorChips(); renderSelectorList(); break;
            case 'ui-1rm': setupCalculatedEx(); break;
            case 'ui-variation': 
                updateVariationUI();
                renderFreestyleChips();
                renderFreestyleList();
                break;
            case 'ui-exercise-db': renderExerciseDatabase(); break;
            case 'ui-archive': openArchive(); break;
        }
        haptic('success');
    } else {
        discardSession();
    }
}

function discardSession() {
    StorageManager.clearSessionState();
    document.getElementById('recovery-modal').style.display = 'none';
}

function haptic(type = 'light') {
    if (!("vibrate" in navigator)) return;
    try {
        if (type === 'light') navigator.vibrate(20); 
        else if (type === 'medium') navigator.vibrate(40);
        else if (type === 'success') navigator.vibrate([50, 50, 50]);
        else if (type === 'warning') navigator.vibrate([30, 30]);
    } catch(e) {}
}

function playBeep(times = 1) {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    for (let i = 0; i < times; i++) {
        setTimeout(() => {
            const o = audioContext.createOscillator();
            const g = audioContext.createGain();
            o.type = 'sine'; o.frequency.setValueAtTime(880, audioContext.currentTime);
            g.gain.setValueAtTime(0.3, audioContext.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            o.connect(g); g.connect(audioContext.destination);
            o.start(); o.stop(audioContext.currentTime + 0.4);
        }, i * 500);
    }
}

async function initAudio() {
    haptic('medium');
    playBeep(1);
    const btn = document.getElementById('audio-init-btn');
    btn.innerHTML = `<div class="card-text center-text">מנוע סאונד פעיל</div>`;
    btn.style.background = "var(--success-gradient)";
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (err) {}
}

function navigate(id, clearStack = false) {
    haptic('light');
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    if (id !== 'ui-main') stopRestTimer();

    if (clearStack) {
        state.historyStack = [id];
    } else {
        if (state.historyStack[state.historyStack.length - 1] !== id) state.historyStack.push(id);
    }
    
    document.getElementById('global-back').style.visibility = (id === 'ui-week') ? 'hidden' : 'visible';
    const settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn) settingsBtn.style.visibility = (id === 'ui-week') ? 'visible' : 'hidden';
}

function handleBackClick() {
    haptic('warning');
    if (state.historyStack.length <= 1) return;

    const currentScreen = state.historyStack[state.historyStack.length - 1];

    // Guard Layer
    if (currentScreen === 'ui-main') {
        if (state.isFreestyle && state.setIdx === 0 && state.log.length === 0) {
            // pass
        } 
        else if (state.setIdx > 0) {
            if(confirm("חזרה אחורה תמחק את הסט הנוכחי. להמשיך?")) {
               state.setIdx--;
               initPickers();
               StorageManager.saveSessionState();
               return; 
            }
            return; 
        } else {
            stopRestTimer();
            state.historyStack.pop(); 
            navigate('ui-confirm');
            return;
        }
    }

    if (currentScreen === 'ui-variation') {
        if ((state.isFreestyle || state.isInterruption || state.isExtraPhase) && state.log.length > 0) {
            if(!confirm("האם לצאת מהאימון? (הנתונים שלא נשמרו בארכיון יאבדו)")) return;
            StorageManager.clearSessionState();
        }
        state.isInterruption = false;
        state.isExtraPhase = false;
    }

    if (currentScreen === 'ui-confirm') {
        if (state.log.length > 0 || state.completedExInSession.length > 0) {
            if(confirm("האם לצאת מהאימון?")) StorageManager.clearSessionState();
            else return; 
        }
    }

    if (currentScreen === 'ui-cluster-rest') {
        if(!confirm("האם לצאת ממצב Cluster?")) return;
        state.clusterMode = false;
    }

    if (currentScreen === 'ui-workout-editor') { 
        if(confirm("לצאת ללא שמירה?")) { 
            state.historyStack.pop(); 
            navigate('ui-workout-manager'); 
            return;
        }
        return; 
    }

    if (currentScreen === 'ui-exercise-selector') {
        document.getElementById('selector-search').value = "";
    }

    // Navigation Layer
    state.historyStack.pop();
    const prevScreen = state.historyStack[state.historyStack.length - 1];
    
    // Refresh Layer
    if (prevScreen === 'ui-variation') {
        updateVariationUI(); 
        renderFreestyleChips();
        renderFreestyleList();
    }

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(prevScreen).classList.add('active');
    
    document.getElementById('global-back').style.visibility = (prevScreen === 'ui-week') ? 'hidden' : 'visible';
    const settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn) settingsBtn.style.visibility = (prevScreen === 'ui-week') ? 'visible' : 'hidden';
}

function openSettings() { navigate('ui-settings'); }
function resetToFactorySettings() { StorageManager.resetFactory(); }

// --- DYNAMIC MAIN MENU & DELOAD LOGIC ---
function renderWorkoutMenu() {
    const container = document.getElementById('workout-menu-container');
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
                btn.onclick = () => selectWorkout(key);
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

// --- WORKOUT FLOW ENGINE ---
function selectWeek(w) { 
    state.week = w; 
    renderWorkoutMenu(); 
    navigate('ui-workout-type'); 
}

function selectWorkout(t) {
    state.type = t; state.exIdx = 0; state.log = []; 
    state.completedExInSession = []; state.isFreestyle = false; state.isExtraPhase = false; state.isInterruption = false;
    state.workoutStartTime = Date.now();
    state.clusterMode = false;
    checkFlow(); 
}

function checkFlow() {
    const workoutList = state.workouts[state.type];
    
    if (state.exIdx >= workoutList.length) {
        navigate('ui-ask-extra');
        StorageManager.saveSessionState();
        return;
    }

    const item = workoutList[state.exIdx];

    if (item.type === 'cluster') {
        state.clusterMode = true;
        state.activeCluster = JSON.parse(JSON.stringify(item)); 
        state.clusterIdx = 0;
        state.clusterRound = 1;
        state.lastClusterRest = 30;
        showConfirmScreen();
    } else {
        state.clusterMode = false;
        state.activeCluster = null;
        if (isExOrVariationDone(item.name)) {
            state.exIdx++;
            checkFlow(); 
        } else {
            showConfirmScreen();
        }
    }
}

function showConfirmScreen(forceExName = null) {
    if (state.clusterMode && state.clusterIdx === 0 && !forceExName) {
        document.getElementById('confirm-ex-name').innerText = "סבב / מעגל (Cluster)";
        document.getElementById('confirm-ex-config').innerText = `סבב ${state.clusterRound} מתוך ${state.activeCluster.rounds}`;
        document.getElementById('confirm-ex-config').style.display = 'block';

        const historyContainer = document.getElementById('history-container');
        let listHtml = `<div class="vertical-stack" style="text-align:right; margin: 20px 0;">`;
        state.activeCluster.exercises.forEach((ex, i) => {
            listHtml += `<div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; margin-bottom:5px;">${i+1}. ${ex.name}</div>`;
        });
        listHtml += `</div>`;
        historyContainer.innerHTML = listHtml;
        
        document.querySelector('.secondary-buttons-grid').style.display = 'none';
        navigate('ui-confirm');
        StorageManager.saveSessionState();
        return;
    }

    document.querySelector('.secondary-buttons-grid').style.display = 'grid';

    let exName = forceExName;
    let currentPlanItem = null;

    if (!exName) {
        if (state.clusterMode) {
            currentPlanItem = state.activeCluster.exercises[state.clusterIdx];
        } else {
            currentPlanItem = state.workouts[state.type][state.exIdx];
        }
        exName = currentPlanItem.name;
    }
    
    const exData = state.exercises.find(e => e.name === exName);
    if (!exData) { alert("שגיאה: התרגיל לא נמצא במאגר."); return; }

    state.currentEx = JSON.parse(JSON.stringify(exData));
    state.currentExName = exData.name;
    
    // Copy Plan Defaults to currentEx state for this session
    if (currentPlanItem) {
        if (currentPlanItem.restTime) state.currentEx.restTime = currentPlanItem.restTime;
        if (currentPlanItem.targetWeight) state.currentEx.targetWeight = currentPlanItem.targetWeight;
        if (currentPlanItem.targetReps) state.currentEx.targetReps = currentPlanItem.targetReps;
        if (currentPlanItem.targetRIR) state.currentEx.targetRIR = currentPlanItem.targetRIR;
    }

    document.getElementById('confirm-ex-name').innerText = exData.name;
    const configDiv = document.getElementById('confirm-ex-config');
    
    if (state.clusterMode) {
        configDiv.innerHTML = `חלק מסבב (${state.clusterRound}/${state.activeCluster.rounds})`;
        configDiv.style.display = 'block';
    } else if (currentPlanItem) {
        if (currentPlanItem.isMain) configDiv.innerHTML = "MAIN (מחושב 1RM)";
        else configDiv.innerHTML = `תוכנית: ${currentPlanItem.sets} סטים`;
        configDiv.style.display = 'block';
    } else {
        configDiv.style.display = 'none';
    }

    const swapBtn = document.getElementById('btn-swap-confirm');
    const addBtn = document.getElementById('btn-add-exercise');
    
    if (!state.isFreestyle && !state.isExtraPhase && !state.isInterruption) {
        swapBtn.style.visibility = 'visible';
        addBtn.style.visibility = 'visible'; 
    } else {
        swapBtn.style.visibility = 'hidden'; 
        addBtn.style.visibility = 'hidden'; 
    }

    const historyContainer = document.getElementById('history-container');
    historyContainer.innerHTML = "";
    
    const history = getLastPerformance(exName);
    
    if (history) {
        let rowsHtml = "";
        history.sets.forEach((setStr, idx) => {
            let weight = "-", reps = "-", rir = "-";
            try {
                const parts = setStr.split('x');
                if(parts.length > 1) {
                    weight = parts[0].replace('kg', '').trim();
                    const rest = parts[1];
                    const rirMatch = rest.match(/\(RIR (.*?)\)/);
                    reps = rest.split('(')[0].trim();
                    if(rirMatch) rir = rirMatch[1];
                }
            } catch(e) {}

            rowsHtml += `
            <div class="history-row">
                <div class="history-col set-idx">#${idx + 1}</div>
                <div class="history-col">${weight}</div>
                <div class="history-col">${reps}</div>
                <div class="history-col rir-note">${rir}</div>
            </div>`;
        });

        const gridHtml = `
        <div class="history-card-container">
            <div style="font-size:0.85em; color:var(--text-dim); text-align:right; margin-bottom:10px;">📅 ביצוע אחרון: ${history.date}</div>
            <div class="history-header">
                <div>סט</div>
                <div>משקל</div>
                <div>חזרות</div>
                <div>RIR</div>
            </div>
            <div class="history-list">${rowsHtml}</div>
        </div>
        `;
        historyContainer.innerHTML = gridHtml;
    }

    navigate('ui-confirm');
    StorageManager.saveSessionState();
}

function getLastPerformance(exName) {
    const archive = StorageManager.getArchive();
    for (const item of archive) {
        if (item.week === 'deload') continue;
        if (item.details && item.details[exName]) {
            return { date: item.date, sets: item.details[exName].sets };
        }
    }
    return null;
}

function confirmExercise(doEx) {
    if (state.clusterMode && state.clusterIdx === 0 && document.getElementById('confirm-ex-name').innerText.includes("Cluster")) {
        const firstExItem = state.activeCluster.exercises[0];
        const exData = state.exercises.find(e => e.name === firstExItem.name);
        
        state.currentEx = JSON.parse(JSON.stringify(exData));
        state.currentExName = exData.name;
        
        if(firstExItem.restTime) state.currentEx.restTime = firstExItem.restTime;
        if(firstExItem.targetWeight) state.currentEx.targetWeight = firstExItem.targetWeight;
        if(firstExItem.targetReps) state.currentEx.targetReps = firstExItem.targetReps;
        if(firstExItem.targetRIR) state.currentEx.targetRIR = firstExItem.targetRIR;

        resizeSets(1);
        startRecording();
        return;
    }

    if (!doEx) { 
        state.log.push({ skip: true, exName: state.currentExName }); 
        if(!state.clusterMode) state.completedExInSession.push(state.currentExName); 
        finishCurrentExercise(); 
        return; 
    }
    
    let isMain = state.currentEx.isCalc; 
    let targetSets = null;

    if (!state.isFreestyle && !state.isExtraPhase && !state.isInterruption) {
        if (state.clusterMode) {
             targetSets = 1;
             isMain = false;
        } else {
            const planItem = state.workouts[state.type][state.exIdx];
            if (planItem) {
                isMain = planItem.isMain;
                targetSets = planItem.sets;
            }
        }
    }

    if (isMain) {
        state.currentEx.isCalc = true; 
        setupCalculatedEx(); 
    } else {
        if (targetSets && targetSets > 0) resizeSets(targetSets);
        startRecording();
    }
}

function resizeSets(count) {
    const defaultReps = (state.currentEx.sets && state.currentEx.sets[0]) ? state.currentEx.sets[0].r : 10;
    const defaultWeight = (state.currentEx.sets && state.currentEx.sets[0]) ? state.currentEx.sets[0].w : 10;
    state.currentEx.sets = Array(count).fill({w: defaultWeight, r: defaultReps});
}

function setupCalculatedEx() {
    document.getElementById('rm-title').innerText = `${state.currentExName} 1RM`;
    const lastRM = StorageManager.getLastRM(state.currentExName);
    const baseRM = state.currentEx.baseRM || 50; 
    const p = document.getElementById('rm-picker'); p.innerHTML = "";
    const defaultRM = lastRM ? lastRM : baseRM;
    for(let i = 20; i <= 200; i += 2.5) {
        let o = new Option(i + " kg", i); if(i === defaultRM) o.selected = true; p.add(o);
    }
    navigate('ui-1rm');
    StorageManager.saveSessionState();
}

function save1RM() {
    state.rm = parseFloat(document.getElementById('rm-picker').value);
    StorageManager.saveRM(state.currentExName, state.rm);
    let percentages = []; let reps = [];
    const w = parseInt(state.week);
    if (w === 1) { percentages = [0.65, 0.75, 0.85, 0.75, 0.65]; reps = [5, 5, 5, 8, 10]; } 
    else if (w === 2) { percentages = [0.70, 0.80, 0.90, 0.80, 0.70, 0.70]; reps = [3, 3, 3, 8, 10, 10]; } 
    else if (w === 3) { percentages = [0.75, 0.85, 0.95, 0.85, 0.75, 0.75]; reps = [5, 3, 1, 8, 10, 10]; }
    else { percentages = [0.65, 0.75, 0.85, 0.75, 0.65]; reps = [5, 5, 5, 8, 10]; }
    state.currentEx.sets = percentages.map((pct, i) => ({ w: Math.round((state.rm * pct) / 2.5) * 2.5, r: reps[i] }));
    startRecording();
}

function startRecording() { 
    // Logic to determine if we are continuing sets of same ex (not intra-workout repeat yet)
    // Only used to determine setIdx inside the *current* block
    const existingLogs = state.log.filter(l => l.exName === state.currentExName && !l.skip && !l.isWarmup);
    
    // Note: If we are in Cluster mode, we might want to check only logs from *current round*.
    // However, the requested logic is about Intra-Workout persistence.
    // We handle the "Picker Initialization" in initPickers().

    if (existingLogs.length > 0 && !state.clusterMode) {
        // If not cluster, we might be resuming sets
         state.setIdx = existingLogs.length;
         state.lastLoggedSet = existingLogs[existingLogs.length - 1];
    } else {
        state.setIdx = 0; 
        state.lastLoggedSet = null; 
    }

    document.getElementById('action-panel').style.display = 'none';
    document.getElementById('btn-submit-set').style.display = 'block';
    
    navigate('ui-main'); 
    initPickers(); 
    StorageManager.saveSessionState();
}

function isUnilateral(exName) {
    const exData = state.exercises.find(e => e.name === exName);
    if (exData && exData.isUnilateral !== undefined) {
        return exData.isUnilateral;
    }
    return unilateralKeywords.some(keyword => exName.includes(keyword));
}

// --- INIT PICKERS (UPDATED LOGIC) ---
function initPickers() {
    document.getElementById('ex-display-name').innerText = state.currentExName;
    const exHeader = document.querySelector('.exercise-header');
    const existingQueue = document.querySelector('.cluster-queue-container');
    if (existingQueue) existingQueue.remove();

    if (state.clusterMode) {
        const queueDiv = document.createElement('div');
        queueDiv.className = 'cluster-queue-container';
        let queueHtml = `<div class="queue-title">בהמשך הסבב:</div>`;
        let foundNext = false;
        for (let i = state.clusterIdx + 1; i < state.activeCluster.exercises.length; i++) {
            const exName = state.activeCluster.exercises[i].name;
            const isNext = !foundNext;
            queueHtml += `<div class="queue-item ${isNext ? 'next' : ''}">${isNext ? '• הבא: ' : ''}${exName}</div>`;
            foundNext = true;
        }
        if (!foundNext) queueHtml += `<div class="queue-item">--- סוף סבב ---</div>`;
        queueDiv.innerHTML = queueHtml;
        exHeader.parentNode.insertBefore(queueDiv, exHeader.nextSibling);
    }

    const badge = document.getElementById('set-counter');
    if (state.clusterMode) {
        badge.innerText = `ROUND ${state.clusterRound}/${state.activeCluster.rounds}`;
        badge.style.background = "var(--type-free)";
    } else {
        badge.innerText = `SET ${state.setIdx + 1}/${state.currentEx.sets.length}`;
        badge.style.background = "var(--accent)";
    }

    const target = state.currentEx.sets[state.setIdx];
    document.getElementById('set-notes').value = '';
    
    // --- DETERMINE DEFAULTS (NEW LOGIC) ---
    // Variables for the picker values
    let defaultW = 0;
    let defaultR = 8;
    let defaultRIR = 2;

    // 1. Check Previous Sets in CURRENT Block (Highest Priority if > set 1)
    if (state.setIdx > 0 && state.lastLoggedSet) {
        defaultW = state.lastLoggedSet.w;
        defaultR = state.lastLoggedSet.r;
        defaultRIR = state.lastLoggedSet.rir;
    }
    // 2. Main / Calculated Logic (Guard Clause)
    else if (state.currentEx.isCalc) {
        defaultW = target.w;
        defaultR = target.r;
        defaultRIR = 2; // Default for main unless specified
    }
    else {
        // 3. Intra-Workout Persistence (New Feature)
        // Check if this exercise was done previously in THIS session (e.g. in previous cluster round)
        const sessionHistory = state.log.filter(l => l.exName === state.currentExName && !l.skip && !l.isWarmup);
        
        if (sessionHistory.length > 0) {
            const lastSessionEntry = sessionHistory[sessionHistory.length - 1];
            defaultW = lastSessionEntry.w;
            defaultR = lastSessionEntry.r;
            defaultRIR = lastSessionEntry.rir;
        } 
        else {
            // 4. Plan Defaults (Target Weight/Reps/RIR from Editor)
            let planW = state.currentEx.targetWeight;
            let planR = state.currentEx.targetReps;
            let planRIR = state.currentEx.targetRIR;

            // 5. Global History / Manual Defaults
            const savedWeight = StorageManager.getLastWeight(state.currentExName);
            const manualRange = state.currentEx.manualRange || {};

            // Weight Logic
            if (planW !== undefined) {
                defaultW = planW;
            } else if (savedWeight) {
                defaultW = savedWeight;
            } else if (target && target.w) {
                defaultW = target.w;
            } else if (manualRange.base) {
                defaultW = manualRange.base;
            }

            // Reps Logic
            if (planR !== undefined) {
                defaultR = planR;
            } else if (target && target.r) {
                defaultR = target.r;
            }

            // RIR Logic
            if (planRIR !== undefined) {
                defaultRIR = planRIR;
            }
        }
    }

    // --- UI RENDERING ---
    
    const hist = document.getElementById('last-set-info');
    if (state.lastLoggedSet) {
        hist.innerText = `סט אחרון: ${state.lastLoggedSet.w}kg x ${state.lastLoggedSet.r} (RIR ${state.lastLoggedSet.rir})`;
        hist.style.display = 'block';
    } else hist.style.display = 'none';
    
    document.getElementById('unilateral-note').style.display = isUnilateral(state.currentExName) ? 'block' : 'none';
    document.getElementById('btn-warmup').style.display = (state.setIdx === 0 && !state.clusterMode && ["Squat", "Deadlift", "Bench", "Overhead"].some(k => state.currentExName.includes(k))) ? 'block' : 'none';
    
    const timerArea = document.getElementById('timer-area');
    if (state.clusterMode && state.timerInterval) {
        timerArea.style.visibility = 'visible';
    } else if (state.setIdx > 0 && document.getElementById('action-panel').style.display === 'none') { 
        timerArea.style.visibility = 'visible'; 
    } else { 
        timerArea.style.visibility = 'hidden'; 
        if (!state.clusterMode) stopRestTimer(); 
    }

    const skipBtn = document.getElementById('btn-skip-exercise');
    const finishRoundBtn = document.getElementById('btn-finish-round');

    if (state.clusterMode) {
        skipBtn.style.display = 'block';
        finishRoundBtn.style.display = 'block';
    } else {
        finishRoundBtn.style.display = 'none';
        skipBtn.style.display = (state.setIdx === 0) ? 'none' : 'block';
    }

    // --- WEIGHT PICKER ---
    const wPick = document.getElementById('weight-picker'); wPick.innerHTML = "";
    const manualRange = state.currentEx.manualRange || {};
    const step = state.currentEx.step || 2.5;
    
    let minW = manualRange.min !== undefined ? manualRange.min : (state.currentEx.minW !== undefined ? state.currentEx.minW : Math.max(0, defaultW - 40));
    let maxW = manualRange.max !== undefined ? manualRange.max : (state.currentEx.maxW !== undefined ? state.currentEx.maxW : defaultW + 50);
    if (minW < 0) minW = 0;

    for(let i = minW; i <= maxW; i = parseFloat((i + step).toFixed(2))) {
        let o = new Option(i + " kg", i); if(i === defaultW) o.selected = true; wPick.add(o);
    }
    
    // --- REPS PICKER ---
    const rPick = document.getElementById('reps-picker'); rPick.innerHTML = "";
    for(let i = 1; i <= 30; i++) { let o = new Option(i, i); if(i === defaultR) o.selected = true; rPick.add(o); }
    
    // --- RIR PICKER ---
    const rirPick = document.getElementById('rir-picker'); rirPick.innerHTML = "";
    [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5].forEach(v => {
        let o = new Option(v === 0 ? "Fail" : v, v); 
        // Compare loosely or strictly depending on type, but values match
        if(parseFloat(v) === parseFloat(defaultRIR)) o.selected = true; 
        rirPick.add(o);
    });
}

function resetAndStartTimer(customTime = null) {
    stopRestTimer(); state.seconds = 0; state.startTime = Date.now();
    let target = 90;
    if (customTime !== null) target = customTime;
    else if (state.currentEx.restTime) target = state.currentEx.restTime;
    else target = (state.exIdx === 0 && !state.clusterMode) ? 120 : 90;
    
    const circle = document.getElementById('timer-progress'); 
    const text = document.getElementById('rest-timer');
    const clusterBar = document.getElementById('cluster-timer-bar');
    const clusterText = document.getElementById('cluster-timer-text');

    const updateUI = (mins, secs, progress) => {
        if(text) text.innerText = `${mins}:${secs}`;
        if(circle) circle.style.strokeDashoffset = 283 - (progress * 283);
        if(clusterText) clusterText.innerText = `${mins}:${secs}`;
        if(clusterBar) clusterBar.style.strokeDashoffset = 283 - (progress * 283);
    };

    state.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
        state.seconds = elapsed;
        const remaining = Math.max(0, target - elapsed); 
        const mins = Math.floor(state.seconds / 60).toString().padStart(2, '0');
        const secs = (state.seconds % 60).toString().padStart(2, '0');
        const progress = Math.min(state.seconds / target, 1);
        updateUI(mins, secs, progress);
        if (state.seconds === target) playBeep(2);
    }, 100); 
    
    StorageManager.saveSessionState();
}

function stopRestTimer() { if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; } }

function nextStep() {
    haptic('light');
    const wVal = parseFloat(document.getElementById('weight-picker').value);
    const noteVal = document.getElementById('set-notes').value.trim();
    const entry = { exName: state.currentExName, w: wVal, r: parseInt(document.getElementById('reps-picker').value), rir: document.getElementById('rir-picker').value, note: noteVal };
    
    StorageManager.saveWeight(state.currentExName, wVal);
    
    state.log.push(entry); state.lastLoggedSet = entry;
    StorageManager.saveSessionState(); 

    if (state.clusterMode) {
        state.lastClusterRest = state.currentEx.restTime || 30;
        if (state.clusterIdx < state.activeCluster.exercises.length - 1) {
            state.clusterIdx++;
            const nextExItem = state.activeCluster.exercises[state.clusterIdx];
            const exData = state.exercises.find(e => e.name === nextExItem.name);
            
            state.currentEx = JSON.parse(JSON.stringify(exData));
            state.currentExName = exData.name;
            
            if(nextExItem.restTime) state.currentEx.restTime = nextExItem.restTime;
            if(nextExItem.targetWeight) state.currentEx.targetWeight = nextExItem.targetWeight;
            if(nextExItem.targetReps) state.currentEx.targetReps = nextExItem.targetReps;
            if(nextExItem.targetRIR) state.currentEx.targetRIR = nextExItem.targetRIR;

            state.currentEx.sets = [{w:10, r:10}];
            state.setIdx = 0; state.lastLoggedSet = null; 
            initPickers();
            document.getElementById('timer-area').style.visibility = 'visible';
            resetAndStartTimer(state.lastClusterRest);
            return; 
        } else { finishCurrentExercise(); return; }
    }

    if (state.setIdx < state.currentEx.sets.length - 1) { 
        state.setIdx++; initPickers(); 
        document.getElementById('timer-area').style.visibility = 'visible'; 
        resetAndStartTimer();
    } else { 
        haptic('medium'); 
        document.getElementById('btn-submit-set').style.display = 'none';
        document.getElementById('btn-skip-exercise').style.display = 'none';
        document.getElementById('action-panel').style.display = 'block';
        let nextName = getNextExerciseName();
        document.getElementById('next-ex-preview').innerText = `הבא בתור: ${nextName}`;
        if (!state.clusterMode) { document.getElementById('timer-area').style.visibility = 'hidden'; stopRestTimer(); }
    }
}

function getNextExerciseName() {
    if (state.isInterruption) return "חזרה למסלול";
    if (state.isExtraPhase) return "תרגיל נוסף";
    if (state.exIdx < state.workouts[state.type].length - 1) return state.workouts[state.type][state.exIdx + 1].name;
    return "סיום אימון";
}

function finishCurrentExercise() {
    state.historyStack = state.historyStack.filter(s => s !== 'ui-main');
    
    if (state.clusterMode) {
        handleClusterFlow();
    } else {
        if (!state.completedExInSession.includes(state.currentExName)) state.completedExInSession.push(state.currentExName);
        
        if (state.isInterruption) { 
            state.isInterruption = false; 
            navigate('ui-confirm'); 
            StorageManager.saveSessionState(); 
        } 
        else if (state.isExtraPhase) {
            updateVariationUI();
            renderFreestyleChips();
            renderFreestyleList();
            navigate('ui-variation'); 
            StorageManager.saveSessionState(); 
        } 
        else if (state.isFreestyle) { 
            navigate('ui-variation');
            updateVariationUI();
            renderFreestyleChips();
            renderFreestyleList();
            StorageManager.saveSessionState();
        } 
        else { checkFlow(); }
    }
}

function handleClusterFlow() {
    navigate('ui-cluster-rest');
    if (state.clusterRound < state.activeCluster.rounds) resetAndStartTimer(state.activeCluster.clusterRest);
    else stopRestTimer();
    renderClusterRestUI();
    StorageManager.saveSessionState();
}

function renderClusterRestUI() {
    const btnMain = document.getElementById('btn-cluster-main');
    const btnSkip = document.getElementById('btn-cluster-skip-text');
    if (state.clusterRound < state.activeCluster.rounds) {
        document.getElementById('cluster-status-text').innerText = `סיום סבב ${state.clusterRound} מתוך ${state.activeCluster.rounds}`;
        document.getElementById('btn-extra-round').style.display = 'none';
        btnMain.innerText = "התחל סבב הבא";
        btnMain.onclick = startNextRound;
        btnSkip.style.display = 'block';
    } else {
        document.getElementById('cluster-status-text').innerText = `הסבבים הושלמו (${state.activeCluster.rounds})`;
        document.getElementById('btn-extra-round').style.display = 'block';
        document.getElementById('cluster-timer-text').innerText = "✓";
        btnMain.innerText = "סיום";
        btnMain.onclick = finishCluster;
        btnSkip.style.display = 'none';
    }
    const listDiv = document.getElementById('cluster-next-list');
    listDiv.innerHTML = state.activeCluster.exercises.map((e,i) => `<div>${i+1}. ${e.name}</div>`).join('');
}

function startNextRound() {
    state.clusterRound++; state.clusterIdx = 0; stopRestTimer();
    
    const nextExItem = state.activeCluster.exercises[0];
    const exData = state.exercises.find(e => e.name === nextExItem.name);
    
    state.currentEx = JSON.parse(JSON.stringify(exData));
    state.currentExName = exData.name;
    
    if(nextExItem.restTime) state.currentEx.restTime = nextExItem.restTime;
    if(nextExItem.targetWeight) state.currentEx.targetWeight = nextExItem.targetWeight;
    if(nextExItem.targetReps) state.currentEx.targetReps = nextExItem.targetReps;
    if(nextExItem.targetRIR) state.currentEx.targetRIR = nextExItem.targetRIR;

    state.currentEx.sets = [{w:10, r:10}];
    startRecording();
}

function addExtraRound() { state.activeCluster.rounds++; renderClusterRestUI(); StorageManager.saveSessionState(); }
function finishCluster() { state.clusterMode = false; state.activeCluster = null; state.exIdx++; checkFlow(); }

function skipCurrentExercise() {
    if(confirm("לדלג על תרגיל זה ולעבור לבא?")) {
        state.log.push({ skip: true, exName: state.currentExName });
        
        if (state.clusterMode) {
             if (state.clusterIdx < state.activeCluster.exercises.length - 1) {
                state.clusterIdx++;
                
                const nextExItem = state.activeCluster.exercises[state.clusterIdx];
                const exData = state.exercises.find(e => e.name === nextExItem.name);
                
                state.currentEx = JSON.parse(JSON.stringify(exData));
                state.currentExName = exData.name;
                
                if(nextExItem.restTime) state.currentEx.restTime = nextExItem.restTime;
                if(nextExItem.targetWeight) state.currentEx.targetWeight = nextExItem.targetWeight;
                if(nextExItem.targetReps) state.currentEx.targetReps = nextExItem.targetReps;
                if(nextExItem.targetRIR) state.currentEx.targetRIR = nextExItem.targetRIR;

                state.currentEx.sets = [{w:10, r:10}];
                state.setIdx = 0; state.lastLoggedSet = null; 
                initPickers();
                resetAndStartTimer(state.lastClusterRest || 30);
            } else {
                finishCurrentExercise();
            }
        } else {
            finishCurrentExercise();
        }
    }
}

function finishClusterRound() {
    if (!confirm("האם לסיים את הסבב הנוכחי ולדלג על יתר התרגילים?")) return;
    
    state.log.push({ skip: true, exName: state.currentExName });
    
    for (let i = state.clusterIdx + 1; i < state.activeCluster.exercises.length; i++) {
        state.log.push({ skip: true, exName: state.activeCluster.exercises[i].name });
    }
    
    handleClusterFlow();
}

function addExtraSet() {
    state.setIdx++;
    state.currentEx.sets.push({...state.currentEx.sets[state.setIdx-1]});
    document.getElementById('action-panel').style.display = 'none';
    document.getElementById('btn-submit-set').style.display = 'block';
    initPickers();
    document.getElementById('timer-area').style.visibility = 'visible'; 
    resetAndStartTimer();
}

function interruptWorkout() {
    state.isInterruption = true;
    updateVariationUI();
    renderFreestyleChips();
    renderFreestyleList();
    navigate('ui-variation');
    StorageManager.saveSessionState();
}

function resumeWorkout() { 
    state.isInterruption = false; 
    navigate('ui-confirm'); 
    StorageManager.saveSessionState(); 
}

function startExtraPhase() { 
    state.isExtraPhase = true; 
    updateVariationUI();
    renderFreestyleChips();
    renderFreestyleList();
    navigate('ui-variation'); 
    StorageManager.saveSessionState(); 
}

function finishExtraPhase() { 
    finish();
}

// --- FREESTYLE & LISTS (UNIFIED) ---
function startFreestyle() {
    state.type = 'Freestyle'; state.log = []; state.completedExInSession = [];
    state.isFreestyle = true; state.isExtraPhase = false; state.isInterruption = false;
    state.workoutStartTime = Date.now();
    
    state.freestyleFilter = 'all'; 
    document.getElementById('freestyle-search').value = '';
    
    updateVariationUI();
    navigate('ui-variation');
    
    renderFreestyleChips();
    renderFreestyleList();
    
    StorageManager.saveSessionState(); 
}

function updateVariationUI() {
    const resumeBtn = document.getElementById('btn-var-resume');
    const finishExtraBtn = document.getElementById('btn-var-finish-extra');
    const contextContainer = document.getElementById('variation-context-container');
    const title = document.getElementById('variation-title');

    resumeBtn.style.display = 'none';
    finishExtraBtn.style.display = 'none';
    contextContainer.style.display = 'none';

    if (state.isInterruption) {
        title.innerText = "הוספת תרגיל";
        contextContainer.style.display = 'block';
        resumeBtn.style.display = 'flex';
    } else if (state.isExtraPhase) {
        title.innerText = "תרגילי אקסטרה";
        contextContainer.style.display = 'block';
        finishExtraBtn.style.display = 'block';
        finishExtraBtn.innerText = "סיום אימון";
    } else {
        title.innerText = "בחר תרגיל";
    }
}

function renderFreestyleChips() {
    const container = document.getElementById('variation-chips');
    container.innerHTML = "";
    
    const muscles = ['all', 'חזה', 'גב', 'רגליים', 'כתפיים', 'יד קדמית', 'יד אחורית', 'בטן', 'קליסטניקס', 'בוצעו'];
    const labels = { 'all': 'הכל' };
    
    muscles.forEach(m => {
        const btn = document.createElement('button');
        btn.className = `chip ${state.freestyleFilter === m ? 'active' : ''}`;
        btn.innerText = labels[m] || m;
        btn.onclick = () => { 
            state.freestyleFilter = m; 
            renderFreestyleChips(); 
            renderFreestyleList(); 
        };
        container.appendChild(btn);
    });
}

function renderFreestyleList() {
    const options = document.getElementById('variation-options');
    options.innerHTML = "";
    
    const searchVal = document.getElementById('freestyle-search').value.toLowerCase();
    
    let filtered = state.exercises.filter(ex => {
        const isDone = state.completedExInSession.includes(ex.name);
        if (state.freestyleFilter === 'בוצעו') return isDone;
        if (isDone) return false;

        const matchesSearch = ex.name.toLowerCase().includes(searchVal);
        if (!matchesSearch) return false;

        if (state.freestyleFilter === 'all') return true;
        if (state.freestyleFilter === 'יד קדמית') return ex.muscles.includes('biceps');
        if (state.freestyleFilter === 'יד אחורית') return ex.muscles.includes('triceps');
        return ex.muscles.includes(state.freestyleFilter);
    });
    
    filtered.sort((a,b) => a.name.localeCompare(b.name));

    if (filtered.length === 0) {
        if (state.freestyleFilter === 'בוצעו') {
            options.innerHTML = `<p style="text-align:center; color:var(--text-dim); margin-top:20px;">טרם בוצעו תרגילים</p>`;
        } else {
            options.innerHTML = `<p style="text-align:center; color:var(--text-dim); margin-top:20px;">לא נמצאו תרגילים</p>`;
        }
        return;
    }

    filtered.forEach(ex => {
        const btn = document.createElement('button'); 
        btn.className = "menu-card";
        btn.innerHTML = `<span>${ex.name}</span><div class="chevron"></div>`;
        btn.onclick = () => {
            state.currentEx = JSON.parse(JSON.stringify(ex));
            state.currentExName = ex.name;
            if(!state.currentEx.sets || state.currentEx.sets.length < 3) state.currentEx.sets = [{w:10, r:10}, {w:10, r:10}, {w:10, r:10}];
            startRecording();
        };
        options.appendChild(btn);
    });
}

function finish() {
    haptic('success');
    StorageManager.clearSessionState(); 
    state.workoutDurationMins = Math.floor((Date.now() - state.workoutStartTime) / 60000);
    navigate('ui-summary');
    document.getElementById('summary-note').value = "";
    const workoutDisplayName = state.type; 
    const dateStr = new Date().toLocaleDateString('he-IL');
    let summaryText = `GYMPRO ELITE SUMMARY\n${workoutDisplayName} | Week ${state.week} | ${dateStr} | ${state.workoutDurationMins}m\n\n`;
    let grouped = {};
    state.log.forEach(e => {
        if (!grouped[e.exName]) grouped[e.exName] = { sets: [], vol: 0, hasWarmup: false };
        if (e.isWarmup) grouped[e.exName].hasWarmup = true;
        else if (!e.skip) {
            let weightStr = `${e.w}kg`;
            if (isUnilateral(e.exName)) weightStr += ` (יד אחת)`;
            
            let setStr = `${weightStr} x ${e.r} (RIR ${e.rir})`;
            if (e.note) setStr += ` | Note: ${e.note}`;
            grouped[e.exName].sets.push(setStr); grouped[e.exName].vol += (e.w * e.r);
        }
    });
    for (let ex in grouped) { 
        summaryText += `${ex} (Vol: ${grouped[ex].vol}kg):\n`;
        if (grouped[ex].hasWarmup) summaryText += `🔥 Warmup Completed\n`;
        summaryText += `${grouped[ex].sets.join('\n')}\n\n`; 
    }
    document.getElementById('summary-area').innerText = summaryText.trim();
    state.lastWorkoutDetails = grouped;
}

function copyResult() {
    let text = document.getElementById('summary-area').innerText;
    const userNote = document.getElementById('summary-note').value.trim();
    if (userNote) text += `\n\n📝 הערות כלליות: ${userNote}`;
    const workoutDisplayName = state.type;
    const dateStr = new Date().toLocaleDateString('he-IL');
    const archiveObj = { id: Date.now(), date: dateStr, timestamp: Date.now(), type: workoutDisplayName, week: state.week, duration: state.workoutDurationMins, summary: text, details: state.lastWorkoutDetails, generalNote: userNote };
    StorageManager.saveToArchive(archiveObj);
    if (navigator.clipboard) { navigator.clipboard.writeText(text).then(() => { haptic('light'); alert("הסיכום נשמר בארכיון והועתק!"); location.reload(); }); } 
    else { const el = document.createElement("textarea"); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); alert("הסיכום נשמר בארכיון והועתק!"); location.reload(); }
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

function renderArchiveList() {
    const list = document.getElementById('archive-list'); list.innerHTML = "";
    selectedArchiveIds.clear(); updateCopySelectedBtn();
    const history = StorageManager.getArchive();
    if (history.length === 0) { list.innerHTML = `<div style="text-align:center; color:gray; margin-top:20px;">אין אימונים שמורים</div>`; } 
    else {
        history.forEach(item => {
            const card = document.createElement('div'); card.className = "menu-card"; card.style.cursor = "default";
            const weekStr = item.week ? ` • שבוע ${item.week}` : '';
            card.innerHTML = `<div class="archive-card-row"><input type="checkbox" class="archive-checkbox" data-id="${item.timestamp}"><div class="archive-info"><div style="display:flex; justify-content:space-between; width:100%;"><h3 style="margin:0;">${item.date}</h3><span style="font-size:0.8em; color:#8E8E93">${item.duration} דק'</span></div><p style="margin:0; color:#8E8E93; font-size:0.85em;">${item.type}${weekStr}</p></div><div class="chevron"></div></div>`;
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
    if (selectedArchiveIds.size > 0) { btn.disabled = false; btn.style.opacity = "1"; btn.style.borderColor = "var(--accent)"; btn.style.color = "var(--accent)"; } 
    else { btn.disabled = true; btn.style.opacity = "0.5"; btn.style.borderColor = "var(--border)"; btn.style.color = "var(--text-dim)"; }
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
    const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
    document.getElementById('current-month-display').innerText = `${monthNames[month]} ${year}`;
    const firstDayIndex = targetDate.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const history = StorageManager.getArchive();
    const monthWorkouts = history.filter(item => {
        const d = new Date(item.timestamp);
        return d.getMonth() === month && d.getFullYear() === year;
    });
    for(let i = 0; i < firstDayIndex; i++) { const cell = document.createElement('div'); cell.className = "calendar-cell empty"; grid.appendChild(cell); }
    const today = new Date();
    for(let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div'); cell.className = "calendar-cell";
        cell.innerHTML = `<span>${day}</span>`;
        if(state.calendarOffset === 0 && day === today.getDate()) cell.classList.add('today');
        const dailyWorkouts = monthWorkouts.filter(item => new Date(item.timestamp).getDate() === day);
        if(dailyWorkouts.length > 0) {
            const dotsContainer = document.createElement('div'); dotsContainer.className = "dots-container";
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
    if(workouts.length === 0) { html += `<p>אין אימונים ביום זה</p>`; } 
    else {
        html += `<p>נמצאו ${workouts.length} אימונים:</p>`;
        workouts.forEach(wo => {
            let dotColor = '#BF5AF2';
            if(wo.type.includes('כתפיים - גב - חזה') || wo.type.includes('A')) dotColor = '#0A84FF';
            else if(wo.type.includes('רגליים - גב') || wo.type.includes('B')) dotColor = '#32D74B';
            else if(wo.type.includes('חזה - כתפיים') || wo.type.includes('C')) dotColor = '#FF9F0A';
            html += `
            <div class="mini-workout-item" onclick='openArchiveFromDrawer(${JSON.stringify(wo).replace(/'/g, "&#39;")})'>
                <div class="mini-dot" style="background:${dotColor}"></div>
                <div style="flex-grow:1;">
                    <div style="font-weight:600; font-size:0.95em;">${wo.type}</div>
                    <div style="font-size:0.8em; color:#8E8E93;">${wo.duration} דק' • ${new Date(wo.timestamp).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}</div>
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
    currentArchiveItem = item; document.getElementById('archive-detail-content').innerText = item.summary;
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
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: "application/json"})); a.download = `gympro_backup_${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
function triggerImport() { document.getElementById('import-file').click(); }
function importData(input) {
    const file = input.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if(confirm("האם לדרוס את הנתונים הקיימים ולשחזר מהגיבוי?")) { StorageManager.restoreData(data); alert("הנתונים שוחזרו בהצלחה!"); location.reload(); }
        } catch(err) { alert("שגיאה בטעינת הקובץ."); }
    };
    reader.readAsText(file);
}
function triggerConfigImport() { document.getElementById('import-config-file').click(); }
function processConfigImport(input) {
    const file = input.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { try { StorageManager.importConfiguration(JSON.parse(e.target.result)); } catch(err) { alert("שגיאה בטעינת הקובץ."); } };
    reader.readAsText(file);
}

function openSessionLog() {
    const drawer = document.getElementById('sheet-modal');
    const overlay = document.getElementById('sheet-overlay');
    const content = document.getElementById('sheet-content');

    let html = `<h3>יומן אימון נוכחי</h3>`;
    
    if (state.log.length === 0) {
        html += `<p style="text-align:center; margin-top:20px;">טרם בוצעו סטים באימון זה</p>`;
    } else {
        html += `<div class="vertical-stack">`;
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
                    <div style="font-weight:600; font-size:0.9em;">${index + 1}. ${displayTitle}</div>
                    <div style="font-size:0.85em; color:#8E8E93;">${details}</div>
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
        html += `<p style="text-align:center; margin-top:20px; color:var(--text-dim);">אין נתונים מהאימון הקודם</p>`;
    } else {
        html += `<div style="font-size:0.85em; color:var(--text-dim); margin-bottom:15px;">📅 ביצוע אחרון: ${history.date}</div>`;
        
        html += `
        <div style="display: grid; grid-template-columns: 0.5fr 1fr 1fr 1fr; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; margin-bottom: 10px; font-size: 0.8em; color: var(--text-dim); font-weight: 600; text-align: center;">
            <div>סט</div>
            <div>משקל</div>
            <div>חזרות</div>
            <div>RIR</div>
        </div>
        <div class="vertical-stack">`;
        
        history.sets.forEach((setStr, idx) => {
            let weight = "-", reps = "-", rir = "-";
            try {
                const parts = setStr.split('x');
                if(parts.length > 1) {
                    weight = parts[0].replace('kg', '').trim();
                    const rest = parts[1];
                    const rirMatch = rest.match(/\(RIR (.*?)\)/);
                    reps = rest.split('(')[0].trim();
                    if(rirMatch) rir = rirMatch[1];
                }
            } catch(e) {}

            html += `
            <div style="display: grid; grid-template-columns: 0.5fr 1fr 1fr 1fr; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.95em; text-align: center; color: white;">
                <div style="color:var(--text-dim); font-size:0.9em;">#${idx + 1}</div>
                <div>${weight}</div>
                <div>${reps}</div>
                <div style="color:var(--accent); font-size:0.85em;">${rir}</div>
            </div>`;
        });
        html += `</div>`;
    }

    content.innerHTML = html;
    overlay.style.display = 'block';
    drawer.classList.add('open');
    haptic('light');
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
        initPickers();
    }
    openSessionLog();
}

function openSwapMenu() {
    const container = document.getElementById('swap-container'); 
    container.innerHTML = "";
    
    const workoutList = state.workouts[state.type]; if (!workoutList) return;

    const variations = getSubstitutes(state.currentExName).filter(name => !state.completedExInSession.includes(name));
    if (variations.length > 0) {
        const titleVar = document.createElement('div');
        titleVar.className = "section-label";
        titleVar.innerText = `וריאציות (מחליף את הנוכחי)`;
        container.appendChild(titleVar);
        variations.forEach(vName => {
            const btn = document.createElement('button'); 
            btn.className = "menu-card"; 
            btn.innerHTML = `<span>${vName}</span><div class="chevron"></div>`;
            btn.onclick = () => {
                state.currentExName = vName;
                state.historyStack.pop(); 
                showConfirmScreen(vName);
            };
            container.appendChild(btn);
        });
    }

    const titleOrder = document.createElement('div');
    titleOrder.className = "section-label";
    titleOrder.innerText = `שאר האימון (החלף סדר)`;
    titleOrder.style.marginTop = "20px";
    container.appendChild(titleOrder);

    const remaining = workoutList.map((item, idx) => ({ item, idx })).filter(({ item, idx }) => idx > state.exIdx);

    if (remaining.length === 0) {
        const empty = document.createElement('p');
        empty.style.textAlign = 'center'; empty.style.color = 'var(--text-dim)'; empty.innerText = 'אין תרגילים נוספים להחלפה';
        container.appendChild(empty);
    } else {
        remaining.forEach(({ item, idx }) => {
            const btn = document.createElement('button'); 
            btn.className = "menu-card"; 
            btn.innerHTML = `<span>${item.name}</span><div class="chevron"></div>`;
            btn.onclick = () => { 
                const currentItem = state.workouts[state.type][state.exIdx];
                state.workouts[state.type][state.exIdx] = state.workouts[state.type][idx];
                state.workouts[state.type][idx] = currentItem;
                state.historyStack.pop();
                showConfirmScreen(); 
            };
            container.appendChild(btn);
        });
    }

    navigate('ui-swap-list');
    StorageManager.saveSessionState();
}

function calcWarmup() {
    const targetW = parseFloat(document.getElementById('weight-picker').value);
    const list = document.getElementById('warmup-list'); list.innerHTML = "";
    const percentages = [0, 0.4, 0.6, 0.8];
    percentages.forEach((pct, idx) => {
        let w; let reps;
        if(idx === 0) { w = 20; reps = 10; }
        else {
            w = Math.round((targetW * pct) / 2.5) * 2.5;
            if (w < 20) w = 20;
            reps = idx === 1 ? 5 : (idx === 2 ? 3 : 2);
        }
        if (w >= targetW) return;
        const row = document.createElement('div'); row.className = "warmup-row";
        row.innerHTML = `<span>סט ${idx + 1}</span><span>${w}kg x ${reps}</span>`;
        list.appendChild(row);
    });
    document.getElementById('warmup-modal').style.display = 'flex';
}

function closeWarmup() { document.getElementById('warmup-modal').style.display = 'none'; }
function markWarmupDone() { state.log.push({ exName: state.currentExName, isWarmup: true }); StorageManager.saveSessionState(); closeWarmup(); }
