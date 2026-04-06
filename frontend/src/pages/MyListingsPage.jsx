import React, { useEffect, useRef, useState } from "react";
import {
  buildQuery,
  fetchApi,
  formatDateTime,
  formatMoney,
  getDefaultAuthenticatedPath,
  getPrimaryImage,
  getPriceLabel,
  redirectToLogin,
  truncateText,
} from "../lib/airent";
import { useMessageState, useSession } from "../lib/hooks";
import { EmptyState, MessageText, SectionHeading } from "../components/Common";
import { SiteLayout } from "../components/Layout";

const INITIAL_FORM = {
  categoryId: "",
  title: "",
  description: "",
  pricePerHour: "",
  pricePerDay: "",
  pricePerWeek: "",
  pricePerMonth: "",
  securityDeposit: "",
  city: "",
  condition: "",
  minRentalPeriod: "",
  maxRentalPeriod: "",
  locationAddress: "",
  tags: "",
  termsConditions: "",
};

function getFormValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

function createFormFromProduct(product) {
  return {
    categoryId: product?.category?.id || product?.categoryId || "",
    title: product?.title || "",
    description: product?.description || "",
    pricePerHour: getFormValue(product?.pricePerHour),
    pricePerDay: getFormValue(product?.pricePerDay),
    pricePerWeek: getFormValue(product?.pricePerWeek),
    pricePerMonth: getFormValue(product?.pricePerMonth),
    securityDeposit: getFormValue(product?.securityDeposit),
    city: product?.city || "",
    condition: product?.condition || "",
    minRentalPeriod: getFormValue(product?.minRentalPeriod),
    maxRentalPeriod: getFormValue(product?.maxRentalPeriod),
    locationAddress: product?.locationAddress || "",
    tags: Array.isArray(product?.tags) ? product.tags.join(", ") : product?.tags || "",
    termsConditions: product?.termsConditions || "",
  };
}

function createPayload(form) {
  const payload = {
    categoryId: form.categoryId,
    title: form.title.trim(),
    description: form.description.trim(),
  };

  [
    "city",
    "condition",
    "locationAddress",
    "tags",
    "termsConditions",
  ].forEach((key) => {
    const value = String(form[key] || "").trim();
    if (value) {
      payload[key] = value;
    }
  });

  [
    "pricePerHour",
    "pricePerDay",
    "pricePerWeek",
    "pricePerMonth",
    "securityDeposit",
    "minRentalPeriod",
    "maxRentalPeriod",
  ].forEach((key) => {
    const value = String(form[key] || "").trim();
    if (value) {
      payload[key] = Number(value);
    }
  });

  return payload;
}

function getPriceLines(product) {
  return [
    product.pricePerHour ? `Hour: ${formatMoney(product.pricePerHour)}` : "",
    product.pricePerDay ? `Day: ${formatMoney(product.pricePerDay)}` : "",
    product.pricePerWeek ? `Week: ${formatMoney(product.pricePerWeek)}` : "",
    product.pricePerMonth ? `Month: ${formatMoney(product.pricePerMonth)}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function formatListingStatusLabel(status) {
  return String(status || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ListingItem({ product, onAction }) {
  const currentStatus = typeof product.status === "string" ? product.status : "";
  const canManageAvailability =
    Boolean(product.isApproved) && currentStatus !== "suspended";
  const reviewTagLabel =
    currentStatus === "suspended"
      ? product.isApproved
        ? "Suspended"
        : "Needs changes"
      : product.isApproved
        ? "Approved"
        : "Pending review";
  const availabilityTagLabel =
    product.isApproved &&
    ["available", "unavailable", "rented"].includes(currentStatus)
      ? formatListingStatusLabel(currentStatus)
      : "";
  const detailsUrl = `/html/product-details.html?id=${encodeURIComponent(product.id)}`;
  const imageUrl = getPrimaryImage(product);

  return (
    <article className="product-card owner-listing-card">
      <a
        className="product-card__media owner-listing-card__media"
        href={detailsUrl}
        style={{
          "--product-card-media-image": `url(${JSON.stringify(imageUrl)})`,
        }}
      >
        <img
          className="product-card__image"
          src={imageUrl}
          alt={product.title || "Listing image"}
        />
      </a>

      <div className="product-card__body owner-listing-card__body">
        <div className="product-card__meta">
          <span className="tag">{product.category?.name || "General"}</span>
          <span className="product-card__city">{product.city || "No city"}</span>
        </div>

        <div className="owner-listing-card__status-row">
          <span className={`tag${product.isApproved ? " tag--light" : ""}`}>
            {reviewTagLabel}
          </span>
          {availabilityTagLabel ? (
            <span className="tag tag--light">{availabilityTagLabel}</span>
          ) : null}
        </div>

        <div className="product-card__top">
          <div>
            <h3 className="product-card__title">
              <a href={detailsUrl}>{product.title || "Untitled listing"}</a>
            </h3>
            <p className="compact-text">
              {truncateText(product.description || "No description available.", 120)}
            </p>
          </div>
        </div>

        <div className="owner-listing-card__details">
          <p className="product-card__price">{getPriceLabel(product)}</p>
          <p className="compact-text">{getPriceLines(product) || "No prices added"}</p>
          <p className="compact-text">Created {formatDateTime(product.createdAt)}</p>
        </div>

        {product.adminReviewNote ? (
          <div className="listing-review-note">
            <strong>Admin note</strong>
            <p className="list-item__meta">{product.adminReviewNote}</p>
            <span className="list-item__meta">
              Sent {formatDateTime(product.adminReviewedAt || product.updatedAt)}
            </span>
          </div>
        ) : null}

        {product.ownerReviewReply ? (
          <div className="listing-review-note listing-review-note--muted">
            <strong>Your reply</strong>
            <p className="list-item__meta">{product.ownerReviewReply}</p>
            <span className="list-item__meta">
              Sent {formatDateTime(product.ownerRepliedAt)}
            </span>
          </div>
        ) : null}

        <div className="listing-actions owner-listing-card__actions">
          <a className="btn btn--ghost btn--small" href={detailsUrl}>
            {product.adminReviewNote ? "Open Review" : "View"}
          </a>
          <button
            type="button"
            className="btn btn--primary btn--small"
            onClick={() => onAction("edit", product.id)}
          >
            Edit
          </button>
          {canManageAvailability && currentStatus !== "available" ? (
            <button
              type="button"
              className="btn btn--secondary btn--small"
              onClick={() => onAction("available", product.id)}
            >
              Set Available
            </button>
          ) : null}
          {canManageAvailability && currentStatus !== "unavailable" ? (
            <button
              type="button"
              className="btn btn--secondary btn--small"
              onClick={() => onAction("unavailable", product.id)}
            >
              Set Unavailable
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => onAction("delete", product.id)}
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

export function MyListingsPage({ page }) {
  const { user, loading, logout } = useSession();
  const [message, showMessage] = useMessageState("");
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingListingId, setEditingListingId] = useState("");
  const [categories, setCategories] = useState([]);
  const [listings, setListings] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const formPanelRef = useRef(null);

  useEffect(() => {
    document.title = "My Listings | AI Rent";
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
    let active = true;

    async function loadCategories() {
      if (loading || !user || user.role === "admin") {
        return;
      }

      const result = await fetchApi("/api/v1/categories");
      if (!active) {
        return;
      }

      setCategories(result.data?.data?.categories || []);
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, [loading, user]);

  useEffect(() => {
    let active = true;

    async function loadListings() {
      if (loading || !user || user.role === "admin") {
        return;
      }

      const query = buildQuery({
        status: statusFilter,
        limit: 20,
      });
      const result = await fetchApi(`/api/v1/products/my-listings?${query}`, {
        auth: true,
      });

      if (!active) {
        return;
      }

      if (!result.ok || !result.data?.success) {
        showMessage(
          result.data?.message || "Unable to load your listings.",
          "error",
        );
        setListings([]);
        return;
      }

      setListings(result.data.data?.products || []);
    }

    loadListings();

    return () => {
      active = false;
    };
  }, [loading, showMessage, statusFilter, user]);

  async function uploadImages(productId, files) {
    if (!files.length) {
      return { ok: true };
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("images", file);
    });

    return fetchApi(`/api/v1/products/${productId}/images`, {
      method: "POST",
      auth: true,
      body: formData,
    });
  }

  async function reloadListings() {
    const query = buildQuery({
      status: statusFilter,
      limit: 20,
    });
    const result = await fetchApi(`/api/v1/products/my-listings?${query}`, {
      auth: true,
    });

    if (!result.ok || !result.data?.success) {
      setListings([]);
      return;
    }

    setListings(result.data.data?.products || []);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    const isEditing = Boolean(editingListingId);
    const result = await fetchApi(
      isEditing ? `/api/v1/products/${editingListingId}` : "/api/v1/products",
      {
        method: isEditing ? "PUT" : "POST",
        auth: true,
        body: createPayload(form),
      },
    );

    if (!result.ok || !result.data?.success) {
      showMessage(
        result.data?.message ||
          (isEditing
            ? "Unable to update the listing."
            : "Unable to create the listing."),
        "error",
      );
      setSubmitting(false);
      return;
    }

    const savedProduct = result.data.data;
    const uploadResult = await uploadImages(savedProduct.id, selectedFiles);

    if (!uploadResult.ok) {
      showMessage(
        uploadResult.data?.message ||
          (isEditing
            ? "Listing updated, but image upload was not completed."
            : "Listing created, but image upload was not completed."),
        "error",
      );
      setSubmitting(false);
      await reloadListings();
      return;
    }

    showMessage(
      result.data?.message ||
        (isEditing
          ? "Listing updated successfully."
          : "Listing created successfully."),
      "success",
    );
    setSubmitting(false);
    setEditingListingId("");
    setForm(INITIAL_FORM);
    setSelectedFiles([]);
    setFileInputKey((previous) => previous + 1);
    await reloadListings();
  }

  function handleEditListing(listingId) {
    const listing = listings.find((item) => item.id === listingId);
    if (!listing) {
      showMessage("Unable to load that listing into the form.", "error");
      return;
    }

    setEditingListingId(listing.id);
    setForm(createFormFromProduct(listing));
    setSelectedFiles([]);
    setFileInputKey((previous) => previous + 1);
    window.requestAnimationFrame(() => {
      formPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function handleCancelEdit() {
    setEditingListingId("");
    setForm(INITIAL_FORM);
    setSelectedFiles([]);
    setFileInputKey((previous) => previous + 1);
  }

  async function handleListingAction(action, listingId) {
    if (action === "edit") {
      handleEditListing(listingId);
      return;
    }

    let result;

    if (action === "delete") {
      const confirmed = window.confirm(
        "Delete this listing? This cannot be undone if there are no rental records.",
      );

      if (!confirmed) {
        return;
      }

      result = await fetchApi(`/api/v1/products/${listingId}`, {
        method: "DELETE",
        auth: true,
      });
    } else {
      result = await fetchApi(`/api/v1/products/${listingId}/status`, {
        method: "PUT",
        auth: true,
        body: { status: action },
      });
    }

    showMessage(
      result.data?.message || "Listing updated.",
      result.ok ? "success" : "error",
    );

    if (result.ok) {
      if (action === "delete" && listingId === editingListingId) {
        handleCancelEdit();
      }
      await reloadListings();
    }
  }

  return (
    <SiteLayout page={page} user={user} onLogout={logout}>
      <section className="page-hero">
        <div>
          <p className="eyebrow">Owner workspace</p>
          <h1>Create and manage your listings.</h1>
          <p>
            The React version keeps the same backend contract, but the form and
            page logic are easier to follow and extend.
          </p>
        </div>
      </section>

      <MessageText message={message} id="listingMessage" />

      <section className="listing-layout">
        <article className="surface-panel" ref={formPanelRef}>
          <SectionHeading
            eyebrow={editingListingId ? "Edit listing" : "New listing"}
            title={editingListingId ? "Update your product" : "Create a product"}
            compact
            note={
              editingListingId
                ? "Adjust listing details here, then save to update the product."
                : undefined
            }
          >
            {editingListingId ? (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={handleCancelEdit}
              >
                Cancel edit
              </button>
            ) : null}
          </SectionHeading>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="listingCategory">Category</label>
              <select
                id="listingCategory"
                name="categoryId"
                className="input"
                value={form.categoryId}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    categoryId: event.target.value,
                  }))
                }
              >
                <option value="">Choose a category</option>
                {categories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="listingTitle">Title</label>
              <input
                id="listingTitle"
                name="title"
                type="text"
                className="input"
                value={form.title}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    title: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field field--full">
              <label htmlFor="listingDescription">Description</label>
              <textarea
                id="listingDescription"
                name="description"
                className="textarea"
                rows="4"
                value={form.description}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="pricePerHour">Price per hour</label>
              <input
                id="pricePerHour"
                name="pricePerHour"
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.pricePerHour}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    pricePerHour: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="pricePerDay">Price per day</label>
              <input
                id="pricePerDay"
                name="pricePerDay"
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.pricePerDay}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    pricePerDay: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="pricePerWeek">Price per week</label>
              <input
                id="pricePerWeek"
                name="pricePerWeek"
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.pricePerWeek}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    pricePerWeek: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="pricePerMonth">Price per month</label>
              <input
                id="pricePerMonth"
                name="pricePerMonth"
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.pricePerMonth}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    pricePerMonth: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="securityDeposit">Security deposit</label>
              <input
                id="securityDeposit"
                name="securityDeposit"
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.securityDeposit}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    securityDeposit: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="listingCity">City</label>
              <input
                id="listingCity"
                name="city"
                type="text"
                className="input"
                value={form.city}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    city: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="listingCondition">Condition</label>
              <select
                id="listingCondition"
                name="condition"
                className="input"
                value={form.condition}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    condition: event.target.value,
                  }))
                }
              >
                <option value="">Select condition</option>
                <option value="new">New</option>
                <option value="like_new">Like new</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="minRentalPeriod">Minimum rental period</label>
              <input
                id="minRentalPeriod"
                name="minRentalPeriod"
                type="number"
                min="1"
                className="input"
                value={form.minRentalPeriod}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    minRentalPeriod: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="maxRentalPeriod">Maximum rental period</label>
              <input
                id="maxRentalPeriod"
                name="maxRentalPeriod"
                type="number"
                min="1"
                className="input"
                value={form.maxRentalPeriod}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    maxRentalPeriod: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field field--full">
              <label htmlFor="locationAddress">Address</label>
              <input
                id="locationAddress"
                name="locationAddress"
                type="text"
                className="input"
                value={form.locationAddress}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    locationAddress: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field field--full">
              <label htmlFor="listingTags">Tags</label>
              <input
                id="listingTags"
                name="tags"
                type="text"
                className="input"
                placeholder="camera, canon, travel"
                value={form.tags}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    tags: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field field--full">
              <label htmlFor="listingTerms">Terms and conditions</label>
              <textarea
                id="listingTerms"
                name="termsConditions"
                className="textarea"
                rows="4"
                value={form.termsConditions}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    termsConditions: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field field--full">
              <label htmlFor="listingImages">Product images</label>
              <input
                key={fileInputKey}
                id="listingImages"
                name="images"
                type="file"
                className="input"
                accept="image/*"
                multiple
                onChange={(event) =>
                  setSelectedFiles(Array.from(event.target.files || []))
                }
              />
              {editingListingId ? (
                <p className="compact-text">
                  Uploading images here will add new images to the existing listing.
                </p>
              ) : null}
            </div>

            <div className="field field--full">
              <div className="listing-actions">
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={submitting}
                >
                  {submitting
                    ? editingListingId
                      ? "Updating Listing..."
                      : "Creating Listing..."
                    : editingListingId
                      ? "Save Changes"
                      : "Create Listing"}
                </button>
                {editingListingId ? (
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={handleCancelEdit}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        </article>

        <section className="surface-panel">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">Your listings</p>
              <h2>Manage status and review state</h2>
            </div>
            <div className="compact-filter">
              <label htmlFor="statusFilter">Status</label>
              <select
                id="statusFilter"
                className="input"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
                <option value="under_review">Under review</option>
                <option value="suspended">Suspended</option>
                <option value="rented">Rented</option>
              </select>
            </div>
          </div>

          <div className="card-grid listing-card-grid">
            {listings.length ? (
              listings.map((product) => (
                <ListingItem
                  key={product.id}
                  product={product}
                  onAction={handleListingAction}
                />
              ))
            ) : (
              <EmptyState message="No listings match the current filter." />
            )}
          </div>
        </section>
      </section>
    </SiteLayout>
  );
}
