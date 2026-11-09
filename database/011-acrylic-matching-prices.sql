-- Owner confirmation: photo-under-acrylic uses the same price as clear acrylic.
-- Populate only products still without a price; preserve administrator pricing edits.
BEGIN;
WITH marker AS (
 INSERT INTO zangraf_settings(key,data) VALUES('catalog-acrylic-same-price-2026-10-26-v1','{}')
 ON CONFLICT(key) DO NOTHING RETURNING key
), mapping(target_id,source_id) AS (VALUES
('album-22x30-acrilico-sobreposto','album-22x30-acrilico'),
('album-24x34-acrilico-sobreposto','album-24x34-acrilico'),
('album-30x30-acrilico-sobreposto','album-30x30-acrilico'),
('album-34x24-acrilico-sobreposto','album-34x24-acrilico')
)
UPDATE zangraf_products target
SET data=jsonb_set(target.data,'{albumPricing}',source.data->'albumPricing'),updated_at=now()
FROM mapping,zangraf_products source
WHERE EXISTS(SELECT 1 FROM marker)
 AND target.id=mapping.target_id AND source.id=mapping.source_id
 AND target.data->>'priceCents' IS NULL
 AND (target.data->'albumPricing' IS NULL OR target.data->'albumPricing'='null'::jsonb OR target.data->'albumPricing'='[]'::jsonb)
 AND jsonb_typeof(source.data->'albumPricing')='array' AND source.data->'albumPricing'<>'[]'::jsonb;
COMMIT;
