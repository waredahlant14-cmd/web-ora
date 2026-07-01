/* =========================================================
   js/mode-manager.js — مدير وضع التشغيل v1.0
   يحدد سلوك المزامنة بناءً على الوضع المختار:
     offline  → localStorage فقط، لا Supabase أبداً
     online   → Supabase أساسي + localStorage كذاكرة تخزين مؤقتة
     parallel → الكتابة في كليهما، القراءة من Supabase إن أمكن
   ========================================================= */

var APP_MODE_KEY    = "pos_app_mode";
var APP_MODE_SETUP  = "pos_app_mode_set_at";

/* ─── قراءة الوضع الحالي ─── */
function getAppMode() {
  return localStorage.getItem(APP_MODE_KEY) || null;
}

function isOfflineMode()   { return getAppMode() === "offline"; }
function isOnlineMode()    { return getAppMode() === "online";  }
function isParallelMode()  { return getAppMode() === "parallel";}

/* توافق مع الكود القديم الذي يفحص isOfflineModeForced() */
function isOfflineModeForced() { return isOfflineMode(); }

/* ─── تغيير الوضع (من صفحة الإعدادات) ─── */
function setAppMode(mode, skipConfirm) {
  if (!["offline","online","parallel"].includes(mode)) return false;
  if (!skipConfirm && typeof confirm === "function") {
    var labels = { offline:"بدون إنترنت", online:"سحابي", parallel:"توازي" };
    if (!confirm("تغيير وضع التشغيل إلى: " + labels[mode] + "?\nسيُعاد تشغيل التطبيق لتطبيق التغييرات.")) return false;
  }
  localStorage.setItem(APP_MODE_KEY, mode);
  localStorage.setItem(APP_MODE_SETUP, new Date().toISOString());

  if (mode === "offline") {
    localStorage.setItem("pos_offline_forced", "1");
    /* مسح صف المزامنة — في وضع بدون إنترنت لا حاجة لأي عمليات معلقة */
    localStorage.removeItem("pos_sync_queue");
    localStorage.removeItem("pos_sync_stock");
    /* إيقاف المزامنة فوراً */
    if (typeof bgsStop === "function") bgsStop();
    /* إعادة تعيين حالة Supabase */
    try { if (typeof SB_OK !== "undefined") window.SB_OK = null; } catch(e) {}
  } else {
    localStorage.removeItem("pos_offline_forced");
    /* إعادة تعيين حالة Supabase لإعادة الاتصال */
    try { if (typeof SB_OK !== "undefined") window.SB_OK = null; } catch(e) {}
  }
  /* أعد التحميل */
  setTimeout(function(){ location.href = "login.html"; }, 300);
  return true;
}

/* ─── إعادة اختيار الوضع ─── */
function resetAppMode() {
  localStorage.removeItem(APP_MODE_KEY);
  localStorage.removeItem(APP_MODE_SETUP);
  localStorage.removeItem("pos_offline_forced");
  location.href = "mode-select.html";
}

/* ─── وصف الوضع للعرض ─── */
function getAppModeLabel() {
  var m = getAppMode();
  if (m === "offline")  return "بدون إنترنت (محلي)";
  if (m === "online")   return "سحابي (أجهزة متعددة)";
  if (m === "parallel") return "توازي (محلي + سحابي)";
  return "غير محدد";
}

function getAppModeIcon() {
  var m = getAppMode();
  if (m === "offline")  return "💾";
  if (m === "online")   return "☁️";
  if (m === "parallel") return "⚡";
  return "❓";
}

/* ─── هل يجوز محاولة Supabase؟ ─── */
function isSyncAllowed() {
  if (isOfflineMode()) return false;
  if (!navigator.onLine) return false;
  return true;
}

/* ─── هل نكتب للـ localStorage أيضاً؟ ─── */
function shouldWriteLocal() {
  /* دائماً نكتب محلياً كنسخة احتياطية */
  return true;
}

/* ─── هل نقرأ من Supabase أولاً؟ ─── */
function shouldReadCloud() {
  var m = getAppMode();
  return (m === "online" || m === "parallel") && navigator.onLine;
}

/* ─── التحقق من الوضع عند التحميل ─── */
(function checkModeOnLoad(){
  if (typeof document === "undefined") return;
  document.addEventListener("DOMContentLoaded", function(){
    /* إذا لم يُحدَّد وضع، وجّه إلى صفحة الاختيار */
    var mode = getAppMode();
    if (!mode) {
      /* لا تعيد التوجيه إن كنا بالفعل في mode-select.html */
      if (window.location.pathname.indexOf("mode-select") === -1) {
        location.href = "mode-select.html";
      }
      return;
    }

    /* أضف مؤشر الوضع في الـ header إن وُجد */
    setTimeout(injectModeIndicator, 800);
  });
})();

/* ─── مؤشر الوضع في الـ header ─── */
function injectModeIndicator() {
  if (document.getElementById("mode-indicator")) return;
  var mode  = getAppMode();
  if (!mode) return;

  var colors  = { offline:"#818CF8", online:"#34D399", parallel:"#F57C20" };
  var labels  = { offline:"محلي",    online:"سحابي",  parallel:"توازي"   };
  var color   = colors[mode] || "#9CA3AF";
  var label   = labels[mode] || mode;

  /* ابحث عن الـ header أو nav */
  var target = document.querySelector(".topbar-left, .topbar, .navbar, header");
  if (!target) return;

  var el = document.createElement("span");
  el.id = "mode-indicator";
  el.title = "وضع التشغيل: " + getAppModeLabel() + " — انقر للتغيير";
  el.style.cssText = [
    "display:inline-flex;align-items:center;gap:5px;",
    "font-size:11px;font-weight:700;",
    "padding:3px 10px;border-radius:20px;",
    "background:" + color + "18;",
    "color:" + color + ";",
    "border:1px solid " + color + "30;",
    "cursor:pointer;",
    "margin-inline-start:8px;",
    "vertical-align:middle;"
  ].join("");
  el.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:' + color + ';display:inline-block"></span>' + label;
  el.onclick = function(){ showModeModal(); };
  target.appendChild(el);
}

/* ─── نافذة تغيير الوضع ─── */
function showModeModal() {
  var existing = document.getElementById("mode-modal-overlay");
  if (existing) { existing.remove(); return; }

  var mode = getAppMode();
  var ov   = document.createElement("div");
  ov.id    = "mode-modal-overlay";
  ov.style.cssText = "position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center";
  ov.onclick = function(e){ if(e.target===ov) ov.remove(); };

  var modes = [
    { id:"offline",  label:"بدون إنترنت", desc:"جهاز واحد — لا مزامنة", color:"#818CF8" },
    { id:"online",   label:"سحابي",       desc:"أجهزة متعددة — Supabase", color:"#34D399" },
    { id:"parallel", label:"توازي",       desc:"محلي + سحابي (⚠ غير موصى به)", color:"#F57C20" },
  ];

  var btns = modes.map(function(m){
    var active = (m.id === mode);
    return [
      '<button onclick="setAppMode(\''+m.id+'\')" ',
      'style="width:100%;text-align:right;padding:12px 16px;border-radius:10px;border:2px solid ',
      active ? m.color : "rgba(255,255,255,.08)",
      ';background:',
      active ? m.color+"15" : "transparent",
      ';color:#F3F4F6;cursor:pointer;font-family:Cairo,sans-serif;font-size:13px;',
      'display:flex;align-items:center;gap:10px;margin-bottom:8px">',
      '<span style="width:10px;height:10px;border-radius:50%;background:'+m.color+';flex-shrink:0"></span>',
      '<span><strong>'+m.label+'</strong><br><small style="color:#9CA3AF;font-size:11px">'+m.desc+'</small></span>',
      active ? '<span style="margin-inline-start:auto;font-size:10px;color:'+m.color+'">✓ الحالي</span>' : "",
      '</button>'
    ].join("");
  }).join("");

  ov.innerHTML = [
    '<div style="background:#1C2230;border:1px solid #2D3748;border-radius:16px;padding:28px;width:100%;max-width:380px;font-family:Cairo,sans-serif;color:#F3F4F6">',
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">',
    '<h3 style="font-size:16px;font-weight:800">وضع التشغيل</h3>',
    '<button onclick="document.getElementById(\'mode-modal-overlay\').remove()" ',
    'style="background:transparent;border:none;color:#6B7280;cursor:pointer;font-size:20px;line-height:1">×</button>',
    '</div>',
    btns,
    '<button onclick="resetAppMode()" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;',
    'border:1px solid rgba(255,255,255,.08);background:transparent;color:#6B7280;cursor:pointer;',
    'font-family:Cairo,sans-serif;font-size:12px">إعادة الاختيار من صفحة البداية</button>',
    '</div>'
  ].join("");

  document.body.appendChild(ov);
}

/* ─── تصدير للاستخدام العام ─── */
window.getAppMode        = getAppMode;
window.isOfflineMode     = isOfflineMode;
window.isOnlineMode      = isOnlineMode;
window.isParallelMode    = isParallelMode;
window.isOfflineModeForced = isOfflineModeForced;
window.isSyncAllowed     = isSyncAllowed;
window.shouldReadCloud   = shouldReadCloud;
window.setAppMode        = setAppMode;
window.resetAppMode      = resetAppMode;
window.getAppModeLabel   = getAppModeLabel;
window.showModeModal     = showModeModal;
