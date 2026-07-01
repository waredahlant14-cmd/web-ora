/* =========================================================
   js/shortcuts.js — اختصارات سطح المكتب v5.2.5
   ========================================================= */

var DESKTOP_SHORTCUTS = [
  { name: "WeB Ora — لوحة التحكم",       page: "index.html",           label: "لوحة التحكم" },
  { name: "WeB Ora — نقطة البيع",        page: "quick-pos.html",       label: "نقطة البيع السريع" },
  { name: "WeB Ora — فاتورة جديدة",      page: "new-invoice.html",     label: "فاتورة جديدة" },
  { name: "WeB Ora — سجل الفواتير",      page: "invoices.html",        label: "سجل الفواتير" },
  { name: "WeB Ora — المنتجات",          page: "products.html",        label: "المنتجات" },
  { name: "WeB Ora — سجلات الدفع",       page: "payments-ledger.html", label: "سجلات الدفع" },
  { name: "WeB Ora — التقارير",          page: "reports.html",         label: "التقارير" },
  { name: "WeB Ora — إدارة الفروع",      page: "branches.html",        label: "إدارة الفروع" },
  { name: "WeB Ora — الإعدادات",         page: "settings.html",        label: "الإعدادات" },
];

function renderShortcutGrid() {
  var grid = document.getElementById("shortcut-grid");
  if (!grid) return;
  var html = "";
  DESKTOP_SHORTCUTS.forEach(function(sc) {
    html +=
      '<div style="background:var(--bg-card,#fff);border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:12px;text-align:center">' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text,#111)">' + sc.label + '</div>' +
      '<button class="btn btn-outline btn-sm" onclick="createShortcut(\'' + sc.name.replace(/'/g,"\\'") + '\',\'' + sc.page + '\')" style="width:100%;font-size:12px">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
      ' إنشاء اختصار</button>' +
      '</div>';
  });
  grid.innerHTML = html;
}

async function createShortcut(name, page) {
  if (!window.electronAPI || !window.electronAPI.createDesktopShortcut) {
    if (typeof toast === "function") toast("الاختصارات متاحة في تطبيق Desktop فقط", "warning");
    return;
  }
  try {
    var r = await window.electronAPI.createDesktopShortcut({ name: name, args: "--page=" + page });
    if (r && r.ok) {
      if (typeof toast === "function") toast("✓ تم إنشاء الاختصار: " + name, "success");
    } else {
      if (typeof toast === "function") toast("تعذّر إنشاء الاختصار: " + (r ? r.error || "" : ""), "error");
    }
  } catch(e) {
    if (typeof toast === "function") toast("خطأ: " + e.message, "error");
  }
}

async function createAllShortcuts() {
  if (!window.electronAPI || !window.electronAPI.createDesktopShortcut) {
    if (typeof toast === "function") toast("الاختصارات متاحة في تطبيق Desktop فقط", "warning");
    return;
  }
  var successCount = 0;
  for (var i = 0; i < DESKTOP_SHORTCUTS.length; i++) {
    try {
      var r = await window.electronAPI.createDesktopShortcut({ name: DESKTOP_SHORTCUTS[i].name, args: "--page=" + DESKTOP_SHORTCUTS[i].page });
      if (r && r.ok) successCount++;
    } catch(e) {}
  }
  if (typeof toast === "function") toast("✓ تم إنشاء " + successCount + " اختصار على سطح المكتب", "success");
}
