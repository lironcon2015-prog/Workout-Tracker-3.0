/**
 * GYMPRO ELITE — ווידג'ט מסך הבית (Scriptable, iOS)
 * ----------------------------------------------------------------------------
 * מציג: תזונה היום (קלוריות מול יעד + מאקרו + פס התקדמות), משקל אחרון
 * + מגמה שבועית + ספארקליין, והאימון האחרון. נאמן לפריסת "גרסה 2" מהמוקאפ
 * (docs/mockup-widget.html), עיצוב Liquid Obsidian.
 *
 * ── התקנה (חד-פעמי) ────────────────────────────────────────────────────────
 * 1. ודא שגשר הווידג'ט פרוס (docs/widget-bridge.gs) ושהאפליקציה דחפה snapshot
 *    (הגדרות → ווידג'ט אייפון → "דחוף snapshot עכשיו").
 * 2. התקן את Scriptable מה-App Store (חינם).
 * 3. Scriptable → + → הדבק את כל הקובץ הזה → שנה למטה את BRIDGE_URL ו-TOKEN.
 *    קרא לסקריפט "GYMPRO Widget".
 * 4. מסך הבית → לחיצה ארוכה → + → Scriptable → גודל Medium → הוסף.
 *    לחיצה ארוכה על הווידג'ט → Edit Widget → Script: "GYMPRO Widget".
 *
 * iOS מרענן ווידג'טים כל ~15-30 דק'; הנתונים טריים כמו השימוש האחרון באפליקציה.
 * ==========================================================================*/

// 🔐 הדבק את ה-URL וה-token של גשר הווידג'ט (אותם ערכים כמו בהגדרות GYMPRO)
const BRIDGE_URL = 'PASTE_WEB_APP_URL_HERE';
const TOKEN = 'PASTE_SECRET_TOKEN_HERE';

// לחיצה על הווידג'ט: iOS אינו מאפשר לפתוח PWA מבחוץ (web clip אינו ברשימת
// "Open App" של Shortcuts, וקישורים לכתובת נפתחים בספארי — אחסון נפרד!).
// לכן הווידג'ט הוא תצוגה בלבד. אם בעתיד iOS יפתח קישורי scope באפליקציה
// המותקנת — הצב כאן את כתובת האפליקציה והלחיצה תעבוד.
const TAP_URL = '';

// ── טוקני Liquid Obsidian ──
const C = {
    bg: '#161619', track: '#26262c', sep: '#ffffff',
    text: '#e2e2e2', dim: '#8E8E93',
    accent: '#0A84FF', success: '#30D158', danger: '#ff453a',
    p: '#8FB0C9', c: '#C3A874', f: '#C594A6'
};
const col = (h, a) => a === undefined ? new Color(h) : new Color(h, a);

// ── משיכת ה-snapshot מהגשר ──
let snap = null;
try {
    const req = new Request(BRIDGE_URL + '?token=' + encodeURIComponent(TOKEN));
    const j = await req.loadJSON();
    if (j && j.ok) snap = j.snapshot;
} catch (e) { /* אין רשת — הווידג'ט יציג הודעת שגיאה */ }

const w = new ListWidget();
w.backgroundColor = col(C.bg);
if (TAP_URL) w.url = TAP_URL;
w.setPadding(13, 15, 13, 15);
w.refreshAfterDate = new Date(Date.now() + 15 * 60000);

if (!snap) {
    w.addSpacer();
    const t = w.addText('GYMPRO ELITE');
    t.font = Font.blackSystemFont(12); t.textColor = col(C.dim); t.centerAlignText();
    w.addSpacer(6);
    const m = w.addText('אין נתונים — פתח את האפליקציה ולחץ "דחוף snapshot עכשיו"');
    m.font = Font.mediumSystemFont(11); m.textColor = col(C.text); m.centerAlignText();
    w.addSpacer();
} else {
    buildWidget(w, snap);
}

Script.setWidget(w);
if (config.runsInApp) w.presentMedium();   // ▶ בעורך = תצוגה מקדימה
Script.complete();
// רענון: iOS מרענן את הווידג'ט לבד כל ~15-30 דק'. רענון ידני בהקשה נפסל —
// "Run Script" פותח את אפליקציית Scriptable (התנהגות iOS), והמשתמש ויתר.

// ═══════════════ בניית הפריסה (גרסה 2 — נאמן למוקאפ) ═══════════════
// כלל RTL ב-Scriptable: ה-stacks הם LTR; "יישור לימין" = spacer גמיש ראשון בשורה,
// והרכיב הימני-ויזואלית נוסף אחרון.
function buildWidget(w, s) {
    const n = s.nutrition || {};

    // ── כותרת: שעה משמאל, לוגו מימין ──
    const head = w.addStack();
    head.layoutHorizontally(); head.centerAlignContent();
    const time = head.addText('עודכן ' + fmtTime(s.generated));
    time.font = Font.mediumSystemFont(8); time.textColor = col(C.dim, 0.75);
    head.addSpacer();
    const title = head.addText('GYMPRO ELITE');
    title.font = Font.blackSystemFont(9); title.textColor = col(C.dim);

    w.addSpacer(8);

    // ── שורת קלוריות: מאקרו משמאל, קלוריות/יעד מימין ──
    const kRow = w.addStack();
    kRow.layoutHorizontally(); kRow.bottomAlignContent();
    const macros = kRow.addStack();
    macros.layoutHorizontally(); macros.spacing = 11; macros.bottomAlignContent();
    addMacro(macros, 'F', n.fat, C.f);       // LTR: נוסף ראשון = שמאל קיצוני
    addMacro(macros, 'C', n.carbs, C.c);
    addMacro(macros, 'P', n.protein, C.p);
    kRow.addSpacer();
    const kcal = kRow.addStack();
    kcal.layoutHorizontally(); kcal.bottomAlignContent(); kcal.spacing = 4;
    if (n.kcalTarget > 0) {
        const tgt = kcal.addText('/ ' + fmtNum(n.kcalTarget) + ' קק"ל');
        tgt.font = Font.semiboldRoundedSystemFont(10); tgt.textColor = col(C.dim);
    }
    const big = kcal.addText(fmtNum(n.calories));
    big.font = Font.blackRoundedSystemFont(24); big.textColor = col(C.text);
    big.minimumScaleFactor = 0.8;

    w.addSpacer(6);

    // ── פס התקדמות קלוריות — גרדיאנט כחול→ירוק, מילוי מעוגן ימין (RTL) ──
    const pct = n.kcalTarget > 0 ? Math.min(1, n.calories / n.kcalTarget) : 0;
    addProgressBar(w, pct);

    w.addSpacer();   // ריווח גמיש — השורה התחתונה נדחפת למטה

    // ── שורה תחתונה: [אימון | מפריד | ספארקליין | משקל] — משקל בקצה הימני ──
    const bottom = w.addStack();
    bottom.layoutHorizontally(); bottom.centerAlignContent();

    // אימון (עמודה שמאלית, טקסט מיושר ימינה כמו RTL)
    const wo = bottom.addStack();
    wo.layoutVertically(); wo.spacing = 3;
    if (s.workout) {
        const nameRow = wo.addStack();
        nameRow.layoutHorizontally(); nameRow.bottomAlignContent(); nameRow.spacing = 4;
        nameRow.addSpacer();
        const ago = nameRow.addText('· ' + agoText(s.workout.timestamp));
        ago.font = Font.semiboldSystemFont(9); ago.textColor = col(C.dim);
        const name = nameRow.addText(s.workout.type);
        name.font = Font.heavySystemFont(13); name.textColor = col(C.text);
        name.lineLimit = 1; name.minimumScaleFactor = 0.7;
        const metaRow = wo.addStack();
        metaRow.layoutHorizontally();
        metaRow.addSpacer();
        const meta = metaRow.addText(s.workout.sets + ' סטים · ' + fmtNum(s.workout.volume) + ' ק"ג נפח');
        meta.font = Font.mediumSystemFont(9.5); meta.textColor = col('#b9b9be');
    } else {
        const noneRow = wo.addStack();
        noneRow.layoutHorizontally(); noneRow.addSpacer();
        const none = noneRow.addText('אין אימונים עדיין');
        none.font = Font.mediumSystemFont(10); none.textColor = col(C.dim);
    }

    bottom.addSpacer(12);

    // מפריד אנכי עדין — כמו במוקאפ
    const sep = bottom.addStack();
    sep.size = new Size(1, 44);
    sep.backgroundColor = col(C.sep, 0.08);

    bottom.addSpacer(12);

    // ספארקליין + עמודת משקל (קצה ימין)
    if (s.weight) {
        const sp = bottom.addImage(sparkline(s.weight.points || []));
        sp.imageSize = new Size(74, 26);
        bottom.addSpacer(8);
        const wcol = bottom.addStack();
        wcol.layoutVertically(); wcol.spacing = 1;
        // שורת ערך: המספר בקצה הימני, היחידה משמאלו
        const wrow = wcol.addStack();
        wrow.layoutHorizontally(); wrow.bottomAlignContent(); wrow.spacing = 3;
        wrow.addSpacer();
        const unit = wrow.addText('ק"ג');
        unit.font = Font.semiboldSystemFont(9); unit.textColor = col(C.dim);
        const val = wrow.addText(String(s.weight.current));
        val.font = Font.blackRoundedSystemFont(19); val.textColor = col(C.text);
        // דלתא — שורה נפרדת, צבע סמנטי, מיושרת ימינה (כמו במוקאפ)
        const dRow = wcol.addStack();
        dRow.layoutHorizontally(); dRow.addSpacer();
        const delta = dRow.addText(deltaText(s.weight.weekDelta));
        delta.font = Font.heavyRoundedSystemFont(10);
        delta.textColor = col(deltaColor(s.weight.weekDelta, (s.nutrition || {}).state));
        // תווית
        const lRow = wcol.addStack();
        lRow.layoutHorizontally(); lRow.addSpacer();
        const lbl = lRow.addText('מגמה שבועית');
        lbl.font = Font.mediumSystemFont(8); lbl.textColor = col(C.dim);
    } else {
        const none = bottom.addText('אין שקילות');
        none.font = Font.mediumSystemFont(10); none.textColor = col(C.dim);
    }
}

// ═══════════════ עזרים ═══════════════
function addMacro(stack, tag, val, color) {
    const st = stack.addStack();
    st.layoutHorizontally(); st.spacing = 3; st.bottomAlignContent();
    const v = st.addText(String(Math.round(val || 0)));
    v.font = Font.boldRoundedSystemFont(12); v.textColor = col(C.text);
    const t = st.addText(tag);
    t.font = Font.blackSystemFont(10); t.textColor = col(color);
}

// רוחב ווידג'ט Medium לפי רוחב המסך (נקודות) — כדי שהפס יימתח מקצה לקצה.
// רוחב קבוע (292) השאיר פער רקע בקצה הימני במכשירים רחבים (Pro Max).
function mediumWidgetWidth() {
    const s = Device.screenSize();
    const sw = Math.min(s.width, s.height);
    const map = { 440: 373, 430: 364, 428: 364, 414: 348, 402: 338, 393: 338, 390: 338, 375: 329, 360: 329, 320: 292 };
    return map[sw] || Math.max(292, Math.min(364, sw - 62));
}

// פס התקדמות מ-stacks: track אפור + מילוי גרדיאנט כחול→ירוק, מעוגן ימין (RTL).
// ה-track ברוחב גמיש (Size עם 0) + spacer פנימי — נמתח מעצמו לכל רוחב הווידג'ט,
// בכל מכשיר, בלי לנחש מידות. רק אורך המילוי מחושב מהערכת הרוחב (אי-דיוק זניח).
// לא DrawContext — שם fillPath() ממלא רק path שנוסף ב-addPath (באג שקט אם שוכחים).
function addProgressBar(w, pct) {
    const BAR_H = 5;
    const estW = mediumWidgetWidth() - 30;   // הערכה לאורך המילוי בלבד
    const track = w.addStack();
    track.size = new Size(0, BAR_H);   // רוחב 0 = גמיש; ה-spacer שבפנים ממתח אותו עד הקצוות
    track.cornerRadius = BAR_H / 2;
    track.backgroundColor = col(C.track);
    track.layoutHorizontally();
    track.addSpacer();   // ממלא את הרוחב ומעגן את המילוי לקצה הימני — התקדמות RTL
    if (pct > 0) {
        const fill = track.addStack();
        fill.size = new Size(Math.max(BAR_H, Math.round(estW * pct)), BAR_H);
        fill.cornerRadius = BAR_H / 2;
        const g = new LinearGradient();
        g.colors = [col(C.accent), col(C.success)];
        g.locations = [0, 1];
        g.startPoint = new Point(0, 0);
        g.endPoint = new Point(1, 0);
        fill.backgroundGradient = g;
    }
}

// ספארקליין — קו + נקודת קצה עם טבעת רקע (כמו במוקאפ, בלי מילוי שטח)
function sparkline(points) {
    const W = 222, H = 78, PAD = 12;   // 3x מגודל התצוגה (74x26pt)
    const ctx = new DrawContext();
    ctx.size = new Size(W, H); ctx.opaque = false; ctx.respectScreenScale = false;
    if (points.length >= 2) {
        const min = Math.min(...points), max = Math.max(...points);
        const span = (max - min) || 1;
        const x = i => PAD + (W - 2 * PAD) * (i / (points.length - 1));
        const y = v => PAD + (H - 2 * PAD) * (1 - (v - min) / span);
        // ציר הזמן מימין לשמאל (RTL): הנקודה הישנה מימין, העדכנית משמאל
        const px = i => W - x(i);

        const line = new Path();
        points.forEach((v, i) => {
            const pt = new Point(px(i), y(v));
            i === 0 ? line.move(pt) : line.addLine(pt);
        });
        ctx.addPath(line);
        ctx.setStrokeColor(col(C.accent)); ctx.setLineWidth(5.5);
        ctx.strokePath();

        // נקודת הערך האחרון — עם טבעת בצבע הרקע
        const lx = px(points.length - 1), ly = y(points[points.length - 1]);
        ctx.setFillColor(col(C.bg));
        ctx.fillEllipse(new Rect(lx - 10, ly - 10, 20, 20));
        ctx.setFillColor(col(C.accent));
        ctx.fillEllipse(new Rect(lx - 6.5, ly - 6.5, 13, 13));
    }
    return ctx.getImage();
}

function fmtNum(v) { return (Math.round(v || 0)).toLocaleString('he-IL'); }
function fmtTime(iso) {
    const d = iso ? new Date(iso) : new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function agoText(ts) {
    if (!ts) return '';
    const days = Math.floor((startOfDay(new Date()) - startOfDay(new Date(ts))) / 86400000);
    if (days <= 0) return 'היום';
    if (days === 1) return 'אתמול';
    if (days === 2) return 'לפני יומיים';
    return 'לפני ' + days + ' ימים';
}
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
function deltaText(d) { return (d > 0 ? '▴ ' : d < 0 ? '▾ ' : '· ') + Math.abs(d || 0).toFixed(1); }
// ירוק/אדום סמנטי לפי המצב התזונתי: ירידה בקאט = טוב; עלייה בסרפלוס = טוב
function deltaColor(d, state) {
    if (!d) return C.dim;
    if (state === 'cut')     return d < 0 ? C.success : C.danger;
    if (state === 'surplus') return d > 0 ? C.success : C.danger;
    return C.dim;   // maintenance — נייטרלי
}
