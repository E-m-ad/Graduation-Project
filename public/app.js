const STORAGE_KEY = "ai-rent.admin-dashboard.access-token";

const state = {
  accessToken: localStorage.getItem(STORAGE_KEY) ?? "",
  currentUser: null,
  activePanel: "overview",
  actionDialogResolver: null,
  editingCategoryId: null,
  queries: {
    users: { page: 1, limit: 8, search: "", role: "", isActive: "" },
    categories: { search: "", isActive: "", level: "" },
    products: {
      page: 1,
      limit: 8,
      search: "",
      status: "",
      isApproved: "",
      city: "",
    },
    rentals: { page: 1, limit: 8, search: "", status: "" },
    reports: { days: 30, months: 6 },
  },
  data: {
    overview: null,
    users: null,
    categories: null,
    products: null,
    rentals: null,
    reports: null,
    notifications: null,
  },
};

const panelMeta = {
  overview: {
    kicker: "Operations",
    title: "Overview",
  },
  users: {
    kicker: "Access Control",
    title: "Users",
  },
  categories: {
    kicker: "Catalog Structure",
    title: "Categories",
  },
  products: {
    kicker: "Moderation",
    title: "Products",
  },
  rentals: {
    kicker: "Oversight",
    title: "Rentals",
  },
  reports: {
    kicker: "Analytics",
    title: "Reports",
  },
};

const currencyFormatter = new Intl.NumberFormat("en-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
});

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dom = {
  body: document.body,
  authScreen: document.querySelector("#auth-screen"),
  accessScreen: document.querySelector("#access-screen"),
  dashboardShell: document.querySelector("#dashboard-shell"),
  loginForm: document.querySelector("#login-form"),
  refreshSessionButton: document.querySelector("#refresh-session-button"),
  authMessage: document.querySelector("#auth-message"),
  accessCopy: document.querySelector("#access-copy"),
  accessUserSummary: document.querySelector("#access-user-summary"),
  accessLogoutButton: document.querySelector("#access-logout-button"),
  accessReturnButton: document.querySelector("#access-return-button"),
  logoutButton: document.querySelector("#logout-button"),
  sidebarToggle: document.querySelector("#sidebar-toggle"),
  sidebarName: document.querySelector("#sidebar-name"),
  sidebarRole: document.querySelector("#sidebar-role"),
  sidebarAvatar: document.querySelector("#sidebar-avatar"),
  topbarName: document.querySelector("#topbar-name"),
  topbarEmail: document.querySelector("#topbar-email"),
  notificationCount: document.querySelector("#notification-count"),
  topbarRefresh: document.querySelector("#topbar-refresh"),
  panelKicker: document.querySelector("#panel-kicker"),
  panelTitle: document.querySelector("#panel-title"),
  statusPill: document.querySelector("#status-pill"),
  statusMessage: document.querySelector("#status-message"),
  lastSync: document.querySelector("#last-sync"),
  globalSearchForm: document.querySelector("#global-search-form"),
  globalSearchInput: document.querySelector("#global-search-input"),
  navItems: [...document.querySelectorAll(".nav-item")],
  panelViews: [...document.querySelectorAll(".panel-view")],
  overviewHeadline: document.querySelector("#overview-headline"),
  overviewCopy: document.querySelector("#overview-copy"),
  overviewPeriod: document.querySelector("#overview-period"),
  overviewFocus: document.querySelector("#overview-focus"),
  statsGrid: document.querySelector("#stats-grid"),
  growthGrid: document.querySelector("#growth-grid"),
  financialGrid: document.querySelector("#financial-grid"),
  notificationsList: document.querySelector("#notifications-list"),
  recentUsersList: document.querySelector("#recent-users-list"),
  pendingProductsList: document.querySelector("#pending-products-list"),
  recentRentalsBody: document.querySelector("#recent-rentals-body"),
  usersFilterForm: document.querySelector("#users-filter-form"),
  usersReset: document.querySelector("#users-reset"),
  usersList: document.querySelector("#users-list"),
  usersPrev: document.querySelector("#users-prev"),
  usersNext: document.querySelector("#users-next"),
  usersPageMeta: document.querySelector("#users-page-meta"),
  categoriesFilterForm: document.querySelector("#categories-filter-form"),
  categoriesReset: document.querySelector("#categories-reset"),
  categoriesSummary: document.querySelector("#categories-summary"),
  categoriesList: document.querySelector("#categories-list"),
  categoriesPageMeta: document.querySelector("#categories-page-meta"),
  categoryForm: document.querySelector("#category-form"),
  categoryFormMode: document.querySelector("#category-form-mode"),
  categoryFormTitle: document.querySelector("#category-form-title"),
  categoryFormCopy: document.querySelector("#category-form-copy"),
  categoryParentId: document.querySelector("#category-parent-id"),
  categorySubmit: document.querySelector("#category-submit"),
  categoryCancel: document.querySelector("#category-cancel"),
  productsFilterForm: document.querySelector("#products-filter-form"),
  productsReset: document.querySelector("#products-reset"),
  productsList: document.querySelector("#products-list"),
  productsPrev: document.querySelector("#products-prev"),
  productsNext: document.querySelector("#products-next"),
  productsPageMeta: document.querySelector("#products-page-meta"),
  rentalsFilterForm: document.querySelector("#rentals-filter-form"),
  rentalsReset: document.querySelector("#rentals-reset"),
  rentalsList: document.querySelector("#rentals-list"),
  rentalsPrev: document.querySelector("#rentals-prev"),
  rentalsNext: document.querySelector("#rentals-next"),
  rentalsPageMeta: document.querySelector("#rentals-page-meta"),
  reportsFilterForm: document.querySelector("#reports-filter-form"),
  reportsSummary: document.querySelector("#reports-summary"),
  reportDistributions: document.querySelector("#report-distributions"),
  reportTrends: document.querySelector("#report-trends"),
  reportCategories: document.querySelector("#report-categories"),
  reportProducts: document.querySelector("#report-products"),
  actionDialog: document.querySelector("#action-dialog"),
  actionForm: document.querySelector("#action-form"),
  actionKicker: document.querySelector("#action-kicker"),
  actionTitle: document.querySelector("#action-title"),
  actionDescription: document.querySelector("#action-description"),
  actionReasonField: document.querySelector("#action-reason-field"),
  actionReasonLabel: document.querySelector("#action-reason-label"),
  actionReason: document.querySelector("#action-reason"),
  actionConfirm: document.querySelector("#action-confirm"),
  actionCancel: document.querySelector("#action-cancel"),
  actionClose: document.querySelector("#action-close"),
  detailDialog: document.querySelector("#detail-dialog"),
  detailKicker: document.querySelector("#detail-kicker"),
  detailTitle: document.querySelector("#detail-title"),
  detailContent: document.querySelector("#detail-content"),
  detailClose: document.querySelector("#detail-close"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCurrency(value) {
  return currencyFormatter.format(Number(value ?? 0));
}

function formatCompactNumber(value) {
  return compactNumberFormatter.format(Number(value ?? 0));
}

function formatDate(value) {
  if (!value) return "N/A";
  return dateFormatter.format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "N/A";
  return dateTimeFormatter.format(new Date(value));
}

function formatPercentage(value) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function formatPlainNumber(value) {
  return new Intl.NumberFormat("en").format(Number(value ?? 0));
}

function parseBooleanString(value, fallback = undefined) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function pickPrimaryImage(record) {
  return record?.images?.[0]?.thumbnailUrl || record?.images?.[0]?.imageUrl || "";
}

function getInitials(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "AR";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function renderAvatarOrImage({ src, label, className = "avatar-thumb" }) {
  if (src) {
    return `<img class="${className}" src="${escapeHtml(src)}" alt="${escapeHtml(label)}" />`;
  }

  return `<div class="${className} pill">${escapeHtml(getInitials(label))}</div>`;
}

function renderStatusBadge(value) {
  const normalized = String(value ?? "unknown")
    .toLowerCase()
    .replaceAll(/\s+/g, "_");
  return `<span class="status-badge ${normalized}">${escapeHtml(
    String(value ?? "unknown").replaceAll("_", " "),
  )}</span>`;
}

function renderReadBadge(value) {
  return `<span class="status-badge ${value ? "read" : "unread"}">${
    value ? "Read" : "Unread"
  }</span>`;
}

function renderRoleBadge(value) {
  return renderStatusBadge(value);
}

function buildQuery(path, params = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    query.set(key, String(value));
  }

  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function setAccessToken(token) {
  state.accessToken = String(token ?? "").trim();

  if (state.accessToken) {
    localStorage.setItem(STORAGE_KEY, state.accessToken);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function setStatus(stateName, message) {
  dom.statusPill.dataset.state = stateName;
  dom.statusPill.textContent =
    stateName === "working"
      ? "Working"
      : stateName === "success"
        ? "Live"
        : stateName === "error"
          ? "Issue"
          : "Idle";
  dom.statusMessage.textContent = message;
}

function setAuthMessage(message) {
  dom.authMessage.textContent = message;
}

function setLastSync() {
  dom.lastSync.textContent = `Last synced ${formatDateTime(new Date())}`;
}

function showScreen(screenName) {
  dom.authScreen.hidden = screenName !== "auth";
  dom.accessScreen.hidden = screenName !== "access";
  dom.dashboardShell.hidden = screenName !== "dashboard";
}

function setTopbarMeta() {
  const currentMeta = panelMeta[state.activePanel];
  dom.panelKicker.textContent = currentMeta.kicker;
  dom.panelTitle.textContent = currentMeta.title;
}

function setUserShell(user) {
  state.currentUser = user;
  dom.sidebarName.textContent = user?.name ?? "Admin";
  dom.sidebarRole.textContent = user?.role ? `${user.role} role` : "Admin session";
  dom.topbarName.textContent = user?.name ?? "Admin";
  dom.topbarEmail.textContent = user?.email ?? "No active session";

  if (user?.avatarUrl) {
    dom.sidebarAvatar.src = user.avatarUrl;
    dom.sidebarAvatar.hidden = false;
  } else {
    dom.sidebarAvatar.hidden = true;
    dom.sidebarAvatar.removeAttribute("src");
  }
}

function renderStateMessage(message) {
  return `<div class="state-message">${escapeHtml(message)}</div>`;
}

function setPanelLoading(panelName) {
  const html = renderStateMessage("Loading...");

  if (panelName === "overview") {
    dom.statsGrid.innerHTML = html;
    dom.growthGrid.innerHTML = html;
    dom.financialGrid.innerHTML = html;
    dom.notificationsList.innerHTML = html;
    dom.recentUsersList.innerHTML = html;
    dom.pendingProductsList.innerHTML = html;
    dom.recentRentalsBody.innerHTML = `<tr><td colspan="7">${html}</td></tr>`;
  }

  if (panelName === "users") {
    dom.usersList.innerHTML = html;
  }

  if (panelName === "categories") {
    dom.categoriesSummary.innerHTML = html;
    dom.categoriesList.innerHTML = html;
    dom.categoriesPageMeta.textContent = "Loading categories...";
  }

  if (panelName === "products") {
    dom.productsList.innerHTML = html;
  }

  if (panelName === "rentals") {
    dom.rentalsList.innerHTML = html;
  }

  if (panelName === "reports") {
    dom.reportsSummary.innerHTML = html;
    dom.reportDistributions.innerHTML = html;
    dom.reportTrends.innerHTML = html;
    dom.reportCategories.innerHTML = html;
    dom.reportProducts.innerHTML = html;
  }
}

async function parseResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function rawRequest(path, options = {}) {
  const requestOptions = {
    method: options.method ?? "GET",
    credentials: "include",
    headers: { ...(options.headers ?? {}) },
  };

  if (options.body !== undefined) {
    requestOptions.headers["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(options.body);
  }

  if (options.withAuth && state.accessToken) {
    requestOptions.headers.Authorization = `Bearer ${state.accessToken}`;
  }

  const response = await fetch(path, requestOptions);
  const data = await parseResponse(response);
  return { response, data };
}

async function refreshAccessToken({ silent = false } = {}) {
  const { response, data } = await rawRequest("/api/v1/auth/refresh-token", {
    method: "POST",
  });

  if (!response.ok || !data?.accessToken) {
    if (!silent) {
      setStatus("error", data?.message ?? "Session refresh failed");
    }

    return false;
  }

  setAccessToken(data.accessToken);
  return true;
}

async function authedRequest(path, options = {}, retryOnAuth = true) {
  if (!state.accessToken) {
    const refreshed = await refreshAccessToken({ silent: true });
    if (!refreshed) {
      throw new Error("No active session. Please log in again.");
    }
  }

  let result = await rawRequest(path, { ...options, withAuth: true });

  if (result.response.status === 401 && retryOnAuth) {
    const refreshed = await refreshAccessToken({ silent: true });
    if (!refreshed) {
      throw new Error("Your session expired. Please log in again.");
    }

    result = await rawRequest(path, { ...options, withAuth: true });
  }

  if (result.response.status === 403) {
    throw new Error(result.data?.message ?? "Administrator access required");
  }

  if (!result.response.ok) {
    throw new Error(result.data?.message ?? `Request failed with ${result.response.status}`);
  }

  return result.data;
}

async function logoutSession({ silent = false } = {}) {
  try {
    await rawRequest("/api/v1/auth/logout", { method: "POST" });
  } catch {
    // Ignore logout failures when clearing local state.
  }

  setAccessToken("");
  state.currentUser = null;
  state.editingCategoryId = null;
  state.data = {
    overview: null,
    users: null,
    categories: null,
    products: null,
    rentals: null,
    reports: null,
    notifications: null,
  };
  setUserShell(null);
  resetCategoryEditor();
  if (!silent) {
    setStatus("idle", "Signed out. Waiting for an admin login.");
  }
  showScreen("auth");
  setAuthMessage("Sign in to load live admin analytics and moderation tools.");
}

async function handleAuthenticatedUser() {
  try {
    const profile = await authedRequest("/api/v1/users/me");
    const user = profile?.data;

    if (!user) {
      throw new Error("Unable to load the current user.");
    }

    if (user.role !== "admin") {
      await logoutSession({ silent: true });
      dom.accessUserSummary.innerHTML = `
        <p><strong>${escapeHtml(user.name ?? "User")}</strong></p>
        <p class="muted">${escapeHtml(user.email ?? "No email")}</p>
        <p class="muted">Current role: ${escapeHtml(user.role ?? "unknown")}</p>
      `;
      dom.accessCopy.textContent =
        "This account signed in successfully, but it is not an administrator account.";
      setStatus("error", "Non-admin account blocked from the dashboard.");
      showScreen("access");
      return false;
    }

    setUserShell(user);
    showScreen("dashboard");
    await refreshUnreadNotifications();
    await loadPanel(state.activePanel);
    return true;
  } catch (error) {
    await logoutSession({ silent: true });
    showScreen("auth");
    setAuthMessage(error.message);
    setStatus("error", error.message);
    return false;
  }
}

async function loginAdmin(credentials) {
  setStatus("working", "Signing in...");
  setAuthMessage("Validating credentials and loading your admin workspace...");

  const { response, data } = await rawRequest("/api/v1/auth/login", {
    method: "POST",
    body: credentials,
  });

  if (!response.ok || !data?.accessToken) {
    const message = data?.error?.message ?? data?.message ?? "Login failed";
    setStatus("error", message);
    setAuthMessage(message);
    return;
  }

  setAccessToken(data.accessToken);
  await handleAuthenticatedUser();
}

async function bootstrapSession() {
  showScreen("auth");
  setUserShell(null);
  setTopbarMeta();
  setStatus("idle", "Waiting for an admin login.");

  if (!state.accessToken) {
    const refreshed = await refreshAccessToken({ silent: true });
    if (!refreshed) {
      return;
    }
  }

  await handleAuthenticatedUser();
}

function setActivePanel(panelName, { shouldLoad = true } = {}) {
  state.activePanel = panelName;
  setTopbarMeta();

  for (const panel of dom.panelViews) {
    panel.classList.toggle("active", panel.id === `${panelName}-panel`);
  }

  for (const item of dom.navItems) {
    item.classList.toggle("active", item.dataset.panel === panelName);
  }

  dom.body.classList.remove("sidebar-open");

  if (shouldLoad) {
    loadPanel(panelName);
  }
}

async function loadPanel(panelName) {
  setPanelLoading(panelName);
  setStatus("working", `Loading ${panelMeta[panelName].title.toLowerCase()}...`);

  try {
    if (panelName === "overview") {
      await loadOverview();
    }

    if (panelName === "users") {
      await loadUsers();
    }

    if (panelName === "categories") {
      await loadCategories();
    }

    if (panelName === "products") {
      await loadProducts();
    }

    if (panelName === "rentals") {
      await loadRentals();
    }

    if (panelName === "reports") {
      await loadReports();
    }

    await refreshUnreadNotifications();
    setLastSync();
    setStatus("success", `${panelMeta[panelName].title} is up to date.`);
  } catch (error) {
    setStatus("error", error.message);
    renderPanelError(panelName, error.message);
  }
}

function renderPanelError(panelName, message) {
  const html = renderStateMessage(message);

  if (panelName === "overview") {
    dom.statsGrid.innerHTML = html;
    dom.growthGrid.innerHTML = html;
    dom.financialGrid.innerHTML = html;
    dom.notificationsList.innerHTML = html;
    dom.recentUsersList.innerHTML = html;
    dom.pendingProductsList.innerHTML = html;
    dom.recentRentalsBody.innerHTML = `<tr><td colspan="7">${html}</td></tr>`;
  }

  if (panelName === "users") {
    dom.usersList.innerHTML = html;
  }

  if (panelName === "categories") {
    dom.categoriesSummary.innerHTML = html;
    dom.categoriesList.innerHTML = html;
    dom.categoriesPageMeta.textContent = "Category loading failed";
  }

  if (panelName === "products") {
    dom.productsList.innerHTML = html;
  }

  if (panelName === "rentals") {
    dom.rentalsList.innerHTML = html;
  }

  if (panelName === "reports") {
    dom.reportsSummary.innerHTML = html;
    dom.reportDistributions.innerHTML = html;
    dom.reportTrends.innerHTML = html;
    dom.reportCategories.innerHTML = html;
    dom.reportProducts.innerHTML = html;
  }
}

async function refreshUnreadNotifications() {
  try {
    const data = await authedRequest("/api/v1/notifications/unread-count");
    dom.notificationCount.textContent = String(data?.data?.unreadCount ?? 0);
  } catch {
    dom.notificationCount.textContent = "0";
  }
}

function renderOverviewStats(summary, financial) {
  const cards = [
    {
      label: "Total users",
      value: summary?.users?.total ?? 0,
      meta: `${summary?.users?.active ?? 0} active`,
    },
    {
      label: "Pending products",
      value: summary?.products?.pendingReview ?? 0,
      meta: `${summary?.products?.approved ?? 0} approved`,
    },
    {
      label: "Total rentals",
      value: summary?.rentals?.total ?? 0,
      meta: `${summary?.rentals?.pending ?? 0} pending`,
    },
    {
      label: "Overdue rentals",
      value: summary?.rentals?.overdue ?? 0,
      meta: `${summary?.rentals?.active ?? 0} active`,
    },
    {
      label: "Completed rentals",
      value: summary?.rentals?.completed ?? 0,
      meta: "Lifecycle closed",
    },
    {
      label: "Reviews",
      value: summary?.content?.reviews ?? 0,
      meta: `${summary?.content?.categories ?? 0} categories`,
    },
    {
      label: "Booked value",
      value: formatCurrency(financial?.bookedValue ?? 0),
      meta: "Booked rental volume",
    },
    {
      label: "Platform fees",
      value: formatCurrency(financial?.platformFees ?? 0),
      meta: "Captured fees",
    },
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

function renderNotifications(notifications) {
  if (!notifications.length) {
    dom.notificationsList.innerHTML = renderStateMessage("No recent notifications.");
    return;
  }

  dom.notificationsList.innerHTML = notifications
    .map(
      (notification) => `
        <article class="notification-row">
          <div class="notification-row-head">
            <strong>${escapeHtml(notification.title ?? "System update")}</strong>
            ${renderReadBadge(notification.isRead)}
          </div>
          <p class="muted">${escapeHtml(
            notification.message ?? "No details available.",
          )}</p>
          <div class="stack-meta">
            ${renderStatusBadge(notification.type ?? "system")}
            <span>${escapeHtml(formatDateTime(notification.createdAt))}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderRecentUsers(users) {
  if (!users.length) {
    dom.recentUsersList.innerHTML = renderStateMessage("No recent user activity.");
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
    dom.recentRentalsBody.innerHTML =
      `<tr><td colspan="7">${renderStateMessage("No rental activity found.")}</td></tr>`;
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

async function loadOverview() {
  const [dashboard, reports, notifications] = await Promise.all([
    authedRequest("/api/v1/admin/dashboard"),
    authedRequest(buildQuery("/api/v1/admin/reports", state.queries.reports)),
    authedRequest("/api/v1/notifications?limit=5"),
  ]);

  state.data.overview = dashboard?.data;
  state.data.reports = reports?.data;
  state.data.notifications = notifications?.data;

  const overview = dashboard?.data ?? {};
  const reportData = reports?.data ?? {};
  const notificationData = notifications?.data ?? {};

  dom.overviewHeadline.textContent = `Monitor ${
    overview?.summary?.rentals?.pending ?? 0
  } pending rentals and ${
    overview?.summary?.products?.pendingReview ?? 0
  } products in review.`;
  dom.overviewCopy.textContent =
    "The console highlights the metrics, moderation items, and operational signals that need attention first.";
  dom.overviewPeriod.textContent = `${state.queries.reports.days} days`;
  dom.overviewFocus.textContent =
    (overview?.summary?.products?.pendingReview ?? 0) > 0
      ? "Pending product moderation"
      : "Healthy moderation queue";

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
  renderNotifications(notificationData?.notifications ?? []);
  renderRecentUsers(overview?.recent?.users ?? []);
  renderPendingProducts(overview?.recent?.pendingProducts ?? []);
  renderRecentRentals(overview?.recent?.rentals ?? []);
}

function renderPagination(metaElement, prevButton, nextButton, pagination) {
  const currentPage = pagination?.page ?? 1;
  const totalPages = pagination?.totalPages ?? 1;
  const totalItems = pagination?.totalItems ?? 0;
  metaElement.textContent = `Page ${currentPage} of ${Math.max(totalPages, 1)} · ${totalItems} items`;
  prevButton.disabled = !pagination?.hasPreviousPage;
  nextButton.disabled = !pagination?.hasNextPage;
}

function renderUserCard(user) {
  const avatar = renderAvatarOrImage({
    src: user.avatarUrl,
    label: user.name ?? "User",
  });

  return `
    <article class="entity-card">
      <div class="entity-head">
        <div class="thumb-line">
          ${avatar}
          <div>
            <div class="entity-title">${escapeHtml(user.name ?? "Unnamed user")}</div>
            <div class="muted">${escapeHtml(user.email ?? "No email")}</div>
          </div>
        </div>
        <div class="entity-actions">
          <button type="button" class="ghost" data-action="view-user" data-id="${escapeHtml(user.id)}">Details</button>
          <button
            type="button"
            class="${user.isActive ? "warn" : ""}"
            data-action="toggle-user-status"
            data-id="${escapeHtml(user.id)}"
            data-next="${user.isActive ? "false" : "true"}"
          >
            ${user.isActive ? "Suspend" : "Reactivate"}
          </button>
        </div>
      </div>
      <div class="entity-meta">
        ${renderRoleBadge(user.role ?? "unknown")}
        ${renderStatusBadge(user.isActive ? "active" : "suspended")}
        ${renderStatusBadge(user.isVerified ? "verified" : "unverified")}
        <span>${escapeHtml(user.city ?? "No city")}</span>
        <span>Joined ${escapeHtml(formatDate(user.createdAt))}</span>
      </div>
      <div class="metric-grid">
        <div class="metric-chip">
          <span>Listings</span>
          <strong>${escapeHtml(formatCompactNumber(user?._count?.productsOwned ?? 0))}</strong>
        </div>
        <div class="metric-chip">
          <span>Rentals as renter</span>
          <strong>${escapeHtml(formatCompactNumber(user?._count?.rentalsAsRenter ?? 0))}</strong>
        </div>
        <div class="metric-chip">
          <span>Rentals as owner</span>
          <strong>${escapeHtml(formatCompactNumber(user?._count?.rentalsAsOwner ?? 0))}</strong>
        </div>
        <div class="metric-chip">
          <span>Notifications</span>
          <strong>${escapeHtml(formatCompactNumber(user?._count?.notifications ?? 0))}</strong>
        </div>
      </div>
    </article>
  `;
}

async function loadUsers() {
  const data = await authedRequest(buildQuery("/api/v1/admin/users", state.queries.users));
  state.data.users = data?.data;

  const users = state.data.users?.users ?? [];
  if (!users.length) {
    dom.usersList.innerHTML = renderStateMessage("No users matched the current filters.");
  } else {
    dom.usersList.innerHTML = users.map(renderUserCard).join("");
  }

  renderPagination(
    dom.usersPageMeta,
    dom.usersPrev,
    dom.usersNext,
    state.data.users?.pagination,
  );
}

function buildCategoryDepthMap(categories) {
  const childrenByParent = new Map();

  for (const category of categories) {
    const key = category.parentId ?? "__root__";
    const currentChildren = childrenByParent.get(key) ?? [];
    currentChildren.push(category);
    childrenByParent.set(key, currentChildren);
  }

  const depthById = new Map();

  function visit(parentId, depth) {
    const key = parentId ?? "__root__";
    const children = childrenByParent.get(key) ?? [];

    for (const child of children) {
      depthById.set(child.id, depth);
      visit(child.id, depth + 1);
    }
  }

  visit(null, 0);
  return depthById;
}

function getCategoryDescendantIds(categories, categoryId) {
  const childrenByParent = new Map();

  for (const category of categories) {
    const key = category.parentId ?? "__root__";
    const currentChildren = childrenByParent.get(key) ?? [];
    currentChildren.push(category);
    childrenByParent.set(key, currentChildren);
  }

  const blockedIds = new Set([categoryId]);
  const queue = [categoryId];

  while (queue.length) {
    const currentId = queue.shift();
    const children = childrenByParent.get(currentId) ?? [];

    for (const child of children) {
      if (!blockedIds.has(child.id)) {
        blockedIds.add(child.id);
        queue.push(child.id);
      }
    }
  }

  return blockedIds;
}

function populateCategoryParentOptions({
  selectedParentId = "",
  editingCategoryId = state.editingCategoryId,
} = {}) {
  const categories = state.data.categories ?? [];
  const blockedIds = editingCategoryId
    ? getCategoryDescendantIds(categories, editingCategoryId)
    : new Set();
  const depthById = buildCategoryDepthMap(categories);

  const options = categories
    .filter((category) => !blockedIds.has(category.id))
    .map((category) => {
      const depth = depthById.get(category.id) ?? 0;
      const prefix = depth > 0 ? `${"- ".repeat(depth)}` : "";
      const isSelected = (selectedParentId ?? "") === category.id ? " selected" : "";

      return `<option value="${escapeHtml(category.id)}"${isSelected}>${escapeHtml(
        `${prefix}${category.name ?? "Unnamed category"}`,
      )}</option>`;
    })
    .join("");

  dom.categoryParentId.innerHTML = `
    <option value="">No parent (top-level)</option>
    ${options}
  `;
}

function resetCategoryEditor() {
  state.editingCategoryId = null;
  dom.categoryForm.reset();
  dom.categoryFormMode.textContent = "Category studio";
  dom.categoryFormTitle.textContent = "Create category";
  dom.categoryFormCopy.textContent =
    "Add marketplace categories, subcategories, icons, and sort priority from one admin workspace.";
  dom.categorySubmit.textContent = "Create category";
  dom.categoryCancel.hidden = true;
  dom.categoryForm.elements.namedItem("isActive").value = "true";
  populateCategoryParentOptions();
}

function beginCategoryEdit(categoryId, { scroll = true } = {}) {
  const category = findById(state.data.categories, categoryId);
  if (!category) return;

  state.editingCategoryId = category.id;
  dom.categoryFormMode.textContent = "Category editor";
  dom.categoryFormTitle.textContent = `Edit ${category.name ?? "category"}`;
  dom.categoryFormCopy.textContent =
    "Adjust naming, hierarchy, icon, visibility, and sorting for this catalog node.";
  dom.categorySubmit.textContent = "Save changes";
  dom.categoryCancel.hidden = false;

  dom.categoryForm.elements.namedItem("name").value = category.name ?? "";
  dom.categoryForm.elements.namedItem("description").value = category.description ?? "";
  dom.categoryForm.elements.namedItem("iconUrl").value = category.iconUrl ?? "";
  dom.categoryForm.elements.namedItem("sortOrder").value = category.sortOrder ?? "";
  dom.categoryForm.elements.namedItem("isActive").value = category.isActive
    ? "true"
    : "false";

  populateCategoryParentOptions({
    selectedParentId: category.parentId ?? "",
    editingCategoryId: category.id,
  });

  if (scroll) {
    dom.categoryForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function buildCategoryPayload() {
  const formData = new FormData(dom.categoryForm);
  const sortOrder = String(formData.get("sortOrder") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const iconUrl = String(formData.get("iconUrl") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  return {
    name,
    description: description || null,
    iconUrl: iconUrl || null,
    parentId: parentId || null,
    sortOrder: sortOrder === "" ? undefined : Number(sortOrder),
    isActive: parseBooleanString(String(formData.get("isActive") ?? "true"), true),
  };
}

function filterCategories(categories) {
  const search = state.queries.categories.search.trim().toLowerCase();
  const statusFilter = parseBooleanString(state.queries.categories.isActive);
  const levelFilter = state.queries.categories.level;

  return categories.filter((category) => {
    if (search) {
      const haystack = [
        category.name,
        category.description,
        category.parent?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (statusFilter !== undefined && category.isActive !== statusFilter) {
      return false;
    }

    if (levelFilter === "root" && category.parentId) {
      return false;
    }

    if (levelFilter === "child" && !category.parentId) {
      return false;
    }

    return true;
  });
}

function renderCategorySummary(allCategories, visibleCategories) {
  const metrics = [
    {
      label: "Visible now",
      value: formatPlainNumber(visibleCategories.length),
    },
    {
      label: "Total categories",
      value: formatPlainNumber(allCategories.length),
    },
    {
      label: "Active",
      value: formatPlainNumber(allCategories.filter((category) => category.isActive).length),
    },
    {
      label: "Top-level",
      value: formatPlainNumber(allCategories.filter((category) => !category.parentId).length),
    },
    {
      label: "Subcategories",
      value: formatPlainNumber(allCategories.filter((category) => category.parentId).length),
    },
    {
      label: "Linked products",
      value: formatPlainNumber(
        allCategories.reduce(
          (total, category) => total + Number(category?._count?.products ?? 0),
          0,
        ),
      ),
    },
  ];

  dom.categoriesSummary.innerHTML = metrics
    .map(
      (metric) => `
        <div class="metric-chip">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metric.value)}</strong>
        </div>
      `,
    )
    .join("");

  dom.categoriesPageMeta.textContent = `${formatPlainNumber(
    visibleCategories.length,
  )} of ${formatPlainNumber(allCategories.length)} categories`;
}

function renderCategoryCard(category) {
  const icon = renderAvatarOrImage({
    src: category.iconUrl,
    label: category.name ?? "Category",
    className: "entity-thumb",
  });

  return `
    <article class="entity-card">
      <div class="entity-head">
        <div class="thumb-line">
          ${icon}
          <div>
            <div class="entity-title">${escapeHtml(category.name ?? "Unnamed category")}</div>
            <div class="muted">
              ${escapeHtml(
                category.parent?.name
                  ? `Parent: ${category.parent.name}`
                  : "Top-level category",
              )}
            </div>
          </div>
        </div>
        <div class="entity-actions">
          <button type="button" class="ghost" data-action="view-category" data-id="${escapeHtml(category.id)}">Details</button>
          <button type="button" class="ghost" data-action="edit-category" data-id="${escapeHtml(category.id)}">Edit</button>
          <button
            type="button"
            class="${category.isActive ? "warn" : ""}"
            data-action="toggle-category-status"
            data-id="${escapeHtml(category.id)}"
            data-next="${category.isActive ? "false" : "true"}"
          >
            ${category.isActive ? "Deactivate" : "Activate"}
          </button>
          <button type="button" class="warn" data-action="delete-category" data-id="${escapeHtml(category.id)}">Delete</button>
        </div>
      </div>
      <div class="entity-meta">
        ${renderStatusBadge(category.isActive ? "active" : "inactive")}
        <span class="pill">${escapeHtml(category.parentId ? "Subcategory" : "Top-level")}</span>
        <span>Sort ${escapeHtml(String(category.sortOrder ?? 0))}</span>
        <span>Updated ${escapeHtml(formatDate(category.updatedAt))}</span>
      </div>
      <p class="muted">${escapeHtml(category.description ?? "No description provided.")}</p>
      <div class="metric-grid">
        <div class="metric-chip">
          <span>Products</span>
          <strong>${escapeHtml(formatPlainNumber(category?._count?.products ?? 0))}</strong>
        </div>
        <div class="metric-chip">
          <span>Children</span>
          <strong>${escapeHtml(formatPlainNumber(category?._count?.children ?? 0))}</strong>
        </div>
        <div class="metric-chip">
          <span>Created</span>
          <strong>${escapeHtml(formatDate(category.createdAt))}</strong>
        </div>
        <div class="metric-chip">
          <span>Icon</span>
          <strong>${escapeHtml(category.iconUrl ? "Linked" : "None")}</strong>
        </div>
      </div>
    </article>
  `;
}

async function loadCategories() {
  const data = await authedRequest("/api/v1/categories");
  state.data.categories = data?.data?.categories ?? [];

  if (state.editingCategoryId) {
    const editingCategory = findById(state.data.categories, state.editingCategoryId);
    if (editingCategory) {
      beginCategoryEdit(editingCategory.id, { scroll: false });
    } else {
      resetCategoryEditor();
    }
  } else {
    populateCategoryParentOptions();
  }

  const allCategories = state.data.categories ?? [];
  const visibleCategories = filterCategories(allCategories);

  renderCategorySummary(allCategories, visibleCategories);

  if (!visibleCategories.length) {
    dom.categoriesList.innerHTML = renderStateMessage(
      allCategories.length
        ? "No categories matched the current filters."
        : "No categories exist yet. Create the first category to structure the marketplace.",
    );
    return;
  }

  dom.categoriesList.innerHTML = visibleCategories.map(renderCategoryCard).join("");
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

async function loadProducts() {
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

async function loadRentals() {
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

async function loadReports() {
  const data = await authedRequest(
    buildQuery("/api/v1/admin/reports", state.queries.reports),
  );
  state.data.reports = data?.data;
  const reportData = state.data.reports ?? {};

  renderReportStats(reportData);

  dom.reportDistributions.innerHTML = [
    renderDistributionCard("Users by role", reportData?.distributions?.usersByRole ?? []),
    renderDistributionCard("Users by status", reportData?.distributions?.usersByStatus ?? []),
    renderDistributionCard("Products by status", reportData?.distributions?.productsByStatus ?? []),
    renderDistributionCard("Rentals by status", reportData?.distributions?.rentalsByStatus ?? []),
  ].join("");

  dom.reportTrends.innerHTML = [
    renderTrendCard("User registrations", reportData?.trends?.userRegistrations ?? []),
    renderTrendCard("Product submissions", reportData?.trends?.productSubmissions ?? []),
    renderTrendCard("Rental requests", reportData?.trends?.rentalRequests ?? []),
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

function createDetailSection(title, rows) {
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

function openDetailDialog({ kicker = "Details", title, content }) {
  dom.detailKicker.textContent = kicker;
  dom.detailTitle.textContent = title;
  dom.detailContent.innerHTML = content;
  dom.detailDialog.showModal();
}

function closeDetailDialog() {
  dom.detailDialog.close();
  dom.detailContent.innerHTML = "";
}

function showActionDialog({
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

function closeActionDialog(result = { confirmed: false, reason: "" }) {
  if (state.actionDialogResolver) {
    state.actionDialogResolver.resolve(result);
    state.actionDialogResolver = null;
  }

  dom.actionDialog.close();
}

function findById(collection, id) {
  return (collection ?? []).find((item) => item.id === id) ?? null;
}

function viewUserDetails(id) {
  const user = findById(state.data.users?.users, id);
  if (!user) return;

  const content = `
    <div class="detail-grid">
      ${createDetailSection("Profile", [
        { label: "Name", value: user.name ?? "N/A" },
        { label: "Email", value: user.email ?? "N/A" },
        { label: "Phone", value: user.phone ?? "N/A" },
        { label: "City", value: user.city ?? "N/A" },
        { label: "Role", value: user.role ?? "N/A" },
        { label: "Status", value: user.isActive ? "Active" : "Suspended" },
      ])}
      ${createDetailSection("Activity", [
        { label: "Listings", value: String(user?._count?.productsOwned ?? 0) },
        { label: "Rentals as renter", value: String(user?._count?.rentalsAsRenter ?? 0) },
        { label: "Rentals as owner", value: String(user?._count?.rentalsAsOwner ?? 0) },
        { label: "Reviews", value: String(user?._count?.reviewsWritten ?? 0) },
        { label: "Wishlists", value: String(user?._count?.wishlists ?? 0) },
        { label: "Notifications", value: String(user?._count?.notifications ?? 0) },
      ])}
    </div>
    <section class="detail-block">
      <h4>Biography</h4>
      <p class="muted">${escapeHtml(user.bio ?? "No biography provided.")}</p>
    </section>
  `;

  openDetailDialog({
    kicker: "User profile",
    title: user.name ?? "User details",
    content,
  });
}

function viewProductDetails(id) {
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
        { label: "Price / hour", value: product.pricePerHour ? formatCurrency(product.pricePerHour) : "N/A" },
        { label: "Price / day", value: product.pricePerDay ? formatCurrency(product.pricePerDay) : "N/A" },
        { label: "Price / week", value: product.pricePerWeek ? formatCurrency(product.pricePerWeek) : "N/A" },
        { label: "Price / month", value: product.pricePerMonth ? formatCurrency(product.pricePerMonth) : "N/A" },
        { label: "Deposit", value: formatCurrency(product.securityDeposit ?? 0) },
        { label: "Approval", value: product.isApproved ? "Approved" : "Unapproved" },
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

function viewRentalDetails(id) {
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
        { label: "Deposit", value: formatCurrency(rental.securityDeposit ?? 0) },
        { label: "Platform fee", value: formatCurrency(rental.platformFee ?? 0) },
        { label: "Review", value: rental.review?.rating ? `${rental.review.rating}/5` : "No review" },
        { label: "Returned at", value: rental.actualReturnDate ? formatDateTime(rental.actualReturnDate) : "N/A" },
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

async function viewCategoryDetails(id) {
  const data = await authedRequest(`/api/v1/categories/${id}`);
  const category = data?.data;

  if (!category) {
    throw new Error("Unable to load category details.");
  }

  const childrenContent = category.children?.length
    ? `
      <div class="detail-gallery">
        ${category.children
          .map(
            (child) => `
              <div class="detail-block">
                <strong>${escapeHtml(child.name ?? "Unnamed child")}</strong>
                <p class="muted">
                  ${escapeHtml(
                    `Sort ${child.sortOrder ?? 0} / ${child.isActive ? "Active" : "Inactive"}`,
                  )}
                </p>
              </div>
            `,
          )
          .join("")}
      </div>
    `
    : `<p class="muted">No child categories have been attached yet.</p>`;

  const iconPreview = category.iconUrl
    ? `
      <section class="detail-block">
        <h4>Icon</h4>
        <div class="detail-gallery">
          <img src="${escapeHtml(category.iconUrl)}" alt="${escapeHtml(category.name ?? "Category icon")}" />
        </div>
      </section>
    `
    : "";

  const content = `
    <div class="detail-grid">
      ${createDetailSection("Basics", [
        { label: "Name", value: category.name ?? "N/A" },
        { label: "Parent", value: category.parent?.name ?? "Top-level" },
        { label: "Status", value: category.isActive ? "Active" : "Inactive" },
        { label: "Sort order", value: String(category.sortOrder ?? 0) },
        { label: "Created", value: formatDateTime(category.createdAt) },
        { label: "Updated", value: formatDateTime(category.updatedAt) },
      ])}
      ${createDetailSection("Usage", [
        { label: "Child categories", value: String(category?._count?.children ?? 0) },
        { label: "Linked products", value: String(category?._count?.products ?? 0) },
        { label: "Level", value: category.parentId ? "Subcategory" : "Top-level" },
        { label: "Icon URL", value: category.iconUrl ?? "Not set" },
      ])}
    </div>
    <section class="detail-block">
      <h4>Description</h4>
      <p class="muted">${escapeHtml(category.description ?? "No description provided.")}</p>
    </section>
    <section class="detail-block">
      <h4>Children</h4>
      ${childrenContent}
    </section>
    ${iconPreview}
  `;

  openDetailDialog({
    kicker: "Category detail",
    title: category.name ?? "Category detail",
    content,
  });
}

async function saveCategory() {
  const payload = buildCategoryPayload();
  const isEditing = Boolean(state.editingCategoryId);

  setStatus(
    "working",
    `${isEditing ? "Saving" : "Creating"} category ${payload.name || "draft"}...`,
  );

  await authedRequest(
    isEditing ? `/api/v1/categories/${state.editingCategoryId}` : "/api/v1/categories",
    {
      method: isEditing ? "PUT" : "POST",
      body: payload,
    },
  );

  resetCategoryEditor();
  await loadCategories();
  setStatus(
    "success",
    `${payload.name || "Category"} ${isEditing ? "updated" : "created"} successfully.`,
  );
}

async function toggleCategoryStatus(id, nextValue) {
  const category = findById(state.data.categories, id);
  if (!category) return;

  const activate = nextValue === "true";
  const result = await showActionDialog({
    kicker: "Category status",
    title: activate ? "Activate category" : "Deactivate category",
    description: activate
      ? `Make ${category.name} available for new listings again.`
      : `Hide ${category.name} from active catalog operations without deleting it.`,
    confirmLabel: activate ? "Activate category" : "Deactivate category",
    confirmTone: activate ? "default" : "danger",
    showReasonField: false,
  });

  if (!result.confirmed) return;

  setStatus("working", `${activate ? "Activating" : "Deactivating"} ${category.name}...`);

  await authedRequest(`/api/v1/categories/${id}`, {
    method: "PUT",
    body: { isActive: activate },
  });

  await loadCategories();
  setStatus(
    "success",
    `${category.name} is now ${activate ? "active" : "inactive"}.`,
  );
}

async function deleteCategory(id) {
  const category = findById(state.data.categories, id);
  if (!category) return;

  const result = await showActionDialog({
    kicker: "Delete category",
    title: `Delete ${category.name}?`,
    description:
      "This permanently removes the category if it has no child categories and no linked products.",
    confirmLabel: "Delete category",
    confirmTone: "danger",
    showReasonField: false,
  });

  if (!result.confirmed) return;

  setStatus("working", `Deleting ${category.name}...`);

  await authedRequest(`/api/v1/categories/${id}`, {
    method: "DELETE",
  });

  if (state.editingCategoryId === id) {
    resetCategoryEditor();
  }

  await loadCategories();
  setStatus("success", `${category.name} deleted successfully.`);
}

async function toggleUserStatus(id, nextValue) {
  const user = findById(state.data.users?.users, id);
  if (!user) return;

  const activate = nextValue === "true";
  const result = await showActionDialog({
    kicker: "User status",
    title: activate ? "Reactivate account" : "Suspend account",
    description: activate
      ? `Restore ${user.name}'s access to AI Rent.`
      : `Suspend ${user.name}'s access and revoke active refresh tokens.`,
    confirmLabel: activate ? "Reactivate user" : "Suspend user",
    confirmTone: activate ? "default" : "danger",
    reasonLabel: "Reason",
    reasonPlaceholder: "Optional admin note",
  });

  if (!result.confirmed) return;

  setStatus("working", `${activate ? "Reactivating" : "Suspending"} ${user.name}...`);

  await authedRequest(`/api/v1/admin/users/${id}/status`, {
    method: "PUT",
    body: {
      isActive: activate,
      reason: result.reason || undefined,
    },
  });

  await loadPanel("users");
  setStatus("success", `${user.name} updated successfully.`);
}

async function moderateProduct(id, action) {
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

  setStatus("working", `${approving ? "Approving" : "Rejecting"} ${product.title}...`);

  await authedRequest(
    `/api/v1/admin/products/${id}/${approving ? "approve" : "reject"}`,
    {
      method: "PUT",
      body: {
        reason: result.reason || undefined,
      },
    },
  );

  await Promise.all([loadPanel("products"), loadOverview()]);
  setStatus(
    "success",
    `${product.title} ${approving ? "approved" : "rejected"} successfully.`,
  );
}

function resetForm(form) {
  form.reset();
}

function syncFormWithQuery(form, values) {
  for (const [key, value] of Object.entries(values)) {
    const field = form.elements.namedItem(key);
    if (!field) continue;
    field.value = value ?? "";
  }
}

function readFormQuery(form, currentValues) {
  const query = { ...currentValues };
  const formData = new FormData(form);

  for (const [key, value] of formData.entries()) {
    query[key] = typeof value === "string" ? value.trim() : value;
  }

  query.page = 1;
  return query;
}

function movePage(queryState, direction, pagination) {
  if (direction === "prev" && pagination?.hasPreviousPage) {
    queryState.page -= 1;
  }

  if (direction === "next" && pagination?.hasNextPage) {
    queryState.page += 1;
  }
}

function applyGlobalSearch(searchValue) {
  const targetPanel =
    state.activePanel === "users" ||
    state.activePanel === "categories" ||
    state.activePanel === "products" ||
    state.activePanel === "rentals"
      ? state.activePanel
      : "products";

  if (targetPanel === "users") {
    state.queries.users.search = searchValue;
    state.queries.users.page = 1;
    syncFormWithQuery(dom.usersFilterForm, state.queries.users);
  }

  if (targetPanel === "categories") {
    state.queries.categories.search = searchValue;
    syncFormWithQuery(dom.categoriesFilterForm, state.queries.categories);
  }

  if (targetPanel === "products") {
    state.queries.products.search = searchValue;
    state.queries.products.page = 1;
    syncFormWithQuery(dom.productsFilterForm, state.queries.products);
  }

  if (targetPanel === "rentals") {
    state.queries.rentals.search = searchValue;
    state.queries.rentals.page = 1;
    syncFormWithQuery(dom.rentalsFilterForm, state.queries.rentals);
  }

  if (state.activePanel !== targetPanel) {
    setActivePanel(targetPanel, { shouldLoad: false });
  }

  loadPanel(targetPanel);
}

function attachEventListeners() {
  dom.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(dom.loginForm);
    await loginAdmin({
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    });
  });

  dom.refreshSessionButton.addEventListener("click", async () => {
    setStatus("working", "Restoring previous session...");
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      setAuthMessage("No restorable admin session was found.");
      return;
    }

    await handleAuthenticatedUser();
  });

  dom.logoutButton.addEventListener("click", async () => {
    await logoutSession();
  });

  dom.accessLogoutButton.addEventListener("click", async () => {
    await logoutSession();
  });

  dom.accessReturnButton.addEventListener("click", () => {
    showScreen("auth");
  });

  dom.topbarRefresh.addEventListener("click", async () => {
    await loadPanel(state.activePanel);
  });

  dom.sidebarToggle.addEventListener("click", () => {
    dom.body.classList.toggle("sidebar-open");
  });

  document.addEventListener("click", (event) => {
    if (
      dom.body.classList.contains("sidebar-open") &&
      !event.target.closest("#sidebar") &&
      !event.target.closest("#sidebar-toggle")
    ) {
      dom.body.classList.remove("sidebar-open");
    }
  });

  for (const item of dom.navItems) {
    item.addEventListener("click", () => {
      setActivePanel(item.dataset.panel);
    });
  }

  dom.globalSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applyGlobalSearch(dom.globalSearchInput.value.trim());
  });

  dom.usersFilterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.queries.users = readFormQuery(dom.usersFilterForm, state.queries.users);
    await loadPanel("users");
  });

  dom.usersReset.addEventListener("click", async () => {
    resetForm(dom.usersFilterForm);
    state.queries.users = {
      page: 1,
      limit: 8,
      search: "",
      role: "",
      isActive: "",
    };
    await loadPanel("users");
  });

  dom.usersPrev.addEventListener("click", async () => {
    movePage(state.queries.users, "prev", state.data.users?.pagination);
    await loadPanel("users");
  });

  dom.usersNext.addEventListener("click", async () => {
    movePage(state.queries.users, "next", state.data.users?.pagination);
    await loadPanel("users");
  });

  dom.categoriesFilterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(dom.categoriesFilterForm);
    state.queries.categories = {
      search: String(formData.get("search") ?? "").trim(),
      isActive: String(formData.get("isActive") ?? "").trim(),
      level: String(formData.get("level") ?? "").trim(),
    };
    await loadPanel("categories");
  });

  dom.categoriesReset.addEventListener("click", async () => {
    resetForm(dom.categoriesFilterForm);
    state.queries.categories = {
      search: "",
      isActive: "",
      level: "",
    };
    await loadPanel("categories");
  });

  dom.categoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await saveCategory();
    } catch (error) {
      setStatus("error", error.message);
    }
  });

  dom.categoryCancel.addEventListener("click", () => {
    resetCategoryEditor();
  });

  dom.productsFilterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.queries.products = readFormQuery(
      dom.productsFilterForm,
      state.queries.products,
    );
    await loadPanel("products");
  });

  dom.productsReset.addEventListener("click", async () => {
    resetForm(dom.productsFilterForm);
    state.queries.products = {
      page: 1,
      limit: 8,
      search: "",
      status: "",
      isApproved: "",
      city: "",
    };
    await loadPanel("products");
  });

  dom.productsPrev.addEventListener("click", async () => {
    movePage(state.queries.products, "prev", state.data.products?.pagination);
    await loadPanel("products");
  });

  dom.productsNext.addEventListener("click", async () => {
    movePage(state.queries.products, "next", state.data.products?.pagination);
    await loadPanel("products");
  });

  dom.rentalsFilterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.queries.rentals = readFormQuery(dom.rentalsFilterForm, state.queries.rentals);
    await loadPanel("rentals");
  });

  dom.rentalsReset.addEventListener("click", async () => {
    resetForm(dom.rentalsFilterForm);
    state.queries.rentals = {
      page: 1,
      limit: 8,
      search: "",
      status: "",
    };
    await loadPanel("rentals");
  });

  dom.rentalsPrev.addEventListener("click", async () => {
    movePage(state.queries.rentals, "prev", state.data.rentals?.pagination);
    await loadPanel("rentals");
  });

  dom.rentalsNext.addEventListener("click", async () => {
    movePage(state.queries.rentals, "next", state.data.rentals?.pagination);
    await loadPanel("rentals");
  });

  dom.reportsFilterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(dom.reportsFilterForm);
    state.queries.reports = {
      days: Number(formData.get("days") ?? 30),
      months: Number(formData.get("months") ?? 6),
    };
    await loadPanel("reports");
  });

  document.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    try {
      const { action, id, next } = target.dataset;

      if (action === "view-user") {
        viewUserDetails(id);
      }

      if (action === "toggle-user-status") {
        await toggleUserStatus(id, next);
      }

      if (action === "view-category") {
        await viewCategoryDetails(id);
      }

      if (action === "edit-category") {
        beginCategoryEdit(id);
      }

      if (action === "toggle-category-status") {
        await toggleCategoryStatus(id, next);
      }

      if (action === "delete-category") {
        await deleteCategory(id);
      }

      if (action === "view-product") {
        viewProductDetails(id);
      }

      if (action === "approve-product") {
        await moderateProduct(id, "approve");
      }

      if (action === "reject-product") {
        await moderateProduct(id, "reject");
      }

      if (action === "focus-product") {
        setActivePanel("products", { shouldLoad: false });
        state.queries.products.search = target.dataset.query ?? "";
        syncFormWithQuery(dom.productsFilterForm, state.queries.products);
        await loadPanel("products");
      }

      if (action === "view-rental") {
        viewRentalDetails(id);
      }
    } catch (error) {
      setStatus("error", error.message);
    }
  });

  dom.actionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const reason = dom.actionReason.value.trim();

    if (state.actionDialogResolver?.requireReason && !reason) {
      setStatus("error", "Please provide a reason before continuing.");
      return;
    }

    closeActionDialog({
      confirmed: true,
      reason,
    });
  });

  dom.actionCancel.addEventListener("click", () => closeActionDialog());
  dom.actionClose.addEventListener("click", () => closeActionDialog());
  dom.actionDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeActionDialog();
  });
  dom.actionDialog.addEventListener("close", () => {
    if (state.actionDialogResolver) {
      state.actionDialogResolver.resolve({ confirmed: false, reason: "" });
      state.actionDialogResolver = null;
    }
  });
  dom.detailClose.addEventListener("click", closeDetailDialog);
  dom.detailDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDetailDialog();
  });
  dom.detailDialog.addEventListener("close", () => {
    dom.detailContent.innerHTML = "";
  });
}

attachEventListeners();
syncFormWithQuery(dom.usersFilterForm, state.queries.users);
syncFormWithQuery(dom.categoriesFilterForm, state.queries.categories);
syncFormWithQuery(dom.productsFilterForm, state.queries.products);
syncFormWithQuery(dom.rentalsFilterForm, state.queries.rentals);
resetCategoryEditor();
bootstrapSession();
