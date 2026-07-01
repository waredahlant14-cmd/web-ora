/* =========================================================
   js/notifications.js — نظام الإشعارات المركزي v5.0
   يدير: Toast / Offline Banner / وضع بلا إنترنت
   ========================================================= */

/* ─── مفتاح الوضع غير المتصل الإجباري ─── */
var OFFLINE_MODE_KEY = "pos_offline_mode";

/*
 * إصلاح: كانت هذه النسخة تفحص مفتاح pos_offline_mode فقط،
 * بينما mode-manager.js يكتب pos_app_mode = "offline".
 * الآن تفحص كلا المفتاحين حتى تعمل مع النظامين.
 */
function isOfflineModeForced() {
  if (localStorage.getItem("pos_app_mode") === "offline") return true;
  return localStorage.getItem(OFFLINE_MODE_KEY) === "1";
}
function setOfflineMode(on) {
  if (on) {
    localStorage.setItem(OFFLINE_MODE_KEY, "1");
  } else {
    localStorage.removeItem(OFFLINE_MODE_KEY);
  }
  _ntfRenderBanner();
  if (typeof updateSyncIndicator === "function") updateSyncIndicator();
}
function toggleOfflineMode() {
  setOfflineMode(!isOfflineModeForced());
  return isOfflineModeForced();
}

/* ─── هل نحن فعلاً منفصلون عن الشبكة (حقيقي أو إجباري) ─── */
function isEffectivelyOffline() {
  return !navigator.onLine || isOfflineModeForced();
}

/* ═══════════════════════════════════════════════════════════
   Toast Notifications
   ═══════════════════════════════════════════════════════════ */
var _ntfQueue  = [];
var _ntfActive = 0;
var _ntfMax    = 4;

function ntfToast(msg, type, duration) {
  type     = type     || "info";
  duration = duration || (type === "error" ? 5000 : 3200);

  var ICONS = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    sync:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>',
    offline: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a11 11 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
    online:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>'
  };

  function _show(msgText, t, dur) {
    var box = document.getElementById("toast-box");
    if (!box) { console.warn("[NTF]", msgText); return; }
    if (_ntfActive >= _ntfMax) {
      _ntfQueue.push({ msg: msgText, type: t, duration: dur });
      return;
    }
    _ntfActive++;
    var el = document.createElement("div");
    el.className = "ntf-toast ntf-" + t;
    el.innerHTML =
      '<span class="ntf-icon">' + (ICONS[t] || ICONS.info) + '</span>' +
      '<span class="ntf-msg">' + msgText + '</span>' +
      '<button class="ntf-close" onclick="this.parentNode.remove();_ntfActive=Math.max(0,_ntfActive-1);_ntfFlush()">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>';
    box.appendChild(el);

    /* تحريك الدخول */
    requestAnimationFrame(function () { el.classList.add("ntf-show"); });

    setTimeout(function () {
      el.classList.remove("ntf-show");
      el.classList.add("ntf-hide");
      setTimeout(function () {
        el.remove();
        _ntfActive = Math.max(0, _ntfActive - 1);
        _ntfFlush();
      }, 300);
    }, dur);
  }

  _show(msg, type, duration);
}

function _ntfFlush() {
  if (_ntfQueue.length && _ntfActive < _ntfMax) {
    var next = _ntfQueue.shift();
    ntfToast(next.msg, next.type, next.duration);
  }
}

/* ─── الدالة العامة (تحل محل toast القديمة) ─── */
function toast(msg, type, duration) {
  ntfToast(msg, type, duration);
}

/* ═══════════════════════════════════════════════════════════
   Offline Banner — شريط أعلى الشاشة
   ═══════════════════════════════════════════════════════════ */
function _ntfRenderBanner() {
  /* لا شريط — الإشعارات فقط */
  var banner = document.getElementById("offline-banner");
  if (banner) banner.remove();
}

/* ─── تحديث الـ dot في الـ topbar — تمت الإزالة (v5.1) ─── */
function updateSyncDot(_state) {
  /* لا شيء — تم استبدال نقطة المزامنة بإشعارات منبثقة */
  return;
}

/* ─── تهيئة عند تحميل الصفحة ─── */
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    _ntfRenderBanner();

    window.addEventListener("online", function () {
      _ntfRenderBanner();
      if (!isOfflineModeForced()) {
        ntfToast("عاد الاتصال بالإنترنت — جارٍ مزامنة البيانات…", "online", 4000);
        updateSyncDot("syncing");
      }
    });

    window.addEventListener("offline", function () {
      _ntfRenderBanner();
      ntfToast("انقطع الاتصال بالإنترنت — البيانات تُحفَظ محلياً", "offline", 5000);
      updateSyncDot("offline");
    });
  });
}
