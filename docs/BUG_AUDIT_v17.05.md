# דוח בדיקת באגים עמוקה — GYMPRO ELITE v17.05

תאריך: 05.07.2026 · היקף: כל קבצי ה-JS (‏~16K שורות), index.html, sw.js, manifest, בדיקות הצלבה אוטומטיות (handlers↔הגדרות, IDs, פונקציות מתות, כפילויות).
**אף תיקון לא בוצע** — הדוח בלבד. כל ממצא כולל מיקום מדויק.

---

## 🔴 חומרה גבוהה

### 1. תיקון ה-thinking של Gemini 3 הוחל רק בפונקציה אחת מתוך שבע
`_callGeminiOneShot` (workout-core.js:2436) מזהה מודלי `gemini-3` ושולח `thinkingLevel:'low'` במקום `thinkingBudget:0` — עם הערה מפורשת שבלעדיו המודל "חושב" עד תקרת הטוקנים ומחזיר טקסט ריק. אבל **שש קריאות API אחרות עדיין שולחות `thinkingBudget:0` קשיח**:
- `callGeminiAPI` — צ'אט המאמן (workout-core.js:4814)
- `_callGeminiVision` — OCR שקילה (bodylog-logic.js:1158)
- `_callGeminiFood` — קריאת תווית (food-logic.js:441)
- `_callGeminiMeal` — הערכת מנה מצילום (food-logic.js:466)
- `_fdAiNutrition` — הערכת AI בחיפוש מזון (food-logic.js:951)
- `_fdAiParseLabelText` — ניתוח טקסט תווית (food-logic.js:1381)

מכיוון שרשימת המודלים כברירת מחדל מתחילה ב-`gemini-3-flash-preview` (storage.js:605), צ'אט המאמן עם `maxOutputTokens` 768 וכל פיצ'רי ה-Vision (‏120–400 טוקנים) עלולים לשרוף את התקציב על מחשבות ולהחזיר תשובה ריקה/קטועה, או ליפול למודל הבא אחרי סיבוב מבוזבז. **תיקון**: לחלץ את `_thinkingConfig(modelName)` לפונקציה משותפת ולהשתמש בה בכל שבע הקריאות.

### 2. עריכת קבוצת כינויים מוחקת אותה לפני אישור — אובדן נתונים בביטול
`_editAliasGroup` (archive-logic.js:1543-1553) עושה `delete prefs.workoutAliases[g]; saveAnalyticsPrefs(prefs);` **מיד בכניסה למצב עריכה**, לפני שהמשתמש שמר. אם המשתמש סוגר את ה-sheet (גרירה למטה / overlay / "ביטול" בשלב 1) — הקבוצה אבדה לצמיתות. **תיקון**: לדחות את המחיקה ל-`_saveAliasGroup` (מחיקת השם הישן רק ברגע השמירה).

### 3. wakeLock לעולם לא משוחרר ולא נרכש מחדש אחרי רקע
- `enterWorkoutLiveMode` (workout-core.js:5749) רוכש wake lock עם guard ‏`!wakeLock`. כשהאפליקציה עוברת לרקע המערכת משחררת את ה-lock אוטומטית, אבל המשתנה עדיין מחזיק את האובייקט המשוחרר → בכניסה הבאה ל-Live המסך **לא** יישמר דולק.
- `exitWorkoutLiveMode` (5760) לא קורא `wakeLock.release()` — המסך נשאר נעול-דולק גם אחרי יציאה.
- `toggleSound` (643) רוכש wake lock בהדלקת צלילים ולעולם לא משחרר — בזבוז סוללה גם מחוץ לאימון.

**תיקון**: להאזין ל-`wakeLock.addEventListener('release', () => wakeLock = null)`, לרכוש מחדש ב-visibilitychange כש-Live פעיל, ולשחרר ביציאה.

### 4. TM, משקלים אחרונים ו-1RM לא מסונכרנים לענן ולא בקובץ הקונפיג
`saveConfigToCloud` (storage.js:1603) ו-`exportConfiguration` (storage.js:506) לא כוללים את `KEY_EXERCISE_TM`, `KEY_WEIGHTS`, `KEY_RM` (וגם לא `gympro_hidden_thumbs`). הם קיימים רק בגיבוי הידני (`getAllData`). משתמש שמשחזר מכשיר מהענן ("שחזור מלא") מאבד בשקט את כל ה-TM שהוגדרו בהגדרות (וזרימת דילוג-ה-1RM מתאפסת), את ה-prefill של משקלים אחרונים ואת ההיסטוריה של 1RM. **תיקון**: להוסיף את שלושת המפתחות ל-config בענן + לקובץ הקונפיג + ל-`_applyConfigData`.

---

## 🟠 חומרה בינונית

### 5. prefill משקל שלא יושב על רשת ה-picker נופל לערך המינימלי
ב-`initPickers` (workout-core.js:2298-2300) האופציות נבנות בקפיצות `step` ונבחרת רק התאמה מדויקת (`i === defaultW`). משקל שמור שהוזן ידנית דרך `commitCustomValue` (למשל 47.3 בתרגיל עם step‏ 2.5 ו-manualRange) לא קיים ברשת → אף אופציה לא נבחרת → ה-select נופל לאופציה הראשונה (המשקל המינימלי). קיימת כבר פונקציה מתאימה — `_setPickerValue` (בחירת הקרוב ביותר, 2589) — פשוט לא בשימוש כאן.

### 6. עריכת אימון Freestyle בארכיון משבשת את כותרת הסיכום
`_rebuildArchiveSummary` (archive-logic.js:939-941) בודק `item.week === 'Freestyle'`, אבל `week` הוא תמיד מספר/'deload' — התווית Freestyle נגזרת במקור מ-`state.isFreestyle` (workout-core.js:3660). עריכת סט באימון Freestyle משכתבת את הסיכום ל-"Week N". בנוסף, הבנייה-מחדש מאבדת את תגיות `(Main, TM: X)` כי אין לה מידע isMain. **תיקון**: לבדוק `item.type === 'Freestyle'` ולשמר תגיות Main מהסיכום המקורי או מ-workoutMeta.

### 7. showAlert / showConfirm עורמים מאזינים בקריאות חופפות
(workout-core.js:53-83) — קריאה שנייה בזמן שהמודאל כבר פתוח מוסיפה handler נוסף בלי להסיר את הקודם. לחיצת OK אחת תריץ את **כל** ה-callbacks שנערמו (כולל onOk ישן ולא רלוונטי). **תיקון**: לשמור reference ל-handler האחרון ולהסירו בכל קריאה, או `okBtn.onclick = handler`.

### 8. "איפוס להגדרות יצרן" מבטיח למחוק הכל אך מוחק רק חלק
`resetToFactorySettings` מציג "האם לאפס את כל הנתונים? פעולה זו בלתי הפיכה" אבל `resetToFactory` (storage.js:590) מוחק רק תרגילים/תוכניות/מטא/סשן — ארכיון, שקילות, תזונה, יומן מזון, AI וחיבורים נשארים. המסר מטעה לשני הכיוונים (מי שרוצה איפוס מלא לא מקבל; מי שחושש לארכיון נרתע לחינם). **תיקון**: לדייק את נוסח האישור או להוסיף אפשרות איפוס מלא.

### 9. פתיחת בורר התרגילים מכבה chips בכל האפליקציה
`updateSelectorChips` (editor-logic.js:885) מריץ `document.querySelectorAll('.chip')` על **המסמך כולו** ומסיר active מכל צ'יפ (פילטרי DB, Freestyle, מזון...) לפני שמדליק רק את של הבורר. **תיקון**: לצמצם ל-`#ui-exercise-selector .chip`.

### 10. יום תזונה מתיעוד פנימי מוצג כ"מקור: MyFitnessPal"
`_renderNutritionDaily` (bodylog-logic.js:485) ממפה רק `health`→Apple Health ואחרת MFP; יום עם `src:'app'` (יומן פנימי) מסומן MyFitnessPal. קיימת כבר פונקציה נכונה — `_mfpSrcLabel` (workout-core.js:5595). כנ"ל ב-`_buildNutritionAIContext` — שם דווקא ממופה נכון.

### 11. ביטול עריכת ארכיון זורק לרשימה במקום חזרה לפרטי האימון
`exitArchiveEditMode` (archive-logic.js:564-575) מנווט ל-`ui-archive` ומאפס את ה-state — המשתמש שרק רצה לבטל עריכה מאבד את מסך הפרטים שבו היה.

---

## 🟡 חומרה נמוכה / ליטוש

| # | ממצא | מיקום |
|---|------|-------|
| 12 | `showCloudToast('תמונות הרקע נשמרו ✓')` בלי `true` → הטוסט מקבל class‏ error (אדום) על פעולה מוצלחת | index.html:2485 |
| 13 | גרף PR בבית: bench (ירוק ‎#47e266‎) מקבל gradient **כתום** — `colAlpha` בודק רק כחול/אחרת-כתום | archive-logic.js:2943 |
| 14 | תווית "הושלמו" ב-sheet התוכנית מוצגת רק אם התרגיל **הראשון** הושלם (`isDone && num === 1`) | workout-core.js:1613 |
| 15 | `<title>GymPro Elite 14.11.0</title>` + `version:'14.11.0'` בייצוא קונפיג — תקועים על גרסה בת ‎3 מז'וריות | index.html:6, storage.js:510 |
| 16 | בעורך, תרגיל בסבב מציג `${ex.sets} חז׳` — הערך הוא סטים, לא חזרות | editor-logic.js:686 |
| 17 | באנר ההקשר ב-AI Coach מציג `l.w` גולמי בלי `_fmtW` — סטים בפלטות/BW מוצגים כמספר עירום | workout-core.js:5031 |
| 18 | hex סמנטי קשיח בניגוד לכלל P2: ‎#47e266 (archive-logic.js:1330), ‎#FF453A (editor-logic.js:1174), כפתור bg-save ירוק קשיח (index.html:2369) | — |
| 19 | רקע Unsplash בבורר הרקעים — דומיין חיצוני שלא נתפס ב-SW cache (רק lh3) → נעלם ב-offline | index.html:2387, sw.js:73 |
| 20 | `resizeSets` — ‏`Array(count).fill({...})` משכפל **reference אחד** לכל הסטים. כרגע אף קוד לא ממוטט איבר בודד אז זה שקט, אבל זה מוקש לכל פיצ'ר עתידי שיעשה `sets[i].w = ...` | workout-core.js:1910 |
| 21 | הערות `Version: 15.8` / `14.11.0` בראשי קבצים — לא תואמות 17.05 | כל קבצי ה-JS |
| 22 | PROJECT_KNOWLEDGE.md הכריז "גרסה נוכחית: 17.03" בעוד האפליקציה ב-17.05 | תוקן בקומיט זה |

### 23. Escaping לא עקבי — שמות תרגיל/תוכנית מוזרקים ל-innerHTML ללא escapeHtml
קיימת תשתית (`escapeHtml`/`escapeJsAttr`) ומיושמת ברוב המקומות, אבל דולגה ב:
- `buildSummaryUI` — ‏`seg.exName` בכותרת כרטיס (workout-core.js:3457)
- `openSessionLog` — ‏`exName` (workout-core.js:4000)
- `_updateAIContextBanner` — ‏`state.currentExName` (workout-core.js:5034)
- `buildArchiveDetailHTML` — ‏`item.type`, ‏`item.note`, ‏`exName`, ‏`entry.exName` (archive-logic.js:341, 359, 391, 413; אותו דבר בגרסת העריכה 597, 648, 671)
- `createArchiveCard` — ‏`item.type` (archive-logic.js:158)
- `_renderAliasStep2/3` — ‏`value="${suggested}"` בתוך attribute + תגיות preview ללא escape (archive-logic.js:1579, 1590, 1635)
- `renderRegularItem` / `renderClusterItem` — ‏`item.name` / `ex.name` (editor-logic.js:647, 685)
- `populateMicroSelector` / `openMicroSortSheet` — שמות תרגיל ב-option/שורה (archive-logic.js:1790, 1815)

שם תרגיל מותאם עם `"` או `<` ישבור DOM או יזריק HTML. **תיקון**: מעבר אחיד על נקודות ההזרקה.

---

## ⚫ קוד מת (מחיקה רק אחרי Impact Analysis לפי כללי הפרויקט)

| מה | מיקום | הערה |
|----|-------|------|
| `openExerciseSettings` | workout-core.js:4333-4345 | אין שום קורא — מסך "הגדרות תרגיל" **תוך-אימון** בלתי נגיש (בעורך יש opener נפרד). כתוצאה גם הענף `_editingRestEx` ב-`saveExerciseSettings` (editor-logic.js:848-864) מת — ואגב, גם אם יופעל מחדש, הוא לא שומר את זמן המנוחה (קורא רק יעדים). זו כנראה **רגרסיה פונקציונלית**: פיצ'ר שהוסר בכוונה או התנתק בטעות — דורש הכרעת מוצר. |
| `_escapeHtml` | workout-core.js:5016 | כפילות של `escapeHtml`; אפס קוראים |
| `getLastPerformance` | archive-logic.js:73 | אפס קוראים (כולם עברו ל-`getLastPerformances`) |
| `_fdBasicMatches` | food-logic.js:208 | הוחלף בדירוג `_fdScore` ב-fdDoSearch |
| `_fdLoadZXing` + `vendor/zxing.min.js` | food-logic.js:1699; vendor/ | ZBar החליף את ZXing לחלוטין; הקובץ (~336KB) עדיין ב-repo, ה-teardown של `_fdLiveReader` (1660, 1754) לעולם לא פעיל, וההערה ב-sw.js:88 עדיין מדברת על ZXing |
| `bl-nutri-import-btn` | workout-core.js:5530, 5564 | ה-ID לא קיים ב-DOM — ה-disable/enable של כפתור הייבוא הוא no-op (הכפתור האמיתי עבר ל-nutri-io-sheet) |
| `togglePRCard()` ריק | archive-logic.js:2107 + index.html:1636 | onclick על header שלא עושה כלום |
| תנאי מת ב-`_fdMealsHTML` | food-logic.js:662 | התנאי `used.indexOf(meal) < 0 && order.indexOf(meal) >= ...` לא יכול להתקיים (meal שנוסף ל-order מ-used תמיד ב-used) |

---

## 📌 המלצות סדר טיפול

1. **מיידי (באג בפועל אצל המשתמש)**: ‎#1 (Gemini 3 thinking), ‎#2 (אובדן קבוצת כינויים), ‎#3 (wakeLock).
2. **לפני השחזור-מענן הבא**: ‎#4 (TM/weights/RM בסנכרון).
3. **סבב ליטוש אחד מרוכז**: ‎#5–#11 + escaping (‎#23) — רובם תיקוני שורה-שתיים.
4. **ניקוי קוד מת**: אחרי החלטה על גורל "הגדרות תרגיל תוך-אימון" (להחזיר entry point או למחוק את שני הצדדים).
