# Audit Log – Automatic Staff Action Logging

This version automatically writes a Success audit record for successful POST/PUT/PATCH/DELETE API calls made by a logged-in staff user.

The frontend sends the employee ID from the current demo session in `X-Employee-ID`. This is suitable for the current integration/testing phase. Replace with proper authenticated authorization middleware in the security phase.

Customer write operations are not placed in `AUDIT_LOG` because the current AUDIT_LOG schema requires a non-null EmployeeID.
