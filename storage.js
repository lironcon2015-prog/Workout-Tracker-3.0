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
    KEY_COACH_MEMORY: 'gympro_coach_memory',
    KEY_AI_DISPLAY_CUTOFF: 'gympro_ai_display_cutoff',
    KEY_NUTRITION:    'gympro_nutrition',
    KEY_NUTRITION_LOG: 'gympro_nutrition_log',
    KEY_NUTRITION_DAILY: 'gympro_nutrition_daily',   // ייבוא MFP — קלוריות/מאקרו לפי יום
    KEY_NUTRITION_RAW:   'gympro_nutrition_raw',      // הקובץ הגולמי המקורי (שורה לכל ארוחה)
    KEY_BODY_PROFILE:    'gympro_body_profile',        // מין/גיל/גובה/רמת פעילות — לחישוב TDEE
    KEY_MFP_BRIDGE_URL:   'gympro_mfp_bridge_url',    // Apps Script Web App URL
    KEY_MFP_BRIDGE_TOKEN: 'gympro_mfp_bridge_token',  // token סודי לגשר
    KEY_MFP_BRIDGE_ON:    'gympro_mfp_bridge_on',     // האם גשר MFP פעיל (ברירת מחדל: דלוק)
    KEY_HEALTH_BRIDGE_URL:   'gympro_health_bridge_url',    // גשר תזונה Apple Health
    KEY_HEALTH_BRIDGE_TOKEN: 'gympro_health_bridge_token',  // token סודי לגשר ה-Health
    KEY_HEALTH_BRIDGE_ON:    'gympro_health_bridge_on',     // האם גשר Health פעיל (ברירת מחדל: דלוק)
    KEY_HEALTH_LAST_SYNC:    'gympro_health_last_sync',     // timestamp משיכה מוצלחת אחרונה מהגשר
    KEY_WATCH_BRIDGE_URL:   'gympro_watch_bridge_url',    // Apps Script proxy לגשר השעון
    KEY_WATCH_BRIDGE_TOKEN: 'gympro_watch_bridge_token',  // SECRET_TOKEN לגשר השעון
    KEY_WATCH_BRIDGE_ON:    'gympro_watch_bridge_on',     // האם גשר השעון פעיל (ברירת מחדל: כבוי)
    KEY_BODYLOG:      'gympro_bodylog',
    KEY_SOUND:        'gympro_sound_enabled',
    KEY_COPY_INCLUDE_COACH: 'gympro_copy_include_coach',
    KEY_ARCHIVE_COPY_COACH: 'gympro_archive_copy_coach',
    KEY_COACH_PROMPTS:      'gympro_coach_prompts',
    KEY_FOOD_LOG:     'gympro_food_log',     // יומן מזון פנימי — רשומות לפי יום
    KEY_FOOD_DB:      'gympro_food_db',        // מאגר מזון: קאש OFF + מותאמים + מועדפים
    KEY_USDA_KEY:     'gympro_usda_key',        // מפתח USDA FoodData Central (אופציונלי)

    getUsdaKey() { return localStorage.getItem(this.KEY_USDA_KEY) || ''; },
    saveUsdaKey(k) { localStorage.setItem(this.KEY_USDA_KEY, (k || '').trim()); },

    getData(key) {
        try { return JSON.parse(localStorage.getItem(key)); }
        catch(e) { console.error('GymPro: storage read error', key, e); return null; }
    },

    saveData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch(e) {
            console.error('GymPro: storage write error', key, e);
            if (e.name === 'QuotaExceededError') showAlert('האחסון המקומי מלא. מחק היסטוריית שיחות AI או ייצא גיבוי כדי לפנות מקום.');
            return false;
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
        // נקודת-חנק יחידה לפרסום אל גשר השעון (no-op כשהגשר כבוי / לא נטען)
        try { if (typeof WatchBridge !== 'undefined') WatchBridge.onStateSaved(); } catch (e) { /* הגנתי */ }
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
        return this.saveData(this.KEY_ARCHIVE, history);
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
        return this.saveData(this.KEY_ARCHIVE, history);
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
            liveMode: false,      // מצב fullscreen עם טיימר ענק וסוואייפ לרישום סט
            // מסך הבית — 'today' (כרטיסי תזונה+גוף) או 'pr' (גרף שיאים).
            // משתמשים קיימים: ה-prefs השמורים לא עוברים merge — קוראים תמיד עם || 'today'
            homeCard: 'today',
            // יעד קלורי יומי (null = לא הוגדר, מספר ה"נותרו" בבית מוסתר)
            kcalTarget: null,
            // האם היעד הקלורי נדרס ידנית. false = מחושב אוטומטית מהמאקרו (P×4+C×4+F×9)
            kcalTargetManual: false,
            // נקודת פתיחה ידנית לחישוב ה-TDEE (null = אוטומטי: 28 ימים אחרונים)
            tdeeStartDate: null,
            // ערכת צבעים: obsidian (ברירת מחדל) | bronze | midnight | crimson | emerald | purple
            colorTheme: 'obsidian',
            // יעדי מאקרו יומיים (גרם) ליומן המזון — null = לא הוגדר ("נותרו" מוסתר)
            proteinTarget: null,
            carbsTarget: null,
            fatTarget: null,
            // שמות ארוחות ליומן המזון (ניתן להוסיף ארוחות ביניים חופשיות)
            mealLabels: ['בוקר', 'צהריים', 'ערב', 'נשנוש']
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

    // תאריך מקומי — לא UTC (toISOString מחזיר את אתמול בין חצות ל-03:00 שעון ישראל)
    _todayStr() {
        const d = new Date(), p = x => String(x).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    },

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

    // ── Connections Export / Import (v15.97.2) ──────────────────────────
    // קובץ חיבורים: Firebase, Gemini, גשרי MFP/שעון והעדפות — לשחזור מערכת
    // מלא בלי הזנה ידנית. ⚠️ הקובץ מכיל סודות (API keys, tokens) — לשמור
    // במקום בטוח ולא לשתף.

    _connectionKeys() {
        return [
            'gympro_firebase_config',     // FirebaseManager.KEY_FIREBASE_CONFIG
            this.KEY_GEMINI_KEY,
            this.KEY_AI_MODELS,
            this.KEY_AI_PERSONA,
            this.KEY_COACH_PROMPTS,
            this.KEY_USDA_KEY,
            this.KEY_MFP_BRIDGE_URL,
            this.KEY_MFP_BRIDGE_TOKEN,
            this.KEY_MFP_BRIDGE_ON,
            this.KEY_HEALTH_BRIDGE_URL,
            this.KEY_HEALTH_BRIDGE_TOKEN,
            this.KEY_HEALTH_BRIDGE_ON,
            this.KEY_WATCH_BRIDGE_URL,
            this.KEY_WATCH_BRIDGE_TOKEN,
            this.KEY_WATCH_BRIDGE_ON,
            this.KEY_SOUND,
            this.KEY_COPY_INCLUDE_COACH,
            this.KEY_ARCHIVE_COPY_COACH
        ];
    },

    exportConnections() {
        const data = {};
        this._connectionKeys().forEach(k => {
            // העתקה גולמית של הערך — בלי parse, עמיד לכל פורמט אחסון
            const raw = localStorage.getItem(k);
            if (raw !== null) data[k] = raw;
        });
        if (!Object.keys(data).length) {
            showAlert('אין עדיין חיבורים שמורים לייצוא.');
            return;
        }
        const payload = {
            type: 'gympro_connections',
            date: new Date().toISOString(),
            data
        };
        const json = JSON.stringify(payload, null, 2);
        const fileName = `gympro_connections_${new Date().toISOString().slice(0, 10)}.json`;

        // ב-iOS standalone הורדת blob דרך anchor מנווטת את ה-WebView ועלולה
        // להקפיץ/לאתחל את האפליקציה. לכן קודם Web Share API (שיתוף ← "שמור
        // בקבצים") — בלי שום ניווט; anchor נשאר fallback לדפדפן שולחני.
        try {
            const file = new File([json], fileName, { type: 'application/json' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                navigator.share({ files: [file] }).catch(() => { /* ביטול שיתוף אינו שגיאה */ });
                return;
            }
        } catch (e) { /* אין תמיכה — ממשיכים ל-fallback */ }

        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        showAlert('קובץ החיבורים ירד. ⚠️ הוא מכיל מפתחות אישיים — שמור אותו במקום בטוח.');
    },

    importConnections(payload) {
        if (!payload || payload.type !== 'gympro_connections' || !payload.data || typeof payload.data !== 'object') {
            showAlert('שגיאה: זה לא קובץ חיבורים תקין.');
            return;
        }
        // רק מפתחות gympro_ וערכי מחרוזת — הגנה מקובץ זדוני/פגום
        const entries = Object.entries(payload.data)
            .filter(([k, v]) => k.indexOf('gympro_') === 0 && typeof v === 'string');
        if (!entries.length) {
            showAlert('הקובץ ריק — אין חיבורים לייבוא.');
            return;
        }
        showConfirm(`ייבוא ${entries.length} חיבורים והגדרות ידרוס את הקיימים. להמשיך?`, () => {
            try {
                entries.forEach(([k, v]) => localStorage.setItem(k, v));
            } catch (e) {
                showAlert('שגיאה בשמירת החיבורים.');
                return;
            }
            // Firebase מוגדר כעת? → משיכה אוטומטית של כל הנתונים מהענן
            // (ארכיון אימונים + תזונה + שקילה + יומן מזון + שיחות AI), ואז reload.
            if (FirebaseManager.isConfigured()) {
                if (typeof showCloudToast === 'function') showCloudToast('מסנכרן נתונים מהענן…', true);
                FirebaseManager.restoreAllFromCloud().then(res => {
                    const parts = [];
                    if (res.archive) parts.push(`${res.archive} אימונים`);
                    if (res.config)  parts.push('תזונה ושקילה');
                    if (res.ai)      parts.push('שיחות AI');
                    const summary = parts.length ? ' (' + parts.join(', ') + ')' : '';
                    showAlert('החיבורים והנתונים שוחזרו מהענן' + summary + '!', () => { window.location.reload(); });
                }).catch(() => {
                    showAlert('החיבורים שוחזרו, אך המשיכה מהענן נכשלה (בדוק רשת). אפשר לטעון ידנית מההגדרות.', () => { window.location.reload(); });
                });
            } else {
                showAlert('החיבורים שוחזרו בהצלחה!', () => { window.location.reload(); });
            }
        });
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
            nutrition: this.getNutritionalState(),
            nutritionLog: this.getNutritionLog(),
            nutritionDaily: this.getNutritionDaily(),
            nutritionRaw: this.getNutritionRaw(),
            foodLog: this.getFoodLog(),
            foodDb: this.getFoodDb(),
            bodyProfile: this.getBodyProfile(),
            bodylog: this.getBodyLog(),
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
                workoutAliasColors: prefs.workoutAliasColors || {},
                kcalTarget:         prefs.kcalTarget,
                kcalTargetManual:   prefs.kcalTargetManual,
                proteinTarget:      prefs.proteinTarget,
                carbsTarget:        prefs.carbsTarget,
                fatTarget:          prefs.fatTarget,
                mealLabels:         prefs.mealLabels
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
                ['heroMetrics','volumeRange','muscleRange','consistencyRange','consistencyGreen','consistencyOrange','microPoints','microAxis','microOrder','formula','units','name','homePRRange','workoutAliasColors','kcalTarget','kcalTargetManual','proteinTarget','carbsTarget','fatTarget','mealLabels'].forEach(k => {
                    if (ap[k] !== undefined) prefs[k] = ap[k];
                });
            }
            this.saveAnalyticsPrefs(prefs);
            if (data.nutrition)      this.saveData(this.KEY_NUTRITION, data.nutrition);
            if (data.nutritionLog)   this.saveData(this.KEY_NUTRITION_LOG, data.nutritionLog);
            if (data.nutritionDaily) this.saveData(this.KEY_NUTRITION_DAILY, data.nutritionDaily);
            if (data.nutritionRaw)   this.saveData(this.KEY_NUTRITION_RAW, data.nutritionRaw);
            if (data.foodLog)        this.saveData(this.KEY_FOOD_LOG, data.foodLog);
            if (data.foodDb)         this.saveData(this.KEY_FOOD_DB, data.foodDb);
            if (data.bodyProfile)    this.saveData(this.KEY_BODY_PROFILE, data.bodyProfile);
            if (data.bodylog)        this.saveData(this.KEY_BODYLOG, data.bodylog);
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

    // ── MyFitnessPal Nutrition (ייבוא מ-Gmail דרך Apps Script) ───────────
    getNutritionDaily() {
        return this.getData(this.KEY_NUTRITION_DAILY) || [];
    },

    // clearNutrition — מוחק את כל נתוני התזונה (סיכום יומי + קובץ גולמי).
    clearNutrition() {
        localStorage.removeItem(this.KEY_NUTRITION_DAILY);
        localStorage.removeItem(this.KEY_NUTRITION_RAW);
    },

    // saveNutritionDaily — upsert לפי תאריך (ייבוא חדש דורס יום קיים), ממוין מהישן לחדש.
    // נתיב הייבוא של MFP — דורס הכל, כולל ימים שמקורם ב-Health (MFP = מקור האמת).
    saveNutritionDaily(days) {
        const map = {};
        this.getNutritionDaily().forEach(d => { if (d && d.date) map[d.date] = d; });
        (days || []).forEach(d => { if (d && d.date) map[d.date] = d; });
        const merged = Object.values(map).sort((a, b) => a.date < b.date ? -1 : 1);
        this.saveData(this.KEY_NUTRITION_DAILY, merged);
        return merged;
    },

    // mergeHealthNutritionDays — מיזוג ימי תזונה מגשר ה-Health. כללי עדיפות:
    // יום Health נכתב רק אם אין רשומה לאותו תאריך, או שהקיימת גם היא מ-Health
    // (src:'health'). יום MFP לעולם אינו נדרס. מחזיר את מספר הימים שהשתנו בפועל.
    mergeHealthNutritionDays(days) {
        const map = {};
        this.getNutritionDaily().forEach(d => { if (d && d.date) map[d.date] = d; });
        let changed = 0;
        (days || []).forEach(d => {
            if (!d || !d.date) return;
            const existing = map[d.date];
            if (existing && existing.src !== 'health') return; // יום MFP — לא נוגעים
            const next = {
                date: d.date,
                calories: Math.round(Number(d.calories) || 0),
                protein:  Math.round(Number(d.protein)  || 0),
                carbs:    Math.round(Number(d.carbs)    || 0),
                fat:      Math.round(Number(d.fat)      || 0),
                src: 'health'
            };
            if (existing &&
                existing.calories === next.calories && existing.protein === next.protein &&
                existing.carbs === next.carbs && existing.fat === next.fat) return; // ללא שינוי
            map[d.date] = next;
            changed++;
        });
        if (!changed) return 0;
        const merged = Object.values(map).sort((a, b) => a.date < b.date ? -1 : 1);
        this.saveData(this.KEY_NUTRITION_DAILY, merged);
        return changed;
    },

    // ── הקובץ הגולמי של MFP (per-meal) ───────────────────────────────────
    getNutritionRaw() {
        return this.getData(this.KEY_NUTRITION_RAW) || null;
    },

    // saveNutritionRaw — ממזג קובץ גולמי חדש: לכל תאריך שמופיע בקובץ החדש,
    // השורות הישנות של אותו תאריך מוסרות ומוחלפות (העדכני מנצח). ללא כפילויות.
    saveNutritionRaw(incoming) {
        if (!incoming || !Array.isArray(incoming.rows) || !incoming.rows.length) return;
        const di = incoming.dateIdx != null ? incoming.dateIdx : 0;
        const cur = this.getNutritionRaw();
        const newDates = new Set(incoming.rows.map(r => String(r[di] || '').trim()));
        const curDi = (cur && cur.dateIdx != null) ? cur.dateIdx : di;
        const kept = (cur && Array.isArray(cur.rows) ? cur.rows : [])
            .filter(r => !newDates.has(String(r[curDi] || '').trim()));
        const merged = kept.concat(incoming.rows)
            .sort((a, b) => (String(a[di] || '') < String(b[di] || '') ? -1 : 1));
        this.saveData(this.KEY_NUTRITION_RAW, { header: incoming.header, rows: merged, dateIdx: di });
    },

    // ── יומן מזון פנימי (Food Diary) ─────────────────────────────────────
    // log = { "YYYY-MM-DD": [ {id, name, brand, source, barcode?, meal, time,
    //         qty, unit, gramsPerUnit?, per100:{kcal,p,c,f}, kcal,p,c,f}, ... ] }
    getFoodLog() { return this.getData(this.KEY_FOOD_LOG) || {}; },
    getFoodLogDay(date) { return this.getFoodLog()[date] || []; },
    _saveFoodLog(log) { this.saveData(this.KEY_FOOD_LOG, log); },

    addFoodEntry(date, entry) {
        const log = this.getFoodLog();
        if (!log[date]) log[date] = [];
        if (!entry.id) entry.id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        log[date].push(entry);
        this._saveFoodLog(log);
        this.recomputeNutritionDay(date);
        return entry;
    },

    updateFoodEntry(date, id, patch) {
        const log = this.getFoodLog();
        const arr = log[date]; if (!arr) return;
        const i = arr.findIndex(e => e.id === id); if (i < 0) return;
        arr[i] = Object.assign({}, arr[i], patch);
        this._saveFoodLog(log);
        this.recomputeNutritionDay(date);
    },

    deleteFoodEntry(date, id) {
        const log = this.getFoodLog();
        const arr = log[date]; if (!arr) return;
        log[date] = arr.filter(e => e.id !== id);
        if (!log[date].length) delete log[date];
        this._saveFoodLog(log);
        this.recomputeNutritionDay(date);
    },

    // recomputeNutritionDay — מסכם את רשומות היום וכותב ל-NUTRITION_DAILY עם src:'app'.
    // עדיפות (אושר ע"י המשתמש): MFP מנצח — יום שמקורו MFP (src ריק/'mfp') לא נדרס.
    recomputeNutritionDay(date) {
        const entries = this.getFoodLogDay(date);
        const daily = this.getNutritionDaily();
        const idx = daily.findIndex(d => d.date === date);
        const existing = idx >= 0 ? daily[idx] : null;
        const isMfpOwned = existing && (existing.src == null || existing.src === 'mfp');
        if (isMfpOwned) return;  // MFP מנצח — לא נוגעים בסיכום היומי
        if (!entries.length) {
            // אין רשומות פנימיות — הסר יום שמקורו 'app' (חזרה למצב ריק)
            if (existing && existing.src === 'app') {
                daily.splice(idx, 1);
                this.saveData(this.KEY_NUTRITION_DAILY, daily);
            }
            return;
        }
        const sum = entries.reduce((a, e) => {
            a.calories += Number(e.kcal) || 0;
            a.protein  += Number(e.p)    || 0;
            a.carbs    += Number(e.c)    || 0;
            a.fat      += Number(e.f)    || 0;
            return a;
        }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
        const rec = {
            date,
            calories: Math.round(sum.calories),
            protein:  Math.round(sum.protein),
            carbs:    Math.round(sum.carbs),
            fat:      Math.round(sum.fat),
            meals:    new Set(entries.map(e => e.meal)).size,
            src: 'app'
        };
        if (idx >= 0) daily[idx] = rec; else daily.push(rec);
        daily.sort((a, b) => a.date < b.date ? -1 : 1);
        this.saveData(this.KEY_NUTRITION_DAILY, daily);
    },

    // ── מאגר מזון (קאש + מותאמים + מועדפים) ──────────────────────────────
    getFoodDb() { return this.getData(this.KEY_FOOD_DB) || []; },

    upsertFoodToDb(food) {
        const db = this.getFoodDb();
        const i = db.findIndex(f => f.id === food.id || (f.barcode && food.barcode && f.barcode === food.barcode));
        if (i >= 0) db[i] = Object.assign({}, db[i], food);
        else db.push(Object.assign({ useCount: 0, lastUsed: 0, favorite: false, mealUse: {} }, food));
        this.saveData(this.KEY_FOOD_DB, db);
    },

    // bumpFoodUsage — מעדכן שימוש גלובלי וגם שימוש לפי ארוחה (mealUse) לדירוג מותאם-ארוחה
    bumpFoodUsage(id, meal) {
        const db = this.getFoodDb();
        const f = db.find(x => x.id === id); if (!f) return;
        const now = Date.now();
        f.useCount = (f.useCount || 0) + 1;
        f.lastUsed = now;
        if (meal) {
            if (!f.mealUse) f.mealUse = {};
            const mu = f.mealUse[meal] || { count: 0, lastUsed: 0 };
            mu.count++; mu.lastUsed = now;
            f.mealUse[meal] = mu;
        }
        this.saveData(this.KEY_FOOD_DB, db);
    },

    toggleFavoriteFood(id) {
        const db = this.getFoodDb();
        const f = db.find(x => x.id === id); if (!f) return false;
        f.favorite = !f.favorite;
        this.saveData(this.KEY_FOOD_DB, db);
        return f.favorite;
    },

    // דירוג מותאם-ארוחה: מזונות שנאכלו בארוחה הנתונה קודם (לפי lastUsed שלה), אחר כך הגלובלי
    _mealSort(meal) {
        return (a, b) => {
            if (meal) {
                const am = (a.mealUse && a.mealUse[meal]) ? a.mealUse[meal].lastUsed : 0;
                const bm = (b.mealUse && b.mealUse[meal]) ? b.mealUse[meal].lastUsed : 0;
                if (am !== bm) return bm - am;   // הארוחה הנוכחית מובילה
            }
            return (b.lastUsed || 0) - (a.lastUsed || 0);
        };
    },

    recentFoods(n, meal) {
        return this.getFoodDb().filter(f => f.lastUsed)
            .sort(this._mealSort(meal)).slice(0, n || 20);
    },
    favoriteFoods(meal) {
        return this.getFoodDb().filter(f => f.favorite).sort(this._mealSort(meal));
    },
    customFoods() {
        return this.getFoodDb().filter(f => f.source === 'custom')
            .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
    },

    // applyMfpDays — ייבוא ימי MFP עם בקרת דריסה. ימים חדשים (ללא רשומה) מיובאים תמיד;
    // ימי התנגשות (קיימת רשומה שונה) נדרסים רק אם התאריך ב-overwriteDates.
    // overwriteDates = Set של תאריכים שאושרו לדריסה (null = דרוס הכל — תאימות לאחור).
    applyMfpDays(days, overwriteDates) {
        const map = {};
        this.getNutritionDaily().forEach(d => { if (d && d.date) map[d.date] = d; });
        (days || []).forEach(d => {
            if (!d || !d.date) return;
            const existing = map[d.date];
            const isConflict = existing && (
                Math.round(existing.calories || 0) !== Math.round(d.calories || 0) ||
                Math.round(existing.protein || 0)  !== Math.round(d.protein || 0)  ||
                Math.round(existing.carbs || 0)    !== Math.round(d.carbs || 0)    ||
                Math.round(existing.fat || 0)      !== Math.round(d.fat || 0)
            );
            if (isConflict && overwriteDates && !overwriteDates.has(d.date)) return; // לא לדרוס
            map[d.date] = d;   // יום חדש או דריסה מאושרת
        });
        const merged = Object.values(map).sort((a, b) => a.date < b.date ? -1 : 1);
        this.saveData(this.KEY_NUTRITION_DAILY, merged);
        return merged;
    },

    // mfpConflicts — מחזיר רשימת ימי התנגשות (קיים שונה מהנכנס) לתצוגה בדיאלוג
    mfpConflicts(days) {
        const map = {};
        this.getNutritionDaily().forEach(d => { if (d && d.date) map[d.date] = d; });
        const out = [];
        (days || []).forEach(d => {
            if (!d || !d.date) return;
            const ex = map[d.date];
            if (!ex) return;
            const diff = Math.round(ex.calories || 0) !== Math.round(d.calories || 0) ||
                Math.round(ex.protein || 0) !== Math.round(d.protein || 0) ||
                Math.round(ex.carbs || 0)   !== Math.round(d.carbs || 0)   ||
                Math.round(ex.fat || 0)     !== Math.round(d.fat || 0);
            if (diff) out.push({ date: d.date, existing: ex, incoming: d });
        });
        return out.sort((a, b) => a.date < b.date ? 1 : -1);   // חדש→ישן
    },

    // ── פרופיל גוף (TDEE) ────────────────────────────────────────────────
    getBodyProfile() {
        return this.getData(this.KEY_BODY_PROFILE) || { sex: '', age: null, height: null, activity: 'moderate' };
    },

    saveBodyProfile(p) {
        const cur = this.getBodyProfile();
        this.saveData(this.KEY_BODY_PROFILE, Object.assign({}, cur, p));
    },

    // ברירת מחדל דלוק: רק '0' מפורש מכבה (לא לשבור משתמשים קיימים בלי מפתח שמור)
    getMfpBridge() {
        return {
            on:    localStorage.getItem(this.KEY_MFP_BRIDGE_ON) !== '0',
            url:   localStorage.getItem(this.KEY_MFP_BRIDGE_URL) || '',
            token: localStorage.getItem(this.KEY_MFP_BRIDGE_TOKEN) || ''
        };
    },

    saveMfpBridge(on, url, token) {
        localStorage.setItem(this.KEY_MFP_BRIDGE_ON, on ? '1' : '0');
        if (url !== undefined)   localStorage.setItem(this.KEY_MFP_BRIDGE_URL, (url || '').trim());
        if (token !== undefined) localStorage.setItem(this.KEY_MFP_BRIDGE_TOKEN, (token || '').trim());
    },
    isMfpBridgeOn() {
        return localStorage.getItem(this.KEY_MFP_BRIDGE_ON) !== '0';
    },

    // ── Health Bridge (סנכרון תזונה מ-Apple Health דרך Shortcuts) ──────────
    getHealthBridge() {
        return {
            on:    localStorage.getItem(this.KEY_HEALTH_BRIDGE_ON) !== '0',
            url:   localStorage.getItem(this.KEY_HEALTH_BRIDGE_URL) || '',
            token: localStorage.getItem(this.KEY_HEALTH_BRIDGE_TOKEN) || ''
        };
    },

    saveHealthBridge(on, url, token) {
        localStorage.setItem(this.KEY_HEALTH_BRIDGE_ON, on ? '1' : '0');
        if (url !== undefined)   localStorage.setItem(this.KEY_HEALTH_BRIDGE_URL, (url || '').trim());
        if (token !== undefined) localStorage.setItem(this.KEY_HEALTH_BRIDGE_TOKEN, (token || '').trim());
    },
    isHealthBridgeOn() {
        return localStorage.getItem(this.KEY_HEALTH_BRIDGE_ON) !== '0';
    },

    getHealthLastSync() {
        return parseInt(localStorage.getItem(this.KEY_HEALTH_LAST_SYNC), 10) || 0;
    },
    setHealthLastSync(ts) {
        localStorage.setItem(this.KEY_HEALTH_LAST_SYNC, String(ts));
    },

    // ── Watch Bridge (גשר אפל-ווטש) — כבוי כברירת מחדל ──
    getWatchBridge() {
        return {
            on:    localStorage.getItem(this.KEY_WATCH_BRIDGE_ON) === '1',
            url:   localStorage.getItem(this.KEY_WATCH_BRIDGE_URL) || '',
            token: localStorage.getItem(this.KEY_WATCH_BRIDGE_TOKEN) || ''
        };
    },
    saveWatchBridge(on, url, token) {
        localStorage.setItem(this.KEY_WATCH_BRIDGE_ON, on ? '1' : '0');
        if (url !== undefined)   localStorage.setItem(this.KEY_WATCH_BRIDGE_URL, (url || '').trim());
        if (token !== undefined) localStorage.setItem(this.KEY_WATCH_BRIDGE_TOKEN, (token || '').trim());
    },
    isWatchBridgeOn() {
        return localStorage.getItem(this.KEY_WATCH_BRIDGE_ON) === '1';
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
        localStorage.removeItem(this.KEY_COACH_MEMORY);
    },

    // ── Coach Memory — תקציר מתגלגל של תובנות מהשיחה (זיכרון ארוך-טווח למאמן) ──
    getCoachMemory() {
        try { return JSON.parse(localStorage.getItem(this.KEY_COACH_MEMORY)) || { text: '', coveredLen: 0, updatedAt: 0 }; }
        catch(e) { return { text: '', coveredLen: 0, updatedAt: 0 }; }
    },
    setCoachMemory(mem) {
        try { localStorage.setItem(this.KEY_COACH_MEMORY, JSON.stringify(mem)); }
        catch(e) { console.error('GymPro: coach memory write error', e); }
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
    NUTRITION_RAW_CHUNK_SIZE: 1000,         // שורות per-meal לכל מסמך (~150KB) — מניעה מוחלטת של חריגת 1MB
    _db: null,
    _initialized: false,
    _authReady: null,  // Promise שמסתיים כשה-Anonymous Auth הושלם

    // בודק אם Firebase מוגדר (יש config ב-LocalStorage)
    isConfigured() {
        const cfg = this.getFirebaseConfig();
        return !!(cfg && cfg.apiKey && cfg.projectId);
    },

    // ── הגנת דריסה (Sync Guard) ───────────────────────────────────────────────
    // מונע שמכשיר במצב ריק (אחרי התקנה מחדש) ידרוס את הגיבוי בענן עם ריק.
    // העלאות לענן חסומות עד ש-"זויין": ע"י שחזור מוצלח, העלאה מפורשת, או
    // grandfather בעלייה (מכשיר עם דאטה קיימת = המקור, בטוח לדחוף).
    KEY_SYNC_ARMED: 'gympro_sync_armed',
    _isSyncArmed() { return localStorage.getItem(this.KEY_SYNC_ARMED) === '1'; },
    _armSync() { try { localStorage.setItem(this.KEY_SYNC_ARMED, '1'); } catch (e) {} },

    // נקרא פעם אחת בעליית האפליקציה: אם Firebase מוגדר ויש כבר דאטה מקומית
    // משמעותית — המכשיר הזה הוא מקור-האמת, מזיינים. מצב ריק נשאר חסום.
    armSyncOnBoot() {
        if (this._isSyncArmed() || !this.isConfigured()) return;
        const has = (StorageManager.getArchive().length > 0) ||
                    (StorageManager.getBodyLog().length > 0) ||
                    (StorageManager.getFoodDb().length > 0) ||
                    (StorageManager.getNutritionDaily().length > 0);
        if (has) this._armSync();
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
            // persistence — מאפשר ל-onSnapshot/קריאות לעבוד גם offline ולסגור פערי-סנכרון (R12)
            try { this._db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (e) { /* כבר מאותחל / לא נתמך */ }
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
        // טעינת ה-SDK on-demand אם עוד לא נטען (lazy load מ-index.html)
        if (typeof firebase === 'undefined' && typeof window.loadFirebaseSDK === 'function') {
            try { await window.loadFirebaseSDK(); } catch (e) { return false; }
        }
        if (!this.init()) return false;
        await this._authReady;
        return true;
    },

    // ── Live Session (גשר שעון⇄טלפון) ──────────────────────────────────────────
    // doc יחיד gympro_data/live_session — מקור-אמת חי של האימון הנוכחי.
    // נושא נתוני אימון בלבד (לא UI/טיימר/ניווט). כל הפעולות עטופות ב-timeout (R13)
    // כדי שלא יחסמו את ה-UI (offline-first).

    _withTimeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise((_, rej) => setTimeout(() => rej(new Error('LIVE_TIMEOUT')), ms || 6000))
        ]);
    },

    // הייצוג ב-Firestore (Two-lane union, v15.92): { active: bool, data: "<json>", wlog: "<json>" }.
    //   data — מסלול הטלפון (metadata + סטי-טלפון 'p_'); נכתב רק ע"י ה-PWA.
    //   wlog — מסלול השעון (סטי-שעון 'w_' + מצביע-תרגיל); נכתב רק ע"י ה-proxy.
    // האיחוד נעשה כאן בקריאה: log ממוזג לפי setId, currentExName מהמסלול עם ה-currentTs
    // החדש יותר, setIdx נגזר מהלוג המאוחד. _wlogRev חושף ל-WatchBridge שינוי במסלול-השעון.
    _normLiveName(n) { return String(n || '').replace(/\s*\(Main\)\s*$/i, '').trim(); },
    _mergeLiveLog(a, b) {
        const seen = new Set(), out = [];
        [a, b].forEach(arr => (Array.isArray(arr) ? arr : []).forEach(e => {
            if (e && e.setId && !seen.has(e.setId)) { seen.add(e.setId); out.push(e); }
        }));
        return out;
    },
    _unwrapLive(d) {
        if (!d) return null;
        let dataObj = {}, wlogObj = {};
        try { dataObj = d.data ? JSON.parse(d.data) : {}; } catch (e) { dataObj = {}; }
        try { wlogObj = d.wlog ? JSON.parse(d.wlog) : {}; } catch (e) { wlogObj = {}; }
        const out = Object.assign({}, dataObj);
        out.log = this._mergeLiveLog(dataObj.log, wlogObj.log);
        const dTs = dataObj.currentTs || 0, wTs = wlogObj.currentTs || 0;
        if (wTs > dTs && wlogObj.currentExName) out.currentExName = wlogObj.currentExName;
        const curN = this._normLiveName(out.currentExName);
        out.setIdx = out.log.filter(e => e && !e.skip && this._normLiveName(e.exName) === curN).length;
        out.rev = Math.max(dataObj.rev || 0, wlogObj.rev || 0);
        out._wlogRev = wlogObj.rev || 0;
        if (typeof d.active === 'boolean') out.active = d.active;   // active ברמה-עליונה קובע
        return out;
    },

    // publishLiveSession — כותב את מסלול-הטלפון בלבד (merge ברמת-שדה משאיר את wlog).
    // resetWlog=true (בתחילת סשן) מאפס את מסלול-השעון כדי שלא יישארו סטים מסשן קודם.
    async publishLiveSession(obj, resetWlog) {
        try {
            if (!await this._withTimeout(this._ensureReady(), 6000)) return false;
            obj.lastUpdated = Date.now();
            const payload = { active: !!obj.active, data: JSON.stringify(obj), lastUpdated: obj.lastUpdated };
            if (resetWlog) payload.wlog = '{}';
            await this._withTimeout(
                this._db.collection('gympro_data').doc('live_session').set(payload, { merge: true }), 6000);
            return true;
        } catch (e) { console.warn('GymPro live publish skipped:', e && e.message); return false; }
    },

    async getLiveSession() {
        try {
            if (!await this._withTimeout(this._ensureReady(), 6000)) return null;
            const doc = await this._withTimeout(
                this._db.collection('gympro_data').doc('live_session').get(), 6000);
            return doc.exists ? this._unwrapLive(doc.data()) : null;
        } catch (e) { console.warn('GymPro live get skipped:', e && e.message); return null; }
    },

    // listenLiveSession — onSnapshot; מחזיר פונקציית unsubscribe (או no-op בכשל).
    // ה-SDK נטען lazily: אם עוד לא נטען, ההאזנה מתחברת לאחר הטעינה ברקע. חוזה ה-unsubscribe
    // הסינכרוני נשמר — מחזירים wrapper שמבטל גם אם החיבור עוד לא הושלם.
    listenLiveSession(cb) {
        const self = this;
        let realUnsub = null, cancelled = false;
        const attach = () => {
            try {
                if (cancelled || !self.init()) return;
                realUnsub = self._db.collection('gympro_data').doc('live_session')
                    .onSnapshot(
                        doc => { try { cb(doc.exists ? self._unwrapLive(doc.data()) : null); } catch (e) { /* cb הגנתי */ } },
                        err => console.warn('GymPro live listen error:', err && err.message)
                    );
            } catch (e) { console.warn('GymPro live listen skipped:', e && e.message); }
        };
        if (typeof firebase === 'undefined' && typeof window.loadFirebaseSDK === 'function') {
            window.loadFirebaseSDK().then(attach).catch(() => {});
        } else {
            attach();
        }
        return () => { cancelled = true; if (realUnsub) realUnsub(); };
    },

    // clearLiveSession — מאפס את שני המסלולים (data+wlog) כדי שסטים מסשן קודם לא
    // ידלפו לסשן הבא דרך האיחוד-בקריאה.
    async clearLiveSession() {
        try {
            if (!await this._withTimeout(this._ensureReady(), 6000)) return false;
            await this._withTimeout(
                this._db.collection('gympro_data').doc('live_session')
                    .set({ active: false, data: '{}', wlog: '{}', lastUpdated: Date.now() }, { merge: true }), 6000);
            return true;
        } catch (e) { console.warn('GymPro live clear skipped:', e && e.message); return false; }
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
        if (!this._isSyncArmed()) { console.warn('GymPro: sync not armed — דילוג על העלאת ארכיון (הגנת ענן)'); return false; }
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
            const items = await this._fetchArchiveItems();
            if (!items) {
                showAlert('לא נמצאו נתוני ארכיון בענן.');
                return;
            }
            // אישור לפני דריסת הארכיון המקומי — שחזור מהענן מוחק עריכות מקומיות שלא גובו
            const localCount = (StorageManager.getArchive() || []).length;
            showConfirm(
                `לשחזר ${items.length} אימונים מהענן? הפעולה תדרוס את הארכיון המקומי (${localCount} אימונים).`,
                () => {
                    const ok = StorageManager.saveData(StorageManager.KEY_ARCHIVE, items);
                    if (!ok) { showAlert('שגיאה: הארכיון לא נשמר מקומית (אחסון מלא?). הנתונים המקומיים לא נדרסו.'); return; }
                    this._armSync();
                    showAlert('הארכיון שוחזר מהענן!', () => { window.location.reload(); });
                }
            );
        } catch(e) {
            showAlert('שגיאה בטעינה מהענן: ' + e.message);
        }
    },

    // קריאת פריטי הארכיון מהענן (chunks חדש או legacy) — ללא שמירה/UI. מניח _db מוכן.
    // מחזיר מערך פריטים, או null אם אין ארכיון בענן (כדי לא לדרוס מקומי).
    async _fetchArchiveItems() {
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
        return items;
    },

    // ── Nutrition Raw (קובץ MFP גולמי) ────────────────────────────────────────
    // מפוצל ל-chunks (nutrition_raw_meta + nutrition_raw_0/1/...) — מניעה מוחלטת
    // של חריגת 1MB-למסמך, בדיוק כמו הארכיון. ה-header/dateIdx נשמרים ב-meta.
    async saveNutritionRawToCloud() {
        if (!this._isSyncArmed()) { console.warn('GymPro: sync not armed — דילוג על העלאת raw (הגנת ענן)'); return false; }
        if (!await this._ensureReady()) return false;
        try {
            const raw = StorageManager.getNutritionRaw();           // { header, rows, dateIdx } | null
            const rows = (raw && Array.isArray(raw.rows)) ? raw.rows : [];
            const col = this._db.collection('gympro_data');
            const size = this.NUTRITION_RAW_CHUNK_SIZE;
            const chunkCount = rows.length ? Math.ceil(rows.length / size) : 0;
            const now = Date.now();

            let prevCount = 0;
            try {
                const metaDoc = await col.doc('nutrition_raw_meta').get();
                if (metaDoc.exists) prevCount = metaDoc.data().chunkCount || 0;
            } catch { /* פעם ראשונה */ }

            const batch = this._db.batch();
            for (let i = 0; i < chunkCount; i++) {
                // Firestore אוסר מערך-בתוך-מערך; שומרים את שורות ה-chunk כמחרוזת JSON אחת
                batch.set(col.doc(`nutrition_raw_${i}`), { rowsJson: JSON.stringify(rows.slice(i * size, (i + 1) * size)), updatedAt: now });
            }
            // מחיקת chunks מיותרים (הקובץ התכווץ מאז הסנכרון הקודם)
            for (let i = chunkCount; i < prevCount; i++) {
                batch.delete(col.doc(`nutrition_raw_${i}`));
            }
            batch.set(col.doc('nutrition_raw_meta'), {
                chunkCount,
                header:  raw ? raw.header : null,
                dateIdx: raw && raw.dateIdx != null ? raw.dateIdx : 0,
                total:   rows.length,
                updatedAt: now
            });
            await batch.commit();
            return true;
        } catch(e) {
            console.error('GymPro saveNutritionRaw error:', e);
            return false;
        }
    },

    // _loadNutritionRawSilent — מאחד את ה-chunks וטוען ל-localStorage. ללא UI;
    // נקרא מתוך loadConfigFromCloud. לא דורס מקומי אם אין נתונים בענן.
    async _loadNutritionRawSilent() {
        try {
            const col = this._db.collection('gympro_data');
            const metaDoc = await col.doc('nutrition_raw_meta').get();
            if (!metaDoc.exists) return;
            const meta = metaDoc.data();
            const chunkCount = meta.chunkCount || 0;
            if (!chunkCount) return;                                  // אין raw בענן — אל תדרוס מקומי
            const docs = await Promise.all(
                Array.from({ length: chunkCount }, (_, i) => col.doc(`nutrition_raw_${i}`).get())
            );
            const rows = [];
            docs.forEach(d => {
                if (!d.exists) return;
                const data = d.data();
                if (typeof data.rowsJson === 'string') {
                    try { const arr = JSON.parse(data.rowsJson); if (Array.isArray(arr)) rows.push(...arr); } catch {}
                } else if (Array.isArray(data.rows)) {
                    rows.push(...data.rows);   // תאימות לאחור (אם נשמר פעם כמערך)
                }
            });
            if (rows.length) {
                StorageManager.saveData(StorageManager.KEY_NUTRITION_RAW, {
                    header:  meta.header || (rows[0] || []),
                    rows,
                    dateIdx: meta.dateIdx != null ? meta.dateIdx : 0
                });
            }
        } catch(e) {
            console.error('GymPro loadNutritionRaw error:', e);
        }
    },

    // ── Config ───────────────────────────────────────────────────────────────

    async saveConfigToCloud() {
        if (!this._isSyncArmed()) { console.warn('GymPro: sync not armed — דילוג על העלאת קונפיג (הגנת ענן)'); return false; }
        if (!await this._ensureReady()) return false;
        try {
            const configData = {
                workouts:       StorageManager.getData(StorageManager.KEY_DB_WORKOUTS),
                exercises:      StorageManager.getData(StorageManager.KEY_DB_EXERCISES),
                meta:           StorageManager.getData(StorageManager.KEY_META),
                analyticsPrefs: StorageManager.getAnalyticsPrefs(),
                nutrition:      StorageManager.getNutritionalState(),
                nutritionLog:   StorageManager.getNutritionLog(),
                nutritionDaily: StorageManager.getNutritionDaily(),
                foodLog:        StorageManager.getFoodLog(),
                foodDb:         StorageManager.getFoodDb(),
                bodyProfile:    StorageManager.getBodyProfile(),
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
            // קוראים את הענן ומציגים מה יש בו לפני דריסת המקומי (הגנה מבלבול)
            const doc = await this._db.collection('gympro_data').doc('config').get();
            if (!doc.exists) { showAlert('לא נמצאו נתוני קונפיג בענן.'); return; }
            const d = doc.data() || {};
            const summary = 'בענן: ' +
                (Array.isArray(d.bodylog) ? d.bodylog.length : 0) + ' שקילות, ' +
                (Array.isArray(d.nutritionDaily) ? d.nutritionDaily.length : 0) + ' ימי תזונה, ' +
                (d.foodLog && typeof d.foodLog === 'object' ? Object.keys(d.foodLog).length : 0) + ' ימי יומן, ' +
                (Array.isArray(d.foodDb) ? d.foodDb.length : 0) + ' פריטי מאגר';
            showConfirm(summary + '.\nלשחזר ולדרוס את המקומי?', async () => {
                await this._applyConfigData(d);
                await this._loadNutritionRawSilent();
                this._armSync();   // שוחזר מהענן — מעכשיו בטוח לדחוף מהמכשיר הזה
                showAlert('הקונפיג שוחזר מהענן!', () => { window.location.reload(); });
            });
        } catch(e) {
            showAlert('שגיאה בטעינה מהענן: ' + e.message);
        }
    },

    // משיכת מסמך config וכל ה-raw — ללא UI. מחזיר true אם נמצא config. מניח _db מוכן.
    async _loadConfigSilent() {
        const doc = await this._db.collection('gympro_data').doc('config').get();
        if (!doc.exists) return false;
        this._applyConfigData(doc.data());
        await this._loadNutritionRawSilent();   // הקובץ הגולמי מסונכרן ב-chunks נפרדים
        return true;
    },

    // _applyConfigData — כותב את שדות מסמך ה-config ל-localStorage. לא דורס מפתח שחסר בענן.
    _applyConfigData(data) {
        if (!data) return;
        if (data.workouts)       StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, data.workouts);
        if (data.exercises)      StorageManager.saveData(StorageManager.KEY_DB_EXERCISES, data.exercises);
        if (data.meta)           StorageManager.saveData(StorageManager.KEY_META, data.meta);
        if (data.analyticsPrefs) StorageManager.saveAnalyticsPrefs(data.analyticsPrefs);
        if (data.nutrition)      StorageManager.saveData(StorageManager.KEY_NUTRITION, data.nutrition);
        if (data.nutritionLog)   StorageManager.saveData(StorageManager.KEY_NUTRITION_LOG, data.nutritionLog);
        if (data.nutritionDaily) StorageManager.saveData(StorageManager.KEY_NUTRITION_DAILY, data.nutritionDaily);
        if (data.foodLog)        StorageManager.saveData(StorageManager.KEY_FOOD_LOG, data.foodLog);
        if (data.foodDb)         StorageManager.saveData(StorageManager.KEY_FOOD_DB, data.foodDb);
        if (data.bodyProfile)    StorageManager.saveData(StorageManager.KEY_BODY_PROFILE, data.bodyProfile);
        if (data.bodylog)        StorageManager.saveData(StorageManager.KEY_BODYLOG, data.bodylog);
        if (data.coachPrompts)   StorageManager.saveData(StorageManager.KEY_COACH_PROMPTS, data.coachPrompts);
    },

    // ── Upload All (העלאה ראשונית) ────────────────────────────────────────────

    async uploadAllToCloud() {
        if (!await this._ensureReady()) {
            showAlert('Firebase לא מוגדר. הגדר חיבור תחילה.');
            return;
        }
        // הגנה: אל תעלה (תדרוס את הענן) ממכשיר ריק. רק אם יש דאטה מקומית.
        const has = (StorageManager.getArchive().length > 0) || (StorageManager.getBodyLog().length > 0) ||
                    (StorageManager.getFoodDb().length > 0) || (StorageManager.getNutritionDaily().length > 0);
        if (!has) { showAlert('אין נתונים מקומיים להעלאה — בוטל כדי לא לדרוס את הגיבוי בענן.'); return; }
        this._armSync();   // העלאה מפורשת ממכשיר עם דאטה — מזיינים סנכרון
        try {
            const archiveOk = await this.saveArchiveToCloud();
            const configOk  = await this.saveConfigToCloud();
            const rawOk     = await this.saveNutritionRawToCloud();
            if (archiveOk && configOk && rawOk) {
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
        if (!this._isSyncArmed()) { console.warn('GymPro: sync not armed — דילוג על העלאת AI (הגנת ענן)'); return false; }
        if (!await this._ensureReady()) return false;
        try {
            const history = StorageManager.getAIHistory();
            await this._db.collection('gympro_data').doc('ai_history').set({
                messages: history,
                coachMemory: StorageManager.getCoachMemory(),
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
            const ok = await this._loadAIHistorySilent();
            if (!ok) { showAlert('לא נמצאה היסטוריית שיחות בענן.'); return; }
            this._armSync();
            showAlert('היסטוריית שיחות שוחזרה!', () => { window.location.reload(); });
        } catch(e) {
            showAlert('שגיאה בטעינה מהענן: ' + e.message);
        }
    },

    // משיכת היסטוריית AI + זיכרון מאמן — ללא UI. מחזיר true אם נמצאה בענן. מניח _db מוכן.
    async _loadAIHistorySilent() {
        const doc = await this._db.collection('gympro_data').doc('ai_history').get();
        if (!doc.exists || !doc.data().messages) return false;
        StorageManager.saveAIHistory(doc.data().messages);
        if (doc.data().coachMemory) StorageManager.setCoachMemory(doc.data().coachMemory);
        return true;
    },

    // ── Restore All (משיכה אוטומטית אחרי ייבוא קובץ חיבורים) ───────────────────
    // משיכה מלאה שקטה: ארכיון + קונפיג (תזונה/שקילה/יומן מזון/העדפות) + היסטוריית AI.
    // ללא pop-ups ביניים; מחזיר סיכום { archive, config, ai }. זורק אם Firebase לא מוכן.
    async restoreAllFromCloud() {
        if (!await this._ensureReady()) throw new Error('FIREBASE_NOT_READY');
        const result = { archive: 0, config: false, ai: false };
        const items = await this._fetchArchiveItems();
        if (items) {   // null = אין ארכיון בענן → לא דורסים מקומי
            const ok = StorageManager.saveData(StorageManager.KEY_ARCHIVE, items);
            result.archive = ok ? items.length : 0;
        }
        result.config = await this._loadConfigSilent();
        result.ai     = await this._loadAIHistorySilent();
        this._armSync();   // שוחזר מהענן — מעכשיו בטוח לדחוף מהמכשיר הזה
        return result;
    }
};
