-- CreateTable
CREATE TABLE "WalkAroundHotspot" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'engine-off',
    "category" TEXT NOT NULL DEFAULT '',
    "inspect" TEXT NOT NULL DEFAULT '',
    "safeFeedback" TEXT NOT NULL DEFAULT '',
    "unsafeFeedback" TEXT NOT NULL DEFAULT '',
    "unsafeScenarios" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "draft" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalkAroundHotspot_pkey" PRIMARY KEY ("id")
);
