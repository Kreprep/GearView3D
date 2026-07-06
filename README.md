# GearView3D

GearView3D is a thesis prototype for browser-based forklift familiarization. It supports learner modules, guided checklists, parts identification, progress tracking, quizzes, final assessment review, and admin content management.

Important scope note: GearView3D is for preparatory learning only. It is not a certification simulator and does not imply TESDA certification.

## Demo Accounts

- Admin: `admin@mail.com` / `admin123`
- Learner: `trainee@mail.com` / `trainee123`

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Backend Setup

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

The API runs on `http://localhost:4000` by default.

## Database Setup

Use a local PostgreSQL database named `gearview3d` and schema `gearview3d`.

Example `.env`:

```env
PORT=4000
DATABASE_URL="postgresql://gearview3d:YOUR_PASSWORD@localhost:5432/gearview3d?schema=gearview3d"
JWT_SECRET="replace-this-secret"
CLIENT_ORIGIN="http://localhost:5173"
```

Apply schema and seed data:

```bash
cd backend
npx prisma db push
npm run prisma:seed
```

If Prisma Client generation fails on Windows with an `EPERM` rename error, stop any running backend Node process and run:

```bash
npx prisma generate
npm run prisma:seed
```

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

Admins can review and edit modules, parts, checklist items, quiz questions, view learners, and export progress reports as CSV.
