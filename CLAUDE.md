# הוראות פרויקט — GYMPRO ELITE

## ⚡ Skill פעיל אוטומטית

**token-efficient-workflow** (`.claude/skills/token-efficient-workflow/SKILL.md`) — תמיד פעיל בפרויקט הזה. עקוב אחר ההוראות בקובץ ה-SKILL: חיפושים ממוקדים בלבד, view ranges, str_replace, silent completion, אפס filler. במקרה של התנגשות עם החוקים למטה — חוקי הפרויקט בעברית קודמים.

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

## תוכנית שדרוג פעילה — חובה לקרוא

קיימת תוכנית roadmap מאושרת ב-**`docs/ROADMAP.md`** (5 ספרינטים, ~2,800 שורות, יעד: רמת Apple Fitness / Whoop).

**טריגרים שמחייבים קריאה של `docs/ROADMAP.md` לפני פעולה:**
- "המשך מהתוכנית" / "המשך roadmap" / "המשך שדרוג"
- "בצע Sprint X" / "התחל Sprint X" / "נמשיך Sprint X"
- כל שאלה על שדרוג, פיצ'רים חדשים, או הכיוון של האפליקציה
- אזכור של אחד מהפיצ'רים: Giant Sets, Nutritional State, Plateau Detection, PR Prediction, Heatmap, Live View, Swipe Navigation, Skeleton Loaders, AI Recommendations

**כיצד לפעול כשטריגר מזוהה:**
1. קרא במלואו את `docs/ROADMAP.md`.
2. בדוק את טבלת סטטוס הספרינטים שם — מה הסטטוס הנוכחי.
3. אל תתחיל לתכנן מחדש; התוכנית מאושרת. שאל רק מה שלא ברור.
4. בסיום ספרינט — עדכן את הטבלה לסטטוס ✅ Done ואת מספר הגרסה.

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

### חובה: push + merge ל-main בכל שינוי — תמיד

> 🔴 **כלל מוחלט:** סיום עבודה = **גם push לענף `claude/**` וגם merge ידני ל-`main`**.
> push לבדו **אינו** מספיק. המשתמש רואה את האפליקציה מ-`main` בלבד — אם לא מיזגת, השינוי לא הגיע אליו.
> אל תחכה לבקשה "מזג". בכל פעם שאתה דוחף קוד — מזג מיד אחריו, אלא אם המשתמש ביקש מפורשות לא למזג.

קיים workflow ב-`.github/workflows/auto-merge-to-main.yml`, **אך אסור להסתמך עליו**:
ה-workflow מתרסק על push שני+ לאותו branch (branch כבר קיים), ולכן לרוב המיזוג לא יקרה אוטומטית.
**המיזוג הידני הוא ברירת המחדל, לא חריג.**

**הרצף המלא בסיום כל שינוי קוד (חובה לבצע את כל הצעדים):**

```bash
# 1. push לענף העבודה
git push -u origin claude/BRANCH_NAME

# 2. merge ידני ל-main — תמיד, בכל push
git checkout main
git pull origin main
git merge --no-ff origin/claude/BRANCH_NAME -m "merge: תיאור (vXX)"
git push origin main
git checkout claude/BRANCH_NAME   # חזרה לענף העבודה
```

**אימות:** אחרי המיזוג ודא ש-`grep CACHE_VERSION sw.js` ב-`main` מציג את הגרסה החדשה.

### תבנית גרסה
```
sw.js:        const CACHE_VERSION = 'gympro-v15.X';
version.json: { "version": "15.X" }
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
15.58

---

## עדכון מסמך PROJECT_KNOWLEDGE.md

עדכן את `PROJECT_KNOWLEDGE.md` כאשר:
- בוצע שינוי ארכיטקטורי משמעותי
- התגלה באג חדש או חוב טכני
- התקבלה החלטת עיצוב/לוגיקה חדשה
- הסתיימה שיחה עם תיקונים מרובים

**איך:** בסוף כל שיחה כזו, עדכן את הסעיפים הרלוונטיים (מצב נוכחי, חוב טכני, DNA, לקחים אחרונים) ועדכן את מספר הגרסה.
