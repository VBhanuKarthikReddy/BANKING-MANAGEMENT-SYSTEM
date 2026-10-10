document.addEventListener("DOMContentLoaded", async () => {
    const session = getSession();
    const allowedRoles = new Set(["Admin"]);

    if (!session || !allowedRoles.has(session.role)) {
        showToast("Employee management is available only to staff", "error");
        setTimeout(() => {
            window.location.href = session?.role === "Customer"
                ? "../account_management/code.html"
                : "../login/code.html";
        }, 700);
        return;
    }

    const body = document.querySelector("table tbody");
    const search = document.querySelector('header input[type="text"]') || document.querySelector('input[type="text"]');
    const onboardBtn = document.getElementById("onboardEmployeeBtn");

    async function load() {
        try {
            const q = search?.value.trim() ? `?search=${encodeURIComponent(search.value.trim())}` : "";
            const result = await apiRequest(`/employees${q}`);

            body.innerHTML = result.data.map(e => {
                const initials = String(e.name || "")
                    .split(" ")
                    .filter(Boolean)
                    .map(x => x[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                return `<tr class="hover:bg-surface-container-high/40 transition-colors group">
                    <td class="px-6 py-5">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded bg-surface-container flex items-center justify-center border border-outline-variant text-primary font-bold">${escapeHtml(initials)}</div>
                            <div>
                                <p class="font-body-lg text-body-lg text-on-surface font-semibold">${escapeHtml(e.name)}</p>
                                <p class="font-body-sm text-[12px] text-on-surface-variant">Emp ID: ${escapeHtml(e.employeeid)}</p>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-5">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary-container/10 text-primary-fixed-dim border border-primary-fixed-dim/20">
                            ${escapeHtml(e.role)}
                        </span>
                    </td>
                    <td class="px-6 py-5 font-mono-data text-mono-data text-on-surface-variant">${escapeHtml(e.branchname)}</td>
                    <td class="px-6 py-5 font-body-sm text-body-sm text-on-surface-variant italic">${escapeHtml(e.email)}</td>
                    <td class="px-6 py-5">
                        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold border ${e.status === "Active" ? "bg-secondary/10 text-secondary border-secondary/20" : "bg-error/10 text-error border-error/20"}">
                            ${escapeHtml(e.status)}
                        </span>
                    </td>
                    <td class="px-6 py-5 text-right">
                        <div class="flex items-center justify-end gap-2">
                            <button type="button" data-action="edit" data-id="${escapeHtml(e.employeeid)}" class="px-2.5 py-1.5 rounded border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary text-xs">Edit</button>
                            <button type="button" data-action="delete" data-id="${escapeHtml(e.employeeid)}" class="px-2.5 py-1.5 rounded border border-error/40 text-error hover:bg-error/10 text-xs">Delete</button>
                        </div>
                    </td>
                </tr>`;
            }).join("");

            const count = result.data.length;
            const active = result.data.filter(e => e.status === "Active").length;
            const roles = new Set(result.data.map(e => e.role).filter(Boolean));
            const branchCounts = new Map();
            result.data.filter(e => e.status === "Active").forEach(e => {
                const key = e.branchname || "Unassigned";
                branchCounts.set(key, (branchCounts.get(key) || 0) + 1);
            });
            const topBranch = [...branchCounts.entries()].sort((a,b) => b[1]-a[1])[0];
            const summary = document.getElementById("employeeSummaryText");
            if (summary) summary.textContent = `Managing ${count.toLocaleString()} staff record${count === 1 ? "" : "s"} across the available branches.`;
            document.getElementById("activeEmployeeCount")?.replaceChildren(document.createTextNode(active.toLocaleString()));
            document.getElementById("employeeRoleCount")?.replaceChildren(document.createTextNode(roles.size.toLocaleString()));
            const roleSub = document.getElementById("employeeRoleSub");
            if (roleSub) roleSub.textContent = `${roles.size} distinct role${roles.size === 1 ? "" : "s"} in the database`;
            const topBranchEl = document.getElementById("employeeTopBranch");
            if (topBranchEl) topBranchEl.textContent = topBranch ? topBranch[0] : "No branch data";
            const topBranchCountEl = document.getElementById("employeeTopBranchCount");
            if (topBranchCountEl) topBranchCountEl.textContent = topBranch ? `${topBranch[1].toLocaleString()} active employee${topBranch[1] === 1 ? "" : "s"}` : "No active employees";
            const countLabel = document.getElementById("employeeCountLabel");
            if (countLabel) countLabel.textContent = `Showing ${count.toLocaleString()} staff member${count === 1 ? "" : "s"}`;
        } catch (e) {
            showToast(e.message, "error");
        }
    }

    async function getEmployee(id) {
        const result = await apiRequest(`/employees?search=${encodeURIComponent(id)}`);
        const employee = result.data.find(x => String(x.employeeid) === String(id));
        if (!employee) throw new Error("Employee not found");
        return employee;
    }

    function openOnboardModal() {
        const existing = document.getElementById("employeeOnboardModal");
        if (existing) existing.remove();

        const modal = document.createElement("div");
        modal.id = "employeeOnboardModal";
        modal.className = "fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4";
        modal.innerHTML = `
            <div class="w-full max-w-2xl rounded-2xl border border-outline-variant bg-surface-container-high shadow-2xl p-6">
                <div class="flex items-center justify-between mb-5">
                    <div>
                        <h3 class="text-xl font-semibold text-on-surface">Onboard Employee</h3>
                        <p class="text-sm text-on-surface-variant mt-1">Create a new employee record in PostgreSQL.</p>
                    </div>
                    <button type="button" id="closeOnboardModal" class="text-2xl text-on-surface-variant hover:text-on-surface">&times;</button>
                </div>

                <form id="onboardEmployeeForm" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label class="block">
                        <span class="text-xs text-on-surface-variant">Employee ID (optional)</span>
                        <input name="employeeId" type="number" class="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-on-surface" placeholder="Auto-generate">
                    </label>
                    <label class="block">
                        <span class="text-xs text-on-surface-variant">Branch ID *</span>
                        <input name="branchId" type="number" required value="1" class="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-on-surface">
                    </label>
                    <label class="block md:col-span-2">
                        <span class="text-xs text-on-surface-variant">Employee Name *</span>
                        <input name="name" type="text" required class="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-on-surface" placeholder="Full name">
                    </label>
                    <label class="block">
                        <span class="text-xs text-on-surface-variant">Email *</span>
                        <input name="email" type="email" required class="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-on-surface" placeholder="employee@example.com">
                    </label>
                    <label class="block">
                        <span class="text-xs text-on-surface-variant">Role *</span>
                        <select name="role" required class="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-on-surface">
                            <option value="Manager">Manager</option>
                            <option value="Teller">Teller</option>
                            <option value="Loan Officer">Loan Officer</option>
                            <option value="Customer Officer">Customer Officer</option>
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-xs text-on-surface-variant">Hire Date *</span>
                        <input name="hireDate" type="date" required value="${new Date().toISOString().slice(0, 10)}" class="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-on-surface">
                    </label>
                    <label class="block">
                        <span class="text-xs text-on-surface-variant">Status *</span>
                        <select name="status" required class="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-on-surface">
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </label>
                    <div class="md:col-span-2 flex justify-end gap-3 mt-2">
                        <button type="button" id="cancelOnboardModal" class="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant">Cancel</button>
                        <button type="submit" class="px-4 py-2 rounded-lg bg-secondary-container text-on-secondary-container font-semibold">Create Employee</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        const close = () => modal.remove();
        document.getElementById("closeOnboardModal")?.addEventListener("click", close);
        document.getElementById("cancelOnboardModal")?.addEventListener("click", close);
        modal.addEventListener("click", (event) => {
            if (event.target === modal) close();
        });

        document.getElementById("onboardEmployeeForm")?.addEventListener("submit", async (event) => {
            event.preventDefault();

            try {
                const form = event.currentTarget;
                const fd = new FormData(form);
                const employeeIdRaw = String(fd.get("employeeId") || "").trim();

                await apiRequest("/employees", {
                    method: "POST",
                    body: JSON.stringify({
                        employeeId: employeeIdRaw ? Number(employeeIdRaw) : null,
                        branchId: Number(fd.get("branchId")),
                        name: String(fd.get("name") || "").trim(),
                        email: String(fd.get("email") || "").trim(),
                        role: String(fd.get("role") || "").trim(),
                        hireDate: String(fd.get("hireDate") || ""),
                        status: String(fd.get("status") || "Active")
                    })
                });

                close();
                showToast("Employee created successfully");
                await load();
            } catch (error) {
                showToast(error.message, "error");
            }
        });
    }

    async function editEmployee(id) {
        const e = await getEmployee(id);

        const branchId = prompt("Branch ID:", e.branchid);
        if (branchId === null) return;

        const name = prompt("Employee name:", e.name);
        if (name === null) return;

        const email = prompt("Email:", e.email);
        if (email === null) return;

        const role = prompt("Role:", e.role);
        if (role === null) return;

        const hireDate = prompt("Hire date (YYYY-MM-DD):", String(e.hiredate).slice(0, 10));
        if (hireDate === null) return;

        const status = prompt("Status (Active/Inactive):", e.status);
        if (status === null) return;

        await apiRequest(`/employees/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({
                branchId: Number(branchId),
                name: name.trim(),
                email: email.trim(),
                role: role.trim(),
                hireDate,
                status: status.trim()
            })
        });

        showToast("Employee updated successfully");
        await load();
    }

    async function deleteEmployee(id) {
        const e = await getEmployee(id);
        if (!confirm(`Delete employee ${e.name} (ID ${id})?`)) return;

        await apiRequest(`/employees/${encodeURIComponent(id)}`, {
            method: "DELETE"
        });

        showToast("Employee deleted successfully");
        await load();
    }

    onboardBtn?.addEventListener("click", () => {
        openOnboardModal();
    });

    body?.addEventListener("click", async event => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        event.stopPropagation();

        try {
            if (button.dataset.action === "edit") {
                await editEmployee(button.dataset.id);
            } else if (button.dataset.action === "delete") {
                await deleteEmployee(button.dataset.id);
            }
        } catch (e) {
            showToast(e.message, "error");
        }
    });

    search?.addEventListener("input", load);
    await load();
});
