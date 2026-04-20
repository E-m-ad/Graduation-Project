import React, { useEffect, useRef, useState } from "react";
import {
  buildQuery,
  fetchApi,
  getDefaultAuthenticatedPath,
  redirectToLogin,
  replaceUrl,
} from "../lib/airent";
import { useActionDialog, useMessageState, useSession } from "../lib/hooks";
import {
  ActionDialog,
  BookingProductCard,
  EmptyState,
  MessageText,
  PaginationBar,
  RentalListItem,
  SectionHeading,
} from "../components/Common";
import { SiteLayout } from "../components/Layout";
const CURSOR_CONFIG = {
  bookings: {
    enabled: false,
    color: "#000000",
    targetSelector: "body",
    activeSelectors: [],
    deactiveSelectors: [],
  },
  rentals: {
    enabled: false,
    color: "#000000",
    targetSelector: "body",
    activeSelectors: [],
    deactiveSelectors: [],
  },
};
const PAGE_CONFIG = {
  bookings: {
    pageTitle: "Bookings | AI Rent",
    urlPath: "/html/bookings.html",
    endpoint: "/api/v1/rentals/my-bookings",
    activeNav: "bookings",
    listType: "bookings",
    showOwner: true,
    eyebrow: "Renter workspace",
    heroTitle: "Track every booking ",
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
const CHAT_POLL_INTERVAL_MS = 10000;

function getHiddenRentalStorageKey(mode, userId) {
  if (mode === "rentals") {
    return `ai_rent_hidden_owner_rentals_${userId}`;
  }

  return `ai_rent_hidden_bookings_${userId}`;
}

function readHiddenRentalIds(mode, userId) {
  if (!mode || !userId || typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(
      getHiddenRentalStorageKey(mode, userId),
    );
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function writeHiddenRentalIds(mode, userId, rentalIds) {
  if (!mode || !userId || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getHiddenRentalStorageKey(mode, userId),
      JSON.stringify(rentalIds),
    );
  } catch {
    // Ignore local storage write failures and keep the current page state.
  }
}

function filterVisibleRentals(rentals, hiddenRentalIds) {
  if (!hiddenRentalIds.length) {
    return rentals;
  }

  const hiddenRentalIdSet = new Set(hiddenRentalIds);
  return rentals.filter((rental) => !hiddenRentalIdSet.has(rental.id));
}

function adjustPaginationForHiddenRentals(pagination, hiddenCount) {
  if (!pagination) {
    return pagination;
  }

  const totalItems = Math.max((pagination.totalItems || 0) - hiddenCount, 0);
  const totalPages =
    totalItems === 0 ? 0 : Math.ceil(totalItems / (pagination.limit || 1));

  return {
    ...pagination,
    totalItems,
    totalPages,
    hasNextPage: pagination.page < totalPages,
    hasPreviousPage: pagination.page > 1 && totalPages > 0,
  };
}

function canDeleteOwnerRental(rental) {
  if (!rental) {
    return false;
  }

  if (["cancelled", "completed"].includes(rental.status)) {
    return true;
  }

  const endTime = new Date(rental.endDate || 0).getTime();
  return Number.isFinite(endTime) && endTime <= Date.now();
}

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

async function syncRentalNotificationCounts(rentalId) {
  if (!rentalId) {
    return;
  }

  await fetchApi(`/api/v1/notifications/rental/${rentalId}/read`, {
    method: "PUT",
    auth: true,
  });
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

function formatChatTimestamp(value) {
  if (!value) {
    return "";
  }

  const parsedValue = new Date(value);
  if (Number.isNaN(parsedValue.getTime())) {
    return "";
  }

  return parsedValue.toLocaleString();
}

function getChatThreadSummary(rental, messageCount) {
  if (!rental?.chat?.hasMessages) {
    return "Conversation ready for pickup details, timing, and questions.";
  }

  const lastUpdatedLabel = formatChatTimestamp(rental.chat.lastMessageAt);
  const messageLabel = `${messageCount} message${messageCount === 1 ? "" : "s"}`;

  return lastUpdatedLabel
    ? `${messageLabel} • Last update ${lastUpdatedLabel}`
    : messageLabel;
}

function getChatCounterpart(rental, currentUserId) {
  if (!rental) {
    return null;
  }

  return rental.ownerId === currentUserId ? rental.renter : rental.owner;
}

function RentalChatDialog({
  chatState,
  currentUserId,
  onClose,
  onDraftChange,
  onSend,
}) {
  const messagesEndRef = useRef(null);
  const composerRef = useRef(null);

  useEffect(() => {
    if (!chatState.open) {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (
        event.key === "Enter" &&
        (event.metaKey || event.ctrlKey) &&
        !chatState.sending
      ) {
        event.preventDefault();
        onSend();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [chatState.open, chatState.sending, onClose, onSend]);

  useEffect(() => {
    if (!chatState.open) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({
      block: "end",
    });
  }, [chatState.messages, chatState.open]);

  useEffect(() => {
    if (!chatState.open || chatState.loading) {
      return;
    }

    composerRef.current?.focus();
  }, [chatState.loading, chatState.open, chatState.rentalId]);

  if (!chatState.open) {
    return null;
  }

  const counterpart = getChatCounterpart(chatState.rental, currentUserId);
  const productTitle = chatState.rental?.product?.title || "Rental chat";
  const messageCount = chatState.messages.length;

  function handleOverlayPointerDown(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="rental-chat-dialog"
      role="presentation"
      onMouseDown={handleOverlayPointerDown}
    >
      <div
        className="rental-chat-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rentalChatTitle"
      >
        <div className="rental-chat-dialog__header">
          <div className="rental-chat-dialog__header-copy">
            <p className="rental-chat-dialog__eyebrow">Rental chat</p>
            <h3 id="rentalChatTitle">{productTitle}</h3>
            <p className="compact-text">
              {counterpart?.name
                ? `Chat with ${counterpart.name}`
                : "Chat with the other participant"}
            </p>
            <div className="rental-chat-dialog__thread-meta">
              <span className="tag tag--light">
                {formatStatusLabel(chatState.rental?.status || "rental")}
              </span>
              <span className="compact-text">
                {getChatThreadSummary(chatState.rental, messageCount)}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {chatState.error ? (
          <MessageText message={{ text: chatState.error, type: "error" }} />
        ) : null}

        <div className="rental-chat-dialog__messages">
          {chatState.loading && !chatState.messages.length ? (
            <EmptyState message="Loading chat..." />
          ) : chatState.messages.length ? (
            chatState.messages.map((message) => {
              const isOwnMessage = message.senderId === currentUserId;

              return (
                <article
                  key={message.id}
                  className={`rental-chat-message${isOwnMessage ? " is-own" : ""}`}
                >
                  <div className="rental-chat-message__meta">
                    <strong>
                      {isOwnMessage
                        ? "You"
                        : message.sender?.name || "Participant"}
                    </strong>
                    <span>{formatChatTimestamp(message.createdAt)}</span>
                  </div>
                  <p className="rental-chat-message__body">{message.message}</p>
                </article>
              );
            })
          ) : (
            <EmptyState message="No messages yet. Start the conversation here." />
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="rental-chat-dialog__composer">
          <label htmlFor="rentalChatMessage">Message</label>
          <textarea
            id="rentalChatMessage"
            ref={composerRef}
            className="textarea rental-chat-dialog__textarea"
            rows="4"
            maxLength="4000"
            placeholder="Write a message to the other participant..."
            value={chatState.draft}
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <div className="rental-chat-dialog__composer-actions">
            <p className="compact-text">
              {chatState.draft.length}/4000 characters • Press{" "}
              <strong>Ctrl + Enter</strong> to send quickly.
            </p>
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={onSend}
              disabled={chatState.sending || !chatState.draft.trim()}
            >
              {chatState.sending ? "Sending..." : "Send message"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RentalWorkspacePage({ mode, page }) {
  const config = PAGE_CONFIG[mode];
  const initialFilters = readFiltersFromUrl();
  const { user, loading, logout } = useSession();
  const { dialog, setDialog, closeDialog, confirmDialog, promptDialog } =
    useActionDialog();
  const [message, showMessage] = useMessageState("");
  const [filters, setFilters] = useState(initialFilters);
  const [rentals, setRentals] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loadingRentals, setLoadingRentals] = useState(true);
  const [hiddenRentalIds, setHiddenRentalIds] = useState([]);
  const [chatState, setChatState] = useState({
    open: false,
    rentalId: "",
    rental: null,
    messages: [],
    draft: "",
    loading: false,
    sending: false,
    error: "",
  });
  const chatRequestRef = useRef(0);

  useEffect(() => {
    document.title = config.pageTitle;
  }, [config.pageTitle]);

  useEffect(() => {
    if (!["bookings", "rentals"].includes(mode) || !user?.id) {
      setHiddenRentalIds([]);
      return;
    }

    setHiddenRentalIds(readHiddenRentalIds(mode, user.id));
  }, [mode, user?.id]);

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
      const result = await fetchApi(`${config.endpoint}?${query}`, {
        auth: true,
      });

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

      const fetchedRentals = result.data?.data?.rentals || [];
      const fetchedPagination = result.data?.data?.pagination || null;
      const shouldFilterHiddenRentals = ["bookings", "rentals"].includes(mode);
      const visibleRentals = shouldFilterHiddenRentals
        ? filterVisibleRentals(fetchedRentals, hiddenRentalIds)
        : fetchedRentals;
      const visiblePagination = shouldFilterHiddenRentals
        ? adjustPaginationForHiddenRentals(
            fetchedPagination,
            hiddenRentalIds.length,
          )
        : fetchedPagination;

      setRentals(visibleRentals);
      setPagination(visiblePagination);
    }

    loadRentals();

    return () => {
      active = false;
    };
  }, [
    config.endpoint,
    config.statusNoun,
    config.urlPath,
    filters,
    hiddenRentalIds,
    loading,
    mode,
    showMessage,
    user,
  ]);

  async function reloadRentals(nextHiddenRentalIds = hiddenRentalIds) {
    const query = buildQuery({
      page: filters.page,
      limit: 8,
      status: filters.status,
    });
    const result = await fetchApi(`${config.endpoint}?${query}`, {
      auth: true,
    });

    if (!result.ok || !result.data?.success) {
      setRentals([]);
      setPagination(null);
      return;
    }

    const fetchedRentals = result.data?.data?.rentals || [];
    const fetchedPagination = result.data?.data?.pagination || null;
    const shouldFilterHiddenRentals = ["bookings", "rentals"].includes(mode);
    const visibleRentals = shouldFilterHiddenRentals
      ? filterVisibleRentals(fetchedRentals, nextHiddenRentalIds)
      : fetchedRentals;
    const visiblePagination = shouldFilterHiddenRentals
      ? adjustPaginationForHiddenRentals(
          fetchedPagination,
          nextHiddenRentalIds.length,
        )
      : fetchedPagination;

    setRentals(visibleRentals);
    setPagination(visiblePagination);
  }

  async function loadChat(rentalId, options = {}) {
    if (!rentalId) {
      return;
    }

    const { silent = false } = options;
    const nextRequestId = chatRequestRef.current + 1;
    chatRequestRef.current = nextRequestId;
    const fallbackRental =
      rentals.find((rental) => rental.id === rentalId) || chatState.rental;

    setChatState((previous) => ({
      ...previous,
      open: true,
      rentalId,
      rental:
        previous.rentalId === rentalId && previous.rental
          ? previous.rental
          : fallbackRental,
      loading: silent ? previous.loading : true,
      error: "",
    }));

    const result = await fetchApi(`/api/v1/rentals/${rentalId}/messages`, {
      auth: true,
    });

    if (chatRequestRef.current !== nextRequestId) {
      return;
    }

    if (!result.ok || !result.data?.success) {
      setChatState((previous) =>
        previous.rentalId === rentalId
          ? {
              ...previous,
              loading: false,
              error:
                result.data?.message || "Unable to load the rental chat right now.",
            }
          : previous,
      );
      return;
    }

    const nextRental = result.data?.data?.rental || fallbackRental;

    setChatState((previous) =>
      previous.rentalId === rentalId
        ? {
            ...previous,
            open: true,
            rentalId,
            rental: nextRental || previous.rental,
            messages: result.data?.data?.messages || [],
            loading: false,
            error: "",
          }
        : previous,
    );
    if (nextRental) {
      setRentals((previous) => replaceRentalInList(previous, nextRental));
    }
    publishNotificationsChanged();
  }

  function closeChat() {
    chatRequestRef.current += 1;
    setChatState({
      open: false,
      rentalId: "",
      rental: null,
      messages: [],
      draft: "",
      loading: false,
      sending: false,
      error: "",
    });
  }

  async function sendChatMessage() {
    if (!chatState.rentalId || !chatState.draft.trim() || chatState.sending) {
      return;
    }

    const rentalId = chatState.rentalId;
    const nextMessage = chatState.draft.trim();

    setChatState((previous) => ({
      ...previous,
      sending: true,
      error: "",
    }));

    const result = await fetchApi(`/api/v1/rentals/${rentalId}/messages`, {
      method: "POST",
      auth: true,
      body: {
        message: nextMessage,
      },
    });

    if (!result.ok || !result.data?.success) {
      setChatState((previous) =>
        previous.rentalId === rentalId
          ? {
              ...previous,
              sending: false,
              error:
                result.data?.message || "Unable to send your message right now.",
            }
          : previous,
      );
      return;
    }

    const nextRental = result.data?.data?.rental || chatState.rental;

    setChatState((previous) =>
      previous.rentalId === rentalId
        ? {
            ...previous,
            rental: nextRental || previous.rental,
            messages: result.data?.data?.message
              ? [...previous.messages, result.data.data.message]
              : previous.messages,
            draft: "",
            sending: false,
            error: "",
          }
        : previous,
    );
    if (nextRental) {
      setRentals((previous) => replaceRentalInList(previous, nextRental));
    }
    publishNotificationsChanged();
  }

  useEffect(() => {
    if (!chatState.open || !chatState.rentalId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      loadChat(chatState.rentalId, {
        silent: true,
      });
    }, CHAT_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [chatState.open, chatState.rentalId]);

  async function handleRentalAction(action, rentalId) {
    if (action === "chat") {
      await loadChat(rentalId);
      return;
    }

    const targetRental = rentals.find((rental) => rental.id === rentalId);
    const isBookingsDelete = mode === "bookings" && action === "delete";
    const isOwnerRentalsDelete = mode === "rentals" && action === "delete";
    const shouldCancelBeforeDelete =
      isBookingsDelete &&
      ["pending", "approved"].includes(targetRental?.status || "");
    const endpointMap = {
      approve: { method: "PUT", path: `/api/v1/rentals/${rentalId}/approve` },
      reject: { method: "PUT", path: `/api/v1/rentals/${rentalId}/reject` },
      cancel: { method: "PUT", path: `/api/v1/rentals/${rentalId}/cancel` },
      start: { method: "PUT", path: `/api/v1/rentals/${rentalId}/start` },
      complete: { method: "PUT", path: `/api/v1/rentals/${rentalId}/complete` },
    };

    const requestConfig = isBookingsDelete
      ? shouldCancelBeforeDelete
        ? endpointMap.cancel
        : null
      : endpointMap[action];

    if (!requestConfig && !isBookingsDelete && !isOwnerRentalsDelete) {
      return;
    }

    if (isOwnerRentalsDelete && !canDeleteOwnerRental(targetRental)) {
      showMessage(
        "Only cancelled rentals or rentals whose period has finished can be deleted from this page.",
        "error",
      );
      return;
    }

    if (
      isBookingsDelete &&
      !(await confirmDialog({
        title: "Remove this booking card?",
        message:
          "This product card will be removed from your bookings list. Pending or approved bookings will be cancelled first.",
        confirmLabel: "Remove booking",
        cancelLabel: "Keep booking",
        tone: "danger",
      }))
    ) {
      return;
    }

    if (
      isOwnerRentalsDelete &&
      !(await confirmDialog({
        title: "Remove this rental card?",
        message:
          "This product card will be removed from your owner rentals list. Only cancelled or finished rental periods can be removed.",
        confirmLabel: "Remove rental",
        cancelLabel: "Keep rental",
        tone: "danger",
      }))
    ) {
      return;
    }

    let body;

    if (action === "reject" || (action === "cancel" && !isBookingsDelete)) {
      const reasonInput = await promptDialog({
        title: action === "reject" ? "Reject rental request" : "Cancel rental",
        message:
          "Add an optional note to explain this action. You can also leave it blank.",
        fieldLabel: "Reason",
        fieldPlaceholder: "Write a short note if needed",
        confirmLabel: action === "reject" ? "Reject request" : "Cancel rental",
        cancelLabel: "Back",
        tone: action === "reject" ? "danger" : "default",
      });

      if (reasonInput === null) {
        return;
      }

      body = {
        reason: reasonInput.trim() || undefined,
      };
    }

    const result = requestConfig
      ? await fetchApi(requestConfig.path, {
          method: requestConfig.method,
          auth: true,
          body,
        })
      : {
          ok: true,
          data: {
            success: true,
          },
        };

    const responseRental = result.data?.data;
    const successMessage =
      result.ok && (isBookingsDelete || isOwnerRentalsDelete)
        ? isOwnerRentalsDelete
          ? "Product removed from your owner rentals list."
          : "Product removed from your bookings list."
        : getRentalActionSuccessMessage(
            action,
            responseRental,
            result.data?.message ||
              (result.ok ? "Action completed successfully." : "Action failed."),
          );

    showMessage(successMessage, result.ok ? "success" : "error");

    if (result.ok) {
      await syncRentalNotificationCounts(rentalId);

      if ((isBookingsDelete || isOwnerRentalsDelete) && user?.id) {
        const nextHiddenRentalIds = [
          ...new Set([...hiddenRentalIds, rentalId]),
        ];
        setHiddenRentalIds(nextHiddenRentalIds);
        writeHiddenRentalIds(mode, user.id, nextHiddenRentalIds);
        setRentals((previous) =>
          previous.filter((rental) => rental.id !== rentalId),
        );
        await reloadRentals(nextHiddenRentalIds);
      } else if (responseRental) {
        setRentals((previous) => replaceRentalInList(previous, responseRental));
        await reloadRentals();
      } else {
        await reloadRentals();
      }
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
      cursorConfig={CURSOR_CONFIG[page]}
    >
      <MessageText message={message} id={`${mode}Message`} />
      <section className="surface-panel rental-workspace__panel">
        <SectionHeading title={config.sectionEyebrow} compact>
          <div className="rental-workspace__summary">
            <span className="tag">
              {loadingRentals && !rentals.length
                ? `Loading ${config.statusNoun}s...`
                : getResultsLabel(
                    totalItems,
                    filters.status,
                    config.statusNoun,
                  )}
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
        {rentals.length > 0 ? (
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
        ) : null}

        <div
          className={
            config.listType === "bookings" && rentals.length
              ? "card-grid rental-workspace__card-grid"
              : "list-stack"
          }
        >
          {rentals.length ? (
            rentals.map((rental) =>
              config.listType === "bookings" ? (
                <BookingProductCard
                  key={rental.id}
                  rental={rental}
                  onAction={handleRentalAction}
                />
              ) : (
                <RentalListItem
                  key={rental.id}
                  rental={rental}
                  listType={config.listType}
                  showOwner={config.showOwner}
                  onAction={handleRentalAction}
                />
              ),
            )
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
      <ActionDialog
        dialog={dialog}
        setDialog={setDialog}
        onClose={closeDialog}
      />
      <RentalChatDialog
        chatState={chatState}
        currentUserId={user?.id}
        onClose={closeChat}
        onDraftChange={(draft) =>
          setChatState((previous) => ({
            ...previous,
            draft,
          }))
        }
        onSend={sendChatMessage}
      />
    </SiteLayout>
  );
}

export function BookingsPage({ page }) {
  return <RentalWorkspacePage mode="bookings" page={page} />;
}

export function RentalsPage({ page }) {
  return <RentalWorkspacePage mode="rentals" page={page} />;
}
