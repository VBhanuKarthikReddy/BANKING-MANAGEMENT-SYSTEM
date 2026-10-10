# Backend Authentication / Authorization Update

This version adds signed session tokens to the existing ID-based login flow. It does NOT add password hashing yet.

## Test
1. Copy SESSION_SECRET from backend/.env.example into backend/.env and choose a long random value.
2. Run `npm install` and `node server.js`.
3. Login normally. The login response now contains a session token.
4. The frontend automatically sends the token as `X-Session-Token`.

## Backend enforcement
- Every API route after login requires a valid, non-expired signed session token.
- Customer requests are automatically scoped to their own customer ID for customer-scoped endpoints.
- Customers cannot call staff-only customer/branch/employee/audit-log/interest-rate/dashboard APIs.
- Customers cannot change loan/card/fixed-deposit status.
- Account creation and account status-management are staff-only.
- Audit entries use the authenticated employee identity when available.

The next security step is real password authentication and persistent sessions; this update intentionally keeps the existing database records unchanged.
