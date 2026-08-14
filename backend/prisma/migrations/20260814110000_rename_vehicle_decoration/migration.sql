-- Rename the parked-obstacle decoration kind from `forklift` to `vehicle`.
--
-- The obstacle's model comes from the equipment's `simConfig.parkedModelUrl`,
-- so on a Backhoe course this dropped in a backhoe while the stored kind still
-- said "forklift" - and the admin map/inspector labelled it that way. The
-- learner-facing fail message already read "Vehicle Struck"; only the key was
-- wrong.
--
-- `decorationType()` in lib/courseEdit.js still accepts the old value, so a row
-- this misses keeps working.

UPDATE "Course"
SET data = jsonb_set(
    data,
    '{decorations}',
    (
        SELECT jsonb_agg(
            CASE WHEN item ->> 'type' = 'forklift'
                THEN jsonb_set(item, '{type}', '"vehicle"')
                ELSE item
            END
        )
        FROM jsonb_array_elements(data -> 'decorations') AS item
    )
)
WHERE jsonb_typeof(data -> 'decorations') = 'array'
  AND data -> 'decorations' @> '[{"type":"forklift"}]';

-- Pending drafts carry their own copy of the geometry.
UPDATE "Course"
SET draft = jsonb_set(
    draft,
    '{data,decorations}',
    (
        SELECT jsonb_agg(
            CASE WHEN item ->> 'type' = 'forklift'
                THEN jsonb_set(item, '{type}', '"vehicle"')
                ELSE item
            END
        )
        FROM jsonb_array_elements(draft -> 'data' -> 'decorations') AS item
    )
)
WHERE jsonb_typeof(draft -> 'data' -> 'decorations') = 'array'
  AND draft -> 'data' -> 'decorations' @> '[{"type":"forklift"}]';

-- The matching fail-message override key, if an admin ever set one.
UPDATE "Equipment"
SET "simConfig" = jsonb_set(
    "simConfig" #- '{failMessages,forklift}',
    '{failMessages,vehicle}',
    "simConfig" -> 'failMessages' -> 'forklift'
)
WHERE "simConfig" -> 'failMessages' ? 'forklift';
