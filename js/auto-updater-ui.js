/* =========================================================
   js/auto-updater-ui.js — واجهة التحديث التلقائي v1.0
   يستقبل أحداث التحديث من main process ويعرض UI للمستخدم
   ========================================================= */

(function () {
  var _overlay = null;

  /* ══════════════════════════════════════════
     بناء واجهة التحديث
     ══════════════════════════════════════════ */
  function _buildOverlay(type, data) {
    if (_overlay) { _overlay.remove(); _overlay = null; }

    var ov = document.createElement("div");
    ov.id = "upd-overlay";
    ov.style.cssText = [
      "position:fixed;z-index:10000;",
      "font-family:Cairo,sans-serif;direction:rtl;"
    ].join("");

    /* ── أنواع الواجهات ── */
    if (type === "available") {
      /* إشعار صغير في الزاوية */
      ov.style.cssText += "bottom:24px;left:24px;max-width:340px;";
      ov.innerHTML = [
        '<div style="background:#1C2230;border:1px solid #F57C20;border-radius:16px;',
        'padding:18px 20px;box-shadow:0 12px 40px rgba(0,0,0,.6);color:#F1F5F9">',
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">',
        '<div style="width:36px;height:36px;background:rgba(245,124,32,.15);border-radius:50%;',
        'display:flex;align-items:center;justify-content:center;flex-shrink:0">',
        '<svg width="18" height="18" fill="none" stroke="#F57C20" stroke-width="2.2" viewBox="0 0 24 24">',
        '<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>',
        '<path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg></div>',
        '<div><p style="font-weight:800;font-size:14px;margin:0">تحديث جديد متاح 🎉</p>',
        '<p style="font-size:12px;color:#94A3B8;margin:2px 0 0">v' + (data.newVersion || "") + '</p></div>',
        '<button onclick="document.getElementById(\'upd-overlay\').remove()" ',
        'style="margin-right:auto;background:none;border:none;color:#64748B;font-size:18px;',
        'cursor:pointer;padding:0 4px;line-height:1">×</button></div>',
        data.notes ? '<p style="font-size:12px;color:#94A3B8;margin:0 0 14px;border-top:1px solid #1E293B;padding-top:10px">' + data.notes + '</p>' : '',
        '<div style="display:flex;gap:8px">',
        '<button id="upd-btn-now" style="flex:1;padding:9px 0;background:#F57C20;border:none;',
        'border-radius:10px;color:#fff;font-family:Cairo,sans-serif;font-weight:700;',
        'font-size:13px;cursor:pointer">تحديث الآن</button>',
        '<button onclick="document.getElementById(\'upd-overlay\').remove()" ',
        'style="padding:9px 14px;background:#1E293B;border:1px solid #334155;',
        'border-radius:10px;color:#94A3B8;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer">',
        'لاحقاً</button></div></div>'
      ].join("");

      document.body.appendChild(ov);
      _overlay = ov;

      document.getElementById("upd-btn-now").onclick = function () {
        _showDownloading();
        if (window.electronAPI && window.electronAPI.startUpdate)
          window.electronAPI.startUpdate();
      };
    }

    else if (type === "downloading") {
      /* شريط التنزيل في الزاوية */
      ov.style.cssText += "bottom:24px;left:24px;max-width:320px;";
      ov.innerHTML = [
        '<div style="background:#1C2230;border:1px solid #334155;border-radius:16px;',
        'padding:18px 20px;box-shadow:0 12px 40px rgba(0,0,0,.6);color:#F1F5F9">',
        '<p style="font-weight:700;font-size:13px;margin:0 0 12px">',
        '⬇ جارٍ تنزيل التحديث...</p>',
        '<div style="background:#0F172A;border-radius:6px;height:6px;overflow:hidden;margin-bottom:8px">',
        '<div id="upd-prog-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#F57C20,#FBBF24);',
        'border-radius:6px;transition:width .4s ease"></div></div>',
        '<p id="upd-prog-txt" style="font-size:12px;color:#64748B;margin:0">0%</p>',
        '</div>'
      ].join("");
      document.body.appendChild(ov);
      _overlay = ov;
    }

    else if (type === "ready") {
      /* تأكيد التثبيت */
      ov.style.cssText += "inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);",
      ov.style.cssText += "display:flex;align-items:center;justify-content:center;";
      ov.innerHTML = [
        '<div style="background:#1C2230;border:1px solid #334155;border-radius:20px;',
        'padding:36px;max-width:420px;text-align:center;color:#F1F5F9">',
        '<div style="font-size:48px;margin-bottom:16px">✅</div>',
        '<h3 style="font-size:18px;font-weight:800;margin:0 0 8px">التحديث جاهز للتثبيت</h3>',
        '<p style="color:#94A3B8;font-size:13px;margin:0 0 24px">',
        'سيتم إعادة تشغيل التطبيق تلقائياً لإتمام التحديث</p>',
        '<button id="upd-install-btn" style="width:100%;padding:12px;background:#F57C20;',
        'border:none;border-radius:12px;color:#fff;font-family:Cairo,sans-serif;',
        'font-weight:800;font-size:15px;cursor:pointer">تثبيت وإعادة التشغيل</button>',
        '</div>'
      ].join("");
      document.body.appendChild(ov);
      _overlay = ov;

      document.getElementById("upd-install-btn").onclick = function () {
        if (window.electronAPI && window.electronAPI.installUpdate)
          window.electronAPI.installUpdate();
      };
    }

    else if (type === "error") {
      ov.style.cssText += "bottom:24px;left:24px;max-width:300px;";
      ov.innerHTML = [
        '<div style="background:#1C2230;border:1px solid #EF4444;border-radius:14px;',
        'padding:14px 18px;color:#F1F5F9;display:flex;align-items:center;gap:10px">',
        '<span style="font-size:20px">⚠️</span>',
        '<div><p style="font-size:13px;font-weight:700;margin:0">فشل التحديث</p>',
        '<p style="font-size:11px;color:#94A3B8;margin:2px 0 0">' + (data.msg || "") + '</p></div>',
        '<button onclick="document.getElementById(\'upd-overlay\').remove()" ',
        'style="background:none;border:none;color:#64748B;font-size:18px;cursor:pointer;margin-right:auto">',
        '×</button></div>'
      ].join("");
      document.body.appendChild(ov);
      _overlay = ov;
      setTimeout(function () { if (ov.parentNode) ov.remove(); }, 6000);
    }
  }

  function _showDownloading() {
    if (_overlay) { _overlay.remove(); _overlay = null; }
    _buildOverlay("downloading", {});
  }

  /* ══════════════════════════════════════════
     الاستماع لأحداث التحديث من main process
     ══════════════════════════════════════════ */
  if (window.electronAPI && window.electronAPI.onUpdateEvent) {
    window.electronAPI.onUpdateEvent(function (event) {
      switch (event.type) {
        case "update-available":
          _buildOverlay("available", {
            newVersion: event.version,
            notes: event.notes || ""
          });
          break;

        case "download-progress":
          var bar = document.getElementById("upd-prog-bar");
          var txt = document.getElementById("upd-prog-txt");
          if (bar) bar.style.width = (event.percent || 0) + "%";
          if (txt) txt.textContent = Math.round(event.percent || 0) + "%" +
            (event.transferred ? " — " + _fmtSize(event.transferred) + " / " + _fmtSize(event.total) : "");
          break;

        case "update-downloaded":
          _buildOverlay("ready", {});
          break;

        case "update-error":
          _buildOverlay("error", { msg: event.message || "حدث خطأ أثناء التحديث" });
          break;

        case "update-not-available":
          /* لا نُظهر شيئاً — لا داعي لإزعاج المستخدم */
          break;
      }
    });
  }

  function _fmtSize(bytes) {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

})();
