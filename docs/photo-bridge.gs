/**
 * GYMPRO ELITE — Progress Photos Bridge (Google Apps Script → Google Drive)
 * ----------------------------------------------------------------------------
 * גשר תמונות התקדמות: האפליקציה מעלה תמונת גוף דחוסה (~150-400KB JPEG) לתיקייה
 * פרטית בדרייב שלך — מקור האמת של התמונות (iOS רשאי לפנות אחסון מקומי של PWA).
 * האפליקציה מושכת תמונה מלאה רק בפתיחה/שחזור; thumbnails נשמרים מקומית.
 *
 * ⚠️ פרטיות: תמונות גוף הן מידע רגיש. התיקייה נוצרת פרטית בדרייב שלך — אל
 * תשתף אותה. הגשר רץ בחשבון הגוגל שלך בלבד; ה-token מגן על הגישה.
 *
 * אחסון: תיקיית Drive בשם FOLDER_NAME (נוצרת אוטומטית בשורש הדרייב).
 * קובץ אחד ליום: YYYY-MM-DD.jpg — העלאה חוזרת לאותו יום דורסת את הקודם.
 *
 * ── פריסה (חד-פעמי, זהה לשאר הגשרים) ───────────────────────────────────────
 * 1. היכנס ל-https://script.google.com → New project.
 * 2. הדבק את כל הקובץ הזה. שנה את SECRET_TOKEN לערך אקראי משלך.
 * 3. Deploy → New deployment → type: Web app.
 *      - Execute as:  Me
 *      - Who has access: Anyone (ה-token מגן על הגישה)
 *    בהרצה/פריסה ראשונה גוגל תבקש אישור הרשאות Drive — אשר.
 * 4. העתק את "Web app URL" → הדבק בהגדרות GYMPRO ("תמונות התקדמות") יחד עם
 *    ה-SECRET_TOKEN, הפעל את המתג ולחץ "בדוק חיבור".
 *
 * בדיקה בדפדפן:  <WebAppURL>?token=<SECRET_TOKEN>  ← אמור להחזיר {"ok":true,...}
 *
 * ── נתוני מאמן (מאז v19.16) ──────────────────────────────────────────────────
 * אותו גשר כותב גם את קבצי הנתונים של מאמן ה-Claude לתיקייה COACH_FOLDER_NAME
 * (coachWrite / coachCheck). אחרי עדכון הקובץ: Deploy → Manage deployments →
 * עריכה → Version: New version. בלי זה ה-URL ממשיך להריץ את הקוד הישן.
 * ==========================================================================*/

// 🔐 שנה לערך אקראי משלך (אותיות/ספרות). העתק אותו גם להגדרות GYMPRO.
var SECRET_TOKEN = 'CHANGE_ME_to_a_random_secret';

var FOLDER_NAME = 'GymPro Progress Photos';
var COACH_FOLDER_NAME = 'GymPro Coach Data';

/* ─── פעולות מהאפליקציה (POST) ────────────────────────────────────────────
 * Body (JSON): { token, action, ... }
 *   action: 'upload' { date:'YYYY-MM-DD', data:<base64>, mime:'image/jpeg' } → { ok, id }
 *   action: 'get'    { id } או { date }                                      → { ok, data:<base64>, mime }
 *   action: 'list'   {}                                                      → { ok, files:[{id,name,date,bytes,updated}] }
 *   action: 'del'    { id }                                                  → { ok }
 *   action: 'coachWrite' { files:[{name, content, id?}] }  → { ok, folderId, results:[{name, ok, id, bytes, error?}] }
 *   action: 'coachCheck' { ids:[...] }                     → { ok, folderId, missing:[ids] }
 */
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return _json({ ok: false, error: 'BAD_JSON' }); }

  var tok = (body && body.token) || (e && e.parameter && e.parameter.token) || '';
  if (tok !== SECRET_TOKEN) return _json({ ok: false, error: 'BAD_TOKEN' });

  try {
    switch (body.action) {
      case 'upload': return _upload(body);
      case 'get':    return _get(body);
      case 'list':   return _list();
      case 'del':    return _del(body);
      case 'coachWrite': return _coachWrite(body);
      case 'coachCheck': return _coachCheck(body);
      default:       return _json({ ok: false, error: 'BAD_ACTION' });
    }
  } catch (err) {
    return _json({ ok: false, error: 'DRIVE_ERROR: ' + (err && err.message) });
  }
}

/* ─── health check (GET) ──────────────────────────────────────────────────
 * <URL>?token=...  ←  { ok:true, folder, files }
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.token !== SECRET_TOKEN) return _json({ ok: false, error: 'BAD_TOKEN' });
  var folder = _folder();
  var count = 0;
  var it = folder.getFiles();
  while (it.hasNext()) { it.next(); count++; }
  return _json({ ok: true, folder: FOLDER_NAME, files: count });
}

// התיקייה הפרטית — נוצרת בשורש הדרייב אם אינה קיימת
function _folder() {
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function _upload(body) {
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return _json({ ok: false, error: 'BAD_DATE' });
  if (!body.data) return _json({ ok: false, error: 'NO_DATA' });
  var folder = _folder();
  var name = body.date + '.jpg';
  // דריסה: תמונה אחת ליום — הקודמת של אותו יום נזרקת לאשפה
  var existing = folder.getFilesByName(name);
  while (existing.hasNext()) existing.next().setTrashed(true);
  var blob = Utilities.newBlob(Utilities.base64Decode(body.data), body.mime || 'image/jpeg', name);
  var file = folder.createFile(blob);
  return _json({ ok: true, id: file.getId(), bytes: file.getSize() });
}

function _get(body) {
  var file = null;
  if (body.id) {
    try { file = DriveApp.getFileById(body.id); } catch (err) { file = null; }
    if (file && file.isTrashed()) file = null;
  }
  if (!file && body.date) {
    var it = _folder().getFilesByName(body.date + '.jpg');
    if (it.hasNext()) file = it.next();
  }
  if (!file) return _json({ ok: false, error: 'NOT_FOUND' });
  return _json({
    ok: true,
    id: file.getId(),
    mime: file.getMimeType(),
    data: Utilities.base64Encode(file.getBlob().getBytes())
  });
}

function _list() {
  var files = [];
  var it = _folder().getFiles();
  while (it.hasNext()) {
    var f = it.next();
    var name = f.getName();
    var m = name.match(/^(\d{4}-\d{2}-\d{2})\.jpe?g$/i);
    if (!m) continue;
    files.push({ id: f.getId(), name: name, date: m[1], bytes: f.getSize(), updated: f.getLastUpdated().toISOString() });
  }
  files.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  return _json({ ok: true, files: files });
}

function _del(body) {
  if (!body.id) return _json({ ok: false, error: 'NO_ID' });
  try {
    DriveApp.getFileById(body.id).setTrashed(true);
    return _json({ ok: true });
  } catch (err) {
    return _json({ ok: false, error: 'NOT_FOUND' });
  }
}

/* ─── נתוני מאמן ────────────────────────────────────────────────────────────
 * קובץ נוצר פעם אחת ומעודכן במקום (setContent) — המזהה שלו קבוע, כך שקישור ששמור
 * אצל המאמן ממשיך להצביע על הנתונים העדכניים. חיפוש: לפי id, אחרת לפי שם בתיקייה,
 * אחרת יצירה. כפילויות לפי שם (למשל משתי ריצות מקבילות לפני המנעול) נזרקות לאשפה.
 */
function _coachFolder() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('COACH_FOLDER_ID');
  if (id) {
    try {
      var f = DriveApp.getFolderById(id);
      if (!f.isTrashed()) return f;
    } catch (err) { /* נמחקה — נמצא או ניצור מחדש */ }
  }
  var it = DriveApp.getRootFolder().getFoldersByName(COACH_FOLDER_NAME);
  var folder = null;
  while (it.hasNext()) {
    var cand = it.next();
    if (!cand.isTrashed()) { folder = cand; break; }
  }
  if (!folder) folder = DriveApp.createFolder(COACH_FOLDER_NAME);
  props.setProperty('COACH_FOLDER_ID', folder.getId());
  return folder;
}

function _coachInFolder(file, folder) {
  var parents = file.getParents();
  while (parents.hasNext()) if (parents.next().getId() === folder.getId()) return true;
  return false;
}

function _coachFile(folder, name, id) {
  if (id) {
    try {
      var byId = DriveApp.getFileById(id);
      if (!byId.isTrashed() && byId.getName() === name && _coachInFolder(byId, folder)) return byId;
    } catch (err) { /* לא קיים — נחפש לפי שם */ }
  }
  var found = null;
  var it = folder.getFilesByName(name);
  while (it.hasNext()) {
    var f = it.next();
    if (f.isTrashed()) continue;
    if (!found) found = f; else f.setTrashed(true);   // אין כפילויות
  }
  return found;
}

function _coachWrite(body) {
  var files = body.files;
  if (!files || !files.length) return _json({ ok: false, error: 'NO_FILES' });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return _json({ ok: false, error: 'BUSY' });
  try {
    var folder = _coachFolder();
    var results = files.map(function (item) {
      var name = String(item && item.name || '');
      if (!/^[a-z0-9_]+\.json$/.test(name)) return { name: name, ok: false, error: 'BAD_NAME' };
      if (typeof item.content !== 'string') return { name: name, ok: false, error: 'NO_CONTENT' };
      try {
        var file = _coachFile(folder, name, item.id);
        if (file) file.setContent(item.content);
        else file = folder.createFile(Utilities.newBlob(item.content, 'application/json', name));
        return { name: name, ok: true, id: file.getId(), bytes: file.getSize() };
      } catch (err) {
        return { name: name, ok: false, error: 'DRIVE_ERROR: ' + (err && err.message) };
      }
    });
    return _json({ ok: true, folderId: folder.getId(), results: results });
  } finally {
    lock.releaseLock();
  }
}

// אילו מזהים כבר לא קיימים (נמחקו/הועברו לאשפה) — כדי שהאפליקציה תכתוב אותם מחדש
function _coachCheck(body) {
  var folder = _coachFolder();
  var missing = (body.ids || []).filter(function (id) {
    try {
      var f = DriveApp.getFileById(id);
      return f.isTrashed() || !_coachInFolder(f, folder);
    } catch (err) { return true; }
  });
  return _json({ ok: true, folderId: folder.getId(), missing: missing });
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
