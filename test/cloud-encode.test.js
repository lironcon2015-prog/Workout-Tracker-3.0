/* ============================================================================
 * test/cloud-encode.test.js — קידוד סדרת הדופק לפני כתיבה ל-Firestore
 * הרצה: node test/cloud-encode.test.js   (ללא תלויות, ללא build)
 *
 * הרקע: hrSeries הוא [[שניות, min, avg, max], ...] — מערך בתוך מערך.
 * Firestore אוסר מערך בתוך מערך ודוחה את המסמך כולו ב-invalid-argument,
 * עוד לפני יציאה לרשת. הבדיקה מריצה ולידטור שמחקה את הכלל הזה על התוצר
 * המקודד, ומוודאת שהפענוח מחזיר את הסדרה המקורית בדיוק.
 *
 * הבלוק נטען מתוך storage.js עצמו (CLOUDENC) — מקור אמת אחד.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'storage.js'), 'utf8');
const block = src.split('CLOUDENC-START')[1]?.split('CLOUDENC-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק CLOUDENC לא נמצא ב-storage.js'); process.exit(1); }
const M = eval('({' + block + '\n})');   // \n — שורת הסמן האחרונה היא הערה

// ולידטור Firestore מדומה: מערך שאחד מאיבריו הוא מערך — פסול.
function assertFirestoreSafe(value, path) {
    if (Array.isArray(value)) {
        value.forEach((v, i) => {
            if (Array.isArray(v)) throw new Error('Nested arrays are not supported (found in field ' + path + '[' + i + '])');
            assertFirestoreSafe(v, path + '[' + i + ']');
        });
    } else if (value && typeof value === 'object') {
        Object.keys(value).forEach(k => assertFirestoreSafe(value[k], path ? path + '.' + k : k));
    }
}

let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); console.log('✓ ' + name); pass++; }
    catch (e) { console.error('✗ ' + name + ' — ' + e.message); fail++; }
}
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || '') + ' | ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b));
}

const series = [[0, 88, 91, 95], [30, 90, 93, 97], [60, 118, 124, 131]];
const watch  = { srcId: 'x', start: 1, end: 2, hrAvg: 91, zoneBounds: [128, 140, 153, 165], zoneSec: [2374, 8, 0, 0, 0], hrSeries: series };
const entry  = { timestamp: 7, date: '2026-08-31', exercises: [{ name: 'לחיצת חזה', sets: [{ w: 40, r: 10 }] }], watch };

t('רשומת ארכיון גולמית אכן נפסלת על ידי כלל Firestore', () => {
    let threw = false;
    try { assertFirestoreSafe([entry], 'items'); } catch { threw = true; }
    if (!threw) throw new Error('הולידטור לא זיהה את המערך המקונן — הבדיקה עצמה שבורה');
});

t('items מקודד עובר את כלל Firestore', () => {
    assertFirestoreSafe(M._encodeArchiveItems([entry]), 'items');
});

t('watchWorkouts מקודד עובר את כלל Firestore', () => {
    assertFirestoreSafe([M._encodeWatch({ id: 'a', hrSeries: series })], 'watchWorkouts');
});

t('הלוך-חזור על רשומת ארכיון מחזיר את הסדרה במדויק', () => {
    const back = M._decodeArchiveItems(M._encodeArchiveItems([entry]));
    eq(back[0].watch.hrSeries, series, 'hrSeries');
    eq(back[0], entry, 'הרשומה כולה');
});

t('הקידוד אינו נוגע ברשומה המקומית', () => {
    M._encodeArchiveItems([entry]);
    eq(entry.watch.hrSeries, series, 'הסדרה המקומית');
    if ('hrSeriesJson' in entry.watch) throw new Error('hrSeriesJson דלף לרשומה המקומית');
});

t('רשומות בלי סדרה עוברות כמות שהן', () => {
    const plain = { timestamp: 9, watch: { srcId: 'y', hrAvg: 100 } };
    eq(M._encodeArchiveItems([plain, { timestamp: 10 }, { timestamp: 11, watch: null }]),
       [plain, { timestamp: 10 }, { timestamp: 11, watch: null }]);
});

t('נתוני ענן ישנים (בלי hrSeriesJson) נטענים ללא שינוי', () => {
    const legacy = [{ timestamp: 1, watch: { srcId: 'z', hrAvg: 90 } }, { timestamp: 2 }];
    eq(M._decodeArchiveItems(legacy), legacy);
});

t('סדרה פגומה בענן לא מפילה את הטעינה', () => {
    const out = M._decodeWatch({ srcId: 'q', hrSeriesJson: '[[0,1,2' });
    if ('hrSeriesJson' in out) throw new Error('hrSeriesJson נשאר ברשומה');
    if (out.hrSeries !== undefined) throw new Error('נוצרה סדרה מנתון פגום');
});

console.log('\n' + pass + ' עברו, ' + fail + ' נכשלו');
process.exit(fail ? 1 : 0);
