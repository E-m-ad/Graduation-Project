import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AVATAR_PLACEHOLDER,
  fetchApi,
  getDefaultAuthenticatedPath,
  redirectToLogin,
  saveSession,
} from "../lib/airent";
import { useActionDialog, useMessageState, useSession } from "../lib/hooks";
import {
  ActionDialog,
  EmptyState,
  MessageText,
  ProductCard,
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
const CURSOR_CONFIG = {
  profile: {
    enabled: false,
    color: "#000000",
    targetSelector: "body",
    activeSelectors: [],
    deactiveSelectors: [],
  },
};
const CHECK_MARK = "\u2713";
const PROFILE_TAB_VALUES = ["account", "notifications"];

function getInitialProfileTab() {
  const tab =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("tab");

  return PROFILE_TAB_VALUES.includes(tab) ? tab : "account";
}

function getPublicProfileId() {
  const id =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("id") || "";

  return id.trim();
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

  window.history.replaceState(
    {},
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
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

  if (
    typeof notification?.data?.renterNotes === "string" &&
    notification.data.renterNotes.trim()
  ) {
    contextLines.push(`Renter note: ${notification.data.renterNotes.trim()}`);
  }

  if (
    typeof notification?.data?.reply === "string" &&
    notification.data.reply.trim()
  ) {
    contextLines.push(`Reply: ${notification.data.reply.trim()}`);
  }

  if (
    typeof notification?.data?.reason === "string" &&
    notification.data.reason.trim()
  ) {
    contextLines.push(`Note: ${notification.data.reason.trim()}`);
  }

  const scheduledFinish =
    notification?.data?.endDate || notification?.rental?.endDate;
  if (notification?.type === "rental_started" && scheduledFinish) {
    contextLines.push(
      `Scheduled finish: ${new Date(scheduledFinish).toLocaleString()}`,
    );
  }

  const actualFinish =
    notification?.data?.actualReturnDate ||
    notification?.rental?.actualReturnDate;
  if (notification?.type === "rental_completed" && actualFinish) {
    contextLines.push(
      `Finished at: ${new Date(actualFinish).toLocaleString()}`,
    );
  }

  return contextLines;
}

function getNotificationProductId(notification) {
  const rawProductId =
    notification?.data?.productId ||
    notification?.rental?.productId ||
    notification?.rental?.product?.id ||
    null;

  return typeof rawProductId === "string" && rawProductId.trim()
    ? rawProductId
    : null;
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

export function ProfilePage({ page }) {
  const { user, loading, setUser, refreshUser, logout } = useSession();
  const { dialog, setDialog, closeDialog, confirmDialog } = useActionDialog();
  const [message, showMessage] = useMessageState("");
  const [activeTab, setActiveTab] = useState(getInitialProfileTab);
  const [profileUser, setProfileUser] = useState(user);
  const [profileForm, setProfileForm] = useState(createProfileForm(user));
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const profileDirtyRef = useRef(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0);
  const [verificationPreview, setVerificationPreview] = useState(null);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [publicProfileUser, setPublicProfileUser] = useState(null);
  const [publicProducts, setPublicProducts] = useState([]);
  const [loadingPublicProfile, setLoadingPublicProfile] = useState(false);
  const userId = user?.id;
  const userRole = user?.role;
  const publicProfileId = getPublicProfileId();
  const isOwnPublicProfile = Boolean(
    publicProfileId && userId && publicProfileId === userId,
  );
  const isViewingPublicProfile =
    Boolean(publicProfileId) && !isOwnPublicProfile;

  useEffect(() => {
    if (isViewingPublicProfile && publicProfileUser?.name) {
      document.title = `${publicProfileUser.name} | AI Rent`;
      return;
    }

    document.title = "Profile | AI Rent";
  }, [isViewingPublicProfile, publicProfileUser?.name]);

  useEffect(() => {
    if (!loading && !user && !isViewingPublicProfile) {
      redirectToLogin();
      return;
    }

    if (!loading && user?.role === "admin" && !isViewingPublicProfile) {
      window.location.href = getDefaultAuthenticatedPath(user);
    }
  }, [isViewingPublicProfile, loading, user]);

  useEffect(() => {
    if (isViewingPublicProfile) {
      return;
    }

    setProfileUser(user);
    if (!profileDirtyRef.current) {
      setProfileForm(createProfileForm(user));
    }
  }, [isViewingPublicProfile, user]);

  useEffect(() => {
    function handlePopState() {
      setActiveTab(getInitialProfileTab());
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "account") {
      setIsEditProfileOpen(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!avatarPreview) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setAvatarPreview(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [avatarPreview]);

  function applyNotificationsPayload(payload) {
    const nextNotifications = payload?.notifications || [];
    const nextUnreadCount = payload?.unreadCount || 0;
    setNotifications(nextNotifications);
    setNotificationsUnreadCount(nextUnreadCount);
    publishNotificationsChanged(nextUnreadCount);
  }

  useEffect(() => {
    if (!isViewingPublicProfile || !publicProfileId) {
      setPublicProfileUser(null);
      setPublicProducts([]);
      setLoadingPublicProfile(false);
      return;
    }

    let active = true;
    setLoadingPublicProfile(true);
    showMessage("");

    async function loadPublicProfile() {
      const encodedProfileId = encodeURIComponent(publicProfileId);
      const [profileResult, productsResult] = await Promise.all([
        fetchApi(`/api/v1/public/users/${encodedProfileId}`),
        fetchApi(`/api/v1/public/users/${encodedProfileId}/products`),
      ]);

      if (!active) {
        return;
      }

      const nextProfile =
        profileResult.data?.user ||
        profileResult.data?.data?.user ||
        productsResult.data?.data?.user ||
        null;

      if (!profileResult.ok || !profileResult.data?.success || !nextProfile) {
        setPublicProfileUser(null);
        setPublicProducts([]);
        setLoadingPublicProfile(false);
        showMessage(
          profileResult.data?.message || "Unable to load this owner profile.",
          "error",
        );
        return;
      }

      setPublicProfileUser(nextProfile);

      if (productsResult.ok && productsResult.data?.success) {
        setPublicProducts(productsResult.data?.data?.products || []);
      } else {
        setPublicProducts([]);
        showMessage(
          productsResult.data?.message ||
            "Profile loaded, but the owner's public listings are unavailable right now.",
          "error",
        );
      }

      setLoadingPublicProfile(false);
    }

    loadPublicProfile();

    return () => {
      active = false;
    };
  }, [isViewingPublicProfile, publicProfileId, showMessage]);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      if (
        isViewingPublicProfile ||
        loading ||
        !userId ||
        userRole === "admin"
      ) {
        return;
      }

      const [profileResult, notificationsResult] = await Promise.all([
        fetchApi("/api/v1/users/me", { auth: true }),
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

      applyNotificationsPayload(notificationsResult.data?.data);
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [isViewingPublicProfile, loading, setUser, userId, userRole]);

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

  async function reloadNotifications() {
    const notificationsResult = await fetchApi(
      "/api/v1/notifications?limit=20",
      {
        auth: true,
      },
    );

    if (!notificationsResult.ok || !notificationsResult.data?.success) {
      return false;
    }

    applyNotificationsPayload(notificationsResult.data?.data);
    return true;
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
    const shouldDelete = await confirmDialog({
      title: "Delete this notification?",
      message: "This notification will be removed from your inbox permanently.",
      confirmLabel: "Delete notification",
      cancelLabel: "Keep notification",
      tone: "danger",
    });
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

  function closeEditProfileForm() {
    profileDirtyRef.current = false;
    setProfileForm(createProfileForm(profileUser || user));
    setIsEditProfileOpen(false);
  }

  function openEditProfileForm() {
    profileDirtyRef.current = false;
    setProfileForm(createProfileForm(profileUser || user));
    setIsEditProfileOpen(true);
  }

  function openAvatarPreview(src, alt) {
    if (!src) {
      return;
    }

    setAvatarPreview({
      src,
      alt,
    });
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
      setIsEditProfileOpen(false);
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
        console.error(
          "refreshUser after requestEmailVerification error:",
          error,
        );
      }
    }
  }

  const publicProfileAvatar =
    publicProfileUser?.avatarUrl || AVATAR_PLACEHOLDER;
  const publicProfileName = publicProfileUser?.name || "Owner profile";
  const publicListingCount = publicProducts.length;
  const showProfileSidebar = activeTab === "account";
  const avatarViewer = avatarPreview ? (
    <div
      className="image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Large profile image"
      onClick={() => setAvatarPreview(null)}
    >
      <div
        className="image-viewer__content"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="image-viewer__close"
          onClick={() => setAvatarPreview(null)}
        >
          Close
        </button>
        <img
          className="image-viewer__image"
          src={avatarPreview.src}
          alt={avatarPreview.alt}
        />
      </div>
    </div>
  ) : null;

  if (isViewingPublicProfile) {
    return (
      <SiteLayout
        page={page}
        user={user}
        onLogout={logout}
        cursorConfig={CURSOR_CONFIG[page]}
      >
        <MessageText message={message} id="profileMessage" />

        <section className="profile-grid">
          <aside className="surface-panel profile-card">
            <button
              type="button"
              className="profile-card__avatar-button"
              onClick={() =>
                openAvatarPreview(
                  publicProfileAvatar,
                  `${publicProfileName} avatar`,
                )
              }
              aria-label="Open larger avatar view"
            >
              <img
                className="profile-card__avatar"
                src={publicProfileAvatar}
                alt={`${publicProfileName} avatar`}
              />
            </button>
            <p className="profile-card__hint">
              Click the image to preview it larger.
            </p>
            <div className="profile-card__headline">
              <h1>{publicProfileName}</h1>
              {publicProfileUser?.isVerified ? (
                <span className="profile-status-badge profile-status-badge--verified">
                  <span
                    className="profile-status-badge__icon"
                    aria-hidden="true"
                  >
                    {CHECK_MARK}
                  </span>
                  <span>Verified owner</span>
                </span>
              ) : null}
            </div>
            <p>Public owner profile</p>
            <div className="profile-card__meta">
              <span className="profile-card__meta-item">
                {publicProfileUser?.city || "City not added"}
              </span>
              <span className="profile-card__meta-item">
                {publicProfileUser?.isVerified
                  ? "Verified account"
                  : "Verification pending"}
              </span>
              <span className="profile-card__meta-item">
                {loadingPublicProfile
                  ? "Loading listings..."
                  : `${publicListingCount} public listing${
                      publicListingCount === 1 ? "" : "s"
                    }`}
              </span>
            </div>
            <p className="profile-card__bio">
              {publicProfileUser?.bio || "This owner has not added a bio yet."}
            </p>
          </aside>

          <section className="profile-content">
            <article className="surface-panel">
              <SectionHeading
                eyebrow="Owner overview"
                title="Profile details"
                compact
              />
              {loadingPublicProfile ? (
                <EmptyState message="Loading owner profile..." />
              ) : publicProfileUser ? (
                <div className="profile-public-summary">
                  <div className="profile-public-summary__item">
                    <strong>Name</strong>
                    <span>{publicProfileUser.name || "Unknown owner"}</span>
                  </div>
                  <div className="profile-public-summary__item">
                    <strong>City</strong>
                    <span>{publicProfileUser.city || "City not added"}</span>
                  </div>
                  <div className="profile-public-summary__item">
                    <strong>Verification</strong>
                    <span>
                      {publicProfileUser.isVerified
                        ? "Verified account"
                        : "Verification pending"}
                    </span>
                  </div>
                </div>
              ) : (
                <EmptyState message="Owner profile unavailable." />
              )}
            </article>

            <article className="surface-panel">
              <SectionHeading
                eyebrow="Owner listings"
                title="Related products"
                note={
                  publicProfileUser
                    ? `Browse ${publicProfileName}'s public listings.`
                    : "Browse this owner's public listings."
                }
                compact
              />
              {loadingPublicProfile ? (
                <EmptyState message="Loading owner listings..." />
              ) : publicProducts.length ? (
                <div className="card-grid">
                  {publicProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <EmptyState message="This owner has no public listings yet." />
              )}
            </article>
          </section>
        </section>
        {avatarViewer}
      </SiteLayout>
    );
  }

  return (
    <SiteLayout
      page={page}
      user={user}
      onLogout={logout}
      cursorConfig={CURSOR_CONFIG[page]}
      activeNav={activeTab === "notifications" ? "notifications" : "profile"}
      notificationBadgeCount={notificationsUnreadCount}
    >
      <MessageText message={message} id="profileMessage" />

      <section
        className={`profile-grid${showProfileSidebar ? "" : " profile-grid--single"}`}
      >
        {showProfileSidebar ? (
          <aside className="surface-panel profile-card">
            <button
              type="button"
              className="profile-card__avatar-button"
              onClick={() => openAvatarPreview(avatarSrc, "Profile avatar")}
              aria-label="Open larger avatar view"
            >
              <img
                className="profile-card__avatar"
                src={avatarSrc}
                alt="Profile avatar"
              />
            </button>
            <p className="profile-card__hint">
              Click the image to preview it larger.
            </p>
            <div className="profile-card__headline">
              <h1>{profileUser?.name || "Your profile"}</h1>
              <span
                className={`profile-status-badge ${
                  profileUser?.isVerified
                    ? "profile-status-badge--verified"
                    : "profile-status-badge--pending"
                }`}
              >
                <span className="profile-status-badge__icon" aria-hidden="true">
                  {profileUser?.isVerified ? CHECK_MARK : "!"}
                </span>
                <span>
                  {profileUser?.isVerified
                    ? "Email verified"
                    : "Verification pending"}
                </span>
              </span>
            </div>

            <form className="stack-form" onSubmit={handleAvatarSubmit}>
              <div className="field">
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
        ) : null}

        <section className="profile-content">
          {activeTab === "account" ? (
            <>
              <article className="surface-panel">
                <SectionHeading
                  eyebrow="Account overview"
                  title="Profile summary"
                  compact
                >
                  <button
                    type="button"
                    className={`btn btn--small ${
                      isEditProfileOpen ? "btn--ghost" : "btn--primary"
                    }`}
                    onClick={() =>
                      isEditProfileOpen
                        ? closeEditProfileForm()
                        : openEditProfileForm()
                    }
                  >
                    {isEditProfileOpen ? "Close editor" : "Edit profile"}
                  </button>
                </SectionHeading>

                <div className="profile-summary-grid">
                  <div className="profile-summary-card">
                    <strong>Name</strong>
                    <span>{profileUser?.name || "Not added"}</span>
                  </div>
                  <div className="profile-summary-card">
                    <strong>Email</strong>
                    <span>{profileUser?.email || "Not added"}</span>
                  </div>
                  <div className="profile-summary-card">
                    <strong>Phone</strong>
                    <span>{profileUser?.phone || "Not added"}</span>
                  </div>
                  <div className="profile-summary-card">
                    <strong>City</strong>
                    <span>{profileUser?.city || "Not added"}</span>
                  </div>
                  <div className="profile-summary-card profile-summary-card--full">
                    <strong>Address</strong>
                    <span>{profileUser?.address || "Not added"}</span>
                  </div>
                  <div className="profile-summary-card profile-summary-card--full">
                    <strong>Bio</strong>
                    <span>
                      {profileUser?.bio ||
                        "Add a short bio to make your profile feel more complete."}
                    </span>
                  </div>
                </div>
              </article>

              {isEditProfileOpen ? (
                <article className="surface-panel profile-edit-panel">
                  <SectionHeading
                    eyebrow="Account details"
                    title="Edit profile"
                    compact
                  >
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={closeEditProfileForm}
                    >
                      Cancel
                    </button>
                  </SectionHeading>

                  <form className="form-grid" onSubmit={handleProfileSubmit}>
                    <div className="field">
                      <label htmlFor="profileNameInput">Name</label>
                      <input
                        id="profileNameInput"
                        name="name"
                        type="text"
                        className="input"
                        value={profileForm.name}
                        onChange={(event) =>
                          updateProfileField("name", event.target.value)
                        }
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
                        onChange={(event) =>
                          updateProfileField("phone", event.target.value)
                        }
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
                        onChange={(event) =>
                          updateProfileField("city", event.target.value)
                        }
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
                        onChange={(event) =>
                          updateProfileField("address", event.target.value)
                        }
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
                        onChange={(event) =>
                          updateProfileField("bio", event.target.value)
                        }
                      />
                    </div>

                    <div className="field field--full">
                      <div className="profile-section-actions">
                        <button type="submit" className="btn btn--primary">
                          Save Profile
                        </button>
                        <button
                          type="button"
                          className="btn btn--secondary"
                          onClick={closeEditProfileForm}
                        >
                          Discard changes
                        </button>
                      </div>
                    </div>
                  </form>
                </article>
              ) : null}

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
                    <label htmlFor="confirmProfilePassword">
                      Confirm new password
                    </label>
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

              {!profileUser?.isVerified ? (
                <article className="surface-panel">
                  <SectionHeading
                    eyebrow="Email verification"
                    title="Verify your email"
                    compact
                  />

                  <div className="profile-verification">
                    <p className="compact-text">
                      Your account is not verified yet. Send yourself a
                      verification email and open the link to finish this step.
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
                </article>
              ) : null}
            </>
          ) : (
            <article className="surface-panel">
              <SectionHeading eyebrow="Updates" title="Notifications" compact>
                <div className="profile-notifications__actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => handleTabChange("account")}
                  >
                    Back to profile
                  </button>
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
      {avatarViewer}
      <ActionDialog
        dialog={dialog}
        setDialog={setDialog}
        onClose={closeDialog}
      />
    </SiteLayout>
  );
}
