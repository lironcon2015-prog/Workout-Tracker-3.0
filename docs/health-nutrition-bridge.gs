/**
 * GYMPRO ELITE — Apple Health Bridge (Google Apps Script)
 * ----------------------------------------------------------------------------
 * גשר עצמאי וקטן: קיצור דרך (iOS Shortcuts) דוחף אליו נתונים יומיים מ-Apple
 * Health, והאפליקציה מושכת ב-JSONP בכל כניסה/שעה.
 *
 * נושא שני סוגי דאטה, שני property נפרדים, אותו token/URL:
 *   • שינה + התאוששות (המקור העיקרי) — property 'sleep_days'
 *   • תזונה (קלוריות + מאקרו, אופציונלי — אם חוזרים ל-MFP) — property 'health_days'
 *
 * קולט שני פורמטים של שינה:
 *   • קיצור iOS — פורמט שטוח ({date,asleep,…}) או {sleep:[…]}
 *   • Health Auto Export (REST API) — { data:{ metrics:[…] } } (טוטלים יומיים
 *     מעובדים, תואמים לאפליקציית Health). מומלץ — מדויק יותר מדגימות הגלם של הקיצור.
 *     ב-HAE: הפעל Aggregate, שים את ה-token ב-URL (…/exec?token=…), פורמט JSON.
 *
 * אין תלות ב-Firestore או ב-Service Account — האחסון הוא PropertiesService
 * של הסקריפט עצמו (רשומות זעירות; נשמרים ~120 ימים אחרונים לכל סוג).
 *
 * ── פריסה (חד-פעמי) ────────────────────────────────────────────────────────
 * 1. היכנס ל-https://script.google.com → New project.
 * 2. הדבק את כל הקובץ הזה. שנה את SECRET_TOKEN לערך אקראי משלך.
 * 3. Deploy → New deployment → type: Web app.
 *      - Execute as:  Me
 *      - Who has access: Anyone (ה-token מגן על הגישה)
 * 4. העתק את "Web app URL" → הדבק בהגדרות GYMPRO ("גשר Apple Health (שינה)")
 *    יחד עם ה-SECRET_TOKEN.
 * 5. בנה את הקיצור לפי docs/sleep-shortcut-recipe.md.
 *
 * בדיקה: פתח בדפדפן  <WebAppURL>?token=<SECRET_TOKEN>  ← אמור להחזיר JSON.
 * ==========================================================================*/

// 🔐 שנה לערך אקראי משלך (אותיות/ספרות). העתק אותו גם להגדרות GYMPRO ולקיצור.
const SECRET_TOKEN = 'CHANGE_ME_to_a_random_secret';

const NUTRI_KEY = 'health_days';   // תזונה: [cal,prot,carb,fat]
const SLEEP_KEY = 'sleep_days';    // שינה: [asleep,inbed,deep,rem,core,awake,rhr,hrv,resp,temp]
const MAX_DAYS  = 120;             // שמירת ~4 חודשים אחרונים לכל סוג

// 🐞 דיבאג זמני: שומר את גוף ה-POST הגולמי האחרון, לשליפה בדפדפן דרך
//    <URL>?token=…&raw=1 (לאימות פורמט HAE בפעם הראשונה — בלי מייל, הכל אצלך).
//    אחרי שראית שהנתונים נכונים — שנה ל-false ופרוס מחדש.
const DEBUG_RAW = true;
const RAW_KEY   = 'last_raw';

/* ─── קליטה מהקיצור (POST) ────────────────────────────────────────────────
 * גוף JSON יכול לכלול אחד או שניים:
 *   שינה:  { "token":"...", "sleep":[ { "date":"2026-07-20", "asleep":434, "inbed":471,
 *            "deep":82, "rem":98, "core":254, "awake":37, "rhr":47, "hrv":74,
 *            "resp":13.7, "temp":-0.1 } ] }
 *   תזונה: { "token":"...", "days":[ { "date":"2026-07-20", "calories":2450,
 *            "protein":180, "carbs":220, "fat":80 } ] }
 * date בפורמט YYYY-MM-DD. ימים קיימים נדרסים (העדכני מנצח).
 */
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return _json({ ok: false, error: 'BAD_JSON' }); }

  var tok = (body && body.token) || (e && e.parameter && e.parameter.token) || '';
  if (tok !== SECRET_TOKEN) return _json({ ok: false, error: 'BAD_TOKEN' });

  // דיבאג: שמור את ה-payload הגולמי האחרון לשליפה דרך doGet (?raw=1). בלי מייל.
  if (DEBUG_RAW) {
    try { PropertiesService.getScriptProperties()
      .setProperty(RAW_KEY, String((e.postData && e.postData.contents) || '')); }
    catch (err) {}
  }

  var incNutri = Array.isArray(body.days)  ? body.days  : [];
  var incSleep = Array.isArray(body.sleep) ? body.sleep : [];
  // Health Auto Export (REST API): { data:{ metrics:[…] } } — ממזג לפי תאריך.
  if (!incSleep.length && body.data && Array.isArray(body.data.metrics)) {
    incSleep = _parseHAE(body.data.metrics);
  }
  // תמיכה בפורמט שטוח: לילה בודד ברמת השורש (בלי מערך "sleep") — מקל מאוד על
  // בניית הקיצור ב-iOS (אין צורך במערך/מילון מקוננים, רק שדות פשוטים).
  if (!incSleep.length && body.date && (body.asleep != null || body.inbed != null ||
      body.deep != null || body.rem != null || body.core != null || body.awake != null ||
      body.hrv != null || body.rhr != null || body.resp != null || body.temp != null)) {
    incSleep = [body];
  }
  if (!incNutri.length && !incSleep.length) return _json({ ok: false, error: 'NO_DATA' });

  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var out = { ok: true };

    if (incNutri.length) {
      var nMap = _load(NUTRI_KEY), nStored = 0;
      incNutri.forEach(function (d) {
        var date = _isoDate(d && d.date); if (!date) return;
        nMap[date] = [_n(d.calories), _n(d.protein), _n(d.carbs), _n(d.fat)];
        nStored++;
      });
      _save(NUTRI_KEY, nMap);
      out.nutrition_stored = nStored;
    }

    if (incSleep.length) {
      var sMap = _load(SLEEP_KEY), sStored = 0, dateUsed = '';
      incSleep.forEach(function (d) {
        // fallback: אם התאריך מהקיצור חסר/לא בפורמט yyyy-MM-dd — חותמים את תאריך
        // השרת. הקיצור רץ בבוקר על שנת הלילה, כך ש"היום" הוא התאריך הנכון.
        var date = _isoDate(d && d.date) || _todayIso();
        sMap[date] = [_n(d.asleep), _n(d.inbed), _n(d.deep), _n(d.rem), _n(d.core),
                      _n(d.awake), _n(d.rhr), _n(d.hrv), _f(d.resp), _f(d.temp)];
        sStored++; dateUsed = date;
      });
      _save(SLEEP_KEY, sMap);
      out.sleep_stored = sStored;
      out.date_used = dateUsed;   // שקיפות: איזה תאריך נשמר בפועל
    }
    return _json(out);
  } finally {
    lock.releaseLock();
  }
}

/* ─── שליפה לאפליקציה (GET, JSONP) ────────────────────────────────────────
 * <URL>?token=...&callback=cb  →  cb({ ok:true, days:[…], sleep:[…] })
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var result;
  if (p.token !== SECRET_TOKEN) {
    result = { ok: false, error: 'BAD_TOKEN' };
  } else if (p.raw) {
    // דיבאג: מחזיר את ה-payload הגולמי האחרון שהתקבל (לאימות פורמט HAE)
    result = { ok: true, raw: PropertiesService.getScriptProperties().getProperty(RAW_KEY) || '' };
  } else {
    var nMap = _load(NUTRI_KEY);
    var days = Object.keys(nMap).sort().map(function (date) {
      var v = nMap[date];
      return { date: date, calories: v[0], protein: v[1], carbs: v[2], fat: v[3] };
    });
    var sMap = _load(SLEEP_KEY);
    var sleep = Object.keys(sMap).sort().map(function (date) {
      var v = sMap[date];
      return {
        date: date, asleepMin: v[0], inBedMin: v[1],
        deepMin: v[2], remMin: v[3], coreMin: v[4], awakeMin: v[5],
        rhr: v[6], hrv: v[7], respRate: v[8], wristTempDev: v[9]
      };
    });
    result = { ok: true, days: days, sleep: sleep };
  }

  var json = JSON.stringify(result);
  if (p.callback && /^[\w.]+$/.test(p.callback)) {
    return ContentService.createTextOutput(p.callback + '(' + json + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/* ─── Health Auto Export (REST API) → מערך לילות בפורמט הפנימי ─────────────
 * HAE שולח { data:{ metrics:[ {name,units,data:[…]} ] } }. שינה = מדד אחד עם
 * טוטלים יומיים (core/deep/rem/awake/totalSleep/inBed); RHR/HRV/נשימה/טמפ' =
 * מדדי qty נפרדים. ממזגים לפי תאריך. משכי שינה מומרים לדקות לפי היחידה (hr→×60).
 * זיהוי מדד לפי מילות-מפתח בשם — עמיד לשינויי-שמות קלים בין גרסאות HAE. */
function _parseHAE(metrics) {
  var byDate = {};
  function slot(d) { return (byDate[d] || (byDate[d] = {})); }

  metrics.forEach(function (m) {
    var name  = String((m && m.name)  || '').toLowerCase();
    var units = String((m && m.units) || '').toLowerCase();
    var rows  = (m && Array.isArray(m.data)) ? m.data : [];
    var toMin = /\b(hr|hour|hours)\b/.test(units) ? 60 : 1;   // שעות→דקות; אחרת דקות

    rows.forEach(function (r) {
      var date = _isoDate(r && r.date); if (!date) return;
      var s = slot(date);
      if (name.indexOf('sleep') > -1 && (r.core != null || r.deep != null ||
          r.rem != null || r.totalSleep != null || r.asleep != null)) {
        if (r.core  != null) s.core  = _n(r.core  * toMin);
        if (r.deep  != null) s.deep  = _n(r.deep  * toMin);
        if (r.rem   != null) s.rem   = _n(r.rem   * toMin);
        if (r.awake != null) s.awake = _n(r.awake * toMin);
        var tot = (r.totalSleep != null) ? r.totalSleep : r.asleep;
        if (tot   != null) s.asleep = _n(tot   * toMin);
        if (r.inBed != null) s.inbed = _n(r.inBed * toMin);
      } else if (name.indexOf('resting') > -1 && name.indexOf('heart') > -1) {
        if (r.qty != null) s.rhr = _n(r.qty);
      } else if (name.indexOf('variability') > -1 || name.indexOf('hrv') > -1 ||
                 name.indexOf('sdnn') > -1) {
        if (r.qty != null) s.hrv = _n(r.qty);
      } else if (name.indexOf('respirator') > -1) {
        if (r.qty != null) s.resp = _f(r.qty);
      } else if (name.indexOf('wrist') > -1 && name.indexOf('temp') > -1) {
        if (r.qty != null) s.temp = _f(r.qty);
      }
    });
  });

  return Object.keys(byDate).map(function (date) {
    var s = byDate[date];
    var stages = (s.core || 0) + (s.deep || 0) + (s.rem || 0);
    if (s.asleep == null && stages) s.asleep = stages;               // שינה = סכום שלבים
    if ((s.inbed == null || !s.inbed) && s.asleep != null)           // במיטה = שינה + ערות
      s.inbed = _n((s.asleep || 0) + (s.awake || 0));
    return { date: date, asleep: s.asleep, inbed: s.inbed, deep: s.deep,
             rem: s.rem, core: s.core, awake: s.awake, rhr: s.rhr,
             hrv: s.hrv, resp: s.resp, temp: s.temp };
  });
}

/* ─── אחסון קומפקטי לפי סוג: { "YYYY-MM-DD": [..], … } ─────────────────── */
function _load(key) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(key)) || {}; }
  catch (e) { return {}; }
}
function _save(key, map) {
  var dates = Object.keys(map).sort();
  while (dates.length > MAX_DAYS) delete map[dates.shift()];
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(map));
}

function _todayIso() {  // תאריך היום לפי אזור-הזמן של הסקריפט (fallback לתאריך חסר)
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function _n(x) { return Math.round(Number(x) || 0); }         // מספר שלם
function _f(x) { var v = Number(x); return isFinite(v) ? Math.round(v * 10) / 10 : null; } // עשרוני/null

// מנרמל תאריך ל-YYYY-MM-DD; דוחה כל דבר אחר
function _isoDate(s) {
  var m = String(s || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? (m[1] + '-' + m[2] + '-' + m[3]) : null;
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
}
