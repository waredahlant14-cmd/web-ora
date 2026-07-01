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
