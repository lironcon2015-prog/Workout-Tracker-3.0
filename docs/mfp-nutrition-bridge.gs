/**
 * GYMPRO ELITE — MyFitnessPal Nutrition Bridge (Google Apps Script)
 * ----------------------------------------------------------------------------
 * גשר צד-שרת שרץ בחשבון ה-Gmail שלך. מאתר את מייל הייצוא האחרון של
 * MyFitnessPal, מוריד את ה-ZIP מ-S3 (עוקף CORS — ההורדה קורית בשרת),
 * מחלץ את Nutrition-Summary CSV, מאגד לפי יום ומחזיר JSON נקי.
 *
 * ── פריסה (חד-פעמי) ─────────────────────────────────────────────────────────
 * 1. היכנס ל-https://script.google.com → New project.
 * 2. הדבק את כל הקובץ הזה. שנה את SECRET_TOKEN לערך אקראי משלך.
 * 3. Deploy → New deployment → type: Web app.
 *      - Execute as:  Me
 *      - Who has access: Anyone (ה-token מגן על הגישה)
 * 4. אשר את ההרשאות (קריאת Gmail + גישה לרשת).
 * 5. העתק את "Web app URL" → הדבק בהגדרות GYMPRO + את ה-SECRET_TOKEN.
 *
 * בדיקה: פתח בדפדפן  <WebAppURL>?token=<SECRET_TOKEN>  ← אמור להחזיר JSON.
 * ==========================================================================*/

// 🔐 שנה לערך אקראי משלך (אותיות/ספרות). העתק אותו גם להגדרות GYMPRO.
const SECRET_TOKEN = 'CHANGE_ME_to_a_random_secret';

// חיפוש המייל האחרון של ייצוא MFP
const MFP_QUERY = 'from:no-reply@myfitnesspal.com subject:"Your MyFitnessPal Export"';

function doGet(e) {
  const result = _run(e);
  // JSONP — אם הועבר callback, עוטף את ה-JSON בקריאה לפונקציה (עוקף CORS בדפדפן).
  const cb = e && e.parameter && e.parameter.callback;
  if (cb) {
    return ContentService
      .createTextOutput(cb + '(' + JSON.stringify(result) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return _json(result);
}

function _run(e) {
  try {
    const token = (e && e.parameter && e.parameter.token) || '';
    if (token !== SECRET_TOKEN) return { ok: false, error: 'BAD_TOKEN' };

    const threads = GmailApp.search(MFP_QUERY, 0, 1);
    if (!threads.length) return { ok: false, error: 'NO_EXPORT_EMAIL' };

    const msgs = threads[0].getMessages();
    const msg = msgs[msgs.length - 1];          // ההודעה האחרונה בשרשור
    const html = msg.getBody();

    // חילוץ קישור ה-ZIP מ-S3 מתוך גוף ה-HTML
    const m = html.match(/https:\/\/[^"'<>\s]*s3\.amazonaws\.com[^"'<>\s]*\.zip[^"'<>\s]*/i);
    if (!m) return { ok: false, error: 'NO_DOWNLOAD_LINK' };

    // ניקוי entities שעלולים להופיע ב-HTML
    const zipUrl = m[0].replace(/&amp;/g, '&');

    const resp = UrlFetchApp.fetch(zipUrl, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return { ok: false, error: 'LINK_EXPIRED' };

    const blob = resp.getBlob().setContentType('application/zip');
    const files = Utilities.unzip(blob);
    const csv = files.filter(function (f) {
      return /Nutrition-Summary.*\.csv$/i.test(f.getName());
    })[0];
    if (!csv) return { ok: false, error: 'NO_NUTRITION_CSV' };

    const rawText = csv.getDataAsString();
    const days = _aggregateNutrition(rawText);
    return {
      ok: true,
      source: 'MyFitnessPal',
      emailDate: Utilities.formatDate(msg.getDate(), 'UTC', 'yyyy-MM-dd'),
      days: days,
      rawCsv: rawText          // הקובץ הגולמי המקורי (שורה לכל ארוחה) — לייצוא נאמן
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * _aggregateNutrition — מקבל CSV של Nutrition-Summary (שורה לכל ארוחה)
 * ומאגד לפי תאריך: סכום קלוריות/חלבון/פחמימה/שומן + מספר ארוחות.
 */
function _aggregateNutrition(text) {
  const rows = Utilities.parseCsv(text);
  if (!rows || rows.length < 2) return [];
  const head = rows[0].map(function (h) { return String(h).toLowerCase().trim(); });
  const idx = function (kw) { for (var i = 0; i < head.length; i++) if (head[i].indexOf(kw) === 0 || head[i] === kw) return i; return -1; };
  const ci = {
    date: _find(head, ['date']),
    cal:  _find(head, ['calories']),
    prot: _find(head, ['protein']),
    carb: _find(head, ['carbohydrates', 'carbs']),
    fat:  _find(head, ['fat (g)', 'fat'])
  };
  if (ci.date < 0) return [];

  const map = {};
  for (var r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const d = (cells[ci.date] || '').trim();
    if (!d) continue;
    if (!map[d]) map[d] = { date: d, calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 };
    map[d].calories += _num(cells[ci.cal]);
    map[d].protein  += _num(cells[ci.prot]);
    map[d].carbs    += _num(cells[ci.carb]);
    map[d].fat      += _num(cells[ci.fat]);
    map[d].meals    += 1;
  }
  return Object.keys(map).sort().map(function (k) {
    const o = map[k];
    return {
      date: o.date,
      calories: Math.round(o.calories),
      protein: Math.round(o.protein),
      carbs: Math.round(o.carbs),
      fat: Math.round(o.fat),
      meals: o.meals
    };
  });
}

// מאתר את אינדקס העמודה לפי הראשונה מבין מילות-המפתח שמופיעה בכותרת
function _find(head, kws) {
  for (var k = 0; k < kws.length; k++)
    for (var i = 0; i < head.length; i++)
      if (head[i].indexOf(kws[k]) !== -1) return i;
  return -1;
}

function _num(v) {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
