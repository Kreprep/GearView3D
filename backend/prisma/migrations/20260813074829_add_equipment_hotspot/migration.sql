-- CreateTable
CREATE TABLE "EquipmentHotspot" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" JSONB NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "draft" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentHotspot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipmentHotspot_equipmentId_idx" ON "EquipmentHotspot"("equipmentId");
