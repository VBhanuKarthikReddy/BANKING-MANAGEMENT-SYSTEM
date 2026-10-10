# Password Authentication Setup

This version replaces the previous ID-only login with bcrypt password authentication.

## One-time setup

1. Put your PostgreSQL credentials in `backend/.env`.
2. Set `SESSION_SECRET` to a long random value.
3. Optionally set `DEFAULT_DEMO_PASSWORD` (default: `Bank@123`).
4. From `backend`, run:

```powershell
npm install
node setup-auth.js
```

This creates `USER_CREDENTIAL` and seeds a bcrypt hash for every current customer and employee. The temporary password is the value of `DEFAULT_DEMO_PASSWORD`.

## Login

The selected staff role must exactly match the employee's `EMPLOYEE.Role`.

## Change password

Authenticated clients can call `POST /api/change-password` with JSON:

```json
{
  "currentPassword": "Bank@123",
  "newPassword": "A-strong-new-password"
}
```

This is the development/college-project authentication layer. Change seeded demo passwords before any real deployment.
