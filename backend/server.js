const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("./db");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const FRONTEND_DIR = path.join(__dirname, "../frontend");

const SESSION_SECRET = process.env.SESSION_SECRET || "banking-management-development-secret-change-me";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function base64url(value) {
    return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function createSessionToken(role, user) {
    const payload = {
        role,
        user,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    };
    const encoded = base64url(JSON.stringify(payload));
    const signature = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
    return `${encoded}.${signature}`;
}

function verifySessionToken(token) {
    if (!token || !token.includes(".")) return null;
    const [encoded, signature] = token.split(".");
    const expected = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
        if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch (_) {
        return null;
    }
}

function requireSession(req, res, next) {
    const token = req.get("X-Session-Token") || req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const session = verifySessionToken(token);
    if (!session) {
        return res.status(401).json({ success: false, message: "Authentication required. Please log in again." });
    }
    req.user = session.user;
    req.role = session.role;
    next();
}

function isStaffRole(role) {
    return role === "Admin";
}

function sessionRoleForEmployee(databaseRole) {
    // All EMPLOYEE database roles are grouped into one application role.
    // The original database role is still preserved as user.role/databaseRole.
    return "Admin";
}

function requireStaff(req, res, next) {
    if (!isStaffRole(req.role)) {
        return res.status(403).json({ success: false, message: "Staff access required" });
    }
    next();
}

function enforceCustomerScope(req, res, next) {
    if (req.role !== "Customer") return next();
    const customerId = Number(req.user?.customerid ?? req.user?.CustomerID);
    if (!customerId) return res.status(403).json({ success: false, message: "Customer identity missing" });

    // Customer cannot ask the API for another customer's records.
    if (req.query.customerId && Number(req.query.customerId) !== customerId) {
        return res.status(403).json({ success: false, message: "You can only access your own customer data" });
    }
    if (req.body && req.body.customerId != null && Number(req.body.customerId) !== customerId) {
        return res.status(403).json({ success: false, message: "You can only modify your own customer data" });
    }
    // Default missing customerId to the authenticated customer for customer-scoped endpoints.
    if (["/accounts", "/transactions", "/beneficiaries", "/loans", "/loan-payments", "/fixed-deposits", "/payments", "/cards", "/nominees"].includes(req.path)) {
        if (!req.query.customerId && ["GET"].includes(req.method)) req.query.customerId = String(customerId);
        if (req.body && req.body.customerId == null) req.body.customerId = customerId;
    }
    next();
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(FRONTEND_DIR));

// ---------- Automatic audit logging for staff write operations ----------
// The current project uses demo ID-based authentication, so the frontend
// sends the logged-in employee ID in X-Employee-ID. Proper authenticated
// middleware will replace this in the later security phase.
function auditModuleFromPath(pathname) {
    const match = pathname.match(/^\/api\/([^/?]+)/i);
    if (!match) return null;
    const map = {
        customers: "CUSTOMER", branches: "BRANCH", employees: "EMPLOYEE",
        accounts: "ACCOUNT", transactions: "TRANSACTION", transfers: "TRANSACTION",
        loans: "LOAN", "loan-payments": "LOAN_PAYMENT",
        "debit-cards": "DEBIT_CARD", "credit-cards": "CREDIT_CARD", cards: "CARD",
        beneficiaries: "BENEFICIARY", payments: "PAYMENT",
        "fixed-deposits": "FIXED_DEPOSIT", nominees: "NOMINEE",
        "interest-rates": "INTEREST_RATE", "audit-logs": "AUDIT_LOG"
    };
    const key = match[1].toLowerCase();
    return map[key] || key.toUpperCase().slice(0, 50);
}

function auditOperationFromMethod(method) {
    return method === "POST" ? "CREATE" : method === "DELETE" ? "DELETE" : "UPDATE";
}

async function writeAuditLog(employeeId, operation, module, status = "Success") {
    try {
        await pool.query(
            `INSERT INTO AUDIT_LOG (EmployeeID, Operation, Module, Status) VALUES ($1,$2,$3,$4)`,
            [employeeId, operation, module, status]
        );
    } catch (auditError) {
        console.error("Audit log write failed:", auditError.message);
    }
}

app.use((req, res, next) => {
    const writeMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
    const skipPath = req.path === "/api/login" || req.path.startsWith("/api/audit-logs");

    if (!writeMethod || skipPath) return next();

    const originalJson = res.json.bind(res);
    res.json = (body) => {
        const employeeId = Number(req.user?.employeeid ?? req.user?.EmployeeID ?? req.get("X-Employee-ID"));
        const module = auditModuleFromPath(req.path);
        if (Number.isInteger(employeeId) && employeeId > 0 && module && res.statusCode >= 200 && res.statusCode < 300) {
            void writeAuditLog(employeeId, auditOperationFromMethod(req.method), module, "Success");
        }
        return originalJson(body);
    };

    next();
});

// Friendly navigation aliases used by the shared sidebar.
app.get("/loans", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "loan_management", "code.html")));
app.get("/accounts", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "account_management", "code.html")));
app.get("/transactions", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "transaction_management", "code.html")));
app.get("/cards", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "card_management", "code.html")));
app.get("/interest-rates", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "interest_rate_management", "code.html")));
app.get("/audit-log", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "audit_log_management", "code.html")));

const asyncRoute = (handler) => (req, res) =>
    Promise.resolve(handler(req, res)).catch((error) => {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

function badRequest(res, message) {
    return res.status(400).json({ success: false, message });
}

// ---------- Health ----------
app.get("/api/health", asyncRoute(async (req, res) => {
    const result = await pool.query("SELECT NOW() AS server_time");
    res.json({
        success: true,
        message: "Backend and PostgreSQL are connected!",
        databaseTime: result.rows[0].server_time
    });
}));

// ---------- Login (password-based authentication) ----------
app.post("/api/login", asyncRoute(async (req, res) => {
    const { role, id, password } = req.body;
    if (!role || !id || !password) return badRequest(res, "Role, ID and password are required");

    if (role === "Customer") {
        const result = await pool.query(`
            SELECT
                c.CustomerID, c.Name, c.Email, c.Status,
                uc.PasswordHash, uc.MustChangePassword
            FROM CUSTOMER c
            JOIN USER_CREDENTIAL uc
              ON uc.CustomerID = c.CustomerID
             AND uc.UserType = 'Customer'
            WHERE c.CustomerID = $1
        `, [id]);

        if (!result.rowCount) {
            return res.status(401).json({ success: false, message: "Invalid customer ID or password" });
        }

        const user = result.rows[0];
        if (user.status !== "Active") {
            return res.status(403).json({ success: false, message: "Customer is not active" });
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordhash);
        if (!passwordMatches) {
            return res.status(401).json({ success: false, message: "Invalid customer ID or password" });
        }

        delete user.passwordhash;
        return res.json({
            success: true,
            role,
            user,
            token: createSessionToken(role, user),
            mustChangePassword: user.mustchangepassword
        });
    }

    // All employees use one application-level role: Admin. Their real
    // database job role remains available as user.role/databaseRole.
    if (role === "Admin") {
        const result = await pool.query(`
            SELECT
                e.EmployeeID, e.Name, e.Email, e.Role, e.BranchID, e.Status,
                uc.PasswordHash, uc.MustChangePassword
            FROM EMPLOYEE e
            JOIN USER_CREDENTIAL uc
              ON uc.EmployeeID = e.EmployeeID
             AND uc.UserType = 'Employee'
            WHERE e.EmployeeID = $1
        `, [id]);

        if (!result.rowCount) {
            return res.status(401).json({ success: false, message: "Invalid employee ID or password" });
        }

        const user = result.rows[0];
        if (user.status !== "Active") {
            return res.status(403).json({ success: false, message: "Employee is not active" });
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordhash);
        if (!passwordMatches) {
            return res.status(401).json({ success: false, message: "Invalid employee ID or password" });
        }

        delete user.passwordhash;
        const applicationRole = sessionRoleForEmployee(user.role);
        return res.json({
            success: true,
            role: applicationRole,
            databaseRole: user.role,
            user,
            token: createSessionToken(applicationRole, user),
            mustChangePassword: user.mustchangepassword
        });
    }

    return badRequest(res, "Invalid role. Choose Admin or Customer.");
}));

// ---------- Change password ----------
app.use("/api/change-password", requireSession);
app.post("/api/change-password", asyncRoute(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return badRequest(res, "Current and new password are required");
    if (String(newPassword).length < 8) return badRequest(res, "New password must be at least 8 characters");

    const isCustomer = req.role === "Customer";
    const userId = Number(req.user?.customerid ?? req.user?.CustomerID ?? req.user?.employeeid ?? req.user?.EmployeeID);
    if (!userId) return res.status(403).json({ success: false, message: "Authenticated user identity missing" });

    const result = isCustomer
        ? await pool.query(`SELECT CredentialID, PasswordHash FROM USER_CREDENTIAL WHERE UserType='Customer' AND CustomerID=$1`, [userId])
        : await pool.query(`SELECT CredentialID, PasswordHash FROM USER_CREDENTIAL WHERE UserType='Employee' AND EmployeeID=$1`, [userId]);

    if (!result.rowCount) return res.status(404).json({ success: false, message: "Credential record not found" });

    const matches = await bcrypt.compare(currentPassword, result.rows[0].passwordhash);
    if (!matches) return res.status(401).json({ success: false, message: "Current password is incorrect" });

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query(`
        UPDATE USER_CREDENTIAL
        SET PasswordHash=$1, MustChangePassword=FALSE, UpdatedAt=CURRENT_TIMESTAMP
        WHERE CredentialID=$2
    `, [newHash, result.rows[0].credentialid]);

    res.json({ success: true, message: "Password changed successfully" });
}));

// ---------- Authentication / authorization middleware ----------
// All API routes after login require a signed session token.
app.use("/api", requireSession);
app.use("/api", enforceCustomerScope);

// Staff-only API areas. Customer pages are already routed away in the UI,
// but these checks make the restriction enforceable on the backend too.
app.use("/api/customers", requireStaff);
app.use("/api/branches", requireStaff);
app.use("/api/employees", requireStaff);
app.use("/api/audit-logs", requireStaff);
app.use("/api/interest-rates", requireStaff);
app.use("/api/dashboard", requireStaff);

app.use("/api/loans", (req, res, next) => {
    if (req.method === "PATCH" && !isStaffRole(req.role)) return res.status(403).json({ success:false, message:"Staff access required to change loan status" });
    next();
});
app.use("/api/cards", (req, res, next) => {
    if (["POST", "PATCH"].includes(req.method) && !isStaffRole(req.role)) return res.status(403).json({ success:false, message:"Staff access required to manage cards" });
    next();
});
app.use("/api/fixed-deposits", (req, res, next) => {
    if (req.method === "PATCH" && !isStaffRole(req.role)) return res.status(403).json({ success:false, message:"Staff access required to change fixed deposit status" });
    next();
});
app.use("/api/accounts", (req, res, next) => {
    if (req.method === "POST" && req.path === "/" && !isStaffRole(req.role)) return res.status(403).json({ success:false, message:"Staff access required to create an account" });
    if (req.method === "PATCH" && ["/freeze","/reactivate","/close"].some(x=>req.path.endsWith(x)) && !isStaffRole(req.role)) return res.status(403).json({ success:false, message:"Staff access required for account status management" });
    next();
});

// ---------- Customer-safe Fixed Deposit lookups ----------
// Customers need branch/rate lookup data to create an FD, but they should
// not gain access to staff management endpoints for branches or rates.
app.get("/api/fd-lookups", asyncRoute(async (req, res) => {
    const [branches, rates] = await Promise.all([
        pool.query(`
            SELECT BranchID, BranchName
            FROM BRANCH
            ORDER BY BranchID
        `),
        pool.query(`
            SELECT RateID, RateType, ProductType, Rate
            FROM INTEREST_RATE
            WHERE LOWER(TRIM(ProductType)) = 'fixed deposit'
              AND LOWER(TRIM(RateType)) = 'deposit'
              AND (EffectiveTo IS NULL OR EffectiveTo >= CURRENT_DATE)
            ORDER BY RateID
        `)
    ]);

    res.json({
        success: true,
        branches: branches.rows,
        rates: rates.rows
    });
}));

// ---------- Customer Dashboard ----------
// Safe lookup data for the loan application form. This is available to
// authenticated customers and staff, but it exposes only branch names/IDs and
// active loan rates—not the branch/employee management datasets.
app.get("/api/loan-form-options", asyncRoute(async (req, res) => {
    const [branches, rates] = await Promise.all([
        pool.query(`SELECT BranchID, BranchName FROM BRANCH ORDER BY BranchID`),
        pool.query(`
            SELECT RateID, RateType, ProductType, Rate
            FROM INTEREST_RATE
            WHERE LOWER(TRIM(RateType)) = 'loan'
              AND (EffectiveTo IS NULL OR EffectiveTo >= CURRENT_DATE)
            ORDER BY RateID
        `)
    ]);
    res.json({ success: true, branches: branches.rows, rates: rates.rows });
}));

app.get("/api/customer-dashboard", requireSession, asyncRoute(async (req, res) => {
    if (req.role !== "Customer") {
        return res.status(403).json({ success: false, message: "Customer access required" });
    }

    const customerId = Number(req.user?.customerid ?? req.user?.CustomerID);
    if (!customerId) {
        return res.status(403).json({ success: false, message: "Customer identity missing" });
    }

    const [summary, recent, loans, cards, payments] = await Promise.all([
        pool.query(`
            SELECT
                (SELECT COALESCE(SUM(a.Balance), 0)
                   FROM ACCOUNT a
                   WHERE EXISTS (
                       SELECT 1 FROM ACCOUNT_HOLDER ah
                       WHERE ah.AccountNo = a.AccountNo
                         AND ah.CustomerID = $1
                   )) AS total_balance,
                (SELECT COUNT(DISTINCT a.AccountNo)
                   FROM ACCOUNT a
                   WHERE EXISTS (
                       SELECT 1 FROM ACCOUNT_HOLDER ah
                       WHERE ah.AccountNo = a.AccountNo
                         AND ah.CustomerID = $1
                   )) AS account_count,
                (SELECT COUNT(*)
                   FROM LOAN
                   WHERE CustomerID = $1
                     AND Status IN ('Approved', 'Active')) AS active_loans,
                (SELECT COALESCE(SUM(Principal), 0)
                   FROM LOAN
                   WHERE CustomerID = $1
                     AND Status IN ('Approved', 'Active')) AS loan_principal,
                (
                    SELECT COUNT(*)
                    FROM DEBIT_CARD d
                    WHERE EXISTS (
                        SELECT 1 FROM ACCOUNT_HOLDER ah
                        WHERE ah.AccountNo = d.AccountNo
                          AND ah.CustomerID = $1
                    )
                ) + (
                    SELECT COUNT(*)
                    FROM CREDIT_CARD
                    WHERE CustomerID = $1
                ) AS card_count
        `, [customerId]),
        pool.query(`
            SELECT
                t.TransactionID,
                t.AccountNo,
                t.Type,
                t.Amount,
                t.DateTime,
                t.Mode,
                t.Status
            FROM "TRANSACTION" t
            JOIN ACCOUNT_HOLDER ah
              ON ah.AccountNo = t.AccountNo
            WHERE ah.CustomerID = $1
            ORDER BY t.DateTime DESC, t.TransactionID DESC
            LIMIT 6
        `, [customerId]),
        pool.query(`
            SELECT
                LoanID,
                Type,
                Principal,
                Status,
                Tenure
            FROM LOAN
            WHERE CustomerID = $1
            ORDER BY LoanID DESC
            LIMIT 4
        `, [customerId]),
        pool.query(`
            SELECT
                CardType,
                CardID,
                MaskedCardNo,
                ExpiryDate,
                Status
            FROM (
                SELECT
                    'Debit' AS CardType,
                    d.DebitCardID AS CardID,
                    d.MaskedCardNo,
                    d.ExpiryDate,
                    d.Status
                FROM DEBIT_CARD d
                WHERE EXISTS (
                    SELECT 1 FROM ACCOUNT_HOLDER ah
                    WHERE ah.AccountNo = d.AccountNo
                      AND ah.CustomerID = $1
                )
                UNION ALL
                SELECT
                    'Credit' AS CardType,
                    c.CreditCardID AS CardID,
                    c.MaskedCardNo,
                    c.ExpiryDate,
                    c.Status
                FROM CREDIT_CARD c
                WHERE c.CustomerID = $1
            ) cards
            ORDER BY CardType, CardID
            LIMIT 4
        `, [customerId]),
        pool.query(`
            SELECT
                LoanPaymentID,
                LoanID,
                Amount,
                DueDate,
                Status
            FROM LOAN_PAYMENT
            WHERE LoanID IN (
                SELECT LoanID
                FROM LOAN
                WHERE CustomerID = $1
            )
              AND Status <> 'Paid'
            ORDER BY DueDate, LoanPaymentID
            LIMIT 4
        `, [customerId])
    ]);

    res.json({
        success: true,
        summary: summary.rows[0],
        recentTransactions: recent.rows,
        loans: loans.rows,
        cards: cards.rows,
        upcomingPayments: payments.rows
    });
}));

// ---------- Dashboard ----------
app.get("/api/dashboard", asyncRoute(async (req, res) => {
    const [summary, monthly, branch, loans, recent] = await Promise.all([
        pool.query(`
            SELECT
                (SELECT COUNT(*) FROM CUSTOMER) AS customers,
                (SELECT COUNT(*) FROM ACCOUNT) AS accounts,
                (SELECT COUNT(*) FROM ACCOUNT WHERE Status = 'Active') AS active_accounts,
                (SELECT COALESCE(SUM(Balance),0) FROM ACCOUNT) AS total_deposits,
                (SELECT COUNT(*) FROM LOAN WHERE Status IN ('Approved','Active')) AS active_loans,
                (SELECT COALESCE(SUM(Principal),0) FROM LOAN WHERE Status IN ('Approved','Active')) AS total_loan_principal,
                (SELECT COUNT(*) FROM "TRANSACTION") AS transactions,
                (SELECT COALESCE(SUM(Amount),0) FROM "TRANSACTION" WHERE Type IN ('Deposit','Transfer In')) AS inflow,
                (SELECT COALESCE(SUM(Amount),0) FROM "TRANSACTION" WHERE Type IN ('Withdrawal','Transfer Out')) AS outflow
        `),
        pool.query(`
            SELECT TO_CHAR(DATE_TRUNC('month', DateTime), 'YYYY-MM') AS month,
                   COUNT(*)::INTEGER AS transaction_count,
                   COALESCE(SUM(Amount),0) AS total_amount
            FROM "TRANSACTION"
            GROUP BY DATE_TRUNC('month', DateTime)
            ORDER BY DATE_TRUNC('month', DateTime)
        `),
        pool.query(`SELECT BranchID, BranchName, TotalAccounts, TotalCustomers, TotalDeposits FROM v_branch_performance ORDER BY BranchID`),
        pool.query(`SELECT Type, COUNT(*)::INTEGER AS loan_count, COALESCE(SUM(Principal),0) AS total_principal FROM LOAN GROUP BY Type ORDER BY Type`),
        pool.query(`
            SELECT t.TransactionID, t.AccountNo, c.CustomerName, b.BranchName,
                   t.Type, t.Amount, t.DateTime, t.Mode, t.Status
            FROM "TRANSACTION" t
            LEFT JOIN v_transaction_history c ON c.TransactionID = t.TransactionID
            JOIN ACCOUNT a ON a.AccountNo = t.AccountNo
            JOIN BRANCH b ON b.BranchID = a.BranchID
            ORDER BY t.DateTime DESC, t.TransactionID DESC
            LIMIT 10
        `)
    ]);

    res.json({
        success: true,
        summary: summary.rows[0],
        monthlyTransactions: monthly.rows,
        branchDeposits: branch.rows,
        loanDistribution: loans.rows,
        recentTransactions: recent.rows
    });
}));

// ---------- Audit Logs ----------
app.get("/api/audit-logs", asyncRoute(async (req, res) => {
    const { search = "", employeeId = "", module = "", status = "", from = "", to = "" } = req.query;
    const params = [];
    const filters = [];

    const add = (value, clause) => {
        params.push(value);
        filters.push(clause.replace("?", `$${params.length}`));
    };

    if (String(search).trim()) {
        const q = `%${String(search).trim()}%`;
        params.push(q);
        const p = `$${params.length}`;
        filters.push(`(
            CAST(a.AuditID AS TEXT) ILIKE ${p} OR
            CAST(a.EmployeeID AS TEXT) ILIKE ${p} OR
            e.Name ILIKE ${p} OR
            a.Operation ILIKE ${p} OR
            a.Module ILIKE ${p} OR
            a.Status ILIKE ${p}
        )`);
    }

    if (employeeId) add(Number(employeeId), "a.EmployeeID = ?");
    if (module) add(module, "a.Module = ?");
    if (status) add(status, "a.Status = ?");
    if (from) add(from, "a.DateTime >= ?::date");
    if (to) add(to, "a.DateTime < (?::date + INTERVAL '1 day')");

    let sql = `
        SELECT
            a.AuditID,
            a.EmployeeID,
            e.Name AS EmployeeName,
            e.Role AS EmployeeRole,
            a.Operation,
            a.Module,
            a.DateTime,
            a.Status
        FROM AUDIT_LOG a
        JOIN EMPLOYEE e ON e.EmployeeID = a.EmployeeID
    `;

    if (filters.length) sql += ` WHERE ${filters.join(" AND ")}`;
    sql += " ORDER BY a.DateTime DESC, a.AuditID DESC";

    const result = await pool.query(sql, params);
    res.json({ success: true, data: result.rows, count: result.rowCount });
}));

// ---------- Customers ----------
app.get("/api/customers", asyncRoute(async (req, res) => {
    const search = String(req.query.search || "").trim();
    const params = [];
    const filters = [];

    if (search) {
        params.push(`%${search}%`);
        filters.push(`(
            CAST(c.CustomerID AS TEXT) ILIKE $1 OR
            c.Name ILIKE $1 OR
            c.Phone ILIKE $1 OR
            COALESCE(c.Email,'') ILIKE $1
        )`);
    }

    const result = await pool.query(`
        SELECT c.CustomerID, c.Name, c.DOB, c.Gender, c.Phone, c.Email,
               c.Address, c.KYCStatus, c.Status,
               COALESCE(STRING_AGG(DISTINCT a.AccountType, ', ' ORDER BY a.AccountType), 'No Account') AS AccountTypes,
               COALESCE(SUM(a.Balance),0) AS BalanceTotal,
               COUNT(DISTINCT a.AccountNo)::INTEGER AS AccountCount
        FROM CUSTOMER c
        LEFT JOIN ACCOUNT_HOLDER ah ON c.CustomerID = ah.CustomerID
        LEFT JOIN ACCOUNT a ON ah.AccountNo = a.AccountNo
        ${filters.length ? "WHERE " + filters.join(" AND ") : ""}
        GROUP BY c.CustomerID
        ORDER BY c.CustomerID
    `, params);

    res.json({ success: true, data: result.rows });
}));

app.post("/api/customers", asyncRoute(async (req, res) => {
    const { customerId, name, dob, gender, phone, email, address, kycStatus, status } = req.body;
    if (!name || !dob || !gender || !phone || !address) return badRequest(res, "Name, DOB, gender, phone and address are required");

    const result = await pool.query(`
        INSERT INTO CUSTOMER (CustomerID, Name, DOB, Gender, Phone, Email, Address, KYCStatus, Status)
        VALUES (COALESCE($1, (SELECT COALESCE(MAX(CustomerID),1000)+1 FROM CUSTOMER)), $2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
    `, [customerId || null, name, dob, gender, phone, email || null, address, kycStatus || "Pending", status || "Active"]);
    res.status(201).json({ success: true, message: "Customer created", data: result.rows[0] });
}));

app.put("/api/customers/:id", asyncRoute(async (req, res) => {
    const { name, dob, gender, phone, email, address, kycStatus, status } = req.body;
    const result = await pool.query(`
        UPDATE CUSTOMER SET Name=$1, DOB=$2, Gender=$3, Phone=$4, Email=$5,
               Address=$6, KYCStatus=$7, Status=$8
        WHERE CustomerID=$9 RETURNING *
    `, [name, dob, gender, phone, email || null, address, kycStatus, status, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Customer not found" });
    res.json({ success: true, message: "Customer updated", data: result.rows[0] });
}));

app.delete("/api/customers/:id", asyncRoute(async (req, res) => {
    const result = await pool.query(`DELETE FROM CUSTOMER WHERE CustomerID=$1 RETURNING CustomerID`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Customer not found" });
    res.json({ success: true, message: "Customer deleted" });
}));

// ---------- Branches ----------
app.get("/api/branches", asyncRoute(async (req, res) => {
    const search = String(req.query.search || "").trim();
    const params = search ? [`%${search}%`] : [];
    const result = await pool.query(`
        SELECT b.BranchID, b.BranchCode, b.BranchName, b.IFSC, b.Address, b.Phone,
               COALESCE(v.TotalAccounts,0) AS TotalAccounts,
               COALESCE(v.TotalCustomers,0) AS TotalCustomers,
               COALESCE(v.TotalDeposits,0) AS TotalDeposits,
               COALESCE((SELECT STRING_AGG(e.Name, ', ') FROM EMPLOYEE e WHERE e.BranchID=b.BranchID AND e.Role ILIKE '%Manager%'), 'Not assigned') AS Manager,
               'Active' AS DisplayStatus
        FROM BRANCH b
        LEFT JOIN v_branch_performance v ON b.BranchID=v.BranchID
        ${search ? "WHERE b.BranchCode ILIKE $1 OR b.BranchName ILIKE $1 OR b.Address ILIKE $1" : ""}
        ORDER BY b.BranchID
    `, params);
    res.json({ success: true, data: result.rows });
}));

app.post("/api/branches", asyncRoute(async (req, res) => {
    const { branchId, branchCode, branchName, ifsc, address, phone } = req.body;
    if (!branchCode || !branchName || !ifsc || !address || !phone) return badRequest(res, "All branch fields are required");
    const result = await pool.query(`
        INSERT INTO BRANCH (BranchID,BranchCode,BranchName,IFSC,Address,Phone)
        VALUES (COALESCE($1,(SELECT COALESCE(MAX(BranchID),0)+1 FROM BRANCH)),$2,$3,$4,$5,$6)
        RETURNING *
    `, [branchId || null, branchCode, branchName, ifsc, address, phone]);
    res.status(201).json({ success: true, message: "Branch created", data: result.rows[0] });
}));

app.put("/api/branches/:id", asyncRoute(async (req, res) => {
    const { branchCode, branchName, ifsc, address, phone } = req.body;
    const result = await pool.query(`
        UPDATE BRANCH SET BranchCode=$1,BranchName=$2,IFSC=$3,Address=$4,Phone=$5
        WHERE BranchID=$6 RETURNING *
    `, [branchCode, branchName, ifsc, address, phone, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ success:false, message:"Branch not found" });
    res.json({ success:true, message:"Branch updated", data:result.rows[0] });
}));

app.delete("/api/branches/:id", asyncRoute(async (req,res)=>{
    const result = await pool.query(`DELETE FROM BRANCH WHERE BranchID=$1 RETURNING BranchID`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ success:false, message:"Branch not found" });
    res.json({ success:true, message:"Branch deleted" });
}));

// ---------- Employees ----------
app.get("/api/employees", asyncRoute(async (req,res)=>{
    const search = String(req.query.search || "").trim();
    const params = search ? [`%${search}%`] : [];
    const result = await pool.query(`
        SELECT e.EmployeeID,e.BranchID,b.BranchName,e.Name,e.Email,e.Role,e.HireDate,e.Status
        FROM EMPLOYEE e JOIN BRANCH b ON e.BranchID=b.BranchID
        ${search ? "WHERE CAST(e.EmployeeID AS TEXT) ILIKE $1 OR e.Name ILIKE $1 OR e.Email ILIKE $1 OR e.Role ILIKE $1 OR b.BranchName ILIKE $1" : ""}
        ORDER BY e.EmployeeID
    `, params);
    res.json({ success:true, data:result.rows });
}));

app.post("/api/employees", asyncRoute(async(req,res)=>{
    const { employeeId, branchId, name, email, role, hireDate, status } = req.body;
    if (!branchId || !name || !email || !role || !hireDate) return badRequest(res,"Branch, name, email, role and hire date are required");
    const result = await pool.query(`
        INSERT INTO EMPLOYEE (EmployeeID,BranchID,Name,Email,Role,HireDate,Status)
        VALUES (COALESCE($1,(SELECT COALESCE(MAX(EmployeeID),100)+1 FROM EMPLOYEE)),$2,$3,$4,$5,$6,$7)
        RETURNING *
    `,[employeeId||null,branchId,name,email,role,hireDate,status||"Active"]);
    res.status(201).json({success:true,message:"Employee created",data:result.rows[0]});
}));

app.put("/api/employees/:id", asyncRoute(async(req,res)=>{
    const { branchId,name,email,role,hireDate,status }=req.body;
    const result=await pool.query(`
        UPDATE EMPLOYEE SET BranchID=$1,Name=$2,Email=$3,Role=$4,HireDate=$5,Status=$6
        WHERE EmployeeID=$7 RETURNING *
    `,[branchId,name,email,role,hireDate,status,req.params.id]);
    if(!result.rowCount) return res.status(404).json({success:false,message:"Employee not found"});
    res.json({success:true,message:"Employee updated",data:result.rows[0]});
}));

app.delete("/api/employees/:id", asyncRoute(async(req,res)=>{
    const result=await pool.query(`DELETE FROM EMPLOYEE WHERE EmployeeID=$1 RETURNING EmployeeID`, [req.params.id]);
    if(!result.rowCount) return res.status(404).json({success:false,message:"Employee not found"});
    res.json({success:true,message:"Employee deleted",data:result.rows[0]});
}));

// ---------- Accounts ----------
app.get("/api/accounts", asyncRoute(async(req,res)=>{
    const search=String(req.query.search||"").trim();
    const customerId=String(req.query.customerId||"").trim();
    const params=[];
    const filters=[];

    if(customerId){
        params.push(customerId);
        filters.push(`EXISTS (SELECT 1 FROM ACCOUNT_HOLDER ahc WHERE ahc.AccountNo=a.AccountNo AND ahc.CustomerID=$${params.length})`);
    }

    if(search){
        params.push(`%${search}%`);
        filters.push(`(CAST(a.AccountNo AS TEXT) ILIKE $${params.length} OR a.AccountType ILIKE $${params.length} OR a.Status ILIKE $${params.length} OR b.BranchName ILIKE $${params.length})`);
    }

    const result=await pool.query(`
        SELECT a.AccountNo,a.BranchID,b.BranchName,a.AccountType,a.OpenDate,a.Balance,a.Status,
               COALESCE(STRING_AGG(c.Name || ' (' || ah.HolderType || ')', ', ' ORDER BY c.Name),'No holder') AS Holders,
               COUNT(DISTINCT ah.CustomerID)::INTEGER AS HolderCount
        FROM ACCOUNT a JOIN BRANCH b ON a.BranchID=b.BranchID
        LEFT JOIN ACCOUNT_HOLDER ah ON a.AccountNo=ah.AccountNo
        LEFT JOIN CUSTOMER c ON ah.CustomerID=c.CustomerID
        ${filters.length ? 'WHERE ' + filters.join(' AND ') : ''}
        GROUP BY a.AccountNo,b.BranchName
        ORDER BY a.AccountNo
    `,params);
    res.json({success:true,data:result.rows});
}));

app.post("/api/accounts", asyncRoute(async(req,res)=>{
    const { accountNo,branchId,accountType,openDate,balance,status,customerId,holderType }=req.body;
    if(!branchId||!accountType||!openDate) return badRequest(res,"Branch, account type and open date are required");
    const client=await pool.connect();
    try{
        await client.query("BEGIN");
        await client.query(`
            INSERT INTO ACCOUNT(AccountNo,BranchID,AccountType,OpenDate,Balance,Status)
            VALUES(COALESCE($1,(SELECT COALESCE(MAX(AccountNo),10000000)+1 FROM ACCOUNT)),$2,$3,$4,$5,$6)
        `,[accountNo||null,branchId,accountType,openDate,Number(balance||0),status||"Active"]);
        const accountNoResult=await client.query(`SELECT MAX(AccountNo) AS accountno FROM ACCOUNT`);
        const createdNo=accountNo||accountNoResult.rows[0].accountno;
        if(customerId){
            await client.query(`INSERT INTO ACCOUNT_HOLDER(AccountNo,CustomerID,HolderType) VALUES($1,$2,$3)`,[createdNo,customerId,holderType||"Primary"]);
        }
        await client.query("COMMIT");
        const result=await pool.query(`SELECT * FROM ACCOUNT WHERE AccountNo=$1`,[createdNo]);
        res.status(201).json({success:true,message:"Account created",data:result.rows[0]});
    }catch(error){
        await client.query("ROLLBACK");
        throw error;
    }finally{client.release();}
}));

app.post("/api/accounts/:accountNo/deposit", asyncRoute(async (req, res) => {
    const accountNo = Number(req.params.accountNo);
    const amount = Number(req.body.amount);
    const mode = String(req.body.mode || "Online").trim();
    const sessionCustomerId = req.role === "Customer"
        ? Number(req.user?.customerid ?? req.user?.CustomerID)
        : null;

    if (!Number.isInteger(accountNo) || accountNo <= 0) return badRequest(res, "Invalid account selected.");
    if (!Number.isFinite(amount) || amount <= 0) return badRequest(res, "Deposit amount must be greater than zero.");
    if (req.role !== "Customer" && !isStaffRole(req.role)) return res.status(403).json({ success: false, message: "Access denied." });

    if (req.role === "Customer") {
        if (!Number.isInteger(sessionCustomerId) || sessionCustomerId <= 0) return res.status(403).json({ success: false, message: "Customer session is missing. Please sign in again." });
        const ownership = await pool.query(
            `SELECT 1 FROM ACCOUNT_HOLDER WHERE AccountNo=$1 AND CustomerID=$2 LIMIT 1`,
            [accountNo, sessionCustomerId]
        );
        if (!ownership.rowCount) return res.status(403).json({ success: false, message: "You can only deposit into an account you hold." });
    }

    await pool.query(`CALL sp_deposit($1,$2,$3)`, [accountNo, amount, mode]);
    const result = await pool.query(`SELECT AccountNo, Balance, Status FROM ACCOUNT WHERE AccountNo=$1`, [accountNo]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Account not found." });
    res.json({ success: true, message: "Deposit successful", account: result.rows[0] });
}));

app.post("/api/accounts/:accountNo/withdraw", asyncRoute(async (req, res) => {
    const accountNo = Number(req.params.accountNo);
    const amount = Number(req.body.amount);
    const mode = String(req.body.mode || "Online").trim();
    const sessionCustomerId = req.role === "Customer"
        ? Number(req.user?.customerid ?? req.user?.CustomerID)
        : null;

    if (!Number.isInteger(accountNo) || accountNo <= 0) return badRequest(res, "Invalid account selected.");
    if (!Number.isFinite(amount) || amount <= 0) return badRequest(res, "Withdrawal amount must be greater than zero.");
    if (req.role !== "Customer" && !isStaffRole(req.role)) return res.status(403).json({ success: false, message: "Access denied." });

    // For customers, scope by the identity inside the signed session. Do not rely
    // on a customerId sent by the browser, and do not ask the customer to re-enter
    // an account number—the row-specific URL selects the account.
    if (req.role === "Customer") {
        if (!Number.isInteger(sessionCustomerId) || sessionCustomerId <= 0) return res.status(403).json({ success: false, message: "Customer session is missing. Please sign in again." });
        const ownership = await pool.query(
            `SELECT 1 FROM ACCOUNT_HOLDER WHERE AccountNo=$1 AND CustomerID=$2 LIMIT 1`,
            [accountNo, sessionCustomerId]
        );
        if (!ownership.rowCount) return res.status(403).json({ success: false, message: "You can only withdraw from an account you hold." });
    }

    await pool.query(`CALL sp_withdraw($1,$2,$3)`, [accountNo, amount, mode]);
    const result = await pool.query(`SELECT AccountNo, Balance, Status FROM ACCOUNT WHERE AccountNo=$1`, [accountNo]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Account not found." });
    res.json({ success: true, message: "Withdrawal successful", account: result.rows[0] });
}));

app.post("/api/transfers", asyncRoute(async (req, res) => {
    const fromAccount = Number(req.body.fromAccount);
    const toAccount = Number(req.body.toAccount);
    const amount = Number(req.body.amount);
    const mode = String(req.body.mode || "Online").trim().toUpperCase();
    const sessionCustomerId = req.role === "Customer"
        ? Number(req.user?.customerid ?? req.user?.CustomerID)
        : null;
    const customerId = sessionCustomerId || (req.body.customerId ? Number(req.body.customerId) : null);
    const allowedModes = ["IMPS", "NEFT", "RTGS", "ONLINE", "UPI", "CASH"];

    if (!Number.isInteger(fromAccount) || fromAccount <= 0 || !Number.isInteger(toAccount) || toAccount <= 0) {
        return badRequest(res, "Choose a valid source account and beneficiary account.");
    }
    if (!Number.isFinite(amount) || amount <= 0) return badRequest(res, "Transfer amount must be greater than zero.");
    if (!allowedModes.includes(mode)) return badRequest(res, "Choose a supported transfer mode.");
    if (req.role === "Customer" && (!Number.isInteger(sessionCustomerId) || sessionCustomerId <= 0)) {
        return res.status(403).json({ success: false, message: "Customer session is missing. Please sign in again." });
    }
    if (fromAccount === toAccount) return badRequest(res, "Source and destination accounts must be different.");

    const client = await pool.connect();
    let transactionStarted = false;
    try {
        await client.query("BEGIN");
        transactionStarted = true;

        const sourceResult = await client.query(
            `SELECT AccountNo, Status, Balance FROM ACCOUNT WHERE AccountNo=$1 FOR UPDATE`,
            [fromAccount]
        );
        if (!sourceResult.rowCount) throw Object.assign(new Error("The selected source account was not found."), { statusCode: 404 });
        if (sourceResult.rows[0].status !== "Active") throw Object.assign(new Error("The source account is not active."), { statusCode: 400 });

        let beneficiary = null;
        if (req.role === "Customer") {
            const ownership = await client.query(
                `SELECT 1 FROM ACCOUNT_HOLDER WHERE AccountNo=$1 AND CustomerID=$2 LIMIT 1`,
                [fromAccount, sessionCustomerId]
            );
            if (!ownership.rowCount) throw Object.assign(new Error("You can only transfer from an account you hold."), { statusCode: 403 });

            const beneficiaryResult = await client.query(
                `SELECT BeneficiaryID, BeneficiaryAccountNo, Name, Status
                 FROM BENEFICIARY
                 WHERE CustomerID=$1 AND BeneficiaryAccountNo=$2 AND Status='Active'
                 LIMIT 1 FOR SHARE`,
                [sessionCustomerId, toAccount]
            );
            if (!beneficiaryResult.rowCount) {
                throw Object.assign(new Error("Choose one of your active beneficiaries before transferring."), { statusCode: 403 });
            }
            beneficiary = beneficiaryResult.rows[0];
        } else if (customerId) {
            const beneficiaryResult = await client.query(
                `SELECT BeneficiaryID, BeneficiaryAccountNo, Name, Status
                 FROM BENEFICIARY
                 WHERE CustomerID=$1 AND BeneficiaryAccountNo=$2 AND Status='Active'
                 LIMIT 1 FOR SHARE`,
                [customerId, toAccount]
            );
            if (beneficiaryResult.rowCount) beneficiary = beneficiaryResult.rows[0];
        }

        // The destination may be an internal account (update both bank accounts),
        // or an external beneficiary account (debit the source and write a PAYMENT
        // instruction). Never pass an unknown destination to sp_transfer_funds:
        // TRANSACTION.AccountNo has a foreign key to ACCOUNT.AccountNo.
        const destinationResult = await client.query(
            `SELECT AccountNo, Status FROM ACCOUNT WHERE AccountNo=$1`,
            [toAccount]
        );
        let externalDestination = !destinationResult.rowCount;

        if (!externalDestination) {
            if (destinationResult.rows[0].status !== "Active") {
                throw Object.assign(new Error("The destination account is not active."), { statusCode: 400 });
            }
            await client.query(`CALL sp_transfer_funds($1,$2,$3,$4)`, [fromAccount, toAccount, amount, mode]);
        } else {
            if (!customerId || !beneficiary) {
                throw Object.assign(new Error("That destination is not an internal account or a registered beneficiary."), { statusCode: 400 });
            }
            // External beneficiary account numbers do not exist in ACCOUNT, so the
            // transfer procedure cannot create a destination TRANSACTION row for them.
            // Debit the source and create a PAYMENT row tied to the registered beneficiary.
            await client.query(`CALL sp_withdraw($1,$2,$3)`, [fromAccount, amount, mode]);
        }

        if (customerId && beneficiary) {
            // Serialize MAX(ID)+1 allocation for the existing PAYMENT schema, which
            // does not expose an identity default in this project database.
            await client.query("SELECT pg_advisory_xact_lock($1)", [727304]);
            await client.query(`
                INSERT INTO PAYMENT(PaymentID, CustomerID, BeneficiaryID, Type, Amount, DateTime, Status)
                VALUES ((SELECT COALESCE(MAX(PaymentID),400000)+1 FROM PAYMENT), $1, $2, 'Fund Transfer', $3, CURRENT_TIMESTAMP, 'Success')
            `, [customerId, beneficiary.beneficiaryid, amount]);
        }

        const accountResult = externalDestination
            ? await client.query(`SELECT AccountNo, Balance, Status FROM ACCOUNT WHERE AccountNo=$1`, [fromAccount])
            : await client.query(`SELECT AccountNo, Balance, Status FROM ACCOUNT WHERE AccountNo IN ($1,$2) ORDER BY AccountNo`, [fromAccount, toAccount]);

        await client.query("COMMIT");
        transactionStarted = false;
        res.status(201).json({
            success: true,
            external: externalDestination,
            message: externalDestination
                ? "External transfer recorded. The source account was debited and the beneficiary payment is in your Payments history."
                : "Transfer completed successfully.",
            accounts: accountResult.rows
        });
    } catch (error) {
        if (transactionStarted) {
            try { await client.query("ROLLBACK"); } catch (_) { }
        }
        res.status(error.statusCode || 400).json({ success: false, message: error.message || "Transfer could not be completed." });
    } finally {
        client.release();
    }
}));

app.patch("/api/accounts/:accountNo/freeze", asyncRoute(async(req,res)=>{
    await pool.query(`CALL sp_freeze_account($1)`,[req.params.accountNo]);
    res.json({success:true,message:"Account frozen"});
}));
app.patch("/api/accounts/:accountNo/reactivate", asyncRoute(async(req,res)=>{
    await pool.query(`CALL sp_reactivate_account($1)`,[req.params.accountNo]);
    res.json({success:true,message:"Account reactivated"});
}));
app.patch("/api/accounts/:accountNo/close", asyncRoute(async(req,res)=>{
    await pool.query(`CALL sp_close_account($1)`,[req.params.accountNo]);
    res.json({success:true,message:"Account closed"});
}));

// ---------- Transactions ----------
app.get("/api/transactions", asyncRoute(async(req,res)=>{
    const {accountNo,from,to,search}=req.query;
    const customerId=String(req.query.customerId||"").trim();
    const params=[]; const filters=[];
    if(accountNo){params.push(accountNo);filters.push(`t.AccountNo=$${params.length}`);}
    if(customerId){
        params.push(customerId);
        filters.push(`EXISTS (SELECT 1 FROM ACCOUNT_HOLDER ahc WHERE ahc.AccountNo=t.AccountNo AND ahc.CustomerID=$${params.length})`);
    }
    if(from){params.push(from);filters.push(`t.DateTime >= $${params.length}`);}
    if(to){params.push(to);filters.push(`t.DateTime <= $${params.length}`);}
    if(search){params.push(`%${search}%`);filters.push(`(CAST(t.TransactionID AS TEXT) ILIKE $${params.length} OR CAST(t.AccountNo AS TEXT) ILIKE $${params.length} OR t.Type ILIKE $${params.length} OR t.Mode ILIKE $${params.length} OR t.Status ILIKE $${params.length})`);}
    const result=await pool.query(`
        SELECT t.TransactionID,t.AccountNo,c.CustomerName,b.BranchName,t.Type,t.Amount,t.DateTime,t.Mode,t.Status
        FROM "TRANSACTION" t
        LEFT JOIN v_transaction_history c ON c.TransactionID=t.TransactionID
        JOIN ACCOUNT a ON a.AccountNo=t.AccountNo
        JOIN BRANCH b ON b.BranchID=a.BranchID
        ${filters.length?"WHERE "+filters.join(" AND "):""}
        ORDER BY t.DateTime DESC,t.TransactionID DESC
    `,params);
    res.json({success:true,data:result.rows});
}));

// ---------- Beneficiaries ----------
app.get("/api/beneficiaries", asyncRoute(async(req,res)=>{
    const customerId=req.query.customerId;
    const params=customerId?[customerId]:[];
    const result=await pool.query(`
        SELECT BeneficiaryID,CustomerID,Name,BeneficiaryAccountNo,IFSC,Status
        FROM BENEFICIARY
        ${customerId?"WHERE CustomerID=$1":""}
        ORDER BY BeneficiaryID
    `,params);
    res.json({success:true,data:result.rows});
}));

app.post("/api/beneficiaries", asyncRoute(async(req,res)=>{
    const { customerId, name, beneficiaryAccountNo, ifsc, status } = req.body;
    if(!customerId || !name || !beneficiaryAccountNo || !ifsc){
        return badRequest(res,"Customer, beneficiary name, account number and IFSC are required");
    }

    const customer=await pool.query(`
        SELECT CustomerID, Status FROM CUSTOMER WHERE CustomerID=$1
    `,[customerId]);
    if(!customer.rowCount) return res.status(404).json({success:false,message:"Customer not found"});
    if(customer.rows[0].status !== "Active") return res.status(403).json({success:false,message:"Customer is not active"});

    const account=await pool.query(`
        SELECT AccountNo, Status FROM ACCOUNT WHERE AccountNo=$1
    `,[beneficiaryAccountNo]);
    if(!account.rowCount) return res.status(400).json({success:false,message:"Beneficiary account does not exist"});

    const result=await pool.query(`
        INSERT INTO BENEFICIARY(CustomerID,Name,BeneficiaryAccountNo,IFSC,Status)
        VALUES($1,$2,$3,$4,$5)
        RETURNING BeneficiaryID,CustomerID,Name,BeneficiaryAccountNo,IFSC,Status
    `,[customerId,name,beneficiaryAccountNo,ifsc,status || "Active"]);

    res.status(201).json({success:true,message:"Beneficiary added",data:result.rows[0]});
}));

app.put("/api/beneficiaries/:id", asyncRoute(async(req,res)=>{
    const { customerId, name, beneficiaryAccountNo, ifsc, status } = req.body;
    if(!customerId || !name || !beneficiaryAccountNo || !ifsc){
        return badRequest(res,"Customer, beneficiary name, account number and IFSC are required");
    }

    const result=await pool.query(`
        UPDATE BENEFICIARY
        SET Name=$1, BeneficiaryAccountNo=$2, IFSC=$3, Status=$4
        WHERE BeneficiaryID=$5 AND CustomerID=$6
        RETURNING BeneficiaryID,CustomerID,Name,BeneficiaryAccountNo,IFSC,Status
    `,[name,beneficiaryAccountNo,ifsc,status || "Active",req.params.id,customerId]);

    if(!result.rowCount) return res.status(404).json({success:false,message:"Beneficiary not found for this customer"});
    res.json({success:true,message:"Beneficiary updated",data:result.rows[0]});
}));

app.patch("/api/beneficiaries/:id/status", asyncRoute(async(req,res)=>{
    const { customerId, status } = req.body;
    const allowedStatuses=["Active","Blocked","Pending"];
    if(!customerId || !status) return badRequest(res,"Customer ID and status are required");
    if(!allowedStatuses.includes(status)) return badRequest(res,`Invalid beneficiary status. Use: ${allowedStatuses.join(", ")}`);

    const result=await pool.query(`
        UPDATE BENEFICIARY
        SET Status=$1
        WHERE BeneficiaryID=$2 AND CustomerID=$3
        RETURNING BeneficiaryID,CustomerID,Name,BeneficiaryAccountNo,IFSC,Status
    `,[status,req.params.id,customerId]);

    if(!result.rowCount) return res.status(404).json({success:false,message:"Beneficiary not found for this customer"});
    res.json({success:true,message:`Beneficiary ${String(status).toLowerCase()}`,data:result.rows[0]});
}));

app.delete("/api/beneficiaries/:id", asyncRoute(async(req,res)=>{
    const customerId=req.query.customerId;
    if(!customerId) return badRequest(res,"Customer ID is required");

    try{
        const result=await pool.query(`
            DELETE FROM BENEFICIARY
            WHERE BeneficiaryID=$1 AND CustomerID=$2
            RETURNING BeneficiaryID
        `,[req.params.id,customerId]);

        if(!result.rowCount) return res.status(404).json({success:false,message:"Beneficiary not found for this customer"});
        res.json({success:true,message:"Beneficiary deleted"});
    }catch(error){
        return res.status(400).json({success:false,message:"Beneficiary cannot be deleted because related payment records exist. Deactivate it instead."});
    }
}));

// ---------- Loans ----------
app.get("/api/loans", asyncRoute(async(req,res)=>{
    const customerId=req.query.customerId;
    const params=customerId ? [customerId] : [];
    const where=customerId ? "WHERE CustomerID=$1" : "";
    const result=await pool.query(`
        SELECT LoanID,CustomerID,CustomerName,BranchName,Type,Principal,Rate,Tenure,Status
        FROM v_loan_summary
        ${where}
        ORDER BY LoanID
    `, params);
    res.json({success:true,data:result.rows});
}));

app.post("/api/loans", asyncRoute(async(req,res)=>{
    const {loanId,customerId,branchId,rateId,type,principal,tenure,status}=req.body;
    if(!customerId||!branchId||!rateId||!type||!principal||!tenure) return badRequest(res,"Customer, branch, rate, type, principal and tenure are required");

    // If a customer ID is supplied by the frontend, verify that the customer exists.
    const customer=await pool.query(`SELECT CustomerID,Status FROM CUSTOMER WHERE CustomerID=$1`,[customerId]);
    if(!customer.rowCount) return badRequest(res,"Customer not found");
    if(customer.rows[0].status !== 'Active') return badRequest(res,"Customer is not active");

    // Verify the branch and interest-rate records referenced by the loan.
    const branch=await pool.query(`SELECT BranchID FROM BRANCH WHERE BranchID=$1`,[branchId]);
    if(!branch.rowCount) return badRequest(res,"Branch not found");
    const rate=await pool.query(`SELECT RateID FROM INTEREST_RATE WHERE RateID=$1`,[rateId]);
    if(!rate.rowCount) return badRequest(res,"Interest rate not found");

    const result=await pool.query(`
        INSERT INTO LOAN(LoanID,CustomerID,BranchID,RateID,Type,Principal,Tenure,Status)
        VALUES(COALESCE($1,(SELECT COALESCE(MAX(LoanID),7000)+1 FROM LOAN)),$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
    `,[loanId||null,customerId,branchId,rateId,type,principal,tenure,status||"Applied"]);
    res.status(201).json({success:true,message:"Loan application submitted",data:result.rows[0]});
}));

app.patch("/api/loans/:id/status", asyncRoute(async(req,res)=>{
    const allowed=["Applied","Approved","Rejected","Active","Closed","Defaulted"];
    if(!allowed.includes(req.body.status)) return badRequest(res,"Invalid loan status");
    const result=await pool.query(`UPDATE LOAN SET Status=$1 WHERE LoanID=$2 RETURNING *`,[req.body.status,req.params.id]);
    if(!result.rowCount) return res.status(404).json({success:false,message:"Loan not found"});
    res.json({success:true,message:"Loan status updated",data:result.rows[0]});
}));

app.get("/api/loan-payments", asyncRoute(async(req,res)=>{
    const customerId=req.query.customerId;
    const params=customerId ? [customerId] : [];
    const where=customerId ? "WHERE l.CustomerID=$1" : "";
    const result=await pool.query(`
        SELECT lp.LoanPaymentID, lp.LoanID, l.CustomerID, c.Name AS CustomerName,
               lp.Amount, lp.DueDate, lp.PaidDate, lp.Status
        FROM LOAN_PAYMENT lp
        JOIN LOAN l ON l.LoanID = lp.LoanID
        JOIN CUSTOMER c ON c.CustomerID = l.CustomerID
        ${where}
        ORDER BY lp.DueDate, lp.LoanPaymentID
    `,params);
    res.json({success:true,data:result.rows});
}));

app.get("/api/loans/:id/emi", asyncRoute(async(req,res)=>{
    const customerId=req.query.customerId;
    const params=[req.params.id];
    const ownership = customerId ? " AND l.CustomerID=$2" : "";
    if(customerId) params.push(customerId);
    const result=await pool.query(`
        SELECT l.LoanID, l.CustomerID, l.Principal, l.Tenure, ir.Rate,
               fn_loan_emi(l.Principal, ir.Rate, l.Tenure) AS EMI
        FROM LOAN l
        JOIN INTEREST_RATE ir ON ir.RateID = l.RateID
        WHERE l.LoanID=$1 ${ownership}
    `,params);
    if(!result.rowCount) return res.status(404).json({success:false,message:"Loan not found or not accessible"});
    res.json({success:true,data:result.rows[0]});
}));

app.post("/api/loan-payments/generate", asyncRoute(async(req,res)=>{
    const {loanId,customerId}=req.body;
    if(!loanId) return badRequest(res,"Loan ID is required");

    const params=[loanId];
    const ownership = customerId ? " AND l.CustomerID=$2" : "";
    if(customerId) params.push(customerId);

    const loan=await pool.query(`
        SELECT l.LoanID, l.CustomerID, l.Status, l.Principal, l.Tenure, ir.Rate,
               fn_loan_emi(l.Principal, ir.Rate, l.Tenure) AS EMI
        FROM LOAN l
        JOIN INTEREST_RATE ir ON ir.RateID=l.RateID
        WHERE l.LoanID=$1 ${ownership}
    `,params);

    if(!loan.rowCount) return res.status(404).json({success:false,message:"Loan not found or not accessible"});
    if(!['Approved','Active'].includes(loan.rows[0].status)) {
        return badRequest(res,"Only approved or active loans can have payments generated");
    }

    const existing=await pool.query(`
        SELECT LoanPaymentID, DueDate, Status
        FROM LOAN_PAYMENT
        WHERE LoanID=$1 AND Status IN ('Pending','Due','Late','Missed')
        ORDER BY DueDate
        LIMIT 1
    `,[loanId]);

    if(existing.rowCount) {
        return res.json({success:true,message:"A pending payment already exists",data:existing.rows[0]});
    }

    const payment=await pool.query(`
        INSERT INTO LOAN_PAYMENT(LoanPaymentID,LoanID,Amount,DueDate,PaidDate,Status)
        VALUES (
            (SELECT COALESCE(MAX(LoanPaymentID),0)+1 FROM LOAN_PAYMENT),
            $1, ROUND($2::numeric,2), CURRENT_DATE + INTERVAL '1 month', NULL, 'Pending'
        )
        RETURNING *
    `,[loanId,loan.rows[0].emi]);

    res.status(201).json({success:true,message:"Next loan payment generated",data:payment.rows[0]});
}));

app.patch("/api/loan-payments/:id/pay", asyncRoute(async (req, res) => {
    const accountNo = Number(req.body.accountNo);
    const mode = String(req.body.mode || "Online").trim();
    const sessionCustomerId = req.role === "Customer"
        ? Number(req.user?.customerid ?? req.user?.CustomerID)
        : null;
    const requestedCustomerId = sessionCustomerId || (req.body.customerId ? Number(req.body.customerId) : null);

    if (!Number.isInteger(accountNo) || accountNo <= 0) return badRequest(res, "Select the account to pay the installment from.");
    if (req.role === "Customer" && (!Number.isInteger(sessionCustomerId) || sessionCustomerId <= 0)) {
        return res.status(403).json({ success: false, message: "Customer session is missing. Please sign in again." });
    }
    if (req.role !== "Customer" && !isStaffRole(req.role)) {
        return res.status(403).json({ success: false, message: "Access denied." });
    }

    const client = await pool.connect();
    let transactionStarted = false;
    try {
        await client.query("BEGIN");
        transactionStarted = true;

        const paymentParams = [req.params.id];
        const customerScope = req.role === "Customer" ? " AND l.CustomerID=$2" : (requestedCustomerId ? " AND l.CustomerID=$2" : "");
        if (customerScope) paymentParams.push(req.role === "Customer" ? sessionCustomerId : requestedCustomerId);

        const paymentResult = await client.query(`
            SELECT lp.LoanPaymentID, lp.LoanID, lp.Amount, lp.DueDate, lp.PaidDate, lp.Status,
                   l.CustomerID, (lp.DueDate <= CURRENT_DATE) AS IsDue
            FROM LOAN_PAYMENT lp
            JOIN LOAN l ON l.LoanID=lp.LoanID
            WHERE lp.LoanPaymentID=$1 ${customerScope}
            FOR UPDATE OF lp
        `, paymentParams);
        if (!paymentResult.rowCount) throw Object.assign(new Error("Loan payment not found or not accessible."), { statusCode: 404 });

        const payment = paymentResult.rows[0];
        if (String(payment.status).toLowerCase() === "paid") {
            throw Object.assign(new Error("This installment has already been paid."), { statusCode: 400 });
        }
        if (!payment.isdue) {
            throw Object.assign(new Error(`This installment is not due yet. Due date: ${String(payment.duedate).slice(0, 10)}.`), { statusCode: 400 });
        }

        const payingCustomerId = req.role === "Customer" ? sessionCustomerId : Number(payment.customerid);
        const accountResult = await client.query(`
            SELECT a.AccountNo, a.Balance, a.Status
            FROM ACCOUNT a
            JOIN ACCOUNT_HOLDER ah ON ah.AccountNo=a.AccountNo
            WHERE a.AccountNo=$1 AND ah.CustomerID=$2
            FOR UPDATE OF a
        `, [accountNo, payingCustomerId]);
        if (!accountResult.rowCount) throw Object.assign(new Error("The selected account does not belong to this customer."), { statusCode: 403 });
        if (accountResult.rows[0].status !== "Active") throw Object.assign(new Error("The selected account is not active."), { statusCode: 400 });
        if (Number(accountResult.rows[0].balance) < Number(payment.amount)) {
            throw Object.assign(new Error("Insufficient balance to pay this installment."), { statusCode: 400 });
        }

        // Actual repayment: debit the selected account via the same PostgreSQL
        // procedure as withdrawals, then mark the installment paid atomically.
        await client.query(`CALL sp_withdraw($1,$2,$3)`, [accountNo, Number(payment.amount), mode]);
        const paidResult = await client.query(`
            UPDATE LOAN_PAYMENT
            SET Status='Paid', PaidDate=CURRENT_DATE
            WHERE LoanPaymentID=$1 AND Status <> 'Paid' AND DueDate <= CURRENT_DATE
            RETURNING *
        `, [req.params.id]);
        if (!paidResult.rowCount) throw Object.assign(new Error("The installment could not be marked paid. Refresh and try again."), { statusCode: 409 });

        const newBalance = await client.query(`SELECT AccountNo, Balance FROM ACCOUNT WHERE AccountNo=$1`, [accountNo]);
        await client.query("COMMIT");
        transactionStarted = false;
        res.json({
            success: true,
            message: "Loan installment paid successfully; your account has been debited.",
            data: paidResult.rows[0],
            account: newBalance.rows[0]
        });
    } catch (error) {
        if (transactionStarted) {
            try { await client.query("ROLLBACK"); } catch (_) { }
        }
        res.status(error.statusCode || 400).json({ success: false, message: error.message || "Loan payment could not be completed." });
    } finally {
        client.release();
    }
}));

app.get("/api/interest-rates", asyncRoute(async(req,res)=>{
    const result=await pool.query(`SELECT RateID,RateType,ProductType,Rate,EffectiveFrom,EffectiveTo FROM INTEREST_RATE ORDER BY RateID`);
    res.json({success:true,data:result.rows});
}));

app.post("/api/interest-rates", asyncRoute(async(req,res)=>{
    const { rateType, productType, rate, effectiveFrom, effectiveTo } = req.body;
    if (!rateType || !productType || rate === undefined || !effectiveFrom) return badRequest(res, "Rate type, product type, rate and effective-from date are required");
    const numericRate = Number(rate);
    if (!Number.isFinite(numericRate) || numericRate < 0 || numericRate > 99.99) return badRequest(res, "Rate must be between 0 and 99.99");
    if (effectiveTo && new Date(effectiveTo) < new Date(effectiveFrom)) return badRequest(res, "Effective-to cannot be earlier than effective-from");
    const nextIdResult = await pool.query(`SELECT COALESCE(MAX(RateID), 0) + 1 AS next_id FROM INTEREST_RATE`);
    const nextId = Number(nextIdResult.rows[0].next_id);
    const result = await pool.query(`
        INSERT INTO INTEREST_RATE (RateID, RateType, ProductType, Rate, EffectiveFrom, EffectiveTo)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING RateID,RateType,ProductType,Rate,EffectiveFrom,EffectiveTo
    `, [nextId, rateType.trim(), productType.trim(), numericRate, effectiveFrom, effectiveTo || null]);
    res.status(201).json({success:true,message:"Interest rate created",data:result.rows[0]});
}));

app.put("/api/interest-rates/:id", asyncRoute(async(req,res)=>{
    const id = Number(req.params.id);
    const { rateType, productType, rate, effectiveFrom, effectiveTo } = req.body;
    if (!Number.isInteger(id) || id <= 0) return badRequest(res, "Invalid RateID");
    if (!rateType || !productType || rate === undefined || !effectiveFrom) return badRequest(res, "Rate type, product type, rate and effective-from date are required");
    const numericRate = Number(rate);
    if (!Number.isFinite(numericRate) || numericRate < 0 || numericRate > 99.99) return badRequest(res, "Rate must be between 0 and 99.99");
    if (effectiveTo && new Date(effectiveTo) < new Date(effectiveFrom)) return badRequest(res, "Effective-to cannot be earlier than effective-from");
    const result = await pool.query(`
        UPDATE INTEREST_RATE
        SET RateType=$1, ProductType=$2, Rate=$3, EffectiveFrom=$4, EffectiveTo=$5
        WHERE RateID=$6
        RETURNING RateID,RateType,ProductType,Rate,EffectiveFrom,EffectiveTo
    `, [rateType.trim(), productType.trim(), numericRate, effectiveFrom, effectiveTo || null, id]);
    if (!result.rowCount) return res.status(404).json({success:false,message:"Interest rate not found"});
    res.json({success:true,message:"Interest rate updated",data:result.rows[0]});
}));

app.delete("/api/interest-rates/:id", asyncRoute(async(req,res)=>{
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return badRequest(res, "Invalid RateID");
    const result = await pool.query(`DELETE FROM INTEREST_RATE WHERE RateID=$1 RETURNING RateID`, [id]);
    if (!result.rowCount) return res.status(404).json({success:false,message:"Interest rate not found"});
    res.json({success:true,message:"Interest rate deleted",data:result.rows[0]});
}));



// ---------- Nominees ----------
app.get("/api/nominees", asyncRoute(async (req, res) => {
    const customerId = String(req.query.customerId || "").trim();
    const params = customerId ? [customerId] : [];
    const where = customerId ? "WHERE n.CustomerID = $1" : "";

    const result = await pool.query(`
        SELECT
            n.NomineeID,
            n.CustomerID,
            c.Name AS CustomerName,
            n.Name,
            n.Relation,
            n.Phone,
            n.SharePercent
        FROM NOMINEE n
        JOIN CUSTOMER c ON c.CustomerID = n.CustomerID
        ${where}
        ORDER BY n.NomineeID DESC
    `, params);

    res.json({ success: true, data: result.rows });
}));

app.post("/api/nominees", asyncRoute(async (req, res) => {
    const { customerId, name, relation, phone, sharePercent } = req.body;

    if (!customerId || !name || !relation || !phone || sharePercent === undefined) {
        return badRequest(res, "Customer, nominee name, relation, phone and share percentage are required");
    }

    const customer = await pool.query(
        `SELECT CustomerID, Status FROM CUSTOMER WHERE CustomerID=$1`,
        [customerId]
    );
    if (!customer.rowCount) return res.status(404).json({ success:false, message:"Customer not found" });
    if (customer.rows[0].status !== "Active") {
        return res.status(403).json({ success:false, message:"Customer is not active" });
    }

    const numericShare = Number(sharePercent);
    if (!Number.isFinite(numericShare) || numericShare <= 0 || numericShare > 100) {
        return badRequest(res, "Share percentage must be greater than 0 and at most 100");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("LOCK TABLE NOMINEE IN SHARE ROW EXCLUSIVE MODE");

        const idResult = await client.query(`
            SELECT COALESCE(MAX(NomineeID), 0) + 1 AS next_id
            FROM NOMINEE
        `);
        const nomineeId = Number(idResult.rows[0].next_id);

        const result = await client.query(`
            INSERT INTO NOMINEE
            (NomineeID, CustomerID, Name, Relation, Phone, SharePercent)
            VALUES ($1,$2,$3,$4,$5,$6)
            RETURNING NomineeID,CustomerID,Name,Relation,Phone,SharePercent
        `, [nomineeId, customerId, name, relation, phone, numericShare]);

        await client.query("COMMIT");
        res.status(201).json({ success:true, message:"Nominee added", data:result.rows[0] });
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}));

app.put("/api/nominees/:id", asyncRoute(async (req, res) => {
    const { customerId, role, name, relation, phone, sharePercent } = req.body;

    if (!name || !relation || !phone || sharePercent === undefined) {
        return badRequest(res, "Nominee name, relation, phone and share percentage are required");
    }

    const numericShare = Number(sharePercent);
    if (!Number.isFinite(numericShare) || numericShare <= 0 || numericShare > 100) {
        return badRequest(res, "Share percentage must be greater than 0 and at most 100");
    }

    const isCustomer = role === "Customer";
    const params = isCustomer
        ? [name, relation, phone, numericShare, req.params.id, customerId]
        : [name, relation, phone, numericShare, req.params.id];

    const result = await pool.query(`
        UPDATE NOMINEE
        SET Name=$1, Relation=$2, Phone=$3, SharePercent=$4
        WHERE NomineeID=$5 ${isCustomer ? "AND CustomerID=$6" : ""}
        RETURNING NomineeID,CustomerID,Name,Relation,Phone,SharePercent
    `, params);

    if (!result.rowCount) {
        return res.status(404).json({ success:false, message:"Nominee not found or not accessible" });
    }

    res.json({ success:true, message:"Nominee updated", data:result.rows[0] });
}));

app.delete("/api/nominees/:id", asyncRoute(async (req, res) => {
    const customerId = String(req.query.customerId || "").trim();
    const role = req.query.role;
    const isCustomer = role === "Customer";

    const params = isCustomer ? [req.params.id, customerId] : [req.params.id];
    const result = await pool.query(`
        DELETE FROM NOMINEE
        WHERE NomineeID=$1 ${isCustomer ? "AND CustomerID=$2" : ""}
        RETURNING NomineeID
    `, params);

    if (!result.rowCount) {
        return res.status(404).json({ success:false, message:"Nominee not found or not accessible" });
    }

    res.json({ success:true, message:"Nominee deleted" });
}));

// ---------- Fixed Deposits ----------
app.get("/api/fixed-deposits", asyncRoute(async (req, res) => {
    const customerId = req.query.customerId;
    const params = customerId ? [customerId] : [];
    const where = customerId ? "WHERE fd.CustomerID = $1" : "";

    const result = await pool.query(`
        SELECT
            fd.FDID,
            fd.CustomerID,
            c.Name AS CustomerName,
            fd.BranchID,
            b.BranchName,
            fd.RateID,
            ir.Rate,
            fd.Principal,
            fd.StartDate,
            fd.MaturityDate,
            fd.Status,
            (
                EXTRACT(YEAR FROM AGE(fd.MaturityDate, fd.StartDate)) * 12
                + EXTRACT(MONTH FROM AGE(fd.MaturityDate, fd.StartDate))
            )::INTEGER AS Months,
            fn_fd_maturity(
                fd.Principal,
                ir.Rate,
                (
                    EXTRACT(YEAR FROM AGE(fd.MaturityDate, fd.StartDate)) * 12
                    + EXTRACT(MONTH FROM AGE(fd.MaturityDate, fd.StartDate))
                )::INTEGER
            ) AS EstimatedMaturityAmount
        FROM FIXED_DEPOSIT fd
        JOIN CUSTOMER c ON c.CustomerID = fd.CustomerID
        JOIN BRANCH b ON b.BranchID = fd.BranchID
        JOIN INTEREST_RATE ir ON ir.RateID = fd.RateID
        ${where}
        ORDER BY fd.FDID DESC
    `, params);

    res.json({ success: true, data: result.rows });
}));

app.post("/api/fixed-deposits", asyncRoute(async (req, res) => {
    const {
        customerId,
        branchId,
        rateId,
        principal,
        months,
        startDate
    } = req.body;

    if (!customerId || !branchId || !rateId || principal === undefined || months === undefined) {
        return badRequest(res, "Customer, branch, rate, principal and tenure are required");
    }

    const numericPrincipal = Number(principal);
    const numericMonths = Number(months);

    if (!Number.isFinite(numericPrincipal) || numericPrincipal <= 0) {
        return badRequest(res, "Principal must be greater than 0");
    }
    if (!Number.isInteger(numericMonths) || numericMonths <= 0) {
        return badRequest(res, "Tenure must be a positive whole number of months");
    }

    const customer = await pool.query(
        `SELECT CustomerID, Status FROM CUSTOMER WHERE CustomerID=$1`,
        [customerId]
    );
    if (!customer.rowCount) return res.status(404).json({ success: false, message: "Customer not found" });
    if (customer.rows[0].status !== "Active") return res.status(403).json({ success: false, message: "Customer is not active" });

    const branch = await pool.query(
        `SELECT BranchID FROM BRANCH WHERE BranchID=$1`,
        [branchId]
    );
    if (!branch.rowCount) return res.status(400).json({ success: false, message: "Branch not found" });

    const numericRateId = Number(rateId);
    if (!Number.isInteger(numericRateId) || numericRateId <= 0) {
        return badRequest(res, "Invalid interest-rate selection");
    }

    const rate = await pool.query(
        `SELECT RateID, Rate, RateType, ProductType
         FROM INTEREST_RATE
         WHERE RateID = $1::integer`,
        [numericRateId]
    );
    if (!rate.rowCount) return res.status(400).json({ success: false, message: "Interest rate not found" });

    const selectedProduct = String(rate.rows[0].producttype || "").trim().toLowerCase();
    const selectedRateType = String(rate.rows[0].ratetype || "").trim().toLowerCase();
    if (selectedProduct !== "fixed deposit" || selectedRateType !== "deposit") {
        return res.status(400).json({
            success: false,
            message: `Selected rate is not a Fixed Deposit rate (RateID ${numericRateId}, Product: ${rate.rows[0].producttype})`
        });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("LOCK TABLE FIXED_DEPOSIT IN SHARE ROW EXCLUSIVE MODE");

        const idResult = await client.query(`
            SELECT COALESCE(MAX(FDID), 0) + 1 AS next_id
            FROM FIXED_DEPOSIT
        `);
        const fdid = Number(idResult.rows[0].next_id);
        const actualStartDate = startDate || new Date().toISOString().slice(0, 10);

        const result = await client.query(`
            INSERT INTO FIXED_DEPOSIT
            (
                FDID,
                CustomerID,
                BranchID,
                RateID,
                Principal,
                StartDate,
                MaturityDate,
                Status
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6::date,
                ($6::date + make_interval(months => $7))::date,
                'Active'
            )
            RETURNING *
        `, [fdid, customerId, branchId, numericRateId, numericPrincipal, actualStartDate, numericMonths]);

        await client.query("COMMIT");
        res.status(201).json({ success: true, message: "Fixed deposit created", data: result.rows[0] });
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}));

app.patch("/api/fixed-deposits/:id/status", asyncRoute(async (req, res) => {
    const { status } = req.body;
    const allowedStatuses = ["Active", "Matured", "Closed", "Premature"];

    if (!isStaffRole(req.role)) {
        return res.status(403).json({ success: false, message: "Only staff can change fixed-deposit status" });
    }
    if (!allowedStatuses.includes(status)) {
        return badRequest(res, `Invalid fixed-deposit status. Use: ${allowedStatuses.join(", ")}`);
    }

    const result = await pool.query(`
        UPDATE FIXED_DEPOSIT
        SET Status=$1
        WHERE FDID=$2
        RETURNING *
    `, [status, req.params.id]);

    if (!result.rowCount) return res.status(404).json({ success: false, message: "Fixed deposit not found" });
    res.json({ success: true, message: "Fixed-deposit status updated", data: result.rows[0] });
}));


// ---------- Payments ----------
app.get("/api/payments", asyncRoute(async(req,res)=>{
    const role=req.role;
    const customerId=req.query.customerId;
    const filters=[];
    const params=[];

    if(role === "Customer"){
        if(!customerId) return badRequest(res,"Customer ID is required");
        params.push(customerId);
        filters.push(`p.CustomerID=$${params.length}`);
    } else if(role === "Admin") {
        if(customerId){
            params.push(customerId);
            filters.push(`p.CustomerID=$${params.length}`);
        }
    } else {
        return res.status(403).json({success:false,message:"Valid role is required"});
    }

    const where=filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const result=await pool.query(`
        SELECT
            p.PaymentID,
            p.CustomerID,
            c.Name AS CustomerName,
            p.BeneficiaryID,
            b.Name AS BeneficiaryName,
            b.BeneficiaryAccountNo,
            b.IFSC,
            p.Type,
            p.Amount,
            p.DateTime,
            p.Status
        FROM PAYMENT p
        JOIN CUSTOMER c ON c.CustomerID=p.CustomerID
        LEFT JOIN BENEFICIARY b ON b.BeneficiaryID=p.BeneficiaryID
        ${where}
        ORDER BY p.DateTime DESC, p.PaymentID DESC
    `,params);

    res.json({success:true,data:result.rows});
}));

app.post("/api/payments", asyncRoute(async (req, res) => {
    const client = await pool.connect();
    let inTransaction = false;
    try {
        const requestedCustomerId = Number(req.body.customerId || 0);
        const customerId = req.role === "Customer"
            ? Number(req.user?.customerid ?? req.user?.CustomerID)
            : requestedCustomerId;
        const accountNo = Number(req.body.accountNo);
        const beneficiaryId = req.body.beneficiaryId ? Number(req.body.beneficiaryId) : null;
        const type = String(req.body.type || "").trim();
        const amount = Number(req.body.amount);
        const allowedTypes = ["Fund Transfer", "Bill Payment", "Utility Payment", "Merchant Payment"];

        if (!Number.isInteger(customerId) || customerId <= 0 || !Number.isInteger(accountNo) || accountNo <= 0 || !type || !Number.isFinite(amount)) {
            return badRequest(res, "Customer, source account, payment type and amount are required.");
        }
        if (!allowedTypes.includes(type)) return badRequest(res, `Invalid payment type. Use: ${allowedTypes.join(", ")}`);
        if (amount <= 0) return badRequest(res, "Payment amount must be greater than zero.");
        if (req.role === "Customer" && customerId !== Number(req.user?.customerid ?? req.user?.CustomerID)) {
            return res.status(403).json({ success: false, message: "You can only pay from your own customer profile." });
        }

        await client.query("BEGIN");
        inTransaction = true;

        const owner = await client.query(`
            SELECT a.AccountNo, a.Status, a.Balance
            FROM ACCOUNT a
            JOIN ACCOUNT_HOLDER ah ON ah.AccountNo=a.AccountNo
            WHERE a.AccountNo=$1 AND ah.CustomerID=$2
            LIMIT 1 FOR UPDATE OF a
        `, [accountNo, customerId]);
        if (!owner.rowCount) throw Object.assign(new Error("Source account does not belong to this customer."), { statusCode: 403 });
        if (owner.rows[0].status !== "Active") throw Object.assign(new Error("Source account is not active."), { statusCode: 400 });
        if (Number(owner.rows[0].balance) < amount) throw Object.assign(new Error("Insufficient balance for this payment."), { statusCode: 400 });

        let resolvedBeneficiaryId = null;
        let destinationAccount = null;
        let internalTransfer = false;

        if (type === "Fund Transfer") {
            if (!Number.isInteger(beneficiaryId) || beneficiaryId <= 0) throw Object.assign(new Error("Choose an active beneficiary for a fund transfer."), { statusCode: 400 });
            const beneficiaryResult = await client.query(`
                SELECT BeneficiaryID, CustomerID, BeneficiaryAccountNo, Name, Status
                FROM BENEFICIARY
                WHERE BeneficiaryID=$1 AND CustomerID=$2
                FOR SHARE
            `, [beneficiaryId, customerId]);
            if (!beneficiaryResult.rowCount) throw Object.assign(new Error("Beneficiary not found for this customer."), { statusCode: 404 });
            const beneficiary = beneficiaryResult.rows[0];
            if (beneficiary.status !== "Active") throw Object.assign(new Error("Beneficiary is not active."), { statusCode: 400 });
            destinationAccount = Number(beneficiary.beneficiaryaccountno);
            resolvedBeneficiaryId = Number(beneficiary.beneficiaryid);
            if (!Number.isInteger(destinationAccount) || destinationAccount <= 0) throw Object.assign(new Error("Beneficiary account number is invalid."), { statusCode: 400 });
            if (destinationAccount === accountNo) throw Object.assign(new Error("Source and beneficiary accounts must be different."), { statusCode: 400 });

            const destination = await client.query(`SELECT AccountNo, Status FROM ACCOUNT WHERE AccountNo=$1`, [destinationAccount]);
            if (destination.rowCount) {
                if (destination.rows[0].status !== "Active") throw Object.assign(new Error("Destination account is not active."), { statusCode: 400 });
                // Internal account: the stored procedure updates both bank accounts
                // and can create both transaction rows because the FK targets ACCOUNT.
                await client.query(`CALL sp_transfer_funds($1,$2,$3,$4)`, [accountNo, destinationAccount, amount, "Online"]);
                internalTransfer = true;
            } else {
                // External beneficiary: destination isn't an ACCOUNT row. Do not pass
                // it to sp_transfer_funds, which would violate fk_transaction_account.
                // Debit the bank's source account and record the external instruction
                // in PAYMENT for history/reconciliation.
                await client.query(`CALL sp_withdraw($1,$2,$3)`, [accountNo, amount, "Online"]);
            }
        } else {
            await client.query(`CALL sp_withdraw($1,$2,$3)`, [accountNo, amount, "Online"]);
        }

        // PAYMENT IDs in this schema are managed manually; serialize allocation.
        await client.query("SELECT pg_advisory_xact_lock($1)", [727304]);
        const paymentResult = await client.query(`
            INSERT INTO PAYMENT (PaymentID, CustomerID, BeneficiaryID, Type, Amount, DateTime, Status)
            VALUES ((SELECT COALESCE(MAX(PaymentID),400000)+1 FROM PAYMENT), $1, $2, $3, $4, CURRENT_TIMESTAMP, 'Success')
            RETURNING PaymentID, CustomerID, BeneficiaryID, Type, Amount, DateTime, Status
        `, [customerId, resolvedBeneficiaryId, type, amount]);

        await client.query("COMMIT");
        inTransaction = false;
        res.status(201).json({
            success: true,
            message: type === "Fund Transfer" && !internalTransfer
                ? "External transfer submitted. Your source account was debited and the payment is recorded in Payment History. The external destination balance is not managed by this bank database."
                : "Payment completed successfully.",
            data: paymentResult.rows[0],
            internalTransfer
        });
    } catch (error) {
        if (inTransaction) {
            try { await client.query("ROLLBACK"); } catch (_) { }
        }
        res.status(error.statusCode || 400).json({ success: false, message: error.message || "Payment could not be completed." });
    } finally {
        client.release();
    }
}));


// ---------- Cards ----------
app.post("/api/cards", asyncRoute(async (req, res) => {
    const cardType = String(req.body.cardType || "").trim().toUpperCase();
    const expiryDate = req.body.expiryDate || null;

    if (!["DEBIT", "CREDIT"].includes(cardType)) {
        return badRequest(res, "Choose Debit card or Credit card");
    }
    if (!expiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(expiryDate))) {
        return badRequest(res, "A valid card expiry date is required");
    }
    if (new Date(`${expiryDate}T00:00:00`) <= new Date(new Date().toDateString())) {
        return badRequest(res, "Expiry date must be in the future");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        // Serialize ID allocation in this small demo database so concurrent
        // issue requests cannot accidentally select the same MAX(ID)+1.
        await client.query("SELECT pg_advisory_xact_lock($1)", [cardType === "DEBIT" ? 727301 : 727302]);

        let issued;
        if (cardType === "DEBIT") {
            const accountNo = Number(req.body.accountNo);
            if (!Number.isInteger(accountNo) || accountNo <= 0) {
                await client.query("ROLLBACK");
                return badRequest(res, "Select an active account for the debit card");
            }
            const account = await client.query(
                `SELECT AccountNo FROM ACCOUNT WHERE AccountNo=$1 AND Status='Active'`,
                [accountNo]
            );
            if (!account.rowCount) {
                await client.query("ROLLBACK");
                return res.status(400).json({ success: false, message: "The selected account does not exist or is not active" });
            }

            const idResult = await client.query(`SELECT COALESCE(MAX(DebitCardID), 9000) + 1 AS next_id FROM DEBIT_CARD`);
            const cardId = Number(idResult.rows[0].next_id);
            const suffix = String(cardId % 10000).padStart(4, "0");
            const maskedCardNo = `XXXX-XXXX-XXXX-${suffix}`;
            const inserted = await client.query(`
                INSERT INTO DEBIT_CARD (DebitCardID, AccountNo, MaskedCardNo, IssueDate, ExpiryDate, Status)
                VALUES ($1, $2, $3, CURRENT_DATE, $4::DATE, 'Active')
                RETURNING DebitCardID, AccountNo, MaskedCardNo, IssueDate, ExpiryDate, Status
            `, [cardId, accountNo, maskedCardNo, expiryDate]);
            issued = { cardType: "DEBIT", ...inserted.rows[0] };
        } else {
            const customerId = Number(req.body.customerId);
            const creditLimit = Number(req.body.creditLimit);
            if (!Number.isInteger(customerId) || customerId <= 0) {
                await client.query("ROLLBACK");
                return badRequest(res, "Select a customer for the credit card");
            }
            if (!Number.isFinite(creditLimit) || creditLimit <= 0) {
                await client.query("ROLLBACK");
                return badRequest(res, "Credit limit must be greater than zero");
            }
            const customer = await client.query(`SELECT CustomerID FROM CUSTOMER WHERE CustomerID=$1 AND Status='Active'`, [customerId]);
            if (!customer.rowCount) {
                await client.query("ROLLBACK");
                return res.status(400).json({ success: false, message: "The selected customer does not exist or is not active" });
            }

            const idResult = await client.query(`SELECT COALESCE(MAX(CreditCardID), 9100) + 1 AS next_id FROM CREDIT_CARD`);
            const cardId = Number(idResult.rows[0].next_id);
            const suffix = String(cardId % 10000).padStart(4, "0");
            const maskedCardNo = `XXXX-XXXX-XXXX-${suffix}`;
            const inserted = await client.query(`
                INSERT INTO CREDIT_CARD (CreditCardID, CustomerID, MaskedCardNo, CreditLimit, Outstanding, IssueDate, ExpiryDate, Status)
                VALUES ($1, $2, $3, $4, 0, CURRENT_DATE, $5::DATE, 'Active')
                RETURNING CreditCardID, CustomerID, MaskedCardNo, CreditLimit, Outstanding, IssueDate, ExpiryDate, Status
            `, [cardId, customerId, maskedCardNo, creditLimit, expiryDate]);
            issued = { cardType: "CREDIT", ...inserted.rows[0] };
        }

        await client.query("COMMIT");
        res.status(201).json({ success: true, message: `${cardType === "DEBIT" ? "Debit" : "Credit"} card issued successfully`, data: issued });
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch (_) {}
        throw error;
    } finally {
        client.release();
    }
}));

app.get("/api/cards", asyncRoute(async(req,res)=>{
    const customerId = req.query.customerId ? Number(req.query.customerId) : null;
    const params = [];
    let debitWhere = "";
    let creditWhere = "";

    if (customerId) {
        params.push(customerId);
        debitWhere = `WHERE EXISTS (
            SELECT 1 FROM ACCOUNT_HOLDER ah_scope
            WHERE ah_scope.AccountNo = d.AccountNo
              AND ah_scope.CustomerID = $1
        )`;
        creditWhere = `WHERE cc.CustomerID = $1`;
    }

    const result=await pool.query(`
        SELECT 'DEBIT' AS CardType, d.DebitCardID AS CardID, d.AccountNo,
               COALESCE(c.CustomerID, ah_primary.CustomerID) AS CustomerID,
               COALESCE(c.Name, 'Account holder') AS CustomerName,
               d.MaskedCardNo, d.ExpiryDate, d.Status
        FROM DEBIT_CARD d
        LEFT JOIN ACCOUNT_HOLDER ah_primary
          ON ah_primary.AccountNo=d.AccountNo AND ah_primary.HolderType='Primary'
        LEFT JOIN CUSTOMER c ON c.CustomerID=ah_primary.CustomerID
        ${debitWhere}
        UNION ALL
        SELECT 'CREDIT' AS CardType, cc.CreditCardID AS CardID,
               NULL::BIGINT AS AccountNo, cc.CustomerID, c2.Name AS CustomerName,
               cc.MaskedCardNo, cc.ExpiryDate, cc.Status
        FROM CREDIT_CARD cc
        LEFT JOIN CUSTOMER c2 ON c2.CustomerID=cc.CustomerID
        ${creditWhere}
        ORDER BY CardType,CardID
    `, params);
    res.json({success:true,data:result.rows});
}));

app.patch("/api/cards/debit/:id/status", asyncRoute(async(req,res)=>{
    const result=await pool.query(`UPDATE DEBIT_CARD SET Status=$1 WHERE DebitCardID=$2 RETURNING *`,[req.body.status,req.params.id]);
    if(!result.rowCount) return res.status(404).json({success:false,message:"Debit card not found"});
    res.json({success:true,message:"Debit card status updated",data:result.rows[0]});
}));
app.patch("/api/cards/credit/:id/status", asyncRoute(async(req,res)=>{
    const result=await pool.query(`UPDATE CREDIT_CARD SET Status=$1 WHERE CreditCardID=$2 RETURNING *`,[req.body.status,req.params.id]);
    if(!result.rowCount) return res.status(404).json({success:false,message:"Credit card not found"});
    res.json({success:true,message:"Credit card status updated",data:result.rows[0]});
}));

// ---------- Root ----------
app.get("/", (req,res)=>res.sendFile(path.join(FRONTEND_DIR,"index.html")));

app.use((err,req,res,next)=>{
    console.error(err);
    res.status(500).json({success:false,message:"Internal server error"});
});

async function startServer(){
    try{
        await pool.query("SELECT 1");
        console.log("PostgreSQL connection successful");
        app.listen(PORT,()=>{
            console.log(`Banking Management System running at http://localhost:${PORT}`);
        });
    }catch(error){
        console.error("Could not connect to PostgreSQL.");
        console.error(error.message);
        process.exit(1);
    }
}

startServer();
