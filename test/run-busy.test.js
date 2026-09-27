/* ============================================================================
 * test/run-busy.test.js — runBusy: נעילת פעולה ארוכה + שחזור הכפתור
 * הרצה: node test/run-busy.test.js   (ללא תלויות, ללא build)
 *
 * לפני runBusy כפתורים כמו "בדוק חיבור" לא נתנו פידבק ולא ננעלו — לחיצה
 * חוזרת הפעילה את הפעולה שוב במקביל. הבדיקה נטענת מסמני RUN-BUSY-START/END.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'workout-core.js'), 'utf8');
const block = src.split('RUN-BUSY-START')[1]?.split('RUN-BUSY-END')[0]?.replace(/^[^\n]*\n/, '');
if (!block) { console.error('FAIL: RUN-BUSY block not found'); process.exit(1); }

let hidden = 0;
const runBusy = new Function('console', 'hideCloudToastIfPending', block + '\nreturn runBusy;')(
    { error() {} }, () => { hidden++; });

function fakeBtn(text) {
    const cls = new Set(), attrs = {};
    return {
        textContent: text, disabled: false,
        querySelector: () => null,
        classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) },
        setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: k => { delete attrs[k]; }
    };
}

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.error('FAIL:', msg); } };

(async () => {
    // 1. לחיצה כפולה → הפעולה רצה פעם אחת; הכפתור מושבת ומוחזר
    let calls = 0, release;
    function testBridge() { calls++; return new Promise(r => { release = r; }); }
    const btn = fakeBtn('בדוק חיבור');
    const p1 = runBusy(btn, 'בודק…', testBridge);
    ok(btn.disabled && btn.textContent === 'בודק…' && btn.classList.contains('is-busy'), 'busy state applied');
    runBusy(fakeBtn('x'), 'בודק…', testBridge);           // כפתור אחר, אותה פעולה
    ok(calls === 1, 'second tap ignored while in flight (calls=' + calls + ')');
    release(); await p1;
    ok(!btn.disabled && btn.textContent === 'בדוק חיבור' && !btn.classList.contains('is-busy'), 'button restored');
    ok(hidden === 1, 'pending toast cleared at end');

    // 2. כשל → הכפתור משוחזר והנעילה משתחררת
    function failing() { calls++; return Promise.reject(new Error('net')); }
    const b2 = fakeBtn('שלח');
    await runBusy(b2, 'שולח…', failing);
    ok(!b2.disabled && b2.textContent === 'שלח', 'restored after rejection');
    await runBusy(b2, 'שולח…', failing);
    ok(calls === 3, 'lock released after failure');

    // 3. זריקה סינכרונית + btn=null + העברת ארגומנטים
    function throwing() { throw new Error('boom'); }
    await runBusy(null, '', throwing);
    let got; function withArg(ts) { got = ts; }
    await runBusy(null, '', withArg, 42);
    ok(got === 42, 'args forwarded');

    if (fails) process.exit(1);
    console.log('run-busy: all passed');
})();
