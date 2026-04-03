import { dom } from "../core/dom.js";
import { state } from "../core/state.js";
import { authedRequest } from "../services/api.js";
import {
  buildQuery,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatDateTime,
  renderAvatarOrImage,
  renderPagination,
  renderStateMessage,
  renderStatusBadge,
} from "../core/ui.js";
import {
  createDetailSection,
  openDetailDialog,
} from "./dialogs.js";

function findById(collection, id) {
  return (collection ?? []).find((item) => item.id === id) ?? null;
}

function renderRentalCard(rental) {
  const image = renderAvatarOrImage({
    src:
      rental.product?.images?.[0]?.thumbnailUrl ||
      rental.product?.images?.[0]?.imageUrl ||
      "",
    label: rental.product?.title ?? "Rental",
    className: "product-thumb",
  });

  return `
    <article class="entity-card">
      <div class="entity-head">
        <div class="thumb-line">
          ${image}
          <div>
            <div class="entity-title">${escapeHtml(rental.product?.title ?? "Unknown product")}</div>
            <div class="muted">
              ${escapeHtml(rental.renter?.name ?? "Unknown renter")} → ${escapeHtml(rental.owner?.name ?? "Unknown owner")}
            </div>
          </div>
        </div>
        <div class="entity-actions">
          <button type="button" class="ghost" data-action="view-rental" data-id="${escapeHtml(rental.id)}">Details</button>
        </div>
      </div>
      <div class="entity-meta">
        ${renderStatusBadge(rental.status ?? "unknown")}
        <span>${escapeHtml(rental.rentalPeriodType ?? "unknown")} rental</span>
        <span>${escapeHtml(formatDate(rental.startDate))} → ${escapeHtml(formatDate(rental.endDate))}</span>
        <span>${escapeHtml(formatCurrency(rental.totalPrice ?? 0))}</span>
      </div>
      <div class="metric-grid">
        <div class="metric-chip">
          <span>Security deposit</span>
          <strong>${escapeHtml(formatCurrency(rental.securityDeposit ?? 0))}</strong>
        </div>
        <div class="metric-chip">
          <span>Platform fee</span>
          <strong>${escapeHtml(formatCurrency(rental.platformFee ?? 0))}</strong>
        </div>
        <div class="metric-chip">
          <span>Created</span>
          <strong>${escapeHtml(formatDate(rental.createdAt))}</strong>
        </div>
        <div class="metric-chip">
          <span>Review</span>
          <strong>${escapeHtml(rental.review?.rating ? `${rental.review.rating}/5` : "None")}</strong>
        </div>
      </div>
    </article>
  `;
}

export async function loadRentals() {
  const data = await authedRequest(
    buildQuery("/api/v1/admin/rentals", state.queries.rentals),
  );
  state.data.rentals = data?.data;

  const rentals = state.data.rentals?.rentals ?? [];
  if (!rentals.length) {
    dom.rentalsList.innerHTML = renderStateMessage(
      "No rentals matched the current filters.",
    );
  } else {
    dom.rentalsList.innerHTML = rentals.map(renderRentalCard).join("");
  }

  renderPagination(
    dom.rentalsPageMeta,
    dom.rentalsPrev,
    dom.rentalsNext,
    state.data.rentals?.pagination,
  );
}

export function viewRentalDetails(id) {
  const rental = findById(state.data.rentals?.rentals, id);
  if (!rental) return;

  const content = `
    <div class="detail-grid">
      ${createDetailSection("Rental", [
        { label: "Status", value: rental.status ?? "N/A" },
        { label: "Period type", value: rental.rentalPeriodType ?? "N/A" },
        { label: "Quantity", value: String(rental.quantity ?? 0) },
        { label: "Start", value: formatDateTime(rental.startDate) },
        { label: "End", value: formatDateTime(rental.endDate) },
        { label: "Created", value: formatDateTime(rental.createdAt) },
      ])}
      ${createDetailSection("Pricing", [
        { label: "Unit price", value: formatCurrency(rental.unitPrice ?? 0) },
        { label: "Total price", value: formatCurrency(rental.totalPrice ?? 0) },
        {
          label: "Deposit",
          value: formatCurrency(rental.securityDeposit ?? 0),
        },
        {
          label: "Platform fee",
          value: formatCurrency(rental.platformFee ?? 0),
        },
        {
          label: "Review",
          value: rental.review?.rating
            ? `${rental.review.rating}/5`
            : "No review",
        },
        {
          label: "Returned at",
          value: rental.actualReturnDate
            ? formatDateTime(rental.actualReturnDate)
            : "N/A",
        },
      ])}
    </div>
    <div class="detail-grid">
      ${createDetailSection("Renter", [
        { label: "Name", value: rental.renter?.name ?? "N/A" },
        { label: "Email", value: rental.renter?.email ?? "N/A" },
        { label: "Active", value: rental.renter?.isActive ? "Yes" : "No" },
      ])}
      ${createDetailSection("Owner", [
        { label: "Name", value: rental.owner?.name ?? "N/A" },
        { label: "Email", value: rental.owner?.email ?? "N/A" },
        { label: "Active", value: rental.owner?.isActive ? "Yes" : "No" },
      ])}
    </div>
    <section class="detail-block">
      <h4>Notes</h4>
      <p class="muted">Renter notes: ${escapeHtml(rental.renterNotes ?? "None")}</p>
      <p class="muted">Owner notes: ${escapeHtml(rental.ownerNotes ?? "None")}</p>
      <p class="muted">Cancellation reason: ${escapeHtml(rental.cancellationReason ?? "N/A")}</p>
    </section>
  `;

  openDetailDialog({
    kicker: "Rental detail",
    title: rental.product?.title ?? "Rental detail",
    content,
  });
}
