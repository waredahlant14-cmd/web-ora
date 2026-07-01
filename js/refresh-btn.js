/* =========================================================
   js/refresh-btn.js — زر التحديث في الوضع السحابي/التوازي
   ========================================================= */
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var mode = localStorage.getItem("pos_app_mode");
    if (mode !== "online" && mode !== "parallel") return;

    /* بناء الزر */
    var btn = document.createElement("button");
    btn.id = "global-refresh-btn";
    btn.title = "تحديث البيانات من السحابة";
    btn.setAttribute("aria-label", "تحديث");
    btn.style.cssText = [
      "display:inline-flex;align-items:center;gap:6px;",
      "padding:7px 14px;border-radius:10px;",
      "background:rgba(52,211,153,.1);color:#34D399;",
      "border:1px solid rgba(52,211,153,.3);",
      "font-family:Cairo,sans-serif;font-size:13px;font-weight:700;",
      "cursor:pointer;transition:all .2s;",
      "vertical-align:middle;"
    ].join("");
    btn.innerHTML = [
      '<svg id="refresh-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"',
      ' fill="none" stroke="currentColor" stroke-width="2">',
      '<polyline points="23 4 23 10 17 10"/>',
      '<polyline points="1 20 1 14 7 14"/>',
      '<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
      '</svg>تحديث'
    ].join("");

    btn.onmouseenter = function () {
      btn.style.background = "rgba(52,211,153,.2)";
      btn.style.borderColor = "rgba(52,211,153,.6)";
    };
    btn.onmouseleave = function () {
      btn.style.background = "rgba(52,211,153,.1)";
      btn.style.borderColor = "rgba(52,211,153,.3)";
    };

    btn.onclick = function () {
      var icon = document.getElementById("refresh-icon");
      if (icon) icon.style.animation = "spin .8s linear infinite";
      btn.disabled = true;

      /* استدعاء مزامنة إن وُجدت */
      if (typeof syncNow === "function") {
        var p = syncNow(true);
        if (p && typeof p.then === "function") {
          p.then(function () { finishRefresh(btn, icon); })
           .catch(function () { finishRefresh(btn, icon); });
          return;
        }
      }
      /* إن لم توجد دالة مزامنة، أعد التحميل */
      setTimeout(function () { location.reload(); }, 400);
    };

    /* إضافة الزر إلى الهيدر */
    var target = document.querySelector(".btn-group, .page-head-row .btn-group, .page-head");
    if (target && target.className.indexOf("btn-group") !== -1) {
      target.insertBefore(btn, target.firstChild);
    } else {
      var headRow = document.querySelector(".page-head-row");
      if (headRow) {
        var grp = document.createElement("div");
        grp.className = "btn-group";
        grp.appendChild(btn);
        headRow.appendChild(grp);
      } else {
        var head = document.querySelector(".page-head, #page > div:first-child");
        if (head) head.appendChild(btn);
      }
    }
  });

  function finishRefresh(btn, icon) {
    if (icon) icon.style.animation = "";
    btn.disabled = false;
    /* مضمضة خضراء */
    btn.style.background = "rgba(52,211,153,.35)";
    setTimeout(function () {
      btn.style.background = "rgba(52,211,153,.1)";
    }, 600);
  }

  /* CSS للدوران */
  var style = document.createElement("style");
  style.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";
  document.head.appendChild(style);
})();
