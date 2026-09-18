/* ============================================================================
 * test/exercise-history.test.js — {exerciseHistory} מעביר את התיעוד מילה במילה
 * הרצה: node test/exercise-history.test.js   (ללא תלויות, ללא build)
 *
 * הבלוק נטען מסמני EXHISTORY ב-workout-core.js — מקור אמת אחד.
 *
 * מה הבדיקה חורתת: המקטע נבנה מ-`entry.summary` ולא מ-`entry.log`, כדי שלא
 * יאבד **דבר**. הכשל שהיא מונעת הוא ספציפי ומתועד: סטי הפיק ב-Bench Press
 * נושאים הערת "[ספוטר]", וספוטר שווה חצי חזרה עד חזרה (3.5–7 ק"ג ב-e1RM).
 * רינדור מחדש שמשמיט את ההערה הופך השוואה לא-אחידה לנראית אחידה — כלומר
 * מייצר בדיוק את הרגרסיה-המדומה שהמקטע נועד למנוע. בנוסף ההערה נושאת מידע
 * שאין בשום שדה אחר ("עשיתי חמישי, נכשלתי בו" = הסט הגיע לכשל, לא נעצר).
 *
 * כלל הקיצוץ: מקצצים **סשנים** (3→2→1), לעולם לא תוכן של סשן.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'workout-core.js'), 'utf8');
const block = src.split('EXHISTORY-START')[1]?.split('EXHISTORY-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק EXHISTORY לא נמצא ב-workout-core.js'); process.exit(1); }

const { _exBlockFor, _buildExerciseHistory, _buildExerciseHistoryCapped, EX_HISTORY_SESSIONS } =
    new Function(block + '\nreturn { _exBlockFor, _buildExerciseHistory, _buildExerciseHistoryCapped, EX_HISTORY_SESSIONS };')();

let failed = 0;
function ok(cond, name, extra) {
    console.log(`${cond ? '✓' : '✗'} ${name}${cond || !extra ? '' : `\n    ${extra}`}`);
    if (!cond) failed++;
}

// ── פיקסטורות מהארכיון האמיתי (11.9 / 4.9 / 28.8 + סשן Cluster) ──────────
const S_1109 = [
    'GYMPRO ELITE SUMMARY',
    'חזה - כתפיים | Week 3 | 11.9.2026 | 78m',
    '',
    'Bench Press (Main) (Main, TM: 115kg) (Vol: 3.1t):',
    '87.5kg x 5 (RIR 5)',
    '97.5kg x 3 (RIR 4)',
    '110kg x 4 (RIR 0.5) | Note: [ספוטר] עשיתי חמישי, נכשלתי בו',
    '100kg x 4 (RIR 2)',
    '90kg x 10 (RIR 1)',
    '90kg x 7 (RIR 2)',
    '',
    'Lateral Raises (צד אחד) (Vol: 1.2t):',
    '16kg x 10 (RIR 1.5)',
    '16kg x 11 (RIR 0) ⤵ 8kg x 12 (RIR 0)',
    ''
].join('\n');

const S_0409 = [
    'GYMPRO ELITE SUMMARY',
    'חזה - כתפיים | Week 2 | 4.9.2026 | 57m',
    '',
    'Bench Press (Main) (Main, TM: 115kg) (Vol: 3.5t):',
    '80kg x 3 (RIR 5)',
    '105kg x 5 (RIR 1) | Note: [ספוטר] לא יודע אם 1 או 0.75. מעריך ש-1 בגריינד עמוק',
    '80kg x 10 (RIR 2)',
    '',
    'Face Pulls (Vol: 1.5t):',
    'הערת תרגיל: חזרתי לאחיזה מלאה (כבר באימונים הקודמים)',
    '35kg x 14 (RIR 2.5)',
    ''
].join('\n');

const S_2808 = [
    'GYMPRO ELITE SUMMARY',
    'חזה - כתפיים | Week 1 | 28.8.2026 | 69m',
    '',
    'Bench Press (Main) (Main, TM: 115kg) (Vol: 3.5t):',
    '75kg x 5 (RIR 5)',
    '75kg x 15 (RIR 3)',
    '',
    'Barbell Shrugs: (Skipped)',
    ''
].join('\n');

const S_CLUSTER = [
    'GYMPRO ELITE SUMMARY',
    'רוטינת גב | Week 3 | 9.9.2026 | 52m',
    '',
    'Cluster סבב 1:',
    '  Pull Ups: 20kg x 8 (RIR 2) | Note: לא יישור מספיק',
    '  Inverted Rows: 0kg x 12 (RIR 2)',
    '',
    'Cluster סבב 2:',
    '  Pull Ups: 20kg x 6 (RIR 2) | Note: [יישור מלא]',
    '  Inverted Rows: 0kg x 12 (RIR 2)',
    ''
].join('\n');

// ── אי-אובדן: כל סט וכל הערה שורדים ──────────────────────────────────────
const bp = _exBlockFor(S_1109, 'Bench Press (Main)');
ok(bp.split('\n').length === 7, 'כל שש שורות הסטים + הכותרת נשמרות (11.9)', `התקבל: ${bp.split('\n').length} שורות`);
ok(bp.includes('[ספוטר] עשיתי חמישי, נכשלתי בו'), 'הערת הספוטר נשמרת מילה במילה');
ok(bp.includes('90kg x 7 (RIR 2)'), 'הסט האחרון אינו נופל');
ok(bp.includes('Main, TM: 115kg'), 'שורת הכותרת נושאת את ה-TM');

ok(_exBlockFor(S_0409, 'Bench Press (Main)').includes('מעריך ש-1 בגריינד עמוק'),
   'הערת הספוטר של 4.9 נשמרת מילה במילה');
ok(_exBlockFor(S_0409, 'Face Pulls').includes('הערת תרגיל: חזרתי לאחיזה מלאה'),
   'הערת תרגיל (ולא רק הערת סט) נשמרת');
ok(_exBlockFor(S_2808, 'Bench Press (Main)').includes('75kg x 15 (RIR 3)'),
   'הסט האחרון של 28.8 אינו נופל');
ok(_exBlockFor(S_1109, 'Lateral Raises').includes('⤵ 8kg x 12 (RIR 0)'),
   'חץ הדרופ-סט נשמר');
ok(_exBlockFor(S_2808, 'Barbell Shrugs') === 'Barbell Shrugs: (Skipped)',
   'תגית (Skipped) נשמרת כבלוק בפני עצמו');

// ── Cluster: השורות והסבבים ──────────────────────────────────────────────
const pu = _exBlockFor(S_CLUSTER, 'Pull Ups');
ok(pu.includes('Cluster סבב 1:') && pu.includes('Cluster סבב 2:'), 'כותרות הסבבים נשמרות ב-Cluster');
ok(pu.includes('Note: לא יישור מספיק') && pu.includes('Note: [יישור מלא]'), 'הערות בתוך Cluster נשמרות');
ok(!pu.includes('Inverted Rows'), 'בלוק Cluster אינו בולע תרגילים אחרים');

// ── בידוד שמות: תרגיל אחד אינו בולע תרגיל ששמו מכיל אותו ─────────────────
const S_LR = ['Cable Lateral Raises (צד אחד) (Vol: 720kg):', '4 פלטות x 12 (RIR 1)', '',
              'Lateral Raises (צד אחד) (Vol: 800kg):', '16kg x 9 (RIR 2)', ''].join('\n');
ok(_exBlockFor(S_LR, 'Lateral Raises').split('\n').length === 2,
   '"Lateral Raises" אינו תופס את "Cable Lateral Raises"');
ok(_exBlockFor(S_LR, 'Cable Lateral Raises').includes('4 פלטות x 12 (RIR 1)'),
   '"Cable Lateral Raises" נתפס בנפרד');
ok(_exBlockFor(S_1109, 'Leg Press') === '', 'תרגיל שלא בוצע מחזיר ריק');

// ── המקטע המלא ───────────────────────────────────────────────────────────
const cur = { timestamp: 1000, exOrder: ['Bench Press (Main)', 'Leg Press'], summary: 'x' };
const archive = [   // חדש→ישן, כמו באפליקציה
    { timestamp: 900, date: '11.09.26', type: 'חזה - כתפיים', week: 3, nutritionalState: 'surplus', summary: S_1109 },
    { timestamp: 800, date: '04.09.26', type: 'חזה - כתפיים', week: 2, nutritionalState: 'surplus', summary: S_0409 },
    { timestamp: 700, date: '28.08.26', type: 'חזה - כתפיים', week: 1, nutritionalState: 'surplus', summary: S_2808 },
    { timestamp: 600, date: '14.09.26', type: 'כתפיים - חזה - מופחת', week: 'deload', nutritionalState: 'surplus', summary: S_CLUSTER }
];
const full = _buildExerciseHistory(cur, archive, EX_HISTORY_SESSIONS);
ok(full.includes('── Bench Press (Main) ──'), 'כותרת לכל תרגיל');
ok((full.match(/▸ /g) || []).length === 3, 'שלושה סשנים ל-Bench Press', `התקבל: ${(full.match(/▸ /g) || []).length}`);
ok(full.includes('Week 3') && full.includes('Week 1'), 'תגית השבוע מופיעה בשורת הסשן');
ok(full.includes('[מצב תזונתי: surplus]'), 'המצב התזונתי מתויג לכל סשן');
ok(full.includes('לא בוצע קודם לכן בארכיון'), 'תרגיל בלי היסטוריה מדווח במפורש ולא נשמט');
ok(!full.includes('14.09.26'), 'סשן מאוחר מהאימון הנוכחי אינו נכלל');

// שני סטי הספוטר — הבדיקה המרכזית
ok(full.includes('[ספוטר] עשיתי חמישי, נכשלתי בו') && full.includes('מעריך ש-1 בגריינד עמוק'),
   'שתי הערות הספוטר מגיעות למקטע המוגמר');

// ── קיצוץ: סשנים ולא תוכן ────────────────────────────────────────────────
const n2 = _buildExerciseHistory(cur, archive, 2);
ok((n2.match(/▸ /g) || []).length === 2, 'קיצוץ ל-2 סשנים מוריד סשן שלם');
ok(n2.includes('[ספוטר] עשיתי חמישי, נכשלתי בו'),
   'גם אחרי קיצוץ — הסשנים שנשארו מלאים, עם ההערות');
ok(_buildExerciseHistoryCapped(cur, archive).length > 0, 'הגרסה עם התקרה מחזירה טקסט');

console.log(failed ? `\n${failed} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(failed ? 1 : 0);
