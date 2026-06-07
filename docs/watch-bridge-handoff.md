# המשכיות — גשר Apple Watch ⇄ טלפון (GYMPRO ELITE)

## הקשר
פרויקט **GYMPRO ELITE** — PWA Vanilla JS למעקב אימוני כוח. ענף עבודה: `claude/card-screen-design-refresh-EL2bl`. גרסה נוכחית: **15.91**. שפה: עברית. כללי CLAUDE.md: כל שינוי בקובץ אפליקציה מחייב bump ל-`sw.js` (CACHE_VERSION) + `version.json`, push לענף + merge `--no-ff` ל-`main`. אין דפדפן/Firebase/שעון בסביבת הפיתוח — כל בדיקה אמיתית ידנית ע"י המשתמש.

## המשימה
לתעד אימון שלם מ-Apple Watch בלי להוציא טלפון מהתיק. **אילוצים:** בלי App Store, בלי Apple Developer ($99), בלי native. הפתרון: שעון = **Apple Shortcuts** → **Google Apps Script proxy** → **Firestore** doc `gympro_data/live_session` → ה-PWA קורא/מאמץ. בסוף פותחים טלפון ומסכמים.

## מה כבר מותקן ועובד
- **Firebase:** פרויקט `gympro-elite` (Spark plan, Anonymous auth).
- **Proxy פרוס:** `docs/watch-bridge.gs` ב-Apps Script, Web App (Anyone), עם Script Properties: `SECRET_TOKEN`, `FB_PROJECT_ID=gympro-elite`, `FB_CLIENT_EMAIL`, `FB_PRIVATE_KEY` (service account). URL מסתיים ב-`/exec` (מוגן ב-token).
- **אומת שעובד:** `getState` מחזיר JSON תקין; `logSet` **דרך דפדפן (GET)** כותב סט וה-PWA קולט (toast "עודכן מהשעון", הסט מופיע, סיום שומר לארכיון). dedupe + finish עובדים.
- **קיצור "Log Set" בנוי באייפון:** Text(URL) → Get Contents getState(POST JSON token+action) → Get Dictionary suggestWeight + currentExName → Ask Number משקל/חזרות/RIR → Current Date → Get Contents logSet(POST JSON: token, action=logSet, w, r, rir, setId) → Get Dictionary restTime → Start Timer → Show Result.

## ארכיטקטורה טכנית
- doc `live_session` = `{ active:bool, data:"<json>" }` (שדה JSON-string יחיד; `FirebaseManager._unwrapLive` פותח; ה-proxy כותב אותו דרך Firestore REST כ-stringValue).
- **קבצים:** `storage.js` (FirebaseManager: publishLiveSession/getLiveSession/listenLiveSession/clearLiveSession + KEY_WATCH_BRIDGE_*); `workout-core.js` (מודול `WatchBridge`); `index.html` (מתג הגדרות). הגשר **כבוי כברירת מחדל**.
- `WatchBridge`: `onStateSaved` (hook ב-`saveSessionState`, debounce 400ms) → `_doPublish` (read-merge-write); `_adopt` (onSnapshot); `forceAdopt` (מתעלם מ-rev, מאמת sessionId) נקרא אחרי `restoreSession` ובחזרה-לפוקוס; `activate()` אידמפוטנטי.
- proxy actions: `getState`/`logSet`/`nextExercise`/`finish`. Guards: active+sessionId, נרמול rir, ולידציית w/r, dedupe לפי setId, `suggestWeight||0`, נרמול סיומת "(Main)". `doGet` מעביר את כל הפרמטרים (לבדיקות בדפדפן).

## הבאג שעדיין לא נפתר ⚠️
**Clobber דו-כיווני:** כשה-PWA פתוח/פעיל בקדמה, הוא מפרסם מחדש את המצב שלו (log ריק, setIdx:0) ו**דורס** את כתיבות השעון ב-doc. לכן סטים מהקיצור לא נשמרים — `getState` מראה `setIdx:0` למרות ש-logSet "הצליח". ה-toast "סונכרן מהשעון" קופץ אבל אין מה למזג כי הענן נדרס.

**תיקונים שכבר בוצעו (לא פתרו סופית):**
- v15.90: `forceAdopt` אחרי restore + focus/visibility.
- v15.91: **read-merge-write** ב-`_doPublish` (קורא ענן + ממזג log לפי setId לפני כתיבה) — אמור למנוע clobber.
- המשתמש בדק ואמר "לא עובד" — **לא ברור אם עדכן ל-15.91 ו/או הסיר את שדה `setId` מהקיצור לפני הבדיקה.**

## הצעדים הבאים לאבחון
1. ודא שהמשתמש עדכן את ה-PWA ל-**15.91** (הגדרות → בדוק עדכון; ראה v15.91 למטה).
2. ודא שהסיר את שדה `setId` מהקיצור (כדי לשלול dedupe; ה-proxy מייצר מזהה ייחודי לבד).
3. בדיקה מבודדת: עם אימון פעיל + הטלפון **ברקע/נעול**, רשום סט מהקיצור, ואז פתח `…/exec?token=<TOKEN>&action=getState` בדפדפן — בדוק אם `setIdx` טיפס (לא חוזר ל-0).
4. אם ה-clobber נמשך למרות read-merge-write: שקול תיקון חזק יותר — **שהטלפון לא יפרסם את ה-log כלל במהלך אימון פעיל** (יפרסם metadata+plan רק בהתחלה; ה-proxy בעלים בלעדי של ה-log, append-only), או Firestore transaction.
5. אבחן אם ה-setIdx:0 נובע מ-dedupe (setId חוזר) או clobber — דרך פעולת "Show Result" בקיצור שמציגה את תשובת ה-logSet.

## כלים לאבחון (ידני ע"י המשתמש)
- דפדפן GET ל-`/exec?token=<TOKEN>&action=getState` (וגם `action=logSet&w=99&r=5&rir=3`).
- "Show Result" בקיצור מציג את תשובת ה-proxy.
- **אבטחה:** לא לבקש/לשתף את ה-SECRET_TOKEN או ה-private_key בצ'אט.

המשך מנקודה זו: ודא 15.91 + הסרת setId, ואם ה-clobber נמשך — עבור לתיקון החזק (טלפון לא מפרסם log באימון פעיל / transaction).
