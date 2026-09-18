/* ============================================================================
 * test/watch-link.test.js — שיוך אימון שעון לרשומת ארכיון
 * הרצה: node test/watch-link.test.js   (ללא תלויות, ללא build)
 *
 * הבדיקה טוענת את בלוק WATCHLINK מתוך workout-core.js עצמו (יחד עם בלוק
 * WATCHZONES, שמחזיק את הקבועים) — מקור אמת אחד, בלי להעתיק לוגיקה לכאן.
 *
 * הבאג שהיא חורתת: `WATCH_LINK_MAX_GAP_MS` — חלון 45 הדקות סביב האימון —
 * היה **קוד מת** עד v19.13.7. התנאי היה
 *     if (overlap > bestOverlap && (overlap > 0 || near))
 * כש-bestOverlap מאותחל ל-0, ולכן `overlap > bestOverlap` כבר דרש חפיפה
 * חיובית ו-`near` לא יכול היה להשפיע לעולם; ומיד אחריו `if (bestOverlap <= 0)
 * return` חסם שוב. אימון שתועד באפליקציה אחרי שהשעון כבר סגר — או שנגע בו
 * בדיוק בקצה — לא שויך לעולם, והמשתמש נשאר מול "ממתין" בלי סיבה נראית לעין.
 *
 * הבדיקות 3–5 נכשלות על הקוד הישן ועוברות על החדש.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'workout-core.js'), 'utf8');
const cut = (a, b) => src.split(a)[1]?.split(b)[0]?.replace(/^[^\n]*\n/, '');
const zones = cut('WATCHZONES-START', 'WATCHZONES-END');   // הקבועים יושבים כאן
const link  = cut('WATCHLINK-START',  'WATCHLINK-END');
if (!zones || !link) { console.error('✗ בלוקי WATCHZONES/WATCHLINK לא נמצאו ב-workout-core.js'); process.exit(1); }

const StorageManager = { getBodyProfile: () => ({}), getSleepDaily: () => [], getHrZones: () => ({ auto: true }) };
const { _watchPickLink, WATCH_LINK_MAX_GAP_MS } =
    new Function('StorageManager', zones + link + '\nreturn { _watchPickLink, WATCH_LINK_MAX_GAP_MS };')(StorageManager);

let failed = 0;
function eq(actual, expected, name) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    התקבל:  ${JSON.stringify(actual)}\n    ציפייה: ${JSON.stringify(expected)}`}`);
    if (!ok) failed++;
}

const T = Date.parse('2026-09-17T16:00:00Z');
const MIN = 60000;
// אימון שעון: id, משך בדקות, וכמה דקות אחרי T הוא הסתיים
const wo = (id, durMin, endOffsetMin, extra) => Object.assign({
    id, wType: 'Traditional Strength Training', durMin,
    end:   T + endOffsetMin * MIN,
    start: T + endOffsetMin * MIN - durMin * MIN
}, extra || {});
// רשומת ארכיון: חותמת הסיום ומשך בדקות
const entry = (endOffsetMin, durMin) => ({ timestamp: T + endOffsetMin * MIN, duration: durMin });
const pick = (e, pool) => { const r = _watchPickLink(e, pool); return r ? r.id : null; };

// ── מסלול 1: חפיפת זמנים ──────────────────────────────────────────────────
eq(pick(entry(0, 60), [wo('A', 60, 0)]), 'A',
   'חפיפה מלאה — האימון משויך');

eq(pick(entry(0, 60), [wo('A', 60, 0), wo('B', 60, -40)]), 'A',
   'שני מועמדים חופפים — הגדול בחפיפה מנצח');

// ── מסלול 2: קרבת זמן סיום, בלי חפיפה (הבאג) ─────────────────────────────
eq(pick(entry(20, 5), [wo('A', 60, -20)]), 'A',
   'בלי חפיפה, פער 20 דק׳ — משויך לפי חלון 45 הדקות');

eq(pick(entry(1, 1), [wo('A', 45, 0)]), 'A',
   'נגיעה בדיוק בקצה (חפיפה = 0) — משויך, לא נופל בין הכיסאות');

eq(pick(entry(44, 2), [wo('A', 60, 0)]), 'A',
   'פער 44 דק׳ — עדיין בתוך החלון');

// ── גבולות החלון ──────────────────────────────────────────────────────────
eq(WATCH_LINK_MAX_GAP_MS, 45 * 60 * 1000, 'חלון החיפוש הוא 45 דקות');

eq(pick(entry(46, 2), [wo('A', 60, 0)]), null,
   'פער 46 דק׳ — מחוץ לחלון, לא משויך');

eq(pick(entry(30, 2), [wo('A', 60, -10), wo('B', 60, 20)]), 'B',
   'בלי חפיפה — הקרוב ביותר בזמן הסיום מנצח');

// ── הסינונים שקדמו לבאג ונשארים בתוקף ────────────────────────────────────
eq(pick(entry(0, 60), [wo('A', 5, 0)]), null,
   'אימון-רפאים קצר מ-10 דק׳ אינו משויך אוטומטית גם בחפיפה מלאה');

eq(pick(entry(0, 60), [wo('A', 60, 0, { wType: 'Outdoor Walk' })]), null,
   'הליכה אינה משויכת אוטומטית — נשארת לבחירה ידנית');

eq(pick(entry(0, 60), [wo('A', 60, 0, { linkedTs: T })]), null,
   'אימון ששויך כבר אינו מועמד');

eq(pick(entry(0, 60), []), null, 'מאגר ריק — null ולא קריסה');
eq(pick(null, [wo('A', 60, 0)]), null, 'רשומה חסרה — null ולא קריסה');

console.log(failed ? `\n${failed} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(failed ? 1 : 0);
