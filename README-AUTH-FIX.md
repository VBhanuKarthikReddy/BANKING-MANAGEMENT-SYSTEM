# Backend Authorization Fix

The frontend now sends the signed session token returned by `/api/login` in the `X-Session-Token` header on every authenticated API request.

This fixes the `Authentication required. Please log in again.` error that occurred after login when calling protected APIs.

## Test
1. Set `SESSION_SECRET` in `backend/.env`.
2. Run `npm install` and `node server.js`.
3. Log in normally.
4. Open a protected page such as Employees as Administrator, or Accounts/Loans as Customer.
5. The browser requests now include `X-Session-Token` and the backend can verify the session.
