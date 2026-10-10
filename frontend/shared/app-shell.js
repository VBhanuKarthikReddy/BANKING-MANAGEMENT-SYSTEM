(function () {
    const routes = {
        customerDashboard: "/customer_dashboard/code.html",
        dashboard: "/admin_dashboard/code.html",
        customers: "/customer_management/code.html",
        branches: "/branch_management/code.html",
        employees: "/employee_management/code.html",
        accounts: "/account_management/code.html",
        transactions: "/transaction_management/code.html",
        loans: "/loan_management/code.html",
        cards: "/card_management/code.html",
        fixedDeposits: "/fixed_deposit_management/code.html",
        nominees: "/nominee_management/code.html",
        payments: "/payment_management/code.html",
        interestRates: "/interest_rate_management/code.html",
        auditLogs: "/audit_log_management/code.html",
        login: "/login/code.html"
    };

    const staffOnlyPaths = new Set([
        "/admin_dashboard/code.html",
        "/customer_management/code.html",
        "/branch_management/code.html",
        "/employee_management/code.html",
        "/interest_rate_management/code.html",
        "/audit_log_management/code.html"
    ]);

    function getSession() {
        try { return JSON.parse(localStorage.getItem("bankingSession") || "null"); }
        catch (_) { return null; }
    }

    function pathNow() {
        const path = window.location.pathname.replace(/\/+$/, "");
        return path || "/";
    }

    const session = getSession();
    const role = session?.role || "";
    const isCustomer = role === "Customer";
    const isAdmin = role === "Admin";

    const staffItems = [
        [routes.dashboard, "dashboard", "Dashboard"],
        [routes.customers, "group", "Customers"],
        [routes.branches, "account_tree", "Branches"],
        [routes.employees, "badge", "Employees"],
        [routes.accounts, "account_balance", "Accounts"],
        [routes.transactions, "swap_horiz", "Transactions"],
        [routes.loans, "payments", "Loans"],
        [routes.cards, "credit_card", "Cards"],
        [routes.fixedDeposits, "savings", "Fixed Deposits"],
        [routes.nominees, "family_restroom", "Nominees"],
        [routes.payments, "payments", "Payments"],
        [routes.interestRates, "percent", "Interest Rates"],
        [routes.auditLogs, "fact_check", "Audit Logs"]
    ];

    const customerItems = [
        [routes.customerDashboard, "dashboard", "Dashboard"],
        [routes.accounts, "account_balance", "Accounts"],
        [routes.transactions, "swap_horiz", "Transactions"],
        [routes.loans, "payments", "Loans"],
        [routes.cards, "credit_card", "Cards"],
        [routes.fixedDeposits, "savings", "Fixed Deposits"],
        [routes.nominees, "family_restroom", "Nominees"],
        [routes.payments, "payments", "Payments"]
    ];

    function redirectForRole() {
        if (!session || !["Admin", "Customer"].includes(role)) {
            window.location.replace(routes.login);
            return true;
        }
        const current = pathNow();
        if (isCustomer && (staffOnlyPaths.has(current) || current === routes.customerManagement)) {
            window.location.replace(routes.customerDashboard);
            return true;
        }
        if (isAdmin && current === routes.customerDashboard) {
            window.location.replace(routes.dashboard);
            return true;
        }
        return false;
    }

    function makeSidebar() {
        // The shared shell owns the only sidebar. Legacy page sidebars are
        // removed at build time and this function also removes any stray one.
        document.querySelectorAll("aside").forEach((el) => el.remove());

        const aside = document.createElement("aside");
        aside.setAttribute("aria-label", isCustomer ? "Customer navigation" : "Admin navigation");
        aside.innerHTML = `
            <div class="shell-brand">
                <div class="shell-brand-name">Nexus Financial</div>
                <div class="shell-brand-subtitle">${isCustomer ? "Personal Banking" : "Banking Operations"}</div>
            </div>
            <nav aria-label="Primary navigation"></nav>
            <div class="shell-user-area">
                <div class="shell-user">
                    <div id="shellUserName" class="shell-user-name"></div>
                    <div id="shellUserMeta" class="shell-user-meta"></div>
                </div>
                <button id="shellLogout" type="button" class="shell-logout">
                    <span class="material-symbols-outlined">logout</span>
                    <span>Sign out</span>
                </button>
            </div>
        `;

        const nav = aside.querySelector("nav");
        const items = isCustomer ? customerItems : staffItems;
        const current = pathNow();
        nav.innerHTML = items.map(([href, icon, label]) => {
            const active = href.replace(/\/+$/, "") === current;
            return `<a href="${href}" class="shell-nav-link${active ? " shell-active" : ""}"><span class="material-symbols-outlined">${icon}</span><span>${label}</span></a>`;
        }).join("");

        const user = session?.user || {};
        const name = user.name || user.customername || user.employeename || "User";
        const id = isCustomer
            ? (user.customerid ?? user.CustomerID ?? "")
            : (user.employeeid ?? user.EmployeeID ?? "");
        aside.querySelector("#shellUserName").textContent = name;
        aside.querySelector("#shellUserMeta").textContent = `${isCustomer ? "Customer" : "Admin"}${id ? ` • ID ${id}` : ""}`;

        aside.querySelector("#shellLogout").addEventListener("click", () => {
            localStorage.removeItem("bankingSession");
            window.location.assign(routes.login);
        });

        document.body.prepend(aside);
    }

    function removeLegacyNavigation() {
        document.querySelectorAll('body > nav, body > .bottom-nav, body > [class*="bottom-0"]').forEach((el) => el.remove());
    }

    function boot() {
        if (pathNow().includes("/login/")) {
            if (session && (isCustomer || isAdmin)) {
                window.location.replace(isCustomer ? routes.customerDashboard : routes.dashboard);
                return;
            }
            document.body.classList.add("shell-ready");
            return;
        }

        if (redirectForRole()) return;

        removeLegacyNavigation();
        makeSidebar();
        document.body.classList.add("shell-ready");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }
})();
