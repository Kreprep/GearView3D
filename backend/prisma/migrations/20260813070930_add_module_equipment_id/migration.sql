-- AlterTable
ALTER TABLE "Module" ADD COLUMN     "equipmentId" TEXT NOT NULL DEFAULT 'forklift';

-- CreateIndex
CREATE INDEX "Module_equipmentId_idx" ON "Module"("equipmentId");
