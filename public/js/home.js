const homeCategories = document.getElementById("homeCategories");
const homeProducts = document.getElementById("homeProducts");
const homeProductCount = document.getElementById("homeProductCount");
const homeCategoryCount = document.getElementById("homeCategoryCount");
const homeCityCount = document.getElementById("homeCityCount");
const recommendationsSection = document.getElementById("recommendationsSection");
const recommendedProducts = document.getElementById("recommendedProducts");

function renderCategoryCards(categories) {
  if (!categories.length) {
    homeCategories.innerHTML = AIRent.createEmptyState(
      "No categories are available yet.",
    );
    return;
  }

  homeCategories.innerHTML = categories
    .slice(0, 4)
    .map(
      (category) => `
        <article class="category-card">
          <span class="tag">${AIRent.escapeHtml(category.name)}</span>
          <h3>${AIRent.escapeHtml(category.name)}</h3>
          <p>${AIRent.escapeHtml(
            AIRent.truncateText(
              category.description || "Simple category structure for the marketplace.",
              100,
            ),
          )}</p>
          <a href="/html/products.html?categoryId=${encodeURIComponent(category.id)}">
            Browse category
          </a>
        </article>
      `,
    )
    .join("");
}

function bindWishlistButtons(container, wishlistIds) {
  container.querySelectorAll("[data-wishlist-product-id]").forEach((button) => {
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
        wishlistIds.delete(productId);
      } else {
        wishlistIds.add(productId);
      }
    });
  });
}

function renderProductCards(container, products, wishlistIds, showWishlist) {
  if (!products.length) {
    container.innerHTML = AIRent.createEmptyState(
      "No products are available right now.",
    );
    return;
  }

  container.innerHTML = products
    .map((product) =>
      AIRent.createProductCard(product, {
        wishlistIds,
        showWishlist,
      }),
    )
    .join("");

  bindWishlistButtons(container, wishlistIds);
}

(async function initializeHomePage() {
  const user = await AIRent.loadCurrentUser();
  if (user?.role === "admin") {
    window.location.href = "/html/admin-dashboard.html";
    return;
  }

  const wishlistIds = user ? await AIRent.fetchWishlistIds() : new Set();

  const [categoriesResult, productsResult] = await Promise.all([
    AIRent.fetchApi("/api/v1/categories"),
    AIRent.fetchApi("/api/v1/products?limit=6"),
  ]);

  const categories = categoriesResult.data?.data?.categories || [];
  const products = productsResult.data?.data?.products || [];
  const pagination = productsResult.data?.data?.pagination || {};

  renderCategoryCards(
    [...categories].sort(
      (first, second) =>
        (second?._count?.products || 0) - (first?._count?.products || 0),
    ),
  );
  renderProductCards(homeProducts, products, wishlistIds, Boolean(user));

  homeProductCount.textContent = String(pagination.totalItems || products.length || 0);
  homeCategoryCount.textContent = String(categories.length || 0);
  homeCityCount.textContent = String(
    new Set(products.map((product) => product.city).filter(Boolean)).size,
  );

  if (user) {
    const recommendationResult = await AIRent.fetchApi(
      "/api/v1/recommendations?limit=3",
      { auth: true },
    );

    const recommendations =
      recommendationResult.data?.data?.recommendations || [];

    if (recommendationResult.ok && recommendations.length) {
      recommendationsSection.hidden = false;
      renderProductCards(
        recommendedProducts,
        recommendations,
        wishlistIds,
        true,
      );
    }
  }
})();
