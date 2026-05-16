# INSTALL.md

# GearView3D — Install & Run (Windows)

Quick: do NOT run `npm create vite@latest frontend` (that creates another scaffold). Use the repo's existing `frontend/`.

## Prerequisites
- Node.js (v24.x recommended) — https://nodejs.org/en/download
- Git — https://git-scm.com/downloads
- PostgreSQL (if you will run backend locally) — https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
- VS Code (recommended) — https://code.visualstudio.com
Optional: DBeaver or pgAdmin.

## Verify installs
Open PowerShell and run:
```powershell
node -v # should be v24.15.0
npm -v # should be 11.12.1
git --version # should be git version 2.54.0.windows.1
psql --version # should be psql (PostgreSQL) 18.3
```

## Clone repo (team members)
```powershell
git clone https://github.com/Kreprep/GearView3D.git
cd GearView3D
```

## Frontend — install and run (existing `frontend/`)
1. Change into the frontend folder and install:
```powershell
cd frontend
npm install
```
2. Start development server:
```powershell
npm run dev
```
3. Open the URL shown (usually http://localhost:5173).

Notes:
- If you see `ENOENT` when running `npm install`, ensure you are inside `frontend/` (the folder that contains `package.json`).

## Postgres (quick)
- Run installer, remember the superuser password.
- Add `C:\Program Files\PostgreSQL\<version>\bin` to PATH (User env var), then restart terminal.
Verify:
```powershell
psql --version
```

## Running backend (planned)
- Backend folder not added yet. When present we will:
  - create `backend/`, `npm init -y`, install `express`, `prisma`, `@prisma/client`, etc.
  - set `.env` with `DATABASE_URL` pointing to local Postgres.
  - run migrations and start server with `npm run dev`.

## Troubleshooting
- Port conflict: Vite defaults to 5173 — free or change port.
- `psql` not found: restart terminal/Windows after adding PATH.
- Permission errors on Windows: run PowerShell as normal user (not Admin) for installs; only elevate if prompted.

## Quick checklist for each teammate
- Clone repo
- `cd frontend` → `npm install` → `npm run dev`
- Verify app opens at `http://localhost:5173`