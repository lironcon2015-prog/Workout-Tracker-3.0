/* ============================================================================
 * test/version-sync.test.js — version.json תקין ותואם ל-sw.js
 * הרצה: node test/version-sync.test.js   (ללא תלויות, ללא build)
 *
 * הבאג (v19.17.30): version.json נכתב ריק. "בדוק עדכון" נכשל ב-res.json()
 * והציג "בדוק חיבור לאינטרנט", ותווית הגרסה בהגדרות נשארה "—" — בלי שום שגיאה.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let failed = 0;
function ok(cond, name, info) { if (!cond) failed++; console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : '\n    ' + info}`); }

const raw = fs.readFileSync(path.join(root, 'version.json'), 'utf8');
let data = null;
try { data = JSON.parse(raw); } catch (e) { /* נבדק למטה */ }
ok(data && typeof data.version === 'string' && /^\d+\.\d+\.\d+$/.test(data.version),
   'version.json הוא JSON תקין עם version בפורמט X.Y.Z', `תוכן: ${JSON.stringify(raw)}`);

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const m = sw.match(/const CACHE_VERSION = 'gympro-v([\d.]+)'/);
const c = sw.match(/\* Version: ([\d.]+)/);
ok(!!m, 'sw.js מכיל CACHE_VERSION', 'לא נמצא');
ok(data && m && m[1] === data.version, 'CACHE_VERSION ב-sw.js זהה ל-version.json', `sw=${m && m[1]} json=${data && data.version}`);
ok(c && m && c[1] === m[1], 'שורת הקומנט Version ב-sw.js זהה ל-CACHE_VERSION', `comment=${c && c[1]}`);

if (failed) { console.log(`\n${failed} בדיקות נכשלו`); process.exit(1); }
console.log('\nכל הבדיקות עברו');
