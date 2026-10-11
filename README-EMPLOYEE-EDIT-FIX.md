# Employee Edit Modal Fix

## Problem
The Employee Management page called `openNexusFormModal`, but did not load `frontend/shared/forms.js`. Clicking Edit therefore raised `openNexusFormModal is not defined`.

## Fix
- Added `../shared/forms.js` to `frontend/employee_management/code.html` before `employees.js`.
- Updated the onboarding/edit handlers to call `window.openNexusFormModal` explicitly and show a readable error if the helper is unavailable.
- No database schema or employee API behavior was changed.

## Test
1. Start the backend as usual.
2. Log in as Admin.
3. Open Employees and click Edit for an employee.
4. Change a harmless field, save, and verify the updated value in PostgreSQL.
