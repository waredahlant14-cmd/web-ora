/* =========================================================
   js/queue.js — IndexedDB-backed Offline Queue (طبقة دائمة)
   - يُكمّل قائمة المزامنة الموجودة في db.js (localStorage)
   - يحتفظ بنفس العمليات حتى عند مسح localStorage
   - يدعم تشغيل/إيقاف المزامنة التلقائية مع الحفظ الدائم
   ========================================================= */
(function () {
  var DB_NAME = "pos_offline_db_v1";
  var STORE   = "ops";
  var _db     = null;

  function open() {
    return new Promise(function (resolve, reject) {
      if (_db) return resolve(_db);
      if (!window.indexedDB) return reject(new Error("no-idb"));
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "qid", autoIncrement: false });
        }
      };
      req.onsuccess = function (e) { _db = e.target.result; resolve(_db); };
      req.onerror   = function (e) { reject(e); };
    });
  }

  function tx(mode) {
    return open().then(function (db) {
      return db.transaction(STORE, mode).objectStore(STORE);
    });
  }

  window.IDBQueue = {
    add: function (op) {
      return tx("readwrite").then(function (s) {
        if (!op.qid) op.qid = Date.now().toString(36) + Math.random().toString(36).slice(2,5);
        return new Promise(function (res, rej) {
          var r = s.put(op);
          r.onsuccess = function(){ res(op.qid); };
          r.onerror   = function(e){ rej(e); };
        });
      }).catch(function(){ /* fallback صامت */ });
    },
    all: function () {
      return tx("readonly").then(function (s) {
        return new Promise(function (res) {
          var out = []; var c = s.openCursor();
          c.onsuccess = function (e) {
            var cur = e.target.result;
            if (cur) { out.push(cur.value); cur.continue(); } else { res(out); }
          };
          c.onerror = function(){ res([]); };
        });
      }).catch(function(){ return []; });
    },
    remove: function (qid) {
      return tx("readwrite").then(function (s) {
        return new Promise(function (res) {
          var r = s.delete(qid); r.onsuccess = res; r.onerror = res;
        });
      }).catch(function(){});
    },
    count: function () {
      return this.all().then(function (a) { return a.length; });
    },
    clear: function () {
      return tx("readwrite").then(function (s) {
        return new Promise(function (res) { var r = s.clear(); r.onsuccess = res; r.onerror = res; });
      }).catch(function(){});
    }
  };

  /* ── تشغيل/إيقاف المزامنة التلقائية ── */
  var AUTO_KEY = "pos_autosync_enabled";
  window.isAutoSyncEnabled = function () {
    var v = localStorage.getItem(AUTO_KEY);
    return v === null ? true : v === "1";
  };
  window.setAutoSync = function (on) {
    localStorage.setItem(AUTO_KEY, on ? "1" : "0");
    if (typeof toast === "function") {
      toast(on ? "تم تفعيل المزامنة التلقائية"
               : "المزامنة التلقائية متوقفة — قد لا يتم رفع التغييرات إلى الخادم حتى تنفيذ مزامنة يدوية",
            on ? "success" : "error");
    }
  };

  /* اعتراض syncNow لاحترام إعداد الإيقاف */
  var _origSync = window.syncNow;
  if (typeof _origSync === "function") {
    window.syncNow = function (manual) {
      if (!manual && !window.isAutoSyncEnabled()) return;
      return _origSync.apply(this, arguments);
    };
  }

  /* اعتراض queueOp لنسخ العملية إلى IndexedDB أيضاً */
  if (typeof window.queueOp === "function") {
    var _origQ = window.queueOp;
    window.queueOp = function (op, table, data, match) {
      _origQ(op, table, data, match);
      window.IDBQueue.add({ op: op, table: table, data: data || null, match: match || null, at: new Date().toISOString() });
    };
  }
})();
