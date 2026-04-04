const adminName = document.getElementById("adminName");
const adminEmail = document.getElementById("adminEmail");
const adminUnreadCount = document.getElementById("adminUnreadCount");
const activePanelLabel = document.getElementById("activePanelLabel");
const panelEyebrow = document.getElementById("panelEyebrow");
const panelTitle = document.getElementById("panelTitle");
const adminLastSync = document.getElementById("adminLastSync");
const adminRefreshBtn = document.getElementById("adminRefreshBtn");
const markAllReadBtn = document.getElementById("markAllReadBtn");
const adminMessage = document.getElementById("adminMessage");
const panelButtons = Array.from(document.querySelectorAll("[data-panel]"));
const panels = Array.from(document.querySelectorAll(".admin-panel"));

const overviewStats = document.getElementById("overviewStats");
const overviewUsers = document.getElementById("overviewUsers");
const overviewProducts = document.getElementById("overviewProducts");
const overviewRentals = document.getElementById("overviewRentals");

const notificationsFilterForm = document.getElementById("notificationsFilterForm");
const notificationsResetBtn = document.getElementById("notificationsResetBtn");
const notificationsList = document.getElementById("notificationsList");
const notificationsPrevBtn = document.getElementById("notificationsPrevBtn");
const notificationsNextBtn = document.getElementById("notificationsNextBtn");
const notificationsPageMeta = document.getElementById("notificationsPageMeta");

const usersFilterForm = document.getElementById("usersFilterForm");
const usersResetBtn = document.getElementById("usersResetBtn");
const usersList = document.getElementById("usersList");
const usersPrevBtn = document.getElementById("usersPrevBtn");
const usersNextBtn = document.getElementById("usersNextBtn");
const usersPageMeta = document.getElementById("usersPageMeta");

const productsFilterForm = document.getElementById("productsFilterForm");
const productsResetBtn = document.getElementById("productsResetBtn");
const productsList = document.getElementById("productsList");
const productsPrevBtn = document.getElementById("productsPrevBtn");
const productsNextBtn = document.getElementById("productsNextBtn");
const productsPageMeta = document.getElementById("productsPageMeta");

const rentalsFilterForm = document.getElementById("rentalsFilterForm");
const rentalsResetBtn = document.getElementById("rentalsResetBtn");
const rentalsList = document.getElementById("rentalsList");
const rentalsPrevBtn = document.getElementById("rentalsPrevBtn");
const rentalsNextBtn = document.getElementById("rentalsNextBtn");
const rentalsPageMeta = document.getElementById("rentalsPageMeta");

const reportsFilterForm = document.getElementById("reportsFilterForm");
const reportsStats = document.getElementById("reportsStats");
const reportsDistributions = document.getElementById("reportsDistributions");
const reportsTrends = document.getElementById("reportsTrends");
const reportsCategories = document.getElementById("reportsCategories");
const reportsProducts = document.getElementById("reportsProducts");

const categoryForm = document.getElementById("categoryForm");
const categoryFormMode = document.getElementById("categoryFormMode");
const categoryFormTitle = document.getElementById("categoryFormTitle");
const categorySubmitBtn = document.getElementById("categorySubmitBtn");
const categoryCancelBtn = document.getElementById("categoryCancelBtn");
const categoryParentId = document.getElementById("categoryParentId");
const categoriesList = document.getElementById("categoriesList");

const panelMeta = {
  overview: { eyebrow: "Operations", title: "Overview" },
  notifications: { eyebrow: "Inbox", title: "Notifications" },
  users: { eyebrow: "Admin tools", title: "Users" },
  products: { eyebrow: "Moderation", title: "Products" },
  rentals: { eyebrow: "Operations", title: "Rentals" },
  reports: { eyebrow: "Insights", title: "Reports" },
  categories: { eyebrow: "Catalog", title: "Categories" },
};

const state = {
  currentUser: null,
  activePanel: "overview",
  categories: [],
  editingCategoryId: null,
  notifications: {
    page: 1,
    limit: "10",
    isRead: "",
    type: "",
    pagination: null,
  },
  users: {
    page: 1,
    search: "",
    role: "",
    isActive: "",
    pagination: null,
  },
  products: {
    page: 1,
    search: "",
    status: "",
    isApproved: "",
    city: "",
    pagination: null,
  },
  rentals: {
    page: 1,
    search: "",
    status: "",
    pagination: null,
  },
  reports: {
    days: "30",
    months: "6",
  },
};

function setMessage(text, type = "") {
  AIRent.showMessage(adminMessage, text, type);
}

function setLastSync() {
  adminLastSync.textContent = `Last synced at ${new Date().toLocaleTimeString()}`;
}

function setActivePanel(panelName) {
  state.activePanel = panelName;
  activePanelLabel.textContent = panelMeta[panelName].title;
  panelEyebrow.textContent = panelMeta[panelName].eyebrow;
  panelTitle.textContent = panelMeta[panelName].title;

  panelButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.panel === panelName);
  });

  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === `${panelName}Panel`);
  });
}

function renderSimpleList(container, items, emptyMessage) {
  if (!items.length) {
    container.innerHTML = AIRent.createEmptyState(emptyMessage);
    return;
  }

  container.innerHTML = items.join("");
}

function updatePagination(metaElement, prevButton, nextButton, pagination) {
  if (!pagination || pagination.totalPages <= 1) {
    metaElement.textContent = "Page 1";
    prevButton.disabled = true;
    nextButton.disabled = true;
    return;
  }

  metaElement.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
  prevButton.disabled = !pagination.hasPreviousPage;
  nextButton.disabled = !pagination.hasNextPage;
}

async function refreshUnreadCount() {
  const result = await AIRent.fetchApi("/api/v1/notifications/unread-count", {
    auth: true,
  });
  adminUnreadCount.textContent = String(
    result.data?.data?.unreadCount || 0,
  );
}

function createOverviewStat(label, value, hint) {
  return `
    <article class="admin-stat">
      <span>${AIRent.escapeHtml(label)}</span>
      <strong>${AIRent.escapeHtml(value)}</strong>
      <span>${AIRent.escapeHtml(hint)}</span>
    </article>
  `;
}

function createRecentUserItem(user) {
  return `
    <article class="admin-item">
      <div class="admin-item__header">
        <strong>${AIRent.escapeHtml(user.name)}</strong>
        <span class="tag ${user.isActive ? "tag--light" : ""}">
          ${user.isActive ? "Active" : "Suspended"}
        </span>
      </div>
      <p class="admin-item__meta">
        ${AIRent.escapeHtml(user.email)} | ${AIRent.escapeHtml(user.role)}
      </p>
      <p class="admin-item__footer">
        Joined ${AIRent.escapeHtml(AIRent.formatDateTime(user.createdAt))}
      </p>
    </article>
  `;
}

function createPendingProductItem(product) {
  return `
    <article class="admin-item">
      <div class="admin-item__header">
        <strong>${AIRent.escapeHtml(product.title)}</strong>
        <span class="tag">Under review</span>
      </div>
      <p class="admin-item__meta">
        Owner: ${AIRent.escapeHtml(product.owner?.name || "Unknown")}
      </p>
      <p class="admin-item__footer">
        ${AIRent.escapeHtml(product.category?.name || "General")} |
        ${AIRent.escapeHtml(AIRent.formatDateTime(product.createdAt))}
      </p>
      <div class="admin-item__actions">
        <button
          type="button"
          class="btn btn--primary btn--small"
          data-product-action="approve"
          data-product-id="${AIRent.escapeHtml(product.id)}"
        >
          Approve
        </button>
        <button
          type="button"
          class="btn btn--secondary btn--small"
          data-product-action="reject"
          data-product-id="${AIRent.escapeHtml(product.id)}"
        >
          Reject
        </button>
      </div>
    </article>
  `;
}

function createRecentRentalItem(rental) {
  return `
    <article class="admin-item">
      <div class="admin-item__header">
        <strong>${AIRent.escapeHtml(rental.product?.title || "Rental")}</strong>
        <span class="tag tag--light">${AIRent.escapeHtml(rental.status)}</span>
      </div>
      <p class="admin-item__meta">
        Renter: ${AIRent.escapeHtml(rental.renter?.name || "Unknown")} |
        Owner: ${AIRent.escapeHtml(rental.owner?.name || "Unknown")}
      </p>
      <p class="admin-item__footer">
        ${AIRent.escapeHtml(AIRent.formatMoney(rental.totalPrice))} |
        ${AIRent.escapeHtml(AIRent.formatDateTime(rental.createdAt))}
      </p>
    </article>
  `;
}

async function loadOverview() {
  setMessage("Loading dashboard overview...", "info");

  const result = await AIRent.fetchApi("/api/v1/admin/dashboard", {
    auth: true,
  });

  if (!result.ok || !result.data?.success) {
    setMessage(result.data?.message || "Failed to load dashboard.", "error");
    return;
  }

  const dashboard = result.data.data;
  const summary = dashboard.summary;
  overviewStats.innerHTML = [
    createOverviewStat("Users", String(summary.users.total), `${summary.users.active} active`),
    createOverviewStat("Products", String(summary.products.total), `${summary.products.pendingReview} pending review`),
    createOverviewStat("Rentals", String(summary.rentals.total), `${summary.rentals.active} active`),
    createOverviewStat("Reviews", String(summary.content.reviews), `${summary.content.categories} categories`),
    createOverviewStat("Booked value", AIRent.formatMoney(dashboard.financial.bookedValue), "All booked rentals"),
    createOverviewStat("Platform fees", AIRent.formatMoney(dashboard.financial.platformFees), "Tracked by admin"),
    createOverviewStat("New users", String(dashboard.growthLast30Days.users), "Last 30 days"),
    createOverviewStat("New rentals", String(dashboard.growthLast30Days.rentals), "Last 30 days"),
  ].join("");

  renderSimpleList(
    overviewUsers,
    dashboard.recent.users.map(createRecentUserItem),
    "No recent users found.",
  );
  renderSimpleList(
    overviewProducts,
    dashboard.recent.pendingProducts.map(createPendingProductItem),
    "No products are waiting for review.",
  );
  renderSimpleList(
    overviewRentals,
    dashboard.recent.rentals.map(createRecentRentalItem),
    "No recent rentals found.",
  );

  setLastSync();
  setMessage("Overview loaded successfully.", "success");
}

function createNotificationItem(notification) {
  return `
    <article class="admin-item">
      <div class="admin-item__header">
        <strong>${AIRent.escapeHtml(notification.title || "Notification")}</strong>
        <span class="tag ${notification.isRead ? "tag--light" : ""}">
          ${notification.isRead ? "Read" : "Unread"}
        </span>
      </div>
      <p class="admin-item__summary">${AIRent.escapeHtml(
        notification.message || "No message available.",
      )}</p>
      <div class="admin-item__footer">
        <span>${AIRent.escapeHtml(notification.type || "system")}</span>
        <span>${AIRent.escapeHtml(AIRent.formatDateTime(notification.createdAt))}</span>
      </div>
      ${
        notification.isRead
          ? ""
          : `<div class="admin-item__actions">
              <button
                type="button"
                class="btn btn--secondary btn--small"
                data-notification-id="${AIRent.escapeHtml(notification.id)}"
              >
                Mark as read
              </button>
            </div>`
      }
    </article>
  `;
}

async function loadNotifications() {
  setMessage("Loading notifications...", "info");

  const query = AIRent.buildQuery({
    page: state.notifications.page,
    limit: state.notifications.limit,
    isRead: state.notifications.isRead,
    type: state.notifications.type,
  });
  const result = await AIRent.fetchApi(`/api/v1/notifications?${query}`, {
    auth: true,
  });

  if (!result.ok || !result.data?.success) {
    setMessage(result.data?.message || "Failed to load notifications.", "error");
    return;
  }

  const payload = result.data.data;
  state.notifications.pagination = payload.pagination;

  renderSimpleList(
    notificationsList,
    payload.notifications.map(createNotificationItem),
    "No notifications match the current filters.",
  );
  updatePagination(
    notificationsPageMeta,
    notificationsPrevBtn,
    notificationsNextBtn,
    payload.pagination,
  );

  await refreshUnreadCount();
  setLastSync();
  setMessage("Notifications updated.", "success");
}

function createUserItem(user) {
  const canToggle = user.id !== state.currentUser.id;
  const nextAction = user.isActive ? "suspend" : "activate";

  return `
    <article class="admin-item">
      <div class="admin-item__header">
        <div>
          <strong>${AIRent.escapeHtml(user.name)}</strong>
          <p class="admin-item__meta">${AIRent.escapeHtml(user.email)}</p>
        </div>
        <span class="tag ${user.isActive ? "tag--light" : ""}">
          ${user.isActive ? "Active" : "Suspended"}
        </span>
      </div>
      <div class="admin-item__footer">
        <span>Role: ${AIRent.escapeHtml(user.role)}</span>
        <span>Listings: ${AIRent.escapeHtml(user._count?.productsOwned || 0)}</span>
        <span>Bookings: ${AIRent.escapeHtml(user._count?.rentalsAsRenter || 0)}</span>
        <span>Requests: ${AIRent.escapeHtml(user._count?.rentalsAsOwner || 0)}</span>
      </div>
      <p class="admin-item__summary">
        ${AIRent.escapeHtml(user.city || "No city")} |
        Joined ${AIRent.escapeHtml(AIRent.formatDateTime(user.createdAt))}
      </p>
      ${
        canToggle
          ? `<div class="admin-item__actions">
              <button
                type="button"
                class="btn btn--secondary btn--small"
                data-user-action="${nextAction}"
                data-user-id="${AIRent.escapeHtml(user.id)}"
                data-user-name="${AIRent.escapeHtml(user.name)}"
              >
                ${user.isActive ? "Suspend" : "Activate"}
              </button>
            </div>`
          : ""
      }
    </article>
  `;
}

async function loadUsers() {
  setMessage("Loading users...", "info");

  const query = AIRent.buildQuery({
    page: state.users.page,
    search: state.users.search,
    role: state.users.role,
    isActive: state.users.isActive,
    limit: 10,
  });
  const result = await AIRent.fetchApi(`/api/v1/admin/users?${query}`, {
    auth: true,
  });

  if (!result.ok || !result.data?.success) {
    setMessage(result.data?.message || "Failed to load users.", "error");
    return;
  }

  const payload = result.data.data;
  state.users.pagination = payload.pagination;

  renderSimpleList(
    usersList,
    payload.users.map(createUserItem),
    "No users match the current filters.",
  );
  updatePagination(usersPageMeta, usersPrevBtn, usersNextBtn, payload.pagination);

  setLastSync();
  setMessage("Users loaded successfully.", "success");
}

function createProductItem(product) {
  const needsReview = !product.isApproved || product.status === "under_review";
  const imageUrl = AIRent.getPrimaryImage(product);

  return `
    <article class="admin-item">
      <div class="admin-item__inline">
        <img
          class="admin-item__thumb"
          src="${AIRent.escapeHtml(imageUrl)}"
          alt="${AIRent.escapeHtml(product.title)}"
        />
        <div>
          <strong>${AIRent.escapeHtml(product.title)}</strong>
          <p class="admin-item__meta">
            ${AIRent.escapeHtml(product.owner?.name || "Unknown owner")} |
            ${AIRent.escapeHtml(product.category?.name || "General")}
          </p>
        </div>
      </div>
      <div class="admin-item__footer">
        <span>${AIRent.escapeHtml(AIRent.getPriceLabel(product))}</span>
        <span>${AIRent.escapeHtml(product.city || "No city")}</span>
        <span>${AIRent.escapeHtml(product.status)}</span>
      </div>
      <p class="admin-item__summary">${AIRent.escapeHtml(
        AIRent.truncateText(product.description || "No description provided.", 160),
      )}</p>
      <div class="admin-item__actions">
        <a class="btn btn--ghost btn--small" href="/html/product-details.html?id=${encodeURIComponent(
          product.id,
        )}">
          View
        </a>
        ${
          needsReview
            ? `<button
                type="button"
                class="btn btn--primary btn--small"
                data-product-action="approve"
                data-product-id="${AIRent.escapeHtml(product.id)}"
              >
                Approve
              </button>
              <button
                type="button"
                class="btn btn--secondary btn--small"
                data-product-action="reject"
                data-product-id="${AIRent.escapeHtml(product.id)}"
              >
                Reject
              </button>`
            : ""
        }
      </div>
    </article>
  `;
}

async function loadProducts() {
  setMessage("Loading products...", "info");

  const query = AIRent.buildQuery({
    page: state.products.page,
    search: state.products.search,
    status: state.products.status,
    isApproved: state.products.isApproved,
    city: state.products.city,
    limit: 10,
  });
  const result = await AIRent.fetchApi(`/api/v1/admin/products?${query}`, {
    auth: true,
  });

  if (!result.ok || !result.data?.success) {
    setMessage(result.data?.message || "Failed to load products.", "error");
    return;
  }

  const payload = result.data.data;
  state.products.pagination = payload.pagination;

  renderSimpleList(
    productsList,
    payload.products.map(createProductItem),
    "No products match the current filters.",
  );
  updatePagination(
    productsPageMeta,
    productsPrevBtn,
    productsNextBtn,
    payload.pagination,
  );

  setLastSync();
  setMessage("Products loaded successfully.", "success");
}

function createRentalItem(rental) {
  return `
    <article class="admin-item">
      <div class="admin-item__header">
        <strong>${AIRent.escapeHtml(rental.product?.title || "Rental")}</strong>
        <span class="tag tag--light">${AIRent.escapeHtml(rental.status)}</span>
      </div>
      <div class="admin-item__footer">
        <span>Renter: ${AIRent.escapeHtml(rental.renter?.name || "Unknown")}</span>
        <span>Owner: ${AIRent.escapeHtml(rental.owner?.name || "Unknown")}</span>
      </div>
      <div class="admin-item__footer">
        <span>${AIRent.escapeHtml(AIRent.formatMoney(rental.totalPrice))}</span>
        <span>${AIRent.escapeHtml(rental.rentalPeriodType)}</span>
        <span>${AIRent.escapeHtml(AIRent.formatDateTime(rental.createdAt))}</span>
      </div>
      <p class="admin-item__summary">
        Start: ${AIRent.escapeHtml(AIRent.formatDateTime(rental.startDate))} |
        End: ${AIRent.escapeHtml(AIRent.formatDateTime(rental.endDate))}
      </p>
    </article>
  `;
}

async function loadRentals() {
  setMessage("Loading rentals...", "info");

  const query = AIRent.buildQuery({
    page: state.rentals.page,
    search: state.rentals.search,
    status: state.rentals.status,
    limit: 10,
  });
  const result = await AIRent.fetchApi(`/api/v1/admin/rentals?${query}`, {
    auth: true,
  });

  if (!result.ok || !result.data?.success) {
    setMessage(result.data?.message || "Failed to load rentals.", "error");
    return;
  }

  const payload = result.data.data;
  state.rentals.pagination = payload.pagination;

  renderSimpleList(
    rentalsList,
    payload.rentals.map(createRentalItem),
    "No rentals match the current filters.",
  );
  updatePagination(
    rentalsPageMeta,
    rentalsPrevBtn,
    rentalsNextBtn,
    payload.pagination,
  );

  setLastSync();
  setMessage("Rentals loaded successfully.", "success");
}

function createReportStat(label, value, hint) {
  return createOverviewStat(label, value, hint);
}

function createBarGroup(title, items, labelKey) {
  const maxValue = Math.max(...items.map((item) => item.count || 0), 1);
  return `
    <article class="admin-item">
      <strong>${AIRent.escapeHtml(title)}</strong>
      <div class="admin-bars">
        ${items
          .map(
            (item) => `
              <div class="admin-bar">
                <div class="admin-bar__row">
                  <span>${AIRent.escapeHtml(item[labelKey])}</span>
                  <span>${AIRent.escapeHtml(item.count)}</span>
                </div>
                <div class="admin-bar__track">
                  <div
                    class="admin-bar__fill"
                    style="width: ${(item.count / maxValue) * 100}%"
                  ></div>
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function createTrendGroup(title, items) {
  const maxValue = Math.max(...items.map((item) => item.count || 0), 1);
  return `
    <article class="admin-item">
      <strong>${AIRent.escapeHtml(title)}</strong>
      <div class="admin-bars">
        ${items
          .map(
            (item) => `
              <div class="admin-bar">
                <div class="admin-bar__row">
                  <span>${AIRent.escapeHtml(item.month)}</span>
                  <span>${AIRent.escapeHtml(item.count)}</span>
                </div>
                <div class="admin-bar__track">
                  <div
                    class="admin-bar__fill"
                    style="width: ${(item.count / maxValue) * 100}%"
                  ></div>
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

async function loadReports() {
  setMessage("Loading reports...", "info");

  const query = AIRent.buildQuery({
    days: state.reports.days,
    months: state.reports.months,
  });
  const result = await AIRent.fetchApi(`/api/v1/admin/reports?${query}`, {
    auth: true,
  });

  if (!result.ok || !result.data?.success) {
    setMessage(result.data?.message || "Failed to load reports.", "error");
    return;
  }

  const report = result.data.data;
  reportsStats.innerHTML = [
    createReportStat("Booked value", AIRent.formatMoney(report.revenue.bookedValue), `${report.period.days} day window`),
    createReportStat("Platform fees", AIRent.formatMoney(report.revenue.bookedPlatformFees), "Booked rentals"),
    createReportStat("Completed value", AIRent.formatMoney(report.revenue.completedValue), "Completed rentals"),
    createReportStat("Average rating", String(report.quality.averageRating || 0), `${report.quality.totalReviews} reviews`),
    createReportStat("Completion rate", `${report.quality.completionRate}%`, "Request to completion"),
  ].join("");

  renderSimpleList(
    reportsDistributions,
    [
      createBarGroup("Users by role", report.distributions.usersByRole, "role"),
      createBarGroup("Users by status", report.distributions.usersByStatus, "status"),
      createBarGroup("Products by status", report.distributions.productsByStatus, "status"),
      createBarGroup("Rentals by status", report.distributions.rentalsByStatus, "status"),
    ],
    "No report distributions available.",
  );

  renderSimpleList(
    reportsTrends,
    [
      createTrendGroup("User registrations", report.trends.userRegistrations),
      createTrendGroup("Product submissions", report.trends.productSubmissions),
      createTrendGroup("Rental requests", report.trends.rentalRequests),
    ],
    "No report trends available.",
  );

  renderSimpleList(
    reportsCategories,
    report.leaderboards.categoriesByListings.map(
      (category) => `
        <article class="admin-item">
          <div class="admin-item__header">
            <strong>${AIRent.escapeHtml(category.name)}</strong>
            <span class="tag tag--light">${AIRent.escapeHtml(category.totalProducts)}</span>
          </div>
          <p class="admin-item__summary">Total products in this category.</p>
        </article>
      `,
    ),
    "No categories found.",
  );

  renderSimpleList(
    reportsProducts,
    report.leaderboards.productsByRentals.map(
      (product) => `
        <article class="admin-item">
          <div class="admin-item__header">
            <strong>${AIRent.escapeHtml(product.title)}</strong>
            <span class="tag tag--light">${AIRent.escapeHtml(product.totalRentals)}</span>
          </div>
          <p class="admin-item__meta">
            Owner: ${AIRent.escapeHtml(product.owner?.name || "Unknown")}
          </p>
          <p class="admin-item__summary">
            Rating ${AIRent.escapeHtml(product.avgRating || 0)} |
            ${AIRent.escapeHtml(product.status)}
          </p>
        </article>
      `,
    ),
    "No products found.",
  );

  setLastSync();
  setMessage("Reports loaded successfully.", "success");
}

function resetCategoryEditor() {
  state.editingCategoryId = null;
  categoryForm.reset();
  categoryFormMode.textContent = "Category studio";
  categoryFormTitle.textContent = "Create category";
  categorySubmitBtn.textContent = "Create Category";
  categoryCancelBtn.hidden = true;
  document.getElementById("categoryIsActive").value = "true";
}

function populateCategoryParentOptions() {
  const options = state.categories
    .filter((category) => category.id !== state.editingCategoryId)
    .map(
      (category) => `
        <option value="${AIRent.escapeHtml(category.id)}">
          ${AIRent.escapeHtml(category.name)}
        </option>
      `,
    )
    .join("");

  categoryParentId.innerHTML = `<option value="">No parent</option>${options}`;
}

function createCategoryItem(category) {
  return `
    <article class="admin-item">
      <div class="admin-item__header">
        <strong>${AIRent.escapeHtml(category.name)}</strong>
        <span class="tag ${category.isActive ? "tag--light" : ""}">
          ${category.isActive ? "Active" : "Inactive"}
        </span>
      </div>
      <div class="admin-item__footer">
        <span>${AIRent.escapeHtml(category.parent?.name || "Top level")}</span>
        <span>Products: ${AIRent.escapeHtml(category._count?.products || 0)}</span>
        <span>Children: ${AIRent.escapeHtml(category._count?.children || 0)}</span>
      </div>
      <p class="admin-item__summary">${AIRent.escapeHtml(
        category.description || "No description provided.",
      )}</p>
      <div class="admin-item__actions">
        <button
          type="button"
          class="btn btn--secondary btn--small"
          data-category-action="edit"
          data-category-id="${AIRent.escapeHtml(category.id)}"
        >
          Edit
        </button>
        <button
          type="button"
          class="btn btn--ghost btn--small"
          data-category-action="delete"
          data-category-id="${AIRent.escapeHtml(category.id)}"
          data-category-name="${AIRent.escapeHtml(category.name)}"
        >
          Delete
        </button>
      </div>
    </article>
  `;
}

async function loadCategories() {
  setMessage("Loading categories...", "info");

  const result = await AIRent.fetchApi("/api/v1/categories");
  if (!result.ok || !result.data?.success) {
    setMessage(result.data?.message || "Failed to load categories.", "error");
    return;
  }

  state.categories = result.data.data.categories || [];
  populateCategoryParentOptions();

  renderSimpleList(
    categoriesList,
    state.categories.map(createCategoryItem),
    "No categories available.",
  );

  setLastSync();
  setMessage("Categories loaded successfully.", "success");
}

async function loadActivePanel() {
  if (state.activePanel === "overview") await loadOverview();
  if (state.activePanel === "notifications") await loadNotifications();
  if (state.activePanel === "users") await loadUsers();
  if (state.activePanel === "products") await loadProducts();
  if (state.activePanel === "rentals") await loadRentals();
  if (state.activePanel === "reports") await loadReports();
  if (state.activePanel === "categories") await loadCategories();
}

panelButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    setActivePanel(button.dataset.panel);
    await loadActivePanel();
  });
});

adminRefreshBtn.addEventListener("click", async () => {
  await loadActivePanel();
});

markAllReadBtn.addEventListener("click", async () => {
  const result = await AIRent.fetchApi("/api/v1/notifications/read-all", {
    method: "PUT",
    auth: true,
  });

  setMessage(
    result.data?.message || "Notifications updated.",
    result.ok ? "success" : "error",
  );

  if (result.ok) {
    await refreshUnreadCount();
    if (state.activePanel === "notifications") {
      await loadNotifications();
    }
  }
});

notificationsFilterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(notificationsFilterForm);
  state.notifications.page = 1;
  state.notifications.isRead = String(formData.get("isRead") || "");
  state.notifications.type = String(formData.get("type") || "");
  state.notifications.limit = String(formData.get("limit") || "10");
  await loadNotifications();
});

notificationsResetBtn.addEventListener("click", async () => {
  notificationsFilterForm.reset();
  state.notifications = {
    page: 1,
    limit: "10",
    isRead: "",
    type: "",
    pagination: null,
  };
  await loadNotifications();
});

notificationsPrevBtn.addEventListener("click", async () => {
  if (!state.notifications.pagination?.hasPreviousPage) {
    return;
  }

  state.notifications.page -= 1;
  await loadNotifications();
});

notificationsNextBtn.addEventListener("click", async () => {
  if (!state.notifications.pagination?.hasNextPage) {
    return;
  }

  state.notifications.page += 1;
  await loadNotifications();
});

notificationsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-notification-id]");
  if (!button) {
    return;
  }

  const result = await AIRent.fetchApi(
    `/api/v1/notifications/${button.dataset.notificationId}/read`,
    {
      method: "PUT",
      auth: true,
    },
  );

  setMessage(
    result.data?.message || "Notification updated.",
    result.ok ? "success" : "error",
  );

  if (result.ok) {
    await loadNotifications();
  }
});

usersFilterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(usersFilterForm);
  state.users.page = 1;
  state.users.search = String(formData.get("search") || "").trim();
  state.users.role = String(formData.get("role") || "");
  state.users.isActive = String(formData.get("isActive") || "");
  await loadUsers();
});

usersResetBtn.addEventListener("click", async () => {
  usersFilterForm.reset();
  state.users = {
    page: 1,
    search: "",
    role: "",
    isActive: "",
    pagination: null,
  };
  await loadUsers();
});

usersPrevBtn.addEventListener("click", async () => {
  if (!state.users.pagination?.hasPreviousPage) {
    return;
  }

  state.users.page -= 1;
  await loadUsers();
});

usersNextBtn.addEventListener("click", async () => {
  if (!state.users.pagination?.hasNextPage) {
    return;
  }

  state.users.page += 1;
  await loadUsers();
});

usersList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-user-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.userAction;
  const isActive = action === "activate";
  const reason = window.prompt(
    `${action === "activate" ? "Optional activation note" : "Optional suspension reason"} for ${button.dataset.userName}:`,
  );

  const result = await AIRent.fetchApi(
    `/api/v1/admin/users/${button.dataset.userId}/status`,
    {
      method: "PUT",
      auth: true,
      body: {
        isActive,
        reason: reason?.trim() || undefined,
      },
    },
  );

  setMessage(
    result.data?.message || "User updated.",
    result.ok ? "success" : "error",
  );

  if (result.ok) {
    await loadUsers();
  }
});

productsFilterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(productsFilterForm);
  state.products.page = 1;
  state.products.search = String(formData.get("search") || "").trim();
  state.products.status = String(formData.get("status") || "");
  state.products.isApproved = String(formData.get("isApproved") || "");
  state.products.city = String(formData.get("city") || "").trim();
  await loadProducts();
});

productsResetBtn.addEventListener("click", async () => {
  productsFilterForm.reset();
  state.products = {
    page: 1,
    search: "",
    status: "",
    isApproved: "",
    city: "",
    pagination: null,
  };
  await loadProducts();
});

productsPrevBtn.addEventListener("click", async () => {
  if (!state.products.pagination?.hasPreviousPage) {
    return;
  }

  state.products.page -= 1;
  await loadProducts();
});

productsNextBtn.addEventListener("click", async () => {
  if (!state.products.pagination?.hasNextPage) {
    return;
  }

  state.products.page += 1;
  await loadProducts();
});

async function moderateProduct(productId, action) {
  const reason = window.prompt(
    `Optional reason for ${action === "approve" ? "approval" : "rejection"}:`,
  );
  const endpoint =
    action === "approve"
      ? `/api/v1/admin/products/${productId}/approve`
      : `/api/v1/admin/products/${productId}/reject`;

  const result = await AIRent.fetchApi(endpoint, {
    method: "PUT",
    auth: true,
    body: {
      reason: reason?.trim() || undefined,
    },
  });

  setMessage(
    result.data?.message || "Product updated.",
    result.ok ? "success" : "error",
  );

  if (result.ok) {
    await loadProducts();
    if (state.activePanel === "overview") {
      await loadOverview();
    }
  }
}

productsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-product-action]");
  if (!button) {
    return;
  }

  await moderateProduct(button.dataset.productId, button.dataset.productAction);
});

overviewProducts.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-product-action]");
  if (!button) {
    return;
  }

  await moderateProduct(button.dataset.productId, button.dataset.productAction);
});

rentalsFilterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(rentalsFilterForm);
  state.rentals.page = 1;
  state.rentals.search = String(formData.get("search") || "").trim();
  state.rentals.status = String(formData.get("status") || "");
  await loadRentals();
});

rentalsResetBtn.addEventListener("click", async () => {
  rentalsFilterForm.reset();
  state.rentals = {
    page: 1,
    search: "",
    status: "",
    pagination: null,
  };
  await loadRentals();
});

rentalsPrevBtn.addEventListener("click", async () => {
  if (!state.rentals.pagination?.hasPreviousPage) {
    return;
  }

  state.rentals.page -= 1;
  await loadRentals();
});

rentalsNextBtn.addEventListener("click", async () => {
  if (!state.rentals.pagination?.hasNextPage) {
    return;
  }

  state.rentals.page += 1;
  await loadRentals();
});

reportsFilterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(reportsFilterForm);
  state.reports.days = String(formData.get("days") || "30");
  state.reports.months = String(formData.get("months") || "6");
  await loadReports();
});

categoryCancelBtn.addEventListener("click", () => {
  resetCategoryEditor();
  populateCategoryParentOptions();
});

categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(categoryForm);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim() || null,
    iconUrl: String(formData.get("iconUrl") || "").trim() || null,
    parentId: String(formData.get("parentId") || "").trim() || null,
    isActive: String(formData.get("isActive")) === "true",
  };
  const sortOrder = String(formData.get("sortOrder") || "").trim();

  if (sortOrder) {
    payload.sortOrder = Number(sortOrder);
  }

  if (!payload.name) {
    setMessage("Category name is required.", "error");
    return;
  }

  const isEditing = Boolean(state.editingCategoryId);
  const result = await AIRent.fetchApi(
    isEditing
      ? `/api/v1/categories/${state.editingCategoryId}`
      : "/api/v1/categories",
    {
      method: isEditing ? "PUT" : "POST",
      auth: true,
      body: payload,
    },
  );

  setMessage(
    result.data?.message || "Category updated.",
    result.ok ? "success" : "error",
  );

  if (result.ok) {
    resetCategoryEditor();
    await loadCategories();
  }
});

categoriesList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-category-action]");
  if (!button) {
    return;
  }

  const category = state.categories.find(
    (item) => item.id === button.dataset.categoryId,
  );
  if (!category) {
    return;
  }

  if (button.dataset.categoryAction === "edit") {
    state.editingCategoryId = category.id;
    categoryFormMode.textContent = "Category editor";
    categoryFormTitle.textContent = `Edit ${category.name}`;
    categorySubmitBtn.textContent = "Save Changes";
    categoryCancelBtn.hidden = false;

    document.getElementById("categoryName").value = category.name || "";
    document.getElementById("categoryDescription").value =
      category.description || "";
    document.getElementById("categoryIconUrl").value = category.iconUrl || "";
    document.getElementById("categorySortOrder").value =
      category.sortOrder ?? "";
    document.getElementById("categoryIsActive").value = category.isActive
      ? "true"
      : "false";

    populateCategoryParentOptions();
    categoryParentId.value = category.parentId || "";
    return;
  }

  const confirmed = window.confirm(
    `Delete category "${button.dataset.categoryName}"?`,
  );
  if (!confirmed) {
    return;
  }

  const result = await AIRent.fetchApi(`/api/v1/categories/${category.id}`, {
    method: "DELETE",
    auth: true,
  });

  setMessage(
    result.data?.message || "Category deleted.",
    result.ok ? "success" : "error",
  );

  if (result.ok) {
    if (state.editingCategoryId === category.id) {
      resetCategoryEditor();
    }
    await loadCategories();
  }
});

(async function initializeAdminDashboard() {
  const user = await AIRent.requireAuth();
  if (!user) {
    return;
  }

  if (user.role !== "admin") {
    window.location.href = "/";
    return;
  }

  state.currentUser = user;
  adminName.textContent = user.name;
  adminEmail.textContent = user.email;

  await refreshUnreadCount();
  await loadOverview();
})();
