/* ============================================================================
 * test/watch-zones.test.js — אזורי דופק מנתוני Apple Watch
 * הרצה: node test/watch-zones.test.js   (ללא תלויות, ללא build)
 *
 * הבדיקה טוענת את בלוק WATCHZONES מתוך workout-core.js עצמו — מקור אמת אחד,
 * בלי להעתיק לוגיקה לכאן. StorageManager מוזרק כ-stub, כי הבלוק תלוי רק
 * בפרופיל הגוף (גיל) ובלילות השינה (דופק מנוחה).
 *
 * העוגן: צילום מסך אמיתי של Apple Fitness שבו טווחי האזורים הם
 * Z2 128–139 · Z3 140–152 · Z4 153–164 · Z5 165+ — כלומר ארבעת הספים
 * 128/140/153/165. הם יוצאים מדופק מנוחה 52 ודופק מרבי 178 (גיל 42).
 * אם החישוב יזוז, הבדיקה תיפול.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'workout-core.js'), 'utf8');
const block = src.split('WATCHZONES-START')[1]?.split('WATCHZONES-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק WATCHZONES לא נמצא ב-workout-core.js'); process.exit(1); }

// StorageManager מדומה — נשלט מתוך הבדיקות דרך _profile/_nights
const store = { _profile: {}, _nights: [], _zones: { auto: true, maxHr: null, restHr: null, bounds: null } };
const StorageManager = {
    getBodyProfile: () => store._profile,
    getSleepDaily:  () => store._nights,
    getHrZones:     () => store._zones
};
const { _watchZoneSec, _hrZoneBounds, _watchRestHr, WATCH_HR_GAP_CAP_SEC } =
    new Function('StorageManager',
        block + '\nreturn { _watchZoneSec, _hrZoneBounds, _watchRestHr, WATCH_HR_GAP_CAP_SEC };')(StorageManager);

let failed = 0;
function eq(actual, expected, name) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    const ok = a === e;
    console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    התקבל:  ${a}\n    ציפייה: ${e}`}`);
    if (!ok) failed++;
}

// ── גבולות אזורים ─────────────────────────────────────────────────────────
const nights = (rhr, count) => Array.from({ length: count }, (_, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, '0')}`, rhr
}));

store._profile = { age: 42 };
store._nights = nights(52, 20);
eq(_hrZoneBounds().bounds, [128, 140, 153, 165],
   'הגבולות מהצילום: גיל 42 + דופק מנוחה 52 → 128/140/153/165');
eq(_hrZoneBounds().maxHr, 178, 'דופק מרבי נגזר מהגיל (220-42)');

store._nights = nights(0, 10);   // ערכי אפס = חסר, לא "דופק מנוחה 0"
eq(_watchRestHr(), null, 'דופק מנוחה 0 נדחה כחסר ולא מזהם את הרזרבה');
eq(_hrZoneBounds(), null, 'בלי דופק מנוחה אין גבולות — ולא ניחוש');

store._nights = nights(52, 20);
store._profile = {};
eq(_hrZoneBounds(), null, 'בלי גיל בפרופיל אין דופק מרבי → אין גבולות');

store._zones = { auto: false, maxHr: null, restHr: null, bounds: [128, 140, 153, 165] };
eq(_hrZoneBounds().bounds, [128, 140, 153, 165], 'גבולות ידניים גוברים גם בלי גיל');
eq(_hrZoneBounds().manual, true, 'מצב ידני מסומן ככזה');
store._zones = { auto: true, maxHr: null, restHr: null, bounds: null };
store._profile = { age: 42 };

// חציון, לא ממוצע — לילה חריג בודד לא מזיז את הרזרבה
store._nights = nights(52, 19).concat([{ date: '2026-08-20', rhr: 95 }]);
eq(_watchRestHr(), 52, 'חציון מתעלם מלילה חריג בודד');

// ── זמן בכל אזור ──────────────────────────────────────────────────────────
const B = [128, 140, 153, 165];
// [שניות, min, avg, max] — דגימה כל 30ש'
const steady = [[0, 100, 105, 110], [30, 100, 106, 112], [60, 98, 104, 109], [90, 99, 105, 111]];
eq(_watchZoneSec(steady, B), [120, 0, 0, 0, 0],
   'ארבע דגימות ב-Z1 → 120 שניות, כולל ייחוס לדגימה האחרונה');

const mixed = [[0, 100, 105, 110], [30, 125, 132, 138], [60, 138, 145, 150], [90, 100, 110, 118]];
eq(_watchZoneSec(mixed, B), [60, 30, 30, 0, 0],
   'כל דגימה נספרת לאזור של הממוצע שלה');

// פער דגימה — הלב של הפער בין 57:58 ל-77:00 במסך של אפל
const gap = [[0, 100, 105, 110], [600, 100, 106, 112], [630, 99, 104, 110]];
eq(_watchZoneSec(gap, B), [120, 0, 0, 0, 0],
   `פער של 10 דקות נחסם ל-${WATCH_HR_GAP_CAP_SEC}ש' ואינו נספר כזמן אימון`);
eq(_watchZoneSec([[0, 100, 105, 110], [30, 100, 105, 110]], B), [60, 0, 0, 0, 0],
   'לדגימה האחרונה מיוחסת רזולוציית הדגימה, לא ה-cap המלא');

eq(_watchZoneSec(mixed, null), [0, 0, 0, 0, 0], 'בלי גבולות אין אזורים');
eq(_watchZoneSec([], B), [0, 0, 0, 0, 0], 'סדרה ריקה מחזירה אפסים');
eq(_watchZoneSec([[0, 160, 170, 180]], B), [0, 0, 0, 0, 60], 'דגימה בודדת מעל 165 → Z5');

// דגימות לא-מסודרות/כפולות לא יוצרות זמן שלילי
eq(_watchZoneSec([[0, 100, 105, 110], [0, 100, 105, 110], [30, 100, 105, 110]], B),
   [60, 0, 0, 0, 0], 'דגימה כפולה באותה שנייה תורמת אפס ואינה גורעת זמן');

console.log(failed ? `\n${failed} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(failed ? 1 : 0);
