const bcrypt = require("bcryptjs");
const pool = require("./db");
require("dotenv").config();

const DEFAULT_PASSWORD = process.env.DEFAULT_DEMO_PASSWORD || "Bank@123";

async function main() {
    if (!DEFAULT_PASSWORD || DEFAULT_PASSWORD.length < 8) {
        throw new Error("DEFAULT_DEMO_PASSWORD must be at least 8 characters.");
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS USER_CREDENTIAL (
            CredentialID SERIAL PRIMARY KEY,
            UserType VARCHAR(20) NOT NULL,
            CustomerID INTEGER UNIQUE REFERENCES CUSTOMER(CustomerID) ON DELETE CASCADE,
            EmployeeID INTEGER UNIQUE REFERENCES EMPLOYEE(EmployeeID) ON DELETE CASCADE,
            PasswordHash TEXT NOT NULL,
            MustChangePassword BOOLEAN NOT NULL DEFAULT TRUE,
            CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT chk_user_credential_type CHECK (
                (UserType = 'Customer' AND CustomerID IS NOT NULL AND EmployeeID IS NULL)
                OR
                (UserType = 'Employee' AND EmployeeID IS NOT NULL AND CustomerID IS NULL)
            )
        )
    `);

    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

    const customers = await pool.query(`SELECT CustomerID FROM CUSTOMER ORDER BY CustomerID`);
    for (const row of customers.rows) {
        await pool.query(`
            INSERT INTO USER_CREDENTIAL
                (UserType, CustomerID, PasswordHash, MustChangePassword)
            VALUES ('Customer', $1, $2, TRUE)
            ON CONFLICT (CustomerID)
            DO UPDATE SET PasswordHash = EXCLUDED.PasswordHash,
                          MustChangePassword = TRUE,
                          UpdatedAt = CURRENT_TIMESTAMP
        `, [row.customerid, hash]);
    }

    const employees = await pool.query(`SELECT EmployeeID FROM EMPLOYEE ORDER BY EmployeeID`);
    for (const row of employees.rows) {
        await pool.query(`
            INSERT INTO USER_CREDENTIAL
                (UserType, EmployeeID, PasswordHash, MustChangePassword)
            VALUES ('Employee', $1, $2, TRUE)
            ON CONFLICT (EmployeeID)
            DO UPDATE SET PasswordHash = EXCLUDED.PasswordHash,
                          MustChangePassword = TRUE,
                          UpdatedAt = CURRENT_TIMESTAMP
        `, [row.employeeid, hash]);
    }

    console.log(`Authentication setup complete.`);
    console.log(`Customer credentials seeded: ${customers.rowCount}`);
    console.log(`Employee credentials seeded: ${employees.rowCount}`);
    console.log(`Temporary demo password: ${DEFAULT_PASSWORD}`);
    console.log(`Users should change it after login.`);
}

main()
    .catch((err) => {
        console.error("Authentication setup failed:", err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
