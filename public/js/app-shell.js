import { dom } from "./core/dom.js";
import {
  defaultDataState,
  defaultNotificationQuery,
  panelMeta,
  state,
} from "./core/state.js";
import {
  escapeHtml,
} from "./core/ui.js";
import {
  renderPanelError,
  setAuthMessage,
  setLastSync,
  setPanelLoading,
  setStatus,
  setTopbarMeta,
  setUserShell,
  showScreen,
} from "./core/shell-ui.js";
import {
  authedRequest,
  rawRequest,
  refreshAccessToken,
  setAccessToken,
} from "./services/api.js";
import {
  resetCategoryEditor,
} from "./features/categories.js";
import {
  loadNotifications,
  loadOverview,
  refreshUnreadNotifications,
} from "./features/overview.js";
import { loadUsers } from "./features/users.js";
import { loadProducts } from "./features/products.js";
import { loadRentals } from "./features/rentals.js";
import { loadReports } from "./features/reports.js";
import { loadCategories } from "./features/categories.js";

export async function logoutSession({ silent = false } = {}) {
  try {
    await rawRequest("/api/v1/auth/logout", { method: "POST" });
  } catch {
    // Ignore logout failures when clearing local state.
  }

  setAccessToken("");
  state.currentUser = null;
  state.editingCategoryId = null;
  state.data = defaultDataState();
  state.queries.notifications = defaultNotificationQuery();
  setUserShell(null);
  resetCategoryEditor();

  if (!silent) {
    setStatus("idle", "Signed out. Waiting for an admin login.");
  }

  showScreen("auth");
  setAuthMessage("Sign in to load live admin analytics and moderation tools.");
}

export async function handleAuthenticatedUser() {
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

export async function loginAdmin(credentials) {
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

export async function bootstrapSession() {
  showScreen("auth");
  setUserShell(null);
  setTopbarMeta();
  setStatus("idle", "Waiting for an admin login.");

  if (!state.accessToken) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      return;
    }
  }

  await handleAuthenticatedUser();
}

export function setActivePanel(panelName, { shouldLoad = true } = {}) {
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

export async function loadPanel(panelName) {
  setPanelLoading(panelName);
  setStatus(
    "working",
    `Loading ${panelMeta[panelName].title.toLowerCase()}...`,
  );

  try {
    if (panelName === "overview") {
      await loadOverview();
    }

    if (panelName === "notifications") {
      await loadNotifications();
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

export { setAuthMessage, setStatus } from "./core/shell-ui.js";
export { refreshAccessToken } from "./services/api.js";
