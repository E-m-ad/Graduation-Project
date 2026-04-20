import React, { useEffect, useRef, useState } from "react";
import {
  AVATAR_PLACEHOLDER,
  buildQuery,
  fetchApi,
  formatDateTime,
  fetchWishlistIds,
  formatMoney,
  getPrimaryImage,
  getPriceLabel,
  redirectToLogin,
  toggleWishlist,
  trackBehavior,
} from "../lib/airent";
import { useActionDialog, useMessageState, useSession } from "../lib/hooks";
import {
  ActionDialog,
  DetailFactGrid,
  EmptyState,
  MessageText,
  ProductCard,
  SectionHeading,
} from "../components/Common";
import { SiteLayout } from "../components/Layout";

function getProductId() {
  return new URLSearchParams(window.location.search).get("id");
}

function getRequestedRentalId() {
  return new URLSearchParams(window.location.search).get("rentalId");
}

function shouldAutoOpenRequestedChat() {
  return new URLSearchParams(window.location.search).get("openChat") === "1";
}

function getRequestedNotificationId() {
  return new URLSearchParams(window.location.search).get("notificationId");
}

function getRequestedConversationId() {
  return new URLSearchParams(window.location.search).get("conversationId");
}

function publishNotificationsChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("notifications:changed"));
}

function getOwnerProfileHref(ownerId) {
  if (!ownerId) {
    return "";
  }

  return `/html/profile.html?id=${encodeURIComponent(ownerId)}`;
}

function getApprovalLabel(product) {
  if (!product) return "Unknown";
  if (product.isApproved) return "Approved";
  if (product.status === "suspended") return "Rejected";
  return "Pending review";
}

function getModerationStatusLabel(product) {
  if (!product) return "Listing status unavailable";
  if (product.isApproved && product.status === "suspended") {
    return "Listing is currently unlisted";
  }
  if (product.isApproved) return "Listing already approved";
  if (product.status === "suspended") return "Listing currently rejected";
  return "Pending admin decision";
}

function getOwnerReviewStatusLabel(product) {
  if (!product) return "Listing review unavailable";
  if (product.isApproved && product.status === "suspended") {
    return "Listing is hidden from the catalog";
  }
  if (product.isApproved) return "Listing is approved";
  if (product.status === "suspended") return "Changes requested by admin";
  if (product.status === "under_review") return "Listing is under review";
  return "Listing is not live yet";
}

function getOwnerAvailabilityLockNote(lock) {
  if (!lock) {
    return "";
  }

  const rentalStatus = String(lock.rentalStatus || "approved").toLowerCase();
  const renterLabel = lock.renterName ? ` for ${lock.renterName}` : "";
  const endLabel = lock.endDate
    ? formatDateTime(lock.endDate)
    : "the scheduled end";

  return `You cannot change this listing availability or delete it while the ${rentalStatus} rental${renterLabel} is still open. Scheduled end: ${endLabel}. The lock is removed only after that rental is cancelled or completed.`;
}

const RENTAL_PERIOD_OPTIONS = [
  { value: "daily", label: "Daily", priceField: "pricePerDay" },
  { value: "hourly", label: "Hourly", priceField: "pricePerHour" },
  { value: "weekly", label: "Weekly", priceField: "pricePerWeek" },
  { value: "monthly", label: "Monthly", priceField: "pricePerMonth" },
];

const REVIEW_RATING_OPTIONS = [
  { value: "5", label: "5 - Excellent" },
  { value: "4", label: "4 - Very good" },
  { value: "3", label: "3 - Good" },
  { value: "2", label: "2 - Fair" },
  { value: "1", label: "1 - Poor" },
];

const RENTAL_STATUS_PRIORITY = {
  active: 0,
  approved: 1,
  pending: 2,
  overdue: 3,
  completed: 4,
};

function getSupportedRentalPeriods(product) {
  return RENTAL_PERIOD_OPTIONS.filter(
    ({ priceField }) =>
      product?.[priceField] !== null &&
      product?.[priceField] !== undefined &&
      product?.[priceField] !== "",
  );
}

function createReviewDraft(review) {
  return {
    rating: String(review?.rating ?? 5),
    comment: review?.comment || "",
  };
}

function mapReviewToRentalReview(review) {
  if (!review) return null;

  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    ownerReply: review.ownerReply,
    ownerReplyAt: review.ownerReplyAt,
    isVisible: review.isVisible,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

function mapReviewToProductReview(review) {
  if (!review) return null;

  return {
    id: review.id,
    rentalId: review.rentalId,
    reviewerId: review.reviewerId,
    rating: review.rating,
    comment: review.comment,
    ownerReply: review.ownerReply,
    ownerReplyAt: review.ownerReplyAt,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    reviewer: review.reviewer,
  };
}

function sortReviewsByNewest(reviews) {
  return [...reviews].sort(
    (left, right) =>
      new Date(right.createdAt || 0) - new Date(left.createdAt || 0),
  );
}

function getExistingProductRental(rentals) {
  const visibleStatuses = new Set(["pending", "approved", "active", "overdue"]);
  const relevantRentals = (rentals || []).filter((rental) =>
    visibleStatuses.has(rental.status),
  );

  if (!relevantRentals.length) {
    return null;
  }

  return [...relevantRentals].sort((left, right) => {
    const leftPriority = RENTAL_STATUS_PRIORITY[left.status] ?? 99;
    const rightPriority = RENTAL_STATUS_PRIORITY[right.status] ?? 99;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return (
      new Date(right.updatedAt || right.createdAt || 0) -
      new Date(left.updatedAt || left.createdAt || 0)
    );
  })[0];
}

function formatRentalStatusLabel(status) {
  return String(status || "rental")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function getChatCounterpart(chatState, currentUserId) {
  if (chatState.threadType === "product") {
    const conversation = chatState.conversation;
    if (!conversation) {
      return null;
    }

    return conversation.ownerId === currentUserId
      ? conversation.participant
      : conversation.owner;
  }

  if (!chatState.rental) {
    return null;
  }

  return chatState.rental.ownerId === currentUserId
    ? chatState.rental.renter
    : chatState.rental.owner;
}

function getChatThreadSummary(chatState, messageCount) {
  const summary =
    chatState.threadType === "product"
      ? chatState.conversation?.chat
      : chatState.rental?.chat;

  if (!summary?.hasMessages) {
    return chatState.threadType === "product"
      ? "Ask about availability, pickup, condition, and rental terms here."
      : "Conversation ready for scheduling, pickup details, and follow-up.";
  }

  const lastUpdatedLabel = formatChatTimestamp(summary.lastMessageAt);
  const messageLabel = `${messageCount} message${messageCount === 1 ? "" : "s"}`;

  return lastUpdatedLabel
    ? `${messageLabel} | Last update ${lastUpdatedLabel}`
    : messageLabel;
}

function getChatThreadBadgeLabel(chatState) {
  return chatState.threadType === "product"
    ? "Listing inquiry"
    : formatRentalStatusLabel(chatState.rental?.status || "rental");
}

function getChatThreadEyebrow(chatState) {
  return chatState.threadType === "product" ? "Product chat" : "Rental chat";
}

function getChatThreadTitle(chatState) {
  return chatState.threadType === "product"
    ? chatState.conversation?.product?.title || "Product chat"
    : chatState.rental?.product?.title || "Rental chat";
}

function getChatComposerPlaceholder(chatState, counterpart) {
  if (counterpart?.name) {
    return `Write a message to ${counterpart.name}...`;
  }

  return chatState.threadType === "product"
    ? "Write a message about this listing..."
    : "Write a message to the other participant...";
}

function ChatButtonContent() {
  return (
    <>
      <svg
        className="btn__icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M6 7.5A3.5 3.5 0 0 1 9.5 4h5A3.5 3.5 0 0 1 18 7.5v5A3.5 3.5 0 0 1 14.5 16H11l-4 4v-4.2A3.5 3.5 0 0 1 6 13V7.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 9.5h5M9.5 12.5h3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <span>Chat</span>
    </>
  );
}

function getBookingStatusHeadline(rental) {
  switch (rental?.status) {
    case "pending":
      return "Your rental request is waiting for the owner response.";
    case "approved":
      return "Your rental request has already been approved.";
    case "active":
      return "You are currently renting this listing.";
    case "overdue":
      return "This rental is overdue and still open.";
    case "completed":
      return "This rental is completed.";
    case "cancelled":
      return "This rental was cancelled.";
    case "rejected":
      return "This rental request was rejected.";
    default:
      return "This booking is linked to the current listing.";
  }
}

function ConversationDialog({
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
  }, [
    chatState.conversationId,
    chatState.loading,
    chatState.open,
    chatState.rentalId,
  ]);

  if (!chatState.open) {
    return null;
  }

  const counterpart = getChatCounterpart(chatState, currentUserId);
  const productTitle = getChatThreadTitle(chatState);
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
        aria-labelledby="productDetailConversationTitle"
      >
        <div className="rental-chat-dialog__header">
          <div className="rental-chat-dialog__header-copy">
            <p className="rental-chat-dialog__eyebrow">
              {getChatThreadEyebrow(chatState)}
            </p>
            <h3 id="productDetailConversationTitle">{productTitle}</h3>
            <p className="compact-text">
              {counterpart?.name
                ? `Chat with ${counterpart.name}`
                : "Chat with the other participant"}
            </p>
            <div className="rental-chat-dialog__thread-meta">
              {/* <span className="tag tag--light">
                {getChatThreadBadgeLabel(chatState)}
              </span> */}
              {/* <span className="compact-text">
                {getChatThreadSummary(chatState, messageCount)}
              </span> */}
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
                    {/* <strong>
                      {isOwnMessage
                        ? "You"
                        : message.sender?.name || "Participant"}
                    </strong> */}
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
          <label htmlFor="productDetailConversationMessage">Message</label>
          <textarea
            id="productDetailConversationMessage"
            ref={composerRef}
            className="textarea rental-chat-dialog__textarea"
            rows="1"
            maxLength="4000"
            placeholder={getChatComposerPlaceholder(chatState, counterpart)}
            value={chatState.draft}
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <div className="rental-chat-dialog__composer-actions">
            {/* <p className="compact-text">
              {chatState.draft.length}/4000 characters | Press{" "}
              <strong>Ctrl + Enter</strong> to send quickly.
            </p> */}
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
const CURSOR_CONFIG = {
  "product-details": {
    enabled: false,
    color: "#000000",
    targetSelector: "body",
    activeSelectors: [],
    deactiveSelectors: [],
  },
};

export function ProductDetailsPage({ page }) {
  const { user, loading, logout } = useSession();
  const { dialog, setDialog, closeDialog, confirmDialog, promptDialog } =
    useActionDialog();
  const [pageMessage, showPageMessage] = useMessageState("");
  const [bookingMessage, showBookingMessage] = useMessageState("");
  const [reviewMessage, showReviewMessage] = useMessageState("");
  const [product, setProduct] = useState(null);
  const [mainImage, setMainImage] = useState("");
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [similarProducts, setSimilarProducts] = useState([]);
  const [reviewRentals, setReviewRentals] = useState([]);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [currentProductRental, setCurrentProductRental] = useState(null);
  const [pendingBookingRequest, setPendingBookingRequest] = useState(null);
  const [selectedBookingRental, setSelectedBookingRental] = useState(null);
  const [pricingPreview, setPricingPreview] = useState(null);
  const [ownerReply, setOwnerReply] = useState("");
  const [bookingForm, setBookingForm] = useState({
    startDate: "",
    endDate: "",
    rentalPeriodType: "daily",
    renterNotes: "",
  });
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [moderatingAction, setModeratingAction] = useState("");
  const [submittingOwnerReply, setSubmittingOwnerReply] = useState(false);
  const [updatingAdminStatus, setUpdatingAdminStatus] = useState("");
  const [updatingOwnerStatus, setUpdatingOwnerStatus] = useState("");
  const [deletingOwnerListing, setDeletingOwnerListing] = useState(false);
  const [reviewActionKey, setReviewActionKey] = useState("");
  const [chatState, setChatState] = useState({
    open: false,
    threadType: "",
    rentalId: "",
    rental: null,
    conversationId: "",
    conversation: null,
    messages: [],
    draft: "",
    loading: false,
    sending: false,
    error: "",
  });

  const productId = getProductId();
  const requestedRentalId = getRequestedRentalId();
  const requestedConversationId = getRequestedConversationId();
  const shouldAutoOpenChat = shouldAutoOpenRequestedChat();
  const requestedNotificationId = getRequestedNotificationId();
  const chatRequestRef = useRef(0);
  const autoOpenChatRef = useRef(false);
  const autoReadNotificationRef = useRef(false);
  const isAdmin = user?.role === "admin";
  const supportedRentalPeriods = getSupportedRentalPeriods(product);
  const hasSupportedRentalPeriod = supportedRentalPeriods.some(
    (option) => option.value === bookingForm.rentalPeriodType,
  );

  useEffect(() => {
    document.title = "Product Details | AI Rent";
  }, []);

  useEffect(() => {
    if (!isImageViewerOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsImageViewerOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isImageViewerOpen]);

  useEffect(() => {
    let active = true;

    async function loadPage() {
      if (loading) return;

      if (!productId) {
        showPageMessage("Product id is missing from the URL.", "error");
        return;
      }

      const result = await fetchApi(`/api/v1/products/${productId}`, {
        auth: Boolean(user),
      });
      if (!active) return;

      if (!result.ok || !result.data?.success) {
        showPageMessage(
          result.data?.message || "Unable to load product details.",
          "error",
        );
        return;
      }

      const nextProduct = result.data.data;
      const isOwnerViewingProduct = Boolean(
        user && user.id === nextProduct.owner?.id,
      );
      setProduct(nextProduct);
      setMainImage(getPrimaryImage(nextProduct));
      setOwnerReply(nextProduct.ownerReviewReply || "");
      document.title = `${nextProduct.title} | AI Rent`;

      if (user && !isAdmin && !isOwnerViewingProduct) {
        const nextWishlistIds = await fetchWishlistIds();
        if (!active) return;
        setWishlistIds(nextWishlistIds);
        setIsSaved(nextWishlistIds.has(productId));
      } else {
        setWishlistIds(new Set());
        setIsSaved(false);
      }

      if (!isAdmin && !isOwnerViewingProduct) {
        const similarResult = await fetchApi(
          `/api/v1/recommendations/similar/${productId}?limit=4`,
        );
        if (!active) return;

        setSimilarProducts(similarResult.data?.data?.similarProducts || []);
      } else {
        setSimilarProducts([]);
      }

      if (user && !isAdmin && !isOwnerViewingProduct) {
        trackBehavior({
          actionType: "view",
          productId,
          categoryId: nextProduct.category?.id,
          metadata: { page: "product-details" },
        });
      }
    }

    loadPage();

    return () => {
      active = false;
    };
  }, [isAdmin, loading, productId, showPageMessage, user]);

  useEffect(() => {
    let active = true;

    async function loadReviewRentals() {
      if (loading || !user || !productId || isAdmin) {
        setReviewRentals([]);
        return;
      }

      if (product?.owner?.id === user.id) {
        setReviewRentals([]);
        return;
      }

      const query = buildQuery({
        status: "completed",
        productId,
        limit: 20,
      });
      const result = await fetchApi(`/api/v1/rentals/my-bookings?${query}`, {
        auth: true,
      });

      if (!active) return;

      if (!result.ok || !result.data?.success) {
        setReviewRentals([]);
        return;
      }

      setReviewRentals(result.data.data?.rentals || []);
    }

    loadReviewRentals();

    return () => {
      active = false;
    };
  }, [isAdmin, loading, product?.owner?.id, productId, user]);

  useEffect(() => {
    let active = true;

    async function loadProductBookings() {
      if (loading || !user || !productId || isAdmin) {
        setCurrentProductRental(null);
        setPendingBookingRequest(null);
        setSelectedBookingRental(null);
        return;
      }

      if (product?.owner?.id === user.id) {
        setCurrentProductRental(null);
        setPendingBookingRequest(null);
        setSelectedBookingRental(null);
        return;
      }

      const query = buildQuery({
        productId,
        limit: 20,
      });
      const result = await fetchApi(`/api/v1/rentals/my-bookings?${query}`, {
        auth: true,
      });

      if (!active) return;

      if (!result.ok || !result.data?.success) {
        setCurrentProductRental(null);
        setPendingBookingRequest(null);
        setSelectedBookingRental(null);
        return;
      }

      const nextRentals = result.data.data?.rentals || [];
      const nextPendingRental = nextRentals.find(
        (rental) =>
          rental.status === "pending" &&
          new Date(rental.endDate || rental.createdAt || 0) > new Date(),
      );
      const nextSelectedRental = requestedRentalId
        ? nextRentals.find((rental) => rental.id === requestedRentalId) || null
        : null;

      setCurrentProductRental(getExistingProductRental(nextRentals));
      setPendingBookingRequest(nextPendingRental || null);
      setSelectedBookingRental(
        nextSelectedRental ||
          getExistingProductRental(nextRentals) ||
          nextPendingRental ||
          null,
      );
    }

    loadProductBookings();

    return () => {
      active = false;
    };
  }, [
    isAdmin,
    loading,
    product?.owner?.id,
    productId,
    requestedRentalId,
    user,
  ]);

  useEffect(() => {
    if (
      !product ||
      !supportedRentalPeriods.length ||
      hasSupportedRentalPeriod
    ) {
      return;
    }

    setBookingForm((previous) => ({
      ...previous,
      rentalPeriodType: supportedRentalPeriods[0].value,
    }));
    setPricingPreview(null);
  }, [hasSupportedRentalPeriod, product, supportedRentalPeriods]);

  useEffect(() => {
    if (!reviewRentals.length) {
      setReviewDrafts({});
      return;
    }

    setReviewDrafts(
      Object.fromEntries(
        reviewRentals.map((rental) => [
          rental.id,
          createReviewDraft(rental.review),
        ]),
      ),
    );
  }, [reviewRentals]);

  useEffect(() => {
    const reviews = product?.reviews || [];
    if (!reviews.length) {
      setReplyDrafts({});
      return;
    }

    setReplyDrafts(
      Object.fromEntries(
        reviews.map((review) => [review.id, review.ownerReply || ""]),
      ),
    );
  }, [product?.reviews]);

  useEffect(() => {
    if (
      !requestedNotificationId ||
      !user ||
      loading ||
      autoReadNotificationRef.current
    ) {
      return;
    }

    autoReadNotificationRef.current = true;
    fetchApi(`/api/v1/notifications/${requestedNotificationId}/read`, {
      method: "PUT",
      auth: true,
    })
      .then(() => {
        publishNotificationsChanged();
      })
      .catch((error) => {
        console.error(
          "markNotificationAsRead from product details error:",
          error,
        );
      });
  }, [loading, requestedNotificationId, user]);

  function syncBookingRentalState(nextRental) {
    if (!nextRental?.id) {
      return;
    }

    setSelectedBookingRental((previous) =>
      !previous || previous.id === nextRental.id ? nextRental : previous,
    );
    setCurrentProductRental((previous) =>
      previous?.id === nextRental.id ? nextRental : previous,
    );
    setPendingBookingRequest((previous) =>
      previous?.id === nextRental.id ? nextRental : previous,
    );
  }

  async function loadRentalChat(rentalId, options = {}) {
    if (!rentalId) {
      return;
    }

    const { silent = false } = options;
    const nextRequestId = chatRequestRef.current + 1;
    chatRequestRef.current = nextRequestId;
    const fallbackRental =
      (selectedBookingRental?.id === rentalId
        ? selectedBookingRental
        : currentProductRental?.id === rentalId
          ? currentProductRental
          : pendingBookingRequest?.id === rentalId
            ? pendingBookingRequest
            : null) || chatState.rental;

    setChatState((previous) => ({
      ...previous,
      open: true,
      threadType: "rental",
      rentalId,
      rental:
        previous.threadType === "rental" &&
        previous.rentalId === rentalId &&
        previous.rental
          ? previous.rental
          : fallbackRental,
      conversationId: "",
      conversation: null,
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
        previous.threadType === "rental" && previous.rentalId === rentalId
          ? {
              ...previous,
              loading: false,
              error:
                result.data?.message ||
                "Unable to load the rental chat right now.",
            }
          : previous,
      );
      return;
    }

    const nextRental = result.data?.data?.rental || fallbackRental;
    if (nextRental) {
      syncBookingRentalState(nextRental);
    }

    setChatState((previous) =>
      previous.threadType === "rental" && previous.rentalId === rentalId
        ? {
            ...previous,
            open: true,
            threadType: "rental",
            rentalId,
            rental: nextRental || previous.rental,
            messages: result.data?.data?.messages || [],
            loading: false,
            error: "",
          }
        : previous,
    );
    publishNotificationsChanged();
  }

  async function loadProductChat(options = {}) {
    if (!productId || !user) {
      return;
    }

    const { conversationId = "", silent = false } = options;
    const nextRequestId = chatRequestRef.current + 1;
    chatRequestRef.current = nextRequestId;
    const nextConversationId = conversationId || chatState.conversationId || "";
    const query = buildQuery({
      conversationId: nextConversationId || undefined,
    });
    const fallbackConversation =
      chatState.threadType === "product" &&
      (!nextConversationId || chatState.conversationId === nextConversationId)
        ? chatState.conversation
        : null;

    setChatState((previous) => ({
      ...previous,
      open: true,
      threadType: "product",
      rentalId: "",
      rental: null,
      conversationId: nextConversationId,
      conversation:
        previous.threadType === "product" &&
        previous.conversation &&
        previous.conversationId === nextConversationId
          ? previous.conversation
          : fallbackConversation,
      loading: silent ? previous.loading : true,
      error: "",
    }));

    const result = await fetchApi(
      query
        ? `/api/v1/products/${productId}/chat?${query}`
        : `/api/v1/products/${productId}/chat`,
      {
        auth: true,
      },
    );

    if (chatRequestRef.current !== nextRequestId) {
      return;
    }

    if (!result.ok || !result.data?.success) {
      setChatState((previous) =>
        previous.threadType === "product" &&
        previous.conversationId === nextConversationId
          ? {
              ...previous,
              loading: false,
              error:
                result.data?.message ||
                "Unable to load the product chat right now.",
            }
          : previous,
      );
      return;
    }

    const nextConversation =
      result.data?.data?.conversation || fallbackConversation;

    setChatState((previous) =>
      previous.threadType === "product"
        ? {
            ...previous,
            open: true,
            threadType: "product",
            conversationId: nextConversation?.id || nextConversationId,
            conversation: nextConversation || previous.conversation,
            messages: result.data?.data?.messages || [],
            loading: false,
            error: "",
          }
        : previous,
    );
    publishNotificationsChanged();
  }

  function closeChat() {
    chatRequestRef.current += 1;
    setChatState({
      open: false,
      threadType: "",
      rentalId: "",
      rental: null,
      conversationId: "",
      conversation: null,
      messages: [],
      draft: "",
      loading: false,
      sending: false,
      error: "",
    });
  }

  async function sendChatMessage() {
    if (!chatState.draft.trim() || !chatState.threadType || chatState.sending) {
      return;
    }

    const nextMessage = chatState.draft.trim();

    setChatState((previous) => ({
      ...previous,
      sending: true,
      error: "",
    }));

    if (chatState.threadType === "product") {
      const result = await fetchApi(
        `/api/v1/products/${productId}/chat/messages`,
        {
          method: "POST",
          auth: true,
          body: {
            message: nextMessage,
            ...(chatState.conversationId
              ? {
                  conversationId: chatState.conversationId,
                }
              : {}),
          },
        },
      );

      if (!result.ok || !result.data?.success) {
        setChatState((previous) =>
          previous.threadType === "product"
            ? {
                ...previous,
                sending: false,
                error:
                  result.data?.message ||
                  "Unable to send your message right now.",
              }
            : previous,
        );
        return;
      }

      const nextConversation =
        result.data?.data?.conversation || chatState.conversation;

      setChatState((previous) =>
        previous.threadType === "product"
          ? {
              ...previous,
              conversationId: nextConversation?.id || previous.conversationId,
              conversation: nextConversation || previous.conversation,
              messages: result.data?.data?.message
                ? [...previous.messages, result.data.data.message]
                : previous.messages,
              draft: "",
              sending: false,
              error: "",
            }
          : previous,
      );
      publishNotificationsChanged();
      return;
    }

    if (!chatState.rentalId) {
      return;
    }

    const rentalId = chatState.rentalId;
    const result = await fetchApi(`/api/v1/rentals/${rentalId}/messages`, {
      method: "POST",
      auth: true,
      body: {
        message: nextMessage,
      },
    });

    if (!result.ok || !result.data?.success) {
      setChatState((previous) =>
        previous.threadType === "rental" && previous.rentalId === rentalId
          ? {
              ...previous,
              sending: false,
              error:
                result.data?.message ||
                "Unable to send your message right now.",
            }
          : previous,
      );
      return;
    }

    const nextRental = result.data?.data?.rental || chatState.rental;
    if (nextRental) {
      syncBookingRentalState(nextRental);
    }

    setChatState((previous) =>
      previous.threadType === "rental" && previous.rentalId === rentalId
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
    publishNotificationsChanged();
  }

  useEffect(() => {
    if (!chatState.open || !chatState.threadType) {
      return undefined;
    }

    if (chatState.threadType === "rental" && !chatState.rentalId) {
      return undefined;
    }

    if (chatState.threadType === "product" && !chatState.conversationId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (chatState.threadType === "product") {
        loadProductChat({
          conversationId: chatState.conversationId,
          silent: true,
        });
        return;
      }

      loadRentalChat(chatState.rentalId, {
        silent: true,
      });
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    chatState.conversationId,
    chatState.open,
    chatState.rentalId,
    chatState.threadType,
  ]);

  useEffect(() => {
    if (!shouldAutoOpenChat || !user || loading || autoOpenChatRef.current) {
      return;
    }

    if (requestedRentalId) {
      autoOpenChatRef.current = true;
      loadRentalChat(requestedRentalId);
      return;
    }

    if (requestedConversationId) {
      autoOpenChatRef.current = true;
      loadProductChat({
        conversationId: requestedConversationId,
      });
    }
  }, [
    loading,
    requestedConversationId,
    requestedRentalId,
    shouldAutoOpenChat,
    user,
  ]);

  function updateReviewDraft(rentalId, field, value) {
    setReviewDrafts((previous) => ({
      ...previous,
      [rentalId]: {
        ...(previous[rentalId] || createReviewDraft(null)),
        [field]: value,
      },
    }));
  }

  function updateReplyDraft(reviewId, value) {
    setReplyDrafts((previous) => ({
      ...previous,
      [reviewId]: value,
    }));
  }

  function updateLocalProductReviews(nextReview, mode = "upsert") {
    setProduct((previous) => {
      if (!previous) return previous;

      const currentReviews = Array.isArray(previous.reviews)
        ? previous.reviews
        : [];
      let nextReviews = currentReviews;

      if (mode === "delete") {
        nextReviews = currentReviews.filter(
          (review) => review.id !== nextReview.id,
        );
      } else {
        const normalizedReview = mapReviewToProductReview(nextReview);
        if (!normalizedReview) {
          return previous;
        }

        const existingIndex = currentReviews.findIndex(
          (review) => review.id === normalizedReview.id,
        );

        if (existingIndex >= 0) {
          nextReviews = currentReviews.map((review) =>
            review.id === normalizedReview.id ? normalizedReview : review,
          );
        } else {
          nextReviews = [normalizedReview, ...currentReviews];
        }
      }

      return {
        ...previous,
        avgRating: nextReview?.product?.avgRating ?? previous.avgRating,
        totalReviews:
          nextReview?.product?.totalReviews ?? previous.totalReviews,
        reviews: sortReviewsByNewest(nextReviews),
      };
    });
  }

  async function handleReviewSubmit(rental) {
    if (!user) {
      redirectToLogin();
      return;
    }

    if (!product || isAdmin || isOwner) {
      return;
    }

    const draft = reviewDrafts[rental.id] || createReviewDraft(rental.review);
    const payload = {
      rating: Number(draft.rating),
      comment: draft.comment.trim() || null,
    };
    const isUpdating = Boolean(rental.review?.id);

    setReviewActionKey(`${isUpdating ? "update" : "create"}:${rental.id}`);

    const result = await fetchApi(
      isUpdating ? `/api/v1/reviews/${rental.review.id}` : "/api/v1/reviews",
      {
        method: isUpdating ? "PUT" : "POST",
        auth: true,
        body: isUpdating
          ? payload
          : {
              rentalId: rental.id,
              ...payload,
            },
      },
    );

    setReviewActionKey("");
    showReviewMessage(
      result.data?.message ||
        (isUpdating ? "Review updated." : "Review submitted."),
      result.ok ? "success" : "error",
    );

    if (!result.ok || !result.data?.success || !result.data?.data) {
      return;
    }

    const nextReview = result.data.data;
    setReviewRentals((previous) =>
      previous.map((item) =>
        item.id === rental.id
          ? {
              ...item,
              review: mapReviewToRentalReview(nextReview),
            }
          : item,
      ),
    );
    setReviewDrafts((previous) => ({
      ...previous,
      [rental.id]: createReviewDraft(nextReview),
    }));
    updateLocalProductReviews(nextReview);
  }

  async function handleReviewDelete(rental) {
    if (!rental.review?.id) {
      return;
    }

    const shouldDelete = await confirmDialog({
      title: "Delete this review?",
      message: "This review and its rating will be removed from the product.",
      confirmLabel: "Delete review",
      cancelLabel: "Keep review",
      tone: "danger",
    });

    if (!shouldDelete) {
      return;
    }

    setReviewActionKey(`delete:${rental.id}`);

    const result = await fetchApi(`/api/v1/reviews/${rental.review.id}`, {
      method: "DELETE",
      auth: true,
    });

    setReviewActionKey("");
    showReviewMessage(
      result.data?.message || "Review deleted.",
      result.ok ? "success" : "error",
    );

    if (!result.ok || !result.data?.success) {
      return;
    }

    setReviewRentals((previous) =>
      previous.map((item) =>
        item.id === rental.id
          ? {
              ...item,
              review: null,
            }
          : item,
      ),
    );
    setReviewDrafts((previous) => ({
      ...previous,
      [rental.id]: createReviewDraft(null),
    }));
    updateLocalProductReviews(
      result.data?.data || {
        id: rental.review.id,
      },
      "delete",
    );
  }

  async function handleReviewReplySubmit(review) {
    if (!product || !isOwner) {
      return;
    }

    const nextReply = (replyDrafts[review.id] || "").trim();
    if (!nextReply) {
      showReviewMessage(
        "Add a short reply before sending it to the renter.",
        "error",
      );
      return;
    }

    setReviewActionKey(`reply:${review.id}`);

    const result = await fetchApi(`/api/v1/reviews/${review.id}/reply`, {
      method: "PUT",
      auth: true,
      body: {
        ownerReply: nextReply,
      },
    });

    setReviewActionKey("");
    showReviewMessage(
      result.data?.message || "Reply saved.",
      result.ok ? "success" : "error",
    );

    if (!result.ok || !result.data?.success || !result.data?.data) {
      return;
    }

    const nextReview = result.data.data;
    setReplyDrafts((previous) => ({
      ...previous,
      [review.id]: nextReview.ownerReply || nextReply,
    }));
    updateLocalProductReviews(nextReview);
  }

  async function handleToggleWishlist(productIdValue, saved) {
    const result = await toggleWishlist(productIdValue, saved);
    if (!result.ok) return;

    setIsSaved(!saved);
    setWishlistIds((previous) => {
      const next = new Set(previous);
      if (saved) next.delete(productIdValue);
      else next.add(productIdValue);
      return next;
    });
  }

  async function handleSimilarWishlist(productIdValue, saved) {
    const result = await toggleWishlist(productIdValue, saved);
    if (!result.ok) return;

    setWishlistIds((previous) => {
      const next = new Set(previous);
      if (saved) next.delete(productIdValue);
      else next.add(productIdValue);
      return next;
    });
  }

  async function checkAvailability() {
    if (!product) return false;

    if (!supportedRentalPeriods.length) {
      setPricingPreview(null);
      showBookingMessage(
        "This listing does not have rental pricing set yet.",
        "error",
      );
      return false;
    }

    if (!bookingForm.startDate || !bookingForm.endDate) {
      showBookingMessage("Choose a start date and end date first.", "error");
      return false;
    }

    setPricingPreview(null);
    showBookingMessage("Checking availability...", "info");

    const query = buildQuery({
      startDate: new Date(bookingForm.startDate).toISOString(),
      endDate: new Date(bookingForm.endDate).toISOString(),
      rentalPeriodType: bookingForm.rentalPeriodType,
    });
    const result = await fetchApi(
      `/api/v1/rentals/${product.id}/availability?${query}`,
    );

    if (!result.ok || !result.data?.success) {
      setPricingPreview(null);
      showBookingMessage(
        result.data?.message || "Could not check availability.",
        "error",
      );
      return false;
    }

    const availability = result.data.data;
    if (availability.pricing?.error) {
      setPricingPreview(null);
      showBookingMessage(availability.pricing.error, "error");
      return false;
    }

    setPricingPreview(availability.pricing || null);

    if (availability.isAvailable) {
      showBookingMessage("This date range is available.", "success");
      return true;
    }

    showBookingMessage(
      availability.notBookableReason ||
        "The selected range is not available right now.",
      "error",
    );
    return false;
  }

  async function handleBookingSubmit(event) {
    event.preventDefault();

    if (!user) {
      redirectToLogin();
      return;
    }

    if (pendingBookingRequest) {
      showBookingMessage(
        "You already sent a rental request for this listing. Wait for the owner to approve or reject it before sending another one.",
        "info",
      );
      return;
    }

    const isAvailable = await checkAvailability();
    if (!isAvailable) return;

    setSubmittingRequest(true);

    const result = await fetchApi("/api/v1/rentals", {
      method: "POST",
      auth: true,
      body: {
        productId: product.id,
        startDate: new Date(bookingForm.startDate).toISOString(),
        endDate: new Date(bookingForm.endDate).toISOString(),
        rentalPeriodType: bookingForm.rentalPeriodType,
        renterNotes: bookingForm.renterNotes.trim(),
      },
    });

    setSubmittingRequest(false);

    if (!result.ok || !result.data?.success) {
      if (result.data?.data?.rental?.status === "pending") {
        setCurrentProductRental(result.data.data.rental);
        setPendingBookingRequest(result.data.data.rental);
      }
      showBookingMessage(
        result.data?.message || "Unable to submit the rental request.",
        "error",
      );
      return;
    }

    showBookingMessage(
      result.data.message || "Rental request created successfully.",
      "success",
    );
    setCurrentProductRental(result.data?.data || null);
    setPendingBookingRequest(result.data?.data || null);

    trackBehavior({
      actionType: "rent",
      productId: product.id,
      metadata: {
        rentalPeriodType: bookingForm.rentalPeriodType,
      },
    });
  }

  async function handleModerateProduct(action) {
    if (!product || !isAdmin) {
      return;
    }

    const reasonInput = await promptDialog({
      title: action === "approve" ? "Approve listing" : "Reject listing",
      message:
        action === "approve"
          ? "Add an optional note for this approval."
          : "Add a note for the owner so they know what needs to be fixed.",
      fieldLabel: "Review note",
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

    const trimmedReason = reasonInput.trim();
    if (action === "reject" && !trimmedReason) {
      showPageMessage(
        "Add a note for the owner so they know what needs to be fixed.",
        "error",
      );
      return;
    }

    const endpoint =
      action === "approve"
        ? `/api/v1/admin/products/${product.id}/approve`
        : `/api/v1/admin/products/${product.id}/reject`;

    setModeratingAction(action);

    const result = await fetchApi(endpoint, {
      method: "PUT",
      auth: true,
      body: {
        reason: trimmedReason || undefined,
      },
    });

    setModeratingAction("");

    showPageMessage(
      result.data?.message || "Listing updated.",
      result.ok ? "success" : "error",
    );

    if (!result.ok || !result.data?.success) {
      return;
    }

    const updatedProduct = result.data.data;
    setProduct((previous) =>
      previous
        ? {
            ...previous,
            status: updatedProduct?.status ?? previous.status,
            isApproved: updatedProduct?.isApproved ?? previous.isApproved,
            adminReviewNote:
              updatedProduct?.adminReviewNote ?? previous.adminReviewNote,
            ownerReviewReply:
              updatedProduct?.ownerReviewReply ?? previous.ownerReviewReply,
            adminReviewedAt:
              updatedProduct?.adminReviewedAt ?? previous.adminReviewedAt,
            ownerRepliedAt:
              updatedProduct?.ownerRepliedAt ?? previous.ownerRepliedAt,
            updatedAt: updatedProduct?.updatedAt ?? previous.updatedAt,
          }
        : previous,
    );
  }

  async function handleOwnerReplySubmit() {
    if (!product || !isOwner) {
      return;
    }

    const nextReply = ownerReply.trim();
    if (!nextReply) {
      showPageMessage(
        "Add a short reply before sending it to the admin team.",
        "error",
      );
      return;
    }

    setSubmittingOwnerReply(true);

    const result = await fetchApi(
      `/api/v1/products/${product.id}/moderation-reply`,
      {
        method: "POST",
        auth: true,
        body: {
          reply: nextReply,
        },
      },
    );

    setSubmittingOwnerReply(false);

    showPageMessage(
      result.data?.message || "Moderation reply updated.",
      result.ok ? "success" : "error",
    );

    if (!result.ok || !result.data?.success) {
      return;
    }

    const updatedProduct = result.data.data;
    setProduct((previous) =>
      previous
        ? {
            ...previous,
            status: updatedProduct?.status ?? previous.status,
            isApproved: updatedProduct?.isApproved ?? previous.isApproved,
            adminReviewNote:
              updatedProduct?.adminReviewNote ?? previous.adminReviewNote,
            ownerReviewReply:
              updatedProduct?.ownerReviewReply ?? previous.ownerReviewReply,
            adminReviewedAt:
              updatedProduct?.adminReviewedAt ?? previous.adminReviewedAt,
            ownerRepliedAt:
              updatedProduct?.ownerRepliedAt ?? previous.ownerRepliedAt,
            updatedAt: updatedProduct?.updatedAt ?? previous.updatedAt,
          }
        : previous,
    );
    setOwnerReply(updatedProduct?.ownerReviewReply || nextReply);
  }

  async function handleAdminStatusChange(nextStatus) {
    if (!product || !isAdmin) {
      return;
    }

    setUpdatingAdminStatus(nextStatus);

    const result = await fetchApi(`/api/v1/products/${product.id}/status`, {
      method: "PUT",
      auth: true,
      body: {
        status: nextStatus,
      },
    });

    setUpdatingAdminStatus("");

    showPageMessage(
      result.data?.message || "Listing updated.",
      result.ok ? "success" : "error",
    );

    if (!result.ok || !result.data?.success) {
      return;
    }

    const updatedProduct = result.data.data;
    setProduct((previous) =>
      previous
        ? {
            ...previous,
            status: updatedProduct?.status ?? previous.status,
            isApproved: updatedProduct?.isApproved ?? previous.isApproved,
            adminReviewNote:
              updatedProduct?.adminReviewNote ?? previous.adminReviewNote,
            ownerReviewReply:
              updatedProduct?.ownerReviewReply ?? previous.ownerReviewReply,
            adminReviewedAt:
              updatedProduct?.adminReviewedAt ?? previous.adminReviewedAt,
            ownerRepliedAt:
              updatedProduct?.ownerRepliedAt ?? previous.ownerRepliedAt,
            updatedAt: updatedProduct?.updatedAt ?? previous.updatedAt,
          }
        : previous,
    );
  }

  async function handleOwnerStatusChange(nextStatus) {
    if (!product || !isOwner) {
      return;
    }

    setUpdatingOwnerStatus(nextStatus);
    const result = await fetchApi(`/api/v1/products/${product.id}/status`, {
      method: "PUT",
      auth: true,
      body: {
        status: nextStatus,
      },
    });

    setUpdatingOwnerStatus("");

    showPageMessage(
      result.data?.message || "Listing updated.",
      result.ok ? "success" : "error",
    );

    if (!result.ok || !result.data?.success) {
      return;
    }

    const updatedProduct = result.data.data;
    setProduct((previous) =>
      previous
        ? {
            ...previous,
            status: updatedProduct?.status ?? previous.status,
            isApproved: updatedProduct?.isApproved ?? previous.isApproved,
            adminReviewNote:
              updatedProduct?.adminReviewNote ?? previous.adminReviewNote,
            ownerReviewReply:
              updatedProduct?.ownerReviewReply ?? previous.ownerReviewReply,
            adminReviewedAt:
              updatedProduct?.adminReviewedAt ?? previous.adminReviewedAt,
            ownerRepliedAt:
              updatedProduct?.ownerRepliedAt ?? previous.ownerRepliedAt,
            updatedAt: updatedProduct?.updatedAt ?? previous.updatedAt,
          }
        : previous,
    );
  }

  async function handleOwnerDeleteProduct() {
    if (!product || !isOwner) {
      return;
    }

    const confirmed = await confirmDialog({
      title: "Delete this listing?",
      message:
        "This listing will be removed permanently if there are no rental records attached to it.",
      confirmLabel: "Delete listing",
      cancelLabel: "Keep listing",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    setDeletingOwnerListing(true);

    const result = await fetchApi(`/api/v1/products/${product.id}`, {
      method: "DELETE",
      auth: true,
    });

    setDeletingOwnerListing(false);

    showPageMessage(
      result.data?.message || "Listing updated.",
      result.ok ? "success" : "error",
    );

    if (!result.ok) {
      return;
    }

    window.location.href = "/html/my-listings.html";
  }

  const isOwner = Boolean(user && product && user.id === product.owner?.id);
  const needsModeration = Boolean(
    product && (!product.isApproved || product.status === "under_review"),
  );
  const canOwnerReplyToModeration = Boolean(
    isOwner && product && !product.isApproved && product.adminReviewNote,
  );
  const isPubliclyVisible = Boolean(
    product &&
    product.isApproved &&
    ["available", "rented", "unavailable"].includes(product.status),
  );
  const hasReviewAccess = Boolean(user && !isAdmin && !isOwner);
  const pendingReviewCount = reviewRentals.filter(
    (rental) => !rental.review,
  ).length;
  const productReviews = sortReviewsByNewest(product?.reviews || []);
  const hasPendingBookingRequest = Boolean(pendingBookingRequest?.id);
  const detailChatRental =
    selectedBookingRental || currentProductRental || pendingBookingRequest;
  const hasBookingContext = Boolean(detailChatRental?.id);
  const shouldPreferRequestedProductConversation = Boolean(
    requestedConversationId,
  );
  const canOpenDetailRentalChat = Boolean(
    user && !isAdmin && detailChatRental?.id,
  );
  const canOpenDetailProductChat = Boolean(
    product && !isAdmin && (!isOwner || requestedConversationId),
  );
  const canOpenDetailChat = shouldPreferRequestedProductConversation
    ? canOpenDetailProductChat
    : canOpenDetailRentalChat || canOpenDetailProductChat;
  const canAdminToggleListingVisibility = Boolean(
    isAdmin && product?.isApproved,
  );
  const canOwnerManageAvailability = Boolean(
    isOwner && product?.isApproved && product?.status !== "suspended",
  );
  const ownerRentalStatusLock = product?.availabilityLock || null;
  const isUnlistedApprovedListing = Boolean(
    product?.isApproved && product?.status === "suspended",
  );
  const ownerName = product?.owner?.name || "Unknown";
  const ownerProfileHref = getOwnerProfileHref(product?.owner?.id);
  const facts = product
    ? [
        ["City", product.city || "Not set"],
        ["Condition", product.condition || "Not set"],
        ["Deposit", formatMoney(product.securityDeposit)],
        [
          "Owner",
          ownerProfileHref ? (
            <a className="detail-fact__link" href={ownerProfileHref}>
              {ownerName}
            </a>
          ) : (
            ownerName
          ),
        ],
        ["Approval", getApprovalLabel(product)],
        [
          "Rating",
          product.totalReviews
            ? `${Number(product.avgRating || 0).toFixed(1)} / 5`
            : "No rating",
        ],
        [
          "Rental range",
          `${product.minRentalPeriod || 1} - ${product.maxRentalPeriod || 365}`,
        ],
      ]
    : [];

  function handleOpenDetailChat() {
    if (!canOpenDetailChat) {
      return;
    }

    if (!user) {
      redirectToLogin();
      return;
    }

    if (shouldPreferRequestedProductConversation && canOpenDetailProductChat) {
      loadProductChat({
        conversationId: requestedConversationId,
      });
      return;
    }

    if (canOpenDetailRentalChat && detailChatRental?.id) {
      loadRentalChat(detailChatRental.id);
      return;
    }

    if (canOpenDetailProductChat) {
      loadProductChat({
        conversationId: requestedConversationId || "",
      });
    }
  }

  const viewerImage = mainImage || (product ? getPrimaryImage(product) : "");

  return (
    <SiteLayout
      page={page}
      user={user}
      onLogout={logout}
      cursorConfig={CURSOR_CONFIG[page]}
    >
      <MessageText message={pageMessage} />

      {product ? (
        <section className="detail-layout">
          <article className="surface-panel detail-gallery">
            <button
              type="button"
              className="detail-gallery__main-button"
              onClick={() => setIsImageViewerOpen(true)}
              aria-label="Open larger image view"
            >
              <img
                className="detail-gallery__main"
                src={mainImage}
                alt={product.title}
              />
            </button>
            <p className="detail-gallery__hint">
              Click the image to view it larger.
            </p>
            <div className="detail-gallery__thumbs">
              {(product.images || []).map((image, index) => {
                const imageUrl =
                  image.imageUrl ||
                  image.thumbnailUrl ||
                  getPrimaryImage({ images: [image] });

                return (
                  <button
                    type="button"
                    key={`${imageUrl}-${index}`}
                    className={`thumb-button${mainImage === imageUrl ? " is-active" : ""}`}
                    onClick={() => setMainImage(imageUrl)}
                  >
                    <img src={imageUrl} alt={product.title} />
                  </button>
                );
              })}
            </div>
          </article>

          <article className="surface-panel detail-summary">
            <div className="detail-summary__meta">
              <span className="tag">{product.category?.name || "General"}</span>
              <span className="tag tag--light">
                {product.status || "available"}
              </span>
            </div>

            <h1>{product.title || "Untitled listing"}</h1>
            <p className="detail-price">{getPriceLabel(product)}</p>
            <p className="detail-description">
              {product.description || "No description available."}
            </p>

            <DetailFactGrid facts={facts} />

            <div className="detail-actions">
              {canOpenDetailChat ? (
                <button
                  type="button"
                  className="btn btn--primary btn--with-icon"
                  onClick={handleOpenDetailChat}
                >
                  <ChatButtonContent />
                </button>
              ) : null}
              {!isAdmin && !isOwner ? (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => handleToggleWishlist(product.id, isSaved)}
                >
                  {isSaved ? "Saved to Wishlist" : "Save to Wishlist"}
                </button>
              ) : null}
              {ownerProfileHref ? (
                <a className="btn btn--ghost" href={ownerProfileHref}>
                  Owner: {ownerName}
                </a>
              ) : (
                <span className="btn btn--ghost" aria-disabled="true">
                  Owner: {ownerName}
                </span>
              )}
            </div>
          </article>

          {isAdmin ? (
            <aside className="surface-panel booking-panel admin-moderation-panel">
              <SectionHeading
                eyebrow="Moderation"
                title="Review this listing"
                compact
              />

              <div className="stack-form">
                <div className="booking-preview admin-moderation-panel__status">
                  <strong>{getModerationStatusLabel(product)}</strong>
                  <span>Approval status: {getApprovalLabel(product)}</span>
                  <span>
                    Public visibility:{" "}
                    {isPubliclyVisible ? "Visible" : "Hidden from catalog"}
                  </span>
                  <span>Last updated: {formatDateTime(product.updatedAt)}</span>
                </div>

                <p className="detail-note">
                  Admin preview mode hides renter actions and lets you moderate
                  the listing directly from this page.
                </p>

                {product.adminReviewNote ? (
                  <div className="detail-thread">
                    <strong>Latest admin note</strong>
                    <p className="detail-note">{product.adminReviewNote}</p>
                    <span className="detail-thread__meta">
                      Sent{" "}
                      {formatDateTime(
                        product.adminReviewedAt || product.updatedAt,
                      )}
                    </span>
                  </div>
                ) : null}

                {product.ownerReviewReply ? (
                  <div className="detail-thread detail-thread--muted">
                    <strong>Owner reply</strong>
                    <p className="detail-note">{product.ownerReviewReply}</p>
                    <span className="detail-thread__meta">
                      Sent {formatDateTime(product.ownerRepliedAt)}
                    </span>
                  </div>
                ) : null}

                {needsModeration ? (
                  <div className="detail-actions detail-actions--stacked">
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => handleModerateProduct("approve")}
                      disabled={Boolean(moderatingAction)}
                    >
                      {moderatingAction === "approve"
                        ? "Approving..."
                        : "Approve Listing"}
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => handleModerateProduct("reject")}
                      disabled={Boolean(moderatingAction)}
                    >
                      {moderatingAction === "reject"
                        ? "Rejecting..."
                        : "Reject Listing"}
                    </button>
                  </div>
                ) : canAdminToggleListingVisibility ? (
                  <div className="detail-actions detail-actions--stacked">
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() =>
                        handleAdminStatusChange(
                          isUnlistedApprovedListing ? "available" : "suspended",
                        )
                      }
                      disabled={Boolean(updatingAdminStatus)}
                    >
                      {isUnlistedApprovedListing
                        ? updatingAdminStatus === "available"
                          ? "Relisting..."
                          : "Relist Listing"
                        : updatingAdminStatus === "suspended"
                          ? "Unlisting..."
                          : "Unlist Listing"}
                    </button>
                  </div>
                ) : (
                  <MessageText
                    message={{
                      text: "This listing is already approved and does not need moderation.",
                      type: "info",
                    }}
                  />
                )}
              </div>
            </aside>
          ) : isOwner ? (
            <aside className="surface-panel booking-panel owner-review-panel">
              <SectionHeading
                title={
                  canOwnerReplyToModeration ? "Fix and reply to admin" : null
                }
                compact
              />

              <div className="stack-form">
                <div className="booking-preview owner-review-panel__status">
                  <strong>{getOwnerReviewStatusLabel(product)}</strong>
                  <span>Approval status: {getApprovalLabel(product)}</span>
                  <span>
                    Last review update:{" "}
                    {formatDateTime(
                      product.adminReviewedAt || product.updatedAt,
                    )}
                  </span>
                  {product.ownerRepliedAt ? (
                    <span>
                      Your last reply: {formatDateTime(product.ownerRepliedAt)}
                    </span>
                  ) : null}
                </div>
                <div className="detail-actions detail-actions--stacked">
                  <a
                    className="btn btn--ghost"
                    href={`/html/my-listings.html?edit=${encodeURIComponent(product.id)}`}
                  >
                    Edit Listing
                  </a>
                  {canOwnerManageAvailability &&
                  product.status !== "available" ? (
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => handleOwnerStatusChange("available")}
                      disabled={
                        Boolean(updatingOwnerStatus) ||
                        Boolean(ownerRentalStatusLock)
                      }
                      title={ownerRentalStatusLock?.message || undefined}
                    >
                      {updatingOwnerStatus === "available"
                        ? "Setting available..."
                        : "Set Available"}
                    </button>
                  ) : null}
                  {canOwnerManageAvailability &&
                  product.status !== "unavailable" ? (
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => handleOwnerStatusChange("unavailable")}
                      disabled={
                        Boolean(updatingOwnerStatus) ||
                        Boolean(ownerRentalStatusLock)
                      }
                      title={ownerRentalStatusLock?.message || undefined}
                    >
                      {updatingOwnerStatus === "unavailable"
                        ? "Setting unavailable..."
                        : "Set Unavailable"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={handleOwnerDeleteProduct}
                    disabled={
                      deletingOwnerListing || Boolean(ownerRentalStatusLock)
                    }
                    title={ownerRentalStatusLock?.message || undefined}
                  >
                    {deletingOwnerListing
                      ? "Deleting listing..."
                      : "Delete Listing"}
                  </button>
                </div>
                {product.adminReviewNote ? (
                  <div className="detail-thread">
                    <strong>Admin note</strong>
                    <p className="detail-note">{product.adminReviewNote}</p>
                    <span className="detail-thread__meta">
                      Sent{" "}
                      {formatDateTime(
                        product.adminReviewedAt || product.updatedAt,
                      )}
                    </span>
                  </div>
                ) : null}
                {isOwner && ownerRentalStatusLock ? (
                  <p className="detail-note">
                    {getOwnerAvailabilityLockNote(ownerRentalStatusLock)}
                  </p>
                ) : null}
                {/* (
                <p className="detail-note">
                  This listing is in owner preview mode. If the admin team asks
                  for changes, the note will appear here so you can fix the
                  listing and send it back for review.
                </p>
                ) */}
                {product.ownerReviewReply ? (
                  <div className="detail-thread detail-thread--muted">
                    <strong>Your latest reply</strong>
                    <p className="detail-note">{product.ownerReviewReply}</p>
                    <span className="detail-thread__meta">
                      Sent {formatDateTime(product.ownerRepliedAt)}
                    </span>
                  </div>
                ) : null}
                {canOwnerReplyToModeration ? (
                  <>
                    <div className="field">
                      <label htmlFor="ownerModerationReply">
                        Reply to admin
                      </label>
                      <textarea
                        id="ownerModerationReply"
                        className="textarea"
                        rows="1"
                        placeholder="Explain what you changed so the admin team can review it quickly."
                        value={ownerReply}
                        onChange={(event) => setOwnerReply(event.target.value)}
                      />
                    </div>

                    <div className="detail-actions detail-actions--stacked">
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={handleOwnerReplySubmit}
                        disabled={submittingOwnerReply}
                      >
                        {submittingOwnerReply
                          ? "Sending reply..."
                          : "Reply and Send Back to Review"}
                      </button>
                    </div>
                  </>
                ) : (
                  <MessageText
                    message={{
                      text:
                        product.isApproved && isPubliclyVisible
                          ? null
                          : product.isApproved
                            ? "This listing is approved but currently hidden from the public catalog."
                            : "This listing is currently waiting for admin review.",
                      type: "info",
                    }}
                  />
                )}
              </div>
            </aside>
          ) : hasBookingContext ? (
            <aside className="surface-panel booking-panel">
              <SectionHeading title="Booking status" compact />

              <div className="stack-form">
                <div className="booking-preview owner-review-panel__status">
                  <strong>{getBookingStatusHeadline(detailChatRental)}</strong>
                  <span>
                    Status: {formatRentalStatusLabel(detailChatRental.status)}
                  </span>
                  <span>
                    Requested on: {formatDateTime(detailChatRental.createdAt)}
                  </span>
                  {detailChatRental.startDate ? (
                    <span>
                      Start: {formatDateTime(detailChatRental.startDate)}
                    </span>
                  ) : null}
                  {detailChatRental.endDate ? (
                    <span>End: {formatDateTime(detailChatRental.endDate)}</span>
                  ) : null}
                  {detailChatRental.actualReturnDate ? (
                    <span>
                      Finished at:{" "}
                      {formatDateTime(detailChatRental.actualReturnDate)}
                    </span>
                  ) : null}
                </div>

                <MessageText
                  message={{
                    text:
                      detailChatRental.status === "completed"
                        ? detailChatRental.review?.id
                          ? "Your review for this rental is already saved below."
                          : "You can leave your review for this rental in the ratings section below."
                        : ["cancelled", "rejected"].includes(
                              detailChatRental.status,
                            )
                          ? "Use the Chat button above if you still need to follow up with the owner."
                          : "Request controls are hidden here because you already have a booking for this listing. Use the Chat button above to keep the conversation going.",
                    type: "info",
                  }}
                />

                <div className="detail-actions detail-actions--stacked">
                  <a className="btn btn--secondary" href="/html/profile.html">
                    Open My Bookings
                  </a>
                </div>
              </div>
            </aside>
          ) : (
            <aside className="surface-panel booking-panel">
              <SectionHeading title="Request this listing" compact />

              <form className="stack-form" onSubmit={handleBookingSubmit}>
                <div className="field">
                  <label htmlFor="startDate">Start date</label>
                  <input
                    id="startDate"
                    type="datetime-local"
                    className="input"
                    value={bookingForm.startDate}
                    onChange={(event) =>
                      setBookingForm((previous) => ({
                        ...previous,
                        startDate: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="endDate">End date</label>
                  <input
                    id="endDate"
                    type="datetime-local"
                    className="input"
                    value={bookingForm.endDate}
                    onChange={(event) =>
                      setBookingForm((previous) => ({
                        ...previous,
                        endDate: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="rentalPeriodType">Rental period</label>
                  <select
                    id="rentalPeriodType"
                    className="input"
                    value={
                      supportedRentalPeriods.length
                        ? bookingForm.rentalPeriodType
                        : ""
                    }
                    disabled={!supportedRentalPeriods.length}
                    onChange={(event) =>
                      setBookingForm((previous) => ({
                        ...previous,
                        rentalPeriodType: event.target.value,
                      }))
                    }
                  >
                    {supportedRentalPeriods.length ? (
                      supportedRentalPeriods.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))
                    ) : (
                      <option value="">Pricing unavailable</option>
                    )}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="renterNotes">Notes</label>
                  <textarea
                    id="renterNotes"
                    className="textarea"
                    rows="2"
                    placeholder="Optional message to the owner"
                    value={bookingForm.renterNotes}
                    onChange={(event) =>
                      setBookingForm((previous) => ({
                        ...previous,
                        renterNotes: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="detail-actions detail-actions--stacked">
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => {
                      if (!user) {
                        redirectToLogin();
                        return;
                      }
                      checkAvailability();
                    }}
                    disabled={isOwner}
                  >
                    Check Availability
                  </button>
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={
                      isOwner || submittingRequest || hasPendingBookingRequest
                    }
                  >
                    {submittingRequest
                      ? "Sending request..."
                      : hasPendingBookingRequest
                        ? "Request Pending"
                        : "Send Rental Request"}
                  </button>
                </div>

                {pricingPreview ? (
                  <div className="booking-preview">
                    <strong>Pricing preview</strong>
                    <span>
                      Unit price: {formatMoney(pricingPreview.unitPrice)}
                    </span>
                    <span>
                      Total price: {formatMoney(pricingPreview.totalPrice)}
                    </span>
                    <span>
                      Security deposit:{" "}
                      {formatMoney(pricingPreview.securityDeposit)}
                    </span>
                  </div>
                ) : null}
                <MessageText
                  message={
                    isOwner
                      ? {
                          text: "You own this listing, so rental actions are disabled here.",
                          type: "info",
                        }
                      : hasPendingBookingRequest && !bookingMessage.text
                        ? {
                            text: "You already have a pending rental request for this listing. Wait for the owner to approve or reject it before sending another one.",
                            type: "info",
                          }
                        : !user && !bookingMessage.text
                          ? {
                              text: "Log in to check availability and send a rental request.",
                              type: "info",
                            }
                          : bookingMessage
                  }
                />
              </form>
            </aside>
          )}
        </section>
      ) : null}

      {product ? (
        <section className="section detail-reviews">
          {/* <div className="inner-review"> */}
          <SectionHeading eyebrow="Ratings" title="Reviews and ratings" />
          <MessageText message={reviewMessage} id="productReviewMessage" />

          <div className="detail-reviews__grid">
            {hasReviewAccess ? (
              <article className="surface-panel detail-reviews__panel">
                <SectionHeading
                  // eyebrow="Your feedback"
                  // title="Review this listing"
                  compact
                  note={
                    pendingReviewCount
                      ? `${pendingReviewCount} completed rental${pendingReviewCount === 1 ? "" : "s"} still waiting for your review.`
                      : "Any review you already left can still be updated or deleted here."
                  }
                />

                {reviewRentals.length ? (
                  <div className="list-stack">
                    {reviewRentals.map((rental) => {
                      const draft =
                        reviewDrafts[rental.id] ||
                        createReviewDraft(rental.review);
                      const isSaving =
                        reviewActionKey === `create:${rental.id}` ||
                        reviewActionKey === `update:${rental.id}`;
                      const isDeleting =
                        reviewActionKey === `delete:${rental.id}`;

                      return (
                        <article
                          className="detail-review-editor"
                          key={rental.id}
                        >
                          <div className="detail-review-editor__header">
                            <div>
                              <strong>
                                {rental.review
                                  ? "Update your review"
                                  : "Leave a review"}
                              </strong>
                              <p className="detail-note">
                                Rental finished{" "}
                                {formatDateTime(
                                  rental.actualReturnDate ||
                                    rental.endDate ||
                                    rental.updatedAt,
                                )}
                              </p>
                            </div>
                            <span
                              className={`tag${rental.review ? " tag--light" : ""}`}
                            >
                              {rental.review ? "Published" : "Pending"}
                            </span>
                          </div>

                          <div className="field">
                            <label htmlFor={`reviewRating-${rental.id}`}>
                              Rating
                            </label>
                            <select
                              id={`reviewRating-${rental.id}`}
                              className="input"
                              value={draft.rating}
                              onChange={(event) =>
                                updateReviewDraft(
                                  rental.id,
                                  "rating",
                                  event.target.value,
                                )
                              }
                            >
                              {REVIEW_RATING_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="field">
                            <label htmlFor={`reviewComment-${rental.id}`}>
                              Comment
                            </label>
                            <textarea
                              id={`reviewComment-${rental.id}`}
                              className="textarea"
                              rows="1"
                              placeholder="Share what went well and anything the next renter should know."
                              value={draft.comment}
                              onChange={(event) =>
                                updateReviewDraft(
                                  rental.id,
                                  "comment",
                                  event.target.value,
                                )
                              }
                            />
                          </div>

                          {rental.review?.ownerReply ? (
                            <div className="detail-thread detail-thread--muted">
                              <strong>Owner reply</strong>
                              <p className="detail-note">
                                {rental.review.ownerReply}
                              </p>
                              <span className="detail-thread__meta">
                                Sent{" "}
                                {formatDateTime(rental.review.ownerReplyAt)}
                              </span>
                            </div>
                          ) : null}

                          <div className="listing-actions">
                            <button
                              type="button"
                              className="btn btn--primary btn--small"
                              onClick={() => handleReviewSubmit(rental)}
                              disabled={isSaving || isDeleting}
                            >
                              {isSaving
                                ? rental.review
                                  ? "Saving changes..."
                                  : "Submitting review..."
                                : rental.review
                                  ? "Save Review"
                                  : "Submit Review"}
                            </button>
                            {rental.review ? (
                              <button
                                type="button"
                                className="btn btn--ghost btn--small"
                                onClick={() => handleReviewDelete(rental)}
                                disabled={isSaving || isDeleting}
                              >
                                {isDeleting ? "Deleting..." : "Delete Review"}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : user ? (
                  <EmptyState message="Complete a rental for this listing to unlock rating and review controls." />
                ) : (
                  <EmptyState message="Log in, complete a rental, and then come back here to leave a review." />
                )}
              </article>
            ) : null}

            <article
              className={`surface-panel detail-reviews__panel${
                hasReviewAccess ? " detail-reviews__panel--wide" : ""
              }`}
            >
              {productReviews.length ? (
                <div className="list-stack">
                  {productReviews.map((review) => {
                    const isOwnReview = Boolean(
                      user && review.reviewer?.id === user.id,
                    );
                    const isReplySaving =
                      reviewActionKey === `reply:${review.id}`;

                    return (
                      <article
                        className={`detail-review-card${
                          isOwnReview ? " detail-review-card--own" : ""
                        }`}
                        key={review.id}
                      >
                        <div className="detail-review-card__header">
                          <div className="detail-review-card__author">
                            <img
                              className="detail-review-card__avatar"
                              src={
                                review.reviewer?.avatarUrl || AVATAR_PLACEHOLDER
                              }
                              alt={review.reviewer?.name || "Reviewer"}
                            />
                            <div>
                              <strong>
                                {review.reviewer?.name || "Renter"}
                              </strong>
                              <p className="list-item__meta">
                                Rating {review.rating}/5 |{" "}
                                {formatDateTime(review.createdAt)}
                              </p>
                            </div>
                          </div>
                          {isOwnReview ? (
                            <span className="tag tag--light">You</span>
                          ) : null}
                        </div>

                        <p className="detail-note">
                          {review.comment ||
                            "This renter shared a rating without a written comment."}
                        </p>

                        {review.ownerReply ? (
                          <div className="detail-thread detail-thread--muted">
                            <strong>Owner reply</strong>
                            <p className="detail-note">{review.ownerReply}</p>
                            <span className="detail-thread__meta">
                              Sent {formatDateTime(review.ownerReplyAt)}
                            </span>
                          </div>
                        ) : null}

                        {isOwner ? (
                          <div className="detail-review-reply">
                            <div className="field">
                              <label htmlFor={`ownerReplyReview-${review.id}`}>
                                {review.ownerReply
                                  ? "Update reply"
                                  : "Reply to this review"}
                              </label>
                              <textarea
                                id={`ownerReplyReview-${review.id}`}
                                className="textarea"
                                rows="1"
                                placeholder="Thank the renter or add a short follow-up."
                                value={replyDrafts[review.id] || ""}
                                onChange={(event) =>
                                  updateReplyDraft(
                                    review.id,
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="listing-actions">
                              <button
                                type="button"
                                className="btn btn--secondary btn--small"
                                onClick={() => handleReviewReplySubmit(review)}
                                disabled={isReplySaving}
                              >
                                {isReplySaving
                                  ? "Saving reply..."
                                  : review.ownerReply
                                    ? "Update Reply"
                                    : "Send Reply"}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState message="No ratings have been shared for this listing yet." />
              )}
            </article>
          </div>
          {/* </div> */}
        </section>
      ) : null}

      {!isAdmin && !isOwner ? (
        <section className="section">
          <SectionHeading title="More listings like this" />
          <div className="card-grid">
            {similarProducts.length ? (
              similarProducts.map((similarProduct) => (
                <ProductCard
                  key={similarProduct.id}
                  product={similarProduct}
                  showWishlist={Boolean(
                    user && user.id !== similarProduct.owner?.id,
                  )}
                  isSaved={wishlistIds.has(similarProduct.id)}
                  onToggleWishlist={handleSimilarWishlist}
                  actionLayout="icon-top"
                />
              ))
            ) : (
              <EmptyState message="No similar products were found yet." />
            )}
          </div>
        </section>
      ) : null}
      <ActionDialog
        dialog={dialog}
        setDialog={setDialog}
        onClose={closeDialog}
      />
      <ConversationDialog
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

      {isImageViewerOpen ? (
        <div
          className="image-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Large product image"
          onClick={() => setIsImageViewerOpen(false)}
        >
          <div
            className="image-viewer__content"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="image-viewer__close"
              onClick={() => setIsImageViewerOpen(false)}
            >
              Close
            </button>
            <img
              className="image-viewer__image"
              src={viewerImage}
              alt={product?.title || "Listing preview"}
            />
          </div>
        </div>
      ) : null}
    </SiteLayout>
  );
}
