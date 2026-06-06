# מתכון Shortcuts — גשר אפל-ווטש (אימון חי)

מטרה: לתעד אימון מ-Apple Watch בלי להוציא את הטלפון מהתיק. השעון שולח פעולות
ל-Apps Script proxy (`docs/watch-bridge.gs`), שכותב ל-Firestore `live_session`,
והטלפון (PWA) מסכם בסוף.

> **דרישות מקדימות:** Firebase מחובר ב-PWA · ה-proxy פרוס (ראה הראש של `watch-bridge.gs`) ·
> בהגדרות ה-PWA → "גשר אפל-ווטש": הפעלה + URL + token. השעון צריך רשת (סלולרי או טלפון בטווח).

זרימה: מתחילים את האימון **בטלפון** (בוחרים אימון → התרגיל הראשון). מכאן והלאה הכל מהשעון.

---

## משתנים משותפים
בכל קיצור, בתחילתו, הגדר Text:
- `URL` = ה-/exec של ה-proxy.
- `TOKEN` = ה-SECRET_TOKEN.

הפעולה המרכזית בכל קיצור: **Get Contents of URL**
- Method: `POST` · Request Body: `JSON`.

---

## קיצור 1 — "Log Set" (הקיצור הראשי)
1. **Get Contents of URL** → `URL` · POST · JSON:
   `{ "token": TOKEN, "action": "getState" }`
2. **Get Dictionary Value** `currentExName` (מהתשובה) → הצג ב-**Show Notification** ("תרגיל: …, סט הבא: `setIdx`+1").
3. **Ask for Input** (Number) "משקל?" → משתנה `W`.
4. **Ask for Input** (Number) "חזרות?" → משתנה `R`.
5. **Choose from Menu** "RIR?": פריטים `0,0.5,1,1.5,2,2.5,3,Fail` → משתנה `RIR`.
6. **Text** → `setId` ייחודי: השתמש ב-**Current Date** (כ-Unix/מחרוזת) או UUID.
7. **Get Contents of URL** → `URL` · POST · JSON:
   ```json
   { "token": TOKEN, "action": "logSet",
     "exName": <currentExName>, "w": <W>, "r": <R>, "rir": <RIR>, "setId": <setId> }
   ```
8. **Get Dictionary Value** `restTime` מהתשובה → משתנה `REST`.
9. **Start Timer** למשך `REST` שניות (פעולת Clock המובנית — נותנת רטט בסיום).
10. (אופציונלי) **Show Notification** "נרשם · מנוחה `REST`ש".

> טיפ: הוסף את הקיצור כ-**Complication**/בפינת השעון, או הפעל ב-"Hey Siri, Log Set".

---

## קיצור 2 — "Next Exercise"
1. **Get Contents of URL** → POST JSON:
   `{ "token": TOKEN, "action": "nextExercise" }`
2. **Get Dictionary Value** `currentExName` → **Show Notification** ("עכשיו: …").

---

## קיצור 3 — "Swap / Choose Exercise"
1. **Get Contents of URL** `getState` → קבל את התרגיל הנוכחי.
   (התוכנית `plan` כבר ב-`live_session`; לבחירה ידנית מתפריט קצר:)
2. **Choose from Menu** עם שמות תרגילי התוכנית שלך (טקסט קבוע שתגדיר פעם אחת).
3. לפי הבחירה → אפשר להשתמש ב-`nextExercise` חוזר עד שמגיעים לתרגיל, או (אם תרצה
   החלפה מפורשת) להרחיב את ה-proxy ל-`setExercise {name}`. ל-MVP: השתמש ב-Next.

---

## קיצור 4 — "Finish" (אופציונלי)
`{ "token": TOKEN, "action": "finish" }` → מסמן `active:false`.
**הסיכום והשמירה נעשים בטלפון** — פתח את ה-PWA, הוא יאמץ את הסשן ויראה את כל הסטים.

---

## בדיקת עשן (ללא שעון)
אפשר לבדוק את ה-proxy מהמחשב/טלפון עם curl:
```bash
curl -s "$URL" -H 'Content-Type: application/json' \
  -d '{"token":"<TOKEN>","action":"getState"}'
curl -s "$URL" -H 'Content-Type: application/json' \
  -d '{"token":"<TOKEN>","action":"logSet","exName":"Bench Press","w":100,"r":8,"rir":"2","setId":"t1"}'
```
שליחת אותו `setId` פעמיים → סט יחיד (dedupe). אחרי שהטלפון מסיים אימון
(`active:false`) → `logSet` יחזיר `NO_ACTIVE_SESSION`.

---

## מגבלות
- השעון חייב רשת בחדר הכושר.
- UX מסורבל מול native (פרומפט לכל קלט) — זה ה-tradeoff של "בלי App Store / בלי $99".
- אין דופק חי בקיצור (אפשר להוסיף "Start Workout" של Apple כדי שה-Watch יקליט HR ל-Health במקביל).
