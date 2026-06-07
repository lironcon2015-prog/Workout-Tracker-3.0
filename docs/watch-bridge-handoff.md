# המשכיות — גשר Apple Watch ⇄ טלפון (GYMPRO ELITE)

## הקשר
פרויקט **GYMPRO ELITE** — PWA Vanilla JS למעקב אימוני כוח. ענף עבודה: `claude/watch-bridge-clobber-fix-DHbyP`. גרסה נוכחית: **15.92**. שפה: עברית. כללי CLAUDE.md: כל שינוי בקובץ אפליקציה מחייב bump ל-`sw.js` (CACHE_VERSION) + `version.json`, push לענף + merge `--no-ff` ל-`main`. אין דפדפן/Firebase/שעון בסביבת הפיתוח — כל בדיקה אמיתית ידנית ע"י המשתמש.

## המשימה
לתעד אימון שלם מ-Apple Watch בלי להוציא טלפון מהתיק, עם **טרנזיטיביות מלאה**: שעון→סט, טלפון→סט, שעון→סט… בכל סדר, ושני המכשירים רואים את האיחוד המלא. **אילוצים:** בלי App Store, בלי Apple Developer ($99), בלי native. הפתרון: שעון = **Apple Shortcuts** → **Google Apps Script proxy** → **Firestore** doc `gympro_data/live_session` → ה-PWA קורא/מאמץ. בסוף פותחים טלפון ומסכמים.

## מה כבר מותקן ועובד
- **Firebase:** פרויקט `gympro-elite` (Spark plan, Anonymous auth).
- **Proxy פרוס:** `docs/watch-bridge.gs` ב-Apps Script, Web App (Anyone), עם Script Properties: `SECRET_TOKEN`, `FB_PROJECT_ID=gympro-elite`, `FB_CLIENT_EMAIL`, `FB_PRIVATE_KEY` (service account). URL מסתיים ב-`/exec` (מוגן ב-token).
- **אומת שעובד:** `getState`/`logSet`/`finish` + dedupe.
- **קיצור "Log Set":** Text(URL) → getState(POST token+action) → Get Dictionary suggestWeight + currentExName → Ask Number משקל/חזרות/RIR → logSet(POST token, action=logSet, w, r, rir) → Get Dictionary restTime → Start Timer → Show Result.

## ארכיטקטורה טכנית — Two-lane union (v15.92)
- doc `live_session` = `{ active:bool, data:"<json>", wlog:"<json>" }` — **שני מסלולי JSON-string נפרדים**:
  - `data` — מסלול הטלפון: metadata (plan, suggest, currentExName, currentTs, sessionId, type, week) + הסטים שמקורם בטלפון (`'p_'`). **נכתב רק ע"י ה-PWA.**
  - `wlog` — מסלול השעון: הסטים מהשעון (`'w_'`) + מצביע-תרגיל. **נכתב רק ע"י ה-proxy (append-only).**
- כל צד **קורא את שני המסלולים וממזג לפי setId** (`_unwrapLive` בטלפון, `_mergeLog` ב-proxy). כיוון שאף צד לא כותב לשדה של השני (Firestore `updateMask`/`set(merge)` = מיזוג ברמת-שדה) — **clobber בלתי אפשרי מבנית, ללא transactions**.
- `currentExName` אפקטיבי = המסלול עם ה-`currentTs` החדש יותר. `setIdx` **נגזר** מהלוג המאוחד (כמות סטים לתרגיל הנוכחי) — לא counter שנדרס.
- **קבצים:** `storage.js` (FirebaseManager: `_unwrapLive` ממזג שני מסלולים, `publishLiveSession(obj, resetWlog)` כותב רק `data`, `clearLiveSession` מאפס שניהם); `workout-core.js` (`WatchBridge`: `_buildPayload` מסנן סטי-`'w_'`, `_doPublish` כותב מסלול-טלפון בלבד, `_adopt`/`forceAdopt` עם gating על `_wlogRev`, `_deriveSetIdx`); `docs/watch-bridge.gs` (proxy: `_writeWlog` עם updateMask ל-`wlog`+`active`). הגשר **כבוי כברירת מחדל**.
- **איפוס מסלול-השעון:** בתחילת סשן הטלפון מפרסם עם `resetWlog=true` (מנקה סטי-שעון מסשן קודם); ב-`clearLiveSession` שני המסלולים מתאפסים.
- proxy actions: `getState`/`logSet`/`nextExercise`/`finish`. Guards: active+sessionId (מ-`data`), נרמול rir, ולידציית w/r, dedupe מול הלוג המאוחד, נרמול סיומת "(Main)". `doGet` מעביר את כל הפרמטרים (לבדיקות בדפדפן).

## הבאג שנפתר ✅ (v15.92)
**Clobber דו-כיווני** (טלפון בקדמה דרס כתיבות שעון) — נפתר ע"י הפרדת בעלות לשני מסלולים. תיקוני v15.90 (`forceAdopt`) ו-v15.91 (read-merge-write) נגעו רק בסימפטום והשאירו חלון מרוץ (lost-update); הפיצול מבטל אותו מבנית.

## פעולות שהמשתמש חייב לבצע לאחר הפריסה
1. **פרוס מחדש את ה-proxy:** העתק את `docs/watch-bridge.gs` המעודכן ל-Apps Script → Deploy → **Manage deployments → Edit → New version** (אותו URL נשמר). בלי זה, ה-proxy עדיין כותב למסלול `data` הישן ויהיה clobber.
2. **עדכן את ה-PWA ל-15.92** (הגדרות → בדוק עדכון).
3. **העבר את הקיצור לשעון:** הקיצור כרגע באייפון. צריך להעבירו ל-Apple Watch (Shortcuts מסתנכרן אוטומטית; ודא שהקיצור מסומן "Show on Apple Watch"). **חוזה ה-HTTP זהה** — אין שינוי בקיצור עצמו, רק הרצה מהשעון. אפשר להוסיף קומפליקציה/כפתור בשעון להרצה מהירה.

## בדיקת טרנזיטיביות (ידנית, אחרי הפריסה)
1. התחל אימון בטלפון, השאר ברקע/נעול.
2. שעון → סט (logSet). פתח `…/exec?token=<TOKEN>&action=getState` → `setIdx` = 1.
3. טלפון → רשום סט ידנית באפליקציה. getState → `setIdx` = 2 (הטלפון נכתב ל-`data`, ה-proxy מאחד).
4. שעון → סט נוסף. הטלפון מקבל toast "עודכן מהשעון", הלוג מציג **3 סטים**.
5. סיים בטלפון → כל 3 הסטים בארכיון, ה-doc מתאפס (data+wlog ריקים, active:false).

## כלים לאבחון (ידני ע"י המשתמש)
- דפדפן GET ל-`/exec?token=<TOKEN>&action=getState` (וגם `action=logSet&w=99&r=5&rir=3`).
- "Show Result" בקיצור מציג את תשובת ה-proxy.
- **אבטחה:** לא לבקש/לשתף את ה-SECRET_TOKEN או ה-private_key בצ'אט.
