# Banking Management System — Frontend UI V4

## Baseline fixes
- `app-shell.js` is now the single owner of the sidebar/session UI.
- `navigation.js` and `session-ui.js` are retained as compatibility no-ops to prevent conflicting sidebar rewrites.
- Added authenticated `GET /api/fd-lookups` for customer Fixed Deposit branch/rate lookups.
- Fixed customer FD page so it no longer calls staff-only `/api/branches` or `/api/interest-rates`.
- Customer dashboard now surfaces a clear API error instead of silently showing zero values when live data cannot be loaded.

## Run
```powershell
cd backend
npm install
node server.js
```
Open `http://localhost:3000`.
