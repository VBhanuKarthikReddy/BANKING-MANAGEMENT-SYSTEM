# Audit Log Integration

Added a read-only staff-facing Audit Log page at `/audit-log`.

- UI: `frontend/audit_log_management/code.html`
- API: `GET /api/audit-logs`
- Data source: `AUDIT_LOG` joined with `EMPLOYEE`
- Filters: search, employee, module, status, date range
- Admin dashboard `View Audit Log` button now opens the page

Note: current audit rows are the rows already present in PostgreSQL. The next security step can add automatic audit inserts to important staff operations.
