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

/* ════════ UI — תת-טאב "תמונות" במסך Composition ════════ */

let _ppObjUrls = [];                       // object URLs פעילים — מבוטלים ברינדור הבא
let _ppCompareSel = { a: null, b: null };  // תאריכי ההשוואה (a = חדשה, b = ישנה)

function _ppUrl(blob) { const u = URL.createObjectURL(blob); _ppObjUrls.push(u); return u; }
function _ppRevokeUrls() { _ppObjUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} }); _ppObjUrls = []; }

function _ppIndexDesc() {
    return StorageManager.getPhotoIndex().slice().sort((a, b) => a.date < b.date ? 1 : -1);
}

function _ppListDate(d) { const p = d.split('-'); return `${p[2]}.${p[1]}.${p[0]}`; }
function _ppCellDate(d) { const p = d.split('-'); return `${p[2]}.${p[1]}.${p[0].slice(2)}`; }

// הרנדר הראשי — נקרא מ-renderBodyLog ומ-setBodyTab('photos')
function _renderBodyPhotos() {
    const view = document.getElementById('bl-view-photos');
    if (!view) return;
    _ppRevokeUrls();
    const index = _ppIndexDesc();
    const btn = document.getElementById('pp-analyze-btn');
    if (btn) {
        const hasKey = !!(typeof StorageManager.getAIConfig === 'function' && StorageManager.getAIConfig().apiKey);
        btn.disabled = index.length < 2 || !hasKey;
        btn.title = !hasKey ? 'דרוש מפתח Gemini (הגדרות → AI)' : (index.length < 2 ? 'דרושות לפחות 2 תמונות' : '');
    }
    _ppRenderAnalysisCard();
    _ppRenderCompareCard(index);
    _ppRenderGallery(index);
    if (typeof _ppMaybeAutoAnalyze === 'function') _ppMaybeAutoAnalyze();
}

// ─── כרטיס ניתוח AI אחרון ───────────────────────────────────────────────────
function _ppRenderAnalysisCard() {
    const el = document.getElementById('pp-analysis-card');
    if (!el) return;
    const trend = StorageManager.getPhotoTrend();
    const entries = (trend && trend.entries) || [];
    if (!entries.length) {
        el.innerHTML = '<div class="bl-chart-title">ניתוח AI</div>' +
            '<div class="pp-empty-sub">טרם בוצע ניתוח. עם 2+ תמונות (במרווח של ~10 ימים ומעלה) לחץ "נתח עכשיו", או המתן לניתוח השבועי האוטומטי.</div>';
        return;
    }
    const last = entries[entries.length - 1];
    const compTxt = 'בר-השוואה: ' + last.comparability + '/10';
    const meta = _ppListDate(last.date) + ' מול ' + _ppListDate(last.vsDate) + ' · ' + compTxt;
    let html = '<div class="bl-chart-title">ניתוח AI אחרון</div><div class="pp-analysis-meta">' + meta + '</div>';
    if (last.comparability < 5) {
        // הניתוח סירב להשוות — הצגת הסיבות כפידבק לצילום הבא
        html += '<div class="pp-analysis-summary">ההשוואה לא בוצעה — איכות הצילום אינה מספיקה להשוואה אמינה.</div>';
        if ((last.flags || []).length)
            html += '<div class="pp-analysis-flags">לתיקון בצילום הבא: ' + last.flags.join(' · ') + '</div>';
    } else {
        html += '<div class="pp-analysis-summary">' + (last.summary || '') + '</div>';
        const regionNames = { shoulders: 'כתפיים', chest: 'חזה', waist: 'מותן', arms: 'זרועות' };
        const regions = last.regions || {};
        const chips = Object.keys(regionNames)
            .filter(k => regions[k])
            .map(k => {
                const v = String(regions[k]);
                const cls = /clear/.test(v) ? 'clear' : (/subtle/.test(v) ? 'subtle' : '');
                const lbl = /clear/.test(v) ? 'שינוי ברור' : (/subtle/.test(v) ? 'שינוי עדין' : 'ללא שינוי');
                return '<span class="pp-region-chip ' + cls + '">' + regionNames[k] + ': ' + lbl + '</span>';
            }).join('');
        if (chips) html += '<div class="pp-analysis-regions">' + chips + '</div>';
        if ((last.flags || []).length)
            html += '<div class="pp-analysis-flags">שים לב: ' + last.flags.join(' · ') + '</div>';
    }
    if (trend.aiNotes) html += '<div class="pp-analysis-notes">מצב מצטבר: ' + trend.aiNotes + '</div>';
    el.innerHTML = html;
}

// ─── כרטיס השוואה צד-לצד ────────────────────────────────────────────────────
// ברירת מחדל: התמונה האחרונה מול הקרובה ביותר ל-14 יום אחורה.
function _ppDefaultCompareDate(index, newestDate) {
    const target = _ppDaysBetween('1970-01-01', newestDate) - 14;
    let best = null, bestDist = Infinity;
    index.forEach(e => {
        if (e.date >= newestDate) return;
        const dist = Math.abs(_ppDaysBetween('1970-01-01', e.date) - target);
        if (dist < bestDist) { bestDist = dist; best = e.date; }
    });
    return best;
}

function _ppRenderCompareCard(index) {
    const el = document.getElementById('pp-compare-card');
    if (!el) return;
    if (index.length < 2) { el.style.display = 'none'; return; }
    el.style.display = '';
    const newest = index[0].date;
    if (!_ppCompareSel.a || !index.find(e => e.date === _ppCompareSel.a)) _ppCompareSel.a = newest;
    if (!_ppCompareSel.b || !index.find(e => e.date === _ppCompareSel.b) || _ppCompareSel.b === _ppCompareSel.a)
        _ppCompareSel.b = _ppDefaultCompareDate(index, _ppCompareSel.a) || index[index.length - 1].date;
    const opts = sel => index.map(e =>
        `<option value="${e.date}" ${e.date === sel ? 'selected' : ''}>${_ppListDate(e.date)}</option>`).join('');
    // RTL: העמודה הראשונה מוצגת מימין — הישנה ("לפני") מימין, החדשה משמאל
    el.innerHTML =
        '<div class="bl-chart-title">השוואה</div>' +
        '<div class="pp-compare-row">' +
        '<div class="pp-compare-col"><select class="pp-compare-sel" onchange="ppSetCompare(\'b\', this.value)">' + opts(_ppCompareSel.b) + '</select><img id="pp-cmp-b" alt="לפני"></div>' +
        '<div class="pp-compare-col"><select class="pp-compare-sel" onchange="ppSetCompare(\'a\', this.value)">' + opts(_ppCompareSel.a) + '</select><img id="pp-cmp-a" alt="אחרי"></div>' +
        '</div><div class="pp-compare-delta" id="pp-cmp-delta"></div>';
    _ppFillCompareImages();
}

function ppSetCompare(side, date) {
    _ppCompareSel[side] = date;
    _ppFillCompareImages();
}

async function _ppFillCompareImages() {
    const { a, b } = _ppCompareSel;
    for (const [side, date] of [['b', b], ['a', a]]) {
        const img = document.getElementById('pp-cmp-' + side);
        if (!img || !date) continue;
        const blob = await ppGetPhotoBlob(date).catch(() => null);
        if (blob && img.isConnected) img.src = _ppUrl(blob);
    }
    // דלתת משקל בין התאריכים — משקל despiked מהשקילות (אם קיים בסביבה)
    const deltaEl = document.getElementById('pp-cmp-delta');
    if (!deltaEl || !a || !b) return;
    const wa = _ppWeightNear(a), wb = _ppWeightNear(b);
    const days = Math.abs(_ppDaysBetween(b, a));
    if (wa != null && wb != null) {
        const d = Math.round((wa - wb) * 10) / 10;
        const sign = d > 0 ? '+' : '';
        deltaEl.innerHTML = '<strong>' + sign + d + ' ק"ג</strong> בין התאריכים (' + days + ' ימים) · ' + wb + ' ← ' + wa + ' ק"ג';
    } else {
        deltaEl.textContent = days + ' ימים בין התאריכים · אין נתוני שקילה סמוכים';
    }
}

// משקל בשקילה הקרובה ביותר לתאריך (עד ±5 ימים), null אם אין
function _ppWeightNear(date) {
    const log = (StorageManager.getBodyLog() || []).filter(e => e && e.date && e.weight != null);
    let best = null, bestDist = Infinity;
    log.forEach(e => {
        const dist = Math.abs(_ppDaysBetween(e.date, date));
        if (dist < bestDist) { bestDist = dist; best = e.weight; }
    });
    return bestDist <= 5 ? best : null;
}

// ─── גלריה ──────────────────────────────────────────────────────────────────
function _ppRenderGallery(index) {
    const gal = document.getElementById('pp-gallery');
    const head = document.getElementById('pp-gallery-head');
    if (!gal) return;
    if (!index.length) {
        if (head) head.style.display = 'none';
        gal.innerHTML =
            '<div class="pp-empty"><strong>פרוטוקול צילום — כך ההשוואה תהיה אמינה:</strong><br>' +
            '• בוקר, על קיבה ריקה, אחרי שירותים<br>' +
            '• אותו מקום, אותה תאורה, אותו מרחק מהמצלמה<br>' +
            '• עמידה זקופה מול המצלמה (חזית), ידיים בצדדים<br>' +
            '• אותו לבוש (או דומה) בכל צילום<br>' +
            'תמונה אחת ליום מספיקה — ההשוואות נעשות במרווחים של ~10 ימים ומעלה.</div>';
        return;
    }
    if (head) head.style.display = '';
    gal.innerHTML = '<div class="pp-gallery-grid">' + index.map(e =>
        `<div class="pp-cell" data-date="${e.date}" onclick="ppOpenViewer('${e.date}')">` +
        `<img data-th="${e.date}" alt="${e.date}">` +
        `<div class="pp-cell-date">${_ppCellDate(e.date)}</div>` +
        `<div class="pp-cell-badge ${e.driveId ? 'up' : 'wait'}">${e.driveId ? 'בענן' : 'ממתין'}</div>` +
        '</div>').join('') + '</div>';
    _ppLoadThumbsInto(index);
}

function _ppSetThumb(date, blob) {
    const img = document.querySelector(`#pp-gallery img[data-th="${date}"]`);
    if (img && blob) img.src = _ppUrl(blob);
}

// טעינת thumbnails: קודם כל המקומיים (מהיר), ואז חסרים מהדרייב — סדרתי,
// כדי לא להציף את הגשר (כל משיכה 1-3 שניות)
async function _ppLoadThumbsInto(index) {
    const missing = [];
    for (const e of index) {
        let blob = null;
        try { const rec = await _ppIdbGet('thumbs', e.date); blob = rec && rec.blob; } catch (err) {}
        if (blob) _ppSetThumb(e.date, blob);
        else missing.push(e.date);
    }
    for (const date of missing) {
        const blob = await ppGetThumbBlob(date).catch(() => null);
        if (blob) _ppSetThumb(date, blob);
    }
}

// עדכון badges אחרי העלאה מוצלחת (נקרא מתור ההעלאה) — בלי רינדור מלא
function _ppRefreshGalleryBadges() {
    StorageManager.getPhotoIndex().forEach(e => {
        if (!e.driveId) return;
        const badge = document.querySelector(`.pp-cell[data-date="${e.date}"] .pp-cell-badge`);
        if (badge && badge.classList.contains('wait')) {
            badge.classList.remove('wait'); badge.classList.add('up'); badge.textContent = 'בענן';
        }
    });
    if (typeof updatePhotoBridgeStatus === 'function') updatePhotoBridgeStatus();
}

// ─── תצוגה מלאה + מחיקה ─────────────────────────────────────────────────────
let _ppViewerDate = null, _ppViewerUrl = null;

async function ppOpenViewer(date) {
    const ov = document.getElementById('pp-viewer');
    if (!ov) return;
    _ppViewerDate = date;
    ov.style.display = 'flex';
    document.getElementById('pp-viewer-date').textContent = _ppListDate(date);
    const img = document.getElementById('pp-viewer-img');
    img.removeAttribute('src');
    // חיווי טעינה — משיכה מהדרייב יכולה לקחת כמה שניות
    const loading = document.getElementById('pp-viewer-loading');
    if (loading) loading.style.display = '';
    const blob = await ppGetPhotoBlob(date).catch(() => null);
    if (loading) loading.style.display = 'none';
    if (!blob) { if (_ppViewerDate === date) { ppCloseViewer(); showAlert('התמונה לא נמצאה מקומית ולא בדרייב.'); } return; }
    if (_ppViewerDate !== date) return;   // נסגר/הוחלף בזמן הטעינה
    if (_ppViewerUrl) { try { URL.revokeObjectURL(_ppViewerUrl); } catch (e) {} }
    _ppViewerUrl = URL.createObjectURL(blob);
    img.src = _ppViewerUrl;
}

function ppCloseViewer() {
    const ov = document.getElementById('pp-viewer');
    if (ov) ov.style.display = 'none';
    const loading = document.getElementById('pp-viewer-loading');
    if (loading) loading.style.display = 'none';
    if (_ppViewerUrl) { try { URL.revokeObjectURL(_ppViewerUrl); } catch (e) {} _ppViewerUrl = null; }
    _ppViewerDate = null;
}

function ppDeleteCurrent() {
    const date = _ppViewerDate;
    if (!date) return;
    showConfirm('למחוק את התמונה מ-' + _ppListDate(date) + '? היא תימחק גם מהדרייב.', async () => {
        await ppDeletePhoto(date);
        ppCloseViewer();
        _renderBodyPhotos();
        if (typeof showCloudToast === 'function') showCloudToast('🗑️ התמונה נמחקה', true);
    });
}

/* ════════ מסך צילום — Ghost Overlay, מתג מצלמה, טיימר ════════ */

let _ppCamActive = false;
let _ppCamStream = null;
let _ppCamFacing = 'user';        // ברירת מחדל: מצלמה קדמית (החלטת מוצר)
let _ppGhostOn = true;
let _ppGhostUrl = null;
let _ppTimerSec = 0;              // 0 / 3 / 10
let _ppCountdownTimer = null;
let _ppZoomLevels = [];           // רמות זום זמינות מהחומרה (ריק = אין תמיכה)
let _ppZoomIdx = 0;
let _ppFitContain = false;        // תצוגה: false=מסך מלא (cover), true=פריים מלא (contain)

function _ppCamMsg(txt) {
    const el = document.getElementById('pp-cam-msg');
    if (!el) return;
    el.textContent = txt || '';
    el.style.display = txt ? '' : 'none';
}

function _ppUpdateCamChips() {
    const g = document.getElementById('pp-ghost-btn');
    const f = document.getElementById('pp-face-btn');
    const t = document.getElementById('pp-timer-btn');
    const z = document.getElementById('pp-zoom-btn');
    const fit = document.getElementById('pp-fit-btn');
    if (g) { g.textContent = 'רפאים: ' + (_ppGhostOn ? 'פעיל' : 'כבוי'); g.classList.toggle('off', !_ppGhostOn); }
    if (f) f.textContent = 'מצלמה: ' + (_ppCamFacing === 'user' ? 'קדמית' : 'אחורית');
    if (t) { t.textContent = 'טיימר: ' + (_ppTimerSec ? _ppTimerSec + ' שנ\'' : 'כבוי'); t.classList.toggle('off', !_ppTimerSec); }
    if (z) {
        z.style.display = _ppZoomLevels.length > 1 ? '' : 'none';
        if (_ppZoomLevels.length) z.textContent = 'זום: ' + _ppZoomLevels[_ppZoomIdx] + 'x';
    }
    if (fit) fit.textContent = 'תצוגה: ' + (_ppFitContain ? 'מלאה' : 'מסך');
}

// ─── זום חומרה — רק אם ה-track חושף capability (iOS 17+/Android Chrome) ─────
// רמות מועמדות: מינימום החומרה (0.5x אולטרה-רחבה כשקיימת), 1x, 2x, 3x — בתחום הנתמך.
function _ppInitZoom() {
    _ppZoomLevels = []; _ppZoomIdx = 0;
    try {
        const track = _ppCamStream && _ppCamStream.getVideoTracks()[0];
        const caps = track && track.getCapabilities ? track.getCapabilities() : null;
        if (!caps || caps.zoom == null || caps.zoom.min == null) return;
        const { min, max } = caps.zoom;
        const cand = [min, 1, 2, 3].filter(v => v >= min && v <= max);
        _ppZoomLevels = [...new Set(cand.map(v => Math.round(v * 10) / 10))].sort((a, b) => a - b);
        if (_ppZoomLevels.length < 2) { _ppZoomLevels = []; return; }
        // ברירת מחדל: 1x אם קיים, אחרת הרמה הראשונה
        _ppZoomIdx = Math.max(0, _ppZoomLevels.indexOf(1));
        _ppApplyZoom();
    } catch (e) { _ppZoomLevels = []; }
}

function _ppApplyZoom() {
    try {
        const track = _ppCamStream && _ppCamStream.getVideoTracks()[0];
        if (track && _ppZoomLevels.length)
            track.applyConstraints({ advanced: [{ zoom: _ppZoomLevels[_ppZoomIdx] }] }).catch(() => {});
    } catch (e) { /* מכשיר בלי תמיכה */ }
}

function ppCycleZoom() {
    if (!_ppZoomLevels.length) return;
    _ppZoomIdx = (_ppZoomIdx + 1) % _ppZoomLevels.length;
    _ppApplyZoom();
    _ppUpdateCamChips();
    haptic('light');
}

// תצוגה מסך-מלא (cover, חותכת) ↔ פריים מלא (contain, עם פסים) — הלכידה זהה בשתיהן
function ppToggleFit() {
    _ppFitContain = !_ppFitContain;
    const ov = document.getElementById('pp-cam');
    if (ov) ov.classList.toggle('contain', _ppFitContain);
    _ppUpdateCamChips();
    haptic('light');
}

async function ppOpenCamera() {
    const ov = document.getElementById('pp-cam');
    if (!ov) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showAlert('המכשיר לא תומך בגישה למצלמה מהדפדפן.');
        return;
    }
    ov.style.display = 'flex';
    _ppCamActive = true;
    _ppCamMsg('');
    _ppUpdateCamChips();
    await _ppStartStream();
    _ppLoadGhost();
}

async function _ppStartStream() {
    _ppStopStream();
    const video = document.getElementById('pp-cam-video');
    const ov = document.getElementById('pp-cam');
    try {
        _ppCamStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: _ppCamFacing }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
    } catch (e) {
        _ppCamMsg('אין גישה למצלמה — אשר הרשאה ונסה שוב.');
        return;
    }
    if (!_ppCamActive) { _ppStopStream(); return; }   // נסגר בזמן בקשת ההרשאה
    video.srcObject = _ppCamStream;
    video.setAttribute('playsinline', '');
    await video.play().catch(() => {});
    // mirror בתצוגה במצלמה קדמית — גם הווידאו וגם ה-ghost (יישור פוזה טבעי)
    if (ov) {
        ov.classList.toggle('mirror', _ppCamFacing === 'user');
        ov.classList.toggle('contain', _ppFitContain);
    }
    _ppInitZoom();
    _ppUpdateCamChips();
}

function _ppStopStream() {
    if (_ppCamStream) {
        _ppCamStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
        _ppCamStream = null;
    }
}

// Ghost Overlay — התמונה האחרונה בשקיפות מעל הווידאו, ליישור פוזה זהה
async function _ppLoadGhost() {
    const img = document.getElementById('pp-ghost');
    if (!img) return;
    if (_ppGhostUrl) { try { URL.revokeObjectURL(_ppGhostUrl); } catch (e) {} _ppGhostUrl = null; }
    img.style.display = 'none';
    const index = _ppIndexDesc();
    if (!index.length || !_ppGhostOn) return;
    const blob = await ppGetPhotoBlob(index[0].date).catch(() => null);
    if (!blob || !_ppCamActive) return;
    _ppGhostUrl = URL.createObjectURL(blob);
    img.src = _ppGhostUrl;
    img.style.display = _ppGhostOn ? '' : 'none';
}

function ppToggleGhost() {
    _ppGhostOn = !_ppGhostOn;
    _ppUpdateCamChips();
    const img = document.getElementById('pp-ghost');
    if (!img) return;
    if (_ppGhostOn && !img.src) { _ppLoadGhost(); return; }
    img.style.display = (_ppGhostOn && img.src) ? '' : 'none';
}

function ppSwitchCamera() {
    _ppCamFacing = _ppCamFacing === 'user' ? 'environment' : 'user';
    _ppUpdateCamChips();
    _ppStartStream();
}

function ppCycleTimer() {
    _ppTimerSec = _ppTimerSec === 0 ? 3 : (_ppTimerSec === 3 ? 10 : 0);
    _ppUpdateCamChips();
    haptic('light');
}

function ppCapture() {
    if (_ppCountdownTimer) {   // לחיצה במהלך ספירה — ביטול הספירה
        clearInterval(_ppCountdownTimer); _ppCountdownTimer = null;
        const el = document.getElementById('pp-countdown');
        if (el) el.style.display = 'none';
        haptic('light');
        return;
    }
    if (_ppTimerSec > 0) _ppRunCountdown(_ppTimerSec, _ppDoCapture);
    else _ppDoCapture();
}

// פלאש לבן קצר ברגע הלכידה — פידבק מיידי שהצילום נקלט
function _ppFlash() {
    const el = document.getElementById('pp-flash');
    if (!el) return;
    el.classList.remove('on');
    void el.offsetWidth;   // restart של האנימציה
    el.classList.add('on');
}

function _ppRunCountdown(sec, done) {
    const el = document.getElementById('pp-countdown');
    if (!el) { done(); return; }
    let n = sec;
    el.textContent = n;
    el.style.display = 'flex';
    _ppCountdownTimer = setInterval(() => {
        if (!_ppCamActive) { clearInterval(_ppCountdownTimer); _ppCountdownTimer = null; el.style.display = 'none'; return; }
        n--;
        if (n <= 0) {
            clearInterval(_ppCountdownTimer); _ppCountdownTimer = null;
            el.style.display = 'none';
            done();
        } else {
            el.textContent = n;
            haptic('light');
        }
    }, 1000);
}

async function _ppDoCapture() {
    const video = document.getElementById('pp-cam-video');
    const vw = video && video.videoWidth, vh = video && video.videoHeight;
    if (!vw || !vh) { _ppCamMsg('המצלמה עוד לא מוכנה — נסה שוב.'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = vw; canvas.height = vh;
    canvas.getContext('2d').drawImage(video, 0, 0, vw, vh);
    const raw = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.95));
    if (!raw) { _ppCamMsg('הצילום נכשל — נסה שוב.'); return; }
    haptic('medium');
    _ppFlash();
    // נורמליזציית כיוון: פריים גולמי מ-getUserMedia אינו mirrored גם במצלמה
    // קדמית (ה-mirror הוא קונבנציית תצוגה בלבד, ב-CSS) — לכן קדמית ואחורית
    // כבר באותו כיוון ואסור להפוך בלכידה. יכולת ה-flip נשארת במכווץ למקרה עתידי.
    const today = _ppTodayStr();
    const exists = StorageManager.getPhotoIndex().some(e => e.date === today);
    const doSave = async () => {
        const btn = document.getElementById('pp-shoot-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'שומר...'; }
        try {
            await ppStorePhoto(raw, {});
            ppCloseCamera();
            if (typeof setBodyTab === 'function' && _blTab !== 'photos') setBodyTab('photos');
            _renderBodyPhotos();
            if (typeof showCloudToast === 'function') showCloudToast('📸 תמונת התקדמות נשמרה', true);
        } catch (e) {
            console.error('GymPro photos: store failed', e);
            _ppCamMsg('השמירה נכשלה: ' + (e && e.message ? e.message : 'שגיאה'));
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'צלם'; }
        }
    };
    if (exists) showConfirm('כבר צולמה תמונה היום — להחליף אותה?', doSave);
    else doSave();
}

function ppCloseCamera() {
    _ppCamActive = false;
    if (_ppCountdownTimer) { clearInterval(_ppCountdownTimer); _ppCountdownTimer = null; }
    const cd = document.getElementById('pp-countdown');
    if (cd) cd.style.display = 'none';
    _ppStopStream();
    const video = document.getElementById('pp-cam-video');
    if (video) { try { video.pause(); } catch (e) {} video.srcObject = null; }
    const ghost = document.getElementById('pp-ghost');
    if (ghost) { ghost.removeAttribute('src'); ghost.style.display = 'none'; }
    if (_ppGhostUrl) { try { URL.revokeObjectURL(_ppGhostUrl); } catch (e) {} _ppGhostUrl = null; }
    const ov = document.getElementById('pp-cam');
    if (ov) ov.style.display = 'none';
}

function ppAnalyzeNow() { _ppRunAnalysis(true); }

/* ════════ מנוע ניתוח AI משורשר (Gemini Vision) ════════
 * עקרונות (החלטות מוצר — לא רק פרומפט):
 * - אין השוואה במרווח < 10 ימים (רעש: מים/פמפ/תאורה) — נאכף בקוד.
 * - שער "בר-השוואה" לפני ניתוח; מתחת ל-5 — אין השוואה, רק פידבק צילום.
 * - עיגון בנתוני משקל (despiked) ותזונה מהאפליקציה; אנטי-הזיה; אין מדידות
 *   מספריות מתמונה (אחוז שומן/היקפים).
 * - הזיכרון = KEY_PHOTO_TREND: entries (עד 30) + aiNotes מצטבר, רוכב על config. */

const _PP_MIN_COMPARE_DAYS = 10;
const _PP_TREND_MAX_ENTRIES = 30;
let _ppAnalysisBusy = false;
let _ppAutoTriedAt = 0;   // הגנת סשן — לא לחזור על ניסיון אוטומטי שנכשל בכל רינדור

// משקל מוחלק לתאריך: סדרת המשקל אחרי despike, הנקודה הקרובה ביותר (±5 ימים)
function _ppSmoothedWeightAt(date) {
    const log = (StorageManager.getBodyLog() || [])
        .filter(e => e && e.date && e.weight != null)
        .sort((a, b) => a.date < b.date ? -1 : 1);
    if (!log.length) return null;
    const ts = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
    let pts = log.map(e => ({ t: ts(e.date), v: e.weight, date: e.date }));
    if (typeof _despikeWeight === 'function') pts = _despikeWeight(pts);
    let best = null, bestDist = Infinity;
    pts.forEach(p => {
        const d = Math.abs(_ppDaysBetween(p.date, date));
        if (d < bestDist) { bestDist = d; best = p.v; }
    });
    return bestDist <= 5 ? Math.round(best * 10) / 10 : null;
}

// ממוצע קלוריות/חלבון בתקופה (ימים עם נתונים בלבד)
function _ppNutritionAvg(fromDate, toDate) {
    const days = (StorageManager.getNutritionDaily() || [])
        .filter(d => d && d.date && d.date >= fromDate && d.date <= toDate && (Number(d.calories) || 0) > 0);
    if (!days.length) return null;
    const avg = k => Math.round(days.reduce((s, d) => s + (Number(d[k]) || 0), 0) / days.length);
    return { kcal: avg('calories'), protein: avg('protein'), count: days.length };
}

// בחירת סט התמונות: נוכחית, השוואה (האחרונה במרחק ≥10 ימים; אחרת הישנה ביותר),
// עוגן (התמונה הראשונה אי-פעם — אם שונה משתי האחרות)
function _ppPickAnalysisSet() {
    const index = _ppIndexDesc();
    if (index.length < 2) return null;
    const current = index[0].date;
    let vs = null;
    for (const e of index.slice(1)) {
        if (_ppDaysBetween(e.date, current) >= _PP_MIN_COMPARE_DAYS) { vs = e.date; break; }
    }
    const oldest = index[index.length - 1].date;
    if (!vs) vs = oldest;
    const trend = StorageManager.getPhotoTrend() || {};
    let baseline = (trend.baselineDate && index.some(e => e.date === trend.baselineDate)) ? trend.baselineDate : oldest;
    if (baseline === current || baseline === vs) baseline = null;
    return { current, vs, baseline };
}

async function _ppPhotoBase64(date) {
    const blob = await ppGetPhotoBlob(date);
    if (!blob) throw new Error('אין גישה לתמונה מ-' + _ppListDate(date) + ' (לא מקומית ולא בדרייב)');
    return _ppBlobToBase64(blob);
}

function _ppBuildAnalysisPrompt(ctx) {
    const line = (lbl, v) => v != null ? lbl + ': ' + v + '\n' : '';
    let p =
        'אתה אנליסט הרכב גוף שמרן וזהיר. משימתך: להשוות תמונות התקדמות (חזית) של מתאמן.\n' +
        'עיקרון-על: שינוי גוף אמיתי בין תמונות במרווח ימים-שבועות הוא לרוב קטן או בלתי נראה.\n' +
        'ברירת המחדל שלך היא "אין שינוי ניכר". אסור לדווח שינוי בלי ראיה ויזואלית קונקרטית\n' +
        'שאתה יכול לתאר (קו מתאר, צל, יחס רוחב). אל תנסה לרצות.\n\n' +
        'קלט:\n' +
        '- תמונה 1 (נוכחית): ' + ctx.current + (ctx.wNow != null ? ', משקל מוחלק ' + ctx.wNow + ' ק"ג' : ', אין נתון משקל') + '\n' +
        '- תמונה 2 (השוואה): ' + ctx.vs + (ctx.wPrev != null ? ', משקל מוחלק ' + ctx.wPrev + ' ק"ג' : ', אין נתון משקל') + '\n' +
        (ctx.baseline ? '- תמונה 3 (עוגן — התמונה הראשונה): ' + ctx.baseline + '\n' : '') +
        line('- דלתא משקל', ctx.delta != null ? ctx.delta + ' ק"ג ב-' + ctx.days + ' ימים' : null) +
        (ctx.nut ? '- ממוצע בתקופה: ' + ctx.nut.kcal + ' קלוריות, ' + ctx.nut.protein + 'g חלבון (' + ctx.nut.count + ' ימי נתונים)\n' : '') +
        (ctx.aiNotes ? '- מצב מצטבר קודם: ' + ctx.aiNotes + '\n' : '') +
        (ctx.recent.length ? '- ניתוחים אחרונים: ' + JSON.stringify(ctx.recent) + '\n' : '') +
        '\nשלבים (בסדר הזה):\n' +
        '1. בר-השוואה (0-10): תאורה, זווית, מרחק, פוזה, לבוש. מתחת ל-5 — עצור, החזר\n' +
        '   comparability בלבד + flags עם מה לתקן בצילום הבא. אל תשווה.\n' +
        '2. השוואה אזורית (כתפיים/חזה/מותן-בטן/זרועות) נוכחית-מול-השוואה: לכל אזור החזר\n' +
        '   מחרוזת שמתחילה ב-none/subtle/clear ואחריה נימוק ויזואלי של משפט. ספק = none.\n' +
        '3. הצלבה עם הנתונים: האם הנראה עקבי עם דלתת המשקל והתזונה? ציין סתירות.\n' +
        '4. מול העוגן (אם סופק): משפט אחד על המגמה הכוללת.\n' +
        '5. עדכן את המצב המצטבר (aiNotes): עד 120 מילים, עובדתי, בעברית, כולל מה שנותר יציב.\n\n' +
        'אסור: להמציא מספרים (אחוז שומן/היקפים), לדווח שינוי בגלל תאורה/פוזה, להשתמש\n' +
        'בשפה מחמיאה ריקה.\n' +
        'החזר JSON בלבד:\n' +
        '{ "comparability": 0-10, "flags": ["..."], "verdict": "none|subtle|clear",\n' +
        '  "regions": {"shoulders": "...", "chest": "...", "waist": "...", "arms": "..."},\n' +
        '  "dataConsistency": "...", "vsBaseline": "...", "summary": "2-3 משפטים בעברית",\n' +
        '  "aiNotes": "המצב המצטבר המעודכן" }';
    return p;
}

// הרצת ניתוח. manual=true — עם הודעות למשתמש; false — שקט (טריגר שבועי)
async function _ppRunAnalysis(manual) {
    if (_ppAnalysisBusy) return;
    const fail = msg => { if (manual) showAlert(msg); };
    if (typeof _geminiRequest !== 'function') { fail('מנוע ה-AI לא זמין.'); return; }
    if (!StorageManager.getAIConfig().apiKey) { fail('דרוש מפתח Gemini — הגדרות ← AI.'); return; }
    const set = _ppPickAnalysisSet();
    if (!set) { fail('דרושות לפחות 2 תמונות לניתוח.'); return; }
    const days = _ppDaysBetween(set.vs, set.current);
    if (days < _PP_MIN_COMPARE_DAYS) {
        fail('המרווח בין התמונות קטן מדי (' + days + ' ימים). השוואה אמינה דורשת ' +
            _PP_MIN_COMPARE_DAYS + '+ ימים — המשך לצלם, הניתוח יהיה זמין בהמשך.');
        return;
    }

    _ppAnalysisBusy = true;
    const btn = document.getElementById('pp-analyze-btn');
    const btnTxt = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'מנתח…'; }
    try {
        const trend = StorageManager.getPhotoTrend() || {};
        const wNow = _ppSmoothedWeightAt(set.current);
        const wPrev = _ppSmoothedWeightAt(set.vs);
        const ctx = {
            current: set.current, vs: set.vs, baseline: set.baseline,
            wNow, wPrev,
            delta: (wNow != null && wPrev != null) ? Math.round((wNow - wPrev) * 10) / 10 : null,
            days,
            nut: _ppNutritionAvg(set.vs, set.current),
            aiNotes: trend.aiNotes || '',
            recent: (trend.entries || []).slice(-5)
        };
        // סדר ה-parts = סדר ההתייחסות בפרומפט: נוכחית, השוואה, עוגן
        const parts = [{ text: _ppBuildAnalysisPrompt(ctx) }];
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: await _ppPhotoBase64(set.current) } });
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: await _ppPhotoBase64(set.vs) } });
        if (set.baseline) parts.push({ inlineData: { mimeType: 'image/jpeg', data: await _ppPhotoBase64(set.baseline) } });

        const res = await _geminiRequest({
            contents: [{ role: 'user', parts }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1200, responseMimeType: 'application/json' }
        }, { json: true, timeoutMs: 60000 });

        // ולידציה + נרמול — אל תסמוך על המודל
        const comparability = Math.max(0, Math.min(10, Math.round(Number(res.comparability) || 0)));
        const entry = {
            date: set.current,
            vsDate: set.vs,
            comparability,
            verdict: ['none', 'subtle', 'clear'].includes(res.verdict) ? res.verdict : 'none',
            regions: (res.regions && typeof res.regions === 'object') ? res.regions : {},
            summary: String(res.summary || ''),
            flags: Array.isArray(res.flags) ? res.flags.map(String).slice(0, 6) : []
        };
        const index = _ppIndexDesc();
        const updated = {
            baselineDate: trend.baselineDate && index.some(e => e.date === trend.baselineDate)
                ? trend.baselineDate
                : (index.length ? index[index.length - 1].date : set.vs),
            baselineDesc: trend.baselineDesc || '',
            lastAnalyzedDate: set.current,
            lastAutoRun: _ppTodayStr(),
            entries: ((trend.entries || []).filter(e => !(e.date === entry.date && e.vsDate === entry.vsDate)))
                .concat([entry])
                .slice(-_PP_TREND_MAX_ENTRIES),
            aiNotes: comparability >= 5 && res.aiNotes ? String(res.aiNotes) : (trend.aiNotes || '')
        };
        StorageManager.savePhotoTrend(updated);
        _ppSyncConfigSoon();
        _ppRenderAnalysisCard();
        if (manual) haptic('medium');
        if (typeof showCloudToast === 'function')
            showCloudToast(comparability >= 5 ? '🧠 ניתוח תמונות הושלם' : '🧠 הניתוח דילג — איכות צילום נמוכה', comparability >= 5);
    } catch (e) {
        console.warn('GymPro photos: analysis failed', e);
        fail('הניתוח נכשל: ' + (e && e.message === 'ALL_MODELS_FAILED' ? 'כל המודלים נכשלו — נסה שוב מאוחר יותר' : (e && e.message) || 'שגיאה'));
    } finally {
        _ppAnalysisBusy = false;
        if (btn) { btn.textContent = btnTxt; btn.disabled = false; }
        if (typeof _renderBodyPhotos === 'function' && manual) _renderBodyPhotos();
    }
}

// ─── טריגר שבועי שקט — בכניסה לטאב (נקרא מ-_renderBodyPhotos) ───────────────
function _ppMaybeAutoAnalyze() {
    try {
        if (_ppAnalysisBusy) return;
        if (Date.now() - _ppAutoTriedAt < 10 * 60000) return;   // ניסיון אחד ל-10 דק' בסשן
        const trend = StorageManager.getPhotoTrend() || {};
        const today = _ppTodayStr();
        if (trend.lastAutoRun && _ppDaysBetween(trend.lastAutoRun, today) < 7) return;
        const index = _ppIndexDesc();
        if (index.length < 2) return;
        if (trend.lastAnalyzedDate && index[0].date <= trend.lastAnalyzedDate) return;   // אין תמונה חדשה
        if (!StorageManager.getAIConfig().apiKey) return;
        _ppAutoTriedAt = Date.now();
        _ppRunAnalysis(false);
    } catch (e) { /* טריגר רקע — שקט */ }
}
