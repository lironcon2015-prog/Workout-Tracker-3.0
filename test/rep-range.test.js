/* ============================================================================
 * test/rep-range.test.js — טווח חזרות בתוכנית
 * הרצה: node test/rep-range.test.js   (ללא תלויות, ללא build)
 *
 * באג: רשימת "תרגילים מתוכננים" הציגה "3×?" — היא קראה חזרות ממאגר התרגילים,
 * בשדה שאין לו ממשק. עכשיו: טווח בפריט התוכנית, ברירת מחדל 8–12, Main בלי טווח.
 * בלוק REPRANGE ב-workout-core.js.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'workout-core.js'), 'utf8');
const block = src.split('REPRANGE-START')[1]?.split('REPRANGE-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק REPRANGE לא נמצא ב-workout-core.js'); process.exit(1); }
const { _repRangeOf, _repRangeLabel, _repDefaultFromRange } =
    new Function(block + '\nreturn { _repRangeOf, _repRangeLabel, _repDefaultFromRange };')();

let failed = 0;
function ok(cond, name) {
    console.log(`${cond ? '✓' : '✗'} ${name}`);
    if (!cond) failed++;
}

const belt = { name: 'BELT SQUAT', sets: 3 };
ok(_repRangeLabel(_repRangeOf(belt)) === '8–12',                        'בלי טווח — ברירת מחדל 8–12 (לא "?")');
ok(_repRangeOf(belt).src === 'default',                                  'מסומן כברירת מחדל');
ok(_repRangeLabel(_repRangeOf({ repMin: 6, repMax: 8 })) === '6–8',     'טווח מהתוכנית');
ok(_repRangeLabel(_repRangeOf({ repMin: 10, repMax: 10 })) === '10',    'טווח מדויק מוצג כמספר אחד');
ok(_repRangeLabel(_repRangeOf({ targetReps: 8 })) === '8',              'יעד יחיד ישן נשמר כמו שהוא');
ok(_repRangeOf({ repMin: 6, repMax: 8, targetReps: 10 }).min === 6,      'טווח גובר על יעד ישן');
ok(_repRangeOf({ isMain: true, repMin: 6, repMax: 8 }) === null,         'Main — אין טווח (החזרות מתבנית השבוע)');
ok(_repRangeOf({ repMin: 10, repMax: 6 }).src === 'default',             'טווח הפוך — לא תקין, ברירת מחדל');
ok(_repRangeOf(null) === null && _repRangeLabel(null) === '',            'קלט חסר — לא קריסה');

const r = { min: 8, max: 12 };
ok(_repDefaultFromRange(r, 10) === 10,   'בפעם הקודמת 10 (בטווח) — ממשיכים מ-10');
ok(_repDefaultFromRange(r, 6) === 8,     'בפעם הקודמת 6 (מתחת) — תחתית הטווח');
ok(_repDefaultFromRange(r, 14) === 8,    'בפעם הקודמת 14 (מעל — זמן להעלות משקל) — תחתית הטווח');
ok(_repDefaultFromRange(r, null) === 8,  'אין היסטוריה — תחתית הטווח');
ok(_repDefaultFromRange(null, 10) === null, 'בלי טווח — null');

console.log(failed ? `\n${failed} נכשלו` : '\nהכול עבר');
process.exit(failed ? 1 : 0);
