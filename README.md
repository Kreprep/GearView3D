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

- `/admin` — overview
- `/admin/modules`, `/admin/parts`, `/admin/checklists`, `/admin/quizzes` — edit content (part detail cards support Markdown descriptions and reference images)
- `/admin/users`, `/admin/reports` — learners, progress, CSV export

Admin edits are saved in PostgreSQL through the API and are visible to everyone using the same backend.

## Useful Commands

| Where | Command | What it does |
|---|---|---|
| `backend/` | `npm run dev` | start the API with auto-reload |
| `backend/` | `npm run seed` | (re)load seed content into the database |
| `backend/` | `npx prisma migrate dev` | apply schema changes to your database |
| `backend/` | `npm run studio` | open Prisma Studio, a GUI to browse the database |
| `frontend/` | `npm run dev` | start the UI dev server |
| `frontend/` | `npm run build` | production build |
| `frontend/` | `npm run lint` | ESLint |

## Troubleshooting

- **"Cannot reach the GearView3D API"** in the browser → the backend isn't running. Start it (`cd backend && npm run dev`).
- **`P1000: Authentication failed`** when migrating → the password in `backend/.env` `DATABASE_URL` is wrong or not percent-encoded.
- **`P1001: Can't reach database server`** → PostgreSQL service isn't running. On Windows, check the `postgresql-x64-*` service in Services.
- **Login fails with correct demo credentials** → the seed hasn't run yet: `cd backend && npm run seed`.
- **Port 4000 already in use** → change `PORT` in `backend/.env`, and update the proxy target in `frontend/vite.config.js` to match.

## Deployment (planned)

The app will later be packaged into Docker containers and hosted behind a reverse proxy. Not needed for local development.
