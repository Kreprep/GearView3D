-- Phase 9, the skills checklist (docs/revisions/post-defense-plan.md 4.8):
-- the skill catalogue, which modules teach or require each skill, and the
-- append-only sign-off trail. New tables only: nothing existing is altered,
-- dropped or rewritten, so prisma migrate deploy is safe on a database in use.

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'knowledge',
    "tesdaRef" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "evidence" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleSkill" (
    "moduleId" INTEGER NOT NULL,
    "skillId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,

    CONSTRAINT "ModuleSkill_pkey" PRIMARY KEY ("moduleId","skillId")
);

-- CreateTable
CREATE TABLE "SkillSignoffEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "evidenceStatus" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillSignoffEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModuleSkill_skillId_idx" ON "ModuleSkill"("skillId");

-- CreateIndex
CREATE INDEX "SkillSignoffEvent_userId_skillId_createdAt_idx" ON "SkillSignoffEvent"("userId", "skillId", "createdAt");

-- CreateIndex
CREATE INDEX "SkillSignoffEvent_actorId_idx" ON "SkillSignoffEvent"("actorId");

-- AddForeignKey
ALTER TABLE "ModuleSkill" ADD CONSTRAINT "ModuleSkill_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleSkill" ADD CONSTRAINT "ModuleSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillSignoffEvent" ADD CONSTRAINT "SkillSignoffEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillSignoffEvent" ADD CONSTRAINT "SkillSignoffEvent_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillSignoffEvent" ADD CONSTRAINT "SkillSignoffEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

