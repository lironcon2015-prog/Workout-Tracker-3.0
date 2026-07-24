/**
 * GYMPRO ELITE — ווידג'ט מסך הנעילה (Scriptable, iOS 16+)
 * ----------------------------------------------------------------------------
 * סקריפט נפרד מ-docs/widget-scriptable.js (ווידג'ט מסך הבית). מושך את אותו
 * snapshot מאותו גשר (docs/widget-bridge.gs).
 *
 * ✅ אין מה לערוך — הסקריפט מאתר לבד את ה-URL וה-token מסקריפט הווידג'ט של
 *    מסך הבית שכבר מוגדר אצלך ב-Scriptable, ושומר אותם ב-Keychain של המכשיר.
 *    (רק אם אין סקריפט כזה — מלא ידנית את שתי השורות המסומנות למטה.)
 *
 * למה סקריפט נפרד: ווידג'טי מסך נעילה ("accessory") הם עולם רינדור אחר —
 *   • הם זעירים (עיגול ~72pt, מלבן ~160×72pt, שורה אחת מעל השעון);
 *   • iOS מרנדר אותם ב-vibrancy מונוכרומטי — **צבע נזרק**, רק ה-alpha נשמר.
 *     לכן אין כאן ירוק/אדום סמנטי, אין גרדיאנט וצבעי מאקרו — ההיררכיה נבנית
 *     מעוצמת שקיפות (מלא / בינוני / עמום) ומגודל פונט בלבד.
 *   • אין רקע — הווידג'ט שקוף מעל התמונה של מסך הנעילה.
 *
 * ── שלוש הפריסות (הסקריפט מזהה לבד לפי גודל הווידג'ט) ─────────────────────
 *   accessoryCircular    — טבעת התקדמות קלוריות + קק"ל שנותרו במרכז.
 *   accessoryRectangular — קק"ל/יעד + פס התקדמות + מאקרו מול היעדים.
 *   accessoryInline      — שורת טקסט מעל השעון: קק"ל שנותרו · חלבון · משקל.
 *
 * המלבן הוא מסך תזונה טהור: מבט של חצי שנייה לא קורא שני תחומי דאטה, ולכן
 * הרוחב מוקדש ליעדי המאקרו ("145/170" ולא "145"). המשקל חי בשורת ה-inline
 * ובווידג'ט מסך הבית, שם הוא מקבל ספארקליין ומגמה שבועית.
 *
 * ── התקנה (חד-פעמי) ────────────────────────────────────────────────────────
 * 1. Scriptable → + → הדבק את כל הקובץ הזה. קרא לסקריפט "GYMPRO Lock".
 * 2. לחץ ▶ — התצוגה המקדימה תופיע והאישורים ייקלטו וייכנסו ל-Keychain.
 * 3. מסך הנעילה → לחיצה ארוכה → Customize → מסך הנעילה → הקש על אזור
 *    הווידג'טים (מתחת לשעון, או השורה הצרה מעליו) → בחר Scriptable.
 * 4. הקש על הווידג'ט שנוסף → Script: "GYMPRO Lock", When Interacting: Run Script.
 *
 * אפשר להוסיף את שלוש הפריסות במקביל — אותו סקריפט משרת את כולן.
 * iOS מרענן ווידג'טים כל ~15-30 דק'; הנתונים טריים כמו השימוש האחרון באפליקציה.
 * ==========================================================================*/

// ⬇️ להשאיר ריק אם ווידג'ט מסך הבית כבר מוגדר — הסקריפט ימשוך משם לבד.
//    למלא רק אם האיתור האוטומטי נכשל (הווידג'ט יגיד לך).
const BRIDGE_URL = '';
const TOKEN = '';

// רקע מערכת לווידג'ט העגול (העיגול המעומעם של iOS). false = רק הטבעת שלנו.
const ACCESSORY_BG = false;

// מעל כמה שעות ה-snapshot נחשב "ישן" ומוצגת שעת העדכון (מלבן בלבד).
const STALE_HOURS = 6;

// תצוגה מקדימה בעורך (▶) בלבד — בווידג'ט האמיתי הכל נקבע לפי הגודל וה-Parameter.
// 'rect' (תזונה) | 'ring' (טבעת קלוריות) | 'weight' (ריבוע משקל) | 'inline'
const PREVIEW = 'rect';

// לחיצה על הווידג'ט: iOS אינו מאפשר לפתוח PWA מבחוץ (web clip אינו ברשימת
// "Open App" של Shortcuts, וקישור לכתובת נפתח בספארי — אחסון נפרד!).
// לכן הווידג'ט הוא תצוגה בלבד, כמו זה של מסך הבית.
const TAP_URL = '';

// ── שכבות בהירות (במקום צבעים — vibrancy זורק צבע ומשאיר alpha) ──
const A = { full: 1, mid: 0.72, soft: 0.5, dim: 0.38, track: 0.2 };
const w_ = a => new Color('#ffffff', a);

// מפתחות ה-Keychain שבהם נשמרים אישורי הגשר אחרי איתור מוצלח.
// חייבים להיות מוגדרים לפני קריאת resolveCreds() — const אינו hoisted (TDZ).
const KC_URL = 'gympro_widget_bridge_url';
const KC_TOK = 'gympro_widget_bridge_token';

// ── אישורי הגשר ──
const creds = await resolveCreds();

// ── משיכת ה-snapshot מהגשר ──
let snap = null;
if (creds) {
    try {
        const req = new Request(creds.url + '?token=' + encodeURIComponent(creds.token));
        const j = await req.loadJSON();
        if (j && j.ok) snap = j.snapshot;
    } catch (e) { /* אין רשת — תוצג הודעת שגיאה קצרה */ }
}

// ── בחירת התוכן: לפי גודל הווידג'ט + שדה Parameter בהגדרות הווידג'ט ──
// אותו סקריפט משרת את כל הריבועים; "weight" בשדה Parameter הופך את הריבוע
// לריבוע משקל במקום טבעת הקלוריות. ריק/כל ערך אחר = תזונה.
const param = (args.widgetParameter || '').trim().toLowerCase();
let family = config.widgetFamily;
let isWeight = (param === 'weight' || param === 'משקל');
if (!family) {                                  // בעורך אין family — לפי PREVIEW
    family = (PREVIEW === 'ring' || PREVIEW === 'weight') ? 'accessoryCircular'
           : PREVIEW === 'inline' ? 'accessoryInline' : 'accessoryRectangular';
    isWeight = (PREVIEW === 'weight');
}

const widget = new ListWidget();
if (TAP_URL) widget.url = TAP_URL;
widget.setPadding(0, 0, 0, 0);
// בקשת רענון צפופה (5 דק') — iOS לא מתחייב אבל מתקרב אליה כשיש תקציב.
widget.refreshAfterDate = new Date(Date.now() + 5 * 60000);

if (!creds) {
    buildNoCreds(widget, family);
} else if (family === 'accessoryCircular') {
    if (isWeight) buildWeightCircular(widget, snap);
    else {
        if (ACCESSORY_BG) widget.addAccessoryWidgetBackground = true;
        buildCircular(widget, snap);
    }
} else if (family === 'accessoryInline') {
    buildInline(widget, snap);
} else {
    // accessoryRectangular — וגם fallback אם הווידג'ט הוסף בטעות למסך הבית
    if (family === 'small' || family === 'medium' || family === 'large') {
        widget.backgroundColor = new Color('#161619');
        widget.setPadding(12, 14, 12, 14);
    }
    if (isWeight) buildWeightRectangular(widget, snap);
    else buildRectangular(widget, snap);
}

Script.setWidget(widget);
if (config.runsInApp) {                       // ▶ בעורך = תצוגה מקדימה
    if (family === 'accessoryCircular') widget.presentAccessoryCircular();
    else if (family === 'accessoryInline') widget.presentAccessoryInline();
    else widget.presentAccessoryRectangular();
}
Script.complete();

// ═══════════════ איתור ה-URL וה-token ═══════════════
// סדר: קבועים למעלה ← Keychain ← סריקת סקריפטי Scriptable אחרים במכשיר.
// הסריקה מוצאת את ווידג'ט מסך הבית (או כל סקריפט GYMPRO אחר) וקוראת ממנו את
// שני הערכים. בעורך סורקים תמיד — כך שינוי token בסקריפט המקורי נקלט מיד.
// בהקשר הווידג'ט מעדיפים את ה-Keychain: גישה לקבצי iCloud שם אינה מובטחת.
async function resolveCreds() {
    if (BRIDGE_URL && TOKEN && BRIDGE_URL.indexOf('http') === 0) {
        return cacheCreds({ url: BRIDGE_URL, token: TOKEN });
    }
    if (config.runsInApp) {
        const fresh = await scanScripts();
        if (fresh) return cacheCreds(fresh);
    }
    if (Keychain.contains(KC_URL) && Keychain.contains(KC_TOK)) {
        return { url: Keychain.get(KC_URL), token: Keychain.get(KC_TOK) };
    }
    const found = await scanScripts();
    return found ? cacheCreds(found) : null;
}

function cacheCreds(c) {
    try { Keychain.set(KC_URL, c.url); Keychain.set(KC_TOK, c.token); } catch (e) {}
    return c;
}

// סריקת תיקיית הסקריפטים של Scriptable אחר קובץ שמכיל URL של Apps Script + token.
async function scanScripts() {
    const RX_URL = /BRIDGE_URL\s*=\s*['"](https:\/\/script\.google\.com\/[^'"]+)['"]/;
    const RX_TOK = /\bTOKEN\s*=\s*['"]([^'"]{6,})['"]/;
    const managers = [];
    try { managers.push(FileManager.iCloud()); } catch (e) {}
    try { managers.push(FileManager.local()); } catch (e) {}

    for (const fm of managers) {
        let dir, names;
        try { dir = fm.documentsDirectory(); names = fm.listContents(dir); }
        catch (e) { continue; }
        for (const name of names) {
            if (!name.endsWith('.js')) continue;
            const path = fm.joinPath(dir, name);
            try {
                if (fm.isFileStoredIniCloud(path) && !fm.isFileDownloaded(path)) {
                    await fm.downloadFileFromiCloud(path);
                }
                const src = fm.readString(path);
                const u = RX_URL.exec(src), t = RX_TOK.exec(src);
                if (u && t && t[1].indexOf('PASTE_') !== 0) return { url: u[1], token: t[1] };
            } catch (e) { /* קובץ לא קריא/לא זמין — ממשיכים לבא */ }
        }
    }
    return null;
}

// ═══════════════ מצב: לא נמצאו אישורים ═══════════════
function buildNoCreds(w, fam) {
    if (fam === 'accessoryInline') { w.addText('GYMPRO — חסר חיבור לגשר'); return; }
    w.addSpacer();
    const t = centeredText(w, 'GYMPRO');
    t.font = Font.blackSystemFont(fam === 'accessoryCircular' ? 10 : 12); t.textColor = w_(A.mid);
    const m = centeredText(w, fam === 'accessoryCircular' ? 'הרץ ▶' : 'הרץ ▶ בעורך Scriptable');
    m.font = Font.mediumSystemFont(fam === 'accessoryCircular' ? 8 : 9.5);
    m.textColor = w_(A.soft); m.lineLimit = 2;
    w.addSpacer();
}

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

// ═══════════════ פריסה 2: מלבן — תזונה בלבד (קלוריות + מאקרו מול יעד) ═══════
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

    w.addSpacer();   // מרכוז אנכי בתוך אזור ה-72pt

    // ── שורה 1: קק"ל/יעד מימין, שעת עדכון משמאל אם ה-snapshot ישן ──
    // היחידה חייבת להיות מחוברת למחרוזת היעד ולא רכיב נפרד אחרי המספר הגדול:
    // ב-RTL הרכיב הימני-ביותר נקרא ראשון, ו-"קק"ל" בסוף השורה גרם ל-
    // "קק"ל 2,100 / 2,610". כך זה נקרא "2,100 / 2,610 קק"ל".
    const top = w.addStack();
    top.layoutHorizontally(); top.bottomAlignContent();
    if (isStale(s.generated)) {
        const st = top.addText(fmtTime(s.generated));
        st.font = Font.mediumSystemFont(8); st.textColor = w_(A.dim);
    }
    top.addSpacer();
    const suffix = top.addText(target > 0 ? '/ ' + fmtNum(target) + ' קק"ל' : 'קק"ל');
    suffix.font = Font.semiboldRoundedSystemFont(10); suffix.textColor = w_(A.soft);
    suffix.lineLimit = 1;
    const big = top.addText(fmtNum(kcal));
    big.font = Font.blackRoundedSystemFont(15); big.textColor = w_(A.full);
    big.minimumScaleFactor = 0.7; big.lineLimit = 1;

    w.addSpacer(4);
    addBar(w, pct);
    w.addSpacer(5);

    // ── שורה 3: מאקרו מול היעדים, מיושר לימין ──
    const bottom = w.addStack();
    bottom.layoutHorizontally(); bottom.bottomAlignContent();
    bottom.addSpacer();
    const macros = bottom.addStack();
    macros.layoutHorizontally(); macros.spacing = 7; macros.bottomAlignContent();
    addMacro(macros, 'F', n.fat, n.fatTarget);          // LTR: נוסף ראשון = שמאל קיצוני
    addMacro(macros, 'C', n.carbs, n.carbsTarget);
    addMacro(macros, 'P', n.protein, n.proteinTarget);

    w.addSpacer();
}

// ═══════════════ פריסה 4: ריבוע משקל (Parameter = weight) ═══════════════
// המשקל שירד מהמלבן חוזר כאן — בריבוע משלו, עם ספארקליין שבועי שנותן את
// המגמה במבט אחד. אין טבעת: למשקל אין יעד ב-snapshot, וטבעת בלי יעד היא שקר.
// במקומה — רקע ה-accessory של המערכת, שנותן לריבוע צורה מוגדרת.
function buildWeightCircular(w, s) {
    w.addAccessoryWidgetBackground = true;
    const wt = s && s.weight;
    w.addSpacer();
    if (!wt) {
        const t = centeredText(w, '—');
        t.font = Font.blackRoundedSystemFont(16); t.textColor = w_(A.mid);
        const m = centeredText(w, 'אין שקילות');
        m.font = Font.mediumSystemFont(8); m.textColor = w_(A.soft); m.lineLimit = 1;
        w.addSpacer();
        return;
    }
    // שורה 1: היחידה נוספת לפני המספר (LTR) → נקרא ב-RTL "82.4 ק"ג"
    const r1 = w.addStack();
    r1.layoutHorizontally(); r1.bottomAlignContent(); r1.spacing = 2;
    r1.addSpacer();
    const u = r1.addText('ק"ג');
    u.font = Font.semiboldSystemFont(8); u.textColor = w_(A.soft);
    const v = r1.addText(String(wt.current));
    v.font = Font.blackRoundedSystemFont(17); v.textColor = w_(A.full);
    v.lineLimit = 1; v.minimumScaleFactor = 0.6;
    r1.addSpacer();

    if ((wt.points || []).length >= 2) {
        w.addSpacer(1);
        const r2 = w.addStack();
        r2.layoutHorizontally(); r2.addSpacer();
        const im = r2.addImage(sparkline(wt.points, 138, 36));
        im.imageSize = new Size(46, 12);
        r2.addSpacer();
    }

    const d = centeredText(w, deltaText(wt.weekDelta));
    d.font = Font.heavyRoundedSystemFont(9); d.textColor = w_(A.soft);
    d.lineLimit = 1;
    w.addSpacer();
}

// גרסת מלבן של המשקל — למי שמעדיף לתת לו את הרוחב המלא במקום לתזונה.
function buildWeightRectangular(w, s) {
    const wt = s && s.weight;
    w.addSpacer();
    if (!wt) {
        const t = w.addText('אין שקילות');
        t.font = Font.semiboldSystemFont(11); t.textColor = w_(A.mid);
        w.addSpacer();
        return;
    }
    const r1 = w.addStack();
    r1.layoutHorizontally(); r1.bottomAlignContent(); r1.spacing = 3;
    r1.addSpacer();
    const u = r1.addText('ק"ג');
    u.font = Font.semiboldSystemFont(10); u.textColor = w_(A.soft);
    const v = r1.addText(String(wt.current));
    v.font = Font.blackRoundedSystemFont(20); v.textColor = w_(A.full);
    v.lineLimit = 1; v.minimumScaleFactor = 0.7;

    if ((wt.points || []).length >= 2) {
        w.addSpacer(3);
        const r2 = w.addStack();
        r2.layoutHorizontally();
        const im = r2.addImage(sparkline(wt.points, 330, 60));
        im.imageSize = new Size(110, 20);
        r2.addSpacer();
    }

    w.addSpacer(3);
    const r3 = w.addStack();
    r3.layoutHorizontally(); r3.spacing = 4; r3.centerAlignContent();
    r3.addSpacer();
    const lbl = r3.addText('מגמה שבועית');       // LTR: נוסף ראשון = שמאל
    lbl.font = Font.mediumSystemFont(8.5); lbl.textColor = w_(A.dim);
    const d = r3.addText(deltaText(wt.weekDelta));
    d.font = Font.heavyRoundedSystemFont(10); d.textColor = w_(A.soft);
    w.addSpacer();
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

// רוחב ווידג'ט accessoryRectangular (נקודות) — משמש למילוי הפס בלבד; ה-track
// עצמו גמיש. נמדד מצילום מסך: 160pt במסך 440pt — כלומר iOS מקצה רוחב כמעט
// קבוע, לא פרופורציה. הנוסחה הקודמת (sw*0.41 → 175) ניפחה את המילוי ב-9%
// והפס נראה מלא ב-80% אמיתיים. עדיף לזלוג כלפי מטה: מילוי חסר קורא "עוד לא
// סיימת", מילוי עודף משקר "סיימת".
function rectWidgetWidth() {
    const sz = Device.screenSize();
    const sw = Math.min(sz.width, sz.height);
    const map = { 440: 160, 430: 160, 428: 160, 414: 160, 402: 158, 393: 158, 390: 158, 375: 157, 360: 157, 320: 141 };
    return map[sw] || Math.max(141, Math.min(160, Math.round(sw * 0.37)));
}

// ספארקליין מונוכרומטי — קו במגמה + נקודת קצה מלאה. ציר הזמן מימין לשמאל
// (RTL): הנקודה הישנה מימין, העדכנית משמאל. מצויר ב-3x ומוצג מוקטן.
function sparkline(points, W, H) {
    const ctx = new DrawContext();
    ctx.size = new Size(W, H); ctx.opaque = false; ctx.respectScreenScale = false;
    if (points.length >= 2) {
        const min = Math.min(...points), max = Math.max(...points);
        const span = (max - min) || 1;
        const PAD = Math.round(H * 0.2);
        const x = i => PAD + (W - 2 * PAD) * (i / (points.length - 1));
        const y = v => PAD + (H - 2 * PAD) * (1 - (v - min) / span);
        const px = i => W - x(i);

        const line = new Path();
        points.forEach((v, i) => {
            const pt = new Point(px(i), y(v));
            i === 0 ? line.move(pt) : line.addLine(pt);
        });
        ctx.addPath(line);
        ctx.setStrokeColor(w_(A.mid));
        ctx.setLineWidth(Math.max(2, H * 0.11));
        ctx.strokePath();

        const r = Math.max(2.5, H * 0.1);
        ctx.setFillColor(w_(A.full));
        ctx.fillEllipse(new Rect(px(points.length - 1) - r, y(points[points.length - 1]) - r, r * 2, r * 2));
    }
    return ctx.getImage();
}

function deltaText(d) { return (d > 0 ? '▴' : d < 0 ? '▾' : '·') + Math.abs(d || 0).toFixed(1); }

// "145/170P" — ערך מלא, יעד עמום, אות המאקרו. אותו תחביר "ערך / יעד" של
// שורת הקלוריות, כדי שהווידג'ט יקרא כסיפור אחד. בלי יעד מוגדר — רק הערך.
function addMacro(stack, tag, val, target) {
    const st = stack.addStack();
    st.layoutHorizontally(); st.spacing = 1; st.bottomAlignContent();
    const v = st.addText(String(Math.round(val || 0)));
    v.font = Font.boldRoundedSystemFont(10); v.textColor = w_(A.mid);
    v.lineLimit = 1; v.minimumScaleFactor = 0.8;
    if (target > 0) {
        const t = st.addText('/' + Math.round(target));
        t.font = Font.mediumRoundedSystemFont(8); t.textColor = w_(A.dim);
        t.lineLimit = 1; t.minimumScaleFactor = 0.8;
    }
    const g = st.addText(tag);
    g.font = Font.blackSystemFont(8); g.textColor = w_(A.dim);
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
