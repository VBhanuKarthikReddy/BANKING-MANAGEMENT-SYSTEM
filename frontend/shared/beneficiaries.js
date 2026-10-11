document.addEventListener("DOMContentLoaded", async () => {
    const session = getSession();
    const customerId = session?.role === "Customer" ? session?.user?.customerid : null;
    const select = document.querySelector("#beneficiarySelect");
    const manageButton = document.getElementById("manageBeneficiariesBtn");

    if (!manageButton || !customerId || !select) {
        if (manageButton) manageButton.style.display = "none";
        return;
    }

    async function fetchBeneficiaries() {
        const result = await apiRequest(`/beneficiaries?customerId=${encodeURIComponent(customerId)}`);
        return result.data || [];
    }

    async function refreshSelect() {
        const list = await fetchBeneficiaries();
        const previous = select.value;
        select.innerHTML = '<option value="">Choose a beneficiary...</option>' +
            list.filter(b => b.status === "Active").map(b =>
                `<option value="${escapeHtml(b.beneficiaryaccountno)}">${escapeHtml(b.name)} (AC: ${escapeHtml(b.beneficiaryaccountno)})</option>`
            ).join("");
        if ([...select.options].some(o => o.value === previous)) select.value = previous;
    }

    function closeModal() {
        document.getElementById("beneficiaryModal")?.remove();
    }

    function openModal() {
        if (document.getElementById("beneficiaryModal")) return;

        const modal = document.createElement("div");
        modal.id = "beneficiaryModal";
        modal.className = "fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4";
        modal.innerHTML = `
            <div class="w-full max-w-3xl rounded-2xl border border-outline-variant bg-surface-container-high shadow-2xl p-6">
                <div class="flex items-center justify-between mb-5">
                    <div>
                        <h3 class="text-xl font-semibold text-on-surface">Manage Beneficiaries</h3>
                        <p class="text-sm text-on-surface-variant mt-1">Add, edit or deactivate beneficiaries for Customer ${escapeHtml(customerId)}.</p>
                    </div>
                    <button type="button" id="closeBeneficiaryModal" class="text-2xl text-on-surface-variant hover:text-on-surface">&times;</button>
                </div>

                <form id="beneficiaryForm" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <input type="hidden" name="beneficiaryId">
                    <label class="block">
                        <span class="text-xs text-on-surface-variant">Beneficiary Name *</span>
                        <input name="name" required type="text" class="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-on-surface" placeholder="e.g. Ravi Traders">
                    </label>
                    <label class="block">
                        <span class="text-xs text-on-surface-variant">Beneficiary Account No. *</span>
                        <input name="beneficiaryAccountNo" required type="number" class="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-on-surface" placeholder="Existing account number">
                    </label>
                    <label class="block">
                        <span class="text-xs text-on-surface-variant">IFSC *</span>
                        <input name="ifsc" required type="text" class="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-on-surface" placeholder="IFSC code">
                    </label>
                    <label class="block">
                        <span class="text-xs text-on-surface-variant">Status</span>
                        <select name="status" class="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-on-surface">
                            <option value="Active">Active</option>
                            <option value="Blocked">Blocked</option>
                        </select>
                    </label>
                    <div class="md:col-span-2 flex gap-2 justify-end">
                        <button type="button" id="cancelBeneficiaryEdit" class="px-4 py-2 rounded-lg border border-outline-variant text-on-surface text-sm">Clear</button>
                        <button type="submit" class="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold">Save Beneficiary</button>
                    </div>
                </form>

                <div class="border border-outline-variant rounded-xl overflow-hidden">
                    <div class="px-4 py-3 bg-surface-container-low border-b border-outline-variant text-xs font-semibold text-on-surface-variant">Your beneficiaries</div>
                    <div id="beneficiaryList" class="divide-y divide-outline-variant"></div>
                </div>
            </div>`;

        document.body.appendChild(modal);

        const form = modal.querySelector("#beneficiaryForm");
        const list = modal.querySelector("#beneficiaryList");

        function clearForm() {
            form.reset();
            form.elements.beneficiaryId.value = "";
            form.elements.status.value = "Active";
        }

        function render(items) {
            if (!items.length) {
                list.innerHTML = `<div class="p-5 text-sm text-on-surface-variant">No beneficiaries found.</div>`;
                return;
            }
            list.innerHTML = items.map(b => `
                <div class="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                        <p class="font-semibold text-on-surface">${escapeHtml(b.name)}</p>
                        <p class="text-xs text-on-surface-variant">A/C: ${escapeHtml(b.beneficiaryaccountno)} • IFSC: ${escapeHtml(b.ifsc)}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-1 rounded-full text-[10px] font-bold ${b.status === "Active" ? "bg-secondary/10 text-secondary" : "bg-error/10 text-error"}">${escapeHtml(b.status)}</span>
                        <button type="button" data-action="edit" data-id="${escapeHtml(b.beneficiaryid)}" class="px-3 py-1.5 rounded border border-outline-variant text-xs">Edit</button>
                        <button type="button" data-action="toggle" data-id="${escapeHtml(b.beneficiaryid)}" data-status="${b.status}" class="px-3 py-1.5 rounded border border-outline-variant text-xs">${b.status === "Active" ? "Deactivate" : "Activate"}</button>
                    </div>
                </div>`).join("");
        }

        async function loadList() {
            try {
                const items = await fetchBeneficiaries();
                render(items);
                await refreshSelect();
            } catch (error) {
                showToast(error.message, "error");
            }
        }

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(form).entries());
            try {
                if (data.beneficiaryId) {
                    await apiRequest(`/beneficiaries/${encodeURIComponent(data.beneficiaryId)}`, {
                        method: "PUT",
                        body: JSON.stringify({
                            customerId,
                            name: data.name,
                            beneficiaryAccountNo: data.beneficiaryAccountNo,
                            ifsc: data.ifsc,
                            status: data.status
                        })
                    });
                    showToast("Beneficiary updated");
                } else {
                    await apiRequest("/beneficiaries", {
                        method: "POST",
                        body: JSON.stringify({
                            customerId,
                            name: data.name,
                            beneficiaryAccountNo: data.beneficiaryAccountNo,
                            ifsc: data.ifsc,
                            status: data.status
                        })
                    });
                    showToast("Beneficiary added");
                }
                clearForm();
                await loadList();
            } catch (error) {
                showToast(error.message, "error");
            }
        });

        list.addEventListener("click", async (event) => {
            const button = event.target.closest("button[data-action]");
            if (!button) return;
            const id = button.dataset.id;
            const items = await fetchBeneficiaries();
            const item = items.find(x => String(x.beneficiaryid) === String(id));
            if (!item) return;

            if (button.dataset.action === "edit") {
                form.elements.beneficiaryId.value = item.beneficiaryid;
                form.elements.name.value = item.name;
                form.elements.beneficiaryAccountNo.value = item.beneficiaryaccountno;
                form.elements.ifsc.value = item.ifsc;
                form.elements.status.value = item.status;
                form.elements.name.focus();
                return;
            }

            const newStatus = item.status === "Active" ? "Blocked" : "Active";
            window.openNexusInfoModal({
                title: `${newStatus === "Blocked" ? "Deactivate" : "Reactivate"} beneficiary?`,
                description: "This controls whether the beneficiary is available in the transfer dropdown.",
                icon: newStatus === "Blocked" ? "person_off" : "person_check",
                content: `<p>${newStatus === "Blocked" ? "Block" : "Reactivate"} <strong>${escapeHtml(item.name)}</strong> (A/C ${escapeHtml(item.beneficiaryaccountno)})?</p>`,
                actions: [
                    { label: "Cancel" },
                    { label: newStatus === "Blocked" ? "Deactivate" : "Reactivate", variant: newStatus === "Blocked" ? "danger" : "primary", onClick: async () => {
                        await apiRequest(`/beneficiaries/${encodeURIComponent(id)}/status`, {
                            method: "PATCH",
                            body: JSON.stringify({ customerId, status: newStatus })
                        });
                        showToast(`Beneficiary ${newStatus.toLowerCase()}`);
                        await loadList();
                    }}
                ]
            });
        });

        modal.querySelector("#closeBeneficiaryModal").addEventListener("click", closeModal);
        modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
        modal.querySelector("#cancelBeneficiaryEdit").addEventListener("click", clearForm);
        loadList();
    }

    manageButton.addEventListener("click", openModal);
    try { await refreshSelect(); } catch (error) { showToast(error.message, "error"); }
});
