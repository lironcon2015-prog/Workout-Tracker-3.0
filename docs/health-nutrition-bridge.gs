/**
 * GYMPRO ELITE — Apple Health Nutrition Bridge (Google Apps Script)
 * ----------------------------------------------------------------------------
 * גשר עצמאי וקטן: קיצור דרך (iOS Shortcuts) דוחף אליו נתוני תזונה יומיים
 * מ-Apple Health (קלוריות + מאקרו), והאפליקציה מושכת ב-JSONP בכל כניסה/שעה.
 *
 * אין תלות ב-Firestore או ב-Service Account — האחסון הוא PropertiesService
 * של הסקריפט עצמו (נתוני מאקרו יומיים זעירים; נשמרים ~120 ימים אחרונים).
 * MFP נשאר מקור האמת: האפליקציה לעולם לא דורסת יום MFP בנתוני Health.
 *
 * ── פריסה (חד-פעמי, זהה לגשר ה-MFP) ────────────────────────────────────────
 * 1. היכנס ל-https://script.google.com → New project.
 * 2. הדבק את כל הקובץ הזה. שנה את SECRET_TOKEN לערך אקראי משלך.
 * 3. Deploy → New deployment → type: Web app.
 *      - Execute as:  Me
 *      - Who has access: Anyone (ה-token מגן על הגישה)
 * 4. העתק את "Web app URL" → הדבק בהגדרות GYMPRO ("גשר תזונה Apple Health")
 *    יחד עם ה-SECRET_TOKEN.
 * 5. בנה את הקיצור לפי docs/health-shortcut-recipe.md.
 *
 * בדיקה: פתח בדפדפן  <WebAppURL>?token=<SECRET_TOKEN>  ← אמור להחזיר JSON.
 * ==========================================================================*/

// 🔐 שנה לערך אקראי משלך (אותיות/ספרות). העתק אותו גם להגדרות GYMPRO ולקיצור.
const SECRET_TOKEN = 'CHANGE_ME_to_a_random_secret';

const STORE_KEY = 'health_days';   // property שמחזיק את כל הימים
const MAX_DAYS  = 120;             // שמירת ~4 חודשים אחרונים (מתחת למגבלת 9KB)

/* ─── קליטה מהקיצור (POST) ────────────────────────────────────────────────
 * Body (JSON): { "token": "...", "days": [
 *   { "date": "2026-06-11", "calories": 2450, "protein": 180, "carbs": 220, "fat": 80 }
 * ] }
 * date בפורמט YYYY-MM-DD. ימים קיימים נדרסים (העדכני מנצח — היום מתעדכן בכל דחיפה).
 */
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return _json({ ok: false, error: 'BAD_JSON' }); }

  if (!body || body.token !== SECRET_TOKEN) return _json({ ok: false, error: 'BAD_TOKEN' });
  var incoming = Array.isArray(body.days) ? body.days : [];
  if (!incoming.length) return _json({ ok: false, error: 'NO_DAYS' });

  // נעילה — שתי דחיפות במקביל לא ידרסו זו את זו
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var map = _load();
    var stored = 0;
    incoming.forEach(function (d) {
      var date = _isoDate(d && d.date);
      if (!date) return;
      map[date] = [
        Math.round(Number(d.calories) || 0),
        Math.round(Number(d.protein)  || 0),
        Math.round(Number(d.carbs)    || 0),
        Math.round(Number(d.fat)      || 0)
      ];
      stored++;
    });
    _save(map);
    return _json({ ok: true, stored: stored, total: Object.keys(map).length });
  } finally {
    lock.releaseLock();
  }
}

/* ─── שליפה לאפליקציה (GET, JSONP) ────────────────────────────────────────
 * <URL>?token=...&callback=cb  ←  cb({ ok:true, days:[{date,calories,protein,carbs,fat},…] })
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var result;
  if (p.token !== SECRET_TOKEN) {
    result = { ok: false, error: 'BAD_TOKEN' };
  } else {
    var map = _load();
    var days = Object.keys(map).sort().map(function (date) {
      var v = map[date];
      return { date: date, calories: v[0], protein: v[1], carbs: v[2], fat: v[3] };
    });
    result = { ok: true, days: days };
  }

  var json = JSON.stringify(result);
  if (p.callback && /^[\w.]+$/.test(p.callback)) {
    return ContentService.createTextOutput(p.callback + '(' + json + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/* ─── אחסון קומפקטי: { "YYYY-MM-DD": [cal,prot,carb,fat], … } ───────────── */
function _load() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(STORE_KEY)) || {}; }
  catch (e) { return {}; }
}

function _save(map) {
  // גיזום לימים האחרונים — שומר את הערך מתחת למגבלת property
  var dates = Object.keys(map).sort();
  while (dates.length > MAX_DAYS) delete map[dates.shift()];
  PropertiesService.getScriptProperties().setProperty(STORE_KEY, JSON.stringify(map));
}

// מנרמל תאריך ל-YYYY-MM-DD; דוחה כל דבר אחר
function _isoDate(s) {
  var m = String(s || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? (m[1] + '-' + m[2] + '-' + m[3]) : null;
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
}
