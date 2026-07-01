/* =========================================================
   js/db.js — طبقة البيانات v5.0
   Supabase (سحابي) + localStorage (محلي)
   + نظام Offline Queue للمزامنة التلقائية
   ========================================================= */

var SB    = null;
var SB_OK = null;

(function () {
  var cfg = window.APP_CONFIG || {};
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) {
    try { SB = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY); }
    catch (e) { SB = null; }
  }
})();

async function sbReady() {
  /* وضع بلا إنترنت الإجباري: لا تحاول أبداً */
  if (typeof isOfflineModeForced === "function" && isOfflineModeForced()) return false;
  if (!SB) return false;
  if (!navigator.onLine) { SB_OK = false; return false; }
  if (SB_OK !== null) return SB_OK;
  try {
    var r = await SB.from("products").select("id").limit(1);
    SB_OK = !r.error;
  } catch (e) { SB_OK = false; }
  return SB_OK;
}

var LS = {
  products:  "acc_products_pro",
  invoices:  "acc_invoices_history",
  customers: "acc_customers",
  employees: "acc_employees",
  expenses:  "acc_expenses",
  salaries:  "acc_salary_payments",
  activity:  "acc_activity_log",
};

function lsGet(key, fallback) {
  try { var v=localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e) { return fallback; }
}
function lsSet(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

function esc(s) {
  return String(s==null?"":s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

/* =========================================================
   إعدادات التخصيص
   ========================================================= */
var CUSTOMIZE_KEY = "pos_customize";

var CUSTOMIZE_FULL_DEFAULTS = {
  companyName:     "",
  companyPhone:    "",
  companyAddress:  "",
  companyEmail:    "",
  taxNumber:       "",
  primaryColor:    "#F57C20",
  secondaryColor:  "#6B7280",
  buttonColor:     "#F57C20",
  headingColor:    "#111827",
  invoiceTemplate: "classic",
  paperSize:       "a4",
  orientation:     "portrait",
  invoiceFooter:   "شكراً لتعاملكم معنا",
  showLogo:        true,
  logoData:        "",
  logoSize:        80,
  scanMode:        "barcode",
  fontFamily:      "Cairo",
  fontSize:        13,
  fontWeight:      "700",
  showBarcode:     false,
  showCustomer:    true,
  showNotes:       true,
  showTax:         false,
  /* v5.1 — إعدادات الطباعة */
  silentPrint:     true,
  printerName:     "",
  printCopies:     1,
  printColor:      true
};

function getCustomSettings() {
  try {
    var s = localStorage.getItem(CUSTOMIZE_KEY);
    return s ? Object.assign({}, CUSTOMIZE_FULL_DEFAULTS, JSON.parse(s)) : Object.assign({}, CUSTOMIZE_FULL_DEFAULTS);
  } catch(e) { return Object.assign({}, CUSTOMIZE_FULL_DEFAULTS); }
}

function saveCustomSettings(s) {
  localStorage.setItem(CUSTOMIZE_KEY, JSON.stringify(s));
}

/* مزامنة إعدادات التخصيص من السحابة إلى localStorage */
async function syncCustomSettingsFromCloud() {
  try {
    if (!await sbReady()) return;
    var r = await SB.from("app_settings").select("value").eq("key","customize").maybeSingle();
    if (r && r.data && r.data.value) {
      var current = {};
      try { current = JSON.parse(localStorage.getItem(CUSTOMIZE_KEY)||"{}"); } catch(e){}
      var merged = Object.assign({}, CUSTOMIZE_FULL_DEFAULTS, current, r.data.value);
      localStorage.setItem(CUSTOMIZE_KEY, JSON.stringify(merged));
    }
  } catch(e) {}
}

/* مزامنة تلقائية عند تحميل أي صفحة */
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function(){
    setTimeout(syncCustomSettingsFromCloud, 600);
  });
}

/* =========================================================
   Offline Sync Queue
   ========================================================= */
var SYNC_Q_KEY     = "pos_sync_queue";
var SYNC_STK_KEY   = "pos_sync_stock";   /* معرّفات المنتجات التي تغيّر مخزونها */

function getQueue()      { try { return JSON.parse(localStorage.getItem(SYNC_Q_KEY))||[]; } catch(e){return[];} }
function saveQueue(q)    { localStorage.setItem(SYNC_Q_KEY, JSON.stringify(q)); }
function getStockSet()   { try { return JSON.parse(localStorage.getItem(SYNC_STK_KEY))||[]; } catch(e){return[];} }
function saveStockSet(s) { localStorage.setItem(SYNC_STK_KEY, JSON.stringify(s)); }

function queueOp(op, table, data, match) {
  /* وضع بدون إنترنت: لا قائمة انتظار — البيانات محلية فقط ولا مزامنة أبداً */
  if (typeof isOfflineMode === "function" && isOfflineMode()) return;
  var q = getQueue();
  q.push({
    qid:   Date.now().toString(36) + Math.random().toString(36).slice(2,5),
    op:    op,
    table: table,
    data:  data  || null,
    match: match || null,
    at:    new Date().toISOString()
  });
  saveQueue(q);
  updateSyncIndicator();
}

function markStockChanged(productId) {
  /* وضع بدون إنترنت: لا حاجة لتسجيل تغييرات المخزون للمزامنة */
  if (typeof isOfflineMode === "function" && isOfflineMode()) return;
  var s = getStockSet();
  if (s.indexOf(productId) === -1) { s.push(productId); saveStockSet(s); }
  updateSyncIndicator();
}

function getPendingCount() { return getQueue().length + getStockSet().length; }

function updateSyncIndicator() {
  var offlineMode = typeof isOfflineMode === "function" && isOfflineMode();
  var forced      = typeof isOfflineModeForced === "function" && isOfflineModeForced();
  /* في وضع بدون إنترنت: لا مزامنة ولا عداد معلق — الحالة ثابتة "محلي" */
  if (offlineMode || forced) {
    if (typeof updateSyncDot === "function") updateSyncDot("forced");
    return; /* لا نُظهر banner أو عداد معلق */
  }
  var count  = getPendingCount();
  var online = navigator.onLine;

  var state = "online";
  if (!online)  state = "offline";
  else if (count>0) state = "pending";

  if (typeof updateSyncDot === "function") updateSyncDot(state);
  if (typeof _ntfRenderBanner === "function") _ntfRenderBanner();
}

async function syncNow() {
  if (typeof isOfflineModeForced === "function" && isOfflineModeForced()) {
    if (typeof ntfToast === "function") ntfToast("وضع بلا إنترنت مفعّل — لا مزامنة", "warning");
    return;
  }
  if (!navigator.onLine) { updateSyncIndicator(); return; }
  SB_OK = null;
  var ok = await sbReady();
  if (!ok) { updateSyncIndicator(); return; }

  if (typeof updateSyncDot === "function") updateSyncDot("syncing");

  var q = getQueue();
  var failed = [];
  var synced = 0;

  for (var i=0;i<q.length;i++) {
    var item = q[i];
    try {
      var r;
      if (item.op === "insert") {
        var rows = Array.isArray(item.data) ? item.data : [item.data];
        r = await SB.from(item.table).insert(rows);
      } else if (item.op === "upsert") {
        var rows2 = Array.isArray(item.data) ? item.data : [item.data];
        var conflict = item.table==="customers" ? "phone" : "id";
        r = await SB.from(item.table).upsert(rows2, {onConflict:conflict});
      } else if (item.op === "delete") {
        r = await SB.from(item.table).delete().match(item.match);
      } else if (item.op === "delete_invoice") {
        await SB.from("invoice_items").delete().eq("invoice_number", item.data.inv);
        r = await SB.from("invoices").delete().eq("invoice_number", item.data.inv);
      } else if (item.op === "update_invoice") {
        r = await SB.from("invoices").update(item.data.header).eq("invoice_number", item.data.inv);
        if (!r.error && item.data.items !== undefined) {
          await SB.from("invoice_items").delete().eq("invoice_number", item.data.inv);
          if (item.data.items.length)
            await SB.from("invoice_items").insert(item.data.items);
        }
      }
      if (r && r.error) { failed.push(item); } else { synced++; }
    } catch(e) { failed.push(item); }
  }

  /* مزامنة تغييرات المخزون */
  var stockIds = getStockSet();
  var failedStock = [];
  if (stockIds.length > 0) {
    var localProducts = lsGet(LS.products, DEFAULT_PRODUCTS);
    for (var j=0;j<stockIds.length;j++) {
      var pid = stockIds[j];
      var p = null;
      for (var k=0;k<localProducts.length;k++) if(localProducts[k].id===pid){p=localProducts[k];break;}
      if (p) {
        var sr = await SB.from("products").update({stock:p.stock}).eq("id",pid);
        if (sr.error) failedStock.push(pid); else synced++;
      }
    }
  }

  saveQueue(failed);
  saveStockSet(failedStock);
  updateSyncIndicator();

  if (synced > 0) {
    if (typeof toast !== "undefined") toast("✓ تمت مزامنة " + synced + " عملية مع Supabase", "success");
    logActivity("system", "مزامنة تلقائية", "تم إرسال " + synced + " عملية إلى Supabase");
  }
}

/* استمع للاتصال */
window.addEventListener("online",  function(){ SB_OK=null; updateSyncIndicator(); setTimeout(syncNow,2000); });
window.addEventListener("offline", function(){ SB_OK=false; updateSyncIndicator(); });
window.addEventListener("load",    function(){
  updateSyncIndicator();
  if (navigator.onLine && getPendingCount()>0) setTimeout(syncNow,3000);
});
setInterval(function(){ if(navigator.onLine && getPendingCount()>0) syncNow(); }, 60000);

/* =========================================================
   سجل النشاطات
   ========================================================= */
function logActivity(type, title, detail, extra) {
  var log = lsGet(LS.activity, []);
  log.unshift({
    id: Date.now().toString(), type:type, title:title,
    detail:detail||"", extra:extra||null,
    at: new Date().toISOString(),
    user:(function(){ try{var s=JSON.parse(localStorage.getItem("pos_auth_session")); return s&&s.u?s.u.name:"مجهول";} catch(e){return"مجهول";} })()
  });
  if (log.length>2000) log=log.slice(0,2000);
  lsSet(LS.activity, log);
}
function getActivityLog()  { return lsGet(LS.activity, []); }
function clearActivityLog(){
  lsSet(LS.activity, []);
  /* احذف من Supabase أيضاً إن وُجد اتصال */
  (async function(){
    try { var ok = await sbReady(); if (ok) await SB.from("activity_log").delete().neq("id", 0); } catch(e){}
  })();
}
async function deleteActivityEntry(id) {
  var log = lsGet(LS.activity, []);
  var entry = null;
  var out = [];
  for (var i=0;i<log.length;i++) {
    if (String(log[i].id) === String(id)) { entry = log[i]; continue; }
    out.push(log[i]);
  }
  lsSet(LS.activity, out);
  try {
    var ok = await sbReady();
    if (ok) {
      var nid = Number(id);
      if (!isNaN(nid) && nid > 0) await SB.from("activity_log").delete().eq("id", nid);
    }
  } catch(e){}
  return !!entry;
}

/* =========================================================
   المنتجات
   ========================================================= */
/* v5.1: لا توجد بيانات تجريبية بعد ربط Supabase.
   تُستخدم القائمة الفارغة عند عدم الاتصال أو قبل أول مزامنة. */
var DEFAULT_PRODUCTS = [];

async function getProducts() {
  if (await sbReady()) {
    try {
      var r = await SB.from("products").select("*").order("id");
      if (!r.error && r.data) {
        var mapped = r.data.map(function(p){
          /* cost_price عمود مولَّد من cost — نقرأ أيهما متاح */
          var c = (p.cost_price != null) ? p.cost_price : p.cost;
          return {id:p.id,name:p.name,price:Number(p.price),costPrice:c?Number(c):0,
                  stock:p.stock,barcode:p.barcode||"",category:p.category||"",minStock:p.min_stock!=null?p.min_stock:5};
        });
        /* تحديث الكاش المحلي ليبقى متاحاً دون اتصال */
        lsSet(LS.products, mapped);
        return mapped;
      }
      console.warn("[getProducts] Supabase error, falling back to local:", r.error);
    } catch (e) { console.warn("[getProducts] exception, falling back to local:", e); }
  }
  return lsGet(LS.products, DEFAULT_PRODUCTS);
}

async function getProductByBarcode(barcode) {
  var products = await getProducts();
  for(var i=0;i<products.length;i++) if(products[i].barcode===barcode) return products[i];
  return null;
}

async function addProduct(p) {
  /* normalize: empty barcode -> null (يتفادى تعارض القيد UNIQUE على السلاسل الفارغة) */
  var barcode = (p.barcode && String(p.barcode).trim()) ? String(p.barcode).trim() : null;
  var category = (p.category && String(p.category).trim()) ? String(p.category).trim() : "";
  var stock = (p.stock == null || isNaN(Number(p.stock))) ? 0 : Number(p.stock);
  var minStock = (p.minStock != null && !isNaN(Number(p.minStock))) ? Number(p.minStock) : 5;
  var costPrice = (p.costPrice != null && !isNaN(Number(p.costPrice))) ? Number(p.costPrice) : null;

  if (await sbReady()) {
    try {
      /* نكتب إلى cost (الفعلي). cost_price عمود مولَّد ولا يُسمح بالكتابة إليه */
      var r = await SB.from("products").insert([{
        name: p.name, price: Number(p.price), cost: costPrice,
        stock: stock, barcode: barcode, category: category, min_stock: minStock
      }]).select().single();
      if (!r.error) {
        logActivity("product","تمت إضافة منتج: "+p.name,"السعر: "+p.price+" USD");
        return true;
      }
      console.error("[addProduct] Supabase insert failed:", r.error);
      throw new Error(r.error.message || "تعذّر حفظ المنتج في القاعدة السحابية");
    } catch (e) {
      if (e && e.message && e.message.indexOf("تعذّر") === 0) throw e;
      console.warn("[addProduct] sb exception, falling back to local queue:", e);
    }
  }
  /* وضع محلي / fallback */
  var products = lsGet(LS.products, DEFAULT_PRODUCTS);
  var newP = {
    id: Date.now(),
    name: p.name, price: Number(p.price), costPrice: costPrice || 0,
    stock: stock, minStock: minStock, barcode: barcode || "", category: category
  };
  products.push(newP);
  lsSet(LS.products, products);
  queueOp("upsert","products",{id:newP.id,name:newP.name,price:newP.price,cost:costPrice,
    stock:stock,barcode:barcode,category:category,min_stock:minStock});
  logActivity("product","تمت إضافة منتج: "+p.name,"السعر: "+p.price+" USD");
  return true;
}

async function updateProduct(id, updates) {
  if (await sbReady()) {
    var payload = {};
    if(updates.name      !==undefined) payload.name       = updates.name;
    if(updates.price     !==undefined) payload.price      = updates.price;
    if(updates.costPrice !==undefined) payload.cost       = updates.costPrice;
    if(updates.stock     !==undefined) payload.stock      = updates.stock;
    if(updates.barcode   !==undefined) payload.barcode    = updates.barcode;
    if(updates.category  !==undefined) payload.category   = updates.category;
    if(updates.minStock  !==undefined) payload.min_stock  = updates.minStock;
    await SB.from("products").update(payload).eq("id",id);
    /* إصلاح: تحديث الكاش المحلي بعد نجاح التحديث السحابي */
    var products = lsGet(LS.products, DEFAULT_PRODUCTS);
    for(var i=0;i<products.length;i++)
      if(String(products[i].id)===String(id)) products[i]=Object.assign({},products[i],updates);
    lsSet(LS.products, products);
    logActivity("product","تم تعديل منتج: "+(updates.name||id));
    return;
  }
  var products = lsGet(LS.products, DEFAULT_PRODUCTS);
  for(var i=0;i<products.length;i++)
    if(products[i].id===id) products[i]=Object.assign({},products[i],updates);
  lsSet(LS.products, products);
  /* بعد التعديل المحلي نُصفّح النتيجة الكاملة للقائمة */
  var updated = null;
  for(var j=0;j<products.length;j++) if(products[j].id===id){updated=products[j];break;}
  if(updated) queueOp("upsert","products",{id:updated.id,name:updated.name,price:updated.price,
    cost:updated.costPrice||null,stock:updated.stock,barcode:updated.barcode||"",
    category:updated.category||"",min_stock:updated.minStock!=null?updated.minStock:5});
  logActivity("product","تم تعديل منتج ID: "+id);
}

async function deleteProduct(id) {
  var products = await getProducts();
  var p = products.find(function(x){return x.id===id;});
  if (await sbReady()) {
    await SB.from("products").delete().eq("id",id);
    /* إصلاح: إزالة المنتج من الكاش المحلي بعد الحذف السحابي */
    lsSet(LS.products, lsGet(LS.products,DEFAULT_PRODUCTS).filter(function(x){return x.id!==id;}));
  } else {
    lsSet(LS.products, lsGet(LS.products,DEFAULT_PRODUCTS).filter(function(x){return x.id!==id;}));
    queueOp("delete","products",null,{id:id});
  }
  if(p) logActivity("product","تم حذف منتج: "+p.name);
}

async function changeStock(id, delta) {
  if (await sbReady()) {
    var r = await SB.from("products").select("stock").eq("id",id).single();
    if (r.data && r.data.stock !== null) {
      await SB.from("products").update({stock:Math.max(0, Number(r.data.stock) + delta)}).eq("id",id);
    }
    return;
  }
  /* تحديث محلي — نتخطى المنتجات التي لا يوجد لها مخزون محدد (null = غير محدود) */
  var products = lsGet(LS.products, DEFAULT_PRODUCTS);
  for(var i=0;i<products.length;i++) {
    if(String(products[i].id) === String(id)) {
      if(products[i].stock !== null && products[i].stock !== undefined) {
        products[i].stock = Math.max(0, Number(products[i].stock) + delta);
      }
    }
  }
  lsSet(LS.products, products);
  markStockChanged(id); /* يُهمَل تلقائياً في وضع offline */
}

/* =========================================================
   الفواتير
   ========================================================= */
async function getInvoices() {
  if (await sbReady()) {
    var inv = await SB.from("invoices").select("*").order("created_at",{ascending:false});
    if (!inv.data) return [];
    var itm = await SB.from("invoice_items").select("*");
    var items = itm.data||[];
    return inv.data.map(function(v){
      return {
        invoiceNumber:v.invoice_number, date:v.date,
        paymentStatus:v.payment_status, total:Number(v.total), notes:v.notes||"",
        customer:v.customer_phone?{phone:v.customer_phone,name:v.customer_name||"",address:v.customer_address||""}:null,
        items:items.filter(function(i){return i.invoice_number===v.invoice_number;})
          .map(function(i){return{productId:i.product_id,name:i.product_name,price:Number(i.price),
            costPrice:i.cost_price?Number(i.cost_price):0,quantity:i.quantity,total:Number(i.total)};})
      };
    });
  }
  return lsGet(LS.invoices, []);
}

async function addInvoice(invoice) {
  if (await sbReady()) {
    var r = await SB.from("invoices").insert([{
      invoice_number:invoice.invoiceNumber, date:invoice.date,
      customer_phone:invoice.customer?invoice.customer.phone:null,
      customer_name:invoice.customer?(invoice.customer.name||""):"",
      customer_address:invoice.customer?(invoice.customer.address||""):"",
      payment_status:invoice.paymentStatus, total:invoice.total, notes:invoice.notes||""
    }]);
    if (!r.error) {
      if (invoice.items.length)
        await SB.from("invoice_items").insert(invoice.items.map(function(it){
          return{invoice_number:invoice.invoiceNumber,product_id:it.productId,product_name:it.name,
            price:it.price,cost_price:it.costPrice||null,quantity:it.quantity,total:it.total};
        }));
      for(var i=0;i<invoice.items.length;i++) await changeStock(invoice.items[i].productId,-invoice.items[i].quantity);
      if(invoice.customer&&invoice.customer.phone) await upsertCustomer(invoice.customer,invoice.total,invoice.date);
      /* إصلاح: حفظ الفاتورة في الكاش المحلي بعد الإدراج السحابي الناجح */
      var invoices = lsGet(LS.invoices, []); invoices.unshift(invoice); lsSet(LS.invoices, invoices);
    }
  } else {
    var invoices = lsGet(LS.invoices, []);
    invoices.unshift(invoice);
    lsSet(LS.invoices, invoices);
    /* قائمة انتظار */
    queueOp("insert","invoices",{
      invoice_number:invoice.invoiceNumber, date:invoice.date,
      customer_phone:invoice.customer?invoice.customer.phone:null,
      customer_name:invoice.customer?(invoice.customer.name||""):"",
      customer_address:invoice.customer?(invoice.customer.address||""):"",
      payment_status:invoice.paymentStatus, total:invoice.total, notes:invoice.notes||""
    });
    if (invoice.items.length)
      queueOp("insert","invoice_items",invoice.items.map(function(it){
        return{invoice_number:invoice.invoiceNumber,product_id:it.productId,product_name:it.name,
          price:it.price,cost_price:it.costPrice||null,quantity:it.quantity,total:it.total};
      }));
    for(var j=0;j<invoice.items.length;j++) await changeStock(invoice.items[j].productId,-invoice.items[j].quantity);
    if(invoice.customer&&invoice.customer.phone) await upsertCustomer(invoice.customer,invoice.total,invoice.date);
  }
  logActivity("invoice","فاتورة جديدة: "+invoice.invoiceNumber,
    "الإجمالي: "+invoice.total.toFixed(2)+" USD — "+invoice.paymentStatus,
    {invoiceNumber:invoice.invoiceNumber});
}

async function updateInvoice(invoiceNumber, updates) {
  if (await sbReady()) {
    var payload = {};
    if(updates.paymentStatus!==undefined) payload.payment_status = updates.paymentStatus;
    if(updates.total        !==undefined) payload.total          = updates.total;
    if(updates.notes        !==undefined) payload.notes          = updates.notes;
    if(updates.customer) {
      payload.customer_phone   = updates.customer.phone||null;
      payload.customer_name    = updates.customer.name||"";
      payload.customer_address = updates.customer.address||"";
    }
    if(Object.keys(payload).length) await SB.from("invoices").update(payload).eq("invoice_number",invoiceNumber);
    if(updates.items) {
      await SB.from("invoice_items").delete().eq("invoice_number",invoiceNumber);
      if(updates.items.length)
        await SB.from("invoice_items").insert(updates.items.map(function(it){
          return{invoice_number:invoiceNumber,product_id:it.productId,product_name:it.name,
            price:it.price,cost_price:it.costPrice||null,quantity:it.quantity,total:it.total};
        }));
    }
  } else {
    var invoices = lsGet(LS.invoices, []);
    for(var i=0;i<invoices.length;i++) {
      if(invoices[i].invoiceNumber===invoiceNumber) {
        if(updates.paymentStatus!==undefined) invoices[i].paymentStatus = updates.paymentStatus;
        if(updates.total        !==undefined) invoices[i].total         = updates.total;
        if(updates.notes        !==undefined) invoices[i].notes         = updates.notes;
        if(updates.customer)                  invoices[i].customer      = Object.assign({},invoices[i].customer,updates.customer);
        if(updates.items)                     invoices[i].items         = updates.items;
      }
    }
    lsSet(LS.invoices, invoices);
    var hdr = {};
    if(updates.paymentStatus!==undefined) hdr.payment_status=updates.paymentStatus;
    if(updates.total        !==undefined) hdr.total=updates.total;
    if(updates.notes        !==undefined) hdr.notes=updates.notes;
    var mappedItems = updates.items ? updates.items.map(function(it){
      return{invoice_number:invoiceNumber,product_id:it.productId,product_name:it.name,
        price:it.price,cost_price:it.costPrice||null,quantity:it.quantity,total:it.total};
    }) : undefined;
    queueOp("update_invoice",null,{inv:invoiceNumber, header:hdr, items:mappedItems});
  }
  logActivity("invoice","تم تعديل فاتورة: "+invoiceNumber,
    updates.paymentStatus?"الحالة: "+updates.paymentStatus:"تعديل بيانات");
}

async function updateInvoiceStatus(invoiceNumber, status) {
  await updateInvoice(invoiceNumber,{paymentStatus:status});
}

async function deleteInvoice(invoiceNumber, items) {
  for(var i=0;i<items.length;i++) await changeStock(items[i].productId,+items[i].quantity);
  if (await sbReady()) {
    await SB.from("invoice_items").delete().eq("invoice_number",invoiceNumber);
    await SB.from("invoices").delete().eq("invoice_number",invoiceNumber);
    /* إصلاح: إزالة الفاتورة من الكاش المحلي بعد الحذف السحابي */
    lsSet(LS.invoices, lsGet(LS.invoices,[]).filter(function(v){return v.invoiceNumber!==invoiceNumber;}));
  } else {
    lsSet(LS.invoices, lsGet(LS.invoices,[]).filter(function(v){return v.invoiceNumber!==invoiceNumber;}));
    queueOp("delete_invoice",null,{inv:invoiceNumber});
  }
  logActivity("invoice","تم حذف فاتورة: "+invoiceNumber);
}

async function generateInvoiceNumber() {
  var d = new Date();
  var dateStr = d.toISOString().slice(0,10).replace(/-/g,"");
  var invoices = await getInvoices();
  var cnt = invoices.filter(function(v){return (v.invoiceNumber||"").indexOf("WB-"+dateStr)===0;}).length;
  return "WB-"+dateStr+"-"+(cnt+1);
}

/* =========================================================
   العملاء
   ========================================================= */
async function getCustomers() {
  if (await sbReady()) {
    var r = await SB.from("customers").select("*").order("total_spent",{ascending:false});
    if (r.data) return r.data.map(function(c){
      return{phone:c.phone,name:c.name||"",address:c.address||"",
             totalSpent:Number(c.total_spent||0),visits:Number(c.visits||0),lastInvoiceDate:c.last_visit||""};
    });
    return [];
  }
  return lsGet(LS.customers, []);
}

async function addCustomer(customer) {
  if (await sbReady()) {
    await SB.from("customers").upsert([{phone:customer.phone,name:customer.name||"",address:customer.address||""}],{onConflict:"phone"});
    /* إصلاح: logActivity كانت تُستدعى في الفرع المحلي فقط */
    logActivity("customer","تمت إضافة عميل: "+(customer.name||customer.phone));
    return;
  }
  var customers = lsGet(LS.customers, []);
  if (!customers.some(function(c){return c.phone===customer.phone;})) {
    customer.totalSpent=0; customers.push(customer); lsSet(LS.customers,customers);
    queueOp("upsert","customers",{phone:customer.phone,name:customer.name||"",address:customer.address||"",total_spent:0},"phone");
  }
  logActivity("customer","تمت إضافة عميل: "+(customer.name||customer.phone));
}

async function upsertCustomer(customer, amount, date) {
  if (await sbReady()) {
    var r = await SB.from("customers").select("total_spent,visits").eq("phone",customer.phone).single();
    var prev       = r.data ? Number(r.data.total_spent||0) : 0;
    var prevVisits = r.data ? Number(r.data.visits||0)      : 0;
    await SB.from("customers").upsert([{
      phone:customer.phone, name:customer.name||"", address:customer.address||"",
      total_spent:prev+amount, last_visit:date, visits:prevVisits+1
    }],{onConflict:"phone"});
    return;
  }
  var customers = lsGet(LS.customers, []);
  var found = false;
  for(var i=0;i<customers.length;i++) {
    if(customers[i].phone===customer.phone) {
      customers[i].totalSpent=(customers[i].totalSpent||0)+amount;
      customers[i].visits=(customers[i].visits||0)+1;
      customers[i].lastInvoiceDate=date;
      if(customer.name)    customers[i].name=customer.name;
      if(customer.address) customers[i].address=customer.address;
      found=true;
    }
  }
  if(!found){customer.totalSpent=amount;customer.visits=1;customer.lastInvoiceDate=date;customers.push(customer);}
  lsSet(LS.customers,customers);
  var c2=customers.find(function(x){return x.phone===customer.phone;});
  if(c2) queueOp("upsert","customers",{
    phone:c2.phone, name:c2.name||"", address:c2.address||"",
    total_spent:c2.totalSpent||0, visits:c2.visits||1, last_visit:date
  },"phone");
}

async function deleteCustomer(phone) {
  if (await sbReady()) {
    await SB.from("customers").delete().eq("phone",phone);
    /* إصلاح: إزالة العميل من الكاش المحلي + logActivity كانت تُفقد في Cloud Mode */
    lsSet(LS.customers,lsGet(LS.customers,[]).filter(function(c){return c.phone!==phone;}));
    logActivity("customer","تم حذف عميل: "+phone);
    return;
  }
  lsSet(LS.customers,lsGet(LS.customers,[]).filter(function(c){return c.phone!==phone;}));
  queueOp("delete","customers",null,{phone:phone});
  logActivity("customer","تم حذف عميل: "+phone);
}

/* =========================================================
   الموظفون
   ========================================================= */
async function getEmployees() {
  if (await sbReady()) {
    var r = await SB.from("employees").select("*").order("id");
    if (!r.error && r.data) {
      var list = r.data.map(function(e){
        return {id:String(e.id), name:e.name, phone:e.phone||"", role:e.role||"",
                salary:Number(e.salary||0), hiredAt:e.hired_at||"", active:e.active!==false, notes:e.notes||""};
      });
      lsSet(LS.employees, list);
      return list;
    }
  }
  return lsGet(LS.employees, []);
}

async function addEmployee(emp) {
  emp.createdAt = new Date().toISOString();
  if (await sbReady()) {
    var r = await SB.from("employees").insert([{
      name:emp.name, phone:emp.phone||"", role:emp.role||"",
      salary:emp.salary||0, hired_at:emp.hiredAt||null, active:emp.active!==false, notes:emp.notes||""
    }]).select("id").single();
    if (!r.error && r.data) { emp.id = String(r.data.id); }
    else { emp.id = Date.now().toString(); }
  } else {
    emp.id = Date.now().toString();
  }
  var e = lsGet(LS.employees, []); e.push(emp); lsSet(LS.employees, e);
  logActivity("employee", "تمت إضافة موظف: "+emp.name, emp.role+" — "+emp.salary+" USD");
}

async function updateEmployee(id, upd) {
  var e = lsGet(LS.employees, []);
  for(var i=0;i<e.length;i++) if(e[i].id===id) e[i]=Object.assign({},e[i],upd);
  lsSet(LS.employees, e);
  if (await sbReady()) {
    var payload = {};
    if(upd.name    !==undefined) payload.name     = upd.name;
    if(upd.phone   !==undefined) payload.phone    = upd.phone;
    if(upd.role    !==undefined) payload.role     = upd.role;
    if(upd.salary  !==undefined) payload.salary   = upd.salary;
    if(upd.hiredAt !==undefined) payload.hired_at = upd.hiredAt||null;
    if(upd.active  !==undefined) payload.active   = upd.active;
    if(upd.notes   !==undefined) payload.notes    = upd.notes;
    var nid = Number(id);
    if(Object.keys(payload).length && !isNaN(nid) && nid>0)
      await SB.from("employees").update(payload).eq("id", nid);
  }
  logActivity("employee", "تم تعديل موظف: "+(upd.name||id));
}

async function deleteEmployee(id) {
  var e = lsGet(LS.employees, []);
  var x = e.find(function(v){return v.id===id;});
  lsSet(LS.employees, e.filter(function(v){return v.id!==id;}));
  if (await sbReady()) {
    var nid = Number(id);
    if(!isNaN(nid) && nid>0) await SB.from("employees").delete().eq("id", nid);
  }
  if(x) logActivity("employee", "تم حذف موظف: "+x.name);
}

/* =========================================================
   المصاريف
   ========================================================= */
async function getExpenses()            { return lsGet(LS.expenses,[]); }
async function addExpense(exp)          { exp.id=Date.now().toString(); exp.createdAt=new Date().toISOString(); if(!exp.date) exp.date=new Date().toISOString().slice(0,10); var e=lsGet(LS.expenses,[]); e.unshift(exp); lsSet(LS.expenses,e); logActivity("expense","مصروف جديد: "+exp.title,"المبلغ: "+exp.amount+" USD — "+exp.category); }
async function updateExpense(id,upd)    { var e=lsGet(LS.expenses,[]); for(var i=0;i<e.length;i++) if(e[i].id===id) e[i]=Object.assign({},e[i],upd); lsSet(LS.expenses,e); logActivity("expense","تم تعديل مصروف: "+(upd.title||id)); }
async function deleteExpense(id)        { var e=lsGet(LS.expenses,[]); var x=e.find(function(v){return v.id===id;}); lsSet(LS.expenses,e.filter(function(v){return v.id!==id;})); if(x) logActivity("expense","تم حذف مصروف: "+x.title); }

/* =========================================================
   الرواتب
   ========================================================= */
async function getSalaryPayments() {
  if (await sbReady()) {
    var r = await SB.from("salary_payments").select("*").order("paid_at",{ascending:false});
    if (!r.error && r.data) {
      var employees = lsGet(LS.employees, []);
      var list = r.data.map(function(p){
        var emp = employees.find(function(e){return String(e.id)===String(p.employee_id);});
        return {id:String(p.id), employeeId:String(p.employee_id),
                employeeName:emp?emp.name:"", amount:Number(p.amount||0),
                date:p.paid_at?(p.paid_at.slice(0,10)):"", period:p.period||"", notes:p.notes||""};
      });
      lsSet(LS.salaries, list);
      return list;
    }
  }
  return lsGet(LS.salaries, []);
}

async function addSalaryPayment(pmt) {
  pmt.createdAt = new Date().toISOString();
  if(!pmt.date) pmt.date = new Date().toISOString().slice(0,10);
  if (await sbReady()) {
    var nid = Number(pmt.employeeId);
    if(!isNaN(nid) && nid>0) {
      var r = await SB.from("salary_payments").insert([{
        employee_id:nid, amount:pmt.amount, paid_at:pmt.date, period:pmt.period||"", notes:pmt.notes||""
      }]).select("id").single();
      if(!r.error && r.data) pmt.id = String(r.data.id);
    }
  }
  if(!pmt.id) pmt.id = Date.now().toString();
  var p = lsGet(LS.salaries, []); p.unshift(pmt); lsSet(LS.salaries, p);
  logActivity("salary", "صرف راتب: "+pmt.employeeName, "المبلغ: "+pmt.amount+" USD — "+(pmt.period||""));
}

async function deleteSalaryPayment(id) {
  var p = lsGet(LS.salaries, []);
  var x = p.find(function(v){return v.id===id;});
  lsSet(LS.salaries, p.filter(function(v){return v.id!==id;}));
  if (await sbReady()) {
    var nid = Number(id);
    if(!isNaN(nid) && nid>0) await SB.from("salary_payments").delete().eq("id", nid);
  }
  if(x) logActivity("salary", "تم حذف دفعة راتب: "+x.employeeName);
}
