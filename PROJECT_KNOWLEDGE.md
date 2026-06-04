# GYMPRO ELITE — Project Knowledge

> מסמך זה מכיל רק מידע שאינו נגזר מקריאת הקוד: החלטות, לקחים, מלכודות.

---

## גרסה נוכחית: 15.82

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
- `#vol-muscle-chips` — CSS ייעודי עם `flex-wrap: nowrap` + overflow-x scroll + chips קטנים (`0.75rem`). אין לשנות ל-wrap.

### Analytics
- `switchAnalyticsTab()` מחפש `#analytics-seg .seg-btn` — ה-wrapper **חייב** להכיל `id="analytics-seg"`. ללא ה-ID, שניהם מקבלים `.active` ונראים אפורים. (תוקן ב-74)
- גרף נפח לאורך זמן (`renderVolumeBarChart`): **אין להוסיף `.reverse()`** — ב-RTL האלמנט הראשון במערך מוצג מימין. archive מגיע חדש-ראשון, אז ללא reverse: חדש=ימין. (תוקן ב-74)
- `.x-axis-lbls` חייב `direction: ltr` — ה-SVG מצייר LTR פיזית, התאריכים חייבים להתאים. (תוקן ב-74)
- כרטיסיות "נפח כולל" ו-"שיא נפח" בסקירה — מוצגים בק"ג עם `toLocaleString('he-IL')`, **לא** בטון. (תוקן ב-74)
- `confirmExercise()` מזהה מסך מבוא סבב לפי `!state.currentEx` — לא לפי innerText (שביר). (תוקן ב-55)
- `deepClone(undefined)` = SyntaxError שקט. תמיד null-guard לפני `deepClone`.

### PWA / Deploy
- push לbranch `claude/**` בלבד לא מספיק — האפליקציה מוגשת מ-`main`.
- GitHub Actions auto-merge **קורס על push שני+** לאותו branch (branch כבר קיים). **חובה: merge ידני** לאחר כל push.
- `sw.js` + `version.json` חייבים להשתנות באותו commit עם שאר הקבצים. bump גרסה ב-commit נפרד = cache ישן לטעות.

---

## שפה עיצובית — MONOLITH / Platinum Obsidian (v15.82)

**v15.82 — מונוכרום יוקרתי.** המעבר הגדול: מ-"Deep Obsidian" צבעוני (v15.81) ל-**MONOLITH** — חד, מדויק, פחות צבע. השינויים:

| ציר | לפני (v15.81) | אחרי (v15.82) |
|-----|---------------|----------------|
| **צבע** | rainbow `--type-a/b/c/free` (כחול/ירוק/כתום/סגול), glows, גרפים 5-6 צבעים, אייקונים צבעוניים | **מונוכרום מלא** + אקסנט יחיד **פלטינה `#E8EAED`**. כל צבע רווי hardcoded נוקה מ-CSS/JS/HTML (perl sweep) ומופה לטוקן |
| **גיאומטריה** | 28-32px (`2rem`) "ידידותי" | `--r-md` **12px** חד; סולם `8/10/12/16px` |
| **טיפוגרפיה** | הכל Heebo `900` + `italic` + uppercase + letter-spacing שלילי עמוק | **בלי italic, בלי 900** → `600` כותרות/מספרים, `400` גוף; eyebrow labels קטנים בלבד |
| **דקורציה** | watermark "GYMPRO", מספרי רקע ענקיים, radial glows, text-shadow glows, drop-shadow ירוק | **הוסר הכל**; עומק מ-hairline + ערך בלבד |
| **כפתור primary** | gradient כחול + glow כחול | **פלטינה fill** + `--on-accent` כהה (Vercel-style), צל ניטרלי |
| **גרפים/heatmap** | 5-6 צבעים | סולם אפורים+פלטינה; heatmap = אינטנסיביות באופסיטי |

**מערכת טוקנים ב-`:root`:**

| טוקן | ערך | שימוש |
|------|-----|--------|
| `--bg` | `#050506` | shell |
| `--surface-1..4` | `#0d0d0f / #141416 / #1c1c1f / #28282c` | היררכיית עומק |
| `--text` / `--text-dim` / `--text-mute` | `#ECECEE / #8A8A90 / #56565C` | 3 רמות דיו לניגודיות |
| `--accent` / `--accent-dim` / `--on-accent` | `#E8EAED / #B6BAC2 / #0A0A0B` | פלטינה — fill לכפתורים, דיו כהה עליהם |
| `--danger` | `#C25B54` | אדום מעודן (היה `#ff453a`) |
| `--type-a/b/c/free` | מופו ל-ink tones | **מנטרל את ה-rainbow אוטומטית** גם ב-JS שקורא `var(--type-*)` |
| `--hairline/-hi`, `--top-glint`, `--elev-1..3` | ניטרלי | הפרדה + elevation, **אפס צל צבעוני** |
| `--r-xs/sm/md/lg` | `8/10/12/16px` | סולם radius חד |

**עקרונות / מלכודות:**
- **חוק מונוכרום:** אסור hex רווי hardcoded. צבע חדש = טוקן. כל glow/gradient צבעוני הוסר; success → פלטינה.
- עומק מ-**surface hierarchy + hairline**, לא מ-blur/glow. כרטיסיות תוכן **solid**.
- כפתור primary = **פלטינה fill + `--on-accent` כהה** (לא gradient). אם מוסיפים CTA — אותו דפוס.
- `body::before` — vignette ניטרלי עדין; עומק ברמת המסך.
- מיפוי `--type-*` ל-ink tones הוא ה-hook המרכזי: שינוי שם אחד מנטרל עשרות שימושים ב-JS. `meta.color` של תוכניות (בחירת משתמש) עדיין מכובד — רק הדיפולטים/פלטת הבחירה (`WORKOUT_COLORS`) עברו לטונים מונוכרומטיים.
- אם צריך להחזיר הבחנה צבעונית בעתיד — לשנות את `--type-*` ב-`:root` בלבד.

| מה | ערך |
|----|-----|
| כרטיסיות | `var(--surface-2)` solid, `--r-md` (12px), `--elev-1/2` |
| פונט ראשי | Heebo/Inter, `600` כותרות (לא 900, לא italic), `rem` |
| Pill buttons | `--surface-4`, `--r-pill`, `align-self: flex-start` |
| Freestyle card | `border: 2px dashed rgba(255,255,255,0.2)` |
| Session strip | `height: 50px`, fixed bottom, `z-index: 199`, מוסתר מחוץ ל-workout flow |

---

## חוב טכני פתוח

| # | תיאור | חומרה |
|---|-------|-------|
| 1 | `details` ב-ArchiveEntry לא שומר cluster per-round — רק per-exercise | נמוכה |
| 2 | archive entries ישנים (לפני 14.12.0-24) חסרים שדה `week` — AI block comparison נופל ל-fallback | נמוכה |
| 3 | ✅ נפתר — `updatePlanFloatBtn` כבר לא מחפש `.header-tools`, רק מנקה כפתורים מוזרקים | — |
| 4 | ✅ נפתר — הארכיון מפוצל ל-chunks (`ARCHIVE_CHUNK_SIZE=20`, `archive_meta`+`archive_N`). הקובץ הגולמי של MFP מפוצל גם הוא (`nutrition_raw_meta`+`nutrition_raw_N`, 1000 שורות/מסמך). מסמך `config` נשאר קל (נתונים קטנים) | — |
| 5 | עריכת סט במסך הסיכום אחרי שנוצר `aiSummary` לא מרעננת אותו — הסיכום עלול להפוך לא-מסונכרן | נמוכה |

---

## סיכום מאמן אוטומטי (Coach Summary) — v15.47

- **שמירה מיידית:** `finish()` שומר את האימון לארכיון מיד (upsert לפי `state.archivedTimestamp`), לא רק ב-`copyResult`. מונע אובדן מידע אם המשתמש לא מסיים. `_saveToArchive` הפך ל-upsert.
- **טריגרים:** כל אימון → סיכום אימון; מתג "סיום שבוע" (תפריט שלוש-נקודות, ברירת מחדל ON בשבת, `state.weekEndFlag`) → סיכום שבועי+השוואה; +`week===3` → סיכום בלוק.
- **`_callGeminiOneShot(prompt, {freeText:true})`** — מצב טקסט חופשי (2048 טוקנים) בנוסף למצב JSON המקורי.
- **פרומפטים ניתנים לעריכה:** `StorageManager.COACH_PROMPT_DEFAULTS` + override ב-`KEY_COACH_PROMPTS`, נערכים ב-`coach-prompts-sheet`. מסונכרנים ב-`saveConfigToCloud` (`coachPrompts`).
- **`aiSummary` מסונכרן אוטומטית** דרך `saveArchiveToCloud` (שולח כל הארכיון as-is, ללא whitelist).
- שני מתגי העתקה: מסך סיכום (`KEY_COPY_INCLUDE_COACH`) וארכיון (`KEY_ARCHIVE_COPY_COACH`, ברירת מחדל כבוי).

---

## מסך Composition + אינטגרציית MyFitnessPal (v15.59–15.76)

מסך "Composition" (`ui-bodylog`, `bodylog-logic.js`) מחולק ל-2 טאבים בבורר `segment-wrapper`/`seg-btn` (זהה לאנליטיקה/ארכיון):
- **שקילה** — משקל + אחוז שומן, גרפים, היסטוריה, צילום/OCR, ייבוא/ייצוא CSV.
- **תזונה** — נתוני MyFitnessPal: כרטיס ממוצעים דינמי (קלוריות/חלבון/פחמימה/שומן) לפי טווח 7/30/90/הכל/**מותאם**, גרף קלוריות + גרף חלבון, היסטוריה יומית, 3 ייצואים (יומי/תקופה/קובץ MFP מלא), וכפתור איפוס.

**הגשר (Apps Script, `docs/mfp-nutrition-bridge.gs`):** רץ בחשבון ה-Gmail של המשתמש; מאתר את ייצוא ה-MFP האחרון, מוריד את ה-ZIP מ-S3 (עוקף CORS בצד-שרת), מאגד תזונה לפי יום ומחזיר JSON + `rawCsv`. מוגן ב-`SECRET_TOKEN`.
- **JSONP חובה:** `fetch` חוצה-מקור ל-Apps Script נכשל תמיד (ה-redirect ל-googleusercontent חסר כותרות CORS). הקריאה דרך `<script>` (JSONP, פרמטר `callback`) — `_jsonpRequest` ב-workout-core.
- **מיזוג ללא כפילויות:** `saveNutritionDaily`/`saveNutritionRaw` עושים upsert לפי תאריך — קובץ חדש דורס ימים חופפים. משיכה שבועית מצטברת.
- **ניקוי ספייקים בגרף בלבד:** ימים <50% מהממוצע (הזנה חסרה) מוחלפים בממוצע (`_cleanNutriOutliers`). הממוצעים/הרשימה/הייצוא עם הנתונים האמיתיים.
- **tooltip:** יחידה רק היכן שרלוונטי — ק"ג למשקל, % לשומן, ללא יחידה בתזונה.

## מנוע TDEE / מאזן אנרגיה (v15.77–15.79)

`computeTDEE()` ב-`bodylog-logic.js` (offline). כרטיס בטאב תזונה; עוגן ל-AI ב-`_buildTdeeAIContext()`. מתודולוגיה מלאה: `docs/tdee-methodology.md`.
- **רב-שיטתי:** מדידה (back-calc) + Katch-McArdle + Cunningham (ממשקל+%שומן) + Mifflin (מפרופיל גוף). מציג טבלת השוואה + טווח ביטחון, לא מספר בודד.
- **מדידה = `avgIntake − slope×7700`** (slope ק"ג/יום מרגרסיה על המשקל). מעגן כשיש מספיק נתונים.
- **דיוק — לקחים קריטיים (v15.78):** חלון רגיל מערבב שלבים (תחזוקה+קאט) וקפיצות כיול-משקל → TDEE מנופח. לכן: (1) פילוח ל**שלב התזונתי הנוכחי** (מלוג המעברים), (2) **דילוג על 7 ימים ראשונים** של השלב (מים), (3) הנמכת ביטחון+הרחבת טווח (±12%) כש-RMSE>0.7 או <14 ימים, (4) חסם שפיות: קצב >1.6 ק"ג/שבוע = נתון פגום → לא מעגנים.
- **מכפיל פעילות:** מ-`getBodyProfile().activity` (ברירת מחדל 1.55). משפיע **רק על שורות התחזית**, לא על המדידה. ניתן לשינוי בהגדרות → פרופיל גוף.
- **פרופיל גוף** (`KEY_BODY_PROFILE`): מין/גיל/גובה/פעילות — אופציונלי, מסונכרן בקונפיג הענן.

## גישת AI לנתונים (v15.74)

`buildSystemPrompt` מזריק לכל קריאת Gemini גם **תזונה בפועל** (ממוצעי 7/30 + פירוט 14 ימים) ו**הרכב גוף/שקילות** (משקל אחרון, מגמת 30 יום, 12 שקילות). במצב `slim` (תוך-אימון) רק ממוצעים. עדכון שורת ה"מקורות" כדי שה-AI ידע שהנתונים זמינים.

## ניווט בהחלקה בין טאבים (v15.68–15.70)

`_initTabSwipeGesture` (workout-core) — החלקה אופקית על 4 מסכי הטאבים מחליפה טאב (RTL-aware, "התוכן עוקב אחרי האצבע"). מוחרגים: גלילה אנכית, מודאלים/sheets, גרפים (svg/canvas), ואלמנטים שגלילים אופקית (`_hasHorizontalScroll`). ה-`touchmove` **לא-passive** עם `preventDefault` על החלקה אופקית נעולה — חוסם את גסט ניווט-הקצה של ספארי (המסך הלבן). אין התנגשות עם swipe-back (מסכי הטאבים ב-`NO_BACK_SCREENS`).

## סנכרון ענן — מבנה Firestore (v15.75)

קולקציה אחת `gympro_data` עם מסמכים נפרדים, כל אחד מתחת ל-1MB:
- `archive_meta` + `archive_0/1/...` — ארכיון אימונים (20/מסמך).
- `nutrition_raw_meta` + `nutrition_raw_0/1/...` — קובץ MFP גולמי per-meal (1000 שורות/מסמך). ה-`header`+`dateIdx` ב-meta.
- `config` — תוכניות, תרגילים, prefs, מצב תזונתי, **תזונה יומית** (`nutritionDaily`), **שקילות** (`bodylog`), **פרופיל גוף** (`bodyProfile`), coachPrompts. נתונים קטנים → מסמך בודד בטוח.
- `ai_history` — היסטוריית שיחות.

**מניעת 1MB מוחלטת:** כל דאטה שגדל ללא חסם (ארכיון, raw תזונה) מפוצל ל-chunks עם ניקוי עודפים אוטומטי. סנכרון אוטומטי: ארכיון אחרי אימון; config+raw אחרי ייבוא תזונה (fire-and-forget, מוגן ב-`_ensureReady`).

---

## לקחים מצטברים

- `git merge --theirs` יכול לכסות commits מ-main. תמיד לפתור conflicts ידנית.
- `localStorage.setItem` ללא try-catch = אובדן נתונים שקט ב-QuotaExceeded. כל שמירה = עטופה.
- לעולם לא `JSON.stringify(userObj)` בתוך `onclick=""` — HTML injection. העבר רק מזהה (timestamp).
- session-timer-strip נשלט אך ורק דרך `navigate()` (ו-`restoreSession()` שמשכפלת אותו). אין מקום אחר לגעת בו.
