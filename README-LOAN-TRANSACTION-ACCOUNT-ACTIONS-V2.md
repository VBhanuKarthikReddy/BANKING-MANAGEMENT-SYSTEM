# Banking Management System — Actions UI & Transfer Fix V2

This update builds on the Admin Creation Modals version and makes the account/transaction/loan interactions more consistent.

## Updates

- **Transactions:** Authorize Transfer opens a styled review/confirmation modal before calling the API. Source, beneficiary, transfer mode, amount, current available balance, and remarks are summarized.
- **External beneficiary transfers:** If the beneficiary account is not an internal `ACCOUNT` row, the backend no longer calls `sp_transfer_funds` (which would attempt a transaction row referencing a nonexistent account and violate `fk_transaction_account`). Instead, it debits the selected source through `sp_withdraw` and adds a `PAYMENT` row for Payment History. The API response explains that the external destination's balance is not managed by this demo database. Internal transfers still use `sp_transfer_funds` and update both internal accounts.
- **Payment Management:** The `/api/payments` route uses the same internal-vs-external handling for Fund Transfer and allocates `PaymentID` under an advisory lock.
- **Withdraw/Deposit:** Account-row actions open amount/method modals. The account is taken from the clicked row; customers are not asked to re-enter the account number. The backend derives the customer identity from the signed session and verifies account ownership even if the client omits `customerId`.
- **Loan Payments:** Customers can open the Payments modal, review installments, and choose an active account/method in the Pay Installment form when the installment is due. Future installments remain unavailable until due, preserving the database constraint. EMI uses a details modal.
- **Loan actions:** Admin status changes use a status modal; loan applications use a form modal.
- **Account status actions:** Freeze/reactivate now display a confirmation modal, and closed accounts are not offered a misleading Reactivate control.
- **Other modules:** Customer, branch, employee, account and card creation use styled forms. Edit/delete/status actions use styled dialogs or module-specific forms (beneficiaries, nominees, rates and fixed deposits included).

## Run

1. Extract into a fresh folder.
2. Copy your existing working local `backend/.env` into `backend/`. Do not share or overwrite database credentials or `SESSION_SECRET` with placeholder values.
3. In a PowerShell window opened in `backend/`, run:

   ```powershell
   npm install
   node server.js
   ```

4. Open `http://localhost:3000` and sign in.

## Important transfer behavior

An internal destination exists in the bank's `ACCOUNT` table: the procedure updates both internal balances. An external beneficiary destination is not represented by an `ACCOUNT` row: the system debits the source and records the payment in `PAYMENT`, but cannot update an external bank's balance in this local database. The UI confirmation and success message make this distinction explicit.

## Verification

- `node --check` passed for the backend and all shared JavaScript files.
- Inline JavaScript blocks in the HTML pages passed syntax checks.
- No native browser `prompt()`, `alert()`, or `confirm()` calls were found in frontend HTML/JavaScript.
- No `href="#"` placeholders were found in frontend HTML.
- Live inserts/transfers/withdrawals still require testing against the user's local PostgreSQL schema and data.
