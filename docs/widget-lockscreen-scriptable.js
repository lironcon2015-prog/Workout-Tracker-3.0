/**
 * GYMPRO ELITE — ווידג'ט מסך הנעילה (Scriptable, iOS 16+)
 * ----------------------------------------------------------------------------
 * סקריפט נפרד מ-docs/widget-scriptable.js (ווידג'ט מסך הבית). מושך את אותו
 * snapshot מאותו גשר (docs/widget-bridge.gs) — אין צורך בהגדרה חדשה באפליקציה,
 * רק להדביק כאן את אותם URL ו-token.
 *
 * למה סקריפט נפרד: ווידג'טי מסך נעילה ("accessory") הם עולם רינדור אחר —
 *   • הם זעירים (עיגול ~72pt, מלבן ~160×72pt, שורה אחת מעל השעון);
 *   • iOS מרנדר אותם ב-vibrancy מונוכרומטי — **צבע נזרק**, רק ה-alpha נשמר.
 *     לכן אין כאן ירוק/אדום סמנטי, אין גרדיאנט וצבעי מאקרו — ההיררכיה נבנית
 *     מעוצמת שקיפות (מלא / בינוני / עמום) ומגודל פונט בלבד.
 *   • אין רקע — הווידג'ט שקוף מעל התמונה של מסך הנעילה.
 * העברה של פריסת מסך הבית לכאן פשוט לא נכנסת ולא נקראת. מכאן הפריסות החדשות.
 *
 * ── שלוש הפריסות (הסקריפט מזהה לבד לפי גודל הווידג'ט) ─────────────────────
 *   accessoryCircular    — טבעת התקדמות קלוריות + קק"ל שנותרו במרכז.
 *   accessoryRectangular — קק"ל/יעד + פס התקדמות + מאקרו ומשקל.
 *   accessoryInline      — שורת טקסט מעל השעון: קק"ל שנותרו · משקל.
 *
 * ── התקנה (חד-פעמי) ────────────────────────────────────────────────────────
 * 1. ודא שגשר הווידג'ט פרוס (docs/widget-bridge.gs) ושהאפליקציה דחפה snapshot
 *    (הגדרות → ווידג'ט אייפון → "דחוף snapshot עכשיו").
 * 2. Scriptable → + → הדבק את כל הקובץ הזה → שנה למטה את BRIDGE_URL ו-TOKEN
 *    (אותם ערכים כמו בווידג'ט מסך הבית). קרא לסקריפט "GYMPRO Lock".
 * 3. מסך הנעילה → לחיצה ארוכה → Customize → מסך הנעילה → הקש על אזור
 *    הווידג'טים (מתחת לשעון, או השורה הצרה מעליו) → בחר Scriptable.
 * 4. הקש על הווידג'ט שנוסף → Script: "GYMPRO Lock", When Interacting: Run Script.
 *
 * אפשר להוסיף את שלוש הפריסות במקביל — אותו סקריפט משרת את כולן.
 * iOS מרענן ווידג'טים כל ~15-30 דק'; הנתונים טריים כמו השימוש האחרון באפליקציה.
 * ==========================================================================*/

// 🔐 הדבק את ה-URL וה-token של גשר הווידג'ט (אותם ערכים כמו בהגדרות GYMPRO)
const BRIDGE_URL = 'PASTE_WEB_APP_URL_HERE';
const TOKEN = 'PASTE_SECRET_TOKEN_HERE';

// רקע מערכת לווידג'ט העגול (העיגול המעומעם של iOS). false = רק הטבעת שלנו.
const ACCESSORY_BG = false;

// מעל כמה שעות ה-snapshot נחשב "ישן" ומוצגת שעת העדכון (מלבן בלבד).
const STALE_HOURS = 6;

// לחיצה על הווידג'ט: iOS אינו מאפשר לפתוח PWA מבחוץ (web clip אינו ברשימת
// "Open App" של Shortcuts, וקישור לכתובת נפתח בספארי — אחסון נפרד!).
// לכן הווידג'ט הוא תצוגה בלבד, כמו זה של מסך הבית.
const TAP_URL = '';

// ── שכבות בהירות (במקום צבעים — vibrancy זורק צבע ומשאיר alpha) ──
const A = { full: 1, mid: 0.72, soft: 0.5, dim: 0.38, track: 0.2 };
const w_ = a => new Color('#ffffff', a);

// ── משיכת ה-snapshot מהגשר ──
let snap = null;
try {
    const req = new Request(BRIDGE_URL + '?token=' + encodeURIComponent(TOKEN));
    const j = await req.loadJSON();
    if (j && j.ok) snap = j.snapshot;
} catch (e) { /* אין רשת — תוצג הודעת שגיאה קצרה */ }

const family = config.widgetFamily || 'accessoryRectangular';   // בעורך אין family
const widget = new ListWidget();
if (TAP_URL) widget.url = TAP_URL;
widget.setPadding(0, 0, 0, 0);
// בקשת רענון צפופה (5 דק') — iOS לא מתחייב אבל מתקרב אליה כשיש תקציב.
widget.refreshAfterDate = new Date(Date.now() + 5 * 60000);

if (family === 'accessoryCircular') {
    if (ACCESSORY_BG) widget.addAccessoryWidgetBackground = true;
    buildCircular(widget, snap);
} else if (family === 'accessoryInline') {
    buildInline(widget, snap);
} else {
    // accessoryRectangular — וגם fallback אם הווידג'ט הוסף בטעות למסך הבית
    if (family === 'small' || family === 'medium' || family === 'large') {
        widget.backgroundColor = new Color('#161619');
        widget.setPadding(12, 14, 12, 14);
    }
    buildRectangular(widget, snap);
}

Script.setWidget(widget);
if (config.runsInApp) {                       // ▶ בעורך = תצוגה מקדימה
    if (family === 'accessoryCircular') widget.presentAccessoryCircular();
    else if (family === 'accessoryInline') widget.presentAccessoryInline();
    else widget.presentAccessoryRectangular();
}
Script.complete();

// ═══════════════ פריסה 1: עיגול — טבעת קלוריות ═══════════════
// הטבעת היא backgroundImage (DrawContext), והטקסט נערם מעליה במרכז.
// ה-alpha של התמונה הוא מה ש-iOS ממסך — לכן track עמום ומילוי מלא נקראים היטב.
function buildCircular(w, s) {
    const n = (s && s.nutrition) || {};
    const target = n.kcalTarget || 0;
    const kcal = n.calories || 0;
    const pct = target > 0 ? kcal / target : 0;

    w.backgroundImage = ringImage(Math.min(1, pct));

    // מרכוז אנכי ואופקי של תוכן הטבעת
    w.addSpacer();
    const big = centeredText(w, s ? (target > 0 ? fmtNum(Math.abs(target - kcal)) : fmtNum(kcal)) : '—');
    big.font = Font.blackRoundedSystemFont(16);
    big.textColor = w_(A.full);
    big.minimumScaleFactor = 0.6;
    big.lineLimit = 1;
    const lbl = centeredText(w, !s ? 'אין נתונים' : target > 0 ? (kcal <= target ? 'נותרו' : 'מעל') : 'קק"ל');
    lbl.font = Font.semiboldSystemFont(8);
    lbl.textColor = w_(A.soft);
    lbl.lineLimit = 1;
    w.addSpacer();
}

// ═══════════════ פריסה 2: מלבן — קלוריות + פס + מאקרו/משקל ═══════════════
// כלל RTL ב-Scriptable: ה-stacks הם LTR; "יישור לימין" = spacer גמיש ראשון,
// והרכיב הימני-ויזואלית נוסף אחרון.
function buildRectangular(w, s) {
    if (!s) {
        const t = w.addText('GYMPRO — אין נתונים');
        t.font = Font.semiboldSystemFont(11); t.textColor = w_(A.mid);
        const m = w.addText('פתח את האפליקציה ודחוף snapshot');
        m.font = Font.mediumSystemFont(9); m.textColor = w_(A.soft); m.lineLimit = 2;
        return;
    }
    const n = s.nutrition || {};
    const target = n.kcalTarget || 0;
    const kcal = n.calories || 0;
    const pct = target > 0 ? Math.min(1, kcal / target) : 0;

    // ── שורה 1: קק"ל/יעד מימין, שעת עדכון משמאל אם ה-snapshot ישן ──
    const top = w.addStack();
    top.layoutHorizontally(); top.bottomAlignContent();
    if (isStale(s.generated)) {
        const st = top.addText(fmtTime(s.generated));
        st.font = Font.mediumSystemFont(8); st.textColor = w_(A.dim);
    }
    top.addSpacer();
    if (target > 0) {
        const tgt = top.addText('/ ' + fmtNum(target));
        tgt.font = Font.semiboldRoundedSystemFont(10); tgt.textColor = w_(A.soft);
    }
    const big = top.addText(fmtNum(kcal));
    big.font = Font.blackRoundedSystemFont(15); big.textColor = w_(A.full);
    big.minimumScaleFactor = 0.7; big.lineLimit = 1;
    const unit = top.addText(' קק"ל');
    unit.font = Font.semiboldSystemFont(9); unit.textColor = w_(A.soft);

    w.addSpacer(4);
    addBar(w, pct);
    w.addSpacer(5);

    // ── שורה 3: מאקרו מימין, משקל+מגמה משמאל ──
    const bottom = w.addStack();
    bottom.layoutHorizontally(); bottom.centerAlignContent();
    if (s.weight) {
        const wg = bottom.addStack();
        wg.layoutHorizontally(); wg.centerAlignContent(); wg.spacing = 3;
        const d = wg.addText(deltaText(s.weight.weekDelta));   // LTR: ראשון = שמאל
        d.font = Font.semiboldRoundedSystemFont(9); d.textColor = w_(A.soft);
        const v = wg.addText(String(s.weight.current));
        v.font = Font.boldRoundedSystemFont(11); v.textColor = w_(A.mid);
    }
    bottom.addSpacer();
    const macros = bottom.addStack();
    macros.layoutHorizontally(); macros.spacing = 8; macros.bottomAlignContent();
    addMacro(macros, 'F', n.fat);      // LTR: נוסף ראשון = שמאל קיצוני
    addMacro(macros, 'C', n.carbs);
    addMacro(macros, 'P', n.protein);
}

// ═══════════════ פריסה 3: שורה מעל השעון ═══════════════
// שורה אחת, ללא אייקון (כלל הפרויקט: בלי אייקונים דקורטיביים) וללא צבע.
function buildInline(w, s) {
    let txt = 'GYMPRO — אין נתונים';
    if (s) {
        const n = s.nutrition || {};
        const target = n.kcalTarget || 0;
        const parts = [];
        parts.push(target > 0
            ? (n.calories <= target ? 'נותרו ' : 'מעל ') + fmtNum(Math.abs(target - (n.calories || 0))) + ' קק"ל'
            : fmtNum(n.calories) + ' קק"ל');
        if (n.protein) parts.push(Math.round(n.protein) + ' חלבון');
        if (s.weight) parts.push(s.weight.current + ' ק"ג');
        txt = parts.join(' · ');
    }
    w.addText(txt);   // ב-inline iOS קובע פונט וצבע — אין טעם להגדיר
}

// ═══════════════ עזרים ═══════════════

// טבעת התקדמות. Path ב-Scriptable חסר addArc, ו-strokePath משאיר קצוות חדים —
// לכן הקשת מצוירת כשרשרת עיגולים מלאים בצפיפות (קצוות עגולים "בחינם").
function ringImage(pct) {
    const S = 300, LW = 26, R = (S - LW) / 2 - 4;
    const ctx = new DrawContext();
    ctx.size = new Size(S, S); ctx.opaque = false; ctx.respectScreenScale = false;
    strokeArc(ctx, S / 2, S / 2, R, LW, 360, w_(A.track));
    if (pct > 0) strokeArc(ctx, S / 2, S / 2, R, LW, 360 * pct, w_(A.full));
    return ctx.getImage();
}
function strokeArc(ctx, cx, cy, r, width, sweepDeg, color) {
    ctx.setFillColor(color);
    const STEP = 1.2;                       // צפוף מספיק כדי שהעיגולים ייראו כקו רציף
    for (let a = 0; a <= sweepDeg; a += STEP) {
        const rad = (a - 90) * Math.PI / 180;   // 0° = השעה 12, בכיוון השעון
        const x = cx + r * Math.cos(rad), y = cy + r * Math.sin(rad);
        ctx.fillEllipse(new Rect(x - width / 2, y - width / 2, width, width));
    }
}

// פס התקדמות מ-stacks: ה-track ברוחב גמיש (Size עם 0) נמתח לכל רוחב הווידג'ט
// בכל מכשיר; רק אורך המילוי מחושב מהערכת רוחב (אי-דיוק זניח). המילוי מעוגן ימין (RTL).
function addBar(w, pct) {
    const H = 5;
    const estW = rectWidgetWidth();
    const track = w.addStack();
    track.size = new Size(0, H);
    track.cornerRadius = H / 2;
    track.backgroundColor = w_(A.track);
    track.layoutHorizontally();
    track.addSpacer();                      // מעגן את המילוי לקצה הימני
    if (pct > 0) {
        const fill = track.addStack();
        fill.size = new Size(Math.max(H, Math.round(estW * pct)), H);
        fill.cornerRadius = H / 2;
        fill.backgroundColor = w_(A.full);
    }
}

// רוחב ווידג'ט accessoryRectangular לפי רוחב המסך (נקודות) — הערכה למילוי הפס בלבד.
function rectWidgetWidth() {
    const sz = Device.screenSize();
    const sw = Math.min(sz.width, sz.height);
    return Math.max(130, Math.min(175, Math.round(sw * 0.41)));
}

function addMacro(stack, tag, val) {
    const st = stack.addStack();
    st.layoutHorizontally(); st.spacing = 2; st.bottomAlignContent();
    const v = st.addText(String(Math.round(val || 0)));
    v.font = Font.boldRoundedSystemFont(10); v.textColor = w_(A.mid);
    const t = st.addText(tag);
    t.font = Font.blackSystemFont(8); t.textColor = w_(A.dim);
}

function centeredText(w, str) {
    const row = w.addStack();
    row.layoutHorizontally();
    row.addSpacer();
    const t = row.addText(str);
    row.addSpacer();
    return t;
}

function isStale(iso) {
    if (!iso) return true;
    return (Date.now() - new Date(iso).getTime()) > STALE_HOURS * 3600000;
}
function fmtNum(v) { return (Math.round(v || 0)).toLocaleString('he-IL'); }
function fmtTime(iso) {
    const d = iso ? new Date(iso) : new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function deltaText(d) { return (d > 0 ? '▴' : d < 0 ? '▾' : '·') + Math.abs(d || 0).toFixed(1); }
