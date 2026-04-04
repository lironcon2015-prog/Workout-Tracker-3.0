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
            homePRRange: 8
            // consistencyGreen / consistencyOrange — נשמרים רק אם הוגדרו ידנית
        };
    },

    saveAnalyticsPrefs(prefs) {
        this.saveData(this.KEY_ANALYTICS, prefs);
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
            : ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
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
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// FirebaseManager — ניהול Firestore (סנכרון ענן)
// ─────────────────────────────────────────────────────────────────────────────

const FirebaseManager = {
    KEY_FIREBASE_CONFIG: 'gympro_firebase_config',
    _db: null,
    _initialized: false,

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
            return true;
        } catch(e) {
            console.error('GymPro Firebase init error:', e);
            return false;
        }
    },

    // ── Archive ──────────────────────────────────────────────────────────────

    async saveArchiveToCloud() {
        if (!this.init()) return false;
        try {
            const archive = StorageManager.getArchive();
            await this._db.collection('gympro_data').doc('archive').set({
                items: archive,
                updatedAt: Date.now()
            });
            return true;
        } catch(e) {
            console.error('GymPro saveArchive error:', e);
            return false;
        }
    },

    async loadArchiveFromCloud() {
        if (!this.init()) {
            showAlert('Firebase לא מוגדר. הגדר חיבור תחילה.');
            return;
        }
        try {
            const doc = await this._db.collection('gympro_data').doc('archive').get();
            if (!doc.exists || !doc.data().items) {
                showAlert('לא נמצאו נתוני ארכיון בענן.');
                return;
            }
            StorageManager.saveData(StorageManager.KEY_ARCHIVE, doc.data().items);
            showAlert('הארכיון שוחזר מהענן!', () => { window.location.reload(); });
        } catch(e) {
            showAlert('שגיאה בטעינה מהענן: ' + e.message);
        }
    },

    // ── Config ───────────────────────────────────────────────────────────────

    async saveConfigToCloud() {
        if (!this.init()) return false;
        try {
            const configData = {
                workouts:       StorageManager.getData(StorageManager.KEY_DB_WORKOUTS),
                exercises:      StorageManager.getData(StorageManager.KEY_DB_EXERCISES),
                meta:           StorageManager.getData(StorageManager.KEY_META),
                analyticsPrefs: StorageManager.getAnalyticsPrefs(),
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
        if (!this.init()) {
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
            showAlert('הקונפיג שוחזר מהענן!', () => { window.location.reload(); });
        } catch(e) {
            showAlert('שגיאה בטעינה מהענן: ' + e.message);
        }
    },

    // ── Upload All (העלאה ראשונית) ────────────────────────────────────────────

    async uploadAllToCloud() {
        if (!this.init()) {
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
        if (!this.init()) return false;
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
        if (!this.init()) {
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
