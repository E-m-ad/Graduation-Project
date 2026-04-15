import React, { useEffect, useRef, useState } from "react";
import {
  buildQuery,
  fetchApi,
  getDefaultAuthenticatedPath,
  redirectToLogin,
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
const CURSOR_CONFIG = {
  "my-listings": {
    enabled: false,
    color: "#ff0000",
    targetSelector: "body",
    activeSelectors: [],
    deactiveSelectors: [],
  },
};

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

function getRequestedEditListingId() {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("edit") || "";
}

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
    tags: Array.isArray(product?.tags)
      ? product.tags.join(", ")
      : product?.tags || "",
    termsConditions: product?.termsConditions || "",
  };
}

function createPayload(form) {
  const payload = {
    categoryId: form.categoryId,
    title: form.title.trim(),
    description: form.description.trim(),
  };

  ["city", "condition", "locationAddress", "tags", "termsConditions"].forEach(
    (key) => {
      const value = String(form[key] || "").trim();
      if (value) {
        payload[key] = value;
      }
    },
  );

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

function getSelectedFilesSummary(files) {
  if (!files.length) {
    return "No file chosen";
  }

  if (files.length === 1) {
    return files[0]?.name || "1 file selected";
  }

  return `${files.length} files selected`;
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Unavailable" },
  { value: "under_review", label: "Under review" },
  { value: "suspended", label: "Suspended" },
  { value: "rented", label: "Rented" },
];

function ListingItem({ product }) {
  return <ProductCard product={product} actionLayout="icon-top" />;
}

export function MyListingsPage({ page }) {
  const { user, loading, logout } = useSession();
  const { dialog, setDialog, closeDialog, confirmDialog } = useActionDialog();
  const [message, showMessage] = useMessageState("");
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingListingId, setEditingListingId] = useState("");
  const [categories, setCategories] = useState([]);
  const [listings, setListings] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const requestedEditListingIdRef = useRef(getRequestedEditListingId());
  const formPanelRef = useRef(null);
  const fileInputRef = useRef(null);
  const statusFilterMenuRef = useRef(null);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);

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

  useEffect(() => {
    if (!isStatusMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!statusFilterMenuRef.current?.contains(event.target)) {
        setIsStatusMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsStatusMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isStatusMenuOpen]);

  useEffect(() => {
    if (
      !requestedEditListingIdRef.current ||
      editingListingId ||
      !listings.length
    ) {
      return;
    }

    const requestedListing = listings.find(
      (listing) => listing.id === requestedEditListingIdRef.current,
    );
    if (!requestedListing) {
      return;
    }

    requestedEditListingIdRef.current = "";
    handleEditListing(requestedListing.id);

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("edit");
    window.history.replaceState(
      {},
      "",
      `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
    );
  }, [editingListingId, listings]);

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

  function handleStatusFilterSelect(nextStatus) {
    setStatusFilter(nextStatus);
    setIsStatusMenuOpen(false);
  }

  async function handleListingAction(action, listingId) {
    if (action === "edit") {
      handleEditListing(listingId);
      return;
    }

    let result;

    if (action === "delete") {
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

  const selectedStatusOption = STATUS_FILTER_OPTIONS.find(
    (option) => option.value === statusFilter,
  );
  const selectedStatusLabel = selectedStatusOption?.label || "All statuses";
  const selectedFilesSummary = getSelectedFilesSummary(selectedFiles);
  const selectedFileNames = selectedFiles
    .map((file) => file?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <SiteLayout
      page={page}
      user={user}
      onLogout={logout}
      cursorConfig={CURSOR_CONFIG[page]}
    >
      {/* <section className="page-hero">
        <div></div>
      </section> */}

      <MessageText message={message} id="listingMessage" />

      <section className="listing-layout">
        <article className="surface-panel" ref={formPanelRef}>
          <SectionHeading
            // eyebrow={editingListingId ? "Edit listing" : "New listing"}
            title={
              editingListingId ? "Update your product" : "Create a product"
            }
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
              <label htmlFor="listingDescription">Description</label>
              <textarea
                id="listingDescription"
                name="description"
                className="textarea"
                rows="2"
                value={form.description}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    description: event.target.value,
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
                rows="2"
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
              <div className="listing-file-input">
                <input
                  key={fileInputKey}
                  ref={fileInputRef}
                  id="listingImages"
                  name="images"
                  type="file"
                  className="listing-file-input__native"
                  accept="image/*"
                  multiple
                  aria-describedby="listingImagesSummary"
                  onChange={(event) =>
                    setSelectedFiles(Array.from(event.target.files || []))
                  }
                />
                <div className="listing-file-input__row">
                  <button
                    type="button"
                    className="btn btn--secondary listing-file-input__button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose files
                  </button>
                  <span
                    id="listingImagesSummary"
                    className={`listing-file-input__status${
                      selectedFiles.length ? " has-files" : ""
                    }`}
                  >
                    {selectedFilesSummary}
                  </span>
                </div>
                {selectedFileNames ? (
                  <p className="listing-file-input__names">
                    {selectedFileNames}
                  </p>
                ) : null}
              </div>
              {editingListingId ? (
                <p className="compact-text">
                  Uploading images here will add new images to the existing
                  listing.
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
          <div className="section-heading section-heading--compact listings">
            <div>
              <p className="eyebrow">Your listings</p>
            </div>
            <div className="compact-filter">
              {/* <label htmlFor="statusFilter">Status</label> */}
              <div
                className={`compact-filter__picker category-picker${
                  isStatusMenuOpen ? " is-open" : ""
                }`}
                ref={statusFilterMenuRef}
              >
                <button
                  id="statusFilter"
                  type="button"
                  className="input category-picker__trigger"
                  aria-label="Filter listings by status"
                  aria-expanded={isStatusMenuOpen}
                  aria-haspopup="listbox"
                  aria-controls="statusFilterMenu"
                  onClick={() => setIsStatusMenuOpen((previous) => !previous)}
                >
                  <span
                    className={`category-picker__trigger-text${
                      statusFilter ? "" : " is-placeholder"
                    }`}
                  >
                    {selectedStatusLabel}
                  </span>
                  <span
                    className="category-picker__trigger-icon"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 20 20">
                      <path d="m5 7.5 5 5 5-5" />
                    </svg>
                  </span>
                </button>

                {isStatusMenuOpen ? (
                  <div
                    id="statusFilterMenu"
                    className="category-picker__menu compact-filter__menu"
                    role="listbox"
                    aria-label="Status options"
                  >
                    {STATUS_FILTER_OPTIONS.map((option) => (
                      <button
                        type="button"
                        key={option.value || "all-statuses"}
                        className={`category-picker__option${
                          statusFilter === option.value ? " is-selected" : ""
                        }`}
                        role="option"
                        aria-selected={statusFilter === option.value}
                        onClick={() => handleStatusFilterSelect(option.value)}
                      >
                        <span className="category-picker__option-title">
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="card-grid listing-card-grid">
            {listings.length ? (
              listings.map((product) => (
                <ListingItem key={product.id} product={product} />
              ))
            ) : (
              <EmptyState message="No listings match the current filter." />
            )}
          </div>
        </section>
      </section>
      <ActionDialog
        dialog={dialog}
        setDialog={setDialog}
        onClose={closeDialog}
      />
    </SiteLayout>
  );
}
