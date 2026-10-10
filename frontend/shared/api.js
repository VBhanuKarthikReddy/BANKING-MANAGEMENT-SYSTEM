const API_BASE_URL = "/api";

async function apiRequest(endpoint, options = {}) {
    let employeeHeaders = {};
    let sessionToken = "";
    try {
        const session = JSON.parse(localStorage.getItem("bankingSession") || "null");
        sessionToken = session?.token || "";
        const employeeId = session?.user?.employeeid ?? session?.user?.EmployeeID;
        const role = session?.role || "";
        if (employeeId && role !== "Customer") {
            employeeHeaders["X-Employee-ID"] = String(employeeId);
        }
    } catch (_) {}

    const response = await fetch(API_BASE_URL + endpoint, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(sessionToken ? { "X-Session-Token": sessionToken } : {}),
            ...employeeHeaders,
            ...(options.headers || {})
        }
    });

    let data = {};
    try { data = await response.json(); } catch (_) {}

    if (!response.ok) {
        throw new Error(data.message || `Request failed (${response.status})`);
    }
    return data;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-US", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2
    });
}

function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}

function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("en-IN", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function getSession() {
    try { return JSON.parse(localStorage.getItem("bankingSession") || "null"); }
    catch (_) { return null; }
}

function saveSession(session) {
    localStorage.setItem("bankingSession", JSON.stringify(session));
}

function clearSession() {
    localStorage.removeItem("bankingSession");
}

function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; right: 24px; bottom: 24px; z-index: 99999;
        padding: 12px 18px; border-radius: 10px; font: 600 14px Inter, sans-serif;
        color: #dae2fd; background: ${type === "error" ? "#7f1d1d" : "#065f46"};
        border: 1px solid rgba(255,255,255,.15); box-shadow: 0 10px 30px rgba(0,0,0,.35);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function goToPage(name) {
    const routes = {
        dashboard: "../admin_dashboard/code.html",
        customers: "../customer_management/code.html",
        branches: "../branch_management/code.html",
        employees: "../employee_management/code.html",
        accounts: "../account_management/code.html",
        transactions: "../transaction_management/code.html",
        loans: "../loan_management/code.html",
        cards: "../card_management/code.html",
        fixedDeposits: "../fixed_deposit_management/code.html",
        login: "../login/code.html"
    };
    window.location.href = routes[name] || routes.dashboard;
}
