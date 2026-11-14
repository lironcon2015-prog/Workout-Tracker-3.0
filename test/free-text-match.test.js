/* ============================================================================
 * test/free-text-match.test.js — התאמת שם מזון מטקסט חופשי למאגר
 * הרצה: node test/free-text-match.test.js   (ללא תלויות, ללא build)
 *
 * הרקע (v19.19.1): "חזה עוף צלוי" לא זוהה — ההתאמה דרשה שכל מילות הפריט יופיעו בשם
 * המזון, וגם ה-AI מחזיר שמות כאלה. כשל שקט: הפריט פשוט עבר ל"לא זוהו".
 * הבלוקים נטענים מ-food-logic.js: FDSCORE (דירוג), FDBASIC (חומרי גלם), FDMATCH (ההתאמה).
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'food-logic.js'), 'utf8');
const blk = tag => {
    const b = src.split(tag + '-START')[1]?.split(tag + '-END')[0]?.replace(/^[^\n]*\n/, '');
    if (!b) { console.error(`✗ בלוק ${tag} לא נמצא ב-food-logic.js`); process.exit(1); }
    return b;
};
const { fdMatchFoodIn, BASIC_FOODS } = new Function(
    blk('FDSCORE') + '\n' + blk('FDBASIC') + '\n' + blk('FDMATCH') + '\nreturn { fdMatchFoodIn, BASIC_FOODS };')();

let failed = 0;
const ok = (c, n) => { console.log(`${c ? '✓' : '✗'} ${n}`); if (!c) failed++; };
const m = (name, lists, noUnit) => (fdMatchFoodIn(name, lists || [BASIC_FOODS], noUnit) || {}).name || null;

ok(m('חזה עוף') === 'חזה עוף', 'שם זהה');
ok(m('חזה עוף צלוי') === 'חזה עוף', 'מילת הכנה ("צלוי") לא מפילה את ההתאמה');
ok(m('חזה עוף מבושל') === 'חזה עוף', '"מבושל"');
ok(m('חזה עוף בגריל עם תבלינים') === 'חזה עוף', 'התאמה הפוכה: "חזה עוף" בתוך תיאור ארוך');
ok(m('אורז מבושל') !== null && m('אורז מבושל').indexOf('אורז') === 0, '"אורז מבושל" → אורז');
ok(m('ביצים') === 'ביצה', 'רבים → יחיד');
ok(m("קוטג׳") === "קוטג' 5%", 'גרש עברי (מקלדת iOS) מול גרש רגיל במאגר');
ok(m('חלב שקדים') === null, '"חלב שקדים" לא נתפס כ"חלב" (מילה אחת לא מספיקה להתאמה הפוכה)');
ok(m('סלט ירקות') === null, 'מזון שאין במאגר → null');
ok(m('') === null, 'שם ריק → null בלי קריסה');

// סדר עדיפות: מזון שתועד גובר על חומר גלם
const mine = [{ name: 'חזה עוף טחון', per100: { kcal: 110 }, lastUsed: 1 }];
ok(m('חזה עוף טחון', [mine, BASIC_FOODS]) === 'חזה עוף טחון', 'רשימה ראשונה (מזונות שתועדו) גוברת');
// מזון נספר — לא במסלול ה-AI (התשובה בגרמים)
const unit = [{ name: 'קציצות בלה', baseUnit: 'unit', per100: { kcal: 6400 } }];
ok(m('קציצות בלה', [unit]) === 'קציצות בלה', 'מזון נספר מותאם במסלול המקומי');
ok(m('קציצות בלה', [unit], true) === null, 'מזון נספר לא מותאם במסלול ה-AI');
// ארוחה שמורה לא מותאמת כפריט
ok(m('קערה', [[{ name: 'קערה', per100: { kcal: 1 }, components: [{}] }]]) === null, 'ארוחה שמורה לא מותאמת');

if (failed) { console.error(`\n✗ ${failed} בדיקות נכשלו`); process.exit(1); }
console.log('\n✓ כל הבדיקות עברו');
