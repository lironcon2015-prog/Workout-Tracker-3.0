# GYMPRO ELITE — Project Knowledge

> מסמך זה מכיל רק מידע שאינו נגזר מקריאת הקוד: החלטות, לקחים, מלכודות.

---

## גרסה נוכחית: 14.12.0-55

---

## החלטות ארכיטקטוריות (לא ברורות מהקוד)

- **Vanilla JS ללא Framework** — בכוונה. PWA offline-first, 0 תלויות, bundle=0.
- **SPA display-toggle** — אין routing. כל screens ב-`index.html`, ניווט ע"י `historyStack`.
- **Gemini API ישיר מ-client** — ללא backend. מפתח ב-LocalStorage. סיכון מודע, קביל ל-personal app.
- **SW cache-first + skipWaiting** — עדכון מיידי. המשתמש חייב ללחוץ "בדוק עדכון" לראות גרסה חדשה.

---

## מלכודות קריטיות

### ניווט
- `navigate(id)` — **מקור האמת** לניווט. מעדכן tab-bar, session-strip, settings/sound/reload btns.
- `restoreSession()` **לא קוראת** ל-`navigate()` — חייבת לשכפל את לוגיקת ה-UI ידנית (כבר תוקן ב-55).
- `updatePlanFloatBtn()` מחפש `#ui-main .header-tools` — אם ה-HTML משתנה, לעדכן גם כאן.

### CSS / Layout
- `.screen` הוא flex container. ילדיו מתכווצים (`flex-shrink:1`) ולא מייצרים overflow. **חובה:** `.screen > * { flex-shrink: 0 }` לגלילה. (תוקן ב-55)
- יחידות: תמיד `rem`, לא `em`. `em` תלוי בהקשר ומפתיע ברכיבים מקוננים.
- RTL: ב-`flex-direction: row` — `flex-start` = ימין ויזואלית, `flex-end` = שמאל.
- `align-self: flex-start` חובה על pill buttons בתוך flex-column (אחרת נמתחים לרוחב מלא).

### Cluster
- `showConfirmScreen()` ללא `forceExName` ב-clusterIdx===0 חייבת לאפס `state.currentEx = null`.
- `confirmExercise()` מזהה מסך מבוא סבב לפי `!state.currentEx` — לא לפי innerText (שביר). (תוקן ב-55)
- `deepClone(undefined)` = SyntaxError שקט. תמיד null-guard לפני `deepClone`.

### PWA / Deploy
- push לbranch `claude/**` בלבד לא מספיק — האפליקציה מוגשת מ-`main`.
- GitHub Actions auto-merge **קורס על push שני+** לאותו branch (branch כבר קיים). **חובה: merge ידני** לאחר כל push.
- `sw.js` + `version.json` חייבים להשתנות באותו commit עם שאר הקבצים. bump גרסה ב-commit נפרד = cache ישן לטעות.

---

## שפה עיצובית — Liquid Obsidian

| מה | ערך |
|----|-----|
| כרטיסיות | `#1b1b1b solid`, `border-radius: 2rem` |
| פונט ראשי | Heebo 900 לכותרות, `rem` units |
| Pill buttons | `#353535`, `border-radius: 9999px`, `align-self: flex-start` |
| Freestyle card | `border: 2px dashed rgba(255,255,255,0.2)` |
| Session strip | `height: 50px`, fixed bottom, `z-index: 199`, מוסתר מחוץ ל-workout flow |

---

## חוב טכני פתוח

| # | תיאור | חומרה |
|---|-------|-------|
| 1 | `details` ב-ArchiveEntry לא שומר cluster per-round — רק per-exercise | נמוכה |
| 2 | archive entries ישנים (לפני 14.12.0-24) חסרים שדה `week` — AI block comparison נופל ל-fallback | נמוכה |
| 3 | `updatePlanFloatBtn` עדיין מחפש `.header-tools` ב-ui-main שנמחק — מוחלף ע"י `#workout-quick-menu` | נמוכה |

---

## לקחים מצטברים

- `git merge --theirs` יכול לכסות commits מ-main. תמיד לפתור conflicts ידנית.
- `localStorage.setItem` ללא try-catch = אובדן נתונים שקט ב-QuotaExceeded. כל שמירה = עטופה.
- לעולם לא `JSON.stringify(userObj)` בתוך `onclick=""` — HTML injection. העבר רק מזהה (timestamp).
- session-timer-strip נשלט אך ורק דרך `navigate()` (ו-`restoreSession()` שמשכפלת אותו). אין מקום אחר לגעת בו.
