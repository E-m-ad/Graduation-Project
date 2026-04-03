import { dom } from "./core/dom.js";
import {
  defaultNotificationQuery,
  defaultProductQuery,
  defaultRentalQuery,
  defaultUserQuery,
  state,
} from "./core/state.js";
import {
  movePage,
  readFormQuery,
  resetForm,
  syncFormWithQuery,
} from "./core/forms.js";
import {
  closeActionDialog,
  closeDetailDialog,
} from "./features/dialogs.js";
import {
  beginCategoryEdit,
  deleteCategory,
  resetCategoryEditor,
  saveCategory,
  toggleCategoryStatus,
  viewCategoryDetails,
} from "./features/categories.js";
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  refreshNotificationViews,
} from "./features/overview.js";
import {
  moderateProduct,
  viewProductDetails,
} from "./features/products.js";
import {
  viewRentalDetails,
} from "./features/rentals.js";
import {
  toggleUserStatus,
  viewUserDetails,
} from "./features/users.js";
import {
  handleAuthenticatedUser,
  loadPanel,
  loginAdmin,
  logoutSession,
  refreshAccessToken,
  setActivePanel,
  setAuthMessage,
  setStatus,
} from "./app-shell.js";
import { showScreen } from "./core/shell-ui.js";

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

export function initializeForms() {
  syncFormWithQuery(dom.notificationsFilterForm, state.queries.notifications);
  syncFormWithQuery(dom.usersFilterForm, state.queries.users);
  syncFormWithQuery(dom.categoriesFilterForm, state.queries.categories);
  syncFormWithQuery(dom.productsFilterForm, state.queries.products);
  syncFormWithQuery(dom.rentalsFilterForm, state.queries.rentals);
}

export function attachEventListeners() {
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
    setStatus("idle", "Waiting for an admin login.");
  });

  dom.topbarRefresh.addEventListener("click", async () => {
    await loadPanel(state.activePanel);
  });

  dom.notificationChip.addEventListener("click", () => {
    setActivePanel("notifications");
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

  dom.notificationsFilterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.queries.notifications = readFormQuery(
      dom.notificationsFilterForm,
      state.queries.notifications,
    );
    await loadPanel("notifications");
  });

  dom.notificationsReset.addEventListener("click", async () => {
    resetForm(dom.notificationsFilterForm);
    state.queries.notifications = defaultNotificationQuery();
    syncFormWithQuery(dom.notificationsFilterForm, state.queries.notifications);
    await loadPanel("notifications");
  });

  dom.notificationsMarkAll.addEventListener("click", async () => {
    setStatus("working", "Marking notifications as read...");
    await markAllNotificationsAsRead();
    await refreshNotificationViews();
    setStatus("success", "All notifications are marked as read.");
  });

  dom.notificationsPrev.addEventListener("click", async () => {
    movePage(
      state.queries.notifications,
      "prev",
      state.data.notifications?.pagination,
    );
    await loadPanel("notifications");
  });

  dom.notificationsNext.addEventListener("click", async () => {
    movePage(
      state.queries.notifications,
      "next",
      state.data.notifications?.pagination,
    );
    await loadPanel("notifications");
  });

  dom.usersFilterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.queries.users = readFormQuery(
      dom.usersFilterForm,
      state.queries.users,
    );
    await loadPanel("users");
  });

  dom.usersReset.addEventListener("click", async () => {
    resetForm(dom.usersFilterForm);
    state.queries.users = defaultUserQuery();
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
    state.queries.products = defaultProductQuery();
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
    state.queries.rentals = readFormQuery(
      dom.rentalsFilterForm,
      state.queries.rentals,
    );
    await loadPanel("rentals");
  });

  dom.rentalsReset.addEventListener("click", async () => {
    resetForm(dom.rentalsFilterForm);
    state.queries.rentals = defaultRentalQuery();
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
        state.queries.products.page = 1;
        syncFormWithQuery(dom.productsFilterForm, state.queries.products);
        await loadPanel("products");
      }

      if (action === "open-notifications") {
        setActivePanel("notifications");
      }

      if (action === "mark-all-notifications-read") {
        setStatus("working", "Marking notifications as read...");
        await markAllNotificationsAsRead();
        await refreshNotificationViews();
        setStatus("success", "All notifications are marked as read.");
      }

      if (action === "view-rental") {
        viewRentalDetails(id);
      }
    } catch (error) {
      setStatus("error", error.message);
    }
  });

  document.addEventListener("change", async (event) => {
    const target = event.target.closest(
      '[data-action="mark-notification-read"]',
    );
    if (!target || !target.checked) return;

    try {
      setStatus("working", "Updating notification...");
      await markNotificationAsRead(target.dataset.id ?? "");
      await refreshNotificationViews();
      setStatus("success", "Notification marked as read.");
    } catch (error) {
      target.checked = false;
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
