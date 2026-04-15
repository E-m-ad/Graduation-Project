export const ADMIN_DASHBOARD_PATH = "/html/admin-dashboard.html";
export const TOKEN_KEY = "ai_rent_access_token";
export const USER_KEY = "ai_rent_user";
export const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='480' viewBox='0 0 640 480'%3E%3Crect width='640' height='480' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%231e293b' font-family='Trebuchet MS%2C sans-serif' font-size='34'%3EAI Rent%3C/text%3E%3C/svg%3E";
export const AVATAR_PLACEHOLDER =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%231e293b' font-family='Trebuchet MS%2C sans-serif' font-size='26'%3EUser%3C/text%3E%3C/svg%3E";
export const DEFAULT_CURRENCY_LOCALE = "en-EG";

export function truncateText(value, maxLength = 120) {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function getCurrentStorage() {
  if (sessionStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(USER_KEY)) {
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

export function getAccessToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const rawValue =
    sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    console.error("Failed to parse stored user", error);
    clearSession();
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function saveSession({ accessToken, user, remember } = {}) {
  const nextToken = accessToken !== undefined ? accessToken : getAccessToken();
  const nextUser = user !== undefined ? user : getStoredUser();
  const shouldRemember =
    remember !== undefined ? remember : isPersistentSession();
  const targetStorage = shouldRemember ? localStorage : sessionStorage;

  clearSession();

  if (nextToken) targetStorage.setItem(TOKEN_KEY, nextToken);
  if (nextUser) targetStorage.setItem(USER_KEY, JSON.stringify(nextUser));
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function refreshAccessToken() {
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

export async function fetchApi(path, options = {}) {
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
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

export async function loadCurrentUser(force = false) {
  if (!force) {
    const cachedUser = getStoredUser();
    if (cachedUser) return cachedUser;
  }

  const result = await fetchApi("/api/v1/users/me", {
    auth: true,
    retryOnAuth: true,
  });

  if (result.ok && result.data?.success && result.data.data) {
    saveSession({ user: result.data.data });
    return result.data.data;
  }

  if (result.status === 401 || result.status === 403) {
    clearSession();
  }

  return null;
}

export function getDefaultAuthenticatedPath(user = getStoredUser()) {
  return user?.role === "admin" ? ADMIN_DASHBOARD_PATH : "/";
}

export function redirectToLogin() {
  const nextPath = `${window.location.pathname}${window.location.search}`;
  window.location.href = `/html/login.html?next=${encodeURIComponent(nextPath)}`;
}

export function goToNextPage(defaultPath = "/") {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  const user = getStoredUser();

  if (user?.role === "admin") {
    window.location.href = getDefaultAuthenticatedPath(user);
    return;
  }

  window.location.href = next || defaultPath || getDefaultAuthenticatedPath(user);
}

export async function logout() {
  await fetchApi("/api/v1/auth/logout", { method: "POST" });
  clearSession();
}

export function formatMoney(value) {
  if (value === undefined || value === null || value === "") {
    return "Not set";
  }

  const numericValue = Number(value);

  return new Intl.NumberFormat(DEFAULT_CURRENCY_LOCALE, {
    style: "decimal",
    minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

export function formatDateTime(value) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
}

export function getPrimaryImage(product) {
  const primaryImage = Array.isArray(product?.images)
    ? product.images.find((image) => image.isPrimary) || product.images[0]
    : null;

  return primaryImage?.imageUrl || primaryImage?.thumbnailUrl || FALLBACK_IMAGE;
}

export function getPriceLabel(product) {
  const priceOptions = [
    [product?.pricePerDay, "day"],
    [product?.pricePerWeek, "week"],
    [product?.pricePerMonth, "month"],
    [product?.pricePerHour, "hour"],
  ];

  const validOption = priceOptions.find(
    ([value]) => value !== null && value !== undefined,
  );

  if (!validOption) {
    return "Price on request";
  }

  return `${formatMoney(validOption[0])} / ${validOption[1]}`;
}

export async function fetchWishlistIds() {
  if (!getAccessToken() && !(await refreshAccessToken())) {
    return new Set();
  }

  const result = await fetchApi("/api/v1/wishlists?limit=50", { auth: true });
  if (!result.ok || !result.data?.success) {
    return new Set();
  }

  return new Set(
    (result.data.data?.wishlists || []).map((item) => item.productId),
  );
}

export async function toggleWishlist(productId, isSaved) {
  const user = await loadCurrentUser();
  if (!user) {
    redirectToLogin();
    return { ok: false, redirected: true };
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

export async function fetchWishlistPage({ page = 1, limit = 12 } = {}) {
  return fetchApi(`/api/v1/wishlists?${buildQuery({ page, limit })}`, {
    auth: true,
  });
}

export async function fetchOwnerWishlistPage({ page = 1, limit = 12 } = {}) {
  return fetchApi(`/api/v1/wishlists/owner?${buildQuery({ page, limit })}`, {
    auth: true,
  });
}

export async function removeWishlistItem(productId) {
  return fetchApi(`/api/v1/wishlists/${productId}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function removeOwnerWishlistItem(wishlistId) {
  return fetchApi(`/api/v1/wishlists/owner/${wishlistId}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function sendWishlistNotification(wishlistId, payload = {}) {
  return fetchApi(`/api/v1/wishlists/owner/${wishlistId}/notify`, {
    method: "POST",
    auth: true,
    body: payload,
  });
}

export function buildQuery(params) {
  const searchParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, value);
  });

  return searchParams.toString();
}

export function replaceUrl(path, params) {
  const query = buildQuery(params);
  const nextUrl = query ? `${path}?${query}` : path;
  window.history.replaceState({}, "", nextUrl);
}

export async function trackBehavior(payload) {
  if (!getAccessToken()) return;

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
