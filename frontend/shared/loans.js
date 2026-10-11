document.addEventListener("DOMContentLoaded", async () => {
    const body = document.querySelector("table tbody");
    const addButton = document.getElementById("loan-new-application") || [...document.querySelectorAll("button")].find(b => /add|new application|new loan/i.test(b.textContent));
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
    const isStaff = role === "Admin";
    const customerId = session?.user?.customerid ?? session?.user?.CustomerID ?? null;

    const money = value => formatMoney(value);
    const localDateString = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    function renderRoleView() {
        if (isCustomer) {
            if (title) title.textContent = "My Loans";
            if (subtitle) subtitle.textContent = "View your loan applications, payment schedule, and monthly EMI.";
            if (tableTitle) tableTitle.textContent = "My Loans";
            creditCheckButton?.remove();
            insightsSection?.remove();
            if (disbursedSubtitle) disbursedSubtitle.textContent = "Approved and active principal for your loans";
            if (activeSubtitle) activeSubtitle.textContent = "Approved or active loans for you";
            if (pendingSubtitle) pendingSubtitle.textContent = "Your applications awaiting review";
        } else {
            if (title) title.textContent = "Loan Management";
            if (subtitle) subtitle.textContent = "Review applications, assess repayments, and manage loan status.";
            if (tableTitle) tableTitle.textContent = "Loan Portfolio";
            if (disbursedSubtitle) disbursedSubtitle.textContent = "Based on approved and active loans";
            if (activeSubtitle) activeSubtitle.textContent = "Live count of active loans";
            if (pendingSubtitle) pendingSubtitle.textContent = "Applications awaiting review";
        }
    }

    function updateStats(loans) {
        const approvedOrActive = loans.filter(l => ["Approved", "Active"].includes(l.status));
        const active = isCustomer ? approvedOrActive.length : loans.filter(l => l.status === "Active").length;
        const pending = loans.filter(l => l.status === "Applied").length;
        const total = approvedOrActive.reduce((sum, l) => sum + Number(l.principal || 0), 0);
        if (totalDisbursed) totalDisbursed.textContent = money(total);
        if (activeCount) activeCount.textContent = String(active);
        if (pendingCount) pendingCount.textContent = String(pending);
        const pct = isCustomer ? Math.min(100, active * 100) : Math.min(100, active / 15000 * 100);
        if (activeBar) activeBar.style.width = `${pct}%`;
    }

    async function load() {
        try {
            if (isCustomer && !customerId) throw new Error("Customer session is missing. Please log in again.");
            const endpoint = isCustomer ? `/loans?customerId=${encodeURIComponent(customerId)}` : "/loans";
            const r = await apiRequest(endpoint);
            const loans = Array.isArray(r.data) ? r.data : [];
            updateStats(loans);
            if (tableCount) tableCount.textContent = isCustomer
                ? `Showing ${loans.length} loan${loans.length === 1 ? "" : "s"} for your account`
                : `Showing ${loans.length} loan${loans.length === 1 ? "" : "s"} in the database`;
            if (!body) return;
            if (!loans.length) {
                body.innerHTML = `<tr><td colspan="7" class="px-6 py-10 text-center text-on-surface-variant">${isCustomer ? "You do not have any loan records yet." : "No loans found in the database."}</td></tr>`;
                return;
            }
            body.innerHTML = loans.map(l => {
                const state = String(l.status || "");
                const statusClass = ["Approved", "Active"].includes(state) ? "bg-secondary/15 text-secondary border-secondary/20" : state === "Rejected" ? "bg-error-container/20 text-error border-error-container/30" : "bg-tertiary-container/15 text-tertiary-container border-tertiary-container/20";
                const actions = isCustomer
                    ? `<div class="flex flex-wrap items-center gap-2"><button type="button" class="nexus-inline-action" data-payment-loan="${escapeHtml(l.loanid)}" data-loan-status="${escapeHtml(l.status)}"><span class="material-symbols-outlined">event_note</span> Payments</button><button type="button" class="nexus-inline-action" data-emi-loan="${escapeHtml(l.loanid)}"><span class="material-symbols-outlined">calculate</span> EMI</button></div>`
                    : `<button type="button" class="nexus-icon-action" data-loan-status-id="${escapeHtml(l.loanid)}" data-current-status="${escapeHtml(state)}" title="Manage loan status" aria-label="Manage loan status"><span class="material-symbols-outlined">tune</span></button>`;
                return `<tr class="hover:bg-surface-container-high/40 transition-colors group">
                    <td class="px-6 py-4 font-mono-data text-primary">#${escapeHtml(l.loanid)}</td>
                    <td class="px-6 py-4"><div class="text-body-sm font-semibold">${escapeHtml(l.customername || "Customer")}</div><div class="text-[10px] text-on-surface-variant">${escapeHtml(l.type)} • ${escapeHtml(l.branchname || "Branch")}</div></td>
                    <td class="px-6 py-4 font-mono-data">${money(l.principal)}</td>
                    <td class="px-6 py-4 font-mono-data">${Number(l.rate || 0).toFixed(2)}%</td>
                    <td class="px-6 py-4 text-body-sm">${escapeHtml(l.tenure)} Months</td>
                    <td class="px-6 py-4"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusClass}">${escapeHtml(state.toUpperCase())}</span></td>
                    <td class="px-6 py-4">${actions}</td>
                </tr>`;
            }).join("");
        } catch (e) { showToast(e.message, "error"); }
    }

    async function loadLoanOptions() {
        if (isCustomer) {
            const r = await apiRequest("/loan-form-options");
            return { branches: r.branches || [], rates: r.rates || [] };
        }
        const [branchResult, customerResult, rateResult] = await Promise.all([
            apiRequest("/branches"), apiRequest("/customers"), apiRequest("/interest-rates")
        ]);
        return {
            branches: branchResult.data || [],
            customers: (customerResult.data || []).filter(c => String(c.status).toLowerCase() === "active"),
            rates: (rateResult.data || []).filter(r => String(r.ratetype).toLowerCase() === "loan")
        };
    }

    async function openLoanApplication() {
        if (isCustomer && !customerId) throw new Error("Your customer session is missing. Please log in again.");
        const options = await loadLoanOptions();
        const branches = options.branches || [];
        const rates = (options.rates || []).filter(r => String(r.ratetype || "Loan").toLowerCase() === "loan");
        const customers = options.customers || [];
        if (!branches.length) throw new Error("No branches are available to select.");
        if (!rates.length) throw new Error("No loan interest rates are available.");
        if (!isCustomer && !customers.length) throw new Error("Create an active customer before creating a loan.");

        const fields = [];
        if (!isCustomer) fields.push({ name: "customerId", label: "Customer", type: "select", required: true, placeholder: "Choose customer", options: customers.map(c => ({ value: c.customerid, label: `${c.name} (ID ${c.customerid})` })) });
        fields.push(
            { name: "branchId", label: "Branch", type: "select", required: true, placeholder: "Choose branch", options: branches.map(b => ({ value: b.branchid, label: `${b.branchname} (ID ${b.branchid})` })) },
            { name: "type", label: "Loan type", type: "select", required: true, value: "Personal", options: ["Home", "Personal", "Education", "Business", "Car"].map(x => ({ value: x, label: x })) },
            { name: "rateId", label: "Interest rate", type: "select", required: true, placeholder: "Choose loan rate", options: rates.map(r => ({ value: r.rateid, label: `${r.producttype} · ${Number(r.rate).toFixed(2)}% (Rate ID ${r.rateid})` })) },
            { name: "principal", label: "Principal amount (₹)", type: "number", min: "1", step: "0.01", required: true, placeholder: "e.g. 100000" },
            { name: "tenure", label: "Tenure (months)", type: "number", min: "1", max: "600", step: "1", required: true, value: "24" }
        );
        openNexusFormModal({
            title: isCustomer ? "Apply for a Loan" : "New Loan Application",
            description: isCustomer ? "Submit a loan request for review. Your customer identity is taken from the signed-in session." : "Create a loan application for an active customer using a valid branch and loan rate.",
            icon: "account_balance",
            submitLabel: "Submit Application",
            fields,
            onSubmit: async values => {
                const payload = {
                    customerId: Number(isCustomer ? customerId : values.customerId),
                    branchId: Number(values.branchId),
                    rateId: Number(values.rateId),
                    type: values.type,
                    principal: Number(values.principal),
                    tenure: Number(values.tenure),
                    status: "Applied"
                };
                if (!Number.isFinite(payload.principal) || payload.principal <= 0) throw new Error("Principal must be greater than zero");
                if (!Number.isInteger(payload.tenure) || payload.tenure <= 0) throw new Error("Tenure must be a positive number of months");
                const result = await apiRequest("/loans", { method: "POST", body: JSON.stringify(payload) });
                showToast(result.message || "Loan application submitted");
                await load();
            }
        });
    }

    async function openLoanStatusModal(loanId, currentStatus) {
        const statuses = ["Applied", "Approved", "Rejected", "Active", "Closed", "Defaulted"];
        openNexusFormModal({
            title: `Manage Loan #${loanId}`,
            description: "Select the new status. The change is validated and saved by the backend.",
            icon: "tune",
            submitLabel: "Update Status",
            fields: [{ name: "status", label: "Loan status", type: "select", required: true, value: currentStatus, options: statuses.map(s => ({ value: s, label: s })) }],
            onSubmit: async values => {
                await apiRequest(`/loans/${encodeURIComponent(loanId)}/status`, { method: "PATCH", body: JSON.stringify({ status: values.status }) });
                showToast(`Loan #${loanId} status changed to ${values.status}`);
                await load();
            }
        });
    }

    function dateOnly(value) { return String(value || "").slice(0, 10); }
    function paymentIsDue(value) { return dateOnly(value) <= localDateString(new Date()); }

    async function openLoanPayments(loanId, loanStatus = "Approved") {
        const r = await apiRequest(`/loan-payments?customerId=${encodeURIComponent(customerId)}`);
        const payments = (r.data || []).filter(p => String(p.loanid) === String(loanId));
        const unpaid = payments.filter(p => p.status !== "Paid");
        const canGenerate = ["Approved", "Active"].includes(loanStatus);
        const content = payments.length ? `<div class="nexus-payment-list">${payments.map(p => {
            const due = paymentIsDue(p.duedate);
            const paid = String(p.status).toLowerCase() === "paid";
            const badge = paid ? "nexus-status-good" : due ? "nexus-status-warn" : "nexus-status-muted";
            return `<article class="nexus-payment-item">
                <div class="nexus-payment-top"><div><p class="nexus-payment-title">Installment #${escapeHtml(p.loanpaymentid)}</p><p class="nexus-payment-meta">Due ${escapeHtml(formatDate(p.duedate))}</p></div><span class="nexus-status-pill ${badge}">${escapeHtml(p.status)}</span></div>
                <div class="nexus-payment-bottom"><strong>${money(p.amount)}</strong>${!paid && due ? `<button type="button" class="nexus-btn nexus-btn-primary" data-pay-loanpayment="${escapeHtml(p.loanpaymentid)}" data-payment-amount="${escapeHtml(p.amount)}" data-payment-due="${escapeHtml(dateOnly(p.duedate))}"><span class="material-symbols-outlined">payments</span> Pay Installment</button>` : !paid ? `<span class="nexus-payment-meta">Not due yet</span>` : `<span class="nexus-payment-meta">Paid ${escapeHtml(formatDate(p.paiddate))}</span>`}</div>
            </article>`;
        }).join("")}</div>` : `<div class="nexus-empty-panel"><span class="material-symbols-outlined">event_busy</span><h3>No scheduled installments</h3><p>${canGenerate ? "Generate the next installment using the PostgreSQL EMI function." : "Installments become available after the loan is approved or activated."}</p></div>`;
        const actions = [];
        if ((!payments.length || !unpaid.length) && canGenerate) actions.push({ label: "Generate Next Installment", icon: "add", variant: "primary", onClick: async ({ close }) => {
            await apiRequest("/loan-payments/generate", { method: "POST", body: JSON.stringify({ loanId: Number(loanId), customerId: Number(customerId) }) });
            close();
            showToast("Loan installment generated");
            await openLoanPayments(loanId, loanStatus);
            await load();
        }});
        actions.push({ label: "Close", close: true });
        const modal = window.openNexusInfoModal({ title: `Payments for Loan #${loanId}`, description: "Review installment dates and amounts. Payments can only be marked paid on or after the due date.", icon: "event_note", content, actions });
        modal.element.addEventListener("click", async event => {
            const button = event.target.closest("button[data-pay-loanpayment]");
            if (!button) return;
            button.disabled = true;
            const paymentId = button.dataset.payLoanpayment;
            const paymentAmount = Number(button.dataset.paymentAmount);
            try {
                const accountResult = await apiRequest(`/accounts?customerId=${encodeURIComponent(customerId)}`);
                const accounts = (accountResult.data || []).filter(a => String(a.status).toLowerCase() === "active");
                if (!accounts.length) throw new Error("You need an active account to pay this installment.");
                openNexusFormModal({
                    title: `Pay Installment #${paymentId}`,
                    description: `Loan #${loanId} · Due ${formatDate(button.dataset.paymentDue)}. Choose the account to debit. The installment amount is fixed by the loan schedule.`,
                    icon: "payments",
                    submitLabel: "Confirm Loan Payment",
                    fields: [
                        { name: "accountNo", label: "Pay from account", type: "select", required: true, placeholder: "Select an active account", options: accounts.map(a => ({ value: a.accountno, label: `A/C ${a.accountno} · ${a.holders || "Account holder"} · Available ${money(a.balance)}` })) },
                        { name: "amount", label: "Installment amount (₹)", type: "number", required: true, readOnly: true, value: paymentAmount.toFixed(2), help: "This amount comes from the scheduled loan installment." },
                        { name: "mode", label: "Payment method", type: "select", required: true, value: "Online", options: ["Online", "UPI", "NEFT", "IMPS", "RTGS", "Cash"].map(x => ({ value: x, label: x })) }
                    ],
                    onSubmit: async values => {
                        const selectedAccount = accounts.find(a => String(a.accountno) === String(values.accountNo));
                        if (!selectedAccount) throw new Error("Select a valid account.");
                        if (Number(selectedAccount.balance || 0) < paymentAmount) throw new Error("The selected account does not have enough balance for this installment.");
                        const paidResult = await apiRequest(`/loan-payments/${encodeURIComponent(paymentId)}/pay`, {
                            method: "PATCH",
                            body: JSON.stringify({ accountNo: Number(values.accountNo), mode: values.mode })
                        });
                        modal.close();
                        showToast(paidResult.message || "Loan installment paid successfully");
                        await load();
                        // Refresh balances and installment status when the customer reopens Payments.
                    }
                });
            } catch (error) {
                showToast(error.message, "error");
                button.disabled = false;
            }
        });
    }

    async function openEmiModal(loanId) {
        const r = await apiRequest(`/loans/${encodeURIComponent(loanId)}/emi?customerId=${encodeURIComponent(customerId)}`);
        const data = r.data;
        const content = `<div class="nexus-emi-hero"><span>Estimated monthly EMI</span><strong>${money(data.emi)}</strong><small>Calculated by the PostgreSQL fn_loan_emi() function</small></div>
            <div class="nexus-emi-grid"><div><span>Principal</span><strong>${money(data.principal)}</strong></div><div><span>Annual interest</span><strong>${Number(data.rate).toFixed(2)}%</strong></div><div><span>Tenure</span><strong>${escapeHtml(data.tenure)} months</strong></div><div><span>Loan ID</span><strong>#${escapeHtml(loanId)}</strong></div></div>`;
        openNexusInfoModal({ title: `EMI Details · Loan #${loanId}`, description: "Your installment estimate is calculated from the stored principal, interest rate, and tenure.", icon: "calculate", content, actions: [{ label: "Close" }] });
    }

    addButton?.addEventListener("click", async () => {
        try { await openLoanApplication(); }
        catch (error) { showToast(error.message || "Unable to open loan application", "error"); }
    });

    body?.addEventListener("click", async event => {
        const paymentButton = event.target.closest("button[data-payment-loan]");
        const emiButton = event.target.closest("button[data-emi-loan]");
        const statusButton = event.target.closest("button[data-loan-status-id]");
        try {
            if (paymentButton && isCustomer) await openLoanPayments(paymentButton.dataset.paymentLoan, paymentButton.dataset.loanStatus || "Applied");
            else if (emiButton && isCustomer) await openEmiModal(emiButton.dataset.emiLoan);
            else if (statusButton && isStaff) await openLoanStatusModal(statusButton.dataset.loanStatusId, statusButton.dataset.currentStatus || "Applied");
        } catch (error) { showToast(error.message || "Unable to open loan action", "error"); }
    });

    renderRoleView();
    await load();
});
