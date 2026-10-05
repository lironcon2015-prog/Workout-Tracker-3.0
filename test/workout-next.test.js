/* ============================================================================
 * test/workout-next.test.js — "הבא בתור" במסך בחירת האימון
 * הרצה: node test/workout-next.test.js   (ללא תלויות, ללא build)
 *
 * הבא בתור = האימון שלא בוצע השבוע (מיום ראשון) ושעבר הכי הרבה זמן מאז שבוצע.
 * הכול לפי timestamp — entry.date (DD.MM.YY) אינו בר-השוואה.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'editor-logic.js'), 'utf8');
const block = src.split('WT-NEXT-START')[1]?.split('WT-NEXT-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק WT-NEXT לא נמצא ב-editor-logic.js'); process.exit(1); }
const { _wtWeekStart, _wtPickNext, _wtCore } = new Function(block + '\nreturn { _wtWeekStart, _wtPickNext, _wtCore };')();

let failed = 0;
function ok(cond, name) {
    console.log(`${cond ? '✓' : '✗'} ${name}`);
    if (!cond) failed++;
}

/* ── תחילת שבוע: יום ראשון 00:00 מקומי ─────────────────────────────── */
const wed = new Date(2026, 9, 7, 18, 30).getTime();      // רביעי 7.10.2026
const ws = _wtWeekStart(wed);
const wsD = new Date(ws);
ok(wsD.getDay() === 0 && wsD.getHours() === 0 && wsD.getDate() === 4, 'רביעי → ראשון 4.10 בחצות');
const sun = new Date(2026, 9, 4, 0, 5).getTime();
ok(_wtWeekStart(sun) === ws, 'ראשון בבוקר שייך לאותו שבוע');
const sat = new Date(2026, 9, 3, 23, 59).getTime();
ok(_wtWeekStart(sat) < ws, 'מוצאי שבת שייכים לשבוע הקודם');

/* ── בחירה ─────────────────────────────────────────────────────────── */
const DAY = 86400000;
const keys = ['A', 'B', 'C'];
ok(_wtPickNext(keys, { A: ws - 6 * DAY, B: ws + DAY, C: ws - 3 * DAY }, ws) === 'A', 'הישן ביותר מבין מה שלא בוצע השבוע');
ok(_wtPickNext(keys, { A: ws - 6 * DAY, B: null, C: ws - 3 * DAY }, ws) === 'B', 'טרם בוצע קודם לכל השאר');
ok(_wtPickNext(keys, { A: ws + DAY, B: ws + 2 * DAY, C: ws }, ws) === null, 'הכול בוצע השבוע → אין "הבא בתור"');
ok(_wtPickNext(['A', 'B'], { A: null, B: null }, ws) === 'A', 'שניים שטרם בוצעו → הראשון בסדר התוכנית');
ok(_wtPickNext([], {}, ws) === null, 'רשימה ריקה → null');

/* ── אימון בונוס ───────────────────────────────────────────────────── */
const items = [{ key: 'A' }, { key: 'Bonus', bonus: true }, { key: 'C' }];
const core = _wtCore(items).map(it => it.key);
ok(core.join() === 'A,C', 'בונוס מחוץ לספירה השבועית');
ok(_wtPickNext(core, { A: ws + DAY, Bonus: null, C: ws + DAY }, ws) === null,
   'בונוס שטרם בוצע אינו "הבא בתור" כשכל הקבועים בוצעו');
ok(_wtPickNext(core, { A: ws - 2 * DAY, Bonus: null, C: ws - 5 * DAY }, ws) === 'C', 'הבחירה רק מבין הקבועים');

console.log(failed ? `\n${failed} נכשלו` : '\nהכול עבר');
process.exit(failed ? 1 : 0);
