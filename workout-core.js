/**
 * GYMPRO ELITE - WORKOUT CORE LOGIC (Part 1)
 * Includes: Global State, Initialization, Navigation, Basic Flow Engine.
 */

// --- GLOBAL VARIABLES & STATE ---

// Helper for substitutes (Logic moved here from script.js)
function getSubstitutes(exName) {
    const group = substituteGroups.find(g => g.includes(exName));
    return group ? group.filter(n => n !== exName) : [];
}

// Helper to check if exercise or variation was done
function isExOrVariationDone(originalName) {
    if (state.completedExInSession.includes(originalName)) return true;
    const group = substituteGroups.find(g => g.includes(originalName));
    if (group) {
        return group.some(varName => state.completedExInSession.includes(varName));
    }
    return false;
}

// GLOBAL STATE
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

// MANAGER STATE (Shared with editor-logic.js)
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

// --- INITIALIZATION ---
window.onload = () => {
    // StorageManager is defined in storage.js
    StorageManager.initDB();
    
    // Render functions from other modules are called safely
    if(typeof renderWorkoutMenu === 'function') renderWorkoutMenu(); 
    
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
        // Fix for edge cases where stack points to transient screens
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
        
        // Restore UI specific to the screen
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
            // Calls to other modules
            case 'ui-workout-manager': if(typeof renderManagerList === 'function') renderManagerList(); break;
            case 'ui-workout-editor': if(typeof openEditorUI === 'function') openEditorUI(); break; 
            case 'ui-exercise-selector': 
                document.getElementById('selector-search').value = ""; 
                if(typeof updateSelectorChips === 'function') updateSelectorChips(); 
                if(typeof renderSelectorList === 'function') renderSelectorList(); 
                break;
            case 'ui-1rm': setupCalculatedEx(); break;
            case 'ui-variation': 
                if(typeof updateVariationUI === 'function') updateVariationUI();
                if(typeof renderFreestyleChips === 'function') renderFreestyleChips();
                if(typeof renderFreestyleList === 'function') renderFreestyleList();
                break;
            case 'ui-exercise-db': if(typeof renderExerciseDatabase === 'function') renderExerciseDatabase(); break;
            case 'ui-archive': if(typeof openArchive === 'function') openArchive(); break;
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

// --- AUDIO & HAPTICS ---
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

// --- NAVIGATION SYSTEM ---
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

    // Guard Layer - Prevent accidental exit during active set
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

    // Navigation Execution
    state.historyStack.pop();
    const prevScreen = state.historyStack[state.historyStack.length - 1];
    
    // Refresh hooks for returning screens
    if (prevScreen === 'ui-variation') {
        if(typeof updateVariationUI === 'function') updateVariationUI(); 
        if(typeof renderFreestyleChips === 'function') renderFreestyleChips();
        if(typeof renderFreestyleList === 'function') renderFreestyleList();
    }

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(prevScreen).classList.add('active');
    
    document.getElementById('global-back').style.visibility = (prevScreen === 'ui-week') ? 'hidden' : 'visible';
    const settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn) settingsBtn.style.visibility = (prevScreen === 'ui-week') ? 'visible' : 'hidden';
}

// --- WORKOUT FLOW ENGINE (CORE) ---
function selectWeek(w) { 
    state.week = w; 
    if(typeof renderWorkoutMenu === 'function') renderWorkoutMenu(); 
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
    // Cluster Logic
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

    // Regular / Specific Exercise Logic
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
    
    // Copy Plan Defaults to currentEx state
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
    
    // Note: getLastPerformance is in archive-logic.js
    if(typeof getLastPerformance === 'function') {
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
    }

    navigate('ui-confirm');
    StorageManager.saveSessionState();
}

// End of Part 1. 
// Part 2 will contain: confirmExercise, initPickers, Timer Logic, and Intra-Workout Persistence.
// --- WORKOUT EXECUTION LOGIC ---

function confirmExercise(doEx) {
    // Cluster Start Logic
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

    // Skip Logic
    if (!doEx) { 
        state.log.push({ skip: true, exName: state.currentExName }); 
        if(!state.clusterMode) state.completedExInSession.push(state.currentExName); 
        finishCurrentExercise(); 
        return; 
    }
    
    let isMain = state.currentEx.isCalc; 
    let targetSets = null;

    // Determine configuration based on plan type
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

// --- INIT PICKERS (CRITICAL: Persistence Logic) ---
function initPickers() {
    document.getElementById('ex-display-name').innerText = state.currentExName;
    const exHeader = document.querySelector('.exercise-header');
    const existingQueue = document.querySelector('.cluster-queue-container');
    if (existingQueue) existingQueue.remove();

    // Cluster Queue Visualization
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

    // Priority 1. Check Previous Sets in CURRENT Block (Highest Priority if > set 1)
    if (state.setIdx > 0 && state.lastLoggedSet) {
        defaultW = state.lastLoggedSet.w;
        defaultR = state.lastLoggedSet.r;
        defaultRIR = state.lastLoggedSet.rir;
    }
    // Priority 2. Main / Calculated Logic (Guard Clause - Always obey 1RM calc)
    else if (state.currentEx.isCalc) {
        defaultW = target.w;
        defaultR = target.r;
        defaultRIR = 2; // Default for main unless specified
    }
    else {
        // Priority 3. Intra-Workout Persistence (The Feature)
        // Check if this exercise was done previously in THIS session (e.g. in previous cluster round)
        const sessionHistory = state.log.filter(l => l.exName === state.currentExName && !l.skip && !l.isWarmup);
        
        if (sessionHistory.length > 0) {
            const lastSessionEntry = sessionHistory[sessionHistory.length - 1];
            defaultW = lastSessionEntry.w;
            defaultR = lastSessionEntry.r;
            defaultRIR = lastSessionEntry.rir;
        } 
        else {
            // Priority 4. Plan Defaults / Global History
            let planW = state.currentEx.targetWeight;
            let planR = state.currentEx.targetReps;
            let planRIR = state.currentEx.targetRIR;

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

    // Cluster Next Logic
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

    // Regular Next Logic
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
            if(typeof updateVariationUI === 'function') updateVariationUI();
            if(typeof renderFreestyleChips === 'function') renderFreestyleChips();
            if(typeof renderFreestyleList === 'function') renderFreestyleList();
            navigate('ui-variation'); 
            StorageManager.saveSessionState(); 
        } 
        else if (state.isFreestyle) { 
            navigate('ui-variation');
            if(typeof updateVariationUI === 'function') updateVariationUI();
            if(typeof renderFreestyleChips === 'function') renderFreestyleChips();
            if(typeof renderFreestyleList === 'function') renderFreestyleList();
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
    if(typeof updateVariationUI === 'function') updateVariationUI();
    if(typeof renderFreestyleChips === 'function') renderFreestyleChips();
    if(typeof renderFreestyleList === 'function') renderFreestyleList();
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
    if(typeof updateVariationUI === 'function') updateVariationUI();
    if(typeof renderFreestyleChips === 'function') renderFreestyleChips();
    if(typeof renderFreestyleList === 'function') renderFreestyleList();
    navigate('ui-variation'); 
    StorageManager.saveSessionState(); 
}

function finishExtraPhase() { 
    if(typeof finish === 'function') finish();
}

function startFreestyle() {
    state.type = 'Freestyle'; state.log = []; state.completedExInSession = [];
    state.isFreestyle = true; state.isExtraPhase = false; state.isInterruption = false;
    state.workoutStartTime = Date.now();
    
    state.freestyleFilter = 'all'; 
    document.getElementById('freestyle-search').value = '';
    
    if(typeof updateVariationUI === 'function') updateVariationUI();
    navigate('ui-variation');
    
    if(typeof renderFreestyleChips === 'function') renderFreestyleChips();
    if(typeof renderFreestyleList === 'function') renderFreestyleList();
    
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
