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
let _fdLastQuery = '';        // השאילתה האחרונה שהוצגה (עבור fallback של AI)
let _fdLastFoods = [];        // התוצאות שהוצגו אחרונות (כדי לשרשר מעליהן הערכת AI)
let _fdPhotoMode = 'label';   // 'label' = ברקוד/תווית | 'meal' = הערכת מנה מצילום
let _fdMealComponents = [];   // Meal Builder — מרכיבי המנה {name, grams, per100}
let _fdMealEditId = null;     // עריכת רשומת composite קיימת
let _fdCompPickMode = false;  // מצב "בחירת מרכיב מהמאגר" — בחירה בחיפוש מוסיפה כמרכיב במקום לפתוח עורך
let _fdEditCustomFoodId = null;  // עריכת מזון מותאם קיים (null = יצירת מזון מותאם חדש)

// ── Utils ────────────────────────────────────────────────────────────
function _fdNowTime() { const d = new Date(), p = x => String(x).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}`; }
function _fdNum(v) { const n = Number(v); return isFinite(n) ? n : null; }
function _fdR(v) { const n = Number(v); return isFinite(n) ? Math.round(n * 10) / 10 : 0; }
// בדיקת התאמה בין קלוריות מוצהרות לחישוב מאקרו (Atwater: חלבון/פחמימה=4, שומן=9)
// מחזיר null אם אין סטייה משמעותית, או יחס הסטייה (0–1+) אם יש
function _fdKcalMismatch(kcal, p, c, f) {
    const calc = p * 4 + c * 4 + f * 9;
    if (kcal < 30 || calc < 30) return null;   // רף מוחלט — מונע רעש מעיגול בכמויות/ערכים זעירים
    const ratio = Math.abs(kcal - calc) / Math.max(kcal, calc);
    return ratio > 0.15 ? ratio : null;
}
function _fdEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const _FD_DEFAULT_MEALS = ['בוקר', 'צהריים', 'ערב', 'נשנוש'];
const _FD_MEAL_ICONS = { 'בוקר': 'wb_twilight', 'צהריים': 'lunch_dining', 'ערב': 'dinner_dining', 'נשנוש': 'cookie' };
// גוון אקצנט עדין (saturation נמוך) לכל ארוחת ברירת מחדל — לאבחנה ויזואלית. ארוחה מותאמת → var(--accent).
const _FD_MEAL_ACCENT = { 'בוקר': '#E0A93A', 'צהריים': '#5CC48A', 'ערב': '#6E84E0', 'נשנוש': '#B06EE0' };
function _fdMealIcon(m) { return _FD_MEAL_ICONS[m] || 'restaurant'; }
function _fdMealLabels() { return (getAnalyticsPrefs().mealLabels && getAnalyticsPrefs().mealLabels.length) ? getAnalyticsPrefs().mealLabels.slice() : _FD_DEFAULT_MEALS.slice(); }

// שורת צ'יפים של ארוחות — לארוחות מותאמות (לא ברירת מחדל) מתווסף × למחיקה
function _fdMealChipsHTML(curMeal) {
    const meals = _fdMealLabels();
    if (curMeal && meals.indexOf(curMeal) < 0) meals.push(curMeal);
    return meals.map(m => {
        const x = _FD_DEFAULT_MEALS.indexOf(m) < 0
            ? `<span class="fd-chip-x" onclick="event.stopPropagation();fdDeleteMeal(this)">×</span>` : '';
        return `<button class="fd-chip ${m === curMeal ? 'active' : ''}" data-meal="${_fdEsc(m)}" onclick="_fdPickMeal(this)">${_fdEsc(m)}${x}</button>`;
    }).join('') + `<button class="fd-chip fd-chip--add" onclick="_fdShowMealNamePrompt()">+</button>`;
}

// מחיקת ארוחה מותאמת מרשימת הארוחות (לא מוחק רשומות קיימות).
// el = הכפתור/× עצמו (data-meal), או צאצא של אלמנט עם data-meal (צ'יפ/כותרת ארוחה).
function fdDeleteMeal(el) {
    const host = (el.dataset && el.dataset.meal) ? el : el.closest('[data-meal]');
    const name = host ? host.dataset.meal : null;
    if (!name || _FD_DEFAULT_MEALS.indexOf(name) >= 0) return;
    showConfirm(`למחוק את הארוחה "${name}" מהרשימה? (רשומות קיימות יישמרו)`, () => {
        const prefs = getAnalyticsPrefs();
        prefs.mealLabels = (prefs.mealLabels || _FD_DEFAULT_MEALS.slice()).filter(m => m !== name);
        saveAnalyticsPrefs(prefs);
        if (_fdMeal === name) _fdMeal = _fdMealLabels()[0];
        document.querySelectorAll('.fd-meal-chips').forEach(w => { w.innerHTML = _fdMealChipsHTML(_fdMeal); });
        if (typeof fdRender === 'function') fdRender();
        haptic('light');
    });
}

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

// נרמול לחיפוש — trim + הסרת ניקוד/טעמים עבריים
function _fdNorm(s) { return String(s || '').trim().replace(/[֑-ׇ]/g, ''); }

// התאמה גמישה: substring רציף, או טוקן בודד מהשאילתה שמופיע בשם.
// ("גרעיני תירס" יתפוס פריט "תירס"; ריבוי מילים לא מחמיץ בגלל סדר)
function _fdTokenMatch(name, q) {
    const n = _fdNorm(name), s = _fdNorm(q);
    if (!s) return false;
    if (n.indexOf(s) >= 0) return true;
    const toks = s.split(/\s+/).filter(t => t.length >= 2);
    return toks.length ? toks.some(t => n.indexOf(t) >= 0) : false;
}

function _fdBasicMatches(q) {
    if (!_fdNorm(q)) return [];
    return BASIC_FOODS.filter(f => _fdTokenMatch(f.name, q));
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

// חיפוש מאוחד: Open Food Facts (מוצרים ארוזים) + USDA (חומרי גלם/גנרי, אם הוגדר מפתח),
// במקביל. מחזיר רשימה ממוזגת; זורק רק אם כל המקורות נכשלו וגם אין תוצאות.
// חיפוש מאוחד: צמ"ת (גנרי עברי רשמי) + Open Food Facts (מוצרים ארוזים) +
// USDA (אם הוגדר מפתח), במקביל. מחזיר רשימה ממוזגת; זורק רק אם כל המקורות נכשלו וגם אין תוצאות.
async function searchFoods(q) {
    const [tzRes, offRes, usdaRes] = await Promise.allSettled([searchTzameret(q), _searchOFF(q), searchUSDA(q)]);
    const tz   = tzRes.status   === 'fulfilled' ? tzRes.value   : [];
    const off  = offRes.status  === 'fulfilled' ? offRes.value  : [];
    const usda = usdaRes.status === 'fulfilled' ? usdaRes.value : [];
    // צמ"ת בראש (גנרי עברי מדויק), אחריו OFF (ארוזים), אחריו USDA
    const merged = _fdDedup(tz.concat(off).concat(usda));
    if (merged.length) return merged;
    // כולם ריקים: זרוק רק אם המקורות שניסו נכשלו (לא סתם 0 תוצאות)
    if (offRes.status === 'rejected' && tzRes.status === 'rejected' && (usdaRes.status === 'rejected' || !StorageManager.getUsdaKey())) {
        throw (offRes.reason || tzRes.reason || new Error('SEARCH_FAILED'));
    }
    return [];
}

// ── צמ"ת (מאגר משרד הבריאות) — מקור גנרי עברי דרך CKAN data.gov.il ──
// טבלת המזונות, ערכים per-100g. מקור רשמי פתוח; cache ל-KEY_FOOD_DB → offline בפעם הבאה.
const _TZ_RESOURCE = 'c3cb0630-0650-46c1-a068-82d575c094b2';
function _tzToFood(r) {
    if (!r) return null;
    const name = String(r.shmmitzrach || '').trim();   // שם המזון בעברית
    const kcal = Number(r.food_energy);
    if (!name || !isFinite(kcal)) return null;
    return {
        id: 'tz:' + (r.smlmitzrach || r._id || name),
        name, brand: 'צמ"ת', barcode: null, source: 'tzameret',
        per100: { kcal: Math.round(kcal), p: _fdR(r.protein), c: _fdR(r.carbohydrates), f: _fdR(r.total_fat) },
        servings: [{ label: '100 גרם', grams: 100 }]
    };
}
async function searchTzameret(q) {
    const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${_TZ_RESOURCE}` +
        `&q=${encodeURIComponent(q)}&limit=20`;
    const resp = await _fdFetch(url);
    if (!resp.ok) throw new Error('TZ_' + resp.status);
    const data = await resp.json();
    if (!data || data.success !== true || !data.result) return [];
    return (data.result.records || []).map(_tzToFood).filter(Boolean);
}

// _searchOFF: מנסה קודם את ה-API המודרני (search.openfoodfacts.org — בנוי ל-CORS),
// ובכשל נופל ל-search.pl הישן. זורק רק אם שניהם נכשלו.
async function _searchOFF(q) {
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

// ── USDA FoodData Central — שכבת חומרי גלם/גנרי (אופציונלי, דורש מפתח) ──
// מחזיר ערכים ל-100 גרם מסוגי Foundation / SR Legacy (חומרי גלם איכותיים).
function _usdaToFood(it) {
    if (!it) return null;
    const nut = {};
    (it.foodNutrients || []).forEach(n => {
        const id = n.nutrientId != null ? n.nutrientId : (n.nutrient && n.nutrient.id);
        const v = n.value != null ? n.value : n.amount;
        if (v == null) return;
        if (id === 1008) nut.kcal = v;        // Energy (kcal)
        else if (id === 1003) nut.p = v;      // Protein
        else if (id === 1005) nut.c = v;      // Carbohydrate
        else if (id === 1004) nut.f = v;      // Total fat
    });
    if (nut.kcal == null) return null;
    const name = String(it.description || '').trim();
    if (!name) return null;
    return {
        id: 'usda:' + it.fdcId,
        name, brand: String(it.brandName || it.foodCategory || 'USDA'), barcode: null, source: 'usda',
        per100: { kcal: Math.round(nut.kcal), p: _fdR(nut.p), c: _fdR(nut.c), f: _fdR(nut.f) },
        servings: [{ label: '100 גרם', grams: 100 }]
    };
}

// מילון עברית→אנגלית למונחי מזון נפוצים — USDA הוא אנגלי בלבד, ושאילתה עברית
// לא תתאים. תרגום קצר פותח את הכיסוי הגנרי המצוין של USDA (חומרי גלם/יסוד).
const _FD_HE_EN = {
    'תירס': 'corn', 'פופקורן': 'popcorn', 'גרעיני תירס': 'popcorn kernels',
    'אורז': 'rice', 'קוסקוס': 'couscous', 'בורגול': 'bulgur', 'קינואה': 'quinoa',
    'כוסמת': 'buckwheat', 'שיבולת שועל': 'oats', 'שיבולת': 'oats', 'קוואקר': 'oats',
    'עדשים': 'lentils', 'חומוס': 'chickpeas', 'גרגרי חומוס': 'chickpeas',
    'שעועית': 'beans', 'אפונה': 'peas', 'פול': 'fava beans', 'סויה': 'soybeans',
    'פסטה': 'pasta', 'אטריות': 'noodles', 'לחם': 'bread', 'קמח': 'flour',
    'תפוח אדמה': 'potato', 'תפוחי אדמה': 'potato', 'בטטה': 'sweet potato',
    'עוף': 'chicken', 'חזה עוף': 'chicken breast', 'הודו': 'turkey',
    'בקר': 'beef', 'בשר בקר': 'beef', 'טחון': 'ground', 'בשר טחון': 'ground beef',
    'דג': 'fish', 'סלמון': 'salmon', 'טונה': 'tuna', 'ביצה': 'egg', 'ביצים': 'eggs',
    'חלב': 'milk', 'יוגורט': 'yogurt', 'גבינה': 'cheese', 'קוטג': 'cottage cheese',
    'גבינת קוטג': 'cottage cheese', 'חמאה': 'butter', 'שמן': 'oil', 'שמן זית': 'olive oil',
    'אגוזים': 'nuts', 'שקדים': 'almonds', 'אגוז': 'walnut', 'בוטנים': 'peanuts',
    'חמאת בוטנים': 'peanut butter', 'טחינה': 'tahini', 'דבש': 'honey', 'סוכר': 'sugar',
    'מלח': 'salt', 'עגבניה': 'tomato', 'עגבניות': 'tomato', 'מלפפון': 'cucumber',
    'בצל': 'onion', 'שום': 'garlic', 'גזר': 'carrot', 'חסה': 'lettuce', 'תרד': 'spinach',
    'ברוקולי': 'broccoli', 'כרובית': 'cauliflower', 'כרוב': 'cabbage', 'פלפל': 'pepper',
    'חציל': 'eggplant', 'קישוא': 'zucchini', 'דלעת': 'pumpkin', 'אבוקדו': 'avocado',
    'פטריות': 'mushrooms', 'תפוח': 'apple', 'בננה': 'banana', 'תפוז': 'orange',
    'ענבים': 'grapes', 'תות': 'strawberry', 'אבטיח': 'watermelon', 'מלון': 'melon',
    'אגס': 'pear', 'תמר': 'dates', 'תמרים': 'dates', 'שוקולד': 'chocolate'
};
// מתרגם שאילתה עברית למונח USDA אם קיים תרגום; אחרת מחזיר את המקור.
function _fdTranslateForUsda(q) {
    const s = _fdNorm(q);
    if (!/[֐-׿]/.test(s)) return q;   // לא עברית — השאר כמו שהוא
    if (_FD_HE_EN[s]) return _FD_HE_EN[s];      // התאמה מלאה
    // התאמה לפי טוקן: אם מילה בשאילתה מופיעה במילון, תרגם אותה
    const toks = s.split(/\s+/).filter(Boolean);
    const mapped = toks.map(t => _FD_HE_EN[t]).filter(Boolean);
    return mapped.length ? mapped.join(' ') : q;
}

async function searchUSDA(q) {
    const key = StorageManager.getUsdaKey();
    if (!key) return [];   // ללא מפתח — שכבה כבויה
    const term = _fdTranslateForUsda(q);
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}` +
        `&query=${encodeURIComponent(term)}&dataType=${encodeURIComponent('Foundation,SR Legacy')}&pageSize=15`;
    const resp = await _fdFetch(url);
    if (!resp.ok) throw new Error('USDA_' + resp.status);
    const data = await resp.json();
    return (data.foods || []).map(_usdaToFood).filter(Boolean);
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

// _callGeminiMeal — הערכת מנה מתוך תמונת אוכל אמיתי (לא תווית): זיהוי + הערכת משקל ומאקרו לכל המנה
async function _callGeminiMeal(base64, mimeType) {
    const config = StorageManager.getAIConfig();
    if (!config.apiKey) throw new Error('API_KEY_MISSING');
    const prompt = 'אתה תזונאי. בתמונה יש מנת אוכל אמיתית (צלחת/מנה). זהה כל מרכיב בנפרד והערך עבורו ' +
        'משקל בגרמים וערכים תזונתיים (סך הכל למרכיב — לא ל-100 גרם). ' +
        'החזר JSON בלבד: {"name": string, "items": [{"name": string, "grams": number, "kcal": number, "protein": number, "carbs": number, "fat": number}, ...]}. ' +
        'name = תיאור קצר בעברית של המנה כולה. items = רשימת המרכיבים שזוהו (למשל חזה עוף, אורז, שמן), כל אחד עם ההערכה שלו. ' +
        'אם לא בטוח — תן הערכה סבירה ביותר. אל תוסיף טקסט.';
    const parts = [{ text: prompt }, { inlineData: { mimeType, data: base64 } }];
    const generationConfig = { temperature: 0.2, maxOutputTokens: 400, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } };
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
const _FD_DOW = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
function fdRender() {
    const lbl = document.getElementById('fd-date-label');
    if (lbl) lbl.textContent = _fdDateLabel(_fdDate);
    const dow = document.getElementById('fd-date-dow');
    if (dow) { const p = _fdDate.split('-'); dow.textContent = `יום ${_FD_DOW[_blDTs ? new Date(_blDTs(_fdDate)).getDay() : 0]} · ${p[2]}.${p[1]}`; }
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

    const note = StorageManager.getNutritionNote(_fdDate);
    scroll.innerHTML = _fdSummaryHTML(totals, mfpOwned) + _fdNoteHTML(note) + _fdMealsHTML(entries, mfpOwned);
    _fdAnimateRing(scroll);
}

// אנימציית מילוי הטבעת — מ-"ריק" (היקף מלא) לערך היעד, דרך transition של ה-CSS
function _fdAnimateRing(scope) {
    const prog = scope.querySelector('.fd-ring-prog');
    if (!prog) return;
    const target = prog.getAttribute('stroke-dashoffset');
    const circ = prog.getAttribute('stroke-dasharray');
    prog.style.strokeDashoffset = circ;       // התחל ריק
    requestAnimationFrame(() => {
        prog.style.transition = 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)';
        prog.style.strokeDashoffset = target;
    });
}

// פורמט מספר עם פסיקי אלפים (1,835)
function _fdFmt(n) { return (Math.round(Number(n) || 0)).toLocaleString('en-US'); }

// טבעת קלוריות (SVG) — stroke כ-gradient עדין (accent→accent-dim), צבעי ה-stops ב-CSS.
function _fdRingSVG(consumed, target) {
    const r = 54, circ = 2 * Math.PI * r;
    const pct = target > 0 ? Math.min(consumed / target, 1) : (consumed > 0 ? 1 : 0);
    const over = target > 0 && consumed > target;
    const off = circ * (1 - pct);
    return `<svg class="fd-ring" viewBox="0 0 120 120" aria-hidden="true">
        <defs><linearGradient id="fdRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop class="fd-rg0" offset="0"/><stop class="fd-rg1" offset="1"/></linearGradient></defs>
        <circle class="fd-ring-track" cx="60" cy="60" r="${r}"/>
        <circle class="fd-ring-prog${over ? ' over' : ''}" cx="60" cy="60" r="${r}"
            stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" stroke-linecap="round"/>
    </svg>`;
}

// סטט מאקרו — ערך בלבן, הצבע רק בקו הדק (ריסון יוקרתי)
function _fdMacroStat(lbl, val, target, cls) {
    const pct = target > 0 ? Math.min(100, Math.round(val / target * 100)) : 0;
    const tgt = target > 0 ? `<small>/${target}</small>` : '';
    return `<div class="fd-mstat">
        <span class="fd-mstat-lbl">${lbl}</span>
        <span class="fd-mstat-val">${Math.round(val)}${tgt}</span>
        <span class="fd-mline ${cls}"><span style="width:${pct}%"></span></span>
    </div>`;
}

function _fdSummaryHTML(t, mfpOwned) {
    const prefs = getAnalyticsPrefs();
    const kcalT = Number(prefs.kcalTarget) || 0;
    const consumed = Math.round(t.kcal);
    const over = kcalT > 0 && t.kcal > kcalT;
    const big = kcalT > 0 ? Math.abs(Math.round(kcalT - t.kcal)) : consumed;
    const lbl = kcalT > 0 ? (over ? 'מעל היעד' : 'נותרו') : 'נצרכו';
    const caption = kcalT > 0
        ? `<div class="fd-kcap"><span class="fd-kcap-lbl">נצרכו</span><span class="fd-kcap-val accent">${_fdFmt(consumed)}</span></div>
           <span class="fd-kcap-sep"></span>
           <div class="fd-kcap"><span class="fd-kcap-lbl">יעד</span><span class="fd-kcap-val">${_fdFmt(kcalT)}</span></div>`
        : `<div class="fd-kcap"><span class="fd-kcap-lbl">קלוריות</span><span class="fd-kcap-val accent">${_fdFmt(consumed)}</span></div>`;
    return `<div class="fd-summary">
        <div class="fd-ring-wrap">
            ${_fdRingSVG(t.kcal, kcalT)}
            <div class="fd-ring-center">
                <span class="fd-ring-num${over ? ' over' : ''}">${_fdFmt(big)}</span>
                <span class="fd-ring-lbl">${lbl}</span>
            </div>
        </div>
        <div class="fd-kcal-caption">${caption}</div>
        <div class="fd-macros">
            ${_fdMacroStat('חלבון', t.p, Number(prefs.proteinTarget) || 0, 'macro-p')}
            ${_fdMacroStat('פחמימה', t.c, Number(prefs.carbsTarget) || 0, 'macro-c')}
            ${_fdMacroStat('שומן', t.f, Number(prefs.fatTarget) || 0, 'macro-f')}
        </div>
        ${mfpOwned ? '<div class="fd-mfp-note"><span class="material-symbols-outlined">info</span>הסיכום היומי מקורו ב-MyFitnessPal וגובר על תיעוד פנימי</div>' : ''}
    </div>`;
}

// שורת הערה יומית — עצמאית מ-NUTRITION_DAILY, קיימת גם ביום בלי שום רשומת תזונה
function _fdNoteHTML(note) {
    if (note) {
        return `<div class="fd-note-row" onclick="_fdShowNoteForm()">
            <span class="material-symbols-outlined">sticky_note_2</span>
            <span class="fd-note-text">${_fdEsc(note)}</span>
            <span class="material-symbols-outlined fd-note-edit">edit</span>
        </div>`;
    }
    return `<div class="fd-note-row fd-note-row--empty" onclick="_fdShowNoteForm()">
        <span class="material-symbols-outlined">add_circle</span>
        <span class="fd-note-text">הוסף הערה יומית</span>
    </div>`;
}

function _fdMealsHTML(entries, mfpOwned) {
    // קיבוץ לפי ארוחה: קודם הארוחות המוגדרות, אחר כך ארוחות חופשיות שהופיעו
    const order = _fdMealLabels();
    const used = Array.from(new Set(entries.map(e => e.meal)));
    used.forEach(m => { if (order.indexOf(m) < 0) order.push(m); });

    let html = '';
    order.forEach((meal, mi) => {
        const items = entries.filter(e => e.meal === meal);
        if (!items.length && used.indexOf(meal) < 0 && order.indexOf(meal) >= _fdMealLabels().length) return;
        const mt = items.reduce((s, e) => s + (+e.kcal || 0), 0);
        const mp = items.reduce((s, e) => s + (+e.p || 0), 0);
        const mc = items.reduce((s, e) => s + (+e.c || 0), 0);
        const mf = items.reduce((s, e) => s + (+e.f || 0), 0);
        const mealJs = _fdEsc(meal).replace(/'/g, '');
        // מחיקת ארוחה מותאמת ריקה (לא ברירת מחדל, ללא רשומות היום) ישירות מהיומן
        const delBtn = (_FD_DEFAULT_MEALS.indexOf(meal) < 0 && !items.length)
            ? `<button class="fd-meal-del" data-meal="${_fdEsc(meal)}" onclick="event.stopPropagation();fdDeleteMeal(this)" aria-label="מחק ארוחה"><span class="material-symbols-outlined">delete</span></button>`
            : '';
        const accVar = _FD_MEAL_ACCENT[meal] ? `--fd-meal-accent:${_FD_MEAL_ACCENT[meal]};` : '';
        html += `<div class="fd-meal" style="${accVar}animation-delay:${mi * 0.04}s">
            <div class="fd-meal-hdr">
                <span class="fd-meal-icon"><span class="material-symbols-outlined">${_fdMealIcon(meal)}</span></span>
                <div class="fd-meal-titles">
                    <span class="fd-meal-name">${_fdEsc(meal)}</span>
                    <span class="fd-meal-kcal">${mt
                        ? `${_fdFmt(mt)} קלוריות <span class="fd-meal-pcf"><i class="macro-p">P ${Math.round(mp)}</i><i class="macro-c">C ${Math.round(mc)}</i><i class="macro-f">F ${Math.round(mf)}</i></span>`
                        : '—'}</span>
                </div>
                ${delBtn}
                <button class="fd-meal-add" onclick="fdOpenAdd('${mealJs}')" aria-label="הוסף מזון"><span class="material-symbols-outlined">add</span></button>
            </div>
            <div class="fd-meal-body">`;
        if (items.length) {
            html += items.map(e => {
                const badge = (e.components && e.components.length)
                    ? `<span class="fd-entry-badge"><span class="material-symbols-outlined">lunch_dining</span>${e.components.length}</span>` : '';
                const sub = (e.components && e.components.length)
                    ? `${e.components.length} מרכיבים${e.time ? ' · ' + _fdEsc(e.time) : ''}`
                    : `${_fdEsc(_fdPortionLabel(e))}${e.time ? ' · ' + _fdEsc(e.time) : ''}`;
                return `<button class="fd-entry" onclick="fdEditEntry('${e.id}')">
                    <div class="fd-entry-main">
                        <span class="fd-entry-name">${_fdEsc(e.name)}${badge}</span>
                        <span class="fd-entry-sub">${sub}</span>
                    </div>
                    <div class="fd-entry-macros">
                        <span class="fd-entry-kcal">${_fdFmt(e.kcal)}<small>kcal</small></span>
                        <span class="fd-entry-pcf"><i class="macro-p">P ${Math.round(e.p)}</i><i class="macro-c">C ${Math.round(e.c)}</i><i class="macro-f">F ${Math.round(e.f)}</i></span>
                    </div>
                </button>`;
            }).join('');
        } else {
            html += `<button class="fd-meal-emptyrow" onclick="fdOpenAdd('${mealJs}')"><span class="material-symbols-outlined">add</span>הוסף מזון</button>`;
        }
        html += '</div></div>';
    });
    // הוספת ארוחה חופשית חדשה
    html += `<button class="fd-add-meal" onclick="fdAddCustomMeal()"><span class="material-symbols-outlined">add_circle</span>הוסף ארוחה חדשה</button>`;
    return html;
}

function _fdPortionLabel(e) {
    if (e.unit === 'serving') return `${_fdR(e.qty)} ${e.baseUnit === 'unit' ? 'יחידות' : 'מנות'}`;
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
    _fdBindKeyboardLift();
    fdSetTab('recent');
    haptic('light');
}

// קיצור דרך לניהול מזונות מותאמים — פותח את שיט ההוספה ישר על טאב "מותאמים"
function fdOpenCustomFoodsManager() {
    fdOpenAdd(_fdMeal);
    fdSetTab('custom', document.querySelector('#fd-tabs [data-fdtab="custom"]'));
}

// הרמת שיט החיפוש מעל המקלדת ב-iOS — visualViewport מצמצם את הגובה הנראה כשהמקלדת עולה.
// מרימים את השיט בגובה המקלדת ומגבילים את גובהו לאזור הנראה, כך שהתוצאות תמיד מעליה.
let _fdVVHandler = null;
function _fdBindKeyboardLift() {
    const vv = window.visualViewport;
    const sheet = document.getElementById('fd-add-sheet');
    if (!vv || !sheet || _fdVVHandler) return;
    _fdVVHandler = () => {
        const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        sheet.style.bottom = kb + 'px';
        // משאירים רצועה לחיצה בראש המסך לסגירת השיט (overlay) ומונעים שהשיט יחרוג מעבר
        // לאזור הנראה (top מתחת לשורת הסטטוס) — מגבילים לגובה הנראה פחות מרווח.
        const gap = 72;
        sheet.style.maxHeight = Math.max(220, Math.round(vv.height - gap)) + 'px';
    };
    vv.addEventListener('resize', _fdVVHandler);
    vv.addEventListener('scroll', _fdVVHandler);
    _fdVVHandler();
}
function _fdUnbindKeyboardLift() {
    const vv = window.visualViewport;
    const sheet = document.getElementById('fd-add-sheet');
    if (vv && _fdVVHandler) {
        vv.removeEventListener('resize', _fdVVHandler);
        vv.removeEventListener('scroll', _fdVVHandler);
    }
    _fdVVHandler = null;
    if (sheet) { sheet.style.bottom = ''; sheet.style.maxHeight = ''; }
}

// הסתרת המקלדת בעת גלילת רשימת התוצאות — חשוב ל-UI במובייל
function _fdAttachScrollBlur() {
    const box = document.getElementById('fd-results');
    if (!box || box.dataset.blurBound) return;
    // מסתיר מקלדת בגלילה — תוך שימור מיקום הגלילה כדי שהמסך לא "יקפוץ" כשהמקלדת יורדת
    const blur = () => {
        const s = document.getElementById('fd-search');
        if (s && document.activeElement === s) {
            const top = box.scrollTop;
            s.blur();
            requestAnimationFrame(() => { box.scrollTop = top; });
            setTimeout(() => { box.scrollTop = top; }, 60);  // אחרי שינוי ה-viewport ב-iOS
        }
    };
    box.addEventListener('scroll', blur, { passive: true });
    box.addEventListener('touchmove', blur, { passive: true });
    box.dataset.blurBound = '1';
}
function closeFoodAdd() {
    _fdUnbindKeyboardLift();
    document.getElementById('fd-add-overlay').style.display = 'none';
    document.getElementById('fd-add-sheet').classList.remove('open');
    _fdCompPickMode = false;
    document.body.classList.remove('fd-comp-pick');
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
    // מועדפים/אחרונים מדורגים לפי הארוחה הנוכחית (_fdMeal) — מזונות הארוחה קודם
    if (_fdTab === 'recent') foods = StorageManager.recentFoods(30, _fdMeal);
    else if (_fdTab === 'fav') foods = StorageManager.favoriteFoods(_fdMeal);
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
    _fdLastQuery = q; _fdLastFoods = [];
    // מוצרים שתועדו בעבר (lastUsed) — תמיד בראש, ממוינים לפי עדיפות-ארוחה כמו אחרונים/מועדפים
    // (90% מהחיפושים הם חזרה על מוצר מוכר). חומרי גלם מובנים (offline) אחריהם, ואז שאר
    // המאגר המקומי (נמצא בעבר בחיפוש אך לא תועד) — fallback ל-offline, לא בעדיפות גבוהה.
    const localMatches = StorageManager.getFoodDb().filter(f => f.name && _fdTokenMatch(f.name, q));
    const used = StorageManager.sortFoodsByMealUse(localMatches.filter(f => f.lastUsed), _fdMeal);
    const unusedLocal = localMatches.filter(f => !f.lastUsed);
    const basics = _fdBasicMatches(q);
    // שניהם מוצגים מיידית, לפני תשובת הרשת, ונשארים בראש גם אחריה (לא נדרסים ע"י תוצאות חדשות).
    const immediate = _fdDedup(used.concat(basics).concat(unusedLocal));
    if (immediate.length) { _fdLastFoods = immediate; _fdRenderFoodList(immediate, box); }
    else box.innerHTML = '<div class="fd-loading">מחפש ב-Open Food Facts…</div>';

    try {
        const foods = await searchFoods(q);
        if (seq !== _fdSearchSeq) return;   // בקשה חדשה יותר כבר רצה — התעלם
        foods.forEach(f => StorageManager.upsertFoodToDb(f));   // קאש לשימוש עתידי
        // מתועדים בראש, חומרי גלם אחריהם, תוצאות הרשת, ואז שאר המאגר המקומי (ללא כפילויות)
        const merged = _fdDedup(used.concat(basics).concat(foods).concat(unusedLocal));
        _fdLastFoods = merged;
        if (merged.length) { _fdRenderFoodList(merged, box); _fdAppendAiAction(box); }
        else if (!immediate.length) {
            // אין תוצאות כלל → fallback יזום ל-AI (אם זמין), אחרת הודעה
            if (_fdAiAvailable()) { fdAiLookup(); return; }
            box.innerHTML = '<div class="fd-empty">לא נמצאו תוצאות. נסה שם אחר או צור מזון מותאם.</div>';
        }
    } catch (e) {
        if (seq !== _fdSearchSeq) return;   // כשל של בקשה ישנה — אל תדרוס תוצאות חדשות
        if (!immediate.length) {
            const offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
            box.innerHTML = `<div class="fd-empty">${offline ? 'אין חיבור לרשת — חבר רשת ונסה שוב' : 'החיפוש נכשל — נסה שוב, או הוסף מזון מותאם'}</div>`;
        } else { _fdAppendAiAction(box); }
        // אם כבר מוצגות תוצאות (חומרי גלם/שמורות) — לא מציגים באנר כשל
    }
}

// זמינות ה-fallback של AI: יש מפתח Gemini ואנחנו לא offline
function _fdAiAvailable() {
    return !!StorageManager.getAIConfig().apiKey && !(typeof navigator !== 'undefined' && navigator.onLine === false);
}

// שורת "הערכת AI" קבועה מתחת לתוצאות — יזומה: לחיצה כשהתוצאות לא מתאימות.
// (משתמש ב-_fdLastQuery במקום inline ב-onclick כדי להימנע מבעיות escaping)
function _fdAppendAiAction(box) {
    if (!_fdAiAvailable() || !_fdLastQuery) return;
    box.insertAdjacentHTML('beforeend',
        `<button class="fd-ai-row" onclick="fdAiLookup()">
            <span class="material-symbols-outlined">auto_awesome</span>
            <span>לא מצאת? <b>הערכת&nbsp;AI</b> ל"${_fdEsc(_fdLastQuery)}"</span>
        </button>`);
}

// בקשת ערכים תזונתיים סטנדרטיים מ-Gemini (מזון גנרי = ערכים ידועים ואמינים)
async function _fdAiNutrition(q) {
    const config = StorageManager.getAIConfig();
    if (!config.apiKey) throw new Error('API_KEY_MISSING');
    const prompt = 'אתה מסד נתונים תזונתי. החזר ערכים תזונתיים סטנדרטיים ל-100 גרם של המזון: "' + q + '". ' +
        'החזר JSON בלבד: {"found": boolean, "name": string, "kcal": number, "protein": number, "carbs": number, "fat": number}. ' +
        'name = שם תקני קצר בעברית. אם המחרוזת אינה מזון מוכר — found=false. אל תוסיף טקסט.';
    const parts = [{ text: prompt }];
    const generationConfig = { temperature: 0, maxOutputTokens: 150, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } };
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
    throw new Error(lastErr || 'AI_FAILED');
}

// ממיר תשובת AI לאובייקט מזון ושומר ב-DB (קאש → פעם הבאה מיידי + offline)
async function _fdAiFood(q) {
    const res = await _fdAiNutrition(q);
    if (!res || res.found === false || res.kcal == null) return null;
    const food = {
        id: 'ai:' + _fdNorm(q), name: res.name || q, brand: 'הערכת AI',
        barcode: null, source: 'gemini',
        per100: { kcal: Math.round(res.kcal), p: _fdR(res.protein), c: _fdR(res.carbs), f: _fdR(res.fat) },
        servings: [{ label: '100 גרם', grams: 100 }]
    };
    StorageManager.upsertFoodToDb(food);
    return food;
}

// יזום ע"י המשתמש (או אוטומטית ב-0 תוצאות) — הערכת AI לשאילתה הנוכחית
async function fdAiLookup() {
    const box = document.getElementById('fd-results');
    const q = _fdLastQuery;
    if (!box || !q) return;
    if (!StorageManager.getAIConfig().apiKey) { showAlert('להערכת AI נדרש מפתח Gemini (הגדרות → AI Coach).'); return; }
    const seq = _fdSearchSeq;
    box.innerHTML = '<div class="fd-loading">🔮 מעריך תזונה עם AI…</div>';
    try {
        const food = await _fdAiFood(q);
        if (seq !== _fdSearchSeq) return;   // המשתמש המשיך להקליד — התעלם
        if (food) { _fdRenderFoodList([food].concat(_fdLastFoods), box); return; }
        _fdRenderFoodList(_fdLastFoods, box);
        box.insertAdjacentHTML('beforeend', '<div class="fd-empty">ה-AI לא זיהה מזון מוכר בשם זה. נסה ניסוח אחר או צור מזון מותאם.</div>');
    } catch (e) {
        if (seq !== _fdSearchSeq) return;
        _fdRenderFoodList(_fdLastFoods, box);
        box.insertAdjacentHTML('beforeend', '<div class="fd-empty">הערכת ה-AI נכשלה — נסה שוב או צור מזון מותאם.</div>');
    }
}

const _FD_SRC_LABEL = { off: 'OFF', usda: 'USDA', basic: 'בסיסי', custom: 'מותאם', gemini: 'AI', tzameret: 'צמ"ת' };
function _fdSrcChip(f) {
    const s = (f.source === 'basic' || f.brand === 'חומר גלם') ? 'basic' : (f.source || 'off');
    const lbl = _FD_SRC_LABEL[s] || '';
    return lbl ? `<span class="fd-src-chip src-${s}">${lbl}</span>` : '';
}
function _fdRenderFoodList(foods, box, append) {
    if (!append) _fdFoodCache = {};
    foods.forEach(f => { _fdFoodCache[f.id] = f; });
    const html = foods.map(f => {
        const brand = (f.brand && f.brand !== 'חומר גלם') ? _fdEsc(f.brand) + ' · ' : '';
        const p = f.per100 || {};
        // מזון "יחידה" מאוחסן ב-per100 מוכפל ×100 (טריק התאמה למודל הפנימי) — לתצוגה יש לחלק חזרה
        const isUnit = f.baseUnit === 'unit';
        const dKcal = isUnit ? (p.kcal || 0) / 100 : (p.kcal || 0);
        const dP = isUnit ? (p.p || 0) / 100 : (p.p || 0);
        const dC = isUnit ? (p.c || 0) / 100 : (p.c || 0);
        const dF = isUnit ? (p.f || 0) / 100 : (p.f || 0);
        const per100Lbl = isUnit ? 'יחידה' : f.baseUnit === 'ml' ? '100 מ"ל' : '100 ג\'';
        const editBtn = f.source === 'custom'
            ? `<span class="fd-food-edit" role="button" aria-label="ערוך מזון מותאם" onclick="event.stopPropagation();fdEditCustomFood('${_fdEsc(f.id)}')"><span class="material-symbols-outlined">edit</span></span>` : '';
        return `<button class="fd-food-row" onclick="fdSelectFoodById('${_fdEsc(f.id)}')">
            <div class="fd-food-main">
                <span class="fd-food-name">${_fdSrcChip(f)}${_fdEsc(f.name)}</span>
                <span class="fd-food-sub">${brand}${_fdFmt(dKcal)} kcal · ${per100Lbl}</span>
                <span class="fd-entry-pcf"><i class="macro-p">ח ${Math.round(dP)}</i><i class="macro-c">פ ${Math.round(dC)}</i><i class="macro-f">ש ${Math.round(dF)}</i></span>
            </div>
            ${editBtn}
            <span class="fd-food-star ${f.favorite ? 'on' : ''}" role="button" onclick="event.stopPropagation();fdToggleFav('${_fdEsc(f.id)}',this)">${f.favorite ? '★' : '☆'}</span>
        </button>`;
    }).join('');
    box.innerHTML = (append ? box.innerHTML : '') + html;
}

function fdToggleFav(id, el) {
    const on = StorageManager.toggleFavoriteFood(id);
    if (_fdFoodCache[id]) _fdFoodCache[id].favorite = on;
    if (el) { el.textContent = on ? '★' : '☆'; el.classList.toggle('on', on); }
    _fdSyncCloud();
    haptic('light');
}

function fdSelectFoodById(id) {
    const food = _fdFoodCache[id] || StorageManager.getFoodDb().find(f => f.id === id);
    if (!food) return;
    StorageManager.upsertFoodToDb(food);
    if (_fdCompPickMode) { _fdAddComponentFromFood(food); return; }   // בחירת מרכיב למנה
    _fdOpenPortion(food, null);
}

// הוספת מזון שנבחר בחיפוש כמרכיב ב-Meal Builder (במקום פתיחת עורך הכמות)
function _fdAddComponentFromFood(food) {
    const per = food.per100 || { kcal: 0, p: 0, c: 0, f: 0 };
    // מזון "יחידה" מאוחסן ×100 פנימית (טריק per100) — מנרמלים לערך אמיתי ליחידה לפני הכנסה לרכיב המנה
    const isUnit = food.baseUnit === 'unit';
    const scale = isUnit ? 100 : 1;
    // ברירת מחדל גרמים: גודל מנה אם מוגדר (לא 100), אחרת 100
    const serv = (food.servings || []).find(s => s.grams && s.grams !== 100);
    _fdMealComponents.push({
        name: food.name, grams: serv ? serv.grams : 100, baseUnit: food.baseUnit || 'g',
        per100: { kcal: (per.kcal || 0) / scale, p: (per.p || 0) / scale, c: (per.c || 0) / scale, f: (per.f || 0) / scale }
    });
    _fdCompPickMode = false;
    closeFoodAdd();          // סוגר את שיט החיפוש — ה-Meal Builder נשאר פתוח מתחתיו
    _fdRenderComponents();
    haptic('medium');
}

// ════════ PORTION EDITOR ════════
function _fdOpenPortion(food, entry) {
    _fdCompPickMode = false;   // נתיב עורך כמות — לא מצב בחירת מרכיב
    _fdSelectedFood = food;
    _fdEditEntryId = entry ? entry.id : null;
    const sheet = document.getElementById('fd-portion-sheet');
    const body = document.getElementById('fd-portion-body');
    if (!sheet || !body) return;

    const servings = (food.servings && food.servings.length) ? food.servings : [{ label: '100 גרם', grams: 100 }];
    // יחידת הבסיס קובעת את אפשרות ה-fallback (כמות גולמית בלי "מנה"): גרם/מ"ל מאפשרים הזנה חופשית,
    // "יחידה" (מזון מותאם נפרד-ספירה, למשל ביצה) לא — כי הזנת "גרם" גולמי על מזון כזה תיתן ערך שגוי.
    const baseUnit = (entry ? entry.baseUnit : food.baseUnit) || 'g';
    const fallbackUnit = baseUnit === 'unit' ? null : (baseUnit === 'ml' ? 'ml' : 'g');
    const fallbackOpt = fallbackUnit ? `<option value="${fallbackUnit}">${fallbackUnit === 'ml' ? 'מ"ל' : 'גרם'}</option>` : '';
    const unitOpts = servings.map((s, i) => `<option value="s${i}">${_fdEsc(s.label)}</option>`).join('') + fallbackOpt;
    const qty = entry ? entry.qty : (servings[0].grams && servings[0].grams !== 100 ? 1 : 100);
    const unit = entry ? (entry.unit === 'serving' ? 's0' : (entry.unit || fallbackUnit || 's0'))
        : (servings[0].grams && servings[0].grams !== 100 ? 's0' : (fallbackUnit || 's0'));
    const time = entry ? entry.time : _fdNowTime();
    const curMeal = entry ? entry.meal : _fdMeal;

    body.innerHTML = `
        <div class="fd-portion-title">${_fdEsc(food.name)}${food.brand ? `<small>${_fdEsc(food.brand)}</small>` : ''}</div>
        <div class="fd-portion-row">
            <label class="fd-field fd-field--qty"><span>כמות</span><input type="number" id="fd-qty" inputmode="decimal" min="0" step="any" value="${qty}" oninput="_fdUpdatePreview()"></label>
            <label class="fd-field fd-field--unit"><span>יחידה</span><select id="fd-unit" onchange="_fdUpdatePreview()">${unitOpts}</select></label>
            <label class="fd-field fd-field--time"><span>שעה</span><input type="time" id="fd-time" value="${time}"></label>
        </div>
        <div class="fd-meal-chips" id="fd-meal-chips">${_fdMealChipsHTML(curMeal)}</div>
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
    const wrap = el.closest('.fd-meal-chips') || document;
    wrap.querySelectorAll('.fd-chip').forEach(c => c.classList.toggle('active', c === el));
}

function _fdComputeGrams() {
    const qty = Number(document.getElementById('fd-qty').value) || 0;
    const unitSel = document.getElementById('fd-unit').value;
    if (unitSel === 'g' || unitSel === 'ml') return { grams: qty, unit: unitSel, qtyVal: qty };
    const idx = parseInt(unitSel.slice(1), 10);
    const serv = (_fdSelectedFood.servings || [])[idx] || { grams: 100 };
    return { grams: (serv.grams || 100) * qty, unit: 'serving', qtyVal: qty, gramsPerUnit: serv.grams };
}

function _fdMacrosFor(grams) {
    const p100 = _fdSelectedFood.per100;
    const f = grams / 100;
    return { kcal: Math.round(p100.kcal * f), p: _fdR(p100.p * f), c: _fdR(p100.c * f), f: _fdR(p100.f * f) };
}

// תווית סיכום הכמות בעורך המנה — מציגה משקל/נפח כולל למזון רגיל, אך לא ל"יחידה"
// (מזון נספר, כמו ביצה) — כי gramsPerUnit=1 שם הוא טריק פנימי בלבד ולא משקל אמיתי.
function _fdQtyDisplayLabel(g) {
    const baseUnit = (_fdSelectedFood && _fdSelectedFood.baseUnit) || 'g';
    if (g.unit === 'serving' && baseUnit === 'unit') return `${_fdR(g.qtyVal)} יחידות`;
    if (g.unit === 'ml') return `${Math.round(g.grams)} מ"ל`;
    return `${Math.round(g.grams)} ${baseUnit === 'ml' ? 'מ"ל' : 'גרם'}`;
}

function _fdUpdatePreview() {
    const prev = document.getElementById('fd-preview');
    if (!prev || !_fdSelectedFood) return;
    const g = _fdComputeGrams();
    const m = _fdMacrosFor(g.grams);
    const mismatch = _fdKcalMismatch(m.kcal, m.p, m.c, m.f);
    prev.innerHTML = `<span class="fd-preview-kcal">${m.kcal}<small>kcal</small></span>
        <span class="fd-preview-pcf">חלבון ${m.p}g · פחמימה ${m.c}g · שומן ${m.f}g</span>
        <span class="fd-preview-g">${_fdQtyDisplayLabel(g)}</span>
        ${mismatch ? `<div class="fd-kcal-warn">⚠ הקלוריות לא תואמות את פירוט המאקרו (סטייה ${Math.round(mismatch * 100)}%) — ייתכן נתון מקור שגוי</div>` : ''}`;
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
        qty: g.qtyVal, unit: g.unit, gramsPerUnit: g.gramsPerUnit || null, baseUnit: food.baseUnit || 'g',
        per100: food.per100, kcal: m.kcal, p: m.p, c: m.c, f: m.f
    };
    if (_fdEditEntryId) {
        StorageManager.updateFoodEntry(_fdDate, _fdEditEntryId, entry);
    } else {
        StorageManager.addFoodEntry(_fdDate, entry);
        if (food.id) StorageManager.bumpFoodUsage(food.id, entry.meal);
    }
    closeFoodPortion();
    closeFoodAdd();
    fdRender();
    _fdSyncCloud();
    haptic('medium');
}

// _fdSyncCloud — מעלה את הקונפיג (כולל יומן/מאגר המזון) לענן אחרי כל שינוי תזונה.
// debounced לאיחוד עריכות מהירות; autoSaveConfigToCloud מדלג בשקט ללא Firebase.
let _fdCloudTimer = null;
function _fdSyncCloud() {
    if (typeof autoSaveConfigToCloud !== 'function') return;
    if (_fdCloudTimer) clearTimeout(_fdCloudTimer);
    _fdCloudTimer = setTimeout(() => { _fdCloudTimer = null; autoSaveConfigToCloud(); }, 1200);
}

function closeFoodPortion() {
    document.getElementById('fd-portion-overlay').style.display = 'none';
    document.getElementById('fd-portion-sheet').classList.remove('open');
}

function fdEditEntry(id) {
    const entry = StorageManager.getFoodLogDay(_fdDate).find(e => e.id === id);
    if (!entry) return;
    // רשומת מנה מורכבת → Meal Builder (עריכת מרכיבים)
    if (entry.components && entry.components.length) {
        _fdOpenMealBuilder({
            name: entry.name,
            components: entry.components.map(c => ({ name: c.name, grams: c.grams, per100: c.per100, baseUnit: c.baseUnit || 'g' })),
            meal: entry.meal, time: entry.time, editId: entry.id
        });
        return;
    }
    // שחזור אובייקט מזון מתוך הרשומה — baseUnit נשמר על הרשומה עצמה (ברירת מחדל 'g' לרשומות ישנות)
    const baseUnit = entry.baseUnit || 'g';
    const servings = entry.gramsPerUnit
        ? [{ label: baseUnit === 'unit' ? '1 יחידה' : `מנה (${entry.gramsPerUnit} ג')`, grams: entry.gramsPerUnit }, { label: '100 גרם', grams: 100 }]
        : [{ label: baseUnit === 'ml' ? '100 מ"ל' : '100 גרם', grams: 100 }];
    const food = { id: entry.barcode ? 'off:' + entry.barcode : 'log:' + id, name: entry.name, brand: entry.brand, barcode: entry.barcode, source: entry.source, per100: entry.per100, servings, baseUnit };
    _fdOpenPortion(food, entry);
}

function fdDeleteCurrentEntry() {
    if (!_fdEditEntryId) return;
    StorageManager.deleteFoodEntry(_fdDate, _fdEditEntryId);
    _fdSyncCloud();
    closeFoodPortion();
    fdRender();
    haptic('warning');
}

// ── מזון מותאם (custom) ──────────────────────────────────────────────
// תווית שדה הקלוריות לפי יחידת הבסיס שנבחרה
function _fdCustomKcalLabel(unit) {
    return unit === 'ml' ? 'קלוריות / 100 מ"ל' : unit === 'unit' ? 'קלוריות ליחידה' : 'קלוריות / 100 גרם';
}
function _fdCustomUnitChanged() {
    const sel = document.getElementById('fd-c-unit');
    const lbl = document.getElementById('fd-c-kcal-label');
    if (sel && lbl) lbl.textContent = _fdCustomKcalLabel(sel.value);
}
function _fdCustomCheckMismatch() {
    const warnEl = document.getElementById('fd-c-warn');
    if (!warnEl) return;
    const kcal = Number(document.getElementById('fd-c-kcal').value) || 0;
    const p = Number(document.getElementById('fd-c-p').value) || 0;
    const c = Number(document.getElementById('fd-c-c').value) || 0;
    const f = Number(document.getElementById('fd-c-f').value) || 0;
    const mismatch = _fdKcalMismatch(kcal, p, c, f);
    warnEl.innerHTML = mismatch ? `⚠ הקלוריות שהוזנו לא תואמות את חלבון/פחמימה/שומן (סטייה ${Math.round(mismatch * 100)}%) — בדוק את הערכים` : '';
}

// food=null → יצירת מזון מותאם חדש; food קיים → עריכה במקום (אותו id, משמר היסטוריית שימוש/מועדפים)
function _fdShowCustomFoodForm(food) {
    const sheet = document.getElementById('fd-portion-sheet');
    const body = document.getElementById('fd-portion-body');
    if (!sheet || !body) return;
    _fdEditEntryId = null;
    _fdSelectedFood = null;
    _fdEditCustomFoodId = food ? food.id : null;
    const editMode = !!food;
    const baseUnit = editMode ? (food.baseUnit || 'g') : 'g';
    const p = editMode ? (food.per100 || {}) : {};
    const scale = (editMode && baseUnit === 'unit') ? 100 : 1;   // הצגה: ערך "ליחידה" מאוחסן ×100 פנימית
    const vKcal = editMode ? _fdR((p.kcal || 0) / scale) : '';
    const vP = editMode ? _fdR((p.p || 0) / scale) : '';
    const vC = editMode ? _fdR((p.c || 0) / scale) : '';
    const vF = editMode ? _fdR((p.f || 0) / scale) : '';
    if (!editMode) { const meals = _fdMealLabels(); _fdMeal = meals[0]; }
    body.innerHTML = `
        <div class="fd-portion-title">${editMode ? 'עריכת מזון מותאם' : 'מזון מותאם'}</div>
        <label class="fd-field fd-field--full"><span>שם</span><input type="text" id="fd-c-name" value="${_fdEsc(editMode ? food.name : '')}" placeholder="לדוגמה: חביתה ביתית"></label>
        <label class="fd-field fd-field--full"><span>יחידת מידה</span>
            <select id="fd-c-unit" onchange="_fdCustomUnitChanged()">
                <option value="g" ${baseUnit === 'g' ? 'selected' : ''}>גרם</option>
                <option value="ml" ${baseUnit === 'ml' ? 'selected' : ''}>מ"ל</option>
                <option value="unit" ${baseUnit === 'unit' ? 'selected' : ''}>יחידה (לדוגמה: ביצה אחת)</option>
            </select>
        </label>
        <div class="fd-portion-row">
            <label class="fd-field"><span id="fd-c-kcal-label">${_fdCustomKcalLabel(baseUnit)}</span><input type="number" id="fd-c-kcal" inputmode="decimal" min="0" value="${vKcal}" oninput="_fdCustomCheckMismatch()"></label>
            <label class="fd-field"><span>חלבון</span><input type="number" id="fd-c-p" inputmode="decimal" min="0" value="${vP}" oninput="_fdCustomCheckMismatch()"></label>
        </div>
        <div class="fd-portion-row">
            <label class="fd-field"><span>פחמימה</span><input type="number" id="fd-c-c" inputmode="decimal" min="0" value="${vC}" oninput="_fdCustomCheckMismatch()"></label>
            <label class="fd-field"><span>שומן</span><input type="number" id="fd-c-f" inputmode="decimal" min="0" value="${vF}" oninput="_fdCustomCheckMismatch()"></label>
        </div>
        <div class="fd-kcal-warn" id="fd-c-warn"></div>
        ${editMode ? '' : `<div class="fd-meal-chips" id="fd-meal-chips">${_fdMealChipsHTML(_fdMeal)}</div>`}
        <div class="fd-portion-actions">
            ${editMode ? `<button class="fd-del-btn" onclick="fdDeleteCustomFood()"><span class="material-symbols-outlined">delete</span></button>` : ''}
            <button class="fd-save-btn" onclick="fdSaveCustomFood()">${editMode ? 'שמור' : 'המשך'}</button>
        </div>`;
    document.getElementById('fd-portion-overlay').style.display = 'block';
    sheet.classList.add('open');
    _fdCustomCheckMismatch();
}

function fdNewCustomFood() { _fdShowCustomFoodForm(null); }

function fdEditCustomFood(id) {
    const food = _fdFoodCache[id] || StorageManager.getFoodDb().find(f => f.id === id);
    if (!food) return;
    _fdShowCustomFoodForm(food);
}

function fdSaveCustomFood() {
    const name = (document.getElementById('fd-c-name').value || '').trim();
    const unit = document.getElementById('fd-c-unit').value;
    const kcal = _fdNum(document.getElementById('fd-c-kcal').value);
    if (!name) { showAlert('הזן שם למזון.'); return; }
    if (kcal == null) { showAlert('הזן ערך קלוריות.'); return; }
    // "יחידה": הערך שהוזן הוא לאחת — מוכפל ×100 כדי להתאים למודל ה-per100 הפנימי (הכל מחושב לפי /100)
    const scale = unit === 'unit' ? 100 : 1;
    const per100 = {
        kcal: Math.round(kcal * scale),
        p: _fdR((Number(document.getElementById('fd-c-p').value) || 0) * scale),
        c: _fdR((Number(document.getElementById('fd-c-c').value) || 0) * scale),
        f: _fdR((Number(document.getElementById('fd-c-f').value) || 0) * scale)
    };
    const servings = unit === 'unit' ? [{ label: '1 יחידה', grams: 1 }]
        : [{ label: unit === 'ml' ? '100 מ"ל' : '100 גרם', grams: 100 }];

    if (_fdEditCustomFoodId) {
        const food = { id: _fdEditCustomFoodId, name, source: 'custom', per100, servings, baseUnit: unit };
        StorageManager.upsertFoodToDb(food);
        _fdEditCustomFoodId = null;
        closeFoodPortion();
        fdRenderTab();
        _fdSyncCloud();
        haptic('medium');
        return;
    }
    const food = {
        id: 'custom:' + Date.now().toString(36),
        name, brand: '', barcode: null, source: 'custom',
        per100, servings, baseUnit: unit
    };
    StorageManager.upsertFoodToDb(food);
    _fdOpenPortion(food, null);  // פותח את עורך המנה עבור המזון החדש
}

function fdDeleteCustomFood() {
    if (!_fdEditCustomFoodId) return;
    const id = _fdEditCustomFoodId;
    showConfirm('למחוק את המזון המותאם? הפעולה אינה הפיכה.', () => {
        StorageManager.deleteFoodFromDb(id);
        _fdEditCustomFoodId = null;
        closeFoodPortion();
        fdRenderTab();
        _fdSyncCloud();
        haptic('warning');
    });
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

// ── הערה יומית ───────────────────────────────────────────────────────
function _fdShowNoteForm() {
    const sheet = document.getElementById('fd-portion-sheet');
    const body = document.getElementById('fd-portion-body');
    if (!sheet || !body) return;
    const note = StorageManager.getNutritionNote(_fdDate);
    body.innerHTML = `
        <div class="fd-portion-title">הערה יומית</div>
        <label class="fd-field fd-field--full"><span>הערה</span><textarea id="fd-note-input" placeholder="לדוגמה: יום חג, ארוחה בחוץ, תחושה כללית...">${_fdEsc(note)}</textarea></label>
        <div class="fd-portion-actions">
            <button class="fd-save-btn" onclick="fdSaveNote()">שמור</button>
        </div>`;
    document.getElementById('fd-portion-overlay').style.display = 'block';
    sheet.classList.add('open');
    setTimeout(() => { const i = document.getElementById('fd-note-input'); if (i) i.focus(); }, 100);
}

function fdSaveNote() {
    const input = document.getElementById('fd-note-input');
    if (!input) return;
    StorageManager.setNutritionNote(_fdDate, input.value);
    closeFoodPortion();
    fdRender();
    _fdSyncCloud();
}

// ════════ BARCODE / PHOTO ════════
// פורמטים נפוצים למוצרי מזון (1D)
const _FD_BC_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];
// אילוצי מצלמה לסריקה חיה — רזולוציה גבוהה (ברקוד קטן/מזווית מתפענח טוב יותר) + מצלמה אחורית
const _FD_CAM_CONSTRAINTS = { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } };

let _fdPendingBarcode = null;   // ברקוד שנסרק וטרם זוהה — מוצמד למזון שייבנה מתווית (OCR)

// תחילית 729 = מוצר רשום ב-GS1 Israel (ברקוד ישראלי)
function _isIsraeliBarcode(code) { return /^729/.test(String(code || '')); }

// resolver מרוכז לברקוד: cache (נסרק בעבר — מיידי + offline) → OFF. מחזיר food או null.
async function resolveBarcode(code) {
    const c = String(code || '');
    const cached = StorageManager.getFoodDb().find(f => f.barcode && String(f.barcode) === c);
    if (cached) return cached;
    try {
        const food = await lookupBarcode(c);
        if (food) { StorageManager.upsertFoodToDb(food); return food; }
    } catch (e) {}
    return null;
}

// פענוח ברקוד מקומי מתמונה — מיידי, ללא AI וללא רשת.
// BarcodeDetector המובנה (Android/Chrome) → ZBar (iOS) → null (נפילה ל-Gemini/תווית).
// מחזיר מחרוזת ספרות או null.
async function _fdDecodeBarcode(file) {
    try {
        if ('BarcodeDetector' in window) {
            const det = new BarcodeDetector({ formats: _FD_BC_FORMATS });
            let src = file;
            if (typeof createImageBitmap === 'function') {
                try { src = await createImageBitmap(file); } catch (e) { src = file; }
            }
            const codes = await det.detect(src);
            if (src && typeof src.close === 'function') src.close();
            const hit = (codes || []).map(c => String(c.rawValue || '').replace(/\D/g, '')).find(v => v.length >= 6);
            return hit || null;
        }
        // iOS — פענוח מקומי דרך ZBar במקום נפילה מיידית ל-OCR
        if (typeof createImageBitmap !== 'function') return null;
        try { await _fdLoadZBar(); } catch (e) { return null; }
        let bmp = null;
        try { bmp = await createImageBitmap(file); } catch (e) { return null; }
        const hit = await _fdZBarDecode(bmp, bmp.width, bmp.height);
        if (bmp && typeof bmp.close === 'function') bmp.close();
        return hit || null;
    } catch (e) { return null; }
}

function fdScanPhoto() {
    _fdPhotoMode = 'label';
    document.getElementById('fd-cam-input').click();
}

// הערכת מנה מצילום האוכל עצמו — Gemini מעריך משקל ומאקרו, והמשתמש מכוון
function fdEstimateMeal() {
    if (!StorageManager.getAIConfig().apiKey) {
        showAlert('להערכת מנה מתמונה נדרש מפתח Gemini (הגדרות → AI Coach).');
        return;
    }
    _fdPhotoMode = 'meal';
    document.getElementById('fd-cam-input').click();
}

function fdOnPhoto(file) {
    if (!file) return;
    if (_fdPhotoMode === 'meal') { _fdOnMealPhoto(file); return; }
    const box = document.getElementById('fd-results');
    if (box) box.innerHTML = '<div class="fd-loading">📷 קורא את התווית/ברקוד…</div>';
    // נתיב מהיר: פענוח ברקוד מקומי (ללא AI/רשת). הצליח → cache/OFF דרך resolveBarcode.
    _fdPendingBarcode = null;
    _fdDecodeBarcode(file).then(async code => {
        if (code) {
            const food = await resolveBarcode(code);
            if (food) { _fdOpenPortion(food, null); return true; }
            _fdPendingBarcode = code;   // לא נמצא — נצמיד לתווית שתצולם (OCR)
        }
        return false;
    }).then(done => {
        if (done) return;
        // אין ברקוד מקומי (iOS / תווית בלבד) → נפילה ל-Gemini לקריאת תווית
        if (!StorageManager.getAIConfig().apiKey) {
            if (box) box.innerHTML = '<div class="fd-empty">לא זוהה ברקוד. לקריאת <b>תווית ערכים</b> נדרש מפתח Gemini (הגדרות → AI Coach), או חפש ידנית.</div>';
            return;
        }
        _fdLabelViaGemini(file, box);
    });
}

// קריאת תווית ערך תזונתי דרך Gemini — נתיב הנפילה כשאין ברקוד מפוענח מקומית
function _fdLabelViaGemini(file, box) {
    if (box) box.innerHTML = '<div class="fd-loading">📷 קורא את התווית…</div>';
    _fileToBase64(file).then(({ base64, mime }) => _callGeminiFood(base64, mime)).then(async res => {
        // אם זוהה ברקוד מהתווית — חיפוש דרך resolveBarcode (cache/OFF)
        if (res && res.barcode && /^\d{6,}$/.test(String(res.barcode))) {
            const food = await resolveBarcode(String(res.barcode).replace(/\D/g, ''));
            if (food) { _fdPendingBarcode = null; _fdOpenPortion(food, null); return; }
        }
        // אחרת — בניית מזון חד-פעמי מערכי התווית; הצמדת הברקוד שנסרק (אם יש) → נשמר ל-cache
        if (res && res.kcal != null) {
            const bc = _fdPendingBarcode || (res.barcode ? String(res.barcode).replace(/\D/g, '') : null);
            _fdPendingBarcode = null;
            const per100 = { kcal: Math.round(res.kcal), p: _fdR(res.protein), c: _fdR(res.carbs), f: _fdR(res.fat) }; // מנה≈100g כברירת מחדל; המשתמש יתקן
            const food = { id: bc ? 'off:' + bc : 'gemini:' + Date.now().toString(36), name: res.name || 'מזון מהתמונה', brand: '', barcode: bc, source: 'gemini', per100, servings: [{ label: '100 גרם', grams: 100 }] };
            StorageManager.upsertFoodToDb(food);
            _fdOpenPortion(food, null);
            return;
        }
        if (box) box.innerHTML = '<div class="fd-empty">⚠ לא זוהו ערכים מהתמונה — חפש ידנית או צור מזון מותאם.</div>';
    }).catch(() => {
        if (box) box.innerHTML = '<div class="fd-empty">⚠ קריאת התמונה נכשלה — חפש ידנית.</div>';
    });
}

// ════════ LIVE BARCODE SCAN ════════
// מצלמה חיה + פענוח בלולאה. BarcodeDetector מועדף (קל); ZXing כ-fallback (iOS).
let _fdLiveStream = null, _fdLiveRAF = null, _fdLiveReader = null, _fdLiveActive = false;
let _fdLiveTimer = null, _fdTorchTrack = null, _fdTorchOn = false;

// כיוון מצלמה אחרי פתיחת הסטרים — autofocus רציף + זיהוי תמיכת פנס. guarded: no-op בשקט כש-API חסר (iOS Safari).
async function _fdTuneCamera(stream) {
    _fdTorchTrack = null; _fdTorchOn = false;
    _fdLiveTorchBtn(false);
    try {
        const track = stream && stream.getVideoTracks && stream.getVideoTracks()[0];
        if (!track || !track.getCapabilities) return;
        const caps = track.getCapabilities() || {};
        if (caps.focusMode && caps.focusMode.indexOf && caps.focusMode.indexOf('continuous') >= 0) {
            try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) {}
        }
        if (caps.torch) { _fdTorchTrack = track; _fdLiveTorchBtn(true); }
    } catch (e) {}
}

function _fdLiveTorchBtn(show) { const b = document.getElementById('fd-live-torch'); if (b) b.style.display = show ? 'inline-flex' : 'none'; }

// כיוון מצלמה ברגע שהסטרים מתחבר ל-<video> (נתיב ZXing — לא נסמכים על ה-promise של הסורק)
function _fdTuneWhenReady(video, tries) {
    tries = tries || 0;
    const stream = video && video.srcObject;
    if (stream && stream.getVideoTracks && stream.getVideoTracks().length) { _fdTuneCamera(stream); return; }
    if (tries < 20 && _fdLiveActive) setTimeout(() => _fdTuneWhenReady(video, tries + 1), 100);
}

// הדלקה/כיבוי פנס המצלמה — לתאורה חלשה. נתמך בעיקר ב-Android/Chrome.
async function fdLiveToggleTorch() {
    if (!_fdTorchTrack) return;
    _fdTorchOn = !_fdTorchOn;
    try { await _fdTorchTrack.applyConstraints({ advanced: [{ torch: _fdTorchOn }] }); }
    catch (e) { _fdTorchOn = false; return; }
    const b = document.getElementById('fd-live-torch');
    if (b) b.classList.toggle('on', _fdTorchOn);
}

// טעינה עצלה של ZXing — רק כשנכנסים למצב חי בפלטפורמה ללא BarcodeDetector
function _fdLoadZXing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'vendor/zxing.min.js';
        s.onload = () => window.ZXing ? resolve(window.ZXing) : reject(new Error('ZXING_LOAD'));
        s.onerror = () => reject(new Error('ZXING_LOAD'));
        document.head.appendChild(s);
    });
}

// טעינה עצלה של ZBar (WASM, wasm מוטמע) — מנוע הפענוח החזק ל-iOS (חלופה ל-ZXing).
// סורק את הפריים המלא בשתי צפיפויות → קורא ברקוד רחוק, לא-ממורכז, ומסובב 90°.
function _fdLoadZBar() {
    if (window.zbarWasm) return Promise.resolve(window.zbarWasm);
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'vendor/zbar.js';
        s.onload = () => window.zbarWasm ? resolve(window.zbarWasm) : reject(new Error('ZBAR_LOAD'));
        s.onerror = () => reject(new Error('ZBAR_LOAD'));
        document.head.appendChild(s);
    });
}

// פענוח ברקוד מ-ImageBitmapSource (video/canvas) דרך ZBar → מחזיר ספרות או null.
async function _fdZBarDecode(source, w, h) {
    if (!window.zbarWasm) return null;
    try {
        const canvas = _fdZBarDecode._cv || (_fdZBarDecode._cv = document.createElement('canvas'));
        const ctx = _fdZBarDecode._ctx || (_fdZBarDecode._ctx = canvas.getContext('2d', { willReadFrequently: true }));
        if (!w || !h) return null;
        canvas.width = w; canvas.height = h;
        ctx.drawImage(source, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const syms = await window.zbarWasm.scanImageData(img);
        return (syms || []).map(s => String(s.decode() || '').replace(/\D/g, '')).find(v => v.length >= 6) || null;
    } catch (e) { return null; }
}

function _fdLiveSetMsg(txt) { const el = document.getElementById('fd-live-msg'); if (el) el.textContent = txt; }
function _fdLiveRetry(show) { const b = document.getElementById('fd-live-retry'); if (b) b.style.display = show ? 'inline-flex' : 'none'; }
function _fdLiveLabelBtn(show) { const b = document.getElementById('fd-live-label'); if (b) b.style.display = show ? 'inline-flex' : 'none'; }

// "צלם תווית" מתוך סריקה חיה שלא מצאה מוצר — סוגר את המצלמה ופותח צילום תווית.
// _fdPendingBarcode כבר מוגדר → המזון שייבנה מה-OCR יישמר עם הברקוד (זיהוי חד-פעמי).
function fdLiveSnapLabel() { fdLiveScanStop(); fdScanPhoto(); }
function _fdStopStream() {
    if (_fdLiveStream) { _fdLiveStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); _fdLiveStream = null; }
}
function _fdLiveTeardownCamera() {
    if (_fdLiveRAF) { cancelAnimationFrame(_fdLiveRAF); _fdLiveRAF = null; }
    if (_fdLiveTimer) { clearTimeout(_fdLiveTimer); _fdLiveTimer = null; }
    // כיבוי פנס לפני עצירת ה-track (שלא יישאר דולק)
    if (_fdTorchTrack && _fdTorchOn) { try { _fdTorchTrack.applyConstraints({ advanced: [{ torch: false }] }); } catch (e) {} }
    _fdTorchTrack = null; _fdTorchOn = false; _fdLiveTorchBtn(false);
    if (_fdLiveReader) { try { _fdLiveReader.reset(); } catch (e) {} _fdLiveReader = null; }
    _fdStopStream();
    const v = document.getElementById('fd-live-video');
    if (v) { try { v.pause(); } catch (e) {} v.srcObject = null; }
}

async function fdLiveScanStart() {
    const ov = document.getElementById('fd-live');
    if (!ov) return;
    ov.style.display = 'flex';
    _fdLiveActive = true;
    _fdLiveRetry(false);
    _fdLiveLabelBtn(false);
    const video = document.getElementById('fd-live-video');
    if ('BarcodeDetector' in window) {
        _fdLiveSetMsg('מפעיל מצלמה…');
        try {
            _fdLiveStream = await navigator.mediaDevices.getUserMedia({ video: _FD_CAM_CONSTRAINTS });
        } catch (e) { _fdLiveSetMsg('אין גישה למצלמה — אשר הרשאה, או צלם/חפש ידנית.'); _fdLiveRetry(true); return; }
        if (!_fdLiveActive) { _fdStopStream(); return; }   // נסגר בזמן בקשת ההרשאה
        video.srcObject = _fdLiveStream;
        video.setAttribute('playsinline', '');
        await video.play().catch(() => {});
        await _fdTuneCamera(_fdLiveStream);
        _fdLiveSetMsg('כוון את הברקוד — לא חייב במרכז');
        _fdLiveDetectNative(video);
    } else {
        // iOS / ללא BarcodeDetector → ZBar (WASM). אנחנו מנהלים את המצלמה בעצמנו
        // (אותו getUserMedia + autofocus + פנס) וסורקים פריימים מלאים בלולאה.
        _fdLiveSetMsg('טוען סורק…');
        try { await _fdLoadZBar(); } catch (e) { _fdLiveSetMsg('טעינת הסורק נכשלה — צלם או חפש ידנית.'); _fdLiveRetry(true); return; }
        if (!_fdLiveActive) return;
        try {
            _fdLiveStream = await navigator.mediaDevices.getUserMedia({ video: _FD_CAM_CONSTRAINTS });
        } catch (e) { _fdLiveSetMsg('אין גישה למצלמה — אשר הרשאה, או צלם/חפש ידנית.'); _fdLiveRetry(true); return; }
        if (!_fdLiveActive) { _fdStopStream(); return; }   // נסגר בזמן בקשת ההרשאה
        video.srcObject = _fdLiveStream;
        video.setAttribute('playsinline', '');
        await video.play().catch(() => {});
        await _fdTuneCamera(_fdLiveStream);
        _fdLiveSetMsg('כוון את הברקוד — לא חייב במרכז');
        _fdLiveDetectZBar(video);
    }
}

// לולאת זיהוי ZBar (iOS) — פריים מלא ברזולוציה מקורית → scanImageData.
// פריים מלא = אין צורך למרכז; ZBar קורא רחוק/בזווית/מסובב 90°.
function _fdLiveDetectZBar(video) {
    const tick = async () => {
        if (!_fdLiveActive) return;
        const vw = video.videoWidth, vh = video.videoHeight;
        if (vw && vh) {
            const hit = await _fdZBarDecode(video, vw, vh);
            if (hit) { _fdLiveOnHit(hit); return; }
        }
        if (_fdLiveActive) _fdLiveTimer = setTimeout(tick, 160);
    };
    _fdLiveTimer = setTimeout(tick, 200);
}

// לולאת זיהוי מקומית (BarcodeDetector) על פריימים של הווידאו
function _fdLiveDetectNative(video) {
    let det;
    try { det = new BarcodeDetector({ formats: _FD_BC_FORMATS }); }
    catch (e) { _fdLiveSetMsg('הסורק לא נתמך במכשיר — צלם או חפש ידנית.'); _fdLiveRetry(false); return; }
    // throttle ~120ms — detect ב-1080p בלי להחניק CPU, ונותן ל-autofocus זמן להתייצב
    const tick = async () => {
        if (!_fdLiveActive) return;
        try {
            const codes = await det.detect(video);
            const hit = (codes || []).map(c => String(c.rawValue || '').replace(/\D/g, '')).find(v => v.length >= 6);
            if (hit) { _fdLiveOnHit(hit); return; }
        } catch (e) {}
        if (_fdLiveActive) _fdLiveTimer = setTimeout(tick, 120);
    };
    _fdLiveTimer = setTimeout(tick, 120);
}

// זוהה ברקוד → עצור מצלמה → חפש ב-OFF → פתח עורך כמות
async function _fdLiveOnHit(code) {
    if (!_fdLiveActive) return;
    _fdLiveActive = false;   // מנע זיהויים כפולים בזמן ה-lookup
    haptic('medium');
    _fdLiveTeardownCamera();
    _fdLiveSetMsg('נמצא ' + code + ' — טוען מוצר…');
    try {
        const food = await resolveBarcode(code);
        if (food) { fdLiveScanStop(); _fdOpenPortion(food, null); return; }
        // לא נמצא — אם יש מפתח Gemini, להציע צילום תווית (זיהוי חד-פעמי שיישמר ל-cache)
        _fdPendingBarcode = code;
        const hasAI = !!StorageManager.getAIConfig().apiKey;
        const il = _isIsraeliBarcode(code) ? 'מוצר ישראלי ' : '';
        _fdLiveSetMsg(hasAI
            ? `${il}(${code}) לא נמצא — צלם תווית לזיהוי חד-פעמי, או סרוק שוב.`
            : `${il}(${code}) לא נמצא ב-Open Food Facts.`);
        _fdLiveLabelBtn(hasAI);
    } catch (e) {
        _fdLiveSetMsg('שגיאת רשת בחיפוש המוצר.');
    }
    _fdLiveRetry(true);   // אפשר סריקה חוזרת
}

function fdLiveScanStop() {
    _fdLiveActive = false;
    _fdLiveTeardownCamera();
    const ov = document.getElementById('fd-live');
    if (ov) ov.style.display = 'none';
}

// בונה מרכיב Meal Builder מערכי הערכה (totals למרכיב) → per100 + grams
function _fdCompFromEstimate(it) {
    const g = (Number(it.grams) > 0) ? Number(it.grams) : 100;
    const f = 100 / g;
    return {
        name: it.name || 'מרכיב', grams: g,
        per100: {
            kcal: Math.round((Number(it.kcal) || 0) * f),
            p: _fdR((Number(it.protein) || 0) * f),
            c: _fdR((Number(it.carbs) || 0) * f),
            f: _fdR((Number(it.fat) || 0) * f)
        }
    };
}

// _fdOnMealPhoto — הערכת מנה מצולמת → Meal Builder עם מרכיבים ניתנים לעריכה
function _fdOnMealPhoto(file) {
    const box = document.getElementById('fd-results');
    if (box) box.innerHTML = '<div class="fd-loading">🍽️ מעריך את המנה מהתמונה…</div>';
    _fileToBase64(file).then(({ base64, mime }) => _callGeminiMeal(base64, mime)).then(res => {
        let comps = [];
        if (res && Array.isArray(res.items) && res.items.length && res.items[0] && res.items[0].kcal != null) {
            comps = res.items.filter(it => it && it.kcal != null).map(_fdCompFromEstimate);
        } else if (res && res.kcal != null) {
            // נפילה לאחור: הערכה מאוחדת → מרכיב יחיד
            comps = [_fdCompFromEstimate({ name: res.name || 'מנה', grams: res.grams, kcal: res.kcal, protein: res.protein, carbs: res.carbs, fat: res.fat })];
        }
        if (!comps.length) {
            if (box) box.innerHTML = '<div class="fd-empty">⚠ לא הצלחתי להעריך את המנה — נסה תמונה ברורה יותר או חפש ידנית.</div>';
            return;
        }
        _fdOpenMealBuilder({ name: (res && res.name) || 'מנה מהתמונה', components: comps, meal: _fdMeal, time: _fdNowTime(), editId: null });
    }).catch(() => {
        if (box) box.innerHTML = '<div class="fd-empty">⚠ הערכת המנה נכשלה — נסה שוב או חפש ידנית.</div>';
    });
}

// ════════ MEAL BUILDER — מנה מורכבת עם מרכיבים ניתנים לעריכה ════════
function _fdOpenMealBuilder(opts) {
    _fdCompPickMode = false;
    _fdMealComponents = (opts.components || []).map(c => ({ name: c.name, grams: c.grams, per100: c.per100, baseUnit: c.baseUnit || 'g' }));
    _fdMealEditId = opts.editId || null;
    _fdMeal = opts.meal || _fdMealLabels()[0];
    const sheet = document.getElementById('fd-meal-sheet');
    const body = document.getElementById('fd-meal-body');
    if (!sheet || !body) return;
    const time = opts.time || _fdNowTime();
    body.innerHTML = `
        <input type="text" id="fd-meal-name-inp" class="fd-meal-name-inp" value="${_fdEsc(opts.name || 'מנה')}" placeholder="שם המנה">
        <div class="fd-meal-total">
            <span class="fd-meal-total-kcal" id="fd-meal-total-kcal">0</span><span class="fd-meal-total-unit">kcal</span>
            <span class="fd-meal-total-macros" id="fd-meal-total-macros"></span>
        </div>
        <div class="fd-comp-list" id="fd-comp-list"></div>
        <div class="fd-comp-addrow">
            <button class="fd-comp-add" onclick="fdMealSearchComponent()"><span class="material-symbols-outlined">search</span>חפש מרכיב</button>
            <button class="fd-comp-add fd-comp-add--manual" onclick="fdMealAddComponent()"><span class="material-symbols-outlined">edit</span>ידני</button>
        </div>
        <div class="fd-meal-chips">${_fdMealChipsHTML(_fdMeal)}</div>
        <label class="fd-field fd-field--full" style="margin-bottom:14px;"><span>שעה</span><input type="time" id="fd-meal-time" value="${time}"></label>
        <div class="fd-portion-actions">
            ${_fdMealEditId ? `<button class="fd-del-btn" onclick="fdMealDeleteEntry()"><span class="material-symbols-outlined">delete</span></button>` : ''}
            <button class="fd-save-btn" onclick="fdSaveMeal()">${_fdMealEditId ? 'עדכן מנה' : 'הוסף ליומן'}</button>
        </div>`;
    _fdRenderComponents();
    document.getElementById('fd-meal-overlay').style.display = 'block';
    sheet.classList.add('open');
    haptic('light');
}

function _fdRenderComponents() {
    const list = document.getElementById('fd-comp-list');
    if (!list) return;
    list.innerHTML = _fdMealComponents.map((c, i) => {
        const p = c.per100 || (c.per100 = { kcal: 0, p: 0, c: 0, f: 0 });
        const isUnit = c.baseUnit === 'unit';
        const kcal = Math.round((p.kcal || 0) * (isUnit ? c.grams : c.grams / 100));
        return `<div class="fd-comp">
            <div class="fd-comp-main">
                <input class="fd-comp-name-inp" id="fd-mc-n-${i}" value="${_fdEsc(c.name)}" oninput="_fdMealRecalc()" placeholder="שם המרכיב">
                <div class="fd-comp-per100"><span class="fd-comp-per100-lbl">${isUnit ? 'ליחידה:' : "ל-100ג':"}</span>
                    <span class="fd-comp-cell"><input id="fd-mc-k100-${i}" inputmode="decimal" step="any" value="${_fdR(p.kcal)}" oninput="_fdMealRecalc()"><small>קל'</small></span>
                    <span class="fd-comp-cell"><input id="fd-mc-p100-${i}" inputmode="decimal" step="any" value="${_fdR(p.p)}" oninput="_fdMealRecalc()"><small class="macro-p">ח</small></span>
                    <span class="fd-comp-cell"><input id="fd-mc-c100-${i}" inputmode="decimal" step="any" value="${_fdR(p.c)}" oninput="_fdMealRecalc()"><small class="macro-c">פ</small></span>
                    <span class="fd-comp-cell"><input id="fd-mc-f100-${i}" inputmode="decimal" step="any" value="${_fdR(p.f)}" oninput="_fdMealRecalc()"><small class="macro-f">ש</small></span>
                </div>
                <span class="fd-comp-kcal"><b id="fd-mc-kc-${i}">${_fdFmt(kcal)}</b> kcal למרכיב<span class="fd-comp-warn" id="fd-mc-warn-${i}" style="display:none" title=""> ⚠</span></span>
            </div>
            <div class="fd-comp-qty">
                <input type="number" id="fd-mc-g-${i}" inputmode="decimal" min="0" step="any" value="${_fdR(c.grams)}" oninput="_fdMealRecalc()">
                <span class="fd-comp-unit">${isUnit ? 'יחידות' : 'גרם'}</span>
            </div>
            <button class="fd-comp-del" onclick="fdMealRemoveComp(${i})" aria-label="הסר מרכיב"><span class="material-symbols-outlined">close</span></button>
        </div>`;
    }).join('') || '<div class="fd-meal-empty">אין מרכיבים — הוסף מרכיב</div>';
    _fdMealRecalc();
}

function _fdMealRecalc() {
    let tot = { kcal: 0, p: 0, c: 0, f: 0 };
    _fdMealComponents.forEach((c, i) => {
        const gEl = document.getElementById('fd-mc-g-' + i);
        if (gEl) c.grams = Number(gEl.value) || 0;
        const nEl = document.getElementById('fd-mc-n-' + i);
        if (nEl) c.name = nEl.value;
        const per = c.per100 || (c.per100 = { kcal: 0, p: 0, c: 0, f: 0 });
        const kEl = document.getElementById('fd-mc-k100-' + i); if (kEl) per.kcal = Number(kEl.value) || 0;
        const pEl = document.getElementById('fd-mc-p100-' + i); if (pEl) per.p = Number(pEl.value) || 0;
        const cEl = document.getElementById('fd-mc-c100-' + i); if (cEl) per.c = Number(cEl.value) || 0;
        const fEl = document.getElementById('fd-mc-f100-' + i); if (fEl) per.f = Number(fEl.value) || 0;
        const f = c.baseUnit === 'unit' ? c.grams : c.grams / 100;
        const kcal = Math.round((per.kcal || 0) * f);
        tot.kcal += kcal; tot.p += (per.p || 0) * f; tot.c += (per.c || 0) * f; tot.f += (per.f || 0) * f;
        const kcEl = document.getElementById('fd-mc-kc-' + i);
        if (kcEl) kcEl.textContent = _fdFmt(kcal);
        const warnEl = document.getElementById('fd-mc-warn-' + i);
        if (warnEl) {
            const mismatch = _fdKcalMismatch(kcal, per.p * f, per.c * f, per.f * f);
            warnEl.style.display = mismatch ? '' : 'none';
            warnEl.title = mismatch ? `קלוריות (${_fdR(per.kcal)} ל-${c.baseUnit === 'unit' ? 'יחידה' : "100ג'"}) לא תואמות מאקרו (סטייה ${Math.round(mismatch * 100)}%)` : '';
        }
    });
    const tk = document.getElementById('fd-meal-total-kcal');
    const tm = document.getElementById('fd-meal-total-macros');
    if (tk) tk.textContent = _fdFmt(tot.kcal);
    if (tm) tm.innerHTML = `<i class="macro-p">חלבון ${Math.round(tot.p)}</i><i class="macro-c">פחמ' ${Math.round(tot.c)}</i><i class="macro-f">שומן ${Math.round(tot.f)}</i>`;
}

function fdMealRemoveComp(i) {
    _fdMealComponents.splice(i, 1);
    _fdRenderComponents();
    haptic('light');
}

// חיפוש מרכיב מהמאגר — פותח את שיט החיפוש במצב בחירה, מעל ה-Meal Builder
function fdMealSearchComponent() {
    _fdCompPickMode = true;
    document.body.classList.add('fd-comp-pick');   // מרים את שיט החיפוש מעל ה-Meal Builder
    fdOpenAdd(_fdMeal);   // שומר את הארוחה הנוכחית; בחירת תוצאה → _fdAddComponentFromFood
}

// הוספת מרכיב ידני — שורה ניתנת לעריכה (שם + ערכים ל-100ג' + גרמים)
function fdMealAddComponent() {
    _fdMealComponents.push({ name: '', grams: 100, per100: { kcal: 0, p: 0, c: 0, f: 0 } });
    _fdRenderComponents();
    const last = _fdMealComponents.length - 1;
    setTimeout(() => { const el = document.getElementById('fd-mc-n-' + last); if (el) el.focus(); }, 60);
}

function closeFoodMeal() {
    const ov = document.getElementById('fd-meal-overlay');
    if (ov) ov.style.display = 'none';
    const sh = document.getElementById('fd-meal-sheet');
    if (sh) sh.classList.remove('open');
}

function fdSaveMeal() {
    _fdMealRecalc();
    const comps = _fdMealComponents.filter(c => c.grams > 0).map(c => {
        const f = c.baseUnit === 'unit' ? c.grams : c.grams / 100;
        return {
            name: (c.name || '').trim() || 'מרכיב', grams: c.grams, per100: c.per100, baseUnit: c.baseUnit || 'g',
            kcal: Math.round((c.per100.kcal || 0) * f), p: _fdR((c.per100.p || 0) * f),
            c: _fdR((c.per100.c || 0) * f), f: _fdR((c.per100.f || 0) * f)
        };
    });
    if (!comps.length) { showAlert('הוסף לפחות מרכיב אחד עם כמות.'); return; }
    const sum = comps.reduce((a, x) => { a.kcal += x.kcal; a.p += x.p; a.c += x.c; a.f += x.f; return a; }, { kcal: 0, p: 0, c: 0, f: 0 });
    const name = (document.getElementById('fd-meal-name-inp')?.value || 'מנה').trim() || 'מנה';
    const time = document.getElementById('fd-meal-time')?.value || _fdNowTime();
    const entry = {
        name, brand: 'מנה', source: 'gemini', barcode: null,
        meal: _fdMeal || _fdMealLabels()[0], time, components: comps,
        kcal: Math.round(sum.kcal), p: _fdR(sum.p), c: _fdR(sum.c), f: _fdR(sum.f)
    };
    if (_fdMealEditId) StorageManager.updateFoodEntry(_fdDate, _fdMealEditId, entry);
    else StorageManager.addFoodEntry(_fdDate, entry);
    closeFoodMeal();
    closeFoodAdd();
    fdRender();
    _fdSyncCloud();
    haptic('medium');
}

function fdMealDeleteEntry() {
    if (!_fdMealEditId) return;
    StorageManager.deleteFoodEntry(_fdDate, _fdMealEditId);
    closeFoodMeal();
    fdRender();
    _fdSyncCloud();
    haptic('warning');
}

// ייצוא יומן המזון/המאגר המקומי הוסר — הכל מסונכרן לפיירבייס (מסמך config).
// ייצוא תזונה מרוכז: exportNutritionDailyJson / exportNutritionDetailedJson (bodylog-logic.js).
