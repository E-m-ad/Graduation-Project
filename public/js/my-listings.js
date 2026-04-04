const listingMessage = document.getElementById("listingMessage");
const createListingForm = document.getElementById("createListingForm");
const listingCategory = document.getElementById("listingCategory");
const listingImages = document.getElementById("listingImages");
const statusFilter = document.getElementById("statusFilter");
const myListingsList = document.getElementById("myListingsList");

async function loadCategories() {
  const result = await AIRent.fetchApi("/api/v1/categories");
  const categories = result.data?.data?.categories || [];

  listingCategory.innerHTML = `
    <option value="">Choose a category</option>
    ${categories
      .map(
        (category) => `
          <option value="${AIRent.escapeHtml(category.id)}">
            ${AIRent.escapeHtml(category.name)}
          </option>
        `,
      )
      .join("")}
  `;
}

function buildCreatePayload(formData) {
  const payload = {};

  [
    "categoryId",
    "title",
    "description",
    "city",
    "condition",
    "locationAddress",
    "tags",
    "termsConditions",
  ].forEach((key) => {
    const value = String(formData.get(key) || "").trim();
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
    const value = String(formData.get(key) || "").trim();
    if (value) {
      payload[key] = Number(value);
    }
  });

  return payload;
}

async function uploadImages(productId, files) {
  if (!files.length) {
    return;
  }

  const formData = new FormData();
  Array.from(files).forEach((file) => {
    formData.append("images", file);
  });

  return AIRent.fetchApi(`/api/v1/products/${productId}/images`, {
    method: "POST",
    auth: true,
    body: formData,
  });
}

function createListingItem(product) {
  const priceLines = [
    product.pricePerHour ? `Hour: ${AIRent.formatMoney(product.pricePerHour)}` : "",
    product.pricePerDay ? `Day: ${AIRent.formatMoney(product.pricePerDay)}` : "",
    product.pricePerWeek ? `Week: ${AIRent.formatMoney(product.pricePerWeek)}` : "",
    product.pricePerMonth
      ? `Month: ${AIRent.formatMoney(product.pricePerMonth)}`
      : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return `
    <article class="list-item">
      <div class="list-item__title-row">
        <div>
          <strong>${AIRent.escapeHtml(product.title)}</strong>
          <p class="list-item__meta">
            ${AIRent.escapeHtml(product.category?.name || "General")} |
            ${AIRent.escapeHtml(product.city || "No city")} |
            ${AIRent.escapeHtml(product.status)}
          </p>
        </div>
        <span class="tag ${product.isApproved ? "tag--light" : ""}">
          ${product.isApproved ? "Approved" : "Pending review"}
        </span>
      </div>
      <div class="listing-meta-grid">
        <span>${AIRent.escapeHtml(priceLines || "No prices added")}</span>
        <span>Created: ${AIRent.escapeHtml(AIRent.formatDateTime(product.createdAt))}</span>
      </div>
      <div class="listing-actions">
        <a class="btn btn--ghost btn--small" href="/html/product-details.html?id=${encodeURIComponent(
          product.id,
        )}">
          View
        </a>
        <button
          type="button"
          class="btn btn--secondary btn--small"
          data-listing-action="available"
          data-listing-id="${AIRent.escapeHtml(product.id)}"
        >
          Set Available
        </button>
        <button
          type="button"
          class="btn btn--secondary btn--small"
          data-listing-action="unavailable"
          data-listing-id="${AIRent.escapeHtml(product.id)}"
        >
          Set Unavailable
        </button>
        <button
          type="button"
          class="btn btn--ghost btn--small"
          data-listing-action="delete"
          data-listing-id="${AIRent.escapeHtml(product.id)}"
        >
          Delete
        </button>
      </div>
    </article>
  `;
}

async function loadListings() {
  const query = AIRent.buildQuery({
    status: statusFilter.value,
    limit: 20,
  });
  const result = await AIRent.fetchApi(`/api/v1/products/my-listings?${query}`, {
    auth: true,
  });

  if (!result.ok || !result.data?.success) {
    AIRent.showMessage(
      listingMessage,
      result.data?.message || "Unable to load your listings.",
      "error",
    );
    myListingsList.innerHTML = AIRent.createEmptyState("Try again in a moment.");
    return;
  }

  const listings = result.data.data.products || [];
  if (!listings.length) {
    myListingsList.innerHTML = AIRent.createEmptyState(
      "No listings match the current filter.",
    );
    return;
  }

  myListingsList.innerHTML = listings.map(createListingItem).join("");
}

createListingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(createListingForm);
  const payload = buildCreatePayload(formData);

  const result = await AIRent.fetchApi("/api/v1/products", {
    method: "POST",
    auth: true,
    body: payload,
  });

  if (!result.ok || !result.data?.success) {
    AIRent.showMessage(
      listingMessage,
      result.data?.message || "Unable to create the listing.",
      "error",
    );
    return;
  }

  const createdProduct = result.data.data;
  if (listingImages.files.length) {
    const uploadResult = await uploadImages(createdProduct.id, listingImages.files);
    if (!uploadResult?.ok) {
      AIRent.showMessage(
        listingMessage,
        uploadResult?.data?.message ||
          "Listing created, but image upload was not completed.",
        "error",
      );
      await loadListings();
      return;
    }
  }

  AIRent.showMessage(
    listingMessage,
    result.data.message || "Listing created successfully.",
    "success",
  );

  createListingForm.reset();
  await AIRent.loadCurrentUser(true);
  await loadListings();
});

statusFilter.addEventListener("change", async () => {
  await loadListings();
});

myListingsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-listing-action]");
  if (!button) {
    return;
  }

  const listingId = button.dataset.listingId;
  const action = button.dataset.listingAction;

  let result;

  if (action === "delete") {
    const confirmed = window.confirm(
      "Delete this listing? This cannot be undone if there are no rental records.",
    );
    if (!confirmed) {
      return;
    }

    result = await AIRent.fetchApi(`/api/v1/products/${listingId}`, {
      method: "DELETE",
      auth: true,
    });
  } else {
    result = await AIRent.fetchApi(`/api/v1/products/${listingId}/status`, {
      method: "PUT",
      auth: true,
      body: { status: action },
    });
  }

  AIRent.showMessage(
    listingMessage,
    result.data?.message || "Listing updated.",
    result.ok ? "success" : "error",
  );

  if (result.ok) {
    await loadListings();
  }
});

(async function initializeMyListingsPage() {
  const user = await AIRent.requireAuth();
  if (!user) {
    return;
  }

  await loadCategories();
  await loadListings();
})();
