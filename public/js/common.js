(function () {
  const ADMIN_DASHBOARD_PATH = "/html/admin-dashboard.html";
  const TOKEN_KEY = "ai_rent_access_token";
  const USER_KEY = "ai_rent_user";
  const FALLBACK_IMAGE =
    "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='480' viewBox='0 0 640 480'%3E%3Crect width='640' height='480' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%231e293b' font-family='Trebuchet MS%2C sans-serif' font-size='34'%3EAI Rent%3C/text%3E%3C/svg%3E";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function truncateText(value, maxLength = 120) {
    if (!value) {
      return "";
    }

    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength - 3)}...`;
  }

  function getCurrentStorage() {
    if (
      sessionStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem(USER_KEY)
    ) {
      return sessionStorage;
    }

    if (localStorage.getItem(TOKEN_KEY) || localStorage.getItem(USER_KEY)) {
      return localStorage;
    }

    return localStorage;
  }

  function isPersistentSession() {
    return getCurrentStorage() === localStorage;
  }

  function getAccessToken() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  }

  function getStoredUser() {
    const rawValue =
      sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);

    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue);
    } catch (error) {
      console.error("Failed to parse stored user", error);
      clearSession();
      return null;
    }
  }

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getDefaultAuthenticatedPath(user = getStoredUser()) {
    if (user?.role === "admin") {
      return ADMIN_DASHBOARD_PATH;
    }

    return "/";
  }

  function redirectAdminToDashboard(user = getStoredUser()) {
    const currentPage = document.body?.dataset?.page;

    if (user?.role !== "admin" || currentPage === "admin") {
      return false;
    }

    window.location.replace(ADMIN_DASHBOARD_PATH);
    return true;
  }

  function saveSession({ accessToken, user, remember } = {}) {
    const nextToken = accessToken !== undefined ? accessToken : getAccessToken();
    const nextUser = user !== undefined ? user : getStoredUser();
    const shouldRemember =
      remember !== undefined ? remember : isPersistentSession();
    const targetStorage = shouldRemember ? localStorage : sessionStorage;

    clearSession();

    if (nextToken) {
      targetStorage.setItem(TOKEN_KEY, nextToken);
    }

    if (nextUser) {
      targetStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    }
  }

  async function parseResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return response.json();
    }

    const text = await response.text();
    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  async function refreshAccessToken() {
    try {
      const response = await fetch("/api/v1/auth/refresh-token", {
        method: "POST",
        credentials: "include",
      });
      const data = await parseResponse(response);

      if (!response.ok || !data?.success || !data?.accessToken) {
        return false;
      }

      saveSession({ accessToken: data.accessToken });
      return true;
    } catch (error) {
      console.error("refreshAccessToken error:", error);
      return false;
    }
  }

  async function fetchApi(path, options = {}) {
    const { auth = false, retryOnAuth = true, ...requestOptions } = options;
    const headers = new Headers(requestOptions.headers || {});
    let body = requestOptions.body;

    if (auth && !getAccessToken()) {
      await refreshAccessToken();
    }

    if (
      body !== undefined &&
      body !== null &&
      !(body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    if (
      headers.get("Content-Type") === "application/json" &&
      body !== undefined &&
      typeof body !== "string"
    ) {
      body = JSON.stringify(body);
    }

    const token = getAccessToken();
    if (auth && token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(path, {
      credentials: "include",
      ...requestOptions,
      headers,
      body,
    });
    const data = await parseResponse(response);

    if (response.status === 401 && auth && retryOnAuth) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return fetchApi(path, { ...options, retryOnAuth: false });
      }

      clearSession();
      updateLayout();
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  }

  async function loadCurrentUser(force = false) {
    if (!force) {
      const cachedUser = getStoredUser();
      if (cachedUser) {
        return cachedUser;
      }
    }

    const result = await fetchApi("/api/v1/users/me", {
      auth: true,
      retryOnAuth: true,
    });

    if (result.ok && result.data?.success && result.data.data) {
      saveSession({ user: result.data.data });
      updateLayout();
      return result.data.data;
    }

    if (result.status === 401 || result.status === 403) {
      clearSession();
      updateLayout();
    }

    return null;
  }

  function showMessage(element, text, type = "") {
    if (!element) {
      return;
    }

    element.textContent = text || "";
    element.className = "message";

    if (type) {
      element.classList.add(`message--${type}`);
    }
  }

  function formatMoney(value) {
    if (value === undefined || value === null || value === "") {
      return "Not set";
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  function formatDateTime(value) {
    if (!value) {
      return "Not available";
    }

    return new Date(value).toLocaleString();
  }

  function getPrimaryImage(product) {
    const primaryImage = Array.isArray(product?.images)
      ? product.images.find((image) => image.isPrimary) || product.images[0]
      : null;

    return primaryImage?.imageUrl || primaryImage?.thumbnailUrl || FALLBACK_IMAGE;
  }

  function getPriceLabel(product) {
    const priceOptions = [
      [product?.pricePerDay, "day"],
      [product?.pricePerWeek, "week"],
      [product?.pricePerMonth, "month"],
      [product?.pricePerHour, "hour"],
    ];

    const validOption = priceOptions.find(([value]) => value !== null && value !== undefined);

    if (!validOption) {
      return "Price on request";
    }

    return `${formatMoney(validOption[0])} / ${validOption[1]}`;
  }

  function createEmptyState(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function createSiteFooter() {
    const year = new Date().getFullYear();

    return `
      <footer class="site-footer">
        <div class="site-footer__inner">
          <div class="site-footer__layout">
            <section class="site-footer__intro" aria-label="AI Rent overview">
              <a class="brand site-footer__brand" href="/">
                AI <span class="site-footer__brand-accent">Rent</span>
              </a>
              <p class="site-footer__note">
                One marketplace for browsing rentals, publishing listings, and
                managing requests through the same simple front-end.
              </p>
              <div class="site-footer__actions">
                <a
                  class="btn btn--primary btn--small"
                  href="/html/products.html"
                  data-non-admin-only
                >
                  Browse Listings
                </a>
                <a
                  class="btn btn--secondary btn--small"
                  href="/html/register.html"
                  data-guest-only
                >
                  Get Started
                </a>
                <a
                  class="btn btn--secondary btn--small"
                  href="/html/my-listings.html"
                  data-user-only
                  hidden
                >
                  My Listings
                </a>
                <a
                  class="btn btn--secondary btn--small"
                  href="/html/admin-dashboard.html"
                  data-admin-only
                  hidden
                >
                  Open Dashboard
                </a>
              </div>
            </section>

            <nav class="site-footer__section" aria-label="Marketplace links">
              <p class="site-footer__heading">Marketplace</p>
              <ul class="site-footer__links">
                <li><a href="/" data-non-admin-only>Home</a></li>
                <li>
                  <a href="/html/products.html" data-non-admin-only>
                    Browse listings
                  </a>
                </li>
                <li>
                  <a href="/html/my-listings.html" data-user-only hidden>
                    Manage listings
                  </a>
                </li>
                <li>
                  <a href="/html/admin-dashboard.html" data-admin-only hidden>
                    Admin dashboard
                  </a>
                </li>
              </ul>
            </nav>

            <nav class="site-footer__section" aria-label="Account links">
              <p class="site-footer__heading">Account</p>
              <ul class="site-footer__links">
                <li><a href="/html/login.html" data-guest-only>Login</a></li>
                <li><a href="/html/register.html" data-guest-only>Register</a></li>
                <li><a href="/html/profile.html" data-user-only hidden>Profile</a></li>
                <li>
                  <a href="/html/forgot-password.html" data-guest-only>
                    Forgot password
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    class="site-footer__link-button"
                    data-logout-button
                    hidden
                  >
                    Logout
                  </button>
                </li>
              </ul>
            </nav>

            <section class="site-footer__section">
              <p class="site-footer__heading">Why AI Rent</p>
              <ul class="site-footer__links">
                <li><span>Simple browsing and filtering.</span></li>
                <li><span>Owner and renter workflows in one place.</span></li>
                <li><span>Role-aware navigation across the shared shell.</span></li>
              </ul>
            </section>
          </div>

          <div class="site-footer__bottom">
            <p>&copy; ${year} AI Rent. Built for smarter sharing.</p>
            <p>Browse, list, and manage rentals from one streamlined workspace.</p>
          </div>
        </div>
      </footer>
    `;
  }

  function ensureSiteFooter() {
    if (document.querySelector(".site-footer")) {
      return;
    }

    const mainElement = document.querySelector("main");

    if (mainElement) {
      mainElement.insertAdjacentHTML("afterend", createSiteFooter());
      return;
    }

    document.body.insertAdjacentHTML("beforeend", createSiteFooter());
  }

  function createProductCard(product, options = {}) {
    const detailsUrl = `/html/product-details.html?id=${encodeURIComponent(
      product.id,
    )}`;
    const isSaved = options.wishlistIds?.has(product.id);
    const saveButton = options.showWishlist
      ? `<button type="button" class="btn btn--secondary btn--small" data-wishlist-product-id="${escapeHtml(
          product.id,
        )}" data-saved="${isSaved ? "true" : "false"}">${
          isSaved ? "Saved" : "Save"
        }</button>`
      : "";

    return `
      <article class="product-card">
        <a href="${detailsUrl}">
          <img
            class="product-card__image"
            src="${escapeHtml(getPrimaryImage(product))}"
            alt="${escapeHtml(product.title || "Product image")}"
          />
        </a>
        <div class="product-card__body">
          <div class="product-card__meta">
            <span class="tag">${escapeHtml(product.category?.name || "General")}</span>
            <span class="product-card__city">${escapeHtml(
              product.city || product.owner?.city || "Unknown city",
            )}</span>
          </div>
          <div class="product-card__top">
            <div>
              <h3 class="product-card__title">
                <a href="${detailsUrl}">${escapeHtml(product.title || "Untitled listing")}</a>
              </h3>
              <p class="compact-text">${escapeHtml(
                truncateText(product.description || "No description available.", 110),
              )}</p>
            </div>
          </div>
          <div class="product-card__bottom">
            <div>
              <p class="product-card__price">${escapeHtml(getPriceLabel(product))}</p>
              <p class="compact-text">
                ${escapeHtml(product.status || "available")}
                ${
                  product.avgRating
                    ? ` | Rating ${Number(product.avgRating).toFixed(1)}`
                    : ""
                }
              </p>
            </div>
            <div class="hero__actions">
              <a class="btn btn--ghost btn--small" href="${detailsUrl}">Details</a>
              ${saveButton}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  async function fetchWishlistIds() {
    if (!getAccessToken() && !(await refreshAccessToken())) {
      return new Set();
    }

    const result = await fetchApi("/api/v1/wishlists?limit=50", {
      auth: true,
    });

    if (!result.ok || !result.data?.success) {
      return new Set();
    }

    return new Set(
      (result.data.data?.wishlists || []).map((item) => item.productId),
    );
  }

  async function toggleWishlist(productId, isSaved) {
    const user = await loadCurrentUser();
    if (!user) {
      redirectToLogin();
      return {
        ok: false,
        redirected: true,
      };
    }

    const result = await fetchApi(`/api/v1/wishlists/${productId}`, {
      method: isSaved ? "DELETE" : "POST",
      auth: true,
    });

    return {
      ...result,
      saved: !isSaved && result.ok,
      removed: isSaved && result.ok,
    };
  }

  function buildQuery(params) {
    const searchParams = new URLSearchParams();

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }

      searchParams.set(key, value);
    });

    return searchParams.toString();
  }

  async function trackBehavior(payload) {
    if (!getAccessToken()) {
      return;
    }

    try {
      await fetchApi("/api/v1/behavior/track", {
        method: "POST",
        auth: true,
        body: payload,
      });
    } catch (error) {
      console.error("trackBehavior error:", error);
    }
  }

  function updateLayout() {
    const user = getStoredUser();
    const currentPage = document.body?.dataset?.page;
    const isAdmin = user?.role === "admin";

    document.querySelectorAll("[data-guest-only]").forEach((element) => {
      element.hidden = Boolean(user);
    });

    document.querySelectorAll("[data-user-only]").forEach((element) => {
      element.hidden = !user || isAdmin;
    });

    document.querySelectorAll("[data-admin-only]").forEach((element) => {
      element.hidden = !isAdmin;
    });

    document.querySelectorAll("[data-non-admin-only]").forEach((element) => {
      element.hidden = isAdmin;
    });

    document.querySelectorAll("[data-user-greeting]").forEach((element) => {
      element.textContent = user
        ? isAdmin
          ? `Welcome back, ${user.name}. Your admin dashboard is ready.`
          : `Welcome back, ${user.name}. Keep building the marketplace.`
        : "Browse as a guest or sign in to manage listings and requests.";
    });

    document.querySelectorAll("[data-logout-button]").forEach((button) => {
      button.hidden = !user;

      if (!button.dataset.bound) {
        button.dataset.bound = "true";
        button.addEventListener("click", async () => {
          await fetchApi("/api/v1/auth/logout", {
            method: "POST",
          });
          clearSession();
          updateLayout();
          window.location.href = "/";
        });
      }
    });

    if (currentPage) {
      document
        .querySelectorAll(".site-nav a.is-active")
        .forEach((link) => link.classList.remove("is-active"));

      const activeLink = document.querySelector(`[data-nav="${currentPage}"]`);
      if (activeLink) {
        activeLink.classList.add("is-active");
      }
    }
  }

  function redirectToLogin() {
    const nextPath = `${window.location.pathname}${window.location.search}`;
    const loginUrl = `/html/login.html?next=${encodeURIComponent(nextPath)}`;
    window.location.href = loginUrl;
  }

  function goToNextPage(defaultPath = "/") {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    const user = getStoredUser();

    if (user?.role === "admin") {
      window.location.href = getDefaultAuthenticatedPath(user);
      return;
    }

    window.location.href = next || defaultPath || getDefaultAuthenticatedPath(user);
  }

  async function requireAuth() {
    const user = await loadCurrentUser();
    if (!user) {
      redirectToLogin();
      return null;
    }

    if (redirectAdminToDashboard(user)) {
      return null;
    }

    return user;
  }

  async function enforceAdminDashboardAccess() {
    try {
      const storedUser = getStoredUser();
      if (redirectAdminToDashboard(storedUser)) {
        return;
      }

      if (!storedUser && getAccessToken()) {
        const user = await loadCurrentUser();
        redirectAdminToDashboard(user);
      }
    } catch (error) {
      console.error("enforceAdminDashboardAccess error:", error);
    }
  }

  ensureSiteFooter();
  updateLayout();
  enforceAdminDashboardAccess();

  window.AIRent = {
    buildQuery,
    clearSession,
    createEmptyState,
    createProductCard,
    escapeHtml,
    enforceAdminDashboardAccess,
    fetchApi,
    fetchWishlistIds,
    formatDateTime,
    formatMoney,
    getAccessToken,
    getDefaultAuthenticatedPath,
    getPriceLabel,
    getPrimaryImage,
    getStoredUser,
    goToNextPage,
    loadCurrentUser,
    redirectToLogin,
    refreshAccessToken,
    requireAuth,
    saveSession,
    showMessage,
    toggleWishlist,
    trackBehavior,
    truncateText,
    updateLayout,
  };
})();
