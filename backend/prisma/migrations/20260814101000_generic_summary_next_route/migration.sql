-- Rewrite summary steps' `nextRoute` from Forklift route keys to the
-- equipment-relative form.
--
-- The key used to be looked up in the frontend's `routes` map, which is all
-- hardcoded Forklift paths - so a summary step on any other equipment could not
-- point anywhere, and the admin picker was hidden for them entirely. The new
-- keys resolve against whichever equipment the module belongs to
-- (lib/moduleContent.js), and per-module targets are `module:<slug>`.
--
-- `parts` and `assessment` already resolve as equipment-relative names and are
-- left alone. Unrecognised keys still fall back through the `routes` map, so
-- nothing breaks if one is missed; this is so the stored value matches what the
-- admin picker offers, rather than showing "Module default" for a row that
-- actually has a destination.

UPDATE "Course"
SET content = jsonb_set(
    content,
    '{nextRoute}',
    to_jsonb(
        CASE content ->> 'nextRoute'
            WHEN 'equipment'     THEN 'modules'
            WHEN 'walkAround'    THEN 'module:walk-around-check'
            WHEN 'loadHandling'  THEN 'module:load-handling'
            WHEN 'postOperation' THEN 'module:post-operation'
            WHEN 'palletTesting' THEN 'module:pallet-testing'
        END
    )
)
WHERE kind = 'summary'
  AND content ->> 'nextRoute' IN ('equipment', 'walkAround', 'loadHandling', 'postOperation', 'palletTesting');

-- Pending drafts carry their own copy of the content payload.
UPDATE "Course"
SET draft = jsonb_set(
    draft,
    '{content,nextRoute}',
    to_jsonb(
        CASE draft -> 'content' ->> 'nextRoute'
            WHEN 'equipment'     THEN 'modules'
            WHEN 'walkAround'    THEN 'module:walk-around-check'
            WHEN 'loadHandling'  THEN 'module:load-handling'
            WHEN 'postOperation' THEN 'module:post-operation'
            WHEN 'palletTesting' THEN 'module:pallet-testing'
        END
    )
)
WHERE kind = 'summary'
  AND draft -> 'content' ->> 'nextRoute' IN ('equipment', 'walkAround', 'loadHandling', 'postOperation', 'palletTesting');
