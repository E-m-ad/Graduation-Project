import { dom } from "../core/dom.js";
import { state } from "../core/state.js";
import { authedRequest } from "../services/api.js";
import {
  buildQuery,
  escapeHtml,
  formatCompactNumber,
  formatCurrency,
  formatPercentage,
  renderStateMessage,
} from "../core/ui.js";

function renderReportStats(reportData) {
  const cards = [
    {
      label: "Booked revenue",
      value: formatCurrency(reportData?.revenue?.bookedValue ?? 0),
      meta: `Fees ${formatCurrency(reportData?.revenue?.bookedPlatformFees ?? 0)}`,
    },
    {
      label: "Completed revenue",
      value: formatCurrency(reportData?.revenue?.completedValue ?? 0),
      meta: `Fees ${formatCurrency(reportData?.revenue?.completedPlatformFees ?? 0)}`,
    },
    {
      label: "Average rating",
      value: Number(reportData?.quality?.averageRating ?? 0).toFixed(1),
      meta: `${reportData?.quality?.totalReviews ?? 0} reviews`,
    },
    {
      label: "Completion rate",
      value: formatPercentage(reportData?.quality?.completionRate ?? 0),
      meta: `${state.queries.reports.days} day window`,
    },
  ];

  dom.reportsSummary.innerHTML = cards
    .map(
      (card) => `
        <article class="stat-card">
          <div class="stat-card-header">
            <span class="stat-kicker">${escapeHtml(card.label)}</span>
            <span class="accent-dot"></span>
          </div>
          <strong>${escapeHtml(card.value)}</strong>
          <small class="stat-meta">${escapeHtml(card.meta)}</small>
        </article>
      `,
    )
    .join("");
}

function renderDistributionCard(title, items) {
  const max = Math.max(1, ...items.map((item) => item.count ?? 0));

  return `
    <article class="distribution-card">
      <h3>${escapeHtml(title)}</h3>
      ${items
        .map(
          (item) => `
            <div class="detail-list">
              <div>
                <span>${escapeHtml(item.status ?? item.role ?? "Unknown")}</span>
                <strong>${escapeHtml(formatCompactNumber(item.count ?? 0))}</strong>
              </div>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${Math.max(((item.count ?? 0) / max) * 100, 6)}%"></div>
            </div>
          `,
        )
        .join("")}
    </article>
  `;
}

function renderTrendCard(title, items) {
  const max = Math.max(1, ...items.map((item) => item.count ?? 0));

  return `
    <article class="trend-card">
      <h3>${escapeHtml(title)}</h3>
      ${items
        .map(
          (item) => `
            <div class="detail-list">
              <div>
                <span>${escapeHtml(item.month ?? "Unknown")}</span>
                <strong>${escapeHtml(formatCompactNumber(item.count ?? 0))}</strong>
              </div>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${Math.max(((item.count ?? 0) / max) * 100, 6)}%"></div>
            </div>
          `,
        )
        .join("")}
    </article>
  `;
}

function renderLeaderboard(container, items, itemRenderer, emptyMessage) {
  if (!items.length) {
    container.innerHTML = renderStateMessage(emptyMessage);
    return;
  }

  container.innerHTML = items.map(itemRenderer).join("");
}

export async function loadReports() {
  const data = await authedRequest(
    buildQuery("/api/v1/admin/reports", state.queries.reports),
  );
  state.data.reports = data?.data;
  const reportData = state.data.reports ?? {};

  renderReportStats(reportData);

  dom.reportDistributions.innerHTML = [
    renderDistributionCard(
      "Users by role",
      reportData?.distributions?.usersByRole ?? [],
    ),
    renderDistributionCard(
      "Users by status",
      reportData?.distributions?.usersByStatus ?? [],
    ),
    renderDistributionCard(
      "Products by status",
      reportData?.distributions?.productsByStatus ?? [],
    ),
    renderDistributionCard(
      "Rentals by status",
      reportData?.distributions?.rentalsByStatus ?? [],
    ),
  ].join("");

  dom.reportTrends.innerHTML = [
    renderTrendCard(
      "User registrations",
      reportData?.trends?.userRegistrations ?? [],
    ),
    renderTrendCard(
      "Product submissions",
      reportData?.trends?.productSubmissions ?? [],
    ),
    renderTrendCard(
      "Rental requests",
      reportData?.trends?.rentalRequests ?? [],
    ),
  ].join("");

  renderLeaderboard(
    dom.reportCategories,
    reportData?.leaderboards?.categoriesByListings ?? [],
    (item, index) => `
      <article class="leaderboard-row">
        <div class="thumb-line">
          <span class="leaderboard-index">${index + 1}</span>
          <div>
            <strong>${escapeHtml(item.name ?? "Unnamed category")}</strong>
            <p class="leaderboard-meta">${escapeHtml(formatCompactNumber(item.totalProducts ?? 0))} listings</p>
          </div>
        </div>
      </article>
    `,
    "No category trends available.",
  );

  renderLeaderboard(
    dom.reportProducts,
    reportData?.leaderboards?.productsByRentals ?? [],
    (item, index) => `
      <article class="leaderboard-row">
        <div class="thumb-line">
          <span class="leaderboard-index">${index + 1}</span>
          <div>
            <strong>${escapeHtml(item.title ?? "Untitled product")}</strong>
            <p class="leaderboard-meta">
              ${escapeHtml(item.owner?.name ?? "Unknown owner")} · ${escapeHtml(formatCompactNumber(item.totalRentals ?? 0))} rentals · ${escapeHtml(Number(item.avgRating ?? 0).toFixed(1))} rating
            </p>
          </div>
        </div>
      </article>
    `,
    "No product leaders available.",
  );
}
