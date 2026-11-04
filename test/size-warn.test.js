/* ============================================================================
 * test/size-warn.test.js — אזהרת גודל מסמך בענן
 * הרצה: node test/size-warn.test.js   (ללא תלויות, ללא build)
 *
 * באג: אזהרת "83% ממגבלת Firestore" לא אמרה איזה מסמך ומה תופס בו מקום, ובארכיון
 * היא מדדה את **סכום** כל ה-chunks שנכתבו ב-batch — אבל המגבלה היא 1MB למסמך.
 * כתיבה מלאה של 3 chunks × 300KB הקפיצה אזהרה כוזבת.
 * בלוק SIZEDIAG ב-storage.js.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'storage.js'), 'utf8');
const block = src.split('SIZEDIAG-START')[1]?.split('SIZEDIAG-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק SIZEDIAG לא נמצא ב-storage.js'); process.exit(1); }
const { _docSizeBreakdown, _archiveWarnBytes } =
    new Function(block + '\nreturn { _docSizeBreakdown, _archiveWarnBytes };')();

let failed = 0;
function ok(cond, name) {
    console.log(`${cond ? '✓' : '✗'} ${name}`);
    if (!cond) failed++;
}

const WARN = 800 * 1024;
const chunk = 'x'.repeat(300 * 1024);
const aw = _archiveWarnBytes([chunk, chunk, chunk], [0, 1, 2]);
ok(aw.bytes === chunk.length,           'ארכיון: נמדד ה-chunk הגדול, לא הסכום');
ok(!(aw.bytes > WARN),                  '3 chunks × 300KB — אין אזהרה (כל מסמך רחוק מ-1MB)');
ok(_archiveWarnBytes(['a', 'bbbb', 'cc'], [0, 1, 2]).idx === 1, 'מזהה איזה chunk הגדול');
ok(_archiveWarnBytes([], []).bytes === 0, 'בלי chunks — 0');

const doc = { small: { a: 1 }, big: 'y'.repeat(5000), mid: ['z'.repeat(1000)], none: undefined, updatedAt: 1 };
const top = _docSizeBreakdown(doc, 3);
ok(top[0][0] === 'big' && top[1][0] === 'mid', 'פירוט ממוין מהגדול לקטן');
ok(top.length === 3,                    'מוגבל ל-limit');
ok(!_docSizeBreakdown(doc, 10).some(([k]) => k === 'none'), 'שדה undefined לא נספר');
ok(_docSizeBreakdown({ h: 'שלום' })[0][1] === JSON.stringify('שלום').length + 4, 'עברית נספרת בבייטים (UTF-8)');

if (failed) { console.error(`\n${failed} בדיקות נכשלו`); process.exit(1); }
console.log('\nכל הבדיקות עברו');
