import React, { useEffect, useState } from "react";
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
import { useMessageState, useSession } from "../lib/hooks";
import {
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
    (left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0),
  );
}

function getExistingProductRental(rentals) {
  const visibleStatuses = new Set(["pending", "approved", "active", "overdue", "completed"]);
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

export function ProductDetailsPage({ page }) {
  const { user, loading, logout } = useSession();
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
  const [reviewActionKey, setReviewActionKey] = useState("");

  const productId = getProductId();
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
      const isOwnerViewingProduct = Boolean(user && user.id === nextProduct.owner?.id);
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
          `/api/v1/recommendations/similar/${productId}?limit=3`,
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
        return;
      }

      if (product?.owner?.id === user.id) {
        setCurrentProductRental(null);
        setPendingBookingRequest(null);
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
        return;
      }

      const nextRentals = result.data.data?.rentals || [];
      const nextPendingRental = nextRentals.find(
        (rental) =>
          rental.status === "pending" &&
          new Date(rental.endDate || rental.createdAt || 0) > new Date(),
      );

      setCurrentProductRental(getExistingProductRental(nextRentals));
      setPendingBookingRequest(nextPendingRental || null);
    }

    loadProductBookings();

    return () => {
      active = false;
    };
  }, [isAdmin, loading, product?.owner?.id, productId, user]);

  useEffect(() => {
    if (!product || !supportedRentalPeriods.length || hasSupportedRentalPeriod) {
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
        reviewRentals.map((rental) => [rental.id, createReviewDraft(rental.review)]),
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
      Object.fromEntries(reviews.map((review) => [review.id, review.ownerReply || ""])),
    );
  }, [product?.reviews]);

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

      const currentReviews = Array.isArray(previous.reviews) ? previous.reviews : [];
      let nextReviews = currentReviews;

      if (mode === "delete") {
        nextReviews = currentReviews.filter((review) => review.id !== nextReview.id);
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
        totalReviews: nextReview?.product?.totalReviews ?? previous.totalReviews,
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

    const result = await fetchApi(isUpdating ? `/api/v1/reviews/${rental.review.id}` : "/api/v1/reviews", {
      method: isUpdating ? "PUT" : "POST",
      auth: true,
      body: isUpdating
        ? payload
        : {
            rentalId: rental.id,
            ...payload,
          },
    });

    setReviewActionKey("");
    showReviewMessage(
      result.data?.message || (isUpdating ? "Review updated." : "Review submitted."),
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

    if (!window.confirm("Delete this review and remove its rating from the product?")) {
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
      showReviewMessage("Add a short reply before sending it to the renter.", "error");
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
      showBookingMessage("This listing does not have rental pricing set yet.", "error");
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

    const reasonInput = window.prompt(
      `Optional reason for ${action === "approve" ? "approval" : "rejection"}:`,
    );
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
      showPageMessage("Add a short reply before sending it to the admin team.", "error");
      return;
    }

    setSubmittingOwnerReply(true);

    const result = await fetchApi(`/api/v1/products/${product.id}/moderation-reply`, {
      method: "POST",
      auth: true,
      body: {
        reply: nextReply,
      },
    });

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
  const pendingReviewCount = reviewRentals.filter((rental) => !rental.review).length;
  const productReviews = sortReviewsByNewest(product?.reviews || []);
  const hasExistingProductRental = Boolean(currentProductRental?.id);
  const hasPendingBookingRequest = Boolean(pendingBookingRequest?.id);
  const canAdminToggleListingVisibility = Boolean(
    isAdmin && product?.isApproved,
  );
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
  const viewerImage = mainImage || (product ? getPrimaryImage(product) : "");

  return (
    <SiteLayout page={page} user={user} onLogout={logout}>
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
              <img className="detail-gallery__main" src={mainImage} alt={product.title} />
            </button>
            <p className="detail-gallery__hint">Click the image to view it larger.</p>
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
              <span className="tag tag--light">{product.status || "available"}</span>
            </div>

            <h1>{product.title || "Untitled listing"}</h1>
            <p className="detail-price">{getPriceLabel(product)}</p>
            <p className="detail-description">
              {product.description || "No description available."}
            </p>

            <DetailFactGrid facts={facts} />

            <div className="detail-actions">
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
                  <strong>
                    {getModerationStatusLabel(product)}
                  </strong>
                  <span>Approval status: {getApprovalLabel(product)}</span>
                  <span>
                    Public visibility: {isPubliclyVisible ? "Visible" : "Hidden from catalog"}
                  </span>
                  <span>Last updated: {formatDateTime(product.updatedAt)}</span>
                </div>

                <p className="detail-note">
                  Admin preview mode hides renter actions and lets you moderate the
                  listing directly from this page.
                </p>

                {product.adminReviewNote ? (
                  <div className="detail-thread">
                    <strong>Latest admin note</strong>
                    <p className="detail-note">{product.adminReviewNote}</p>
                    <span className="detail-thread__meta">
                      Sent {formatDateTime(product.adminReviewedAt || product.updatedAt)}
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
                eyebrow="Owner workspace"
                title={canOwnerReplyToModeration ? "Fix and reply to admin" : "Owner preview"}
                compact
              />

              <div className="stack-form">
                <div className="booking-preview owner-review-panel__status">
                  <strong>{getOwnerReviewStatusLabel(product)}</strong>
                  <span>Approval status: {getApprovalLabel(product)}</span>
                  <span>
                    Last review update: {formatDateTime(product.adminReviewedAt || product.updatedAt)}
                  </span>
                  {product.ownerRepliedAt ? (
                    <span>Your last reply: {formatDateTime(product.ownerRepliedAt)}</span>
                  ) : null}
                </div>

                {product.adminReviewNote ? (
                  <div className="detail-thread">
                    <strong>Admin note</strong>
                    <p className="detail-note">{product.adminReviewNote}</p>
                    <span className="detail-thread__meta">
                      Sent {formatDateTime(product.adminReviewedAt || product.updatedAt)}
                    </span>
                  </div>
                ) : (
                  <p className="detail-note">
                    This listing is in owner preview mode. If the admin team asks
                    for changes, the note will appear here so you can fix the
                    listing and send it back for review.
                  </p>
                )}

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
                      <label htmlFor="ownerModerationReply">Reply to admin</label>
                      <textarea
                        id="ownerModerationReply"
                        className="textarea"
                        rows="5"
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
                      text: product.isApproved && isPubliclyVisible
                        ? "This listing is live. If admin feedback is needed later, it will appear here."
                        : product.isApproved
                          ? "This listing is approved but currently hidden from the public catalog."
                        : "This listing is currently waiting for admin review.",
                      type: "info",
                    }}
                  />
                )}
              </div>
            </aside>
          ) : hasExistingProductRental ? (
            <aside className="surface-panel booking-panel">
              <SectionHeading
                eyebrow="Your rental"
                title="Booking status"
                compact
              />

              <div className="stack-form">
                <div className="booking-preview owner-review-panel__status">
                  <strong>
                    {currentProductRental.status === "pending"
                      ? "Your rental request is waiting for the owner response."
                      : currentProductRental.status === "approved"
                        ? "Your rental request has already been approved."
                        : currentProductRental.status === "active"
                          ? "You are currently renting this listing."
                          : currentProductRental.status === "overdue"
                            ? "This rental is overdue and still open."
                            : "You already rented this listing."}
                  </strong>
                  <span>Status: {currentProductRental.status}</span>
                  <span>Requested on: {formatDateTime(currentProductRental.createdAt)}</span>
                  {currentProductRental.startDate ? (
                    <span>Start: {formatDateTime(currentProductRental.startDate)}</span>
                  ) : null}
                  {currentProductRental.endDate ? (
                    <span>End: {formatDateTime(currentProductRental.endDate)}</span>
                  ) : null}
                  {currentProductRental.actualReturnDate ? (
                    <span>
                      Finished at: {formatDateTime(currentProductRental.actualReturnDate)}
                    </span>
                  ) : null}
                </div>

                <MessageText
                  message={{
                    text:
                      currentProductRental.status === "completed"
                        ? currentProductRental.review?.id
                          ? "Your review for this rental is already saved below."
                          : "You can leave your review for this rental in the ratings section below."
                        : "Request controls are hidden here because you already have a booking for this listing.",
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
              <SectionHeading
                eyebrow="Check availability"
                title="Request this listing"
                compact
              />

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
                      supportedRentalPeriods.length ? bookingForm.rentalPeriodType : ""
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
                    rows="4"
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
                    disabled={isOwner || submittingRequest || hasPendingBookingRequest}
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
                    <span>Unit price: {formatMoney(pricingPreview.unitPrice)}</span>
                    <span>Total price: {formatMoney(pricingPreview.totalPrice)}</span>
                    <span>
                      Security deposit: {formatMoney(pricingPreview.securityDeposit)}
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
                            text:
                              "You already have a pending rental request for this listing. Wait for the owner to approve or reject it before sending another one.",
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
          <SectionHeading
            eyebrow="Ratings"
            title="Reviews and ratings"
            note={
              isOwner
                ? "Read renter feedback and reply from your product page."
                : hasReviewAccess
                  ? "Completed renters can leave one rating per finished rental, and owners are notified when feedback arrives."
                  : "See how other renters rated this listing."
            }
          />
          <MessageText message={reviewMessage} id="productReviewMessage" />

          <div className="detail-reviews__grid">
            {hasReviewAccess ? (
              <article className="surface-panel detail-reviews__panel">
                <SectionHeading
                  eyebrow="Your feedback"
                  title="Review this listing"
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
                      const draft = reviewDrafts[rental.id] || createReviewDraft(rental.review);
                      const isSaving =
                        reviewActionKey === `create:${rental.id}` ||
                        reviewActionKey === `update:${rental.id}`;
                      const isDeleting = reviewActionKey === `delete:${rental.id}`;

                      return (
                        <article className="detail-review-editor" key={rental.id}>
                          <div className="detail-review-editor__header">
                            <div>
                              <strong>
                                {rental.review ? "Update your review" : "Leave a review"}
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
                            <span className={`tag${rental.review ? " tag--light" : ""}`}>
                              {rental.review ? "Published" : "Pending"}
                            </span>
                          </div>

                          <div className="field">
                            <label htmlFor={`reviewRating-${rental.id}`}>Rating</label>
                            <select
                              id={`reviewRating-${rental.id}`}
                              className="input"
                              value={draft.rating}
                              onChange={(event) =>
                                updateReviewDraft(rental.id, "rating", event.target.value)
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
                            <label htmlFor={`reviewComment-${rental.id}`}>Comment</label>
                            <textarea
                              id={`reviewComment-${rental.id}`}
                              className="textarea"
                              rows="5"
                              placeholder="Share what went well and anything the next renter should know."
                              value={draft.comment}
                              onChange={(event) =>
                                updateReviewDraft(rental.id, "comment", event.target.value)
                              }
                            />
                          </div>

                          {rental.review?.ownerReply ? (
                            <div className="detail-thread detail-thread--muted">
                              <strong>Owner reply</strong>
                              <p className="detail-note">{rental.review.ownerReply}</p>
                              <span className="detail-thread__meta">
                                Sent {formatDateTime(rental.review.ownerReplyAt)}
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
              <SectionHeading
                eyebrow="Community feedback"
                title="What renters are saying"
                compact
              >
                <div className="detail-review-summary">
                  <strong>
                    {product.totalReviews
                      ? `${Number(product.avgRating || 0).toFixed(1)} / 5`
                      : "No ratings yet"}
                  </strong>
                  <span>
                    {product.totalReviews} review{product.totalReviews === 1 ? "" : "s"}
                  </span>
                </div>
              </SectionHeading>

              {productReviews.length ? (
                <div className="list-stack">
                  {productReviews.map((review) => {
                    const isOwnReview = Boolean(user && review.reviewer?.id === user.id);
                    const isReplySaving = reviewActionKey === `reply:${review.id}`;

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
                              src={review.reviewer?.avatarUrl || AVATAR_PLACEHOLDER}
                              alt={review.reviewer?.name || "Reviewer"}
                            />
                            <div>
                              <strong>{review.reviewer?.name || "Renter"}</strong>
                              <p className="list-item__meta">
                                Rating {review.rating}/5 | {formatDateTime(review.createdAt)}
                              </p>
                            </div>
                          </div>
                          {isOwnReview ? <span className="tag tag--light">You</span> : null}
                        </div>

                        <p className="detail-note">
                          {review.comment || "This renter shared a rating without a written comment."}
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
                                {review.ownerReply ? "Update reply" : "Reply to this review"}
                              </label>
                              <textarea
                                id={`ownerReplyReview-${review.id}`}
                                className="textarea"
                                rows="4"
                                placeholder="Thank the renter or add a short follow-up."
                                value={replyDrafts[review.id] || ""}
                                onChange={(event) =>
                                  updateReplyDraft(review.id, event.target.value)
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
        </section>
      ) : null}

      {!isAdmin && !isOwner ? (
        <section className="section">
          <SectionHeading eyebrow="Similar options" title="More listings like this" />
          <div className="card-grid">
            {similarProducts.length ? (
              similarProducts.map((similarProduct) => (
                <ProductCard
                  key={similarProduct.id}
                  product={similarProduct}
                  showWishlist={Boolean(user && user.id !== similarProduct.owner?.id)}
                  isSaved={wishlistIds.has(similarProduct.id)}
                  onToggleWishlist={handleSimilarWishlist}
                />
              ))
            ) : (
              <EmptyState message="No similar products were found yet." />
            )}
          </div>
        </section>
      ) : null}

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
