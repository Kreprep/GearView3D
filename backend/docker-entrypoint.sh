#!/bin/sh
# Runs before the API starts, every boot.
set -e

# `migrate deploy` applies pending migrations and nothing else. Never use
# `migrate dev` here - it is interactive and can offer to reset the database.
echo "Applying database migrations..."
npx prisma migrate deploy

# Create-if-missing, so a restart adds anything new from the data files without
# overwriting content an admin edited through the dashboard.
echo "Seeding baseline content..."
npm run seed

# Opt-in: replay prisma/content-export.json over the database, overwriting
# published content with whatever was committed to git. Off by default so a
# routine restart never discards edits made on the server.
if [ "$IMPORT_CONTENT_ON_BOOT" = "true" ]; then
  echo "IMPORT_CONTENT_ON_BOOT=true - importing prisma/content-export.json..."
  npm run content:import
fi

exec "$@"
