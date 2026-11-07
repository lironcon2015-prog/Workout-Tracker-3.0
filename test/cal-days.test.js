/* ============================================================================
 * test/cal-days.test.js — "אימון אחרון" במסך הבית לפי ימים קלנדריים
 * הרצה: node test/cal-days.test.js   (ללא תלויות, ללא build)
 *
 * הרקע: הכרטיס חישב Math.floor((now - ts) / 24h). אימון של אתמול בערב שנצפה
 * למחרת בבוקר (פחות מ-24 שעות) הוצג כ"היום".
 * הבדיקה נכשלת על הקוד הישן: שם אין בלוק CALDAYS כלל.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'archive-logic.js'), 'utf8');
const block = src.split('CALDAYS-START')[1]?.split('CALDAYS-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק CALDAYS לא נמצא ב-archive-logic.js'); process.exit(1); }
const { _calDaysAgo } = new Function(block + '\nreturn { _calDaysAgo };')();

let failed = 0;
function ok(cond, name) { console.log(`${cond ? '✓' : '✗'} ${name}`); if (!cond) failed++; }
const t = (y, m, d, h, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();

ok(_calDaysAgo(t(2026, 11, 6, 21), t(2026, 11, 7, 7)) === 1, 'אתמול 21:00 נצפה ב-07:00 → אתמול (לא היום)');
ok(_calDaysAgo(t(2026, 11, 6, 23, 59), t(2026, 11, 7, 0, 1)) === 1, 'דקה לפני חצות → אתמול');
ok(_calDaysAgo(t(2026, 11, 7, 6), t(2026, 11, 7, 22)) === 0, 'הבוקר, נצפה בערב → היום');
ok(_calDaysAgo(t(2026, 11, 5, 8), t(2026, 11, 7, 7)) === 2, 'שלשום בבוקר → לפני 2 ימים');
ok(_calDaysAgo(t(2026, 3, 26, 20), t(2026, 3, 27, 9)) === 1, 'מעבר שעון קיץ → עדיין יום אחד');
ok(_calDaysAgo(t(2026, 11, 6, 21), t(2026, 11, 8, 20)) === 2, '47 שעות על פני שני לילות → 2');

if (failed) { console.error(`\n${failed} בדיקות נכשלו`); process.exit(1); }
console.log('\nכל הבדיקות עברו');
