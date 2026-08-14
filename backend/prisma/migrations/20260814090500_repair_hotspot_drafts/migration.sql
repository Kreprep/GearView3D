-- A `draft` holding JSON `null` rather than SQL NULL is an empty placeholder,
-- not a pending edit. The merge migration concatenated those with `||`, which
-- wraps scalars into an array instead of merging them, so a row that carried
-- placeholders on two of its source tables ended up with `[null, null, null]`.
--
-- Nothing readable was lost - the published columns are what learners see and
-- they were copied column-by-column - but a non-object draft would make the
-- editor think there is something to publish. Anything that is not an object
-- is not a draft.
UPDATE "Hotspot"
SET "draft" = NULL
WHERE "draft" IS NOT NULL
  AND jsonb_typeof("draft") <> 'object';
