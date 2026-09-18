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
    '\nreturn { _vitalLockMerge, _vitalLockOverlay, _vitalLockPrune, _vitalLockRow, _vitalLockRd,' +
    ' _vitalLockSetRd, _rdFreezeReady, RD_LOCK_KEYS, RD_LOCK_KEEP_DAYS, _validVital };')();
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
ok(_vitalLockOverlay({ date: D, hrv: 70 }, Object.assign({ rd: { score: 78 } }, r2)).rd === undefined,
   'ה-overlay אינו מדביק את הציון על הלילה — rd אינו מדד');
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
ok(api.RD_LOCK_KEEP_DAYS >= 30,
   'השמירה בפועל היא 30 יום ומעלה — השורה נושאת את הציון היומי וחייבת לשרוד את הלילה');
ok(_vitalLockPrune(many, D, api.RD_LOCK_KEEP_DAYS).length === 5,
   'בשמירה בפועל חמשת הימים נשמרים');
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

/* ── תנאי קיבוע הציון היומי ───────────────────────────────────────────────
 * "מתקבע ברגע שיש את כל המדדים". גיבוי: היום נסגר — אחרת יום בלי טמפ׳ עור
 * (אין שעון תואם, או פחות מ-14 לילות בסיס) לא היה נחרת לעולם.
 * ═════════════════════════════════════════════════════════════════════════*/
const { _rdFreezeReady, _vitalLockRd, _vitalLockSetRd } = api;
const full    = { score: 78, building: false, usedCount: 5, totalCount: 5 };
const partial = { score: 71, building: false, usedCount: 4, totalCount: 5 };

ok(_rdFreezeReady(full, D, D) === true,      'כל חמשת המדדים נכנסו — נחרת מיד, גם באמצע היום');
ok(_rdFreezeReady(partial, D, D) === false,  'מדד חסר והיום פתוח — לא נחרת, ממתינים לו');
ok(_rdFreezeReady(partial, '2026-09-17', D) === true,
   'מדד חסר אבל היום נסגר — נחרת עם מה שיש (גיבוי סוף-יום)');
ok(_rdFreezeReady({ score: null, building: true, have: 9, need: 14 }, D, D) === false,
   'baseline בבנייה — אין ציון, אין חריתה');
ok(_rdFreezeReady({ score: null, building: false }, '2026-09-01', D) === false,
   'אין ציון גם ביום שנסגר — לא נחרת, הניסיון חוזר');
ok(_rdFreezeReady(full, D, null) === true,   'בלי תאריך היום — used===total עדיין מכריע');
ok(_rdFreezeReady(partial, D, null) === false, 'בלי תאריך היום ובלי כל המדדים — לא נחרת');
ok(_rdFreezeReady(null, D, D) === false,     'בלי rd — false ולא קריסה');

/* ── הציון היומי נחרת פעם אחת, ולא נדרס גם אם ה-baseline זז ───────────────── */
const snapA = { v: 1, score: 78, band: 'מוכן', used: 5, total: 5, missing: [],
                drivers: [{ label: 'HRV', val: '85ms', base: '62ms', delta: '+23ms', dir: 'up' }],
                vitals: [{ label: 'HRV', val: '85ms', base: '62ms', delta: '+23ms', dir: 'up' }],
                date: D, sleepMin: 432 };
const snapB = Object.assign({}, snapA, { score: 65, band: 'בינוני' });

const w1 = _vitalLockSetRd(m2.lock, D, snapA);
ok(w1.changed === true,                        'חריתת הציון היומי מסומנת כשינוי');
ok(_vitalLockRd(w1.lock, D).score === 78,      'הציון נחרת על שורת התאריך');
ok(_vitalLockRow(w1.lock, D).hrv === 85,       'הוויטלים החרותים נשמרים לצד הציון');

const w2 = _vitalLockSetRd(w1.lock, D, snapB);
ok(w2.changed === false,                       'ציון שנחרת אינו נדרס');
ok(_vitalLockRd(w2.lock, D).score === 78,      'גם אחרי baseline חדש — 78, לא 65');
ok(w2.lock === w1.lock,                        'בלי שינוי מוחזר אותו מערך');
ok(_vitalLockRd([], D) === null && _vitalLockRd(w1.lock, '2026-09-19') === null,
   'תאריך בלי ציון חרות — null, כדי שייפול לחישוב');
ok(_vitalLockSetRd(w1.lock, D, null).changed === false, 'בלי snapshot — אין כתיבה');

// גבול Firestore על השורה המלאה (ויטלים + ציון)
const bad2 = [];
scan(w1.lock, 'vitalLock', bad2);
ok(bad2.length === 0, 'השורה המלאה עוברת את Firestore' + (bad2.length ? ' — ' + bad2.join(', ') : ''));

/* ── רשומת אימון נחרתת כשהיום נחרת, ולא לפני ─────────────────────────────── */
const wc = fs.readFileSync(path.join(__dirname, '..', 'workout-core.js'), 'utf8');
ok(/if \(day\.frozen\) _readinessFreezeInto/.test(wc),
   'רשומת האימון נחרתת רק כש-day.frozen (ולא לפי "היום נסגר")');
ok(/return \(found && found\.frozen\) \? _readinessSnapshot/.test(wc),
   '_readinessAtSave חורת בשמירה רק אם הציון היומי כבר נחרת');
ok(!/_rdDayClosed/.test(wc), '_rdDayClosed הוסרה — התנאי עבר ל-_rdFreezeReady');

console.log(failed ? `\n${failed} נכשלו` : '\nכל הבדיקות עברו');
process.exit(failed ? 1 : 0);
