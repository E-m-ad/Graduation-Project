import React, { useEffect, useRef, useState } from "react";
import {
  formatDateTime,
  formatMoney,
  getPriceLabel,
  getPrimaryImage,
  truncateText,
} from "../lib/airent";

const CATEGORY_CARD_ICON_RULES = [
  {
    key: "vehicle",
    keywords: [
      "vehicle",
      "vehicles",
      "car",
      "cars",
      "bike",
      "bikes",
      "bicycle",
      "motorcycle",
      "scooter",
      "truck",
      "van",
    ],
  },
  {
    key: "camera",
    keywords: ["camera", "cameras", "photo", "photography", "video"],
  },
  {
    key: "music",
    keywords: [
      "music",
      "audio",
      "speaker",
      "speakers",
      "headphone",
      "headphones",
    ],
  },
  {
    key: "gaming",
    keywords: ["gaming", "game", "games", "console", "controller"],
  },
  {
    key: "sports",
    keywords: ["sport", "sports", "fitness", "gym", "exercise", "workout"],
  },
  {
    key: "furniture",
    keywords: ["furniture", "chair", "table", "sofa", "bed", "desk"],
  },
  {
    key: "fashion",
    keywords: [
      "fashion",
      "clothes",
      "clothing",
      "wear",
      "dress",
      "shirt",
      "jacket",
    ],
  },
  {
    key: "books",
    keywords: ["book", "books", "study", "education", "library", "stationery"],
  },
  {
    key: "home",
    keywords: [
      "home",
      "appliance",
      "appliances",
      "kitchen",
      "household",
      "decor",
    ],
  },
  {
    key: "outdoor",
    keywords: ["outdoor", "camp", "camping", "travel", "trip", "adventure"],
  },
  {
    key: "tools",
    keywords: ["tool", "tools", "hardware", "repair", "drill", "workshop"],
  },
  {
    key: "electronics",
    keywords: [
      "electronic",
      "electronics",
      "tech",
      "technology",
      "device",
      "devices",
      "phone",
      "phones",
      "mobile",
      "tablet",
      "laptop",
      "computer",
      "computers",
    ],
  },
];

function getCategoryCardIconKey(name) {
  const normalizedName = String(name || "")
    .trim()
    .toLowerCase();

  for (const rule of CATEGORY_CARD_ICON_RULES) {
    if (rule.keywords.some((keyword) => normalizedName.includes(keyword))) {
      return rule.key;
    }
  }

  return "general";
}

function CategoryCardIcon({ iconKey }) {
  switch (iconKey) {
    case "vehicle":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 15h14l-1.1-4.1a2 2 0 0 0-1.9-1.4H8a2 2 0 0 0-1.9 1.4L5 15Z" />
          <path d="M4 15h16v2.5a1.5 1.5 0 0 1-1.5 1.5H18v1M6 20v-1H5.5A1.5 1.5 0 0 1 4 17.5V15" />
          <circle cx="7.5" cy="16.5" r="1.5" />
          <circle cx="16.5" cy="16.5" r="1.5" />
        </svg>
      );
    case "camera":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8h4l1.5-2h5L16 8h4v10H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      );
    case "music":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 13a8 8 0 0 1 16 0" />
          <rect x="3" y="12" width="4" height="7" rx="2" />
          <rect x="17" y="12" width="4" height="7" rx="2" />
        </svg>
      );
    case "gaming":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7.5 8h9a4.5 4.5 0 0 1 4.4 5.5l-.4 1.7A3 3 0 0 1 17.6 18h-1.4l-2-2H9.8l-2 2H6.4a3 3 0 0 1-2.9-2.8L3 13.5A4.5 4.5 0 0 1 7.5 8Z" />
          <path d="M8 12H6" />
          <path d="M7 11v2" />
          <path d="M16.5 11.5h.01" />
          <path d="M18.5 13.5h.01" />
        </svg>
      );
    case "sports":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 10v4" />
          <path d="M7 9v6" />
          <path d="M10 12h4" />
          <path d="M17 9v6" />
          <path d="M20 10v4" />
          <path d="M7 12h10" />
        </svg>
      );
    case "furniture":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 11V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" />
          <path d="M7 13h10v4H7z" />
          <path d="M9 17v3" />
          <path d="M15 17v3" />
        </svg>
      );
    case "fashion":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 5 12 7l3-2 3 2v4l-2-1v9H8v-9l-2 1V7l3-2Z" />
        </svg>
      );
    case "books":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H11v15H6.5A2.5 2.5 0 0 0 4 21.5Z" />
          <path d="M20 6.5A2.5 2.5 0 0 0 17.5 4H13v15h4.5A2.5 2.5 0 0 1 20 21.5Z" />
        </svg>
      );
    case "home":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 11.5 12 5l8 6.5" />
          <path d="M6.5 10.5V19h11v-8.5" />
          <path d="M10 19v-5h4v5" />
        </svg>
      );
    case "outdoor":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 19 12 5l8 14" />
          <path d="M8 19l4-6 4 6" />
          <path d="M12 5v14" />
        </svg>
      );
    case "tools":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14.5 4.5a4 4 0 0 0-4.7 5.1L4 15.4 6.6 18l5.8-5.8a4 4 0 0 0 5.1-4.7l-2.4 2.4-1.7-1.7Z" />
        </svg>
      );
    case "electronics":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="7" y="3" width="10" height="18" rx="2.5" />
          <path d="M10 6h4" />
          <path d="M11.5 18h1" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 19 7v10l-7 4-7-4V7l7-4Z" />
          <path d="M12 3v18" />
          <path d="M5 7l7 4 7-4" />
        </svg>
      );
  }
}

function CategoryCardGlyph({ category }) {
  const [hasImageError, setHasImageError] = useState(false);
  const iconUrl =
    typeof category?.iconUrl === "string" ? category.iconUrl.trim() : "";

  if (iconUrl && !hasImageError) {
    return (
      <img
        className="category-card__glyph-image"
        src={iconUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setHasImageError(true)}
      />
    );
  }

  return (
    <span className="category-card__glyph-icon">
      <CategoryCardIcon iconKey={getCategoryCardIconKey(category?.name)} />
    </span>
  );
}

export function MessageText({ message, id }) {
  const text = typeof message === "string" ? message : message?.text || "";
  const type = typeof message === "string" ? "" : message?.type || "";
  const className = `message${type ? ` message--${type}` : ""}`;
  if (text === "") {
    return null;
  }
  return (
    <p className={className} id={id}>
      {text}
    </p>
  );
}

export function EmptyState({ message }) {
  return <div className="empty-state">{message}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  note,
  linkHref,
  linkLabel,
  compact = false,
  children,
}) {
  return (
    <div
      className={`section-heading${compact ? " section-heading--compact" : ""}`}
    >
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {note ? <p className="section-note">{note}</p> : null}
      </div>
      {children ||
        (linkHref && linkLabel ? (
          <a className="section-link" href={linkHref}>
            {linkLabel}
          </a>
        ) : null)}
    </div>
  );
}

export function PaginationBar({ pagination, label, onPrevious, onNext }) {
  if (!pagination || pagination.totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination-bar">
      <button
        type="button"
        className="btn btn--secondary"
        onClick={onPrevious}
        disabled={!pagination.hasPreviousPage}
      >
        Previous
      </button>
      <span>
        {label || `Page ${pagination.page} of ${pagination.totalPages}`}
      </span>
      <button
        type="button"
        className="btn btn--secondary"
        onClick={onNext}
        disabled={!pagination.hasNextPage}
      >
        Next
      </button>
    </div>
  );
}

export function ProductCard({
  product,
  showWishlist = false,
  isSaved = false,
  onToggleWishlist,
  actionLayout = "default",
  secondaryText,
  footerActions,
  detailsHref,
}) {
  const detailsUrl =
    detailsHref ||
    `/html/product-details.html?id=${encodeURIComponent(product.id)}`;
  const imageUrl = getPrimaryImage(product);
  const useCompactWishlist = actionLayout === "icon-top";
  const wishlistLabel = isSaved
    ? `Remove ${product.title || "item"} from wishlist`
    : `Save ${product.title || "item"} to wishlist`;
  const defaultSecondaryText = `${product.status || "available"}${
    product.avgRating ? ` | Rating ${Number(product.avgRating).toFixed(1)}` : ""
  }`;

  return (
    <article
      className={`product-card${useCompactWishlist ? " product-card--wishlist-compact" : ""}`}
    >
      {showWishlist && useCompactWishlist ? (
        <button
          type="button"
          className={`product-card__wishlist-icon${isSaved ? " is-saved" : ""}`}
          aria-label={wishlistLabel}
          aria-pressed={isSaved}
          onClick={() => onToggleWishlist?.(product.id, isSaved)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20.6 4.6 13.9a4.9 4.9 0 0 1 6.9-7l.5.5.5-.5a4.9 4.9 0 0 1 6.9 7z" />
          </svg>
        </button>
      ) : null}
      <a className="product-card__media" href={detailsUrl}>
        <img
          className="product-card__image"
          src={imageUrl}
          alt={product.title || "Product image"}
        />
      </a>
      <div className="product-card__body">
        <div className="product-card__meta">
          <span className="tag">{product.category?.name || "General"}</span>
          <span className="product-card__city">
            {product.city || product.owner?.city || "Unknown city"}
          </span>
        </div>
        <div className="product-card__top">
          <div className="product-card__top-copy">
            <h3 className="product-card__title">
              <a href={detailsUrl}>{product.title || "Untitled listing"}</a>
            </h3>
            <p className="compact-text product-card__description">
              {truncateText(
                product.description || "No description available.",
                110,
              )}
            </p>
          </div>
        </div>
        <div className="product-card__bottom">
          <div>
            <p className="product-card__price">{getPriceLabel(product)}</p>
            <p className="compact-text">
              {secondaryText || defaultSecondaryText}
            </p>
          </div>
          {!useCompactWishlist ? (
            footerActions !== undefined ? (
              footerActions
            ) : (
              <div className="hero__actions">
                <a className="btn btn--ghost btn--small" href={detailsUrl}>
                  Details
                </a>
                {showWishlist ? (
                  <button
                    type="button"
                    className="btn btn--secondary btn--small"
                    aria-label={wishlistLabel}
                    aria-pressed={isSaved}
                    onClick={() => onToggleWishlist?.(product.id, isSaved)}
                  >
                    {isSaved ? "Saved" : "Save"}
                  </button>
                ) : null}
              </div>
            )
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function CategoryCard({ category }) {
  const listingCount = Number(category?._count?.products || 0);
  const availabilityLabel = listingCount
    ? `live listing${listingCount === 1 ? "" : "s"}`
    : "Fresh collection";

  return (
    <article className="category-card">
      <div className="category-card__panel">
        <div className="category-card__meta">
          <span className="category-card__glyph" aria-hidden="true">
            <CategoryCardGlyph category={category} />
          </span>
          <span className="category-card__count">
            <span className="category_number">
              {listingCount ? listingCount : null}
            </span>
            {availabilityLabel}
          </span>
        </div>

        <div className="category-card__content">
          {/* <span className="category-card__eyebrow">Rental category</span> */}
          <h3>{category.name}</h3>
          <p>
            {truncateText(
              category.description ||
                "Browse curated rentals, compare live availability, and move into requests faster.",
              104,
            )}
          </p>
        </div>

        <div className="category-card__footer">
          <a
            className="category-card__cta"
            href={`/html/products.html?categoryId=${encodeURIComponent(category.id)}`}
          >
            Explore category
          </a>
        </div>
      </div>
    </article>
  );
}

export function CityCard({ city }) {
  return (
    <a
      className="city-card"
      href={`/html/products.html?city=${encodeURIComponent(city.name)}`}
    >
      <img
        className="city-card__image"
        src={city.imageUrl}
        alt={`${city.name} listings`}
      />
      <span className="city-card__scrim" />
      <div className="city-card__body">
        <span className="city-card__count">
          {city.count} listing{city.count === 1 ? "" : "s"}
        </span>
        <h3>{city.name}</h3>
        <span className="city-card__link">Browse city</span>
      </div>
    </a>
  );
}

export function DetailFactGrid({ facts }) {
  return (
    <div className="detail-facts">
      {facts.map(([label, value]) => (
        <div className="detail-fact" key={label}>
          <span className="detail-fact__label">{label}</span>
          <span className="detail-fact__value">{value}</span>
        </div>
      ))}
    </div>
  );
}

function formatCountdown(endDate, now) {
  const endTime = new Date(endDate).getTime();
  if (!Number.isFinite(endTime)) {
    return { text: "", isElapsed: false };
  }

  const diffMs = endTime - now;
  if (diffMs <= 0) {
    return {
      text: `Scheduled finish reached: ${formatDateTime(endDate)}`,
      isElapsed: true,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (days) parts.push(`${days}d`);
  if (days || hours) parts.push(`${hours}h`);
  if (days || hours || minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return {
    text: `Time left: ${parts.join(" ")}`,
    isElapsed: false,
  };
}

function RentalCountdown({ endDate }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  if (!endDate) {
    return null;
  }

  const countdown = formatCountdown(endDate, now);
  if (!countdown.text) {
    return null;
  }

  return (
    <p
      className={`list-item__meta ${
        countdown.isElapsed
          ? "list-item__meta--warning"
          : "list-item__meta--accent"
      }`}
    >
      {countdown.text}
    </p>
  );
}

function formatRentalStatusLabel(status) {
  return String(status || "rental")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatChatSummaryTimestamp(value) {
  if (!value) {
    return "";
  }

  const parsedValue = new Date(value);
  if (Number.isNaN(parsedValue.getTime())) {
    return "";
  }

  return parsedValue.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRentalChatPreview(rental) {
  if (rental?.chat?.hasMessages && rental.chat.lastMessagePreview) {
    return truncateText(rental.chat.lastMessagePreview, 120);
  }

  return "No messages yet. Start the conversation to coordinate the rental.";
}

function getRentalChatMeta(rental) {
  if (!rental?.chat?.hasMessages) {
    return "Conversation not started";
  }

  const timestampLabel = formatChatSummaryTimestamp(rental.chat.lastMessageAt);
  return timestampLabel ? `Last update ${timestampLabel}` : "Recent message";
}

function getRentalChatUnreadLabel(rental) {
  const unreadCount = Number(rental?.chat?.unreadCount || 0);

  if (!unreadCount) {
    return "";
  }

  return unreadCount === 1 ? "1 new" : `${unreadCount} new`;
}

function getRentalActions(listType, status) {
  const actions = [];

  if (listType === "requests" && status === "pending") {
    actions.push(["approve", "Approve", "btn--primary"]);
    actions.push(["reject", "Reject", "btn--secondary"]);
  }
  if (listType === "requests" && status === "approved") {
    actions.push(["start", "Start", "btn--secondary"]);
  }
  if (listType === "requests" && status === "active") {
    actions.push(["complete", "Complete", "btn--secondary"]);
  }

  return actions;
}

function canDeleteOwnerRental(rental) {
  if (!rental) {
    return false;
  }

  if (["cancelled", "completed"].includes(rental.status)) {
    return true;
  }

  const endTime = new Date(rental.endDate || 0).getTime();
  return Number.isFinite(endTime) && endTime <= Date.now();
}

export function BookingProductCard({ rental, onAction }) {
  const product = {
    ...rental.product,
    id: rental.product?.id || rental.productId,
  };
  const detailsUrl = `/html/product-details.html?id=${encodeURIComponent(
    product.id,
  )}&rentalId=${encodeURIComponent(rental.id)}`;

  return (
    <ProductCard
      product={product}
      detailsHref={detailsUrl}
      footerActions={
        <div className="hero__actions">
          <button
            type="button"
            className="btn btn--secondary btn--small"
            onClick={() => onAction?.("delete", rental.id)}
          >
            Delete
          </button>
        </div>
      }
    />
  );
}

export function RentalListItem({
  rental,
  listType,
  onAction,
  showOwner = false,
}) {
  const actions = getRentalActions(listType, rental.status);
  const canDeleteOwnerRentalItem =
    listType === "requests" && canDeleteOwnerRental(rental);
  const detailsUrl = `/html/product-details.html?id=${encodeURIComponent(rental.productId)}`;
  const imageUrl = getPrimaryImage(rental.product);
  const productCity =
    rental.product?.city ||
    rental.owner?.city ||
    rental.renter?.city ||
    "Unknown city";
  const counterpartRole = showOwner ? "Owner" : "Renter";
  const counterpartName = showOwner
    ? rental.owner?.name || "Unknown"
    : rental.renter?.name || "Unknown";
  const rentalStatusLabel = formatRentalStatusLabel(rental.status);
  const rentalPeriodLabel = formatRentalStatusLabel(
    rental.rentalPeriodType || "Flexible",
  );
  const listingStatusLabel = rental.product?.status
    ? formatRentalStatusLabel(rental.product.status)
    : "Unavailable";
  let timelineLabel = "Update";
  let timelineValue = "Awaiting the next step";

  if (rental.status === "completed" && rental.actualReturnDate) {
    timelineLabel = "Finished at";
    timelineValue = formatDateTime(rental.actualReturnDate);
  } else if (["approved", "active"].includes(rental.status) && rental.endDate) {
    timelineLabel = "Scheduled finish";
    timelineValue = formatDateTime(rental.endDate);
  } else if (rental.status === "pending") {
    timelineValue = "Awaiting approval";
  } else if (rental.status === "cancelled") {
    timelineValue = "Cancelled";
  } else if (rental.status === "rejected") {
    timelineValue = "Rejected";
  } else if (rental.status === "overdue") {
    timelineValue = "Past the scheduled return";
  }

  const requestNote =
    listType === "requests"
      ? rental.renterNotes?.trim()
      : rental.ownerNotes?.trim();
  const requestNoteLabel =
    listType === "requests" ? "Renter note" : "Owner note";
  const unreadLabel = getRentalChatUnreadLabel(rental);

  return (
    <article className="rental-card">
      <div className="product-card rental-card__product">
        <a className="product-card__media rental-card__media" href={detailsUrl}>
          <img
            className="product-card__image"
            src={imageUrl}
            alt={rental.product?.title || "Rental product image"}
          />
        </a>

        <div className="product-card__body rental-card__product-body">
          <div className="product-card__meta">
            {/* <span className="tag">
              {rental.product?.category?.name || "General"}
            </span> */}
            {/* <span className="product-card__city">{productCity}</span> */}
          </div>
          <div className="product-card__top">
            <div className="product-card__top-copy">
              <h3 className="product-card__title">
                <a href={detailsUrl}>{rental.product?.title || "Rental"}</a>
              </h3>
              <div className="rental-card__fact-tags">
                <span className="tag tag--light">{rentalStatusLabel}</span>
                {/* <span className="tag">{rentalPeriodLabel}</span> */}
              </div>

              {/* <p className="compact-text product-card__description">
                {truncateText(
                  rental.product?.description || "No description available.",
                  110,
                )}
              </p> */}
            </div>
          </div>
          <div className="product-card__bottom">
            <div>
              <p className="product-card__price">
                Total price | {formatMoney(rental.totalPrice)}
              </p>
              {/* <p className="compact-text rental-card__price-note">
                {getPriceLabel(rental.product)}
              </p> */}
            </div>
          </div>
        </div>
      </div>

      <div className="product-card__body rental-card__body">
        <div className="rental-card__detail-grid">
          <div className="rental-card__fact">
            <span className="rental-card__fact-label">{counterpartRole}</span>
            <span className="rental-card__fact-value">{counterpartName}</span>
          </div>
          <div className="rental-card__fact">
            <span className="rental-card__fact-label">Starts</span>
            <span className="rental-card__fact-value">
              {formatDateTime(rental.startDate)}
            </span>
          </div>
          <div className="rental-card__fact">
            <span className="rental-card__fact-label">{timelineLabel}</span>
            <span className="rental-card__fact-value">{timelineValue}</span>
          </div>
          <div className="rental-card__fact">
            <span className="rental-card__fact-label">Listing</span>
            <span className="rental-card__fact-value">
              {listingStatusLabel}
            </span>
          </div>
        </div>

        {rental.status === "active" && rental.endDate ? (
          <div className="rental-card__notice">
            <RentalCountdown endDate={rental.endDate} />
          </div>
        ) : null}

        {requestNote ? (
          <div className="rental-card__message">
            <span className="rental-card__message-label">
              {requestNoteLabel}
            </span>
            <p className="compact-text rental-card__message-text">
              {requestNote}
            </p>
          </div>
        ) : null}

        <div className="rental-card__chat">
          <div className="rental-card__chat-header">
            <span className="rental-card__message-label">Conversation</span>
            {unreadLabel ? (
              <span className="tag tag--light">{unreadLabel}</span>
            ) : null}
          </div>
          <p className="compact-text rental-card__chat-preview">
            {getRentalChatPreview(rental)}
          </p>
          <p className="compact-text rental-card__chat-meta">
            {getRentalChatMeta(rental)}
          </p>
        </div>

        <div className="product-card__bottom rental-card__bottom">
          <p className="compact-text rental-card__listing-note">
            {showOwner
              ? "Renter-side booking view"
              : "Owner-side rental control"}
          </p>
          <div className="listing-actions rental-card__actions">
            <a className="btn btn--ghost btn--small" href={detailsUrl}>
              View Product
            </a>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => onAction?.("chat", rental.id)}
            >
              Open chat
            </button>
            {actions.map(([action, label, variant]) => (
              <button
                key={action}
                type="button"
                className={`btn ${variant} btn--small`}
                onClick={() => onAction?.(action, rental.id)}
              >
                {label}
              </button>
            ))}
            {canDeleteOwnerRentalItem ? (
              <button
                type="button"
                className="btn btn--secondary btn--small"
                onClick={() => onAction?.("delete", rental.id)}
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export function ActionDialog({ dialog, setDialog, onClose }) {
  const panelRef = useRef(null);
  const fieldRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const isPrompt = dialog?.mode === "prompt";
  const isDanger = dialog?.tone === "danger";
  const trimmedFieldValue = String(dialog?.fieldValue || "").trim();
  const confirmDisabled = Boolean(
    isPrompt && dialog?.fieldRequired && !trimmedFieldValue,
  );

  useEffect(() => {
    if (!dialog) {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose(isPrompt ? null : false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dialog, isPrompt, onClose]);

  useEffect(() => {
    if (!dialog) {
      return;
    }

    const focusTarget = isPrompt ? fieldRef.current : confirmButtonRef.current;
    focusTarget?.focus();
  }, [dialog, isPrompt]);

  if (!dialog) {
    return null;
  }

  function handleOverlayPointerDown(event) {
    if (event.target === event.currentTarget) {
      onClose(isPrompt ? null : false);
    }
  }

  function handleFieldChange(event) {
    setDialog((previous) =>
      previous
        ? {
            ...previous,
            fieldValue: event.target.value,
          }
        : previous,
    );
  }

  function handleConfirm() {
    onClose(isPrompt ? String(dialog.fieldValue || "") : true);
  }

  return (
    <div
      className="action-dialog"
      role="presentation"
      onMouseDown={handleOverlayPointerDown}
    >
      <div
        className="action-dialog__panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="actionDialogTitle"
      >
        <div className="action-dialog__header">
          <span
            className={`action-dialog__icon${isDanger ? " is-danger" : ""}`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24">
              {isDanger ? (
                <>
                  <path d="M9 4h6l1 2h4v2H4V6h4l1-2Z" />
                  <path d="M7 9h10l-.7 9.1a2 2 0 0 1-2 1.9H9.7a2 2 0 0 1-2-1.9Z" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7.5v5" />
                  <circle cx="12" cy="15.8" r=".9" />
                </>
              )}
            </svg>
          </span>
          <div className="action-dialog__copy">
            <h3 id="actionDialogTitle">{dialog.title}</h3>
            {dialog.message ? (
              <p className="action-dialog__message">{dialog.message}</p>
            ) : null}
          </div>
        </div>

        {isPrompt ? (
          <div className="action-dialog__field">
            {dialog.fieldLabel ? (
              <label htmlFor="actionDialogField">{dialog.fieldLabel}</label>
            ) : null}
            {dialog.fieldMultiline ? (
              <textarea
                id="actionDialogField"
                ref={fieldRef}
                className="textarea action-dialog__textarea"
                rows="4"
                placeholder={dialog.fieldPlaceholder}
                value={dialog.fieldValue}
                onChange={handleFieldChange}
              />
            ) : (
              <input
                id="actionDialogField"
                ref={fieldRef}
                className="input"
                type="text"
                placeholder={dialog.fieldPlaceholder}
                value={dialog.fieldValue}
                onChange={handleFieldChange}
              />
            )}
            {dialog.fieldRequired && !trimmedFieldValue ? (
              <p className="action-dialog__hint">
                This field is required before continuing.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="action-dialog__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => onClose(isPrompt ? null : false)}
          >
            {dialog.cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmButtonRef}
            className={`btn ${isDanger ? "btn--primary" : "btn--secondary"}`}
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
