(function () {
    function getSessionSafe() {
        try { return JSON.parse(localStorage.getItem("bankingSession") || "null"); }
        catch (_) { return null; }
    }
    const session = getSessionSafe();
    const role = session?.role || "";
    const staffRoles = ["Admin"];
    if (!staffRoles.includes(role)) {
        document.documentElement.innerHTML = "";
        window.location.replace(role === "Customer"
            ? "/customer_dashboard/code.html"
            : "/login/code.html");
    }
})();
