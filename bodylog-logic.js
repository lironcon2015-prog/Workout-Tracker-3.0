/* ============================================================================
 * bodylog-logic.js — מעקב שקילות (משקל + אחוז שומן) GYMPRO ELITE
 * מסך "גוף": רשימת שקילות, גרפים, ניתוחים, צילום/OCR, ייבוא וייצוא CSV.
 * המצב התזונתי לכל שקילה נגזר אוטומטית מלוג המעברים (StorageManager).
 * ==========================================================================*/

let _blRange = 30;            // טווח גרף נוכחי: 7 / 30 / 90 / 'all' / 'custom'
let _blCustom = { from: '', to: '' };  // גבולות טווח מותאם (YYYY-MM-DD)
let _blTab = 'weight';        // תת-מסך פעיל: 'weight' | 'nutrition'
let _blListExpanded = false;  // האם רשימת השקילות מורחבת (מעבר ל-7 האחרונות)
let _blNutriExpanded = false; // האם רשימת התזונה מורחבת
let _blEditDate = null;       // התאריך שנערך כרגע (null = רשומה חדשה)
let _bodyImportRows = [];     // שורות מפורסרות מ-CSV הממתינות לאישור
let _bodyImportMap = {};      // מיפוי תווית "שלב" גולמית → מצב תזונתי

const _BL_STATE_LBL = { cut: 'Cut', maintenance: 'Maintenance', surplus: 'Surplus' };

// ─── עזרי תאריך ─────────────────────────────────────────────────────────────
function _blDTs(d) { const [y, m, da] = d.split('-').map(Number); return new Date(y, m - 1, da).getTime(); }
function _blTodayStr() { return new Date().toISOString().slice(0, 10); }
function _blShortDate(d) { const p = d.split('-'); return `${p[2]}.${p[1]}`; }          // DD.MM (ציר הגרף)
function _blListDate(d) { const p = d.split('-'); return `${p[2]}.${p[1]}.${p[0]}`; }   // DD.MM.YYYY (לוג השקילות)
function _blCutoff(days) { return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10); }

// ─── רינדור ראשי ────────────────────────────────────────────────────────────
function renderBodyLog() {
    const log = StorageManager.getBodyLog();
    _renderBodyKpis(log);
    _renderBodyCharts(log);
    _renderBodyList(log);
    _renderNutritionView();
    _applyTabVisibility();
}

// ─── תתי-מסכים: שקילה / תזונה ────────────────────────────────────────────────
function _applyTabVisibility() {
    document.querySelectorAll('#bl-subtab .seg-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === _blTab));
    const w = document.getElementById('bl-view-weight');
    const n = document.getElementById('bl-view-nutrition');
    if (w) w.style.display = _blTab === 'weight' ? '' : 'none';
    if (n) n.style.display = _blTab === 'nutrition' ? '' : 'none';
}

function setBodyTab(tab) {
    _blTab = tab;
    _applyTabVisibility();
    _refreshActiveView();   // ציור מחדש כדי שגאומטריית ה-tooltip תתעדכן בתצוגה הגלויה
    haptic('light');
}

function _refreshActiveView() {
    if (_blTab === 'weight') _renderBodyCharts(StorageManager.getBodyLog());
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
    try {
        const nlog = (typeof StorageManager.getNutritionLog === 'function') ? StorageManager.getNutritionLog() : null;
        const phaseStart = (nlog && nlog.length) ? nlog[nlog.length - 1].startDate : null;
        if (phaseStart) { const skip = _addDays(phaseStart, 7); if (skip > startDate) startDate = skip; }
    } catch (e) { /* אין לוג מעברים — נשארים עם חלון 28 הימים */ }

    const nutW = (StorageManager.getNutritionDaily() || []).filter(d => d.date >= startDate);
    const bodW = (StorageManager.getBodyLog() || []).filter(e => e.date >= startDate).sort((a, b) => a.date < b.date ? -1 : 1);
    const spanDays = bodW.length ? (_blDTs(bodW[bodW.length - 1].date) - _blDTs(bodW[0].date)) / 86400000 : 0;
    if (nutW.length >= 10 && bodW.length >= 4 && spanDays >= 10) {
        const cleaned = _cleanNutriOutliers(nutW.map(d => ({ date: d.date, val: d.calories })));
        const avgIntake = Math.round(cleaned.reduce((s, p) => s + p.val, 0) / cleaned.length);
        const t0 = _blDTs(bodW[0].date);
        const reg = _linReg(bodW.map(e => ({ t: (_blDTs(e.date) - t0) / 86400000, v: e.weight })));
        if (reg) {
            measured = Math.round(avgIntake - reg.slope * _KCAL_PER_KG);
            rmse = reg.rmse;
            res.avgIntake = avgIntake;
            res.weeklyKg = +(reg.slope * 7).toFixed(2);
            days = nutW.length;
            noisy = (rmse > 0.7) || (days < 14);           // מגמה רועשת / חלון קצר
            // חסם שפיות — קצב בלתי-אפשרי = נתונים פגומים, אל תעגן עליו
            if (Math.abs(res.weeklyKg) > 1.6) measured = null;
            else res.methods.push({ name: 'מדידה (back-calc)', bmr: null, tdee: measured, note: `${days} ימים` });
        }
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

function _renderTdeeCard() {
    const card = document.getElementById('bl-tdee-card');
    if (!card) return;
    const t = computeTDEE();
    if (!t) {
        card.innerHTML = `<div class="bl-chart-title">מאזן אנרגיה · TDEE</div>
            <p class="bl-nutri-hint">צריך עוד נתונים: שקילה עם אחוז שומן (לתחזית מיידית) או ≥14 ימי תזונה+שקילות (למדידה מדויקת). אפשר גם להוסיף מין/גיל/גובה בהגדרות.</p>`;
        return;
    }
    const fmt = n => Math.round(n).toLocaleString('he-IL');
    const rows = t.methods.map(m =>
        `<tr><td>${m.name}</td><td>${m.bmr != null ? fmt(m.bmr) : '—'}</td><td>${fmt(m.tdee)}</td><td>${m.note || ''}</td></tr>`).join('');
    const cut = t.best - 550;        // גירעון ל-~0.5 ק"ג/שבוע
    const bulk = t.best + 275;       // עודף ל-~0.25 ק"ג/שבוע
    const balance = (t.weeklyKg != null)
        ? `<div class="bl-tdee-balance">קצב נוכחי: ${t.weeklyKg >= 0 ? '+' : ''}${t.weeklyKg} ק"ג/שבוע · צריכה ממוצעת ${fmt(t.avgIntake)} קק"ל</div>` : '';
    card.innerHTML = `
        <div class="bl-chart-title">מאזן אנרגיה · TDEE <small>— ביטחון ${t.confidence} · ${t.source}</small></div>
        <div class="bl-tdee-hero">${fmt(t.best)}<span class="bl-tdee-unit">קק"ל/יום</span></div>
        <div class="bl-tdee-range">טווח ${fmt(t.low)}–${fmt(t.high)} · אי-ודאות: ${t.uncertainty}</div>
        ${balance}
        <table class="bl-tdee-table"><thead><tr><th>שיטה</th><th>BMR</th><th>TDEE</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        ${t.diverge ? `<div class="bl-tdee-warn">⚠ השיטות סוטות &gt;15% זו מזו — ייתכן דיווח לא עקבי</div>` : ''}
        <div class="bl-tdee-targets">
            <div><span>תחזוקה</span><b>${fmt(t.best)}</b></div>
            <div><span>ירידה ~0.5/שב'</span><b>${fmt(cut)}</b></div>
            <div><span>עלייה ~0.25/שב'</span><b>${fmt(bulk)}</b></div>
        </div>
        <div class="bl-nutri-foot">${t.note}</div>`;
}

function _renderNutritionCard(allDays) {
    const card = document.getElementById('bl-nutrition-card');
    if (!card) return;
    const all = allDays || StorageManager.getNutritionDaily();
    const importBtn = `<button id="bl-nutri-import-btn" class="bl-nutri-import" onclick="importNutritionFromGmail()"><span class="material-symbols-outlined">cloud_download</span><span>ייבא מ-Gmail</span></button>`;

    if (!all.length) {
        card.innerHTML = `<div class="bl-nutri-head"><div class="bl-chart-title">תזונה · MyFitnessPal</div>${importBtn}</div>
            <p class="bl-nutri-hint">אין עדיין נתוני תזונה. בקש ייצוא ב-MyFitnessPal ולחץ "ייבא מ-Gmail" כדי למשוך את הייצוא האחרון.</p>`;
        return;
    }
    const inRange = _blFilter(all).sort((a, b) => a.date < b.date ? -1 : 1);
    const base = inRange.length ? inRange : all;
    const avg = k => Math.round(base.reduce((s, d) => s + (d[k] || 0), 0) / base.length);
    const latest = all[all.length - 1];
    card.innerHTML = `<div class="bl-nutri-head">
            <div class="bl-chart-title">ממוצע תזונה <small>— ${_rangeLabel()}</small></div>${importBtn}</div>
        <div class="bl-nutri-grid">
            ${_nutriKpi('קלוריות', avg('calories'), 'kcal')}
            ${_nutriKpi('חלבון', avg('protein'), 'g')}
            ${_nutriKpi('פחמימה', avg('carbs'), 'g')}
            ${_nutriKpi('שומן', avg('fat'), 'g')}
        </div>
        <div class="bl-nutri-foot">${base.length} ימים בטווח · עודכן לאחרונה ${_blListDate(latest.date)} · ${all.length} ימים בסך הכל</div>
        <div class="bl-nutri-exports">
            <button class="bl-export-btn" onclick="exportNutritionCsv('all')"><span class="material-symbols-outlined">table_view</span>ייצא יומי</button>
            <button class="bl-export-btn" onclick="exportNutritionCsv('range')"><span class="material-symbols-outlined">date_range</span>ייצא תקופה</button>
        </div>
        <div class="bl-nutri-exports">
            <button class="bl-export-btn" onclick="exportNutritionRawCsv()"><span class="material-symbols-outlined">description</span>ייצא קובץ MFP מלא</button>
        </div>
        <button class="bl-nutri-reset" onclick="resetNutritionData()"><span class="material-symbols-outlined">delete</span>מחק נתוני תזונה</button>`;
}

function _nutriKpi(label, val, unit) {
    return `<div class="bl-nutri-kpi"><div class="bl-nutri-val">${val}<span class="bl-nutri-unit">${unit}</span></div><div class="bl-nutri-lbl">${label}</div></div>`;
}

function _renderNutritionCharts(allDays) {
    const all = allDays || StorageManager.getNutritionDaily();
    const days = _blFilter(all).sort((a, b) => a.date < b.date ? -1 : 1);
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
    const all = allDays || StorageManager.getNutritionDaily();
    if (!all.length) { el.innerHTML = ''; return; }
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

// ─── ייצוא תזונה ל-CSV ────────────────────────────────────────────────────────
// exportNutritionCsv — סיכום יומי (יום → קק"ל + מאקרו).
// scope==='range' → רק הטווח הנבחר; אחרת → כל ההיסטוריה.
function exportNutritionCsv(scope) {
    const all = StorageManager.getNutritionDaily();
    if (!all.length) { showAlert('אין נתוני תזונה לייצוא.'); return; }
    let days;
    if (scope === 'range') {
        days = _blFilter(all).sort((a, b) => a.date < b.date ? -1 : 1);
        if (!days.length) { showAlert('אין נתוני תזונה בטווח שנבחר.'); return; }
    } else {
        days = all.slice().sort((a, b) => a.date < b.date ? -1 : 1);
    }
    const header = ['Date', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Meals'];
    const rows = days.map(d => [d.date, d.calories, d.protein, d.carbs, d.fat, d.meals != null ? d.meals : '']);
    const esc = c => { const s = String(c); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM — תאימות אקסל
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gympro_nutrition_${scope === 'range' ? 'range' : 'all'}_${_blTodayStr()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    haptic('success');
}

// resetNutritionData — מוחק את כל נתוני התזונה (לאחר אישור). שאיבה מחדש תתחיל מאפס.
function resetNutritionData() {
    showConfirm('פעולה זו תמחק את כל נתוני התזונה (סיכום יומי + הקובץ הגולמי) ואינה ניתנת לשחזור. שים לב: שאיבה מ-Gmail מושכת רק את הייצוא האחרון, אז היסטוריה ישנה לא תחזור. להמשיך?', () => {
        StorageManager.clearNutrition();
        _blNutriExpanded = false;
        renderBodyLog();
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

// exportNutritionRawCsv — מייצא את הקובץ הגולמי המקורי של MFP (per-meal),
// אגרגציה נאמנה של כל הקבצים שהועלו, ללא פאראפרזה של המערכת.
function exportNutritionRawCsv() {
    const raw = StorageManager.getNutritionRaw();
    if (!raw || !Array.isArray(raw.rows) || !raw.rows.length) {
        showAlert('אין קובץ MFP גולמי שמור. ייבא מ-Gmail (בגרסה החדשה של הגשר) כדי לשמור אותו.');
        return;
    }
    const esc = c => { const s = String(c == null ? '' : c); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [raw.header, ...raw.rows].map(r => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `MyFitnessPal_full_${_blTodayStr()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    haptic('success');
}

// ─── KPIs ───────────────────────────────────────────────────────────────────
function _renderBodyKpis(log) {
    const el = document.getElementById('bodylog-kpis');
    if (!el) return;
    if (!log.length) {
        el.innerHTML = '<div class="bl-empty">אין עדיין שקילות. צלם שקילה או הזן ידנית כדי להתחיל.</div>';
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

    // נקודה נבחרת (לחיצה על הגרף) — קו אנכי + נקודה מודגשת
    const sel = (svgId in _blSel) ? _blSel[svgId] : -1;
    let selMark = '';
    if (sel >= 0 && sel < n) {
        const sx = pts[sel][0].toFixed(1), sy = pts[sel][1].toFixed(1);
        selMark = `<line x1="${sx}" y1="${pad.t}" x2="${sx}" y2="${(pad.t + cH).toFixed(1)}" stroke="rgba(232,234,237,0.45)" stroke-width="1"/>
                   <circle cx="${sx}" cy="${sy}" r="6" fill="#E8EAED" stroke="#fff" stroke-width="1.5"/>`;
    }

    svg.innerHTML = `
        <defs><linearGradient id="bl-grad-${svgId}" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#E8EAED"/><stop offset="100%" stop-color="transparent"/></linearGradient></defs>
        ${grid}
        <path d="${areaPath}" fill="url(#bl-grad-${svgId})" opacity="0.22"/>
        <path d="${linePath}" fill="none" stroke="#E8EAED" stroke-width="3" stroke-linecap="round"/>
        ${maPath}
        <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="5" fill="#E8EAED"/>
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
    if (!log.length) { el.innerHTML = ''; return; }
    const sorted = log.slice().sort((a, b) => a.date < b.date ? 1 : -1); // חדש→ישן
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
        document.getElementById('bl-entry-nutri').value = e.nutritionState || '';
        document.getElementById('bl-entry-note').value = e.note || '';
        document.getElementById('bl-entry-delete').style.display = 'block';
    } else {
        document.getElementById('bl-entry-title').textContent = 'שקילה חדשה';
        dateInput.value = today;
        weightInp.value = '';
        document.getElementById('bl-entry-fat').value = '';
        document.getElementById('bl-entry-nutri').value = '';
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
    const generationConfig = { temperature: 0.1, maxOutputTokens: 120, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } };
    let lastErr = '';
    for (const modelName of config.models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.apiKey}`;
            const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }) });
            if (!resp.ok) {
                if ([400, 404, 429, 503].includes(resp.status)) { lastErr = `${modelName}:${resp.status}`; continue; } // מודל לא תומך/עמוס — נסה הבא
                throw new Error('API_ERROR_' + resp.status);
            }
            const data = await resp.json();
            const txt = (data.candidates?.[0]?.content?.parts || []).find(p => !p.thought)?.text || '';
            const parsed = JSON.parse(txt);
            const w = (typeof parsed.weight === 'number') ? parsed.weight : null;
            const bf = (typeof parsed.bodyFat === 'number') ? parsed.bodyFat : null;
            return { weight: w, bodyFat: bf };
        } catch (e) { lastErr = e.message || String(e); }
    }
    throw new Error(lastErr || 'VISION_FAILED');
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
    let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
    if (m) { let y = m[3]; if (y.length === 2) y = '20' + y; return `${y}-${pad(m[2])}-${pad(m[1])}`; }
    m = raw.match(/^(\d{1,2})[.\/-](\d{1,2})$/);
    if (m) {
        // ללא שנה בקובץ — משלימים בשנה הנוכחית
        const y = new Date().getFullYear();
        return `${y}-${pad(m[2])}-${pad(m[1])}`;
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
    _blSyncCloud();
    showAlert(`יובאו ${count} שקילות בהצלחה.`);
}

// ─── ייצוא CSV ──────────────────────────────────────────────────────────────
function openBodyExportSheet() {
    const today = _blTodayStr();
    const s = document.getElementById('bl-export-start'), e = document.getElementById('bl-export-end');
    if (s) s.max = today;
    if (e) { e.max = today; e.value = today; }
    document.getElementById('bl-export-modal').style.display = 'flex';
}
function closeBodyExportModal() { document.getElementById('bl-export-modal').style.display = 'none'; }

function exportBodyCsv(range) {
    let log = StorageManager.getBodyLog().slice().sort((a, b) => a.date < b.date ? -1 : 1);
    if (range === 7 || range === 30) {
        const cutoff = _blCutoff(range);
        log = log.filter(e => e.date >= cutoff);
    } else if (range === 'custom') {
        const s = document.getElementById('bl-export-start').value;
        const en = document.getElementById('bl-export-end').value;
        if (!s || !en) { showAlert('בחר תאריך התחלה וסיום.'); return; }
        log = log.filter(e => e.date >= s && e.date <= en);
    }
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
    a.download = `gympro_weights_${_blTodayStr()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    closeBodyExportModal();
    haptic('success');
}
