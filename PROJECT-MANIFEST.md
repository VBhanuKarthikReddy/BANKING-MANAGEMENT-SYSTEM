# Project Manifest

Application: Banking Management System
Application roles: Admin, Customer
Backend: Node.js + Express
Database: PostgreSQL
Frontend: HTML + CSS + JavaScript + Tailwind CDN utilities
Authentication: bcrypt password hashes + signed session token
Authorization: backend role checks + page guards + customer data scoping

Core modules:
Customers, Branches, Employees, Accounts, Transactions, Loans, Cards,
Beneficiaries, Fixed Deposits, Nominees, Payments, Interest Rates,
Audit Logs, Admin Dashboard, Customer Dashboard.

Primary test flows already verified during development:
Deposit, withdrawal, insufficient-balance rejection, transfer, statements,
loan application, approval, EMI, payment, card block/unblock, branch CRUD,
employee CRUD, customer CRUD, beneficiary CRUD/status, fixed deposit creation
and maturity calculation, nominee CRUD, payment management, interest-rate CRUD,
audit auto-logging, dashboard live data, and password authentication.
