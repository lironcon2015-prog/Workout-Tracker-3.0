/* ============================================================================
 * test/chunk-plan.test.js — כתיבת chunks מצטברת
 * הרצה: node test/chunk-plan.test.js   (ללא תלויות, ללא build)
 *
 * הרקע: כל שמירה שלחה את כל ה-chunks מחדש. עם 110 אימונים ונתוני שעון זה
 * ~0.87MB ב-batch אטומי אחד — מעל מה ש-15 שניות נותנות ב-4G חלש, ומכאן
 * הכשלים החוזרים (LIVE_TIMEOUT). הבדיקה מוודאת שני דברים:
 *   1. דילוג מתרחש רק כשבטוח לדלג — בכל ספק נכתב הכל.
 *   2. היפוך סדר ה-chunks באמת מצמצם את הכתיבה לאחד.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'storage.js'), 'utf8');
const block = src.split('CHUNKSYNC-START')[1]?.split('CHUNKSYNC-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק CHUNKSYNC לא נמצא ב-storage.js'); process.exit(1); }
const M = eval('({ CHUNK_FULL_REFRESH_MS: 7 * 86400000,\n' + block + '\n})');

let failed = 0;
function eq(actual, expected, name) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    const ok = a === e;
    console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    התקבל:  ${a}\n    ציפייה: ${e}`}`);
    if (!ok) failed++;
}
const fresh = extra => Object.assign({ fullAt: Date.now() - 1000 }, extra);
const metaFor = (payloads, schema) => fresh({
    chunkCount: payloads.length, schema, hashes: payloads.map(p => M._chunkHash(p))
});

const P = ['aaa', 'bbb', 'ccc', 'ddd'];

// ── בכל ספק — כתיבה מלאה ─────────────────────────────────────────────────
eq(M._chunkPlan(null, P, 2).write, [0, 1, 2, 3], 'אין meta → כתיבה מלאה');
eq(M._chunkPlan(metaFor(P, 1), P, 2).write, [0, 1, 2, 3], 'סכמה ישנה → כתיבה מלאה (מיגרציה)');
eq(M._chunkPlan(fresh({ chunkCount: 4, schema: 2 }), P, 2).write, [0, 1, 2, 3],
   'meta בלי hashes → כתיבה מלאה');
eq(M._chunkPlan(fresh({ chunkCount: 4, schema: 2, hashes: ['x', 'y'] }), P, 2).write, [0, 1, 2, 3],
   'אורך hashes לא תואם ל-chunkCount → כתיבה מלאה');
eq(M._chunkPlan(Object.assign(metaFor(P, 2), { fullAt: Date.now() - 8 * 86400000 }), P, 2).write,
   [0, 1, 2, 3], 'עברו 8 ימים מהרענון המלא → כתיבה מלאה כפויה');
eq(M._chunkPlan(null, P, 2).full, true, 'הדגל full נדלק בכתיבה מלאה');

// ── דילוג רק כשבטוח ──────────────────────────────────────────────────────
const prev = metaFor(P, 2);
eq(M._chunkPlan(prev, P, 2).write, [], 'שום שינוי → אפס כתיבות');
eq(M._chunkPlan(prev, P, 2).full, false, 'דילוג אינו נחשב כתיבה מלאה');
eq(M._chunkPlan(prev, ['aaa', 'bbb', 'ccc', 'ZZZ'], 2).write, [3], 'שינוי ב-chunk האחרון בלבד');
eq(M._chunkPlan(prev, ['aaa', 'XXX', 'ccc', 'ddd'], 2).write, [1], 'שינוי באמצע — רק הוא נכתב');
eq(M._chunkPlan(prev, [...P, 'eee'], 2).write, [4], 'chunk חדש בסוף — רק הוא נכתב');
eq(M._chunkPlan(prev, ['aaa', 'bbb'], 2).write, [], 'התכווצות — הנותרים זהים, המחיקה נפרדת');

// ── ההיפוך: למה הסדר הישן איפס את כל התועלת ──────────────────────────────
// הארכיון שמור חדש-ראשון. 110 אימונים, 20 ל-chunk → 6 chunks.
const workouts = n => Array.from({ length: n }, (_, i) => 'w' + i);
const chunkify = (arr, size) => {
    const out = [];
    for (let i = 0; i < Math.ceil(arr.length / size); i++) out.push(JSON.stringify(arr.slice(i * size, (i + 1) * size)));
    return out;
};
const before = workouts(110);                  // חדש-ראשון: ['w0'=החדש ... 'w109'=הישן]
const after  = ['NEW', ...before];             // אימון חדש נכנס בראש

// סדר ישן (schema 1) — chunk 0 = החדשים
const oldPrev = metaFor(chunkify(before, 20), 1);
eq(M._chunkPlan(oldPrev, chunkify(after, 20), 1).write, [0, 1, 2, 3, 4, 5],
   'סדר ישן: אימון אחד חדש מכריח כתיבה של כל ששת ה-chunks');

// סדר חדש (schema 2) — chunk 0 = הישנים
const newPrev = metaFor(chunkify(before.slice().reverse(), 20), 2);
eq(M._chunkPlan(newPrev, chunkify(after.slice().reverse(), 20), 2).write, [5],
   'סדר חדש: אותו אימון נוגע ב-chunk אחד בלבד');

// ── ה-hash עצמו ──────────────────────────────────────────────────────────
eq(M._chunkHash('abc') === M._chunkHash('abc'), true, 'יציב לאותו קלט');
eq(M._chunkHash('abc') !== M._chunkHash('abd'), true, 'שונה לקלט שונה');
eq(typeof M._chunkHash(''), 'string', 'מחרוזת ריקה אינה קורסת');

// ── הלוך-חזור על סדר הארכיון ─────────────────────────────────────────────
// זו הבדיקה הקריטית: כיוון הפוך מהפך את כל הארכיון בשקט (הישן ייראה כחדש).
const CHUNK = 20;
const archive = Array.from({ length: 110 }, (_, i) => ({ timestamp: 2000 - i }));  // חדש-ראשון

// כתיבה: לחלוקה ל-chunks · קריאה: איחוד chunks 0..N ואז חזרה לסדר המקומי
const written = M._toChunkOrder(archive);
const asChunks = [];
for (let i = 0; i < Math.ceil(written.length / CHUNK); i++) asChunks.push(written.slice(i * CHUNK, (i + 1) * CHUNK));
const readBack = M._fromChunkOrder([].concat(...asChunks), 2);

eq(readBack, archive, 'הלוך-חזור schema 2 מחזיר את הארכיון בדיוק');
eq(readBack[0].timestamp, 2000, 'הפריט הראשון הוא החדש ביותר');
eq(readBack[readBack.length - 1].timestamp, 1891, 'הפריט האחרון הוא הישן ביותר');
eq(asChunks[0][0].timestamp, 1891, 'chunk 0 מתחיל בישן ביותר');
eq(asChunks[asChunks.length - 1].slice(-1)[0].timestamp, 2000, 'ה-chunk האחרון מסתיים בחדש ביותר');

// schema 1 (נתוני ענן ישנים) — כבר חדש-ראשון, אסור להפוך
eq(M._fromChunkOrder(archive.slice(), 1), archive, 'schema 1 נטען כמות שהוא');
eq(M._fromChunkOrder(archive.slice(), undefined), archive, 'meta בלי schema = 1, בלי היפוך');

// המקור לא משתנה בדרך
const orig = [{ timestamp: 1 }, { timestamp: 2 }];
M._toChunkOrder(orig); M._fromChunkOrder(orig, 2);
eq(orig, [{ timestamp: 1 }, { timestamp: 2 }], 'שתי הפונקציות אינן משנות את הקלט');

console.log(failed ? `\n${failed} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(failed ? 1 : 0);
