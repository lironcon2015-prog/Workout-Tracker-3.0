/* ============================================================================
 * test/sleep-manual.test.js — שינה ידנית ללא שלבים (אריח "זמן שינה")
 * הרצה: node test/sleep-manual.test.js   (ללא תלויות, ללא build)
 *
 * התוספת נשמרת כ-manualAddMin ומתווספת בזמן הקריאה: זמן שינה, זמן במיטה ויעילות.
 * שינוי ידני משחרר את משך השינה והציון שנחרתו לאותו תאריך.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'bodylog-logic.js'), 'utf8');
const block = src.split('SLEEPMANUAL-START')[1]?.split('SLEEPMANUAL-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק SLEEPMANUAL לא נמצא ב-bodylog-logic.js'); process.exit(1); }
const { _sleepManualApply, _sleepManualApplyAll, _vitalLockForgetSleep } =
    new Function(block + '\nreturn { _sleepManualApply, _sleepManualApplyAll, _vitalLockForgetSleep };')();

let failed = 0;
function ok(cond, name) {
    console.log(`${cond ? '✓' : '✗'} ${name}`);
    if (!cond) failed++;
}

/* ── 16.10.2026: אפל 7:52, נקלט 6:37 (397), חזרה לישון 1:15 בלי שלבים ─────── */
const D = '2026-10-16';
const night = { date: D, asleepMin: 397, inBedMin: 478, awakeMin: 81, deepMin: 48, coreMin: 248, remMin: 101, efficiency: 0.83, hrv: 32 };
const plain = _sleepManualApply(night);
ok(plain === night, 'בלי תוספת — הלילה עובר כמו שהוא');

const n = Object.assign({}, night, { manualAddMin: 75 });
const a = _sleepManualApply(n);
ok(a.asleepMin === 472,           'זמן שינה 6:37 + 1:15 = 7:52');
ok(a.inBedMin === 553,            'זמן במיטה גדל באותה תוספת');
ok(a.efficiency === 0.85,         'היעילות מחושבת מחדש (472/553)');
ok(a.appleAsleepMin === 397,      'הערך שנקלט מאפל נשמר לצד הסך');
ok(a.manualAddMin === 75,         'התוספת נשארת מזוהה');
ok(a.deepMin === 48 && a.coreMin === 248 && a.remMin === 101, 'שלבי אפל אינם משתנים');
ok(n.asleepMin === 397 && n.appleAsleepMin === undefined,      'הקלט לא שונה (פונקציה טהורה)');

const noSleep = _sleepManualApply({ date: D, deepMin: 50, coreMin: 200, remMin: 90, manualAddMin: 30 });
ok(noSleep.asleepMin === 370,     'בלי asleepMin — הבסיס הוא סכום השלבים');
const onlyManual = _sleepManualApply({ date: D, hrv: 40, manualAddMin: 60 });
ok(onlyManual.asleepMin === 60 && onlyManual.efficiency === 1, 'לילה בלי שינה מאפל — התוספת לבדה, יעילות לא עולה על 100%');
ok(_sleepManualApply({ date: D, asleepMin: 400, manualAddMin: 0 }).asleepMin === 400, 'תוספת 0 — אין שינוי');
ok(_sleepManualApply({ date: D, asleepMin: 400, manualAddMin: -20 }).asleepMin === 400, 'תוספת שלילית — מתעלמים');
ok(_sleepManualApply(null) === null, 'null — לא קריסה');
ok(_sleepManualApplyAll([night, n])[1].asleepMin === 472 && _sleepManualApplyAll(null).length === 0, 'מערך — כל לילה בנפרד');

/* ── שחרור הקיבוע של התאריך ─────────────────────────────────────────────── */
const lock = [{ date: '2026-10-15', asleepMin: 420, rd: { score: 70 } },
              { date: D, hrv: 32, rhr: 51, asleepMin: 472, efficiency: 0.85, rd: { score: 40 } }];
const f = _vitalLockForgetSleep(lock, D);
const row = f.lock.find(r => r.date === D);
ok(f.changed === true,                                      'שינוי ידני משחרר את הקיבוע של התאריך');
ok(row.asleepMin === undefined && row.efficiency === undefined && row.rd === undefined, 'שינה, יעילות וציון שוחררו');
ok(row.hrv === 32 && row.rhr === 51,                        'שאר המדדים נשארים נעולים');
ok(f.lock[0] === lock[0],                                   'תאריך אחר לא נוגע');
ok(lock[1].asleepMin === 472,                               'הקלט לא שונה');
const f2 = _vitalLockForgetSleep(f.lock, D);
ok(f2.changed === false && f2.lock === f.lock,              'אין מה לשחרר — אין כתיבה');
ok(Object.values(row).every(v => v !== undefined),          'אין undefined בשורה (גבול Firestore)');

console.log(failed ? `\n${failed} נכשלו` : '\nהכול עבר');
process.exit(failed ? 1 : 0);
