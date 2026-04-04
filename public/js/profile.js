const profileMessage = document.getElementById("profileMessage");
const avatarPreview = document.getElementById("avatarPreview");
const profileName = document.getElementById("profileName");
const profileRole = document.getElementById("profileRole");
const profileMeta = document.getElementById("profileMeta");
const profileForm = document.getElementById("profileForm");
const avatarForm = document.getElementById("avatarForm");
const passwordForm = document.getElementById("passwordForm");
const bookingsList = document.getElementById("bookingsList");
const requestsList = document.getElementById("requestsList");
const notificationsList = document.getElementById("notificationsList");

const profileNameInput = document.getElementById("profileNameInput");
const profilePhoneInput = document.getElementById("profilePhoneInput");
const profileCityInput = document.getElementById("profileCityInput");
const profileAddressInput = document.getElementById("profileAddressInput");
const profileBioInput = document.getElementById("profileBioInput");
const avatarInput = document.getElementById("avatarInput");

let currentUser = null;

function createRentalItem(rental, listType) {
  const actions = [];

  if (listType === "bookings" && ["pending", "approved"].includes(rental.status)) {
    actions.push(
      `<button type="button" class="btn btn--secondary btn--small" data-rental-action="cancel" data-rental-id="${AIRent.escapeHtml(
        rental.id,
      )}">Cancel</button>`,
    );
  }

  if (listType === "requests" && rental.status === "pending") {
    actions.push(
      `<button type="button" class="btn btn--primary btn--small" data-rental-action="approve" data-rental-id="${AIRent.escapeHtml(
        rental.id,
      )}">Approve</button>`,
    );
    actions.push(
      `<button type="button" class="btn btn--secondary btn--small" data-rental-action="reject" data-rental-id="${AIRent.escapeHtml(
        rental.id,
      )}">Reject</button>`,
    );
  }

  if (listType === "requests" && rental.status === "approved") {
    actions.push(
      `<button type="button" class="btn btn--secondary btn--small" data-rental-action="start" data-rental-id="${AIRent.escapeHtml(
        rental.id,
      )}">Start</button>`,
    );
  }

  if (listType === "requests" && rental.status === "active") {
    actions.push(
      `<button type="button" class="btn btn--secondary btn--small" data-rental-action="complete" data-rental-id="${AIRent.escapeHtml(
        rental.id,
      )}">Complete</button>`,
    );
  }

  return `
    <article class="list-item">
      <div class="list-item__title-row">
        <div>
          <strong>${AIRent.escapeHtml(rental.product?.title || "Rental")}</strong>
          <p class="list-item__meta">
            ${AIRent.escapeHtml(rental.status)} |
            ${AIRent.escapeHtml(AIRent.formatMoney(rental.totalPrice))} |
            ${AIRent.escapeHtml(AIRent.formatDateTime(rental.startDate))}
          </p>
        </div>
        <span class="tag tag--light">${AIRent.escapeHtml(
          rental.rentalPeriodType || "rental",
        )}</span>
      </div>
      <p class="list-item__meta">
        ${
          listType === "bookings"
            ? `Owner: ${AIRent.escapeHtml(rental.owner?.name || "Unknown")}`
            : `Renter: ${AIRent.escapeHtml(rental.renter?.name || "Unknown")}`
        }
      </p>
      <div class="listing-actions">
        <a class="btn btn--ghost btn--small" href="/html/product-details.html?id=${encodeURIComponent(
          rental.productId,
        )}">
          View Product
        </a>
        ${actions.join("")}
      </div>
    </article>
  `;
}

function createNotificationItem(notification) {
  return `
    <article class="list-item">
      <div class="list-item__title-row">
        <div>
          <strong>${AIRent.escapeHtml(notification.title || "Notification")}</strong>
          <p class="list-item__meta">${AIRent.escapeHtml(
            notification.message || "No message available.",
          )}</p>
        </div>
        <span class="tag ${notification.isRead ? "tag--light" : ""}">
          ${notification.isRead ? "Read" : "Unread"}
        </span>
      </div>
      <p class="list-item__meta">${AIRent.escapeHtml(
        AIRent.formatDateTime(notification.createdAt),
      )}</p>
      ${
        notification.isRead
          ? ""
          : `<div class="listing-actions">
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

function renderList(container, items, emptyMessage, type) {
  if (!items.length) {
    container.innerHTML = AIRent.createEmptyState(emptyMessage);
    return;
  }

  container.innerHTML = items
    .map((item) =>
      type === "notification"
        ? createNotificationItem(item)
        : createRentalItem(item, type),
    )
    .join("");
}

function fillProfile(user) {
  avatarPreview.src = user.avatarUrl || avatarPreview.dataset.placeholder;
  profileName.textContent = user.name;
  profileRole.textContent = `Role: ${user.role}`;
  profileMeta.innerHTML = `
    <span>${AIRent.escapeHtml(user.email)}</span>
    <span>${AIRent.escapeHtml(user.city || "City not added")}</span>
    <span>${user.isVerified ? "Verified account" : "Verification pending"}</span>
  `;

  profileNameInput.value = user.name || "";
  profilePhoneInput.value = user.phone || "";
  profileCityInput.value = user.city || "";
  profileAddressInput.value = user.address || "";
  profileBioInput.value = user.bio || "";
}

async function loadDashboard() {
  const [profileResult, bookingsResult, requestsResult, notificationsResult] =
    await Promise.all([
      AIRent.fetchApi("/api/v1/users/me", { auth: true }),
      AIRent.fetchApi("/api/v1/rentals/my-bookings?limit=5", { auth: true }),
      AIRent.fetchApi("/api/v1/rentals/my-requests?limit=5", { auth: true }),
      AIRent.fetchApi("/api/v1/notifications?limit=5", { auth: true }),
    ]);

  if (profileResult.ok && profileResult.data?.data) {
    currentUser = profileResult.data.data;
    AIRent.saveSession({ user: currentUser });
    AIRent.updateLayout();
    fillProfile(currentUser);
  }

  renderList(
    bookingsList,
    bookingsResult.data?.data?.rentals || [],
    "You have no bookings yet.",
    "bookings",
  );
  renderList(
    requestsList,
    requestsResult.data?.data?.rentals || [],
    "You have no incoming requests yet.",
    "requests",
  );
  renderList(
    notificationsList,
    notificationsResult.data?.data?.notifications || [],
    "No notifications available.",
    "notification",
  );
}

async function handleRentalAction(action, rentalId) {
  const endpointMap = {
    approve: { method: "PUT", path: `/api/v1/rentals/${rentalId}/approve` },
    reject: { method: "PUT", path: `/api/v1/rentals/${rentalId}/reject` },
    cancel: { method: "PUT", path: `/api/v1/rentals/${rentalId}/cancel` },
    start: { method: "PUT", path: `/api/v1/rentals/${rentalId}/start` },
    complete: { method: "PUT", path: `/api/v1/rentals/${rentalId}/complete` },
  };

  const requestConfig = endpointMap[action];
  if (!requestConfig) {
    return;
  }

  const body =
    action === "reject" || action === "cancel"
      ? {
          reason:
            window.prompt("Optional reason for this action:")?.trim() || undefined,
        }
      : undefined;

  const result = await AIRent.fetchApi(requestConfig.path, {
    method: requestConfig.method,
    auth: true,
    body,
  });

  AIRent.showMessage(
    profileMessage,
    result.data?.message ||
      (result.ok ? "Action completed successfully." : "Action failed."),
    result.ok ? "success" : "error",
  );

  if (result.ok) {
    await loadDashboard();
  }
}

bookingsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-rental-action]");
  if (!button) {
    return;
  }

  await handleRentalAction(button.dataset.rentalAction, button.dataset.rentalId);
});

requestsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-rental-action]");
  if (!button) {
    return;
  }

  await handleRentalAction(button.dataset.rentalAction, button.dataset.rentalId);
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

  AIRent.showMessage(
    profileMessage,
    result.data?.message || "Notification updated.",
    result.ok ? "success" : "error",
  );

  if (result.ok) {
    await loadDashboard();
  }
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {};
  if (profileNameInput.value.trim()) payload.name = profileNameInput.value.trim();
  if (profilePhoneInput.value.trim()) payload.phone = profilePhoneInput.value.trim();
  if (profileCityInput.value.trim()) payload.city = profileCityInput.value.trim();
  if (profileAddressInput.value.trim())
    payload.address = profileAddressInput.value.trim();
  if (profileBioInput.value.trim()) payload.bio = profileBioInput.value.trim();

  if (!Object.keys(payload).length) {
    AIRent.showMessage(
      profileMessage,
      "Add at least one value before saving your profile.",
      "error",
    );
    return;
  }

  const result = await AIRent.fetchApi("/api/v1/users/me", {
    method: "PUT",
    auth: true,
    body: payload,
  });

  AIRent.showMessage(
    profileMessage,
    result.data?.message || "Profile updated.",
    result.ok ? "success" : "error",
  );

  if (result.ok && result.data?.data) {
    currentUser = result.data.data;
    AIRent.saveSession({ user: currentUser });
    AIRent.updateLayout();
    fillProfile(currentUser);
  }
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(passwordForm);
  const result = await AIRent.fetchApi("/api/v1/users/change-password", {
    method: "PUT",
    auth: true,
    body: {
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmNewPassword: formData.get("confirmNewPassword"),
    },
  });

  AIRent.showMessage(
    profileMessage,
    result.data?.message || "Password updated.",
    result.ok ? "success" : "error",
  );

  if (result.ok) {
    passwordForm.reset();
  }
});

avatarForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!avatarInput.files.length) {
    AIRent.showMessage(profileMessage, "Choose an image first.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("avatar", avatarInput.files[0]);

  const result = await AIRent.fetchApi("/api/v1/users/upload-avatar", {
    method: "POST",
    auth: true,
    body: formData,
  });

  AIRent.showMessage(
    profileMessage,
    result.data?.message || "Avatar updated.",
    result.ok ? "success" : "error",
  );

  if (result.ok && result.data?.data) {
    avatarPreview.src = result.data.data.avatarUrl || avatarPreview.src;
    await loadDashboard();
  }
});

(async function initializeProfilePage() {
  const user = await AIRent.requireAuth();
  if (!user) {
    return;
  }

  currentUser = user;
  avatarPreview.src = currentUser.avatarUrl || avatarPreview.dataset.placeholder;
  await loadDashboard();
})();
