import { dom } from "../core/dom.js";
import { state } from "../core/state.js";
import { authedRequest } from "../services/api.js";
import {
  buildQuery,
  escapeHtml,
  formatCompactNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPercentage,
  renderPagination,
  renderReadBadge,
  renderRoleBadge,
  renderStateMessage,
  renderStatusBadge,
} from "../core/ui.js";

function renderOverviewStats(summary, financial) {
  const cards = [
    { label: "Total users", value: summary?.users?.total ?? 0, meta: `${summary?.users?.active ?? 0} active` },
    { label: "Pending products", value: summary?.products?.pendingReview ?? 0, meta: `${summary?.products?.approved ?? 0} approved` },
    { label: "Total rentals", value: summary?.rentals?.total ?? 0, meta: `${summary?.rentals?.pending ?? 0} pending` },
    { label: "Overdue rentals", value: summary?.rentals?.overdue ?? 0, meta: `${summary?.rentals?.active ?? 0} active` },
    { label: "Completed rentals", value: summary?.rentals?.completed ?? 0, meta: "Lifecycle closed" },
    { label: "Reviews", value: summary?.content?.reviews ?? 0, meta: `${summary?.content?.categories ?? 0} categories` },
    { label: "Booked value", value: formatCurrency(financial?.bookedValue ?? 0), meta: "Booked rental volume" },
    { label: "Platform fees", value: formatCurrency(financial?.platformFees ?? 0), meta: "Captured fees" },
  ];

  dom.statsGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="stat-card">
          <div class="stat-card-header">
            <span class="stat-kicker">${escapeHtml(card.label)}</span>
            <span class="accent-dot"></span>
          </div>
          <strong>${
            typeof card.value === "string"
              ? escapeHtml(card.value)
              : escapeHtml(formatCompactNumber(card.value))
          }</strong>
          <div class="stat-card-footer">
            <small class="stat-meta">${escapeHtml(card.meta)}</small>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderInsightGrid(container, items) {
  container.innerHTML = items
    .map(
      (item) => `
        <article class="trend-card">
          <p class="stat-kicker">${escapeHtml(item.label)}</p>
          <strong>${escapeHtml(item.value)}</strong>
          <small class="muted">${escapeHtml(item.meta)}</small>
        </article>
      `,
    )
    .join("");
}

function getNotificationProductLabel(notification) {
  return (
    notification?.data?.productTitle ||
    notification?.rental?.product?.title ||
    ""
  );
}

function renderNotificationItem(notification) {
  const isRead = Boolean(notification?.isRead);
  const productLabel = getNotificationProductLabel(notification);

  return `
    <article class="notification-row ${isRead ? "read" : "unread"}">
      <div class="notification-row-head">
        <strong>${escapeHtml(notification?.title ?? "System update")}</strong>
        ${renderReadBadge(isRead)}
      </div>
      <div class="notification-row-body">
        <p class="muted">${escapeHtml(notification?.message ?? "No details available.")}</p>
        <div class="stack-meta">
          ${renderStatusBadge(notification?.type ?? "system")}
          <span>${escapeHtml(formatDateTime(notification?.createdAt))}</span>
        </div>
        <div class="notification-row-actions">
          <label class="notification-check ${isRead ? "is-read" : ""}">
            <input
              type="checkbox"
              ${isRead ? "checked disabled" : ""}
              data-action="mark-notification-read"
              data-id="${escapeHtml(notification?.id ?? "")}"
            />
            <span>${isRead ? "Marked as read" : "Mark as read"}</span>
          </label>
          ${
            productLabel
              ? `
                <button
                  type="button"
                  class="ghost"
                  data-action="focus-product"
                  data-query="${escapeHtml(productLabel)}"
                >
                  Open product
                </button>
              `
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function renderNotificationCollection(notifications, emptyMessage) {
  if (!notifications.length) {
    return renderStateMessage(emptyMessage);
  }

  return notifications.map(renderNotificationItem).join("");
}

export function renderOverviewNotifications(notifications) {
  dom.notificationsList.innerHTML = renderNotificationCollection(
    notifications,
    "No recent notifications.",
  );
}

export function renderNotificationsPanel(data) {
  const notifications = data?.notifications ?? [];
  dom.notificationsFeed.innerHTML = renderNotificationCollection(
    notifications,
    "No notifications matched the current filters.",
  );
  renderPagination(
    dom.notificationsPageMeta,
    dom.notificationsPrev,
    dom.notificationsNext,
    data?.pagination,
  );
}

function renderRecentUsers(users) {
  if (!users.length) {
    dom.recentUsersList.innerHTML = renderStateMessage(
      "No recent user activity.",
    );
    return;
  }

  dom.recentUsersList.innerHTML = users
    .map(
      (user) => `
        <article class="stack-item">
          <div>
            <strong>${escapeHtml(user.name ?? "Unknown user")}</strong>
            <div class="stack-meta">
              <span>${escapeHtml(user.email ?? "No email")}</span>
              ${renderRoleBadge(user.role ?? "unknown")}
              ${renderStatusBadge(user.isActive ? "active" : "suspended")}
            </div>
          </div>
          <small class="muted">${escapeHtml(formatDate(user.createdAt))}</small>
        </article>
      `,
    )
    .join("");
}

function renderPendingProducts(products) {
  if (!products.length) {
    dom.pendingProductsList.innerHTML = renderStateMessage(
      "No products waiting for review.",
    );
    return;
  }

  dom.pendingProductsList.innerHTML = products
    .map(
      (product) => `
        <article class="stack-item">
          <div>
            <strong>${escapeHtml(product.title ?? "Untitled product")}</strong>
            <div class="stack-meta">
              <span>${escapeHtml(product.owner?.name ?? "Unknown owner")}</span>
              <span>${escapeHtml(product.category?.name ?? "No category")}</span>
            </div>
          </div>
          <button
            type="button"
            class="ghost"
            data-action="focus-product"
            data-id="${escapeHtml(product.id)}"
            data-query="${escapeHtml(product.title ?? "")}"
          >
            Review
          </button>
        </article>
      `,
    )
    .join("");
}

function renderRecentRentals(rentals) {
  if (!rentals.length) {
    dom.recentRentalsBody.innerHTML = `<tr><td colspan="7">${renderStateMessage("No rental activity found.")}</td></tr>`;
    return;
  }

  dom.recentRentalsBody.innerHTML = rentals
    .map(
      (rental) => `
        <tr>
          <td>${escapeHtml(rental.id.slice(0, 8))}</td>
          <td>${escapeHtml(rental.product?.title ?? "Unknown product")}</td>
          <td>${escapeHtml(rental.renter?.name ?? "Unknown renter")}</td>
          <td>${escapeHtml(rental.owner?.name ?? "Unknown owner")}</td>
          <td>${escapeHtml(formatDateTime(rental.createdAt))}</td>
          <td>${renderStatusBadge(rental.status ?? "unknown")}</td>
          <td>${escapeHtml(formatCurrency(rental.totalPrice ?? 0))}</td>
        </tr>
      `,
    )
    .join("");
}

export async function refreshUnreadNotifications() {
  try {
    const data = await authedRequest("/api/v1/notifications/unread-count");
    dom.notificationCount.textContent = String(data?.data?.unreadCount ?? 0);
  } catch {
    dom.notificationCount.textContent = "0";
  }
}

export async function fetchNotificationPreview() {
  const data = await authedRequest("/api/v1/notifications?limit=5");
  return data?.data ?? {};
}

export async function refreshNotificationPreview() {
  state.data.notificationPreview = await fetchNotificationPreview();

  if (state.activePanel === "overview") {
    renderOverviewNotifications(
      state.data.notificationPreview?.notifications ?? [],
    );
  }
}

export async function loadNotifications() {
  const data = await authedRequest(
    buildQuery("/api/v1/notifications", state.queries.notifications),
  );
  state.data.notifications = data?.data ?? {};
  renderNotificationsPanel(state.data.notifications);
}

export async function refreshNotificationsPanelData() {
  if (state.activePanel === "notifications" || state.data.notifications) {
    await loadNotifications();
  }
}

export async function refreshNotificationViews() {
  await Promise.all([
    refreshUnreadNotifications(),
    refreshNotificationPreview(),
    refreshNotificationsPanelData(),
  ]);
}

export async function markNotificationAsRead(id) {
  if (!id) {
    throw new Error("Notification id is required.");
  }

  await authedRequest(`/api/v1/notifications/${id}/read`, {
    method: "PUT",
  });
}

export async function markAllNotificationsAsRead() {
  await authedRequest("/api/v1/notifications/read-all", {
    method: "PUT",
  });
}

export async function loadOverview() {
  const [dashboard, reports, notificationPreview] = await Promise.all([
    authedRequest("/api/v1/admin/dashboard"),
    authedRequest(buildQuery("/api/v1/admin/reports", state.queries.reports)),
    fetchNotificationPreview(),
  ]);

  state.data.overview = dashboard?.data;
  state.data.reports = reports?.data;
  state.data.notificationPreview = notificationPreview;

  const overview = dashboard?.data ?? {};
  const reportData = reports?.data ?? {};
  const notificationData = notificationPreview ?? {};

  dom.overviewHeadline.innerHTML = `<div> Pending rentals : ${
    overview?.summary?.rentals?.pending ?? 0
  } </div> <div> Products in review : ${
    overview?.summary?.products?.pendingReview ?? 0
  }</div>`;

  renderOverviewStats(overview.summary, overview.financial);
  renderInsightGrid(dom.growthGrid, [
    {
      label: "New users",
      value: formatCompactNumber(overview?.growthLast30Days?.users ?? 0),
      meta: "Accounts created in the current window",
    },
    {
      label: "New listings",
      value: formatCompactNumber(overview?.growthLast30Days?.products ?? 0),
      meta: "Product submissions in the current window",
    },
    {
      label: "New rentals",
      value: formatCompactNumber(overview?.growthLast30Days?.rentals ?? 0),
      meta: "Rental requests created recently",
    },
    {
      label: "New reviews",
      value: formatCompactNumber(overview?.growthLast30Days?.reviews ?? 0),
      meta: "Review volume added recently",
    },
  ]);

  renderInsightGrid(dom.financialGrid, [
    {
      label: "Booked value",
      value: formatCurrency(reportData?.revenue?.bookedValue ?? 0),
      meta: "Value across booked statuses",
    },
    {
      label: "Completed value",
      value: formatCurrency(reportData?.revenue?.completedValue ?? 0),
      meta: "Revenue from completed rentals",
    },
    {
      label: "Platform fees",
      value: formatCurrency(reportData?.revenue?.bookedPlatformFees ?? 0),
      meta: "Fees captured across booked rentals",
    },
    {
      label: "Completion rate",
      value: formatPercentage(reportData?.quality?.completionRate ?? 0),
      meta: `Average rating ${Number(reportData?.quality?.averageRating ?? 0).toFixed(1)}`,
    },
  ]);

  renderOverviewNotifications(notificationData?.notifications ?? []);
  renderRecentUsers(overview?.recent?.users ?? []);
  renderPendingProducts(overview?.recent?.pendingProducts ?? []);
  renderRecentRentals(overview?.recent?.rentals ?? []);
}
