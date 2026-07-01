/* =========================================================
   js/suppliers.js — طبقة بيانات الموردين v1.0
   Supabase (سحابي) + localStorage (محلي)
   ========================================================= */

var LS_SUPPLIERS     = "acc_suppliers";
var LS_SUP_INVOICES  = "acc_supplier_invoices";
var LS_SUP_PAYMENTS  = "acc_supplier_payments";

/* ═══════════════════════════════
   الموردون
══════════════════════════════════ */
async function getSuppliers() {
  if (await sbReady()) {
    var r = await SB.from("suppliers").select("*").order("name");
    if (r.data) return r.data.map(_mapSupplier);
    return [];
  }
  return lsGet(LS_SUPPLIERS, []);
}

async function addSupplier(s) {
  var payload = { name: s.name, phone: s.phone || "", address: s.address || "",
                  email: s.email || "", balance: 0, notes: s.notes || "" };
  if (await sbReady()) {
    var r = await SB.from("suppliers").insert([payload]).select().single();
    if (!r.error) logActivity("supplier", "تمت إضافة مورد: " + s.name);
    return r.error ? null : _mapSupplier(r.data);
  }
  payload.id = Date.now();
  var list = lsGet(LS_SUPPLIERS, []);
  list.push(payload);
  lsSet(LS_SUPPLIERS, list);
  queueOp("upsert", "suppliers", payload);
  logActivity("supplier", "تمت إضافة مورد: " + s.name);
  return _mapSupplier(payload);
}

async function updateSupplier(id, s) {
  var payload = { name: s.name, phone: s.phone || "", address: s.address || "",
                  email: s.email || "", notes: s.notes || "" };
  if (await sbReady()) {
    await SB.from("suppliers").update(payload).eq("id", id);
    logActivity("supplier", "تم تعديل مورد: " + s.name);
    return;
  }
  var list = lsGet(LS_SUPPLIERS, []);
  for (var i = 0; i < list.length; i++)
    if (list[i].id === id) list[i] = Object.assign({}, list[i], payload);
  lsSet(LS_SUPPLIERS, list);
  queueOp("upsert", "suppliers", Object.assign({ id: id }, payload));
  logActivity("supplier", "تم تعديل مورد: " + s.name);
}

async function deleteSupplier(id) {
  if (await sbReady()) {
    await SB.from("suppliers").delete().eq("id", id);
  } else {
    lsSet(LS_SUPPLIERS, lsGet(LS_SUPPLIERS, []).filter(function (s) { return String(s.id) !== String(id); }));
    queueOp("delete", "suppliers", null, { id: id });
  }
  logActivity("supplier", "تم حذف مورد ID: " + id);
}

async function _updateSupplierBalance(supplierId) {
  var invoices = await getSupplierInvoices(supplierId);
  var payments = await getSupplierPayments(supplierId);
  var totalInvoiced = invoices.reduce(function (a, b) { return a + b.total; }, 0);
  var totalPaid     = payments.reduce(function (a, b) { return a + b.amount; }, 0);
  var balance       = totalInvoiced - totalPaid;
  if (await sbReady()) {
    await SB.from("suppliers").update({ balance: balance }).eq("id", supplierId);
  } else {
    var list = lsGet(LS_SUPPLIERS, []);
    for (var i = 0; i < list.length; i++)
      if (list[i].id === supplierId) list[i].balance = balance;
    lsSet(LS_SUPPLIERS, list);
  }
}

/* ═══════════════════════════════
   فواتير الموردين
══════════════════════════════════ */
async function getSupplierInvoices(supplierId) {
  if (await sbReady()) {
    var q = SB.from("supplier_invoices").select("*").order("date", { ascending: false });
    if (supplierId) q = q.eq("supplier_id", supplierId);
    var r = await q;
    if (!r.data) return [];
    var inv = r.data.map(_mapSupInvoice);
    /* جلب البنود */
    for (var i = 0; i < inv.length; i++) {
      var ri = await SB.from("supplier_invoice_items")
        .select("*").eq("supplier_invoice_id", inv[i].id);
      inv[i].items = ri.data ? ri.data.map(_mapSupItem) : [];
    }
    return inv;
  }
  var all = lsGet(LS_SUP_INVOICES, []);
  if (supplierId) all = all.filter(function (v) { return v.supplierId === supplierId; });
  return all;
}

async function addSupplierInvoice(inv) {
  var invNum = "SUP-" + Date.now().toString(36).toUpperCase();
  var header = {
    supplier_id:     inv.supplierId,
    invoice_number:  invNum,
    date:            inv.date || new Date().toISOString().slice(0, 10),
    total:           inv.total || 0,
    paid:            inv.paid  || 0,
    status:          _calcInvStatus(inv.total, inv.paid),
    notes:           inv.notes || ""
  };

  var items = (inv.items || []).map(function (it) {
    return { product_id: it.productId, product_name: it.name,
             quantity: it.quantity, price: it.price, total: it.total };
  });

  if (await sbReady()) {
    var r = await SB.from("supplier_invoices").insert([header]).select().single();
    if (r.error) return null;
    var supInv = _mapSupInvoice(r.data);
    if (items.length) {
      var withId = items.map(function (it) {
        return Object.assign({ supplier_invoice_id: supInv.id }, it);
      });
      await SB.from("supplier_invoice_items").insert(withId);
    }
    await _updateSupplierBalance(inv.supplierId);
    logActivity("supplier", "فاتورة مورد جديدة: " + invNum, "الإجمالي: " + inv.total);
    return supInv;
  }
  var localInv = Object.assign({ id: Date.now(), items: items,
    supplierId: inv.supplierId, invoiceNumber: invNum,
    date: header.date, total: header.total, paid: header.paid,
    status: header.status, notes: header.notes }, {});
  var list = lsGet(LS_SUP_INVOICES, []);
  list.unshift(localInv);
  lsSet(LS_SUP_INVOICES, list);
  queueOp("insert", "supplier_invoices", header);
  await _updateSupplierBalance(inv.supplierId);
  logActivity("supplier", "فاتورة مورد جديدة: " + invNum, "الإجمالي: " + inv.total);
  return localInv;
}

async function addSupplierPayment(supplierId, amount, date, notes) {
  var payload = {
    supplier_id: supplierId,
    amount:      Number(amount),
    date:        date || new Date().toISOString().slice(0, 10),
    notes:       notes || ""
  };
  if (await sbReady()) {
    await SB.from("supplier_payments").insert([payload]);
  } else {
    payload.id = Date.now();
    var list = lsGet(LS_SUP_PAYMENTS, []);
    list.unshift(payload);
    lsSet(LS_SUP_PAYMENTS, list);
    queueOp("insert", "supplier_payments", payload);
  }
  await _updateSupplierBalance(supplierId);
  logActivity("supplier", "دفعة لمورد", "المبلغ: " + amount);
}

async function getSupplierPayments(supplierId) {
  if (await sbReady()) {
    var r = await SB.from("supplier_payments").select("*")
      .eq("supplier_id", supplierId).order("date", { ascending: false });
    if (r.data) return r.data.map(function (p) {
      return { id: p.id, supplierId: p.supplier_id, amount: Number(p.amount),
               date: p.date, notes: p.notes || "" };
    });
    return [];
  }
  var all = lsGet(LS_SUP_PAYMENTS, []);
  return all.filter(function (p) { return p.supplier_id === supplierId || p.supplierId === supplierId; });
}

/* كشف الحساب الكامل لمورد */
async function getSupplierStatement(supplierId) {
  var invoices = await getSupplierInvoices(supplierId);
  var payments = await getSupplierPayments(supplierId);

  var entries = [];
  invoices.forEach(function (inv) {
    entries.push({ type: "invoice", date: inv.date, ref: inv.invoiceNumber,
                   debit: inv.total, credit: 0, notes: inv.notes });
  });
  payments.forEach(function (p) {
    entries.push({ type: "payment", date: p.date, ref: "دفعة",
                   debit: 0, credit: p.amount, notes: p.notes });
  });
  entries.sort(function (a, b) { return a.date > b.date ? 1 : -1; });

  var balance = 0;
  entries.forEach(function (e) {
    balance += e.debit - e.credit;
    e.balance = balance;
  });
  return { entries: entries, totalBalance: balance };
}

/* ─── مساعدات ─── */
function _mapSupplier(r) {
  return { id: r.id, name: r.name, phone: r.phone || "", address: r.address || "",
           email: r.email || "", balance: Number(r.balance || 0), notes: r.notes || "" };
}
function _mapSupInvoice(r) {
  return { id: r.id, supplierId: r.supplier_id, invoiceNumber: r.invoice_number || "",
           date: r.date || "", total: Number(r.total || 0), paid: Number(r.paid || 0),
           status: r.status || "unpaid", notes: r.notes || "", items: [] };
}
function _mapSupItem(r) {
  return { id: r.id, productId: r.product_id, name: r.product_name,
           quantity: Number(r.quantity), price: Number(r.price), total: Number(r.total) };
}
function _calcInvStatus(total, paid) {
  paid = Number(paid || 0); total = Number(total || 0);
  if (paid <= 0)          return "unpaid";
  if (paid >= total)      return "paid";
  return "partial";
}
