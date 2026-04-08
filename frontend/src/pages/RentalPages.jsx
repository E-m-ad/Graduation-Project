import React, { useEffect, useState } from "react";
import {
  buildQuery,
  fetchApi,
  getDefaultAuthenticatedPath,
  redirectToLogin,
  replaceUrl,
} from "../lib/airent";
import { useMessageState, useSession } from "../lib/hooks";
import {
  EmptyState,
  MessageText,
  PaginationBar,
  RentalListItem,
  SectionHeading,
} from "../components/Common";
import { SiteLayout } from "../components/Layout";

const PAGE_CONFIG = {
  bookings: {
    pageTitle: "Bookings | AI Rent",
    urlPath: "/html/bookings.html",
    endpoint: "/api/v1/rentals/my-bookings",
    activeNav: "bookings",
    listType: "bookings",
    showOwner: true,
    eyebrow: "Renter workspace",
    heroTitle: "Track every booking without digging through your profile.",
    heroText:
      "See pending approvals, active rentals, and finished returns in one dedicated page built around your renter workflow.",
    actionHref: "/html/products.html",
    actionLabel: "Browse listings",
    secondaryHref: "/html/profile.html?tab=notifications",
    secondaryLabel: "Open notifications",
    panelLabel: "Booking flow",
    highlights: [
      {
        title: "Follow approvals",
        text: "Spot pending requests and approved handoffs without mixing them into account settings.",
      },
      {
        title: "Watch live rentals",
        text: "Active bookings keep their countdown and finish details visible from the same list.",
      },
      {
        title: "Cancel quickly",
        text: "Pending and approved bookings still expose the same safe cancel action when plans change.",
      },
    ],
    sectionEyebrow: "Your bookings",
    sectionTitle: "Manage renter-side activity",
    emptyMessage: "You have no bookings yet.",
    statusNoun: "booking",
  },
  rentals: {
    pageTitle: "Rentals | AI Rent",
    urlPath: "/html/rentals.html",
    endpoint: "/api/v1/rentals/my-requests",
    activeNav: "rentals",
    listType: "requests",
    showOwner: false,
    eyebrow: "Owner workspace",
    heroTitle: "Handle requests and live rentals from a dedicated owner page.",
    heroText:
      "Incoming approvals, active handoffs, and completed returns now stay separate from profile editing so you can manage rentals faster.",
    actionHref: "/html/my-listings.html",
    actionLabel: "Open my listings",
    secondaryHref: "/html/profile.html?tab=notifications",
    secondaryLabel: "Open notifications",
    panelLabel: "Rental control",
    highlights: [
      {
        title: "Approve with focus",
        text: "Pending requests stay easy to review, approve, or reject without extra profile clutter.",
      },
      {
        title: "Start on time",
        text: "Approved rentals surface the start action clearly so handoff steps are easier to manage.",
      },
      {
        title: "Close the loop",
        text: "Active rentals keep the complete action and timeline visible until the item is returned.",
      },
    ],
    sectionEyebrow: "Your rentals",
    sectionTitle: "Manage owner-side activity",
    emptyMessage: "You do not have rental activity to manage yet.",
    statusNoun: "rental",
  },
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rejected", label: "Rejected" },
  { value: "overdue", label: "Overdue" },
];

function readFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    page: Math.max(Number(params.get("page") || "1") || 1, 1),
    status: params.get("status") || "",
  };
}

function replaceRentalInList(items, nextRental) {
  const hasMatch = items.some((item) => item.id === nextRental.id);
  if (!hasMatch) {
    return items;
  }

  return items.map((item) => (item.id === nextRental.id ? nextRental : item));
}

function publishNotificationsChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("notifications:changed"));
}

function formatStatusLabel(status) {
  return String(status || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getResultsLabel(totalItems, status, noun) {
  const baseNoun = totalItems === 1 ? noun : `${noun}s`;
  if (!status) {
    return `${totalItems} total ${baseNoun}`;
  }

  return `${totalItems} ${formatStatusLabel(status).toLowerCase()} ${baseNoun}`;
}

function getEmptyMessage(defaultMessage, status, noun) {
  if (!status) {
    return defaultMessage;
  }

  return `No ${noun}s are ${formatStatusLabel(status).toLowerCase()} right now.`;
}

function getRentalActionSuccessMessage(action, rental, fallbackMessage) {
  if (action === "start" && rental?.endDate) {
    return `Rental started. Scheduled finish: ${new Date(
      rental.endDate,
    ).toLocaleString()}`;
  }

  if (action === "complete" && (rental?.actualReturnDate || rental?.endDate)) {
    return `Rental completed. Finished at: ${new Date(
      rental.actualReturnDate || rental.endDate,
    ).toLocaleString()}`;
  }

  return fallbackMessage;
}

function RentalWorkspacePage({ mode, page }) {
  const config = PAGE_CONFIG[mode];
  const initialFilters = readFiltersFromUrl();
  const { user, loading, logout } = useSession();
  const [message, showMessage] = useMessageState("");
  const [filters, setFilters] = useState(initialFilters);
  const [rentals, setRentals] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loadingRentals, setLoadingRentals] = useState(true);

  useEffect(() => {
    document.title = config.pageTitle;
  }, [config.pageTitle]);

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
    let active = true;

    async function loadRentals() {
      if (loading || !user || user.role === "admin") {
        return;
      }

      setLoadingRentals(true);
      showMessage("");
      replaceUrl(config.urlPath, {
        page: filters.page > 1 ? filters.page : "",
        status: filters.status,
      });

      const query = buildQuery({
        page: filters.page,
        limit: 8,
        status: filters.status,
      });
      const result = await fetchApi(`${config.endpoint}?${query}`, { auth: true });

      if (!active) {
        return;
      }

      setLoadingRentals(false);

      if (!result.ok || !result.data?.success) {
        showMessage(
          result.data?.message || `Unable to load your ${config.statusNoun}s.`,
          "error",
        );
        setRentals([]);
        setPagination(null);
        return;
      }

      setRentals(result.data?.data?.rentals || []);
      setPagination(result.data?.data?.pagination || null);
    }

    loadRentals();

    return () => {
      active = false;
    };
  }, [config.endpoint, config.statusNoun, config.urlPath, filters, loading, showMessage, user]);

  async function reloadRentals() {
    const query = buildQuery({
      page: filters.page,
      limit: 8,
      status: filters.status,
    });
    const result = await fetchApi(`${config.endpoint}?${query}`, { auth: true });

    if (!result.ok || !result.data?.success) {
      setRentals([]);
      setPagination(null);
      return;
    }

    setRentals(result.data?.data?.rentals || []);
    setPagination(result.data?.data?.pagination || null);
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
    showMessage(
      getRentalActionSuccessMessage(
        action,
        responseRental,
        result.data?.message ||
          (result.ok ? "Action completed successfully." : "Action failed."),
      ),
      result.ok ? "success" : "error",
    );

    if (result.ok) {
      if (responseRental) {
        setRentals((previous) => replaceRentalInList(previous, responseRental));
      }
      await reloadRentals();
      publishNotificationsChanged();
    }
  }

  const totalItems = pagination?.totalItems ?? rentals.length;

  return (
    <SiteLayout
      page={page}
      user={user}
      onLogout={logout}
      activeNav={config.activeNav}
    >
      <section className="hero rental-workspace-hero">
        <div className="hero__content">
          <p className="eyebrow">{config.eyebrow}</p>
          <h1>{config.heroTitle}</h1>
          <p className="hero__text">{config.heroText}</p>
          <div className="hero__actions">
            <a className="btn btn--primary" href={config.actionHref}>
              {config.actionLabel}
            </a>
            <a className="btn btn--secondary" href={config.secondaryHref}>
              {config.secondaryLabel}
            </a>
          </div>
        </div>

        <aside className="hero__panel rental-workspace-hero__panel">
          <p className="panel-label">{config.panelLabel}</p>
          <div className="rental-workspace-hero__points">
            {config.highlights.map((highlight) => (
              <div className="rental-workspace-hero__point" key={highlight.title}>
                <strong>{highlight.title}</strong>
                <p>{highlight.text}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <MessageText message={message} id={`${mode}Message`} />

      <section className="surface-panel rental-workspace__panel">
        <SectionHeading
          eyebrow={config.sectionEyebrow}
          title={config.sectionTitle}
          compact
        >
          <div className="rental-workspace__summary">
            <span className="tag">
              {loadingRentals && !rentals.length
                ? `Loading ${config.statusNoun}s...`
                : getResultsLabel(totalItems, filters.status, config.statusNoun)}
            </span>
            {filters.status ? (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => setFilters({ page: 1, status: "" })}
              >
                Clear filter
              </button>
            ) : null}
          </div>
        </SectionHeading>

        <div className="rental-workspace__filters">
          <div className="field">
            <label htmlFor={`${mode}StatusFilter`}>Status</label>
            <select
              id={`${mode}StatusFilter`}
              className="input"
              value={filters.status}
              onChange={(event) =>
                setFilters({
                  page: 1,
                  status: event.target.value,
                })
              }
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="list-stack">
          {rentals.length ? (
            rentals.map((rental) => (
              <RentalListItem
                key={rental.id}
                rental={rental}
                listType={config.listType}
                showOwner={config.showOwner}
                onAction={handleRentalAction}
              />
            ))
          ) : (
            <EmptyState
              message={
                loadingRentals
                  ? `Loading ${config.statusNoun}s...`
                  : getEmptyMessage(
                      config.emptyMessage,
                      filters.status,
                      config.statusNoun,
                    )
              }
            />
          )}
        </div>

        <PaginationBar
          pagination={pagination}
          onPrevious={() =>
            setFilters((previous) => ({ ...previous, page: previous.page - 1 }))
          }
          onNext={() =>
            setFilters((previous) => ({ ...previous, page: previous.page + 1 }))
          }
        />
      </section>
    </SiteLayout>
  );
}

export function BookingsPage({ page }) {
  return <RentalWorkspacePage mode="bookings" page={page} />;
}

export function RentalsPage({ page }) {
  return <RentalWorkspacePage mode="rentals" page={page} />;
}
