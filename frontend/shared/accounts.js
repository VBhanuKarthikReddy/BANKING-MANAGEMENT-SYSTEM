document.addEventListener("DOMContentLoaded", async () => {
    const body = document.querySelector("table tbody");
    const search = document.querySelector('input[type="text"]');
    const createButton = document.getElementById("createAccountButton") || [...document.querySelectorAll("button")]
        .find(b => b.textContent.includes("Create New Account"));

    const session = getSession();
    const isCustomer = session?.role === "Customer";
    const isStaff = ["Admin"].includes(session?.role);
    const customerId = isCustomer ? session?.user?.customerid : null;

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
                            ${isStaff ? `
                            <button data-action="toggle" data-account="${a.accountno}" data-status="${a.status}" class="p-2 hover:bg-error-container/20 rounded-lg" title="${a.status === 'Active' ? 'Freeze Account' : 'Reactivate Account'}">
                                <span class="material-symbols-outlined">${a.status === 'Active' ? 'ac_unit' : 'lock_open'}</span>
                            </button>
                            <button data-action="close" data-account="${a.accountno}" class="p-2 hover:bg-surface-container-high rounded-lg" title="Close Account">
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
        const branchId = prompt("Branch ID:", "1");
        if (!branchId) return;

        const accountType = prompt(
            "Account type (Savings/Current/Salary/Fixed Deposit):",
            "Savings"
        );
        if (!accountType) return;

        const newCustomerId = prompt("Primary customer ID:", customerId || "1001");
        if (!newCustomerId) return;

        const openDate = prompt(
            "Open date (YYYY-MM-DD):",
            new Date().toISOString().slice(0, 10)
        );
        if (!openDate) return;

        try {
            const r = await apiRequest("/accounts", {
                method: "POST",
                body: JSON.stringify({
                    branchId,
                    accountType,
                    customerId: newCustomerId,
                    openDate,
                    balance: 0,
                    status: "Active",
                    holderType: "Primary"
                })
            });

            showToast(`Account ${r.data.accountno} created`);
            await load();
        } catch (e) {
            showToast(e.message, "error");
        }
    });

    body?.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;

        const account = btn.dataset.account;

        try {
            if (btn.dataset.action === "deposit") {
                const amountText = prompt(`Deposit amount for account ${account}:`, "1000");
                if (amountText === null) return;

                const amount = Number(amountText);
                if (!Number.isFinite(amount) || amount <= 0) {
                    showToast("Enter a valid amount greater than zero", "error");
                    return;
                }

                const mode = prompt(
                    "Deposit mode (Cash / UPI / NEFT / Online):",
                    "Cash"
                ) || "Cash";

                btn.disabled = true;

                const result = await apiRequest(`/accounts/${account}/deposit`, {
                    method: "POST",
                    body: JSON.stringify({
                        amount,
                        mode,
                        customerId
                    })
                });

                const newBalance = formatMoney(result.account.balance);
                showToast(`Deposit successful. New balance: ${newBalance}`);
                await load();

            } else if (btn.dataset.action === "withdraw") {
                const amountText = prompt(`Withdrawal amount for account ${account}:`, "1000");
                if (amountText === null) return;

                const amount = Number(amountText);
                if (!Number.isFinite(amount) || amount <= 0) {
                    showToast("Enter a valid amount greater than zero", "error");
                    return;
                }

                const mode = prompt(
                    "Withdrawal mode (ATM / Cash / Online):",
                    "ATM"
                ) || "ATM";

                btn.disabled = true;

                const result = await apiRequest(`/accounts/${account}/withdraw`, {
                    method: "POST",
                    body: JSON.stringify({
                        amount,
                        mode,
                        customerId
                    })
                });

                const newBalance = formatMoney(result.account.balance);
                showToast(`Withdrawal successful. New balance: ${newBalance}`);
                await load();

            } else if (btn.dataset.action === "statement") {
                window.location.href =
                    `../transaction_management/code.html?accountNo=${encodeURIComponent(account)}`;

            } else if (btn.dataset.action === "toggle") {
                const endpoint = btn.dataset.status === "Active"
                    ? `/accounts/${account}/freeze`
                    : `/accounts/${account}/reactivate`;

                await apiRequest(endpoint, { method: "PATCH" });
                showToast(
                    btn.dataset.status === "Active"
                        ? "Account frozen"
                        : "Account reactivated"
                );
                await load();

            } else if (btn.dataset.action === "close") {
                if (confirm("Close this account? PostgreSQL requires a zero balance.")) {
                    await apiRequest(`/accounts/${account}/close`, { method: "PATCH" });
                    showToast("Account closed");
                    await load();
                }
            }
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            btn.disabled = false;
        }
    });

    await load();
});
