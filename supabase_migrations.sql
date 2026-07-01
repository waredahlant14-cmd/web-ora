-- ══════════════════════════════════════════════════════════
-- WeB Ora POS — Supabase Schema Migrations
-- قم بتشغيل هذا الملف في Supabase SQL Editor
-- dashboard.supabase.com → مشروعك → SQL Editor → New query
-- ══════════════════════════════════════════════════════════

-- ─── 1. UNIQUE constraint على customers.phone ───
-- بدون هذا، UPSERT سيُضيف صفاً جديداً بدل التحديث
ALTER TABLE customers
  ADD CONSTRAINT customers_phone_unique UNIQUE (phone);

-- ─── 2. UNIQUE constraint على invoices.invoice_number ───
ALTER TABLE invoices
  ADD CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number);

-- ─── 3. UNIQUE constraint على app_settings.key ───
ALTER TABLE app_settings
  ADD CONSTRAINT app_settings_key_unique UNIQUE (key);

-- ─── 4. أعمدة إضافية في customers (للإحصاءات) ───
-- نُضيفها إن لم تكن موجودة
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS total_spent NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visits      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_visit  TEXT    DEFAULT NULL;

-- ─── 5. عمود cost_price في products (alias لـ cost) ───
-- البرنامج يستخدم cost_price، Supabase يستخدم cost
-- نُضيف عموداً مولَّداً للتوافق (أو نستخدم cost مباشرة)
-- اختر أحد الخيارين:
--
-- الخيار أ: أضف عمود cost_price جديد
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC GENERATED ALWAYS AS (cost) STORED;
--
-- الخيار ب (إن أردت): أعد تسمية cost إلى cost_price
-- ALTER TABLE products RENAME COLUMN cost TO cost_price;

-- ─── 6. أعمدة إضافية في invoices ───
-- لدعم حقل التاريخ وبيانات العميل النصية
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS date             TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS customer_phone   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS customer_name    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS customer_address TEXT DEFAULT NULL;

-- ─── 7. تحديث قيم افتراضية ───
ALTER TABLE invoices ALTER COLUMN customer_data SET DEFAULT '{}';
ALTER TABLE invoices ALTER COLUMN items         SET DEFAULT '[]';

-- ══════════════════════════════════════════════════════════
-- تحقق من النتائج
-- ══════════════════════════════════════════════════════════
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type IN ('UNIQUE','PRIMARY KEY')
  AND tc.table_name IN ('customers','invoices','products','app_settings')
ORDER BY tc.table_name, tc.constraint_type;


-- ══════════════════════════════════════════════════════════
-- v5.2.5 — جداول جديدة
-- ══════════════════════════════════════════════════════════

-- ─── جدول الفروع ───
CREATE TABLE IF NOT EXISTS branches (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  manager     TEXT DEFAULT '',
  phone       TEXT DEFAULT '',
  address     TEXT DEFAULT '',
  notes       TEXT DEFAULT '',
  status      TEXT DEFAULT 'active',  -- active | inactive | suspended
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── جدول سجلات الدفع ───
CREATE TABLE IF NOT EXISTS payments_ledger (
  id             BIGSERIAL PRIMARY KEY,
  type           TEXT NOT NULL,  -- cashier | shamcash | credit
  date           DATE NOT NULL,
  amount         NUMERIC NOT NULL DEFAULT 0,
  name           TEXT DEFAULT '',
  invoice_number TEXT DEFAULT '',
  status         TEXT DEFAULT 'paid',  -- paid | pending | partial
  notes          TEXT DEFAULT '',
  due_date       DATE DEFAULT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── إضافة branch_code للفواتير ───
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS branch_code TEXT DEFAULT NULL;

-- ─── RLS (أمان على مستوى الصف) ───
ALTER TABLE branches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all on branches"        ON branches        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all on payments_ledger" ON payments_ledger FOR ALL USING (true) WITH CHECK (true);
