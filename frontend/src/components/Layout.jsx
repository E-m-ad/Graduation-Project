import React, { useEffect, useState } from "react";
import { fetchApi, getDefaultAuthenticatedPath } from "../lib/airent";

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
}) {
  const isAdmin = user?.role === "admin";
  const mainClassName =
    page === "home" ? "page-shell page-shell--landing" : "page-shell";
  const brandHref = page === "admin" ? getDefaultAuthenticatedPath(user) : "/";
  const [layoutUnreadCount, setLayoutUnreadCount] = useState(
    notificationBadgeCount ?? 0,
  );

  useEffect(() => {
    if (notificationBadgeCount === undefined) {
      return;
    }

    setLayoutUnreadCount(notificationBadgeCount);
  }, [notificationBadgeCount]);

  useEffect(() => {
    if (!user || isAdmin || notificationBadgeCount !== undefined) {
      return undefined;
    }

    let active = true;

    async function refreshUnreadCount() {
      const result = await fetchApi("/api/v1/notifications/unread-count", {
        auth: true,
      });

      if (!active || !result.ok || !result.data?.success) {
        return;
      }

      setLayoutUnreadCount(result.data?.data?.unreadCount || 0);
    }

    function handleNotificationsChanged(event) {
      if (typeof event?.detail?.unreadCount === "number") {
        setLayoutUnreadCount(event.detail.unreadCount);
        return;
      }

      refreshUnreadCount();
    }

    refreshUnreadCount();
    window.addEventListener("focus", refreshUnreadCount);
    window.addEventListener("notifications:changed", handleNotificationsChanged);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshUnreadCount);
      window.removeEventListener(
        "notifications:changed",
        handleNotificationsChanged,
      );
    };
  }, [isAdmin, notificationBadgeCount, user]);

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
                <a
                  href="/html/profile.html?tab=notifications"
                  className={`site-nav__link--with-badge${
                    activeNav === "notifications" ? " is-active" : ""
                  }`}
                >
                  <span>Notifications</span>
                  {layoutUnreadCount ? (
                    <span className="site-nav__badge">
                      {layoutUnreadCount > 99 ? "99+" : layoutUnreadCount}
                    </span>
                  ) : null}
                </a>
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
