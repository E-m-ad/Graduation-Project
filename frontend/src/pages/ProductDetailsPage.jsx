import React, { useEffect, useState } from "react";
import {
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

function getSupportedRentalPeriods(product) {
  return RENTAL_PERIOD_OPTIONS.filter(
    ({ priceField }) =>
      product?.[priceField] !== null &&
      product?.[priceField] !== undefined &&
      product?.[priceField] !== "",
  );
}

export function ProductDetailsPage({ page }) {
  const { user, loading, logout } = useSession();
  const [pageMessage, showPageMessage] = useMessageState("");
  const [bookingMessage, showBookingMessage] = useMessageState("");
  const [product, setProduct] = useState(null);
  const [mainImage, setMainImage] = useState("");
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [similarProducts, setSimilarProducts] = useState([]);
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
    if (!product || !supportedRentalPeriods.length || hasSupportedRentalPeriod) {
      return;
    }

    setBookingForm((previous) => ({
      ...previous,
      rentalPeriodType: supportedRentalPeriods[0].value,
    }));
    setPricingPreview(null);
  }, [hasSupportedRentalPeriod, product, supportedRentalPeriods]);

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
  const canAdminToggleListingVisibility = Boolean(
    isAdmin && product?.isApproved,
  );
  const isUnlistedApprovedListing = Boolean(
    product?.isApproved && product?.status === "suspended",
  );
  const facts = product
    ? [
        ["City", product.city || "Not set"],
        ["Condition", product.condition || "Not set"],
        ["Deposit", formatMoney(product.securityDeposit)],
        ["Owner", product.owner?.name || "Unknown"],
        ["Approval", getApprovalLabel(product)],
        [
          "Rating",
          product.avgRating ? Number(product.avgRating).toFixed(1) : "No rating",
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
              {!isAdmin ? (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => handleToggleWishlist(product.id, isSaved)}
                >
                  {isSaved ? "Saved to Wishlist" : "Save to Wishlist"}
                </button>
              ) : null}
              <a className="btn btn--ghost" href="#" onClick={(event) => event.preventDefault()}>
                Owner: {product.owner?.name || "Unknown"}
              </a>
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
                    disabled={isOwner || submittingRequest}
                  >
                    {submittingRequest ? "Sending request..." : "Send Rental Request"}
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

      {!isAdmin && !isOwner ? (
        <section className="section">
          <SectionHeading eyebrow="Similar options" title="More listings like this" />
          <div className="card-grid">
            {similarProducts.length ? (
              similarProducts.map((similarProduct) => (
                <ProductCard
                  key={similarProduct.id}
                  product={similarProduct}
                  showWishlist={Boolean(user)}
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
