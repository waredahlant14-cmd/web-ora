/* =========================================================
   js/setup.js — إعداد Supabase لأول مرة
   يتم تضمينه في صفحة الإعدادات (/login/ → settings.php)
   ========================================================= */
(function () {
  function $(id) { return document.getElementById(id); }

  function isConfigured() {
    var c = window.APP_CONFIG || {};
    return !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY);
  }

  function buildSetupCard() {
    var wrap = document.createElement("div");
    wrap.className = "card";
    wrap.id = "setup-card";
    wrap.innerHTML =
      '<h2>إعداد المشروع — مرة واحدة فقط</h2>' +
      '<p class="text-muted" style="font-size:13px;margin-bottom:14px">' +
      'أدخل بيانات قاعدة بياناتك في Supabase. تُحفظ بشكل دائم داخل المشروع ولن تُطلب مجدداً.</p>' +
      '<div class="field"><label>اسم الموقع</label>' +
      '<input class="input" id="setup-site" placeholder="مثال: متجر النور"></div>' +
      '<div class="field"><label>Supabase URL</label>' +
      '<input class="input" id="setup-url" placeholder="https://xxxx.supabase.co" dir="ltr"></div>' +
      '<div class="field"><label>Supabase Anon Key</label>' +
      '<textarea class="input" id="setup-key" rows="3" placeholder="eyJhbGciOi..." dir="ltr"></textarea></div>' +
      '<p id="setup-msg" style="font-size:13px;margin:8px 0"></p>' +
      '<button class="btn btn-primary" id="setup-save">حفظ وتنزيل ملف SQL</button>';
    return wrap;
  }

  async function save() {
    var url  = $("setup-url").value.trim();
    var key  = $("setup-key").value.trim();
    var site = $("setup-site").value.trim();
    var msg  = $("setup-msg");
    var btn  = $("setup-save");
    var tokenInput = $("setup-token");
    var token = tokenInput ? tokenInput.value.trim() : "";
    msg.style.color = "#b45309";
    if (!url || !key) { msg.textContent = "✗ يرجى ملء URL والمفتاح"; return; }
    /* تحقق من شكل URL — HTTPS فقط */
    if (!/^https:\/\/[a-z0-9][a-z0-9.\-]+$/i.test(url.replace(/\/$/, ""))) {
      msg.textContent = "✗ يجب أن يبدأ الرابط بـ https://"; return;
    }
    btn.disabled = true; msg.textContent = "جارٍ الحفظ…";
    try {
      var body = { SUPABASE_URL: url, SUPABASE_ANON_KEY: key, SITE_NAME: site };
      if (token) body.LOCK_TOKEN = token;
      var r = await fetch("save-config.html", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(body)
      });
      var j = await r.json();
      if (!j.ok) {
        if (j.error === "locked") {
          /* أظهر حقل إدخال التوكن */
          if (!$("setup-token")) {
            var tWrap = document.createElement("div");
            tWrap.className = "field";
            tWrap.innerHTML = '<label>توكن قفل الإعدادات (LOCK_TOKEN)</label>' +
              '<input class="input" id="setup-token" dir="ltr" placeholder="التوكن الذي حصلت عليه عند الإعداد الأول">';
            msg.parentNode.insertBefore(tWrap, msg);
          }
          throw new Error("الإعدادات مقفلة — أدخل توكن القفل");
        }
        throw new Error(j.error || "save_failed");
      }
      msg.style.color = "#047857";
      if (j.lock_token) {
        msg.innerHTML = "✓ تم الحفظ — احفظ توكن القفل التالي في مكان آمن:<br><code style='display:inline-block;margin-top:6px;padding:6px 10px;background:#0f172a;color:#fff;border-radius:6px;font-size:12px;direction:ltr'>" +
          j.lock_token.replace(/[<>&"]/g, function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];}) +
          "</code>";
          /* تنزيل ملف SQL تلقائياً */
          var a = document.createElement("a");
          a.href = "supabase-schema.sql"; a.download = "supabase-schema.sql";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { location.reload(); }, 12000);
      } else {
        msg.textContent = "✓ تم التحديث بنجاح";
        setTimeout(function () { location.reload(); }, 1500);
      }
    } catch (e) {
      msg.style.color = "#b91c1c";
      msg.textContent = "✗ " + (e.message || "تعذّر الحفظ");
      btn.disabled = false;
    }
  }

  function buildSyncCard() {
    var wrap = document.createElement("div");
    wrap.className = "card";
    wrap.innerHTML =
      '<h2>المزامنة</h2>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">' +
      '<button class="btn btn-primary" id="btn-sync-now">مزامنة الآن</button>' +
      '<button class="btn btn-outline" id="btn-sync-on">تشغيل المزامنة التلقائية</button>' +
      '<button class="btn btn-outline" id="btn-sync-off">إيقاف المزامنة التلقائية</button>' +
      '</div>' +
      '<p id="sync-state" class="text-muted" style="font-size:13px"></p>';
    return wrap;
  }

  function refreshSyncState() {
    var on = window.isAutoSyncEnabled ? window.isAutoSyncEnabled() : true;
    var el = $("sync-state");
    if (!el) return;
    el.textContent = on
      ? "✓ المزامنة التلقائية مفعلة (كل دقيقة)"
      : "✗ المزامنة التلقائية متوقفة — يجب الضغط على \"مزامنة الآن\" يدوياً";
    el.style.color = on ? "#047857" : "#b91c1c";
  }

  function wireSync() {
    var n = $("btn-sync-now"), on = $("btn-sync-on"), off = $("btn-sync-off");
    if (n)  n.onclick  = function () { if (typeof syncNow === "function") syncNow(true); };
    if (on) on.onclick = function () { window.setAutoSync && window.setAutoSync(true);  refreshSyncState(); };
    if (off) off.onclick = function () {
      if (!confirm("إيقاف المزامنة التلقائية؟ قد لا يتم رفع التغييرات إلى الخادم حتى تنفيذ مزامنة يدوية.")) return;
      window.setAutoSync && window.setAutoSync(false); refreshSyncState();
    };
    refreshSyncState();
  }

  function mount() {
    var page = document.getElementById("page");
    if (!page) return;
    if (!isConfigured()) {
      page.insertBefore(buildSetupCard(), page.children[1] || null);
      $("setup-save").onclick = save;
    }
    page.appendChild(buildSyncCard());
    wireSync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else { mount(); }
})();
