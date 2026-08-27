/**
 * voice-logic.js — תיעוד סטים בקול (Voice Set Logging) · מסך Live בלבד
 *
 * זרימה: לחיצה ארוכה על כפתור "דבר" → הקלטה → WAV 16k מונו → תמלול ב-Gemini
 * → פרסינג מקומי (regex, ללא קריאת API שנייה) → מילוי הפיקרים → ספירה לאחור
 * של 3 שניות → רישום אוטומטי דרך nextStep().
 *
 * עקרון: "אישור באי-עשייה" — הידיים תפוסות באימון, ולכן המשתמש לא מאשר
 * אלא רק *עוצר* (נגיעה במסך) אם המערכת טעתה.
 *
 * הערת אוזניות Bluetooth: פתיחת מיקרופון מעבירה AirPods מ-A2DP ל-HFP והמוזיקה
 * צונחת לאיכות שיחה. לכן ה-stream נפתח בלחיצה ונסגר מיד בשחרור — בליפ של
 * שתי שניות במקום מצב שיחה לאורך כל האימון. אין להחזיק stream "חם".
 */

// ─── קבועים ────────────────────────────────────────────────────────────────
const VC_MIN_MS       = 350;    // מתחת לזה = נגיעה בטעות, לא אמירה
const VC_MAX_MS       = 8000;   // עצירה אוטומטית — אמירת סט לא אורכת יותר
const VC_COUNTDOWN_MS = 3000;   // חלון הביטול לפני רישום אוטומטי
const VC_SR           = 16000;  // קצב דגימה לשליחה (דיבור — יותר מזה מבזבז)
const VC_RING_LEN     = 182;    // 2πr, r=29 (טבעת הספירה לאחור)

// ─── state ─────────────────────────────────────────────────────────────────
let _vcState    = 'idle';   // idle | rec | busy | pending
let _vcStream   = null;
let _vcRec      = null;
let _vcChunks   = [];
let _vcStartTs  = 0;
let _vcHold     = false;    // האצבע עדיין לחוצה (getUserMedia אסינכרוני)
let _vcCtx      = null;
let _vcAnalyser = null;
let _vcSrcNode  = null;
let _vcRaf      = 0;
let _vcMaxTimer = 0;
let _vcCountTimer = 0;
let _vcStatusTimer = 0;

// ─── זמינות ────────────────────────────────────────────────────────────────
// אותו כלל כמו במזון: אין מפתח או אין רשת → הכפתור נעלם, לא נכשל.
function _vcAvailable() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    if (typeof MediaRecorder === 'undefined') return false;
    if (typeof StorageManager === 'undefined' || typeof StorageManager.getAIConfig !== 'function') return false;
    if (!StorageManager.getAIConfig().apiKey) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    return true;
}

// נקרא מ-updateLiveViewContent בכל רענון של מסך ה-Live
function vcSyncMicBtn() {
    const btn = document.getElementById('vc-mic-btn');
    if (!btn) return;
    const show = _vcAvailable();
    btn.style.display = show ? 'flex' : 'none';
    if (!show && _vcState !== 'idle') _vcReset();
}

// ─── UI helpers ────────────────────────────────────────────────────────────
function _vcTxt(s) { const el = document.getElementById('vc-mic-txt'); if (el) el.textContent = s; }

function _vcStatus(msg, autoHideMs) {
    const el = document.getElementById('vc-status');
    if (!el) return;
    clearTimeout(_vcStatusTimer);
    el.textContent = msg || '';
    el.classList.toggle('is-on', !!msg);
    if (msg && autoHideMs) _vcStatusTimer = setTimeout(() => _vcStatus(''), autoHideMs);
}

function _vcSetState(s) {
    _vcState = s;
    const btn = document.getElementById('vc-mic-btn');
    if (btn) btn.dataset.state = s;
    if (s === 'idle')      _vcTxt('דבר');
    else if (s === 'rec')  _vcTxt('מדבר');
    else if (s === 'busy') _vcTxt('מתמלל');
}

// הכרטיס השקוף שתופס את נגיעת הביטול — בלי זה הנגיעה הייתה נופלת על
// כרטיס ההחלקה ורושמת סט בטעות
function _vcCatcher(on) {
    const el = document.getElementById('vc-catch');
    if (el) el.style.display = on ? 'block' : 'none';
}

function _vcRingReset() {
    const bar = document.getElementById('vc-ring-bar');
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.strokeDashoffset = VC_RING_LEN;
    void bar.getBoundingClientRect();
}

function _vcRingRun() {
    const bar = document.getElementById('vc-ring-bar');
    if (!bar) return;
    _vcRingReset();
    bar.style.transition = `stroke-dashoffset ${VC_COUNTDOWN_MS}ms linear`;
    bar.style.strokeDashoffset = 0;
}

// ─── אודיו ─────────────────────────────────────────────────────────────────
function _vcAudioCtx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!_vcCtx || _vcCtx.state === 'closed') _vcCtx = new AC();
    if (_vcCtx.state === 'suspended') _vcCtx.resume().catch(() => {});
    return _vcCtx;
}

// Gemini מקבל wav בוודאות; מה שהדפדפן מקליט (webm/opus או mp4/aac) — לא תמיד.
// לכן מקליטים במה שיש, ומקודדים מחדש ל-WAV 16k מונו לפני השליחה.
function _vcPickMime() {
    const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    for (const m of cands) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} }
    return '';
}

function _vcDecode(ctx, arrayBuffer) {
    return new Promise((resolve, reject) => {
        // Safari ישן תומך רק בחתימת ה-callback
        const p = ctx.decodeAudioData(arrayBuffer, resolve, reject);
        if (p && typeof p.then === 'function') p.then(resolve).catch(reject);
    });
}

function _vcResampleMono(buf, targetRate) {
    const chs = buf.numberOfChannels;
    const src = buf.getChannelData(0);
    let mono = src;
    if (chs > 1) {
        mono = new Float32Array(src.length);
        for (let c = 0; c < chs; c++) {
            const d = buf.getChannelData(c);
            for (let i = 0; i < src.length; i++) mono[i] += d[i] / chs;
        }
    }
    const ratio = buf.sampleRate / targetRate;
    if (ratio <= 1.001) return mono;
    const outLen = Math.floor(mono.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
        const pos = i * ratio;
        const i0 = Math.floor(pos);
        const i1 = Math.min(i0 + 1, mono.length - 1);
        const f = pos - i0;
        out[i] = mono[i0] * (1 - f) + mono[i1] * f;
    }
    return out;
}

function _vcEncodeWav(samples, rate) {
    const ab = new ArrayBuffer(44 + samples.length * 2);
    const v = new DataView(ab);
    const wr = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    wr(0, 'RIFF');
    v.setUint32(4, 36 + samples.length * 2, true);
    wr(8, 'WAVEfmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);          // PCM
    v.setUint16(22, 1, true);          // mono
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true);   // byte rate
    v.setUint16(32, 2, true);          // block align
    v.setUint16(34, 16, true);         // bits
    wr(36, 'data');
    v.setUint32(40, samples.length * 2, true);
    let off = 44;
    for (let i = 0; i < samples.length; i++, off += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return ab;
}

function _vcAbToBase64(ab) {
    const bytes = new Uint8Array(ab);
    let bin = '';
    const CH = 0x8000;   // חלוקה לצ'אנקים — apply על מערך ענק מפוצץ את ה-stack
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
}

async function _vcBlobToWavB64(blob) {
    const ctx = _vcAudioCtx();
    if (!ctx) throw new Error('NO_AUDIO_CTX');
    const decoded = await _vcDecode(ctx, await blob.arrayBuffer());
    return _vcAbToBase64(_vcEncodeWav(_vcResampleMono(decoded, VC_SR), VC_SR));
}

// טבעת הפעימה לפי עוצמת הקול — חיווי ויזואלי שהוא באמת שומע (המוזיקה
// באוזניות מונעת חיווי קולי, וההפטיקה שמורה לאירועים)
function _vcMeterStart(stream) {
    const ctx = _vcAudioCtx();
    if (!ctx) return;
    try {
        _vcSrcNode = ctx.createMediaStreamSource(stream);
        _vcAnalyser = ctx.createAnalyser();
        _vcAnalyser.fftSize = 256;
        _vcSrcNode.connect(_vcAnalyser);
        const data = new Uint8Array(_vcAnalyser.frequencyBinCount);
        const btn = document.getElementById('vc-mic-btn');
        const tick = () => {
            if (!_vcAnalyser) return;
            _vcAnalyser.getByteTimeDomainData(data);
            let peak = 0;
            for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128));
            if (btn) btn.style.setProperty('--vc-amp', Math.min(1, peak / 60).toFixed(2));
            _vcRaf = requestAnimationFrame(tick);
        };
        tick();
    } catch (e) {}
}

function _vcMeterStop() {
    cancelAnimationFrame(_vcRaf); _vcRaf = 0;
    try { if (_vcSrcNode) _vcSrcNode.disconnect(); } catch (e) {}
    _vcSrcNode = null; _vcAnalyser = null;
    const btn = document.getElementById('vc-mic-btn');
    if (btn) btn.style.setProperty('--vc-amp', '0');
}

function _vcStopStream() {
    if (_vcStream) { try { _vcStream.getTracks().forEach(t => t.stop()); } catch (e) {} }
    _vcStream = null;
}

// ─── מספרים בעברית → ספרות ─────────────────────────────────────────────────
const VC_NUM_WORDS = {
    'אפס': 0, 'אחד': 1, 'אחת': 1, 'שתיים': 2, 'שניים': 2, 'שתי': 2, 'שני': 2,
    'שלוש': 3, 'שלושה': 3, 'ארבע': 4, 'ארבעה': 4, 'חמש': 5, 'חמישה': 5,
    'שש': 6, 'שישה': 6, 'שבע': 7, 'שבעה': 7, 'שמונה': 8, 'תשע': 9, 'תשעה': 9,
    'עשר': 10, 'עשרה': 10, 'עשרים': 20, 'שלושים': 30, 'ארבעים': 40, 'חמישים': 50,
    'שישים': 60, 'ששים': 60, 'שבעים': 70, 'שמונים': 80, 'תשעים': 90,
    'מאה': 100, 'מאתיים': 200
};

function _vcNormalize(text) {
    let t = (text || '').toLowerCase();
    t = t.replace(/[֑-ׇ]/g, '');        // ניקוד/טעמים
    // פסיק נשמר כאסימון מפריד — "חמישה, עשר" אינו "חמישה עשר" (15)
    t = t.replace(/[,;]/g, ' | ');
    t = t.replace(/[!?:"'׳״־\-–]/g, ' ');
    t = t.replace(/\.(?!\d)/g, ' ');              // נקודה שאינה עשרונית
    return t.replace(/\s+/g, ' ').trim();
}

// "שמונים ושתיים וחצי" → "82.5" · "מאה עשרים וחמש" → "125"
function _vcWordsToDigits(txt) {
    const tokens = txt.split(' ');
    const out = [];
    let acc = null;
    const flush = () => { if (acc !== null) { out.push(String(acc)); acc = null; } };
    for (const orig of tokens) {
        // "ושתיים" → "שתיים" (רק כשהצורה המקוצרת מוכרת — לא לפגוע במילים אחרות)
        let t = orig;
        if (t.length > 1 && t[0] === 'ו' && (VC_NUM_WORDS[t.slice(1)] !== undefined || t.slice(1) === 'חצי' || t.slice(1) === 'מאות')) t = t.slice(1);
        if (t === '|') { flush(); continue; }        // מפריד — עוצר צירוף מספרים
        if (t === 'חצי' && acc !== null) { acc += 0.5; continue; }
        if (t === 'מאות' && acc !== null && acc < 10) { acc *= 100; continue; }
        const v = VC_NUM_WORDS[t];
        if (v === undefined) { flush(); out.push(orig); continue; }
        if (acc === null) acc = v;
        else if (v === 10 && acc < 10) acc += 10;        // שמונה עשרה
        else if (acc >= 20 && v < 10) acc += v;          // שמונים ושתיים
        else if (acc >= 100 && v < 100) acc += v;        // מאה עשרים
        else { flush(); acc = v; }
    }
    flush();
    return out.join(' ');
}

// ─── פרסינג הפקודה ─────────────────────────────────────────────────────────
// ctx: { weight, reps, rir, mode } — הערכים הנוכחיים בפיקרים (יעד הסט)
function vcParseSetCommand(text, ctx) {
    const res = { ok: false, weight: null, reps: null, rir: null, same: false, raw: text || '' };
    const t = _vcWordsToDigits(_vcNormalize(text));
    res.norm = t;
    if (!t) return res;

    if (/(אותו דבר|אותו הדבר|כמו קודם|כמו הסט הקודם|כמו לפני|שוב אותו|בדיוק כמו)/.test(t)) {
        res.same = true; res.ok = true; return res;
    }

    let body = ' ' + t + ' ';

    // RIR — נחלץ ראשון ומנוטרל מהגוף, אחרת המספר שלו ייחטף כחזרות
    let m = body.match(/(?:rir|ריר|רי אי אר)\s*(?:של\s*)?(\d+(?:\.\d+)?)/);
    if (m) { res.rir = parseFloat(m[1]); body = body.replace(m[0], ' '); }
    else if (/(עד כשל|כשל|נכשלתי|fail)/.test(body)) { res.rir = 0; body = body.replace(/עד כשל|כשל|נכשלתי|fail/g, ' '); }

    // משקל יחסי לסט הנוכחי
    const cw = (ctx && typeof ctx.weight === 'number' && !isNaN(ctx.weight)) ? ctx.weight : null;
    m = body.match(/(?:פלוס|ועוד|תוסיף|להוסיף|העליתי)\s*(\d+(?:\.\d+)?)/);
    if (m && cw !== null) { res.weight = cw + parseFloat(m[1]); body = body.replace(m[0], ' '); }
    if (res.weight === null) {
        m = body.match(/(?:מינוס|תוריד|להוריד|הורדתי|פחות)\s*(\d+(?:\.\d+)?)/);
        if (m && cw !== null) { res.weight = cw - parseFloat(m[1]); body = body.replace(m[0], ' '); }
    }

    // יחידות מפורשות
    if (res.weight === null) {
        m = body.match(/(\d+(?:\.\d+)?)\s*(?:קילוגרם|קילו|קג|ק"ג|kg|kilo)/);
        if (m) { res.weight = parseFloat(m[1]); body = body.replace(m[0], ' '); }
    }
    m = body.match(/(\d+(?:\.\d+)?)\s*(?:חזרות|חזרה|פעמים|reps|rep)/);
    if (m) { res.reps = parseFloat(m[1]); body = body.replace(m[0], ' '); }

    // "80 על 8" / "80 כפול 8" / "80 ל 8"
    if (res.weight === null || res.reps === null) {
        m = body.match(/(\d+(?:\.\d+)?)\s*(?:על|כפול|ל|x|×)\s*(\d+(?:\.\d+)?)/);
        if (m) {
            if (res.weight === null) res.weight = parseFloat(m[1]);
            if (res.reps === null)   res.reps   = parseFloat(m[2]);
            body = body.replace(m[0], ' ');
        }
    }

    // מספרים חשופים — הראשון משקל, השני חזרות
    const bare = (body.match(/\d+(?:\.\d+)?/g) || []).map(parseFloat);
    if (res.weight === null && res.reps === null && bare.length >= 2) { res.weight = bare[0]; res.reps = bare[1]; }
    else if (res.reps === null && res.weight !== null && bare.length >= 1) res.reps = bare[0];
    else if (res.weight === null && res.reps !== null && bare.length >= 1) res.weight = bare[0];

    if (ctx && ctx.mode === 'bw') res.weight = null;   // משקל גוף — אין ערך משקל
    res.ok = (res.weight !== null || res.reps !== null);
    return res;
}

// שער שפיות — עדיף תיקון של שנייה מאשר סט זבל בארכיון שיזהם את
// חישובי ה-Progressive Overload
function _vcSuspect(p, ctx) {
    const bad = [];
    if (p.weight !== null) {
        if (ctx.mode === 'plates') {
            if (p.weight < 1 || p.weight > 25 || Math.abs(p.weight - Math.round(p.weight)) > 0.01) bad.push('weight');
        } else if (p.weight < 0 || p.weight > 400) bad.push('weight');
        if (ctx.weight > 0 && Math.abs(p.weight - ctx.weight) > 5 &&
            Math.abs(p.weight - ctx.weight) / ctx.weight > 0.35) bad.push('weight');
    }
    if (p.reps !== null && (p.reps < 1 || p.reps > 30 || p.reps % 1 !== 0)) bad.push('reps');
    if (p.rir  !== null && (p.rir  < 0 || p.rir  > 6  || p.rir  % 1 !== 0)) bad.push('rir');
    return bad.filter((f, i) => bad.indexOf(f) === i);   // שדה חשוד נספר פעם אחת
}

function _vcPickerCtx() {
    const num = (id) => {
        const el = document.getElementById(id);
        const v = el ? parseFloat(el.value) : NaN;
        return isNaN(v) ? null : v;
    };
    return {
        weight: num('weight-picker'),
        reps:   num('reps-picker'),
        rir:    num('rir-picker'),
        mode:   (typeof _effWeightMode === 'function') ? _effWeightMode() : 'kg'
    };
}

function _vcApply(p, ctx, skip) {
    if (p.weight !== null && ctx.mode !== 'bw' && skip.indexOf('weight') === -1) commitCustomValue('weight', p.weight);
    if (p.reps   !== null && skip.indexOf('reps')   === -1) commitCustomValue('reps', p.reps);
    if (p.rir    !== null && skip.indexOf('rir')    === -1) commitCustomValue('rir', p.rir);
    if (typeof _syncLiveEditSheetDisplays === 'function') _syncLiveEditSheetDisplays();
    if (typeof updateLiveViewContent === 'function') updateLiveViewContent();
}

// ─── מכונת המצבים ──────────────────────────────────────────────────────────
function _vcReset() {
    clearTimeout(_vcMaxTimer); _vcMaxTimer = 0;
    clearTimeout(_vcCountTimer); _vcCountTimer = 0;
    _vcHold = false;
    _vcMeterStop();
    _vcStopStream();
    _vcRec = null; _vcChunks = [];
    _vcCatcher(false);
    _vcRingReset();
    const c = document.getElementById('vc-mic-count');
    if (c) c.textContent = '';
    _vcSetState('idle');
}

async function vcMicDown(e) {
    if (e && e.cancelable) e.preventDefault();
    if (!_vcAvailable()) return;
    if (_vcState === 'pending') { _vcCancelPending(false); }   // לחיצה חוזרת = אמירה חדשה
    if (_vcState === 'rec' || _vcState === 'busy') return;

    _vcHold = true;
    // לכידת המצביע — אצבע שמחליקה מעט מהכפתור לא עוצרת את ההקלטה באמצע אמירה
    try { if (e && e.pointerId != null && e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId); } catch (err) {}
    _vcSetState('rec');
    _vcStatus('');
    haptic('light');

    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
    } catch (err) {
        _vcReset();
        _vcStatus(err && err.name === 'NotAllowedError' ? 'אין הרשאת מיקרופון' : 'המיקרופון לא זמין', 2600);
        return;
    }
    // האצבע שוחררה לפני שההרשאה חזרה — סוגרים מיד ולא מקליטים
    if (!_vcHold) { try { stream.getTracks().forEach(t => t.stop()); } catch (e2) {} _vcReset(); return; }

    _vcStream = stream;
    _vcMeterStart(stream);
    const mime = _vcPickMime();
    try {
        _vcRec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (err) {
        _vcReset(); _vcStatus('ההקלטה לא נתמכת בדפדפן', 2600); return;
    }
    _vcChunks = [];
    _vcRec.ondataavailable = (ev) => { if (ev.data && ev.data.size) _vcChunks.push(ev.data); };
    _vcRec.onstop = _vcOnStop;
    _vcStartTs = Date.now();
    _vcRec.start();
    _vcMaxTimer = setTimeout(() => { if (_vcState === 'rec') vcMicUp(); }, VC_MAX_MS);
}

function vcMicUp(e) {
    if (e && e.cancelable) e.preventDefault();
    _vcHold = false;
    clearTimeout(_vcMaxTimer); _vcMaxTimer = 0;
    if (_vcState !== 'rec') return;
    if (!_vcRec || _vcRec.state === 'inactive') { _vcReset(); return; }
    if (Date.now() - _vcStartTs < VC_MIN_MS) {
        try { _vcRec.stop(); } catch (err) {}
        _vcReset();
        _vcStatus('לחץ והחזק כדי לדבר', 2200);
        return;
    }
    _vcSetState('busy');
    haptic('light');
    try { _vcRec.stop(); } catch (err) { _vcReset(); }
}

async function _vcOnStop() {
    _vcMeterStop();
    const chunks = _vcChunks.slice();
    _vcChunks = [];
    const type = (_vcRec && _vcRec.mimeType) || 'audio/webm';
    _vcRec = null;
    _vcStopStream();          // סוגרים את המיקרופון מיד — המוזיקה חוזרת לסטריאו
    if (_vcState !== 'busy') return;

    try {
        const blob = new Blob(chunks, { type });
        if (!blob.size) throw new Error('EMPTY_AUDIO');
        const b64 = await _vcBlobToWavB64(blob);
        const text = await _geminiTranscribe(b64, 'audio/wav', { timeoutMs: 20000 });
        _vcHandleText(text);
    } catch (err) {
        _vcReset();
        const msg = (err && err.message) || '';
        _vcStatus(msg === 'API_KEY_MISSING' ? 'חסר מפתח Gemini' :
                  msg === 'ALL_MODELS_FAILED' ? 'התמלול נכשל — נסה שוב' : 'התמלול נכשל — נסה שוב', 2800);
    }
}

function _vcHandleText(text) {
    if (_vcState !== 'busy') return;   // יצאנו מ-Live / אופס בזמן ההמתנה לתשובה
    const clean = (text || '').trim();
    if (!clean) { _vcReset(); _vcStatus('לא שמעתי כלום', 2400); return; }

    const ctx = _vcPickerCtx();
    const p = vcParseSetCommand(clean, ctx);
    const bad = p.ok ? _vcSuspect(p, ctx) : [];

    // לא הובן בכלל, או שכל מה שהובן חשוד — לא נוגעים בערכים, פותחים לתיקון
    if (!p.ok || (bad.length && bad.length >= [p.weight, p.reps, p.rir].filter(v => v !== null).length)) {
        _vcReset();
        haptic('warning');
        _vcOpenSheetWithHeard(clean, p.ok ? 'ערך חשוד — בדוק לפני רישום' : 'לא הצלחתי לפענח');
        return;
    }

    if (!p.same) _vcApply(p, ctx, bad);

    if (bad.length) {
        // חלק מהערכים הובנו וחלק חשודים — ממלאים את התקינים ועוצרים לאישור
        _vcReset();
        haptic('warning');
        _vcOpenSheetWithHeard(clean, 'ערך אחד לא ברור — השלם ידנית');
        return;
    }
    _vcStartCountdown(clean);
}

function _vcOpenSheetWithHeard(text, note) {
    const chip = document.getElementById('vc-heard');
    if (chip) {
        chip.innerHTML = `<span class="vc-heard-note"></span><span class="vc-heard-txt"></span>`;
        chip.querySelector('.vc-heard-note').textContent = note;
        chip.querySelector('.vc-heard-txt').textContent = 'שמעתי: "' + text + '"';
        chip.style.display = 'block';
    }
    if (typeof openLiveEditSheet === 'function') openLiveEditSheet();
}

function _vcClearHeard() {
    const chip = document.getElementById('vc-heard');
    if (chip) { chip.style.display = 'none'; chip.innerHTML = ''; }
}

// הרישום בפועל חסום כשכבר נרשם הסט האחרון (action/drop panel פתוחים) —
// אותה הגנה כמו ב-_liveLogSetFromSheet, למניעת רישום כפול
function _vcLogBlocked() {
    const ap = document.getElementById('action-panel');
    const dp = document.getElementById('drop-panel');
    return !!((ap && ap.style.display === 'block') || (dp && dp.style.display === 'block'));
}

function _vcStartCountdown(text) {
    if (_vcLogBlocked()) {
        _vcReset();
        _vcStatus('הסט כבר נרשם — הערכים עודכנו', 2600);
        return;
    }
    _vcSetState('pending');
    haptic('medium');
    _vcCatcher(true);
    _vcRingRun();

    let left = 3;
    const cnt = document.getElementById('vc-mic-count');
    _vcTxt('');
    if (cnt) cnt.textContent = String(left);
    _vcStatus('נרשם אוטומטית — גע במסך כדי לתקן');

    const tick = () => {
        left--;
        if (left > 0) {
            if (cnt) cnt.textContent = String(left);
            _vcCountTimer = setTimeout(tick, VC_COUNTDOWN_MS / 3);
            return;
        }
        _vcCommit();
    };
    _vcCountTimer = setTimeout(tick, VC_COUNTDOWN_MS / 3);
}

function _vcCommit() {
    const blocked = _vcLogBlocked();
    _vcReset();
    _vcStatus('');
    if (blocked) return;
    haptic('success');
    if (typeof nextStep === 'function') {
        nextStep();
        setTimeout(() => { if (typeof updateLiveViewContent === 'function') updateLiveViewContent(); }, 80);
    }
}

// ביטול הספירה — openSheet=true פותח את גיליון העריכה עם הערכים שכבר מולאו
function _vcCancelPending(openSheet) {
    if (_vcState !== 'pending') return;
    _vcReset();
    _vcStatus('');
    haptic('light');
    if (openSheet && typeof openLiveEditSheet === 'function') openLiveEditSheet();
}

// ─── חיווט ─────────────────────────────────────────────────────────────────
function _vcInit() {
    const btn = document.getElementById('vc-mic-btn');
    if (btn && !btn._vcBound) {
        btn._vcBound = true;
        btn.addEventListener('pointerdown', vcMicDown);
        btn.addEventListener('pointerup', vcMicUp);
        btn.addEventListener('pointercancel', vcMicUp);
        btn.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    const catcher = document.getElementById('vc-catch');
    if (catcher && !catcher._vcBound) {
        catcher._vcBound = true;
        catcher.addEventListener('pointerdown', (e) => { e.preventDefault(); _vcCancelPending(true); });
    }
    const sheetClose = document.getElementById('live-edit-overlay');
    if (sheetClose && !sheetClose._vcBound) {
        sheetClose._vcBound = true;
        sheetClose.addEventListener('click', _vcClearHeard);
    }
    _vcSetState('idle');
    _vcRingReset();
    vcSyncMicBtn();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _vcInit);
else _vcInit();

window.addEventListener('online',  vcSyncMicBtn);
window.addEventListener('offline', vcSyncMicBtn);
