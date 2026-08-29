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
 *     מתכון מלא (כולל תזמון דטרמיניסטי דרך Shortcuts): docs/hae-automation-recipe.md
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
 * 5. הגדר את Health Auto Export + אוטומציות הקיצור לפי docs/hae-automation-recipe.md
 *    (‏sleep-shortcut-recipe.md הוא המסלול הישן — גיבוי בלבד).
 *
 * בדיקה: פתח בדפדפן  <WebAppURL>?token=<SECRET_TOKEN>  ← אמור להחזיר JSON.
 * ==========================================================================*/

// 🔐 שנה לערך אקראי משלך (אותיות/ספרות). העתק אותו גם להגדרות GYMPRO ולקיצור.
const SECRET_TOKEN = 'CHANGE_ME_to_a_random_secret';

const NUTRI_KEY = 'health_days';   // תזונה: [cal,prot,carb,fat]
const SLEEP_KEY = 'sleep_days';    // שינה: [asleep,inbed,deep,rem,core,awake,rhr,hrv,resp,temp]
// ⚠️ מגבלת PropertiesService: **9KB לכל ערך**, 500KB לכל המאגר. אימון עם סדרת
// דופק שוקל כמה KB בפני עצמו, ולכן אסור לרכז אימונים ב-property אחד — כל אימון
// מקבל property משלו (`w_<ISO>`), ומפתח אינדקס קטן מחזיק את רשימת המזהים.
const WORK_IDX_KEY = 'workout_index';  // מערך מזהים בלבד (קל), ממוין
const WORK_PREFIX  = 'w_';             // w_<startISO> → אימון בודד
const MAX_DAYS  = 120;             // שמירת ~4 חודשים אחרונים לכל סוג
const MAX_WORKOUTS = 40;           // אימונים אחרונים שנשמרים (כולל סדרות דופק)
const WORK_RETURN_DAYS = 21;       // כמה ימים אחורה מוחזרים ב-doGet (ניתן לדריסה ב-?days=)

// 🐞 דיבאג: כשדלוק — שומר את גוף ה-POST הגולמי האחרון, לשליפה בדפדפן דרך
//    <URL>?token=…&raw=1 (לאימות פורמט מקור חדש). ברירת מחדל כבוי; הדלק בעת הצורך.
//    ⚠️ דלוק כרגע לאבחון היעלמות טמפ' הריסט (אוגוסט 2026) — להחזיר ל-false בסיום.
const DEBUG_RAW = true;
const RAW_KEY   = 'last_raw';

// 📋 יומן דחיפות — 12 האחרונות, נחשף ב-doGet כ-`pushes`. קיים כדי לענות על
//    השאלה שאי-אפשר לענות עליה מהאפליקציה: **האם הטריגר בכלל ירה, והאם הביא
//    נתונים?** ריצה שרצה כשהמכשיר נעול מגיעה עם שדות ריקים/שגיאה — ביומן היא
//    תיראה כשורה עם asleep:0 או src:'hae:ERR', לעומת טריגר שלא ירה בכלל = אין שורה.
const PUSH_LOG_KEY = 'push_log';
const PUSH_LOG_MAX = 12;

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
    // חיתוך ל-8KB: דחיפת אימונים עם סדרות דופק שוקלת מגה-בייטים, ומגבלת
    // ה-property היא 9KB — בלי החיתוך הכתיבה נכשלת וה-raw נשאר על ערך ישן.
    try { PropertiesService.getScriptProperties()
      .setProperty(RAW_KEY, String((e.postData && e.postData.contents) || '').slice(0, 8000)); }
    catch (err) {}
  }

  var incNutri = Array.isArray(body.days)  ? body.days  : [];
  var incSleep = Array.isArray(body.sleep) ? body.sleep : [];
  // אימונים — Health Auto Export שולח אותם במסלול נפרד ({data:{workouts:[…]}}),
  // ולכן אוטומציית Workouts מגיעה כ-POST משל עצמה ואינה מתערבבת בשינה.
  var incWork = Array.isArray(body.workouts) ? body.workouts
              : (body.data && Array.isArray(body.data.workouts)) ? body.data.workouts : [];
  // Health Auto Export (REST API): { data:{ metrics:[…] } } — ממזג לפי תאריך.
  var haeDiag = null;
  if (!incSleep.length && body.data && Array.isArray(body.data.metrics)) {
    haeDiag  = { sleepRows: 0, skipped: 0, unaggregated: false };
    incSleep = _parseHAE(body.data.metrics, haeDiag);
    // כשל שקט הוא האויב: אם HAE שלחה מדדים ולא יצא מהם ולו לילה אחד — מחזירים
    // שגיאה מפורשת עם רמז, במקום NO_DATA גנרי שנראה כמו "אין נתונים".
    if (!incSleep.length && !incNutri.length && !incWork.length) {
      // מתעדים גם כישלון — זו בדיוק הראיה ש"הטריגר ירה אבל המכשיר היה נעול".
      _logPush(haeDiag.unaggregated ? 'hae:ERR_RAW' : 'hae:ERR_EMPTY', '', null);
      return _json({ ok: false,
        error: haeDiag.unaggregated ? 'HAE_NOT_AGGREGATED' : 'HAE_NO_USABLE_ROWS',
        hint: haeDiag.unaggregated
          ? 'הפעל Aggregate ("Summarize Data") באוטומציה של Health Auto Export — ' +
            'הגשר מקבל טוטלים יומיים מעובדים בלבד, לא דגימות גלם.'
          : 'לא נמצאו שורות עם תאריך תקין. ודא שנבחרו מדדי שינה/דופק באוטומציה.',
        diag: haeDiag });
    }
  }
  // תמיכה בפורמט שטוח: לילה בודד ברמת השורש (בלי מערך "sleep") — מקל מאוד על
  // בניית הקיצור ב-iOS (אין צורך במערך/מילון מקוננים, רק שדות פשוטים).
  if (!incSleep.length && body.date && (body.asleep != null || body.inbed != null ||
      body.deep != null || body.rem != null || body.core != null || body.awake != null ||
      body.hrv != null || body.rhr != null || body.resp != null || body.temp != null)) {
    incSleep = [body];
  }
  if (!incNutri.length && !incSleep.length && !incWork.length) {
    _logPush('ERR_NO_DATA', '', null);
    return _json({ ok: false, error: 'NO_DATA' });
  }

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
        sMap[date] = _mergeNight(sMap[date], d);
        sStored++; dateUsed = date;
      });
      _save(SLEEP_KEY, sMap);
      out.sleep_stored = sStored;
      out.date_used = dateUsed;   // שקיפות: איזה תאריך נשמר בפועל
      _logPush(haeDiag ? 'hae' : 'flat', dateUsed, incSleep[incSleep.length - 1]);
    } else if (incNutri.length) {
      _logPush('nutri', '', null);
    }

    if (incWork.length) {
      var wStored = 0, wSkipped = 0;
      incWork.forEach(function (w) {
        var rec = _parseWorkout(w);
        if (!rec) { wSkipped++; return; }
        // upsert לפי חותמת ההתחלה: ייצוא חוזר על אותו טווח מעדכן ולא מכפיל.
        if (_saveWorkout(rec)) wStored++; else wSkipped++;
      });
      _pruneWorkouts();
      out.workouts_stored = wStored;
      if (wSkipped) out.workouts_skipped = wSkipped;
      _logPush('workouts:' + wStored + (wSkipped ? '/skip' + wSkipped : ''), '', null);
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
    var workouts = _loadWorkouts(parseInt(p.days, 10) || WORK_RETURN_DAYS);
    result = { ok: true, days: days, sleep: sleep, workouts: workouts, pushes: _loadPushLog() };
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
 * זיהוי מדד לפי מילות-מפתח בשם — עמיד לשינויי-שמות קלים בין גרסאות HAE.
 *
 * ⚠️ ייחוס תאריך הלילה: האפליקציה מייחסת שינה ל**תאריך הבוקר** (היקיצה).
 * ב-**Export Version v2** שורת sleep_analysis כלל **אינה מכילה `date`** אלא
 * `startDate`/`endDate` — לכן `_isoDate(r.date)` החזיר null וכל השורות נזרקו
 * בשקט (זה היה הבאג). וגם כשקיים `date` (v1) הוא יום **תחילת** הלילה — לילה
 * שהתחיל ב-23:30 נשמר על אתמול. לכן לשורות שינה מעדיפים את `sleepEnd` (רגע
 * היקיצה), ורק בהיעדרו נופלים ל-`date`/`endDate`/`startDate`.
 *
 * diag (אופציונלי) מתמלא לצורכי אבחון: כמה שורות שינה נקלטו, כמה נזרקו, והאם
 * המקור נראה לא-מצטבר (בלי Aggregate) — אז חובה להחזיר שגיאה, לא שקט. */
function _parseHAE(metrics, diag) {
  var byDate = {};
  var d0 = diag || {};
  function slot(d) { return (byDate[d] || (byDate[d] = {})); }

  metrics.forEach(function (m) {
    var name  = String((m && m.name)  || '').toLowerCase();
    var units = String((m && m.units) || '').toLowerCase();
    var rows  = (m && Array.isArray(m.data)) ? m.data : [];
    var toMin = /\b(hr|hour|hours)\b/.test(units) ? 60 : 1;   // שעות→דקות; אחרת דקות
    // 'sleep' לבדו לא מספיק: השם apple_sleeping_wrist_temperature מכיל אותו,
    // והוא מדד qty רגיל — לא שורת שינה.
    var isSleep = name.indexOf('sleep') > -1 && name.indexOf('temp') === -1;

    rows.forEach(function (r) {
      // שורת שינה מצטברת מזוהה לפי **טוטלים**, לא לפי qty: ב-v1 הלא-מצטבר כל
      // מקטע שלב מגיע כ-{startDate,endDate,qty,value} — qty קיים אך חסר משמעות
      // כאן. שורת שינה בלי טוטלים = דגימת גלם, ולא מסכמים אותה בכוונה: סכימת
      // מקורות חופפים (היסטוריית צימודי שעונים) היא הבאג שבגללו עברנו ל-HAE.
      var hasSleepTotals = !!(r && (r.core != null || r.deep != null || r.rem != null ||
                                    r.totalSleep != null || r.asleep != null));
      if (isSleep && !hasSleepTotals) {
        d0.unaggregated = true; d0.skipped = (d0.skipped || 0) + 1; return;
      }
      // ייחוס לתאריך היקיצה לשורות שינה; שאר המדדים — לפי היום שלהם.
      var date = (isSleep ? _isoDate(r && r.sleepEnd) : null) ||
                 _isoDate(r && r.date) || _isoDate(r && r.endDate) || _isoDate(r && r.startDate);
      if (!date) { d0.skipped = (d0.skipped || 0) + 1; return; }
      var s = slot(date);
      if (isSleep) {
        d0.sleepRows = (d0.sleepRows || 0) + 1;
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
        // HAE אינה עקבית בשדה הערך בין מדדים וגרסאות: חלק מהמדדים מיוצאים כ-qty,
        // אחרים כ-Min/Avg/Max (כמו דופק). אם השדה משתנה בעדכון של HAE, תנאי על
        // qty בלבד נכשל **בשקט** — המדד "נבחר" ו"מיוצא", והערך פשוט מתאדה בפרסור.
        // בדיוק זה קרה: רצף של 12 לילות נקטע ב-2026-08-02 בלי שינוי בהגדרות.
        // לכן מקבלים כל וריאנט סביר, לפי סדר עדיפות. שאר המדדים נשארים על qty —
        // הם עובדים, ואין סיבה להרחיב טווח קליטה במקום שלא נשבר.
        var t = (r.qty   != null) ? r.qty
              : (r.avg   != null) ? r.avg
              : (r.Avg   != null) ? r.Avg
              : (r.value != null) ? r.value
              : (r.min != null && r.max != null) ? (Number(r.min) + Number(r.max)) / 2
              : null;
        if (t != null) s.temp = _f(t);
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
/* ─── מיזוג לילה: שדה-שדה, לא דריסה ─────────────────────────────────────────
 * הגשר מקבל דחיפות מרובות לאותו תאריך (אוטומציית "Today", אוטומציית סחיפה,
 * וקצב פנימי כל 30 דק'). דריסה מלאה של השורה גרמה לשתי תקלות:
 *   1. דחיפה חלקית איפסה שדות שלא נכללו בה (‏_n(undefined) === 0).
 *   2. דחיפה שרצה **במהלך היום** כתבה ערכי-ערוּת על ערכי הלילה.
 *
 * הכלל תלוי במתי המדד נמדד — זהה בדיוק ללוגיקה של mergeSleepDays באפליקציה:
 *   • HRV / נשימה — נמדדים כדגימות לאורך היום, ודחיפה יומית מזהמת אותם בערכי-ערוּת.
 *     **ערך קיים תקין גובר**; דחיפה מאוחרת רק *ממלאת* מדד שהיה חסר בבוקר.
 *   • שלבי שינה + טמפ' ריסט — נמדדים בשינה בלבד, אין זיהום יומי. ערך נכנס
 *     תקין גובר (מחושב מחדש), אבל ערך חסר **אינו מוחק** ערך שכבר נשמר.
 *   • דופק מנוחה (RHR) — v19.7.5: עבר מ-fill ל-fresh. בניגוד ל-HRV, זו אינה דגימה
 *     גולמית אלא **מדד מחושב ומסונן של אפל** ("דופק במנוחה"), שאפל מעדכנת לאורך
 *     היום ככל שמצטברים נתוני מנוחה. fill הקפיא את הקריאה המוקדמת של הבוקר, ולכן
 *     המספר בגימפרו נשאר 1–3 bpm מתחת/מעל למה ש-Health מציגה **לצמיתות**.
 *     "האחרון תקין מנצח" = זהות מלאה מול Health, וגם מאפשר backfill היסטורי:
 *     Manual Export מ-HAE על טווח ימים ידרוס ערכים ישנים שקפאו.
 * ---------------------------------------------------------------------------*/
function _mergeNight(prev, d) {
  var p = Array.isArray(prev) ? prev : [];
  // ערך "קיים" נחשב רק אם הוא ממש נמדד — 0/null אצלנו פירושו "חסר"
  var has = function (v) { return v != null && v !== 0 && !isNaN(v); };
  // fill-only: הקיים גובר; הנכנס רק ממלא חסר  (HRV/נשימה)
  var fill = function (old, incoming) { return has(old) ? old : incoming; };
  // refresh: הנכנס גובר אם הוא תקין; אחרת הקיים נשמר  (שינה/טמפ')
  var fresh = function (old, incoming) { return has(incoming) ? incoming : (has(old) ? old : incoming); };

  return [
    fresh(p[0], _n(d.asleep)),
    fresh(p[1], _n(d.inbed)),
    fresh(p[2], _n(d.deep)),
    fresh(p[3], _n(d.rem)),
    fresh(p[4], _n(d.core)),
    fresh(p[5], _n(d.awake)),
    fresh(p[6], _n(d.rhr)),      // v19.7.5 — מדד מחושב של אפל, מתעדכן לאורך היום
    fill(p[7],  _n(d.hrv)),
    fill(p[8],  _f(d.resp)),
    fresh(p[9], _f(d.temp))
  ];
}

/* ─── אימון מ-Health Auto Export → רשומה פנימית ────────────────────────────
 * HAE שולח לכל אימון: name, start, end, duration, activeEnergy/totalEnergy,
 * avgHeartRate/maxHeartRate/minHeartRate, heartRateRecovery, ו-heartRateData[]
 * (מקטע לכל דגימה: {date, Min, Avg, Max}). חלק מהשדות הם אובייקט {qty,units}
 * וחלק מספר — _q מטפל בשניהם, ו-_kcal ממיר kJ לקלוריות לפי היחידה המדווחת.
 *
 * hrSeries נשמרת מדוללת ל-SERIES_STEP שניות ובפורמט [שניות, min, avg, max] —
 * ארבעת המספרים דרושים לגרף הנרות ולחישוב הזמן בכל אזור. שדה זמן חסר או תאריך
 * לא-תקין פוסלים את האימון: בלי start/end אין מה לשייך אליו רשומת ארכיון. */
// דילול: המרווח נגזר מאורך האימון כדי שמספר הנקודות לא יחרוג מ-MAX_POINTS —
// כך אימון של שעתיים בגרופינג של שניות לא מפיל את הרשומה על מגבלת 9KB.
// SERIES_MIN_STEP הוא הרצפה: צפוף מזה אינו משפר את הגרף אך מנפח את האחסון.
var SERIES_MIN_STEP = 30;   // שניות — הרזולוציה הצפופה ביותר שנשמרת
var MAX_POINTS      = 200;  // נקודות לכל היותר לאימון (~4KB, מרווח בטוח מ-9KB)

function _parseWorkout(w) {
  if (!w) return null;
  var start = _ms(w.start), end = _ms(w.end);
  if (!start) return null;
  var durMin = w.duration != null ? Math.round(_q(w.duration) / 60) : null;   // HAE מדווח שניות
  if (!end && durMin) end = start + durMin * 60000;
  if (!end) return null;
  if (!durMin) durMin = Math.round((end - start) / 60000);

  var series = _parseHrSeries(w.heartRateData, start, Math.round((end - start) / 1000));
  var rec = {
    id: _iso(start),
    start: start, end: end, durMin: durMin,
    wType: String(w.name || w.workoutActivityType || '').trim(),
    hrAvg: _r(_q(w.avgHeartRate)), hrMax: _r(_q(w.maxHeartRate)), hrMin: _r(_q(w.minHeartRate)),
    activeKcal: _kcal(w.activeEnergy != null ? w.activeEnergy : w.activeEnergyBurned),
    totalKcal:  _kcal(w.totalEnergy),
    hrRecovery1: _r(_q(w.heartRateRecovery)),
    hrSeries: series.length ? series : null
  };
  // אם אין אגרגטים אבל יש סדרה — גוזרים מהסדרה, כדי שאימון לא יגיע ריק.
  if (!rec.hrAvg && series.length) {
    var sum = 0; for (var i = 0; i < series.length; i++) sum += series[i][2];
    rec.hrAvg = Math.round(sum / series.length);
  }
  if (!rec.hrMax && series.length) {
    var mx = 0; for (var j = 0; j < series.length; j++) if (series[j][3] > mx) mx = series[j][3];
    rec.hrMax = mx;
  }
  return rec;
}

// _parseHrSeries — [שניות-מההתחלה, min, avg, max], מדולל למרווח אדפטיבי.
function _parseHrSeries(rows, start, durSec) {
  if (!Array.isArray(rows) || !rows.length) return [];
  var step = Math.max(SERIES_MIN_STEP, Math.ceil((durSec || 0) / MAX_POINTS));
  var out = [], lastSec = -step;
  rows.forEach(function (r) {
    var t = _ms(r && (r.date || r.startDate));
    if (!t) return;
    var sec = Math.round((t - start) / 1000);
    if (sec < 0 || sec - lastSec < step) return;
    var avg = _q(r.Avg != null ? r.Avg : (r.avg != null ? r.avg : r.qty));
    if (!avg) return;
    var mn = _q(r.Min != null ? r.Min : r.min) || avg;
    var mx = _q(r.Max != null ? r.Max : r.max) || avg;
    out.push([sec, Math.round(mn), Math.round(avg), Math.round(mx)]);
    lastSec = sec;
  });
  return out;
}

/* ─── אחסון אימונים: property לכל אימון + אינדקס ──────────────────────────
 * מגבלת 9KB היא **לכל ערך**, ולכן ריכוז אימונים במפתח אחד נשבר כבר אחרי
 * שניים-שלושה. כאן כל אימון עומד בפני עצמו, והאינדקס (מערך מזהים) נשאר זעיר.
 * רשומה שבכל זאת חורגת — נשמרת בלי הסדרה, כי אגרגטים בלי גרף עדיפים על כלום. */
var PROP_MAX_BYTES = 8800;   // שוליים מתחת ל-9KB

function _workIndex() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(WORK_IDX_KEY)) || []; }
  catch (e) { return []; }
}
function _saveWorkout(rec) {
  var props = PropertiesService.getScriptProperties();
  var body = JSON.stringify(rec);
  if (body.length > PROP_MAX_BYTES) {           // חריגה — מוותרים על הסדרה בלבד
    var slim = {}; for (var k in rec) if (k !== 'hrSeries') slim[k] = rec[k];
    slim.seriesDropped = true;
    body = JSON.stringify(slim);
    if (body.length > PROP_MAX_BYTES) return false;
  }
  try { props.setProperty(WORK_PREFIX + rec.id, body); } catch (e) { return false; }
  var idx = _workIndex();
  if (idx.indexOf(rec.id) === -1) { idx.push(rec.id); idx.sort(); props.setProperty(WORK_IDX_KEY, JSON.stringify(idx)); }
  return true;
}
function _pruneWorkouts() {
  var props = PropertiesService.getScriptProperties();
  var idx = _workIndex();
  if (idx.length <= MAX_WORKOUTS) return;
  var drop = idx.splice(0, idx.length - MAX_WORKOUTS);
  drop.forEach(function (id) { try { props.deleteProperty(WORK_PREFIX + id); } catch (e) {} });
  props.setProperty(WORK_IDX_KEY, JSON.stringify(idx));
}
// _loadWorkouts — רק החלון האחרון. האפליקציה מושכת בכל כניסה ובכל שעה, ואימון
// ששויך כבר הועתק לרשומת הארכיון — אין טעם להזרים את כל המאגר בכל משיכה.
function _loadWorkouts(days) {
  var props = PropertiesService.getScriptProperties();
  var cutoff = Date.now() - (days || WORK_RETURN_DAYS) * 86400000;
  var out = [];
  _workIndex().forEach(function (id) {
    if (Date.parse(id) < cutoff) return;
    try {
      var rec = JSON.parse(props.getProperty(WORK_PREFIX + id));
      if (rec) out.push(rec);
    } catch (e) {}
  });
  return out;
}

// _q — ערך מתוך מספר או מתוך אובייקט {qty,units}
function _q(v) {
  if (v == null) return 0;
  if (typeof v === 'object') return Number(v.qty) || 0;
  var n = Number(v);
  return isFinite(n) ? n : 0;
}
// _kcal — קלוריות; ממיר kJ אם היחידה מדווחת ככזו (HAE מכבד את העדפת המשתמש)
function _kcal(v) {
  var n = _q(v);
  if (!n) return 0;
  var u = (v && typeof v === 'object' && v.units) ? String(v.units).toLowerCase() : '';
  if (u.indexOf('kj') > -1) n = n / 4.184;
  return Math.round(n);
}
function _r(n) { return n ? Math.round(n) : 0; }
function _ms(s) { var t = Date.parse(String(s || '').replace(' ', 'T')); return isNaN(t) ? 0 : t; }
function _iso(ms) { return new Date(ms).toISOString(); }

function _save(key, map) {
  var dates = Object.keys(map).sort();
  while (dates.length > MAX_DAYS) delete map[dates.shift()];
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(map));
}

function _todayIso() {  // תאריך היום לפי אזור-הזמן של הסקריפט (fallback לתאריך חסר)
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/* ─── יומן דחיפות ─────────────────────────────────────────────────────────
 * שורה לכל POST — מוצלח או כושל. עונה על "איזה טריגר ירה בפועל, ומה הוא הביא".
 * t = חותמת מקומית, src = מקור/שגיאה, date = התאריך שנשמר, ואז הערכים שהגיעו.
 * לעולם לא מפיל את הבקשה — כל היומן עטוף ב-try. */
function _loadPushLog() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(PUSH_LOG_KEY)) || []; }
  catch (e) { return []; }
}
function _logPush(tag, dateUsed, night) {
  try {
    var arr = _loadPushLog();
    arr.push({
      t: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd HH:mm'),
      src: tag, date: dateUsed || '',
      asleep: night ? _n(night.asleep) : 0,
      hrv:    night ? _n(night.hrv)    : 0,
      rhr:    night ? _n(night.rhr)    : 0,
      // temp — נוסף אחרי שהיומן לא היה מסוגל לענות על "האם הדחיפה הביאה טמפ'",
      // וזו בדיוק הייתה השאלה שתקעה את האבחון. null = לא הגיעה בדחיפה הזו.
      temp:   night ? _f(night.temp)   : null
    });
    while (arr.length > PUSH_LOG_MAX) arr.shift();
    PropertiesService.getScriptProperties().setProperty(PUSH_LOG_KEY, JSON.stringify(arr));
  } catch (e) {}
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
