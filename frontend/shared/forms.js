/* Shared modal form UI used by staff create flows. */
(function () {
    const esc = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    window.openNexusFormModal = function ({
        title,
        description = "Enter the details below.",
        icon = "edit_note",
        submitLabel = "Save",
        fields = [],
        onSubmit
    }) {
        document.getElementById("nexusFormModalBackdrop")?.remove();

        const backdrop = document.createElement("div");
        backdrop.id = "nexusFormModalBackdrop";
        backdrop.className = "nexus-modal-backdrop";
        backdrop.innerHTML = `
            <section class="nexus-modal" role="dialog" aria-modal="true" aria-labelledby="nexusFormModalTitle">
                <header class="nexus-modal-header">
                    <div class="nexus-modal-heading-icon"><span class="material-symbols-outlined">${esc(icon)}</span></div>
                    <div class="nexus-modal-heading-copy">
                        <h2 id="nexusFormModalTitle">${esc(title)}</h2>
                        <p>${esc(description)}</p>
                    </div>
                    <button type="button" class="nexus-modal-close" data-modal-close aria-label="Close form"><span class="material-symbols-outlined">close</span></button>
                </header>
                <form class="nexus-modal-form" novalidate>
                    <div class="nexus-modal-grid">
                        ${fields.map((field) => {
                            const name = esc(field.name);
                            const type = field.type || "text";
                            const required = field.required ? "required" : "";
                            const wide = field.wide ? "nexus-field-wide" : "";
                            const hiddenWhen = field.visibleWhen || null;
                            const visibilityAttrs = hiddenWhen
                                ? `data-show-field="${esc(hiddenWhen.field)}" data-show-value="${esc(hiddenWhen.value)}"`
                                : "";
                            let control = "";
                            if (type === "select") {
                                const options = (field.options || []).map((option) => {
                                    const optionValue = typeof option === "object" ? option.value : option;
                                    const optionLabel = typeof option === "object" ? option.label : option;
                                    const selected = String(optionValue) === String(field.value ?? "") ? "selected" : "";
                                    return `<option value="${esc(optionValue)}" ${selected}>${esc(optionLabel)}</option>`;
                                }).join("");
                                control = `<select name="${name}" id="nexus-field-${name}" ${required}>
                                    ${field.placeholder ? `<option value="">${esc(field.placeholder)}</option>` : ""}
                                    ${options}
                                </select>`;
                            } else if (type === "textarea") {
                                control = `<textarea name="${name}" id="nexus-field-${name}" rows="${Number(field.rows || 3)}" placeholder="${esc(field.placeholder || "")}" ${required}>${esc(field.value || "")}</textarea>`;
                            } else {
                                const attrs = [
                                    `type="${esc(type)}"`,
                                    `name="${name}"`,
                                    `id="nexus-field-${name}"`,
                                    `placeholder="${esc(field.placeholder || "")}"`,
                                    field.value != null ? `value="${esc(field.value)}"` : "",
                                    field.min != null ? `min="${esc(field.min)}"` : "",
                                    field.max != null ? `max="${esc(field.max)}"` : "",
                                    field.step != null ? `step="${esc(field.step)}"` : "",
                                    field.autocomplete ? `autocomplete="${esc(field.autocomplete)}"` : "",
                                    field.readOnly ? "readonly" : "",
                                    required
                                ].filter(Boolean).join(" ");
                                control = `<input ${attrs}>`;
                            }
                            return `<div class="nexus-form-field ${wide}" ${visibilityAttrs}>
                                <label for="nexus-field-${name}">${esc(field.label)}${field.required ? '<span class="nexus-required"> *</span>' : ""}</label>
                                ${control}
                                ${field.help ? `<small>${esc(field.help)}</small>` : ""}
                            </div>`;
                        }).join("")}
                    </div>
                    <footer class="nexus-modal-footer">
                        <span class="nexus-modal-note"><span class="material-symbols-outlined">verified_user</span> Changes are saved to the database.</span>
                        <div class="nexus-modal-actions">
                            <button type="button" class="nexus-btn nexus-btn-secondary" data-modal-close>Cancel</button>
                            <button type="submit" class="nexus-btn nexus-btn-primary"><span class="material-symbols-outlined">check</span><span>${esc(submitLabel)}</span></button>
                        </div>
                    </footer>
                </form>
            </section>`;

        document.body.appendChild(backdrop);
        const form = backdrop.querySelector("form");
        const submitButton = form.querySelector('button[type="submit"]');
        const close = () => {
            document.removeEventListener("keydown", onKeydown);
            backdrop.remove();
        };
        const onKeydown = (event) => {
            if (event.key === "Escape") close();
        };
        backdrop.querySelectorAll("[data-modal-close]").forEach((button) => button.addEventListener("click", close));
        backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
        document.addEventListener("keydown", onKeydown);

        const syncConditionalFields = () => {
            backdrop.querySelectorAll("[data-show-field]").forEach((container) => {
                const controller = form.elements.namedItem(container.dataset.showField);
                const visible = controller && String(controller.value) === String(container.dataset.showValue);
                container.hidden = !visible;
                container.querySelectorAll("input,select,textarea").forEach((control) => {
                    control.disabled = !visible;
                });
            });
        };
        form.addEventListener("change", syncConditionalFields);
        syncConditionalFields();

        const first = form.querySelector("input:not(:disabled),select:not(:disabled),textarea:not(:disabled)");
        first?.focus();

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            syncConditionalFields();
            if (!form.reportValidity()) return;
            const values = {};
            for (const [key, value] of new FormData(form).entries()) values[key] = value;
            submitButton.disabled = true;
            submitButton.classList.add("is-loading");
            const originalLabel = submitButton.innerHTML;
            submitButton.innerHTML = `<span class="nexus-spinner"></span><span>Saving…</span>`;
            try {
                const result = await onSubmit(values, form);
                if (result !== false) close();
            } catch (error) {
                if (typeof window.showToast === "function") window.showToast(error.message || "Unable to save changes", "error");
                else console.error(error);
            } finally {
                if (document.body.contains(submitButton)) {
                    submitButton.disabled = false;
                    submitButton.classList.remove("is-loading");
                    submitButton.innerHTML = originalLabel;
                }
            }
        });

        return { close, element: backdrop, form };
    };


    // Consistent read/action modal for EMI and payment details.
    window.openNexusInfoModal = function ({
        title,
        description = "Review the details below.",
        icon = "info",
        content = "",
        actions = []
    }) {
        document.getElementById("nexusInfoModalBackdrop")?.remove();
        const backdrop = document.createElement("div");
        backdrop.id = "nexusInfoModalBackdrop";
        backdrop.className = "nexus-modal-backdrop";
        const actionMarkup = actions.map((action, index) => {
            const variant = action.variant === "primary" ? "nexus-btn-primary" : action.variant === "danger" ? "nexus-btn-danger" : "nexus-btn-secondary";
            return `<button type="button" class="nexus-btn ${variant}" data-info-action="${index}">${action.icon ? `<span class="material-symbols-outlined">${esc(action.icon)}</span>` : ""}<span>${esc(action.label || "Close")}</span></button>`;
        }).join("");
        backdrop.innerHTML = `
            <section class="nexus-modal" role="dialog" aria-modal="true" aria-labelledby="nexusInfoModalTitle">
                <header class="nexus-modal-header">
                    <div class="nexus-modal-heading-icon"><span class="material-symbols-outlined">${esc(icon)}</span></div>
                    <div class="nexus-modal-heading-copy"><h2 id="nexusInfoModalTitle">${esc(title)}</h2><p>${esc(description)}</p></div>
                    <button type="button" class="nexus-modal-close" data-info-close aria-label="Close details"><span class="material-symbols-outlined">close</span></button>
                </header>
                <div class="nexus-modal-form">
                    <div class="nexus-info-content">${content}</div>
                    <footer class="nexus-modal-footer">
                        <span class="nexus-modal-note"><span class="material-symbols-outlined">verified_user</span> Information from your banking records.</span>
                        <div class="nexus-modal-actions">${actionMarkup}</div>
                    </footer>
                </div>
            </section>`;
        document.body.appendChild(backdrop);
        let closed = false;
        const close = () => {
            if (closed) return;
            closed = true;
            document.removeEventListener("keydown", onKeydown);
            backdrop.remove();
        };
        const onKeydown = (event) => { if (event.key === "Escape") close(); };
        backdrop.querySelectorAll("[data-info-close]").forEach(button => button.addEventListener("click", close));
        backdrop.addEventListener("click", event => { if (event.target === backdrop) close(); });
        document.addEventListener("keydown", onKeydown);
        backdrop.querySelectorAll("button[data-info-action]").forEach(button => {
            button.addEventListener("click", async () => {
                const action = actions[Number(button.dataset.infoAction)];
                if (!action) return close();
                button.disabled = true;
                try {
                    await action.onClick?.({ close, element: backdrop, button });
                    if (action.close !== false) close();
                } catch (error) {
                    if (typeof window.showToast === "function") window.showToast(error.message || "Action failed", "error");
                    button.disabled = false;
                }
            });
        });
        return { close, element: backdrop };
    };
})();
