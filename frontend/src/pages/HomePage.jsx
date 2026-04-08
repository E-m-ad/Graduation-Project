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
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
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

        const recommendationResult = await fetchApi("/api/v1/recommendations?limit=50", {
          auth: true,
        });

        if (!active) return;

        if (recommendationResult.ok) {
          setRecommendations(
            recommendationResult.data?.data?.recommendations || [],
          );
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
  const featuredProducts = products.slice(0, 6);
  const topCategories = sortedCategories.slice(0, 4);
  const quickDiscoveryLinks = getQuickDiscoveryLinks(sortedCategories);
  const cityHighlights = getCityHighlights(products);
  const cityCount = new Set(products.map((product) => product.city).filter(Boolean)).size;
  const totalListings = pagination.totalItems || products.length || 0;
  const hasRecommendations = Boolean(user && recommendations.length);
  const showcaseProducts = getShowcaseProducts(
    recommendations,
    featuredProducts,
    hasRecommendations ? 3 : 2,
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
      title: user ? "Your account gets smarter as you browse" : "Save favorites when you are ready",
      description: user
        ? `${wishlistIds.size} saved listing${wishlistIds.size === 1 ? "" : "s"} and ${recommendations.length} recommendation${recommendations.length === 1 ? "" : "s"} keep returning users moving faster.`
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
    <SiteLayout page={page} user={user} onLogout={logout}>
      <section className="market-hero">
        <div className="market-hero__copy">
          <div className="market-hero__intro">
            <div className="market-hero__eyebrow-row">
              <p className="eyebrow">Rental marketplace</p>
              <span className="market-hero__live">Live across {formatMetric(cityCount)} cities</span>
            </div>
            <p className="market-hero__text">
              AI Rent brings high-demand items, city-aware discovery, and
              owner-friendly listing tools into one polished rental experience.
            </p>
          </div>

          <form className="market-search" onSubmit={handleSearchSubmit}>
            <div className="market-search__field">
              <label className="market-search__label" htmlFor="homeSearchQuery">
                What do you need?
              </label>
              <input
                id="homeSearchQuery"
                type="text"
                className="input market-search__input"
                placeholder="Camera, projector, tools, audio gear..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="market-search__field">
              <label className="market-search__label" htmlFor="homeSearchCity">
                Where?
              </label>
              <input
                id="homeSearchCity"
                type="text"
                className="input market-search__input"
                placeholder="Enter a city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>
            <button type="submit" className="btn btn--primary market-search__submit">
              Search listings
            </button>
          </form>

          <div className="market-hero__quicklinks">
            <span className="market-hero__quicklinks-label">Popular searches</span>
            <div className="market-chip-row">
              {quickDiscoveryLinks.map((link) => (
                <a className="market-chip" href={link.href} key={link.key}>
                  <span className="market-chip__label">{link.label}</span>
                  <span className="market-chip__note">{link.note}</span>
                </a>
              ))}
            </div>
          </div>

          <div className="market-hero__footer">
            <div className="market-hero__actions">
              <a className="btn btn--primary" href="/html/products.html">
                Browse listings
              </a>
              <a
                className="btn btn--secondary"
                href={hasRecommendations ? "#home-recommendations" : "#home-categories"}
              >
                {hasRecommendations ? "Jump to recommendations" : "Jump to categories"}
              </a>
              <a
                className="btn btn--ghost"
                href={user ? "/html/my-listings.html" : "/html/register.html"}
              >
                {user ? "Manage listings" : "List your items"}
              </a>
            </div>
            <p className="market-hero__note">{heroGreeting}</p>
          </div>

          <div className="market-hero__routes">
            <span className="market-hero__quicklinks-label">Quick routes</span>
            <div className="market-route-row">
              {homeSectionLinks.map((link) => (
                <a className="market-route-pill" href={link.href} key={link.key}>
                  <span className="market-route-pill__label">{link.label}</span>
                  <span className="market-route-pill__note">{link.note}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <aside className="market-hero__panel">
          <div className="market-hero__panel-copy">
            <p className="panel-label">Marketplace pulse</p>
          </div>

          <div className="market-showcase">
            <div className="market-showcase__header">
              <div>
                <span className="tag tag--light">
                  {user && recommendations.length ? "For you" : "Recently active"}
                </span>
                <h3>
                  {user && recommendations.length
                    ? "Recommended picks"
                    : "Listings gaining attention"}
                </h3>
              </div>
              <a href="/html/products.html">Explore all</a>
            </div>

            {showcaseProducts.length ? (
              <div className="market-showcase__list">
                {showcaseProducts.map((product) => {
                  const detailsUrl =
                    `/html/product-details.html?id=${encodeURIComponent(product.id)}`;

                  return (
                    <article className="showcase-card" key={product.id}>
                      <a className="showcase-card__media" href={detailsUrl}>
                        <img
                          className="showcase-card__image"
                          src={getPrimaryImage(product)}
                          alt={product.title || "Listing preview"}
                        />
                      </a>
                      <div className="showcase-card__body">
                        <div className="showcase-card__meta">
                          <span className="tag">
                            {product.category?.name || "General"}
                          </span>
                          <span className="showcase-card__city">
                            {product.city || product.owner?.city || "Unknown city"}
                          </span>
                        </div>
                        <h3>
                          <a href={detailsUrl}>
                            {product.title || "Untitled listing"}
                          </a>
                        </h3>
                        <p className="showcase-card__price">{getPriceLabel(product)}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState message="Featured listings will appear here as inventory grows." />
            )}
          </div>

          <div className="market-hero__support">
            <span className="market-hero__support-badge">One streamlined workflow</span>
            <p>
              Search, save, list, and manage requests without bouncing between
              disconnected tools.
            </p>
          </div>
        </aside>
      </section>

      {hasRecommendations ? (
        <section className="section recommendation-section home-section-anchor" id="home-recommendations">
          <SectionHeading
            eyebrow="Made for you"
            title="Recommendations connected to your account"
            note="Your personalized picks stay near the top, so you can reach them quickly even as the homepage grows."
          />
          <div className="recommendation-panel">
            <div className="recommendation-panel__header">
              <div className="recommendation-panel__copy">
                <p className="eyebrow">Personalized discovery</p>
                <h3>{recommendationPanelTitle}</h3>
                <p>{recommendationPanelNote}</p>
              </div>

              <div
                className="recommendation-tabs"
                role="tablist"
                aria-label="Recommendation views"
              >
                {recommendationTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={activeRecommendationTab === tab.value}
                    aria-controls="recommendation-panel"
                    className={`recommendation-tab${activeRecommendationTab === tab.value ? " is-active" : ""}`}
                    onClick={() => setActiveRecommendationTab(tab.value)}
                  >
                    <span className="recommendation-tab__label">{tab.label}</span>
                    <span className="recommendation-tab__meta">{tab.meta}</span>
                  </button>
                ))}
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
                  showWishlist={Boolean(user && user.id !== product.owner?.id)}
                  isSaved={wishlistIds.has(product.id)}
                  onToggleWishlist={handleToggleWishlist}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="section home-section-anchor" id="home-categories">
        <SectionHeading
          eyebrow="Browse by type"
          title="Popular categories renters open first"
          note="Open high-demand categories first, then move into the full marketplace with less searching and more confidence."
          linkHref="/html/products.html"
          linkLabel="Open full catalog"
        />
        <div className="category-grid">
          {topCategories.length ? (
            topCategories.map((category) => (
              <CategoryCard category={category} key={category.id} />
            ))
          ) : (
            <EmptyState message="Categories will appear here once listings are available." />
          )}
        </div>
      </section>

      <section className="section home-section-anchor" id="home-fresh-listings">
        <SectionHeading
          eyebrow="Recently active"
          title="Fresh listings ready to browse"
          note="Fresh inventory stays close to the top so renters can compare active options quickly and owners stay visible."
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
              />
            ))
          ) : (
            <EmptyState message="No products are available right now." />
          )}
        </div>
      </section>

      <section className="section home-section-anchor" id="home-cities">
        <SectionHeading
          eyebrow="Popular cities"
          title="Explore where marketplace activity is strongest"
          note="City-led discovery helps renters scan the most active locations quickly and gives owners clearer visibility."
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
      </section>

      <section className="section about-section" id="about-us">
        <SectionHeading
          eyebrow="About us"
          title="A rental project built to feel clearer, faster, and more connected"
          note="See the platform story, how the experience works, and how owners fit into the same marketplace journey."
        />

        <article className="about-project">
          <p className="about-project__lead">{projectAbstract}</p>
          <div className="about-project__facts">
            <span>{formatMetric(totalListings)} live listings</span>
            <span>{formatMetric(cityCount)} active cities</span>
            <span>{user ? "Account-aware discovery" : "Guest-friendly browsing"}</span>
          </div>
        </article>

        <div className="about-tabs" role="tablist" aria-label="About AI Rent">
          {aboutTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={activeAboutTab === tab.value}
              className={`about-tab${activeAboutTab === tab.value ? " is-active" : ""}`}
              onClick={() => setActiveAboutTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="about-panel">
          {activeAboutTab === "highlights" ? (
            <div className="market-highlights">
              {marketplaceHighlights.map((highlight) => (
                <article className="market-highlight-card" key={highlight.title}>
                  <p className="market-highlight-card__eyebrow">{highlight.eyebrow}</p>
                  <h3>{highlight.title}</h3>
                  <p>{highlight.description}</p>
                </article>
              ))}
            </div>
          ) : null}

          {activeAboutTab === "experience" ? (
            <div className="market-experience">
              <article className="market-workflow">
                <SectionHeading
                  compact
                  eyebrow="How it works"
                  title="A homepage flow built for real rental decisions"
                  note="Search, compare, save, and act without losing momentum between each step."
                />
                <div className="market-step-list">
                  {workflowSteps.map((step) => (
                    <article className="market-step-card" key={step.step}>
                      <span className="market-step-card__number">{step.step}</span>
                      <div className="market-step-card__content">
                        <h3>{step.title}</h3>
                        <p>{step.description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </article>

              <article className="market-trust">
                <p className="eyebrow">Why AI Rent</p>
                <h2>Modern, user-friendly, and designed to compete.</h2>
                <p className="market-trust__intro">
                  Whether you are renting or listing, AI Rent helps you reach the
                  right inventory faster with clearer proof, stronger context, and
                  simpler next steps.
                </p>

                <div className="market-trust__list">
                  {trustPoints.map((point) => (
                    <article className="market-trust__item" key={point.title}>
                      <h3>{point.title}</h3>
                      <p>{point.description}</p>
                    </article>
                  ))}
                </div>

                <div className="market-trust__actions">
                  <a className="btn btn--primary" href="/html/products.html">
                    Start browsing
                  </a>
                  <a
                    className="btn btn--secondary"
                    href={user ? "/html/my-listings.html" : "/html/register.html"}
                  >
                    {user ? "Open my listings" : "Create account"}
                  </a>
                </div>
              </article>
            </div>
          ) : null}

          {activeAboutTab === "owners" ? (
            <div className="market-owner-banner">
              <div className="market-owner-banner__copy">
                <p className="eyebrow">For owners and lenders</p>
                <h2>Turn unused inventory into the next booking opportunity.</h2>
                <p>
                  Publish listings, reach renters already exploring by city and
                  category, and manage requests from the same marketplace workspace.
                </p>
                <div className="market-owner-banner__actions">
                  {!user ? (
                    <a className="btn btn--primary" href="/html/register.html">
                      Sign up
                    </a>
                  ) : null}
                  {user && user.role !== "admin" ? (
                    <a className="btn btn--secondary" href="/html/my-listings.html">
                      Open my listings
                    </a>
                  ) : null}
                  <a className="btn btn--ghost" href="/html/products.html">
                    Search listings
                  </a>
                </div>
              </div>

              <div className="market-owner-banner__panel">
                <div className="market-owner-banner__metric">
                  <span className="market-owner-banner__metric-value">
                    {formatMetric(totalListings)}
                  </span>
                  <span className="market-owner-banner__metric-label">
                    live listing{totalListings === 1 ? "" : "s"} creating demand
                  </span>
                </div>
                <ul className="market-owner-banner__list">
                  <li>Lead with high-demand categories and city-aware discovery.</li>
                  <li>Keep listing management close to the customer journey.</li>
                  <li>Give renters a cleaner path from search to request.</li>
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </SiteLayout>
  );
}
