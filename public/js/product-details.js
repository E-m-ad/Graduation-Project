const productView = document.getElementById("productView");
const pageMessage = document.getElementById("pageMessage");
const productMainImage = document.getElementById("productMainImage");
const productThumbs = document.getElementById("productThumbs");
const productCategory = document.getElementById("productCategory");
const productStatus = document.getElementById("productStatus");
const productTitle = document.getElementById("productTitle");
const productPrice = document.getElementById("productPrice");
const productDescription = document.getElementById("productDescription");
const productFacts = document.getElementById("productFacts");
const wishlistBtn = document.getElementById("wishlistBtn");
const ownerProfileLink = document.getElementById("ownerProfileLink");
const bookingForm = document.getElementById("bookingForm");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const rentalPeriodTypeInput = document.getElementById("rentalPeriodType");
const renterNotesInput = document.getElementById("renterNotes");
const checkAvailabilityBtn = document.getElementById("checkAvailabilityBtn");
const requestRentalBtn = document.getElementById("requestRentalBtn");
const pricingPreview = document.getElementById("pricingPreview");
const bookingMessage = document.getElementById("bookingMessage");
const similarProducts = document.getElementById("similarProducts");

let currentProduct = null;
let currentUser = null;
let isSaved = false;

function getProductId() {
  return new URLSearchParams(window.location.search).get("id");
}

function setMainImage(imageUrl, altText) {
  productMainImage.src = imageUrl;
  productMainImage.alt = altText;
}

function renderThumbnails(images, title) {
  if (!images.length) {
    productThumbs.innerHTML = "";
    return;
  }

  productThumbs.innerHTML = images
    .map(
      (image, index) => `
        <button
          type="button"
          class="thumb-button ${index === 0 ? "is-active" : ""}"
          data-image-url="${AIRent.escapeHtml(
            image.imageUrl || image.thumbnailUrl || AIRent.getPrimaryImage({ images: [image] }),
          )}"
        >
          <img
            src="${AIRent.escapeHtml(image.imageUrl || image.thumbnailUrl)}"
            alt="${AIRent.escapeHtml(title)}"
          />
        </button>
      `,
    )
    .join("");

  productThumbs.querySelectorAll(".thumb-button").forEach((button) => {
    button.addEventListener("click", () => {
      productThumbs
        .querySelectorAll(".thumb-button")
        .forEach((thumb) => thumb.classList.remove("is-active"));
      button.classList.add("is-active");
      setMainImage(button.dataset.imageUrl, title);
    });
  });
}

function renderFacts(product) {
  const facts = [
    ["City", product.city || "Not set"],
    ["Condition", product.condition || "Not set"],
    ["Deposit", AIRent.formatMoney(product.securityDeposit)],
    ["Owner", product.owner?.name || "Unknown"],
    ["Rating", product.avgRating ? Number(product.avgRating).toFixed(1) : "No rating"],
    [
      "Rental range",
      `${product.minRentalPeriod || 1} - ${product.maxRentalPeriod || 365}`,
    ],
  ];

  productFacts.innerHTML = facts
    .map(
      ([label, value]) => `
        <div class="detail-fact">
          <span class="detail-fact__label">${AIRent.escapeHtml(label)}</span>
          <span class="detail-fact__value">${AIRent.escapeHtml(value)}</span>
        </div>
      `,
    )
    .join("");
}

function renderPricing(pricing) {
  if (!pricing) {
    pricingPreview.innerHTML = "";
    return;
  }

  if (pricing.error) {
    pricingPreview.innerHTML = `<p>${AIRent.escapeHtml(pricing.error)}</p>`;
    return;
  }

  pricingPreview.innerHTML = `
    <strong>Pricing preview</strong>
    <span>Unit price: ${AIRent.escapeHtml(AIRent.formatMoney(pricing.unitPrice))}</span>
    <span>Total price: ${AIRent.escapeHtml(AIRent.formatMoney(pricing.totalPrice))}</span>
    <span>Security deposit: ${AIRent.escapeHtml(
      AIRent.formatMoney(pricing.securityDeposit),
    )}</span>
  `;
}

function updateWishlistButton() {
  wishlistBtn.textContent = isSaved ? "Saved to Wishlist" : "Save to Wishlist";
}

function updateBookingState() {
  const isOwner = currentUser && currentUser.id === currentProduct.owner?.id;
  const isLoggedIn = Boolean(currentUser);

  if (isOwner) {
    requestRentalBtn.disabled = true;
    checkAvailabilityBtn.disabled = true;
    AIRent.showMessage(
      bookingMessage,
      "You own this listing, so rental actions are disabled here.",
      "info",
    );
    return;
  }

  requestRentalBtn.disabled = false;
  checkAvailabilityBtn.disabled = false;

  if (!isLoggedIn) {
    AIRent.showMessage(
      bookingMessage,
      "Log in to check availability and send a rental request.",
      "info",
    );
  } else {
    AIRent.showMessage(bookingMessage, "");
  }
}

async function loadSimilarProducts(productId, wishlistIds) {
  const result = await AIRent.fetchApi(
    `/api/v1/recommendations/similar/${productId}?limit=3`,
  );
  const items = result.data?.data?.similarProducts || [];

  if (!items.length) {
    similarProducts.innerHTML = AIRent.createEmptyState(
      "No similar products were found yet.",
    );
    return;
  }

  similarProducts.innerHTML = items
    .map((product) =>
      AIRent.createProductCard(product, {
        wishlistIds,
        showWishlist: Boolean(currentUser),
      }),
    )
    .join("");

  similarProducts.querySelectorAll("[data-wishlist-product-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const productIdValue = button.dataset.wishlistProductId;
      const saved = button.dataset.saved === "true";
      const response = await AIRent.toggleWishlist(productIdValue, saved);

      if (!response.ok) {
        return;
      }

      button.dataset.saved = saved ? "false" : "true";
      button.textContent = saved ? "Save" : "Saved";
    });
  });
}

async function checkAvailability() {
  if (!currentProduct) {
    return false;
  }

  const startDate = startDateInput.value;
  const endDate = endDateInput.value;

  if (!startDate || !endDate) {
    AIRent.showMessage(
      bookingMessage,
      "Choose a start date and end date first.",
      "error",
    );
    return false;
  }

  AIRent.showMessage(bookingMessage, "Checking availability...", "info");

  const query = AIRent.buildQuery({
    startDate: new Date(startDate).toISOString(),
    endDate: new Date(endDate).toISOString(),
    rentalPeriodType: rentalPeriodTypeInput.value,
  });
  const result = await AIRent.fetchApi(
    `/api/v1/rentals/${currentProduct.id}/availability?${query}`,
  );

  if (!result.ok || !result.data?.success) {
    renderPricing(null);
    AIRent.showMessage(
      bookingMessage,
      result.data?.message || "Could not check availability.",
      "error",
    );
    return false;
  }

  const availability = result.data.data;
  renderPricing(availability.pricing);

  if (availability.isAvailable) {
    AIRent.showMessage(
      bookingMessage,
      "This date range is available.",
      "success",
    );
    return true;
  }

  AIRent.showMessage(
    bookingMessage,
    availability.notBookableReason ||
      "The selected range is not available right now.",
    "error",
  );
  return false;
}

wishlistBtn.addEventListener("click", async () => {
  if (!currentProduct) {
    return;
  }

  const result = await AIRent.toggleWishlist(currentProduct.id, isSaved);
  if (!result.ok) {
    return;
  }

  isSaved = !isSaved;
  updateWishlistButton();

  if (!isSaved && bookingMessage.classList.contains("message--success")) {
    AIRent.showMessage(bookingMessage, "");
  }
});

checkAvailabilityBtn.addEventListener("click", async () => {
  if (!currentUser) {
    AIRent.redirectToLogin();
    return;
  }

  const isAvailable = await checkAvailability();
  if (!isAvailable) {
    return;
  }
});

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    AIRent.redirectToLogin();
    return;
  }

  await checkAvailability();

  requestRentalBtn.disabled = true;
  requestRentalBtn.textContent = "Sending request...";

  const result = await AIRent.fetchApi("/api/v1/rentals", {
    method: "POST",
    auth: true,
    body: {
      productId: currentProduct.id,
      startDate: new Date(startDateInput.value).toISOString(),
      endDate: new Date(endDateInput.value).toISOString(),
      rentalPeriodType: rentalPeriodTypeInput.value,
      renterNotes: renterNotesInput.value.trim(),
    },
  });

  requestRentalBtn.disabled = false;
  requestRentalBtn.textContent = "Send Rental Request";

  if (!result.ok || !result.data?.success) {
    AIRent.showMessage(
      bookingMessage,
      result.data?.message || "Unable to submit the rental request.",
      "error",
    );
    return;
  }

  AIRent.showMessage(
    bookingMessage,
    result.data.message || "Rental request created successfully.",
    "success",
  );

  AIRent.trackBehavior({
    actionType: "rent",
    productId: currentProduct.id,
    metadata: {
      rentalPeriodType: rentalPeriodTypeInput.value,
    },
  });
});

(async function initializeProductDetailsPage() {
  const productId = getProductId();
  if (!productId) {
    AIRent.showMessage(pageMessage, "Product id is missing from the URL.", "error");
    return;
  }

  currentUser = await AIRent.loadCurrentUser();
  const wishlistIds = currentUser ? await AIRent.fetchWishlistIds() : new Set();
  isSaved = wishlistIds.has(productId);
  updateWishlistButton();

  const result = await AIRent.fetchApi(`/api/v1/products/${productId}`);
  if (!result.ok || !result.data?.success) {
    AIRent.showMessage(
      pageMessage,
      result.data?.message || "Unable to load product details.",
      "error",
    );
    return;
  }

  currentProduct = result.data.data;

  document.title = `${currentProduct.title} | AI Rent`;
  productCategory.textContent = currentProduct.category?.name || "General";
  productStatus.textContent = currentProduct.status || "available";
  productTitle.textContent = currentProduct.title || "Untitled listing";
  productPrice.textContent = AIRent.getPriceLabel(currentProduct);
  productDescription.textContent =
    currentProduct.description || "No description available.";

  const images = currentProduct.images || [];
  setMainImage(AIRent.getPrimaryImage(currentProduct), currentProduct.title);
  renderThumbnails(images, currentProduct.title || "Product");
  renderFacts(currentProduct);

  ownerProfileLink.textContent = `Owner: ${currentProduct.owner?.name || "Unknown"}`;
  ownerProfileLink.addEventListener("click", (event) => event.preventDefault());

  productView.hidden = false;
  updateBookingState();
  await loadSimilarProducts(productId, wishlistIds);

  if (currentUser) {
    AIRent.trackBehavior({
      actionType: "view",
      productId,
      categoryId: currentProduct.category?.id,
      metadata: {
        page: "product-details",
      },
    });
  }
})();
