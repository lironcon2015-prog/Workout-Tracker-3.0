/**
 * GymPro Elite - Storage Manager
 * Version: 14.11.0
 * Handles all LocalStorage operations. No native alert/confirm.
 */

const StorageManager = {
    KEY_WEIGHTS:      'gympro_weights',
    KEY_RM:           'gympro_rm',
    KEY_ARCHIVE:      'gympro_archive',
    KEY_DB_EXERCISES: 'gympro_db_exercises',
    KEY_DB_WORKOUTS:  'gympro_db_workouts',
    KEY_META:         'gympro_workout_meta',
    KEY_SESSION:      'gympro_current_session',
    KEY_ANALYTICS:    'gympro_analytics_prefs',
    KEY_GEMINI_KEY:   'gympro_gemini_key',
    KEY_AI_MODELS:    'gympro_ai_models',
    KEY_AI_PERSONA:   'gympro_ai_persona',
    KEY_AI_HISTORY:   'gympro_ai_history',
    KEY_AI_DISPLAY_CUTOFF: 'gympro_ai_display_cutoff',
    KEY_NUTRITION:    'gympro_nutrition',
    KEY_NUTRITION_LOG: 'gympro_nutrition_log',
    KEY_BODYLOG:      'gympro_bodylog',
    KEY_SOUND:        'gympro_sound_enabled',
    KEY_COPY_INCLUDE_COACH: 'gympro_copy_include_coach',
    KEY_ARCHIVE_COPY_COACH: 'gympro_archive_copy_coach',
    KEY_COACH_PROMPTS:      'gympro_coach_prompts',

    getData(key) {
        try { return JSON.parse(localStorage.getItem(key)); }
        catch(e) { console.error('GymPro: storage read error', key, e); return null; }
    },

    saveData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch(e) {
            console.error('GymPro: storage write error', key, e);
            if (e.name === 'QuotaExceededError') showAlert('האחסון המקומי מלא. מחק היסטוריית שיחות AI או ייצא גיבוי כדי לפנות מקום.');
        }
    },

    initDB() {
        const storedEx = this.getData(this.KEY_DB_EXERCISES);
        const storedWo = this.getData(this.KEY_DB_WORKOUTS);
        const storedMeta = this.getData(this.KEY_META);

        if (storedEx && storedEx.length > 0) {
            state.exercises = storedEx;
            const missing = defaultExercises.filter(def => !state.exercises.find(e => e.name === def.name));
            if (missing.length > 0) {
                state.exercises = [...state.exercises, ...missing];
                this.saveData(this.KEY_DB_EXERCISES, state.exercises);
            }
        } else {
            state.exercises = JSON.parse(JSON.stringify(defaultExercises));
            this.saveData(this.KEY_DB_EXERCISES, state.exercises);
        }

        if (storedWo && Object.keys(storedWo).length > 0) {
            state.workouts = storedWo;
        } else {
            state.workouts = JSON.parse(JSON.stringify(defaultWorkouts));
            this.saveData(this.KEY_DB_WORKOUTS, state.workouts);
        }

        if (storedMeta) {
            state.workoutMeta = storedMeta;
        } else {
            state.workoutMeta = {};
            this.saveData(this.KEY_META, state.workoutMeta);
        }
    },

    // ── Session ──────────────────────────────────────────────────────────

    saveSessionState() {
        const sessionData = {
            state: JSON.parse(JSON.stringify(state)),
            managerState: JSON.parse(JSON.stringify(managerState)),
            timestamp: Date.now()
        };
        sessionData.state.timerInterval = null;
        this.saveData(this.KEY_SESSION, sessionData);
    },

    clearSessionState() {
        localStorage.removeItem(this.KEY_SESSION);
    },

    hasActiveSession() {
        return !!localStorage.getItem(this.KEY_SESSION);
    },

    getSessionState() {
        return this.getData(this.KEY_SESSION);
    },

    // ── Weights / RM ─────────────────────────────────────────────────────

    getLastWeight(exName) {
        const data = this.getData(this.KEY_WEIGHTS) || {};
        return data[exName] || null;
    },

    saveWeight(exName, weight) {
        if (state.week === 'deload') return;
        const data = this.getData(this.KEY_WEIGHTS) || {};
        data[exName] = weight;
        this.saveData(this.KEY_WEIGHTS, data);
    },

    getLastRM(exName) {
        const data = this.getData(this.KEY_RM) || {};
        return data[exName] || null;
    },

    saveRM(exName, rmVal) {
        const data = this.getData(this.KEY_RM) || {};
        data[exName] = rmVal;
        this.saveData(this.KEY_RM, data);
    },

    // ── Archive ──────────────────────────────────────────────────────────

    saveToArchive(workoutObj) {
        let history = this.getData(this.KEY_ARCHIVE) || [];
        history.unshift(workoutObj);
        this.saveData(this.KEY_ARCHIVE, history);
    },

    getArchive() {
        return this.getData(this.KEY_ARCHIVE) || [];
    },

    deleteFromArchive(timestamp) {
        let history = this.getArchive();
        history = history.filter(h => h.timestamp !== timestamp);
        this.saveData(this.KEY_ARCHIVE, history);
    },

    updateArchiveEntry(timestamp, patch) {
        let history = this.getArchive();
        const idx = history.findIndex(h => h.timestamp === timestamp);
        if (idx === -1) return false;
        // מיזוג — תומך גם בהחלפה מלאה (אובייקט שלם) וגם ב-patch חלקי (למשל {aiSummary})
        history[idx] = Object.assign({}, history[idx], patch);
        this.saveData(this.KEY_ARCHIVE, history);
        return true;
    },

    // ── Analytics Prefs ─────────────────────────────────────────────────

    getAnalyticsPrefs() {
        return this.getData(this.KEY_ANALYTICS) || {
            heroMetrics: ['days', 'vol', 'total'],
            volumeRange: 4,
            muscleRange: '1m',
            consistencyRange: 8,
            microPoints: 6,
            microAxis: 'e1rm',
            microOrder: [],
            formula: 'epley',
            units: 'kg',
            name: '',
            workoutAliases: {},
            workoutAliasColors: {},
            homePRRange: 8,
            // Sprint 3 — Analytics Engine
            heatmapWeeks: 12,
            heatmapMuscle: 'all',
            plateauThreshold: 3,  // מינימום שבועות flat שמסומנים כ-plateau
            // Sprint 4 — Workout Live View
            liveMode: false       // מצב fullscreen עם טיימר ענק וסוואייפ לרישום סט
            // consistencyGreen / consistencyOrange — נשמרים רק אם הוגדרו ידנית
        };
    },

    saveAnalyticsPrefs(prefs) {
        this.saveData(this.KEY_ANALYTICS, prefs);
    },

    // ── Nutritional State ───────────────────────────────────────────────
    // מצב תזונתי (maintenance/cut/surplus) משמש כ-context ל-AI Coach
    // כדי לייצר המלצות מותאמות לעומס הקלורי הנוכחי של המשתמש.

    // חלון חסד: החלפת מצב בתוך הזמן הזה נחשבת "משחק בכפתורים" ולא מעבר אמיתי
    NUTRITION_GRACE_MS: 10 * 60 * 1000,

    _todayStr() { return new Date().toISOString().slice(0, 10); },

    // המרת "YYYY-MM-DD" לחצות מקומית (ms) — עקבי עם _daysInState
    _dateStrToTs(dateStr) {
        const [y, m, d] = String(dateStr).split('-').map(Number);
        return (y && m && d) ? new Date(y, m - 1, d).getTime() : Date.now();
    },

    // getNutritionLog — ציר הזמן התזונתי (מהישן לחדש). ממגרר מהמפתח הישן בקריאה ראשונה.
    getNutritionLog() {
        const log = this.getData(this.KEY_NUTRITION_LOG);
        if (Array.isArray(log) && log.length) return log;
        // מיגרציה מ-gympro_nutrition הישן → רשומה ראשונה
        const old = this.getData(this.KEY_NUTRITION);
        if (old && old.state) {
            const startDate = old.startDate || this._todayStr();
            const seeded = [{ state: old.state, startDate, startTs: this._dateStrToTs(startDate) }];
            this.saveData(this.KEY_NUTRITION_LOG, seeded);
            return seeded;
        }
        return [];
    },

    getNutritionalState() {
        const log = this.getNutritionLog();
        if (log.length) {
            const last = log[log.length - 1];
            return { state: last.state, startDate: last.startDate };
        }
        return { state: 'maintenance', startDate: null };
    },

    // setNutritionalState — נקודת הכניסה היחידה לשינוי מצב תזונתי.
    //   startDate מפורש  = Override אמין (עורך את תאריך הפאזה הנוכחית, ללא חלון חסד).
    //   ללא startDate    = החלפה דרך pill — כפופה לחלון חסד + קיפול-חזרה כדי לסנן רעש.
    setNutritionalState(state, startDate) {
        const valid = ['maintenance', 'cut', 'surplus'];
        if (!valid.includes(state)) return false;
        const log = this.getNutritionLog();
        const now = Date.now();

        // אין היסטוריה — רשומה ראשונה
        if (!log.length) {
            const sd = startDate || this._todayStr();
            log.push({ state, startDate: sd, startTs: this._dateStrToTs(sd) });
            return this._commitNutritionLog(log);
        }

        const last = log[log.length - 1];

        // Override מפורש — עריכת תאריך הפאזה הנוכחית (או הוספה אם מצב שונה)
        if (startDate) {
            if (last.state === state) {
                last.startDate = startDate;
                last.startTs = this._dateStrToTs(startDate);
            } else {
                log.push({ state, startDate, startTs: this._dateStrToTs(startDate) });
            }
            return this._commitNutritionLog(log);
        }

        // אותו מצב, ללא Override — אין שינוי
        if (last.state === state) return true;

        const withinGrace = (now - last.startTs) < this.NUTRITION_GRACE_MS;
        const prev = log.length >= 2 ? log[log.length - 2] : null;

        if (withinGrace) {
            if (prev && prev.state === state) {
                log.pop(); // קיפול חזרה — חזרה למצב הקודם, מחיקת הרשומה הזמנית
            } else {
                last.state = state; // משחק בכפתורים — דריסת המצב, שמירת זמן ההתחלה
            }
        } else {
            // מעבר אמיתי — רשומה חדשה
            const sd = this._todayStr();
            log.push({ state, startDate: sd, startTs: now });
        }
        return this._commitNutritionLog(log);
    },

    // _commitNutritionLog — שומר את הלוג ומסנכרן את המפתח הישן (תאימות לאחור)
    _commitNutritionLog(log) {
        if (log.length > 50) log = log.slice(-50); // שמירת עד 50 מעברים אחרונים
        this.saveData(this.KEY_NUTRITION_LOG, log);
        const last = log[log.length - 1];
        if (last) this.saveData(this.KEY_NUTRITION, { state: last.state, startDate: last.startDate });
        return true;
    },

    // getNutritionStateOnDate — איזה מצב תזונתי היה פעיל בתאריך נתון, לפי לוג המעברים.
    // מחזיר null אם התאריך קודם לרשומה הראשונה בלוג (אין מידע).
    getNutritionStateOnDate(dateStr) {
        const log = this.getNutritionLog();
        if (!log.length || !dateStr) return null;
        const ts = this._dateStrToTs(dateStr) + 12 * 3600 * 1000; // אמצע היום — למניעת קצוות
        let active = null;
        for (const e of log) { if (e.startTs <= ts) active = e.state; else break; }
        return active;
    },

    // ── Body Log (שקילות: משקל + אחוז שומן) ─────────────────────────────────
    getBodyLog() { return this.getData(this.KEY_BODYLOG) || []; },

    // upsertBodyEntry — הוספה/דריסה לפי תאריך (אחת ליום). שומר ממוין מהישן לחדש.
    upsertBodyEntry(entry) {
        const log = this.getBodyLog();
        const idx = log.findIndex(e => e.date === entry.date);
        const rec = {
            date: entry.date,
            weight: Number(entry.weight),
            bodyFat: (entry.bodyFat === '' || entry.bodyFat == null) ? null : Number(entry.bodyFat),
            nutritionState: entry.nutritionState || null,
            note: entry.note || '',
            source: entry.source || 'manual',
            createdAt: idx >= 0 ? (log[idx].createdAt || Date.now()) : Date.now()
        };
        if (idx >= 0) log[idx] = rec; else log.push(rec);
        log.sort((a, b) => a.date < b.date ? -1 : 1);
        this.saveData(this.KEY_BODYLOG, log);
        return rec;
    },

    deleteBodyEntry(date) {
        this.saveData(this.KEY_BODYLOG, this.getBodyLog().filter(e => e.date !== date));
    },

    // ── Backup / Restore ────────────────────────────────────────────────

    getAllData() {
        return {
            weights: this.getData(this.KEY_WEIGHTS),
            rms: this.getData(this.KEY_RM),
            archive: this.getArchive()
        };
    },

    restoreData(dataObj) {
        if (dataObj.weights) this.saveData(this.KEY_WEIGHTS, dataObj.weights);
        if (dataObj.rms) this.saveData(this.KEY_RM, dataObj.rms);
        if (dataObj.archive) this.saveData(this.KEY_ARCHIVE, dataObj.archive);
    },

    // ── Configuration Export / Import ────────────────────────────────────

    exportConfiguration() {
        const prefs = this.getAnalyticsPrefs();
        const configData = {
            type: 'config_only',
            version: '14.11.0',
            date: new Date().toISOString(),
            workouts: this.getData(this.KEY_DB_WORKOUTS),
            exercises: this.getData(this.KEY_DB_EXERCISES),
            meta: this.getData(this.KEY_META),
            aliases: prefs.workoutAliases || {},
            analyticsPrefs: {
                heroMetrics:        prefs.heroMetrics,
                volumeRange:        prefs.volumeRange,
                muscleRange:        prefs.muscleRange,
                consistencyRange:   prefs.consistencyRange,
                consistencyGreen:   prefs.consistencyGreen,
                consistencyOrange:  prefs.consistencyOrange,
                microPoints:        prefs.microPoints,
                microAxis:          prefs.microAxis,
                microOrder:         prefs.microOrder,
                formula:            prefs.formula,
                units:              prefs.units,
                name:               prefs.name,
                homePRRange:        prefs.homePRRange,
                workoutAliasColors: prefs.workoutAliasColors || {}
            }
        };
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(configData, null, 2)], { type: "application/json" }));
        a.download = `gympro_config_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    },

    importConfiguration(data) {
        if (data.type !== 'config_only') {
            showAlert("שגיאה: קובץ תבנית לא תקין.");
            return;
        }
        showConfirm("פעולה זו תדרוס את התוכניות והתרגילים. האם להמשיך?", () => {
            this.saveData(this.KEY_DB_WORKOUTS, data.workouts);
            this.saveData(this.KEY_DB_EXERCISES, data.exercises);
            if (data.meta) this.saveData(this.KEY_META, data.meta);
            // מיזוג prefs — מעדכן שדות ספציפיים בלי לדרוס שדות שאינם בקובץ
            const prefs = this.getAnalyticsPrefs();
            if (data.aliases)        prefs.workoutAliases    = data.aliases;
            if (data.analyticsPrefs) {
                const ap = data.analyticsPrefs;
                ['heroMetrics','volumeRange','muscleRange','consistencyRange','consistencyGreen','consistencyOrange','microPoints','microAxis','microOrder','formula','units','name','homePRRange','workoutAliasColors'].forEach(k => {
                    if (ap[k] !== undefined) prefs[k] = ap[k];
                });
            }
            this.saveAnalyticsPrefs(prefs);
            showAlert("התבניות נטענו בהצלחה!", () => { window.location.reload(); });
        });
    },

    // ── Factory Reset (confirmation handled in caller) ───────────────────

    resetToFactory() {
        localStorage.removeItem(this.KEY_DB_EXERCISES);
        localStorage.removeItem(this.KEY_DB_WORKOUTS);
        localStorage.removeItem(this.KEY_META);
        localStorage.removeItem(this.KEY_SESSION);
        // Analytics prefs, AI config & history kept intentionally
    },

    // ── AI Coach ─────────────────────────────────────────────────────────

    getAIConfig() {
        const key    = localStorage.getItem(this.KEY_GEMINI_KEY) || '';
        const stored = localStorage.getItem(this.KEY_AI_MODELS);
        const models = stored
            ? stored.split(',').map(s => s.trim()).filter(Boolean)
            : ['gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
        return { apiKey: key, models };
    },

    saveAIConfig(apiKey, modelsString) {
        localStorage.setItem(this.KEY_GEMINI_KEY, apiKey.trim());
        const models = modelsString.split(',').map(s => s.trim()).filter(Boolean);
        localStorage.setItem(this.KEY_AI_MODELS, models.join(','));
    },

    getAIPersona() {
        return localStorage.getItem(this.KEY_AI_PERSONA) || '';
    },

    saveAIPersona(text) {
        localStorage.setItem(this.KEY_AI_PERSONA, text);
    },

    // ── Coach Summary (סיכום מאמן אוטומטי) ──────────────────────────────────

    // מתג מסך הסיכום — האם לכלול את סיכום המאמן בהעתקה (נזכר בין אימונים)
    getCopyIncludeCoach() {
        return localStorage.getItem(this.KEY_COPY_INCLUDE_COACH) === '1';
    },
    setCopyIncludeCoach(on) {
        localStorage.setItem(this.KEY_COPY_INCLUDE_COACH, on ? '1' : '0');
    },

    // מתג הארכיון — האם לכלול סיכומי מאמן בהעתקות (ברירת מחדל: כבוי)
    getArchiveCopyCoach() {
        return localStorage.getItem(this.KEY_ARCHIVE_COPY_COACH) === '1';
    },
    setArchiveCopyCoach(on) {
        localStorage.setItem(this.KEY_ARCHIVE_COPY_COACH, on ? '1' : '0');
    },

    // פרומפטי ברירת מחדל לסיכום מאמן — ניתנים לעריכה ע"י המשתמש (override)
    COACH_PROMPT_DEFAULTS: {
        workout:
`אתה מאמן כוח מקצועי. נתח את האימון וכתוב סיכום מעמיק בעברית בפורמט Markdown, פותח בכותרת "## סיכום האימון".
התייחס ל: ביצוע מול היעד, נפח כולל ומגמה מול האימונים האחרונים של אותה תוכנית, איכות הסטים (RIR), נקודות חוזק, ונקודה אחת לשיפור בפעם הבאה.

=== האימון הנוכחי ===
{workoutText}

=== מצב תזונתי ===
{nutrition}

=== פרופיל המתאמן ===
{persona}

=== אימונים אחרונים (אותה תוכנית) ===
{recentWorkouts}`,
        week:
`אתה מאמן כוח מקצועי. כתוב סיכום מעמיק בעברית בפורמט Markdown לסיום שבוע אימונים. כלול בדיוק את הכותרות הבאות:
"## סיכום האימון" — ניתוח האימון שהסתיים היום.
"## סיכום השבוע" — נפח כולל, עקביות, והתקדמות בתרגילי מפתח לאורך השבוע.
"## השוואה לבלוק הקודם" — השווה לשבוע/אימון המקביל בבלוק הקודם והדגש שיפור או נסיגה במספרים.

=== האימון שהסתיים היום ===
{workoutText}

=== אימוני השבוע (הבלוק הנוכחי) ===
{weekWorkouts}

=== האימון המקביל בבלוק הקודם ===
{parallelWorkout}

=== מצב תזונתי ===
{nutrition}

=== פרופיל המתאמן ===
{persona}`,
        block:
`אתה מאמן כוח מקצועי. כתוב סיכום מעמיק ומקיף בעברית בפורמט Markdown לסיום בלוק אימונים (מזוסייקל). כלול בדיוק את הכותרות הבאות:
"## סיכום האימון" — האימון שהסתיים היום.
"## סיכום השבוע" — שבוע 3 שהסתיים.
"## סיכום הבלוק" — התקדמות כוח ונפח לאורך 3 השבועות, תרגילים שהתקדמו או נתקעו, ומגמת העומס.
"## המלצות לבלוק הבא" — 2-3 המלצות קונקרטיות לתכנון הבלוק הבא.

=== האימון שהסתיים היום ===
{workoutText}

=== אימוני הבלוק הנוכחי ===
{blockWorkouts}

=== אנליטיקה מצרפית ===
{analytics}

=== מצב תזונתי ===
{nutrition}

=== פרופיל המתאמן ===
{persona}`
    },

    getCoachPrompts() {
        const stored = this.getData(this.KEY_COACH_PROMPTS) || {};
        return {
            workout: stored.workout || this.COACH_PROMPT_DEFAULTS.workout,
            week:    stored.week    || this.COACH_PROMPT_DEFAULTS.week,
            block:   stored.block   || this.COACH_PROMPT_DEFAULTS.block
        };
    },

    getCoachPrompt(scope) {
        return this.getCoachPrompts()[scope] || this.COACH_PROMPT_DEFAULTS.workout;
    },

    saveCoachPrompts(obj) {
        this.saveData(this.KEY_COACH_PROMPTS, obj || {});
    },

    resetCoachPrompts() {
        localStorage.removeItem(this.KEY_COACH_PROMPTS);
    },

    getAIHistory() {
        try { return JSON.parse(localStorage.getItem(this.KEY_AI_HISTORY)) || []; }
        catch(e) { console.error('GymPro: AI history read error', e); return []; }
    },

    saveAIHistory(arr) {
        // שמור עד 300 הודעות אחרונות — מניעת גדילה בלתי מוגבלת
        const limited = arr.length > 300 ? arr.slice(-300) : arr;
        try {
            localStorage.setItem(this.KEY_AI_HISTORY, JSON.stringify(limited));
        } catch(e) {
            console.error('GymPro: AI history write error', e);
            if (e.name === 'QuotaExceededError') {
                // ניסיון חירום: שמור 100 אחרונות בלבד
                try { localStorage.setItem(this.KEY_AI_HISTORY, JSON.stringify(arr.slice(-100))); }
                catch { /* כשל מוחלט — ממשיכים ללא שמירה */ }
            }
        }
    },

    appendAIMessage(msg) {
        const history = this.getAIHistory();
        history.push(msg);
        this.saveAIHistory(history);
    },

    clearAIHistory() {
        localStorage.removeItem(this.KEY_AI_HISTORY);
        localStorage.removeItem(this.KEY_AI_DISPLAY_CUTOFF);
    },

    // נקודת חיתוך לתצוגת AI Coach — הודעות עם timestamp לפני הערך הזה לא יוצגו
    getAIDisplayCutoff() {
        const v = localStorage.getItem(this.KEY_AI_DISPLAY_CUTOFF);
        return v ? parseInt(v, 10) : 0;
    },

    setAIDisplayCutoff(ts) {
        localStorage.setItem(this.KEY_AI_DISPLAY_CUTOFF, String(ts));
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// FirebaseManager — ניהול Firestore (סנכרון ענן)
// ─────────────────────────────────────────────────────────────────────────────

const FirebaseManager = {
    KEY_FIREBASE_CONFIG: 'gympro_firebase_config',
    KEY_SYNC_STATUS: 'gympro_cloud_sync',  // מעקב הצלחת/כשל סנכרון ארכיון אחרון
    ARCHIVE_CHUNK_SIZE: 20,                 // אימונים לכל מסמך — שומר כל chunk הרבה מתחת ל-1MB
    _db: null,
    _initialized: false,
    _authReady: null,  // Promise שמסתיים כשה-Anonymous Auth הושלם

    // בודק אם Firebase מוגדר (יש config ב-LocalStorage)
    isConfigured() {
        const cfg = this.getFirebaseConfig();
        return !!(cfg && cfg.apiKey && cfg.projectId);
    },

    getFirebaseConfig() {
        try { return JSON.parse(localStorage.getItem(this.KEY_FIREBASE_CONFIG)); }
        catch { return null; }
    },

    saveFirebaseConfig(cfg) {
        localStorage.setItem(this.KEY_FIREBASE_CONFIG, JSON.stringify(cfg));
    },

    clearFirebaseConfig() {
        localStorage.removeItem(this.KEY_FIREBASE_CONFIG);
        this._db = null;
        this._initialized = false;
        this._authReady = null;
    },

    // אתחול Firestore — נקרא lazily לפני כל פעולת ענן
    init() {
        if (this._initialized && this._db) return true;
        if (typeof firebase === 'undefined') {
            console.warn('GymPro: Firebase SDK not loaded');
            return false;
        }
        const cfg = this.getFirebaseConfig();
        if (!cfg || !cfg.apiKey || !cfg.projectId) return false;
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(cfg);
            }
            this._db = firebase.firestore();
            this._initialized = true;
            // כניסה אנונימית — נדרשת לכללי Firestore (request.auth != null)
            this._authReady = firebase.auth().signInAnonymously()
                .catch(e => console.error('GymPro: anonymous auth failed', e));
            return true;
        } catch(e) {
            console.error('GymPro Firebase init error:', e);
            return false;
        }
    },

    // ממתין לסיום האתחול ול-Auth לפני פעולות Firestore
    async _ensureReady() {
        if (!this.init()) return false;
        await this._authReady;
        return true;
    },

    // ── Sync Status (#3) ───────────────────────────────────────────────────────
    // מעקב אחר הצלחת הסנכרון האחרון של הארכיון — מאפשר התראה אמיתית ושורת "סונכרן לאחרונה".

    getSyncStatus() {
        try { return JSON.parse(localStorage.getItem(this.KEY_SYNC_STATUS)) || {}; }
        catch { return {}; }
    },

    _recordArchiveSync(ok) {
        try {
            localStorage.setItem(this.KEY_SYNC_STATUS, JSON.stringify({ archiveOk: ok, archiveAt: Date.now() }));
        } catch { /* מקרה קצה — אחסון מלא; לא קריטי */ }
    },

    // ── Archive ──────────────────────────────────────────────────────────────
    // הארכיון מפוצל למספר מסמכים (chunks) בקולקציה gympro_data כדי לעקוף את מחסום
    // 1MB-למסמך של Firestore. מבנה: archive_meta + archive_0, archive_1, ...
    // הכתיבה אטומית (batch). מסמך הארכיון הישן (archive) ממוגרר אוטומטית ונמחק.

    async saveArchiveToCloud() {
        if (!await this._ensureReady()) { this._recordArchiveSync(false); return false; }
        try {
            const archive = StorageManager.getArchive();
            const col = this._db.collection('gympro_data');
            const size = this.ARCHIVE_CHUNK_SIZE;
            const chunkCount = Math.max(1, Math.ceil(archive.length / size));
            const now = Date.now();

            // כמה chunks היו קודם — כדי למחוק עודפים אם הארכיון התכווץ
            let prevCount = 0;
            try {
                const metaDoc = await col.doc('archive_meta').get();
                if (metaDoc.exists) prevCount = metaDoc.data().chunkCount || 0;
            } catch { /* אין meta קודם — מיגרציה ראשונה */ }

            const batch = this._db.batch();
            for (let i = 0; i < chunkCount; i++) {
                const items = archive.slice(i * size, (i + 1) * size);
                batch.set(col.doc(`archive_${i}`), { items, updatedAt: now });
            }
            // מחיקת chunks מיותרים (הארכיון התכווץ מאז הסנכרון הקודם)
            for (let i = chunkCount; i < prevCount; i++) {
                batch.delete(col.doc(`archive_${i}`));
            }
            batch.set(col.doc('archive_meta'), { chunkCount, total: archive.length, updatedAt: now });
            // מחיקת מסמך הארכיון הישן (מיגרציה ממבנה single-doc) — מקור אמת יחיד
            batch.delete(col.doc('archive'));

            await batch.commit();
            this._recordArchiveSync(true);
            return true;
        } catch(e) {
            console.error('GymPro saveArchive error:', e);
            this._recordArchiveSync(false);
            return false;
        }
    },

    async loadArchiveFromCloud() {
        if (!await this._ensureReady()) {
            showAlert('Firebase לא מוגדר. הגדר חיבור תחילה.');
            return;
        }
        try {
            const col = this._db.collection('gympro_data');
            const metaDoc = await col.doc('archive_meta').get();

            let items = null;
            if (metaDoc.exists && metaDoc.data().chunkCount) {
                // מבנה chunks חדש — איחוד לפי הסדר (chunk 0 = החדשים ביותר)
                const chunkCount = metaDoc.data().chunkCount;
                const docs = await Promise.all(
                    Array.from({ length: chunkCount }, (_, i) => col.doc(`archive_${i}`).get())
                );
                items = [];
                docs.forEach(d => { if (d.exists && Array.isArray(d.data().items)) items.push(...d.data().items); });
            } else {
                // Fallback — מבנה ישן (מסמך archive בודד) לפני מיגרציה
                const legacy = await col.doc('archive').get();
                if (legacy.exists && legacy.data().items) items = legacy.data().items;
            }

            if (!items) {
                showAlert('לא נמצאו נתוני ארכיון בענן.');
                return;
            }
            StorageManager.saveData(StorageManager.KEY_ARCHIVE, items);
            showAlert('הארכיון שוחזר מהענן!', () => { window.location.reload(); });
        } catch(e) {
            showAlert('שגיאה בטעינה מהענן: ' + e.message);
        }
    },

    // ── Config ───────────────────────────────────────────────────────────────

    async saveConfigToCloud() {
        if (!await this._ensureReady()) return false;
        try {
            const configData = {
                workouts:       StorageManager.getData(StorageManager.KEY_DB_WORKOUTS),
                exercises:      StorageManager.getData(StorageManager.KEY_DB_EXERCISES),
                meta:           StorageManager.getData(StorageManager.KEY_META),
                analyticsPrefs: StorageManager.getAnalyticsPrefs(),
                nutrition:      StorageManager.getNutritionalState(),
                nutritionLog:   StorageManager.getNutritionLog(),
                bodylog:        StorageManager.getBodyLog(),
                coachPrompts:   StorageManager.getData(StorageManager.KEY_COACH_PROMPTS) || {},
                updatedAt:      Date.now()
            };
            await this._db.collection('gympro_data').doc('config').set(configData);
            return true;
        } catch(e) {
            console.error('GymPro saveConfig error:', e);
            return false;
        }
    },

    async loadConfigFromCloud() {
        if (!await this._ensureReady()) {
            showAlert('Firebase לא מוגדר. הגדר חיבור תחילה.');
            return;
        }
        try {
            const doc = await this._db.collection('gympro_data').doc('config').get();
            if (!doc.exists) {
                showAlert('לא נמצאו נתוני קונפיג בענן.');
                return;
            }
            const data = doc.data();
            if (data.workouts)       StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, data.workouts);
            if (data.exercises)      StorageManager.saveData(StorageManager.KEY_DB_EXERCISES, data.exercises);
            if (data.meta)           StorageManager.saveData(StorageManager.KEY_META, data.meta);
            if (data.analyticsPrefs) StorageManager.saveAnalyticsPrefs(data.analyticsPrefs);
            if (data.nutrition)      StorageManager.saveData(StorageManager.KEY_NUTRITION, data.nutrition);
            if (data.nutritionLog)   StorageManager.saveData(StorageManager.KEY_NUTRITION_LOG, data.nutritionLog);
            if (data.bodylog)        StorageManager.saveData(StorageManager.KEY_BODYLOG, data.bodylog);
            if (data.coachPrompts)   StorageManager.saveData(StorageManager.KEY_COACH_PROMPTS, data.coachPrompts);
            showAlert('הקונפיג שוחזר מהענן!', () => { window.location.reload(); });
        } catch(e) {
            showAlert('שגיאה בטעינה מהענן: ' + e.message);
        }
    },

    // ── Upload All (העלאה ראשונית) ────────────────────────────────────────────

    async uploadAllToCloud() {
        if (!await this._ensureReady()) {
            showAlert('Firebase לא מוגדר. הגדר חיבור תחילה.');
            return;
        }
        try {
            const archiveOk = await this.saveArchiveToCloud();
            const configOk  = await this.saveConfigToCloud();
            if (archiveOk && configOk) {
                showAlert('כל הנתונים הועלו לענן בהצלחה!');
            } else {
                showAlert('חלק מהנתונים לא הועלו. בדוק חיבור ונסה שוב.');
            }
        } catch(e) {
            showAlert('שגיאה בהעלאה: ' + e.message);
        }
    },

    // ── AI History ───────────────────────────────────────────────────────────

    async saveAIHistoryToCloud() {
        if (!await this._ensureReady()) return false;
        try {
            const history = StorageManager.getAIHistory();
            await this._db.collection('gympro_data').doc('ai_history').set({
                messages: history,
                updatedAt: Date.now()
            });
            return true;
        } catch(e) {
            console.error('GymPro saveAIHistory error:', e);
            return false;
        }
    },

    async loadAIHistoryFromCloud() {
        if (!await this._ensureReady()) {
            showAlert('Firebase לא מוגדר. הגדר חיבור תחילה.');
            return;
        }
        try {
            const doc = await this._db.collection('gympro_data').doc('ai_history').get();
            if (!doc.exists || !doc.data().messages) {
                showAlert('לא נמצאה היסטוריית שיחות בענן.');
                return;
            }
            StorageManager.saveAIHistory(doc.data().messages);
            showAlert('היסטוריית שיחות שוחזרה!', () => { window.location.reload(); });
        } catch(e) {
            showAlert('שגיאה בטעינה מהענן: ' + e.message);
        }
    }
};
