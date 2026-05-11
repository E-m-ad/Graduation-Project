import db from "../database/db.js";

const PUBLIC_DISCOVERY_PRODUCT_STATUSES = ["available", "rented"];
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
const DEFAULT_HISTORY_LIMIT = 8;
const DEFAULT_CURRENCY_LOCALE = "en-EG";

const PRODUCT_ASSISTANT_SELECT = {
  id: true,
  ownerId: true,
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
  minRentalPeriod: true,
  maxRentalPeriod: true,
  termsConditions: true,
  tags: true,
  avgRating: true,
  totalReviews: true,
  totalRentals: true,
  isApproved: true,
  owner: {
    select: {
      id: true,
      name: true,
      city: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
};

function normalizeText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function truncateText(value, maxLength = 220) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return "";
  }

  if (trimmedValue.length <= maxLength) {
    return trimmedValue;
  }

  return `${trimmedValue.slice(0, maxLength - 3)}...`;
}

function includesAny(value, keywords) {
  return keywords.some((keyword) => value.includes(keyword));
}

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatMoney(value) {
  const numericValue = toNumber(value);
  if (numericValue == null) {
    return "Not set";
  }

  return new Intl.NumberFormat(DEFAULT_CURRENCY_LOCALE, {
    style: "decimal",
    minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

function formatCommaList(values) {
  const filteredValues = (values || []).filter(Boolean);

  if (!filteredValues.length) {
    return "";
  }

  if (filteredValues.length === 1) {
    return filteredValues[0];
  }

  if (filteredValues.length === 2) {
    return `${filteredValues[0]} and ${filteredValues[1]}`;
  }

  return `${filteredValues.slice(0, -1).join(", ")}, and ${
    filteredValues[filteredValues.length - 1]
  }`;
}

function formatProductStatus(product) {
  if (!product) {
    return "unknown";
  }

  if (product.isApproved === false) {
    if (product.status === "under_review") {
      return "under review";
    }

    if (product.status === "suspended") {
      return "rejected or hidden";
    }
  }

  return String(product.status || "unknown").replaceAll("_", " ");
}

function buildProductVisibilityFilter(user) {
  if (user?.role === "admin") {
    return {};
  }

  return {
    OR: [
      {
        isApproved: true,
        status: {
          in: PUBLIC_DISCOVERY_PRODUCT_STATUSES,
        },
        owner: {
          is: {
            isActive: true,
          },
        },
      },
      ...(user?.id
        ? [
            {
              ownerId: user.id,
            },
          ]
        : []),
    ],
  };
}

function normalizePageContext(context = {}) {
  return {
    page: normalizeText(context.page),
    pathname: typeof context.pathname === "string" ? context.pathname.trim() : "",
    pageTitle:
      typeof context.pageTitle === "string" ? context.pageTitle.trim() : "",
    productId:
      typeof context.productId === "string" ? context.productId.trim() : "",
    productTitle:
      typeof context.productTitle === "string"
        ? context.productTitle.trim()
        : "",
    search: typeof context.search === "string" ? context.search.trim() : "",
    city: typeof context.city === "string" ? context.city.trim() : "",
    categoryName:
      typeof context.categoryName === "string"
        ? context.categoryName.trim()
        : "",
    resultsCount:
      typeof context.resultsCount === "number" &&
      Number.isFinite(context.resultsCount)
        ? context.resultsCount
        : null,
  };
}

function getProductPriceOptions(product) {
  return [
    product?.pricePerHour != null
      ? `${formatMoney(product.pricePerHour)} / hour`
      : "",
    product?.pricePerDay != null ? `${formatMoney(product.pricePerDay)} / day` : "",
    product?.pricePerWeek != null
      ? `${formatMoney(product.pricePerWeek)} / week`
      : "",
    product?.pricePerMonth != null
      ? `${formatMoney(product.pricePerMonth)} / month`
      : "",
  ].filter(Boolean);
}

function getProductSummary(product) {
  if (!product) {
    return "";
  }

  const fragments = [];

  if (product.title) {
    fragments.push(`${product.title} is a listing`);
  }

  if (product.category?.name) {
    fragments.push(`in the ${product.category.name} category`);
  }

  if (product.city || product.owner?.city) {
    fragments.push(`around ${product.city || product.owner.city}`);
  }

  const baseSummary = fragments.join(" ");
  const descriptionPreview = truncateText(product.description, 180);

  return descriptionPreview ? `${baseSummary}. ${descriptionPreview}` : `${baseSummary}.`;
}

function getProductRatingsSummary(product) {
  const averageRating = toNumber(product?.avgRating);
  const totalReviews = Number(product?.totalReviews || 0);

  if (!totalReviews || averageRating == null) {
    return "It does not have published reviews yet.";
  }

  return `It is rated ${averageRating.toFixed(1)}/5 from ${totalReviews} review${
    totalReviews === 1 ? "" : "s"
  }.`;
}

function getProductAvailabilitySummary(product) {
  if (!product) {
    return "I do not have the current listing context yet.";
  }

  const normalizedStatus = String(product.status || "").toLowerCase();

  if (product.isApproved === false) {
    if (normalizedStatus === "under_review") {
      return "This listing is still under review, so it is not live for public renting yet.";
    }

    if (normalizedStatus === "suspended") {
      return "This listing is currently hidden or rejected, so it is not available for public renting right now.";
    }
  }

  if (normalizedStatus === "available") {
    return "This listing is currently marked available, so you can check availability and send a rental request from this page.";
  }

  if (normalizedStatus === "rented") {
    return "This listing is visible but currently marked rented, so immediate availability may be limited.";
  }

  if (normalizedStatus === "unavailable") {
    return "This listing is currently marked unavailable.";
  }

  return `This listing is currently marked ${formatProductStatus(product)}.`;
}

function getProductOwnerSummary(product) {
  if (!product?.owner?.name) {
    return "The owner details are limited in the current context.";
  }

  const cityLabel = product.owner.city ? ` in ${product.owner.city}` : "";
  return `The listing owner is ${product.owner.name}${cityLabel}.`;
}

function getProductPriceSummary(product) {
  if (!product) {
    return "I do not have the current listing context yet.";
  }

  const priceOptions = getProductPriceOptions(product);
  const depositLabel = `Security deposit: ${formatMoney(
    product.securityDeposit,
  )}.`;

  if (!priceOptions.length) {
    return `This listing does not show rental prices yet. ${depositLabel}`;
  }

  return `The listed prices are ${formatCommaList(priceOptions)}. ${depositLabel}`;
}

function getRentalGuidance({ user, product }) {
  const intro = product ? `${getProductAvailabilitySummary(product)} ` : "";

  if (!user) {
    return `${intro}You need to log in before you can check availability or send a rental request. After signing in, return to the listing page and use Check Availability or Send Rental Request.`;
  }

  return `${intro}From the listing page, start with Check Availability, review the pricing preview, and then use Send Rental Request. If you need more details first, open chat with the owner and ask about pickup, condition, and timing.`;
}

function getListingGuidance() {
  return "To list your own item, sign in and open My Listings. From there, create a listing with a title, description, at least one rental price, city, condition, and optional terms or tags, then upload images. New listings are published immediately, and admins can deactivate listings when needed.";
}

function getWishlistGuidance(user) {
  if (!user) {
    return "You can browse listings without logging in, but saving items to your wishlist requires an account. After signing in, use the Save button or heart icon on listing cards.";
  }

  return "Use the Save button or heart icon on listing cards to add them to your wishlist. You can review saved items later from the Wishlist page.";
}

function getReviewGuidance() {
  return "Reviews are tied to completed rentals. After a rental finishes, the product details page unlocks review controls for the renter, and owners can reply to published reviews from the same page.";
}

function getNotificationGuidance(user) {
  if (!user) {
    return "Notifications are part of the signed-in workspace. Once you have an account, open Profile and switch to the Notifications tab to review rental, chat, and system updates.";
  }

  return "Open Profile and switch to the Notifications tab to review updates. Booking, rental, and chat notifications can take you back to the related product or conversation.";
}

function getBookingsGuidance(user) {
  if (!user) {
    return "Bookings and rentals are available after you sign in. Once logged in, renters can track activity from Bookings, and owners can manage requests from Rentals.";
  }

  return "Use Bookings to track requests you sent as a renter, and use Rentals to manage requests and active rentals as an owner. Both pages also surface conversation access and status changes.";
}

function getRecommendationsGuidance(user) {
  if (!user) {
    return "Personalized recommendations appear after you sign in and interact with listings. Until then, you can still browse public categories, cities, and recent listings.";
  }

  return "Your home page recommendations are based on marketplace activity such as views, searches, wishlists, rentals, and reviews. The system uses those signals to surface more relevant listings over time.";
}

function getSearchGuidance(pageContext) {
  const appliedFilters = [
    pageContext.search ? `search "${pageContext.search}"` : "",
    pageContext.city ? `city "${pageContext.city}"` : "",
    pageContext.categoryName ? `category "${pageContext.categoryName}"` : "",
  ].filter(Boolean);

  const resultsLabel =
    typeof pageContext.resultsCount === "number"
      ? `You currently have ${pageContext.resultsCount} matching result${
          pageContext.resultsCount === 1 ? "" : "s"
        }. `
      : "";

  if (pageContext.resultsCount === 0) {
    return "Your current filters are not returning any listings. Try clearing the city or category filter, shortening the search phrase, or browsing all categories first.";
  }

  if (appliedFilters.length) {
    return `${resultsLabel}Your current filters are ${formatCommaList(
      appliedFilters,
    )}. If you want broader results, clear one filter at a time and start with search terms that match listing titles or descriptions.`;
  }

  return `${resultsLabel}Use the search field, city filter, and category picker together to narrow the catalog. If results feel too narrow, clear filters and reapply them one by one.`;
}

function getCapabilitiesSummary({ user, product, pageContext }) {
  if (product) {
    return `I can explain ${product.title || "this listing"}, its pricing, availability, reviews, and the next steps to rent it. I can also help with chat, wishlist, bookings, listings, and notifications.`;
  }

  if (pageContext.page === "products") {
    return "I can help you refine filters, understand why certain results appear, explain wishlist and recommendation behavior, and walk you through the rental flow.";
  }

  if (!user) {
    return "I can help you browse AI Rent, understand how renting works, explain account setup, and show where to go next in the app.";
  }

  return "I can help with browsing listings, rental requests, wishlist usage, bookings, owner-side listings, notifications, and product-page questions.";
}

function buildPageContextSummary(pageContext) {
  const fragments = [];

  if (pageContext.page) {
    fragments.push(`Current page key: ${pageContext.page}.`);
  }

  if (pageContext.pageTitle) {
    fragments.push(`Current page title: ${pageContext.pageTitle}.`);
  }

  if (pageContext.pathname) {
    fragments.push(`Current path: ${pageContext.pathname}.`);
  }

  if (pageContext.page === "products") {
    fragments.push(getSearchGuidance(pageContext));
  }

  return fragments.join(" ");
}

function buildVerifiedContextBlock({ user, pageContext, product }) {
  const contextLines = [
    "Application: AI Rent marketplace.",
    user
      ? `Signed-in user: ${user.name || "Unknown"} (${user.role || "user"}).`
      : "Visitor is not signed in.",
    buildPageContextSummary(pageContext),
  ].filter(Boolean);

  if (product) {
    contextLines.push(`Current listing id: ${product.id}.`);
    contextLines.push(getProductSummary(product));
    contextLines.push(getProductAvailabilitySummary(product));
    contextLines.push(getProductPriceSummary(product));
    contextLines.push(getProductOwnerSummary(product));
    contextLines.push(getProductRatingsSummary(product));

    if (Array.isArray(product.tags) && product.tags.length) {
      contextLines.push(`Listing tags: ${product.tags.join(", ")}.`);
    }

    if (product.termsConditions) {
      contextLines.push(
        `Listing terms: ${truncateText(product.termsConditions, 180)}`,
      );
    }
  } else if (pageContext.productId) {
    contextLines.push(
      "A product id was provided, but a visible listing context was not available for this request.",
    );
  }

  return contextLines.filter(Boolean).join("\n");
}

function sanitizeAssistantAnswer(value) {
  return typeof value === "string"
    ? value.replace(/\n{3,}/g, "\n\n").trim()
    : "";
}

function extractChatCompletionText(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return sanitizeAssistantAnswer(content);
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return sanitizeAssistantAnswer(
    content
      .map((part) => {
        if (!part || typeof part !== "object") {
          return "";
        }

        if (typeof part.text === "string") {
          return part.text;
        }

        if (typeof part.content === "string") {
          return part.content;
        }

        return "";
      })
      .join("\n"),
  );
}

function buildDeveloperPrompt({ user, pageContext, product }) {
  return [
    "You are AI Rent's built-in marketplace assistant.",
    "Help users understand the current page, listing details, and next steps inside the app.",
    "Use only the verified context below. If the answer is not in the context, say that you do not know and point the user to the next action inside the UI.",
    "Never claim that you clicked, booked, saved, sent, approved, or changed anything.",
    "Keep replies concise, clear, and action-oriented. Prefer 2 to 5 sentences or a short flat list.",
    "When helpful, reference real UI actions such as Browse, Save, Chat, Check Availability, Send Rental Request, My Listings, Bookings, Rentals, and Profile notifications.",
    "",
    "Verified context:",
    buildVerifiedContextBlock({ user, pageContext, product }),
  ].join("\n");
}

async function findAssistantProductContext(productId, user) {
  if (!productId) {
    return null;
  }

  return db.product.findFirst({
    where: {
      id: productId,
      ...buildProductVisibilityFilter(user),
    },
    select: PRODUCT_ASSISTANT_SELECT,
  });
}

async function generateOpenAiAnswer({
  user,
  history,
  message,
  pageContext,
  product,
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return "";
  }

  const baseUrl = (
    process.env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL
  ).replace(/\/+$/, "");
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const signal =
    typeof AbortSignal?.timeout === "function"
      ? AbortSignal.timeout(12000)
      : undefined;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      store: false,
      messages: [
        {
          role: "developer",
          content: buildDeveloperPrompt({ user, pageContext, product }),
        },
        ...(history || []).slice(-DEFAULT_HISTORY_LIMIT).map((item) => ({
          role: item.role,
          content: item.content,
        })),
        {
          role: "user",
          content: message,
        },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI chat request failed with status ${response.status}: ${errorText}`,
    );
  }

  const payload = await response.json();
  return extractChatCompletionText(payload);
}

function buildFallbackAnswer({ message, user, pageContext, product }) {
  const normalizedMessage = normalizeText(message);

  if (
    includesAny(normalizedMessage, [
      "what can you do",
      "help me",
      "help",
      "who are you",
      "how can you help",
    ])
  ) {
    return getCapabilitiesSummary({ user, product, pageContext });
  }

  if (
    product &&
    includesAny(normalizedMessage, [
      "summarize",
      "summary",
      "explain this listing",
      "tell me about this listing",
      "what is this listing",
      "overview",
    ])
  ) {
    return `${getProductSummary(product)} ${getProductAvailabilitySummary(
      product,
    )} ${getProductPriceSummary(product)} ${getProductRatingsSummary(product)}`;
  }

  if (
    product &&
    includesAny(normalizedMessage, [
      "price",
      "pricing",
      "cost",
      "how much",
      "deposit",
      "fees",
    ])
  ) {
    return getProductPriceSummary(product);
  }

  if (
    product &&
    includesAny(normalizedMessage, [
      "available",
      "availability",
      "can i rent",
      "is it free",
      "status",
    ])
  ) {
    return getProductAvailabilitySummary(product);
  }

  if (
    product &&
    includesAny(normalizedMessage, [
      "owner",
      "contact",
      "chat",
      "message",
      "ask the owner",
    ])
  ) {
    return `${getProductOwnerSummary(
      product,
    )} If you want to ask about pickup, condition, or timing, use the Chat button on the listing page.`;
  }

  if (
    product &&
    includesAny(normalizedMessage, ["reviews", "review", "rating", "condition"])
  ) {
    return `${getProductRatingsSummary(product)} The listing condition is ${
      product.condition || "not specified"
    }.`;
  }

  if (
    includesAny(normalizedMessage, [
      "rent",
      "book",
      "booking",
      "request this",
      "reserve",
    ])
  ) {
    return getRentalGuidance({ user, product });
  }

  if (
    includesAny(normalizedMessage, [
      "list my item",
      "list an item",
      "create listing",
      "create a listing",
      "add product",
      "become owner",
      "post a listing",
    ])
  ) {
    return getListingGuidance();
  }

  if (
    includesAny(normalizedMessage, [
      "wishlist",
      "save",
      "saved items",
      "favorite",
      "favourite",
    ])
  ) {
    return getWishlistGuidance(user);
  }

  if (
    includesAny(normalizedMessage, [
      "recommend",
      "recommendation",
      "recommended",
      "personalized",
    ])
  ) {
    return getRecommendationsGuidance(user);
  }

  if (
    includesAny(normalizedMessage, [
      "notifications",
      "notification",
      "alerts",
      "updates",
    ])
  ) {
    return getNotificationGuidance(user);
  }

  if (
    includesAny(normalizedMessage, [
      "bookings",
      "rentals",
      "requests",
      "my bookings",
      "my rentals",
    ])
  ) {
    return getBookingsGuidance(user);
  }

  if (
    includesAny(normalizedMessage, ["review", "reviews", "rating", "ratings"])
  ) {
    return getReviewGuidance();
  }

  if (
    pageContext.page === "products" ||
    includesAny(normalizedMessage, [
      "search",
      "filter",
      "results",
      "no results",
      "find listings",
    ])
  ) {
    return getSearchGuidance(pageContext);
  }

  if (
    !user &&
    includesAny(normalizedMessage, [
      "login",
      "log in",
      "register",
      "sign in",
      "sign up",
      "account",
    ])
  ) {
    return "You can browse public listings without an account, but renting, wishlists, chat, and listing management require you to sign in. Use the Login or Register page in the top navigation to continue.";
  }

  if (product) {
    return `I can help with ${product.title || "this listing"} by explaining the price, availability, reviews, and the next steps to rent it. Try asking about the pricing, current availability, or what you should ask the owner.`;
  }

  if (pageContext.page === "products") {
    return "I can help you refine filters, explain why results look the way they do, and walk you through the rental flow once you find a listing you like.";
  }

  return getCapabilitiesSummary({ user, product, pageContext });
}

function buildSuggestedPrompts({ user, pageContext, product, message }) {
  const normalizedMessage = normalizeText(message);
  const prompts = [];

  if (product) {
    if (
      includesAny(normalizedMessage, [
        "price",
        "cost",
        "deposit",
        "pricing",
      ])
    ) {
      prompts.push("Is this listing available right now?");
      prompts.push("What should I ask the owner?");
      prompts.push("Summarize this listing");
    } else {
      prompts.push("Summarize this listing");
      prompts.push("Explain the pricing");
      prompts.push("What should I ask the owner?");
    }
  } else if (pageContext.page === "products") {
    prompts.push("How do I improve these results?");
    prompts.push("How do filters work here?");
    prompts.push("How do recommendations work?");
  } else if (!user) {
    prompts.push("How do I create an account?");
    prompts.push("Can I rent without logging in?");
    prompts.push("How do I contact an owner?");
  } else {
    prompts.push("How do I list my own item?");
    prompts.push("Where are my bookings?");
    prompts.push("How do notifications work?");
  }

  return [...new Set(prompts)].slice(0, 3);
}

export async function generateAssistantReply({ user, payload }) {
  const pageContext = normalizePageContext(payload.context);
  const product = await findAssistantProductContext(pageContext.productId, user);

  let answer = "";
  let source = "fallback";

  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      answer = await generateOpenAiAnswer({
        user,
        history: payload.history,
        message: payload.message,
        pageContext,
        product,
      });

      if (answer) {
        source = "llm";
      }
    } catch (error) {
      console.error("assistant OpenAI error:", error);
    }
  }

  if (!answer) {
    answer = buildFallbackAnswer({
      message: payload.message,
      user,
      pageContext,
      product,
    });
  }

  return {
    answer: sanitizeAssistantAnswer(answer),
    suggestedPrompts: buildSuggestedPrompts({
      user,
      pageContext,
      product,
      message: payload.message,
    }),
    source,
    context: {
      page: pageContext.page || null,
      productId: product?.id || pageContext.productId || null,
      productTitle: product?.title || pageContext.productTitle || null,
    },
  };
}
