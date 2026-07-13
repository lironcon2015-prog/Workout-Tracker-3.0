/* ============================================================================
 * photos-logic.js — תמונות התקדמות (Progress Photos) GYMPRO ELITE
 * תת-טאב "תמונות" במסך Composition: צילום עם Ghost Overlay, גלריה,
 * אחסון היברידי (IndexedDB מקומי + Google Drive דרך גשר Apps Script),
 * וניתוח AI משורשר (Gemini) עם זיכרון מגמה קטן שרוכב על ה-config.
 * תמונות לעולם לא נשמרות ב-Firestore (מגבלת 1MB/doc).
 * ==========================================================================*/

// ─── קבועים ─────────────────────────────────────────────────────────────────
const _PP_DB_NAME    = 'gympro-photos';
const _PP_DB_VERSION = 1;
const _PP_MAX_DIM    = 1600;   // צלע מקסימלית לתמונה המלאה (px)
const _PP_JPEG_Q     = 0.82;   // איכות JPEG לתמונה המלאה (~150-400KB)
const _PP_THUMB_DIM  = 240;    // צלע מקסימלית ל-thumbnail
const _PP_THUMB_Q    = 0.7;

// ─── עזרי תאריך (מקומי — לא UTC, ראה הערה ב-bodylog-logic) ─────────────────
function _ppLocalDateStr(d) { const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
function _ppTodayStr() { return _ppLocalDateStr(new Date()); }
function _ppDaysBetween(a, b) {
    const ts = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
    return Math.round((ts(b) - ts(a)) / 86400000);
}

// ─── IndexedDB ───────────────────────────────────────────────────────────────
// שתי חנויות: photos (התמונה המלאה הדחוסה) + thumbs (תצוגה מקדימה לגלריה).
// keyPath: id = 'YYYY-MM-DD' — תמונה אחת ליום.
let _ppDbPromise = null;

function _ppDB() {
    if (_ppDbPromise) return _ppDbPromise;
    _ppDbPromise = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) { reject(new Error('NO_IDB')); return; }
        const req = indexedDB.open(_PP_DB_NAME, _PP_DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('thumbs')) db.createObjectStore('thumbs', { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error || new Error('IDB_OPEN_FAILED'));
    });
    // כשל פתיחה לא ננעל לתמיד — ניסיון חוזר בקריאה הבאה
    _ppDbPromise.catch(() => { _ppDbPromise = null; });
    return _ppDbPromise;
}

function _ppIdbReq(storeName, mode, fn) {
    return _ppDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const req = fn(tx.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
    }));
}

function _ppIdbPut(store, value)  { return _ppIdbReq(store, 'readwrite', s => s.put(value)); }
function _ppIdbGet(store, id)     { return _ppIdbReq(store, 'readonly',  s => s.get(id)); }
function _ppIdbDel(store, id)     { return _ppIdbReq(store, 'readwrite', s => s.delete(id)); }
function _ppIdbKeys(store)        { return _ppIdbReq(store, 'readonly',  s => s.getAllKeys()); }

// ─── דחיסת תמונה (canvas → JPEG) ────────────────────────────────────────────
// mirror=true הופך אופקית בזמן הציור — נורמליזציית מצלמה קדמית, כדי שכל
// התמונות בשרשרת יהיו באותו כיוון (קריטי להשוואת AI).

async function _ppLoadBitmap(blob) {
    if ('createImageBitmap' in window) {
        try { return await createImageBitmap(blob); } catch (e) { /* fallback לתמונה */ }
    }
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('IMG_DECODE_FAILED')); };
        img.src = url;
    });
}

function _ppBitmapSize(bmp) {
    return { w: bmp.width || bmp.naturalWidth, h: bmp.height || bmp.naturalHeight };
}

function _ppDrawToJpeg(bmp, maxDim, quality, mirror) {
    const { w, h } = _ppBitmapSize(bmp);
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const outW = Math.round(w * scale), outH = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (mirror) { ctx.translate(outW, 0); ctx.scale(-1, 1); }
    ctx.drawImage(bmp, 0, 0, outW, outH);
    return new Promise((resolve, reject) => {
        canvas.toBlob(b => b ? resolve({ blob: b, w: outW, h: outH }) : reject(new Error('TO_BLOB_FAILED')), 'image/jpeg', quality);
    });
}

// דוחס מקור (Blob/File) לתמונה מלאה + thumbnail בירידת רזולוציה אחת
async function ppCompressPhoto(sourceBlob, mirror) {
    const bmp = await _ppLoadBitmap(sourceBlob);
    try {
        const photo = await _ppDrawToJpeg(bmp, _PP_MAX_DIM, _PP_JPEG_Q, !!mirror);
        const thumb = await _ppDrawToJpeg(bmp, _PP_THUMB_DIM, _PP_THUMB_Q, !!mirror);
        return { photo, thumb: thumb.blob };
    } finally {
        if (bmp.close) bmp.close();
    }
}

// ─── Base64 ↔ Blob (לתעבורת הגשר ול-Gemini) ────────────────────────────────
function _ppBlobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload  = () => resolve(String(r.result).split(',')[1] || '');
        r.onerror = () => reject(r.error || new Error('READ_FAILED'));
        r.readAsDataURL(blob);
    });
}

function _ppBase64ToBlob(base64, mime) {
    const bin = atob(base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime || 'image/jpeg' });
}

// ─── שמירת תמונה (הצינור המרכזי) ────────────────────────────────────────────
// צילום → דחיסה → IndexedDB → עדכון אינדקס (מסונכרן דרך config) → תור העלאה.
// דריסת תמונת אותו יום = החלפה (האישור נעשה בשכבת ה-UI לפני הקריאה).

async function ppStorePhoto(sourceBlob, opts) {
    const o = opts || {};
    const date = o.date || _ppTodayStr();
    const { photo, thumb } = await ppCompressPhoto(sourceBlob, o.mirror);
    await _ppIdbPut('photos', { id: date, blob: photo.blob, w: photo.w, h: photo.h, bytes: photo.blob.size, uploaded: false, driveId: null });
    await _ppIdbPut('thumbs', { id: date, blob: thumb });

    // עדכון האינדקס הקל (רוכב על config — מסונכרן בין מכשירים, בלי bytes)
    const index = StorageManager.getPhotoIndex().filter(e => e.date !== date);
    index.push({ date, driveId: null, bytes: photo.blob.size, w: photo.w, h: photo.h });
    index.sort((a, b) => a.date < b.date ? -1 : 1);
    StorageManager.savePhotoIndex(index);
    _ppSyncConfigSoon();
    _ppKickUploads();
    return { date, bytes: photo.blob.size };
}

// שליפת תמונה מלאה: קודם IndexedDB; אם פונתה (iOS) — משיכה מהדרייב לפי driveId
async function ppGetPhotoBlob(date) {
    try {
        const rec = await _ppIdbGet('photos', date);
        if (rec && rec.blob) return rec.blob;
    } catch (e) { console.warn('GymPro photos: IDB read failed', e); }
    return _ppFetchFromDrive(date);
}

async function ppGetThumbBlob(date) {
    try {
        const rec = await _ppIdbGet('thumbs', date);
        if (rec && rec.blob) return rec.blob;
    } catch (e) { /* ממשיכים לדרייב */ }
    // thumbnail חסר (מכשיר חדש) — משיכת המלאה מהדרייב ובנייה מחדש מקומית
    const full = await _ppFetchFromDrive(date);
    if (!full) return null;
    try {
        const { photo, thumb } = await ppCompressPhoto(full, false);
        await _ppIdbPut('photos', { id: date, blob: photo.blob, w: photo.w, h: photo.h, bytes: photo.blob.size, uploaded: true, driveId: _ppDriveIdOf(date) });
        await _ppIdbPut('thumbs', { id: date, blob: thumb });
        return thumb;
    } catch (e) { return full; }
}

function _ppDriveIdOf(date) {
    const e = StorageManager.getPhotoIndex().find(x => x.date === date);
    return (e && e.driveId) || null;
}

// מחיקה: מקומית + מהדרייב (החלטת מוצר — מחיקה מוחקת בכל מקום)
async function ppDeletePhoto(date) {
    try { await _ppIdbDel('photos', date); await _ppIdbDel('thumbs', date); } catch (e) { /* לא חוסם */ }
    const driveId = _ppDriveIdOf(date);
    StorageManager.savePhotoIndex(StorageManager.getPhotoIndex().filter(e => e.date !== date));
    _ppSyncConfigSoon();
    if (driveId) _ppDriveDelete(driveId);   // ברקע — כשל לא חוסם את המחיקה המקומית
}

// ─── סנכרון config מרוכך (debounce) ────────────────────────────────────────
let _ppConfigTimer = null;
function _ppSyncConfigSoon() {
    clearTimeout(_ppConfigTimer);
    _ppConfigTimer = setTimeout(() => {
        if (typeof FirebaseManager !== 'undefined' && FirebaseManager.saveConfigToCloud) {
            FirebaseManager.saveConfigToCloud().catch(() => {});
        }
    }, 3000);
}

// ─── גשר הדרייב (Apps Script — docs/photo-bridge.gs) ───────────────────────
// Content-Type: text/plain — בקשה "פשוטה" בלי preflight (כמו שאר הגשרים).

function _ppBridgePost(payload, timeoutMs) {
    const { on, url, token } = StorageManager.getPhotoBridge();
    if (!on || !url) return Promise.reject(new Error('BRIDGE_OFF'));
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs || 45000);
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ token }, payload)),
        signal: ctrl.signal
    })
        .then(r => r.json())
        .then(res => {
            if (!res || !res.ok) throw new Error((res && res.error) || 'BRIDGE_ERROR');
            return res;
        })
        .finally(() => clearTimeout(t));
}

// בדיקת חיבור (doGet health) — לכפתור בהגדרות
function ppTestPhotoBridge() {
    const { url, token } = StorageManager.getPhotoBridge();
    if (!url) return Promise.reject(new Error('NO_URL'));
    return fetch(url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token))
        .then(r => r.json())
        .then(res => {
            if (!res || !res.ok) throw new Error((res && res.error) || 'BRIDGE_ERROR');
            return res;   // { ok, folder, files }
        });
}

// ─── תור העלאה לדרייב ──────────────────────────────────────────────────────
// רשומות אינדקס בלי driveId = ממתינות. רץ אחרי צילום, בפתיחה, ובחזרת רשת.
// כשל עוצר את הסבב (ינוסה שוב בטריגר הבא) — בלי לולאת retry אגרסיבית.
let _ppUploadBusy = false;

async function _ppProcessUploadQueue() {
    if (_ppUploadBusy) return;
    const { on, url } = StorageManager.getPhotoBridge();
    if (!on || !url || !navigator.onLine) return;
    const pending = StorageManager.getPhotoIndex().filter(e => !e.driveId);
    if (!pending.length) return;
    _ppUploadBusy = true;
    try {
        for (const entry of pending) {
            let rec;
            try { rec = await _ppIdbGet('photos', entry.date); } catch (e) { rec = null; }
            if (!rec || !rec.blob) continue;   // אין bytes מקומיים — אין מה להעלות
            const base64 = await _ppBlobToBase64(rec.blob);
            const res = await _ppBridgePost({ action: 'upload', date: entry.date, data: base64, mime: 'image/jpeg' });
            // עדכון driveId באינדקס וב-IDB — קריאה טרייה של האינדקס נגד דריסת שינויים מקבילים
            const idx = StorageManager.getPhotoIndex();
            const cur = idx.find(e => e.date === entry.date);
            if (cur) { cur.driveId = res.id; StorageManager.savePhotoIndex(idx); }
            rec.uploaded = true; rec.driveId = res.id;
            await _ppIdbPut('photos', rec);
            if (typeof _ppRefreshGalleryBadges === 'function') _ppRefreshGalleryBadges();
        }
        _ppSyncConfigSoon();
    } catch (e) {
        console.warn('GymPro photos: upload queue stopped', e);
    } finally {
        _ppUploadBusy = false;
    }
}

function _ppKickUploads() { _ppProcessUploadQueue(); }

// משיכת תמונה מלאה מהדרייב (לפי driveId מהאינדקס, fallback לפי שם התאריך)
async function _ppFetchFromDrive(date) {
    const { on, url } = StorageManager.getPhotoBridge();
    if (!on || !url) return null;
    try {
        const driveId = _ppDriveIdOf(date);
        const res = await _ppBridgePost(driveId ? { action: 'get', id: driveId } : { action: 'get', date }, 60000);
        if (!res.data) return null;
        // driveId התגלה דרך fallback לפי שם — נקבע אותו באינדקס
        if (!driveId && res.id) {
            const idx = StorageManager.getPhotoIndex();
            const cur = idx.find(e => e.date === date);
            if (cur) { cur.driveId = res.id; StorageManager.savePhotoIndex(idx); _ppSyncConfigSoon(); }
        }
        return _ppBase64ToBlob(res.data, res.mime);
    } catch (e) {
        console.warn('GymPro photos: drive fetch failed', date, e);
        return null;
    }
}

// מחיקה בדרייב — ברקע, כשל לא חוסם (הקובץ יימחק בניסיון ידני עתידי דרך סריקה)
function _ppDriveDelete(driveId) {
    _ppBridgePost({ action: 'del', id: driveId }).catch(e =>
        console.warn('GymPro photos: drive delete failed', e));
}

// ─── Reconciliation — "סרוק את הדרייב" ─────────────────────────────────────
// משחזר את האינדקס מרשימת הקבצים בדרייב (מיזוג — לא דריסה): מכשיר חדש בלי
// config, או אינדקס שאבד. thumbnails ייבנו lazy בגלילת הגלריה.
async function ppReconcileFromDrive() {
    const res = await _ppBridgePost({ action: 'list' }, 60000);
    const idx = StorageManager.getPhotoIndex();
    let added = 0, linked = 0;
    (res.files || []).forEach(f => {
        const cur = idx.find(e => e.date === f.date);
        if (cur) {
            if (!cur.driveId) { cur.driveId = f.id; linked++; }
        } else {
            idx.push({ date: f.date, driveId: f.id, bytes: f.bytes || 0 });
            added++;
        }
    });
    idx.sort((a, b) => a.date < b.date ? -1 : 1);
    StorageManager.savePhotoIndex(idx);
    _ppSyncConfigSoon();
    return { added, linked, total: idx.length };
}

// ─── טריגרים: פתיחת אפליקציה + חזרת רשת ─────────────────────────────────────
window.addEventListener('online', () => _ppKickUploads());
document.addEventListener('DOMContentLoaded', () => setTimeout(_ppKickUploads, 4000));
