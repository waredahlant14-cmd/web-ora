/* =========================================================
   js/python_sync_bridge.js — جسر المزامنة مع Python v1.0
   يستخدم sync_helper.py عبر Electron IPC لمزامنة أسرع
   يُفعَّل تلقائياً في وضعَي online و parallel
   ========================================================= */

var PSB_AVAILABLE  = false;
var PSB_LAST_CHECK = 0;
var PSB_CHECK_INT  = 60000; /* تحقق من توفر Python كل دقيقة */

/* ─── هل Python متاح؟ ─── */
async function psbCheck() {
  if (!window.electronAPI || !window.electronAPI.pythonSync) {
    PSB_AVAILABLE = false;
    return false;
  }
  try {
    var cfg = window.APP_CONFIG || {};
    var result = await window.electronAPI.pythonPing({
      SUPABASE_URL: cfg.SUPABASE_URL || "",
      SUPABASE_ANON_KEY: cfg.SUPABASE_ANON_KEY || ""
    });
    PSB_AVAILABLE = !!(result && result.ok);
  } catch (e) {
    PSB_AVAILABLE = false;
  }
  PSB_LAST_CHECK = Date.now();
  return PSB_AVAILABLE;
}

/* ─── مزامنة كاملة عبر Python ─── */
async function psbFullSync(queue, stockIds) {
  if (!window.electronAPI || !window.electronAPI.pythonSync) return null;

  /* بناء قائمة تغييرات المخزون */
  var localProducts = [];
  try { localProducts = JSON.parse(localStorage.getItem("acc_products_pro")) || []; } catch(e){}

  var stockChanges = [];
  for (var i = 0; i < stockIds.length; i++) {
    var pid = stockIds[i];
    for (var j = 0; j < localProducts.length; j++) {
      if (String(localProducts[j].id) === String(pid)) {
        stockChanges.push({ id: pid, stock: localProducts[j].stock });
        break;
      }
    }
  }

  var cfg = window.APP_CONFIG || {};
  try {
    var result = await window.electronAPI.pythonSync({
      mode:   "full",
      queue:  queue,
      stock:  stockChanges,
      config: {
        SUPABASE_URL:      cfg.SUPABASE_URL || "",
        SUPABASE_ANON_KEY: cfg.SUPABASE_ANON_KEY || ""
      }
    });
    return result;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ─── سحب كامل من السحابة ─── */
async function psbPullAll() {
  if (!window.electronAPI || !window.electronAPI.pythonSync) return null;
  var cfg = window.APP_CONFIG || {};
  try {
    var result = await window.electronAPI.pythonSync({
      mode:   "pull",
      queue:  [],
      stock:  [],
      config: {
        SUPABASE_URL:      cfg.SUPABASE_URL || "",
        SUPABASE_ANON_KEY: cfg.SUPABASE_ANON_KEY || ""
      }
    });
    if (result && result.ok && result.data) {
      _applyPullData(result.data);
    }
    return result;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ─── تطبيق البيانات المسحوبة على localStorage ─── */
function _applyPullData(data) {
  var tableMap = {
    "products":      "acc_products_pro",
    "customers":     "acc_customers",
    "employees":     "acc_employees",
    "expenses":      "acc_expenses",
    "suppliers":     "acc_suppliers",
    "offers":        "acc_offers",
  };

  /* المنتجات */
  if (data.products && data.products.length) {
    var products = data.products.map(function(p){
      return { id:p.id, name:p.name, price:Number(p.price),
               costPrice:p.cost_price?Number(p.cost_price):0,
               stock:p.stock, barcode:p.barcode||"",
               category:p.category||"", minStock:p.min_stock!=null?p.min_stock:5 };
    });
    localStorage.setItem("acc_products_pro", JSON.stringify(products));
  }

  /* العملاء */
  if (data.customers && data.customers.length) {
    var customers = data.customers.map(function(c){
      return { phone:c.phone, name:c.name||"", address:c.address||"",
               totalSpent:Number(c.total_spent||0), visits:Number(c.visits||0),
               lastInvoiceDate:c.last_visit||"" };
    });
    localStorage.setItem("acc_customers", JSON.stringify(customers));
  }

  /* الجداول البسيطة */
  ["employees","expenses","suppliers","offers"].forEach(function(t){
    if (data[t] && data[t].length) {
      var key = tableMap[t] || ("acc_" + t);
      localStorage.setItem(key, JSON.stringify(data[t]));
    }
  });

  /* الفواتير (دمج header + items) */
  if (data.invoices && data.invoices.length) {
    var items = data.invoice_items || [];
    var invoices = data.invoices.map(function(v){
      return {
        invoiceNumber: v.invoice_number, date: v.date,
        paymentStatus: v.payment_status, total: Number(v.total), notes: v.notes||"",
        customer: v.customer_phone
          ? { phone:v.customer_phone, name:v.customer_name||"", address:v.customer_address||"" }
          : null,
        items: items.filter(function(i){ return i.invoice_number === v.invoice_number; })
          .map(function(i){
            return { productId:i.product_id, name:i.product_name,
                     price:Number(i.price), costPrice:i.cost_price?Number(i.cost_price):0,
                     quantity:i.quantity, total:Number(i.total) };
          })
      };
    });
    localStorage.setItem("acc_invoices_history", JSON.stringify(invoices));
  }

  /* وقت آخر سحب */
  localStorage.setItem("pos_last_pull", String(Date.now()));
}

/* ─── دورة المزامنة عبر Python (تُستدعى من background_sync) ─── */
async function psbRun() {
  /* لا تعمل إلا في وضع online أو parallel */
  var mode = typeof getAppMode === "function" ? getAppMode() : localStorage.getItem("pos_app_mode");
  if (mode === "offline" || !mode) return null;
  if (!navigator.onLine) return null;

  /* تحقق من توفر Python (مع كاش) */
  if (Date.now() - PSB_LAST_CHECK > PSB_CHECK_INT) {
    await psbCheck();
  }
  if (!PSB_AVAILABLE) return null;

  var queue    = typeof sqGetQueue  === "function" ? sqGetQueue()  : [];
  var stockIds = typeof sqGetStock  === "function" ? sqGetStock()  : [];

  if (!queue.length && !stockIds.length) {
    /* لا شيء للإرسال — فقط اسحب التحديثات كل 10 دقائق */
    var lastPull = Number(localStorage.getItem("pos_last_pull") || 0);
    if (Date.now() - lastPull > 10 * 60 * 1000) {
      return await psbPullAll();
    }
    return null;
  }

  var result = await psbFullSync(queue, stockIds);
  if (result && result.ok) {
    /* امسح الصف والمخزون الناجحَين */
    if (typeof sqSaveQueue  === "function") sqSaveQueue([]);
    if (typeof sqSaveStock  === "function") sqSaveStock([]);
    /* أعلم المستخدم */
    if (typeof ntfToast === "function" && result.pushed > 0) {
      ntfToast("⚡ Python Sync: تمت مزامنة " + result.pushed + " عملية بنجاح", "sync", 3000);
    }
    if (typeof updateSyncDot === "function") updateSyncDot("online");
  } else if (result && !result.ok && result.fallback) {
    /* Python غير متوفر — تراجع للمزامنة العادية */
    PSB_AVAILABLE = false;
    if (typeof bgsRun === "function") setTimeout(bgsRun, 100);
  } else if (result && !result.ok) {
    if (typeof updateSyncDot === "function") updateSyncDot("offline");
    if (result.failed > 0 && typeof ntfToast === "function") {
      ntfToast("⚠ فشل إرسال " + result.failed + " عملية — ستُعاد المحاولة", "warning", 4000);
    }
  }
  return result;
}

/* ─── تشغيل تلقائي ─── */
(function(){
  if (typeof document === "undefined") return;
  document.addEventListener("DOMContentLoaded", function(){
    if (window.location.pathname.indexOf("login") !== -1) return;
    if (window.location.pathname.indexOf("mode-select") !== -1) return;

    var mode = localStorage.getItem("pos_app_mode");
    if (mode === "offline" || !mode) return;

    /* تحقق من Python بعد 3 ثوانٍ من التحميل */
    setTimeout(psbCheck, 3000);

    /* جولة مزامنة Python كل دقيقتين إضافةً للـ JS sync */
    setInterval(function(){
      if (navigator.onLine) psbRun();
    }, 2 * 60 * 1000);

    /* مزامنة عند عودة الإنترنت */
    window.addEventListener("online", function(){
      setTimeout(psbRun, 2000);
    });
  });
})();

window.psbRun     = psbRun;
window.psbCheck   = psbCheck;
window.psbPullAll = psbPullAll;
