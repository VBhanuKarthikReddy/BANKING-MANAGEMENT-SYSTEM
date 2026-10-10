document.addEventListener("DOMContentLoaded", async () => {
    const body = document.querySelector("table tbody");
    const search = document.querySelector('input[placeholder="Filter by branch code or manager..."]');
    const addButton = [...document.querySelectorAll("button")].find(b => b.textContent.includes("Add New Branch"));
    const branchCache = new Map();

    async function load() {
        try {
            const q = search?.value.trim() ? `?search=${encodeURIComponent(search.value.trim())}` : "";
            const result = await apiRequest(`/branches${q}`);
            branchCache.clear();
            document.getElementById("branchCountLabel")?.replaceChildren(document.createTextNode(`${result.data.length.toLocaleString()} branch${result.data.length === 1 ? "" : "es"}`));
            result.data.forEach(b => branchCache.set(String(b.branchid), b));

            body.innerHTML = result.data.map(b => `<tr class="hover:bg-surface-bright/20 transition-colors group">
                <td class="px-6 py-5"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded bg-primary-container/20 flex items-center justify-center text-primary"><span class="material-symbols-outlined">store</span></div><div><p class="font-body-lg text-body-lg font-semibold text-primary">${escapeHtml(b.branchname)}</p><p class="font-mono-data text-mono-data text-on-surface-variant">${escapeHtml(b.branchcode)}</p></div></div></td>
                <td class="px-6 py-5"><p class="font-body-sm text-body-sm text-on-surface">${escapeHtml(b.address || "")}</p><p class="text-[11px] text-on-surface-variant uppercase tracking-widest">IFSC: ${escapeHtml(b.ifsc || "")}</p></td>
                <td class="px-6 py-5 text-on-surface">${escapeHtml(b.manager || "Not assigned")}</td>
                <td class="px-6 py-5"><p class="font-mono-data text-mono-data text-primary-fixed-dim">${formatMoney(b.totaldeposits || 0)}</p></td>
                <td class="px-6 py-5"><span class="px-3 py-1 rounded-full bg-secondary-container/15 text-secondary text-[11px] font-bold border border-secondary/20">${escapeHtml(b.displaystatus || "Active")}</span></td>
                <td class="px-6 py-5 text-right flex justify-end gap-1">
                    <button class="p-2 hover:bg-surface-container-high rounded-lg" data-id="${b.branchid}" data-action="edit" title="Edit branch">
                        <span class="material-symbols-outlined">edit</span>
                    </button>
                    <button class="p-2 hover:bg-surface-container-high rounded-lg text-error" data-id="${b.branchid}" data-action="delete" title="Delete branch">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </td>
            </tr>`).join("");
        } catch(e){ showToast(e.message,"error"); }
    }

    search?.addEventListener("input", load);

    addButton?.addEventListener("click", async () => {
        const branchCode=prompt("Branch code:"); if(!branchCode)return;
        const branchName=prompt("Branch name:"); if(!branchName)return;
        const ifsc=prompt("IFSC:"); if(!ifsc)return;
        const address=prompt("Address:"); if(!address)return;
        const phone=prompt("Phone:"); if(!phone)return;
        try{
            await apiRequest("/branches",{method:"POST",body:JSON.stringify({branchCode,branchName,ifsc,address,phone})});
            showToast("Branch created");
            await load();
        } catch(e){showToast(e.message,"error");}
    });

    body?.addEventListener("click", async e => {
        const btn=e.target.closest("button[data-action]");
        if(!btn) return;

        const id=String(btn.dataset.id);
        const branch=branchCache.get(id);
        if(!branch) return;

        if(btn.dataset.action === "edit") {
            const branchCode=prompt("Branch code:", branch.branchcode || ""); if(branchCode===null)return;
            const branchName=prompt("Branch name:", branch.branchname || ""); if(branchName===null)return;
            const ifsc=prompt("IFSC:", branch.ifsc || ""); if(ifsc===null)return;
            const address=prompt("Address:", branch.address || ""); if(address===null)return;
            const phone=prompt("Phone:", branch.phone || ""); if(phone===null)return;
            try {
                await apiRequest(`/branches/${id}`, {
                    method:"PUT",
                    body:JSON.stringify({branchCode,branchName,ifsc,address,phone})
                });
                showToast("Branch updated");
                await load();
            } catch(e) {
                showToast(e.message,"error");
            }
        }

        if(btn.dataset.action === "delete") {
            if(!confirm(`Delete branch ${branch.branchname} (${branch.branchcode})?`)) return;
            try {
                await apiRequest(`/branches/${id}`, {method:"DELETE"});
                showToast("Branch deleted");
                await load();
            } catch(e) {
                showToast(e.message,"error");
            }
        }
    });

    load();
});
