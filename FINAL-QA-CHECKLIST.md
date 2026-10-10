# Final QA Checklist

## Customer
- [ ] Login with correct password
- [ ] Wrong password rejected
- [ ] Dashboard shows live balance/accounts/loans/cards
- [ ] Accounts are customer-scoped
- [ ] Deposit works
- [ ] Withdrawal works
- [ ] Insufficient balance is rejected
- [ ] Transfer works
- [ ] Transaction history is customer-scoped
- [ ] Loans are customer-scoped
- [ ] EMI calculation matches PostgreSQL function
- [ ] Valid loan payment can be marked Paid when due
- [ ] Cards are customer-scoped
- [ ] Fixed deposits are customer-scoped
- [ ] Nominees are customer-scoped
- [ ] Payments are customer-scoped
- [ ] Staff-only pages/API access are rejected

## Admin
- [ ] Login with correct password
- [ ] Wrong password rejected
- [ ] Dashboard shows bank-wide live data
- [ ] Customer CRUD
- [ ] Branch CRUD
- [ ] Employee CRUD
- [ ] Account management
- [ ] Loan management
- [ ] Card block/unblock
- [ ] Fixed deposit management
- [ ] Nominee view
- [ ] Payment view
- [ ] Interest-rate CRUD
- [ ] Audit-log view and automatic entries

## UI
- [ ] Shared sidebar remains stable between pages
- [ ] Customer and Admin sidebars show correct modules
- [ ] Consistent Payments-style surfaces
- [ ] INR formatting is consistent
- [ ] No stale demo counts/names
- [ ] Search fields work without console errors
- [ ] Buttons and links do not use dead `#` navigation
- [ ] Responsive layout checked
