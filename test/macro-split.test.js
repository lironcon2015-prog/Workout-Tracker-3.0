/* ============================================================================
 * test/macro-split.test.js — אחוז הקלוריות מכל מאקרו ביומן התזונה
 * הרצה: node test/macro-split.test.js   (ללא תלויות, ללא build)
 *
 * האחוזים מחושבים מגרמי המאקרו (4/4/9), סכומם תמיד 100, ואין מאקרו → null.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'food-logic.js'), 'utf8');
const block = src.split('FD-SPLIT-START')[1]?.split('FD-SPLIT-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק FD-SPLIT לא נמצא ב-food-logic.js'); process.exit(1); }
const { _fdMacroSplit } = new Function(block + '\nreturn { _fdMacroSplit };')();

let failed = 0;
function ok(cond, name) {
    console.log(`${cond ? '✓' : '✗'} ${name}`);
    if (!cond) failed++;
}
const sum = s => s.pct[0] + s.pct[1] + s.pct[2];

const meal = _fdMacroSplit(55.3, 58.4, 17.4);
ok(meal.pct.join() === '36,38,26', 'ארוחה: 36/38/26');
ok(meal.kcal.join() === '221,234,157', 'קק"ל לכל מאקרו לפי 4/4/9');
ok(_fdMacroSplit(46.5, 0, 5.4).pct[1] === 0, 'אפס פחמימה → 0%');
ok(_fdMacroSplit(1, 1, 0).pct.join() === '50,50,0', 'חצי-חצי');
ok(sum(_fdMacroSplit(1, 1, 1)) === 100, 'שליש-שליש-שליש מתעגל ל-100');
ok(sum(_fdMacroSplit(3.4, 2.4, 11.4)) === 100, 'טחינה: סכום 100');
let all = true;
for (let i = 0; i < 500; i++) {
    const s = _fdMacroSplit(Math.random() * 60, Math.random() * 90, Math.random() * 40);
    if (!s || sum(s) !== 100 || s.pct.some(v => v < 0)) { all = false; break; }
}
ok(all, '500 ערכים אקראיים — סכום תמיד 100, אין שלילי');
ok(_fdMacroSplit(0, 0, 0) === null, 'אין מאקרו → null');
ok(_fdMacroSplit(undefined, null, '') === null, 'ערכים חסרים → null');
ok(_fdMacroSplit('10', '0', '0').pct[0] === 100, 'מחרוזות מספריות נקראות');

console.log(failed ? `\n${failed} נכשלו` : '\nהכול עבר');
process.exit(failed ? 1 : 0);
