# GearView3D Install & Run

This branch runs as a frontend-only thesis prototype. It does not require a server, database, migrations, or environment variables.

## Prerequisites

- Node.js
- Git
- VS Code, optional but recommended

## Run

Open PowerShell in the project folder:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL shown by Vite, usually:

```text
http://localhost:5173
```

## Demo Accounts

- Admin: `admin@mail.com` / `admin123`
- Learner: `trainee@mail.com` / `trainee123`

## Notes

- Learner progress is saved in browser `localStorage`.
- Admin edits are saved in browser `localStorage`.
- To reset learner progress, use the dashboard reset button.
- To clear all local prototype data, clear site data for the Vite URL in your browser.

## Troubleshooting

- If `npm install` says it cannot find `package.json`, confirm you are inside the `frontend` folder.
- If port `5173` is already in use, Vite will show another local URL.
