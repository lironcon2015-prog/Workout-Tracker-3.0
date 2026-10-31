/**
 * perf-diag.js — אבחון ביצועי עלייה (קריאה בלבד)
 *
 * נטען אחרון מבין סקריפטי ה-defer: אחרי שכל הפונקציות הוגדרו, ולפני שמאזיני
 * DOMContentLoaded רצים. עוטף שלבי עלייה ידועים במדידת זמן, ואחרי חלון המדידה
 * (BOOT_WINDOW_MS) **משחזר את הפונקציות המקוריות** — אין השפעה מתמשכת.
 *
 * עקרונות בטיחות:
 * - העטיפה שקופה: אותו this, אותם ארגומנטים, אותו ערך החזרה, אותה חריגה (try/finally).
 * - שום כתיבה ל-localStorage / IndexedDB / ענן / גיבוי. הנתונים בזיכרון בלבד ונעלמים בפתיחה הבאה.
 * - כל כשל באבחון עצמו נבלע — האבחון לעולם לא מפיל את האפליקציה.
 * - הדוח לא מכיל תוכן משתמש: שמות שלבים, שמות מפתחות, זמנים, גדלים וספירות בלבד.
 */
(function () {
    'use strict';
    const BOOT_WINDOW_MS = 12000;   // מכסה את כל הטיימרים של העלייה (האחרון: CoachDrive ב-7ש' אחרי load)
    const LAG_TICK_MS = 50;
    const LAG_REPORT_MS = 100;      // עצירה של ה-main thread מעל 100ms נרשמת כ"תקיעה"

    const now = () => performance.now();
    const diag = {
        installedAt: now(),
        steps: {},          // name -> { n, total, max, first }
        keys: {},           // getData: key -> { n, total, max }
        saves: {},          // saveData: key -> { n, total }
        lags: [],           // [atMs, durMs]
        restored: false,
        restoreList: []
    };
    window.__gpPerf = diag;

    function rec(bucket, name, t0) {
        const d = now() - t0;
        const s = bucket[name] || (bucket[name] = { n: 0, total: 0, max: 0, first: t0 });
        s.n++; s.total += d; if (d > s.max) s.max = d;
    }

    // עטיפה שקופה של פונקציה גלובלית (function declaration — כתיבה ל-window משנה את ה-binding)
    function wrapGlobal(name) {
        try {
            const orig = window[name];
            if (typeof orig !== 'function') return;
            const w = function () {
                const t0 = now();
                try { return orig.apply(this, arguments); }
                finally { rec(diag.steps, name, t0); }
            };
            window[name] = w;
            diag.restoreList.push(() => { if (window[name] === w) window[name] = orig; });
        } catch (e) { /* אבחון בלבד */ }
    }

    // עטיפה שקופה של מתודה על אובייקט (StorageManager וכו') — this נשמר דרך apply
    function wrapMethod(objName, obj, method, bucketFn) {
        try {
            if (!obj) return;
            const orig = obj[method];
            if (typeof orig !== 'function') return;
            const label = objName + '.' + method;
            const w = function () {
                const t0 = now();
                try { return orig.apply(this, arguments); }
                finally { try { bucketFn ? bucketFn(arguments, t0) : rec(diag.steps, label, t0); } catch (e) {} }
            };
            obj[method] = w;
            diag.restoreList.push(() => { if (obj[method] === w) obj[method] = orig; });
        } catch (e) { /* אבחון בלבד */ }
    }

    // ── שלבי העלייה (מאזין DOMContentLoaded ב-workout-core.js והטיימרים שאחריו) ──
    ['renderWorkoutMenu', 'checkRecovery', 'renderHeroCard', 'renderUserAvatar', 'applyHomeSectionPref',
     'renderHomeTodayCards', 'renderHomePRCard', 'readUIState', 'restoreUIState', 'initColorTheme',
     '_refreshProfileReviewBadge', '_initSwipeBackGesture', '_initTabSwipeGesture', '_initAllSheetsDrag',
     'updateFirebaseStatus', 'migrateWatchZones', 'canonicalizeExerciseNames', 'syncHealthNutrition',
     'startWatchAutoPull', '_scheduleHealthHourlySync', 'maybeShowCloudSyncBanner', '_afterConnectionChange'
    ].forEach(wrapGlobal);

    try {
        if (typeof StorageManager !== 'undefined') {
            ['initDB', 'sanitizeDayKeyedData', 'cleanZeroVitals', 'maybeSendWeeklyBackup', 'maybePushWidgetSnapshot']
                .forEach(m => wrapMethod('StorageManager', StorageManager, m));
            wrapMethod('StorageManager', StorageManager, 'getData', (args, t0) => rec(diag.keys, String(args[0]), t0));
            wrapMethod('StorageManager', StorageManager, 'saveData', (args, t0) => rec(diag.saves, String(args[0]), t0));
        }
        if (typeof FirebaseManager !== 'undefined') wrapMethod('FirebaseManager', FirebaseManager, 'armSyncOnBoot');
        if (typeof CoachDrive !== 'undefined') wrapMethod('CoachDrive', CoachDrive, 'maybeSync');
    } catch (e) { /* אבחון בלבד */ }

    // ── גלאי תקיעות: טיימר קצר; איחור גדול = ה-main thread היה חסום ──
    let lagTimer = null;
    try {
        let last = now();
        lagTimer = setInterval(() => {
            const t = now(), late = t - last - LAG_TICK_MS;
            if (late > LAG_REPORT_MS) diag.lags.push([Math.round(last), Math.round(late)]);
            last = t;
        }, LAG_TICK_MS);
    } catch (e) {}

    // ── סוף חלון המדידה: שחזור כל הפונקציות המקוריות ──
    setTimeout(() => {
        try { if (lagTimer) clearInterval(lagTimer); } catch (e) {}
        diag.restoreList.forEach(fn => { try { fn(); } catch (e) {} });
        diag.restoreList = [];
        diag.restored = true;
    }, BOOT_WINDOW_MS);

    // ── בניית הדוח (רק כשהמשתמש פותח את המסך) ──
    const r = v => Math.round(v);
    const kb = chars => (chars / 1024).toFixed(chars < 10240 ? 1 : 0);

    function navLines() {
        const out = [];
        try {
            const n = performance.getEntriesByType('navigation')[0];
            if (n) {
                // פירוק השלב שלפני ה-HTML: הפעלת ה-SW / רשת או cache / הורדה
                let path = '?';
                try { const u = new URL(n.name); path = u.pathname + (u.search ? ' +query' : ''); } catch (e) {}
                out.push(`כתובת: ${path} · SW שולט: ${navigator.serviceWorker && navigator.serviceWorker.controller ? 'כן' : 'לא'}`);
                out.push(`הפעלת SW (workerStart): ${r(n.workerStart || 0)}ms · fetchStart: ${r(n.fetchStart)}ms`);
                out.push(`בקשה→תשובה: requestStart ${r(n.requestStart)} · responseStart ${r(n.responseStart)}ms`);
                out.push(`transferSize: ${n.transferSize != null ? n.transferSize : '?'} · body: ${n.encodedBodySize != null ? n.encodedBodySize : '?'}`);
                out.push(`HTML התקבל: ${r(n.responseEnd)}ms`);
                out.push(`DOM מוכן (לפני סקריפטים): ${r(n.domInteractive)}ms`);
                out.push(`הרצת סקריפטים (defer): ${r(n.domContentLoadedEventStart - n.domInteractive)}ms`);
                out.push(`מאזיני עלייה (DOMContentLoaded): ${r(n.domContentLoadedEventEnd - n.domContentLoadedEventStart)}ms`);
                out.push(`עלייה הושלמה (DCL): ${r(n.domContentLoadedEventEnd)}ms`);
                if (n.loadEventEnd) out.push(`load: ${r(n.loadEventEnd)}ms`);
            }
            const fcp = performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint');
            if (fcp) out.push(`ציור ראשון (FCP): ${r(fcp.startTime)}ms`);
        } catch (e) { out.push('navigation timing: לא זמין'); }
        return out;
    }

    // מספר הרשומות בכל cache של ה-SW (קריאה בלבד) + האם index.html נמצא בו
    async function cacheLines() {
        const out = [];
        try {
            if (!('caches' in window)) return ['לא זמין'];
            const names = await caches.keys();
            for (const nm of names) {
                const c = await caches.open(nm);
                const keys = await c.keys();
                out.push(`${nm}: ${keys.length} רשומות`);
            }
            const t0 = now();
            const hit = await caches.match('./index.html');
            out.push(`index.html ב-cache: ${hit ? 'כן' : 'לא'} (${(now() - t0).toFixed(1)}ms)`);
            const t1 = now();
            const hitNav = await caches.match(location.href);
            out.push(`הכתובת הנוכחית ב-cache: ${hitNav ? 'כן' : 'לא'} (${(now() - t1).toFixed(1)}ms)`);
        } catch (e) { out.push('שגיאה: ' + (e && e.name || e)); }
        return out;
    }

    // קיבוץ מפתחות לפי תחילית (עד הספרה/המזהה הראשונים) — לזיהוי מקור ריבוי מפתחות
    function keyGroupLines() {
        const groups = {};
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i) || '';
                const g = k.replace(/[0-9a-f]{6,}.*$/i, '*').replace(/\d.*$/, '*');
                const v = localStorage.getItem(k) || '';
                const e = groups[g] || (groups[g] = { n: 0, sz: 0 });
                e.n++; e.sz += k.length + v.length;
            }
        } catch (e) { return ['שגיאה: ' + (e && e.name || e)]; }
        return Object.entries(groups).filter(([, e]) => e.n > 3).sort((a, b) => b[1].n - a[1].n).slice(0, 8)
            .map(([g, e]) => `${e.n} מפתחות · ${kb(e.sz)}KB  ${g}`);
    }

    function storageLines() {
        const out = [];
        try {
            const rows = [];
            let total = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                const v = localStorage.getItem(k) || '';
                const sz = k.length + v.length;
                total += sz;
                rows.push([k, sz]);
            }
            rows.sort((a, b) => b[1] - a[1]);
            // Safari: מכסת localStorage ≈ 5M תווים (UTF-16) לכל origin
            out.push(`סה"כ: ${kb(total)}KB (${rows.length} מפתחות) · ~${Math.round(total / (5 * 1024 * 1024) * 100)}% מתקרה משוערת של 5MB`);
            rows.slice(0, 15).forEach(([k, sz]) => out.push(`${kb(sz)}KB  ${k}`));
            const kg = keyGroupLines();
            if (kg.length) { out.push('קבוצות מפתחות:'); kg.forEach(x => out.push('  ' + x)); }
        } catch (e) { out.push('localStorage: שגיאה בקריאה — ' + (e && e.name || e)); }
        return out;
    }

    function archiveLines() {
        const out = [];
        try {
            const a = JSON.parse(localStorage.getItem('gympro_archive') || '[]');
            if (!Array.isArray(a)) return ['ארכיון: לא מערך'];
            let watch = 0, series = 0, pts = 0, seriesChars = 0;
            a.forEach(e => {
                const w = e && e.watch;
                if (!w) return;
                watch++;
                if (Array.isArray(w.hrSeries) && w.hrSeries.length) {
                    series++; pts += w.hrSeries.length;
                    seriesChars += JSON.stringify(w.hrSeries).length;
                }
            });
            const t0 = now(); JSON.parse(localStorage.getItem('gympro_archive') || '[]'); const parseMs = now() - t0;
            out.push(`רשומות: ${a.length} · עם שעון: ${watch} · עם סדרת דופק: ${series} (${pts} נקודות, ${kb(seriesChars)}KB)`);
            out.push(`קריאה אחת של הארכיון (JSON.parse): ${parseMs.toFixed(1)}ms`);
        } catch (e) { out.push('ארכיון: שגיאה בקריאה — ' + (e && e.name || e)); }
        return out;
    }

    function bucketLines(bucket, sortBy, limit, withMax) {
        return Object.entries(bucket)
            .sort((a, b) => b[1][sortBy] - a[1][sortBy])
            .slice(0, limit)
            .map(([k, s]) => `${r(s.total)}ms  ×${s.n}${withMax && s.n > 1 ? ` (מקס' ${r(s.max)})` : ''}  ${k}` +
                (s.first != null ? `  @${r(s.first)}` : ''));
    }

    async function buildPerfReport() {
        const L = [];
        L.push('GymPro — אבחון עלייה');
        L.push(`גרסה: ${window._gymproVersion || (typeof CACHE_VERSION !== 'undefined' ? CACHE_VERSION : '') || ((document.getElementById('settings-version-inline') || {}).textContent || '?')} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`);
        const openNote = diag.restored ? '' : ' (חלון המדידה עדיין פתוח — המתן 12 שניות מהפתיחה)';
        L.push(`פתיחה לפני: ${r(now() / 1000)} שניות${openNote}`);
        L.push(`מכשיר: ${navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 90)}`);
        L.push('');
        L.push('— ציר זמן —'); navLines().forEach(x => L.push(x));
        L.push('');
        L.push('— שלבים (סה"כ, מספר קריאות, @התחלה) —');
        bucketLines(diag.steps, 'total', 30, true).forEach(x => L.push(x));
        L.push('');
        L.push('— קריאות אחסון (getData) לפי זמן —');
        bucketLines(diag.keys, 'total', 12, true).map(x => x.replace(/  @\d+$/, '')).forEach(x => L.push(x));
        const sv = bucketLines(diag.saves, 'total', 8, false).map(x => x.replace(/  @\d+$/, ''));
        if (sv.length) { L.push(''); L.push('— כתיבות אחסון (saveData) בעלייה —'); sv.forEach(x => L.push(x)); }
        L.push('');
        L.push(`— תקיעות (>${LAG_REPORT_MS}ms) —`);
        if (diag.lags.length) diag.lags.forEach(([at, d]) => L.push(`${d}ms  @${at}`));
        else L.push('אין');
        L.push('');
        L.push('— אחסון מקומי —'); storageLines().forEach(x => L.push(x));
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const est = await navigator.storage.estimate();
                if (est && est.usage != null) L.push(`origin כולל (IndexedDB/cache): ${(est.usage / 1048576).toFixed(1)}MB מתוך ${est.quota ? (est.quota / 1048576).toFixed(0) + 'MB' : '?'}`);
            }
        } catch (e) {}
        L.push('');
        L.push('— Cache Storage (SW) —'); (await cacheLines()).forEach(x => L.push(x));
        L.push('');
        L.push('— ארכיון —'); archiveLines().forEach(x => L.push(x));
        return L.join('\n');
    }

    let _lastReport = '';
    window.openPerfDiag = async function () {
        const modal = document.getElementById('perf-diag-modal');
        const pre = document.getElementById('perf-diag-text');
        if (!modal || !pre) return;
        pre.textContent = 'בונה דוח…';
        modal.style.display = 'flex';
        try { _lastReport = await buildPerfReport(); }
        catch (e) { _lastReport = 'שגיאה בבניית הדוח: ' + (e && e.message || e); }
        pre.textContent = _lastReport;
    };
    window.closePerfDiag = function () {
        const modal = document.getElementById('perf-diag-modal');
        if (modal) modal.style.display = 'none';
    };
    window.copyPerfDiag = function () {
        if (typeof _copyText === 'function') _copyText(_lastReport, 'הדוח הועתק — הדבק אותו בשיחה.');
    };
})();
