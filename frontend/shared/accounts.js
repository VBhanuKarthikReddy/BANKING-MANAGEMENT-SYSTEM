document.addEventListener("DOMContentLoaded", async () => {
    const body = document.querySelector("table tbody");
    const search = document.querySelector('input[type="text"]');
    const createButton = document.getElementById("createAccountButton") || [...document.querySelectorAll("button")]
        .find(b => b.textContent.includes("Create New Account"));

    const session = getSession();
    const isCustomer = session?.role === "Customer";
    const isStaff = ["Admin"].includes(session?.role);
    const customerId = isCustomer ? (session?.user?.customerid ?? session?.user?.CustomerID) : null;
    const accountCache = new Map();

    async function load() {
        try {
            const params = new URLSearchParams();

            if (search?.value.trim()) {
                params.set("search", search.value.trim());
            }

            if (customerId) {
                params.set("customerId", customerId);
            }

            const q = params.toString() ? `?${params.toString()}` : "";
            const result = await apiRequest(`/accounts${q}`);

            accountCache.clear();
            result.data.forEach(a => accountCache.set(String(a.accountno), a));
            body.innerHTML = result.data.map(a => `
                <tr class="hover:bg-surface-container-low transition-colors group">
                    <td class="px-6 py-4">
                        <span class="font-mono-data text-mono-data text-on-surface">${a.accountno}</span>
                    </td>
                    <td class="px-6 py-4">
                        <span class="font-body-sm text-on-surface">${escapeHtml(a.holders)}</span>
                    </td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-0.5 rounded bg-secondary-container/10 border border-secondary-container/30 text-[11px] font-bold text-secondary tracking-wider">
                            ${escapeHtml(a.accounttype)}
                        </span>
                    </td>
                    <td class="px-6 py-4 font-mono-data text-mono-data text-secondary">
                        ${formatMoney(a.balance)}
                    </td>
                    <td class="px-6 py-4 text-on-surface-variant text-body-sm">
                        ${formatDate(a.opendate)}
                    </td>
                    <td class="px-6 py-4 text-center">
                        <span class="text-xs font-medium ${a.status === 'Active' ? 'text-secondary-fixed' : 'text-error'}">
                            ${escapeHtml(a.status.toUpperCase())}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex items-center justify-end gap-2">
                            ${a.status === 'Active' ? `
                            <button data-action="deposit" data-account="${a.accountno}" class="p-2 hover:bg-secondary-container/20 rounded-lg text-secondary transition-colors" title="Deposit">
                                <span class="material-symbols-outlined">add_circle</span>
                            </button>
                            <button data-action="withdraw" data-account="${a.accountno}" class="p-2 hover:bg-error-container/20 rounded-lg text-error transition-colors" title="Withdraw">
                                <span class="material-symbols-outlined">remove_circle</span>
                            </button>` : ''}
                            <button data-action="statement" data-account="${a.accountno}" class="p-2 hover:bg-surface-container-high rounded-lg" title="View Statement">
                                <span class="material-symbols-outlined">receipt_long</span>
                            </button>
                            ${isStaff && ["Active", "Frozen"].includes(a.status) ? `
                            <button type="button" data-action="toggle" data-account="${a.accountno}" data-status="${a.status}" class="p-2 hover:bg-error-container/20 rounded-lg" title="${a.status === 'Active' ? 'Freeze Account' : 'Reactivate Account'}" aria-label="${a.status === 'Active' ? 'Freeze Account' : 'Reactivate Account'}">
                                <span class="material-symbols-outlined">${a.status === 'Active' ? 'ac_unit' : 'lock_open'}</span>
                            </button>` : ''}
                            ${isStaff && a.status !== "Closed" ? `<button type="button" data-action="close" data-account="${a.accountno}" class="p-2 hover:bg-surface-container-high rounded-lg" title="Close Account" aria-label="Close Account">
                                <span class="material-symbols-outlined">close</span>
                            </button>` : ''}
                        </div>
                    </td>
                </tr>
            `).join("");
            const count = result.data.length;
            const active = result.data.filter(a => a.status === "Active").length;
            const nonActive = count - active;
            const totalBalance = result.data.reduce((sum, a) => sum + Number(a.balance || 0), 0);
            const aum = document.getElementById("accountAumValue");
            if (aum) aum.textContent = formatMoney(totalBalance);
            const activeCount = document.getElementById("accountActiveCount");
            if (activeCount) activeCount.textContent = active.toLocaleString();
            const totalCount = document.getElementById("accountTotalCount");
            if (totalCount) totalCount.textContent = `/ ${count.toLocaleString()}`;
            const nonActiveCount = document.getElementById("accountNonActiveCount");
            if (nonActiveCount) nonActiveCount.textContent = nonActive.toLocaleString();
            const frozenCount = document.getElementById("accountFrozenCount");
            const frozen = result.data.filter(a => String(a.status).toLowerCase() === "frozen").length;
            if (frozenCount) frozenCount.textContent = frozen.toLocaleString();
            const activeBar = document.getElementById("accountActiveBar");
            if (activeBar) activeBar.style.width = `${count ? Math.round((active / count) * 100) : 0}%`;
            const countLabel = document.getElementById("accountCountLabel");
            if (countLabel) countLabel.textContent = `Showing ${count.toLocaleString()} account${count === 1 ? "" : "s"}`;
        } catch (e) {
            showToast(e.message, "error");
        }
    }

    search?.addEventListener("input", load);
    const pageTitle = document.getElementById("accountsPageTitle");
    const pageSubtitle = document.getElementById("accountsPageSubtitle");
    const tableTitle = document.getElementById("accountsTableTitle");
    if (isCustomer) {
        if (pageTitle) pageTitle.textContent = "My Accounts";
        if (pageSubtitle) pageSubtitle.textContent = "View balances, manage money, and open your account statements.";
        if (tableTitle) tableTitle.textContent = "My Accounts";
        if (createButton) createButton.classList.add("hidden");
    } else {
        if (pageTitle) pageTitle.textContent = "Accounts Management";
        if (pageSubtitle) pageSubtitle.textContent = "Manage customer accounts, balances, and account status.";
        if (tableTitle) tableTitle.textContent = "Account Registry";
    }


    createButton?.addEventListener("click", async () => {
        if (!isStaff) return showToast("Staff access required to create accounts", "error");
        try {
            const [branchResult, customerResult] = await Promise.all([
                apiRequest("/branches"),
                apiRequest("/customers")
            ]);
            const branches = branchResult.data || [];
            const customers = (customerResult.data || []).filter(c => String(c.status).toLowerCase() === "active");
            if (!branches.length) return showToast("Create a branch before opening an account", "error");
            if (!customers.length) return showToast("Create an active customer before opening an account", "error");
            const today = new Date();
            const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

            openNexusFormModal({
                title: "Create New Account",
                description: "Open an account for an active customer and link it to a branch.",
                icon: "account_balance",
                submitLabel: "Create Account",
                fields: [
                    { name: "accountNo", label: "Account number", type: "number", min: "1", placeholder: "Auto-generated", help: "Leave blank to generate the next account number." },
                    { name: "branchId", label: "Branch", type: "select", required: true, placeholder: "Select branch", options: branches.map(b => ({ value: b.branchid, label: `${b.branchname} (ID ${b.branchid})` })) },
                    { name: "accountType", label: "Account type", type: "select", required: true, value: "Savings", options: [
                        { value: "Savings", label: "Savings" }, { value: "Current", label: "Current" },
                        { value: "Salary", label: "Salary" }, { value: "Fixed Deposit", label: "Fixed Deposit" }
                    ] },
                    { name: "customerId", label: "Primary account holder", type: "select", required: true, placeholder: "Select customer", options: customers.map(c => ({ value: c.customerid, label: `${c.name} (ID ${c.customerid})` })) },
                    { name: "holderType", label: "Holder type", type: "select", required: true, value: "Primary", options: [
                        { value: "Primary", label: "Primary" }, { value: "Joint", label: "Joint" }
                    ] },
                    { name: "openDate", label: "Opening date", type: "date", required: true, value: todayValue },
                    { name: "balance", label: "Opening balance (₹)", type: "number", min: "0", step: "0.01", value: "0", required: true, help: "For a zero-balance account, leave the value at ₹0.00 and use Deposit afterwards." }
                ],
                onSubmit: async (values) => {
                    const payload = {
                        accountNo: values.accountNo ? Number(values.accountNo) : null,
                        branchId: Number(values.branchId),
                        accountType: values.accountType,
                        customerId: Number(values.customerId),
                        openDate: values.openDate,
                        balance: Number(values.balance || 0),
                        status: "Active",
                        holderType: values.holderType
                    };
                    const result = await apiRequest("/accounts", { method: "POST", body: JSON.stringify(payload) });
                    showToast(`Account ${result.data.accountno} created successfully`);
                    await load();
                }
            });
        } catch (error) {
            showToast(error.message || "Unable to open account form", "error");
        }
    });

    body?.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;

        const account = btn.dataset.account;

        try {
            if (btn.dataset.action === "deposit" || btn.dataset.action === "withdraw") {
                const action = btn.dataset.action;
                const isDeposit = action === "deposit";
                const modes = isDeposit
                    ? ["Cash", "UPI", "NEFT", "Online"]
                    : ["ATM", "Cash", "Online", "UPI"];

                openNexusFormModal({
                    title: isDeposit ? "Deposit Funds" : "Withdraw Funds",
                    description: `${isDeposit ? "Deposit funds into" : "Withdraw funds from"} account ${accountCache.get(String(account))?.accountno || account}. Current balance: ${formatMoney(accountCache.get(String(account))?.balance || 0)}. The account is selected from this row, so no account number is needed.`,
                    icon: isDeposit ? "add_circle" : "remove_circle",
                    submitLabel: isDeposit ? "Confirm Deposit" : "Confirm Withdrawal",
                    fields: [
                        { name: "amount", label: "Amount (₹)", type: "number", min: "0.01", step: "0.01", required: true, placeholder: "Enter amount", wide: true },
                        { name: "mode", label: isDeposit ? "Deposit method" : "Withdrawal method", type: "select", required: true, value: modes[0], options: modes.map(mode => ({ value: mode, label: mode })) }
                    ],
                    onSubmit: async values => {
                        const amount = Number(values.amount);
                        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter an amount greater than zero");
                        const payload = { amount, mode: values.mode };
                        if (customerId) payload.customerId = Number(customerId);
                        const result = await apiRequest(`/accounts/${encodeURIComponent(account)}/${action}`, {
                            method: "POST",
                            body: JSON.stringify(payload)
                        });
                        showToast(`${isDeposit ? "Deposit" : "Withdrawal"} successful. New balance: ${formatMoney(result.account?.balance)}`);
                        await load();
                    }
                });

            } else if (btn.dataset.action === "statement") {
                window.location.href =
                    `../transaction_management/code.html?accountNo=${encodeURIComponent(account)}`;

            } else if (btn.dataset.action === "toggle") {
                const freezing = btn.dataset.status === "Active";
                const endpoint = freezing
                    ? `/accounts/${encodeURIComponent(account)}/freeze`
                    : `/accounts/${encodeURIComponent(account)}/reactivate`;
                const current = accountCache.get(String(account));
                window.openNexusInfoModal({
                    title: `${freezing ? "Freeze" : "Reactivate"} account ${account}?`,
                    description: freezing
                        ? "Freezing prevents normal account activity until the account is reactivated."
                        : "Reactivating returns this account to active status if the database rules allow it.",
                    icon: freezing ? "ac_unit" : "lock_open",
                    content: `<p>Account <strong>${escapeHtml(account)}</strong> · ${escapeHtml(current?.holders || "Account holder")} · Current balance ${formatMoney(current?.balance || 0)}.</p>`,
                    actions: [
                        { label: "Cancel" },
                        { label: freezing ? "Freeze Account" : "Reactivate Account", variant: freezing ? "danger" : "primary", icon: freezing ? "ac_unit" : "lock_open", onClick: async () => {
                            await apiRequest(endpoint, { method: "PATCH" });
                            showToast(freezing ? "Account frozen" : "Account reactivated");
                            await load();
                        }}
                    ]
                });

            } else if (btn.dataset.action === "close") {
                window.openNexusInfoModal({
                    title: `Close account ${account}?`,
                    description: "This changes the account status in PostgreSQL. The account must have a zero balance.",
                    icon: "lock",
                    content: `<p>Are you sure you want to close account <strong>${escapeHtml(account)}</strong>? If the account still has a balance, the database will reject the request.</p>`,
                    actions: [
                        { label: "Cancel", close: true },
                        { label: "Close Account", variant: "danger", icon: "lock", onClick: async () => {
                            await apiRequest(`/accounts/${encodeURIComponent(account)}/close`, { method: "PATCH" });
                            showToast("Account closed");
                            await load();
                        }}
                    ]
                });
            }
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            btn.disabled = false;
        }
    });

    await load();
});
