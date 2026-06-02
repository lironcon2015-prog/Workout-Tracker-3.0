/* ============================================================================
 * bodylog-logic.js — מעקב שקילות (משקל + אחוז שומן) GYMPRO ELITE
 * מסך "גוף": רשימת שקילות, גרפים, ניתוחים, צילום/OCR, ייבוא וייצוא CSV.
 * המצב התזונתי לכל שקילה נגזר אוטומטית מלוג המעברים (StorageManager).
 * ==========================================================================*/

let _blRange = 30;            // טווח גרף נוכחי: 7 / 30 / 90 / 'all'
let _blEditDate = null;       // התאריך שנערך כרגע (null = רשומה חדשה)
let _bodyImportRows = [];     // שורות מפורסרות מ-CSV הממתינות לאישור
let _bodyImportMap = {};      // מיפוי תווית "שלב" גולמית → מצב תזונתי

const _BL_STATE_LBL = { cut: 'Cut', maintenance: 'Maintenance', surplus: 'Surplus' };

// ─── עזרי תאריך ─────────────────────────────────────────────────────────────
function _blDTs(d) { const [y, m, da] = d.split('-').map(Number); return new Date(y, m - 1, da).getTime(); }
function _blTodayStr() { return new Date().toISOString().slice(0, 10); }
function _blShortDate(d) { const p = d.split('-'); return `${p[2]}.${p[1]}`; }
function _blCutoff(days) { return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10); }

// ─── רינדור ראשי ────────────────────────────────────────────────────────────
function renderBodyLog() {
    const log = StorageManager.getBodyLog();
    _renderBodyKpis(log);
    _renderBodyCharts(log);
    _renderBodyList(log);
}

function setBodyRange(r) {
    _blRange = r;
    document.querySelectorAll('#bl-range-chips .bl-chip').forEach(b =>
        b.classList.toggle('active', String(b.dataset.range) === String(r)));
    _renderBodyCharts(StorageManager.getBodyLog());
    haptic('light');
}

function _blFilter(log) {
    if (_blRange === 'all') return log.slice();
    const cutoff = _blCutoff(_blRange);
    return log.filter(e => e.date >= cutoff);
}

// ─── KPIs ───────────────────────────────────────────────────────────────────
function _renderBodyKpis(log) {
    const el = document.getElementById('bodylog-kpis');
    if (!el) return;
    if (!log.length) {
        el.innerHTML = '<div class="bl-empty">אין עדיין שקילות. צלם שקילה או הזן ידנית כדי להתחיל.</div>';
        return;
    }
    const sorted = log.slice().sort((a, b) => a.date < b.date ? -1 : 1);
    const cur = sorted[sorted.length - 1];
    const ref30 = sorted.find(e => e.date >= _blCutoff(30)) || sorted[0];
    const d30 = cur.weight - ref30.weight;
    const spanDays = Math.max(1, (_blDTs(cur.date) - _blDTs(ref30.date)) / 86400000);
    const weekly = (d30 / spanDays) * 7;
    const fat = cur.bodyFat;
    const lbm = fat != null ? cur.weight * (1 - fat / 100) : null;

    el.innerHTML =
        _kpi('משקל נוכחי', cur.weight.toFixed(1) + ' ק"ג', _blShortDate(cur.date)) +
        _kpi('שינוי 30 יום', (d30 >= 0 ? '+' : '') + d30.toFixed(1) + ' ק"ג', '', d30) +
        _kpi('קצב שבועי', (weekly >= 0 ? '+' : '') + weekly.toFixed(2), 'ק"ג / שבוע', weekly) +
        (fat != null ? _kpi('אחוז שומן', fat.toFixed(1) + '%', lbm ? 'מסת רזה ' + lbm.toFixed(1) + ' ק"ג' : '') : '');
}

function _kpi(label, val, sub, trend) {
    const cls = trend == null ? '' : (trend > 0 ? ' bl-kpi-val--up' : trend < 0 ? ' bl-kpi-val--down' : '');
    return `<div class="bl-kpi"><div class="bl-kpi-label">${label}</div>` +
        `<div class="bl-kpi-val${cls}">${val}</div>${sub ? `<div class="bl-kpi-sub">${sub}</div>` : ''}</div>`;
}

// ─── גרפים ──────────────────────────────────────────────────────────────────
function _renderBodyCharts(log) {
    const data = _blFilter(log).sort((a, b) => a.date < b.date ? -1 : 1);
    _drawBlChart('bl-weight-svg', 'bl-weight-dates', data.map(e => ({ date: e.date, val: e.weight })), 'kg', true);
    const fatData = data.filter(e => e.bodyFat != null).map(e => ({ date: e.date, val: e.bodyFat }));
    const fatCard = document.getElementById('bl-fat-card');
    if (fatData.length >= 1) {
        if (fatCard) fatCard.style.display = 'block';
        _drawBlChart('bl-fat-svg', 'bl-fat-dates', fatData, '%', false);
    } else if (fatCard) {
        fatCard.style.display = 'none';
    }
}

function _drawBlChart(svgId, datesId, points, unit, withMA) {
    const svg = document.getElementById(svgId);
    const datesEl = document.getElementById(datesId);
    if (!svg) return;
    const n = points.length;
    if (n < 2) {
        svg.innerHTML = `<text x="200" y="85" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="13" font-family="Heebo">אין מספיק נתונים למגמה</text>`;
        if (datesEl) datesEl.innerHTML = '';
        return;
    }
    const vals = points.map(p => p.val);
    const W = 400, H = 170, pad = { t: 18, b: 16, l: 36, r: 14 };
    const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
    const spread = Math.max(...vals) - Math.min(...vals);
    const mn = Math.min(...vals) - (spread > 0 ? spread * 0.2 : 1);
    const mx = Math.max(...vals) + (spread > 0 ? spread * 0.2 : 1);
    const px = i => pad.l + (i / (n - 1)) * cW;
    const py = v => pad.t + cH - ((v - mn) / ((mx - mn) || 1)) * cH;
    const pts = vals.map((v, i) => [px(i), py(v)]);
    const smooth = ps => (typeof getSmoothPath === 'function') ? getSmoothPath(ps) : ('M' + ps.map(p => p.join(',')).join(' L'));
    const linePath = smooth(pts);
    const areaPath = linePath + ` L${pts[n - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;

    // ממוצע נע 7 נקודות — מחליק רעש יומי במשקל
    let maPath = '';
    if (withMA && n >= 4) {
        const ma = vals.map((_, i) => {
            const slice = vals.slice(Math.max(0, i - 6), i + 1);
            return slice.reduce((a, b) => a + b, 0) / slice.length;
        });
        const mpts = ma.map((v, i) => [px(i), py(v)]);
        maPath = `<path d="${smooth(mpts)}" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.5"/>`;
    }

    const yl = [mx, (mx + mn) / 2, mn].map(v =>
        `<text x="4" y="${(py(v) + 3).toFixed(1)}" fill="rgba(255,255,255,0.35)" font-size="9" font-family="Heebo">${v.toFixed(1)}</text>`).join('');
    const last = pts[n - 1];

    svg.innerHTML = `
        <defs><linearGradient id="bl-grad-${svgId}" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#0A84FF"/><stop offset="100%" stop-color="transparent"/></linearGradient></defs>
        ${yl}
        <path d="${areaPath}" fill="url(#bl-grad-${svgId})" opacity="0.22"/>
        <path d="${linePath}" fill="none" stroke="#0A84FF" stroke-width="3" stroke-linecap="round"/>
        ${maPath}
        <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="5" fill="#0A84FF"/>`;

    if (datesEl) {
        const step = Math.ceil(n / 6);
        datesEl.innerHTML = points.map((p, i) =>
            (i % step === 0 || i === n - 1) ? `<span>${_blShortDate(p.date)}</span>` : '').join('');
    }
}

// ─── רשימת שקילות ───────────────────────────────────────────────────────────
function _renderBodyList(log) {
    const el = document.getElementById('bodylog-list');
    if (!el) return;
    if (!log.length) { el.innerHTML = ''; return; }
    const sorted = log.slice().sort((a, b) => a.date < b.date ? 1 : -1); // חדש→ישן
    el.innerHTML = sorted.map((e, i) => {
        const prev = sorted[i + 1]; // הישן יותר
        const delta = prev ? e.weight - prev.weight : null;
        const dCls = delta == null ? '' : (delta > 0 ? 'up' : delta < 0 ? 'down' : '');
        const dArrow = delta == null ? '' : (delta > 0 ? '▲' : delta < 0 ? '▼' : '');
        const deltaHtml = delta != null && delta !== 0 ? `<span class="bl-delta ${dCls}">${dArrow}${Math.abs(delta).toFixed(1)}</span>` : '';
        const chip = e.nutritionState ? `<span class="bl-state-chip bl-state-chip--${e.nutritionState}">${_BL_STATE_LBL[e.nutritionState]}</span>` : '';
        const fat = e.bodyFat != null ? `<span class="bl-row-fat">${e.bodyFat.toFixed(1)}%</span>` : '';
        return `<div class="bl-row" onclick="openBodyEntryModal('${e.date}')">
            <div class="bl-row-main">
                <span class="bl-row-date">${_blShortDate(e.date)}</span>
                <span class="bl-row-weight">${e.weight.toFixed(1)}<small> ק"ג</small></span>
                ${deltaHtml}
            </div>
            <div class="bl-row-meta">${fat}${chip}</div>
        </div>`;
    }).join('');
}

// ─── הזנה ידנית / עריכה ─────────────────────────────────────────────────────
function openBodyEntryModal(date) {
    _blEditDate = date || null;
    const today = _blTodayStr();
    const dateInput = document.getElementById('bl-entry-date');
    const hint = document.getElementById('bl-entry-ocr-hint');
    const weightInp = document.getElementById('bl-entry-weight');
    hint.style.display = 'none'; hint.textContent = '';
    weightInp.dataset.src = '';

    if (date) {
        const e = StorageManager.getBodyLog().find(x => x.date === date);
        if (!e) return;
        document.getElementById('bl-entry-title').textContent = 'עריכת שקילה';
        dateInput.value = e.date;
        weightInp.value = e.weight != null ? e.weight : '';
        document.getElementById('bl-entry-fat').value = e.bodyFat != null ? e.bodyFat : '';
        document.getElementById('bl-entry-nutri').value = e.nutritionState || '';
        document.getElementById('bl-entry-note').value = e.note || '';
        document.getElementById('bl-entry-delete').style.display = 'block';
    } else {
        document.getElementById('bl-entry-title').textContent = 'שקילה חדשה';
        dateInput.value = today;
        weightInp.value = '';
        document.getElementById('bl-entry-fat').value = '';
        document.getElementById('bl-entry-nutri').value = '';
        document.getElementById('bl-entry-note').value = '';
        document.getElementById('bl-entry-delete').style.display = 'none';
    }
    dateInput.max = today;
    document.getElementById('bl-entry-modal').style.display = 'flex';
}

function closeBodyEntryModal() { document.getElementById('bl-entry-modal').style.display = 'none'; }

function saveBodyEntry() {
    const date = document.getElementById('bl-entry-date').value;
    const weight = parseFloat(document.getElementById('bl-entry-weight').value);
    const fatRaw = document.getElementById('bl-entry-fat').value.trim();
    const nutriSel = document.getElementById('bl-entry-nutri').value;
    const note = document.getElementById('bl-entry-note').value.trim();
    const today = _blTodayStr();

    if (!date) { showAlert('בחר תאריך.'); return; }
    if (date > today) { showAlert('לא ניתן להזין תאריך עתידי.'); return; }
    if (!(weight > 0)) { showAlert('הזן משקל תקין.'); return; }
    let bodyFat = fatRaw === '' ? null : parseFloat(fatRaw);
    if (bodyFat != null && (!(bodyFat > 0) || bodyFat > 70)) { showAlert('אחוז שומן לא תקין.'); return; }

    const nutritionState = nutriSel || StorageManager.getNutritionStateOnDate(date);
    const source = document.getElementById('bl-entry-weight').dataset.src === 'ocr' ? 'ocr' : 'manual';

    // עריכה ששינתה תאריך — מחיקת הרשומה הישנה כדי לא ליצור כפילות
    if (_blEditDate && _blEditDate !== date) StorageManager.deleteBodyEntry(_blEditDate);
    StorageManager.upsertBodyEntry({ date, weight, bodyFat, nutritionState, note, source });

    closeBodyEntryModal();
    renderBodyLog();
    haptic('success');
}

function deleteBodyEntryUI() {
    if (!_blEditDate) return;
    showConfirm('למחוק את השקילה?', () => {
        StorageManager.deleteBodyEntry(_blEditDate);
        closeBodyEntryModal();
        renderBodyLog();
    });
}

// ─── צילום + OCR דרך Gemini Vision ──────────────────────────────────────────
function openBodyCaptureInput() {
    if (!StorageManager.getAIConfig().apiKey) {
        showAlert('לקריאת תמונה אוטומטית נדרש מפתח Gemini (הגדרות → AI Coach). פותח הזנה ידנית.', openBodyEntryModal);
        return;
    }
    document.getElementById('bl-camera-input').click();
}

function _onBodyPhotoSelected(file) {
    if (!file) return;
    _fileToBase64(file).then(({ base64, mime }) => {
        openBodyEntryModal();
        document.getElementById('bl-entry-title').textContent = 'שקילה מתמונה';
        const hint = document.getElementById('bl-entry-ocr-hint');
        hint.style.display = 'block';
        hint.className = 'bl-ocr-hint bl-ocr-hint--loading';
        hint.textContent = '🔍 קורא את התצוגה מהתמונה…';
        return _callGeminiVision(base64, mime).then(res => {
            if (res.weight != null) {
                document.getElementById('bl-entry-weight').value = res.weight;
                document.getElementById('bl-entry-weight').dataset.src = 'ocr';
            }
            if (res.bodyFat != null) document.getElementById('bl-entry-fat').value = res.bodyFat;
            hint.className = 'bl-ocr-hint bl-ocr-hint--ok';
            hint.textContent = res.weight != null ? '✓ נקרא מהתמונה — בדוק ותקן אם צריך' : '⚠ לא זוהה משקל — הזן ידנית';
        });
    }).catch(() => {
        const hint = document.getElementById('bl-entry-ocr-hint');
        if (hint) { hint.style.display = 'block'; hint.className = 'bl-ocr-hint bl-ocr-hint--err'; hint.textContent = '⚠ קריאת התמונה נכשלה — הזן ידנית'; }
    });
}

function _fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => { const s = String(r.result); resolve({ base64: s.slice(s.indexOf(',') + 1), mime: file.type || 'image/jpeg' }); };
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

async function _callGeminiVision(base64, mimeType) {
    const config = StorageManager.getAIConfig();
    if (!config.apiKey) throw new Error('API_KEY_MISSING');
    const prompt = 'אתה קורא תצוגה של משקל חכם מתוך תמונה. החזר JSON בלבד: {"weight": number|null, "bodyFat": number|null}. ' +
        'weight = משקל גוף בק"ג (מספר עשרוני). bodyFat = אחוז שומן (מספר, ללא סימן %). אם ערך לא קריא או לא קיים בתמונה — החזר null עבורו. אל תכלול טקסט נוסף.';
    const parts = [{ text: prompt }, { inlineData: { mimeType, data: base64 } }];
    const generationConfig = { temperature: 0.1, maxOutputTokens: 120, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } };
    let lastErr = '';
    for (const modelName of config.models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.apiKey}`;
            const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }) });
            if (!resp.ok) {
                if ([400, 404, 429, 503].includes(resp.status)) { lastErr = `${modelName}:${resp.status}`; continue; } // מודל לא תומך/עמוס — נסה הבא
                throw new Error('API_ERROR_' + resp.status);
            }
            const data = await resp.json();
            const txt = (data.candidates?.[0]?.content?.parts || []).find(p => !p.thought)?.text || '';
            const parsed = JSON.parse(txt);
            const w = (typeof parsed.weight === 'number') ? parsed.weight : null;
            const bf = (typeof parsed.bodyFat === 'number') ? parsed.bodyFat : null;
            return { weight: w, bodyFat: bf };
        } catch (e) { lastErr = e.message || String(e); }
    }
    throw new Error(lastErr || 'VISION_FAILED');
}

// ─── ייבוא CSV ──────────────────────────────────────────────────────────────
function openBodyImportInput() { document.getElementById('bl-csv-input').click(); }

function _onBodyCsvSelected(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try { _bodyImportRows = _parseBodyCsv(String(reader.result)); _renderImportPreview(); }
        catch (e) { showAlert('שגיאה בפענוח הקובץ: ' + (e.message || e)); }
    };
    reader.onerror = () => showAlert('שגיאה בקריאת הקובץ.');
    reader.readAsText(file, 'utf-8');
}

function _detectDelim(line) {
    const c = (line.match(/,/g) || []).length, t = (line.match(/\t/g) || []).length, s = (line.match(/;/g) || []).length;
    if (t >= c && t >= s) return '\t';
    if (s > c) return ';';
    return ',';
}

function _splitCsvLine(line, delim) {
    const res = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) {
            if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
            else cur += ch;
        } else if (ch === '"' && cur === '') {
            q = true;                       // ציטוט תקף רק בתחילת שדה (תקן CSV)
        } else if (ch === delim) {
            res.push(cur); cur = '';
        } else {
            cur += ch;                      // ציטוט באמצע שדה (כמו ק"ג) = תו רגיל
        }
    }
    res.push(cur);
    return res;
}

function _mapColumns(headers) {
    const find = kws => { const i = headers.findIndex(h => { const s = h.toLowerCase(); return kws.some(k => s.includes(k.toLowerCase())); }); return i < 0 ? null : i; };
    return {
        date: find(['תאריך', 'date']),
        weight: find(['משקל', 'weight', 'ק"ג', 'kg']),
        fat: find(['שומן', 'fat', 'bf']),
        phase: find(['שלב', 'phase', 'מצב', 'state']),
        note: find(['הערות', 'הערה', 'note', 'comment'])
    };
}

// _parseFlexDate — תומך ב-YYYY-MM-DD, DD.MM.YYYY, DD/MM/YY ו-DD.MM (משלים שנה).
function _parseFlexDate(raw) {
    if (!raw) return null;
    raw = raw.trim();
    const pad = n => String(n).padStart(2, '0');
    let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
    if (m) { let y = m[3]; if (y.length === 2) y = '20' + y; return `${y}-${pad(m[2])}-${pad(m[1])}`; }
    m = raw.match(/^(\d{1,2})[.\/-](\d{1,2})$/);
    if (m) {
        const d = +m[1], mo = +m[2], now = new Date();
        let y = now.getFullYear();
        if (new Date(y, mo - 1, d).getTime() > now.getTime() + 86400000) y -= 1; // עתידי → שנה קודמת
        return `${y}-${pad(mo)}-${pad(d)}`;
    }
    return null;
}

// _mapPhaseLabel — תרגום תווית "שלב" חופשית לאחד משלושת המצבים.
function _mapPhaseLabel(raw) {
    if (!raw) return null;
    const s = raw.toLowerCase();
    if (s.includes('מיינט') || s.includes('maint')) return 'maintenance';
    if (s.includes('עודף') || s.includes('surplus') || s.includes('bulk') || s.includes('באלק') || s.includes('בולק')) return 'surplus';
    if (s.includes('קאט') || s.includes('cut') || s.includes('גירעון') || s.includes('deficit')) return 'cut';
    return null;
}

function _parseBodyCsv(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return [];
    const delim = _detectDelim(lines[0]);
    const headers = _splitCsvLine(lines[0], delim).map(h => h.trim());
    const col = _mapColumns(headers);
    if (col.date == null || col.weight == null) throw new Error('לא זוהו עמודות תאריך + משקל');
    const out = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = _splitCsvLine(lines[i], delim);
        const date = _parseFlexDate((cells[col.date] || '').trim());
        const wRaw = (cells[col.weight] || '').replace(',', '.').replace(/[^\d.]/g, '');
        const weight = parseFloat(wRaw);
        if (!date || !(weight > 0)) continue;
        let bodyFat = null;
        if (col.fat != null) {
            const f = (cells[col.fat] || '').replace('%', '').replace(',', '.').trim();
            if (f !== '') { const fv = parseFloat(f); if (fv > 0 && fv <= 70) bodyFat = fv; }
        }
        const phaseRaw = col.phase != null ? (cells[col.phase] || '').trim() : '';
        const note = col.note != null ? (cells[col.note] || '').trim() : '';
        out.push({ date, weight, bodyFat, phaseRaw, note });
    }
    return out;
}

function _renderImportPreview() {
    const rows = _bodyImportRows.filter(r => r.date && r.weight > 0);
    const summary = document.getElementById('bl-import-summary');
    const mapWrap = document.getElementById('bl-import-mapping');
    const prevWrap = document.getElementById('bl-import-preview');
    const confirmBtn = document.getElementById('bl-import-confirm');

    if (!rows.length) {
        summary.textContent = 'לא זוהו שורות תקינות בקובץ (נדרשות עמודות תאריך + משקל).';
        mapWrap.innerHTML = ''; prevWrap.innerHTML = ''; confirmBtn.style.display = 'none';
        document.getElementById('bl-import-modal').style.display = 'flex';
        return;
    }
    confirmBtn.style.display = 'block';
    const existing = new Set(StorageManager.getBodyLog().map(e => e.date));
    const dupes = rows.filter(r => existing.has(r.date)).length;
    summary.textContent = `זוהו ${rows.length} שקילות${dupes ? ` · ${dupes} ידרסו רשומות קיימות` : ''}.`;

    // מיפוי תוויות "שלב" → מצב תזונתי (מולא אוטומטית, ניתן לשנות)
    const phases = [...new Set(rows.map(r => r.phaseRaw).filter(Boolean))];
    _bodyImportMap = {};
    phases.forEach(p => _bodyImportMap[p] = _mapPhaseLabel(p) || '');
    mapWrap.innerHTML = phases.length
        ? '<div class="bl-map-title">מיפוי "שלב" → מצב תזונתי</div>' + phases.map(p =>
            `<div class="bl-map-row"><span class="bl-map-raw">${p}</span>
             <select class="minimal-input m-0 bg-card bl-map-sel" data-raw="${encodeURIComponent(p)}" onchange="_blSetMap(this)">
               <option value="cut"${_bodyImportMap[p] === 'cut' ? ' selected' : ''}>Cut</option>
               <option value="maintenance"${_bodyImportMap[p] === 'maintenance' ? ' selected' : ''}>Maintenance</option>
               <option value="surplus"${_bodyImportMap[p] === 'surplus' ? ' selected' : ''}>Surplus</option>
               <option value=""${!_bodyImportMap[p] ? ' selected' : ''}>—</option>
             </select></div>`).join('')
        : '';

    const prev = rows.slice(0, 6).map(r =>
        `<div class="bl-prev-row"><span>${r.date}</span><span>${r.weight}</span><span>${r.bodyFat != null ? r.bodyFat + '%' : '—'}</span><span>${r.phaseRaw || '—'}</span></div>`).join('');
    prevWrap.innerHTML = `<div class="bl-prev-row bl-prev-head"><span>תאריך</span><span>ק"ג</span><span>שומן</span><span>שלב</span></div>${prev}` +
        (rows.length > 6 ? `<div class="bl-prev-more">+${rows.length - 6} שקילות נוספות…</div>` : '');

    document.getElementById('bl-import-modal').style.display = 'flex';
}

function _blSetMap(sel) { _bodyImportMap[decodeURIComponent(sel.dataset.raw)] = sel.value; }
function closeBodyImportModal() { document.getElementById('bl-import-modal').style.display = 'none'; _bodyImportRows = []; }

function confirmBodyImport() {
    const rows = _bodyImportRows.filter(r => r.date && r.weight > 0);
    let count = 0;
    rows.forEach(r => {
        const state = r.phaseRaw ? (_bodyImportMap[r.phaseRaw] || null) : StorageManager.getNutritionStateOnDate(r.date);
        StorageManager.upsertBodyEntry({ date: r.date, weight: r.weight, bodyFat: r.bodyFat, nutritionState: state, note: r.note, source: 'import' });
        count++;
    });
    closeBodyImportModal();
    renderBodyLog();
    showAlert(`יובאו ${count} שקילות בהצלחה.`);
}

// ─── ייצוא CSV ──────────────────────────────────────────────────────────────
function openBodyExportSheet() {
    const today = _blTodayStr();
    const s = document.getElementById('bl-export-start'), e = document.getElementById('bl-export-end');
    if (s) s.max = today;
    if (e) { e.max = today; e.value = today; }
    document.getElementById('bl-export-modal').style.display = 'flex';
}
function closeBodyExportModal() { document.getElementById('bl-export-modal').style.display = 'none'; }

function exportBodyCsv(range) {
    let log = StorageManager.getBodyLog().slice().sort((a, b) => a.date < b.date ? -1 : 1);
    if (range === 7 || range === 30) {
        const cutoff = _blCutoff(range);
        log = log.filter(e => e.date >= cutoff);
    } else if (range === 'custom') {
        const s = document.getElementById('bl-export-start').value;
        const en = document.getElementById('bl-export-end').value;
        if (!s || !en) { showAlert('בחר תאריך התחלה וסיום.'); return; }
        log = log.filter(e => e.date >= s && e.date <= en);
    }
    if (!log.length) { showAlert('אין נתונים לייצוא בטווח שנבחר.'); return; }

    const header = ['תאריך', 'משקל (ק"ג)', 'אחוז שומן', 'מצב תזונתי', 'מקור', 'הערות'];
    const rows = log.map(e => [
        e.date, e.weight,
        e.bodyFat != null ? e.bodyFat + '%' : '',
        _BL_STATE_LBL[e.nutritionState] || '',
        e.source || '', e.note || ''
    ]);
    const esc = c => { const s = String(c); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM — תאימות עברית באקסל
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gympro_weights_${_blTodayStr()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    closeBodyExportModal();
    haptic('success');
}
