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
npm run seed             # loads demo users, modules, hotspots, checklists, quizzes
```

The seed reads the content from `frontend/src/data/`, so both folders must exist (they do, in this repo). Re-running the seed is safe — it only adds missing rows and never overwrites admin edits.

`npm test` in `backend/` needs PostgreSQL running: its route tests use a separate `gearview3d_test` database (your `DATABASE_URL` with `_test` added), which they create, migrate and empty themselves. They never touch `gearview3d`.

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
- Instructor: `instructor@mail.com` / `instructor123`
- Learner: `trainee@mail.com` / `trainee123`

Local only - seeded by `npm run seed` when `SEED_DEMO_USERS` is unset or not `false` (`backend/.env.example` default). Production (`docker-compose.yml`) sets `SEED_DEMO_USERS=false`, so these accounts are never (re-)created on the live box.

Learner progress is saved per account in the database, so the same login shows the same progress on any machine pointing at the same database.

## Roles

- **Admin**: everything, including creating accounts and changing a name, email, password or role.
- **Instructor**: edits the training content and Equipment Settings, sees the trainees and their scores, can reset a trainee's progress, and signs trainees' skills off (or revokes a sign-off, with a reason). Cannot create or edit accounts, and does not see admins or other instructors.
- **Trainee**: the training only.

The permissions are in `frontend/src/data/permissions.js`, and the API enforces them (a refused request is a 403).

## Admin Flow

Admin routes (log in as the admin account; the instructor sees the same dashboard without the account controls):

- `/admin` — overview: learner count, average completion, per-module completion, recent activity
- **Training Content** — four sections:
  - `/admin/modules` — the training modules: Edit, Move up, Move down, Delete, Add module
  - `/admin/modules/:slug` — the **Module Editor**: the module's card fields plus its ordered steps (Read Up, Driving Course, Walk Around, Checklist, Quiz, Built-in Activity, Completion Summary). Selecting a step edits it in place — a driving step gets the 3D map, a walk-around step its inspection checks / gauges / device tests / defect scenarios plus the same 3D hotspot editor, scoped to the markers it shows, a checklist step its items, a quiz step its questions
  - `/admin/parts` — the hotspot list beside the 3D model: add a hotspot, click the model to place its marker or drag one to move it, edit its detail card (Markdown + reference image), then Publish. Every placed hotspot is marked on the model at once, so you can place one against its neighbours. Each hotspot is ticked for the surfaces it appears on — Parts Identification, walk-around inspection, or both — so a component that is both is edited once, not twice. Also part categories and the parts quiz
  - `/admin/skills` — the **Skills Checklist** catalogue: each skill's title, description, category, TESDA reference and the evidence that shows it (steps completed, clean driving runs, quiz scores, parts viewed, a passed final test). Which skills a module practises or needs is set in that module's editor
  - `/admin/settings` — **Equipment Settings**: the equipment title (what `{equipment}` resolves to in the hub copy) and the **hub artwork image** (the line drawing etched into the training hub's header plate: drop a file in `frontend/public/images/` and point the field at `/images/your-file.png`, or paste any image URL), the **Hub content** (the copy on the training hub and module list; leave a field blank to use the default) and the **Driving Simulation** profile (body footprint and first-person seat)
- `/admin/users`, `/admin/reports` — learners, progress, CSV export. **Reset progress** on a user clears everything they have saved (the account stays, and so do skill sign-offs). A learner still signed in somewhere gets the reset copy on their next save rather than writing their old progress back. Expanding a learner in Reports shows their skills checklist with **Sign off** / **Revoke** and the sign-off history, which is only ever added to.

Hotspots and course steps use **Save draft / Publish**: learners keep seeing the published version until you press Publish, and Discard draft throws the pending edit away. Modules, skills, the equipment settings, hub content, part categories, checklists and quiz questions save immediately.

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

Unlike `npm run seed`, the import **overwrites** existing rows — that is how one person's edits reach everyone. It covers the equipment settings, modules, skills and their module links, hotspots, part categories, courses, checklists and quizzes; it never touches user accounts, learner progress or skill sign-offs, and unpublished drafts stay local to whoever made them.

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

## Module Pages

Every module, and Parts Identification, uses one screen. A single top bar has the back button, the module title, the steps as a row of numbered buttons (a tick on each finished step, steps not reached yet greyed out, only the current one named), the progress and the language switch. Under it the 3D scene takes the rest of the window, with the current step's panel on the right: its instructions, the task, a **Hint** that opens on request, and **Back** / **Next** at the bottom. The panel button at its top right folds it to a narrow tab, so the scene can have the whole width; the browser remembers the choice. A module's objectives and skills are on its briefing step. The layout is built to fit a 1920×1080 screen at 100% scaling without scrolling.

In a driving step the bar over the scene holds **Reset attempt**, First-person / Chase, the proximity view, and a **⋯** menu with Wheel setup, Reset camera (in chase view) and, for content editors, the free camera and the colliders. The arrow keys, the wheel's D-pad and the mouse move the camera; every key is listed under **Controls** on the dashboard.

The dashboard's cab switches work from the keyboard too: **B** the seatbelt, **Space** the parking brake, **E** the key, **H** the horn, **L** the lights, **O** the warning beacon, and **[** / **]** the left / right turn signal (the same key again cancels it). The lights, beacon and turn signals only work with the key on. Their lamps show on the truck in chase view and as indicators on the cluster. When the key is turned on, every warning lamp lights for two seconds as a bulb check.

The walk-around's **Engine-On** check happens in the cab: the forklift stands on an open inspection pad (no fails, 5 km/h limit). The step's panel lists what to do. First, the start-up (seatbelt, parking brake, neutral, key on, engine started). Then the instruments: ringed on the dashboard, each clicked and judged Normal or Abnormal in a small popover. Then each device test, done for real and ticked off when the simulation sees it: horn, lights, beacon, turn signals, steering lock to lock, a brake test, lift and tilt, a short drive each way, and for the tail lights, lights on and then the marker. In the Module Editor an engine-on step can require the engine start, give each gauge the dashboard instrument it is read on and the fault it shows (a lamp that stays lit or never lights, or a needle that climbs after key on or the start), and choose how each device is tested.

## Steering Wheel, Pedals and Shifter (optional)

The driving simulation also takes a steering wheel, pedals and H-pattern shifter through the browser's Gamepad API. It was built and tested with a Thrustmaster **T300 RS** and **TH8A**, and those two come with their buttons already set up. The keyboard keeps working alongside.

- Use **Chrome or Edge on Windows**, on `localhost` or the HTTPS live instance (the Gamepad API needs a secure context).
- Install Thrustmaster's PC drivers. In the Thrustmaster Control Panel, set the wheel rotation to **900°** and leave **auto-centre off**. The browser can't drive force feedback, so the wheel stays loose, which is close to a forklift's hydraulic steering.
- Plug the TH8A into its own USB port and set it to H-pattern. It shows up as a second controller called "T500 RS Gear Shift", which is expected.
- Press any button on the wheel with the page focused (browsers only reveal controllers after a button press), then open **Wheel setup** from the home screen or the driving screen. There you can calibrate the steering and pedals, record the shifter's gears, and change any button. The lights, beacon and turn signals have no button by default; bind them there if you want them on the wheel. Settings are saved in this browser only.
- Starting the forklift works as on a real truck: seatbelt, parking brake and neutral first, then the engine, then release the parking brake.

## Physics

Pallets, their loads and traffic cones in the driving simulation are rigid bodies in the [Rapier](https://rapier.rs) physics engine (`@dimforge/rapier3d-compat`, pinned to 0.19.3), and the forks are solid: a load is lifted because the forks are under it, rides on them by friction, slides under hard braking and is set down by levelling the mast and lowering it. The forklift itself is driven by the simulation's own model, and tipping over comes from a stability calculation (the stability triangle and the combined centre of gravity), with the capacity derated by load centre as on a load chart. Once it tips, the fall itself is simulated: the forklift becomes a free body and ends on its fork tips or lying on its side. The engine is a separate 2.2 MB chunk that is downloaded the first time a driving step opens. Content editors can turn on **Colliders** in a driving step's **⋯** menu to see the shapes the engine simulates. A course can also give a pallet a load heavier at one end (so the same weight can be over the derated capacity), start a pallet on a rack shelf, send each pallet to its own drop zone or shelf, make a checkpoint a blind crossing where the horn must be sounded, and string several of these together as a **mission**: tasks done in order (start, checkpoints, deliveries, park).

## Skills Checklist

`/training/skills` (linked from the training hub and the final check) shows the trainee entry requirements quoted from TESDA HEO (Forklift) NC II Training Regulations, Rev. 01, section 3.3, then each skill with the TESDA unit and element it serves, what evidence counts for it, which of that the trainee has done, and an instructor's sign-off. The evidence comes from progress the trainee's browser saves, so it guides the instructor; only a sign-off (stored server-side, written only by instructors and admins) confirms a skill. The TESDA mapping of the stock skills is a draft awaiting review. The page prints.

## Driving Modules

**Load Handling** teaches the controls one at a time: the start sequence with the horn and the direction lever, accelerating, braking, turning, **reversing out of a narrow aisle while looking behind**, a **5 km/h zone with a stop line and a blind crossing** where the horn must sound, then a full course that ends by reversing out of a dead end, and a pallet pickup. **Pallet Handling Assessment** adds the judgement: a precision carry, choosing a pallet within capacity, **reading the load chart** (two pallets of the same weight, one too far out along the forks to lift), **carrying a near-rated load round a curve and an S-bend**, storing pallets on the middle and top shelves, and **retrieving a pallet from the top shelf**. A redeploy adds the new steps to an existing database in their place in each module, leaves steps an admin edited alone, and upgrades the skills' evidence where nobody changed it.

**Final Driving Test** (Module 5) is one long scored run: back out of the bay the forklift is parked in, stop and sound the horn at a blind crossing, choose the pallet the forklift may lift (both weigh the same; one load sits too far out), store it on a rack's middle shelf, take the pallet on the top shelf to the dock, then park and secure the truck. Every safety sign on the way is counted. A run passes with no danger sign, at most 3 caution signs, and no sign at all for reversing without looking behind or travelling with the forks raised; the scorecard also gives a score out of 100 (5 points off per caution, 10 on those two, 20 per danger) and lists each sign. Only a passing run completes the module; a finished run that does not pass counts as a failed attempt. The latest result is on the Final Assessment page and in the instructor's Reports, and passing is evidence for two skills (safe travel, and carrying and stacking a load). In the Module Editor a mission course has a **Tasks** panel (add, reorder, name what each task points at, show it on the map) and a **Pass rules** panel (blank fields follow the stock rules), and drop zones can be placed as many times as needed, each one a target a pallet can name.

## Safety Signs

While a learner drives, safety rules watch the driving and the load handling and raise signs above the dashboard: a yellow triangle warns, a blue circle says what must be done, a red circle what must not (obstacle ahead, speed limit, forks too high for travel, mast not tilted back, overload and so on). The signs never fail an attempt. They are counted, and a completed step shows how many came up. In the Module Editor a driving step's **Safety signs** panel sets the course's speed limit (8 km/h by default) and switches the non-essential rules on or off; collisions, overload, tip-over risk, a shifting load and the start checks are always on. The thresholds are in `frontend/src/data/safetyThresholds.js`, each with the OSHA 29 CFR 1910.178 paragraph it implements.

## Sound

The walk-around's **Defect Recognition Test** shows each forklift with real changes to the model: a flat tyre, a bent tine, cracks, a slack chain, puddles and drips under a leak, an LPG plume, missing bolts, a bent guard bar. Some forklifts are checked from the seat instead, where the fault is in how the truck behaves (brakes that fade, play in the steering, forks that drift down, a horn that only clicks, a seat belt that will not latch, a lamp that stays lit, an engine that overheats or knocks). Each forklift asks one question: may it be used, what is wrong with it, click the defect on the model, or what you do about it. The titles never name the defect, the order is shuffled per learner, and the first answer to each forklift is the score. In the Module Editor each scenario picks its defects from a built-in list.

The driving simulation and the walk-around device tests play recorded sounds: the engine, the reverse beeper, the hydraulics, the lift chain, the horn, the cab's switches, and a chime or an alarm with the safety signs. Volume and mute are on the operator dashboard and on the walk-around step, and are saved in this browser only. If the browser holds the sound back, the driving screen shows **Click to enable sound**; a click or a key press starts it (a steering wheel's buttons may not).

Every sound is a CC0 recording from Freesound. The source, author and licence of each file are listed in [`frontend/public/audio/CREDITS.md`](frontend/public/audio/CREDITS.md). To rebuild a file from its original, put the download in `frontend/audio-src/raw/` and run `node scripts/build-audio.mjs` from `frontend/` (needs [ffmpeg](https://ffmpeg.org/) on the PATH).

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

- `docker-compose.yml` sets `SEED_DEMO_USERS=false`, so `admin@mail.com`/`admin123` is never seeded in this deployment - create your own admin account instead of relying on it.
- The database lives in the `pgdata` volume. `docker compose down` keeps it; `docker compose down -v` deletes it.
- Both images build from the repo root, because the seed imports the frontend's data files directly.

### Live instance

A copy of this stack runs on a homelab LXC container, reachable at `https://gearview3d.lindenwood53.vip` (public, behind a Caddy reverse proxy with CrowdSec + AppSec) and a LAN address. It follows the Docker deployment above: pull, then `docker compose up -d --build`, run **as the `eugene` user**, not root — the deploy key and passwordless `docker` group access are only wired up for that user.

- The container clones the repo over a **read-only GitHub deploy key** (not a personal token or SSH-agent forwarding), since the container has no access to anyone's personal credentials. The repo's `core.sshCommand` git config points at that key, so plain `git pull` works — if that config is ever missing (e.g. after a fresh clone) `git pull` fails with `Permission denied (publickey)`.
- `docker compose logs -f backend` / `-f web`, `docker compose ps`, and `docker compose restart <service>` are the usual ways to check on it.
- Full LXC specs, credentials, and setup steps live in the private homelab documentation (private documentation), not in this repo — secrets like the root password, `POSTGRES_PASSWORD`, and `JWT_SECRET` never get committed.
