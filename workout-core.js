/**
 * GYMPRO ELITE - WORKOUT CORE LOGIC
 * Version: 14.2.0
 * Fixes: custom modals (no confirm/alert), checkFlow while-loop, navigate-after-save, safe-area toast.
 */

// ─── CUSTOM MODAL SYSTEM ───────────────────────────────────────────────────
// Replaces all native confirm() / alert() calls app-wide.

function showAlert(msg, onOk) {
    const modal = document.getElementById('custom-alert-modal');
    document.getElementById('custom-alert-msg').textContent = msg;
    modal.style.display = 'flex';
    const okBtn = document.getElementById('custom-alert-ok');
    const handler = () => {
        modal.style.display = 'none';
        okBtn.removeEventListener('click', handler);
        if (typeof onOk === 'function') onOk();
    };
    okBtn.addEventListener('click', handler);
}

function showConfirm(msg, onOk, onCancel) {
    const modal = document.getElementById('custom-confirm-modal');
    document.getElementById('custom-confirm-msg').textContent = msg;
    modal.style.display = 'flex';
    const okBtn = document.getElementById('custom-confirm-ok');
    const cancelBtn = document.getElementById('custom-confirm-cancel');

    const cleanup = () => {
        modal.style.display = 'none';
        okBtn.removeEventListener('click', okHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
    };
    const okHandler = () => { cleanup(); if (typeof onOk === 'function') onOk(); };
    const cancelHandler = () => { cleanup(); if (typeof onCancel === 'function') onCancel(); };

    okBtn.addEventListener('click', okHandler);
    cancelBtn.addEventListener('click', cancelHandler);
}

// ─── HELPER: Substitute groups ─────────────────────────────────────────────

function getSubstitutes(exName) {
    const group = substituteGroups.find(g => g.includes(exName));
    return group ? group.filter(n => n !== exName) : [];
}

function isExOrVariationDone(originalName) {
    if (state.completedExInSession.includes(originalName)) return true;
    const group = substituteGroups.find(g => g.includes(originalName));
    if (group) return group.some(varName => state.completedExInSession.includes(varName));
    return false;
}

// ─── GLOBAL STATE ──────────────────────────────────────────────────────────

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

// ─── INITIALIZATION ────────────────────────────────────────────────────────

window.onload = () => {
    StorageManager.initDB();
    if (typeof renderWorkoutMenu === 'function') renderWorkoutMenu();
    checkRecovery();
    if (typeof renderHeroCard === 'function') renderHeroCard();
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
                    const target = state.currentEx && state.currentEx.restTime ? state.currentEx.restTime : 90;
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
            case 'ui-workout-manager': if (typeof renderManagerList === 'function') renderManagerList(); break;
            case 'ui-workout-editor': if (typeof openEditorUI === 'function') openEditorUI(); break;
            case 'ui-exercise-selector':
                document.getElementById('selector-search').value = "";
                if (typeof updateSelectorChips === 'function') updateSelectorChips();
                if (typeof renderSelectorList === 'function') renderSelectorList();
                break;
            case 'ui-1rm': setupCalculatedEx(); break;
            case 'ui-variation':
                if (typeof updateVariationUI === 'function') updateVariationUI();
                if (typeof renderFreestyleChips === 'function') renderFreestyleChips();
                if (typeof renderFreestyleList === 'function') renderFreestyleList();
                break;
            case 'ui-exercise-db': if (typeof renderExerciseDatabase === 'function') renderExerciseDatabase(); break;
            case 'ui-archive': if (typeof openArchive === 'function') openArchive(); break;
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

// ─── HAPTIC / AUDIO ────────────────────────────────────────────────────────

function haptic(type = 'light') {
    if (!("vibrate" in navigator)) return;
    try {
        if (type === 'light') navigator.vibrate(20);
        else if (type === 'medium') navigator.vibrate(40);
        else if (type === 'success') navigator.vibrate([50, 50, 50]);
        else if (type === 'warning') navigator.vibrate([30, 30]);
    } catch (e) {}
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
    // Toggle SVG sound icon class
    const btn = document.getElementById('btn-sound');
    if (btn) btn.classList.toggle('sound-active', true);
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (err) {}
}

// ─── NAVIGATION ────────────────────────────────────────────────────────────

function navigate(id, clearStack = false) {
    haptic('light');
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');

    if (id !== 'ui-main') stopRestTimer();
    const WORKOUT_SCREENS = ['ui-workout-type', 'ui-confirm', 'ui-main', 'ui-1rm', 'ui-cluster-rest', 'ui-variation', 'ui-swap-list', 'ui-ask-extra', 'ui-summary'];
    const tabBar = document.querySelector('.tab-bar');
    if (tabBar) tabBar.style.display = WORKOUT_SCREENS.includes(id) ? 'none' : 'flex';

    // Hide header buttons during workout
    const settingsBtn = document.getElementById('btn-settings');
    const soundBtn    = document.getElementById('btn-sound');
    const inWorkout   = WORKOUT_SCREENS.includes(id);
    if (settingsBtn) settingsBtn.style.display = inWorkout ? 'none' : 'flex';
    if (soundBtn)    soundBtn.style.display    = inWorkout ? 'none' : 'flex';

    if (clearStack) {
        state.historyStack = [id];
    } else {
        if (state.historyStack[state.historyStack.length - 1] !== id) state.historyStack.push(id);
    }

    // Back button hidden on main tab screens
    const NO_BACK = ['ui-week', 'ui-analytics', 'ui-archive'];
    document.getElementById('global-back').style.visibility = NO_BACK.includes(id) ? 'hidden' : 'visible';
}

function handleBackClick() {
    haptic('warning');
    if (state.historyStack.length <= 1) return;

    const currentScreen = state.historyStack[state.historyStack.length - 1];

    if (currentScreen === 'ui-main') {
        if ((state.isFreestyle || state.isExtraPhase || state.isInterruption) && state.setIdx === 0 && state.log.length === 0) {
            // pass
        } else if (state.setIdx > 0) {
            showConfirm("חזרה אחורה תמחק את הסט הנוכחי. להמשיך?", () => {
                state.setIdx--;
                initPickers();
                StorageManager.saveSessionState();
            });
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
            showConfirm("האם לצאת מהאימון? (הנתונים שלא נשמרו בארכיון יאבדו)", () => {
                StorageManager.clearSessionState();
                state.isInterruption = false;
                state.isExtraPhase = false;
                _doBack(currentScreen);
            });
            return;
        }
        state.isInterruption = false;
        state.isExtraPhase = false;
    }

    if (currentScreen === 'ui-confirm') {
        if (state.log.length > 0 || state.completedExInSession.length > 0) {
            showConfirm("האם לצאת מהאימון?", () => {
                StorageManager.clearSessionState();
                _doBack(currentScreen);
            });
            return;
        }
    }

    if (currentScreen === 'ui-cluster-rest') {
        showConfirm("האם לצאת ממצב Cluster?", () => {
            state.clusterMode = false;
            document.getElementById('ui-main').classList.remove('cluster');
            _doBack(currentScreen);
        });
        return;
    }

    if (currentScreen === 'ui-workout-editor') {
        showConfirm("לצאת ללא שמירה?", () => {
            state.historyStack.pop();
            navigate('ui-workout-manager');
        });
        return;
    }

    if (currentScreen === 'ui-exercise-selector') {
        document.getElementById('selector-search').value = "";
    }

    _doBack(currentScreen);
}

function _doBack(currentScreen) {
    state.historyStack.pop();
    const prevScreen = state.historyStack[state.historyStack.length - 1];

    if (prevScreen === 'ui-variation') {
        if (typeof updateVariationUI === 'function') updateVariationUI();
        if (typeof renderFreestyleChips === 'function') renderFreestyleChips();
        if (typeof renderFreestyleList === 'function') renderFreestyleList();
    }

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(prevScreen).classList.add('active');
    document.getElementById('global-back').style.visibility = (prevScreen === 'ui-week') ? 'hidden' : 'visible';
}

function openSettings() { navigate('ui-settings'); }

// ─── WEEK / WORKOUT SELECTION ──────────────────────────────────────────────

function selectWeek(w) {
    state.week = w;
    if (typeof renderWorkoutMenu === 'function') renderWorkoutMenu();
    navigate('ui-workout-type');
}

function selectWorkout(t) {
    state.type = t; state.exIdx = 0; state.log = [];
    state.completedExInSession = []; state.isFreestyle = false; state.isExtraPhase = false; state.isInterruption = false;
    state.workoutStartTime = Date.now();
    state.clusterMode = false;
    checkFlow();
}

// ─── FLOW CONTROL (while-loop, no recursion) ───────────────────────────────

function checkFlow() {
    const workoutList = state.workouts[state.type];

    // Skip already-completed non-cluster exercises (bounded while loop)
    while (
        state.exIdx < workoutList.length &&
        workoutList[state.exIdx].type !== 'cluster' &&
        isExOrVariationDone(workoutList[state.exIdx].name)
    ) {
        state.exIdx++;
    }

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
        showConfirmScreen();
    }
}

// ─── CONFIRM SCREEN ────────────────────────────────────────────────────────

function showConfirmScreen(forceExName = null) {
    const counterDiv = document.getElementById('confirm-ex-counter');
    if (counterDiv) {
        const completed = state.completedExInSession.length;
        if (completed > 0 && !state.isFreestyle && !state.isExtraPhase && !state.isInterruption && !state.clusterMode) {
            counterDiv.innerText = `✓ ${completed} תרגילים הושלמו`;
            counterDiv.style.display = 'block';
        } else {
            counterDiv.style.display = 'none';
        }
    }

    if (state.clusterMode && state.clusterIdx === 0 && !forceExName) {
        document.getElementById('confirm-ex-name').innerText = "סבב / מעגל (Cluster)";
        document.getElementById('confirm-ex-config').innerText = `סבב ${state.clusterRound} מתוך ${state.activeCluster.rounds}`;
        document.getElementById('confirm-ex-config').style.display = 'block';

        const historyContainer = document.getElementById('history-container');
        let listHtml = `<div class="vertical-stack text-right my-md">`;
        state.activeCluster.exercises.forEach((ex, i) => {
            listHtml += `<div class="bg-card p-sm rounded-md mb-xs">${i + 1}. ${ex.name}</div>`;
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
    if (!exData) { showAlert("שגיאה: התרגיל לא נמצא במאגר."); return; }

    state.currentEx = JSON.parse(JSON.stringify(exData));
    state.currentExName = exData.name;

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

    if (typeof getLastPerformance === 'function') {
        const history = getLastPerformance(exName);
        if (history) {
            let rowsHtml = "";
            let notesHtml = "";
            let hasAnyNotes = false;
            let notesList = [];

            history.sets.forEach((setStr, idx) => {
                let weight = "-", reps = "-", rir = "-";
                let currentNote = "";
                let coreStr = setStr;

                if (setStr.includes('| Note:')) {
                    const parts = setStr.split('| Note:');
                    coreStr = parts[0].trim();
                    currentNote = parts[1].trim();
                }

                if (currentNote) hasAnyNotes = true;
                notesList.push(currentNote);

                try {
                    const parts = coreStr.split('x');
                    if (parts.length > 1) {
                        weight = parts[0].replace('kg', '').trim();
                        const rest = parts[1];
                        const rirMatch = rest.match(/\(RIR (.*?)\)/);
                        reps = rest.split('(')[0].trim();
                        if (rirMatch) rir = rirMatch[1];
                    }
                } catch (e) {}

                rowsHtml += `
                <div class="history-row">
                    <div class="history-col set-idx">#${idx + 1}</div>
                    <div class="history-col">${weight}</div>
                    <div class="history-col">${reps}</div>
                    <div class="history-col rir-note">${rir}</div>
                </div>`;
            });

            if (hasAnyNotes) {
                notesHtml = `<div class="history-notes-list">`;
                notesList.forEach((note, i) => {
                    notesHtml += `<div class="note-item"><span class="note-num">${i + 1}.</span> ${note}</div>`;
                });
                notesHtml += `</div>`;
            }

            const gridHtml = `
            <div class="history-card-container">
                <div class="text-sm color-dim text-right mb-sm">ביצוע אחרון: ${history.date}</div>
                <div class="history-header">
                    <div>סט</div><div>משקל</div><div>חזרות</div><div>RIR</div>
                </div>
                <div class="history-list">${rowsHtml}</div>
                ${notesHtml}
            </div>`;
            historyContainer.innerHTML = gridHtml;
        }
    }

    navigate('ui-confirm');
    StorageManager.saveSessionState();
}

// ─── WORKOUT EXECUTION ─────────────────────────────────────────────────────

function confirmExercise(doEx) {
    if (state.clusterMode && state.clusterIdx === 0 && document.getElementById('confirm-ex-name').innerText.includes("Cluster")) {
        const firstExItem = state.activeCluster.exercises[0];
        const exData = state.exercises.find(e => e.name === firstExItem.name);

        state.currentEx = JSON.parse(JSON.stringify(exData));
        state.currentExName = exData.name;

        if (firstExItem.restTime) state.currentEx.restTime = firstExItem.restTime;
        if (firstExItem.targetWeight) state.currentEx.targetWeight = firstExItem.targetWeight;
        if (firstExItem.targetReps) state.currentEx.targetReps = firstExItem.targetReps;
        if (firstExItem.targetRIR) state.currentEx.targetRIR = firstExItem.targetRIR;

        resizeSets(1);
        startRecording();
        return;
    }

    if (!doEx) {
        state.log.push({
            skip: true,
            exName: state.currentExName,
            isCluster: state.clusterMode,
            round: state.clusterMode ? state.clusterRound : null
        });
        if (!state.clusterMode) state.completedExInSession.push(state.currentExName);
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
    state.currentEx.sets = Array(count).fill({ w: defaultWeight, r: defaultReps });
}

function setupCalculatedEx() {
    document.getElementById('rm-title').innerText = `${state.currentExName} 1RM`;
    const lastRM = StorageManager.getLastRM(state.currentExName);
    const baseRM = state.currentEx.baseRM || 50;
    const p = document.getElementById('rm-picker'); p.innerHTML = "";
    const defaultRM = lastRM ? lastRM : baseRM;
    for (let i = 20; i <= 200; i += 2.5) {
        let o = new Option(i + " kg", i); if (i === defaultRM) o.selected = true; p.add(o);
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
    const existingLogs = state.log.filter(l => l.exName === state.currentExName && !l.skip && !l.isWarmup);

    if (existingLogs.length > 0 && !state.clusterMode) {
        state.setIdx = existingLogs.length;
        state.lastLoggedSet = existingLogs[existingLogs.length - 1];
    } else {
        state.setIdx = 0;
        state.lastLoggedSet = null;
    }

    const actionPanel = document.getElementById('action-panel');
    actionPanel.style.display = 'none';
    actionPanel.classList.remove('is-visible');

    document.getElementById('btn-submit-set').style.display = 'block';

    navigate('ui-main');
    initPickers();
    StorageManager.saveSessionState();
}

function isUnilateral(exName) {
    const exData = state.exercises.find(e => e.name === exName);
    if (exData && exData.isUnilateral !== undefined) return exData.isUnilateral;
    return unilateralKeywords.some(keyword => exName.includes(keyword));
}

// ─── INIT PICKERS ──────────────────────────────────────────────────────────

function initPickers() {
    document.getElementById('ex-display-name').innerText = state.currentExName;
    const exHeader = document.querySelector('.exercise-header');
    const existingQueue = document.querySelector('.cluster-queue-container');
    if (existingQueue) existingQueue.remove();

    // Compact mode for cluster
    const uiMain = document.getElementById('ui-main');
    if (state.clusterMode) uiMain.classList.add('cluster');
    else uiMain.classList.remove('cluster');

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

    let defaultW = 0;
    let defaultR = 8;
    let defaultRIR = 2;

    if (state.currentEx.isCalc) {
        defaultW = target.w;
        defaultR = target.r;
        defaultRIR = 2;
    } else if (state.setIdx > 0 && state.lastLoggedSet) {
        defaultW = state.lastLoggedSet.w;
        defaultR = state.lastLoggedSet.r;
        defaultRIR = state.lastLoggedSet.rir;
    } else {
        const sessionHistory = state.log.filter(l => l.exName === state.currentExName && !l.skip && !l.isWarmup);

        if (sessionHistory.length > 0) {
            const lastSessionEntry = sessionHistory[sessionHistory.length - 1];
            defaultW = lastSessionEntry.w;
            defaultR = lastSessionEntry.r;
            defaultRIR = lastSessionEntry.rir;
        } else {
            let planW = state.currentEx.targetWeight;
            let planR = state.currentEx.targetReps;
            let planRIR = state.currentEx.targetRIR;

            const savedWeight = StorageManager.getLastWeight(state.currentExName);
            const manualRange = state.currentEx.manualRange || {};

            if (planW !== undefined) {
                defaultW = planW;
            } else if (savedWeight) {
                defaultW = savedWeight;
            } else if (target && target.w) {
                defaultW = target.w;
            } else if (manualRange.base) {
                defaultW = manualRange.base;
            }

            if (planR !== undefined) {
                defaultR = planR;
            } else if (target && target.r) {
                defaultR = target.r;
            }

            if (planRIR !== undefined) {
                defaultRIR = planRIR;
            }
        }
    }

    const hist = document.getElementById('last-set-info');
    if (state.lastLoggedSet) {
        hist.innerText = `סט אחרון: ${state.lastLoggedSet.w}kg x ${state.lastLoggedSet.r} (RIR ${state.lastLoggedSet.rir})`;
        hist.style.display = 'block';
    } else {
        hist.style.display = 'none';
    }

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

    const wPick = document.getElementById('weight-picker'); wPick.innerHTML = "";
    const manualRange = state.currentEx.manualRange || {};
    const step = state.currentEx.step || 2.5;

    let minW = manualRange.min !== undefined ? manualRange.min : (state.currentEx.minW !== undefined ? state.currentEx.minW : Math.max(0, defaultW - 40));
    let maxW = manualRange.max !== undefined ? manualRange.max : (state.currentEx.maxW !== undefined ? state.currentEx.maxW : defaultW + 50);
    if (minW < 0) minW = 0;

    for (let i = minW; i <= maxW; i = parseFloat((i + step).toFixed(2))) {
        let o = new Option(i + " kg", i); if (i === defaultW) o.selected = true; wPick.add(o);
    }

    const rPick = document.getElementById('reps-picker'); rPick.innerHTML = "";
    for (let i = 1; i <= 30; i++) { let o = new Option(i, i); if (i === defaultR) o.selected = true; rPick.add(o); }

    const rirPick = document.getElementById('rir-picker'); rirPick.innerHTML = "";
    [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5].forEach(v => {
        let o = new Option(v === 0 ? "Fail" : v, v);
        if (parseFloat(v) === parseFloat(defaultRIR)) o.selected = true;
        rirPick.add(o);
    });
}

// ─── TIMER ─────────────────────────────────────────────────────────────────

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
        if (text) text.innerText = `${mins}:${secs}`;
        if (circle) circle.style.strokeDashoffset = 283 - (progress * 283);
        if (clusterText) clusterText.innerText = `${mins}:${secs}`;
        if (clusterBar) clusterBar.style.strokeDashoffset = 283 - (progress * 283);
    };

    state.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
        state.seconds = elapsed;
        const mins = Math.floor(state.seconds / 60).toString().padStart(2, '0');
        const secs = (state.seconds % 60).toString().padStart(2, '0');
        const progress = Math.min(state.seconds / target, 1);
        updateUI(mins, secs, progress);
        if (state.seconds === target) playBeep(2);
    }, 100);

    StorageManager.saveSessionState();
}

function stopRestTimer() { if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; } }

// ─── NEXT STEP (LOG SET) ───────────────────────────────────────────────────

function nextStep() {
    haptic('medium');

    const btn = document.getElementById('btn-submit-set');
    if (btn) {
        btn.classList.remove('click-feedback');
        void btn.offsetWidth;
        btn.classList.add('click-feedback');
        setTimeout(() => btn.classList.remove('click-feedback'), 300);
    }

    const wVal = parseFloat(document.getElementById('weight-picker').value);
    const noteVal = document.getElementById('set-notes').value.trim();

    const entry = {
        exName: state.currentExName,
        w: wVal,
        r: parseInt(document.getElementById('reps-picker').value),
        rir: document.getElementById('rir-picker').value,
        note: noteVal,
        isCluster: state.clusterMode,
        round: state.clusterMode ? state.clusterRound : null
    };

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

            if (nextExItem.restTime) state.currentEx.restTime = nextExItem.restTime;
            if (nextExItem.targetWeight) state.currentEx.targetWeight = nextExItem.targetWeight;
            if (nextExItem.targetReps) state.currentEx.targetReps = nextExItem.targetReps;
            if (nextExItem.targetRIR) state.currentEx.targetRIR = nextExItem.targetRIR;

            state.currentEx.sets = [{ w: 10, r: 10 }];
            state.setIdx = 0; state.lastLoggedSet = null;
            initPickers();
            document.getElementById('timer-area').style.visibility = 'visible';
            resetAndStartTimer(state.lastClusterRest);
            return;
        } else {
            finishCurrentExercise(); return;
        }
    }

    if (state.setIdx < state.currentEx.sets.length - 1) {
        state.setIdx++; initPickers();
        document.getElementById('timer-area').style.visibility = 'visible';
        resetAndStartTimer();
    } else {
        document.getElementById('btn-submit-set').style.display = 'none';
        document.getElementById('btn-skip-exercise').style.display = 'none';

        const actionPanel = document.getElementById('action-panel');
        actionPanel.style.display = 'block';
        actionPanel.classList.remove('is-visible');
        void actionPanel.offsetWidth;
        actionPanel.classList.add('is-visible');

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
            showConfirmScreen();
        } else if (state.isExtraPhase) {
            if (typeof updateVariationUI === 'function') updateVariationUI();
            if (typeof renderFreestyleChips === 'function') renderFreestyleChips();
            if (typeof renderFreestyleList === 'function') renderFreestyleList();
            navigate('ui-variation');
            StorageManager.saveSessionState();
        } else if (state.isFreestyle) {
            navigate('ui-variation');
            if (typeof updateVariationUI === 'function') updateVariationUI();
            if (typeof renderFreestyleChips === 'function') renderFreestyleChips();
            if (typeof renderFreestyleList === 'function') renderFreestyleList();
            StorageManager.saveSessionState();
        } else {
            state.exIdx++;
            checkFlow();
        }
    }
}

// ─── CLUSTER ───────────────────────────────────────────────────────────────

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
    listDiv.innerHTML = state.activeCluster.exercises.map((e, i) => `<div>${i + 1}. ${e.name}</div>`).join('');
}

function startNextRound() {
    state.clusterRound++; state.clusterIdx = 0; stopRestTimer();

    const nextExItem = state.activeCluster.exercises[0];
    const exData = state.exercises.find(e => e.name === nextExItem.name);

    state.currentEx = JSON.parse(JSON.stringify(exData));
    state.currentExName = exData.name;

    if (nextExItem.restTime) state.currentEx.restTime = nextExItem.restTime;
    if (nextExItem.targetWeight) state.currentEx.targetWeight = nextExItem.targetWeight;
    if (nextExItem.targetReps) state.currentEx.targetReps = nextExItem.targetReps;
    if (nextExItem.targetRIR) state.currentEx.targetRIR = nextExItem.targetRIR;

    state.currentEx.sets = [{ w: 10, r: 10 }];
    startRecording();
}

function addExtraRound() { state.activeCluster.rounds++; renderClusterRestUI(); StorageManager.saveSessionState(); }

function finishCluster() {
    state.clusterMode = false; state.activeCluster = null;
    document.getElementById('ui-main').classList.remove('cluster');
    state.exIdx++;
    checkFlow();
}

// ─── SKIP / EXTRA SET ──────────────────────────────────────────────────────

function skipCurrentExercise() {
    showConfirm("לדלג על תרגיל זה ולעבור לבא?", () => {
        state.log.push({
            skip: true,
            exName: state.currentExName,
            isCluster: state.clusterMode,
            round: state.clusterMode ? state.clusterRound : null
        });

        if (state.clusterMode) {
            if (state.clusterIdx < state.activeCluster.exercises.length - 1) {
                state.clusterIdx++;

                const nextExItem = state.activeCluster.exercises[state.clusterIdx];
                const exData = state.exercises.find(e => e.name === nextExItem.name);

                state.currentEx = JSON.parse(JSON.stringify(exData));
                state.currentExName = exData.name;

                if (nextExItem.restTime) state.currentEx.restTime = nextExItem.restTime;
                if (nextExItem.targetWeight) state.currentEx.targetWeight = nextExItem.targetWeight;
                if (nextExItem.targetReps) state.currentEx.targetReps = nextExItem.targetReps;
                if (nextExItem.targetRIR) state.currentEx.targetRIR = nextExItem.targetRIR;

                state.currentEx.sets = [{ w: 10, r: 10 }];
                state.setIdx = 0; state.lastLoggedSet = null;
                initPickers();
                resetAndStartTimer(state.lastClusterRest || 30);
            } else {
                finishCurrentExercise();
            }
        } else {
            finishCurrentExercise();
        }
    });
}

function finishClusterRound() {
    showConfirm("האם לסיים את הסבב הנוכחי ולדלג על יתר התרגילים?", () => {
        state.log.push({
            skip: true,
            exName: state.currentExName,
            isCluster: state.clusterMode,
            round: state.clusterMode ? state.clusterRound : null
        });

        for (let i = state.clusterIdx + 1; i < state.activeCluster.exercises.length; i++) {
            state.log.push({
                skip: true,
                exName: state.activeCluster.exercises[i].name,
                isCluster: state.clusterMode,
                round: state.clusterMode ? state.clusterRound : null
            });
        }
        handleClusterFlow();
    });
}

function addExtraSet() {
    state.setIdx++;
    state.currentEx.sets.push({ ...state.currentEx.sets[state.setIdx - 1] });

    const actionPanel = document.getElementById('action-panel');
    actionPanel.style.display = 'none';
    actionPanel.classList.remove('is-visible');

    document.getElementById('btn-submit-set').style.display = 'block';
    initPickers();
    document.getElementById('timer-area').style.visibility = 'visible';
    resetAndStartTimer();
}

// ─── INTERRUPTION / EXTRA PHASE ────────────────────────────────────────────

function interruptWorkout() {
    state.isInterruption = true;
    if (typeof updateVariationUI === 'function') updateVariationUI();
    if (typeof renderFreestyleChips === 'function') renderFreestyleChips();
    if (typeof renderFreestyleList === 'function') renderFreestyleList();
    navigate('ui-variation');
    StorageManager.saveSessionState();
}

function resumeWorkout() {
    state.isInterruption = false;
    showConfirmScreen();
}

function startExtraPhase() {
    state.isExtraPhase = true;
    if (typeof updateVariationUI === 'function') updateVariationUI();
    if (typeof renderFreestyleChips === 'function') renderFreestyleChips();
    if (typeof renderFreestyleList === 'function') renderFreestyleList();
    navigate('ui-variation');
    StorageManager.saveSessionState();
}

function finishExtraPhase() {
    if (typeof finish === 'function') finish();
}

// ─── FREESTYLE ─────────────────────────────────────────────────────────────

function startFreestyle() {
    state.type = 'Freestyle'; state.log = []; state.completedExInSession = [];
    state.isFreestyle = true; state.isExtraPhase = false; state.isInterruption = false;
    state.workoutStartTime = Date.now();

    state.freestyleFilter = 'all';
    document.getElementById('freestyle-search').value = '';

    if (typeof updateVariationUI === 'function') updateVariationUI();
    navigate('ui-variation');

    if (typeof renderFreestyleChips === 'function') renderFreestyleChips();
    if (typeof renderFreestyleList === 'function') renderFreestyleList();

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

    filtered.sort((a, b) => a.name.localeCompare(b.name));

    if (filtered.length === 0) {
        options.innerHTML = state.freestyleFilter === 'בוצעו'
            ? `<p class="text-center color-dim mt-md">טרם בוצעו תרגילים</p>`
            : `<p class="text-center color-dim mt-md">לא נמצאו תרגילים</p>`;
        return;
    }

    filtered.forEach(ex => {
        const btn = document.createElement('button');
        btn.className = "menu-card";
        btn.innerHTML = `<span>${ex.name}</span><div class="chevron"></div>`;
        btn.onclick = () => {
            state.currentEx = JSON.parse(JSON.stringify(ex));
            state.currentExName = ex.name;
            if (!state.currentEx.sets || state.currentEx.sets.length < 3) state.currentEx.sets = [{ w: 10, r: 10 }, { w: 10, r: 10 }, { w: 10, r: 10 }];
            startRecording();
        };
        options.appendChild(btn);
    });
}

// ─── SWAP MENU ─────────────────────────────────────────────────────────────

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
    titleOrder.className = "section-label mt-lg";
    titleOrder.innerText = `שאר האימון (החלף סדר)`;
    container.appendChild(titleOrder);

    const remaining = workoutList.map((item, idx) => ({ item, idx })).filter(({ idx }) => idx > state.exIdx);

    if (remaining.length === 0) {
        const empty = document.createElement('p');
        empty.className = "text-center color-dim";
        empty.innerText = 'אין תרגילים נוספים להחלפה';
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

// ─── WARMUP ────────────────────────────────────────────────────────────────

function calcWarmup() {
    const targetW = parseFloat(document.getElementById('weight-picker').value);
    const list = document.getElementById('warmup-list'); list.innerHTML = "";
    const percentages = [0, 0.4, 0.6, 0.8];
    percentages.forEach((pct, idx) => {
        let w; let reps;
        if (idx === 0) { w = 20; reps = 10; }
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

    // Restore warmup-specific title and buttons
    const modal = document.getElementById('warmup-modal');
    const titleEl = modal.querySelector('h3');
    if (titleEl) titleEl.textContent = 'חימום מומלץ';
    const mainBtn = modal.querySelector('.btn-main');
    const dangerBtn = modal.querySelector('.btn-text.color-danger');
    if (mainBtn) { mainBtn.textContent = 'סיימתי חימום'; mainBtn.onclick = markWarmupDone; }
    if (dangerBtn) dangerBtn.style.display = '';

    modal.style.display = 'flex';
}

function closeWarmup() { document.getElementById('warmup-modal').style.display = 'none'; }
function markWarmupDone() { state.log.push({ exName: state.currentExName, isWarmup: true }); StorageManager.saveSessionState(); closeWarmup(); }

// ─── FINISH WORKOUT & SUMMARY ──────────────────────────────────────────────

function finish() {
    stopRestTimer();
    state.workoutDurationMins = state.workoutStartTime ? Math.round((Date.now() - state.workoutStartTime) / 60000) : 0;

    const summaryNote = document.getElementById('summary-note');
    if (summaryNote) summaryNote.value = '';

    navigate('ui-summary');
    buildSummaryUI();
    StorageManager.saveSessionState();
}

function buildSummaryUI() {
    const area = document.getElementById('summary-area');
    if (!area) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

    // Group log by exercise
    const exMap = {};
    state.log.forEach(entry => {
        if (entry.isWarmup) return;
        if (!exMap[entry.exName]) exMap[entry.exName] = { sets: [], skipped: entry.skip || false };
        if (!entry.skip) exMap[entry.exName].sets.push(entry);
        else exMap[entry.exName].skipped = true;
    });

    let totalVol = 0;
    let totalSets = 0;

    let html = `<div class="summary-overview-card">
        <div class="summary-overview-col"><div class="summary-overview-val">${state.type}</div><div class="summary-overview-label">סוג אימון</div></div>
        <div class="summary-overview-col"><div class="summary-overview-val">${state.workoutDurationMins}m</div><div class="summary-overview-label">משך</div></div>
        <div class="summary-overview-col"><div class="summary-overview-val">${dateStr}</div><div class="summary-overview-label">${timeStr}</div></div>
    </div>`;

    Object.entries(exMap).forEach(([exName, data]) => {
        if (data.sets.length === 0) return;
        let exVol = 0;
        let setRows = '';
        data.sets.forEach((s, i) => {
            const vol = s.w * s.r;
            exVol += vol;
            totalSets++;
            setRows += `<div class="summary-set-row">
                <div class="summary-set-num">${i + 1}</div>
                <div class="summary-set-details">${s.w}kg x ${s.r} (RIR ${s.rir}${s.note ? ` | ${s.note}` : ''})</div>
            </div>`;
        });
        totalVol += exVol;
        const volStr = exVol >= 1000 ? (exVol / 1000).toFixed(1) + 't' : exVol + 'kg';
        html += `<div class="summary-ex-card">
            <div class="summary-ex-header">
                <div class="summary-ex-title">${exName}</div>
                <div class="summary-ex-vol">${volStr}</div>
            </div>
            ${setRows}
        </div>`;
    });

    area.innerHTML = html;

    // Update overview total vol
    const volStr = totalVol >= 1000 ? (totalVol / 1000).toFixed(1) + 't' : totalVol + 'kg';
    const overview = area.querySelector('.summary-overview-card');
    if (overview) {
        const cols = overview.querySelectorAll('.summary-overview-col');
        if (cols[1]) {
            cols[1].querySelector('.summary-overview-val').textContent = state.workoutDurationMins + 'm';
        }
    }
}

function copyResult() {
    const note = (document.getElementById('summary-note') ? document.getElementById('summary-note').value.trim() : '');
    _saveToArchive(note);

    // Copy summary to clipboard
    const archive = StorageManager.getArchive();
    if (archive.length > 0) {
        const summaryText = archive[0].summary || '';
        if (navigator.clipboard) {
            navigator.clipboard.writeText(summaryText).catch(() => {});
        } else {
            try {
                const el = document.createElement('textarea');
                el.value = summaryText;
                document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
            } catch (e) {}
        }
    }

    StorageManager.clearSessionState();
    haptic('success');
    window.location.reload();
}

function _saveToArchive(note) {
    const now = new Date();
    const dateStr = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
    const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    const archiveDateStr = now.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });

    // Build ordered exMap preserving log insertion order
    const exOrder = [];
    const exMap = {};
    state.log.forEach(entry => {
        if (entry.isWarmup) return;
        const key = entry.exName;
        if (!exMap[key]) { exMap[key] = { sets: [], skips: 0, isMain: false }; exOrder.push(key); }
        if (!entry.skip) {
            const rir = entry.rir !== undefined ? entry.rir : '—';
            const noteStr = entry.note ? ` | Note: ${entry.note}` : '';
            exMap[key].sets.push(`${entry.w}kg x ${entry.r} (RIR ${rir})${noteStr}`);
        } else {
            exMap[key].skips++;
        }
    });

    // Detect "Main" (isCalc) exercises from plan
    if (state.workouts && state.workouts[state.type]) {
        state.workouts[state.type].forEach(item => {
            if (item.isMain && exMap[item.name]) exMap[item.name].isMain = true;
        });
    }

    // Determine week label
    const weekLabel = state.week === 'deload' ? 'Deload' :
                      state.isFreestyle       ? 'Freestyle' :
                                                `Week ${state.week}`;

    const details = {};
    let totalVol = 0;

    // Header
    const summaryLines = [
        'GYMPRO ELITE SUMMARY',
        `${state.type} | ${weekLabel} | ${dateStr} | ${state.workoutDurationMins}m`,
        ''
    ];
    if (note) { summaryLines.push(`הערה: ${note}`); summaryLines.push(''); }

    exOrder.forEach(exName => {
        const data = exMap[exName];
        let exVol = 0;
        data.sets.forEach(setStr => {
            const core = setStr.includes('| Note:') ? setStr.split('| Note:')[0].trim() : setStr;
            const parts = core.split('x');
            if (parts.length >= 2) {
                const w = parseFloat(parts[0].replace('kg', '').replace('(יד אחת)', '').trim());
                const rMatch = parts[1].match(/\d+/);
                const r = rMatch ? parseInt(rMatch[0]) : 1;
                if (!isNaN(w)) exVol += w * r;
            }
        });
        totalVol += exVol;
        const volStr = exVol >= 1000 ? (exVol / 1000).toFixed(1) + 't' : exVol + 'kg';
        const mainTag = data.isMain ? ' (Main)' : '';
        summaryLines.push(`${exName}${mainTag} (Vol: ${volStr}):`);
        data.sets.forEach(s => summaryLines.push(s));
        if (data.skips > 0) summaryLines.push('(Skipped)');
        summaryLines.push('');
        details[exName] = { sets: data.sets, vol: exVol };
    });

    const archiveEntry = {
        timestamp: Date.now(),
        date: archiveDateStr,
        time: timeStr,
        type: state.type,
        duration: state.workoutDurationMins,
        summary: summaryLines.join('\n').trimEnd(),
        details,
        note
    };

    StorageManager.saveToArchive(archiveEntry);
    haptic('success');
}

// ─── SESSION LOG DRAWER ────────────────────────────────────────────────────

function openSessionLog() {
    const modal = document.getElementById('warmup-modal');
    const list = document.getElementById('warmup-list');
    list.innerHTML = "";

    const realSets = state.log.filter(l => !l.skip && !l.isWarmup);

    if (realSets.length === 0) {
        list.innerHTML = '<p class="text-center color-dim">טרם נרשמו סטים</p>';
    } else {
        // Group sets by exercise name, preserving insertion order
        const exOrder = [];
        const exGroups = {};
        realSets.forEach((entry, i) => {
            if (!exGroups[entry.exName]) {
                exGroups[entry.exName] = [];
                exOrder.push(entry.exName);
            }
            exGroups[entry.exName].push({ entry, globalIdx: i });
        });

        const dotColors = ['var(--accent)', 'var(--type-b)', 'var(--type-c)', 'var(--type-free)'];

        exOrder.forEach((exName, colorIdx) => {
            const dot = dotColors[colorIdx % dotColors.length];

            // Group header
            const header = document.createElement('div');
            header.style.cssText = `display:flex;align-items:center;gap:8px;padding:10px 0 6px;${colorIdx > 0 ? 'border-top:0.5px solid rgba(255,255,255,0.08);margin-top:4px;' : ''}`;
            header.innerHTML = `<div style="width:7px;height:7px;border-radius:50%;background:${dot};flex-shrink:0;"></div><span style="font-size:0.9em;font-weight:600;color:var(--text);">${exName}</span>`;
            list.appendChild(header);

            // Set rows under this group
            exGroups[exName].forEach(({ entry, globalIdx }, setNum) => {
                const row = document.createElement('div');
                row.className = 'warmup-row';
                row.setAttribute('data-idx', globalIdx);
                row.style.paddingRight = '15px';
                row.innerHTML = `
                    <span style="font-size:0.8em;color:var(--text-dim);min-width:36px;flex-shrink:0;">סט ${setNum + 1}</span>
                    <span style="flex:1;font-size:0.88em;color:var(--text-dim);">${entry.w}kg × ${entry.r} • RIR ${entry.rir}${entry.note ? ' · ' + entry.note : ''}</span>
                    <span style="font-size:0.82em;color:var(--accent);cursor:pointer;flex-shrink:0;" onclick="openEditSetModal(${globalIdx})">ערוך</span>`;
                list.appendChild(row);
            });
        });
    }

    // Update title
    const titleEl = modal.querySelector('h3');
    if (titleEl) titleEl.textContent = 'יומן אימון';

    // Override buttons for log context
    const mainBtn = modal.querySelector('.btn-main');
    const dangerBtn = modal.querySelector('.btn-text.color-danger');
    if (mainBtn) { mainBtn.textContent = 'סגור יומן'; mainBtn.onclick = closeWarmup; }
    if (dangerBtn) dangerBtn.style.display = 'none';

    modal.style.display = 'flex';
}

function openHistoryDrawer() {
    if (!state.currentExName) return;
    const history = (typeof getLastPerformance === 'function') ? getLastPerformance(state.currentExName) : null;
    const content = document.getElementById('sheet-content');
    const overlay = document.getElementById('sheet-overlay');
    const drawer  = document.getElementById('sheet-modal');

    let html = `<h3 style="margin:0 0 10px;">${state.currentExName}</h3>`;

    if (!history || !history.sets || history.sets.length === 0) {
        html += `<p class="color-dim text-sm">אין ביצוע קודם בארכיון</p>`;
    } else {
        html += `<div class="text-xs color-dim mb-sm">ביצוע אחרון: ${history.date}</div>`;
        html += `<div class="history-card-container">
            <div class="history-header"><div>סט</div><div>משקל</div><div>חזרות</div><div>RIR</div></div>
            <div class="history-list">`;
        history.sets.forEach((setStr, idx) => {
            let weight = '-', reps = '-', rir = '-';
            try {
                const core = setStr.includes('| Note:') ? setStr.split('| Note:')[0].trim() : setStr;
                const parts = core.split('x');
                if (parts.length > 1) {
                    weight = parts[0].replace('kg', '').trim();
                    const rirMatch = parts[1].match(/\(RIR (.*?)\)/);
                    reps = parts[1].split('(')[0].trim();
                    if (rirMatch) rir = rirMatch[1];
                }
            } catch (e) {}
            html += `<div class="history-row">
                <div class="history-col set-idx">#${idx + 1}</div>
                <div class="history-col">${weight}</div>
                <div class="history-col">${reps}</div>
                <div class="history-col rir-note">${rir}</div>
            </div>`;
        });
        html += `</div></div>`;
    }

    content.innerHTML = html;
    overlay.style.display = 'block';
    drawer.classList.add('open');
    haptic('light');
}

let _editSetRealIdx = -1;

function openEditSetModal(realIdx) {
    _editSetRealIdx = realIdx;
    const realSets = state.log.filter(l => !l.skip && !l.isWarmup);
    const entry = realSets[realIdx];
    if (!entry) return;

    document.getElementById('warmup-modal').style.display = 'none';
    document.getElementById('edit-weight').value = entry.w;
    document.getElementById('edit-reps').value = entry.r;
    document.getElementById('edit-rir').value = entry.rir;
    document.getElementById('edit-note').value = entry.note || '';
    document.getElementById('edit-set-modal').style.display = 'flex';
}

function saveSetEdit() {
    const realSets = state.log.filter(l => !l.skip && !l.isWarmup);
    const entry = realSets[_editSetRealIdx];
    if (!entry) return;
    entry.w = parseFloat(document.getElementById('edit-weight').value);
    entry.r = parseInt(document.getElementById('edit-reps').value);
    entry.rir = document.getElementById('edit-rir').value;
    entry.note = document.getElementById('edit-note').value.trim();
    closeEditModal();
    StorageManager.saveSessionState();
}

function deleteSetFromLog() {
    const realSets = state.log.filter(l => !l.skip && !l.isWarmup);
    const entry = realSets[_editSetRealIdx];
    if (!entry) return;
    const logIdx = state.log.indexOf(entry);
    if (logIdx !== -1) state.log.splice(logIdx, 1);
    closeEditModal();
    StorageManager.saveSessionState();
}

function closeEditModal() { document.getElementById('edit-set-modal').style.display = 'none'; }

// ─── EXERCISE SETTINGS ─────────────────────────────────────────────────────

let _editingRestEx = null;

function openExerciseSettings() {
    const planItem = state.clusterMode
        ? state.activeCluster.exercises[state.clusterIdx]
        : state.workouts[state.type][state.exIdx];
    _editingRestEx = planItem;

    document.getElementById('ex-settings-title').innerText = `הגדרות: ${state.currentExName}`;
    document.getElementById('target-weight-input').value = planItem.targetWeight || '';
    document.getElementById('target-reps-input').value = planItem.targetReps || '';
    document.getElementById('target-rir-input').value = planItem.targetRIR || '';
    document.getElementById('rest-time-display').innerText = (planItem.restTime || 90) + 's';
    document.getElementById('exercise-settings-modal').style.display = 'flex';
}

function changeRestTime(delta) {
    if (!_editingRestEx) return;
    _editingRestEx.restTime = Math.max(15, (_editingRestEx.restTime || 90) + delta);
    document.getElementById('rest-time-display').innerText = _editingRestEx.restTime + 's';
}

function saveExerciseSettings() {
    if (!_editingRestEx) return;
    const tw = document.getElementById('target-weight-input').value;
    const tr = document.getElementById('target-reps-input').value;
    const trir = document.getElementById('target-rir-input').value;
    if (tw) { _editingRestEx.targetWeight = parseFloat(tw); state.currentEx.targetWeight = parseFloat(tw); }
    if (tr) { _editingRestEx.targetReps = parseInt(tr); state.currentEx.targetReps = parseInt(tr); }
    if (trir) { _editingRestEx.targetRIR = parseFloat(trir); state.currentEx.targetRIR = parseFloat(trir); }
    StorageManager.saveSessionState();
    closeExerciseSettings();
    initPickers();
}

function closeExerciseSettings() { document.getElementById('exercise-settings-modal').style.display = 'none'; }

// ─── RESET ─────────────────────────────────────────────────────────────────

function resetToFactorySettings() {
    showConfirm("האם לאפס את כל הנתונים? פעולה זו בלתי הפיכה.", () => {
        StorageManager.resetToFactory();
        showAlert("האפליקציה אופסה. טוען מחדש...", () => {
            window.location.reload();
        });
    });
}
