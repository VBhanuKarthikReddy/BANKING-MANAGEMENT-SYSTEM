document.addEventListener("DOMContentLoaded", async () => {
    const form=document.querySelector("form");
    const amountInput=form?.querySelector('input[type="number"]');
    const transferButton=[...document.querySelectorAll("form button")].find(b=>b.textContent.includes("Authorize Transfer"));
    const beneficiarySelect=form?.querySelector("#beneficiarySelect");
    const search=document.querySelector('input[placeholder="Search transactions, accounts..."]');
    const accountNoFromQuery=new URLSearchParams(location.search).get("accountNo");
    const session=getSession();
    const customerId=session?.role === "Customer" ? session?.user?.customerid : null;

    if(!form || !transferButton) return;

    // Add a source-account selector without redesigning the page.
    const firstField=form.querySelector(".space-y-2.group");
    const sourceWrap=document.createElement("div");
    sourceWrap.className="space-y-2 group";
    sourceWrap.innerHTML=`<label class="font-label-caps text-label-caps text-on-surface-variant block ml-1">From Account</label><select id="sourceAccount" class="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-on-surface"><option>Loading...</option></select>`;
    firstField?.parentElement?.insertBefore(sourceWrap, firstField);
    const sourceSelect=sourceWrap.querySelector("select");

    async function loadAccounts(){
        const query=new URLSearchParams();
        if(customerId) query.set("customerId", customerId);
        const r=await apiRequest(`/accounts${query.toString() ? "?" + query.toString() : ""}`);
        const active=r.data.filter(a=>a.status==='Active');
        sourceSelect.innerHTML=active.map(a=>`<option value="${a.accountno}" ${String(a.accountno)===String(accountNoFromQuery)?'selected':''}>${a.accountno} — ${escapeHtml(a.holders)} — ${formatMoney(a.balance)}</option>`).join("") || '<option>No active accounts</option>';
    }
    async function loadBeneficiaries(){
        const query=new URLSearchParams();
        if(customerId) query.set("customerId", customerId);
        const r=await apiRequest(`/beneficiaries${query.toString() ? "?" + query.toString() : ""}`);
        beneficiarySelect.innerHTML='<option value="">Choose a beneficiary...</option>'+r.data.filter(b=>b.status==='Active').map(b=>`<option value="${b.beneficiaryaccountno}">${escapeHtml(b.name)} (AC: ${b.beneficiaryaccountno})</option>`).join("");
    }
    async function loadHistory(){
        const q=new URLSearchParams();
        if(search?.value.trim()) q.set("search",search.value.trim());
        if(accountNoFromQuery) q.set("accountNo",accountNoFromQuery);
        if(customerId) q.set("customerId",customerId);
        try{
            const r=await apiRequest(`/transactions?${q.toString()}`);
            const body=document.querySelector("table tbody");
            if(!body)return;
            body.innerHTML=r.data.slice(0,10).map(t=>`<tr><td class="px-6 py-4 font-mono-data">#${t.transactionid}</td><td class="px-6 py-4">${t.accountno}</td><td class="px-6 py-4">${escapeHtml(t.type)}</td><td class="px-6 py-4">${formatMoney(t.amount)}</td><td class="px-6 py-4">${formatDateTime(t.datetime)}</td><td class="px-6 py-4">${escapeHtml(t.mode)}</td><td class="px-6 py-4">${escapeHtml(t.status)}</td></tr>`).join("");
        }catch(e){showToast(e.message,"error");}
    }

    form.querySelectorAll("form .flex.bg-surface-container-low button").forEach(b=>b.addEventListener("click",()=>{}));
    transferButton.addEventListener("click",async()=>{
        const toAccount=beneficiarySelect.value;
        const fromAccount=sourceSelect.value;
        const amount=Number(amountInput.value);
        const activeType=[...form.querySelectorAll("button")].filter(b=>["IMPS","NEFT","RTGS"].includes(b.textContent.trim())).find(b=>b.classList.contains("bg-secondary-container"))?.textContent.trim() || "IMPS";
        if(!toAccount||!fromAccount||!amount||amount<=0){showToast("Choose source, beneficiary and a valid amount","error");return;}
        transferButton.disabled=true;
        try{
            await apiRequest("/transfers",{method:"POST",body:JSON.stringify({fromAccount,toAccount,amount,mode:activeType,customerId})});
            showToast("Transfer successful");
            amountInput.value="";
            await loadAccounts();
            await loadHistory();
        }catch(e){showToast(e.message,"error");}
        finally{transferButton.disabled=false;}
    });
    search?.addEventListener("input",loadHistory);

    try{await loadAccounts();await loadBeneficiaries();await loadHistory();}catch(e){showToast(e.message,"error");}
});
