import React, { useEffect, useState } from "react";
import "../styles/home.css";
import {
  fetchApi,
  fetchWishlistIds,
  getDefaultAuthenticatedPath,
  getResultMessage,
  getPrimaryImage,
  isSuccessfulResult,
  toggleWishlist,
} from "../lib/airent";
import { useMessageState, useSession } from "../lib/hooks";
import {
  CategoryCard,
  CityCard,
  EmptyState,
  MessageText,
  ProductCard,
  SectionHeading,
} from "../components/Common";
import { SiteLayout } from "../components/Layout";

const CURSOR_CONFIG = {
  home: {
    enabled: true,
    color: "#ffffff",
    targetSelector: "body",
    activeSelectors: [".market-hero", "#home-categories"],
    deactiveSelectors: [".category-grid"],
  },
};

function getCityHighlights(products) {
  const cityMap = new Map();

  for (const product of products) {
    const cityName = String(product.city || product.owner?.city || "").trim();
    if (!cityName) {
      continue;
    }

    const currentCity = cityMap.get(cityName) || {
      name: cityName,
      count: 0,
      imageUrl: getPrimaryImage(product),
    };

    currentCity.count += 1;
    cityMap.set(cityName, currentCity);
  }

  return [...cityMap.values()]
    .sort(
      (left, right) =>
        right.count - left.count || left.name.localeCompare(right.name),
    )
    .slice(0, 4);
}

function getRecommendationCacheKey(userId) {
  return `ai_rent_home_recommendations_${userId}`;
}

function readCachedRecommendations(userId) {
  if (!userId || typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(
      getRecommendationCacheKey(userId),
    );
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function writeCachedRecommendations(userId, recommendations) {
  if (!userId || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getRecommendationCacheKey(userId),
      JSON.stringify(recommendations),
    );
  } catch {
    // Ignore cache write failures and keep the in-memory state.
  }
}

export function HomePage({ page }) {
  const { user, loading, logout } = useSession();
  const [message, showMessage] = useMessageState("");
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    document.title = "AI Rent | Smarter rentals";
  }, []);

  useEffect(() => {
    if (!loading && user?.role === "admin") {
      window.location.href = getDefaultAuthenticatedPath(user);
    }
  }, [loading, user]);

  useEffect(() => {
    let active = true;

    async function loadPage() {
      if (loading || user?.role === "admin") {
        return;
      }

      const [categoriesResult, productsResult] = await Promise.all([
        fetchApi("/api/v1/categories"),
        fetchApi("/api/v1/products?limit=18"),
      ]);

      if (!active) {
        return;
      }

      const nextCategories = isSuccessfulResult(categoriesResult)
        ? categoriesResult.data?.data?.categories || []
        : [];
      const nextProducts = isSuccessfulResult(productsResult)
        ? productsResult.data?.data?.products || []
        : [];

      setCategories(nextCategories);
      setProducts(nextProducts);
      showMessage(
        !isSuccessfulResult(productsResult)
          ? getResultMessage(productsResult, "Unable to load listings.")
          : !isSuccessfulResult(categoriesResult)
            ? getResultMessage(categoriesResult, "Unable to load categories.")
            : "",
        !isSuccessfulResult(categoriesResult) || !isSuccessfulResult(productsResult)
          ? "error"
          : "",
      );

      if (!user) {
        setWishlistIds(new Set());
        setRecommendations([]);
        return;
      }

      setRecommendations(readCachedRecommendations(user.id));

      const [nextWishlistIds, recommendationResult] = await Promise.all([
        fetchWishlistIds(),
        fetchApi("/api/v1/recommendations?limit=50", {
          auth: true,
        }),
      ]);

      if (!active) {
        return;
      }

      setWishlistIds(nextWishlistIds);

      if (isSuccessfulResult(recommendationResult)) {
        const nextRecommendations =
          recommendationResult.data?.data?.recommendations || [];
        setRecommendations(nextRecommendations);
        writeCachedRecommendations(user.id, nextRecommendations);
      }
    }

    loadPage();

    return () => {
      active = false;
    };
  }, [loading, showMessage, user]);

  async function handleToggleWishlist(productId, isSaved) {
    const result = await toggleWishlist(productId, isSaved);
    if (!result.ok) {
      return;
    }

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

  const sortedCategories = [...categories].sort(
    (first, second) =>
      (second?._count?.products || 0) - (first?._count?.products || 0),
  );
  const featuredProducts = products.slice(0, 12);
  const topCategories = sortedCategories.slice(0, 4);
  const cityHighlights = getCityHighlights(products);
  const hasRecommendations = Boolean(user && recommendations.length);

  return (
    <SiteLayout
      page={page}
      cursorConfig={CURSOR_CONFIG[page]}
      user={user}
      onLogout={logout}
      assistantContext={{
        pageTitle: "AI Rent | Smarter rentals",
      }}
    >
      <MessageText message={message} />

      <section className="market-hero">
        <div className="market-hero__inner">
          <article className="intro-head">
            <p className="intro-head__eyebrow">AI Rent Marketplace</p>
            <h1>Borrow instead of buying.</h1>
            <h2>Complete marketplace for sharing valuable assets..</h2>
            <p className="intro-head__lead">
              Rent useful gear fast, or share your own items and start earning
              from them.
            </p>
            <div className="intro-head__actions">
              <a className="btn btn--primary" href="/html/products.html">
                Browse listings
              </a>
              <a
                className="btn btn--ghost intro-head__ghost"
                href={user ? "/html/my-listings.html" : "/html/register.html"}
              >
                {user ? "List items" : "Start listing"}
              </a>
            </div>
          </article>
        </div>
      </section>

      {hasRecommendations ? (
        <section
          className="section recommendation-section home-section-anchor"
          id="home-recommendations"
        >
          <div className="home-section__inner">
            <div className="recommendation-panel">
              <SectionHeading
                eyebrow="Personalized discovery"
                title="Recommended for you"
                compact
              />

              <div
                id="recommendation-panel"
                className="card-grid recommendation-grid"
                role="tabpanel"
              >
                {recommendations.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    showWishlist={Boolean(
                      user && user.id !== product.owner?.id,
                    )}
                    isSaved={wishlistIds.has(product.id)}
                    onToggleWishlist={handleToggleWishlist}
                    actionLayout="icon-top"
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section home-section-anchor" id="home-categories">
        <div className="home-section__inner">
          <SectionHeading eyebrow="Browse by type" />
          <div className="category-grid">
            {topCategories.length ? (
              topCategories.map((category) => (
                <CategoryCard category={category} key={category.id} />
              ))
            ) : (
              <EmptyState message="Categories will appear here once listings are available." />
            )}
          </div>
        </div>
      </section>

      <section className="section home-section-anchor" id="home-fresh-listings">
        <div className="home-section__inner">
          <SectionHeading
            eyebrow="Recently active"
            title="Fresh listings ready to browse"
            linkHref="/html/products.html"
            linkLabel="See all listings"
          />
          <div className="card-grid">
            {featuredProducts.length ? (
              featuredProducts.map((product) => (
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
              <EmptyState message="No products are available right now." />
            )}
          </div>
        </div>
      </section>

      <section className="section home-section-anchor" id="home-cities">
        <div className="home-section__inner">
          <SectionHeading
            eyebrow="Popular cities"
            title="Explore the most active locations"
            linkHref="/html/products.html"
            linkLabel="View all listings"
          />
          <div className="city-grid">
            {cityHighlights.length ? (
              cityHighlights.map((cityItem) => (
                <CityCard city={cityItem} key={cityItem.name} />
              ))
            ) : (
              <EmptyState message="Cities will appear here once listings are available." />
            )}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
