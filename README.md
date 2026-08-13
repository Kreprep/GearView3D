# GearView3D

GearView3D is a thesis prototype for browser-based forklift familiarization. It supports learner modules, guided checklists, parts identification, progress tracking, quizzes, final assessment review, and admin content management.

Important scope note: GearView3D is for preparatory learning only. It is not a certification simulator and does not imply TESDA certification.

The app has two parts:

| Folder | What it is | Runs on |
|---|---|---|
| `frontend/` | React + Vite app (the UI) | http://localhost:5173 |
| `backend/` | Express + Prisma API with a PostgreSQL database (auth, content, per-user progress) | http://localhost:4000 |

The frontend calls the API at `/api/*`; the Vite dev server proxies that to the backend, so you always need **both** running.

## Prerequisites (install once)

1. **Node.js 20 or newer** — https://nodejs.org
2. **PostgreSQL 16 or newer** — https://www.postgresql.org/download/
   - During installation you choose a password for the `postgres` user. **Remember it** — you will put it in a config file below.
   - Everything else can stay at the defaults (port 5432).
3. **Git** — to clone this repository.

## First-Time Setup

Clone the repo, then set up the backend and the frontend (two terminals, or one after the other).

### 1. Backend

```bash
cd backend
npm install
```

Create your local config file by copying the example:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS/Linux
cp .env.example .env
```

Open `backend/.env` in an editor and set your PostgreSQL password inside `DATABASE_URL`:

```
DATABASE_URL="postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/gearview3d"
```

> If your password contains special characters (`@ / : # ? = %` etc.), they must be **percent-encoded** in the URL — e.g. `@` becomes `%40`, `/` becomes `%2F`, `=` becomes `%3D`. Encode any character quickly with: `node -e "console.log(encodeURIComponent('YOUR_PASSWORD'))"`

Also set `JWT_SECRET` to any long random string (used to sign login tokens).

Then create the database tables and fill them with the training content:

```bash
npx prisma migrate dev   # creates the gearview3d database + tables
npm run seed             # loads demo users, modules, parts, checklists, quizzes
```

The seed reads the content from `frontend/src/data/`, so both folders must exist (they do, in this repo). Re-running the seed is safe — it only adds missing rows and never overwrites admin edits.

### 2. Frontend

```bash
cd frontend
npm install
```

## Running the App (every time)

Terminal 1 — API:

```bash
cd backend
npm run dev
# -> GearView3D API listening on http://localhost:4000
```

Terminal 2 — UI:

```bash
cd frontend
npm run dev
# -> open the printed URL, usually http://localhost:5173
```

## Demo Accounts

- Admin: `admin@mail.com` / `admin123`
- Learner: `trainee@mail.com` / `trainee123`

Learner progress is saved per account in the database, so the same login shows the same progress on any machine pointing at the same database.

## Admin Flow

Admin routes (log in as the admin account):

- `/admin` — overview: learner count, average completion, per-module completion, recent activity
- **Training Content** — pick an equipment (or add one with the box beside the picker), then one of three sections:
  - `/admin/modules` — that equipment's modules: Edit, Move up, Move down, Delete, Add module
  - `/admin/modules/:slug` — the **Module Editor**: the module's card fields plus its ordered steps (Read Up, Driving Course, Walk Around, Checklist, Quiz, Built-in Activity, Completion Summary). Selecting a step edits it in place — a driving step gets the 3D map, a walk-around step its inspection checks / gauges / device tests / defect scenarios plus the 3D hotspot editor for its markers, a checklist step its items, a quiz step its questions
  - `/admin/parts` — the parts list beside the 3D model: add a part, click the model to place its marker or drag one to move it, edit its detail card (Markdown + reference image), then Publish. Every part is marked on the model at once, so you can place one against its neighbours. Also part categories and the parts quiz
  - `/admin/settings` — the catalog card, the **Driving Simulation** profile (model, body footprint, GLB rig node names, whether the vehicle has forks) and the **Hub content** (the copy on that equipment's training hub and module list; leave a field blank to use the default). Equipment is also deleted here, once its content is gone

Adding a new equipment needs no code change: create it, give it a model and modules, then tick Available - the catalogue card goes live once it has training behind it.
- `/admin/users`, `/admin/reports` — learners, progress, CSV export

Parts, part detail cards and course steps use **Save draft / Publish**: learners keep seeing the published version until you press Publish, and Discard draft throws the pending edit away. Modules, the equipment cards, hub content, checklists and quiz questions save immediately.

Admin edits are saved in PostgreSQL through the API and are visible to everyone using the same backend.

### Sharing admin edits with someone else

Edits live in **your database**, not in the repo, so `git push` does not carry them. To hand your content to a teammate (or to load it onto the server), export it to a file that *is* tracked:

```bash
cd backend
npm run content:export          # writes prisma/content-export.json
git add prisma/content-export.json && git commit -m "chore: update course content"
```

They pull, then apply it:

```bash
cd backend
npm run content:import          # updates and creates
npm run content:import -- --prune   # also deletes steps missing from the file
```

Unlike `npm run seed`, the import **overwrites** existing rows — that is how one person's edits reach everyone. It covers equipment, modules, parts, part details, courses, checklists and quizzes; it never touches user accounts or learner progress, and unpublished drafts stay local to whoever made them.

Once everyone is pointed at one deployed backend (see below), none of this is needed — edits are shared the moment you press Publish.

## Useful Commands

| Where | Command | What it does |
|---|---|---|
| `backend/` | `npm run dev` | start the API with auto-reload |
| `backend/` | `npm run seed` | (re)load seed content into the database |
| `backend/` | `npx prisma migrate dev` | apply schema changes to your database |
| `backend/` | `npm run studio` | open Prisma Studio, a GUI to browse the database |
| `backend/` | `npm run content:export` | write all admin-editable content to `prisma/content-export.json` |
| `backend/` | `npm run content:import` | apply that file to this database (overwrites) |
| `frontend/` | `npm run dev` | start the UI dev server |
| `frontend/` | `npm run build` | production build |
| `frontend/` | `npm run lint` | ESLint |

## Troubleshooting

- **"Cannot reach the GearView3D API"** in the browser → the backend isn't running. Start it (`cd backend && npm run dev`).
- **`P1000: Authentication failed`** when migrating → the password in `backend/.env` `DATABASE_URL` is wrong or not percent-encoded.
- **`P1001: Can't reach database server`** → PostgreSQL service isn't running. On Windows, check the `postgresql-x64-*` service in Services.
- **Login fails with correct demo credentials** → the seed hasn't run yet: `cd backend && npm run seed`.
- **Port 4000 already in use** → change `PORT` in `backend/.env`, and update the proxy target in `frontend/vite.config.js` to match.

## Deployment (Docker)

Not needed for local development — the two `npm run dev` servers above are still the way to work on the app.

`docker-compose.yml` runs three containers: PostgreSQL, the API, and nginx serving the built frontend. **nginx also proxies `/api` to the API container**, taking over the job `frontend/vite.config.js` does in development, so your reverse proxy has a single upstream to point at.

```bash
cp .env.example .env      # set POSTGRES_PASSWORD and JWT_SECRET
docker compose up -d --build
```

Then point your reverse proxy at `WEB_PORT` (default `8080`) on the Docker host. Only the web container publishes a port; Postgres and the API stay on the internal network.

On every boot the API container applies pending migrations with `prisma migrate deploy` (never `migrate dev`, which is interactive) and runs the seed, which is create-if-missing and so never overwrites content edited through the dashboard.

**Loading your local content onto the server**, once, after the first `up`:

```bash
docker compose exec backend npm run content:import
```

Or set `IMPORT_CONTENT_ON_BOOT=true` in `.env` to replay `prisma/content-export.json` on every restart. Leave it `false` normally — otherwise a restart silently discards edits made on the server.

Notes:

- **Change the demo passwords** before exposing this. `admin@mail.com` / `admin123` is fine on localhost, not behind a public proxy.
- The database lives in the `pgdata` volume. `docker compose down` keeps it; `docker compose down -v` deletes it.
- Both images build from the repo root, because the seed imports the frontend's data files directly.
