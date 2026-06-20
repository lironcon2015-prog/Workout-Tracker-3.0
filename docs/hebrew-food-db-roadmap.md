# Roadmap — מאגר מזון/ברקוד עברי מקיף

> תוכנית מאושרת להרחבת מקורות המזון/ברקוד לשוק הישראלי, ללא רגרסיה בקיים.
> **סקופ: אמצעי (בלי קהילה)** — אפליקציה חד-משתמש; ה-flywheel הקהילתי מתייתר (ראה למטה).
> סטטוס מתעדכן בסיום כל שלב. **טרם החל קידוד.**

## טבלת סטטוס שלבים
| שלב | תיאור | סיכון | סטטוס |
|-----|-------|-------|--------|
| 0 | תשתית והרמוניה (`resolveBarcode`, מיזוג מקורות) | נמוך | ⬜ Not started |
| 1 | צמ"ת — גנריים עבריים מדויקים (bundle מקומי) | נמוך | ⬜ Not started |
| 2 | קטלוג שקיפות-מחירים — זיהוי ברקוד IL | בינוני | ⬜ Not started |
| 4 | היוריסטיקת 729 + ליטוש | נמוך | ⬜ Not started |
| ~~3~~ | ~~קהילה (UGC)~~ | — | ❌ הוסר (חד-משתמש) |

**רצף ביצוע:** 0 → 1 → 2 → 4. כל שלב = קומיט + גרסה (trio) + push+merge ל-main.

---

## Context
היעד: המאגר העברי המקיף ביותר למזון/ברקוד לשוק הישראלי, **ללא רגרסיה**.
מצב קיים (`food-logic.js`): חיפוש = `searchFoods` (OFF+USDA) + `BASIC_FOODS` + cache + `_fdAiFood` fallback;
ברקוד = `lookupBarcode` (OFF בלבד). הפער: **מוצרים ארוזים ישראליים (729) עם ברקוד**.
מטמיעים 3 מקורות: צמ"ת, קטלוג שקיפות-מחירים, היוריסטיקת 729.
**מחוץ לסקופ:** FatSecret (proxy/גשר), Nutritionix/Edamam (US-centric), **קהילה/UGC (חד-משתמש)**.

## למה קהילה ירדה (פישוט חד-משתמש)
ה-flywheel הקהילתי ("אחד סורק, כולם נהנים") **כבר קיים בחינם** למשתמש יחיד דרך הקיים:
כל זיהוי OCR/ברקוד נשמר ל-`KEY_FOOD_DB` (`upsertFoodToDb`) ומסונכרן ל-Firebase **הפרטי שלך** (`config`) →
זמין בכל המכשירים שלך, לתמיד. אין צורך ב-Firebase app שני, Anonymous Auth, security rules או moderation —
**כל האילוץ הארכיטקטוני המורכב יורד.** הקטלוג (שלב 2) היה תמיד read-only סטטי ולא תלוי בכך.

## עקרון-על: מיזוג שכבות + invariants לאי-רגרסיה
כל מקור חדש = שכבה ב-`Promise.allSettled` + try/catch + timeout (תבנית `_fdFetch`, `food-logic.js:196`).
כשל מקור חדש **לעולם** לא דורס תוצאה קיימת. AI נשאר **אחרון**. Dedup לפי ברקוד→שם מנורמל (`_fdNorm`/`_fdTokenMatch`).

| צינור | סדר עדיפות (גבוה→נמוך) |
|------|------------------------|
| ברקוד | `KEY_FOOD_DB` לפי ברקוד (נסרק בעבר, offline) → OFF → קטלוג IL + אומדן AI → AI |
| טקסט | BASIC + **צמ"ת** + cache (מיידי) → OFF + USDA (רשת) → AI fallback |

---

## שלב 0 — תשתית והרמוניה (refactor, ללא דאטה)
- **`resolveBarcode(code)`** חדש ב-`food-logic.js` — שרשרת resolvers; מחליף את הקריאות הישירות ל-`lookupBarcode` ב-`fdOnPhoto` (~1083) ו-`_fdLiveOnHit` (~1216). resolver ראשון = `KEY_FOOD_DB` לפי ברקוד (flywheel חד-משתמש), אחריו OFF (`lookupBarcode`, 243).
- **`searchFoods` (205) → רשימת מקורות עם priority + dedup מרכזי** (`_fdMergeSources`), כדי שהוספה לא תשנה סדר.
- קבוע `_FD_SOURCE_PRIORITY`; הרחבת `_FD_SRC_LABEL`/`_fdSrcChip` (729) לצ'יפים חדשים.
- **קבצים:** `food-logic.js`. **סיכון:** נמוך (עוטף לוגיקה קיימת ללא שינוי התנהגות).

## שלב 1 — צמ"ת (משרד הבריאות) · גנריים מדויקים 🥇
- **ETL חד-פעמי (Node, offline):** המאגר הלאומי → `data/tzameret-foods.json`: `{id, name_he, synonyms[], per100:{kcal,p,c,f}, serving?}`.
- **טעינה עצלה** כמו ZXing: לא pre-cache; נטען בחיפוש ראשון, נשמר בזיכרון + **SW runtime-cache** — לשכפל את כלל `/vendor/` (`sw.js:88-103`) לכלל `/data/`.
- שילוב: `_tzametMatches(q)` (תבנית `_fdBasicMatches`/`_fdTokenMatch`) בשכבה המיידית, **אחרי BASIC לפני OFF**; גובר על fallback ה-AI לגנריים.
- **קבצים:** `data/tzameret-foods.json` (חדש), `food-logic.js`, `sw.js`, `docs/etl-tzameret.md`.
- ⚠️ **חסמי כניסה:** (א) **השגת הדאטה** — מאגר צמ"ת (רשת מוגבלת בסביבה זו; אולי דרך npm/קובץ שתספק). (ב) **רישוי** — לאמת לפני bundling.

## שלב 2 — קטלוג שקיפות-מחירים · זיהוי ברקוד IL 🥈
- **ETL תקופתי (Node, offline):** XMLים מ-data.gov.il / פורטלי הרשתות → dedup לפי ברקוד → shards `data/il-catalog/<prefix>.json`: `{barcode: {name_he, brand, category}}`.
- **שילוב ב-`resolveBarcode`:** אחרי החטאת OFF → `catalogLookup(code)` (טוען shard לפי תחילית, SW-cached) מחזיר **שם+יצרן (ללא מאקרו)** → השלמת מאקרו דרך **Gemini מהשם** (`_fdAiFood`, 777) → מזון `source:'il_catalog'` + תג **"אומדן"**; נשמר ל-`KEY_FOOD_DB` (→ מסונכרן ל-Firebase שלך).
- **קבצים:** `data/il-catalog/*` (חדש, סטטי), `food-logic.js`, `docs/etl-price-transparency.md`.
- **סיכון:** בינוני — שמות בלבד; מאקרו = אומדן AI (לתייג ביושר).

## שלב 4 — 729 + ליטוש
- `_isIsraeliBarcode(code)` (תחילית `729`) → ניתוב מהיר לקטלוג ב-`resolveBarcode`.
- badge "אומדן" לפריטים מוערכים; צ'יפי מקור; טלמטריית כיסוי פר-מקור (אופציונלי).
- **קבצים:** `food-logic.js`, `index.html`, `style.css`.

---

## אי-רגרסיה (Cross-cutting)
- שכבות חדשות: `Promise.allSettled` + try/catch + timeout → כשל ≠ שבירה; הסדר הקיים נשמר; AI אחרון.
- datasets גדולים בטעינה עצלה + SW runtime-cache (`/data/`, לא pre-cache) → **Offline First נשמר** בשכבות הקיימות.
- `il_catalog` סטטי read-only; אין backend משותף → סנכרון ה-config הפרטי לא נוגע.
- bump גרסה (trio) + `PROJECT_KNOWLEDGE.md` בכל שלב; כל קומיט עם push+merge ל-main.

## סיכונים
1. **השגת/רישוי צמ"ת** — לאמת מקור + רישיון לפני bundling (חסם שלב 1).
2. **קטלוג = שמות בלבד** → מאקרו אומדן AI מתויג.
3. **ETL = infra offline** (Node) — cadence תחזוקה.

## אימות (פר שלב)
1. חיפוש/ברקוד מחזירים תוצאות קיימות **באותו סדר** (regression); מקור חדש עם צ'יפ נכון.
2. ניתוק רשת למקור חדש → לא שובר אחרים; AI עדיין אחרון; offline עובד (צמ"ת + ברקודים שנסרקו cached).
3. ברקוד שנסרק בעבר → עולה מיידית מ-`KEY_FOOD_DB` (גם offline).
4. ברקוד IL לא-ב-OFF → קטלוג מחזיר שם → אומדן AI → תג "אומדן".
5. 729 routing; `grep CACHE_VERSION sw.js` ב-main מציג גרסה חדשה אחרי כל שלב.
