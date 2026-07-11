/**
 * GYMPRO ELITE — ווידג'ט מסך הבית (Scriptable, iOS)
 * ----------------------------------------------------------------------------
 * מציג: תזונה היום (קלוריות מול יעד + מאקרו + פס התקדמות), משקל אחרון
 * + מגמה שבועית + ספארקליין, והאימון האחרון. פריסת "גרסה 2" מהמוקאפ
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
    bg: '#161619', track: '#2e2e36',
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
w.setPadding(13, 16, 13, 16);
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
if (config.runsInApp) w.presentMedium();
Script.complete();

// ═══════════════ בניית הפריסה (גרסה 2 — תזונה דומיננטית) ═══════════════
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

    // ── שורת קלוריות: מאקרו משמאל (מיושר לבסיס), קלוריות/יעד מימין ──
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
    big.font = Font.blackRoundedSystemFont(26); big.textColor = col(C.text);
    big.minimumScaleFactor = 0.8;

    w.addSpacer(7);

    // ── פס התקדמות קלוריות ──
    const pct = n.kcalTarget > 0 ? Math.min(1, n.calories / n.kcalTarget) : 0;
    const bar = w.addImage(progressBar(pct));
    bar.imageSize = new Size(292, 5);
    bar.cornerRadius = 2.5;
    bar.centerAlignImage();

    w.addSpacer();   // ריווח גמיש — דוחף את השורה התחתונה למטה בלי למרוח את התוכן

    // ── שורה תחתונה: אימון משמאל, משקל+ספארקליין מימין ──
    const bottom = w.addStack();
    bottom.layoutHorizontally(); bottom.bottomAlignContent();

    // אימון אחרון (שמאל)
    const wo = bottom.addStack();
    wo.layoutVertically(); wo.spacing = 3;
    if (s.workout) {
        const meta = wo.addText(s.workout.sets + ' סטים · ' + fmtNum(s.workout.volume) + ' ק"ג נפח');
        meta.font = Font.mediumSystemFont(9); meta.textColor = col(C.dim);
        const nameRow = wo.addStack();
        nameRow.layoutHorizontally(); nameRow.centerAlignContent(); nameRow.spacing = 4;
        const icon = nameRow.addImage(SFSymbol.named('dumbbell.fill').image);
        icon.imageSize = new Size(12, 12); icon.tintColor = col(C.dim);
        const name = nameRow.addText(s.workout.type + ' · ' + agoText(s.workout.timestamp));
        name.font = Font.heavySystemFont(12); name.textColor = col(C.text); name.lineLimit = 1;
        name.minimumScaleFactor = 0.75;
    } else {
        const none = wo.addText('אין אימונים עדיין');
        none.font = Font.mediumSystemFont(10); none.textColor = col(C.dim);
    }

    bottom.addSpacer();

    // משקל + מגמה + ספארקליין (ימין)
    const wt = bottom.addStack();
    wt.layoutHorizontally(); wt.bottomAlignContent(); wt.spacing = 9;
    if (s.weight) {
        const sp = wt.addImage(sparkline(s.weight.points || []));
        sp.imageSize = new Size(72, 26);
        const wcol = wt.addStack();
        wcol.layoutVertically(); wcol.spacing = 2;
        // שורת ערך: צ'יפ מגמה משמאל, מספר+יחידה מימין
        const wrow = wcol.addStack();
        wrow.layoutHorizontally(); wrow.centerAlignContent(); wrow.spacing = 5;
        addDeltaChip(wrow, s.weight.weekDelta, (s.nutrition || {}).state);
        const val = wrow.addText(String(s.weight.current));
        val.font = Font.blackRoundedSystemFont(18); val.textColor = col(C.text);
        const unit = wrow.addText('ק"ג');
        unit.font = Font.semiboldSystemFont(9); unit.textColor = col(C.dim);
        // תווית מיושרת לימין מתחת למספר
        const lblRow = wcol.addStack();
        lblRow.layoutHorizontally();
        lblRow.addSpacer();
        const lbl = lblRow.addText('מגמה שבועית');
        lbl.font = Font.mediumSystemFont(7.5); lbl.textColor = col(C.dim);
    } else {
        const none = wt.addText('אין שקילות');
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

// צ'יפ מגמה — pill קטן בסגנון האפליקציה, צבע סמנטי לפי המצב התזונתי
function addDeltaChip(stack, d, state) {
    const c = deltaColor(d, state);
    const chip = stack.addStack();
    chip.setPadding(2, 6, 2, 6);
    chip.cornerRadius = 8;
    chip.backgroundColor = col(c, 0.16);
    const t = chip.addText(deltaText(d));
    t.font = Font.heavyRoundedSystemFont(9);
    t.textColor = col(c);
}

function progressBar(pct) {
    const W = 876, H = 15;   // 3x מגודל התצוגה (292x5pt) — חד ברשתית
    const ctx = new DrawContext();
    ctx.size = new Size(W, H); ctx.opaque = false; ctx.respectScreenScale = false;
    ctx.setFillColor(col(C.track));
    ctx.fillPath(roundedRect(0, 0, W, H, H / 2));
    if (pct > 0) {
        ctx.setFillColor(col(pct >= 1 ? C.success : C.accent));
        ctx.fillPath(roundedRect(0, 0, Math.max(H, W * pct), H, H / 2));
    }
    return ctx.getImage();
}

function sparkline(points) {
    const W = 216, H = 78, PAD = 12;   // 3x מגודל התצוגה (72x26pt)
    const ctx = new DrawContext();
    ctx.size = new Size(W, H); ctx.opaque = false; ctx.respectScreenScale = false;
    if (points.length >= 2) {
        const min = Math.min(...points), max = Math.max(...points);
        const span = (max - min) || 1;
        const x = i => PAD + (W - 2 * PAD) * (i / (points.length - 1));
        const y = v => PAD + (H - 2 * PAD) * (1 - (v - min) / span);
        // ציר הזמן מימין לשמאל (RTL): הנקודה הישנה מימין, העדכנית משמאל
        const px = i => W - x(i);

        // מילוי שטח עדין מתחת לקו — עומק בלי רעש
        const fill = new Path();
        fill.move(new Point(px(0), H));
        points.forEach((v, i) => fill.addLine(new Point(px(i), y(v))));
        fill.addLine(new Point(px(points.length - 1), H));
        fill.closeSubpath();
        ctx.addPath(fill);
        ctx.setFillColor(col(C.accent, 0.16));
        ctx.fillPath();

        // הקו עצמו
        const line = new Path();
        points.forEach((v, i) => {
            const pt = new Point(px(i), y(v));
            i === 0 ? line.move(pt) : line.addLine(pt);
        });
        ctx.addPath(line);
        ctx.setStrokeColor(col(C.accent)); ctx.setLineWidth(5);
        ctx.strokePath();

        // נקודת הערך האחרון — עם טבעת בצבע הרקע (כמו במוקאפ)
        const lx = px(points.length - 1), ly = y(points[points.length - 1]);
        ctx.setFillColor(col(C.bg));
        ctx.fillEllipse(new Rect(lx - 10, ly - 10, 20, 20));
        ctx.setFillColor(col(C.accent));
        ctx.fillEllipse(new Rect(lx - 6.5, ly - 6.5, 13, 13));
    }
    return ctx.getImage();
}

function roundedRect(x, y, w, h, r) {
    const p = new Path();
    p.addRoundedRect(new Rect(x, y, w, h), r, r);
    return p;
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
