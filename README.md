# Banking Management System — Final Integration Baseline

This is the consolidated group-project baseline after functional integration and the first full UI consistency pass.

## Application roles
- **Admin**: all active records in `EMPLOYEE` are grouped into one application-level Admin role. The underlying employee job role remains stored in `EMPLOYEE.Role`.
- **Customer**: personal banking portal with customer-scoped data.

## Main functional modules
Customers, Branches, Employees, Accounts, Transactions, Loans, Cards, Beneficiaries, Fixed Deposits, Nominees, Payments, Interest Rates, Audit Logs, and dashboards.

## Architecture
Browser frontend → Node.js/Express REST API → PostgreSQL.

## Authentication
Password-based login with bcrypt-hashed credentials stored in `USER_CREDENTIAL`, signed session tokens, and backend authorization checks.

## Important test flows already verified
- Customer login and customer-only data scope
- Admin login and staff management access
- Deposit / withdrawal / insufficient-balance rejection
- Fund transfer and statement history
- Loan application / approval / EMI / payment
- Customer/admin card views and card block/unblock
- Customer/admin branch CRUD
- Employee CRUD
- Beneficiary CRUD and Active/Blocked status
- Fixed deposit creation and maturity calculation
- Nominee CRUD
- Payment management
- Interest rate CRUD
- Audit logging
- Dashboard live data

## Local setup
1. Create `backend/.env` from `.env.example`.
2. Run `npm install` in `backend/`.
3. Run `node setup-auth.js` once after the database is ready.
4. Run `node server.js`.
5. Open `http://localhost:3000`.

Demo password used during development: `Bank@123`. Change it before sharing outside the development/demo environment.

## Latest UI update: Admin creation forms

See [`README-ADMIN-CREATION-FORMS.md`](README-ADMIN-CREATION-FORMS.md) for the shared modal forms for creating customers, branches, accounts, and cards, plus local run/test instructions.

## Recent UI/action update

See `README-LOAN-TRANSACTION-ACCOUNT-ACTIONS-V2.md` for details about the styled transfer confirmation, external beneficiary handling, account deposit/withdrawal dialogs, due-date-aware loan payments, and action dialogs across modules.
