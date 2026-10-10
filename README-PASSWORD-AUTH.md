# Password Authentication — One-Time Setup

This version replaces the previous ID-only login with bcrypt password authentication while keeping the existing signed session-token authorization.

## 1. Configure `.env`

Copy `backend/.env.example` to `backend/.env` and set your PostgreSQL password and a long `SESSION_SECRET`.

## 2. Install dependencies

From `backend`:

```powershell
npm install
```

## 3. Create credential records

Run once:

```powershell
node setup-auth.js
```

This creates the `USER_CREDENTIAL` table and seeds a bcrypt password for every current customer and employee. The default development password is:

```text
Bank@123
```

You can change it by setting `DEFAULT_DEMO_PASSWORD` in `.env` before running `setup-auth.js`.

## 4. Start the server

```powershell
node server.js
```

## 5. Login

Use the same ID as before, but now enter the seeded password.

For staff, the selected role must exactly match the employee's `EMPLOYEE.Role`.

## 6. Change password API

An authenticated user can change their password with `POST /api/change-password`:

```json
{
  "currentPassword": "Bank@123",
  "newPassword": "A-strong-new-password"
}
```

Minimum new password length is 8 characters.

## Note

This is for the local/college project environment. The seeded password is intentionally a shared demo credential; change it before any real deployment.
