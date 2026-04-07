/**
 * GYMPRO ELITE - EDITOR & MANAGER LOGIC
 * Version: 14.8.0
 * שדרוג 1: Toggle פעילים/מוסתרים בניהול תוכניות.
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

// ─── WORKOUT THUMB IMAGES (global — shared with archive-logic.js) ──────────
const ASSET_GALLERY_DATA = [
    // ── 11 התמונות המקוריות ──
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDPSxh1Qp2Y5rxaLi08qIoxzaIx6HpnkwADfs82U2MI3agKuOjH_XRe5Vnp7pqR4Evd6BCSN1YkzqsxR4nnHQV3PZwXgQBEG_TyPYZEVebs398qOzoE9HyVD9xCKKii15_Ya8EU-4niTMPvWEGd17IChBxNv5TeezOQrnFbB_qBA8FsoYuDaChgY7MmnJAOs3vwuKM5ySQBfgIlp5NV2gVPSFbGP2INnRMlHUVFFxfaoVATE1e2R11U7pj0h4STs62FftxEV7gt2Xg', label: 'Classic 1' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBwpwBQq26LPlJcG2munCoBisisoadBReR8si5Z3g8S8lgmt5MJsUAeruNNad5eSE-JXi3yNGLEB-XLQ2mxm37YOgoyTDqNDCZtyg8BDuCDn-NSFZH2QyLABBEJW3ARgaInuP7jYs2Np2XGnBF5J6r6OMiR2gC-eX5F4j8bXE918AgnmlFilEgkJ9Lfyt8gQQDnZrLbp6riQvKpLe7jqelf992kdMjvLWTH9T2LKVlnkeBdAwiOwgoTTm96q43GOcbMi8KYcTaLnuQ', label: 'Classic 2' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAlG4VTMGj-yqP5zRTFuwFw6VSP1Ao5jnbOz_Cg_AgxHAKaVb9AA14BrBcIPh1H6c9tTnYBVtY-qbhANOxe3Teq9dSp-VpaB1TsxWhPvcSTuNdfcCeac0ho4GM3sM_HacxT4LlJJdseMqdhuDm_DKXtDA1QpjmIUvLxaAZsw7tZo9-w3rmyC0e5kbgnjJl8aWUC_X7cyRZqHodEkgUz_IxKmYdK2Upnymtn0SoD_DaxTQyviYI2hDE8aB-m91sa2BrMhqNH-t6pFO0', label: 'Classic 3' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuADW-EekFmHAshTc9g9FzdlSJN11cRf8HfTvE1EjCGrITu9AVPwQhlAWveW4i-bOdZG31UQquBdZhCoLyJCtNNYFCM9AW8Jamwe7OtLPH-2VaXWPmiyB3eWNkffyC_Sv5E8VQZU0qrhmPzaQJJelLiqBR3YJWoUtRpnxDPFSVxpDVopfJ1kOA2SkdTySC1CtWQIQSlA1cmBqYiB14pog08rXWbnoI5Ov-8JtVQyVirf58d95jdVQuoY_pkDv5LqglM8aErroJvyG7w', label: 'Classic 4' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAa2Vwn-Npmz7NbshC3rMQgWM9M8CCxNPnGZUOU7OaPxSEMVGDhY-mKDoY-XteHYA_U6uVxkCW5juqWCmeSvcPwoHgr7eclbp-g2ffzK89c5m2Q6puxaJIOxzmGQ7QHIQQiiZijukgx1yOWGKFGRancwpMZs-yOdMjFJXmu3x-GTbxt5SYtDVS89s_5-BJDg3bGw4-wfWZZrND_NaEoPDcoNCCOifu-YqJuTAXGVAard2mlRrPHLd4nRnsyQxOhycpiBA49Cvt5yDY', label: 'Classic 5' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDIOVKREkSUtF2gGWLXkGb-udu6k7Vd88eBGwQddiYNYxpY_P5fNhml-xqMsN4qoJi_vtN8xDeLzrT7J_VWSFH86FyJrE-ivdDpk0xT7fzfEjKLkIgI1krkRQSdWomSS-LyvpxRXXwx03m8HfV-KK7u7KYnG0_KMDYaAFctqwxUHv3kPdB7_rz3xzUzT2ahNq2ZwxaT3BUfVPuvvI9ak5r0-ml3SfsX6KZZRlCcSi4Ab3Htp4doK7B5thxvV2O5Tx5BepYgvnRce_E', label: 'Classic 6' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAGo718VbTjHroR2f1ZBGGlTAzxlKArnnTAwwVQWooTDXT1OmHbOM4Ph_3MW9fkgdPsrnNXMGqTnIE4V2ouYMZ0MtOtJKH5GOX7xZFGAIGSRfxCf_HRk-v4hDrW18zAVyDhh9i5ydIHS4spQxq163MuDZb5ENQNEEirSYwRKLBHnXb4r-QuCSjUqpm9UsL_zBExoL8rtnXCIBygBYvbZHXj77vkM9qG95bkT9Okv2nqOtbO4qaKU4YMUHFub0Ap2T-NMGPVMx-UM14', label: 'Classic 7' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAq_XJA8-2WusMzNGWr00DbVseG324nv8SBq2d4WVdA78rws8uIFaAc5jk3Ayv-SezIXc_U0pEhBsw5bmKgElbLlS85ThQ1rEEK4DQ9oIMHfe_4FnSz1r3kNGlQ6Ic9shZQj1bt3zT334kCzpdS9SwY-zCjr-opxcozdGnRsp0oRoVKRKzecKVP6uvYwJlyQBnvhBXQdkepO_BUP3qKnfXAPa8Cy3qKFEigyJNsoihIQ3XVihgN880qXMT1V0kF-iA7OqBc3wcPCts', label: 'Classic 8' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDM747zT5KYoaK7X8hc-K-WYOjQXbbgWXh_0AcMIq4ja35br_K3VLl0dCSx-U68SYUq_k5e04IvERh-vlKv-k2AAANYGRdP6b51aHTDC1tMNLZ5srr2OUfYz5Q-Ntm75y29b67xEwWvocbUijNsm4kvskmBoa3U0umSm3TxpsF145TI6B2S2RwbHj0gPyhcC7ci-6qdVORG9a8JXyomx-FbSaHn3-QEWvshpgb_ah09clrwL88QDQS-eWCeztMEGN9j29hnLX35ddw', label: 'Classic 9' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC2anRJGMnLHZPMMsfqKBf630347PZ3rWsm8rSg-LRhI4oA4Df_ne_03owqU5d_6b8pokyZBFrN6-5KIYUM7_bOFguohUBhm7AWhDg-1bpjZGgqyxhU1p2Z82kPb8ZwKorRZ4g9-EMnpUNi1v51elx50e7TZp74rAnL3yb6jHleAtvBGySoEEFyO9dVDP0JhuQJnoIY9xx2uOhXtz09RwiTkiwXXd-zNSeBkH-L0FeACvCBbl0cCi57Qtkzw8rMECn-Y0gudIjSeJc', label: 'Classic 10' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCOI-xJHBRcxLOuOVtVrd05C2ziUleF7r3se3JDtjsOM8IIalAQtIRw9w2KLEOv7fB3zr2bxUbW-urEdaO4enryruujATKVSSXT1RerLy2ZmNDMaIQm2NibKnDL0LwrGBjAvgCfXGy-oJZios3IL_2PkYZOH5yav5VqNwQkiXyCbHrZHcjyk3qlJ2L8yzC2TLxN8ReMXDsDk6w_xfnWh7UxjS5qVYcJVobrXNidjhtN8pghO5tPDTuBmiQzaGH9CWUsJkwkt2QYvOg', label: 'Classic 11' },
    // ── 20 התמונות החדשות ──
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBcbRJO60scsOAEKo4tA7-88RZ0N6KkvjUT-5hjBoefANTuXMGOu3UbGJACz7jpYAx8TAo84oh-KpunZJg9MHfRfDOV2RqWOLHKqt-Qa5vEQqlzO3POLCtc3c3eIm7ATc4rpfDkGqcH656EznXtVFnpMyM79GtrDUr8Ra5zTHx7BzaqI-RmDRRMD4Xbj8bkZ3ayjrizK90V41pkL1ZXtZ4ynJlQVw5w2GGniDT0i1zlC8NY9tOIlX_3k8PIBe-GlFsuHEEj-V8GAAE', label: 'Heavy Pull Up' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB93zjuiXHkI_mrocnaslOCVExSI22wOchU8NeUr7-KENsQK8pZdU1MJ1Zj4240hn28Nrpw-YJsIQXA0XAI4a9VTmrcZVYil6abaaaCLsYh-_VZHahvluKLX-bWPQtI2tQ1hIXElQb5jkc4O-ocqCucyVC4jzklMfDJXM9bH5YMk0I-72Fu7JntGNELIylRlt9jOF3Kv8Nep3WWuL8NG-dLTHCmISuSW3RnX45VNDzdCOoSGd7zEg9in09kq9voKFu5wOzUsyp3mPI', label: 'Lateral Isolation' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAwAlF_k4R0fviQ3e1QZTA6D4s9lwBa-imHLWaNR0Nbdo6HdyRuNT4YnSg8_0JKZE24IK2RSTVOX2B0CLTZn4Ape7nnKh5S2l9dwtN81oIXr97UjsYlZ_YZ7V_5MUlYn48rEOduPN2TtCdDIy_vAS1S1URdRe_k4L9Xr6T-On1bBZxbam7yNCdmkGduWoc-e-ViaURoocuw7pg5i3_BCuYQnH4HywXQEnDg4Plcccz0sSIc90lwgFlTOHu5bfxFSUUzhTGXE4PeafU', label: 'Back Squat' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDQ8vkE4n2g21u5-_foTTnFfqENwM05m67Ge1UvecdNJSFpti4T-O81MZdz4eyVaWl_ESE_kOp5LG7H6N3pDND6Dzv85i8K35Br-EVfJ20Bs_Vaa1hL86yWbuQaXtlzCHK2ZZOl6fpMzacUI-SCuM3GDG6EsLH8VpmmHvurKaJcGzO0Qg1phSxLKayonOOMB5-mIsPYgJwAh1edUPg-WN1PEq-NkjV7BYGUWGW6i7qlVRtzy6KZbuI76E1GsB1_AMDYLTa0F9E59Ug', label: 'T-Bar Row' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuADJ0gNAawlx3MlfKOCf6qrq1rSl98whjiSBDbVsFOx61BuR50ByEEB4nntmREEFm0nHBWz2pszgs7ukZdphPI4UmecnrNAnl2AmFceWyF9zXc7CEVLD9kojlHODVo8E7CpoOt_fWLyZtJHIxFDYkQ03KVuAUAGoyHrILpy8MqWt-Ddy5dexgIV6nuWrsBia8QoCZS3QQd4yGTf1qemHbnqC2V5nwwn8e4qHby4xaWg1g2sfG3e-5qdhTau6tv6dExYLYb4Oh0DZHE', label: 'Bench Press' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCgKSrw_SVYkj50-SVg1_-2GcE9PKqMyn5hiDqIZFWgtzgUzDot2f5CMi31U5kC2RvYUvZgPr4aHEENaZtSKJOJxk6Sm0grF53MIGUeCQ69uBluoUQ4QPUTqzhFx8LssITDXg42YsYB-jkwOK4Ol_5rcKOahirYa2bOAKFPWr44aJJPH5R7Ll0dkqqESBg3hPDhjsmB2hgLbBep9MKxZe53rQjD11QjemK916gm_hKGEdgmVglHL5rwObc3Xuflefljv4DPqG3u7Ko', label: 'Triceps' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCxywzpMANW9pYeD4TEhavM9UvOSz80qnm3p9K0IEGrnPoXpgyiIx3v2hlISDEatf2v8Lxdtg8Vfn2cVrLl9ORohHMwntjYVLQNzWbPMZErSg2A1qyd-R6I-k5YBQNxaLDcOHUfxAxvBxaUVOGCOTkSG6_AvIDCI9qk07GsXLbK2Gy8n2BYf30v2wGM-yL8hSzDqg6lnYHYjPMEiTDzYvbZqQT7zrwXuC2rrvZSRXF_Fi7tV7zGDq-dmV2HRliGU7PUx7gHHUr2f60', label: 'Dragon Flag' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBuLjmwwF-WPRjEtYctI3HgrYmv5KInTwxcCMV4v4BRFYexCJMsV1PbJNvUGPXx4JU7wF9Ais8AXaHmXOjQlxo0yF65m2V2nwqSH0AkIgTrxUkK0oml_FIQUXOnls_UN3iWjQ8CBJDlVh6YDBDxp-AWtqoyhOdEknoxWXLMDae64N6r3HAeFhJDU611k25RIsZ_xch3s2tBDNYO4nS96L2_DTNUoF1gJyaX05tXKfYEuSuhxGFqDLFODsFkImLDPE5SGWN2gHnvGig', label: 'Military Press' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBIGvEYh4ACzyD95dsZA8_kZ1vK_Dmi8Ra35LlX3VodwDDQ5uLYPDd02uv0HkzhJU_exijH9HZ5Dyqvn7XgiVnEb7jZ2ycwPDIohVvCwW8i4llrgFYrCrADYGw4KsqCDTuYo_hY1JniEVJ0Gv8VSQGTKW9_q2TDErm8bcLVgRv2iuyuriEOa7AOo8gNj-U1abV6S8KkOFiejAuoOWGPJ1xq3lnjtMheQieTxvumfrPZHHg8htIrZrwJ_J_FUBCMM8yZ1TZTsB8hP3M', label: 'Barbell Row' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB4squvKDwdiwe65S94qW_EOCLn3bgFGkjRo2peeh8vldapEuIlavYGWIqYa6uZfK_30cLXawzfn7oF9eontYWjuqvhmeHBCcq3ycb_3lfX4OOy6CDucx0U98Pfk6swkP5eoql9o_4Q9LO6e1Z04cW3WdUdMcHOOU0NjDvdIVR-vC2DIEnyOq7L0BBk5ffOt47NuTjZXvPXElha9iiwLU79pn_teh1mYctUYOUn1nQogb2D9OwWHdRh8AWuuu4ZqxQqcZd0DDIPhJY', label: 'Weighted Dips' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB_5kCiY9N98E_aaxV8fb086hxyRODaYmrw2I6xRX3I9as0ylHOdpiVsL5ie277e0AdPWqwqkf_zaDTp1zzptUx9pQ6FaObngUbjVJk7kzgZj8rElORlGptxxTbF_l3SbN_T9_Wusm8OBR0AwJjGTKirBj0LPnxdnGxbVa3A3s53y0b0bz2Ba4V7mtuZFR6Vi4xFIVOuDcP9vLMulV0JW7gIvOwJVpwYyXj4159FUxAIOBHv9ae7Hv1BQKPEbVl8GFJwmsN5jLK1rg', label: 'Leg Press' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDx16iAHAwWpv6Drj91LbmOXJQBhGex7OsW-49596VfoGjpUFPa8fVJfYLL78j5Lt1D6pwweDXNnaJ4uJQbL30_0F3Q8lDB4jrv0H97gj39fdwAcZuvdEPdJldITVcVfgLlZfP5yMqAnnzBhieYYjN7lRRo8z5vfoq2cocsztNzotpcqHx7txYO5m5KeXDKFLWyPOkM0XjgqeKQraa9SMW7kftURbt4hFwM4h7C18LWleNJXDolw3BnmU99XWMHjogIAjplKZnP5zU', label: 'Biceps' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCghIhZo-KrhOq0UW9JouzF4VzMeEJcNAWpBMZS7cu-2v0nyrTQys7eCwyWSPxKe3vYh-VqLi8nSdmN6oHNU5-S4RcamETZwSks-Cu1Ndy8-ZohJ4HUeYIUVabiISrTXmsVhsCaBEGHPt2mEPXxJas6GbVeDck9r4puU7aq1IZO8pD83L2vQrqFGU7y7uDhjuLorGqfYPueFnw9krobbzWlQJhDaUHD082zzfzdiHz2BxXXP8fK6hrGSGPzEvoA_WguOC7Eak-FCjc', label: 'Core Tension' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCU_QVo_yBtt3546lIwzPLOJG2UP3R8AUXqFP6_oi8DgFieDe50cho7N0NmVAFOOLe0UfhPCig8yymnAyt-1DIBm8GWnmMfWpbkG24RT1vpIFfuVUeSwMSBmVhis1b6Y-OM58__KUb8WwcAIzzc4xaBaV8LidAevGT1gQ1QA4sKmmevKERuWAonGPp5oYCiiUM_OJbCeaa4-shWVfYmGkrvt9JYp5vFhAn4fKtXz1eo6qZaag3CkSSe0ywyrRKcMfXW3SFFcEEefSc', label: 'Posterior / Deadlift' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBe_mYyMdWnZijXO_u5TRHW3OMFpfF8TJJh4fiy9poJ8UTSQ4cUzC7U7s73Xvd77MLnMr0J_3jfR7lJqUCW1oQ6L4y66cTmZSpBtbkyRHi8UMqUeEGHwNYDGfmLohkY4D2obdGiCt4td1cajy3S_gTlaIPh_q709_RHLqKKxpybopaKRcVmjxdxonsX87SzLqHerhOUPemduOvySY18YfJ_75ZieOQK-I-8wmj6_UNgsIE-yzcOdU89Lq0GfPMITmEq97fUOsy8kc0', label: 'Rear Deltoid' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBNKuGbmXhl8pKWlEjUx1ievQg-uh3HEL6GQCPLi8TqjOc96R7XCEU5t6JfC9P_Oul11IBxw7hhf9_3f44C7bLn8P4Rd1N_iLeZVU2iYuDMaoedVzAuOvgwqbIqr00NR4K9t189lpiimIDcp7kBB2WMLrerTwSH1IiSqWzcThgQtCCSVcUeA_vLpMsRUh2gP21eKakRaYUgdefZ6AFcrdKRhnMtASfAouG2z-PA4R5EBywcb2nf2owaZMZPh_UMcWR4Tv3iqWLmnZw', label: 'Force Explosion' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCz9f3Q1jmz5z6o8OZUz-dE7Zdyf9JYoJEUMjaIxWDVcBez0BTrGXASbFlZSRbfz1K0bj75Th5VxiPRVPYSIadI6R0pVlzzSBnpTmffrsKiIGWPJxbKhAYJRSLENk8z9Blzb2yVElU_UyLcYVN4QZYDlSzRGuVQHAHkUvIJRZz79FGj7MKb5ogtXUngc5--4hN_KJ38fndfOFU1Htty7g-m4cUNtPZ6WvEBsvPvBI1T17vCRzo5WLNVUHNnX99vCasBb0ZCQlYvtSI', label: 'Dumbbell Lunges' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBTmzIVNLSrF-EIk29bi9FamhRkO-v1hZP_uVjYmzwg66K-oboHtx_ULebQTnJtUA1afmmbdnnovhVzrGOV3Ry-efnMQLAXeOQwLkp6B8UYUGEyFuG6qnjhf7abswPCwbzay92FgCNwRlG6VHMMMOXR4yBFazYfWRXL7m5PrK7LgnH7kMLuybpC7tQfiKX2d6WEZCPYx--4UVaV0oHsevQCQ-zwA1wnmRMzljq07Jl_uTfuwoRNDauneThUQNMK6MV-2CmZKBW2C_Q', label: 'Peak Vascularity' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcRXft5zJW50PbvCaFqMrQJ-b0kt1oZowv-v0a5oCuU1CA-KtUU1Go8JiimfHALk66isHU3A0ZNp8i__uK1Ng7pPtjtCUB4rVokm81w1l8NgEaARhWHP9o6DM-UQg3ezBBT7bqofUxYX9sw7T5tzrr0zl-qwlpAJB6X7EY3TDZU2iMzZ20_Eq19G3donrg2s3Ef0koCui--lvXdi-nkFY621ZhsrMEnHp6UeqdvV-Ri2mMqnG6whGeBcLQ0PpKuH55O30g-KPPgvA', label: 'Dumbbell Press' },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBuR1LZm_4uTPSqx4YxOXOo-NpisdAobluA6bIS-VTVfBbAcyMgK3zJxvTJqHE5bI8PQ6pHV2Lb5SEJi19jJ_l77HW4q3KThSnRu_NTbd7Qxk9q2dR_3mF4BmcgcBONSpBlLvoK2T4xzhuO_Gj-PrjDag80GECN-yrTgqJhJlmHhLiCXG5o5i8l3VvIODClXYxUofEOzeimuqevNjpV73yTYFbcyWoR9B-xw8ZDaVxXhoVcSN6gEbJvAFZ1zlrrOY_tqM5II75Kgfg', label: 'Cable Wood-Chop' }
];

const WORKOUT_THUMB_IMAGES = ASSET_GALLERY_DATA.map(asset => asset.url);
// ─── HIDDEN THUMBS MANAGEMENT ──────────────────────────────────────────────
// מאפשר למשתמש להסתיר תמונות מבוחר התמונות בעורך

const _HIDDEN_THUMBS_KEY = 'gympro_hidden_thumbs';

function _getHiddenThumbs() {
    return StorageManager.getData(_HIDDEN_THUMBS_KEY) || [];
}

function _saveHiddenThumbs(indices) {
    StorageManager.saveData(_HIDDEN_THUMBS_KEY, indices);
}

function toggleThumbHiddenUI(idx, cardEl) {
    const hidden = _getHiddenThumbs();
    const pos = hidden.indexOf(idx);
    const icon = cardEl.querySelector('.material-symbols-outlined');
    
    if (pos === -1) {
        hidden.push(idx);
        icon.textContent = 'visibility_off';
        cardEl.classList.add('hidden-asset');
    } else {
        hidden.splice(pos, 1);
        icon.textContent = 'visibility';
        cardEl.classList.remove('hidden-asset');
    }
    _saveHiddenThumbs(hidden);
}

function openAssetGallery() {
    renderAssetGallery();
    navigate('ui-asset-gallery');
}

function renderAssetGallery() {
    const grid = document.getElementById('asset-gallery-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const hidden = _getHiddenThumbs();
    
    ASSET_GALLERY_DATA.forEach((asset, idx) => {
        const isHidden = hidden.includes(idx);
        const card = document.createElement('div');
        card.className = `asset-card ${isHidden ? 'hidden-asset' : ''}`;
        
        card.innerHTML = `
            <div class="asset-card-img-wrap" onclick="toggleThumbHiddenUI(${idx}, this.parentElement)">
                <img src="${asset.url}" class="asset-card-img" alt="${asset.label}">
                <div class="asset-overlay">
                    <button class="asset-toggle-btn">
                        <span class="material-symbols-outlined">${isHidden ? 'visibility_off' : 'visibility'}</span>
                    </button>
                </div>
            </div>
            <div class="asset-card-info">
                <span class="asset-card-label">${asset.label}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

function selectEditorThumb(idx, el) {
    _selectedThumbIdx = idx;
    document.querySelectorAll('.editor-thumb-option').forEach(s => s.classList.remove('active'));
    if (el) el.classList.add('active');
}

function _renderThumbPicker(currentIdx) {
    const hiddenIndices = _getHiddenThumbs();

    // אם התמונה הנוכחית מוסתרת — עבור לראשונה הגלויה
    if (hiddenIndices.includes(currentIdx)) {
        const firstVisible = WORKOUT_THUMB_IMAGES.findIndex((_, i) => !hiddenIndices.includes(i));
        currentIdx = firstVisible >= 0 ? firstVisible : 0;
    }
    _selectedThumbIdx = (typeof currentIdx === 'number' && currentIdx >= 0) ? currentIdx : 0;

    const container = document.getElementById('editor-thumb-picker');
    if (!container) return;
    container.innerHTML = '';

    // הצג רק תמונות גלויות
    WORKOUT_THUMB_IMAGES.forEach((url, idx) => {
        if (hiddenIndices.includes(idx)) return;
        const el = document.createElement('div');
        el.className = 'editor-thumb-option' + (idx === _selectedThumbIdx ? ' active' : '');
        el.style.backgroundImage = `url('${url}')`;
        el.onclick = () => selectEditorThumb(idx, el);
        container.appendChild(el);
    });

    // כפתור "נהל תמונות" -> מנווט למסך הגלריה המלא
    const manageBtn = document.createElement('div');
    manageBtn.className = 'editor-thumb-option editor-thumb-manage-btn';
    manageBtn.title = 'נהל תמונות בגלריה';
    manageBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:1.5rem;color:rgba(255,255,255,0.4);pointer-events:none;">add_a_photo</span>`;
    manageBtn.onclick = () => openAssetGallery();
    container.appendChild(manageBtn);
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
        btn.className = 'km-manager-card';
        btn.style.width = '100%';
        btn.style.textAlign = 'start';

        if (!state.workoutMeta[key]) state.workoutMeta[key] = {};
        if (typeof state.workoutMeta[key]._thumbIdx !== 'number') {
            state.workoutMeta[key]._thumbIdx = fallbackIdx;
        }
        const thumbIndex = state.workoutMeta[key]._thumbIdx;
        const imgUrl = thumbImages[thumbIndex % thumbImages.length];
        const badgeHtml = badge || '';
        const safeKey = key.replace(/'/g, "\\'");

        btn.innerHTML = `
            <div class="km-manager-card-img" style="background-image:url('${imgUrl}')"></div>
            <div class="km-manager-card-body">
                <h3 class="km-manager-card-title">${key}</h3>
                ${badgeHtml}
                <p class="km-manager-card-count">${count} תרגילים</p>
                <div class="km-manager-card-actions">
                    <button class="km-select-card-pill" onclick="event.stopPropagation(); openWorkoutPlanSheet('${safeKey}')">
                        <span class="material-symbols-outlined" style="font-size:0.85rem;line-height:1;">format_list_bulleted</span>
                        תרגילים
                    </button>
                </div>
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

    // Segmented control — pill style, HIDDEN | ACTIVE order (כמו במוקאפ)
    const seg = document.createElement('div');
    seg.className = 'km-seg-control mb-lg';
    seg.innerHTML = `
        <button class="km-seg-btn ${_managerTab === 'hidden' ? 'active' : ''}" onclick="_setManagerTab('hidden')">מוסתרות</button>
        <button class="km-seg-btn ${_managerTab === 'active' ? 'active' : ''}" onclick="_setManagerTab('active')">פעילות</button>
    `;
    list.appendChild(seg);

    const activeKeys = keys.filter(k => { const m = state.workoutMeta[k]; return !m || !m.isHidden; });
    const hiddenKeys = keys.filter(k => { const m = state.workoutMeta[k]; return m && m.isHidden; });
    const displayKeys = _managerTab === 'active' ? activeKeys : hiddenKeys;

    if (displayKeys.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'text-center color-dim mt-lg';
        empty.textContent = _managerTab === 'active' ? 'אין תוכניות פעילות' : 'אין תוכניות מוסתרות';
        list.appendChild(empty);
    } else {
        displayKeys.forEach((key, cardIdx) => {
            const wo = state.workouts[key];
            const meta = state.workoutMeta[key] || {};
            let count = 0;
            if (Array.isArray(wo)) {
                wo.forEach(item => { if (item.type === 'cluster') count += item.exercises.length; else count++; });
            }
            const thumbIdx = (typeof meta._thumbIdx === 'number') ? meta._thumbIdx : (cardIdx % WORKOUT_THUMB_IMAGES.length);
            const imgUrl = WORKOUT_THUMB_IMAGES[thumbIdx % WORKOUT_THUMB_IMAGES.length];
            const safeKey = key.replace(/'/g, "\\'");

            const card = document.createElement('div');
            card.className = 'km-manager-card' + (_managerTab === 'hidden' ? ' km-manager-card--hidden' : '');
            card.innerHTML = `
                <div class="km-manager-card-img" style="background-image:url('${imgUrl}')"></div>
                <div class="km-manager-card-body">
                    <h2 class="km-manager-card-title">${key}</h2>
                    <p class="km-manager-card-count">${count} תרגילים</p>
                    <div class="km-manager-card-actions">
                        <button class="km-pill-btn km-pill-btn--danger" onclick="event.stopPropagation(); deleteWorkout('${safeKey}')">
                            <span class="material-symbols-outlined" style="font-size:0.85rem;line-height:1;">delete</span>
                            מחק
                        </button>
                        <button class="km-pill-btn" onclick="event.stopPropagation(); duplicateWorkout('${safeKey}')">
                            <span class="material-symbols-outlined" style="font-size:0.85rem;line-height:1;">content_copy</span>
                            שכפל
                        </button>
                    </div>
                </div>
            `;
            card.onclick = () => editWorkout(key);
            list.appendChild(card);
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
    list.innerHTML = "";

    managerState.exercises.forEach((item, idx) => {
        if (item.type === 'cluster') {
            renderClusterItem(item, idx, list);
        } else {
            renderRegularItem(item, idx, list);
        }
    });

    // עדכון מונה בלוקים בכותרת EXERCISE FLOW
    const countEl = document.getElementById('editor-block-count');
    if (countEl) countEl.textContent = `${managerState.exercises.length} בלוקים סה"כ`;

    StorageManager.saveSessionState();
}

function renderRegularItem(item, idx, list) {
    const blockNum = String(idx + 1).padStart(2, '0');
    const row = document.createElement('div');
    row.className = "km-editor-block";

    const setsHtml = !item.isMain ? `
        <div class="km-sets-row">
            <span class="km-sets-label">סטים יעד</span>
            <div class="km-stepper">
                <button class="km-stepper-btn" onclick="changeSetCount(${idx}, -1)">-</button>
                <span class="km-stepper-val">${item.sets}</span>
                <button class="km-stepper-btn" onclick="changeSetCount(${idx}, 1)">+</button>
            </div>
        </div>` : '';

    const tagHtml = item.isMain
        ? `<div class="km-tags-row"><span class="km-tag-label">תגיות</span><button class="km-tag-pill km-tag-pill--main" onclick="toggleMainStatus(${idx})">MAIN LIFT</button></div>`
        : `<div class="km-tags-row"><span class="km-tag-label">תגיות</span><button class="km-tag-pill" onclick="toggleMainStatus(${idx})">+ תגית</button></div>`;

    row.innerHTML = `
        <div class="km-block-header">
            <span class="km-block-num">בלוק ${blockNum}</span>
            <div class="km-block-header-btns">
                <button class="km-icon-btn" onclick="moveExInEditor(${idx}, -1)">
                    <span class="material-symbols-outlined">keyboard_arrow_up</span>
                </button>
                <button class="km-icon-btn" onclick="moveExInEditor(${idx}, 1)">
                    <span class="material-symbols-outlined">keyboard_arrow_down</span>
                </button>
            </div>
        </div>
        <div class="km-block-name" onclick="openRestTimerModal(${idx})">${item.name}</div>
        <div class="km-block-footer">
            <div class="km-block-footer-meta">
                ${setsHtml}
                ${tagHtml}
            </div>
            <button class="km-trash-btn" onclick="removeExFromEditor(${idx})">
                <span class="material-symbols-outlined">delete</span>
            </button>
        </div>
    `;
    list.appendChild(row);
}

function renderClusterItem(cluster, idx, list) {
    const blockNum = String(idx + 1).padStart(2, '0');
    const box = document.createElement('div');
    box.className = "km-cluster-block";

    let exRows = '';
    cluster.exercises.forEach((ex, internalIdx) => {
        const label = String.fromCharCode(65 + internalIdx); // A, B, C...
        exRows += `
        <div class="km-cluster-ex-row">
            <span class="km-cluster-ex-label">${label}${internalIdx + 1}</span>
            <span class="km-cluster-ex-name" onclick="openRestTimerModal(${idx}, ${internalIdx})">${ex.name}</span>
            <span class="km-cluster-ex-reps">${ex.sets ? ex.sets + ' חז׳' : ''}</span>
            <button class="km-icon-btn-sm" onclick="removeExFromCluster(${idx}, ${internalIdx})">
                <span class="material-symbols-outlined" style="font-size:0.95rem;">close</span>
            </button>
        </div>`;
    });

    box.innerHTML = `
        <div class="km-block-header">
            <span class="km-block-num">בלוק ${blockNum}</span>
            <div class="km-block-header-btns">
                <button class="km-icon-btn" onclick="moveExInEditor(${idx}, -1)">
                    <span class="material-symbols-outlined">keyboard_arrow_up</span>
                </button>
                <button class="km-icon-btn" onclick="moveExInEditor(${idx}, 1)">
                    <span class="material-symbols-outlined">keyboard_arrow_down</span>
                </button>
                <button class="km-trash-btn" onclick="removeExFromEditor(${idx})">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        </div>
        <div class="km-cluster-title-row">
            <span class="material-symbols-outlined" style="color:#5E5CE6;font-size:1.1rem;line-height:1;">hub</span>
            <span class="km-cluster-title">בלוק סבב</span>
            <span class="km-cluster-meta">${cluster.rounds} סבבים</span>
            <span class="km-cluster-meta">${cluster.clusterRest}ש' מנוחה</span>
        </div>
        <div class="km-cluster-ex-list">${exRows}</div>
        <div class="km-cluster-controls">
            <div class="km-ctrl-group">
                <span class="km-ctrl-label">סבבים</span>
                <div class="km-stepper">
                    <button class="km-stepper-btn" onclick="changeClusterRounds(${idx}, -1)">-</button>
                    <span class="km-stepper-val">${cluster.rounds}</span>
                    <button class="km-stepper-btn" onclick="changeClusterRounds(${idx}, 1)">+</button>
                </div>
            </div>
            <div class="km-ctrl-group">
                <span class="km-ctrl-label">מנוחה</span>
                <div class="km-stepper">
                    <button class="km-stepper-btn" onclick="changeClusterRest(${idx}, -30)">-</button>
                    <span class="km-stepper-val">${cluster.clusterRest}ש'</span>
                    <button class="km-stepper-btn" onclick="changeClusterRest(${idx}, 30)">+</button>
                </div>
            </div>
        </div>
        <button class="km-add-to-cluster-btn" onclick="openExerciseSelectorForCluster(${idx})">
            <span class="material-symbols-outlined" style="font-size:1rem;line-height:1;">add</span>
            הוסף תרגיל לסבב
        </button>
    `;
    list.appendChild(box);
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

let _selectedThumbIdx = -1;

function selectEditorThumb(idx, el) {
    _selectedThumbIdx = idx;
    document.querySelectorAll('.editor-thumb-option').forEach(s => s.classList.remove('active'));
    if (el) el.classList.add('active');
}

function _renderThumbPicker(currentIdx) {
    const hiddenIndices = _getHiddenThumbs();

    // אם התמונה הנוכחית מוסתרת — עבור לראשונה הגלויה
    if (hiddenIndices.includes(currentIdx)) {
        const firstVisible = WORKOUT_THUMB_IMAGES.findIndex((_, i) => !hiddenIndices.includes(i));
        currentIdx = firstVisible >= 0 ? firstVisible : 0;
    }
    _selectedThumbIdx = (typeof currentIdx === 'number' && currentIdx >= 0) ? currentIdx : 0;

    const container = document.getElementById('editor-thumb-picker');
    if (!container) return;
    container.innerHTML = '';

    // הצג רק תמונות גלויות
    WORKOUT_THUMB_IMAGES.forEach((url, idx) => {
        if (hiddenIndices.includes(idx)) return;
        const el = document.createElement('div');
        el.className = 'editor-thumb-option' + (idx === _selectedThumbIdx ? ' active' : '');
        el.style.backgroundImage = `url('${url}')`;
        el.onclick = () => selectEditorThumb(idx, el);
        container.appendChild(el);
    });

    // כפתור "נהל תמונות"
    const manageBtn = document.createElement('div');
    manageBtn.className = 'editor-thumb-option editor-thumb-manage-btn';
    manageBtn.title = 'נהל תמונות';
    manageBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:1.5rem;color:rgba(255,255,255,0.4);pointer-events:none;">add_a_photo</span>`;
    manageBtn.onclick = () => openThumbManageSheet();
    container.appendChild(manageBtn);
}

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
