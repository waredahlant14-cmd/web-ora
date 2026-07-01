/* =========================================================
   js/auth.js — المصادقة الآمنة v5.1 Desktop Edition
   SHA-256 | حد المحاولات | انتهاء الجلسة | ترحيل تلقائي
   ========================================================= */

var AUTH_KEY     = "pos_auth_session";
var USERS_KEY    = "pos_auth_users";
var FAILS_KEY    = "pos_login_fails";
var SESSION_TTL  = 30 * 24 * 60 * 60 * 1000;
var MAX_FAILS    = 5;
var LOCKOUT_MS   = 15 * 60 * 1000;

/* ─── SHA-256 ─── */
async function hashPassword(pw) {
  var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf))
    .map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
}
function isHashed(p) {
  return typeof p === "string" && p.length === 64 && /^[0-9a-f]+$/.test(p);
}

/* ─── حد المحاولات ─── */
function getFails() {
  try { return JSON.parse(localStorage.getItem(FAILS_KEY)) || { n: 0, until: 0 }; }
  catch (e) { return { n: 0, until: 0 }; }
}
function saveFails(f) { localStorage.setItem(FAILS_KEY, JSON.stringify(f)); }
function isLockedOut() { var f = getFails(); return !!(f.until && Date.now() < f.until); }
function lockoutRemainMins() { var f = getFails(); return Math.max(1, Math.ceil((f.until - Date.now()) / 60000)); }
function recordFail() {
  var f = getFails(); f.n = (f.n || 0) + 1;
  if (f.n >= MAX_FAILS) f.until = Date.now() + LOCKOUT_MS;
  saveFails(f); return MAX_FAILS - f.n;
}
function resetFails() { localStorage.removeItem(FAILS_KEY); }

/* ─── المستخدمون ─── */
function getUsers() {
  try {
    var v = localStorage.getItem(USERS_KEY);
    if (v) return JSON.parse(v);
  } catch (e) {}
  var cfg = window.APP_CONFIG || {};
  return [{
    id: "1", username: cfg.DEFAULT_ADMIN_USER || "admin",
    password: cfg._INIT_HASH || "", name: "المدير", role: "admin", pwv: 0
  }];
}
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

/* ─── تهيئة كلمة المرور الافتراضية ─── */
(function initDefaultPassword() {
  var cfg = window.APP_CONFIG || {};
  if (!cfg.DEFAULT_ADMIN_PASS) return;
  var users = getUsers();
  for (var i = 0; i < users.length; i++) {
    if (!isHashed(users[i].password)) {
      (function (idx, pw) {
        hashPassword(pw).then(function (h) {
          var u2 = getUsers();
          if (u2[idx] && u2[idx].id === users[idx].id && !isHashed(u2[idx].password)) {
            u2[idx].password = h; u2[idx].pwv = 1; saveUsers(u2);
          }
        });
      })(i, users[i].password || cfg.DEFAULT_ADMIN_PASS);
    }
  }
})();

/* ─── بصمة المتصفح ─── */
async function browserFingerprint() {
  try {
    var raw = (navigator.userAgent || "") + "|" + (navigator.language || "") +
      "|" + (screen.width + "x" + screen.height) + "|" + (new Date().getTimezoneOffset());
    var b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, "0"); }).join("").slice(0, 32);
  } catch (e) { return ""; }
}
function newSid() {
  try {
    var a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.from(a).map(function (x) { return x.toString(16).padStart(2, "0"); }).join("");
  } catch (e) { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
}

/* ─── الجلسة ─── */
function getCurrentUser() {
  try {
    var v = localStorage.getItem(AUTH_KEY);
    if (!v) return null;
    var s = JSON.parse(v);
    if (!s || !s.u || !s.sid) return null;
    if (Date.now() - s.ts > SESSION_TTL) { localStorage.removeItem(AUTH_KEY); return null; }
    s.ts = Date.now();
    localStorage.setItem(AUTH_KEY, JSON.stringify(s));
    return s.u;
  } catch (e) { return null; }
}
async function setSession(user) {
  var safe = { id: user.id, username: user.username, name: user.name, role: user.role };
  var fp = await browserFingerprint();
  localStorage.setItem(AUTH_KEY, JSON.stringify({ u: safe, sid: newSid(), fp: fp, ts: Date.now() }));
}

/* ─── تسجيل الدخول ─── */
async function login(username, password) {
  if (!username || !password) return { error: "empty" };
  if (isLockedOut()) return { error: "locked", mins: lockoutRemainMins() };
  var hash = await hashPassword(password);
  var cfg  = window.APP_CONFIG || {};

  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase && navigator.onLine) {
    try {
      var sb = (typeof SB !== "undefined" && SB) ? SB
        : window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      var r = await sb.from("app_users").select("id,username,password,name,role,active")
        .eq("username", username).limit(1);
      if (!r.error && r.data && r.data.length) {
        var ru = r.data[0];
        if (ru.active === false) { recordFail(); return { error: "invalid", remaining: 0 }; }
        var ok = isHashed(ru.password) ? (ru.password === hash) : (ru.password === password);
        if (ok) {
          var local = getUsers(); var found = false;
          for (var k = 0; k < local.length; k++) {
            if (local[k].username === ru.username) {
              local[k].password = hash; local[k].name = ru.name || local[k].name;
              local[k].role = ru.role || local[k].role; local[k].id = String(ru.id || local[k].id);
              local[k].pwv = 1; found = true; break;
            }
          }
          if (!found) local.push({ id: String(ru.id || Date.now()), username: ru.username, password: hash, name: ru.name || ru.username, role: ru.role || "cashier", pwv: 1 });
          saveUsers(local); resetFails();
          var su = { id: String(ru.id), username: ru.username, name: ru.name || ru.username, role: ru.role || "cashier" };
          await setSession(su);
          return { success: true, user: su };
        }
        var remW = recordFail();
        return { error: "invalid", remaining: Math.max(0, remW) };
      }
    } catch (e) {}
  }

  /* محلي */
  var users = getUsers();
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (u.username !== username) continue;
    var match = isHashed(u.password) ? (u.password === hash) : (u.password === password);
    if (match && !isHashed(u.password)) { u.password = hash; u.pwv = 1; saveUsers(users); }
    if (match) {
      resetFails(); await setSession(u);
      return { success: true, user: { id: u.id, username: u.username, name: u.name, role: u.role } };
    }
    break;
  }
  var rem = recordFail();
  return { error: "invalid", remaining: Math.max(0, rem) };
}

/* ─── تغيير كلمة المرور ─── */
async function changeUserPassword(userId, newPassword) {
  if (!newPassword || newPassword.length < 4) return false;
  var users = getUsers();
  var h = await hashPassword(newPassword);
  var targetUser = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].id === userId) { users[i].password = h; users[i].pwv = 1; targetUser = users[i]; }
  }
  saveUsers(users);
  var cfg = window.APP_CONFIG || {};
  if (targetUser && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase && navigator.onLine) {
    try {
      var sb = (typeof SB !== "undefined" && SB) ? SB
        : window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      await sb.from("app_users").update({ password: h }).eq("username", targetUser.username);
    } catch (e) {}
  }
  return true;
}

/* ─── إنشاء مستخدم ─── */
async function createUser(username, password, name, role) {
  var users = getUsers();
  if (users.some(function (u) { return u.username === username; })) return { error: "duplicate" };
  var h = await hashPassword(password);
  var newId = Date.now().toString();
  var newUser = { id: newId, username: username, password: h, name: name || username, role: role || "cashier", pwv: 1 };
  users.push(newUser); saveUsers(users);
  var cfg = window.APP_CONFIG || {};
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && navigator.onLine) {
    try {
      var sb = (typeof SB !== "undefined" && SB) ? SB : null;
      if (!sb && window.supabase) sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      if (!sb) return { success: true, cloud: false };
      var r = await sb.from("app_users").upsert([{ username: username, password: h, name: name || username, role: role || "cashier", active: true, pwv: 1 }], { onConflict: "username" });
      if (!r.error) {
        var r2 = await sb.from("app_users").select("id").eq("username", username).single();
        if (r2.data) {
          var fresh = getUsers();
          for (var i = 0; i < fresh.length; i++) { if (fresh[i].username === username) { fresh[i].id = String(r2.data.id); break; } }
          saveUsers(fresh);
        }
        return { success: true, cloud: true };
      }
    } catch (e) {}
  }
  return { success: true, cloud: false };
}

/* ─── حذف مستخدم ─── */
async function deleteUserFromCloud(username) {
  var cfg = window.APP_CONFIG || {};
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase && navigator.onLine) {
    try {
      var sb = (typeof SB !== "undefined" && SB) ? SB
        : window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      await sb.from("app_users").delete().eq("username", username);
    } catch (e) {}
  }
}

/* ─── تسجيل الخروج — Desktop Edition ─── */
function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.href = "login.html";
}

function isLoggedIn()  { return getCurrentUser() !== null; }
function isAdmin()     { var u = getCurrentUser(); return u !== null && u.role === "admin"; }
function requireLogin() {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
  }
}
