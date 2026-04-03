import { dom } from "./dom.js";
import { panelMeta, state } from "./state.js";
import { formatDateTime, renderStateMessage } from "./ui.js";

export function setStatus(stateName, message) {
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

export function setAuthMessage(message) {
  dom.authMessage.textContent = message;
}

export function setLastSync() {
  dom.lastSync.textContent = `Last synced ${formatDateTime(new Date())}`;
}

export function showScreen(screenName) {
  dom.authScreen.hidden = screenName !== "auth";
  dom.accessScreen.hidden = screenName !== "access";
  dom.dashboardShell.hidden = screenName !== "dashboard";
}

export function setTopbarMeta() {
  const currentMeta = panelMeta[state.activePanel];
  dom.panelKicker.textContent = currentMeta.kicker;
  dom.panelTitle.textContent = currentMeta.title;
}

export function setUserShell(user) {
  state.currentUser = user;
  dom.sidebarName.textContent = user?.name ?? "Admin";
  dom.sidebarRole.textContent = user?.role
    ? `${user.role} role`
    : "Admin session";
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

export function setPanelLoading(panelName) {
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

  if (panelName === "notifications") {
    dom.notificationsFeed.innerHTML = html;
    dom.notificationsPageMeta.textContent = "Loading notifications...";
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

export function renderPanelError(panelName, message) {
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

  if (panelName === "notifications") {
    dom.notificationsFeed.innerHTML = html;
    dom.notificationsPageMeta.textContent = "Notification loading failed";
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
