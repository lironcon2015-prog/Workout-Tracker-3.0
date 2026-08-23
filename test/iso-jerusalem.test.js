/* ============================================================================
 * test/iso-jerusalem.test.js — חותמת `generated` בייצוא המאוחד
 * הרצה: node test/iso-jerusalem.test.js   (ללא תלויות, ללא build)
 *
 * הבדיקה טוענת את הבלוק TZISO מתוך bodylog-logic.js עצמו — מקור אמת אחד,
 * בלי להעתיק את הלוגיקה לכאן. תאריכים קפואים, כך שאין תלות ב-TZ של המריץ.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'bodylog-logic.js'), 'utf8');
// שארית שורת ה-START היא עדיין הערה — חותכים עד סוף השורה
const block = src.split('TZISO-START')[1]?.split('TZISO-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק TZISO לא נמצא ב-bodylog-logic.js'); process.exit(1); }
const { _blIsoWithTz, _blTzOffsetMinutes, _BL_EXPORT_TZ } =
    new Function(block + '\nreturn { _blIsoWithTz, _blTzOffsetMinutes, _BL_EXPORT_TZ };')();

let failed = 0;
function eq(actual, expected, name) {
    const ok = actual === expected;
    if (!ok) failed++;
    console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    צפוי:  ${expected}\n    התקבל: ${actual}`}`);
}
function ok(cond, name) { eq(!!cond, true, name); }

// 1. אזור הזמן שנקבע לייצוא
eq(_BL_EXPORT_TZ, 'Asia/Jerusalem', 'אזור הזמן לייצוא הוא Asia/Jerusalem');

// 2. ינואר — שעון חורף בישראל, ההיסט חייב לצאת +02:00
const jan = new Date('2026-01-15T06:48:02.667Z');
eq(_blTzOffsetMinutes(jan, _BL_EXPORT_TZ), 120, 'ינואר: היסט 120 דקות');
eq(_blIsoWithTz(jan, _BL_EXPORT_TZ), '2026-01-15T08:48:02+02:00', 'ינואר: +02:00 (שעון חורף)');

// 3. אוגוסט — שעון קיץ, +03:00. זה המקרה מהבאג המקורי.
const aug = new Date('2026-08-23T05:48:02.667Z');
eq(_blIsoWithTz(aug, _BL_EXPORT_TZ), '2026-08-23T08:48:02+03:00', 'אוגוסט: +03:00 (שעון קיץ)');

// 4. גבולות המעבר לשעון חורף 2026 (26.10.2026, 02:00 מקומי → 01:00)
eq(_blIsoWithTz(new Date('2026-10-24T22:00:00Z'), _BL_EXPORT_TZ), '2026-10-25T01:00:00+03:00', 'רגע לפני המעבר: עדיין +03:00');
eq(_blIsoWithTz(new Date('2026-10-24T23:30:00Z'), _BL_EXPORT_TZ), '2026-10-25T01:30:00+02:00', 'אחרי המעבר: כבר +02:00');

// 5. אין הצמדה קשיחה — אזור זמן אחר מחזיר היסט אחר, כולל שלילי וחצי-שעה
eq(_blIsoWithTz(jan, 'UTC'), '2026-01-15T06:48:02+00:00', 'UTC: היסט +00:00');
eq(_blIsoWithTz(jan, 'America/New_York'), '2026-01-15T01:48:02-05:00', 'ניו יורק: היסט שלילי');
eq(_blIsoWithTz(jan, 'Asia/Kolkata'), '2026-01-15T12:18:02+05:30', 'קולקטה: היסט של חצי שעה');

// 6. round-trip — new Date(generated) חוזר לאותו רגע (עד דיוק של שנייה)
for (const d of [jan, aug]) {
    const parsed = new Date(_blIsoWithTz(d, _BL_EXPORT_TZ));
    ok(!isNaN(parsed.getTime()), `new Date(generated) תקין · ${d.toISOString()}`);
    eq(parsed.getTime(), Math.floor(d.getTime() / 1000) * 1000, `round-trip לאותו רגע · ${d.toISOString()}`);
}

// 7. הפורמט תמיד ISO-8601 עם היסט מפורש — אף פעם לא "Z" ולא זמן מקומי ערום
ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(_blIsoWithTz(aug, _BL_EXPORT_TZ)), 'הפורמט תואם ISO-8601 עם היסט');

console.log(failed ? `\n${failed} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(failed ? 1 : 0);
