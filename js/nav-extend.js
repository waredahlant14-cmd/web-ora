/* =========================================================
   js/nav-extend.js — روابط الميزات الموسّعة v2 Desktop
   روابط .html بدلاً من .php
   ========================================================= */

(function () {
  var ICON = function (svg) {
    return '<span class="nav-icon" style="width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center">' + svg + '</span>';
  };

  var SVG = {
    tag:           '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    clock:         '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    truck:         '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    fileText:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>',
    clipboardList: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>',
    list:          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    shield:        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  };

  function getPageKey() { return window._NAV_ACTIVE_KEY || ''; }
  function section(label) { return '<div class="nav-section">' + label + '</div>'; }
  function link(href, key, svgName, label, adminOnly) {
    if (adminOnly) {
      var u = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
      if (!u || u.role !== 'admin') return '';
    }
    var active = getPageKey() === key ? ' active' : '';
    return '<a class="nav-link' + active + '" href="' + href + '">' +
      ICON(SVG[svgName]) + '<span>' + label + '</span></a>';
  }

  function inject(activeKey) {
    window._NAV_ACTIVE_KEY = activeKey;
    var nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    var html = '';
    html += section('مبيعات');
    html += link('offers.html',             'offers',             'tag',           'العروض والخصومات');
    html += link('customer-statement.html', 'customer-statement', 'list',          'كشف العملاء الآجل');
    html += section('الموردون');
    html += link('suppliers.html',          'suppliers', 'truck',         'الموردون');
    html += link('supplier-invoices.html',  'suppliers', 'fileText',      'فواتير المورد');
    html += link('supplier-statement.html', 'suppliers', 'clipboardList', 'كشف المورد');
    html += section('التشغيل');
    html += link('shifts.html',      'shifts',      'clock',  'الورديات');
    html += link('permissions.html', 'permissions', 'shield', 'الصلاحيات');
    nav.insertAdjacentHTML('beforeend', html);
  }

  function wrap() {
    if (typeof renderLayout === 'undefined') { setTimeout(wrap, 20); return; }
    var _orig = renderLayout;
    renderLayout = function (activeKey) {
      _orig(activeKey);
      inject(activeKey);
    };
  }
  wrap();
})();
