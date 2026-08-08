# API image. Build it from the REPO ROOT, not from backend/:
#
#   docker build -f backend/Dockerfile .
#
# The seed imports the frontend's data files directly
# (backend/prisma/seed.js -> ../../frontend/src/data/*.js), so the build context
# has to contain both packages. docker-compose.yml already sets it that way.
# Pinned to 22 for its npm 10. npm 11 gates lifecycle scripts behind an
# approval prompt, and `@prisma/engines` needs its postinstall to fetch the
# query and schema engines from Prisma's CDN. The explicit `prisma generate`
# below is the backstop if that ever changes.
FROM node:22-slim

# Prisma's engines link against OpenSSL, which the slim images omit. This is
# Prisma's own recommendation for Debian-based images.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Dev dependencies stay in the image on purpose: the Prisma CLI lives there and
# the entrypoint runs `prisma migrate deploy` on every boot.
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/ ./
# Whole tree rather than just data/, because the data files import
# ../lib/courseGoals.js and ../lib/courseGenerators.js. The .jsx and .css that
# come along are never imported by the backend.
COPY frontend/src/ ../frontend/src/

RUN npx prisma generate

# Explicit, because a build run from a Windows checkout does not carry the
# executable bit through COPY.
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
