<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GymPro — Header Mockup</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  :root {
    --accent: #0A84FF;
    --success: #32D74B;
    --border: rgba(255,255,255,0.10);
    --card: rgba(28,28,30,0.65);
    --dim: #8E8E93;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0a0a0a;
    color: #fff;
    font-family: 'Inter', -apple-system, sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 16px 48px;
  }

  /* ── Page header ── */
  .page-title {
    font-size: 1.35em;
    font-weight: 800;
    margin-bottom: 4px;
    letter-spacing: -0.5px;
  }
  .page-sub {
    font-size: 0.78em;
    color: var(--dim);
    margin-bottom: 36px;
  }

  /* ── Section ── */
  .section-label {
    font-size: 0.7em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--dim);
    margin-bottom: 14px;
    text-align: center;
  }

  /* ── Phone ── */
  .phone-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .phone {
    width: 280px;
    background: #000;
    border-radius: 38px;
    border: 1.5px solid rgba(255,255,255,0.13);
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08);
  }
  .phone-notch {
    background: #000;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .notch-pill {
    width: 82px; height: 22px;
    background: #111;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.07);
  }
  .phone-screen { padding: 10px 14px 18px; }

  /* ── App Header ── */
  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    margin-bottom: 14px;
    height: 38px;
  }
  .brand-logo {
    font-weight: 800;
    font-size: 1em;
    letter-spacing: -0.5px;
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
  }
  .brand-logo span { color: var(--accent); }
  .left-slot, .right-slot {
    display: flex;
    align-items: center;
    gap: 2px;
    z-index: 1;
  }
  .btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    color: rgba(174,174,178,0.7);
    width: 34px;
    height: 34px;
  }
  .btn-ai {
    color: var(--accent);
    background: rgba(10,132,255,0.12);
    border: 1px solid rgba(10,132,255,0.25) !important;
  }
  .btn-back { color: var(--accent); }
  .chevron {
    width: 9px; height: 9px;
    border-right: 2px solid var(--accent);
    border-bottom: 2px solid var(--accent);
    transform: rotate(135deg);
    display: block;
    margin-top: 1px;
  }

  /* ── Placeholder content ── */
  .screen-content { display: flex; flex-direction: column; gap: 7px; }
  .ph {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
  }
  .ph-hero { height: 76px; background: linear-gradient(135deg, rgba(10,132,255,0.15), rgba(10,132,255,0.05)); }
  .ph-card { height: 48px; }
  .ph-sm   { height: 32px; }
  .ph-row  { display: flex; gap: 7px; }
  .ph-row .ph { flex: 1; height: 40px; }

  /* ── Arrow between phones ── */
  .arrow-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin: 4px 0;
  }
  .arrow-label {
    font-size: 0.7em;
    color: var(--dim);
    text-align: center;
  }
  .arrow {
    width: 32px; height: 32px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── Two-phone layout ── */
  .two-phones {
    display: flex;
    align-items: flex-start;
    gap: 0;
  }
  .phone-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .connector {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    margin-top: 80px;
    gap: 6px;
  }
  .connector-line {
    width: 1px;
    height: 40px;
    background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.15), transparent);
  }
  .connector-icon {
    width: 28px; height: 28px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65em;
    color: var(--dim);
  }

  /* ── Badge ── */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 0.7em;
    font-weight: 600;
    margin-bottom: 20px;
  }
  .badge-green {
    background: rgba(50,215,75,0.12);
    border: 1px solid rgba(50,215,75,0.25);
    color: var(--success);
  }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

  /* ── Highlight box ── */
  .highlight {
    margin-top: 28px;
    background: rgba(10,132,255,0.06);
    border: 1px solid rgba(10,132,255,0.18);
    border-radius: 14px;
    padding: 14px 18px;
    max-width: 600px;
    width: 100%;
  }
  .highlight-title {
    font-size: 0.78em;
    font-weight: 700;
    color: var(--accent);
    margin-bottom: 8px;
  }
  .highlight-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.75em;
    color: rgba(255,255,255,0.7);
    padding: 5px 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .highlight-row:last-child { border-bottom: none; }
  .hl-icon {
    width: 24px; height: 24px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  /* SVG icons inline */
  svg { display: block; }
</style>
</head>
<body>

<div class="page-title">אפשרות A — החלפה חכמה</div>
<div class="page-sub">AI ← → חזור באותו מיקום | הלוגו תמיד מרוכז ללא חפיפה</div>

<div class="badge badge-green">
  <span class="dot"></span>
  מומלץ
</div>

<div class="two-phones">

  <!-- Phone 1: Main screen -->
  <div class="phone-col">
    <div class="section-label">מסך ראשי</div>
    <div class="phone">
      <div class="phone-notch"><div class="notch-pill"></div></div>
      <div class="phone-screen">
        <div class="app-header">
          <!-- RIGHT side (RTL first) = AI button -->
          <div class="right-slot">
            <button class="btn btn-ai">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
                <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none"/>
                <circle cx="15" cy="14" r="1" fill="currentColor" stroke="none"/>
              </svg>
            </button>
          </div>
          <div class="brand-logo">GYMPRO <span>ELITE</span></div>
          <!-- LEFT side = settings buttons -->
          <div class="left-slot">
            <button class="btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
            <button class="btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="23" y2="15"/></svg>
            </button>
            <button class="btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>
        </div>
        <div class="screen-content">
          <div class="ph ph-hero"></div>
          <div class="ph-row"><div class="ph"></div><div class="ph"></div><div class="ph"></div></div>
          <div class="ph ph-card"></div>
          <div class="ph ph-card"></div>
          <div class="ph ph-sm"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Connector -->
  <div class="connector">
    <div class="connector-line"></div>
    <div class="connector-icon">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
    </div>
    <div class="connector-line"></div>
  </div>

  <!-- Phone 2: Sub screen (workout) -->
  <div class="phone-col">
    <div class="section-label">מסך אימון / ארכיון</div>
    <div class="phone">
      <div class="phone-notch"><div class="notch-pill"></div></div>
      <div class="phone-screen">
        <div class="app-header">
          <!-- RIGHT side = back button (AI hidden) -->
          <div class="right-slot">
            <button class="btn btn-back">
              <span class="chevron"></span>
            </button>
          </div>
          <div class="brand-logo">GYMPRO <span>ELITE</span></div>
          <!-- LEFT side = settings buttons -->
          <div class="left-slot">
            <button class="btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
            <button class="btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="23" y2="15"/></svg>
            </button>
            <button class="btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>
        </div>
        <div class="screen-content">
          <div class="ph ph-card"></div>
          <div class="ph ph-hero"></div>
          <div class="ph ph-card"></div>
          <div class="ph ph-row"><div class="ph"></div><div class="ph"></div></div>
          <div class="ph ph-sm"></div>
        </div>
      </div>
    </div>
  </div>

</div><!-- /two-phones -->

<!-- Summary box -->
<div class="highlight">
  <div class="highlight-title">סיכום הפתרון</div>
  <div class="highlight-row">
    <div class="hl-icon" style="background:rgba(10,132,255,0.12);">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" stroke-width="2.5"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/></svg>
    </div>
    מסך ראשי — כפתור AI Coach גלוי בצד ימין
  </div>
  <div class="highlight-row">
    <div class="hl-icon" style="background:rgba(10,132,255,0.12);">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
    </div>
    מסכי משנה — כפתור חזור גלוי, AI מוסתר
  </div>
  <div class="highlight-row">
    <div class="hl-icon" style="background:rgba(50,215,75,0.12);">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#32D74B" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    לוגו תמיד מרוכז — כפתור בודד בכל צד
  </div>
</div>

</body>
</html>
