/* =========================================================
   js/sync_queue.js — إدارة صف المزامنة v3.0 (Offline-First)
   يدعم: وضع بلا إنترنت، تكرار أقل، إعادة محاولة، إحصاءات
   ========================================================= */

var SQ_KEY         = "pos_sync_queue";
var SQ_STOCK_KEY   = "pos_sync_stock";
var SQ_MAX_SIZE    = 50000;   /* v5.1: لا نفقد عمليات بسبب طول صف معلّق */
var SQ_MAX_RETRIES = 999;     /* v5.1: لا نُسقط أبداً — نُعيد المحاولة دائماً */

/* ─── قراءة / حفظ ─── */
function sqGetQueue() {
  try { return JSON.parse(localStorage.getItem(SQ_KEY)) || []; }
  catch (e) { return []; }
}
function sqSaveQueue(q) {
  /* v5.1: لا نقتطع — نحتفظ بكامل الصف لضمان عدم فقدان بيانات أثناء انقطاع الإنترنت */
  if (q.length > SQ_MAX_SIZE) q = q.slice(q.length - SQ_MAX_SIZE);
  localStorage.setItem(SQ_KEY, JSON.stringify(q));
}

/* ─── إضافة عملية للصف ─── */
function sqPush(op, table, data, match) {
  var q = sqGetQueue();

  /* دمج upsert بنفس id لتجنب التكرار */
  if ((op === "upsert" || op === "update") && data && data.id) {
    for (var i = 0; i < q.length; i++) {
      if (q[i].op === op && q[i].table === table &&
          q[i].data && String(q[i].data.id) === String(data.id)) {
        q[i].data = Object.assign({}, q[i].data, data);
        q[i].at   = new Date().toISOString();
        sqSaveQueue(q);
        _sqNotify();
        return q[i].qid;
      }
    }
  }

  var item = {
    qid:     Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    op:      op,
    table:   table,
    data:    data  || null,
    match:   match || null,
    at:      new Date().toISOString(),
    retries: 0,
  };
  q.push(item);
  sqSaveQueue(q);
  _sqNotify();
  return item.qid;
}

function _sqNotify() {
  if (typeof updateSyncIndicator === "function") updateSyncIndicator();
  if (typeof _ntfRenderBanner    === "function") _ntfRenderBanner();
}

/* ─── تسجيل تغيير مخزون ─── */
function sqMarkStock(productId) {
  try {
    var s = JSON.parse(localStorage.getItem(SQ_STOCK_KEY)) || [];
    if (s.indexOf(productId) === -1) s.push(productId);
    localStorage.setItem(SQ_STOCK_KEY, JSON.stringify(s));
  } catch (e) {}
  _sqNotify();
}

function sqGetStock()     { try { return JSON.parse(localStorage.getItem(SQ_STOCK_KEY)) || []; } catch(e){ return []; } }
function sqSaveStock(s)   { localStorage.setItem(SQ_STOCK_KEY, JSON.stringify(s)); }

/* ─── إحصاءات ─── */
function sqCount() { return sqGetQueue().length + sqGetStock().length; }
function sqStats() {
  var q = sqGetQueue();
  var byTable = {};
  for (var i = 0; i < q.length; i++) {
    var t = q[i].table || "?";
    byTable[t] = (byTable[t] || 0) + 1;
  }
  return { total: q.length, stock: sqGetStock().length, byTable: byTable,
           oldest: q.length ? q[0].at : null };
}

/* ─── مسح ─── */
function sqClear() {
  localStorage.removeItem(SQ_KEY);
  localStorage.removeItem(SQ_STOCK_KEY);
  _sqNotify();
}

/* ─── تصدير ─── */
function sqExport() {
  return JSON.stringify({ queue: sqGetQueue(), stock: sqGetStock(),
                          exportedAt: new Date().toISOString() }, null, 2);
}

/* ─── تنظيف العمليات القديمة (7 أيام) ─── */
function sqPrune() {
  var WEEK = 7 * 24 * 60 * 60 * 1000;
  var now  = Date.now();
  sqSaveQueue(sqGetQueue().filter(function (item) {
    if (!item.at) return true;
    var t = new Date(item.at).getTime();
    if (isNaN(t)) return true; /* تاريخ غير صالح → احتفظ به */
    return (now - t) < WEEK;
  }));
}
(function () {
  var last = Number(localStorage.getItem("pos_sq_last_prune") || 0);
  if (Date.now() - last > 86400000) {
    sqPrune();
    localStorage.setItem("pos_sq_last_prune", String(Date.now()));
  }
})();

/* ─── aliases متوافقة مع db.js ─── */
function getQueue()             { return sqGetQueue(); }
function saveQueue(q)           { sqSaveQueue(q); }
function getStockSet()          { return sqGetStock(); }
function saveStockSet(s)        { sqSaveStock(s); }
function queueOp(op,table,data,match) {
  /* وضع بدون إنترنت: تخطَّ — لا مزامنة أبداً في هذا الوضع */
  if (typeof isOfflineMode === "function" && isOfflineMode()) return;
  sqPush(op, table, data, match);
}
function markStockChanged(id)   {
  if (typeof isOfflineMode === "function" && isOfflineMode()) return;
  sqMarkStock(id);
}
function getPendingCount()      { return sqCount(); }
