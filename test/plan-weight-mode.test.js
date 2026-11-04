/* ============================================================================
 * test/plan-weight-mode.test.js — יחידת משקל לפי תוכנית + משקל אחרון לפי יחידה
 * הרצה: node test/plan-weight-mode.test.js   (ללא תלויות, ללא build)
 *
 * באג: החלפת יחידה (ק"ג ↔ פלטות) הייתה חד-פעמית, ואין דרך לקבע יחידה לתרגיל
 * באימון מסוים; "משקל אחרון" נשמר רק ביחידת המאגר — אז ערך פלטות לא נשמר
 * ו-prefill בפלטות קיבל ערך ק"ג (40 → נחתך לפלטה 1).
 * בלוק WMODE ב-workout-core.js, בלוק WMWEIGHT ב-storage.js.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

function load(file, tag, names) {
    const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const block = src.split(tag + '-START')[1]?.split(tag + '-END')[0]?.replace(/^[^\n]*\n/, '');
    if (!block) { console.error(`✗ בלוק ${tag} לא נמצא ב-${file}`); process.exit(1); }
    return new Function(block + `\nreturn { ${names.join(', ')} };`)();
}
const { _resolveWeightMode } = load('workout-core.js', 'WMODE', ['_resolveWeightMode']);
const { _pickLastWeight, _writeLastWeight } = load('storage.js', 'WMWEIGHT', ['_pickLastWeight', '_writeLastWeight']);

let failed = 0;
function ok(cond, name) {
    console.log(`${cond ? '✓' : '✗'} ${name}`);
    if (!cond) failed++;
}

// ── סדר עדיפות היחידה ──
const db = [{ name: 'LEG PRESS', weightMode: 'kg' }, { name: 'DIP', isBW: true }];
const fromDb = (n) => Object.assign({}, db.find(e => e.name === n));
const legA = Object.assign(fromDb('LEG PRESS'), { weightMode: 'plates' });   // אימון A: פלטות בתוכנית
const legB = fromDb('LEG PRESS');                                              // אימון B: ברירת מחדל

ok(_resolveWeightMode('LEG PRESS', null, legA, 'LEG PRESS', db) === 'plates', 'יחידת התוכנית גוברת על המאגר');
ok(_resolveWeightMode('LEG PRESS', null, legB, 'LEG PRESS', db) === 'kg',     'בלי יחידה בתוכנית — ברירת המחדל מהמאגר');
ok(_resolveWeightMode('LEG PRESS', { 'LEG PRESS': 'kg' }, legA, 'LEG PRESS', db) === 'kg', 'החלפה חד-פעמית גוברת על התוכנית');
ok(_resolveWeightMode('LEG PRESS', {}, legA, 'LEG PRESS', db) === 'plates',   'אימון חדש (בלי החלפות) חוזר ליחידת התוכנית');
ok(_resolveWeightMode('DIP', null, fromDb('DIP'), 'DIP', db) === 'bw',         'דגל isBW ישן ממופה למשקל גוף');
ok(_resolveWeightMode('LEG PRESS', null, legA, 'DIP', db) === 'kg',            'currentEx של תרגיל אחר לא משפיע');
ok(_resolveWeightMode('UNKNOWN', null, null, null, db) === 'kg',               'תרגיל לא מוכר — ק"ג');

// ── משקל אחרון לפי יחידה ──
let L = { 'LEG PRESS': 120 }, M = {};   // מצב ישן: 120 ק"ג במפה הישנה
ok(_pickLastWeight(L, M, 'LEG PRESS', 'kg', 'kg') === 120,       'ערך ישן נקרא כיחידת ברירת המחדל');
ok(_pickLastWeight(L, M, 'LEG PRESS', 'plates', 'kg') === null,  'ערך ק"ג ישן לא מוצע כפלטות');

let r = _writeLastWeight(L, M, 'LEG PRESS', 6, 'plates', 'kg');   // אימון A בפלטות
ok(r.legacy['LEG PRESS'] === 120,                                 'פלטות לא דורסות את הק"ג במפה הישנה');
ok(_pickLastWeight(r.legacy, r.byMode, 'LEG PRESS', 'plates', 'kg') === 6, 'A הבא נפתח ב-6 פלטות');
r = _writeLastWeight(r.legacy, r.byMode, 'LEG PRESS', 130, 'kg', 'kg'); // אימון B בק"ג
ok(_pickLastWeight(r.legacy, r.byMode, 'LEG PRESS', 'kg', 'kg') === 130,    'B הבא נפתח ב-130 ק"ג');
ok(_pickLastWeight(r.legacy, r.byMode, 'LEG PRESS', 'plates', 'kg') === 6,  'ערך הפלטות נשמר אחרי B');
ok(r.legacy['LEG PRESS'] === 130,                                 'המפה הישנה מתעדכנת ביחידת ברירת המחדל');
ok(_pickLastWeight(r.legacy, r.byMode, 'LEG PRESS', undefined, 'kg') === 130, 'קריאה בלי יחידה — המפה הישנה');

const before = JSON.stringify(L);
_writeLastWeight(L, M, 'X', 5, 'plates', 'kg');
ok(JSON.stringify(L) === before && Object.keys(M).length === 0,   'הכתיבה לא משנה את הקלט');
r = _writeLastWeight({}, {}, 'DIP', 0, 'bw', 'bw');
ok(!r.byMode.DIP && r.legacy.DIP === undefined,                   'משקל גוף לא נשמר');

// Firestore: אין מערך בתוך מערך ואין undefined
const json = JSON.stringify(r.byMode) + JSON.stringify(_writeLastWeight(L, M, 'LEG PRESS', 6, 'plates', 'kg').byMode);
ok(!/\[\s*\[/.test(json) && !json.includes('undefined'),           'מבנה תקין ל-Firestore');

if (failed) { console.error(`\n${failed} בדיקות נכשלו`); process.exit(1); }
console.log('\nכל הבדיקות עברו');
