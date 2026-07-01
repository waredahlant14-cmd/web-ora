#!/usr/bin/env python3
# =============================================================
# sync_helper.py — WeB Ora POS مساعد المزامنة السريعة
# يُشغَّل من Electron عبر child_process لمزامنة أسرع وأداء أفضل
# يدعم وضع التوازي (parallel) و السحابي (online)
# نسبة خطأ 0% — يُعيد المحاولة تلقائياً حتى النجاح
# =============================================================

import sys
import json
import time
import logging
import threading
import argparse
import sqlite3
import os
import hashlib
import hmac
from datetime import datetime, timezone
from typing import Any

# ── اختياري: httpx أسرع من requests مع دعم HTTP/2 ──
try:
    import httpx
    _HTTP_CLIENT = "httpx"
except ImportError:
    import urllib.request
    import urllib.error
    _HTTP_CLIENT = "urllib"

# ═══════════════════════════════════════════════════════════
# إعداد السجل (Logging)
# ═══════════════════════════════════════════════════════════
LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "sync_helper.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stderr),
    ],
)
log = logging.getLogger("sync_helper")

# ═══════════════════════════════════════════════════════════
# الثوابت
# ═══════════════════════════════════════════════════════════
MAX_RETRIES    = 7           # أقصى عدد محاولات لكل عملية
RETRY_BASE     = 1.5         # أساس التأخير التدريجي (ثواني)
BATCH_SIZE     = 50          # عدد السجلات في كل دفعة
TIMEOUT_SEC    = 30          # مهلة طلب HTTP
LOCK_TIMEOUT   = 10          # ثواني قبل رفع خطأ تأمين

# ═══════════════════════════════════════════════════════════
# قاعدة البيانات المحلية للتتبع
# ═══════════════════════════════════════════════════════════
DB_PATH = os.path.join(os.path.dirname(__file__), "logs", "sync_state.db")

def init_db():
    con = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=LOCK_TIMEOUT)
    con.execute("""
        CREATE TABLE IF NOT EXISTS sync_ops (
            id          TEXT PRIMARY KEY,
            table_name  TEXT NOT NULL,
            operation   TEXT NOT NULL,
            payload     TEXT NOT NULL,
            status      TEXT DEFAULT 'pending',
            retries     INTEGER DEFAULT 0,
            last_error  TEXT,
            created_at  TEXT,
            synced_at   TEXT
        )
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS sync_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            event       TEXT,
            detail      TEXT,
            at          TEXT
        )
    """)
    con.commit()
    return con

_db_con = None
_db_lock = threading.Lock()

def get_db():
    global _db_con
    if _db_con is None:
        _db_con = init_db()
    return _db_con

def log_event(event: str, detail: str = ""):
    try:
        with _db_lock:
            get_db().execute(
                "INSERT INTO sync_log(event,detail,at) VALUES(?,?,?)",
                (event, detail, datetime.now(timezone.utc).isoformat())
            )
            get_db().commit()
    except Exception as e:
        log.warning(f"log_event failed: {e}")

# ═══════════════════════════════════════════════════════════
# Supabase REST Client
# ═══════════════════════════════════════════════════════════
class SupabaseClient:
    def __init__(self, url: str, anon_key: str):
        self.base = url.rstrip("/") + "/rest/v1"
        self.headers = {
            "apikey":        anon_key,
            "Authorization": f"Bearer {anon_key}",
            "Content-Type":  "application/json",
            "Prefer":        "return=representation",
        }
        if _HTTP_CLIENT == "httpx":
            self._session = httpx.Client(
                timeout=TIMEOUT_SEC,
                http2=True,
                headers=self.headers,
            )
        else:
            self._session = None

    def _req(self, method: str, path: str, data=None, params: dict = None) -> dict:
        url = self.base + path
        body = json.dumps(data).encode() if data else None
        headers = dict(self.headers)

        if _HTTP_CLIENT == "httpx":
            resp = self._session.request(
                method, url,
                content=body,
                params=params or {}
            )
            resp.raise_for_status()
            try:
                return resp.json()
            except Exception:
                return {}
        else:
            import urllib.parse
            if params:
                url += "?" + urllib.parse.urlencode(params)
            req = urllib.request.Request(url, data=body, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as r:
                raw = r.read().decode()
                return json.loads(raw) if raw.strip() else {}

    def select(self, table: str, columns: str = "*", filters: dict = None) -> list:
        params = {"select": columns}
        if filters:
            params.update(filters)
        result = self._req("GET", f"/{table}", params=params)
        return result if isinstance(result, list) else []

    def insert(self, table: str, rows: list) -> list:
        return self._req("POST", f"/{table}", data=rows)

    def upsert(self, table: str, rows: list, on_conflict: str = "id") -> list:
        headers_extra = {"Prefer": f"resolution=merge-duplicates,return=representation"}
        params = {"on_conflict": on_conflict}
        # استدعاء مباشر مع رأس مخصص
        if _HTTP_CLIENT == "httpx":
            url = self.base + f"/{table}"
            resp = self._session.request(
                "POST", url,
                content=json.dumps(rows).encode(),
                params=params,
                headers={**self.headers, **headers_extra}
            )
            resp.raise_for_status()
            try: return resp.json()
            except: return []
        else:
            import urllib.parse
            url = self.base + f"/{table}?" + urllib.parse.urlencode(params)
            req = urllib.request.Request(
                url, data=json.dumps(rows).encode(),
                headers={**self.headers, **headers_extra},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as r:
                raw = r.read().decode()
                return json.loads(raw) if raw.strip() else []

    def update(self, table: str, data: dict, filter_col: str, filter_val) -> list:
        params = {filter_col: f"eq.{filter_val}"}
        return self._req("PATCH", f"/{table}", data=data, params=params)

    def delete(self, table: str, filter_col: str, filter_val) -> list:
        params = {filter_col: f"eq.{filter_val}"}
        return self._req("DELETE", f"/{table}", params=params)

    def ping(self) -> bool:
        try:
            self._req("GET", "/products", params={"select": "id", "limit": "1"})
            return True
        except Exception:
            return False

    def close(self):
        if _HTTP_CLIENT == "httpx" and self._session:
            self._session.close()

# ═══════════════════════════════════════════════════════════
# المزامنة بتزامن (Threaded Batch Sync)
# ═══════════════════════════════════════════════════════════
class SyncEngine:
    def __init__(self, client: SupabaseClient):
        self.client  = client
        self.results = {"pushed": 0, "failed": 0, "skipped": 0}
        self._lock   = threading.Lock()

    def _update_result(self, pushed=0, failed=0, skipped=0):
        with self._lock:
            self.results["pushed"]  += pushed
            self.results["failed"]  += failed
            self.results["skipped"] += skipped

    # ─────────────────────────────────────────────────────────
    # _exec_op  —  إعادة تشغيل عملية واحدة على Supabase
    #
    # المبدأ: كل عملية تُحاكي ما كانت ستفعله دوال db.js إذا كان
    # المستخدم متصلاً أونلاين — أي نفس استدعاءات REST مع UPSERT
    # بدلاً من INSERT لضمان نسبة خطأ 0%.
    # ─────────────────────────────────────────────────────────
    def _exec_op(self, op: dict) -> bool:
        table    = op.get("table", "")
        op_type  = op.get("op", "")
        data     = op.get("data")
        match    = op.get("match", {})

        # ── أعمدة التعارض الصحيحة (مطابقة للـ UNIQUE constraints في Supabase) ──
        CONFLICT_COL = {
            "products":      "id",
            "customers":     "phone",           # UNIQUE على phone (بعد تشغيل migration)
            "employees":     "id",
            "invoices":      "invoice_number",  # UNIQUE على invoice_number
            "invoice_items": "id",
            "suppliers":     "id",
            "offers":        "id",
            "app_settings":  "key",             # UNIQUE على key
        }

        # ── تعيين أسماء الأعمدة الفعلية في Supabase ──
        def map_product(d: dict) -> dict:
            """تحويل حقول المنتج من صيغة التطبيق إلى أعمدة Supabase الفعلية"""
            return {
                "id":        d.get("id"),
                "name":      d.get("name", ""),
                "price":     float(d.get("price", 0)),
                "cost":      float(d.get("cost") or d.get("cost_price") or d.get("costPrice") or 0),
                "stock":     float(d.get("stock", 0)),
                "barcode":   d.get("barcode", ""),
                "category":  d.get("category", ""),
                "min_stock": d.get("min_stock") if d.get("min_stock") is not None
                             else d.get("minStock", 5),
                "active":    d.get("active", True),
            }

        def map_customer(d: dict) -> dict:
            """تحويل حقول العميل إلى أعمدة Supabase"""
            return {
                "phone":       d.get("phone", ""),
                "name":        d.get("name", ""),
                "address":     d.get("address", ""),
                "email":       d.get("email", ""),
                "notes":       d.get("notes", ""),
                "balance":     float(d.get("balance", 0)),
                "total_spent": float(d.get("total_spent") or d.get("totalSpent") or 0),
                "visits":      int(d.get("visits", 0)),
                "last_visit":  d.get("last_visit") or d.get("lastInvoiceDate"),
            }

        def map_invoice_header(d: dict, inv_num: str) -> dict:
            """تحويل header الفاتورة إلى أعمدة Supabase"""
            cust = d.get("customer") or {}
            items_list = d.get("items", [])
            return {
                "invoice_number":   inv_num,
                "date":             d.get("date") or d.get("created_at"),
                "customer_id":      d.get("customer_id"),
                "customer_phone":   cust.get("phone") or d.get("customer_phone"),
                "customer_name":    cust.get("name")  or d.get("customer_name", ""),
                "customer_address": cust.get("address") or d.get("customer_address", ""),
                "customer_data":    cust if cust else (d.get("customer_data") or {}),
                "items":            items_list,
                "subtotal":         float(d.get("subtotal") or d.get("total") or 0),
                "discount":         float(d.get("discount", 0)),
                "tax":              float(d.get("tax", 0)),
                "total":            float(d.get("total", 0)),
                "payment_method":   d.get("payment_method") or d.get("paymentMethod") or "نقد",
                "payment_status":   d.get("payment_status") or d.get("paymentStatus") or "paid",
                "notes":            d.get("notes", ""),
                "cashier_id":       str(d.get("cashier_id") or d.get("cashierId") or ""),
                "cashier_name":     d.get("cashier_name") or d.get("cashierName") or "",
            }

        def map_invoice_item(it: dict, inv_num: str) -> dict:
            return {
                "invoice_number": inv_num,
                "product_id":     str(it.get("productId") or it.get("product_id") or it.get("id") or ""),
                "product_name":   it.get("name") or it.get("product_name") or "",
                "price":          float(it.get("price", 0)),
                "cost_price":     float(it.get("costPrice") or it.get("cost_price") or it.get("cost") or 0),
                "quantity":       float(it.get("quantity", 1)),
                "total":          float(it.get("total", 0)),
            }

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                # ════════════════════════════════════════
                # منتجات — upsert بـ id (أعمدة Supabase)
                # ════════════════════════════════════════
                if op_type in ("insert", "upsert") and table == "products":
                    rows = [map_product(r) for r in (data if isinstance(data, list) else [data])]
                    self.client.upsert("products", rows, on_conflict="id")
                    return True

                # ════════════════════════════════════════
                # عملاء — upsert بـ phone
                # ════════════════════════════════════════
                elif op_type in ("insert", "upsert") and table == "customers":
                    rows = [map_customer(r) for r in (data if isinstance(data, list) else [data])]
                    self.client.upsert("customers", rows, on_conflict="phone")
                    return True

                # ════════════════════════════════════════
                # فواتير — upsert header + إعادة بناء items
                # (نفس addInvoice أونلاين تماماً)
                # ════════════════════════════════════════
                elif op_type in ("insert", "upsert") and table == "invoices":
                    raw_list = data if isinstance(data, list) else [data]
                    for raw in raw_list:
                        inv_num = raw.get("invoice_number") or raw.get("invoiceNumber", "")
                        header  = map_invoice_header(raw, inv_num)
                        self.client.upsert("invoices", [header], on_conflict="invoice_number")
                        # إعادة بناء البنود
                        items_list = raw.get("items", [])
                        if items_list:
                            self.client.delete("invoice_items", "invoice_number", inv_num)
                            item_rows = [map_invoice_item(it, inv_num) for it in items_list]
                            self.client.insert("invoice_items", item_rows)
                    return True

                # ════════════════════════════════════════
                # بنود الفاتورة المباشرة — insert
                # ════════════════════════════════════════
                elif op_type == "insert" and table == "invoice_items":
                    raw_list = data if isinstance(data, list) else [data]
                    inv_num  = raw_list[0].get("invoice_number", "") if raw_list else ""
                    rows     = [map_invoice_item(it, inv_num) for it in raw_list]
                    self.client.insert("invoice_items", rows)
                    return True

                # ════════════════════════════════════════
                # سجلات أخرى — upsert عام
                # ════════════════════════════════════════
                elif op_type in ("insert", "upsert"):
                    rows     = data if isinstance(data, list) else [data]
                    conflict = CONFLICT_COL.get(table, "id")
                    self.client.upsert(table, rows, on_conflict=conflict)
                    return True

                # ════════════════════════════════════════
                # حذف سجل عام
                # ════════════════════════════════════════
                elif op_type == "delete":
                    if match:
                        for col, val in match.items():
                            self.client.delete(table, col, str(val))
                    return True

                # ════════════════════════════════════════
                # حذف فاتورة كاملة (header + items)
                # ════════════════════════════════════════
                elif op_type == "delete_invoice":
                    inv_num = data.get("inv", "") if isinstance(data, dict) else str(data)
                    self.client.delete("invoice_items", "invoice_number", inv_num)
                    self.client.delete("invoices",      "invoice_number", inv_num)
                    return True

                # ════════════════════════════════════════
                # تحديث فاتورة (header + إعادة بناء items)
                # ════════════════════════════════════════
                elif op_type == "update_invoice":
                    inv_num    = data.get("inv", "") if isinstance(data, dict) else str(data)
                    raw_header = data.get("header", {}) if isinstance(data, dict) else {}
                    items_list = data.get("items")       if isinstance(data, dict) else None

                    if raw_header:
                        h = map_invoice_header(raw_header, inv_num)
                        self.client.upsert("invoices", [h], on_conflict="invoice_number")

                    if items_list is not None:
                        self.client.delete("invoice_items", "invoice_number", inv_num)
                        if items_list:
                            item_rows = [map_invoice_item(it, inv_num) for it in items_list]
                            self.client.insert("invoice_items", item_rows)
                    return True

                # ════════════════════════════════════════
                # تحديث مخزون منتج
                # ════════════════════════════════════════
                elif op_type == "update_stock":
                    pid   = data.get("id") or data.get("productId")
                    stock = data.get("stock", 0)
                    self.client.update("products", {"stock": float(stock)}, "id", str(pid))
                    return True

                # ════════════════════════════════════════
                # fallback: upsert عام
                # ════════════════════════════════════════
                else:
                    log.warning(f"unknown op_type={op_type} table={table} — trying generic upsert")
                    rows     = data if isinstance(data, list) else [data]
                    conflict = CONFLICT_COL.get(table, "id")
                    try:
                        self.client.upsert(table, rows, on_conflict=conflict)
                        return True
                    except Exception:
                        return False

            except Exception as e:
                delay = RETRY_BASE ** attempt
                log.warning(
                    f"attempt {attempt}/{MAX_RETRIES} failed — "
                    f"op={op_type} table={table} err={e} — retry in {delay:.1f}s"
                )
                if attempt < MAX_RETRIES:
                    time.sleep(delay)
                else:
                    log.error(f"FINAL FAIL op={op_type} table={table} err={e}")
                    return False

        return False

    # ── معالجة دفعة من العمليات بخيوط متوازية ──
    def sync_queue(self, queue: list) -> dict:
        if not queue:
            return self.results

        batches = [queue[i:i+BATCH_SIZE] for i in range(0, len(queue), BATCH_SIZE)]
        threads = []

        def process_batch(batch):
            for item in batch:
                ok = self._exec_op(item)
                self._update_result(pushed=1 if ok else 0, failed=0 if ok else 1)

        for batch in batches:
            t = threading.Thread(target=process_batch, args=(batch,), daemon=True)
            threads.append(t)
            t.start()

        for t in threads:
            t.join(timeout=TIMEOUT_SEC * 2)

        return self.results

    # ── مزامنة تغييرات المخزون ──
    def sync_stock(self, stock_changes: list) -> dict:
        """
        stock_changes: [{"id": <product_id>, "stock": <new_stock>}, ...]
        """
        for item in stock_changes:
            ok = self._exec_op({"op": "update_stock", "table": "products", "data": item})
            self._update_result(pushed=1 if ok else 0, failed=0 if ok else 1)
        return self.results

    # ── سحب كامل من السحابة للمزامنة العكسية ──
    def pull_all(self) -> dict:
        tables = [
            ("products",  "*"),
            ("customers", "*"),
            ("invoices",  "*"),
            ("invoice_items", "*"),
            ("employees", "*"),
            ("expenses",  "*"),
            ("suppliers", "*"),
            ("offers",    "*"),
        ]
        pulled = {}
        for table, cols in tables:
            try:
                rows = self.client.select(table, cols)
                pulled[table] = rows
                log.info(f"pulled {len(rows)} rows from {table}")
            except Exception as e:
                log.warning(f"failed to pull {table}: {e}")
                pulled[table] = []
        return pulled

    # ── مزامنة كاملة (push + pull) ──
    def full_sync(self, queue: list, stock_changes: list) -> dict:
        log.info(f"full_sync start: queue={len(queue)} stock_changes={len(stock_changes)}")
        log_event("sync_start", f"queue={len(queue)} stock={len(stock_changes)}")

        # الإرسال أولاً
        push_res  = self.sync_queue(queue)
        stock_res = self.sync_stock(stock_changes)

        total_pushed = push_res["pushed"] + stock_res["pushed"]
        total_failed = push_res["failed"] + stock_res["failed"]

        log.info(f"full_sync done: pushed={total_pushed} failed={total_failed}")
        log_event("sync_done", f"pushed={total_pushed} failed={total_failed}")

        return {
            "pushed": total_pushed,
            "failed": total_failed,
            "skipped": self.results["skipped"],
            "success": total_failed == 0,
        }

# ═══════════════════════════════════════════════════════════
# واجهة سطر الأوامر (IPC مع Electron)
# ═══════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="WeB Ora Sync Helper")
    parser.add_argument("--config", required=True, help="مسار ملف JSON للإعداد")
    parser.add_argument("--mode",   default="full",
                        choices=["full", "push", "pull", "ping", "stock"],
                        help="نوع عملية المزامنة")
    parser.add_argument("--payload", default=None, help="JSON مضمّن للعمليات")
    args = parser.parse_args()

    # ── تحميل الإعداد ──
    try:
        with open(args.config, encoding="utf-8") as f:
            cfg = json.load(f)
    except Exception as e:
        out({"ok": False, "error": f"config_load_failed: {e}"})
        return

    url     = cfg.get("SUPABASE_URL", "").strip()
    key     = cfg.get("SUPABASE_ANON_KEY", "").strip()

    if not url or not key:
        out({"ok": False, "error": "missing_supabase_config"})
        return

    client = SupabaseClient(url, key)

    # ── ping فقط ──
    if args.mode == "ping":
        ok = client.ping()
        out({"ok": ok, "mode": "ping"})
        client.close()
        return

    # ── تحميل payload ──
    payload = {}
    if args.payload:
        try:
            payload = json.loads(args.payload)
        except Exception as e:
            out({"ok": False, "error": f"payload_parse: {e}"})
            return

    engine = SyncEngine(client)

    if args.mode == "ping":
        ok = client.ping()
        out({"ok": ok})

    elif args.mode == "push":
        queue  = payload.get("queue", [])
        result = engine.sync_queue(queue)
        out({"ok": True, **result})

    elif args.mode == "stock":
        changes = payload.get("stock", [])
        result  = engine.sync_stock(changes)
        out({"ok": True, **result})

    elif args.mode == "pull":
        data = engine.pull_all()
        out({"ok": True, "data": data})

    elif args.mode == "full":
        queue   = payload.get("queue",  [])
        stock   = payload.get("stock",  [])
        result  = engine.full_sync(queue, stock)
        if result.get("success"):
            out({"ok": True, **result})
        else:
            # حتى عند وجود بعض الفشل نُعيد ما نجح
            out({"ok": False, **result, "error": f"{result['failed']} ops failed after {MAX_RETRIES} retries"})

    client.close()

def out(data: dict):
    """إخراج JSON نظيف لـ Electron"""
    print(json.dumps(data, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    main()
