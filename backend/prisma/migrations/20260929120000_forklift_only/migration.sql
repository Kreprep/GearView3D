-- Narrow the app to the forklift only.
--
-- After the final thesis defense the panel scoped GearView3D to the forklift.
-- Equipment stops being a dimension every content table is scoped by and
-- becomes one row of configuration: every other equipment and what it owned is
-- deleted, every `equipmentId` column is dropped, and the Equipment columns
-- that only served the catalog or model scaling go with them.
--
-- The data steps run first because they still need `equipmentId`.

-- 1. Remove every other equipment and what it owned. Course rows reference a
--    module by slug with no foreign key, so they go first; deleting a Module
--    cascades its ChecklistItem rows and its module-context QuizQuestion rows.
DELETE FROM "Course"
WHERE "moduleSlug" IN (SELECT "slug" FROM "Module" WHERE "equipmentId" <> 'forklift');
DELETE FROM "Module"          WHERE "equipmentId" <> 'forklift';
DELETE FROM "QuizQuestion"    WHERE "equipmentId" <> 'forklift';
DELETE FROM "Hotspot"         WHERE "equipmentId" <> 'forklift';
DELETE FROM "HotspotCategory" WHERE "equipmentId" <> 'forklift';
DELETE FROM "Equipment"       WHERE "id" <> 'forklift';

-- 2. Parts-quiz attempts: `parts.quizzes.forklift`, plus any legacy
--    `parts.practiceAttempts` a stale client re-pushed after migration
--    20260814100000, become one list at `parts.quizAttempts`. Lists are
--    newest-first and the legacy one is older, so it appends - the same
--    ordering rule as 20260814100000. Other equipment's attempts are dropped.
--
--    Learner progress for deleted content (`viewedPartIds` such as
--    'backhoe-tires', `simulations['backhoe-getting-started']`) is left alone:
--    readers already ignore ids and slugs that no longer exist.
UPDATE "ProgressSnapshot"
SET data = jsonb_set(
    data,
    '{parts,quizAttempts}',
    (CASE WHEN jsonb_typeof(data -> 'parts' -> 'quizAttempts') = 'array'
          THEN data -> 'parts' -> 'quizAttempts' ELSE '[]'::jsonb END)
    || (CASE WHEN jsonb_typeof(data -> 'parts' -> 'quizzes' -> 'forklift') = 'array'
             THEN data -> 'parts' -> 'quizzes' -> 'forklift' ELSE '[]'::jsonb END)
    || (CASE WHEN jsonb_typeof(data -> 'parts' -> 'practiceAttempts') = 'array'
             THEN data -> 'parts' -> 'practiceAttempts' ELSE '[]'::jsonb END),
    true
)
WHERE jsonb_typeof(data -> 'parts') = 'object';

UPDATE "ProgressSnapshot"
SET data = data #- '{parts,quizzes}' #- '{parts,practiceAttempts}'
WHERE data -> 'parts' ?| array['quizzes', 'practiceAttempts'];

-- 3. Schema.

-- DropIndex
DROP INDEX "Hotspot_equipmentId_sortOrder_idx";

-- DropIndex
DROP INDEX "HotspotCategory_equipmentId_sortOrder_idx";

-- DropIndex
DROP INDEX "Module_equipmentId_idx";

-- DropIndex
DROP INDEX "QuizQuestion_equipmentId_context_idx";

-- AlterTable
ALTER TABLE "Equipment" DROP COLUMN "available",
DROP COLUMN "description",
DROP COLUMN "modelOffsetY",
DROP COLUMN "modelScale",
DROP COLUMN "modelUrl",
DROP COLUMN "sortOrder";

-- AlterTable
ALTER TABLE "Hotspot" DROP COLUMN "equipmentId";

-- AlterTable
ALTER TABLE "HotspotCategory" DROP COLUMN "equipmentId";

-- AlterTable
ALTER TABLE "Module" DROP COLUMN "equipmentId";

-- AlterTable
ALTER TABLE "QuizQuestion" DROP COLUMN "equipmentId";
