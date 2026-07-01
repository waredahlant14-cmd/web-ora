/* =========================================================
   js/export.js — تصدير البيانات
   Excel (SheetJS) · صور (html2canvas) · JSON
   ========================================================= */

/* ─── تحميل SheetJS ─── */
function loadSheetJS() {
  return new Promise(function (resolve, reject) {
    if (window.XLSX) { resolve(); return; }
    var s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}


/* ─── شعار الشركة في Excel ─── */
function getCompanyHeaderRows() {
  var cs = (typeof getCustomSettings === "function") ? getCustomSettings() : {};
  var rows = [];
  var name = cs.companyName || (window.APP_CONFIG && APP_CONFIG.BRAND_NAME) || "WeB Ora";
  rows.push([name, "", "", "", "", "", ""]);
  var sub = [];
  if (cs.companyPhone)   sub.push("هاتف: " + cs.companyPhone);
  if (cs.companyAddress) sub.push("العنوان: " + cs.companyAddress);
  if (cs.companyEmail)   sub.push("البريد: " + cs.companyEmail);
  if (cs.taxNumber)      sub.push("رقم ضريبي: " + cs.taxNumber);
  if (sub.length) rows.push([sub.join("  |  "), "", "", "", "", "", ""]);
  rows.push(["تاريخ التصدير: " + new Date().toLocaleDateString("ar"), "", "", "", "", "", ""]);
  rows.push([]); /* فراغ */
  return rows;
}

function applyBrandingToSheet(ws, headerRows, dataColCount) {
  /* عرض أعمدة موحد */
  if (!ws["!cols"]) ws["!cols"] = [];
  /* دمج خلايا العنوان */
  if (!ws["!merges"]) ws["!merges"] = [];
  for (var i=0;i<headerRows.length-1;i++) {
    ws["!merges"].push({s:{r:i,c:0}, e:{r:i,c:Math.max(dataColCount-1,0)}});
  }
}

/* ─── تصدير المنتجات Excel ─── */
async function exportProductsExcel(products) {
  toast("جارٍ إنشاء ملف Excel…", "");
  await loadSheetJS();
  var header = getCompanyHeaderRows();
  var cols = ["الاسم", "الفئة", "سعر البيع", "سعر التكلفة", "المخزون", "حد التنبيه", "الباركود"];
  var rows = header.concat([cols]);
  products.forEach(function (p) {
    rows.push([p.name, p.category || "", p.price, p.costPrice || 0, p.stock, p.minStock || 5, p.barcode || ""]);
  });
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 18 }];
  applyBrandingToSheet(ws, header, cols.length);
  XLSX.utils.book_append_sheet(wb, ws, "المنتجات");
  XLSX.writeFile(wb, "منتجات-webora-" + new Date().toISOString().slice(0, 10) + ".xlsx");
  toast("تم تصدير المنتجات كـ Excel", "success");
}

/* ─── تصدير الفواتير Excel ─── */
async function exportInvoicesExcel(invoices) {
  toast("جارٍ إنشاء ملف Excel…", "");
  await loadSheetJS();
  var header = getCompanyHeaderRows();
  var cols = ["رقم الفاتورة", "التاريخ", "العميل", "الجوال", "الحالة", "الإجمالي", "الملاحظات"];
  var rows = header.concat([cols]);
  invoices.forEach(function (inv) {
    rows.push([
      inv.invoiceNumber,
      (inv.date || "").slice(0, 10),
      inv.customer ? (inv.customer.name || "") : "",
      inv.customer ? (inv.customer.phone || "") : "",
      inv.paymentStatus || "",
      inv.total,
      inv.notes || "",
    ]);
  });
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 22 }, { wch: 15 }, { wch: 10 }, { wch: 14 }, { wch: 26 }];
  applyBrandingToSheet(ws, header, cols.length);
  XLSX.utils.book_append_sheet(wb, ws, "الفواتير");
  XLSX.writeFile(wb, "فواتير-webora-" + new Date().toISOString().slice(0, 10) + ".xlsx");
  toast("تم تصدير الفواتير كـ Excel", "success");
}

/* ─── تصدير المصاريف Excel ─── */
async function exportExpensesExcel(expenses) {
  toast("جارٍ إنشاء ملف Excel…", "");
  await loadSheetJS();
  var header = getCompanyHeaderRows();
  var cols = ["العنوان", "الفئة", "المبلغ", "التاريخ", "الملاحظات"];
  var rows = header.concat([cols]);
  expenses.forEach(function (e) {
    rows.push([e.title, e.category || "", e.amount, e.date || "", e.notes || ""]);
  });
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 28 }, { wch: 15 }, { wch: 14 }, { wch: 12 }, { wch: 26 }];
  applyBrandingToSheet(ws, header, cols.length);
  XLSX.utils.book_append_sheet(wb, ws, "المصاريف");
  XLSX.writeFile(wb, "مصاريف-webora-" + new Date().toISOString().slice(0, 10) + ".xlsx");
  toast("تم تصدير المصاريف كـ Excel", "success");
}

/* ─── تصدير الرواتب Excel ─── */
async function exportSalariesExcel(payments) {
  toast("جارٍ إنشاء ملف Excel…", "");
  await loadSheetJS();
  var header = getCompanyHeaderRows();
  var cols = ["الموظف", "المبلغ", "الفترة", "التاريخ", "ملاحظات"];
  var rows = header.concat([cols]);
  payments.forEach(function (p) {
    rows.push([p.employeeName, p.amount, p.period || "", p.date || "", p.notes || ""]);
  });
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 26 }];
  applyBrandingToSheet(ws, header, cols.length);
  XLSX.utils.book_append_sheet(wb, ws, "الرواتب");
  XLSX.writeFile(wb, "رواتب-webora-" + new Date().toISOString().slice(0, 10) + ".xlsx");
  toast("تم تصدير الرواتب كـ Excel", "success");
}


/* ─── تصدير النشاطات Excel ─── */
async function exportActivityExcel(logs) {
  toast("جارٍ إنشاء ملف Excel…", "");
  await loadSheetJS();
  var header = getCompanyHeaderRows();
  var cols = ["النوع", "العنوان", "التفاصيل", "المستخدم", "التاريخ والوقت"];
  var rows = header.concat([cols]);
  logs.forEach(function (l) {
    rows.push([
      l.type || "",
      l.title || "",
      l.detail || "",
      l.user || "",
      l.at ? new Date(l.at).toLocaleString("ar") : ""
    ]);
  });
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 35 }, { wch: 15 }, { wch: 22 }];
  applyBrandingToSheet(ws, header, cols.length);
  XLSX.utils.book_append_sheet(wb, ws, "سجل النشاطات");
  XLSX.writeFile(wb, "نشاطات-webora-" + new Date().toISOString().slice(0, 10) + ".xlsx");
  toast("تم تصدير النشاطات كـ Excel", "success");
}

/* ─── تصدير إحصائيات التقارير Excel ─── */
async function exportStatsExcel(statsData) {
  toast("جارٍ إنشاء ملف Excel…", "");
  await loadSheetJS();
  var wb = XLSX.utils.book_new();
  var header = getCompanyHeaderRows();
  var cs = (typeof getCustomSettings === "function") ? getCustomSettings() : {};
  var month = statsData.month || new Date().toISOString().slice(0, 7);

  /* ورقة الملخص المالي */
  var summaryHeader = header.concat([
    ["تقرير مالي — " + month, "", ""],
    [""],
    ["البند", "القيمة", ""]
  ]);
  var summaryRows = summaryHeader.concat([
    ["إجمالي المبيعات", statsData.sales || 0, ""],
    ["تكلفة البضاعة", statsData.cogs || 0, ""],
    ["إجمالي الربح", statsData.gross || 0, ""],
    ["المصاريف التشغيلية", statsData.expenses || 0, ""],
    ["الرواتب المدفوعة", statsData.salaries || 0, ""],
    ["صافي الربح", statsData.net || 0, ""]
  ]);
  var ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1["!cols"] = [{ wch: 25 }, { wch: 18 }, { wch: 10 }];
  applyBrandingToSheet(ws1, header, 3);
  XLSX.utils.book_append_sheet(wb, ws1, "الملخص المالي");

  /* ورقة أعلى المنتجات */
  if (statsData.topProducts && statsData.topProducts.length) {
    var prodHeader = header.concat([["المنتج", "الإيراد", "الكمية"]]);
    var prodRows = prodHeader.concat(statsData.topProducts.map(function(p){
      return [p.name, p.revenue, p.qty];
    }));
    var ws2 = XLSX.utils.aoa_to_sheet(prodRows);
    ws2["!cols"] = [{ wch: 30 }, { wch: 16 }, { wch: 12 }];
    applyBrandingToSheet(ws2, header, 3);
    XLSX.utils.book_append_sheet(wb, ws2, "أعلى المنتجات");
  }

  /* ورقة أفضل العملاء */
  if (statsData.topCustomers && statsData.topCustomers.length) {
    var custHeader = header.concat([["العميل", "الجوال", "إجمالي المشتريات"]]);
    var custRows = custHeader.concat(statsData.topCustomers.map(function(c){
      return [c.name||"", c.phone||"", c.totalSpent||0];
    }));
    var ws3 = XLSX.utils.aoa_to_sheet(custRows);
    ws3["!cols"] = [{ wch: 25 }, { wch: 16 }, { wch: 20 }];
    applyBrandingToSheet(ws3, header, 3);
    XLSX.utils.book_append_sheet(wb, ws3, "أفضل العملاء");
  }

  /* ورقة المبيعات الشهرية */
  if (statsData.monthly && statsData.monthly.length) {
    var monthHeader = header.concat([["الشهر", "المبيعات", "المصاريف", "الرواتب"]]);
    var monthRows = monthHeader.concat(statsData.monthly.map(function(m){
      return [m.label, m.sales, m.expenses, m.salaries];
    }));
    var ws4 = XLSX.utils.aoa_to_sheet(monthRows);
    ws4["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    applyBrandingToSheet(ws4, header, 4);
    XLSX.utils.book_append_sheet(wb, ws4, "المبيعات الشهرية");
  }

  XLSX.writeFile(wb, "تقارير-webora-" + month + ".xlsx");
  toast("تم تصدير التقارير كـ Excel", "success");
}

/* ─── تصدير كامل للبيانات ─── */
function exportAllDataJSON() {
  var data = {
    products:  JSON.parse(localStorage.getItem("acc_products_pro")    || "null"),
    invoices:  JSON.parse(localStorage.getItem("acc_invoices_history") || "[]"),
    customers: JSON.parse(localStorage.getItem("acc_customers")       || "[]"),
    employees: JSON.parse(localStorage.getItem("acc_employees")       || "[]"),
    expenses:  JSON.parse(localStorage.getItem("acc_expenses")        || "[]"),
    salaries:  JSON.parse(localStorage.getItem("acc_salary_payments") || "[]"),
    settings:  JSON.parse(localStorage.getItem("pos_app_settings")    || "null"),
    exportedAt: new Date().toISOString(),
    version: "4.0",
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "webora-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  toast("تم تصدير النسخة الاحتياطية الكاملة", "success");
  if (typeof logActivity === "function") logActivity("system", "تصدير نسخة احتياطية");
}

function importDataJSON(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var data = JSON.parse(reader.result);
      if (data.products)  localStorage.setItem("acc_products_pro",     JSON.stringify(data.products));
      if (data.invoices)  localStorage.setItem("acc_invoices_history", JSON.stringify(data.invoices));
      if (data.customers) localStorage.setItem("acc_customers",        JSON.stringify(data.customers));
      if (data.employees) localStorage.setItem("acc_employees",        JSON.stringify(data.employees));
      if (data.expenses)  localStorage.setItem("acc_expenses",         JSON.stringify(data.expenses));
      if (data.salaries)  localStorage.setItem("acc_salary_payments",  JSON.stringify(data.salaries));
      if (data.settings)  localStorage.setItem("pos_app_settings",     JSON.stringify(data.settings));
      toast("تم استيراد البيانات بنجاح", "success");
      if (typeof logActivity === "function") logActivity("system", "استيراد بيانات من ملف JSON");
      setTimeout(function () { location.reload(); }, 900);
    } catch (e) { toast("ملف غير صالح", "error"); }
  };
  reader.readAsText(file);
}
