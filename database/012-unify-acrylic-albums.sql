-- Owner correction (27/10): one photo-under-acrylic album type.
-- Retire duplicate SKUs without deleting order history or saved artwork.
BEGIN;
CREATE TEMP TABLE zg_acrylic_correction_once ON COMMIT DROP AS
WITH inserted AS (
 INSERT INTO zangraf_settings(key,data) VALUES('catalog-acrylic-one-type-2026-10-27-v1','{}')
 ON CONFLICT(key) DO NOTHING RETURNING key
) SELECT key FROM inserted;

UPDATE zangraf_products
SET data=jsonb_set(data || jsonb_build_object(
 'name',replace(data->>'name','Acrílico transparente','Acrílico'),
 'category','Acrílico',
 'description',replace(data->>'description','capa de acrílico transparente','capa de acrílico com fotografia por baixo')
),'{options,covers}','["Acrílico"]'::jsonb),updated_at=now()
WHERE id IN ('album-22x30-acrilico','album-24x24-acrilico','album-24x30-acrilico','album-24x34-acrilico','album-30x22-acrilico','album-30x30-acrilico','album-30x40-acrilico','album-34x24-acrilico')
AND EXISTS(SELECT 1 FROM zg_acrylic_correction_once);

UPDATE zangraf_products SET active=false,updated_at=now()
WHERE id IN ('album-22x30-acrilico-sobreposto','album-24x34-acrilico-sobreposto','album-30x30-acrilico-sobreposto','album-34x24-acrilico-sobreposto')
AND EXISTS(SELECT 1 FROM zg_acrylic_correction_once);

UPDATE zangraf_settings
SET data=jsonb_set(data,'{name}',to_jsonb(replace(data->>'name','Acrílico transparente','Acrílico'))),updated_at=now()
WHERE key LIKE 'diagrammer-model:oficial-%-acrilico-capa'
AND EXISTS(SELECT 1 FROM zg_acrylic_correction_once);

-- The old catalog only had official models for these sizes under duplicate IDs.
WITH mapping(source_id,target_id) AS (VALUES
 ('album-22x30-acrilico-sobreposto','album-22x30-acrilico'),
 ('album-30x30-acrilico-sobreposto','album-30x30-acrilico')
)
INSERT INTO zangraf_settings(key,data)
SELECT 'diagrammer-model:oficial-'||target_id||'-capa',
 s.data || jsonb_build_object('id','oficial-'||target_id||'-capa','productId',target_id,'version','2026-10-27T15:00:00.000Z')
FROM mapping JOIN zangraf_settings s ON s.key='diagrammer-model:oficial-'||source_id||'-capa'
WHERE EXISTS(SELECT 1 FROM zg_acrylic_correction_once)
ON CONFLICT(key) DO NOTHING;

UPDATE zangraf_settings s
SET data=jsonb_set(jsonb_set(s.data,'{variants}',(
 SELECT jsonb_agg(jsonb_set(jsonb_set(v,'{front,widthMm}','203'),'{back,widthMm}','203') ORDER BY ord)
 FROM jsonb_array_elements(s.data->'variants') WITH ORDINALITY AS variants(v,ord)
)),'{version}','"2026-10-27T15:00:00.000Z"'),updated_at=now()
WHERE key='diagrammer-model:oficial-album-22x30-acrilico-capa'
AND EXISTS(SELECT 1 FROM zg_acrylic_correction_once);
COMMIT;
