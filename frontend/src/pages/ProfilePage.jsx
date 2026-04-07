import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AVATAR_PLACEHOLDER,
  fetchApi,
  getDefaultAuthenticatedPath,
  redirectToLogin,
  saveSession,
} from "../lib/airent";
import { useMessageState, useSession } from "../lib/hooks";
import {
  EmptyState,
  MessageText,
  RentalListItem,
  SectionHeading,
} from "../components/Common";
import { SiteLayout } from "../components/Layout";

function createProfileForm(user) {
  return {
    name: user?.name || "",
    phone: user?.phone || "",
    city: user?.city || "",
    address: user?.address || "",
    bio: user?.bio || "",
  };
}

const PROFILE_TAB_VALUES = ["account", "notifications"];

function getInitialProfileTab() {
  const tab =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("tab");

  return PROFILE_TAB_VALUES.includes(tab) ? tab : "account";
}

function syncProfileTabInUrl(tab) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (tab === "notifications") {
    url.searchParams.set("tab", "notifications");
  } else {
    url.searchParams.delete("tab");
  }

  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function publishNotificationsChanged(unreadCount) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("notifications:changed", {
      detail:
        typeof unreadCount === "number"
          ? {
              unreadCount,
            }
          : {},
    }),
  );
}

function getNotificationContextText(notification) {
  const contextLines = [];

  if (typeof notification?.data?.reply === "string" && notification.data.reply.trim()) {
    contextLines.push(`Reply: ${notification.data.reply.trim()}`);
  }

  if (typeof notification?.data?.reason === "string" && notification.data.reason.trim()) {
    contextLines.push(`Note: ${notification.data.reason.trim()}`);
  }

  const scheduledFinish = notification?.data?.endDate || notification?.rental?.endDate;
  if (notification?.type === "rental_started" && scheduledFinish) {
    contextLines.push(
      `Scheduled finish: ${new Date(scheduledFinish).toLocaleString()}`,
    );
  }

  const actualFinish =
    notification?.data?.actualReturnDate || notification?.rental?.actualReturnDate;
  if (notification?.type === "rental_completed" && actualFinish) {
    contextLines.push(`Finished at: ${new Date(actualFinish).toLocaleString()}`);
  }

  return contextLines;
}

function getNotificationProductId(notification) {
  const rawProductId =
    notification?.data?.productId ||
    notification?.rental?.productId ||
    notification?.rental?.product?.id ||
    null;

  return typeof rawProductId === "string" && rawProductId.trim() ? rawProductId : null;
}

function NotificationListItem({ notification, onMarkRead, onDelete }) {
  const contextLines = getNotificationContextText(notification);
  const productId = getNotificationProductId(notification);
  const productHref = productId
    ? `/html/product-details.html?id=${encodeURIComponent(productId)}`
    : "";
  const hasActions = Boolean(productId || !notification.isRead || onDelete);

  return (
    <article className="list-item">
      <div className="list-item__title-row">
        <div>
          <strong>{notification.title || "Notification"}</strong>
          <p className="list-item__meta">
            {notification.message || "No message available."}
          </p>
        </div>
        <span className={`tag${notification.isRead ? " tag--light" : ""}`}>
          {notification.isRead ? "Read" : "Unread"}
        </span>
      </div>
      <p className="list-item__meta">
        {notification.createdAt
          ? new Date(notification.createdAt).toLocaleString()
          : "Not available"}
      </p>
      {contextLines.length
        ? contextLines.map((line) => (
            <p className="list-item__meta" key={line}>
              {line}
            </p>
          ))
        : null}
      {hasActions ? (
        <div className="listing-actions">
          {productId ? (
            <a className="btn btn--secondary btn--small" href={productHref}>
              View Product
            </a>
          ) : null}
          {!notification.isRead ? (
            <button
              type="button"
              className="btn btn--secondary btn--small"
              onClick={() => onMarkRead(notification.id)}
            >
              Mark as read
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => onDelete(notification.id)}
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function replaceRentalInList(items, nextRental) {
  const hasMatch = items.some((item) => item.id === nextRental.id);
  if (!hasMatch) {
    return items;
  }

  return items.map((item) => (item.id === nextRental.id ? nextRental : item));
}

export function ProfilePage({ page }) {
  const { user, loading, setUser, refreshUser, logout } = useSession();
  const [message, showMessage] = useMessageState("");
  const [activeTab, setActiveTab] = useState(getInitialProfileTab);
  const [profileUser, setProfileUser] = useState(user);
  const [profileForm, setProfileForm] = useState(createProfileForm(user));
  const profileDirtyRef = useRef(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0);
  const [verificationPreview, setVerificationPreview] = useState(null);
  const [sendingVerification, setSendingVerification] = useState(false);
  const userId = user?.id;
  const userRole = user?.role;
  const activeOwnerRentals = requests.filter((rental) => rental.status === "active");
  const ownerRequestHistory = requests.filter((rental) => rental.status !== "active");

  useEffect(() => {
    document.title = "Profile | AI Rent";
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      redirectToLogin();
      return;
    }

    if (!loading && user?.role === "admin") {
      window.location.href = getDefaultAuthenticatedPath(user);
    }
  }, [loading, user]);

  useEffect(() => {
    setProfileUser(user);
    if (!profileDirtyRef.current) {
      setProfileForm(createProfileForm(user));
    }
  }, [user]);

  useEffect(() => {
    function handlePopState() {
      setActiveTab(getInitialProfileTab());
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  function applyNotificationsPayload(payload) {
    const nextNotifications = payload?.notifications || [];
    const nextUnreadCount = payload?.unreadCount || 0;
    setNotifications(nextNotifications);
    setNotificationsUnreadCount(nextUnreadCount);
    publishNotificationsChanged(nextUnreadCount);
  }

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      if (loading || !userId || userRole === "admin") {
        return;
      }

      const [
        profileResult,
        bookingsResult,
        requestsResult,
        notificationsResult,
      ] = await Promise.all([
        fetchApi("/api/v1/users/me", { auth: true }),
        fetchApi("/api/v1/rentals/my-bookings?limit=5", { auth: true }),
        fetchApi("/api/v1/rentals/my-requests?limit=5", { auth: true }),
        fetchApi("/api/v1/notifications?limit=20", { auth: true }),
      ]);

      if (!active) {
        return;
      }

      if (profileResult.ok && profileResult.data?.data) {
        saveSession({ user: profileResult.data.data });
        setUser(profileResult.data.data);
        setProfileUser(profileResult.data.data);
        if (!profileDirtyRef.current) {
          setProfileForm(createProfileForm(profileResult.data.data));
        }
      }

      setBookings(bookingsResult.data?.data?.rentals || []);
      setRequests(requestsResult.data?.data?.rentals || []);
      applyNotificationsPayload(notificationsResult.data?.data);
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [loading, setUser, userId, userRole]);

  const avatarSrc = useMemo(() => {
    if (avatarFile) {
      return URL.createObjectURL(avatarFile);
    }

    return profileUser?.avatarUrl || AVATAR_PLACEHOLDER;
  }, [avatarFile, profileUser]);

  useEffect(() => {
    return () => {
      if (avatarFile) {
        URL.revokeObjectURL(avatarSrc);
      }
    };
  }, [avatarFile, avatarSrc]);

  async function reloadLists() {
    const [bookingsResult, requestsResult, notificationsResult] = await Promise.all([
      fetchApi("/api/v1/rentals/my-bookings?limit=5", { auth: true }),
      fetchApi("/api/v1/rentals/my-requests?limit=5", { auth: true }),
      fetchApi("/api/v1/notifications?limit=20", { auth: true }),
    ]);

    setBookings(bookingsResult.data?.data?.rentals || []);
    setRequests(requestsResult.data?.data?.rentals || []);
    applyNotificationsPayload(notificationsResult.data?.data);
  }

  async function reloadNotifications() {
    const notificationsResult = await fetchApi("/api/v1/notifications?limit=20", {
      auth: true,
    });

    if (!notificationsResult.ok || !notificationsResult.data?.success) {
      return false;
    }

    applyNotificationsPayload(notificationsResult.data?.data);
    return true;
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
              window.prompt("Optional reason for this action:")?.trim() ||
              undefined,
          }
        : undefined;

    const result = await fetchApi(requestConfig.path, {
      method: requestConfig.method,
      auth: true,
      body,
    });

    const responseRental = result.data?.data;
    const successMessage =
      action === "start" && responseRental?.endDate
        ? `Rental started. Scheduled finish: ${new Date(responseRental.endDate).toLocaleString()}`
        : action === "complete" &&
            (responseRental?.actualReturnDate || responseRental?.endDate)
          ? `Rental completed. Finished at: ${new Date(
              responseRental.actualReturnDate || responseRental.endDate,
            ).toLocaleString()}`
          : null;

    showMessage(
      successMessage ||
        result.data?.message ||
        (result.ok ? "Action completed successfully." : "Action failed."),
      result.ok ? "success" : "error",
    );

    if (result.ok) {
      if (responseRental) {
        setBookings((previous) => replaceRentalInList(previous, responseRental));
        setRequests((previous) => replaceRentalInList(previous, responseRental));
      }
      await reloadLists();
    }
  }

  async function handleMarkRead(notificationId) {
    const result = await fetchApi(`/api/v1/notifications/${notificationId}/read`, {
      method: "PUT",
      auth: true,
    });

    showMessage(
      result.data?.message || "Notification updated.",
      result.ok ? "success" : "error",
    );

    if (result.ok) {
      await reloadNotifications();
    }
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
      await reloadNotifications();
    }
  }

  async function handleDeleteNotification(notificationId) {
    const shouldDelete = window.confirm(
      "Delete this notification? This action cannot be undone.",
    );
    if (!shouldDelete) {
      return;
    }

    const result = await fetchApi(`/api/v1/notifications/${notificationId}`, {
      method: "DELETE",
      auth: true,
    });

    showMessage(
      result.data?.message || "Notification updated.",
      result.ok ? "success" : "error",
    );

    if (result.ok) {
      await reloadNotifications();
    }
  }

  function handleTabChange(nextTab) {
    setActiveTab(nextTab);
    syncProfileTabInUrl(nextTab);
  }

  function updateProfileField(field, value) {
    profileDirtyRef.current = true;
    setProfileForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();

    const trimmedName = profileForm.name.trim();
    if (trimmedName.length < 3) {
      showMessage("Name must be at least 3 characters long.", "error");
      return;
    }

    const payload = {
      name: trimmedName,
      phone: profileForm.phone.trim() || null,
      city: profileForm.city.trim() || null,
      address: profileForm.address.trim() || null,
      bio: profileForm.bio.trim() || null,
    };

    const result = await fetchApi("/api/v1/users/me", {
      method: "PUT",
      auth: true,
      body: payload,
    });

    showMessage(
      result.data?.message || "Profile updated.",
      result.ok ? "success" : "error",
    );

    if (result.ok && result.data?.data) {
      saveSession({ user: result.data.data });
      profileDirtyRef.current = false;
      setUser(result.data.data);
      setProfileUser(result.data.data);
      setProfileForm(createProfileForm(result.data.data));
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();

    const result = await fetchApi("/api/v1/users/change-password", {
      method: "PUT",
      auth: true,
      body: passwordForm,
    });

    showMessage(
      result.data?.message || "Password updated.",
      result.ok ? "success" : "error",
    );

    if (result.ok) {
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
    }
  }

  async function handleAvatarSubmit(event) {
    event.preventDefault();

    if (!avatarFile) {
      showMessage("Choose an image first.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", avatarFile);

    const result = await fetchApi("/api/v1/users/upload-avatar", {
      method: "POST",
      auth: true,
      body: formData,
    });

    showMessage(
      result.data?.message || "Avatar updated.",
      result.ok ? "success" : "error",
    );

    if (result.ok && result.data?.data) {
      const nextUser = {
        ...(profileUser || user || {}),
        avatarUrl:
          result.data.data.avatarUrl ||
          profileUser?.avatarUrl ||
          user?.avatarUrl ||
          null,
      };

      saveSession({ user: nextUser });
      setUser(nextUser);
      setProfileUser(nextUser);
      setAvatarFile(null);
    }
  }

  async function handleSendVerificationEmail() {
    setSendingVerification(true);
    setVerificationPreview(null);

    const result = await fetchApi("/api/v1/auth/request-email-verification", {
      method: "POST",
      auth: true,
    });

    setSendingVerification(false);

    showMessage(
      result.data?.message || "Verification request updated.",
      result.ok ? "success" : "error",
    );

    if (!result.ok || !result.data?.success) {
      return;
    }

    if (result.data.verificationLink || result.data.verificationToken) {
      setVerificationPreview({
        verificationLink: result.data.verificationLink || "",
        verificationToken: result.data.verificationToken || "",
      });
    }

    if (profileUser?.isVerified === false) {
      try {
        await refreshUser(true);
      } catch (error) {
        console.error("refreshUser after requestEmailVerification error:", error);
      }
    }
  }

  return (
    <SiteLayout
      page={page}
      user={user}
      onLogout={logout}
      activeNav={activeTab === "notifications" ? "notifications" : "profile"}
      notificationBadgeCount={notificationsUnreadCount}
    >
      <MessageText message={message} id="profileMessage" />

      <section className="profile-grid">
        <aside className="surface-panel profile-card">
          <img
            className="profile-card__avatar"
            src={avatarSrc}
            alt="Profile avatar"
          />
          <h1>{profileUser?.name || "Your profile"}</h1>
          <p>Role: {profileUser?.role || "user"}</p>
          <div className="profile-card__meta">
            <span>{profileUser?.email || "No email added"}</span>
            <span>{profileUser?.city || "City not added"}</span>
            <span>
              {profileUser?.isVerified ? "Verified account" : "Verification pending"}
            </span>
          </div>

          <form className="stack-form" onSubmit={handleAvatarSubmit}>
            <div className="field">
              <label htmlFor="avatarInput">Update avatar</label>
              <input
                id="avatarInput"
                name="avatar"
                type="file"
                className="input"
                accept="image/*"
                onChange={(event) =>
                  setAvatarFile(event.target.files?.[0] || null)
                }
              />
            </div>
            <button type="submit" className="btn btn--secondary btn--full">
              Upload Avatar
            </button>
          </form>
        </aside>

        <section className="profile-content">
          <div className="profile-tabs" role="tablist" aria-label="Profile sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "account"}
              className={`profile-tab${activeTab === "account" ? " is-active" : ""}`}
              onClick={() => handleTabChange("account")}
            >
              <span>Profile</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "notifications"}
              className={`profile-tab${activeTab === "notifications" ? " is-active" : ""}`}
              onClick={() => handleTabChange("notifications")}
            >
              <span>Notifications</span>
              {notificationsUnreadCount ? (
                <span className="profile-tab__badge">
                  {notificationsUnreadCount > 99 ? "99+" : notificationsUnreadCount}
                </span>
              ) : null}
            </button>
          </div>

          {activeTab === "account" ? (
            <>
              <article className="surface-panel">
                <SectionHeading
                  eyebrow="Account details"
                  title="Edit profile"
                  compact
                />

                <form className="form-grid" onSubmit={handleProfileSubmit}>
                  <div className="field">
                    <label htmlFor="profileNameInput">Name</label>
                    <input
                      id="profileNameInput"
                      name="name"
                      type="text"
                      className="input"
                      value={profileForm.name}
                      onChange={(event) => updateProfileField("name", event.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="profilePhoneInput">Phone</label>
                    <input
                      id="profilePhoneInput"
                      name="phone"
                      type="text"
                      className="input"
                      value={profileForm.phone}
                      onChange={(event) => updateProfileField("phone", event.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="profileCityInput">City</label>
                    <input
                      id="profileCityInput"
                      name="city"
                      type="text"
                      className="input"
                      value={profileForm.city}
                      onChange={(event) => updateProfileField("city", event.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="profileAddressInput">Address</label>
                    <input
                      id="profileAddressInput"
                      name="address"
                      type="text"
                      className="input"
                      value={profileForm.address}
                      onChange={(event) => updateProfileField("address", event.target.value)}
                    />
                  </div>

                  <div className="field field--full">
                    <label htmlFor="profileBioInput">Bio</label>
                    <textarea
                      id="profileBioInput"
                      name="bio"
                      className="textarea"
                      rows="4"
                      value={profileForm.bio}
                      onChange={(event) => updateProfileField("bio", event.target.value)}
                    />
                  </div>

                  <div className="field field--full">
                    <button type="submit" className="btn btn--primary">
                      Save Profile
                    </button>
                  </div>
                </form>
              </article>

              <article className="surface-panel">
                <SectionHeading
                  eyebrow="Security"
                  title="Change password"
                  compact
                />

                <form className="form-grid" onSubmit={handlePasswordSubmit}>
                  <div className="field">
                    <label htmlFor="currentPassword">Current password</label>
                    <input
                      id="currentPassword"
                      name="currentPassword"
                      type="password"
                      className="input"
                      value={passwordForm.currentPassword}
                      onChange={(event) =>
                        setPasswordForm((previous) => ({
                          ...previous,
                          currentPassword: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="newProfilePassword">New password</label>
                    <input
                      id="newProfilePassword"
                      name="newPassword"
                      type="password"
                      className="input"
                      value={passwordForm.newPassword}
                      onChange={(event) =>
                        setPasswordForm((previous) => ({
                          ...previous,
                          newPassword: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field field--full">
                    <label htmlFor="confirmProfilePassword">Confirm new password</label>
                    <input
                      id="confirmProfilePassword"
                      name="confirmNewPassword"
                      type="password"
                      className="input"
                      value={passwordForm.confirmNewPassword}
                      onChange={(event) =>
                        setPasswordForm((previous) => ({
                          ...previous,
                          confirmNewPassword: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field field--full">
                    <button type="submit" className="btn btn--secondary">
                      Update Password
                    </button>
                  </div>
                </form>
              </article>

              <article className="surface-panel">
                <SectionHeading
                  eyebrow="Email verification"
                  title="Verify your email"
                  compact
                />

                {profileUser?.isVerified ? (
                  <p className="compact-text">
                    Your email is already verified.
                  </p>
                ) : (
                  <div className="profile-verification">
                    <p className="compact-text">
                      Your account is not verified yet. Send yourself a verification
                      email and open the link to finish this step.
                    </p>

                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={handleSendVerificationEmail}
                      disabled={sendingVerification}
                    >
                      {sendingVerification
                        ? "Sending verification..."
                        : "Send verification email"}
                    </button>

                    {verificationPreview ? (
                      <div className="token-box">
                        <h3>Development link</h3>
                        <p>
                          Local development mode is active, so you can verify
                          directly from this generated link.
                        </p>
                        {verificationPreview.verificationToken ? (
                          <code>{verificationPreview.verificationToken}</code>
                        ) : null}
                        {verificationPreview.verificationLink ? (
                          <a
                            className="btn btn--secondary btn--small"
                            href={verificationPreview.verificationLink}
                          >
                            Open Verify Page
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </article>

              <section className="profile-panels">
                <article className="surface-panel">
                  <SectionHeading
                    eyebrow="Renter side"
                    title="My bookings"
                    compact
                  />
                  <div className="list-stack">
                    {bookings.length ? (
                      bookings.map((rental) => (
                        <RentalListItem
                          key={rental.id}
                          rental={rental}
                          listType="bookings"
                          showOwner
                          onAction={handleRentalAction}
                        />
                      ))
                    ) : (
                      <EmptyState message="You have no bookings yet." />
                    )}
                  </div>
                </article>

                <article className="surface-panel">
                  <SectionHeading
                    eyebrow="Owner side"
                    title="Active rentals"
                    compact
                  />
                  <div className="list-stack">
                    {activeOwnerRentals.length ? (
                      activeOwnerRentals.map((rental) => (
                        <RentalListItem
                          key={rental.id}
                          rental={rental}
                          listType="requests"
                          onAction={handleRentalAction}
                        />
                      ))
                    ) : (
                      <EmptyState message="No owner rentals are active right now." />
                    )}
                  </div>
                </article>

                <article className="surface-panel">
                  <SectionHeading
                    eyebrow="Owner side"
                    title="Incoming requests"
                    compact
                  />
                  <div className="list-stack">
                    {ownerRequestHistory.length ? (
                      ownerRequestHistory.map((rental) => (
                        <RentalListItem
                          key={rental.id}
                          rental={rental}
                          listType="requests"
                          onAction={handleRentalAction}
                        />
                      ))
                    ) : (
                      <EmptyState message="You have no pending owner requests right now." />
                    )}
                  </div>
                </article>
              </section>
            </>
          ) : (
            <article className="surface-panel">
              <SectionHeading
                eyebrow="Updates"
                title="Notifications"
                compact
              >
                <div className="profile-notifications__actions">
                  <span className="tag">
                    {notificationsUnreadCount
                      ? `${notificationsUnreadCount} unread`
                      : "All caught up"}
                  </span>
                  <button
                    type="button"
                    className="btn btn--secondary btn--small"
                    onClick={handleMarkAllRead}
                    disabled={!notificationsUnreadCount}
                  >
                    Mark all read
                  </button>
                </div>
              </SectionHeading>
              <div className="list-stack">
                {notifications.length ? (
                  notifications.map((notification) => (
                    <NotificationListItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={handleMarkRead}
                      onDelete={handleDeleteNotification}
                    />
                  ))
                ) : (
                  <EmptyState message="No notifications available." />
                )}
              </div>
            </article>
          )}
        </section>
      </section>
    </SiteLayout>
  );
}
