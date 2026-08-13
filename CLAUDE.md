# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Scope

GearView3D is a thesis prototype for browser-based forklift familiarization training. It supports learner modules, guided checklists, parts identification, progress tracking, quizzes, final assessment review, and local admin content management. It is a preparatory learning tool, not a certification simulator (no TESDA certification implied).

**Full-stack:** `frontend/` (React + Vite) plus `backend/` (Express 5 + Prisma 6 + PostgreSQL, plain ESM Node, no TypeScript). Both must run for the app to work; the Vite dev server proxies `/api` to the backend (port 4000, see `vite.config.js`).

**Deployment** is `docker-compose.yml` at the repo root — postgres + backend + an nginx container serving the built frontend. Both images build from the **repo root**, not their own folder, because `prisma/seed.js` imports `frontend/src/data/*.js` directly. In production nginx does what the Vite proxy does in development (`frontend/nginx.conf`: `/api` to the backend, everything else falling back to `index.html` for the pushState router), so a reverse proxy in front only needs one upstream. `backend/docker-entrypoint.sh` runs `prisma migrate deploy` (never `migrate dev`) then the seed on every boot.

## Commands

Frontend (from `frontend/`):

```bash
npm install
npm run dev       # Vite dev server (usually http://localhost:5173), proxies /api -> :4000
npm run build     # production build
npm run lint      # ESLint (flat config, eslint.config.js)
```

Backend (from `backend/`; needs `backend/.env` — copy `.env.example`, set the PostgreSQL password in `DATABASE_URL` percent-encoded):

```bash
npm install
npx prisma migrate dev   # create/update the gearview3d database schema
npm run seed             # idempotent: create-if-missing only, never overwrites admin edits
npm run dev              # API on http://localhost:4000 (node --watch)
npm run studio           # Prisma Studio DB browser
```

There is no test runner configured in either package.

**Content export/import** (`backend/scripts/`, `npm run content:export` / `content:import`) moves admin-edited rows between databases as `backend/prisma/content-export.json` — the only way admin edits reach another machine, since they live in the DB and not in the repo. `contentTables.js` lists the tables and the order they import in (FK-safe); `User` and `ProgressSnapshot` are deliberately excluded, as is `Course.draft`. The import **overwrites**, which is the one place that differs from the create-if-missing seed. Adding a content table means adding it to `contentTables.js`, in dependency order.

### Demo accounts (seeded)
- Admin: `admin@mail.com` / `admin123`
- Learner: `trainee@mail.com` / `trainee123`

## Architecture

### `lib/api.js` is the seam; the backend owns the data
`frontend/src/lib/api.js` is a thin fetch client — the only file that talks HTTP. Page components call its named functions (`loginUser`, `getTrainingModules`, `adminUpdatePart`, ...) and must not fetch directly. Auth is a JWT stored in `localStorage` (`gearview_token`), sent as a Bearer header via the module-level `setAuthToken()`.

Backend layout (`backend/src/`): `app.js` (Express app), `routes/` (`auth.js`, `content.js`, `progress.js`, `admin.js` — admin routes require the ADMIN role), `lib/auth.js` (JWT + middleware), `lib/progressSummary.js` (server mirror of the frontend's per-module progress math — keep the two in sync). Response shapes intentionally match what the old localStorage implementation returned (e.g. `{ part }`, `{ deleted: true }`, part details keyed by id).

**Content** (equipment, modules, parts, part details, part categories, checklist items, quiz questions, users) lives in PostgreSQL (`backend/prisma/schema.prisma`).

**Draft/publish applies to `Course`, `Part` and `PartDetail`**: the columns are the published row a learner sees and `draft` holds the admin's pending edit as a whole payload, null when nothing is pending. Every learner-facing reader in `routes/content.js` therefore **selects columns explicitly** rather than returning the row — a `findMany` with no `select` would ship the draft to learners. `Module`, `Equipment`, `ChecklistItem`, `QuizQuestion` and `PartCategory` still save immediately; they are short labels with no long-form body to get caught half-written.

**The vehicle profile lives on `Equipment.simConfig`** (JSON, overrides only, same rule as `content` below). It is what makes a `driving` step equipment-specific: model URL, parked-obstacle model, `hasForks`, body footprint half-extents used for cone/wall collision, GLB rig node names (wheels, mast, carriage, mast foot), HUD key legend and fail messages. Defaults are code — `data/vehicleProfile.js`, measured from forklift.glb — and `lib/vehicleProfile.js` merges a row over them, falling back to the equipment's own `modelUrl` and then forklift.glb, so a driving step is never an empty scene. `lib/forkliftRig.js` skips any rig node the model lacks, so a vehicle with no rig still drives, steers and collides as a solid body; `hasForks: false` also hides the raise/lower keys. Edited under Equipment Settings (`components/admin/VehicleProfileEditor.jsx`).

**Hub copy lives on `Equipment.content`** (a JSON column, no draft — same reasoning as above). It holds *only the keys an admin overrode*; the defaults are code, in `frontend/src/data/hubContent.js` (`HUB_CONTENT_FIELDS` — key, label, section, optional `multiline`, and a `default(context)` builder). `lib/hubContent.js` resolves a row against those defaults: a blank or missing override falls back to the default, and `{equipment}` / `{learner}` tokens are substituted. So improving a default still reaches every equipment that never overrode it, and clearing a field in the admin's **Hub Content** panel (`components/admin/HubContentEditor.jsx`, mounted with `key={equipment.id}`) restores stock copy — the PATCH route drops blank keys rather than storing them. Add new hub copy by adding a field to `HUB_CONTENT_FIELDS` and reading `copy.<key>` in the page; no migration.

The database is seeded from `frontend/src/data/*.js` by `backend/prisma/seed.js` — those files stay the single source of defaults, so backend seeding imports them directly (which is why `data/` files use explicit `.js` import extensions; keep doing that). Driving-course geometry is also in the DB (`Course`, see below). What still deliberately stays in `frontend/src/data/` is the rest of the 3D/simulation config: hotspot coordinates, scenario scripts, and device effects.

**Module steps** (`Course` table) hold one row per step of Modules 2-4 — *every* step, not just the driving ones. `kind` picks how the page renders the row:

- `briefing` — reference image + markdown (`content`: `image`, `sceneBody`, `body`, `showSyllabus`, `syllabus`, `objectives`)
- `driving` — the WASD course `DrivingSimulationViewer` runs (`data`: `start`, `checkpoints`, `decorations`, `pallets`, `dropZone`, `parkingBay`, `capacityKg`, `failConditions`)
- `activity` — a React activity keyed by `content.activityId` (`shutdown-sequence`, `reporting`). Admins can reorder or delete these but not create them, since the screen is code; the create endpoint refuses the kind. The screen's **content is editable**: the shutdown cards (`content.actions` with their `order`, plus the `displayOrder` scramble) and the reporting prompts (`content.prompts` with `shouldReport`, `feedback`, `wrongFeedback`) all live on the row, edited via `components/admin/ActivityContentFields.jsx`.
- `walk-around` — an inspection phase, set by `data.phase`: `engine-off` (click every check card or 3D marker, then start the engine when `requireEngineStart`), `engine-on` (judge every `gauges` reading correctly and run every `devices` test) or `defect-test` (answer every `scenarios` question correctly). Each phase is its own row, so a module can have any subset in any order, and all three are graded step ids. Rendered by `components/WalkAroundStep.jsx` with the grading in `lib/walkAroundStep.js`; markers come from `hooks/useInspectionHotspots.js` — Forklift's `WalkAroundHotspot` rows (which carry an engine `state`) or, for any other equipment, the `EquipmentHotspot` rows edited under Parts Identification, which have no state and so show in every phase.
- `checklist` / `quiz` — render the **module's** `ChecklistItem` / `QuizQuestion` rows, which are edited in their own dashboard tabs rather than on the step; the row only carries intro copy. Both are ungraded and never gate Next. `components/ModuleChecklistStep.jsx` holds all three exports.
- `summary` — the auto-built completion grid plus editable copy (`content`: `body`, `completeMessage`, `incompleteMessage`, `counters`, `nextRoute`)

Two things a step row owns are *module*-wide rather than step-wide, because the module has exactly one of each row and no editable module record to hang them on: the briefing carries the `objectives` shown in the shell's sidebar on **every** step plus the `syllabus` card values, and the summary carries `nextRoute` — a key of `routes` (not a path), where Submit sends the learner. `lib/moduleContent.js` is the reader for all three; each falls back to the static `data/trainingModules.js` value (or the page's own fallback route key) so a row seeded before the field existed behaves exactly as it did. `prisma/seed.js` backfills content keys that are missing from a built-in row for the same reason — keys the row already has, including ones an admin blanked, always win.

Row columns are the *published* version; `draft` holds the admin's unpublished edit as a whole payload, so a half-finished step never reaches a learner. Defaults come from `data/courseDefaults.js`, which composes `moduleScenarios.js` (step order + text), `drivingCourse.js` (geometry) and `trainingModules.js` (lesson text) — those stay the baseline that "Reset to default" restores, so keep editing them for stock content.

A row's `id` doubles as the step id learner progress is keyed on; renaming one orphans that progress, which is why the dashboard does not offer it. Briefing and summary ids are namespaced (`load-handling-briefing`) because every module has one and `id` is the primary key; driving and activity ids stay bare.

**There is one quiz system.** `QuizQuestion` holds every question in the app; `context` says which kind — `'module'` (a module's quiz step, `moduleId` set) or `'parts'` (an equipment's parts/hotspot page quiz, `moduleId` null). Both carry `equipmentId`. `options` is an array of plain strings and `answer` is one of them. The old `PracticeQuestion` table was merged in (migration `20260814020000_merge_practice_into_quiz_questions`) — do not reintroduce a separate "practice quiz" concept, in the code or in UI copy.

One endpoint serves both: `GET /api/content/quizzes?module=<slug>` or `?equipment=<id>&context=parts`, and `POST /api/content/quizzes/submit` with the same scope in the body. The frontend seam is `getQuizQuestions(scope)` / `submitQuiz(scope, answers)` and one learner component, `components/Quiz.jsx`, which takes that same `scope` object. Admin edits both kinds in `components/admin/QuizAdmin.jsx` (Quizzes tab) — questions save immediately, with no draft/publish step.

**Quizzes are graded on the server.** The GET deliberately omits `answer`; the client posts its choices to `/submit`, `lib/grading.js` scores them, writes the attempt into the learner's `ProgressSnapshot`, and returns the score plus per-question feedback. The client then calls `hydrateProgressFromServer()` so its next debounced push carries the attempt instead of overwriting it. There is no client-side scoring left — `recordQuizAttempt` / `recordPartsPracticeAttempt` were removed rather than left unused.

Where an attempt lands: module quizzes go to `progress.quizzes[moduleSlug]`. Parts quizzes go to `progress.parts.practiceAttempts` **for Forklift only** — the key its percentage and assessment page have always read, kept so existing attempts still count — and to `progress.parts.quizzes[equipmentId]` for every other equipment. `getPartsQuizAttempts()` / `getLatestQuizAttempt()` in `progressService.js` are the readers; don't read either key directly.

Because the pages import `equipmentUsageModules` and `partsHotspots`, anything nested in those files ships in the browser bundle. The answer keys therefore live in **`data/moduleQuizzes.js`** and **`data/partsQuizzes.js`**, which only `prisma/seed.js` imports. Keep it that way: re-exporting either through `lib/trainingData.js`, or adding a static fallback that imports them, puts the answers back in the bundle. `npm run build` then `grep -rl "<a known answer>" dist/assets/*.js` is the check.

**Progress** is per-user in the DB (`ProgressSnapshot`, one JSON document per user, same shape as the old localStorage copy). `lib/progressService.js` still keeps localStorage (`gearview_progress_v1`) as the synchronous read source: it hydrates from `GET /api/progress` on login/session restore (`hydrateProgressFromServer()`, called in `App.jsx`), pushes debounced `PUT /api/progress` on every change, and clears only the local copy on logout. Changes dispatch a `gearview-progress-change` custom event; `hooks/useProgress.js` subscribes to keep React state in sync.

### Routing — hand-rolled, no react-router
`frontend/src/lib/router.js` defines a flat `routes` map (path strings) and a `goTo()`/`normalizePath()` pair that push/replace `window.history` state and dispatch `popstate`. `App.jsx` is the only router: it holds `path` state synced to `popstate`. All training pages route through one data-driven `/training/:equipmentId/...` branch that parses the path directly — Forklift included; the forklift keys left in `routes` (`walkAround`, `loadHandling`, `equipment`, ...) are aliases into that scheme, kept because `Course` summary rows store their post-Submit `nextRoute` as one of these keys. Old `/training/forklift/equipment/...` URLs are redirected in an `App.jsx` effect. Auth gating (redirect to `/login` if logged out, redirect to `/catalog` — the app's home screen — if logged in and on `/` or `/login`) also lives in `App.jsx`. Admin routes (`/admin`, `/admin/*`) are gated on `user.role === 'ADMIN'` and forwarded into `AdminDashboard`, which does its own sub-routing on the raw `path` prop.

### Home screen and training module flow
`ModulesPage.jsx` (`/catalog`) is the app's home screen — an equipment-selection grid fed by the `Equipment` table. A card is clickable when the equipment is `available` **and** actually has something behind it — at least one module (`moduleCount`, sent by `GET /api/content/equipment`) or a `modelUrl` for its identification page. Everything else renders "Coming Soon". This is derived, not an allow-list: a new equipment goes live as soon as an admin gives it content, with no code change. Logging in, landing on `/`, and clicking the header brand mark all route here.

`TrainingHubPage.jsx` (`/training/:equipmentId`) is the single training hub for **every** equipment, and it lists **sections, not modules**: hero + overall progress + a Training Modules card (averaged module progress, opens `/training/:equipmentId/modules`) + a Parts Identification card + the final Assessment link. All of its copy comes from `resolveHubContent()` (`Equipment.content` over the defaults in `data/hubContent.js`), so don't inline new strings here.

`ModuleListPage.jsx` (`/training/:equipmentId/modules`) is the module picker one level below the hub — one card per `Module` row (fetched via `getTrainingModules(equipmentId)`), each opening `/training/:equipmentId/modules/:slug`. This is the generic replacement for Forklift's old `/training/forklift/equipment` page, which is why the `equipment` route key now points here (`Course` summary rows store it as `nextRoute`) and old `/equipment` URLs redirect here. Its card CSS is prefixed `module-list-` because `ModulesPage.css` already owns global `.modules-grid`/`.module-card` for the equipment catalog.

`GenericModulePage.jsx` is the one module page for **every** module of every equipment — Forklift's Walk-Around Check included, since Phase E turned it into `walk-around` step rows. It renders whatever typed step rows the module has — `hooks/useModuleCourses.js` fetches them and the page switches on each row's `kind` (briefing / driving / walk-around / checklist / quiz / activity / summary) in `renderScene`/`renderTask`, all inside `components/ModuleSimulationShell.jsx` (objectives / step list / hint panel / center scene / current-task panel / progress bar). Briefings render via `components/ModuleBriefing.jsx`, summaries via `components/ModuleSummary.jsx`, the two built-in activities via `components/ModuleActivities.jsx` (ids listed in `lib/activitySteps.js`), and pre-`stepsComplete` progress snapshots are read through `lib/legacyStepFields.js` (keyed by module slug — leave those maps in place). Pages must not render `ModuleSimulationShell` until `useModuleCourses` reports `loading: false`, because completion percentage is computed against the graded step list.

The one page still keyed to Forklift, matched by equipment id inside the `/training/` branch of `App.jsx`:
- `PartsIdentificationPage.jsx` — Forklift's richer parts page (category filters over `Part`/`PartDetail` rows) at `/training/forklift/parts`; every other equipment gets `HotspotIdentificationPage.jsx` over its `EquipmentHotspot` rows. Both render the same explore + quiz steps through `components/Quiz.jsx`, and the quiz step only appears once that equipment has `context: 'parts'` questions.

`GenericAssessmentPage.jsx` serves `/training/:equipmentId/assessment` for all equipment; its only fork is where the parts numbers come from (Forklift: `summary.parts`; others: hotspot progress averaged with that equipment's parts quiz when it has one).

Static seed content (steps, scenarios, checklists, quiz questions) is defined in `frontend/src/data/*.js` and re-exported through `lib/trainingData.js` — add new stock content there rather than inlining it in page components.

`ScopeNotice` is deliberately *not* admin-editable — it is the "preparatory learning only, not a certification simulator" disclaimer. Its base copy is equipment-neutral; Forklift pages pass the exported `FORKLIFT_SCOPE_NOTE` as its `note` prop (threaded through `BriefingTask`'s `scopeNote`), so never re-hardcode forklift wording into the component.

Progress percentage per module is computed in `progressService.js` (`getModuleProgress`): simulation-reported percentage takes priority if present, otherwise it's derived from checklist completion averaged with the latest quiz score.

**Percentage denominators come from the DB, cached.** Every progress reader in `progressService.js` is synchronous, so the counts it divides by (`partsCount`, `checklistCounts`) are cached in localStorage and refreshed by `hydratePartsCount()` / `hydrateChecklistCounts()`. Those run from their **own mount effect in `App.jsx`, not the session-restore effect** — that one early-returns whenever localStorage already holds the user, so a count hung off it would only refresh on an explicit sign-in. Both numerators are clamped to their denominator, because a part or checklist item an admin deleted stays in the learner's saved progress.

Within a simulation module, per-step completion is a step-id map (`simulations[slug].stepsComplete`), built by `lib/simulationProgress.js` (`buildSimulationState`) — not a fixed list of named booleans — so steps an admin adds or removes are graded without a code change. The percentage is always recomputed against the module's *current* graded step list; entries left by a deleted step are ignored but never pruned, so re-adding the step restores completion. `lib/legacyStepFields.js` maps pre-`stepsComplete` snapshot fields per module slug; leave those in place.

#### Part details system (shared by walk-around steps and Parts Identification)
Clicking a part/hotspot anywhere shows the standard detail card: `components/PartDetailCard.jsx` (reference image slot + title + subtitle + **markdown** description + optional status line). Markdown is rendered by `components/MarkdownContent.jsx` (react-markdown) — bullet points, numbered lists, bold, and inline images (`![alt](/images/x.png)`) anywhere in the description.

Detail content lives in the **`PartDetail` DB table** (keyed by part/hotspot id: `{ id, title, subtitle, image, description }`), fetched/edited through `lib/api.js` (`getPartDetails()` returns an object keyed by id, `adminUpdatePartDetail()`). Seed defaults come from `data/partDetails.js` (`buildDefaultPartDetails()` composes markdown from `partsData.js`, `inspectionScenarios.js`, and `viewerHotspots.js`). Admins edit these under the dashboard's Parts tab (parts list + "Inspection Hotspots" list for walk-around-only ids like hydraulic-hoses, ignition, horn).

Consumers:
- `ModuleSimulationShell` "Current Task" panel renders `PartDetailCard` from `selectedDetail`/`onClearDetail` props; `GenericModulePage` builds `selectedDetail` for walk-around steps by overlaying `partDetails[id]` on the step row's own check/device entry, which supplies the context-specific status and feedback line. Auto-clears on Next/Back.
- `gear_view_3_d_forklift_viewport.jsx` (Parts Identification) renders the same `PartDetailCard` in its "Selected part" sidebar, fed by a `partDetails` prop from `PartsIdentificationPage`.

To change what a part shows, edit the seed in `data/partDetails.js` sources (or the admin dashboard for local overrides), not the components.

### 3D viewers
Three.js is used via `@react-three/fiber`/`@react-three/drei`, with `.glb` models served from `frontend/public/models/`. There are several distinct viewer components, not one shared abstraction — check which one a page already uses before adding a new one:
- `components/InteractiveForkliftViewer.jsx` — hotspot/part-labeling viewer (walk-around style pages; takes any `modelUrl`, "Forklift" in the name is legacy).
- `components/DrivingSimulationViewer.jsx` — the WASD driving/obstacle-course scene. Its `course` prop comes from the `Course` table via `getModuleCourses()` (`data/drivingCourse.js` only supplies the seed/reset baseline) and its `profile` prop from `resolveVehicleProfile(equipment)`.
- `gear_view_3_d_forklift_viewport.jsx` (top-level `src/`, not under `components/`) — the parts explore viewport used by `PartsIdentificationPage.jsx` and `HotspotIdentificationPage.jsx` (takes any `modelUrl`).

### Admin dashboard
`AdminDashboard.jsx` reads/writes content through the same `lib/api.js` admin functions (`adminUpdatePart`, `adminUpdateModule`, `adminUpdateChecklistItem`, `adminUpdateQuizQuestion`, and their delete counterparts) and reports on progress via `adminListContent()`.

**Information architecture: Overview | Training Content | Users | Reports.** Training Content holds an equipment picker (from the `Equipment` rows, so a new equipment never grows the nav) over three sections:

- **Modules** (`/admin/modules`) — `ModuleListAdmin.jsx`: the equipment's modules in `sortOrder`, with Edit / Move up / Move down / Delete and an Add form. Reordering posts `/admin/modules/reorder`; creating posts `/admin/modules`, which also writes one blank briefing step so the module is never empty; deleting removes the module's `Course` rows too (they reference it by slug, not by relation, so nothing cascades for them).
- **Parts Identification** (`/admin/parts`) — Forklift: `PartHotspotAdmin.jsx`, the same list + place-on-the-model split the hotspot editors use, over `Part` rows (add / place / drag / publish / delete) with their `PartDetail` cards and a second list for detail-only ids (ignition, horn, hydraulic hoses) that have no marker to place. Beside it: part categories, the parts quiz, and the Walk-Around hotspot editor. Every other equipment: `EquipmentHotspotAdmin` plus its parts quiz. All three editors share the `hotspot-*` classes in `WalkAroundHotspotAdmin.css`.
- **Equipment Settings** (`/admin/settings`) — the catalog card (title, description, image, model URL, availability), the **Driving Simulation** vehicle profile, and the Hub Content field editor. Equipment itself is created from the picker's Add box and deleted here; deletion is refused while the equipment still has modules, hotspots or quiz questions.

**Adding an equipment takes no code.** Add it in the picker, fill in its card (model URL, availability), give it modules and steps in the Module Editor, hotspots and a parts quiz under Parts Identification, and a vehicle profile if it has driving steps. `prisma/seed.js` only supplies Forklift's stock content and one starter module per seeded equipment.

There are no Checklists / Quizzes / Driving Courses tabs: those rows are edited **inside the module that renders them**.

#### Module Editor — `/admin/modules/:slug`
`components/admin/ModuleEditor.jsx` is everything one module owns: its card fields, its ordered step list (create with a kind picker, reorder, select), and the selected step edited in place. Step kinds are shown by learner-facing name — Read Up (briefing), Driving Course, Checklist, Quiz, Built-in Activity, Completion Summary. Checklist steps render `ChecklistAdmin.jsx` under the step's own fields and quiz steps render `QuizAdmin.jsx` scoped to that module, because those rows belong to the *module* — every checklist step of a module shows the same items. Course rows are fetched separately from `adminListContent()` (`adminListCourses()`) because the geometry blobs are large and only this screen needs them.
- `CourseEditor.jsx` — one step, rendered by the Module Editor. The panels are kind-aware: driving steps get the map, goal type and fail conditions; briefings get the image URL + two markdown bodies + syllabus toggle; summaries get the copy and counter toggles; activities get a read-only note. Only driving steps are geometry-validated. Also holds save/publish/revert/reset/delete and the on-demand 3D preview (the same `DrivingSimulationViewer` the learner drives, mounted only when asked so selecting a step doesn't spin up a WebGL context).
- `CourseCanvas.jsx` — the SVG top-down map. It is drawn **from the driver's seat**: +Z (forward) runs up the screen and +X runs to the *left*, because at heading 0 the forklift faces +Z and steering right turns it toward -X. Keep that mapping or left/right on the map stops matching the simulation.
- `CourseInspector.jsx` / `CourseGeneratorTools.jsx` — per-object properties and the bulk cone layouts.
- `lib/courseEdit.js` — pure mutations over the geometry, addressing objects by a `"<list>:<index>"` key.
- `lib/courseGoals.js` — the four completion modes `DrivingSimulationViewer` implements (`checkpoints` / `parking` / `pallet` / `free`) plus `validateCourse()`, which the backend also imports so an unwinnable course cannot be published.
- `lib/courseGenerators.js` — `coneLine` / `corridorCones` / `coneBay` / `coneBox` / `slalomCones`, shared by `data/drivingCourse.js` and the editor's insert tools. Generator output is **baked** into the decorations list as loose cones, so every cone stays individually movable.

Edits save as a draft and only reach learners on Publish. Built-in courses keep their `data/courseDefaults.js` baseline and can be reset to it; admin-created ones cannot.

All admin edits persist to PostgreSQL through the API and are shared by every user — the dashboard's `localOnly` banner is a leftover from the pre-backend prototype and `GET /api/admin/content` always returns `localOnly: false`.

## UI Design Direction

### Page shell — `components/PageLayout.jsx`
Every top-level page (one rendered per route branch in `App.jsx`, not sub-components) should wrap its content in `<PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>...</PageLayout>` rather than hand-rolling its own `<AppHeader>` + wrapper `<div>`/`<main>`. `PageLayout` renders `AppHeader` plus a `.page-layout` grid (`gap: 20px`, `width: min(1400px, 100%)`, responsive padding) — this is the single source of truth for page width/padding, so don't redefine those on a per-page container class. `ModulesPage.jsx` and `ForkliftTrainingPage.jsx` are the reference usages. `NotFoundPage.jsx` is an intentional exception (centered error card, not a content page).

Full-width simulation pages (`GenericModulePage`, `PartsIdentificationPage`, `HotspotIdentificationPage`) wrap their content in `components/SimulationPageLayout.jsx` (sticky header + back button + title block) instead of `PageLayout` — that component owns the `module-page-*` shell classes in `SimulationPageLayout.css`. `GenericModulePage.jsx` is the reference implementation for module UI: guided step-by-step simulation on `ModuleSimulationShell` (objectives/steps sidebar, center scene via `renderScene`, current-task panel via `renderTask`, per-step gating via `canProceed`).

## Notes
- Path alias `@` → `frontend/src` is configured in `vite.config.js` but most existing files use relative imports — either style works.
- Styling is plain CSS files co-located per component/page (`X.jsx` + `X.css`), plus Tailwind (v4, via `@tailwindcss/vite`) available for utility classes.
