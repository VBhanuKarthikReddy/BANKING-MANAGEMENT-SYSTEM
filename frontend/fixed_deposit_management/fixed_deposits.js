let session = null;
let customerId = null;
let isStaff = false;

function money(v) {
  return Number(v || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
}

function dateText(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" });
}

function statusClass(status) {
  return status === "Active" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" :
         status === "Matured" ? "text-cyan-400 bg-cyan-400/10 border-cyan-400/30" :
         status === "Closed" ? "text-slate-300 bg-slate-700/30 border-slate-600" :
         "text-amber-400 bg-amber-400/10 border-amber-400/30";
}

async function loadLookups() {
  const result = await apiRequest("/fd-lookups");

  const branchSelect = document.getElementById("branchId");
  branchSelect.innerHTML = (result.branches || [])
    .map(b => `<option value="${b.branchid}">${escapeHtml(b.branchname)} (#${b.branchid})</option>`)
    .join("");

  const rateSelect = document.getElementById("rateId");
  rateSelect.innerHTML = (result.rates || [])
    .map(r => `<option value="${r.rateid}">${escapeHtml(r.producttype)} — ${Number(r.rate).toFixed(2)}%</option>`)
    .join("");

  if (!result.rates || result.rates.length === 0) {
    throw new Error("No active Fixed Deposit interest rate is configured");
  }
}

async function loadFDs() {
  const endpoint = isStaff ? "/fixed-deposits" : `/fixed-deposits?customerId=${encodeURIComponent(customerId)}`;
  const result = await apiRequest(endpoint);
  const rows = result.data || [];

  const totalPrincipal = rows.reduce((s, r) => s + Number(r.principal || 0), 0);
  const activeCount = rows.filter(r => r.status === "Active").length;
  const estimated = rows.reduce((s, r) => s + Number(r.estimatedmaturityamount || 0), 0);

  document.getElementById("totalPrincipal").textContent = money(totalPrincipal);
  document.getElementById("activeCount").textContent = String(activeCount);
  document.getElementById("estimatedMaturity").textContent = money(estimated);

  const body = document.getElementById("fdBody");
  const empty = document.getElementById("emptyState");
  empty.classList.toggle("hidden", rows.length > 0);

  body.innerHTML = rows.map(r => {
    const actions = isStaff ? `
      <select class="fd-status bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs" data-id="${r.fdid}">
        ${["Active","Matured","Closed","Premature"].map(s => `<option ${r.status === s ? "selected" : ""}>${s}</option>`).join("")}
      </select>` : `<span class="text-slate-500 text-xs">View only</span>`;
    return `
      <tr class="border-t border-slate-800 hover:bg-slate-800/40">
        <td class="p-4 font-mono">#${r.fdid}</td>
        <td class="p-4">${escapeHtml(r.customername)}</td>
        <td class="p-4">${escapeHtml(r.branchname)}</td>
        <td class="p-4">${money(r.principal)}</td>
        <td class="p-4">${Number(r.rate).toFixed(2)}%</td>
        <td class="p-4">${dateText(r.startdate)}</td>
        <td class="p-4">${dateText(r.maturitydate)}</td>
        <td class="p-4 font-semibold">${money(r.estimatedmaturityamount)}</td>
        <td class="p-4"><span class="px-2 py-1 rounded-full border text-xs ${statusClass(r.status)}">${escapeHtml(r.status)}</span></td>
        <td class="p-4">${actions}</td>
      </tr>`;
  }).join("");

  if (isStaff) {
    document.querySelectorAll(".fd-status").forEach(select => {
      select.addEventListener("change", async () => {
        const nextStatus = select.value;
        const fdId = select.dataset.id;
        await loadFDs(); // restore the displayed status until the action is confirmed
        window.openNexusFormModal({
          title: `Update Fixed Deposit #${fdId}`,
          description: "Confirm the new fixed-deposit status. This change is recorded in PostgreSQL.",
          icon: "savings",
          submitLabel: "Update Status",
          fields: [{ name: "status", label: "Fixed-deposit status", type: "select", required: true, value: nextStatus, options: ["Active", "Matured", "Closed", "Premature"].map(x => ({ value: x, label: x })) }],
          onSubmit: async values => {
            await apiRequest(`/fixed-deposits/${encodeURIComponent(fdId)}/status`, {
              method: "PATCH",
              body: JSON.stringify({ status: values.status })
            });
            showToast("Fixed-deposit status updated");
            await loadFDs();
          }
        });
      });
    });
  }
}

async function createFD(event) {
  event.preventDefault();
  const payload = {
    customerId: isStaff ? document.getElementById("customerId").value : customerId,
    branchId: document.getElementById("branchId").value,
    rateId: Number(document.getElementById("rateId").value),
    principal: document.getElementById("principal").value,
    months: document.getElementById("months").value,
    startDate: document.getElementById("startDate").value || undefined
  };

  try {
    console.log("Creating FD with payload:", payload);
    const result = await apiRequest("/fixed-deposits", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showToast(`Fixed deposit #${result.data.fdid} created`);
    closeModal();
    event.target.reset();
    await loadFDs();
  } catch (e) {
    showToast(e.message, "error");
  }
}

function openModal() {
  const m = document.getElementById("fdModal");
  m.classList.remove("hidden");
  m.classList.add("flex");
}
function closeModal() {
  const m = document.getElementById("fdModal");
  m.classList.add("hidden");
  m.classList.remove("flex");
}

(async function init() {
  try {
    session = getSession();
    if (!session || !session.user) {
      window.location.href = "/login/code.html";
      return;
    }
    isStaff = ["Admin"].includes(session.role);
    customerId = session.user.customerid || session.user.customerid;

    document.getElementById("userBadge").textContent = `${session.user.name} · ${session.role}`;
    document.getElementById("staffCustomerWrap").classList.toggle("hidden", !isStaff);
    document.getElementById("pageTitle").textContent = isStaff ? "Fixed Deposit Management" : "My Fixed Deposits";
    document.getElementById("tableTitle").textContent = isStaff ? "All Fixed Deposits" : "My Fixed Deposits";
    document.getElementById("pageSubtitle").textContent = isStaff ? "Review fixed deposits across customers and manage status." : "View your fixed deposits, maturity values and status.";

    document.getElementById("startDate").value = new Date().toISOString().slice(0,10);
    document.getElementById("newFdBtn").addEventListener("click", openModal);
    document.getElementById("closeModal").addEventListener("click", closeModal);
    document.getElementById("cancelModal").addEventListener("click", closeModal);
    document.getElementById("fdForm").addEventListener("submit", createFD);
    document.getElementById("refreshBtn").addEventListener("click", loadFDs);

    await loadLookups();
    await loadFDs();
  } catch (e) {
    showToast(e.message, "error");
  }
})();
