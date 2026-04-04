const filtersForm = document.getElementById("filtersForm");
const searchInput = document.getElementById("searchInput");
const cityInput = document.getElementById("cityInput");
const categorySelect = document.getElementById("categorySelect");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const productsGrid = document.getElementById("productsGrid");
const resultsMeta = document.getElementById("resultsMeta");
const pageMessage = document.getElementById("pageMessage");
const paginationBar = document.getElementById("paginationBar");
const previousPageBtn = document.getElementById("previousPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const paginationLabel = document.getElementById("paginationLabel");

const state = {
  page: 1,
  limit: 9,
  search: "",
  city: "",
  categoryId: "",
  wishlistIds: new Set(),
  hasUser: false,
  pagination: null,
};

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  state.page = Math.max(Number(params.get("page") || "1") || 1, 1);
  state.search = params.get("search") || "";
  state.city = params.get("city") || "";
  state.categoryId = params.get("categoryId") || "";
}

function syncUrl() {
  const query = AIRent.buildQuery({
    page: state.page > 1 ? state.page : "",
    search: state.search,
    city: state.city,
    categoryId: state.categoryId,
  });

  const nextUrl = query ? `/html/products.html?${query}` : "/html/products.html";
  window.history.replaceState({}, "", nextUrl);
}

function fillFilters() {
  searchInput.value = state.search;
  cityInput.value = state.city;
  categorySelect.value = state.categoryId;
}

function bindWishlistButtons() {
  productsGrid.querySelectorAll("[data-wishlist-product-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const productId = button.dataset.wishlistProductId;
      const isSaved = button.dataset.saved === "true";
      button.disabled = true;

      const result = await AIRent.toggleWishlist(productId, isSaved);
      button.disabled = false;

      if (!result.ok) {
        return;
      }

      button.dataset.saved = isSaved ? "false" : "true";
      button.textContent = isSaved ? "Save" : "Saved";

      if (isSaved) {
        state.wishlistIds.delete(productId);
      } else {
        state.wishlistIds.add(productId);
      }
    });
  });
}

function renderProducts(products) {
  if (!products.length) {
    productsGrid.innerHTML = AIRent.createEmptyState(
      "No listings matched your current filters.",
    );
    return;
  }

  productsGrid.innerHTML = products
    .map((product) =>
      AIRent.createProductCard(product, {
        wishlistIds: state.wishlistIds,
        showWishlist: state.hasUser,
      }),
    )
    .join("");

  bindWishlistButtons();
}

function renderPagination(pagination) {
  state.pagination = pagination;

  if (!pagination || pagination.totalPages <= 1) {
    paginationBar.hidden = true;
    return;
  }

  paginationBar.hidden = false;
  paginationLabel.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
  previousPageBtn.disabled = !pagination.hasPreviousPage;
  nextPageBtn.disabled = !pagination.hasNextPage;
}

async function loadCategories() {
  const result = await AIRent.fetchApi("/api/v1/categories");
  const categories = result.data?.data?.categories || [];

  categorySelect.innerHTML = `
    <option value="">All categories</option>
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

  categorySelect.value = state.categoryId;
}

async function loadProducts() {
  AIRent.showMessage(pageMessage, "");
  resultsMeta.textContent = "Loading listings...";

  const query = AIRent.buildQuery({
    page: state.page,
    limit: state.limit,
    search: state.search,
    city: state.city,
    categoryId: state.categoryId,
  });
  const result = await AIRent.fetchApi(`/api/v1/products?${query}`);

  if (!result.ok || !result.data?.success) {
    AIRent.showMessage(
      pageMessage,
      result.data?.message || "Unable to load listings.",
      "error",
    );
    productsGrid.innerHTML = AIRent.createEmptyState("Try reloading the page.");
    paginationBar.hidden = true;
    return;
  }

  const products = result.data.data.products || [];
  const pagination = result.data.data.pagination;

  resultsMeta.textContent = `${pagination.totalItems} listing(s) found`;
  renderProducts(products);
  renderPagination(pagination);

  if (state.hasUser && state.search) {
    AIRent.trackBehavior({
      actionType: "search",
      searchQuery: state.search,
      metadata: {
        city: state.city || null,
        categoryId: state.categoryId || null,
      },
    });
  }
}

filtersForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.search = searchInput.value.trim();
  state.city = cityInput.value.trim();
  state.categoryId = categorySelect.value;
  state.page = 1;
  syncUrl();
  await loadProducts();
});

clearFiltersBtn.addEventListener("click", async () => {
  state.search = "";
  state.city = "";
  state.categoryId = "";
  state.page = 1;
  fillFilters();
  syncUrl();
  await loadProducts();
});

previousPageBtn.addEventListener("click", async () => {
  if (!state.pagination?.hasPreviousPage) {
    return;
  }

  state.page -= 1;
  syncUrl();
  await loadProducts();
});

nextPageBtn.addEventListener("click", async () => {
  if (!state.pagination?.hasNextPage) {
    return;
  }

  state.page += 1;
  syncUrl();
  await loadProducts();
});

(async function initializeProductsPage() {
  readStateFromUrl();
  fillFilters();

  const user = await AIRent.loadCurrentUser();
  state.hasUser = Boolean(user);
  if (user) {
    state.wishlistIds = await AIRent.fetchWishlistIds();
  }

  await loadCategories();
  await loadProducts();
})();
