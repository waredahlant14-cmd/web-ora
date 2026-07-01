/* =========================================================
   js/print.js — طباعة الفواتير v5.0
   دعم 3 قوالب: كلاسيكي | حديث | حراري
   دعم أحجام الورق: A4 | A5 | حراري 80mm | حراري 58mm
   ========================================================= */

/* أحجام الورق — أبعاد الـ @page الفعلية (للطباعة) */
var PAPER_WIDTHS = { a4:"740px", a5:"520px", thermal80:"302px", thermal58:"210px" };
var PAPER_PAGE   = {
  a4:        { size:"A4",            width:"210mm", height:"297mm" },
  a5:        { size:"A5",            width:"148mm", height:"210mm" },
  thermal80: { size:"80mm auto",     width:"80mm",  height:"auto"  },
  thermal58: { size:"58mm auto",     width:"58mm",  height:"auto"  }
};

/* قائمة الخطوط المدعومة (تُحمَّل من Google Fonts عند الطباعة) */
var FONT_GOOGLE = {
  "Cairo":                  "Cairo:wght@400;500;600;700;800",
  "Tajawal":                "Tajawal:wght@400;500;700;800",
  "Almarai":                "Almarai:wght@400;700;800",
  "IBM Plex Sans Arabic":   "IBM+Plex+Sans+Arabic:wght@400;500;600;700",
  "Noto Naskh Arabic":      "Noto+Naskh+Arabic:wght@400;500;700",
  "Amiri":                  "Amiri:wght@400;700"
};

/* ─── بناء HTML الفاتورة الكامل (للطباعة) ─── */
function buildInvoiceHTML(invoice) {
  var cs        = (typeof getCustomSettings==="function") ? getCustomSettings() : {};
  var brand     = cs.companyName || (window.APP_CONFIG && APP_CONFIG.BRAND_NAME) || "WeB Ora";
  var color     = cs.primaryColor   || "#F57C20";
  var color2    = cs.secondaryColor || "#6B7280";
  var headClr   = cs.headingColor   || "#111827";
  var tmpl      = cs.invoiceTemplate|| "classic";
  var paper     = cs.paperSize      || "a4";
  var orient    = cs.orientation    || "portrait";
  var footer    = cs.invoiceFooter  || "شكراً لتعاملكم معنا";
  var width     = PAPER_WIDTHS[paper] || "740px";
  var fontFam   = cs.fontFamily     || "Cairo";
  var fontSize  = cs.fontSize       || 13;
  var fontWt    = cs.fontWeight     || "700";
  var showLogo  = !!cs.showLogo && !!cs.logoData;
  var logoSize  = cs.logoSize       || 80;
  var showCust  = cs.showCustomer !== false;
  var showNotes = cs.showNotes    !== false;
  var showTax   = !!cs.showTax;
  var showBC    = !!cs.showBarcode;

  /* v5.1: حجم الورقة يتغير فقط — الخط والعناصر تبقى ثابتة */
  var narrow = false;

  var paid   = invoice.paymentStatus==="مدفوع";
  var status = invoice.paymentStatus||"—";
  var statusColor = paid?"#065f46":"#991b1b";
  var statusBg    = paid?"#d1fae5":"#fee2e2";

  var bodyStyle  = "font-family:'"+fontFam+"',Cairo,sans-serif;font-weight:"+fontWt+";font-size:"+fontSize+"px;color:"+headClr+";padding:28px 32px;max-width:"+width+";margin:auto;background:#fff";
  var tableStyle = "width:100%;border-collapse:collapse;font-size:"+fontSize+"px";
  var thStyle    = "padding:10px 14px;text-align:right;background:#f6f7f9;font-size:"+(fontSize-1)+"px;font-weight:700;color:"+color2+";border-bottom:2px solid #e5e7eb";

  var rows = "";
  (invoice.items||[]).forEach(function(it){
    rows += '<tr>'+
      '<td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right">'+esc(it.name)+'</td>'+
      '<td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center">'+it.quantity+'</td>'+
      '<td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center">'+formatPrice(it.price)+'</td>'+
      '<td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700">'+formatPrice(it.total)+'</td>'+
      '</tr>';
  });

  var customerBlock = "";
  if (showCust && invoice.customer && invoice.customer.phone) {
    customerBlock =
      '<div style="background:#f0fdf4;border:1px solid #d1fae5;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:'+fontSize+'px;color:#374151">'+
      '<div style="font-size:11px;font-weight:700;color:#065f46;margin-bottom:4px">بيانات العميل</div>'+
      (invoice.customer.name?'الاسم: <strong>'+esc(invoice.customer.name)+'</strong> · ':'')+
      'الجوال: <strong style="direction:ltr;unicode-bidi:embed">'+esc(invoice.customer.phone)+'</strong>'+
      (invoice.customer.address?' · العنوان: <strong>'+esc(invoice.customer.address)+'</strong>':'')+
      '</div>';
  }

  /* رأس الشركة + الشعار */
  var logoHTML = showLogo ? '<img src="'+cs.logoData+'" style="max-height:'+logoSize+'px;max-width:'+(logoSize*2)+'px;object-fit:contain;margin-bottom:8px" alt="logo">' : '';
  var companyMeta = "";
  if (cs.companyPhone)   companyMeta += '<div>'+esc(cs.companyPhone)+'</div>';
  if (cs.companyAddress) companyMeta += '<div>'+esc(cs.companyAddress)+'</div>';
  if (cs.companyEmail)   companyMeta += '<div style="direction:ltr">'+esc(cs.companyEmail)+'</div>';
  if (showTax && cs.taxNumber) companyMeta += '<div>ضريبي: '+esc(cs.taxNumber)+'</div>';

  /* v5.1: الباركود يُرسم محلياً عبر JsBarcode (SVG) — يعمل بدون إنترنت */
  var barcodeHTML = showBC
    ? '<div style="text-align:center;margin:10px 0;direction:ltr"><svg class="invoice-barcode" data-barcode="'+esc(invoice.invoiceNumber)+'"></svg></div>'
    : '';

  var headerHTML = "";
  if (tmpl === "modern") {
    headerHTML =
      '<div style="background:'+color+';color:#fff;border-radius:12px;padding:20px 24px;margin-bottom:20px">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">'+
      '<div>'+ logoHTML +
      '<div style="font-size:22px;font-weight:800">'+esc(brand)+'</div>'+
      '<div style="opacity:.85;font-size:11px;margin-top:2px">'+companyMeta+'</div>'+
      '</div>'+
      '<div style="text-align:left;background:rgba(255,255,255,.15);border-radius:8px;padding:10px 16px">'+
      '<div style="font-size:12px;opacity:.85;margin-bottom:2px">فاتورة رقم</div>'+
      '<div style="font-size:16px;font-weight:800;direction:ltr">'+esc(invoice.invoiceNumber)+'</div>'+
      '<div style="font-size:11px;opacity:.85;margin-top:4px">'+fmtDate(invoice.date)+'</div>'+
      '</div></div></div>'+
      '<div style="margin-bottom:14px"><span style="background:'+statusBg+';color:'+statusColor+';padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700">'+esc(status)+'</span></div>';
  } else if (tmpl === "thermal") {
    headerHTML =
      '<div style="text-align:center;border-bottom:1px dashed #aaa;padding-bottom:10px;margin-bottom:12px">'+
      (showLogo ? '<img src="'+cs.logoData+'" style="max-height:'+logoSize+'px;max-width:'+(logoSize*2)+'px;object-fit:contain;margin-bottom:6px" alt="logo">' : '') +
      '<div style="font-size:18px;font-weight:800;color:'+color+'">'+esc(brand)+'</div>'+
      (companyMeta?'<div style="font-size:11px;color:#666;margin-top:4px">'+companyMeta+'</div>':'')+
      '<div style="font-size:'+fontSize+'px;margin-top:6px">فاتورة رقم: <strong style="direction:ltr;unicode-bidi:embed">'+esc(invoice.invoiceNumber)+'</strong></div>'+
      '<div style="font-size:'+fontSize+'px;color:#555">'+fmtDate(invoice.date)+'</div>'+
      '<div style="margin-top:4px"><span style="background:'+statusBg+';color:'+statusColor+';padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">'+esc(status)+'</span></div>'+
      '</div>';
  } else {
    headerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;border-bottom:3px solid '+color+';padding-bottom:16px;margin-bottom:20px">'+
      '<div>'+ logoHTML +
      '<div style="font-size:22px;font-weight:800;color:'+color+'">'+esc(brand)+'</div>'+
      (companyMeta?'<div style="font-size:11px;color:'+color2+';margin-top:2px">'+companyMeta+'</div>':'')+
      '</div>'+
      '<div style="text-align:left">'+
      '<div style="font-size:13px;margin-bottom:3px">رقم: <strong style="direction:ltr;unicode-bidi:embed">'+esc(invoice.invoiceNumber)+'</strong></div>'+
      '<div style="font-size:13px;margin-bottom:4px">التاريخ: '+fmtDate(invoice.date)+'</div>'+
      '<span style="background:'+statusBg+';color:'+statusColor+';padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700">'+esc(status)+'</span>'+
      '</div></div>';
  }

  var invoiceBody =
    headerHTML +
    customerBlock +
    barcodeHTML +
    '<table style="'+tableStyle+'"><thead><tr>'+
    '<th style="'+thStyle+';text-align:right">المنتج</th>'+
    '<th style="'+thStyle+';text-align:center">الكمية</th>'+
    '<th style="'+thStyle+';text-align:center">سعر الوحدة</th>'+
    '<th style="'+thStyle+';text-align:center">الإجمالي</th>'+
    '</tr></thead><tbody>'+rows+'</tbody></table>'+
    '<div style="text-align:left;margin-top:20px">'+
    '<div style="background:#fff3e8;border-radius:8px;display:inline-block;padding:12px 20px">'+
    '<div style="font-size:11px;color:'+color2+'">الإجمالي الكلي</div>'+
    '<div style="font-size:22px;font-weight:800;color:'+color+'">'+formatPrice(invoice.total)+'</div>'+
    '</div></div>'+
    (showNotes && invoice.notes ? '<div style="margin-top:12px;padding:10px 14px;background:#fff3e8;border-radius:8px;font-size:12px;color:'+color2+'">ملاحظات: '+esc(invoice.notes)+'</div>':'')+
    (typeof buildMultiCurrencyBlock==='function' ? buildMultiCurrencyBlock(invoice.total) : '') +
    '<div style="margin-top:24px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:10px">'+
    esc(footer)+' — '+esc(brand)+
    '</div>';

  /* قاعدة @page تتحكم بالورقة فقط — لا تؤثر على الخطوط */
  var page = PAPER_PAGE[paper] || PAPER_PAGE.a4;
  var pageCSS = "@page { size: "+(page.size)+" "+orient+"; margin: "+(paper==="thermal80"||paper==="thermal58" ? "4mm" : "10mm")+"; }";

  /* خطوط Google (مع fallback محلي عند انقطاع الإنترنت) */
  var fontParam = FONT_GOOGLE[fontFam] || FONT_GOOGLE["Cairo"];
  var fontUrl   = "https://fonts.googleapis.com/css2?family="+fontParam+"&display=swap";

  /* JsBarcode محلي — inline ليعمل داخل data: URL أو popup بلا base URL */
  var barcodeScript = "";
  if (showBC) {
    var _bsrc = (typeof window!=="undefined" && window.__JSBARCODE_SRC) ? window.__JSBARCODE_SRC : "";
    barcodeScript = (_bsrc ? '<script>'+_bsrc+'<\/script>' : '<script src="js/jsbarcode.min.js"><\/script>')+
      '<script>function _renderBC(){try{document.querySelectorAll("[data-barcode]").forEach(function(n){var v=n.getAttribute("data-barcode");if(!v||!window.JsBarcode)return;JsBarcode(n,String(v),{format:"CODE128",width:2,height:50,displayValue:true,fontSize:14,margin:4,background:"#ffffff"});});}catch(e){}}<\/script>';
  }

  /* انتظار تحميل الخطوط + رسم الباركود ثم الطباعة */
  var autoPrint =
    '<script>(function(){function go(){'+ (showBC?'_renderBC();':'') +
    'setTimeout(function(){try{window.focus();window.print();}catch(e){}},250);} '+
    'if(document.fonts&&document.fonts.ready){document.fonts.ready.then(go).catch(function(){setTimeout(go,500);});}else{setTimeout(go,500);} '+
    '})();<\/script>';

  /* base href يجعل المسارات النسبية تعمل داخل popup/data URL */
  var baseHref = '';
  try { baseHref = (typeof document!=="undefined" && document.baseURI) ? document.baseURI : ''; } catch(e){}
  var baseTag = baseHref ? '<base href="'+baseHref+'">' : '';
  /* تحميل خط Google فقط عند توفر الإنترنت — وإلا نعتمد على الخطوط النظامية */
  var fontLink = (typeof navigator!=="undefined" && navigator.onLine===false) ? '' : '<link href="'+fontUrl+'" rel="stylesheet" crossorigin="anonymous">';
  var fontFallback = "body,table,th,td{font-family:'"+fontFam+"','Segoe UI',Tahoma,Arial,sans-serif !important}";

  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">'+ baseTag +
    '<title>فاتورة '+esc(invoice.invoiceNumber)+'</title>'+
    fontLink +
    '<style>'+pageCSS+' '+fontFallback+' body{'+bodyStyle+'} table{'+tableStyle+'} .invoice-barcode{max-width:100%;height:auto}</style>'+
    barcodeScript +
    '</head><body>'+invoiceBody+ autoPrint +'</body></html>';
}

/* ─── طباعة (مع تفضيل الطباعة الصامتة في Electron) ─── */
function printInvoice(invoice, opts) {
  opts = opts || {};
  var cs = (typeof getCustomSettings==="function") ? getCustomSettings() : {};
  var html = buildInvoiceHTML(invoice);

  /* في Electron Desktop: استخدم الطباعة الفورية بدون حوار حفظ ملف */
  if (window.electronAPI && window.electronAPI.silentPrint && cs.silentPrint !== false) {
    var printOpts = {
      deviceName: cs.printerName || opts.printerName || undefined,
      copies:     opts.copies || cs.printCopies || 1,
      color:      cs.printColor !== false
    };
    window.electronAPI.silentPrint(html, printOpts).then(function (r) {
      if (!r || !r.ok) {
        /* fallback: نافذة منبثقة */
        _openPrintWindow(html);
        if (typeof ntfToast === "function") ntfToast("تعذرت الطباعة الصامتة — فُتحت نافذة الطباعة", "warning");
      } else {
        if (typeof ntfToast === "function") ntfToast("تم إرسال الفاتورة للطابعة", "success", 2000);
      }
    }).catch(function () { _openPrintWindow(html); });
    return;
  }

  _openPrintWindow(html);
}

function _openPrintWindow(html) {
  var w = window.open("","_blank");
  if (!w) { if (typeof toast==="function") toast("اسمح بالنوافذ المنبثقة للطباعة","error"); return; }
  w.document.write(html);
  w.document.close();
  /* الطباعة التلقائية مُدمجة داخل HTML نفسها بعد تحميل الخطوط */
}

/* ─── المحتوى الداخلي (لـ html2canvas) ─── */
function buildInvoiceInnerHTML(invoice) {
  var cs     = (typeof getCustomSettings==="function") ? getCustomSettings() : {};
  var brand  = cs.companyName || (window.APP_CONFIG&&APP_CONFIG.BRAND_NAME) || "WeB Ora";
  var color  = cs.primaryColor || "#F57C20";
  var footer = cs.invoiceFooter || "شكراً لتعاملكم معنا";
  var paid   = invoice.paymentStatus==="مدفوع";
  var statusColor = paid?"#065f46":"#991b1b";
  var statusBg    = paid?"#d1fae5":"#fee2e2";

  var rows = "";
  (invoice.items||[]).forEach(function(it){
    rows += '<tr>'+
      '<td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right">'+esc(it.name)+'</td>'+
      '<td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center">'+it.quantity+'</td>'+
      '<td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center">'+formatPrice(it.price)+'</td>'+
      '<td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700">'+formatPrice(it.total)+'</td>'+
      '</tr>';
  });
  var customerBlock = "";
  if (invoice.customer&&invoice.customer.phone) {
    customerBlock = '<div style="background:#f0fdf4;border:1px solid #d1fae5;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#374151">'+
      '<strong style="display:block;color:#065f46;font-size:11px;margin-bottom:4px">بيانات العميل</strong>'+
      (invoice.customer.name?'الاسم: <strong>'+esc(invoice.customer.name)+'</strong> · ':'')+
      'الجوال: <strong>'+esc(invoice.customer.phone)+'</strong>'+
      (invoice.customer.address?' · العنوان: <strong>'+esc(invoice.customer.address)+'</strong>':'')+
      '</div>';
  }
  return '<div style="border-bottom:3px solid '+color+';padding-bottom:16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start">'+
    '<div><div style="font-size:22px;font-weight:800;color:'+color+'">'+esc(brand)+'</div>'+
    '<div style="font-size:12px;color:#6b7280">فاتورة مبيعات</div></div>'+
    '<div style="text-align:left"><div style="font-size:13px;margin-bottom:3px">رقم: <strong>'+esc(invoice.invoiceNumber)+'</strong></div>'+
    '<div style="font-size:13px;margin-bottom:6px">'+fmtDate(invoice.date)+'</div>'+
    '<span style="background:'+statusBg+';color:'+statusColor+';padding:2px 10px;border-radius:20px;font-size:12px;font-weight:700">'+esc(invoice.paymentStatus||"—")+'</span>'+
    '</div></div>'+customerBlock+
    '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f6f7f9">'+
    '<th style="padding:10px 14px;text-align:right;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb">المنتج</th>'+
    '<th style="padding:10px 14px;text-align:center;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb">الكمية</th>'+
    '<th style="padding:10px 14px;text-align:center;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb">السعر</th>'+
    '<th style="padding:10px 14px;text-align:center;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb">الإجمالي</th>'+
    '</tr></thead><tbody>'+rows+'</tbody></table>'+
    '<div style="text-align:left;margin-top:20px"><div style="background:#fff3e8;border-radius:8px;display:inline-block;padding:12px 20px">'+
    '<div style="font-size:12px;color:#6b7280">الإجمالي</div>'+
    '<div style="font-size:22px;font-weight:800;color:'+color+'">'+formatPrice(invoice.total)+'</div>'+
    '</div></div>'+
    (invoice.notes?'<div style="margin-top:12px;padding:10px 14px;background:#fff3e8;border-radius:8px;font-size:12px;color:#6b7280">ملاحظات: '+esc(invoice.notes)+'</div>':'')+
    '<div style="margin-top:24px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px">'+esc(footer)+' — '+esc(brand)+'</div>';
}

/* ─── تصدير كصورة ─── */
async function exportInvoiceAsImage(invoice) {
  if (!window.html2canvas) { toast("جارٍ تحميل مكتبة التصدير…",""); await loadHtml2Canvas(); }
  var wrapper = document.createElement("div");
  wrapper.style.cssText = "position:fixed;top:-99999px;left:-99999px;width:740px;font-family:Cairo,sans-serif;background:#fff;color:#111;padding:28px 32px;box-sizing:border-box;direction:rtl;";
  wrapper.innerHTML = buildInvoiceInnerHTML(invoice);
  document.body.appendChild(wrapper);
  try {
    var canvas = await html2canvas(wrapper,{scale:2,useCORS:true,backgroundColor:"#ffffff",logging:false});
    var link = document.createElement("a");
    link.download = "فاتورة-"+invoice.invoiceNumber+".png";
    link.href = canvas.toDataURL("image/png"); link.click();
    toast("تم تصدير الفاتورة كصورة","success");
  } catch(e) { toast("تعذّر التصدير: "+e.message,"error"); }
  finally { document.body.removeChild(wrapper); }
}

/* ─── تصدير قسم كصورة ─── */
async function exportElementAsImage(elementId, filename) {
  if (!window.html2canvas) { toast("جارٍ تحميل مكتبة التصدير…",""); await loadHtml2Canvas(); }
  var el = document.getElementById(elementId);
  if (!el) { toast("العنصر غير موجود","error"); return; }
  try {
    var canvas = await html2canvas(el,{scale:2,useCORS:true,backgroundColor:document.documentElement.classList.contains("dark")?"#1C2230":"#ffffff",logging:false});
    var link = document.createElement("a");
    link.download = (filename||"webora-export")+".png";
    link.href = canvas.toDataURL("image/png"); link.click();
    toast("تم التصدير كصورة","success");
  } catch(e) { toast("تعذّر التصدير","error"); }
}

function loadHtml2Canvas() {
  return new Promise(function(resolve,reject){
    if(window.html2canvas){resolve();return;}
    var s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s.onload=resolve; s.onerror=reject;
    document.head.appendChild(s);
  });
}


/* v5.2.5 patch — multi-currency invoice block
   This file is appended at the end of print.js */

/* ─── تنسيق السعر بعملة محددة (v5.2.5) ─── */
function formatPriceByCurrency(usdAmount, currencyCode) {
  var s = (typeof getSettings === 'function') ? getSettings() : { currencies: [] };
  var curs = s.currencies || [];
  var cur = null;
  for (var i = 0; i < curs.length; i++) {
    if (curs[i].code === currencyCode) { cur = curs[i]; break; }
  }
  if (!cur) {
    var FALLBACKS = {
      SYP: { symbol: '\u0644.\u0633', rate: 13000 },
      USD: { symbol: '$',            rate: 1      },
      TRY: { symbol: '\u20ba',       rate: 32.5   }
    };
    var fb = FALLBACKS[currencyCode];
    if (fb) cur = { code: currencyCode, symbol: fb.symbol, rate: fb.rate };
  }
  if (!cur) return usdAmount;
  var val = Number(usdAmount) * cur.rate;
  if (isNaN(val)) val = 0;
  var decimals = (currencyCode === 'SYP') ? 0 : 2;
  var num = val.toFixed(decimals);
  if (val >= 1000) {
    var parts = num.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    num = parts.join('.');
  }
  return num + ' ' + cur.symbol;
}

/* ─── بناء قسم الأسعار الثلاثة للفاتورة ─── */
function buildMultiCurrencyBlock(totalUSD) {
  return (
    '<div style="margin-top:14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:10px 16px">' +
    '<div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:6px">المبلغ بالعملات الثلاث</div>' +
    '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">' +

    '<div style="text-align:center;min-width:110px">' +
    '<div style="font-size:10px;color:#9ca3af;margin-bottom:2px">\uD83C\uDDF8\uD83C\uDDFE \u0644\u064A\u0631\u0629 \u0633\u0648\u0631\u064A\u0629</div>' +
    '<div style="font-weight:800;font-size:15px;color:#374151">' + formatPriceByCurrency(totalUSD, 'SYP') + '</div>' +
    '</div>' +

    '<div style="text-align:center;min-width:110px;border-right:1px solid #e5e7eb;border-left:1px solid #e5e7eb;padding:0 12px">' +
    '<div style="font-size:10px;color:#9ca3af;margin-bottom:2px">\uD83C\uDDFA\uD83C\uDDF8 \u062F\u0648\u0644\u0627\u0631 \u0623\u0645\u0631\u064A\u0643\u064A</div>' +
    '<div style="font-weight:800;font-size:15px;color:#374151">' + formatPriceByCurrency(totalUSD, 'USD') + '</div>' +
    '</div>' +

    '<div style="text-align:center;min-width:110px">' +
    '<div style="font-size:10px;color:#9ca3af;margin-bottom:2px">\uD83C\uDDF9\uD83C\uDDF7 \u0644\u064A\u0631\u0629 \u062A\u0631\u0643\u064A\u0629</div>' +
    '<div style="font-weight:800;font-size:15px;color:#374151">' + formatPriceByCurrency(totalUSD, 'TRY') + '</div>' +
    '</div>' +

    '</div></div>'
  );
}
