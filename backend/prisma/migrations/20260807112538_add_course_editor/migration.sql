-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "moduleSlug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "hint" TEXT NOT NULL DEFAULT '',
    "goalType" TEXT NOT NULL DEFAULT 'checkpoints',
    "data" JSONB NOT NULL,
    "draft" JSONB,
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Course_moduleSlug_sortOrder_idx" ON "Course"("moduleSlug", "sortOrder");
