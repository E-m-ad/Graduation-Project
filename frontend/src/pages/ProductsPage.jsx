import React, { useEffect, useRef, useState } from "react";
import {
  fetchApi,
  fetchWishlistIds,
  replaceUrl,
  toggleWishlist,
  trackBehavior,
} from "../lib/airent";
import { useMessageState, useSession } from "../lib/hooks";
import {
  EmptyState,
  MessageText,
  PaginationBar,
  ProductCard,
  SectionHeading,
} from "../components/Common";
import { SiteLayout } from "../components/Layout";
import { de } from "zod/locales";

function readFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    page: Math.max(Number(params.get("page") || "1") || 1, 1),
    search: params.get("search") || "",
    city: params.get("city") || "",
    categoryId: params.get("categoryId") || "",
  };
}
const CURSOR_CONFIG = {
  products: {
    enabled: true,
    color: "#ffffff",
    targetSelector: "body",
    activeSelectors: [".listings-hero"],
    deactiveSelectors: [".listings-search-panel"],
  },
};
export function ProductsPage({ page }) {
  const initialFilters = readFiltersFromUrl();
  const { user, loading, logout } = useSession();
  const categoryMenuRef = useRef(null);
  const [filters, setFilters] = useState(initialFilters);
  const [formState, setFormState] = useState(initialFilters);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [message, showMessage] = useMessageState("Loading listings...");

  useEffect(() => {
    document.title = "Browse Listings | AI Rent";
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      if (loading) {
        return;
      }

      const result = await fetchApi("/api/v1/categories");
      if (!active) return;
      setCategories(result.data?.data?.categories || []);
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, [loading]);

  useEffect(() => {
    let active = true;

    async function loadWishlist() {
      if (loading) return;

      if (user) {
        const nextWishlistIds = await fetchWishlistIds();
        if (!active) return;
        setWishlistIds(nextWishlistIds);
      } else {
        setWishlistIds(new Set());
      }
    }

    loadWishlist();

    return () => {
      active = false;
    };
  }, [loading, user]);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      if (loading) {
        return;
      }

      setLoadingProducts(true);
      showMessage("");

      const query = new URLSearchParams({
        page: String(filters.page),
        limit: "9",
      });

      if (filters.search) query.set("search", filters.search);
      if (filters.city) query.set("city", filters.city);
      if (filters.categoryId) query.set("categoryId", filters.categoryId);

      replaceUrl("/html/products.html", {
        page: filters.page > 1 ? filters.page : "",
        search: filters.search,
        city: filters.city,
        categoryId: filters.categoryId,
      });

      const result = await fetchApi(`/api/v1/products?${query.toString()}`);
      if (!active) return;

      setLoadingProducts(false);

      if (!result.ok || !result.data?.success) {
        showMessage(
          result.data?.message || "Unable to load listings.",
          "error",
        );
        setProducts([]);
        setPagination(null);
        return;
      }

      const nextProducts = result.data.data?.products || [];
      const nextPagination = result.data.data?.pagination || null;
      setProducts(nextProducts);
      setPagination(nextPagination);

      if (user && filters.search) {
        trackBehavior({
          actionType: "search",
          searchQuery: filters.search,
          metadata: {
            city: filters.city || null,
            categoryId: filters.categoryId || null,
          },
        });
      }
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, [filters, loading, showMessage, user]);

  useEffect(() => {
    if (!isCategoryMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!categoryMenuRef.current?.contains(event.target)) {
        setIsCategoryMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsCategoryMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCategoryMenuOpen]);

  async function handleToggleWishlist(productId, isSaved) {
    const result = await toggleWishlist(productId, isSaved);
    if (!result.ok) return;

    setWishlistIds((previous) => {
      const next = new Set(previous);
      if (isSaved) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    setIsCategoryMenuOpen(false);
    setFilters({
      ...filters,
      page: 1,
      search: formState.search.trim(),
      city: formState.city.trim(),
      categoryId: formState.categoryId,
    });
  }

  function handleClear() {
    setIsCategoryMenuOpen(false);
    const nextState = {
      page: 1,
      search: "",
      city: "",
      categoryId: "",
    };
    setFormState(nextState);
    setFilters(nextState);
  }

  function handleCategorySelect(categoryId) {
    setFormState((previous) => ({
      ...previous,
      categoryId,
    }));
    setIsCategoryMenuOpen(false);
  }

  const selectedCategory = categories.find(
    (category) => category.id === formState.categoryId,
  );
  const selectedCategoryLabel = selectedCategory?.name
    ? selectedCategory.name
    : formState.categoryId
      ? "Selected category"
      : "All categories";

  const resultsMeta =
    loadingProducts && !products.length
      ? "Loading listings..."
      : `${pagination?.totalItems || products.length} listing(s) found`;

  return (
    <SiteLayout
      page={page}
      user={user}
      onLogout={logout}
      cursorConfig={CURSOR_CONFIG[page]}
    >
      <section className="listings-hero">
        <div className="listing-hero-inner">
          <div className="listings-search-panel__header">
            <p className="eyebrow">Search Listings</p>
          </div>
          <div className="surface-panel listings-search-panel">
            <form className="listings-search-grid" onSubmit={handleSubmit}>
              <div className="field">
                {/* <label htmlFor="searchInput">Search</label> */}
                <input
                  id="searchInput"
                  type="text"
                  className="input"
                  placeholder="Search by title or description"
                  value={formState.search}
                  onChange={(event) =>
                    setFormState((previous) => ({
                      ...previous,
                      search: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="field">
                {/* <label htmlFor="cityInput">City</label> */}
                <input
                  id="cityInput"
                  type="text"
                  className="input"
                  placeholder="Filter by city"
                  value={formState.city}
                  onChange={(event) =>
                    setFormState((previous) => ({
                      ...previous,
                      city: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="field">
                <div
                  className={`category-picker${isCategoryMenuOpen ? " is-open" : ""}`}
                  ref={categoryMenuRef}
                >
                  <button
                    id="categorySelect"
                    type="button"
                    className="input category-picker__trigger"
                    aria-label="Choose category"
                    aria-expanded={isCategoryMenuOpen}
                    aria-haspopup="listbox"
                    aria-controls="categorySelectMenu"
                    onClick={() =>
                      setIsCategoryMenuOpen((previous) => !previous)
                    }
                  >
                    <span
                      className={`category-picker__trigger-text${
                        formState.categoryId ? "" : " is-placeholder"
                      }`}
                    >
                      {selectedCategoryLabel}
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

                  {isCategoryMenuOpen ? (
                    <div
                      id="categorySelectMenu"
                      className="category-picker__menu"
                      role="listbox"
                      aria-label="Category options"
                    >
                      <button
                        type="button"
                        className={`category-picker__option${
                          !formState.categoryId ? " is-selected" : ""
                        }`}
                        role="option"
                        aria-selected={!formState.categoryId}
                        onClick={() => handleCategorySelect("")}
                      >
                        <span className="category-picker__option-title">
                          All categories
                        </span>
                      </button>

                      {categories.map((category) => {
                        const listingCount = Number(
                          category?._count?.products || 0,
                        );

                        return (
                          <button
                            type="button"
                            key={category.id}
                            className={`category-picker__option${
                              formState.categoryId === category.id
                                ? " is-selected"
                                : ""
                            }`}
                            role="option"
                            aria-selected={formState.categoryId === category.id}
                            onClick={() => handleCategorySelect(category.id)}
                          >
                            <span className="category-picker__option-title">
                              {category.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="filters-actions">
                <button type="submit" className="btn btn--primary">
                  Apply Filters
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={handleClear}
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="section">
        <SectionHeading eyebrow="Results">
          <p className="section-note">{resultsMeta}</p>
        </SectionHeading>

        <MessageText message={message} />
        <div className="card-grid">
          {products.length ? (
            products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                showWishlist={Boolean(user && user.id !== product.owner?.id)}
                isSaved={wishlistIds.has(product.id)}
                onToggleWishlist={handleToggleWishlist}
                actionLayout="icon-top"
              />
            ))
          ) : (
            <EmptyState
              message={
                loadingProducts
                  ? "Loading listings..."
                  : "No listings matched your current filters."
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
    </SiteLayout>
  );
}
