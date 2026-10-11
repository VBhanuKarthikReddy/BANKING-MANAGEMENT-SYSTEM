document.addEventListener("DOMContentLoaded", async () => {
    const form = document.querySelector("form");
    const amountInput = document.getElementById("transferAmount") || form?.querySelector('input[type="number"]');
    const transferButton = document.getElementById("authorizeTransferButton") || [...document.querySelectorAll("form button")].find(b => b.textContent.includes("Authorize Transfer"));
    const clearButton = document.getElementById("clearTransferFormButton");
    const beneficiarySelect = form?.querySelector("#beneficiarySelect");
    const search = document.querySelector('input[placeholder="Search transactions, accounts..."]');
    const accountNoFromQuery = new URLSearchParams(location.search).get("accountNo");
    const session = getSession();
    const isCustomer = session?.role === "Customer";
    const customerId = isCustomer ? (session?.user?.customerid ?? session?.user?.CustomerID) : null;
    const modeButtons = [...(form?.querySelectorAll("[data-transfer-mode]") || [])];
    const quickAmountButtons = [...(form?.querySelectorAll("[data-amount-pct]") || [])];
    const sourceWrap = document.createElement("div");
    sourceWrap.className = "space-y-2 group";
    sourceWrap.innerHTML = `<label for="sourceAccount" class="font-label-caps text-label-caps text-on-surface-variant block ml-1">From Account</label><select id="sourceAccount" class="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-on-surface"><option value="">Loading accounts…</option></select>`;

    if (!form || !transferButton || !beneficiarySelect || !amountInput) return;

    const firstField = form.querySelector(".space-y-2.group");
    firstField?.parentElement?.insertBefore(sourceWrap, firstField);
    const sourceSelect = sourceWrap.querySelector("select");
    const availableBalance = document.getElementById("availableBalanceValue");
    const historyCount = document.getElementById("transactionHistoryCount");
    const exportButton = document.getElementById("exportTransactionsCsvButton");
    const filterButton = document.getElementById("filterTransactionsButton");
    const remarksInput = form.querySelector("textarea");
    let accounts = [];
    let transactions = [];
    let selectedMode = "IMPS";
    let typeFilter = "All";
    let fromDateFilter = "";
    let toDateFilter = "";

    async function loadAccounts() {
        const query = new URLSearchParams();
        if (customerId) query.set("customerId", customerId);
        const preferredAccount = sourceSelect.value || accountNoFromQuery;
        const r = await apiRequest(`/accounts${query.toString() ? `?${query}` : ""}`);
        accounts = (r.data || []).filter(a => a.status === "Active");
        sourceSelect.innerHTML = accounts.map((a, index) => `<option value="${escapeHtml(a.accountno)}" ${String(a.accountno) === String(preferredAccount) || (!preferredAccount && index === 0) ? "selected" : ""}>${escapeHtml(a.accountno)} — ${escapeHtml(a.holders || "Account holder")} — ${formatMoney(a.balance)}</option>`).join("") || '<option value="">No active accounts available</option>';
        updateAvailableBalance();
    }

    function getSelectedAccount() {
        return accounts.find(a => String(a.accountno) === String(sourceSelect.value));
    }

    function updateAvailableBalance() {
        const account = getSelectedAccount();
        const balance = Number(account?.balance || 0);
        if (availableBalance) availableBalance.textContent = account ? formatMoney(balance) : "—";
        quickAmountButtons.forEach(b => { b.disabled = !account || balance <= 0; });
    }

    async function loadBeneficiaries() {
        const query = new URLSearchParams();
        if (customerId) query.set("customerId", customerId);
        const r = await apiRequest(`/beneficiaries${query.toString() ? `?${query}` : ""}`);
        beneficiarySelect.innerHTML = '<option value="">Choose a beneficiary…</option>' +
            (r.data || []).filter(b => b.status === "Active").map(b => `<option value="${escapeHtml(b.beneficiaryaccountno)}">${escapeHtml(b.name)} (A/C ${escapeHtml(b.beneficiaryaccountno)})</option>`).join("");
    }

    function activeTransactions() {
        const term = String(search?.value || "").trim().toLowerCase();
        return transactions.filter(t => {
            const haystack = `${t.transactionid ?? ""} ${t.accountno ?? ""} ${t.type ?? ""} ${t.mode ?? ""} ${t.status ?? ""}`.toLowerCase();
            const date = String(t.datetime || "").slice(0, 10);
            return (!term || haystack.includes(term)) && (typeFilter === "All" || String(t.type) === typeFilter) &&
                (!fromDateFilter || date >= fromDateFilter) && (!toDateFilter || date <= toDateFilter);
        });
    }

    function renderHistory() {
        const body = document.querySelector("table tbody");
        if (!body) return;
        const visible = activeTransactions();
        body.innerHTML = visible.length ? visible.slice(0, 10).map(t => `<tr>
            <td class="px-6 py-4 font-mono-data">#${escapeHtml(t.transactionid)}</td>
            <td class="px-6 py-4">${escapeHtml(t.accountno)}</td>
            <td class="px-6 py-4">${escapeHtml(t.type)}</td>
            <td class="px-6 py-4">${formatMoney(t.amount)}</td>
            <td class="px-6 py-4">${formatDateTime(t.datetime)}</td>
            <td class="px-6 py-4">${escapeHtml(t.mode || "—")}</td>
            <td class="px-6 py-4">${escapeHtml(t.status || "—")}</td>
        </tr>`).join("") : '<tr><td colspan="7" class="p-8 text-center text-on-surface-variant">No transactions match your filters.</td></tr>';
        if (historyCount) historyCount.textContent = `Showing ${Math.min(visible.length, 10)} of ${visible.length} matching transaction${visible.length === 1 ? "" : "s"}`;
    }

    async function loadHistory() {
        try {
            const query = new URLSearchParams();
            if (accountNoFromQuery) query.set("accountNo", accountNoFromQuery);
            if (customerId) query.set("customerId", customerId);
            const r = await apiRequest(`/transactions${query.toString() ? `?${query}` : ""}`);
            transactions = r.data || [];
            renderHistory();
        } catch (e) {
            showToast(e.message, "error");
        }
    }

    modeButtons.forEach(button => button.addEventListener("click", () => {
        selectedMode = button.dataset.transferMode;
        modeButtons.forEach(item => {
            const active = item === button;
            item.setAttribute("aria-pressed", active ? "true" : "false");
            item.classList.toggle("bg-secondary-container", active);
            item.classList.toggle("text-on-secondary-container", active);
            item.classList.toggle("shadow-sm", active);
            item.classList.toggle("text-on-surface-variant", !active);
            item.classList.toggle("hover:text-primary", !active);
        });
    }));

    quickAmountButtons.forEach(button => button.addEventListener("click", () => {
        const account = getSelectedAccount();
        if (!account) return showToast("Select an active source account first", "error");
        const balance = Number(account.balance || 0);
        const percentage = Number(button.dataset.amountPct || 0);
        amountInput.value = (Math.floor(balance * percentage) / 100).toFixed(2);
        amountInput.dispatchEvent(new Event("input", { bubbles: true }));
    }));

    sourceSelect.addEventListener("change", updateAvailableBalance);
    search?.addEventListener("input", renderHistory);

    clearButton?.addEventListener("click", () => {
        amountInput.value = "";
        if (beneficiarySelect) beneficiarySelect.value = "";
        if (remarksInput) remarksInput.value = "";
        showToast("Transfer form cleared");
    });

    transferButton.addEventListener("click", () => {
        const toAccount = beneficiarySelect.value;
        const fromAccount = sourceSelect.value;
        const amount = Number(amountInput.value);
        const account = getSelectedAccount();
        const balance = Number(account?.balance || 0);
        if (!fromAccount || !toAccount || !Number.isFinite(amount) || amount <= 0) {
            showToast("Choose a source account, beneficiary, and amount greater than zero", "error");
            return;
        }
        if (amount > balance) {
            showToast("Transfer amount exceeds the available balance", "error");
            return;
        }

        const beneficiaryLabel = beneficiarySelect.selectedOptions?.[0]?.textContent || `A/C ${toAccount}`;
        window.openNexusInfoModal({
            title: "Review transfer",
            description: "Confirm the source account, beneficiary, amount, and transfer method before submitting.",
            icon: "swap_horiz",
            content: `<div class="nexus-emi-grid">
                <div><span>From account</span><strong>${escapeHtml(fromAccount)}</strong></div>
                <div><span>Available balance</span><strong>${formatMoney(balance)}</strong></div>
                <div class="nexus-field-wide"><span>Beneficiary</span><strong>${escapeHtml(beneficiaryLabel)}</strong></div>
                <div><span>Transfer method</span><strong>${escapeHtml(selectedMode)}</strong></div>
                <div><span>Transfer amount</span><strong>${formatMoney(amount)}</strong></div>
                <div class="nexus-field-wide"><span>Remarks</span><strong>${escapeHtml(remarksInput?.value.trim() || "—")}</strong></div>
            </div><p class="mt-4 text-sm text-on-surface-variant">If this beneficiary is outside the bank's account database, the payment will be recorded in Payment History and the source account will be debited; the external destination balance is not maintained in this demo database.</p>`,
            actions: [
                { label: "Cancel", onClick: () => {} },
                { label: "Confirm Transfer", variant: "primary", icon: "verified_user", onClick: async () => {
                    transferButton.disabled = true;
                    const originalText = transferButton.innerHTML;
                    try {
                        transferButton.innerHTML = '<span class="nexus-spinner"></span><span>Processing transfer…</span>';
                        const transferResult = await apiRequest("/transfers", {
                            method: "POST",
                            body: JSON.stringify({ fromAccount: Number(fromAccount), toAccount: Number(toAccount), amount, mode: selectedMode, customerId })
                        });
                        showToast(transferResult.message || `${selectedMode} transfer successful`);
                        amountInput.value = "";
                        if (remarksInput) remarksInput.value = "";
                        await Promise.all([loadAccounts(), loadHistory()]);
                    } finally {
                        transferButton.disabled = false;
                        transferButton.innerHTML = originalText;
                    }
                }}
            ]
        });
    });

    filterButton?.addEventListener("click", () => {
        openNexusFormModal({
            title: "Filter Transactions",
            description: "Narrow the recent transaction list by type and date range.",
            icon: "filter_alt",
            submitLabel: "Apply Filters",
            fields: [
                { name: "type", label: "Transaction type", type: "select", value: typeFilter, options: [
                    { value: "All", label: "All types" }, { value: "Deposit", label: "Deposit" }, { value: "Withdrawal", label: "Withdrawal" },
                    { value: "Transfer", label: "Transfer" }, { value: "Debit", label: "Debit" }, { value: "Credit", label: "Credit" }
                ] },
                { name: "fromDate", label: "From date", type: "date", value: fromDateFilter },
                { name: "toDate", label: "To date", type: "date", value: toDateFilter }
            ],
            onSubmit: async values => {
                if (values.fromDate && values.toDate && values.fromDate > values.toDate) throw new Error("From date cannot be later than To date");
                typeFilter = values.type || "All";
                fromDateFilter = values.fromDate || "";
                toDateFilter = values.toDate || "";
                renderHistory();
                showToast("Transaction filters applied");
            }
        });
    });

    exportButton?.addEventListener("click", () => {
        const rows = activeTransactions();
        if (!rows.length) return showToast("No transactions to export", "error");
        const columns = ["TransactionID", "AccountNo", "Type", "Amount", "DateTime", "Mode", "Status"];
        const csvEscape = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
        const csv = [columns.join(","), ...rows.map(t => [t.transactionid, t.accountno, t.type, t.amount, t.datetime, t.mode, t.status].map(csvEscape).join(","))].join("\r\n");
        const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast("Transaction CSV exported");
    });


    try {
        await loadAccounts();
        await loadBeneficiaries();
        await loadHistory();
    } catch (e) {
        showToast(e.message, "error");
    }
});
