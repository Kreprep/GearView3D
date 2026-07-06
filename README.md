# GearView3D

GearView3D is a thesis prototype for browser-based forklift familiarization. This branch is a frontend-only demo that supports learner modules, guided checklists, parts identification, progress tracking, quizzes, final assessment review, and local admin content management.

Important scope note: GearView3D is for preparatory learning only. It is not a certification simulator and does not imply TESDA certification.

## Run This Branch

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

This branch does not require any server, database, migrations, or environment variables. Data is loaded from frontend files and saved in browser `localStorage`.

## Demo Accounts

- Admin: `admin@mail.com` / `admin123`
- Learner: `trainee@mail.com` / `trainee123`

## Main Learner Flow

1. Log in.
2. Open Dashboard.
3. Browse Catalog.
4. Start Forklift Training.
5. Complete Equipment Usage modules.
6. Use Parts Identification Learn, Explore, and Practice modes.
7. Review Final Assessment.

## Admin Flow

Admin routes:

- `/admin`
- `/admin/modules`
- `/admin/parts`
- `/admin/checklists`
- `/admin/quizzes`
- `/admin/users`
- `/admin/reports`

Admins can review and edit modules, parts, checklist items, quiz questions, view local learner progress, and export a CSV report. Admin edits are saved locally in the current browser.
