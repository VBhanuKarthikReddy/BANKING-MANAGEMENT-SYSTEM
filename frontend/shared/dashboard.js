document.addEventListener("DOMContentLoaded", async () => {
    try {
        const r = await apiRequest("/dashboard");
        const summary = r.summary || {};

        // ---------- KPI cards ----------
        const numbers = [...document.querySelectorAll("h3.font-mono-data")];
        if (numbers[0]) numbers[0].textContent = Number(summary.customers || 0).toLocaleString();
        if (numbers[1]) numbers[1].textContent = Number(summary.accounts || 0).toLocaleString();
        if (numbers[2]) numbers[2].textContent = formatMoney(summary.total_deposits || 0);
        if (numbers[3]) numbers[3].textContent = formatMoney(summary.total_loan_principal || 0);

        // Replace demo trend percentages with a neutral live-data label.
        document.querySelectorAll(".dashboard-demo-trend").forEach(el => {
            el.textContent = "Live DB";
        });

        // ---------- Live monthly transaction chart ----------
        const chartBars = [...document.querySelectorAll("[data-dashboard-month-bar]")];
        if (chartBars.length) {
            const rows = (r.monthlyTransactions || []).slice(-chartBars.length);
            const max = Math.max(...rows.map(x => Number(x.transaction_count || 0)), 1);

            chartBars.forEach((bar, i) => {
                const row = rows[i];
                const value = row ? Number(row.transaction_count || 0) : 0;
                const pct = Math.max(value === 0 ? 2 : Math.round((value / max) * 100), 2);
                bar.style.height = `${pct}%`;

                const tip = bar.querySelector("[data-dashboard-value]");
                if (tip) tip.textContent = value.toLocaleString();

                const label = bar.closest("div.flex-1")?.querySelector("[data-dashboard-label]");
                if (label) label.textContent = row ? formatMonth(row.month) : "—";
            });
        }

        // ---------- Live branch deposit chart ----------
        const branchRows = r.branchDeposits || [];
        const totalBranchDeposits = branchRows.reduce((sum, x) => sum + Number(x.totaldeposits || 0), 0);
        const branchChart = document.querySelector("[data-dashboard-branch-chart]");
        const branchLegend = document.querySelector("[data-dashboard-branch-legend]");

        if (branchChart && totalBranchDeposits > 0) {
            const palette = [
                "var(--color-primary-container)",
                "var(--color-secondary)",
                "var(--color-tertiary-fixed)",
                "var(--color-surface-container-highest)"
            ];
            let cursor = 0;
            const stops = [];
            const top = branchRows
                .map(x => ({ name: x.branchname, value: Number(x.totaldeposits || 0) }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 4);

            top.forEach((row, i) => {
                const share = (row.value / totalBranchDeposits) * 100;
                const color = palette[i] || palette[3];
                stops.push(`${color} ${cursor}% ${cursor + share}%`);
                cursor += share;
            });
            if (cursor < 100) stops.push(`var(--color-surface-container-highest) ${cursor}% 100%`);
            branchChart.style.background = `conic-gradient(${stops.join(", ")})`;

            if (branchLegend) {
                branchLegend.innerHTML = top.map((row, i) => {
                    const pct = ((row.value / totalBranchDeposits) * 100).toFixed(1);
                    const safeName = escapeHtml(row.name || "Branch");
                    return `<div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full" style="background:${palette[i] || palette[3]}"></span>
                        <span class="text-[10px] text-on-surface-variant font-medium">${safeName} (${pct}%)</span>
                    </div>`;
                }).join("");
            }

            const centerLabel = document.querySelector("[data-dashboard-branch-center]");
            if (centerLabel && top[0]) {
                centerLabel.innerHTML = `<p class="text-on-surface-variant text-[10px] font-label-caps">TOP BRANCH</p>
                    <p class="text-primary font-headline-md leading-tight">${escapeHtml(top[0].name)}</p>`;
            }
        }

        // ---------- Recent transactions ----------
        const tbody = document.querySelector("[data-dashboard-recent-body]");
        if (tbody) {
            tbody.innerHTML = (r.recentTransactions || []).map(t => `
                <tr class="border-b border-outline-variant/30 hover:bg-surface-variant/20">
                    <td class="px-6 py-4 font-mono-data text-body-sm text-on-surface">#${escapeHtml(t.transactionid)}</td>
                    <td class="px-6 py-4 text-body-sm text-on-surface">${escapeHtml(t.customername || "—")}</td>
                    <td class="px-6 py-4 text-body-sm text-on-surface-variant">${escapeHtml(t.type || "—")}</td>
                    <td class="px-6 py-4 text-body-sm text-on-surface-variant">${escapeHtml(t.branchname || "—")}</td>
                    <td class="px-6 py-4 font-mono-data text-body-sm text-primary font-bold">${formatMoney(t.amount || 0)}</td>
                    <td class="px-6 py-4 text-body-sm">${escapeHtml(t.status || "—")}</td>
                </tr>
            `).join("");
        }

        // ---------- Live-data label ----------
        const title = document.querySelector("h1") || document.querySelector("h2");
        if (title && !document.getElementById("liveDbSummary")) {
            const p = document.createElement("p");
            p.id = "liveDbSummary";
            p.className = "text-xs text-secondary mt-2";
            p.textContent = `PostgreSQL live data: ${Number(summary.transactions || 0).toLocaleString()} transactions • ${Number(summary.active_loans || 0).toLocaleString()} active/approved loans`;
            title.parentElement.appendChild(p);
        }
    } catch (e) {
        showToast(e.message, "error");
    }
});

function formatMonth(value) {
    const d = new Date(`${value}-01T00:00:00`);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString("en-US", { month: "short" }).toUpperCase();
}
