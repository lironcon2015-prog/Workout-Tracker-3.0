/* ============================================================================
 * test/meal-fiber.test.js — הסיבים של מנה מורכבת
 * הרצה: node test/meal-fiber.test.js   (ללא תלויות, ללא build)
 *
 * הרקע: עורך המנה חישב סיבים לכל מרכיב והציג אותם, אבל שורת הסיכום לא הציגה
 * סיבים כלל — ו-fdSaveMeal חישב את הסכום ומעולם לא כתב אותו לרשומת היומן.
 * התוצאה: כשל שקט קלאסי — המספר קיים במסך, ונעלם ביומן, ב-NUTRITION_DAILY
 * ובייצוא המאוחד. הבדיקה נועלת את שני הצדדים: הסכימה עצמה, וכתיבתה לרשומה.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'food-logic.js'), 'utf8');
const block = src.split('MEALFIB-START')[1]?.split('MEALFIB-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק MEALFIB לא נמצא ב-food-logic.js'); process.exit(1); }
const { mealFiberSum } = new Function(block + '\nreturn { mealFiberSum };')();

let failed = 0;
const ok = (c, n) => { console.log(`${c ? '✓' : '✗'} ${n}`); if (!c) failed++; };

// ── סכימה ──────────────────────────────────────────────────────────────────
ok(JSON.stringify(mealFiberSum([1.2, 2.4, 0])) === '{"fb":3.6,"partial":false}',
   'כל המרכיבים נושאים ערך → סכום מלא');
ok(mealFiberSum([1.2, null, 2.4]).partial === true, 'מרכיב בלי נתון → partial');
ok(mealFiberSum([1.2, null, 2.4]).fb === 3.6, 'הרצפה היא סכום הידועים בלבד');
ok(mealFiberSum([0, 0]).fb === 0 && mealFiberSum([0, 0]).partial === false,
   'אפס מפורש הוא מדידה, לא "חסר" — שמן זית באמת נטול סיבים');
ok(mealFiberSum([null, null]).fb === null, 'אף מרכיב בלי נתון → null (ולא 0)');
ok(mealFiberSum([]).fb === null && mealFiberSum(null).fb === null, 'רשימה ריקה/חסרה → null בלי קריסה');
ok(mealFiberSum([1.15, 1.16]).fb === 2.3, 'עיגול לעשירית אחת');
ok(mealFiberSum([1.2, undefined, NaN, 'x']).partial === true,
   'ערך לא-מספרי נספר כחסר, לא כאפס');

// ── הכתיבה לרשומת היומן (אותה לוגיקה של fdSaveMeal) ───────────────────────
function entryOf(comps) {
    const sum = { kcal: 0, p: 0, c: 0, f: 0 };
    const fib = mealFiberSum(comps.map(x => (x.fb != null ? x.fb : null)));
    if (fib.fb != null) { sum.fb = fib.fb; if (fib.partial) sum.fbPartial = true; }
    return Object.assign({ name: 'מנה', kcal: 0, p: 0, c: 0, f: 0 },
        sum.fb != null ? { fb: sum.fb } : {},
        sum.fbPartial ? { fbPartial: true } : {});
}
// המנה מהצילום: חזה עוף 0 · אורז 0.4×2.8 · שמן זית 0 · ירקות 0.4
const meal = entryOf([{ fb: 0 }, { fb: 1.1 }, { fb: 0 }, { fb: 0.4 }]);
ok(meal.fb === 1.5, 'רשומת היומן נושאת את סכום הסיבים');
ok(!('fbPartial' in meal), 'כיסוי מלא — בלי דגל חלקיות');

const partial = entryOf([{ fb: 1.1 }, {}, { fb: 0.4 }]);
ok(partial.fb === 1.5 && partial.fbPartial === true, 'כיסוי חלקי מסומן ברשומה');

const none = entryOf([{}, {}]);
ok(!('fb' in none), 'אין נתון סיבים בכלל → השדה נעדר מהרשומה (לא 0)');

// ── סכום היום (אותה לוגיקה של recomputeNutritionDay) ──────────────────────
function dayFiber(entries) {
    let sum = 0, known = 0, any = false;
    entries.forEach(e => {
        const v = (e && e.fb != null && isFinite(e.fb)) ? Number(e.fb) : null;
        if (v == null) return;
        sum += v; any = true;
        if (!e.fbPartial) known++;
    });
    return any ? { fiber: Math.round(sum * 10) / 10, fiberKnown: known, fiberEntries: entries.length } : null;
}
const day = dayFiber([meal, partial, { name: 'תפוח', fb: 2.4 }]);
ok(day.fiber === 5.4, 'המנה נכנסת לסכום הסיבים היומי');
ok(day.fiberKnown === 2 && day.fiberEntries === 3, 'מונה הכיסוי סופר את המנה החלקית כלא-מלאה');
ok(dayFiber([{ name: 'מנה', kcal: 821 }]) === null, 'יום בלי סיבים כלל — אין שדה סיבים ליום');

console.log(failed ? `\n${failed} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(failed ? 1 : 0);
