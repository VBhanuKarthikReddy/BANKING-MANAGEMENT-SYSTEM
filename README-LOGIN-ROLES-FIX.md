# Login Roles Fix

Login role choices now match the values in EMPLOYEE.Role exactly: Manager, Teller, Loan Officer, Customer Officer, plus Customer. The old Administrator/Branch Manager/Employee labels were removed because they did not match the current database rows. Manager is mapped to the existing management access bucket (Branch Manager) after authentication; the actual database role remains visible as user.role.

Employee onboarding role choices were also aligned to the same database values.
