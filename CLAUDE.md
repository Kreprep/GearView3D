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

**Content** (equipment, modules, parts, part details, part categories, practice questions, checklist items, quiz questions, users) lives in PostgreSQL (`backend/prisma/schema.prisma`).

**Draft/publish applies to `Course`, `Part`, `PartDetail` and `PracticeQuestion`**: the columns are the published row a learner sees and `draft` holds the admin's pending edit as a whole payload, null when nothing is pending. Every learner-facing reader in `routes/content.js` therefore **selects columns explicitly** rather than returning the row — a `findMany` with no `select` would ship the draft to learners. `Module`, `Equipment`, `ChecklistItem`, `QuizQuestion` and `PartCategory` still save immediately; they are short labels with no long-form body to get caught half-written. It is seeded from `frontend/src/data/*.js` by `backend/prisma/seed.js` — those files stay the single source of defaults, so backend seeding imports them directly (which is why `data/` files use explicit `.js` import extensions; keep doing that). Driving-course geometry is also in the DB (`Course`, see below). What still deliberately stays in `frontend/src/data/` is the rest of the 3D/simulation config: hotspot coordinates, scenario scripts, and device effects.

**Module steps** (`Course` table) hold one row per step of Modules 2-4 — *every* step, not just the driving ones. `kind` picks how the page renders the row:

- `briefing` — reference image + markdown (`content`: `image`, `sceneBody`, `body`, `showSyllabus`, `syllabus`, `objectives`)
- `driving` — the WASD course `DrivingSimulationViewer` runs (`data`: `start`, `checkpoints`, `decorations`, `pallets`, `dropZone`, `parkingBay`, `capacityKg`, `failConditions`)
- `activity` — a React activity keyed by `content.activityId` (`shutdown-sequence`, `reporting`). Admins can reorder or delete these but not create them, since the screen is code; the create endpoint refuses the kind. The screen's **content is editable**: the shutdown cards (`content.actions` with their `order`, plus the `displayOrder` scramble) and the reporting prompts (`content.prompts` with `shouldReport`, `feedback`, `wrongFeedback`) all live on the row, edited via `components/admin/ActivityContentFields.jsx`.
- `checklist` / `quiz` — render the **module's** `ChecklistItem` / `QuizQuestion` rows, which are edited in their own dashboard tabs rather than on the step; the row only carries intro copy. Both are ungraded and never gate Next. `components/ModuleChecklistStep.jsx` holds all three exports.
- `summary` — the auto-built completion grid plus editable copy (`content`: `body`, `completeMessage`, `incompleteMessage`, `counters`, `nextRoute`)

Two things a step row owns are *module*-wide rather than step-wide, because the module has exactly one of each row and no editable module record to hang them on: the briefing carries the `objectives` shown in the shell's sidebar on **every** step plus the `syllabus` card values, and the summary carries `nextRoute` — a key of `routes` (not a path), where Submit sends the learner. `lib/moduleContent.js` is the reader for all three; each falls back to the static `data/trainingModules.js` value (or the page's own fallback route key) so a row seeded before the field existed behaves exactly as it did. `prisma/seed.js` backfills content keys that are missing from a built-in row for the same reason — keys the row already has, including ones an admin blanked, always win.

Row columns are the *published* version; `draft` holds the admin's unpublished edit as a whole payload, so a half-finished step never reaches a learner. Defaults come from `data/courseDefaults.js`, which composes `moduleScenarios.js` (step order + text), `drivingCourse.js` (geometry) and `trainingModules.js` (lesson text) — those stay the baseline that "Reset to default" restores, so keep editing them for stock content.

A row's `id` doubles as the step id learner progress is keyed on; renaming one orphans that progress, which is why the dashboard does not offer it. Briefing and summary ids are namespaced (`load-handling-briefing`) because every module has one and `id` is the primary key; driving and activity ids stay bare.

**Progress** is per-user in the DB (`ProgressSnapshot`, one JSON document per user, same shape as the old localStorage copy). `lib/progressService.js` still keeps localStorage (`gearview_progress_v1`) as the synchronous read source: it hydrates from `GET /api/progress` on login/session restore (`hydrateProgressFromServer()`, called in `App.jsx`), pushes debounced `PUT /api/progress` on every change, and clears only the local copy on logout. Changes dispatch a `gearview-progress-change` custom event; `hooks/useProgress.js` subscribes to keep React state in sync.

### Routing — hand-rolled, no react-router
`frontend/src/lib/router.js` defines a flat `routes` map (path strings) and a `goTo()`/`normalizePath()` pair that push/replace `window.history` state and dispatch `popstate`. `App.jsx` is the only router: it holds `path` state synced to `popstate`, and renders one page component per `if (path === routes.x)` branch — there is no route table or nested router. Auth gating (redirect to `/login` if logged out, redirect to `/catalog` — the app's home screen — if logged in and on `/` or `/login`) also lives in `App.jsx`. Admin routes (`/admin`, `/admin/*`) are gated on `user.role === 'ADMIN'` and forwarded into `AdminDashboard`, which does its own sub-routing on the raw `path` prop.

When adding a new page: add its path to `routes` in `router.js`, add an `if (path === routes.newThing)` branch in `App.jsx`, and pass `onNavigate`/`onBack` callbacks down rather than importing the router directly in leaf components.

### Home screen and training module flow
`ModulesPage.jsx` (`/catalog`) is the app's home screen — an equipment-selection grid where learners pick a heavy equipment type to train on. Only the Forklift card is clickable (goes to `/training/forklift`); Backhoe Loader and Mobile Crane render as non-interactive "Coming Soon" placeholders for future equipment. Logging in, landing on `/`, and clicking the header brand mark all route here.

`ForkliftTrainingPage.jsx` (`/training/forklift`) is the per-equipment training hub — overall/module progress cards plus entry points into Equipment Usage, Parts Identification, and the final Assessment. It takes a `moduleName` prop (currently always `"Forklift"`, passed from `App.jsx`); if a second equipment type is ever added, expect a sibling page like `BackhoeTrainingPage.jsx` at its own route rather than making this one generic. Equipment sub-modules live under `/training/forklift/equipment/...` (see `routes` in `router.js`): Equipment Usage → Walk-Around Check → Load Handling → Post-Operation, plus a parallel Parts Identification track and a final Assessment. Each equipment sub-module page (`WalkAroundCheckPage`, `LoadHandlingPage`, `PostOperationPage`) wraps its content in `components/ModuleSimulationShell.jsx`, a generic step-based simulation layout (objectives / step list / hint panel / center scene / current-task panel / progress bar) driven by a `steps` array and `renderScene`/`renderTask` render props. Module content (steps, scenarios, checklists, quiz questions) is defined in `frontend/src/data/*.js` (`trainingModules.js`, `moduleScenarios.js`, `inspectionScenarios.js`, `drivingCourse.js`, `partsData.js`) and re-exported through `lib/trainingData.js` — add new module content there rather than inlining it in page components.

**Modules 2-4 have no hardcoded step list.** `hooks/useModuleCourses.js` fetches the ordered rows and the page switches on each row's `kind` in `renderScene`/`renderTask` — there is no `if (currentStep.id === 'briefing')` left. Pages must not render `ModuleSimulationShell` until the hook reports `loading: false`, because completion percentage is computed against the graded step list. Briefings render via `components/ModuleBriefing.jsx` (`BriefingScene` + `BriefingTask`) and summaries via `components/ModuleSummary.jsx`; both are generic and read their row's `content`. The only code-owned screens left are the two `activity` steps in Post-Operation. Module 1 (Walk-Around Check) is untouched and still fully hardcoded off `moduleScenarios.js`.

`ScopeNotice` is deliberately *not* editable — it is the "preparatory learning only, not a certification simulator" disclaimer and `BriefingTask` renders it on every briefing regardless of `content`.

Progress percentage per module is computed in `progressService.js` (`getModuleProgress`): simulation-reported percentage takes priority if present, otherwise it's derived from checklist completion averaged with the latest quiz score.

**Percentage denominators come from the DB, cached.** Every progress reader in `progressService.js` is synchronous, so the counts it divides by (`partsCount`, `checklistCounts`) are cached in localStorage and refreshed by `hydratePartsCount()` / `hydrateChecklistCounts()`. Those run from their **own mount effect in `App.jsx`, not the session-restore effect** — that one early-returns whenever localStorage already holds the user, so a count hung off it would only refresh on an explicit sign-in. Both numerators are clamped to their denominator, because a part or checklist item an admin deleted stays in the learner's saved progress.

Within a simulation module, per-step completion is a step-id map (`simulations[slug].stepsComplete`), built by `lib/simulationProgress.js` (`buildSimulationState`) — not a fixed list of named booleans — so steps an admin adds or removes are graded without a code change. The percentage is always recomputed against the module's *current* graded step list; entries left by a deleted step are ignored but never pruned, so re-adding the step restores completion. Each page passes a `legacyStepFields` map that reads pre-`stepsComplete` snapshots; leave those in place.

#### Part details system (shared by Walk-Around Check and Parts Identification)
Clicking a part/hotspot anywhere shows the standard detail card: `components/PartDetailCard.jsx` (reference image slot + title + subtitle + **markdown** description + optional status line). Markdown is rendered by `components/MarkdownContent.jsx` (react-markdown) — bullet points, numbered lists, bold, and inline images (`![alt](/images/x.png)`) anywhere in the description.

Detail content lives in the **`PartDetail` DB table** (keyed by part/hotspot id: `{ id, title, subtitle, image, description }`), fetched/edited through `lib/api.js` (`getPartDetails()` returns an object keyed by id, `adminUpdatePartDetail()`). Seed defaults come from `data/partDetails.js` (`buildDefaultPartDetails()` composes markdown from `partsData.js`, `inspectionScenarios.js`, and `viewerHotspots.js`). Admins edit these under the dashboard's Parts tab (parts list + "Inspection Hotspots" list for walk-around-only ids like hydraulic-hoses, ignition, horn).

Consumers:
- `ModuleSimulationShell` "Current Task" panel renders `PartDetailCard` from `selectedDetail`/`onClearDetail` props; `WalkAroundCheckPage` builds `selectedDetail` by overlaying `partDetails[id]` on the scenario data (`engineOffInspectionChecks` / `walkAroundViewerHotspots` remain the fallback + supply the context-specific status/feedback line). Auto-clears on Next/Back step or inspection-state toggle.
- `gear_view_3_d_forklift_viewport.jsx` (Parts Identification) renders the same `PartDetailCard` in its "Selected part" sidebar, fed by a `partDetails` prop from `PartsIdentificationPage`.

To change what a part shows, edit the seed in `data/partDetails.js` sources (or the admin dashboard for local overrides), not the components.

### 3D viewers
Three.js is used via `@react-three/fiber`/`@react-three/drei`, with `.glb` models served from `frontend/public/models/`. There are several distinct viewer components, not one shared abstraction — check which one a page already uses before adding a new one:
- `components/Model3DViewer.jsx` — generic model loader/viewer.
- `components/InteractiveForkliftViewer.jsx` — hotspot/part-labeling viewer (Equipment Usage / walk-around style pages).
- `components/DrivingSimulationViewer.jsx` — the WASD driving/obstacle-course scene. Its `course` prop now comes from the `Course` table via `getModuleCourses()`; `data/drivingCourse.js` only supplies the seed/reset baseline.
- `gear_view_3_d_forklift_viewport.jsx` (top-level `src/`, not under `components/`) — used specifically by `PartsIdentificationPage.jsx` for the parts explore/practice viewport.

### Admin dashboard
`AdminDashboard.jsx` reads/writes content through the same `lib/api.js` admin functions (`adminUpdatePart`, `adminUpdateModule`, `adminUpdateChecklistItem`, `adminUpdateQuizQuestion`, and their delete counterparts) and reports on progress via `adminListContent()`.

#### Courses tab — the step + 3D map editor
`/admin/courses` renders `components/admin/CourseAdmin.jsx`, which is where admins add, edit, reorder and delete every step of Modules 2-4. Rows are fetched separately from `adminListContent()` (`adminListCourses()`) because the geometry blobs are large and only this tab needs them.

- `CourseAdmin.jsx` — module tabs, the step list (reorder, create with a kind picker, select), and the surrounding CRUD.
- `CourseEditor.jsx` — one step. The panels are kind-aware: driving steps get the map, goal type and fail conditions; briefings get the image URL + two markdown bodies + syllabus toggle; summaries get the copy and counter toggles; activities get a read-only note. Only driving steps are geometry-validated. Also holds save/publish/revert/reset/delete and the on-demand 3D preview (the same `DrivingSimulationViewer` the learner drives, mounted only when asked so selecting a step doesn't spin up a WebGL context).
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

The equipment-usage sub-modules were built at different times and **do not share one design language yet**. When building new module UI or touching existing ones, follow the current pattern, not the old one:

- **Current/target design** — `LoadHandlingPage.jsx` (`/training/forklift/equipment/load-handling`) and `WalkAroundCheckPage.jsx`. Guided step-by-step simulation built on `ModuleSimulationShell` (objectives/steps sidebar, center 3D scene via `renderScene`, current-task panel via `renderTask`, feedback toasts, per-step gating via `canProceed`). Treat this as the reference implementation for new module pages.
- **Old design, to be migrated away from** — `PostOperationPage.jsx` (`/training/forklift/equipment/post-operation`). Static stacked sections (`syllabus-section`, `learning-objectives`, hardcoded step cards) plus separate bolted-on `GuidedChecklist` / `ModuleQuiz` / `ModuleCompletionSummary` components instead of the unified shell. Don't copy this pattern for new work; if asked to redesign this page, bring it in line with `LoadHandlingPage.jsx` instead.

## Notes
- Path alias `@` → `frontend/src` is configured in `vite.config.js` but most existing files use relative imports — either style works.
- Styling is plain CSS files co-located per component/page (`X.jsx` + `X.css`), plus Tailwind (v4, via `@tailwindcss/vite`) available for utility classes.
