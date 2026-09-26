/**
 * GYMPRO ELITE — Watch Bridge (Apps Script proxy)
 * ------------------------------------------------------------------
 * מתעד אימון חי מ-Apple Watch (דרך Shortcuts) אל Firestore, לאותו
 * doc שה-PWA קורא בזמן אמת: gympro_data/live_session.
 *
 * הייצוג ב-doc (Two-lane union): { active: bool, data: "<json>", wlog: "<json>" }.
 *   data — מסלול הטלפון (metadata + סטי-טלפון); נכתב רק ע"י ה-PWA.
 *   wlog — מסלול השעון (סטי-שעון); נכתב רק ע"י ה-proxy (append-only).
 * כל צד ממזג את שני המסלולים בקריאה (union לפי setId) — אף צד לא דורס את השני.
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

/* ─── Action router (Two-lane union) ───────────────────────────── */
// ה-proxy בעל מסלול-השעון בלבד (doc.wlog) — append-only. הוא קורא גם את מסלול
// הטלפון (doc.data) לצורך plan/suggest/currentExName, אך לעולם לא כותב אליו.
// כך אין clobber: הטלפון כותב data, ה-proxy כותב wlog, וכל צד ממזג בקריאה.
function _handle(req) {
  var action = req.action || 'getState';
  var live = _readLive();                 // { active, data:{...}, wlog:{...} } או null

  if (action === 'getState') return _state(live);

  // anti-zombie (R4): כל כתיבה דורשת סשן פעיל ו-sessionId תואם (sessionId במסלול-הטלפון)
  if (!live || live.active !== true) return { ok: false, error: 'NO_ACTIVE_SESSION' };
  var data = live.data || {}, wlog = live.wlog || {};
  if (req.sessionId && String(req.sessionId) !== String(data.sessionId)) {
    return { ok: false, error: 'SESSION_MISMATCH' };
  }

  if (action === 'logSet') {
    // ולידציה (R2): w float, r int חובה
    var w = parseFloat(req.w), r = parseInt(req.r, 10);
    if (isNaN(w) || isNaN(r)) return { ok: false, error: 'BAD_SET' };
    var rir = _normRir(req.rir);                              // נרמול (R1)
    var curName = _effectiveCurrent(data, wlog);
    var unified = _mergeLog(data.log, wlog.log);
    var setId = req.setId ||
      ('w_' + (data.sessionId || '') + '_' + Date.now() + '_' + Math.floor(Math.random() * 1e6).toString(36));
    wlog.log = wlog.log || [];
    // dedupe (R3) — מול הלוג המאוחד (טלפון+שעון)
    if (!unified.some(function (x) { return x && x.setId === setId; })) {
      wlog.log.push({
        setId: setId, exName: req.exName || curName || '',
        w: w, r: r, rir: rir, note: req.note || '',
        isCluster: false, round: null, skip: false
      });
    }
    return _commitWlog(live, wlog);
  }

  if (action === 'nextExercise') {
    var plan = data.plan || [];
    var idx = _planIndex(plan, _effectiveCurrent(data, wlog));
    var next = plan[idx + 1];
    if (next) { wlog.currentExName = next.name; wlog.currentTs = Date.now(); wlog.restTime = next.restTime || wlog.restTime; }
    return _commitWlog(live, wlog);
  }

  if (action === 'finish') {
    return _writeWlog(false, wlog) ? { ok: true, finished: true } : { ok: false, error: 'WRITE_FAIL' };
  }

  return { ok: false, error: 'UNKNOWN_ACTION' };
}

/* ─── State projection for the watch (union of both lanes) ──────── */
function _state(live) {
  if (!live || live.active !== true) return { ok: true, active: false };
  var data = live.data || {}, wlog = live.wlog || {};
  var log = _mergeLog(data.log, wlog.log);
  var plan = data.plan || [];
  var curName = _effectiveCurrent(data, wlog);
  var cur = _planItem(plan, curName);
  // setIdx נגזר מהלוג המאוחד — כמות הסטים שנרשמו לתרגיל הנוכחי (משעון ומטלפון כאחד)
  return {
    ok: true, active: true, sessionId: data.sessionId,
    currentExName: curName,
    setIdx: _countSets(log, curName),
    totalSets: cur ? (cur.sets || null) : null,
    restTime: wlog.restTime || (cur && cur.restTime) || data.restTime || 90,
    suggestWeight: (data.suggest && data.suggest[curName]) || 0,
    isCalc: cur ? !!cur.isCalc : false
  };
}

/* ─── Firestore REST helpers (two JSON-string lanes) ───────────── */
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
  var data = {}, wlog = {};
  try { data = f.data ? JSON.parse(f.data.stringValue) : {}; } catch (e) { data = {}; }
  try { wlog = f.wlog ? JSON.parse(f.wlog.stringValue) : {}; } catch (e) { wlog = {}; }
  return { active: active, data: data, wlog: wlog };
}
// _writeWlog — כותב אך ורק את מסלול-השעון (wlog) + active. updateMask מבטיח
// ש-data (מסלול-הטלפון) לא נגוע → אי אפשר לדרוס סטים מהטלפון.
function _writeWlog(active, wlogObj) {
  wlogObj.lastUpdated = Date.now();
  wlogObj.rev = (wlogObj.rev || 0) + 1;
  wlogObj.source = 'watch';
  var payload = { fields: {
    active: { booleanValue: active },
    wlog:   { stringValue: JSON.stringify(wlogObj) },
    lastUpdated: { integerValue: String(wlogObj.lastUpdated) }
  }};
  var url = _baseUrl() + '?updateMask.fieldPaths=active&updateMask.fieldPaths=wlog&updateMask.fieldPaths=lastUpdated';
  var res = UrlFetchApp.fetch(url, {
    method: 'patch', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + _token() }
  });
  return res.getResponseCode() < 300;
}
function _commitWlog(live, wlog) {
  return _writeWlog(true, wlog) ? _state({ active: true, data: live.data, wlog: wlog }) : { ok: false, error: 'WRITE_FAIL' };
}

/* ─── union helpers ────────────────────────────────────────────── */
function _mergeLog(a, b) {
  var seen = {}, out = [];
  [a, b].forEach(function (arr) { (arr || []).forEach(function (e) {
    if (e && e.setId && !seen[e.setId]) { seen[e.setId] = 1; out.push(e); }
  }); });
  return out;
}
// מצביע-התרגיל האפקטיבי: המסלול עם ה-currentTs החדש יותר (טלפון או שעון)
function _effectiveCurrent(data, wlog) {
  var dTs = (data && data.currentTs) || 0, wTs = (wlog && wlog.currentTs) || 0;
  if (wTs > dTs && wlog.currentExName) return wlog.currentExName;
  return (data && data.currentExName) || (wlog && wlog.currentExName) || '';
}
function _countSets(log, name) {
  var t = _norm(name), n = 0;
  (log || []).forEach(function (e) { if (e && !e.skip && _norm(e.exName) === t) n++; });
  return n;
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
