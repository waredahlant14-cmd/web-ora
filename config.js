/* =========================================================
   config.js — إعدادات WeB Ora POS
   القيم تُقرأ من localStorage بعد إعداد أول مرة
   ========================================================= */
window.APP_CONFIG = (function () {
  var stored = {};
  try { stored = JSON.parse(localStorage.getItem("pos_config") || "{}"); } catch (e) {}
  return {
    SUPABASE_URL:       stored.SUPABASE_URL       || "https://cppjvbkhufgaajxbgapm.supabase.co",
    SUPABASE_ANON_KEY:  stored.SUPABASE_ANON_KEY  || "sb_publishable_W69j-Y8srhqjLcqn-ckoNw_qvUMa0ry",
    BRAND_NAME:         stored.BRAND_NAME          || "WeB Ora",
    DEFAULT_ADMIN_USER: stored.DEFAULT_ADMIN_USER  || "",
    DEFAULT_ADMIN_PASS: stored.DEFAULT_ADMIN_PASS  || "",
    APP_VERSION:        "5.2.5",
    DESKTOP_MODE: false,
  };
})();
