-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "modelScale" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Hotspot" ALTER COLUMN "updatedAt" DROP DEFAULT;
