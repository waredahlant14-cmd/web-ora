/* js/currency.js — العملات والتسعير
   الأسعار تُحفظ دائماً بالدولار (USD) وتُعرض بالعملة النشطة.
   العملة الأساسية: الدولار الأمريكي USD */

var SETTINGS_KEY = "pos_app_settings";

var DEFAULT_CURRENCIES = [
  { code: "USD", symbol: "$",    name: "دولار أمريكي",   rate: 1,     flag: "🇺🇸" },
  { code: "SAR", symbol: "ر.س",  name: "ريال سعودي",     rate: 3.75,  flag: "🇸🇦" },
  { code: "AED", symbol: "د.إ",  name: "درهم إماراتي",   rate: 3.67,  flag: "🇦🇪" },
  { code: "KWD", symbol: "د.ك",  name: "دينار كويتي",    rate: 0.307, flag: "🇰🇼" },
  { code: "QAR", symbol: "ر.ق",  name: "ريال قطري",      rate: 3.64,  flag: "🇶🇦" },
  { code: "BHD", symbol: "د.ب",  name: "دينار بحريني",   rate: 0.376, flag: "🇧🇭" },
  { code: "OMR", symbol: "ر.ع",  name: "ريال عُماني",    rate: 0.385, flag: "🇴🇲" },
  { code: "EGP", symbol: "ج.م",  name: "جنيه مصري",      rate: 30.9,  flag: "🇪🇬" },
  { code: "JOD", symbol: "د.أ",  name: "دينار أردني",    rate: 0.709, flag: "🇯🇴" },
  { code: "EUR", symbol: "€",    name: "يورو",            rate: 0.92,  flag: "🇪🇺" },
  { code: "GBP", symbol: "£",    name: "جنيه إسترليني",  rate: 0.79,  flag: "🇬🇧" },
  { code: "TRY", symbol: "₺",    name: "ليرة تركية",     rate: 32.5,  flag: "🇹🇷" },
  { code: "IQD", symbol: "د.ع",  name: "دينار عراقي",    rate: 1310,  flag: "🇮🇶" },
  { code: "LBP", symbol: "ل.ل",  name: "ليرة لبنانية",   rate: 89500, flag: "🇱🇧" },
  { code: "SYP", symbol: "ل.س",  name: "ليرة سورية",     rate: 13000, flag: "🇸🇾" },
  { code: "MAD", symbol: "د.م",  name: "درهم مغربي",     rate: 10.1,  flag: "🇲🇦" },
  { code: "DZD", symbol: "د.ج",  name: "دينار جزائري",   rate: 135,   flag: "🇩🇿" },
  { code: "CNY", symbol: "¥",    name: "يوان صيني",      rate: 7.25,  flag: "🇨🇳" },
];

function getSettings() {
  try {
    var v = localStorage.getItem(SETTINGS_KEY);
    if (v) {
      var s = JSON.parse(v);
      if (!s.currencies || !s.currencies.length) s.currencies = DEFAULT_CURRENCIES;
      if (!s.activeCurrency) s.activeCurrency = "USD";
      return s;
    }
  } catch (e) {}
  return { activeCurrency: "USD", currencies: DEFAULT_CURRENCIES.slice() };
}

function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

function getActiveCurrency() {
  var s = getSettings();
  for (var i = 0; i < s.currencies.length; i++)
    if (s.currencies[i].code === s.activeCurrency) return s.currencies[i];
  return DEFAULT_CURRENCIES[0];
}

/* تحويل مبلغ بالدولار إلى نص بالعملة النشطة */
function formatPrice(usdAmount) {
  var c = getActiveCurrency();
  var val = Number(usdAmount) * c.rate;
  if (isNaN(val)) val = 0;
  var num = val.toFixed(2);
  if (val >= 1000) {
    var parts = num.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    num = parts.join(".");
  }
  return num + " " + c.symbol;
}

/* تحويل مبلغ بالعملة النشطة إلى دولار */
function toUSD(localAmount) {
  var c = getActiveCurrency();
  if (!c.rate) return Number(localAmount) || 0;
  return localAmount / c.rate;
}

function setActiveCurrency(code) {
  var s = getSettings();
  s.activeCurrency = code;
  saveSettings(s);
}

function updateCurrencyRate(code, rate) {
  var s = getSettings();
  for (var i = 0; i < s.currencies.length; i++)
    if (s.currencies[i].code === code) s.currencies[i].rate = rate;
  saveSettings(s);
}

function getCurrencyByCode(code) {
  var s = getSettings();
  for (var i = 0; i < s.currencies.length; i++)
    if (s.currencies[i].code === code) return s.currencies[i];
  return null;
}
