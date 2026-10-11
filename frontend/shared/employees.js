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

    async function openOnboardModal() {
        const branchResult = await apiRequest("/branches");
        const branches = branchResult.data || [];
        if (!branches.length) throw new Error("Create a branch before onboarding an employee.");
        const today = new Date();
        const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        if (typeof window.openNexusFormModal !== "function") throw new Error("Form modal helper did not load. Refresh the page and try again.");
        window.openNexusFormModal({
            title: "Onboard Employee",
            description: "Create an employee record and assign the person to a branch.",
            icon: "badge",
            submitLabel: "Create Employee",
            fields: [
                { name: "employeeId", label: "Employee ID", type: "number", min: "1", placeholder: "Auto-generated", help: "Leave blank to assign the next available ID." },
                { name: "branchId", label: "Branch", type: "select", required: true, placeholder: "Select branch", options: branches.map(b => ({ value: b.branchid, label: `${b.branchname} (ID ${b.branchid})` })) },
                { name: "name", label: "Full name", required: true, placeholder: "Employee name", wide: true },
                { name: "email", label: "Email", type: "email", required: true, placeholder: "employee@example.com" },
                { name: "role", label: "Database role", type: "select", required: true, value: "Teller", options: ["Manager", "Teller", "Loan Officer", "Customer Officer"].map(x => ({ value: x, label: x })) },
                { name: "hireDate", label: "Hire date", type: "date", required: true, value: todayValue },
                { name: "status", label: "Status", type: "select", required: true, value: "Active", options: ["Active", "Inactive"].map(x => ({ value: x, label: x })) }
            ],
            onSubmit: async values => {
                const result = await apiRequest("/employees", {
                    method: "POST",
                    body: JSON.stringify({
                        employeeId: values.employeeId ? Number(values.employeeId) : null,
                        branchId: Number(values.branchId), name: values.name.trim(), email: values.email.trim(),
                        role: values.role, hireDate: values.hireDate, status: values.status
                    })
                });
                showToast(result.message || "Employee created successfully");
                await load();
            }
        });
    }

    async function editEmployee(id) {
        const employee = await getEmployee(id);
        const branchResult = await apiRequest("/branches");
        const branches = branchResult.data || [];
        if (typeof window.openNexusFormModal !== "function") throw new Error("Form modal helper did not load. Refresh the page and try again.");
        window.openNexusFormModal({
            title: `Edit Employee #${id}`,
            description: "Update the employee profile, branch assignment, job role and employment status.",
            icon: "manage_accounts",
            submitLabel: "Save Employee",
            fields: [
                { name: "branchId", label: "Branch", type: "select", required: true, value: employee.branchid, options: branches.map(b => ({ value: b.branchid, label: `${b.branchname} (ID ${b.branchid})` })) },
                { name: "name", label: "Employee name", required: true, value: employee.name || "", wide: true },
                { name: "email", label: "Email", type: "email", required: true, value: employee.email || "" },
                { name: "role", label: "Database role", type: "select", required: true, value: employee.role || "Teller", options: ["Manager", "Teller", "Loan Officer", "Customer Officer"].map(x => ({ value: x, label: x })) },
                { name: "hireDate", label: "Hire date", type: "date", required: true, value: String(employee.hiredate || "").slice(0, 10) },
                { name: "status", label: "Status", type: "select", required: true, value: employee.status || "Active", options: ["Active", "Inactive"].map(x => ({ value: x, label: x })) }
            ],
            onSubmit: async values => {
                await apiRequest(`/employees/${encodeURIComponent(id)}`, {
                    method: "PUT",
                    body: JSON.stringify({ branchId: Number(values.branchId), name: values.name.trim(), email: values.email.trim(), role: values.role, hireDate: values.hireDate, status: values.status })
                });
                showToast("Employee updated successfully");
                await load();
            }
        });
    }

    async function deleteEmployee(id) {
        const employee = await getEmployee(id);
        window.openNexusInfoModal({
            title: "Delete employee?",
            description: "This permanently removes the employee record if no related record prevents deletion.",
            icon: "person_remove",
            content: `<p>Delete <strong>${escapeHtml(employee.name)}</strong> (Employee ID ${escapeHtml(id)})?</p>`,
            actions: [
                { label: "Cancel" },
                { label: "Delete Employee", variant: "danger", icon: "delete", onClick: async () => {
                    await apiRequest(`/employees/${encodeURIComponent(id)}`, { method: "DELETE" });
                    showToast("Employee deleted successfully");
                    await load();
                }}
            ]
        });
    }

    onboardBtn?.addEventListener("click", async () => {
        try { await openOnboardModal(); }
        catch (error) { showToast(error.message || "Unable to open onboarding form", "error"); }
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
