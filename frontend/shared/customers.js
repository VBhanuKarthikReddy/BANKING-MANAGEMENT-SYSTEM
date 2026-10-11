document.addEventListener("DOMContentLoaded", async () => {
    const session = getSession();
    if (!session || session.role === "Customer") {
        window.location.href = "../account_management/code.html";
        return;
    }

    const tableBody = document.querySelector("table tbody");
    const search = document.querySelector('input[placeholder="Search customer database..."]');
    const addButton = document.getElementById("addCustomerButton");

    async function load() {
        try {
            const q = search?.value.trim() ? `?search=${encodeURIComponent(search.value.trim())}` : "";
            const result = await apiRequest(`/customers${q}`);

            tableBody.innerHTML = result.data.map(c => {
                const initials = c.name.split(" ").map(x => x[0]).slice(0, 2).join("").toUpperCase();
                return `<tr class="hover:bg-primary-container/5 transition-colors group">
                    <td class="px-6 py-4 font-mono-data text-mono-data text-on-surface-variant">#${escapeHtml(c.customerid)}</td>
                    <td class="px-6 py-4"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary text-xs font-bold">${initials}</div><span class="text-on-surface font-medium">${escapeHtml(c.name)}</span></div></td>
                    <td class="px-6 py-4 text-on-surface-variant text-sm">${escapeHtml(c.accounttypes)}</td>
                    <td class="px-6 py-4"><span class="status-badge ${c.status === 'Active' ? 'bg-secondary-container/20 text-secondary border border-secondary/30' : 'bg-error-container/20 text-error border border-error/30'}">${escapeHtml(c.status)}</span></td>
                    <td class="px-6 py-4 text-right font-mono-data text-mono-data text-on-surface">${formatMoney(c.balancetotal)}</td>
                    <td class="px-6 py-4"><div class="flex justify-center gap-2">
                        <button data-action="view" data-id="${c.customerid}" class="material-symbols-outlined text-primary hover:bg-primary/10 p-1 rounded">visibility</button>
                        <button data-action="edit" data-id="${c.customerid}" class="material-symbols-outlined text-on-surface-variant hover:text-white p-1 rounded">edit</button>
                        <button data-action="delete" data-id="${c.customerid}" class="material-symbols-outlined text-error hover:bg-error/10 p-1 rounded">delete</button>
                    </div></td>
                </tr>`;
            }).join("");

            const stats = document.querySelectorAll(".min-w-\\[100px\\] span.text-headline-md");
            const active = result.data.filter(x => x.status === "Active").length;
            const pending = result.data.filter(x => x.status === "Blocked" || x.kycstatus === "Pending").length;
            if (stats[0]) stats[0].textContent = active;
            if (stats[1]) stats[1].textContent = pending;
        } catch (e) {
            showToast(e.message, "error");
        }
    }

    function createCustomer() {
        return openNexusFormModal({
            title: "Add New Customer",
            description: "Create a customer profile in the bank registry. Customer ID can be generated automatically.",
            icon: "person_add",
            submitLabel: "Create Customer",
            fields: [
                { name: "customerId", label: "Customer ID", type: "number", min: "1", placeholder: "Auto-generated", help: "Leave blank to let the system assign the next ID." },
                { name: "name", label: "Full name", required: true, placeholder: "e.g. Ananya Nair" },
                { name: "dob", label: "Date of birth", type: "date", required: true },
                { name: "gender", label: "Gender", type: "select", required: true, value: "Female", options: [
                    { value: "Male", label: "Male" }, { value: "Female", label: "Female" }, { value: "Other", label: "Other" }
                ] },
                { name: "phone", label: "Phone number", type: "tel", required: true, placeholder: "Mobile number" },
                { name: "email", label: "Email address", type: "email", placeholder: "name@example.com" },
                { name: "address", label: "Residential address", type: "textarea", required: true, wide: true, placeholder: "Street, city, state, PIN code" }
            ],
            onSubmit: async (values) => {
                await apiRequest("/customers", {
                    method: "POST",
                    body: JSON.stringify({
                        customerId: values.customerId ? Number(values.customerId) : null,
                        name: values.name.trim(),
                        dob: values.dob,
                        gender: values.gender,
                        phone: values.phone.trim(),
                        email: values.email.trim() || null,
                        address: values.address.trim(),
                        kycStatus: "Pending",
                        status: "Active"
                    })
                });
                showToast("Customer created successfully");
                await load();
            }
        });
    }

    async function editCustomer(id) {
        const result = await apiRequest(`/customers?search=${encodeURIComponent(id)}`);
        const current = (result.data || []).find(c => String(c.customerid) === String(id));
        if (!current) throw new Error("Customer not found");
        openNexusFormModal({
            title: `Edit Customer #${id}`,
            description: "Update the customer profile and KYC status.",
            icon: "manage_accounts",
            submitLabel: "Save Customer",
            fields: [
                { name: "name", label: "Full name", required: true, value: current.name || "" },
                { name: "dob", label: "Date of birth", type: "date", required: true, value: String(current.dob || "").slice(0, 10) },
                { name: "gender", label: "Gender", type: "select", required: true, value: current.gender || "Other", options: ["Male", "Female", "Other"].map(x => ({ value: x, label: x })) },
                { name: "phone", label: "Phone number", type: "tel", required: true, value: current.phone || "" },
                { name: "email", label: "Email address", type: "email", value: current.email || "" },
                { name: "kycStatus", label: "KYC status", type: "select", required: true, value: current.kycstatus || "Pending", options: ["Pending", "Verified", "Rejected"].map(x => ({ value: x, label: x })) },
                { name: "status", label: "Customer status", type: "select", required: true, value: current.status || "Active", options: ["Active", "Blocked"].map(x => ({ value: x, label: x })) },
                { name: "address", label: "Residential address", type: "textarea", required: true, wide: true, value: current.address || "" }
            ],
            onSubmit: async values => {
                await apiRequest(`/customers/${encodeURIComponent(id)}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        name: values.name.trim(), dob: values.dob, gender: values.gender,
                        phone: values.phone.trim(), email: values.email.trim() || null,
                        address: values.address.trim(), kycStatus: values.kycStatus, status: values.status
                    })
                });
                showToast("Customer updated successfully");
                await load();
            }
        });
    }

    search?.addEventListener("input", load);
    addButton?.addEventListener("click", () => createCustomer());

    tableBody?.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const id = button.dataset.id;

        try {
            if (button.dataset.action === "view") {
                const r = await apiRequest(`/customers?search=${encodeURIComponent(id)}`);
                const customer = (r.data || []).find(c => String(c.customerid) === String(id));
                if (!customer) return showToast("Customer not found", "error");
                window.openNexusInfoModal({
                    title: customer.name,
                    description: `Customer profile · ID ${customer.customerid}`,
                    icon: "person",
                    content: `<div class="nexus-emi-grid"><div><span>Phone</span><strong>${escapeHtml(customer.phone || "—")}</strong></div><div><span>Email</span><strong>${escapeHtml(customer.email || "—")}</strong></div><div><span>KYC status</span><strong>${escapeHtml(customer.kycstatus || "—")}</strong></div><div><span>Customer status</span><strong>${escapeHtml(customer.status || "—")}</strong></div><div><span>Accounts</span><strong>${escapeHtml(customer.accountcount || 0)}</strong></div><div><span>Total balance</span><strong>${formatMoney(customer.balancetotal)}</strong></div><div class="nexus-field-wide"><span>Address</span><strong>${escapeHtml(customer.address || "—")}</strong></div></div>`,
                    actions: [{ label: "Close" }]
                });
            } else if (button.dataset.action === "edit") {
                await editCustomer(id);
            } else if (button.dataset.action === "delete") {
                const r = await apiRequest(`/customers?search=${encodeURIComponent(id)}`);
                const customer = (r.data || []).find(c => String(c.customerid) === String(id));
                if (!customer) throw new Error("Customer not found");
                window.openNexusInfoModal({
                    title: "Delete customer?",
                    description: "This is a permanent database operation and related records may prevent deletion.",
                    icon: "delete_forever",
                    content: `<p>Delete <strong>${escapeHtml(customer.name)}</strong> (Customer ID ${escapeHtml(id)})? Accounts, loans or other foreign-key references may cause PostgreSQL to reject this operation.</p>`,
                    actions: [
                        { label: "Cancel" },
                        { label: "Delete Customer", variant: "danger", icon: "delete", onClick: async () => {
                            await apiRequest(`/customers/${encodeURIComponent(id)}`, { method: "DELETE" });
                            showToast("Customer deleted successfully");
                            await load();
                        }}
                    ]
                });
            }
        } catch (e) {
            showToast(e.message, "error");
        }
    });

    await load();
});
