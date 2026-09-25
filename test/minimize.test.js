/* ============================================================================
 * test/minimize.test.js — מזעור אימון פעיל: השמירה בצד של ערימת הניווט
 * הרצה: node test/minimize.test.js   (ללא תלויות, ללא build)
 *
 * הרקע: switchMainTab מאפס את state.historyStack, ו-restoreSession קובע לפי
 * הערימה הזו לאיזה מסך אימון לחזור. מזעור נאיבי (פשוט לנווט לטאב) מאבד את
 * המיקום באימון: אחרי קריסה השחזור נוחת בארכיון, לא בתרגיל. הבדיקה מדמה את
 * switchMainTab ומוודאת שהערימה של האימון שורדת מזעור, מעבר טאבים, מזעור כפול
 * ושחזור אחרי "קריסה" (JSON round-trip כמו localStorage).
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'workout-core.js'), 'utf8');
const block = src.split('MINIMIZE-START')[1]?.split('MINIMIZE-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק MINIMIZE לא נמצא ב-workout-core.js'); process.exit(1); }

const api = new Function(block + '\nreturn { _minCanMinimize, _minStash, _minUnstash, _minNeedsRefresh, MINIMIZABLE_SCREENS };')();
const { _minCanMinimize, _minStash, _minUnstash, _minNeedsRefresh } = api;

let failed = 0;
function ok(cond, name) {
    console.log(`${cond ? '✓' : '✗'} ${name}`);
    if (!cond) failed++;
}

const WORKOUT_STACK = ['ui-week', 'ui-workout-type', 'ui-confirm', 'ui-main'];
function mkState(extra) {
    return Object.assign({
        workoutStartTime: 1000, historyStack: WORKOUT_STACK.slice(),
        log: [{ exName: 'Bench', w: 80, r: 8 }], currentExName: 'Bench', minimized: null
    }, extra || {});
}
// מה ש-switchMainTab עושה לערימה (navigate(id, true))
const switchTab = (st, id) => { st.historyStack = [id]; };
const roundTrip = st => JSON.parse(JSON.stringify(st));

/* ── מזעור → טאבים → חזרה ─────────────────────────────────────────────── */
let st = mkState();
ok(_minCanMinimize(st, 'ui-main'), 'אפשר למזער ממסך התרגיל באימון פעיל');
ok(_minStash(st), 'השמירה בצד מצליחה');
switchTab(st, 'ui-week'); switchTab(st, 'ui-archive'); switchTab(st, 'ui-bodylog');
ok(_minUnstash(st) === 'ui-main', 'החזרה נוחתת על מסך התרגיל אחרי מעבר בין טאבים');
ok(JSON.stringify(st.historyStack) === JSON.stringify(WORKOUT_STACK), 'כל ערימת האימון שוחזרה');
ok(st.minimized === null, 'השמירה בצד נוקתה אחרי החזרה');

/* ── מזעור כפול לא דורס ────────────────────────────────────────────────── */
st = mkState();
_minStash(st); switchTab(st, 'ui-week');
ok(_minStash(st) === false, 'מזעור שני נדחה');
ok(_minUnstash(st) === 'ui-main', 'מזעור כפול לא דרס את ערימת האימון בערימת הבית');

/* ── קריסה בזמן מזעור: localStorage round-trip ────────────────────────────── */
st = mkState({ historyStack: ['ui-week', 'ui-workout-type', 'ui-confirm', 'ui-cluster-rest'] });
_minStash(st); switchTab(st, 'ui-archive');
const booted = roundTrip(st);          // מה ש-restoreSession קורא מ-KEY_SESSION
ok(booted.historyStack[0] === 'ui-archive', 'בלי שחזור — הערימה השמורה מצביעה על הארכיון (הבאג שנמנע)');
ok(_minUnstash(booted) === 'ui-cluster-rest', 'אחרי קריסה, השחזור חוזר למסך מנוחת הסבב');
ok(booted.log.length === 1 && booted.log[0].w === 80, 'הלוג שרד את הקריסה');

/* ── חסימות ────────────────────────────────────────────────────────────── */
ok(!_minCanMinimize(mkState({ workoutStartTime: null }), 'ui-main'), 'אין מזעור בלי אימון שהתחיל');
ok(!_minCanMinimize(mkState({ historyStack: ['ui-week', 'ui-summary'] }), 'ui-summary'), 'אין מזעור ממסך הסיכום (כבר נשמר)');
ok(!_minCanMinimize(mkState({ historyStack: ['ui-week', 'ui-cardio-setup'] }), 'ui-cardio-setup'), 'אין מזעור ממסך ההכנה לאירובי');
ok(!_minCanMinimize(mkState({ historyStack: ['ui-week', 'ui-cardio'], cardio: { phase: 'done' } }), 'ui-cardio'), 'אין מזעור מאירובי שהסתיים');
ok(_minCanMinimize(mkState({ historyStack: ['ui-week', 'ui-cardio'], cardio: { phase: 'work' } }), 'ui-cardio'), 'אפשר למזער אירובי באמצע סבב');
ok(!_minCanMinimize(mkState({ historyStack: ['ui-week', 'ui-archive'] }), 'ui-main'), 'אין מזעור כשהערימה לא מצביעה על המסך הנראה');
st = mkState(); _minStash(st);
ok(!_minCanMinimize(st, 'ui-main'), 'אין מזעור כשכבר ממוזער');

/* ── חזרה בלי שמירה / שמירה פגומה ─────────────────────────────────────── */
st = mkState();
ok(_minUnstash(st) === null, 'חזרה בלי מזעור — לא עושה כלום');
st = mkState({ minimized: { stack: [] } });
ok(_minUnstash(st) === null && st.minimized === null, 'שמירה ריקה — מתנקה בלי לשבור את הערימה');
ok(JSON.stringify(st.historyStack) === JSON.stringify(WORKOUT_STACK), 'ערימה קיימת לא נדרסה משמירה ריקה');

/* ── שינוי מהשעון בזמן מזעור ──────────────────────────────────────────── */
st = mkState(); _minStash(st);
const m = st.minimized;
ok(!_minNeedsRefresh(m, st), 'בלי שינוי — אין רענון');
st.log.push({ exName: 'Bench', w: 80, r: 7 });
ok(_minNeedsRefresh(m, st), 'סט מהשעון — המסך מתרענן בחזרה');
st = mkState(); _minStash(st); const m2 = st.minimized; st.currentExName = 'OHP';
ok(_minNeedsRefresh(m2, st), 'השעון עבר לתרגיל הבא — המסך מתרענן בחזרה');

if (failed) { console.error(`\n${failed} בדיקות נכשלו`); process.exit(1); }
console.log('\nכל בדיקות המזעור עברו');
