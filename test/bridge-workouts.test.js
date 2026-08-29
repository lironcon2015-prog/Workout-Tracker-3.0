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
