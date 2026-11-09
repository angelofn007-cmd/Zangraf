-- Complete missing manufacturing guides in older models without changing sizes,
-- existing order snapshots, or margins explicitly saved by an administrator.
BEGIN;
UPDATE zangraf_settings
SET data = data || jsonb_build_object(
  'coverMargins', CASE
    WHEN data->>'productId' LIKE 'album-%-antirrisco'
      THEN '{"topMm":25,"rightMm":25,"bottomMm":25,"leftMm":25}'::jsonb
    WHEN data->>'productId' LIKE 'album-%-1500-gramas'
      THEN '{"topMm":3,"rightMm":3,"bottomMm":3,"leftMm":3}'::jsonb
    ELSE '{"topMm":0,"rightMm":0,"bottomMm":0,"leftMm":15}'::jsonb
  END,
  'version', '2026-11-03-fold-guides'
), updated_at=now()
WHERE key LIKE 'diagrammer-model:%'
  AND NOT (data ? 'coverMargins')
  AND (data->>'productId' LIKE 'album-%-antirrisco'
    OR data->>'productId' LIKE 'album-%-1500-gramas'
    OR data->>'productId' LIKE 'album-%-acrilico'
    OR data->>'productId' LIKE 'album-%-ps');
COMMIT;
