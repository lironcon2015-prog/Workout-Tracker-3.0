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
const { _exNameKey, _findExDetails, _lastPerformancesIn, _exCanonMap, _exCanonEntry, _exCanonKeyed } =
    new Function(block + '\nreturn { _exNameKey, _findExDetails, _lastPerformancesIn, _exCanonMap, _exCanonEntry, _exCanonKeyed };')();

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


/* ── איחוד לשם הקנוני: כל הצרכנים (אנליטיקה, שיאים, מאמן) רואים תרגיל אחד ─── */
const DB = ['machine chest press', 'Leg Press', 'Bench Press'];
const old = {
    timestamp: 1, date: '07.10.26',
    details: { 'Machine Chest Press': { sets: ['50kg x 10', '50kg x 9'], vol: 950, note: 'מושב 4' },
               'Leg Press': { sets: ['100kg x 10'], vol: 1000 } },
    exOrder: ['Machine Chest Press', 'Leg Press'],
    log: [{ exName: 'Machine Chest Press', w: 50, r: 10 }, { exName: 'Leg Press', w: 100, r: 10 }],
    summary: 'Machine Chest Press (2 סטים):\n50kg x 10\n\nLeg Press:\n100kg x 10\nCluster 1\n  Machine Chest Press: 50kg x 9\nMachine Chest Press Incline (1):\nx'
};
const c = _exCanonEntry(old, DB);
const e = c.entry;
ok(c.changed === true,                                   'רשומה עם שם ברישיות שונות מסומנת לשינוי');
ok(e.details['machine chest press'] && !e.details['Machine Chest Press'], 'המפתח אוחד לשם שבמאגר');
ok(e.details['machine chest press'].vol === 950 && e.details['machine chest press'].sets.length === 2 && e.details['machine chest press'].note === 'מושב 4', 'סטים, נפח והערה עברו כמו שהם');
ok(e.exOrder.join('|') === 'machine chest press|Leg Press', 'סדר התרגילים אוחד');
ok(e.log[0].exName === 'machine chest press' && e.log[0].w === 50 && e.log[1].exName === 'Leg Press', 'שורות היומן אוחדו, ערכים לא שונו');
ok(e.summary.split('\n')[0] === 'machine chest press (2 סטים):', 'כותרת בלוק בסיכום אוחדה');
ok(e.summary.indexOf('  machine chest press: 50kg x 9') > -1, 'שורת Cluster מוזחת אוחדה');
ok(e.summary.indexOf('Machine Chest Press Incline (1):') > -1, 'תרגיל אחר שמתחיל באותו שם — לא נגעו');
ok(e.date === '07.10.26' && e.timestamp === 1,           'תאריך ו-timestamp לא שונו');
ok(old.details['Machine Chest Press'] && old.exOrder[0] === 'Machine Chest Press', 'הקלט לא שונה (טהורה)');
ok(_exCanonEntry(e, DB).changed === false,               'ריצה שנייה — אין שינוי (אידמפוטנטי)');

const both = _exCanonEntry({ details: { 'Machine Chest Press': { sets: ['a'], vol: 10 }, 'machine chest press': { sets: ['b'], vol: 5 } } }, DB).entry;
ok(Object.keys(both.details).length === 1 && both.details['machine chest press'].sets.length === 2 && both.details['machine chest press'].vol === 15, 'שני השמות באותו אימון — אוחדו לתרגיל אחד');

ok(Object.keys(_exCanonMap(['Squat'], ['Squat', 'squat'])).length === 0 && Object.keys(_exCanonMap(['SQUAT'], ['Squat', 'squat'])).length === 0, 'שני שמות במאגר שנבדלים ברישיות — עמימות, לא נוגעים');
ok(Object.keys(_exCanonMap(['Deadlift'], DB)).length === 0, 'שם שאין לו מקבילה במאגר — נשאר');
ok(_exCanonEntry({ details: {} }, DB).changed === false && _exCanonEntry(null, DB).changed === false, 'רשומה ריקה — לא קריסה');

const kw = _exCanonKeyed({ 'Machine Chest Press': 50, 'Leg Press': 100 }, DB);
ok(kw.changed && kw.obj['machine chest press'] === 50 && !('Machine Chest Press' in kw.obj) && kw.obj['Leg Press'] === 100, 'משקל אחרון: מפתח אוחד');
const kw2 = _exCanonKeyed({ 'Machine Chest Press': 45, 'machine chest press': 55 }, DB);
ok(kw2.obj['machine chest press'] === 55 && Object.keys(kw2.obj).length === 1, 'מפתח קנוני קיים גובר על הישן');
ok(_exCanonKeyed(null, DB).changed === false, 'מפה חסרה — לא קריסה');

console.log(failed ? `\n${failed} נכשלו` : '\nהכול עבר');
process.exit(failed ? 1 : 0);
