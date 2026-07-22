# מתכון Shortcuts — סנכרון שינה והתאוששות מ-Apple Health

מטרה: Apple Watch מתעד שינה + התאוששות ב-Apple Health; קיצור דרך שרץ **כל בוקר**
שולח את נתוני הלילה שהסתיים לגשר (`docs/health-nutrition-bridge.gs`), והאפליקציה
מושכת משם אוטומטית בכל כניסה ובכל שעה עגולה כשהיא פתוחה.

> **דרישות מקדימות:** הגשר פרוס ומעודכן (ראה הראש של `health-nutrition-bridge.gs`) ·
> בהגדרות ה-PWA → "גשר Apple Health (שינה)": URL + token, והגשר **דלוק** ·
> Apple Watch עונדת בשינה (Ultra 3 מספק שלבים + HRV + נשימה + טמפרטורה).

> **הערה:** כל השדות אופציונליים — שלח מה שיש. האפליקציה מתנוונת בחן: בלי שלבים
> תוצג שינה כוללת בלבד; בלי HRV/RHR ציון ההתאוששות ישוקלל מהמדדים הקיימים.

---

## מסלול מהיר (מומלץ להתחלה) — בלי פירוט שלבים

בונה קיצור בשם `Sleep Sync` שמושך משך שינה + מדדי התאוששות (בלי חלוקה לשלבים):

1. **Text** → ה-URL של הגשר (`…/exec`) → שנה שם משתנה ל-`URL`.
2. **Text** → ה-SECRET_TOKEN → משתנה `TOKEN`.
3. **Format Date** → Current Date · Custom · `yyyy-MM-dd` → משתנה `TODAY`.
   (השינה של הלילה מיוחסת לתאריך הבוקר — הרץ את הקיצור בבוקר.)
4. **חשב עוגן `NIGHTSTART` = אתמול 18:00** (כדי לתפוס גם שינה שלפני חצות):
   **Format Date** → Current Date · Custom · `yyyy-MM-dd` (מאפס לחצות היום) →
   **Adjust Date** → הפחת **6 Hours** → משתנה `NIGHTSTART`.
5. **Find Health Samples** → Type: **Sleep** (Asleep) · Start Date **is between
   `NIGHTSTART` and Current Date** → **Calculate Statistics** → Sum (בדקות) → משתנה `ASLEEP`.
   > 🟢 החלון מ-18:00 אתמול תופס את מלוא הלילה, כולל דגימות שתאריכן אתמול (23:xx–00:00)
   > שהפילטר `is today` היה זורק. שאר בלוקי השינה (Deep/REM/Core/Awake) **עדיין על
   > `today`** — יתוקנו רק אחרי שנאמת שה-`asleep` תקין.
6. **Find Health Samples** → Type: **Resting Heart Rate** · today → Statistics → Average → `RHR`.
7. **Find Health Samples** → Type: **Heart Rate Variability** · today → Average → `HRV`.
8. **Find Health Samples** → Type: **Respiratory Rate** · today → Average → `RESP`.
9. **Get Contents of URL**:
   - URL: `URL` (מומלץ לכלול token ב-URL: `…/exec?token=TOKEN`)
   - Method: **POST** · Request Body: **JSON**
   - שדות פשוטים (פורמט שטוח — בלי מערך/מילון מקוננים):
     `token`=TOKEN, `date`=Formatted Date, `asleep`=ASLEEP, `rhr`=RHR, `hrv`=HVR, `resp`=RESP
     ```json
     { "token": TOKEN, "date": TODAY, "asleep": ASLEEP,
       "rhr": RHR, "hrv": HVR, "resp": RESP }
     ```
     > הגשר מקבל לילה בודד ברמת השורש — אין צורך לבנות מערך.
10. (בדיקה) **Show Result** → אמור להחזיר `{"ok":true,"sleep_stored":1}`.

**אימות:** הרץ ידנית → פתח את ה-PWA → בריאות → שינה → הנתונים אמורים להחליף את הדמה.

---

## מסלול מלא — כולל שלבי שינה (Deep / REM / Core / Awake)

Apple Health שומר שלבי שינה כדגימות `Sleep Analysis` עם ערך שלב. כדי לחלץ משך לכל
שלב, חוזרים על **Find Health Samples → Sleep** עם **פילטר נוסף לפי הערך**, ו-Sum:

לכל שלב — הוסף Find Health Samples (Type: Sleep, today) + Filter → **Value is …**:
- **Asleep Deep**  → Sum → `DEEP`
- **Asleep REM**   → Sum → `REM`
- **Asleep Core**  → Sum → `CORE`
- **Awake / In Bed** → Sum → `AWAKE`
- **In Bed** (הכל)  → Sum → `INBED`

(היחידה: דקות. אם Shortcuts מחזיר שניות — חלק ב-60 בפעולת **Calculate**.)

וכן טמפרטורת שורש כף היד (סטייה מ-baseline השינה):
- **Find Health Samples** → **Wrist Temperature** · today → Average → `TEMP`
  (ב-Ultra 3 קיים כ"Sleeping Wrist Temperature"; אם זו טמפ׳ מוחלטת, שלח אותה —
  האפליקציה מתייחסת ל-`temp` כסטייה; אפשר להשאיר ריק בהתחלה.)

**גוף ה-JSON המלא:**
```json
{ "token": TOKEN, "sleep": [ {
    "date": TODAY,
    "asleep": ASLEEP, "inbed": INBED,
    "deep": DEEP, "rem": REM, "core": CORE, "awake": AWAKE,
    "rhr": RHR, "hrv": HVR, "resp": RESP, "temp": TEMP
} ] }
```

---

## האוטומציה — פעם ביום בבוקר

באפליקציית קיצורי דרך → **אוטומציה** → ➕ → **שעה ביום**:
- שעה: **08:00** (אחרי שהשעון סיים לעבד את שנת הלילה).
- חזרה: **יומי**.
- פעולה: **הפעל קיצור דרך** → `Sleep Sync`.
- **בטל את "שאל לפני הפעלה"** (Run Immediately).

> בהפעלה הראשונה iOS יבקש אישור גישה לנתוני שינה, דופק, HRV, נשימה וטמפרטורה —
> אשר את כולם. זה קורה פעם אחת.

---

## פתרון תקלות

| תופעה | סיבה/פתרון |
|--------|------------|
| `BAD_TOKEN` | ה-token בקיצור ≠ ה-token בסקריפט |
| `ok:true` אבל שינה 0 | השעון לא עונד בשינה, או שהפילטר "today" לא תפס — בדוק שהקיצור רץ בבוקר |
| שינה נמוכה מ-Health (למשל 5:29 במקום ~7ש') | `is today` מתחיל בחצות ומפספס שינה שלפני חצות (23:xx). ה-`ASLEEP` עבר לחלון `NIGHTSTART` (אתמול 18:00) → Current Date שתופס את מלוא הלילה |
| השלבים ריקים | דלג עליהם (מסלול מהיר) — האפליקציה מציגה שינה כוללת בלבד |
| הנתונים לא מתעדכנים באפליקציה | ודא שהגשר **דלוק** בהגדרות ושה-URL/token נכונים; פתח מחדש את מסך הבריאות |
| מוצג "נתוני דמה" | עוד לא הגיעו נתונים אמיתיים — הרץ את הקיצור ידנית פעם אחת |
