/* =========================================================
   js/background_sync.js — المزامنة التلقائية في الخلفية v4.0
   يستخدم sync_replay.js لإعادة تشغيل العمليات على Supabase
   بنفس طريقة الدوال الأصلية (addProduct, addInvoice, ...)
   وليس نقل بيانات خام.
   ========================================================= */

var BGS_INTERVAL_MS   = 2 * 60 * 1000;   /* كل دقيقتين */
var BGS_PULL_KEY      = "pos_last_pull";
var BGS_PULL_INTERVAL = 10 * 60 * 1000;  /* سحب كل 10 دقائق */
var _bgsTimer         = null;
var _bgsRunning       = false;

var BGS_STATE = {
  lastSync:    null,
  lastError:   null,
  totalSynced: 0,
  failedItems: 0,
  pullDone:    false,
};

/* ─── سحب تحديثات من السحابة إلى localStorage ─── */
async function bgsPullUpdates() {
  var lastPull = Number(localStorage.getItem(BGS_PULL_KEY) || 0);
  if (Date.now() - lastPull < BGS_PULL_INTERVAL) return;

  try {
    /* منتجات */
    var rProd = await SB.from("products").select("*").order("id");
    if (!rProd.error && rProd.data && typeof lsSet === "function") {
      lsSet(LS.products, rProd.data.map(function(p){
        return { id:p.id, name:p.name, price:Number(p.price),
          costPrice:(p.cost_price!=null?Number(p.cost_price):(p.cost!=null?Number(p.cost):0)), stock:p.stock,
          barcode:p.barcode||"", category:p.category||"",
          minStock:p.min_stock!=null?p.min_stock:5 };
      }));
    }

    /* عملاء */
    var rCust = await SB.from("customers").select("*");
    if (!rCust.error && rCust.data && typeof lsSet === "function") {
      lsSet(LS.customers, rCust.data.map(function(c){
        return { phone:c.phone, name:c.name||"", address:c.address||"",
          totalSpent:Number(c.total_spent||0), visits:Number(c.visits||0),
          lastInvoiceDate:c.last_visit||"" };
      }));
    }

    /* إعدادات التخصيص */
    try {
      var rSet = await SB.from("app_settings").select("value").eq("key","customize").maybeSingle();
      if (rSet && rSet.data && rSet.data.value) {
        var cur = {};
        try { cur = JSON.parse(localStorage.getItem("pos_customize")||"{}"); } catch(e){}
        localStorage.setItem("pos_customize", JSON.stringify(Object.assign({}, cur, rSet.data.value)));
      }
    } catch(e) {}

    localStorage.setItem(BGS_PULL_KEY, String(Date.now()));
    BGS_STATE.pullDone = true;
  } catch(e) { /* فشل السحب — ليس حرجاً */ }
}

/* ─── دورة المزامنة الكاملة ─── */
async function bgsRun() {
  /* حراسات */
  if (typeof isOfflineModeForced === "function" && isOfflineModeForced()) return;
  if (!navigator.onLine) {
    if (typeof updateSyncDot === "function") updateSyncDot("offline");
    return;
  }
  if (_bgsRunning) return;

  var ready = typeof sbReady === "function" ? await sbReady() : false;
  if (!ready) {
    if (typeof updateSyncDot === "function") updateSyncDot("offline");
    return;
  }

  var pending = typeof getPendingCount === "function" ? getPendingCount() : 0;
  if (pending === 0 && BGS_STATE.pullDone) return;

  _bgsRunning = true;
  if (typeof updateSyncDot === "function") updateSyncDot("syncing");

  try {
    /* ── استخدم محرك إعادة التشغيل إن كان متاحاً ── */
    var result;
    if (typeof syncReplayRun === "function") {
      /* بدون واجهة في الخلفية — toast فقط */
      result = await syncReplayRun({ withUI: false, silent: false });
    } else {
      /* fallback: المزامنة القديمة */
      result = await _bgsFallbackSync();
    }

    var synced = result ? (result.pushed || 0) : 0;
    var failed = result ? (result.failed || 0) : 0;

    BGS_STATE.lastSync     = new Date().toISOString();
    BGS_STATE.totalSynced += synced;
    BGS_STATE.failedItems  = failed;
    BGS_STATE.lastError    = null;

    /* سحب تحديثات من السحابة */
    await bgsPullUpdates();
    if (typeof updateSyncDot === "function") updateSyncDot("online");

  } catch(e) {
    BGS_STATE.lastError = e.message;
    if (typeof updateSyncDot === "function") updateSyncDot("offline");
  } finally {
    _bgsRunning = false;
    if (typeof updateSyncIndicator === "function") updateSyncIndicator();
    if (typeof _ntfRenderBanner    === "function") _ntfRenderBanner();
  }
}

/* ── fallback للمزامنة القديمة إذا لم يُحمَّل sync_replay ── */
async function _bgsFallbackSync() {
  var q = typeof getQueue === "function" ? getQueue() : [];
  var pushed = 0, failed = [];
  for (var i = 0; i < q.length; i++) {
    var item = q[i];
    try {
      var r;
      if (item.op === "insert") {
        r = await SB.from(item.table).upsert(Array.isArray(item.data)?item.data:[item.data],
          {onConflict: item.table==="customers"?"phone":"id"});
      } else if (item.op === "upsert") {
        r = await SB.from(item.table).upsert(Array.isArray(item.data)?item.data:[item.data],
          {onConflict: item.table==="customers"?"phone":"id"});
      } else if (item.op === "delete") {
        /* حماية: لا تنفّذ delete بدون شرط match واضح (يمسح الجدول بأكمله) */
        if (!item.match || typeof item.match !== "object" || !Object.keys(item.match).length) {
          console.warn("[bgs] تجاهل عملية حذف بدون match:", item); continue;
        }
        r = await SB.from(item.table).delete().match(item.match);
      } else if (item.op === "delete_invoice") {
        await SB.from("invoice_items").delete().eq("invoice_number", item.data.inv);
        r = await SB.from("invoices").delete().eq("invoice_number", item.data.inv);
      } else if (item.op === "update_invoice") {
        r = await SB.from("invoices").update(item.data.header).eq("invoice_number", item.data.inv);
        if (!r.error && item.data.items !== undefined) {
          await SB.from("invoice_items").delete().eq("invoice_number", item.data.inv);
          if (item.data.items.length) await SB.from("invoice_items").insert(item.data.items);
        }
      }
      if (r && r.error) { item.retries=(item.retries||0)+1; failed.push(item); }
      else pushed++;
    } catch(e) { item.retries=(item.retries||0)+1; failed.push(item); }
  }

  /* مخزون */
  var stockIds = typeof getStockSet === "function" ? getStockSet() : [];
  var failedStock = [];
  var local = typeof lsGet === "function" ? lsGet(LS.products, []) : [];
  for (var j = 0; j < stockIds.length; j++) {
    var pid = stockIds[j];
    var p = local.find(function(x){return String(x.id)===String(pid);});
    if (p) {
      try {
        var sr = await SB.from("products").update({stock:p.stock}).eq("id",pid);
        if (sr.error) failedStock.push(pid); else pushed++;
      } catch(e) { failedStock.push(pid); }
    }
  }

  /* دمج: ابقِ على أي عمليات جديدة أُضيفت إلى الطابور أثناء عمل حلقة المزامنة */
  if (typeof saveQueue === "function") {
    var currentNow = typeof getQueue === "function" ? getQueue() : [];
    var origIds = {}; for (var k = 0; k < q.length; k++) if (q[k] && q[k].id != null) origIds[q[k].id] = true;
    var added = currentNow.filter(function (it) { return !it || it.id == null || !origIds[it.id]; });
    saveQueue(failed.concat(added));
  }
  if (typeof saveStockSet === "function") saveStockSet(failedStock);
  if (pushed > 0 && typeof ntfToast === "function") {
    ntfToast("✓ تمت مزامنة " + pushed + " عملية", "sync", 3000);
  }
  return { pushed, failed: failed.length + failedStock.length };
}

/* ─── بدء / إيقاف المزامنة التلقائية ─── */
function bgsStart() {
  if (_bgsTimer) clearInterval(_bgsTimer);
  var mode = localStorage.getItem("pos_app_mode");
  if (mode === "offline") return; /* لا نبدأ في الوضع المحلي */

  setTimeout(function(){
    if (navigator.onLine && !(typeof isOfflineModeForced==="function" && isOfflineModeForced())) bgsRun();
  }, 5000);

  _bgsTimer = setInterval(function(){
    if (navigator.onLine && !(typeof isOfflineModeForced==="function" && isOfflineModeForced())) bgsRun();
  }, BGS_INTERVAL_MS);
}
function bgsStop() {
  if (_bgsTimer) { clearInterval(_bgsTimer); _bgsTimer = null; }
}

/* ─── مزامنة عند العودة للإنترنت ─── */
window.addEventListener("online", function(){
  if (typeof isOfflineModeForced === "function" && isOfflineModeForced()) return;
  if (localStorage.getItem("pos_app_mode") === "offline") return;
  try { if (typeof SB_OK !== "undefined") SB_OK = null; } catch(e){}
  BGS_STATE.pullDone = false;
  setTimeout(bgsRun, 1500);
});

/* ─── تشغيل تلقائي ─── */
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function(){
    if (window.location.pathname.indexOf("login")       !== -1) return;
    if (window.location.pathname.indexOf("mode-select") !== -1) return;
    bgsStart();
  });
}

/* ─── حالة المزامنة (للإعدادات) ─── */
function getBgsStatus() {
  return {
    lastSync:      BGS_STATE.lastSync,
    lastError:     BGS_STATE.lastError,
    totalSynced:   BGS_STATE.totalSynced,
    failedItems:   BGS_STATE.failedItems,
    pending:       typeof getPendingCount === "function" ? getPendingCount() : 0,
    online:        navigator.onLine,
    forcedOffline: typeof isOfflineModeForced === "function" ? isOfflineModeForced() : false,
    engine:        typeof syncReplayRun === "function" ? "replay_v1" : "fallback"
  };
}
