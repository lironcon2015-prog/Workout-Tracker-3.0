/**
 * GYMPRO ELITE — Weekly Backup Bridge (Google Apps Script)
 * ----------------------------------------------------------------------------
 * גשר גיבוי: האפליקציה דוחפת אליו אחת לשבוע (בפתיחה) את קובץ הגיבוי המלא
 * (צילום localStorage — כל הנתונים + כל המפתחות), והוא שולח אותו כקובץ
 * מצורף לאימייל של בעל הסקריפט (אתה).
 *
 * אין אחסון — הגשר רק מעביר: קיבל → שלח מייל → סיים.
 * ⚠️ הגיבוי מכיל סודות (API keys, tokens). המייל נשלח מחשבונך לעצמך בלבד.
 *
 * ── פריסה (חד-פעמי, זהה לשאר הגשרים) ───────────────────────────────────────
 * 1. היכנס ל-https://script.google.com → New project.
 * 2. הדבק את כל הקובץ הזה. שנה את SECRET_TOKEN לערך אקראי משלך.
 * 3. חובה — אישור הרשאת Gmail: בחר בתפריט הפונקציות את testMail → Run (▶) →
 *    Review permissions → בחר חשבון → Advanced → Go to (unsafe) → Allow.
 *    בלי הצעד הזה השליחה תיכשל עם MAIL_FAILED ("does not have permission").
 *    (המנגנון: MailApp — הרשאה קלה שמאושרת תמיד, לא ההרשאה הרגישה של Gmail.)
 *    ודא שהגיע מייל בדיקה.
 * 4. Deploy → New deployment → type: Web app.
 *      - Execute as:  Me
 *      - Who has access: Anyone (ה-token מגן על הגישה)
 * 5. העתק את "Web app URL" → הדבק בהגדרות GYMPRO ("גיבוי שבועי לאימייל")
 *    יחד עם ה-SECRET_TOKEN (הערך בלבד, בלי גרשיים), והפעל את המתג.
 * 6. בהגדרות לחץ "שלח גיבוי עכשיו" — אמור להגיע מייל תוך שניות.
 *
 * בדיקה בדפדפן:  <WebAppURL>?token=<SECRET_TOKEN>  ← אמור להחזיר {"ok":true,...}
 * ==========================================================================*/

// 🔐 שנה לערך אקראי משלך (אותיות/ספרות). העתק אותו גם להגדרות GYMPRO.
var SECRET_TOKEN = 'CHANGE_ME_to_a_random_secret';

/* ─── קליטת גיבוי מהאפליקציה (POST) ───────────────────────────────────────
 * Body (JSON): { "token": "...", "filename": "gympro_full_backup_....json",
 *                "backup": { type:'gympro_full_backup', version, date, keyCount, keys:{...} } }
 */
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return _json({ ok: false, error: 'BAD_JSON' }); }

  var tok = (body && body.token) || (e && e.parameter && e.parameter.token) || '';
  if (tok !== SECRET_TOKEN) return _json({ ok: false, error: 'BAD_TOKEN' });

  var backup = body && body.backup;
  if (!backup || backup.type !== 'gympro_full_backup' || !backup.keys) {
    return _json({ ok: false, error: 'BAD_BACKUP' });
  }

  var filename = String(body.filename || 'gympro_full_backup.json').replace(/[^\w.\-]/g, '_');
  var json = JSON.stringify(backup, null, 2);
  var keyCount = backup.keyCount || Object.keys(backup.keys).length;
  var sizeKb = Math.round(json.length / 1024);
  var to = Session.getEffectiveUser().getEmail();   // בעל הסקריפט — אתה

  try {
    MailApp.sendEmail(to, 'GYMPRO ELITE — גיבוי שבועי (' + new Date().toLocaleDateString('he-IL') + ')',
      'מצורף קובץ הגיבוי המלא של GYMPRO ELITE.\n\n' +
      'גרסת אפליקציה: ' + (backup.version || '?') + '\n' +
      'מועד הגיבוי: ' + (backup.date || '?') + '\n' +
      'מפתחות: ' + keyCount + ' · גודל: ~' + sizeKb + 'KB\n\n' +
      'שחזור: הגדרות ← גיבוי מקומי (קובץ) ← "שחזור גיבוי מלא" ← בחר את הקובץ המצורף.\n' +
      '⚠️ הקובץ מכיל את כל המפתחות והטוקנים — אל תעביר אותו הלאה.',
      { attachments: [Utilities.newBlob(json, 'application/json', filename)], name: 'GYMPRO ELITE' });
  } catch (err) {
    return _json({ ok: false, error: 'MAIL_FAILED: ' + err });
  }
  return _json({ ok: true, sentTo: to, keyCount: keyCount, sizeKb: sizeKb });
}

/* ─── בדיקת חיים (GET) ────────────────────────────────────────────────────*/
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.token !== SECRET_TOKEN) return _json({ ok: false, error: 'BAD_TOKEN' });
  return _json({ ok: true, bridge: 'gympro_backup', mailTo: Session.getEffectiveUser().getEmail() });
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ─── testMail — הרץ ידנית פעם אחת מהעורך לאישור הרשאת ה-Gmail ───────────*/
function testMail() {
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
    'GYMPRO — בדיקת הרשאות', 'אם קיבלת את זה — ההרשאה עובדת ✅');
}
