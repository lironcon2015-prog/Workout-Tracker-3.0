# GYMPRO ELITE — Project Knowledge

> מסמך זה מכיל רק מידע שאינו נגזר מקריאת הקוד: החלטות, לקחים, מלכודות.

---

## גרסה נוכחית: 16.88

## TM קבוע לתרגילי MAIN (v16.78)

מטרה: לחסוך הזנת 1RM ידנית בתחילת כל תרגיל-מיין — TM נקבע פעם אחת בהגדרות (סמנטיקת 5/3/1: קבוע, לא מחושב מחדש כל אימון).

- **מודל:** `KEY_EXERCISE_TM` ב-storage.js — מפה `{exName: tmVal}`, `getExerciseTM`/`saveExerciseTM`/`getAllExerciseTMs`. ערך ריק = מחיקת מפתח (חוזר לזרימת 1RM הידנית). **לא** ב-`_connectionKeys()` (דאטה, לא סוד) ו**לא** בסנכרון Firebase config — תואם RM/weights הקיימים שגם לא מסונכרנים.
- **UI הגדרות:** `_renderMainTMSettings()` (workout-core.js) מרנדר שדה לכל שם תרגיל-מיין שנאסף מ-**כל** התוכניות (`_getAllMainExerciseNames`, לא רק התוכנית הנוכחית) ב-`#main-tm-settings-list` (הגדרות → מאמן). נקרא מ-`openSettings()`.
- **דילוג אוטומטי:** `confirmExercise()` — אם `getExerciseTM(exName) != null`, קורא ל-`applyRMAndStart(tm)` במקום `setupCalculatedEx()` (שפותח את `ui-1rm`). `applyRMAndStart` הוא ה-refactor המשותף שחולץ מ-`save1RM()` — שתי הזרימות (TM מוגדר / הזנה ידנית) מובילות לאותו חישוב סטים מאחוזי RM.
- **תצוגה — עדיפות session over settings:** `_displayTM(exName)` = `state.rmUsed[exName]` (אם בוצע בסשן הנוכחי) אחרת `getExerciseTM`. כך אם המשתמש משנה TM בהגדרות אחרי שכבר רשם סטים, הסיכום/הלוג ממשיכים להציג את הערך שבו **בפועל** בוצע התרגיל, לא את הערך העדכני בהגדרות.
- **נקודות תצוגה (חובה synchronized — באג עתידי אם רק חלק יתעדכן):** סיכום אימון (`buildSummaryUI`, badge בכרטיס), תג Main בארכיון (`_saveToArchive`, `(Main, TM: Xkg)`), ושלושת חלונות ה-Quick Menu — תרגילים (`openCurrentPlanSheet`), יומן (`openSessionLog`), היסטוריה (`openHistoryDrawer`). שלושתם משתמשים ב-`_isMainExInCurrentWorkout(exName)` (לא `item.isMain` ישיר — `openSessionLog`/`openHistoryDrawer` לא מחזיקים את ה-plan item, רק שם).
- **CSS:** `.plan-tm-badge`/`.card-tm-badge`/`.slog-tm-badge` — pill עקבי (`#353535`, `border-radius:9999px`), נפרד מ-`.plan-main-badge` (accent) כדי לא להתחרות חזותית. RTL: `margin-inline-start` (לא `margin-right`) — הבדג' מגיע אחרי הטקסט במקור ה-HTML ומוצג משמאלו.

## יומן מזון מובנה (Food Diary) — v16.40

תיעוד תזונה ישירות באפליקציה (חלופה/השלמה ל-MFP), מבוסס **Open Food Facts** (חינמי, ללא מפתח, CORS ישיר).

**עיקרון אינטגרציה (קריטי):** `KEY_NUTRITION_DAILY` הוא מקור-האמת היחיד לכל הצינור (כרטיס בית, Composition,
TDEE, AI). היומן הפנימי שומר רשומות per-food ב-`KEY_FOOD_LOG` ({date:[entry]}), ו-`recomputeNutritionDay(date)`
מסכם את היום → upsert ל-NUTRITION_DAILY עם `src:'app'`. כך כל הצרכנים הקיימים נדלקים **ללא שינוי בהם**.

**עדיפות בהתנגשות (החלטת משתמש):** `mfp > app > health`. `recomputeNutritionDay` **לא דורס** יום שמקורו MFP
(src ריק/undefined). לכן לוגינג פנימי אפקטיבי בעיקר ל"היום" ולימים שטרם יובאו מ-MFP; ייבוא MFP מאוחר ידרוס את
הסיכום היומי (רשומות היומן עצמן נשמרות תמיד).

**מודל:** `KEY_FOOD_LOG` (יומן), `KEY_FOOD_DB` (קאש OFF + מותאמים + מועדפים/אחרונים). יעדי מאקרו ב-prefs
(`proteinTarget/carbsTarget/fatTarget`), שמות ארוחות חופשיים ב-`mealLabels`.

**UI:** אין טאב קבוע — Overlay מסך-מלא (`#food-diary`) הנפתח מכפתור "יומן תזונה" בכרטיס הבית (מתחת ל-LIVE)
ובמסך Composition. ניווט ימים: חיצים + החלקה + בורר תאריך. "+" לכל ארוחה (סגנון MFP). עורך מנה/כמות/שעה/ארוחה.
ברקוד: **פענוח מקומי** (`_fdDecodeBarcode` עם `BarcodeDetector`) על הצילום לפני AI; כשל → Gemini לקריאת תווית.
**סריקה חיה** (`fdLiveScanStart`, overlay `#fd-live`, z-index 2000): `BarcodeDetector` בלולאת rAF, או ZXing
(`vendor/zxing.min.js`, טעינה עצלה) ב-iOS. ל-OFF דרך `lookupBarcode`. מנת אוכל/תווית עדיין דרך Gemini.

**לקחים:** (1) ids של מוצרי OFF ללא ברקוד מנוקים לתווים בטוחים ל-onclick. (2) חיפוש תלוי-רשת; אחרונים/מועדפים/
מותאמים עובדים offline (קאש ב-KEY_FOOD_DB). (2.5) **אחרונים/מועדפים — עדיפות לארוחה הנוכחית (v16.45):** `getFoodDb()`
שומר `mealUse: {meal: {count, lastUsed}}` שמתעדכן ב-`bumpFoodUsage(id, meal)` בכל שמירת מנה בפועל (`fdSavePortion`).
`StorageManager._mealSort(meal)` ממיין כל רשימת מזון כך שמוצרים שתועדו בארוחה מהסוג הנוכחי מובילים (לפי `lastUsed` שלהם
בארוחה הזו), ואחריהם השאר לפי `lastUsed` גלובלי. `recentFoods(n,meal)`/`favoriteFoods(meal)` משתמשים בזה ישירות —
`fdRenderTab` מעביר את `_fdMeal` הנוכחי. (3) z-index: overlay=300, ה-bottom-sheets (1000/1001) מעליו בכוונה.
(4) פענוח ברקוד = מקומי ומיידי, לא AI — AI שמור לקריאת תווית/הערכת מנה בלבד. (4.5) **חיפוש — עדיפות למתועד (v16.82):** `fdDoSearch` מפריד את התוצאות המקומיות התואמות ל-`used` (יש `lastUsed`) ומציב אותן תמיד בראש. **לקח:** לפני התיקון, ה-`merged` הסופי (אחרי שהרשת עונה) נבנה מ-`basics+foods` בלבד — כל התאמה מקומית (כולל מתועדת) שלא חזרה גם מהרשת **נעלמה** מהתוצאות אחרי שתשובת הרשת הגיעה; זו הייתה הסיבה שמוצרים מוכרים "ברחו" מהראש. (4.6) **מנוע דירוג חיפוש (v16.88):** `_fdScore(text,q)` — ציון רלוונטיות עם סמנטיקת AND (ריבוי מילים דורש את כולן) וגבולות-מילה ("חלב" מעדיף "חלב 3%" על "חלבון ביצה"; מילה-שלמה 85+ > תחילית 75 > substring 50). ≥50 = התאמה מלאה; 0<ציון<50 = חלקית, מוצגת רק מאחורי "הצג עוד" (`fdShowMoreResults`, קאפ `_FD_SHOW_LIMIT=12`); 0 = מוסתר (מסנן גם את רעש ה-full-text של צמ"ת שתואם שדות צדדיים). הציון כולל את המותג (`_fdFoodScore`). **סדר השכבות (החלטת משתמש):** תועדו-בארוחה-הנוכחית → מועדפים → תועדו-אי-פעם (`StorageManager.sortUsedForSearch`) → בסיסיים → רשת מדורגת (ציון, שובר שוויון צמ"ת>OFF>USDA ואורך שם) → cache לא-מתועד. שכבת "המזונות שלך" כוללת גם מועדפים בלי `lastUsed`. **OFF דו-שלבי:** `_offQuery(q, israelOnly)` — קודם מוצרים מתויגי-ישראל ממוינים לפי פופולריות (`sort_by=unique_scans_n`; במודרני — `countries_tags:"en:israel"` בתוך q), ואם <5 תוצאות — השלמה גלובלית. **קאש רק בבחירה:** הוסרה השמירה הגורפת של תוצאות רשת ל-KEY_FOOD_DB (זיהום מצטבר שסונכרן גם לענן); מוצר נשמר רק ב-`fdSelectFoodById`/ברקוד/AI. ניקוי חד-פעמי `pruneUnusedFoodCache` (storage.js, שמרני — רק off/usda/tzameret בלי שום אות שימוש) רץ ב-`openFoodDiary` עם דגל `gympro_fd_cache_pruned`. (5) USDA אנגלי-בלבד: `_fdTranslateForUsda`
ממפה עברית→אנגלית (`_FD_HE_EN`) לפתיחת חומרי גלם גנריים (דורש מפתח USDA). (6) `_fdTokenMatch` — התאמת חיפוש
מבוססת-טוקן+נרמול ניקוד, מחליפה `indexOf` נאיבי. (7) ZXing מ-`vendor/` — runtime-cache ב-SW, לא pre-cache (336KB). (8) **Gemini כ-fallback תזונתי** (`_fdAiFood`/`fdAiLookup`):
שורת "הערכת AI" יזומה (`_fdAppendAiAction`) קבועה מתחת לתוצאות, ואוטומטית ב-0 תוצאות. מזון גנרי = ערכים סטנדרטיים אמינים,
נשמר ב-DB (id `ai:`) → קאש מיידי+offline. פותר מזון טריוויאלי בעברית בלי מאגר/מילון ידני. (9) **עריכת מזון מותאם + יחידות מידה (v16.83):**
עיפרון עריכה (`fdEditCustomFood`) בכל שורת מזון עם `source==='custom'` (כל רשימות המזון — `_fdRenderFoodList` משותף לכולן) פותח את אותו טופס יצירה
(`_fdShowCustomFoodForm`, מצב משותף create/edit לפי `_fdEditCustomFoodId`) ושומר במקום דרך `upsertFoodToDb` (merge-by-id קיים — משמר `useCount`/`favorite`/`mealUse`
ללא שינוי ב-storage.js). רשומות שתועדו בעבר (`KEY_FOOD_LOG`) שומרות snapshot קפוא של `per100` באותו רגע — עריכה מאוחרת **לא** משנה היסטוריה (`recomputeNutritionDay`
מסכם מ-`entry.kcal/p/c/f` המוכנים מראש, לא מ-`per100`). **יחידת מידה:** `food.baseUnit`/`entry.baseUnit` ∈ `'g'|'ml'|'unit'` (ברירת מחדל `'g'`, לא קיים במזון
חיצוני/ישן — שומר תאימות מלאה). **טריק יחידה בודדת (×100):** המודל הפנימי מחושב כולו כ-`per100 * grams/100`; כדי לבטא "ערך ליחידה אחת" (לדוגמה ביצה) בלי
לשנות את הנוסחה הזו, הערך המוזן מוכפל ×100 לפני האחסון ב-`per100`, וה-`servings` מוגדר ל-`[{label:'1 יחידה', grams:1}]` — כך `grams=qty` ו-`macros=realValue*qty`
מתקבלים נכון ללא כל שינוי בלוגיקת `_fdComputeGrams`/`_fdMacrosFor`. כל מקום שמציג `per100` גולמי ישירות למשתמש חויב בחילוץ ÷100 מפורש: `_fdRenderFoodList`
(שורת תוצאה), `_fdShowCustomFoodForm` (prefill בעריכה), `_fdUpdatePreview`/`_fdQtyDisplayLabel` (תצוגת כמות חיה). **Meal Builder — תוקן (v16.84):** רכיבי
ה-Meal Builder (`_fdMealComponents`) נושאים כיום `baseUnit` (מועבר מ-`_fdAddComponentFromFood`, משוכפל ב-`_fdOpenMealBuilder`/`fdEditEntry`, ונשמר בסנאפשוט
הקפוא ב-`fdSaveMeal`). מזון מסוג `'unit'` מנורמל ל"ערך אמיתי ליחידה" (÷100) כבר בכניסה לרכיב — לא נשמר טריק ×100 בתוך ה-Meal Builder. `_fdRenderComponents`/
`_fdMealRecalc` מציגים תווית "ליחידה:"/"יחידות" ומחשבים `kcal = perUnit * qty` (לא `/100`) עבור `baseUnit==='unit'`; שאר היחידות (`g`/`ml`) ללא שינוי.
**מחיקת מזון מותאם (v16.84):** `StorageManager.deleteFoodFromDb(id)` (לצד `upsertFoodToDb`) מסנן מ-`KEY_FOOD_DB`; אין צורך בניקוי הפניות — רשומות יומן עצמאיות (snapshot קפוא).
כפתור מחיקה (`fdDeleteCustomFood`, `.fd-del-btn`) מופיע רק במצב עריכה בתוך `_fdShowCustomFoodForm`, עם אישור דרך `showConfirm` (בלתי-הפיך, בשונה ממחיקת רשומת יומן בודדת).
**קיצור דרך לטאב מותאמים (v16.84):** כפתור `.fd-manage-btn` בכותרת יומן המזון (מקום `.fd-header-spacer` הישן) → `fdOpenCustomFoodsManager()` פותח את שיט ההוספה ישר על טאב "מותאמים".
**התראת חוסר-תאימות קלוריות/מאקרו (v16.87):** `_fdKcalMismatch(kcal,p,c,f)` — בדיקת Atwater טהורה (`p*4+c*4+f*9`), ללא state/persist; מחזיר null מתחת לסף (>30 קלוריות ושני הצדדים, סטייה >15%) או יחס הסטייה. מוצג בשלוש נקודות הזנה: עורך המנה (`_fdUpdatePreview`, מכסה את כל המקורות — OFF/Gemini/מותאם/מועדפים/אחרונים כי כולם עוברים `_fdOpenPortion`), טופס מזון מותאם (`_fdCustomCheckMismatch` עם `oninput` על 4 השדות — actionable כי המשתמש הקליד את הערכים), Meal Builder לפי-מרכיב (`_fdMealRecalc`, סימן ⚠ קטן עם `title` ליד kcal כל מרכיב בנפרד). אזהרה אינפורמטיבית בלבד — לא חוסמת שמירה, לא נשמר flag חדש ב-storage (ניתן לשחזור מ-`per100`/`kcal/p/c/f` הקיימים). תקדים: `bl-tdee-warn` ב-bodylog-logic.js.
**הערה יומית (v16.85):** `KEY_NUTRITION_NOTES` (מפה `{date: text}`) **בכוונה עצמאי** מ-`KEY_NUTRITION_DAILY` — לא שדה על רשומת היום. סיבה: `recomputeNutritionDay`/`mergeHealthNutritionDays`/`applyMfpDays` עושות דריסה מלאה של רשומת היום (לא מיזוג שדות), ושדה `note` היה נמחק בשקט בכל לוג/מחיקת מזון או ייבוא MFP/Health עתידי; וביום בלי שום רשומת תזונה אין רשומה להצמיד אליה הערה בלי ליצור רשומת-דמה שמזהמת ממוצעים/streaks/heatmap שצורכים `getNutritionDaily()`. `getNutritionNote`/`setNutritionNote` ב-storage.js; UI דרך שיט משותף `#fd-portion-sheet` (`_fdShowNoteForm`/`fdSaveNote`, אותה תבנית כמו `_fdShowMealNamePrompt`) ושורת `.fd-note-row` ב-`fdRender` בין הסיכום לארוחות. ריק = מחיקת ההערה. מסונכרן לגיבוי/ענן כדאטה רגיל (לא ב-`_connectionKeys()`, תואם תקדים `KEY_EXERCISE_TM`).

---

## מסך הבית — כרטיסי "היום" (v16.05)

- הטאב "אימון" שונה ל-**"בית"**: סקשן השיאים האישיים הוחלף בשתי כרטיסיות "היום" — תזונה (ימין, LIVE badge כשהנתון מהיום) והרכב גוף (שמאל: משקל, אחוז שומן, LBM, שינוי 30 יום). לחיצה מנווטת ל-Composition עם תת-טאב מתאים (`goToComposition` קובע `_blTab` לפני `switchMainTab` — בלי `setBodyTab`, שמרנדר כפול).
- סקשן ה-PR **לא נמחק** — pref חדש `homeCard: 'today' | 'pr'` ב-analytics prefs + toggle בהגדרות (`toggleHomeCard`/`applyHomeSectionPref` ב-archive-logic.js). **מלכודת:** `getAnalyticsPrefs()` לא ממזג defaults למשתמשים קיימים — כל קריאה חייבת `prefs.homeCard || 'today'`.
- רענון הכרטיסים: בכל `switchMainTab('workout')` + אחרי כל שינוי דאטה (שקילה/מחיקה/ייבוא CSV, סנכרון Health, ייבוא MFP, איפוס תזונה) דרך `renderHomeTodayCards()`.
- **טווח חישוב TDEE ידני (v16.10):** pref `tdeeStartDate` (null = אוטומטי, 28 ימים/תחילת שלב+7). כשמוגדר — `computeTDEE` עוקף את לוגיקת השלב ומושך מהתאריך הידני. נקודות כניסה לבורר התאריך (`#tdee-range-modal`): שורת "טווח חישוב" בראש הפירוט + מספר הימים בטבלת השיטות (שתיהן `openTdeeRangeModal`). מצב "ריק" (טווח ידני שמרוקן נתונים) מציג קישור reset כדי למנוע מצב לכוד.
- **רענון Health מהבית (v16.09):** תג ה-LIVE בכרטיס התזונה לחיץ — `refreshHomeNutrition()` → `syncHealthNutrition(true)` עם `stopPropagation` (שאר הכרטיס מנווט ל-Composition). התג מוצג רק כשיש נתון מהיום — ביום ללא נתונים אין נקודת רענון בבית.
- **יעד קלורי יומי (v16.08):** pref `kcalTarget` (null = כבוי), קלט בבנטו ה-Nutritional State (הגדרות → מאמן, `saveKcalTarget` ב-workout-core.js). כרטיס התזונה בבית מציג מתחת לצריכה את ההפרש יעד−צריכה — מספר בלבד, ירוק כשנותר / אדום כשחרגו, `direction:ltr` כדי שהמינוס יוצג נכון.

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
- **התקנת SW חייבת `fetch(url, {cache:'no-store'})` + `cache.put`** (תוקן ב-15.97.1) — `cache.addAll` רגיל עובר דרך ה-HTTP cache של iOS ומקבל קבצים ישנים: נוצר cache עם שם גרסה חדש אבל תוכן ישן, כולל `version.json` ישן → "עדכון זמין" קופץ לנצח והגרסה לא מתעדכנת. ייתכן שזה גם גרם בעבר לתיקונים "שלא עבדו" — הם לא הגיעו למכשיר.
- `checkForUpdate` ממתין ל-`reg.update()` + `controllerchange` (עד 4 שניות) לפני הרענון — אחרת ה-SW הישן מגיש את הרענון והעדכון נראה "תקוע".
- push לbranch `claude/**` בלבד לא מספיק — האפליקציה מוגשת מ-`main`.
- GitHub Actions auto-merge **קורס על push שני+** לאותו branch (branch כבר קיים). **חובה: merge ידני** לאחר כל push.
- `sw.js` + `version.json` חייבים להשתנות באותו commit עם שאר הקבצים. bump גרסה ב-commit נפרד = cache ישן לטעות.

---

## ערכות צבעים (Color Themes) — v16.38→16.39

6 ערכות: `obsidian` (ברירת מחדל, ללא attribute), `bronze` (iPhone 16), `midnight`, `crimson`, `emerald`, `purple`.

**ארכיטקטורה:**
- כל ערכה דורסת משתני CSS תחת `html[data-theme="..."]` ב-`style.css`. נשמר ב-`analyticsPrefs.colorTheme`.
- החלה מוקדמת ע"י סקריפט inline ב-`<head>` (לפני paint) למניעת הבזק; `initColorTheme()` ב-DOMContentLoaded כגיבוי.
- `applyColorTheme(id, el)` / `syncThemePicker()` / `themeVar(name, fallback)` ב-`workout-core.js`.

**לקח קריטי — למה גרסה ראשונה (16.38) הרגישה זניחה:** דריסת `--accent` לבדה לא מספיקה. הזהות הכחולה הייתה
קשיחה בעשרות נקודות: **75 מופעי `rgba(10,132,255,α)`** ב-CSS, ~14 `#0A84FF` ישירים, וגרפי SVG ב-JS
(`drawMicroLineChart`, דונאט, bodylog) עם hex קשיח שלא מגיב ל-CSS.
**הפתרון (16.39):** טוקן `--accent-rgb: R, G, B` ב-`:root` + כל ערכה → ואז `rgba(var(--accent-rgb), α)`
בכל 75 המקומות. הגרפים קוראים `themeVar('--accent')` בזמן ציור (לא hardcode). רקע `body::before` עבר
לשתי שכבות `--ambient-1/2` בעוצמה מורגשת (aurora/eclipse לכל ערכה). `<meta theme-color>` מתעדכן דינמית.

**מה נשאר קבוע בכוונה (סמנטיקה):** `--type-b/c/free`, danger אדום, success ירוק, `HEATMAP_MUSCLE_COLORS`
(מפת שרירים), `HOME_PR_COLORS` (Bench ירוק/OHP כתום), `nutri-log-dot--cut`, ופלטת בורר הצבעים
ב-`editor-logic.js` (בחירת משתמש, לא ערכה).

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
| Session strip | `height: 50px+safe-area` עם `box-sizing:border-box` (בלעדיו ה-safe-area נספר פעמיים והפאנל קופץ בגובה — התיקון היחיד ששרד את ה-revert), fixed bottom, `z-index: 199`, מוסתר מחוץ ל-workout flow |

**⏪ REVERT (החלטת משתמש): v15.98–v16.3 בוטלו — האפליקציה הוחזרה ל-v15.97.**
הגרסאות שבוטלו כללו: Wave 1+2 (ליטוש UI, חגיגת PR, טבלת סטים חיה, מחשבון פלטות/חימום), LOG SET ב-strip → רישום מהטבלה, טיימר מנוחה ב-strip, PR/פלטות ב-Live, מלאי פלטות מותאם, וניסיונות תיקון "באג התחתית המורמת". הבאג שרד את כל הניסיונות והמשתמש ביקש לעצור. הקוד שמור בהיסטוריה (`853ed82`…`fa7d0a1`) — אפשר לשחזר פיצ'רים נקודתית בעתיד.

**לקחים מהחקירה (לשימור — הבאג עדיין לא פתור):**
- אומת בניתוח פיקסלים: הבר התחתון מרחף בדיוק ~גובה ה-status bar (~60pt) מעל התחתית אחרי רענון, ומתחתיו נחשף רקע ה-body.
- מנגנונים שנבדקו ולא פתרו לבד: ➊ מקלדת iOS גוללת את ה-window בלי להחזיר ל-0 (scrollTo(0,0) על focusout); ➋ `window.location.reload()` ב-standalone+black-translucent מייצר layout viewport קצר (הוחלף ב-`location.replace()` + נדנוד `_kickViewport`).
- `position:fixed` בתוך `.content-area` (scroller) לא אמין ב-iOS לאלמנטים צפים.
- כיוון חקירה עתידי: מדידה חיה ב-Safari remote inspector (`innerHeight` / `visualViewport.height+offsetTop`) ברגע שהבאג פעיל; או מעבר ל-layout שלא מסתמך על fixed — app-container כ-grid עם שורת bars אמיתית ב-flow.

---

## חוב טכני פתוח

| # | תיאור | חומרה |
|---|-------|-------|
| 1 | `details` ב-ArchiveEntry לא שומר cluster per-round — רק per-exercise | נמוכה |
| 2 | archive entries ישנים (לפני 14.12.0-24) חסרים שדה `week` — AI block comparison נופל ל-fallback | נמוכה |
| 3 | ✅ נפתר — `updatePlanFloatBtn` כבר לא מחפש `.header-tools`, רק מנקה כפתורים מוזרקים | — |
| 4 | ✅ נפתר — הארכיון מפוצל ל-chunks (`ARCHIVE_CHUNK_SIZE=20`, `archive_meta`+`archive_N`). הקובץ הגולמי של MFP מפוצל גם הוא (`nutrition_raw_meta`+`nutrition_raw_N`, 1000 שורות/מסמך). מסמך `config` נשאר קל (נתונים קטנים) | — |
| 5 | עריכת סט במסך הסיכום אחרי שנוצר `aiSummary` לא מרעננת אותו — הסיכום עלול להפוך לא-מסונכרן | נמוכה |
| 6 | המלצת AI לסט (set-rec) מציגה תמיד יחידת kg — גם בתרגילי פלטות/משקל גוף | נמוכה |
| 7 | ✅ נפתר (v16.81) — עריכת סט details-only כעת בונה מחדש את הסטרינג לפי mode (kg/פלטות/BW), לא קשיח kg | — |

---

## שיטות משקל לתרגיל — kg / פלטות / משקל גוף (v15.98)

- **מודל:** `weightMode: 'kg'|'plates'|'bw'` על התרגיל (עורך התרגיל); דגל `isBW` ישן ממופה ל-`bw` כש-`weightMode` חסר. רשומת לוג מקבלת `wm` רק כשהשיטה אינה kg.
- **החלפה תוך כדי אימון:** לחיצה על תווית כרטיס המשקל (`cycleWeightMode`) — נשמרת ב-`state.sessionWeightModes` (חד-פעמית לאימון, לא משנה את הגדרת התרגיל).
- **ווליום:** פלטות = `פלטות × PLATE_KG(=2.5) × חזרות`; משקל גוף = 0 (חזרות בלבד) — החלטת מוצר.
- **פורמט סטרינג סט בארכיון self-describing:** `"80kg x 5"` / `"5 פלטות x 10"` / `"BW x 12"`. כל הפרסרים (`_setStrVol`, `_parseSetString`, `parseSetsFromStrings`) מטפלים בשלושת הפורמטים. **אין לשנות פורמט בלי לעדכן את כולם.**
- **prefill:** `saveWeight` נשמר רק כשהשיטה תואמת את ברירת המחדל של התרגיל — override זמני לא מזהם אימונים הבאים.
- **אחידות פיקרים (v16.01):** ההחלפה זמינה גם ב-Live (`live-edit-sheet`) — תווית כרטיס המשקל לחיצה, `_syncLiveWeightModeUI` מסנכרן תווית/יחידה/+-. **לקח:** ה-Live הוא חזית שנייה לאותם pickers — כל פיצ'ר בפיקרים חייב לחול גם שם (כלל ב-CLAUDE.md).
- **מנוע פיקרים עצמאי למודאל עריכת סט — יומן+ארכיון (v16.81):** `edit-set-modal` (נפתח מהיומן הפעיל ומהארכיון, כולל רשומות details-only ישנות בלי `log`) קיבל ממשק stepper-card זהה ויזואלית לפיקרים הראשיים (משקל⇄/+-/הזנה ידנית, אותו CSS גלובלי בלי שינוי), אבל **לא** מחובר ל-`<select>`-ים הגלובליים/ל-`state.currentExName` — כי הוא עלול לערוך סט מתרגיל לא-פעיל או מאימון ארכיון בלי session בכלל. מנוע נפרד ומקומי: `_editModalMode`/`_editModalVals` + `_editModalInit/_editModalRenderModeUI/_editModalRenderValue/_editModalCycleMode/_editModalStep/_editModalEditValue` (workout-core.js). מצב ההתחלה נקרא מ-`entry.wm||'kg'` (log) או מ-`_parseSetString` המורחב (details-only — מזהה `BW`/`פלטות`/`kg` מהסטרינג ומחזיר `mode`). שמירה: `saveSetEdit`/`saveArchiveSetEdit` כותבים את ה-mode בחזרה ל-`entry.wm` (log) או בונים מחדש את הסטרינג בפורמט הנכון לפי מצב (details-only) — **פותר את חוב #7 למטה** (עריכת סט details-only הייתה תמיד נכתבת מחדש כ-kg).

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
- **ביצועי AI (v16.03):** `_callGeminiOneShot` זוכר את המודל האחרון שהצליח (`gympro_ai_pref_model`) ובודק אותו ראשון — מפתח שחוטף 404/429 במודל הראשון לא משלם סיבוב מבוזבז בכל קריאה. נוסף timeout לניסיון (20ש'/60ש' freeText). המלצת plateau באנליטיקה רצה כ-freeText — מצב ה-JSON הכפוי התנגש עם פרומפט "plain text" וגרם לאיטיות.
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

## גשר תזונה Apple Health (v15.99)

- **זרימה:** MFP → Apple Health → קיצור דרך (אוטומציות 10:00/14:00/18:00/23:45) → `health-nutrition-bridge.gs` (PropertiesService, ~120 ימים, בלי Firestore/SA) → ה-PWA מושך JSONP.
- **משיכה:** בכל כניסה לאפליקציה (load + visibilitychange) + כל שעה עגולה כשהיא פתוחה + כניסה לטאב Composition. throttle 15 דק' (`syncHealthNutrition`), שקט לחלוטין במצב אוטומטי.
- **כלל הזהב — MFP מקור האמת:** ימי Health מסומנים `src:'health'` ב-`nutritionDaily`. `mergeHealthNutritionDays` לעולם לא דורס יום MFP; `saveNutritionDaily` (ייבוא MFP) דורס הכל כולל ימי Health. ל-Health אין per-meal — `nutritionRaw` נשאר בלעדי ל-MFP ולא נגעו בו.
- **לימי Health אין `meals`/per-meal** — בייצוא המפורט יום כזה יוצא `source:'summary'` (totals בלבד) עד שייבוא MFP/תיעוד ישיר מוסיף פירוט.
- **מסך תזונה (v16.00):** כרטיס "תזונה היום" (`bl-daily-card`) מעל הממוצע — נתוני היום + חותמת משיכה אחרונה (`KEY_HEALTH_LAST_SYNC`). כל פעולות ייבוא/ייצוא אוחדו ל-bottom sheet אחד (`nutri-io-sheet`) שנפתח מכפתור בכרטיס היומי. **ממוצע התזונה ומנוע ה-TDEE מחריגים את היום הנוכחי** (תיעוד חלקי תוך-יומי מ-Health מטה אותם). כרטיס המאזן מקופל כברירת מחדל (hero+קצב נוכחי) — `_blTdeeExpanded`.

## ייצוא/ייבוא — סדר (v16.58)

- **מתג הפעלה/כיבוי לכל גשר:** MFP ו-Health כעת ניתנים לכיבוי (`KEY_MFP_BRIDGE_ON`/`KEY_HEALTH_BRIDGE_ON`, **ברירת מחדל דלוק** — רק `'0'` מכבה, להבדיל מהשעון שכבוי). Gating בנקודה אחת: `syncHealthNutrition` ו-`importNutritionFromGmail` בודקים `is…BridgeOn()` בראש. שלושת ה-`*_ON` בקובץ החיבורים.
- **ייצוא תזונה — בדיוק 2 קבצי JSON מכבדי-פיקר** (`_nutritionRangeBounds` ← `_blRange`/`_blCustom`): `exportNutritionDailyJson` (מקוצר: date+cal+macros) ו-`exportNutritionDetailedJson` (מפורט). הוסרו: `exportNutritionCsv`, `exportNutritionRawCsv`, `exportFoodDiaryJson`.
- **`_buildNutritionDetailed(from,to)`** (בונה משותף לייצוא הנפרד ולמאוחד) — **קדימות ליום: תיעוד ישיר (`getFoodLogDay`) גובר על MFP**; אחרת שורות MFP; אחרת סיכום. מקור יחיד ליום, בלי ספירה כפולה. כולל `components` של Meal Builder.
- **קובץ מאוחד (`exportUnifiedData`):** `nutrition_raw_mfp` הוחלף ב-`nutrition_detailed`. כעת = weights + nutrition_daily + nutrition_detailed + workouts.
- **המאגר המקומי בענן בלבד:** `KEY_FOOD_DB`+`KEY_FOOD_LOG` מסונכרנים דרך מסמך `config` (saveConfigToCloud) — אין ייצוא JSON מקומי.
- **קובץ החיבורים:** נוסף `KEY_USDA_KEY`. כלל ב-CLAUDE.md: בכל סוד/אינטגרציה חדשים — לשאול אם לכלול ב-`_connectionKeys()`.
- **סריקת ברקוד חופשית (v16.67):** `fdLiveScanStart` (food-logic.js) משתמש ב-`_FD_CAM_CONSTRAINTS` (1080p, environment) במקום מצלמה בברירת מחדל; `_fdTuneCamera` מפעיל `focusMode:'continuous'` ומזהה תמיכת `torch` (כפתור `fd-live-torch` + `fdLiveToggleTorch`). נתיב iOS (ZXing) עם hints `TRY_HARDER`+`POSSIBLE_FORMATS` ו-`decodeFromConstraints` ברזולוציה גבוהה (fallback ל-`decodeFromVideoDevice`); כיוון מצלמה ב-ZXing דרך `_fdTuneWhenReady` (polling ל-`video.srcObject`, לא נסמך על promise הסורק). לולאת native עברה מ-RAF ל-throttle 120ms. כל ה-capability tuning guarded → no-op במכשירים ישנים. הזיהוי תמיד full-frame; המסגרת רוככה ל-UX סלחני.
- **אבחנת ארוחות בצבע (v16.66):** `_FD_MEAL_ACCENT` (food-logic.js) ממפה ארוחות ברירת מחדל לגוון עדין (בוקר=ענבר/צהריים=ירוק/ערב=אינדיגו/נשנוש=סגול). `_fdMealsHTML` מזריק `--fd-meal-accent` ל-`.fd-meal`; ה-CSS (`.fd-meal` border-inline-start, `.fd-meal-icon`, `.fd-meal-add`) צובע דרך `color-mix(... var(--fd-meal-accent, var(--accent)) ...)`. ארוחה מותאמת/ששמה שונה → נופל ל-`var(--accent)`. מוקאפ ההשוואה: `docs/mockup-meal-distinction.html`.
- **נראות יומן מזון לסוכן (v16.65):** `_buildFoodDiaryAIContext(slim)` (workout-core.js) מזריק ל-system prompt את פירוט `getFoodLog()` — היום לפי ארוחות+פריטים+מאקרו, יעדי `getAnalyticsPrefs`, ו-7 ימי היסטוריה (guard ~3K, `!slim` בלבד), אחרי `_buildNutritionAIContext`. תוקן תיוג `src==='app'`→"יומן פנימי" (היה "MyFitnessPal"). הסוכן ראה קודם רק סיכומי NUTRITION_DAILY, לא רזולוציית מזון/ארוחה.
- **מרכיב מהמאגר (v16.64):** ב-Meal Builder כפתור "חפש מרכיב" (`fdMealSearchComponent`) פותח את שיט החיפוש במצב `_fdCompPickMode` (body class `fd-comp-pick` מרים z-index מעל ה-Meal Builder). בחירת תוצאה → `_fdAddComponentFromFood` (במקום `_fdOpenPortion`) מוסיפה כמרכיב עם per100. `closeFoodAdd`/`_fdOpenPortion` מאפסים את המצב. כפתור "ידני" נשאר להזנה ידנית.
- **זרימת ברקוד (v16.62):** `resolveBarcode(code)` — resolver מרוכז: `KEY_FOOD_DB` לפי ברקוד (מיידי, offline, נסרק בעבר) → OFF (`lookupBarcode`). מחליף קריאות ישירות ב-`fdOnPhoto`/`_fdLiveOnHit`. בהחטאה: `_fdPendingBarcode` מצמיד את הברקוד למזון שייבנה מ-OCR תווית (`_fdLabelViaGemini`, id `off:<barcode>`) → זיהוי חד-פעמי שנשמר ל-cache ומסונכרן. בסריקה חיה — כפתור "צלם תווית" (`fdLiveSnapLabel`, רק עם מפתח Gemini). `_isIsraeliBarcode` (729) להתאמת ההודעה. קטלוג שקיפות-מחירים נדחה (אין API חי).
- **צמ"ת (v16.61):** מקור גנרי עברי רשמי דרך CKAN `data.gov.il` (`searchTzameret`, resource `c3cb0630...`, per-100g, שדות `shmmitzrach`/`food_energy`/`protein`/`total_fat`/`carbohydrates`). מקביל ל-OFF/USDA ב-`searchFoods`, **בראש התוצאות**, cache ל-`KEY_FOOD_DB` → offline+סנכרון. כשל/CORS → `[]` ללא רגרסיה. צ'יפ `tzameret`. (תלוי ב-CORS של data.gov.il — לאמת בדפדפן.)
- **grams מצרפי (v16.59):** בפריט מנה עם `components`, ה-`grams` ברמת-הפריט הוא 0 (המשקל ברכיבים). `_detailMealsFromEntries` דורס `item.grams = sum(components.grams)`. עיקרון: כל שדה מצרפי ברמת-פריט = סכום עקבי של הרכיבים (יש console.warn אם kcal חורג).

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

- **תאריכים: תמיד מקומי, לעולם לא `toISOString().slice(0,10)`** (v16.04) — UTC החזיר את "אתמול" בין חצות ל-03:00 שעון ישראל; היום שהסתיים לא "נסגר" בתזונה (נשאר מסונן מהיסטוריה/ממוצע/גרפים) עד לפנות בוקר. תוקן ב-`_blTodayStr`/`_blCutoff`/`StorageManager._todayStr`. שמות קבצים להורדה נשארו UTC — קוסמטי.


- **שדרוג UI/UX מול מתחרים (v15.98–15.99):** Wave 1 — קונטרסט AA (`--text-dim`→`#A6A6AD`), יעדי מגע ≥44px (::after hit-area), `100dvh`, `emptyStateHtml()` גלובלי, חגיגת PR (`_getHistoricalMaxE1RM`+`_celebratePR` ב-nextStep, סימון `isPR` בלוג). Wave 2 — `renderSetSessionTable()` (טבלה חיה + ghost מ-`getLastPerformances`+`parseSetsFromStrings`, מתרענן מ-initPickers/nextStep/saveSetEdit), מחשבון פלטות (`_calcPlates`, פרף `KEY_BAR_WEIGHT`), פירמידת חימום (`WARMUP_SCHEME`, pill בסט 1 כש-w≥40), toggle `KEY_SKIP_CONFIRM` שמדלג על ui-confirm דרך `confirmExercise(true)` (לא במצב סבב). Wave 3 (מוטיבציה) ו-Wave 4 ממתינים — ראה ROADMAP "כיוונים פתוחים".
- **Audit באגים עמוק (v15.97):** נמצאו ותוקנו — `saveData` לא דיווח כשל quota (עכשיו מחזיר bool, `_saveToArchive` מתריע); "שחזר מהענן" דרס ארכיון מקומי בלי אישור (נוסף `showConfirm`); `initPickers` קרס על `setIdx` מעבר לגבול בחזרה לתרגיל שהושלם (נוסף clamp); שמות עם גרשיים/`<` שברו `onclick` inline ו-innerHTML (נוספו `escapeHtml`/`escapeJsAttr` גלובליים ב-workout-core.js — להשתמש בהם בכל הזרקת שם!); `_parseFlexDate` ייבא תאריכים לא-קלנדריים ("12/13"); ל-SW fetch לא היה catch לכשל רשת.
- `git merge --theirs` יכול לכסות commits מ-main. תמיד לפתור conflicts ידנית.
- `localStorage.setItem` ללא try-catch = אובדן נתונים שקט ב-QuotaExceeded. כל שמירה = עטופה.
- לעולם לא `JSON.stringify(userObj)` בתוך `onclick=""` — HTML injection. העבר רק מזהה (timestamp).
- session-timer-strip נשלט אך ורק דרך `navigate()` (ו-`restoreSession()` שמשכפלת אותו). אין מקום אחר לגעת בו.
