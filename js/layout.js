/* =========================================================
   js/layout.js — القائمة الجانبية v5.1 Desktop Edition
   روابط .html بدلاً من .php
   ========================================================= */

var ICONS = {
  grid:       '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  filePlus:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
  fileText:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>',
  scanLine:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>',
  package:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  users:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  archive:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
  userCog:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><circle cx="19" cy="11" r="2"/><path d="M19 8v1"/><path d="M19 13v1"/><path d="M22 11h-1"/><path d="M16 11h-1"/></svg>',
  creditCard: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
  barChart:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  activity:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  settings:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  sliders:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
  logOut:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  moon:       '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  sun:        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  menu:       '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  plus:       '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  print:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  image:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  download:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  trash:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  edit:       '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  check:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  alertTriangle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info:       '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  search:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  wifi:       '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
  wifiOff:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a11 11 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
  tag:        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  clock:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  shield:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  truck:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
  gitBranch:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
  clipboardList: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>',
};

function icon(name, size) {
  var s = size || 18;
  return '<span class="nav-icon" style="width:' + s + 'px;height:' + s + 'px;display:inline-flex;align-items:center;justify-content:center">' + (ICONS[name] || '') + '</span>';
}

/* ─── عناصر التنقل — روابط .html ─── */
var NAV_ITEMS = [
  { href: "index.html",       key: "dashboard",  label: "لوحة التحكم",        icon: "grid",      section: "الرئيسية" },
  { href: "quick-pos.html",   key: "quick-pos",  label: "نقطة البيع السريع",  icon: "plus",      section: null, badge: "جديد" },
  { href: "new-invoice.html", key: "new",        label: "فاتورة جديدة",       icon: "filePlus",  section: null },
  { href: "invoices.html",    key: "invoices",   label: "سجل الفواتير",       icon: "fileText",  section: null },
  { href: "scanner.html",     key: "scanner",    label: "ماسح الرمز",         icon: "scanLine",  section: null, badge: "كاميرا" },
  { href: "products.html",    key: "products",   label: "المنتجات",     icon: "package",   section: "الإدارة" },
  { href: "customers.html",   key: "customers",  label: "العملاء",      icon: "users",     section: null },
  { href: "stock.html",       key: "stock",      label: "المخزون",      icon: "archive",   section: null },
  { href: "expenses.html",    key: "expenses",   label: "المصاريف",     icon: "creditCard",section: null },
  { href: "employees.html",   key: "employees",  label: "الموظفون",     icon: "userCog",   section: null },
  { href: "payments-ledger.html", key: "payments-ledger", label: "سجلات الدفع", icon: "clipboardList", section: null },
  { href: "customize.html",   key: "customize",  label: "التخصيص",      icon: "sliders",   section: null },
  { href: "reports.html",     key: "reports",    label: "التقارير",     icon: "barChart",  section: "التحليلات" },
  { href: "activity.html",    key: "activity",   label: "سجل النشاطات", icon: "activity",  section: null },
  { href: "branches.html",     key: "branches",  label: "إدارة الفروع",  icon: "users",    section: "النظام", adminOnly: true, cloudOnly: true },
];

/* ─── الوضع الليلي ─── */
function initDarkMode() {
  if (localStorage.getItem("dark_mode") === "1") document.documentElement.classList.add("dark");
}
function toggleDarkMode() {
  var d = document.documentElement.classList.toggle("dark");
  localStorage.setItem("dark_mode", d ? "1" : "0");
}
initDarkMode();

/* ─── رسم الهيكل ─── */
function renderLayout(activeKey) {
  requireLogin();
  var user  = getCurrentUser() || { name: "المستخدم" };
  var cs    = (typeof getCustomSettings === "function") ? getCustomSettings() : {};
  var brand = cs.companyName || (window.APP_CONFIG && APP_CONFIG.BRAND_NAME) || "WeB Ora";
  var cur   = (typeof getActiveCurrency === "function") ? getActiveCurrency() : { code: "USD", symbol: "$" };
  var isDark= document.documentElement.classList.contains("dark");

  if (cs.primaryColor && cs.primaryColor !== "#F57C20") {
    var r = document.documentElement;
    r.style.setProperty("--primary", cs.primaryColor);
    var hex = cs.primaryColor.replace("#", "");
    var bigint = parseInt(hex, 16);
    var R = (bigint >> 16) & 255, G = (bigint >> 8) & 255, B = bigint & 255;
    r.style.setProperty("--primary-rgb", R + "," + G + "," + B);
  }

  var lastSection = null;
  var links = "";
  for (var i = 0; i < NAV_ITEMS.length; i++) {
    var it = NAV_ITEMS[i];
    if (it.adminOnly && !isAdmin()) continue;
    if (it.cloudOnly) { var _mode = typeof getAppMode === "function" ? getAppMode() : null; if (_mode !== "online" && _mode !== "parallel") continue; }
    if (it.section && it.section !== lastSection) {
      links += '<div class="nav-section">' + it.section + '</div>';
      lastSection = it.section;
    }
    links +=
      '<a class="nav-link' + (it.key === activeKey ? " active" : "") + '" href="' + it.href + '">' +
      icon(it.icon) +
      '<span>' + it.label + '</span>' +
      (it.badge ? '<span class="nav-badge">' + it.badge + '</span>' : '') +
      '</a>';
  }

  var sidebar =
    '<div class="sidebar-overlay" id="sb-overlay" onclick="toggleSidebar(false)"></div>' +
    '<aside class="sidebar" id="sidebar">' +
      '<div class="sidebar-head">' +
        '<div class="sidebar-logo"><img src="img/mark.png" alt="WeB Ora"></div>' +
        '<div><div class="brand">' + esc(brand) + '</div><div class="user">' + esc(user.name) + '</div></div>' +
      '</div>' +
      '<nav id="sidebar-nav">' + links + '</nav>' +
      '<div class="sidebar-foot">' +
        '<div class="dark-toggle">' +
          '<div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600">' +
          '<span style="width:16px;height:16px;opacity:.7">' + ICONS[isDark ? 'moon' : 'sun'] + '</span>' +
          '<span>' + (isDark ? 'وضع ليلي' : 'وضع نهاري') + '</span></div>' +
          '<div class="toggle-pill" id="dark-pill" onclick="handleDarkToggle()"></div>' +
        '</div>' +
        '<a class="nav-link' + (activeKey === "settings" ? " active" : "") + '" href="settings.html">' +
          icon("settings") + '<span>الإعدادات</span></a>' +
        '<button class="logout-btn" onclick="logout()">' + icon("logOut") + '<span>تسجيل الخروج</span></button>' +
        '<div class="sidebar-ver"><span>v5.2.5 Cloud</span><span>' + esc(cur.code + ' ' + cur.symbol) + '</span></div>' +
      '</div>' +
    '</aside>';

  var topbar =
    '<header class="topbar">' +
      '<button class="menu-btn" onclick="toggleSidebar(true)" aria-label="القائمة">' +
      '<span style="width:20px;height:20px;display:flex">' + ICONS.menu + '</span></button>' +
      '<span class="title">' + esc(brand) + '</span>' +
      /* v5.1: نقطة المزامنة أُزيلت — الإشعارات المنبثقة تتولى الإعلام */
      '<span class="topbar-currency">' + esc(cur.code) + '</span>' +
    '</header>';

  var content = document.getElementById("page");
  var app = document.createElement("div");
  app.className = "app";
  app.innerHTML = sidebar + '<div class="main">' + topbar + '<div class="content page-fade" id="content-slot"></div></div>';
  document.body.prepend(app);
  if (content) document.getElementById("content-slot").appendChild(content);

  var tb = document.createElement("div");
  tb.id = "toast-box";
  document.body.appendChild(tb);

  if (typeof updateSyncIndicator === "function") setTimeout(updateSyncIndicator, 100);
  if (typeof _ntfRenderBanner    === "function") setTimeout(_ntfRenderBanner, 150);
}

function handleDarkToggle() {
  toggleDarkMode();
  var isDark = document.documentElement.classList.contains("dark");
  document.getElementById("dark-pill").parentNode.querySelector("span + span").textContent =
    isDark ? "وضع ليلي" : "وضع نهاري";
}
function toggleSidebar(open) {
  document.getElementById("sidebar").classList.toggle("open", open);
  document.getElementById("sb-overlay").classList.toggle("show", open);
}

/* ─── Toast (تفويض لـ notifications.js إن كان محملاً) ─── */
function toast(msg, type, duration) {
  if (typeof ntfToast === "function") { ntfToast(msg, type, duration); return; }
  /* fallback بسيط */
  var box = document.getElementById("toast-box");
  if (!box) { console.warn(msg); return; }
  var el = document.createElement("div");
  el.className = "ntf-toast ntf-" + (type || "info");
  el.style.cssText = "padding:10px 14px;border-radius:8px;font-size:13px;margin-top:8px";
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(function () { el.remove(); }, duration || 3200);
}

/* ─── نوافذ ─── */
function openModal(id)  { document.getElementById(id).classList.add("show"); }
function closeModal(id) { document.getElementById(id).classList.remove("show"); }

/* ─── تاريخ ─── */
function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" }); }
  catch (e) { return iso; }
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("ar", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return iso; }
}

/* ─── تهريب HTML ─── */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
