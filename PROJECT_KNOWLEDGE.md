# GYMPRO ELITE — Project Knowledge

> מסמך זה מכיל רק מידע שאינו נגזר מקריאת הקוד: החלטות, לקחים, מלכודות.

---

## גרסה נוכחית: 16.3

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

## שפה עיצובית — Liquid Obsidian → Deep Obsidian (v15.81)

**v15.81 — מערכת surface אחידה.** לפני: 4+ רקעי כרטיסיות מתחרים (`rgba(31,31,31,0.55)` glass / `#1b1b1b` solid / `rgba(31,31,31,0.45)` obsidian / gradient), 3 ערכי radius, צללים מומצאים מקומית, glassmorphism כבד לא-עקבי. אחרי: מערכת טוקנים אחת ב-`:root`.

| טוקן | ערך | שימוש |
|------|-----|--------|
| `--bg` | `#070708` | shell (היה `#0a0a0a`) |
| `--surface-1..4` | `#101013 / #161619 / #1e1e22 / #26262c` | היררכיית עומק — ככל שגבוה יותר, בהיר יותר |
| `--hairline` / `--hairline-hi` | `rgba(255,255,255,.06)` / `.10` | border + border-top ("אור מלמעלה") |
| `--top-glint` | `inset 0 1px 0 rgba(255,255,255,.05)` | תפיסת אור עליונה |
| `--elev-1..3` | צל ambient+key מדורג | elevation אחיד |
| `--r-sm/md/lg/pill` | `14 / 20 / 28px / 9999px` | סולם radius אחיד |

**עקרונות:**
- עומק נבנה מ-**surface hierarchy + hairline + צל**, לא מ-blur. כרטיסיות תוכן הן **solid** (אין `backdrop-filter`).
- glassmorphism נשמר **רק** ב-bottom sheets / modals (מרחפים מעל המסך) — `blur(20px)` עדין.
- כפתורי CTA ראשיים (`.action-card`, `.freestyle-finish-btn`) שומרים צל **צבעוני** מכוון; כל שאר הצללים ניטרליים.
- `body::before` — vignette רדיאלי קבוע (מקור אור עדין בראש המסך → שחור מוחלט בתחתית), עומק ברמת המסך.
- טוקנים ישנים (`--card-bg`, `--ios-radius`, `--border`, `--border-hi`) **מופו מחדש** לטוקנים החדשים — שימושים קיימים לא נשברו.

| מה | ערך |
|----|-----|
| כרטיסיות | `var(--surface-2)` solid, `var(--r-lg)` (28px), `--elev-2/3` |
| פונט ראשי | Heebo 900 לכותרות, `rem` units |
| Pill buttons | `#353535` / `--surface-4`, `border-radius: 9999px`, `align-self: flex-start` |
| Freestyle card | `border: 2px dashed rgba(255,255,255,0.2)` |
| Session strip | `height: 50px+safe-area` עם `box-sizing:border-box` (בלעדיו ה-safe-area נספר פעמיים והפאנל קופץ בגובה), fixed bottom, `z-index: 199`, מוסתר מחוץ ל-workout flow. מרכז ה-strip = 3 מצבים ב-`_syncStripLogBtn()`: `#strip-rest-timer` (מנוחה רצה), `#strip-continue-btn` (בין תרגילים), המלל "זמן אימון". `#btn-submit-set` ו-`#btn-continue-exercise` במסך הם state-markers בלבד (מוסתרים ב-CSS), **חוץ ממצב Cluster** שבו `#ui-main.cluster #btn-submit-set` חוזר למסך (אין שם טבלת סטים) |
| רישום סט (v16.2) | לחיצה על **שורת הסט הנוכחי בטבלה** (`renderSetSessionTable` → `.set-table-row.current` עם onclick=nextStep). אין כפתור LOG SET נפרד. הטבלה מוצגת תמיד בזמן הקלטה (גם לתרגיל של סט אחד); `total` כולל done+1 כשמקליטים (מכסה addExtraSet) |
| טיימר מנוחה | ספרתי, במרכז ה-session strip (`#strip-rest-time`, משוקף מ-`resetAndStartTimer.updateUI`). עיגול הטיימר ב-ui-main הוסתר (`display:none`). **לקח קריטי:** `position:fixed` בתוך `.content-area` (scroller) לא אמין ב-iOS — אלמנטים צפים חדשים לשים ישירות תחת body או בתוך ה-strip |

**באג ה-fixed המרחף (iOS) — אבחון סופי (v16.3):** שני מנגנונים נפרדים:
1. **מקלדת (v16.2):** פתיחה גוללת את ה-window עצמו (לא את content-area), ואחרי סגירה iOS לא תמיד מחזיר scroll ל-0. תוקן ב-`_repinViewport()` על focusout + visualViewport resize/scroll.
2. **reload (v16.3, השורש האמיתי):** אחרי `window.location.reload()` ב-standalone PWA עם `black-translucent`, iOS מחשב את ה-layout viewport **בלי אזור ה-status bar** (קצר ב~60pt) → כל fixed bottom:0 מרחף ~60pt מעל התחתית, ומתחתיו נחשף רקע ה-body. אומת בניתוח פיקסלים: הרמה = בדיוק גובה ה-status bar. זה הסביר את "הבאג חוזר אחרי רענון" — וגם את הופעתו אחרי סיום אימון (`finish()` מרענן).
   **התיקון:** ➊ **אסור `window.location.reload()` בשום מקום** — תמיד `reloadApp()` (משתמש ב-`location.replace()` = ניווט מלא שלא עובר במסלול הפגום; ה-SW מגיש מ-cache באותה מהירות). ➋ `_kickViewport()` רץ על pageshow/load — מזהה viewport מעוך (`innerHeight + 4 < screen.height` ב-standalone) ומנדנד (scroll nudge + reflow כפוי) עד שהגובה מתיישר.

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
- שני מתגי העתקה: מסך סיכום (`KEY_COPY_INCLUDE_COACH`) וארכיון (`KEY_ARCHIVE_COPY_COACH`, ברירת מחדל כבוי). **שניהם נפרדים** — מקור אמת כפול (חוב ידוע; משתמש עלול לכבות באחד ולקבל coach מהשני).
- **קובץ לקלוד (v15.84+):** `exportClaudeFile()` (כל הלוג) ו-`executeDownloadByRange()` (טווח, מתוך `range-copy-sheet`) מורידים **JSON** של לוג האימונים (`{app,scope,workouts_count,includes_coach_summary,generated,workouts[]}`, כרונולוגי עולה). מכבד את מתג סיכום המאמן של הארכיון (`KEY_ARCHIVE_COPY_COACH`) — כשכבוי, `aiSummary` מוסר מכל רשומה. נפרד מ-`exportData()` שהוא גיבוי JSON מלא (כל ה-localStorage, לשחזור).

### זיכרון מאמן — קונטקסט ארוך-טווח (v15.86)
המאמן זוכר תובנות מעבר לחלון ה-10 הודעות, **בלי לפגוע במהירות התגובה** (כל התוספת היא צד-קלט / רקע).
- **#1 ניתוחים קודמים:** `_buildCondensedCoachSummaries(2, 800)` מזריק ל-`buildSystemPrompt` את 2 סיכומי המאמן האחרונים (`aiSummary`), מקוצרים ל-~800 תווים. צד-קלט בלבד → השפעה זניחה על latency.
- **#2 זיכרון מתגלגל:** `KEY_COACH_MEMORY` (`{text, coveredLen, updatedAt}`). `_coachMemorySection()` מזריק אותו ל-`buildSystemPrompt`. הרענון (`_updateCoachMemory`) רץ **ברקע, off-critical-path** — מופעל ע"י `_maybeUpdateCoachMemory()` אחרי הצגת התשובה, רק כשנצברו ≥`COACH_MEMORY_THRESHOLD` (20) הודעות חדשות. משתמש ב-`_callGeminiOneShot(freeText, maxTokens:700)`. **לעולם לא לתמצת סינכרונית לפני תשובה** — זו קריאת API נוספת שתכפיל latency.
- **סנכרון ענן (v15.87):** הזיכרון נשמר ב-doc `ai_history` בפיירבייס יחד עם הצ'אט (`coachMemory` field) — גיבוי אוטומטי ב-`closeAICoach`, שחזור דרך כפתור "שחזר היסטוריה". מסונכרן בין מכשירים בדיוק כמו השיחות.
- חלון הצ'אט החי נשאר 10 הודעות (`callGeminiAPI`). `clearAIHistory` מאפס גם את הזיכרון. `coveredLen` מקבל clamp ב-`openAICoach` (היסטוריה מוגבלת ל-300).

---

## גשר אפל-ווטש — אימון חי שעון⇄טלפון (v15.92, Two-lane union)
מטרה: לתעד אימון מ-Apple Watch בלי native/App Store/$99, עם **טרנזיטיביות מלאה דו-כיוונית**. שעון = **Apple Shortcuts** → Apps Script proxy (`docs/watch-bridge.gs`) → Firestore `gympro_data/live_session` → ה-PWA קורא ב-`onSnapshot` ומסכם.
- **ייצוג ה-doc (v15.92):** `{ active:bool, data:"<json>", wlog:"<json>" }` — **שני מסלולים נפרדים**: `data`=מסלול הטלפון (metadata + סטי-`'p_'`, נכתב רק ע"י ה-PWA), `wlog`=מסלול השעון (סטי-`'w_'` + מצביע-תרגיל, נכתב רק ע"י ה-proxy, append-only). `_unwrapLive` ממזג את שניהם בקריאה (union לפי setId; `currentExName` מהמסלול עם `currentTs` חדש; `setIdx` **נגזר** מהאיחוד).
- **clobber נפתר מבנית (v15.92):** אף צד לא כותב לשדה של השני (`set(merge)`/`updateMask` = מיזוג ברמת-שדה) → אין lost-update, ללא transactions. קודם (v15.90 forceAdopt, v15.91 read-merge-write) נגעו בסימפטום והשאירו חלון מרוץ.
- **`WatchBridge`** (workout-core.js) — **כבוי כברירת מחדל** (`KEY_WATCH_BRIDGE_ON`), no-op מוחלט כשכבוי. `onStateSaved()` (hook יחיד ב-`saveSessionState`, debounce 400ms, hash) → `_doPublish()` כותב מסלול-טלפון בלבד; בתחילת סשן `resetWlog=true` מנקה מסלול-שעון מסשן קודם. `_adopt()` עם gating על `_wlogRev` (מתעלם מ-echo עצמי); `forceAdopt()` על load/restore/visibilitychange/focus.
- **מיטיגציות סיכון (מהחקירה):** `setId` לכל סט (dedupe R3) · timestamp ארכיון = `liveSessionId` (R5, `finish`) · `clearLiveSession` ב-`copyResult`/`discardSession` (anti-zombie R4) · ה-proxy מוודא `active`+`sessionId`, מנרמל RIR למחרוזת (R1), מוודא w/r (R2) · טיימרים **לא** מסונכרנים דרך ה-doc (R8) · `enablePersistence` (R12) · timeouts לכל קריאה (R13).
- **scope:** השעון append-only (`logSet/nextExercise/getState`); clusters/1RM/swap-order/interruption מנוהלים בטלפון.
- **⚠️ חוב/בדיקה:** הלוגיקה של ה-live-sync (merge/adopt/ping-pong) **לא נבדקה על מכשירים אמיתיים** — דורשת אימות end-to-end עם Firebase+שעון. ה-proxy וה-Shortcut מותקנים בידי המשתמש (service-account + deploy + הרכבת הקיצורים). מגבלה: השעון צריך רשת בחדר הכושר.

---

## מסך Composition + אינטגרציית MyFitnessPal (v15.59–15.76)

מסך "Composition" (`ui-bodylog`, `bodylog-logic.js`) מחולק ל-2 טאבים בבורר `segment-wrapper`/`seg-btn` (זהה לאנליטיקה/ארכיון):
- **שקילה** — משקל + אחוז שומן, גרפים, היסטוריה, צילום/OCR, ייבוא/ייצוא CSV.
- **תזונה** — נתוני MyFitnessPal: כרטיס ממוצעים דינמי (קלוריות/חלבון/פחמימה/שומן) לפי טווח 7/30/90/הכל/**מותאם**, גרף קלוריות + גרף חלבון, היסטוריה יומית, 4 ייצואים — סיכום יומי (הכל/תקופה) + גולמי MFP per-meal (הכל/תקופה), וכפתור איפוס. ייצוא "תקופה" (יומי וגולמי כאחד) מכבד את בורר הטווח בראש המסך דרך `_blFilter`; הגולמי מסנן שורות לפי `_parseFlexDate(row[dateIdx])` (v15.83).

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

- **שדרוג UI/UX מול מתחרים (v15.98–15.99):** Wave 1 — קונטרסט AA (`--text-dim`→`#A6A6AD`), יעדי מגע ≥44px (::after hit-area), `100dvh`, `emptyStateHtml()` גלובלי, חגיגת PR (`_getHistoricalMaxE1RM`+`_celebratePR` ב-nextStep, סימון `isPR` בלוג). Wave 2 — `renderSetSessionTable()` (טבלה חיה + ghost מ-`getLastPerformances`+`parseSetsFromStrings`, מתרענן מ-initPickers/nextStep/saveSetEdit), מחשבון פלטות (`_calcPlates`, פרף `KEY_BAR_WEIGHT`), פירמידת חימום (`WARMUP_SCHEME`, pill בסט 1 כש-w≥40), toggle `KEY_SKIP_CONFIRM` שמדלג על ui-confirm דרך `confirmExercise(true)` (לא במצב סבב). Wave 3 (מוטיבציה) ו-Wave 4 ממתינים — ראה ROADMAP "כיוונים פתוחים".
- **Audit באגים עמוק (v15.97):** נמצאו ותוקנו — `saveData` לא דיווח כשל quota (עכשיו מחזיר bool, `_saveToArchive` מתריע); "שחזר מהענן" דרס ארכיון מקומי בלי אישור (נוסף `showConfirm`); `initPickers` קרס על `setIdx` מעבר לגבול בחזרה לתרגיל שהושלם (נוסף clamp); שמות עם גרשיים/`<` שברו `onclick` inline ו-innerHTML (נוספו `escapeHtml`/`escapeJsAttr` גלובליים ב-workout-core.js — להשתמש בהם בכל הזרקת שם!); `_parseFlexDate` ייבא תאריכים לא-קלנדריים ("12/13"); ל-SW fetch לא היה catch לכשל רשת.
- `git merge --theirs` יכול לכסות commits מ-main. תמיד לפתור conflicts ידנית.
- `localStorage.setItem` ללא try-catch = אובדן נתונים שקט ב-QuotaExceeded. כל שמירה = עטופה.
- לעולם לא `JSON.stringify(userObj)` בתוך `onclick=""` — HTML injection. העבר רק מזהה (timestamp).
- session-timer-strip נשלט אך ורק דרך `navigate()` (ו-`restoreSession()` שמשכפלת אותו). אין מקום אחר לגעת בו.
