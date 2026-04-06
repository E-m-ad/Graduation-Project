import React, { useEffect, useState } from "react";
import {
  fetchApi,
  fetchWishlistIds,
  replaceUrl,
  toggleWishlist,
  trackBehavior,
} from "../lib/airent";
import { useMessageState, useSession } from "../lib/hooks";
import { EmptyState, MessageText, PaginationBar, ProductCard, SectionHeading } from "../components/Common";
import { SiteLayout } from "../components/Layout";

function readFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    page: Math.max(Number(params.get("page") || "1") || 1, 1),
    search: params.get("search") || "",
    city: params.get("city") || "",
    categoryId: params.get("categoryId") || "",
  };
}

export function ProductsPage({ page }) {
  const initialFilters = readFiltersFromUrl();
  const { user, loading, logout } = useSession();
  const [filters, setFilters] = useState(initialFilters);
  const [formState, setFormState] = useState(initialFilters);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [loadingProducts, setLoadingProducts] = useState(true);
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
        showMessage(result.data?.message || "Unable to load listings.", "error");
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
    setFilters({
      ...filters,
      page: 1,
      search: formState.search.trim(),
      city: formState.city.trim(),
      categoryId: formState.categoryId,
    });
  }

  function handleClear() {
    const nextState = {
      page: 1,
      search: "",
      city: "",
      categoryId: "",
    };
    setFormState(nextState);
    setFilters(nextState);
  }

  const resultsMeta =
    loadingProducts && !products.length
      ? "Loading listings..."
      : `${pagination?.totalItems || products.length} listing(s) found`;

  return (
    <SiteLayout page={page} user={user} onLogout={logout}>
      <section className="listings-hero">
        <div className="listings-hero__copy">
          <p className="eyebrow">Search Listings</p>
          <h1>Browse rentals by keyword, city, and category.</h1>
          <p>
            Use the live search controls below to filter available listings and
            keep the current state directly in the URL.
          </p>
        </div>

        <div className="surface-panel listings-search-panel">
          <form className="listings-search-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="searchInput">Search</label>
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
              <label htmlFor="cityInput">City</label>
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
              <label htmlFor="categorySelect">Category</label>
              <select
                id="categorySelect"
                className="input"
                value={formState.categoryId}
                onChange={(event) =>
                  setFormState((previous) => ({
                    ...previous,
                    categoryId: event.target.value,
                  }))
                }
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
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
      </section>

      <section className="section">
        <SectionHeading eyebrow="Results" title="Available listings">
          <p className="section-note">{resultsMeta}</p>
        </SectionHeading>

        <MessageText message={message} />
        <div className="card-grid">
          {products.length ? (
            products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                showWishlist={Boolean(user)}
                isSaved={wishlistIds.has(product.id)}
                onToggleWishlist={handleToggleWishlist}
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
