/* ============================================================================
 * test/metrics-text.test.js — גוש "מדדי האימון" בטקסט ההעתקה
 * הרצה: node test/metrics-text.test.js   (ללא תלויות, ללא build)
 *
 * הרקע: לשונית "מדדים" מציגה שלושה כרטיסים (שעון · מוכנות הבוקר · הקשר),
 * אבל טקסט ההעתקה נשא רק שורת שעון חלקית — בלי סוג/משך, בלי דופק מזערי,
 * בלי קלוריות סה"כ, בלי טווחי האזורים, ובלי שני הכרטיסים האחרים.
 * הבדיקה מוודאת שכל שדה שהמסך מציג מגיע גם לטקסט.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'workout-core.js'), 'utf8');
const block = src.split('METRICSTEXT-START')[1]?.split('METRICSTEXT-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק METRICSTEXT לא נמצא ב-workout-core.js'); process.exit(1); }

// תלויות חיצוניות של הבלוק — מוזרקות כ-stub
const _fmtClock = sec => {
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
let _rdFixture = null, _ctxFixture = [];
const _readinessFor = () => _rdFixture;
const _contextRows  = () => _ctxFixture;
const _slFmtDur     = min => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

const { watchSummaryLine, buildMetricsSummaryText } = new Function(
    '_fmtClock', '_readinessFor', '_contextRows', '_slFmtDur',
    block + '\nreturn { watchSummaryLine, buildMetricsSummaryText };'
)(_fmtClock, _readinessFor, _contextRows, _slFmtDur);

let failed = 0;
function ok(cond, name) {
    console.log(`${cond ? '✓' : '✗'} ${name}`);
    if (!cond) failed++;
}

// רשומה אמיתית — האימון מהצילום: 31.08, 39 דק', דופק 91/132, 186 קק"ל,
// Z1 = 39:34 ו-Z2 = 00:08 (שמונה שניות — מדידה אמיתית שהמסך מציג).
const watch = {
    wType: 'Traditional Strength Training', durMin: 39,
    hrAvg: 91, hrMax: 132, hrMin: 70,
    activeKcal: 186, totalKcal: 250, hrRecovery1: 12,
    zoneSec: [2374, 8, 0, 0, 0], zoneBounds: [128, 140, 153, 165],
    linkedBy: 'auto', hrSeries: [[0, 88, 91, 95]]
};
const entry = { timestamp: 1756618440000, watch };

const wl = watchSummaryLine(entry);
console.log('\n' + wl + '\n');

ok(wl.includes('Traditional Strength Training'), 'סוג האימון נכלל');
ok(wl.includes('39 דק׳'),            'משך האימון נכלל');
ok(wl.includes('דופק ממוצע 91'),      'דופק ממוצע');
ok(wl.includes('מרבי 132'),           'דופק מרבי');
ok(wl.includes('מזערי 70'),           'דופק מזערי — נעדר קודם');
ok(wl.includes('186 קק"ל פעילות'),    'קלוריות פעילות');
ok(wl.includes('250 קק"ל סה"כ'),      'קלוריות סה"כ — נעדרו קודם');
ok(wl.includes('התאוששות ׳1 12'),     'התאוששות דופק');
ok(wl.includes('Z1 <128 39:34'),      'Z1 עם הטווח ועם הזמן המדויק');
ok(wl.includes('Z2 128–139 00:08'),   'Z2 של 8 שניות נכלל — הסף הישן (30ש\') השמיט אותו');
ok(!wl.includes('Z3'),                'אזור באפס אינו נכנס (רעש, לא מידע)');

// אזורים בלי גבולות — לא ניתן לתאר טווח, ולכן אין שורת אזורים (ולא קריסה)
ok(!watchSummaryLine({ watch: { hrAvg: 90, zoneSec: [10, 0, 0, 0, 0] } }).includes('אזורי דופק'),
   'בלי zoneBounds אין שורת אזורים');
ok(watchSummaryLine({}) === '' && watchSummaryLine({ watch: null }) === '',
   'אימון בלי נתוני שעון מחזיר מחרוזת ריקה');

// הגוש המלא — שלושת הכרטיסים
_rdFixture = { rd: { score: 78, band: 'טובה', usedCount: 3, totalCount: 4,
                     drivers: [{ label: 'HRV', delta: '+6', dir: 'up' }] },
               night: { asleepMin: 445 } };
_ctxFixture = [['מצב תזונתי', 'Surplus'], ['משקל אחרון', '82.4 ק״ג']];
const full = buildMetricsSummaryText(entry);
console.log('\n' + full + '\n');

ok(full.startsWith('=== מדדי האימון ==='), 'כותרת הגוש');
ok(full.includes('שעון:'),                 'כרטיס השעון');
ok(full.includes('מוכנות הבוקר: 78 (טובה)'), 'כרטיס המוכנות — נעדר לגמרי קודם');
ok(full.includes('שינה 7:25'),             'משך השינה');
ok(full.includes('HRV +6'),                'מניעי המוכנות');
ok(full.includes('מצב תזונתי: Surplus'),   'כרטיס ההקשר — נעדר לגמרי קודם');
ok(full.includes('משקל אחרון: 82.4 ק״ג'),  'משקל אחרון');

// אימון בלי שום מדד — אין גוש ואין כותרת מיותרת
_rdFixture = null; _ctxFixture = [];
ok(buildMetricsSummaryText({ timestamp: 1 }) === '', 'בלי מדדים כלל — אין גוש ריק');

console.log(failed ? `\n${failed} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(failed ? 1 : 0);
