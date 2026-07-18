/**
 * GYMPRO ELITE - WORKOUT CORE LOGIC
 * (הגרסה הנוכחית: ראה version.json)
 * שדרוגים: החלפת תרגיל חופשית, חזרה מבחר אימון, פידבק סיום, כפתור רענון, תיקוני חוב.
 */

// ─── CLOUD TOAST ──────────────────────────────────────────────────────────

let _cloudToastTimer = null;
function showCloudToast(msg, success) {
    const t = document.getElementById('cloud-toast');
    if (!t) return;
    if (_cloudToastTimer) clearTimeout(_cloudToastTimer);
    t.textContent = msg;
    t.className = 'cloud-toast ' + (success ? 'success' : 'error');
    // force reflow להתחלת אנימציה מחדש אם נקרא שוב
    void t.offsetWidth;
    t.classList.add('show');
    _cloudToastTimer = setTimeout(() => {
        t.classList.remove('show');
        _cloudToastTimer = null;
    }, 3000);
}

// באנר התראה מתמשך כשהגיבוי האחרון לענן נכשל (#3) — מוצג ב-load, לא קשור ללוגיקת ההעתקה.
// v17.15: מכסה את כל ארבעת מסלולי הסנכרון + אזהרת גודל מקדימה (התקרבות ל-1MB/doc).
function maybeShowCloudSyncBanner() {
    if (typeof FirebaseManager === 'undefined' || !FirebaseManager.isConfigured()) return;
    const sync = FirebaseManager.getSyncStatus();
    if (!sync) return;
    const labels = { archive: 'ארכיון אימונים', config: 'נתונים ותזונה', raw: 'קובץ MFP', ai: 'שיחות AI' };
    const failed = Object.keys(labels).filter(s => sync[s + 'Ok'] === false);
    const warned = ['config', 'ai'].filter(s => sync[s + 'Warn']);
    if (!failed.length && !warned.length) return;
    const banner = document.getElementById('cloud-sync-banner');
    if (!banner) return;
    const txt = banner.querySelector('.csb-text');
    if (txt) {
        if (failed.length) {
            const why = failed.some(s => sync[s + 'Err'] === 'size') ? ' (מסמך גדול מדי)' : '';
            txt.textContent = 'הגיבוי לענן נכשל: ' + failed.map(s => labels[s]).join(', ') + why +
                              '. הנתונים נשמרו במכשיר אך לא בענן.';
        } else {
            const pct = Math.round(Math.max(...warned.map(s => sync[s + 'Warn'])) / 1048576 * 100);
            txt.textContent = `מסמך הגיבוי בענן הגיע ל-${pct}% ממגבלת Firestore — הגיבוי ימשיך לעבוד, אבל כדאי לפנות מקום בקרוב.`;
        }
    }
    banner.classList.add('show');
}

// דיווח כשל שמירה לענן מנקודות סנכרון-רקע — כשל לעולם לא שקט (v17.15).
// דילוג מכוון (Firebase לא מוגדר / sync לא חמוש) איננו כשל ולכן לא מדווח.
function notifyCloudSaveFailure(ok, store, label) {
    if (ok || typeof FirebaseManager === 'undefined') return;
    if (!FirebaseManager.isConfigured() || !FirebaseManager._isSyncArmed()) return;
    showCloudToast('⚠️ ' + label + ' נכשל — ' + FirebaseManager.describeSyncFailure(store), false);
}

function dismissCloudSyncBanner() {
    const banner = document.getElementById('cloud-sync-banner');
    if (banner) banner.classList.remove('show');
}

// ─── HTML ESCAPING ─────────────────────────────────────────────────────────
// escapeHtml — לכל הזרקת טקסט-משתמש (שמות אימון/תרגיל, הערות) ל-innerHTML.
// escapeJsAttr — לשם שמוטמע כ-string literal בתוך onclick inline (גרשיים ולוכסנים).
function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeJsAttr(s) {
    return escapeHtml(String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

// ─── CUSTOM MODAL SYSTEM ───────────────────────────────────────────────────

// השמה ל-onclick (ולא addEventListener) — קריאה חופפת בזמן שהמודאל פתוח מחליפה
// את ה-handler במקום לערום אותו; לחיצת OK אחת לא תריץ callbacks ישנים שנערמו.
function showAlert(msg, onOk) {
    const modal = document.getElementById('custom-alert-modal');
    document.getElementById('custom-alert-msg').textContent = msg;
    modal.style.display = 'flex';
    const okBtn = document.getElementById('custom-alert-ok');
    okBtn.onclick = () => {
        modal.style.display = 'none';
        okBtn.onclick = null;
        if (typeof onOk === 'function') onOk();
    };
}

function showConfirm(msg, onOk, onCancel) {
    const modal = document.getElementById('custom-confirm-modal');
    document.getElementById('custom-confirm-msg').textContent = msg;
    modal.style.display = 'flex';
    const okBtn = document.getElementById('custom-confirm-ok');
    const cancelBtn = document.getElementById('custom-confirm-cancel');

    const cleanup = () => {
        modal.style.display = 'none';
        okBtn.onclick = null;
        cancelBtn.onclick = null;
    };
    okBtn.onclick = () => { cleanup(); if (typeof onOk === 'function') onOk(); };
    cancelBtn.onclick = () => { cleanup(); if (typeof onCancel === 'function') onCancel(); };
}

// ─── HELPER: Substitute groups ─────────────────────────────────────────────

function getSubstitutes(exName) {
    const group = substituteGroups.find(g => g.includes(exName));
    return group ? group.filter(n => n !== exName) : [];
}

function isExOrVariationDone(originalName, plannedNames = null) {
    if (state.completedExInSession.includes(originalName)) return true;
    const group = substituteGroups.find(g => g.includes(originalName));
    // וריאציה שהושלמה "מכסה" את התרגיל רק אם היא לא תרגיל מתוכנן בפני עצמו באימון —
    // אחרת אימון שכולל שני תרגילים מאותה קבוצת תחליפים ידלג על השני
    if (group) return group.some(varName =>
        varName !== originalName &&
        state.completedExInSession.includes(varName) &&
        (!plannedNames || !plannedNames.includes(varName))
    );
    return false;
}

// ─── UTILITY ───────────────────────────────────────────────────────────────

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

// ── Exercise Card Helpers (Kinetic Precision) ──

/** ראשי תיבות משם תרגיל: "Bench Press (Main)" → "BP" */
function getExInitials(name) {
    const clean = name.replace(/\(.*?\)/g, '').trim();
    const words = clean.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return words.map(w => w[0].toUpperCase()).join('').substring(0, 2);
}

/** שם שריר ראשי בעברית לתצוגת badge */
function getMuscleBadge(muscles) {
    if (!muscles || muscles.length === 0) return '';
    if (muscles.includes('biceps')) return 'יד קדמית';
    if (muscles.includes('triceps')) return 'יד אחורית';
    const hebrew = muscles.filter(m => /[\u0590-\u05FF]/.test(m));
    return hebrew[0] || muscles[0];
}

/** בונה HTML פנימי של כרטיס תרגיל (ללא ה-wrapper החיצוני) */
function buildExCardInner(name, muscles) {
    const initials = getExInitials(name);
    const badge = getMuscleBadge(muscles);
    const tagHTML = badge ? `<span class="ex-card-tag">${badge}</span>` : '';
    return `
        <div class="ex-card-body">
            <div class="ex-card-icon"><span class="ex-card-initials">${initials}</span></div>
            <div class="ex-card-info">
                <div class="ex-card-name">${name}</div>
                ${tagHTML}
            </div>
        </div>
        <div class="ex-card-chevron"></div>`;
}

// ─── GLOBAL STATE ──────────────────────────────────────────────────────────

let state = {
    week: 1, type: '', rm: 100, rmUsed: {}, exIdx: 0, setIdx: 0,
    log: [], currentEx: null, currentExName: '',
    historyStack: ['ui-week'],
    timerInterval: null, seconds: 0, startTime: null,
    isFreestyle: false, isExtraPhase: false, isInterruption: false,
    currentMuscle: '',
    completedExInSession: [],
    workoutStartTime: null, workoutDurationMins: 0, sessionElapsedSecs: 0,
    lastLoggedSet: null,
    lastWorkoutDetails: {},
    archiveView: 'list',
    archiveSubTab: 'workouts',
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

// ─── NAVIGATION CONSTANTS ──────────────────────────────────────────────────
// מקור אמת יחיד — משמש גם ב-navigate() וגם ב-restoreSession()
const WORKOUT_SCREENS = ['ui-workout-type', 'ui-confirm', 'ui-main', 'ui-1rm', 'ui-cluster-rest', 'ui-variation', 'ui-swap-list', 'ui-ask-extra', 'ui-extra-cluster', 'ui-summary'];
const NO_BACK_SCREENS = ['ui-week', 'ui-analytics', 'ui-archive', 'ui-bodylog'];

let audioContext;
let wakeLock = null;
// צלילים כבויים כברירת מחדל — מתנגנים רק אם המשתמש הדליק ידנית את כפתור הצלילים
let soundEnabled = false;

// ─── Wake Lock (v17.12) ─────────────────────────────────────────────────────
// המערכת משחררת את ה-lock אוטומטית במעבר לרקע; בלי מאזין release המשתנה נשאר
// מצביע לאובייקט משוחרר וה-guard חוסם רכישה חוזרת. שחרור ביציאה חוסך סוללה.
async function _acquireWakeLock() {
    try {
        if (!('wakeLock' in navigator) || wakeLock) return;
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) {}
}
function _releaseWakeLock() {
    try { if (wakeLock) { wakeLock.release(); } } catch (e) {}
    wakeLock = null;
}
// רכישה מחדש בחזרה מהרקע — רק כשיש סיבה פעילה (Live פעיל או צלילים דולקים)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (document.body.classList.contains('live-mode-active') || soundEnabled) _acquireWakeLock();
});

// ─── SESSION TIMER ─────────────────────────────────────────────────────────

let _sessionTimerInterval = null;
let _sessionTimerStart = null;   // timestamp של תחילת ה-interval הנוכחי
let _sessionTimerOffset = 0;     // שניות שעברו לפני ה-interval הנוכחי

// ─── AI COACH STATE ────────────────────────────────────────────────────────
let aiChatHistory     = [];    // זיכרון session — מוזרק ל-API (10 אחרונות)
let isAILoading       = false; // מניעת double-submit
let aiFullArchiveMode = false; // מצב ארכיון מלא
let aiAnswerMode      = 'auto'; // אורך תשובה: 'auto' | 'short' | 'deep'
// תצוגת ניקוי שורדת reload — דרך StorageManager.getAIDisplayCutoff()

function startSessionTimer(restoreElapsed) {
    stopSessionTimer();
    // restoreElapsed = שניות שעברו בפועל (משוחזר מ-state)
    _sessionTimerOffset = restoreElapsed || 0;
    _sessionTimerStart = Date.now();
    _updateSessionTimerDisplay();
    // interval ב-500ms לדיוק — כמו טיימר המנוחה
    _sessionTimerInterval = setInterval(_updateSessionTimerDisplay, 500);
}

function stopSessionTimer() {
    if (_sessionTimerInterval) { clearInterval(_sessionTimerInterval); _sessionTimerInterval = null; }
    _sessionTimerStart = null;
}

function _updateSessionTimerDisplay() {
    const el = document.getElementById('session-timer-text');
    if (!el) return;
    // חישוב בזמן אמת מ-Date.now() — ממשיך לספור נכון גם ברקע
    const elapsed = _sessionTimerStart
        ? _sessionTimerOffset + Math.floor((Date.now() - _sessionTimerStart) / 1000)
        : _sessionTimerOffset;
    // שמירת הזמן שעבר ב-state — לשחזור מדויק אחרי הפסקה
    state.sessionElapsedSecs = elapsed;
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    el.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

// ─── שמירת session כשהאפליקציה עוברת לרקע ──────────────────────────────────
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && state.workoutStartTime) {
        StorageManager.saveSessionState();
    }
});

// ─── INITIALIZATION ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    StorageManager.initDB();
    // הגנת סנכרון: מזיינים העלאות לענן רק אם המכשיר כבר מכיל דאטה (מקור-אמת).
    // מצב ריק (אחרי התקנה מחדש) נשאר חסום עד שחזור — מונע דריסת הגיבוי בענן.
    try { if (typeof FirebaseManager !== 'undefined') FirebaseManager.armSyncOnBoot(); } catch (e) {}
    // החלת ערכת הצבעים השמורה (גיבוי לסקריפט ה-head) + סנכרון השבבים
    if (typeof initColorTheme === 'function') initColorTheme();
    // שחזור העדפת הצלילים (ברירת מחדל: כבוי) + סנכרון אייקון הכפתור
    soundEnabled = StorageManager.getData(StorageManager.KEY_SOUND) === true;
    const _soundTgl = document.getElementById('sound-toggle');
    if (_soundTgl) _soundTgl.checked = soundEnabled;
    if (typeof renderWorkoutMenu === 'function') renderWorkoutMenu();
    checkRecovery();
    // גשר השעון — adopt-on-open + האזנה, ו-adopt חוזר על חזרה-לפוקוס (R6/R7).
    try {
        if (WatchBridge.enabled()) WatchBridge.activate();
    } catch (e) {}
    if (typeof renderHeroCard === 'function') renderHeroCard();
    renderUserAvatar();
    // מציג את הסקשן לפי ההעדפה (כרטיסי "היום" / גרף PR) ומרנדר את הפעיל
    if (typeof applyHomeSectionPref === 'function') applyHomeSectionPref();
    maybeShowCloudSyncBanner();
    fetch('./version.json')
        .then(r => r.json())
        .then(d => {
            window._gymproVersion = d.version || '';
            const el = document.getElementById('app-version-label');
            if (el && d.version) el.textContent = 'GymPro Elite v' + d.version;
            const sv = document.getElementById('settings-version-inline');
            if (sv && d.version) sv.textContent = 'v' + d.version;
        })
        .catch(() => {});
    // טעינת thumbnails ברקע כדי שיהיו מוכנים כשהמשתמש עובר למסך הבחירה
    if (typeof WORKOUT_THUMB_IMAGES !== 'undefined') {
        setTimeout(() => {
            WORKOUT_THUMB_IMAGES.forEach(url => {
                const img = new Image();
                img.src = url;
            });
        }, 500);
    }
    // Sprint 2: gestures
    try { _initSwipeBackGesture(); } catch (e) {}
    try { _initTabSwipeGesture(); }  catch (e) {}
    try { _initAllSheetsDrag(); }   catch (e) {}
    // סנכרון תזונה מ-Health: בכניסה לאפליקציה + כל שעה עגולה כשהיא פתוחה.
    // משיכה שקטה עם throttle פנימי (15 דק') — לא חוסמת את הטעינה.
    setTimeout(() => syncHealthNutrition(false), 2500);
    _scheduleHealthHourlySync();
    // גיבוי שבועי לאימייל — בדיקה שקטה בפתיחה (שולח רק אם עברו ≥7 ימים)
    setTimeout(() => StorageManager.maybeSendWeeklyBackup(false), 4000);
    // ווידג'ט אייפון — דחיפת snapshot שקטה בפתיחה (throttle 10 דק')
    setTimeout(() => StorageManager.maybePushWidgetSnapshot(false), 5000);
});

// חזרה לאפליקציה מהרקע (PWA ב-iOS נשאר בזיכרון) = "כניסה" — משיכת Health שקטה.
// force=true: כל העלאה לפרונט מושכת מחדש, גם אם האפליקציה לא נסגרה (עוקף throttle).
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncHealthNutrition(false, true);
    // ביציאה מהאפליקציה — דחיפת snapshot טרי לווידג'ט (beacon, שורד סגירת דף)
    if (document.visibilityState === 'hidden') StorageManager.pushWidgetSnapshotBeacon();
});
// iOS PWA: שחזור מ-bfcache לא תמיד יורה visibilitychange — pageshow מכסה את המקרה
window.addEventListener('pageshow', (e) => {
    if (e.persisted) syncHealthNutrition(false, true);
});

function checkRecovery() {
    if (!StorageManager.hasActiveSession()) return;
    // הצג modal רק אם האימון התחיל בפועל (יש workoutStartTime)
    // עריכה בעורך גם שומרת session אבל אין workoutStartTime
    const saved = StorageManager.getSessionState();
    if (saved && saved.state && saved.state.workoutStartTime) {
        document.getElementById('recovery-modal').style.display = 'flex';
    } else {
        // session של עורך בלבד — נקה אוטומטית
        StorageManager.clearSessionState();
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

        _applyScreenChrome(lastScreen);

        // שחזור טיימר מהזמן שנשמר — לא כולל זמן הפסקה
        if (state.workoutStartTime) startSessionTimer(state.sessionElapsedSecs || 0);

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
            case 'ui-summary': buildSummaryUI(); break;
        }

        // Sprint 4: הפעלת Live overlay אחרי restore (משכפל את לוגיקת navigate()).
        // בלי זה, חזרה לאימון מנקודת הפסקה לא תפתח את מסך הטיימר הגדול.
        if (lastScreen === 'ui-main' && typeof isLiveModeEnabled === 'function' && isLiveModeEnabled() && !_liveModeSuppressed) {
            if (typeof enterWorkoutLiveMode === 'function') enterWorkoutLiveMode();
        }
        if (lastScreen === 'ui-main' && typeof _syncLiveResumeBtn === 'function') {
            setTimeout(_syncLiveResumeBtn, 80);
        }

        // גשר השעון — אחרי שחזור האימון, מזג בכוח סטים שנרשמו מהשעון (R: clobber-by-restore)
        try { if (typeof WatchBridge !== 'undefined') WatchBridge.forceAdopt(); } catch (e) {}

        haptic('success');
    } else {
        discardSession();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// WatchBridge — גשר אימון חי שעון⇄טלפון דרך Firestore (doc live_session).
// כבוי כברירת מחדל; כשכבוי = no-op מוחלט (אפס רגרסיה). ה-doc נושא נתוני אימון
// בלבד — טיימרים/ניווט/UI מקומיים. הטלפון peer מלא (קורא+כותב), הוא הבעלים של
// מכונת-המצבים והוא היחיד שמסכם לארכיון.
// ═══════════════════════════════════════════════════════════════════════════
// ──────────────────────────────────────────────────────────────────────────
// ארכיטקטורת Two-lane union (v15.92) — מבטלת clobber מבנית, ללא transactions:
//   doc.data  = מסלול הטלפון  — הטלפון כותב רק אותו (metadata + הסטים שלו 'p_').
//   doc.wlog  = מסלול השעון   — ה-proxy כותב רק אותו (הסטים מהשעון 'w_').
// כל צד קורא את שני המסלולים וממזג לפי setId (_unwrapLive). כיוון שאף צד לא כותב
// לשדה של השני (Firestore updateMask = מיזוג ברמת-שדה) — אי אפשר לדרוס. כך מושגת
// טרנזיטיביות מלאה: סטים מהשעון ומהטלפון, בכל סדר, מתמזגים אצל שני הצדדים.
// ה-setIdx נגזר תמיד מהלוג המאוחד (לא counter שנדרס).
const WatchBridge = {
    _unsub: null, _lastDataRev: 0, _lastWlogRev: 0, _suppress: false, _publishTimer: null, _lastHash: '', _pendingWlogReset: false,

    enabled() {
        try {
            return StorageManager.isWatchBridgeOn() &&
                   typeof FirebaseManager !== 'undefined' && FirebaseManager.isConfigured();
        } catch (e) { return false; }
    },
    _activeWorkout() { return !!(state && state.workoutStartTime); },
    _normName(n) { return String(n || '').replace(/\s*\(Main\)\s*$/i, '').trim(); },

    // setId יציב לכל entry (R3 dedupe) — סטי-טלפון מתחילים ב-'p_', סטי-שעון ב-'w_'
    _ensureSetIds() {
        if (!state.log) return;
        state.log.forEach((e, i) => {
            if (e && !e.setId) e.setId = 'p_' + (state.liveSessionId || 0) + '_' + i + '_' + Date.now().toString(36);
        });
    },
    // setIdx נגזר מהלוג המאוחד: כמות הסטים שנרשמו לתרגיל הנוכחי (לא counter שנדרס)
    _deriveSetIdx(exName) {
        if (!exName) return state.setIdx || 0;
        const t = this._normName(exName);
        return (state.log || []).filter(e => e && !e.skip && this._normName(e.exName) === t).length;
    },
    // מפת משקל מוצע מהמערכת (לא AI): המשקל האחרון שנרשם לכל תרגיל בתוכנית,
    // ולתרגיל הנוכחי — המשקל המדויק של הסט הנוכחי (כולל חישוב % לתרגילי calc).
    _buildSuggest(plan) {
        const out = {};
        try {
            (Array.isArray(plan) ? plan : []).forEach(p => {
                if (!p || !p.name) return;
                const w = StorageManager.getLastWeight(p.name);
                if (w != null && !isNaN(w)) out[p.name] = w;
            });
            if (state.currentExName && state.currentEx && Array.isArray(state.currentEx.sets)) {
                const cur = state.currentEx.sets[state.setIdx || 0];
                if (cur && cur.w != null && !isNaN(cur.w)) out[state.currentExName] = cur.w;
            }
        } catch (e) { /* הגנתי */ }
        return out;
    },
    // מסלול הטלפון בלבד: הסטים שמקורם בטלפון ('p_'). סטי-השעון ('w_') חיים ב-wlog
    // (ה-proxy בעליו) — לכן מסוננים כאן כדי שהטלפון לא ידרוס/ישכפל אותם.
    _buildPayload() {
        this._ensureSetIds();
        const plan = (state.workouts && state.type && state.workouts[state.type]) || [];
        return {
            active: true, sessionId: state.liveSessionId,
            startedAt: state.workoutStartTime || state.liveSessionId,
            rev: (this._lastDataRev || 0) + 1, source: 'phone',
            type: state.type || '', week: state.week, isFreestyle: !!state.isFreestyle,
            plan: (Array.isArray(plan) ? plan : []).map(p => ({ name: p.name, sets: p.sets, restTime: p.restTime, isCalc: !!p.isCalc })),
            currentExName: state.currentExName || '', currentTs: Date.now(),
            suggest: this._buildSuggest(plan),
            log: (state.log || [])
                .filter(e => e && e.setId && String(e.setId).indexOf('w_') !== 0)
                .map(e => ({
                    setId: e.setId, exName: e.exName,
                    w: e.w, r: e.r, rir: e.rir != null ? String(e.rir) : '',
                    note: e.note || '', isCluster: !!e.isCluster, round: e.round || null, skip: !!e.skip
                }))
        };
    },
    _hash(p) {
        return (p.log ? p.log.length : 0) + '|' + (p.log && p.log.length ? p.log[p.log.length - 1].setId : '') +
               '|' + p.currentExName + '|' + (p.active ? 1 : 0);
    },

    // נקרא מ-StorageManager.saveSessionState (נקודת חנק יחידה) — מתחיל סשן ומפרסם (debounced)
    onStateSaved() {
        if (this._suppress || !this.enabled() || !this._activeWorkout()) return;
        if (!state.liveSessionId) { state.liveSessionId = Date.now(); this._pendingWlogReset = true; }   // start
        const payload = this._buildPayload();
        const h = this._hash(payload);
        if (h === this._lastHash) return;     // אין שינוי תוכן — מונע ping-pong של rev
        this._lastHash = h;
        clearTimeout(this._publishTimer);
        this._publishTimer = setTimeout(() => this._doPublish(), 400);
        if (!this._unsub) this.startListening();
    },

    // _doPublish — כותב את מסלול-הטלפון בלבד (doc.data). אין צורך ב-read-merge:
    // ה-proxy כותב למסלול נפרד (doc.wlog), ו-publishLiveSession משתמש ב-merge ברמת-שדה,
    // כך שכתיבת הטלפון לעולם לא נוגעת בסטי-השעון.
    async _doPublish() {
        const payload = this._buildPayload();
        this._lastDataRev = payload.rev;
        this._lastHash = this._hash(payload);
        const reset = this._pendingWlogReset; this._pendingWlogReset = false;
        try { await FirebaseManager.publishLiveSession(payload, reset); } catch (e) {}
    },

    startListening() {
        if (!this.enabled() || this._unsub) return;
        this._unsub = FirebaseManager.listenLiveSession(data => this._adopt(data));
    },
    stopListening() { if (this._unsub) { try { this._unsub(); } catch (e) {} this._unsub = null; } },

    // קליטת עדכון מהשעון. data מ-_unwrapLive הוא כבר האיחוד (log ממוזג, currentExName
    // אפקטיבי). מתעלמים מ-echo של הטלפון ע"י gating על rev של מסלול-השעון (_wlogRev).
    _adopt(data) {
        if (!data || !data.active) return;
        const wRev = data._wlogRev || 0;
        if (wRev <= this._lastWlogRev) return;   // אין חדש מהשעון (כולל echo של כתיבת-הטלפון)
        this._suppress = true;
        try {
            if (!this._activeWorkout()) {   // adopt-on-open: בנה state בסיסי מהענן
                state.liveSessionId = data.sessionId;
                state.workoutStartTime = data.startedAt || data.sessionId;
                state.type = data.type || state.type; state.week = data.week;
                state.isFreestyle = !!data.isFreestyle;
                if (typeof startSessionTimer === 'function') { try { startSessionTimer(0); } catch (e) {} }
            }
            state.log = this._mergeLog(state.log || [], data.log || []);
            if (data.currentExName) state.currentExName = data.currentExName;
            state.setIdx = this._deriveSetIdx(state.currentExName);
            this._lastWlogRev = wRev;
            StorageManager.saveSessionState();   // _suppress פעיל → לא יפרסם בחזרה
            const onMain = state.historyStack && state.historyStack[state.historyStack.length - 1] === 'ui-main';
            if (onMain && state.currentEx && typeof initPickers === 'function') { try { initPickers(); } catch (e) {} }
            if (typeof showCloudToast === 'function') showCloudToast('⌚ עודכן מהשעון', true);
        } finally { this._suppress = false; }
    },
    _mergeLog(localLog, remoteLog) {
        const seen = new Set(); const out = [];
        (remoteLog || []).forEach(e => { if (e && e.setId && !seen.has(e.setId)) { seen.add(e.setId); out.push(e); } });
        (localLog || []).forEach(e => { if (e && e.setId && !seen.has(e.setId)) { seen.add(e.setId); out.push(e); } });
        return out;
    },

    async adoptIfAny() {   // adopt-on-open/focus
        if (!this.enabled()) return;
        try { const data = await FirebaseManager.getLiveSession(); if (data) this._adopt(data); } catch (e) {}
    },

    // activate — מחבר האזנה + handlers של focus/visibility (אידמפוטנטי). נקרא ב-load
    // וגם כשמפעילים את הגשר מההגדרות (בלי צורך בטעינה מחדש).
    _wired: false,
    activate() {
        if (!this.enabled()) return;
        this.startListening();
        if (!this._wired) {
            this._wired = true;
            document.addEventListener('visibilitychange', () => { if (!document.hidden) this.forceAdopt(); });
            window.addEventListener('focus', () => this.forceAdopt());
        }
    },

    // forceAdopt — מיזוג בכוח של סטים מהענן (מתעלם מ-gating ה-rev). נקרא אחרי שחזור
    // אימון ובחזרה-לפוקוס, כדי שהטלפון יקלוט סטים שנרשמו מהשעון בזמן שהיה בתיק.
    async forceAdopt() {
        if (!this.enabled()) return;
        try {
            const data = await FirebaseManager.getLiveSession();
            if (!data || !data.active) return;
            // הגנה: מזג רק אם זה אותו סשן (sessionId תואם) — לא לערבב אימון ישן
            if (state.liveSessionId && data.sessionId && String(data.sessionId) !== String(state.liveSessionId)) return;
            this._suppress = true;
            try {
                if (!state.liveSessionId && data.sessionId) state.liveSessionId = data.sessionId;
                state.log = this._mergeLog(state.log || [], data.log || []);
                if (data.currentExName) state.currentExName = data.currentExName;
                state.setIdx = this._deriveSetIdx(state.currentExName);
                this._lastWlogRev = Math.max(this._lastWlogRev, data._wlogRev || 0);
                StorageManager.saveSessionState();
                const onMain = state.historyStack && state.historyStack[state.historyStack.length - 1] === 'ui-main';
                if (onMain && state.currentEx && typeof initPickers === 'function') { try { initPickers(); } catch (e) {} }
                if (typeof showCloudToast === 'function') showCloudToast('⌚ סונכרן מהשעון', true);
            } finally { this._suppress = false; }
        } catch (e) {}
    },
    async finishSession() {   // ניקוי ה-doc (anti-zombie R4)
        this._lastHash = ''; clearTimeout(this._publishTimer); this.stopListening();
        // נקה ב-Firestore רק אם הגשר היה בשימוש בריצה זו (לא לכתוב למשתמשים שהגשר כבוי אצלם)
        if (this.enabled() || (state && state.liveSessionId)) {
            try { await FirebaseManager.clearLiveSession(); } catch (e) {}
        }
        this._lastDataRev = 0; this._lastWlogRev = 0;
    }
};

function discardSession() {
    try { WatchBridge.finishSession(); } catch (e) {}
    StorageManager.clearSessionState();
    stopSessionTimer();
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

// P5: תבנית אחידה למסכים ריקים — אייקון + כותרת + הסבר (בשימוש ארכיון/שקילות/תזונה/חיפוש מזון)
function emptyStateHtml(icon, title, sub = '') {
    return `<div class="empty-state">
        <span class="material-symbols-outlined">${icon}</span>
        <div class="empty-state-title">${title}</div>
        ${sub ? `<div class="empty-state-sub">${sub}</div>` : ''}
    </div>`;
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

// toggle אמיתי: מדליק/מכבה צלילים, שומר את הבחירה, ומצפצף אישור רק בהדלקה.
async function toggleSound(force) {
    // force = מצב ה-checkbox כשמגיע מה-toggle; אחרת flip (תאימות לאחור)
    soundEnabled = (typeof force === 'boolean') ? force : !soundEnabled;
    StorageManager.saveData(StorageManager.KEY_SOUND, soundEnabled);
    haptic('medium');
    const tgl = document.getElementById('sound-toggle');
    if (tgl) tgl.checked = soundEnabled;
    if (soundEnabled) {
        playBeep(1);  // צפצוף אישור — וגם פותח את ה-AudioContext על gesture המשתמש
        await _acquireWakeLock();
    } else if (!document.body.classList.contains('live-mode-active')) {
        _releaseWakeLock();   // כיבוי צלילים מחוץ ל-Live — אין סיבה להשאיר מסך נעול-דולק
    }
}

// ─── NAVIGATION ────────────────────────────────────────────────────────────

// כיוון ניווט נוכחי לאנימציה ('forward' או 'back'). מתאופס אוטומטית אחרי כל מעבר.
let _navDirection = 'forward';
function _setNavDirection(dir) { _navDirection = dir === 'back' ? 'back' : 'forward'; }

// _applyScreenChrome — מקור האמת לעדכון ה-UI Chrome (active screen, tab-bar, strip, header buttons, back).
// קוראים לו גם navigate() וגם restoreSession() כדי שאחרי refresh תהיה התנהגות זהה.
function _applyScreenChrome(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active', 'enter-forward', 'enter-back');
    });
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
        target.classList.add(_navDirection === 'back' ? 'enter-back' : 'enter-forward');
    }
    _navDirection = 'forward';

    const inWorkout = WORKOUT_SCREENS.includes(screenId);
    const tabBar      = document.querySelector('.tab-bar');
    const strip       = document.getElementById('session-timer-strip');
    const settingsBtn = document.getElementById('btn-settings');
    if (tabBar)      tabBar.style.display      = inWorkout ? 'none' : 'flex';
    if (strip)       strip.style.display       = inWorkout ? 'flex' : 'none';
    if (settingsBtn) settingsBtn.style.display = inWorkout ? 'none' : 'flex';

    const backBtn = document.getElementById('global-back');
    if (backBtn) backBtn.style.display = !NO_BACK_SCREENS.includes(screenId) ? 'flex' : 'none';
}

function navigate(id, clearStack = false) {
    haptic('light');
    if (id !== 'ui-main') stopRestTimer();

    _applyScreenChrome(id);

    if (clearStack) {
        state.historyStack = [id];
    } else {
        if (state.historyStack[state.historyStack.length - 1] !== id) state.historyStack.push(id);
    }

    updatePlanFloatBtn(id);

    // Sprint 4: ניהול Live Mode במעברי מסכים
    // — אוטו-launch ל-ui-main כשההגדרה דלוקה והמשתמש לא ביצע exit מפורש
    // — exit silent כשעוזבים את ui-main (רק אם הוא באמת פעיל כעת)
    // — reset של ה-suppression flag כשמגיעים למסך הבית (התחלת אימון חדש)
    if (id === 'ui-week') _liveModeSuppressed = false;
    if (id === 'ui-main' && typeof isLiveModeEnabled === 'function' && isLiveModeEnabled() && !_liveModeSuppressed) {
        // הפעלה סינכרונית — בלי setTimeout, כדי שה-overlay יעלה באותו frame ולא יהיה הבזק של ui-main הרגיל
        if (typeof enterWorkoutLiveMode === 'function') enterWorkoutLiveMode();
    } else if (id !== 'ui-main' && document.body.classList.contains('live-mode-active')) {
        exitWorkoutLiveMode(true);  // silent exit if leaving ui-main while active
    }
    // עדכון הכפתור הירוק "חזור ל-Live" בכל מעבר ל-ui-main
    if (id === 'ui-main' && typeof _syncLiveResumeBtn === 'function') {
        setTimeout(_syncLiveResumeBtn, 80);
    }
}

function handleBackClick() {
    haptic('warning');
    if (state.historyStack.length <= 1) return;

    const currentScreen = state.historyStack[state.historyStack.length - 1];

    if (currentScreen === 'ui-main') {
        if ((state.isFreestyle || state.isExtraPhase || state.isInterruption) && state.setIdx === 0 && state.log.length === 0) {
            // pass
        } else if (state.setIdx > 0) {
            const ap = document.getElementById('action-panel');
            const lastSetLogged = ap && ap.style.display === 'block';
            showConfirm("חזרה אחורה תמחק את הסט הנוכחי. להמשיך?", () => {
                if (lastSetLogged) {
                    // הסט האחרון כבר נרשם — מחק אותו מה-log
                    const lastEntry = state.log[state.log.length - 1];
                    if (lastEntry && lastEntry.exName === state.currentExName && !lastEntry.skip) {
                        state.log.pop();
                    }
                    ap.style.display = 'none';
                    ap.classList.remove('is-visible');
                    document.getElementById('btn-submit-set').style.display = 'block';
                    document.getElementById('btn-skip-exercise').style.display = 'block';
                }
                state.setIdx--;
                initPickers();
                StorageManager.saveSessionState();
            });
            return;
        } else {
            stopRestTimer();
            state.historyStack.pop();
            _setNavDirection('back');
            navigate('ui-confirm');
            return;
        }
    }

    if (currentScreen === 'ui-variation') {
        if ((state.isFreestyle || state.isInterruption || state.isExtraPhase) && state.log.length > 0) {
            showConfirm("האם לצאת מהאימון? (הנתונים שלא נשמרו בארכיון יאבדו)", () => {
                StorageManager.clearSessionState();
                stopSessionTimer();
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
        const isSpecialMode = state.isFreestyle || state.isExtraPhase || state.isInterruption;
        if (isSpecialMode && (state.log.length > 0 || state.completedExInSession.length > 0)) {
            showConfirm("האם לצאת מהאימון?", () => {
                StorageManager.clearSessionState();
                stopSessionTimer();
                _doBack(currentScreen);
            });
            return;
        }
        if (!isSpecialMode && state.log.length > 0) {
            const lastEntry = state.log[state.log.length - 1];
            if (lastEntry.isCluster) {
                // ביטול cluster מסובך — יציאה רגילה
                showConfirm("האם לצאת מהאימון?", () => {
                    StorageManager.clearSessionState();
                    stopSessionTimer();
                    _doBack(currentScreen);
                });
                return;
            }
            // ביטול הסט האחרון
            state.log.pop();
            const prevExName = lastEntry.exName;
            const exData = state.exercises.find(e => e.name === prevExName);
            if (exData) {
                state.currentEx = deepClone(exData);
                state.currentExName = prevExName;
                const workoutList = state.workouts[state.type] || [];
                const prevExIdx = workoutList.findIndex(item => item.type !== 'cluster' && item.name === prevExName);
                if (prevExIdx !== -1) state.exIdx = prevExIdx;
                state.completedExInSession = state.completedExInSession.filter(n => n !== prevExName);
                const remaining = state.log.filter(l => !l.skip && l.exName === prevExName);
                state.setIdx = remaining.length;
                state.lastLoggedSet = remaining.length > 0 ? remaining[remaining.length - 1] : null;
                StorageManager.saveSessionState();
                if (exData.isCalc) {
                    _setNavDirection('back');
                    showConfirmScreen();
                } else {
                    const ap = document.getElementById('action-panel');
                    if (ap) { ap.style.display = 'none'; ap.classList.remove('is-visible'); }
                    document.getElementById('btn-submit-set').style.display = 'block';
                    _setNavDirection('back');
                    navigate('ui-main');
                    initPickers();
                }
            }
            return;
        }
    }

    if (currentScreen === 'ui-cluster-rest') {
        showConfirm("האם לצאת ממצב Cluster?", () => {
            state.clusterMode = false;
            state.activeCluster = null;
            state.clusterIdx = 0;
            state.clusterRound = 1;
            document.getElementById('ui-main').classList.remove('cluster');
            _doBack(currentScreen);
        });
        return;
    }

    if (currentScreen === 'ui-workout-type') {
        if (StorageManager.hasActiveSession()) {
            showConfirm("האם לצאת מהאימון? הנתונים לא יישמרו.", () => {
                StorageManager.clearSessionState();
                stopSessionTimer();
                window.location.reload();
            });
        } else {
            _setNavDirection('back');
            navigate('ui-week', true);
        }
        return;
    }

    if (currentScreen === 'ui-workout-editor') {
        showConfirm("לצאת ללא שמירה?", () => {
            state.historyStack.pop();
            _setNavDirection('back');
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

    // navigate() הוא מקור האמת — מסנכרן tab-bar, session-strip, settings-btn, back-btn
    _setNavDirection('back');
    navigate(prevScreen);
}

// ─── Sprint 2: Skeleton Loaders ──────────────────────────────────────────
// מציג placeholder shimmer בקונטיינר עד שהתוכן האמיתי מרונדר.
// שימוש: showSkeleton('ui-archive-skeleton'); … hideSkeleton('ui-archive-skeleton');
function showSkeleton(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.classList.add('is-visible');
}
function hideSkeleton(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.classList.remove('is-visible');
}

// ─── Sprint 2: Swipe-Back Gesture ────────────────────────────────────────
// מאפשר ניווט "אחורה" באמצעות סוואייפ מהקצה. ב-RTL — סוואייפ ימינה (מהשמאל).
// כיוון נגזר מ-document.body direction כדי לא לבלבל RTL/LTR.
function _initSwipeBackGesture() {
    const EDGE_ZONE  = 32;   // px מהקצה ההתחלתי שבו הסוואייפ חייב להתחיל
    const THRESHOLD  = 80;   // px מינימום של תזוזה אופקית
    const VERT_LIMIT = 60;   // px מקסימום של תזוזה אנכית (מסנן גלילה)
    const isRTL = (getComputedStyle(document.body).direction || 'ltr') === 'rtl';

    let startX = 0, startY = 0, active = false, t0 = 0;

    document.body.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        // RTL: גסט back הוא ימינה — לכן מתחילים בקצה השמאלי.
        // LTR: הפוך.
        const fromEdge = isRTL
            ? t.clientX < EDGE_ZONE
            : (window.innerWidth - t.clientX) < EDGE_ZONE;
        if (!fromEdge) return;
        // אל תפעיל כש-bottom-sheet פתוח, מודאל פתוח, או על אלמנט אינטראקטיבי רגיש
        if (document.querySelector('.bottom-sheet.open')) return;
        // בדוק כל .modal-overlay שגלוי (display !== 'none' && !== '')
        const openModal = Array.from(document.querySelectorAll('.modal-overlay')).some(m => {
            const d = m.style.display; return d && d !== 'none';
        });
        if (openModal) return;
        if (e.target.closest('input, textarea, select, .ios-picker, [data-no-swipe-back]')) return;
        // אל תפעיל במסכים שאין להם back
        const curScreen = state && state.historyStack && state.historyStack[state.historyStack.length - 1];
        if (!curScreen || (typeof NO_BACK_SCREENS !== 'undefined' && NO_BACK_SCREENS.includes(curScreen))) return;
        if (state.historyStack.length <= 1) return;
        startX = t.clientX;
        startY = t.clientY;
        active = true;
        t0 = Date.now();
    }, { passive: true });

    document.body.addEventListener('touchmove', (e) => {
        if (!active) return;
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        // אם הגלילה האנכית דומיננטית — בטל
        if (Math.abs(dy) > Math.abs(dx) + 8) active = false;
    }, { passive: true });

    document.body.addEventListener('touchend', (e) => {
        if (!active) return;
        active = false;
        const t  = e.changedTouches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const dt = Date.now() - t0;
        if (dt > 700) return; // איטי מדי — כנראה לא גסט
        const dirOK = isRTL ? (dx > THRESHOLD) : (dx < -THRESHOLD);
        if (dirOK && Math.abs(dy) < VERT_LIMIT) {
            handleBackClick();
        }
    }, { passive: true });
}

// ─── מעבר בין מסכי הטאבים בהחלקת אצבע (RTL-aware) ─────────────────────────
// החלקה אופקית על מסכי הטאבים הראשיים מחליפה טאב, בהתאם לכיוון הפיזי של ה-tab-bar.
const _TAB_SWIPE_ORDER = ['workout', 'bodylog', 'analytics', 'archive'];   // סדר ה-DOM ב-tab-bar
const _TAB_SWIPE_SCREENS = ['ui-week', 'ui-bodylog', 'ui-analytics', 'ui-archive'];

function _currentMainTab() {
    const active = document.querySelector('.tab-btn.active');
    return active ? active.id.replace('tabbtn-', '') : null;
}

// _hasHorizontalScroll — האם הנגיעה התחילה בתוך אלמנט שניתן לגלול אופקית
// (גרף נגלל, heatmap, כרטיס מידע) — אם כן, ההחלקה משמשת לצפייה במידע, לא למעבר מסך.
function _hasHorizontalScroll(el) {
    while (el && el !== document.body) {
        if (el.scrollWidth > el.clientWidth + 4) {
            const ox = getComputedStyle(el).overflowX;
            if (ox === 'auto' || ox === 'scroll') return true;
        }
        el = el.parentElement;
    }
    return false;
}

function _initTabSwipeGesture() {
    const THRESHOLD = 60;    // px אופקי מינימלי למעבר
    const VERT_LIMIT = 45;   // px אנכי מקסימלי (מסנן גלילה אנכית)
    const isRTL = (getComputedStyle(document.body).direction || 'ltr') === 'rtl';
    let startX = 0, startY = 0, active = false, horiz = false, t0 = 0;

    document.body.addEventListener('touchstart', (e) => {
        active = false; horiz = false;
        if (e.touches.length !== 1) return;
        // רק כשמסך טאב ראשי פעיל (לא בתוך flow אימון, מודאל או sheet)
        const cur = document.querySelector('.screen.active');
        if (!cur || !_TAB_SWIPE_SCREENS.includes(cur.id)) return;
        if (document.querySelector('.bottom-sheet.open')) return;
        const openModal = Array.from(document.querySelectorAll('.modal-overlay')).some(m => {
            const d = m.style.display; return d && d !== 'none';
        });
        if (openModal) return;
        // אל תפעיל על אלמנטים אינטראקטיביים/גרפים/אזורים שמסומנים לא-להחליק
        if (e.target.closest('input, textarea, select, svg, canvas, .ios-picker, [data-no-swipe-back], [data-no-tab-swipe]')) return;
        // אל תפריע לכרטיס/גרף שגליל אופקית — שם ההחלקה משמשת לצפייה במידע
        if (_hasHorizontalScroll(e.target)) return;
        const t = e.touches[0];
        startX = t.clientX; startY = t.clientY; active = true; t0 = Date.now();
    }, { passive: true });

    // לא-passive בכוונה: כך אפשר preventDefault שחוסם את גסט-הקצה של ספארי (המסך הלבן)
    document.body.addEventListener('touchmove', (e) => {
        if (!active) return;
        const t = e.touches[0];
        const dx = t.clientX - startX, dy = t.clientY - startY;
        if (!horiz) {
            if (Math.abs(dy) > Math.abs(dx) + 8) { active = false; return; } // גלילה אנכית — שחרר
            if (Math.abs(dx) > 10) horiz = true;                            // נעילת כיוון אופקי
        }
        if (horiz && e.cancelable) e.preventDefault();   // חוסם ניווט-קצה של הדפדפן + גלילה אופקית של הדף
    }, { passive: false });

    document.body.addEventListener('touchend', (e) => {
        if (!active) return;
        active = false;
        const t = e.changedTouches[0];
        const dx = t.clientX - startX, dy = t.clientY - startY;
        if (Date.now() - t0 > 600) return;                          // איטי מדי
        if (Math.abs(dx) < THRESHOLD || Math.abs(dy) > VERT_LIMIT) return;
        const cur = _currentMainTab();
        const idx = _TAB_SWIPE_ORDER.indexOf(cur);
        if (idx < 0) return;
        // "התוכן עוקב אחרי האצבע": RTL — שמאלה=הטאב הקודם ב-DOM, ימינה=הבא. LTR הפוך.
        const target = isRTL ? idx + (dx < 0 ? -1 : 1) : idx + (dx < 0 ? 1 : -1);
        if (target < 0 || target >= _TAB_SWIPE_ORDER.length) return;
        if (typeof switchMainTab === 'function') switchMainTab(_TAB_SWIPE_ORDER[target]);
    }, { passive: true });
}

// ─── Sprint 2: Bottom-Sheet Drag-to-Dismiss ──────────────────────────────
// drag-down >100px על sheet → סוגר.
// closer — פונקציה שסוגרת את ה-sheet (כל sheet יש לו closer ייעודי שלו).
function _initSheetDragDismiss(sheetEl, closer) {
    if (!sheetEl || typeof closer !== 'function') return;
    const DISMISS = 100; // px לכיוון מטה לסגירה
    let startY = 0, currentY = 0, dragging = false;

    const onStart = (e) => {
        if (!sheetEl.classList.contains('open')) return;
        const touch = e.touches ? e.touches[0] : e;
        // התחל גרירה רק כשנוגעים ב-handle או בחלק העליון של ה-sheet (כדי לא להפריע לגלילה פנימית)
        const handle = sheetEl.querySelector('.sheet-handle');
        const rect = sheetEl.getBoundingClientRect();
        const isHandle = handle && handle.contains(e.target);
        const isTopArea = (touch.clientY - rect.top) < 48;
        // אם ה-sheet גלול פנימה למטה — אל תאפשר גרירה מאזור התוכן
        if (!isHandle && !isTopArea) return;
        if (sheetEl.scrollTop > 0 && !isHandle) return;
        startY = touch.clientY;
        currentY = startY;
        dragging = true;
        sheetEl.classList.add('dragging');
    };

    const onMove = (e) => {
        if (!dragging) return;
        const touch = e.touches ? e.touches[0] : e;
        currentY = touch.clientY;
        const dy = Math.max(0, currentY - startY); // רק כיוון מטה
        sheetEl.style.transform = `translateY(${dy}px)`;
    };

    const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        sheetEl.classList.remove('dragging');
        const dy = Math.max(0, currentY - startY);
        sheetEl.style.transform = '';
        if (dy > DISMISS) {
            try { closer(); } catch (err) {}
            haptic('warning');
        }
    };

    sheetEl.addEventListener('touchstart', onStart, { passive: true });
    sheetEl.addEventListener('touchmove',  onMove,  { passive: true });
    sheetEl.addEventListener('touchend',   onEnd,   { passive: true });
    sheetEl.addEventListener('touchcancel', onEnd,  { passive: true });
}

// מחבר drag-dismiss לכל ה-bottom sheets הקיימים. רץ פעם אחת ב-DOMContentLoaded.
function _initAllSheetsDrag() {
    const sheets = [
        { id: 'sheet-modal',                closer: () => (typeof closeDayDrawer === 'function') && closeDayDrawer() },
        { id: 'analytics-settings-sheet',   closer: () => (typeof closeAnalyticsSettings === 'function') && closeAnalyticsSettings() },
        { id: 'hero-settings-sheet',        closer: () => (typeof closeHeroSettings === 'function') && closeHeroSettings() },
        { id: 'micro-sort-sheet',           closer: () => (typeof closeMicroSortSheet === 'function') && closeMicroSortSheet() },
        { id: 'alias-sheet',                closer: () => (typeof closeAliasSheet === 'function') && closeAliasSheet() },
        { id: 'workout-plan-sheet',         closer: () => closePlanSheet() },
        { id: 'range-copy-sheet',           closer: () => (typeof closeRangeSheet === 'function') && closeRangeSheet() },
        { id: 'set-rec-sheet',              closer: () => dismissAIRecommendation() },
        { id: 'fd-add-sheet',               closer: () => (typeof closeFoodAdd === 'function') && closeFoodAdd() },
        { id: 'fd-portion-sheet',           closer: () => (typeof closeFoodPortion === 'function') && closeFoodPortion() },
        { id: 'fd-meal-sheet',              closer: () => (typeof closeFoodMeal === 'function') && closeFoodMeal() },
    ];
    sheets.forEach(s => {
        const el = document.getElementById(s.id);
        if (el) _initSheetDragDismiss(el, s.closer);
    });
}

// ─── USER PROFILE — Avatar ב-header + פרופיל בהגדרות (v17.11) ──────────────

// מרנדר את ה-avatar בכל החזיתות: כפתור ה-header, תצוגת ההגדרות, וברכת מסך הבית.
// שרשרת fallback: תמונה → מונוגרמה (אות ראשונה מהשם) → צללית ריקה.
function renderUserAvatar() {
    const prefs  = StorageManager.getAnalyticsPrefs();
    const name   = (prefs.name || '').trim();
    const avatar = prefs.avatar || '';

    const silhouetteSVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(174,174,178,0.7)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';

    ['header-avatar', 'stg-avatar-preview'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('monogram', 'empty');
        if (avatar) {
            const img = document.createElement('img');
            img.alt = 'פרופיל';
            img.src = avatar;
            el.replaceChildren(img);
        } else if (name) {
            el.classList.add('monogram');
            el.textContent = name.charAt(0);
        } else {
            el.classList.add('empty');
            el.innerHTML = silhouetteSVG;
        }
    });

    // ברכה אישית בכרטיס הבית
    const greet = document.getElementById('hero-greeting');
    if (greet) greet.textContent = name ? `מוכן לאימון, ${name}?` : 'מוכן לאימון?';

    // סנכרון שדות סקשן הפרופיל בהגדרות
    const inp = document.getElementById('stg-profile-name');
    if (inp && document.activeElement !== inp) inp.value = name;
    const rm = document.getElementById('stg-avatar-remove');
    if (rm) rm.style.display = avatar ? '' : 'none';
}

// קליטת קובץ תמונה: crop ריבועי מרכזי → 192×192 → JPEG dataURL (~20KB) → analyticsPrefs.avatar.
// (v17.14: הוגדל מ-128 — בתצוגת 56px על מסך 3x נדרשים 168px פיזיים כדי להישאר חד.)
// נשמר בתוך analyticsPrefs כדי לרכוב חינם על סנכרון הענן (saveConfigToCloud שולח prefs שלם).
function handleAvatarUpload(input) {
    const file = input.files && input.files[0];
    input.value = '';   // מאפשר בחירה חוזרת של אותו קובץ
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => showAlert('שגיאה בקריאת הקובץ.');
    reader.onload = e => {
        const img = new Image();
        img.onerror = () => showAlert('קובץ התמונה לא נתמך.');
        img.onload = () => {
            try {
                const SIZE = 192;
                const canvas = document.createElement('canvas');
                canvas.width = SIZE; canvas.height = SIZE;
                const side = Math.min(img.naturalWidth, img.naturalHeight);
                const sx = (img.naturalWidth  - side) / 2;
                const sy = (img.naturalHeight - side) / 2;
                canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
                const prefs = StorageManager.getAnalyticsPrefs();
                prefs.avatar = canvas.toDataURL('image/jpeg', 0.85);
                StorageManager.saveAnalyticsPrefs(prefs);
                renderUserAvatar();
                haptic('success');
            } catch (err) {
                showAlert('שגיאה בעיבוד התמונה: ' + err.message);
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function removeUserAvatar() {
    const prefs = StorageManager.getAnalyticsPrefs();
    delete prefs.avatar;
    StorageManager.saveAnalyticsPrefs(prefs);
    renderUserAvatar();
    haptic('light');
}

// שמירת שם מסקשן הפרופיל — כותב לאותו prefs.name של "שם המתאמן" בהגדרות האנליטיקה
function saveProfileName(value) {
    const prefs = StorageManager.getAnalyticsPrefs();
    prefs.name = (value || '').trim();
    StorageManager.saveAnalyticsPrefs(prefs);
    renderUserAvatar();
}

function openSettings() {
    navigate('ui-settings');
    renderUserAvatar();
    if (typeof updateFirebaseStatus === 'function') updateFirebaseStatus();
    if (typeof updateAIStatus === 'function') updateAIStatus();
    if (typeof updateMfpBridgeStatus === 'function') updateMfpBridgeStatus();
    if (typeof updateHealthBridgeStatus === 'function') updateHealthBridgeStatus();
    if (typeof updateWatchBridgeStatus === 'function') updateWatchBridgeStatus();
    if (typeof updateBackupBridgeStatus === 'function') updateBackupBridgeStatus();
    if (typeof updateWidgetBridgeStatus === 'function') updateWidgetBridgeStatus();
    if (typeof updatePhotoBridgeStatus === 'function') updatePhotoBridgeStatus();
    if (typeof updateBodyProfileStatus === 'function') updateBodyProfileStatus();
    _renderNutritionalToggle();
    _renderMainTMSettings();
    if (typeof syncLiveModeToggle === 'function') syncLiveModeToggle();
    if (typeof syncHomeCardToggle === 'function') syncHomeCardToggle();
    if (typeof syncThemePicker === 'function') syncThemePicker();
    const _st = document.getElementById('sound-toggle');
    if (_st) _st.checked = soundEnabled;
    switchSettingsTab('general');   // תמיד נפתח על לשונית "כללי"
}

// מעבר בין לשוניות ההגדרות (בורר קבוצות-על). btn אופציונלי — אם חסר, מסומן לפי data-attr.
function switchSettingsTab(name, btn) {
    document.querySelectorAll('#ui-settings .stg-tab').forEach(b =>
        b.classList.toggle('active', btn ? b === btn : b.dataset.stgTab === name));
    document.querySelectorAll('#ui-settings .stg-panel').forEach(p =>
        p.classList.toggle('active', p.dataset.stgPanel === name));
    if (typeof haptic === 'function') haptic('light');
}

// ─── NUTRITIONAL STATE ─────────────────────────────────────────────────────

function _renderNutritionalToggle() {
    const nutri = StorageManager.getNutritionalState();
    document.querySelectorAll('#nutri-toggle .nutri-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.state === nutri.state);
    });
    const metaEl = document.getElementById('nutri-meta');
    if (metaEl) metaEl.textContent = nutri.startDate
        ? `במצב מאז ${nutri.startDate} (${_daysInState(nutri.startDate)} ימים)`
        : 'קבע תאריך תחילת מצב';
    const _ap = getAnalyticsPrefs();
    [['macro-target-p', 'proteinTarget'], ['macro-target-c', 'carbsTarget'], ['macro-target-f', 'fatTarget']].forEach(([id, key]) => {
        const el = document.getElementById(id); if (el) el.value = _ap[key] || '';
    });
    _syncKcalTargetUI(_ap);
    const capEl = document.getElementById('cut-cap-main-toggle');
    if (capEl) capEl.checked = getAnalyticsPrefs().cutCapMainSets !== false;   // ברירת מחדל: דלוק
}

// ─── TM — תרגילי MAIN ──────────────────────────────────────────────────────
// _displayTM — TM להצגה לתרגיל: עדיפות לערך שבו בוצע בפועל בסשן הנוכחי,
// נפילה לערך המוגדר בהגדרות (לתרגילים שעדיין לא בוצעו בסשן). null = אין TM כלל.
function _displayTM(exName) {
    if (state.rmUsed && state.rmUsed[exName] != null) return state.rmUsed[exName];
    return StorageManager.getExerciseTM(exName);
}

// בודק אם תרגיל מתוייג MAIN בתוכנית הפעילה כרגע (לתצוגת TM בחלונות יומן/היסטוריה).
function _isMainExInCurrentWorkout(exName) {
    if (!state.type || !state.workouts || !state.workouts[state.type]) return false;
    return state.workouts[state.type].some(item => item.isMain && item.type !== 'cluster' && item.name === exName);
}

// אוסף את שמות כל תרגילי ה-MAIN הייחודיים מכל התוכניות הקיימות (state.workouts).
function _getAllMainExerciseNames() {
    const names = [];
    if (state.workouts) {
        Object.keys(state.workouts).forEach(wName => {
            (state.workouts[wName] || []).forEach(item => {
                if (item.isMain && item.type !== 'cluster' && !names.includes(item.name)) names.push(item.name);
            });
        });
    }
    return names;
}

// _renderMainTMSettings — מציג שדה TM לכל תרגיל-מיין בהגדרות. TM מוגדר = דילוג
// אוטומטי על מסך הזנת 1RM בתחילת התרגיל (confirmExercise).
function _renderMainTMSettings() {
    const container = document.getElementById('main-tm-settings-list');
    if (!container) return;
    const names = _getAllMainExerciseNames();
    if (!names.length) {
        container.innerHTML = '<div class="stg-nutri-hint">אין תרגילים מתויגים MAIN באף תוכנית.</div>';
        return;
    }
    const tms = StorageManager.getAllExerciseTMs();
    container.innerHTML = names.map(name => `
        <div class="stg-ai-field">
            <label class="stg-ai-label">${escapeHtml(name)}</label>
            <input type="number" inputmode="decimal" step="2.5" min="0" class="stg-ai-input main-tm-input"
                data-ex-name="${escapeHtml(name)}"
                placeholder="ללא TM — הזנת 1RM ידנית"
                value="${tms[name] != null ? tms[name] : ''}">
        </div>`).join('');
    container.querySelectorAll('.main-tm-input').forEach(inp => {
        inp.addEventListener('change', () => saveMainExerciseTM(inp.dataset.exName, inp.value));
    });
}

function saveMainExerciseTM(exName, val) {
    const trimmed = String(val == null ? '' : val).trim();
    const num = trimmed === '' ? null : parseFloat(trimmed);
    StorageManager.saveExerciseTM(exName, (num != null && !isNaN(num) && num > 0) ? num : null);
    if (typeof haptic === 'function') haptic('light');
}

// _macroTargetKcal — קלוריות נגזרות מיעדי המאקרו: חלבון×4 + פחמימה×4 + שומן×9.
function _macroTargetKcal(p) {
    return Math.round((Number(p.proteinTarget) || 0) * 4 + (Number(p.carbsTarget) || 0) * 4 + (Number(p.fatTarget) || 0) * 9);
}

// _syncKcalTargetUI — מסנכרן את שדה הקלוריות ואת תווית המצב (מחושב/ידני).
function _syncKcalTargetUI(p) {
    p = p || getAnalyticsPrefs();
    const inp = document.getElementById('nutri-target-input');
    if (inp && document.activeElement !== inp) inp.value = p.kcalTarget || '';
    const tag = document.getElementById('nutri-target-mode');
    if (tag) {
        const hasMacro = ((Number(p.proteinTarget) || 0) + (Number(p.carbsTarget) || 0) + (Number(p.fatTarget) || 0)) > 0;
        if (p.kcalTargetManual && p.kcalTarget) { tag.textContent = 'ידני'; tag.className = 'nutri-target-mode manual'; }
        else if (hasMacro && p.kcalTarget) { tag.textContent = 'מחושב'; tag.className = 'nutri-target-mode auto'; }
        else { tag.textContent = ''; tag.className = 'nutri-target-mode'; }
    }
}

// snapshot היעדים הנוכחיים — נלכד לפני המוטציה ומוזן ל-recordTargetChange (לוג אפקטיבי-מתאריך)
function _targetsOf(p) {
    return { kcal: p.kcalTarget || null, p: p.proteinTarget || null, c: p.carbsTarget || null, f: p.fatTarget || null };
}

// saveKcalTarget — היעד הקלורי היומי. ערך מפורש = דריסה ידנית (גם אם לא תואם למאקרו).
// ריק = ביטול הדריסה וחזרה לחישוב אוטומטי מהמאקרו (אם הוגדר).
function saveKcalTarget(val) {
    const p = getAnalyticsPrefs();
    const prev = _targetsOf(p);
    const trimmed = String(val == null ? '' : val).trim();
    if (trimmed === '') {
        p.kcalTargetManual = false;
        const kc = _macroTargetKcal(p);
        p.kcalTarget = kc > 0 ? kc : null;
    } else {
        const n = parseInt(trimmed, 10);
        if (n > 0) { p.kcalTarget = n; p.kcalTargetManual = true; }
        else { p.kcalTarget = null; p.kcalTargetManual = false; }
    }
    saveAnalyticsPrefs(p);
    StorageManager.recordTargetChange(prev);   // v16.91: שינוי יעד חל מהיום והלאה — העבר מקובע
    _syncKcalTargetUI(p);
    if (typeof renderHomeTodayCards === 'function') renderHomeTodayCards();
    haptic('light');
}

// saveMacroTarget — יעד מאקרו יומי (גרם) ליומן המזון. ריק/0 = ללא יעד.
// כל עוד אין דריסה ידנית — הקלוריות מחושבות אוטומטית מהמאקרו.
function saveMacroTarget(key, val) {
    const p = getAnalyticsPrefs();
    const prev = _targetsOf(p);
    const n = parseInt(val, 10);
    p[key] = n > 0 ? n : null;
    if (!p.kcalTargetManual) {
        const kc = _macroTargetKcal(p);
        p.kcalTarget = kc > 0 ? kc : null;
    }
    saveAnalyticsPrefs(p);
    StorageManager.recordTargetChange(prev);   // v16.91: שינוי יעד חל מהיום והלאה — העבר מקובע
    _syncKcalTargetUI(p);
    if (typeof renderHomeTodayCards === 'function') renderHomeTodayCards();
    haptic('light');
}

// ── עורך "יעדים לפי תאריך" (v16.92) — תיקוני עבר ללוג היעדים ─────────────────
// עריכת עבר בלבד (< היום): "מהיום ואילך" נשאר בשדות הרגילים — מקור אמת יחיד ל"עכשיו".
function openTargetHistorySheet() {
    _renderTargetHistoryList();
    const d = document.getElementById('th-date');
    if (d) {
        const pad = x => String(x).padStart(2, '0');
        const y = new Date(Date.now() - 86400000);   // עד אתמול
        d.max = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
        d.value = '';
    }
    ['th-kcal', 'th-p', 'th-c', 'th-f'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    _thKcalManual = false;
    _thSyncKcalMode();
    document.getElementById('target-history-overlay').style.display = 'block';
    document.getElementById('target-history-sheet').classList.add('open');
    haptic('light');
}

function closeTargetHistorySheet() {
    document.getElementById('target-history-overlay').style.display = 'none';
    document.getElementById('target-history-sheet').classList.remove('open');
}

function _renderTargetHistoryList() {
    const box = document.getElementById('th-list');
    if (!box) return;
    const hist = StorageManager.getTargetHistory().slice().sort((a, b) => a.date < b.date ? 1 : -1);   // חדש→ישן
    if (!hist.length) {
        box.innerHTML = '<p class="sub-text">אין רשומות — כל ימי העבר מציגים את היעד הנוכחי.</p>';
        return;
    }
    const fmtD = d => { const p = d.split('-'); return `${p[2]}.${p[1]}.${p[0]}`; };
    box.innerHTML = hist.map(h => {
        const macros = (h.p || h.c || h.f)
            ? ` · <i class="macro-p">ח ${h.p || 0}</i> <i class="macro-c">פ ${h.c || 0}</i> <i class="macro-f">ש ${h.f || 0}</i>` : '';
        return `<div class="th-row">
            <div class="th-row-main">
                <span class="th-row-date">החל מ-${fmtD(h.date)}</span>
                <span class="th-row-vals">${h.kcal ? h.kcal.toLocaleString('he-IL') + ' קק"ל' : 'ללא יעד קלורי'}${macros}</span>
            </div>
            <button class="th-row-btn" onclick="thEditEntry('${h.date}')" aria-label="ערוך"><span class="material-symbols-outlined">edit</span></button>
            <button class="th-row-btn th-row-btn--del" onclick="thDeleteEntry('${h.date}')" aria-label="מחק"><span class="material-symbols-outlined">delete</span></button>
        </div>`;
    }).join('');
}

// ── מחשבון מאקרו→קלוריות בעורך (v16.94) — אותה סמנטיקה כמו השדות הראשיים ─────
// הקלוריות מחושבות אוטומטית (P×4+C×4+F×9) אלא אם הוזנו ידנית; מחיקה = חזרה לחישוב.
let _thKcalManual = false;
function _thMacroKcalCalc() {
    const g = id => Number((document.getElementById(id) || {}).value) || 0;
    return Math.round(g('th-p') * 4 + g('th-c') * 4 + g('th-f') * 9);
}
function _thSyncKcalMode() {
    const tag = document.getElementById('th-kcal-mode');
    if (!tag) return;
    const el = document.getElementById('th-kcal');
    const hasKcal = el && String(el.value).trim() !== '';
    if (!hasKcal) { tag.textContent = ''; tag.className = 'nutri-target-mode'; return; }
    tag.textContent = _thKcalManual ? 'ידני' : 'מחושב';
    tag.className = 'nutri-target-mode ' + (_thKcalManual ? 'manual' : 'auto');
}
function _thMacroInput() {
    if (!_thKcalManual) {
        const kc = _thMacroKcalCalc();
        const el = document.getElementById('th-kcal');
        if (el) el.value = kc > 0 ? kc : '';
    }
    _thSyncKcalMode();
}
function _thKcalInput(v) {
    if (String(v == null ? '' : v).trim() === '') { _thKcalManual = false; _thMacroInput(); return; }   // ריק = אוטומטי
    _thKcalManual = true;
    _thSyncKcalMode();
}

// מילוי הטופס מרשומה קיימת לעריכה (שמירה = upsert על אותו תאריך)
function thEditEntry(date) {
    const h = StorageManager.getTargetHistory().find(x => x.date === date);
    if (!h) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    set('th-date', h.date); set('th-kcal', h.kcal); set('th-p', h.p); set('th-c', h.c); set('th-f', h.f);
    // מצב המחשבון לפי הרשומה: קלוריות ≠ מחושב-מהמאקרו ⇒ הן היו ידניות
    const calc = Math.round((h.p || 0) * 4 + (h.c || 0) * 4 + (h.f || 0) * 9);
    _thKcalManual = !!(h.kcal && h.kcal !== calc);
    _thSyncKcalMode();
    haptic('light');
}

function thSaveEntry() {
    const date = (document.getElementById('th-date').value || '').trim();
    if (!date) { showAlert('בחר תאריך.'); return; }
    if (date >= StorageManager._todayStr()) { showAlert('העורך מתקן עבר בלבד — ליעד מהיום ואילך השתמש בשדות הרגילים.'); return; }
    const num = id => { const n = parseInt(document.getElementById(id).value, 10); return n > 0 ? n : null; };
    const entry = { date, kcal: num('th-kcal'), p: num('th-p'), c: num('th-c'), f: num('th-f') };
    if (!entry.kcal && !entry.p && !entry.c && !entry.f) { showAlert('הזן לפחות ערך אחד (או מחק את הרשומה במקום).'); return; }
    StorageManager.upsertTargetEntry(entry);
    _renderTargetHistoryList();
    ['th-date', 'th-kcal', 'th-p', 'th-c', 'th-f'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    _thKcalManual = false;
    _thSyncKcalMode();
    if (typeof renderHomeTodayCards === 'function') renderHomeTodayCards();
    if (typeof autoSaveConfigToCloud === 'function') autoSaveConfigToCloud();
    haptic('success');
}

function thDeleteEntry(date) {
    showConfirm('למחוק את הרשומה? הימים שכוסו על-ידה יקבלו את הרשומה הקודמת (או את היעד הנוכחי אם אין).', () => {
        StorageManager.deleteTargetEntry(date);
        _renderTargetHistoryList();
        if (typeof renderHomeTodayCards === 'function') renderHomeTodayCards();
        if (typeof autoSaveConfigToCloud === 'function') autoSaveConfigToCloud();
        haptic('warning');
    });
}

function selectNutritionalState(state) {
    const current = StorageManager.getNutritionalState();
    // שמור על תאריך ההתחלה אם המצב לא השתנה — ספירת הימים נמדדת מהכניסה האמיתית לשלב,
    // ולא מתאפסת בכל לחיצה חוזרת על אותו pill.
    const keepDate = (current.state === state && current.startDate) ? current.startDate : undefined;
    StorageManager.setNutritionalState(state, keepDate);
    _renderNutritionalToggle();
    haptic('success');
}

// ── Cut: הפחתת תרגילי מיין ל-4 סטים ──────────────────────────────────────────
// בקאט, תרגילי MAIN LIFT (isMain) מוגבלים ל-4 הסטים הראשונים (הכבדים) כדי לחתוך
// נפח/עייפות בלי לדלג ידנית. טוגל בהגדרות (דלוק כברירת מחדל), עוקף = כיבוי.
const CUT_MAIN_SET_CAP = 4;
function _cutCapMainActive() {
    try {
        if (StorageManager.getNutritionalState().state !== 'cut') return false;
        const p = (typeof getAnalyticsPrefs === 'function') ? getAnalyticsPrefs() : {};
        return p.cutCapMainSets !== false;   // ברירת מחדל: דלוק
    } catch (e) { return false; }
}
function toggleCutCapMainSets(on) {
    const p = getAnalyticsPrefs();
    p.cutCapMainSets = !!on;
    saveAnalyticsPrefs(p);
    haptic('light');
}

// _daysInState — מחשב ימים לפי חצות מקומית בשני הקצוות, כדי למנוע סטיית יום
// שנובעת מפרשנות UTC של מחרוזת "YYYY-MM-DD" מול שעון מקומי.
function _daysInState(startDate) {
    if (!startDate) return 0;
    const [y, m, d] = startDate.split('-').map(Number);
    if (!y || !m || !d) return 0;
    const start = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round((today - start) / 86400000));
}

// ── Override ידני של תאריך תחילת המצב התזונתי (מסך משני) ──
function openNutriDateModal() {
    const n = StorageManager.getNutritionalState();
    const todayStr = StorageManager._todayStr(); // תאריך מקומי — לא UTC
    const input = document.getElementById('nutri-date-input');
    input.value = n.startDate || todayStr;
    input.max = todayStr; // אין משמעות לתאריך עתידי
    _renderNutritionLog();
    document.getElementById('nutri-date-modal').style.display = 'flex';
}

function closeNutriDateModal() {
    document.getElementById('nutri-date-modal').style.display = 'none';
}

function saveNutriDateOverride() {
    const val = document.getElementById('nutri-date-input').value;
    const todayStr = StorageManager._todayStr(); // תאריך מקומי — לא UTC
    if (!val) { showAlert('בחר תאריך.'); return; }
    if (val > todayStr) { showAlert('לא ניתן לבחור תאריך עתידי.'); return; }
    const n = StorageManager.getNutritionalState();
    StorageManager.setNutritionalState(n.state, val);
    _renderNutritionalToggle();
    closeNutriDateModal();
    haptic('success');
}

// getNutritionalContext — מחזיר string לשימוש ב-AI prompts.
// משמש את _updateAIContextBanner ויחומש ע"י requestAIRecommendation (Sprint 1c).
function getNutritionalContext() {
    const LBL = { cut: 'CUT', maintenance: 'MAINTENANCE', surplus: 'SURPLUS' };
    const n = StorageManager.getNutritionalState();
    const label = LBL[n.state] || 'MAINTENANCE';
    if (!n.startDate) return label;
    let ctx = `${label} (day ${_daysInState(n.startDate)})`;
    // פאזה קודמת — נותן ל-AI הקשר מגמה (ממה עברת ולכמה זמן)
    const log = StorageManager.getNutritionLog();
    if (log.length >= 2) {
        const last = log[log.length - 1];
        const prev = log[log.length - 2];
        const prevDays = Math.max(0, Math.round((last.startTs - prev.startTs) / 86400000));
        ctx += `, prev ${LBL[prev.state] || prev.state} ${prevDays}d`;
    }
    return ctx;
}

// _renderNutritionLog — מצייר את ציר הזמן התזונתי בתוך מודאל "במצב מאז".
function _renderNutritionLog() {
    const cont = document.getElementById('nutri-log-list');
    if (!cont) return;
    const log = StorageManager.getNutritionLog();
    if (!log.length) { cont.innerHTML = '<div class="nutri-log-empty">אין היסטוריה עדיין</div>'; return; }
    const LBL = { cut: 'Cut', maintenance: 'Maintenance', surplus: 'Surplus' };
    const now = Date.now();
    const rows = log.map((e, i) => {
        const endTs = (i < log.length - 1) ? log[i + 1].startTs : now;
        const days = Math.max(0, Math.round((endTs - e.startTs) / 86400000));
        return { state: e.state, startDate: e.startDate, days, isCurrent: i === log.length - 1 };
    }).reverse(); // מהחדש לישן
    cont.innerHTML = rows.map(r => `
        <div class="nutri-log-row${r.isCurrent ? ' nutri-log-row--current' : ''}">
            <span class="nutri-log-dot nutri-log-dot--${r.state}"></span>
            <span class="nutri-log-state">${LBL[r.state] || r.state}</span>
            <span class="nutri-log-meta">${r.startDate} · ${r.days} ימים${r.isCurrent ? ' · נוכחי' : ''}</span>
        </div>`).join('');
}

// ─── WORKOUT PLAN SHEET ────────────────────────────────────────────────────

function openWorkoutPlanSheet(workoutName) {
    const workoutList = state.workouts[workoutName];
    if (!workoutList) return;

    const body = document.getElementById('workout-plan-sheet-body');
    let html = `
        <div class="plan-sheet-header">
            <div class="plan-sheet-title">תרגילים מתוכננים</div>
            <div class="plan-sheet-subtitle">${escapeHtml(workoutName)}</div>
        </div>`;

    let num = 0;
    workoutList.forEach(item => {
        if (item.type === 'cluster') {
            html += `<div class="plan-section-label">סבב (${item.rounds} פעמים)</div>`;
            item.exercises.forEach(ex => {
                num++;
                const exData = state.exercises.find(e => e.name === ex.name);
                const setsStr = exData && exData.sets && exData.sets[0] ? `${exData.sets.length}×${exData.sets[0].r}` : '';
                const muscles = exData ? (exData.muscles || []).join(', ') : '';
                html += `
                    <div class="plan-ex-item">
                        <div class="plan-ex-num">${num}</div>
                        <div class="plan-ex-dot dot-upcoming"></div>
                        <div class="plan-ex-info">
                            <div class="plan-ex-name">${escapeHtml(ex.name)} <span class="plan-ex-sets-str">${setsStr}</span></div>
                            ${muscles ? `<div class="plan-ex-meta">${muscles}</div>` : ''}
                        </div>
                    </div>`;
            });
        } else {
            num++;
            const isMain = item.isMain;
            const exData = state.exercises.find(e => e.name === item.name);
            const setsStr = isMain ? '1RM' : (item.sets > 0 ? `${item.sets}×` + (exData && exData.sets && exData.sets[0] ? exData.sets[0].r : '?') : '');
            const muscles = exData ? (exData.muscles || []).join(', ') : '';
            html += `
                <div class="plan-ex-item ${isMain ? 'plan-main' : ''}">
                    <div class="plan-ex-num">${num}</div>
                    <div class="plan-ex-dot ${isMain ? 'dot-main' : 'dot-upcoming'}"></div>
                    <div class="plan-ex-info">
                        <div class="plan-ex-name">${escapeHtml(item.name)} <span class="plan-ex-sets-str">${setsStr}</span></div>
                        ${muscles ? `<div class="plan-ex-meta">${muscles}</div>` : ''}
                    </div>
                    <div class="plan-ex-right">
                        ${isMain ? '<span class="plan-main-badge">MAIN</span>' : ''}
                    </div>
                </div>`;
        }
    });

    body.innerHTML = html;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'plan-sheet-close';
    closeBtn.textContent = 'סגור';
    closeBtn.onclick = closePlanSheet;
    body.appendChild(closeBtn);

    document.getElementById('workout-plan-overlay').style.display = 'block';
    requestAnimationFrame(() => {
        document.getElementById('workout-plan-sheet').classList.add('open');
    });
    haptic('light');
}

function openCurrentPlanSheet() {
    if (!state.type || !state.workouts[state.type]) return;

    const workoutList = state.workouts[state.type];

    const setsCountMap = {};
    state.log.forEach(entry => {
        if (entry.skip) return;
        setsCountMap[entry.exName] = (setsCountMap[entry.exName] || 0) + 1;
    });

    const doneCount = state.completedExInSession.length;
    let totalCount = 0;
    workoutList.forEach(item => {
        if (item.type === 'cluster') totalCount += item.exercises.length;
        else totalCount++;
    });

    const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    const body = document.getElementById('workout-plan-sheet-body');
    let html = `
        <div class="plan-sheet-header">
            <div class="plan-sheet-title">תרגילים באימון</div>
            <div class="plan-sheet-subtitle">${state.type}</div>
        </div>
        <div class="plan-progress-row">
            <span class="plan-progress-label">${doneCount} / ${totalCount} הושלמו</span>
            <div class="plan-progress-bg">
                <div class="plan-progress-fill" style="width:${progressPct}%"></div>
            </div>
        </div>`;

    let num = 0;
    let shownDone = false;
    let shownCurrent = false;
    let shownUpcoming = false;

    workoutList.forEach(item => {
        const exercises = item.type === 'cluster' ? item.exercises : [item];

        exercises.forEach(ex => {
            num++;
            const exName = ex.name;
            const isDone = state.completedExInSession.includes(exName);
            const isCurrent = (exName === state.currentExName) && !isDone;
            const isMain = item.isMain && item.type !== 'cluster';
            const exData = state.exercises.find(e => e.name === exName);
            let totalSets = isMain
                ? (exData && exData.sets ? exData.sets.length : (item.sets || 0))
                : (item.type === 'cluster' ? 1 : (item.sets || (exData && exData.sets ? exData.sets.length : 0)));
            // Cut: תצוגת תרגיל מיין מוגבלת ל-4 סטים — תואם את הקאפ בפועל
            if (isMain && totalSets > CUT_MAIN_SET_CAP && _cutCapMainActive()) totalSets = CUT_MAIN_SET_CAP;
            const doneSets = setsCountMap[exName] || 0;
            const muscles = exData ? (exData.muscles || []).join(', ') : '';
            const exTM = isMain ? _displayTM(exName) : null;
            const tmBadgeHtml = exTM != null ? `<span class="plan-tm-badge">TM ${exTM}kg</span>` : '';

            if (isDone && !shownDone) { html += `<div class="plan-section-label">הושלמו</div>`; shownDone = true; }
            if (isCurrent && !shownCurrent) { html += `<div class="plan-section-label">עכשיו</div>`; shownCurrent = true; }
            if (!isDone && !isCurrent && !shownUpcoming) { html += `<div class="plan-section-label">הבאים</div>`; shownUpcoming = true; }

            let dotClass = 'dot-upcoming';
            let itemClass = '';
            let rightHtml = '';

            if (isDone) {
                dotClass = 'dot-done';
                itemClass = 'plan-done';
                rightHtml = `<span class="plan-done-check">✓</span><span class="plan-sets-done">${doneSets} סטים</span>`;
            } else if (isCurrent) {
                dotClass = 'dot-current';
                itemClass = 'plan-current';
                rightHtml = doneSets > 0
                    ? `<span class="plan-sets-done">סט ${doneSets + 1}/${totalSets}</span>`
                    : `<span class="plan-sets-done">${totalSets} סטים</span>`;
            } else {
                if (isMain) { dotClass = 'dot-main'; itemClass = 'plan-main'; }
                rightHtml = `<span class="plan-sets-done">${totalSets} סטים</span>`;
            }

            html += `
                <div class="plan-ex-item ${itemClass}">
                    <div class="plan-ex-num">${num}</div>
                    <div class="plan-ex-dot ${dotClass}"></div>
                    <div class="plan-ex-info">
                        <div class="plan-ex-name ${isDone ? 'name-done' : ''}">${escapeHtml(exName)}</div>
                        ${muscles ? `<div class="plan-ex-meta">${muscles}</div>` : ''}
                    </div>
                    <div class="plan-ex-right">
                        ${isMain && !isDone ? `<span class="plan-main-badge">MAIN</span>${tmBadgeHtml}` : ''}
                        ${rightHtml}
                    </div>
                </div>`;
        });
    });

    body.innerHTML = html;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'plan-sheet-close';
    closeBtn.textContent = 'סגור';
    closeBtn.onclick = closePlanSheet;
    body.appendChild(closeBtn);

    document.getElementById('workout-plan-overlay').style.display = 'block';
    requestAnimationFrame(() => {
        document.getElementById('workout-plan-sheet').classList.add('open');
    });
    haptic('light');
}

function closePlanSheet() {
    document.getElementById('workout-plan-sheet').classList.remove('open');
    document.getElementById('workout-plan-overlay').style.display = 'none';
}

function updatePlanFloatBtn(screenId) {
    // נקה כפתורי תרגילים שהוזרקו בעבר
    document.querySelectorAll('.plan-tool-btn-row').forEach(el => el.remove());
    // הכפתור זמין דרך תפריט שלוש הנקודות בסטריפ — אין צורך בהזרקה למסך
}

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
    state.sessionElapsedSecs = 0;
    state.clusterMode = false;
    startSessionTimer();
    checkFlow();
}

// ─── FLOW CONTROL (while-loop, no recursion) ───────────────────────────────

function checkFlow() {
    const workoutList = state.workouts[state.type];

    // כל שמות התרגילים המתוכננים באימון (כולל תרגילי קלאסטר) —
    // כדי שהשלמת תרגיל מתוכנן לא תדלג על וריאציה שלו שמתוכננת גם היא
    const plannedNames = workoutList.flatMap(item =>
        item.type === 'cluster' ? (item.exercises || []).map(e => e.name) : [item.name]
    );

    while (
        state.exIdx < workoutList.length &&
        workoutList[state.exIdx].type !== 'cluster' &&
        isExOrVariationDone(workoutList[state.exIdx].name, plannedNames)
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
        state.activeCluster = deepClone(item);
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
        // מצב תצוגת מבוא לסבב — אפס currentEx כדי שconfirmExercise ידע שזה מסך המבוא
        state.currentEx = null;
        state.currentExName = '';

        // שם דינמי לפי כמות תרגילים: סופרסט (2) / ג'יאנט סט (3+) / סבב כללי
        const exCount = state.activeCluster.exercises.length;
        const headingName = exCount >= 3 ? "ג׳יאנט סט (Giant Set)"
                          : exCount === 2 ? "סופרסט (Superset)"
                          : "סבב / מעגל (Cluster)";
        document.getElementById('confirm-ex-name').innerText = headingName;
        document.getElementById('confirm-ex-config').innerText = `סבב ${state.clusterRound} מתוך ${state.activeCluster.rounds} • ${exCount} תרגילים`;
        document.getElementById('confirm-ex-config').style.display = 'block';

        const historyContainer = document.getElementById('history-container');
        // 4+ תרגילים → רשימה גלילה כדי שלא ידחפו את הכפתורים מחוץ למסך
        const scrollClass = exCount >= 4 ? ' cluster-intro-list--scroll' : '';
        let listHtml = `<div class="cluster-intro-list${scrollClass}">`;
        state.activeCluster.exercises.forEach((ex, i) => {
            const tag = String.fromCharCode(65 + i); // A, B, C...
            listHtml += `<div class="cluster-intro-row"><span class="cluster-intro-tag">${tag}</span><span class="cluster-intro-name">${escapeHtml(ex.name)}</span></div>`;
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

    state.currentEx = deepClone(exData);
    state.currentExName = exData.name;

    if (currentPlanItem) {
        if (currentPlanItem.restTime) state.currentEx.restTime = currentPlanItem.restTime;
        if (currentPlanItem.targetWeight !== undefined) state.currentEx.targetWeight = currentPlanItem.targetWeight;
        if (currentPlanItem.targetReps !== undefined) state.currentEx.targetReps = currentPlanItem.targetReps;
        if (currentPlanItem.targetRIR !== undefined) state.currentEx.targetRIR = currentPlanItem.targetRIR;
    }

    document.getElementById('confirm-ex-name').innerText = exData.name;
    const configDiv = document.getElementById('confirm-ex-config');

    if (state.clusterMode) {
        configDiv.innerHTML = `חלק מסבב (${state.clusterRound}/${state.activeCluster.rounds})`;
        configDiv.style.display = 'block';
    } else if (currentPlanItem) {
        if (currentPlanItem.isMain) {
            const tm = _displayTM(exName);
            configDiv.innerHTML = tm != null ? `MAIN · TM ${tm}kg` : "MAIN (מחושב 1RM)";
        }
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

    if (typeof getLastPerformances === 'function') {
        const performances = getLastPerformances(exName, 5);
        _renderHistoryPager(historyContainer, performances, { title: 'ביצוע קודם' });
    }

    navigate('ui-confirm');
    StorageManager.saveSessionState();
}

// ─── WORKOUT EXECUTION ─────────────────────────────────────────────────────

function confirmExercise(doEx) {
    // מסך מבוא לסבב — currentEx אפס מסמן שטרם בחרנו תרגיל ספציפי
    if (state.clusterMode && state.clusterIdx === 0 && !state.currentEx) {
        const firstExItem = state.activeCluster.exercises[0];
        const exData = state.exercises.find(e => e.name === firstExItem.name);
        if (!exData) { showAlert(`שגיאה: תרגיל "${firstExItem.name}" לא נמצא במאגר.`); return; }

        state.currentEx = deepClone(exData);
        state.currentExName = exData.name;

        if (firstExItem.restTime) state.currentEx.restTime = firstExItem.restTime;
        if (firstExItem.targetWeight !== undefined) state.currentEx.targetWeight = firstExItem.targetWeight;
        if (firstExItem.targetReps !== undefined) state.currentEx.targetReps = firstExItem.targetReps;
        if (firstExItem.targetRIR !== undefined) state.currentEx.targetRIR = firstExItem.targetRIR;

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
        const configuredTM = StorageManager.getExerciseTM(state.currentExName);
        if (configuredTM != null) {
            applyRMAndStart(configuredTM);   // TM מוגדר בהגדרות — דילוג על מסך הזנת 1RM
        } else {
            setupCalculatedEx();
        }
    } else {
        state.currentEx.isCalc = false; // תרגיל isCalc שלא סומן כ-Main — חייב לכבות כדי ש-initPickers ישתמש ביעדים
        if (targetSets && targetSets > 0) resizeSets(targetSets);
        startRecording();
    }
}

function resizeSets(count) {
    const defaultReps = (state.currentEx.sets && state.currentEx.sets[0]) ? state.currentEx.sets[0].r : 10;
    const defaultWeight = (state.currentEx.sets && state.currentEx.sets[0]) ? state.currentEx.sets[0].w : 10;
    // אובייקט חדש לכל סט — fill() משכפל reference אחד וכל mutation עתידי היה מדליף בין סטים
    state.currentEx.sets = Array.from({ length: count }, () => ({ w: defaultWeight, r: defaultReps }));
}

function setupCalculatedEx() {
    document.getElementById('rm-title').innerText = `${state.currentExName} 1RM`;
    const lastRM = StorageManager.getLastRM(state.currentExName);
    const baseRM = state.currentEx.baseRM || 50;
    const p = document.getElementById('rm-picker'); p.innerHTML = "";
    const defaultRM = lastRM != null ? lastRM : baseRM;
    for (let i = 20; i <= 200; i += 2.5) {
        p.add(new Option(i + " kg", i));
    }
    // Robust selection: find closest option to defaultRM
    let bestIdx = 0, bestDiff = Infinity;
    for (let j = 0; j < p.options.length; j++) {
        const diff = Math.abs(parseFloat(p.options[j].value) - defaultRM);
        if (diff < bestDiff) { bestDiff = diff; bestIdx = j; }
    }
    p.selectedIndex = bestIdx;

    // עדכון תצוגה ויזואלית
    syncRMDisplay();

    // Delta — השוואה לשבוע המקביל בסייקל הקודם
    const deltaRow = document.getElementById('rm-delta-row');
    const deltaText = document.getElementById('rm-delta-text');
    if (deltaRow && deltaText) {
        let prevRM = null;
        const wk = parseInt(state.week);
        if (!isNaN(wk) && wk >= 1 && wk <= 3) {
            const archive = StorageManager.getArchive();
            const cycleStart = archive.findIndex(a => a.week === 1);
            if (cycleStart !== -1) {
                const prevEntries = archive.slice(cycleStart + 1);
                const match = prevEntries.find(a =>
                    parseInt(a.week) === wk && a.type === state.type
                );
                if (match) {
                    // rmValues נשמר באנטרי חדשים
                    if (match.rmValues && match.rmValues[state.currentExName]) {
                        prevRM = match.rmValues[state.currentExName];
                    } else if (Array.isArray(match.log)) {
                        // fallback: חישוב הפוך מהמשקל הכבד ביותר
                        const exLogs = match.log.filter(l => l && l.exName === state.currentExName && !l.skip);
                        if (exLogs.length) {
                            const maxW = Math.max(...exLogs.map(l => l.w || 0));
                            const maxPct = wk === 1 ? 0.85 : wk === 2 ? 0.90 : 0.95;
                            if (maxW > 0) prevRM = Math.round(maxW / maxPct / 2.5) * 2.5;
                        }
                    }
                }
            }
        }
        if (prevRM != null) {
            const diff = Math.round((defaultRM - prevRM) * 10) / 10;
            if (diff !== 0) {
                deltaText.textContent = diff > 0
                    ? `+${diff}kg משבוע ${state.week} קודם`
                    : `${diff}kg משבוע ${state.week} קודם`;
                deltaRow.style.display = 'flex';
            } else {
                deltaRow.style.display = 'none';
            }
        } else {
            deltaRow.style.display = 'none';
        }
    }

    navigate('ui-1rm');
    StorageManager.saveSessionState();
}

function syncRMDisplay() {
    const p = document.getElementById('rm-picker');
    const display = document.getElementById('rm-display-val');
    if (!p || !display) return;
    const val = parseFloat(p.options[p.selectedIndex]?.value);
    display.textContent = isNaN(val) ? '—' : val;
}

function stepRM(dir) {
    const p = document.getElementById('rm-picker');
    if (!p) return;
    const newIdx = Math.max(0, Math.min(p.options.length - 1, p.selectedIndex + dir));
    p.selectedIndex = newIdx;
    syncRMDisplay();
    haptic && haptic('light');
}

// applyRMAndStart — מחשב את סטי התרגיל מאחוזי ה-RM/TM לפי השבוע הנוכחי, ומתחיל הקלטה.
// משותף לזרימת ה-1RM הידנית (save1RM) ולזרימת ה-TM האוטומטית (TM מוגדר בהגדרות).
function applyRMAndStart(rmValue) {
    state.rm = rmValue;
    StorageManager.saveRM(state.currentExName, state.rm);
    state.rmUsed[state.currentExName] = state.rm;
    let percentages = []; let reps = [];
    const w = parseInt(state.week);
    if (w === 1) { percentages = [0.65, 0.75, 0.85, 0.75, 0.65]; reps = [5, 5, 5, 8, 10]; }
    else if (w === 2) { percentages = [0.70, 0.80, 0.90, 0.80, 0.70, 0.70]; reps = [3, 3, 3, 8, 10, 10]; }
    else if (w === 3) { percentages = [0.75, 0.85, 0.95, 0.85, 0.75, 0.75]; reps = [5, 3, 1, 8, 10, 10]; }
    else { percentages = [0.65, 0.75, 0.85, 0.75, 0.65]; reps = [5, 5, 5, 8, 10]; }
    state.currentEx.sets = percentages.map((pct, i) => ({ w: Math.round((state.rm * pct) / 2.5) * 2.5, r: reps[i] }));
    // Cut: הגבלת תרגיל מיין ל-4 הסטים הראשונים (הכבדים) — לא הרסני, רק ל-session הנוכחי
    if (_cutCapMainActive() && state.currentEx.sets.length > CUT_MAIN_SET_CAP)
        state.currentEx.sets = state.currentEx.sets.slice(0, CUT_MAIN_SET_CAP);
    startRecording();
}

function save1RM() {
    applyRMAndStart(parseFloat(document.getElementById('rm-picker').value));
}

function startRecording() {
    const existingLogs = state.log.filter(l => l.exName === state.currentExName && !l.skip);

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

    // איפוס תצוגת הטיימר ל-00:00 לפני הסט הראשון של תרגיל חדש —
    // אחרת ה-live-timer מציג ערך שיורית מהתרגיל הקודם (1-4 שניות) עד שמוקלט הסט הראשון
    _resetTimerDisplays();

    navigate('ui-main');
    initPickers();
    StorageManager.saveSessionState();
}

// איפוס מלא של כל תצוגות הטיימר (רגיל + cluster + live) ל-00:00
function _resetTimerDisplays() {
    const restText = document.getElementById('rest-timer');
    const restBar = document.getElementById('timer-progress');
    const clText = document.getElementById('cluster-timer-text');
    const clBar = document.getElementById('cluster-timer-bar');
    const liveText = document.getElementById('live-timer-text');
    const liveBar = document.getElementById('live-timer-progress');
    if (restText) restText.innerText = '00:00';
    if (restBar) restBar.style.strokeDashoffset = 283;
    if (clText) clText.innerText = '00:00';
    if (clBar) clBar.style.strokeDashoffset = 289;
    if (liveText) liveText.textContent = '00:00';
    if (liveBar) liveBar.style.strokeDashoffset = 289;
}

function isUnilateral(exName) {
    const exData = state.exercises.find(e => e.name === exName);
    if (exData && exData.isUnilateral !== undefined) return exData.isUnilateral;
    return unilateralKeywords.some(keyword => exName.includes(keyword));
}

// ─── WEIGHT MODES (ק״ג / פלטות / משקל גוף) ─────────────────────────────────
// כל תרגיל יכול לעבוד באחת משלוש שיטות: kg (ברירת מחדל), plates, bw.
// ברירת המחדל נקבעת בעורך התרגיל (weightMode); דגל isBW ישן ממופה ל-bw.
// החלפה תוך כדי אימון נשמרת ב-state.sessionWeightModes — חד-פעמית לאותו אימון.

const PLATE_KG = 2.5; // משקל פלטה משוער לחישוב ווליום

const WEIGHT_MODE_LABELS = { kg: 'Weight (kg)', plates: 'פלטות', bw: 'משקל גוף' };

// השיטה האפקטיבית לתרגיל — עדיפות: override של האימון הנוכחי → הגדרת התרגיל → kg
function _effWeightMode(exName) {
    const name = exName || state.currentExName;
    if (state.sessionWeightModes && state.sessionWeightModes[name]) return state.sessionWeightModes[name];
    const ex = state.exercises.find(e => e.name === name) ||
               (state.currentEx && state.currentExName === name ? state.currentEx : null);
    if (!ex) return 'kg';
    return ex.weightMode || (ex.isBW ? 'bw' : 'kg');
}

// תצוגת משקל של סט לפי שיטה — '80kg' / '5 פלטות' / 'BW'
function _fmtW(entry) {
    if (entry.wm === 'bw') return 'BW';
    if (entry.wm === 'plates') return entry.w + ' פלטות';
    return entry.w + 'kg';
}

// ווליום של רשומת לוג — bw לא נספר; פלטות לפי PLATE_KG
function _setVol(entry) {
    if (entry.wm === 'bw') return 0;
    const w = entry.wm === 'plates' ? entry.w * PLATE_KG : entry.w;
    return w * entry.r;
}

// ווליום מסטרינג סט בארכיון: "80kg x 5" / "5 פלטות x 10" / "BW x 12"
function _setStrVol(setStr) {
    const core = setStr.includes('|') ? setStr.split('|')[0].trim() : setStr;
    if (core.indexOf('BW') === 0) return 0; // משקל גוף — חזרות בלבד
    const parts = core.split('x');
    if (parts.length < 2) return 0;
    let w = parseFloat(parts[0].replace('kg', '').replace('פלטות', '').replace('(צד אחד)', '').replace('(יד אחת)', '').trim());
    if (isNaN(w)) return 0;
    if (parts[0].includes('פלטות')) w *= PLATE_KG;
    const rMatch = parts[1].match(/\d+/);
    const r = rMatch ? parseInt(rMatch[0]) : 1;
    return w * r;
}

// החלפת שיטה תוך כדי אימון (לחיצה על תווית כרטיס המשקל) — kg → פלטות → משקל גוף
function cycleWeightMode() {
    if (!state.currentExName) return;
    const order = ['kg', 'plates', 'bw'];
    const next = order[(order.indexOf(_effWeightMode()) + 1) % order.length];
    if (!state.sessionWeightModes) state.sessionWeightModes = {};
    state.sessionWeightModes[state.currentExName] = next;
    haptic('light');
    // initPickers מאפס את שדה ההערה — משמרים אותו סביב הקריאה
    const noteEl = document.getElementById('set-notes');
    const keepNote = noteEl ? noteEl.value : '';
    initPickers();
    if (noteEl) noteEl.value = keepNote;
    // סנכרון תצוגות ה-Live — ההחלפה זמינה גם מה-sheet של מצב Live
    if (typeof _syncLiveEditSheetDisplays === 'function') _syncLiveEditSheetDisplays();
    if (typeof _syncLiveWeightModeUI === 'function') _syncLiveWeightModeUI();
    StorageManager.saveSessionState();
}

// ─── INIT PICKERS ──────────────────────────────────────────────────────────

function initPickers() {
    document.getElementById('ex-display-name').innerText = state.currentExName.replace(/\s*\(Main\)/i, '');
    const exHeader = document.querySelector('.exercise-header');
    const existingQueue = document.querySelector('.cluster-queue-container');
    if (existingQueue) existingQueue.remove();

    const uiMain = document.getElementById('ui-main');
    if (state.clusterMode) uiMain.classList.add('cluster');
    else uiMain.classList.remove('cluster');

    if (state.clusterMode) {
        const queueDiv = document.createElement('div');
        queueDiv.className = 'cluster-queue-container';
        let pillsHtml = '';
        let foundNext = false;
        for (let i = state.clusterIdx + 1; i < state.activeCluster.exercises.length; i++) {
            const exName = state.activeCluster.exercises[i].name;
            const isNext = !foundNext;
            pillsHtml += `<div class="queue-pill ${isNext ? 'next' : ''}"><span class="queue-pill-label">${isNext ? 'הבא: NEXT' : 'LATER'}</span><span class="queue-pill-name">${escapeHtml(exName)}</span></div>`;
            foundNext = true;
        }
        if (!foundNext) pillsHtml += `<div class="queue-pill"><span class="queue-pill-name">סוף סבב</span></div>`;
        queueDiv.innerHTML = `<div class="cluster-queue-header"><div class="queue-title">≡ תור הקלאסטר</div><span class="queue-continue-lbl">המשך הסבב</span></div><div class="cluster-queue-pills">${pillsHtml}</div>`;
        exHeader.parentNode.insertBefore(queueDiv, exHeader.nextSibling);
    }

    const badge = document.getElementById('set-counter');
    const existingTrainingLabel = document.getElementById('cluster-training-label');
    if (existingTrainingLabel) existingTrainingLabel.remove();

    if (state.clusterMode) {
        badge.innerText = `ROUND ${state.clusterRound}/${state.activeCluster.rounds}`;
        badge.style.background = "var(--secondary)";
        badge.style.color = "#0a0a0a";
        badge.style.borderColor = "var(--secondary)";
        const badgeRow = document.querySelector('.badge-row');
        const label = document.createElement('span');
        label.id = 'cluster-training-label';
        label.className = 'cluster-training-lbl';
        label.textContent = 'כעת מתאמנים';
        badgeRow.appendChild(label);
    } else {
        badge.innerText = `SET ${Math.min(state.setIdx, state.currentEx.sets.length - 1) + 1}/${state.currentEx.sets.length}`;
        badge.style.background = "var(--accent)";
        badge.style.color = "";
        badge.style.borderColor = "";
    }

    // clamp — חזרה לתרגיל שכל הסטים שלו נרשמו עלולה להציב setIdx מעבר לגבול המערך
    const target = state.currentEx.sets[Math.min(state.setIdx, state.currentEx.sets.length - 1)] || {};
    document.getElementById('set-notes').value = '';

    let defaultW = 0;
    let defaultR = 8;
    let defaultRIR = 2;

    if (state.currentEx.isCalc) {
        defaultW = target.w || 0;
        defaultR = target.r || 8;
        defaultRIR = 2;
    } else if (state.setIdx > 0 && state.lastLoggedSet) {
        defaultW = state.lastLoggedSet.w;
        defaultR = state.lastLoggedSet.r;
        defaultRIR = state.lastLoggedSet.rir;
    } else {
        const sessionHistory = state.log.filter(l => l.exName === state.currentExName && !l.skip);

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
        hist.innerText = `סט אחרון: ${_fmtW(state.lastLoggedSet)} x ${state.lastLoggedSet.r} (RIR ${state.lastLoggedSet.rir})`;
        hist.style.display = 'block';
    } else {
        hist.style.display = 'none';
    }

    document.getElementById('unilateral-note').style.display = isUnilateral(state.currentExName) ? 'block' : 'none';

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

    // שיטת המשקל — קובעת את בורר המשקל, התווית והכפתורים
    const wMode = _effWeightMode();
    const wModeLabel = document.getElementById('weight-mode-label');
    if (wModeLabel) wModeLabel.textContent = WEIGHT_MODE_LABELS[wMode] + ' ⇄';
    const wStepperRow = document.getElementById('weight-stepper-row');
    if (wStepperRow) wStepperRow.style.visibility = wMode === 'bw' ? 'hidden' : 'visible';

    if (wMode === 'bw') {
        // משקל גוף — אין משקל לבחור
        wPick.add(new Option('BW', 0));
    } else if (wMode === 'plates') {
        // פלטות — מונה 1–30 בקפיצות של 1; ערך שמור מקונטקסט ק"ג נחתך לטווח
        let defaultP = Math.round(defaultW) || 1;
        if (defaultP < 1) defaultP = 1;
        if (defaultP > 30) defaultP = 1;
        for (let i = 1; i <= 30; i++) {
            let o = new Option(i, i); if (i === defaultP) o.selected = true; wPick.add(o);
        }
    } else {
        let minW = manualRange.min !== undefined ? manualRange.min : (state.currentEx.minW !== undefined ? state.currentEx.minW : Math.max(0, defaultW - 40));
        let maxW = manualRange.max !== undefined ? manualRange.max : (state.currentEx.maxW !== undefined ? state.currentEx.maxW : defaultW + 50);
        if (minW < 0) minW = 0;

        for (let i = minW; i <= maxW; i = parseFloat((i + step).toFixed(2))) {
            let o = new Option(i + " kg", i); if (i === defaultW) o.selected = true; wPick.add(o);
        }
        // משקל שמור שהוזן ידנית ולא יושב על רשת ה-step (למשל 47.3 בקפיצות 2.5) —
        // בלי זה אף option לא נבחר וה-select נופל למשקל המינימלי
        if (wPick.selectedIndex <= 0 && defaultW > minW) _setPickerValue(wPick, defaultW);
    }

    const rPick = document.getElementById('reps-picker'); rPick.innerHTML = "";
    for (let i = 1; i <= 30; i++) { let o = new Option(i, i); if (i === defaultR) o.selected = true; rPick.add(o); }

    const rirPick = document.getElementById('rir-picker'); rirPick.innerHTML = "";
    [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5].forEach(v => {
        let o = new Option(v === 0 ? "Fail" : v, v);
        if (parseFloat(v) === parseFloat(defaultRIR)) o.selected = true;
        rirPick.add(o);
    });

    syncStepperDisplay('weight');
    syncStepperDisplay('reps');
    syncStepperDisplay('rir');

    _resetSetRecState();

    // סנכרון Live View — חשוב: ה-pickers הם source-of-truth ל-updateLiveViewContent,
    // אז אחרי שמילאנו אותם בערכים החדשים, צריך לרענן את מסך ה-Live כדי שלא יציג ערכים של תרגיל קודם
    if (typeof updateLiveViewContent === 'function' && document.body.classList.contains('live-mode-active')) {
        updateLiveViewContent();
        if (typeof _syncLiveWeightModeUI === 'function') _syncLiveWeightModeUI();
    }
}

// ─── AI SET RECOMMENDATION ─────────────────────────────────────────────────
// המלצה חכמה לסט הבא — נשלחת ל-Gemini עם context מלא של ביצועים + מצב תזונתי.
// מופעלת לחיצה ידנית כדי לחסוך קריאות API.
// UI: טריגר זעיר ב-badge-row + תוצאה ב-bottom sheet (לא דוחפת את הטיימר).

let _pendingAIRecommendation = null;

// _roundRecommendedWeight — מעגל ל-2.5 ק"ג עבור משקלים מעל 25 ק"ג.
// תרגילים קלים (משקולות יד קטנות, כבלים) יכולים להישאר בערכים מדויקים.
function _roundRecommendedWeight(w) {
    if (typeof w !== 'number' || !isFinite(w)) return w;
    if (w <= 25) return w;
    return Math.round(w / 2.5) * 2.5;
}

function _resetSetRecState() {
    _pendingAIRecommendation = null;
    const trigger = document.getElementById('set-rec-trigger');
    if (trigger) {
        const hasKey = !!StorageManager.getAIConfig().apiKey;
        trigger.style.display = hasKey ? 'inline-flex' : 'none';
        trigger.removeAttribute('disabled');
    }
    _closeSetRecSheet(true);
}

function _openSetRecSheet() {
    const overlay = document.getElementById('set-rec-overlay');
    const sheet   = document.getElementById('set-rec-sheet');
    if (!overlay || !sheet) return;
    overlay.style.display = 'block';
    // המתנה ל-paint כדי שטרנזישן ה-transform יפעל בצורה חלקה
    requestAnimationFrame(() => sheet.classList.add('open'));
}

function _closeSetRecSheet(instant = false) {
    const overlay = document.getElementById('set-rec-overlay');
    const sheet   = document.getElementById('set-rec-sheet');
    if (!overlay || !sheet) return;
    sheet.classList.remove('open');
    if (instant) {
        overlay.style.display = 'none';
    } else {
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
}

function _buildRecommendationPrompt(exName) {
    const nutri    = getNutritionalContext();
    const persona  = StorageManager.getAIPersona() || '';
    const performances = (typeof getLastPerformances === 'function') ? getLastPerformances(exName, 5) : [];
    const targetReps   = state.currentEx?.targetReps ?? '';
    const targetRIR    = state.currentEx?.targetRIR ?? '';
    const currentSetN  = (state.setIdx || 0) + 1;
    const lastRM       = StorageManager.getLastRM ? StorageManager.getLastRM(exName) : '';

    let history = '';
    performances.forEach(p => {
        const setsStr = (p.sets || []).join(' | ');
        history += `  - ${p.date}: ${setsStr}\n`;
    });
    if (!history) history = '  (אין נתונים קודמים)\n';

    return `You are a strength training coach. Recommend ONE next set for the user.

Context:
- Nutritional state: ${nutri}
- Exercise: ${exName}
- Set number (this session): ${currentSetN}
- Target reps: ${targetReps || 'unspecified'}
- Target RIR: ${targetRIR !== '' ? targetRIR : 'unspecified'}
- Last 1RM: ${lastRM || 'unspecified'}
- Persona: ${persona || 'unspecified'}

Last sessions (newest first):
${history}

Guidelines:
- CUT: prioritize maintaining strength; avoid aggressive load increases. Volume preservation preferred.
- SURPLUS: progressive overload preferred (+weight step or +1 rep when targets met).
- MAINTENANCE: consistency; small sustainable gains.
- If last RIR>=2 and reps hit target → recommend +1 step weight.
- If last RIR=0 and reps below target → recommend a small deload.
- Otherwise → keep weight, suggest +1 rep.

Weight rounding rule (CRITICAL):
- If the recommended weight is greater than 25 kg → ROUND to the nearest 2.5 kg (e.g. 52.3 → 52.5, 78.7 → 80, 41.2 → 40).
- If 25 kg or less → leave precision as-is (small dumbbells / cables can use 1 kg increments).

Respond with ONLY valid JSON (no markdown, no commentary, no code fences):
{ "w": <number kg>, "r": <number reps>, "rir": <number>, "reason": "<short Hebrew explanation up to 80 chars>" }`;
}

// ─── שכבת תחבורה משותפת ל-Gemini (v17.12) ───────────────────────────────────
// כל קריאות ה-API באפליקציה (צ'אט, one-shot, Vision, מזון, תוויות) חולקות את
// אותם מנגנונים: סדר מודלים לפי "האחרון שהצליח", thinkingConfig מותאם-מודל,
// timeout לניסיון, ו-fallback בין מודלים. אין לשכפל לולאת fetch — להשתמש כאן.

const GEMINI_PREF_MODEL_KEY = 'gympro_ai_pref_model';

// Gemini 3 אינו תומך ב-thinkingBudget:0 לכיבוי חשיבה — שם הפרמטר הוא thinkingLevel.
// בלעדיו המודל "חושב" בברירת מחדל (medium), מבזבז את תקרת הטוקנים על מחשבות
// ומחזיר טקסט גלוי ריק (finishReason=MAX_TOKENS) → תשובה ריקה/איטית מאוד.
function _geminiThinkingConfig(modelName) {
    return /gemini-3/i.test(modelName) ? { thinkingLevel: 'low' } : { thinkingBudget: 0 };
}

// מודל מועדף — האחרון שהצליח נשמר ונבדק ראשון בקריאות הבאות.
// בלי זה, מפתח שחוטף 404/429 במודל הראשון משלם סיבוב מבוזבז בכל קריאה (איטיות כרונית).
function _geminiOrderedModels(config) {
    const pref = localStorage.getItem(GEMINI_PREF_MODEL_KEY);
    return (pref && config.models.includes(pref))
        ? [pref, ...config.models.filter(m => m !== pref)]
        : config.models;
}

function _geminiMarkModelOk(m) { try { localStorage.setItem(GEMINI_PREF_MODEL_KEY, m); } catch (e) {} }

/**
 * _geminiRequest — בקשת generateContent אחת עם fallback על כל המודלים.
 * payload: { systemInstruction?, contents, generationConfig } — בלי thinkingConfig (מוזרק פר-מודל).
 * opts: { timeoutMs=30000, json=false, fallbackStatuses=[400,404,429,503] }
 *   json=true → מפרסר JSON ומנסה מודל הבא גם על תשובה לא-תקינה (שימור התנהגות ה-Vision/מזון).
 * מחזיר { text, parts, finishReason, model } או את ה-JSON המפורסר כש-json=true.
 */
async function _geminiRequest(payload, opts = {}) {
    const config = StorageManager.getAIConfig();
    if (!config.apiKey) throw new Error('API_KEY_MISSING');
    const timeoutMs = opts.timeoutMs || 30000;
    const fallbackStatuses = opts.fallbackStatuses || [400, 404, 429, 503];
    let lastErr = '';
    for (const modelName of _geminiOrderedModels(config)) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.apiKey}`;
            const body = {
                contents: payload.contents,
                generationConfig: Object.assign({}, payload.generationConfig, { thinkingConfig: _geminiThinkingConfig(modelName) })
            };
            if (payload.systemInstruction) body.system_instruction = payload.systemInstruction;
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), timeoutMs);
            let response;
            try {
                response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: ctrl.signal
                });
            } finally { clearTimeout(timer); }
            if (!response.ok) {
                if (fallbackStatuses.includes(response.status)) { lastErr = `${modelName}: ${response.status}`; continue; }
                const errData = await response.json().catch(() => ({}));
                throw new Error(`API_ERROR_${response.status}: ${errData.error?.message || ''}`);
            }
            const data = await response.json();
            const candidate = data.candidates?.[0];
            const parts = candidate?.content?.parts || [];
            const text = parts.filter(p => !p.thought).map(p => p.text || '').join('');
            if (opts.json) {
                let parsed;
                try { parsed = JSON.parse(text); }
                catch (e) { lastErr = `${modelName}: bad JSON`; continue; }   // מודל החזיר JSON שבור — נסה הבא
                _geminiMarkModelOk(modelName);
                return parsed;
            }
            _geminiMarkModelOk(modelName);
            return { text, parts, finishReason: candidate?.finishReason || '', model: modelName };
        } catch (e) {
            if (e.name === 'AbortError' || (e.message && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')))) {
                lastErr = `${modelName}: ${e.name === 'AbortError' ? 'timeout' : e.message}`;
                continue;
            }
            throw e;
        }
    }
    const err = new Error('ALL_MODELS_FAILED');
    err._details = lastErr;
    throw err;
}

async function _callGeminiOneShot(prompt, opts = {}) {
    const config = StorageManager.getAIConfig();
    if (!config.apiKey) throw new Error('API_KEY_MISSING');

    const models = _geminiOrderedModels(config);
    const _markOk = _geminiMarkModelOk;
    const _thinkingConfig = _geminiThinkingConfig;
    const _genConfigFor = (modelName) => opts.freeText
        ? { temperature: 0.7, maxOutputTokens: opts.maxTokens || 8192, thinkingConfig: _thinkingConfig(modelName) }
        : { temperature: 0.35, maxOutputTokens: opts.maxTokens || 512, responseMimeType: 'application/json', thinkingConfig: _thinkingConfig(modelName) };

    // freeText — מאפשרים עד 3 סבבי המשך אם התשובה נחתכה (finishReason === 'MAX_TOKENS')
    const MAX_CONT_ROUNDS = opts.freeText ? 3 : 0;
    // timeout לניסיון בודד — בקשה תקועה עוברת למודל הבא במקום להיתקע לנצח
    const ATTEMPT_TIMEOUT_MS = opts.freeText ? 60000 : 20000;

    let lastErr = '';
    modelLoop:
    for (const modelName of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.apiKey}`;
            // שיחה רב-תורית — מתחילה מה-prompt, וגדלה עם כל סבב המשך
            const contents = [{ role: 'user', parts: [{ text: prompt }] }];
            const generationConfig = _genConfigFor(modelName);
            let fullText = '';

            for (let round = 0; round <= MAX_CONT_ROUNDS; round++) {
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), ATTEMPT_TIMEOUT_MS);
                let response;
                try {
                    response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents, generationConfig }),
                        signal: ctrl.signal
                    });
                } finally {
                    clearTimeout(timer);
                }
                if (!response.ok) {
                    if (response.status === 429 || response.status === 503 || response.status === 404) {
                        lastErr = `${modelName}: ${response.status}`;
                        continue modelLoop; // עבור למודל הבא
                    }
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(`API_ERROR_${response.status}: ${errData.error?.message || ''}`);
                }
                const data = await response.json();
                const candidate = data.candidates?.[0];
                const parts = candidate?.content?.parts || [];
                if (!opts.freeText) { _markOk(modelName); return parts.find(p => !p.thought)?.text || ''; }

                // freeText — איחוד כל ה-parts (תשובה ארוכה עלולה להתפצל)
                const chunk = parts.filter(p => !p.thought).map(p => p.text || '').join('');
                fullText += chunk;

                // אם המודל סיים מרצונו (STOP) או שאין עוד מה לחתוך — מחזירים
                if (candidate?.finishReason !== 'MAX_TOKENS' || !chunk) { _markOk(modelName); return fullText.trim(); }

                // נחתך באמצע — מבקשים המשך מהנקודה שבה עצר, בלי לחזור על מה שנכתב.
                // דוחפים את ה-parts המקוריים (כולל thoughtSignature) — Gemini 3 דורש זאת ב-multi-turn.
                contents.push({ role: 'model', parts });
                contents.push({ role: 'user', parts: [{ text: 'המשך בדיוק מהמקום שבו עצרת, ללא חזרה על מה שכבר נכתב וללא הקדמה.' }] });
            }
            _markOk(modelName);
            return fullText.trim();
        } catch(e) {
            // AbortError (timeout) או שגיאת רשת — מנסים את המודל הבא
            if (e.name === 'AbortError' || (e.message && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')))) {
                lastErr = `${modelName}: ${e.name === 'AbortError' ? 'timeout' : e.message}`;
                continue;
            }
            throw e;
        }
    }
    const err = new Error('ALL_MODELS_FAILED');
    err._details = lastErr;
    throw err;
}

async function requestAIRecommendation() {
    if (!state.currentExName) return;
    const trigger = document.getElementById('set-rec-trigger');
    const result  = document.getElementById('set-rec-result');
    if (!trigger || !result) return;

    haptic('light');
    trigger.setAttribute('disabled', 'true');
    result.className = 'set-rec-result loading';
    result.innerHTML = '⏳ המאמן חושב על הסט הבא...';
    _openSetRecSheet();

    try {
        const prompt   = _buildRecommendationPrompt(state.currentExName);
        const raw      = await _callGeminiOneShot(prompt);
        const cleaned  = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        const rec      = JSON.parse(cleaned);
        if (typeof rec.w !== 'number' || typeof rec.r !== 'number') throw new Error('BAD_RESPONSE');
        // הגנת רשת — מעגל מ-AI שלא ציית להוראת ה-rounding בפרומפט
        rec.w = _roundRecommendedWeight(rec.w);
        _renderAIRecommendation(rec);
    } catch (e) {
        console.warn('GymPro: AI recommendation failed', e);
        result.className = 'set-rec-result error';
        result.innerHTML = e.message === 'API_KEY_MISSING'
            ? 'נדרש להגדיר Gemini API Key בהגדרות.'
            : 'לא הצלחתי לקבל המלצה — נסה שוב או שאל ב-AI Coach.';
        setTimeout(() => dismissAIRecommendation(), 3500);
    }
}

function _renderAIRecommendation(rec) {
    _pendingAIRecommendation = rec;
    const result = document.getElementById('set-rec-result');
    if (!result) return;
    const reasonText = (rec.reason || '').replace(/[<>]/g, '');
    result.className = 'set-rec-result';
    result.innerHTML = `
        <div class="set-rec-header">
            <span class="material-symbols-outlined" style="font-size:0.95rem;">auto_awesome</span>
            המלצת המאמן
        </div>
        <div class="set-rec-vals">
            <span><span class="set-rec-num">${rec.w}</span><span class="set-rec-unit">kg</span></span>
            <span><span class="set-rec-num">×${rec.r}</span></span>
            <span><span class="set-rec-num">${rec.rir ?? '—'}</span><span class="set-rec-unit">RIR</span></span>
        </div>
        ${reasonText ? `<div class="set-rec-reason">${reasonText}</div>` : ''}
        <div class="set-rec-actions">
            <button class="set-rec-apply" onclick="applyAIRecommendation()">אשר</button>
            <button class="set-rec-dismiss" onclick="dismissAIRecommendation()">בטל</button>
        </div>
    `;
    haptic('success');
}

function applyAIRecommendation() {
    const rec = _pendingAIRecommendation;
    if (!rec) return;
    const wPicker = document.getElementById('weight-picker');
    const rPicker = document.getElementById('reps-picker');
    const rirPicker = document.getElementById('rir-picker');

    if (wPicker)   _setPickerValue(wPicker, rec.w);
    if (rPicker)   _setPickerValue(rPicker, rec.r);
    if (rirPicker && rec.rir !== undefined) _setPickerValue(rirPicker, rec.rir);

    syncStepperDisplay('weight');
    syncStepperDisplay('reps');
    syncStepperDisplay('rir');

    dismissAIRecommendation();
    haptic('success');
}

// בוחר את ה-option הקרוב ביותר אם הערך המדויק לא קיים — מונע סטים שלא נשמרים
function _setPickerValue(select, val) {
    if (!select || val === undefined || val === null) return;
    const target = parseFloat(val);
    let bestIdx = -1, bestDiff = Infinity;
    for (let i = 0; i < select.options.length; i++) {
        const optVal = parseFloat(select.options[i].value);
        if (isNaN(optVal)) continue;
        const diff = Math.abs(optVal - target);
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    }
    if (bestIdx >= 0) select.selectedIndex = bestIdx;
}

function dismissAIRecommendation() {
    _pendingAIRecommendation = null;
    _closeSetRecSheet();
    const trigger = document.getElementById('set-rec-trigger');
    if (trigger) trigger.removeAttribute('disabled');
    haptic('light');
}

// ─── STEPPER HELPERS ───────────────────────────────────────────────────────

function syncStepperDisplay(field) {
    const selId  = { weight: 'weight-picker', reps: 'reps-picker', rir: 'rir-picker' };
    const dispId = { weight: 'weight-display', reps: 'reps-display', rir: 'rir-display' };
    const sel  = document.getElementById(selId[field]);
    const disp = document.getElementById(dispId[field]);
    if (!sel || !disp) return;
    const raw = sel.options[sel.selectedIndex]?.text || sel.value;
    disp.textContent = raw.replace(' kg', '');
}

function stepPicker(field, dir) {
    const selId = { weight: 'weight-picker', reps: 'reps-picker', rir: 'rir-picker' };
    const sel = document.getElementById(selId[field]);
    if (!sel) return;
    sel.selectedIndex = Math.max(0, Math.min(sel.options.length - 1, sel.selectedIndex + dir));
    syncStepperDisplay(field);
    haptic('light');
}

// ─── CUSTOM VALUE INPUT ────────────────────────────────────────────────────
// לחיצה על המספר פותחת שדה הקלדה — מאפשר ערך חופשי שלא בהכרח תואם לאינקרמנט
// של ה-picker (למשל 47.5 ק"ג או 13 חזרות). הערך מוזרק כ-option ל-select.

// _insertSortedOption — מזריק option ממוין לפי ערך מספרי. אם כבר קיים — רק בוחר.
function _insertSortedOption(select, val, text) {
    for (let i = 0; i < select.options.length; i++) {
        if (parseFloat(select.options[i].value) === val) { select.selectedIndex = i; return; }
    }
    const o = new Option(text, val);
    let inserted = false;
    for (let i = 0; i < select.options.length; i++) {
        if (parseFloat(select.options[i].value) > val) { select.add(o, select.options[i]); inserted = true; break; }
    }
    if (!inserted) select.add(o);
    o.selected = true;
}

// commitCustomValue — מאמת ומחיל ערך חופשי לפי שדה.
function commitCustomValue(field, raw) {
    let num = parseFloat(raw);
    if (isNaN(num)) return false;
    const selId = { weight: 'weight-picker', reps: 'reps-picker', rir: 'rir-picker' };
    const sel = document.getElementById(selId[field]);
    if (!sel) return false;
    if (field === 'weight') {
        if (num < 0) num = 0;
        num = parseFloat(num.toFixed(2));
        if (_effWeightMode() === 'plates') {
            num = Math.max(1, Math.round(num));
            _insertSortedOption(sel, num, String(num));
        } else {
            _insertSortedOption(sel, num, num + ' kg');
        }
    } else if (field === 'reps') {
        num = Math.max(1, Math.round(num));
        _insertSortedOption(sel, num, String(num));
    } else { // rir
        if (num < 0) num = 0;
        _insertSortedOption(sel, num, num === 0 ? 'Fail' : String(num));
    }
    syncStepperDisplay(field);
    haptic('light');
    return true;
}

function editPickerValue(field) {
    if (field === 'weight' && _effWeightMode() === 'bw') return; // משקל גוף — אין ערך לערוך
    const dispId = { weight: 'weight-display', reps: 'reps-display', rir: 'rir-display' };
    const disp = document.getElementById(dispId[field]);
    if (!disp || disp.querySelector('input')) return;

    const current = disp.textContent.trim();
    const startVal = current === 'Fail' ? '0' : current.replace(/[^\d.]/g, '');

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.className = 'stepper-edit-input';
    input.value = startVal;
    if (field === 'reps') { input.step = '1'; input.min = '1'; }
    else { input.step = '0.5'; input.min = '0'; }

    disp.textContent = '';
    disp.appendChild(input);
    input.focus();
    input.select();

    const finish = (commit) => {
        if (input._done) return;
        input._done = true;
        if (commit && input.value !== '') commitCustomValue(field, input.value);
        else syncStepperDisplay(field); // ביטול — שחזור התצוגה הקודמת
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
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
        // r=46 → circumference 289 (זהה לטיימר ה-Live)
        if (clusterBar) clusterBar.style.strokeDashoffset = 289 - (progress * 289);
        // Sprint 4: עדכון Live View אם פעיל
        if (typeof updateLiveTimer === 'function') updateLiveTimer(mins, secs, progress);
    };

    // איפוס מיידי של ה-UI ל-00:00 — מונע ניצנוץ של ערך ישן בעשירית השנייה הראשונה
    // (ה-tick הראשון של ה-interval רץ רק אחרי 100ms, ועד אז התצוגה הייתה משוחזרת מהקודם)
    updateUI('00', '00', 0);

    state.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
        state.seconds = elapsed;
        const mins = Math.floor(state.seconds / 60).toString().padStart(2, '0');
        const secs = (state.seconds % 60).toString().padStart(2, '0');
        const progress = Math.min(state.seconds / target, 1);
        updateUI(mins, secs, progress);
        if (state.seconds === target && soundEnabled) playBeep(2);
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
    const wMode = _effWeightMode();

    const entry = {
        exName: state.currentExName,
        w: wVal,
        r: parseInt(document.getElementById('reps-picker').value),
        rir: document.getElementById('rir-picker').value,
        note: noteVal,
        isCluster: state.clusterMode,
        round: state.clusterMode ? state.clusterRound : null
    };
    if (wMode !== 'kg') entry.wm = wMode; // סימון שיטת המשקל — נשמר גם בארכיון

    // שמירת "משקל אחרון" רק כשהשיטה תואמת את ברירת המחדל של התרגיל —
    // override זמני (פלטות/BW על תרגיל ק"ג) לא מזהם את ה-prefill של אימונים הבאים
    const defaultMode = state.currentEx.weightMode || (state.currentEx.isBW ? 'bw' : 'kg');
    if (wMode === defaultMode && wMode !== 'bw') StorageManager.saveWeight(state.currentExName, wVal);
    state.log.push(entry); state.lastLoggedSet = entry;
    StorageManager.saveSessionState();

    if (state.clusterMode) {
        state.lastClusterRest = state.currentEx.restTime || 30;
        if (state.clusterIdx < state.activeCluster.exercises.length - 1) {
            state.clusterIdx++;
            const nextExItem = state.activeCluster.exercises[state.clusterIdx];
            const exData = state.exercises.find(e => e.name === nextExItem.name);
            if (!exData) {
                showAlert(`התרגיל "${nextExItem.name}" לא נמצא. סוגר את הסופרסט.`);
                finishCluster();
                return;
            }

            state.currentEx = deepClone(exData);
            state.currentExName = exData.name;

            if (nextExItem.restTime) state.currentEx.restTime = nextExItem.restTime;
            if (nextExItem.targetWeight !== undefined) state.currentEx.targetWeight = nextExItem.targetWeight;
            if (nextExItem.targetReps !== undefined) state.currentEx.targetReps = nextExItem.targetReps;
            if (nextExItem.targetRIR !== undefined) state.currentEx.targetRIR = nextExItem.targetRIR;

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
    const btnSkip = document.getElementById('btn-cluster-skip-text');
    const btnExtra = document.getElementById('btn-extra-round');
    const head = document.getElementById('cluster-next-head');
    const isResting = state.clusterRound < state.activeCluster.rounds;

    if (isResting) {
        // מנוחה בין סבבים — התחלת הסבב הבא בלחיצה על התרגיל הראשון (בוטל כפתור נפרד שגלש מהמסך)
        document.getElementById('cluster-status-text').innerText = `סיום סבב ${state.clusterRound} מתוך ${state.activeCluster.rounds}`;
        btnExtra.style.display = 'none';
        btnSkip.style.display = 'block';
        btnSkip.innerText = 'סיים סבב זה והמשך';
        if (head) head.innerText = 'לחץ על התרגיל הראשון כדי להתחיל';
    } else {
        // כל הסבבים הושלמו
        document.getElementById('cluster-status-text').innerText = `הסבבים הושלמו (${state.activeCluster.rounds})`;
        document.getElementById('cluster-timer-text').innerText = "✓";
        btnExtra.style.display = 'block';
        btnSkip.style.display = 'block';
        btnSkip.innerText = 'סיום';
        if (head) head.innerText = 'הסבב כלל';
    }
    btnSkip.onclick = finishCluster;

    const listDiv = document.getElementById('cluster-next-list');
    const exs = state.activeCluster.exercises;
    listDiv.classList.toggle('cluster-intro-list--scroll', exs.length >= 4);
    listDiv.innerHTML = exs.map((e, i) => {
        const isStart = isResting && i === 0; // התרגיל הראשון = טריגר התחלת הסבב
        const cls = 'cluster-intro-row' + (isStart ? ' cluster-intro-row--start' : '');
        const attrs = isStart ? ' onclick="startNextRound()" role="button" tabindex="0"' : '';
        const go = isStart ? '<span class="material-symbols-outlined cluster-intro-go">play_arrow</span>' : '';
        return `<div class="${cls}"${attrs}><span class="cluster-intro-tag">${i + 1}</span><span class="cluster-intro-name">${escapeHtml(e.name)}</span>${go}</div>`;
    }).join('');
}

function startNextRound() {
    state.clusterRound++; state.clusterIdx = 0; stopRestTimer();

    const nextExItem = state.activeCluster.exercises[0];
    const exData = state.exercises.find(e => e.name === nextExItem.name);
    if (!exData) {
        showAlert(`התרגיל "${nextExItem.name}" לא נמצא. סוגר את הסופרסט.`);
        finishCluster();
        return;
    }

    state.currentEx = deepClone(exData);
    state.currentExName = exData.name;

    if (nextExItem.restTime) state.currentEx.restTime = nextExItem.restTime;
    if (nextExItem.targetWeight !== undefined) state.currentEx.targetWeight = nextExItem.targetWeight;
    if (nextExItem.targetReps !== undefined) state.currentEx.targetReps = nextExItem.targetReps;
    if (nextExItem.targetRIR !== undefined) state.currentEx.targetRIR = nextExItem.targetRIR;

    state.currentEx.sets = [{ w: 10, r: 10 }];
    startRecording();
}

function addExtraRound() { state.activeCluster.rounds++; renderClusterRestUI(); StorageManager.saveSessionState(); }

function finishCluster() {
    state.clusterMode = false; state.activeCluster = null;
    document.getElementById('ui-main').classList.remove('cluster');
    if (state.isExtraPhase) {
        finish();
        return;
    }
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
                if (!exData) {
                    showAlert(`התרגיל "${nextExItem.name}" לא נמצא. סוגר את הסופרסט.`);
                    finishCluster();
                    return;
                }

                state.currentEx = deepClone(exData);
                state.currentExName = exData.name;

                if (nextExItem.restTime) state.currentEx.restTime = nextExItem.restTime;
                if (nextExItem.targetWeight !== undefined) state.currentEx.targetWeight = nextExItem.targetWeight;
                if (nextExItem.targetReps !== undefined) state.currentEx.targetReps = nextExItem.targetReps;
                if (nextExItem.targetRIR !== undefined) state.currentEx.targetRIR = nextExItem.targetRIR;

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

// ─── EXTRA CLUSTER ─────────────────────────────────────────────────────────

function startExtraCluster() {
    navigate('ui-extra-cluster');
    renderExtraClusterList();
    StorageManager.saveSessionState();
}

function renderExtraClusterList() {
    const container = document.getElementById('extra-cluster-list');
    if (!container) return;
    container.innerHTML = '';

    let found = false;
    Object.keys(state.workouts).forEach(workoutName => {
        const plan = state.workouts[workoutName];
        if (!Array.isArray(plan)) return;

        plan.forEach((item, idx) => {
            if (item.type !== 'cluster') return;
            if (!item.exercises || item.exercises.length === 0) return;
            found = true;

            const meta = state.workoutMeta[workoutName];
            const color = (meta && meta.color) ? meta.color : 'var(--type-free)';

            const card = document.createElement('button');
            card.className = 'menu-card tall';
            const exNames = item.exercises.map(e => e.name).join(' · ');
            card.innerHTML = `
                <div class="flex-between w-100 mb-xs">
                    <h3 style="color:${color}">${escapeHtml(workoutName)}</h3>
                    <span class="text-xs color-dim">${item.rounds} סבבים · ${item.exercises.length} תרגילים</span>
                </div>
                <p style="margin:0;font-size:0.82em;color:var(--text-dim);">${escapeHtml(exNames)}</p>`;
            card.onclick = () => selectExtraCluster(workoutName, idx);
            container.appendChild(card);
        });
    });

    if (!found) {
        container.innerHTML = '<p class="text-center color-dim mt-lg">אין סבבים מוגדרים בתוכניות</p>';
    }
}

function selectExtraCluster(workoutName, clusterIdx) {
    const plan = state.workouts[workoutName];
    if (!plan) return;
    const item = plan[clusterIdx];
    if (!item || item.type !== 'cluster') return;

    state.isExtraPhase = true;
    state.clusterMode  = true;
    state.activeCluster = deepClone(item);
    state.clusterIdx   = 0;
    state.clusterRound = 1;
    state.lastClusterRest = item.clusterRest || 120;

    showConfirmScreen();
    StorageManager.saveSessionState();
}

// ─── FREESTYLE ─────────────────────────────────────────────────────────────

function startFreestyle() {
    state.type = 'Freestyle'; state.log = []; state.completedExInSession = [];
    state.isFreestyle = true; state.isExtraPhase = false; state.isInterruption = false;
    state.workoutStartTime = Date.now();
    state.sessionElapsedSecs = 0;

    state.freestyleFilter = 'all';
    document.getElementById('freestyle-search').value = '';

    if (typeof updateVariationUI === 'function') updateVariationUI();
    navigate('ui-variation');

    if (typeof renderFreestyleChips === 'function') renderFreestyleChips();
    if (typeof renderFreestyleList === 'function') renderFreestyleList();

    startSessionTimer();
    StorageManager.saveSessionState();
}

function updateVariationUI() {
    const resumeBtn = document.getElementById('btn-var-resume');
    const finishExtraBtn = document.getElementById('btn-var-finish-extra');
    const contextContainer = document.getElementById('variation-context-container');
    const title = document.getElementById('variation-title');
    const freestyleFinish = document.getElementById('freestyle-finish-float');

    resumeBtn.style.display = 'none';
    finishExtraBtn.style.display = 'none';
    contextContainer.style.display = 'none';
    if (freestyleFinish) freestyleFinish.style.display = 'none';

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
        // כפתור סיום אימון floating — מוצג רק אם כבר בוצע לפחות תרגיל אחד
        if (freestyleFinish && state.isFreestyle && state.completedExInSession.length > 0) {
            freestyleFinish.style.display = 'block';
        }
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
        const card = document.createElement('div');
        card.className = "ex-card";
        card.innerHTML = buildExCardInner(ex.name, ex.muscles);
        card.onclick = () => {
            state.currentEx = deepClone(ex);
            state.currentExName = ex.name;
            if (!state.currentEx.sets || state.currentEx.sets.length < 3) state.currentEx.sets = [{ w: 10, r: 10 }, { w: 10, r: 10 }, { w: 10, r: 10 }];
            startRecording();
        };
        options.appendChild(card);
    });
}

// ─── SWAP MENU ─────────────────────────────────────────────────────────────

function openSwapMenu() {
    _renderSwapMenu('');
    navigate('ui-swap-list');
    StorageManager.saveSessionState();
}

function _renderSwapMenu(searchVal) {
    const container = document.getElementById('swap-container');
    container.innerHTML = "";

    const workoutList = state.workouts[state.type];
    /** חיפוש תרגיל מ-state לפי שם — לקבלת muscles */
    const findEx = (name) => state.exercises.find(e => e.name === name);

    // ── מומלצים: וריאציות מהקבוצות הקיימות ──
    const variations = getSubstitutes(state.currentExName)
        .filter(name => !state.completedExInSession.includes(name))
        .sort((a, b) => a.localeCompare(b));
    if (variations.length > 0) {
        const titleVar = document.createElement('div');
        titleVar.className = "ex-section-label";
        titleVar.innerText = "מחליפים מומלצים";
        container.appendChild(titleVar);
        variations.forEach(vName => {
            const exData = findEx(vName);
            const card = document.createElement('div');
            card.className = "ex-card";
            card.innerHTML = buildExCardInner(vName, exData ? exData.muscles : []);
            card.onclick = () => {
                state.currentExName = vName;
                state.historyStack.pop();
                showConfirmScreen(vName);
            };
            container.appendChild(card);
        });
    }

    // ── החלפת סדר ──
    if (workoutList) {
        const remaining = workoutList.map((item, idx) => ({ item, idx })).filter(({ idx }) => idx > state.exIdx);
        if (remaining.length > 0) {
            const titleOrder = document.createElement('div');
            titleOrder.className = "ex-section-label";
            titleOrder.innerText = "החלף סדר עם תרגיל אחר";
            container.appendChild(titleOrder);
            remaining.forEach(({ item, idx }) => {
                const exData = findEx(item.name);
                const card = document.createElement('div');
                card.className = "ex-card";
                card.innerHTML = buildExCardInner(item.name, exData ? exData.muscles : []);
                card.onclick = () => {
                    const currentItem = state.workouts[state.type][state.exIdx];
                    state.workouts[state.type][state.exIdx] = state.workouts[state.type][idx];
                    state.workouts[state.type][idx] = currentItem;
                    state.historyStack.pop();
                    showConfirmScreen();
                };
                container.appendChild(card);
            });
        }
    }

    // ── כל התרגילים (חיפוש חופשי) ──
    const titleAll = document.createElement('div');
    titleAll.className = "ex-section-label";
    titleAll.innerText = "כל התרגילים";
    container.appendChild(titleAll);

    const sv = (searchVal || '').toLowerCase();
    const allFiltered = state.exercises
        .filter(ex => ex.name !== state.currentExName && !state.completedExInSession.includes(ex.name))
        .filter(ex => !sv || ex.name.toLowerCase().includes(sv))
        .sort((a, b) => a.name.localeCompare(b.name));

    allFiltered.forEach(ex => {
        const card = document.createElement('div');
        card.className = "ex-card";
        card.innerHTML = buildExCardInner(ex.name, ex.muscles);
        card.onclick = () => {
            state.currentExName = ex.name;
            state.currentEx = deepClone(ex);
            if (!state.currentEx.sets || state.currentEx.sets.length === 0) {
                state.currentEx.sets = [{ w: 20, r: 10 }, { w: 20, r: 10 }, { w: 20, r: 10 }];
            }
            state.historyStack.pop();
            showConfirmScreen(ex.name);
        };
        container.appendChild(card);
    });

    if (allFiltered.length === 0 && sv) {
        const p = document.createElement('p');
        p.className = "text-center color-dim";
        p.innerText = "לא נמצאו תרגילים";
        container.appendChild(p);
    }
}

// ─── COACH SUMMARY STATE ───────────────────────────────────────────────────
let _coachSummaryText = null;       // טקסט הסיכום שנוצר ע"י המאמן לאימון הנוכחי
let _coachSummaryPromise = null;    // ה-Promise של היצירה (כדי ש"שמור וסגור" יוכל להמתין)

// ─── WEEK-END MARKER (תפריט שלוש-נקודות) ───────────────────────────────────
// סימון "סיום שבוע" נקבע במהלך האימון. ברירת מחדל: לחוץ ביום שבת (getDay()===6).
// מפעיל סיכום שבועי/בלוק במסך הסיכום.

function isWeekEndMarked() {
    if (typeof state.weekEndFlag === 'boolean') return state.weekEndFlag;
    return new Date().getDay() === 6; // שבת
}

function _syncWeekEndMenuItem() {
    const item = document.getElementById('wq-weekend-item');
    const lbl  = document.getElementById('wq-weekend-state');
    if (!item || !lbl) return;
    const on = isWeekEndMarked();
    item.classList.toggle('active', on);
    lbl.textContent = on ? 'פעיל' : 'כבוי';
}

function toggleWeekEnd() {
    state.weekEndFlag = !isWeekEndMarked();
    _syncWeekEndMenuItem();
    StorageManager.saveSessionState();
    haptic('light');
}

// ─── FINISH WORKOUT & SUMMARY ──────────────────────────────────────────────

function finish() {
    stopRestTimer();
    state.workoutDurationMins = state.sessionElapsedSecs ? Math.round(state.sessionElapsedSecs / 60) : 0;

    // שמירה מיידית לארכיון — מונע אובדן מידע אם המשתמש לא ילחץ "שמור וסגור".
    // upsert לפי state.archivedTimestamp; כאן מתחיל אימון חדש אז מאפסים.
    _coachSummaryText = null;
    _coachSummaryPromise = null;
    // R5: timestamp הארכיון = sessionId של הגשר (upsert יחיד, אנטי-collision) אם קיים
    state.archivedTimestamp = state.liveSessionId || null;
    _saveToArchive('');
    if (typeof FirebaseManager !== 'undefined' && FirebaseManager.isConfigured()) {
        FirebaseManager.saveArchiveToCloud()
            .then(ok => notifyCloudSaveFailure(ok, 'archive', 'גיבוי ארכיון'))
            .catch(() => {});
    }

    const summaryNote = document.getElementById('summary-note');
    if (summaryNote) summaryNote.value = '';

    navigate('ui-summary');
    buildSummaryUI();
    StorageManager.saveSessionState();
}

function buildSummaryUI() {
    const area = document.getElementById('summary-content-area');
    if (!area) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

    const realSets = state.log.filter(l => !l.skip);
    const setsCount = realSets.length;

    // בניית סגמנטים בסדר הביצוע (normal per-exercise, cluster per-block)
    const segments = [];
    realSets.forEach(entry => {
        const last = segments[segments.length - 1];
        if (!entry.isCluster) {
            if (last && last.type === 'normal' && last.exName === entry.exName) {
                last.sets.push(entry);
            } else {
                segments.push({ type: 'normal', exName: entry.exName, sets: [entry] });
            }
        } else {
            if (last && last.type === 'cluster') {
                last.sets.push(entry);
            } else {
                segments.push({ type: 'cluster', sets: [entry] });
            }
        }
    });

    let totalVol = 0;
    let cardsHtml = '';

    const mainExNames = new Set();
    if (state.workouts && state.workouts[state.type]) {
        state.workouts[state.type].forEach(item => { if (item.isMain && item.type !== 'cluster') mainExNames.add(item.name); });
    }

    segments.forEach(seg => {
        if (seg.type === 'normal') {
            let exVol = 0, setRows = '';
            seg.sets.forEach((s, i) => {
                exVol += _setVol(s);
                const realIdx = realSets.indexOf(s);
                const noteStr = s.note ? ` | ${s.note}` : '';
                const rirStr = s.rir !== undefined ? s.rir : '—';
                setRows += `
                <div class="set-row">
                    <div class="set-num">${(i + 1).toString().padStart(2, '0')}</div>
                    <div class="set-details">${_fmtW(s)} × ${s.r} <span style="opacity:0.5;font-size:0.85em">(RIR ${rirStr}${noteStr})</span></div>
                    <button class="set-edit-btn" onclick="openSummaryEditSetModal(${realIdx})">ערוך</button>
                </div>`;
            });
            totalVol += exVol;
            const volStr = exVol >= 1000 ? (exVol / 1000).toFixed(1) + 't' : exVol + 'kg';
            const exTM = mainExNames.has(seg.exName) ? _displayTM(seg.exName) : null;
            const tmBadgeHtml = exTM != null ? `<span class="card-tm-badge">TM ${exTM}kg</span>` : '';

            cardsHtml += `
            <div class="obsidian-card">
                <div class="card-header">
                    <h3 class="card-title">${escapeHtml(seg.exName)}${tmBadgeHtml}</h3>
                    <span class="card-vol">${volStr}</span>
                </div>
                ${setRows}
            </div>`;
        } else {
            // Cluster — קבץ לפי סבב
            const byRound = {};
            seg.sets.forEach(s => {
                if (!byRound[s.round]) byRound[s.round] = [];
                byRound[s.round].push(s);
            });
            let clusterVol = 0, roundRows = '';
            Object.keys(byRound).sort((a, b) => +a - +b).forEach(roundNum => {
                const roundSets = byRound[roundNum];
                clusterVol += roundSets.reduce((sum, s) => sum + _setVol(s), 0);
                
                roundRows += `<div class="summary-cluster-title">סבב ${roundNum}</div>`;
                
                roundSets.forEach((s, i) => {
                    const realIdx = realSets.indexOf(s);
                    const noteStr = s.note ? ` | ${s.note}` : '';
                    const rirStr = s.rir !== undefined ? s.rir : '—';
                    roundRows += `
                    <div class="set-row">
                        <div class="set-num">${(i + 1).toString().padStart(2, '0')}</div>
                        <div class="set-details">
                            <span style="color:var(--text-dim);font-size:0.85em;margin-left:6px;">${s.exName}</span><br>
                            ${_fmtW(s)} × ${s.r} <span style="opacity:0.5;font-size:0.85em">(RIR ${rirStr}${noteStr})</span>
                        </div>
                        <button class="set-edit-btn" onclick="openSummaryEditSetModal(${realIdx})">ערוך</button>
                    </div>`;
                });
            });
            totalVol += clusterVol;
            const clusterVolStr = clusterVol >= 1000 ? (clusterVol / 1000).toFixed(1) + 't' : clusterVol + 'kg';
            const exNames = [...new Set(seg.sets.map(s => s.exName))].join(' + ');
            
            cardsHtml += `
            <div class="obsidian-card">
                <div class="card-header">
                    <h3 class="card-title">סבב: ${escapeHtml(exNames)}</h3>
                    <span class="card-vol">${clusterVolStr}</span>
                </div>
                ${roundRows}
            </div>`;
        }
    });

    const totalVolStr = totalVol >= 1000 ? (totalVol / 1000).toFixed(1) + 't' : totalVol + 'kg';

    const hasAIKey = !!StorageManager.getAIConfig().apiKey;
    const coachCardHtml = hasAIKey ? `
        <div id="coach-summary-card" class="coach-summary-card">
            <div class="coach-card-header">
                <span class="coach-card-title"><span class="material-symbols-outlined">neurology</span> סיכום המאמן</span>
                <span id="coach-scope-badge" class="coach-scope-badge"></span>
            </div>
            <div id="coach-card-body" class="coach-card-body"></div>
            <div id="coach-refine" class="coach-refine" hidden>
                <button class="coach-refine-toggle" onclick="toggleCoachRefine()">
                    <span class="material-symbols-outlined">edit</span> דייק את הסיכום
                </button>
                <div id="coach-refine-row" class="coach-refine-row" hidden>
                    <input type="text" id="coach-refine-input" class="coach-refine-input"
                        placeholder="מה לתקן? (למשל: פספסת שהעליתי משקל בסקוואט)…"
                        onkeydown="if(event.key==='Enter')sendCoachRefine()">
                    <button class="coach-refine-send" onclick="sendCoachRefine()">
                        <span class="material-symbols-outlined">arrow_upward</span>
                    </button>
                </div>
            </div>
        </div>` : '';
    const copyToggleHtml = hasAIKey ? `
        <label class="coach-copy-toggle">
            <input type="checkbox" id="copy-include-coach" ${StorageManager.getCopyIncludeCoach() ? 'checked' : ''} onchange="StorageManager.setCopyIncludeCoach(this.checked)">
            <span>כלול סיכום מאמן בהעתקה</span>
        </label>` : '';

    const html = `
        <div class="summary-header">
            <div class="summary-subtitle">${dateStr} • ${timeStr}</div>
            <div class="summary-subtitle" style="color:var(--text-dim);margin-top:2px;text-transform:none;">${state.type}</div>
            <h1 class="summary-title">סיימנו<br>להיום.</h1>
        </div>

        <div class="summary-stats-glass">
            <div class="stat-col">
                <div class="stat-val">${state.workoutDurationMins}<span style="font-size:0.9rem;opacity:0.6;">m</span></div>
                <div class="stat-lbl">זמן אימון</div>
            </div>
            <div class="stat-col">
                <div class="stat-val" style="color:var(--accent);">${totalVolStr}</div>
                <div class="stat-lbl">נפח כולל</div>
            </div>
            <div class="stat-col">
                <div class="stat-val">${setsCount}</div>
                <div class="stat-lbl">סטים בוצעו</div>
            </div>
        </div>

        ${coachCardHtml}

        <input type="text" id="summary-note" class="summary-note-input" placeholder="איך היה האימון? (הערה כללית לארכיון)...">

        ${cardsHtml}

        ${copyToggleHtml}
        <button id="summary-save-btn" class="btn-main primary-gradient pulse" onclick="copyResult()" style="margin-top:10px;box-shadow: 0 15px 40px rgba(62,144,255,0.25), inset 0 1px 0 rgba(255,255,255,0.2);">שמור וסגור</button>
    `;

    area.innerHTML = html;

    // יצירת סיכום המאמן אוטומטית (אם יש API key) — לא חוסם את המסך
    if (hasAIKey) generateCoachSummary();
}

async function copyResult() {
    const note = (document.getElementById('summary-note') ? document.getElementById('summary-note').value.trim() : '');
    const includeCoach = StorageManager.getCopyIncludeCoach();

    // אם רוצים סיכום מאמן בהעתקה והוא עדיין נטען — ממתינים לו (עד 8 שניות)
    if (includeCoach && _coachSummaryPromise && !_coachSummaryText) {
        const btn = document.getElementById('summary-save-btn');
        const origLabel = btn ? btn.textContent : '';
        if (btn) { btn.textContent = 'ממתין לסיכום…'; btn.disabled = true; }
        try {
            await Promise.race([
                _coachSummaryPromise.catch(() => {}),
                new Promise(res => setTimeout(res, 8000))
            ]);
        } catch (e) {}
        if (btn) { btn.textContent = origLabel; btn.disabled = false; }
    }

    _saveToArchive(note);

    // גיבוי אוטומטי לענן אחרי שמירת אימון
    if (typeof FirebaseManager !== 'undefined' && FirebaseManager.isConfigured()) {
        FirebaseManager.saveArchiveToCloud().then(ok => {
            showCloudToast(ok ? '☁️ ארכיון נשמר בענן' : '⚠️ שגיאה בשמירת ארכיון לענן', ok);
        });
    }

    const entry = StorageManager.getArchive().find(a => a.timestamp === state.archivedTimestamp)
               || StorageManager.getArchive()[0];
    if (entry) {
        let clipboardText = entry.summary || '';
        if (includeCoach && entry.aiSummary) {
            clipboardText += `\n\n=== סיכום המאמן ===\n${entry.aiSummary}`;
        }
        if (navigator.clipboard) {
            navigator.clipboard.writeText(clipboardText).catch(() => {});
        } else {
            try {
                const el = document.createElement('textarea');
                el.value = clipboardText;
                document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
            } catch (e) {}
        }
    }

    // R4: נקה את live_session לפני הניקוי/reload — מונע סשן-רפאים שהשעון יחיה
    try { await WatchBridge.finishSession(); } catch (e) {}
    state.liveSessionId = null;
    StorageManager.clearSessionState();
    state.workoutStartTime = null; // מניעת שחזור רפאים בעת ריענון העמוד
    stopSessionTimer();
    haptic('success');
    showAlert("האימון נשמר! הסיכום הועתק ללוח.", () => { window.location.reload(); });
}

function _saveToArchive(note) {
    const now = new Date();
    const dateStr = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
    const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    const archiveDateStr = now.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });

    const exOrder = [];
    const exMap = {};
    state.log.forEach(entry => {
        if (entry.skip) return;
        const key = entry.exName;
        if (!exMap[key]) { exMap[key] = { sets: [], skips: 0, isMain: false }; exOrder.push(key); }
        const rir = entry.rir !== undefined ? entry.rir : '—';
        const noteStr = entry.note ? ` | Note: ${entry.note}` : '';
        exMap[key].sets.push(`${_fmtW(entry)} x ${entry.r} (RIR ${rir})${noteStr}`);
    });

    // mark skipped
    state.log.forEach(entry => {
        if (!entry.skip) return;
        const key = entry.exName;
        if (!exMap[key]) { exMap[key] = { sets: [], skips: 0, isMain: false }; exOrder.push(key); }
        exMap[key].skips++;
    });

    if (state.workouts && state.workouts[state.type]) {
        state.workouts[state.type].forEach(item => {
            if (item.isMain && exMap[item.name]) exMap[item.name].isMain = true;
        });
    }

    const weekLabel = state.week === 'deload' ? 'Deload' :
                      state.isFreestyle       ? 'Freestyle' :
                                                `Week ${state.week}`;

    // ── details (by exercise name — used by analytics / volume calculations) ──
    const details = {};
    let totalVol = 0;
    exOrder.forEach(exName => {
        const data = exMap[exName];
        let exVol = 0;
        data.sets.forEach(setStr => {
            exVol += _setStrVol(setStr) * (isUnilateral(exName) ? 2 : 1);
        });
        totalVol += exVol;
        details[exName] = { sets: data.sets, vol: exVol };
    });

    // ── summaryLines — segment-based to preserve cluster round structure ──
    const summaryLines = [
        'GYMPRO ELITE SUMMARY',
        `${state.type} | ${weekLabel} | ${dateStr} | ${state.workoutDurationMins}m`,
        ''
    ];
    if (note) { summaryLines.push(`הערה: ${note}`); summaryLines.push(''); }

    const _segs = [];
    state.log.filter(l => !l.skip).forEach(entry => {
        const last = _segs[_segs.length - 1];
        if (!entry.isCluster) {
            if (last && last.type === 'normal' && last.exName === entry.exName) last.sets.push(entry);
            else _segs.push({ type: 'normal', exName: entry.exName, sets: [entry] });
        } else {
            if (last && last.type === 'cluster') last.sets.push(entry);
            else _segs.push({ type: 'cluster', sets: [entry] });
        }
    });

    _segs.forEach(seg => {
        if (seg.type === 'normal') {
            const exName = seg.exName;
            const exVol = details[exName] ? details[exName].vol : 0;
            const volStr = exVol >= 1000 ? (exVol / 1000).toFixed(1) + 't' : exVol + 'kg';
            const exTM = exMap[exName] && exMap[exName].isMain ? _displayTM(exName) : null;
            const mainTag = exMap[exName] && exMap[exName].isMain ? (exTM != null ? ` (Main, TM: ${exTM}kg)` : ' (Main)') : '';
            const uniTag = isUnilateral(exName) ? ' (צד אחד)' : '';
            summaryLines.push(`${exName}${mainTag}${uniTag} (Vol: ${volStr}):`);
            seg.sets.forEach(entry => {
                const rir = entry.rir !== undefined ? entry.rir : '—';
                const noteStr = entry.note ? ` | Note: ${entry.note}` : '';
                summaryLines.push(`${_fmtW(entry)} x ${entry.r} (RIR ${rir})${noteStr}`);
            });
            if (exMap[exName] && exMap[exName].skips > 0) summaryLines.push('(Skipped)');
            summaryLines.push('');
        } else {
            const byRound = {};
            seg.sets.forEach(entry => {
                const rn = entry.round || 1;
                if (!byRound[rn]) byRound[rn] = [];
                byRound[rn].push(entry);
            });
            Object.keys(byRound).map(Number).sort((a, b) => a - b).forEach(rn => {
                summaryLines.push(`Cluster סבב ${rn}:`);
                byRound[rn].forEach(entry => {
                    const rir = entry.rir !== undefined ? entry.rir : '—';
                    const noteStr = entry.note ? ` | Note: ${entry.note}` : '';
                    summaryLines.push(`  ${entry.exName}: ${_fmtW(entry)} x ${entry.r} (RIR ${rir})${noteStr}`);
                });
                summaryLines.push('');
            });
        }
    });

    // Skip-only exercises not covered by segments
    const _coveredNormal = new Set(_segs.filter(s => s.type === 'normal').map(s => s.exName));
    exOrder.forEach(exName => {
        if (!_coveredNormal.has(exName) && exMap[exName] && exMap[exName].skips > 0 && !exMap[exName].sets.length) {
            summaryLines.push(`${exName}: (Skipped)`);
            summaryLines.push('');
        }
    });

    // ── Minimal log stored for display (archive detail view) ──
    const archivedLog = state.log.map(l => ({
        exName: l.exName, w: l.w, r: l.r, rir: l.rir, wm: l.wm || undefined,
        note: l.note || '', isCluster: !!l.isCluster, round: l.round || null, skip: !!l.skip
    }));

    // upsert לפי timestamp — finish() יוצר את הרשומה מיד, ועדכונים נוספים (הערה, aiSummary,
    // עריכת סטים) ממזגים לאותה רשומה במקום ליצור כפילות.
    const ts = state.archivedTimestamp || Date.now();
    state.archivedTimestamp = ts;
    const aiSummary = (_coachSummaryText || _existingAiSummary(ts) || '').slice(0, 6000);

    // מצב תזונתי בעת האימון — נשמר פעם אחת (נתון קבוע); עריכות עתידיות לא דורסות אותו
    const _prevEntry = StorageManager.getArchive().find(a => a.timestamp === ts);
    const nutritionalState = (_prevEntry && _prevEntry.nutritionalState)
        || (StorageManager.getNutritionalState() || {}).state || null;

    const archiveEntry = {
        timestamp: ts,
        date: archiveDateStr,
        time: timeStr,
        type: state.type,
        week: state.week,
        duration: state.workoutDurationMins,
        summary: summaryLines.join('\n').trimEnd(),
        details,
        exOrder,
        log: archivedLog,
        note,
        rmValues: state.rmUsed || {},
        nutritionalState,
        aiSummary
    };

    let saved = StorageManager.updateArchiveEntry(ts, archiveEntry);
    if (!saved) saved = StorageManager.saveToArchive(archiveEntry);
    if (!saved) {
        // כשל כתיבה (אחסון מלא) — האימון לא נשמר בארכיון; חובה להתריע ולא להמשיך בשקט
        showAlert('שגיאה: האימון לא נשמר בארכיון! האחסון המקומי מלא — ייצא גיבוי ופנה מקום, ואז סיים שוב.');
        return;
    }
    haptic('success');
}

// _existingAiSummary — שולף aiSummary שכבר נשמר ברשומה (שחזור/חזרה למסך)
function _existingAiSummary(ts) {
    const entry = StorageManager.getArchive().find(a => a.timestamp === ts);
    return entry && entry.aiSummary ? entry.aiSummary : '';
}

// ─── COACH SUMMARY (סיכום מאמן אוטומטי) ─────────────────────────────────────

// _coachScope — קובע את היקף הסיכום לפי מתג "סיום שבוע" ומספר השבוע
function _coachScope() {
    const wk = state.week;
    if (isWeekEndMarked() && wk === 3) return 'block';
    if (isWeekEndMarked() && [1, 2, 3].includes(wk)) return 'week';
    return 'workout';
}

// _fillTemplate — החלפת placeholders ע"י split/join (בטוח מ-$ בטקסט ההחלפה)
function _fillTemplate(tpl, map) {
    let out = tpl;
    Object.keys(map).forEach(k => { out = out.split('{' + k + '}').join(map[k]); });
    return out;
}

function _buildCoachSummaryPrompt(scope) {
    const ts = state.archivedTimestamp;
    const archive = StorageManager.getArchive();
    const currentEntry = archive.find(a => a.timestamp === ts);
    const workoutText = (currentEntry && currentEntry.summary) || '';
    const nutrition = (typeof getNutritionalContext === 'function' && getNutritionalContext()) || 'לא הוגדר';
    const persona = (StorageManager.getAIPersona && StorageManager.getAIPersona()) || 'לא הוגדר';

    const ctx = (typeof buildBlockContext === 'function')
        ? buildBlockContext() : { current: [], previous: [], previous2: [] };

    const recentWorkouts = archive
        .filter(a => a.timestamp !== ts && a.type === state.type && a.summary)
        .slice(0, 3).map(a => a.summary).join('\n\n') || 'אין נתונים';

    const weekWorkouts = ctx.current
        .filter(a => a.week === state.week && a.summary)
        .map(a => a.summary).join('\n\n') || 'אין נתונים';

    const parallelWorkout = ctx.previous
        .filter(a => a.week === state.week && a.type === state.type && a.summary)
        .map(a => a.summary).join('\n\n') || 'אין נתונים מהבלוק הקודם';

    const blockWorkouts = ctx.current
        .filter(a => a.summary).map(a => a.summary).join('\n\n') || 'אין נתונים';

    const analytics = (typeof buildAnalyticsSnapshot === 'function' && buildAnalyticsSnapshot()) || 'אין נתונים';

    return _fillTemplate(StorageManager.getCoachPrompt(scope), {
        workoutText, nutrition, persona, recentWorkouts, weekWorkouts, parallelWorkout, blockWorkouts, analytics
    });
}

function generateCoachSummary() {
    const body  = document.getElementById('coach-card-body');
    const badge = document.getElementById('coach-scope-badge');
    if (!body) return;

    const scope = _coachScope();
    const scopeLabels = { workout: 'סיכום אימון', week: 'סיכום שבועי', block: 'סיכום בלוק' };
    if (badge) badge.textContent = scopeLabels[scope] || '';

    // אם כבר נוצר (שחזור/חזרה למסך) — הצג ואל תייצר מחדש (חיסכון בקריאת API)
    const existing = _coachSummaryText || _existingAiSummary(state.archivedTimestamp);
    if (existing) {
        _coachSummaryText = existing;
        body.className = 'coach-card-body';
        body.innerHTML = _renderMarkdown(existing);
        _revealCoachRefine();
        return;
    }

    body.className = 'coach-card-body loading';
    body.innerHTML = `<div class="coach-loading"><span class="coach-spinner"></span> המאמן מנתח את האימון…</div>`;

    const prompt = _buildCoachSummaryPrompt(scope);
    _coachSummaryPromise = _callGeminiOneShot(prompt, { freeText: true })
        .then(text => {
            const clean = (text || '').trim();
            if (!clean) throw new Error('EMPTY_RESPONSE');
            _coachSummaryText = clean;
            body.className = 'coach-card-body';
            body.innerHTML = _renderMarkdown(clean);
            _revealCoachRefine();
            if (state.archivedTimestamp) {
                StorageManager.updateArchiveEntry(state.archivedTimestamp, { aiSummary: clean.slice(0, 6000) });
                StorageManager.saveSessionState();
            }
            return clean;
        })
        .catch(err => {
            console.warn('GymPro: coach summary failed', err);
            body.className = 'coach-card-body error';
            body.innerHTML = `<div class="coach-error">⚠️ לא הצלחתי להפיק סיכום כרגע. <button class="coach-retry-btn" onclick="generateCoachSummary()">נסה שוב</button></div>`;
            // לא זורקים מחדש — ה-Promise נפתר (resolved) כדי ש-copyResult יוכל להמתין לו בבטחה
            return null;
        });
}

// ─── COACH SUMMARY REFINE — תיקון מתגלגל ───────────────────────────────────
// מאפשר למשתמש "לדייק" את סיכום המאמן בלי לצאת ממסך הסיכום. כל הערה מייצרת
// מחדש את הסיכום על בסיס הגרסה הנוכחית + נתוני האימון בפועל + ההערה.

function _revealCoachRefine() {
    const refine = document.getElementById('coach-refine');
    if (refine) refine.hidden = false;
}

function toggleCoachRefine() {
    const row = document.getElementById('coach-refine-row');
    if (!row) return;
    row.hidden = !row.hidden;
    if (!row.hidden) {
        const input = document.getElementById('coach-refine-input');
        if (input) input.focus();
    }
}

function sendCoachRefine() {
    const input = document.getElementById('coach-refine-input');
    if (!input) return;
    const note = input.value.trim();
    if (!note || !_coachSummaryText) return;
    input.value = '';
    const row = document.getElementById('coach-refine-row');
    if (row) row.hidden = true;
    refineCoachSummary(note);
}

function refineCoachSummary(note) {
    const body = document.getElementById('coach-card-body');
    if (!body) return;

    const prev = _coachSummaryText;
    const archive = StorageManager.getArchive();
    const entry = archive.find(a => a.timestamp === state.archivedTimestamp);
    const workoutText = (entry && entry.summary) || 'אין נתונים';

    const prompt = `אתה מאמן כוח. כתבת למתאמן את הסיכום הבא:
---
${prev}
---
נתוני האימון בפועל:
${workoutText}
המתאמן מעיר/מתקן: "${note}"
כתוב מחדש את הסיכום המלא בעברית בפורמט Markdown, באותו מבנה וכותרות, ותקן רק את מה שצריך לאור ההערה. החזר את הסיכום המתוקן בלבד, ללא הקדמות.`;

    body.className = 'coach-card-body loading';
    body.innerHTML = `<div class="coach-loading"><span class="coach-spinner"></span> המאמן מעדכן את הסיכום…</div>`;

    _coachSummaryPromise = _callGeminiOneShot(prompt, { freeText: true })
        .then(text => {
            const clean = (text || '').trim();
            if (!clean) throw new Error('EMPTY_RESPONSE');
            _coachSummaryText = clean;
            body.className = 'coach-card-body';
            body.innerHTML = _renderMarkdown(clean);
            if (state.archivedTimestamp) {
                StorageManager.updateArchiveEntry(state.archivedTimestamp, { aiSummary: clean.slice(0, 6000) });
                StorageManager.saveSessionState();
            }
            return clean;
        })
        .catch(err => {
            console.warn('GymPro: coach refine failed', err);
            // שחזור הסיכום הקודם — לא מאבדים את מה שכבר היה
            body.className = 'coach-card-body';
            body.innerHTML = _renderMarkdown(prev);
            if (typeof showCloudToast === 'function') showCloudToast('לא הצלחתי לתקן כרגע, נסה שוב', false);
            return prev;
        });
}

// ─── SESSION LOG MODAL ─────────────────────────────────────────────────────

function openSessionLog() {
    const modal = document.getElementById('session-log-modal');
    const list  = document.getElementById('session-log-list');
    list.innerHTML = '';

    const realSets = state.log.filter(l => !l.skip);

    if (realSets.length === 0) {
        list.innerHTML = emptyStateHtml('assignment', 'טרם נרשמו סטים', 'סטים שתרשום יופיעו כאן');
    } else {
        // קיבוץ לפי תרגיל — שמירה על סדר כניסה
        const exOrder = [];
        const exMap   = {};
        realSets.forEach((entry, i) => {
            if (!exMap[entry.exName]) { exMap[entry.exName] = []; exOrder.push(entry.exName); }
            exMap[entry.exName].push({ entry, realIdx: i });
        });

        exOrder.forEach(exName => {
            const sets = exMap[exName];

            // חישוב נפח כולל לתרגיל (×2 לצד אחד)
            const uniMult = isUnilateral(exName) ? 2 : 1;
            const vol = sets.reduce((sum, { entry }) => sum + (_setVol(entry) * uniMult), 0);
            const volStr = vol >= 1000 ? (vol / 1000).toFixed(1) + 't' : vol + 'kg';

            // כרטיס תרגיל
            const card = document.createElement('article');
            card.className = 'slog-ex-card';

            const exTM = _isMainExInCurrentWorkout(exName) ? _displayTM(exName) : null;
            const tmBadgeHtml = exTM != null ? `<span class="slog-tm-badge">TM ${exTM}kg</span>` : '';

            // כותרת כרטיס
            card.innerHTML = `
                <div class="slog-ex-header">
                    <div class="slog-ex-info">
                        <h3 class="slog-ex-name">${escapeHtml(exName)}${tmBadgeHtml}</h3>
                    </div>
                    <div class="slog-ex-vol-wrap">
                        <p class="slog-vol-lbl">VOLUME</p>
                        <p class="slog-vol-val">${volStr}</p>
                    </div>
                </div>
                <div class="slog-sets-list" id="slog-sets-${exOrder.indexOf(exName)}"></div>`;

            list.appendChild(card);

            const setsList = card.querySelector('.slog-sets-list');
            sets.forEach(({ entry, realIdx }, setNum) => {
                const row = document.createElement('div');
                const isLast = setNum === sets.length - 1;
                row.className = 'slog-set-row' + (isLast ? ' slog-set-row--last' : '');
                const rirStr = (entry.rir !== '' && entry.rir != null) ? `RIR ${entry.rir}` : '—';
                row.innerHTML = `
                    <span class="slog-set-num">${setNum + 1}</span>
                    <span class="slog-set-data">${_fmtW(entry)} <span class="slog-x">×</span> ${entry.r}</span>
                    <span class="slog-rir-badge">${rirStr}</span>
                    <span class="material-symbols-outlined slog-row-chevron">chevron_left</span>`;
                // כל השורה פותחת עריכה — לא רק כפתור ייעודי
                row.onclick = () => openEditSetModal(realIdx);
                setsList.appendChild(row);
            });
        });
    }

    modal.style.display = 'flex';
    // אנימציה: slide up
    requestAnimationFrame(() => {
        const sheet = modal.querySelector('.slog-sheet');
        if (sheet) sheet.classList.add('open');
    });
}

function handleSlogOverlayClick(e) {
    if (e.target === e.currentTarget) closeSessionLog();
}

function closeSessionLog() {
    const modal = document.getElementById('session-log-modal');
    const sheet = modal.querySelector('.slog-sheet');
    if (sheet) {
        sheet.classList.remove('open');
        setTimeout(() => { modal.style.display = 'none'; }, 280);
    } else {
        modal.style.display = 'none';
    }
}

// ─── HISTORY DRAWER ────────────────────────────────────────────────────────

// פירוק string סט בפורמט "Wkg x R (RIR X) | Note: text"
function _parseHistorySetStr(setStr) {
    let weight = '-', reps = '-', rir = '-', note = '';
    let coreStr = setStr;
    if (setStr.includes('| Note:')) {
        const parts = setStr.split('| Note:');
        coreStr = parts[0].trim();
        note = parts[1].trim();
    }
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
    return { weight, reps, rir, note };
}

// pager לתצוגת היסטוריית תרגיל — דפדוף בין עד 5 ביצועים אחרונים
function _renderHistoryPager(containerEl, performances, opts = {}) {
    if (!performances || !performances.length) {
        containerEl.innerHTML = `<p class="color-dim text-sm text-center">אין ביצוע קודם בארכיון</p>`;
        return;
    }

    let idx = 0; // 0 = החדש ביותר
    const render = () => {
        const perf = performances[idx];
        let rowsHtml = "";
        perf.sets.forEach((setStr, i) => {
            const { weight, reps, rir, note } = _parseHistorySetStr(setStr);
            const rirNum = parseFloat(rir);
            const rirClass = (rir !== '-' && rirNum <= 0) ? 'rir-val rir-orange' : 'rir-val rir-green';
            rowsHtml += `
                <div class="history-row">
                    <div class="history-col set-idx">${i + 1}</div>
                    <div class="history-col">${weight}</div>
                    <div class="history-col">${reps}</div>
                    <div class="history-col ${rirClass}">${rir}</div>
                </div>`;
            if (note && opts.showNotes !== false) {
                rowsHtml += `<div class="history-note-inline"><div><p>${note}</p></div></div>`;
            }
        });

        const hasOlder = idx < performances.length - 1;
        const hasNewer = idx > 0;
        const titleHtml = opts.title ? `<div class="history-separator"></div><div class="history-section-title">${opts.title}</div>` : '';

        containerEl.innerHTML = `
            <div class="history-card-container">
                <div class="history-nav">
                    <button class="history-nav-btn" data-act="older" ${!hasOlder ? 'disabled' : ''} aria-label="ביצוע ישן יותר">›</button>
                    <div class="history-nav-info">
                        <div class="nav-date">${perf.date || '—'}</div>
                        <div class="nav-counter">${idx + 1} / ${performances.length}</div>
                    </div>
                    <button class="history-nav-btn" data-act="newer" ${!hasNewer ? 'disabled' : ''} aria-label="ביצוע חדש יותר">‹</button>
                </div>
                ${titleHtml}
                <div class="history-header">
                    <div>סט</div><div>משקל</div><div>חזרות</div><div>RIR</div>
                </div>
                <div class="history-list">${rowsHtml}</div>
            </div>`;

        const olderBtn = containerEl.querySelector('[data-act="older"]');
        const newerBtn = containerEl.querySelector('[data-act="newer"]');
        if (olderBtn) olderBtn.onclick = () => { if (idx < performances.length - 1) { idx++; render(); haptic('light'); } };
        if (newerBtn) newerBtn.onclick = () => { if (idx > 0) { idx--; render(); haptic('light'); } };
    };
    render();
}

function openHistoryDrawer() {
    if (!state.currentExName) return;
    const performances = (typeof getLastPerformances === 'function') ? getLastPerformances(state.currentExName, 5) : [];
    const content = document.getElementById('sheet-content');
    const overlay = document.getElementById('sheet-overlay');
    const drawer  = document.getElementById('sheet-modal');

    const histExTM = _isMainExInCurrentWorkout(state.currentExName) ? _displayTM(state.currentExName) : null;
    const histTmBadgeHtml = histExTM != null ? `<span class="slog-tm-badge">TM ${histExTM}kg</span>` : '';
    content.innerHTML = `<h3 style="margin:0 0 10px;">${state.currentExName}${histTmBadgeHtml}</h3><div id="history-pager-host"></div>`;
    _renderHistoryPager(document.getElementById('history-pager-host'), performances);

    overlay.style.display = 'block';
    drawer.classList.add('open');
    haptic('light');
}

// ─── EDIT SET MODAL ────────────────────────────────────────────────────────

let _editSetRealIdx = -1;
let _editFromLog = false;
let _editFromSummary = false;

// מנוע סטפר עצמאי למודאל עריכת סט (יומן + ארכיון) — לא תלוי ב-state של האימון
// החי (selects/currentExName), כי המודאל יכול לערוך סט של תרגיל לא-פעיל או
// סט מארכיון בלי session פעיל בכלל. מצב המשקל נשמר/נקרא מ-entry.wm עצמו.
let _editModalMode = 'kg';
let _editModalVals = { weight: 0, reps: 1, rir: 0 };

function _editModalInit(w, r, rir, note, mode) {
    _editModalMode = mode || 'kg';
    _editModalVals.weight = parseFloat(w) || 0;
    _editModalVals.reps = parseInt(r) || 1;
    _editModalVals.rir = parseFloat(rir) || 0;
    document.getElementById('edit-note').value = note || '';
    _editModalRenderModeUI();
    _editModalRenderValue('weight');
    _editModalRenderValue('reps');
    _editModalRenderValue('rir');
}

function _editModalRenderModeUI() {
    const lbl = document.getElementById('edit-weight-mode-lbl');
    if (lbl) lbl.textContent = (_editModalMode === 'bw' ? 'משקל גוף' : _editModalMode === 'plates' ? 'פלטות' : 'Weight (kg)') + ' ⇄';
    const row = document.getElementById('edit-weight-stepper-row');
    if (row) row.style.visibility = _editModalMode === 'bw' ? 'hidden' : 'visible';
}

function _editModalRenderValue(field) {
    const disp = document.getElementById('edit-' + field + '-display');
    if (!disp) return;
    if (field === 'weight' && _editModalMode === 'bw') { disp.textContent = 'BW'; return; }
    const val = _editModalVals[field];
    disp.textContent = (field === 'rir' && val === 0) ? 'Fail' : String(val);
}

function _editModalCycleMode() {
    const order = ['kg', 'plates', 'bw'];
    _editModalMode = order[(order.indexOf(_editModalMode) + 1) % order.length];
    haptic('light');
    _editModalRenderModeUI();
    _editModalRenderValue('weight');
}

function _editModalStep(field, dir) {
    if (field === 'weight' && _editModalMode === 'bw') return;
    const stepSize = field === 'weight' ? (_editModalMode === 'plates' ? 1 : 2.5) : 1;
    const minVal = field === 'reps' ? 1 : 0;
    const val = Math.max(minVal, parseFloat((_editModalVals[field] + dir * stepSize).toFixed(2)));
    _editModalVals[field] = val;
    haptic('light');
    _editModalRenderValue(field);
}

function _editModalEditValue(field) {
    if (field === 'weight' && _editModalMode === 'bw') return;
    const disp = document.getElementById('edit-' + field + '-display');
    if (!disp || disp.querySelector('input')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.className = 'stepper-edit-input';
    input.value = String(_editModalVals[field]);
    disp.textContent = '';
    disp.appendChild(input);
    input.focus();
    input.select();

    const finish = (commit) => {
        if (input._done) return;
        input._done = true;
        if (commit && input.value !== '') {
            let num = parseFloat(input.value);
            if (!isNaN(num)) {
                num = field === 'reps' ? Math.max(1, Math.round(num)) : Math.max(0, num);
                _editModalVals[field] = num;
            }
        }
        _editModalRenderValue(field);
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
}

function openEditSetModal(realIdx) {
    _editSetRealIdx = realIdx;
    _editFromLog = true;
    _editFromSummary = false;
    const realSets = state.log.filter(l => !l.skip);
    const entry = realSets[realIdx];
    if (!entry) return;

    document.getElementById('session-log-modal').style.display = 'none';
    _editModalInit(entry.w, entry.r, entry.rir, entry.note, entry.wm || 'kg');
    document.getElementById('edit-set-modal').style.display = 'flex';
}

function openSummaryEditSetModal(realIdx) {
    _editSetRealIdx = realIdx;
    _editFromLog = false;
    _editFromSummary = true;
    const realSets = state.log.filter(l => !l.skip);
    const entry = realSets[realIdx];
    if (!entry) return;

    _editModalInit(entry.w, entry.r, entry.rir, entry.note, entry.wm || 'kg');
    document.getElementById('edit-set-modal').style.display = 'flex';
}

function saveSetEdit() {
    // ניתוב למצב ארכיון אם פעיל
    if (typeof _editFromArchive !== 'undefined' && _editFromArchive) {
        saveArchiveSetEdit();
        return;
    }
    const realSets = state.log.filter(l => !l.skip);
    const entry = realSets[_editSetRealIdx];
    if (!entry) return;
    const newW = _editModalMode === 'bw' ? 0 : _editModalVals.weight;
    const newR = _editModalVals.reps;
    if (isNaN(newW) || newW < 0 || isNaN(newR) || newR < 1) {
        showAlert('ערכים לא תקינים — משקל חייב להיות 0 ומעלה וחזרות לפחות 1.');
        return;
    }
    entry.w = newW;
    entry.r = newR;
    entry.rir = _editModalVals.rir;
    if (_editModalMode === 'kg') delete entry.wm;
    else entry.wm = _editModalMode;
    entry.note = document.getElementById('edit-note').value.trim();
    const fromLog = _editFromLog, fromSummary = _editFromSummary;
    closeEditModal();
    StorageManager.saveSessionState();
    if (fromLog) { openSessionLog(); }
    else if (fromSummary) {
        const noteEl = document.getElementById('summary-note');
        _saveToArchive(noteEl ? noteEl.value.trim() : ''); // upsert — שומר את העריכה ברשומה
        buildSummaryUI();
    }
}

function deleteSetFromLog() {
    // ניתוב למצב ארכיון אם פעיל
    if (typeof _editFromArchive !== 'undefined' && _editFromArchive) {
        deleteArchiveSet();
        return;
    }
    const realSets = state.log.filter(l => !l.skip);
    const entry = realSets[_editSetRealIdx];
    if (!entry) return;
    const logIdx = state.log.indexOf(entry);
    if (logIdx !== -1) state.log.splice(logIdx, 1);
    const fromLog = _editFromLog, fromSummary = _editFromSummary;
    closeEditModal();
    StorageManager.saveSessionState();
    if (fromLog) { openSessionLog(); }
    else if (fromSummary) {
        const noteEl = document.getElementById('summary-note');
        _saveToArchive(noteEl ? noteEl.value.trim() : ''); // upsert — שומר את העריכה ברשומה
        buildSummaryUI();
    }
}

function closeEditModal() {
    document.getElementById('edit-set-modal').style.display = 'none';
    _editFromLog = false;
    _editFromSummary = false;
    if (typeof _editFromArchive !== 'undefined') _editFromArchive = false;
}

// ─── EXERCISE SETTINGS ─────────────────────────────────────────────────────

let _editingRestEx = null;

// פתיחת מודאל הגדרות תרגיל בזמן אימון פעיל
// saveExerciseSettings / changeRestTime / closeExerciseSettings — מוגדרות ב-editor-logic.js
// ותומכות בשני ההקשרים (עורך + אימון פעיל)
function openExerciseSettings() {
    const planItem = state.clusterMode
        ? state.activeCluster.exercises[state.clusterIdx]
        : state.workouts[state.type][state.exIdx];
    _editingRestEx = planItem;

    document.getElementById('ex-settings-title').innerText = `הגדרות: ${state.currentExName}`;
    document.getElementById('target-weight-input').value = planItem.targetWeight !== undefined ? planItem.targetWeight : '';
    document.getElementById('target-reps-input').value = planItem.targetReps !== undefined ? planItem.targetReps : '';
    document.getElementById('target-rir-input').value = planItem.targetRIR !== undefined ? planItem.targetRIR : '';
    document.getElementById('rest-time-display').innerText = (planItem.restTime || 90) + 's';
    document.getElementById('exercise-settings-modal').style.display = 'flex';
}

// ─── RESET ─────────────────────────────────────────────────────────────────

function resetToFactorySettings() {
    // הנוסח מדייק את מה שבאמת נמחק (resetToFactory מוחק תוכניות/תרגילים/סשן בלבד) —
    // הארכיון, שקילות, תזונה, AI והחיבורים נשמרים בכוונה
    showConfirm("לאפס תוכניות ותרגילים לברירת המחדל? האימון הפעיל יימחק. הארכיון, שקילות, תזונה וההגדרות יישמרו. פעולה זו בלתי הפיכה.", () => {
        StorageManager.resetToFactory();
        showAlert("האפליקציה אופסה. טוען מחדש...", () => {
            window.location.reload();
        });
    });
}

// ─── AI COACH ──────────────────────────────────────────────────────────────

/**
 * buildBlockContext — מחזיר שלושה בלוקים (נוכחי + 2 קודמים) כמחרוזות Raw Summary.
 * בלוק = כל האימונים מה-week===1 האחרון ועד עכשיו.
 * fallback: אם אין week field — מחזיר 12 אחרונים כבלוק נוכחי.
 */
function buildBlockContext() {
    const archive = StorageManager.getArchive();
    if (!archive.length) return { current: [], previous: [], previous2: [] };

    // מוצא את גבול הבלוק החל מ-startFrom (חדש→ישן). גבול = ה-Week-1 הישן ביותר ברצף Week-1 רצוף
    // (כי לשבוע 1 של בלוק יש לרוב כמה אימונים — Workout A, B, C — כולם week:1).
    // מחזיר -1 אם אין Week-1 מ-startFrom והלאה.
    function findBlockEnd(startFrom) {
        let i = startFrom;
        // דלג על אימונים שאינם Week-1 (Week 2/3/deload של אותו בלוק, החדשים יותר)
        while (i < archive.length && archive[i].week !== 1) i++;
        if (i >= archive.length) return -1;
        // הרחב את הגבול כל עוד גם האימון הבא (הישן יותר) הוא Week-1 — אותו שבוע 1, workout אחר
        while (i + 1 < archive.length && archive[i + 1].week === 1) i++;
        return i;
    }

    const currentEnd = findBlockEnd(0);
    if (currentEnd === -1) {
        // אין Week-1 כלל — fallback ל-12 אחרונים
        return { current: archive.slice(0, Math.min(12, archive.length)), previous: [], previous2: [] };
    }
    const currentBlock = archive.slice(0, currentEnd + 1);

    const prevEnd = findBlockEnd(currentEnd + 1);
    if (prevEnd === -1) {
        return { current: currentBlock, previous: archive.slice(currentEnd + 1), previous2: [] };
    }
    const previousBlock = archive.slice(currentEnd + 1, prevEnd + 1);

    const prev2End = findBlockEnd(prevEnd + 1);
    const previous2Block = prev2End === -1
        ? archive.slice(prevEnd + 1)
        : archive.slice(prevEnd + 1, prev2End + 1);

    return { current: currentBlock, previous: previousBlock, previous2: previous2Block };
}

/**
 * buildAnalyticsSnapshot — מחזיר string קומפקטי עם נתוני אנליטיקה מצרפיים.
 */
function buildAnalyticsSnapshot() {
    const archive = StorageManager.getArchive().filter(a => a && a.timestamp);
    if (!archive.length) return '';

    const total      = archive.length;
    const totalVol   = archive.reduce((s, a) => s + (typeof getWorkoutVolume === 'function' ? getWorkoutVolume(a) : 0), 0);
    const totalMins  = archive.reduce((s, a) => s + (a.duration || 0), 0);
    const avgMins    = total ? Math.round(totalMins / total) : 0;

    // עקביות — ממוצע ימים בין אימונים
    let avgGap = 0;
    if (archive.length >= 2) {
        const gaps = [];
        for (let i = 0; i < archive.length - 1; i++) {
            gaps.push((archive[i].timestamp - archive[i + 1].timestamp) / 86400000);
        }
        avgGap = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length * 10) / 10;
    }

    // 1RM מחושב לתרגילי מפתח
    const rmLines = [];
    const prefs = StorageManager.getAnalyticsPrefs();
    const formula = prefs.formula || 'epley';
    const keyExercises = state.exercises.filter(e => e.isCalc).slice(0, 5);
    keyExercises.forEach(ex => {
        for (const item of archive) {
            if (!item.details || !item.details[ex.name]) continue;
            const sets = item.details[ex.name].sets || [];
            if (!sets.length) continue;
            let maxE1RM = 0;
            sets.forEach(s => {
                if (typeof parseSetsFromStrings === 'function') {
                    const parsed = parseSetsFromStrings([s]);
                    if (parsed.length) {
                        const e = typeof calc1RM === 'function' ? calc1RM(parsed[0].w, parsed[0].r, formula) : 0;
                        if (e > maxE1RM) maxE1RM = e;
                    }
                }
            });
            if (maxE1RM > 0) { rmLines.push(`${ex.name}: ~${Math.round(maxE1RM)}kg`); break; }
        }
    });

    // שרירים — חודש אחרון
    const muscleCounts = typeof getMuscleSetCounts === 'function'
        ? getMuscleSetCounts(archive, '1m') : {};
    const muscleStr = Object.entries(muscleCounts)
        .filter(([m]) => !['biceps','triceps','quads','hamstrings','glutes','calves'].includes(m))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([m, n]) => `${m} ${n}סטים`)
        .join(' | ');

    let snap = `=== אנליטיקה מצרפית ===\n`;
    snap += `נפח כולל: ${(totalVol / 1000).toFixed(1)}t | אימונים: ${total} | ממוצע משך: ${avgMins}m`;
    if (avgGap) snap += ` | ממוצע ימים בין אימונים: ${avgGap}`;
    if (rmLines.length) snap += `\n1RM מחושב: ${rmLines.join(' | ')}`;
    if (muscleStr) snap += `\nשרירים (חודש אחרון): ${muscleStr}`;
    return snap;
}

// _buildNutritionAIContext — סיכום נתוני התזונה (MyFitnessPal) ל-AI: צריכה שוטפת היום + ממוצעים + פירוט אחרון.
function _buildNutritionAIContext(slim) {
    const all = (StorageManager.getNutritionDaily() || []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
    if (!all.length) return '';
    const todayStr = StorageManager._todayStr();
    const todayEntry = all.find(d => d.date === todayStr);
    const days = all.filter(d => d.date !== todayStr);     // ימים מלאים בלבד — היום חלקי ומשטיח ממוצעים
    const avgN = (arr, k) => arr.length ? Math.round(arr.reduce((s, d) => s + (d[k] || 0), 0) / arr.length) : 0;
    const macro = arr => `${avgN(arr, 'calories')} קק"ל | חלבון ${avgN(arr, 'protein')}g | פחמימה ${avgN(arr, 'carbs')}g | שומן ${avgN(arr, 'fat')}g`;
    let s = `\n=== תזונה בפועל (סיכום יומי) ===\n`;
    // צריכה שוטפת היום — נתון חלקי שמתעדכן במהלך היום (יומן פנימי / Apple Health / MFP)
    if (todayEntry) {
        const src = todayEntry.src === 'health' ? 'Apple Health' : todayEntry.src === 'app' ? 'יומן פנימי' : 'MyFitnessPal';
        s += `צריכה שוטפת היום (${todayStr}, חלקי — מתעדכן במהלך היום, מקור ${src}): ${todayEntry.calories} קק"ל | חלבון ${todayEntry.protein || 0}g | פחמימה ${todayEntry.carbs || 0}g | שומן ${todayEntry.fat || 0}g\n`;
        // קלוריות שנותרו היום — מול יעד ידני אם הוגדר, אחרת מול ה-TDEE (תחזוקה)
        let ref = getAnalyticsPrefs().kcalTarget, refLbl = 'היעד היומי';
        if (!ref && typeof computeTDEE === 'function') { try { const tt = computeTDEE(); if (tt && tt.best) { ref = tt.best; refLbl = 'ה-TDEE (תחזוקה)'; } } catch (e) {} }
        if (ref) s += `קלוריות שנותרו היום מול ${refLbl} (${ref} קק"ל): ~${Math.max(0, ref - (todayEntry.calories || 0))} קק"ל.\n`;
    } else {
        s += `צריכה שוטפת היום (${todayStr}): טרם תועדה.\n`;
    }
    if (days.length) {
        const last = days[days.length - 1];
        s += `ימים מלאים מתועדים: ${days.length} | אחרון: ${last.date}\n`;
        s += `ממוצע 7 ימים (לא כולל היום): ${macro(days.slice(-7))}\n`;
        s += `ממוצע 30 ימים: ${macro(days.slice(-30))}\n`;
        if (!slim) {
            const recent = days.slice(-14);
            s += `פירוט ${recent.length} ימים מלאים אחרונים (תאריך — קק"ל | חלבון/פחמימה/שומן g):\n`;
            recent.forEach(d => { s += `${d.date} — ${d.calories} | ${d.protein}/${d.carbs}/${d.fat}\n`; });
        }
    }
    return s;
}

// _buildFoodDiaryAIContext — פירוט יומן המזון הפנימי ל-AI: מה נאכל היום (לפי ארוחה)
// + יעדי מאקרו + היסטוריה קצרה. משלים את הסיכום היומי עם רזולוציית מזון/ארוחה.
function _buildFoodDiaryAIContext(slim) {
    const log = StorageManager.getFoodLog() || {};
    const dates = Object.keys(log).filter(d => Array.isArray(log[d]) && log[d].length).sort();
    if (!dates.length) return '';
    const todayStr = StorageManager._todayStr();
    const r = v => Math.round(Number(v) || 0);
    const fmtItem = e => `${e.name || 'מזון'}${e.brand && e.brand !== 'חומר גלם' ? ' (' + e.brand + ')' : ''} ${r(e.kcal)} קק"ל [ח${r(e.p)}/פ${r(e.c)}/ש${r(e.f)}]`;

    let s = `\n=== יומן מזון מפורט (תיעוד פנימי באפליקציה) ===\n`;
    // יעדי מאקרו (אם הוגדרו)
    const p = getAnalyticsPrefs();
    if (p.kcalTarget || p.proteinTarget || p.carbsTarget || p.fatTarget) {
        s += `יעדים יומיים: ${p.kcalTarget || '—'} קק"ל | חלבון ${p.proteinTarget || '—'}g | פחמימה ${p.carbsTarget || '—'}g | שומן ${p.fatTarget || '—'}g\n`;
    }
    // היום — מקובץ לפי ארוחה, עם פירוט פריטים וסכום לארוחה
    const today = log[todayStr] || [];
    if (today.length) {
        s += `היום (${todayStr}):\n`;
        const order = [];
        const byMeal = {};
        today.forEach(e => { const m = e.meal || 'אחר'; if (!byMeal[m]) { byMeal[m] = []; order.push(m); } byMeal[m].push(e); });
        order.forEach(m => {
            const items = byMeal[m];
            const t = items.reduce((a, e) => { a.k += +e.kcal || 0; a.p += +e.p || 0; a.c += +e.c || 0; a.f += +e.f || 0; return a; }, { k: 0, p: 0, c: 0, f: 0 });
            s += `• ${m} (${r(t.k)} קק"ל, ח${r(t.p)}/פ${r(t.c)}/ש${r(t.f)}): ${items.map(fmtItem).join('; ')}\n`;
        });
    } else {
        s += `היום (${todayStr}): טרם תועד מזון ביומן הפנימי.\n`;
    }
    // היסטוריה — רק במצב מלא; פירוט פריטים קומפקטי, עם guard אורך
    if (!slim) {
        const past = dates.filter(d => d !== todayStr).slice(-7).reverse();
        if (past.length) {
            s += `ימים אחרונים ביומן הפנימי:\n`;
            for (const d of past) {
                if (s.length > 3000) { s += `…(נקטע)\n`; break; }
                const items = log[d];
                const tk = items.reduce((a, e) => a + (+e.kcal || 0), 0);
                s += `${d} (${r(tk)} קק"ל): ${items.map(e => `${e.name || 'מזון'} ${r(e.kcal)}`).join('; ')}\n`;
            }
        }
    }
    return s;
}

// _buildBodylogAIContext — סיכום שקילות/הרכב גוף ל-AI: משקל אחרון, מגמה, ופירוט אחרון.
function _buildBodylogAIContext(slim) {
    const log = (StorageManager.getBodyLog() || []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
    if (!log.length) return '';
    const last = log[log.length - 1];
    let s = `\n=== הרכב גוף / שקילות ===\n`;
    s += `שקילה אחרונה: ${last.weight}kg`;
    if (last.bodyFat != null) s += ` | שומן ${last.bodyFat}%`;
    s += ` (${last.date}) | סך שקילות: ${log.length}\n`;
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const ref = log.filter(e => e.date <= cutoff).slice(-1)[0] || log[0];
    if (ref && ref !== last) {
        const d = last.weight - ref.weight;
        s += `שינוי ~30 יום: ${d >= 0 ? '+' : ''}${d.toFixed(1)}kg\n`;
    }
    if (!slim) {
        const recent = log.slice(-12);
        s += `שקילות אחרונות (תאריך — משקל):\n`;
        recent.forEach(e => { s += `${e.date} — ${e.weight}kg${e.bodyFat != null ? ` (${e.bodyFat}%)` : ''}\n`; });
    }
    return s;
}

// _buildTdeeAIContext — מאזן אנרגיה מחושב (TDEE + טווח + קצב) + הבסיס והמתודולוגיה, לעיגון המלצות ה-AI.
function _buildTdeeAIContext(slim) {
    if (typeof computeTDEE !== 'function') return '';
    let t;
    try { t = computeTDEE(); } catch (e) { return ''; }
    if (!t || t.best == null) return '';
    const D = d => (typeof _blListDate === 'function' && d) ? _blListDate(d) : (d || '—');
    let s = `\n=== מאזן אנרגיה / TDEE (מחושב מהנתונים) ===\n`;
    s += `TDEE מוערך: ${t.best} קק"ל/יום (טווח ${t.low}–${t.high}, ביטחון ${t.confidence}, מקור: ${t.source})\n`;
    if (t.weeklyKg != null) s += `קצב משקל נוכחי: ${t.weeklyKg >= 0 ? '+' : ''}${t.weeklyKg} ק"ג/שבוע · צריכה ממוצעת ${t.avgIntake} קק"ל\n`;
    // בסיס המדידה (back-calc) — החלון והנתונים ששימשו לחישוב
    if (t.measuredOk) {
        s += `בסיס המדידה: חלון מ-${D(t.effectiveStart)} (${t.days} ימי תזונה, ${t.spanDays} ימי מגמת משקל) · נוסחה: ${t.avgIntake} (ממוצע צריכה) − שיפוע משקל ${t.weeklyKg} ק"ג/שבוע × 7700.\n`;
        const adj = [];
        if (t.trimmedOld) adj.push(`דולגו שקילות לפני ${D(t.effectiveStart)} (פער מאזניים/baseline חדש)`);
        if (t.despiked && t.despiked.length) adj.push(`${t.despiked.length === 1 ? 'הוסרה שקילה חריגה אחת' : `הוסרו ${t.despiked.length} שקילות חריגות`} (ספייק מים/ריפיד)`);
        if (adj.length) s += `התאמות שבוצעו: ${adj.join('; ')}.\n`;
    } else if (t.shortWindow) {
        s += `אין מדידת back-calc — חלון קצר מ-10 ימי מגמת משקל; ההערכה מבוססת נוסחאות בלבד.\n`;
    }
    // שיטות הנוסחה המקבילות — לעיגון/השוואה
    const fm = (t.methods || []).filter(m => m.bmr != null);
    if (fm.length) s += `שיטות נוסחה (BMR→TDEE): ${fm.map(m => `${m.name} ${m.bmr}→${m.tdee}`).join(' · ')}.\n`;
    s += `אי-ודאות עיקרית: ${t.uncertainty}. התייחס לזה כעוגן והצג כהערכה (לא מספר מוחלט).\n`;
    // מתודולוגיה תמציתית (כדי שה-AI יבין איך נגזר ה-TDEE) — מושמט במצב slim (שאלות תוך-אימון)
    if (!slim) {
        s += `מתודולוגיה: מריצים כמה שיטות ומעגנים על המדידה בפועל כשקיימת. back-calc = ממוצע_צריכה − שיפוע_משקל(ק"ג/יום)×7700, כששיפוע המשקל מגיע מרגרסיית least-squares על כל השקילות בחלון (עמיד לרעש מים, לא נקודה-מול-נקודה), עם ניקוי ימי תזונה חסרים, פיצול פער-מאזניים, וסינון ספייקים. נוסחאות תחזית: Katch/Cunningham (LBM מ-%שומן) ו-Mifflin (פרופיל)×מכפיל פעילות. best = המדידה כשקיימת (CI ±7%), אחרת חציון התחזיות (CI ±10-15%). 7700 קק"ל/ק"ג; תת-דיווח עקבי מתקזז כי הפלט באותן יחידות דיווח.\n`;
    }
    return s;
}

/**
 * buildSystemPrompt — מרכיב את ה-System Instruction המלא לכל קריאת API.
 */
function buildSystemPrompt(opts = {}) {
    const slim = opts.slim === true;
    let prompt = `אתה מאמן הכוח האישי של אפליקציית GYMPRO ELITE — מומחה לעומס פרוגרסיבי (Progressive Overload), תכנון אימונים וניתוח ביצועים. אתה פונה ישירות למתאמן.

# פורמט פלט
- עברית בלבד. ללא אמוג'י.
- מותר עיצוב בסיסי לקריאוּת: הדגשה עם **טקסט**, כותרות עם # ורשימות עם - או מספור (1. 2. 3.). אל תגזים בעיצוב.
- ספק רק את התשובה הסופית — בלי תהליך חשיבה, בלי תיוגי THINK, בלי הקדמות מיותרות.

# היקף ועומק
- ברירת מחדל: תמציתי וישיר. לשאלות תוך-אימון (משקל, חזרות, מנוחה, החלפת תרגיל) ענה בכמה שורות ללא רקע מיותר.
- כשמתבקש "סיכום", "ניתוח", "סקירה", "דוח" או הסבר מעמיק — ספק תשובה מלאה, מובנית ויסודית בהודעה אחת. כסה את כל ההיבטים הרלוונטיים, אל תקצר באופן מלאכותי ואל תפצל לחלקים שמחייבים "המשך".

# מקורות ואמינות
- הסתמך אך ורק על הנתונים שמופיעים למטה (פרופיל, מצב נוכחי, מצב תזונתי, תזונה בפועל מ-MyFitnessPal כולל הצריכה השוטפת היום, מאזן אנרגיה/TDEE והבסיס שלו, הרכב גוף/שקילות, אנליטיקה, היסטוריית בלוקים) ועל ידע מבוסס-מחקר בפיזיולוגיה ואימוני כוח. אל תמציא מספרים, מגמות או עובדות, ואל תסתמך על "ברו-סיינס".
- הנתונים שלמטה הם מקור האמת על המתאמן. אם נדרש מידע שאינו מופיע — אמור זאת ובקש אותו, במקום לנחש.
- אם נשאלת על תאריך, אימון, משקל או מספר שלא מופיעים מילולית בנתונים שלמטה — השב במפורש "הנתון לא קיים במידע שיש לי כרגע". אל תמציא ערכים ואל תסיק תאריכים מהקשר.
- חריג: **מותר ומומלץ** לחשב חישובים אריתמטיים פשוטים מנתונים שכן מופיעים (חיבור/חיסור/ממוצע). בפרט — שאלות על הצריכה היומית ("כמה אכלתי היום", "כמה קלוריות נותרו") נענות מהשורה "צריכה שוטפת היום" שבמקטע התזונה (מתעדכנת במהלך היום, מקורה Apple Health או MyFitnessPal — שתיהן תקפות), וכמות הנותרת = יעד/TDEE פחות הצריכה השוטפת. אל תאמר שאין לך נתון יומי אם השורה "צריכה שוטפת היום" קיימת.

# מתודולוגיה
- בהשוואה בין בלוקים: השווה תמיד שבועות מקבילים (שבוע N בבלוק הנוכחי מול שבוע N בבלוק קודם), לא מספרים מוחלטים מתקופות שונות.
- התאם המלצות למצב התזונתי (Cut / Maintenance / Surplus): בגירעון — עדיפות לשימור כוח ולוויסות נפח ועייפות; בעודף — ניצול חלון לעלייה. ציין במפורש כשהמצב התזונתי משנה את ההמלצה.
- כל המלצה מעשית: מה לעשות, כמה, ולמה — מבוסס על נתוני המתאמן.\n`;

    // פרופיל אישי
    const persona = StorageManager.getAIPersona();
    if (persona) prompt += `\n=== פרופיל המתאמן ===\n${persona}\n`;

    // זיכרון מצטבר משיחות קודמות + ניתוחים קודמים של המאמן (קונטקסט ארוך-טווח, צד-קלט בלבד)
    prompt += _coachMemorySection();
    prompt += _buildCondensedCoachSummaries(2, 800);

    // מצב תזונתי — משפיע ישירות על ההמלצות (Cut/Maintenance/Surplus)
    const nutriCtx = getNutritionalContext();
    if (nutriCtx) prompt += `\n=== מצב תזונתי ===\n${nutriCtx}\n`;

    // נתוני תזונה בפועל (סיכום יומי + יומן מזון מפורט) + שקילות
    prompt += _buildNutritionAIContext(slim);
    prompt += _buildFoodDiaryAIContext(slim);
    prompt += _buildBodylogAIContext(slim);
    prompt += _buildTdeeAIContext(slim);

    // מצב נוכחי
    prompt += `\n=== מצב נוכחי ===\n`;
    if (StorageManager.hasActiveSession()) {
        prompt += `אימון פעיל: ${state.type} | שבוע: ${state.week}\n`;
        if (state.currentExName) {
            prompt += `תרגיל נוכחי: ${state.currentExName}\n`;
            const rm = StorageManager.getLastRM(state.currentExName);
            if (rm) prompt += `1RM: ${rm}kg\n`;
            const currentSets = (state.log || [])
                .filter(l => !l.skip && l.exName === state.currentExName)
                .map(l => `${_fmtW(l)}×${l.r} (RIR ${l.rir !== undefined ? l.rir : '—'})`);
            if (currentSets.length) prompt += `סטים שבוצעו: ${currentSets.join(', ')}\n`;
        }

        // שבועות מקבילים מהבלוק הקודם — לעזור בהשוואה ישירה
        if (state.week && state.week !== 'deload' && !state.isFreestyle) {
            const { previous } = buildBlockContext();
            const parallelWeek = previous.filter(item => item.week === state.week);
            if (parallelWeek.length) {
                prompt += `\nשבוע ${state.week} בבלוק הקודם (לצורך השוואה ישירה):\n`;
                parallelWeek.forEach(item => { if (item.summary) prompt += item.summary + '\n'; });
            }
        }
    } else {
        prompt += `המתאמן לא באימון כרגע.\n`;
    }

    // תרגילים מותאמים אישית (לא ב-defaultExercises)
    const defaultNames = new Set(defaultExercises.map(e => e.name));
    const customExercises = state.exercises.filter(e => !defaultNames.has(e.name));
    if (customExercises.length) {
        prompt += `\n=== תרגילים מותאמים אישית ===\n`;
        prompt += customExercises.map(e => e.name).join(', ') + '\n';
    }

    // אנליטיקה מצרפית
    const snap = buildAnalyticsSnapshot();
    if (snap) prompt += `\n${snap}\n`;

    // ארכיון — בלוקים
    prompt += `\n=== היסטוריית אימונים ===\n`;
    if (aiFullArchiveMode) {
        const all = StorageManager.getArchive();
        prompt += `(ארכיון מלא — ${all.length} אימונים)\n\n`;
        all.forEach(item => { if (item.summary) prompt += item.summary + '\n\n'; });
    } else {
        const { current, previous, previous2 } = buildBlockContext();
        if (current.length) {
            prompt += `--- בלוק נוכחי ---\n`;
            [...current].reverse().forEach(item => { if (item.summary) prompt += item.summary + '\n\n'; });
        }
        if (previous.length) {
            prompt += `--- בלוק קודם ---\n`;
            [...previous].reverse().forEach(item => { if (item.summary) prompt += item.summary + '\n\n'; });
        }
        if (previous2.length && !slim) {
            prompt += `--- בלוק לפני־קודם ---\n`;
            [...previous2].reverse().forEach(item => { if (item.summary) prompt += item.summary + '\n\n'; });
        }
        if (!current.length && !previous.length && !previous2.length) prompt += `אין היסטוריית אימונים.\n`;
    }

    return prompt;
}

// ─── זיכרון מאמן: קונטקסט מצטבר (צד-קלט, זול במהירות) ────────────────────────

// _coachMemorySection — מזריק את תקציר הזיכרון המתגלגל לתוך ה-system prompt.
function _coachMemorySection() {
    const m = StorageManager.getCoachMemory();
    if (m && m.text && m.text.trim()) {
        return `\n=== זיכרון מצטבר משיחות קודמות ===\n${m.text.trim()}\n`;
    }
    return '';
}

// _buildCondensedCoachSummaries — N סיכומי המאמן האחרונים, מקוצרים (כותרות-מסקנה).
function _buildCondensedCoachSummaries(maxN, maxChars) {
    const archive = StorageManager.getArchive(); // חדש→ישן
    const withAi = archive.filter(a => a && a.aiSummary && String(a.aiSummary).trim()).slice(0, maxN);
    if (!withAi.length) return '';
    let s = '\n=== ניתוחים קודמים של המאמן (מתומצת) ===\n';
    withAi.forEach(a => {
        let t = String(a.aiSummary).trim();
        if (t.length > maxChars) {
            t = t.slice(0, maxChars);
            const cut = Math.max(t.lastIndexOf('.'), t.lastIndexOf('\n'));
            if (cut > maxChars * 0.6) t = t.slice(0, cut + 1);
            t += ' […]';
        }
        s += `• ${a.date || ''} ${a.type || ''}:\n${t}\n\n`;
    });
    return s;
}

// _maybeUpdateCoachMemory — מפעיל רענון זיכרון ברקע כשנצברו ≥20 הודעות חדשות.
// לא חוסם את התשובה למשתמש — נקרא ללא await אחרי שהתשובה כבר הוצגה.
let _coachMemoryUpdating = false;
const COACH_MEMORY_THRESHOLD = 20;
function _maybeUpdateCoachMemory() {
    if (_coachMemoryUpdating) return;
    const mem = StorageManager.getCoachMemory();
    const covered = Math.min(mem.coveredLen || 0, aiChatHistory.length);
    if (aiChatHistory.length - covered < COACH_MEMORY_THRESHOLD) return;
    _updateCoachMemory(); // fire-and-forget
}

async function _updateCoachMemory() {
    if (_coachMemoryUpdating) return;
    _coachMemoryUpdating = true;
    try {
        const mem = StorageManager.getCoachMemory();
        const covered = Math.min(mem.coveredLen || 0, aiChatHistory.length);
        let newMsgs = aiChatHistory.slice(covered);
        if (newMsgs.length > 40) newMsgs = newMsgs.slice(-40); // חסם גודל קלט
        if (!newMsgs.length) { _coachMemoryUpdating = false; return; }

        const convo = newMsgs.map(m =>
            (m.role === 'user' ? 'מתאמן' : 'מאמן') + ': ' + (m.text || '')).join('\n');

        const prompt =
`אתה מתחזק "זיכרון מאמן" — תקציר תמציתי של תובנות עמידות מהשיחות עם המתאמן, שישמש כהקשר בעתיד.
עדכן את הזיכרון הקיים לאור קטע השיחה החדש. שמור רק מידע בעל ערך מתמשך: העדפות, מגבלות/פציעות, יעדים, קיבעונים שזוהו, החלטות אימון ומה שעבד/לא עבד. אל תכלול פטפוט חולף.
החזר טקסט עברי רציף בלבד (ללא הקדמה), עד ~900 תווים.

=== זיכרון קיים ===
${mem.text && mem.text.trim() ? mem.text.trim() : 'אין עדיין.'}

=== קטע שיחה חדש ===
${convo}`;

        const out = await _callGeminiOneShot(prompt, { freeText: true, maxTokens: 700 });
        const clean = (out || '').replace(/```[\s\S]*?```/g, '').trim();
        if (clean) {
            StorageManager.setCoachMemory({ text: clean.slice(0, 1400), coveredLen: aiChatHistory.length, updatedAt: Date.now() });
        }
    } catch (e) {
        console.warn('GymPro: coach memory update skipped', e && e.message);
    } finally {
        _coachMemoryUpdating = false;
    }
}

/**
 * callGeminiAPI — Waterfall אסינכרוני על מערך מודלים.
 * שולח 10 הודעות אחרונות מ-aiChatHistory.
 */
async function callGeminiAPI(userMessage) {
    const last10 = aiChatHistory.slice(-10);

    // אורך תשובה לפי המצב הנבחר (auto/short/deep) — משפיע על תקרת הטוקנים ועל הנחיית האורך
    const deep = _resolveAnswerDepth(userMessage);
    const depthDirective = deep
        ? '\n\n# הנחיית אורך לשיחה זו\nספק תשובה מלאה, מעמיקה ומובנית — כסה את כל ההיבטים הרלוונטיים.'
        : '\n\n# הנחיית אורך לשיחה זו\nענה בקצרה ולעניין — שורות ספורות בלבד, ללא הרחבות מיותרות.';

    // תחבורה דרך השכבה המשותפת — thinking מותאם-מודל, מודל מועדף, timeout.
    // 404/429/503 בלבד כ-fallback (כמו קודם): שגיאת 400 בצ'אט מוצגת למשתמש עם הפירוט.
    const { text, finishReason } = await _geminiRequest({
        systemInstruction: { parts: [{ text: buildSystemPrompt({ slim: !deep }) + depthDirective }] },
        contents: [
            ...last10.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
            { role: 'user', parts: [{ text: userMessage }] }
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: deep ? 2048 : 768 }
    }, { timeoutMs: 90000, fallbackStatuses: [404, 429, 503] });

    // זיהוי קטיעה אמיתית מתקרת הטוקנים — לסימון במקום בליעה שקטה
    if (finishReason === 'MAX_TOKENS' && text) {
        return text + '\n\n[התשובה נקטעה עקב מגבלת אורך — כתוב "המשך" כדי להשלים]';
    }
    return text;
}

/**
 * openAICoach — פותח את מודל הצ'אט וטוען היסטוריה.
 */
function openAICoach() {
    const modal = document.getElementById('ai-coach-modal');
    if (!modal) return;

    // טעינת היסטוריה מ-LocalStorage לזיכרון session
    const saved = StorageManager.getAIHistory();
    aiChatHistory = saved.map(m => ({ role: m.role, text: m.text }));

    // clamp ל-coveredLen — ההיסטוריה מוגבלת ל-300 ועלולה להתקצר בין סשנים
    const _mem = StorageManager.getCoachMemory();
    if (_mem && (_mem.coveredLen || 0) > aiChatHistory.length) {
        _mem.coveredLen = aiChatHistory.length;
        StorageManager.setCoachMemory(_mem);
    }

    // סינון לפי cutoff — הודעות מלפני "ניקוי מסך" לא יוצגו (שורד reload)
    const cutoff = StorageManager.getAIDisplayCutoff();
    const visible = cutoff > 0 ? saved.filter(m => (m.timestamp || 0) > cutoff) : saved;
    _renderAIChatHistory(visible);

    // context banner אם באימון
    _updateAIContextBanner();

    // עדכון chip ארכיון
    _updateAIContextChips();
    _updateAnswerModeChip();

    modal.style.display = 'flex';
    haptic('light');
    initAISheetSwipe();

    // גלילה לסוף
    setTimeout(() => {
        const msgs = document.getElementById('ai-chat-messages');
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }, 50);
}

/**
 * closeAICoach — סוגר מודל וגבה ענן בשקט.
 */
function closeAICoach() {
    const modal = document.getElementById('ai-coach-modal');
    if (modal) modal.style.display = 'none';
    const menu = document.getElementById('ai-copy-menu');
    if (menu) menu.style.display = 'none';
    if (typeof FirebaseManager !== 'undefined' && FirebaseManager.isConfigured()) {
        FirebaseManager.saveAIHistoryToCloud()
            .then(ok => notifyCloudSaveFailure(ok, 'ai', 'גיבוי שיחות AI'))
            .catch(() => {});
    }
    haptic('light');
}

/**
 * clearAIChatDisplay — מנקה תצוגה בלבד. היסטוריה נשמרת.
 */
function clearAIChatDisplay() {
    const container = document.getElementById('ai-chat-messages');
    if (container) container.innerHTML = '';
    StorageManager.setAIDisplayCutoff(Date.now());
    haptic('success');
}

/**
 * initAISheetSwipe — גרירה למטה לסגירת ה-AI Coach sheet (iOS 26 style).
 * נרשם פעם אחת בלבד.
 */
let _aiSwipeInit = false;
function initAISheetSwipe() {
    if (_aiSwipeInit) return;
    const sheet  = document.querySelector('.ai-coach-sheet');
    const header = document.querySelector('.ai-coach-header');
    const handle = document.querySelector('.ai-sheet-handle');
    if (!sheet || !header || !handle) return;
    _aiSwipeInit = true;

    let startY = 0, currentY = 0, dragging = false;

    function onStart(e) {
        startY   = e.touches[0].clientY;
        currentY = 0;
        dragging = true;
        sheet.style.transition = 'none';
    }
    function onMove(e) {
        if (!dragging) return;
        currentY = e.touches[0].clientY - startY;
        if (currentY < 0) currentY = 0;
        sheet.style.transform = `translateY(${currentY}px)`;
    }
    function onEnd() {
        if (!dragging) return;
        dragging = false;
        sheet.style.transition = 'transform 0.3s cubic-bezier(0.32,0.72,0,1)';
        if (currentY > 120) {
            sheet.style.transform = `translateY(100%)`;
            setTimeout(() => {
                sheet.style.transform = '';
                sheet.style.transition = '';
                closeAICoach();
            }, 300);
        } else {
            sheet.style.transform = '';
        }
    }

    [handle, header].forEach(el => {
        el.addEventListener('touchstart', onStart, { passive: true });
        el.addEventListener('touchmove',  onMove,  { passive: true });
        el.addEventListener('touchend',   onEnd);
    });
}

/**
 * _renderAIChatHistory — מרנדר את כל ההיסטוריה השמורה.
 */
function _renderAIChatHistory(history) {
    const container = document.getElementById('ai-chat-messages');
    if (!container) return;
    container.innerHTML = '';
    if (!history.length) {
        container.innerHTML = `<div class="ai-empty-state">שלום! אני המאמן שלך. שאל אותי על האימון, על ביצועים, על תכנון — אני כאן.</div>`;
        return;
    }
    history.forEach(msg => {
        container.appendChild(_createBubble(msg.role, msg.text));
    });
}

/**
 * _createBubble — יוצר אלמנט בועת צ'אט.
 */
function _createBubble(role, text) {
    const div = document.createElement('div');
    div.className = `chat-bubble ${role === 'user' ? 'user' : 'ai'}`;
    if (role === 'model') {
        div.innerHTML = `<div class="bubble-label">AI Coach</div>${_renderMarkdown(text)}`;
    } else {
        div.textContent = text;
    }
    return div;
}

// _renderMarkdown — רינדור Markdown בסיסי ובטוח (escape תחילה למניעת XSS).
// תומך: הדגשה **טקסט**, כותרות #, תבליטים -/*, ושבירת שורות.
function _renderMarkdown(str) {
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const html = str.split('\n').map(line => {
        let l = esc(line);
        l = l.replace(/^\s*#{1,6}\s+(.*)$/, '<strong>$1</strong>');   // כותרות
        l = l.replace(/^\s*[-*]\s+(.*)$/, '• $1');                     // תבליטים
        return l;
    }).join('<br>');
    return html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');  // הדגשה
}

/**
 * _updateAIContextBanner — מציג/מסתיר banner הקשר אימון פעיל.
 */
function _updateAIContextBanner() {
    const banner = document.getElementById('ai-workout-ctx');
    if (!banner) return;
    const nutri = getNutritionalContext();
    if (StorageManager.hasActiveSession() && state.currentExName) {
        const rm = StorageManager.getLastRM(state.currentExName);
        const sets = (state.log || [])
            .filter(l => !l.skip && l.exName === state.currentExName)
            .map(l => `${_fmtW(l)}×${l.r} (RIR ${l.rir !== undefined ? l.rir : '—'})`)
            .join(' • ');
        banner.innerHTML = `<div class="ctx-lbl">הקשר אימון נוכחי</div>
            <strong>${escapeHtml(state.currentExName)}</strong>${rm ? ` • 1RM: ${rm}kg` : ''}<br><span class="ctx-nutri">Nutritional: ${nutri}</span>${sets ? `<br>${sets}` : ''}`;
        banner.style.display = 'block';
    } else {
        // גם ללא אימון פעיל — מציג את מצב התזונה כי הוא רלוונטי לכל שיחה עם המאמן
        banner.innerHTML = `<div class="ctx-lbl">הקשר נוכחי</div><span class="ctx-nutri">Nutritional: ${nutri}</span>`;
        banner.style.display = 'block';
    }
}

/**
 * _updateAIContextChips — מעדכן chips של ארכיון.
 */
function _updateAIContextChips() {
    const chipNormal = document.getElementById('ai-ctx-chip-blocks');
    const chipFull   = document.getElementById('ai-ctx-chip-full');
    if (chipNormal) chipNormal.classList.toggle('active', !aiFullArchiveMode);
    if (chipFull)   chipFull.classList.toggle('active', aiFullArchiveMode);
}

/**
 * toggleFullArchiveMode — מחליף מצב ארכיון מלא/בלוקים.
 */
function toggleFullArchiveMode() {
    aiFullArchiveMode = !aiFullArchiveMode;
    _updateAIContextChips();
    haptic('light');
}

// מילות-טריגר שמסמנות בקשה לתשובה מעמיקה (במצב auto)
const AI_DEEP_TRIGGERS = /(סיכום|סכם|ניתוח|נתח|סקיר|דו"?ח|השווא|השווה|מגמ|תוכנית|תכנון|מפורט|מעמיק)/;

/**
 * _resolveAnswerDepth — מחזיר true אם התשובה צריכה להיות מעמיקה.
 * auto: לפי מילות-מפתח בהודעה. short/deep: כפוי.
 */
function _resolveAnswerDepth(userMessage) {
    if (aiAnswerMode === 'short') return false;
    if (aiAnswerMode === 'deep')  return true;
    return AI_DEEP_TRIGGERS.test(userMessage || '');
}

/**
 * cycleAnswerMode — מחליף מצב אורך תשובה: auto → short → deep → auto.
 */
function cycleAnswerMode() {
    aiAnswerMode = aiAnswerMode === 'auto' ? 'short' : aiAnswerMode === 'short' ? 'deep' : 'auto';
    _updateAnswerModeChip();
    haptic('light');
}

function _updateAnswerModeChip() {
    const chip = document.getElementById('ai-answer-mode-chip');
    if (!chip) return;
    const label = { auto: 'אורך: אוטומטי', short: 'אורך: קצר', deep: 'אורך: מעמיק' }[aiAnswerMode];
    const labelEl = chip.querySelector('.ai-answer-mode-lbl');
    if (labelEl) labelEl.textContent = label;
    chip.classList.toggle('active', aiAnswerMode === 'deep');
}

/**
 * sendAIMessage — שולח הודעת משתמש ומקבל תשובה.
 */
async function sendAIMessage() {
    if (isAILoading) return;
    const input = document.getElementById('ai-chat-input');
    const sendBtn = document.getElementById('ai-send-btn');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const config = StorageManager.getAIConfig();
    if (!config.apiKey) {
        showAlert('לא הוגדר Gemini API Key. לך להגדרות ← AI Coach.');
        return;
    }

    // הצגת הודעת משתמש
    const container = document.getElementById('ai-chat-messages');
    // הסרת empty state אם קיים
    const empty = container.querySelector('.ai-empty-state');
    if (empty) empty.remove();

    container.appendChild(_createBubble('user', text));
    input.value = '';

    // הצגת typing indicator
    const typing = document.createElement('div');
    typing.className = 'ai-typing';
    typing.id = 'ai-typing-indicator';
    typing.innerHTML = '<div class="tdot"></div><div class="tdot"></div><div class="tdot"></div>';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;

    // נעילה
    isAILoading = true;
    if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = '0.5'; }

    try {
        const responseText = await callGeminiAPI(text);

        // עדכון זיכרון
        const now = Date.now();
        const userMsg  = { role: 'user',  text, timestamp: now, workoutWeek: state.week || null, workoutType: state.type || null };
        const modelMsg = { role: 'model', text: responseText, timestamp: now + 1, workoutWeek: state.week || null, workoutType: state.type || null };

        aiChatHistory.push({ role: 'user', text });
        aiChatHistory.push({ role: 'model', text: responseText });

        StorageManager.appendAIMessage(userMsg);
        StorageManager.appendAIMessage(modelMsg);

        // הצגת תשובה
        typing.remove();
        container.appendChild(_createBubble('model', responseText));

        // רענון זיכרון המאמן ברקע — לא חוסם, רץ רק כשנצבר מספיק
        _maybeUpdateCoachMemory();

    } catch(e) {
        typing.remove();
        console.error('GymPro AI error:', e.message);
        let errMsg = `שגיאה בתקשורת עם AI. נסה שוב. (${e.message})`;
        if (e.message === 'API_KEY_MISSING')   errMsg = 'API Key חסר. הגדר ב-הגדרות ← AI Coach.';
        if (e.message === 'ALL_MODELS_FAILED') errMsg = `כל המודלים נכשלו. פרטי שגיאה: ${e._details || 'לא ידוע'}`;
        if (e.message.includes('400') || e.message.includes('401') || e.message.includes('403')) errMsg = 'API Key שגוי או חסר הרשאות. בדוק את המפתח בהגדרות.';
        if (e.message.includes('404')) errMsg = 'מודל AI לא נמצא. בדוק את שם המודל בהגדרות ← AI Coach.';
        if (e.message.includes('500') || e.message.includes('503')) errMsg = 'שרת Gemini לא זמין. נסה שוב בעוד כמה דקות.';
        const errBubble = document.createElement('div');
        errBubble.className = 'ai-error-msg';
        errBubble.textContent = errMsg;
        container.appendChild(errBubble);
    } finally {
        isAILoading = false;
        if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }
        container.scrollTop = container.scrollHeight;
        haptic('light');
    }
}

/**
 * openAIPersonaSheet — פותח bottom sheet לעריכת פרופיל.
 */
function openAIPersonaSheet() {
    const textarea = document.getElementById('ai-persona-text');
    if (textarea) textarea.value = StorageManager.getAIPersona();
    document.getElementById('ai-persona-overlay').style.display = 'block';
    document.getElementById('ai-persona-sheet').classList.add('open');
    haptic('light');
}

function closeAIPersonaSheet() {
    document.getElementById('ai-persona-overlay').style.display = 'none';
    document.getElementById('ai-persona-sheet').classList.remove('open');
}

function saveAIPersona() {
    const textarea = document.getElementById('ai-persona-text');
    if (!textarea) return;
    StorageManager.saveAIPersona(textarea.value.trim());
    closeAIPersonaSheet();
    showAlert('הפרופיל נשמר!');
}

// ─── COACH PROMPTS EDITOR ──────────────────────────────────────────────────

function openCoachPromptsSheet() {
    const p = StorageManager.getCoachPrompts();
    const w = document.getElementById('coach-prompt-workout');
    const wk = document.getElementById('coach-prompt-week');
    const b = document.getElementById('coach-prompt-block');
    if (w) w.value = p.workout;
    if (wk) wk.value = p.week;
    if (b) b.value = p.block;
    document.getElementById('coach-prompts-overlay').style.display = 'block';
    document.getElementById('coach-prompts-sheet').classList.add('open');
}

function closeCoachPromptsSheet() {
    document.getElementById('coach-prompts-overlay').style.display = 'none';
    document.getElementById('coach-prompts-sheet').classList.remove('open');
}

function saveCoachPrompts() {
    const w  = document.getElementById('coach-prompt-workout');
    const wk = document.getElementById('coach-prompt-week');
    const b  = document.getElementById('coach-prompt-block');
    StorageManager.saveCoachPrompts({
        workout: w ? w.value.trim() : '',
        week:    wk ? wk.value.trim() : '',
        block:   b ? b.value.trim() : ''
    });
    if (typeof autoSaveConfigToCloud === 'function') autoSaveConfigToCloud();
    closeCoachPromptsSheet();
    showAlert('הפרומפטים נשמרו!');
}

function resetCoachPrompts() {
    StorageManager.resetCoachPrompts();
    const d = StorageManager.COACH_PROMPT_DEFAULTS;
    const w  = document.getElementById('coach-prompt-workout');
    const wk = document.getElementById('coach-prompt-week');
    const b  = document.getElementById('coach-prompt-block');
    if (w) w.value = d.workout;
    if (wk) wk.value = d.week;
    if (b) b.value = d.block;
    if (typeof autoSaveConfigToCloud === 'function') autoSaveConfigToCloud();
    showAlert('הפרומפטים שוחזרו לברירת מחדל.');
}

/**
 * toggleAICopyMenu — פותח/סוגר תפריט העתקה.
 */
function toggleAICopyMenu() {
    const menu = document.getElementById('ai-copy-menu');
    if (!menu) return;
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    haptic('light');
}

/**
 * copyAIHistory — מעתיק היסטוריית שיחה לפי mode ו-range.
 * mode: 'chat' | 'full'
 * range: 'week' | 'current_block' | 'two_blocks' | 'all'
 */
function copyAIHistory(mode, range) {
    const menu = document.getElementById('ai-copy-menu');
    if (menu) menu.style.display = 'none';

    let history = StorageManager.getAIHistory();
    if (!history.length) { showAlert('אין היסטוריית שיחות להעתקה.'); return; }

    // סינון לפי cutoff — הודעות שנוקו מהתצוגה לא יועתקו
    const cutoff = StorageManager.getAIDisplayCutoff();
    if (cutoff > 0) history = history.filter(m => (m.timestamp || 0) > cutoff);

    // סינון לפי טווח
    if (range && range !== 'all') {
        const now = Date.now();
        if (range === 'week') {
            const weekMs = 7 * 24 * 60 * 60 * 1000;
            history = history.filter(m => m.timestamp && (now - m.timestamp) <= weekMs);
        } else if (range === 'current_block') {
            const archive = StorageManager.getArchive();
            const currentStart = archive.findIndex(a => a.week === 1);
            if (currentStart !== -1) {
                const blockStartTs = archive[currentStart].timestamp;
                history = history.filter(m => m.timestamp && m.timestamp >= blockStartTs);
            }
        } else if (range === 'two_blocks') {
            const archive = StorageManager.getArchive();
            const currentStart = archive.findIndex(a => a.week === 1);
            const prevStart = currentStart !== -1
                ? archive.findIndex((a, i) => i > currentStart && a.week === 1)
                : -1;
            const refIdx = prevStart !== -1 ? prevStart : currentStart;
            if (refIdx !== -1) {
                const blockStartTs = archive[refIdx].timestamp;
                history = history.filter(m => m.timestamp && m.timestamp >= blockStartTs);
            }
        }
    }

    if (!history.length) { showAlert('אין הודעות בטווח שנבחר.'); return; }

    const dateStr = new Date().toLocaleDateString('he-IL');
    let text = '';

    if (mode === 'full') {
        text += `=== GYMPRO AI Coach — הקשר מלא ===\nתאריך: ${dateStr}\n\n`;
        text += buildSystemPrompt();
        text += `\n\n=== היסטוריית שיחה ===\n`;
    } else {
        text += `=== AI Coach — שיחה ===\nתאריך: ${dateStr}\n\n`;
    }

    history.forEach(m => {
        const label = m.role === 'user' ? '[אתה]' : '[AI Coach]';
        text += `${label} ${m.text}\n\n`;
    });

    if (mode === 'full') text += `\n=== סוף הקשר ===\nהדבק הודעה זו בתחילת שיחה חדשה עם Claude / ChatGPT / Gemini להמשכיות מלאה.`;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            haptic('success');
            showAlert(mode === 'full' ? 'הקשר מלא הועתק!' : 'השיחה הועתקה!');
        });
    } else {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
        showAlert(mode === 'full' ? 'הקשר מלא הועתק!' : 'השיחה הועתקה!');
    }
}

/**
 * saveAISettings — שומר הגדרות AI מתוך ui-settings.
 */
function saveAISettings() {
    const keyInput    = document.getElementById('ai-api-key-input');
    const modelsInput = document.getElementById('ai-models-input');
    if (!keyInput || !modelsInput) return;
    StorageManager.saveAIConfig(keyInput.value.trim(), modelsInput.value);
    updateAIStatus();
    showAlert('הגדרות AI נשמרו!');
}

// ─── גשר תזונה MyFitnessPal (Apps Script) ────────────────────────────────────
function saveMfpBridgeSettings() {
    const urlInput   = document.getElementById('mfp-bridge-url-input');
    const tokenInput = document.getElementById('mfp-bridge-token-input');
    if (!urlInput || !tokenInput) return;
    const on = !!(document.getElementById('mfp-bridge-toggle') || {}).checked;
    StorageManager.saveMfpBridge(on, urlInput.value.trim(), tokenInput.value.trim());
    updateMfpBridgeStatus();
    showAlert('הגדרות גשר התזונה נשמרו!');
}

function updateMfpBridgeStatus() {
    const el = document.getElementById('mfp-bridge-status');
    const tg = document.getElementById('mfp-bridge-toggle');
    if (tg) tg.checked = StorageManager.isMfpBridgeOn();
    if (!el) return;
    const { url, token } = StorageManager.getMfpBridge();
    if (url) {
        el.innerHTML = '<span style="color:var(--type-b);font-weight:700;">&#9679; גשר מוגדר</span>';
        const ui = document.getElementById('mfp-bridge-url-input');
        const ti = document.getElementById('mfp-bridge-token-input');
        if (ui && !ui.value) ui.value = url;
        if (ti && !ti.value) ti.value = token;
    } else {
        el.innerHTML = '<span style="color:var(--text-dim);">&#9679; לא מוגדר</span>';
    }
}

// ─── גשר גיבוי שבועי לאימייל (Apps Script) ──────────────────────────────────
function saveBackupBridgeSettings() {
    const urlInput   = document.getElementById('backup-bridge-url-input');
    const tokenInput = document.getElementById('backup-bridge-token-input');
    if (!urlInput || !tokenInput) return;
    const on = !!(document.getElementById('backup-bridge-toggle') || {}).checked;
    StorageManager.saveBackupBridge(on, urlInput.value.trim(), tokenInput.value.trim());
    updateBackupBridgeStatus();
    showAlert('הגדרות גשר הגיבוי נשמרו!');
}

function sendBackupNow() {
    StorageManager.maybeSendWeeklyBackup(true).then(ok => { if (ok) updateBackupBridgeStatus(); });
}

function updateBackupBridgeStatus() {
    const el = document.getElementById('backup-bridge-status');
    const tg = document.getElementById('backup-bridge-toggle');
    const { on, url, token } = StorageManager.getBackupBridge();
    if (tg) tg.checked = on;
    if (!el) return;
    if (url) {
        const last = StorageManager.getBackupLast();
        const lastTxt = last ? ' · נשלח לאחרונה ' + new Date(last).toLocaleDateString('he-IL') + ' ' +
            new Date(last).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : ' · טרם נשלח';
        el.innerHTML = '<span style="color:var(--type-b);font-weight:700;">&#9679; גשר מוגדר</span><span style="color:var(--text-dim);">' + lastTxt + '</span>';
        const ui = document.getElementById('backup-bridge-url-input');
        const ti = document.getElementById('backup-bridge-token-input');
        if (ui && !ui.value) ui.value = url;
        if (ti && !ti.value) ti.value = token;
    } else {
        el.innerHTML = '<span style="color:var(--text-dim);">&#9679; לא מוגדר</span>';
    }
}

// ─── גשר ווידג'ט אייפון (Apps Script + Scriptable) ──────────────────────────
function saveWidgetBridgeSettings() {
    const urlInput   = document.getElementById('widget-bridge-url-input');
    const tokenInput = document.getElementById('widget-bridge-token-input');
    if (!urlInput || !tokenInput) return;
    const on = !!(document.getElementById('widget-bridge-toggle') || {}).checked;
    StorageManager.saveWidgetBridge(on, urlInput.value.trim(), tokenInput.value.trim());
    updateWidgetBridgeStatus();
    showAlert('הגדרות גשר הווידג\'ט נשמרו!');
}

function pushWidgetNow() {
    StorageManager.maybePushWidgetSnapshot(true).then(ok => { if (ok) updateWidgetBridgeStatus(); });
}

function updateWidgetBridgeStatus() {
    const el = document.getElementById('widget-bridge-status');
    const tg = document.getElementById('widget-bridge-toggle');
    const { on, url, token } = StorageManager.getWidgetBridge();
    if (tg) tg.checked = on;
    if (!el) return;
    if (url) {
        const last = StorageManager.getWidgetLastPush();
        const lastTxt = last ? ' · נדחף לאחרונה ' + new Date(last).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : ' · טרם נדחף';
        el.innerHTML = '<span style="color:var(--type-b);font-weight:700;">&#9679; גשר מוגדר</span><span style="color:var(--text-dim);">' + lastTxt + '</span>';
        const ui = document.getElementById('widget-bridge-url-input');
        const ti = document.getElementById('widget-bridge-token-input');
        if (ui && !ui.value) ui.value = url;
        if (ti && !ti.value) ti.value = token;
    } else {
        el.innerHTML = '<span style="color:var(--text-dim);">&#9679; לא מוגדר</span>';
    }
}

// ─── גשר תמונות התקדמות (Apps Script → Google Drive) ────────────────────────
function savePhotoBridgeSettings() {
    const urlInput   = document.getElementById('photo-bridge-url-input');
    const tokenInput = document.getElementById('photo-bridge-token-input');
    if (!urlInput || !tokenInput) return;
    const on = !!(document.getElementById('photo-bridge-toggle') || {}).checked;
    StorageManager.savePhotoBridge(on, urlInput.value.trim(), tokenInput.value.trim());
    updatePhotoBridgeStatus();
    if (on && typeof _ppKickUploads === 'function') _ppKickUploads();   // העלאת ממתינות מיד עם ההפעלה
    showAlert('הגדרות גשר התמונות נשמרו!');
}

function testPhotoBridgeNow() {
    if (typeof ppTestPhotoBridge !== 'function') return;
    ppTestPhotoBridge()
        .then(res => showAlert('הגשר מחובר! תיקייה: "' + res.folder + '" · ' + res.files + ' תמונות בדרייב.'))
        .catch(e => showAlert('בדיקת הגשר נכשלה: ' + (e && e.message ? e.message : 'שגיאת רשת') + '. בדוק את ה-URL, ה-token ופריסת הסקריפט.'));
}

function scanPhotoDriveNow() {
    if (typeof ppReconcileFromDrive !== 'function') return;
    ppReconcileFromDrive()
        .then(r => {
            showAlert('הסריקה הושלמה: ' + r.added + ' תמונות נוספו לאינדקס, ' + r.linked + ' קושרו מחדש. סה"כ ' + r.total + '.');
            if (typeof _renderBodyPhotos === 'function') _renderBodyPhotos();
        })
        .catch(e => showAlert('הסריקה נכשלה: ' + (e && e.message ? e.message : 'שגיאת רשת')));
}

function updatePhotoBridgeStatus() {
    const el = document.getElementById('photo-bridge-status');
    const tg = document.getElementById('photo-bridge-toggle');
    const { on, url, token } = StorageManager.getPhotoBridge();
    if (tg) tg.checked = on;
    if (!el) return;
    if (url) {
        const pending = StorageManager.getPhotoIndex().filter(e => !e.driveId).length;
        const pendTxt = pending ? ' · ' + pending + ' ממתינות להעלאה' : ' · הכל בענן';
        el.innerHTML = '<span style="color:var(--type-b);font-weight:700;">&#9679; גשר מוגדר</span><span style="color:var(--text-dim);">' + pendTxt + '</span>';
        const ui = document.getElementById('photo-bridge-url-input');
        const ti = document.getElementById('photo-bridge-token-input');
        if (ui && !ui.value) ui.value = url;
        if (ti && !ti.value) ti.value = token;
    } else {
        el.innerHTML = '<span style="color:var(--text-dim);">&#9679; לא מוגדר</span>';
    }
}

// ─── גשר תזונה Apple Health (Shortcuts → Apps Script) ───────────────────────
function saveHealthBridgeSettings() {
    const urlInput   = document.getElementById('health-bridge-url-input');
    const tokenInput = document.getElementById('health-bridge-token-input');
    if (!urlInput || !tokenInput) return;
    const on = !!(document.getElementById('health-bridge-toggle') || {}).checked;
    StorageManager.saveHealthBridge(on, urlInput.value.trim(), tokenInput.value.trim());
    updateHealthBridgeStatus();
    showAlert('הגדרות גשר ה-Health נשמרו!');
    if (on) syncHealthNutrition(true); // משיכה מיידית — פידבק מהיר שהחיבור עובד (רק אם דלוק)
}

function updateHealthBridgeStatus() {
    const el = document.getElementById('health-bridge-status');
    const tg = document.getElementById('health-bridge-toggle');
    if (tg) tg.checked = StorageManager.isHealthBridgeOn();
    if (!el) return;
    const { url, token } = StorageManager.getHealthBridge();
    if (url) {
        el.innerHTML = '<span style="color:var(--type-b);font-weight:700;">&#9679; גשר מוגדר</span>';
        const ui = document.getElementById('health-bridge-url-input');
        const ti = document.getElementById('health-bridge-token-input');
        if (ui && !ui.value) ui.value = url;
        if (ti && !ti.value) ti.value = token;
    } else {
        el.innerHTML = '<span style="color:var(--text-dim);">&#9679; לא מוגדר</span>';
    }
}

/**
 * syncHealthNutrition — מושך ימי תזונה מגשר ה-Health וממזג ל-nutritionDaily.
 * MFP = מקור האמת: המיזוג (mergeHealthNutritionDays) לעולם לא דורס יום MFP.
 * manual=false (אוטומטי): שקט לחלוטין + throttle של 15 דקות בין משיכות.
 */
let _healthSyncLast = 0;
const HEALTH_SYNC_THROTTLE_MS = 15 * 60 * 1000;

async function syncHealthNutrition(manual = false, force = false) {
    if (!StorageManager.isHealthBridgeOn()) {
        if (manual) showAlert('גשר ה-Health כבוי — הפעל אותו בהגדרות → "גשר תזונה Apple Health".');
        return;
    }
    const { url, token } = StorageManager.getHealthBridge();
    if (!url) {
        if (manual) showAlert('יש להגדיר קודם את גשר ה-Health בהגדרות → "גשר תזונה Apple Health".');
        return;
    }
    const now = Date.now();
    // force (כניסה לפרונט) עוקף את ה-throttle של 15 דק' — אך שומר מרווח 4ש' נגד ירי כפול
    // (visibilitychange עלול לירות פעמיים). אוטומטי רגיל (שעתי) נשאר עם throttle מלא.
    if (!manual) {
        const minGap = force ? 4000 : HEALTH_SYNC_THROTTLE_MS;
        if (now - _healthSyncLast < minGap) return;
    }
    _healthSyncLast = now;

    if (manual) showCloudToast('⏳ מושך תזונה מ-Health…', true);
    try {
        const data = await _jsonpRequest(url, token, 30000);
        if (!data || data.ok !== true) {
            throw new Error(data && data.error === 'BAD_TOKEN' ? 'token שגוי — בדוק את ההגדרות.' : ((data && data.error) || 'שגיאה לא ידועה מהגשר.'));
        }
        const days = Array.isArray(data.days) ? data.days : [];
        if (!days.length) {
            if (manual) showCloudToast('הגשר ריק — ודא שהקיצור רץ לפחות פעם אחת', true);
            return;
        }
        StorageManager.setHealthLastSync(Date.now()); // משיכה מוצלחת עם נתונים — לחותמת בכרטיס היומי
        const changed = StorageManager.mergeHealthNutritionDays(days);
        if (changed > 0 || manual) {
            const blScreen = document.getElementById('ui-bodylog');
            if (typeof renderBodyLog === 'function' && blScreen && blScreen.classList.contains('active')) renderBodyLog();
            if (typeof renderHomeTodayCards === 'function') renderHomeTodayCards();
        }
        if (changed > 0) {
            if (typeof FirebaseManager !== 'undefined') {
                FirebaseManager.saveConfigToCloud()
                    .then(ok => notifyCloudSaveFailure(ok, 'config', 'גיבוי תזונה לענן'))
                    .catch(() => {});
            }
            showCloudToast(`✅ עודכנו ${changed} ימי תזונה מ-Health`, true);
        } else if (manual) {
            showCloudToast('הנתונים כבר מעודכנים', true);
        }
    } catch (e) {
        console.warn('GymPro: health nutrition sync failed', e);
        if (manual) showCloudToast('⚠️ ' + e.message, false);
    }
}

// תזמון שעתי — משיכה בכל שעה עגולה כל עוד האפליקציה פתוחה (PWA לא רץ ברקע,
// אז setTimeout פשוט לא יורה כשהאפליקציה סגורה — אין צורך בניקוי)
function _scheduleHealthHourlySync() {
    const msToNextHour = 3600000 - (Date.now() % 3600000) + 5000; // +5ש' מרווח ביטחון
    setTimeout(() => {
        syncHealthNutrition(false);
        _scheduleHealthHourlySync();
    }, msToNextHour);
}

// ─── גשר אפל-ווטש ────────────────────────────────────────────────────────────
function saveWatchBridgeSettings() {
    const on    = !!(document.getElementById('watch-bridge-toggle') || {}).checked;
    const url   = ((document.getElementById('watch-bridge-url-input')   || {}).value || '').trim();
    const token = ((document.getElementById('watch-bridge-token-input') || {}).value || '').trim();
    StorageManager.saveWatchBridge(on, url, token);
    // הפעלה/כיבוי מיידי של ההאזנה
    try {
        if (on && WatchBridge.enabled()) { WatchBridge.activate(); WatchBridge.forceAdopt(); }
        else WatchBridge.stopListening();
    } catch (e) {}
    showAlert('הגדרות גשר השעון נשמרו!');
}

function updateWatchBridgeStatus() {
    const cfg = StorageManager.getWatchBridge();
    const t = document.getElementById('watch-bridge-toggle');
    const ui = document.getElementById('watch-bridge-url-input');
    const ti = document.getElementById('watch-bridge-token-input');
    if (t)  t.checked = cfg.on;
    if (ui && !ui.value) ui.value = cfg.url;
    if (ti && !ti.value) ti.value = cfg.token;
}

// ─── פרופיל גוף (TDEE) ───────────────────────────────────────────────────────
function saveBodyProfileSettings() {
    const sex = (document.getElementById('bp-sex-input') || {}).value || '';
    const ageRaw = (document.getElementById('bp-age-input') || {}).value || '';
    const hRaw = (document.getElementById('bp-height-input') || {}).value || '';
    const activity = (document.getElementById('bp-activity-input') || {}).value || 'moderate';
    const age = ageRaw === '' ? null : parseInt(ageRaw, 10);
    const height = hRaw === '' ? null : parseFloat(hRaw);
    if (age != null && (!(age > 0) || age > 120)) { showAlert('גיל לא תקין.'); return; }
    if (height != null && (!(height > 80) || height > 250)) { showAlert('גובה לא תקין (ס"מ).'); return; }
    StorageManager.saveBodyProfile({ sex, age, height, activity });
    if (typeof FirebaseManager !== 'undefined') {
        FirebaseManager.saveConfigToCloud()
            .then(ok => notifyCloudSaveFailure(ok, 'config', 'גיבוי פרופיל לענן'))
            .catch(() => {});
    }
    if (typeof _renderTdeeCard === 'function') _renderTdeeCard();
    showAlert('פרופיל הגוף נשמר!');
}

function updateBodyProfileStatus() {
    const p = StorageManager.getBodyProfile();
    const set = (id, v) => { const el = document.getElementById(id); if (el && (el.value === '' || el.value == null)) el.value = v; };
    if (p.sex) set('bp-sex-input', p.sex);
    if (p.age != null) set('bp-age-input', p.age);
    if (p.height != null) set('bp-height-input', p.height);
    const act = document.getElementById('bp-activity-input');
    if (act && p.activity) act.value = p.activity;
}

/**
 * importNutritionFromGmail — מושך את ייצוא ה-MyFitnessPal האחרון דרך הגשר,
 * מאחסן את הנתונים היומיים ומרענן את כרטיס התזונה במסך Composition.
 */
async function importNutritionFromGmail() {
    if (!StorageManager.isMfpBridgeOn()) {
        showAlert('גשר MFP כבוי — הפעל אותו בהגדרות → "ייבוא תזונה (MyFitnessPal)".');
        return;
    }
    const { url, token } = StorageManager.getMfpBridge();
    if (!url) {
        showAlert('יש להגדיר קודם את כתובת הגשר (Apps Script) בהגדרות → "ייבוא תזונה".');
        if (typeof openSettings === 'function') openSettings();
        return;
    }
    haptic('light');
    showCloudToast('⏳ מושך תזונה מ-Gmail…', true);
    try {
        // JSONP במקום fetch — Apps Script עושה redirect ל-googleusercontent ללא
        // כותרות CORS, כך ש-fetch חוצה-מקור תמיד נכשל. <script> אינו כפוף ל-CORS.
        const data = await _jsonpRequest(url, token);
        if (!data || data.ok !== true) {
            const msgs = {
                BAD_TOKEN:        'token שגוי — בדוק את ההגדרות.',
                NO_EXPORT_EMAIL:  'לא נמצא מייל ייצוא מ-MyFitnessPal.',
                NO_DOWNLOAD_LINK: 'לא נמצא קישור הורדה במייל.',
                LINK_EXPIRED:     'קישור ההורדה פג תוקף — בקש ייצוא חדש ב-MyFitnessPal.',
                NO_NUTRITION_CSV: 'הייצוא לא הכיל קובץ תזונה.'
            };
            throw new Error(msgs[data && data.error] || (data && data.error) || 'שגיאה לא ידועה מהגשר.');
        }
        const days = Array.isArray(data.days) ? data.days : [];
        if (!days.length) throw new Error('הייצוא לא הכיל ימי תזונה.');
        // בקרת דריסה: אם יש ימים קיימים ששונים מהנכנס — לשאול אילו לדרוס לפני שמירה
        const conflicts = StorageManager.mfpConflicts(days);
        if (conflicts.length) {
            _pendingMfpImport = { days, rawCsv: data.rawCsv || '', conflicts };
            _showMfpConflictDialog(conflicts);
            showCloudToast(`נמצאו ${conflicts.length} ימים קיימים — בחר אילו לדרוס`, true);
        } else {
            _applyMfpImport(days, data.rawCsv || '', null, []);
            showCloudToast(`✅ יובאו ${days.length} ימי תזונה`, true);
        }
    } catch (e) {
        console.error('GymPro: nutrition import error', e);
        showCloudToast('⚠️ ' + e.message, false);
    }
}

// ── דיאלוג דריסה בייבוא MFP ───────────────────────────────────────────
let _pendingMfpImport = null;

// _applyMfpImport — מחיל ימי MFP. overwriteSet=Set תאריכים לדריסה (null=הכל).
// conflicts = רשימת ההתנגשויות (לסינון ה-raw לימים שלא נדרסו).
function _applyMfpImport(days, rawCsv, overwriteSet, conflicts) {
    StorageManager.applyMfpDays(days, overwriteSet);
    // הקובץ הגולמי (per-meal): לדלג על ימי התנגשות שלא אושרו לדריסה
    if (rawCsv && typeof _parseRawNutrition === 'function') {
        const raw = _parseRawNutrition(rawCsv);
        if (raw) {
            if (overwriteSet && conflicts && conflicts.length) {
                const skip = new Set(conflicts.filter(c => !overwriteSet.has(c.date)).map(c => c.date));
                const di = raw.dateIdx != null ? raw.dateIdx : 0;
                raw.rows = raw.rows.filter(r => !skip.has(String(r[di] || '').trim()));
            }
            if (raw.rows.length) StorageManager.saveNutritionRaw(raw);
        }
    }
    if (typeof renderBodyLog === 'function') renderBodyLog();
    if (typeof renderHomeTodayCards === 'function') renderHomeTodayCards();
    if (typeof FirebaseManager !== 'undefined') {
        FirebaseManager.saveConfigToCloud()
            .then(ok => notifyCloudSaveFailure(ok, 'config', 'גיבוי תזונה לענן'))
            .catch(() => {});
        FirebaseManager.saveNutritionRawToCloud()
            .then(ok => notifyCloudSaveFailure(ok, 'raw', 'גיבוי קובץ MFP לענן'))
            .catch(() => {});
    }
}

function _mfpSrcLabel(d) {
    if (!d) return '';
    return d.src === 'health' ? 'Health' : d.src === 'app' ? 'תיעוד ידני' : 'MFP';
}

function _showMfpConflictDialog(conflicts) {
    const modal = document.getElementById('mfp-conflict-modal');
    const list = document.getElementById('mfp-conflict-list');
    if (!modal || !list) return;
    // ברירת מחדל מסומן: ימי MFP (re-import). ימי app/health (ידני) לא מסומנים — הגנה על תיעוד פנימי
    list.innerHTML = conflicts.map(c => {
        const src = c.existing.src;
        const checked = (src == null || src === 'mfp') ? 'checked' : '';
        const ex = Math.round(c.existing.calories || 0), nw = Math.round(c.incoming.calories || 0);
        return `<label class="mfp-conf-row">
            <input type="checkbox" class="mfp-conf-cb" value="${c.date}" ${checked}>
            <span class="mfp-conf-info">
                <span class="mfp-conf-date">${c.date}</span>
                <span class="mfp-conf-vals">קיים: ${ex} kcal (${_mfpSrcLabel(c.existing)}) ← חדש: ${nw} kcal</span>
            </span>
        </label>`;
    }).join('');
    modal.style.display = 'flex';
}

function mfpConflictSelectAll(on) {
    document.querySelectorAll('#mfp-conflict-list .mfp-conf-cb').forEach(cb => { cb.checked = on; });
}

function closeMfpConflict() {
    const modal = document.getElementById('mfp-conflict-modal');
    if (modal) modal.style.display = 'none';
    _pendingMfpImport = null;
}

// confirmMfpOverwrite — מחיל: ימים חדשים + ימי ההתנגשות שסומנו. שאר ההתנגשויות נשמרות כפי שהן.
function confirmMfpOverwrite() {
    if (!_pendingMfpImport) { closeMfpConflict(); return; }
    const set = new Set();
    document.querySelectorAll('#mfp-conflict-list .mfp-conf-cb:checked').forEach(cb => set.add(cb.value));
    const { days, rawCsv, conflicts } = _pendingMfpImport;
    _applyMfpImport(days, rawCsv, set, conflicts);
    const total = days.length, overwritten = set.size, kept = conflicts.length - overwritten;
    if (typeof showCloudToast === 'function') showCloudToast(`✅ יובאו ${total} ימים · נדרסו ${overwritten} · נשמרו ${kept}`, true);
    closeMfpConflict();
    haptic('medium');
}

/**
 * _jsonpRequest — קורא ל-Apps Script דרך JSONP (הזרקת <script>) כדי לעקוף CORS.
 * הגשר מחזיר callback(<json>) כשמועבר פרמטר callback. כולל timeout וניקוי.
 */
function _jsonpRequest(url, token, timeoutMs = 90000) {
    return new Promise((resolve, reject) => {
        const cb = '_mfpCb' + Date.now() + Math.floor(Math.random() * 1e4);
        const script = document.createElement('script');
        let done = false;
        const cleanup = () => {
            clearTimeout(timer);
            if (script.parentNode) script.parentNode.removeChild(script);
            try { delete window[cb]; } catch (_) { window[cb] = undefined; }
        };
        const timer = setTimeout(() => {
            if (done) return; done = true; cleanup();
            reject(new Error('פסק זמן — הגשר לא הגיב (ייתכן שהייצוא גדול, נסה שוב).'));
        }, timeoutMs);
        window[cb] = (data) => { if (done) return; done = true; cleanup(); resolve(data); };
        script.onerror = () => {
            if (done) return; done = true; cleanup();
            reject(new Error('נכשלה הפנייה לגשר — בדוק את ה-URL וההרשאות.'));
        };
        const sep = url.includes('?') ? '&' : '?';
        script.src = `${url}${sep}token=${encodeURIComponent(token)}&callback=${cb}`;
        document.body.appendChild(script);
    });
}

/**
 * updateAIStatus — מעדכן שורת סטטוס AI בהגדרות.
 */
function updateAIStatus() {
    const el = document.getElementById('ai-status');
    if (!el) return;
    const config = StorageManager.getAIConfig();
    if (config.apiKey) {
        el.innerHTML = `<span style="color:var(--type-b);font-weight:700;">&#9679; מפתח מוגדר</span> <span style="color:var(--text-dim);font-size:0.85em;">${config.models[0]}</span>`;
        // מילוי שדות
        const ki = document.getElementById('ai-api-key-input');
        const mi = document.getElementById('ai-models-input');
        if (ki && !ki.value) ki.value = config.apiKey;
        if (mi && !mi.value) mi.value = config.models.join(', ');
    } else {
        el.innerHTML = '<span style="color:var(--text-dim);">&#9679; לא מוגדר</span>';
    }
    // מילוי שדה מפתח USDA (שכבת מזון נוספת)
    const uk = document.getElementById('usda-key-input');
    if (uk && !uk.value) uk.value = StorageManager.getUsdaKey();
}

// saveUsdaKey — שמירת מפתח USDA FoodData Central (אופציונלי, מקומי בלבד)
function saveUsdaKey() {
    const el = document.getElementById('usda-key-input');
    if (!el) return;
    StorageManager.saveUsdaKey(el.value);
    haptic('light');
    showAlert(el.value.trim() ? 'מפתח USDA נשמר. חיפוש המזון יכלול עכשיו חומרי גלם מ-USDA.' : 'מפתח USDA נמחק.');
}

/**
 * handleAIOverlayClick — סוגר copy menu בלחיצה מחוץ לו, לא סוגר את המודל.
 */
function handleAIOverlayClick(e) {
    if (e.target === document.getElementById('ai-coach-modal')) {
        const menu = document.getElementById('ai-copy-menu');
        if (menu) menu.style.display = 'none';
    }
}

/**
 * clearAIHistory — מוחק היסטוריית שיחות עם אישור.
 */
function clearAIHistory() {
    showConfirm('למחוק את כל היסטוריית השיחות? פעולה בלתי הפיכה.', () => {
        StorageManager.clearAIHistory();
        aiChatHistory = [];
        showAlert('ההיסטוריה נמחקה.');
    });
}

// ════════════════════════════════════════════════════════════════════
// ─── SPRINT 4 — WORKOUT LIVE VIEW ───────────────────────────────────
// ════════════════════════════════════════════════════════════════════

let _liveTouchStartX = 0;
let _liveTouchStartY = 0;
let _liveTouchActive = false;
let _liveSwipeAttached = false;
// כשהמשתמש לחץ X באופן מפורש — לא לאוטומציה את ה-launch מחדש עד שיתחיל אימון חדש
// (מתאפס ב-navigate('ui-week'))
let _liveModeSuppressed = false;

function isLiveModeEnabled() {
    if (typeof getAnalyticsPrefs !== 'function') return false;
    return !!getAnalyticsPrefs().liveMode;
}

async function enterWorkoutLiveMode() {
    const overlay = document.getElementById('workout-live-overlay');
    if (!overlay || overlay.style.display === 'flex') return;
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('live-mode-active');

    // Wake lock — שומר את המסך דלוק (רכישה חוזרת אחרי רקע מטופלת ב-visibilitychange)
    await _acquireWakeLock();

    // Fullscreen — באייפון Safari לרוב נכשל בלי gesture, נסבול בשקט
    try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen(); } catch (e) {}

    updateLiveViewContent();
    _attachLiveSwipe();
    _syncLiveResumeBtn();
    haptic('light');
}

async function exitWorkoutLiveMode(silent = false) {
    const overlay = document.getElementById('workout-live-overlay');
    if (!overlay || overlay.style.display === 'none') return;
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('live-mode-active');

    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (e) {}
    // שחרור ה-lock ביציאה — אלא אם הצלילים דולקים (הם מחזיקים lock משלהם בכוונה)
    if (!soundEnabled) _releaseWakeLock();
    if (!silent) {
        // יציאה מפורשת ע"י המשתמש — מסמן שהוא רוצה את המסך הקלאסי לכל האימון הזה
        _liveModeSuppressed = true;
        haptic('light');
    }
    _syncLiveResumeBtn();
}

// Helper שמופעל מהכפתור "המשך לתרגיל הבא" בתוך ה-Live View
function _liveContinueExercise() {
    if (typeof finishCurrentExercise === 'function') {
        finishCurrentExercise();
        setTimeout(updateLiveViewContent, 80);
    }
}

// כפתור "חזור ל-Live" ב-ui-main — מנקה suppression וחוזר לתצוגה הענקית
function _resumeLiveMode() {
    _liveModeSuppressed = false;
    enterWorkoutLiveMode();
}

// סנכרון הצגת הכפתור הירוק ב-ui-main — מופיע רק כש-liveMode דלוק
// ובאופן אקטיבי המשתמש מחוץ ל-overlay
function _syncLiveResumeBtn() {
    const btn = document.getElementById('live-resume-btn');
    if (!btn) return;
    const show = isLiveModeEnabled() && !document.body.classList.contains('live-mode-active');
    btn.style.display = show ? 'inline-flex' : 'none';
}

// ─── Live Edit Sheet — עריכת weight/reps/RIR ממסך הטיימר ─────────────
// _syncLiveWeightModeUI — מסנכרן את כרטיס המשקל ב-sheet של ה-Live לשיטת המשקל:
// תווית (לחיצה מחליפה שיטה), יחידה, והסתרת +/- במשקל גוף — מקביל ל-initPickers במסך המפורט
function _syncLiveWeightModeUI() {
    const mode = _effWeightMode();
    const lbl = document.getElementById('live-weight-mode-lbl');
    if (lbl) lbl.textContent = (mode === 'bw' ? 'משקל גוף' : mode === 'plates' ? 'פלטות' : 'משקל') + ' ⇄';
    const unit = document.getElementById('live-edit-weight-unit');
    if (unit) unit.textContent = mode === 'bw' ? ' ' : mode === 'plates' ? 'יח׳ (×2.5 ק"ג)' : 'ק"ג';
    const pmRow = document.getElementById('live-weight-pm-row');
    if (pmRow) pmRow.style.visibility = mode === 'bw' ? 'hidden' : 'visible';
}

function openLiveEditSheet() {
    if (!document.body.classList.contains('live-mode-active')) return;
    const overlay = document.getElementById('live-edit-overlay');
    const sheet = document.getElementById('live-edit-sheet');
    if (!overlay || !sheet) return;
    overlay.style.display = 'block';
    requestAnimationFrame(() => sheet.classList.add('open'));
    _syncLiveEditSheetDisplays();
    _syncLiveWeightModeUI();
    // טען את ההערה הנוכחית מ-set-notes (מקור האמת) לתוך השדה ב-sheet
    const mainNotes = document.getElementById('set-notes');
    const liveNotes = document.getElementById('live-edit-notes');
    if (mainNotes && liveNotes) liveNotes.value = mainNotes.value || '';
    // הסתר את LOG SET כשהסט האחרון כבר נרשם (action panel פעיל) — אחרת ניצור log כפול
    const logBtn = document.getElementById('live-edit-log-btn');
    if (logBtn) {
        const ap = document.getElementById('action-panel');
        const apVisible = !!(ap && ap.style.display === 'block');
        logBtn.style.display = apVisible ? 'none' : 'block';
    }
    haptic('light');
}

// מסנכרן הקלדה ב-Live Edit Sheet חזרה ל-set-notes (שהוא ה-source שנקרא ב-nextStep)
function _syncLiveNoteToMain() {
    const mainNotes = document.getElementById('set-notes');
    const liveNotes = document.getElementById('live-edit-notes');
    if (mainNotes && liveNotes) mainNotes.value = liveNotes.value;
}

// רישום סט ישירות מתוך ה-Live Edit Sheet — חוסך את המסע sheet → close → swipe.
// סוגר את ה-sheet, מפעיל nextStep (אותה לוגיקה כמו swipe), ומרענן את ה-Live view.
function _liveLogSetFromSheet() {
    const ap = document.getElementById('action-panel');
    const apVisible = !!(ap && ap.style.display === 'block');
    if (apVisible) return;  // הגנה כפולה — לא רושמים אחרי שכבר נרשם הסט האחרון
    closeLiveEditSheet();
    haptic('success');
    if (typeof nextStep === 'function') {
        nextStep();
        // ה-sheet נסגר ~300ms; updateLiveViewContent מסונכרן ע"י initPickers/nextStep, אבל ביטוח קצר
        setTimeout(updateLiveViewContent, 80);
    }
}

function closeLiveEditSheet() {
    const overlay = document.getElementById('live-edit-overlay');
    const sheet = document.getElementById('live-edit-sheet');
    if (!overlay || !sheet) return;
    sheet.classList.remove('open');
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
    haptic('light');
}

// קורא את ערכי ה-pickers הקלאסיים ומציג אותם בתוך ה-sheet
function _syncLiveEditSheetDisplays() {
    ['weight', 'reps', 'rir'].forEach(field => {
        const picker = document.getElementById(field + '-picker');
        const disp = document.getElementById('live-edit-' + field + '-disp');
        if (!picker || !disp) return;
        const opt = picker.options[picker.selectedIndex];
        const raw = (opt && opt.text) || picker.value || '—';
        disp.textContent = raw.replace(' kg', '');
    });
}

// +/- מתוך ה-sheet — מפעיל את stepPicker הקיים ומסנכרן את כל התצוגות
function _liveStepPicker(field, dir) {
    if (typeof stepPicker === 'function') stepPicker(field, dir);
    _syncLiveEditSheetDisplays();
    updateLiveViewContent();
}

// לחיצה על המספר ב-sheet "ערוך סט נוכחי" — הקלדת ערך חופשי, כמו בפיקרים הראשיים
function editLivePickerValue(field) {
    if (field === 'weight' && _effWeightMode() === 'bw') return; // משקל גוף — אין ערך לערוך
    const disp = document.getElementById('live-edit-' + field + '-disp');
    if (!disp || disp.querySelector('input')) return;

    const current = disp.textContent.trim();
    const startVal = current === 'Fail' ? '0' : current.replace(/[^\d.]/g, '');

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.className = 'stepper-edit-input live-edit-input';
    input.value = startVal;
    if (field === 'reps') { input.step = '1'; input.min = '1'; }
    else { input.step = '0.5'; input.min = '0'; }

    disp.textContent = '';
    disp.appendChild(input);
    input.focus();
    input.select();

    const finish = (commit) => {
        if (input._done) return;
        input._done = true;
        if (commit && input.value !== '') commitCustomValue(field, input.value);
        _syncLiveEditSheetDisplays();
        updateLiveViewContent();
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
}

// קורא לנתוני state ומסנכרן את ה-DOM של ה-overlay
function updateLiveViewContent() {
    if (!document.body.classList.contains('live-mode-active')) return;

    const setN = (state.setIdx || 0) + 1;
    const setTotal = (state.currentEx && state.currentEx.sets) ? state.currentEx.sets.length : 1;
    const counterEl = document.getElementById('live-set-counter');
    if (counterEl) counterEl.textContent = `SET ${setN}/${setTotal}`;

    const nameEl = document.getElementById('live-ex-name');
    if (nameEl) nameEl.textContent = state.currentExName || '—';

    // היעד לסט הבא — נשען על ה-pickers ב-ui-main (שהם source-of-truth לערכים)
    const wPicker = document.getElementById('weight-picker');
    const rPicker = document.getElementById('reps-picker');
    const rirPicker = document.getElementById('rir-picker');
    const targetW = wPicker && wPicker.value !== '' ? wPicker.value : '—';
    const targetR = rPicker && rPicker.value !== '' ? rPicker.value : '—';
    const targetRir = rirPicker && rirPicker.value !== '' ? rirPicker.value : '—';

    const targetEl = document.getElementById('live-target-val');
    if (targetEl) {
        const liveMode = _effWeightMode();
        const wPart = liveMode === 'bw' ? 'BW' :
                      liveMode === 'plates' ? `${targetW}<small>פלטות</small>` :
                      `${targetW}<small>kg</small>`;
        targetEl.innerHTML = `${wPart} × ${targetR}<small>reps</small> · RIR ${targetRir}`;
    }

    // החלפה דו-כיוונית בין מצב swipe למצב action-panel
    // BUG FIX: התנאי הקודם בדק `!hasActionBtn` כתנאי לשחזור — דבר שגרם לתאריך השני
    // להישאר עם כפתור "המשך לתרגיל הבא" משאריות התרגיל הקודם.
    const swipeCard = document.getElementById('live-swipe-card');
    const ap = document.getElementById('action-panel');
    const apVisible = !!(ap && ap.style.display === 'block');
    const hasActionBtn = !!(swipeCard && swipeCard.querySelector('.live-action-btn'));

    if (swipeCard) {
        if (apVisible && !hasActionBtn) {
            // מעבר ממצב swipe → action button
            swipeCard.innerHTML = `
                <button class="live-action-btn" onclick="_liveContinueExercise()">
                    המשך לתרגיל הבא
                </button>`;
            swipeCard.style.cursor = 'default';
        } else if (!apVisible && hasActionBtn) {
            // מעבר חזרה ממצב action → swipe
            swipeCard.innerHTML = `
                <div class="live-swipe-icon">
                    <span class="material-symbols-outlined">arrow_back</span>
                </div>
                <span class="live-swipe-text">החלק לרישום הסט</span>`;
            swipeCard.style.cursor = 'pointer';
            // איפוס transform למקרה שנשאר משחזור swipe באמצע drag
            swipeCard.style.transform = '';
            swipeCard.classList.remove('dragging');
        }
    }
}

// נקרא בכל tick של resetAndStartTimer דרך ה-hook ב-updateUI
function updateLiveTimer(mins, secs, progress) {
    if (!document.body.classList.contains('live-mode-active')) return;
    const txt = document.getElementById('live-timer-text');
    const bar = document.getElementById('live-timer-progress');
    if (txt) txt.textContent = `${mins}:${secs}`;
    if (bar) {
        const circumference = 289;  // 2 × π × r (r=46)
        bar.style.strokeDashoffset = (circumference - progress * circumference).toFixed(1);
    }
}

function _attachLiveSwipe() {
    const card = document.getElementById('live-swipe-card');
    if (!card || _liveSwipeAttached) return;
    _liveSwipeAttached = true;

    card.addEventListener('touchstart', (e) => {
        if (card.querySelector('.live-action-btn')) return;  // במצב action — לא swipe
        _liveTouchStartX = e.touches[0].clientX;
        _liveTouchStartY = e.touches[0].clientY;
        _liveTouchActive = true;
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
        if (!_liveTouchActive) return;
        const dx = e.touches[0].clientX - _liveTouchStartX;
        const dy = e.touches[0].clientY - _liveTouchStartY;
        // אם תנועה אנכית דומיננטית — לבטל (משאיר scroll פעיל)
        if (Math.abs(dy) > Math.abs(dx) * 1.5) { _liveTouchActive = false; return; }
        // RTL: swipe "קדימה" = touch שמאלה בקואורדינטות מסך → dx שלילי
        if (dx < 0) {
            card.style.transform = `translateX(${dx}px)`;
            card.classList.add('dragging');
        }
    }, { passive: true });

    card.addEventListener('touchend', (e) => {
        if (!_liveTouchActive) return;
        _liveTouchActive = false;
        const dx = (e.changedTouches[0].clientX) - _liveTouchStartX;
        card.classList.remove('dragging');
        card.style.transform = '';
        if (dx < -80) {
            haptic('success');
            if (typeof nextStep === 'function') {
                nextStep();
                setTimeout(updateLiveViewContent, 80);
            }
        }
    });
    // אין fallback ל-tap: בכוונה — תיעוד סט אסור שיקרה מטעות במגע, רק בהחלקה מפורשת
}

function toggleLiveMode(enabled) {
    if (typeof getAnalyticsPrefs !== 'function') return;
    const p = getAnalyticsPrefs();
    p.liveMode = !!enabled;
    if (typeof saveAnalyticsPrefs === 'function') saveAnalyticsPrefs(p);
    _liveModeSuppressed = false;  // אפס דריסה כשמשנים את ה-toggle
    haptic('light');
    if (!enabled && document.body.classList.contains('live-mode-active')) {
        exitWorkoutLiveMode(true);  // silent — לא לסמן כ-suppressed
    } else if (enabled && state.historyStack[state.historyStack.length - 1] === 'ui-main') {
        // אם כבר במסך אימון — להפעיל מיד
        enterWorkoutLiveMode();
    }
    _syncLiveResumeBtn();
}

// סנכרון מצב ה-toggle כשנכנסים להגדרות
function syncLiveModeToggle() {
    const tog = document.getElementById('live-mode-toggle');
    if (tog) tog.checked = isLiveModeEnabled();
}

// ── ערכות צבעים ──────────────────────────────────────────────────────
// 'obsidian' (ברירת מחדל) ללא data-theme; השאר דורסים משתני CSS ב-style.css.
const COLOR_THEMES = ['obsidian', 'bronze', 'midnight', 'crimson', 'emerald', 'purple'];

// קורא ערך משתנה CSS חי מה-<html> — לשימוש בגרפים שמציירים SVG כמחרוזת.
// כך הגרפים נצבעים לפי הערכה הפעילה בזמן הציור (במקום hardcode).
function themeVar(name, fallback) {
    try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || (fallback || '');
    } catch (e) { return fallback || ''; }
}

function getStoredColorTheme() {
    try {
        const p = (typeof getAnalyticsPrefs === 'function') ? getAnalyticsPrefs() : null;
        const t = p && p.colorTheme;
        return COLOR_THEMES.includes(t) ? t : 'obsidian';
    } catch (e) { return 'obsidian'; }
}

// החלת ערכת צבעים: data-theme על <html> + שמירה ל-prefs + סנכרון השבבים
function applyColorTheme(themeId, el) {
    if (!COLOR_THEMES.includes(themeId)) themeId = 'obsidian';
    const root = document.documentElement;
    if (themeId === 'obsidian') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', themeId);

    // שמירה — רק אם נקראה מאינטראקציה (יש el) או שהערך השתנה
    if (typeof getAnalyticsPrefs === 'function' && typeof saveAnalyticsPrefs === 'function') {
        const p = getAnalyticsPrefs();
        if (p.colorTheme !== themeId) { p.colorTheme = themeId; saveAnalyticsPrefs(p); }
    }
    if (el) haptic('light');
    syncThemePicker();
    // עדכון צבע סרגל המערכת (Android/Chrome PWA) לרקע הערכה
    try {
        const meta = document.getElementById('meta-theme-color');
        if (meta) meta.setAttribute('content', themeVar('--bg', '#070708'));
    } catch (e) {}
    // ריענון גרפים גלויים כדי שייצבעו מיד בצבע הערכה (הם מציירים מחרוזת SVG)
    if (el) {
        try { if (typeof renderHeroCard === 'function') renderHeroCard(); } catch (e) {}
        try { if (typeof renderHomePRCard === 'function') renderHomePRCard(); } catch (e) {}
        try { if (typeof renderBodyLog === 'function' && document.getElementById('ui-bodylog')?.classList.contains('active')) renderBodyLog(); } catch (e) {}
    }
}

// סימון השבב הפעיל לפי הערכה השמורה — נקרא בכניסה להגדרות
function syncThemePicker() {
    const current = getStoredColorTheme();
    document.querySelectorAll('#theme-picker .theme-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.themeId === current);
    });
}

// אתחול בעת טעינה — מוודא שה-attribute תואם ל-prefs (גיבוי לסקריפט ב-head)
function initColorTheme() {
    applyColorTheme(getStoredColorTheme());
}
