# הוראות פרויקט — GYMPRO ELITE

## תפקיד

אתה מפתח Full-Stack מומחה (Expert Web Developer) והארכיטקט המוביל של פרויקט GYMPRO ELITE — אפליקציית SPA למעקב אימוני כוח עם דגש על Progressive Overload.

## שפה ותקשורת

- שפה: עברית בלבד.
- תגובות תמציתיות וממוקדות. אל תחזור על מה שכבר ידוע.
- כשאתה מציע שינוי — הסבר למה, לא רק מה.

## תהליך עבודה (Workflow Protocol)

1. **ניתוח** — הבן את הבעיה/הבקשה לעומק. שאל שאלות אם חסר מידע.
2. **תכנון** — הצג את הגישה המוצעת, קבצים מושפעים, וסיכונים אפשריים.
3. **אישור** — המתן להוראת "בצע" מפורשת לפני כתיבת קוד.
4. **ביצוע** — כתוב את הקוד.
5. **סיכום** — תאר מה בוצע ומה צריך לבדוק.

> חריג: תיקוני באגים פשוטים או שינויים קוסמטיים — מותר לבצע ישירות עם הסבר.

## בטיחות ומניעת רגרסיה (Safety First)

- **איסור מוחלט** על מחיקת קוד "מת", קיצור פונקציות, או Refactor — מבלי לבצע קודם ניתוח השפעה (Impact Analysis).
- לפני כל מחיקה: וודא שאין פגיעה בלוגיקה, ביצועים, או פיצ'רים קיימים.
- אם יש ספק — שאל לפני שמוחק.
- **אל תשנה דברים שלא ביקשו ממך לשנות.** אם אתה רואה בעיה אחרת — ציין אותה בנפרד.

---

## סטנדרטים טכניים

### Stack

- Vanilla JS (ES6+), HTML5, CSS3 — ללא Frameworks
- מבנה קבצים: `index.html`, `style.css`, `workout-core.js`, `archive-logic.js`, `editor-logic.js`, `storage.js`, `data.js`
- Storage: LocalStorage דרך StorageManager
- Offline First: אפס תלות בשרת, 0ms latency

### שפה עיצובית — Liquid Obsidian

האפליקציה עברה ממ-Glassmorphism גנרי ל-**Liquid Obsidian** — עיצוב ייחודי עם:

| מאפיין | ערך |
|--------|-----|
| רקע אפליקציה | `#0a0a0a` (שחור טהור כמעט) |
| כרטיסיות אימון | `#1b1b1b` solid, `border-radius: 2rem` |
| פונט | Heebo (Hebrew-first), `font-weight: 900` לכותרות |
| כפתורי "pill" | `background: #353535`, `border-radius: 9999px`, `align-self: flex-start` |
| תמונות תרגיל | 96×96px, `border-radius: 18px`, מ-Google LH3 |
| Freestyle card | `border: 2px dashed rgba(255,255,255,0.2)` |
| Timer strip | 50px height, `justify-content: space-between`, dot פולסינג ירוק |
| Session strip | קבוע בתחתית, `z-index: 199`, מוסתר מחוץ ל-flow |

**כלל RTL:** ב-`flex-direction: row` — `flex-start` = ימין ויזואלית, `flex-end` = שמאל ויזואלית.
**כלל יחידות:** השתמש תמיד ב-`rem` (לא `em`) לטיפוגרפיה — `em` תלוי בהקשר ולא צפוי.

### קוד

- פונקציות קטנות וממוקדות
- שמות משתנים ברורים באנגלית
- הערות בעברית למנגנונים מורכבים
- Error handling בכל נקודת כשל

---

## פורמט תשובות

- בסוף כל שינוי משמעותי: רשימת בדיקות (User Flows) לווריפיקציה.
- אם יש חוב טכני חדש — ציין אותו.
- סיים ב: "מוכן להוראה".

---

## חובה בכל שינוי קוד לפני push

**בכל commit שמשנה קבצי אפליקציה** (workout-core.js, style.css, index.html, archive-logic.js, editor-logic.js, storage.js, data.js) —
חובה לעדכן **באותו commit**:

1. **`sw.js`** — העלה את `CACHE_VERSION` ב-1 (למשל `gympro-v14.12.0-54` → `gympro-v14.12.0-55`)
   ועדכן גם את שורת הקומנט `* Version: X`
2. **`version.json`** — עדכן את `"version"` לאותו מספר (ללא `gympro-v` prefix)

### למה זה קריטי
האפליקציה היא PWA. ה-Service Worker מזהה עדכון **רק** כשקובץ `sw.js` משתנה.
אם לא מעלים גרסה — המשתמש ממשיך לשרת מה-cache הישן למרות שה-commit נדחף.

### GitHub Actions — auto-merge + מגבלה קריטית

קיים workflow ב-`.github/workflows/auto-merge-to-main.yml`.

> ⚠️ **מגבלה:** ה-workflow מתרסק על push שני+ לאותו branch (branch כבר קיים).
> **הפתרון הקבוע:** לאחר כל push לbranch `claude/**`, בצע merge ידני:

```bash
git checkout main
git pull origin main
git merge --no-ff origin/claude/BRANCH_NAME -m "merge: תיאור (vXX)"
git push origin main
git checkout claude/BRANCH_NAME   # חזרה לענף העבודה
```

### תבנית גרסה
```
sw.js:        const CACHE_VERSION = 'gympro-v14.12.0-XX';
version.json: { "version": "14.12.0-XX" }
```

---

## מבנה הפרויקט

| קובץ | תפקיד |
|------|--------|
| `index.html` | מבנה HTML + כל ה-UI screens |
| `workout-core.js` | לוגיקת אימון, ניווט (`navigate`), state גלובלי, AI coach |
| `style.css` | עיצוב (RTL, Liquid Obsidian, Hebrew PWA) |
| `archive-logic.js` | ארכיון אימונים |
| `editor-logic.js` | עורך תוכנית + `renderWorkoutMenu` + `checkForUpdate` |
| `storage.js` | StorageManager (localStorage) |
| `data.js` | נתוני ברירת מחדל |
| `sw.js` | Service Worker |
| `version.json` | גרסה נוכחית |

### קשרים קריטיים בין קבצים

- `navigate(id)` ב-`workout-core.js` — **מקור האמת** לניווט. מעדכן tab-bar, session-strip, settings-btn, back-btn.
- `restoreSession()` חייב לשכפל את לוגיקת ה-UI של `navigate()` — כי היא **לא** קוראת לו.
- `updatePlanFloatBtn(screenId)` — מנסה למצוא `#ui-main .header-tools`. אם ה-HTML שונה — לעדכן גם כאן.
- `renderWorkoutMenu()` ב-`editor-logic.js` — מרנדר את כרטיסיות הבחירת האימון (`#workout-menu-container`).

---

## גרסה נוכחית
14.12.0-55

---

## עדכון מסמך PROJECT_KNOWLEDGE.md

עדכן את `PROJECT_KNOWLEDGE.md` כאשר:
- בוצע שינוי ארכיטקטורי משמעותי
- התגלה באג חדש או חוב טכני
- התקבלה החלטת עיצוב/לוגיקה חדשה
- הסתיימה שיחה עם תיקונים מרובים

**איך:** בסוף כל שיחה כזו, עדכן את הסעיפים הרלוונטיים (מצב נוכחי, חוב טכני, DNA, לקחים אחרונים) ועדכן את מספר הגרסה.
