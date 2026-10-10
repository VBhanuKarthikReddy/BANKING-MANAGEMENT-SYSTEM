document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const submit = form?.querySelector('button[type="submit"]');

    document.querySelectorAll(".role-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            document.querySelectorAll(".role-chip").forEach((c) => c.classList.remove("active"));
            chip.classList.add("active");
        });
    });

    const passwordButton = password?.parentElement?.querySelector("button");
    passwordButton?.addEventListener("click", () => {
        const icon = passwordButton.querySelector(".material-symbols-outlined");
        password.type = password.type === "password" ? "text" : "password";
        if (icon) icon.textContent = password.type === "password" ? "visibility" : "visibility_off";
    });

    form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const activeRole = document.querySelector(".role-chip.active");
        const role = activeRole?.dataset.role || "Admin";
        const id = username.value.trim();

        if (!id || !password.value.trim()) {
            showToast("Enter your ID and password", "error");
            return;
        }

        const original = submit.innerHTML;
        submit.disabled = true;
        submit.innerHTML = '<span class="material-symbols-outlined animate-spin">refresh</span> Authenticating...';

        try {
            // The selected role is validated against the actual database role.
            const result = await apiRequest("/login", {
                method: "POST",
                body: JSON.stringify({ role, id: Number(id) || id, password: password.value })
            });

            saveSession(result);
            submit.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Access Granted';
            await new Promise(r => setTimeout(r, 400));
            window.location.href = result.role === "Customer"
                ? "../customer_dashboard/code.html"
                : "../admin_dashboard/code.html";
        } catch (error) {
            submit.disabled = false;
            submit.innerHTML = original;
            showToast(error.message, "error");
        }
    });
});
