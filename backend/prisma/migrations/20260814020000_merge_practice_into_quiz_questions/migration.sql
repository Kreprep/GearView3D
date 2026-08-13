-- Merges PracticeQuestion (the Parts Identification quiz) into QuizQuestion so
-- there is one quiz table, one grading path and one admin editor.
--
-- PracticeQuestion.draft is deliberately not carried over: the merged table has
-- no draft column, so an unpublished parts-question edit is discarded here and
-- the published wording survives.

-- 1. Scope every question to an equipment and say which kind of quiz it is.
ALTER TABLE "QuizQuestion" ADD COLUMN "equipmentId" TEXT NOT NULL DEFAULT 'forklift';
ALTER TABLE "QuizQuestion" ADD COLUMN "context" TEXT NOT NULL DEFAULT 'module';

-- 2. Parts questions have no module, so the FK column becomes optional.
ALTER TABLE "QuizQuestion" ALTER COLUMN "moduleId" DROP NOT NULL;

-- 3. Existing module questions inherit their module's equipment.
UPDATE "QuizQuestion" q
SET "equipmentId" = m."equipmentId"
FROM "Module" m
WHERE m."id" = q."moduleId";

-- 4. options becomes a plain array of strings for both kinds - module
--    questions stored [{ id, text, sortOrder }], parts questions already
--    stored ["text", ...].
UPDATE "QuizQuestion"
SET "options" = COALESCE(
  (
    SELECT jsonb_agg(elem->>'text' ORDER BY COALESCE((elem->>'sortOrder')::int, 0))
    FROM jsonb_array_elements("options") elem
  ),
  '[]'::jsonb
)
WHERE jsonb_typeof("options") = 'array' AND jsonb_typeof("options"->0) = 'object';

-- 5. Move the parts questions in. No ON CONFLICT: an id collision should fail
--    the migration loudly rather than silently drop a question.
INSERT INTO "QuizQuestion" ("id", "equipmentId", "context", "moduleId", "prompt", "answer", "options", "sortOrder")
SELECT "id", 'forklift', 'parts', NULL, "prompt", "answer", "options", "sortOrder"
FROM "PracticeQuestion";

DROP TABLE "PracticeQuestion";

CREATE INDEX "QuizQuestion_equipmentId_context_idx" ON "QuizQuestion"("equipmentId", "context");
