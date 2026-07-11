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
 * 4. קיצור לפתיחת האפליקציה בלחיצה: אפליקציית Shortcuts → + → הוסף פעולה
 *    "Open App" → בחר את GYMPRO (אפליקציית ה-web מהמסך הראשי מופיעה ברשימה)
 *    → קרא לקיצור בדיוק "GYMPRO".
 * 5. מסך הבית → לחיצה ארוכה → + → Scriptable → גודל Medium → הוסף.
 *    לחיצה ארוכה על הווידג'ט → Edit Widget → Script: "GYMPRO Widget",
 *    When Interacting: Run Script.
 *
 * iOS מרענן ווידג'טים כל ~15-30 דק'; הנתונים טריים כמו השימוש האחרון באפליקציה.
 * ==========================================================================*/

// 🔐 הדבק את ה-URL וה-token של גשר הווידג'ט (אותם ערכים כמו בהגדרות GYMPRO)
const BRIDGE_URL = 'PASTE_WEB_APP_URL_HERE';
const TOKEN = 'PASTE_SECRET_TOKEN_HERE';
const SHORTCUT_NAME = 'GYMPRO';   // שם הקיצור שיצרת בשלב 4

// ── טוקני Liquid Obsidian ──
const C = {
    bg: '#161619', surface4: '#26262c',
    text: '#e2e2e2', dim: '#8E8E93',
    accent: '#0A84FF', success: '#30D158', danger: '#ff453a',
    p: '#8FB0C9', c: '#C3A874', f: '#C594A6'
};
const col = h => new Color(h);

// ── משיכת ה-snapshot מהגשר ──
let snap = null;
try {
    const req = new Request(BRIDGE_URL + '?token=' + encodeURIComponent(TOKEN));
    const j = await req.loadJSON();
    if (j && j.ok) snap = j.snapshot;
} catch (e) { /* אין רשת — הווידג'ט יציג הודעת שגיאה */ }

const w = new ListWidget();
w.backgroundColor = col(C.bg);
w.url = 'shortcuts://run-shortcut?name=' + encodeURIComponent(SHORTCUT_NAME);
w.setPadding(12, 14, 12, 14);
w.refreshAfterDate = new Date(Date.now() + 15 * 60000);

if (!snap) {
    const t = w.addText('GYMPRO ELITE');
    t.font = Font.blackSystemFont(11); t.textColor = col(C.dim);
    w.addSpacer(6);
    const m = w.addText('אין נתונים — פתח את האפליקציה ולחץ "דחוף snapshot עכשיו"');
    m.font = Font.mediumSystemFont(12); m.textColor = col(C.text); m.rightAlignText();
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
    time.font = Font.mediumSystemFont(8); time.textColor = col(C.dim); time.textOpacity = 0.7;
    head.addSpacer();
    const title = head.addText('GYMPRO ELITE');
    title.font = Font.blackSystemFont(9); title.textColor = col(C.dim);
    w.addSpacer(7);

    // ── שורת קלוריות: מאקרו משמאל, קלוריות/יעד מימין ──
    const kRow = w.addStack();
    kRow.layoutHorizontally(); kRow.bottomAlignContent();
    const macros = kRow.addStack();
    macros.layoutHorizontally(); macros.spacing = 8;
    addMacro(macros, 'F', n.fat, C.f);       // LTR: נוסף ראשון = שמאל קיצוני
    addMacro(macros, 'C', n.carbs, C.c);
    addMacro(macros, 'P', n.protein, C.p);
    kRow.addSpacer();
    const kcal = kRow.addStack();
    kcal.layoutHorizontally(); kcal.bottomAlignContent(); kcal.spacing = 3;
    if (n.kcalTarget > 0) {
        const tgt = kcal.addText('/ ' + fmtNum(n.kcalTarget) + ' קק"ל');
        tgt.font = Font.semiboldSystemFont(9); tgt.textColor = col(C.dim);
    }
    const big = kcal.addText(fmtNum(n.calories));
    big.font = Font.blackSystemFont(20); big.textColor = col(C.text);
    w.addSpacer(5);

    // ── פס התקדמות קלוריות ──
    const pct = n.kcalTarget > 0 ? Math.min(1, n.calories / n.kcalTarget) : 0;
    const bar = w.addImage(progressBar(pct));
    bar.imageSize = new Size(292, 6);   // גודל מפורש בנקודות — בלי זה iOS מכווץ/ממקם לא צפוי
    bar.cornerRadius = 3;
    bar.centerAlignImage();
    w.addSpacer(10);

    // ── שורה תחתונה: אימון משמאל, משקל+ספארקליין מימין ──
    const bottom = w.addStack();
    bottom.layoutHorizontally(); bottom.centerAlignContent();

    // אימון אחרון (שמאל)
    const wo = bottom.addStack();
    wo.layoutVertically(); wo.spacing = 2;
    if (s.workout) {
        const name = wo.addText(s.workout.type + ' · ' + agoText(s.workout.timestamp));
        name.font = Font.heavySystemFont(11); name.textColor = col(C.text); name.lineLimit = 1;
        const meta = wo.addText(s.workout.sets + ' סטים · ' + fmtNum(s.workout.volume) + ' ק"ג נפח');
        meta.font = Font.mediumSystemFont(9); meta.textColor = col(C.dim);
    } else {
        const none = wo.addText('אין אימונים עדיין');
        none.font = Font.mediumSystemFont(10); none.textColor = col(C.dim);
    }

    bottom.addSpacer();

    // משקל + מגמה + ספארקליין (ימין)
    const wt = bottom.addStack();
    wt.layoutHorizontally(); wt.centerAlignContent(); wt.spacing = 8;
    if (s.weight) {
        const sp = wt.addImage(sparkline(s.weight.points || []));
        sp.imageSize = new Size(64, 22);   // קטן וצמוד — לא משתלט על השורה
        const wcol = wt.addStack();
        wcol.layoutVertically(); wcol.spacing = 1;
        const wrow = wcol.addStack();
        wrow.layoutHorizontally(); wrow.bottomAlignContent(); wrow.spacing = 3;
        const delta = wrow.addText(deltaText(s.weight.weekDelta));
        delta.font = Font.heavySystemFont(9);
        delta.textColor = col(deltaColor(s.weight.weekDelta, (s.nutrition || {}).state));
        const unit = wrow.addText('ק"ג');
        unit.font = Font.semiboldSystemFont(9); unit.textColor = col(C.dim);
        const val = wrow.addText(String(s.weight.current));
        val.font = Font.blackSystemFont(15); val.textColor = col(C.text);
        const lbl = wcol.addText('מגמה שבועית');
        lbl.font = Font.mediumSystemFont(7); lbl.textColor = col(C.dim); lbl.rightAlignText();
    } else {
        const none = wt.addText('אין שקילות');
        none.font = Font.mediumSystemFont(10); none.textColor = col(C.dim);
    }
}

// ═══════════════ עזרים ═══════════════
function addMacro(stack, tag, val, color) {
    const st = stack.addStack();
    st.layoutHorizontally(); st.spacing = 2; st.bottomAlignContent();
    const v = st.addText(String(Math.round(val || 0)));
    v.font = Font.boldSystemFont(9); v.textColor = col(C.text);
    const t = st.addText(tag);
    t.font = Font.heavySystemFont(9); t.textColor = col(color);
}

function progressBar(pct) {
    const W = 876, H = 18;   // 3x מגודל התצוגה (292x6pt) — חד ברשתית
    const ctx = new DrawContext();
    ctx.size = new Size(W, H); ctx.opaque = false; ctx.respectScreenScale = false;
    ctx.setFillColor(col('#2e2e36'));   // track בהיר מספיק להיראות על רקע הווידג'ט
    ctx.fillPath(roundedRect(0, 0, W, H, H / 2));
    if (pct > 0) {
        ctx.setFillColor(col(pct >= 1 ? C.success : C.accent));
        ctx.fillPath(roundedRect(0, 0, Math.max(H, W * pct), H, H / 2));
    }
    return ctx.getImage();
}

function sparkline(points) {
    const W = 192, H = 66, PAD = 10;   // 3x מגודל התצוגה (64x22pt)
    const ctx = new DrawContext();
    ctx.size = new Size(W, H); ctx.opaque = false; ctx.respectScreenScale = false;
    if (points.length >= 2) {
        const min = Math.min(...points), max = Math.max(...points);
        const span = (max - min) || 1;
        const x = i => PAD + (W - 2 * PAD) * (i / (points.length - 1));
        const y = v => PAD + (H - 2 * PAD) * (1 - (v - min) / span);
        const path = new Path();
        // ציר הזמן מימין לשמאל (RTL): הנקודה הישנה מימין, העדכנית משמאל
        points.forEach((v, i) => {
            const px = W - x(i), py = y(v);
            i === 0 ? path.move(new Point(px, py)) : path.addLine(new Point(px, py));
        });
        ctx.addPath(path);
        ctx.setStrokeColor(col(C.accent)); ctx.setLineWidth(5.5);
        ctx.strokePath();
        // נקודת הערך האחרון
        const lx = W - x(points.length - 1), ly = y(points[points.length - 1]);
        ctx.setFillColor(col(C.accent));
        ctx.fillEllipse(new Rect(lx - 8, ly - 8, 16, 16));
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
