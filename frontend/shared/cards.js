document.addEventListener("DOMContentLoaded", async () => {
    const body = document.querySelector("table tbody");
    const search = document.querySelector('header input[type="text"], input[placeholder*="Search cards"]');
    const statusFilter = document.querySelector("select");
    const session = getSession();
    const isCustomer = session?.role === "Customer";
    const isStaff = ["Admin"].includes(session?.role);
    const customerId = isCustomer ? (session?.user?.customerid ?? session?.user?.CustomerID) : null;
    const heading = document.getElementById("cardsPageTitle");
    const subtitle = document.getElementById("cardsPageSubtitle");
    const tableTitle = document.getElementById("cardsTableTitle");
    const issueButton = document.getElementById("issueCardButton");
    let allCards = [];

    function render() {
        const q = String(search?.value || "").trim().toLowerCase();
        const wanted = statusFilter?.value || "All Status";
        const cards = allCards.filter(c => {
            const hay = `${c.customername || ""} ${c.maskedcardno || ""} ${c.cardtype || ""}`.toLowerCase();
            return (!q || hay.includes(q)) && (wanted === "All Status" || c.status === wanted);
        });

        body.innerHTML = cards.length ? cards.map(c => {
            const isDebit = c.cardtype === "DEBIT";
            const canToggle = isStaff && (c.status === "Active" || c.status === "Blocked");
            return `<tr class="hover:bg-surface-container-high/40 transition-colors">
                <td class="px-6 py-5"><div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold">${escapeHtml((c.customername || "U").split(" ").map(x => x[0]).slice(0,2).join(""))}</div>
                    <div><p class="font-bold text-on-surface">${escapeHtml(c.customername || "Unknown")}</p><p class="text-xs text-on-surface-variant">${isDebit ? "Debit" : "Credit"} Card</p></div>
                </div></td>
                <td class="px-6 py-5 font-mono-data text-on-surface">${escapeHtml(c.maskedcardno)}</td>
                <td class="px-6 py-5"><span class="inline-flex items-center gap-2 text-sm"><span class="material-symbols-outlined text-on-surface-variant">credit_card</span>${isDebit ? "Debit" : "Credit"}</span></td>
                <td class="px-6 py-5 font-mono-data text-sm">${formatDate(c.expirydate)}</td>
                <td class="px-6 py-5"><span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${c.status === "Active" ? "bg-secondary/15 text-secondary border border-secondary/30" : c.status === "Blocked" ? "bg-error/15 text-error border border-error/30" : "bg-outline-variant/15 text-on-surface-variant border border-outline-variant/30"}">${escapeHtml(c.status)}</span></td>
                <td class="px-6 py-5 text-right">${canToggle ? `<button data-kind="${isDebit ? "debit" : "credit"}" data-id="${c.cardid}" data-status="${c.status}" class="p-2 hover:bg-surface-container-highest rounded-lg" title="${c.status === "Active" ? "Block card" : "Unblock card"}"><span class="material-symbols-outlined">${c.status === "Blocked" ? "lock_open" : "block"}</span></button>` : `<span class="text-xs text-on-surface-variant">View only</span>`}</td>
            </tr>`;
        }).join("") : `<tr><td colspan="6" class="px-6 py-14 text-center text-on-surface-variant">${isCustomer ? "You don't have any cards matching this filter." : "No cards match this filter."}</td></tr>`;

        const active = cards.filter(c => c.status === "Active").length;
        const blocked = cards.filter(c => c.status === "Blocked").length;
        document.getElementById("activeCardCount")?.replaceChildren(document.createTextNode(active.toLocaleString()));
        document.getElementById("blockedCardCount")?.replaceChildren(document.createTextNode(blocked.toLocaleString()));
        document.getElementById("cardCountLabel")?.replaceChildren(document.createTextNode(`${cards.length.toLocaleString()} card${cards.length === 1 ? "" : "s"}`));
    }

    async function load() {
        try {
            const params = customerId ? `?customerId=${encodeURIComponent(customerId)}` : "";
            const r = await apiRequest(`/cards${params}`);
            allCards = r.data || [];
            render();
        } catch (e) { showToast(e.message, "error"); }
    }

    if (heading) heading.textContent = isCustomer ? "My Cards" : "Card Management";
    if (subtitle) subtitle.textContent = isCustomer ? "View your debit and credit cards, expiry dates, and current security status." : "Manage debit and credit cards, status controls, and customer card security.";
    if (tableTitle) tableTitle.textContent = isCustomer ? "My Card Registry" : "Card Registry";
    if (issueButton) issueButton.classList.toggle("hidden", isCustomer);
    search?.addEventListener("input", render);
    statusFilter?.addEventListener("change", render);


    issueButton?.addEventListener("click", async () => {
        if (!isStaff) return showToast("Staff access required to issue a card", "error");
        try {
            const [customerResult, accountResult] = await Promise.all([
                apiRequest("/customers"),
                apiRequest("/accounts")
            ]);
            const activeCustomers = (customerResult.data || []).filter(c => String(c.status).toLowerCase() === "active");
            const activeAccounts = (accountResult.data || []).filter(a => String(a.status).toLowerCase() === "active");
            if (!activeCustomers.length) return showToast("Create an active customer before issuing a card", "error");
            if (!activeAccounts.length) return showToast("Create an active account before issuing a debit card", "error");

            const customerOptions = activeCustomers.map(c => ({ value: c.customerid, label: `${c.name} (ID ${c.customerid})` }));
            const accountOptions = activeAccounts.map(a => ({ value: a.accountno, label: `Account ${a.accountno} · ${a.holders || "Account holder"} · ${formatMoney(a.balance || 0)}` }));
            const expiry = new Date();
            expiry.setFullYear(expiry.getFullYear() + 4);
            const expiryDate = `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, "0")}-${String(expiry.getDate()).padStart(2, "0")}`;

            openNexusFormModal({
                title: "Issue New Card",
                description: "Create a debit card linked to an active account or a credit card for a customer.",
                icon: "credit_card",
                submitLabel: "Issue Card",
                fields: [
                    { name: "cardType", label: "Card type", type: "select", required: true, value: "DEBIT", options: [
                        { value: "DEBIT", label: "Debit card" }, { value: "CREDIT", label: "Credit card" }
                    ] },
                    { name: "accountNo", label: "Linked account", type: "select", required: true, placeholder: "Select an active account", options: accountOptions, wide: true, visibleWhen: { field: "cardType", value: "DEBIT" }, help: "Debit cards are associated with the account's primary holder." },
                    { name: "customerId", label: "Cardholder", type: "select", required: true, placeholder: "Select a customer", options: customerOptions, wide: true, visibleWhen: { field: "cardType", value: "CREDIT" } },
                    { name: "creditLimit", label: "Credit limit (₹)", type: "number", min: "1", step: "0.01", required: true, placeholder: "e.g. 50000", visibleWhen: { field: "cardType", value: "CREDIT" }, help: "Outstanding starts at ₹0.00." },
                    { name: "expiryDate", label: "Expiry date", type: "date", required: true, value: expiryDate, wide: true, help: "The issue date is set automatically to today." }
                ],
                onSubmit: async (values) => {
                    const payload = {
                        cardType: values.cardType,
                        expiryDate: values.expiryDate
                    };
                    if (values.cardType === "DEBIT") {
                        payload.accountNo = Number(values.accountNo);
                    } else {
                        payload.customerId = Number(values.customerId);
                        payload.creditLimit = Number(values.creditLimit);
                    }
                    const result = await apiRequest("/cards", { method: "POST", body: JSON.stringify(payload) });
                    showToast(result.message || "Card issued successfully");
                    await load();
                }
            });
        } catch (error) {
            showToast(error.message || "Unable to load card form", "error");
        }
    });

    body?.addEventListener("click", async (e) => {
        const b = e.target.closest("button[data-id]");
        if (!b) return;
        if (!isStaff) return;
        const endpoint = b.dataset.kind === "debit" ? `/cards/debit/${b.dataset.id}/status` : `/cards/credit/${b.dataset.id}/status`;
        const status = b.dataset.status === "Active" ? "Blocked" : "Active";
        const card = allCards.find(c => String(c.cardid) === String(b.dataset.id) && c.cardtype === (b.dataset.kind === "debit" ? "DEBIT" : "CREDIT"));
        window.openNexusInfoModal({
            title: `${status === "Blocked" ? "Block" : "Unblock"} card?`,
            description: "This updates the card status in PostgreSQL.",
            icon: status === "Blocked" ? "block" : "lock_open",
            content: `<p>${status === "Blocked" ? "Block" : "Restore access to"} the ${escapeHtml(b.dataset.kind)} card <strong>${escapeHtml(card?.maskedcardno || `#${b.dataset.id}`)}</strong> for ${escapeHtml(card?.customername || "this customer")}?</p>`,
            actions: [
                { label: "Cancel" },
                { label: status === "Blocked" ? "Block Card" : "Unblock Card", variant: status === "Blocked" ? "danger" : "primary", icon: status === "Blocked" ? "block" : "lock_open", onClick: async () => {
                    await apiRequest(endpoint, { method: "PATCH", body: JSON.stringify({ status }) });
                    showToast(`Card ${status.toLowerCase()}`);
                    await load();
                }}
            ]
        });
    });

    await load();
});
