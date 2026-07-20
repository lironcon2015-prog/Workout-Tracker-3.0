/**
 * GymPro Elite - Storage Manager
 * (הגרסה הנוכחית: ראה version.json)
 * Handles all LocalStorage operations. No native alert/confirm.
 */

const StorageManager = {
    KEY_WEIGHTS:      'gympro_weights',
    KEY_RM:           'gympro_rm',
    KEY_EXERCISE_TM:  'gympro_exercise_tm',   // TM קבוע לתרגילי מיין (מוגדר בהגדרות) — חוסך הזנת 1RM כל אימון
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
    KEY_SLEEP_DAILY:     'gympro_sleep_daily',        // שינה + התאוששות לפי יום (Apple Health)
    KEY_NUTRITION_NOTES: 'gympro_nutrition_notes',   // הערה חופשית לפי יום — עצמאי מ-NUTRITION_DAILY
    KEY_TARGET_HISTORY:  'gympro_target_history',     // לוג יעדי קלוריות/מאקרו אפקטיבי-מתאריך (v16.91)
    KEY_NUTRITION_RAW:   'gympro_nutrition_raw',      // הקובץ הגולמי המקורי (שורה לכל ארוחה)
    KEY_BODY_PROFILE:    'gympro_body_profile',        // מין/גיל/גובה/רמת פעילות — לחישוב TDEE
    KEY_PROFILE_REVIEW:  'gympro_profile_review',       // תזכורת בדיקת פרופיל AI: חותמת אישור + snapshot פאזה (מקומי, לא לסנכרון)
    KEY_MFP_BRIDGE_URL:   'gympro_mfp_bridge_url',    // Apps Script Web App URL
    KEY_MFP_BRIDGE_TOKEN: 'gympro_mfp_bridge_token',  // token סודי לגשר
    KEY_MFP_BRIDGE_ON:    'gympro_mfp_bridge_on',     // האם גשר MFP פעיל (ברירת מחדל: דלוק)
    KEY_HEALTH_BRIDGE_URL:   'gympro_health_bridge_url',    // גשר תזונה Apple Health
    KEY_HEALTH_BRIDGE_TOKEN: 'gympro_health_bridge_token',  // token סודי לגשר ה-Health
    KEY_HEALTH_BRIDGE_ON:    'gympro_health_bridge_on',     // האם גשר Health פעיל (ברירת מחדל: דלוק)
    KEY_HEALTH_PULL_NUTRITION: 'gympro_health_pull_nutrition', // משיכת תזונה מהגשר (כבוי כברירת מחדל; הגשר לשינה)
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
    KEY_BACKUP_BRIDGE_URL:   'gympro_backup_bridge_url',    // גשר גיבוי שבועי לאימייל (Apps Script)
    KEY_BACKUP_BRIDGE_TOKEN: 'gympro_backup_bridge_token',  // token סודי לגשר הגיבוי
    KEY_BACKUP_BRIDGE_ON:    'gympro_backup_bridge_on',     // האם גיבוי שבועי פעיל (ברירת מחדל: כבוי — דורש הקמת גשר)
    KEY_BACKUP_LAST:         'gympro_backup_last',          // timestamp שליחת גיבוי מוצלחת אחרונה
    KEY_WIDGET_BRIDGE_URL:   'gympro_widget_bridge_url',    // גשר ווידג'ט אייפון (Apps Script + Scriptable)
    KEY_WIDGET_BRIDGE_TOKEN: 'gympro_widget_bridge_token',  // token סודי לגשר הווידג'ט
    KEY_WIDGET_BRIDGE_ON:    'gympro_widget_bridge_on',     // האם דחיפת snapshot לווידג'ט פעילה (ברירת מחדל: כבוי)
    KEY_WIDGET_LAST_PUSH:    'gympro_widget_last_push',     // timestamp דחיפת snapshot מוצלחת אחרונה
    KEY_PHOTO_BRIDGE_URL:   'gympro_photo_bridge_url',    // גשר תמונות התקדמות — Google Drive (Apps Script)
    KEY_PHOTO_BRIDGE_TOKEN: 'gympro_photo_bridge_token',  // token סודי לגשר התמונות
    KEY_PHOTO_BRIDGE_ON:    'gympro_photo_bridge_on',     // האם גשר התמונות פעיל (ברירת מחדל: כבוי)
    KEY_PHOTO_INDEX:        'gympro_photo_index',         // אינדקס תמונות קל [{date, driveId, bytes}] — רוכב על config, בלי bytes של תמונות
    KEY_PHOTO_TREND:        'gympro_photo_trend',         // זיכרון ניתוח ה-AI המשורשר (JSON קטן) — רוכב על config

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

    // TM קבוע לתרגיל-מיין (מוגדר ידנית בהגדרות) — null = לא מוגדר, חוזר לזרימת ה-1RM הידנית
    getExerciseTM(exName) {
        const data = this.getData(this.KEY_EXERCISE_TM) || {};
        return (data[exName] != null && data[exName] !== '') ? data[exName] : null;
    },

    getAllExerciseTMs() {
        return this.getData(this.KEY_EXERCISE_TM) || {};
    },

    saveExerciseTM(exName, tmVal) {
        const data = this.getData(this.KEY_EXERCISE_TM) || {};
        if (tmVal == null || tmVal === '') delete data[exName];
        else data[exName] = tmVal;
        this.saveData(this.KEY_EXERCISE_TM, data);
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
            exerciseTMs: this.getData(this.KEY_EXERCISE_TM),
            archive: this.getArchive()
        };
    },

    restoreData(dataObj) {
        if (dataObj.weights) this.saveData(this.KEY_WEIGHTS, dataObj.weights);
        if (dataObj.rms) this.saveData(this.KEY_RM, dataObj.rms);
        if (dataObj.exerciseTMs) this.saveData(this.KEY_EXERCISE_TM, dataObj.exerciseTMs);
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
            this.KEY_HEALTH_PULL_NUTRITION,
            this.KEY_WATCH_BRIDGE_URL,
            this.KEY_WATCH_BRIDGE_TOKEN,
            this.KEY_WATCH_BRIDGE_ON,
            this.KEY_BACKUP_BRIDGE_URL,
            this.KEY_BACKUP_BRIDGE_TOKEN,
            this.KEY_BACKUP_BRIDGE_ON,
            this.KEY_WIDGET_BRIDGE_URL,
            this.KEY_WIDGET_BRIDGE_TOKEN,
            this.KEY_WIDGET_BRIDGE_ON,
            this.KEY_PHOTO_BRIDGE_URL,
            this.KEY_PHOTO_BRIDGE_TOKEN,
            this.KEY_PHOTO_BRIDGE_ON,
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

    // ── Full Backup — צילום מלא של localStorage (v17.17) ─────────────────
    // כל מפתחות gympro_* כערכים גולמיים (מחרוזות, בלי parse) — שחזור מדויק
    // ביט-לביט של מצב האפליקציה, כולל סודות. עמיד לעתיד: מפתח חדש נכנס אוטומטית.
    // ⚠️ הקובץ מכיל את כל ה-API keys והטוקנים — לשמור במקום בטוח.

    // _isAppKey — שתי קידומות היסטוריות: 'gympro_' (רוב המפתחות) ו-'gympro-'
    // (בחירות רקע: gympro-bg-choices-v2). בלעדי המקף — בחירות הרקע אבדו בשחזור.
    _isAppKey(k) {
        return !!k && (k.indexOf('gympro_') === 0 || k.indexOf('gympro-') === 0);
    },

    // _backupManifest — מקרא קריא-לאדם בראש קובץ הגיבוי: אילו נתונים יש בו וכמה.
    _backupManifest() {
        const n = (arr) => Array.isArray(arr) ? arr.length : 0;
        let foodDays = 0;
        try { foodDays = Object.keys(this.getFoodLog() || {}).length; } catch (e) {}
        return {
            '_מקרא': 'GYMPRO ELITE — גיבוי מלא. הקובץ מכיל את כל נתוני האפליקציה וההגדרות. פירוט:',
            'אימונים בארכיון': n(this.getArchive()),
            'שקילות (משקל/שומן)': n(this.getBodyLog()),
            'ימי תזונה (סיכום יומי)': n(this.getNutritionDaily()),
            'לילות שינה והתאוששות': n(this.getSleepDaily()),
            'ימי יומן מזון': foodDays,
            'מצבים תזונתיים (היסטוריה)': n(this.getNutritionLog()),
            'כולל גם': 'פרופיל AI, פרומפטי מאמן, יעדים, פרופיל גוף, הגדרות, וחיבורי גשרים (URL/token)'
        };
    },

    buildFullBackup() {
        const keys = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (this._isAppKey(k)) keys[k] = localStorage.getItem(k);
        }
        return {
            type: 'gympro_full_backup',
            version: (typeof window !== 'undefined' && window._gymproVersion) || 'unknown',
            date: new Date().toISOString(),
            manifest: this._backupManifest(),
            keyCount: Object.keys(keys).length,
            keys
        };
    },

    exportFullBackup() {
        const payload = this.buildFullBackup();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
        a.download = `gympro_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    },

    restoreFullBackup(payload) {
        if (!payload || payload.type !== 'gympro_full_backup' || !payload.keys || typeof payload.keys !== 'object') {
            showAlert('שגיאה: זה אינו קובץ גיבוי מלא של GYMPRO.');
            return;
        }
        const count = Object.keys(payload.keys).length;
        if (!count) { showAlert('קובץ הגיבוי ריק.'); return; }
        const when = payload.date ? payload.date.slice(0, 10) : 'לא ידוע';
        showConfirm(`שחזור גיבוי מלא מ-${when} (${count} מפתחות). כל הנתונים וההגדרות הנוכחיים יידרסו והאפליקציה תחזור בדיוק למצב של מועד הגיבוי. להמשיך?`, () => {
            // מחיקת כל מפתחות האפליקציה הקיימים — שחזור מדויק, בלי שאריות
            const toRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (this._isAppKey(k)) toRemove.push(k);
            }
            toRemove.forEach(k => localStorage.removeItem(k));
            try {
                Object.keys(payload.keys).forEach(k => {
                    if (this._isAppKey(k)) localStorage.setItem(k, String(payload.keys[k]));
                });
            } catch (e) {
                console.error('GymPro: full backup restore error', e);
                showAlert('שגיאה בכתיבת הגיבוי (ייתכן שהאחסון מלא). המצב עשוי להיות חלקי — טען את הקובץ שוב.');
                return;
            }
            showAlert('הגיבוי שוחזר בהצלחה!', () => { window.location.reload(); });
        });
    },

    // ── גשר גיבוי שבועי לאימייל (Apps Script) — כבוי כברירת מחדל ──────────

    // _cleanPastedSecret — מסיר תווים בלתי-נראים שהדבקה בהקשר RTL מזריקה
    // (תווי כיווניות: U+200E/F, U+202A-E, U+2066-9, zero-width, BOM) וכל רווח.
    // בלעדיו fetch נכשל ב-Safari עם "The string did not match the expected pattern".
    // בטוח ל-URL ול-token — לעולם אינם מכילים רווחים או תווי כיווניות לגיטימיים.
    _cleanPastedSecret(s) {
        return String(s || '').replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\s]/g, '');
    },

    // הניקוי רץ גם בקריאה — מתקן ערכים שכבר נשמרו "מזוהמים", בלי הזנה מחדש
    getBackupBridge() {
        return {
            on:    localStorage.getItem(this.KEY_BACKUP_BRIDGE_ON) === '1',
            url:   this._cleanPastedSecret(localStorage.getItem(this.KEY_BACKUP_BRIDGE_URL)),
            token: this._cleanPastedSecret(localStorage.getItem(this.KEY_BACKUP_BRIDGE_TOKEN))
        };
    },
    saveBackupBridge(on, url, token) {
        localStorage.setItem(this.KEY_BACKUP_BRIDGE_ON, on ? '1' : '0');
        if (url !== undefined)   localStorage.setItem(this.KEY_BACKUP_BRIDGE_URL, this._cleanPastedSecret(url));
        if (token !== undefined) localStorage.setItem(this.KEY_BACKUP_BRIDGE_TOKEN, this._cleanPastedSecret(token));
    },
    getBackupLast() {
        return parseInt(localStorage.getItem(this.KEY_BACKUP_LAST), 10) || 0;
    },

    // maybeSendWeeklyBackup — נקרא בפתיחת האפליקציה (וידנית עם force).
    // שולח את הגיבוי המלא לגשר האימייל אם עברו ≥7 ימים מהשליחה האחרונה.
    // כשל שקט (רשת/גשר) — ינוסה שוב בפתיחה הבאה; force מציג שגיאות למשתמש.
    maybeSendWeeklyBackup(force) {
        const WEEK_MS = 7 * 86400000;
        const { on, url, token } = this.getBackupBridge();
        if (!on || !url) {
            if (force) showAlert('גשר הגיבוי אינו מוגדר או כבוי. הגדר URL והפעל את המתג.');
            return Promise.resolve(false);
        }
        if (!force && Date.now() - this.getBackupLast() < WEEK_MS) return Promise.resolve(false);
        // אידמפוטנטיות: הגשר שולח את המייל גם כשהתגובה לא חוזרת ללקוח (סגירת
        // האפליקציה/מעבר לרקע באמצע ה-fetch). לכן החותמת נרשמת לפני השליחה,
        // ומגולגלת אחורה רק בכשל מאומת — כך כשל אמיתי עדיין ינוסה בפתיחה הבאה,
        // אבל תגובה שאבדה לא תגרור מייל כפול.
        const prevLast = this.getBackupLast();
        localStorage.setItem(this.KEY_BACKUP_LAST, String(Date.now()));
        const payload = this.buildFullBackup();
        const body = {
            token,
            filename: `gympro_full_backup_${new Date().toISOString().slice(0, 10)}.json`,
            backup: payload
        };
        // Content-Type: text/plain — בקשה "פשוטה" בלי preflight; GAS מחזיר CORS פתוח
        return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
            .then(r => r.json())
            .then(res => {
                if (!res || !res.ok) throw new Error((res && res.error) || 'BRIDGE_ERROR');
                if (typeof showCloudToast === 'function') showCloudToast('📧 גיבוי שבועי נשלח לאימייל', true);
                if (force) showAlert('הגיבוי נשלח לאימייל בהצלחה!');
                return true;
            })
            .catch(e => {
                localStorage.setItem(this.KEY_BACKUP_LAST, String(prevLast));
                console.warn('GymPro: weekly backup send failed', e);
                if (force) showAlert('שליחת הגיבוי נכשלה: ' + (e && e.message ? e.message : 'שגיאת רשת') + '. בדוק את ה-URL, ה-token ופריסת הסקריפט.');
                return false;
            });
    },

    // ── גשר ווידג'ט אייפון (Apps Script + Scriptable) — כבוי כברירת מחדל ──
    // האפליקציה דוחפת snapshot קומפקטי (תזונה היום, משקל+מגמה, אימון אחרון);
    // ווידג'ט Scriptable מושך אותו ומרנדר על מסך הבית.

    getWidgetBridge() {
        return {
            on:    localStorage.getItem(this.KEY_WIDGET_BRIDGE_ON) === '1',
            url:   this._cleanPastedSecret(localStorage.getItem(this.KEY_WIDGET_BRIDGE_URL)),
            token: this._cleanPastedSecret(localStorage.getItem(this.KEY_WIDGET_BRIDGE_TOKEN))
        };
    },
    saveWidgetBridge(on, url, token) {
        localStorage.setItem(this.KEY_WIDGET_BRIDGE_ON, on ? '1' : '0');
        if (url !== undefined)   localStorage.setItem(this.KEY_WIDGET_BRIDGE_URL, this._cleanPastedSecret(url));
        if (token !== undefined) localStorage.setItem(this.KEY_WIDGET_BRIDGE_TOKEN, this._cleanPastedSecret(token));
    },
    getWidgetLastPush() {
        return parseInt(localStorage.getItem(this.KEY_WIDGET_LAST_PUSH), 10) || 0;
    },

    // buildWidgetSnapshot — הנתונים שהווידג'ט מציג (פריסת "גרסה 2"):
    // תזונה היום + יעדים + מאקרו, משקל אחרון + מגמה שבועית + 7 נקודות, אימון אחרון.
    buildWidgetSnapshot() {
        const pad = n => String(n).padStart(2, '0');
        const localDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const today = localDate(new Date());
        const prefs = this.getAnalyticsPrefs();

        const day = (this.getNutritionDaily() || []).find(x => x && x.date === today) || null;
        const nutrition = {
            calories: day ? Math.round(day.calories || 0) : 0,
            protein:  day ? Math.round(day.protein  || 0) : 0,
            carbs:    day ? Math.round(day.carbs    || 0) : 0,
            fat:      day ? Math.round(day.fat      || 0) : 0,
            kcalTarget:    Math.round(Number(prefs.kcalTarget)    || 0),
            proteinTarget: Math.round(Number(prefs.proteinTarget) || 0),
            carbsTarget:   Math.round(Number(prefs.carbsTarget)   || 0),
            fatTarget:     Math.round(Number(prefs.fatTarget)     || 0),
            state: (this.getNutritionalState() || {}).state || 'maintenance'
        };

        let weight = null;
        const log = (this.getBodyLog() || []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
        if (log.length) {
            const cur = log[log.length - 1];
            const cutoff = localDate(new Date(Date.now() - 7 * 86400000));
            const ref = log.find(e => e.date >= cutoff) || log[0];
            weight = {
                current: cur.weight, date: cur.date,
                weekDelta: Math.round((cur.weight - ref.weight) * 10) / 10,
                points: log.slice(-7).map(e => e.weight)
            };
        }

        let workout = null;
        const arch = this.getArchive() || [];
        if (arch.length) {
            const last = arch.reduce((a, b) => ((a.timestamp || 0) > (b.timestamp || 0) ? a : b));
            let sets = 0, vol = 0;
            if (last.details) Object.values(last.details).forEach(ex => {
                sets += (ex.sets || []).length;
                vol  += Number(ex.vol) || 0;
            });
            workout = { type: last.type || 'אימון', timestamp: last.timestamp || 0, sets, volume: Math.round(vol) };
        }

        return { generated: new Date().toISOString(), nutrition, weight, workout };
    },

    // maybePushWidgetSnapshot — נקרא בפתיחה/חזרה-לפוקוס. throttle 10 דק'; כשל שקט.
    maybePushWidgetSnapshot(force) {
        const THROTTLE_MS = 10 * 60000;
        const { on, url, token } = this.getWidgetBridge();
        if (!on || !url) {
            if (force) showAlert('גשר הווידג\'ט אינו מוגדר או כבוי. הגדר URL והפעל את המתג.');
            return Promise.resolve(false);
        }
        if (!force && Date.now() - this.getWidgetLastPush() < THROTTLE_MS) return Promise.resolve(false);
        const body = { token, snapshot: this.buildWidgetSnapshot() };
        return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
            .then(r => r.json())
            .then(res => {
                if (!res || !res.ok) throw new Error((res && res.error) || 'BRIDGE_ERROR');
                localStorage.setItem(this.KEY_WIDGET_LAST_PUSH, String(Date.now()));
                if (force) showAlert('ה-snapshot נדחף לגשר! הווידג\'ט יתעדכן ברענון הבא של iOS.');
                return true;
            })
            .catch(e => {
                console.warn('GymPro: widget snapshot push failed', e);
                if (force) showAlert('דחיפת ה-snapshot נכשלה: ' + (e && e.message ? e.message : 'שגיאת רשת') + '. בדוק את ה-URL, ה-token ופריסת הסקריפט.');
                return false;
            });
    },

    // pushWidgetSnapshotBeacon — ביציאה מהאפליקציה (visibilitychange→hidden):
    // sendBeacon שורד את סגירת הדף, בלי throttle — הווידג'ט מקבל את המצב הכי טרי.
    pushWidgetSnapshotBeacon() {
        const { on, url, token } = this.getWidgetBridge();
        if (!on || !url || typeof navigator === 'undefined' || !navigator.sendBeacon) return;
        try {
            const body = JSON.stringify({ token, snapshot: this.buildWidgetSnapshot() });
            navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=utf-8' }));
        } catch (e) { /* beacon הוא best-effort */ }
    },

    // ── גשר תמונות התקדמות (Apps Script → Google Drive) — כבוי כברירת מחדל ──
    // התמונות המלאות נשמרות בדרייב (מקור אמת); IndexedDB הוא cache מקומי בלבד.
    // הלוגיקה עצמה ב-photos-logic.js — כאן רק ה-config וה-accessors.

    getPhotoBridge() {
        return {
            on:    localStorage.getItem(this.KEY_PHOTO_BRIDGE_ON) === '1',
            url:   this._cleanPastedSecret(localStorage.getItem(this.KEY_PHOTO_BRIDGE_URL)),
            token: this._cleanPastedSecret(localStorage.getItem(this.KEY_PHOTO_BRIDGE_TOKEN))
        };
    },
    savePhotoBridge(on, url, token) {
        localStorage.setItem(this.KEY_PHOTO_BRIDGE_ON, on ? '1' : '0');
        if (url !== undefined)   localStorage.setItem(this.KEY_PHOTO_BRIDGE_URL, this._cleanPastedSecret(url));
        if (token !== undefined) localStorage.setItem(this.KEY_PHOTO_BRIDGE_TOKEN, this._cleanPastedSecret(token));
    },

    // אינדקס תמונות קל (בלי bytes של תמונות!) + זיכרון מגמת ה-AI — שניהם
    // רוכבים על מסמך ה-config בענן, ולכן חייבים להישאר קטנים.
    getPhotoIndex()      { return this.getData(this.KEY_PHOTO_INDEX) || []; },
    savePhotoIndex(idx)  { return this.saveData(this.KEY_PHOTO_INDEX, idx || []); },
    getPhotoTrend()      { return this.getData(this.KEY_PHOTO_TREND) || null; },
    savePhotoTrend(t)    { return this.saveData(this.KEY_PHOTO_TREND, t); },

    // ── Configuration Export / Import ────────────────────────────────────

    exportConfiguration() {
        const prefs = this.getAnalyticsPrefs();
        const configData = {
            type: 'config_only',
            version: (typeof window !== 'undefined' && window._gymproVersion) || 'unknown',
            date: new Date().toISOString(),
            workouts: this.getData(this.KEY_DB_WORKOUTS),
            exercises: this.getData(this.KEY_DB_EXERCISES),
            meta: this.getData(this.KEY_META),
            exerciseTM: this.getData(this.KEY_EXERCISE_TM) || {},
            lastWeights: this.getData(this.KEY_WEIGHTS) || {},
            rmHistory: this.getData(this.KEY_RM) || {},
            hiddenThumbs: this.getData('gympro_hidden_thumbs') || [],
            aliases: prefs.workoutAliases || {},
            nutrition: this.getNutritionalState(),
            nutritionLog: this.getNutritionLog(),
            nutritionDaily: this.getNutritionDaily(),
            sleepDaily: this.getSleepDaily(),
            nutritionNotes: this.getNutritionNotes(),
            targetHistory: this.getTargetHistory(),
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
                avatar:             prefs.avatar,
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
            if (data.exerciseTM)   this.saveData(this.KEY_EXERCISE_TM, data.exerciseTM);
            if (data.lastWeights)  this.saveData(this.KEY_WEIGHTS, data.lastWeights);
            if (data.rmHistory)    this.saveData(this.KEY_RM, data.rmHistory);
            if (data.hiddenThumbs) this.saveData('gympro_hidden_thumbs', data.hiddenThumbs);
            // מיזוג prefs — מעדכן שדות ספציפיים בלי לדרוס שדות שאינם בקובץ
            const prefs = this.getAnalyticsPrefs();
            if (data.aliases)        prefs.workoutAliases    = data.aliases;
            if (data.analyticsPrefs) {
                const ap = data.analyticsPrefs;
                ['heroMetrics','volumeRange','muscleRange','consistencyRange','consistencyGreen','consistencyOrange','microPoints','microAxis','microOrder','formula','units','name','avatar','homePRRange','workoutAliasColors','kcalTarget','kcalTargetManual','proteinTarget','carbsTarget','fatTarget','mealLabels'].forEach(k => {
                    if (ap[k] !== undefined) prefs[k] = ap[k];
                });
            }
            this.saveAnalyticsPrefs(prefs);
            if (data.nutrition)      this.saveData(this.KEY_NUTRITION, data.nutrition);
            if (data.nutritionLog)   this.saveData(this.KEY_NUTRITION_LOG, data.nutritionLog);
            if (data.nutritionDaily) this.saveData(this.KEY_NUTRITION_DAILY, data.nutritionDaily);
            if (data.sleepDaily)     this.saveData(this.KEY_SLEEP_DAILY, data.sleepDaily);
            if (data.nutritionNotes) this.saveData(this.KEY_NUTRITION_NOTES, data.nutritionNotes);
            if (data.targetHistory)  this.saveData(this.KEY_TARGET_HISTORY, data.targetHistory);
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

    // ── Sleep / Recovery (שינה + התאוששות מ-Apple Health) ─────────────────
    getSleepDaily() {
        return this.getData(this.KEY_SLEEP_DAILY) || [];
    },
    saveSleepDaily(arr) {
        this.saveData(this.KEY_SLEEP_DAILY, arr || []);
    },
    // mergeSleepDays — מיזוג לילות מגשר ה-Health (upsert לפי תאריך, src:'health').
    mergeSleepDays(nights) {
        const map = {};
        this.getSleepDaily().forEach(d => { if (d && d.date) map[d.date] = d; });
        let changed = 0;
        (nights || []).forEach(d => {
            if (!d || !d.date) return;
            const existing = map[d.date];
            const merged = Object.assign({}, existing, d, { src: 'health' });
            // יעילות שינה נגזרת אם לא סופקה (asleep/inbed)
            if (merged.efficiency == null && merged.inBedMin > 0 && merged.asleepMin != null) {
                merged.efficiency = Math.round((merged.asleepMin / merged.inBedMin) * 100) / 100;
            }
            // שינה בסיסית (Core) נגזרת אם לא סופקה: כוללת − עמוקה − REM.
            // מאפשר לקיצור לשלוח רק Deep+REM, והאפליקציה משלימה את ה-Core.
            if (!merged.coreMin && merged.asleepMin && (merged.deepMin || merged.remMin)) {
                merged.coreMin = Math.max(0, merged.asleepMin - (merged.deepMin || 0) - (merged.remMin || 0));
            }
            // ספירת שינוי רק אם באמת השתנה משהו — מונע "עדכון" בכל משיכה של אותו לילה
            if (existing && JSON.stringify(existing) === JSON.stringify(merged)) return;
            map[d.date] = merged;
            changed++;
        });
        if (!changed) return 0;
        const merged = Object.values(map).sort((a, b) => a.date < b.date ? -1 : 1);
        this.saveData(this.KEY_SLEEP_DAILY, merged);
        return changed;
    },

    // clearNutrition — מוחק את כל נתוני התזונה (סיכום יומי + קובץ גולמי).
    clearNutrition() {
        localStorage.removeItem(this.KEY_NUTRITION_DAILY);
        localStorage.removeItem(this.KEY_NUTRITION_RAW);
    },

    // הערה יומית — מפתח עצמאי מ-NUTRITION_DAILY כדי לא להידרס ע"י recompute/ייבוא MFP/Health,
    // ולאפשר הערה גם ביום בלי שום רשומת תזונה.
    getNutritionNotes() {
        return this.getData(this.KEY_NUTRITION_NOTES) || {};
    },
    getNutritionNote(date) {
        return this.getNutritionNotes()[date] || '';
    },
    setNutritionNote(date, note) {
        const notes = this.getNutritionNotes();
        const trimmed = (note || '').trim();
        if (trimmed) notes[date] = trimmed; else delete notes[date];
        this.saveData(this.KEY_NUTRITION_NOTES, notes);
    },

    // ── לוג יעדים אפקטיבי-מתאריך (v16.91) ────────────────────────────────
    // שינוי יעד קלוריות/מאקרו חל מהיום והלאה בלבד; ימי עבר מציגים את היעד
    // שהיה בתוקף בהם. מבנה: [{date:'YYYY-MM-DD', kcal, p, c, f}] ממוין עולה.
    getTargetHistory() { return this.getData(this.KEY_TARGET_HISTORY) || []; },

    // היעדים שהיו בתוקף בתאריך נתון.
    // היום ואילך → תמיד ההגדרות החיות (גם אחרי ייבוא/שחזור שעקף את הלוג).
    // עבר: הרשומה האחרונה שתאריכה ≤ התאריך; לוג ריק (טרם שונה יעד מאז v16.91) →
    // ההגדרות הנוכחיות (התנהגות עבר); לפני שהיו יעדים בכלל → ללא יעד.
    getTargetsForDate(date) {
        const live = () => {
            const p = this.getAnalyticsPrefs();
            return { kcal: p.kcalTarget || null, p: p.proteinTarget || null, c: p.carbsTarget || null, f: p.fatTarget || null };
        };
        if (!date || date >= this._todayStr()) return live();
        const hist = this.getTargetHistory();
        if (!hist.length) return live();
        let best = null;
        hist.forEach(h => { if (h.date <= date && (!best || h.date > best.date)) best = h; });
        return best || { kcal: null, p: null, c: null, f: null };
    },

    TARGET_GRACE_MS: 10 * 60 * 1000,   // כמו NUTRITION_GRACE_MS — "משחק בכפתורים" לא מזהם את הלוג

    // נקרא אחרי כל שמירת יעד (saveKcalTarget/saveMacroTarget), עם snapshot מ-לפני השינוי.
    // בפעם הראשונה מקבע את הערך הישן כ"מאז ומתמיד" — כדי שימי העבר לא יידרסו רטרואקטיבית.
    // חלון חסד (v16.94, כמו מצב התזונה): שינוי בתוך 10 דק' מרשומת-היום דורס אותה במקום
    // להצטבר, וחזרה לערכים שלפניה מקפלת אותה לגמרי — שינוי שגוי/בדיקה לא משאיר עקבות.
    recordTargetChange(prev) {
        const p = this.getAnalyticsPrefs();
        const now = { kcal: p.kcalTarget || null, p: p.proteinTarget || null, c: p.carbsTarget || null, f: p.fatTarget || null };
        const same = (a, b) => !!a && !!b && ['kcal', 'p', 'c', 'f'].every(k => (a[k] || null) === (b[k] || null));
        if (same(prev, now)) return;   // אין שינוי אפקטיבי
        const today = this._todayStr();
        const nowTs = Date.now();
        let hist = this.getTargetHistory();

        // חסד — רק על רשומת "היום" מהזרימה הראשית (לא על תיקוני עבר מהעורך הידני)
        const last = hist[hist.length - 1];
        if (last && last.date === today && (nowTs - (last.ts || 0)) < this.TARGET_GRACE_MS) {
            hist.pop();
            const tail = hist[hist.length - 1] || null;
            const emptyNow = !(now.kcal || now.p || now.c || now.f);
            if (!(tail ? same(tail, now) : emptyNow)) {
                hist.push(Object.assign({ date: today, ts: last.ts || nowTs }, now));   // דריסה, שמירת ts המקורי
            }
            // ניקוי seed מיותם: נשאר רק "מאז ומתמיד" עם ערכים זהים לנוכחיים — הלוג מיותר
            if (hist.length === 1 && hist[0].date === '2000-01-01' && same(hist[0], now)) hist = [];
            this.saveData(this.KEY_TARGET_HISTORY, hist);
            return;
        }

        if (!hist.length && prev && (prev.kcal || prev.p || prev.c || prev.f)) {
            hist.push(Object.assign({ date: '2000-01-01' }, prev));
        }
        hist = hist.filter(h => h.date !== today);   // כמה שינויים אמיתיים באותו יום — האחרון קובע
        hist.push(Object.assign({ date: today, ts: nowTs }, now));
        hist.sort((a, b) => a.date < b.date ? -1 : 1);
        this.saveData(this.KEY_TARGET_HISTORY, hist);
    },

    // עריכה ידנית של הלוג — עורך "יעדים לפי תאריך" בהגדרות (תיקוני עבר, v16.92)
    upsertTargetEntry(entry) {
        if (!entry || !entry.date) return false;
        const hist = this.getTargetHistory().filter(h => h.date !== entry.date);
        hist.push({ date: entry.date, kcal: entry.kcal || null, p: entry.p || null, c: entry.c || null, f: entry.f || null });
        hist.sort((a, b) => a.date < b.date ? -1 : 1);
        return this.saveData(this.KEY_TARGET_HISTORY, hist);
    },
    deleteTargetEntry(date) {
        this.saveData(this.KEY_TARGET_HISTORY, this.getTargetHistory().filter(h => h.date !== date));
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

    deleteFoodFromDb(id) {
        const db = this.getFoodDb().filter(f => f.id !== id);
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

    // עוטף לשימוש חוץ-קובץ (food-logic.js — חיפוש: דירוג תוצאות שתועדו בעבר)
    sortFoodsByMealUse(list, meal) {
        return list.slice().sort(this._mealSort(meal));
    },

    // מיון שכבות לתוצאות חיפוש של "המזונות שלך" (החלטת משתמש, v16.88):
    // (1) תועדו בארוחה הנוכחית — לפי שימוש אחרון בארוחה זו,
    // (2) מועדפים שלא תועדו בארוחה זו — לפי שימוש גלובלי,
    // (3) השאר (תועדו אי-פעם) — לפי שימוש גלובלי.
    sortUsedForSearch(list, meal) {
        const tier = f => {
            if (meal && f.mealUse && f.mealUse[meal] && f.mealUse[meal].lastUsed) return 0;
            if (f.favorite) return 1;
            return 2;
        };
        return list.slice().sort((a, b) => {
            const ta = tier(a), tb = tier(b);
            if (ta !== tb) return ta - tb;
            if (ta === 0) return b.mealUse[meal].lastUsed - a.mealUse[meal].lastUsed;
            return (b.lastUsed || 0) - (a.lastUsed || 0);
        });
    },

    // ניקוי חד-פעמי של זיהום cache חיפוש: עד v16.87 כל תוצאת חיפוש מהרשת נשמרה ל-DB
    // לצמיתות. מוחק רק רשומות רשת (off/usda/tzameret) ללא שום אות שימוש —
    // מותאמים / מועדפים / מתועדים / בעלי היסטוריית ארוחות לא נמחקים לעולם.
    pruneUnusedFoodCache() {
        const db = this.getFoodDb();
        const junk = f => ['off', 'usda', 'tzameret'].includes(f.source) &&
            !f.favorite && !(f.lastUsed > 0) && !((f.useCount || 0) > 0) &&
            !(f.mealUse && Object.keys(f.mealUse).length);
        const keep = db.filter(f => !junk(f));
        const removed = db.length - keep.length;
        if (removed > 0) this.saveData(this.KEY_FOOD_DB, keep);
        return removed;
    },

    recentFoods(n, meal) {
        return this.getFoodDb().filter(f => f.lastUsed)
            .sort(this._mealSort(meal)).slice(0, n || 20);
    },
    favoriteFoods(meal) {
        return this.getFoodDb().filter(f => f.favorite).sort(this._mealSort(meal));
    },
    customFoods() {
        // מותאמים + ארוחות שמורות (meal) + מוצרים סרוקים (gemini) + מוצרים חיצוניים שנערכו ידנית (edited) — כולם ניתנים לעריכה
        return this.getFoodDb().filter(f => f.source === 'custom' || f.source === 'meal' || f.source === 'gemini' || f.edited)
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

    // משיכת תזונה מהגשר — כבוי כברירת מחדל (הגשר משמש כעת לשינה בלבד).
    // נשאר בקוד כדי שאפשר יהיה לחזור ל-MFP בקליק אחד ללא גשר שני.
    isHealthPullNutrition() {
        return localStorage.getItem(this.KEY_HEALTH_PULL_NUTRITION) === '1';
    },
    setHealthPullNutrition(on) {
        localStorage.setItem(this.KEY_HEALTH_PULL_NUTRITION, on ? '1' : '0');
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

    // ── תזכורת בדיקת פרופיל AI (ג4) ─────────────────────────────────────────
    // הטריגר ל-badge הוא "המוקדם מביניהם": מעבר פאזה תזונתית מאז האישור האחרון
    // (הסיבה העיקרית לבדיקה — סעיף היעד בפרופיל דורש רענון), או גבול עליון של 21 יום.
    PROFILE_REVIEW_MAX_DAYS: 21,

    getProfileReview() {
        return this.getData(this.KEY_PROFILE_REVIEW) || { checkedAt: 0, phase: null };
    },

    markProfileReviewed() {
        const phase = (this.getNutritionalState() || {}).state || null;
        this.saveData(this.KEY_PROFILE_REVIEW, { checkedAt: Date.now(), phase });
    },

    isProfileReviewDue() {
        const r = this.getProfileReview();
        if (!r.checkedAt) return true;                              // מעולם לא אושר
        const curPhase = (this.getNutritionalState() || {}).state || null;
        if (r.phase !== curPhase) return true;                      // מעבר פאזה — טריגר עיקרי
        return (Date.now() - r.checkedAt) / 86400000 >= this.PROFILE_REVIEW_MAX_DAYS;
    },

    daysSinceProfileReview() {
        const r = this.getProfileReview();
        if (!r.checkedAt) return null;
        return Math.floor((Date.now() - r.checkedAt) / 86400000);
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
    // בלוק כללי אמינות — משותף לשלוש התבניות (סוגים 1-3 נשלחים ללא System Instruction,
    // ולכן חייבים להכיל את כללי האנטי-הזיה בגוף הפרומפט עצמו).
    COACH_RELIABILITY_BLOCK:
`# כללי אמינות (חובה)
- הסתמך אך ורק על הנתונים שבפרומפט זה. אל תמציא מספרים, מגמות, תאריכים או עובדות, ואל תסתמך על "ברו-סיינס". אם נדרש נתון שאינו מופיע — כתוב "הנתון לא זמין בסיכום זה", אל תנחש.
- המצב התזונתי הנוכחי הוא אך ורק השורה "מצב נוכחי" שבמקטע "מצב תזונתי". פאזה קודמת המופיעה שם הסתיימה — לעולם אל תתאר את המתאמן כנמצא בה. אל תשער פרטי קלוריות, גירעון/עודף או משקל שלא נמסרו.
- אם מקור אחר (פרופיל המתאמן, הערת אימון) סותר את מקטע "מצב תזונתי" — מקטע "מצב תזונתי" גובר. ציין את הסתירה בקצרה, אל תכריע מעבר לכך.
- אימוני עבר מתויגים בשורת [מצב תזונתי בזמן האימון: …] — נתח כל אימון עבר לפי התיוג שלו, ואת ההווה לפי "מצב נוכחי" בלבד.
- אל תשווה ביצועים בין ציוד שונה: מוט ≠ משקולות יד ≠ מכונה ≠ כבל, וציוד מזדמן (מלון/נסיעה) ≠ הציוד הקבוע. אם שני סשנים נבדלים בציוד — אל תסיק מהם מגמת כוח או רגרסיה; ציין שההשוואה אינה בת-תוקף.
- הערת סט/אימון שמסבירה אנומליה (שינוי זווית, ספסל, אחיזה, ציוד, מחלה) גוברת על חישוב הנפח. אל תפרש ירידת נפח כרגרסיה כאשר הערה מסבירה אותה — ציין את הסיבה שנמסרה.
- אל תמליץ על שינוי Training Max (העלאה, הורדה או איפוס). מותר לציין שביצוע מצביע על מרווח, בלי להציע מספר חדש.
- RIR המסומן "—" = לא תועד. אל תניח שהוא 0 ואל תמציא ערך; התעלם ממנו בניתוח איכות הסטים.`,

    // פרומפטי ברירת מחדל לסיכום מאמן — ניתנים לעריכה ע"י המשתמש (override).
    // {reliability} מוחלף בבלוק כללי האמינות למעלה בזמן בניית הפרומפט.
    COACH_PROMPT_DEFAULTS: {
        workout:
`אתה מאמן כוח מקצועי. נתח את האימון וכתוב סיכום מעמיק בעברית בפורמט Markdown, פותח בכותרת "## סיכום האימון".
התייחס ל: ביצוע מול היעד, נפח כולל ומגמה מול האימונים האחרונים של אותה תוכנית (רק כאשר הציוד זהה — אחרת ציין שאין השוואה תקפה), איכות הסטים (RIR), נקודות חוזק, ונקודה אחת לשיפור בפעם הבאה.

{reliability}

=== האימון הנוכחי ===
{workoutText}

=== מצב תזונתי (מקור אמת יחיד) ===
{nutrition}

=== פרופיל המתאמן ===
{persona}

=== אימונים אחרונים (אותה תוכנית) ===
{recentWorkouts}`,
        week:
`אתה מאמן כוח מקצועי. כתוב סיכום מעמיק בעברית בפורמט Markdown לסיום שבוע אימונים. כלול בדיוק את הכותרות הבאות:
"## סיכום האימון" — ניתוח האימון שהסתיים היום.
"## סיכום השבוע" — נפח כולל, עקביות, והתקדמות בתרגילי מפתח לאורך השבוע.
"## השוואה לבלוק הקודם" — השווה לשבוע/אימון המקביל בבלוק הקודם והדגש שיפור או נסיגה במספרים (רק בהשוואות בנות-תוקף מבחינת ציוד).

{reliability}

=== האימון שהסתיים היום ===
{workoutText}

=== אימוני השבוע (הבלוק הנוכחי, ללא האימון של היום) ===
{weekWorkouts}

=== האימון המקביל בבלוק הקודם ===
{parallelWorkout}

=== מצב תזונתי (מקור אמת יחיד) ===
{nutrition}

=== פרופיל המתאמן ===
{persona}`,
        block:
`אתה מאמן כוח מקצועי. כתוב סיכום מעמיק ומקיף בעברית בפורמט Markdown לסיום בלוק אימונים (מזוסייקל). כלול בדיוק את הכותרות הבאות:
"## סיכום האימון" — האימון שהסתיים היום.
"## סיכום השבוע" — שבוע 3 שהסתיים.
"## סיכום הבלוק" — התקדמות כוח ונפח לאורך 3 השבועות, תרגילים שהתקדמו או נתקעו, ומגמת העומס. אם הבלוק כלל יותר ממצב תזונתי אחד (לפי התיוגים) — נתח כל תקופה בהתאם למצבה.
"## המלצות לבלוק הבא" — 2-3 המלצות קונקרטיות לתכנון הבלוק הבא (ללא המלצות Training Max).

{reliability}

=== האימון שהסתיים היום ===
{workoutText}

=== אימוני הבלוק הנוכחי (ללא האימון של היום) ===
{blockWorkouts}

{analytics}

=== מצב תזונתי (מקור אמת יחיד) ===
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
    KEY_SYNC_STATUS: 'gympro_cloud_sync',  // מעקב הצלחת/כשל סנכרון פר-מסלול (archive/config/raw/ai)
    ARCHIVE_CHUNK_SIZE: 20,                 // אימונים לכל מסמך — שומר כל chunk הרבה מתחת ל-1MB
    NUTRITION_RAW_CHUNK_SIZE: 1000,         // שורות per-meal לכל מסמך (~150KB) — מניעה מוחלטת של חריגת 1MB
    FOOD_LOG_CHUNK_DAYS: 90,                // ימי יומן-מזון לכל מסמך (v17.15) — הוצא מ-config שגדל ללא גבול
    DOC_SIZE_WARN: 800 * 1024,              // סף אזהרה מקדימה לפני מחסום ה-1MB/doc של Firestore
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

    // ── Sync Status (#3, הורחב ב-v17.15) ───────────────────────────────────────
    // מעקב אחר הצלחת הסנכרון האחרון של כל ארבעת המסלולים (archive/config/raw/ai).
    // מפתחות: <store>Ok, <store>At, <store>Err ('size'/'other'), <store>Warn (bytes).
    // הבאנר בעליית האפליקציה ושורת הסטטוס בהגדרות נשענים על זה — כשל לעולם לא שקט.

    getSyncStatus() {
        try { return JSON.parse(localStorage.getItem(this.KEY_SYNC_STATUS)) || {}; }
        catch { return {}; }
    },

    _recordSync(store, ok, errType) {
        try {
            const s = this.getSyncStatus();
            s[store + 'Ok'] = ok;
            s[store + 'At'] = Date.now();
            if (ok || !errType) delete s[store + 'Err']; else s[store + 'Err'] = errType;
            localStorage.setItem(this.KEY_SYNC_STATUS, JSON.stringify(s));
        } catch { /* מקרה קצה — אחסון מלא; לא קריטי */ }
    },

    // אזהרת גודל מקדימה: נרשמת כשהמסמך מעל DOC_SIZE_WARN, נמחקת כשחוזר מתחת לסף.
    _recordSizeWarn(store, bytes) {
        try {
            const s = this.getSyncStatus();
            if (bytes) s[store + 'Warn'] = bytes; else delete s[store + 'Warn'];
            localStorage.setItem(this.KEY_SYNC_STATUS, JSON.stringify(s));
        } catch { /* לא קריטי */ }
    },

    // גודל משוער של מסמך בבייטים (אורך ה-JSON — קירוב טוב למגבלת Firestore)
    _estimateDocSize(obj) {
        try { return new Blob([JSON.stringify(obj)]).size; }
        catch { try { return JSON.stringify(obj).length; } catch { return 0; } }
    },

    // זיהוי שגיאת "מסמך גדול מדי" של Firestore (invalid-argument על חריגת ~1MB)
    _isDocTooLarge(e) {
        const msg = String((e && e.message) || e || '');
        return ((e && e.code === 'invalid-argument') && /size|bytes|exceeds|larger|1048487/i.test(msg)) ||
               /maximum allowed size|1048487/i.test(msg);
    },

    // תיאור הכשל האחרון של מסלול — להודעות UI מדויקות במקום "בדוק חיבור" גנרי
    describeSyncFailure(store) {
        const s = this.getSyncStatus();
        return s[store + 'Err'] === 'size'
            ? 'המסמך חורג ממגבלת Firestore (1MB)'
            : 'בדוק חיבור רשת';
    },

    // ── Archive ──────────────────────────────────────────────────────────────
    // הארכיון מפוצל למספר מסמכים (chunks) בקולקציה gympro_data כדי לעקוף את מחסום
    // 1MB-למסמך של Firestore. מבנה: archive_meta + archive_0, archive_1, ...
    // הכתיבה אטומית (batch). מסמך הארכיון הישן (archive) ממוגרר אוטומטית ונמחק.

    async saveArchiveToCloud() {
        if (!this._isSyncArmed()) { console.warn('GymPro: sync not armed — דילוג על העלאת ארכיון (הגנת ענן)'); return false; }
        if (!await this._ensureReady()) { this._recordSync('archive', false, 'other'); return false; }
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
            this._recordSync('archive', true);
            return true;
        } catch(e) {
            console.error('GymPro saveArchive error:', e);
            this._recordSync('archive', false, this._isDocTooLarge(e) ? 'size' : 'other');
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
        if (!await this._ensureReady()) { this._recordSync('raw', false, 'other'); return false; }
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
            this._recordSync('raw', true);
            return true;
        } catch(e) {
            console.error('GymPro saveNutritionRaw error:', e);
            this._recordSync('raw', false, this._isDocTooLarge(e) ? 'size' : 'other');
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
        if (!await this._ensureReady()) { this._recordSync('config', false, 'other'); return false; }
        try {
            const configData = {
                workouts:       StorageManager.getData(StorageManager.KEY_DB_WORKOUTS),
                exercises:      StorageManager.getData(StorageManager.KEY_DB_EXERCISES),
                meta:           StorageManager.getData(StorageManager.KEY_META),
                analyticsPrefs: StorageManager.getAnalyticsPrefs(),
                nutrition:      StorageManager.getNutritionalState(),
                nutritionLog:   StorageManager.getNutritionLog(),
                nutritionDaily: StorageManager.getNutritionDaily(),
                sleepDaily:     StorageManager.getSleepDaily(),
                nutritionNotes: StorageManager.getNutritionNotes(),
                targetHistory:  StorageManager.getTargetHistory(),
                // v17.15: foodLog הוצא מכאן — גדל ללא גבול (רשומה ליום) והיה מוביל את
                // המסמך אל מחסום ה-1MB. מסונכרן ב-chunks נפרדים (_saveFoodLogChunks).
                foodDb:         StorageManager.getFoodDb(),
                bodyProfile:    StorageManager.getBodyProfile(),
                bodylog:        StorageManager.getBodyLog(),
                coachPrompts:   StorageManager.getData(StorageManager.KEY_COACH_PROMPTS) || {},
                // v17.12: TM/משקלים אחרונים/היסטוריית 1RM/תמונות מוסתרות — בלעדיהם שחזור
                // מכשיר מהענן איבד בשקט את ה-TM, ה-prefill והעדפות בוחר התמונות
                exerciseTM:     StorageManager.getData(StorageManager.KEY_EXERCISE_TM) || {},
                lastWeights:    StorageManager.getData(StorageManager.KEY_WEIGHTS) || {},
                rmHistory:      StorageManager.getData(StorageManager.KEY_RM) || {},
                hiddenThumbs:   StorageManager.getData('gympro_hidden_thumbs') || [],
                // v17.24: תמונות התקדמות — אינדקס קל + זיכרון מגמת AI בלבד.
                // ה-bytes של התמונות לעולם לא כאן (Drive/IndexedDB בלבד — מחסום 1MB).
                photoIndex:     StorageManager.getPhotoIndex(),
                photoTrend:     StorageManager.getPhotoTrend() || {},
                updatedAt:      Date.now()
            };
            // אזהרה מקדימה על התקרבות למגבלת 1MB — כדי לדעת חודשים מראש, לא בדיעבד
            const bytes = this._estimateDocSize(configData);
            this._recordSizeWarn('config', bytes > this.DOC_SIZE_WARN ? bytes : null);
            await this._db.collection('gympro_data').doc('config').set(configData);
            await this._saveFoodLogChunks();
            this._recordSync('config', true);
            return true;
        } catch(e) {
            console.error('GymPro saveConfig error:', e);
            this._recordSync('config', false, this._isDocTooLarge(e) ? 'size' : 'other');
            return false;
        }
    },

    // ── Food Log (יומן מזון מובנה) ────────────────────────────────────────────
    // v17.15: מפוצל ל-chunks של 90 ימים (food_log_meta + food_log_0/1/...) —
    // בדיוק כמו הארכיון ו-nutrition_raw. chunk 0 = הימים הישנים ביותר, כך שימים
    // חדשים משנים רק את ה-chunk האחרון. נכתב מתוך saveConfigToCloud; מניח _db מוכן.
    async _saveFoodLogChunks() {
        const log = StorageManager.getFoodLog() || {};
        const dates = Object.keys(log).sort();
        const col = this._db.collection('gympro_data');
        const size = this.FOOD_LOG_CHUNK_DAYS;
        const chunkCount = dates.length ? Math.ceil(dates.length / size) : 0;
        const now = Date.now();

        let prevCount = 0;
        try {
            const metaDoc = await col.doc('food_log_meta').get();
            if (metaDoc.exists) prevCount = metaDoc.data().chunkCount || 0;
        } catch { /* פעם ראשונה */ }

        const batch = this._db.batch();
        for (let i = 0; i < chunkCount; i++) {
            const days = {};
            dates.slice(i * size, (i + 1) * size).forEach(d => { days[d] = log[d]; });
            // כמו nutrition_raw: JSON אחד למסמך — עוקף את איסור מערך-בתוך-מערך של Firestore
            batch.set(col.doc(`food_log_${i}`), { daysJson: JSON.stringify(days), updatedAt: now });
        }
        // מחיקת chunks מיותרים (היומן התכווץ מאז הסנכרון הקודם)
        for (let i = chunkCount; i < prevCount; i++) batch.delete(col.doc(`food_log_${i}`));
        batch.set(col.doc('food_log_meta'), { chunkCount, total: dates.length, updatedAt: now });
        await batch.commit();
    },

    // איחוד chunks של יומן המזון וטעינה ל-localStorage. לא דורס מקומי אם אין בענן.
    // config ישן (foodLog בתוך המסמך) מטופל ב-_applyConfigData; הקריאה כאן מגיעה
    // אחריו, כך שהמבנה החדש גובר כשהוא קיים. מחזיר true אם נטען.
    async _loadFoodLogSilent() {
        try {
            const col = this._db.collection('gympro_data');
            const metaDoc = await col.doc('food_log_meta').get();
            if (!metaDoc.exists) return false;
            const chunkCount = metaDoc.data().chunkCount || 0;
            if (!chunkCount) return false;
            const docs = await Promise.all(
                Array.from({ length: chunkCount }, (_, i) => col.doc(`food_log_${i}`).get())
            );
            const log = {};
            docs.forEach(d => {
                if (!d.exists || typeof d.data().daysJson !== 'string') return;
                try { Object.assign(log, JSON.parse(d.data().daysJson)); } catch { /* chunk פגום — מדלגים */ }
            });
            if (!Object.keys(log).length) return false;
            StorageManager.saveData(StorageManager.KEY_FOOD_LOG, log);
            return true;
        } catch(e) {
            console.error('GymPro loadFoodLog error:', e);
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
            // ימי יומן: מבנה chunks חדש (food_log_meta) גובר; fallback ל-foodLog בתוך config ישן
            let foodDays = (d.foodLog && typeof d.foodLog === 'object') ? Object.keys(d.foodLog).length : 0;
            try {
                const flMeta = await this._db.collection('gympro_data').doc('food_log_meta').get();
                if (flMeta.exists && flMeta.data().total) foodDays = flMeta.data().total;
            } catch { /* אין מבנה חדש עדיין */ }
            const summary = 'בענן: ' +
                (Array.isArray(d.bodylog) ? d.bodylog.length : 0) + ' שקילות, ' +
                (Array.isArray(d.nutritionDaily) ? d.nutritionDaily.length : 0) + ' ימי תזונה, ' +
                foodDays + ' ימי יומן, ' +
                (Array.isArray(d.foodDb) ? d.foodDb.length : 0) + ' פריטי מאגר';
            showConfirm(summary + '.\nלשחזר ולדרוס את המקומי?', async () => {
                await this._applyConfigData(d);
                await this._loadFoodLogSilent();
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
        await this._loadFoodLogSilent();        // יומן המזון מסונכרן ב-chunks נפרדים (v17.15)
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
        if (data.sleepDaily)     StorageManager.saveData(StorageManager.KEY_SLEEP_DAILY, data.sleepDaily);
        if (data.nutritionNotes) StorageManager.saveData(StorageManager.KEY_NUTRITION_NOTES, data.nutritionNotes);
        if (data.targetHistory)  StorageManager.saveData(StorageManager.KEY_TARGET_HISTORY, data.targetHistory);
        if (data.foodLog)        StorageManager.saveData(StorageManager.KEY_FOOD_LOG, data.foodLog);
        if (data.foodDb)         StorageManager.saveData(StorageManager.KEY_FOOD_DB, data.foodDb);
        if (data.bodyProfile)    StorageManager.saveData(StorageManager.KEY_BODY_PROFILE, data.bodyProfile);
        if (data.bodylog)        StorageManager.saveData(StorageManager.KEY_BODYLOG, data.bodylog);
        if (data.coachPrompts)   StorageManager.saveData(StorageManager.KEY_COACH_PROMPTS, data.coachPrompts);
        if (data.exerciseTM)     StorageManager.saveData(StorageManager.KEY_EXERCISE_TM, data.exerciseTM);
        if (data.lastWeights)    StorageManager.saveData(StorageManager.KEY_WEIGHTS, data.lastWeights);
        if (data.rmHistory)      StorageManager.saveData(StorageManager.KEY_RM, data.rmHistory);
        if (data.hiddenThumbs)   StorageManager.saveData('gympro_hidden_thumbs', data.hiddenThumbs);
        if (data.photoIndex)     StorageManager.savePhotoIndex(data.photoIndex);
        if (data.photoTrend && Object.keys(data.photoTrend).length) StorageManager.savePhotoTrend(data.photoTrend);
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
            const aiOk      = await this.saveAIHistoryToCloud();   // v17.15: גיבוי מלא כולל שיחות AI
            if (archiveOk && configOk && rawOk && aiOk) {
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
        if (!await this._ensureReady()) { this._recordSync('ai', false, 'other'); return false; }
        try {
            const payload = {
                messages: StorageManager.getAIHistory(),
                coachMemory: StorageManager.getCoachMemory(),
                updatedAt: Date.now()
            };
            // 300 הודעות ארוכות + זיכרון מאמן יכולים להתקרב ל-1MB — אזהרה מקדימה
            const bytes = this._estimateDocSize(payload);
            this._recordSizeWarn('ai', bytes > this.DOC_SIZE_WARN ? bytes : null);
            await this._db.collection('gympro_data').doc('ai_history').set(payload);
            this._recordSync('ai', true);
            return true;
        } catch(e) {
            console.error('GymPro saveAIHistory error:', e);
            this._recordSync('ai', false, this._isDocTooLarge(e) ? 'size' : 'other');
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
