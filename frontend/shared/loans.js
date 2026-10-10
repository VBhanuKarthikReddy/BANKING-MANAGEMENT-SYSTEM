document.addEventListener("DOMContentLoaded", async () => {
    const body = document.querySelector("table tbody");
    const addButton = document.getElementById("loan-new-application") || [...document.querySelectorAll("button")]
        .find(b => /add|new application|new loan/i.test(b.textContent));

    const title = document.getElementById("loan-page-title");
    const subtitle = document.getElementById("loan-page-subtitle");
    const creditCheckButton = document.getElementById("loan-credit-check");
    const tableTitle = document.getElementById("loan-table-title");
    const tableCount = document.getElementById("loan-table-count");
    const totalDisbursed = document.getElementById("loan-total-disbursed");
    const disbursedSubtitle = document.getElementById("loan-disbursed-subtitle");
    const activeCount = document.getElementById("loan-active-count");
    const activeBar = document.getElementById("loan-active-bar");
    const activeSubtitle = document.getElementById("loan-active-subtitle");
    const pendingCount = document.getElementById("loan-pending-count");
    const pendingSubtitle = document.getElementById("loan-pending-subtitle");
    const insightsSection = document.getElementById("loan-insights-section");

    const session = getSession();
    const role = session?.role || "Admin";
    const isCustomer = role === "Customer";
    const customerId = session?.user?.customerid ?? session?.user?.CustomerID ?? null;

    function money(value) {
        return formatMoney(value);
    }

    function renderRoleView() {
        if (isCustomer) {
            title && (title.textContent = "My Loans");
            subtitle && (subtitle.textContent = "View your loan applications, approved loans, and current status.");
            tableTitle && (tableTitle.textContent = "My Loans");
            creditCheckButton?.remove();
            insightsSection?.remove();
            disbursedSubtitle && (disbursedSubtitle.textContent = "Approved and active principal for your loans");
            activeSubtitle && (activeSubtitle.textContent = "Approved or active loans for you");
            pendingSubtitle && (pendingSubtitle.textContent = "Your applications awaiting review");
        } else {
            title && (title.textContent = "Loan Management");
            subtitle && (subtitle.textContent = "Monitor portfolio performance and manage credit operations.");
            tableTitle && (tableTitle.textContent = "Loan Portfolio");
            disbursedSubtitle && (disbursedSubtitle.textContent = "Based on approved and active loans");
            activeSubtitle && (activeSubtitle.textContent = "Live count of active loans");
            pendingSubtitle && (pendingSubtitle.textContent = "Applications awaiting review");
        }
    }

    function updateStats(loans) {
        const approvedOrActive = loans.filter(l => ["Approved", "Active"].includes(l.status));
        const active = isCustomer
            ? approvedOrActive.length
            : loans.filter(l => l.status === "Active").length;
        const pending = loans.filter(l => l.status === "Applied").length;
        const total = approvedOrActive.reduce((sum, l) => sum + Number(l.principal || 0), 0);

        if (totalDisbursed) totalDisbursed.textContent = money(total);
        if (activeCount) activeCount.textContent = String(active);
        if (pendingCount) pendingCount.textContent = String(pending);

        if (isCustomer) {
            const pct = Math.min(100, active * 100);
            if (activeBar) activeBar.style.width = `${pct}%`;
        } else {
            const capacity = 15000;
            const pct = capacity ? Math.min(100, (active / capacity) * 100) : 0;
            if (activeBar) activeBar.style.width = `${pct}%`;
        }
    }

    async function load() {
        try {
            if (isCustomer && !customerId) {
                throw new Error("Customer session is missing. Please log in again.");
            }

            const endpoint = isCustomer
                ? `/loans?customerId=${encodeURIComponent(customerId)}`
                : "/loans";

            const r = await apiRequest(endpoint);
            const loans = Array.isArray(r.data) ? r.data : [];

            updateStats(loans);

            if (tableCount) {
                if (isCustomer) {
                    tableCount.textContent = `Showing ${loans.length} loan${loans.length === 1 ? "" : "s"} for your account`;
                } else {
                    tableCount.textContent = `Showing ${loans.length} loan${loans.length === 1 ? "" : "s"} in the database`;
                }
            }

            if (!loans.length) {
                body.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-10 text-center text-on-surface-variant">
                            ${isCustomer ? "You do not have any loan records yet." : "No loans found in the database."}
                        </td>
                    </tr>`;
                return;
            }

            body.innerHTML = loans.map(l => `
                <tr class="hover:bg-surface-container-high/40 transition-colors group">
                    <td class="px-6 py-4 font-mono-data text-primary">#${escapeHtml(l.loanid)}</td>
                    <td class="px-6 py-4">
                        <div>
                            <div class="text-body-sm font-semibold">${escapeHtml(l.customername)}</div>
                            <div class="text-[10px] text-on-surface-variant">
                                ${escapeHtml(l.type)} • ${escapeHtml(l.branchname)}
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 font-mono-data">${money(l.principal)}</td>
                    <td class="px-6 py-4 font-mono-data">${Number(l.rate).toFixed(2)}%</td>
                    <td class="px-6 py-4 text-body-sm">${escapeHtml(l.tenure)} Months</td>
                    <td class="px-6 py-4">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold
                            ${l.status === 'Approved' || l.status === 'Active'
                                ? 'bg-secondary/15 text-secondary border border-secondary/20'
                                : l.status === 'Rejected'
                                    ? 'bg-error-container/20 text-error border border-error-container/30'
                                    : 'bg-tertiary-container/15 text-tertiary-container border border-tertiary-container/20'}">
                            ${escapeHtml(String(l.status || "").toUpperCase())}
                        </span>
                    </td>
                    <td class="px-6 py-4">
                        ${isCustomer ? `
                            <div class="flex items-center gap-2">
                                <button class="px-2 py-1 rounded border border-outline-variant text-xs hover:text-primary" data-payment-loan="${escapeHtml(l.loanid)}">Payments</button>
                                <button class="px-2 py-1 rounded border border-outline-variant text-xs hover:text-primary" data-emi-loan="${escapeHtml(l.loanid)}">EMI</button>
                            </div>` : `
                            <button class="text-on-surface-variant hover:text-primary" data-id="${escapeHtml(l.loanid)}" title="Update loan status">
                                <span class="material-symbols-outlined">more_vert</span>
                            </button>`}
                    </td>
                </tr>`).join("");
        } catch (e) {
            showToast(e.message, "error");
        }
    }

    addButton?.addEventListener("click", async () => {
        let selectedCustomerId = customerId;

        if (!selectedCustomerId) {
            selectedCustomerId = prompt("Customer ID:", "1001");
            if (!selectedCustomerId) return;
        }

        const branchId = prompt("Branch ID:", "1");
        if (!branchId) return;

        const type = prompt(
            "Loan type (Home/Personal/Education/Business/Car):",
            "Personal"
        );
        if (!type) return;

        const rateId = prompt("Rate ID:", "5");
        if (!rateId) return;

        const principal = prompt("Principal amount:", "300000");
        if (!principal) return;

        const tenure = prompt("Tenure in months:", "36");
        if (!tenure) return;

        try {
            await apiRequest("/loans", {
                method: "POST",
                body: JSON.stringify({
                    customerId: Number(selectedCustomerId),
                    branchId: Number(branchId),
                    rateId: Number(rateId),
                    type,
                    principal: Number(principal),
                    tenure: Number(tenure),
                    status: "Applied"
                })
            });

            showToast("Loan application submitted");
            await load();
        } catch (e) {
            showToast(e.message, "error");
        }
    });

    if (isCustomer) {
        body?.addEventListener("click", async (e) => {
            const paymentButton = e.target.closest("button[data-payment-loan]");
            const emiButton = e.target.closest("button[data-emi-loan]");

            try {
                if (emiButton) {
                    const loanId = emiButton.dataset.emiLoan;
                    const r = await apiRequest(`/loans/${encodeURIComponent(loanId)}/emi?customerId=${encodeURIComponent(customerId)}`);
                    const emi = Number(r.data.emi).toFixed(2);
                    alert(`Loan #${loanId}\nPrincipal: ${money(r.data.principal)}\nRate: ${Number(r.data.rate).toFixed(2)}%\nTenure: ${r.data.tenure} months\nMonthly EMI: ${money(emi)}`);
                    return;
                }

                if (paymentButton) {
                    const loanId = paymentButton.dataset.paymentLoan;
                    let r = await apiRequest(`/loan-payments?customerId=${encodeURIComponent(customerId)}`);
                    let payments = (r.data || []).filter(p => String(p.loanid) === String(loanId));

                    if (!payments.length) {
                        const create = confirm(`No scheduled payments found for loan #${loanId}.\n\nGenerate the next payment using the PostgreSQL EMI function?`);
                        if (!create) return;

                        await apiRequest("/loan-payments/generate", {
                            method: "POST",
                            body: JSON.stringify({ loanId: Number(loanId), customerId: Number(customerId) })
                        });

                        showToast("Next loan payment generated");
                        r = await apiRequest(`/loan-payments?customerId=${encodeURIComponent(customerId)}`);
                        payments = (r.data || []).filter(p => String(p.loanid) === String(loanId));
                    }

                    const pending = payments.find(p => ["Pending", "Due", "Late", "Missed"].includes(p.status));
                    const summary = payments.map(p => `#${p.loanpaymentid} | ${p.status} | ${money(p.amount)} | Due ${p.duedate}`).join("\n");
                    if (!pending) {
                        alert(`Loan #${loanId} payments:\n\n${summary}`);
                        return;
                    }

                    const dueDate = new Date(pending.duedate);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    dueDate.setHours(0,0,0,0);

                    if (today < dueDate) {
                        const days = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                        alert(`Loan #${loanId}\nPayment #${pending.loanpaymentid}\nAmount: ${money(pending.amount)}\nDue: ${pending.duedate}\nStatus: ${pending.status}\n\nThis payment is not due yet. Please wait ${days} more day${days === 1 ? '' : 's'}.`);
                        return;
                    }

                    const payNow = confirm(`Loan #${loanId}\nPayment #${pending.loanpaymentid}\nAmount: ${money(pending.amount)}\nDue: ${pending.duedate}\nStatus: ${pending.status}\n\nMark this payment as PAID?`);
                    if (!payNow) return;

                    await apiRequest(`/loan-payments/${encodeURIComponent(pending.loanpaymentid)}/pay`, {
                        method: "PATCH",
                        body: JSON.stringify({ customerId: Number(customerId) })
                    });

                    showToast("Loan payment marked as paid");
                    return;
                }
            } catch (err) {
                showToast(err.message, "error");
            }
        });
    }

    if (!isCustomer) {
        body?.addEventListener("click", async (e) => {
            const b = e.target.closest("button[data-id]");
            if (!b) return;

            const status = prompt(
                "New status (Applied/Approved/Rejected/Active/Closed/Defaulted):",
                "Approved"
            );
            if (!status) return;

            try {
                await apiRequest(`/loans/${b.dataset.id}/status`, {
                    method: "PATCH",
                    body: JSON.stringify({ status })
                });
                showToast("Loan status updated");
                await load();
            } catch (err) {
                showToast(err.message, "error");
            }
        });
    }

    renderRoleView();
    await load();
});
