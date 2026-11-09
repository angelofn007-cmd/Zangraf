BEGIN;
CREATE TABLE IF NOT EXISTS zangraf_order_files (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES zangraf_orders(id) ON DELETE CASCADE,
 item_key text NOT NULL, filename text NOT NULL, pathname text NOT NULL UNIQUE,
 width_px integer NOT NULL, height_px integer NOT NULL, dpi integer NOT NULL,
 max_bytes bigint NOT NULL DEFAULT 0, size_bytes bigint NOT NULL DEFAULT 0,
 uploaded boolean NOT NULL DEFAULT false, verified boolean NOT NULL DEFAULT false,
 token_expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,item_key,filename)
);
CREATE INDEX IF NOT EXISTS zangraf_files_order ON zangraf_order_files(order_id);
CREATE TABLE IF NOT EXISTS zangraf_production_emails (
 order_id uuid NOT NULL REFERENCES zangraf_orders(id), batch integer NOT NULL, recipient text NOT NULL,
 status text NOT NULL DEFAULT 'pending', provider_id text, error text, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(order_id,batch)
);
COMMIT;
