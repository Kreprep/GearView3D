-- Per-equipment driving-simulation overrides (model, rig node names, body
-- footprint, HUD captions, fail messages). Null means "use the coded
-- defaults in frontend/src/data/vehicleProfile.js".
ALTER TABLE "Equipment" ADD COLUMN "simConfig" JSONB;
