import React, { useEffect, useState } from "react";
import {
  buildQuery,
  fetchApi,
  fetchWishlistIds,
  getDefaultAuthenticatedPath,
  getPriceLabel,
  getPrimaryImage,
  toggleWishlist,
} from "../lib/airent";
import { useSession } from "../lib/hooks";
import {
  CategoryCard,
  CityCard,
  EmptyState,
  ProductCard,
  SectionHeading,
} from "../components/Common";
import { SiteLayout } from "../components/Layout";

// Change these selectors later to control where the home cursor appears or is disabled.
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
    if (!cityName) continue;

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

function getQuickDiscoveryLinks(categories) {
  if (categories.length) {
    return categories.slice(0, 6).map((category) => {
      const listingCount = Number(category?._count?.products || 0);

      return {
        key: category.id,
        label: category.name,
        note: listingCount
          ? `${listingCount} listing${listingCount === 1 ? "" : "s"}`
          : "Browse now",
        href: `/html/products.html?categoryId=${encodeURIComponent(category.id)}`,
      };
    });
  }

  return [
    {
      key: "cameras",
      label: "Cameras",
      note: "Explore gear",
      href: `/html/products.html?${buildQuery({ search: "Camera" })}`,
    },
    {
      key: "tools",
      label: "Tools",
      note: "Browse essentials",
      href: `/html/products.html?${buildQuery({ search: "Tools" })}`,
    },
    {
      key: "events",
      label: "Event kit",
      note: "Discover setups",
      href: `/html/products.html?${buildQuery({ search: "Event" })}`,
    },
    {
      key: "audio",
      label: "Audio",
      note: "Speakers and mics",
      href: `/html/products.html?${buildQuery({ search: "Audio" })}`,
    },
  ];
}

function getShowcaseProducts(primaryProducts, fallbackProducts, limit = 3) {
  const seenIds = new Set();

  return [...primaryProducts, ...fallbackProducts]
    .filter((product) => {
      if (!product?.id || seenIds.has(product.id)) {
        return false;
      }

      seenIds.add(product.id);
      return true;
    })
    .slice(0, limit);
}

function mergeProductsById(previousProducts, nextProducts) {
  const mergedById = new Map();
  const orderedProducts = [];
  const seenIds = new Set();

  for (const product of nextProducts) {
    if (product?.id) {
      mergedById.set(product.id, product);
    }
  }

  for (const product of previousProducts) {
    if (product?.id && !mergedById.has(product.id)) {
      mergedById.set(product.id, product);
    }
  }

  for (const product of [...nextProducts, ...previousProducts]) {
    if (!product?.id) {
      orderedProducts.push(product);
      continue;
    }

    if (seenIds.has(product.id)) {
      continue;
    }

    orderedProducts.push(mergedById.get(product.id) || product);
    seenIds.add(product.id);
  }

  return orderedProducts;
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

function formatMetric(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

export function HomePage({ page }) {
  const { user, loading, logout } = useSession();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({});
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [recommendations, setRecommendations] = useState([]);
  const [activeAboutTab, setActiveAboutTab] = useState("highlights");
  const [activeRecommendationTab, setActiveRecommendationTab] = useState("all");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");

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

      setCategories(categoriesResult.data?.data?.categories || []);
      setProducts(productsResult.data?.data?.products || []);
      setPagination(productsResult.data?.data?.pagination || {});

      if (user) {
        const nextWishlistIds = await fetchWishlistIds();
        if (!active) return;
        setWishlistIds(nextWishlistIds);
        setRecommendations(readCachedRecommendations(user.id));

        const recommendationResult = await fetchApi(
          "/api/v1/recommendations?limit=50",
          {
            auth: true,
          },
        );

        if (!active) return;

        if (recommendationResult.ok) {
          const nextRecommendations =
            recommendationResult.data?.data?.recommendations || [];
          setRecommendations(nextRecommendations);
          writeCachedRecommendations(user.id, nextRecommendations);
        }
      } else {
        setWishlistIds(new Set());
        setRecommendations([]);
      }
    }

    loadPage();

    return () => {
      active = false;
    };
  }, [loading, user]);

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

    if (user?.id) {
      writeCachedRecommendations(user.id, recommendations);
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    const query = buildQuery({
      search: search.trim(),
      city: city.trim(),
    });

    window.location.href = query
      ? `/html/products.html?${query}`
      : "/html/products.html";
  }

  const sortedCategories = [...categories].sort(
    (first, second) =>
      (second?._count?.products || 0) - (first?._count?.products || 0),
  );
  const featuredProducts = products.slice(0, 12);
  const topCategories = sortedCategories.slice(0, 4);
  const quickDiscoveryLinks = getQuickDiscoveryLinks(sortedCategories);
  const cityHighlights = getCityHighlights(products);
  const cityCount = new Set(
    products.map((product) => product.city).filter(Boolean),
  ).size;
  const totalListings = pagination.totalItems || products.length || 0;
  const hasRecommendations = Boolean(user && recommendations.length);
  const showcaseProducts = getShowcaseProducts(
    recommendations,
    featuredProducts,
    3,
  );
  const heroGreeting = user
    ? `Welcome back, ${user.name}. Your saved listings and marketplace picks are ready.`
    : "Browse as a guest now, then sign in to save favorites and unlock tailored recommendations.";

  const marketplaceHighlights = [
    {
      eyebrow: "Search-first experience",
      title: "Jump from idea to inventory fast",
      description:
        "Use keyword and city search together so renters land on relevant listings without digging through the whole catalog.",
    },
    {
      eyebrow: user ? "Tailored discovery" : "Simple account upgrade",
      title: user
        ? "Your account gets smarter as you browse"
        : "Save favorites when you are ready",
      description: user
        ? recommendations.length || wishlistIds.size
          ? `${wishlistIds.size} saved listing${wishlistIds.size === 1 ? "" : "s"} and ${recommendations.length} recommendation${recommendations.length === 1 ? "" : "s"} keep returning users moving faster.`
          : "Start browsing, searching, or saving items first, then personalized recommendations will appear from your real activity."
        : "Guests can browse everything, while signed-in users unlock saved listings and personalized recommendations.",
    },
    {
      eyebrow: "Built for owners",
      title: "List, manage, and respond in one place",
      description:
        "Owners can publish listings, manage requests, and keep their rental workflow inside the same polished marketplace shell.",
    },
  ];

  const workflowSteps = [
    {
      step: "01",
      title: "Search with intent",
      description:
        "Start with a keyword, narrow by city, and use the homepage to move directly into the live listings feed.",
    },
    {
      step: "02",
      title: "Compare active options",
      description:
        "Browse fresh inventory, clear pricing, and category context without losing the fastest routes back into discovery.",
    },
    {
      step: "03",
      title: "Save or manage the next action",
      description:
        "Renters can save promising items, and owners can switch into listing management from the same account experience.",
    },
  ];

  const trustPoints = [
    {
      title: "Live marketplace proof",
      description: `AI Rent is already surfacing ${formatMetric(totalListings)} active listing${totalListings === 1 ? "" : "s"} across ${formatMetric(cityCount)} city hub${cityCount === 1 ? "" : "s"}.`,
    },
    {
      title: "Clear discovery paths",
      description: `Popular categories, city highlights, and fresh listings make it easier to enter the marketplace from the angle that fits the renter best.`,
    },
    {
      title: "One account, less friction",
      description:
        "Move from browsing to saved items, tailored picks, and listing management without restarting the journey somewhere else.",
    },
  ];
  const aboutTabs = [
    { value: "highlights", label: "Highlights" },
    { value: "experience", label: "Experience" },
    { value: "owners", label: "For owners" },
  ];
  const recommendationTabs = [
    {
      value: "all",
      label: "All recommendations",
      meta: `${formatMetric(recommendations.length)} pick${recommendations.length === 1 ? "" : "s"}`,
    },
    {
      value: "top",
      label: "Top pick",
      meta: "Your strongest match first",
    },
  ];
  const activeRecommendationProducts =
    activeRecommendationTab === "top"
      ? recommendations.slice(0, 1)
      : recommendations;
  const recommendationPanelTitle =
    activeRecommendationTab === "top"
      ? "Your strongest recommendation right now"
      : `All ${formatMetric(recommendations.length)} personalized recommendation${recommendations.length === 1 ? "" : "s"} in one place`;
  const recommendationPanelNote =
    activeRecommendationTab === "top"
      ? "Keep one standout match front and center when you want the fastest next step."
      : "Every recommendation returned for your account is visible here, so you can compare the full personalized set without leaving the homepage.";
  const homeSectionLinks = [
    hasRecommendations
      ? {
          key: "recommendations",
          label: "For you",
          note: `${formatMetric(recommendations.length)} picks`,
          href: "#home-recommendations",
        }
      : null,
    {
      key: "categories",
      label: "Categories",
      note: `${formatMetric(topCategories.length)} popular`,
      href: "#home-categories",
    },
    {
      key: "fresh-listings",
      label: "Fresh listings",
      note: `${formatMetric(featuredProducts.length)} shown`,
      href: "#home-fresh-listings",
    },
    {
      key: "cities",
      label: "Cities",
      note: `${formatMetric(cityHighlights.length)} hotspots`,
      href: "#home-cities",
    },
  ].filter(Boolean);
  const projectAbstract =
    "AI Rent is a rental marketplace project built to make item discovery, booking decisions, and listing management simpler for both renters and owners. It brings search, recommendations, moderation, and request handling into one connected experience instead of sending people across disconnected tools.";

  return (
    <SiteLayout
      page={page}
      cursorConfig={CURSOR_CONFIG[page]}
      user={user}
      onLogout={logout}
    >
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
            {/* <form className="market-search" onSubmit={handleSearchSubmit}>
              <div className="market-search__field">
                <input
                  id="homeSearchQuery"
                  type="text"
                  className="input market-search__input"
                  placeholder="Search..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="market-search__field">
                <input
                  id="homeSearchCity"
                  type="text"
                  className="input market-search__input"
                  placeholder="City"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
              </div>
              <button
                type="submit"
                className="btn btn--primary market-search__submit"
              >
                Search
              </button>
            </form> */}
          </article>
          {/*
            
          */}
        </div>
      </section>
      {/* <section className="search">
        <div className="market-hero__intro">
          <h1>Borrow instead of buying</h1>
        </div>
       
      </section> */}
      {hasRecommendations ? (
        <section
          className="section recommendation-section home-section-anchor"
          id="home-recommendations"
        >
          <div className="home-section__inner">
            <div className="recommendation-panel">
              <div className="recommendation-panel__header">
                <div className="recommendation-panel__copy">
                  <p className="eyebrow">Personalized discovery</p>
                </div>
              </div>

              <div
                id="recommendation-panel"
                className="card-grid recommendation-grid"
                role="tabpanel"
              >
                {activeRecommendationProducts.map((product) => (
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
