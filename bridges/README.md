# הגשרים של GYMPRO ELITE

כל גשר הוא קובץ Google Apps Script שמודבק בפרויקט משלו ב-script.google.com ונפרס
כ-Web app. הכתובת וה-token מודבקים באפליקציה: הגדרות → החיבור המתאים.

| קובץ | מה הוא עושה | איפה באפליקציה | ה-token |
|---|---|---|---|
| `photo-bridge.gs` | תמונות התקדמות לדרייב, וגם נתוני המאמן (`GymPro Coach Data`) | "תמונות התקדמות" + "נתוני מאמן" | Script properties |
| `health-nutrition-bridge.gs` | תזונה, שינה ואימוני שעון מ-Apple Health | "גשר Apple Health" | בקוד |
| `watch-bridge.gs` | תיעוד אימון חי מהשעון ל-Firestore | "גשר אפל-ווטש" | Script properties |
| `backup-bridge.gs` | גיבוי שבועי מלא, וגיבוי חיבורים, למייל | "גיבוי שבועי לאימייל" | בקוד |
| `widget-bridge.gs` | snapshot לווידג'טים של האייפון | "ווידג'ט אייפון" | בקוד |
| `mfp-nutrition-bridge.gs` | ייבוא MyFitnessPal מ-Gmail | "ייבוא תזונה (MyFitnessPal)" | בקוד |

ווידג'טים (Scriptable, מושכים מ-`widget-bridge.gs`): `widget-scriptable.js` (מסך הבית),
`widget-lockscreen-scriptable.js` (מסך הנעילה).

`guides/` — מתכוני הגדרה בצד האייפון: `hae-automation-recipe.md` (Health Auto Export —
שינה והתאוששות), `health-shortcut-recipe.md` (תזונה), `watch-shortcut-recipe.md` (השעון),
`sleep-shortcut-recipe.md` (מיושן — הוחלף ב-HAE), `watch-bridge-handoff.md` (רקע פיתוח).

## עדכון גשר קיים

1. מדביקים את הקובץ החדש במקום הישן, כמו שהוא.
2. Deploy → Manage deployments → הפריסה הפעילה → עיפרון → Version: **New version**.
   לא New deployment — פריסה חדשה מקבלת כתובת חדשה, והאפליקציה ממשיכה לפנות לישנה (404).

גשר שה-token שלו "בקוד": ההדבקה מאפסת אותו ל-`CHANGE_ME`, וצריך להחזיר אותו לפני
הפריסה. גשר ב-Script properties לא דורש כלום. כשנוגעים בגשר מהסוג הראשון — מעבירים
אותו ל-Script properties (ראה CLAUDE.md).
