/* ============================================================================
 * test/unified-compact.test.js — דחיסת הקובץ המאוחד: חסרת-אובדן
 * הרצה: node test/unified-compact.test.js   (ללא תלויות, ללא build)
 *
 * הרקע: הקובץ המאוחד הגיע ל-2.8MB — הזחה, אימון ששמור שלוש פעמים (log /
 * details.sets / summary) ושמות שדות שחוזרים בכל פריט מזון. הדחיסה משמיטה את
 * מה שנגזר מ-log, ולכן הסכנה היא שקטה: סיכום שלא משתחזר זהה = תוכן שאבד.
 * הבדיקה מוודאת ש-_uniDecode(_uniCompactPayload(x)) מחזיר את x בדיוק, שסיכום
 * שאינו נגזר נשאר מלא, ושהדחיסה באמת מקטינה.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const bl = fs.readFileSync(path.join(root, 'bodylog-logic.js'), 'utf8');
const block = bl.split('UNI-COMPACT-START')[1]?.split('UNI-COMPACT-END')[0];
if (!block) { console.error('✗ בלוק UNI-COMPACT לא נמצא ב-bodylog-logic.js'); process.exit(1); }

// פונקציות התיעוד האמיתיות מ-workout-core.js (לא העתקה) — חילוץ לפי סוגריים
const core = fs.readFileSync(path.join(root, 'workout-core.js'), 'utf8');
function fnSrc(name) {
    const i = core.indexOf('function ' + name + '(');
    if (i < 0) throw new Error('missing ' + name);
    for (let k = core.indexOf('{', i), dep = 0; k < core.length; k++) {
        if (core[k] === '{') dep++;
        else if (core[k] === '}' && !--dep) return core.slice(i, k + 1);
    }
}
const arrow = core.match(/const DROP_ARROW = '([^']+)'/)[1];
const api = new Function(`const DROP_ARROW = '${arrow}';\n` +
    ['_fmtW', '_groupSetsWithDrops', '_setLineText'].map(fnSrc).join('\n') + block +
    '\nreturn { _uniCompactPayload, _uniDecode, _uniCanon, h: { setLineText: _setLineText, groupDrops: _groupSetsWithDrops, fmtW: _fmtW, dropArrow: DROP_ARROW } };')();
const { _uniCompactPayload, _uniDecode, _uniCanon, h } = api;

let failed = 0;
function ok(cond, name) { console.log(`${cond ? '✓' : '✗'} ${name}`); if (!cond) failed++; }

const ts = new Date(2026, 10, 14, 11, 55).getTime();
const L = (exName, w, r, rir, x) => Object.assign({ exName, w, r, rir, note: '', isCluster: false, round: null, skip: false }, x || {});
const log = [
    L('Bench Press', 80, 8, '2', { note: '[עצירה]' }),
    L('Bench Press', 64, 6, '1', { drop: 1 }),
    L('Bench Press', 80, 7, 1.5),
    L('Leg Curl', 30, 8, '2'),
    L('Leg Curl', 0, 0, '2', { skip: true }),
    L('Pull Ups', 0, 12, '3', { isCluster: true, round: 1, wm: 'bw' }),
    L('Y Raises', 9, 12, '1.5', { isCluster: true, round: 1 }),
    L('Pull Ups', 0, 10, '3', { isCluster: true, round: 2, wm: 'bw' }),
    L('Y Raises', 4, 12, '1.5', { isCluster: true, round: 2, wm: 'plates' }),
    L('Face Pull', 0, 0, '2', { skip: true })
];
const summary = [
    'GYMPRO ELITE SUMMARY', 'חזה - גב | Week 3 | 14.11.2026 | 67m', '',
    'הערה: יום טוב', '',
    'Bench Press (Main, TM: 100kg) (Vol: 1.6t):', 'הערת תרגיל: אחיזה רחבה',
    `80kg x 8 (RIR 2) | Note: [עצירה] ${arrow} 64kg x 6 (RIR 1)`, '80kg x 7 (RIR 1.5)', '',
    'Leg Curl (צד אחד) (Vol: 480kg):', '30kg x 8 (RIR 2)', '(Skipped)', '',
    'Cluster סבב 1:', '  Pull Ups: BW x 12 (RIR 3)', '  Y Raises: 9kg x 12 (RIR 1.5)', '',
    'Cluster סבב 2:', '  Pull Ups: BW x 10 (RIR 3)', '  Y Raises: 4 פלטות x 12 (RIR 1.5)', '',
    'Face Pull: (Skipped)'
].join('\n');
const strength = {
    timestamp: ts, date: '2026-11-14', time: '11:55', type: 'חזה - גב', week: 3, duration: 67, note: 'יום טוב',
    summary,
    details: {
        'Bench Press': { sets: [`80kg x 8 (RIR 2) | Note: [עצירה] ${arrow} 64kg x 6 (RIR 1)`, '80kg x 7 (RIR 1.5)'], vol: 1600, note: 'אחיזה רחבה' },
        'Leg Curl': { sets: ['30kg x 8 (RIR 2)'], vol: 480 },
        'Pull Ups': { sets: ['BW x 12 (RIR 3)', 'BW x 10 (RIR 3)'], vol: 0 },
        'Y Raises': { sets: ['9kg x 12 (RIR 1.5)', '4 פלטות x 12 (RIR 1.5)'], vol: 228 },
        'Face Pull': { sets: [], vol: 0 }
    },
    exOrder: ['Bench Press', 'Leg Curl', 'Pull Ups', 'Y Raises', 'Face Pull'],
    log, rmValues: {}, nutritionalState: 'cut',
    watch: { hrAvg: 118, hrSeries: [[4, 100, 106, 109]] }
};
// שם התוכנית שונה אחרי האימון — הכותרת בסיכום שונה מ-type
const renamed = Object.assign({}, strength, { timestamp: ts + 1, type: 'גב - רגליים',
    summary: summary.replace('חזה - גב | Week 3', 'רוטינת גב | Week 3') });
// סיכום שנערך ידנית (שורות נוספות) — אינו נגזר, חייב להישאר מלא
const edited = Object.assign({}, strength, { timestamp: ts + 2, summary: summary + '\n\nשורה שנוספה ידנית' });
// סט שנערך בארכיון — details.sets כבר לא תואם ל-log, חייב להישאר
const editedSets = JSON.parse(JSON.stringify(strength));
editedSets.timestamp = ts + 3; editedSets.details['Leg Curl'].sets = ['32kg x 8 (RIR 2)'];
const noLog = { timestamp: ts + 4, type: 'ישן', summary: 'GYMPRO ELITE SUMMARY\nישן', details: { A: { sets: ['1kg x 1'], vol: 1 } } };
const cardio = { timestamp: ts + 5, kind: 'cardio', type: 'אופניים', summary: 'CARDIO 30m', details: {}, log: [L('Bike', 0, 0, '')] };

const nutrition = [
    { date: '2026-11-14', source: 'app', totals: { calories: 500 }, meals: [
        { meal: 'בוקר', items: [{ name: 'יוגורט', brand: 'Go', grams: 200, kcal: 126, protein: 20, carbs: 6.4, fat: 2 }] },
        { meal: 'צהריים', items: [
            { name: 'צלחת', brand: 'מנה', grams: 350, kcal: 81, protein: 3.1, carbs: 15.4, fat: 0.8, fiber: 4.9, fiberPartial: true,
              components: [{ name: 'מלפפון', grams: 100, kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5 },
                           { name: 'פלפל', grams: 150, kcal: 47, protein: 1.5, carbs: 9, fat: 0.5 }] },
            { name: 'שמן', brand: '', kcal: 35, protein: 0, carbs: 0, fat: 4 }] },
        { meal: 'ערב', items: [] }
    ] },
    { date: '2026-11-13', source: 'mfp', totals: { calories: 300 }, meals: [
        { meal: 'Lunch', items: [{ name: '', kcal: 300, protein: 20, carbs: 30, fat: 10, time: '7:30 AM',
            micros: { 'Saturated Fat': 1.8, 'Sodium (mg)': 50, Fiber: 0, Iron: 0, 'Vitamin D': 2 } }] }
    ] },
    { date: '2026-11-12', source: 'summary', totals: { calories: 2000 }, meals: [] }
];

const payload = { app: 'GYMPRO ELITE', type: 'unified_export', readme: ['x'], counts: { workouts: 6 },
    weights: [{ date: '2026-11-14', weight: 80 }], nutrition_daily: [], nutrition_detailed: nutrition,
    workouts: [strength, renamed, edited, editedSets, noLog, cardio], sleep_recovery: [], memory_box: [] };
const orig = JSON.parse(JSON.stringify(payload));

const compact = JSON.parse(JSON.stringify(_uniCompactPayload(payload, h)));
const back = _uniDecode(compact, h);
ok(_uniCanon(payload) === _uniCanon(orig), 'הדחיסה אינה משנה את הקלט');
ok(_uniCanon(back) === _uniCanon(orig), 'פענוח מחזיר את כל הקובץ זהה למקור');

const [cS, cR, cE, cES, cN, cC] = compact.workouts;
ok(!('summary' in cS) && !('sets' in cS.details['Bench Press']), 'אימון נגזר: summary ו-details.sets מושמטים');
ok(cS.exTags && cS.exTags['Bench Press'] === ' (Main, TM: 100kg)' && cS.exTags['Leg Curl'] === ' (צד אחד)', 'תגיות Main/TM/צד אחד נשמרות ב-exTags');
ok(Array.isArray(cS.log[0]) && cS.log[0].length === 5 && cS.log[3].length === 4, 'log בשורות; ברירות מחדל לא נכתבות');
ok(!('summary' in cR) && cR.summaryFix && Object.keys(cR.summaryFix).length === 1, 'שם תוכנית שהשתנה: תיקון שורה אחת במקום סיכום מלא');
ok(cE.summary === edited.summary, 'סיכום שנערך ידנית נשאר מלא');
ok(cES.details['Leg Curl'].sets && cES.details['Leg Curl'].sets[0] === '32kg x 8 (RIR 2)' && !('sets' in cES.details['Bench Press']),
   'details.sets שנערך נשאר; השאר מושמט');
ok(_uniCanon(cN) === _uniCanon(noLog), 'אימון בלי log — ללא שינוי');
ok(cC.summary === 'CARDIO 30m', 'אירובי — summary נשאר');

const day0 = compact.nutrition_detailed[0];
ok(Array.isArray(day0.meals[0]) && day0.meals[0][0] === 'בוקר' && Array.isArray(day0.meals[0][1][0]), 'ארוחות ופריטים בשורות');
ok(day0.meals[2][0] === 'ערב' && day0.meals[2][1].length === 0, 'ארוחה ריקה נשמרת');
ok(Array.isArray(compact.nutrition_detailed[1].meals[0][1][0].slice(-1)[0].micros), 'micros בשורה לפי micros_cols');
ok(!JSON.stringify(compact).includes('"Saturated Fat":'), 'מפתחות micros לא חוזרים בכל פריט');

// הקלט הלא-דחוס כבר — פענוח קובץ ישן (בלי format) מחזיר אותו כמו שהוא
ok(_uniDecode(orig, h) === orig, 'קובץ בלי format — הפענוח לא נוגע');
// בלי פונקציות התיעוד — האימונים לא נדחסים, התזונה כן, והפענוח עדיין מלא
const noH = JSON.parse(JSON.stringify(_uniCompactPayload(orig, null)));
ok(_uniCanon(noH.workouts) === _uniCanon(orig.workouts) && _uniCanon(_uniDecode(noH, null)) === _uniCanon(orig), 'בלי helpers: אימונים מלאים, פענוח זהה');

const before = JSON.stringify(orig, null, 2).length, after = JSON.stringify(compact).length;
ok(after < before * 0.5, `הקובץ קטן ביותר מחצי (${before} → ${after})`);

if (failed) { console.error(`\n${failed} בדיקות נכשלו`); process.exit(1); }
console.log('\nכל הבדיקות עברו');
