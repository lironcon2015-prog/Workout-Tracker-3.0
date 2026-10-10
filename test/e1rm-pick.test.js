/* ============================================================================
 * test/e1rm-pick.test.js — מאיזה אימון נלקח ה-e1RM בסנאפשוט האנליטי למאמן
 * הרצה: node test/e1rm-pick.test.js   (ללא תלויות, ללא build)
 *
 * הבלוק נטען מסמני E1RM ב-workout-core.js. הכשל: ה-e1RM נלקח מהאימון האחרון
 * שבו התרגיל הופיע — גם דילואוד — והמאמן קיבל "ירידה" מדומה ב-1RM.
 * parse/calc מוזרקים; כאן עותקים מינימליים של parseSetsFromStrings/calc1RM (Epley).
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'workout-core.js'), 'utf8');
const block = src.split('E1RM-START')[1]?.split('E1RM-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק E1RM לא נמצא ב-workout-core.js'); process.exit(1); }
const { _pickE1RM } = new Function(block + '\nreturn { _pickE1RM };')();

const parse = sets => sets.map(s => {
    const w = parseFloat((s.match(/([\d.]+)\s*kg/) || [])[1]); const r = parseInt((s.match(/x\s*(\d+)/) || [])[1]);
    return w && r ? { w, r } : null;
}).filter(Boolean);
const calc = (w, r) => w * (1 + r / 30);

let failed = 0;
function ok(cond, name, extra) {
    console.log(`${cond ? '✓' : '✗'} ${name}${cond || !extra ? '' : `\n    ${extra}`}`);
    if (!cond) failed++;
}

const BP = 'Bench Press (Main)';
const e = (ts, week, sets, type) => ({ timestamp: ts, week, type: type || 'חזה', details: { [BP]: { sets } } });
const W3 = e(900, 3, ['87.5kg x 5 (RIR 5)', '97.5kg x 3 (RIR 4)', '110kg x 4 (RIR 0.5)', '90kg x 10 (RIR 1)']);
const W2 = e(950, 2, ['105kg x 5 (RIR 1)', '80kg x 10 (RIR 2)']);
const DL = e(1000, 'deload', ['60kg x 5 (RIR 5)', '70kg x 5 (RIR 5)']);

// דילואוד חדש יותר — הבדיקה שנכשלת על הקוד הישן
const nonMain = _pickE1RM([DL, W3], BP, false, parse, calc, 'epley');
ok(nonMain && Math.round(nonMain.v) !== Math.round(calc(70, 5)), 'ה-e1RM אינו נלקח מאימון דילואוד',
   nonMain ? `התקבל ${Math.round(nonMain.v)}` : 'null');
ok(nonMain && Math.round(nonMain.v) === Math.round(calc(110, 4)) && nonMain.src === '',
   'תרגיל שאינו Main — הסט הטוב באימון האחרון שאינו דילואוד, בלי תיוג');

// Main — סט ה-AMRAP של W3, גם כשאימון W2 חדש יותר
const main = _pickE1RM([DL, W2, W3], BP, true, parse, calc, 'epley');
ok(main && Math.round(main.v) === Math.round(calc(110, 4)) && main.src === 'W3 AMRAP',
   'Main — סט הפיק (המשקל הכבד) של W3 האחרון, לא הבק-אוף ולא W2', main ? `${main.v} ${main.src}` : 'null');

// אין W3 — נפילה לאימון האחרון שאינו דילואוד, עם סימון השבוע
const noW3 = _pickE1RM([DL, W2], BP, true, parse, calc, 'epley');
ok(noW3 && Math.round(noW3.v) === Math.round(calc(105, 5)) && noW3.src.includes('Week 2'),
   'Main בלי W3 — האימון האחרון שאינו דילואוד, מסומן Week 2', noW3 ? `${noW3.v} ${noW3.src}` : 'null');

ok(_pickE1RM([DL], BP, true, parse, calc, 'epley') === null, 'רק דילואוד — אין ערך');
const fs3 = _pickE1RM([e(1, 3, ['100kg x 5'], 'Freestyle'), W2], BP, true, parse, calc, 'epley');
ok(fs3 && fs3.src.includes('Freestyle') && fs3.src.includes('אין W3'), 'Freestyle אינו נחשב W3 (נלקח כנפילה, מתויג)');

console.log(failed ? `\n${failed} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(failed ? 1 : 0);
