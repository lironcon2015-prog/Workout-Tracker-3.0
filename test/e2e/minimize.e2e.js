/* ============================================================================
 * test/e2e/minimize.e2e.js — מזעור אימון פעיל: 17 תסריטים בדפדפן אמיתי (Chromium)
 * לא חלק מ-test/*.test.js (דורש Playwright). הרצה:
 *   python3 -m http.server 8765 &   (משורש הריפו)
 *   PW=$(npm root -g)/playwright node test/e2e/minimize.e2e.js
 * כל תסריט בודק שהלוג זהה לפני ואחרי. "הריגה" = העתקת localStorage להקשר חדש בלי sessionStorage.
 * ==========================================================================*/
const { chromium } = require(process.env.PW || 'playwright');
const URL = 'http://localhost:8765/index.html';
let pass = 0, fail = 0; const failures = [];
function ok(c, name) { if (c) pass++; else { fail++; failures.push(name); } console.log(`${c ? '✓' : '✗'} ${name}`); }
const STR = 'חזה - כתפיים', CARDIO = 'שדו בוקסינג';

async function fresh(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  p._errs = [];
  p.on('pageerror', e => p._errs.push(e.message));
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  return { ctx, p };
}
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const snap = p => ev(p, () => ({
  screen: _activeScreenId(), stack: state.historyStack.slice(), min: !!state.minimized,
  log: JSON.stringify(state.log), logLen: state.log.length, live: document.body.classList.contains('live-mode-active'),
  bodyMin: document.body.classList.contains('workout-minimized'),
  pill: getComputedStyle(document.getElementById('min-pill')).display !== 'none',
  pillSub: document.getElementById('min-pill-sub').textContent,
  pillDone: document.getElementById('min-pill').classList.contains('is-done'),
  tabBar: getComputedStyle(document.querySelector('.tab-bar')).display !== 'none',
  settings: getComputedStyle(document.getElementById('btn-settings')).display !== 'none',
  timer: !!state.timerInterval, seconds: state.seconds,
  stored: (() => { const s = JSON.parse(localStorage.getItem('gympro_current_session') || 'null'); return s ? { min: s.state.minimized, stack: s.state.historyStack, logLen: s.state.log.length } : null; })(),
  confirmOpen: getComputedStyle(document.getElementById('custom-confirm-modal')).display !== 'none',
  alertOpen: getComputedStyle(document.getElementById('custom-alert-modal')).display !== 'none',
}));

async function startStrength(p, sets = 1) {
  await ev(p, (t) => { selectWeek(1); selectWorkout(t); }, STR);
  await p.waitForTimeout(300);
  await ev(p, () => confirmExercise(true));
  await p.waitForTimeout(400);
  if ((await ev(p, () => _activeScreenId())) === 'ui-1rm') { await ev(p, () => save1RM()); await p.waitForTimeout(400); }
  for (let i = 0; i < sets; i++) { await ev(p, () => nextStep()); await p.waitForTimeout(250); }
}
async function uiMinimize(p) {
  const live = await ev(p, () => document.body.classList.contains('live-mode-active'));
  await p.click(live ? '#live-menu-btn' : '#btn-workout-menu');
  await p.waitForTimeout(150);
  await p.click('#wq-minimize-item');
  await p.waitForTimeout(400);
}
async function kill(b, ctx, p) {
  await ev(p, () => _persistOnTeardown());
  const dump = await ev(p, () => JSON.stringify(Object.assign({}, localStorage)));
  await ctx.close();
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx2.addInitScript(d => { if (!sessionStorage.getItem('__seeded')) { const o = JSON.parse(d); for (const k in o) localStorage.setItem(k, o[k]); sessionStorage.setItem('__seeded', '1'); } }, dump);
  const p2 = await ctx2.newPage(); p2._errs = []; p2.on('pageerror', e => p2._errs.push(e.message));
  await p2.goto(URL, { waitUntil: 'domcontentloaded' }); await p2.waitForTimeout(1500);
  return { ctx: ctx2, p: p2 };
}
async function clickPill(p) { await p.click('#min-pill'); await p.waitForTimeout(400); }
async function tabs(p) { for (const t of ['archive', 'analytics', 'bodylog', 'workout']) { await p.click('#tabbtn-' + t); await p.waitForTimeout(250); } }

(async () => {
  const b = await chromium.launch();
  let ctx, p, s, before;

  console.log('\n— S1 מזעור מ-Live במנוחה, מעבר בכל הטאבים, חזרה דרך הפס');
  ({ ctx, p } = await fresh(b));
  await startStrength(p, 1);
  before = await snap(p);
  ok(before.screen === 'ui-main' && before.live && before.logLen === 1, 'מצב פתיחה: Live במסך התרגיל עם סט אחד');
  await uiMinimize(p);
  s = await snap(p);
  ok(s.screen === 'ui-week' && s.min && s.bodyMin && s.pill, 'אחרי מזעור: בבית, הפס מוצג');
  ok(!s.live, 'Live נסגר במזעור');
  ok(s.tabBar && !s.settings, 'סרגל הטאבים מוצג, ההגדרות מוסתרות');
  ok(s.timer, 'טיימר המנוחה ממשיך לרוץ');
  ok(s.stored && s.stored.min && s.stored.min.stack.slice(-1)[0] === 'ui-main', 'השמירה בצד נכתבה ל-localStorage לפני היציאה');
  ok(s.log === before.log, 'הלוג זהה אחרי מזעור');
  const sec1 = s.seconds; await tabs(p); await p.waitForTimeout(1200);
  s = await snap(p);
  ok(s.seconds > sec1, 'טיימר המנוחה ממשיך לספור בזמן מעבר בין טאבים');
  ok(s.pill && s.min, 'הפס נשאר אחרי מעבר בכל הטאבים');
  await clickPill(p);
  s = await snap(p);
  ok(s.screen === 'ui-main' && s.live && !s.min && !s.bodyMin && !s.pill, 'חזרה: מסך התרגיל ב-Live, בלי פס');
  ok(JSON.stringify(s.stack) === JSON.stringify(before.stack), 'ערימת הניווט זהה למקור');
  ok(s.log === before.log && s.timer, 'הלוג זהה והטיימר רץ אחרי החזרה');
  ok(!s.tabBar, 'סרגל הטאבים מוסתר שוב באימון');
  ok(p._errs.length === 0, 'אין שגיאות JS (S1) ' + p._errs.join('|'));
  await ctx.close();

  console.log('\n— S2 מזעור כפול');
  ({ ctx, p } = await fresh(b));
  await startStrength(p, 1);
  before = await snap(p);
  await ev(p, () => { minimizeWorkout(); minimizeWorkout(); });
  await p.click('#tabbtn-archive'); await p.waitForTimeout(200);
  await ev(p, () => minimizeWorkout());
  await clickPill(p);
  s = await snap(p);
  ok(s.screen === 'ui-main' && JSON.stringify(s.stack) === JSON.stringify(before.stack), 'מזעור כפול/משולש לא דרס את ערימת האימון');
  await ctx.close();

  console.log('\n— S3 "הריגה" בזמן מזעור (הפעלה טרייה: sessionStorage נמחק)');
  ({ ctx, p } = await fresh(b));
  await startStrength(p, 2);
  before = await snap(p);
  await uiMinimize(p); await p.click('#tabbtn-archive'); await p.waitForTimeout(300);
  ({ ctx, p } = await kill(b, ctx, p));
  const modal = await ev(p, () => getComputedStyle(document.getElementById('recovery-modal')).display !== 'none');
  ok(modal, 'חלון "נמצא אימון פעיל" מופיע');
  await p.click('text=כן, המשך אימון'); await p.waitForTimeout(600);
  s = await snap(p);
  ok(s.screen === 'ui-main', 'השחזור נוחת במסך התרגיל, לא בארכיון');
  ok(s.log === before.log && s.logLen === 2, 'שני הסטים שרדו');
  ok(!s.min && !s.pill, 'אין מצב ממוזער אחרי שחזור');
  ok(JSON.stringify(s.stack) === JSON.stringify(before.stack), 'ערימת האימון שוחזרה במלואה');
  ok(p._errs.length === 0, 'אין שגיאות JS (S3) ' + p._errs.join('|'));
  await ctx.close();

  console.log('\n— S4 רענון לא רצוני בזמן מזעור (sessionStorage שורד)');
  ({ ctx, p } = await fresh(b));
  await startStrength(p, 1);
  before = await snap(p);
  await uiMinimize(p); await p.click('#tabbtn-bodylog'); await p.waitForTimeout(300);
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  s = await snap(p);
  ok(s.screen === 'ui-main' && s.log === before.log, 'שחזור שקט חוזר לאימון עם הלוג');
  ok(!s.min && !s.bodyMin && !s.pill, 'בלי שאריות מזעור אחרי הרענון');
  await ctx.close();

  console.log('\n— S5 התחלת אימון חדש בזמן מזעור');
  ({ ctx, p } = await fresh(b));
  await startStrength(p, 1);
  before = await snap(p);
  await uiMinimize(p);
  await p.click('.wk-card-1'); await p.waitForTimeout(300);
  s = await snap(p);
  ok(s.confirmOpen && s.screen === 'ui-week', 'לחיצה על שבוע 1: הודעת חסימה, לא עוברים לבחירת אימון');
  ok(s.log === before.log && s.min, 'הלוג לא נמחק והאימון עדיין ממוזער');
  await p.click('#custom-confirm-cancel'); await p.waitForTimeout(200);
  await ev(p, (t) => { selectWorkout(t); startFreestyle(); startCardio('שדו בוקסינג'); }, STR);
  await p.waitForTimeout(200);
  s = await snap(p);
  ok(s.log === before.log && s.min && s.screen === 'ui-week', 'selectWorkout/startFreestyle/startCardio חסומים ישירות');
  await p.click('#custom-confirm-ok'); await p.waitForTimeout(400);
  s = await snap(p);
  ok(s.screen === 'ui-main' && !s.min && s.log === before.log, '"כן" בהודעת החסימה מחזיר לאימון');
  await ctx.close();

  console.log('\n— S6 הגדרות וחזור בזמן מזעור');
  ({ ctx, p } = await fresh(b));
  await startStrength(p, 1);
  before = await snap(p);
  await uiMinimize(p);
  await ev(p, () => { openSettings(); handleBackClick(); handleBackClick(); });
  await p.waitForTimeout(300);
  s = await snap(p);
  ok(s.screen === 'ui-week' && s.min && s.log === before.log, 'openSettings חסום, "חזור" בבית לא נוטש את האימון');
  await ctx.close();

  console.log('\n— S7 סוף מנוחה בזמן מזעור');
  ({ ctx, p } = await fresh(b));
  await startStrength(p, 1);
  await ev(p, () => resetAndStartTimer(2));
  await uiMinimize(p);
  s = await snap(p);
  ok(/^מנוחה \d\d:\d\d$/.test(s.pillSub), 'הפס מציג ספירת מנוחה: ' + s.pillSub);
  await p.waitForTimeout(2600);
  s = await snap(p);
  ok(s.pillDone && s.pillSub === 'המנוחה הסתיימה', 'בסוף המנוחה הפס מסמן "המנוחה הסתיימה"');
  await clickPill(p);
  s = await snap(p);
  ok(s.screen === 'ui-main' && s.live, 'חזרה אחרי סוף מנוחה');
  await ctx.close();

  console.log('\n— S8 מזעור ממסך מנוחת סבב (cluster) — הטיימר לא נהרג בחזרה');
  ({ ctx, p } = await fresh(b));
  await startStrength(p, 1);
  await ev(p, () => { exitWorkoutLiveMode(true); navigate('ui-cluster-rest'); resetAndStartTimer(30); });
  await p.waitForTimeout(300);
  await uiMinimize(p);
  s = await snap(p);
  ok(s.min && s.timer, 'ממוזער ממנוחת סבב, הטיימר רץ');
  await clickPill(p);
  s = await snap(p);
  ok(s.screen === 'ui-cluster-rest' && s.timer, 'חזרה למנוחת הסבב — הטיימר עדיין רץ');
  await ctx.close();

  console.log('\n— S9 מזעור ממסך אישור התרגיל (בין תרגילים)');
  ({ ctx, p } = await fresh(b));
  await ev(p, (t) => { selectWeek(1); selectWorkout(t); }, STR); await p.waitForTimeout(300);
  s = await snap(p);
  ok(s.screen === 'ui-confirm', 'מצב פתיחה: מסך אישור');
  await uiMinimize(p);
  ok((await snap(p)).min, 'ממוזער מאישור');
  await clickPill(p);
  ok((await snap(p)).screen === 'ui-confirm', 'חזרה למסך האישור');
  await ctx.close();

  console.log('\n— S10 אירובי בסבבים שמסתיים בזמן מזעור');
  ({ ctx, p } = await fresh(b));
  const archBefore = await ev(p, () => (StorageManager.getArchive() || []).length);
  await ev(p, (t) => { selectWeek(1); selectWorkout(t); }, CARDIO); await p.waitForTimeout(300);
  await ev(p, () => { Object.assign(state.cardio, { rounds: 2, workSec: 2, restSec: 1, prepSec: 1 }); startCardioSession(); });
  await p.waitForTimeout(400);
  s = await snap(p);
  ok(s.screen === 'ui-cardio', 'אירובי רץ');
  await uiMinimize(p);
  s = await snap(p);
  ok(s.min && /סבב|היכון/.test(s.pillSub), 'הפס מציג פאזה של אירובי: ' + s.pillSub);
  await p.click('#tabbtn-archive');
  await p.waitForTimeout(7500);
  s = await snap(p);
  ok(s.screen === 'ui-summary', 'בסיום האירובי: מסך הסיכום');
  ok(!s.min && !s.bodyMin && !s.pill, 'השמירה בצד בוטלה והפס ירד');
  const archAfter = await ev(p, () => (StorageManager.getArchive() || []).length);
  ok(archAfter === archBefore + 1, 'האימון נשמר לארכיון פעם אחת');
  ok(p._errs.length === 0, 'אין שגיאות JS (S10) ' + p._errs.join('|'));
  await ctx.close();

  console.log('\n— S11 אירובי ממוזער וחזרה באמצע');
  ({ ctx, p } = await fresh(b));
  await ev(p, (t) => { selectWeek(1); selectWorkout(t); }, CARDIO); await p.waitForTimeout(300);
  await ev(p, () => { Object.assign(state.cardio, { rounds: 5, workSec: 60, restSec: 10, prepSec: 1 }); startCardioSession(); });
  await p.waitForTimeout(1600);
  await uiMinimize(p); await p.click('#tabbtn-bodylog'); await p.waitForTimeout(800);
  const phaseMin = await ev(p, () => state.cardio.phase);
  await clickPill(p);
  s = await snap(p);
  ok(s.screen === 'ui-cardio' && phaseMin === 'work', 'חזרה לאירובי באמצע סבב עבודה');
  ok(await ev(p, () => !!_cardioTimer), 'טיימר האירובי רץ');
  await ctx.close();

  console.log('\n— S12 שינוי "מהשעון" בזמן מזעור');
  ({ ctx, p } = await fresh(b));
  await startStrength(p, 1);
  await uiMinimize(p);
  await ev(p, () => { state.log.push(Object.assign({}, state.log[0], { setId: 'w_x', r: 5 })); });
  await clickPill(p);
  s = await snap(p);
  ok(s.screen === 'ui-main' && s.logLen === 2 && p._errs.length === 0, 'חזרה אחרי סט מהשעון: רענון בלי שגיאות');
  await ctx.close();

  console.log('\n— S13 שמירה נכשלת (אחסון מלא)');
  ({ ctx, p } = await fresh(b));
  await startStrength(p, 1);
  await ev(p, () => { window.__orig = StorageManager.saveData; StorageManager.saveData = function (k, d) { if (k === this.KEY_SESSION) return false; return window.__orig.call(this, k, d); }; });
  await uiMinimize(p);
  s = await snap(p);
  ok(s.screen === 'ui-main' && !s.min && s.alertOpen, 'לא ממזער, מציג הודעה עם הסיבה, נשאר באימון');
  await ctx.close();

  console.log('\n— S14 מסך קלאסי, Live כבוי');
  ({ ctx, p } = await fresh(b));
  await ev(p, () => { toggleClassicScreen(true); toggleLiveMode(false); });
  await startStrength(p, 1);
  s = await snap(p);
  ok(s.screen === 'ui-main' && !s.live, 'מצב פתיחה: מסך קלאסי');
  await uiMinimize(p);
  ok((await snap(p)).min, 'ממוזער מהמסך הקלאסי (דרך תפריט הפס)');
  await clickPill(p);
  s = await snap(p);
  ok(s.screen === 'ui-main' && !s.live, 'חזרה למסך הקלאסי בלי Live');
  await ctx.close();

  console.log('\n— S15 פריט "מזער" לא מוצג כשאסור');
  ({ ctx, p } = await fresh(b));
  await ev(p, (t) => { selectWeek(1); selectWorkout(t); }, CARDIO); await p.waitForTimeout(300);
  await p.click('#btn-workout-menu'); await p.waitForTimeout(150);
  ok(!(await p.isVisible('#wq-minimize-item')), 'מסך ההכנה לאירובי: אין "מזער"');
  await ctx.close();

  console.log('\n— S16 מחזור מלא: מזעור → חזרה → עוד סט → מזעור → הריגה → שחזור');
  ({ ctx, p } = await fresh(b));
  await startStrength(p, 1);
  await uiMinimize(p); await clickPill(p);
  await ev(p, () => nextStep()); await p.waitForTimeout(300);
  before = await snap(p);
  await uiMinimize(p); await p.click('#tabbtn-analytics'); await p.waitForTimeout(300);
  ({ ctx, p } = await kill(b, ctx, p));
  await p.click('text=כן, המשך אימון'); await p.waitForTimeout(600);
  s = await snap(p);
  ok(s.screen === 'ui-main' && s.log === before.log && s.logLen === 2, 'שני סטים שרדו מחזור מלא');
  await ctx.close();

  console.log('\n— S17 אחרי אימון שהסתיים — אימון חדש מתחיל כרגיל');
  ({ ctx, p } = await fresh(b));
  await startStrength(p, 1);
  await uiMinimize(p); await clickPill(p);
  await ev(p, () => { _abandonWorkout(); navigate('ui-week', true); });
  await p.waitForTimeout(300);
  await ev(p, (t) => { selectWeek(1); selectWorkout(t); }, STR); await p.waitForTimeout(300);
  s = await snap(p);
  ok(s.screen === 'ui-confirm' && !s.confirmOpen && !s.min, 'אין חסימה ואין שמירה ישנה');
  await ctx.close();

  await b.close();
  console.log(`\n${pass} עברו, ${fail} נכשלו`);
  if (fail) { console.log('נכשלו:\n' + failures.join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(2); });
