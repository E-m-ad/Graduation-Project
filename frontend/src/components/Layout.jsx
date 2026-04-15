import React, { useEffect, useRef, useState } from "react";
import { fetchApi, getDefaultAuthenticatedPath } from "../lib/airent";
import { useCanvasCursor } from "../lib/hooks";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment } from "@react-three/drei";

const MOBILE_NAV_BREAKPOINT = 720;
const HEADER_CLEARANCE_PX = 24;
const HERO_HEADER_SELECTORS = {
  home: ".market-hero",
  products: ".listings-hero",
  login: ".auth-page",
  register: [".auth-page"],
  "forgot-password": [".auth-page"],
  "reset-password": [".auth-page"],
  "verify-email": [".auth-page"],
};
const NORMAL_HEADER_SECTION_SELECTORS = {
  products: [".listing-hero-inner"],
  login: [".auth-layout"],
  register: [".auth-layout"],
  "forgot-password": [".auth-layout"],
  "reset-password": [".auth-layout"],
  "verify-email": [".auth-layout"],
};

const isMobile = window.innerWidth < 768;
const orbScale = isMobile ? 0.3 : 0.5;
const radius = isMobile ? 0.3 : 0.5;

function BouncingRedOrb() {
  const groupRef = useRef();
  const meshRef = useRef();

  // movement speed
  const velocity = useRef({ x: 1.1, y: 0.7 });

  // roughly the visible radius of the orb in world units
  const orbRadius = radius;

  useFrame((state, delta) => {
    const group = groupRef.current;
    const mesh = meshRef.current;
    if (!group || !mesh) return;

    // rotate the orb itself
    mesh.rotation.y += delta * 0.4;
    mesh.rotation.x += delta * 0.15;

    // move the whole orb
    group.position.x += velocity.current.x * delta;
    group.position.y += velocity.current.y * delta;

    // viewport size in 3D world units
    const limitX = state.viewport.width / 2 - orbRadius;
    const limitY = state.viewport.height / 2 - orbRadius;

    // bounce horizontally
    if (group.position.x >= limitX) {
      group.position.x = limitX;
      velocity.current.x *= -1;
    } else if (group.position.x <= -limitX) {
      group.position.x = -limitX;
      velocity.current.x *= -1;
    }

    // bounce vertically
    if (group.position.y >= limitY) {
      group.position.y = limitY;
      velocity.current.y *= -1;
    } else if (group.position.y <= -limitY) {
      group.position.y = -limitY;
      velocity.current.y *= -1;
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.3}>
        <mesh ref={meshRef} scale={orbScale}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color="#b30016"
            emissive="#2b0303"
            roughness={0.1}
            metalness={0.15}
            flatShading
          />
        </mesh>
      </Float>
    </group>
  );
}

export function HeroOrbBackground() {
  return (
    <div className="hero-orb-wrap">
      <Canvas camera={{ position: [0, 0, 7], fov: 45 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 2, 4]} intensity={2.2} />
        <directionalLight position={[-3, -2, -4]} intensity={0.7} />
        <Environment preset="city" />
        <BouncingRedOrb />
      </Canvas>
    </div>
  );
}

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

function isPlainLeftClick(event) {
  return !(
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function NavBadgeLink({
  href,
  label,
  count,
  scope,
  isActive = false,
  className = "",
  onNavigate,
  ...props
}) {
  return (
    <a
      href={href}
      className={`site-nav__link--with-badge${isActive ? " is-active" : ""}${className ? ` ${className}` : ""}`}
      onClick={(event) => onNavigate?.(event, { href, scope, count })}
      {...props}
    >
      <span>{label}</span>
      {count ? (
        <span className="site-nav__badge">{formatBadgeCount(count)}</span>
      ) : null}
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
                <a
                  className="btn btn--primary btn--small"
                  href="/html/products.html"
                >
                  Browse Listings
                </a>
              ) : null}
              {!user ? (
                <a
                  className="btn btn--secondary btn--small"
                  href="/html/register.html"
                >
                  Get Started
                </a>
              ) : null}
              {user && user.role !== "admin" ? (
                <a
                  className="btn btn--secondary btn--small"
                  href="/html/wishlist.html"
                >
                  Wishlist
                </a>
              ) : null}
              {user && user.role !== "admin" ? (
                <a
                  className="btn btn--secondary btn--small"
                  href="/html/my-listings.html"
                >
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
                  <li>
                    <a href="/">Home</a>
                  </li>
                  <li>
                    <a href="/html/products.html">Browse listings</a>
                  </li>
                </>
              ) : null}
              {user && user.role !== "admin" ? (
                <li>
                  <a href="/html/wishlist.html">Wishlist</a>
                </li>
              ) : null}
              {user && user.role !== "admin" ? (
                <li>
                  <a href="/html/my-listings.html">Manage listings</a>
                </li>
              ) : null}
              {user && user.role !== "admin" ? (
                <li>
                  <a href="/html/bookings.html">Bookings</a>
                </li>
              ) : null}
              {user && user.role !== "admin" ? (
                <li>
                  <a href="/html/rentals.html">Rentals</a>
                </li>
              ) : null}
              {user?.role === "admin" ? (
                <li>
                  <a href={getDefaultAuthenticatedPath(user)}>
                    Admin dashboard
                  </a>
                </li>
              ) : null}
            </ul>
          </nav>

          <nav className="site-footer__section" aria-label="Account links">
            <p className="site-footer__heading">Account</p>
            <ul className="site-footer__links">
              {!user ? (
                <>
                  <li>
                    <a href="/html/login.html">Login</a>
                  </li>
                  <li>
                    <a href="/html/register.html">Register</a>
                  </li>
                  <li>
                    <a href="/html/forgot-password.html">Forgot password</a>
                  </li>
                </>
              ) : null}
              {user && user.role !== "admin" ? (
                <li>
                  <a href="/html/wishlist.html">Wishlist</a>
                </li>
              ) : null}
              {user && user.role !== "admin" ? (
                <li>
                  <a href="/html/bookings.html">Bookings</a>
                </li>
              ) : null}
              {user && user.role !== "admin" ? (
                <li>
                  <a href="/html/rentals.html">Rentals</a>
                </li>
              ) : null}
              {user && user.role !== "admin" ? (
                <li>
                  <a href="/html/profile.html">Profile</a>
                </li>
              ) : null}
            </ul>
          </nav>

          <section className="site-footer__section">
            <p className="site-footer__heading">Why AI Rent</p>
            <ul className="site-footer__links">
              <li>
                <span>Simple browsing and filtering.</span>
              </li>
              <li>
                <span>Owner and renter workflows in one place.</span>
              </li>
              <li>
                <span>Role-aware navigation across the shared shell.</span>
              </li>
            </ul>
          </section>
        </div>

        <div className="site-footer__bottom">
          <p>
            &copy; {new Date().getFullYear()} AI Rent. Built for smarter
            sharing.
          </p>
          <p>
            Browse, list, and manage rentals from one streamlined workspace.
          </p>
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
  cursorConfig,
  notificationBadgeCount,
  notificationBadgeCounts,
}) {
  useCanvasCursor(cursorConfig);

  const isAdmin = user?.role === "admin";
  const heroHeaderSelector = HERO_HEADER_SELECTORS[page] || null;
  const normalHeaderSectionSelectors =
    NORMAL_HEADER_SECTION_SELECTORS[page] || [];
  const mainClassName =
    page === "home" ? "page-shell page-shell--landing" : "page-shell";
  const brandHref = page === "admin" ? getDefaultAuthenticatedPath(user) : "/";
  const headerRef = useRef(null);
  const topRef = useRef(null);
  const desktopOverflowRef = useRef(null);
  const navMeasureRef = useRef(null);
  const overflowToggleMeasureRef = useRef(null);
  const [layoutBadgeCounts, setLayoutBadgeCounts] = useState(
    normalizeNotificationBadgeCounts({
      notifications: notificationBadgeCount,
      ...(notificationBadgeCounts || {}),
    }),
  );
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.innerWidth <= MOBILE_NAV_BREAKPOINT,
  );
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isHeaderOnHero, setIsHeaderOnHero] = useState(
    Boolean(heroHeaderSelector),
  );
  const [visibleDesktopNavItems, setVisibleDesktopNavItems] = useState(
    Number.MAX_SAFE_INTEGER,
  );
  const [isDesktopOverflowOpen, setIsDesktopOverflowOpen] = useState(false);

  const navItems = [];

  if (page === "admin") {
    navItems.push({
      key: "admin-dashboard",
      type: "link",
      href: getDefaultAuthenticatedPath(user),
      label: "Admin Dashboard",
      isActive: true,
    });

    if (user) {
      navItems.push({
        key: "logout",
        type: "button",
        label: "Logout",
        onClick: onLogout,
      });
    }
  } else {
    if (!isAdmin) {
      navItems.push({
        key: "home",
        type: "link",
        href: "/",
        label: "Home",
        isActive: page === "home",
      });
      navItems.push({
        key: "browse",
        type: "link",
        href: "/html/products.html",
        label: "Browse",
        isActive: page === "products" || page === "product-details",
      });
    }

    if (isAdmin) {
      navItems.push({
        key: "admin-dashboard",
        type: "link",
        href: getDefaultAuthenticatedPath(user),
        label: "Admin Dashboard",
      });
    }

    if (user && !isAdmin) {
      navItems.push({
        key: "wishlist",
        type: "link",
        href: "/html/wishlist.html",
        label: "Wishlist",
        isActive: page === "wishlist" || activeNav === "wishlist",
      });
      navItems.push({
        key: "my-listings",
        type: "link",
        href: "/html/my-listings.html",
        label: "My Listings",
        isActive: page === "my-listings",
      });
      navItems.push({
        key: "bookings",
        type: "badge-link",
        href: "/html/bookings.html",
        label: "Bookings",
        scope: "bookings",
        count: layoutBadgeCounts.bookings,
        isActive: page === "bookings" || activeNav === "bookings",
      });
      navItems.push({
        key: "rentals",
        type: "badge-link",
        href: "/html/rentals.html",
        label: "Rentals",
        scope: "rentals",
        count: layoutBadgeCounts.rentals,
        isActive: page === "rentals" || activeNav === "rentals",
      });
      navItems.push({
        key: "notifications",
        type: "badge-link",
        href: "/html/profile.html?tab=notifications",
        label: "Notifications",
        scope: "notifications",
        count: layoutBadgeCounts.notifications,
        isActive: activeNav === "notifications",
      });
      navItems.push({
        key: "profile",
        type: "link",
        href: "/html/profile.html",
        label: "Profile",
        isActive: activeNav === "profile",
      });
    }

    if (!user) {
      navItems.push({
        key: "login",
        type: "link",
        href: "/html/login.html",
        label: "Login",
      });
      navItems.push({
        key: "register",
        type: "link",
        href: "/html/register.html",
        label: "Register",
      });
    }

    if (user) {
      navItems.push({
        key: "logout",
        type: "button",
        label: "Logout",
        onClick: onLogout,
      });
    }
  }

  const desktopVisibleCount = isMobileViewport
    ? navItems.length
    : Math.min(visibleDesktopNavItems, navItems.length);
  const visibleNavItems = navItems.slice(0, desktopVisibleCount);
  const overflowNavItems = isMobileViewport
    ? []
    : navItems.slice(desktopVisibleCount);

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
      const detail = event?.detail;
      if (
        detail &&
        (typeof detail.unreadCount === "number" ||
          typeof detail.bookingUnreadCount === "number" ||
          typeof detail.rentalUnreadCount === "number" ||
          typeof detail.notifications === "number" ||
          typeof detail.bookings === "number" ||
          typeof detail.rentals === "number")
      ) {
        setLayoutBadgeCounts((previous) =>
          normalizeNotificationBadgeCounts({
            notifications:
              detail.notifications ??
              detail.unreadCount ??
              previous.notifications,
            bookings:
              detail.bookings ?? detail.bookingUnreadCount ?? previous.bookings,
            rentals:
              detail.rentals ?? detail.rentalUnreadCount ?? previous.rentals,
          }),
        );
      }

      refreshUnreadCounts();
    }

    refreshUnreadCounts();
    window.addEventListener("focus", refreshUnreadCounts);
    window.addEventListener(
      "notifications:changed",
      handleNotificationsChanged,
    );

    return () => {
      active = false;
      window.removeEventListener("focus", refreshUnreadCounts);
      window.removeEventListener(
        "notifications:changed",
        handleNotificationsChanged,
      );
    };
  }, [isAdmin, notificationBadgeCounts, user]);

  useEffect(() => {
    setIsMobileNavOpen(false);
    setIsDesktopOverflowOpen(false);
  }, [activeNav, isAdmin, page, user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function handleResize() {
      const nextIsMobileViewport = window.innerWidth <= MOBILE_NAV_BREAKPOINT;
      setIsMobileViewport(nextIsMobileViewport);

      if (!nextIsMobileViewport) {
        setIsMobileNavOpen(false);
      }

      if (nextIsMobileViewport) {
        setIsDesktopOverflowOpen(false);
      }
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !headerRef.current) {
      return undefined;
    }

    const root = document.documentElement;

    function updateHeaderOffset() {
      const measuredHeight = Math.ceil(
        headerRef.current?.getBoundingClientRect().height || 0,
      );
      const nextOffset = Math.max(measuredHeight + HEADER_CLEARANCE_PX, 70);
      root.style.setProperty("--site-header-offset", `${nextOffset}px`);
    }

    updateHeaderOffset();

    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            updateHeaderOffset();
          })
        : null;

    resizeObserver?.observe(headerRef.current);
    window.addEventListener("resize", updateHeaderOffset);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateHeaderOffset);
      root.style.removeProperty("--site-header-offset");
    };
  }, [isMobileNavOpen, page, user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (!heroHeaderSelector || isMobileNavOpen) {
      setIsHeaderOnHero(false);
      return undefined;
    }

    let frameId = 0;

    function updateHeaderTone() {
      const headerHeight = Math.ceil(
        headerRef.current?.getBoundingClientRect().height || 0,
      );
      const headerBottom = headerHeight + 12;
      const hasReachedNormalSection = normalHeaderSectionSelectors.some(
        (selector) => {
          const section = document.querySelector(selector);

          if (!section) {
            return false;
          }

          const sectionRect = section.getBoundingClientRect();
          return sectionRect.top < headerBottom && sectionRect.bottom > 0;
        },
      );

      if (hasReachedNormalSection) {
        setIsHeaderOnHero(false);
        return;
      }

      const hero = document.querySelector(heroHeaderSelector);

      if (!hero) {
        setIsHeaderOnHero(false);
        return;
      }

      const heroRect = hero.getBoundingClientRect();

      setIsHeaderOnHero(heroRect.top < headerBottom && heroRect.bottom > 0);
    }

    function scheduleToneUpdate() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateHeaderTone);
    }

    updateHeaderTone();
    window.addEventListener("scroll", scheduleToneUpdate, { passive: true });
    window.addEventListener("resize", scheduleToneUpdate);
    window.addEventListener("hashchange", scheduleToneUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleToneUpdate);
      window.removeEventListener("resize", scheduleToneUpdate);
      window.removeEventListener("hashchange", scheduleToneUpdate);
    };
  }, [heroHeaderSelector, isMobileNavOpen, normalHeaderSectionSelectors]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (isMobileViewport) {
      setVisibleDesktopNavItems(navItems.length);
      setIsDesktopOverflowOpen(false);
      return undefined;
    }

    let frameId = 0;

    function updateVisibleDesktopItemCount() {
      const currentHeader = headerRef.current;
      const currentTop = topRef.current;
      const currentMeasure = navMeasureRef.current;
      const currentOverflowToggleMeasure = overflowToggleMeasureRef.current;

      if (
        !currentHeader ||
        !currentTop ||
        !currentMeasure ||
        !currentOverflowToggleMeasure
      ) {
        return;
      }

      const headerStyles = window.getComputedStyle(currentHeader);
      const headerGap =
        parseFloat(headerStyles.columnGap || headerStyles.gap || "0") || 0;
      const measureStyles = window.getComputedStyle(currentMeasure);
      const itemGap =
        parseFloat(measureStyles.columnGap || measureStyles.gap || "0") || 0;
      const availableWidth = Math.max(
        currentHeader.clientWidth -
          currentTop.getBoundingClientRect().width -
          headerGap,
        0,
      );
      const itemWidths = Array.from(
        currentMeasure.querySelectorAll('[data-measure-item="true"]'),
      ).map((node) => Math.ceil(node.getBoundingClientRect().width));
      const overflowToggleWidth = Math.ceil(
        currentOverflowToggleMeasure.getBoundingClientRect().width,
      );

      if (!itemWidths.length) {
        setVisibleDesktopNavItems(0);
        return;
      }

      const totalItemWidth =
        itemWidths.reduce((sum, width) => sum + width, 0) +
        itemGap * Math.max(itemWidths.length - 1, 0);

      if (totalItemWidth <= availableWidth) {
        setVisibleDesktopNavItems(itemWidths.length);
        return;
      }

      let nextVisibleCount = 0;
      let usedWidth = 0;

      for (let index = 0; index < itemWidths.length; index += 1) {
        const nextUsedWidth =
          usedWidth + (nextVisibleCount > 0 ? itemGap : 0) + itemWidths[index];
        const needsOverflowToggle = index < itemWidths.length - 1;
        const nextTotalWidth =
          nextUsedWidth +
          (needsOverflowToggle ? itemGap + overflowToggleWidth : 0);

        if (
          (!needsOverflowToggle && nextUsedWidth <= availableWidth) ||
          nextTotalWidth <= availableWidth
        ) {
          usedWidth = nextUsedWidth;
          nextVisibleCount += 1;
          continue;
        }

        break;
      }

      setVisibleDesktopNavItems(nextVisibleCount);
    }

    function scheduleVisibleDesktopItemCountUpdate() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateVisibleDesktopItemCount);
    }

    scheduleVisibleDesktopItemCountUpdate();

    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            scheduleVisibleDesktopItemCountUpdate();
          })
        : null;

    resizeObserver?.observe(headerRef.current);
    resizeObserver?.observe(topRef.current);
    resizeObserver?.observe(navMeasureRef.current);

    window.addEventListener("resize", scheduleVisibleDesktopItemCountUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener(
        "resize",
        scheduleVisibleDesktopItemCountUpdate,
      );
    };
  }, [
    activeNav,
    isMobileViewport,
    isAdmin,
    layoutBadgeCounts.bookings,
    layoutBadgeCounts.notifications,
    layoutBadgeCounts.rentals,
    navItems.length,
    page,
    user,
  ]);

  useEffect(() => {
    if (!overflowNavItems.length) {
      setIsDesktopOverflowOpen(false);
    }
  }, [overflowNavItems.length]);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!headerRef.current?.contains(event.target)) {
        setIsMobileNavOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileNavOpen]);

  useEffect(() => {
    if (!isDesktopOverflowOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!desktopOverflowRef.current?.contains(event.target)) {
        setIsDesktopOverflowOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsDesktopOverflowOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDesktopOverflowOpen]);

  async function handleBadgeLinkNavigate(event, item) {
    if (!isPlainLeftClick(event)) {
      return;
    }

    if (!item?.href) {
      return;
    }

    if (!user || isAdmin || !item.scope || !item.count) {
      return;
    }

    event.preventDefault();

    try {
      const result = await fetchApi(
        `/api/v1/notifications/scope/${item.scope}/read`,
        {
          method: "PUT",
          auth: true,
        },
      );

      if (result.ok && result.data?.success && result.data?.data) {
        const nextCounts = normalizeNotificationBadgeCounts(result.data.data);
        setLayoutBadgeCounts(nextCounts);
        window.dispatchEvent(
          new CustomEvent("notifications:changed", {
            detail: result.data.data,
          }),
        );
      }
    } finally {
      window.location.href = item.href;
    }
  }

  function renderNavItem(item, options = {}) {
    const { measure = false } = options;
    const sharedProps = measure
      ? { "data-measure-item": "true", tabIndex: -1 }
      : {};

    if (item.type === "badge-link") {
      return (
        <NavBadgeLink
          key={`${item.key}${measure ? "-measure" : ""}`}
          href={item.href}
          label={item.label}
          count={item.count}
          scope={item.scope}
          isActive={item.isActive}
          onNavigate={measure ? undefined : handleBadgeLinkNavigate}
          {...sharedProps}
        />
      );
    }

    if (item.type === "button") {
      return (
        <button
          key={`${item.key}${measure ? "-measure" : ""}`}
          type="button"
          className={item.isActive ? "is-active" : ""}
          onClick={measure ? undefined : item.onClick}
          {...sharedProps}
        >
          {item.label}
        </button>
      );
    }

    return (
      <a
        key={`${item.key}${measure ? "-measure" : ""}`}
        href={item.href}
        className={item.isActive ? "is-active" : ""}
        {...sharedProps}
      >
        {item.label}
      </a>
    );
  }

  function handleNavItemClick(event) {
    if (!event.target.closest("a, button")) {
      return;
    }

    setIsMobileNavOpen(false);

    if (!event.target.closest(".site-nav__overflow-toggle")) {
      setIsDesktopOverflowOpen(false);
    }
  }

  return (
    <>
      <header
        ref={headerRef}
        className={`site-header${isMobileNavOpen ? " is-nav-open" : ""}${isHeaderOnHero ? " is-on-hero" : ""}`}
      >
        <div className="site-header__top" ref={topRef}>
          <a className="brand" href={brandHref}>
            AI <span className="rent">Rent</span>
          </a>
          <button
            type="button"
            className={`site-nav-toggle${isMobileNavOpen ? " is-open" : ""}`}
            aria-expanded={isMobileNavOpen}
            aria-controls="site-navigation"
            aria-label={
              isMobileNavOpen ? "Close navigation menu" : "Open navigation menu"
            }
            onClick={() => setIsMobileNavOpen((previous) => !previous)}
          >
            {/* <span className="site-nav-toggle__label">
              {isMobileNavOpen ? "Close" : "Menu"}
            </span> */}
            <span className="site-nav-toggle__icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
        <nav
          id="site-navigation"
          className={`site-nav${isMobileNavOpen ? " is-open" : ""}`}
          onClick={handleNavItemClick}
        >
          <div className="site-nav__visible">
            {visibleNavItems.map((item) => renderNavItem(item))}
          </div>
          {overflowNavItems.length ? (
            <div
              ref={desktopOverflowRef}
              className={`site-nav__overflow${isDesktopOverflowOpen ? " is-open" : ""}`}
            >
              <button
                type="button"
                className="site-nav__overflow-toggle"
                aria-expanded={isDesktopOverflowOpen}
                aria-label={
                  isDesktopOverflowOpen
                    ? "Close overflow navigation menu"
                    : "Open overflow navigation menu"
                }
                onClick={() =>
                  setIsDesktopOverflowOpen((previous) => !previous)
                }
              >
                <span className="site-nav__overflow-bars" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </button>
              <div className="site-nav__overflow-menu">
                {overflowNavItems.map((item) => renderNavItem(item))}
              </div>
            </div>
          ) : null}
        </nav>
        <div className="site-nav__measure" aria-hidden="true">
          <div ref={navMeasureRef} className="site-nav__measure-row">
            {navItems.map((item) => renderNavItem(item, { measure: true }))}
          </div>
          <button
            ref={overflowToggleMeasureRef}
            type="button"
            className="site-nav__overflow-toggle"
          >
            <span className="site-nav__overflow-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </header>
      <main className={mainClassName}>{children}</main>
      <SiteFooter user={user} />
    </>
  );
}
