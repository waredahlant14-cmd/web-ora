/* =========================================================
   js/shifts.js — طبقة بيانات الورديات v1.0
   Supabase (سحابي) + localStorage (محلي)
   ========================================================= */

var LS_SHIFTS     = "acc_shifts";
var LS_OPEN_SHIFT = "acc_open_shift";

/* ─── الوردية المفتوحة ─── */
function getOpenShift() {
  try {
    var v = localStorage.getItem(LS_OPEN_SHIFT);
    return v ? JSON.parse(v) : null;
  } catch (e) { return null; }
}
function _saveOpenShift(s) {
  if (s) localStorage.setItem(LS_OPEN_SHIFT, JSON.stringify(s));
  else    localStorage.removeItem(LS_OPEN_SHIFT);
}

async function syncOpenShiftFromCloud() {
  if (!await sbReady()) return;
  var r = await SB.from("shifts").select("*").eq("status", "open").limit(1).maybeSingle();
  if (r && r.data) {
    _saveOpenShift(_mapShift(r.data));
  } else {
    _saveOpenShift(null);
  }
}

/* ─── فتح وردية ─── */
async function openShift(openingCash) {
  var existing = getOpenShift();
  if (existing) return { error: "already_open", shift: existing };

  var user = (typeof getCurrentUser === "function") ? getCurrentUser() : { id: "?", name: "مجهول" };
  var now  = new Date().toISOString();

  var payload = {
    user_id:      String(user.id || ""),
    user_name:    user.name || "مجهول",
    opened_at:    now,
    opening_cash: Number(openingCash) || 0,
    status:       "open",
    sales_total:  0,
    sales_count:  0,
    cash_sales:   0
  };

  if (await sbReady()) {
    var r = await SB.from("shifts").insert([payload]).select().single();
    if (r.error) return { error: r.error.message };
    var shift = _mapShift(r.data);
    _saveOpenShift(shift);
    logActivity("shift", "فتح وردية جديدة", "النقد الافتتاحي: " + openingCash);
    return { success: true, shift: shift };
  }

  payload.id = Date.now();
  var shift = _mapShift(payload);
  _saveOpenShift(shift);
  var list = lsGet(LS_SHIFTS, []);
  list.unshift(shift);
  lsSet(LS_SHIFTS, list);
  queueOp("insert", "shifts", payload);
  logActivity("shift", "فتح وردية جديدة", "النقد الافتتاحي: " + openingCash);
  return { success: true, shift: shift };
}

/* ─── تحديث إجماليات الوردية عند إضافة فاتورة ─── */
async function addSaleToShift(invoiceTotal, isCash) {
  var shift = getOpenShift();
  if (!shift) return;

  shift.salesTotal  = (shift.salesTotal  || 0) + invoiceTotal;
  shift.salesCount  = (shift.salesCount  || 0) + 1;
  shift.cashSales   = (shift.cashSales   || 0) + (isCash ? invoiceTotal : 0);
  _saveOpenShift(shift);

  if (await sbReady()) {
    await SB.from("shifts").update({
      sales_total: shift.salesTotal,
      sales_count: shift.salesCount,
      cash_sales:  shift.cashSales
    }).eq("id", shift.id);
  }
}

/* ─── غلق الوردية ─── */
async function closeShift(actualCash, notes) {
  var shift = getOpenShift();
  if (!shift) return { error: "no_open_shift" };

  /* النقد المتوقع = النقد الافتتاحي + مبيعات نقدية */
  var expected   = (shift.openingCash || 0) + (shift.cashSales || 0);
  var difference = Number(actualCash) - expected;
  var closedAt   = new Date().toISOString();

  var updates = {
    closed_at:     closedAt,
    closing_cash:  Number(actualCash),
    expected_cash: expected,
    difference:    difference,
    status:        "closed",
    notes:         notes || ""
  };

  if (await sbReady()) {
    var r = await SB.from("shifts").update(updates).eq("id", shift.id);
    if (r && r.error) return { error: r.error.message };
  } else {
    var list = lsGet(LS_SHIFTS, []);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === shift.id) list[i] = Object.assign({}, list[i], _mapUpdates(updates));
    }
    lsSet(LS_SHIFTS, list);
    queueOp("upsert", "shifts", Object.assign({ id: shift.id }, updates));
  }

  _saveOpenShift(null);
  logActivity("shift", "إغلاق وردية",
    "الفرق: " + (difference >= 0 ? "فائض " : "عجز ") + Math.abs(difference).toFixed(2));
  return {
    success:    true,
    expected:   expected,
    actual:     Number(actualCash),
    difference: difference,
    shift:      Object.assign({}, shift, _mapUpdates(updates))
  };
}

/* ─── قائمة الورديات ─── */
async function getShifts() {
  if (await sbReady()) {
    var r = await SB.from("shifts").select("*").order("opened_at", { ascending: false });
    if (r.data) return r.data.map(_mapShift);
    return [];
  }
  return lsGet(LS_SHIFTS, []);
}

async function getShiftById(id) {
  if (await sbReady()) {
    var r = await SB.from("shifts").select("*").eq("id", id).single();
    if (r.data) return _mapShift(r.data);
    return null;
  }
  var list = lsGet(LS_SHIFTS, []);
  for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
  return null;
}

/* ─── مساعدات ─── */
function _mapShift(r) {
  return {
    id:           r.id,
    userId:       r.user_id   || "",
    userName:     r.user_name || "",
    openedAt:     r.opened_at || "",
    closedAt:     r.closed_at || "",
    openingCash:  Number(r.opening_cash  || 0),
    closingCash:  r.closing_cash  != null ? Number(r.closing_cash)  : null,
    expectedCash: r.expected_cash != null ? Number(r.expected_cash) : null,
    difference:   r.difference   != null ? Number(r.difference)    : null,
    status:       r.status || "open",
    notes:        r.notes  || "",
    salesTotal:   Number(r.sales_total || 0),
    salesCount:   Number(r.sales_count || 0),
    cashSales:    Number(r.cash_sales  || 0)
  };
}
function _mapUpdates(u) {
  return {
    closedAt:     u.closed_at,
    closingCash:  Number(u.closing_cash),
    expectedCash: Number(u.expected_cash),
    difference:   Number(u.difference),
    status:       u.status,
    notes:        u.notes || ""
  };
}
