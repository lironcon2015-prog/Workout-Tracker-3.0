/* ============================================================================
 * test/coach-drive.test.js — סנכרון נתוני המאמן לדרייב
 * הרצה: node test/coach-drive.test.js   (ללא תלויות, ללא build)
 *
 * שני חלקים:
 *  1. הבלוק הטהור COACHDRIVE מ-coach-drive-logic.js — חלונות, partial, הסרת summary
 *     בלי לאבד הערות, פיצול עקומת הדופק.
 *  2. הסנכרון המלא: הגשר האמיתי (docs/photo-bridge.gs) על DriveApp מדומה בזיכרון,
 *     והמודול האמיתי עם הבונה האמיתי של הייצוא המאוחד (bodylog-logic.js).
 *     בודק 8 קבצים בלי כפילויות, סנכרון חוזר בלי כתיבות, ששינוי שקילה כותב
 *     רק את weights + readme, ושהרשומות זהות לייצוא המאוחד.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let failed = 0;
function ok(cond, name) { if (!cond) failed++; console.log(`${cond ? '✓' : '✗'} ${name}`); }
// השוואה בלי תלות בסדר המפתחות
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x)
    ? Object.keys(x).sort().reduce((o, key) => (o[key] = x[key], o), {}) : x);
function eq(a, b, name) {
    const same = canon(a) === canon(b);
    if (!same) failed++;
    console.log(`${same ? '✓' : '✗'} ${name}${same ? '' : `\n    צפוי:  ${JSON.stringify(b)}\n    התקבל: ${JSON.stringify(a)}`}`);
}

// ─── חלק 1: הבלוק הטהור ─────────────────────────────────────────────────────
const cdSrc = read('coach-drive-logic.js');
const block = cdSrc.split('COACHDRIVE-START')[1]?.split('COACHDRIVE-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק COACHDRIVE לא נמצא ב-coach-drive-logic.js'); process.exit(1); }
const P = new Function(block + '\nreturn { COACH_DRIVE_WINDOWS, _cdIsraelDate, _cdShiftDate, _cdWindow, _cdOrphanNotes, _cdSplitWorkout, _cdBuildFiles, _cdPlan };')();

eq(P._cdWindow(90, '2026-09-26'), { from: '2026-06-29', to: '2026-09-26' }, 'חלון 90 יום כולל את היום: 89 ימים אחורה');
eq(P._cdWindow(null, '2026-09-26'), { from: null, to: null }, 'memory_box — בלי חלון');
eq(P._cdShiftDate('2026-03-01', -1), '2026-02-28', 'הזזת תאריך חוצה חודש');
eq(P._cdIsraelDate(Date.parse('2026-09-25T22:30:00Z')), '2026-09-26', 'היום לפי שעון ישראל (01:30 בלילה), לא לפי UTC');
eq(P._cdIsraelDate(Date.parse('2026-01-15T21:59:00Z')), '2026-01-15', 'חורף: 23:59 בישראל עדיין אותו יום');

const strength = {
    timestamp: 1, date: '2026-09-20', note: 'כללית', summary:
        'GYMPRO ELITE SUMMARY\nהערה: כללית\n\nלחיצה (Vol: 1t):\nהערת תרגיל: כתף\n80kg x 5 (RIR 2) | Note: קל',
    details: { 'לחיצה': { sets: ['80x5'], vol: 400, note: 'כתף' } },
    log: [{ exName: 'לחיצה', w: 80, r: 5, note: 'קל' }]
};
ok(!('summary' in P._cdSplitWorkout(strength).workout), 'summary מושמט כשכל ההערות קיימות בנתונים המובנים');
ok(P._cdSplitWorkout(strength).workout.log === strength.log, 'הלוג המובנה נשמר');
const orphan = Object.assign({}, strength, { log: [{ exName: 'לחיצה', w: 80, r: 5, note: '' }] });
eq(P._cdOrphanNotes(orphan), ['קל'], 'הערת סט שקיימת רק ב-summary מזוהה');
ok('summary' in P._cdSplitWorkout(orphan).workout, 'הערה יתומה → summary נשמר, לא הולך לאיבוד');
const legacy = { timestamp: 2, date: '2026-09-20', summary: 'אימון ישן', details: {}, log: [] };
ok('summary' in P._cdSplitWorkout(legacy).workout, 'רשומה ישנה בלי לוג מובנה שומרת summary');
const cardio = { timestamp: 3, date: '2026-09-20', kind: 'cardio', note: 'ריצה', summary: 'x\nהערה: ריצה', details: {}, log: [] };
ok(!('summary' in P._cdSplitWorkout(cardio).workout), 'אירובי: summary מושמט (הנתונים ב-cardio)');

const withWatch = Object.assign({}, strength, { watch: { hrAvg: 120, hrMax: 160, activeKcal: 300, zoneSec: [1, 2, 3, 4, 5],
    hrRecovery1: 22, zoneBounds: [100, 120], hrSeries: [[0, 90, 95, 100]], start: 10, end: 20 } });
const sp = P._cdSplitWorkout(withWatch);
eq(sp.workout.watch, { hrAvg: 120, hrMax: 160, activeKcal: 300, zoneSec: [1, 2, 3, 4, 5] }, 'watch באימון: ממוצע, מקסימום, קלוריות, אזורים');
eq(sp.series, { timestamp: 1, date: '2026-09-20', hrRecovery1: 22, zoneBounds: [100, 120], hrSeries: [[0, 90, 95, 100]], start: 10, end: 20 },
   'שאר שדות השעון עוברים לרשומת watch_hr_series, מקושרת לפי timestamp');
ok(withWatch.watch.hrSeries, 'הרשומה המקורית לא שונתה');

const built = P._cdBuildFiles({
    weights: [{ date: '2026-06-28', w: 80 }, { date: '2026-06-29', w: 81 }],
    nutritionDaily: [{ date: '2026-09-25', calories: 1 }, { date: '2026-09-26', calories: 2 }],
    sleepRecovery: [], nutritionDetailed: [{ date: '2026-08-27' }, { date: '2026-08-28' }],
    workouts: [Object.assign({}, withWatch, { date: '2026-08-02' }), Object.assign({}, withWatch, { timestamp: 8, date: '2026-08-01' }), Object.assign({}, withWatch, { timestamp: 9, date: '2026-08-30' })],
    memoryBox: [{ text: 'כלל' }]
}, '2026-09-26');
eq(built['weights.json'].records.map(r => r.date), ['2026-06-29'], 'weights: רשומה מחוץ ל-90 יום יוצאת');
eq(built['nutrition_daily.json'].records.map(r => r.partial), [undefined, true], 'nutrition_daily: רק היום מסומן partial');
eq(built['nutrition_detailed.json'].records.map(r => r.date), ['2026-08-28'], 'nutrition_detailed: חלון 30 יום');
eq(built['workouts.json'].records.length, 2, 'workouts: חלון 56 יום (יום 57 יוצא)');
eq(built['watch_hr_series.json'].records.map(r => r.timestamp), [9], 'watch_hr_series: חלון 30 יום');
eq(Object.keys(built).length, 7, '7 קבצי נתונים (+ readme = 8)');
eq(P._cdPlan({ 'a.json': { id: 'x', hash: 'h' }, 'b.json': { id: 'y', hash: 'h' } }, { 'a.json': 'h', 'b.json': 'h2', 'c.json': 'h' }),
   ['b.json', 'c.json'], 'plan: רק קבצים שהשתנו או שעוד לא נוצרו');

// ─── חלק 2: סנכרון מלא מול הגשר האמיתי ────────────────────────────────────
function iter(arr) { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; }
const drive = { files: [], folders: [], writes: [], seq: 0 };
const DOC_MIME = 'application/vnd.google-apps.document';
function mkFile(name, content, parent, mime) {
    const f = {
        id: 'f' + (++drive.seq), name, content, trashed: false, parent, mime: mime || 'application/json',
        moveTo(folder) { this.parent = folder.getId(); },
        getId() { return this.id; }, getName() { return this.name; }, isTrashed() { return this.trashed; },
        setTrashed(t) { this.trashed = t; }, getParents() { return iter(drive.folders.filter(d => d.id === this.parent)); },
        setContent(c) { this.content = c; drive.writes.push(this.name); return this; },
        getSize() { return Buffer.byteLength(this.content, 'utf8'); }, getMimeType() { return this.mime; }
    };
    drive.files.push(f); drive.writes.push(name);
    return f;
}
function mkFolder(name) {
    const d = {
        id: 'd' + (++drive.seq), name, trashed: false,
        getId() { return this.id; }, isTrashed() { return this.trashed; },
        getFilesByName(n) { return iter(drive.files.filter(f => f.parent === this.id && f.name === n)); },
        getFoldersByName(n) { return iter(drive.folders.filter(x => x.name === n)); },
        createFile(blob) { return mkFile(blob.name, blob.content, this.id); },
        getFiles() { return iter(drive.files.filter(f => f.parent === this.id)); }
    };
    drive.folders.push(d);
    return d;
}
const byId = (list, id) => { const x = list.find(o => o.id === id); if (!x) throw new Error('not found'); return x; };
const props = {};
const gasSandbox = {
    DriveApp: {
        getRootFolder: () => ({ getFoldersByName: n => iter(drive.folders.filter(x => x.name === n)) }),
        getFoldersByName: n => iter(drive.folders.filter(x => x.name === n)),
        createFolder: mkFolder,
        getFolderById: id => byId(drive.folders, id),
        getFileById: id => byId(drive.files, id)
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: { newBlob: (content, mime, name) => ({ content, mime, name }) },
    ContentService: { createTextOutput: text => ({ text, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    MimeType: { GOOGLE_DOCS: DOC_MIME },
    Logger: { log() {} },
    // Google Doc: נוצר בשורש (כמו DocumentApp.create), setText מעדכן את אותו קובץ במקום
    DocumentApp: {
        create(name) { const f = mkFile(name, '', 'root', DOC_MIME); drive.writes.pop(); return docOf(f); },
        openById(id) { return docOf(byId(drive.files, id)); }
    }
};
function docOf(f) {
    return { getId: () => f.id, saveAndClose() {},
             getBody: () => ({ setText(t) { f.content = t; drive.writes.push(f.name); } }) };
}
const bridgeSrc = read('docs/photo-bridge.gs');
const bridge = new Function(...Object.keys(gasSandbox), bridgeSrc + '\nreturn { doPost };')(...Object.values(gasSandbox));

const ls = {};
const noop = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : noop, apply: () => noop });
const DAY = 86400000;
const now = Date.now();
const isoDay = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(ms));
const data = {
    bodyLog: [], nutritionDaily: [], sleep: [], archive: [], foodLog: {},
    memory: [{ id: 'm1', text: 'לא לרדת מתחת ל-2 RIR בלחיצה' }]
};
for (let i = 0; i < 120; i++) {
    const d = isoDay(now - i * DAY);
    data.bodyLog.push({ date: d, weight: 80 + (i % 7) / 10, fat: 15 });
    data.nutritionDaily.push({ date: d, calories: 2200 + i, protein: 160, carbs: 220, fat: 70, src: 'app' });
    data.sleep.push({ date: d, sleepMin: 420, hrv: 55, rhr: 52, resp: 14, temp: 0.1 });
    if (i < 40) data.foodLog[d] = [{ meal: 'בוקר', name: 'יוגורט', brand: 'x', qty: 200, kcal: 150, p: 20, c: 10, f: 3 }];
    if (i % 2 === 0 && i < 100) {
        const ts = now - i * DAY - 3600000;
        data.archive.push({
            timestamp: ts, date: '01.01.26', time: '10:00', type: 'A', week: 1, duration: 60, note: 'אימון טוב',
            summary: 'GYMPRO ELITE SUMMARY\nהערה: אימון טוב\n\nלחיצה (Vol: 2t):\n100kg x 5 (RIR 2) | Note: קל\n\n=== סיכום המאמן ===\nטקסט מאמן',
            details: { 'לחיצה': { sets: ['100x5'], vol: 500 } }, exOrder: ['לחיצה'],
            log: [{ exName: 'לחיצה', w: 100, r: 5, rir: 2, note: 'קל', isCluster: false, round: null, skip: false }],
            rmValues: {}, nutritionalState: 'maintenance', aiSummary: 'long ai text',
            watch: { srcId: 'w' + i, start: ts, end: ts + 3600000, durMin: 60, hrAvg: 120, hrMax: 165, activeKcal: 400,
                     hrRecovery1: 25, linkedBy: 'auto', zoneSec: [60, 600, 1200, 900, 300], zoneBounds: [100, 120, 140, 160],
                     hrSeries: Array.from({ length: 120 }, (_, k) => [k * 30, 100, 120, 140]) }
        });
    }
}
data.archive.sort((a, b) => b.timestamp - a.timestamp);

let fetchCount = 0;
const ctx = {
    console: { log() {}, warn() {}, error() {} }, document: noop, Intl, Date, Math, JSON, Object, Array, Set, Promise,
    TextEncoder, crypto: globalThis.crypto, setTimeout, clearTimeout, AbortController,
    localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); } },
    window: { addEventListener() {}, _gymproVersion: '19.16.0' },
    showAlert() {},
    fetch: async (url, opt) => {
        fetchCount++;
        const out = bridge.doPost({ postData: { contents: opt.body }, parameter: {} });
        return { status: 200, text: async () => out.text };
    },
    StorageManager: {
        getBodyLog: () => data.bodyLog, getNutritionDaily: () => data.nutritionDaily, getSleepDaily: () => data.sleep,
        getArchive: () => data.archive, getMemoryBox: () => data.memory, getFoodLog: () => data.foodLog,
        getNutritionRaw: () => null, getPhotoBridge: () => ({ on: false, url: 'https://bridge', token: 'tok' }),
        _bridgeJson: r => r.text().then(t => JSON.parse(t))
    }
};
vm.createContext(ctx);
vm.runInContext(read('bodylog-logic.js'), ctx);
// _stripCoachFromSummary מתוך archive-logic.js עצמו — אותו ניקוי שהייצוא המאוחד מריץ
vm.runInContext(read('archive-logic.js').match(/function _stripCoachFromSummary[\s\S]*?\n}\n/)[0], ctx);
// טקסט ייצוא הסיכום — _archiveCopyText מ-archive-logic.js ובלוק METRICSTEXT מ-workout-core.js, כמו באפליקציה
vm.runInContext(read('archive-logic.js').match(/function _archiveCopyText[\s\S]*?\n}\n/)[0], ctx);
Object.assign(ctx, {
    _fmtClock: sec => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.round(sec % 60)).padStart(2, '0')}`,
    _readinessFor: () => null, _contextRows: () => [], _slFmtDur: m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
});
vm.runInContext(read('workout-core.js').split('METRICSTEXT-START')[1].split('METRICSTEXT-END')[0].replace(/^[^\n]*\n/, ''), ctx);
vm.runInContext(cdSrc + '\nthis.CoachDrive = CoachDrive; this._cdIsraelDate = _cdIsraelDate;', ctx);
ctx.CoachDrive.setOn(true);

const liveFiles = () => drive.files.filter(f => !f.trashed);
(async () => {
    // ה-token נקרא מ-Script properties, לא מהקובץ — כך הדבקת גרסה חדשה לא מאפסת אותו
    ok(!/CHANGE_ME/.test(bridgeSrc), 'אין token בקוד הגשר');
    const post = (tok, extra) => JSON.parse(bridge.doPost({ postData: { contents: JSON.stringify(Object.assign({ token: tok, action: 'coachCheck', ids: [] }, extra)) }, parameter: {} }).text);
    eq(post('tok').error, 'TOKEN_NOT_SET', 'אין SECRET_TOKEN ב-Script properties → TOKEN_NOT_SET (לא BAD_TOKEN)');
    ok(!(await ctx.CoachDrive.sync({})), 'סנכרון בלי token מוגדר נכשל');
    ok(/Script properties/.test(ctx.CoachDrive.getState().lastError), 'ההודעה מפנה ל-Script properties');
    props.SECRET_TOKEN = 'tok';
    eq(post('wrong').error, 'BAD_TOKEN', 'token שגוי → BAD_TOKEN');
    eq(post('tok').ok, true, 'token נכון מ-Script properties מתקבל');

    // 1. סנכרון ראשון
    ok(await ctx.CoachDrive.sync({}), 'סנכרון ראשון הצליח');
    const names = liveFiles().map(f => f.name).sort();
    eq(names, ['00_readme.json', 'memory_box.json', 'nutrition_daily.json', 'nutrition_detailed.json', 'sleep_recovery.json',
               'watch_hr_series.json', 'weights.json', 'workouts.json', 'workouts_log'], '9 קבצים בתיקייה, בלי כפילויות');
    const logFile = () => liveFiles().find(f => f.name === 'workouts_log');
    eq(logFile().getMimeType(), 'application/vnd.google-apps.document', 'workouts_log הוא Google Doc נייטיב');
    ok(logFile().parent === drive.folders[0].id, 'ה-Doc הועבר מהשורש לתיקייה');
    eq(drive.folders.map(d => d.name), ['GymPro Coach Data'], 'תיקייה אחת: GymPro Coach Data');
    ok(liveFiles().every(f => f.parent === drive.folders[0].id), 'כל הקבצים בתוך התיקייה');
    eq(drive.writes[drive.writes.length - 1], '00_readme.json', 'readme נכתב אחרון');
    console.log('   גדלים אחרי סנכרון ראשון (דאטה סינתטית):');
    liveFiles().forEach(f => console.log(`     ${f.name.padEnd(24)} ${f.mime === DOC_MIME ? f.content.length + ' תווים' : (f.getSize() / 1024).toFixed(1) + ' KB'}`));

    // יומן האימונים — תוכן
    const log = logFile().content;
    const wRecs = JSON.parse(liveFiles().find(f => f.name === 'workouts.json').content);
    const [head, ...rest] = log.split('\n\n');
    ok(/^generated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2} · from: \d{4}-\d{2}-\d{2} · to: \d{4}-\d{2}-\d{2} · workouts: \d+$/.test(head), 'כותרת: generated · from · to · workouts');
    const entries = log.slice(head.length + 2).split('\n\n----------\n\n');
    eq(entries.length, wRecs.length, 'מספר האימונים ב-Doc = records של workouts.json');
    ok(head.endsWith('workouts: ' + wRecs.length), 'המספר בכותרת תואם');
    const newest = data.archive.filter(a => wRecs.some(w => w.timestamp === a.timestamp)).sort((a, b) => b.timestamp - a.timestamp);
    eq(entries[0], ctx._archiveCopyText(newest[0], false), 'אימון ראשון = החדש, זהה לטקסט ייצוא הסיכום (בלי סיכום מאמן)');
    eq(entries[entries.length - 1], ctx._archiveCopyText(newest[newest.length - 1], false), 'אימון אחרון = הישן');
    ok(!/סיכום המאמן|טקסט מאמן/.test(log), 'אין סיכום מאמן ב-Doc');
    ok(/=== מדדי האימון ===/.test(entries[0]) && /\| Note: קל/.test(entries[0]) && /RIR 2/.test(entries[0]), 'נשמרו מדדי האימון, RIR והערות סט');

    // 2. סנכרון שני מיד — אף קובץ לא נכתב
    const w1 = drive.writes.length, f1 = fetchCount;
    ok(await ctx.CoachDrive.sync({}), 'סנכרון שני הצליח');
    eq(drive.writes.length - w1, 0, 'סנכרון שני: אף קובץ לא נכתב מחדש (hash זהה)');
    eq(fetchCount - f1, 0, 'סנכרון שני: אפילו לא קריאה לגשר');

    // 3. שינוי שקילה אחת — רק weights + readme
    const idsBefore = liveFiles().map(f => f.id).sort().join();
    data.bodyLog[3] = Object.assign({}, data.bodyLog[3], { weight: 79.1 });
    const w2 = drive.writes.length;
    ok(await ctx.CoachDrive.sync({}), 'סנכרון אחרי שינוי שקילה הצליח');
    eq(drive.writes.slice(w2), ['weights.json', '00_readme.json'], 'שינוי שקילה: נכתבו רק weights.json ו-00_readme.json');
    eq(liveFiles().map(f => f.id).sort().join(), idsBefore, 'המזהים בדרייב לא השתנו (עדכון במקום, לא קובץ חדש)');

    // שינוי באימון → ה-Doc מתעדכן במקום: אותו מזהה, עותק אחד
    const docId = liveFiles().find(f => f.name === 'workouts_log').id;
    data.archive[0] = Object.assign({}, data.archive[0], { summary: data.archive[0].summary.replace('100kg x 5', '105kg x 5') });
    const wd = drive.writes.length;
    ok(await ctx.CoachDrive.sync({}), 'סנכרון אחרי שינוי אימון הצליח');
    eq(drive.writes.slice(wd).sort(), ['00_readme.json', 'workouts_log'], 'שינוי בטקסט אימון: נכתבו workouts_log ו-readme');
    eq(liveFiles().filter(f => f.name === 'workouts_log').map(f => f.id), [docId], 'ה-Doc עודכן במקום — אותו מזהה, בלי כפילות');
    ok(/105kg x 5/.test(liveFiles().find(f => f.name === 'workouts_log').content), 'התוכן החדש ב-Doc');

    // קובץ שנמחק ידנית — "סנכרן עכשיו" מחזיר אותו, בלי כפילויות
    liveFiles().find(f => f.name === 'weights.json').trashed = true;
    ok(await ctx.CoachDrive.sync({ manual: true }), 'סנכרון ידני אחרי מחיקה הצליח');
    eq(liveFiles().filter(f => f.name === 'weights.json').length, 1, 'weights.json נוצר מחדש, עותק אחד');

    // כשל בקובץ → readme לא נכתב, השגיאה נשמרת, והסנכרון הבא משלים
    const origSet = liveFiles().find(f => f.name === 'sleep_recovery.json');
    const realSet = origSet.setContent;
    origSet.setContent = () => { throw new Error('quota'); };
    data.sleep[0] = Object.assign({}, data.sleep[0], { hrv: 60 });
    data.bodyLog[4] = Object.assign({}, data.bodyLog[4], { weight: 78 });
    const w3 = drive.writes.length;
    ok(!(await ctx.CoachDrive.sync({ manual: true })), 'כשל בקובץ מדווח ככשל');
    ok(!drive.writes.slice(w3).includes('00_readme.json'), 'כשל בקובץ: readme לא עודכן');
    ok(/sleep_recovery\.json/.test(ctx.CoachDrive.getState().lastError), 'השגיאה נשמרת עם שם הקובץ והסיבה');
    origSet.setContent = realSet;
    const w4 = drive.writes.length;
    ok(await ctx.CoachDrive.sync({ manual: true }), 'הסנכרון הבא הצליח');
    eq(drive.writes.slice(w4), ['sleep_recovery.json', '00_readme.json'], 'הסנכרון הבא: הקובץ שנכשל ואז readme');

    // readme — מבנה
    const readme = JSON.parse(liveFiles().find(f => f.name === '00_readme.json').content);
    ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(readme.generated), 'generated: ISO עם היסט מקומי');
    eq(readme.app_version, '19.16.0', 'app_version');
    eq(readme.note, 'הנתונים ב-Drive עדכניים מהקובץ המאוחד האחרון. בחפיפה, Drive גובר.', 'note');
    const lf = readme.files['workouts_log'];
    ok(lf && lf.window_days === 56 && lf.from && lf.to && lf.records > 0 && lf.chars === logFile().content.length &&
       lf.last_written && lf.format === 'google_doc_text' && !('bytes' in lf), 'readme: workouts_log עם chars (לא bytes) ו-format');
    ok(readme.readme.some(l => l.startsWith('workouts_log = אותם אימונים כמו workouts.json')), 'readme: שורת תיאור ל-workouts_log');
    const wf = readme.files['workouts.json'];
    ok(wf.window_days === 56 && wf.from && wf.to && wf.records > 0 && wf.bytes > 0 && wf.last_written, 'לכל קובץ: window_days, from, to, records, bytes, last_written');
    eq(readme.files['weights.json'].bytes, liveFiles().find(f => f.name === 'weights.json').getSize(), 'bytes תואם לגודל בדרייב');

    // 5. השוואה לייצוא המאוחד — אותו בונה, אותם שדות (חוץ מהחריגים של workouts)
    const uni = ctx._buildUnifiedSections({ from: null, to: null });
    const file = n => JSON.parse(liveFiles().find(f => f.name === n).content);
    const today = ctx._cdIsraelDate(Date.now());
    const pick = (arr, date) => JSON.parse(JSON.stringify(arr.find(r => r.date === date)));
    eq(pick(file('weights.json'), data.bodyLog[5].date), pick(uni.weights, data.bodyLog[5].date), 'weights: רשומה זהה לייצוא המאוחד');
    eq(pick(file('sleep_recovery.json'), data.sleep[5].date), pick(uni.sleepRecovery, data.sleep[5].date), 'sleep_recovery: זהה');
    eq(pick(file('nutrition_detailed.json'), today), pick(uni.nutritionDetailed, today), 'nutrition_detailed: זהה');
    eq(Object.assign(pick(uni.nutritionDaily, today), { partial: true }), pick(file('nutrition_daily.json'), today), 'nutrition_daily: זהה + partial ביום הנוכחי');
    eq(pick(file('nutrition_daily.json'), data.nutritionDaily[3].date), pick(uni.nutritionDaily, data.nutritionDaily[3].date), 'nutrition_daily: יום קודם בלי partial');
    eq(file('memory_box.json'), JSON.parse(JSON.stringify(uni.memoryBox)), 'memory_box: מלא וזהה');
    const uw = JSON.parse(JSON.stringify(uni.workouts[uni.workouts.length - 1]));
    const dw = file('workouts.json').find(w => w.timestamp === uw.timestamp);
    const series = file('watch_hr_series.json').find(s => s.timestamp === uw.timestamp);
    ok(!('summary' in dw) && !('aiSummary' in dw), 'workouts: בלי summary ובלי aiSummary');
    eq(Object.keys(dw.watch).sort(), ['activeKcal', 'hrAvg', 'hrMax', 'zoneSec'], 'workouts.watch: ארבעת השדות בלבד');
    const { summary, watch, ...uRest } = uw;
    const { watch: dWatch, ...dRest } = dw;
    eq(dRest, uRest, 'workouts: כל שאר השדות זהים לייצוא המאוחד');
    eq(Object.assign({}, dWatch, (({ timestamp, date, ...r }) => r)(series)), watch, 'watch + watch_hr_series = ה-watch המלא של הייצוא המאוחד');

    console.log(failed ? `\n✗ ${failed} בדיקות נכשלו` : '\n✓ כל הבדיקות עברו');
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error('✗ חריגה:', e); process.exit(1); });
