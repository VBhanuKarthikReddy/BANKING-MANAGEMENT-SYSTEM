# Admin role grouping

The application now exposes two login roles only:

- **Admin**: any active record in `EMPLOYEE` can sign in through Admin access, regardless of the employee's database job role (`Manager`, `Teller`, `Loan Officer`, or `Customer Officer`). The original database role remains stored as `databaseRole`/`user.Role` for reporting and audit purposes.
- **Customer**: customer accounts continue to authenticate separately.

No database role values were changed. Employee-management forms still preserve the actual database job role because it is part of the database model.

For existing browsers, log out of the old session before testing so a fresh `Admin` session token is created.
