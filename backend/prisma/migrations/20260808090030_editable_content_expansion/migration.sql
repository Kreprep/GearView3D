-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "available" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Module" ADD COLUMN     "fullTitle" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Part" ADD COLUMN     "draft" JSONB;

-- AlterTable
ALTER TABLE "PartDetail" ADD COLUMN     "draft" JSONB;

-- CreateTable
CREATE TABLE "PartCategory" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PartCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeQuestion" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "draft" JSONB,

    CONSTRAINT "PracticeQuestion_pkey" PRIMARY KEY ("id")
);
