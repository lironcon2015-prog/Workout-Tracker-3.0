/* ============================================================================
 * test/db-guard.test.js — התוכניות והתרגילים לא נדרסים בברירות מחדל
 * הרצה: node test/db-guard.test.js   (ללא תלויות, ללא build)
 *
 * הרקע (25.9.2026): בפתיחת האפליקציה initDB קרא את התוכניות, הקריאה חזרה ריקה,
 * וברירות המחדל נשמרו מעל 15 תוכניות ו-84 תרגילים אמיתיים — ומשם נדחפו לענן.
 * הארכיון נשאר שלם, ולכן היה ברור שזו לא התקנה טרייה. הבדיקה מוודאת שברירות
 * המחדל נכתבות רק בהתקנה טרייה באמת, ושערך פגום לעולם לא נדרס.
 *
 * נכשלת על הקוד הישן: שם אין החלטה בכלל — כל ערך לא-תקין הוביל לשמירת ברירות מחדל.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'storage.js'), 'utf8');
const block = src.split('DBGUARD-START')[1]?.split('DBGUARD-END')[0]?.replace(/^[^\n]*\n/, '').replace(/\n[^\n]*$/, '');
if (!block) { console.error('✗ בלוק DBGUARD לא נמצא ב-storage.js'); process.exit(1); }
const api = new Function('return {' + block + '};')();
const decide = (raw, kind, hasUser) => {
    let parsed = null;
    if (raw !== null) { try { parsed = JSON.parse(raw); } catch (e) { parsed = undefined; } }
    return api._dbLoadDecision(raw, parsed, kind, hasUser);
};

let failed = 0;
function ok(cond, name) {
    console.log(`${cond ? '✓' : '✗'} ${name}`);
    if (!cond) failed++;
}

const PLANS = JSON.stringify({ 'חזה - כתפיים': [{ name: 'Bench Press (Main)' }] });
const EXS = JSON.stringify([{ name: 'Bench Press (Main)' }]);

/* ── מצב רגיל ──────────────────────────────────────────────────────────── */
let d = decide(PLANS, 'map', true);
ok(d.use === 'stored' && !d.persist && !d.suspicious, 'תוכניות תקינות — נטענות, שום דבר לא נכתב');
d = decide(EXS, 'list', true);
ok(d.use === 'stored' && !d.persist, 'תרגילים תקינים — נטענים');

/* ── התקנה טרייה ───────────────────────────────────────────────────────── */
d = decide(null, 'map', false);
ok(d.use === 'defaults' && d.persist && !d.suspicious, 'התקנה טרייה — ברירות מחדל נשמרות');
d = decide(null, 'meta', false);
ok(d.persist && !d.suspicious, 'התקנה טרייה — meta ריק נשמר');

/* ── האירוע של 25.9: קריאה ריקה במכשיר עם ארכיון ─────────────────────────── */
d = decide(null, 'map', true);
ok(d.use === 'defaults' && !d.persist, 'תוכניות חסרות במכשיר עם ארכיון — ברירות המחדל לא נשמרות');
ok(d.suspicious, '...והמצב מסומן כחשוד (חוסם העלאה לענן)');
d = decide(null, 'list', true);
ok(!d.persist && d.suspicious, 'תרגילים חסרים במכשיר עם ארכיון — לא נשמרים');

/* ── ערך פגום ──────────────────────────────────────────────────────────── */
d = decide('{"חזה - כתפיים": [', 'map', true);
ok(!d.persist && d.quarantine && d.suspicious, 'JSON חתוך — לא נדרס, נשמר עותק בצד');
d = decide('{"חזה": [', 'map', false);
ok(!d.persist && d.quarantine, 'ערך פגום לא נדרס גם כשאין ארכיון');
d = decide('{}', 'map', true);
ok(!d.persist && d.quarantine, 'אובייקט תוכניות ריק — לא נדרס');
d = decide('[]', 'list', true);
ok(!d.persist && d.quarantine, 'רשימת תרגילים ריקה — לא נדרסת');
d = decide('null', 'map', true);
ok(!d.persist && d.suspicious, 'הערך "null" — לא נדרס');
d = decide('__unreadable__', 'map', true);
ok(!d.persist && d.suspicious, 'גישה לאחסון שנכשלה — לא נדרס');
d = decide('[1,2]', 'map', true);
ok(!d.persist && d.suspicious, 'תוכניות במבנה שגוי (מערך) — לא נדרסות');

/* ── meta ───────────────────────────────────────────────────────────────── */
d = decide('{}', 'meta', true);
ok(d.use === 'stored' && !d.suspicious, 'meta ריק ({}) הוא ערך תקין');
d = decide('{"a":', 'meta', true);
ok(!d.persist && d.quarantine, 'meta פגום — לא נדרס');

if (failed) { console.error(`\n${failed} בדיקות נכשלו`); process.exit(1); }
console.log('\nכל בדיקות הגנת הטעינה עברו');
