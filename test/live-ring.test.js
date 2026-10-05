/* ============================================================================
 * test/live-ring.test.js — טבעת ה-Live: משך אימון צפוי + גודל ספרות
 * הרצה: node test/live-ring.test.js   (ללא תלויות, ללא build)
 *
 * הטבעת הכחולה מתמלאת מול חציון משך 5 האימונים האחרונים מאותו סוג. "אחרונים"
 * נקבע לפי timestamp — entry.date הוא DD.MM.YY ומיון עליו שגוי בשקט (כלל 1).
 * הבדיקה מוודאת גם סינון אירובי/משך 0, הערכה מהתוכנית, וכלל הגודל לספרות.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'workout-core.js'), 'utf8');
const block = src.split('LIVE-RING-START')[1]?.split('LIVE-RING-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק LIVE-RING לא נמצא ב-workout-core.js'); process.exit(1); }

const { _liveExpectedFromArchive, _liveExpectedFromPlan, _liveClock, _liveRingSizeClass } =
    new Function(block + '\nreturn { _liveExpectedFromArchive, _liveExpectedFromPlan, _liveClock, _liveRingSizeClass };')();

let failed = 0;
function ok(cond, name) {
    console.log(`${cond ? '✓' : '✗'} ${name}`);
    if (!cond) failed++;
}

const DAY = 86400000;
const e = (daysAgo, duration, extra) => Object.assign({
    type: 'Upper A', duration, timestamp: 1790000000000 - daysAgo * DAY,
    // date ב-he-IL: מיון מחרוזות עליו היה בוחר אימונים ישנים
    date: new Date(1790000000000 - daysAgo * DAY).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
}, extra || {});

/* ── חציון של 5 האחרונים לפי timestamp ─────────────────────────────── */
const archive = [
    e(40, 120), e(35, 120),                    // ישנים — לא אמורים להיכנס
    e(1, 60), e(8, 62), e(15, 58), e(22, 70), e(29, 64)
].sort(() => Math.random() - 0.5);
ok(_liveExpectedFromArchive(archive, 'Upper A', 5) === 62 * 60, 'חציון 5 האחרונים = 62 דק\'');

/* ── סינון ─────────────────────────────────────────────────────────── */
const mixed = [e(1, 60), e(2, 0), e(3, 45, { kind: 'cardio' }), e(4, 50, { type: 'Lower B' }), e(5, 70)];
ok(_liveExpectedFromArchive(mixed, 'Upper A', 5) === 65 * 60, 'אירובי, סוג אחר ומשך 0 מסוננים; זוגי = ממוצע שני האמצעיים');
ok(_liveExpectedFromArchive([], 'Upper A', 5) === null, 'אין היסטוריה → null');
ok(_liveExpectedFromArchive(archive, '', 5) === null, 'בלי סוג אימון → null');
ok(_liveExpectedFromArchive(null, 'Upper A', 5) === null, 'ארכיון לא תקין → null');

/* ── הערכה מהתוכנית ───────────────────────────────────────────────── */
ok(_liveExpectedFromPlan(20, 90) === 20 * 130, '20 סטים × (90 + 40)');
ok(_liveExpectedFromPlan(10, undefined) === 10 * 130, 'בלי יעד מנוחה → 90 כברירת מחדל');
ok(_liveExpectedFromPlan(0, 90) === null, 'אין סטים מתוכננים → null');

/* ── שעון וגודל ───────────────────────────────────────────────────── */
ok(_liveClock(3527) === '58:47', 'פורמט mm:ss');
ok(_liveClock(6267) === '104:27', 'מעל 100 דקות — 6 תווים');
ok(_liveRingSizeClass('99:59') === '', '5 תווים — גודל מלא');
ok(_liveRingSizeClass('104:27') === 'is-long', '6 תווים — is-long');
ok(_liveRingSizeClass('1000:00') === 'is-xlong', '7 תווים — is-xlong');
ok(_liveRingSizeClass('18/24') === '', 'סטים 18/24 — גודל מלא');

console.log(failed ? `\n${failed} נכשלו` : '\nהכול עבר');
process.exit(failed ? 1 : 0);
