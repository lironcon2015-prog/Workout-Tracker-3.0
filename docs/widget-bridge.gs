/**
 * GYMPRO ELITE — iPhone Widget Bridge (Google Apps Script)
 * ----------------------------------------------------------------------------
 * גשר ווידג'ט: האפליקציה דוחפת אליו snapshot קומפקטי (תזונה היום + מאקרו,
 * משקל + מגמה שבועית, האימון האחרון) בכל פתיחה וביציאה; ווידג'ט Scriptable
 * במסך הבית מושך אותו ומרנדר (ראה docs/widget-scriptable.js).
 *
 * אחסון: PropertiesService של הסקריפט — snapshot אחד בלבד, נדרס בכל דחיפה.
 * אין מידע רגיש ב-snapshot (מספרים בלבד), אבל ה-token מגן על הגישה בכל זאת.
 *
 * ── פריסה (חד-פעמי, זהה לשאר הגשרים) ───────────────────────────────────────
 * 1. היכנס ל-https://script.google.com → New project.
 * 2. הדבק את כל הקובץ הזה. שנה את SECRET_TOKEN לערך אקראי משלך.
 * 3. Deploy → New deployment → type: Web app.
 *      - Execute as:  Me
 *      - Who has access: Anyone (ה-token מגן על הגישה)
 *    (אין צורך באישור הרשאות Gmail — הגשר הזה לא שולח מיילים.)
 * 4. העתק את "Web app URL" → הדבק בהגדרות GYMPRO ("ווידג'ט אייפון") יחד עם
 *    ה-SECRET_TOKEN (הערך בלבד, בלי גרשיים), הפעל את המתג ולחץ "דחוף snapshot עכשיו".
 * 5. התקן את אפליקציית Scriptable, צור סקריפט חדש והדבק את docs/widget-scriptable.js
 *    (עם אותו URL ו-token) — ואז הוסף ווידג'ט Scriptable בגודל Medium למסך הבית.
 *
 * בדיקה בדפדפן:  <WebAppURL>?token=<SECRET_TOKEN>  ← אמור להחזיר {"ok":true,...}
 * ==========================================================================*/

// 🔐 שנה לערך אקראי משלך (אותיות/ספרות). העתק אותו גם להגדרות GYMPRO ולסקריפט הווידג'ט.
var SECRET_TOKEN = 'CHANGE_ME_to_a_random_secret';

var STORE_KEY = 'widget_snapshot';

/* ─── קליטת snapshot מהאפליקציה (POST) ────────────────────────────────────
 * Body (JSON): { "token": "...", "snapshot": { generated, nutrition, weight, workout } }
 */
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return _json({ ok: false, error: 'BAD_JSON' }); }

  var tok = (body && body.token) || (e && e.parameter && e.parameter.token) || '';
  if (tok !== SECRET_TOKEN) return _json({ ok: false, error: 'BAD_TOKEN' });

  var snap = body && body.snapshot;
  if (!snap || !snap.generated) return _json({ ok: false, error: 'BAD_SNAPSHOT' });

  PropertiesService.getScriptProperties().setProperty(STORE_KEY, JSON.stringify(snap));
  return _json({ ok: true, stored: snap.generated });
}

/* ─── שליפה לווידג'ט (GET) ────────────────────────────────────────────────
 * <URL>?token=...  ←  { ok:true, snapshot:{...} | null }
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.token !== SECRET_TOKEN) return _json({ ok: false, error: 'BAD_TOKEN' });
  var raw = PropertiesService.getScriptProperties().getProperty(STORE_KEY);
  var snap = null;
  try { snap = raw ? JSON.parse(raw) : null; } catch (err) {}
  return _json({ ok: true, snapshot: snap });
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
