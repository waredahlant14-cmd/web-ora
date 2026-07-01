/* =========================================================
   js/seclog.js — سجل أمني خفيف (Ring Buffer في localStorage)
   يُستخدم لتسجيل: محاولات الدخول، تغيير الإعدادات، الحذف...
   ========================================================= */
(function(){
  var KEY = "pos_sec_log";
  var MAX = 200;

  function read(){
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch(e){ return []; }
  }
  function write(arr){
    try { localStorage.setItem(KEY, JSON.stringify(arr.slice(-MAX))); } catch(e){}
  }
  function sanitize(s){
    if (s == null) return "";
    return String(s).replace(/[<>"'\\]/g, "").slice(0, 200);
  }

  window.SecLog = {
    add: function(event, details){
      var arr = read();
      arr.push({
        t: Date.now(),
        e: sanitize(event),
        d: details ? sanitize(typeof details==="string"?details:JSON.stringify(details)) : "",
        u: (function(){ try { return (window.getCurrentUser && getCurrentUser()||{}).username || "-"; } catch(_){ return "-"; }})(),
        ua: (navigator.userAgent||"").slice(0,120)
      });
      write(arr);
    },
    list: function(){ return read(); },
    clear: function(){ try { localStorage.removeItem(KEY); } catch(e){} }
  };
})();
