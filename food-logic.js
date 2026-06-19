/**
 * GymPro Elite — Food Diary (יומן מזון מובנה)
 * מקור דאטה: Open Food Facts (חינמי, CORS ישיר). תיעוד מזון פנימי שמסכם כל יום
 * וכותב ל-KEY_NUTRITION_DAILY (דרך StorageManager.recomputeNutritionDay) — כך
 * כל הצינור הקיים (כרטיס בית, Composition, TDEE, AI) נדלק אוטומטית.
 *
 * עדיפות בהתנגשות: MFP מנצח — ראה recomputeNutritionDay ב-storage.js.
 */

// ── State ────────────────────────────────────────────────────────────
let _fdDate = null;           // יום היומן הנוכחי 'YYYY-MM-DD'
let _fdMeal = null;           // הארוחה שנבחרה לזרימת ההוספה
let _fdEditEntryId = null;    // עריכת רשומה קיימת (null = הוספה חדשה)
let _fdSelectedFood = null;   // המזון שנמצא בעורך המנה
let _fdSearchTimer = null;
let _fdSearchSeq = 0;         // מזהה רצף — מתעלם מתוצאות של בקשות שעבר זמנן
let _fdTab = 'recent';
let _fdFoodCache = {};        // id → food עבור הפריטים המוצגים כרגע

// ── Utils ────────────────────────────────────────────────────────────
function _fdNowTime() { const d = new Date(), p = x => String(x).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}`; }
function _fdNum(v) { const n = Number(v); return isFinite(n) ? n : null; }
function _fdR(v) { const n = Number(v); return isFinite(n) ? Math.round(n * 10) / 10 : 0; }
function _fdEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function _fdMealLabels() { return (getAnalyticsPrefs().mealLabels && getAnalyticsPrefs().mealLabels.length) ? getAnalyticsPrefs().mealLabels.slice() : ['בוקר', 'צהריים', 'ערב', 'נשנוש']; }

// פירוק גודל מנה (גרם) משדות OFF: serving_quantity מספרי, או "30 g" מתוך serving_size
function _fdParseServingGrams(qty, sizeStr) {
    const q = _fdNum(qty);
    if (q && q > 0) return q;
    const m = String(sizeStr || '').match(/([\d.]+)\s*(g|גרם|ml|מ"ל|מל)/i);
    if (m) { const n = parseFloat(m[1]); if (isFinite(n) && n > 0) return n; }
    return null;
}

// ── מיפוי מוצר OFF → אובייקט מזון מנורמל ─────────────────────────────
function _offToFood(p) {
    if (!p) return null;
    const n = p.nutriments || {};
    let kcal = _fdNum(n['energy-kcal_100g']);
    if (kcal == null && n['energy_100g'] != null) kcal = _fdNum(n['energy_100g']) / 4.184; // kJ→kcal
    if (kcal == null) return null;
    const name = String(p.product_name_he || p.product_name || '').trim();
    if (!name) return null;
    const grams = _fdParseServingGrams(p.serving_quantity, p.serving_size);
    const servings = [{ label: '100 גרם', grams: 100 }];
    if (grams) servings.unshift({ label: `מנה (${grams} ג')`, grams });
    return {
        id: p.code ? 'off:' + p.code : 'off:' + name.replace(/[^\w֐-׿]/g, '_'),
        name,
        brand: String(p.brands || '').split(',')[0].trim(),
        barcode: p.code || null,
        source: 'off',
        per100: { kcal: Math.round(kcal), p: _fdR(n.proteins_100g), c: _fdR(n.carbohydrates_100g), f: _fdR(n.fat_100g) },
        servings
    };
}

// ── מאגר חומרי גלם ישראלי מובנה (offline) ────────────────────────────
// Open Food Facts הוא מאגר מוצרים ארוזים — חסרים בו חומרי גלם בסיסיים.
// ערכים ל-100 גרם (חלק אכיל). s = מנה נפוצה אופציונלית (יחידה/כוס).
const _BASIC_RAW = [
    // עוף / בשר / דגים (נא, חלק אכיל)
    { n: 'חזה עוף', k: 120, p: 23, c: 0, f: 2.6 },
    { n: 'שוקיים עוף', k: 172, p: 18, c: 0, f: 10.5 },
    { n: 'כרעיים עוף', k: 177, p: 18, c: 0, f: 11 },
    { n: 'שניצל עוף (נא)', k: 120, p: 23, c: 0, f: 2.6 },
    { n: 'חזה הודו', k: 115, p: 24, c: 0, f: 1.7 },
    { n: 'הודו טחון', k: 150, p: 21, c: 0, f: 7 },
    { n: 'בשר בקר טחון 5%', k: 137, p: 21, c: 0, f: 5 },
    { n: 'בשר בקר טחון 15%', k: 215, p: 18, c: 0, f: 15 },
    { n: 'אנטריקוט בקר', k: 250, p: 19, c: 0, f: 19 },
    { n: 'סלמון', k: 208, p: 20, c: 0, f: 13 },
    { n: 'טונה (טרי)', k: 130, p: 28, c: 0, f: 1 },
    { n: 'טונה בשימור במים', k: 116, p: 26, c: 0, f: 1 },
    { n: 'ביצה', k: 143, p: 13, c: 1.1, f: 9.5, s: [{ label: 'ביצה (M, 50 ג\')', grams: 50 }] },
    { n: 'חלבון ביצה', k: 52, p: 11, c: 0.7, f: 0.2, s: [{ label: 'חלבון אחד (33 ג\')', grams: 33 }] },
    // חלב ומוצריו
    { n: 'חלב 3%', k: 60, p: 3.3, c: 4.7, f: 3, s: [{ label: 'כוס (240 מ"ל)', grams: 240 }] },
    { n: 'חלב 1%', k: 42, p: 3.4, c: 5, f: 1, s: [{ label: 'כוס (240 מ"ל)', grams: 240 }] },
    { n: 'יוגורט טבעי', k: 61, p: 3.5, c: 4.7, f: 3.3 },
    { n: 'גבינה לבנה 5%', k: 90, p: 10, c: 4, f: 5 },
    { n: 'גבינה לבנה 3%', k: 70, p: 10, c: 4, f: 3 },
    { n: 'קוטג\' 5%', k: 98, p: 11, c: 3, f: 5 },
    { n: 'גבינה צהובה', k: 350, p: 25, c: 2, f: 27 },
    { n: 'גבינת בולגרית 5%', k: 100, p: 13, c: 4, f: 5 },
    // פחמימות / דגנים (מבושל אלא אם צוין)
    { n: 'אורז לבן (מבושל)', k: 130, p: 2.7, c: 28, f: 0.3, s: [{ label: 'כוס (158 ג\')', grams: 158 }] },
    { n: 'אורז מלא (מבושל)', k: 112, p: 2.6, c: 24, f: 0.9 },
    { n: 'פסטה (מבושלת)', k: 131, p: 5, c: 25, f: 1.1 },
    { n: 'קוסקוס (מבושל)', k: 112, p: 3.8, c: 23, f: 0.2 },
    { n: 'קינואה (מבושלת)', k: 120, p: 4.4, c: 21, f: 1.9 },
    { n: 'שיבולת שועל (יבש)', k: 389, p: 17, c: 66, f: 7 },
    { n: 'תפוח אדמה (מבושל)', k: 87, p: 2, c: 20, f: 0.1 },
    { n: 'בטטה', k: 86, p: 1.6, c: 20, f: 0.1 },
    { n: 'לחם לבן', k: 265, p: 9, c: 49, f: 3.2, s: [{ label: 'פרוסה (28 ג\')', grams: 28 }] },
    { n: 'לחם מלא', k: 247, p: 13, c: 41, f: 3.4, s: [{ label: 'פרוסה (32 ג\')', grams: 32 }] },
    // קטניות
    { n: 'עדשים (מבושל)', k: 116, p: 9, c: 20, f: 0.4 },
    { n: 'חומוס גרגרים (מבושל)', k: 164, p: 9, c: 27, f: 2.6 },
    { n: 'שעועית לבנה (מבושל)', k: 127, p: 9, c: 23, f: 0.5 },
    { n: 'טופו', k: 76, p: 8, c: 1.9, f: 4.8 },
    { n: 'אדממה', k: 121, p: 12, c: 9, f: 5 },
    // ירקות (נא)
    { n: 'מלפפון', k: 15, p: 0.7, c: 3.6, f: 0.1 },
    { n: 'עגבנייה', k: 18, p: 0.9, c: 3.9, f: 0.2 },
    { n: 'חסה', k: 15, p: 1.4, c: 2.9, f: 0.2 },
    { n: 'גזר', k: 41, p: 0.9, c: 10, f: 0.2 },
    { n: 'בצל', k: 40, p: 1.1, c: 9, f: 0.1 },
    { n: 'פלפל אדום', k: 31, p: 1, c: 6, f: 0.3 },
    { n: 'ברוקולי', k: 34, p: 2.8, c: 7, f: 0.4 },
    { n: 'כרובית', k: 25, p: 1.9, c: 5, f: 0.3 },
    { n: 'קישוא', k: 17, p: 1.2, c: 3.1, f: 0.3 },
    { n: 'חציל', k: 25, p: 1, c: 6, f: 0.2 },
    { n: 'תרד', k: 23, p: 2.9, c: 3.6, f: 0.4 },
    { n: 'פטריות', k: 22, p: 3.1, c: 3.3, f: 0.3 },
    { n: 'אבוקדו', k: 160, p: 2, c: 9, f: 15, s: [{ label: 'חצי בינוני (100 ג\')', grams: 100 }] },
    // פירות
    { n: 'תפוח', k: 52, p: 0.3, c: 14, f: 0.2, s: [{ label: 'בינוני (180 ג\')', grams: 180 }] },
    { n: 'בננה', k: 89, p: 1.1, c: 23, f: 0.3, s: [{ label: 'בינונית (118 ג\')', grams: 118 }] },
    { n: 'תפוז', k: 47, p: 0.9, c: 12, f: 0.1 },
    { n: 'ענבים', k: 69, p: 0.7, c: 18, f: 0.2 },
    { n: 'תות', k: 32, p: 0.7, c: 7.7, f: 0.3 },
    { n: 'אבטיח', k: 30, p: 0.6, c: 8, f: 0.2 },
    { n: 'מלון', k: 34, p: 0.8, c: 8, f: 0.2 },
    { n: 'אגס', k: 57, p: 0.4, c: 15, f: 0.1 },
    { n: 'תמר', k: 282, p: 2.5, c: 75, f: 0.4, s: [{ label: 'תמר אחד (24 ג\')', grams: 24 }] },
    // אגוזים / שמנים / ממרחים
    { n: 'שקדים', k: 579, p: 21, c: 22, f: 50 },
    { n: 'אגוזי מלך', k: 654, p: 15, c: 14, f: 65 },
    { n: 'בוטנים', k: 567, p: 26, c: 16, f: 49 },
    { n: 'חמאת בוטנים', k: 588, p: 25, c: 20, f: 50, s: [{ label: 'כף (16 ג\')', grams: 16 }] },
    { n: 'טחינה גולמית', k: 595, p: 17, c: 21, f: 53, s: [{ label: 'כף (15 ג\')', grams: 15 }] },
    { n: 'שמן זית', k: 884, p: 0, c: 0, f: 100, s: [{ label: 'כף (14 ג\')', grams: 14 }] },
    { n: 'חמאה', k: 717, p: 0.9, c: 0.1, f: 81, s: [{ label: 'כף (14 ג\')', grams: 14 }] },
    { n: 'דבש', k: 304, p: 0.3, c: 82, f: 0, s: [{ label: 'כף (21 ג\')', grams: 21 }] },
    { n: 'סוכר', k: 387, p: 0, c: 100, f: 0, s: [{ label: 'כפית (4 ג\')', grams: 4 }] }
];
const BASIC_FOODS = _BASIC_RAW.map((x, i) => ({
    id: 'basic:' + i,
    name: x.n, brand: 'חומר גלם', barcode: null, source: 'basic',
    per100: { kcal: x.k, p: x.p, c: x.c, f: x.f },
    servings: (x.s || []).concat([{ label: '100 גרם', grams: 100 }])
}));

function _fdBasicMatches(q) {
    const s = String(q || '').trim();
    if (!s) return [];
    return BASIC_FOODS.filter(f => f.name.indexOf(s) >= 0);
}

function _fdDedup(list) {
    const seen = {}, out = [];
    list.forEach(f => { if (f && !seen[f.id]) { seen[f.id] = 1; out.push(f); } });
    return out;
}

// ── Open Food Facts: חיפוש + ברקוד ───────────────────────────────────
const _OFF_FIELDS = 'code,product_name,product_name_he,brands,nutriments,serving_size,serving_quantity';

// fetch עם timeout (AbortController) — מונע תקיעה שנראית כמו כשל
function _fdFetch(url, ms) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms || 12000);
    return fetch(url, { signal: ctrl.signal, headers: { 'Accept': 'application/json' } })
        .finally(() => clearTimeout(t));
}

// חיפוש: מנסה קודם את ה-API המודרני (search.openfoodfacts.org — בנוי ל-CORS),
// ובכשל נופל ל-search.pl הישן. מחזיר רשימת מזונות מנורמלת. זורק רק אם שניהם נכשלו.
async function searchFoods(q) {
    const enc = encodeURIComponent(q);
    // 1) Search-a-licious (CORS-first). תגובה: { hits: [...] }
    try {
        const url = `https://search.openfoodfacts.org/search?q=${enc}&page_size=25&` +
            `fields=${_OFF_FIELDS}&lang=he`;
        const resp = await _fdFetch(url);
        if (resp.ok) {
            const data = await resp.json();
            const arr = data.hits || data.products || [];
            const foods = arr.map(_offToFood).filter(Boolean);
            if (foods.length) return foods;
        }
    } catch (e) { /* נופל ל-legacy */ }
    // 2) Legacy search.pl. תגובה: { products: [...] }
    const url2 = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${enc}` +
        `&search_simple=1&action=process&json=1&page_size=25&fields=${_OFF_FIELDS}&lc=he`;
    const resp2 = await _fdFetch(url2);
    if (!resp2.ok) throw new Error('OFF_' + resp2.status);
    const data2 = await resp2.json();
    return (data2.products || []).map(_offToFood).filter(Boolean);
}

async function lookupBarcode(code) {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${_OFF_FIELDS}`;
    const resp = await _fdFetch(url);
    if (!resp.ok) throw new Error('OFF_' + resp.status);
    const d = await resp.json();
    if (d.status !== 1 || !d.product) return null;
    return _offToFood(Object.assign({ code }, d.product));
}

// ── Gemini Vision: קריאת תווית/ברקוד מתמונה (מיחזור התשתית מ-bodylog) ──
async function _callGeminiFood(base64, mimeType) {
    const config = StorageManager.getAIConfig();
    if (!config.apiKey) throw new Error('API_KEY_MISSING');
    const prompt = 'אתה קורא תווית ערך תזונתי או ברקוד ממוצר מזון בתמונה. החזר JSON בלבד: ' +
        '{"barcode": string|null, "name": string|null, "kcal": number|null, "protein": number|null, "carbs": number|null, "fat": number|null, "per": "100g"|"serving"|null}. ' +
        'אם רואים ברקוד (EAN/UPC) — החזר אותו ב-barcode (ספרות בלבד). אחרת קרא את ערכי התזונה: ' +
        'kcal/protein/carbs/fat, וציין ב-per אם הם ל-100 גרם או למנה. ערך לא קריא = null. אל תוסיף טקסט.';
    const parts = [{ text: prompt }, { inlineData: { mimeType, data: base64 } }];
    const generationConfig = { temperature: 0.1, maxOutputTokens: 200, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } };
    let lastErr = '';
    for (const modelName of config.models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.apiKey}`;
            const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }) });
            if (!resp.ok) { if ([400, 404, 429, 503].includes(resp.status)) { lastErr = `${modelName}:${resp.status}`; continue; } throw new Error('API_ERROR_' + resp.status); }
            const data = await resp.json();
            const txt = (data.candidates?.[0]?.content?.parts || []).find(p => !p.thought)?.text || '';
            return JSON.parse(txt);
        } catch (e) { lastErr = e.message || String(e); }
    }
    throw new Error(lastErr || 'VISION_FAILED');
}

// ════════ DIARY OVERLAY ════════
function openFoodDiary(date) {
    _fdDate = date || _blTodayStr();
    const ov = document.getElementById('food-diary');
    if (!ov) return;
    ov.style.display = 'flex';
    document.body.classList.add('fd-open');
    fdRender();
    haptic('light');
}

function closeFoodDiary() {
    const ov = document.getElementById('food-diary');
    if (ov) ov.style.display = 'none';
    document.body.classList.remove('fd-open');
    // ריענון הצרכנים של הסיכום היומי
    try { if (typeof renderHomeTodayCards === 'function') renderHomeTodayCards(); } catch (e) {}
    try { if (typeof _refreshActiveView === 'function') _refreshActiveView(); } catch (e) {}
}

function fdShiftDay(n) {
    const next = _addDays(_fdDate, n);
    if (next > _blTodayStr()) return;
    _fdDate = next; fdRender(); haptic('light');
}
function fdSetDate(v) { if (v && v <= _blTodayStr()) { _fdDate = v; fdRender(); } }
function fdOpenDatePicker() {
    const i = document.getElementById('fd-date-input');
    if (!i) return;
    i.value = _fdDate; i.max = _blTodayStr();
    if (i.showPicker) { try { i.showPicker(); return; } catch (e) {} }
    i.click();
}

function _fdDateLabel(d) {
    const today = _blTodayStr();
    if (d === today) return 'היום';
    if (d === _addDays(today, -1)) return 'אתמול';
    const p = d.split('-');
    return `${p[2]}.${p[1]}`;
}

// ── רינדור היומן ─────────────────────────────────────────────────────
function fdRender() {
    const lbl = document.getElementById('fd-date-label');
    if (lbl) lbl.textContent = _fdDateLabel(_fdDate);
    const nextBtn = document.getElementById('fd-day-next');
    if (nextBtn) nextBtn.disabled = _fdDate >= _blTodayStr();

    const scroll = document.getElementById('fd-scroll');
    if (!scroll) return;
    const entries = StorageManager.getFoodLogDay(_fdDate);
    const daily = (StorageManager.getNutritionDaily() || []).find(d => d.date === _fdDate);
    const mfpOwned = daily && (daily.src == null || daily.src === 'mfp');

    // ── סיכום: מ-MFP אם הוא הבעלים, אחרת מסכום הרשומות ──
    const sum = entries.reduce((a, e) => { a.kcal += +e.kcal || 0; a.p += +e.p || 0; a.c += +e.c || 0; a.f += +e.f || 0; return a; }, { kcal: 0, p: 0, c: 0, f: 0 });
    const totals = mfpOwned
        ? { kcal: daily.calories || 0, p: daily.protein || 0, c: daily.carbs || 0, f: daily.fat || 0 }
        : sum;

    scroll.innerHTML = _fdSummaryHTML(totals, mfpOwned) + _fdMealsHTML(entries, mfpOwned);
}

function _fdSummaryHTML(t, mfpOwned) {
    const prefs = getAnalyticsPrefs();
    const kcalT = Number(prefs.kcalTarget) || 0;
    const macroRow = (lbl, val, target, cls) => {
        const pct = target > 0 ? Math.min(100, Math.round(val / target * 100)) : 0;
        const rem = target > 0 ? Math.round(target - val) : null;
        return `<div class="fd-macro">
            <div class="fd-macro-top"><span class="fd-macro-lbl">${lbl}</span>
              <span class="fd-macro-val ${cls}">${Math.round(val)}${target > 0 ? ` / ${target}` : ''}<small>g</small></span></div>
            <div class="fd-macro-bar"><span class="fd-macro-fill ${cls}" style="width:${pct}%"></span></div>
            ${rem != null ? `<span class="fd-macro-rem">${rem >= 0 ? rem + ' נותרו' : Math.abs(rem) + ' מעל'}</span>` : ''}
        </div>`;
    };
    const kcalRem = kcalT > 0 ? Math.round(kcalT - t.kcal) : null;
    return `<div class="fd-summary">
        <div class="fd-kcal">
            <span class="fd-kcal-num">${Math.round(t.kcal)}</span>
            <span class="fd-kcal-unit">kcal</span>
            ${kcalRem != null ? `<span class="fd-kcal-rem ${kcalRem >= 0 ? 'left' : 'over'}">${kcalRem >= 0 ? kcalRem + ' נותרו' : Math.abs(kcalRem) + ' מעל היעד'}</span>` : ''}
        </div>
        <div class="fd-macros">
            ${macroRow('חלבון', t.p, Number(getAnalyticsPrefs().proteinTarget) || 0, 'macro-p')}
            ${macroRow('פחמימה', t.c, Number(getAnalyticsPrefs().carbsTarget) || 0, 'macro-c')}
            ${macroRow('שומן', t.f, Number(getAnalyticsPrefs().fatTarget) || 0, 'macro-f')}
        </div>
        ${mfpOwned ? '<div class="fd-mfp-note"><span class="material-symbols-outlined">info</span>הסיכום היומי מקורו ב-MyFitnessPal וגובר על תיעוד פנימי</div>' : ''}
    </div>`;
}

function _fdMealsHTML(entries, mfpOwned) {
    // קיבוץ לפי ארוחה: קודם הארוחות המוגדרות, אחר כך ארוחות חופשיות שהופיעו
    const order = _fdMealLabels();
    const used = Array.from(new Set(entries.map(e => e.meal)));
    used.forEach(m => { if (order.indexOf(m) < 0) order.push(m); });

    let html = '';
    order.forEach(meal => {
        const items = entries.filter(e => e.meal === meal);
        if (!items.length && used.indexOf(meal) < 0 && order.indexOf(meal) >= _fdMealLabels().length) return;
        const mt = items.reduce((s, e) => s + (+e.kcal || 0), 0);
        html += `<div class="fd-meal">
            <div class="fd-meal-hdr">
                <span class="fd-meal-name">${_fdEsc(meal)}</span>
                <span class="fd-meal-kcal">${Math.round(mt)} kcal</span>
                <button class="fd-meal-add" onclick="fdOpenAdd('${_fdEsc(meal).replace(/'/g, '')}')"><span class="material-symbols-outlined">add</span></button>
            </div>`;
        if (items.length) {
            html += items.map(e => `
                <button class="fd-entry" onclick="fdEditEntry('${e.id}')">
                    <div class="fd-entry-main">
                        <span class="fd-entry-name">${_fdEsc(e.name)}</span>
                        <span class="fd-entry-sub">${_fdEsc(_fdPortionLabel(e))}${e.time ? ' · ' + _fdEsc(e.time) : ''}${e.brand ? ' · ' + _fdEsc(e.brand) : ''}</span>
                    </div>
                    <div class="fd-entry-macros">
                        <span class="fd-entry-kcal">${Math.round(e.kcal)}</span>
                        <span class="fd-entry-pcf">P${Math.round(e.p)} C${Math.round(e.c)} F${Math.round(e.f)}</span>
                    </div>
                </button>`).join('');
        } else {
            html += '<div class="fd-meal-empty">אין רשומות</div>';
        }
        html += '</div>';
    });
    // הוספת ארוחה חופשית חדשה
    html += `<button class="fd-add-meal" onclick="fdAddCustomMeal()"><span class="material-symbols-outlined">add</span>ארוחה חדשה</button>`;
    return html;
}

function _fdPortionLabel(e) {
    if (e.unit === 'serving') return `${_fdR(e.qty)} מנות`;
    return `${_fdR(e.qty)} ${e.unit === 'ml' ? 'מ"ל' : 'ג\''}`;
}

// הוספת שם ארוחה חופשי (ארוחת ביניים) — input inline בתוך שיט קטן
function fdAddCustomMeal() {
    _fdMeal = '';
    _fdEditEntryId = null;
    _fdShowMealNamePrompt();
}

// ════════ ADD SHEET ════════
function fdOpenAdd(meal) {
    _fdMeal = meal || _fdMealLabels()[0];
    _fdEditEntryId = null;
    const s = document.getElementById('fd-search'); if (s) s.value = '';
    document.getElementById('fd-add-overlay').style.display = 'block';
    document.getElementById('fd-add-sheet').classList.add('open');
    const t = document.getElementById('fd-add-meal-name');
    if (t) t.textContent = meal || _fdMeal;
    _fdAttachScrollBlur();
    fdSetTab('recent');
    haptic('light');
}

// הסתרת המקלדת בעת גלילת רשימת התוצאות — חשוב ל-UI במובייל
function _fdAttachScrollBlur() {
    const box = document.getElementById('fd-results');
    if (!box || box.dataset.blurBound) return;
    const blur = () => {
        const s = document.getElementById('fd-search');
        if (s && document.activeElement === s) s.blur();
    };
    box.addEventListener('scroll', blur, { passive: true });
    box.addEventListener('touchmove', blur, { passive: true });
    box.dataset.blurBound = '1';
}
function closeFoodAdd() {
    document.getElementById('fd-add-overlay').style.display = 'none';
    document.getElementById('fd-add-sheet').classList.remove('open');
}

function fdSetTab(tab, el) {
    _fdTab = tab;
    document.querySelectorAll('#fd-tabs .fd-tab').forEach(b => b.classList.toggle('active', b.dataset.fdtab === tab));
    fdRenderTab();
}

function fdRenderTab() {
    const box = document.getElementById('fd-results');
    if (!box) return;
    let foods = [];
    if (_fdTab === 'recent') foods = StorageManager.recentFoods(30);
    else if (_fdTab === 'fav') foods = StorageManager.favoriteFoods();
    else if (_fdTab === 'custom') foods = StorageManager.customFoods();
    if (!foods.length) {
        box.innerHTML = `<div class="fd-empty">${_fdTab === 'recent' ? 'אין עדיין מזונות אחרונים — חפש מוצר למעלה' : _fdTab === 'fav' ? 'אין מועדפים. סמן ⭐ על מזון' : 'אין מזונות מותאמים. צור באמצעות הכפתור למטה'}</div>`;
        return;
    }
    _fdRenderFoodList(foods, box);
}

function fdOnSearchInput(q) {
    clearTimeout(_fdSearchTimer);
    q = (q || '').trim();
    if (!q) { fdRenderTab(); return; }
    if (q.length < 2) {  // תו בודד — לא מחפשים עדיין (מונע 400 ורעש)
        const box = document.getElementById('fd-results');
        if (box) box.innerHTML = '<div class="fd-empty">הקלד לפחות 2 תווים…</div>';
        return;
    }
    _fdSearchTimer = setTimeout(() => fdDoSearch(q), 350);
}

async function fdDoSearch(q) {
    const box = document.getElementById('fd-results');
    if (!box) return;
    const seq = ++_fdSearchSeq;   // הבקשה הנוכחית; תוצאה ישנה תזוהה ותידחה
    // חומרי גלם מובנים (offline) + תוצאות שמורות — מוצגים מיידית בראש
    const basics = _fdBasicMatches(q);
    const local = StorageManager.getFoodDb().filter(f => f.name && f.name.includes(q));
    const immediate = _fdDedup(basics.concat(local));
    if (immediate.length) _fdRenderFoodList(immediate, box);
    else box.innerHTML = '<div class="fd-loading">מחפש ב-Open Food Facts…</div>';

    try {
        const foods = await searchFoods(q);
        if (seq !== _fdSearchSeq) return;   // בקשה חדשה יותר כבר רצה — התעלם
        foods.forEach(f => StorageManager.upsertFoodToDb(f));   // קאש לשימוש עתידי
        // חומרי גלם בראש, אחריהם תוצאות OFF (ללא כפילויות)
        const merged = _fdDedup(basics.concat(foods));
        if (merged.length) _fdRenderFoodList(merged, box);
        else if (!immediate.length) box.innerHTML = '<div class="fd-empty">לא נמצאו תוצאות. נסה שם אחר או צור מזון מותאם.</div>';
    } catch (e) {
        if (seq !== _fdSearchSeq) return;   // כשל של בקשה ישנה — אל תדרוס תוצאות חדשות
        if (!immediate.length) {
            const offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
            box.innerHTML = `<div class="fd-empty">${offline ? 'אין חיבור לרשת — חבר רשת ונסה שוב' : 'החיפוש נכשל — נסה שוב, או הוסף מזון מותאם'}</div>`;
        }
        // אם כבר מוצגות תוצאות (חומרי גלם/שמורות) — לא מציגים באנר כשל בכלל
    }
}

function _fdRenderFoodList(foods, box, append) {
    if (!append) _fdFoodCache = {};
    foods.forEach(f => { _fdFoodCache[f.id] = f; });
    const html = foods.map(f => `
        <button class="fd-food-row" onclick="fdSelectFoodById('${_fdEsc(f.id)}')">
            <div class="fd-food-main">
                <span class="fd-food-name">${_fdEsc(f.name)}</span>
                <span class="fd-food-sub">${f.brand ? _fdEsc(f.brand) + ' · ' : ''}${Math.round(f.per100.kcal)} kcal / 100g</span>
            </div>
            <span class="fd-food-star ${f.favorite ? 'on' : ''}" role="button" onclick="event.stopPropagation();fdToggleFav('${_fdEsc(f.id)}',this)">${f.favorite ? '★' : '☆'}</span>
        </button>`).join('');
    box.innerHTML = (append ? box.innerHTML : '') + html;
}

function fdToggleFav(id, el) {
    const on = StorageManager.toggleFavoriteFood(id);
    if (_fdFoodCache[id]) _fdFoodCache[id].favorite = on;
    if (el) { el.textContent = on ? '★' : '☆'; el.classList.toggle('on', on); }
    haptic('light');
}

function fdSelectFoodById(id) {
    const food = _fdFoodCache[id] || StorageManager.getFoodDb().find(f => f.id === id);
    if (!food) return;
    StorageManager.upsertFoodToDb(food);
    _fdOpenPortion(food, null);
}

// ════════ PORTION EDITOR ════════
function _fdOpenPortion(food, entry) {
    _fdSelectedFood = food;
    _fdEditEntryId = entry ? entry.id : null;
    const sheet = document.getElementById('fd-portion-sheet');
    const body = document.getElementById('fd-portion-body');
    if (!sheet || !body) return;

    const servings = (food.servings && food.servings.length) ? food.servings : [{ label: '100 גרם', grams: 100 }];
    const unitOpts = servings.map((s, i) => `<option value="s${i}">${_fdEsc(s.label)}</option>`).join('')
        + '<option value="g">גרם</option>';
    const qty = entry ? entry.qty : (servings[0].grams && servings[0].grams !== 100 ? 1 : 100);
    const unit = entry ? (entry.unit === 'serving' ? 's0' : 'g') : (servings[0].grams && servings[0].grams !== 100 ? 's0' : 'g');
    const time = entry ? entry.time : _fdNowTime();
    const meals = _fdMealLabels();
    if (entry && meals.indexOf(entry.meal) < 0) meals.push(entry.meal);
    const curMeal = entry ? entry.meal : _fdMeal;

    body.innerHTML = `
        <div class="fd-portion-title">${_fdEsc(food.name)}${food.brand ? `<small>${_fdEsc(food.brand)}</small>` : ''}</div>
        <div class="fd-portion-row">
            <label class="fd-field"><span>כמות</span><input type="number" id="fd-qty" inputmode="decimal" min="0" step="any" value="${qty}" oninput="_fdUpdatePreview()"></label>
            <label class="fd-field"><span>יחידה</span><select id="fd-unit" onchange="_fdUpdatePreview()">${unitOpts}</select></label>
            <label class="fd-field"><span>שעה</span><input type="time" id="fd-time" value="${time}"></label>
        </div>
        <div class="fd-meal-chips" id="fd-meal-chips">
            ${meals.map(m => `<button class="fd-chip ${m === curMeal ? 'active' : ''}" data-meal="${_fdEsc(m)}" onclick="_fdPickMeal(this)">${_fdEsc(m)}</button>`).join('')}
            <button class="fd-chip fd-chip--add" onclick="_fdShowMealNamePrompt()">+</button>
        </div>
        <div class="fd-preview" id="fd-preview"></div>
        <div class="fd-portion-actions">
            ${_fdEditEntryId ? `<button class="fd-del-btn" onclick="fdDeleteCurrentEntry()"><span class="material-symbols-outlined">delete</span></button>` : ''}
            <button class="fd-save-btn" onclick="fdSavePortion()">${_fdEditEntryId ? 'עדכן' : 'הוסף ליומן'}</button>
        </div>`;
    // unit ברירת מחדל
    const us = document.getElementById('fd-unit'); if (us) us.value = unit;
    _fdMeal = curMeal;
    document.getElementById('fd-portion-overlay').style.display = 'block';
    sheet.classList.add('open');
    _fdUpdatePreview();
}

function _fdPickMeal(el) {
    _fdMeal = el.dataset.meal;
    document.querySelectorAll('#fd-meal-chips .fd-chip').forEach(c => c.classList.toggle('active', c === el));
}

function _fdComputeGrams() {
    const qty = Number(document.getElementById('fd-qty').value) || 0;
    const unitSel = document.getElementById('fd-unit').value;
    if (unitSel === 'g') return { grams: qty, unit: 'g', qtyVal: qty };
    const idx = parseInt(unitSel.slice(1), 10);
    const serv = (_fdSelectedFood.servings || [])[idx] || { grams: 100 };
    return { grams: (serv.grams || 100) * qty, unit: 'serving', qtyVal: qty, gramsPerUnit: serv.grams };
}

function _fdMacrosFor(grams) {
    const p100 = _fdSelectedFood.per100;
    const f = grams / 100;
    return { kcal: Math.round(p100.kcal * f), p: _fdR(p100.p * f), c: _fdR(p100.c * f), f: _fdR(p100.f * f) };
}

function _fdUpdatePreview() {
    const prev = document.getElementById('fd-preview');
    if (!prev || !_fdSelectedFood) return;
    const g = _fdComputeGrams();
    const m = _fdMacrosFor(g.grams);
    prev.innerHTML = `<span class="fd-preview-kcal">${m.kcal}<small>kcal</small></span>
        <span class="fd-preview-pcf">חלבון ${m.p}g · פחמימה ${m.c}g · שומן ${m.f}g</span>
        <span class="fd-preview-g">${Math.round(g.grams)} גרם</span>`;
}

function fdSavePortion() {
    if (!_fdSelectedFood) return;
    const g = _fdComputeGrams();
    const m = _fdMacrosFor(g.grams);
    const time = document.getElementById('fd-time').value || _fdNowTime();
    const food = _fdSelectedFood;
    const entry = {
        name: food.name, brand: food.brand || '', source: food.source || 'off', barcode: food.barcode || null,
        meal: _fdMeal || _fdMealLabels()[0], time,
        qty: g.qtyVal, unit: g.unit, gramsPerUnit: g.gramsPerUnit || null,
        per100: food.per100, kcal: m.kcal, p: m.p, c: m.c, f: m.f
    };
    if (_fdEditEntryId) {
        StorageManager.updateFoodEntry(_fdDate, _fdEditEntryId, entry);
    } else {
        StorageManager.addFoodEntry(_fdDate, entry);
        if (food.id) StorageManager.bumpFoodUsage(food.id);
    }
    closeFoodPortion();
    closeFoodAdd();
    fdRender();
    haptic('medium');
}

function closeFoodPortion() {
    document.getElementById('fd-portion-overlay').style.display = 'none';
    document.getElementById('fd-portion-sheet').classList.remove('open');
}

function fdEditEntry(id) {
    const entry = StorageManager.getFoodLogDay(_fdDate).find(e => e.id === id);
    if (!entry) return;
    // שחזור אובייקט מזון מתוך הרשומה
    const servings = entry.gramsPerUnit ? [{ label: `מנה (${entry.gramsPerUnit} ג')`, grams: entry.gramsPerUnit }, { label: '100 גרם', grams: 100 }] : [{ label: '100 גרם', grams: 100 }];
    const food = { id: entry.barcode ? 'off:' + entry.barcode : 'log:' + id, name: entry.name, brand: entry.brand, barcode: entry.barcode, source: entry.source, per100: entry.per100, servings };
    _fdOpenPortion(food, entry);
}

function fdDeleteCurrentEntry() {
    if (!_fdEditEntryId) return;
    StorageManager.deleteFoodEntry(_fdDate, _fdEditEntryId);
    closeFoodPortion();
    fdRender();
    haptic('warning');
}

// ── מזון מותאם (custom) ──────────────────────────────────────────────
function fdNewCustomFood() {
    const sheet = document.getElementById('fd-portion-sheet');
    const body = document.getElementById('fd-portion-body');
    if (!sheet || !body) return;
    _fdEditEntryId = null;
    _fdSelectedFood = null;
    const meals = _fdMealLabels();
    body.innerHTML = `
        <div class="fd-portion-title">מזון מותאם</div>
        <label class="fd-field fd-field--full"><span>שם</span><input type="text" id="fd-c-name" placeholder="לדוגמה: חביתה ביתית"></label>
        <div class="fd-portion-row">
            <label class="fd-field"><span>קלוריות / 100g</span><input type="number" id="fd-c-kcal" inputmode="decimal" min="0"></label>
            <label class="fd-field"><span>חלבון</span><input type="number" id="fd-c-p" inputmode="decimal" min="0"></label>
        </div>
        <div class="fd-portion-row">
            <label class="fd-field"><span>פחמימה</span><input type="number" id="fd-c-c" inputmode="decimal" min="0"></label>
            <label class="fd-field"><span>שומן</span><input type="number" id="fd-c-f" inputmode="decimal" min="0"></label>
        </div>
        <div class="fd-meal-chips" id="fd-meal-chips">
            ${meals.map((m, i) => `<button class="fd-chip ${i === 0 ? 'active' : ''}" data-meal="${_fdEsc(m)}" onclick="_fdPickMeal(this)">${_fdEsc(m)}</button>`).join('')}
        </div>
        <div class="fd-portion-actions">
            <button class="fd-save-btn" onclick="fdSaveCustomFood()">המשך</button>
        </div>`;
    _fdMeal = meals[0];
    document.getElementById('fd-portion-overlay').style.display = 'block';
    sheet.classList.add('open');
}

function fdSaveCustomFood() {
    const name = (document.getElementById('fd-c-name').value || '').trim();
    const kcal = _fdNum(document.getElementById('fd-c-kcal').value);
    if (!name) { showAlert('הזן שם למזון.'); return; }
    if (kcal == null) { showAlert('הזן לפחות קלוריות ל-100 גרם.'); return; }
    const food = {
        id: 'custom:' + Date.now().toString(36),
        name, brand: '', barcode: null, source: 'custom',
        per100: { kcal: Math.round(kcal), p: _fdR(document.getElementById('fd-c-p').value), c: _fdR(document.getElementById('fd-c-c').value), f: _fdR(document.getElementById('fd-c-f').value) },
        servings: [{ label: '100 גרם', grams: 100 }]
    };
    StorageManager.upsertFoodToDb(food);
    _fdOpenPortion(food, null);  // פותח את עורך המנה עבור המזון החדש
}

// ── שם ארוחה חופשי (ארוחת ביניים) ───────────────────────────────────
function _fdShowMealNamePrompt() {
    const sheet = document.getElementById('fd-portion-sheet');
    const body = document.getElementById('fd-portion-body');
    if (!sheet || !body) return;
    body.innerHTML = `
        <div class="fd-portion-title">ארוחה חדשה</div>
        <label class="fd-field fd-field--full"><span>שם הארוחה</span><input type="text" id="fd-meal-name-input" placeholder="לדוגמה: ארוחת ביניים, לפני אימון"></label>
        <div class="fd-portion-actions">
            <button class="fd-save-btn" onclick="fdConfirmMealName()">המשך להוספת מזון</button>
        </div>`;
    document.getElementById('fd-portion-overlay').style.display = 'block';
    sheet.classList.add('open');
    setTimeout(() => { const i = document.getElementById('fd-meal-name-input'); if (i) i.focus(); }, 100);
}

function fdConfirmMealName() {
    const name = (document.getElementById('fd-meal-name-input').value || '').trim();
    if (!name) { showAlert('הזן שם לארוחה.'); return; }
    // שמירת התווית לרשימת הארוחות אם חדשה
    const prefs = getAnalyticsPrefs();
    const labels = (prefs.mealLabels && prefs.mealLabels.length) ? prefs.mealLabels : ['בוקר', 'צהריים', 'ערב', 'נשנוש'];
    if (labels.indexOf(name) < 0) { labels.push(name); prefs.mealLabels = labels; saveAnalyticsPrefs(prefs); }
    closeFoodPortion();
    fdOpenAdd(name);
}

// ════════ BARCODE / PHOTO (Gemini) ════════
function fdScanPhoto() {
    if (!StorageManager.getAIConfig().apiKey) {
        showAlert('לקריאת תווית/ברקוד מתמונה נדרש מפתח Gemini (הגדרות → AI Coach).');
        return;
    }
    document.getElementById('fd-cam-input').click();
}

function fdOnPhoto(file) {
    if (!file) return;
    const box = document.getElementById('fd-results');
    if (box) box.innerHTML = '<div class="fd-loading">📷 קורא את התווית/ברקוד…</div>';
    _fileToBase64(file).then(({ base64, mime }) => _callGeminiFood(base64, mime)).then(async res => {
        // אם זוהה ברקוד — חיפוש ב-OFF
        if (res && res.barcode && /^\d{6,}$/.test(String(res.barcode))) {
            try {
                const food = await lookupBarcode(String(res.barcode).replace(/\D/g, ''));
                if (food) { StorageManager.upsertFoodToDb(food); _fdOpenPortion(food, null); return; }
            } catch (e) {}
        }
        // אחרת — בניית מזון חד-פעמי מערכי התווית
        if (res && res.kcal != null) {
            const isServing = res.per === 'serving';
            const per100 = isServing
                ? { kcal: Math.round(res.kcal), p: _fdR(res.protein), c: _fdR(res.carbs), f: _fdR(res.fat) } // נניח מנה≈100g כברירת מחדל; המשתמש יתקן
                : { kcal: Math.round(res.kcal), p: _fdR(res.protein), c: _fdR(res.carbs), f: _fdR(res.fat) };
            const food = { id: 'gemini:' + Date.now().toString(36), name: res.name || 'מזון מהתמונה', brand: '', barcode: res.barcode ? String(res.barcode) : null, source: 'gemini', per100, servings: [{ label: '100 גרם', grams: 100 }] };
            StorageManager.upsertFoodToDb(food);
            _fdOpenPortion(food, null);
            return;
        }
        if (box) box.innerHTML = '<div class="fd-empty">⚠ לא זוהו ערכים מהתמונה — חפש ידנית או צור מזון מותאם.</div>';
    }).catch(() => {
        if (box) box.innerHTML = '<div class="fd-empty">⚠ קריאת התמונה נכשלה — חפש ידנית.</div>';
    });
}
