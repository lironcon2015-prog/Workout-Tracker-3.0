# GYMPRO ELITE — שדרוג ל-Next Level (Premium Tier)

> **קובץ זה הוא תוכנית עבודה פעילה ומאושרת.** עיין בו בכל פעם שמדברים על שדרוג, פיצ'רים חדשים, או המשך פיתוח. עדכן את סטטוס הספרינטים כשמשהו מסתיים.

---

## Context

האפליקציה (v15.13, ~12,700 שורות Vanilla JS) מתפקדת היטב כ-PWA לאימוני כוח, עם שפה עיצובית "Liquid Obsidian" ייחודית, AI Coach, ארכיון, ו-Firebase sync. **המטרה:** להעלות את החוויה לרמת אפליקציות פרימיום (Apple Fitness / Whoop) ב-3 צירים — פיצ'רי אימון מתקדמים, מנוע אנליטיקה, ו-UI/UX מודרני — תוך שמירה על DNA (offline-first, vanilla, RTL עברית).

**גילוי קריטי מהסריקה:** "Supersets/Giant Sets" כבר ממומשים בקוד תחת שם "clusters" (`state.activeCluster`, `clusterMode`, מסך `ui-cluster-rest`). הם דורשים שיפור חוויה והרחבה ל-3+ תרגילים, לא בנייה מאפס.

**חוב טכני חוסם:** `restoreSession()` משכפל את לוגיקת ה-UI chrome של `navigate()` (workout-core.js:265-281 vs מקור ב-`navigate`). כל מסך חדש שנוסיף ייצור באג ב-recovery flow אלא אם נתקן קודם.

---

## סטטוס ספרינטים

| Sprint | סטטוס | גרסה אחרי | תאריך השלמה |
|--------|-------|------------|---------------|
| S0 — Foundation Refactor | ✅ Done | v15.14 | 2026-05-21 |
| S1 — Giant Sets + AI Recommendations | ✅ Done | v15.17 | 2026-05-21 |
| S2 — UI/UX Polish | ✅ Done | v15.19 | 2026-05-21 |
| S3 — Analytics Engine | ✅ Done | v15.20 | 2026-05-21 |
| S4 — Workout Live View | ✅ Done | v15.25 | 2026-05-21 |

> סטטוסים: ⬜ Pending · 🟡 In Progress · ✅ Done · ❌ Blocked

**✅ כל 5 הספרינטים של ה-ROADMAP המקורי הושלמו (עד v15.25).** הסעיפים למטה (Sprint 0–4) הם תיעוד היסטורי. עבודה שבוצעה מעבר לתוכנית המקורית מתועדת בסעיף "Post-Roadmap" שמתחת.

---

## Post-Roadmap — מה נבנה מאז (v15.26 → 15.76)

| תחום | מה נבנה | גרסאות |
|------|---------|--------|
| **Coach Summary** | סיכומי מאמן אוטומטיים (אימון/שבוע/בלוק), פרומפטים ניתנים לעריכה | ~v15.47 |
| **מסך Composition — שקילות** | משקל/שומן, גרפים, OCR לצילום משקל, ייבוא/ייצוא CSV, מצב תזונתי לכל שקילה | — |
| **אינטגרציית MyFitnessPal** | גשר Apps Script (`docs/mfp-nutrition-bridge.gs`, JSONP), ייבוא תזונה מ-Gmail, כרטיס ממוצעים דינמי, גרפי קלוריות/חלבון, היסטוריה, 3 ייצואים | v15.59–15.76 |
| **גישת AI לתזונה+שקילות** | `buildSystemPrompt` מזריק תזונה בפועל + הרכב גוף לכל קריאת Gemini | v15.74 |
| **ניווט בהחלקה** | מעבר בין טאבים בהחלקת אצבע (RTL-aware, חוסם גסט-קצה של ספארי) | v15.68–15.70 |
| **אחידות UI** | בוררים זהים (`segment-wrapper`/`seg-btn`) ב-Composition/ארכיון/אנליטיקה, הסרת כותרות מיותרות | v15.62–15.67 |
| **הקשחת ענן** | chunking לארכיון ולקובץ MFP הגולמי (מניעת 1MB מוחלטת), סנכרון תזונה/שקילות | v15.75–15.76 |

פירוט טכני מלא של תתי-המערכות האלה: ראה `PROJECT_KNOWLEDGE.md`.

### כיוונים פתוחים שהוצעו (טרם בוצעו)
- **מנוע TDEE / מאזן אנרגיה** — חישוב הוצאה קלורית אמיתית ממגמת משקל × צריכה (האימפקט הגבוה הבא).
- דשבורד Cut/Surplus, דוח שבועי הוליסטי מה-AI, יעדי מאקרו.

---

## Sprint 0 — Foundation Refactor *(חוסם — חובה לפני הכל)*

**משך מוערך:** 4-6 שעות · ~150 שורות

חילוץ הלוגיקה המשוכפלת בין `navigate()` ל-`restoreSession()` לפונקציה משותפת, ככה שכל מסך חדש ייהנה מ-recovery אוטומטית.

**קבצים:**
- `workout-core.js` — חלץ `_applyScreenChrome(screenId)` שמטפל ב-tab-bar/strip/buttons. הוצא את `WORKOUT_SCREENS` ל-constant גלובלי (כרגע מוגדר פעמיים — בתוך `navigate` ובתוך `restoreSession`:270).
- `archive-logic.js` — חלץ `parseArchiveEntry(entry)` שמחזיר structure אחיד (sets as objects, לא strings). היום `parseSetsFromStrings()` קיים אבל כל פונקציה קוראת לו בנפרד.

**Verification:** הרץ recovery flow אחרי refresh על 9 ה-screens ב-WORKOUT_SCREENS — כל אחד מציג tab-bar/strip/settings זהים ל-navigate רגיל.

---

## Sprint 1 — Workout Engine: Giant Sets + AI-Powered Recommendations

**משך מוערך:** 14-18 שעות · ~700 שורות

מקובץ כי שני הפיצ'רים פוגעים ב-`initPickers()` ו-`nextStep()` באותו flow. **שינוי קונספטואלי קריטי:** המלצות לסט הבא **לא** נובעות מאלגוריתם כללי — הן נשלחות ל-AI Coach הקיים (Gemini) עם context מלא של ביצועים אחרונים + **מצב תזונתי** של המשתמש (`maintenance` / `cut` / `surplus`), כדי שההמלצה תהיה אישית ורלוונטית.

### 1a. Nutritional State Context (תשתית ל-AI מותאם)

**Data Model — חדש:**
```js
// storage.js prefs
nutritionalState: 'maintenance' | 'cut' | 'surplus'   // default: 'maintenance'
nutritionalStateStartDate: ISO string                 // מתי נכנס למצב הנוכחי
```

**קבצים:**
- `storage.js` — `getNutritionalState()` / `setNutritionalState(state, startDate?)` + שמירה. המונחים באנגלית במחרוזות.
- `index.html` — section חדש בהגדרות (`#ui-settings`): "Nutritional State" עם 3-button toggle (Maintenance / Cut / Surplus) + תאריך כניסה אופציונלי.
- `style.css` — `.nutri-toggle` (3 כפתורי pill בסגנון Liquid Obsidian).
- `workout-core.js` — `_updateAIContextBanner()` (קיים, workout-core.js:2745) מורחב כך שה-banner של ה-AI מציג גם את מצב התזונה הנוכחי. `_buildAIContextPrompt()` חדש שמוסיף את המצב לפרומפט.

### 1b. Giant Sets (הרחבת clusters קיימים)

- `editor-logic.js:645` (`renderClusterItem`) — להרחיב min=2 max=6 תרגילים. תווית דינמית: 2=Superset, 3+=Giant Set.
- `workout-core.js` flow ב-`showConfirmScreen` (workout-core.js:832) — scrollable container כשיש 4+ תרגילים.
- `index.html` — UI labels מותאמים לפי גודל ה-cluster.

### 1c. AI-Powered Set Recommendation

**הגישה:** במקום אלגוריתם static, כפתור "💡 בקש המלצה מהמאמן" במסך `ui-main` שולח context-rich prompt ל-AI הקיים ומקבל המלצה מותאמת. ה-response מוצג inline (לא כצ'אט) — כפתור אישור ממלא את ה-pickers.

**קבצים:**
- `workout-core.js` — חדש:
  - `requestAIRecommendation(exName, setIdx)` — בונה payload, שולח דרך `_callGeminiAPI()` הקיים (workout-core.js:~2700), מקבל JSON structured response.
  - `applyAIRecommendation(rec)` — ממלא pickers + haptic + לוג ל-`aiChatHistory` (כך שהמשתמש יכול לבדוק בצ'אט מה ה-AI חשב).
  - `_buildRecommendationPrompt(exName)` — builder שמרכז: persona המשתמש (קיים), **nutritional state + ימים במצב**, 5 ביצועים אחרונים של התרגיל (משתמש ב-`getLastPerformances()` הקיים), volume שבועי, plateau status (אם זוהה ב-Sprint 3).
- `index.html` — `#set-recommendation` div מעל `#weight-picker` ב-`ui-main` עם 2 מצבים: idle (כפתור "בקש המלצה") + loaded (pill עם המלצה + הסבר).
- `style.css` — `.recommendation-pill` (Liquid Obsidian: `#1b1b1b`, accent `#0A84FF` left-border), `.rec-loading` (skeleton shimmer).

**מבנה Prompt ל-AI (דוגמה):**
```
Context:
- User nutritional state: CUT (day 21)
- Persona: "מתחיל-מתקדם, אוהב כוח טהור"
- Exercise: Bench Press
- Last 5 sessions:
  - 2026-05-12: 80kg × 8 RIR 2, 80kg × 7 RIR 1, 75kg × 8 RIR 2
  - 2026-05-08: 80kg × 7 RIR 2, 77.5kg × 8 RIR 1, ...
- Weekly volume: 12 sets (steady -5% from last week)
- Plateau status: no plateau

Task: Recommend weight×reps×RIR for the next set.
Return JSON: { "w": number, "r": number, "rir": number, "reason": "short Hebrew explanation" }
```

**Response Handling:**
- ה-AI מחזיר JSON; אם פרסור נכשל → fallback ל"שאל ב-AI Coach" (פותח את המודל עם הפרומפט).
- **ב-cut**: ה-AI יודע לא להציע העלאות אגרסיביות, לעדיפות שמירת volume על כוח.
- **ב-surplus**: יעודד דחיפה לכיוון progressive overload.
- **ב-maintenance**: יעודד עקביות + תחזוקת PRs.

**Backwards Compat:**
- אם אין API key (`getAIConfig().apiKey` ריק) → כפתור ההמלצה מוסתר. המסך הקלאסי ממשיך לעבוד.
- אם `nutritionalState` undefined → default `'maintenance'`.

**Verification:**
- הגדר state=Cut, בצע 5 סטים של Bench → לחץ "בקש המלצה" → ה-AI מציע מסר התואם cut (לא Push aggressively).
- שנה state=Surplus → אותו דאטה → ה-AI מציע +step + +1 rep.
- צור Giant Set עם 4 תרגילים → `nextStep()` מתקדם 1→2→3→4→round-rest.
- כבה API key → כפתור ההמלצה נעלם, המסך הקלאסי תקין.

---

## Sprint 2 — UI/UX Polish: Skeletons + Transitions + Gestures

**משך מוערך:** 10-14 שעות · ~500 שורות

CSS-heavy, JavaScript מינימלי. משדרג את התחושה הכללית של האפליקציה לפני שמוסיפים תוכן אנליטי כבד.

**קבצים:**
- `style.css` — `.skeleton-shimmer`, `.screen.transitioning` (slide R→L), `.swipe-back-zone`.
- `workout-core.js` — הרחב `navigate()` להריץ slide animation דרך classList. הוסף `_initSwipeBackGesture()` ו-`_initSheetDragDismiss(sheetEl)` ב-DOMContentLoaded.
- `index.html` — placeholder skeletons ב-`#ui-archive`, `#ui-analytics`.

**API חדש:**
- `showSkeleton(containerId)` / `hideSkeleton(containerId)`
- `_initSwipeBackGesture()` — touchstart/move/end על body; swipe ימינה (RTL = back) >80px → `handleBackClick()`. כיוון נגזר מ-`getComputedStyle(document.body).direction` כדי לא לבלבל RTL/LTR.
- `_initSheetDragDismiss(sheetEl)` — לכל `.bottom-sheet` (Session Log, AI Coach, Range Picker); drag-down >100px → סוגר.

**CSS Sample (Liquid Obsidian compliant):**
```css
@keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
.skeleton-shimmer {
    background: linear-gradient(90deg, #1b1b1b 0%, #2a2a2a 50%, #1b1b1b 100%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 2rem;
}
```

**Verification:** swipe ימינה ב-archive → חזרה ל-home. drag-down על AI sheet → סוגר. טעינת ארכיון מציגה shimmer לפני התוכן.

---

## Sprint 3 — Analytics Engine: Heatmap + Plateau + PR Predictions

**משך מוערך:** 14-18 שעות · ~800 שורות

3 פיצ'רים אנליטיים שכולם קוראים מ-`getArchiveClean()` ושותפים לפונקציית aggregation משותפת.

**קבצים:**
- `archive-logic.js` — חדש: `_aggregateByMuscleWeek(archive, weeks)`, `detectPlateau()`, `predictPR()`, `renderVolumeHeatmap()`, `renderPRTimeline()`.
- `index.html` — 3 sections חדשים תחת `#ui-analytics`: `#vol-heatmap-card`, `#plateau-card`, `#pr-prediction-card`.
- `style.css` — `.heatmap-grid` (CSS grid 7×N), `.heatmap-cell` (gradient לפי intensity), `.plateau-alert`.
- `storage.js` — `prefs.plateauThreshold` (default: 3 שבועות ללא צמיחת e1RM).

**Data Model:** אין שינוי בארכיון. הכל מחושב מ-`details` הקיים + `parseSetsFromStrings()`.

**אלגוריתמים:**
- **Heatmap:** `muscle × week` matrix, צבע לפי volume percentile של אותו שריר על פני התקופה. *(אלגוריתם בלבד — אין AI; זה נתון גולמי.)*
- **Plateau Detection:** רגרסיה לינארית על e1RM ב-3-6 שבועות מזהה את ה-flat trend. **אבל** ההמלצה (deload / swap / שינוי טכניקה) **לא נוצרת מ-rule-based** — היא נשלחת ל-AI Coach דרך `requestAIPlateauAdvice(exName, plateauData, nutritionalState)`. ה-AI מקבל context: כמה שבועות flat, מצב תזונתי (`cut` → plateau זה נורמלי, להציע "wait it out"; `surplus` → plateau מדאיג, להציע technique change), וההיסטוריה. כפתור "החלף תרגיל" מחבר ל-`openSwapMenu()` הקיים.
- **PR Prediction:** linear regression על e1RM timeline → תחזית 4 שבועות עם CI. דרישות מינימום: n≥4 ו-r²≥0.5; מתחת לסף → "אסוף עוד נתונים". **שכבת AI:** במידה ויש prediction חיובית, ה-AI מספק "narrative" קצר ("בקצב הנוכחי תגיע ל-100kg בעוד 4 שבועות. בהינתן ה-cut, מומלץ לעדכן ציפיות").

**רכיב Heatmap (RTL):** Grid 7-עמודות × N שורות. יום ראשון מימין (`grid-auto-flow: dense; direction: rtl`). hover/touch → tooltip עם `volume kg / sets`.

**Backwards Compat:** ארכיון לפני 14.12.0-24 חסר שדה `week` — fallback ב-`detectPlateau`: גזירה מ-`timestamp` חודש-של-אימון.

**Verification:**
- 3 אימונים עם Lateral Raises באותו משקל → plateau card מופיע עם המלצה.
- 5 אימונים עם trend עולה ב-Bench → PR card מציג תחזית `+5kg ב-4 שבועות (CI: ±2kg)`.
- 12 שבועות נתונים → heatmap מראה אילו ימים/שרירים פעילים יותר.

---

## Sprint 4 — Workout Live View + Interactive Charts

**משך מוערך:** 12-16 שעות · ~650 שורות

המסך הכי "פרימיום" — שכתוב חוויית `ui-main` ל-fullscreen + שדרוג כל ה-SVG charts ל-touch.

**קבצים:**
- `index.html` — `#ui-main` partial rewrite: timer ענק (`font-size: 6rem` Heebo 900), swipe-area לסט הבא, fullscreen toggle.
- `workout-core.js` — `enterWorkoutLiveMode()` (משתמש ב-`wakeLock` הקיים workout-core.js:152 + Fullscreen API). הרחב `nextStep()` עם swipe trigger.
- `archive-logic.js` — הרחב `drawMicroLineChart` (1887), `_homePRDrawChart`, `renderVolumeBarChart` עם touch handlers.
- `style.css` — `.workout-live`, `.timer-mega` (8rem heebo italic), `.set-swipe-card`.

**API חדש:**
- `enterWorkoutLiveMode()` — wake lock + fullscreen + hide chrome.
- `_attachChartTouch(svgEl, points, formatter)` — generic helper; touchmove → nearest x → tooltip עוקב.
- `_attachPinchZoom(svgEl, viewBoxRef)` — touch-action: none + 2-finger pinch.

**רכיבי UI חדשים:**
- **Live View:** Timer מנוחה במרכז המסך, מתחתיו "סט 2/4 — Squat 100kg × 8 RIR 2", סוואייפ שמאלה (RTL: ימינה ויזואלית) = הקלט סט (קורא ל-`nextStep()` הקיים).
- **Interactive Charts:** מבנה `drawMicroLineChart` מקבל `<rect>` שקוף ברוחב מלא + touchmove → `selectMicroPoint()` הקיים.

**Backwards Compat:** Toggle ב-`prefs.liveMode` (default: off). המסך הקלאסי נשאר ברירת מחדל; המשתמש מפעיל בהגדרות.

**Verification:**
- ui-main + liveMode → מסך שחור מלא, timer ענק, swipe = הקלטת סט.
- touch על micro-chart בארכיון → tooltip עוקב אחרי האצבע. pinch → zoom.

---

## כללי על כל Sprint (קריטי לפי CLAUDE.md)

1. **עדכון גרסה חובה בכל commit:** `sw.js` CACHE_VERSION + `version.json` (`15.13 → 15.14 → ...`). אחרת ה-PWA לא יזהה עדכון.
2. **GitHub Actions auto-merge crashes על push שני** — לאחר כל push לbranch `claude/**`, בצע merge ידני ל-main לפי `git merge --no-ff origin/claude/BRANCH_NAME`.
3. **Offline-first שמור:** כל האלגוריתמים (recommendation/plateau/prediction) רצים על LocalStorage. אפס תלות בשרת.
4. **Migration:** אין דריסה של ארכיון. כל קוד אנליטי משתמש ב-`?? defaultValue` לכל שדה חדש.

## סדר ביצוע מומלץ

`S0 → S1 → S2 → S3 → S4`

הזזתי את S2 (UI Polish) לפני S3 (Analytics) כדי שהמשתמש ירגיש את "הקפיצה" הוויזואלית עוד לפני שהאנליטיקה מוכנה. זה גם נותן זמן לבדיקת gestures על מסכים קיימים לפני שמוסיפים מסכים חדשים.

## סך הכל

~54-72 שעות · ~2,800 שורות קוד חדשות · 5 sprints · 10 פיצ'רים בולטים (כולל Nutritional State).

## שילוב AI Coach לאורך כל המערכת

הסכמה החדשה היא ש-**AI Coach הוא המוח** של ההמלצות, לא אלגוריתם static:

| פיצ'ר | מה מחושב מקומית | מה ה-AI מוסיף |
|--------|------------------|----------------|
| Set Recommendation (S1) | היסטוריית סטים, RIR trend | המלצה אישית עם הסבר, מותאם ל-nutritional state |
| Plateau Detection (S3) | זיהוי flat slope (regression) | המלצה (deload/swap/technique) מותאמת למצב |
| PR Prediction (S3) | רגרסיה לינארית + CI | Narrative מותאם (cut vs surplus expectations) |

**Context שמועבר ל-AI בכל קריאה:** persona (קיים) + nutritional state + days in state + הביצועים הרלוונטיים.

**עלות:** כל בקשה ל-Gemini = ~$0.0001 ב-Flash. צפי: 5-15 בקשות/אימון = זניח.

## Critical Files

| קובץ | היקף שינוי |
|------|------------|
| `workout-core.js` | כל הספרינטים |
| `archive-logic.js` | S0, S1, S3, S4 |
| `editor-logic.js` | S1 |
| `style.css` | S1, S2, S3, S4 |
| `index.html` | S1, S2, S3, S4 |
| `storage.js` | S3 (prefs) |
| `sw.js` + `version.json` | כל commit |

## Verification מערכתית (End-to-End לאחר כל Sprint)

1. Recovery flow: refresh באמצע אימון → המסך הנוכון נטען עם chrome נכון.
2. Backward compat: פתח ארכיון ישן (לפני 14.12.0) → כל המסכים פועלים ללא קריסה.
3. PWA: הסר מטמון בדפדפן → טען מ-Service Worker → גרסה תואמת ל-`version.json`.
4. RTL: כל גסט/אנימציה נראה נכון בעברית (סוואייפ ימינה = back).
