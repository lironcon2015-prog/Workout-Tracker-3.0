/* ============================================================================
 * test/exercise-name-match.test.js — "ביצוע קודם" אינו נשבר משינוי אותיות/רווחים
 * הרצה: node test/exercise-name-match.test.js   (ללא תלויות, ללא build)
 *
 * באג: שינוי שם מ-"Machine Chest Press" ל-"machine chest press" ניתק את התרגיל
 * מכל ההיסטוריה — ההתאמה הייתה מפתח מדויק ב-entry.details. בלוק EXNAME ב-archive-logic.js.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'archive-logic.js'), 'utf8');
const block = src.split('EXNAME-START')[1]?.split('EXNAME-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק EXNAME לא נמצא ב-archive-logic.js'); process.exit(1); }
const { _exNameKey, _findExDetails, _lastPerformancesIn } =
    new Function(block + '\nreturn { _exNameKey, _findExDetails, _lastPerformancesIn };')();

let failed = 0;
function ok(cond, name) {
    console.log(`${cond ? '✓' : '✗'} ${name}`);
    if (!cond) failed++;
}

const archive = [
    { date: '14.10.26', details: { 'Leg Press': { sets: ['100kg x 10'] } } },
    { date: '07.10.26', details: { 'Machine Chest Press': { sets: ['50kg x 10', '50kg x 9'] } } },
    { date: '30.09.26', details: { 'Machine  Chest Press ': { sets: ['45kg x 10'] } } },
    { date: '23.09.26', details: { 'machine chest press': { sets: [] } } },
];

const hit = _lastPerformancesIn(archive, 'machine chest press', 5);
ok(hit.length === 2,                         'שם באותיות קטנות מוצא את הרשומות באותיות גדולות');
ok(hit[0].date === '07.10.26' && hit[0].sets.length === 2, 'הסדר נשמר — החדש ראשון');
ok(hit[1].date === '30.09.26',               'רווח כפול/רווח בסוף אינם מנתקים');
ok(_lastPerformancesIn(archive, 'Machine Chest Press', 5).length === 2, 'השם המקורי עדיין עובד');
ok(_lastPerformancesIn(archive, 'machine chest press', 1).length === 1, 'limit נשמר');
ok(_lastPerformancesIn(archive, 'Chest Press', 5).length === 0, 'אין התאמה חלקית — תרגיל אחר נשאר אחר');
ok(_lastPerformancesIn(null, 'x', 5).length === 0, 'ארכיון ריק — לא קריסה');

const exact = { 'Squat': { sets: [1] }, 'squat': { sets: [2] } };
ok(_findExDetails(exact, 'squat').sets[0] === 2, 'התאמה מדויקת גוברת על מנורמלת');
ok(_findExDetails(null, 'x') === null && _findExDetails({}, '') === null, 'קלט חסר → null');
ok(_exNameKey('  Bench  Press ') === 'bench press', 'נרמול: רווח קשיח, רווחים מרובים, רישיות');

console.log(failed ? `\n${failed} נכשלו` : '\nהכול עבר');
process.exit(failed ? 1 : 0);
