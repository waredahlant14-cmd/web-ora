/* =========================================================
   js/offers.js — طبقة بيانات العروض والخصومات v1.0
   Supabase (سحابي) + localStorage (محلي)
   ========================================================= */

var LS_OFFERS = "acc_offers";

/* ─── CRUD ─── */
async function getOffers() {
  if (await sbReady()) {
    var r = await SB.from("offers").select("*").order("id");
    if (r.data) return r.data.map(_mapOffer);
    return [];
  }
  return lsGet(LS_OFFERS, []);
}

async function getActiveOffers() {
  var all = await getOffers();
  var today = new Date().toISOString().slice(0, 10);
  return all.filter(function (o) {
    if (!o.active) return false;
    if (o.startDate && o.startDate > today) return false;
    if (o.endDate && o.endDate < today) return false;
    return true;
  });
}

async function addOffer(o) {
  var payload = _toPayload(o);
  if (await sbReady()) {
    var r = await SB.from("offers").insert([payload]).select().single();
    if (!r.error) logActivity("offer", "تمت إضافة عرض: " + o.name);
    return !r.error;
  }
  payload.id = Date.now();
  var list = lsGet(LS_OFFERS, []);
  list.push(payload);
  lsSet(LS_OFFERS, list);
  queueOp("upsert", "offers", payload);
  logActivity("offer", "تمت إضافة عرض: " + o.name);
  return true;
}

async function updateOffer(id, o) {
  var payload = _toPayload(o);
  if (await sbReady()) {
    await SB.from("offers").update(payload).eq("id", id);
    logActivity("offer", "تم تعديل عرض: " + o.name);
    return;
  }
  var list = lsGet(LS_OFFERS, []);
  for (var i = 0; i < list.length; i++)
    if (list[i].id === id) list[i] = Object.assign({}, list[i], payload, { id: id });
  lsSet(LS_OFFERS, list);
  queueOp("upsert", "offers", Object.assign({ id: id }, payload));
  logActivity("offer", "تم تعديل عرض: " + o.name);
}

async function deleteOffer(id) {
  if (await sbReady()) {
    await SB.from("offers").delete().eq("id", id);
  } else {
    lsSet(LS_OFFERS, lsGet(LS_OFFERS, []).filter(function (o) { return o.id !== id; }));
    queueOp("delete", "offers", null, { id: id });
  }
  logActivity("offer", "تم حذف عرض ID: " + id);
}

/* ─── تطبيق العرض على بند الفاتورة ─── */
async function applyOffers(cartItems, productsList) {
  var offers = await getActiveOffers();
  var result = cartItems.map(function (item) {
    return Object.assign({}, item, { discount: 0, discountLabel: "" });
  });

  for (var oi = 0; oi < offers.length; oi++) {
    var offer = offers[oi];
    for (var ci = 0; ci < result.length; ci++) {
      var item = result[ci];
      if (!_offerAppliesTo(offer, item, productsList)) continue;

      if (offer.type === "percent") {
        if (item.quantity >= (offer.minQty || 1)) {
          item.discount = (item.price * item.quantity) * (offer.value / 100);
          item.discountLabel = offer.name + " (‑" + offer.value + "%)";
        }
      } else if (offer.type === "fixed") {
        if (item.quantity >= (offer.minQty || 1)) {
          item.discount = Math.min(offer.value, item.price * item.quantity);
          item.discountLabel = offer.name + " (‑" + formatPrice(offer.value) + ")";
        }
      } else if (offer.type === "buy_x_get_y") {
        var sets = Math.floor(item.quantity / (offer.buyQty || 1));
        if (sets >= 1) {
          var freeQty = sets * (offer.getQty || 1);
          item.discount = Math.min(freeQty, item.quantity) * item.price;
          item.discountLabel = offer.name + " (اشترِ " + offer.buyQty + " واحصل على " + offer.getQty + " مجاناً)";
        }
      }
    }
  }
  return result;
}

function _offerAppliesTo(offer, item, productsList) {
  if (offer.appliesTo === "all") return true;
  if (offer.appliesTo === "products") {
    var ids = offer.targetIds || [];
    return ids.indexOf(String(item.productId)) !== -1 || ids.indexOf(item.productId) !== -1;
  }
  if (offer.appliesTo === "category") {
    var cats = offer.targetIds || [];
    var p = null;
    if (productsList) {
      for (var i = 0; i < productsList.length; i++)
        if (productsList[i].id === item.productId) { p = productsList[i]; break; }
    }
    return p && cats.indexOf(p.category) !== -1;
  }
  return false;
}

function _mapOffer(r) {
  return {
    id: r.id, name: r.name, type: r.type, value: Number(r.value || 0),
    minQty: r.min_qty || 1, buyQty: r.buy_qty || 1, getQty: r.get_qty || 1,
    appliesTo: r.applies_to || "all",
    targetIds: Array.isArray(r.target_ids) ? r.target_ids : (r.target_ids ? JSON.parse(r.target_ids) : []),
    startDate: r.start_date || "", endDate: r.end_date || "",
    active: !!r.active
  };
}

function _toPayload(o) {
  return {
    name: o.name, type: o.type, value: o.value || 0,
    min_qty: o.minQty || 1, buy_qty: o.buyQty || 1, get_qty: o.getQty || 1,
    applies_to: o.appliesTo || "all",
    target_ids: JSON.stringify(o.targetIds || []),
    start_date: o.startDate || null, end_date: o.endDate || null,
    active: o.active !== false
  };
}
