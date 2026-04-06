/**
 * GYMPRO ELITE - EDITOR & MANAGER LOGIC
 * Version: 14.12.0-90
 * שדרוג: Kinetic Precision Editor (ממשק עריכה חדש, גרירת תמונות, פול תמונות דינמי).
 */

// ─── WORKOUT QUICK MENU (היסטוריה / יומן) ─────────────────────────────────

function toggleWorkoutQuickMenu() {
    const menu = document.getElementById('workout-quick-menu');
    if (!menu) return;
    const isOpen = menu.style.display !== 'none';
    menu.style.display = isOpen ? 'none' : 'block';
}

// סגירת התפריט בלחיצה מחוץ לו
document.addEventListener('click', (e) => {
    const menu = document.getElementById('workout-quick-menu');
    const btn  = document.getElementById('btn-workout-menu');
    if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
        menu.style.display = 'none';
    }
});

// ─── AUTO CLOUD CONFIG SAVE ────────────────────────────────────────────────

function autoSaveConfigToCloud() {
    if (typeof FirebaseManager === 'undefined' || !FirebaseManager.isConfigured()) return;
    FirebaseManager.saveConfigToCloud().then(ok => {
        if (typeof showCloudToast === 'function') {
            showCloudToast(ok ? '☁️ קונפיג נשמר בענן' : '⚠️ שגיאה בשמירת קונפיג לענן', ok);
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// WORKOUT THUMB IMAGES POOL (Dynamic)
// ═══════════════════════════════════════════════════════════════

const _THUMB_KEY = 'gympro_thumb_images';

// פול ברירת מחדל: 4 מקוריים + 23 מ-Stitch (סה"כ 27 תמונות)
const _DEFAULT_THUMB_IMAGES = [
    // ─ Original 4 (שומרים על backward-compat לאימונים קיימים idx 0-3)
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDPSxh1Qp2Y5rxaLi08qIoxzaIx6HpnkwADfs82U2MI3agKuOjH_XRe5Vnp7pqR4Evd6BCSN1YkzqsxR4nnHQV3PZwXgQBEG_TyPYZEVebs398qOzoE9HyVD9xCKKii15_Ya8EU-4niTMPvWEGd17IChBxNv5TeezOQrnFbB_qBA8FsoYuDaChgY7MmnJAOs3vwuKM5ySQBfgIlp5NV2gVPSFbGP2INnRMlHUVFFxfaoVATE1e2R11U7pj0h4STs62FftxEV7gt2Xg',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBwpwBQq26LPlJcG2munCoBisisoadBReR8si5Z3g8S8lgmt5MJsUAeruNNad5eSE-JXi3yNGLEB-XLQ2mxm37YOgoyTDqNDCZtyg8BDuCDn-NSFZH2QyLABBEJW3ARgaInuP7jYs2Np2XGnBF5J6r6OMiR2gC-eX5F4j8bXE918AgnmlFilEgkJ9Lfyt8gQQDnZrLbp6riQvKpLe7jqelf992kdMjvLWTH9T2LKVlnkeBdAwiOwgoTTm96q43GOcbMi8KYcTaLnuQ',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAlG4VTMGj-yqP5zRTFuwFw6VSP1Ao5jnbOz_Cg_AgxHAKaVb9AA14BrBcIPh1H6c9tTnYBVtY-qbhANOxe3Teq9dSp-VpaB1TsxWhPvcSTuNdfcCeac0ho4GM3sM_HacxT4LlJJdseMqdhuDm_DKXtDA1QpjmIUvLxaAZsw7tZo9-w3rmyC0e5kbgnjJl8aWUC_X7cyRZqHodEkgUz_IxKmYdK2Upnymtn0SoD_DaxTQyviYI2hDE8aB-m91sa2BrMhqNH-t6pFO0',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuADW-EekFmHAshTc9g9FzdlSJN11cRf8HfTvE1EjCGrITu9AVPwQhlAWveW4i-bOdZG31UQquBdZhCoLyJCtNNYFCM9AW8Jamwe7OtLPH-2VaXWPmiyB3eWNkffyC_Sv5E8VQZU0qrhmPzaQJJelLiqBR3YJWoUtRpnxDPFSVxpDVopfJ1kOA2SkdTySC1CtWQIQSlA1cmBqYiB14pog08rXWbnoI5Ov-8JtVQyVirf58d95jdVQuoY_pkDv5LqglM8aErroJvyG7w',
    // ─ Stitch images (indices 4-26)
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAa2Vwn-Npmz7NbshC3rMQgWM9M8CCxNPnGZUOU7OaPxSEMVGDhY-mKDoY-XteHYA_U6uVxkCW5juqWCmeSvcPwoHgr7eclbp-g2ffzK89c5m2Q6puxaJIOxzmGQ7QHIQQiiZijukgx1yOWGKFGRancwpMZs-yOdMjFJXmu3x-GTbxt5SYtDVS89s_5-BJDg3bGw4-wfWZZrND_NaEoPDcoNCCOifu-YqJuTAXGVAard2mlRrPHLd4nRnsyQxOhycpiBA49Cvt5yDY',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDIOVKREkSUtF2gGWLXkGb-udu6k7Vd88eBGwQddiYNYxpY_P5fNhml-xqMsN4qoJi_vtN8xDeLzrT7J_VWSFH86FyJrE-ivdDpk0xT7fzfEjKLkIgI1krkRQSdWomSS-LyvpxRXXwx03m8HfV-KK7u7KYnG0_KMDYaAFctqwxUHv3kPdB7_rz3xzUzT2ahNq2ZwxaT3BUfVPuvvI9ak5r0-ml3SfsX6KZZRlCcSi4Ab3Htp4doK7B5thxvV2O5Tx5BepYgvnRce_E',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAGo718VbTjHroR2f1ZBGGlTAzxlKArnnTAwwVQWooTDXT1OmHbOM4Ph_3MW9fkgdPsrnNXMGqTnIE4V2ouYMZ0MtOtJKH5GOX7xZFGAIGSRfxCf_HRk-v4hDrW18zAVyDhh9i5ydIHS4spQxq163MuDZb5ENQNEEirSYwRKLBHnXb4r-QuCSjUqpm9UsL_zBExoL8rtnXCIBygBYvbZHXj77vkM9qG95bkT9Okv2nqOtbO4qaKU4YMUHFub0Ap2T-NMGPVMx-UM14',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAq_XJA8-2WusMzNGWr00DbVseG324nv8SBq2d4WVdA78rws8uIFaAc5jk3Ayv-SezIXc_U0pEhBsw5bmKgElbLlS85ThQ1rEEK4DQ9oIMHfe_4FnSz1r3kNGlQ6Ic9shZQj1bt3zT334kCzpdS9SwY-zCjr-opxcozdGnRsp0oRoVKRKzecKVP6uvYwJlyQBnvhBXQdkepO_BUP3qKnfXAPa8Cy3qKFEigyJNsoihIQ3XVihgN880qXMT1V0kF-iA7OqBc3wcPCts',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDM747zT5KYoaK7X8hc-K-WYOjQXbbgWXh_0AcMIq4ja35br_K3VLl0dCSx-U68SYUq_k5e04IvERh-vlKv-k2AAANYGRdP6b51aHTDC1tMNLZ5srr2OUjYz5Q-Ntm75y29b67xEwWvocbUijNsm4kvskmBoa3U0umSm3TxpsF145TI6B2S2RwbHj0gPyhcC7ci-6qdVORG9a8JXyomx-FbSaHn3-QEWvshpgb_ah09clrwL88QDQS-eWCeztMEGN9j29hnLX35ddw',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC2anRJGMnLHZPMMsfqKBf630347PZ3rWsm8rSg-LRhI4oA4Df_ne_03owqU5d_6b8pokyZBFrN6-5KIYUM7_bOFguohUBhm7AWhDg-1bpjZGgqyxhU1p2Z82kPb8ZwKorRZ4g9-EMnpUNi1v51elx50e7TZp74rAnL3yb6jHleAtvBGySoEEFyO9dVDP0JhuQJnoIY9xx2uOhXtz09RwiTkiwXXd-zNSeBkH-L0FeACvCBbl0cCi57Qtkzw8rMECn-Y0gudIjSeJc',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCOI-xJHBRcxLOuOVtVrd05C2ziUleF7r3se3JDtjsOM8IIalAQtIRw9w2KLEOv7fB3zr2bxUbW-urEdaO4enryruujATKVSSXT1RerLy2ZmNDMaIQm2NibKnDL0LwrGBjAvgCfXGy-oJZios3IL_2PkYZOH5yav5VqNwQkiXyCbHrZHcjyk3qlJ2L8yzC2TLxN8ReMXDsDk6w_xfnWh7UxjS5qVYcJVobrXNidjhtN8pghO5tPDTuBmiQzaGH9CWUsJkwkt2QYvOg',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC4XCydYwMQOp05WaIpiiYppV3u48kYoIDe4IqLvMIzuuXL02qPXqjQoSJnaHYBVttOV-sz4WqJ6RLX9FQOx9TVZds2w2JoNA5GEZZHNncC8QDLfPR4cKW1v88rQr91hzjNR-UQKcrnnmhPXXXy4WMfa4TlghuaCr6hVvxKUtgeZdbFYkNnQDDbGJjzJBLg0iDHPBDDqPEKOIR41q2D3VhcrgJuAltOGnEvq8tq0S1EzuPo-Zm1xYhV6TVSAzj1hRqrLqPi-dm9UDQ',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC8iUL6txoNh0QsNfAzhd2KZQBRvogSsBoytkXXnG6jhmlXKgYmu7zAIiD7HTOyRKx08ugFFVnTWGNZiUCaPvuhuBAa9IB7LLcxWDTZlvrulRQ1_6fLB5w__gMKZVlgEB6ZSfb_uCbKI7RF0Wr4NdWb3bEbSgHpyVqYwnr9HCCbkVMyk5MSYcsnT4NGzY8ztwjVXsWVl9ciTgp-_w3ej4e31RXSKGpB403uV_GZiMYzdcBeaN4dVdDpVsb72JJgefKFhAVklNKYgH0',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCSIPPWtn_87T7_CpErLG5Vm3j1MY00-ZTBNRR-RU2YMbGCttYrltMNclNMT3dOahPvsDnJsLw_IwT4K3iJ9CCktrAuGTalJE6vYEdoVRd3mgY53MkZkOjiS9QR7VjRcwBvte80Ui99CIbPB1ENxe6Btx9tKOcwmXTGtslMc24NVzW0G-WM6y3UVarTBD8i2qqxRBvapfSD79vcOqpvQ8maqp4V7gjBxjk8JHs4drT7pZWxHSz9Rqm4KDvEkxQkgpjULcHgLE7F0kQ',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuA0o81sTiRXnfupd2FsjC_a9EDBcq68iXB5KcBqg6C64M2qSvk8yfXjXUdo_UIFuFp1F220Mt4zMcXBIhvyLin8KRnMEoJ83OFTG5OXPvis_0ASyjdDq_BEznMdi71sCUpK1YSqgNRu2TQwVut4AeeZ2nwOO_f94MlZqnFQBESvrC1jfM23NjQ6UToejhXn0PZUoj9J8Iyquk99hYWqFIcdzd5zx88_jh0TLyYN0zJ3SINojwTBGHEroWm0Kn9J5lP_8tAQXR0Mt5c',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBtks_kWrjWZ7Spa9vGucazeEyVn3C37vG8QDqk3ipeMsbHOZglThN03ko_wsT-bGsVpxFYEjebM-2aVTSqMIJDx1KbsDO-fpPB6pGpyvdpN5npsQS4FTEXmIM2u09My5c3MRYr7vAnH5Qi8JjGVxySJk-B-zppfot4IKHFqq8-kgJcuhOxj0D3FGMmIQ6R-15VeimyIz02SZqTZB-Dd8u5IdC4xLjDnfV1dFhiCMwCan7fGBuhvfPUlSwQTyOnidhWeJgLpjmCqX4',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCuNXRceTHgXIbIXhggS0B_SbT_FT-UQ5Ghl089FpKPzJfccxYlCYFsVRG-DrZlWPUzh7OqLUpjGASZQRntrZOrxQE6jjP0B0XsDNt79UlYF2yX8PzZTByFtSk20nknKYjjjuYfkzJhAkQFTSoDnzB4pfMFnJJkdhJH64XmFe0N25HEV7pAHv85BrypxuGsMbdSrsywigLWbbAv7-nkD7gL9FFHHD6q0TuhXCYWHlXd0Hm4TNc37pG-z4Ttoe4Mk_LeW5q4g1i8Jtc',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDFOSDYMQLnw6yiCBJv23T6gSOEhQrNHIhJbAy-i1eNxTzCfw-v7Gq6rOqEkO9vlBmTG8r_wCpTVqMfohDcwkF7FmdzLT5c1PZ1M3SOrNQxhXaaLRGi0mjn6-hAtTo3SqP-bYn9mJn4YQHSAJ0XXEG4gaTNR5b_MgqqAkF6yOkyo3CVgoVUsJREdDq2kyQYZ92XuwWJQM1QJjNqpyuAgmzNnePru8SqKgVKxtNunI78RBl7tXsr_h2hlS9JYRGRppJ-ADJIcPN0K0A',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuARiIzg1WS_1CwfRg31BTKxDqfKOxASEKbPOGXoRnb5pUvpV0eRfC40OzZ6Q_Bj4-9ibcike8IGZpw5YYYDiqe_iPPiQrX_rt0m-Jm6irJ-BcycOBFYrPD1Qz7lCtkOufHZUiqWX4YbN_yFDvRJpfwenkXf1zFT8M_5Taz8HEGZ5RBdAeWitd6xp3dk85dNm5KB4H_PjnByp4V87qRcCxq0vNBBO2KgNtVQV0kwgjW2dL0V6sEjJId-4yz1o2JQmGy0Wkj1F5gCxdk',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCDBIZuIgvQsDcryR-WZZreqgTDlW-MZHFTxjYRnRuTwfD-ctEeUmE-NfFHQCx-FxBJQ2Byec4BsIK8A3IY8p_iIVMHuEHgv2WwAIfO8ZMO2Hrr8rf1xRM7BRoWoJtV50KT8wBbCXVV1gBiHogst6gOHVnOgwyWgA-MDs2BMmvIffZR_vf5DdqDUGrBP-O5ltYp1WiAQ-zYtQAHcU5PFJ6lQUTMKnsTyHrBicRKtJ4JDXOSj5GA3YZMK_KRmeEuh2IhSUHUo6y_dk0',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBFbQoTAMcCruoGveHFpAg5j30M_SFyQZ4vzUaKFkTSoFlmhiR3KdVhN3eAXcUOQlOujHF4tnx1Hs23QrpZHDVo1PdtvLQuzO2jvTBlIj0Q5ZgLWNwMFTF7nOkE4huS3Sd5U7kpXz_VhPoUqG4TyC0jjr8WjgJqe1DDnFnuC7fxRi5TarYe7RPD7ZPHsF_2USEfRQ2YqZTGT_RKC8k0mmb2FxvLvtVy2-EUc_PrKHygyIQ8L4Sdk3tQ3i8ul4eQDJgqhmrzEYg9Tk4',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuB76Oi27IIyHj3pWHE7gw_dvNn7Xb2zs5kO-r23F-1zGVOH-W1jbixJ099udoeWbWrVXLgiatLMTf5wI6a9MwrejbDUlDK7kKutYivqryejNDtGR_yfsWoINtA1MD5T7tFOO5dmLzNrWQdVdMLkyLLRLb3ramCiBox7nabxAZuvkhxM_WYE_aVZzgwb1qRid6pwWj3Mn4mpvwevTr4C4us4fB67trPzEgtZsxy1c4pJTBIMb-fq9_n0WiVbo1YbERYiRD1ZM8e1DfE',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCiIp6u8V3sSDUHCNxM3FyC5sLIt2fjfB6r7gyVoknfx3In7V4Xdi-X_30RvmwdmCiY4Vi7dYHXoaKY4QbEZEW7UR_eAVbNYxxlSqs-a39lpzAQY3G_Rgk23mqKdLdMuuLnjgHb2Ekjl82cGQV5q3UBtWiurdJl079T-t4ZDkBMM1d1Axu5SeUlQZeS3S7DO9TsxySl6QWYJyX6nJtbpI_vbiDkFXkVR9gH_Qn5a30pSywASFTwupEBOCRBWe__ufn36mxK-YkWZbI',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAWW1qfq-oJVni8Qpbr-EHm4UfKC59S9Z3ihNK9ItaGj77gCakS71b5JvFhpdelBqel1IKehkY8yRZt3tP2xY4U-Xd5g4wRihiCaUT5ISB5c7DXzSViNbcIEAFP9Oib4uRdZ_eIkbSM9ST4MC30uT5XtFeWB2h__RnOuTI7qXyoUVduLxJQoBF5d2u12Z1sdfdDbYlBzk_SBRQW_DV4UQUOh02ASaIWDub7kfipgf59O8S-mbNsjHFNk54A-xMnBjixJC0joc7TI9A',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC4r8IN9J-GF99Am6AawTje7f_CBz36gbOEx457NlsxTGeA25gtEk8oMmSk915PHAsxwxRrFPsS7h9u-Uz9a9glmoEIA23wlsGeIrs4EjCjfy5UDhIqTGb73kRPlW2Doy35Ef03Na-ZksKA9ciswT4hIO-EBN09VXNzjhmV7o7lLQgMqmiW8vjCw6KC57fLpZvlM4moUPE5WdEPgrJrGNsFmqVUqB8pRJniYxxuJHm21iuRCjuKbD5z2iKFuuOnA4YTzjcOpFQpukQ',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDhxsNzcX6PHSVPEJfd8bhR_evFhI-1NbKN5qGfbe9UAnmb9D0dxtkf2FNsXgPs0ue4JGbqUv4JwWxhbS1HwzFEkfNXV0XX0Ezo4Qq3y3cyMMKDZLc3EXjavC0XczgQVYvRqp5Kur58bR1tn76NSYV8NdLZvO1YsUxr-dITliNqUgsYFA0zPMYP6F3MaB-Eb_qXp6DeqdXeK9Ape8STbp-UzymO9d_cNnIU9E0HS7iHVzjtRI2_rfdrEjeH7_MZ_kbfX8WDd8CdKU4',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCB8U2R1gCvstPsFk8KLrHu2uzjYIFOxoUaiLoNeJEoq_aMXS7ZDEHZ_SsgAgHmakdIhGuYSNUVWreUUQ4SaXD_b0lZEBd22o231tGEnuVgMZZFXrgsa4jrAkTi5kTzNTPuNcCNQiYww8YD9xrmZ6Wbot1cp2gm0xZZ3Z7lwe-XViJJs-ryrwH4EuqVayLBuiTa2UxJ4m4JIlbytpIpJF0Fd3zHLQbP3drUO6MPLUrUQl1Z6Pk3xrAbmj3z9Ob4qumKFQYBT0oR0eQ',
];

// מחליף את `const WORKOUT_THUMB_IMAGES = [...]` — מוטבלי + persistent
let WORKOUT_THUMB_IMAGES = (() => {
    try {
        const s = localStorage.getItem(_THUMB_KEY);
        if (s) { const p = JSON.parse(s); if (Array.isArray(p) && p.length) return p; }
    } catch(e) {}
    return [..._DEFAULT_THUMB_IMAGES];
})();

function _saveThumbPool() {
    try { localStorage.setItem(_THUMB_KEY, JSON.stringify(WORKOUT_THUMB_IMAGES)); } catch(e) {}
}

// ─── DYNAMIC MAIN MENU ─────────────────────────────────────────────────────

function renderWorkoutMenu() {
    const container = document.getElementById('workout-menu-container');
    if (!container) return;

    container.innerHTML = "";
    const title = document.getElementById('workout-week-title');
    const weekLabel = document.getElementById('workout-week-label');

    const thumbImages = WORKOUT_THUMB_IMAGES;

    // חץ קדימה — מתאים ל-RTL (כמו arrow_back_ios_new במוקאפ)
    const chevronSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;

    function buildCard(key, count, fallbackIdx, isFirst, badge) {
        const btn = document.createElement('button');
        btn.className = 'obsidian-menu-card' + (isFirst ? ' card-featured' : '');
        // שימוש ב-_thumbIdx ששמור ב-meta — אם קיים. fallbackIdx רק כברירת מחדל ראשונית
        if (!state.workoutMeta[key]) state.workoutMeta[key] = {};
        if (typeof state.workoutMeta[key]._thumbIdx !== 'number') {
            state.workoutMeta[key]._thumbIdx = fallbackIdx;
        }
        const thumbIndex = state.workoutMeta[key]._thumbIdx;
        const imgUrl = thumbImages[thumbIndex % thumbImages.length];
        const thumbStyle = `background-image:url('${imgUrl}');background-size:cover;background-position:center;`;
        const badgeHtml = badge || '';
        const safeKey = key.replace(/'/g, "\\'");
        btn.innerHTML = `
            <div class="obsidian-card-content">
                <div class="obsidian-card-info">
                    <div>
                        <h3 class="obsidian-card-title">${key}</h3>
                        ${badgeHtml}
                        <p class="obsidian-card-count">${count} תרגילים</p>
                    </div>
                    <button class="btn-obsidian-pill" onclick="event.stopPropagation(); openWorkoutPlanSheet('${safeKey}')">
                        <span>תרגילים</span>
                        ${chevronSvg}
                    </button>
                </div>
                <div class="obsidian-card-thumb" style="${thumbStyle}"></div>
            </div>`;
        btn.onclick = () => selectWorkout(key);
        return btn;
    }

    if (state.week === 'deload') {
        if (weekLabel) weekLabel.innerText = 'Deload';
        title.innerText = "שבוע דילואוד";
        const keys = Object.keys(state.workouts);
        const deloadWorkouts = keys.filter(k => {
            const meta = state.workoutMeta[k];
            return meta && meta.availableInDeload === true;
        });

        if (deloadWorkouts.length === 0) {
            container.innerHTML = `<p class="text-center color-dim">בחר Freestyle או סמן תוכנית כדילואוד בעורך</p>`;
        } else {
            deloadWorkouts.forEach((key, idx) => {
                const meta = state.workoutMeta[key];
                let count = 0;
                const w = state.workouts[key];
                if (Array.isArray(w)) {
                    w.forEach(item => { if (item.type === 'cluster') count += item.exercises.length; else count++; });
                }
                const badge = (meta && meta.isDeloadOnly)
                    ? `<span class="text-xs color-type-free" style="border:1px solid var(--type-free); border-radius:6px; padding:2px 6px; font-size:0.7em;">Deload Only</span>`
                    : '';
                container.appendChild(buildCard(key, count, idx, idx === 0, badge));
            });
        }
    } else {
        if (weekLabel) weekLabel.innerText = `Week ${state.week}`;
        title.innerText = `שבוע ${state.week} - בחר אימון`;
        let idx = 0;
        Object.keys(state.workouts).forEach(key => {
            const meta = state.workoutMeta[key];
            if (meta && meta.isDeloadOnly) return;
            if (meta && meta.isHidden) return;

            let count = 0;
            const w = state.workouts[key];
            if (Array.isArray(w)) {
                w.forEach(item => { if (item.type === 'cluster') count += item.exercises.length; else count++; });
            }
            container.appendChild(buildCard(key, count, idx, idx === 0, ''));
            idx++;
        });
    }

}

// ─── WORKOUT MANAGER ───────────────────────────────────────────────────────

let _managerTab = 'active';

function openWorkoutManager() { _managerTab = 'active'; renderManagerList(); navigate('ui-workout-manager'); }

function _setManagerTab(tab) {
    _managerTab = tab;
    renderManagerList();
}

function renderManagerList() {
    const list = document.getElementById('manager-list');
    if (!list) return;
    list.innerHTML = "";

    const keys = Object.keys(state.workouts);

    // Segmented control
    const seg = document.createElement('div');
    seg.className = 'segmented-control mb-md';
    seg.innerHTML = `
        <button class="segment-btn ${_managerTab === 'active' ? 'active' : ''}" onclick="_setManagerTab('active')">פעילים</button>
        <button class="segment-btn ${_managerTab === 'hidden' ? 'active' : ''}" onclick="_setManagerTab('hidden')">מוסתרים</button>
    `;
    list.appendChild(seg);

    const activeKeys = keys.filter(k => { const m = state.workoutMeta[k]; return !m || !m.isHidden; });
    const hiddenKeys = keys.filter(k => { const m = state.workoutMeta[k]; return m && m.isHidden; });
    const displayKeys = _managerTab === 'active' ? activeKeys : hiddenKeys;

    if (displayKeys.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'text-center color-dim';
        empty.textContent = _managerTab === 'active' ? 'אין תוכניות פעילות' : 'אין תוכניות מוסתרות';
        list.appendChild(empty);
    } else {
        displayKeys.forEach(key => {
            const wo = state.workouts[key];
            const el = document.createElement('div');
            el.className = 'manager-item';
            if (_managerTab === 'hidden') el.style.opacity = '0.55';
            el.onclick = () => editWorkout(key);
            let count = 0;
            if (Array.isArray(wo)) {
                wo.forEach(item => { if (item.type === 'cluster') count += item.exercises.length; else count++; });
            }
            el.innerHTML = `
                <div class="manager-info"><h3>${key}</h3><p>${count} תרגילים</p></div>
                <div class="manager-actions">
                    <button class="btn-text-action" onclick="event.stopPropagation(); duplicateWorkout('${key}')">שכפל</button>
                    <button class="btn-text-action delete" onclick="event.stopPropagation(); deleteWorkout('${key}')">מחק</button>
                </div>
            `;
            list.appendChild(el);
        });
    }

    // Show/hide create button — only in active tab
    const createBtn = document.getElementById('btn-create-workout');
    if (createBtn) createBtn.style.display = _managerTab === 'active' ? '' : 'none';
}

function deleteWorkout(key) {
    showConfirm(`האם למחוק את תוכנית ${key}?`, () => {
        delete state.workouts[key];
        if (state.workoutMeta[key]) delete state.workoutMeta[key];
        StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);
        StorageManager.saveData(StorageManager.KEY_META, state.workoutMeta);
        renderManagerList(); renderWorkoutMenu();
        autoSaveConfigToCloud();
    });
}

function duplicateWorkout(key) {
    const newName = key + " Copy";
    if (state.workouts[newName]) { showAlert("שם התוכנית כבר קיים"); return; }
    const copy = JSON.parse(JSON.stringify(state.workouts[key]));
    if (state.workoutMeta[key]) {
        state.workoutMeta[newName] = JSON.parse(JSON.stringify(state.workoutMeta[key]));
        StorageManager.saveData(StorageManager.KEY_META, state.workoutMeta);
    }
    state.workouts[newName] = copy;
    StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);
    renderManagerList(); renderWorkoutMenu();
    autoSaveConfigToCloud();
}

function createNewWorkout() {
    managerState.originalName = ''; managerState.currentName = 'New Plan';
    managerState.exercises = [];
    openEditorUI();
}

function editWorkout(key) {
    managerState.originalName = key; managerState.currentName = key;
    managerState.exercises = JSON.parse(JSON.stringify(state.workouts[key]));
    openEditorUI();
}

function openEditorUI() {
    document.getElementById('editor-workout-name').value = managerState.currentName;
    const meta = state.workoutMeta[managerState.currentName] || {};
    document.getElementById('editor-deload-check').checked = !!meta.availableInDeload;
    document.getElementById('editor-deload-only-check').checked = !!meta.isDeloadOnly;
    document.getElementById('editor-hidden-check').checked = !!meta.isHidden;
    _renderColorSwatches(meta.color || '');
    _renderThumbPicker(typeof meta._thumbIdx === 'number' ? meta._thumbIdx : 0);
    renderEditorList();
    navigate('ui-workout-editor');
}

// ─── EXERCISE MANAGER (CREATE / EDIT) ──────────────────────────────────────

function openExerciseCreator() {
    document.getElementById('ex-config-title').innerText = "יצירת תרגיל חדש";
    document.getElementById('conf-ex-name').value = "";
    document.getElementById('conf-ex-muscle').value = "חזה";
    document.getElementById('conf-ex-base').value = "";
    document.getElementById('conf-ex-step').value = "2.5";
    document.getElementById('conf-ex-min').value = "";
    document.getElementById('conf-ex-max').value = "";
    document.getElementById('conf-ex-uni').checked = false;

    document.getElementById('btn-delete-ex').classList.add('d-none');

    document.getElementById('ex-config-modal').dataset.mode = "create";
    document.getElementById('ex-config-modal').style.display = 'flex';
}

function openExerciseEditor(exName) {
    const ex = state.exercises.find(e => e.name === exName);
    if (!ex) return;

    document.getElementById('ex-config-title').innerText = "עריכת תרגיל";
    document.getElementById('conf-ex-name').value = ex.name;
    document.getElementById('conf-ex-name').disabled = false;

    let muscleVal = ex.muscles[0] || "חזה";
    if (ex.muscles.includes('biceps')) muscleVal = "יד קדמית";
    else if (ex.muscles.includes('triceps')) muscleVal = "יד אחורית";
    else if (ex.muscles.includes('בטן')) muscleVal = "בטן";

    document.getElementById('conf-ex-muscle').value = muscleVal;
    document.getElementById('conf-ex-step').value = ex.step || "2.5";
    document.getElementById('conf-ex-uni').checked = !!ex.isUnilateral;

    if (ex.manualRange) {
        document.getElementById('conf-ex-base').value = ex.manualRange.base || "";
        document.getElementById('conf-ex-min').value = ex.manualRange.min || "";
        document.getElementById('conf-ex-max').value = ex.manualRange.max || "";
    } else {
        document.getElementById('conf-ex-base').value = "";
        document.getElementById('conf-ex-min').value = ex.minW || "";
        document.getElementById('conf-ex-max').value = ex.maxW || "";
    }

    document.getElementById('btn-delete-ex').classList.remove('d-none');
    document.getElementById('ex-config-modal').dataset.mode = "edit";
    document.getElementById('ex-config-modal').dataset.target = exName;
    document.getElementById('ex-config-modal').style.display = 'flex';
}

// ─── EXERCISE DATABASE MANAGER ─────────────────────────────────────────────

function openExerciseDatabase() {
    managerState.dbFilter = 'all';
    document.querySelectorAll('#ui-exercise-db .chip').forEach(c => c.classList.remove('active'));
    const firstChip = document.querySelector('#ui-exercise-db .chip');
    if (firstChip) firstChip.classList.add('active');

    navigate('ui-exercise-db');
    document.getElementById('db-search').value = '';
    renderExerciseDatabase();
}

function setDbFilter(filter, btn) {
    managerState.dbFilter = filter;
    document.querySelectorAll('#ui-exercise-db .chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderExerciseDatabase();
}

function renderExerciseDatabase() {
    const list = document.getElementById('db-list');
    list.innerHTML = "";
    const searchVal = document.getElementById('db-search').value.toLowerCase();

    const sorted = [...state.exercises].sort((a, b) => a.name.localeCompare(b.name));

    const filtered = sorted.filter(ex => {
        if (managerState.dbFilter !== 'all') {
            const muscleMap = { 'יד קדמית': 'biceps', 'יד אחורית': 'triceps', 'ידיים': 'ידיים' };
            if (managerState.dbFilter === 'ידיים') {
                if (!ex.muscles.includes('ידיים') && !ex.muscles.includes('biceps') && !ex.muscles.includes('triceps')) return false;
            } else {
                if (!ex.muscles.includes(managerState.dbFilter) && !ex.muscles.includes(muscleMap[managerState.dbFilter])) return false;
            }
        }
        return ex.name.toLowerCase().includes(searchVal);
    });

    if (filtered.length === 0) {
        list.innerHTML = `<p class="text-center color-dim mt-md">לא נמצאו תרגילים</p>`;
        return;
    }

    filtered.forEach(ex => {
        const row = document.createElement('div');
        row.className = "selector-item-row";
        row.onclick = () => openExerciseEditor(ex.name);

        row.innerHTML = `
            <div class="selector-item-info">
                <div class="font-semi text-base">${ex.name}</div>
                <div class="text-sm color-dim mt-xs">${ex.muscles.join(', ')}</div>
            </div>
            <div class="selector-item-actions">
                <div class="chevron"></div>
            </div>
        `;
        list.appendChild(row);
    });
}

function saveExerciseConfig() {
    const mode = document.getElementById('ex-config-modal').dataset.mode;
    const name = document.getElementById('conf-ex-name').value.trim();
    const muscleSelect = document.getElementById('conf-ex-muscle').value;
    const step = parseFloat(document.getElementById('conf-ex-step').value);
    const base = parseFloat(document.getElementById('conf-ex-base').value);
    const min = parseFloat(document.getElementById('conf-ex-min').value);
    const max = parseFloat(document.getElementById('conf-ex-max').value);
    const isUni = document.getElementById('conf-ex-uni').checked;

    if (!name) { showAlert("נא להזין שם תרגיל"); return; }

    let musclesArr = [muscleSelect];
    if (muscleSelect === 'יד קדמית') musclesArr = ['ידיים', 'biceps'];
    if (muscleSelect === 'יד אחורית') musclesArr = ['ידיים', 'triceps'];

    if (mode === 'create') {
        if (state.exercises.find(e => e.name === name)) { showAlert("שם תרגיל כבר קיים"); return; }

        const newEx = {
            name,
            muscles: musclesArr,
            step,
            isUnilateral: isUni,
            manualRange: {
                base: isNaN(base) ? undefined : base,
                min: isNaN(min) ? undefined : min,
                max: isNaN(max) ? undefined : max
            }
        };
        state.exercises.push(newEx);
        StorageManager.saveData(StorageManager.KEY_DB_EXERCISES, state.exercises);
        closeExConfigModal();
        showAlert("התרגיל נוצר בהצלחה!");

    } else {
        const targetName = document.getElementById('ex-config-modal').dataset.target;
        const exIndex = state.exercises.findIndex(e => e.name === targetName);
        if (exIndex === -1) return;

        if (targetName !== name) {
            if (state.exercises.find(e => e.name === name)) { showAlert("שם זה כבר קיים במערכת"); return; }

            showConfirm(
                `שינית את שם התרגיל מ-"${targetName}" ל-"${name}".\nהשינוי יעדכן את כל התוכניות הקיימות.\nהאם להמשיך?`,
                () => {
                    for (let key in state.workouts) {
                        const wo = state.workouts[key];
                        if (Array.isArray(wo)) {
                            wo.forEach(item => {
                                if (item.type === 'cluster') {
                                    item.exercises.forEach(sub => { if (sub.name === targetName) sub.name = name; });
                                } else {
                                    if (item.name === targetName) item.name = name;
                                }
                            });
                        }
                    }
                    StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);

                    const lastW = StorageManager.getLastWeight(targetName);
                    if (lastW) StorageManager.saveWeight(name, lastW);

                    state.exercises[exIndex].name = name;
                    _finishSaveExConfig(exIndex, musclesArr, step, isUni, base, min, max);
                }
            );
            return;
        }

        _finishSaveExConfig(exIndex, musclesArr, step, isUni, base, min, max);
    }
}

function _finishSaveExConfig(exIndex, musclesArr, step, isUni, base, min, max) {
    state.exercises[exIndex].muscles = musclesArr;
    state.exercises[exIndex].step = step;
    state.exercises[exIndex].isUnilateral = isUni;

    if (!state.exercises[exIndex].manualRange) state.exercises[exIndex].manualRange = {};
    state.exercises[exIndex].manualRange.base = isNaN(base) ? undefined : base;
    state.exercises[exIndex].manualRange.min = isNaN(min) ? undefined : min;
    state.exercises[exIndex].manualRange.max = isNaN(max) ? undefined : max;

    if (!isNaN(min)) delete state.exercises[exIndex].minW;
    if (!isNaN(max)) delete state.exercises[exIndex].maxW;

    StorageManager.saveData(StorageManager.KEY_DB_EXERCISES, state.exercises);
    autoSaveConfigToCloud();
    closeExConfigModal();

    if (document.getElementById('ui-exercise-db').classList.contains('active')) {
        renderExerciseDatabase();
    } else if (document.getElementById('ui-exercise-selector').classList.contains('active')) {
        prepareSelector();
    }
}

function deleteExercise() {
    const targetName = document.getElementById('ex-config-modal').dataset.target;
    if (!targetName) return;

    let usedIn = [];
    for (let key in state.workouts) {
        const wo = state.workouts[key];
        if (Array.isArray(wo)) {
            let found = false;
            wo.forEach(item => {
                if (item.type === 'cluster') {
                    if (item.exercises.some(sub => sub.name === targetName)) found = true;
                } else {
                    if (item.name === targetName) found = true;
                }
            });
            if (found) usedIn.push(key);
        }
    }

    if (usedIn.length > 0) {
        showAlert(`לא ניתן למחוק את התרגיל!\nהוא נמצא בשימוש בתוכניות הבאות:\n- ${usedIn.join('\n- ')}\n\nיש להסיר אותו מהתוכניות קודם.`);
        return;
    }

    showConfirm(`האם למחוק את התרגיל "${targetName}" לצמיתות?`, () => {
        const exIndex = state.exercises.findIndex(e => e.name === targetName);
        if (exIndex > -1) {
            state.exercises.splice(exIndex, 1);
            StorageManager.saveData(StorageManager.KEY_DB_EXERCISES, state.exercises);
            autoSaveConfigToCloud();
            showAlert("התרגיל נמחק.", () => {
                closeExConfigModal();
                renderExerciseDatabase();
            });
        }
    });
}

function closeExConfigModal() {
    document.getElementById('ex-config-modal').style.display = 'none';
    document.getElementById('conf-ex-name').disabled = false;
}

// ─── WORKOUT EDITOR & CLUSTER SUPPORT ─────────────────────────────────────

function renderEditorList() {
    const list = document.getElementById('editor-list');
    list.innerHTML = '';

    managerState.exercises.forEach((item, idx) => {
        if (item.type === 'cluster') {
            renderClusterItem(item, idx, list);
        } else {
            renderRegularItem(item, idx, list);
        }
    });

    // עדכון מונה הבלוקים
    const countEl = document.getElementById('editor-block-count');
    if (countEl) {
        const n = managerState.exercises.length;
        countEl.textContent = n > 0 ? `${n} TOTAL BLOCK${n !== 1 ? 'S' : ''}` : '';
    }

    StorageManager.saveSessionState();
}

function renderRegularItem(item, idx, list) {
    const card = document.createElement('div');
    card.className = 'weditor-block';

    const blockNum = String(idx + 1).padStart(2, '0');
    const isMain = !!item.isMain;

    // SVG icons (inline, no dependency)
    const svgUp    = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>`;
    const svgDown  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    const svgTrash = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
    const svgInfo  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    const setsHtml = !isMain ? `
        <div>
            <div class="weditor-ctrl-label">TARGET SETS</div>
            <div class="weditor-sets-ctrl">
                <button class="weditor-sets-btn" onclick="changeSetCount(${idx}, -1)">−</button>
                <span class="weditor-sets-val">${item.sets}</span>
                <button class="weditor-sets-btn plus" onclick="changeSetCount(${idx}, 1)">+</button>
            </div>
        </div>` : `<div></div>`;

    card.innerHTML = `
        <div class="weditor-block-head">
            <div style="flex:1;min-width:0;">
                <span class="weditor-block-num">BLOCK ${blockNum}</span>
                <div class="weditor-block-name">${item.name}</div>
            </div>
            <div class="weditor-block-btns">
                <button class="weditor-icon-btn" onclick="moveExInEditor(${idx}, -1)" aria-label="הזז למעלה">${svgUp}</button>
                <button class="weditor-icon-btn" onclick="moveExInEditor(${idx}, 1)"  aria-label="הזז למטה">${svgDown}</button>
                <button class="weditor-icon-btn danger" onclick="removeExFromEditor(${idx})" aria-label="מחק">${svgTrash}</button>
            </div>
        </div>
        <div class="weditor-block-footer">
            ${setsHtml}
            <div class="weditor-tags-col">
                <div class="weditor-ctrl-label">TAGS</div>
                <button class="weditor-main-tag${isMain ? ' active' : ''}" onclick="toggleMainStatus(${idx})">MAIN LIFT</button>
            </div>
        </div>
        <div class="weditor-block-settings-hint" onclick="openRestTimerModal(${idx})">
            ${svgInfo}
            Settings & Rest Timer
        </div>`;
    list.appendChild(card);
}

function renderClusterItem(cluster, idx, list) {
    const card = document.createElement('div');
    card.className = 'weditor-cluster';

    const svgUp    = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>`;
    const svgDown  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    const svgTrash = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M9 6V4h6v2"/></svg>`;
    const svgLayers = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;
    const svgPlus   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    const svgX      = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

    let exHtml = '';
    cluster.exercises.forEach((ex, exIdx) => {
        const lbl = String.fromCharCode(65 + exIdx); // A, B, C...
        const repsLabel = ex.targetReps ? `${ex.targetReps} REPS` : '— REPS';
        exHtml += `
        <div class="weditor-cluster-ex" onclick="openRestTimerModal(${idx}, ${exIdx})">
            <span class="weditor-cluster-ex-lbl">${lbl}${exIdx + 1}</span>
            <span class="weditor-cluster-ex-name">${ex.name}</span>
            <span class="weditor-cluster-ex-reps">${repsLabel}</span>
            <button class="weditor-cluster-ex-del"
                onclick="event.stopPropagation(); removeExFromCluster(${idx}, ${exIdx})"
                aria-label="הסר">${svgX}</button>
        </div>`;
    });

    card.innerHTML = `
        <div class="weditor-cluster-head">
            <div class="weditor-cluster-title-row">
                ${svgLayers}
                <span class="weditor-cluster-title-txt">CLUSTER BLOCK</span>
                <div class="weditor-cluster-btns">
                    <button class="weditor-icon-btn" onclick="moveExInEditor(${idx}, -1)">${svgUp}</button>
                    <button class="weditor-icon-btn" onclick="moveExInEditor(${idx}, 1)">${svgDown}</button>
                    <button class="weditor-icon-btn danger" onclick="removeExFromEditor(${idx})">${svgTrash}</button>
                </div>
            </div>
            <div class="weditor-cluster-ctrls">
                <div class="weditor-cluster-ctrl-item">
                    <div class="weditor-ctrl-label">ROUNDS</div>
                    <div class="weditor-sets-ctrl">
                        <button class="weditor-sets-btn" onclick="changeClusterRounds(${idx}, -1)">−</button>
                        <span class="weditor-sets-val">${cluster.rounds}</span>
                        <button class="weditor-sets-btn plus" onclick="changeClusterRounds(${idx}, 1)">+</button>
                    </div>
                </div>
                <div class="weditor-cluster-ctrl-item">
                    <div class="weditor-ctrl-label">REST</div>
                    <div class="weditor-sets-ctrl">
                        <button class="weditor-sets-btn" onclick="changeClusterRest(${idx}, -30)">−</button>
                        <span class="weditor-sets-val" style="font-size:1rem;">${cluster.clusterRest}s</span>
                        <button class="weditor-sets-btn plus" onclick="changeClusterRest(${idx}, 30)">+</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="weditor-cluster-exercises">${exHtml}</div>
        <button class="weditor-cluster-add-ex" onclick="openExerciseSelectorForCluster(${idx})">
            ${svgPlus} INSERT NESTED EXERCISE
        </button>`;
    list.appendChild(card);
}

function toggleMainStatus(idx) { managerState.exercises[idx].isMain = !managerState.exercises[idx].isMain; renderEditorList(); }
function changeSetCount(idx, delta) { let c = managerState.exercises[idx].sets + delta; if (c < 1) c = 1; managerState.exercises[idx].sets = c; renderEditorList(); }
function moveExInEditor(idx, dir) { if (idx + dir < 0 || idx + dir >= managerState.exercises.length) return; const t = managerState.exercises[idx]; managerState.exercises[idx] = managerState.exercises[idx + dir]; managerState.exercises[idx + dir] = t; renderEditorList(); }
function removeExFromEditor(idx) { managerState.exercises.splice(idx, 1); renderEditorList(); }
function changeClusterRounds(idx, delta) { let v = managerState.exercises[idx].rounds + delta; if (v < 1) v = 1; managerState.exercises[idx].rounds = v; renderEditorList(); }
function changeClusterRest(idx, delta) { let v = managerState.exercises[idx].clusterRest + delta; if (v < 0) v = 0; managerState.exercises[idx].clusterRest = v; renderEditorList(); }
function addClusterToEditor() { managerState.exercises.push({ type: 'cluster', rounds: 3, clusterRest: 120, exercises: [] }); renderEditorList(); }
function removeExFromCluster(clusterIdx, exIdx) { managerState.exercises[clusterIdx].exercises.splice(exIdx, 1); renderEditorList(); }

function saveWorkoutChanges() {
    const newName = document.getElementById('editor-workout-name').value.trim();
    if (!newName) { showAlert("נא להזין שם לתוכנית"); return; }
    if (managerState.exercises.length === 0) { showAlert("התוכנית ריקה!"); return; }

    if (newName !== managerState.originalName) {
        if (state.workouts[newName]) { showAlert("שם תוכנית זה כבר קיים"); return; }
        if (managerState.originalName) {
            delete state.workouts[managerState.originalName];
            delete state.workoutMeta[managerState.originalName];
        }
    }

    if (!state.workoutMeta[newName]) state.workoutMeta[newName] = {};

    const isDeloadOnly = document.getElementById('editor-deload-only-check').checked;
    state.workoutMeta[newName].isDeloadOnly = isDeloadOnly;

    if (isDeloadOnly) {
        state.workoutMeta[newName].availableInDeload = true;
    } else {
        state.workoutMeta[newName].availableInDeload = document.getElementById('editor-deload-check').checked;
    }

    state.workoutMeta[newName].isHidden = document.getElementById('editor-hidden-check').checked;
    state.workoutMeta[newName].color = _selectedEditorColor || '';
    state.workoutMeta[newName]._thumbIdx = _selectedThumbIdx >= 0 ? _selectedThumbIdx : (state.workoutMeta[newName]._thumbIdx || 0);

    StorageManager.saveData(StorageManager.KEY_META, state.workoutMeta);

    state.workouts[newName] = managerState.exercises;
    StorageManager.saveData(StorageManager.KEY_DB_WORKOUTS, state.workouts);
    autoSaveConfigToCloud();

    haptic('success');

    state.historyStack.pop();
    navigate('ui-workout-manager');
    renderManagerList();
    renderWorkoutMenu();
}

// ─── REST TIMER & DEFAULTS EDITING ─────────────────────────────────────────

function openRestTimerModal(idx, internalIdx = null) {
    let ex;
    if (internalIdx !== null) {
        ex = managerState.exercises[idx].exercises[internalIdx];
        managerState.editingTimerEx = { idx, internalIdx };
    } else {
        ex = managerState.exercises[idx];
        managerState.editingTimerEx = { idx, internalIdx: null };
    }

    document.getElementById('ex-settings-title').innerText = ex.name;
    document.getElementById('target-weight-input').value = ex.targetWeight || "";
    document.getElementById('target-reps-input').value = ex.targetReps || "";
    document.getElementById('target-rir-input').value = ex.targetRIR || "";

    const time = ex.restTime || (ex.isMain ? 120 : 90);
    document.getElementById('rest-time-display').innerText = time + "s";

    document.getElementById('exercise-settings-modal').style.display = 'flex';
}

function changeRestTime(delta) {
    const display = document.getElementById('rest-time-display');
    let current = parseInt(display.innerText.replace('s', ''));
    current += delta;
    if (current < 0) current = 0;
    display.innerText = current + "s";
}

function saveExerciseSettings() {
    const val = parseInt(document.getElementById('rest-time-display').innerText.replace('s', ''));
    const tWeight = parseFloat(document.getElementById('target-weight-input').value);
    const tReps = parseInt(document.getElementById('target-reps-input').value);
    const tRIR = parseFloat(document.getElementById('target-rir-input').value);

    const { idx, internalIdx } = managerState.editingTimerEx;
    const targetEx = internalIdx !== null
        ? managerState.exercises[idx].exercises[internalIdx]
        : managerState.exercises[idx];

    targetEx.restTime = val;
    targetEx.targetWeight = isNaN(tWeight) ? undefined : tWeight;
    targetEx.targetReps = isNaN(tReps) ? undefined : tReps;
    targetEx.targetRIR = isNaN(tRIR) ? undefined : tRIR;

    closeExerciseSettings();
    renderEditorList();
}

function closeExerciseSettings() { document.getElementById('exercise-settings-modal').style.display = 'none'; managerState.editingTimerEx = null; }

// ─── SMART EXERCISE SELECTOR ───────────────────────────────────────────────

function openExerciseSelector() { managerState.activeClusterRef = null; prepareSelector(); }
function openExerciseSelectorForCluster(clusterIdx) { managerState.activeClusterRef = clusterIdx; prepareSelector(); }

function prepareSelector() {
    document.getElementById('selector-search').value = "";
    managerState.selectorFilter = 'all';
    updateSelectorChips();
    renderSelectorList();
    navigate('ui-exercise-selector');
}

function setSelectorFilter(filter, btn) { managerState.selectorFilter = filter; updateSelectorChips(); renderSelectorList(); }

function updateSelectorChips() {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    const btns = document.querySelectorAll('#ui-exercise-selector .chip');
    btns.forEach(b => { if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${managerState.selectorFilter}'`)) b.classList.add('active'); });
}

function filterSelector() { renderSelectorList(); }

function renderSelectorList() {
    const list = document.getElementById('selector-list'); list.innerHTML = "";
    const searchVal = document.getElementById('selector-search').value.toLowerCase();

    const filtered = state.exercises.filter(ex => {
        const matchesFilter = managerState.selectorFilter === 'all' || ex.muscles.includes(managerState.selectorFilter);
        const matchesSearch = ex.name.toLowerCase().includes(searchVal);
        return matchesFilter && matchesSearch;
    });

    filtered.forEach(ex => {
        const row = document.createElement('div');
        row.className = "selector-item-row";

        row.innerHTML = `
            <div class="selector-item-info" onclick="selectExerciseFromList('${ex.name.replace(/'/g, "\\'")}')">${ex.name}</div>
            <div class="selector-item-actions">
                <button class="btn-text-edit" onclick="openExerciseEditor('${ex.name.replace(/'/g, "\\'")}')">ערוך</button>
            </div>
        `;
        list.appendChild(row);
    });
}

function selectExerciseFromList(exName) {
    const newExObj = { name: exName, isMain: false, sets: 3, restTime: 90 };
    if (managerState.activeClusterRef !== null) {
        newExObj.restTime = 30;
        managerState.exercises[managerState.activeClusterRef].exercises.push(newExObj);
    } else {
        managerState.exercises.push(newExObj);
    }

    state.historyStack.pop();
    navigate('ui-workout-editor');
    renderEditorList();
}

// ─── IMPORT / EXPORT ───────────────────────────────────────────────────────

function exportData() {
    const data = StorageManager.getAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gympro_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function triggerImport() { document.getElementById('import-file').click(); }

function importData(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            StorageManager.restoreData(data);
            showAlert("הנתונים יובאו בהצלחה!", () => { window.location.reload(); });
        } catch (err) {
            showAlert("שגיאה בקריאת הקובץ");
        }
    };
    reader.readAsText(file);
    input.value = "";
}

function triggerConfigImport() { document.getElementById('import-config-file').click(); }

function processConfigImport(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            StorageManager.importConfiguration(data);
        } catch (err) {
            showAlert("שגיאה בקריאת קובץ התבנית");
        }
    };
    reader.readAsText(file);
    input.value = "";
}

// ─── ARCHIVE HELPERS ───────────────────────────────────────────────────────

function openArchiveFromDrawer(timestamp) {
    closeDayDrawer();
    setTimeout(() => {
        const archive = StorageManager.getArchive();
        const idx = archive.findIndex(a => a.timestamp === timestamp);
        if (idx !== -1) openArchiveDetail(idx);
    }, 350);
}

// ─── WORKOUT COLOR SELECTION ───────────────────────────────────────────────

const WORKOUT_COLORS = [
    { hex: '#0A84FF', name: 'Cobalt'   },
    { hex: '#30D158', name: 'Emerald'  },
    { hex: '#FF9F0A', name: 'Amber'    },
    { hex: '#FF6B6B', name: 'Coral'    },
    { hex: '#5AC8FA', name: 'Teal'     },
    { hex: '#5E5CE6', name: 'Indigo'   },
    { hex: '#98989D', name: 'Graphite' }
];

let _selectedEditorColor = '';

function selectEditorColor(hex, el) {
    _selectedEditorColor = hex;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    if (el) el.classList.add('active');
}

function _renderColorSwatches(currentColor) {
    _selectedEditorColor = currentColor || '';
    const container = document.getElementById('editor-color-swatches');
    if (!container) return;
    container.innerHTML = '';
    WORKOUT_COLORS.forEach(c => {
        const sw = document.createElement('div');
        sw.className = 'color-swatch' + (c.hex === _selectedEditorColor ? ' active' : '');
        sw.style.background = c.hex;
        sw.title = c.name;
        sw.onclick = () => selectEditorColor(c.hex, sw);
        container.appendChild(sw);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE CONFIG UI  (v14.11.0)
// ─────────────────────────────────────────────────────────────────────────────

function openFirebaseConfigModal() {
    const cfg = FirebaseManager.getFirebaseConfig() || {};
    const ta = document.getElementById('fb-config-paste');
    if (ta) {
        if (cfg.apiKey) {
            // הצג את הקונפיג הקיים בפורמט קריא
            ta.value = `const firebaseConfig = {\n  apiKey: "${cfg.apiKey}",\n  authDomain: "${cfg.authDomain || ''}",\n  projectId: "${cfg.projectId || ''}",\n  storageBucket: "${cfg.storageBucket || ''}",\n  messagingSenderId: "${cfg.messagingSenderId || ''}",\n  appId: "${cfg.appId || ''}"\n};`;
        } else {
            ta.value = '';
        }
    }
    const btnClear = document.getElementById('btn-clear-firebase');
    if (btnClear) btnClear.style.display = FirebaseManager.isConfigured() ? '' : 'none';
    document.getElementById('firebase-config-modal').style.display = 'flex';
}

function closeFirebaseConfigModal() {
    document.getElementById('firebase-config-modal').style.display = 'none';
}

function saveFirebaseConfig() {
    const raw = (document.getElementById('fb-config-paste').value || '').trim();
    if (!raw) { showAlert('יש להדביק את בלוק ה-firebaseConfig.'); return; }

    // חילוץ תוכן ה-object מתוך הטקסט — תומך בפורמט const firebaseConfig = {...} וגם ב-{...} ישיר
    let jsonStr = raw;
    // הסר const firebaseConfig = ו-; בסוף אם קיימים
    jsonStr = jsonStr.replace(/^[\s\S]*?=\s*/, '').replace(/;?\s*$/, '').trim();
    // המר מ-JS object literal ל-JSON: הוסף מרכאות למפתחות
    jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    // המר single quotes ל-double quotes בערכים
    jsonStr = jsonStr.replace(/:\s*'([^']*)'/g, ': "$1"');
    // הסר פסיק אחרון לפני סגירת סוגריים
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

    let cfg;
    try {
        cfg = JSON.parse(jsonStr);
    } catch(e) {
        showAlert('פורמט לא תקין. ודא שהדבקת את הבלוק המלא מ-Firebase Console.');
        return;
    }

    if (!cfg.apiKey || !cfg.projectId) {
        showAlert('חסרים apiKey או projectId. ודא שהדבקת את הבלוק המלא.');
        return;
    }

    FirebaseManager.saveFirebaseConfig(cfg);
    FirebaseManager._initialized = false;
    FirebaseManager._db = null;
    closeFirebaseConfigModal();
    updateFirebaseStatus();
    showAlert('חיבור Firebase נשמר! בצע רענון לאפליקציה כדי להפעיל.');
}

function confirmClearFirebase() {
    showConfirm('לנתק את Firebase ולמחוק את פרטי החיבור?', () => {
        FirebaseManager.clearFirebaseConfig();
        closeFirebaseConfigModal();
        updateFirebaseStatus();
    });
}

function updateFirebaseStatus() {
    const el = document.getElementById('firebase-status');
    if (!el) return;
    if (FirebaseManager.isConfigured()) {
        const cfg = FirebaseManager.getFirebaseConfig();
        el.innerHTML = `<span style="color:var(--type-b);font-weight:700;">&#9679; מחובר</span> <span style="color:var(--text-dim);font-size:0.85em;">${cfg.projectId}</span>`;
    } else {
        el.innerHTML = '<span style="color:var(--text-dim);">&#9679; לא מוגדר</span>';
    }
}

// ─── גיבוי ידני (מקומי + ענן) ────────────────────────────────────────────────

function manualBackupArchive() {
    // גיבוי מקומי
    const data = StorageManager.getAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gympro_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    // גיבוי ענן
    if (FirebaseManager.isConfigured()) {
        FirebaseManager.saveArchiveToCloud().then(ok => {
            showAlert(ok ? 'גיבוי הורד + הועלה לענן!' : 'גיבוי הורד. שגיאה בשמירה לענן.');
        });
    } else {
        showAlert('גיבוי הורד מקומית! (Firebase לא מוגדר)');
    }
}

function manualBackupConfig() {
    // גיבוי מקומי (קונפיג)
    StorageManager.exportConfiguration();
    // גיבוי ענן
    if (FirebaseManager.isConfigured()) {
        FirebaseManager.saveConfigToCloud().then(ok => {
            showAlert(ok ? 'קונפיג הורד + הועלה לענן!' : 'קונפיג הורד. שגיאה בשמירה לענן.');
        });
    } else {
        showAlert('קונפיג הורד מקומית! (Firebase לא מוגדר)');
    }
}

function saveWorkoutManagerToCloud() {
    if (!FirebaseManager.isConfigured()) {
        showAlert('Firebase לא מוגדר. הגדר חיבור בהגדרות.');
        return;
    }
    FirebaseManager.saveConfigToCloud().then(ok => {
        showAlert(ok ? 'הקונפיגורציה נשמרה בענן!' : 'שגיאה בשמירה לענן. בדוק חיבור.');
    });
}

// ─── בדיקת עדכון גרסה ──────────────────────────────────────────────────────

async function checkForUpdate() {
    try {
        // cache: 'no-store' → עוקף גם SW cache וגם HTTP cache לחלוטין
        const res = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('network error');
        const data = await res.json();
        const serverVersion = data.version || '';

        // אם _gymproVersion עדיין לא נטען — קרא גם אותו ישירות מה-SW cache
        if (!window._gymproVersion) {
            const cached = await fetch('./version.json');
            const cachedData = await cached.json().catch(() => ({}));
            window._gymproVersion = cachedData.version || '';
        }
        const currentVersion = window._gymproVersion || '';

        if (serverVersion && currentVersion && serverVersion !== currentVersion) {
            showConfirm(
                `עדכון זמין! (${currentVersion} → ${serverVersion}). לנקות cache ולרענן?`,
                async () => {
                    if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(k => caches.delete(k)));
                    }
                    window.location.reload(true);
                }
            );
        } else {
            showAlert('האפליקציה מעודכנת (v' + (serverVersion || currentVersion) + ')');
        }
    } catch(e) {
        showAlert('לא ניתן לבדוק עדכונים. בדוק חיבור לאינטרנט.');
    }
}

// קריאה ראשונית לסטטוס Firebase כשה-DOM מוכן
document.addEventListener('DOMContentLoaded', () => {
    updateFirebaseStatus();
});
