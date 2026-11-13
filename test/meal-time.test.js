/* ============================================================================
 * test/meal-time.test.js — בחירת הארוחה לפי השעה (כפתור "הוסף מזון" ביומן)
 * הרצה: node test/meal-time.test.js   (ללא תלויות, ללא build)
 * הבלוק נטען מ-food-logic.js בין הסמנים FDMEALTIME-START/END.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'food-logic.js'), 'utf8');
const block = src.split('FDMEALTIME-START')[1]?.split('FDMEALTIME-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק FDMEALTIME לא נמצא ב-food-logic.js'); process.exit(1); }
const { fdMealForTime } = new Function(block + '\nreturn { fdMealForTime };')();

let failed = 0;
const ok = (c, n) => { console.log(`${c ? '✓' : '✗'} ${n}`); if (!c) failed++; };
const L = ['בוקר', 'צהריים', 'ערב', 'נשנוש'];
const t = (h, m = 0) => h * 60 + m;

ok(fdMealForTime(t(7, 30), {}, L) === 'בוקר', 'בלי היסטוריה: 07:30 → בוקר (ברירת מחדל)');
ok(fdMealForTime(t(13, 20), {}, L) === 'צהריים', 'בלי היסטוריה: 13:20 → צהריים');
ok(fdMealForTime(t(21), {}, L) === 'ערב', 'בלי היסטוריה: 21:00 → ערב');
ok(fdMealForTime(t(16, 20), {}, L) === 'נשנוש', 'בלי היסטוריה: 16:20 → נשנוש');
// מי שאוכל צהריים מאוחר — ההיסטוריה גוברת על ברירת המחדל
const late = { 'צהריים': [t(15), t(15, 10), t(15, 30)], 'נשנוש': [t(11), t(11, 15), t(10, 45)] };
ok(fdMealForTime(t(15, 5), late, L) === 'צהריים', 'צהריים שתועדו ב-15:00 → 15:05 הוא צהריים, לא נשנוש');
ok(fdMealForTime(t(11), late, L) === 'נשנוש', 'נשנוש שתועד ב-11:00 → 11:00 הוא נשנוש, לא בוקר');
ok(fdMealForTime(t(15, 5), { 'צהריים': [t(15), t(15, 10)] }, L) === 'נשנוש', 'פחות מ-3 דגימות — לא נחשב, נשארת ברירת המחדל');
// מרחק מעגלי: ארוחה מותאמת בחצות
ok(fdMealForTime(t(23, 50), { 'לילה': [t(0, 10), t(0, 5), t(0, 20)] }, L.concat('לילה')) === 'לילה', '23:50 קרוב ל-00:10 (מעבר חצות)');
ok(fdMealForTime(t(12), {}, ['ארוחה א', 'ארוחה ב']) === 'ארוחה א', 'ארוחות מותאמות בלי היסטוריה → הראשונה');
ok(fdMealForTime(t(12), {}, []) === null, 'אין ארוחות → null בלי קריסה');

if (failed) { console.error(`\n✗ ${failed} בדיקות נכשלו`); process.exit(1); }
console.log('\n✓ כל הבדיקות עברו');
