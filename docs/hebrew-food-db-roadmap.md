# Roadmap — מאגר מזון/ברקוד עברי מקיף

> תוכנית מאושרת להרחבת מקורות המזון/ברקוד לשוק הישראלי, ללא רגרסיה בקיים.
> סטטוס מתעדכן בסיום כל שלב. **טרם החל קידוד** — ממתין להוראת "בצע" פר שלב.

## טבלת סטטוס שלבים
| שלב | תיאור | סיכון | סטטוס |
|-----|-------|-------|--------|
| 0 | תשתית והרמוניה (`resolveBarcode`, מיזוג מקורות) | נמוך | ⬜ Not started |
| 1 | צמ"ת — גנריים עבריים מדויקים (bundle מקומי) | נמוך | ⬜ Not started |
| 3 | קהילה (UGC) — `community_foods` (flywheel) | בינוני | ⬜ Not started |
| 2 | קטלוג שקיפות-מחירים — זיהוי ברקוד IL | בינוני | ⬜ Not started |
| 4 | היוריסטיקת 729 + ליטוש | נמוך | ⬜ Not started |

**רצף ביצוע מומלץ:** 0 → 1 → 3 → 2 → 4. כל שלב = קומיט + גרסה (trio) + push+merge ל-main.

---

## Context
היעד: המאגר העברי המקיף ביותר למזון וברקוד לשוק הישראלי, **ללא רגרסיה**.
מצב קיים (`food-logic.js`): חיפוש = `searchFoods` (OFF+USDA) + `BASIC_FOODS` + cache + `_fdAiFood` fallback;
ברקוד = `lookupBarcode` (OFF בלבד). הפער: **מוצרים ארוזים ישראליים (729) עם ברקוד**.
מטמיעים 4 מקורות: צמ"ת, קטלוג שקיפות-מחירים, קהילה (UGC), היוריסטיקת 729.
**מחוץ לסקופ (החלטת משתמש):** FatSecret (דורש proxy/גשר), Nutritionix/Edamam (US-centric, רלוונטיות ישראלית נמוכה).

## אילוץ ארכיטקטוני מכריע (ממצא קוד)
`FirebaseManager` (`storage.js:1092+`) הוא **פר-משתמש** — `gympro_data/<doc>` בפרויקט ה-Firebase של
המשתמש. לכן **קהילה וקטלוג חייבים backend נפרד בבעלות-האפליקציה** (לא ה-config של המשתמש):
- **קטלוג IL** = read-only → **JSON סטטי מחולק-shard לפי תחילית-ברקוד**, מתארח סטטי (Firebase Storage / GitHub Pages), נטען עצל + SW runtime-cache. ללא DB, ללא מכסה.
- **קהילה** = דורש כתיבה משותפת → **Firebase app שני בשם נפרד** (`firebase.initializeApp(SHARED_CFG, 'shared')`), config ציבורי מוטמע, Anonymous Auth + security rules (read ציבורי, write מוגבל-קצב). Client-side, ללא גשר.

## עקרון-על: מיזוג שכבות + invariants לאי-רגרסיה
כל מקור חדש = שכבה ב-`Promise.allSettled` + try/catch + timeout (תבנית `_fdFetch`, `food-logic.js:196`).
כשל מקור חדש **לעולם** לא דורס תוצאה קיימת. AI נשאר **אחרון**. Dedup לפי ברקוד→שם מנורמל (`_fdNorm`/`_fdTokenMatch`).

| צינור | סדר עדיפות (גבוה→נמוך) |
|------|------------------------|
| ברקוד | קהילה(ocr/manual) → OFF → קטלוג IL + אומדן AI → קהילה(estimate) → AI |
| טקסט | BASIC + **צמ"ת** + cache (מיידי) → OFF + USDA (רשת) → קהילה → AI fallback |

---

## שלב 0 — תשתית והרמוניה (refactor, ללא דאטה)
- **`resolveBarcode(code)`** חדש ב-`food-logic.js` — שרשרת resolvers; מחליף את הקריאות הישירות ל-`lookupBarcode` ב-`fdOnPhoto` (~1083) ו-`_fdLiveOnHit` (~1216). `lookupBarcode` (243) נשאר resolver של OFF.
- **`searchFoods` (205) → רשימת מקורות עם priority + dedup מרכזי** (`_fdMergeSources`), כדי שהוספה לא תשנה סדר.
- קבוע `_FD_SOURCE_PRIORITY`; הרחבת `_FD_SRC_LABEL`/`_fdSrcChip` (729) לצ'יפים חדשים.
- **קבצים:** `food-logic.js`. **סיכון:** נמוך (עוטף לוגיקה קיימת ללא שינוי התנהגות).

## שלב 1 — צמ"ת (משרד הבריאות) · גנריים מדויקים 🥇
- **ETL חד-פעמי (Node, offline):** המאגר הלאומי → `data/tzameret-foods.json`: `{id, name_he, synonyms[], per100:{kcal,p,c,f}, serving?}`.
- **טעינה עצלה** כמו ZXing: לא pre-cache; נטען בחיפוש ראשון, נשמר בזיכרון + **SW runtime-cache** — לשכפל את כלל `/vendor/` (`sw.js:88-103`) לכלל `/data/`.
- שילוב: `_tzametMatches(q)` (תבנית `_fdBasicMatches`/`_fdTokenMatch`) בשכבה המיידית, **אחרי BASIC לפני OFF**; גובר על fallback ה-AI לגנריים.
- **קבצים:** `data/tzameret-foods.json` (חדש), `food-logic.js`, `sw.js`, `docs/etl-tzameret.md`.
- ⚠️ **לבדוק רישוי** לפני bundling. **סיכון:** נמוך, offline, אדיטיבי.

## שלב 2 — קטלוג שקיפות-מחירים · זיהוי ברקוד IL 🥈
- **ETL תקופתי (Node, offline):** XMLים מ-data.gov.il / פורטלי הרשתות → dedup לפי ברקוד → shards `data/il-catalog/<prefix>.json`: `{barcode: {name_he, brand, category}}`.
- **שילוב ב-`resolveBarcode`:** אחרי החטאת OFF → `catalogLookup(code)` (טוען shard לפי תחילית, SW-cached) מחזיר **שם+יצרן (ללא מאקרו)** → השלמת מאקרו: קהילה → אחרת **Gemini מהשם** (`_fdAiFood`, 777) → מזון `source:'il_catalog'` + תג **"אומדן"**; נשמר ל-`KEY_FOOD_DB` + נכתב לקהילה.
- **קבצים:** `data/il-catalog/*` (חדש, סטטי), `food-logic.js`, `docs/etl-price-transparency.md` (סקריפט + cadence).
- **סיכון:** בינוני — שמות בלבד; מאקרו = אומדן AI (לתייג ביושר).

## שלב 3 — קהילה (UGC) · `community_foods` 🥉
- **Backend משותף:** Firebase app שני (`'shared'`), config ציבורי מוטמע, Anonymous Auth. **קולקציה `community_foods`**, doc-id = ברקוד (או hash(name+brand)). שדות: `name_he, brand, barcode, per100, source_type('ocr'|'manual'|'estimate'), confidence, contributors, updatedAt`. **אנונימי, ללא PII.**
- **כתיבה (אדיטיבי, מאחורי toggle):**
  - `fdSaveCustomFood` (998) → upsert (`source_type:'manual'`).
  - זיהוי OCR מוצלח (`_fdLabelViaGemini`/`fdOnPhoto`, מזון עם ברקוד) → upsert `'ocr'` — **ה-flywheel**.
  - `_fdAiFood` (777) / אומדן קטלוג → upsert `'estimate'`, confidence נמוך.
- **קריאה:** `communityLookup(code)` ב-`resolveBarcode` (עדיפות גבוהה); ובחיפוש טקסט (בינונית). עדיפות מקור: ocr/manual > estimate.
- **אבטחה/פרטיות:** security rules (read public, write auth+rate-limit), אנונימיזציה; toggle הגדרות "תרום מזונות לקהילה". אוסף **נפרד** מ-`config` הפרטי → **אפס נגיעה בסנכרון הקיים**.
- **קבצים:** `storage.js` (init app `'shared'` + read/write helpers), `food-logic.js` (hooks), `index.html` (toggle), `style.css`, `docs/community-foods-schema.md` (+rules).
- **סיכון:** בינוני — איכות/abuse → confidence+dedup+rules; v1 פשוט (last-write לפי עדיפות-מקור).
- ❓ פתוח (כלל CLAUDE.md): toggle התרומה הוא pref — **כנראה לא** ב-`_connectionKeys()`; SHARED_CFG הוא config ציבורי (לא סוד). לאשר בהטמעה.

## שלב 4 — 729 + ליטוש
- `_isIsraeliBarcode(code)` (תחילית `729`) → ניתוב מהיר לקטלוג/קהילה ב-`resolveBarcode`.
- badge "אומדן" לפריטים מוערכים; צ'יפי מקור; טלמטריית כיסוי פר-מקור (אופציונלי).
- **קבצים:** `food-logic.js`, `index.html`, `style.css`.

---

## אי-רגרסיה (Cross-cutting)
- שכבות חדשות: `Promise.allSettled` + try/catch + timeout → כשל ≠ שבירה; הסדר הקיים נשמר; AI אחרון.
- datasets גדולים בטעינה עצלה + SW runtime-cache (`/data/`, לא pre-cache) → **Offline First נשמר** בשכבות הקיימות.
- `community_foods` ב-app נפרד; `il_catalog` סטטי → סנכרון ה-config הפרטי לא נוגע.
- bump גרסה (trio) + `PROJECT_KNOWLEDGE.md` בכל שלב; כל קומיט עם push+merge ל-main.

## סיכונים
1. **רישוי צמ"ת** — לאמת לפני bundling.
2. **קטלוג = שמות בלבד** → מאקרו אומדן AI מתויג.
3. **תשתית משותפת** — לספק פרויקט Firebase שני + rules + Anonymous Auth.
4. **ETL = infra offline** (Node) — cadence תחזוקה.
5. **איכות קהילה** — moderation/confidence.

## אימות (פר שלב)
1. חיפוש/ברקוד מחזירים תוצאות קיימות **באותו סדר** (regression); מקור חדש עם צ'יפ נכון.
2. ניתוק רשת למקור חדש → לא שובר אחרים; AI עדיין אחרון; offline עובד (צמ"ת cached).
3. ברקוד IL לא-ב-OFF → קטלוג מחזיר שם → אומדן AI → תג "אומדן".
4. קהילה: OCR לברקוד לא-ידוע → upsert → מכשיר אחר מקבל אותו ב-`resolveBarcode`.
5. 729 routing; `grep CACHE_VERSION sw.js` ב-main מציג גרסה חדשה אחרי כל שלב.
