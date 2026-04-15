import React, { useEffect, useMemo, useState } from "react";
import {
  buildQuery,
  fetchApi,
  formatDateTime,
  formatMoney,
  getPriceLabel,
  getPrimaryImage,
  redirectToLogin,
  truncateText,
} from "../lib/airent";
import { useActionDialog, useMessageState, useSession } from "../lib/hooks";
import {
  ActionDialog,
  EmptyState,
  MessageText,
  SectionHeading,
} from "../components/Common";
import { SiteLayout } from "../components/Layout";

const PANEL_META = {
  overview: { eyebrow: "Operations", title: "Overview" },
  notifications: { eyebrow: "Inbox", title: "Notifications" },
  users: { eyebrow: "Admin tools", title: "Users" },
  products: { eyebrow: "Moderation", title: "Products" },
  rentals: { eyebrow: "Operations", title: "Rentals" },
  reports: { eyebrow: "Insights", title: "Reports" },
  categories: { eyebrow: "Catalog", title: "Categories" },
};

const INITIAL_NOTIFICATIONS_FILTERS = {
  page: 1,
  limit: "10",
  isRead: "",
  type: "",
};

const INITIAL_USERS_FILTERS = {
  page: 1,
  search: "",
  role: "",
  isActive: "",
};

const INITIAL_PRODUCTS_FILTERS = {
  page: 1,
  search: "",
  status: "",
  isApproved: "",
  city: "",
};

const INITIAL_RENTALS_FILTERS = {
  page: 1,
  search: "",
  status: "",
};

const INITIAL_REPORT_FILTERS = {
  days: "30",
  months: "6",
};

const INITIAL_CATEGORY_FORM = {
  name: "",
  sortOrder: "",
  description: "",
  iconUrl: "",
  parentId: "",
  isActive: "true",
};

function AdminPagination({ pagination, onPrevious, onNext }) {
  if (!pagination || pagination.totalPages <= 1) {
    return <span>Page 1</span>;
  }

  return (
    <div className="pagination-bar admin-pagination">
      <button
        type="button"
        className="btn btn--secondary"
        disabled={!pagination.hasPreviousPage}
        onClick={onPrevious}
      >
        Previous
      </button>
      <span>
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <button
        type="button"
        className="btn btn--secondary"
        disabled={!pagination.hasNextPage}
        onClick={onNext}
      >
        Next
      </button>
    </div>
  );
}

function AdminList({ items, emptyMessage, renderItem }) {
  if (!items.length) {
    return <EmptyState message={emptyMessage} />;
  }

  return <div className="list-stack">{items.map(renderItem)}</div>;
}

function AdminStatCard({ label, value, hint }) {
  return (
    <article className="admin-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <span>{hint}</span>
    </article>
  );
}

function getNotificationContextText(notification) {
  if (
    typeof notification?.data?.reply === "string" &&
    notification.data.reply.trim()
  ) {
    return `Reply: ${notification.data.reply.trim()}`;
  }

  if (
    typeof notification?.data?.reason === "string" &&
    notification.data.reason.trim()
  ) {
    return `Note: ${notification.data.reason.trim()}`;
  }

  return "";
}

function OverviewUserItem({ user }) {
  return (
    <article className="admin-item">
      <div className="admin-item__header">
        <strong>{user.name}</strong>
        <span className={`tag${user.isActive ? " tag--light" : ""}`}>
          {user.isActive ? "Active" : "Suspended"}
        </span>
      </div>
      <p className="admin-item__meta">
        {user.email} | {user.role}
      </p>
      <p className="admin-item__footer">
        Joined {formatDateTime(user.createdAt)}
      </p>
    </article>
  );
}

function PendingProductItem({ product, onModerate }) {
  return (
    <article className="admin-item">
      <div className="admin-item__header">
        <strong>{product.title}</strong>
        <span className="tag">Under review</span>
      </div>
      <p className="admin-item__meta">
        Owner: {product.owner?.name || "Unknown"}
      </p>
      <p className="admin-item__footer">
        {product.category?.name || "General"} |{" "}
        {formatDateTime(product.createdAt)}
      </p>
      <div className="admin-item__actions">
        <button
          type="button"
          className="btn btn--primary btn--small"
          onClick={() => onModerate(product.id, "approve")}
        >
          Approve
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--small"
          onClick={() => onModerate(product.id, "reject")}
        >
          Reject
        </button>
      </div>
    </article>
  );
}

function OverviewRentalItem({ rental }) {
  return (
    <article className="admin-item">
      <div className="admin-item__header">
        <strong>{rental.product?.title || "Rental"}</strong>
        <span className="tag tag--light">{rental.status}</span>
      </div>
      <p className="admin-item__meta">
        Renter: {rental.renter?.name || "Unknown"} | Owner:{" "}
        {rental.owner?.name || "Unknown"}
      </p>
      <p className="admin-item__footer">
        {formatMoney(rental.totalPrice)} | {formatDateTime(rental.createdAt)}
      </p>
    </article>
  );
}

function NotificationItem({ notification, onMarkRead }) {
  const contextText = getNotificationContextText(notification);

  return (
    <article className="admin-item">
      <div className="admin-item__header">
        <strong>{notification.title || "Notification"}</strong>
        <span className={`tag${notification.isRead ? " tag--light" : ""}`}>
          {notification.isRead ? "Read" : "Unread"}
        </span>
      </div>
      <p className="admin-item__summary">
        {notification.message || "No message available."}
      </p>
      {contextText ? (
        <p className="admin-item__summary">{contextText}</p>
      ) : null}
      <div className="admin-item__footer">
        <span>{notification.type || "system"}</span>
        <span>{formatDateTime(notification.createdAt)}</span>
      </div>
      {!notification.isRead ? (
        <div className="admin-item__actions">
          <button
            type="button"
            className="btn btn--secondary btn--small"
            onClick={() => onMarkRead(notification.id)}
          >
            Mark as read
          </button>
        </div>
      ) : null}
    </article>
  );
}

function UserItem({ user, currentUserId, onToggleStatus }) {
  const canToggle = user.id !== currentUserId;

  return (
    <article className="admin-item">
      <div className="admin-item__header">
        <div>
          <strong>{user.name}</strong>
          <p className="admin-item__meta">{user.email}</p>
        </div>
        <span className={`tag${user.isActive ? " tag--light" : ""}`}>
          {user.isActive ? "Active" : "Suspended"}
        </span>
      </div>
      <div className="admin-item__footer">
        <span>Role: {user.role}</span>
        <span>Listings: {user._count?.productsOwned || 0}</span>
        <span>Bookings: {user._count?.rentalsAsRenter || 0}</span>
        <span>Requests: {user._count?.rentalsAsOwner || 0}</span>
      </div>
      <p className="admin-item__summary">
        {user.city || "No city"} | Joined {formatDateTime(user.createdAt)}
      </p>
      {canToggle ? (
        <div className="admin-item__actions">
          <button
            type="button"
            className="btn btn--secondary btn--small"
            onClick={() => onToggleStatus(user)}
          >
            {user.isActive ? "Suspend" : "Activate"}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function ProductItem({ product, onModerate, onChangeStatus }) {
  const needsReview = !product.isApproved || product.status === "under_review";
  const canToggleListingVisibility = product.isApproved;
  const isUnlistedApprovedListing =
    product.isApproved && product.status === "suspended";

  return (
    <article className="admin-item">
      <div className="admin-item__inline">
        <img
          className="admin-item__thumb"
          src={getPrimaryImage(product)}
          alt={product.title}
        />
        <div>
          <strong>{product.title}</strong>
          <p className="admin-item__meta">
            {product.owner?.name || "Unknown owner"} |{" "}
            {product.category?.name || "General"}
          </p>
        </div>
      </div>
      <div className="admin-item__footer">
        <span>{getPriceLabel(product)}</span>
        <span>{product.city || "No city"}</span>
        <span>{product.status}</span>
      </div>
      <p className="admin-item__summary">
        {product.description || "No description provided."}
      </p>
      {product.adminReviewNote ? (
        <p className="admin-item__summary">
          Admin note: {truncateText(product.adminReviewNote, 180)}
        </p>
      ) : null}
      {product.ownerReviewReply ? (
        <p className="admin-item__summary">
          Owner reply: {truncateText(product.ownerReviewReply, 180)}
        </p>
      ) : null}
      <div className="admin-item__actions">
        <a
          className="btn btn--ghost btn--small"
          href={`/html/product-details.html?id=${encodeURIComponent(product.id)}`}
        >
          View
        </a>
        {needsReview ? (
          <>
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => onModerate(product.id, "approve")}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--small"
              onClick={() => onModerate(product.id, "reject")}
            >
              Reject
            </button>
          </>
        ) : canToggleListingVisibility ? (
          <button
            type="button"
            className="btn btn--secondary btn--small"
            onClick={() =>
              onChangeStatus(
                product.id,
                isUnlistedApprovedListing ? "available" : "suspended",
              )
            }
          >
            {isUnlistedApprovedListing ? "Relist" : "Unlist"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function RentalItem({ rental }) {
  return (
    <article className="admin-item">
      <div className="admin-item__header">
        <strong>{rental.product?.title || "Rental"}</strong>
        <span className="tag tag--light">{rental.status}</span>
      </div>
      <div className="admin-item__footer">
        <span>Renter: {rental.renter?.name || "Unknown"}</span>
        <span>Owner: {rental.owner?.name || "Unknown"}</span>
      </div>
      <div className="admin-item__footer">
        <span>{formatMoney(rental.totalPrice)}</span>
        <span>{rental.rentalPeriodType}</span>
        <span>{formatDateTime(rental.createdAt)}</span>
      </div>
      <p className="admin-item__summary">
        Start: {formatDateTime(rental.startDate)} | End:{" "}
        {formatDateTime(rental.endDate)}
      </p>
    </article>
  );
}

function BarGroup({ title, items, labelKey }) {
  const maxValue = Math.max(...items.map((item) => item.count || 0), 1);

  return (
    <article className="admin-item">
      <strong>{title}</strong>
      <div className="admin-bars">
        {items.map((item) => (
          <div className="admin-bar" key={`${title}-${item[labelKey]}`}>
            <div className="admin-bar__row">
              <span>{item[labelKey]}</span>
              <span>{item.count}</span>
            </div>
            <div className="admin-bar__track">
              <div
                className="admin-bar__fill"
                style={{ width: `${(item.count / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function TrendGroup({ title, items }) {
  const maxValue = Math.max(...items.map((item) => item.count || 0), 1);

  return (
    <article className="admin-item">
      <strong>{title}</strong>
      <div className="admin-bars">
        {items.map((item) => (
          <div className="admin-bar" key={`${title}-${item.month}`}>
            <div className="admin-bar__row">
              <span>{item.month}</span>
              <span>{item.count}</span>
            </div>
            <div className="admin-bar__track">
              <div
                className="admin-bar__fill"
                style={{ width: `${(item.count / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function CategoryItem({ category, onEdit, onDelete }) {
  return (
    <article className="admin-item">
      <div className="admin-item__header">
        <strong>{category.name}</strong>
        <span className={`tag${category.isActive ? " tag--light" : ""}`}>
          {category.isActive ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="admin-item__footer">
        <span>{category.parent?.name || "Top level"}</span>
        <span>Products: {category._count?.products || 0}</span>
        <span>Children: {category._count?.children || 0}</span>
      </div>
      <p className="admin-item__summary">
        {category.description || "No description provided."}
      </p>
      <div className="admin-item__actions">
        <button
          type="button"
          className="btn btn--secondary btn--small"
          onClick={() => onEdit(category)}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => onDelete(category)}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function createCategoryPayload(form) {
  const payload = {
    name: form.name.trim(),
    description: form.description.trim() || null,
    iconUrl: form.iconUrl.trim() || null,
    parentId: form.parentId || null,
    isActive: form.isActive === "true",
  };

  if (form.sortOrder.trim()) {
    payload.sortOrder = Number(form.sortOrder);
  }

  return payload;
}

function syncLabel() {
  return `Last synced at ${new Date().toLocaleTimeString()}`;
}

function formatAttentionCount(value) {
  return value > 99 ? "99+" : String(value);
}

export function AdminDashboardPage({ page }) {
  const { user, loading, logout } = useSession();
  const { dialog, setDialog, closeDialog, confirmDialog, promptDialog } =
    useActionDialog();
  const [message, showMessage] = useMessageState("");
  const [activePanel, setActivePanel] = useState("overview");
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastSync, setLastSync] = useState("No data loaded yet.");
  const [overview, setOverview] = useState(null);
  const [notificationsFilters, setNotificationsFilters] = useState(
    INITIAL_NOTIFICATIONS_FILTERS,
  );
  const [notifications, setNotifications] = useState([]);
  const [notificationsPagination, setNotificationsPagination] = useState(null);
  const [usersFilters, setUsersFilters] = useState(INITIAL_USERS_FILTERS);
  const [usersList, setUsersList] = useState([]);
  const [usersPagination, setUsersPagination] = useState(null);
  const [productsFilters, setProductsFilters] = useState(
    INITIAL_PRODUCTS_FILTERS,
  );
  const [products, setProducts] = useState([]);
  const [productsPagination, setProductsPagination] = useState(null);
  const [rentalsFilters, setRentalsFilters] = useState(INITIAL_RENTALS_FILTERS);
  const [rentals, setRentals] = useState([]);
  const [rentalsPagination, setRentalsPagination] = useState(null);
  const [reportsFilters, setReportsFilters] = useState(INITIAL_REPORT_FILTERS);
  const [report, setReport] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryForm, setCategoryForm] = useState(INITIAL_CATEGORY_FORM);

  const categoryParentOptions = useMemo(
    () => categories.filter((category) => category.id !== editingCategoryId),
    [categories, editingCategoryId],
  );

  useEffect(() => {
    document.title = "Admin Dashboard | AI Rent";
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      redirectToLogin();
      return;
    }

    if (!loading && user?.role !== "admin") {
      window.location.href = "/";
    }
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user || user.role !== "admin") {
      return;
    }

    refreshUnreadCount();
    loadOverview();
  }, [loading, user]);

  async function refreshUnreadCount() {
    const result = await fetchApi("/api/v1/notifications/unread-count", {
      auth: true,
    });

    setUnreadCount(result.data?.data?.unreadCount || 0);
  }

  async function loadOverview() {
    showMessage("Loading dashboard overview...", "info");

    const result = await fetchApi("/api/v1/admin/dashboard", { auth: true });
    if (!result.ok || !result.data?.success) {
      showMessage(result.data?.message || "Failed to load dashboard.", "error");
      return;
    }

    setOverview(result.data.data);
    setLastSync(syncLabel());
    showMessage("Overview loaded successfully.", "success");
  }

  async function refreshOverviewSnapshot() {
    const result = await fetchApi("/api/v1/admin/dashboard", { auth: true });
    if (!result.ok || !result.data?.success) {
      return;
    }

    setOverview(result.data.data);
    setLastSync(syncLabel());
  }

  async function loadNotifications(nextFilters = notificationsFilters) {
    showMessage("Loading notifications...", "info");

    const query = buildQuery(nextFilters);
    const result = await fetchApi(`/api/v1/notifications?${query}`, {
      auth: true,
    });

    if (!result.ok || !result.data?.success) {
      showMessage(
        result.data?.message || "Failed to load notifications.",
        "error",
      );
      return;
    }

    const payload = result.data.data;
    setNotifications(payload.notifications || []);
    setNotificationsPagination(payload.pagination || null);
    setLastSync(syncLabel());
    showMessage("Notifications updated.", "success");
    await refreshUnreadCount();
  }

  async function loadUsers(nextFilters = usersFilters) {
    showMessage("Loading users...", "info");

    const query = buildQuery({
      ...nextFilters,
      limit: 10,
    });
    const result = await fetchApi(`/api/v1/admin/users?${query}`, {
      auth: true,
    });

    if (!result.ok || !result.data?.success) {
      showMessage(result.data?.message || "Failed to load users.", "error");
      return;
    }

    const payload = result.data.data;
    setUsersList(payload.users || []);
    setUsersPagination(payload.pagination || null);
    setLastSync(syncLabel());
    showMessage("Users loaded successfully.", "success");
  }

  async function loadProducts(nextFilters = productsFilters) {
    showMessage("Loading products...", "info");

    const query = buildQuery({
      ...nextFilters,
      limit: 10,
    });
    const result = await fetchApi(`/api/v1/admin/products?${query}`, {
      auth: true,
    });

    if (!result.ok || !result.data?.success) {
      showMessage(result.data?.message || "Failed to load products.", "error");
      return;
    }

    const payload = result.data.data;
    setProducts(payload.products || []);
    setProductsPagination(payload.pagination || null);
    setLastSync(syncLabel());
    showMessage("Products loaded successfully.", "success");
  }

  async function loadRentals(nextFilters = rentalsFilters) {
    showMessage("Loading rentals...", "info");

    const query = buildQuery({
      ...nextFilters,
      limit: 10,
    });
    const result = await fetchApi(`/api/v1/admin/rentals?${query}`, {
      auth: true,
    });

    if (!result.ok || !result.data?.success) {
      showMessage(result.data?.message || "Failed to load rentals.", "error");
      return;
    }

    const payload = result.data.data;
    setRentals(payload.rentals || []);
    setRentalsPagination(payload.pagination || null);
    setLastSync(syncLabel());
    showMessage("Rentals loaded successfully.", "success");
  }

  async function loadReports(nextFilters = reportsFilters) {
    showMessage("Loading reports...", "info");

    const query = buildQuery(nextFilters);
    const result = await fetchApi(`/api/v1/admin/reports?${query}`, {
      auth: true,
    });

    if (!result.ok || !result.data?.success) {
      showMessage(result.data?.message || "Failed to load reports.", "error");
      return;
    }

    setReport(result.data.data);
    setLastSync(syncLabel());
    showMessage("Reports loaded successfully.", "success");
  }

  async function loadCategories() {
    showMessage("Loading categories...", "info");

    const result = await fetchApi("/api/v1/categories");
    if (!result.ok || !result.data?.success) {
      showMessage(
        result.data?.message || "Failed to load categories.",
        "error",
      );
      return;
    }

    setCategories(result.data.data?.categories || []);
    setLastSync(syncLabel());
    showMessage("Categories loaded successfully.", "success");
  }

  async function loadActivePanel(panel = activePanel) {
    if (panel === "overview") await loadOverview();
    if (panel === "notifications") await loadNotifications();
    if (panel === "users") await loadUsers();
    if (panel === "products") await loadProducts();
    if (panel === "rentals") await loadRentals();
    if (panel === "reports") await loadReports();
    if (panel === "categories") await loadCategories();
  }

  async function handlePanelChange(panelName) {
    setActivePanel(panelName);
    await loadActivePanel(panelName);
  }

  async function handleMarkAllRead() {
    const result = await fetchApi("/api/v1/notifications/read-all", {
      method: "PUT",
      auth: true,
    });

    showMessage(
      result.data?.message || "Notifications updated.",
      result.ok ? "success" : "error",
    );

    if (result.ok) {
      await refreshUnreadCount();
      if (activePanel === "notifications") {
        await loadNotifications();
      }
    }
  }

  async function handleMarkRead(notificationId) {
    const result = await fetchApi(
      `/api/v1/notifications/${notificationId}/read`,
      {
        method: "PUT",
        auth: true,
      },
    );

    showMessage(
      result.data?.message || "Notification updated.",
      result.ok ? "success" : "error",
    );

    if (result.ok) {
      await loadNotifications();
    }
  }

  async function handleUserToggleStatus(targetUser) {
    const isActive = !targetUser.isActive;
    const reason = await promptDialog({
      title: isActive ? "Activate user" : "Suspend user",
      message: `Add an optional note for ${targetUser.name}.`,
      fieldLabel: "Admin note",
      fieldPlaceholder: isActive
        ? "Optional activation note"
        : "Optional suspension reason",
      confirmLabel: isActive ? "Activate user" : "Suspend user",
      cancelLabel: "Back",
      tone: isActive ? "default" : "danger",
    });

    if (reason === null) {
      return;
    }

    const result = await fetchApi(
      `/api/v1/admin/users/${targetUser.id}/status`,
      {
        method: "PUT",
        auth: true,
        body: {
          isActive,
          reason: reason?.trim() || undefined,
        },
      },
    );

    showMessage(
      result.data?.message || "User updated.",
      result.ok ? "success" : "error",
    );

    if (result.ok) {
      await loadUsers();
    }
  }

  async function moderateProduct(productId, action) {
    const reasonInput = await promptDialog({
      title: action === "approve" ? "Approve listing" : "Reject listing",
      message:
        action === "approve"
          ? "Add an optional approval note."
          : "Add a required note so the owner knows what to fix.",
      fieldLabel: "Moderation note",
      fieldPlaceholder:
        action === "approve"
          ? "Optional approval note"
          : "Required note for the owner",
      confirmLabel: action === "approve" ? "Approve" : "Reject",
      cancelLabel: "Back",
      tone: action === "approve" ? "default" : "danger",
      fieldRequired: action === "reject",
    });
    if (reasonInput === null) {
      return;
    }

    const reason = reasonInput.trim();
    if (action === "reject" && !reason) {
      showMessage(
        "Add a note for the owner so they know what needs to be fixed.",
        "error",
      );
      return;
    }

    const endpoint =
      action === "approve"
        ? `/api/v1/admin/products/${productId}/approve`
        : `/api/v1/admin/products/${productId}/reject`;

    const result = await fetchApi(endpoint, {
      method: "PUT",
      auth: true,
      body: {
        reason: reason || undefined,
      },
    });

    showMessage(
      result.data?.message || "Product updated.",
      result.ok ? "success" : "error",
    );

    if (result.ok) {
      await refreshOverviewSnapshot();

      if (activePanel === "products") {
        await loadProducts();
      }
    }
  }

  async function changeProductStatus(productId, status) {
    const result = await fetchApi(`/api/v1/products/${productId}/status`, {
      method: "PUT",
      auth: true,
      body: {
        status,
      },
    });

    showMessage(
      result.data?.message || "Product updated.",
      result.ok ? "success" : "error",
    );

    if (!result.ok) {
      return;
    }

    if (activePanel === "overview") {
      await loadOverview();
      return;
    }

    if (activePanel === "products") {
      await loadProducts();
    }
  }

  function resetCategoryEditor() {
    setEditingCategoryId(null);
    setCategoryForm(INITIAL_CATEGORY_FORM);
  }

  function startEditingCategory(category) {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name || "",
      sortOrder:
        category.sortOrder === undefined ? "" : String(category.sortOrder),
      description: category.description || "",
      iconUrl: category.iconUrl || "",
      parentId: category.parentId || "",
      isActive: category.isActive ? "true" : "false",
    });
  }

  async function handleCategorySubmit(event) {
    event.preventDefault();

    const payload = createCategoryPayload(categoryForm);
    if (!payload.name) {
      showMessage("Category name is required.", "error");
      return;
    }

    const result = await fetchApi(
      editingCategoryId
        ? `/api/v1/categories/${editingCategoryId}`
        : "/api/v1/categories",
      {
        method: editingCategoryId ? "PUT" : "POST",
        auth: true,
        body: payload,
      },
    );

    showMessage(
      result.data?.message || "Category updated.",
      result.ok ? "success" : "error",
    );

    if (result.ok) {
      resetCategoryEditor();
      await loadCategories();
    }
  }

  async function handleDeleteCategory(category) {
    const confirmed = await confirmDialog({
      title: "Delete category?",
      message: `Delete category "${category.name}"?`,
      confirmLabel: "Delete category",
      cancelLabel: "Keep category",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    const result = await fetchApi(`/api/v1/categories/${category.id}`, {
      method: "DELETE",
      auth: true,
    });

    showMessage(
      result.data?.message || "Category deleted.",
      result.ok ? "success" : "error",
    );

    if (result.ok) {
      if (editingCategoryId === category.id) {
        resetCategoryEditor();
      }
      await loadCategories();
    }
  }

  const panelDetails = PANEL_META[activePanel];
  const pendingApprovalCount = Math.max(
    Number(overview?.summary?.products?.pendingReview || 0),
    Number(overview?.recent?.pendingProducts?.length || 0),
  );
  const pendingRentalCount = Number(overview?.summary?.rentals?.pending || 0);
  const attentionCounts = {
    notifications: unreadCount,
    products: pendingApprovalCount,
    rentals: pendingRentalCount,
  };
  const overviewStats = overview
    ? [
        {
          label: "Users",
          value: String(overview.summary?.users?.total || 0),
          hint: `${overview.summary?.users?.active || 0} active`,
        },
        {
          label: "Products",
          value: String(overview.summary?.products?.total || 0),
          hint: `${overview.summary?.products?.pendingReview || 0} pending review`,
        },
        {
          label: "Rentals",
          value: String(overview.summary?.rentals?.total || 0),
          hint: `${overview.summary?.rentals?.active || 0} active`,
        },
        {
          label: "Reviews",
          value: String(overview.summary?.content?.reviews || 0),
          hint: `${overview.summary?.content?.categories || 0} categories`,
        },
        {
          label: "Booked value",
          value: formatMoney(overview.financial?.bookedValue || 0),
          hint: "All booked rentals",
        },
        {
          label: "Platform fees",
          value: formatMoney(overview.financial?.platformFees || 0),
          hint: "Tracked by admin",
        },
        {
          label: "New users",
          value: String(overview.growthLast30Days?.users || 0),
          hint: "Last 30 days",
        },
        {
          label: "New rentals",
          value: String(overview.growthLast30Days?.rentals || 0),
          hint: "Last 30 days",
        },
      ]
    : [];
  const reportStats = report
    ? [
        {
          label: "Booked value",
          value: formatMoney(report.revenue?.bookedValue || 0),
          hint: `${report.period?.days || 0} day window`,
        },
        {
          label: "Platform fees",
          value: formatMoney(report.revenue?.bookedPlatformFees || 0),
          hint: "Booked rentals",
        },
        {
          label: "Completed value",
          value: formatMoney(report.revenue?.completedValue || 0),
          hint: "Completed rentals",
        },
        {
          label: "Average rating",
          value: String(report.quality?.averageRating || 0),
          hint: `${report.quality?.totalReviews || 0} reviews`,
        },
        {
          label: "Completion rate",
          value: `${report.quality?.completionRate || 0}%`,
          hint: "Request to completion",
        },
      ]
    : [];

  return (
    <SiteLayout page={page} user={user} onLogout={logout}>
      <section className="page-hero admin-hero">
        <div>
          <p className="eyebrow">Control center</p>
          <h1>Admin dashboard</h1>
          <p>
            Review platform health, moderate users and products, inspect
            rentals, and manage categories from one page with the same
            multi-page React architecture as the rest of the front end.
          </p>
        </div>

        <div className="admin-hero__actions">
          <div className="admin-badge">
            <span>Unread notifications</span>
            <strong>{unreadCount}</strong>
          </div>
          <div className="admin-badge">
            <span>Current panel</span>
            <strong>{panelDetails.title}</strong>
          </div>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => loadActivePanel()}
          >
            Refresh Panel
          </button>
        </div>
      </section>

      <section className="admin-layout">
        <aside className="surface-panel admin-sidebar">
          <div className="admin-sidebar__profile">
            <p className="eyebrow">Signed in</p>
            <h2>{user?.name || "Admin"}</h2>
            <p className="compact-text">{user?.email || "No active session"}</p>
          </div>

          <nav className="admin-nav">
            {Object.entries(PANEL_META).map(([panelName, details]) => {
              const attentionCount = attentionCounts[panelName] || 0;
              const showAttentionBadge = attentionCount > 0;
              const attentionLabel =
                panelName === "notifications"
                  ? `${attentionCount} unread notifications`
                  : panelName === "products"
                    ? `${attentionCount} products need approval`
                    : `${attentionCount} rentals need attention`;

              return (
                <button
                  key={panelName}
                  type="button"
                  className={`admin-nav__button${activePanel === panelName ? " is-active" : ""}${showAttentionBadge ? " is-attention admin-nav__button--with-badge" : ""}`}
                  onClick={() => handlePanelChange(panelName)}
                >
                  {showAttentionBadge ? (
                    <span
                      className="admin-nav__badge"
                      aria-label={attentionLabel}
                    >
                      {formatAttentionCount(attentionCount)}
                    </span>
                  ) : null}
                  <span className="admin-nav__label">{details.title}</span>
                </button>
              );
            })}
          </nav>

          <div className="admin-sidebar__footer">
            <p className="compact-text">{lastSync}</p>
          </div>
        </aside>

        <section className="admin-content">
          <div className="surface-panel admin-toolbar">
            <div>
              <p className="eyebrow">{panelDetails.eyebrow}</p>
              <h2>{panelDetails.title}</h2>
            </div>
            <div className="admin-toolbar__actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={handleMarkAllRead}
              >
                Mark All Read
              </button>
            </div>
          </div>

          <MessageText message={message} id="adminMessage" />

          <section
            className={`admin-panel${activePanel === "overview" ? " is-active" : ""}`}
          >
            <div className="admin-stats">
              {overviewStats.map((item) => (
                <AdminStatCard key={item.label} {...item} />
              ))}
            </div>

            <div className="admin-grid">
              <article className="surface-panel">
                <SectionHeading
                  eyebrow="Recent users"
                  title="Newest accounts"
                  compact
                />
                <AdminList
                  items={overview?.recent?.users || []}
                  emptyMessage="No recent users found."
                  renderItem={(item) => (
                    <OverviewUserItem key={item.id} user={item} />
                  )}
                />
              </article>

              <article className="surface-panel">
                <SectionHeading
                  eyebrow="Pending products"
                  title="Listings waiting for review"
                  compact
                />
                <AdminList
                  items={overview?.recent?.pendingProducts || []}
                  emptyMessage="No products are waiting for review."
                  renderItem={(item) => (
                    <PendingProductItem
                      key={item.id}
                      product={item}
                      onModerate={moderateProduct}
                    />
                  )}
                />
              </article>
            </div>

            <article className="surface-panel">
              <SectionHeading
                eyebrow="Recent rentals"
                title="Latest booking activity"
                compact
              />
              <AdminList
                items={overview?.recent?.rentals || []}
                emptyMessage="No recent rentals found."
                renderItem={(item) => (
                  <OverviewRentalItem key={item.id} rental={item} />
                )}
              />
            </article>
          </section>

          <section
            className={`admin-panel${activePanel === "notifications" ? " is-active" : ""}`}
          >
            <article className="surface-panel">
              <form
                className="form-grid admin-filters"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const nextFilters = { ...notificationsFilters, page: 1 };
                  setNotificationsFilters(nextFilters);
                  await loadNotifications(nextFilters);
                }}
              >
                <div className="field">
                  <label htmlFor="notificationsIsRead">Status</label>
                  <select
                    id="notificationsIsRead"
                    name="isRead"
                    className="input"
                    value={notificationsFilters.isRead}
                    onChange={(event) =>
                      setNotificationsFilters((previous) => ({
                        ...previous,
                        isRead: event.target.value,
                      }))
                    }
                  >
                    <option value="">All</option>
                    <option value="false">Unread</option>
                    <option value="true">Read</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="notificationsType">Type</label>
                  <select
                    id="notificationsType"
                    name="type"
                    className="input"
                    value={notificationsFilters.type}
                    onChange={(event) =>
                      setNotificationsFilters((previous) => ({
                        ...previous,
                        type: event.target.value,
                      }))
                    }
                  >
                    <option value="">All</option>
                    <option value="system">System</option>
                    <option value="rental_request">Rental request</option>
                    <option value="rental_approved">Rental approved</option>
                    <option value="rental_rejected">Rental rejected</option>
                    <option value="rental_started">Rental started</option>
                    <option value="rental_completed">Rental completed</option>
                    <option value="rental_cancelled">Rental cancelled</option>
                    <option value="new_review">New review</option>
                    <option value="review_reply">Review reply</option>
                    <option value="recommendation">Recommendation</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="notificationsLimit">Per page</label>
                  <select
                    id="notificationsLimit"
                    name="limit"
                    className="input"
                    value={notificationsFilters.limit}
                    onChange={(event) =>
                      setNotificationsFilters((previous) => ({
                        ...previous,
                        limit: event.target.value,
                      }))
                    }
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </div>

                <div className="filters-actions">
                  <button type="submit" className="btn btn--primary">
                    Apply
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={async () => {
                      setNotificationsFilters(INITIAL_NOTIFICATIONS_FILTERS);
                      await loadNotifications(INITIAL_NOTIFICATIONS_FILTERS);
                    }}
                  >
                    Reset
                  </button>
                </div>
              </form>
            </article>

            <article className="surface-panel">
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="eyebrow">Inbox</p>
                  <h3>Admin notifications</h3>
                </div>
                <AdminPagination
                  pagination={notificationsPagination}
                  onPrevious={async () => {
                    const nextFilters = {
                      ...notificationsFilters,
                      page: notificationsFilters.page - 1,
                    };
                    setNotificationsFilters(nextFilters);
                    await loadNotifications(nextFilters);
                  }}
                  onNext={async () => {
                    const nextFilters = {
                      ...notificationsFilters,
                      page: notificationsFilters.page + 1,
                    };
                    setNotificationsFilters(nextFilters);
                    await loadNotifications(nextFilters);
                  }}
                />
              </div>

              <AdminList
                items={notifications}
                emptyMessage="No notifications match the current filters."
                renderItem={(item) => (
                  <NotificationItem
                    key={item.id}
                    notification={item}
                    onMarkRead={handleMarkRead}
                  />
                )}
              />
            </article>
          </section>

          <section
            className={`admin-panel${activePanel === "users" ? " is-active" : ""}`}
          >
            <article className="surface-panel">
              <form
                className="form-grid admin-filters"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const nextFilters = { ...usersFilters, page: 1 };
                  setUsersFilters(nextFilters);
                  await loadUsers(nextFilters);
                }}
              >
                <div className="field">
                  <label htmlFor="usersSearch">Search</label>
                  <input
                    id="usersSearch"
                    name="search"
                    type="search"
                    className="input"
                    placeholder="Name, email, phone, city"
                    value={usersFilters.search}
                    onChange={(event) =>
                      setUsersFilters((previous) => ({
                        ...previous,
                        search: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="usersRole">Role</label>
                  <select
                    id="usersRole"
                    name="role"
                    className="input"
                    value={usersFilters.role}
                    onChange={(event) =>
                      setUsersFilters((previous) => ({
                        ...previous,
                        role: event.target.value,
                      }))
                    }
                  >
                    <option value="">All roles</option>
                    <option value="renter">Renter</option>
                    <option value="owner">Owner</option>
                    <option value="both">Both</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="usersIsActive">Status</label>
                  <select
                    id="usersIsActive"
                    name="isActive"
                    className="input"
                    value={usersFilters.isActive}
                    onChange={(event) =>
                      setUsersFilters((previous) => ({
                        ...previous,
                        isActive: event.target.value,
                      }))
                    }
                  >
                    <option value="">All statuses</option>
                    <option value="true">Active</option>
                    <option value="false">Suspended</option>
                  </select>
                </div>

                <div className="filters-actions">
                  <button type="submit" className="btn btn--primary">
                    Apply
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={async () => {
                      setUsersFilters(INITIAL_USERS_FILTERS);
                      await loadUsers(INITIAL_USERS_FILTERS);
                    }}
                  >
                    Reset
                  </button>
                </div>
              </form>
            </article>

            <article className="surface-panel">
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="eyebrow">User management</p>
                  <h3>Accounts and status</h3>
                </div>
                <AdminPagination
                  pagination={usersPagination}
                  onPrevious={async () => {
                    const nextFilters = {
                      ...usersFilters,
                      page: usersFilters.page - 1,
                    };
                    setUsersFilters(nextFilters);
                    await loadUsers(nextFilters);
                  }}
                  onNext={async () => {
                    const nextFilters = {
                      ...usersFilters,
                      page: usersFilters.page + 1,
                    };
                    setUsersFilters(nextFilters);
                    await loadUsers(nextFilters);
                  }}
                />
              </div>

              <AdminList
                items={usersList}
                emptyMessage="No users match the current filters."
                renderItem={(item) => (
                  <UserItem
                    key={item.id}
                    user={item}
                    currentUserId={user?.id}
                    onToggleStatus={handleUserToggleStatus}
                  />
                )}
              />
            </article>
          </section>

          <section
            className={`admin-panel${activePanel === "products" ? " is-active" : ""}`}
          >
            <article className="surface-panel">
              <form
                className="form-grid admin-filters"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const nextFilters = { ...productsFilters, page: 1 };
                  setProductsFilters(nextFilters);
                  await loadProducts(nextFilters);
                }}
              >
                <div className="field">
                  <label htmlFor="productsSearch">Search</label>
                  <input
                    id="productsSearch"
                    name="search"
                    type="search"
                    className="input"
                    placeholder="Title, owner, email, city"
                    value={productsFilters.search}
                    onChange={(event) =>
                      setProductsFilters((previous) => ({
                        ...previous,
                        search: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="productsStatus">Status</label>
                  <select
                    id="productsStatus"
                    name="status"
                    className="input"
                    value={productsFilters.status}
                    onChange={(event) =>
                      setProductsFilters((previous) => ({
                        ...previous,
                        status: event.target.value,
                      }))
                    }
                  >
                    <option value="">All statuses</option>
                    <option value="available">Available</option>
                    <option value="rented">Rented</option>
                    <option value="unavailable">Unavailable</option>
                    <option value="under_review">Under review</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="productsApproval">Approval</label>
                  <select
                    id="productsApproval"
                    name="isApproved"
                    className="input"
                    value={productsFilters.isApproved}
                    onChange={(event) =>
                      setProductsFilters((previous) => ({
                        ...previous,
                        isApproved: event.target.value,
                      }))
                    }
                  >
                    <option value="">All</option>
                    <option value="true">Approved</option>
                    <option value="false">Unapproved</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="productsCity">City</label>
                  <input
                    id="productsCity"
                    name="city"
                    type="text"
                    className="input"
                    placeholder="Filter by city"
                    value={productsFilters.city}
                    onChange={(event) =>
                      setProductsFilters((previous) => ({
                        ...previous,
                        city: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="filters-actions">
                  <button type="submit" className="btn btn--primary">
                    Apply
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={async () => {
                      setProductsFilters(INITIAL_PRODUCTS_FILTERS);
                      await loadProducts(INITIAL_PRODUCTS_FILTERS);
                    }}
                  >
                    Reset
                  </button>
                </div>
              </form>
            </article>

            <article className="surface-panel">
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="eyebrow">Moderation queue</p>
                  <h3>Listings and approval state</h3>
                </div>
                <AdminPagination
                  pagination={productsPagination}
                  onPrevious={async () => {
                    const nextFilters = {
                      ...productsFilters,
                      page: productsFilters.page - 1,
                    };
                    setProductsFilters(nextFilters);
                    await loadProducts(nextFilters);
                  }}
                  onNext={async () => {
                    const nextFilters = {
                      ...productsFilters,
                      page: productsFilters.page + 1,
                    };
                    setProductsFilters(nextFilters);
                    await loadProducts(nextFilters);
                  }}
                />
              </div>

              <AdminList
                items={products}
                emptyMessage="No products match the current filters."
                renderItem={(item) => (
                  <ProductItem
                    key={item.id}
                    product={item}
                    onModerate={moderateProduct}
                    onChangeStatus={changeProductStatus}
                  />
                )}
              />
            </article>
          </section>

          <section
            className={`admin-panel${activePanel === "rentals" ? " is-active" : ""}`}
          >
            <article className="surface-panel">
              <form
                className="form-grid admin-filters"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const nextFilters = { ...rentalsFilters, page: 1 };
                  setRentalsFilters(nextFilters);
                  await loadRentals(nextFilters);
                }}
              >
                <div className="field">
                  <label htmlFor="rentalsSearch">Search</label>
                  <input
                    id="rentalsSearch"
                    name="search"
                    type="search"
                    className="input"
                    placeholder="Product, renter, owner, email"
                    value={rentalsFilters.search}
                    onChange={(event) =>
                      setRentalsFilters((previous) => ({
                        ...previous,
                        search: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="rentalsStatus">Status</label>
                  <select
                    id="rentalsStatus"
                    name="status"
                    className="input"
                    value={rentalsFilters.status}
                    onChange={(event) =>
                      setRentalsFilters((previous) => ({
                        ...previous,
                        status: event.target.value,
                      }))
                    }
                  >
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>

                <div className="filters-actions">
                  <button type="submit" className="btn btn--primary">
                    Apply
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={async () => {
                      setRentalsFilters(INITIAL_RENTALS_FILTERS);
                      await loadRentals(INITIAL_RENTALS_FILTERS);
                    }}
                  >
                    Reset
                  </button>
                </div>
              </form>
            </article>

            <article className="surface-panel">
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="eyebrow">Rentals</p>
                  <h3>Booking oversight</h3>
                </div>
                <AdminPagination
                  pagination={rentalsPagination}
                  onPrevious={async () => {
                    const nextFilters = {
                      ...rentalsFilters,
                      page: rentalsFilters.page - 1,
                    };
                    setRentalsFilters(nextFilters);
                    await loadRentals(nextFilters);
                  }}
                  onNext={async () => {
                    const nextFilters = {
                      ...rentalsFilters,
                      page: rentalsFilters.page + 1,
                    };
                    setRentalsFilters(nextFilters);
                    await loadRentals(nextFilters);
                  }}
                />
              </div>

              <AdminList
                items={rentals}
                emptyMessage="No rentals match the current filters."
                renderItem={(item) => (
                  <RentalItem key={item.id} rental={item} />
                )}
              />
            </article>
          </section>

          <section
            className={`admin-panel${activePanel === "reports" ? " is-active" : ""}`}
          >
            <article className="surface-panel">
              <form
                className="form-grid admin-filters"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await loadReports(reportsFilters);
                }}
              >
                <div className="field">
                  <label htmlFor="reportsDays">Days</label>
                  <select
                    id="reportsDays"
                    name="days"
                    className="input"
                    value={reportsFilters.days}
                    onChange={(event) =>
                      setReportsFilters((previous) => ({
                        ...previous,
                        days: event.target.value,
                      }))
                    }
                  >
                    <option value="30">30</option>
                    <option value="60">60</option>
                    <option value="90">90</option>
                    <option value="180">180</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="reportsMonths">Months</label>
                  <select
                    id="reportsMonths"
                    name="months"
                    className="input"
                    value={reportsFilters.months}
                    onChange={(event) =>
                      setReportsFilters((previous) => ({
                        ...previous,
                        months: event.target.value,
                      }))
                    }
                  >
                    <option value="6">6</option>
                    <option value="12">12</option>
                    <option value="18">18</option>
                    <option value="24">24</option>
                  </select>
                </div>

                <div className="filters-actions">
                  <button type="submit" className="btn btn--primary">
                    Refresh Report
                  </button>
                </div>
              </form>
            </article>

            <div className="admin-stats">
              {reportStats.map((item) => (
                <AdminStatCard key={item.label} {...item} />
              ))}
            </div>

            <div className="admin-grid">
              <article className="surface-panel">
                <SectionHeading
                  eyebrow="Distributions"
                  title="Platform composition"
                  compact
                />
                <div className="list-stack">
                  {report ? (
                    <>
                      <BarGroup
                        title="Users by role"
                        items={report.distributions?.usersByRole || []}
                        labelKey="role"
                      />
                      <BarGroup
                        title="Users by status"
                        items={report.distributions?.usersByStatus || []}
                        labelKey="status"
                      />
                      <BarGroup
                        title="Products by status"
                        items={report.distributions?.productsByStatus || []}
                        labelKey="status"
                      />
                      <BarGroup
                        title="Rentals by status"
                        items={report.distributions?.rentalsByStatus || []}
                        labelKey="status"
                      />
                    </>
                  ) : (
                    <EmptyState message="No report distributions available." />
                  )}
                </div>
              </article>

              <article className="surface-panel">
                <SectionHeading
                  eyebrow="Trend lines"
                  title="Growth by month"
                  compact
                />
                <div className="list-stack">
                  {report ? (
                    <>
                      <TrendGroup
                        title="User registrations"
                        items={report.trends?.userRegistrations || []}
                      />
                      <TrendGroup
                        title="Product submissions"
                        items={report.trends?.productSubmissions || []}
                      />
                      <TrendGroup
                        title="Rental requests"
                        items={report.trends?.rentalRequests || []}
                      />
                    </>
                  ) : (
                    <EmptyState message="No report trends available." />
                  )}
                </div>
              </article>
            </div>

            <div className="admin-grid">
              <article className="surface-panel">
                <SectionHeading
                  eyebrow="Categories"
                  title="Top listing categories"
                  compact
                />
                <AdminList
                  items={report?.leaderboards?.categoriesByListings || []}
                  emptyMessage="No categories found."
                  renderItem={(item) => (
                    <article className="admin-item" key={item.id}>
                      <div className="admin-item__header">
                        <strong>{item.name}</strong>
                        <span className="tag tag--light">
                          {item.totalProducts}
                        </span>
                      </div>
                      <p className="admin-item__summary">
                        Total products in this category.
                      </p>
                    </article>
                  )}
                />
              </article>

              <article className="surface-panel">
                <SectionHeading
                  eyebrow="Top products"
                  title="Most rented listings"
                  compact
                />
                <AdminList
                  items={report?.leaderboards?.productsByRentals || []}
                  emptyMessage="No products found."
                  renderItem={(item) => (
                    <article className="admin-item" key={item.id}>
                      <div className="admin-item__header">
                        <strong>{item.title}</strong>
                        <span className="tag tag--light">
                          {item.totalRentals}
                        </span>
                      </div>
                      <p className="admin-item__meta">
                        Owner: {item.owner?.name || "Unknown"}
                      </p>
                      <p className="admin-item__summary">
                        Rating {item.avgRating || 0} | {item.status}
                      </p>
                    </article>
                  )}
                />
              </article>
            </div>
          </section>

          <section
            className={`admin-panel${activePanel === "categories" ? " is-active" : ""}`}
          >
            <div className="admin-grid admin-grid--categories">
              <article className="surface-panel">
                <div className="section-heading section-heading--compact">
                  <div>
                    <p className="eyebrow">
                      {editingCategoryId
                        ? "Category editor"
                        : "Category studio"}
                    </p>
                    <h3>
                      {editingCategoryId ? "Edit category" : "Create category"}
                    </h3>
                  </div>
                </div>

                <form className="form-grid" onSubmit={handleCategorySubmit}>
                  <div className="field">
                    <label htmlFor="categoryName">Name</label>
                    <input
                      id="categoryName"
                      name="name"
                      type="text"
                      className="input"
                      required
                      value={categoryForm.name}
                      onChange={(event) =>
                        setCategoryForm((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="categorySortOrder">Sort order</label>
                    <input
                      id="categorySortOrder"
                      name="sortOrder"
                      type="number"
                      min="0"
                      className="input"
                      value={categoryForm.sortOrder}
                      onChange={(event) =>
                        setCategoryForm((previous) => ({
                          ...previous,
                          sortOrder: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field field--full">
                    <label htmlFor="categoryDescription">Description</label>
                    <textarea
                      id="categoryDescription"
                      name="description"
                      className="textarea"
                      rows="4"
                      value={categoryForm.description}
                      onChange={(event) =>
                        setCategoryForm((previous) => ({
                          ...previous,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="categoryIconUrl">Icon URL</label>
                    <input
                      id="categoryIconUrl"
                      name="iconUrl"
                      type="url"
                      className="input"
                      value={categoryForm.iconUrl}
                      onChange={(event) =>
                        setCategoryForm((previous) => ({
                          ...previous,
                          iconUrl: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="categoryParentId">Parent category</label>
                    <select
                      id="categoryParentId"
                      name="parentId"
                      className="input"
                      value={categoryForm.parentId}
                      onChange={(event) =>
                        setCategoryForm((previous) => ({
                          ...previous,
                          parentId: event.target.value,
                        }))
                      }
                    >
                      <option value="">No parent</option>
                      {categoryParentOptions.map((category) => (
                        <option value={category.id} key={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="categoryIsActive">Status</label>
                    <select
                      id="categoryIsActive"
                      name="isActive"
                      className="input"
                      value={categoryForm.isActive}
                      onChange={(event) =>
                        setCategoryForm((previous) => ({
                          ...previous,
                          isActive: event.target.value,
                        }))
                      }
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>

                  <div className="filters-actions field--full">
                    <button type="submit" className="btn btn--primary">
                      {editingCategoryId ? "Save Changes" : "Create Category"}
                    </button>
                    {editingCategoryId ? (
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={resetCategoryEditor}
                      >
                        Cancel Edit
                      </button>
                    ) : null}
                  </div>
                </form>
              </article>

              <article className="surface-panel">
                <SectionHeading
                  eyebrow="Catalog"
                  title="All categories"
                  compact
                />
                <AdminList
                  items={categories}
                  emptyMessage="No categories available."
                  renderItem={(item) => (
                    <CategoryItem
                      key={item.id}
                      category={item}
                      onEdit={startEditingCategory}
                      onDelete={handleDeleteCategory}
                    />
                  )}
                />
              </article>
            </div>
          </section>
        </section>
      </section>
      <ActionDialog
        dialog={dialog}
        setDialog={setDialog}
        onClose={closeDialog}
      />
    </SiteLayout>
  );
}
