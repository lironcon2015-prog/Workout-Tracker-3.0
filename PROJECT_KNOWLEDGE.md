# GYMPRO ELITE — מסמך מצב ו-DNA (Project Knowledge)

> עדכן מסמך זה בסוף כל שיחה משמעותית.
> הנחיה לסוכן: "עדכן את מסמך המצב עם השינויים מהשיחה הזו"

---

## 1. מצב נוכחי (Current State)

**גרסה:** 14.12.0-25
**סטטוס:** פיתוח פעיל

### פיצ'רים פעילים

- אימון מובנה (Upper/Lower/Full Body) עם שבועות 1–4 + Deload
- אימון Freestyle חופשי לפי קבוצת שרייר
- תרגיל מחושב (isCalc) עם בחירת 1RM ו-Progressive Overload אוטומטי
- Cluster Sets — סבבים מרובי תרגילים עם מנוחה בין סבבים
- ארכיון אימונים עם תצוגת פירוט, חיפוש, וקאלנדר
- אנליטיקה: Volume Load, Hero Metrics, Micro-Cycles, 1RM מחושב
- AI Coach (Gemini API) — היסטוריית שיחות, פרופיל מתאמן, השוואת בלוקים
- Firebase Sync — גיבוי/שחזור ל-Firestore
- PWA: Service Worker, offline-first, installable
- swipe-to-close על AI Coach sheet
- ניקוי תצוגת שיחה (clearAIChatDisplay) מבלי למחוק היסטוריה

### שינויים אחרונים (v14.12.0-25)

- תיקון `saveData` ב-StorageManager: עטוף ב-try-catch עם התראת QuotaExceededError — מונע אובדן אימונים שקט
- תיקון `saveAIHistory`: הגבלה ל-300 הודעות + try-catch + fallback חירום ל-100
- תיקון `renderManagerList`: null check לפני `innerHTML` (editor-logic.js)
- תיקון HTML injection בקאלנדר ארכיון: `openArchiveFromDrawer` מקבל `timestamp` (מספר) במקום `JSON.stringify(wo)`
- הוספת GitHub Actions workflow: auto-merge אוטומטי מ-`claude/**` ל-`main` בכל push

---

## 2. ארכיטקטורה ונתונים

### מבנה קבצים

```
index.html          — כל ה-HTML, כל ה-UI screens (display:none/flex toggle)
style.css           — עיצוב מלא: Dark Mode, Glassmorphism, RTL, animations
workout-core.js     — לוגיקת אימון, ניווט, AI Coach, state גלובלי
archive-logic.js    — ארכיון: רשימה, קאלנדר, פירוט, חיפוש
editor-logic.js     — עורך תוכנית האימונים, checkForUpdate, אנליטיקה
storage.js          — StorageManager: כל גישה ל-LocalStorage + Firebase sync
data.js             — defaultExercises, defaultWorkouts (ברירת מחדל)
sw.js               — Service Worker: cache, offline, skipWaiting
version.json        — {"version": "14.12.0-XX"} — נקרא ע"י SW + האפליקציה
manifest.json       — PWA manifest
CLAUDE.md           — הנחיות לסוכן Claude
PROJECT_KNOWLEDGE.md — מסמך זה
.github/workflows/auto-merge-to-main.yml — CI: auto-merge claude/** → main
```

### LocalStorage Keys (StorageManager)

| Key | תיאור | מבנה |
|-----|-------|------|
| `gympro_weights` | משקל אחרון לכל תרגיל | `{ [exName]: number }` |
| `gympro_rm` | 1RM אחרון לכל תרגיל מחושב | `{ [exName]: number }` |
| `gympro_archive` | כל האימונים השמורים | `Array<ArchiveEntry>` |
| `gympro_db_exercises` | רשימת תרגילים (כולל מותאמים) | `Array<Exercise>` |
| `gympro_db_workouts` | תוכניות האימון | `{ [type]: Array<WorkoutItem> }` |
| `gympro_workout_meta` | מטא לתוכניות (זמני מנוחה וכו') | `{ [type]: MetaObj }` |
| `gympro_current_session` | session פעיל בין רענונים | `StateSnapshot` |
| `gympro_analytics_prefs` | העדפות אנליטיקה + aliases | `AnalyticsPrefs` |
| `gympro_gemini_key` | מפתח Gemini API | `string` |
| `gympro_ai_models` | מודלים מועדפים (פסיק-מופרד) | `string` |
| `gympro_ai_persona` | פרופיל מתאמן ל-AI | `string` |
| `gympro_ai_history` | היסטוריית שיחות AI | `Array<{role, text}>` |
| `gympro_firebase_config` | תצורת Firebase | `FirebaseConfig` |

### ArchiveEntry — מבנה רשומת ארכיון

```js
{
  timestamp: number,       // Date.now()
  date: string,            // "25.3.26"
  time: string,            // "18:30"
  type: string,            // "Upper" / "Lower" וכו'
  week: number|string,     // 1–4 / "deload" / undefined (ישן)
  duration: number,        // דקות
  summary: string,         // טקסט מפורמט ל-AI + העתקה
  details: { [exName]: { sets: string[], vol: number } },
  exOrder: string[],
  log: Array<LogEntry>,    // נשמר מ-v14.12.0-22
  note: string
}
```

### Global State (משתנים קריטיים ב-workout-core.js)

```js
let state = {
  week, type, rm, exIdx, setIdx,
  log,                    // Array<LogEntry> — log האימון הנוכחי
  currentEx, currentExName,
  historyStack,           // ['ui-week', 'ui-main', ...] — ניווט
  isFreestyle, isExtraPhase, isInterruption,
  exercises, workouts, workoutMeta,
  clusterMode, activeCluster, clusterIdx, clusterRound, lastClusterRest,
  workoutStartTime, workoutDurationMins
};

let aiChatHistory = [];        // session-only, לא נשמר בין sessions
let aiFullArchiveMode = false; // chip toggle — כל הארכיון vs 2 בלוקים
let _aiDisplayCleared = false; // נוקתה תצוגה — לא לרנדר מחדש בפתיחה
```

---

## 3. תקלות ידועות / חוב טכני

| # | תיאור | חומרה | סטטוס |
|---|-------|-------|-------|
| 1 | ArchiveEntries ישנים (לפני v14.12.0-24) חסרים שדה `week` — buildBlockContext נותן fallback של 12 אחרונים | בינונית | פתוח — ייפתר טבעית עם אימונים חדשים |
| 2 | `details` ב-ArchiveEntry לא שומר cluster per-round — רק per-exercise name | נמוכה | פתוח |
| 3 | `buildAnalyticsSnapshot` משתמש ב-`details[ex.name].sets` עם `parseSetsFromStrings` — coupling עדין | נמוכה | פתוח |

---

## 4. זיכרון פרויקט מצטבר (Project DNA)

> הסעיף הזה הוא "המוח" של הפרויקט. הוסף אליו — אל תמחק ממנו.

### חוקי UX/UI

- האפליקציה RTL עברית — כל layout בהתאם. `header-start-slot` (ימין ויזואלית) = AI; `d-flex` (שמאל ויזואלית) = back+reload+sound
- כפתור back מוסתר על מסכי tab ראשי (`ui-week`, `ui-analytics`, `ui-archive`) — מוצג רק בתוך flow אימון
- AI Coach הוא bottom sheet עם swipe-to-close על ה-header/handle בלבד (לא על אזור ההודעות)
- alert/confirm מותאמים (custom modal) — לא `window.alert`. z-index: alert=1100, ai-sheet=900, modal-overlay=1000
- כפתור מחיקה/איפוס תמיד דורש confirm
- אנימציית slide בניווט: קדימה מימין, אחורה משמאל (RTL-aware)
- Haptic feedback על כל פעולה משמעותית: `haptic('light'|'success'|'error')`

### חוקי לוגיקה ו-Persistence

- שמירה ל-LocalStorage מיד עם כל שינוי — לא בסוף flow
- `state.log` הוא מקור האמת לאימון הנוכחי; `summaryLines` ו-`details` נגזרים ממנו ב-`_saveToArchive()`
- Volume Load = weight × reps (ללא sets — כל set נספר בנפרד)
- 1RM: formula Epley כברירת מחדל. מאוחסן ב-`gympro_rm` per exercise
- Progressive Overload אוטומטי: מחושב מ-1RM × intensity% לפי שבוע ו-RIR target
- Cluster: לוגיקת round tracking דרך `entry.round` — חובה לשמור בlog ובarchive
- `buildBlockContext()` מזהה תחילת בלוק לפי `archive[i].week === 1`
- archive מסודר מהחדש לישן (index 0 = אחרון)

### סטנדרטים לכתיבת קוד

- `deepClone(obj)` — תמיד במקום `JSON.parse(JSON.stringify(obj))`
- `--glass` CSS variable — תמיד במקום `backdrop-filter: blur(20px) saturate(180%) brightness(0.88)`
- `showAlert()` / `showConfirm()` — תמיד במקום `window.alert/confirm`
- Error handling ב-`catch(e)` עם `console.error('GymPro: ...', e)` בכל פעולת Storage
- פונקציות DOM מתחילות ב-`build` (בניה) או `render` (עדכון) — לא מעורבב
- הערות בעברית על מנגנונים מורכבים

### החלטות ארכיטקטוריות (ADRs)

- **Vanilla JS ללא Framework** — PWA offline-first, 0 תלויות, bundle size=0, ביצועים מקסימליים
- **SPA עם display toggle** — כל ה-screens ב-index.html, ניווט ע"י `historyStack` + show/hide. אין routing.
- **LocalStorage ישיר** — ללא IndexedDB (נתונים קטנים, sync פשוט). Firebase כגיבוי אופציונלי
- **AI כ-system prompt** — כל ה-context (ארכיון, מצב נוכחי, פרופיל) נשלח כ-system instruction בכל קריאה. אין streaming.
- **SW cache-first** — כל הקבצים ב-cache, fetch מ-network רק אם לא קיים. `skipWaiting` + `clients.claim` לעדכון מיידי
- **Gemini API ישיר מ-client** — ללא backend. מפתח API מאוחסן ב-LocalStorage (סיכון ידוע, קביל ל-personal app)
- **segment-based summary** — log מאוחסן per-entry עם `isCluster`/`round` כדי לשמר מבנה cluster בתצוגה ובהעתקה

---

## 5. תרחישי בדיקה (Verification Flows)

### Flow בסיסי

1. פתיחת אפליקציה → מסך שבוע → בחירת יום → בחירת סוג אימון
2. מסך 1RM → בחירת משקל → מסך אימון ראשי
3. רישום סט → לחיצת "אישור סט" → עדכון log → מעבר לסט הבא
4. סיום תרגיל → מעבר לתרגיל הבא
5. סיום אימון → מסך סיכום → שמירה לארכיון
6. פתיחת ארכיון → פירוט אימון → תצוגת cluster נכונה

### Cluster Flow

1. תרגיל עם `isCluster=true` → כניסה ל-clusterMode
2. סבב ראשון: כל התרגילים בסבב → מסך מנוחה בין סבבים
3. סבב שני: חזרה על כל התרגילים עם `round=2`
4. תצוגת סיכום: מוצג per-round (לא per-exercise)

### Edge Cases ידועים

- אימון שמתחיל ונזנח → session נשמר ב-`gympro_current_session`, מתאושש בטעינה הבאה
- Deload week: `state.week = 'deload'` — לא מספר, לא מחשב overload
- תרגיל unilateral (יד אחת): note אוטומטי, vol מחושב ×1 לא ×2
- archive entries ישנים ללא שדה `log` — `buildArchiveDetailHTML` נופל ל-fallback מ-`details`
- archive entries ישנים ללא שדה `week` — `buildBlockContext` נותן fallback של 12 אחרונים

---

## 6. לקחים אחרונים (Latest Lessons)

> בסוף כל שיחה משמעותית, הוסף לקחים חדשים כאן.

**שיחה — 25.3.2026:**

- **טעות קריטית:** `git merge --theirs` בזמן conflict resolution הביא קוד ישן מה-feature branch וכיסה commits חדשים מ-main. תמיד לפתור conflicts ידנית או לוודא מה "theirs" vs "ours" לפני שימוש ב-checkout shortcuts.
- **טעות:** bump גרסה ב-commit נפרד מהשינוי — SW עלה עם cache נכון אבל קוד ישן. חובה: sw.js + version.json **באותו commit** עם שאר השינויים.
- **גילוי:** `archiveEntry` לא שמר שדה `week` — `buildBlockContext()` עבד רק עם fallback. AI Coach לא יכל להשוות בלוקים נכון.
- **גילוי:** אפשר לשלוט על התנהגות סוכן Claude דרך `CLAUDE.md` בתיקיית הפרויקט — נקרא אוטומטית בכל session.
- **העדפה:** מסמך `PROJECT_KNOWLEDGE.md` מאפשר continuity בין sessions ומונע אובדן context.

**שיחה — 26.3.2026:**

- **באג קריטי שתוקן:** `saveData` ב-StorageManager לא היה עטוף ב-try-catch — QuotaExceededError גרם לאובדן נתונים שקט. **חוק:** כל `localStorage.setItem` חייב try-catch.
- **באג:** `saveAIHistory` ללא מגבלת גודל — היסטוריה גדלה ללא הגבלה ומאיצה הגעה ל-quota. **חוק:** תמיד slice(-300) לפני שמירת היסטוריה.
- **באג:** `JSON.stringify(wo)` ב-onclick בקאלנדר ארכיון — HTML injection אפשרי דרך שדות notes. **חוק:** לעולם לא להכניס אובייקטים מ-user input ל-inline HTML. העבר רק מזהה בטוח (timestamp, index).
- **בעיה מערכתית:** push לbranch `claude/**` בלבד **אינו** מעדכן את האפליקציה — היא מגישה מ-`main`. המשתמש ראה גרסה ישנה למרות שהקוד עודכן. **פתרון:** GitHub Actions workflow (`.github/workflows/auto-merge-to-main.yml`) מבצע auto-merge אוטומטי מ-`claude/**` ל-`main` בכל push. **מעכשיו: "בדוק עדכון" יעבוד תמיד.**
- **לקח:** `checkForUpdate` מסתמך על השוואת `window._gymproVersion` (מה-SW cache) מול fetch עם cache-bust לשרת. אם שניהם מצביעים על אותו שרת (main) עם אותה גרסה — לא יזוהה עדכון. הפתרון: merge מהיר ל-main = גרסה חדשה זמינה מיד.
