/* ============================================================================
 * test/zero-vitals.test.js — ויטל חסר נשמר כשדה חסר, לא כ-0
 * הרצה: node test/zero-vitals.test.js   (ללא תלויות, ללא build)
 *
 * הבאג (דווח ע"י מאמן ה-Claude, 27.9): לילה בלי מדידת RHR נשמר ב-SLEEP_DAILY עם rhr:0,
 * ומשם יצא לקובץ המאוחד ולדרייב כ"דופק מנוחה 0". הציון והבסיס מסננים אותו
 * (_validVital), אבל הרשומה עצמה שיקרה. נבדקים: הבלוק הטהור ZEROVITAL, והמסלול
 * האמיתי — StorageManager.mergeSleepDays ו-cleanZeroVitals מתוך storage.js עצמו.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let failed = 0;
function eq(a, b, name) {
    const ok = JSON.stringify(a) === JSON.stringify(b);
    if (!ok) failed++;
    console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    צפוי:  ${JSON.stringify(b)}\n    התקבל: ${JSON.stringify(a)}`}`);
}

const src = fs.readFileSync(path.join(__dirname, '..', 'storage.js'), 'utf8');
const block = src.split('ZEROVITAL-START')[1]?.split('ZEROVITAL-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק ZEROVITAL לא נמצא ב-storage.js'); process.exit(1); }
const { _stripZeroVitals } = new Function(block + '\nreturn { _stripZeroVitals };')();

// 1. הבלוק הטהור
const n1 = { date: '2026-09-27', rhr: 0, hrv: 78, respRate: 13, asleepMin: 507 };
eq(_stripZeroVitals(n1), 1, 'rhr:0 — שדה אחד נמחק');
eq(n1, { date: '2026-09-27', hrv: 78, respRate: 13, asleepMin: 507 }, 'rhr נמחק, השאר ללא שינוי');
const n2 = { date: 'x', hrv: -1, respRate: NaN, wristTempDev: 0, rhr: null };
eq(_stripZeroVitals(n2), 4, 'שלילי / NaN / 0 בטמפ\' / null — כולם נמחקים');
eq(n2, { date: 'x' }, 'לא נשאר ויטל פגום');
const n3 = { date: 'y', rhr: 20, hrv: 55 };
eq(_stripZeroVitals(n3), 0, 'ערך חיובי מחוץ לטווח (rhr 20) — לא נוגעים');
eq(n3, { date: 'y', rhr: 20, hrv: 55 }, 'הרשומה נשארה כמו שהיא');

// 2. המסלול האמיתי: StorageManager מתוך storage.js
const ls = {};
const noop = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : noop, apply: () => noop });
const ctx = {
    console: { log() {}, warn() {}, error() {} }, document: noop, window: {}, navigator: {}, Intl, Date, Math, JSON,
    localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } },
    setTimeout, clearTimeout
};
vm.createContext(ctx);
// _validVital האמיתי (bodylog-logic.js) — הכלל שבו mergeSleepDays קובע "ערך תקין"
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'bodylog-logic.js'), 'utf8'), ctx);
vm.runInContext(src + '\nthis.SM = StorageManager;', ctx);
const SM = ctx.SM;
const sleep = () => JSON.parse(ls[SM.KEY_SLEEP_DAILY] || '[]');

// לילה חדש בלי RHR מהגשר
SM.mergeSleepDays([{ date: '2026-09-27', rhr: 0, hrv: 78, respRate: 13, asleepMin: 507 }]);
eq('rhr' in sleep()[0], false, 'mergeSleepDays: לילה חדש עם rhr:0 נשמר בלי rhr');
eq(sleep()[0].hrv, 78, 'mergeSleepDays: שאר הוויטלים נשמרו');
// סנכרון מאוחר יותר באותו יום מביא RHR אמיתי — נכנס
SM.mergeSleepDays([{ date: '2026-09-27', rhr: 44, hrv: 0 }]);
eq([sleep()[0].rhr, sleep()[0].hrv], [44, 78], 'RHR אמיתי מאוחר נכנס; hrv:0 לא דורס ערך קיים');
// ועוד משיכה עם 0 — לא מוחקת את ה-44
SM.mergeSleepDays([{ date: '2026-09-27', rhr: 0, hrv: 78 }]);
eq(sleep()[0].rhr, 44, 'rhr:0 נכנס לא מוחק ערך שנשמר');

// ניקוי רשומות ישנות (21.9 / 27.9 מהדרייב של המאמן)
ls[SM.KEY_SLEEP_DAILY] = JSON.stringify([
    { date: '2026-09-21', rhr: 0, hrv: 65, asleepMin: 400 },
    { date: '2026-09-22', rhr: 52, hrv: 60, asleepMin: 420 },
    { date: '2026-09-27', rhr: 0, hrv: 78, asleepMin: 507 }
]);
eq(SM.cleanZeroVitals(), 2, 'cleanZeroVitals: שתי רשומות תוקנו');
eq(sleep().map(n => n.rhr === undefined ? 'חסר' : n.rhr), ['חסר', 52, 'חסר'], 'rhr:0 הפך לחסר, 52 נשאר');
const before = ls[SM.KEY_SLEEP_DAILY];
eq(SM.cleanZeroVitals(), 0, 'ריצה שנייה — אין מה לנקות');
eq(ls[SM.KEY_SLEEP_DAILY], before, 'ריצה שנייה לא כותבת');

console.log(failed ? `\n✗ ${failed} בדיקות נכשלו` : '\n✓ כל הבדיקות עברו');
process.exit(failed ? 1 : 0);
