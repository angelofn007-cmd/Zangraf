BEGIN;
ALTER TABLE zangraf_admins ADD COLUMN IF NOT EXISTS granted_by text REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE zangraf_admins ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS zangraf_settings (
  key text PRIMARY KEY,
  data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS zangraf_receipts (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES zangraf_orders(id),
  amount_cents bigint NOT NULL CHECK(amount_cents>0),
  method text NOT NULL CHECK(method IN ('pix','transfer','card','cash','other')),
  reference text NOT NULL UNIQUE,
  paid_at timestamptz NOT NULL,
  recorded_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zangraf_receipts_date ON zangraf_receipts(paid_at);
CREATE INDEX IF NOT EXISTS zangraf_receipts_order ON zangraf_receipts(order_id);
CREATE TABLE IF NOT EXISTS zangraf_admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
