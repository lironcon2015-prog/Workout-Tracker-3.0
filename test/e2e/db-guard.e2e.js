/* ============================================================================
 * test/e2e/db-guard.e2e.js — הגנת טעינת התוכניות: 6 תרחישים בדפדפן אמיתי (Chromium)
 * האירוע של 25.9.2026: קריאה ריקה בפתיחה → ברירות מחדל נשמרו מעל התוכניות → נדחפו לענן.
 * הרצה: python3 -m http.server 8765 &  ואז  PW=$(npm root -g)/playwright node test/e2e/db-guard.e2e.js
 * ==========================================================================*/
const { chromium } = require(process.env.PW || 'playwright');
const URL = 'http://localhost:8765/index.html';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
async function launch(b, seed) {
  const ctx = await b.newContext({ serviceWorkers: 'block' });
  if (seed) await ctx.addInitScript(d => { if (!sessionStorage.getItem('__s')) { localStorage.clear(); const o = JSON.parse(d); for (const k in o) if (o[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, o[k]); sessionStorage.setItem('__s', '1'); } }, JSON.stringify(seed));
  const p = await ctx.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  return { ctx, p };
}
const info = p => p.evaluate(() => ({
  suspect: StorageManager._dbSuspect, wo: localStorage.getItem('gympro_db_workouts'), ex: localStorage.getItem('gympro_db_exercises'),
  bad: localStorage.getItem('gympro_db_workouts__bad'), mem: Object.keys(state.workouts),
  confirm: getComputedStyle(document.getElementById('custom-confirm-modal')).display !== 'none',
  msg: document.getElementById('custom-confirm-msg').textContent
}));
(async () => {
  const b = await chromium.launch();
  // real user state: build from a normal boot, then add custom plan + archive
  let { ctx, p } = await launch(b);
  await p.evaluate(() => {
    state.workouts['MY PLAN'] = [{ name: 'Bench Press (Main)', sets: 3 }];
    StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);
    StorageManager.saveData(StorageManager.KEY_ARCHIVE, [{ date: '25.09.26', type: 'MY PLAN', timestamp: 1 }]);
  });
  const base = await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  await ctx.close();
  const baseObj = JSON.parse(base);

  console.log('— רגיל');
  ({ ctx, p } = await launch(b, baseObj)); let s = await info(p);
  ok(!s.suspect && s.mem.includes('MY PLAN') && !s.confirm, 'פתיחה רגילה: התוכניות נטענות, בלי הודעה');
  ok(await p.evaluate(async () => { FirebaseManager._isSyncArmed = () => true; FirebaseManager._ensureReady = async () => false; const r = await FirebaseManager.saveConfigToCloud(); return r !== 'skipped'; }), 'פתיחה רגילה: העלאת קונפיג לא נחסמת ע"י ההגנה');
  await ctx.close();

  console.log('— האירוע של 25.9: מפתח התוכניות חסר, ארכיון קיים');
  ({ ctx, p } = await launch(b, Object.assign({}, baseObj, { gympro_db_workouts: null }))); s = await info(p);
  ok(s.wo === null, 'ברירות המחדל לא נשמרו למפתח');
  ok(s.suspect && s.suspect.keys.includes('gympro_db_workouts'), 'מסומן כחשוד');
  ok(s.confirm && s.msg.includes('התוכניות') && s.msg.includes('ייבוא תבנית'), 'הודעה עם סיבה ודרך שחזור');
  ok(await p.evaluate(async () => { FirebaseManager._isSyncArmed = () => true; let touched = false; FirebaseManager._markSyncPending = () => { touched = true; }; const r = await FirebaseManager.saveConfigToCloud(); return r === 'skipped' && !touched; }), 'העלאת קונפיג לענן נחסמת (גם כשהסנכרון חמוש)');
  ok(await p.evaluate(() => { let built = false; StorageManager.buildFullBackup = () => { built = true; return {}; }; StorageManager.maybeSendWeeklyBackup(true); return !built; }), 'גיבוי שבועי לא נבנה ולא נשלח');
  await ctx.close();

  console.log('— ערך פגום');
  ({ ctx, p } = await launch(b, Object.assign({}, baseObj, { gympro_db_workouts: '{"MY PLAN": [' }))); s = await info(p);
  ok(s.wo === '{"MY PLAN": [', 'הערך הפגום לא נדרס');
  ok(s.bad === '{"MY PLAN": [', 'עותק נשמר בצד');
  ok(s.confirm && s.msg.includes('פגום'), 'ההודעה אומרת שהערך פגום');
  await ctx.close();
  ({ ctx, p } = await launch(b, Object.assign({}, baseObj, { gympro_db_workouts: '{"MY PLAN": [', 'gympro_db_workouts__bad': '{"MY PLAN": [' })));
  ok((await p.evaluate(() => Object.keys(localStorage).filter(k => k.includes('__bad')).length)) === 1, 'פתיחה חוזרת לא יוצרת עוד עותקים');
  await ctx.close();

  console.log('— התקנה טרייה');
  ({ ctx, p } = await launch(b, {})); s = await info(p);
  ok(!s.suspect && s.wo && JSON.parse(s.wo)['חזה - כתפיים'] && !s.confirm, 'התקנה טרייה: ברירות מחדל נשמרות, בלי הודעה');
  ok(s.mem.includes('שדו בוקסינג'), 'התקנה טרייה: זריעת האירובי רצה');
  await ctx.close();

  console.log('— שחזור אחרי האירוע (ייבוא תבנית) מחזיר למצב רגיל');
  ({ ctx, p } = await launch(b, Object.assign({}, baseObj, { gympro_db_workouts: null })));
  await p.click('#custom-confirm-cancel'); await p.waitForTimeout(200);
  await p.evaluate(() => { StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, { 'MY PLAN': [{ name: 'Bench Press (Main)' }] }); });
  await p.reload(); await p.waitForTimeout(1500); s = await info(p);
  ok(!s.suspect && s.mem.includes('MY PLAN') && !s.confirm, 'אחרי כתיבת תוכניות תקינות — הפתיחה הבאה רגילה');
  ok(p._errs.length === 0, 'אין שגיאות JS ' + p._errs.join('|'));
  await ctx.close();
  await b.close();
  console.log(`\n${pass} עברו, ${fail} נכשלו`); if (fail) process.exit(1);
})();
