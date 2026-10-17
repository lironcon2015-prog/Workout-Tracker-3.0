/* ============================================================================
 * test/plan-rename.test.js — שינוי שם תוכנית לא מנתק את ההיסטוריה שלה
 * הרצה: node test/plan-rename.test.js   (ללא תלויות, ללא build)
 *
 * באג: שינוי שם מחק את התוכנית ויצר חדשה; הארכיון נשאר על entry.type הישן, ולכן
 * "הבא בתור" ראה את התוכנית כמי שמעולם לא בוצעה. בלוק PLANRENAME ב-editor-logic.js.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'editor-logic.js'), 'utf8');
const block = src.split('PLANRENAME-START')[1]?.split('PLANRENAME-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק PLANRENAME לא נמצא ב-editor-logic.js'); process.exit(1); }
const { _planRenameKey, _planRenameArchive, _planRenameAliases } =
    new Function(block + '\nreturn { _planRenameKey, _planRenameArchive, _planRenameAliases };')();

let failed = 0;
function ok(cond, name) {
    console.log(`${cond ? '✓' : '✗'} ${name}`);
    if (!cond) failed++;
}

const OLD = 'רוטינת גב', NEW = 'גב - רגליים';

/* ── סדר התוכניות נשמר ─────────────────────────────────────────────────── */
const plans = { 'כתפיים - חזה': [1], [OLD]: [2], 'חזה - כתפיים': [3], 'רגליים - גב': [4] };
const p2 = _planRenameKey(plans, OLD, NEW);
ok(Object.keys(p2).join('|') === ['כתפיים - חזה', NEW, 'חזה - כתפיים', 'רגליים - גב'].join('|'), 'התוכנית נשארת באותו מיקום ברשימה');
ok(p2[NEW][0] === 2 && !(OLD in p2), 'התוכן עבר לשם החדש, השם הישן לא קיים');
ok(_planRenameKey(plans, 'אין כזה', NEW) === plans, 'שם שלא קיים — אין שינוי');
ok(_planRenameKey(plans, OLD, OLD) === plans, 'אותו שם — אין שינוי');

/* ── הארכיון עובר לשם החדש ─────────────────────────────────────────────── */
const archive = [
    { timestamp: 3, type: 'רגליים - גב', date: '17.10.26' },
    { timestamp: 2, type: OLD, date: '06.10.26', details: { 'Lat Pulldown': { sets: ['70kg x 10'] } } },
    { timestamp: 1, type: OLD, date: '29.09.26' },
];
const r = _planRenameArchive(archive, OLD, NEW);
ok(r.n === 2,                                              'שני אימונים עודכנו');
ok(r.archive[1].type === NEW && r.archive[2].type === NEW, 'type עודכן לשם החדש');
ok(r.archive[1].typeRenamedFrom === OLD,                    'השם הקודם נשמר לשחזור');
ok(r.archive[1].details['Lat Pulldown'].sets[0] === '70kg x 10' && r.archive[1].date === '06.10.26', 'סטים ותאריך לא שונו');
ok(r.archive[0] === archive[0],                             'אימון של תוכנית אחרת לא נוגע');
ok(archive[1].type === OLD,                                 'הקלט לא שונה (טהורה)');
const r2 = _planRenameArchive(r.archive, NEW, 'גב');
ok(r2.archive[1].typeRenamedFrom === OLD,                   'שינוי שם שני שומר את השם המקורי הראשון');

/* ── "הבא בתור" מוצא את ההיסטוריה (כמו _edLastDone) ──────────────────────── */
const lastDone = (arc, key) => { const h = arc.find(a => a && a.type === key); return h ? h.timestamp : null; };
ok(lastDone(archive, NEW) === null,                         'בלי העדכון — התוכנית נראית כמי שמעולם לא בוצעה (הבאג)');
ok(lastDone(r.archive, NEW) === 2,                          'אחרי העדכון — הביצוע האחרון נמצא');

/* ── קבוצות האנליטיקה ───────────────────────────────────────────────────── */
const al = _planRenameAliases({ 'גב': [OLD, 'Pull'], 'רגליים': ['רגליים - גב'] }, OLD, NEW);
ok(al.changed && al.aliases['גב'].join('|') === `${NEW}|Pull`, 'קבוצה שהכילה את השם הישן עודכנה');
ok(al.aliases['רגליים'].join('|') === 'רגליים - גב',          'קבוצה אחרת לא נוגעת');
ok(_planRenameAliases({ x: [NEW, OLD] }, OLD, NEW).aliases.x.length === 1, 'אין כפילות אם השם החדש כבר בקבוצה');
ok(_planRenameAliases(null, OLD, NEW).changed === false,      'בלי קבוצות — לא קריסה');

console.log(failed ? `\n${failed} נכשלו` : '\nהכול עבר');
process.exit(failed ? 1 : 0);
