document.addEventListener("DOMContentLoaded", async () => {
    const session = getSession();
    if (!session || session.role === "Customer") {
        window.location.href = "../account_management/code.html";
        return;
    }

    const tableBody = document.querySelector("table tbody");
    const search = document.querySelector('input[placeholder="Search customer database..."]');
    const addButton = [...document.querySelectorAll("button")].find(b => b.textContent.includes("Add New Customer"));

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

    async function createCustomer() {
        const name = prompt("Customer name:"); if (!name) return;
        const dob = prompt("DOB (YYYY-MM-DD):"); if (!dob) return;
        const gender = prompt("Gender (Male/Female/Other):", "Male"); if (!gender) return;
        const phone = prompt("Phone:"); if (!phone) return;
        const email = prompt("Email:", "");
        const address = prompt("Address:", ""); if (!address) return;

        await apiRequest("/customers", {
            method: "POST",
            body: JSON.stringify({ name, dob, gender, phone, email, address, kycStatus: "Pending", status: "Active" })
        });

        showToast("Customer created successfully");
        await load();
    }

    async function editCustomer(id) {
        const current = await apiRequest(`/customers`).then(r => r.data.find(c => String(c.customerid) === String(id)));
        if (!current) return showToast("Customer not found", "error");

        const name = prompt("Customer name:", current.name); if (!name) return;
        const dob = prompt("DOB (YYYY-MM-DD):", String(current.dob || "").slice(0, 10)); if (!dob) return;
        const gender = prompt("Gender (Male/Female/Other):", current.gender || "Male"); if (!gender) return;
        const phone = prompt("Phone:", current.phone || ""); if (!phone) return;
        const email = prompt("Email:", current.email || "");
        const address = prompt("Address:", current.address || ""); if (!address) return;
        const kycStatus = prompt("KYC Status (Pending/Verified/Rejected):", current.kycstatus || "Pending"); if (!kycStatus) return;
        const status = prompt("Status (Active/Blocked):", current.status || "Active"); if (!status) return;

        await apiRequest(`/customers/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({ name, dob, gender, phone, email, address, kycStatus, status })
        });

        showToast("Customer updated successfully");
        await load();
    }

    search?.addEventListener("input", load);
    addButton?.addEventListener("click", () => createCustomer().catch(e => showToast(e.message, "error")));

    tableBody?.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const id = button.dataset.id;

        try {
            if (button.dataset.action === "view") {
                const r = await apiRequest(`/customers?search=${encodeURIComponent(id)}`);
                const customer = r.data.find(c => String(c.customerid) === String(id));
                if (!customer) return showToast("Customer not found", "error");
                alert([
                    `Customer ID: ${customer.customerid}`,
                    `Name: ${customer.name}`,
                    `Phone: ${customer.phone || "—"}`,
                    `Email: ${customer.email || "—"}`,
                    `KYC: ${customer.kycstatus || "—"}`,
                    `Status: ${customer.status || "—"}`,
                    `Accounts: ${customer.accountcount || 0}`,
                    `Balance: ${formatMoney(customer.balancetotal)}`
                ].join("\n"));
            }

            if (button.dataset.action === "edit") {
                await editCustomer(id);
            }

            if (button.dataset.action === "delete" && confirm("Delete this customer? Related records may prevent deletion.")) {
                await apiRequest(`/customers/${encodeURIComponent(id)}`, { method: "DELETE" });
                showToast("Customer deleted successfully");
                await load();
            }
        } catch (e) {
            showToast(e.message, "error");
        }
    });

    await load();
});
