import React, { useEffect, useState } from "react";
import { fetchApi, getDefaultAuthenticatedPath } from "../lib/airent";

function toBadgeCount(value) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0;
}

function normalizeNotificationBadgeCounts(value = {}) {
  return {
    notifications: toBadgeCount(value.notifications ?? value.unreadCount),
    bookings: toBadgeCount(value.bookings ?? value.bookingUnreadCount),
    rentals: toBadgeCount(value.rentals ?? value.rentalUnreadCount),
  };
}

function formatBadgeCount(value) {
  return value > 99 ? "99+" : value;
}

function NavBadgeLink({ href, label, count, isActive = false }) {
  return (
    <a
      href={href}
      className={`site-nav__link--with-badge${isActive ? " is-active" : ""}`}
    >
      <span>{label}</span>
      {count ? <span className="site-nav__badge">{formatBadgeCount(count)}</span> : null}
    </a>
  );
}

function SiteFooter({ user }) {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__layout">
          <section className="site-footer__intro" aria-label="AI Rent overview">
            <a className="brand site-footer__brand" href="/">
              AI <span className="site-footer__brand-accent">Rent</span>
            </a>
            <p className="site-footer__note">
              One marketplace for browsing rentals, publishing listings, and
              managing requests through the same simple front-end.
            </p>
            <div className="site-footer__actions">
              {user?.role !== "admin" ? (
                <a className="btn btn--primary btn--small" href="/html/products.html">
                  Browse Listings
                </a>
              ) : null}
              {!user ? (
                <a className="btn btn--secondary btn--small" href="/html/register.html">
                  Get Started
                </a>
              ) : null}
              {user && user.role !== "admin" ? (
                <a className="btn btn--secondary btn--small" href="/html/wishlist.html">
                  Wishlist
                </a>
              ) : null}
              {user && user.role !== "admin" ? (
                <a className="btn btn--secondary btn--small" href="/html/my-listings.html">
                  My Listings
                </a>
              ) : null}
              {user?.role === "admin" ? (
                <a
                  className="btn btn--secondary btn--small"
                  href={getDefaultAuthenticatedPath(user)}
                >
                  Open Dashboard
                </a>
              ) : null}
            </div>
          </section>

          <nav className="site-footer__section" aria-label="Marketplace links">
            <p className="site-footer__heading">Marketplace</p>
            <ul className="site-footer__links">
              {user?.role !== "admin" ? (
                <>
                  <li><a href="/">Home</a></li>
                  <li><a href="/html/products.html">Browse listings</a></li>
                </>
              ) : null}
              {user && user.role !== "admin" ? (
                <li><a href="/html/wishlist.html">Wishlist</a></li>
              ) : null}
              {user && user.role !== "admin" ? (
                <li><a href="/html/my-listings.html">Manage listings</a></li>
              ) : null}
              {user && user.role !== "admin" ? (
                <li><a href="/html/bookings.html">Bookings</a></li>
              ) : null}
              {user && user.role !== "admin" ? (
                <li><a href="/html/rentals.html">Rentals</a></li>
              ) : null}
              {user?.role === "admin" ? (
                <li><a href={getDefaultAuthenticatedPath(user)}>Admin dashboard</a></li>
              ) : null}
            </ul>
          </nav>

          <nav className="site-footer__section" aria-label="Account links">
            <p className="site-footer__heading">Account</p>
            <ul className="site-footer__links">
              {!user ? (
                <>
                  <li><a href="/html/login.html">Login</a></li>
                  <li><a href="/html/register.html">Register</a></li>
                  <li><a href="/html/forgot-password.html">Forgot password</a></li>
                </>
              ) : null}
              {user && user.role !== "admin" ? (
                <li><a href="/html/wishlist.html">Wishlist</a></li>
              ) : null}
              {user && user.role !== "admin" ? (
                <li><a href="/html/bookings.html">Bookings</a></li>
              ) : null}
              {user && user.role !== "admin" ? (
                <li><a href="/html/rentals.html">Rentals</a></li>
              ) : null}
              {user && user.role !== "admin" ? (
                <li><a href="/html/profile.html">Profile</a></li>
              ) : null}
            </ul>
          </nav>

          <section className="site-footer__section">
            <p className="site-footer__heading">Why AI Rent</p>
            <ul className="site-footer__links">
              <li><span>Simple browsing and filtering.</span></li>
              <li><span>Owner and renter workflows in one place.</span></li>
              <li><span>Role-aware navigation across the shared shell.</span></li>
            </ul>
          </section>
        </div>

        <div className="site-footer__bottom">
          <p>&copy; {new Date().getFullYear()} AI Rent. Built for smarter sharing.</p>
          <p>Browse, list, and manage rentals from one streamlined workspace.</p>
        </div>
      </div>
    </footer>
  );
}

export function SiteLayout({
  page,
  user,
  onLogout,
  children,
  activeNav,
  notificationBadgeCount,
  notificationBadgeCounts,
}) {
  const isAdmin = user?.role === "admin";
  const mainClassName =
    page === "home" ? "page-shell page-shell--landing" : "page-shell";
  const brandHref = page === "admin" ? getDefaultAuthenticatedPath(user) : "/";
  const [layoutBadgeCounts, setLayoutBadgeCounts] = useState(
    normalizeNotificationBadgeCounts({
      notifications: notificationBadgeCount,
      ...(notificationBadgeCounts || {}),
    }),
  );

  useEffect(() => {
    if (
      notificationBadgeCount === undefined &&
      notificationBadgeCounts === undefined
    ) {
      return;
    }

    setLayoutBadgeCounts((previous) =>
      normalizeNotificationBadgeCounts({
        notifications:
          notificationBadgeCounts?.notifications ??
          notificationBadgeCounts?.unreadCount ??
          notificationBadgeCount ??
          previous.notifications,
        bookings:
          notificationBadgeCounts?.bookings ??
          notificationBadgeCounts?.bookingUnreadCount ??
          previous.bookings,
        rentals:
          notificationBadgeCounts?.rentals ??
          notificationBadgeCounts?.rentalUnreadCount ??
          previous.rentals,
      }),
    );
  }, [notificationBadgeCount, notificationBadgeCounts]);

  useEffect(() => {
    if (!user || isAdmin || notificationBadgeCounts !== undefined) {
      return undefined;
    }

    let active = true;

    async function refreshUnreadCounts() {
      const result = await fetchApi("/api/v1/notifications/unread-count", {
        auth: true,
      });

      if (!active || !result.ok || !result.data?.success) {
        return;
      }

      setLayoutBadgeCounts(normalizeNotificationBadgeCounts(result.data?.data));
    }

    function handleNotificationsChanged(event) {
      if (typeof event?.detail?.unreadCount === "number") {
        setLayoutBadgeCounts((previous) => ({
          ...previous,
          notifications: toBadgeCount(event.detail.unreadCount),
        }));
      }

      refreshUnreadCounts();
    }

    refreshUnreadCounts();
    window.addEventListener("focus", refreshUnreadCounts);
    window.addEventListener("notifications:changed", handleNotificationsChanged);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshUnreadCounts);
      window.removeEventListener(
        "notifications:changed",
        handleNotificationsChanged,
      );
    };
  }, [isAdmin, notificationBadgeCounts, user]);

  return (
    <>
      <header className="site-header">
        <a className="brand" href={brandHref}>
          AI <span className="rent">Rent</span>
        </a>
        <nav className="site-nav">
          {page === "admin" ? (
            <>
              <a href={getDefaultAuthenticatedPath(user)} className="is-active">
                Admin Dashboard
              </a>
              {user ? (
                <button type="button" className="btn btn--ghost" onClick={onLogout}>
                  Logout
                </button>
              ) : null}
            </>
          ) : (
            <>
              {!isAdmin ? (
                <>
                  <a href="/" className={page === "home" ? "is-active" : ""}>
                    Home
                  </a>
                  <a
                    href="/html/products.html"
                    className={page === "products" || page === "product-details" ? "is-active" : ""}
                  >
                    Browse
                  </a>
                </>
              ) : null}
              {isAdmin ? (
                <a href={getDefaultAuthenticatedPath(user)}>Admin Dashboard</a>
              ) : null}
              {user && !isAdmin ? (
                <a
                  href="/html/wishlist.html"
                  className={page === "wishlist" || activeNav === "wishlist" ? "is-active" : ""}
                >
                  Wishlist
                </a>
              ) : null}
              {user && !isAdmin ? (
                <a
                  href="/html/my-listings.html"
                  className={page === "my-listings" ? "is-active" : ""}
                >
                  My Listings
                </a>
              ) : null}
              {user && !isAdmin ? (
                <NavBadgeLink
                  href="/html/bookings.html"
                  label="Bookings"
                  count={layoutBadgeCounts.bookings}
                  isActive={page === "bookings" || activeNav === "bookings"}
                />
              ) : null}
              {user && !isAdmin ? (
                <NavBadgeLink
                  href="/html/rentals.html"
                  label="Rentals"
                  count={layoutBadgeCounts.rentals}
                  isActive={page === "rentals" || activeNav === "rentals"}
                />
              ) : null}
              {user && !isAdmin ? (
                <NavBadgeLink
                  href="/html/profile.html?tab=notifications"
                  label="Notifications"
                  count={layoutBadgeCounts.notifications}
                  isActive={activeNav === "notifications"}
                />
              ) : null}
              {user && !isAdmin ? (
                <a
                  href="/html/profile.html"
                  className={activeNav === "profile" ? "is-active" : ""}
                >
                  Profile
                </a>
              ) : null}
              {!user ? <a href="/html/login.html">Login</a> : null}
              {!user ? <a href="/html/register.html">Register</a> : null}
              {user ? (
                <button type="button" className="btn btn--ghost" onClick={onLogout}>
                  Logout
                </button>
              ) : null}
            </>
          )}
        </nav>
      </header>
      <main className={mainClassName}>{children}</main>
      <SiteFooter user={user} />
    </>
  );
}
