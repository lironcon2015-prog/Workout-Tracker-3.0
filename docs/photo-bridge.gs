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
 * ==========================================================================*/

// 🔐 שנה לערך אקראי משלך (אותיות/ספרות). העתק אותו גם להגדרות GYMPRO.
var SECRET_TOKEN = 'CHANGE_ME_to_a_random_secret';

var FOLDER_NAME = 'GymPro Progress Photos';

/* ─── פעולות מהאפליקציה (POST) ────────────────────────────────────────────
 * Body (JSON): { token, action, ... }
 *   action: 'upload' { date:'YYYY-MM-DD', data:<base64>, mime:'image/jpeg' } → { ok, id }
 *   action: 'get'    { id } או { date }                                      → { ok, data:<base64>, mime }
 *   action: 'list'   {}                                                      → { ok, files:[{id,name,date,bytes,updated}] }
 *   action: 'del'    { id }                                                  → { ok }
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

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
