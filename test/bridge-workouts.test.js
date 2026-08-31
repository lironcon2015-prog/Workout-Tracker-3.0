/* ============================================================================
 * test/bridge-workouts.test.js — אחסון אימוני שעון בגשר Apps Script
 * הרצה: node test/bridge-workouts.test.js   (ללא תלויות, ללא build)
 *
 * הבדיקה מריצה את הגשר האמיתי (docs/health-nutrition-bridge.gs) מול
 * PropertiesService מדומה שאוכף את **מגבלת 9KB לכל ערך** של Apps Script.
 * זו המגבלה שהפילה את התכנון הראשון (כל האימונים ב-property אחד), ולכן
 * היא נבדקת ולא מונחת: כתיבה חורגת זורקת, בדיוק כמו בשרת.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'docs', 'health-nutrition-bridge.gs'), 'utf8');

const store = {};
const LIMIT = 9216; // 9KB
let rejected = 0;
const props = {
    getProperty: k => (k in store ? store[k] : null),
    setProperty: (k, v) => { if (String(v).length > LIMIT) { rejected++; throw new Error('quota'); } store[k] = String(v); },
    deleteProperty: k => { delete store[k]; }
};
const sandbox = {
    PropertiesService: { getScriptProperties: () => props },
    Utilities: { formatDate: () => '01-01 00:00' },
    Session: { getScriptTimeZone: () => 'Asia/Jerusalem' },
    ContentService: { createTextOutput: () => ({ setMimeType: () => {} }), MimeType: {} },
    LockService: { getScriptLock: () => ({ tryLock: () => {}, releaseLock: () => {} }) },
    console
};
const fn = new Function(...Object.keys(sandbox),
    src + '\nreturn { _parseWorkout, _saveWorkout, _pruneWorkouts, _loadWorkouts, _workIndex, MAX_POINTS, SERIES_MIN_STEP };');
const B = fn(...Object.values(sandbox));

// אימון של שעתיים בגרופינג של שנייה — התרחיש הכי כבד שאפשר
function mkWorkout(startIso, durSec, stepSec) {
    const t0 = Date.parse(startIso);
    const data = [];
    for (let s = 0; s < durSec; s += stepSec) {
        const avg = Math.round(105 + 30 * Math.sin(s / 400));
        data.push({ date: new Date(t0 + s * 1000).toISOString(), Min: avg - 6, Avg: avg, Max: avg + 7, units: 'bpm' });
    }
    return { name: 'Traditional Strength Training', start: startIso,
        end: new Date(t0 + durSec * 1000).toISOString(), duration: durSec,
        activeEnergy: { qty: 612, units: 'kcal' }, avgHeartRate: { qty: 110 },
        maxHeartRate: { qty: 146 }, heartRateRecovery: { qty: 24 }, heartRateData: data };
}

let fail = 0;
const chk = (ok, msg, extra='') => { console.log(`${ok?'✓':'✗'} ${msg}${extra?' — '+extra:''}`); if(!ok) fail++; };

// ── רגרסיה: פורמט התאריך של HAE ──────────────────────────────────────────
// "2026-08-31 20:05:33 +0300" — רווח בין תאריך לשעה **ורווח נוסף** לפני ההיסט.
// `replace(' ','T')` בלי /g השאיר את הרווח השני, Date.parse החזיר NaN, וכל
// אימון נדחה בשורה הראשונה של הפרסר (נצפה בשטח: "workouts:0/skip2").
function haeDate(ms) {
    const d = new Date(ms + 3 * 3600000).toISOString();      // +03:00
    return d.slice(0, 10) + ' ' + d.slice(11, 19) + ' +0300';
}
const t0 = Date.parse('2026-08-31T17:05:33Z');
const haeWorkout = {
    name: 'Traditional Strength Training',
    start: haeDate(t0), end: haeDate(t0 + 3600000), duration: 3600,
    activeEnergy: { qty: 412, units: 'kcal' }, avgHeartRate: { qty: 110 }, maxHeartRate: { qty: 146 },
    heartRateData: [
        { date: haeDate(t0), Min: 96, Avg: 104, Max: 112, units: 'bpm' },
        { date: haeDate(t0 + 60000), Min: 100, Avg: 110, Max: 118, units: 'bpm' },
        { date: haeDate(t0 + 120000), Min: 118, Avg: 130, Max: 141, units: 'bpm' }
    ]
};
const parsedHae = B._parseWorkout(haeWorkout);
chk(!!parsedHae, 'פורמט התאריך של HAE (רווח לפני ההיסט) מתפרסר ולא נזרק');
if (parsedHae) {
    chk(parsedHae.start === t0, `start נכון (${parsedHae.start} מול ${t0})`);
    chk(parsedHae.durMin === 60, `משך 60 דק' (התקבל ${parsedHae.durMin})`);
    chk(parsedHae.activeKcal === 412, `קלוריות ${parsedHae.activeKcal}`);
    chk(parsedHae.hrSeries && parsedHae.hrSeries.length === 3,
        `סדרת דופק נקלטה (${parsedHae.hrSeries ? parsedHae.hrSeries.length : 0} נקודות)`);
}
// שם שדה חלופי
chk(!!B._parseWorkout(Object.assign({}, haeWorkout, { start: undefined, end: undefined,
    startDate: haeDate(t0), endDate: haeDate(t0 + 3600000) })), 'startDate/endDate כשם חלופי');


// 1. שעתיים @ 1 שנייה = 7200 דגימות גולמיות
const heavy = B._parseWorkout(mkWorkout('2026-08-29T10:00:00Z', 7200, 1));
chk(heavy.hrSeries.length <= B.MAX_POINTS, `דילול אדפטיבי: 7200 דגימות → ${heavy.hrSeries.length} נקודות (תקרה ${B.MAX_POINTS})`);
const heavyBytes = JSON.stringify(heavy).length;
chk(heavyBytes < 8800, `רשומת שעתיים = ${heavyBytes} בתים`, '< 8800');
chk(B._saveWorkout(heavy), 'נשמרה בלי לחרוג ממגבלת ה-property');

// 2. אימון רגיל 77 דק' @ 5 שניות
const normal = B._parseWorkout(mkWorkout('2026-08-28T08:00:00Z', 77*60, 5));
chk(normal.hrSeries.length === Math.ceil(77*60 / B.SERIES_MIN_STEP), `77 דק' @5ש' → ${normal.hrSeries.length} נקודות במרווח ${B.SERIES_MIN_STEP}ש'`);
chk(JSON.stringify(normal).length < 5000, `רשומה רגילה = ${JSON.stringify(normal).length} בתים`);
B._saveWorkout(normal);

// 3. גרופינג גס מ-30ש' — הגשר לא ממציא נקודות
const coarse = B._parseWorkout(mkWorkout('2026-08-27T08:00:00Z', 60*60, 300));
chk(coarse.hrSeries.length === 12, `גרופינג 5 דק' → ${coarse.hrSeries.length} נקודות בלבד (הגשר לא מסמיך רזולוציה)`);

// 4. גיזום ל-MAX_WORKOUTS + סך המאגר
for (let i = 0; i < 60; i++) {
    const d = new Date(Date.UTC(2026, 5, 1) + i * 86400000).toISOString();
    B._saveWorkout(B._parseWorkout(mkWorkout(d, 70*60, 10)));
}
B._pruneWorkouts();
chk(B._workIndex().length === 40, `גיזום ל-40 אימונים (התקבל ${B._workIndex().length})`);
const total = Object.entries(store).reduce((a,[k,v]) => a + k.length + v.length, 0);
chk(total < 500000, `סך המאגר = ${Math.round(total/1024)}KB`, '< 500KB');
const maxProp = Math.max(...Object.values(store).map(v => v.length));
chk(maxProp < 9216, `ה-property הגדול ביותר = ${maxProp} בתים`, '< 9216');
chk(rejected === 0, `אפס כתיבות שנדחו על מכסה (${rejected})`);

// 5. חלון ההחזרה
const recent = B._loadWorkouts(21);
chk(recent.every(w => Date.parse(w.id) >= Date.now() - 21*86400000), `doGet מחזיר רק את החלון (${recent.length} רשומות)`);

console.log(fail ? `\n${fail} נכשלו` : '\nהכל עבר');
process.exit(fail ? 1 : 0);
