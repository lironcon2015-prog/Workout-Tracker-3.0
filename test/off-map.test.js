/* ============================================================================
 * test/off-map.test.js — מיפוי מוצר Open Food Facts → מזון
 * הרצה: node test/off-map.test.js   (ללא תלויות, ללא build)
 *
 * הבדיקה טוענת את בלוק OFFMAP מתוך food-logic.js עצמו — מקור אמת אחד,
 * בלי להעתיק לוגיקה לכאן.
 *
 * הכשל השקט שהיא מתעדת: מוצר **קיים** ב-OFF עם ערכים מלאים הוחזר כ-null
 * ונראה למשתמש כ"לא נמצא", בשלושה מצבים שכיחים אצל חטיפי/משקאות חלבון —
 * שם לא-עברי, ערכים לפי מנה במקום ל-100 גרם, ורשומה בלי ערכים ששמה נזרק.
 * אף אחד מהם לא זרק שגיאה. שלושת המצבים נבדקים כאן.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'food-logic.js'), 'utf8');
const block = src.split('OFFMAP-START')[1]?.split('OFFMAP-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק OFFMAP לא נמצא ב-food-logic.js'); process.exit(1); }

// עזרי המרה מ-food-logic — פשוטים, מוזרקים כדי לטעון את הבלוק לבדו
const _fdNum = v => { const n = Number(v); return (v === '' || v == null || !isFinite(n)) ? null : n; };
const _fdR   = v => { const n = Number(v); return isFinite(n) ? Math.round(n * 10) / 10 : 0; };
const _fdRn  = v => { const n = Number(v); return isFinite(n) ? Math.round(n * 10) / 10 : undefined; };
function _fdParseServingGrams(qty, sizeStr) {
    const q = _fdNum(qty);
    if (q && q > 0) return q;
    const m = String(sizeStr || '').match(/([\d.]+)\s*(g|גרם|ml|מ"ל|מל)/i);
    if (m) { const n = parseFloat(m[1]); if (isFinite(n) && n > 0) return n; }
    return null;
}

const { _offToFood, _offName, _offPer100 } = new Function(
    '_fdNum', '_fdR', '_fdRn', '_fdParseServingGrams',
    block + '\nreturn { _offToFood, _offName, _offPer100 };'
)(_fdNum, _fdR, _fdRn, _fdParseServingGrams);

let fail = 0;
const chk = (ok, msg, extra = '') => { console.log(`${ok ? '✓' : '✗'} ${msg}${extra ? ' — ' + extra : ''}`); if (!ok) fail++; };

// ── 1. שם רק באנגלית — רשומה מלאה שנזרקה כי product_name_he/product_name ריקים
const barEn = {
    code: '5060469985015',
    product_name: '', product_name_he: '', product_name_en: 'Protein Bar Cookie Dough',
    brands: 'Grenade',
    nutriments: { 'energy-kcal_100g': 386, proteins_100g: 35.2, carbohydrates_100g: 30.5, fat_100g: 15.1, fiber_100g: 8.2 },
    serving_size: '60 g'
};
const f1 = _offToFood(barEn);
chk(!!f1, 'שם אנגלי בלבד — המוצר מוחזר ולא נזרק');
chk(f1 && f1.name === 'Protein Bar Cookie Dough', 'השם נלקח מ-product_name_en', f1 && f1.name);
chk(f1 && f1.per100.kcal === 386 && f1.per100.p === 35.2, 'ערכי 100 גרם נשמרים כמו שהם');
chk(f1 && f1.servings[0].grams === 60, 'מנה 60 גרם נקראת מ-serving_size', f1 && String(f1.servings[0].grams));
chk(f1 && !f1.partial, 'רשומה מלאה אינה מסומנת partial');

// ── 2. ערכים לפי מנה בלבד — משקה חלבון בבקבוק 330 מ"ל
// nutrition_data_per: serving. 150 קק"ל למנה של 330 → 45 ל-100 (150 × 100/330).
const drinkServing = {
    code: '7290018104941',
    product_name_he: 'משקה חלבון וניל',
    brands: 'Yotvata',
    nutriments: { 'energy-kcal_serving': 150, proteins_serving: 30, carbohydrates_serving: 6.6, fat_serving: 1.65 },
    serving_quantity: 330
};
const f2 = _offToFood(drinkServing);
chk(!!f2, 'ערכי מנה בלבד — המוצר מוחזר ולא נזרק');
chk(f2 && f2.per100.kcal === 45, 'קלוריות הומרו למאה גרם', f2 && String(f2.per100.kcal));
chk(f2 && f2.per100.p === 9.1, 'חלבון הומר למאה גרם (30 × 100/330)', f2 && String(f2.per100.p));
chk(f2 && f2.per100.c === 2 && f2.per100.f === 0.5, 'פחמימות/שומן הומרו יחד איתם');
chk(f2 && f2.servings[0].grams === 330, 'המנה המקורית נשמרת כברירת מחדל');

// ── 3. ערכי מנה בלי גודל מנה — אין המרה אפשרית, ואסור לנחש
const noGrams = { code: '111', product_name: 'Mystery Shake',
    nutriments: { 'energy-kcal_serving': 200, proteins_serving: 20 } };
chk(_offToFood(noGrams) === null, 'ערכי מנה בלי גודל מנה — לא מנחשים, מוחזר null');

// ── 4. רשומה בלי ערכים — נזרקה יחד עם השם. עכשיו: partial עם השם האמיתי
const shell = { code: '7290112960191', product_name_he: 'חטיף חלבון שוקולד', brands: 'Gold' };
chk(_offToFood(shell) === null, 'בחיפוש (בלי allowPartial) רשומה ריקה עדיין נופלת');
const f4 = _offToFood(shell, true);
chk(!!f4 && f4.partial === true, 'עם allowPartial הרשומה חוזרת מסומנת partial');
chk(f4 && f4.name === 'חטיף חלבון שוקולד', 'השם האמיתי נשמר לנתיב ה-OCR', f4 && f4.name);
chk(f4 && f4.barcode === '7290112960191', 'הברקוד נשמר איתו');

// ── 5. רשומה בלי שם בכלל — אין מה להציל, null בשני המצבים
chk(_offToFood({ code: '222', nutriments: { 'energy-kcal_100g': 100 } }) === null, 'בלי שם — null');
chk(_offToFood({ code: '222', nutriments: { 'energy-kcal_100g': 100 } }, true) === null, 'בלי שם — null גם עם allowPartial');

// ── 6. רגרסיה: kJ ל-100 גרם ממשיך לעבוד (1000 kJ ≈ 239 קק"ל)
const kj = { code: '333', product_name: 'KJ Only', nutriments: { energy_100g: 1000, proteins_100g: 10 } };
chk(_offToFood(kj) && _offToFood(kj).per100.kcal === 239, 'המרת kJ→kcal ל-100 גרם נשמרה');

// ── 7. סדר העדפת שמות: עברית גוברת על אנגלית
chk(_offName({ product_name_he: 'עברי', product_name: 'Main', product_name_en: 'En' }) === 'עברי', 'עברית ראשונה בסדר השמות');
chk(_offName({ product_name: '   ', generic_name: 'Generic' }) === 'Generic', 'שם ריק/רווחים מדולג לטובת הבא בתור');

console.log(fail ? `\n${fail} בדיקות נכשלו` : '\nהכל עבר');
process.exit(fail ? 1 : 0);
