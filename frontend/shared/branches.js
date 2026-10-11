document.addEventListener("DOMContentLoaded", async () => {
    const body = document.querySelector("table tbody");
    const search = document.querySelector('input[placeholder="Filter by branch code or manager..."]');
    const addButton = document.getElementById("addBranchButton");
    const branchCache = new Map();

    async function load() {
        try {
            const q = search?.value.trim() ? `?search=${encodeURIComponent(search.value.trim())}` : "";
            const result = await apiRequest(`/branches${q}`);
            branchCache.clear();
            document.getElementById("branchCountLabel")?.replaceChildren(document.createTextNode(`${result.data.length.toLocaleString()} branch${result.data.length === 1 ? "" : "es"}`));
            result.data.forEach(b => branchCache.set(String(b.branchid), b));

            body.innerHTML = result.data.map(b => `<tr class="hover:bg-surface-bright/20 transition-colors group">
                <td class="px-6 py-5"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded bg-primary-container/20 flex items-center justify-center text-primary"><span class="material-symbols-outlined">store</span></div><div><p class="font-body-lg text-body-lg font-semibold text-primary">${escapeHtml(b.branchname)}</p><p class="font-mono-data text-mono-data text-on-surface-variant">${escapeHtml(b.branchcode)}</p></div></div></td>
                <td class="px-6 py-5"><p class="font-body-sm text-body-sm text-on-surface">${escapeHtml(b.address || "")}</p><p class="text-[11px] text-on-surface-variant uppercase tracking-widest">IFSC: ${escapeHtml(b.ifsc || "")}</p></td>
                <td class="px-6 py-5 text-on-surface">${escapeHtml(b.manager || "Not assigned")}</td>
                <td class="px-6 py-5"><p class="font-mono-data text-mono-data text-primary-fixed-dim">${formatMoney(b.totaldeposits || 0)}</p></td>
                <td class="px-6 py-5"><span class="px-3 py-1 rounded-full bg-secondary-container/15 text-secondary text-[11px] font-bold border border-secondary/20">${escapeHtml(b.displaystatus || "Active")}</span></td>
                <td class="px-6 py-5 text-right flex justify-end gap-1">
                    <button class="p-2 hover:bg-surface-container-high rounded-lg" data-id="${b.branchid}" data-action="edit" title="Edit branch">
                        <span class="material-symbols-outlined">edit</span>
                    </button>
                    <button class="p-2 hover:bg-surface-container-high rounded-lg text-error" data-id="${b.branchid}" data-action="delete" title="Delete branch">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </td>
            </tr>`).join("");
        } catch(e){ showToast(e.message,"error"); }
    }

    search?.addEventListener("input", load);

    addButton?.addEventListener("click", () => {
        openNexusFormModal({
            title: "Add New Branch",
            description: "Register a branch and its identifying details. Leave Branch ID blank for automatic assignment.",
            icon: "account_tree",
            submitLabel: "Create Branch",
            fields: [
                { name: "branchId", label: "Branch ID", type: "number", min: "1", placeholder: "Auto-generated", help: "Optional; the system can assign the next ID." },
                { name: "branchCode", label: "Branch code", required: true, placeholder: "e.g. BR006" },
                { name: "branchName", label: "Branch name", required: true, placeholder: "e.g. Kochi Central Branch" },
                { name: "ifsc", label: "IFSC code", required: true, placeholder: "e.g. NEXU0000006" },
                { name: "phone", label: "Contact phone", type: "tel", required: true, placeholder: "Branch phone number" },
                { name: "address", label: "Branch address", type: "textarea", required: true, wide: true, placeholder: "Full branch address" }
            ],
            onSubmit: async (values) => {
                await apiRequest("/branches", {
                    method: "POST",
                    body: JSON.stringify({
                        branchId: values.branchId ? Number(values.branchId) : null,
                        branchCode: values.branchCode.trim(),
                        branchName: values.branchName.trim(),
                        ifsc: values.ifsc.trim().toUpperCase(),
                        address: values.address.trim(),
                        phone: values.phone.trim()
                    })
                });
                showToast("Branch created successfully");
                await load();
            }
        });
    });

    body?.addEventListener("click", async e => {
        const btn=e.target.closest("button[data-action]");
        if(!btn) return;

        const id=String(btn.dataset.id);
        const branch=branchCache.get(id);
        if(!branch) return;

        if (btn.dataset.action === "edit") {
            openNexusFormModal({
                title: `Edit Branch #${id}`,
                description: "Update branch details. Existing customer/account relationships remain linked by Branch ID.",
                icon: "account_tree",
                submitLabel: "Save Branch",
                fields: [
                    { name: "branchCode", label: "Branch code", required: true, value: branch.branchcode || "" },
                    { name: "branchName", label: "Branch name", required: true, value: branch.branchname || "" },
                    { name: "ifsc", label: "IFSC code", required: true, value: branch.ifsc || "" },
                    { name: "phone", label: "Contact phone", type: "tel", required: true, value: branch.phone || "" },
                    { name: "address", label: "Branch address", type: "textarea", required: true, wide: true, value: branch.address || "" }
                ],
                onSubmit: async values => {
                    await apiRequest(`/branches/${encodeURIComponent(id)}`, {
                        method: "PUT",
                        body: JSON.stringify({
                            branchCode: values.branchCode.trim(), branchName: values.branchName.trim(),
                            ifsc: values.ifsc.trim().toUpperCase(), address: values.address.trim(), phone: values.phone.trim()
                        })
                    });
                    showToast("Branch updated successfully");
                    await load();
                }
            });
        } else if (btn.dataset.action === "delete") {
            window.openNexusInfoModal({
                title: "Delete branch?",
                description: "Branches referenced by accounts or employees cannot be removed.",
                icon: "delete_forever",
                content: `<p>Delete <strong>${escapeHtml(branch.branchname)}</strong> (${escapeHtml(branch.branchcode)})? PostgreSQL will preserve referential integrity and reject the deletion if records still depend on this branch.</p>`,
                actions: [
                    { label: "Cancel" },
                    { label: "Delete Branch", variant: "danger", icon: "delete", onClick: async () => {
                        await apiRequest(`/branches/${encodeURIComponent(id)}`, { method: "DELETE" });
                        showToast("Branch deleted successfully");
                        await load();
                    }}
                ]
            });
        }

    });

    load();
});
