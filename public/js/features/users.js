import { dom } from "../core/dom.js";
import { state } from "../core/state.js";
import { authedRequest } from "../services/api.js";
import {
  buildQuery,
  escapeHtml,
  formatCompactNumber,
  formatDate,
  renderAvatarOrImage,
  renderPagination,
  renderRoleBadge,
  renderStateMessage,
  renderStatusBadge,
} from "../core/ui.js";
import {
  createDetailSection,
  openDetailDialog,
  showActionDialog,
} from "./dialogs.js";
import { setStatus } from "../core/shell-ui.js";

function findById(collection, id) {
  return (collection ?? []).find((item) => item.id === id) ?? null;
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

export async function loadUsers() {
  const data = await authedRequest(
    buildQuery("/api/v1/admin/users", state.queries.users),
  );
  state.data.users = data?.data;

  const users = state.data.users?.users ?? [];
  if (!users.length) {
    dom.usersList.innerHTML = renderStateMessage(
      "No users matched the current filters.",
    );
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

export function viewUserDetails(id) {
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
        {
          label: "Rentals as renter",
          value: String(user?._count?.rentalsAsRenter ?? 0),
        },
        {
          label: "Rentals as owner",
          value: String(user?._count?.rentalsAsOwner ?? 0),
        },
        { label: "Reviews", value: String(user?._count?.reviewsWritten ?? 0) },
        { label: "Wishlists", value: String(user?._count?.wishlists ?? 0) },
        {
          label: "Notifications",
          value: String(user?._count?.notifications ?? 0),
        },
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

export async function toggleUserStatus(id, nextValue) {
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

  setStatus(
    "working",
    `${activate ? "Reactivating" : "Suspending"} ${user.name}...`,
  );

  await authedRequest(`/api/v1/admin/users/${id}/status`, {
    method: "PUT",
    body: {
      isActive: activate,
      reason: result.reason || undefined,
    },
  });

  await loadUsers();
  setStatus("success", `${user.name} updated successfully.`);
}
