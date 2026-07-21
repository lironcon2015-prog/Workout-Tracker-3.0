/* ============================================================================
 * bodylog-logic.js — מעקב שקילות (משקל + אחוז שומן) GYMPRO ELITE
 * מסך "גוף": רשימת שקילות, גרפים, ניתוחים, צילום/OCR, ייבוא וייצוא CSV.
 * המצב התזונתי לכל שקילה נגזר אוטומטית מלוג המעברים (StorageManager).
 * ==========================================================================*/

let _blRange = 30;            // טווח גרף נוכחי: 7 / 30 / 90 / 'all' / 'custom'
let _blCustom = { from: '', to: '' };  // גבולות טווח מותאם (YYYY-MM-DD)
let _blTab = 'weight';        // תת-מסך פעיל: 'weight' | 'nutrition' | 'photos'
let _blListExpanded = false;  // האם רשימת השקילות מורחבת (מעבר ל-7 האחרונות)
let _blNutriExpanded = false; // האם רשימת התזונה מורחבת
let _blEditDate = null;       // התאריך שנערך כרגע (null = רשומה חדשה)
let _bodyImportRows = [];     // שורות מפורסרות מ-CSV הממתינות לאישור
let _bodyImportMap = {};      // מיפוי תווית "שלב" גולמית → מצב תזונתי

const _BL_STATE_LBL = { cut: 'Cut', maintenance: 'Maintenance', surplus: 'Surplus' };

// ─── עזרי תאריך ─────────────────────────────────────────────────────────────
function _blDTs(d) { const [y, m, da] = d.split('-').map(Number); return new Date(y, m - 1, da).getTime(); }
// תאריך מקומי — לא UTC! toISOString החזיר את "אתמול" בין חצות ל-03:00 שעון ישראל,
// מה שמנע מהיום שהסתיים להיסגר (להופיע בהיסטוריה/ממוצע/גרפים) עד לפנות בוקר
function _blLocalDateStr(d) { const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
function _blTodayStr() { return _blLocalDateStr(new Date()); }
function _blShortDate(d) { const p = d.split('-'); return `${p[2]}.${p[1]}`; }          // DD.MM (ציר הגרף)
function _blListDate(d) { const p = d.split('-'); return `${p[2]}.${p[1]}.${p[0]}`; }   // DD.MM.YYYY (לוג השקילות)
function _blCutoff(days) { return _blLocalDateStr(new Date(Date.now() - days * 86400000)); }

// ─── רינדור ראשי ────────────────────────────────────────────────────────────
function renderBodyLog() {
    const log = StorageManager.getBodyLog();
    _renderBodyKpis(log);
    _renderBodyCharts(log);
    _renderBodyList(log);          // הרשימה חיה בארכיון — נשמרת טרייה אחרי כל שינוי דאטה
    _renderNutritionView();
    if (typeof _renderBodyPhotos === 'function') _renderBodyPhotos();
    _applyTabVisibility();
    // לוח השנה בארכיון מציג גם שקילות/תזונה — רענון אם הוא זה שמוצג כרגע
    if (document.getElementById('ui-archive')?.classList.contains('active')
        && state.archiveView === 'calendar' && typeof renderCalendar === 'function') renderCalendar();
}

// ─── טווח רשימות הארכיון (שקילות/תזונה) ─────────────────────────────────────
let _arRange = 'all';
function _arFilterByRange(list) {
    if (_arRange === 'all') return list;
    const cutoff = _blCutoff(_arRange);
    return list.filter(e => e.date >= cutoff);
}

function setArchiveListRange(r) {
    _arRange = r;
    document.querySelectorAll('#ar-range-chips .bl-chip').forEach(b =>
        b.classList.toggle('active', String(b.dataset.range) === String(r)));
    _renderBodyList(StorageManager.getBodyLog());
    _renderNutritionList();
    haptic('light');
}

// ─── תתי-מסכים: שקילה / תזונה / תמונות ──────────────────────────────────────
function _applyTabVisibility() {
    document.querySelectorAll('#bl-subtab .seg-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === _blTab));
    const w = document.getElementById('bl-view-weight');
    const n = document.getElementById('bl-view-nutrition');
    const p = document.getElementById('bl-view-photos');
    const s = document.getElementById('bl-view-sleep');
    if (w) w.style.display = _blTab === 'weight' ? '' : 'none';
    if (n) n.style.display = _blTab === 'nutrition' ? '' : 'none';
    if (p) p.style.display = _blTab === 'photos' ? '' : 'none';
    if (s) s.style.display = _blTab === 'sleep' ? '' : 'none';
    // צ'יפי הטווח שייכים לגרפי משקל/תזונה בלבד — תמונות ושינה מנהלים טווח בעצמם
    const noChips = (_blTab === 'photos' || _blTab === 'sleep');
    const chips = document.getElementById('bl-range-chips');
    if (chips) chips.style.display = noChips ? 'none' : '';
    const custom = document.getElementById('bl-custom-range');
    if (custom) custom.style.display = (!noChips && _blRange === 'custom') ? 'flex' : 'none';
}

function setBodyTab(tab) {
    _blTab = tab;
    _applyTabVisibility();
    _refreshActiveView();   // ציור מחדש כדי שגאומטריית ה-tooltip תתעדכן בתצוגה הגלויה
    haptic('light');
}

function _refreshActiveView() {
    if (_blTab === 'weight') _renderBodyCharts(StorageManager.getBodyLog());
    else if (_blTab === 'photos') { if (typeof _renderBodyPhotos === 'function') _renderBodyPhotos(); }
    else if (_blTab === 'sleep') { if (typeof renderSleepView === 'function') renderSleepView(); }
    else _renderNutritionView();
}

// ─── טווח (משותף לשתי התצוגות) ───────────────────────────────────────────────
function setBodyRange(r) {
    _blRange = r;
    document.querySelectorAll('#bl-range-chips .bl-chip').forEach(b =>
        b.classList.toggle('active', String(b.dataset.range) === String(r)));
    const cr = document.getElementById('bl-custom-range');
    if (cr) cr.style.display = (r === 'custom') ? 'flex' : 'none';
    if (r === 'custom') {
        const f = document.getElementById('bl-custom-from');
        const t = document.getElementById('bl-custom-to');
        const today = _blTodayStr();
        if (t) { t.max = today; if (!t.value) t.value = today; }
        if (f) { f.max = today; if (!f.value) f.value = _blCutoff(30); }
        _blCustom = { from: f ? f.value : '', to: t ? t.value : '' };
    }
    _refreshActiveView();
    haptic('light');
}

function applyCustomRange() {
    const f = document.getElementById('bl-custom-from');
    const t = document.getElementById('bl-custom-to');
    _blCustom = { from: f ? f.value : '', to: t ? t.value : '' };
    _refreshActiveView();
}

// _syncGraphToTdeeWindow — מסנכרן את טווח הגרפים (משקל/תזונה) לחלון ה-TDEE הידני,
// כך שהמשתמש רואה ויזואלית בדיוק את הנתונים שמזינים את חישוב ה-back-calc.
function _syncGraphToTdeeWindow(from) {
    _blRange = 'custom';
    _blCustom = { from, to: _blTodayStr() };
    document.querySelectorAll('#bl-range-chips .bl-chip').forEach(b =>
        b.classList.toggle('active', b.dataset.range === 'custom'));
    const cr = document.getElementById('bl-custom-range'); if (cr) cr.style.display = 'flex';
    const f = document.getElementById('bl-custom-from'); if (f) f.value = from;
    const tEl = document.getElementById('bl-custom-to'); if (tEl) tEl.value = _blCustom.to;
    _refreshActiveView();
}

function _rangeLabel() {
    if (_blRange === 'all') return 'כל הימים';
    if (_blRange === 'custom')
        return (_blCustom.from && _blCustom.to) ? `${_blListDate(_blCustom.from)}–${_blListDate(_blCustom.to)}` : 'טווח מותאם';
    return `${_blRange} ימים אחרונים`;
}

function _blFilter(log) {
    if (_blRange === 'all') return log.slice();
    if (_blRange === 'custom') {
        const { from, to } = _blCustom;
        return log.filter(e => (!from || e.date >= from) && (!to || e.date <= to));
    }
    const cutoff = _blCutoff(_blRange);
    return log.filter(e => e.date >= cutoff);
}

// ─── תצוגת תזונה (MyFitnessPal) ──────────────────────────────────────────────
function _renderNutritionView() {
    const all = StorageManager.getNutritionDaily();
    _renderNutritionDaily(all);
    _renderNutritionCard(all);
    _renderTdeeCard();
    _renderNutritionCharts(all);
    _renderNutritionList(all);
}

// ─── מנוע TDEE / מאזן אנרגיה ─────────────────────────────────────────────────
const _ACTIVITY_MULT = { sedentary: 1.2, light: 1.375, moderate: 1.55, very: 1.725, extra: 1.9 };
const _TDEE_WINDOW = 28;          // ימים אחרונים לחישוב המדידה (יציבות מול רעש מים)
const _KCAL_PER_KG = 7700;

function _addDays(dateStr, n) {
    const d = new Date(_blDTs(dateStr) + n * 86400000);
    const p = x => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// רגרסיה לינארית — מחזיר {slope, rmse} (slope ביחידת v ליחידת t). points: [{t, v}]
function _linReg(points) {
    const n = points.length;
    if (n < 2) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    points.forEach(p => { sx += p.t; sy += p.v; sxx += p.t * p.t; sxy += p.t * p.v; });
    const den = n * sxx - sx * sx;
    if (den === 0) return null;
    const slope = (n * sxy - sx * sy) / den;
    const intercept = (sy - slope * sx) / n;
    const rmse = Math.sqrt(points.reduce((s, p) => { const e = p.v - (intercept + slope * p.t); return s + e * e; }, 0) / n);
    return { slope, rmse };
}

// _latestWeightSegment — מחזיר את המקטע הרציף האחרון של סדרת המשקל. פער > 4 ימים בין
// שקילות = מאזניים חדש / baseline חדש (הפרש כיול), ואסור לחצות אותו ברגרסיה אחת —
// אחרת קפיצת הכיול נספרת כ"ירידת משקל" מלאכותית ומנפחת את ה-TDEE.
// points: [{t(ms), v, date}] ממוינים עולה.
function _latestWeightSegment(points) {
    if (points.length < 6) return points;               // מעט מדי לפיצול אמין
    let seg = [points[0]];
    for (let i = 1; i < points.length; i++) {
        if ((points[i].t - points[i - 1].t) / 86400000 > 4) seg = [points[i]];
        else seg.push(points[i]);
    }
    return seg;
}

// _despikeWeight — מסיר ספייק יומי בודד: נקודה שחורגת > 0.8 ק"ג מממוצע שכניה המיידיים
// (אגירת מים/ריפיד/מסעדה/יום פחמימה גבוה). נקודה כזו, בעיקר בקצה החלון, מושכת את קו
// הרגרסיה ומנפחת את קצב הירידה. שומר על המגמה האמיתית שרוב הנקודות משקפות.
function _despikeWeight(seg) {
    if (seg.length < 6) return seg;                      // מקטע קצר — אל תסנן
    const kept = seg.filter((p, i) => {
        const nb = [seg[i - 1], seg[i + 1]].filter(Boolean).map(x => x.v);
        if (!nb.length) return true;
        const avg = nb.reduce((a, b) => a + b, 0) / nb.length;
        return Math.abs(p.v - avg) <= 0.8;
    });
    return (kept.length >= 4 && kept.length < seg.length) ? kept : seg;
}

/**
 * computeTDEE — מנוע רב-שיטתי: מדידה (back-calc) + Katch-McArdle + Cunningham + Mifflin,
 * עם reconciliation וטווח ביטחון. מחזיר null אם אין מספיק נתונים אפילו לתחזית.
 */
function computeTDEE() {
    const prof  = StorageManager.getBodyProfile();
    const mult  = _ACTIVITY_MULT[prof.activity] || 1.55;

    const res = { methods: [], best: null, low: null, high: null, confidence: '', source: '', uncertainty: '', weeklyKg: null, avgIntake: null, note: '', diverge: false };

    // --- שיטות תחזית (מבוססות מסת גוף רזה / נוסחה) ---
    const allBody = (StorageManager.getBodyLog() || []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
    const latest = allBody[allBody.length - 1];
    let lbm = null;
    if (latest && latest.weight && latest.bodyFat != null) {
        lbm = latest.weight * (1 - latest.bodyFat / 100);
        const katch = 370 + 21.6 * lbm;
        const cunn  = 500 + 22 * lbm;
        res.methods.push({ name: 'Katch-McArdle', bmr: Math.round(katch), tdee: Math.round(katch * mult) });
        res.methods.push({ name: 'Cunningham',    bmr: Math.round(cunn),  tdee: Math.round(cunn * mult) });
    }
    if (latest && latest.weight && prof.sex && prof.age && prof.height) {
        const mif = 10 * latest.weight + 6.25 * prof.height - 5 * prof.age + (prof.sex === 'male' ? 5 : -161);
        res.methods.push({ name: 'Mifflin-St Jeor', bmr: Math.round(mif), tdee: Math.round(mif * mult) });
    }

    // --- מדידה (back-calc) — מפולח לשלב התזונתי הנוכחי, מדלג על שבוע ראשון (מים) ---
    let measured = null, days = 0, rmse = 0, noisy = false;
    // תחילת חלון: 28 הימים האחרונים, אך לא לפני (תחילת השלב הנוכחי + 7 ימים)
    let startDate = _blCutoff(_TDEE_WINDOW);
    const _tdeePrefs = (typeof getAnalyticsPrefs === 'function') ? getAnalyticsPrefs() : {};
    const _tdeeCustom = !!_tdeePrefs.tdeeStartDate;
    if (_tdeeCustom) {
        // override ידני — המשתמש שולט במלואו על נקודת הפתיחה (עוקף את לוגיקת השלב)
        startDate = _tdeePrefs.tdeeStartDate;
    } else {
        try {
            const nlog = (typeof StorageManager.getNutritionLog === 'function') ? StorageManager.getNutritionLog() : null;
            const phaseStart = (nlog && nlog.length) ? nlog[nlog.length - 1].startDate : null;
            if (phaseStart) { const skip = _addDays(phaseStart, 7); if (skip > startDate) startDate = skip; }
        } catch (e) { /* אין לוג מעברים — נשארים עם חלון 28 הימים */ }
    }
    res.startDate = startDate;
    res.customStart = _tdeeCustom;

    // היום הנוכחי מוחרג — תיעוד חלקי (Health תוך-יומי) מטה את הצריכה הממוצעת כלפי מטה
    const _tdToday = _blTodayStr();
    // ניקוי סדרת המשקל לפני רגרסיה — מקטע רציף אחרון (פער מאזניים/baseline) + הסרת ספייק מים/ריפיד.
    // מונע ניפוח השיפוע מנקודה חריגה בקצה החלון (לדוגמה משקל אחרי מסעדה / יום פחמימה גבוה).
    const bodRaw = (StorageManager.getBodyLog() || []).filter(e => e.date >= startDate).sort((a, b) => a.date < b.date ? -1 : 1);
    const bodSeg = _latestWeightSegment(bodRaw.map(e => ({ t: _blDTs(e.date), v: e.weight, date: e.date })));
    const bodW = _despikeWeight(bodSeg);
    // הצריכה הממוצעת מיושרת לתחילת מקטע המשקל (לפני ה-despike) — תקפות מאזן אנרגיה
    const segStart = bodSeg.length ? bodSeg[0].date : startDate;
    const nutW = (StorageManager.getNutritionDaily() || []).filter(d => d.date >= segStart && d.date !== _tdToday);
    const spanDays = bodSeg.length ? (bodSeg[bodSeg.length - 1].t - bodSeg[0].t) / 86400000 : 0;
    res.effectiveStart = segStart;                       // נקודת הפתיחה האפקטיבית (אחרי פיצול פער מאזניים)
    res.spanDays = Math.round(spanDays);
    res.trimmedOld = !!(bodRaw.length && bodSeg.length && bodSeg[0].date !== bodRaw[0].date);
    // פרטי הפער שגרם לחיתוך — עבור חלונית ההסבר ("i")
    if (res.trimmedOld) {
        const idx = bodRaw.findIndex(e => e.date === bodSeg[0].date);
        const prev = idx > 0 ? bodRaw[idx - 1] : null;
        if (prev) { res.gapLastOld = prev.date; res.gapDays = Math.round((bodSeg[0].t - _blDTs(prev.date)) / 86400000); }
    }
    // שקילות שדולגו ע"י ה-despike (ספייק מים/ריפיד) — עבור חלונית ההסבר
    res.despiked = bodSeg.filter(p => !bodW.includes(p)).map(p => ({ date: p.date, weight: p.v }));
    if (nutW.length >= 10 && bodW.length >= 4 && spanDays >= 10) {
        const cleaned = _cleanNutriOutliers(nutW.map(d => ({ date: d.date, val: d.calories })));
        const avgIntake = Math.round(cleaned.reduce((s, p) => s + p.val, 0) / cleaned.length);
        const t0 = bodW[0].t;
        const reg = _linReg(bodW.map(p => ({ t: (p.t - t0) / 86400000, v: p.v })));
        if (reg) {
            measured = Math.round(avgIntake - reg.slope * _KCAL_PER_KG);
            rmse = reg.rmse;
            res.avgIntake = avgIntake;
            res.weeklyKg = +(reg.slope * 7).toFixed(2);
            days = nutW.length;
            res.days = days;
            noisy = (rmse > 0.7) || (days < 14);           // מגמה רועשת / חלון קצר
            // חסם שפיות — קצב בלתי-אפשרי = נתונים פגומים, אל תעגן עליו
            if (Math.abs(res.weeklyKg) > 1.6) { measured = null; res.clamped = true; }
            else { res.measuredOk = true; res.methods.push({ name: 'מדידה (back-calc)', bmr: null, tdee: measured, note: `<span class="bl-tdee-days-tap" onclick="openTdeeRangeModal()" role="button" tabindex="0">${days} ימים</span>` }); }
        }
    } else if (bodSeg.length >= 2 && (spanDays < 10 || nutW.length < 10)) {
        // אין מדידה כי החלון קצר מ-10 ימי מגמה/תזונה — נשמר כדי להציג רמז למשתמש
        res.shortWindow = true;
    }

    // --- reconciliation ---
    if (measured != null) {
        const ci = noisy ? 0.12 : 0.07;
        res.best = measured;
        res.low = Math.round(measured * (1 - ci));
        res.high = Math.round(measured * (1 + ci));
        res.confidence = noisy ? 'בינוני' : 'גבוה';
        res.source = 'מדידה';
        res.uncertainty = noisy ? 'מגמת משקל רועשת (מעבר שלב/כיול)' : 'דיוק הדיווח ב-MFP';
        res.note = `מבוסס על ${days} ימי תזונה + מגמת משקל בשלב הנוכחי`;
        const preds = res.methods.filter(m => m.bmr != null).map(m => m.tdee);
        if (preds.length && Math.max(...preds.map(p => Math.abs(p - measured) / measured)) > 0.18) res.diverge = true;
    } else {
        const preds = res.methods.map(m => m.tdee).sort((a, b) => a - b);
        if (!preds.length) return null;
        const mid = preds.length % 2 ? preds[(preds.length - 1) / 2] : Math.round((preds[preds.length / 2 - 1] + preds[preds.length / 2]) / 2);
        const ci = (lbm != null) ? 0.10 : 0.15;
        res.best = mid;
        res.low = Math.round(mid * (1 - ci));
        res.high = Math.round(mid * (1 + ci));
        res.confidence = (lbm != null) ? 'בינוני' : 'נמוך';
        res.source = 'תחזית';
        res.uncertainty = 'מכפיל הפעילות';
        res.note = 'תחזית מנוסחאות — ל-≥14 ימי תזונה+שקילות תתקבל מדידה מדויקת';
    }
    return res;
}

// ─── ייצוא TDEE גולמי — שכבת ביקורת מעל computeTDEE (לא נוגעת בחישוב עצמו) ───
// מוציא JSON עם הסדרות המלאות + סימון חלונות מזוהמים, לבדיקת אמינות ידנית.
// ספי הזיהוי — קבועים לכיול עתידי, אסור להטמיע ערכים קשיחים בלוגיקה למטה.
const _TDEE_EXPORT_CFG = {
    PHASE_TRANSITION_DAYS: 18,      // ימי ריבאונד גליקוגן לסימון אחרי כל גבול פאזה
    LOW_INTAKE_PCT: 0.60,           // צריכה מתחת לאחוז זה מממוצע החלון = מחלה/תת-אכילה
    WEIGHT_SPIKE_KG_PER_DAY: 0.8,   // קצב שינוי משקל יומי מעל זה = מים/מלח, לא אנרגיה
    ROLLING_AVG_DAYS: 7,            // חלון הממוצע הנע לסדרת המשקל (זהה לגרף)
    MIN_CLEAN_DAYS: 10              // מינימום ימים בחלון נקי לחישוב back-calc מנוקה
};
// שמות פאזות לייצוא — 'surplus' הפנימי הוא 'bulk' במינוח המקובל
const _TDEE_PHASE_NAME = { cut: 'cut', maintenance: 'maintenance', surplus: 'bulk' };

function buildTdeeRawExport() {
    const t = computeTDEE();
    if (!t) return null;
    const cfg = _TDEE_EXPORT_CFG;
    const today = _blTodayStr();
    const from = t.effectiveStart || t.startDate;
    const to = today;
    const winDays = Math.round((_blDTs(to) - _blDTs(from)) / 86400000) + 1;

    // סדרת המשקל המלאה בחלון + ממוצע נע נגרר (אותה שיטה כמו בגרף המשקל)
    const weights = (StorageManager.getBodyLog() || [])
        .filter(e => e.date >= from && e.date <= to)
        .slice().sort((a, b) => a.date < b.date ? -1 : 1);
    const weightSeries = weights.map((e, i) => {
        const slice = weights.slice(Math.max(0, i - (cfg.ROLLING_AVG_DAYS - 1)), i + 1);
        const avg = slice.reduce((s, x) => s + x.weight, 0) / slice.length;
        return { date: e.date, raw_kg: e.weight, rolling_avg_kg: +avg.toFixed(2) };
    });

    // סדרת הצריכה — כל יום בחלון; יום ללא דיווח = kcal:null (לא ממציאים נתונים)
    const dailyMap = {};
    (StorageManager.getNutritionDaily() || []).forEach(d => { if (d && d.date) dailyMap[d.date] = d; });
    const allDates = [];
    for (let d = from; d <= to; d = _addDays(d, 1)) allDates.push(d);

    // גבולות פאזה — מלוג המעברים הקיים (ישות הפאזה של המערכת)
    const plog = StorageManager.getNutritionLog() || [];
    const boundaries = [];
    for (let i = 1; i < plog.length; i++) {
        boundaries.push({
            date: plog[i].startDate,
            from_phase: _TDEE_PHASE_NAME[plog[i - 1].state] || plog[i - 1].state,
            to_phase: _TDEE_PHASE_NAME[plog[i].state] || plog[i].state
        });
    }
    // גבול רלוונטי = חלון המעבר שלו (N ימים) נוגע בחלון החישוב
    const relBounds = boundaries.filter(b =>
        b.date <= to && _addDays(b.date, cfg.PHASE_TRANSITION_DAYS - 1) >= from);

    // ── סימון חלונות מזוהמים ──
    const flags = [];
    // (א) מעבר פאזה — N הימים הראשונים אחרי כל גבול (ריבאונד גליקוגן/מים)
    relBounds.forEach(b => {
        for (let i = 0; i < cfg.PHASE_TRANSITION_DAYS; i++) {
            const d = _addDays(b.date, i);
            if (d < from || d > to) continue;
            flags.push({ date: d, type: 'phase_transition', trigger_value: i + 1,
                note: `יום ${i + 1}/${cfg.PHASE_TRANSITION_DAYS} אחרי מעבר ${b.from_phase}→${b.to_phase} (${b.date})` });
        }
    });
    // (ב) תת-אכילה/מחלה — צריכה מתחת לאחוז הסף מממוצע הימים המדווחים בחלון
    const reported = allDates.map(d => dailyMap[d]).filter(x => x && x.calories > 0);
    const meanKcal = reported.length ? reported.reduce((s, x) => s + x.calories, 0) / reported.length : null;
    if (meanKcal) {
        const floor = meanKcal * cfg.LOW_INTAKE_PCT;
        reported.forEach(x => {
            if (x.calories < floor) flags.push({ date: x.date, type: 'low_intake', trigger_value: Math.round(x.calories),
                note: `צריכה ${Math.round(x.calories)} קק"ל — מתחת ל-${Math.round(cfg.LOW_INTAKE_PCT * 100)}% מממוצע החלון (${Math.round(meanKcal)})` });
        });
    }
    // (ג) קפיצת משקל — קצב יומי בין שקילות עוקבות מעל הסף
    for (let i = 1; i < weights.length; i++) {
        const dDays = Math.max(1, Math.round((_blDTs(weights[i].date) - _blDTs(weights[i - 1].date)) / 86400000));
        const rate = (weights[i].weight - weights[i - 1].weight) / dDays;
        if (Math.abs(rate) > cfg.WEIGHT_SPIKE_KG_PER_DAY)
            flags.push({ date: weights[i].date, type: 'weight_spike', trigger_value: +rate.toFixed(2),
                note: `שינוי ${rate > 0 ? '+' : ''}${rate.toFixed(2)} ק"ג/יום מול השקילה הקודמת (${weights[i - 1].date})` });
    }
    flags.sort((a, b) => a.date < b.date ? -1 : 1);
    const flaggedSet = new Set(flags.map(f => f.date));

    // ── החלון הרציף הארוך ביותר ללא ימים מסומנים + back-calc מנוקה ──
    let best = null, runStart = null;
    allDates.forEach((d, i) => {
        if (flaggedSet.has(d)) { runStart = null; return; }
        if (runStart == null) runStart = i;
        const len = i - runStart + 1;
        if (!best || len > best.len) best = { from: allDates[runStart], to: d, len };
    });
    let clean = null;
    if (best && best.len >= cfg.MIN_CLEAN_DAYS) {
        const cw = weights.filter(e => e.date >= best.from && e.date <= best.to);
        const ci = allDates.filter(d => d >= best.from && d <= best.to && d !== today)
            .map(d => dailyMap[d]).filter(x => x && x.calories > 0);
        if (cw.length >= 4 && ci.length >= 7) {
            const t0 = _blDTs(cw[0].date);
            const reg = _linReg(cw.map(e => ({ t: (_blDTs(e.date) - t0) / 86400000, v: e.weight })));
            const avg = ci.reduce((s, x) => s + x.calories, 0) / ci.length;
            if (reg) clean = { from: best.from, to: best.to, days: best.len,
                tdee_clean: Math.round(avg - reg.slope * _KCAL_PER_KG) };
        }
    }
    if (!clean) clean = best
        ? { from: best.from, to: best.to, days: best.len, tdee_clean: null,
            note: 'אין מספיק שקילות/ימי תזונה בחלון הנקי לחישוב back-calc אמין' }
        : { from: null, to: null, days: 0, tdee_clean: null, note: 'לא נמצא חלון נקי רציף' };

    const byName = n => { const m = t.methods.find(x => x.name.startsWith(n)); return m ? m.tdee : null; };
    return {
        meta: {
            generated: new Date().toISOString(),
            window: { from, to, days: winDays },
            method: 'back-calc',
            energy_coefficient_kcal_per_kg: _KCAL_PER_KG,
            rolling_avg_window_days: cfg.ROLLING_AVG_DAYS,
            thresholds: {
                phase_transition_days: cfg.PHASE_TRANSITION_DAYS,
                low_intake_pct: cfg.LOW_INTAKE_PCT,
                weight_spike_kg_per_day: cfg.WEIGHT_SPIKE_KG_PER_DAY
            },
            results: {
                back_calc_full: t.measuredOk ? t.best : null,
                back_calc_clean: clean.tdee_clean,
                katch_mcardle: byName('Katch-McArdle'),
                cunningham: byName('Cunningham'),
                mifflin_st_jeor: byName('Mifflin-St Jeor')
            }
        },
        weight_series: weightSeries,
        intake_series: allDates.map(d => ({
            date: d,
            kcal: (dailyMap[d] && dailyMap[d].calories > 0) ? Math.round(dailyMap[d].calories) : null,
            flagged: flaggedSet.has(d)
        })),
        phase_boundaries: relBounds,
        contamination_flags: flags,
        clean_window: clean
    };
}

function exportTdeeRawJson() {
    const payload = buildTdeeRawExport();
    if (!payload) { showAlert('אין מספיק נתונים לייצוא חישוב TDEE.'); return; }
    _blDownloadJson(payload, `gympro_tdee_raw_${_blTodayStr()}.json`);
    haptic('light');
}

// מצב הרחבת כרטיס המאזן — ברירת מחדל מקופל (hero + קצב נוכחי בלבד)
let _blTdeeExpanded = false;
function toggleTdeeExpand() { _blTdeeExpanded = !_blTdeeExpanded; _renderTdeeCard(); haptic('light'); }

function _renderTdeeCard() {
    const card = document.getElementById('bl-tdee-card');
    if (!card) return;
    const t = computeTDEE();
    if (!t) {
        // אם פעיל טווח ידני שמרוקן את הנתונים — קישור חזרה לאוטומטי (מניעת מצב "לכוד")
        const customSet = (typeof getAnalyticsPrefs === 'function') && getAnalyticsPrefs().tdeeStartDate;
        const resetLink = customSet
            ? `<div class="bl-tdee-window bl-tdee-window--reset" onclick="resetTdeeStartDate()" role="button" tabindex="0">טווח חישוב ידני פעיל — חזרה לאוטומטי (28 ימים)</div>`
            : '';
        card.innerHTML = `<div class="bl-chart-title">מאזן אנרגיה · TDEE</div>
            <p class="bl-nutri-hint">צריך עוד נתונים: שקילה עם אחוז שומן (לתחזית מיידית) או ≥14 ימי תזונה+שקילות (למדידה מדויקת). אפשר גם להוסיף מין/גיל/גובה בהגדרות.</p>${resetLink}`;
        return;
    }
    const fmt = n => Math.round(n).toLocaleString('he-IL');
    const rows = t.methods.map(m =>
        `<tr><td>${m.name}</td><td>${m.bmr != null ? fmt(m.bmr) : '—'}</td><td>${fmt(m.tdee)}</td><td>${m.note || ''}</td></tr>`).join('');
    const cut = t.best - 550;        // גירעון ל-~0.5 ק"ג/שבוע
    const bulk = t.best + 275;       // עודף ל-~0.25 ק"ג/שבוע
    const balance = (t.weeklyKg != null)
        ? `<div class="bl-tdee-balance">קצב נוכחי: ${t.weeklyKg >= 0 ? '+' : ''}${t.weeklyKg} ק"ג/שבוע · צריכה ממוצעת ${fmt(t.avgIntake)} קק"ל</div>` : '';
    // שורת טווח החישוב — לחיצה פותחת בורר תאריך תחילה (ידני / אוטומטי 28 ימים)
    // מציג את נקודת הפתיחה האפקטיבית (אחרי פיצול פער מאזניים), כך ש-"מ-X" תואם את מספר הימים
    const winStart = t.effectiveStart || t.startDate;
    const trimNote = t.trimmedOld ? `<div class="bl-nutri-hint">דילג על שקילות לפני ${_blListDate(winStart)} (פער מאזניים / baseline חדש)</div>` : '';
    const shortNote = t.shortWindow ? `<div class="bl-nutri-hint">החלון קצר מ-10 ימים — אין מדידת back-calc. בחר תאריך התחלה מוקדם יותר, או חזור לאוטומטי.</div>` : '';
    const windowLine = `<div class="bl-tdee-window" onclick="openTdeeRangeModal()" role="button" tabindex="0">
        <span class="material-symbols-outlined">date_range</span>
        <span>טווח חישוב: מ-${_blListDate(winStart)} ${t.customStart ? '· ידני' : '· אוטומטי'}</span>
        <span class="bl-tdee-info" onclick="event.stopPropagation(); openTdeeWindowInfo()" role="button" tabindex="0" aria-label="הסבר על טווח החישוב"><span class="material-symbols-outlined">info</span></span>
    </div>${trimNote}${shortNote}`;
    // הפירוט (טבלת שיטות, יעדים, הערות) מוסתר כברירת מחדל — נפתח בלחיצה
    const details = !_blTdeeExpanded ? '' : `
        ${windowLine}
        <table class="bl-tdee-table"><thead><tr><th>שיטה</th><th>BMR</th><th>TDEE</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        ${t.diverge ? `<div class="bl-tdee-warn">⚠ השיטות סוטות &gt;15% זו מזו — ייתכן דיווח לא עקבי</div>` : ''}
        <div class="bl-tdee-targets">
            <div><span>תחזוקה</span><b>${fmt(t.best)}</b></div>
            <div><span>ירידה ~0.5/שב'</span><b>${fmt(cut)}</b></div>
            <div><span>עלייה ~0.25/שב'</span><b>${fmt(bulk)}</b></div>
        </div>
        <div class="bl-nutri-foot">${t.note}</div>
        <button class="bl-tdee-export" onclick="exportTdeeRawJson()">
            <span class="material-symbols-outlined">download</span>
            <span>ייצוא חישוב גולמי (JSON)</span>
        </button>`;
    card.innerHTML = `
        <div class="bl-chart-title">מאזן אנרגיה · TDEE <small>— ביטחון ${t.confidence} · ${t.source}</small></div>
        <div class="bl-tdee-hero">${fmt(t.best)}<span class="bl-tdee-unit">קק"ל/יום</span></div>
        <div class="bl-tdee-range">טווח ${fmt(t.low)}–${fmt(t.high)} · אי-ודאות: ${t.uncertainty}</div>
        ${balance}
        ${details}
        <button class="bl-tdee-toggle" onclick="toggleTdeeExpand()">
            <span>${_blTdeeExpanded ? 'הסתר פירוט' : 'הצג פירוט'}</span>
            <span class="material-symbols-outlined">${_blTdeeExpanded ? 'expand_less' : 'expand_more'}</span>
        </button>`;
}

// ─── טווח חישוב TDEE — בורר תאריך תחילה ──────────────────────────────────────
// נקודת הפתיחה שממנה המנוע מושך שקילות + צריכה. ברירת מחדל: 28 הימים האחרונים.
function openTdeeRangeModal() {
    const input = document.getElementById('tdee-range-input');
    if (!input) return;
    const todayStr = _blTodayStr();
    const prefs = (typeof getAnalyticsPrefs === 'function') ? getAnalyticsPrefs() : {};
    input.value = prefs.tdeeStartDate || _blCutoff(_TDEE_WINDOW);
    input.max = todayStr;
    // min = הנתון המוקדם ביותר (שקילה/תזונה) — אין טעם לבחור לפניו
    const dates = []
        .concat((StorageManager.getBodyLog() || []).map(e => e.date))
        .concat((StorageManager.getNutritionDaily() || []).map(d => d.date))
        .filter(Boolean)
        .sort();
    if (dates.length) input.min = dates[0];
    // סימון מצב פעיל: אם אין override — כפתור ה-reset מיותר אך נשאר נגיש
    const resetBtn = document.getElementById('tdee-range-reset');
    if (resetBtn) resetBtn.style.display = prefs.tdeeStartDate ? '' : 'none';
    document.getElementById('tdee-range-modal').style.display = 'flex';
}

function closeTdeeRangeModal() {
    const m = document.getElementById('tdee-range-modal');
    if (m) m.style.display = 'none';
}

function saveTdeeStartDate() {
    const val = document.getElementById('tdee-range-input').value;
    const todayStr = _blTodayStr();
    if (!val) { showAlert('בחר תאריך.'); return; }
    if (val > todayStr) { showAlert('לא ניתן לבחור תאריך עתידי.'); return; }
    const prefs = getAnalyticsPrefs();
    prefs.tdeeStartDate = val;
    saveAnalyticsPrefs(prefs);
    closeTdeeRangeModal();
    _syncGraphToTdeeWindow(val);        // הגרפים יציגו בדיוק את חלון ה-TDEE שנבחר
    _renderTdeeCard();
    _blSyncCloud();
    haptic('success');
}

function resetTdeeStartDate() {
    const prefs = getAnalyticsPrefs();
    prefs.tdeeStartDate = null;
    saveAnalyticsPrefs(prefs);
    closeTdeeRangeModal();
    setBodyRange(30);                   // החזרת הגרפים לברירת מחדל (30 יום)
    _renderTdeeCard();
    _blSyncCloud();
    haptic('success');
}

// ─── חלונית הסבר על טווח החישוב ("i") ────────────────────────────────────────
// מסבירה דינמית למה החלון האפקטיבי שונה ממה שביקש המשתמש: פער מאזניים / ספייק
// מים / חלון קצר / קצב חורג — בכל המקרים שבהם המנוע "לא בחר" את התאריך שנקבע.
function _tdeeWindowExplainHTML(t) {
    if (!t) return '<p class="sub-text">אין כרגע מספיק נתונים לחישוב מאזן אנרגיה.</p>';
    const D = d => d ? _blListDate(d) : '—';
    const out = [];
    const req = t.customStart
        ? `התאריך שבחרת ידנית — <b>${D(t.startDate)}</b>`
        : `החלון האוטומטי — 28 הימים האחרונים (מ-<b>${D(t.startDate)}</b>)`;
    out.push(`<p>📅 <b>ביקשת:</b> ${req}.</p>`);
    out.push(`<p>⚙️ <b>חושב בפועל:</b> מ-<b>${D(t.effectiveStart)}</b>${t.measuredOk ? ` · ${t.days} ימי תזונה · קצב ${t.weeklyKg} ק"ג/שבוע` : ' · ללא מדידת back-calc (הערכת נוסחה בלבד)'}.</p>`);
    let any = false;
    if (t.trimmedOld) {
        any = true;
        out.push(`<div class="bl-info-block">🔒 <b>למה לא התחיל מהתאריך שביקשת?</b><br>
        בין השקילה ב-${D(t.gapLastOld)} לשקילה ב-${D(t.effectiveStart)} יש פער של <b>${t.gapDays} ימים</b> — סימן למאזניים חדש או baseline חדש. הפרש הכיול בין שני המאזניים (לרוב ~1 ק"ג) היה נספר בטעות כשינוי משקל ומנפח את ה-TDEE. לכן החישוב משתמש רק במקטע הרציף האחרון, מ-${D(t.effectiveStart)}.</div>`);
    }
    if (t.despiked && t.despiked.length) {
        any = true;
        const list = t.despiked.map(p => `${D(p.date)} (${p.weight} ק"ג)`).join(', ');
        out.push(`<div class="bl-info-block">💧 <b>שקילות שדולגו ברגרסיה:</b><br>
        ${t.despiked.length === 1 ? 'שקילה אחת חרגה' : `${t.despiked.length} שקילות חרגו`} ביותר מ-0.8 ק"ג מהשכנות — כנראה אגירת מים / ריפיד / מסעדה: ${list}. נקודה כזו מושכת את קו המגמה ומנפחת את הקצב, לכן הושמטה מהחישוב (אך נשמרה בהיסטוריה ובגרף).</div>`);
    }
    if (t.shortWindow) {
        any = true;
        out.push(`<div class="bl-info-block">⏳ <b>אין מדידה — החלון קצר מדי:</b><br>
        החלון מכסה ${t.spanDays} ימי מגמת משקל, מתחת למינימום של 10 ימים למדידה אמינה. הקדם את תאריך ההתחלה או המתן לעוד שקילות. בינתיים מוצגות הערכות נוסחה בלבד.</div>`);
    }
    if (t.clamped) {
        any = true;
        out.push(`<div class="bl-info-block">⚠️ <b>הקצב חרג מהסביר:</b><br>
        קצב המשקל שחושב (${t.weeklyKg} ק"ג/שבוע) חורג מהטווח הפיזיולוגי (מעל 1.6) — סימן לנתונים פגומים. לכן לא הוצגה מדידה, ונבחרה הערכת נוסחה.</div>`);
    }
    if (!any) {
        out.push(`<div class="bl-info-block">✅ החישוב השתמש בכל השקילות בחלון שבחרת, ללא דילוגים.<br>
        הנוסחה: <b>back-calc = צריכה ממוצעת − (שיפוע המשקל × 7,700 קק"ל/ק"ג)</b>.</div>`);
    }
    return out.join('');
}

function openTdeeWindowInfo() {
    const body = document.getElementById('tdee-info-body');
    if (body) body.innerHTML = _tdeeWindowExplainHTML(computeTDEE());
    const m = document.getElementById('tdee-info-modal');
    if (m) m.style.display = 'flex';
    haptic('light');
}
function closeTdeeWindowInfo() {
    const m = document.getElementById('tdee-info-modal');
    if (m) m.style.display = 'none';
}

// _renderNutritionDaily — כרטיס "תזונה היום": נתוני היום (מתעדכנים תוך-יומית מ-Health)
// + חותמת המשיכה האחרונה מהגשר. כפתור "ייבוא · ייצוא" יחיד פותח את ה-sheet המרכזי.
function _renderNutritionDaily(allDays) {
    const card = document.getElementById('bl-daily-card');
    if (!card) return;
    const all = allDays || StorageManager.getNutritionDaily();
    // לחיצה על הכרטיס = רענון ידני מגשר ה-Health; stopPropagation בכפתור מונע כפילות
    card.onclick = () => { if (typeof syncHealthNutrition === 'function') syncHealthNutrition(true); };
    card.style.cursor = 'pointer';
    // כפתור ייבוא/ייצוא עבר לתת-מסך התזונה בארכיון (openNutriIOSheet נפתח משם)
    const diaryBtn = `<button class="bl-nutri-import bl-nutri-diary" onclick="event.stopPropagation();openFoodDiary()"><span class="material-symbols-outlined">menu_book</span><span>יומן תזונה</span></button>`;

    if (!all.length) {
        card.classList.remove('bl-daily-live');
        card.innerHTML = `<div class="bl-nutri-head"><div class="bl-chart-title">תזונה היום</div><div class="bl-nutri-head-btns">${diaryBtn}</div></div>
            ${emptyStateHtml('restaurant', 'אין עדיין נתוני תזונה', 'חבר את גשר ה-Health (הגדרות) או ייבא ייצוא MFP דרך "ייבוא / ייצוא תזונה" בארכיון.')}`;
        return;
    }
    const today = _blTodayStr();
    const latest = all[all.length - 1];               // ממוין מהישן לחדש
    const isToday = latest.date === today;
    // הבלטה — תג LIVE פולס + מסגרת accent רק כשמוצגים נתוני היום השוטף
    card.classList.toggle('bl-daily-live', isToday);
    const liveBadge = isToday ? `<span class="bl-live-badge"><span class="bl-live-dot"></span>LIVE</span>` : '';
    const title = (isToday ? 'תזונה היום' : `יום אחרון <small>— ${_blListDate(latest.date)}</small>`) + liveBadge;
    // תווית מקור מלאה — כולל 'app' (תיעוד פנימי) שקודם הוצג בטעות כ-MyFitnessPal
    const srcLabels = { health: 'Apple Health', app: 'תיעוד ידני' };
    const foot = [`מקור: ${srcLabels[latest.src] || 'MyFitnessPal'}`];
    const lastSync = StorageManager.getHealthLastSync();
    if (lastSync) {
        const d = new Date(lastSync);
        const p = x => String(x).padStart(2, '0');
        foot.push(`עדכון Health אחרון: ${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`);
    }
    foot.push('לחיצה מרעננת');
    card.innerHTML = `<div class="bl-nutri-head"><div class="bl-chart-title">${title}</div><div class="bl-nutri-head-btns">${diaryBtn}</div></div>
        <div class="bl-nutri-grid">
            ${_nutriKpi('קלוריות', latest.calories || 0, 'kcal')}
            ${_nutriKpi('חלבון', latest.protein || 0, 'g')}
            ${_nutriKpi('פחמימה', latest.carbs || 0, 'g')}
            ${_nutriKpi('שומן', latest.fat || 0, 'g')}
        </div>
        <div class="bl-nutri-foot">${foot.join(' · ')}</div>`;
}

function _renderNutritionCard(allDays) {
    const card = document.getElementById('bl-nutrition-card');
    if (!card) return;
    const all = allDays || StorageManager.getNutritionDaily();
    if (!all.length) { card.style.display = 'none'; return; }
    card.style.display = '';

    // הממוצע מחושב ללא היום הנוכחי — היום עוד לא הסתיים והנתון החלקי מטה אותו
    const today = _blTodayStr();
    const inRange = _blFilter(all).filter(d => d.date !== today).sort((a, b) => a.date < b.date ? -1 : 1);
    const noToday = all.filter(d => d.date !== today);
    const base = inRange.length ? inRange : (noToday.length ? noToday : all);
    const avg = k => Math.round(base.reduce((s, d) => s + (d[k] || 0), 0) / base.length);
    card.innerHTML = `<div class="bl-nutri-head">
            <div class="bl-chart-title">ממוצע תזונה <small>— ${_rangeLabel()} · ללא היום</small></div></div>
        <div class="bl-nutri-grid">
            ${_nutriKpi('קלוריות', avg('calories'), 'kcal')}
            ${_nutriKpi('חלבון', avg('protein'), 'g')}
            ${_nutriKpi('פחמימה', avg('carbs'), 'g')}
            ${_nutriKpi('שומן', avg('fat'), 'g')}
        </div>
        <div class="bl-nutri-foot">${base.length} ימים בטווח · ${all.length} ימים בסך הכל</div>`;
}

// ─── Bottom sheet ייבוא/ייצוא תזונה — מרכז את כל הפעולות במקום אחד ─────────
function openNutriIOSheet() {
    document.getElementById('nutri-io-overlay').style.display = 'block';
    document.getElementById('nutri-io-sheet').classList.add('open');
    haptic('light');
}

function closeNutriIOSheet() {
    document.getElementById('nutri-io-overlay').style.display = 'none';
    document.getElementById('nutri-io-sheet').classList.remove('open');
}

// _nutriIOAction — סוגר את ה-sheet ומריץ את הפעולה שנבחרה
function _nutriIOAction(fn) {
    closeNutriIOSheet();
    setTimeout(fn, 150); // נותן ל-sheet להיסגר חלק לפני דיאלוגים/הורדות
}

// ─── Bottom sheet ייבוא/ייצוא שקילות — אותה תבנית כמו במסך התזונה ─────────
function openWeightIOSheet() {
    document.getElementById('weight-io-overlay').style.display = 'block';
    document.getElementById('weight-io-sheet').classList.add('open');
    haptic('light');
}

function closeWeightIOSheet() {
    document.getElementById('weight-io-overlay').style.display = 'none';
    document.getElementById('weight-io-sheet').classList.remove('open');
}

function _weightIOAction(fn) {
    closeWeightIOSheet();
    setTimeout(fn, 150);
}

function _nutriKpi(label, val, unit) {
    return `<div class="bl-nutri-kpi"><div class="bl-nutri-val">${val}<span class="bl-nutri-unit">${unit}</span></div><div class="bl-nutri-lbl">${label}</div></div>`;
}

function _renderNutritionCharts(allDays) {
    const all = allDays || StorageManager.getNutritionDaily();
    // היום השוטף מוחרג מהגרפים — נקודה חלקית (Health תוך-יומי) מזהמת את המגמה
    const today = _blTodayStr();
    const days = _blFilter(all).filter(d => d.date !== today).sort((a, b) => a.date < b.date ? -1 : 1);
    const cal  = _cleanNutriOutliers(days.map(d => ({ date: d.date, val: d.calories })));
    const prot = _cleanNutriOutliers(days.map(d => ({ date: d.date, val: d.protein })));
    _drawBlChart('bl-cal-svg', 'bl-cal-dates', 'bl-cal-yaxis', cal, true, 'kcal');
    _drawBlChart('bl-protein-svg', 'bl-protein-dates', 'bl-protein-yaxis', prot, true, 'g');
}

// _cleanNutriOutliers — רק חריגה כלפי מטה של יותר מ-50% מהממוצע (כנראה הזנה חסרה)
// מוחלפת בממוצע. חריגה כלפי מעלה אינה טעות ונשמרת. משפיע על הגרף בלבד.
function _cleanNutriOutliers(points) {
    if (points.length < 4) return points;
    const vals = points.map(p => p.val);
    const mean0 = vals.reduce((a, b) => a + b, 0) / vals.length;
    const floor = mean0 * 0.5;                          // 50% מתחת לממוצע
    const kept = vals.filter(v => v >= floor);
    const mean = Math.round(kept.length ? kept.reduce((a, b) => a + b, 0) / kept.length : mean0);
    return points.map(p => p.val < floor ? { date: p.date, val: mean } : p);
}

function _renderNutritionList(allDays) {
    const el = document.getElementById('bl-nutrition-list');
    if (!el) return;
    // היום השוטף לא מוצג בהיסטוריה — הוא חלקי ויש לו כרטיס ייעודי ב-Composition
    const today = _blTodayStr();
    const all = _arFilterByRange((allDays || StorageManager.getNutritionDaily()).filter(d => d.date !== today));
    if (!all.length) { el.innerHTML = '<p class="bl-list-empty">אין נתוני תזונה בטווח שנבחר</p>'; return; }
    const sorted = all.slice().sort((a, b) => a.date < b.date ? 1 : -1); // חדש→ישן
    const show = _blNutriExpanded ? sorted : sorted.slice(0, _BL_LIST_LIMIT);
    const rowsHtml = show.map(d => `<div class="bl-row">
            <div class="bl-row-main">
                <span class="bl-row-date">${_blListDate(d.date)}</span>
                <span class="bl-row-weight">${d.calories}<small> kcal</small></span>
            </div>
            <div class="bl-row-meta bl-nutri-macros">
                <span class="bl-macro bl-macro--p">P ${d.protein}</span>
                <span class="bl-macro bl-macro--c">C ${d.carbs}</span>
                <span class="bl-macro bl-macro--f">F ${d.fat}</span>
            </div>
        </div>`).join('');
    const toggle = sorted.length > _BL_LIST_LIMIT
        ? `<button class="bl-list-toggle" onclick="toggleNutriListExpand()">${_blNutriExpanded ? 'הצג פחות' : `הצג הכל (${sorted.length})`}</button>`
        : '';
    el.innerHTML = rowsHtml + toggle;
}

function toggleNutriListExpand() { _blNutriExpanded = !_blNutriExpanded; _renderNutritionList(); }

// ─── ייצוא תזונה (JSON) — מקוצר + מפורט, מכבדי בורר-טווח ──────────────────────
const _nR = v => Math.round((Number(v) || 0) * 10) / 10;   // עיגול ל-decimal אחד

// ─── בורר טווח לייצוא (sheet משותף לשקילות ולתזונה) ─────────────────────────
// כל כפתור ייצוא פותח את ה-sheet עם כותרת ופעולה משלו; אישור ממיר את הבחירה
// ל-{from,to,slug,label} ומריץ את הפעולה. from/to ריקים = הכל.
let _rexRange = 30;
let _rexAction = null;

function openRangeExportSheet(title, sub, action) {
    _rexAction = action;
    setRexRange(30);
    document.getElementById('rex-title').textContent = title;
    document.getElementById('rex-sub').textContent = sub || '';
    const today = _blTodayStr();
    const f = document.getElementById('rex-from'), t = document.getElementById('rex-to');
    f.max = today; t.max = today;
    if (!f.value) f.value = _blCutoff(30);
    if (!t.value) t.value = today;
    document.getElementById('range-export-overlay').style.display = 'block';
    document.getElementById('range-export-sheet').classList.add('open');
}

function closeRangeExportSheet() {
    document.getElementById('range-export-overlay').style.display = 'none';
    document.getElementById('range-export-sheet').classList.remove('open');
}

function setRexRange(r) {
    _rexRange = r;
    document.querySelectorAll('#rex-chips .bl-chip').forEach(b =>
        b.classList.toggle('active', String(b.dataset.range) === String(r)));
    const c = document.getElementById('rex-custom');
    if (c) c.style.display = r === 'custom' ? 'flex' : 'none';
}

function _rexBounds() {
    if (_rexRange === 'all') return { from: null, to: null, slug: 'all', label: 'הכל' };
    if (_rexRange === 'custom') {
        const from = document.getElementById('rex-from').value;
        const to = document.getElementById('rex-to').value;
        if (!from || !to) { showAlert('בחר תאריך התחלה וסיום.'); return null; }
        if (from > to) { showAlert('תאריך ההתחלה מאוחר מתאריך הסיום.'); return null; }
        return { from, to, slug: 'custom', label: `${_blListDate(from)}–${_blListDate(to)}` };
    }
    return { from: _blCutoff(_rexRange), to: _blTodayStr(), slug: _rexRange + 'd', label: _rexRange + ' ימים' };
}

function confirmRangeExport() {
    const b = _rexBounds();
    if (!b) return;
    closeRangeExportSheet();
    if (_rexAction) _rexAction(b);
    haptic('light');
}

// נקודות כניסה — מכפתורי ה-sheets של ייבוא/ייצוא
function openWeightExportRange()       { openRangeExportSheet('ייצוא שקילות', 'הקובץ יורד כ-CSV (נפתח באקסל).', exportBodyCsv); }
function openNutriDailyExportRange()   { openRangeExportSheet('ייצוא תזונה יומית', 'JSON מקוצר — קלוריות ומאקרו לכל יום.', exportNutritionDailyJson); }
function openNutriDetailedExportRange(){ openRangeExportSheet('ייצוא תזונה מפורטת', 'JSON מלא — ארוחות, פריטים ומרכיבים.', exportNutritionDetailedJson); }

function _blDownloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

// (א) מקוצר — יום → קלוריות + מאקרו בלבד, לפי הטווח שנבחר בבורר הייצוא
function exportNutritionDailyJson(b) {
    const all = StorageManager.getNutritionDaily();
    if (!all || !all.length) { showAlert('אין נתוני תזונה לייצוא.'); return; }
    const days = all.filter(d => (!b.from || d.date >= b.from) && (!b.to || d.date <= b.to))
        .slice().sort((a, b2) => a.date < b2.date ? -1 : 1)
        .map(d => ({ date: d.date, calories: d.calories || 0, protein: d.protein || 0, carbs: d.carbs || 0, fat: d.fat || 0 }));
    if (!days.length) { showAlert('אין נתוני תזונה בטווח שנבחר.'); return; }
    _blDownloadJson({
        app: 'GYMPRO ELITE', type: 'nutrition_daily',
        range: { label: b.label, from: b.from, to: b.to },
        generated: new Date().toISOString(), days
    }, `gympro_nutrition_daily_${b.slug}_${_blTodayStr()}.json`);
    haptic('success');
}

// (ב) מפורט — לכל יום ארוחות→פריטים→מרכיבים, במבנה meals אחיד לכל המקורות
// הסבר מוטמע בקובץ (readme) — מיועד לקוראים אוטומטיים (LLM), מונע פרשנות שגויה של המבנה
const _NUTRI_EXPORT_README = [
    'nutrition_detailed: לכל יום שדה meals אחיד (ארוחות → items), בלי תלות במקור. הפירוט המלא נמצא שם — לא בסיכומים.',
    'source:"app" = תיעוד ישיר באפליקציה: items עם שם מזון, מותג וגרמים; מנות מורכבות כוללות components (מרכיבים).',
    'source:"mfp" = ייבוא MyFitnessPal: item אחד לכל שורת ארוחה, ללא שם מזון (מגבלת המקור), עם מאקרו + micros (מיקרו-נוטריינטים).',
    'source:"summary" = קיים סיכום יומי בלבד (למשל Apple Health) — meals ריק, totals בלבד.',
    'nutrition_daily / totals הם שורה תחתונה בכוונה; לניתוח הרכב מזון השתמש ב-meals.'
];
function exportNutritionDetailedJson(b) {
    const days = _buildNutritionDetailed(b.from, b.to);
    if (!days.length) { showAlert('אין נתוני תזונה בטווח שנבחר.'); return; }
    _blDownloadJson({
        app: 'GYMPRO ELITE', type: 'nutrition_detailed',
        readme: _NUTRI_EXPORT_README,
        range: { label: b.label, from: b.from, to: b.to },
        generated: new Date().toISOString(), days
    }, `gympro_nutrition_detailed_${b.slug}_${_blTodayStr()}.json`);
    haptic('success');
}

// _buildNutritionDetailed — בונה משותף (גם לייצוא הנפרד וגם לקובץ המאוחד).
// כלל קדימות ליום: תיעוד ישיר גובר; אחרת MFP; אחרת סיכום בלבד.
// כל יום מחזיר שדה meals באותו מבנה (ימי MFP מומרים דרך _detailMealsFromMfpRows) —
// פורמט אחיד מונע מקוראים אוטומטיים להסיק "אין פירוט" כשהשדות משתנים בין מקורות.
function _buildNutritionDetailed(from, to) {
    const inRange = d => (!from || d >= from) && (!to || d <= to);
    const foodLog = StorageManager.getFoodLog() || {};
    const daily = StorageManager.getNutritionDaily() || [];
    const raw = StorageManager.getNutritionRaw();

    // אינדוקס שורות MFP לפי תאריך ISO מנורמל
    const mfpByDate = {}; let header = null;
    if (raw && Array.isArray(raw.rows) && raw.rows.length) {
        header = raw.header || [];
        const di = raw.dateIdx != null ? raw.dateIdx : 0;
        raw.rows.forEach(r => { const d = _parseFlexDate(r[di]); if (d) (mfpByDate[d] = mfpByDate[d] || []).push(r); });
    }
    const dailyByDate = {};
    daily.forEach(d => { if (d && d.date) dailyByDate[d.date] = d; });

    // איחוד התאריכים מכל המקורות, מסונן לטווח
    const set = {};
    Object.keys(foodLog).forEach(d => set[d] = 1);
    Object.keys(mfpByDate).forEach(d => set[d] = 1);
    daily.forEach(d => { if (d && d.date) set[d.date] = 1; });
    const dates = Object.keys(set).filter(inRange).sort();

    return dates.map(date => {
        const entries = foodLog[date] || [];
        const sum = dailyByDate[date] || null;
        const totals = sum ? { calories: sum.calories || 0, protein: sum.protein || 0, carbs: sum.carbs || 0, fat: sum.fat || 0 } : null;
        if (entries.length) {   // תיעוד ישיר גובר
            return { date, source: 'app', totals: totals || _sumFoodEntries(entries), meals: _detailMealsFromEntries(entries) };
        }
        const rows = mfpByDate[date];
        if (rows && rows.length) {
            return { date, source: 'mfp', totals, meals: _detailMealsFromMfpRows(header, rows) };
        }
        return { date, source: (sum && sum.src) || 'summary', totals, meals: [] };   // סיכום בלבד (Health וכו')
    });
}

// המרת שורות MFP למבנה meals אחיד — פורמט אחד לכל הימים בייצוא, בלי תלות במקור.
// כל שורת MFP היא סיכום-לארוחה ללא שם מזון; עמודות הליבה ממופות ל-kcal/מאקרו,
// וכל שאר העמודות (נתרן, סיבים, סוכר...) נשמרות תחת micros.
function _detailMealsFromMfpRows(header, rows) {
    const h = header || [];
    const idx = re => h.findIndex(c => re.test(String(c)));
    const iMeal = idx(/^meal$/i), iTime = idx(/^time$/i),
        iKcal = idx(/^calories/i), iP = idx(/^protein/i),
        iC = idx(/^carbohydrates/i), iF = idx(/^fat\b/i),
        iDate = idx(/date|תאריך/i);
    const core = new Set([iMeal, iTime, iKcal, iP, iC, iF, iDate]);
    const order = [], byMeal = {};
    rows.forEach(r => {
        const m = (iMeal >= 0 && r[iMeal]) || 'אחר';
        if (!byMeal[m]) { byMeal[m] = []; order.push(m); }
        const item = {
            name: '(סיכום ארוחה — MFP, ללא שם מזון)',
            time: iTime >= 0 ? (r[iTime] || '') : '',
            kcal: Math.round(Number(r[iKcal]) || 0),
            protein: _nR(iP >= 0 ? r[iP] : 0),
            carbs: _nR(iC >= 0 ? r[iC] : 0),
            fat: _nR(iF >= 0 ? r[iF] : 0)
        };
        const micros = {};
        h.forEach((col, i) => {
            if (core.has(i)) return;
            const v = r[i];
            if (v == null || v === '') return;
            const n = Number(v);
            micros[col || ('col' + i)] = isNaN(n) ? v : n;
        });
        if (Object.keys(micros).length) item.micros = micros;
        byMeal[m].push(item);
    });
    return order.map(m => ({ meal: m, items: byMeal[m] }));
}

// קיבוץ רשומות יום לפי ארוחה → פריטים (כולל מרכיבי Meal Builder כשקיימים)
function _detailMealsFromEntries(entries) {
    const order = [], byMeal = {};
    entries.forEach(e => {
        const m = e.meal || 'אחר';
        if (!byMeal[m]) { byMeal[m] = []; order.push(m); }
        const grams = (e.unit === 'serving' && e.gramsPerUnit) ? (Number(e.qty) || 0) * Number(e.gramsPerUnit) : (Number(e.qty) || 0);
        const item = {
            name: e.name || '', brand: e.brand || '', grams: Math.round(grams),
            kcal: Math.round(Number(e.kcal) || 0), protein: _nR(e.p), carbs: _nR(e.c), fat: _nR(e.f)
        };
        if (Array.isArray(e.components) && e.components.length) {
            item.components = e.components.map(c => ({
                name: c.name || '', grams: Math.round(Number(c.grams) || 0),
                kcal: Math.round(Number(c.kcal) || 0), protein: _nR(c.p), carbs: _nR(c.c), fat: _nR(c.f)
            }));
            // grams מצרפי = סכום הרכיבים (ברמת הפריט המנה הוא 0 — המשקל האמיתי ברכיבים)
            item.grams = item.components.reduce((s, c) => s + c.grams, 0);
            // עקביות כל השדות המצרפיים (grams/kcal/macros) = סכום הרכיבים — אזהרת dev שתתפוס
            // הישנות הבאג בכל שדה עתידי (kcal/macros כבר מסתכמים נכון מ-fdSaveMeal)
            ['grams', 'kcal', 'protein', 'carbs', 'fat'].forEach(k => {
                const sumC = item.components.reduce((s, c) => s + (Number(c[k]) || 0), 0);
                if (Math.abs(sumC - (Number(item[k]) || 0)) > Math.max(1, sumC * 0.02)) {
                    console.warn('[nutrition-export] שדה מצרפי לא תואם לסכום הרכיבים:', item.name, k, item[k], '≠', sumC);
                }
            });
        }
        byMeal[m].push(item);
    });
    return order.map(m => ({ meal: m, items: byMeal[m] }));
}
function _sumFoodEntries(entries) {
    return entries.reduce((a, e) => {
        a.calories += Number(e.kcal) || 0; a.protein += Number(e.p) || 0;
        a.carbs += Number(e.c) || 0; a.fat += Number(e.f) || 0; return a;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}
function _rowToObj(header, row) {
    const o = {};
    (header || []).forEach((h, i) => { o[h || ('col' + i)] = row[i] != null ? row[i] : ''; });
    return o;
}

// resetNutritionData — מוחק את כל נתוני התזונה (לאחר אישור). שאיבה מחדש תתחיל מאפס.
function resetNutritionData() {
    showConfirm('פעולה זו תמחק את כל נתוני התזונה (סיכום יומי + הקובץ הגולמי) ואינה ניתנת לשחזור. שים לב: שאיבה מ-Gmail מושכת רק את הייצוא האחרון, אז היסטוריה ישנה לא תחזור. להמשיך?', () => {
        StorageManager.clearNutrition();
        _blNutriExpanded = false;
        renderBodyLog();
        if (typeof renderHomeTodayCards === 'function') renderHomeTodayCards();
        if (typeof showCloudToast === 'function') showCloudToast('🗑️ נתוני התזונה נמחקו', true);
        haptic('warning');
    });
}

// _parseRawNutrition — מפרסר את ה-CSV הגולמי של MFP ל-{header, rows, dateIdx}.
function _parseRawNutrition(text) {
    if (!text) return null;
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return null;
    const delim = _detectDelim(lines[0]);
    const aoa = lines.map(l => _splitCsvLine(l, delim).map(c => c.trim()));
    const header = aoa[0];
    let dateIdx = header.findIndex(h => h.toLowerCase().includes('date') || h.includes('תאריך'));
    if (dateIdx < 0) dateIdx = 0;
    return { header, rows: aoa.slice(1), dateIdx };
}


// ─── KPIs ───────────────────────────────────────────────────────────────────
function _renderBodyKpis(log) {
    const el = document.getElementById('bodylog-kpis');
    if (!el) return;
    if (!log.length) {
        el.innerHTML = emptyStateHtml('monitor_weight', 'אין עדיין שקילות', 'צלם שקילה או הזן ידנית כדי להתחיל.');
        return;
    }
    const sorted = log.slice().sort((a, b) => a.date < b.date ? -1 : 1);
    const cur = sorted[sorted.length - 1];
    const ref30 = sorted.find(e => e.date >= _blCutoff(30)) || sorted[0];
    const d30 = cur.weight - ref30.weight;
    const spanDays = Math.max(1, (_blDTs(cur.date) - _blDTs(ref30.date)) / 86400000);
    const weekly = (d30 / spanDays) * 7;
    const fat = cur.bodyFat;
    const lbm = fat != null ? cur.weight * (1 - fat / 100) : null;

    el.innerHTML =
        _kpi('משקל נוכחי', cur.weight.toFixed(1) + ' ק"ג', _blShortDate(cur.date)) +
        _kpi('שינוי 30 יום', (d30 >= 0 ? '+' : '') + d30.toFixed(1) + ' ק"ג', '', d30) +
        _kpi('קצב שבועי', (weekly >= 0 ? '+' : '') + weekly.toFixed(2), 'ק"ג / שבוע', weekly) +
        (fat != null ? _kpi('אחוז שומן', fat.toFixed(1) + '%', lbm ? 'מסת רזה ' + lbm.toFixed(1) + ' ק"ג' : '') : '');
}

function _kpi(label, val, sub, trend) {
    const cls = trend == null ? '' : (trend > 0 ? ' bl-kpi-val--up' : trend < 0 ? ' bl-kpi-val--down' : '');
    return `<div class="bl-kpi"><div class="bl-kpi-label">${label}</div>` +
        `<div class="bl-kpi-val${cls}">${val}</div>${sub ? `<div class="bl-kpi-sub">${sub}</div>` : ''}</div>`;
}

// ─── גרפים ──────────────────────────────────────────────────────────────────
function _renderBodyCharts(log) {
    _blSel = {}; // איפוס בחירה (tooltip) בכל רינדור מלא — מונע בחירה "תקועה" אחרי שינוי טווח/נתונים
    const data = _blFilter(log).sort((a, b) => a.date < b.date ? -1 : 1);
    _drawBlChart('bl-weight-svg', 'bl-weight-dates', 'bl-weight-yaxis', data.map(e => ({ date: e.date, val: e.weight })), true, 'kg');
    const fatData = data.filter(e => e.bodyFat != null).map(e => ({ date: e.date, val: e.bodyFat }));
    const fatCard = document.getElementById('bl-fat-card');
    if (fatData.length >= 1) {
        if (fatCard) fatCard.style.display = 'block';
        _drawBlChart('bl-fat-svg', 'bl-fat-dates', 'bl-fat-yaxis', fatData, false, '%');
    } else if (fatCard) {
        fatCard.style.display = 'none';
    }
}

// מצב בחירה לגרפים (tooltip): index נבחר, פונקציית redraw, וגאומטריה ל-hit-testing — לכל svg.
let _blSel = {}, _blRedraw = {}, _blTapMeta = {};

// _niceNum / _niceTicks — בוחרים ערכי-ציר עגולים (1/2/5 × 10^k) שמכסים את טווח הנתונים,
// כדי שציר ה-Y יציג מספרים ברורים (84, 86, 88) במקום גבולות "מרופדים" שרירותיים.
function _niceNum(range, round) {
    const exp = Math.floor(Math.log10(range || 1));
    const frac = (range || 1) / Math.pow(10, exp);
    let nf;
    if (round) nf = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
    else nf = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
    return nf * Math.pow(10, exp);
}
function _niceTicks(min, max, count) {
    if (max === min) { max = min + 1; min = min - 1; } // ערך יחיד/שטוח — טווח מינימלי
    const step = _niceNum((max - min) / Math.max(1, count - 1), true);
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = niceMin; v <= niceMax + step * 0.5; v += step) ticks.push(+v.toFixed(5));
    return { ticks, lo: niceMin, hi: niceMax, step };
}

function _drawBlChart(svgId, datesId, yaxisId, points, withMA, unit) {
    const svg = document.getElementById(svgId);
    const datesEl = document.getElementById(datesId);
    const yaxisEl = document.getElementById(yaxisId);
    if (!svg) return;
    const n = points.length;
    if (n < 2) {
        svg.innerHTML = `<text x="200" y="85" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="13" font-family="Heebo">אין מספיק נתונים למגמה</text>`;
        if (datesEl) datesEl.innerHTML = '';
        if (yaxisEl) yaxisEl.innerHTML = '';
        _blRenderTip(svg, svgId, points, -1);
        return;
    }
    const vals = points.map(p => p.val);
    const W = 400, H = 170, pad = { t: 14, b: 14, l: 8, r: 12 };
    const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;

    // ציר Y על ערכים עגולים שמקיפים את הנתונים (+מעט אוויר), לא על מינ/מקס מרופדים
    const dMin = Math.min(...vals), dMax = Math.max(...vals);
    const { ticks, lo, hi, step } = _niceTicks(dMin, dMax, 4);
    const px = i => pad.l + (i / (n - 1)) * cW;
    const py = v => pad.t + cH - ((v - lo) / ((hi - lo) || 1)) * cH;
    const pts = vals.map((v, i) => [px(i), py(v)]);
    const smooth = ps => (typeof getSmoothPath === 'function') ? getSmoothPath(ps) : ('M' + ps.map(p => p.join(',')).join(' L'));
    const linePath = smooth(pts);
    const areaPath = linePath + ` L${pts[n - 1][0].toFixed(1)},${(pad.t + cH).toFixed(1)} L${pts[0][0].toFixed(1)},${(pad.t + cH).toFixed(1)} Z`;

    // ממוצע נע 7 נקודות — מחליק רעש יומי במשקל
    let maPath = '';
    if (withMA && n >= 4) {
        const ma = vals.map((_, i) => {
            const slice = vals.slice(Math.max(0, i - 6), i + 1);
            return slice.reduce((a, b) => a + b, 0) / slice.length;
        });
        const mpts = ma.map((v, i) => [px(i), py(v)]);
        maPath = `<path d="${smooth(mpts)}" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.5"/>`;
    }

    // קווי רשת אופקיים בכל tick (נמתחים עם ה-SVG — לא מעוותים שום טקסט)
    const grid = ticks.map(t => {
        const y = py(t).toFixed(1);
        return `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    }).join('');
    const last = pts[n - 1];
    const ac = (typeof themeVar === 'function') ? themeVar('--accent', '#0A84FF') : '#0A84FF';
    const acRgb = (typeof themeVar === 'function') ? themeVar('--accent-rgb', '10,132,255') : '10,132,255';

    // נקודה נבחרת (לחיצה על הגרף) — קו אנכי + נקודה מודגשת
    const sel = (svgId in _blSel) ? _blSel[svgId] : -1;
    let selMark = '';
    if (sel >= 0 && sel < n) {
        const sx = pts[sel][0].toFixed(1), sy = pts[sel][1].toFixed(1);
        selMark = `<line x1="${sx}" y1="${pad.t}" x2="${sx}" y2="${(pad.t + cH).toFixed(1)}" stroke="rgba(${acRgb},0.45)" stroke-width="1"/>
                   <circle cx="${sx}" cy="${sy}" r="6" fill="${ac}" stroke="#fff" stroke-width="1.5"/>`;
    }

    svg.innerHTML = `
        <defs><linearGradient id="bl-grad-${svgId}" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="${ac}"/><stop offset="100%" stop-color="transparent"/></linearGradient></defs>
        ${grid}
        <path d="${areaPath}" fill="url(#bl-grad-${svgId})" opacity="0.22"/>
        <path d="${linePath}" fill="none" stroke="${ac}" stroke-width="3" stroke-linecap="round"/>
        ${maPath}
        <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="5" fill="${ac}"/>
        ${selMark}`;

    // תוויות ציר Y כ-HTML חד (לא מעוות ע"י מתיחת ה-SVG). top באחוזים מגובה ה-plot.
    if (yaxisEl) {
        const dec = step < 1 ? 1 : 0;
        yaxisEl.innerHTML = ticks.map(t =>
            `<span style="top:${(py(t) / H * 100).toFixed(2)}%">${t.toFixed(dec)}</span>`).join('');
    }

    if (datesEl) {
        const step2 = Math.ceil(n / 6);
        datesEl.innerHTML = points.map((p, i) =>
            (i % step2 === 0 || i === n - 1) ? `<span>${_blShortDate(p.date)}</span>` : '').join('');
    }

    // tooltip + hit-testing — לחיצה על הגרף מציגה את המשקל/השומן באותו יום
    _blRenderTip(svg, svgId, points, sel, px, py, W, H, unit);
    _blTapMeta[svgId] = { n, padL: pad.l, cW, W };
    _blRedraw[svgId] = () => _drawBlChart(svgId, datesId, yaxisId, points, withMA, unit);
    _blAttachTap(svg, svgId);
}

// _blAttachTap — רושם מאזין לחיצה/מגע פעם אחת לכל svg; ממפה X→index קרוב ומרענן.
function _blAttachTap(svg, svgId) {
    _blInitOutsideClear();
    if (svg.dataset.tapBound) return;
    svg.dataset.tapBound = '1';
    const onTap = (ev) => {
        const meta = _blTapMeta[svgId];
        if (!meta) return;
        const rect = svg.getBoundingClientRect();
        if (!rect.width) return;
        const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const vbX = ((clientX - rect.left) / rect.width) * meta.W;
        let idx = Math.round(((vbX - meta.padL) / (meta.cW || 1)) * (meta.n - 1));
        idx = Math.max(0, Math.min(meta.n - 1, idx));
        _blSel[svgId] = idx;
        if (_blRedraw[svgId]) _blRedraw[svgId]();
        if (typeof haptic === 'function') haptic('light');
    };
    svg.addEventListener('click', onTap);
    svg.addEventListener('touchstart', onTap, { passive: true });
}

// _blInitOutsideClear — לחיצה מחוץ לגרף מנקה את הנקודה הנבחרת בכל הגרפים (חזרה לגרף נקי).
let _blOutsideBound = false;
function _blInitOutsideClear() {
    if (_blOutsideBound) return;
    _blOutsideBound = true;
    const clear = (ev) => {
        if (ev.target && ev.target.closest && ev.target.closest('.bl-plot')) return; // נגיעה בתוך גרף — לא לנקות
        Object.keys(_blSel).forEach(svgId => {
            if (_blSel[svgId] != null && _blSel[svgId] >= 0) {
                delete _blSel[svgId];
                if (_blRedraw[svgId]) _blRedraw[svgId]();
            }
        });
    };
    document.addEventListener('click', clear);
    document.addEventListener('touchstart', clear, { passive: true });
}

// _blRenderTip — תווית HTML צפה מעל הנקודה הנבחרת (חדה, לא מעוותת ע"י מתיחת ה-SVG).
function _blRenderTip(svg, svgId, points, sel, px, py, W, H, unit) {
    const plot = svg.parentElement;
    let tip = document.getElementById(svgId + '-tip');
    if (sel == null || sel < 0 || sel >= points.length) { if (tip) tip.style.display = 'none'; return; }
    if (!tip) { tip = document.createElement('div'); tip.id = svgId + '-tip'; tip.className = 'bl-tip'; plot.appendChild(tip); }
    const p = points[sel];
    // יחידה רק היכן שרלוונטי: ק"ג למשקל, % לשומן; בתזונה (kcal/g) — ללא יחידה.
    const unitLbl = unit === '%' ? '%' : unit === 'kg' ? ' ק"ג' : '';
    const valStr = (unit === 'kg' || unit === '%') ? p.val.toFixed(1) : String(Math.round(p.val));
    tip.innerHTML = `<span class="bl-tip-date">${_blListDate(p.date)}</span><span class="bl-tip-val">${valStr}${unitLbl}</span>`;
    tip.style.display = 'flex';
    const w = svg.clientWidth || plot.clientWidth, h = svg.clientHeight || 170;
    const leftPx = Math.max(30, Math.min(w - 30, (px(sel) / W) * w));
    tip.style.left = leftPx + 'px';
    tip.style.top = Math.max(2, (py(p.val) / H) * h - 6) + 'px';
}

// ─── רשימת שקילות ───────────────────────────────────────────────────────────
const _BL_LIST_LIMIT = 7;     // ברירת מחדל: 7 שקילות אחרונות
function toggleBodyListExpand() { _blListExpanded = !_blListExpanded; _renderBodyList(StorageManager.getBodyLog()); }

function _renderBodyList(log) {
    const el = document.getElementById('bodylog-list');
    if (!el) return;
    const ranged = _arFilterByRange(log);
    if (!ranged.length) { el.innerHTML = '<p class="bl-list-empty">אין שקילות בטווח שנבחר</p>'; return; }
    const sorted = ranged.slice().sort((a, b) => a.date < b.date ? 1 : -1); // חדש→ישן
    const show = _blListExpanded ? sorted : sorted.slice(0, _BL_LIST_LIMIT);
    const rowsHtml = show.map((e, i) => {
        const prev = sorted[i + 1]; // הישן יותר (מהמערך המלא, גם בגבול 7)
        const delta = prev ? e.weight - prev.weight : null;
        const dCls = delta == null ? '' : (delta > 0 ? 'up' : delta < 0 ? 'down' : '');
        const dArrow = delta == null ? '' : (delta > 0 ? '▲' : delta < 0 ? '▼' : '');
        const deltaHtml = delta != null && delta !== 0 ? `<span class="bl-delta ${dCls}">${dArrow}${Math.abs(delta).toFixed(1)}</span>` : '';
        const chip = e.nutritionState ? `<span class="bl-state-chip bl-state-chip--${e.nutritionState}">${_BL_STATE_LBL[e.nutritionState]}</span>` : '';
        const fat = e.bodyFat != null ? `<span class="bl-row-fat">${e.bodyFat.toFixed(1)}%</span>` : '';
        return `<div class="bl-row" onclick="openBodyEntryModal('${e.date}')">
            <div class="bl-row-main">
                <span class="bl-row-date">${_blListDate(e.date)}</span>
                <span class="bl-row-weight">${e.weight.toFixed(1)}<small> ק"ג</small></span>
                ${deltaHtml}
            </div>
            <div class="bl-row-meta">${fat}${chip}</div>
        </div>`;
    }).join('');
    const toggle = sorted.length > _BL_LIST_LIMIT
        ? `<button class="bl-list-toggle" onclick="toggleBodyListExpand()">${_blListExpanded ? 'הצג פחות' : `הצג הכל (${sorted.length})`}</button>`
        : '';
    el.innerHTML = rowsHtml + toggle;
}

// ─── הזנה ידנית / עריכה ─────────────────────────────────────────────────────
// סגמנט "מצב תזונתי" — input נסתר (#bl-entry-nutri, נקרא ב-saveBodyEntry) + צ'יפ פעיל
function setBlEntryNutri(v) {
    const inp = document.getElementById('bl-entry-nutri');
    if (inp) inp.value = v;
    document.querySelectorAll('#bl-entry-nutri-chips .bl-chip').forEach(c =>
        c.classList.toggle('active', c.dataset.v === v));
}

function openBodyEntryModal(date) {
    _blEditDate = date || null;
    const today = _blTodayStr();
    const dateInput = document.getElementById('bl-entry-date');
    const hint = document.getElementById('bl-entry-ocr-hint');
    const weightInp = document.getElementById('bl-entry-weight');
    hint.style.display = 'none'; hint.textContent = '';
    weightInp.dataset.src = '';

    if (date) {
        const e = StorageManager.getBodyLog().find(x => x.date === date);
        if (!e) return;
        document.getElementById('bl-entry-title').textContent = 'עריכת שקילה';
        dateInput.value = e.date;
        weightInp.value = e.weight != null ? e.weight : '';
        document.getElementById('bl-entry-fat').value = e.bodyFat != null ? e.bodyFat : '';
        setBlEntryNutri(e.nutritionState || '');
        document.getElementById('bl-entry-note').value = e.note || '';
        document.getElementById('bl-entry-delete').style.display = 'block';
    } else {
        document.getElementById('bl-entry-title').textContent = 'שקילה חדשה';
        dateInput.value = today;
        weightInp.value = '';
        document.getElementById('bl-entry-fat').value = '';
        setBlEntryNutri('');
        document.getElementById('bl-entry-note').value = '';
        document.getElementById('bl-entry-delete').style.display = 'none';
    }
    dateInput.max = today;
    document.getElementById('bl-entry-modal').style.display = 'flex';
}

function closeBodyEntryModal() { document.getElementById('bl-entry-modal').style.display = 'none'; }

function saveBodyEntry() {
    const date = document.getElementById('bl-entry-date').value;
    const weight = parseFloat(document.getElementById('bl-entry-weight').value);
    const fatRaw = document.getElementById('bl-entry-fat').value.trim();
    const nutriSel = document.getElementById('bl-entry-nutri').value;
    const note = document.getElementById('bl-entry-note').value.trim();
    const today = _blTodayStr();

    if (!date) { showAlert('בחר תאריך.'); return; }
    if (date > today) { showAlert('לא ניתן להזין תאריך עתידי.'); return; }
    if (!(weight > 0)) { showAlert('הזן משקל תקין.'); return; }
    let bodyFat = fatRaw === '' ? null : parseFloat(fatRaw);
    if (bodyFat != null && (!(bodyFat > 0) || bodyFat > 70)) { showAlert('אחוז שומן לא תקין.'); return; }

    const nutritionState = nutriSel || StorageManager.getNutritionStateOnDate(date);
    const source = document.getElementById('bl-entry-weight').dataset.src === 'ocr' ? 'ocr' : 'manual';

    // עריכה ששינתה תאריך — מחיקת הרשומה הישנה כדי לא ליצור כפילות
    if (_blEditDate && _blEditDate !== date) StorageManager.deleteBodyEntry(_blEditDate);
    StorageManager.upsertBodyEntry({ date, weight, bodyFat, nutritionState, note, source });

    closeBodyEntryModal();
    renderBodyLog();
    if (typeof renderHomeTodayCards === 'function') renderHomeTodayCards();
    _blSyncCloud();
    haptic('success');
}

// _blSyncCloud — מעלה את הקונפיג (כולל ה-bodylog) לענן אחרי כל שינוי שקילה,
// בדיוק כמו עריכת תוכנית אימון. ללא Firebase מוגדר — no-op שקט.
function _blSyncCloud() {
    if (typeof autoSaveConfigToCloud === 'function') autoSaveConfigToCloud();
}

function deleteBodyEntryUI() {
    if (!_blEditDate) return;
    showConfirm('למחוק את השקילה?', () => {
        StorageManager.deleteBodyEntry(_blEditDate);
        closeBodyEntryModal();
        renderBodyLog();
        if (typeof renderHomeTodayCards === 'function') renderHomeTodayCards();
        _blSyncCloud();
    });
}

// ─── צילום + OCR דרך Gemini Vision ──────────────────────────────────────────
function openBodyCaptureInput() {
    if (!StorageManager.getAIConfig().apiKey) {
        showAlert('לקריאת תמונה אוטומטית נדרש מפתח Gemini (הגדרות → AI Coach). פותח הזנה ידנית.', openBodyEntryModal);
        return;
    }
    document.getElementById('bl-camera-input').click();
}

function _onBodyPhotoSelected(file) {
    if (!file) return;
    _fileToBase64(file).then(({ base64, mime }) => {
        openBodyEntryModal();
        document.getElementById('bl-entry-title').textContent = 'שקילה מתמונה';
        const hint = document.getElementById('bl-entry-ocr-hint');
        hint.style.display = 'block';
        hint.className = 'bl-ocr-hint bl-ocr-hint--loading';
        hint.textContent = '🔍 קורא את התצוגה מהתמונה…';
        return _callGeminiVision(base64, mime).then(res => {
            if (res.weight != null) {
                document.getElementById('bl-entry-weight').value = res.weight;
                document.getElementById('bl-entry-weight').dataset.src = 'ocr';
            }
            if (res.bodyFat != null) document.getElementById('bl-entry-fat').value = res.bodyFat;
            hint.className = 'bl-ocr-hint bl-ocr-hint--ok';
            hint.textContent = res.weight != null ? '✓ נקרא מהתמונה — בדוק ותקן אם צריך' : '⚠ לא זוהה משקל — הזן ידנית';
        });
    }).catch(() => {
        const hint = document.getElementById('bl-entry-ocr-hint');
        if (hint) { hint.style.display = 'block'; hint.className = 'bl-ocr-hint bl-ocr-hint--err'; hint.textContent = '⚠ קריאת התמונה נכשלה — הזן ידנית'; }
    });
}

function _fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => { const s = String(r.result); resolve({ base64: s.slice(s.indexOf(',') + 1), mime: file.type || 'image/jpeg' }); };
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

async function _callGeminiVision(base64, mimeType) {
    const config = StorageManager.getAIConfig();
    if (!config.apiKey) throw new Error('API_KEY_MISSING');
    const prompt = 'אתה קורא תצוגה של משקל חכם מתוך תמונה. החזר JSON בלבד: {"weight": number|null, "bodyFat": number|null}. ' +
        'weight = משקל גוף בק"ג (מספר עשרוני). bodyFat = אחוז שומן (מספר, ללא סימן %). אם ערך לא קריא או לא קיים בתמונה — החזר null עבורו. אל תכלול טקסט נוסף.';
    const parts = [{ text: prompt }, { inlineData: { mimeType, data: base64 } }];
    // תחבורה דרך השכבה המשותפת (workout-core) — thinking מותאם-מודל + מודל מועדף
    const parsed = await _geminiRequest({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 120, responseMimeType: 'application/json' }
    }, { json: true, timeoutMs: 45000 });
    const w = (typeof parsed.weight === 'number') ? parsed.weight : null;
    const bf = (typeof parsed.bodyFat === 'number') ? parsed.bodyFat : null;
    return { weight: w, bodyFat: bf };
}

// ─── ייבוא CSV / Excel ───────────────────────────────────────────────────────
function openBodyImportInput() { document.getElementById('bl-csv-input').click(); }

// _onBodyFileSelected — מנתב לפי סיומת: CSV נקרא מקומית, XLSX דרך SheetJS (טעינה עצלה).
function _onBodyFileSelected(file) {
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) { _onBodyXlsxSelected(file); return; }
    const reader = new FileReader();
    reader.onload = () => {
        try { _bodyImportRows = _parseBodyCsv(String(reader.result)); _renderImportPreview(); }
        catch (e) { showAlert('שגיאה בפענוח הקובץ: ' + (e.message || e)); }
    };
    reader.onerror = () => showAlert('שגיאה בקריאת הקובץ.');
    reader.readAsText(file, 'utf-8');
}

function _onBodyXlsxSelected(file) {
    _ensureSheetJS().then(() => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const wb = XLSX.read(new Uint8Array(reader.result), { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
                _bodyImportRows = _rowsFromAoA(aoa);
                _renderImportPreview();
            } catch (e) { showAlert('שגיאה בקריאת קובץ ה-Excel: ' + (e.message || e)); }
        };
        reader.onerror = () => showAlert('שגיאה בקריאת הקובץ.');
        reader.readAsArrayBuffer(file);
    }).catch(() => showAlert('טעינת מנוע ה-Excel נכשלה (נדרש אינטרנט). שמור את הקובץ כ-CSV ונסה שוב.'));
}

// _ensureSheetJS — טוען את SheetJS מ-CDN פעם אחת, רק כשמייבאים xlsx (לא מנפח את ה-cache).
let _sheetJsPromise = null;
function _ensureSheetJS() {
    if (typeof XLSX !== 'undefined') return Promise.resolve();
    if (_sheetJsPromise) return _sheetJsPromise;
    _sheetJsPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        s.onload = () => resolve();
        s.onerror = () => { _sheetJsPromise = null; reject(new Error('SHEETJS_LOAD_FAILED')); };
        document.head.appendChild(s);
    });
    return _sheetJsPromise;
}

function _detectDelim(line) {
    const c = (line.match(/,/g) || []).length, t = (line.match(/\t/g) || []).length, s = (line.match(/;/g) || []).length;
    if (t >= c && t >= s) return '\t';
    if (s > c) return ';';
    return ',';
}

function _splitCsvLine(line, delim) {
    const res = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) {
            if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
            else cur += ch;
        } else if (ch === '"' && cur === '') {
            q = true;                       // ציטוט תקף רק בתחילת שדה (תקן CSV)
        } else if (ch === delim) {
            res.push(cur); cur = '';
        } else {
            cur += ch;                      // ציטוט באמצע שדה (כמו ק"ג) = תו רגיל
        }
    }
    res.push(cur);
    return res;
}

function _mapColumns(headers) {
    const find = kws => { const i = headers.findIndex(h => { const s = h.toLowerCase(); return kws.some(k => s.includes(k.toLowerCase())); }); return i < 0 ? null : i; };
    return {
        date: find(['תאריך', 'date']),
        weight: find(['משקל', 'weight', 'ק"ג', 'kg']),
        fat: find(['שומן', 'fat', 'bf']),
        phase: find(['שלב', 'phase', 'מצב', 'state']),
        note: find(['הערות', 'הערה', 'note', 'comment'])
    };
}

// _parseFlexDate — תומך ב-YYYY-MM-DD, DD.MM.YYYY, DD/MM/YY ו-DD.MM (משלים שנה).
function _parseFlexDate(raw) {
    if (!raw) return null;
    raw = raw.trim();
    const pad = n => String(n).padStart(2, '0');
    // ולידציה שהתוצאה תאריך קלנדרי אמיתי — אחרת "12/13" היה מיובא כחודש 13 ושובר מיון/גרפים
    const valid = (y, mo, d) => {
        y = +y; mo = +mo; d = +d;
        const dt = new Date(y, mo - 1, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
        return `${y}-${pad(mo)}-${pad(d)}`;
    };
    let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return valid(m[1], m[2], m[3]);
    m = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
    if (m) { let y = m[3]; if (y.length === 2) y = '20' + y; return valid(y, m[2], m[1]); }
    m = raw.match(/^(\d{1,2})[.\/-](\d{1,2})$/);
    if (m) {
        // ללא שנה בקובץ — משלימים בשנה הנוכחית
        const y = new Date().getFullYear();
        return valid(y, m[2], m[1]);
    }
    return null;
}

// _mapPhaseLabel — תרגום תווית "שלב" חופשית לאחד משלושת המצבים.
function _mapPhaseLabel(raw) {
    if (!raw) return null;
    const s = raw.toLowerCase();
    if (s.includes('מיינט') || s.includes('maint')) return 'maintenance';
    if (s.includes('עודף') || s.includes('surplus') || s.includes('bulk') || s.includes('באלק') || s.includes('בולק')) return 'surplus';
    if (s.includes('קאט') || s.includes('cut') || s.includes('גירעון') || s.includes('deficit')) return 'cut';
    return null;
}

function _parseBodyCsv(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return [];
    const delim = _detectDelim(lines[0]);
    const aoa = lines.map(l => _splitCsvLine(l, delim).map(c => c.trim()));
    return _rowsFromAoA(aoa);
}

// _rowsFromAoA — בונה רשומות מתוך מערך-של-מערכים (שורה ראשונה = כותרות).
// משותף ל-CSV ול-Excel.
function _rowsFromAoA(aoa) {
    if (!aoa || aoa.length < 2) return [];
    const headers = aoa[0].map(h => String(h == null ? '' : h).trim());
    const col = _mapColumns(headers);
    if (col.date == null || col.weight == null) throw new Error('לא זוהו עמודות תאריך + משקל');
    const out = [];
    for (let i = 1; i < aoa.length; i++) {
        const cells = (aoa[i] || []).map(c => String(c == null ? '' : c));
        const date = _parseFlexDate((cells[col.date] || '').trim());
        const wRaw = (cells[col.weight] || '').replace(',', '.').replace(/[^\d.]/g, '');
        const weight = parseFloat(wRaw);
        if (!date || !(weight > 0)) continue;
        let bodyFat = null;
        if (col.fat != null) {
            const f = (cells[col.fat] || '').replace('%', '').replace(',', '.').trim();
            if (f !== '') { const fv = parseFloat(f); if (fv > 0 && fv <= 70) bodyFat = fv; }
        }
        const phaseRaw = col.phase != null ? (cells[col.phase] || '').trim() : '';
        const note = col.note != null ? (cells[col.note] || '').trim() : '';
        out.push({ date, weight, bodyFat, phaseRaw, note });
    }
    return out;
}

function _renderImportPreview() {
    const rows = _bodyImportRows.filter(r => r.date && r.weight > 0);
    const summary = document.getElementById('bl-import-summary');
    const mapWrap = document.getElementById('bl-import-mapping');
    const prevWrap = document.getElementById('bl-import-preview');
    const confirmBtn = document.getElementById('bl-import-confirm');

    if (!rows.length) {
        summary.textContent = 'לא זוהו שורות תקינות בקובץ (נדרשות עמודות תאריך + משקל).';
        mapWrap.innerHTML = ''; prevWrap.innerHTML = ''; confirmBtn.style.display = 'none';
        document.getElementById('bl-import-modal').style.display = 'flex';
        return;
    }
    confirmBtn.style.display = 'block';
    const existing = new Set(StorageManager.getBodyLog().map(e => e.date));
    const dupes = rows.filter(r => existing.has(r.date)).length;
    summary.textContent = `זוהו ${rows.length} שקילות${dupes ? ` · ${dupes} ידרסו רשומות קיימות` : ''}.`;

    // מיפוי תוויות "שלב" → מצב תזונתי (מולא אוטומטית, ניתן לשנות)
    const phases = [...new Set(rows.map(r => r.phaseRaw).filter(Boolean))];
    _bodyImportMap = {};
    phases.forEach(p => _bodyImportMap[p] = _mapPhaseLabel(p) || '');
    mapWrap.innerHTML = phases.length
        ? '<div class="bl-map-title">מיפוי "שלב" → מצב תזונתי</div>' + phases.map(p =>
            `<div class="bl-map-row"><span class="bl-map-raw">${p}</span>
             <select class="minimal-input m-0 bg-card bl-map-sel" data-raw="${encodeURIComponent(p)}" onchange="_blSetMap(this)">
               <option value="cut"${_bodyImportMap[p] === 'cut' ? ' selected' : ''}>Cut</option>
               <option value="maintenance"${_bodyImportMap[p] === 'maintenance' ? ' selected' : ''}>Maintenance</option>
               <option value="surplus"${_bodyImportMap[p] === 'surplus' ? ' selected' : ''}>Surplus</option>
               <option value=""${!_bodyImportMap[p] ? ' selected' : ''}>—</option>
             </select></div>`).join('')
        : '';

    const prev = rows.slice(0, 6).map(r =>
        `<div class="bl-prev-row"><span>${r.date}</span><span>${r.weight}</span><span>${r.bodyFat != null ? r.bodyFat + '%' : '—'}</span><span>${r.phaseRaw || '—'}</span></div>`).join('');
    prevWrap.innerHTML = `<div class="bl-prev-row bl-prev-head"><span>תאריך</span><span>ק"ג</span><span>שומן</span><span>שלב</span></div>${prev}` +
        (rows.length > 6 ? `<div class="bl-prev-more">+${rows.length - 6} שקילות נוספות…</div>` : '');

    document.getElementById('bl-import-modal').style.display = 'flex';
}

function _blSetMap(sel) { _bodyImportMap[decodeURIComponent(sel.dataset.raw)] = sel.value; }
function closeBodyImportModal() { document.getElementById('bl-import-modal').style.display = 'none'; _bodyImportRows = []; }

function confirmBodyImport() {
    const rows = _bodyImportRows.filter(r => r.date && r.weight > 0);
    let count = 0;
    rows.forEach(r => {
        const state = r.phaseRaw ? (_bodyImportMap[r.phaseRaw] || null) : StorageManager.getNutritionStateOnDate(r.date);
        StorageManager.upsertBodyEntry({ date: r.date, weight: r.weight, bodyFat: r.bodyFat, nutritionState: state, note: r.note, source: 'import' });
        count++;
    });
    closeBodyImportModal();
    renderBodyLog();
    if (typeof renderHomeTodayCards === 'function') renderHomeTodayCards();
    _blSyncCloud();
    showAlert(`יובאו ${count} שקילות בהצלחה.`);
}

// ─── ייצוא מאוחד (לקלוד) ─────────────────────────────────────────────────────
// קובץ JSON יחיד עם 4 מקטעים: שקילות, תזונה יומית, תזונה מפורטת (meals אחיד), אימונים.
// כל מקור מסונן בנפרד — מחזיר את כל מה שקיים בטווח גם אם חלקי.
function _unifiedRange(range) {
    const today = _blTodayStr();
    if (range === 7 || range === 30) return { from: _blCutoff(range), to: today, label: range + ' ימים' };
    if (range === 'custom') {
        const f = document.getElementById('uni-export-start').value;
        const t = document.getElementById('uni-export-end').value;
        if (!f || !t) { showAlert('בחר תאריך התחלה וסיום.'); return null; }
        return { from: f, to: t, label: 'טווח מותאם' };
    }
    return { from: null, to: null, label: 'הכל' }; // 'all'
}

function exportUnifiedData(range) {
    const r = _unifiedRange(range);
    if (r === null) return;
    const inRange = d => (!r.from || d >= r.from) && (!r.to || d <= r.to);

    // שקילות + תזונה יומית — סינון לפי YYYY-MM-DD
    const weights = StorageManager.getBodyLog().filter(e => inRange(e.date))
        .sort((a, b) => a.date < b.date ? -1 : 1);
    const nutritionDaily = StorageManager.getNutritionDaily().filter(d => inRange(d.date))
        .sort((a, b) => a.date < b.date ? -1 : 1);

    // תזונה מפורטת — ארוחות/מרכיבים (תיעוד ישיר גובר על MFP), לפי הטווח
    const nutritionDetailed = _buildNutritionDetailed(r.from, r.to);

    // אימונים — סינון לפי timestamp, הסרת aiSummary + ניקוי טקסט מאמן מוטמע
    const fromMs = r.from ? new Date(r.from + 'T00:00:00').getTime() : -Infinity;
    const toMs = r.to ? new Date(r.to + 'T23:59:59').getTime() : Infinity;
    const workouts = StorageManager.getArchive()
        .filter(w => w.timestamp >= fromMs && w.timestamp <= toMs)
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(w => {
            const c = JSON.parse(JSON.stringify(w));
            // נרמול שדה התאריך עצמו ל-YYYY-MM-DD (export-only) — נגזר מה-timestamp האמין, מאחד מול שקילות/תזונה.
            // ה-storage עצמו (gympro_archive) נשאר ב-DD.MM.YYYY — לא נוגעים בו כדי לא לשבור רינדור/סנכרון.
            c.date = _blLocalDateStr(new Date(w.timestamp));
            delete c.aiSummary;
            if (typeof _stripCoachFromSummary === 'function') c.summary = _stripCoachFromSummary(c.summary);
            return c;
        });

    if (!weights.length && !nutritionDaily.length && !nutritionDetailed.length && !workouts.length) {
        showAlert('אין נתונים לייצוא בטווח שנבחר.'); return;
    }

    const payload = {
        app: 'GYMPRO ELITE', type: 'unified_export',
        readme: _NUTRI_EXPORT_README.concat(
            'הקובץ מכיל 4 מקטעים: weights (שקילות), nutrition_daily (סיכום יומי), nutrition_detailed (פירוט תזונה), workouts (אימונים).'
        ),
        generated: new Date().toISOString(),
        range: { label: r.label, from: r.from, to: r.to },
        counts: {
            weights: weights.length, nutrition_daily: nutritionDaily.length,
            nutrition_detailed_days: nutritionDetailed.length, workouts: workouts.length
        },
        weights, nutrition_daily: nutritionDaily, nutrition_detailed: nutritionDetailed, workouts
    };
    const slug = range === 'custom' ? 'custom' : (range === 'all' ? 'all' : range + 'd');
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gympro_unified_${slug}_${_blTodayStr()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    closeUnifiedExportModal();
    haptic('success');
    showAlert(`קובץ מאוחד הורד · ${weights.length} שקילות · ${nutritionDaily.length} ימי תזונה · ${workouts.length} אימונים`);
}

function openUnifiedExportModal() {
    const today = _blTodayStr();
    const s = document.getElementById('uni-export-start'), e = document.getElementById('uni-export-end');
    if (s) s.max = today;
    if (e) { e.max = today; e.value = today; }
    document.getElementById('unified-export-modal').style.display = 'flex';
}
function closeUnifiedExportModal() { document.getElementById('unified-export-modal').style.display = 'none'; }

// ─── ייצוא CSV — לפי הטווח שנבחר בבורר הייצוא ───────────────────────────────
function exportBodyCsv(b) {
    const log = StorageManager.getBodyLog().slice().sort((a, b2) => a.date < b2.date ? -1 : 1)
        .filter(e => (!b.from || e.date >= b.from) && (!b.to || e.date <= b.to));
    if (!log.length) { showAlert('אין נתונים לייצוא בטווח שנבחר.'); return; }

    const header = ['תאריך', 'משקל (ק"ג)', 'אחוז שומן', 'מצב תזונתי', 'מקור', 'הערות'];
    const rows = log.map(e => [
        e.date, e.weight,
        e.bodyFat != null ? e.bodyFat + '%' : '',
        _BL_STATE_LBL[e.nutritionState] || '',
        e.source || '', e.note || ''
    ]);
    const esc = c => { const s = String(c); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM — תאימות עברית באקסל
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gympro_weights_${b.slug}_${_blTodayStr()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    haptic('success');
}

// ═══════════════════════════════════════════════════════════════════════════
// SLEEP / RECOVERY — טאב "שינה" בתוך מסך הבריאות (v17.50)
// שואב שינה + התאוששות מ-Apple Health (בקרוב דרך גשר ה-Health). כרגע: אם אין
// נתונים אמיתיים — מוצגים נתוני דמה עם באנר, כדי לראות את המסך בלייב.
// ═══════════════════════════════════════════════════════════════════════════

let _slRange = 7;   // טווח גרפי השינה: 7 | 30
const SLEEP_NEED_MIN = 480;  // ברירת-מחדל/עוגן עליון (8ש') — fallback עד שיש בסיס אישי
const SLEEP_ADEQ_MIN = 450;  // עוגן מספיקות מוחלט (7.5ש') לציון ההתאוששות — NSF/AASM 7–9ש'
const SLEEP_FLOOR_MIN = 420; // רצפה בריאותית (7ש', AASM) — הצורך האישי לא יורד מתחתיה
const SLEEP_CAP_MIN = 540;   // תקרה (9ש', NSF) — הצורך האישי לא עולה מעליה

// _VITAL_RANGE — טווחים פיזיולוגיים סבירים לכל מדד. ערך מחוץ לטווח = "לא נמשך / תקלת
// חיישן" (בעיקר 0 שנשלח כשהמדד חסר מ-Apple Health) → מטופל כ**חסר**: מנוטרל מהציון וגם
// מה-baseline (כדי שלא יזהם חישובים עתידיים), והמשקלים של יתר המדדים מתנרמלים אוטומטית.
// מכוון: לא מסננים לפי "סטייה יחסית" — HRV נמוך מאוד הוא אות אמיתי (מחלה/עומס), לא תקלה,
// ואסור להסתיר אותו. טמפ' עור (סטייה) לא נכללת — 0 = "אין סטייה" הוא ערך תקין.
const _VITAL_RANGE = {
    hrv:        [5, 260],    // ms
    rhr:        [25, 130],   // bpm
    respRate:   [4, 45],     // נשימות/דקה
    asleepMin:  [30, 900],   // דקות (0.5–15ש')
    efficiency: [0.3, 1.01]  // יחס (מתחת ל-0.3 = תקלת חישוב)
};
function _validVital(key, v) {
    if (v == null || isNaN(v)) return false;
    const r = _VITAL_RANGE[key];
    return r ? (v >= r[0] && v <= r[1]) : true;
}

function _slFmtDur(min) {
    if (min == null || isNaN(min)) return '—';
    const m = Math.round(min);
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

// _slSyncTime — חותמת סנכרון קריאה: "היום HH:MM" או "DD/MM HH:MM".
function _slSyncTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay ? `היום ${hh}:${mm}` : `${d.getDate()}/${d.getMonth() + 1} ${hh}:${mm}`;
}

// _sleepDemoData — מייצר ~35 לילות דמה ריאליסטיים (דטרמיניסטי), לצפייה בלייב.
function _sleepDemoData() {
    const out = [];
    const today = new Date();
    const rnd = (seed) => { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); };
    for (let i = 34; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const bad = (i === 6 || i === 13 || i === 20);   // כמה לילות חלשים לגיוון
        const s = rnd(i + 1);
        const inbed = Math.round((bad ? 340 : 430) + (s - 0.5) * 70);
        const eff = Math.min(0.97, Math.max(0.74, (bad ? 0.80 : 0.90) + (rnd(i + 2) - 0.5) * 0.06));
        const asleep = Math.round(inbed * eff);
        const awake = inbed - asleep;
        const deep = Math.round(asleep * (0.17 + (rnd(i + 3) - 0.5) * 0.04));
        const rem = Math.round(asleep * (0.22 + (rnd(i + 4) - 0.5) * 0.04));
        const core = asleep - deep - rem;
        out.push({
            date: iso,
            asleepMin: asleep, inBedMin: inbed, efficiency: Math.round(eff * 100) / 100,
            deepMin: deep, remMin: rem, coreMin: core, awakeMin: awake,
            hrv: Math.round((bad ? 58 : 72) + (rnd(i + 5) - 0.5) * 12),
            rhr: Math.round((bad ? 54 : 47) + (rnd(i + 6) - 0.5) * 4),
            respRate: Math.round(((bad ? 14.6 : 13.7) + (rnd(i + 7) - 0.5) * 0.6) * 10) / 10,
            wristTempDev: Math.round(((bad ? 0.4 : 0) + (rnd(i + 8) - 0.5) * 0.3) * 10) / 10,
            src: 'demo'
        });
    }
    return out;
}

// _sleepData — מקור הנתונים: אמיתי אם קיים, אחרת דמה (עם דגל).
function _sleepData() {
    const real = StorageManager.getSleepDaily();
    if (real && real.length) return { nights: real, demo: false };
    return { nights: _sleepDemoData(), demo: true };
}

// _median / _recoveryBaseline — baseline אישי חזק (חציון + MAD) על חלון עוקב.
function _slMedian(arr) {
    const v = arr.filter(x => x != null && !isNaN(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function _recoveryBaseline(nights, idx, key, win = 28) {
    const start = Math.max(0, idx - win);
    const vals = [];
    for (let i = start; i < idx; i++) { const v = nights[i] && nights[i][key]; if (_validVital(key, v)) vals.push(v); }
    const med = _slMedian(vals);
    if (med == null) return { med: null, spread: null, n: 0 };
    const mad = _slMedian(vals.map(v => Math.abs(v - med)));
    return { med, spread: Math.max((mad || 0) * 1.4826, 1e-6), n: vals.length };
}

// _sleepNeed — צורך שינה אישי לתצוגה: החציון ההיסטורי שלך, חתוך לטווח הבריאותי המומלץ
// (7–9ש', NSF/AASM). מונע נרמול גירעון (רצפה 7ש') ודרישת-יתר (תקרה 9ש'). fallback 8ש'
// עד שנצבר בסיס. שונה מעוגן המספיקות בציון (SLEEP_ADEQ_MIN) — זה יעד תצוגה מציאותי.
function _sleepNeed(nights, idx) {
    const b = _recoveryBaseline(nights, idx, 'asleepMin');
    if (b.med == null) return SLEEP_NEED_MIN;
    return Math.max(SLEEP_FLOOR_MIN, Math.min(SLEEP_CAP_MIN, b.med));
}

// _clampZ — חיתוך z-score ל-±3 (winsorizing). מונע שלילה יחידה עם שונות זעירה מלפוצץ
// את הקומפוזיט, ומגביל תרומת לילה בודד ל-~3 סטיות-תקן — היגיינה סטטיסטית תקנית.
const _clampZ = z => Math.max(-3, Math.min(3, z));

// computeReadiness — ציון 0–100 מ-z-score מול baseline. מחזיר building עד 14 לילות.
function computeReadiness(nights, idx) {
    const n = nights[idx];
    if (!n) return { score: null, building: true, have: 0, need: 14 };
    const baseCount = _recoveryBaseline(nights, idx, 'hrv').n;
    if (baseCount < 14) return { score: null, building: true, have: baseCount, need: 14 };

    const parts = [];   // {w, contrib, key, label, delta, dir}
    const push = (key, w, val, dir, label, unit, invGood) => {
        if (!_validVital(key, val)) return;   // מדד לא-תקין (0/מחוץ לטווח) → מנוטרל, המשקל מתנרמל
        const b = _recoveryBaseline(nights, idx, key);
        if (b.med == null) return;
        let z = _clampZ((val - b.med) / b.spread);
        let contrib;
        if (dir === 'sym') contrib = -Math.abs(z);           // סטייה לכל כיוון = רע
        else contrib = (dir === 'inv' ? -z : z);
        const delta = Math.round((val - b.med) * 10) / 10;
        const good = invGood ? delta < 0 : delta > 0;
        parts.push({ w, contrib, label, delta: (delta > 0 ? '+' : '') + delta + unit, dir: good ? 'up' : 'down', z });
    };
    push('hrv', 0.35, n.hrv, 'pos', 'HRV', 'ms', false);
    push('rhr', 0.20, n.rhr, 'inv', 'דופק מנוחה', '', true);
    push('respRate', 0.08, n.respRate, 'sym', 'נשימה', '', true);
    // שינה — מדד משולב: 60% סטייה מהבסיס האישי (התאוששות יחסית — כמו שאר המדדים) +
    // 40% מספיקות מוחלטת מול עוגן מומלץ (NSF/AASM ~7.5ש', בלי בונוס על שינת-יתר). כך לא
    // מנרמלים גירעון כרוני מצד אחד, ולא נענשים קבוע על שינה סבירה מצד שני. יעילות = מקדם
    // משני מול הבסיס האישי. המשקלים (60/40, 0.85/0.15) = כוונון הנדסי, לא נוסחה מאומתת.
    if (_validVital('asleepMin', n.asleepMin)) {
        const bSleep = _recoveryBaseline(nights, idx, 'asleepMin');
        const sSpread = Math.max(bSleep.spread || 0, 20);    // רצפת spread ~20 דק' — שינה יציבה לא תפוצץ z
        const zPers = bSleep.med != null ? _clampZ((n.asleepMin - bSleep.med) / sSpread) : 0;
        let zAdeq = (n.asleepMin - SLEEP_ADEQ_MIN) / 60;      // ~60 דק' ליחידת z
        zAdeq = Math.max(-2.5, Math.min(0.3, zAdeq));         // קנס מתגבר על גירעון, בלי בונוס
        const zDur = 0.6 * zPers + 0.4 * zAdeq;
        const bEff = _recoveryBaseline(nights, idx, 'efficiency');
        const eSpread = Math.max(bEff.spread || 0, 0.03);     // רצפת spread ~3% — יעילות יציבה לא תפוצץ z
        const zEff = (n.efficiency != null && bEff.med != null) ? _clampZ((n.efficiency - bEff.med) / eSpread) : 0;
        const z = bEff.med != null ? 0.85 * zDur + 0.15 * zEff : zDur;
        parts.push({ w: 0.30, contrib: z, label: 'שינה', delta: _slFmtDur(n.asleepMin), dir: z >= 0 ? 'up' : 'down', z });
    }
    // טמפרטורת עור — סטייה מוחלטת רעה
    if (n.wristTempDev != null) {
        parts.push({ w: 0.07, contrib: -Math.abs(n.wristTempDev) / 0.3, label: 'טמפ׳', delta: (n.wristTempDev > 0 ? '+' : '') + n.wristTempDev + '°', dir: Math.abs(n.wristTempDev) <= 0.2 ? 'up' : 'down', z: 0 });
    }
    if (!parts.length) return { score: null, building: true, have: baseCount, need: 14 };

    const wsum = parts.reduce((a, p) => a + p.w, 0);
    const composite = parts.reduce((a, p) => a + p.w * p.contrib, 0) / wsum;
    const score = Math.max(1, Math.min(99, Math.round(50 + 22 * composite)));
    const band = score >= 66 ? 'מוכן' : score >= 34 ? 'בינוני' : 'נמוך';
    const color = score >= 66 ? 'var(--success)' : score >= 34 ? 'var(--warn)' : 'var(--danger)';
    // drivers — 3 התורמים החזקים ביותר (לפי |w*contrib|)
    const drivers = parts.slice().sort((a, b) => Math.abs(b.w * b.contrib) - Math.abs(a.w * a.contrib))
        .slice(0, 3).map(p => ({ label: p.label, delta: p.delta, dir: p.dir }));
    return { score, band, color, drivers, building: false };
}

// _slRing — טבעת SVG (או מקווקוות במצב building)
function _slRing(rd, size) {
    const C = 42, CIRC = 2 * Math.PI * C;
    const cls = size === 'sm' ? 'sl-ring sm' : 'sl-ring';
    if (rd.building) {
        return `<div class="${cls} dashed"><svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="${C}"></circle>
            <circle class="prog" cx="50" cy="50" r="${C}" stroke-dasharray="4 7" stroke-dashoffset="0"></circle></svg>
            <div class="ctr"><div class="score" style="color:var(--text-dim)">—</div><div class="bnd">בונה</div></div></div>`;
    }
    const off = CIRC * (1 - rd.score / 100);
    return `<div class="${cls}"><svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="${C}"></circle>
        <circle class="prog" cx="50" cy="50" r="${C}" stroke="${rd.color}" stroke-dasharray="${CIRC}" stroke-dashoffset="${off}"
        style="filter:drop-shadow(0 0 6px ${rd.color}55)"></circle></svg>
        <div class="ctr"><div class="score" style="color:${rd.color}">${rd.score}</div><div class="bnd" style="color:${rd.color}">${rd.band}</div></div></div>`;
}

function _slStagesBar(n) {
    const seg = (v, c) => `<span style="flex-grow:${Math.max(v, 0)};background:${c}"></span>`;
    return `<div class="sl-stages-bar">
        ${seg(n.deepMin, 'var(--st-deep)')}${seg(n.coreMin, 'var(--st-core)')}${seg(n.remMin, 'var(--st-rem)')}${seg(n.awakeMin, 'var(--st-awake)')}</div>
    <div class="sl-legend">
        <div class="li"><span class="sw" style="background:var(--st-deep)"></span>עמוקה <b>${_slFmtDur(n.deepMin)}</b></div>
        <div class="li"><span class="sw" style="background:var(--st-core)"></span>בסיסית <b>${_slFmtDur(n.coreMin)}</b></div>
        <div class="li"><span class="sw" style="background:var(--st-rem)"></span>REM <b>${_slFmtDur(n.remMin)}</b></div>
        <div class="li"><span class="sw" style="background:var(--st-awake)"></span>ערנות <b>${_slFmtDur(n.awakeMin)}</b></div>
    </div>`;
}

function _slDurChart(nights) {
    const data = nights.slice(-_slRange);
    const need = _sleepNeed(nights, nights.length);   // יעד אישי (חציון חתוך ל-7–9ש')
    const W = 320, H = 110, pad = 6;
    const bw = (W - pad * 2) / data.length;
    const max = Math.max(need, ...data.map(d => d.asleepMin || 0)) * 1.08;
    const y = v => H - (v / max) * (H - 14);
    let bars = '';
    data.forEach((d, i) => {
        const x = pad + i * bw, last = i === data.length - 1;
        const v = d.asleepMin || 0;
        const col = last ? (computeReadiness(nights, nights.length - 1).color || 'var(--accent)') : 'rgba(var(--accent-rgb),.5)';
        bars += `<rect x="${x + bw * 0.16}" y="${y(v)}" width="${bw * 0.68}" height="${H - y(v)}" rx="3" fill="${col}"/>`;
    });
    const ny = y(need);
    // קו היעד בלבד — תווית "יעד 8ש׳" עברה לכותרת הכרטיס כדי לא לגלוש מגבולות ה-SVG (RTL)
    return `<svg class="sl-chart" viewBox="0 0 ${W} ${H + 4}">
        <line x1="${pad}" x2="${W - pad}" y1="${ny}" y2="${ny}" stroke="var(--warn)" stroke-width="1" stroke-dasharray="4 4" opacity=".55"/>${bars}</svg>`;
}

function _slDualChart(nights) {
    const data = nights.slice(-_slRange);
    const W = 320, H = 96, pad = 8;
    const line = (key, col, lo, hi) => {
        const n = data.length, bw = (W - pad * 2) / Math.max(n - 1, 1);
        let d = '', pts = '';
        data.forEach((row, i) => {
            const v = row[key]; if (v == null) return;
            const x = pad + i * bw, yy = H - ((v - lo) / (hi - lo)) * (H - 18) - 9;
            d += (d ? 'L' : 'M') + x.toFixed(1) + ' ' + yy.toFixed(1) + ' ';
            pts += `<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="${i === n - 1 ? 3.5 : 2}" fill="${col}"/>`;
        });
        return `<path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${pts}`;
    };
    const last = data[data.length - 1] || {};
    return `<svg class="sl-chart" viewBox="0 0 ${W} ${H}">${line('hrv', '#64D2FF', 40, 90)}${line('rhr', '#FFB868', 42, 60)}</svg>
    <div class="sl-legend" style="margin-top:8px">
        <div class="li"><span class="sw" style="background:#64D2FF"></span>HRV <b>${last.hrv ?? '—'} ms</b></div>
        <div class="li"><span class="sw" style="background:#FFB868"></span>דופק מנוחה <b>${last.rhr ?? '—'} bpm</b></div>
    </div>`;
}

function _slMetric(v, unit, k, delta, dcls) {
    return `<div class="sl-metric"><div class="v">${v}<small>${unit || ''}</small></div><div class="k">${k}</div>${delta ? `<div class="d ${dcls}">${delta}</div>` : ''}</div>`;
}

function _slAvg(nights, key, win) {
    const arr = nights.slice(-win).map(d => d[key]).filter(x => x != null && !isNaN(x));
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function setSleepRange(r) {
    _slRange = r;
    renderSleepView();
    if (typeof haptic === 'function') haptic('light');
}

function renderSleepView() {
    const host = document.getElementById('bl-view-sleep');
    if (!host) return;
    const { nights, demo } = _sleepData();
    if (!nights.length) {
        host.innerHTML = `<div class="bl-chart-card" style="text-align:center;color:var(--text-dim)">אין עדיין נתוני שינה. חבר את גשר ה-Health כדי לשאוב מ-Apple Health.</div>`;
        return;
    }
    const idx = nights.length - 1;
    const n = nights[idx];
    const rd = computeReadiness(nights, idx);
    const need = _sleepNeed(nights, idx);   // יעד שינה אישי (חציון חתוך ל-7–9ש')

    const b = (key) => _recoveryBaseline(nights, idx, key).med;
    const dlt = (val, base, invGood, unit) => {
        if (val == null || base == null) return ['', 'flat'];
        const d = Math.round((val - base) * 10) / 10;
        if (Math.abs(d) < 0.05) return ['≈ baseline', 'flat'];
        const good = invGood ? d < 0 : d > 0;
        return [`${d > 0 ? '+' : ''}${d} מול baseline`, good ? 'up' : 'down'];
    };
    // מדד לא-תקין (0/מחוץ לטווח) מוצג כ"—" ובלי דלתא — לא כערך אמיתי מטעה
    const _vv = (k) => _validVital(k, n[k]) ? n[k] : null;
    const hrvD = dlt(_vv('hrv'), b('hrv'), false, 'ms');
    const rhrD = dlt(_vv('rhr'), b('rhr'), true, '');
    const respD = dlt(_vv('respRate'), b('respRate'), true, '');

    const drivers = (rd.drivers || []).map(d =>
        `<span class="sl-chip ${d.dir}">${d.label} <span class="ar">${d.delta}</span></span>`).join('');

    const demoBanner = demo
        ? `<div class="sl-demo-banner">נתוני דמה להדגמה — חבר את גשר ה-Health כדי לראות את הנתונים שלך</div>` : '';

    // שורת סנכרון אלגנטית (לא-דמה): "מסונכרן · עודכן HH:MM · הקש לרענון".
    // מחליפה את הטוסט המציק — הסנכרון שקט, והמשתמש רואה שהכל עובד + יכול לרענן ידנית.
    const lastSync = (typeof StorageManager.getHealthLastSync === 'function') ? StorageManager.getHealthLastSync() : 0;
    const syncLine = (!demo && lastSync)
        ? `<div class="sl-sync" onclick="if(typeof syncHealthNutrition==='function')syncHealthNutrition(true)">מסונכרן · עודכן ${_slSyncTime(lastSync)} · הקש לרענון</div>`
        : '';

    const coachByBand = {
        'מוכן': 'התאוששות טובה — חלון לדחיפה. אפשר להעלות עצימות/נפח היום.',
        'בינוני': 'התאוששות בינונית — שמור על התוכנית, אל תעלה עומס משמעותית.',
        'נמוך': 'התאוששות נמוכה — כבד את ה-RIR, שקול ירידת נפח או אימון קל.'
    };
    const coachTxt = rd.building
        ? `אוסף נתונים — הציון יופיע אחרי 14 לילות (נאספו ${rd.have}/14). הנתונים הגולמיים כבר מוצגים.`
        : coachByBand[rd.band];
    const coachCls = rd.building ? '' : (rd.band === 'מוכן' ? 'high' : rd.band === 'בינוני' ? 'mid' : 'low');

    host.innerHTML = `
    ${demoBanner}
    ${syncLine}
    <div class="bl-chart-card sl-hero">
      <div class="sl-hero-row">
        ${_slRing(rd)}
        <div class="sl-hero-side">
          <div class="sl-hero-title">${rd.building ? 'לילה אחרון' : 'התאוששות'}</div>
          <div class="sl-hero-sub">${rd.building
            ? `הנתונים נאספים — הציון יופיע אחרי 14 לילות (${rd.have}/14)`
            : 'מבוסס על HRV, דופק מנוחה, שינה, נשימה וטמפרטורה מול ה-baseline שלך'}</div>
          <div class="sl-drivers">${rd.building ? `<span class="sl-chip flat">baseline ${rd.have}/14</span>` : drivers}</div>
        </div>
      </div>
      <div class="sl-mgrid">
        ${_slMetric(_slFmtDur(n.asleepMin), '', 'זמן שינה', n.asleepMin >= need ? 'מעל היעד' : 'מתחת ליעד', n.asleepMin >= need ? 'up' : 'down')}
        ${_slMetric(Math.round((n.efficiency || 0) * 100), '%', 'יעילות', (n.efficiency || 0) >= 0.88 ? 'טובה' : 'בינונית', (n.efficiency || 0) >= 0.88 ? 'up' : 'flat')}
        ${_slMetric(_vv('hrv') ?? '—', ' ms', 'HRV', ...hrvD)}
        ${_slMetric(_vv('rhr') ?? '—', ' bpm', 'דופק מנוחה', ...rhrD)}
        ${_slMetric(_vv('respRate') ?? '—', '', 'קצב נשימה', ...respD)}
        ${_slMetric(n.wristTempDev == null ? '—' : (n.wristTempDev > 0 ? '+' : '') + n.wristTempDev, '°', 'טמפ׳ עור', n.wristTempDev == null ? '' : 'מול baseline', n.wristTempDev == null ? 'flat' : (Math.abs(n.wristTempDev) <= 0.2 ? 'up' : 'down'))}
      </div>
    </div>

    <div class="bl-chart-card sl-coach ${coachCls}">
      <div class="ci">AI</div><div class="ct"><b>המאמן:</b> ${coachTxt}</div>
    </div>

    <div class="bl-chart-card">
      <div class="sl-card-title">שלבי שינה — הלילה</div>
      ${_slStagesBar(n)}
    </div>

    <div class="bl-chart-card">
      <div class="sl-chart-head"><div class="sl-card-title" style="margin:0">משך שינה <small style="color:var(--warn);font-weight:700;font-size:.7rem">· יעד אישי ${_slFmtDur(need)}</small></div>
        <div class="sl-range">
          <button class="${_slRange === 7 ? 'on' : ''}" onclick="setSleepRange(7)">7 ימים</button>
          <button class="${_slRange === 30 ? 'on' : ''}" onclick="setSleepRange(30)">30 יום</button>
        </div></div>
      ${_slDurChart(nights)}
    </div>

    <div class="bl-chart-card">
      <div class="sl-card-title">HRV ודופק מנוחה · ${_slRange} ימים</div>
      ${_slDualChart(nights)}
    </div>

    <div class="sl-avg-row">
      <div class="sl-avg"><div class="v">${_slFmtDur(_slAvg(nights, 'asleepMin', 7))}</div><div class="k">שינה · 7 ימים</div></div>
      <div class="sl-avg"><div class="v">${Math.round((_slAvg(nights, 'efficiency', 7) || 0) * 100)}%</div><div class="k">יעילות</div></div>
      <div class="sl-avg"><div class="v">${Math.round(b('hrv') || 0)}</div><div class="k">HRV baseline</div></div>
      <div class="sl-avg"><div class="v">${Math.round(b('rhr') || 0)}</div><div class="k">RHR baseline</div></div>
    </div>`;
}
