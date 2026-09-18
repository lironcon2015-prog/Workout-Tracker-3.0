/* ============================================================================
 * test/readiness-freeze.test.js — הקפאת מוכנות הבוקר ברשומת האימון
 * הרצה: node test/readiness-freeze.test.js   (ללא תלויות, ללא build)
 *
 * הרקע: ה-RHR וה-HRV מ-Apple Health ממשיכים להתעדכן לאורך היום, ולכן חישוב
 * חי של יום נתון אינו יציב עד סופו. באותו ערב (18.9) הכרטיס הראה RHR 51 וציון
 * 78 ("מוכן") ואילו ייצוא הפרומפטים הראה RHR 55 וציון 65 ("בינוני") — שני צדי
 * הסף 66, כלומר שתי מסקנות אימוניות שונות מאותו נתון גולמי.
 *
 * הבדיקה נכשלת על הקוד הישן: שם לא הייתה הקפאה כלל, ושורת המניעים כתבה
 * "+26ms מול baseline" בלי הבסיס שממנו הדלתא נגזרה.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'workout-core.js'), 'utf8');
const block = src.split('READINESSFREEZE-START')[1]?.split('READINESSFREEZE-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק READINESSFREEZE לא נמצא ב-workout-core.js'); process.exit(1); }

// הספים נטענים מ-bodylog-logic.js — מקור אמת אחד לרצועה ולצבע, בלי העתקה לבדיקה
const bl = fs.readFileSync(path.join(__dirname, '..', 'bodylog-logic.js'), 'utf8');
const bandSrc = bl.match(/function _rdBand\(score\)[^\n]*\n?/);
const colorSrc = bl.match(/function _rdColor\(score\)[^\n]*\n?/);
if (!bandSrc || !colorSrc) { console.error('✗ _rdBand/_rdColor לא נמצאו ב-bodylog-logic.js'); process.exit(1); }

const api = new Function(
    bandSrc[0] + colorSrc[0] + block +
    '\nreturn { _readinessSnapshot, _readinessThaw, _rdDriversLine, _rdBand, _rdColor, RD_SNAP_VER };'
)();
const { _readinessSnapshot, _readinessThaw, _rdDriversLine, _rdBand } = api;

let failed = 0;
function ok(cond, name) {
    console.log(`${cond ? '✓' : '✗'} ${name}`);
    if (!cond) failed++;
}

/* ── תמונה חיה כפי ש-computeReadiness מחזיר אותה ─────────────────────────── */
const liveRd = {
    score: 78, band: 'מוכן', color: 'var(--success)', building: false,
    usedCount: 5, totalCount: 5, missingLabels: [],
    drivers: [
        { label: 'HRV',         valTxt: '85ms', baseTxt: '62ms', delta: '+23ms', dir: 'up' },
        { label: 'דופק מנוחה',  valTxt: '51',   baseTxt: '54',   delta: '-3',    dir: 'up' },
        { label: 'שינה',        delta: '7:12',  baseTxt: '6:48', dir: 'up' }
    ],
    vitals: [
        { label: 'HRV',         valTxt: '85ms', baseTxt: '62ms', delta: '+23ms', dir: 'up' },
        { label: 'דופק מנוחה',  valTxt: '51',   baseTxt: '54',   delta: '-3',    dir: 'up' },
        { label: 'נשימה',       valTxt: '14.2', baseTxt: '14.6', delta: '-0.4',  dir: 'up' },
        { label: 'שינה',        delta: '7:12',  baseTxt: '6:48', dir: 'up' },
        { label: 'טמפ׳',        delta: '+0.1°', dir: 'up' }
    ]
};
const night = { date: '2026-09-18', asleepMin: 432, efficiency: 0.93, deepMin: 61, remMin: 98 };

const snap = _readinessSnapshot(liveRd, night);

ok(snap != null,                         'תמונה תקינה מייצרת snapshot');
ok(snap.score === 78 && snap.band === 'מוכן', 'הציון והרצועה נשמרים כפי שהם');
ok(snap.used === 5 && snap.total === 5,  'used/total נשמרים');
ok(snap.date === '2026-09-18',           'תאריך הלילה נשמר');
ok(snap.sleepMin === 432,               'משך השינה נשמר (הגלולה בכרטיס)');
ok(snap.vitals.length === 5,            'כל חמשת המדדים נשמרים — לא רק שלושת המניעים');
ok(snap.drivers.length === 3,           'המניעים נשמרים בנפרד (שלושת החזקים)');

/* ── כשל שקט 1: הקפאה של מה שאינו קיים ───────────────────────────────────── */
ok(_readinessSnapshot({ building: true, have: 9, need: 14 }, night) === null,
   'baseline בבנייה — אין חריתה, כדי שהניסיון יחזור');
ok(_readinessSnapshot({ score: null, building: false }, night) === null,
   'ציון null — אין חריתה');
ok(_readinessSnapshot(null, night) === null, 'בלי rd — null ולא קריסה');

/* ── כשל שקט 2: גבול Firestore — undefined ומערך בתוך מערך ───────────────── */
function scan(v, trail, bad) {
    if (v === undefined) { bad.push(trail + ' = undefined'); return; }
    if (Array.isArray(v)) {
        v.forEach((x, i) => {
            if (Array.isArray(x)) bad.push(trail + '[' + i + '] = מערך בתוך מערך');
            scan(x, trail + '[' + i + ']', bad);
        });
        return;
    }
    if (v && typeof v === 'object') Object.keys(v).forEach(k => scan(v[k], trail + '.' + k, bad));
}
const bad = [];
scan(snap, 'readiness', bad);
ok(bad.length === 0, 'ה-snapshot עובר את Firestore (אין undefined, אין מערך בתוך מערך)' +
                     (bad.length ? ' — ' + bad.join(', ') : ''));
ok(JSON.parse(JSON.stringify(snap)).vitals[4].label === 'טמפ׳',
   'שורה בלי val/base שורדת סריאליזציה (טמפ׳ — delta בלבד)');

/* ── ההפשרה מחזירה בדיוק את מה שהחזיתות מצפות לו ─────────────────────────── */
const thawed = _readinessThaw(snap);
ok(thawed != null && thawed.frozen === true, 'הפשרה מסומנת כמוקפאת');
ok(thawed.rd.score === 78 && thawed.rd.band === 'מוכן', 'ציון ורצועה חוזרים זהים');
ok(thawed.rd.color === 'var(--success)', 'הצבע נגזר מהציון (לא נשמר)');
ok(thawed.rd.building === false,         'מוקפא לעולם אינו building');
ok(thawed.night.asleepMin === 432,       'הלילה המופשר נושא את משך השינה');
ok(thawed.rd.drivers[0].valTxt === '85ms' && thawed.rd.drivers[0].baseTxt === '62ms',
   'המניע חוזר עם valTxt/baseTxt — הצורה שהכרטיס והייצוא קוראים');
ok(thawed.rd.drivers[2].valTxt === undefined && thawed.rd.drivers[2].baseTxt === '6:48',
   'מניע "שינה" חוזר בלי valTxt (ה-delta שלו הוא המשך עצמו)');
ok(thawed.rd.vitals.length === 5,        'כל המדדים חוזרים בהפשרה');
ok(_readinessThaw(null) === null && _readinessThaw({}) === null,
   'רשומה ישנה בלי readiness — null, כדי שייפול לחישוב חי');

/* ── היציבות עצמה: שתי שליפות בשעות שונות מחזירות אותו דבר ───────────────── */
const again = _readinessThaw(JSON.parse(JSON.stringify(snap)));
ok(JSON.stringify(again.rd) === JSON.stringify(thawed.rd),
   'הפשרה חוזרת — אותו ציון, אותה רצועה, אותם ערכים (הבאג המקורי)');
ok(_rdBand(78) === 'מוכן' && _rdBand(65) === 'בינוני' && _rdBand(33) === 'נמוך',
   'ספי הרצועה: 66 ו-34 — נגזרים מהציון בלבד');

/* ── שורת המניעים: delta תמיד לצד הבסיס שממנו נגזר ───────────────────────── */
const line = _rdDriversLine(thawed.rd.drivers);
console.log('\n' + line + '\n');
ok(line.includes('HRV 85ms (בסיס 62ms · +23ms)'),
   'HRV נכתב עם הבסיס שלו — "+26ms מול baseline" בלי בסיס היה הבאג');
ok(!/מול baseline/.test(line), 'המילה baseline אינה מופיעה לבדה בלי מספר');
ok(line.includes('דופק מנוחה 51 (בסיס 54 · -3)'), 'דופק מנוחה — ערך, בסיס ודלתא מאותה שליפה');
ok(line.includes('שינה 7:12 (בסיס 6:48)'), 'שינה — משך מול החציון האישי, בלי valTxt');
ok(_rdDriversLine([{ label: 'טמפ׳', delta: '+0.1°', dir: 'up' }]) === 'טמפ׳ +0.1°',
   'מדד בלי בסיס — delta לבדו, בלי סוגריים ריקים');
ok(_rdDriversLine([]) === '' && _rdDriversLine(null) === '', 'אין מניעים — מחרוזת ריקה');

/* ── delta == val − base, על המספרים עצמם ────────────────────────────────── */
const num = t => parseFloat(String(t).replace(/[^\d.+-]/g, ''));
thawed.rd.vitals.filter(v => v.valTxt && v.baseTxt && /^[+-]/.test(v.delta)).forEach(v => {
    const d = Math.round((num(v.valTxt) - num(v.baseTxt)) * 10) / 10;
    ok(Math.abs(d - num(v.delta)) < 0.05, `${v.label}: delta == val − base (${v.valTxt} − ${v.baseTxt} = ${v.delta})`);
});

/* ── פרומפט 8: איסור ערכים מדידים בזיכרון ────────────────────────────────── */
const tpl = src.split('const COACH_MEMORY_TPL =')[1]?.split('=== זיכרון קיים ===')[0] || '';
ok(/אל תשמור בזיכרון ערך מדיד/.test(tpl), 'COACH_MEMORY_TPL אוסר במפורש ערכים מדידים');
['TDEE', 'TM', 'משקל', '1RM'].forEach(k =>
    ok(tpl.includes(k), `האיסור מונה במפורש: ${k}`));
ok(/מחק אותו/.test(tpl), 'התבנית מורה למחוק ערך מדיד שכבר בזיכרון (ניקוי בהרצה הראשונה)');

console.log(failed ? `\n${failed} נכשלו` : '\nכל הבדיקות עברו');
process.exit(failed ? 1 : 0);
