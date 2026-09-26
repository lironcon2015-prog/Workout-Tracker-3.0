# מפרט מערכת תזונה ניידת — להטמעה באפליקציית כושר אחרת

> מסמך זה נועד להימסר ל-Claude Code שיושב על ה-repo של אפליקציית הכושר השנייה,
> כדי שיהיו לו די כלים, ידע והבנה לבנות את מערכת התזונה — בהתאם לתהליך הבנייה והלקחים שלנו.

## 0. סקופ (החלטות מאושרות)
- **ליבה + AI.** כולל: יומן מזון פנימי, חיפוש (OFF + USDA + צמ"ת), ברקוד, Meal Builder, יעדי מאקרו + סיכום יומי, סנכרון ענן, ייצוא, ופיצ'רי AI (OCR תווית, הערכת מנה, fallback תזונתי).
- **מחוץ לסקופ:** גשרי MyFitnessPal/Apple Health (ספציפיים ל-Apps Script/Gmail).
- **סטאק:** זהה — Vanilla JS (ES6+) PWA, LocalStorage, Firebase per-user (config שהמשתמש מספק). המפרט קונקרטי.
- ⚠️ **אל תניח שום תשתית קיימת.** באפליקציה השנייה אין: תזונה, AI/Gemini, סנכרון-ענן-לתזונה, ייצוא. בנה כל אלה.

## 1. פריסת קבצים מוצעת (מראה את שלנו)
- `nutrition-core.js` (חדש) — כל לוגיקת התזונה: יומן, חיפוש, ברקוד, Meal Builder, AI, ייצוא. (אצלנו: `food-logic.js`.)
- `storage.js` — להוסיף מפתחות+getters לתזונה ול-FirebaseManager. אם אין StorageManager — לבנות wrapper דק ל-LocalStorage.
- `index.html` — מסך/overlay תזונה + bottom-sheets + כפתור בית.
- `style.css` — קומפוננטות UI בקו העיצוב שלהם (ראה §7).
- `vendor/zxing.min.js` — ZXing UMD (npm `@zxing/library`, build `umd/index.min.js`), טעינה עצלה.
- `sw.js` + `version.json` — אם PWA: כלל runtime-cache ל-`/vendor/` ול-`/data/`, ומשמעת גרסה.

## 2. מודלי דאטה (LocalStorage — מקור האמת המקומי)
**`FOOD_LOG`** — `{ "YYYY-MM-DD": [entry...] }`. entry:
```
{ id, name, brand, source('off'|'usda'|'tzameret'|'gemini'|'custom'|'basic'),
  barcode|null, meal, time"HH:MM",
  qty, unit('g'|'ml'|'serving'), gramsPerUnit|null,
  per100:{kcal,p,c,f},            // ערכי בסיס ל-100ג'/מ"ל
  kcal,p,c,f,                      // מחושב לכמות בפועל (snapshot)
  components?:[{name,grams,per100,kcal,p,c,f}]   // למנה מורכבת (Meal Builder)
}
```
**`FOOD_DB`** — קאש מאוחד: תוצאות חיפוש שנצרכו + מותאמים + מועדפים. `{id,name,brand,barcode,source,per100,useCount,lastUsed,favorite,mealUse:{meal:{count,lastUsed}}}`. **נשמר לענן** → מאגר אישי שגדל מהשימוש + offline.
**`NUTRITION_DAILY`** — סיכום יומי: `[{date, calories, protein, carbs, fat, meals(count), src('app')}]`. (ב-Core המקור תמיד `'app'`; שדה `src` נשמר לעתיד/מיזוג.)
**`ANALYTICS_PREFS`** (או מבנה הפרופיל שלהם) — יעדים: `{kcalTarget, proteinTarget, carbsTarget, fatTarget, mealLabels:[...]}`. ברירת מחדל ארוחות: בוקר/צהריים/ערב/נשנוש.
**מפתחות סוד:** `GEMINI_KEY`, `USDA_KEY` (אופציונלי), `FIREBASE_CONFIG`.

**עיקרון קנוני:** הכל נשמר **ל-100 גרם** (`per100`); הכמות בפועל נגזרת בזמן הזנה. `recomputeDay(date)` = סכימת רשומות היום → `NUTRITION_DAILY`.

## 3. מודולי הפיצ'רים

### 3.1 יומן יומי (UI)
- **Overlay מסך-מלא** (`#food-diary`), נפתח מכרטיס בית/מסך כושר. ניווט ימים: חיצים + החלקה + בורר תאריך (לא עתיד).
- **סיכום עליון:** טבעת קלוריות (SVG, נצרך/יעד) + 3 פסי מאקרו (חלבון/פחמימה/שומן עם יעד). אנימציית מילוי.
- **קיבוץ לפי ארוחה:** סקשן לכל ארוחה (אייקון, סכום קלוריות+מאקרו), שורות פריט, כפתור "+" לכל ארוחה, "הוסף ארוחה חדשה".
- שורת פריט: שם + תת-שורה (מותג/כמות/שעה או "N מרכיבים") + מאקרו. לחיצה → עורך.

### 3.2 הוספת מזון
- **שיט חיפוש** (bottom-sheet): טאבים אחרונים/מועדפים/מותאמים + שורת חיפוש + כפתורי מצלמה (ברקוד/תווית/מנה). שורת תוצאה מציגה **שם + צ'יפ מקור + קלוריות + ח/פ/ש** (מאקרו כבר בשלב התוצאה).
- **עורך כמות** (`_fdOpenPortion`): כמות + יחידה (serving/גרם) + שעה + צ'יפ ארוחה + **preview חי** של קלוריות/מאקרו. שמירה → `addFoodEntry` + `recomputeDay`.
- **Meal Builder** (מנה מורכבת): שם + רשימת מרכיבים **ניתנים לעריכה מלאה** (שם + ערכים ל-100ג' + גרמים), הוסף/הסר מרכיב, סכום חי. נשמר כ-entry יחיד עם `components`.

### 3.3 חיפוש — מיזוג מקורות (קריטי לאיכות)
`searchFoods(q)` = `Promise.allSettled([searchTzameret, searchOFF, searchUSDA])` → מיזוג + dedup. **כשל מקור לעולם לא שובר אחרים. AI אחרון.**
- **שכבה מיידית (לפני רשת):** `BASIC_FOODS` (רשימה עברית מובנית ~80) + `FOOD_DB` cache — התאמת **טוקן + נרמול ניקוד** (`_fdTokenMatch`), לא substring נאיבי.
- **OFF:** `https://search.openfoodfacts.org/search?q=&lang=he&fields=...` (CORS-first), fallback ל-`world.openfoodfacts.org/cgi/search.pl`. מוצרים ארוזים; כיסוי עברי חלש.
- **צמ"ת (מקור עברי גנרי רשמי):** CKAN `https://data.gov.il/api/3/action/datastore_search?resource_id=c3cb0630-0650-46c1-a068-82d575c094b2&q=&limit=20`. שדות: `shmmitzrach`(שם), `food_energy`(kcal), `protein`, `total_fat`, `carbohydrates` — **per-100g**. רישיון ממשלתי פתוח. **בראש התוצאות.**
- **USDA (אופציונלי, מפתח):** גנרי אנגלי; דורש מילון עברית→אנגלית. ערך מוגבל מול צמ"ת — נמוך בעדיפות.
- **דירוג:** צמ"ת → OFF → USDA. **dedup** לפי ברקוד→שם מנורמל. צ'יפ מקור לכל תוצאה.
- **AI fallback:** ב-0 תוצאות (או כפתור "הערכת AI") → `_fdAiFood` (§3.5). תוצאות חיפוש נשמרות ל-`FOOD_DB` → גדל offline.

### 3.4 ברקוד
- **פענוח מקומי קודם:** `BarcodeDetector` (Android/Chrome) על צילום/וידאו — מיידי, בלי AI.
- **סריקה חיה:** overlay מצלמה (`getUserMedia` facingMode environment); `BarcodeDetector` בלולאת rAF, או **ZXing** fallback ל-iOS. ZXing ב-**טעינה עצלה** (script injection) + **SW runtime-cache** (לא pre-cache, 336KB).
- **`resolveBarcode(code)`:** `FOOD_DB` לפי ברקוד (מיידי, offline, נסרק בעבר) → OFF (`lookupBarcode`: `world.openfoodfacts.org/api/v2/product/<code>.json`). מחזיר food|null.
- **OCR-on-miss (flywheel חד-משתמשי):** לא נמצא → לשמור `_fdPendingBarcode` → "צלם תווית" → Gemini קורא ערכים → המזון נשמר **עם הברקוד** → סריקה הבאה מיידית מ-cache.
- **729:** `/^729/` = ברקוד ישראלי — להתאמת הודעה/ניתוב.

### 3.5 AI (Gemini) — להוסיף מאפס
- **Config:** `getAIConfig()` → `{apiKey, models:[...]}` (רשימת מודלים עם fallback). מסך הגדרות להזנת מפתח.
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent?key=<key>`, POST. `generationConfig: {temperature, responseMimeType:'application/json', thinkingConfig:{thinkingBudget:0}}`. **לולאת מודלים** עם דילוג על 400/404/429/503.
- **שלוש קריאות:**
  1. `_callGeminiFood(base64,mime)` — תווית/ברקוד מתמונה → `{barcode,name,kcal,protein,carbs,fat,per}`.
  2. `_callGeminiMeal(base64,mime)` — מנה אמיתית מצילום → `{name, items:[{name,grams,kcal,protein,carbs,fat}]}` → Meal Builder.
  3. `_fdAiFood(q)` — ערכים סטנדרטיים ל-100ג' לשאילתה עברית → `{found,name,kcal,protein,carbs,fat}`. **נשמר ל-FOOD_DB** (id `ai:`) → קאש מיידי+offline.
- מזון גנרי = ערכים סטנדרטיים אמינים; מתויג מקור "AI" בשקיפות.

### 3.6 יעדי מאקרו + סיכום
- מסך הגדרות יעדים (kcal/חלבון/פחמימה/שומן). הסיכום היומי משווה נצרך↔יעד.
- `recomputeDay(date)`: סכום `kcal/p/c/f` של רשומות היום → `NUTRITION_DAILY` (src 'app'). (שמור hook `src` למיזוג עתידי — תיעוד ישיר גובר.)

### 3.7 סנכרון ענן (Firebase per-user)
- אם לאפליקציה כבר יש FirebaseManager — **להוסיף את מפתחות התזונה למסמך ה-config** (כמו אצלנו): `nutritionDaily, foodLog, foodDb, analyticsPrefs`. אם אין — לבנות את התבנית: `firebase.firestore()` עם config שהמשתמש מזין; doc יחיד `config` (set/get), + chunking אם `foodDb`/`foodLog` גדלים מעבר ל-~1MB.
- **Offline-first:** הכל עובד מ-LocalStorage; ענן הוא גיבוי/סנכרון בין-מכשירים, לא חוסם.

### 3.8 ייצוא
- **שני קבצי JSON מכבדי-טווח** (7/30/90/מותאם): (א) **מקוצר** — date+קלוריות+מאקרו ליום; (ב) **מפורט** — לכל יום ארוחות→פריטים→מרכיבים. ⚠️ **שדה מצרפי ברמת-פריט = סכום הרכיבים** (כולל grams!).
- אופציונלי: ייצוא מאוחד שמשלב אימונים+תזונה (אם תרצו קובץ אחד לניתוח).

### 3.9 גיבוי חיבורים ("קובץ סודי" לשחזור מלא)
- ייצוא/ייבוא JSON של המפתחות: `GEMINI_KEY, USDA_KEY, FIREBASE_CONFIG`. כלל: בכל סוד חדש — לשאול אם לכלול.

## 4. תלויות חיצוניות / endpoints
- OFF: `search.openfoodfacts.org` + `world.openfoodfacts.org` (CORS-OK).
- צמ"ת: `data.gov.il` CKAN (לאמת CORS בדפדפן; gov open-data בד"כ פתוח).
- USDA FDC: `api.nal.usda.gov/fdc/v1/foods/search` (מפתח).
- Gemini: `generativelanguage.googleapis.com`.
- ZXing: npm `@zxing/library` → `umd/index.min.js` (global `ZXing`).

## 5. עקרונות אי-רגרסיה (חובה)
- כל מקור רשת: `_fdFetch` עם `AbortController` timeout; `Promise.allSettled`; כשל=`[]`.
- AI תמיד אחרון. dedup יציב. cache-first בברקוד.
- datasets/ספריות גדולות: טעינה עצלה + SW runtime-cache, **לא** pre-cache.
- שמירה ל-100ג' קנוני; snapshot מחושב לכמות.

## 6. הלקחים מה"ניסוי וטעייה" שלנו (קרא לפני שתבנה)
1. **per-100g קנוני** + טיפול serving/gram. הנח שתווית = ל-100ג' אלא אם צוין "מנה".
2. **שדות מצרפיים = סכום רכיבים** (באג ה-grams: ה-grams ברמת-מנה היה 0 כי המשקל קיים רק ברכיבים — חובה `item.grams = Σ components.grams`, וכך גם kcal/מאקרו).
3. **ברקוד: פענוח מקומי לפני AI** (מהירות); ZXing ל-iOS; טעינה עצלה+SW-cache; `resolveBarcode` cache-first; OCR-once.
4. **חיפוש עברי:** OFF חלש בעברית → **צמ"ת הוא המקור הגנרי**; טוקן+נרמול ניקוד > substring; USDA אנגלי-בלבד (ערך נמוך); AI fallback אחרון ונשמר לקאש כדי לגדל מאגר offline.
5. **כל מקור ב-allSettled+timeout** — מקור נופל לא שובר תוצאות.
6. **מרכיבים ניתנים לעריכה** מהיום הראשון (אל תשלח שורות לא-עריכות; צריך גם לתקן ערכי AI).
7. **משמעת גרסת PWA** (אם PWA): SW cache-version + version.json בכל שינוי קוד, אחרת המשתמש תקוע בקאש.
8. **שכבות UI/z-index:** overlay מסך-מלא < bottom-sheets < מצלמה חיה. אחידות פיקרים בין מסכים.

## 7. עיצוב / UI / UX — להתאים לקו שלהם
**אל תעתיק את הפלטה שלנו (Liquid Obsidian הכהה).** במקום — **חלץ את ה-design tokens של האפליקציה השנייה** (צבעי רקע/כרטיס, רדיוסים, פונט, accent) ומפה אליהם את הקומפוננטות. עקרונות לשמר:
- כרטיסים מעוגלים, צ'יפים מסוג "pill", טבעת קלוריות, **שלישיית צבעי מאקרו** (חלבון/פחמימה/שומן עקביים).
- **RTL** (אם עברית): `flex-start`=ימין; **rem** לטיפוגרפיה.
- bottom-sheets להוספה/עריכה; overlay יומן; toast; haptics; מצבי loading/skeleton.
- צ'יפ מקור לכל תוצאת חיפוש; badge "אומדן" לערכי AI.
- אם לאפליקציה אין פרימיטיבים אלו (sheet/chip/toast/haptic/number-input) — לבנות מקבילות בקו שלהם.

## 8. מתודולוגיית בנייה (התהליך שלנו)
- **שלבים קטנים, אדיטיביים, אפס רגרסיה.** plan-mode → אישור "בצע" → ביצוע → אימות → קומיט/גרסה. עדכון מסמך ידע (PROJECT_KNOWLEDGE) בכל שלב.
- **סדר מומלץ:** (0) תשתית אחסון+מודלים → (1) יומן+הזנה ידנית+יעדים+סיכום → (2) חיפוש (צמ"ת+OFF+מיזוג) → (3) Meal Builder → (4) AI (Gemini config + 3 קריאות) → (5) ברקוד (local+ZXing+resolveBarcode+OCR-miss) → (6) סנכרון ענן → (7) ייצוא + גיבוי חיבורים.
- כל שלב ניתן לשחרור עצמאי ונבדק לפני הבא.

## 9. אימות (end-to-end, פר שלב)
- הזנה ידנית → סיכום יומי מתעדכן; preview חי תקין.
- חיפוש "עדשים"/"פלאפל" → צמ"ת בראש עם מאקרו בשורה; כשל רשת → לא קורס; AI fallback ב-0 תוצאות.
- ברקוד שב-OFF → עורך; שוב offline → מ-cache; ברקוד IL לא-נמצא → "צלם תווית" → נשמר עם ברקוד → שוב מיידי.
- Meal Builder: הוסף/ערוך מרכיב → סכום חי; שמירה → entry עם components; ייצוא מפורט עם grams=סכום.
- סנכרון: הוסף מזון → טעינה במכשיר אחר מחזירה; offline מלא עובד.
- ייצוא 7/30/90/מותאם → תואם טווח.
