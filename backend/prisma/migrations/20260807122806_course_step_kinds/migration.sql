-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "content" JSONB,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'driving',
ALTER COLUMN "data" DROP NOT NULL;

-- Every module now stores its briefing as the first step, so shift the existing
-- driving rows down one slot to make room. The rest of the new rows (briefing,
-- the hardcoded activities, summary) are created by the seed at the sortOrder
-- buildDefaultCourses() assigns them, which lines up with this shift.
UPDATE "Course" SET "sortOrder" = "sortOrder" + 1;
