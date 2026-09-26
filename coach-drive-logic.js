/**
 * GYMPRO ELITE — סנכרון נתוני מאמן ל-Google Drive
 * ----------------------------------------------------------------------------
 * כותב לתיקייה "GymPro Coach Data" בדרייב קבצים קטנים לפי מקטע, כדי שמאמן
 * ה-Claude יקרא נתונים שוטפים בלי העלאה ידנית. הקובץ המאוחד החודשי לא משתנה.
 *
 * מקור אמת אחד: הרשומות נבנות ב-_buildUnifiedSections (bodylog-logic.js) — אותו
 * בונה של הייצוא המאוחד — ומכאן רק מסוננות לחלון. החריגים היחידים: workouts
 * (בלי summary, עקומות דופק בקובץ נפרד) ו-partial ביום הנוכחי של nutrition_daily.
 *
 * כתיבה דרך גשר התמונות (docs/photo-bridge.gs, פעולת coachWrite) — אותם URL ו-token.
 * כל קובץ נוצר פעם אחת ומעודכן במקום; קובץ שה-SHA-256 שלו לא השתנה אינו נשלח.
 * 00_readme.json נכתב אחרון, ורק אם כל שאר הקבצים הצליחו.
 * ==========================================================================*/

// ─── COACHDRIVE-START — בלוק טהור, נבדק ב-test/coach-drive.test.js (אל תסיר את הסמנים)

// חלון מתגלגל לכל קובץ, בימים, שמסתיים היום (Asia/Jerusalem). null = מלא, ללא חלון.
const COACH_DRIVE_WINDOWS = {
    'weights.json':           90,
    'nutrition_daily.json':   90,
    'sleep_recovery.json':    90,
    'workouts.json':          56,
    'nutrition_detailed.json': 30,
    'watch_hr_series.json':   30,
    'memory_box.json':        null
};
const COACH_DRIVE_README = '00_readme.json';
const COACH_DRIVE_TZ = 'Asia/Jerusalem';
// שדות השעון שנשארים ברשומת האימון. כל השאר (hrSeries, zoneBounds, hrRecovery1 ...)
// עוברים לרשומה המקבילה ב-watch_hr_series.json — כלום לא נזרק.
const COACH_WATCH_KEEP = ['hrAvg', 'hrMax', 'activeKcal', 'zoneSec'];
const COACH_DRIVE_NOTE = 'הנתונים ב-Drive עדכניים מהקובץ המאוחד האחרון. בחפיפה, Drive גובר.';
// מסמכי Google Doc (טקסט רגיל — המאמן קורא JSON גדול כ-base64, ו-Doc כטקסט ישיר).
// כל מסמך נגזר מקובץ JSON: אותו חלון ואותם אימונים. שם בלי סיומת.
const COACH_DRIVE_DOCS = { 'workouts_log': 'workouts.json' };
const COACH_LOG_SEP = '\n\n----------\n\n';

// YYYY-MM-DD לפי שעון ישראל — לא לפי אזור הזמן של המכשיר
function _cdIsraelDate(ms) {
    const p = {};
    for (const { type, value } of new Intl.DateTimeFormat('en-US', {
        timeZone: COACH_DRIVE_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(ms))) p[type] = value;
    return `${p.year}-${p.month}-${p.day}`;
}

// הזזת תאריך לוח (YYYY-MM-DD) בימים. חשבון ב-UTC — בלי מלכודות שעון קיץ.
function _cdShiftDate(iso, days) {
    const [y, m, d] = iso.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
    const p = x => String(x).padStart(2, '0');
    return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

// חלון של N ימים שמסתיים ב-today, כולל שניהם (90 יום = היום ועוד 89 אחורה)
function _cdWindow(days, today) {
    return days == null ? { from: null, to: null } : { from: _cdShiftDate(today, -(days - 1)), to: today };
}

function _cdHasStructured(w) {
    return (Array.isArray(w.log) && w.log.length > 0) || w.kind === 'cardio' ||
           !!(w.details && Object.keys(w.details).length);
}

// הערות שמופיעות בטקסט ה-summary ואין להן מקבילה בנתונים המובנים (note /
// details[].note / log[].note). הערה כזו היא באג — ורשומה שיש בה כזו שומרת את ה-summary.
function _cdOrphanNotes(w) {
    const text = String(w.summary || '');
    if (!text) return [];
    const norm = s => String(s || '').trim();
    const exNotes = new Set(Object.values(w.details || {}).map(d => norm(d && d.note)).filter(Boolean));
    const setNotes = new Set((w.log || []).map(l => norm(l && l.note)).filter(Boolean));
    const orphans = [];
    text.split('\n').forEach(line => {
        let m;
        if ((m = line.match(/^הערה: (.*)$/))) {
            if (norm(m[1]) && norm(m[1]) !== norm(w.note)) orphans.push(norm(m[1]));
        } else if ((m = line.match(/^הערת תרגיל: (.*)$/))) {
            if (norm(m[1]) && !exNotes.has(norm(m[1]))) orphans.push(norm(m[1]));
        } else {
            const i = line.indexOf(' | Note: ');
            if (i !== -1) {
                const n = norm(line.slice(i + 9));
                if (n && !setNotes.has(n)) orphans.push(n);
            }
        }
    });
    return orphans;
}

// רשומת אימון מהבונה המשותף → { workout, series }. summary מושמט רק כשהנתונים
// המובנים מכילים הכל; עקומת הדופק ושאר שדות השעון עוברים ל-series.
function _cdSplitWorkout(w) {
    const c = Object.assign({}, w);
    if (_cdHasStructured(c) && !_cdOrphanNotes(c).length) delete c.summary;
    let series = null;
    if (c.watch && typeof c.watch === 'object') {
        const keep = {}, rest = {};
        Object.keys(c.watch).forEach(k => { (COACH_WATCH_KEEP.includes(k) ? keep : rest)[k] = c.watch[k]; });
        c.watch = keep;
        if (Object.keys(rest).length) series = Object.assign({ timestamp: c.timestamp, date: c.date }, rest);
    }
    return { workout: c, series };
}

// sections = הפלט של _buildUnifiedSections על החלון הרחב ביותר.
// מחזיר { [fileName]: { records, window_days, from, to } } — records הוא מה שנכתב לקובץ.
function _cdBuildFiles(sections, today) {
    const win = name => _cdWindow(COACH_DRIVE_WINDOWS[name], today);
    const inWin = (name, d) => { const r = win(name); return (!r.from || d >= r.from) && (!r.to || d <= r.to); };
    const split = (sections.workouts || []).map(_cdSplitWorkout);
    const records = {
        'weights.json':            (sections.weights || []).filter(e => inWin('weights.json', e.date)),
        'nutrition_daily.json':    (sections.nutritionDaily || []).filter(d => inWin('nutrition_daily.json', d.date))
                                       .map(d => d.date === today ? Object.assign({}, d, { partial: true }) : d),
        'sleep_recovery.json':     (sections.sleepRecovery || []).filter(d => inWin('sleep_recovery.json', d.date)),
        'workouts.json':           split.filter(s => inWin('workouts.json', s.workout.date)).map(s => s.workout),
        'nutrition_detailed.json': (sections.nutritionDetailed || []).filter(d => inWin('nutrition_detailed.json', d.date)),
        'watch_hr_series.json':    split.filter(s => s.series && inWin('watch_hr_series.json', s.series.date)).map(s => s.series),
        'memory_box.json':         sections.memoryBox || []
    };
    const out = {};
    Object.keys(COACH_DRIVE_WINDOWS).forEach(name => {
        const r = win(name);
        out[name] = { records: records[name], window_days: COACH_DRIVE_WINDOWS[name], from: r.from, to: r.to };
    });
    return out;
}

// אילו קבצים לכתוב: חסר מזהה (טרם נוצר / נמחק) או שה-hash השתנה
function _cdPlan(stateFiles, hashes) {
    return Object.keys(hashes).filter(name => {
        const prev = stateFiles && stateFiles[name];
        return !prev || !prev.id || prev.hash !== hashes[name];
    });
}

// גוף יומן האימונים: טקסט הייצוא של כל אימון, מהחדש לישן — כלי הקריאה של המאמן
// עלול לחתוך מסמך ארוך, ולכן החדש בראש. textFn = _archiveCopyText(item, false).
function _cdLogBody(items, textFn) {
    return items.slice().sort((a, b) => b.timestamp - a.timestamp).map(textFn).join(COACH_LOG_SEP);
}
function _cdLogHeader(generated, from, to, n) {
    return `generated: ${generated} · from: ${from} · to: ${to} · workouts: ${n}`;
}

// תוכן ה-readme, בלי generated — כך אפשר לגבב אותו ולכתוב רק כשמשהו בו השתנה
function _cdReadmeBody(stateFiles, appVersion, readmeLines) {
    const files = {};
    Object.keys(COACH_DRIVE_WINDOWS).forEach(name => {
        const f = (stateFiles && stateFiles[name]) || {};
        files[name] = {
            window_days: COACH_DRIVE_WINDOWS[name], from: f.from || null, to: f.to || null,
            records: f.records || 0, bytes: f.bytes || 0, last_written: f.last_written || null
        };
    });
    Object.keys(COACH_DRIVE_DOCS).forEach(name => {
        const f = (stateFiles && stateFiles[name]) || {};
        files[name] = {
            window_days: COACH_DRIVE_WINDOWS[COACH_DRIVE_DOCS[name]], from: f.from || null, to: f.to || null,
            records: f.records || 0, chars: f.chars || 0, last_written: f.last_written || null,
            format: 'google_doc_text'
        };
    });
    return {
        app: 'GYMPRO ELITE', type: 'coach_drive_readme', app_version: appVersion || '',
        timezone: COACH_DRIVE_TZ, note: COACH_DRIVE_NOTE, files,
        readme: [
            'כל קובץ בתיקייה הוא מערך JSON של רשומות, באותם שדות בדיוק כמו המקטע המקביל בקובץ המאוחד: ' +
            'weights.json = weights, nutrition_daily.json = nutrition_daily, nutrition_detailed.json = nutrition_detailed, ' +
            'workouts.json = workouts, sleep_recovery.json = sleep_recovery, memory_box.json = memory_box.',
            'החלונות מתגלגלים ומסתיימים היום (Asia/Jerusalem); from/to ו-window_days לכל קובץ למעלה. ' +
            'רשומה שיצאה מהחלון יוצאת מהקובץ. memory_box מלא תמיד. כל התאריכים YYYY-MM-DD.',
            'nutrition_daily: הרשומה של היום מסומנת partial:true — היום עוד לא נגמר, והסכומים יגדלו.',
            'workouts: שדה summary (הטקסט החופשי) מושמט — הלוג המובנה (log, details, note, cardio) מכיל את הכל, ' +
            'כולל הערות האימון, התרגילים והסטים. summary נשאר רק ברשומה ישנה בלי לוג מובנה.',
            'workouts[].watch מכיל כאן רק hrAvg, hrMax, activeKcal ו-zoneSec. עקומת הדופק (hrSeries) ושאר שדות השעון ' +
            '(zoneBounds, hrRecovery1, start/end וכו\') נמצאים ב-watch_hr_series.json — רשומה לכל אימון, מקושרת לפי timestamp.',
            'workouts_log = אותם אימונים כמו workouts.json, בפורמט טקסט של ייצוא הסיכום, בלי סיכום המאמן, מהחדש לישן.',
            'last_written = מתי הקובץ נכתב לאחרונה. קובץ שהתוכן שלו לא השתנה אינו נכתב מחדש.'
        ].concat(readmeLines || [])
    };
}
// ─── COACHDRIVE-END ─────────────────────────────────────────────────────────

const CoachDrive = {
    KEY_ON: 'gympro_coach_drive_on',      // מתג הסנכרון (ברירת מחדל: כבוי)
    KEY_STATE: 'gympro_coach_drive_state', // מזהי קבצים, hashes, זמן סנכרון ושגיאה אחרונים
    INTERVAL_MS: 6 * 3600000,             // לכל היותר פעם ב-6 שעות (אלא אם "סנכרן עכשיו")
    RETRY_GAP_MS: 5 * 60000,              // אחרי כשל — לא לנסות שוב בכל חזרה לפרונט
    _busy: null,

    isOn() { return localStorage.getItem(this.KEY_ON) === '1'; },
    setOn(on) { localStorage.setItem(this.KEY_ON, on ? '1' : '0'); },
    getState() {
        try { return Object.assign({ files: {} }, JSON.parse(localStorage.getItem(this.KEY_STATE)) || {}); }
        catch (e) { return { files: {} }; }
    },
    _saveState(s) { try { localStorage.setItem(this.KEY_STATE, JSON.stringify(s)); } catch (e) {} },

    async _sha256(text) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // הודעת כשל נושאת את סיבתה — BAD_ACTION כמעט תמיד אומר שהגשר לא נפרס מחדש
    _describe(err) {
        const m = String((err && err.message) || err || '');
        if (err && err.name === 'AbortError') return 'הגשר לא ענה בזמן (timeout)';
        if (m === 'BAD_ACTION') return 'הגשר לא מכיר את coachWrite — פרוס גרסה חדשה של photo-bridge.gs (Deploy → New version)';
        if (m === 'BAD_TOKEN') return 'ה-token של גשר התמונות שגוי';
        if (m === 'TOKEN_NOT_SET') return 'בסקריפט של גשר התמונות לא הוגדר SECRET_TOKEN (Project Settings → Script properties)';
        if (m === 'BUSY') return 'הגשר עסוק בסנכרון אחר';
        if (m === 'NO_BRIDGE') return 'גשר התמונות לא מוגדר (URL ו-token בהגדרות "תמונות התקדמות")';
        if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'שגיאת רשת';
        return m || 'שגיאה לא ידועה';
    },

    async _post(payload) {
        const { url, token } = StorageManager.getPhotoBridge();
        if (!url || !token) throw new Error('NO_BRIDGE');
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 60000);
        try {
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // בלי preflight
                body: JSON.stringify(Object.assign({ token }, payload)),
                signal: ctrl.signal
            });
            const res = await StorageManager._bridgeJson(r);
            if (!res || !res.ok) throw new Error((res && res.error) || 'BRIDGE_ERROR');
            return res;
        } finally { clearTimeout(t); }
    },

    // נקרא בפתיחה ובחזרה לפרונט. שקט: לא זורק ולא מקפיץ הודעות.
    maybeSync() {
        if (!this.isOn() || this._busy) return;
        if (StorageManager._dbSuspect) return;   // תוכניות לא נטענו — לא לייצא מצב חשוד
        const s = this.getState();
        if (s.lastSuccess && Date.now() - s.lastSuccess < this.INTERVAL_MS) return;
        if (s.lastError && s.lastAttempt && Date.now() - s.lastAttempt < this.RETRY_GAP_MS) return;
        this.sync({}).catch(() => {});
    },

    // manual = "סנכרן עכשיו": עוקף את 6 השעות ובודק שהקבצים עדיין קיימים בדרייב
    sync({ manual } = {}) {
        if (this._busy) return this._busy;
        this._busy = this._run(!!manual).finally(() => { this._busy = null; _cdRefreshSettings(); });
        return this._busy;
    },

    async _run(manual) {
        const s = this.getState();
        s.lastAttempt = Date.now();
        this._saveState(s);
        try {
            const now = Date.now();
            const today = _cdIsraelDate(now);
            const maxDays = Math.max(...Object.values(COACH_DRIVE_WINDOWS).filter(d => d != null));
            const sections = _buildUnifiedSections({ from: _cdShiftDate(today, -(maxDays - 1)), to: today });
            const built = _cdBuildFiles(sections, today);

            const contents = {}, hashes = {};
            for (const name of Object.keys(built)) {
                contents[name] = JSON.stringify(built[name].records);
                hashes[name] = await this._sha256(contents[name]);
            }

            // יומן האימונים: הטקסט של ייצוא הסיכום לכל אימון, מהרשומה המקורית בארכיון
            // (אותם timestamps כמו ב-workouts.json). ה-hash בלי generated — אחרת כל סנכרון היה כותב.
            const docs = {};
            for (const name of Object.keys(COACH_DRIVE_DOCS)) {
                const src = built[COACH_DRIVE_DOCS[name]];
                const ts = new Set(src.records.map(w => w.timestamp));
                const items = StorageManager.getArchive().filter(a => a && ts.has(a.timestamp));
                const body = _cdLogBody(items, it => _archiveCopyText(it, false));
                docs[name] = { body, records: items.length, from: src.from, to: src.to, window_days: src.window_days };
                hashes[name] = await this._sha256(JSON.stringify([src.from, src.to, items.length]) + body);
            }

            // "סנכרן עכשיו": קובץ שנמחק ידנית בדרייב מאבד את ה-hash ונכתב מחדש
            if (manual) {
                const ids = Object.values(s.files).map(f => f && f.id).filter(Boolean);
                if (ids.length) {
                    const chk = await this._post({ action: 'coachCheck', ids });
                    s.folderId = chk.folderId || s.folderId;
                    Object.keys(s.files).forEach(n => { if (s.files[n] && chk.missing.includes(s.files[n].id)) delete s.files[n]; });
                }
            }

            // מטא-דאטה של החלון מתעדכנת גם לקובץ שלא נכתב (החלון זז כל יום)
            Object.keys(built).forEach(name => {
                const f = s.files[name];
                if (f && f.hash === hashes[name]) Object.assign(f, { from: built[name].from, to: built[name].to });
            });

            const toWrite = _cdPlan(s.files, hashes);
            const errors = [];
            if (toWrite.length) {
                const stamp = _blIsoWithTz(new Date(), COACH_DRIVE_TZ);
                Object.keys(docs).forEach(name => {
                    const d = docs[name];
                    contents[name] = _cdLogHeader(stamp, d.from, d.to, d.records) + '\n\n' + d.body;
                });
                const res = await this._post({
                    action: 'coachWrite',
                    files: toWrite.map(name => ({
                        name, content: contents[name], id: (s.files[name] || {}).id || undefined,
                        doc: docs[name] ? true : undefined
                    }))
                });
                s.folderId = res.folderId || s.folderId;
                toWrite.forEach(name => {
                    const r = (res.results || []).find(x => x.name === name);
                    if (!r || !r.ok) { errors.push(name + ': ' + ((r && r.error) || 'אין תשובה')); return; }
                    if (docs[name]) {
                        const d = docs[name];
                        s.files[name] = {
                            id: r.id, hash: hashes[name], chars: contents[name].length, records: d.records,
                            from: d.from, to: d.to, window_days: d.window_days, last_written: stamp, format: 'google_doc_text'
                        };
                        return;
                    }
                    s.files[name] = {
                        id: r.id, hash: hashes[name], bytes: new TextEncoder().encode(contents[name]).length,
                        records: built[name].records.length, from: built[name].from, to: built[name].to,
                        window_days: built[name].window_days, last_written: stamp
                    };
                });
            }
            if (errors.length) throw new Error('קבצים שנכשלו — ' + errors.join(' · '));

            // readme אחרון, ורק אחרי שכל השאר הצליחו. נכתב כשנכתב קובץ נתונים, או כשהתוכן
            // שלו (בלי generated) השתנה — למשל החלון זז ליום חדש, או כתיבה קודמת שלו נכשלה.
            const body = _cdReadmeBody(s.files, window._gymproVersion || '',
                _NUTRI_EXPORT_README.concat(_UNIFIED_README_EXTRA));
            const rHash = await this._sha256(JSON.stringify(body));
            const prevR = s.files[COACH_DRIVE_README];
            const writeReadme = toWrite.length > 0 || !prevR || !prevR.id || prevR.hash !== rHash;
            if (writeReadme) {
                const generated = _blIsoWithTz(new Date(), COACH_DRIVE_TZ);
                const content = JSON.stringify(Object.assign({ generated }, body));
                const res = await this._post({
                    action: 'coachWrite',
                    files: [{ name: COACH_DRIVE_README, content, id: (prevR || {}).id || undefined }]
                });
                const r = (res.results || [])[0];
                if (!r || !r.ok) throw new Error(COACH_DRIVE_README + ': ' + ((r && r.error) || 'אין תשובה'));
                s.files[COACH_DRIVE_README] = {
                    id: r.id, hash: rHash, bytes: new TextEncoder().encode(content).length, last_written: generated
                };
            }

            s.lastSuccess = Date.now();
            s.lastError = null;
            s.lastWritten = toWrite.concat(writeReadme ? [COACH_DRIVE_README] : []);
            this._saveState(s);
            return true;
        } catch (e) {
            s.lastError = this._describe(e);
            this._saveState(s);
            console.warn('GymPro: coach drive sync failed', e);
            return false;
        }
    }
};

// ─── הגדרות ─────────────────────────────────────────────────────────────────
function _cdFmtTime(ms) {
    const d = new Date(ms);
    return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function _cdRefreshSettings() {
    const tg = document.getElementById('coach-drive-toggle');
    if (tg) tg.checked = CoachDrive.isOn();
    const el = document.getElementById('coach-drive-status');
    if (!el) return;
    const s = CoachDrive.getState();
    const bits = [];
    if (CoachDrive._busy) bits.push('<span style="color:var(--text-dim);">מסנכרן…</span>');
    bits.push('<span style="color:var(--text-dim);">סנכרון אחרון: ' + (s.lastSuccess ? _cdFmtTime(s.lastSuccess) : 'טרם') + '</span>');
    if (s.lastError) {
        const err = String(s.lastError).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
        bits.push('<span style="color:var(--danger);">שגיאה אחרונה (' + _cdFmtTime(s.lastAttempt) + '): ' + err + '</span>');
    }
    el.innerHTML = bits.join('<br>');
}

function toggleCoachDrive() {
    const tg = document.getElementById('coach-drive-toggle');
    const on = !!(tg && tg.checked);
    CoachDrive.setOn(on);
    _cdRefreshSettings();
    if (on) CoachDrive.sync({ manual: true });
}

async function syncCoachDriveNow() {
    if (!StorageManager.getPhotoBridge().url) {
        showAlert('קודם הגדר URL ו-token בגשר התמונות ("תמונות התקדמות").'); return;
    }
    const p = CoachDrive.sync({ manual: true });
    _cdRefreshSettings();
    const ok = await p;
    if (ok) {
        const s = CoachDrive.getState();
        const n = (s.lastWritten || []).length;
        showAlert(n ? `נתוני המאמן סונכרנו לדרייב · ${n} קבצים עודכנו` : 'נתוני המאמן בדרייב עדכניים — אין שינויים');
    } else {
        showAlert('סנכרון נתוני המאמן נכשל: ' + CoachDrive.getState().lastError);
    }
}

// ─── טריגרים: פתיחה + חזרה לפרונט ───────────────────────────────────────────
window.addEventListener('load', () => setTimeout(() => { try { CoachDrive.maybeSync(); } catch (e) {} }, 7000));
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { try { CoachDrive.maybeSync(); } catch (e) {} }
});
