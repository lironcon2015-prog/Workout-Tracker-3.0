/* ============================================================================
 * test/cardio-archive.test.js — רשומת הארכיון של אימון אירובי
 * הרצה: node test/cardio-archive.test.js   (ללא תלויות, ללא build)
 *
 * הרקע: כל מדד נפח באפליקציה נגזר מ-entry.details. אימון אירובי אינו נושא
 * נפח, ולכן רשומה שלו חייבת לצאת עם details ריק — אחרת היא מזהמת את גרפי
 * הנפח, את התפלגות השרירים ואת "ממוצע דקות". בנוסף: cardio.rounds חייב
 * להיות מערך של maps (מערך בתוך מערך נדחה ב-Firestore ומפיל את המסמך כולו),
 * ואסור שיהיה בו undefined (Firestore דוחה שדה undefined; null מותר).
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'workout-core.js'), 'utf8');

function loadBlock(marker, returns, deps) {
    const block = src.split(marker + '-START')[1]?.split(marker + '-END')[0]?.replace(/^[^\n]*\n/, '');
    if (!block) { console.error(`✗ בלוק ${marker} לא נמצא ב-workout-core.js`); process.exit(1); }
    const names = Object.keys(deps || {});
    return new Function(...names, block + '\nreturn { ' + returns.join(', ') + ' };')
        (...names.map(n => deps[n]));
}

const _fmtClock = sec => {
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const { cardioComboFor, cardioTotals } = loadBlock('CARDIOCOMBO', ['cardioComboFor', 'cardioTotals'], {});
const { buildCardioArchiveEntry } = loadBlock('CARDIOSUM', ['buildCardioArchiveEntry'], { _fmtClock });

let failed = 0;
function ok(cond, name) {
    console.log(`${cond ? '✓' : '✗'} ${name}`);
    if (!cond) failed++;
}

// ── אימון סבבים אמיתי: 12 סבבים 3:00/1:00, הסבב האחרון נקטע ──────────────
const roundLog = [];
for (let i = 1; i <= 11; i++) roundLog.push({ i, workSec: 180, restSec: 60, skipped: false, combo: i <= 4 ? 'ג׳ב · קרוס' : null });
roundLog.push({ i: 12, workSec: 132, restSec: 0, skipped: true, combo: null });

const entry = buildCardioArchiveEntry({
    timestamp: 1789200000000,
    dateStr: '12.09.26', timeStr: '19:40',
    type: 'שדו בוקסינג', week: 2, duration: 48, note: 'הרגליים כבדו בסבב 9',
    cardio: { mode: 'interval', rounds: 12, workSec: 180, restSec: 60, prepSec: 10,
              targetSec: null, roundLog },
    nutritionalState: 'deficit'
});

// ── 1. נפח: details ריק → כל מדד נפח מקבל 0 ──────────────────────────────
const volOf = e => (!e || !e.details) ? 0 : Object.values(e.details).reduce((t, x) => t + (x.vol || 0), 0);
const setsOf = e => (!e || !e.details) ? 0 : Object.values(e.details).reduce((t, x) => t + (x.sets ? x.sets.length : 0), 0);
ok(entry.details && Object.keys(entry.details).length === 0, 'details ריק — לאימון אירובי אין נפח');
ok(volOf(entry) === 0, 'getWorkoutVolume מחזיר 0');
ok(setsOf(entry) === 0, 'getWorkoutTotalSets מחזיר 0');
ok(Array.isArray(entry.log) && entry.log.length === 0, 'log ריק — אין סטים');

// ── 2. סינון האנליטיקה — אותו תנאי של getArchiveClean ────────────────────
const strength = { timestamp: 1, details: { Squat: { sets: ['100x5'], vol: 500 } } };
const clean = [entry, strength].filter(a => a && a.timestamp && a.kind !== 'cardio');
ok(entry.kind === 'cardio', 'kind = cardio');
ok(clean.length === 1 && clean[0] === strength, 'האירובי מסונן מהארכיון של האנליטיקה');

// ── 3. גבולות Firestore ──────────────────────────────────────────────────
ok(Array.isArray(entry.cardio.rounds) && entry.cardio.rounds.every(r => r && typeof r === 'object' && !Array.isArray(r)),
   'cardio.rounds הוא מערך של maps — לא מערך בתוך מערך');
const hasUndefined = o => Object.keys(o).some(k => o[k] === undefined);
ok(!hasUndefined(entry) && !hasUndefined(entry.cardio) && entry.cardio.rounds.every(r => !hasUndefined(r)),
   'אין שדה undefined באף רמה (Firestore דוחה undefined; null מותר)');
ok(entry.cardio.rounds[11].combo === null, 'סבב בלי קומבינציה נשמר null ולא undefined');
ok(JSON.stringify(entry).length < 5000, 'הרשומה קטנה — אין צורך ב-chunking נוסף');

// ── 4. סיכומי הזמן בפועל ──────────────────────────────────────────────────
ok(entry.cardio.workTotalSec === 11 * 180 + 132, 'workTotalSec נסכם מהסבבים בפועל, לא מהמתוכנן');
ok(entry.cardio.restTotalSec === 11 * 60, 'restTotalSec נסכם מהסבבים בפועל');
ok(entry.cardio.roundsDone === 12 && entry.cardio.roundsPlanned === 12, 'roundsDone/roundsPlanned');

// ── 5. טקסט הסיכום — אותה כותרת של אימון כוח, שורות סבבים במקום סטים ─────
ok(entry.summary.startsWith('GYMPRO ELITE SUMMARY'), 'כותרת זהה לאימון כוח (צינורות ההעתקה/AI לא נשברים)');
ok(entry.summary.includes('Week 2') && entry.summary.includes('48m'), 'שורת המטא נושאת שבוע ומשך');
ok(entry.summary.includes('אירובי (סבבים)'), 'סוג האימון מופיע בטקסט');
ok(entry.summary.includes('הערה: הרגליים כבדו בסבב 9'), 'ההערה נכנסת לטקסט');
ok(/סבב 12: עבודה 02:12.*נקטע/.test(entry.summary), 'סבב שנקטע מסומן בטקסט');
ok(entry.summary.includes('סבב 1: עבודה 03:00 · מנוחה 01:00 | ג׳ב · קרוס'), 'שורת סבב נושאת עבודה, מנוחה וקומבינציה');
ok(!/RIR|Vol:/.test(entry.summary), 'אין שאריות של שפת הסטים (RIR/Vol) בטקסט אירובי');

// ── 6. בחירת הקומבינציה לפי סבב ──────────────────────────────────────────
const combos = [{ from: 1, to: 4, text: 'A' }, { from: 5, to: 8, text: 'B' }, { from: 9, to: 12, text: 'C' }];
ok(cardioComboFor(combos, 1) === 'A' && cardioComboFor(combos, 4) === 'A', 'גבולות הטווח כלולים');
ok(cardioComboFor(combos, 5) === 'B' && cardioComboFor(combos, 12) === 'C', 'סבב נופל לטווח הנכון');
ok(cardioComboFor(combos, 13) === '', 'סבב מחוץ לכל טווח → מחרוזת ריקה');
ok(cardioComboFor([{ from: 1, to: 9, text: 'X' }, { from: 3, to: 5, text: 'Y' }], 4) === 'X',
   'חפיפה: הטווח הראשון שמכסה מנצח — דטרמיניסטי');
ok(cardioComboFor(null, 3) === '' && cardioComboFor(undefined, 1) === '', 'אין קומבינציות → אין קריסה');

// ── 7. סיכומי הזמן המתוכנן (מסך ההיכון וכרטיס התוכנית) ───────────────────
const t = cardioTotals({ rounds: 12, workSec: 180, restSec: 60, prepSec: 10 });
ok(t.workTotalSec === 2160, 'עבודה מתוכננת = סבבים × אורך סבב');
ok(t.restTotalSec === 660, 'מנוחה מתוכננת = (סבבים-1) × מנוחה — אין מנוחה אחרי הסבב האחרון');
ok(t.totalSec === 2160 + 660 + 10, 'משך האימון כולל את ההיכון');
ok(cardioTotals({ rounds: 1, workSec: 300, restSec: 60, prepSec: 0 }).restTotalSec === 0,
   'סבב יחיד — אין מנוחה בכלל');

// ── 8. מודל רציף (אופניים/ריצה/הליכה) ────────────────────────────────────
const open = buildCardioArchiveEntry({
    timestamp: 1789200000000, dateStr: '12.09.26', timeStr: '07:10',
    type: 'אופניים', week: 2, duration: 52, note: '',
    cardio: { mode: 'open', rounds: 1, workSec: 0, restSec: 0, prepSec: 0, targetSec: 1800,
              roundLog: [{ i: 1, workSec: 3120, restSec: 0, skipped: false, combo: null }] },
    nutritionalState: null
});
ok(open.cardio.mode === 'open' && open.kind === 'cardio', 'מודל רציף נשמר כאירובי');
ok(volOf(open) === 0, 'גם לרציף אין נפח');
ok(open.cardio.workTotalSec === 3120, 'זמן בתנועה נסכם');
ok(open.summary.includes('זמן בתנועה: 52:00') && open.summary.includes('יעד 30:00'), 'שורת הרציף נושאת זמן ויעד');
ok(!open.summary.includes('סבב 1:'), 'רציף אינו מדפיס שורות סבבים');

console.log(failed ? `\n${failed} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(failed ? 1 : 0);
