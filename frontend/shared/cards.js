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

    body?.addEventListener("click", async (e) => {
        const b = e.target.closest("button[data-id]");
        if (!b) return;
        if (!isStaff) return;
        const endpoint = b.dataset.kind === "debit" ? `/cards/debit/${b.dataset.id}/status` : `/cards/credit/${b.dataset.id}/status`;
        const status = b.dataset.status === "Active" ? "Blocked" : "Active";
        try {
            await apiRequest(endpoint, { method: "PATCH", body: JSON.stringify({ status }) });
            showToast(`Card ${status.toLowerCase()}`);
            await load();
        } catch (err) { showToast(err.message, "error"); }
    });

    await load();
});
