/* ============================================================================
 * test/off-barcode-status.test.js — "לא נמצא" מול "נכשל" בחיפוש ברקוד
 * הרצה: node test/off-barcode-status.test.js   (ללא תלויות, ללא build)
 *
 * הרקע: Open Food Facts מחזיר 404 למוצר שאינו במאגר. lookupBarcode זרק על כל
 * תשובה שאינה ok, resolveBarcode תפס את החריגה וסימן _fdLastBcError='network' —
 * ולכן כל ברקוד לא מוכר הוצג כ"שגיאת רשת". גרוע מכך: שני מסלולי ההצלה (צילום
 * תווית והזנת ערכים) מותנים ב"לא נמצא", ולכן נעלמו מהמסך יחד עם הסיבה השגויה.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'food-logic.js'), 'utf8');
const block = src.split('OFFBC-START')[1]?.split('OFFBC-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק OFFBC לא נמצא ב-food-logic.js'); process.exit(1); }
const { classifyOffBarcode } = new Function(block + '\nreturn { classifyOffBarcode };')();

let failed = 0;
const ok = (c, n) => { console.log(`${c ? '✓' : '✗'} ${n}`); if (!c) failed++; };

// ── התשובה שהפילה את הפיצ'ר ──────────────────────────────────────────────
ok(classifyOffBarcode(404) === 'missing', '404 = לא במאגר (ולא שגיאת רשת)');
ok(classifyOffBarcode(400) === 'missing', '400 = ברקוד לא תקין → אותו מסלול של "לא נמצא"');

// ── תקלות אמיתיות — חייבות להישאר שגיאה, כי ניסיון חוזר הוא הפתרון ──────
[429, 500, 502, 503, 504, 403].forEach(s =>
    ok(classifyOffBarcode(s) === 'error', `${s} = תקלה אמיתית`));

// ── 200 — הגוף קובע ──────────────────────────────────────────────────────
ok(classifyOffBarcode(200, 1) === 'ok', '200 + status:1 = נמצא');
ok(classifyOffBarcode(200, '1') === 'ok', 'status כמחרוזת "1" — אותו דבר');
ok(classifyOffBarcode(200, 0) === 'missing', '200 + status:0 = לא נמצא (התנהגות OFF הישנה)');
ok(classifyOffBarcode(200, undefined) === 'missing', '200 בלי status = לא נמצא, לא קריסה');
ok(classifyOffBarcode(204) === 'missing', '2xx בלי גוף = אין מוצר');
ok(classifyOffBarcode(200, 1) === 'ok', 'רק status:1 נחשב "נמצא"');

// ── קלט פגום לא מפיל ─────────────────────────────────────────────────────
ok(classifyOffBarcode(undefined) === 'error', 'סטטוס חסר = תקלה (ברירת מחדל בטוחה)');
ok(classifyOffBarcode('404') === 'missing', 'סטטוס כמחרוזת מנורמל');

// ── התוצאה שהמשתמש רואה: איזו סיבה, ואילו כפתורים ────────────────────────
// שחזור השרשרת: classify → האם נחרת _fdLastBcError → מה מוצע למשתמש
function uxFor(httpStatus, payloadStatus, hasAIKey) {
    const outcome = classifyOffBarcode(httpStatus, payloadStatus);
    const lastErr = outcome === 'error' ? 'network' : null;   // resolveBarcode
    const missing = !lastErr;
    return {
        reason: lastErr ? 'שגיאת רשת בחיפוש המוצר' : 'לא נמצא ב-Open Food Facts',
        photo: missing && !!hasAIKey,      // "צלם תווית"
        values: missing                     // "הזן ערכים ידנית"
    };
}
const notFound = uxFor(404, null, true);
ok(notFound.reason.includes('לא נמצא'), 'ברקוד לא מוכר — הסיבה היא "לא נמצא"');
ok(notFound.photo && notFound.values, 'ברקוד לא מוכר — שתי דרכי ההמשך זמינות');

const noKey = uxFor(404, null, false);
ok(!noKey.photo && noKey.values, 'בלי מפתח Gemini — הזנת ערכים עדיין זמינה');

const down = uxFor(503, null, true);
ok(down.reason.includes('שגיאת רשת'), 'שרת נפל — הסיבה היא תקלה');
ok(!down.photo && !down.values, 'בתקלה אמיתית לא מציעים תווית/ערכים — ניסיון חוזר הוא הפתרון');

console.log(failed ? `\n${failed} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(failed ? 1 : 0);
