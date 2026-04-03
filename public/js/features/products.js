import { dom } from "../core/dom.js";
import { state } from "../core/state.js";
import { authedRequest } from "../services/api.js";
import {
  buildQuery,
  escapeHtml,
  formatCompactNumber,
  formatCurrency,
  formatDate,
  pickPrimaryImage,
  renderAvatarOrImage,
  renderPagination,
  renderStateMessage,
  renderStatusBadge,
} from "../core/ui.js";
import {
  createDetailSection,
  openDetailDialog,
  showActionDialog,
} from "./dialogs.js";
import { loadOverview } from "./overview.js";
import { setStatus } from "../core/shell-ui.js";

function findById(collection, id) {
  return (collection ?? []).find((item) => item.id === id) ?? null;
}

function renderProductCard(product) {
  const image = renderAvatarOrImage({
    src: pickPrimaryImage(product),
    label: product.title ?? "Product",
    className: "product-thumb",
  });

  const primaryPrice =
    product.pricePerDay ??
    product.pricePerWeek ??
    product.pricePerMonth ??
    product.pricePerHour ??
    0;

  return `
    <article class="entity-card">
      <div class="entity-head">
        <div class="thumb-line">
          ${image}
          <div>
            <div class="entity-title">${escapeHtml(product.title ?? "Untitled product")}</div>
            <div class="muted">${escapeHtml(product.owner?.name ?? "Unknown owner")} · ${escapeHtml(product.category?.name ?? "No category")}</div>
          </div>
        </div>
        <div class="entity-actions">
          <button type="button" class="ghost" data-action="view-product" data-id="${escapeHtml(product.id)}">Details</button>
          <button type="button" data-action="approve-product" data-id="${escapeHtml(product.id)}">Approve</button>
          <button type="button" class="warn" data-action="reject-product" data-id="${escapeHtml(product.id)}">Reject</button>
        </div>
      </div>
      <div class="entity-meta">
        ${renderStatusBadge(product.status ?? "unknown")}
        ${renderStatusBadge(product.isApproved ? "approved" : "unapproved")}
        <span>${escapeHtml(product.city ?? "No city")}</span>
        <span>${escapeHtml(formatCurrency(primaryPrice))}</span>
        <span>${escapeHtml(formatDate(product.createdAt))}</span>
      </div>
      <p class="muted">${escapeHtml(product.description ?? "No description provided.")}</p>
      <div class="metric-grid">
        <div class="metric-chip">
          <span>Avg rating</span>
          <strong>${escapeHtml(Number(product.avgRating ?? 0).toFixed(1))}</strong>
        </div>
        <div class="metric-chip">
          <span>Total reviews</span>
          <strong>${escapeHtml(formatCompactNumber(product.totalReviews ?? 0))}</strong>
        </div>
        <div class="metric-chip">
          <span>Total rentals</span>
          <strong>${escapeHtml(formatCompactNumber(product.totalRentals ?? 0))}</strong>
        </div>
        <div class="metric-chip">
          <span>Views</span>
          <strong>${escapeHtml(formatCompactNumber(product.viewCount ?? 0))}</strong>
        </div>
      </div>
    </article>
  `;
}

export async function loadProducts() {
  const data = await authedRequest(
    buildQuery("/api/v1/admin/products", state.queries.products),
  );
  state.data.products = data?.data;

  const products = state.data.products?.products ?? [];
  if (!products.length) {
    dom.productsList.innerHTML = renderStateMessage(
      "No products matched the current filters.",
    );
  } else {
    dom.productsList.innerHTML = products.map(renderProductCard).join("");
  }

  renderPagination(
    dom.productsPageMeta,
    dom.productsPrev,
    dom.productsNext,
    state.data.products?.pagination,
  );
}

export function viewProductDetails(id) {
  const product = findById(state.data.products?.products, id);
  if (!product) return;

  const gallery = product.images?.length
    ? `
      <section class="detail-block">
        <h4>Images</h4>
        <div class="detail-gallery">
          ${product.images
            .map(
              (image) => `
                <img src="${escapeHtml(image.thumbnailUrl || image.imageUrl)}" alt="${escapeHtml(product.title ?? "Product image")}" />
              `,
            )
            .join("")}
        </div>
      </section>
    `
    : "";

  const content = `
    <div class="detail-grid">
      ${createDetailSection("Listing", [
        { label: "Title", value: product.title ?? "N/A" },
        { label: "Owner", value: product.owner?.name ?? "N/A" },
        { label: "Owner email", value: product.owner?.email ?? "N/A" },
        { label: "Category", value: product.category?.name ?? "N/A" },
        { label: "City", value: product.city ?? "N/A" },
        { label: "Status", value: product.status ?? "N/A" },
      ])}
      ${createDetailSection("Commercial", [
        {
          label: "Price / hour",
          value: product.pricePerHour
            ? formatCurrency(product.pricePerHour)
            : "N/A",
        },
        {
          label: "Price / day",
          value: product.pricePerDay ? formatCurrency(product.pricePerDay) : "N/A",
        },
        {
          label: "Price / week",
          value: product.pricePerWeek
            ? formatCurrency(product.pricePerWeek)
            : "N/A",
        },
        {
          label: "Price / month",
          value: product.pricePerMonth
            ? formatCurrency(product.pricePerMonth)
            : "N/A",
        },
        {
          label: "Deposit",
          value: formatCurrency(product.securityDeposit ?? 0),
        },
        {
          label: "Approval",
          value: product.isApproved ? "Approved" : "Unapproved",
        },
      ])}
    </div>
    <section class="detail-block">
      <h4>Description</h4>
      <p class="muted">${escapeHtml(product.description ?? "No description provided.")}</p>
    </section>
    ${gallery}
  `;

  openDetailDialog({
    kicker: "Listing review",
    title: product.title ?? "Product details",
    content,
  });
}

export async function moderateProduct(id, action) {
  const product = findById(state.data.products?.products, id);
  if (!product) return;

  const approving = action === "approve";
  const result = await showActionDialog({
    kicker: "Listing moderation",
    title: approving ? "Approve listing" : "Reject listing",
    description: approving
      ? `Approve "${product.title}" and make it eligible for public visibility.`
      : `Reject "${product.title}" and move it to suspended status.`,
    confirmLabel: approving ? "Approve listing" : "Reject listing",
    confirmTone: approving ? "default" : "danger",
    reasonLabel: "Reason",
    reasonPlaceholder: approving
      ? "Optional approval note"
      : "Optional rejection note",
  });

  if (!result.confirmed) return;

  setStatus(
    "working",
    `${approving ? "Approving" : "Rejecting"} ${product.title}...`,
  );

  await authedRequest(
    `/api/v1/admin/products/${id}/${approving ? "approve" : "reject"}`,
    {
      method: "PUT",
      body: {
        reason: result.reason || undefined,
      },
    },
  );

  await Promise.all([loadProducts(), loadOverview()]);
  setStatus(
    "success",
    `${product.title} ${approving ? "approved" : "rejected"} successfully.`,
  );
}
