/* ============================================================================
 * test/e2e/editor.e2e.js — עורך התוכניות v2: 33 בדיקות בדפדפן אמיתי (Chromium)
 * בודק שהדאטה שנשמרת זהה במבנה לגרסה הקודמת (אין שדות חדשים), ערכים ידניים,
 * גרירה, בחירה מרובה, החלפה, "מתי מוצג", אירובי, יצירת תרגיל, ושחלון היעדים באימון לא נפגע.
 * הרצה: python3 -m http.server 8765 &  ואז  PW=$(npm root -g)/playwright node test/e2e/editor.e2e.js
 * ==========================================================================*/
const { chromium } = require(process.env.PW || 'playwright');
const URL = 'http://localhost:8765/index.html';
let pass = 0, fail = 0; const fails = [];
const ok = (c, n) => { c ? pass++ : (fail++, fails.push(n)); console.log((c ? '✓ ' : '✗ ') + n); };
async function fresh(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', hasTouch: false });
  const p = await ctx.newPage(); p._errs = [];
  p.on('pageerror', e => p._errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1300);
  return { ctx, p };
}
const ev = (p, f, a) => p.evaluate(f, a);
const stored = (p, k) => ev(p, k => JSON.parse(localStorage.getItem(k)), k);
const PLAN = 'חזה - כתפיים';
async function typeFv(p, id, mm, ss, num) {
  await ev(p, id => fvOpen(id), id); await p.waitForTimeout(80);
  if (num !== undefined) await p.fill('#fv-input', String(num));
  else { await p.fill('#fv-mm', String(mm)); await p.fill('#fv-ss', String(ss)); }
  await p.click('.fv-actions .ed-btn--pri'); await p.waitForTimeout(80);
}
async function drag(p, sel, dy) {
  const h = await p.$(sel); const bx = await h.boundingBox();
  const x = bx.x + bx.width / 2, y = bx.y + bx.height / 2;
  await p.mouse.move(x, y); await p.mouse.down();
  for (let i = 1; i <= 8; i++) { await p.mouse.move(x, y + dy * i / 8); await p.waitForTimeout(16); }
  await p.mouse.up(); await p.waitForTimeout(150);
}

(async () => {
  const b = await chromium.launch();
  let { ctx, p } = await fresh(b);
  const orig = await ev(p, k => JSON.parse(JSON.stringify(state.workouts[k])), PLAN);

  console.log('— פתיחה וחזרה בלי שינוי');
  await ev(p, k => { openWorkoutManager(); editWorkout(k); }, PLAN);
  let s = await ev(p, () => ({ dis: document.getElementById('ed-save-btn').disabled, dirty: _edIsDirty() }));
  ok(s.dis && !s.dirty, 'תוכנית קיימת בלי שינוי: "שמור" מושבת');
  await ev(p, () => handleBackClick()); await p.waitForTimeout(200);
  s = await ev(p, () => ({ screen: _activeScreenId(), confirm: getComputedStyle(document.getElementById('custom-confirm-modal')).display !== 'none' }));
  ok(s.screen === 'ui-workout-manager' && !s.confirm, 'חזרה בלי שינוי — בלי שאלת "לצאת בלי לשמור"');

  console.log('— גיליון תרגיל: ערכים ידניים');
  await ev(p, k => editWorkout(k), PLAN);
  await ev(p, () => edOpenExSheet(1));
  await typeFv(p, 'ex-rest', 1, 45);
  ok((await ev(p, () => managerState.exercises[1].restTime)) === 105, 'מנוחה ידנית 1:45 → restTime 105');
  await ev(p, () => fvOpen('ex-rest')); await p.fill('#fv-mm', '15'); await p.fill('#fv-ss', '0'); await p.click('.fv-actions .ed-btn--pri'); await p.waitForTimeout(80);
  s = await ev(p, () => ({ err: document.getElementById('fv-err').textContent, open: document.getElementById('fv-overlay').style.display, v: managerState.exercises[1].restTime }));
  ok(s.open === 'flex' && /10:00/.test(s.err) && s.v === 105, 'מנוחה 15:00 נדחית עם סיבה, הערך לא משתנה');
  await ev(p, () => fvClose());
  await typeFv(p, 'ex-tw', 0, 0, '42,5');
  await typeFv(p, 'ex-tr', 0, 0, 8);
  await typeFv(p, 'ex-trir', 0, 0, 1.5);
  await typeFv(p, 'ex-sets', 0, 0, 5);
  s = await ev(p, () => managerState.exercises[1]);
  ok(s.targetWeight === 42.5 && s.targetReps === 8 && s.targetRIR === 1.5 && s.sets === 5, 'יעד 42.5×8 RIR 1.5 ו-5 סטים נשמרו כמספרים');
  await ev(p, () => edToggleDrop()); await typeFv(p, 'ex-drop', 0, 0, 25);
  s = await ev(p, () => managerState.exercises[1]);
  ok(s.dropSet === true && s.dropPct === 25, 'דרופ 25%');
  await ev(p, () => fvOpen('ex-tw')); await p.click('#fv-clear'); await p.waitForTimeout(80);
  ok((await ev(p, () => managerState.exercises[1].targetWeight)) === undefined, '"ללא" מנקה יעד משקל');
  ok((await ev(p, () => !document.getElementById('ed-save-btn').disabled && _edIsDirty())), '"שמור" נפתח אחרי שינוי');
  await ev(p, () => edCloseSheets());

  console.log('— סידור בגרירה');
  const namesBefore = await ev(p, () => managerState.exercises.map(x => x.name));
  await ev(p, () => edToggleReorder()); await p.waitForTimeout(100);
  await drag(p, '#editor-list > .ed-drag-item:nth-child(1) .ed-handle', 150);
  const namesAfter = await ev(p, () => managerState.exercises.map(x => x.name));
  ok(namesAfter[0] !== namesBefore[0] && namesAfter.slice().sort().join() === namesBefore.slice().sort().join(), 'גרירה שינתה סדר בלי לאבד תרגיל: ' + namesAfter.slice(0, 3).join(' | '));
  await ev(p, () => edToggleReorder());

  console.log('— הוספה מרובה + סבב');
  await ev(p, () => openExerciseSelector()); await p.waitForTimeout(150);
  await ev(p, () => { selTap('Arnold Press'); selTap('Face Pulls'); selTap('Arnold Press'); selTap('Arnold Press'); });
  s = await ev(p, () => ({ picked: _selPicked.slice(), txt: document.getElementById('sel-add-btn').textContent }));
  ok(s.picked.join() === 'Face Pulls,Arnold Press' && s.txt === 'הוסף 2 תרגילים', 'סימון/ביטול סימון לפי סדר, כפתור "הוסף 2 תרגילים"');
  const lenBefore = await ev(p, () => managerState.exercises.length);
  await p.click('#sel-add-btn'); await p.waitForTimeout(250);
  s = await ev(p, () => ({ screen: _activeScreenId(), tail: managerState.exercises.slice(-2) }));
  ok(s.screen === 'ui-workout-editor' && s.tail[0].name === 'Face Pulls' && s.tail[1].name === 'Arnold Press' && s.tail[1].sets === 3 && s.tail[1].restTime === 90 && s.tail[1].isMain === false, 'נוספו 2 תרגילים באותו מבנה כמו קודם');
  ok((await ev(p, () => managerState.exercises.length)) === lenBefore + 2, 'מספר הפריטים גדל ב-2');
  await ev(p, () => addClusterToEditor());
  const clIdx = await ev(p, () => managerState.exercises.length - 1);
  await ev(p, i => openExerciseSelectorForCluster(i), clIdx); await p.waitForTimeout(150);
  await ev(p, () => { selTap('Barbell Shrugs'); selTap('Back Extension'); });
  await p.click('#sel-add-btn'); await p.waitForTimeout(250);
  await ev(p, i => edOpenClusterSheet(i), clIdx);
  await typeFv(p, 'cl-rest', 2, 15);
  await typeFv(p, 'cl-rounds', 0, 0, 4);
  s = await ev(p, i => managerState.exercises[i], clIdx);
  ok(s.type === 'cluster' && s.clusterRest === 135 && s.rounds === 4 && s.exercises.length === 2 && s.exercises[0].restTime === 30, 'סבב: 4 סבבים, מנוחה 2:15, 2 תרגילים עם מעבר 30');
  await ev(p, () => edCloseSheets());

  console.log('— החלפת תרגיל');
  await ev(p, () => edOpenExSheet(0));
  const exBefore = await ev(p, () => JSON.parse(JSON.stringify(managerState.exercises[0])));
  await ev(p, () => edReplaceEx()); await p.waitForTimeout(150);
  ok((await ev(p, () => document.getElementById('sel-bar').style.display)) === 'none', 'מצב החלפה: בלי סרגל הוספה');
  await ev(p, () => selTap('Arnold Press')); await p.waitForTimeout(200);
  s = await ev(p, () => managerState.exercises[0]);
  ok(s.name === 'Arnold Press' && s.sets === exBefore.sets && s.restTime === exBefore.restTime && s.isMain === exBefore.isMain, 'ההחלפה שינתה רק את השם');

  console.log('— מתי מוצג + שמירה');
  await ev(p, () => { openPlanSettings(); edSetWhen('deload'); });
  await ev(p, () => { edCloseSheets(); saveWorkoutChanges(); }); await p.waitForTimeout(300);
  const meta = (await stored(p, 'gympro_workout_meta'))[PLAN];
  ok(meta.isDeloadOnly === true && meta.availableInDeload === true, '"רק בדילואוד" → isDeloadOnly+availableInDeload');
  const saved = (await stored(p, 'gympro_db_workouts'))[PLAN];
  ok(Array.isArray(saved) && saved.length === orig.length + 3, 'התוכנית נשמרה (+2 תרגילים +סבב)');
  const keysOk = saved.every(it => it.type === 'cluster'
      ? Object.keys(it).every(k => ['type', 'rounds', 'clusterRest', 'exercises'].includes(k))
      : Object.keys(it).every(k => ['name', 'isMain', 'sets', 'restTime', 'targetWeight', 'targetReps', 'targetRIR', 'dropSet', 'dropPct'].includes(k)));
  ok(keysOk, 'אין שדות חדשים בדאטה — רק השדות שהיו קיימים');
  ok(JSON.stringify(saved).indexOf('[[') === -1, 'אין מערך בתוך מערך (Firestore)');
  ok((await ev(p, () => _activeScreenId())) === 'ui-workout-manager', 'אחרי שמירה חוזרים לרשימה');
  s = await ev(p, () => document.getElementById('manager-list').textContent);
  ok(/דילואוד · 1/.test(s), 'הרשימה: התוכנית עברה ללשונית דילואוד');

  console.log('— תוכנית חדשה');
  await ev(p, () => createNewWorkout()); await p.waitForTimeout(150);
  ok(await ev(p, () => document.getElementById('ed-save-btn').disabled && getComputedStyle(document.getElementById('ed-empty')).display !== 'none'), 'חדשה: "שמור" מושבת ומסך ריק מוצג');
  await p.fill('#editor-workout-name', 'בדיקה חדשה');
  ok(await ev(p, () => document.getElementById('ed-save-btn').disabled), 'שם בלי תרגילים — עדיין מושבת');
  await ev(p, () => openExerciseSelector()); await ev(p, () => selTap('Arnold Press')); await p.click('#sel-add-btn'); await p.waitForTimeout(250);
  ok(!(await ev(p, () => document.getElementById('ed-save-btn').disabled)), 'עם תרגיל — פעיל');
  await ev(p, () => saveWorkoutChanges()); await p.waitForTimeout(250);
  ok(!!(await stored(p, 'gympro_db_workouts'))['בדיקה חדשה'], 'התוכנית החדשה נשמרה');

  console.log('— אירובי');
  await ev(p, () => editWorkout('שדו בוקסינג')); await p.waitForTimeout(150);
  await typeFv(p, 'ec-workSec', 2, 15);
  await typeFv(p, 'ec-restSec', 0, 45);
  await typeFv(p, 'ec-rounds', 0, 0, 10);
  await ev(p, () => saveWorkoutChanges()); await p.waitForTimeout(250);
  const cw = (await stored(p, 'gympro_db_workouts'))['שדו בוקסינג'][0];
  ok(cw.type === 'cardio' && cw.workSec === 135 && cw.restSec === 45 && cw.rounds === 10, 'אירובי: עבודה 2:15, מנוחה 0:45, 10 סבבים');

  console.log('— יצירת תרגיל מתוך מסך ההוספה');
  await ev(p, () => editWorkout('רגליים - גב')); await ev(p, () => openExerciseSelector()); await p.waitForTimeout(100);
  await ev(p, () => openExerciseCreator());
  await p.fill('#conf-ex-name', 'Test Cable Row');
  await ev(p, () => { _confSetMuscle('גב'); }); await typeFv(p, 'conf-step', 0, 0, '0,5'); await typeFv(p, 'conf-min', 0, 0, 10); await typeFv(p, 'conf-max', 0, 0, 80); await typeFv(p, 'conf-base', 0, 0, 30);
  await ev(p, () => fvOpen('conf-min')); await p.fill('#fv-input', '90'); await p.click('.fv-actions .ed-btn--pri'); await p.waitForTimeout(100);
  ok(await ev(p, () => getComputedStyle(document.getElementById('custom-alert-modal')).display !== 'none'), 'מינימום מעל המקסימום — נחסם עם הודעה');
  await ev(p, () => { document.getElementById('custom-alert-modal').style.display = 'none'; });
  await ev(p, () => saveExerciseConfig()); await p.waitForTimeout(200);
  const ex = (await stored(p, 'gympro_db_exercises')).find(e => e.name === 'Test Cable Row');
  ok(ex && ex.step === 0.5 && ex.manualRange.min === 10 && ex.manualRange.max === 80 && ex.manualRange.base === 30 && ex.muscles[0] === 'גב' && ex.weightMode === 'kg', 'תרגיל חדש: קפיצה 0.5, טווח 10–80, בסיס 30');
  ok((await ev(p, () => _selPicked.includes('Test Cable Row'))), 'התרגיל החדש מסומן אוטומטית במסך ההוספה');
  await ev(p, () => { handleBackClick(); });
  await p.waitForTimeout(150);

  console.log('— עריכת תרגיל קיים שומרת שדות');
  await ev(p, () => { navigate('ui-week', true); openExerciseDatabase(); openExerciseEditor('Lateral Raises'); });
  const exBeforeEdit = await ev(p, () => JSON.parse(JSON.stringify(state.exercises.find(e => e.name === 'Lateral Raises'))));
  await ev(p, () => saveExerciseConfig()); await p.waitForTimeout(150);
  const exAfterEdit = (await stored(p, 'gympro_db_exercises')).find(e => e.name === 'Lateral Raises');
  ok(exAfterEdit.step === (exBeforeEdit.step || 2.5) && JSON.stringify(exAfterEdit.muscles) === JSON.stringify(exBeforeEdit.muscles), 'שמירה בלי שינוי לא משנה קפיצה ושרירים');

  console.log('— מחיקת תוכנית מההגדרות');
  await ev(p, () => editWorkout('בדיקה חדשה')); await ev(p, () => { openPlanSettings(); edDeletePlan(); });
  await p.click('#custom-confirm-ok'); await p.waitForTimeout(250);
  ok(!(await stored(p, 'gympro_db_workouts'))['בדיקה חדשה'] && (await ev(p, () => _activeScreenId())) === 'ui-workout-manager', 'נמחקה, וחזרה לרשימה');

  console.log('— חלון יעדים באימון (הישן) לא נפגע');
  await ev(p, () => { selectWeek(1); selectWorkout('כתפיים - גב - חזה'); confirmExercise(true); }); await p.waitForTimeout(300);
  await ev(p, () => { if (_activeScreenId() === 'ui-1rm') save1RM(); }); await p.waitForTimeout(300);
  await ev(p, () => openExerciseSettings()); await p.waitForTimeout(150);
  ok(await ev(p, () => getComputedStyle(document.getElementById('exercise-settings-modal')).display === 'flex'), 'חלון היעדים באימון נפתח כרגיל');

  ok(p._errs.length === 0, 'אין שגיאות JS ' + p._errs.join(' | '));
  await ctx.close(); await b.close();
  console.log(`\n${pass} עברו, ${fail} נכשלו`); if (fail) { console.log(fails.join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(2); });
