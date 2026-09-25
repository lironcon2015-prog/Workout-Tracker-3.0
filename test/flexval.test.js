/* ============================================================================
 * test/flexval.test.js — "ערך גמיש" בעורך התוכניות: פענוח ובדיקת טווח של הקלדה ידנית
 * הרצה: node test/flexval.test.js   (ללא תלויות, ללא build)
 * זמן נשמר בשניות (כמו restTime/clusterRest/workSec), יעד אירובי בדקות → שניות.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'editor-logic.js'), 'utf8');
const block = src.split('FLEXVAL-START')[1]?.split('FLEXVAL-END')[0]?.replace(/^[^\n]*\n/, '').replace(/\n[^\n]*$/, '');
if (!block) { console.error('✗ בלוק FLEXVAL לא נמצא ב-editor-logic.js'); process.exit(1); }
const { _fvParse, _fvValidate, _fvFmt, FV_SPECS } = new Function(block + '\nreturn { _fvParse, _fvValidate, _fvFmt, FV_SPECS };')();

let failed = 0;
const ok = (c, n) => { console.log(`${c ? '✓' : '✗'} ${n}`); if (!c) failed++; };
const run = (raw, key) => { const sp = FV_SPECS[key]; const p = _fvParse(raw, sp.kind); return p.ok ? _fvValidate(p.value, sp) : p; };

/* ── זמן ─────────────────────────────────────────────────────────────────── */
ok(run('1:45', 'rest').value === 105, 'מנוחה "1:45" → 105 שניות');
ok(run('105', 'rest').value === 105, 'מנוחה "105" → 105 שניות');
ok(run('0:05', 'rest').ok === false, 'מנוחה 5 שניות — מתחת לטווח');
ok(/0:10/.test(run('0:05', 'rest').reason), 'הסיבה מציינת את הטווח');
ok(run('1:75', 'rest').ok === false, 'שניות מעל 59 נדחות');
ok(run('900', 'rest').ok === false, 'טעות הקלדה 900 נחסמת');
ok(run('abc', 'rest').ok === false, 'טקסט לא חוקי נדחה');
ok(run('0:00', 'clRest').value === 0, 'מנוחה בין סבבים 0 מותרת');
ok(_fvFmt(105, 'time') === '1:45' && _fvFmt(60, 'time') === '1:00', 'תצוגת זמן m:ss');

/* ── משקל ────────────────────────────────────────────────────────────────── */
ok(run('0.5', 'step').value === 0.5, 'קפיצה 0.5 ק״ג');
ok(run('4,5', 'step').value === 4.5, 'פסיק עשרוני מתקבל (4,5)');
ok(run('0.1', 'step').ok === false, 'קפיצה 0.1 — מתחת לטווח');
ok(run('42.5', 'tW').value === 42.5, 'משקל יעד עשרוני');
ok(run('-5', 'tW').ok === false, 'מספר שלילי נדחה');

/* ── שלמים וקפיצות ───────────────────────────────────────────────────────── */
ok(run('8', 'sets').value === 8, '8 סטים');
ok(run('2.5', 'sets').ok === false, 'סטים חייבים להיות שלמים');
ok(run('25', 'dropPct').value === 25, 'דרופ 25%');
ok(run('1.5', 'tRIR').value === 1.5, 'RIR 1.5');
ok(run('1.3', 'tRIR').ok === false, 'RIR בקפיצות של 0.5 בלבד');
ok(run('31', 'rounds').ok === false, 'סבבים מעל 30 נחסם');

/* ── יעד אירובי בדקות ────────────────────────────────────────────────────── */
ok(run('45', 'targetSec').value === 2700, 'יעד 45 דק׳ → 2700 שניות');
ok(_fvFmt(2700, 'min') === '45', 'תצוגת יעד בדקות');

if (failed) { console.error(`\n${failed} בדיקות נכשלו`); process.exit(1); }
console.log('\nכל בדיקות הערך הגמיש עברו');
