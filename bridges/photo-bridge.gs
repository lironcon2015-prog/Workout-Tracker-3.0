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
 * 2. הדבק את כל הקובץ הזה — כמו שהוא, בלי לערוך בו כלום.
 *    Project Settings (גלגל שיניים) → Script properties → Add script property:
 *        Property: SECRET_TOKEN
 *        Value:    ערך אקראי משלך (אותיות/ספרות) — אותו ערך שמודבק בהגדרות GYMPRO.
 *    ה-token לא נכתב בקובץ בכוונה: כך הדבקה של גרסה חדשה של הקובץ לא מאפסת אותו,
 *    ואין צורך להעתיק אותו מחדש בכל עדכון. (הדפוס מגשר MGivatayim, ADMIN_CODE.)
 * 3. Deploy → New deployment → type: Web app.
 *      - Execute as:  Me
 *      - Who has access: Anyone (ה-token מגן על הגישה)
 *    בהרצה/פריסה ראשונה גוגל תבקש אישור הרשאות Drive — אשר.
 * 4. העתק את "Web app URL" → הדבק בהגדרות GYMPRO ("תמונות התקדמות") יחד עם
 *    ערך ה-SECRET_TOKEN, הפעל את המתג ולחץ "בדוק חיבור".
 *
 * עדכון הקובץ בעתיד: מדביקים את הגרסה החדשה במקום הישנה → Deploy → Manage
 * deployments → עריכה → Version: New version. ה-token נשאר ב-Script properties.
 * החלפת token: משנים את SECRET_TOKEN ב-Script properties — בתוקף מיד, בלי פריסה.
 *
 * בדיקה בדפדפן:  <WebAppURL>?token=<ה-token>  ← אמור להחזיר {"ok":true,...}
 *
 * ── נתוני מאמן (מאז v19.16) ──────────────────────────────────────────────────
 * אותו גשר כותב גם את קבצי הנתונים של מאמן ה-Claude לתיקייה COACH_FOLDER_NAME
 * (coachWrite / coachCheck). אחרי עדכון הקובץ: Deploy → Manage deployments →
 * עריכה → Version: New version. בלי זה ה-URL ממשיך להריץ את הקוד הישן.
 * מאז v19.17.2: יומן האימונים נכתב כ-Google Doc דרך Drive API (UrlFetchApp) — העלאה אחת
 * שמומרת ל-Doc, שניות בודדות. הרשאה חדשה ("התחברות לשירות חיצוני"). פעם אחת:
 * בחר בתפריט הפונקציות את authorizeCoach → Run (▶) → Review permissions → Allow.
 * בלי זה ה-Doc עדיין נכתב, בדרך האיטית (DocumentApp), ושום דבר לא נשבר.
 * מאז v19.17.9: רשימה, ספירה ושליפה מדלגות על קבצים שבאשפה. עדכון לא חובה — האפליקציה
 * עובדת גם מול הגרסה הקודמת; בלעדיו "סרוק דרייב" עלול להחזיר תמונות שנמחקו.
 * ==========================================================================*/

// 🔐 ה-token לא נמצא בקובץ — הוא ב-Script properties (SECRET_TOKEN). ראה "פריסה" למעלה.
// אותו ניקוי כמו באפליקציה (_cleanPastedSecret ב-storage.js): רווחים ותווים בלתי נראים
// (סימני כיוון שמקלדת עברית באייפד מוסיפה בהדבקה). עד v19.17.6 הגשר הוריד רק רווחי קצה,
// והאפליקציה ניקתה הכל — token זהה לעין נדחה כ"שגוי".
function _cleanSecret(s) {
  return String(s || '').replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\s]/g, '');
}
function _secretToken() {
  return _cleanSecret(PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN'));
}

// null = מורשה; אחרת { error, hint }. "לא הוגדר" ו"שגוי" הן תקלות שונות — הודעה אחת
// לשתיהן הייתה שולחת לבדוק את ההגדרות באפליקציה כשהחסר הוא בצד של הסקריפט.
// hint ל-BAD_TOKEN: אורך + 4 תווי hash של כל צד — מראה אם זה תו מיותר או ערך אחר, בלי לחשוף אותו.
function _authError(tok) {
  var secret = _secretToken();
  if (!secret) return { error: 'TOKEN_NOT_SET' };
  var got = _cleanSecret(tok);
  if (_sameString(got, secret)) return null;
  return { error: 'BAD_TOKEN', hint: { gotLen: got.length, expLen: secret.length, gotFp: _fp(got), expFp: _fp(secret) } };
}
function _fp(s) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return d.slice(0, 2).map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

// השוואה בזמן קבוע — זמן התגובה לא מלמד כמה תווים נוחשו נכון
function _sameString(a, b) {
  var diff = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

var FOLDER_NAME = 'GymPro Progress Photos';
var COACH_FOLDER_NAME = 'GymPro Coach Data';

/* ─── פעולות מהאפליקציה (POST) ────────────────────────────────────────────
 * Body (JSON): { token, action, ... }
 *   action: 'upload' { date:'YYYY-MM-DD', data:<base64>, mime:'image/jpeg' } → { ok, id }
 *   action: 'get'    { id } או { date }                                      → { ok, data:<base64>, mime }
 *   action: 'list'   {}                                                      → { ok, files:[{id,name,date,bytes,updated}] }
 *   action: 'del'    { id }                                                  → { ok }
 *   action: 'coachWrite' { files:[{name, content, id?, doc?}] }  (doc:true → Google Doc, שם בלי סיומת)
 *  → { ok, folderId, results:[{name, ok, id, bytes, error?}] }
 *   action: 'coachCheck' { ids:[...] }                     → { ok, folderId, missing:[ids] }
 *   action: 'coachStatus' { names:[...] }                  → { ok, files:{ name: {id, hash} } }
 *     "קבלה": coachWrite רושם את hash התוכן (שדה hash בבקשה) בתיאור הקובץ. כשהתשובה
 *     לא הגיעה לאפליקציה (503 / ניתוק), היא שואלת כאן מה נכתב בפועל.
 */
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return _json({ ok: false, error: 'BAD_JSON' }); }

  var tok = (body && body.token) || (e && e.parameter && e.parameter.token) || '';
  var authErr = _authError(tok);
  if (authErr) return _json({ ok: false, error: authErr.error, hint: authErr.hint });

  try {
    switch (body.action) {
      case 'upload': return _upload(body);
      case 'get':    return _get(body);
      case 'list':   return _list();
      case 'del':    return _del(body);
      case 'coachWrite': return _coachWrite(body);
      case 'coachCheck': return _coachCheck(body);
      case 'coachStatus': return _coachStatus(body);
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
  var authErr = _authError(p.token);
  if (authErr) return _json({ ok: false, error: authErr.error, hint: authErr.hint });
  var folder = _folder();
  var count = 0;
  var it = folder.getFiles();
  while (it.hasNext()) { if (!it.next().isTrashed()) count++; }
  return _json({ ok: true, folder: FOLDER_NAME, files: count });
}

// התיקייה הפרטית — נוצרת בשורש הדרייב אם אינה קיימת.
// DriveApp מחזיר גם פריטים שבאשפה (קובץ/תיקייה שנזרקו נשארים עם ההורה שלהם) — מדלגים עליהם
// כאן וברשימה/שליפה. בלי זה "סרוק דרייב" החזיר לגלריה תמונות שנמחקו (v19.17.9).
function _folder() {
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  while (it.hasNext()) {
    var f = it.next();
    if (!f.isTrashed()) return f;
  }
  return DriveApp.createFolder(FOLDER_NAME);
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
    while (!file && it.hasNext()) {
      var cand = it.next();
      if (!cand.isTrashed()) file = cand;
    }
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
    if (f.isTrashed()) continue;
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
      var isDoc = item && item.doc === true;
      if (!(isDoc ? /^[a-z0-9_]+$/ : /^[a-z0-9_]+\.json$/).test(name)) return { name: name, ok: false, error: 'BAD_NAME' };
      if (typeof item.content !== 'string') return { name: name, ok: false, error: 'NO_CONTENT' };
      try {
        var file, doc = null;
        if (isDoc) {
          doc = _coachDoc(folder, name, item.id, item.content);
          file = doc.file;
        } else {
          file = _coachFile(folder, name, item.id);
          if (file) file.setContent(item.content);
          else file = folder.createFile(Utilities.newBlob(item.content, 'application/json', name));
        }
        // הקבלה נרשמת רק אחרי שהכתיבה הצליחה
        if (typeof item.hash === 'string' && /^[0-9a-f]{64}$/.test(item.hash)) file.setDescription(item.hash);
        var out = { name: name, ok: true, id: file.getId(), bytes: isDoc ? 0 : file.getSize() };
        if (doc) { out.docPath = doc.path; if (doc.apiError) out.docError = doc.apiError; }
        return out;
      } catch (err) {
        return { name: name, ok: false, error: 'DRIVE_ERROR: ' + (err && err.message) };
      }
    });
    return _json({ ok: true, folderId: folder.getId(), results: results });
  } finally {
    lock.releaseLock();
  }
}

// Google Doc נייטיב, מזהה קבוע. דרך מהירה: Drive API — העלאת הטקסט כקובץ אחד שמומר ל-Doc
// (update במקום לקובץ קיים). DocumentApp בונה פסקה לכל שורה, ~800 שורות = 20–35 שניות,
// וזה מה שגרם ל-503. הדרך האיטית נשארת גיבוי: לפני אישור הרשאת UrlFetchApp, או בכשל API.
// קובץ באותו שם שאינו Doc (שארית) נזרק לאשפה ומוחלף.
function _coachDoc(folder, name, id, text) {
  var file = _coachFile(folder, name, id);
  if (file && file.getMimeType() !== MimeType.GOOGLE_DOCS) { file.setTrashed(true); file = null; }
  // מחזיר { file, path, apiError } — באיזו דרך נכתב, ולמה הדרך המהירה נכשלה אם נכשלה
  try {
    return { file: _coachDocFast(folder, name, file, text), path: 'api' };
  } catch (err) {
    return { file: _coachDocSlow(folder, name, file, text), path: 'slow', apiError: String(err && err.message || err).slice(0, 200) };
  }
}

function _coachDocFast(folder, name, file, text) {
  var auth = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  var blob = Utilities.newBlob(text, 'text/plain; charset=utf-8');
  if (file) {
    var up = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files/' + file.getId() + '?uploadType=media', {
      method: 'patch', contentType: 'text/plain; charset=utf-8', payload: blob.getBytes(),
      headers: auth, muteHttpExceptions: true
    });
    if (up.getResponseCode() >= 300) throw new Error('DRIVE_API ' + up.getResponseCode() + ' ' + up.getContentText().slice(0, 150));
    return file;
  }
  var boundary = 'gympro' + Date.now();
  var meta = JSON.stringify({ name: name, mimeType: 'application/vnd.google-apps.document', parents: [folder.getId()] });
  var head = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta +
             '\r\n--' + boundary + '\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n';
  var payload = Utilities.newBlob(head).getBytes().concat(blob.getBytes())
    .concat(Utilities.newBlob('\r\n--' + boundary + '--').getBytes());
  var res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'post', contentType: 'multipart/related; boundary=' + boundary, payload: payload,
    headers: auth, muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) throw new Error('DRIVE_API ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 150));
  return DriveApp.getFileById(JSON.parse(res.getContentText()).id);
}

function _coachDocSlow(folder, name, file, text) {
  var doc = file ? DocumentApp.openById(file.getId()) : DocumentApp.create(name);
  doc.getBody().setText(text);
  doc.saveAndClose();
  if (file) return file;
  var created = DriveApp.getFileById(doc.getId());
  created.moveTo(folder);   // DocumentApp.create יוצר בשורש הדרייב
  return created;
}

// הרצה ידנית פעם אחת מהעורך — מאשרת את ההרשאות של נתוני המאמן (Drive API + DocumentApp)
function authorizeCoach() {
  UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  });
  var doc = DocumentApp.create('gympro-authorize-check');
  DriveApp.getFileById(doc.getId()).setTrashed(true);
  Logger.log('ההרשאות של נתוני המאמן מאושרות');
}
function authorizeDocs() { authorizeCoach(); }   // השם הישן — נשאר למי שמחפש אותו

// מה כתוב בפועל: מזהה + הקבלה (hash) לכל שם. ממתין למנעול — אם כתיבה עוד רצה
// (התשובה שלה נחתכה ב-503 אבל הסקריפט ממשיך), התשובה כאן תגיע רק אחריה.
function _coachStatus(body) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(45000)) return _json({ ok: false, error: 'BUSY' });
  try {
    var folder = _coachFolder();
    var files = {};
    (body.names || []).forEach(function (name) {
      name = String(name || '');
      if (!/^[a-z0-9_]+(\.json)?$/.test(name)) return;
      var f = _coachFile(folder, name, null);
      if (f) files[name] = { id: f.getId(), hash: f.getDescription() || '' };
    });
    return _json({ ok: true, folderId: folder.getId(), files: files });
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
