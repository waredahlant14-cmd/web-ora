/* =========================================================
   js/silent-print.js — طباعة فورية بدون حفظ ملف ولا حوار
   v5.1 — يستخدم Electron silent print إن توفّر،
          ويعود للطباعة العادية في المتصفح.
   ========================================================= */
(function () {

  /* انتظار تحميل الخطوط لضمان ظهور الباركود والعربية صحيحة */
  function whenFontsReady(doc, cb) {
    try {
      if (doc.fonts && doc.fonts.ready && typeof doc.fonts.ready.then === "function") {
        doc.fonts.ready.then(cb).catch(function(){ setTimeout(cb, 400); });
      } else { setTimeout(cb, 400); }
    } catch(e) { setTimeout(cb, 400); }
  }

  /* رسم الباركود محلياً (JsBarcode) — يعمل بدون إنترنت */
  function injectBarcodes(doc) {
    try {
      if (!doc.defaultView || !doc.defaultView.JsBarcode) return;
      var nodes = doc.querySelectorAll("[data-barcode]");
      nodes.forEach(function (n) {
        var val = n.getAttribute("data-barcode");
        if (!val) return;
        var svg = doc.createElementNS("http://www.w3.org/2000/svg","svg");
        n.innerHTML = ""; n.appendChild(svg);
        try {
          doc.defaultView.JsBarcode(svg, String(val), {
            format: "CODE128",
            width: 2, height: 50, displayValue: true,
            fontSize: 14, margin: 4, background: "#ffffff"
          });
        } catch(e) {
          n.textContent = "*" + val + "*";
        }
      });
    } catch(e) {}
  }

  /* طباعة فورية في Electron — بدون حوار */
  function electronSilent(html, opts) {
    return new Promise(function (resolve) {
      if (!(window.electronAPI && window.electronAPI.silentPrint)) return resolve(false);
      window.electronAPI.silentPrint(html, opts || {}).then(function (r) {
        resolve(!!(r && r.ok));
      }).catch(function(){ resolve(false); });
    });
  }

  /* طباعة عبر iframe مخفي (متصفح/Electron عادي) */
  function browserPrint(html, cb) {
    var iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:-99999px;bottom:-99999px;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    var win = iframe.contentWindow;
    whenFontsReady(doc, function () {
      injectBarcodes(doc);
      setTimeout(function () {
        try { win.focus(); win.print(); } catch(e){}
        setTimeout(function () {
          try { iframe.remove(); } catch(e){}
          if (cb) cb();
        }, 800);
      }, 150);
    });
  }

  /* الواجهة العامة: طباعة HTML فاتورة كاملة */
  async function silentPrintHTML(html, opts) {
    opts = opts || {};
    /* جرّب Electron أولاً */
    var ok = await electronSilent(html, opts);
    if (ok) return true;
    /* وإلا طباعة المتصفح بدون حوار حفظ */
    browserPrint(html);
    return true;
  }

  /* طباعة فاتورة جاهزة (تستخدم buildInvoiceHTML من print.js) */
  async function silentPrintInvoice(invoice, opts) {
    if (typeof buildInvoiceHTML !== "function") {
      if (typeof ntfToast === "function") ntfToast("وحدة الطباعة غير محمّلة", "error");
      return false;
    }
    /* buildInvoiceHTML يضمّن JsBarcode inline تلقائياً (v5.1) */
    var html = buildInvoiceHTML(invoice);
    return silentPrintHTML(html, opts);
  }

  window.silentPrintHTML    = silentPrintHTML;
  window.silentPrintInvoice = silentPrintInvoice;
})();
