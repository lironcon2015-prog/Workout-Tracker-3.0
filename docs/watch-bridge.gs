/**
 * GYMPRO ELITE — Watch Bridge (Apps Script proxy)
 * ------------------------------------------------------------------
 * מתעד אימון חי מ-Apple Watch (דרך Shortcuts) אל Firestore, לאותו
 * doc שה-PWA קורא בזמן אמת: gympro_data/live_session.
 *
 * הייצוג ב-doc: { active: bool, data: "<json>" } — שדה JSON-string יחיד,
 * כך שאין צורך במיפוי-טיפוסים של Firestore. ה-PWA עוטף/פותח אותו זהה.
 *
 * הגדרה (חד-פעמית):
 *   1. צור Service Account בפרויקט ה-Firebase (Project Settings → Service accounts
 *      → Generate new private key). פתח את ה-JSON.
 *   2. Apps Script → Project Settings → Script properties, הוסף:
 *        SECRET_TOKEN          — מחרוזת סודית שתשתף עם ה-Shortcut.
 *        FB_PROJECT_ID         — מזהה הפרויקט (project_id מה-JSON).
 *        FB_CLIENT_EMAIL       — client_email מה-JSON.
 *        FB_PRIVATE_KEY        — private_key מה-JSON (כולל \n; הדבק as-is).
 *   3. Deploy → New deployment → Web app → Execute as: Me, Access: Anyone.
 *      העתק את ה-/exec URL ל-PWA (הגדרות → גשר אפל-ווטש).
 *
 * אבטחה: ה-Service Account עוקף את כללי ה-Firestore (כתיבה מוגנת ב-SECRET_TOKEN
 * בלבד). השתמש ב-token חזק. ה-PWA קורא ב-Anonymous Auth את אותו doc.
 *
 * חוזה: השעון append-only מינימלי. clusters/1RM/swap-order מנוהלים בטלפון.
 */

var DOC_PATH = 'gympro_data/live_session';

/* ─── Entry points ─────────────────────────────────────────────── */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.token !== _prop('SECRET_TOKEN')) return _json({ ok: false, error: 'BAD_TOKEN' });
    return _json(_handle(body));
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}
function doGet(e) {
  // נוחות/בדיקות: כל הפעולות דרך GET (?token=...&action=...&w=...&r=...)
  var p = (e && e.parameter) || {};
  if (p.token !== _prop('SECRET_TOKEN')) return _json({ ok: false, error: 'BAD_TOKEN' });
  try {
    return _json(_handle(p));
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

/* ─── Action router ────────────────────────────────────────────── */
function _handle(req) {
  var action = req.action || 'getState';
  var live = _readLive();                 // { active, data:{...} } או null

  if (action === 'getState') return _state(live);

  // anti-zombie (R4): כל כתיבה דורשת סשן פעיל ו-sessionId תואם
  if (!live || live.active !== true) return { ok: false, error: 'NO_ACTIVE_SESSION' };
  var s = live.data || {};
  if (req.sessionId && String(req.sessionId) !== String(s.sessionId)) {
    return { ok: false, error: 'SESSION_MISMATCH' };
  }

  if (action === 'logSet') {
    // ולידציה (R2): w float, r int חובה
    var w = parseFloat(req.w), r = parseInt(req.r, 10);
    if (isNaN(w) || isNaN(r)) return { ok: false, error: 'BAD_SET' };
    var rir = _normRir(req.rir);                              // נרמול (R1)
    var setId = req.setId || ('w_' + s.sessionId + '_' + Date.now());
    s.log = s.log || [];
    // dedupe (R3)
    if (!s.log.some(function (x) { return x && x.setId === setId; })) {
      s.log.push({
        setId: setId, exName: req.exName || s.currentExName || '',
        w: w, r: r, rir: rir, note: req.note || '',
        isCluster: !!s.currentIsCluster, round: s.currentRound || null, skip: false
      });
      s.setIdx = (s.setIdx || 0) + 1;
    }
    return _commit(s);
  }

  if (action === 'nextExercise') {
    var plan = s.plan || [];
    var idx = _planIndex(plan, s.currentExName);
    var next = plan[idx + 1];
    if (next) { s.currentExName = next.name; s.setIdx = 0; s.restTime = next.restTime || s.restTime; }
    return _commit(s);
  }

  if (action === 'finish') {
    return _writeLive(false, s) ? { ok: true, finished: true } : { ok: false, error: 'WRITE_FAIL' };
  }

  return { ok: false, error: 'UNKNOWN_ACTION' };
}

/* ─── State projection for the watch ───────────────────────────── */
function _state(live) {
  if (!live || live.active !== true) return { ok: true, active: false };
  var s = live.data || {};
  var plan = s.plan || [];
  var cur = _planItem(plan, s.currentExName);
  // משקל מוצע: last weight אם נשמר ב-payload; ל-calc בלי RM → ידני (R9)
  return {
    ok: true, active: true, sessionId: s.sessionId,
    currentExName: s.currentExName || '',
    setIdx: s.setIdx || 0,
    totalSets: cur ? (cur.sets || null) : null,
    restTime: s.restTime || (cur && cur.restTime) || 90,
    suggestWeight: (s.suggest && s.suggest[s.currentExName]) || 0,
    isCalc: cur ? !!cur.isCalc : false
  };
}

/* ─── Firestore REST helpers (single JSON-string field) ────────── */
function _baseUrl() {
  return 'https://firestore.googleapis.com/v1/projects/' + _prop('FB_PROJECT_ID') +
         '/databases/(default)/documents/' + DOC_PATH;
}
function _readLive() {
  var res = UrlFetchApp.fetch(_baseUrl(), {
    method: 'get', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + _token() }
  });
  if (res.getResponseCode() === 404) return null;
  var doc = JSON.parse(res.getContentText());
  var f = doc.fields || {};
  var active = f.active ? f.active.booleanValue === true : false;
  var data = {};
  try { data = f.data ? JSON.parse(f.data.stringValue) : {}; } catch (e) { data = {}; }
  return { active: active, data: data };
}
function _writeLive(active, dataObj) {
  dataObj.lastUpdated = Date.now();
  dataObj.rev = (dataObj.rev || 0) + 1;
  dataObj.source = 'watch';
  dataObj.active = active;
  var payload = { fields: {
    active: { booleanValue: active },
    data:   { stringValue: JSON.stringify(dataObj) },
    lastUpdated: { integerValue: String(dataObj.lastUpdated) }
  }};
  var url = _baseUrl() + '?updateMask.fieldPaths=active&updateMask.fieldPaths=data&updateMask.fieldPaths=lastUpdated';
  var res = UrlFetchApp.fetch(url, {
    method: 'patch', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + _token() }
  });
  return res.getResponseCode() < 300;
}
function _commit(s) {
  return _writeLive(true, s) ? _state({ active: true, data: s }) : { ok: false, error: 'WRITE_FAIL' };
}

/* ─── OAuth2 access token via service-account JWT ──────────────── */
function _token() {
  var cached = CacheService.getScriptCache().get('fb_token');
  if (cached) return cached;
  var now = Math.floor(Date.now() / 1000);
  var header = _b64({ alg: 'RS256', typ: 'JWT' });
  var claim = _b64({
    iss: _prop('FB_CLIENT_EMAIL'),
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600
  });
  var sig = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(header + '.' + claim, _prop('FB_PRIVATE_KEY').replace(/\\n/g, '\n'))
  ).replace(/=+$/, '');
  var jwt = header + '.' + claim + '.' + sig;
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }
  });
  var tok = JSON.parse(res.getContentText()).access_token;
  CacheService.getScriptCache().put('fb_token', tok, 3300);
  return tok;
}

/* ─── utils ────────────────────────────────────────────────────── */
function _normRir(v) {
  if (v === null || v === undefined || v === '') return '';
  var s = String(v).trim().toLowerCase();
  if (s === 'fail' || s === 'f' || s === '0') return s === 'fail' || s === 'f' ? 'Fail' : '0';
  var n = parseFloat(s);
  return isNaN(n) ? '' : String(n);
}
function _norm(n) { return String(n || '').replace(/\s*\(Main\)\s*$/i, '').trim(); }
function _planIndex(plan, name) {
  var t = _norm(name);
  for (var i = 0; i < plan.length; i++) if (_norm(plan[i].name) === t) return i;
  return -1;
}
function _planItem(plan, name) { var i = _planIndex(plan, name); return i >= 0 ? plan[i] : null; }
function _prop(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function _b64(o) { return Utilities.base64EncodeWebSafe(JSON.stringify(o)).replace(/=+$/, ''); }
function _json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
