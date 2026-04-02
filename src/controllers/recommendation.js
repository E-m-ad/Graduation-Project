import db from "../database/db.js";
import z from "../utils/recommendation.zod.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const PERSONALIZED_CANDIDATE_LIMIT = 120;
const SIMILAR_CANDIDATE_LIMIT = 80;
const PUBLIC_PRODUCT_STATUSES = ["available", "rented", "unavailable"];

const PRODUCT_CARD_SELECT = {
  id: true,
  ownerId: true,
  categoryId: true,
  title: true,
  description: true,
  pricePerHour: true,
  pricePerDay: true,
  pricePerWeek: true,
  pricePerMonth: true,
  securityDeposit: true,
  city: true,
  status: true,
  condition: true,
  avgRating: true,
  totalReviews: true,
  totalRentals: true,
  viewCount: true,
  isFeatured: true,
  tags: true,
  createdAt: true,
  owner: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      city: true,
      isVerified: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      iconUrl: true,
    },
  },
  images: {
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      imageUrl: true,
      thumbnailUrl: true,
      isPrimary: true,
    },
  },
};

function buildPagination(page, limit, totalItems) {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function roundScore(value) {
  return Number(value.toFixed(2));
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function tokenizeText(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function getPrimaryPrice(product) {
  const numericPrices = [
    product.pricePerHour,
    product.pricePerDay,
    product.pricePerWeek,
    product.pricePerMonth,
  ]
    .map((price) => (price == null ? null : Number(price)))
    .filter((price) => price != null);

  if (numericPrices.length === 0) {
    return null;
  }

  return Math.min(...numericPrices);
}

function getBehaviorWeight(actionType) {
  const weightMap = {
    view: 1,
    search: 1.5,
    wishlist: 4,
    rent: 6,
    review: 5,
    share: 1.5,
    click_recommendation: 2.5,
  };

  return weightMap[actionType] ?? 1;
}

function incrementMapValue(map, key, incrementBy) {
  if (!key || incrementBy <= 0) {
    return;
  }

  map.set(key, (map.get(key) ?? 0) + incrementBy);
}

function getTopMapKeys(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

function applyProductSignal(profile, product, weight, markStrong = false) {
  if (!product) {
    return;
  }

  incrementMapValue(profile.categoryScores, product.categoryId, weight * 2);
  incrementMapValue(profile.cityScores, normalizeText(product.city), weight);

  for (const tag of Array.isArray(product.tags) ? product.tags : []) {
    incrementMapValue(profile.tagScores, normalizeText(tag), weight);
  }

  if (markStrong) {
    profile.strongProductIds.add(product.id);
  }
}

function applySearchSignal(profile, searchQuery, weight) {
  for (const token of tokenizeText(searchQuery)) {
    incrementMapValue(profile.searchTermScores, token, weight);
  }
}

function buildPopularityScore(product) {
  const avgRating = product.avgRating == null ? 0 : Number(product.avgRating);
  const totalRentals = product.totalRentals ?? 0;
  const totalReviews = product.totalReviews ?? 0;
  const viewCount = product.viewCount ?? 0;

  return (
    avgRating * 4 +
    totalRentals * 1.5 +
    totalReviews * 0.8 +
    Math.min(viewCount, 1000) * 0.02 +
    (product.isFeatured ? 3 : 0)
  );
}

function formatScoredProduct(product, score, reasons) {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    pricePerHour: product.pricePerHour,
    pricePerDay: product.pricePerDay,
    pricePerWeek: product.pricePerWeek,
    pricePerMonth: product.pricePerMonth,
    securityDeposit: product.securityDeposit,
    city: product.city,
    status: product.status,
    condition: product.condition,
    avgRating: product.avgRating,
    totalReviews: product.totalReviews,
    totalRentals: product.totalRentals,
    viewCount: product.viewCount,
    isFeatured: product.isFeatured,
    createdAt: product.createdAt,
    owner: product.owner,
    category: product.category,
    images: product.images,
    recommendationScore: roundScore(score),
    recommendationReasons: reasons,
  };
}

async function fetchPublicProducts(where = {}, take = PERSONALIZED_CANDIDATE_LIMIT) {
  return db.product.findMany({
    where: {
      isApproved: true,
      status: {
        in: PUBLIC_PRODUCT_STATUSES,
      },
      ...where,
    },
    take,
    orderBy: [{ createdAt: "desc" }],
    select: PRODUCT_CARD_SELECT,
  });
}

async function buildUserPreferenceProfile(userId) {
  const [behaviors, wishlists, rentals, reviews] = await db.$transaction([
    db.userBehavior.findMany({
      where: { userId },
      take: 200,
      orderBy: [{ createdAt: "desc" }],
      select: {
        actionType: true,
        categoryId: true,
        searchQuery: true,
        product: {
          select: {
            id: true,
            categoryId: true,
            city: true,
            tags: true,
          },
        },
      },
    }),
    db.wishlist.findMany({
      where: { userId },
      select: {
        product: {
          select: {
            id: true,
            categoryId: true,
            city: true,
            tags: true,
          },
        },
      },
    }),
    db.rental.findMany({
      where: {
        renterId: userId,
        status: {
          in: ["approved", "active", "completed"],
        },
      },
      select: {
        product: {
          select: {
            id: true,
            categoryId: true,
            city: true,
            tags: true,
          },
        },
      },
    }),
    db.review.findMany({
      where: { reviewerId: userId },
      select: {
        product: {
          select: {
            id: true,
            categoryId: true,
            city: true,
            tags: true,
          },
        },
      },
    }),
  ]);

  const profile = {
    categoryScores: new Map(),
    cityScores: new Map(),
    tagScores: new Map(),
    searchTermScores: new Map(),
    strongProductIds: new Set(),
  };

  for (const behavior of behaviors) {
    const weight = getBehaviorWeight(behavior.actionType);
    applyProductSignal(profile, behavior.product, weight, false);
    incrementMapValue(profile.categoryScores, behavior.categoryId, weight);
    applySearchSignal(profile, behavior.searchQuery, weight);
  }

  for (const wishlist of wishlists) {
    applyProductSignal(profile, wishlist.product, 5, true);
  }

  for (const rental of rentals) {
    applyProductSignal(profile, rental.product, 6, true);
  }

  for (const review of reviews) {
    applyProductSignal(profile, review.product, 5, true);
  }

  profile.hasSignals =
    profile.categoryScores.size > 0 ||
    profile.cityScores.size > 0 ||
    profile.tagScores.size > 0 ||
    profile.searchTermScores.size > 0;

  return profile;
}

function scoreRecommendedProduct(product, profile, userId) {
  if (product.ownerId === userId || profile.strongProductIds.has(product.id)) {
    return null;
  }

  let score = buildPopularityScore(product);
  const reasons = [];

  const categoryScore = profile.categoryScores.get(product.categoryId) ?? 0;
  if (categoryScore > 0) {
    score += categoryScore;
    reasons.push("matches categories you interact with");
  }

  const cityScore = profile.cityScores.get(normalizeText(product.city)) ?? 0;
  if (cityScore > 0) {
    score += cityScore;
    reasons.push("matches your preferred locations");
  }

  let matchedTags = 0;
  for (const tag of Array.isArray(product.tags) ? product.tags : []) {
    const tagScore = profile.tagScores.get(normalizeText(tag)) ?? 0;
    if (tagScore > 0) {
      matchedTags += 1;
      score += tagScore;
    }
  }

  if (matchedTags > 0) {
    reasons.push("matches tags you engage with");
  }

  const haystack = [
    normalizeText(product.title),
    normalizeText(product.description),
    ...(Array.isArray(product.tags) ? product.tags.map(normalizeText) : []),
  ].join(" ");

  let matchedSearchTerms = 0;
  for (const [token, tokenScore] of profile.searchTermScores.entries()) {
    if (haystack.includes(token)) {
      matchedSearchTerms += 1;
      score += tokenScore * 1.2;
    }
  }

  if (matchedSearchTerms > 0) {
    reasons.push("relates to your recent searches");
  }

  if (product.isFeatured) {
    reasons.push("featured listing");
  }

  return {
    product,
    score,
    reasons: [...new Set(reasons)],
  };
}

function scoreSimilarProduct(baseProduct, candidate) {
  let score = 0;
  const reasons = [];

  if (candidate.categoryId === baseProduct.categoryId) {
    score += 40;
    reasons.push("same category");
  }

  const baseTags = new Set(
    (Array.isArray(baseProduct.tags) ? baseProduct.tags : []).map(normalizeText),
  );
  const candidateTags = (Array.isArray(candidate.tags) ? candidate.tags : []).map(
    normalizeText,
  );
  const sharedTagCount = candidateTags.filter((tag) => baseTags.has(tag)).length;
  if (sharedTagCount > 0) {
    score += Math.min(sharedTagCount * 7, 28);
    reasons.push("shared tags");
  }

  if (
    normalizeText(baseProduct.city) &&
    normalizeText(baseProduct.city) === normalizeText(candidate.city)
  ) {
    score += 10;
    reasons.push("same city");
  }

  if (candidate.condition === baseProduct.condition) {
    score += 4;
    reasons.push("similar condition");
  }

  const basePrice = getPrimaryPrice(baseProduct);
  const candidatePrice = getPrimaryPrice(candidate);
  if (basePrice != null && candidatePrice != null) {
    const diffRatio =
      Math.abs(basePrice - candidatePrice) / Math.max(basePrice, candidatePrice, 1);
    const priceScore = Math.max(0, 10 - diffRatio * 10);
    if (priceScore > 0) {
      score += priceScore;
      reasons.push("similar price range");
    }
  }

  score += buildPopularityScore(candidate) * 0.4;

  return {
    product: candidate,
    score,
    reasons: [...new Set(reasons)],
  };
}

async function getRecommendations(req, res) {
  const data = z.recommendationQuerySchema.safeParse(req.query);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  const page = data.data.page ?? DEFAULT_PAGE;
  const limit = Math.min(data.data.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  try {
    const profile = await buildUserPreferenceProfile(req.user.id);
    const topCategoryIds = getTopMapKeys(profile.categoryScores, 3);
    const topTags = getTopMapKeys(profile.tagScores, 5);

    const candidateFilters = [];
    if (topCategoryIds.length > 0) {
      candidateFilters.push({ categoryId: { in: topCategoryIds } });
    }

    if (topTags.length > 0) {
      candidateFilters.push({ tags: { hasSome: topTags } });
    }

    const candidates =
      candidateFilters.length > 0
        ? await fetchPublicProducts(
            {
              ownerId: { not: req.user.id },
              OR: candidateFilters,
            },
            PERSONALIZED_CANDIDATE_LIMIT,
          )
        : await fetchPublicProducts(
            {
              ownerId: { not: req.user.id },
            },
            PERSONALIZED_CANDIDATE_LIMIT,
          );

    let scoredProducts = candidates
      .map((product) => scoreRecommendedProduct(product, profile, req.user.id))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    let strategy = profile.hasSignals ? "personalized" : "popularity_fallback";
    let fallbackUsed = !profile.hasSignals;

    if (scoredProducts.length === 0) {
      const fallbackProducts = await fetchPublicProducts(
        {
          ownerId: { not: req.user.id },
        },
        PERSONALIZED_CANDIDATE_LIMIT,
      );

      scoredProducts = fallbackProducts
        .filter((product) => !profile.strongProductIds.has(product.id))
        .map((product) => ({
          product,
          score: buildPopularityScore(product),
          reasons: [
            product.isFeatured ? "featured listing" : "popular with other users",
          ],
        }))
        .sort((a, b) => b.score - a.score);

      strategy = "popularity_fallback";
      fallbackUsed = true;
    }

    const totalItems = scoredProducts.length;
    const offset = (page - 1) * limit;
    const recommendations = scoredProducts
      .slice(offset, offset + limit)
      .map((item) => formatScoredProduct(item.product, item.score, item.reasons));

    return res.status(200).json({
      success: true,
      data: {
        recommendations,
        pagination: buildPagination(page, limit, totalItems),
        strategy,
        fallbackUsed,
      },
    });
  } catch (error) {
    console.error("getRecommendations error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch personalized recommendations",
    });
  }
}

async function getSimilarProducts(req, res) {
  const paramsData = z.similarProductParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const queryData = z.recommendationQuerySchema.safeParse(req.query);
  if (!queryData.success) {
    return res.status(400).json({
      success: false,
      message: queryData.error.issues[0].message,
    });
  }

  const page = queryData.data.page ?? DEFAULT_PAGE;
  const limit = Math.min(queryData.data.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  try {
    const product = await db.product.findFirst({
      where: {
        id: paramsData.data.productId,
        isApproved: true,
        status: {
          in: PUBLIC_PRODUCT_STATUSES,
        },
      },
      select: PRODUCT_CARD_SELECT,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const candidateFilters = [{ categoryId: product.categoryId }];
    if (normalizeText(product.city)) {
      candidateFilters.push({ city: product.city });
    }

    if (Array.isArray(product.tags) && product.tags.length > 0) {
      candidateFilters.push({ tags: { hasSome: product.tags } });
    }

    let candidates = await fetchPublicProducts(
      {
        id: { not: product.id },
        OR: candidateFilters,
      },
      SIMILAR_CANDIDATE_LIMIT,
    );

    if (candidates.length === 0) {
      candidates = await fetchPublicProducts(
        {
          id: { not: product.id },
        },
        SIMILAR_CANDIDATE_LIMIT,
      );
    }

    const scoredProducts = candidates
      .map((candidate) => scoreSimilarProduct(product, candidate))
      .sort((a, b) => b.score - a.score);

    const totalItems = scoredProducts.length;
    const offset = (page - 1) * limit;
    const similarProducts = scoredProducts
      .slice(offset, offset + limit)
      .map((item) => formatScoredProduct(item.product, item.score, item.reasons));

    return res.status(200).json({
      success: true,
      data: {
        product: formatScoredProduct(product, 0, []),
        similarProducts,
        pagination: buildPagination(page, limit, totalItems),
      },
    });
  } catch (error) {
    console.error("getSimilarProducts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch similar products",
    });
  }
}

export default {
  getRecommendations,
  getSimilarProducts,
};
