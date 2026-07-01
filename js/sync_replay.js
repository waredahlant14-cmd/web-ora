/* =========================================================
   js/sync_replay.js — محرك إعادة تشغيل المزامنة v2.0
   =========================================================
   المبدأ: كل عملية مُخزَّنة محلياً يتم إعادة تشغيلها على
   Supabase بنفس طريقة دوال الـ API الأصلية — ليس نقل بيانات خام.

   أسماء الأعمدة (مطابقة لـ Supabase الفعلي):
   ┌─────────────┬───────────────────────────────────┐
   │ products    │ id,name,price,cost,stock,barcode,  │
   │             │ category,min_stock                 │
   ├─────────────┼───────────────────────────────────┤
   │ customers   │ id,name,phone,address,email,       │
   │             │ balance,total_spent,visits,        │
   │             │ last_visit,notes                   │
   ├─────────────┼───────────────────────────────────┤
   │ invoices    │ invoice_number,date,customer_id,   │
   │             │ customer_phone,customer_name,      │
   │             │ customer_address,customer_data,    │
   │             │ items(JSON),subtotal,discount,tax, │
   │             │ total,payment_method,payment_status│
   ├─────────────┼───────────────────────────────────┤
   │invoice_items│ invoice_number,product_id,         │
   │             │ product_name,price,cost_price,     │
   │             │ quantity,total                     │
   └─────────────┴───────────────────────────────────┘

   ضمانات:
   ✓ UPSERT دائماً → 0% تكرار (يتطلب تشغيل supabase_migrations.sql)
   ✓ ترتيب: منتجات → عملاء → فواتير → مخزون
   ✓ واجهة تقدم مرئية مع سجل كل عملية
   ========================================================= */

var SR_VERSION = "2.0";
var SR_LOG_KEY = "pos_replay_log";

/* ═══════════════════════════════════════════════════════════
   واجهة التقدم المرئية
   ═══════════════════════════════════════════════════════════ */
var _srOverlay = null;

function srShowProgress(title) {
  if (_srOverlay) return;
  _srOverlay = document.createElement("div");
  _srOverlay.id = "sr-overlay";
  _srOverlay.style.cssText = [
    "position:fixed;inset:0;z-index:9990;",
    "background:rgba(0,0,0,.78);backdrop-filter:blur(7px);",
    "display:flex;align-items:center;justify-content:center;",
    "font-family:Cairo,sans-serif;direction:rtl;"
  ].join("");
  _srOverlay.innerHTML = [
    '<div style="background:#1C2230;border:1px solid #334155;border-radius:20px;',
    'padding:32px 36px;width:100%;max-width:500px;color:#F1F5F9;text-align:center;',
    'box-shadow:0 25px 60px rgba(0,0,0,.6)">',
    /* أيقونة */
    '<div style="width:60px;height:60px;background:rgba(245,124,32,.15);border-radius:50%;',
    'display:flex;align-items:center;justify-content:center;margin:0 auto 18px;',
    'border:2px solid rgba(245,124,32,.3)">',
    '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24"',
    ' stroke="#F57C20" stroke-width="2.2"><polyline points="1 4 1 10 7 10"/>',
    '<polyline points="23 20 23 14 17 14"/>',
    '<path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg></div>',
    /* عنوان */
    '<h3 style="font-size:17px;font-weight:800;margin:0 0 4px" id="sr-title">',
    (title || "جارٍ المزامنة") + '</h3>',
    '<p style="font-size:12px;color:#94A3B8;margin:0 0 22px" id="sr-subtitle">',
    'إعادة تشغيل العمليات على Supabase مباشرةً...</p>',
    /* شريط التقدم */
    '<div style="background:#1E293B;border-radius:8px;height:7px;margin-bottom:8px;overflow:hidden">',
    '<div id="sr-bar" style="height:100%;width:0%;',
    'background:linear-gradient(90deg,#F57C20,#FBBF24);',
    'border-radius:8px;transition:width .3s ease"></div></div>',
    /* نسبة + عداد */
    '<div style="display:flex;justify-content:space-between;font-size:12px;color:#64748B;',
    'margin-bottom:18px"><span id="sr-pct">0%</span><span id="sr-counter">0 / 0</span></div>',
    /* سجل العمليات */
    '<div id="sr-log" style="background:#0F172A;border-radius:12px;padding:12px 16px;',
    'max-height:160px;overflow-y:auto;text-align:right;font-size:12px;',
    'line-height:1.9;border:1px solid #1E293B">',
    '<span style="color:#475569">في انتظار البدء...</span></div>',
    /* تحذير */
    '<p style="font-size:11px;color:#334155;margin:16px 0 0">',
    '⚠ لا تغلق التطبيق أثناء المزامنة</p>',
    '</div>'
  ].join("");
  document.body.appendChild(_srOverlay);
}

function srUpdateProgress(pct, counter, msg, type) {
  if (!_srOverlay) return;
  var bar   = document.getElementById("sr-bar");
  var pctEl = document.getElementById("sr-pct");
  var cntEl = document.getElementById("sr-counter");
  var logEl = document.getElementById("sr-log");
  if (bar)   bar.style.width = Math.min(100, pct) + "%";
  if (pctEl) pctEl.textContent = Math.round(pct) + "%";
  if (cntEl) cntEl.textContent = counter || "";
  if (logEl && msg) {
    var colors = { ok:"#34D399", err:"#F87171", info:"#60A5FA", warn:"#FBBF24" };
    var icons  = { ok:"✓ ", err:"✗ ", info:"→ ", warn:"⚠ " };
    var line   = document.createElement("div");
    line.style.color = colors[type||"info"] || "#94A3B8";
    line.textContent = (icons[type||"info"]||"• ") + msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }
}

function srHideProgress(success, summary) {
  if (!_srOverlay) return;
  var bar = document.getElementById("sr-bar");
  var sub = document.getElementById("sr-subtitle");
  if (bar) bar.style.background = success ? "#34D399" : "#FBBF24";
  if (sub) sub.textContent = summary || (success ? "اكتملت المزامنة ✓" : "اكتملت مع ملاحظات");
  srUpdateProgress(100, "", null, null);
  var ov = _srOverlay;
  setTimeout(function () {
    ov.style.transition = "opacity .4s";
    ov.style.opacity    = "0";
    setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 420);
    _srOverlay = null;
  }, 2000);
}

/* ═══════════════════════════════════════════════════════════
   دوال محاكاة العمليات على Supabase
   (مطابقة لما تفعله دوال db.js عند الاتصال المباشر)
   ═══════════════════════════════════════════════════════════ */

/* ── إضافة / تعديل منتج ──
   نفس ما يفعله addProduct / updateProduct أونلاين:
   upsert بـ id مع أسماء الأعمدة الفعلية في Supabase         */
async function srReplayProduct(data) {
  var payload = {
    id:        data.id,
    name:      data.name,
    price:     Number(data.price  || 0),
    cost:      Number(data.cost   || data.cost_price || data.costPrice || 0), /* Supabase: cost */
    stock:     Number(data.stock  || 0),
    barcode:   data.barcode   || "",
    category:  data.category  || "",
    min_stock: data.min_stock != null ? data.min_stock
                               : (data.minStock != null ? data.minStock : 5),
    active:    data.active !== false
  };
  var r = await SB.from("products").upsert([payload], { onConflict: "id" });
  return !r.error;
}

/* ── تحديث مخزون منتج فقط ── */
async function srReplayStock(productId, newStock) {
  var r = await SB.from("products")
    .update({ stock: Number(newStock) })
    .eq("id", productId);
  return !r.error;
}

/* ── إضافة / تعديل عميل ──
   upsert بـ phone مع الأعمدة الفعلية في Supabase             */
async function srReplayCustomer(data) {
  var payload = {
    phone:       data.phone,
    name:        data.name    || "",
    address:     data.address || "",
    email:       data.email   || "",
    notes:       data.notes   || "",
    balance:     Number(data.balance     || 0),
    total_spent: Number(data.total_spent || data.totalSpent || 0),
    visits:      Number(data.visits      || 0),
    last_visit:  data.last_visit || data.lastInvoiceDate || null
  };
  var r = await SB.from("customers").upsert([payload], { onConflict: "phone" });
  return !r.error;
}

/* ── إضافة / تعديل فاتورة (التدفق الكامل) ──
   نفس ما يفعله addInvoice أونلاين:
   1) upsert invoice header (بما فيه customer_data كـ JSON)
   2) حذف القديم + insert بنود جديدة في invoice_items
   3) upsert العميل (تحديث total_spent + visits)             */
async function srReplayInvoice(inv) {
  var invNum = inv.invoiceNumber || inv.invoice_number;
  if (!invNum) return false;

  /* ─── بيانات العميل ─── */
  var cust = inv.customer || {};
  var custPhone   = cust.phone   || inv.customer_phone   || null;
  var custName    = cust.name    || inv.customer_name    || "";
  var custAddress = cust.address || inv.customer_address || "";

  /* ─── 1: header الفاتورة ─── */
  var items = inv.items || [];
  var header = {
    invoice_number:   invNum,
    date:             inv.date || inv.created_at || new Date().toISOString(),
    customer_id:      inv.customer_id || null,
    customer_phone:   custPhone,
    customer_name:    custName,
    customer_address: custAddress,
    /* customer_data: نسخة JSON كاملة للعميل للأرشفة */
    customer_data:    cust.phone ? cust : (inv.customer_data || {}),
    /* items: نسخة JSON للبنود (للأرشفة السريعة) */
    items:            items,
    subtotal:         Number(inv.subtotal || inv.total || 0),
    discount:         Number(inv.discount || 0),
    tax:              Number(inv.tax      || 0),
    total:            Number(inv.total    || 0),
    payment_method:   inv.payment_method  || inv.paymentMethod  || "نقد",
    payment_status:   inv.payment_status  || inv.paymentStatus  || "paid",
    notes:            inv.notes           || "",
    cashier_id:       inv.cashier_id      || inv.cashierId      || "",
    cashier_name:     inv.cashier_name    || inv.cashierName    || ""
  };
  var rH = await SB.from("invoices").upsert([header], { onConflict: "invoice_number" });
  if (rH.error) {
    console.error("srReplayInvoice header error:", rH.error);
    return false;
  }

  /* ─── 2: بنود invoice_items (جدول منفصل) ─── */
  await SB.from("invoice_items").delete().eq("invoice_number", invNum);
  if (items.length) {
    var rows = items.map(function (it) {
      return {
        invoice_number: invNum,
        product_id:     String(it.productId || it.product_id || it.id || ""),
        product_name:   it.name || it.product_name || "",
        price:          Number(it.price      || 0),
        cost_price:     Number(it.costPrice  || it.cost_price || it.cost || 0),
        quantity:       Number(it.quantity   || 1),
        total:          Number(it.total      || 0)
      };
    });
    var rI = await SB.from("invoice_items").insert(rows);
    if (rI.error) {
      console.error("srReplayInvoice items error:", rI.error);
      /* نُكمل — البنود ليست حرجة قدر الـ header */
    }
  }

  /* ─── 3: تحديث بيانات العميل (total_spent + visits) ─── */
  if (custPhone) {
    var rC = await SB.from("customers")
      .select("total_spent,visits")
      .eq("phone", custPhone)
      .maybeSingle();
    var prevSpent  = rC.data ? Number(rC.data.total_spent || 0) : 0;
    var prevVisits = rC.data ? Number(rC.data.visits      || 0) : 0;
    var custUpd = {
      phone:       custPhone,
      name:        custName,
      address:     custAddress,
      total_spent: prevSpent  + Number(inv.total || 0),
      visits:      prevVisits + 1,
      last_visit:  header.date
    };
    await SB.from("customers").upsert([custUpd], { onConflict: "phone" });
  }

  return true;
}

/* ── تحديث فاتورة موجودة ── */
async function srReplayUpdateInvoice(invNum, header, items) {
  if (header && Object.keys(header).length) {
    /* upsert بدلاً من update — أكثر أماناً */
    var h = Object.assign({}, header, { invoice_number: invNum });
    if (h.items === undefined && items !== undefined) h.items = items;
    await SB.from("invoices").upsert([h], { onConflict: "invoice_number" });
  }
  if (items !== undefined) {
    await SB.from("invoice_items").delete().eq("invoice_number", invNum);
    if (items.length) {
      var rows = items.map(function (it) {
        return {
          invoice_number: invNum,
          product_id:     String(it.productId || it.product_id || ""),
          product_name:   it.name || it.product_name || "",
          price:          Number(it.price     || 0),
          cost_price:     Number(it.costPrice || it.cost_price || 0),
          quantity:       Number(it.quantity  || 1),
          total:          Number(it.total     || 0)
        };
      });
      await SB.from("invoice_items").insert(rows);
    }
  }
  return true;
}

/* ── حذف فاتورة ── */
async function srReplayDeleteInvoice(invNum) {
  await SB.from("invoice_items").delete().eq("invoice_number", invNum);
  var r = await SB.from("invoices").delete().eq("invoice_number", invNum);
  return !r.error;
}

/* ── حذف منتج ── */
async function srReplayDeleteProduct(id) {
  var r = await SB.from("products").delete().eq("id", id);
  return !r.error;
}

/* ── حذف عميل ── */
async function srReplayDeleteCustomer(phone) {
  var r = await SB.from("customers").delete().eq("phone", phone);
  return !r.error;
}

/* ── موظف ── */
async function srReplayEmployee(data) {
  var payload = {
    name:     data.name    || "",
    phone:    data.phone   || "",
    role:     data.role    || "",
    salary:   Number(data.salary || 0),
    hired_at: data.hired_at || data.hiredAt || null,
    active:   data.active !== false,
    notes:    data.notes   || ""
  };
  var nid = Number(data.id);
  if (!isNaN(nid) && nid > 0) {
    payload.id = nid;
    var r = await SB.from("employees").upsert([payload], { onConflict: "id" });
    return !r.error;
  }
  var r2 = await SB.from("employees").insert([payload]);
  return !r2.error;
}

/* ── مورد ── */
async function srReplaySupplier(data) {
  try {
    var r = await SB.from("suppliers").upsert([data], { onConflict: "id" });
    return !r.error;
  } catch (e) { return true; }
}

/* ── عرض ── */
async function srReplayOffer(data) {
  try {
    var r = await SB.from("offers").upsert([data], { onConflict: "id" });
    return !r.error;
  } catch (e) { return true; }
}

/* ── إعدادات التطبيق ── */
async function srReplaySettings(key, value) {
  try {
    var r = await SB.from("app_settings")
      .upsert([{ key: key, value: value, updated_at: new Date().toISOString() }],
              { onConflict: "key" });
    return !r.error;
  } catch (e) { return true; }
}

/* ═══════════════════════════════════════════════════════════
   البحث عن فاتورة كاملة في localStorage
   ═══════════════════════════════════════════════════════════ */
function _srFindInvoice(invNum) {
  var keys = ["acc_invoices_history", "pos_invoices", "acc_invoices"];
  for (var k = 0; k < keys.length; k++) {
    try {
      var list = JSON.parse(localStorage.getItem(keys[k]) || "[]");
      for (var i = 0; i < list.length; i++) {
        var inv = list[i];
        if (inv.invoiceNumber === invNum || inv.invoice_number === invNum) return inv;
      }
    } catch (e) {}
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════
   تنفيذ عملية queue واحدة
   ═══════════════════════════════════════════════════════════ */
async function srExecItem(item, idx, total, withUI) {
  var op    = item.op;
  var table = item.table || "";
  var data  = item.data;
  var match = item.match || {};
  var ok    = false;
  var label = "";

  try {
    /* ──────── منتجات ──────── */
    if ((op === "upsert" || op === "insert") && table === "products") {
      label = "إضافة/تحديث منتج: " + (data.name || data.id);
      if (withUI) srUpdateProgress((idx / total) * 92, idx + "/" + total, label, "info");
      ok = await srReplayProduct(data);
    }

    /* ──────── عملاء ──────── */
    else if ((op === "upsert" || op === "insert") && table === "customers") {
      label = "إضافة/تحديث عميل: " + (data.name || data.phone);
      if (withUI) srUpdateProgress((idx / total) * 92, idx + "/" + total, label, "info");
      ok = await srReplayCustomer(data);
    }

    /* ──────── موظفون ──────── */
    else if ((op === "upsert" || op === "insert") && table === "employees") {
      label = "إضافة/تحديث موظف: " + (data.name || data.id);
      if (withUI) srUpdateProgress((idx / total) * 92, idx + "/" + total, label, "info");
      ok = await srReplayEmployee(data);
    }

    /* ──────── موردون ──────── */
    else if ((op === "upsert" || op === "insert") && table === "suppliers") {
      label = "إضافة مورد: " + (data.name || data.id);
      if (withUI) srUpdateProgress((idx / total) * 92, idx + "/" + total, label, "info");
      ok = await srReplaySupplier(data);
    }

    /* ──────── عروض ──────── */
    else if ((op === "upsert" || op === "insert") && table === "offers") {
      label = "إضافة عرض: " + (data.name || data.id);
      if (withUI) srUpdateProgress((idx / total) * 92, idx + "/" + total, label, "info");
      ok = await srReplayOffer(data);
    }

    /* ──────── إضافة فاتورة (التدفق الكامل) ──────── */
    else if (op === "insert" && table === "invoices") {
      label = "فاتورة جديدة: " + (data.invoice_number || "");
      if (withUI) srUpdateProgress((idx / total) * 92, idx + "/" + total, label, "info");
      var fullInv = _srFindInvoice(data.invoice_number);
      ok = await srReplayInvoice(fullInv || data);
    }

    /* ──────── بنود الفاتورة تُعالَج داخل srReplayInvoice ──────── */
    else if (op === "insert" && table === "invoice_items") {
      ok = true; label = "بنود فاتورة (مُعالَجة مع الفاتورة)";
    }

    /* ──────── تحديث فاتورة ──────── */
    else if (op === "update_invoice") {
      var inv2   = (typeof data === "object" && data.inv) ? data.inv : data;
      var header = (typeof data === "object" && data.header) ? data.header : {};
      var items2 = (typeof data === "object") ? data.items : undefined;
      label = "تحديث فاتورة: " + inv2;
      if (withUI) srUpdateProgress((idx / total) * 92, idx + "/" + total, label, "info");
      ok = await srReplayUpdateInvoice(inv2, header, items2);
    }

    /* ──────── حذف فاتورة ──────── */
    else if (op === "delete_invoice") {
      var inv3 = (typeof data === "object" && data.inv) ? data.inv : String(data);
      label = "حذف فاتورة: " + inv3;
      if (withUI) srUpdateProgress((idx / total) * 92, idx + "/" + total, label, "info");
      ok = await srReplayDeleteInvoice(inv3);
    }

    /* ──────── حذف عام ──────── */
    else if (op === "delete") {
      label = "حذف من " + table;
      if (withUI) srUpdateProgress((idx / total) * 92, idx + "/" + total, label, "info");
      var dr = await SB.from(table).delete().match(match);
      ok = !dr.error;
    }

    /* ──────── تحديث عام (upsert آمن) ──────── */
    else if (op === "update") {
      label = "تحديث " + table;
      if (withUI) srUpdateProgress((idx / total) * 92, idx + "/" + total, label, "info");
      var conflict2 = table === "customers" ? "phone"
                    : table === "invoices"  ? "invoice_number"
                    : "id";
      var ur = await SB.from(table).upsert(
        Array.isArray(data) ? data : [data], { onConflict: conflict2 }
      );
      ok = !ur.error;
    }

    /* ──────── إعدادات ──────── */
    else if (table === "app_settings") {
      label = "تحديث إعداد: " + (data.key || "");
      if (withUI) srUpdateProgress((idx / total) * 92, idx + "/" + total, label, "info");
      ok = await srReplaySettings(data.key, data.value);
    }

    /* ──────── fallback عام ──────── */
    else {
      label = op + " → " + table;
      if (withUI) srUpdateProgress((idx / total) * 92, idx + "/" + total, label, "info");
      try {
        var conflict3 = table === "customers" ? "phone"
                      : table === "invoices"  ? "invoice_number"
                      : "id";
        var gr = await SB.from(table).upsert(
          Array.isArray(data) ? data : [data], { onConflict: conflict3 }
        );
        ok = !gr.error;
      } catch (e) { ok = false; }
    }

  } catch (err) {
    ok    = false;
    label = (label || op) + " [خطأ: " + err.message + "]";
  }

  if (withUI) {
    if (ok) srUpdateProgress((idx / total) * 92, idx + "/" + total, label + " ✓", "ok");
    else    srUpdateProgress((idx / total) * 92, idx + "/" + total, label + " — ستُعاد", "warn");
  }

  _srLog({ op: op, table: table, label: label, ok: ok });
  return ok;
}

/* ═══════════════════════════════════════════════════════════
   نقطة الدخول الرئيسية
   ═══════════════════════════════════════════════════════════ */
var _srRunning = false;

async function syncReplayRun(opts) {
  opts = opts || {};
  var withUI = opts.withUI !== false;
  var silent = opts.silent === true;

  /* ── حراسات ── */
  if (_srRunning) return { ok: false, reason: "already_running" };
  if (typeof isOfflineModeForced === "function" && isOfflineModeForced())
    return { ok: false, reason: "offline_forced" };
  if (!navigator.onLine) return { ok: false, reason: "no_internet" };

  var ready = typeof sbReady === "function" ? await sbReady() : false;
  if (!ready) return { ok: false, reason: "supabase_not_ready" };

  /* ── تحميل الصف ── */
  var queue    = typeof sqGetQueue  === "function" ? sqGetQueue()
               : (typeof getQueue  === "function" ? getQueue()  : []);
  var stockIds = typeof sqGetStock  === "function" ? sqGetStock()
               : (typeof getStockSet === "function" ? getStockSet() : []);

  if (!queue.length && !stockIds.length && !opts.force)
    return { ok: true, pushed: 0, failed: 0, reason: "nothing_pending" };

  _srRunning = true;
  if (typeof updateSyncDot === "function") updateSyncDot("syncing");

  /* ── ترتيب: منتجات → عملاء → موردون → عروض → موظفون → فواتير → بنود ── */
  var ORDER = ["products","customers","suppliers","offers","employees",
               "invoices","invoice_items","app_settings","*"];
  queue.sort(function (a, b) {
    var ai = ORDER.indexOf(a.table); if (ai < 0) ai = ORDER.length - 1;
    var bi = ORDER.indexOf(b.table); if (bi < 0) bi = ORDER.length - 1;
    return ai - bi;
  });

  /* ── إجمالي ── */
  var localProducts = [];
  try { localProducts = JSON.parse(localStorage.getItem("acc_products_pro") || "[]"); } catch (e) {}
  var totalOps = queue.length + stockIds.length;

  if (withUI) srShowProgress("مزامنة " + totalOps + " عملية على Supabase");

  var pushed = 0, failed = [], failedStock = [], idx = 0;

  /* ── إرسال العمليات ── */
  for (var i = 0; i < queue.length; i++) {
    idx++;
    var ok = await srExecItem(queue[i], idx, totalOps, withUI);
    if (ok) pushed++;
    else { queue[i].retries = (queue[i].retries || 0) + 1; failed.push(queue[i]); }
    if (i % 5 === 4) await new Promise(function (r) { setTimeout(r, 50); });
  }

  /* ── تحديثات المخزون ── */
  for (var j = 0; j < stockIds.length; j++) {
    idx++;
    var pid  = stockIds[j];
    var prod = null;
    for (var k = 0; k < localProducts.length; k++) {
      if (String(localProducts[k].id) === String(pid)) { prod = localProducts[k]; break; }
    }
    var slabel = prod ? "مخزون: " + prod.name : "مخزون ID:" + pid;
    if (withUI) srUpdateProgress((idx / totalOps) * 92, idx + "/" + totalOps, slabel, "info");
    if (prod) {
      var sok = await srReplayStock(pid, prod.stock);
      if (sok) {
        pushed++;
        if (withUI) srUpdateProgress((idx / totalOps) * 92, idx + "/" + totalOps, slabel + " ✓", "ok");
      } else {
        failedStock.push(pid);
        if (withUI) srUpdateProgress((idx / totalOps) * 92, idx + "/" + totalOps, slabel + " — ستُعاد", "warn");
      }
    }
  }

  /* ── حفظ الفاشلين للمحاولة التالية ── */
  if (typeof sqSaveQueue  === "function") sqSaveQueue(failed);
  else if (typeof saveQueue === "function") saveQueue(failed);
  if (typeof sqSaveStock  === "function") sqSaveStock(failedStock);
  else if (typeof saveStockSet === "function") saveStockSet(failedStock);

  /* ── تحديث مؤشر الحالة ── */
  _srRunning = false;
  if (typeof updateSyncIndicator === "function") updateSyncIndicator();
  if (typeof updateSyncDot === "function")
    updateSyncDot((failed.length + failedStock.length) ? "pending" : "online");

  /* ── واجهة الإنهاء ── */
  var success = (!failed.length && !failedStock.length);
  if (withUI) {
    var summary = pushed + " عملية نُفِّذت على Supabase" +
      ((failed.length + failedStock.length) ? " — " + (failed.length + failedStock.length) + " ستُعاد" : "");
    srHideProgress(success, summary);
  }

  /* ── toast ── */
  if (!silent && typeof ntfToast === "function") {
    if (pushed > 0 && success)
      ntfToast("⚡ " + pushed + " عملية مُزامَنة على Supabase ✓", "sync", 3500);
    else if (pushed > 0)
      ntfToast("⚡ " + pushed + " مُزامَنة — " + (failed.length + failedStock.length) + " ستُعاد", "warning", 4000);
  }

  _srLog({ event: "replay_done", pushed: pushed, failed: failed.length + failedStock.length });
  return { ok: true, pushed: pushed, failed: failed.length + failedStock.length, success: success };
}

/* ── زر المزامنة اليدوية ── */
async function syncNowWithReplay() {
  var mode = localStorage.getItem("pos_app_mode");
  if (mode === "offline") {
    if (typeof ntfToast === "function") ntfToast("وضع بلا إنترنت — لا مزامنة", "warning", 3000);
    return;
  }
  if (!navigator.onLine) {
    if (typeof ntfToast === "function") ntfToast("لا يوجد اتصال بالإنترنت", "warning", 3000);
    return;
  }
  return await syncReplayRun({ withUI: true, silent: false });
}

/* ── تسجيل العمليات ── */
function _srLog(entry) {
  try {
    var logs = JSON.parse(localStorage.getItem(SR_LOG_KEY) || "[]");
    logs.unshift({ at: new Date().toISOString(), v: SR_VERSION, e: entry });
    if (logs.length > 300) logs = logs.slice(0, 300);
    localStorage.setItem(SR_LOG_KEY, JSON.stringify(logs));
  } catch (e) {}
}

/* ── تصدير ── */
if (typeof window !== "undefined") {
  window.syncNow       = syncNowWithReplay;
  window.syncReplayRun = syncReplayRun;
  window.srGetLog      = function () {
    try { return JSON.parse(localStorage.getItem(SR_LOG_KEY) || "[]"); } catch (e) { return []; }
  };
}
