/**
 * GymPro Elite - Storage Manager
 * Handles all LocalStorage operations.
 */

const StorageManager = {
    KEY_WEIGHTS: 'gympro_weights',
    KEY_RM: 'gympro_rm',
    KEY_ARCHIVE: 'gympro_archive',
    KEY_DB_EXERCISES: 'gympro_db_exercises',
    KEY_DB_WORKOUTS: 'gympro_db_workouts',
    KEY_META: 'gympro_workout_meta',
    KEY_SESSION: 'gympro_current_session', 

    getData(key) {
        try { return JSON.parse(localStorage.getItem(key)); } 
        catch { return null; }
    },

    saveData(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    initDB() {
        const storedEx = this.getData(this.KEY_DB_EXERCISES);
        const storedWo = this.getData(this.KEY_DB_WORKOUTS);
        const storedMeta = this.getData(this.KEY_META);

        // state will be defined in script.js, but since initDB is called on window.onload,
        // state will be available in the global scope.
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

    resetFactory() {
        if(confirm("פעולה זו תאפס את כל התרגילים והאימונים לברירת המחדל. האם להמשיך?")) {
            localStorage.removeItem(this.KEY_DB_EXERCISES);
            localStorage.removeItem(this.KEY_DB_WORKOUTS);
            localStorage.removeItem(this.KEY_META);
            localStorage.removeItem(this.KEY_SESSION);
            location.reload();
        }
    },

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

    getAllData() {
        return {
            weights: this.getData(this.KEY_WEIGHTS),
            rms: this.getData(this.KEY_RM),
            archive: this.getArchive()
        };
    },

    restoreData(dataObj) {
        if(dataObj.weights) this.saveData(this.KEY_WEIGHTS, dataObj.weights);
        if(dataObj.rms) this.saveData(this.KEY_RM, dataObj.rms);
        if(dataObj.archive) this.saveData(this.KEY_ARCHIVE, dataObj.archive);
    },

    exportConfiguration() {
        const configData = {
            type: 'config_only',
            version: '12.12.5',
            date: new Date().toISOString(),
            workouts: this.getData(this.KEY_DB_WORKOUTS),
            exercises: this.getData(this.KEY_DB_EXERCISES),
            meta: this.getData(this.KEY_META)
        };
        const a = document.createElement('a'); 
        a.href = URL.createObjectURL(new Blob([JSON.stringify(configData, null, 2)], {type: "application/json"})); 
        a.download = `gympro_config_${new Date().toISOString().slice(0,10)}.json`; 
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    },

    importConfiguration(data) {
        if (data.type !== 'config_only') {
            alert("שגיאה: קובץ תבנית לא תקין.");
            return;
        }
        if(confirm("פעולה זו תדרוס את התוכניות והתרגילים. האם להמשיך?")) {
            this.saveData(this.KEY_DB_WORKOUTS, data.workouts);
            this.saveData(this.KEY_DB_EXERCISES, data.exercises);
            if (data.meta) this.saveData(this.KEY_META, data.meta);
            alert("התבניות נטענו בהצלחה!");
            location.reload();
        }
    }
};
