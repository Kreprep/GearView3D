-- Merge Part, PartDetail, WalkAroundHotspot and EquipmentHotspot into one
-- Hotspot table.
--
-- These four tables all held "a labelled point on an equipment's 3D model".
-- Six forklift components (mast, lift-chain, overhead-guard, counterweight,
-- tires, forks) existed as *both* a Part row and a WalkAroundHotspot row, with
-- their own copy of the position - so an admin who moved a marker moved it on
-- one surface only. PartDetail was already the de-facto union of the two id
-- sets, keyed by the same ids, which is what makes this collapse safe.
--
-- After this, one row = one physical component, and `inParts` / `inWalkAround`
-- say which surfaces it appears on.
--
-- Ids are preserved exactly, so learner progress (`parts.viewedPartIds`) and
-- walk-around step data (`Course.data.checks[].hotspot`) keep resolving.

CREATE TABLE "Hotspot" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    "inParts" BOOLEAN NOT NULL DEFAULT false,
    "inWalkAround" BOOLEAN NOT NULL DEFAULT false,

    "title" TEXT NOT NULL DEFAULT '',
    "subtitle" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',

    "category" TEXT NOT NULL DEFAULT '',
    "functionText" TEXT NOT NULL DEFAULT '',
    "inspectionReminder" TEXT NOT NULL DEFAULT '',
    "safetyNote" TEXT NOT NULL DEFAULT '',
    "relatedModule" TEXT NOT NULL DEFAULT '',
    "checklist" JSONB NOT NULL DEFAULT '[]',

    "inspectCategory" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "inspect" TEXT NOT NULL DEFAULT '',
    "safeFeedback" TEXT NOT NULL DEFAULT '',
    "unsafeFeedback" TEXT NOT NULL DEFAULT '',
    "unsafeScenarios" JSONB NOT NULL DEFAULT '[]',

    "draft" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hotspot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Hotspot_equipmentId_sortOrder_idx" ON "Hotspot"("equipmentId", "sortOrder");

-- 1. Parts. Always forklift's (the table had no equipmentId - it *was* the
--    forklift's), always live: there was no publish gate on them, so they
--    arrive published, and builtIn because they seed from partsData.js.
INSERT INTO "Hotspot" (
    "id", "equipmentId", "label", "position", "sortOrder", "inParts",
    "category", "functionText", "inspectionReminder", "safetyNote",
    "relatedModule", "checklist", "draft", "published", "builtIn"
)
SELECT
    "id", 'forklift', "label", "position", "sortOrder", true,
    "category", "functionText", "inspectionReminder", "safetyNote",
    "relatedModule", "checklist", "draft", true, true
FROM "Part";

-- 2. Walk-around hotspots. Where the id already arrived as a part, this only
--    adds the inspection fields and flips the surface flag on - the part's
--    position and category win, since the two copies differ by at most 2cm and
--    the parts chip ("Load Handling Parts") is not the inspection grouping
--    ("Exterior condition"), which lands in inspectCategory either way.
--    Walk-around-only rows are offset past the parts so the merged list keeps
--    parts first.
UPDATE "Hotspot" h
SET "inWalkAround" = true,
    "inspectCategory" = w."category",
    "state" = w."state",
    "inspect" = w."inspect",
    "safeFeedback" = w."safeFeedback",
    "unsafeFeedback" = w."unsafeFeedback",
    "unsafeScenarios" = w."unsafeScenarios",
    -- A pending walk-around draft keeps its fields, but its `category` is the
    -- inspection grouping, so it is renamed on the way in; a part draft on the
    -- same row wins on the keys they share (label, position).
    "draft" = CASE
        WHEN w."draft" IS NULL THEN h."draft"
        ELSE (
            CASE WHEN w."draft" ? 'category'
                THEN (w."draft" - 'category') || jsonb_build_object('inspectCategory', w."draft" -> 'category')
                ELSE w."draft"
            END
        ) || COALESCE(h."draft", '{}'::jsonb)
    END
FROM "WalkAroundHotspot" w
WHERE h."id" = w."id";

INSERT INTO "Hotspot" (
    "id", "equipmentId", "label", "position", "sortOrder", "inWalkAround",
    "inspectCategory", "state", "inspect", "safeFeedback", "unsafeFeedback",
    "unsafeScenarios", "draft", "published", "builtIn"
)
SELECT
    w."id", 'forklift', w."label", w."position", w."sortOrder" + 100, true,
    w."category", w."state", w."inspect", w."safeFeedback", w."unsafeFeedback",
    w."unsafeScenarios",
    CASE WHEN w."draft" ? 'category'
        THEN (w."draft" - 'category') || jsonb_build_object('inspectCategory', w."draft" -> 'category')
        ELSE w."draft"
    END,
    w."published", w."builtIn"
FROM "WalkAroundHotspot" w
WHERE NOT EXISTS (SELECT 1 FROM "Hotspot" h WHERE h."id" = w."id");

-- 3. Detail cards fold into the row they describe. Ids with no marker at all
--    (tilt-cylinder) become detail-only rows: no position, no surface flag.
UPDATE "Hotspot" h
SET "title" = d."title",
    "subtitle" = d."subtitle",
    "image" = d."image",
    "description" = d."description",
    "draft" = CASE
        WHEN d."draft" IS NULL THEN h."draft"
        ELSE COALESCE(h."draft", '{}'::jsonb) || d."draft"
    END
FROM "PartDetail" d
WHERE h."id" = d."id";

INSERT INTO "Hotspot" (
    "id", "equipmentId", "label", "position", "sortOrder",
    "title", "subtitle", "image", "description", "draft", "published", "builtIn"
)
SELECT
    d."id", 'forklift', d."title", NULL, 900,
    d."title", d."subtitle", d."image", d."description", d."draft", true, true
FROM "PartDetail" d
WHERE NOT EXISTS (SELECT 1 FROM "Hotspot" h WHERE h."id" = d."id");

-- 4. The generic per-equipment hotspots. They backed both that equipment's
--    identification page and its walk-around steps, so they arrive on both
--    surfaces. Their `description` was the detail card body, which is where it
--    stays. `state` stays empty: equipment other than the forklift never
--    modelled engine phases, and empty means "shows in every phase".
INSERT INTO "Hotspot" (
    "id", "equipmentId", "label", "position", "sortOrder",
    "inParts", "inWalkAround", "category", "description",
    "draft", "published", "builtIn"
)
SELECT
    "id", "equipmentId", "label", "position", "sortOrder",
    true, true, "category", "description",
    "draft", "published", false
FROM "EquipmentHotspot";

DROP TABLE "Part";
DROP TABLE "PartDetail";
DROP TABLE "WalkAroundHotspot";
DROP TABLE "EquipmentHotspot";

-- Categories are per-equipment now that every equipment has the same parts
-- page. The existing four are the forklift's.
ALTER TABLE "PartCategory" RENAME TO "HotspotCategory";
ALTER TABLE "HotspotCategory" RENAME CONSTRAINT "PartCategory_pkey" TO "HotspotCategory_pkey";
ALTER TABLE "HotspotCategory" ADD COLUMN "equipmentId" TEXT NOT NULL DEFAULT 'forklift';

CREATE INDEX "HotspotCategory_equipmentId_sortOrder_idx" ON "HotspotCategory"("equipmentId", "sortOrder");
