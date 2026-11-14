/* ============================================================================
 * test/free-text-parse.test.js — פענוח מקומי של תיעוד מזון בטקסט חופשי
 * הרצה: node test/free-text-parse.test.js   (ללא תלויות, ללא build)
 * הבלוק נטען מ-food-logic.js בין הסמנים FDFREEPARSE-START/END.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'food-logic.js'), 'utf8');
const block = src.split('FDFREEPARSE-START')[1]?.split('FDFREEPARSE-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק FDFREEPARSE לא נמצא ב-food-logic.js'); process.exit(1); }
const { fdParseFreeItems } = new Function(block + '\nreturn { fdParseFreeItems };')();

let failed = 0;
const ok = (c, n) => { console.log(`${c ? '✓' : '✗'} ${n}`); if (!c) failed++; };
const one = t => fdParseFreeItems(t)[0] || {};

let r = fdParseFreeItems('200 גרם אורז, 180 חזה עוף, כף טחינה');
ok(r.length === 3, 'פסיקים מפרידים לשלושה פריטים');
ok(r[0].qty === 200 && r[0].unit === 'g' && r[0].name === 'אורז', '"200 גרם אורז" → 200 ג\' אורז');
ok(r[1].qty === 180 && r[1].unit === null && r[1].name === 'חזה עוף', '"180 חזה עוף" → כמות בלי יחידה');
ok(r[2].qty === 1 && r[2].unit === 'כף' && r[2].name === 'טחינה', '"כף טחינה" → כף אחת');

r = fdParseFreeItems('2 ביצים ו-3 פרוסות לחם מלא');
ok(r.length === 2, '"ו-3" מפריד בין פריטים');
ok(r[1].qty === 3 && r[1].unit === 'פרוסה' && r[1].name === 'לחם מלא', '"3 פרוסות לחם מלא"');
ok(fdParseFreeItems('אורז ולחם').length === 1, '"ו" בלי כמות אחריה לא מפרקת ("אורז ולחם" נשאר פריט אחד)');

ok(one('200ג אורז').qty === 200 && one('200ג אורז').unit === 'g', 'מספר צמוד ליחידה ("200ג")');
ok(one('חצי אבוקדו').qty === 0.5 && one('חצי אבוקדו').name === 'אבוקדו', '"חצי" = 0.5');
ok(one('שתי ביצים').qty === 2, '"שתי" = 2');
ok(one('1 וחצי כוסות חלב').qty === 1.5 && one('1 וחצי כוסות חלב').unit === 'כוס', '"1 וחצי כוסות"');
ok(one('0.5 ק"ג תפוח אדמה').qty === 0.5 && one('0.5 ק"ג תפוח אדמה').mult === 1000, 'ק"ג → mult 1000');
ok(one('250 מ"ל חלב 3%').unit === 'ml' && one('250 מ"ל חלב 3%').name === 'חלב 3%', 'אחוז נשאר חלק מהשם ("חלב 3%")');
ok(one('סלט ירקות קטן').name === 'סלט ירקות' && one('סלט ירקות קטן').size === 'קטן', 'מילת גודל לא חלק מהשם');
ok(one('כוס של חלב').name === 'חלב', '"של" מושמט');
ok(one('תפוח').qty === null && one('תפוח').unit === null, 'בלי כמות → qty null (הכמות האחרונה תיקבע בהתאמה)');
ok(fdParseFreeItems('').length === 0 && fdParseFreeItems(' , ,').length === 0, 'טקסט ריק → אין פריטים');
ok(fdParseFreeItems('200 גרם').length === 0, 'כמות בלי שם → לא פריט');

if (failed) { console.error(`\n✗ ${failed} בדיקות נכשלו`); process.exit(1); }
console.log('\n✓ כל הבדיקות עברו');
