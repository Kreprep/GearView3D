# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Scope

GearView3D is a thesis prototype for browser-based forklift familiarization training. It supports learner modules, guided checklists, parts identification, progress tracking, quizzes, final assessment review, and local admin content management. It is a preparatory learning tool, not a certification simulator (no TESDA certification implied).

**Current phase: frontend-first.** The plan is to finish the frontend before building the backend, so a real backend is intentionally not implemented yet — `frontend/src/lib/api.js` stands in for it (see below). The `backend/` directory is an empty placeholder (git-ignored `node_modules` only, no source). When backend work does start, expect Express + Prisma + PostgreSQL based on prior planning, but confirm with the user before assuming that stack rather than resurrecting old code.

## Commands

All commands run from `frontend/`:

```bash
cd frontend
npm install       # install deps
npm run dev       # start Vite dev server (usually http://localhost:5173)
npm run build     # production build
npm run preview   # preview production build
npm run lint      # ESLint (flat config, eslint.config.js)
```

There is no test runner configured in this project.

### Demo accounts (mock auth, no backend)
- Admin: `admin@mail.com` / `admin123`
- Learner: `trainee@mail.com` / `trainee123`

## Architecture

### No backend yet — `lib/api.js` is the seam
`frontend/src/lib/api.js` implements every "API" function (`loginUser`, `getTrainingModules`, `adminUpdatePart`, etc.) as a local, synchronous-under-the-hood operation against hardcoded demo users and `localStorage`. There is no HTTP client and no `.env`/base URL config. This is deliberate for the current frontend-first phase, not a gap to fill in — when backend work eventually starts, this file is the single place that needs to change to call real endpoints instead; page components should keep calling these same function names rather than fetching directly.

Two separate localStorage-backed stores exist and are merged at read time (see `getContentWithProgress()` in `api.js`):
- **Content store** (`gearview_local_content_v1`): admin-editable modules/parts/checklists/quiz questions, seeded from `lib/trainingData.js` defaults on first load.
- **Progress store** (`gearview_progress_v1`, managed by `lib/progressService.js`): per-learner checklist completion, quiz attempts, parts viewed, and simulation progress. Changes dispatch a `gearview-progress-change` custom event; `hooks/useProgress.js` subscribes to this (plus the native `storage` event) to keep React state in sync across the app without a global store library.

### Routing — hand-rolled, no react-router
`frontend/src/lib/router.js` defines a flat `routes` map (path strings) and a `goTo()`/`normalizePath()` pair that push/replace `window.history` state and dispatch `popstate`. `App.jsx` is the only router: it holds `path` state synced to `popstate`, and renders one page component per `if (path === routes.x)` branch — there is no route table or nested router. Auth gating (redirect to `/login` if logged out, redirect to `/catalog` — the app's home screen — if logged in and on `/` or `/login`) also lives in `App.jsx`. Admin routes (`/admin`, `/admin/*`) are gated on `user.role === 'ADMIN'` and forwarded into `AdminDashboard`, which does its own sub-routing on the raw `path` prop.

When adding a new page: add its path to `routes` in `router.js`, add an `if (path === routes.newThing)` branch in `App.jsx`, and pass `onNavigate`/`onBack` callbacks down rather than importing the router directly in leaf components.

### Home screen and training module flow
`ModulesPage.jsx` (`/catalog`) is the app's home screen — an equipment-selection grid where learners pick a heavy equipment type to train on. Only the Forklift card is clickable (goes to `/training/forklift`); Backhoe Loader and Mobile Crane render as non-interactive "Coming Soon" placeholders for future equipment. Logging in, landing on `/`, and clicking the header brand mark all route here.

`ForkliftTrainingPage.jsx` (`/training/forklift`) is the per-equipment training hub — overall/module progress cards plus entry points into Equipment Usage, Parts Identification, and the final Assessment. It takes a `moduleName` prop (currently always `"Forklift"`, passed from `App.jsx`); if a second equipment type is ever added, expect a sibling page like `BackhoeTrainingPage.jsx` at its own route rather than making this one generic. Equipment sub-modules live under `/training/forklift/equipment/...` (see `routes` in `router.js`): Equipment Usage → Walk-Around Check → Load Handling → Post-Operation, plus a parallel Parts Identification track and a final Assessment. Each equipment sub-module page (`WalkAroundCheckPage`, `LoadHandlingPage`, `PostOperationPage`) wraps its content in `components/ModuleSimulationShell.jsx`, a generic step-based simulation layout (objectives / step list / hint panel / center scene / current-task panel / progress bar) driven by a `steps` array and `renderScene`/`renderTask` render props. Module content (steps, scenarios, checklists, quiz questions) is defined in `frontend/src/data/*.js` (`trainingModules.js`, `moduleScenarios.js`, `inspectionScenarios.js`, `drivingCourse.js`, `partsData.js`) and re-exported through `lib/trainingData.js` — add new module content there rather than inlining it in page components.

Progress percentage per module is computed in `progressService.js` (`getModuleProgress`): simulation-reported percentage takes priority if present, otherwise it's derived from checklist completion averaged with the latest quiz score.

#### Part details system (shared by Walk-Around Check and Parts Identification)
Clicking a part/hotspot anywhere shows the standard detail card: `components/PartDetailCard.jsx` (reference image slot + title + subtitle + **markdown** description + optional status line). Markdown is rendered by `components/MarkdownContent.jsx` (react-markdown) — bullet points, numbered lists, bold, and inline images (`![alt](/images/x.png)`) anywhere in the description.

Detail content lives in the **`partDetails` content collection** (object keyed by part/hotspot id: `{ id, title, subtitle, image, description }`), seeded by `data/partDetails.js` (`buildDefaultPartDetails()` composes markdown defaults from `partsData.js`, `inspectionScenarios.js`, and `viewerHotspots.js`) and stored/edited through `lib/api.js` (`getPartDetails()`, `adminUpdatePartDetail()`). Saved admin edits are merged per-entry over seed defaults at read time, so new seeded ids still appear after edits. Admins edit these under the dashboard's Parts tab (parts list + "Inspection Hotspots" list for walk-around-only ids like hydraulic-hoses, ignition, horn).

Consumers:
- `ModuleSimulationShell` "Current Task" panel renders `PartDetailCard` from `selectedDetail`/`onClearDetail` props; `WalkAroundCheckPage` builds `selectedDetail` by overlaying `partDetails[id]` on the scenario data (`engineOffInspectionChecks` / `walkAroundViewerHotspots` remain the fallback + supply the context-specific status/feedback line). Auto-clears on Next/Back step or inspection-state toggle.
- `gear_view_3_d_forklift_viewport.jsx` (Parts Identification) renders the same `PartDetailCard` in its "Selected part" sidebar, fed by a `partDetails` prop from `PartsIdentificationPage`.

To change what a part shows, edit the seed in `data/partDetails.js` sources (or the admin dashboard for local overrides), not the components.

### 3D viewers
Three.js is used via `@react-three/fiber`/`@react-three/drei`, with `.glb` models served from `frontend/public/models/`. There are several distinct viewer components, not one shared abstraction — check which one a page already uses before adding a new one:
- `components/Model3DViewer.jsx` — generic model loader/viewer.
- `components/InteractiveForkliftViewer.jsx` — hotspot/part-labeling viewer (Equipment Usage / walk-around style pages).
- `components/DrivingSimulationViewer.jsx` — the WASD driving/obstacle-course scene, content sourced from `data/drivingCourse.js`.
- `gear_view_3_d_forklift_viewport.jsx` (top-level `src/`, not under `components/`) — used specifically by `PartsIdentificationPage.jsx` for the parts explore/practice viewport.

### Admin dashboard
`AdminDashboard.jsx` reads/writes content through the same `lib/api.js` admin functions (`adminUpdatePart`, `adminUpdateModule`, `adminUpdateChecklistItem`, `adminUpdateQuizQuestion`, and their delete counterparts) and reports on progress via `adminListContent()`. All edits are local-only (persisted to the current browser's `localStorage`), there is no multi-user sync.

## UI Design Direction

### Page shell — `components/PageLayout.jsx`
Every top-level page (one rendered per route branch in `App.jsx`, not sub-components) should wrap its content in `<PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>...</PageLayout>` rather than hand-rolling its own `<AppHeader>` + wrapper `<div>`/`<main>`. `PageLayout` renders `AppHeader` plus a `.page-layout` grid (`gap: 20px`, `width: min(1400px, 100%)`, responsive padding) — this is the single source of truth for page width/padding, so don't redefine those on a per-page container class. `ModulesPage.jsx` and `ForkliftTrainingPage.jsx` are the reference usages. `NotFoundPage.jsx` is an intentional exception (centered error card, not a content page).

The equipment-usage sub-modules were built at different times and **do not share one design language yet**. When building new module UI or touching existing ones, follow the current pattern, not the old one:

- **Current/target design** — `LoadHandlingPage.jsx` (`/training/forklift/equipment/load-handling`) and `WalkAroundCheckPage.jsx`. Guided step-by-step simulation built on `ModuleSimulationShell` (objectives/steps sidebar, center 3D scene via `renderScene`, current-task panel via `renderTask`, feedback toasts, per-step gating via `canProceed`). Treat this as the reference implementation for new module pages.
- **Old design, to be migrated away from** — `PostOperationPage.jsx` (`/training/forklift/equipment/post-operation`). Static stacked sections (`syllabus-section`, `learning-objectives`, hardcoded step cards) plus separate bolted-on `GuidedChecklist` / `ModuleQuiz` / `ModuleCompletionSummary` components instead of the unified shell. Don't copy this pattern for new work; if asked to redesign this page, bring it in line with `LoadHandlingPage.jsx` instead.

## Notes
- Path alias `@` → `frontend/src` is configured in `vite.config.js` but most existing files use relative imports — either style works.
- Styling is plain CSS files co-located per component/page (`X.jsx` + `X.css`), plus Tailwind (v4, via `@tailwindcss/vite`) available for utility classes.
