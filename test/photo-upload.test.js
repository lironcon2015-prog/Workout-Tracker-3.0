/* ============================================================================
 * test/photo-upload.test.js — תמונות התקדמות מול הדרייב: קבלה, ניסיון חוזר, מחיקות
 * הרצה: node test/photo-upload.test.js   (ללא תלויות, ללא build)
 *
 * 29.9: תמונת הבוקר הגיעה לדרייב ב-08:31:52 ושוב ב-08:41:31 (אותם 180,875 בתים) ונשארה
 * "ממתינה": הגשר ביצע, והתשובה לא הגיעה לאפליקציה (דף 404 של Drive בקפיצה השנייה של
 * Apps Script). כל ניסיון העלה מחדש וזרק את העותק הקודם לאשפה, ו"בדוק חיבור" הציג את
 * ה-404 כבעיית "Who has access" — בזמן שהפריסה תקינה.
 *
 *  1. הבלוק הטהור PPRECEIPT מ-photos-logic.js — עותק עדכני לתאריך, קבלה, השהיית ניסיון חוזר.
 *  2. _bridgeJson האמיתי מ-storage.js — הסיבה לפי השרת שהחזיר את הדף.
 *  3. התור המלא: photos-logic.js האמיתי מול הגשר האמיתי (bridges/photo-bridge.gs) על DriveApp
 *     מדומה בזיכרון, שכמו האמיתי מחזיר גם קבצים שבאשפה (הם נשארים בתיקייה). פעמיים: מול
 *     הגשר שבריפו, ומול הגשר שפרוס אצל המשתמש (עד v19.17.9 — רשימה שכוללת את האשפה).
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let failed = 0;
function ok(cond, name) { if (!cond) failed++; console.log(`${cond ? '✓' : '✗'} ${name}`); }
function eq(a, b, name) {
    const same = JSON.stringify(a) === JSON.stringify(b);
    if (!same) failed++;
    console.log(`${same ? '✓' : '✗'} ${name}${same ? '' : `\n    צפוי:  ${JSON.stringify(b)}\n    התקבל: ${JSON.stringify(a)}`}`);
}

// ─── חלק 1: הבלוק הטהור ─────────────────────────────────────────────────────
const ppSrc = read('photos-logic.js');
const block = ppSrc.split('PPRECEIPT-START')[1]?.split('PPRECEIPT-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('✗ בלוק PPRECEIPT לא נמצא ב-photos-logic.js'); process.exit(1); }
const P = new Function(block + '\nreturn { _ppNewestByDate, _ppLandedCopy, _ppRetryDelay, _ppSameDel };')();

const list = [
    { id: 'old', date: '2026-09-29', bytes: 180875, updated: '2026-09-29T05:41:31.100Z' },   // באשפה (התאריך נגע בזריקה)
    { id: 'live', date: '2026-09-29', bytes: 180875, updated: '2026-09-29T05:41:31.153Z' },
    { id: 'x', date: '2026-09-18', bytes: 195399, updated: '2026-09-18T05:03:09.961Z' },
    { date: '2026-09-07', bytes: 1 }   // בלי id — לא נחשב
];
eq(Object.keys(P._ppNewestByDate(list)).sort(), ['2026-09-18', '2026-09-29'], 'עותק אחד לכל תאריך, רק עם id');
eq(P._ppNewestByDate(list)['2026-09-29'].id, 'live', 'העותק העדכני הוא החי, לא זה שבאשפה');
eq(P._ppLandedCopy(list, '2026-09-29', 180875).id, 'live', 'קבלה: אותו תאריך ואותו גודל בדיוק');
eq(P._ppLandedCopy(list, '2026-09-29', 180876), null, 'גודל שונה (תמונה אחרת באותו יום) — אין קבלה');
eq(P._ppLandedCopy(list, '2026-09-29', 0), null, 'גודל לא ידוע — אין קבלה (עדיפה העלאה חוזרת)');
eq(P._ppLandedCopy(list, '2026-10-01', 5), null, 'תאריך שאין בדרייב — אין קבלה');
eq(P._ppLandedCopy([
    { id: 'a', date: '2026-10-02', bytes: 700, updated: '2026-10-02T05:00:00.000Z' },
    { id: 'b', date: '2026-10-02', bytes: 900, updated: '2026-10-02T06:00:00.000Z' }
], '2026-10-02', 700), null, 'עותק ישן באותו גודל לא נחשב — רק העדכני קובע');
eq([0, 1, 2, 3, 4, 9].map(P._ppRetryDelay), [20000, 20000, 60000, 180000, 600000, 600000], 'ניסיון חוזר: 20ש\', דקה, 3 דק\', ואז 10 דק\'');
ok(P._ppSameDel({ id: 'a' }, { id: 'a' }) && !P._ppSameDel({ id: 'a' }, { date: 'd', bytes: 1 }) &&
   P._ppSameDel({ date: 'd', bytes: 1 }, { date: 'd', bytes: 1 }), 'זהות מחיקה בתור: לפי id, או לפי תאריך+גודל');

// ─── חלק 2: _bridgeJson — הסיבה לפי השרת שהחזיר את הדף ─────────────────────────
const bridgeJson = new Function('return {' + read('storage.js').match(/    _bridgeJson\(r\) \{[\s\S]*?\n    \},/)[0] + '}')()._bridgeJson;
const DRIVE_404 = '<!DOCTYPE html><html lang="he"><head><meta charset="utf-8"><title>הדף לא נמצא</title>' +
    '<style>body{font-family:arial}</style><script nonce="n">var x=1;</script></head><body><div>Drive</div>' +
    '<p>מצטערים, לא ניתן לפתוח את הקובץ כרגע.&nbsp;יש לבדוק את הכתובת ולנסות שוב.</p></body></html>';
const ECHO = 'https://script.googleusercontent.com/macros/echo?user_content_key=k&lib=l';
const EXEC = 'https://script.google.com/macros/s/AKfy/exec';
const page = (status, url, html) => ({ status, url, text: async () => html,
    json: async () => { throw new SyntaxError('The string did not match the expected pattern.'); } });
const msgOf = async r => { try { await bridgeJson(r); return null; } catch (e) { return e.message; } };

(async () => {
    const lost = await msgOf(page(404, ECHO, DRIVE_404));
    ok(/הסקריפט רץ/.test(lost) && /googleusercontent/.test(lost), '404 מ-googleusercontent: "הסקריפט רץ והתשובה אבדה" + שם השרת');
    ok(!/Who has access/.test(lost), '...ולא "Who has access" (29.9: ההודעה שלחה לבדוק פריסה תקינה)');
    ok(/לא ניתן לפתוח את הקובץ כרגע\. יש לבדוק/.test(lost) && !/&nbsp;/.test(lost), 'הטקסט של הדף, עם &nbsp; מפוענח');
    const noDeploy = await msgOf(page(404, EXEC + '?token=SECRET123', DRIVE_404));
    ok(/לא מצא פריסה/.test(noDeploy) && /script\.google\.com/.test(noDeploy), '404 מ-script.google.com: אין פריסה בכתובת');
    ok(!/SECRET123/.test(noDeploy), 'ה-token מה-URL לא נכנס להודעה (רק שם השרת)');
    const busy = await msgOf({ status: 503, text: async () => '<!DOCTYPE html><html><body>Service Unavailable</body></html>' });
    ok(/503/.test(busy) && /זמנית/.test(busy), '503 בלי url: שגיאה זמנית, עם הקוד');
    ok(/שגיאה בסקריפט/.test(await msgOf(page(200, ECHO, '<!DOCTYPE html><html><body>TypeError: x (line 3)</body></html>'))),
        '200 עם דף HTML: שגיאה בסקריפט');
    eq(await bridgeJson({ status: 200, text: async () => '{"ok":true}' }), { ok: true }, 'JSON — מפוענח כרגיל');

    await part3(false);
    await part3(true);
    console.log(failed ? `\n✗ ${failed} בדיקות נכשלו` : '\n✓ כל הבדיקות עברו');
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

// ─── חלק 3: התור המלא מול הגשר האמיתי ─────────────────────────────────────────
async function part3(legacy) {
    console.log(legacy ? '\n— מול הגשר הפרוס (רשימה שכוללת את האשפה) —' : '\n— מול הגשר שבריפו —');
    function iter(arr) { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; }
    const drive = { files: [], folders: [], seq: 0, clock: 0, uploads: 0 };
    const tick = () => new Date(Date.UTC(2026, 8, 29, 5, 0, 0) + (++drive.clock) * 1000);
    function mkFile(name, bytes, parent) {
        const f = {
            id: 'p' + (++drive.seq), name, bytes: Buffer.from(bytes), parent, trashed: false, updated: tick(),
            getId() { return this.id; }, getName() { return this.name; }, getSize() { return this.bytes.length; },
            getLastUpdated() { return this.updated; }, isTrashed() { return this.trashed; },
            // הזריקה לאשפה נוגעת בתאריך העדכון — המקרה הקשה לבחירת "העדכני"
            setTrashed(t) { this.trashed = t; this.updated = tick(); },
            getMimeType() { return 'image/jpeg'; },
            getBlob() { const b = this.bytes; return { getBytes: () => Array.from(b) }; }
        };
        drive.files.push(f);
        return f;
    }
    function mkFolder(name) {
        const d = {
            id: 'd' + (++drive.seq), name,
            getId() { return this.id; }, isTrashed() { return false; },
            // כמו DriveApp האמיתי: גם קבצים שבאשפה
            getFiles() { return iter(drive.files.filter(f => f.parent === this.id)); },
            getFilesByName(n) { return iter(drive.files.filter(f => f.parent === this.id && f.name === n)); },
            createFile(blob) { drive.uploads++; return mkFile(blob.name, blob.bytes, this.id); }
        };
        drive.folders.push(d);
        return d;
    }
    const gas = {
        DriveApp: {
            getFoldersByName: n => iter(drive.folders.filter(x => x.name === n)),
            createFolder: mkFolder,
            getFileById: id => { const f = drive.files.find(x => x.id === id); if (!f) throw new Error('not found'); return f; }
        },
        PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k === 'SECRET_TOKEN' ? 'tok' : null), setProperty() {} }) },
        Utilities: {
            base64Decode: s => Array.from(Buffer.from(s, 'base64')),
            base64Encode: bytes => Buffer.from(bytes).toString('base64'),
            newBlob: (bytes, mime, name) => ({ bytes, mime, name }),
            computeDigest: (alg, s) => Array.from(require('crypto').createHash('sha256').update(s, 'utf8').digest()),
            DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }
        },
        ContentService: { createTextOutput: text => ({ text, setMimeType() { return this; } }), MimeType: { JSON: 'json' } }
    };
    // הגשר שפרוס אצל המשתמש לא מדלג על האשפה ברשימה — האפליקציה חייבת לעבוד מולו בלי עדכון
    let bridgeSrc = read('bridges/photo-bridge.gs');
    if (legacy) {
        const cut = bridgeSrc.replace(/\n\s*if \(f\.isTrashed\(\)\) continue;/, '');
        ok(cut !== bridgeSrc, 'גרסת הגשר הפרוסה נבנתה (הסינון של האשפה ב-_list הוסר)');
        bridgeSrc = cut;
    }
    const bridge = new Function(...Object.keys(gas), bridgeSrc + '\nreturn { doPost };')(...Object.values(gas));

    // הרשת: lose = הגשר ביצע והתשובה אבדה (404 של Drive בקפיצה השנייה, כמו ב-29.9);
    // dropBefore = הבקשה לא יצאה בכלל (אין רשת / iOS חתך) — הגשר לא ביצע
    const net = { lose: 0, dropBefore: 0, actions: [], during: null };
    async function fakeFetch(url, opt) {
        const body = JSON.parse(opt.body);
        net.actions.push(body.action);
        if (net.dropBefore > 0) { net.dropBefore--; throw new TypeError('Load failed'); }
        const out = bridge.doPost({ postData: { contents: opt.body }, parameter: {} });
        if (net.during) { const f = net.during; net.during = null; await f(); }
        if (net.lose > 0) { net.lose--; return page(404, ECHO, DRIVE_404); }
        return { status: 200, url: ECHO, text: async () => out.text, json: async () => JSON.parse(out.text) };
    }

    const ls = {};
    const idb = { photos: {}, thumbs: {} };
    const timers = [];
    const noop = () => {};
    let bridgeCfg = { on: true, url: EXEC, token: 'tok' };
    const ctx = {
        console: { log: noop, warn: noop, error: noop },
        window: { addEventListener: noop },
        document: { addEventListener: noop, getElementById: () => null, querySelector: () => null, visibilityState: 'visible' },
        navigator: { onLine: true },
        localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } },
        fetch: fakeFetch, AbortController, Buffer, atob, Blob, __idb: idb,
        // המתנות קצרות (עד 2ש') רצות מיד; טיימרים ארוכים (ניסיון חוזר, סנכרון config) נרשמים בלבד
        setTimeout: (fn, ms) => { if (!(ms > 2000)) { setImmediate(fn); return 0; } timers.push(ms); return timers.length; },
        clearTimeout: noop,
        StorageManager: {
            getPhotoBridge: () => bridgeCfg,
            getPhotoIndex: () => JSON.parse(ls.gympro_photo_index || '[]'),
            savePhotoIndex: idx => { ls.gympro_photo_index = JSON.stringify(idx); return true; },
            _bridgeJson: bridgeJson
        }
    };
    vm.createContext(ctx);
    vm.runInContext(ppSrc, ctx);
    // IndexedDB, דחיסה ו-FileReader מוחלפים — כל השאר הקוד האמיתי
    vm.runInContext(`
        _ppIdbGet = async (s, id) => __idb[s][id];
        _ppIdbPut = async (s, v) => { __idb[s][v.id] = v; };
        _ppIdbDel = async (s, id) => { delete __idb[s][id]; };
        _ppBlobToBase64 = async b => b.bytes.toString('base64');
        ppCompressPhoto = async src => ({ photo: { blob: src, w: 900, h: 1600 }, thumb: { size: 10 } });
        this.__pp = { up: _ppUp, fresh: _ppFresh, checked: _ppChecked, run: () => _ppQueueRun, kick: _ppKickUploads };
    `, ctx);

    const photo = (size, seed) => ({ size, bytes: Buffer.alloc(size, seed) });
    const idx = d => ctx.StorageManager.getPhotoIndex().find(e => e.date === d);
    const copies = d => drive.files.filter(f => f.name === d + '.jpg');
    const live = d => copies(d).find(f => !f.trashed);
    const settle = async () => { for (let i = 0; i < 6; i++) { await new Promise(r => setImmediate(r)); await ctx.__pp.run(); } };

    // ── 29.9: הגשר ביצע, התשובה אבדה ─────────────────────────────────────────
    const D1 = '2026-09-29';
    net.lose = 1;
    await ctx.ppStorePhoto(photo(180875, 1), { date: D1 });
    await settle();
    eq(copies(D1).length, 1, '29.9: הגשר ביצע את ההעלאה');
    ok(!idx(D1).driveId, 'התשובה אבדה → עדיין ממתינה (driveId לא נחרת בלי תשובה)');
    ok(/הסקריפט רץ/.test(ctx.__pp.up.lastError || ''), 'הסיבה נשמרת: הסקריפט רץ והתשובה אבדה');
    ok(/ניסיון אחרון .* נכשל: הסקריפט רץ/.test(ctx.ppUploadStatusText()), 'שורת המצב: ממתינה + הסיבה + "ינוסה שוב"');
    ok(timers.includes(20000), 'ניסיון חוזר אוטומטי בעוד 20ש\' — בלי לחכות לפתיחה הבאה');
    await ctx.__pp.kick();   // הטיימר / חזרה לאפליקציה
    await settle();
    eq(copies(D1).length, 1, 'הניסיון החוזר מברר ולא מעלה שוב (בקוד הקודם: העלאה שנייה + עותק באשפה)');
    eq(idx(D1).driveId, live(D1).id, 'הקבלה מהרשימה: driveId של הקובץ שבדרייב');
    eq(idb.photos[D1].driveId, live(D1).id, 'וגם ב-IDB');
    ok(!ctx.__pp.up.lastError && ctx.ppUploadStatusText() === '', 'השגיאה נמחקה ושורת המצב ריקה');

    // ── הבקשה לא יצאה בכלל — הבירור לא מוצא, ומעלים ──────────────────────────
    const D2 = '2026-09-30';
    net.dropBefore = 1;
    await ctx.ppStorePhoto(photo(5000, 2), { date: D2 });
    await settle();
    eq(copies(D2).length, 0, 'הבקשה לא יצאה — כלום בדרייב');
    ok(/נקטע/.test(ctx.__pp.up.lastError || ''), 'הסיבה: החיבור נקטע');
    await ctx.__pp.kick(); await settle();
    eq(copies(D2).length, 1, 'הבירור לא מצא → העלאה אחת');
    eq(idx(D2).driveId, live(D2).id, 'ממתינה → בענן');

    // ── המצב שנשאר במכשיר מ-29.9: ממתינה מסשן קודם, והקובץ כבר בדרייב פעמיים ────
    const D3 = '2026-10-01';
    const p3 = photo(180875, 3);
    const up = () => bridge.doPost({ postData: { contents: JSON.stringify({ token: 'tok', action: 'upload', date: D3, data: p3.bytes.toString('base64') }) } });
    up(); up();   // 08:31 ו-08:41 — השנייה זרקה את הראשונה לאשפה
    idb.photos[D3] = { id: D3, blob: p3 };
    ctx.StorageManager.savePhotoIndex(ctx.StorageManager.getPhotoIndex().concat([{ date: D3, driveId: null, bytes: p3.size }]));
    ctx.__pp.fresh.clear(); ctx.__pp.checked.clear();   // פתיחה חדשה של האפליקציה
    const before3 = drive.uploads;
    await ctx.__pp.kick(); await settle();
    eq(drive.uploads, before3, 'פתיחה ראשונה אחרי העדכון: בלי העלאה נוספת');
    eq(idx(D3).driveId, live(D3).id, 'מקושרת לעותק החי, לא לזה שבאשפה');

    // ── תמונה שהוחלפה: עותק ישן בדרייב אינו קבלה לתמונה החדשה ─────────────────
    const D4 = '2026-10-02';
    await ctx.ppStorePhoto(photo(7000, 4), { date: D4 }); await settle();
    net.dropBefore = 1;
    await ctx.ppStorePhoto(photo(7100, 5), { date: D4 }); await settle();
    await ctx.__pp.kick(); await settle();
    eq(live(D4).getSize(), 7100, 'צילום חוזר: החדשה בדרייב');
    eq(idx(D4).driveId, live(D4).id, 'והאינדקס מצביע עליה, לא על הקודמת');

    // ── הוחלפה בזמן שההעלאה שלה באוויר ────────────────────────────────────────
    const D5 = '2026-10-03';
    const p5b = photo(9100, 7);
    net.during = () => ctx.ppStorePhoto(p5b, { date: D5 });
    await ctx.ppStorePhoto(photo(9000, 6), { date: D5 });
    await settle();
    eq(idb.photos[D5].blob.size, 9100, 'ה-IDB לא נדרס בבתים של התמונה הקודמת');
    eq(live(D5).getSize(), 9100, 'החדשה עלתה בסיבוב שאחרי');
    eq(idx(D5).driveId, live(D5).id, 'והמזהה שלה — לא של הקודמת');

    // ── מחיקה שלא הגיעה לגשר: נשמרת, "סרוק דרייב" לא מחזיר, והבאה משלימה ──────────
    const D6 = '2026-10-04';
    await ctx.ppStorePhoto(photo(6000, 8), { date: D6 }); await settle();
    const id6 = idx(D6).driveId;
    net.dropBefore = 1;
    await ctx.ppDeletePhoto(D6); await settle();
    ok(!live(D6).trashed && /pp_drive_del_queue/.test(Object.keys(ls).join()), 'המחיקה לא הגיעה — נשמרת בתור (שורד סגירה)');
    const scan = await ctx.ppReconcileFromDrive();
    ok(!idx(D6), '"סרוק דרייב" לא מחזיר תמונה שהמחיקה שלה בתור');
    eq(scan.added, 0, '...ולא מוסיף כפילויות מהאשפה');
    await settle();
    ok(drive.files.find(f => f.id === id6).trashed, 'הניסיון הבא מוחק בדרייב');
    ok(!('gympro_pp_drive_del_queue' in ls), 'והתור מתרוקן');
    if (!legacy) {
        await ctx.ppReconcileFromDrive(); await settle();
        ok(!idx(D6), 'גשר מעודכן: "סרוק דרייב" לא מחזיר תמונה שנמחקה (האשפה לא ברשימה)');
    }

    // ── נמחקה כשעוד המתינה, אחרי שההעלאה נחתה בלי תשובה ────────────────────────
    const D7 = '2026-10-05';
    net.lose = 1;
    await ctx.ppStorePhoto(photo(6500, 9), { date: D7 }); await settle();
    ok(live(D7) && !idx(D7).driveId, 'נחתה בדרייב, ממתינה באפליקציה');
    await ctx.ppDeletePhoto(D7); await settle();
    ok(!live(D7), 'המחיקה מזהה את הקובץ לפי קבלה (תאריך + גודל) — לא נשאר יתום בדרייב');

    // ── "בדוק חיבור": POST (אותו מסלול כמו ההעלאה), ניסיון שני לתקלה חולפת ──────────
    net.actions.length = 0;
    net.lose = 1;
    const t = await ctx.ppTestPhotoBridge();
    eq(net.actions.slice(0, 2), ['list', 'list'], 'בדיקת החיבור ב-POST list, וניסיון שני אחרי תשובה שאבדה');
    ok(/הסקריפט רץ/.test(t.firstFail || ''), 'והיא מדווחת שהניסיון הראשון נכשל ולמה');
    // הגשר שבריפו: רק תאריכים עם עותק חי. הפרוס: גם תאריכים שכל העותקים שלהם באשפה (אין דרך לדעת)
    const dates = new Set(drive.files.filter(f => legacy || !f.trashed).map(f => f.name)).size;
    ok(t.files === dates && t.files < drive.files.length, `מונה תאריכים (${t.files}), לא עותקים (${drive.files.length})`);
    bridgeCfg = { on: false, url: EXEC, token: 'tok' };
    ok((await ctx.ppTestPhotoBridge()).files > 0, 'עובדת גם כשהמתג כבוי');
    bridgeCfg = { on: true, url: EXEC, token: 'wrong' };
    const bad = await ctx.ppTestPhotoBridge().catch(e => e);
    ok(bad.message === 'BAD_TOKEN' && bad.hint && !bad.uncertain, 'BAD_TOKEN: תשובה סופית מהגשר, עם hint, בלי ניסיון שני');
    bridgeCfg = { on: true, url: EXEC, token: 'tok' };

    // ── הצגת תמונה מהדרייב (העותק המקומי נמחק ע"י iOS) — ניסיון שני ─────────────
    delete idb.photos[D1];
    net.lose = 1;
    const blob = await ctx.ppGetPhotoBlob(D1);
    ok(blob && blob.size === 180875, 'משיכה מהדרייב: תשובה שאבדה → ניסיון שני מביא את התמונה');

    // ── בלי גשר מוגדר: תמונה שלא הועלתה נמחקת מקומית בלי להיכנס לתור הדרייב ────────
    bridgeCfg = { on: false, url: '', token: '' };
    await ctx.ppStorePhoto(photo(4000, 10), { date: '2026-10-06' }); await settle();
    await ctx.ppDeletePhoto('2026-10-06'); await settle();
    ok(!('gympro_pp_drive_del_queue' in ls), 'אין גשר → אין מחיקה בתור (לא נצבר זבל מקומי)');
}
