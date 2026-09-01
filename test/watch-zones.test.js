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
const { _watchZoneSec, _hrZoneBounds, _watchRestHr, _watchDateKey, WATCH_HR_GAP_CAP_SEC, WATCH_HR_GAP_MAX_SEC } =
    new Function('StorageManager',
        block + '\nreturn { _watchZoneSec, _hrZoneBounds, _watchRestHr, _watchDateKey, WATCH_HR_GAP_CAP_SEC, WATCH_HR_GAP_MAX_SEC };')(StorageManager);

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
// זמן המקטע נפרס על האזורים שהוא חוצה, ביחס לחלק הטווח שנופל בכל אחד.
// למשל [125..138] חוצה את הסף 128: 3/13 מהזמן ל-Z1 ו-10/13 ל-Z2.
eq(_watchZoneSec(mixed, B), [67, 28, 25, 0, 0],
   'מקטע שחוצה סף נפרס בין האזורים לפי min/max, לא נזקף כולו לממוצע');

// פער דגימה — הלב של הפער בין 57:58 ל-77:00 במסך של אפל
const gap = [[0, 100, 105, 110], [600, 100, 106, 112], [630, 99, 104, 110]];
// רזולוציה 30ש' → כל דגימה מייצגת 30ש', גם זו שלפני הפער.
eq(_watchZoneSec(gap, B), [90, 0, 0, 0, 0],
   'פער של 10 דקות אינו נספר: כל דגימה שווה מרווח דגימה אחד בלבד');
eq(_watchZoneSec([[0, 100, 105, 110], [30, 100, 105, 110]], B), [60, 0, 0, 0, 0],
   'לדגימה האחרונה מיוחסת רזולוציית הדגימה');

// ── קיבוץ-דקות: מה ש-HAE מייצאת בפועל (Time Grouping = Minutes) ──────────
// התקרה נגזרת מהרזולוציה (1.5 מרווחים), ולכן דגימה כל 60ש' נספרת במלואה
// במקום להיגזם לרצפת ה-60. בלי זה כל אימון בקיבוץ-דקות היה מאבד זמן שיטתית.
const perMinute = [[0, 96, 104, 112], [60, 100, 110, 118], [120, 118, 130, 141], [180, 99, 106, 114]];
eq(_watchZoneSec(perMinute, B), [206, 31, 3, 0, 0],
   'קיבוץ-דקות: 4 דקות מלאות (240ש\'), פרוסות לפי הטווח של כל דקה');
eq(_watchZoneSec(perMinute, B).reduce((a, b) => a + b, 0), 240,
   'סך הזמן נשמר — הפריסה מחלקת, לא מוסיפה');

// פער אמיתי בתוך קיבוץ-דקות — עדיין ניתוק, לא זמן אימון
const minGap = [[0, 96, 104, 112], [60, 100, 110, 118], [900, 99, 106, 114]];
eq(_watchZoneSec(minGap, B), [180, 0, 0, 0, 0],
   'פער של 15 דקות בקיבוץ-דקות: שלוש דקות בלבד נספרות');

// ── סכום האזורים לא חורג ממשך האימון ─────────────────────────────────────
// הדגימה האחרונה מקבלת מרווח שלם, שעלול לחרוג מהסוף. סכום גדול ממשך האימון
// נראה למשתמש כמו טעות — בצדק.
const tail = [[0, 96, 104, 112], [60, 96, 104, 112], [120, 96, 104, 112]];
eq(_watchZoneSec(tail, B).reduce((a, b) => a + b, 0), 180,
   'בלי משך ידוע: שלוש דגימות → 180ש\'');
eq(_watchZoneSec(tail, B, 150).reduce((a, b) => a + b, 0), 150,
   'עם משך 150ש\': הזנב נחתך ואין חריגה');
eq(_watchZoneSec(tail, B, 500).reduce((a, b) => a + b, 0), 180,
   'משך ארוך מהסדרה אינו מנפח את הזנב מעבר למרווח דגימה');

eq(_watchZoneSec(mixed, null), [0, 0, 0, 0, 0], 'בלי גבולות אין אזורים');
eq(_watchZoneSec([], B), [0, 0, 0, 0, 0], 'סדרה ריקה מחזירה אפסים');
// [160..180] חוצה את סף Z5 (165): 5/20 ל-Z4 ו-15/20 ל-Z5.
eq(_watchZoneSec([[0, 160, 170, 180]], B), [0, 0, 0, 15, 45],
   'דגימה בודדת שחוצה את סף Z5 נפרסת בין Z4 ל-Z5');

// דגימות לא-מסודרות/כפולות לא יוצרות זמן שלילי
eq(_watchZoneSec([[0, 100, 105, 110], [0, 100, 105, 110], [30, 100, 105, 110]], B),
   [60, 0, 0, 0, 0], 'דגימה כפולה באותה שנייה תורמת אפס ואינה גורעת זמן');

// ── פורמט התאריך מול לילות השינה (v19.10.12) ─────────────────────────────
// רשומת הארכיון שומרת DD.MM.YY, לילות השינה YYYY-MM-DD. השוואת מחרוזות ישירה
// ביניהן סיננה את כל הלילות בכל אימון בימים 01–20, ולכן לא היו אזורי דופק.
eq(_watchDateKey('01.09.26'), '2026-09-01', 'DD.MM.YY → ISO');
eq(_watchDateKey('9.9.26'),   '2026-09-09', 'ספרה בודדת מרופדת');
eq(_watchDateKey('31.08.2026'), '2026-08-31', 'שנה בת 4 ספרות');
eq(_watchDateKey('2026-08-31'), '2026-08-31', 'ISO עובר כמות שהוא');
eq(_watchDateKey(''), null, 'ריק → null');
eq(_watchDateKey('בלגן'), null, 'לא-פריק → null (הסינון מוותר על החלון)');

store._nights = [
    { date: '2026-08-28', rhr: 51 }, { date: '2026-08-29', rhr: 52 },
    { date: '2026-08-30', rhr: 52 }, { date: '2026-08-31', rhr: 53 }
];
store._profile = { age: 42 };
store._zones = { auto: true, maxHr: null, restHr: null, bounds: null };

eq(_watchRestHr('31.08.26'), 52, 'יום 31: חציון הלילות');
eq(_watchRestHr('01.09.26'), 52, 'יום 01 — הרגרסיה: קודם החזיר null');
eq(_watchRestHr('15.09.26'), 52, 'יום 15 — גם הוא סונן לגמרי קודם');
eq(_watchRestHr('20.09.26'), 52, 'יום 20 — הגבול העליון של הטווח השבור');
eq(_watchRestHr('2026-08-28'), 51, 'חלון הזמן עדיין חוסם לילות מאוחרים');

// אותם ארבעת הספים שהבדיקה עוגנת בהם — עכשיו גם באימון של ה-1 בחודש
const zb1 = _hrZoneBounds('01.09.26');
if (!zb1) { console.error('✗ אין גבולות לאימון של ה-1 בחודש — הרגרסיה חזרה'); failed++; }
else eq(zb1.bounds, [128, 140, 153, 165], 'גבולות זהים לאימון של ה-1 בחודש');

console.log(failed ? `\n${failed} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(failed ? 1 : 0);
