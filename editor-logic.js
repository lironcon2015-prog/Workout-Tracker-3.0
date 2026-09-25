/**
 * GYMPRO ELITE - EDITOR & MANAGER LOGIC
 * (הגרסה הנוכחית: ראה version.json)
 * שדרוג 1: Toggle פעילים/מוסתרים בניהול תוכניות.
 */

// ─── WORKOUT QUICK MENU (היסטוריה / יומן) ─────────────────────────────────

function toggleWorkoutQuickMenu() {
    const menu = document.getElementById('workout-quick-menu');
    if (!menu) return;
    const isOpen = menu.style.display !== 'none';
    menu.style.display = isOpen ? 'none' : 'block';
    // רענון מצב מתג "סיום שבוע" בכל פתיחה
    if (!isOpen && typeof _syncWeekEndMenuItem === 'function') _syncWeekEndMenuItem();
    // "החלף תרגיל" רלוונטי רק בתוך סבב פעיל — מחוץ לסבב ההחלפה זמינה במסך האישור
    if (!isOpen && typeof _syncClusterSwapMenuItem === 'function') _syncClusterSwapMenuItem();
    if (!isOpen && typeof _syncLiveExMenu === 'function') _syncLiveExMenu();
    if (!isOpen && typeof _minSyncMenuItem === 'function') _minSyncMenuItem();
}

// סגירת התפריט בלחיצה מחוץ לו — בודק כל אלמנט עם data-workout-menu-trigger
// (כפתור בקלאסי + כפתור ב-Live overlay חולקים את אותו תפריט)
document.addEventListener('click', (e) => {
    const menu = document.getElementById('workout-quick-menu');
    if (!menu || menu.style.display === 'none') return;
    if (e.target.closest('[data-workout-menu-trigger]')) return;
    if (menu.contains(e.target)) return;
    menu.style.display = 'none';
});

// ─── AUTO CLOUD CONFIG SAVE ────────────────────────────────────────────────

function autoSaveConfigToCloud() {
    if (typeof FirebaseManager === 'undefined' || !FirebaseManager.isConfigured()) return;
    if (!FirebaseManager._isSyncArmed()) return;   // מצב לא-מסומן: דילוג שקט (הגנת ענן) — לא כשל
    FirebaseManager.saveConfigToCloud().then(ok => {
        // הצלחה = שקט (הודעת ההצלחה רק הפריעה). רק כשל אמיתי מציג טוסט.
        if (!ok && typeof showCloudToast === 'function') {
            showCloudToast('שמירת נתונים לענן נכשלה — ' + FirebaseManager.describeSyncFailure('config'), false);
        }
    });
}

// ─── WORKOUT THUMB IMAGES (global — shared with archive-logic.js) ──────────
const WORKOUT_THUMB_IMAGES = [
    // תמונות מקוריות
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDPSxh1Qp2Y5rxaLi08qIoxzaIx6HpnkwADfs82U2MI3agKuOjH_XRe5Vnp7pqR4Evd6BCSN1YkzqsxR4nnHQV3PZwXgQBEG_TyPYZEVebs398qOzoE9HyVD9xCKKii15_Ya8EU-4niTMPvWEGd17IChBxNv5TeezOQrnFbB_qBA8FsoYuDaChgY7MmnJAOs3vwuKM5ySQBfgIlp5NV2gVPSFbGP2INnRMlHUVFFxfaoVATE1e2R11U7pj0h4STs62FftxEV7gt2Xg=w400',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBwpwBQq26LPlJcG2munCoBisisoadBReR8si5Z3g8S8lgmt5MJsUAeruNNad5eSE-JXi3yNGLEB-XLQ2mxm37YOgoyTDqNDCZtyg8BDuCDn-NSFZH2QyLABBEJW3ARgaInuP7jYs2Np2XGnBF5J6r6OMiR2gC-eX5F4j8bXE918AgnmlFilEgkJ9Lfyt8gQQDnZrLbp6riQvKpLe7jqelf992kdMjvLWTH9T2LKVlnkeBdAwiOwgoTTm96q43GOcbMi8KYcTaLnuQ=w400',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAlG4VTMGj-yqP5zRTFuwFw6VSP1Ao5jnbOz_Cg_AgxHAKaVb9AA14BrBcIPh1H6c9tTnYBVtY-qbhANOxe3Teq9dSp-VpaB1TsxWhPvcSTuNdfcCeac0ho4GM3sM_HacxT4LlJJdseMqdhuDm_DKXtDA1QpjmIUvLxaAZsw7tZo9-w3rmyC0e5kbgnjJl8aWUC_X7cyRZqHodEkgUz_IxKmYdK2Upnymtn0SoD_DaxTQyviYI2hDE8aB-m91sa2BrMhqNH-t6pFO0=w400',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuADW-EekFmHAshTc9g9FzdlSJN11cRf8HfTvE1EjCGrITu9AVPwQhlAWveW4i-bOdZG31UQquBdZhCoLyJCtNNYFCM9AW8Jamwe7OtLPH-2VaXWPmiyB3eWNkffyC_Sv5E8VQZU0qrhmPzaQJJelLiqBR3YJWoUtRpnxDPFSVxpDVopfJ1kOA2SkdTySC1CtWQIQSlA1cmBqYiB14pog08rXWbnoI5Ov-8JtVQyVirf58d95jdVQuoY_pkDv5LqglM8aErroJvyG7w=w400',
    // תמונות חדשות
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAa2Vwn-Npmz7NbshC3rMQgWM9M8CCxNPnGZUOU7OaPxSEMVGDhY-mKDoY-XteHYA_U6uVxkCW5juqWCmeSvcPwoHgr7eclbp-g2ffzK89c5m2Q6puxaJIOxzmGQ7QHIQQiiZijukgx1yOWGKFGRancwpMZs-yOdMjFJXmu3x-GTbxt5SYtDVS89s_5-BJDg3bGw4-wfWZZrND_NaEoPDcoNCCOifu-YqJuTAXGVAard2mlRrPHLd4nRnsyQxOhycpiBA49Cvt5yDY=w400',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDIOVKREkSUtF2gGWLXkGb-udu6k7Vd88eBGwQddiYNYxpY_P5fNhml-xqMsN4qoJi_vtN8xDeLzrT7J_VWSFH86FyJrE-ivdDpk0xT7fzfEjKLkIgI1krkRQSdWomSS-LyvpxRXXwx03m8HfV-KK7u7KYnG0_KMDYaAFctqwxUHv3kPdB7_rz3xzUzT2ahNq2ZwxaT3BUfVPuvvI9ak5r0-ml3SfsX6KZZRlCcSi4Ab3Htp4doK7B5thxvV2O5Tx5BepYgvnRce_E=w400',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAGo718VbTjHroR2f1ZBGGlTAzxlKArnnTAwwVQWooTDXT1OmHbOM4Ph_3MW9fkgdPsrnNXMGqTnIE4V2ouYMZ0MtOtJKH5GOX7xZFGAIGSRfxCf_HRk-v4hDrW18zAVyDhh9i5ydIHS4spQxq163MuDZb5ENQNEEirSYwRKLBHnXb4r-QuCSjUqpm9UsL_zBExoL8rtnXCIBygBYvbZHXj77vkM9qG95bkT9Okv2nqOtbO4qaKU4YMUHFub0Ap2T-NMGPVMx-UM14=w400',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAq_XJA8-2WusMzNGWr00DbVseG324nv8SBq2d4WVdA78rws8uIFaAc5jk3Ayv-SezIXc_U0pEhBsw5bmKgElbLlS85ThQ1rEEK4DQ9oIMHfe_4FnSz1r3kNGlQ6Ic9shZQj1bt3zT334kCzpdS9SwY-zCjr-opxcozdGnRsp0oRoVKRKzecKVP6uvYwJlyQBnvhBXQdkepO_BUP3qKnfXAPa8Cy3qKFEigyJNsoihIQ3XVihgN880qXMT1V0kF-iA7OqBc3wcPCts=w400',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDM747zT5KYoaK7X8hc-K-WYOjQXbbgWXh_0AcMIq4ja35br_K3VLl0dCSx-U68SYUq_k5e04IvERh-vlKv-k2AAANYGRdP6b51aHTDC1tMNLZ5srr2OUfYz5Q-Ntm75y29b67xEwWvocbUijNsm4kvskmBoa3U0umSm3TxpsF145TI6B2S2RwbHj0gPyhcC7ci-6qdVORG9a8JXyomx-FbSaHn3-QEWvshpgb_ah09clrwL88QDQS-eWCeztMEGN9j29hnLX35ddw=w400',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC2anRJGMnLHZPMMsfqKBf630347PZ3rWsm8rSg-LRhI4oA4Df_ne_03owqU5d_6b8pokyZBFrN6-5KIYUM7_bOFguohUBhm7AWhDg-1bpjZGgqyxhU1p2Z82kPb8ZwKorRZ4g9-EMnpUNi1v51elx50e7TZp74rAnL3yb6jHleAtvBGySoEEFyO9dVDP0JhuQJnoIY9xx2uOhXtz09RwiTkiwXXd-zNSeBkH-L0FeACvCBbl0cCi57Qtkzw8rMECn-Y0gudIjSeJc=w400',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCOI-xJHBRcxLOuOVtVrd05C2ziUleF7r3se3JDtjsOM8IIalAQtIRw9w2KLEOv7fB3zr2bxUbW-urEdaO4enryruujATKVSSXT1RerLy2ZmNDMaIQm2NibKnDL0LwrGBjAvgCfXGy-oJZios3IL_2PkYZOH5yav5VqNwQkiXyCbHrZHcjyk3qlJ2L8yzC2TLxN8ReMXDsDk6w_xfnWh7UxjS5qVYcJVobrXNidjhtN8pghO5tPDTuBmiQzaGH9CWUsJkwkt2QYvOg=w400',
    // תמונות מקומיות (img/) — להוסיף תמיד בסוף! ההסתרות וה-_thumbIdx נשמרים לפי אינדקס
    'img/thumb-arms-1.jpg',
    'img/thumb-chest-1.jpg',
    'img/thumb-shoulders-1.jpg',
    'img/thumb-back-1.jpg',
    'img/thumb-legs-1.jpg',
    // אירובי (v19.13.3) — אינדקסים 16,17,18. חובה בסוף: _thumbIdx נשמר לכל
    // תוכנית לפי אינדקס, והוספה באמצע הייתה מחליפה תמונות בתוכניות קיימות.
    'img/thumb-cardio-boxing.jpg',
    'img/thumb-cardio-bike.jpg',
    'img/thumb-cardio-walk.jpg',
    'img/thumb-cardio-run.jpg',
];

// ─── HIDDEN THUMBS MANAGEMENT ──────────────────────────────────────────────
// מאפשר למשתמש להסתיר תמונות מבוחר התמונות בעורך

const _HIDDEN_THUMBS_KEY = 'gympro_hidden_thumbs';

function _getHiddenThumbs() {
    return StorageManager.getData(_HIDDEN_THUMBS_KEY) || [];
}

function _saveHiddenThumbs(indices) {
    StorageManager.saveData(_HIDDEN_THUMBS_KEY, indices);
}

function toggleThumbHiddenUI(idx, btn) {
    const hidden = _getHiddenThumbs();
    const pos = hidden.indexOf(idx);
    if (pos === -1) {
        hidden.push(idx);
        btn.querySelector('.material-symbols-outlined').textContent = 'visibility_off';
        btn.closest('.thumb-manage-item').classList.add('hidden-thumb');
    } else {
        hidden.splice(pos, 1);
        btn.querySelector('.material-symbols-outlined').textContent = 'visibility';
        btn.closest('.thumb-manage-item').classList.remove('hidden-thumb');
    }
    _saveHiddenThumbs(hidden);
    // רענן את הבוחר הראשי (בלי לשנות את הבחירה הנוכחית)
    _renderThumbPicker(_selectedThumbIdx);
}

function openThumbManageSheet() {
    const overlay = document.getElementById('thumb-manage-overlay');
    const sheet   = document.getElementById('thumb-manage-sheet');
    const content = document.getElementById('thumb-manage-content');
    if (!overlay || !sheet || !content) return;

    const hidden = _getHiddenThumbs();
    content.innerHTML = '';
    WORKOUT_THUMB_IMAGES.forEach((url, idx) => {
        const isHidden = hidden.includes(idx);
        const item = document.createElement('div');
        item.className = 'thumb-manage-item' + (isHidden ? ' hidden-thumb' : '');
        item.innerHTML = `
            <div class="thumb-manage-img" style="background-image:url('${url}')"></div>
            <button class="thumb-manage-toggle" onclick="toggleThumbHiddenUI(${idx}, this)">
                <span class="material-symbols-outlined">${isHidden ? 'visibility_off' : 'visibility'}</span>
            </button>`;
        content.appendChild(item);
    });

    overlay.style.display = 'block';
    sheet.style.transform = 'translateY(0)';
}

function closeThumbManageSheet() {
    const overlay = document.getElementById('thumb-manage-overlay');
    const sheet   = document.getElementById('thumb-manage-sheet');
    if (overlay) overlay.style.display = 'none';
    if (sheet)   sheet.style.transform = '';
}

// ─── DYNAMIC MAIN MENU ─────────────────────────────────────────────────────

// _workoutKindFilter — הקבוצה המוצגת ברשימת אימוני השבוע. מתאפס ל-'strength'
// בכל כניסה לשבוע (selectWeek), ולא בחזרה מאימון — כדי שחזרה לא תזרוק את
// המשתמש חזרה לקבוצה השנייה.
let _workoutKindFilter = 'strength';

function setWorkoutKindFilter(kind) {
    _workoutKindFilter = kind === 'cardio' ? 'cardio' : 'strength';
    haptic('light');
    renderWorkoutMenu();
}

function _syncWorkoutKindSeg() {
    document.querySelectorAll('#workout-kind-seg .seg-btn').forEach(b => {
        b.classList.toggle('active', (b.dataset.kind === 'cardio') === (_workoutKindFilter === 'cardio'));
    });
    // Freestyle הוא בחירת תרגילים — אין לו מקום בקבוצת האירובי
    const fs = document.getElementById('freestyle-card');
    if (fs) fs.style.display = _workoutKindFilter === 'cardio' ? 'none' : '';
}

// _matchesKindFilter — האם התוכנית שייכת לקבוצה המוצגת כרגע
function _matchesKindFilter(key) {
    const isCardio = (typeof isCardioWorkout === 'function') && isCardioWorkout(key);
    return (_workoutKindFilter === 'cardio') === isCardio;
}

function renderWorkoutMenu() {
    const container = document.getElementById('workout-menu-container');
    if (!container) return;

    _syncWorkoutKindSeg();
    container.innerHTML = "";
    const title = document.getElementById('workout-week-title');
    const weekLabel = document.getElementById('workout-week-label');

    const thumbImages = WORKOUT_THUMB_IMAGES;

    // חץ קדימה — מתאים ל-RTL (כמו arrow_back_ios_new במוקאפ)
    const chevronSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;

    // _planSubtitle — שורת המשנה בכרטיס התוכנית. באירובי אין תרגילים, ולכן
    // מוצג מה שמגדיר את האימון: סבבים וזמנים, או "רציף".
    function _planSubtitle(key, count) {
        if (typeof isCardioWorkout !== 'function' || !isCardioWorkout(key)) return `${count} תרגילים`;
        const cfg = (typeof cardioPlanConfig === 'function') ? cardioPlanConfig(key) : null;
        if (!cfg) return 'אירובי';
        if (cfg.mode === 'open') return cfg.targetSec ? `רציף · יעד ${Math.round(cfg.targetSec / 60)} דק׳` : 'רציף · ללא יעד';
        const f = s => (typeof _fmtClock === 'function' ? _fmtClock(s || 0) : String(s || 0));
        return `${cfg.rounds} סבבים · ${f(cfg.workSec)} / ${f(cfg.restSec)}`;
    }

    function buildCard(key, count, fallbackIdx, isFirst, badge) {
        const btn = document.createElement('button');
        btn.className = 'km-manager-card';
        btn.style.width = '100%';
        btn.style.textAlign = 'start';

        if (!state.workoutMeta[key]) state.workoutMeta[key] = {};
        if (typeof state.workoutMeta[key]._thumbIdx !== 'number') {
            state.workoutMeta[key]._thumbIdx = fallbackIdx;
        }
        const thumbIndex = state.workoutMeta[key]._thumbIdx;
        const imgUrl = thumbImages[thumbIndex % thumbImages.length];
        const badgeHtml = badge || '';
        const safeKey = escapeJsAttr(key);

        btn.innerHTML = `
            <div class="km-manager-card-img" style="background-image:url('${imgUrl}')"></div>
            <div class="km-manager-card-body">
                <h3 class="km-manager-card-title">${escapeHtml(key)}</h3>
                ${badgeHtml}
                <p class="km-manager-card-count">${_planSubtitle(key, count)}</p>
                <div class="km-manager-card-actions">
                    ${(typeof isCardioWorkout === 'function' && isCardioWorkout(key)) ? '' : `
                    <button class="km-select-card-pill" onclick="event.stopPropagation(); openWorkoutPlanSheet('${safeKey}')">
                        <span class="material-symbols-outlined" style="font-size:0.85rem;line-height:1;">format_list_bulleted</span>
                        תרגילים
                    </button>`}
                </div>
            </div>`;
        btn.onclick = () => selectWorkout(key);
        return btn;
    }

    if (state.week === 'deload') {
        if (weekLabel) weekLabel.innerText = 'Deload';
        title.innerText = "שבוע דילואוד";
        const keys = Object.keys(state.workouts);
        const deloadWorkouts = keys.filter(k => {
            const meta = state.workoutMeta[k];
            return meta && meta.availableInDeload === true && _matchesKindFilter(k);
        });

        if (deloadWorkouts.length === 0) {
            container.innerHTML = _workoutKindFilter === 'cardio'
                ? `<p class="text-center color-dim">אין תוכנית אירובי שסומנה כזמינה בדילואוד</p>`
                : `<p class="text-center color-dim">בחר Freestyle או סמן תוכנית כדילואוד בעורך</p>`;
        } else {
            deloadWorkouts.forEach((key, idx) => {
                const meta = state.workoutMeta[key];
                let count = 0;
                const w = state.workouts[key];
                if (Array.isArray(w)) {
                    w.forEach(item => { if (item.type === 'cluster') count += item.exercises.length; else count++; });
                }
                const badge = (meta && meta.isDeloadOnly)
                    ? `<span class="text-xs color-type-free" style="border:1px solid var(--type-free); border-radius:6px; padding:2px 6px; font-size:0.7em;">Deload Only</span>`
                    : '';
                container.appendChild(buildCard(key, count, idx, idx === 0, badge));
            });
        }
    } else {
        if (weekLabel) weekLabel.innerText = `Week ${state.week}`;
        title.innerText = `שבוע ${state.week} - בחר אימון`;
        let idx = 0;
        Object.keys(state.workouts).forEach(key => {
            const meta = state.workoutMeta[key];
            if (meta && meta.isDeloadOnly) return;
            if (meta && meta.isHidden) return;
            if (!_matchesKindFilter(key)) return;

            let count = 0;
            const w = state.workouts[key];
            if (Array.isArray(w)) {
                w.forEach(item => { if (item.type === 'cluster') count += item.exercises.length; else count++; });
            }
            const cardioBadge = (typeof isCardioWorkout === 'function' && isCardioWorkout(key))
                ? `<span class="km-kind-badge">אירובי</span>` : '';
            container.appendChild(buildCard(key, count, idx, idx === 0, cardioBadge));
            idx++;
        });
        if (idx === 0) {
            container.innerHTML = _workoutKindFilter === 'cardio'
                ? `<p class="text-center color-dim">אין תוכניות אירובי — צור אחת בהגדרות → ניהול תוכניות</p>`
                : `<p class="text-center color-dim">אין תוכניות כוח פעילות</p>`;
        }
    }

}

// ─── WORKOUT MANAGER ───────────────────────────────────────────────────────

let _managerTab = 'active';

function openWorkoutManager() { _managerTab = 'active'; renderManagerList(); navigate('ui-workout-manager'); }

function _setManagerTab(tab) {
    _managerTab = tab;
    renderManagerList();
}

// _managerCardSubtitle — שורת המשנה בכרטיס המנהל. זהה בתוכן לזו של מסך
// בחירת האימון, ומוגדרת בנפרד כי renderManagerList אינו חולק עם renderWorkoutMenu.
function _managerCardSubtitle(key, count) {
    if (typeof isCardioWorkout !== 'function' || !isCardioWorkout(key)) return `${count} תרגילים`;
    const cfg = (typeof cardioPlanConfig === 'function') ? cardioPlanConfig(key) : null;
    if (!cfg) return 'אירובי';
    if (cfg.mode === 'open') return cfg.targetSec ? `רציף · יעד ${Math.round(cfg.targetSec / 60)} דק׳` : 'רציף · ללא יעד';
    const f = s => (typeof _fmtClock === 'function' ? _fmtClock(s || 0) : String(s || 0));
    return `${cfg.rounds} סבבים · ${f(cfg.workSec)} / ${f(cfg.restSec)}`;
}

function deleteWorkout(key) {
    showConfirm(`האם למחוק את תוכנית ${key}?`, () => {
        delete state.workouts[key];
        if (state.workoutMeta[key]) delete state.workoutMeta[key];
        StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);
        StorageManager.saveData(StorageManager.KEY_META, state.workoutMeta);
        renderManagerList(); renderWorkoutMenu();
        autoSaveConfigToCloud();
    });
}

function duplicateWorkout(key) {
    const newName = key + " Copy";
    if (state.workouts[newName]) { showAlert("שם התוכנית כבר קיים"); return; }
    const copy = JSON.parse(JSON.stringify(state.workouts[key]));
    if (state.workoutMeta[key]) {
        state.workoutMeta[newName] = JSON.parse(JSON.stringify(state.workoutMeta[key]));
        StorageManager.saveData(StorageManager.KEY_META, state.workoutMeta);
    }
    state.workouts[newName] = copy;
    StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);
    renderManagerList(); renderWorkoutMenu();
    autoSaveConfigToCloud();
}

function createNewWorkout() {
    managerState.originalName = ''; managerState.currentName = 'New Plan';
    managerState.exercises = [];
    _editorKind = 'strength';
    _editorCardio = null;
    openEditorUI();
}

function editWorkout(key) {
    managerState.originalName = key; managerState.currentName = key;
    managerState.exercises = JSON.parse(JSON.stringify(state.workouts[key]));
    openEditorUI();
}

function openEditorUI() {
    document.getElementById('editor-workout-name').value = managerState.currentName === 'New Plan' ? '' : managerState.currentName;
    const meta = state.workoutMeta[managerState.currentName] || {};
    // סוג התוכנית וקונפיג האירובי — נטענים לפני הרינדור כדי שהטופס יעלה נכון
    if (_editorKind !== 'cardio' || managerState.originalName) {
        _editorKind = (meta.kind === 'cardio') ? 'cardio' : 'strength';
    }
    const _cfg = (typeof cardioPlanConfig === 'function' && managerState.originalName)
        ? cardioPlanConfig(managerState.originalName) : null;
    _editorCardio = (typeof _cardioNormalize === 'function')
        ? _cardioNormalize(_cfg || _editorCardio) : (_cfg || null);
    document.getElementById('editor-deload-check').checked = !!meta.availableInDeload;
    document.getElementById('editor-deload-only-check').checked = !!meta.isDeloadOnly;
    document.getElementById('editor-hidden-check').checked = !!meta.isHidden;
    _edSyncWhenSeg();
    _renderColorSwatches(meta.color || '');
    _renderThumbPicker(typeof meta._thumbIdx === 'number' ? meta._thumbIdx : 0);
    // בורר הסוג: בתוכנית חדשה בגוף העורך (החלטה ראשונה), בקיימת — בגיליון ההגדרות
    const isNew = !managerState.originalName;
    const kindBlock = document.getElementById('ed-kind-block');
    const slot = document.getElementById(isNew ? 'ed-kind-slot-body' : 'ed-kind-slot-sheet');
    if (kindBlock && slot && kindBlock.parentNode !== slot) slot.appendChild(kindBlock);
    ['ed-dup-row', 'ed-del-row'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = isNew ? 'none' : ''; });
    _edReorder = false;
    renderEditorList();
    _applyEditorKindUI();
    _edSnap = _edStateStr();
    _edRefreshSave();
    navigate('ui-workout-editor');
}

// ─── תגיות תרגיל (v19.9) ───────────────────────────────────────────────────
// עותק עבודה שנכתב לתרגיל רק ב-save — ביטול המודל לא משאיר שאריות.
let _confCues = [];

function _renderConfCues() {
    const box = document.getElementById('conf-ex-cues');
    if (!box) return;
    if (!_confCues.length) {
        box.innerHTML = '<div class="conf-cue-empty">אין תגיות. תגית היא תזכורת קבועה לתרגיל — למשל "ספוטר" או "עצירה של שנייה".</div>';
        return;
    }
    box.innerHTML = _confCues.map((c, i) => `
        <div class="conf-cue-row">
            <input type="text" class="conf-cue-name" value="${escapeHtml(c.label)}" placeholder="שם התגית" oninput="setConfCueLabel(${i}, this.value)">
            <button type="button" class="conf-cue-def${c.def ? ' on' : ''}" onclick="toggleConfCueDef(${i})">${c.def ? 'דלוקה' : 'כבויה'}</button>
            <button type="button" class="conf-cue-del" onclick="removeConfCue(${i})" aria-label="הסר תגית">הסר</button>
        </div>`).join('');
}

// עדכון בלבד, בלי רינדור — רינדור בכל הקלדה היה מאבד את הפוקוס בשדה
function setConfCueLabel(i, val) {
    if (_confCues[i]) _confCues[i].label = val;
}

function toggleConfCueDef(i) {
    if (!_confCues[i]) return;
    _confCues[i].def = !_confCues[i].def;
    _renderConfCues();
    haptic('light');
}

function removeConfCue(i) {
    _confCues.splice(i, 1);
    _renderConfCues();
    haptic('light');
}

function addConfCue() {
    if (_confCues.length >= 6) { showAlert('מקסימום 6 תגיות לתרגיל.'); return; }
    _confCues.push({ label: '', def: false });
    _renderConfCues();
    const rows = document.querySelectorAll('#conf-ex-cues .conf-cue-name');
    if (rows.length) rows[rows.length - 1].focus();
    haptic('light');
}

// ניקוי לפני שמירה — תגית בלי שם נזרקת, כפילויות מוסרות
function _collectConfCues() {
    const out = [];
    const seen = new Set();
    _confCues.forEach(c => {
        const label = (c.label || '').trim();
        if (!label || seen.has(label)) return;
        seen.add(label);
        out.push({ label, def: !!c.def });
    });
    return out;
}

// ─── EXERCISE MANAGER (CREATE / EDIT) ──────────────────────────────────────

function openExerciseCreator() {
    document.getElementById('ex-config-title').innerText = "יצירת תרגיל חדש";
    document.getElementById('conf-ex-name').value = "";
    document.getElementById('conf-ex-muscle').value = "חזה";
    document.getElementById('conf-ex-base').value = "";
    document.getElementById('conf-ex-step').value = "2.5";
    document.getElementById('conf-ex-min').value = "";
    document.getElementById('conf-ex-max').value = "";
    document.getElementById('conf-ex-uni').checked = false;
    document.getElementById('conf-ex-wmode').value = "kg";
    _confCues = [];
    _renderConfCues();

    document.getElementById('btn-delete-ex').classList.add('d-none');
    // תחליפים דורשים תרגיל קיים במאגר — לא זמין במצב יצירה
    document.getElementById('btn-ex-subs').classList.add('d-none');

    document.getElementById('ex-config-modal').dataset.mode = "create";
    _confSyncUI();
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
    _confCues = (ex.cues || []).map(c => ({ label: c.label || '', def: !!c.def }));
    _renderConfCues();
    // שיטת משקל — weightMode מפורש גובר; דגל isBW ישן ממופה למשקל גוף
    document.getElementById('conf-ex-wmode').value = ex.weightMode || (ex.isBW ? 'bw' : 'kg');

    if (ex.manualRange) {
        document.getElementById('conf-ex-base').value = ex.manualRange.base || "";
        document.getElementById('conf-ex-min').value = ex.manualRange.min || "";
        document.getElementById('conf-ex-max').value = ex.manualRange.max || "";
    } else {
        document.getElementById('conf-ex-base').value = "";
        document.getElementById('conf-ex-min').value = ex.minW || "";
        document.getElementById('conf-ex-max').value = ex.maxW || "";
    }

    document.getElementById('btn-delete-ex').classList.remove('d-none');
    document.getElementById('btn-ex-subs').classList.remove('d-none');
    document.getElementById('ex-config-modal').dataset.mode = "edit";
    document.getElementById('ex-config-modal').dataset.target = exName;
    updateSubsCountLabels();
    _confSyncUI();
    document.getElementById('ex-config-modal').style.display = 'flex';
}

// ─── EXERCISE DATABASE MANAGER ─────────────────────────────────────────────

function openExerciseDatabase() {
    managerState.dbFilter = 'all';
    document.querySelectorAll('#ui-exercise-db .chip').forEach(c => c.classList.remove('active'));
    const firstChip = document.querySelector('#ui-exercise-db .chip');
    if (firstChip) firstChip.classList.add('active');

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
    if (!list) return;
    const searchVal = document.getElementById('db-search').value.toLowerCase().trim();
    const sub = document.getElementById('db-sub');
    if (sub) {
        const groups = new Set(state.exercises.map(e => getMuscleBadge(e.muscles)).filter(Boolean));
        sub.textContent = `${state.exercises.length} תרגילים · ${groups.size} קבוצות שריר`;
    }
    const sorted = [...state.exercises].sort((a, b) => a.name.localeCompare(b.name));
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
    if (!filtered.length) {
        list.innerHTML = `<div class="ed-empty"><b>לא נמצאו תרגילים</b></div>`;
        return;
    }
    let html = '', letter = null, open = false;
    filtered.forEach(ex => {
        const L = (ex.name[0] || '#').toUpperCase();
        if (L !== letter) {
            if (open) html += '</div>';
            html += `<div class="ed-glbl">${escapeHtml(L)}</div><div class="ed-group">`;
            letter = L; open = true;
        }
        const n = _edPlanUsage(ex.name);
        const rm = StorageManager.getLastRM ? StorageManager.getLastRM(ex.name) : null;
        const parts = [escapeHtml(getMuscleBadge(ex.muscles) || '')];
        if (rm) parts.push(`1RM ${_fvFmt(rm, 'num')} ק״ג`);
        if (ex.isUnilateral) parts.push('חד-צדדי');
        parts.push(n ? `ב-${n} ${n === 1 ? 'תוכנית' : 'תוכניות'}` : 'לא בשימוש');
        html += `<button class="ed-row ed-row--btn" onclick="openExerciseEditor('${escapeJsAttr(ex.name)}')">${_edMono(ex.name)}
            <span class="ed-tx"><span class="ed-n">${escapeHtml(ex.name)}</span><span class="ed-m">${parts.filter(Boolean).join(' · ')}</span></span>
            <span class="ed-chev">‹</span></button>`;
    });
    if (open) html += '</div>';
    list.innerHTML = html;
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
    const wMode = document.getElementById('conf-ex-wmode').value;

    if (!name) { showAlert("נא להזין שם תרגיל"); return; }

    let musclesArr = [muscleSelect];
    if (muscleSelect === 'יד קדמית') musclesArr = ['ידיים', 'biceps'];
    if (muscleSelect === 'יד אחורית') musclesArr = ['ידיים', 'triceps'];

    if (mode === 'create') {
        if (state.exercises.find(e => e.name === name)) { showAlert("שם תרגיל כבר קיים"); return; }

        const newEx = {
            name,
            muscles: musclesArr,
            step,
            isUnilateral: isUni,
            weightMode: wMode,
            cues: _collectConfCues(),
            manualRange: {
                base: isNaN(base) ? undefined : base,
                min: isNaN(min) ? undefined : min,
                max: isNaN(max) ? undefined : max
            }
        };
        state.exercises.push(newEx);
        StorageManager.saveData(StorageManager.KEY_DB_EXERCISES, state.exercises);
        autoSaveConfigToCloud();
        closeExConfigModal();
        // נוצר מתוך מסך ההוספה — מסומן מיד, כדי שלא יצטרכו לחפש אותו
        if (document.getElementById('ui-exercise-selector').classList.contains('active')) {
            if ((managerState.selectorMode || 'add') !== 'replace' && !_selPicked.includes(name)) _selPicked.push(name);
            renderSelectorList();
        } else if (document.getElementById('ui-exercise-db').classList.contains('active')) {
            renderExerciseDatabase();
        }
        if (typeof showCloudToast === 'function') showCloudToast(`"${name}" נוסף למאגר`, true);

    } else {
        const targetName = document.getElementById('ex-config-modal').dataset.target;
        const exIndex = state.exercises.findIndex(e => e.name === targetName);
        if (exIndex === -1) return;

        if (targetName !== name) {
            if (state.exercises.find(e => e.name === name)) { showAlert("שם זה כבר קיים במערכת"); return; }

            showConfirm(
                `שינית את שם התרגיל מ-"${targetName}" ל-"${name}".\nהשינוי יעדכן את כל התוכניות הקיימות.\nהאם להמשיך?`,
                () => {
                    for (let key in state.workouts) {
                        const wo = state.workouts[key];
                        if (Array.isArray(wo)) {
                            wo.forEach(item => {
                                if (item.type === 'cluster') {
                                    item.exercises.forEach(sub => { if (sub.name === targetName) sub.name = name; });
                                } else {
                                    if (item.name === targetName) item.name = name;
                                }
                            });
                        }
                    }
                    StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);

                    const lastW = StorageManager.getLastWeight(targetName);
                    if (lastW) StorageManager.saveWeight(name, lastW);

                    // רשימות התחליפים מחזיקות שמות — שינוי שם חייב לעדכן גם אותן
                    state.exercises.forEach(e => {
                        if (Array.isArray(e.subs)) e.subs = e.subs.map(n => n === targetName ? name : n);
                    });

                    state.exercises[exIndex].name = name;
                    _finishSaveExConfig(exIndex, musclesArr, step, isUni, base, min, max, wMode);
                }
            );
            return;
        }

        _finishSaveExConfig(exIndex, musclesArr, step, isUni, base, min, max, wMode);
    }
}

function _finishSaveExConfig(exIndex, musclesArr, step, isUni, base, min, max, wMode) {
    state.exercises[exIndex].muscles = musclesArr;
    state.exercises[exIndex].step = step;
    state.exercises[exIndex].isUnilateral = isUni;
    // weightMode מפורש תמיד — גובר על דגל isBW ישן בתרגילי ברירת המחדל
    state.exercises[exIndex].weightMode = wMode || 'kg';
    state.exercises[exIndex].cues = _collectConfCues();

    if (!state.exercises[exIndex].manualRange) state.exercises[exIndex].manualRange = {};
    state.exercises[exIndex].manualRange.base = isNaN(base) ? undefined : base;
    state.exercises[exIndex].manualRange.min = isNaN(min) ? undefined : min;
    state.exercises[exIndex].manualRange.max = isNaN(max) ? undefined : max;

    if (!isNaN(min)) delete state.exercises[exIndex].minW;
    if (!isNaN(max)) delete state.exercises[exIndex].maxW;

    StorageManager.saveData(StorageManager.KEY_DB_EXERCISES, state.exercises);
    autoSaveConfigToCloud();
    closeExConfigModal();

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
        showAlert(`לא ניתן למחוק את התרגיל!\nהוא נמצא בשימוש בתוכניות הבאות:\n- ${usedIn.join('\n- ')}\n\nיש להסיר אותו מהתוכניות קודם.`);
        return;
    }

    showConfirm(`האם למחוק את התרגיל "${targetName}" לצמיתות?`, () => {
        const exIndex = state.exercises.findIndex(e => e.name === targetName);
        if (exIndex > -1) {
            state.exercises.splice(exIndex, 1);
            // ניקוי הפניות יתומות מרשימות התחליפים של שאר התרגילים
            state.exercises.forEach(e => {
                if (Array.isArray(e.subs)) e.subs = e.subs.filter(n => n !== targetName);
            });
            StorageManager.saveData(StorageManager.KEY_DB_EXERCISES, state.exercises);
            autoSaveConfigToCloud();
            showAlert("התרגיל נמחק.", () => {
                closeExConfigModal();
                renderExerciseDatabase();
            });
        }
    });
}

function closeExConfigModal() {
    document.getElementById('ex-config-modal').style.display = 'none';
    document.getElementById('conf-ex-name').disabled = false;
}

// ─── WORKOUT EDITOR & CLUSTER SUPPORT ─────────────────────────────────────

function renderEditorList() {
    const list = document.getElementById('editor-list');
    if (!list) return;
    const items = managerState.exercises || [];
    let html = '', num = 0, letter = 0;
    items.forEach((item, idx) => {
        if (item.type === 'cluster') html += _edClusterHtml(item, idx, String.fromCharCode(65 + letter++));
        else html += _edItemHtml(item, idx, ++num);
    });
    list.innerHTML = html;
    list.classList.toggle('is-reorder', _edReorder);
    const countEl = document.getElementById('editor-block-count');
    if (countEl) countEl.textContent = `${items.length} בלוקים סה"כ`;
    const empty = document.getElementById('ed-empty');
    if (empty) empty.style.display = (!items.length && _editorKind !== 'cardio') ? '' : 'none';
    if (_edReorder) _edBindDrag();
    const rb = document.getElementById('ed-reorder-btn');
    if (rb) rb.style.display = (_editorKind !== 'cardio' && (items.length > 1 || items.some(x => x.type === 'cluster' && (x.exercises || []).length > 1)) || _edReorder) ? '' : 'none';
    _edRenderHero();
    _edRefreshSave();
    StorageManager.saveSessionState();
}

// שורת מטא לתרגיל בתוכנית — מה שקובע את הביצוע, בשורה אחת
function _edItemMeta(ex, inCluster) {
    const parts = [];
    if (inCluster) {
        if (ex.targetReps != null) parts.push(`${ex.targetReps} חזרות`);
        parts.push(`מעבר ${_fvFmt(ex.restTime != null ? ex.restTime : 30, 'time')}`);
    } else {
        parts.push(ex.isMain ? 'יעד לפי 1RM' : `${ex.sets || 3} סטים`);
        parts.push(`מנוחה ${_fvFmt(ex.restTime || (ex.isMain ? 120 : 90), 'time')}`);
    }
    if (ex.targetWeight != null && ex.targetReps != null && !inCluster) parts.push(`${_fvFmt(ex.targetWeight, 'num')} × ${ex.targetReps}`);
    else if (ex.targetWeight != null) parts.push(`${_fvFmt(ex.targetWeight, 'num')} ק״ג`);
    return parts.join(' · ');
}

function _edBadges(ex) {
    let b = '';
    if (ex.isMain) b += '<span class="ed-badge ed-badge--main">ראשי</span>';
    if (ex.dropSet) b += `<span class="ed-badge ed-badge--drop">דרופ −${ex.dropPct || 20}%</span>`;
    return b;
}

function _edItemHtml(item, idx, num) {
    if (_edReorder) {
        return `<div class="ed-group ed-drag-item" data-scope="top" data-index="${idx}">
            <div class="ed-row"><button class="ed-minus" onclick="removeExFromEditor(${idx})" aria-label="הסר"></button>
            <span class="ed-tx"><span class="ed-n">${escapeHtml(item.name)}</span></span>
            <span class="ed-handle" aria-label="גרור"><i></i><i></i><i></i></span></div></div>`;
    }
    return `<div class="ed-group"><button class="ed-row ed-row--btn" onclick="edOpenExSheet(${idx})">
        <span class="ed-idx">${num}</span>
        <span class="ed-tx"><span class="ed-n">${escapeHtml(item.name)}${_edBadges(item)}</span><span class="ed-m">${_edItemMeta(item, false)}</span></span>
        <span class="ed-chev">‹</span></button></div>`;
}

function _edClusterHtml(cluster, idx, letter) {
    const info = _getClusterLabel(cluster);
    const exs = cluster.exercises || [];
    const head = `${info.title} ${letter}`;
    if (_edReorder) {
        const rows = exs.map((ex, i) => `<div class="ed-row ed-drag-item" data-scope="cl:${idx}" data-index="${i}">
            <button class="ed-minus" onclick="removeExFromCluster(${idx}, ${i})" aria-label="הסר"></button>
            <span class="ed-tx"><span class="ed-n">${escapeHtml(ex.name)}</span></span>
            <span class="ed-handle"><i></i><i></i><i></i></span></div>`).join('');
        return `<div class="ed-group ed-cl ed-drag-item" data-scope="top" data-index="${idx}">
            <div class="ed-clh"><button class="ed-minus" onclick="edRemoveCluster(${idx})" aria-label="הסר סבב"></button>
            <b>${head}</b><span class="ed-handle"><i></i><i></i><i></i></span></div>${rows}</div>`;
    }
    const rows = exs.map((ex, i) => `<button class="ed-row ed-row--btn" onclick="edOpenExSheet(${idx}, ${i})">
        <span class="ed-idx ed-idx--ss">${letter}${i + 1}</span>
        <span class="ed-tx"><span class="ed-n">${escapeHtml(ex.name)}${_edBadges(ex)}</span><span class="ed-m">${_edItemMeta(ex, true)}</span></span>
        <span class="ed-chev">‹</span></button>`).join('');
    const empty = exs.length ? '' : `<button class="ed-row ed-row--btn" onclick="openExerciseSelectorForCluster(${idx})"><span class="ed-tx"><span class="ed-n ed-accent">הוסף תרגילים לסבב</span></span></button>`;
    return `<div class="ed-group ed-cl">
        <button class="ed-clh ed-clh--btn" onclick="edOpenClusterSheet(${idx})"><b>${head}</b>
            <span>${cluster.rounds} סבבים · מנוחה ${_fvFmt(cluster.clusterRest, 'time')}</span><em>ערוך</em></button>
        ${rows}${empty}</div>`;
}

// CLUSTER_MAX_EX — מספר תרגילים מקסימלי בסבב/סופרסט/ג'יאנט.
// מעל 6 התרגול הופך לא ריאלי (זמן מעבר, fatigue management).
const CLUSTER_MAX_EX = 6;

function _getClusterLabel(cluster) {
    const n = (cluster.exercises || []).length;
    if (n >= 3) return { title: 'ג׳יאנט סט', type: 'giant' };
    if (n === 2) return { title: 'סופרסט', type: 'super' };
    return { title: 'בלוק סבב', type: 'block' };
}

function toggleMainStatus(idx) { managerState.exercises[idx].isMain = !managerState.exercises[idx].isMain; renderEditorList(); }
function changeSetCount(idx, delta) { let c = managerState.exercises[idx].sets + delta; if (c < 1) c = 1; managerState.exercises[idx].sets = c; renderEditorList(); }
function moveExInEditor(idx, dir) { if (idx + dir < 0 || idx + dir >= managerState.exercises.length) return; const t = managerState.exercises[idx]; managerState.exercises[idx] = managerState.exercises[idx + dir]; managerState.exercises[idx + dir] = t; renderEditorList(); }
function removeExFromEditor(idx) { managerState.exercises.splice(idx, 1); renderEditorList(); }
// ─── דרופ סט בתוכנית (v18.7) ──────────────────────────────────────────────
// דגל ברמת פריט התוכנית. תרגיל בתוך סבב לא מקבל דרופ — הזרימה שם מקוננת ממילא.
function toggleDropSetFlag(idx) {
    const item = managerState.exercises[idx];
    if (!item || item.type === 'cluster') return;
    item.dropSet = !item.dropSet;
    if (item.dropSet && !item.dropPct) item.dropPct = 20;
    haptic('light');
    renderEditorList();
}

function changeDropPct(idx, delta) {
    const item = managerState.exercises[idx];
    if (!item) return;
    let v = (item.dropPct || 20) + delta;
    if (v < 5) v = 5;
    if (v > 60) v = 60;
    item.dropPct = v;
    renderEditorList();
}

function changeClusterRounds(idx, delta) { let v = managerState.exercises[idx].rounds + delta; if (v < 1) v = 1; managerState.exercises[idx].rounds = v; renderEditorList(); }
function changeClusterRest(idx, delta) { let v = managerState.exercises[idx].clusterRest + delta; if (v < 0) v = 0; managerState.exercises[idx].clusterRest = v; renderEditorList(); }
function addClusterToEditor() { managerState.exercises.push({ type: 'cluster', rounds: 3, clusterRest: 120, exercises: [] }); renderEditorList(); }
function removeExFromCluster(clusterIdx, exIdx) { managerState.exercises[clusterIdx].exercises.splice(exIdx, 1); renderEditorList(); }

// moveExInCluster — שינוי סדר תרגילים בתוך סבב. התוויות (A1/B2) והאינדקסים
// ב-onclick נגזרים מחדש בכל renderEditorList, ולכן ההחלפה במערך מספיקה.
function moveExInCluster(clusterIdx, exIdx, dir) {
    const cluster = managerState.exercises[clusterIdx];
    if (!cluster || cluster.type !== 'cluster') return;
    const arr = cluster.exercises || [];
    const target = exIdx + dir;
    if (target < 0 || target >= arr.length) return;
    const tmp = arr[exIdx];
    arr[exIdx] = arr[target];
    arr[target] = tmp;
    haptic('light');
    renderEditorList();
}

function saveWorkoutChanges() {
    const newName = document.getElementById('editor-workout-name').value.trim();
    if (!newName) { showAlert("נא להזין שם לתוכנית"); return; }
    // תוכנית אירובית אינה מכילה תרגילים — הבדיקה "התוכנית ריקה" אינה חלה עליה
    if (_editorKind !== 'cardio' && managerState.exercises.length === 0) { showAlert("התוכנית ריקה!"); return; }

    if (newName !== managerState.originalName) {
        if (state.workouts[newName]) { showAlert("שם תוכנית זה כבר קיים"); return; }
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

    state.workoutMeta[newName].isHidden = document.getElementById('editor-hidden-check').checked;
    state.workoutMeta[newName].color = _selectedEditorColor || '';
    state.workoutMeta[newName]._thumbIdx = _selectedThumbIdx >= 0 ? _selectedThumbIdx : (state.workoutMeta[newName]._thumbIdx || 0);

    // סוג התוכנית — המבדל היחיד. תוכנית כוח לא נושאת kind כלל (תאימות לאחור)
    if (_editorKind === 'cardio') state.workoutMeta[newName].kind = 'cardio';
    else delete state.workoutMeta[newName].kind;

    StorageManager.saveData(StorageManager.KEY_META, state.workoutMeta);

    if (_editorKind === 'cardio') {
        const cfg = (typeof _cardioNormalize === 'function') ? _cardioNormalize(_editorCardio) : (_editorCardio || {});
        state.workouts[newName] = [Object.assign({ type: 'cardio' }, cfg)];
        StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);
        _edSnap = '';
        autoSaveConfigToCloud();
        haptic('success');
        state.historyStack.pop();
        _setNavDirection('back');
        navigate('ui-workout-manager');
        renderManagerList();
        renderWorkoutMenu();
        return;
    }

    state.workouts[newName] = managerState.exercises;
    StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);
    _edSnap = '';
    autoSaveConfigToCloud();

    haptic('success');

    state.historyStack.pop();
    navigate('ui-workout-manager');
    renderManagerList();
    renderWorkoutMenu();
}

// ─── REST TIMER & DEFAULTS EDITING ─────────────────────────────────────────

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
    document.getElementById('target-weight-input').value = ex.targetWeight !== undefined ? ex.targetWeight : "";
    document.getElementById('target-reps-input').value = ex.targetReps !== undefined ? ex.targetReps : "";
    document.getElementById('target-rir-input').value = ex.targetRIR !== undefined ? ex.targetRIR : "";

    const time = ex.restTime || (ex.isMain ? 120 : 90);
    document.getElementById('rest-time-display').innerText = time + "s";

    updateSubsCountLabels();
    document.getElementById('exercise-settings-modal').style.display = 'flex';
}

function changeRestTime(delta) {
    const display = document.getElementById('rest-time-display');
    let current = parseInt(display.innerText.replace('s', ''));
    current += delta;
    if (current < 0) current = 0;
    display.innerText = current + "s";
}

function saveExerciseSettings() {
    if (managerState.editingTimerEx) {
        // הקשר עורך — שמירה ל-managerState
        const val = parseInt(document.getElementById('rest-time-display').innerText.replace('s', ''));
        const tWeight = parseFloat(document.getElementById('target-weight-input').value);
        const tReps = parseInt(document.getElementById('target-reps-input').value);
        const tRIR = parseFloat(document.getElementById('target-rir-input').value);

        const { idx, internalIdx } = managerState.editingTimerEx;
        const targetEx = internalIdx !== null
            ? managerState.exercises[idx].exercises[internalIdx]
            : managerState.exercises[idx];

        targetEx.restTime = val;
        targetEx.targetWeight = isNaN(tWeight) ? undefined : tWeight;
        targetEx.targetReps = isNaN(tReps) ? undefined : tReps;
        targetEx.targetRIR = isNaN(tRIR) ? undefined : tRIR;

        closeExerciseSettings();
        renderEditorList();
    } else if (typeof _editingRestEx !== 'undefined' && _editingRestEx) {
        // הקשר אימון פעיל — שמירה ל-plan item ו-state.currentEx
        const tw = document.getElementById('target-weight-input').value;
        const tr = document.getElementById('target-reps-input').value;
        const trir = document.getElementById('target-rir-input').value;

        if (tw !== '') { _editingRestEx.targetWeight = parseFloat(tw); state.currentEx.targetWeight = parseFloat(tw); }
        else { delete _editingRestEx.targetWeight; state.currentEx.targetWeight = undefined; }
        if (tr !== '') { _editingRestEx.targetReps = parseInt(tr); state.currentEx.targetReps = parseInt(tr); }
        else { delete _editingRestEx.targetReps; state.currentEx.targetReps = undefined; }
        if (trir !== '') { _editingRestEx.targetRIR = parseFloat(trir); state.currentEx.targetRIR = parseFloat(trir); }
        else { delete _editingRestEx.targetRIR; state.currentEx.targetRIR = undefined; }

        StorageManager.saveSessionState();
        closeExerciseSettings();
        initPickers();
    }
}

function closeExerciseSettings() { document.getElementById('exercise-settings-modal').style.display = 'none'; managerState.editingTimerEx = null; }

// ─── תרגילים תחליפיים — עריכה ידנית ────────────────────────────────────────
// ex.subs הוא מקור האמת ברגע שנשמר (גם ריק); בהיעדרו getSubstitutes נופל
// לברירות המחדל מ-substituteGroups ב-data.js. ראה workout-core.js:getSubstitutes.

let _subsEditName = null;   // שם התרגיל הנערך
let _subsWorking = [];      // הרשימה בעריכה, לפני שמירה

// שם התרגיל לפי הקשר הפתיחה — עורך התוכנית, אימון פעיל, או מסך התרגילים
function openSubsFromExConfig() {
    const modal = document.getElementById('ex-config-modal');
    if (modal.dataset.mode !== 'edit') { showAlert('יש לשמור את התרגיל לפני הגדרת תחליפים'); return; }
    openExerciseSubs(modal.dataset.target);
}

function openSubsFromExSettings() {
    let name = null;
    if (managerState.editingTimerEx) {
        const { idx, internalIdx } = managerState.editingTimerEx;
        const item = internalIdx !== null
            ? managerState.exercises[idx].exercises[internalIdx]
            : managerState.exercises[idx];
        name = item && item.name;
    } else {
        name = state.currentExName;   // אימון פעיל
    }
    openExerciseSubs(name);
}

function openExerciseSubs(exName) {
    const ex = state.exercises.find(e => e.name === exName);
    if (!ex) { showAlert('התרגיל לא נמצא במאגר'); return; }

    _subsEditName = ex.name;
    // תרגיל שטרם נערך — הרשימה נטענת מלאה מברירות המחדל, כדי שאפשר יהיה גם להסיר מהן
    _subsWorking = Array.isArray(ex.subs) ? ex.subs.slice() : defaultSubstitutes(ex.name);

    document.getElementById('ex-subs-title').innerText = `תחליפיים · ${ex.name}`;
    document.getElementById('ex-subs-search').value = '';
    // "אפס לברירת מחדל" רלוונטי רק כשקיימת הגדרה ידנית ששונה ממנה
    document.getElementById('btn-subs-reset').classList.toggle('d-none', !Array.isArray(ex.subs));
    renderSubsPicker();
    document.getElementById('ex-subs-modal').style.display = 'flex';
}

function renderSubsPicker() {
    const box = document.getElementById('ex-subs-list');
    if (!box) return;
    const q = (document.getElementById('ex-subs-search').value || '').trim().toLowerCase();

    // הנבחרים תמיד בראש (גם כשאינם תואמים לחיפוש — כדי לא "לאבד" בחירה תוך כדי סינון)
    const picked = state.exercises.filter(e => _subsWorking.includes(e.name));
    const rest = state.exercises
        .filter(e => e.name !== _subsEditName && !_subsWorking.includes(e.name))
        .filter(e => !q || e.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name));

    if (!picked.length && !rest.length) {
        box.innerHTML = `<p class="text-center color-dim mt-md">לא נמצאו תרגילים</p>`;
        return;
    }

    const row = (e, on) => `<button class="subs-row${on ? ' on' : ''}" onclick="toggleSubPick('${escapeJsAttr(e.name)}')">
            <span class="subs-row-name">${escapeHtml(e.name)}</span>
            <span class="subs-row-state">${on ? 'תחליף' : 'הוסף'}</span>
        </button>`;

    box.innerHTML =
        (picked.length ? `<div class="subs-sec">נבחרו (${picked.length})</div>` + picked.map(e => row(e, true)).join('') : '') +
        (rest.length ? `<div class="subs-sec">כל התרגילים</div>` + rest.map(e => row(e, false)).join('') : '');
}

function toggleSubPick(name) {
    const i = _subsWorking.indexOf(name);
    if (i >= 0) _subsWorking.splice(i, 1);
    else _subsWorking.push(name);
    renderSubsPicker();
    haptic('light');
}

// _materializeSubs — "מקבע" לתרגיל את רשימת ברירת המחדל שלו כרשימה ידנית, לפני
// שמשנים אותה. בלי זה, הסרה/הוספה בצד השני תיעלם — כי getSubstitutes היה חוזר
// לקרוא לו את הקבוצות מ-data.js.
function _materializeSubs(name) {
    const ex = state.exercises.find(e => e.name === name);
    if (!ex) return null;
    if (!Array.isArray(ex.subs)) ex.subs = defaultSubstitutes(name);
    return ex;
}

function _persistExercises() {
    StorageManager.saveData(StorageManager.KEY_DB_EXERCISES, state.exercises);
    autoSaveConfigToCloud();
}

function saveExerciseSubs() {
    const ex = state.exercises.find(e => e.name === _subsEditName);
    if (!ex) { closeExerciseSubs(); return; }

    const before = Array.isArray(ex.subs) ? ex.subs.slice() : defaultSubstitutes(ex.name);
    const after = _subsWorking.filter(n => n !== ex.name);
    ex.subs = after;

    // דו-כיווניות — תחליף הוא יחס סימטרי (כמו הקבוצות ב-data.js): כל שינוי מוחל
    // גם על הצד השני, אחרת ייווצר מצב שבו A מציע את B אבל B לא מציע את A.
    after.filter(n => !before.includes(n)).forEach(n => {
        const other = _materializeSubs(n);
        if (other && !other.subs.includes(ex.name)) other.subs.push(ex.name);
    });
    before.filter(n => !after.includes(n)).forEach(n => {
        const other = _materializeSubs(n);
        if (other) other.subs = other.subs.filter(x => x !== ex.name);
    });

    _persistExercises();
    closeExerciseSubs();
    _afterSubsChange();
    showAlert(after.length ? `נשמרו ${after.length} תרגילים תחליפיים` : 'התחליפים לתרגיל בוטלו');
}

// איפוס — מחיקת ההגדרה הידנית וחזרה לקבוצות מ-data.js, כולל יישור הצד השני:
// תרגילים שכבר ידניים מקבלים בחזרה (או מאבדים) את ההפניה לפי ברירת המחדל.
function resetExerciseSubs() {
    const ex = state.exercises.find(e => e.name === _subsEditName);
    if (!ex) { closeExerciseSubs(); return; }

    showConfirm(`לאפס את התחליפים של "${ex.name}" לברירת המחדל?`, () => {
        delete ex.subs;
        const def = defaultSubstitutes(ex.name);
        state.exercises.forEach(other => {
            if (other.name === ex.name || !Array.isArray(other.subs)) return;
            const has = other.subs.includes(ex.name);
            if (def.includes(other.name) && !has) other.subs.push(ex.name);
            else if (!def.includes(other.name) && has) other.subs = other.subs.filter(n => n !== ex.name);
        });
        _persistExercises();
        closeExerciseSubs();
        _afterSubsChange();
        showAlert('התחליפים אופסו לברירת המחדל');
    });
}

function closeExerciseSubs() {
    document.getElementById('ex-subs-modal').style.display = 'none';
    _subsEditName = null;
    _subsWorking = [];
}

// רענון הצרכנים אחרי שינוי: מוני התחליפים במודאלים הפתוחים + רשימת מאגר התרגילים
function _afterSubsChange() {
    updateSubsCountLabels();
    if (document.getElementById('ui-exercise-db').classList.contains('active')) renderExerciseDatabase();
}

function updateSubsCountLabels() {
    const set = (elId, name) => {
        const el = document.getElementById(elId);
        if (!el) return;
        const n = name ? getSubstitutes(name).length : 0;
        const ex = name ? state.exercises.find(e => e.name === name) : null;
        const manual = ex && Array.isArray(ex.subs);
        el.textContent = n ? `${n}${manual ? '' : ' · ברירת מחדל'}` : (manual ? 'אין' : '—');
    };
    const cfg = document.getElementById('ex-config-modal');
    if (cfg && cfg.dataset.mode === 'edit') set('ex-config-subs-count', cfg.dataset.target);
    else set('ex-config-subs-count', null);

    let settingsName = null;
    if (managerState.editingTimerEx) {
        const { idx, internalIdx } = managerState.editingTimerEx;
        const item = internalIdx !== null
            ? managerState.exercises[idx].exercises[internalIdx]
            : managerState.exercises[idx];
        settingsName = item && item.name;
    } else if (state.currentExName) {
        settingsName = state.currentExName;
    }
    set('ex-settings-subs-count', settingsName);
}

// ─── SMART EXERCISE SELECTOR ───────────────────────────────────────────────

function openExerciseSelector() { managerState.activeClusterRef = null; managerState.selectorMode = 'add'; prepareSelector(); }
function openExerciseSelectorForCluster(clusterIdx) { managerState.activeClusterRef = clusterIdx; managerState.selectorMode = 'cluster'; prepareSelector(); }

let _selPicked = [];        // שמות שסומנו, לפי סדר הסימון — זה הסדר שבו יתווספו
let _selReplaceRef = null;  // { idx, i } — במצב החלפה

function prepareSelector() {
    document.getElementById('selector-search').value = "";
    managerState.selectorFilter = 'all';
    _selPicked = [];
    const mode = managerState.selectorMode || 'add';
    const title = document.getElementById('sel-title');
    if (title) {
        if (mode === 'replace') title.textContent = 'החלף תרגיל';
        else if (mode === 'cluster') title.textContent = 'הוסף לסבב';
        else title.textContent = 'הוסף תרגילים';
    }
    const bar = document.getElementById('sel-bar');
    if (bar) bar.style.display = mode === 'replace' ? 'none' : '';
    updateSelectorChips();
    renderSelectorList();
    navigate('ui-exercise-selector');
}

function setSelectorFilter(filter, btn) { managerState.selectorFilter = filter; updateSelectorChips(); renderSelectorList(); }

function updateSelectorChips() {
    // scope לבורר בלבד — querySelectorAll('.chip') גלובלי כיבה צ'יפים בכל האפליקציה
    const btns = document.querySelectorAll('#ui-exercise-selector .chip');
    btns.forEach(c => c.classList.remove('active'));
    btns.forEach(b => { if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${managerState.selectorFilter}'`)) b.classList.add('active'); });
}

function filterSelector() { renderSelectorList(); }

// תרגילים שבוצעו לאחרונה — מה-log של האימונים האחרונים בארכיון
function _selRecent(limit) {
    const out = [];
    for (const a of _edArchive().slice(0, 12)) {
        for (const l of (a.log || [])) {
            if (!l || l.skip || !l.exName || out.includes(l.exName)) continue;
            if (state.exercises.some(e => e.name === l.exName)) out.push(l.exName);
            if (out.length >= limit) return out;
        }
    }
    return out;
}

function _selInPlan(name) {
    return (managerState.exercises || []).some(it => it && (it.name === name || (it.type === 'cluster' && (it.exercises || []).some(x => x.name === name))));
}

function _selRowHtml(ex) {
    const mode = managerState.selectorMode || 'add';
    const n = _edPlanUsage(ex.name);
    let sub = escapeHtml(getMuscleBadge(ex.muscles) || '');
    if (_selInPlan(ex.name)) sub += ' · כבר בתוכנית הזו';
    else if (n) sub += ` · ב-${n} ${n === 1 ? 'תוכנית' : 'תוכניות'}`;
    const k = _selPicked.indexOf(ex.name);
    const right = mode === 'replace' ? '<span class="ed-chev">‹</span>'
        : `<span class="ed-check${k >= 0 ? ' on' : ''}">${k >= 0 ? (k + 1) : ''}</span>`;
    return `<button class="ed-row ed-row--btn" onclick="selTap('${escapeJsAttr(ex.name)}')">${_edMono(ex.name)}
        <span class="ed-tx"><span class="ed-n">${escapeHtml(ex.name)}</span><span class="ed-m">${sub}</span></span>${right}</button>`;
}

function renderSelectorList() {
    const list = document.getElementById('selector-list');
    if (!list) return;
    const searchVal = document.getElementById('selector-search').value.toLowerCase().trim();
    const flt = managerState.selectorFilter || 'all';
    const filtered = state.exercises.filter(ex => {
        const matchesFilter = flt === 'all' || (ex.muscles || []).includes(flt);
        return matchesFilter && ex.name.toLowerCase().includes(searchVal);
    }).sort((a, b) => a.name.localeCompare(b.name));

    let html = '';
    let rest = filtered;
    if (!searchVal && flt === 'all') {
        const recent = _selRecent(6).map(n => state.exercises.find(e => e.name === n)).filter(Boolean);
        if (recent.length) {
            html += `<div class="ed-glbl">בשימוש לאחרונה</div><div class="ed-group">${recent.map(_selRowHtml).join('')}</div>`;
            rest = filtered.filter(e => !recent.includes(e));
        }
    }
    if (!filtered.length) html += `<div class="ed-empty"><b>לא נמצאו תרגילים</b><p>אפשר ליצור תרגיל חדש בכפתור "חדש".</p></div>`;
    let letter = null, open = false;
    rest.forEach(ex => {
        const L = (ex.name[0] || '#').toUpperCase();
        if (L !== letter) {
            if (open) html += '</div>';
            html += `<div class="ed-glbl">${escapeHtml(L)}</div><div class="ed-group">`;
            letter = L; open = true;
        }
        html += _selRowHtml(ex);
    });
    if (open) html += '</div>';
    list.innerHTML = html;
    _selRefreshBar();
}

function _selRefreshBar() {
    const btn = document.getElementById('sel-add-btn');
    if (!btn) return;
    const n = _selPicked.length;
    btn.disabled = !n;
    btn.classList.toggle('is-off', !n);
    btn.textContent = n ? (n === 1 ? 'הוסף תרגיל אחד' : `הוסף ${n} תרגילים`) : 'סמן תרגילים להוספה';
}

function selTap(name) {
    if ((managerState.selectorMode || 'add') === 'replace') { _selReplaceWith(name); return; }
    const k = _selPicked.indexOf(name);
    if (k >= 0) _selPicked.splice(k, 1); else _selPicked.push(name);
    haptic('light');
    renderSelectorList();
}

// תאימות: קוראים ישנים שבחרו תרגיל בודד
function selectExerciseFromList(exName) { _selPicked = [exName]; selCommit(); }

function _selBackToEditor() {
    state.historyStack.pop();
    _setNavDirection('back');
    navigate('ui-workout-editor');
    renderEditorList();
}

function selCommit() {
    if (!_selPicked.length) return;
    const mk = (name, inCl) => ({ name, isMain: false, sets: 3, restTime: inCl ? 30 : 90 });
    if (managerState.activeClusterRef !== null && managerState.activeClusterRef !== undefined && managerState.selectorMode === 'cluster') {
        const cluster = managerState.exercises[managerState.activeClusterRef];
        if (!cluster) return;
        const room = CLUSTER_MAX_EX - cluster.exercises.length;
        if (_selPicked.length > room) {
            showAlert(`בסבב יש מקום ל-${room} תרגילים נוספים (מקסימום ${CLUSTER_MAX_EX}). סימנת ${_selPicked.length}.`);
            return;
        }
        _selPicked.forEach(n => cluster.exercises.push(mk(n, true)));
    } else {
        _selPicked.forEach(n => managerState.exercises.push(mk(n, false)));
    }
    haptic('success');
    _selPicked = [];
    _selBackToEditor();
}

// החלפה: השם מתחלף, הסטים/המנוחה/היעד נשמרים
function _selReplaceWith(name) {
    const r = _selReplaceRef;
    managerState.selectorMode = 'add';
    _selReplaceRef = null;
    if (r) {
        const it = managerState.exercises[r.idx];
        const obj = it ? (r.i == null ? it : (it.exercises || [])[r.i]) : null;
        if (obj) obj.name = name;
    }
    haptic('success');
    _selBackToEditor();
}

// ─── IMPORT / EXPORT ───────────────────────────────────────────────────────

function triggerConfigImport() { document.getElementById('import-config-file').click(); }

function processConfigImport(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            StorageManager.importConfiguration(data);
        } catch (err) {
            showAlert("שגיאה בקריאת קובץ התבנית");
        }
    };
    reader.readAsText(file);
    input.value = "";
}

// ─── ייצוא/ייבוא חיבורים (Firebase, API, גשרים) ────────────────────────────

function triggerConnectionsImport() { document.getElementById('import-connections-file').click(); }

function processConnectionsImport(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            StorageManager.importConnections(data);
        } catch (err) {
            showAlert("שגיאה בקריאת קובץ החיבורים");
        }
    };
    reader.readAsText(file);
    input.value = "";
}

// ─── שחזור גיבוי מלא (צילום localStorage) ───────────────────────────────────

function triggerFullBackupImport() { document.getElementById('import-full-backup-file').click(); }

function processFullBackupImport(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            StorageManager.restoreFullBackup(data);
        } catch (err) {
            showAlert("שגיאה בקריאת קובץ הגיבוי");
        }
    };
    reader.readAsText(file);
    input.value = "";
}

// ─── ARCHIVE HELPERS ───────────────────────────────────────────────────────

function openArchiveFromDrawer(timestamp) {
    closeDayDrawer();
    setTimeout(() => {
        const archive = StorageManager.getArchive();
        const idx = archive.findIndex(a => a.timestamp === timestamp);
        if (idx !== -1) openArchiveDetail(idx);
    }, 350);
}

// ─── WORKOUT COLOR SELECTION ───────────────────────────────────────────────

const WORKOUT_COLORS = [
    { hex: '#0A84FF', name: 'Cobalt'   },
    { hex: '#30D158', name: 'Emerald'  },
    { hex: '#FF9F0A', name: 'Amber'    },
    { hex: '#FF6B6B', name: 'Coral'    },
    { hex: '#5AC8FA', name: 'Teal'     },
    { hex: '#5E5CE6', name: 'Indigo'   },
    { hex: '#98989D', name: 'Graphite' }
];

let _selectedEditorColor = '';

let _selectedThumbIdx = -1;

function selectEditorThumb(idx, el) {
    _selectedThumbIdx = idx;
    document.querySelectorAll('.editor-thumb-option').forEach(s => s.classList.remove('active'));
    if (el) el.classList.add('active');
    if (typeof _edRefreshSave === 'function') _edRefreshSave();
}

function _renderThumbPicker(currentIdx) {
    const hiddenIndices = _getHiddenThumbs();

    // אם התמונה הנוכחית מוסתרת — עבור לראשונה הגלויה
    if (hiddenIndices.includes(currentIdx)) {
        const firstVisible = WORKOUT_THUMB_IMAGES.findIndex((_, i) => !hiddenIndices.includes(i));
        currentIdx = firstVisible >= 0 ? firstVisible : 0;
    }
    _selectedThumbIdx = (typeof currentIdx === 'number' && currentIdx >= 0) ? currentIdx : 0;

    const container = document.getElementById('editor-thumb-picker');
    if (!container) return;
    container.innerHTML = '';

    // הצג רק תמונות גלויות
    WORKOUT_THUMB_IMAGES.forEach((url, idx) => {
        if (hiddenIndices.includes(idx)) return;
        const el = document.createElement('div');
        el.className = 'editor-thumb-option' + (idx === _selectedThumbIdx ? ' active' : '');
        el.style.backgroundImage = `url('${url}')`;
        el.onclick = () => selectEditorThumb(idx, el);
        container.appendChild(el);
    });

    // כפתור "נהל תמונות"
    const manageBtn = document.createElement('div');
    manageBtn.className = 'editor-thumb-option editor-thumb-manage-btn';
    manageBtn.title = 'נהל תמונות';
    manageBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:1.5rem;color:rgba(255,255,255,0.4);pointer-events:none;">add_a_photo</span>`;
    manageBtn.onclick = () => openThumbManageSheet();
    container.appendChild(manageBtn);
}

function selectEditorColor(hex, el) {
    _selectedEditorColor = hex;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    if (el) el.classList.add('active');
    if (typeof _edRefreshSave === 'function') _edRefreshSave();
}

function _renderColorSwatches(currentColor) {
    _selectedEditorColor = currentColor || '';
    const container = document.getElementById('editor-color-swatches');
    if (!container) return;
    container.innerHTML = '';
    WORKOUT_COLORS.forEach(c => {
        const sw = document.createElement('div');
        sw.className = 'color-swatch' + (c.hex === _selectedEditorColor ? ' active' : '');
        sw.style.background = c.hex;
        sw.title = c.name;
        sw.onclick = () => selectEditorColor(c.hex, sw);
        container.appendChild(sw);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE CONFIG UI  (v14.11.0)
// ─────────────────────────────────────────────────────────────────────────────

function openFirebaseConfigModal() {
    const cfg = FirebaseManager.getFirebaseConfig() || {};
    const ta = document.getElementById('fb-config-paste');
    if (ta) {
        if (cfg.apiKey) {
            // הצג את הקונפיג הקיים בפורמט קריא
            ta.value = `const firebaseConfig = {\n  apiKey: "${cfg.apiKey}",\n  authDomain: "${cfg.authDomain || ''}",\n  projectId: "${cfg.projectId || ''}",\n  storageBucket: "${cfg.storageBucket || ''}",\n  messagingSenderId: "${cfg.messagingSenderId || ''}",\n  appId: "${cfg.appId || ''}"\n};`;
        } else {
            ta.value = '';
        }
    }
    const btnClear = document.getElementById('btn-clear-firebase');
    if (btnClear) btnClear.style.display = FirebaseManager.isConfigured() ? '' : 'none';
    document.getElementById('firebase-config-modal').style.display = 'flex';
}

function closeFirebaseConfigModal() {
    document.getElementById('firebase-config-modal').style.display = 'none';
}

function saveFirebaseConfig() {
    const raw = (document.getElementById('fb-config-paste').value || '').trim();
    if (!raw) { showAlert('יש להדביק את בלוק ה-firebaseConfig.'); return; }

    // חילוץ תוכן ה-object מתוך הטקסט — תומך בפורמט const firebaseConfig = {...} וגם ב-{...} ישיר
    let jsonStr = raw;
    // הסר const firebaseConfig = ו-; בסוף אם קיימים
    jsonStr = jsonStr.replace(/^[\s\S]*?=\s*/, '').replace(/;?\s*$/, '').trim();
    // המר מ-JS object literal ל-JSON: הוסף מרכאות למפתחות
    jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    // המר single quotes ל-double quotes בערכים
    jsonStr = jsonStr.replace(/:\s*'([^']*)'/g, ': "$1"');
    // הסר פסיק אחרון לפני סגירת סוגריים
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

    let cfg;
    try {
        cfg = JSON.parse(jsonStr);
    } catch(e) {
        showAlert('פורמט לא תקין. ודא שהדבקת את הבלוק המלא מ-Firebase Console.');
        return;
    }

    if (!cfg.apiKey || !cfg.projectId) {
        showAlert('חסרים apiKey או projectId. ודא שהדבקת את הבלוק המלא.');
        return;
    }

    FirebaseManager.saveFirebaseConfig(cfg);
    if (typeof _afterConnectionChange === 'function') _afterConnectionChange();
    FirebaseManager._initialized = false;
    FirebaseManager._db = null;
    closeFirebaseConfigModal();
    updateFirebaseStatus();
    showAlert('חיבור Firebase נשמר! בצע רענון לאפליקציה כדי להפעיל.');
}

function confirmClearFirebase() {
    showConfirm('לנתק את Firebase ולמחוק את פרטי החיבור?', () => {
        FirebaseManager.clearFirebaseConfig();
        if (typeof _afterConnectionChange === 'function') _afterConnectionChange();
        closeFirebaseConfigModal();
        updateFirebaseStatus();
    });
}

function updateFirebaseStatus() {
    const el = document.getElementById('firebase-status');
    if (!el) return;
    if (FirebaseManager.isConfigured()) {
        const cfg = FirebaseManager.getFirebaseConfig();
        let html = `<span style="color:var(--type-b);font-weight:700;">&#9679; מחובר</span> <span style="color:var(--text-dim);font-size:0.85em;">${cfg.projectId}</span>`;
        // שורת "סונכרן לאחרונה" / התראת כשל (#3; v17.15: כל ארבעת המסלולים + אזהרת גודל)
        const sync = FirebaseManager.getSyncStatus();
        const stores = [['archive', 'ארכיון'], ['config', 'נתונים'], ['raw', 'MFP'], ['ai', 'שיחות AI']];
        const failed = stores.filter(([k]) => sync[k + 'Ok'] === false);
        // v19.7.6 — שלושה מצבים, לפי *חוב* ולא לפי זמן דחיפה:
        //   כשל → ממתין → מסונכרן. הזמן המוצג הוא max(OkAt), הדחיפה האחרונה בפועל.
        //
        // v19.7.3 הציג כאן min(OkAt) ("הכל מגובה עד"), כדי לחשוף מסלול ששקע בשקט.
        // אבל OkAt לא מבדיל בין "אין מה לדחוף" ל"יש ולא נדחף", ולכן מסלול בלי טריגר
        // שוטף (MFP נדחף רק בייבוא) קיבע את השורה על הגיבוי הידני האחרון — התראת
        // שווא קבועה בזמן שהכל מגובה. הכשל המקורי נתפס כעת טוב יותר: מסלול ששקע
        // מחזיק PendingAt פתוח, ומופיע בכתום עם התאריך שממנו הוא ממתין.
        const waiting  = stores.filter(([k]) => sync[k + 'Ok'] !== false && sync[k + 'PendingAt'] > 0);
        const okTimes = stores.map(([k]) => sync[k + 'OkAt'] || (sync[k + 'Ok'] === true ? sync[k + 'At'] : null)).filter(Boolean);
        const fmt = t => new Date(t).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        if (failed.length) {
            const list = failed.map(([k, l]) => l + (sync[k + 'Err'] === 'size' ? ' (גדול מדי)' : '')).join(', ');
            const fTimes = failed.map(([k]) => sync[k + 'FailAt']).filter(Boolean);
            const since = fTimes.length ? ' מאז ' + fmt(Math.min(...fTimes)) : '';
            html += `<br><span style="color:var(--danger);font-weight:700;font-size:0.85em;">&#9888; כשל סנכרון: ${list}${since} — גבה ידנית</span>`;
        } else if (waiting.length) {
            const wTimes = waiting.map(([k]) => sync[k + 'PendingAt']).filter(Boolean);
            const since = wTimes.length ? ' מאז ' + fmt(Math.min(...wTimes)) : '';
            html += `<br><span style="color:var(--type-c);font-weight:700;font-size:0.85em;">&#8635; ממתין לגיבוי: ${waiting.map(([, l]) => l).join(', ')}${since}</span>`;
        } else if (okTimes.length) {
            const partial = okTimes.length < stores.length
                ? ` (${stores.length - okTimes.length} מסלולים טרם גובו במכשיר הזה)` : '';
            html += `<br><span style="color:var(--text-dim);font-size:0.85em;">&#10003; מסונכרן: ${fmt(Math.max(...okTimes))}${partial}</span>`;
        }
        // אזהרת גודל מקדימה — המסמך מתקרב למחסום ה-1MB של Firestore
        const warns = ['config', 'ai'].filter(k => sync[k + 'Warn']);
        if (warns.length) {
            const pct = Math.round(Math.max(...warns.map(k => sync[k + 'Warn'])) / 1048576 * 100);
            html += `<br><span style="color:var(--type-c);font-weight:700;font-size:0.85em;">&#9888; מסמך הגיבוי ב-${pct}% ממגבלת Firestore — פנה מקום בקרוב</span>`;
        }
        el.innerHTML = html;
    } else {
        el.innerHTML = '<span style="color:var(--text-dim);">&#9679; לא מוגדר</span>';
    }
}

// ─── גיבוי ידני (מקומי + ענן) ────────────────────────────────────────────────


function saveWorkoutManagerToCloud() {
    if (!FirebaseManager.isConfigured()) {
        showAlert('Firebase לא מוגדר. הגדר חיבור בהגדרות.');
        return;
    }
    if (StorageManager._dbSuspect) { showAlert('לא נשמר לענן: ' + StorageManager.dbSuspectReason()); return; }
    FirebaseManager.saveConfigToCloud().then(ok => {
        showAlert(ok ? 'הקונפיגורציה נשמרה בענן!' : 'שגיאה בשמירה לענן — ' + FirebaseManager.describeSyncFailure('config') + '.');
    });
}

// ─── בדיקת עדכון גרסה ──────────────────────────────────────────────────────

async function checkForUpdate() {
    try {
        // cache: 'no-store' → עוקף גם SW cache וגם HTTP cache לחלוטין
        const res = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('network error');
        const data = await res.json();
        const serverVersion = data.version || '';

        // אם _gymproVersion עדיין לא נטען — קרא גם אותו ישירות מה-SW cache
        if (!window._gymproVersion) {
            const cached = await fetch('./version.json');
            const cachedData = await cached.json().catch(() => ({}));
            window._gymproVersion = cachedData.version || '';
        }
        const currentVersion = window._gymproVersion || '';

        if (serverVersion && currentVersion && serverVersion !== currentVersion) {
            showConfirm(
                `עדכון זמין! (${currentVersion} → ${serverVersion}). לנקות cache ולרענן?`,
                async () => {
                    if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(k => caches.delete(k)));
                    }
                    // הורדת sw.js טרי והמתנה שה-SW החדש ישתלט לפני הרענון —
                    // אחרת הרענון מוגש ע"י ה-SW הישן והעדכון נראה "תקוע"
                    try {
                        if ('serviceWorker' in navigator) {
                            const reg = await navigator.serviceWorker.getRegistration();
                            if (reg) {
                                await reg.update();
                                await new Promise(resolve => {
                                    let done = false;
                                    const finish = () => { if (!done) { done = true; resolve(); } };
                                    setTimeout(finish, 4000);
                                    navigator.serviceWorker.addEventListener('controllerchange', finish, { once: true });
                                });
                            }
                        }
                    } catch (e) { /* ממשיכים לרענון גם בכשל */ }
                    window.location.reload(true);
                }
            );
        } else {
            showAlert('האפליקציה מעודכנת (v' + (serverVersion || currentVersion) + ')');
        }
    } catch(e) {
        showAlert('לא ניתן לבדוק עדכונים. בדוק חיבור לאינטרנט.');
    }
}

// קריאה ראשונית לסטטוס Firebase כשה-DOM מוכן
document.addEventListener('DOMContentLoaded', () => {
    updateFirebaseStatus();
});

// ═══════════════════════════════════════════════════════════════════════════
// עורך תוכנית אירובית (v19.13)
// תוכנית אירובית אינה מכילה תרגילים, ולכן הטופס מחליף את "זרימת אימון":
// מודל (סבבים/רציף), זמנים, קומבינציות לפי טווח סבבים, וסוגי אימון בשעון.
// ═══════════════════════════════════════════════════════════════════════════

let _editorKind = 'strength';
let _editorCardio = null;

function setEditorKind(kind) {
    _editorKind = kind === 'cardio' ? 'cardio' : 'strength';
    if (_editorKind === 'cardio' && !_editorCardio) {
        _editorCardio = (typeof _cardioNormalize === 'function') ? _cardioNormalize(null) : { mode: 'interval' };
    }
    haptic('light');
    _applyEditorKindUI();
}

function setEditorCardioMode(mode) {
    if (!_editorCardio) _editorCardio = (typeof _cardioNormalize === 'function') ? _cardioNormalize(null) : {};
    _editorCardio.mode = mode === 'open' ? 'open' : 'interval';
    haptic('light');
    _applyEditorKindUI();
}

// _applyEditorKindUI — מחליף בין שני הטפסים. תוכנית אירובית מסתירה את בוחר
// התרגילים ואת זרימת האימון — אין בה תרגילים כלל.
function _applyEditorKindUI() {
    const isCardio = _editorKind === 'cardio';
    const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
    document.querySelectorAll('#editor-kind-seg .km-seg-btn').forEach(b => {
        b.classList.toggle('active', (b.dataset.kind === 'cardio') === isCardio);
    });
    show('editor-cardio-block', isCardio);
    show('editor-flow-header', !isCardio && _edReorder);
    show('editor-list', !isCardio);
    show('editor-add-row', !isCardio);
    show('ed-reorder-btn', !isCardio && managerState.exercises.length > 1);
    show('ed-muscles', !isCardio);
    if (isCardio) {
        const mode = (_editorCardio && _editorCardio.mode === 'open') ? 'open' : 'interval';
        document.querySelectorAll('#editor-cardio-mode-seg .km-seg-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === mode);
        });
        renderEditorCardioFields();
    }
    _edRenderHero();
    _edRefreshSave();
}

function _ecStep(field, delta) {
    if (!_editorCardio) return;
    const steps = { rounds: 1, workSec: 15, restSec: 15, prepSec: 5, targetSec: 300 };
    const lims  = { rounds: [1, 30], workSec: [10, 3600], restSec: [0, 1800], prepSec: [0, 60], targetSec: [300, 21600] };
    const step = steps[field] || 1, lim = lims[field] || [0, 9999];
    let v = Number(_editorCardio[field]) || 0;
    v += delta * step;
    if (field === 'targetSec' && v < lim[0]) { _editorCardio.targetSec = null; haptic('light'); renderEditorCardioFields(); return; }
    _editorCardio[field] = Math.max(lim[0], Math.min(lim[1], v));
    haptic('light');
    renderEditorCardioFields();
}

function _ecAddCombo() {
    if (!_editorCardio) return;
    if (!Array.isArray(_editorCardio.combos)) _editorCardio.combos = [];
    const last = _editorCardio.combos[_editorCardio.combos.length - 1];
    const from = last ? Math.min((Number(last.to) || 1) + 1, _editorCardio.rounds) : 1;
    _editorCardio.combos.push({ from, to: _editorCardio.rounds, text: '' });
    haptic('light');
    renderEditorCardioFields();
}
function _ecRemoveCombo(idx) {
    if (!_editorCardio || !Array.isArray(_editorCardio.combos)) return;
    _editorCardio.combos.splice(idx, 1);
    haptic('warning');
    renderEditorCardioFields();
}
// שדות הטקסט נכתבים ב-change (לא ב-input) — רינדור מחדש בכל הקלדה היה גוזל את הפוקוס
function _ecSetCombo(idx, field, value) {
    if (!_editorCardio || !_editorCardio.combos || !_editorCardio.combos[idx]) return;
    if (field === 'text') _editorCardio.combos[idx].text = String(value || '');
    else {
        const n = parseInt(value, 10);
        _editorCardio.combos[idx][field] = isNaN(n) ? 1 : Math.max(1, Math.min(_editorCardio.rounds, n));
    }
}
function _ecSetWatchTypes(value) {
    if (!_editorCardio) return;
    _editorCardio.watchTypes = String(value || '').split(',').map(x => x.trim()).filter(Boolean);
}

function renderEditorCardioFields() {
    const host = document.getElementById('editor-cardio-fields');
    if (!host || !_editorCardio) return;
    const c = _editorCardio;
    const f = sec => _fvFmt(sec || 0, 'time');
    const done = () => { renderEditorCardioFields(); _edRenderHero(); _edRefreshSave(); };
    const reg = key => _fvRegister('ec-' + key, key, () => c[key], v => { c[key] = v; done(); }, key === 'targetSec');
    ['workSec', 'restSec', 'prepSec', 'rounds', 'targetSec'].forEach(reg);

    if (c.mode === 'open') {
        host.innerHTML = `
            <div class="ed-group">
                <div class="ed-row ed-row--col"><span class="ed-n">יעד זמן</span>
                    <span class="ed-m">${c.targetSec ? 'הטבעת נסגרת אל היעד' : 'ללא יעד — שעון עולה ("ללא" בהקלדה)'}</span>
                    ${fvChipsHtml('ec-targetSec')}</div>
            </div>
            <div class="ed-group ed-pad">
                <div class="ed-n">סוגי אימון בשעון</div>
                <p class="ed-note">שמות סוג האימון כפי שהם מגיעים מ-Apple Watch, מופרדים בפסיק.
                אימון שעון בסוג הזה ישויך לתוכנית הזו בלחיצה אחת מ"אימונים מהשעון" בארכיון.</p>
                <input type="text" class="minimal-input m-0" id="ec-watchtypes"
                       value="${escapeHtml((c.watchTypes || []).join(', '))}"
                       placeholder="Cycling, Indoor Cycle, אופניים"
                       onchange="_ecSetWatchTypes(this.value);_edRefreshSave()">
            </div>`;
        return;
    }

    const t = (typeof cardioTotals === 'function') ? cardioTotals(c) : { workTotalSec: 0, totalSec: 0 };
    const combos = Array.isArray(c.combos) ? c.combos : [];
    host.innerHTML = `
        <div class="ed-group">
            <div class="ed-row ed-row--col"><span class="ed-n">עבודה</span>${fvChipsHtml('ec-workSec')}</div>
            <div class="ed-row ed-row--col"><span class="ed-n">מנוחה בין סבבים</span>${fvChipsHtml('ec-restSec')}</div>
            <div class="ed-row"><span class="ed-tx"><span class="ed-n">סבבים</span></span>${fvStepperHtml('ec-rounds', 1)}</div>
            <div class="ed-row ed-row--col"><span class="ed-n">היכון לפני הגונג הראשון</span>${fvChipsHtml('ec-prepSec')}</div>
        </div>
        <div class="ed-sub ed-sub--pad">סה״כ ${c.rounds} סבבים · ${f(t.workTotalSec)} עבודה · ${f(t.totalSec)} כולל מנוחות</div>
        <div class="ed-group ed-pad">
            <div class="ed-n">קומבינציות</div>
            <p class="ed-note">מה מוצג במסך האימון בסבב הנוכחי. סבב שאינו מכוסה בשום טווח יציג את
            הפאזה הבאה בלבד.</p>
            ${combos.map((x, i) => `
                <div class="ec-combo-row">
                    <input type="number" class="ec-num" min="1" max="${c.rounds}" value="${x.from}"
                           onchange="_ecSetCombo(${i},'from',this.value);_edRefreshSave()" aria-label="מסבב">
                    <span class="ec-dash">–</span>
                    <input type="number" class="ec-num" min="1" max="${c.rounds}" value="${x.to}"
                           onchange="_ecSetCombo(${i},'to',this.value);_edRefreshSave()" aria-label="עד סבב">
                    <input type="text" class="ec-txt" value="${escapeHtml(x.text || '')}"
                           placeholder="1-2 · סליפ · 1-2-3" onchange="_ecSetCombo(${i},'text',this.value);_edRefreshSave()">
                    <button class="ec-del" onclick="_ecRemoveCombo(${i})" aria-label="מחק">×</button>
                </div>`).join('')}
            <button class="ed-link ed-link--sm" onclick="_ecAddCombo()">+ הוסף קומבינציה</button>
        </div>`;
    _edRefreshSave();
}

// ═════════════════════════════════════════════════════════════════════════════
// עורך תוכניות v2 (v19.15) — ערך גמיש, רשימות מקובצות, גיליונות, סידור בגרירה
// עיקרון: כל שדות הטופס הישנים (IDs) נשארים ומוזנים מה-UI החדש, ולכן
// saveWorkoutChanges / saveExerciseConfig — ומבנה הדאטה — לא השתנו.
// ═════════════════════════════════════════════════════════════════════════════

// ─── ערך גמיש: הצעות מוכנות + כל מספר ידני ──────────────────────────────────
// FLEXVAL-START — בלוק טהור, נבדק ב-test/flexval.test.js (אל תסיר את הסמנים)
// kind: 'time' (שניות; קלט "1:45" או "105") | 'num' (עשרוני, מקבל גם פסיק) | 'min' (דקות → שניות)
function _fvParse(raw, kind) {
    const s = String(raw == null ? '' : raw).trim().replace(',', '.');
    if (!s) return { ok: false, reason: 'לא הוזן ערך' };
    if (kind === 'time') {
        let m = s.match(/^(\d{1,3}):(\d{1,2})$/);
        if (m) {
            const sec = Number(m[2]);
            if (sec >= 60) return { ok: false, reason: 'השניות חייבות להיות בין 0 ל-59' };
            return { ok: true, value: Number(m[1]) * 60 + sec };
        }
        if (/^\d+$/.test(s)) return { ok: true, value: Number(s) };
        return { ok: false, reason: 'יש להזין דקות ושניות (1:45) או שניות (105)' };
    }
    if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, reason: 'יש להזין מספר' };
    const v = Number(s);
    return { ok: true, value: kind === 'min' ? Math.round(v * 60) : v };
}

function _fvFmt(value, kind) {
    if (value == null || value === '' || isNaN(value)) return '—';
    if (kind === 'time' || kind === 'min') {
        const v = Math.max(0, Math.round(Number(value)));
        if (kind === 'min') return (v % 60 === 0) ? String(v / 60) : (Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0'));
        return Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0');
    }
    return String(Math.round(Number(value) * 1000) / 1000);
}

// spec: { kind, min, max, int?, stepOf? } — min/max ביחידות הערך השמור (שניות לזמן)
function _fvValidate(value, spec) {
    if (typeof value !== 'number' || isNaN(value)) return { ok: false, reason: 'יש להזין מספר' };
    if (spec.int && !Number.isInteger(value)) return { ok: false, reason: 'יש להזין מספר שלם' };
    if (spec.stepOf) {
        const q = value / spec.stepOf;
        if (Math.abs(q - Math.round(q)) > 1e-9) return { ok: false, reason: `בקפיצות של ${spec.stepOf}` };
    }
    if (value < spec.min || value > spec.max) {
        return { ok: false, reason: `הטווח המותר: ${_fvFmt(spec.min, spec.kind)} עד ${_fvFmt(spec.max, spec.kind)}` };
    }
    return { ok: true, value };
}

// שדות העורך: הצעות + טווח. הטווחים חוסמים טעויות הקלדה (900 במקום 90), לא בחירות.
const FV_SPECS = {
    rest:        { kind: 'time', min: 10,  max: 600,   presets: [60, 90, 120, 180],  label: 'מנוחה' },
    clRest:      { kind: 'time', min: 0,   max: 600,   presets: [90, 120, 180],      label: 'מנוחה בין סבבים' },
    clExRest:    { kind: 'time', min: 0,   max: 600,   presets: [0, 15, 30, 60],     label: 'מעבר לתרגיל הבא' },
    step:        { kind: 'num',  min: 0.25, max: 25,   presets: [1, 1.25, 2.5, 5],   label: 'קפיצה', unit: 'ק״ג' },
    base:        { kind: 'num',  min: 0,   max: 500,   label: 'משקל התחלתי', unit: 'ק״ג' },
    rangeMin:    { kind: 'num',  min: 0,   max: 500,   label: 'מינימום בגלגלת', unit: 'ק״ג' },
    rangeMax:    { kind: 'num',  min: 0,   max: 500,   label: 'מקסימום בגלגלת', unit: 'ק״ג' },
    dropPct:     { kind: 'num',  min: 5,   max: 60,    int: true, presets: [10, 20, 30], label: 'ירידה בדרופ', unit: '%' },
    sets:        { kind: 'num',  min: 1,   max: 20,    int: true, label: 'סטים' },
    tW:          { kind: 'num',  min: 0,   max: 500,   label: 'משקל יעד', unit: 'ק״ג' },
    tR:          { kind: 'num',  min: 1,   max: 100,   int: true, label: 'חזרות יעד' },
    tRIR:        { kind: 'num',  min: 0,   max: 5,     stepOf: 0.5, label: 'RIR יעד' },
    rounds:      { kind: 'num',  min: 1,   max: 30,    int: true, label: 'סבבים' },
    workSec:     { kind: 'time', min: 10,  max: 3600,  presets: [60, 120, 180],      label: 'עבודה' },
    restSec:     { kind: 'time', min: 0,   max: 1800,  presets: [30, 60],            label: 'מנוחה' },
    prepSec:     { kind: 'time', min: 0,   max: 60,    presets: [5, 10, 20],         label: 'היכון' },
    targetSec:   { kind: 'min',  min: 60,  max: 21600, presets: [1200, 1800, 2700, 3600], label: 'יעד זמן', unit: 'דק׳' }
};
// FLEXVAL-END

// רישום שדה פעיל: key → { spec, get(), set(v) }. הרינדור קורא ל-_fvRegister לפני שבונה את ה-HTML.
const _fvFields = {};
// clearable: שדה אופציונלי (יעד, טווח) — בגיליון מופיע "ללא", שמאפס ל-undefined
function _fvRegister(id, specKey, get, set, clearable) {
    _fvFields[id] = { spec: FV_SPECS[specKey], get, set, clearable: !!clearable };
    return id;
}

function _fvLabel(v, spec) {
    const t = _fvFmt(v, spec.kind);
    return spec.unit === '%' ? t + '%' : t;
}

// שבבי הצעות + ערך ידני נבחר (אם אינו אחת ההצעות) + "אחר"
function fvChipsHtml(id) {
    const f = _fvFields[id]; if (!f) return '';
    const cur = f.get();
    const presets = f.spec.presets || [];
    const isPreset = presets.some(p => p === cur);
    let h = presets.map(p =>
        `<button type="button" class="fv-chip${p === cur ? ' on' : ''}" onclick="_fvPick('${id}', ${p})">${_fvLabel(p, f.spec)}</button>`).join('');
    if (cur != null && cur !== '' && !isPreset) h += `<button type="button" class="fv-chip on cust" onclick="fvOpen('${id}')">${_fvLabel(cur, f.spec)}</button>`;
    h += `<button type="button" class="fv-chip other" onclick="fvOpen('${id}')">אחר</button>`;
    return `<div class="fv-chips">${h}</div>`;
}

// stepper עם מספר שניתן להקליד עליו
function fvStepperHtml(id, delta) {
    const f = _fvFields[id]; if (!f) return '';
    const cur = f.get();
    return `<div class="fv-step">
        <button type="button" onclick="_fvNudge('${id}', ${-delta})" aria-label="הפחת">−</button>
        <b onclick="fvOpen('${id}')">${cur == null || cur === '' ? '—' : _fvLabel(cur, f.spec)}</b>
        <button type="button" onclick="_fvNudge('${id}', ${delta})" aria-label="הוסף">+</button>
    </div>`;
}

// ערך שמוצג כטקסט ונפתח להקלדה בלחיצה (יעדים)
function fvValueHtml(id, emptyTxt) {
    const f = _fvFields[id]; if (!f) return '';
    const cur = f.get();
    const has = cur != null && cur !== '' && !isNaN(cur);
    return `<button type="button" class="fv-val${has ? '' : ' empty'}" onclick="fvOpen('${id}')">${has ? _fvLabel(cur, f.spec) : (emptyTxt || '—')}</button>`;
}

function _fvPick(id, v) {
    const f = _fvFields[id]; if (!f) return;
    haptic('light');
    f.set(v);
}

function _fvNudge(id, delta) {
    const f = _fvFields[id]; if (!f) return;
    const cur = Number(f.get()) || 0;
    let v = Math.round((cur + delta) * 1000) / 1000;
    v = Math.max(f.spec.min, Math.min(f.spec.max, v));
    haptic('light');
    f.set(v);
}

// ── גיליון ההקלדה ────────────────────────────────────────────────────────────
let _fvOpenId = null;
function fvOpen(id) {
    const f = _fvFields[id]; if (!f) return;
    _fvOpenId = id;
    const spec = f.spec, cur = f.get();
    document.getElementById('fv-title').textContent = spec.label || '';
    document.getElementById('fv-err').textContent = '';
    const time = spec.kind === 'time';
    document.getElementById('fv-time').style.display = time ? 'flex' : 'none';
    document.getElementById('fv-num').style.display = time ? 'none' : 'flex';
    document.getElementById('fv-hint').textContent = `הטווח: ${_fvLabel(spec.min, spec)} עד ${_fvLabel(spec.max, spec)}`;
    if (time) {
        const v = (cur == null || cur === '') ? '' : Math.round(Number(cur));
        document.getElementById('fv-mm').value = v === '' ? '' : Math.floor(v / 60);
        document.getElementById('fv-ss').value = v === '' ? '' : String(v % 60).padStart(2, '0');
    } else {
        const inp = document.getElementById('fv-input');
        inp.value = (cur == null || cur === '' || isNaN(cur)) ? '' : (spec.kind === 'min' ? _fvFmt(cur, 'min') : _fvFmt(cur, 'num'));
        inp.setAttribute('inputmode', (spec.int && spec.kind !== 'min') ? 'numeric' : 'decimal');
        document.getElementById('fv-unit').textContent = spec.unit || '';
    }
    document.getElementById('fv-clear').style.display = f.clearable ? '' : 'none';
    document.getElementById('fv-overlay').style.display = 'flex';
    setTimeout(() => { const el = document.getElementById(time ? 'fv-mm' : 'fv-input'); if (el) { el.focus(); el.select && el.select(); } }, 60);
}

function fvClose() {
    document.getElementById('fv-overlay').style.display = 'none';
    _fvOpenId = null;
}

function fvClear() {
    const f = _fvFields[_fvOpenId]; if (!f) { fvClose(); return; }
    fvClose();
    haptic('light');
    f.set(undefined);
}

function fvConfirm() {
    const f = _fvFields[_fvOpenId]; if (!f) { fvClose(); return; }
    const spec = f.spec;
    let raw;
    if (spec.kind === 'time') {
        const mm = document.getElementById('fv-mm').value.trim();
        const ss = document.getElementById('fv-ss').value.trim();
        raw = (mm === '' && ss === '') ? '' : `${mm || 0}:${ss || 0}`;
    } else {
        raw = document.getElementById('fv-input').value;
    }
    const p = _fvParse(raw, spec.kind);
    const v = p.ok ? _fvValidate(p.value, spec) : p;
    if (!v.ok) { document.getElementById('fv-err').textContent = v.reason; haptic('warning'); return; }
    fvClose();
    haptic('light');
    f.set(v.value);
}

// ─── עזרים: שריר, סטטיסטיקה, היסטוריה ──────────────────────────────────────
const ED_MUSCLE_COLOR = {
    'חזה': 'var(--m-chest)', 'גב': 'var(--m-back)', 'רגליים': 'var(--m-legs)', 'כתפיים': 'var(--m-sh)',
    'יד קדמית': 'var(--m-bi)', 'יד אחורית': 'var(--m-tri)', 'ידיים': 'var(--m-bi)', 'בטן': 'var(--m-core)',
    'קליסטניקס': 'var(--m-cal)'
};

function _edExMuscle(name) {
    const ex = (state.exercises || []).find(e => e.name === name);
    return (ex && typeof getMuscleBadge === 'function' && getMuscleBadge(ex.muscles)) || 'אחר';
}

// סטים לכל פריט: תרגיל רגיל = sets; תרגיל בסבב = סט אחד בכל סבב
function _edPlanStats(items) {
    let exCount = 0, sets = 0; const byMuscle = {};
    (items || []).forEach(it => {
        if (!it) return;
        if (it.type === 'cluster') {
            (it.exercises || []).forEach(ex => {
                exCount++; const n = Number(it.rounds) || 1; sets += n;
                const m = _edExMuscle(ex.name); byMuscle[m] = (byMuscle[m] || 0) + n;
            });
        } else if (it.type !== 'cardio' && it.name) {
            exCount++; const n = Number(it.sets) || 3; sets += n;
            const m = _edExMuscle(it.name); byMuscle[m] = (byMuscle[m] || 0) + n;
        }
    });
    return { exCount, sets, byMuscle };
}

function _edRel(ts) {
    if (!ts) return 'טרם בוצע';
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const d1 = new Date(ts); d1.setHours(0, 0, 0, 0);
    const days = Math.round((d0 - d1) / 86400000);
    if (days <= 0) return 'היום';
    if (days === 1) return 'אתמול';
    if (days < 7) return `לפני ${days} ימים`;
    if (days < 14) return 'לפני שבוע';
    if (days < 60) return `לפני ${Math.floor(days / 7)} שבועות`;
    return `לפני ${Math.floor(days / 30)} חודשים`;
}

let _edArchCache = null, _edArchAt = 0;
function _edArchive() {
    // קריאה אחת לרינדור — הארכיון גדול, ורשימת הניהול קוראת אותו לכל תוכנית
    if (!_edArchCache || Date.now() - _edArchAt > 3000) {
        try { _edArchCache = (StorageManager.getArchive() || []).slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); }
        catch (e) { _edArchCache = []; }
        _edArchAt = Date.now();
    }
    return _edArchCache;
}

function _edLastDone(key) {
    const hit = _edArchive().find(a => a && a.type === key);
    return hit ? hit.timestamp : null;
}

// הביצוע האחרון של תרגיל — מתוך log המובנה של רשומת הארכיון (סטים רגילים, בלי דרופים)
function _edLastPerf(exName) {
    for (const a of _edArchive()) {
        const sets = (a.log || []).filter(l => l && l.exName === exName && !l.skip && !l.drop && l.w != null && l.r != null);
        if (sets.length) return { ts: a.timestamp, date: a.date, sets };
    }
    return null;
}

function _edPlanUsage(exName) {
    let n = 0;
    Object.keys(state.workouts || {}).forEach(k => {
        const wo = state.workouts[k];
        if (Array.isArray(wo) && wo.some(it => it && (it.name === exName || (it.type === 'cluster' && (it.exercises || []).some(x => x.name === exName))))) n++;
    });
    return n;
}

function _edMono(name) {
    return `<span class="ed-mono">${escapeHtml(typeof getExInitials === 'function' ? getExInitials(name) : String(name || '').slice(0, 2))}</span>`;
}

// ─── רשימת ניהול התוכניות ───────────────────────────────────────────────────
function _edWhen(meta) {
    if (meta && meta.isDeloadOnly) return 'deload';
    if (meta && meta.availableInDeload) return 'both';
    return 'regular';
}

function renderManagerList() {
    const list = document.getElementById('manager-list');
    if (!list) return;
    const keys = Object.keys(state.workouts || {});
    const metaOf = k => state.workoutMeta[k] || {};
    const buckets = {
        active: keys.filter(k => !metaOf(k).isHidden && !metaOf(k).isDeloadOnly),
        deload: keys.filter(k => !metaOf(k).isHidden && metaOf(k).isDeloadOnly),
        hidden: keys.filter(k => metaOf(k).isHidden)
    };
    if (!buckets[_managerTab]) _managerTab = 'active';
    const tab = (id, label) => `<button class="km-seg-btn ${_managerTab === id ? 'active' : ''}" onclick="_setManagerTab('${id}')">${label} · ${buckets[id].length}</button>`;
    let html = `<div class="km-seg-control ed-seg">${tab('active', 'פעילות')}${tab('deload', 'דילואוד')}${tab('hidden', 'מוסתרות')}</div>`;

    const shown = buckets[_managerTab];
    if (!shown.length) {
        html += `<div class="ed-empty"><b>${_managerTab === 'hidden' ? 'אין תוכניות מוסתרות' : _managerTab === 'deload' ? 'אין תוכניות לדילואוד בלבד' : 'אין תוכניות פעילות'}</b></div>`;
    } else {
        const isCardio = k => typeof isCardioWorkout === 'function' && isCardioWorkout(k);
        const groups = [['כוח', shown.filter(k => !isCardio(k))], ['אירובי', shown.filter(isCardio)]];
        groups.forEach(([label, ks]) => {
            if (!ks.length) return;
            html += `<div class="ed-glbl">${label}</div><div class="ed-group">`;
            ks.forEach(key => {
                const meta = metaOf(key);
                const allIdx = keys.indexOf(key);
                const thumbIdx = (typeof meta._thumbIdx === 'number') ? meta._thumbIdx : (allIdx % WORKOUT_THUMB_IMAGES.length);
                const img = WORKOUT_THUMB_IMAGES[thumbIdx % WORKOUT_THUMB_IMAGES.length];
                let sub;
                if (isCardio(key)) sub = _managerCardSubtitle(key, 0);
                else {
                    const st = _edPlanStats(state.workouts[key]);
                    const clusters = (state.workouts[key] || []).filter(i => i && i.type === 'cluster').length;
                    sub = `${st.exCount} תרגילים · ${st.sets} סטים${clusters ? ` · ${clusters === 1 ? 'סבב אחד' : clusters + ' סבבים'}` : ''}`;
                }
                sub += ' · ' + _edRel(_edLastDone(key));
                html += `<button class="ed-row ed-row--btn ed-row--img" onclick="editWorkout('${escapeJsAttr(key)}')">
                    <span class="ed-photo" style="background-image:url('${img}')">${meta.color ? `<i class="ed-pdot" style="background:${meta.color}"></i>` : ''}</span>
                    <span class="ed-tx"><span class="ed-n">${escapeHtml(key)}</span><span class="ed-m">${sub}</span></span>
                    <span class="ed-chev">‹</span>
                </button>`;
            });
            html += `</div>`;
        });
    }
    list.innerHTML = html;
    const createBtn = document.getElementById('btn-create-workout');
    if (createBtn) createBtn.style.display = '';
}

// ─── מצב העורך: שמירה, "מלוכלך", גיבור ─────────────────────────────────────
let _edReorder = false;
let _edSnap = '';

function _edStateStr() {
    const g = id => { const el = document.getElementById(id); return el ? el.checked : false; };
    const nameEl = document.getElementById('editor-workout-name');
    return JSON.stringify({
        n: nameEl ? nameEl.value.trim() : '', k: _editorKind,
        x: _editorKind === 'cardio' ? null : managerState.exercises,
        c: _editorKind === 'cardio' ? _editorCardio : null,
        d: g('editor-deload-check'), o: g('editor-deload-only-check'), h: g('editor-hidden-check'),
        col: typeof _selectedEditorColor !== 'undefined' ? _selectedEditorColor : '',
        th: typeof _selectedThumbIdx !== 'undefined' ? _selectedThumbIdx : -1
    });
}

function _edIsDirty() {
    if (!_edSnap) return false;
    return _edStateStr() !== _edSnap;
}

// "שמור" פעיל רק כשיש מה לשמור: שם + תוכן, ובתוכנית קיימת — שינוי כלשהו
function _edRefreshSave() {
    const btn = document.getElementById('ed-save-btn');
    if (!btn) return;
    const nameEl = document.getElementById('editor-workout-name');
    const name = nameEl ? nameEl.value.trim() : '';
    const isNew = !managerState.originalName;
    let ok = !!name && (_editorKind === 'cardio' || (managerState.exercises || []).length > 0);
    if (ok && !isNew) ok = _edIsDirty();
    btn.disabled = !ok;
    btn.classList.toggle('is-off', !ok);
    btn.textContent = (!isNew && ok) ? 'שמור שינויים' : 'שמור';
}

const ED_WHEN_LABEL = { regular: 'שבועות 1–3', both: 'גם בדילואוד', deload: 'רק בדילואוד' };

function _edCurWhen() {
    const d = document.getElementById('editor-deload-check'), o = document.getElementById('editor-deload-only-check');
    if (o && o.checked) return 'deload';
    if (d && d.checked) return 'both';
    return 'regular';
}

function _edRenderHero() {
    const sub = document.getElementById('ed-hero-sub');
    const bar = document.getElementById('ed-muscles');
    const when = ED_WHEN_LABEL[_edCurWhen()];
    const hidden = document.getElementById('editor-hidden-check');
    const setSub = document.getElementById('ed-settings-sub');
    if (setSub) setSub.textContent = `${when}${hidden && hidden.checked ? ' · מוסתרת' : ''}`;
    if (!sub) return;
    if (_editorKind === 'cardio') {
        const c = _editorCardio || {};
        const f = x => _fvFmt(x || 0, 'time');
        sub.textContent = c.mode === 'open'
            ? `אירובי רציף · ${c.targetSec ? 'יעד ' + Math.round(c.targetSec / 60) + ' דק׳' : 'ללא יעד'} · ${when}`
            : `אירובי · ${c.rounds || 0} סבבים · ${f(c.workSec)} / ${f(c.restSec)} · ${when}`;
        if (bar) bar.innerHTML = '';
        return;
    }
    const st = _edPlanStats(managerState.exercises);
    sub.textContent = st.exCount ? `${st.exCount} תרגילים · ${st.sets} סטים · ${when}` : when;
    if (!bar) return;
    const ent = Object.entries(st.byMuscle).sort((a, b) => b[1] - a[1]);
    if (!ent.length) { bar.innerHTML = ''; return; }
    bar.innerHTML = `<div class="ed-mbar">${ent.map(([m, n]) => `<i style="flex:${n};background:${ED_MUSCLE_COLOR[m] || 'var(--m-other)'}"></i>`).join('')}</div>
        <div class="ed-legend">${ent.map(([m, n]) => `<span style="--c:${ED_MUSCLE_COLOR[m] || 'var(--m-other)'}">${escapeHtml(m)} ${n}</span>`).join('')}</div>`;
}

// ─── גיליונות ────────────────────────────────────────────────────────────────
const ED_SHEETS = ['ed-ex-sheet', 'ed-cl-sheet', 'ed-add-sheet', 'ed-plan-sheet'];
let _edSheetWant = null;   // הגיליון שאמור להיות פתוח — סגירה מהירה לפני ה-frame הבא לא תידרס
function _edOpenSheet(id) {
    ED_SHEETS.forEach(s => { const el = document.getElementById(s); if (el && s !== id) el.classList.remove('open'); });
    document.getElementById('ed-sheet-overlay').style.display = 'block';
    _edSheetWant = id;
    requestAnimationFrame(() => { if (_edSheetWant === id) document.getElementById(id).classList.add('open'); });
}
function edCloseSheets() {
    _edSheetWant = null;
    ED_SHEETS.forEach(s => { const el = document.getElementById(s); if (el) el.classList.remove('open'); });
    const ov = document.getElementById('ed-sheet-overlay');
    if (ov) ov.style.display = 'none';
    _edExRef = null;
}

function edOpenAddSheet() { _edOpenSheet('ed-add-sheet'); }

// ─── גיליון תרגיל ────────────────────────────────────────────────────────────
let _edExRef = null;   // { idx, i } — i=null לתרגיל רגיל

function edOpenExSheet(idx, i) {
    _edExRef = { idx, i: (i === undefined ? null : i) };
    _edRenderExSheet();
    _edOpenSheet('ed-ex-sheet');
}

function _edExObj() {
    const r = _edExRef; if (!r) return null;
    const it = managerState.exercises[r.idx]; if (!it) return null;
    return r.i == null ? it : (it.exercises || [])[r.i] || null;
}

function _edExChanged() { renderEditorList(); _edRenderExSheet(); }

function _edRenderExSheet() {
    const body = document.getElementById('ed-ex-body');
    const ex = _edExObj();
    if (!body) return;
    if (!ex) { edCloseSheets(); return; }
    const inCl = _edExRef.i != null;
    const items = managerState.exercises;
    let pos;
    if (inCl) {
        const letter = String.fromCharCode(65 + items.slice(0, _edExRef.idx).filter(x => x.type === 'cluster').length);
        pos = `${_getClusterLabel(items[_edExRef.idx]).title} ${letter} · ${letter}${_edExRef.i + 1}`;
    } else {
        const num = items.slice(0, _edExRef.idx + 1).filter(x => x.type !== 'cluster').length;
        pos = `תרגיל ${num} מתוך ${items.filter(x => x.type !== 'cluster').length}`;
    }
    _fvRegister('ex-sets', 'sets', () => ex.sets || 3, v => { ex.sets = v; _edExChanged(); });
    _fvRegister('ex-rest', inCl ? 'clExRest' : 'rest',
        () => ex.restTime != null ? ex.restTime : (inCl ? 30 : (ex.isMain ? 120 : 90)),
        v => { ex.restTime = v; _edExChanged(); });
    _fvRegister('ex-tw', 'tW', () => ex.targetWeight, v => { ex.targetWeight = v; _edExChanged(); }, true);
    _fvRegister('ex-tr', 'tR', () => ex.targetReps, v => { ex.targetReps = v; _edExChanged(); }, true);
    _fvRegister('ex-trir', 'tRIR', () => ex.targetRIR, v => { ex.targetRIR = v; _edExChanged(); }, true);
    _fvRegister('ex-drop', 'dropPct', () => ex.dropPct || 20, v => { ex.dropPct = v; _edExChanged(); });

    const last = _edLastPerf(ex.name);
    const lastHtml = last
        ? `<div class="ed-glbl">פעם קודמת · ${escapeHtml(last.date || '')}</div>
           <div class="ed-hist">${last.sets.slice(0, 6).map((l, k) => `<span>${_fvFmt(l.w, 'num')}×${l.r}<small>${l.rir != null && l.rir !== '' ? 'RIR ' + l.rir : 'סט ' + (k + 1)}</small></span>`).join('')}</div>`
        : `<div class="ed-glbl">פעם קודמת</div><div class="ed-note">אין עדיין היסטוריה לתרגיל הזה.</div>`;

    const setsRow = (!inCl && !ex.isMain)
        ? `<div class="ed-row"><span class="ed-tx"><span class="ed-n">סטים</span></span>${fvStepperHtml('ex-sets', 1)}</div>` : '';
    const mainRow = !inCl ? `<div class="ed-row"><span class="ed-tx"><span class="ed-n">תרגיל ראשי</span><span class="ed-m">יעד המשקל נגזר מה-1RM</span></span>
        <label class="km-switch"><input type="checkbox" ${ex.isMain ? 'checked' : ''} onchange="edToggleMain()"><span class="km-switch-track"></span></label></div>` : '';
    const dropRow = !inCl ? `<div class="ed-row"><span class="ed-tx"><span class="ed-n">דרופ סט</span><span class="ed-m">אחרי הסט האחרון</span></span>
        <label class="km-switch"><input type="checkbox" ${ex.dropSet ? 'checked' : ''} onchange="edToggleDrop()"><span class="km-switch-track"></span></label></div>
        ${ex.dropSet ? `<div class="ed-row ed-row--col"><span class="ed-n">ירידה במשקל</span>${fvChipsHtml('ex-drop')}</div>` : ''}` : '';
    const hasTarget = ex.targetWeight != null || ex.targetReps != null || ex.targetRIR != null;

    body.innerHTML = `
        <div class="ed-sh-head">${_edMono(ex.name)}<span class="ed-tx"><span class="ed-n ed-n--lg">${escapeHtml(ex.name)}</span><span class="ed-m">${escapeHtml(_edExMuscle(ex.name))} · ${pos}</span></span></div>
        ${lastHtml}
        <div class="ed-group">
            ${setsRow}
            <div class="ed-row ed-row--col"><span class="ed-n">${inCl ? 'מעבר לתרגיל הבא' : 'מנוחה'}</span>${fvChipsHtml('ex-rest')}</div>
        </div>
        <div class="ed-glbl ed-glbl--row"><span>יעד</span>${last ? `<button class="ed-link ed-link--sm" onclick="edFillFromLast()">מלא מהפעם הקודמת</button>` : (hasTarget ? `<button class="ed-link ed-link--sm" onclick="edClearTargets()">נקה יעד</button>` : '')}</div>
        <div class="ed-tgt">
            <div>${fvValueHtml('ex-tw', 'אוטומטי')}<small>ק״ג</small></div>
            <div>${fvValueHtml('ex-tr', 'אוטומטי')}<small>חזרות</small></div>
            <div>${fvValueHtml('ex-trir', 'אוטומטי')}<small>RIR</small></div>
        </div>
        ${(mainRow || dropRow) ? `<div class="ed-group">${mainRow}${dropRow}</div>` : ''}
        <div class="ed-group"><button class="ed-row ed-row--btn" onclick="edReplaceEx()"><span class="ed-tx"><span class="ed-n">החלף תרגיל</span><span class="ed-m">שומר את הסטים, המנוחה והיעד</span></span><span class="ed-chev">‹</span></button></div>
        <button class="ed-danger" onclick="edRemoveEx()">הסר מהתוכנית</button>`;
}

function edToggleMain() { const ex = _edExObj(); if (!ex) return; ex.isMain = !ex.isMain; haptic('light'); _edExChanged(); }
function edToggleDrop() {
    const ex = _edExObj(); if (!ex) return;
    ex.dropSet = !ex.dropSet;
    if (ex.dropSet && !ex.dropPct) ex.dropPct = 20;
    haptic('light'); _edExChanged();
}
function edClearTargets() { const ex = _edExObj(); if (!ex) return; ex.targetWeight = undefined; ex.targetReps = undefined; ex.targetRIR = undefined; _edExChanged(); }
// יעד מהביצוע האחרון: הסט הכבד (שוויון — יותר חזרות)
function edFillFromLast() {
    const ex = _edExObj(); if (!ex) return;
    const last = _edLastPerf(ex.name); if (!last) return;
    const top = last.sets.slice().sort((a, b) => (Number(b.w) - Number(a.w)) || (Number(b.r) - Number(a.r)))[0];
    ex.targetWeight = Number(top.w);
    ex.targetReps = parseInt(top.r, 10) || undefined;
    const rir = parseFloat(top.rir);
    ex.targetRIR = isNaN(rir) ? undefined : rir;
    haptic('light'); _edExChanged();
}
function edRemoveEx() {
    const r = _edExRef; if (!r) return;
    edCloseSheets();
    if (r.i == null) removeExFromEditor(r.idx); else removeExFromCluster(r.idx, r.i);
    haptic('warning');
}
function edReplaceEx() {
    if (!_edExRef) return;
    _selReplaceRef = Object.assign({}, _edExRef);
    edCloseSheets();
    managerState.activeClusterRef = null;
    managerState.selectorMode = 'replace';
    prepareSelector();
}

// ─── סבב ────────────────────────────────────────────────────────────────────
let _edClIdx = null;
function edOpenClusterSheet(idx) { _edClIdx = idx; _edRenderClSheet(); _edOpenSheet('ed-cl-sheet'); }
function _edRenderClSheet() {
    const body = document.getElementById('ed-cl-body');
    const c = managerState.exercises[_edClIdx];
    if (!body) return;
    if (!c || c.type !== 'cluster') { edCloseSheets(); return; }
    const done = () => { renderEditorList(); _edRenderClSheet(); };
    _fvRegister('cl-rounds', 'rounds', () => c.rounds, v => { c.rounds = v; done(); });
    _fvRegister('cl-rest', 'clRest', () => c.clusterRest, v => { c.clusterRest = v; done(); });
    const atMax = (c.exercises || []).length >= CLUSTER_MAX_EX;
    body.innerHTML = `
        <h3 class="ed-sheet-title">${_getClusterLabel(c).title}</h3>
        <div class="ed-group">
            <div class="ed-row"><span class="ed-tx"><span class="ed-n">סבבים</span></span>${fvStepperHtml('cl-rounds', 1)}</div>
            <div class="ed-row ed-row--col"><span class="ed-n">מנוחה בין סבבים</span>${fvChipsHtml('cl-rest')}</div>
        </div>
        <div class="ed-note">זמן המעבר בין התרגילים בתוך הסבב נקבע בגיליון של כל תרגיל.</div>
        <div class="ed-group">${atMax
            ? `<div class="ed-row"><span class="ed-tx"><span class="ed-m">מקסימום ${CLUSTER_MAX_EX} תרגילים בסבב</span></span></div>`
            : `<button class="ed-row ed-row--btn" onclick="edCloseSheets();openExerciseSelectorForCluster(${_edClIdx})"><span class="ed-tx"><span class="ed-n ed-accent">הוסף תרגילים לסבב</span></span><span class="ed-chev">‹</span></button>`}</div>
        <button class="ed-danger" onclick="edRemoveCluster(${_edClIdx})">הסר את הסבב</button>`;
}
function edRemoveCluster(idx) {
    const c = managerState.exercises[idx]; if (!c) return;
    const go = () => { managerState.exercises.splice(idx, 1); edCloseSheets(); renderEditorList(); _applyEditorKindUI(); };
    if ((c.exercises || []).length) showConfirm(`להסיר את הסבב ואת ${c.exercises.length} התרגילים שבו?`, go); else go();
}

// ─── הגדרות תוכנית ───────────────────────────────────────────────────────────
function openPlanSettings() { _edSyncWhenSeg(); _edOpenSheet('ed-plan-sheet'); }

function _edSyncWhenSeg() {
    const w = _edCurWhen();
    document.querySelectorAll('#ed-when-seg .km-seg-btn').forEach(b => b.classList.toggle('active', b.dataset.when === w));
}

// "מתי מוצג" — אותם שני שדות דאטה (availableInDeload / isDeloadOnly), בורר אחד
function edSetWhen(w) {
    document.getElementById('editor-deload-only-check').checked = (w === 'deload');
    document.getElementById('editor-deload-check').checked = (w === 'both' || w === 'deload');
    haptic('light');
    _edSyncWhenSeg(); _edRenderHero(); _edRefreshSave();
}

function edDuplicatePlan() {
    const key = managerState.originalName; if (!key) return;
    if (_edIsDirty()) { showAlert('יש שינויים שלא נשמרו. השכפול יוצר עותק של הגרסה השמורה — שמור קודם אם תרצה שהם ייכללו.'); }
    const before = Object.keys(state.workouts).length;
    duplicateWorkout(key);
    if (Object.keys(state.workouts).length > before && typeof showCloudToast === 'function') showCloudToast(`נוצר "${key} Copy"`, true);
}

function edDeletePlan() {
    const key = managerState.originalName; if (!key) return;
    showConfirm(`למחוק את התוכנית "${key}"? הארכיון לא נפגע.`, () => {
        delete state.workouts[key];
        if (state.workoutMeta[key]) delete state.workoutMeta[key];
        StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);
        StorageManager.saveData(StorageManager.KEY_META, state.workoutMeta);
        autoSaveConfigToCloud();
        edCloseSheets();
        _edSnap = '';
        state.historyStack.pop();
        _setNavDirection('back');
        navigate('ui-workout-manager');
        renderManagerList(); renderWorkoutMenu();
    });
}

// ─── מצב סידור + גרירה ──────────────────────────────────────────────────────
function edToggleReorder() {
    _edReorder = !_edReorder;
    const btn = document.getElementById('ed-reorder-btn');
    if (btn) btn.textContent = _edReorder ? 'סיום' : 'סדר';
    const hint = document.getElementById('editor-flow-header');
    if (hint) hint.style.display = _edReorder ? '' : 'none';
    const bar = document.getElementById('ed-bar');
    if (bar) bar.classList.toggle('is-hidden', _edReorder);
    haptic('light');
    renderEditorList();
}

function _edArrFor(scope) {
    if (scope === 'top') return managerState.exercises;
    const m = /^cl:(\d+)$/.exec(scope || '');
    const c = m ? managerState.exercises[Number(m[1])] : null;
    return c && c.type === 'cluster' ? c.exercises : null;
}

// גרירה עם Pointer Events על הידית בלבד (touch-action:none ב-CSS) — בלי ספרייה
function _edBindDrag() {
    const list = document.getElementById('editor-list');
    if (!list) return;
    list.querySelectorAll('.ed-handle').forEach(h => {
        h.onpointerdown = (e) => {
            const item = h.closest('.ed-drag-item'); if (!item) return;
            const scope = item.dataset.scope;
            const container = scope === 'top' ? list : item.parentNode;
            const sibs = Array.from(container.children).filter(el => el.classList.contains('ed-drag-item') && el.dataset.scope === scope);
            const from = sibs.indexOf(item); if (from < 0) return;
            e.preventDefault();
            try { h.setPointerCapture(e.pointerId); } catch (_) {}
            const rects = sibs.map(el => el.getBoundingClientRect());
            const startY = e.clientY, gap = 8;
            const hgt = rects[from].height + (scope === 'top' ? gap : 0);
            let to = from;
            item.classList.add('ed-lifted');
            haptic('light');
            const move = (ev) => {
                const dy = ev.clientY - startY;
                item.style.transform = `translateY(${dy}px)`;
                const center = rects[from].top + rects[from].height / 2 + dy;
                to = 0;
                rects.forEach((r, k) => { if (k !== from && center > r.top + r.height / 2) to++; });
                sibs.forEach((el, k) => {
                    if (k === from) return;
                    let shift = 0;
                    if (from < to && k > from && k <= to) shift = -hgt;
                    if (from > to && k >= to && k < from) shift = hgt;
                    el.style.transform = shift ? `translateY(${shift}px)` : '';
                });
            };
            const up = () => {
                h.removeEventListener('pointermove', move);
                h.removeEventListener('pointerup', up);
                h.removeEventListener('pointercancel', up);
                sibs.forEach(el => { el.style.transform = ''; });
                item.classList.remove('ed-lifted');
                const arr = _edArrFor(scope);
                if (arr && to !== from) {
                    const [moved] = arr.splice(from, 1);
                    arr.splice(to, 0, moved);
                    haptic('medium');
                }
                renderEditorList();
            };
            h.addEventListener('pointermove', move);
            h.addEventListener('pointerup', up);
            h.addEventListener('pointercancel', up);
        };
    });
}


// ─── טופס תרגיל: UI מעל השדות הנסתרים ───────────────────────────────────────
const CONF_MUSCLES = ['חזה', 'גב', 'רגליים', 'כתפיים', 'יד קדמית', 'יד אחורית', 'בטן', 'קליסטניקס'];

function _confNum(id) { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? undefined : v; }
function _confSetNum(id, v) { document.getElementById(id).value = (v == null || isNaN(v)) ? '' : String(v); }

function _confSetMuscle(m) { document.getElementById('conf-ex-muscle').value = m; haptic('light'); _confSyncUI(); }
function _confSetWMode(m) { document.getElementById('conf-ex-wmode').value = m; haptic('light'); _confSyncUI(); }

function _confSyncUI() {
    const muscle = document.getElementById('conf-ex-muscle').value;
    const chips = document.getElementById('conf-muscle-chips');
    if (chips) chips.innerHTML = CONF_MUSCLES.map(m =>
        `<button type="button" class="fv-chip${m === muscle ? ' on' : ''}" onclick="_confSetMuscle('${m}')">${m}</button>`).join('');
    const wm = document.getElementById('conf-ex-wmode').value || 'kg';
    document.querySelectorAll('#conf-wmode-seg .km-seg-btn').forEach(b => b.classList.toggle('active', b.dataset.wm === wm));

    _fvRegister('conf-base', 'base', () => _confNum('conf-ex-base'), v => { _confSetNum('conf-ex-base', v); _confSyncUI(); }, true);
    _fvRegister('conf-step', 'step', () => _confNum('conf-ex-step') || 2.5, v => { _confSetNum('conf-ex-step', v); _confSyncUI(); });
    const rangeSet = (id, other, isMin) => v => {
        const o = _confNum(other);
        if (v != null && o != null && (isMin ? v >= o : v <= o)) {
            showAlert(isMin ? 'המינימום חייב להיות קטן מהמקסימום.' : 'המקסימום חייב להיות גדול מהמינימום.');
            return;
        }
        _confSetNum(id, v); _confSyncUI();
    };
    _fvRegister('conf-min', 'rangeMin', () => _confNum('conf-ex-min'), rangeSet('conf-ex-min', 'conf-ex-max', true), true);
    _fvRegister('conf-max', 'rangeMax', () => _confNum('conf-ex-max'), rangeSet('conf-ex-max', 'conf-ex-min', false), true);

    const grp = document.getElementById('conf-weight-group');
    if (!grp) return;
    if (wm === 'bw') {
        grp.innerHTML = `<div class="ed-row"><span class="ed-tx"><span class="ed-m">במשקל גוף אין משקל התחלתי וקפיצות.</span></span></div>`;
        return;
    }
    grp.innerHTML = `
        <div class="ed-row"><span class="ed-tx"><span class="ed-n">משקל התחלתי</span><span class="ed-m">ריק = לפי ההיסטוריה</span></span>
            <span class="ed-inline-val">${fvValueHtml('conf-base', 'אוטומטי')}</span></div>
        <div class="ed-row ed-row--col"><span class="ed-n">קפיצה${wm === 'plates' ? ' (לכל צד)' : ''}</span><span class="ed-m">כמה מוסיפים בכל צעד בגלגלת</span>${fvChipsHtml('conf-step')}</div>
        <div class="ed-row"><span class="ed-tx"><span class="ed-n">טווח בגלגלת</span><span class="ed-m">מה מוצג בזמן אימון</span></span>
            <span class="ed-range"><span class="ed-inline-val">${fvValueHtml('conf-min', 'מינ׳')}</span><span class="ed-dash">–</span><span class="ed-inline-val">${fvValueHtml('conf-max', 'מקס׳')}</span></span></div>`;
}
