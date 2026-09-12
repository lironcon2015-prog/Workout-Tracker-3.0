/* ============================================================================
 * test/coach-prompts.test.js — חוזה ה-placeholders של פרומפטי המאמן
 * הרצה: node test/coach-prompts.test.js   (ללא תלויות, ללא build)
 *
 * הבדיקה קוראת את הקבועים עצמם מ-workout-core.js ומ-archive-logic.js —
 * מקור אמת אחד, בלי להעתיק טקסט פרומפט לכאן.
 *
 * הכשל השקט שהיא מונעת: פרומפטי המאמן עברו מ-literal עם ${...} בתוך הפונקציה
 * לתבניות בעלות שם שממולאות ב-_fillTemplate. מרגע זה יש חוזה בין התבנית
 * לקריאה — וכל הפרה שלו **שקטה לחלוטין**:
 *   1. placeholder בתבנית שאיש לא ממלא → המחרוזת "{persona}" נשלחת למודל כמות
 *      שהיא. המודל עונה, שום דבר לא זורק, והנתון פשוט לא הגיע.
 *   2. מפתח שנשלח ב-_fillTemplate ואין לו placeholder → הנתון נזרק בשקט.
 *   3. ${...} שנשאר בתוך תבנית סטטית → נשלח כטקסט מילולי.
 * שלושתם נראים בדיוק כמו פרומפט תקין עד שקוראים את הפלט של המודל.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SRC = {
    'workout-core.js': fs.readFileSync(path.join(root, 'workout-core.js'), 'utf8'),
    'archive-logic.js': fs.readFileSync(path.join(root, 'archive-logic.js'), 'utf8'),
    'storage.js': fs.readFileSync(path.join(root, 'storage.js'), 'utf8')
};

let fail = 0;
const chk = (ok, msg, extra = '') => { console.log(`${ok ? '✓' : '✗'} ${msg}${extra ? ' — ' + extra : ''}`); if (!ok) fail++; };

// ── חילוץ תוכן template-literal של קבוע לפי שמו ──────────────────────
function constLiteral(src, name) {
    const i = src.indexOf('const ' + name + ' =');
    if (i < 0) return null;
    const s = src.indexOf('`', i) + 1;
    let e = s;
    for (;;) { e = src.indexOf('`', e); if (e < 0) return null; if (src[e - 1] !== '\\') break; e++; }
    return src.slice(s, e);
}

// ── חילוץ מפתחות האובייקט שנשלח ל-_fillTemplate(NAME, { ... }) ────────
// סופר סוגריים כדי לא להיחתך על אובייקט רב-שורתי, ומזהה מפתחות ברמה העליונה
// בלבד (כולל קיצור `exName,`).
function fillKeys(src, tplName) {
    const call = '_fillTemplate(' + tplName + ',';
    const i = src.indexOf(call);
    if (i < 0) return null;
    const open = src.indexOf('{', i + call.length);
    if (open < 0) return null;
    let depth = 0, end = open;
    for (let k = open; k < src.length; k++) {
        if (src[k] === '{') depth++;
        else if (src[k] === '}') { depth--; if (!depth) { end = k; break; } }
    }
    const body = src.slice(open + 1, end);
    const keys = new Set();
    let d = 0;
    let line = '';
    const flush = () => {
        const m = line.trim().match(/^([A-Za-z_$][\w$]*)\s*(:|$)/);
        if (m) keys.add(m[1]);
        line = '';
    };
    for (const ch of body) {
        if ('{(['.includes(ch)) d++;
        if ('})]'.includes(ch)) d--;
        if (ch === ',' && d === 0) flush(); else line += ch;
    }
    flush();
    return keys;
}

const placeholders = tpl => new Set((tpl.match(/\{[A-Za-z][\w]*\}/g) || []).map(x => x.slice(1, -1)));
const setEq = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
const diff = (a, b) => [...a].filter(x => !b.has(x));

// ── התבניות בעלות השם + קריאות המילוי שלהן ──────────────────────────
const TPLS = [
    ['COACH_SET_REC_TPL', 'workout-core.js', 'workout-core.js'],
    ['COACH_REFINE_TPL', 'workout-core.js', 'workout-core.js'],
    ['COACH_MEMORY_TPL', 'workout-core.js', 'workout-core.js'],
    ['COACH_PLATEAU_TPL', 'archive-logic.js', 'archive-logic.js']
];

for (const [name, tplFile, callFile] of TPLS) {
    const tpl = constLiteral(SRC[tplFile], name);
    if (!tpl) { chk(false, `${name} — הקבוע לא נמצא ב-${tplFile}`); continue; }

    chk(!/\$\{/.test(tpl), `${name} — אין ${'${...}'} שנשאר בתבנית הסטטית`);

    const have = placeholders(tpl);
    const sent = fillKeys(SRC[callFile], name);
    if (!sent) { chk(false, `${name} — לא נמצאה קריאת _fillTemplate ב-${callFile}`); continue; }

    chk(setEq(have, sent), `${name} — כל placeholder ממולא וכל מפתח מגיע ליעד`,
        setEq(have, sent) ? `${have.size} שדות` :
            `בתבנית ולא נשלח: [${diff(have, sent)}] · נשלח ואין לו מקום: [${diff(sent, have)}]`);
}

// ── הוראות הצ'אט — טקסט סטטי, אסור שיהיו בו placeholders או ${} ─────
const chat = constLiteral(SRC['workout-core.js'], 'COACH_CHAT_INSTRUCTIONS');
chk(!!chat, 'COACH_CHAT_INSTRUCTIONS — הקבוע קיים');
if (chat) {
    chk(placeholders(chat).size === 0, 'COACH_CHAT_INSTRUCTIONS — בלי placeholders (הנתונים מוזרקים אחריו)');
    // ${...} שנשאר היה הופך את הוראות המאמן לטקסט שבור; אין כאן אינטרפולציה לגיטימית
    chk(!/\$\{/.test(chat), 'COACH_CHAT_INSTRUCTIONS — בלי ${...}');
    chk(chat.includes('buildSystemPrompt') === false, 'COACH_CHAT_INSTRUCTIONS — מכיל טקסט בלבד');
}
chk(/let prompt = COACH_CHAT_INSTRUCTIONS;/.test(SRC['workout-core.js']),
    'buildSystemPrompt משתמש בקבוע ולא ב-literal משוכפל');

// ── שלושת פרומפטי הסיכום (ניתנים לעריכה) מול המפתחות ש-_buildCoachSummaryPrompt שולח
const summarySent = fillKeys(SRC['workout-core.js'], 'template');
chk(!!summarySent, '_buildCoachSummaryPrompt — נמצאה קריאת המילוי');
if (summarySent) {
    const defaults = SRC['storage.js'].slice(SRC['storage.js'].indexOf('COACH_PROMPT_DEFAULTS:'));
    ['workout', 'week', 'block'].forEach(scope => {
        const i = defaults.indexOf(scope + ':');
        const s = defaults.indexOf('`', i) + 1;
        const e = defaults.indexOf('`', s);
        const tpl = defaults.slice(s, e);
        const have = placeholders(tpl);
        const missing = diff(have, summarySent);
        chk(missing.length === 0, `COACH_PROMPT_DEFAULTS.${scope} — כל placeholder נתמך ע"י בונה הסיכום`,
            missing.length ? `אין להם מקור: [${missing}]` : `${have.size} שדות`);
        chk(have.has('reliability'), `COACH_PROMPT_DEFAULTS.${scope} — כולל {reliability} (כללי האנטי-הזיה)`);
        chk(have.has('memoryBox'), `COACH_PROMPT_DEFAULTS.${scope} — כולל {memoryBox} (כללי תיבת הזיכרון)`);
    });
}

// ── מקטעי-זנב: תבנית מותאמת ישנה לא מכילה placeholder שנוסף אחריה, ואז המקטע
// נופל בשקט. הנפילה לאחור (צירוף בסוף) היא מה שמונע את זה — אם תוסר, שום דבר
// לא יזרוק, פשוט יחסרו נתונים בפרומפט.
const wcSrc = SRC['workout-core.js'];
['{recovery}', '{memoryBox}'].forEach(ph => {
    const re = new RegExp("\\['" + ph.replace(/[{}]/g, '\\$&') + "'");
    chk(re.test(wcSrc), `${ph} — קיימת נפילה לאחור לתבנית שלא מכילה אותו`);
});

// ── ספר הפרומפטים — כל 9 הסוגים רשומים, ולכל אחד כותרת ומקור ────────
const book = SRC['workout-core.js'].slice(
    SRC['workout-core.js'].indexOf('function coachPromptBook()'),
    SRC['workout-core.js'].indexOf('function copyAllCoachPrompts()'));
const titles = (book.match(/^\s+title:/gm) || []).length;
chk(titles === 9, 'coachPromptBook — 9 פרומפטים רשומים', String(titles));
chk((book.match(/^\s+source:/gm) || []).length === titles, 'לכל פרומפט בספר יש שדה מקור');
chk((book.match(/^\s+when:/gm) || []).length === titles, 'לכל פרומפט בספר יש הסבר מתי הוא נשלח');
['COACH_CHAT_INSTRUCTIONS', 'COACH_REFINE_TPL', 'COACH_SET_REC_TPL', 'COACH_MEMORY_TPL', 'COACH_PLATEAU_TPL',
 'COACH_RELIABILITY_BLOCK', "getCoachPrompt('workout')", "getCoachPrompt('week')", "getCoachPrompt('block')"]
    .forEach(ref => chk(book.includes(ref), `הספר מצטט את ${ref} ולא עותק שלו`));

console.log(fail ? `\n${fail} בדיקות נכשלו` : '\nהכל עבר');
process.exit(fail ? 1 : 0);
