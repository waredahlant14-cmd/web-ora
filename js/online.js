/* =========================================================
   js/online.js — مراقبة الاتصال (إشعارات منبثقة فقط — لا شريط)
   v5.1: تم استبدال الشريط العلوي بإشعارات toast فقط
   ========================================================= */
(function () {
  var _lastOnline = navigator.onLine;
  var _lastPending = 0;

  function pendingCount() {
    try { if (typeof getPendingCount === "function") return getPendingCount(); } catch(e){}
    return 0;
  }

  function notify(msg, type, dur) {
    if (typeof ntfToast === "function") ntfToast(msg, type, dur || 3000);
    else if (typeof toast === "function") toast(msg, type);
  }

  function check() {
    /* إزالة أي شريط قديم إن وُجد */
    var oldBar = document.getElementById("net-bar");
    if (oldBar) oldBar.remove();
    document.body && document.body.classList && document.body.classList.remove("net-bar-visible");

    var online = navigator.onLine;
    var pend   = pendingCount();

    if (online !== _lastOnline) {
      if (!online) notify("انقطع الاتصال — يتم الحفظ محلياً", "offline", 4000);
      else         notify("عاد الاتصال — جارٍ المزامنة", "online", 3000);
      _lastOnline = online;
    }
    /* إشعار عند تراكم عمليات معلقة جديدة (كل 10 إضافات) */
    if (pend > 0 && Math.floor(pend/10) > Math.floor(_lastPending/10)) {
      notify("⏳ " + pend + " عملية بانتظار المزامنة", "warning", 2500);
    }
    _lastPending = pend;
  }

  window.addEventListener("online",  check);
  window.addEventListener("offline", check);
  document.addEventListener("DOMContentLoaded", function(){ setTimeout(check, 100); });
  setInterval(check, 6000);

  /* للتوافق مع الكود القديم */
  window.refreshNetBar = check;
})();
