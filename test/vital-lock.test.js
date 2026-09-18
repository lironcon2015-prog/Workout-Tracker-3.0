/* ============================================================================
 * test/vital-lock.test.js — קיבוע ויטלי הבוקר
 * הרצה: node test/vital-lock.test.js   (ללא תלויות, ללא build)
 *
 * הרקע: ציון המוכנות זז במהלך היום. אפל מזקקת "דופק במנוחה" ככל שמצטברים
 * נתוני מנוחה, ולכן חישוב חי של אותו יום החזיר מספר אחר בכל רינדור — ובאותו
 * יום גם רצועה אחרת (78 "מוכן" בבוקר מול 65 "בינוני" בערב, שני צדי הסף 66).
 *
 * הדרישה: כל מדד מתקבע בקריאה הראשונה התקינה שלו לאותו יום. מדד שחסר בבוקר
 * מחכה ומתקבע כשהוא מגיע לראשונה.
 *
 * הבדיקה נכשלת על הקוד הישן: שם אין בלוק VITALLOCK כלל.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'bodylog-logic.js'), 'utf8');
const block = src.split('VITALLOCK-START')[1]?.split('VITALLOCK-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק VITALLOCK לא נמצא ב-bodylog-logic.js'); process.exit(1); }

// _validVital + _VITAL_RANGE נטענים מהמקור — אותו סינון תקינות בדיוק, בלי העתקה
const rangeSrc = src.match(/const _VITAL_RANGE = \{[\s\S]*?\n\};/);
const validSrc = src.match(/function _validVital\(key, v\) \{[\s\S]*?\n\}/);
if (!rangeSrc || !validSrc) { console.error('✗ _VITAL_RANGE/_validVital לא נמצאו'); process.exit(1); }

const api = new Function(rangeSrc[0] + '\n' + validSrc[0] + '\n' + block +
    '\nreturn { _vitalLockMerge, _vitalLockOverlay, _vitalLockPrune, _vitalLockRow, RD_LOCK_KEYS, RD_LOCK_KEEP_DAYS, _validVital };')();
const { _vitalLockMerge, _vitalLockOverlay, _vitalLockPrune, _vitalLockRow, RD_LOCK_KEYS } = api;

let failed = 0;
function ok(cond, name) {
    console.log(`${cond ? '✓' : '✗'} ${name}`);
    if (!cond) failed++;
}

const D = '2026-09-18';

/* ── חריתה ראשונה: מה שתקין נחרת, מה שחסר נשאר pending ───────────────────── */
// בוקר 07:10 — HRV, שינה ויעילות הגיעו; דופק מנוחה ונשימה טרם נכתבו באפל.
const morning = { date: D, hrv: 85, rhr: null, respRate: 0, asleepMin: 432, efficiency: 0.93 };
const m1 = _vitalLockMerge([], D, morning);

ok(m1.changed === true,                          'חריתה ראשונה מסומנת כשינוי');
const r1 = _vitalLockRow(m1.lock, D);
ok(r1.hrv === 85 && r1.asleepMin === 432 && r1.efficiency === 0.93, 'מדדים תקינים נחרתו');
ok(r1.rhr === undefined,                         'דופק מנוחה חסר — לא נחרת');
ok(r1.respRate === undefined,                    'נשימה 0 (לא נמשכה) — לא נחרת, אפס אינו מדידה');
ok(r1.wristTempDev === undefined,                'טמפ׳ שאינה במערך — לא נחרתת');
ok(r1.date === D,                                'השורה נושאת את התאריך');

/* ── מדד שנחרת אינו נדרס — זה כל התיקון ──────────────────────────────────── */
// ערב 21:40 — אפל זיקקה את הדופק ל-55, ואת ה-HRV ל-79. הקיבוע חוסם את שניהם.
const evening = { date: D, hrv: 79, rhr: 55, respRate: 14.2, asleepMin: 440, efficiency: 0.91 };
const m2 = _vitalLockMerge(m1.lock, D, evening);
const r2 = _vitalLockRow(m2.lock, D);

ok(m2.changed === true,      'הערב חורת את מה שטרם נחרת (דופק ונשימה)');
ok(r2.hrv === 85,            'HRV נשאר 85 — הקריאה של הבוקר, לא של הערב');
ok(r2.asleepMin === 432,     'משך השינה נשאר של הבוקר');
ok(r2.efficiency === 0.93,   'היעילות נשארת של הבוקר');
ok(r2.rhr === 55,            'דופק מנוחה שחסר בבוקר נחרת עכשיו — הפעם הראשונה שהתקבל');
ok(r2.respRate === 14.2,     'נשימה שחסרה בבוקר נחרתת עכשיו');

/* ── מרגע שהכול נחרת, שליפה נוספת אינה משנה דבר (היציבות עצמה) ───────────── */
const later = { date: D, hrv: 70, rhr: 58, respRate: 15.9, asleepMin: 401, efficiency: 0.80 };
const m3 = _vitalLockMerge(m2.lock, D, later);
ok(m3.changed === false,                                   'אין מה לחרות — אין כתיבה מיותרת');
ok(JSON.stringify(m3.lock) === JSON.stringify(m2.lock),    'הקיבוע זהה — הציון לא יזוז שוב');
ok(m3.lock === m2.lock,                                    'בלי שינוי מוחזר אותו מערך (אין העתקה מיותרת)');

/* ── overlay: הלילה כפי שהמוכנות רואה אותו ───────────────────────────────── */
const seen = _vitalLockOverlay(later, r2);
ok(seen.hrv === 85 && seen.rhr === 55 && seen.asleepMin === 432,
   'ה-overlay מחזיר את הערכים החרוטים, לא את הטריים');
ok(seen.deepMin === undefined && later.hrv === 70,
   'ה-overlay אינו משנה את הקלט (SLEEP_DAILY נשאר טרי)');
ok(_vitalLockOverlay(later, null) === later, 'בלי שורת קיבוע — הלילה עובר כמו שהוא');
ok(_vitalLockOverlay(null, r2) === null,     'בלי לילה — null ולא קריסה');
// שדה שאינו מדד מוכנות אינו מקובע: שלבי השינה ממשיכים להתעדכן מאפל
const stages = _vitalLockOverlay({ date: D, hrv: 70, deepMin: 61, remMin: 98 }, r2);
ok(stages.deepMin === 61 && stages.remMin === 98, 'שלבי שינה אינם מקובעים — הם לא רכיב בציון');
ok(RD_LOCK_KEYS.length === 6 && RD_LOCK_KEYS.indexOf('wristTempDev') >= 0,
   'ששת מדדי הציון בדיוק מקובעים');

/* ── גבול Firestore: אין undefined ואין מערך בתוך מערך ───────────────────── */
function scan(v, trail, bad) {
    if (v === undefined) { bad.push(trail + ' = undefined'); return; }
    if (Array.isArray(v)) {
        v.forEach((x, i) => {
            if (Array.isArray(x)) bad.push(trail + '[' + i + '] = מערך בתוך מערך');
            scan(x, trail + '[' + i + ']', bad);
        });
        return;
    }
    if (v && typeof v === 'object') Object.keys(v).forEach(k => scan(v[k], trail + '.' + k, bad));
}
const bad = [];
scan(m2.lock, 'vitalLock', bad);
ok(bad.length === 0, 'הקיבוע עובר את Firestore' + (bad.length ? ' — ' + bad.join(', ') : ''));

/* ── גיזום: רק הימים שעוד נחוצים, בהשוואת ISO ────────────────────────────── */
const many = [
    { date: '2026-09-10', hrv: 1 }, { date: '2026-09-15', hrv: 2 },
    { date: '2026-09-16', hrv: 3 }, { date: '2026-09-17', hrv: 4 },
    { date: '2026-09-18', hrv: 5 }
];
const pruned = _vitalLockPrune(many, D, 3);
ok(pruned.length === 3 && pruned[0].date === '2026-09-16', 'נשמרים 3 הימים האחרונים בלבד');
ok(pruned.every(r => r.date >= '2026-09-16'), 'הגיזום לפי תאריך ISO, לא לפי מקום במערך');
// חודש קודם — הגיזום חייב לחצות את גבול החודש נכון (01–20 הוא בדיוק המקום
// שבו השוואת תאריכים שבורה הפילה פיצ'רים בעבר)
const cross = _vitalLockPrune(
    [{ date: '2026-08-30', hrv: 1 }, { date: '2026-08-31', hrv: 2 }, { date: '2026-09-01', hrv: 3 }],
    '2026-09-01', 3);
ok(cross.length === 3, 'גיזום שחוצה גבול חודש שומר את שלושת הימים');
ok(_vitalLockPrune([{ date: '2026-09-01', hrv: 1 }], '2026-09-05', 3).length === 0,
   'יום שיצא מהחלון נגזם');
ok(_vitalLockPrune(null, D, 3).length === 0, 'קלט לא-מערך — מערך ריק ולא קריסה');

/* ── שני תאריכים במקביל: כל יום עומד בזכות עצמו ──────────────────────────── */
const two = _vitalLockMerge(m2.lock, '2026-09-19', { date: '2026-09-19', hrv: 91, rhr: 49 });
ok(two.lock.length === 2, 'יום חדש מוסיף שורה ואינו דורס את הקודמת');
ok(_vitalLockRow(two.lock, D).hrv === 85, 'היום הקודם נשאר עם קריאת הבוקר שלו');
ok(_vitalLockRow(two.lock, '2026-09-19').hrv === 91, 'היום החדש נחרת בנפרד');
ok(two.lock[0].date < two.lock[1].date, 'המערך נשמר ממוין כרונולוגית');

/* ── חריתת רשומת האימון נדחית ליום שנסגר ─────────────────────────────────── */
const wc = fs.readFileSync(path.join(__dirname, '..', 'workout-core.js'), 'utf8');
const closed = wc.match(/function _rdDayClosed\(dstr\) \{[\s\S]*?\n\}/);
if (!closed) { console.error('✗ _rdDayClosed לא נמצאה ב-workout-core.js'); process.exit(1); }
const _rdDayClosed = new Function('StorageManager',
    closed[0] + '\nreturn _rdDayClosed;')({ _todayStr: () => D });
ok(_rdDayClosed(D) === false,            'אימון של היום — לא נחרת (הקיבוע עדיין פתוח)');
ok(_rdDayClosed('2026-09-17') === true,  'אימון של אתמול — נחרת');
ok(_rdDayClosed('2026-09-19') === false, 'תאריך עתידי — לא נחרת');
ok(_rdDayClosed(null) === false,         'בלי תאריך — לא נחרת');

console.log(failed ? `\n${failed} נכשלו` : '\nכל הבדיקות עברו');
process.exit(failed ? 1 : 0);
