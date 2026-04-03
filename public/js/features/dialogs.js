import { dom } from "../core/dom.js";
import { state } from "../core/state.js";
import { escapeHtml } from "../core/ui.js";

export function createDetailSection(title, rows) {
  return `
    <section class="detail-block">
      <h4>${escapeHtml(title)}</h4>
      <div class="detail-list">
        ${rows
          .map(
            (row) => `
              <div>
                <span>${escapeHtml(row.label)}</span>
                <strong>${escapeHtml(row.value)}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

export function openDetailDialog({ kicker = "Details", title, content }) {
  dom.detailKicker.textContent = kicker;
  dom.detailTitle.textContent = title;
  dom.detailContent.innerHTML = content;
  dom.detailDialog.showModal();
}

export function closeDetailDialog() {
  dom.detailDialog.close();
  dom.detailContent.innerHTML = "";
}

export function showActionDialog({
  kicker = "Confirm action",
  title,
  description,
  confirmLabel,
  confirmTone = "default",
  reasonLabel = "Reason",
  reasonPlaceholder = "Optional note",
  showReasonField = true,
  requireReason = false,
}) {
  dom.actionKicker.textContent = kicker;
  dom.actionTitle.textContent = title;
  dom.actionDescription.textContent = description;
  dom.actionReasonLabel.textContent = reasonLabel;
  dom.actionReason.placeholder = reasonPlaceholder;
  dom.actionReason.value = "";
  dom.actionReasonField.hidden = !showReasonField;
  dom.actionConfirm.textContent = confirmLabel;
  dom.actionConfirm.className = confirmTone === "danger" ? "warn" : "";

  return new Promise((resolve) => {
    state.actionDialogResolver = { resolve, requireReason };
    dom.actionDialog.showModal();
  });
}

export function closeActionDialog(result = { confirmed: false, reason: "" }) {
  if (state.actionDialogResolver) {
    state.actionDialogResolver.resolve(result);
    state.actionDialogResolver = null;
  }

  dom.actionDialog.close();
}
