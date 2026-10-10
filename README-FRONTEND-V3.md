# Banking Management System — Frontend Role + UI V3

This version builds on the previously tested integrated project.

## Fixes in V3

- Customer dashboard now receives live data from `/api/customer-dashboard`. The previous `server.js` contained the route text with escaped `\\n` sequences after a comment, which caused the route to be commented out. It is now a real Express route.
- Customer dashboard live totals are based on the authenticated customer: balance, accounts, active loans, loan principal, cards, recent transactions, loans, and upcoming loan payments.
- Replaced legacy per-page sidebar behavior with one shared role-aware sidebar shell. Links are native HTML links; navigation is not intercepted/re-written repeatedly, preventing sidebar changes when switching pages.
- Staff-only items are hidden from customers; customer navigation is limited to personal-banking modules.
- Added a common Payments-style dark banking UI layer across pages: same sidebar, surfaces, borders, typography, inputs, buttons, tables, active states, and spacing baseline.
- Staff pages retain management navigation; customer pages retain personal navigation.

## Important

Use this folder as the new baseline. Start through Node/Express at `http://localhost:3000` and do not open individual HTML files directly.

## Run

```powershell
cd backend
npm install
node server.js
```
