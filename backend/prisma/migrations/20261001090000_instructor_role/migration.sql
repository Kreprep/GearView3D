-- Phase 8 of the post-defense revisions: the Instructor role and the progress
-- reset guard. Both statements only add: no row is rewritten or dropped, and
-- every existing user keeps the role they have.

-- A third role between the two. What it may do is code
-- (frontend/src/data/permissions.js), not data. The value is only added here
-- and not used: PostgreSQL does not allow a new enum value to be used in the
-- transaction that added it.
ALTER TYPE "Role" ADD VALUE 'INSTRUCTOR';

-- Counts resets. Existing snapshots start at 0, which is also what a client
-- that has never been told a revision sends, so nobody's next save is refused.
ALTER TABLE "ProgressSnapshot" ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0;
