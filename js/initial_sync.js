/* =========================================================
   js/initial_sync.js — المزامنة الأولية v3.0
   - تعمل عند أول تشغيل أو عند الطلب
   - تعمل بالكامل بدون إنترنت (تتخطى وتستخدم البيانات المحلية)
   ========================================================= */

var INITIAL_SYNC_KEY     = "pos_initial_sync_done";
var INITIAL_SYNC_VERSION = "5.1";

function isInitialSyncDone() {
  try {
    var v = localStorage.getItem(INITIAL_SYNC_KEY);
    if (!v) return false;
    var d = JSON.parse(v);
    return d && d.version === INITIAL_SYNC_VERSION && !!d.done;
  } catch (e) { return false; }
}
function markInitialSyncDone() {
  localStorage.setItem(INITIAL_SYNC_KEY, JSON.stringify({
    done: true, version: INITIAL_SYNC_VERSION, at: new Date().toISOString()
  }));
}
function resetInitialSync() { localStorage.removeItem(INITIAL_SYNC_KEY); }

/* ─── نافذة تقدم المزامنة ─── */
function showSyncProgress(pct, msg) {
  var bar  = document.getElementById("isync-bar");
  var text = document.getElementById("isync-text");
  var pctE = document.getElementById("isync-pct");
  if (bar)  bar.style.width   = pct + "%";
  if (text) text.textContent  = msg;
  if (pctE) pctE.textContent  = pct + "%";
}

function showInitialSyncOverlay() {
  if (document.getElementById("initial-sync-overlay")) return;
  var ov = document.createElement("div");
  ov.id = "initial-sync-overlay";
  ov.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.8);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;font-family:Cairo,sans-serif";
  ov.innerHTML = [
    '<div style="background:#1C2230;border:1px solid #2D3748;border-radius:16px;padding:36px 40px;width:100%;max-width:420px;text-align:center;color:#F3F4F6">',
    '<div style="width:64px;height:64px;background:rgba(245,124,32,.15);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">',
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F57C20" stroke-width="2"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg></div>',
    '<h2 style="font-size:20px;font-weight:800;margin-bottom:8px;color:#fff">جارٍ تزامن البيانات</h2>',
    '<p style="font-size:13px;color:#9CA3AF;margin-bottom:24px">يتم تنزيل بياناتك لأول مرة<br>سيعمل التطبيق بدون إنترنت بعد اكتمالها</p>',
    '<div style="background:#2D3748;border-radius:8px;height:8px;margin-bottom:12px;overflow:hidden">',
    '<div id="isync-bar" style="height:100%;width:0%;background:#F57C20;border-radius:8px;transition:width .4s ease"></div></div>',
    '<div style="display:flex;justify-content:space-between;font-size:12px;color:#9CA3AF;margin-bottom:6px">',
    '<span id="isync-text">جارٍ الاتصال...</span><span id="isync-pct">0%</span></div>',
    '<p style="font-size:11px;color:#6B7280;margin-top:20px">لا تغلق التطبيق خلال المزامنة</p>',
    '</div>'
  ].join("");
  document.body.appendChild(ov);
}

function hideInitialSyncOverlay() {
  var ov = document.getElementById("initial-sync-overlay");
  if (ov) {
    ov.style.opacity = "0";
    ov.style.transition = "opacity .4s";
    setTimeout(function () { ov.remove(); }, 400);
  }
}

/* ─── المزامنة الأولية الفعلية ─── */
async function runInitialSync(force) {
  if (!force && isInitialSyncDone()) return { ok: true, skipped: true };

  /* ── وضع بلا إنترنت أو غير متصل: تخطَّ ولكن لا تفشل ── */
  var forced = typeof isOfflineModeForced === "function" && isOfflineModeForced();
  if (forced || !navigator.onLine) {
    markInitialSyncDone(); /* سجّل كمكتملة حتى لا يُطلب مجدداً */
    return { ok: true, offline: true };
  }

  var ready = await sbReady();
  if (!ready) {
    /* فشل الاتصال — اعمل محلياً وسجّل كمكتملة */
    markInitialSyncDone();
    return { ok: true, offline: true, warn: "تعذّر الاتصال بـ Supabase" };
  }

  showInitialSyncOverlay();
  var errors = [];

  try {
    /* 1) المنتجات */
    showSyncProgress(10, "جارٍ تحميل المنتجات...");
    var rProd = await SB.from("products").select("*").order("id");
    if (!rProd.error && rProd.data) {
      lsSet(LS.products, rProd.data.map(function (p) {
        return { id: p.id, name: p.name, price: Number(p.price),
          costPrice: p.cost_price ? Number(p.cost_price) : 0, stock: p.stock,
          barcode: p.barcode || "", category: p.category || "",
          minStock: p.min_stock != null ? p.min_stock : 5 };
      }));
      showSyncProgress(20, "المنتجات: " + rProd.data.length + " ✓");
    } else { errors.push("المنتجات"); }

    /* 2) الفواتير */
    showSyncProgress(25, "جارٍ تحميل الفواتير...");
    var rInv = await SB.from("invoices").select("*").order("created_at", { ascending: false });
    if (!rInv.error && rInv.data) {
      showSyncProgress(35, "جارٍ تحميل بنود الفواتير...");
      var rItems = await SB.from("invoice_items").select("*");
      var items  = rItems.data || [];
      lsSet(LS.invoices, rInv.data.map(function (v) {
        return {
          invoiceNumber: v.invoice_number, date: v.date,
          paymentStatus: v.payment_status, total: Number(v.total), notes: v.notes || "",
          customer: v.customer_phone
            ? { phone: v.customer_phone, name: v.customer_name || "", address: v.customer_address || "" }
            : null,
          items: items.filter(function (i) { return i.invoice_number === v.invoice_number; })
            .map(function (i) {
              return { productId: i.product_id, name: i.product_name,
                price: Number(i.price), costPrice: i.cost_price ? Number(i.cost_price) : 0,
                quantity: i.quantity, total: Number(i.total) };
            })
        };
      }));
      showSyncProgress(50, "الفواتير: " + rInv.data.length + " ✓");
    } else { errors.push("الفواتير"); }

    /* 3) العملاء */
    showSyncProgress(55, "جارٍ تحميل العملاء...");
    var rCust = await SB.from("customers").select("*").order("total_spent", { ascending: false });
    if (!rCust.error && rCust.data) {
      lsSet(LS.customers, rCust.data.map(function (c) {
        return { phone: c.phone, name: c.name || "", address: c.address || "",
          totalSpent: Number(c.total_spent || 0), visits: Number(c.visits || 0),
          lastInvoiceDate: c.last_visit || "" };
      }));
      showSyncProgress(65, "العملاء: " + rCust.data.length + " ✓");
    } else { errors.push("العملاء"); }

    /* 4) الموظفون */
    showSyncProgress(68, "جارٍ تحميل الموظفين...");
    var rEmp = await SB.from("employees").select("*");
    if (!rEmp.error && rEmp.data) {
      lsSet(LS.employees, rEmp.data);
      showSyncProgress(72, "الموظفون: " + rEmp.data.length + " ✓");
    } else { errors.push("الموظفون"); }

    /* 5) المصاريف */
    showSyncProgress(75, "جارٍ تحميل المصاريف...");
    var rExp = await SB.from("expenses").select("*").order("date", { ascending: false });
    if (!rExp.error && rExp.data) {
      lsSet(LS.expenses, rExp.data);
      showSyncProgress(80, "المصاريف: " + rExp.data.length + " ✓");
    } else { errors.push("المصاريف"); }

    /* 6) الموردون */
    showSyncProgress(83, "جارٍ تحميل الموردين...");
    try {
      var rSup = await SB.from("suppliers").select("*");
      if (!rSup.error && rSup.data) { lsSet("acc_suppliers", rSup.data); }
      showSyncProgress(87, "الموردون ✓");
    } catch (e) {}

    /* 7) العروض */
    showSyncProgress(90, "جارٍ تحميل العروض...");
    try {
      var rOff = await SB.from("offers").select("*");
      if (!rOff.error && rOff.data) { lsSet("acc_offers", rOff.data); }
      showSyncProgress(93, "العروض ✓");
    } catch (e) {}

    /* 8) الإعدادات */
    showSyncProgress(95, "جارٍ تحميل الإعدادات...");
    try {
      var rSet = await SB.from("app_settings").select("value").eq("key", "customize").maybeSingle();
      if (rSet && rSet.data && rSet.data.value) {
        var cur = {};
        try { cur = JSON.parse(localStorage.getItem("pos_customize") || "{}"); } catch (e) {}
        localStorage.setItem("pos_customize", JSON.stringify(
          Object.assign({}, CUSTOMIZE_FULL_DEFAULTS || {}, cur, rSet.data.value)));
      }
    } catch (e) {}

    /* 9) المستخدمون */
    showSyncProgress(98, "جارٍ تحميل المستخدمين...");
    try {
      var rUsers = await SB.from("app_users").select("id,username,password,name,role,active");
      if (!rUsers.error && rUsers.data && rUsers.data.length) {
        var localU = rUsers.data.filter(function (u) { return u.active; }).map(function (ru) {
          return { id: String(ru.id), username: ru.username,
            password: ru.password || "", name: ru.name || ru.username,
            role: ru.role || "cashier", pwv: 1 };
        });
        if (localU.length) localStorage.setItem("pos_auth_users", JSON.stringify(localU));
      }
    } catch (e) {}

    showSyncProgress(100, "اكتملت المزامنة ✓");
    markInitialSyncDone();
    localStorage.removeItem("pos_sync_queue");
    localStorage.removeItem("pos_sync_stock");

    await new Promise(function (r) { setTimeout(r, 800); });
    hideInitialSyncOverlay();

    return errors.length ? { ok: true, warnings: errors } : { ok: true };

  } catch (err) {
    hideInitialSyncOverlay();
    /* فشل ما: لا تحجب التطبيق، سجّل كمكتملة وعمل محلياً */
    markInitialSyncDone();
    return { ok: true, offline: true, warn: err.message };
  }
}

/* ─── تشغيل تلقائي عند تحميل الصفحة ─── */
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", async function () {
    if (window.location.pathname.indexOf("login") !== -1) return;
    if (isInitialSyncDone()) return;

    setTimeout(async function () {
      var result = await runInitialSync(false);
      if (result.warn) {
        ntfToast("تنبيه: " + result.warn + " — سيُزامَن لاحقاً", "warning", 5000);
      } else if (result.ok && !result.skipped && !result.offline && result.warnings) {
        ntfToast("تمت المزامنة مع بعض التحذيرات: " + result.warnings.join(", "), "warning", 5000);
      } else if (result.ok && !result.skipped && !result.offline) {
        ntfToast("تمت المزامنة الأولية بنجاح ✓", "success", 3000);
      }
    }, 1500);
  });
}
